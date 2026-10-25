#!/usr/bin/env node
/**
 * End-to-end smoke test for a running gateway.
 *
 *   PHONE_REMOTE_PORT=58801 node scripts/verify.mjs
 *
 * Checks: auth fence, access-key redirect, dashboard, drawer assets, HTML
 * injection, /api passthrough fence and WebSocket upgrade.
 */
import http from 'node:http';
import crypto from 'node:crypto';

import { loadConfig, pathsFor, resolveDshHome } from '../lib/config.js';

const dshHome = resolveDshHome();
const paths = pathsFor(dshHome);
const { config } = loadConfig(paths);
const port = Number(process.env.PHONE_REMOTE_PORT ?? config.listenPort);
const base = { host: '127.0.0.1', port };
const key = config.accessKey;
const basic = `Basic ${Buffer.from(`${config.basicUser}:${config.basicPass}`).toString('base64')}`;
const cookie = `dsh-gw=${encodeURIComponent(key)}`;

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

function request({ path = '/', method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ ...base, path, method, headers, timeout: 15000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function upgrade(path, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      ...base,
      path,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13',
        ...headers,
      },
      timeout: 15000,
    });
    req.on('upgrade', (res, socket) => {
      socket.destroy();
      resolve({ status: res.statusCode, headers: res.headers });
    });
    req.on('response', (res) => {
      res.resume();
      resolve({ status: res.statusCode, headers: res.headers, upgraded: false });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

try {
  const unauth = await request({ path: '/' });
  record('unauthenticated page is rejected', unauth.status === 401, `status ${unauth.status}`);

  const statusRes = await request({ path: '/__dshgw/status', headers: { authorization: basic } });
  let status = null;
  try {
    status = JSON.parse(statusRes.body);
  } catch {
    // Reported below.
  }
  record('status endpoint answers', statusRes.status === 200 && status?.ok === true, `status ${statusRes.status}, upstream ${status?.upstream?.origin ?? 'unknown'}`);

  const keyed = await request({ path: `/?k=${encodeURIComponent(key)}` });
  record('access-key login redirects', keyed.status === 303 && String(keyed.headers['set-cookie'] ?? '').includes('dsh-gw='), `status ${keyed.status}`);

  const dashboard = await request({ path: '/__dshgw/', headers: { cookie } });
  record('dashboard renders phone URLs', dashboard.status === 200 && dashboard.body.includes('?k='), `status ${dashboard.status}`);

  const css = await request({ path: '/__dshgw/ui/mobile-drawer.css', headers: { cookie } });
  record('drawer CSS is served', css.status === 200 && css.body.includes('dsh-hamburger'), `status ${css.status}`);

  const page = await request({ path: '/', headers: { cookie } });
  record('HTML page is served', page.status === 200, `status ${page.status}`);
  record('drawer assets are injected', page.body.includes('/__dshgw/ui/mobile-drawer.js'));

  const api = await request({ path: '/api/remote.mux', headers: { cookie } });
  record('API requests reach the upstream (404 fence)', api.status === 404, `status ${api.status}`);

  const ws = await upgrade('/api/remote.mux', { cookie });
  record('WebSocket upgrade reaches the upstream', ws.status === 101, `status ${ws.status}`);
} catch (error) {
  record('gateway is reachable', false, error.message);
  console.error(error);
}

const failed = results.filter((item) => !item.ok);
console.log('');
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
