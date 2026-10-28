'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

// Copie autonome : toutes les écritures (SQLite, métriques, caches) restent
// dans le dossier temporaire, y compris les fichiers publics de test.
async function startIsolatedServer(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sillons-http-'));
  fs.cpSync(path.join(ROOT, 'src'), path.join(dir, 'src'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'server.js'), path.join(dir, 'server.js'));
  fs.copyFileSync(path.join(ROOT, 'changelog.md'), path.join(dir, 'changelog.md'));
  fs.mkdirSync(path.join(dir, 'data'));
  fs.copyFileSync(path.join(ROOT, 'data/sillons_train_catalog_v1.json'), path.join(dir, 'data/sillons_train_catalog_v1.json'));
  const stations = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/communes-5000-population.json'), 'utf8'));
  stations.updatedAt = Date.now();
  fs.writeFileSync(path.join(dir, 'data/communes-5000-population.json'), JSON.stringify(stations));
  fs.cpSync(path.join(ROOT, 'public'), path.join(dir, 'public'), { recursive: true,
    filter: file => file !== path.join(ROOT, 'public', 'assets') });
  const child = spawn(process.execPath, ['server.js'], { cwd: dir, windowsHide: true,
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', SILLONS_SAVE_DB_FILE: path.join(dir, 'data/test.sqlite'), SILLONS_DYNAMIC_ASSETS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise(resolve => child.once('exit', resolve));
  let logs = '';
  child.stderr.on('data', data => { logs += data.toString(); });
  t.after(async () => {
    if (child.exitCode === null) child.kill();
    await exited;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const baseUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Serveur de test indisponible : ${logs}`)), 15000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error(`Arrêt prématuré : ${logs}`)); });
    child.stdout.on('data', data => {
      logs += data.toString();
      const match = logs.match(/Sillons lancé sur (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  return { baseUrl, logs: () => logs };
}

function request(baseUrl, pathname, { method = 'GET', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(pathname, baseUrl), { method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Délai HTTP dépassé.')));
    req.end(body);
  });
}

test('HTTP réel : chargement, connexion, actions compactes, concurrence et sessions', { timeout: 30000 }, async t => {
  const { baseUrl, logs } = await startIsolatedServer(t);
  const json = async (pathname, payload, token = '') => {
    const response = await request(baseUrl, pathname, { method: payload === undefined ? 'GET' : 'POST',
      body: payload === undefined ? undefined : JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    return { ...response, data: JSON.parse(response.body.toString()) };
  };
  const html = await request(baseUrl, '/');
  assert.equal(html.status, 200);
  const js = await request(baseUrl, '/app.js', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(js.status, 200);
  assert.equal(js.headers['content-encoding'], 'gzip');
  const cached = await request(baseUrl, '/app.js', { headers: { 'If-None-Match': js.headers.etag } });
  assert.equal(cached.status, 304);
  const dynamic = await request(baseUrl, '/app.js');
  assert.match(dynamic.body.toString(), /function bindResearchWorkspace/);
  assert.equal(dynamic.headers['cache-control'], 'no-cache');
  assert.equal((await request(baseUrl, '/_settoken.html')).status, 404);
  assert.equal((await request(baseUrl, '/app.min.js', { method: 'POST' })).status, 405);
  const registration = await json('/api/auth/register', { username: 'audit_player', password: 'password-test', companyName: 'Audit' });
  assert.equal(registration.status, 200);
  const token = registration.data.auth.token;
  const revision = registration.data.state.world.revision;
  assert.equal((await json('/api/state')).status, 401);
  assert.equal((await json('/api/auth/login', { username: 'audit_player', password: 'incorrect' })).status, 401);
  assert.equal((await json('/api/auth/login', { username: 'audit_player', password: 'password-test' })).status, 200);
  const loan = await json('/api/action', { type: 'takeLoan', payload: { amount: 50000 }, worldRevision: revision }, token);
  assert.equal(loan.status, 200);
  assert.equal(loan.data.state.world, undefined);
  assert.equal(loan.data.state.balance, undefined);
  assert.equal(loan.data.cashDelta, 50000);
  const invalid = await json('/api/action', { type: 'takeLoan', payload: { amount: 'NaN' }, worldRevision: revision }, token);
  assert.equal(invalid.status, 400);
  assert.equal(invalid.data.state.me.cash, loan.data.state.me.cash);
  const concurrent = await Promise.all(Array.from({ length: 3 }, () => json('/api/action', { type: 'takeLoan', payload: { amount: 50000 }, worldRevision: revision }, token)));
  assert.ok(concurrent.every(response => response.status === 200));
  assert.ok(concurrent.every(response => response.data.cashDelta === 50000));
  const compact = await json(`/api/state?compact=1&worldRevision=${encodeURIComponent(revision)}`, undefined, token);
  assert.equal(compact.data.state, undefined);
  assert.equal(compact.data.world, undefined);
  assert.equal(compact.data.me.cash, loan.data.state.me.cash + 150000);
  const full = await json('/api/state', undefined, token);
  assert.ok(full.data.world.stations.length > 3000);
  const stale = await json('/api/action', { type: 'markNotificationsRead', payload: {}, worldRevision: 'ancienne' }, token);
  assert.equal(stale.status, 200);
  assert.equal(stale.data.state.world.revision, revision);
  const malformed = await request(baseUrl, '/api/action', { method: 'POST', body: 'null', headers: { 'Content-Type': 'application/json' } });
  assert.equal(malformed.status, 400);
  assert.equal((await json('/api/auth/logout', {}, token)).status, 200);
  assert.equal((await json('/api/state', undefined, token)).status, 401);
  assert.doesNotMatch(logs(), /Erreur HTTP|uncaught|Unhandled/i);
  t.diagnostic(`État complet : ${full.body.length} octets ; compact : ${compact.body.length} octets (${((1 - compact.body.length / full.body.length) * 100).toFixed(2)} % de moins).`);
});
