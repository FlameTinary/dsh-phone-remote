import { fileURLToPath } from 'node:url';

import { loadConfig, pathsFor, resolveDshHome } from './lib/config.js';
import { createLogger } from './lib/log.js';
import { createPhoneGateway } from './lib/gateway.js';

export const name = 'dsh-phone-remote';

/**
 * The gateway mirrors the Harness Web UI, so it needs the webServer service to
 * discover the loopback origin. It never mounts routes on that server.
 */
export const inject = ['webServer'];

const VERSION = '0.1.0';

export function apply(ctx, _config) {
  const dshHome = resolveDshHome();
  const paths = pathsFor(dshHome);

  let loaded;
  try {
    loaded = loadConfig(paths, { log: (...args) => console.log('[dsh-phone-remote]', ...args) });
  } catch (error) {
    console.error(`[dsh-phone-remote] ${error.message}`);
    throw error;
  }

  const { config } = loaded;
  const log = createLogger(paths, { maxBytes: config.logMaxBytes });
  const uiDir = fileURLToPath(new URL('./ui/', import.meta.url));

  const gateway = createPhoneGateway({
    config,
    version: VERSION,
    configPath: paths.configFile,
    phoneUrlFile: paths.phoneUrlFile,
    uiDir,
    yamlPath: `${dshHome}/.credentials.yaml`,
    logger: log,
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

  ctx.effect(() => {
    log(`plugin activated (v${VERSION}, config ${paths.configFile})`);
    gateway.start();
    return () => gateway.stop();
  }, 'dsh-phone-remote');
}
