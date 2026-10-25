import crypto from 'node:crypto';
import fs from 'node:fs';

export const SESSION_COOKIE_PREFIX = 'dsh-auth-';
const SESSION_VERSION = 1;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

/**
 * Mint the same HMAC-signed browser-session cookie the desktop client uses.
 * authority is the upstream Host header, e.g. `127.0.0.1:63611`.
 */
export function mintSessionCookie(authority, secret, now = Date.now()) {
  if (typeof authority !== 'string' || authority.length === 0) throw new Error('authority is required');
  if (!Buffer.isBuffer(secret) || secret.byteLength === 0) throw new Error('secret is required');
  const payload = b64url(JSON.stringify({
    version: SESSION_VERSION,
    authority,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }));
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const name = `${SESSION_COOKIE_PREFIX}${b64url(crypto.createHash('sha256').update(authority).digest())}`;
  return { name, value: `v1.${payload}.${signature}` };
}

function secretFromRecord(record) {
  if (!record || record.kind !== 'grant') return null;
  const raw = record.payload?.secret;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const secret = Buffer.from(raw, 'base64url');
  return secret.byteLength === 32 ? secret : null;
}

/**
 * Resolve the browser-session secret, preferring the live credentials service
 * and falling back to reading ~/.dsh/.credentials.yaml directly.
 */
export function createSecretResolver({ yamlPath, readRecord = null } = {}) {
  if (typeof yamlPath !== 'string' || yamlPath.length === 0) throw new Error('yamlPath is required');
  let cache = { secret: null, mtimeMs: -1 };

  function fromYaml() {
    let stat;
    try {
      stat = fs.statSync(yamlPath);
    } catch (error) {
      throw new Error(`cannot read DSH credentials at ${yamlPath}: ${error.message}`);
    }
    if (cache.secret && cache.mtimeMs === stat.mtimeMs) return cache.secret;

    let text;
    try {
      text = fs.readFileSync(yamlPath, 'utf8');
    } catch (error) {
      throw new Error(`cannot read DSH credentials at ${yamlPath}: ${error.message}`);
    }
    const match = /client-connection\/browser-session:[\s\S]*?secret:\s*([A-Za-z0-9_-]+)/.exec(text);
    if (!match) throw new Error(`browser-session secret not found in ${yamlPath}`);
    const secret = Buffer.from(match[1], 'base64url');
    if (secret.byteLength !== 32) {
      throw new Error(`browser-session secret in ${yamlPath} has unexpected length ${secret.byteLength}`);
    }
    cache = { secret, mtimeMs: stat.mtimeMs };
    return secret;
  }

  async function get() {
    if (typeof readRecord === 'function') {
      try {
        const secret = secretFromRecord(await readRecord());
        if (secret) return secret;
      } catch {
        // Fall through to the YAML file; the service may be absent or mid-reload.
      }
    }
    return fromYaml();
  }

  function invalidate() {
    cache = { secret: null, mtimeMs: -1 };
  }

  return { get, invalidate };
}
