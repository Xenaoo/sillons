'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { PassThrough } = require('node:stream');
const { EventEmitter } = require('node:events');
const { Worker } = require('node:worker_threads');
const { createSaveStore } = require('../src/server/persistence-sqlite');
const ROOT = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const httpContext = vm.createContext({ Buffer, process, fs, path, crypto, zlib,
  mimeType: () => 'application/javascript; charset=utf-8',
  PROJECT_VERSION: 'test', API_JSON_BODY_LIMIT: 100, PUBLIC_DIR: path.join(ROOT, 'public') });
vm.runInContext(source('src/server/parts/01-http-api.js'), httpContext);
const transport = vm.runInContext('({ compressStaticBody, readStaticFile, sendStaticBody, serveStatic, readBody, pipeStaticFile })', httpContext);

test('fichiers statiques : compression asynchrone, dédupliquée et fidèle', async () => {
  const body = Buffer.from('contenu à compresser '.repeat(30000));
  let compressed = false;
  const pending = transport.compressStaticBody({ __sillonsAcceptEncoding: 'br' }, 'async.js', body).then(result => {
    compressed = true;
    return result;
  });
  assert.equal(compressed, false);
  const second = transport.compressStaticBody({ __sillonsAcceptEncoding: 'br' }, 'async.js', body);
  const [a, b] = await Promise.all([pending, second]);
  assert.equal(a.body, b.body);
  assert.deepEqual(zlib.brotliDecompressSync(a.body), body);
});

test('fichiers statiques : cache disque invalidé après modification de même taille', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sillons-static-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'test.js');
  fs.writeFileSync(file, 'avant');
  const before = await transport.readStaticFile(file);
  assert.equal(await transport.readStaticFile(file), before);
  fs.writeFileSync(file, 'après');
  fs.utimesSync(file, new Date(), new Date(Date.now() + 2000));
  assert.equal((await transport.readStaticFile(file)).toString(), 'après');
});

function mockResponse(encoding = '') {
  const result = { headers: {}, __sillonsAcceptEncoding: encoding,
    writeHead(status, headers = {}) { this.status = status; this.headers = headers; },
    end(body) { this.body = body; this.writableEnded = true; } };
  return result;
}

test('HTTP : ETag, revalidation 304, HEAD et client déconnecté', async () => {
  const body = Buffer.from('test '.repeat(1000));
  const first = mockResponse('gzip');
  await transport.sendStaticBody({ method: 'GET', headers: {} }, first, 'test.js', body);
  assert.equal(first.status, 200);
  assert.deepEqual(zlib.gunzipSync(first.body), body);
  const second = mockResponse('br');
  await transport.sendStaticBody({ method: 'GET', headers: { 'if-none-match': `"ancien", ${first.headers.ETag}` } }, second, 'test.js', body);
  assert.equal(second.status, 304);
  assert.equal(second.body, undefined);
  const head = mockResponse('gzip');
  await transport.sendStaticBody({ method: 'HEAD', headers: {} }, head, 'test.js', body);
  assert.equal(head.headers['Content-Length'], first.body.length);
  assert.equal(head.body, undefined);
  const closed = mockResponse('gzip');
  closed.destroyed = true;
  await transport.sendStaticBody({ method: 'GET', headers: {} }, closed, 'test.js', body);
  assert.equal(closed.status, undefined);
});

test('HTTP : méthodes interdites et chemins Windows invalides refusés', async () => {
  const res = mockResponse();
  await transport.serveStatic({ method: 'POST' }, res, new URL('http://local/app.js'));
  assert.equal(res.status, 405);
  for (const pathname of ['/a%00.js', '/a%5Cb.js', '/app.js%3Asecret']) {
    await assert.rejects(transport.serveStatic({ method: 'GET' }, mockResponse(), new URL(`http://local${pathname}`)), { statusCode: 400 });
  }
});

test('JSON : null, tableaux et scalaires refusés avant les mutations', async () => {
  for (const value of ['null', '[]', '42', '"texte"', 'true']) {
    const req = new PassThrough();
    const pending = assert.rejects(transport.readBody(req), { statusCode: 400 });
    req.end(value);
    await pending;
  }
});

