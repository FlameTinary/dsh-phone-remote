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
  dsh-phone-remote url       Print the LAN URLs (with access key) and Basic credentials
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

if (command === 'url') {
  console.log('Phone URLs (same LAN, contains the access key):');
  for (const url of phoneUrls(config)) console.log(`  ${url}`);
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
  const auth = `Basic ${Buffer.from(`${config.basicUser}:${config.basicPass}`).toString('base64')}`;
  const url = `http://127.0.0.1:${config.listenPort}/__dshgw/status`;
  try {
    const response = await fetch(url, { headers: { authorization: auth } });
    const text = await response.text();
    console.log(text.trim());
    process.exit(response.ok ? 0 : 1);
  } catch (error) {
    console.error(`dsh-phone-remote: gateway is not reachable at ${url} (${error.message})`);
    console.error('Open DeepSeek Harness -> Settings -> Plugins and make sure Phone Remote is enabled.');
    process.exit(1);
  }
}

console.error(`dsh-phone-remote: unknown command ${JSON.stringify(command)}`);
printHelp();
process.exit(1);
