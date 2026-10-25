import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { GATEWAY_COOKIE, hasBasicAuth, isDocumentRequest, parseCookies, peerIsAllowed, safeEqual } from './auth.js';
import { createSecretResolver, mintSessionCookie } from './session.js';
import { createUpstreamResolver } from './upstream.js';
import { injectUiTags, readUiAsset, uiAssetsAvailable } from './ui.js';
import { phoneUrls } from './config.js';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const AUTH_BYPASS = new Set([
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
]);

const MAX_HTML_BYTES = 8 * 1024 * 1024;
const RETRY_MS = 5000;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function authorityFor(target) {
  const host = target.host.includes(':') ? `[${target.host}]` : target.host;
  return `${host}:${target.port}`;
}

function sendText(res, status, body, extra = {}) {
  if (res.headersSent) {
    res.end();
    return;
  }
  const buffer = Buffer.from(body);
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': buffer.length,
    'cache-control': 'no-store',
    ...extra,
  });
  res.end(buffer);
}

function sendHtml(res, status, body) {
  if (res.headersSent) {
    res.end();
    return;
  }
  const buffer = Buffer.from(body);
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': buffer.length,
    'cache-control': 'no-store',
  });
  res.end(buffer);
}

export function createPhoneGateway(options) {
  const {
    config,
    configPath,
    phoneUrlFile,
    uiDir,
    version = '0.0.0',
    logger = () => {},
    getOrigin = null,
    yamlPath,
    readCredentialRecord = null,
  } = options;

  const log = (...args) => logger(...args);
  const secretResolver = createSecretResolver({ yamlPath, readRecord: readCredentialRecord });
  const upstream = createUpstreamResolver({ getOrigin, pinnedPort: config.upstreamPort, logger: log });
  const uiEnhanced = config.uiEnhance?.mobileDrawer !== false && uiAssetsAvailable(uiDir);
  const agent = new http.Agent({ keepAlive: true, maxSockets: 128 });
  const liveSockets = new Set();

  let closed = false;
  let retryTimer = null;
  let startedAt = null;
  let boundPort = config.listenPort;

  const server = http.createServer((req, res) => {
    handleHttp(req, res).catch((error) => {
      log(`request failed: ${req.method} ${req.url}: ${error.message}`);
      sendText(res, 500, 'phone-remote: internal error\n');
    });
  });
  server.requestTimeout = 0;
  server.headersTimeout = 60_000;
  server.keepAliveTimeout = 65_000;
  server.timeout = 0;
  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  function track(socket) {
    liveSockets.add(socket);
    socket.once('close', () => liveSockets.delete(socket));
  }

  function isAuthorized(req) {
    if (hasBasicAuth(req.headers.authorization, config.basicUser, config.basicPass)) return true;
    const token = parseCookies(req.headers.cookie)[GATEWAY_COOKIE];
    return safeEqual(token ?? '', config.accessKey);
  }

  function accessPage(reason) {
    const hint = reason ? `<p class="hint">${escapeHtml(reason)}</p>` : '';
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Phone Remote · 访问验证</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b1220; color: #e5e7eb; }
  main { width: min(92vw, 420px); padding: 28px 24px; border-radius: 18px; background: #111c33; box-shadow: 0 16px 60px rgb(0 0 0 / 45%); }
  h1 { margin: 0 0 6px; font-size: 20px; }
  p { margin: 6px 0; color: #9ca3af; }
  form { display: flex; gap: 8px; margin-top: 18px; }
  input { flex: 1; min-width: 0; padding: 12px; font-size: 16px; border-radius: 10px; border: 1px solid #334155; background: #0b1220; color: inherit; }
  button { padding: 12px 18px; font-size: 16px; border: 0; border-radius: 10px; background: #2563eb; color: #fff; font-weight: 600; }
  code { font-size: 13px; word-break: break-all; color: #93c5fd; }
  .hint { color: #fca5a5; }
</style>
</head>
<body>
<main>
  <h1>Phone Remote</h1>
  <p>请输入这台电脑上 <code>config.json</code> 里的 <strong>accessKey</strong>。</p>
  ${hint}
  <form method="get" action="/__dshgw/">
    <input name="k" type="password" autocomplete="current-password" placeholder="访问密钥" autofocus aria-label="访问密钥">
    <button type="submit">进入</button>
  </form>
  <p>配置文件：<code>${escapeHtml(configPath)}</code></p>
  <p>仅限 DeepSeek Harness 桌面客户端使用。</p>
</main>
</body>
</html>`;
  }

  function dashboardPage() {
    const urls = phoneUrls(config);
    const localOnly = config.listenHost === '127.0.0.1' || config.listenHost === '::1';
    const rows = urls.map((url) => `<li><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`).join('');
    const upstreamState = (() => {
      try {
        const target = upstream.resolve();
        return target ? escapeHtml(target.origin ?? `${target.host}:${target.port}`) : '<span class="warn">not discovered</span>';
      } catch (error) {
        return `<span class="warn">${escapeHtml(error.message)}</span>`;
      }
    })();
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Phone Remote</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 24px 18px 48px; font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b1220; color: #e5e7eb; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 8px; color: #93c5fd; letter-spacing: .04em; text-transform: uppercase; }
  p, li { color: #cbd5e1; }
  code { color: #93c5fd; word-break: break-all; }
  ul { padding-left: 18px; }
  li { margin: 6px 0; }
  a { color: #67e8f9; }
  .card { background: #111c33; border: 1px solid #1e293b; border-radius: 14px; padding: 18px 18px 10px; }
  .grid { display: grid; gap: 8px; grid-template-columns: 120px 1fr; }
  .grid dt { color: #94a3b8; }
  .grid dd { margin: 0; word-break: break-all; }
  .warn { color: #fca5a5; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #064e3b; color: #6ee7b7; font-size: 12px; }
</style>
</head>
<body>
<main>
  <h1>Phone Remote <span class="badge">running</span></h1>
  <p>用手机扫码或直接打开下面的链接（手机与电脑需在同一局域网）。</p>
  ${localOnly ? '<p class="warn">当前 listenHost 只绑定了回环地址，手机无法访问。请把 config.json 里的 listenHost 改成 0.0.0.0。</p>' : ''}
  <section class="card">
    <h2>手机链接</h2>
    <ul>${rows}</ul>
    <p>链接里已包含访问密钥，请勿转发或截图分享。</p>
  </section>
  <section class="card">
    <h2>状态</h2>
    <dl class="grid">
      <dt>监听</dt><dd><code>${escapeHtml(config.listenHost)}:${boundPort}</code></dd>
      <dt>上游</dt><dd>${upstreamState}</dd>
      <dt>允许网段</dt><dd><code>${escapeHtml(config.allowCidrs.join(', '))}</code></dd>
      <dt>Basic 用户</dt><dd><code>${escapeHtml(config.basicUser)}</code></dd>
      <dt>Basic 密码</dt><dd><code>${escapeHtml(config.basicPass)}</code></dd>
      <dt>配置</dt><dd><code>${escapeHtml(configPath)}</code></dd>
      <dt>移动端抽屉</dt><dd>${uiEnhanced ? '已启用' : '未启用（缺少 ui 资源）'}</dd>
      <dt>版本</dt><dd>${escapeHtml(version)}</dd>
    </dl>
  </section>
  <section class="card">
    <h2>提示</h2>
    <ul>
      <li>修改 <code>config.json</code> 后，在 DeepSeek Harness 的插件设置里关闭再打开本插件即可生效。</li>
      <li>iPhone / iPad 可用 Safari 分享菜单里的「添加到主屏幕」。</li>
      <li>只应在可信的局域网中使用；不要把端口暴露到公网。</li>
    </ul>
  </section>
</main>
</body>
</html>`;
  }

  function statusPayload() {
    let target = null;
    try {
      target = upstream.resolve();
    } catch {
      target = null;
    }
    return {
      ok: true,
      plugin: 'dsh-phone-remote',
      version,
      pid: process.pid,
      uptimeSeconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
      listen: { host: config.listenHost, port: boundPort, address: server.address() },
      upstream: target ? { origin: target.origin, host: target.host, port: target.port } : null,
      allowCidrs: config.allowCidrs,
      phoneUrls: phoneUrls(config),
      uiEnhance: uiEnhanced,
      configPath,
    };
  }

  function writePhoneUrlFile() {
    if (!phoneUrlFile) return;
    try {
      const lines = [
        '# dsh-phone-remote',
        '# 手机与电脑需在同一局域网；链接包含访问密钥，请勿分享。',
        ...phoneUrls(config),
        '',
        `Basic: ${config.basicUser} / ${config.basicPass}`,
        `Config: ${configPath}`,
        `Generated: ${new Date().toISOString()}`,
        '',
      ];
      fs.mkdirSync(path.dirname(phoneUrlFile), { recursive: true, mode: 0o700 });
      fs.writeFileSync(phoneUrlFile, lines.join('\n'), { mode: 0o600 });
    } catch (error) {
      log(`cannot write ${phoneUrlFile}: ${error.message}`);
    }
  }

  async function handleHttp(req, res) {
    const url = new URL(req.url ?? '/', 'http://phone-remote.local');
    const pathname = url.pathname;
    const peer = req.socket.remoteAddress ?? '';

    if (!peerIsAllowed(config.allowCidrs, peer)) {
      log(`denied ${peer} ${pathname}`);
      return sendText(res, 403, 'phone-remote: source address not allowed\n');
    }

    const key = url.searchParams.get('k');
    if (key !== null) {
      if (!safeEqual(key, config.accessKey)) return sendHtml(res, 401, accessPage('访问密钥不正确。'));
      url.searchParams.delete('k');
      const destination = `${url.pathname}${url.search}` || '/';
      res.writeHead(303, {
        location: destination,
        'set-cookie': `${GATEWAY_COOKIE}=${config.accessKey}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`,
        'cache-control': 'no-store',
      });
      return res.end();
    }

    if (pathname === '/__dshgw/status') {
      if (!isAuthorized(req)) return sendHtml(res, 401, accessPage('需要先通过访问验证。'));
      return sendText(res, 200, `${JSON.stringify(statusPayload(), null, 2)}\n`, { 'content-type': 'application/json; charset=utf-8' });
    }

    if (pathname === '/__dshgw' || pathname === '/__dshgw/') {
      if (!isAuthorized(req)) return sendHtml(res, 401, accessPage('需要先通过访问验证。'));
      return sendHtml(res, 200, dashboardPage());
    }

    if (pathname.startsWith('/__dshgw/ui/')) {
      if (!isAuthorized(req)) return sendText(res, 401, 'unauthorized\n');
      const asset = readUiAsset(uiDir, pathname);
      if (!asset) return sendText(res, 404, 'not found\n');
      res.writeHead(200, {
        'content-type': asset.type,
        'content-length': asset.body.length,
        'cache-control': 'no-cache',
      });
      return res.end(asset.body);
    }

    if (!AUTH_BYPASS.has(pathname) && !isAuthorized(req)) {
      return sendHtml(res, 401, accessPage(''));
    }

    await forward(req, res);
  }

  function proxyHeaders(req, target, secret, { document, websocket }) {
    const authority = authorityFor(target);
    const headers = {};
    for (const [name, value] of Object.entries(req.headers)) {
      const lower = name.toLowerCase();
      if (lower === 'host' || lower === 'cookie' || lower === 'authorization') continue;
      if (lower.startsWith('x-forwarded-')) continue;
      if (!websocket && HOP_BY_HOP.has(lower)) continue;
      headers[lower] = value;
    }
    const cookie = mintSessionCookie(authority, secret);
    headers.host = authority;
    headers.cookie = `${cookie.name}=${cookie.value}`;
    if (req.headers.origin) headers.origin = `http://${authority}`;
    headers['x-forwarded-for'] = String(req.socket.remoteAddress ?? '127.0.0.1').replace(/^::ffff:/, '');
    headers['x-forwarded-proto'] = 'http';
    if (!websocket && document && uiEnhanced) headers['accept-encoding'] = 'identity';
    return headers;
  }

  function responseHeaders(upstreamRes) {
    const headers = {};
    for (const [name, value] of Object.entries(upstreamRes.headers)) {
      const lower = name.toLowerCase();
      if (HOP_BY_HOP.has(lower) || lower === 'set-cookie') continue;
      headers[lower] = value;
    }
    return headers;
  }

  async function forward(req, res, attempt = 0) {
    let target;
    try {
      target = upstream.resolve();
    } catch (error) {
      log(`upstream resolve failed: ${error.message}`);
      return sendText(res, 502, 'phone-remote: cannot locate the Harness Web UI\n');
    }
    if (!target) {
      return sendText(res, 502, 'phone-remote: DeepSeek Harness Web UI is not running\n');
    }

    let secret;
    try {
      secret = await secretResolver.get();
    } catch (error) {
      log(`session secret unavailable: ${error.message}`);
      return sendText(res, 500, 'phone-remote: cannot read the DSH browser-session credential\n');
    }

    const document = isDocumentRequest(req);
    const headers = proxyHeaders(req, target, secret, { document, websocket: false });

    let upstreamReq;
    try {
      upstreamReq = http.request({
        host: target.host,
        port: target.port,
        method: req.method,
        path: req.url || '/',
        headers,
        agent,
      });
    } catch (error) {
      return sendText(res, 502, `phone-remote: ${error.message}\n`);
    }

    upstreamReq.on('response', (upstreamRes) => {
      const status = upstreamRes.statusCode ?? 502;

      if (status === 401 && attempt === 0 && (req.method === 'GET' || req.method === 'HEAD')) {
        upstreamRes.resume();
        upstream.invalidate();
        secretResolver.invalidate();
        log('upstream rejected the minted session cookie; retrying with a fresh credential');
        return void forward(req, res, 1);
      }

      const contentType = String(upstreamRes.headers['content-type'] ?? '');
      const isHtml = contentType.includes('text/html');
      const canInject = uiEnhanced
        && isHtml
        && req.method !== 'HEAD'
        && status === 200
        && !upstreamRes.headers['content-encoding'];

      const headersOut = responseHeaders(upstreamRes);

      if (!canInject) {
        if (isHtml && uiEnhanced && upstreamRes.headers['content-encoding']) {
          log('skipping drawer injection: upstream response was compressed despite identity encoding');
        }
        res.writeHead(status, upstreamRes.statusMessage, headersOut);
        upstreamRes.pipe(res);
        return;
      }

      const chunks = [];
      let size = 0;
      let overflow = false;
      upstreamRes.on('error', (error) => {
        log(`upstream response failed: ${error.message}`);
        if (res.destroyed) return;
        if (res.headersSent) res.destroy();
        else sendText(res, 502, 'phone-remote: lost the connection to the Harness Web UI\n');
      });
      upstreamRes.on('data', (chunk) => {
        if (overflow) {
          if (!res.destroyed) res.write(chunk);
          return;
        }
        size += chunk.length;
        if (size > MAX_HTML_BYTES) {
          overflow = true;
          log(`HTML response exceeded ${MAX_HTML_BYTES} bytes; passing it through without injection`);
          delete headersOut['content-length'];
          res.writeHead(status, headersOut);
          for (const buffered of chunks) res.write(buffered);
          chunks.length = 0;
          res.write(chunk);
          return;
        }
        chunks.push(chunk);
      });
      upstreamRes.on('end', () => {
        if (overflow) {
          if (!res.destroyed) res.end();
          return;
        }
        if (res.headersSent) return;
        const html = Buffer.concat(chunks).toString('utf8');
        const patched = injectUiTags(html);
        if (patched !== html) log(`injected mobile drawer assets into ${req.url}`);
        const body = Buffer.from(patched);
        delete headersOut['content-length'];
        headersOut['content-length'] = body.length;
        res.writeHead(status, headersOut);
        res.end(body);
      });
    });

    upstreamReq.on('error', (error) => {
      log(`upstream request failed: ${req.method} ${req.url}: ${error.message}`);
      upstream.invalidate();
      if (res.headersSent) {
        res.destroy();
      } else {
        sendText(res, 502, 'phone-remote: lost the connection to the Harness Web UI\n');
      }
    });

    req.on('aborted', () => upstreamReq.destroy());
    req.pipe(upstreamReq);
  }

  async function handleUpgrade(req, socket, head) {
    const peer = req.socket.remoteAddress ?? '';
    if (!peerIsAllowed(config.allowCidrs, peer)) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    if (!isAuthorized(req)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return;
    }

    const rawUrl = req.url ?? '/';
    if (rawUrl === '/__dshgw/status' || rawUrl.startsWith('/__dshgw/')) {
      socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
      return;
    }

    let target;
    try {
      target = upstream.resolve();
    } catch {
      target = null;
    }
    if (!target) {
      socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      return;
    }

    let secret;
    try {
      secret = await secretResolver.get();
    } catch (error) {
      log(`session secret unavailable for websocket: ${error.message}`);
      socket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      return;
    }

    const headers = proxyHeaders(req, target, secret, { document: false, websocket: true });
    const upstreamReq = http.request({
      host: target.host,
      port: target.port,
      method: req.method,
      path: rawUrl,
      headers,
      agent: false,
    });

    upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
      track(upstreamSocket);
      track(socket);
      const headerLines = [`HTTP/1.1 101 Switching Protocols`];
      for (let index = 0; index < upstreamRes.rawHeaders.length; index += 2) {
        headerLines.push(`${upstreamRes.rawHeaders[index]}: ${upstreamRes.rawHeaders[index + 1]}`);
      }
      socket.write(`${headerLines.join('\r\n')}\r\n\r\n`);
      if (upstreamHead?.length) socket.write(upstreamHead);
      if (head?.length) upstreamSocket.write(head);
      upstreamSocket.pipe(socket);
      socket.pipe(upstreamSocket);
      upstreamSocket.on('error', () => socket.destroy());
      socket.on('error', () => upstreamSocket.destroy());
      log(`websocket upgraded ${rawUrl}`);
    });

    upstreamReq.on('response', (upstreamRes) => {
      const lines = [`HTTP/1.1 ${upstreamRes.statusCode ?? 502} ${upstreamRes.statusMessage ?? ''}`];
      for (let index = 0; index < upstreamRes.rawHeaders.length; index += 2) {
        lines.push(`${upstreamRes.rawHeaders[index]}: ${upstreamRes.rawHeaders[index + 1]}`);
      }
      socket.write(`${lines.join('\r\n')}\r\n\r\n`);
      upstreamRes.resume();
      socket.end();
    });

    upstreamReq.on('error', (error) => {
      log(`websocket upstream failed: ${error.message}`);
      upstream.invalidate();
      socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    });

    socket.on('error', () => upstreamReq.destroy());
    upstreamReq.end();
  }

  server.on('upgrade', (req, socket, head) => {
    handleUpgrade(req, socket, head).catch((error) => {
      log(`websocket handler failed: ${error.message}`);
      socket.destroy();
    });
  });

  function start() {
    if (closed) return;
    const onError = (error) => {
      server.removeListener('listening', onListening);
      log(`listen failed on ${config.listenHost}:${boundPort}: ${error.code ?? error.message}`);
      if (error.code === 'EADDRINUSE') {
        log('port is busy: if you migrated from the launchd gateway, run: launchctl bootout gui/$(id -u)/com.dsh.remote-gateway');
      }
      if (!closed) {
        retryTimer = setTimeout(start, RETRY_MS);
        retryTimer.unref?.();
      }
    };
    const onListening = () => {
      server.removeListener('error', onError);
      server.on('error', (error) => log(`server error: ${error.message}`));
      const address = server.address();
      if (address && typeof address === 'object') boundPort = address.port;
      startedAt = Date.now();
      writePhoneUrlFile();
      log(`listening on ${config.listenHost}:${boundPort}`);
      log(`phone URLs:\n${phoneUrls(config).join('\n')}`);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    try {
      server.listen(config.listenPort, config.listenHost);
    } catch (error) {
      onError(error);
    }
  }

  async function stop() {
    closed = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    for (const socket of liveSockets) socket.destroy();
    liveSockets.clear();
    agent.destroy();
    if (!server.listening) {
      server.closeAllConnections?.();
      return;
    }
    await new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
      setTimeout(resolve, 1000).unref?.();
    });
    log('stopped listening');
  }

  return {
    start,
    stop,
    status: statusPayload,
    get port() {
      return boundPort;
    },
    get listening() {
      return server.listening;
    },
  };
}
