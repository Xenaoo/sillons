'use strict';

// Tests sans serveur ni écriture dans la sauvegarde de jeu.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { PassThrough } = require('node:stream');
const ROOT = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const context = vm.createContext({ Buffer, process, fs, path, crypto, zlib,
  PROJECT_VERSION: 'test', API_JSON_BODY_LIMIT: 32, PUBLIC_DIR: path.join(ROOT, 'public') });
vm.runInContext(source('src/server/parts/01-http-api.js'), context);
const http = vm.runInContext('({ acceptsContentEncoding, compressStaticBody, readBody, parseByteRange, sendJson, staticCacheControl })', context);

test('encodages : q=0 reste interdit même avec un joker', () => {
  assert.equal(http.acceptsContentEncoding({ __sillonsAcceptEncoding: 'br;q=0, gzip, *;q=1' }, 'br'), false);
  assert.equal(http.acceptsContentEncoding({ __sillonsAcceptEncoding: 'gzip; q=0.5' }, 'gzip'), true);
  assert.equal(http.acceptsContentEncoding({ __sillonsAcceptEncoding: '*;q=0' }, 'gzip'), false);
});

test('cache compressé : une modification de même taille reste visible', () => {
  const res = { __sillonsAcceptEncoding: 'gzip' };
  const a = http.compressStaticBody(res, 'test.js', Buffer.from('a'.repeat(1500)));
  const b = http.compressStaticBody(res, 'test.js', Buffer.from('b'.repeat(1500)));
  assert.equal(zlib.gunzipSync(a.body).toString(), 'a'.repeat(1500));
  assert.equal(zlib.gunzipSync(b.body).toString(), 'b'.repeat(1500));
});

test('les scripts sans version ne restent pas figés pendant un an', () => {
  assert.equal(http.staticCacheControl('app.js'), 'no-cache');
  assert.equal(http.staticCacheControl('styles.css'), 'no-cache');
});

test('JSON UTF-8 : caractère accentué coupé entre deux paquets', async () => {
  const req = new PassThrough();
  const result = http.readBody(req);
  const body = Buffer.from('{"name":"é"}');
  const index = body.indexOf(0xc3) + 1;
  req.write(body.subarray(0, index));
  req.end(body.subarray(index));
  assert.equal((await result).name, 'é');
});

test('limite JSON mesurée en octets et refus des requêtes interrompues', async () => {
  const large = new PassThrough();
  const rejected = assert.rejects(http.readBody(large), { statusCode: 413 });
  large.end(Buffer.from('é'.repeat(20)));
  await rejected;
  const aborted = new PassThrough();
  const interrupted = assert.rejects(http.readBody(aborted), { statusCode: 400 });
  aborted.emit('aborted');
  await interrupted;
});

test('plages PMTiles : début, suffixe, fin tronquée et plages invalides', () => {
  for (const [header, expected] of [['bytes=0-9', [0, 9]], ['bytes=-10', [90, 99]], ['bytes=90-200', [90, 99]]]) {
    const range = http.parseByteRange(header, 100);
    assert.deepEqual([range.start, range.end], expected);
  }
  for (const header of ['bytes=100-', 'bytes=10-0', 'bytes=-0', 'bytes=-', 'bytes=0-1,4-5']) {
    assert.equal(http.parseByteRange(header, 100), null);
  }
});

function jsonResponse(encoding, status = 200, payload = { data: 'é'.repeat(10000) }, onFinish = () => {}) {
  return new Promise(resolve => {
    const headers = {};
    const res = {
      __sillonsAcceptEncoding: encoding,
      getHeader: name => headers[name],
      setHeader: (name, value) => { headers[name] = value; },
      writeHead: (code, values) => { Object.assign(headers, values); res.status = code; },
      end: body => { onFinish(); resolve({ headers, body, status: res.status }); }
    };
    http.sendJson(res, status, payload);
  });
}

test('JSON : compression asynchrone et contenu identique en br/gzip/identity', async () => {
  let synchronous = true;
  const pending = jsonResponse('br', 200, undefined, () => assert.equal(synchronous, false));
  synchronous = false;
  for (const result of [await pending, await jsonResponse('gzip'), await jsonResponse('br;q=0,gzip;q=0')]) {
    const encoding = result.headers['Content-Encoding'];
    const raw = encoding === 'br' ? zlib.brotliDecompressSync(result.body)
      : encoding === 'gzip' ? zlib.gunzipSync(result.body) : result.body;
    assert.equal(JSON.parse(raw).data, 'é'.repeat(10000));
    assert.equal(result.headers['Content-Length'], result.body.length);
  }
  const empty = await jsonResponse('gzip', 204, {});
  assert.equal(empty.body, undefined);
  assert.equal(empty.headers['Content-Encoding'], undefined);
});

