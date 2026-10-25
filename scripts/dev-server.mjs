#!/usr/bin/env node
/**
 * Run the gateway outside DeepSeek Harness for development and end-to-end tests.
 *
 *   PHONE_REMOTE_PORT=58801 node scripts/dev-server.mjs
 *
 * Upstream discovery falls back to `ps` + `lsof`, so a running Harness desktop
 * app is enough. The port override only affects this process, not config.json.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig, pathsFor, resolveDshHome } from '../lib/config.js';
import { createLogger } from '../lib/log.js';
import { createPhoneGateway } from '../lib/gateway.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dshHome = resolveDshHome();
const paths = pathsFor(dshHome);
const { config } = loadConfig(paths, { log: (message) => console.log(`[dev] ${message}`) });

const portOverride = Number(process.env.PHONE_REMOTE_PORT ?? 58801);
if (Number.isInteger(portOverride) && portOverride >= 1 && portOverride <= 65535) {
  config.listenPort = portOverride;
}
const upstreamOverride = Number(process.env.PHONE_REMOTE_UPSTREAM ?? 0);
if (Number.isInteger(upstreamOverride) && upstreamOverride >= 1) {
  config.upstreamPort = upstreamOverride;
}

const log = createLogger(paths, { maxBytes: config.logMaxBytes });
const gateway = createPhoneGateway({
  config,
  version: '0.2.1-dev',
  configPath: paths.configFile,
  phoneUrlFile: paths.phoneUrlFile,
  uiDir: path.join(root, 'ui'),
  yamlPath: path.join(dshHome, '.credentials.yaml'),
  logger: log,
  getOrigin: () => {
    throw new Error('dev mode: no Harness webServer; falling back to ps/lsof discovery');
  },
});

gateway.start();

async function shutdown(signal) {
  log(`received ${signal}, shutting down`);
  await gateway.stop();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log(`[dev] gateway starting on ${config.listenHost}:${config.listenPort}; config ${paths.configFile}`);
