import { execFileSync } from 'node:child_process';

function run(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function discoverUpstreamPort() {
  const ps = run('ps', ['-Ao', 'pid=,command=']);
  for (const line of ps.split('\n')) {
    if (!line.includes('dsh-desktop-host/lib/index.js')) continue;
    if (line.includes('Helper')) continue;
    const pid = line.trim().split(/\s+/, 1)[0];
    if (!/^\d+$/.test(pid ?? '')) continue;

    const lsof = run('lsof', ['-nP', '-a', '-p', pid, '-iTCP', '-sTCP:LISTEN', '-Fn']);
    for (const lsofLine of lsof.split('\n')) {
      if (!lsofLine.startsWith('n')) continue;
      const match = /(?:127\.0\.0\.1|\[::1\]):(\d+)$/.exec(lsofLine);
      if (match) return Number(match[1]);
    }
  }
  return null;
}

function normalizeHost(hostname) {
  const host = String(hostname ?? '');
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

/**
 * Resolve the local Web UI origin.
 * Order: configured upstreamPort -> ctx.webServer.getOrigin() -> ps/lsof probe.
 */
export function createUpstreamResolver({ getOrigin = null, pinnedPort = null, logger = () => {} } = {}) {
  let cache = { host: null, port: null, origin: null, at: 0 };
  const ttlMs = 8000;

  function pinned() {
    if (!Number.isInteger(pinnedPort) || pinnedPort < 1) return null;
    return { host: '127.0.0.1', port: pinnedPort, origin: `http://127.0.0.1:${pinnedPort}` };
  }

  function fromOrigin() {
    if (typeof getOrigin !== 'function') return null;
    let raw;
    try {
      raw = getOrigin();
    } catch (error) {
      logger(`webServer.getOrigin() unavailable: ${error.message}`);
      return null;
    }
    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:') {
        logger(`unsupported upstream protocol ${url.protocol} (only http is supported)`);
        return null;
      }
      const port = Number(url.port || '80');
      if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
      return { host: normalizeHost(url.hostname), port, origin: raw.replace(/\/$/, '') };
    } catch (error) {
      logger(`cannot parse webServer origin ${JSON.stringify(raw)}: ${error.message}`);
      return null;
    }
  }

  function probe() {
    const port = discoverUpstreamPort();
    if (!port) return null;
    return { host: '127.0.0.1', port, origin: `http://127.0.0.1:${port}` };
  }

  function resolve() {
    const fixed = pinned();
    if (fixed) return fixed;

    const origin = fromOrigin();
    if (origin) return origin;

    if (cache.port && Date.now() - cache.at < ttlMs) {
      return { host: cache.host, port: cache.port, origin: cache.origin };
    }

    const found = probe();
    if (!found) {
      cache = { host: null, port: null, origin: null, at: 0 };
      return null;
    }
    cache = { ...found, at: Date.now() };
    return found;
  }

  function invalidate() {
    cache = { host: null, port: null, origin: null, at: 0 };
  }

  return { resolve, invalidate };
}
