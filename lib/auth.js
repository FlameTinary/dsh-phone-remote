import { timingSafeEqual } from 'node:crypto';

export const GATEWAY_COOKIE = 'dsh-gw';

/** Constant-time string comparison; length differences return false. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hasBasicAuth(header, user, pass) {
  if (typeof header !== 'string' || !header.startsWith('Basic ')) return false;
  let decoded;
  try {
    decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const separator = decoded.indexOf(':');
  if (separator < 0) return false;
  return safeEqual(decoded.slice(0, separator), user) && safeEqual(decoded.slice(separator + 1), pass);
}

export function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    out[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
  }
  return out;
}

export function ipv4ToInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value * 256 + octet) >>> 0;
  }
  return value;
}

export function peerIsAllowed(cidrs, remoteAddress) {
  const ip = String(remoteAddress ?? '').replace(/^::ffff:/, '');
  const value = ipv4ToInt(ip);
  if (value === null) return false;
  for (const cidr of cidrs) {
    const [base, bitsRaw] = String(cidr).split('/');
    const baseValue = ipv4ToInt(base);
    const bits = Number(bitsRaw);
    if (baseValue === null || !Number.isInteger(bits) || bits < 0 || bits > 32) continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((value & mask) === (baseValue & mask)) return true;
  }
  return false;
}

export function isDocumentRequest(req) {
  if (req.headers['sec-fetch-dest'] === 'document') return true;
  return /\btext\/html\b/i.test(String(req.headers.accept ?? ''));
}