test('PMTiles : une erreur de lecture ferme le flux sans erreur non gérée', async () => {
  const res = new PassThrough();
  res.resume();
  const closed = new Promise(resolve => res.once('close', resolve));
  transport.pipeStaticFile({}, res, path.join(os.tmpdir(), `sillons-missing-${crypto.randomUUID()}`));
  // Une destination HTTP possède un gestionnaire d'erreur ; même principe ici.
  res.on('error', () => {});
  await closed;
  assert.equal(res.destroyed, true);
});

function gameContext(extra = {}) {
  const sandbox = vm.createContext({ crypto, Date, console, state: { players: {} }, ...extra });
  for (const file of ['05-public-actions.js', '06-simulation-economy.js', '07-fleet-lines-infra.js', '08-balance-world-utils.js']) {
    vm.runInContext(source(`src/server/parts/${file}`), sandbox);
  }
  return sandbox;
}

test('actions concurrentes : ordre par compagnie, indépendance entre joueurs et reprise après erreur', async () => {
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const sandbox = gameContext({ events, gate });
  vm.runInContext(`applyActionNow = async (id, type) => {
    events.push(id + ':' + type);
    if (type === 'slow') await gate;
    if (type === 'error') throw new Error('test');
    return { ok: true };
  };`, sandbox);
  const slow = sandbox.applyAction('a', 'slow', {});
  const next = sandbox.applyAction('a', 'next', {});
  await sandbox.applyAction('b', 'independent', {});
  assert.deepEqual(events, ['a:slow', 'b:independent']);
  release();
  await Promise.all([slow, next]);
  assert.equal(events.at(-1), 'a:next');
  await assert.rejects(sandbox.applyAction('a', 'error', {}), /test/);
  assert.equal((await sandbox.applyAction('a', 'recovered', {})).ok, true);
  assert.equal(vm.runInContext('playerActionQueues.size', sandbox), 0);
});

test('actions : file bornée, paramètres numériques invalides et prototypes refusés', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const sandbox = gameContext({ gate });
  vm.runInContext('applyActionNow = async () => { await gate; return { ok: true }; };', sandbox);
  const pending = Array.from({ length: 16 }, () => sandbox.applyAction('a', 'test', {}));
  assert.equal((await sandbox.applyAction('a', 'test', {})).ok, false);
  release();
  await Promise.all(pending);
  for (const value of ['NaN', 'Infinity', 'abc', {}, [], null, true, 1e309, '']) {
    assert.equal((await sandbox.applyAction('a', 'takeLoan', { amount: value })).ok, false);
  }
  const real = gameContext({ state: { players: { a: { cash: 100000, debt: 0 } } }, saveState() {} });
  assert.equal((await real.applyAction('a', 'toString', {})).ok, false);
  assert.equal((await real.applyAction('a', 'takeLoan', { amount: 'oops' })).ok, false);
  assert.equal(real.state.players.a.cash, 100000);
  for (const amount of [NaN, Infinity, -10]) assert.equal(real.canPay({ cash: 100 }, amount), false);
  assert.equal(real.canPay({ cash: 100 }, 50), true);
});

test('authentification : scrypt asynchrone compatible avec les comptes existants', async () => {
  const sandbox = vm.createContext({ crypto, Buffer, AUTH_PASSWORD_MIN_LENGTH: 6,
    httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }) });
  vm.runInContext(source('src/server/parts/02-auth-bugs-admin.js'), sandbox);
  const salt = 'salt';
  const expected = crypto.scryptSync('password', salt, 64).toString('hex');
  let complete = false;
  const pending = sandbox.passwordHash('password', salt).then(hash => { complete = true; return hash; });
  assert.equal(complete, false);
  assert.equal(await pending, expected);
  assert.equal(await sandbox.verifyPassword({ passwordSalt: salt, passwordHash: expected }, 'password'), true);
  assert.equal(await sandbox.verifyPassword({ passwordSalt: salt, passwordHash: expected }, 'incorrect'), false);
  assert.equal(sandbox.normalizeUsername('__proto__').ok, false);
  assert.equal(sandbox.normalizeUsername('constructor').ok, false);
  const pendingHashes = Array.from({ length: 4 }, () => sandbox.passwordHash('password', salt));
  await assert.rejects(sandbox.passwordHash('password', salt), { statusCode: 429 });
  await Promise.all(pendingHashes);
});

