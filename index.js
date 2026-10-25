import { fileURLToPath } from 'node:url';

import {
  loadConfig,
  pathsFor,
  phoneUrls,
  randomToken,
  resolveDshHome,
  updateConfig,
} from './lib/config.js';
import { createLogger } from './lib/log.js';
import { createPhoneGateway } from './lib/gateway.js';
import { createCloudflareTunnel } from './lib/cloudflare.js';
import { createPublicIpResolver } from './lib/public-ip.js';

export const name = '@flametinary/dsh-phone-remote';

/**
 * The gateway mirrors the Harness Web UI, so it needs the webServer service to
 * discover the loopback origin. The settings API is an exact route on that same
 * server, which makes it same-origin for the Settings page and reachable
 * through the phone gateway.
 */
export const inject = ['webServer'];

const VERSION = '0.3.0';
const CONFIG_ROUTE = '/phone-remote/api/config';
const MAX_BODY_BYTES = 64 * 1024;
const RESTART_DELAY_MS = 120;

function isLoopback(address) {
  const value = String(address ?? '').replace(/^::ffff:/, '');
  return value === '127.0.0.1' || value === '::1' || value.startsWith('127.');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(Object.assign(new Error('request body is too large'), { statusCode: 413 }));
        return;
      }
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, value) {
  if (res.headersSent) {
    res.end();
    return;
  }
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  res.end(body);
}

function normalizeCidrs(value) {
  const list = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[\n,]+/);
  return [...new Set(list.map((entry) => String(entry).trim()).filter(Boolean))];
}

