import { isIP } from 'node:net';

const PROBES = [
  'https://www.cloudflare.com/cdn-cgi/trace',
  'https://ipv4.icanhazip.com',
  'https://ipv6.icanhazip.com',
];

export function normalizeIp(value) {
  let ip = String(value ?? '').trim();
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);
  ip = ip.replace(/^::ffff:/i, '');
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);
  return ip.toLowerCase();
}

function extractIp(text) {
  for (const line of String(text).split(/\r?\n/)) {
    const match = /^ip=(.+)$/i.exec(line.trim());
    if (match) return match[1].trim();
  }
  const first = String(text).trim().split(/\s+/)[0];
  return first || '';
}

/**
 * Resolve the computer's public address(es) so the gateway can tell whether a
 * Cloudflare request is coming from the same network as this machine.
 *
 * The lookup is best-effort and cached: a failed probe never blocks requests,
 * it only disables the automatic LAN redirect until a later probe succeeds.
 */
export function createPublicIpResolver({
  logger = () => {},
  ttlMs = 10 * 60_000,
  timeoutMs = 4_000,
  fetchImpl = globalThis.fetch,
} = {}) {
  const addresses = new Set();
  let fetchedAt = 0;
  let inflight = null;
  let lastError = '';

  async function fetchText(url) {
    if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'user-agent': 'dsh-phone-remote' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  async function refresh() {
    const results = await Promise.allSettled(PROBES.map((url) => fetchText(url)));
    const next = new Set();
    const errors = [];
    for (const result of results) {
      if (result.status === 'rejected') {
        errors.push(result.reason?.message ?? String(result.reason));
        continue;
      }
      const ip = normalizeIp(extractIp(result.value));
      if (isIP(ip)) next.add(ip);
    }
    if (next.size > 0) {
      addresses.clear();
      for (const ip of next) addresses.add(ip);
      fetchedAt = Date.now();
      lastError = '';
    } else {
      lastError = errors[0] ?? 'no public address returned';
    }
    return addresses;
  }

  async function get({ wait = false } = {}) {
    if (Date.now() - fetchedAt < ttlMs) return addresses;
    if (!inflight) {
      inflight = refresh()
        .catch((error) => {
          lastError = error.message;
          return addresses;
        })
        .finally(() => {
          inflight = null;
        });
    }
    if (wait) await inflight;
    else void inflight;
    return addresses;
  }

  function matches(value) {
    const ip = normalizeIp(value);
    return ip.length > 0 && addresses.has(ip);
  }

  return {
    get,
    matches,
    refresh,
    get addresses() {
      return new Set(addresses);
    },
    get lastError() {
      return lastError;
    },
  };
}