test('deux créations simultanées ne peuvent pas utiliser le même train', async () => {
  let release;
  const route = new Promise(resolve => { release = resolve; });
  const train = { id: 'train', modelId: 'model' };
  const player = { id: 'a', trains: [train], lines: [], cash: 1000000 };
  const sandbox = gameContext({ state: { players: { a: player } }, route,
    BALANCE: { trains: { model: { name: 'Train' } } }, saveState() {} });
  vm.runInContext(`
    sanitizeStopsPayload = stops => stops; validateLineStops = () => '';
    lineResearchRequirementProblem = () => ''; validateLineStopService = () => '';
    trainUnderConstruction = () => false;
    trainUsedByActiveLine = player => player.lines.some(line => line.active);
    getTrainOperatingProfile = () => ({}); lineServiceCompatibleWithProfile = () => true;
    realRailRouteBetweenStops = () => route; lineStopsOwnershipProblem = () => '';
    lineTicketPriceFromPayload = () => 5; tariffFromTicketPrice = () => 0.1;
    effectiveTrainRange = () => 1000; markTutorialAction = () => {}; notify = () => {};
    lineStopsNames = () => 'A → B';
    createLineInstance = () => ({ id: 'line', active: true });
    ok = () => ({ ok: true });
  `, sandbox);
  const first = sandbox.applyAction('a', 'createLine', { stops: ['a', 'b'], trainId: 'train' });
  const second = sandbox.applyAction('a', 'createLine', { stops: ['a', 'b'], trainId: 'train' });
  release({ ids: ['a', 'b'], distance: 10 });
  const results = await Promise.all([first, second]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(player.lines.length, 1);
  assert.equal(player.cash, 1000000 - 2500 - 10 * 220);
});

test('inscriptions concurrentes : un seul compte et une seule compagnie créés', async () => {
  let created = 0;
  const sandbox = vm.createContext({ crypto, Buffer, Date, state: { players: {}, users: {} }, AUTH_PASSWORD_MIN_LENGTH: 6,
    httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
    claimableStarterPlayer: () => null,
    createPlayer: () => ({ id: `p${++created}` }), saveState() {}, publicState: () => ({ ok: true }) });
  vm.runInContext(source('src/server/parts/02-auth-bugs-admin.js'), sandbox);
  vm.runInContext('claimableStarterPlayer = () => null; issueSession = () => "token"; authPayload = user => ({ playerId: user.playerId });', sandbox);
  const results = await Promise.all(Array.from({ length: 2 }, () => sandbox.registerAccount({ username: 'player', password: 'password' })));
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(created, 1);
});

test('chargement : une erreur SQLite ou JSON ne crée aucune nouvelle partie', () => {
  let writes = 0;
  const sandbox = vm.createContext({ path, fs: { existsSync: () => true, readFileSync: () => '{broken' },
    SAVE_DB_FILE: 'test.sqlite', LEGACY_SAVE_FILE: 'test.json', console });
  vm.runInContext(source('src/server/parts/04-state-world-data.js'), sandbox);
  sandbox.saveStore = { read() { throw new Error('disk error'); }, write() { writes++; } };
  assert.throws(() => sandbox.loadOrCreateState(), /Chargement SQLite impossible/);
  sandbox.saveStore = { read: () => null, write() { writes++; } };
  assert.throws(() => sandbox.loadOrCreateState(), /Migration.*impossible/);
  assert.equal(writes, 0);
});

test('SQLite : sauvegarde relue, annulation atomique après erreur et réouverture', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sillons-save-'));
  const filename = path.join(dir, 'test.sqlite');
  let store = createSaveStore(filename);
  t.after(() => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const state = { version: 190, day: 12, players: {}, users: {}, market: { coal: 1.1 }, events: [], news: [], bugReports: [] };
  store.write(state);
  const invalid = { ...state, day: 13, users: {
    a: { id: 'duplicate', username: 'a', usernameKey: 'a', passwordHash: 'hash', passwordSalt: 'salt' },
    b: { id: 'duplicate', username: 'b', usernameKey: 'b', passwordHash: 'hash', passwordSalt: 'salt' }
  } };
  assert.throws(() => store.write(invalid), /UNIQUE/);
  assert.equal(store.read().day, 12);
  store.close();
  store = createSaveStore(filename);
  assert.equal(store.read().market.coal, 1.1);
  store.write({ ...state, day: 14 });
  assert.equal(store.read().day, 14);
});

test('synchronisation : une ancienne réponse est rejetée, le redémarrage serveur accepté', () => {
  const sandbox = vm.createContext({ app: { state: { serverInstanceId: 'a', snapshotSequence: 5 } } });
  const startup = source('public/js/01-startup-events-auth.js');
  vm.runInContext(startup.slice(startup.indexOf('function isObsoleteStateResponse'), startup.indexOf('async function refreshState')), sandbox);
  assert.equal(sandbox.isObsoleteStateResponse({ serverInstanceId: 'a', snapshotSequence: 4 }), true);
  assert.equal(sandbox.isObsoleteStateResponse({ serverInstanceId: 'a', snapshotSequence: 6 }), false);
  assert.equal(sandbox.isObsoleteStateResponse({ serverInstanceId: 'b', snapshotSequence: 1 }), false);
});

test('client : réponses d’actions inversées et réponse après déconnexion', async () => {
  const requests = [];
  const app = { authToken: 'token', playerId: 'a', pendingActions: new Set(), state: {
    serverInstanceId: 'server', snapshotSequence: 1, world: { revision: 'world' }, balance: {}, me: { cash: 100 }
  } };
  const sandbox = vm.createContext({ app, document: { body: { classList: { add() {}, remove() {} } } },
    window: { matchMedia: () => ({ matches: true }) }, setTimeout() {},
    post: () => new Promise(resolve => requests.push(resolve)), canonicalizeStateStationDisplays() {},
    scheduleStateSnapshot() {}, invalidateMapProjection() {}, ensureSelectedStation() {}, toast() {}, renderAll() {}, renderTutorialOverlay() {} });
  const startup = source('public/js/01-startup-events-auth.js');
  vm.runInContext(startup.slice(startup.indexOf('function isObsoleteStateResponse'), startup.indexOf('async function refreshState')), sandbox);
  const actions = source('public/js/08-actions-modals.js');
  vm.runInContext(actions.slice(actions.indexOf('async function performAction'), actions.indexOf('async function doAction')), sandbox);
  const first = sandbox.performAction('takeLoan', { amount: 50000 });
  const second = sandbox.performAction('takeLoan', { amount: 100000 });
  requests[1]({ ok: true, state: { serverInstanceId: 'server', snapshotSequence: 3, me: { cash: 150100 } } });
  await second;
  requests[0]({ ok: true, state: { serverInstanceId: 'server', snapshotSequence: 2, me: { cash: 50100 } } });
  await first;
  assert.equal(app.state.me.cash, 150100);
  assert.equal(app.state.world.revision, 'world');
  const oldSession = sandbox.performAction('takeLoan', { amount: 50000 });
  app.authToken = 'new-token';
  app.state = { me: { cash: 42 } };
  requests[2]({ ok: true, state: { me: { cash: 200100 } } });
  await oldSession;
  assert.equal(app.state.me.cash, 42);
  assert.equal(app.pendingActions.size, 0);
});

test('administration : une requête invalide ne modifie aucun champ', () => {
  const player = { id: 'a', cash: 100, reputation: 50, name: 'Compagnie' };
  const sandbox = vm.createContext({ state: { players: { a: player } },
    cleanText: value => value, clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    fail: error => ({ ok: false, error }) });
  vm.runInContext(source('src/server/parts/02-auth-bugs-admin.js'), sandbox);
  vm.runInContext('adminFindPlayer = () => state.players.a;', sandbox);
  assert.equal(sandbox.adminUpdatePlayer({ cash: 200, name: 'Autre', reputation: 'NaN' }).ok, false);
  assert.equal(player.cash, 100);
  assert.equal(player.name, 'Compagnie');
  assert.equal(player.reputation, 50);
});

function workerPoolContext(timeout = 1000) {
  const workers = [];
  class FakeWorker extends EventEmitter {
    constructor() { super(); workers.push(this); this.messages = []; }
    postMessage(message) { this.messages.push(message); }
    terminate() { this.terminated = true; return Promise.resolve(); }
  }
  const sandbox = vm.createContext({ Worker: FakeWorker, isMainThread: true, workerData: null,
    __filename: 'test.js', process, setTimeout, clearTimeout, console,
    SNCF_ROUTE_WORKER_POOL_SIZE: 1, SNCF_ROUTE_WORKER_TIMEOUT_MS: timeout,
    httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }) });
  vm.runInContext(source('src/server/parts/03-rfn-routing.js'), sandbox);
  const Pool = vm.runInContext('SncfRouteWorkerPool', sandbox);
  return { sandbox, workers, pool: new Pool(1) };
}