const stations = [
  { id: 'a', name: 'Paris Est', population: 200, baseDemand: 3, price: 30 },
  { id: 'b', name: 'Paris Nord', population: 100, baseDemand: 2, price: 10 },
  { id: 'c', name: 'Évreux', population: 500, baseDemand: 4, price: 20 }
];
const client = vm.createContext({
  Intl, localStorage: { setItem() {} },
  app: { state: { world: { stations }, me: { epoch: 0, stations: {} } }, fleetCatalogEraCollapsed: {} },
  normalizeStationSearchText: value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
  dedupedStations: list => list,
  sortStationsForPurchase: (list, mode) => [...list].sort((a, b) => mode === 'priceDesc' ? b.price - a.price : a.price - b.price)
});
const routing = source('public/js/10-routing-line-utils.js');
vm.runInContext(routing.slice(routing.indexOf('const stationSearchIndexCache'), routing.indexOf('function stationSearchLabel')), client);
const fleet = source('public/js/05-fleet-compositions.js');
vm.runInContext(fleet.slice(fleet.indexOf('function fleetCatalogEraStorageKey'), fleet.indexOf('function fleetMaintenanceEraStorageKey')), client);
const startup = source('public/js/01-startup-events-auth.js');
vm.runInContext(startup.slice(startup.indexOf('function stablePanelSignature'), startup.indexOf('async function refreshState')), client);

test('recherche : accents, tri choisi et ordre du cache préservé', () => {
  assert.equal(vm.runInContext("findStationMatches('evreux')[0].id", client), 'c');
  assert.equal(vm.runInContext("findStationMatches('paris', 8, 'priceAsc')[0].id", client), 'b');
  assert.equal(vm.runInContext("findStationMatches('paris', 8, 'priceDesc')[0].id", client), 'a');
  vm.runInContext('topStationCandidates()', client);
  assert.deepEqual(stations.map(s => s.id), ['a', 'b', 'c']);
});

test('catalogue : époque zéro ouverte et choix explicite conservé', () => {
  assert.equal(vm.runInContext('isFleetCatalogEraCollapsed(0)', client), false);
  assert.equal(vm.runInContext('isFleetCatalogEraCollapsed(1)', client), true);
  vm.runInContext('setFleetCatalogEraCollapsed(1, false)', client);
  assert.equal(vm.runInContext('isFleetCatalogEraCollapsed(1)', client), false);
});

test('panneaux : les ticks ne reconstruisent pas les cartes, les fins de travaux oui', () => {
  const signature = vm.runInContext('stablePanelSignature', client);
  const state = { me: { epoch: 1, trains: [{ id: 't', condition: .95, construction: { active: true, remainingMs: 2000 } }] } };
  const before = signature(state);
  state.me.trains[0].construction.remainingMs = 1000;
  assert.equal(signature(state), before);
  state.me.trains[0].construction.active = false;
  assert.notEqual(signature(state), before);
  const after = signature(state);
  state.me.techUnlocked = { traction: 1 };
  assert.notEqual(signature(state), after);
});

test('polling : une réponse ancienne ne remplace pas le résultat d’une action', async () => {
  let finishRequest;
  const initial = { world: {}, balance: {} };
  const app = { state: initial, authToken: 'test', pendingActions: new Set() };
  const sandbox = vm.createContext({ app, performance, URLSearchParams, AbortSignal,
    authHeaders: () => ({}), console,
    fetch: () => new Promise(resolve => { finishRequest = resolve; }),
    readJsonResponse: async () => ({ ok: true, me: { cash: 1 } })
  });
  vm.runInContext(startup.slice(startup.indexOf('async function refreshState'), startup.indexOf('function reportClientBootMetrics')), sandbox);
  const pending = vm.runInContext('refreshState(false)', sandbox);
  const actionState = { me: { cash: 2 } };
  app.state = actionState;
  finishRequest({ status: 200 });
  await pending;
  assert.equal(app.state, actionState);
  assert.equal(app.refreshInFlight, false);
});

test('interaction : un événement de focus ne produit pas une durée NaN', () => {
  const sandbox = vm.createContext({ app: {}, performance: { now: () => 100 } });
  vm.runInContext(routing.slice(routing.indexOf('function markUiInteraction'), routing.indexOf('function isInteractiveUiActive')), sandbox);
  vm.runInContext('markUiInteraction({ type: "focusin" })', sandbox);
  assert.equal(vm.runInContext('app.uiInteractionUntil', sandbox), 1900);
});
