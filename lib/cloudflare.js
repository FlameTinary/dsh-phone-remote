import { spawn } from 'node:child_process';

const QUICK_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi;
const ANSI = /\u001b\[[0-9;]*m/g;
const RESTART_DELAYS = [3_000, 6_000, 12_000, 30_000, 60_000];
const QUICK_URL_TIMEOUT_MS = 25_000;

function stripAnsi(line) {
  return String(line).replace(ANSI, '').trim();
}

function trimSlash(url) {
  return String(url ?? '').trim().replace(/\/+$/, '');
}

/**
 * Own one cloudflared child process. Quick tunnels print an ephemeral
 * trycloudflare.com URL; token tunnels use the hostname configured in the
 * Cloudflare dashboard.
 */
export function createCloudflareTunnel({
  config,
  port,
  logger = () => {},
  onUrlChange = () => {},
  publicIp = null,
}) {
  const settings = config.cloudflare;
  const log = (...args) => logger(...args);
  const enabled = settings?.enabled === true;
  const mode = settings?.mode === 'token' ? 'token' : 'quick';
  const binary = settings?.cloudflaredPath?.trim() || 'cloudflared';

  let child = null;
  let closed = false;
  let restartTimer = null;
  let quickUrl = '';
  let startedAt = null;
  let lastExit = null;
  let error = '';
  let restartCount = 0;
  let restartsInARow = 0;
  let urlTimer = null;
  let fatal = false;

  function targetPort() {
    return typeof port === 'function' ? port() : port;
  }

  function publicUrl() {
    if (mode === 'quick') return quickUrl;
    return trimSlash(settings.publicUrl);
  }

  function status() {
    return {
      enabled,
      mode,
      running: Boolean(child),
      pid: child?.pid ?? null,
      publicUrl: publicUrl(),
      quickUrl,
      error: error || null,
      startedAt,
      restarts: restartCount,
      lastExit,
      autoLanRedirect: settings?.autoLanRedirect === true,
      cloudflaredPath: binary,
      binaryMissing: /not found|ENOENT/i.test(error),
    };
  }

  function emitUrlChange() {
    try {
      onUrlChange(status());
    } catch (failure) {
      log(`url callback failed: ${failure.message}`);
    }
  }

  function handleLine(chunk) {
    const text = stripAnsi(chunk);
    if (!text) return;
    log(text);
    const matches = [...text.matchAll(QUICK_URL)];
    if (matches.length === 0) return;
    const found = matches[matches.length - 1][0];
    if (found === quickUrl) return;
    quickUrl = found;
    error = '';
    if (urlTimer) {
      clearTimeout(urlTimer);
      urlTimer = null;
    }
    log(`quick tunnel URL: ${found}`);
    emitUrlChange();
  }

  function clearRestartTimer() {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function scheduleRestart(reason) {
    if (closed || fatal) return;
    const index = Math.min(restartsInARow, RESTART_DELAYS.length - 1);
    const delay = RESTART_DELAYS[index];
    restartsInARow += 1;
    error = `cloudflared ${reason}; retrying in ${Math.round(delay / 1000)}s`;
    log(error);
    clearRestartTimer();
    restartTimer = setTimeout(() => {
      restartTimer = null;
      restartCount += 1;
      start();
    }, delay);
    restartTimer.unref?.();
  }

  function start() {
    if (closed || !enabled || child) return;

    if (mode === 'token' && !settings.token?.trim()) {
      error = 'Cloudflare token mode needs a tunnel token';
      return;
    }

    error = '';
    fatal = false;
    const platformArgs = mode === 'token'
      ? ['--no-autoupdate', 'tunnel', 'run']
      : ['--no-autoupdate', 'tunnel', '--url', `http://127.0.0.1:${targetPort()}`];
    const env = { ...process.env };
    if (mode === 'token') env.TUNNEL_TOKEN = settings.token;

    log(`starting ${binary} ${platformArgs.join(' ')}`);
    let spawned;
    try {
      spawned = spawn(binary, platformArgs, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (failure) {
      error = failure.message;
      return;
    }
    child = spawned;

    spawned.on('spawn', () => {
      startedAt = Date.now();
      log(`cloudflared started (pid ${spawned.pid})`);
      if (publicIp && typeof publicIp.get === 'function') {
        void publicIp.get().catch(() => {});
      }
      if (mode === 'quick') {
        urlTimer = setTimeout(() => {
          urlTimer = null;
          if (!quickUrl && !closed) {
            error = 'Cloudflare did not return a quick-tunnel URL within 25s';
            log(error);
          }
        }, QUICK_URL_TIMEOUT_MS);
        urlTimer.unref?.();
      }
    });

    spawned.stdout?.on('data', (chunk) => handleLine(chunk));
    spawned.stderr?.on('data', (chunk) => handleLine(chunk));

    spawned.on('error', (failure) => {
      const missing = failure.code === 'ENOENT';
      fatal = missing;
      error = missing
        ? `${binary} not found; install it with "brew install cloudflared" (macOS) or the Cloudflare cloudflared package`
        : failure.message;
      log(`${missing ? 'binary' : 'process'} error: ${error}`);
      if (child === spawned) child = null;
      if (!missing) scheduleRestart('failed to start');
    });

    spawned.on('exit', (code, signal) => {
      lastExit = { code, signal, at: new Date().toISOString() };
      if (child === spawned) child = null;
      if (urlTimer) {
        clearTimeout(urlTimer);
        urlTimer = null;
      }
      if (closed) return;
      if (startedAt && Date.now() - startedAt > 60_000) restartsInARow = 0;
      error = `cloudflared exited (${signal ?? code ?? 'unknown'})`;
      log(error);
      scheduleRestart('exited');
    });
  }

  async function stop() {
    closed = true;
    clearRestartTimer();
    if (urlTimer) {
      clearTimeout(urlTimer);
      urlTimer = null;
    }
    const current = child;
    if (!current) return;
    child = null;
    await new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve();
      };
      current.once('exit', finish);
      try {
        current.kill('SIGTERM');
      } catch {
        finish();
        return;
      }
      setTimeout(() => {
        try {
          current.kill('SIGKILL');
        } catch {
          // Already gone.
        }
        finish();
      }, 3_000).unref?.();
    });
    log('cloudflared stopped');
  }

  return {
    start,
    stop,
    status,
    get running() {
      return Boolean(child);
    },
  };
}