test('workers RFN : après panne, la tâche suivante attend le nouveau worker', async () => {
  const { pool, workers } = workerPoolContext();
  const first = pool.run({ kind: 'first' });
  const rejected = assert.rejects(first, /panne/);
  const second = pool.run({ kind: 'second' });
  workers[0].emit('error', new Error('panne'));
  assert.equal(workers[0].messages.length, 1);
  workers[0].emit('exit', 1);
  assert.equal(workers.length, 2);
  assert.equal(workers[1].messages[0].task.kind, 'second');
  workers[1].emit('message', { id: workers[1].messages[0].id, ok: true, result: { geometry: [] } });
  await rejected;
  assert.ok(await second);
});

test('workers RFN : le délai maximal inclut l’attente en file', async () => {
  const { pool } = workerPoolContext(25);
  // Maintenir la boucle pendant les minuteurs unref du pool.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const results = await Promise.allSettled([pool.run({ kind: 'first' }), pool.run({ kind: 'second' })]);
    assert.ok(results.every(result => result.status === 'rejected' && result.reason.statusCode === 503));
    assert.equal(pool.queue.length, 0);
  } finally { clearTimeout(keepAlive); }
});

test('workers RFN : les demandes identiques partagent un seul calcul', async () => {
  const { sandbox, workers, pool } = workerPoolContext();
  sandbox.testPool = pool;
  vm.runInContext('sncfRouteWorkerPool = testPool;', sandbox);
  const first = sandbox.runSncfRouteWorkerTask({ kind: 'pair', from: 'a', to: 'b' });
  const second = sandbox.runSncfRouteWorkerTask({ kind: 'pair', from: 'a', to: 'b' });
  assert.equal(workers[0].messages.length, 1);
  workers[0].emit('message', { id: workers[0].messages[0].id, ok: true, result: { geometry: [[0, 0], [1, 1]] } });
  assert.equal(await first, await second);
});