export function apply(ctx, _config) {
  const dshHome = resolveDshHome();
  const paths = pathsFor(dshHome);

  let loaded;
  const bootLog = (...args) => console.log('[dsh-phone-remote]', ...args);
  try {
    loaded = loadConfig(paths, { log: bootLog });
  } catch (error) {
    console.error(`[dsh-phone-remote] ${error.message}`);
    throw error;
  }

  let config = loaded.config;
  const log = createLogger(paths, { maxBytes: config.logMaxBytes });
  const cloudflareLog = createLogger(paths, {
    file: paths.cloudflareLogFile,
    label: 'dsh-phone-remote/cloudflare',
    maxBytes: config.logMaxBytes,
    echo: false,
  });
  const publicIp = createPublicIpResolver({ logger: log });
  const uiDir = fileURLToPath(new URL('./ui/', import.meta.url));

  let cloudflare = null;
  let gateway = null;
  let restarting = false;
  let restartTimer = null;
  let disposed = false;

  function createGateway() {
    return createPhoneGateway({
      config,
      version: VERSION,
      configPath: paths.configFile,
      phoneUrlFile: paths.phoneUrlFile,
      uiDir,
      yamlPath: `${dshHome}/.credentials.yaml`,
      logger: log,
      getCloudflareState: () => cloudflare?.status() ?? null,
      publicIp,
      getOrigin: () => ctx.webServer.getOrigin(),
      readCredentialRecord: async () => {
        try {
          const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined;
          if (!credentials || typeof credentials.readRecord !== 'function') return undefined;
          return await credentials.readRecord('client-connection/browser-session');
        } catch {
          return undefined;
        }
      },
    });
  }

  function startGateway() {
    if (disposed) return;
    gateway = createGateway();
    gateway.start();
  }

  function remoteUrlList() {
    const state = cloudflare?.status();
    const base = state?.publicUrl;
    if (!base) return [];
    try {
      const url = new URL(base);
      url.searchParams.set('k', config.accessKey);
      return [url.toString()];
    } catch {
      return [];
    }
  }

  function startCloudflare() {
    if (disposed) return;
    if (!config.cloudflare?.enabled) {
      cloudflare = null;
      return;
    }
    cloudflare = createCloudflareTunnel({
      config,
      port: () => gateway?.port ?? config.listenPort,
      logger: cloudflareLog,
      publicIp,
      onUrlChange: () => {
        try {
          gateway?.refreshPhoneUrls?.();
        } catch (error) {
          log(`failed to refresh phone URL file: ${error.message}`);
        }
      },
    });
    cloudflare.start();
  }

  async function stopCloudflare() {
    const current = cloudflare;
    cloudflare = null;
    if (!current) return;
    try {
      await current.stop();
    } catch (error) {
      log(`cloudflare stop failed: ${error.message}`);
    }
  }

  async function restartServices(reason) {
    if (disposed) return;
    await stopCloudflare();
    const previous = gateway;
    gateway = null;
    if (previous) {
      try {
        await previous.stop();
      } catch (error) {
        log(`gateway stop before restart failed: ${error.message}`);
      }
    }
    if (disposed) return;
    startGateway();
    startCloudflare();
    log(`services restarted (${reason})`);
  }

  function state() {
    const status = (() => {
      try {
        return gateway?.status?.() ?? {};
      } catch {
        return {};
      }
    })();
    const boundPort = gateway?.port ?? null;
    return {
      ok: true,
      plugin: name,
      version: VERSION,
      pid: process.pid,
      restarting,
      listening: gateway?.listening === true,
      listenHost: config.listenHost,
      configuredPort: config.listenPort,
      port: boundPort,
      upstream: status.upstream ?? null,
      accessKey: config.accessKey,
      basicUser: config.basicUser,
      basicPass: config.basicPass,
      allowCidrs: [...config.allowCidrs],
      upstreamPort: config.upstreamPort,
      mobileDrawer: config.uiEnhance?.mobileDrawer !== false,
      uiEnhance: config.uiEnhance,
      phoneUrls: phoneUrls({ ...config, listenPort: boundPort ?? config.listenPort }),
      remoteUrls: remoteUrlList(),
      cloudflare: cloudflare?.status() ?? { enabled: false },
      cloudflareConfig: { ...config.cloudflare },
      configPath: paths.configFile,
      phoneUrlFile: paths.phoneUrlFile,
      logFile: paths.logFile,
      cloudflareLogFile: paths.cloudflareLogFile,
      uptimeSeconds: status.uptimeSeconds ?? 0,
    };
  }

  function scheduleRestart(reason) {
    if (disposed) return;
    if (restartTimer) clearTimeout(restartTimer);
    restarting = true;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      restartServices(reason)
        .catch((error) => log(`service restart failed: ${error.message}`))
        .finally(() => {
          restarting = false;
        });
    }, RESTART_DELAY_MS);
    restartTimer.unref?.();
  }

  async function onConfigRequest(req, res) {
    let url;
    try {
      url = new URL(req.url ?? '/', 'http://phone-remote.local');
    } catch {
      sendJson(res, 400, { ok: false, error: 'invalid request url' });
      return;
    }
    if (url.pathname !== CONFIG_ROUTE) {
      sendJson(res, 404, { ok: false, error: 'not found' });
      return;
    }

    // This endpoint can rewrite credentials and network policy, so never
    // expose it through a LAN-bound Harness web server. The phone reaches it
    // through the gateway, whose upstream connection is loopback.
    if (!isLoopback(req.socket?.remoteAddress)) {
      sendJson(res, 403, { ok: false, error: 'config API is loopback-only' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, state());
      return;
    }

    if (req.method !== 'POST') {
      res.setHeader('allow', 'GET, POST');
      sendJson(res, 405, { ok: false, error: 'method not allowed' });
      return;
    }

    // Custom-header + JSON content-type is a CSRF fence: a cross-origin HTML
    // form cannot send either one, and no CORS grant is exposed here.
    if (req.headers['x-phone-remote-config'] !== '1') {
      sendJson(res, 403, { ok: false, error: 'missing x-phone-remote-config header' });
      return;
    }
    if (!/^application\/json\b/i.test(String(req.headers['content-type'] ?? ''))) {
      sendJson(res, 415, { ok: false, error: 'content-type must be application/json' });
      return;
    }

    let text;
    try {
      text = await readBody(req);
    } catch (error) {
      sendJson(res, error.statusCode ?? 400, { ok: false, error: error.message });
      return;
    }

    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch (error) {
      sendJson(res, 400, { ok: false, error: `invalid JSON body: ${error.message}` });
      return;
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, { ok: false, error: 'body must be a JSON object' });
      return;
    }

    const patch = {};
    try {
      if (body.rotateAccessKey === true) {
        patch.accessKey = randomToken(24);
      } else {
        if (Object.hasOwn(body, 'listenPort')) {
          patch.listenPort = Number(body.listenPort);
        }
        if (Object.hasOwn(body, 'upstreamPort')) {
          patch.upstreamPort = body.upstreamPort === null || body.upstreamPort === ''
            ? null
            : Number(body.upstreamPort);
        }
        if (Object.hasOwn(body, 'basicUser')) {
          patch.basicUser = String(body.basicUser ?? '');
        }
        if (Object.hasOwn(body, 'basicPass')) {
          patch.basicPass = String(body.basicPass ?? '');
        }
        if (Object.hasOwn(body, 'allowCidrs')) {
          patch.allowCidrs = normalizeCidrs(body.allowCidrs);
        }
        if (Object.hasOwn(body, 'mobileDrawer')) {
          patch.uiEnhance = { mobileDrawer: Boolean(body.mobileDrawer) };
        }
        if (Object.hasOwn(body, 'cloudflare')) {
          const input = body.cloudflare;
          if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw new Error('cloudflare must be an object');
          }
          const next = { ...config.cloudflare };
          if (Object.hasOwn(input, 'enabled')) next.enabled = Boolean(input.enabled);
          if (Object.hasOwn(input, 'mode')) {
            next.mode = input.mode === 'token' ? 'token' : 'quick';
          }
          if (Object.hasOwn(input, 'token')) next.token = String(input.token ?? '').trim();
          if (Object.hasOwn(input, 'publicUrl')) next.publicUrl = String(input.publicUrl ?? '').trim();
          if (Object.hasOwn(input, 'autoLanRedirect')) next.autoLanRedirect = Boolean(input.autoLanRedirect);
          if (Object.hasOwn(input, 'cloudflaredPath')) {
            next.cloudflaredPath = String(input.cloudflaredPath ?? '').trim() || 'cloudflared';
          }
          patch.cloudflare = next;
        }
      }

      config = updateConfig(paths, config, patch);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
      return;
    }

    const next = state();
    log(`config updated from settings (${Object.keys(patch).join(', ') || 'noop'})`);
    sendJson(res, 200, { ...next, restarting: true });
    scheduleRestart('settings save');
  }

  ctx.effect(() => {
    log(`plugin activated (v${VERSION}, config ${paths.configFile})`);
    startGateway();
    startCloudflare();
    const disposeRoute = ctx.webServer.register({
      kind: 'exact',
      path: CONFIG_ROUTE,
      handler: (req, res) => {
        Promise.resolve(onConfigRequest(req, res)).catch((error) => {
          console.error('[dsh-phone-remote] config request failed:', error);
          sendJson(res, 500, { ok: false, error: 'internal error' });
        });
      },
    });
    return async () => {
      disposed = true;
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      disposeRoute();
      await stopCloudflare();
      const current = gateway;
      gateway = null;
      await current?.stop();
    };
  }, 'dsh-phone-remote');
}
