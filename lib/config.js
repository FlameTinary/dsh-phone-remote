import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PLUGIN_NAME = 'dsh-phone-remote';
export const DEFAULT_PORT = 58800;
export const DEFAULT_LISTEN_HOST = '0.0.0.0';
export const DEFAULT_MAX_LOG_BYTES = 1024 * 1024;

/** Resolve the DSH home directory the same way the Harness does. */
export function resolveDshHome(env = process.env) {
  const explicit = env.DSH_HOME?.trim();
  if (explicit) return path.resolve(explicit);
  return path.join(os.homedir(), '.dsh');
}

/** All paths owned by this plugin. */
export function pathsFor(dshHome) {
  const dir = path.join(dshHome, 'phone-remote');
  return {
    dir,
    configFile: path.join(dir, 'config.json'),
    logFile: path.join(dir, 'gateway.log'),
    phoneUrlFile: path.join(dir, 'phone-url.txt'),
    legacyConfigFile: path.join(dshHome, 'remote-gateway', 'config.json'),
  };
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Non-loopback IPv4 addresses, in interface order. */
export function lanAddresses() {
  const result = [];
  for (const [iface, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (addr.address.startsWith('169.254.')) continue;
      result.push({ iface, address: addr.address });
    }
  }
  return result;
}

/** A conservative /24 allowlist derived from the current interfaces. */
export function defaultCidrs() {
  const cidrs = new Set(['127.0.0.1/32']);
  for (const { address } of lanAddresses()) {
    const parts = address.split('.');
    if (parts.length === 4) cidrs.add(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`);
  }
  return [...cidrs];
}

function defaults() {
  return {
    listenHost: DEFAULT_LISTEN_HOST,
    listenPort: DEFAULT_PORT,
    allowCidrs: defaultCidrs(),
    accessKey: randomToken(24),
    basicUser: 'dsh',
    basicPass: randomToken(18),
    upstreamPort: null,
    uiEnhance: { mobileDrawer: true },
    logMaxBytes: DEFAULT_MAX_LOG_BYTES,
  };
}

function normalize(seed) {
  const base = defaults();
  const config = { ...base, ...(seed && typeof seed === 'object' ? seed : {}) };
  config.uiEnhance = {
    ...base.uiEnhance,
    ...(seed?.uiEnhance && typeof seed.uiEnhance === 'object' ? seed.uiEnhance : {}),
  };
  if (!Array.isArray(config.allowCidrs) || config.allowCidrs.length === 0) {
    config.allowCidrs = base.allowCidrs;
  }
  return config;
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

function assert(condition, message) {
  if (!condition) throw new Error(`phone-remote config: ${message}`);
}

function validate(config) {
  assert(typeof config.listenHost === 'string' && config.listenHost.length > 0, 'listenHost must be a non-empty string');
  assert(Number.isInteger(config.listenPort) && config.listenPort >= 1 && config.listenPort <= 65535, 'listenPort must be an integer between 1 and 65535');
  assert(Array.isArray(config.allowCidrs) && config.allowCidrs.length > 0, 'allowCidrs must be a non-empty array');
  for (const cidr of config.allowCidrs) {
    const [base, bitsRaw] = String(cidr).split('/');
    assert(IPV4.test(base ?? ''), `invalid CIDR ${JSON.stringify(cidr)}`);
    const bits = Number(bitsRaw);
    assert(Number.isInteger(bits) && bits >= 0 && bits <= 32, `invalid CIDR ${JSON.stringify(cidr)}`);
  }
  assert(typeof config.accessKey === 'string' && config.accessKey.length >= 16, 'accessKey must be a string with at least 16 characters');
  assert(typeof config.basicUser === 'string' && config.basicUser.length > 0, 'basicUser must be a non-empty string');
  assert(typeof config.basicPass === 'string' && config.basicPass.length >= 8, 'basicPass must be a string with at least 8 characters');
  assert(config.upstreamPort === null || (Number.isInteger(config.upstreamPort) && config.upstreamPort >= 1 && config.upstreamPort <= 65535), 'upstreamPort must be null or a port number');
  assert(typeof config.uiEnhance === 'object' && config.uiEnhance !== null, 'uiEnhance must be an object');
  assert(Number.isInteger(config.logMaxBytes) && config.logMaxBytes >= 100000, 'logMaxBytes must be an integer >= 100000');
}

function writeConfigFile(file, config) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, file);
}

function readJsonIfExists(file, log) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error.code !== 'ENOENT') log(`ignoring unreadable ${file}: ${error.message}`);
    return null;
  }
}

/**
 * Load (and on first run, create or migrate) the plugin config.
 * @returns {{config: object, created: boolean, migrated: boolean}}
 */
export function loadConfig(paths, { log = () => {} } = {}) {
  fs.mkdirSync(paths.dir, { recursive: true, mode: 0o700 });

  let seed = null;
  let created = false;
  let migrated = false;
  let text = null;
  try {
    text = fs.readFileSync(paths.configFile, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (text === null) {
    created = true;
    seed = readJsonIfExists(paths.legacyConfigFile, log);
    if (seed) {
      migrated = true;
      log(`migrating settings from ${paths.legacyConfigFile}`);
    }
  } else {
    try {
      seed = JSON.parse(text);
    } catch (error) {
      throw new Error(`invalid JSON in ${paths.configFile}: ${error.message}`);
    }
  }

  const config = normalize(seed);
  validate(config);
  if (created) {
    writeConfigFile(paths.configFile, config);
    log(`created ${paths.configFile}`);
  }
  return { config, created, migrated };
}


/**
 * Persist a validated patch over the current config. Unknown keys are copied
 * through unchanged so hand-edited settings survive a save from the UI.
 * @returns {object} the normalized, validated next config
 */
export function updateConfig(paths, current, patch) {
  const next = normalize({
    ...current,
    ...patch,
    uiEnhance: {
      ...(current?.uiEnhance ?? {}),
      ...(patch?.uiEnhance ?? {}),
    },
  });
  validate(next);
  writeConfigFile(paths.configFile, next);
  return next;
}

/** URLs a phone on the same LAN can open. The access key is embedded. */
export function phoneUrls(config) {
  const bound = String(config.listenHost ?? '');
  const addresses = bound && bound !== '0.0.0.0' && bound !== '::'
    ? [bound]
    : lanAddresses().map((entry) => entry.address);
  const hosts = [...new Set(addresses)];
  if (hosts.length === 0) hosts.push('127.0.0.1');
  const key = encodeURIComponent(config.accessKey);
  return hosts.map((host) => `http://${host}:${config.listenPort}/?k=${key}`);
}