test('worker réel : démarrage sans ouvrir la sauvegarde SQLite', { timeout: 10000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sillons-worker-'));
  const db = path.join(dir, 'invalid.sqlite');
  fs.writeFileSync(db, 'base volontairement illisible');
  const before = fs.readFileSync(db);
  const worker = new Worker(path.join(ROOT, 'server.js'), { env: { ...process.env, SILLONS_SAVE_DB_FILE: db } });
  t.after(async () => { await worker.terminate(); fs.rmSync(dir, { recursive: true, force: true }); });
  await new Promise((resolve, reject) => {
    worker.once('error', reject);
    worker.once('exit', code => code === 0 ? resolve() : reject(new Error(`Worker arrêté : ${code}`)));
  });
  assert.deepEqual(fs.readFileSync(db), before);
  assert.deepEqual(fs.readdirSync(dir), ['invalid.sqlite']);
});

test('carte mobile : le canvas suit les dimensions réelles de Leaflet', () => {
  const canvas = { width: 0, height: 0, style: {} };
  const app = { map: { canvas, ctx: { setTransform() {} } } };
  const sandbox = vm.createContext({ app, window: { devicePixelRatio: 2 },
    $: () => ({ getBoundingClientRect: () => ({ width: 359, height: 260 }) }),
    invalidateMapProjection() {}, scheduleLeafletInvalidateSize() {} });
  const map = source('public/js/09-map-rendering.js');
  vm.runInContext(map.slice(map.indexOf('function resizeCanvas'), map.indexOf('function scheduleLeafletInvalidateSize')), sandbox);
  sandbox.resizeCanvas();
  assert.equal(app.map.width, 359);
  assert.equal(app.map.height, 260);
  assert.equal(canvas.width, 718);
  assert.equal(canvas.height, 520);
});

test('carte : fusionner les demandes conserve le redessin complet', () => {
  const frames = [], draws = [];
  const sandbox = vm.createContext({ app: { map: {} }, performance,
    requestAnimationFrame: callback => frames.push(callback), drawMap: options => draws.push(options) });
  const map = source('public/js/09-map-rendering.js');
  vm.runInContext(map.slice(map.indexOf('function requestMapRedraw'), map.indexOf('function isMapRenderReady')), sandbox);
  sandbox.requestMapRedraw({ lite: true });
  sandbox.requestMapRedraw();
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(draws[0].lite, false);
  sandbox.requestMapRedraw({ lite: true });
  frames.shift()();
  assert.equal(draws[1].lite, true);
});
