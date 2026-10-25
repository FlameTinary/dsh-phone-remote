#!/usr/bin/env node
import {
  loadConfig,
  pathsFor,
  phoneUrls,
  resolveDshHome,
} from '../lib/config.js';

const command = process.argv[2] ?? 'url';

function printHelp() {
  console.log(`dsh-phone-remote

Usage:
  dsh-phone-remote url       Print the LAN URLs (with access key), Cloudflare URL and Basic credentials
  dsh-phone-remote status    Ask the running gateway for /__dshgw/status
  dsh-phone-remote config    Print the config file path
  dsh-phone-remote help      Show this help

The URL command is safe to run before the plugin starts; it may create the
config file on first use.
`);
}

const dshHome = resolveDshHome();
const paths = pathsFor(dshHome);

if (command === 'help' || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

if (command === 'config') {
  console.log(paths.configFile);
  process.exit(0);
}

let loaded;
try {
  loaded = loadConfig(paths);
} catch (error) {
  console.error(`dsh-phone-remote: ${error.message}`);
  process.exit(1);
}

const { config } = loaded;

async function readStatus() {
  const auth = `Basic ${Buffer.from(`${config.basicUser}:${config.basicPass}`).toString('base64')}`;
  const response = await fetch(`http://127.0.0.1:${config.listenPort}/__dshgw/status`, {
    headers: { authorization: auth },
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

if (command === 'url') {
  console.log('Phone URLs (same LAN, contains the access key):');
  for (const url of phoneUrls(config)) console.log(`  ${url}`);
  if (config.cloudflare?.enabled) {
    console.log('');
    if (config.cloudflare.mode === 'token' && config.cloudflare.publicUrl) {
      const cf = new URL(config.cloudflare.publicUrl.trim());
      cf.searchParams.set('k', config.accessKey);
      console.log('Cloudflare URL (configured, contains the access key):');
      console.log(`  ${cf.toString()}`);
    } else if (config.cloudflare.mode === 'quick') {
      try {
        const status = await readStatus();
        const publicUrl = status?.cloudflare?.publicUrl;
        if (publicUrl) {
          const cf = new URL(publicUrl);
          cf.searchParams.set('k', config.accessKey);
          console.log('Cloudflare URL (quick tunnel, contains the access key):');
          console.log(`  ${cf.toString()}`);
        } else {
          console.log('Cloudflare: enabled, but the quick tunnel URL is not ready yet. Run "status" in a moment.');
        }
      } catch {
        console.log('Cloudflare: enabled (quick tunnel). Start the plugin, then run "status" to read the current public URL.');
      }
    } else {
      console.log('Cloudflare: enabled (token mode). Open the public hostname you bound in the Cloudflare dashboard.');
    }
  }
  console.log('');
  console.log(`Basic auth: ${config.basicUser} / ${config.basicPass}`);
  console.log(`Listen:     ${config.listenHost}:${config.listenPort}`);
  console.log(`Config:     ${paths.configFile}`);
  if (config.listenHost === '127.0.0.1' || config.listenHost === '::1') {
    console.log('');
    console.log('Warning: listenHost is loopback-only, so a phone cannot connect.');
  }
  process.exit(0);
}

if (command === 'status') {
  try {
    console.log(JSON.stringify(await readStatus(), null, 2));
    process.exit(0);
  } catch (error) {
    const url = `http://127.0.0.1:${config.listenPort}/__dshgw/status`;
    console.error(`dsh-phone-remote: gateway is not reachable at ${url} (${error.message})`);
    console.error('Open DeepSeek Harness -> Plugins and make sure Phone Remote is enabled.');
    process.exit(1);
  }
}

console.error(`dsh-phone-remote: unknown command ${JSON.stringify(command)}`);
printHelp();
process.exit(1);
