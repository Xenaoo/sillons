'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const SAVE_FILE = path.join(ROOT, 'data', 'save.json');
const CHANGELOG_FILE = path.join(ROOT, 'changelog.md');
const PROJECT_VERSION = 'v60.49.0';
const STATE_SCHEMA_VERSION = 52;
const COMMUNE_CACHE_FILE = path.join(ROOT, 'data', 'communes-5000-population.json');
const MIN_COMMUNE_POPULATION = 5000;
const COMMUNE_API_URL = 'https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,codeDepartement,population,centre&geometry=centre&format=json';
const COMMUNE_DEPARTMENTS = [
  '01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19',
  '2A','2B',
  '21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39',
  '40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59',
  '60','61','62','63','64','65','66','67','68','69','70','71','72','73','74','75','76','77','78','79',
  '80','81','82','83','84','85','86','87','88','89','90','91','92','93','94','95'
];
const TICK_MS = 2000;
const SAVE_EVERY_TICKS = 15;
const DEFAULT_PASSENGER_TARIFF = 0.08;
const AUTH_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const AUTH_PASSWORD_MIN_LENGTH = 6;
const STARTER_PLAYER_ID = '4c7dfa51-225a-487a-aa42-1b0776c4e1d5';
// Plafond global du billet : volontairement haut pour laisser le joueur arbitrer
// entre revenus et attractivité. À 50 €, les petites lignes deviennent très peu attractives.
const TICKET_PRICE_CAP_ABSOLUTE = 50;
// Départ v49 : aucune ligne, aucun train, aucun salarié. Capital suffisant
// pour un premier achat sérieux, mais insuffisant pour contrôler une métropole.
const STARTING_CASH = 500000;
// Les recherches sont jouées comme illimitées. Cette limite technique évite seulement les valeurs JS absurdes.
const RESEARCH_TECHNICAL_MAX_LEVEL = 1000000;
const COMPANY_LOGOS = ["steam_front", "winged_wheel", "semaphore", "royal_track", "tunnel_arch", "electric_rail", "mountain_rail", "laurel_wheel", "pantograph", "conductor_cap", "grand_station", "freight_wagon", "star_track", "compass_rail", "monogram_rail", "bridge_truss", "boiler_gauge", "gear_wheel", "lantern_wings", "switch_roundel"];
const ECONOMY = Object.freeze({
  passengerDemandMultiplier: 2.85,
  freightDemandMultiplier: 1.8,
  passengerRevenueMultiplier: 1.12,
  freightRevenueMultiplier: 1.22,
  energyCostMultiplier: 0.42,
  maintenanceCostMultiplier: 0.48,
  lineInfrastructureMaintenancePerKm: 0.12,
  staffCostDivisor: 82,
  debtInterestPerTick: 0.00012,
  stationLevelCost: 58,
  stationCommerceCost: 64,
  stationMaintenanceCost: 92,
  stationDepotCost: 150,
  ownedStationIncomeBase: 18,
  ownedStationCommerceIncome: 46,
  idleTrainStorageFactor: 0.000055,
  researchLabBaseCost: 180,
  researchLabEngineerCost: 95
});

const PASSENGER_COMPOSITION_VARIANTS = Object.freeze({
  standard: { id: 'standard', name: 'Standard', shortLabel: 'Standard', description: 'Voiture polyvalente équilibrée pour la majorité des lignes voyageurs.', asset: '/assets/composition/variants/passenger_standard.png', capacityMultiplier: 1, speedMultiplier: 1, energyMultiplier: 1, maintenanceMultiplier: 1, reliabilityDelta: 0, comfortDelta: 0 },
  commuter: { id: 'commuter', name: 'Banlieue dense', shortLabel: 'Banlieue', description: 'Plus de places debout et de portes, idéale pour les lignes tendues du quotidien.', asset: '/assets/composition/variants/passenger_commuter.png', capacityMultiplier: 1.18, speedMultiplier: 1.02, energyMultiplier: 1.04, maintenanceMultiplier: 1.05, reliabilityDelta: -0.008, comfortDelta: -0.1 },
  comfort: { id: 'comfort', name: 'Grand confort', shortLabel: 'Confort', description: 'Moins de sièges mais meilleure image, adaptée aux dessertes premium et longues.', asset: '/assets/composition/variants/passenger_comfort.png', capacityMultiplier: 0.88, speedMultiplier: 0.98, energyMultiplier: 1.05, maintenanceMultiplier: 1.08, reliabilityDelta: 0.008, comfortDelta: 0.14 },
  sleeper: { id: 'sleeper', name: 'Couchettes', shortLabel: 'Couchettes', description: 'Voiture de nuit haut de gamme, capacité réduite mais très confortable.', asset: '/assets/composition/variants/passenger_sleeper.png', capacityMultiplier: 0.68, speedMultiplier: 0.94, energyMultiplier: 1.08, maintenanceMultiplier: 1.14, reliabilityDelta: -0.004, comfortDelta: 0.2 },
  midi_standard: { id: 'midi_standard', name: 'Voiture Midi standard', shortLabel: 'Midi std.', description: 'Voiture métallique moderne pour les premières locomotives électriques. Offre équilibrée et plus fiable.', asset: '/assets/composition/era2/passenger_midi_standard.png', capacityMultiplier: 1.06, speedMultiplier: 1.04, energyMultiplier: 0.98, maintenanceMultiplier: 0.94, reliabilityDelta: 0.018, comfortDelta: 0.04, requiredEpoch: 1, requiredTech: 'diesel_passenger_locomotives', requiredModelEpoch: 1 },
  midi_commuter: { id: 'midi_commuter', name: 'Voiture Midi banlieue', shortLabel: 'Midi banlieue', description: 'Voiture dense à accès rapides, adaptée aux axes électrifiés à forte fréquence.', asset: '/assets/composition/era2/passenger_midi_commuter.png', capacityMultiplier: 1.26, speedMultiplier: 1.05, energyMultiplier: 1.02, maintenanceMultiplier: 0.98, reliabilityDelta: 0.01, comfortDelta: -0.05, requiredEpoch: 1, requiredTech: 'diesel_passenger_locomotives', requiredModelEpoch: 1 },
  midi_express: { id: 'midi_express', name: 'Voiture Midi express', shortLabel: 'Midi express', description: 'Voiture plus confortable et rapide, pensée pour les services régionaux électrifiés de qualité.', asset: '/assets/composition/era2/passenger_midi_express.png', capacityMultiplier: 0.96, speedMultiplier: 1.08, energyMultiplier: 1.0, maintenanceMultiplier: 1.02, reliabilityDelta: 0.02, comfortDelta: 0.12, requiredEpoch: 1, requiredTech: 'diesel_passenger_locomotives', requiredModelEpoch: 1 },
  midi_sleeper: { id: 'midi_sleeper', name: 'Voiture Midi couchettes', shortLabel: 'Midi nuit', description: 'Voiture longue distance nocturne, coûteuse mais très attractive sur les liaisons de nuit.', asset: '/assets/composition/era2/passenger_midi_sleeper.png', capacityMultiplier: 0.72, speedMultiplier: 1.02, energyMultiplier: 1.04, maintenanceMultiplier: 1.10, reliabilityDelta: 0.005, comfortDelta: 0.24, requiredEpoch: 1, requiredTech: 'diesel_passenger_locomotives', requiredModelEpoch: 1 }
});

const FREIGHT_COMPOSITION_VARIANTS = Object.freeze({
  covered: { id: 'covered', name: 'Wagon couvert', shortLabel: 'Couvert', description: 'Marchandises générales et palettes. Référence polyvalente.', cargoType: 'Marchandises générales', asset: '/assets/composition/variants/freight_covered.png', capacityMultiplier: 1, speedMultiplier: 1, energyMultiplier: 1, maintenanceMultiplier: 1, reliabilityDelta: 0, revenueMultiplier: 1 },
  tank: { id: 'tank', name: 'Wagon citerne', shortLabel: 'Citerne', description: 'Liquides, carburants et produits chimiques à forte valeur.', cargoType: 'Liquides / carburants', asset: '/assets/composition/variants/freight_tank.png', capacityMultiplier: 0.92, speedMultiplier: 0.95, energyMultiplier: 1.08, maintenanceMultiplier: 1.09, reliabilityDelta: -0.01, revenueMultiplier: 1.18 },
  hopper: { id: 'hopper', name: 'Trémie vrac', shortLabel: 'Trémie', description: 'Vracs lourds : céréales, minerais, granulats. Très capacitaire.', cargoType: 'Vrac lourd', asset: '/assets/composition/variants/freight_hopper.png', capacityMultiplier: 1.22, speedMultiplier: 0.92, energyMultiplier: 1.11, maintenanceMultiplier: 1.07, reliabilityDelta: -0.016, revenueMultiplier: 0.94 },
  flatbed: { id: 'flatbed', name: 'Plat / ranchers', shortLabel: 'Plat', description: 'Bois, acier, engins et charges longues.', cargoType: 'Charges longues', asset: '/assets/composition/variants/freight_flatbed.png', capacityMultiplier: 0.96, speedMultiplier: 0.98, energyMultiplier: 0.98, maintenanceMultiplier: 0.98, reliabilityDelta: 0.004, revenueMultiplier: 1.04 },
  reefer: { id: 'reefer', name: 'Frigorifique', shortLabel: 'Frigo', description: 'Produits frais à forte valeur, wagon plus coûteux à exploiter.', cargoType: 'Denrées fraîches', asset: '/assets/composition/variants/freight_reefer.png', capacityMultiplier: 0.82, speedMultiplier: 0.96, energyMultiplier: 1.12, maintenanceMultiplier: 1.12, reliabilityDelta: -0.004, revenueMultiplier: 1.25 },
  container: { id: 'container', name: 'Porte-conteneurs', shortLabel: 'Conteneurs', description: 'Flux intermodaux rapides, bien adaptés aux longues distances.', cargoType: 'Intermodal', asset: '/assets/composition/variants/freight_container.png', capacityMultiplier: 1.08, speedMultiplier: 1.02, energyMultiplier: 1.04, maintenanceMultiplier: 1.04, reliabilityDelta: 0.005, revenueMultiplier: 1.12 },
  midi_covered: { id: 'midi_covered', name: 'Couvert Midi métallique', shortLabel: 'Midi couvert', description: 'Wagon couvert renforcé pour marchandises générales sous caténaires pionnières.', cargoType: 'Marchandises générales', asset: '/assets/composition/era2/freight_midi_covered.png', capacityMultiplier: 1.12, speedMultiplier: 1.04, energyMultiplier: 0.98, maintenanceMultiplier: 0.96, reliabilityDelta: 0.014, revenueMultiplier: 1.04, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
  midi_tank: { id: 'midi_tank', name: 'Citerne Midi', shortLabel: 'Midi citerne', description: 'Citerne moderne pour liquides industriels, plus rentable mais plus exigeante.', cargoType: 'Liquides / carburants', asset: '/assets/composition/era2/freight_midi_tank.png', capacityMultiplier: 1.00, speedMultiplier: 1.00, energyMultiplier: 1.04, maintenanceMultiplier: 1.06, reliabilityDelta: 0.002, revenueMultiplier: 1.22, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
  midi_hopper: { id: 'midi_hopper', name: 'Trémie Midi', shortLabel: 'Midi trémie', description: 'Trémie lourde pour minerais et vracs, très capacitaire sur les axes industriels.', cargoType: 'Vrac lourd', asset: '/assets/composition/era2/freight_midi_hopper.png', capacityMultiplier: 1.34, speedMultiplier: 0.96, energyMultiplier: 1.08, maintenanceMultiplier: 1.05, reliabilityDelta: -0.006, revenueMultiplier: 0.98, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
  midi_flatbed: { id: 'midi_flatbed', name: 'Plat Midi ranchers', shortLabel: 'Midi plat', description: 'Wagon plat modernisé pour acier, bois et engins lourds.', cargoType: 'Charges longues', asset: '/assets/composition/era2/freight_midi_flatbed.png', capacityMultiplier: 1.05, speedMultiplier: 1.02, energyMultiplier: 0.98, maintenanceMultiplier: 0.96, reliabilityDelta: 0.012, revenueMultiplier: 1.08, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
  midi_reefer: { id: 'midi_reefer', name: 'Frigorifique Midi', shortLabel: 'Midi frigo', description: 'Fourgon frigorifique électrique, faible tonnage mais forte valeur transportée.', cargoType: 'Denrées fraîches', asset: '/assets/composition/era2/freight_midi_reefer.png', capacityMultiplier: 0.90, speedMultiplier: 1.03, energyMultiplier: 1.10, maintenanceMultiplier: 1.10, reliabilityDelta: 0.004, revenueMultiplier: 1.30, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
  midi_container: { id: 'midi_container', name: 'Porte-caisses Midi', shortLabel: 'Midi caisses', description: 'Précurseur intermodal pour caisses et conteneurs légers, performant sur longues distances.', cargoType: 'Intermodal', asset: '/assets/composition/era2/freight_midi_container.png', capacityMultiplier: 1.18, speedMultiplier: 1.06, energyMultiplier: 1.02, maintenanceMultiplier: 1.02, reliabilityDelta: 0.016, revenueMultiplier: 1.16, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 }
});

function compositionVariantsForMode(mode) {
  const source = mode === 'passenger_loco' ? PASSENGER_COMPOSITION_VARIANTS : mode === 'freight_loco' ? FREIGHT_COMPOSITION_VARIANTS : null;
  if (!source) return [];
  return Object.values(source).map(variant => ({
    id: variant.id,
    name: variant.name,
    shortLabel: variant.shortLabel,
    description: variant.description,
    cargoType: variant.cargoType || null,
    asset: variant.asset,
    stats: {
      capacityMultiplier: variant.capacityMultiplier,
      speedMultiplier: variant.speedMultiplier,
      energyMultiplier: variant.energyMultiplier,
      maintenanceMultiplier: variant.maintenanceMultiplier,
      reliabilityDelta: variant.reliabilityDelta,
      comfortDelta: variant.comfortDelta || 0,
      revenueMultiplier: variant.revenueMultiplier || 1
    },
    requiredEpoch: variant.requiredEpoch || 0,
    requiredTech: variant.requiredTech || null,
    requiredModelEpoch: variant.requiredModelEpoch || 0
  }));
}

function compositionVariantForMode(mode, id) {
  const source = mode === 'passenger_loco' ? PASSENGER_COMPOSITION_VARIANTS : mode === 'freight_loco' ? FREIGHT_COMPOSITION_VARIANTS : null;
  if (!source) return null;
  const first = Object.values(source)[0] || null;
  return source[id] || first;
}

function compositionVariantUnlockedForPlayer(player, model, variant) {
  if (!variant) return false;
  if ((variant.requiredEpoch || 0) > (player?.epoch || 0)) return false;
  if ((variant.requiredModelEpoch || 0) > (model?.unlockEpoch || 0)) return false;
  if (variant.requiredTech && !hasTech(player, variant.requiredTech)) return false;
  return true;
}



const WORLD = buildWorld();
const BALANCE = buildBalance();
let state = loadOrCreateState();
let communeCache = loadCommuneCache();
let tickCount = 0;
let publicWorldCache = { key: '', value: null };
let communeRefreshPromise = null;

async function ensureCommuneCacheReady(force = false) {
  const count = Object.keys(communeCache.byId || {}).length;
  if (!force && count > 0 && communeCache.status !== 'loading') return communeCache;
  if (!communeRefreshPromise) {
    communeRefreshPromise = refreshCommuneCache(force).finally(() => {
      communeRefreshPromise = null;
    });
  }
  return communeRefreshPromise;
}

async function waitForCommuneCache(maxMs = 3500) {
  try {
    await Promise.race([
      ensureCommuneCacheReady(false),
      new Promise(resolve => setTimeout(resolve, maxMs))
    ]);
  } catch (error) {
    console.warn('Chargement communes différé:', error.message);
  }
}

setInterval(() => {
  simulateTick();
  tickCount += 1;
  if (tickCount % SAVE_EVERY_TICKS === 0) saveState();
}, TICK_MS);

process.on('SIGINT', () => {
  saveState();
  process.exit(0);
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { ok: false, error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Sillons lancé sur http://${HOST}:${PORT}`);
  refreshCommuneCache(false).catch(error => console.warn('Chargement des populations communales impossible:', error.message));
});

async function handleApi(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    const body = await readBody(req);
    const result = registerAccount(body);
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readBody(req);
    const result = loginAccount(body);
    sendJson(res, result.ok ? 200 : 401, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const auth = authenticateRequest(req, url, {});
    if (auth) revokeSession(auth.user, auth.token);
    saveState();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const auth = authenticateRequest(req, url, {});
    const playerId = auth?.user?.playerId || '';
    await waitForCommuneCache(3500);
    sendJson(res, 200, publicState(playerId, auth?.user || null));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/changelog') {
    try {
      const changelog = fs.readFileSync(CHANGELOG_FILE, 'utf8');
      sendJson(res, 200, { ok: true, version: PROJECT_VERSION, changelog });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: `Changelog indisponible : ${error.message}` });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/new-player') {
    if (Object.keys(state.users || {}).length) {
      sendJson(res, 401, { ok: false, error: 'Création directe désactivée : Crée un compte ou connecte-toi.' });
      return;
    }
    const body = await readBody(req);
    const player = createPlayer(body);
    sendJson(res, 200, { ok: true, playerId: player.id, state: publicState(player.id, null) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/action') {
    const body = await readBody(req);
    const auth = authenticateRequest(req, url, body);
    if (Object.keys(state.users || {}).length && !auth) {
      sendJson(res, 401, { ok: false, error: 'Connexion requise.' });
      return;
    }
    const playerId = auth?.user?.playerId || body.playerId || '';
    const playerBefore = state.players?.[playerId] || null;
    const cashBefore = Number(playerBefore?.cash);
    const result = applyAction(playerId, body.type, body.payload || {});
    const playerAfter = state.players?.[playerId] || null;
    const cashAfter = Number(playerAfter?.cash);
    const cashDelta = Number.isFinite(cashBefore) && Number.isFinite(cashAfter)
      ? Math.round(cashAfter - cashBefore)
      : 0;
    sendJson(res, result.ok ? 200 : 400, { ...result, cashDelta, state: publicState(playerId, auth?.user || null) });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/communes/search') {
    const q = url.searchParams.get('q') || '';
    await waitForCommuneCache(3500);
    sendJson(res, 200, { ok: true, status: communeCache.status, results: searchCommuneStations(q, 30) });
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Route API inconnue.' });
}

function serveStatic(req, res, url) {
  let filePath;
  try {
    filePath = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  if (filePath === '/') filePath = '/index.html';
  const absolute = path.resolve(PUBLIC_DIR, `.${filePath}`);
  const relative = path.relative(PUBLIC_DIR, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(absolute, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(absolute).toLowerCase();
    const cacheControl = ['.png', '.jpg', '.jpeg', '.webp', '.ico'].includes(ext)
      ? 'public, max-age=604800, immutable'
      : 'no-store';
    res.writeHead(200, { 'Content-Type': mimeType(absolute), 'Cache-Control': cacheControl });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      data += chunk;
      if (data.length > 1_000_000) {
        tooLarge = true;
        reject(httpError(413, 'Payload trop volumineux.'));
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(httpError(400, 'JSON invalide.'));
      }
    });
    req.on('error', reject);
  });
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function normalizeUsername(raw) {
  const username = String(raw || '').trim();
  const key = username.toLowerCase();
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    return { ok: false, error: 'Identifiant invalide : 3 à 32 caractères, lettres, chiffres, point, tiret ou underscore.' };
  }
  return { ok: true, username, key };
}

function passwordError(raw) {
  const password = String(raw || '');
  if (password.length < AUTH_PASSWORD_MIN_LENGTH) return `Mot de passe trop court : ${AUTH_PASSWORD_MIN_LENGTH} caractères minimum.`;
  if (password.length > 160) return 'Mot de passe trop long.';
  return '';
}

function passwordHash(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 64).toString('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function createUserRecord(username, password, playerId) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    id: crypto.randomUUID(),
    username,
    usernameKey: username.toLowerCase(),
    playerId,
    passwordSalt: salt,
    passwordHash: passwordHash(password, salt),
    sessions: {},
    createdAt: Date.now(),
    lastLoginAt: null
  };
}

function normalizeUsers(raw = {}) {
  const out = {};
  const entries = Array.isArray(raw) ? raw.map(u => [u?.usernameKey || u?.username, u]) : Object.entries(raw || {});
  const now = Date.now();
  for (const [, value] of entries) {
    if (!value || typeof value !== 'object') continue;
    const parsed = normalizeUsername(value.username || value.usernameKey || '');
    if (!parsed.ok || !value.passwordHash || !value.passwordSalt || !value.playerId) continue;
    const sessions = {};
    for (const [hash, session] of Object.entries(value.sessions || {})) {
      const expiresAt = Number(session?.expiresAt || 0);
      if (hash && expiresAt > now) sessions[hash] = {
        createdAt: Number(session.createdAt || now),
        lastSeenAt: Number(session.lastSeenAt || now),
        expiresAt
      };
    }
    out[parsed.key] = {
      id: value.id || crypto.randomUUID(),
      username: parsed.username,
      usernameKey: parsed.key,
      playerId: String(value.playerId),
      passwordSalt: String(value.passwordSalt),
      passwordHash: String(value.passwordHash),
      sessions,
      createdAt: Number(value.createdAt || now),
      lastLoginAt: value.lastLoginAt || null
    };
  }
  return out;
}

function verifyPassword(user, password) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const expected = Buffer.from(String(user.passwordHash), 'hex');
  const actual = Buffer.from(passwordHash(password, user.passwordSalt), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function issueSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(token);
  user.sessions = user.sessions && typeof user.sessions === 'object' ? user.sessions : {};
  user.sessions[tokenHash] = {
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    expiresAt: Date.now() + AUTH_SESSION_MAX_AGE_MS
  };
  user.lastLoginAt = Date.now();
  return token;
}

function revokeSession(user, token) {
  if (!user || !token) return;
  const tokenHash = sha256(token);
  if (user.sessions?.[tokenHash]) delete user.sessions[tokenHash];
}

function authTokenFromRequest(req, url, body = {}) {
  const header = String(req.headers.authorization || '');
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1];
  return String(bearer || body.authToken || url.searchParams.get('authToken') || '').trim();
}

function authenticateRequest(req, url, body = {}) {
  const token = authTokenFromRequest(req, url, body);
  if (!token) return null;
  const tokenHash = sha256(token);
  const now = Date.now();
  for (const user of Object.values(state.users || {})) {
    const session = user.sessions?.[tokenHash];
    if (!session) continue;
    if (Number(session.expiresAt || 0) <= now) {
      delete user.sessions[tokenHash];
      return null;
    }
    session.lastSeenAt = now;
    return { user, token, player: state.players?.[user.playerId] || null };
  }
  return null;
}

function authPayload(user, token) {
  return {
    token,
    username: user.username,
    playerId: user.playerId,
    expiresAt: user.sessions?.[sha256(token)]?.expiresAt || null
  };
}


function claimableStarterPlayer() {
  const linked = new Set(Object.values(state.users || {}).map(user => user.playerId).filter(Boolean));
  const preferred = state.players?.[STARTER_PLAYER_ID];
  if (preferred && !linked.has(preferred.id)) return preferred;
  return null;
}

function updateClaimedPlayerIdentity(player, body = {}) {
  if (!player) return null;
  const nextName = cleanText(body.companyName || body.name || player.name || 'Compagnie', 28);
  const nextColor = validateColor(body.color) || player.color || randomColor();
  player.name = nextName;
  player.color = nextColor;
  player.logo = sanitizeCompanyLogo(body.logo || player.logo);
  player.lastSeen = Date.now();
  notify(player, 'Compte joueur créé : Cette compagnie est maintenant liée à ton identifiant.');
  return player;
}

function registerAccount(body = {}) {
  const parsed = normalizeUsername(body.username);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const passError = passwordError(body.password);
  if (passError) return { ok: false, error: passError };
  state.users = normalizeUsers(state.users || {});
  if (state.users[parsed.key]) return { ok: false, error: 'Cet identifiant existe déjà.' };
  const starter = !Object.keys(state.users).length ? claimableStarterPlayer() : null;
  const player = starter
    ? updateClaimedPlayerIdentity(starter, body)
    : createPlayer({
      name: body.companyName || body.name || `Compagnie ${parsed.username}`,
      color: body.color,
      logo: body.logo
    });
  const user = createUserRecord(parsed.username, body.password, player.id);
  const token = issueSession(user);
  state.users[parsed.key] = user;
  saveState();
  return { ok: true, auth: authPayload(user, token), playerId: player.id, state: publicState(player.id, user) };
}

function loginAccount(body = {}) {
  const parsed = normalizeUsername(body.username);
  if (!parsed.ok) return { ok: false, error: 'Identifiant ou mot de passe incorrect.' };
  state.users = normalizeUsers(state.users || {});
  const user = state.users[parsed.key];
  if (!user || !verifyPassword(user, String(body.password || ''))) {
    return { ok: false, error: 'Identifiant ou mot de passe incorrect.' };
  }
  if (!state.players[user.playerId]) {
    const player = createPlayer({ name: body.companyName || `Compagnie ${user.username}` });
    user.playerId = player.id;
  }
  const token = issueSession(user);
  saveState();
  return { ok: true, auth: authPayload(user, token), playerId: user.playerId, state: publicState(user.playerId, user) };
}

function mimeType(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';
}

function loadOrCreateState() {
  if (fs.existsSync(SAVE_FILE)) {
    try {
      const loaded = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
      if (loaded && loaded.players) return migrateState(loaded);
    } catch (error) {
      console.warn('Sauvegarde illisible, nouvelle partie créée.', error.message);
    }
  }
  return createState();
}

function migrateState(loaded) {
  const players = {};
  for (const [id, player] of Object.entries(loaded.players || {})) {
    players[id] = migratePlayer(player, id);
  }
  return {
    version: STATE_SCHEMA_VERSION,
    createdAt: loaded.createdAt || Date.now(),
    now: loaded.now || Date.now(),
    day: Number(loaded.day || 1),
    eraYear: Number(loaded.eraYear || 1850),
    tickSpeed: TICK_MS,
    market: { ...createMarket(), ...(loaded.market || {}) },
    events: Array.isArray(loaded.events) ? loaded.events : [],
    news: Array.isArray(loaded.news) ? loaded.news.slice(0, 50) : [],
    customStations: normalizeCustomStations(loaded.customStations),
    users: normalizeUsers(loaded.users || {}),
    players,
    nextNpcAt: loaded.nextNpcAt || 10
  };
}

function migratePlayer(player, fallbackId) {
  const p = player && typeof player === 'object' ? player : {};
  const techDefaults = { traction: 0, energy: 0, operations: 0, stations: 0, social: 0, freight: 0 };
  const staffDefaults = { drivers: 0, controllers: 0, stationAgents: 0, mechanics: 0, dispatchers: 0, engineers: 0 };
  const statsDefaults = {
    passengers: 0,
    freightTons: 0,
    revenue: 0,
    expenses: 0,
    profit: 0,
    lastRevenue: 0,
    lastExpenses: 0,
    lastProfit: 0,
    punctuality: 90,
    satisfaction: 50,
    marketShare: 0
  };
  p.id = p.id || fallbackId;
  p.name = cleanText(p.name || 'Compagnie', 28);
  p.color = validateColor(p.color) || randomColor();
  p.logo = sanitizeCompanyLogo(p.logo);
  p.cash = Number.isFinite(Number(p.cash)) ? Number(p.cash) : 0;
  p.debt = Number.isFinite(Number(p.debt)) ? Number(p.debt) : 0;
  p.epoch = clamp(Math.floor(Number(p.epoch || 0)), 0, BALANCE.epochs.length - 1);
  p.research = Number.isFinite(Number(p.research)) ? Number(p.research) : 0;
  p.tech = { ...techDefaults, ...(p.tech || {}) };
  p.techUnlocked = normalizeTechUnlocked(p.techUnlocked);
  p.researchProject = normalizeResearchProject(p.researchProject);
  p.researchQueue = normalizeResearchQueue(p.researchQueue);
  p.maintenancePolicy = BALANCE.maintenancePolicies[p.maintenancePolicy] ? p.maintenancePolicy : 'standard';
  p.staff = { ...staffDefaults, ...(p.staff || {}) };
  p.stats = { ...statsDefaults, ...(p.stats || {}) };
  p.trains = Array.isArray(p.trains) ? p.trains.map(t => normalizeTrain(t, p.id)).filter(Boolean) : [];
  p.lines = Array.isArray(p.lines) ? p.lines : [];
  p.stations = p.stations && typeof p.stations === 'object' ? p.stations : {};
  for (const stationId of Object.keys(p.stations)) normalizeStationAsset(p, stationId);
  p.energyStrategy = BALANCE.energyStrategies[p.energyStrategy] ? p.energyStrategy : 'spot';
  p.resources = normalizeResources(p.resources);
  p.notifications = Array.isArray(p.notifications) ? p.notifications : [];
  p.reputation = Number.isFinite(Number(p.reputation)) ? Number(p.reputation) : 50;
  p.co2 = Number.isFinite(Number(p.co2)) ? Number(p.co2) : 0;
  p.region = cleanText(p.region || 'France', 40);
  p.createdAt = p.createdAt || Date.now();
  p.lastSeen = p.lastSeen || Date.now();
  return p;
}

function normalizeTechUnlocked(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, value] of Object.entries(raw)) {
    if (value === true) out[id] = 1;
    else if (value === false || value == null) continue;
    else out[id] = clamp(Math.floor(Number(value) || 0), 0, RESEARCH_TECHNICAL_MAX_LEVEL);
  }
  return out;
}

function normalizeResearchProject(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const node = techNodeById(raw.nodeId);
  const targetLevel = Math.max(1, Math.floor(Number(raw.targetLevel || 1)));
  if (!node || targetLevel < 1 || targetLevel > RESEARCH_TECHNICAL_MAX_LEVEL) return null;
  const durationMs = Math.max(1000, Math.floor(Number(raw.durationMs || (raw.duration ? Number(raw.duration) * 1000 : researchDurationMs(node, targetLevel)))));
  const remainingMs = clamp(Math.ceil(Number(raw.remainingMs ?? (raw.remaining ? Number(raw.remaining) * 1000 : durationMs))), 0, durationMs);
  if (remainingMs <= 0) return null;
  return {
    nodeId: node.id,
    targetLevel,
    remainingMs,
    durationMs,
    costMoney: Math.max(0, Math.round(Number(raw.costMoney || researchCostMoney(node, targetLevel)))),
    operatingCostAccrued: Math.max(0, Math.round(Number(raw.operatingCostAccrued || 0))),
    startedAt: Number(raw.startedAt || Date.now()),
    updatedAt: Number(raw.updatedAt || Date.now())
  };
}

function normalizeResearchQueue(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => {
    if (!item || typeof item !== 'object') return null;
    const node = techNodeById(item.nodeId);
    const targetLevel = Math.max(1, Math.floor(Number(item.targetLevel || 1)));
    if (!node || targetLevel < 1 || targetLevel > RESEARCH_TECHNICAL_MAX_LEVEL) return null;
    const durationMs = Math.max(1000, Math.floor(Number(item.durationMs || researchDurationMs(node, targetLevel))));
    return {
      nodeId: node.id,
      targetLevel,
      durationMs,
      costMoney: Math.max(0, Math.round(Number(item.costMoney || researchCostMoney(node, targetLevel)))),
      queuedAt: Number(item.queuedAt || Date.now())
    };
  }).filter(Boolean).slice(0, 12);
}

function createState() {
  return {
    version: STATE_SCHEMA_VERSION,
    createdAt: Date.now(),
    now: Date.now(),
    day: 1,
    eraYear: 1850,
    tickSpeed: TICK_MS,
    market: createMarket(),
    events: [createEvent('expo', 12)],
    news: [{ day: 1, text: 'Le marché ferroviaire français s’ouvre aux premières compagnies privées.' }],
    customStations: {},
    users: {},
    players: {},
    nextNpcAt: 10
  };
}

function createMarket() {
  return {
    coal: 1.1,
    diesel: 2.35,
    electricity: 0.34,
    hydrogen: 1.9,
    battery: 0.42,
    steel: 1.0,
    labor: 1.0,
    demand: 1.0,
    freight: 1.0
  };
}

function saveState() {
  fs.mkdirSync(path.dirname(SAVE_FILE), { recursive: true });
  fs.writeFileSync(SAVE_FILE, JSON.stringify(state, null, 2));
}


function publicWorld() {
  const customIds = Object.keys(state.customStations || {}).sort().join(',');
  const communeCodes = Object.values(communeCache.byId || {}).map(s => s.code || s.id).sort().join(',');
  const communeCount = Object.keys(communeCache.byId || {}).length;
  const cacheKey = `${communeCache.status}:${communeCache.updatedAt || ''}:${MIN_COMMUNE_POPULATION}:${communeCount}:${communeCodes.length}:${communeCache.error || ''}:${customIds}`;
  if (publicWorldCache.key === cacheKey && publicWorldCache.value) return publicWorldCache.value;

  const customStations = Object.values(state.customStations || {});
  const baseStations = enrichBaseStationsWithPopulation(WORLD.stations);
  const communeStations = Object.values(communeCache.byId || {}).filter(s => !isDuplicatePublicStation(s, baseStations));
  const publicStationsWithoutCustom = [...baseStations, ...communeStations];
  const customFiltered = customStations.filter(s => !isDuplicatePublicStation(s, publicStationsWithoutCustom));
  const stations = [...baseStations, ...communeStations, ...customFiltered];
  const stationIndex = Object.fromEntries(stations.map(s => [s.id, s]));
  const world = {
    ...WORLD,
    stations,
    stationIndex,
    customStations: customFiltered,
    communeStations,
    communesStatus: {
      status: communeCache.status,
      count: communeStations.length,
      minPopulation: MIN_COMMUNE_POPULATION,
      updatedAt: communeCache.updatedAt,
      error: communeCache.error || ''
    },
    regions: [...new Set([...WORLD.regions, 'Arrêts personnalisés'])].sort()
  };
  publicWorldCache = { key: cacheKey, value: world };
  return world;
}

function closestCommuneForStation(station) {
  const communes = Object.values(communeCache.byId || {});
  let best = null;
  for (const commune of communes) {
    if (!Number.isFinite(commune.lat) || !Number.isFinite(commune.lon)) continue;
    const d = haversine(station.lat, station.lon, commune.lat, commune.lon);
    if (d <= 18 && (!best || d < best.distance)) best = { commune, distance: d };
  }
  return best?.commune || null;
}

function enrichBaseStationsWithPopulation(stations) {
  if (!Object.keys(communeCache.byId || {}).length) return stations;
  return stations.map(station => {
    if (Number.isFinite(Number(station.population)) && Number(station.population) > 0) return station;
    const commune = closestCommuneForStation(station);
    if (!commune) return station;
    return {
      ...station,
      population: commune.population,
      baseDemand: passengerDemandFromPopulation(commune.population),
      populationSource: 'geo.api.gouv.fr',
      communeCode: commune.code,
      codesPostaux: commune.codesPostaux || [],
      codeDepartement: commune.codeDepartement || ''
    };
  });
}

function invalidatePublicWorldCache() {
  publicWorldCache = { key: '', value: null };
}

function stationCommuneCode(station) {
  return String(station?.code || station?.communeCode || '').trim();
}

function isDuplicatePublicStation(candidate, existingStations) {
  if (!candidate || !Array.isArray(existingStations)) return false;
  const candidateCode = stationCommuneCode(candidate);
  const cname = stationDedupName(candidate.name);
  for (const s of existingStations) {
    const existingCode = stationCommuneCode(s);
    if (candidateCode && existingCode && candidateCode === existingCode) return true;
    if (candidate.id && s.id && candidate.id === s.id) return true;

    const sname = stationDedupName(s.name);
    const exactSameName = cname && sname && cname === sname;
    const close = Number.isFinite(candidate.lat) && Number.isFinite(candidate.lon) && Number.isFinite(s.lat) && Number.isFinite(s.lon)
      ? haversine(candidate.lat, candidate.lon, s.lat, s.lon) <= 1.25
      : false;
    if (exactSameName && close) return true;
  }
  return false;
}

function stationDedupName(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/gare|station|sncf|saint|sainte|st\.?|ste\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function loadCommuneCache() {
  try {
    if (!fs.existsSync(COMMUNE_CACHE_FILE)) return { status: 'loading', updatedAt: null, byId: {}, error: '' };
    const parsed = JSON.parse(fs.readFileSync(COMMUNE_CACHE_FILE, 'utf8'));
    const byId = {};
    for (const station of parsed.stations || []) {
      const normalized = normalizeCommuneStation(station);
      if (normalized) byId[normalized.id] = normalized;
    }
    return { status: 'ready-cache', updatedAt: parsed.updatedAt || null, byId, error: '' };
  } catch (error) {
    return { status: 'error', updatedAt: null, byId: {}, error: error.message };
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function addCommuneToIndex(byId, commune) {
  const station = communeToStation(commune);
  if (!station) return;
  const key = station.code ? `COM_${String(station.code).replace(/[^A-Za-z0-9]/g, '')}` : station.id;
  if (!byId[key] || Number(station.population || 0) > Number(byId[key].population || 0)) {
    byId[key] = { ...station, id: key };
  }
}

async function fetchCommunesPrimary() {
  const data = await fetchJsonWithTimeout(COMMUNE_API_URL, 90000);
  const byId = {};
  for (const commune of Array.isArray(data) ? data : []) addCommuneToIndex(byId, commune);
  return byId;
}

async function fetchCommunesByDepartments() {
  const byId = {};
  const concurrency = 8;
  for (let i = 0; i < COMMUNE_DEPARTMENTS.length; i += concurrency) {
    const chunk = COMMUNE_DEPARTMENTS.slice(i, i + concurrency);
    const results = await Promise.allSettled(chunk.map(dep => {
      const url = `https://geo.api.gouv.fr/departements/${encodeURIComponent(dep)}/communes?fields=nom,code,codesPostaux,codeDepartement,population,centre&geometry=centre&format=json`;
      return fetchJsonWithTimeout(url, 30000);
    }));
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const commune of Array.isArray(result.value) ? result.value : []) addCommuneToIndex(byId, commune);
    }
  }
  return byId;
}

function applyCriticalCommuneFallbacks(byId) {
  const critical = [
    { code: '91103', nom: 'Brétigny-sur-Orge', population: 26658, centre: { coordinates: [2.3059, 48.6114] }, codesPostaux: ['91220'], codeDepartement: '91' },
    { code: '91021', nom: 'Arpajon', population: 11144, centre: { coordinates: [2.2467, 48.5896] }, codesPostaux: ['91290'], codeDepartement: '91' },
    { code: '91345', nom: 'Longjumeau', population: 21700, centre: { coordinates: [2.2943, 48.6951] }, codesPostaux: ['91160'], codeDepartement: '91' },
    { code: '14258', nom: 'Falaise', population: 8000, centre: { coordinates: [-0.1970, 48.8920] }, codesPostaux: ['14700'], codeDepartement: '14' }
  ];
  for (const commune of critical) addCommuneToIndex(byId, commune);
  return byId;
}

async function refreshCommuneCache(force = false) {
  const ageMs = communeCache.updatedAt ? Date.now() - Number(communeCache.updatedAt) : Infinity;
  if (!force && Object.keys(communeCache.byId || {}).length && ageMs < 7 * 24 * 3600 * 1000) {
    communeCache.status = 'ready-cache';
    return communeCache;
  }

  communeCache.status = 'loading';
  try {
    let byId = {};
    let primaryError = null;

    try {
      byId = await fetchCommunesPrimary();
    } catch (error) {
      primaryError = error;
      console.warn('Source communes principale indisponible:', error.message);
    }

    const primaryCount = Object.keys(byId).length;
    const hasLongjumeau = Object.values(byId).some(s => String(s.code || '') === '91345' || stationDedupName(s.name) === 'longjumeau');
    if (primaryCount < 1500 || !hasLongjumeau) {
      try {
        const byDepartment = await fetchCommunesByDepartments();
        if (Object.keys(byDepartment).length > primaryCount) byId = byDepartment;
        else {
          for (const station of Object.values(byDepartment)) byId[station.id] = station;
        }
      } catch (error) {
        console.warn('Source communes départementale indisponible:', error.message);
        if (primaryError && !primaryCount) throw primaryError;
      }
    }

    byId = applyCriticalCommuneFallbacks(byId);
    communeCache = { status: 'ready-live', updatedAt: Date.now(), byId, error: '' };
    _routeCache.clear();
    invalidatePublicWorldCache();
    fs.mkdirSync(path.dirname(COMMUNE_CACHE_FILE), { recursive: true });
    fs.writeFileSync(COMMUNE_CACHE_FILE, JSON.stringify({
      updatedAt: communeCache.updatedAt,
      minPopulation: MIN_COMMUNE_POPULATION,
      source: 'geo.api.gouv.fr communes + fallback departements',
      stations: Object.values(byId)
    }, null, 2));
    console.log(`Communes jouables chargées: ${Object.keys(byId).length}`);
    return communeCache;
  } catch (error) {
    communeCache.status = Object.keys(communeCache.byId || {}).length ? 'ready-cache-error' : 'error';
    communeCache.error = error.message;
    throw error;
  }
}


function passengerDemandFromPopulation(population) {
  const pop = Math.max(0, Number(population || 0));
  if (!Number.isFinite(pop) || pop <= 0) return 0;
  // Courbe volontairement sous-linéaire : la population reste le facteur principal,
  // sans écraser les différences de tourisme, desserte et époque.
  return Math.round(clamp(35 + Math.pow(pop / 1000, 0.70) * 24, 70, 1600));
}

function effectiveStationPassengerDemand(station) {
  if (!station) return 80;
  const population = Number(station.population || 0);
  if (Number.isFinite(population) && population > 0) return passengerDemandFromPopulation(population);
  const commune = closestCommuneForStation(station);
  if (commune?.population) return passengerDemandFromPopulation(commune.population);
  return clamp(Number(station.baseDemand || 80), 60, 1600);
}

function communeToStation(commune) {
  const population = Number(commune.population || 0);
  if (population < MIN_COMMUNE_POPULATION) return null;
  const coordinates = commune.centre?.coordinates || commune.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isInFranceBounds(lat, lon)) return null;
  return normalizeCommuneStation({
    id: `COM_${String(commune.code || '').replace(/[^A-Za-z0-9]/g, '')}`,
    code: String(commune.code || ''),
    name: commune.nom,
    lat,
    lon,
    population,
    region: 'Ville française',
    codesPostaux: Array.isArray(commune.codesPostaux) ? commune.codesPostaux : [],
    codeDepartement: commune.codeDepartement || '',
    baseDemand: passengerDemandFromPopulation(population),
    freight: Math.round(clamp(Math.sqrt(population) * 0.65, 20, 160)),
    tourism: Math.round(clamp(25 + Math.log10(Math.max(population, MIN_COMMUNE_POPULATION)) * 13, 35, 105)),
    commune: true,
    populationSource: 'geo.api.gouv.fr'
  });
}


function normalizeCommuneStation(station) {
  if (!station || typeof station !== 'object') return null;
  const lat = Number(station.lat);
  const lon = Number(station.lon);
  const population = Number(station.population || 0);
  if (!station.id || population < MIN_COMMUNE_POPULATION || !Number.isFinite(lat) || !Number.isFinite(lon) || !isInFranceBounds(lat, lon)) return null;
  return {
    id: String(station.id),
    code: String(station.code || '').slice(0, 12),
    name: cleanText(station.name || 'Commune', 38),
    lat,
    lon,
    population: Math.round(population),
    region: cleanText(station.region || 'Ville française', 40),
    codesPostaux: Array.isArray(station.codesPostaux) ? station.codesPostaux.slice(0, 8) : [],
    codeDepartement: String(station.codeDepartement || '').slice(0, 4),
    baseDemand: passengerDemandFromPopulation(population),
    freight: clamp(Number(station.freight || Math.sqrt(population) * 0.65), 0, 170),
    tourism: clamp(Number(station.tourism || 35), 0, 120),
    commune: true,
    populationSource: station.populationSource || 'geo.api.gouv.fr'
  };
}


function searchCommuneStations(query, limit = 30) {
  const q = normalizeSearch(query || '');
  const all = Object.values(communeCache.byId || {});
  if (!q) return all.sort((a, b) => (b.population || 0) - (a.population || 0)).slice(0, limit);
  return all
    .map(s => {
      const name = normalizeSearch(s.name);
      const postal = (s.codesPostaux || []).join(' ');
      const starts = name.startsWith(q) ? 1000 : 0;
      const includes = name.includes(q) ? 300 : 0;
      const postalScore = postal.includes(q) ? 400 : 0;
      return { s, score: starts + includes + postalScore + Math.log10((s.population || 5000)) * 10 };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.s);
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeCustomStations(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, station] of Object.entries(raw)) {
    const normalized = normalizeCustomStation(station, id);
    if (normalized) out[normalized.id] = normalized;
  }
  return out;
}

function normalizeCustomStation(station, fallbackId) {
  if (!station || typeof station !== 'object') return null;
  const id = String(station.id || fallbackId || '').slice(0, 40);
  const lat = Number(station.lat);
  const lon = Number(station.lon);
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lon) || !isInFranceBounds(lat, lon)) return null;
  return {
    id,
    name: cleanText(station.name || 'Arrêt personnalisé', 38),
    lat,
    lon,
    region: cleanText(station.region || 'Arrêts personnalisés', 40),
    baseDemand: clamp(Number(station.baseDemand || 95), 30, 420),
    freight: clamp(Number(station.freight || 28), 0, 140),
    tourism: clamp(Number(station.tourism || 40), 0, 110),
    custom: true,
    ownerId: station.ownerId || null,
    createdDay: Number(station.createdDay || state?.day || 1)
  };
}

function isInFranceBounds(lat, lon) {
  return lat >= 41.0 && lat <= 51.5 && lon >= -5.7 && lon <= 10.2;
}

function publicState(playerId, authUser = null) {
  const players = Object.values(state.players).map(p => publicPlayer(p));
  const me = playerId ? players.find(p => p.id === playerId) || null : null;
  return {
    ok: true,
    serverTime: Date.now(),
    auth: authUser ? { username: authUser.username, playerId: authUser.playerId } : null,
    world: publicWorld(),
    balance: BALANCE.public,
    game: {
      day: state.day,
      eraYear: state.eraYear,
      tickMs: TICK_MS,
      market: state.market,
      events: state.events,
      news: state.news.slice(-12).reverse(),
      playerCount: Object.keys(state.players).length
    },
    players,
    me
  };
}

function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    logo: p.logo,
    region: p.region,
    cash: Math.round(p.cash),
    debt: Math.round(p.debt),
    reputation: round2(p.reputation),
    co2: Math.round(p.co2),
    epoch: p.epoch,
    eraName: BALANCE.epochs[p.epoch]?.name || 'Inconnue',
    research: round2(p.research),
    tech: p.tech,
    techUnlocked: p.techUnlocked || {},
    researchProject: publicResearchProject(p),
    researchQueue: publicResearchQueue(p),
    maintenancePolicy: p.maintenancePolicy || 'standard',
    score: Math.round(scorePlayer(p)),
    stats: p.stats,
    trains: p.trains.map(t => publicTrain(t, p)),
    lines: p.lines.map(line => ({ ...normalizeLine(line), staffNeeds: computeLineStaffNeeds(p, line) })),
    stations: p.stations,
    staff: p.staff,
    staffNeeds: computeStaffNeeds(p),
    energyStrategy: p.energyStrategy,
    resources: normalizeResources(p.resources),
    resourceFlow: computePlayerResourceFlow(p),
    notifications: p.notifications.slice(-12).reverse()
  };
}

function publicResearchProject(player) {
  const project = normalizeResearchProject(player.researchProject);
  player.researchProject = project;
  if (!project) return null;
  const node = techNodeById(project.nodeId);
  const workRate = Math.max(0.01, researchWorkRate(player));
  const realRemainingMs = Math.max(0, project.remainingMs / workRate);
  return {
    ...project,
    title: node?.title || project.nodeId,
    branch: node?.branch || '',
    progress: round2((1 - project.remainingMs / Math.max(1, project.durationMs)) * 100),
    remainingMs: project.remainingMs,
    realRemainingMs,
    durationMs: project.durationMs,
    endAt: Date.now() + realRemainingMs,
    workRate
  };
}

function publicResearchQueue(player) {
  player.researchQueue = normalizeResearchQueue(player.researchQueue);
  return player.researchQueue.map(item => {
    const node = techNodeById(item.nodeId);
    return {
      ...item,
      title: node?.title || item.nodeId,
      branch: node?.branch || '',
      durationMs: item.durationMs
    };
  });
}

function createPlayer(input) {
  const id = crypto.randomUUID();
  const name = cleanText(input.name || `Compagnie ${Object.keys(state.players).length + 1}`, 28);
  const color = validateColor(input.color) || randomColor();
  const logo = sanitizeCompanyLogo(input.logo);
  const region = 'France';

  const player = {
    id,
    name,
    color,
    logo,
    region,
    cash: STARTING_CASH,
    debt: 0,
    epoch: 0,
    research: 0,
    tech: {
      traction: 0,
      energy: 0,
      operations: 0,
      stations: 0,
      social: 0,
      freight: 0
    },
    techUnlocked: {},
    researchProject: null,
    researchQueue: [],
    maintenancePolicy: 'standard',
    reputation: 50,
    co2: 0,
    energyStrategy: 'spot',
    resources: normalizeResources(),
    staff: {
      drivers: 0,
      controllers: 0,
      stationAgents: 0,
      mechanics: 0,
      dispatchers: 0,
      engineers: 0
    },
    trains: [],
    lines: [],
    stations: {},
    stats: {
      passengers: 0,
      freightTons: 0,
      revenue: 0,
      expenses: 0,
      profit: 0,
      lastRevenue: 0,
      lastExpenses: 0,
      lastProfit: 0,
      punctuality: 91,
      satisfaction: 55,
      marketShare: 0
    },
    notifications: [{
      day: state.day,
      text: `Compagnie créée avec ${money(STARTING_CASH)}. Achète un premier matériel roulant dans l’onglet Parc, puis ouvre ta première ligne courte ou régionale.`
    }],
    createdAt: Date.now(),
    lastSeen: Date.now()
  };

  state.players[id] = player;
  state.news.push({ day: state.day, text: `${player.name} entre sur le marché ferroviaire.` });
  saveState();
  return player;
}


function applyAction(playerId, type, payload) {
  const player = state.players[playerId];
  if (!player) return { ok: false, error: 'Joueur introuvable.' };
  player.lastSeen = Date.now();

  const handlers = {
    buyTrain: () => actionBuyTrain(player, payload),
    sellTrain: () => actionSellTrain(player, payload),
    repairTrain: () => actionRepairTrain(player, payload),
    updateTrainComposition: () => actionUpdateTrainComposition(player, payload),
    setMaintenancePolicy: () => actionSetMaintenancePolicy(player, payload),
    createLine: () => actionCreateLine(player, payload),
    closeLine: () => actionCloseLine(player, payload),
    updateLine: () => actionUpdateLine(player, payload),
    upgradeStation: () => actionUpgradeStation(player, payload),
    createCustomStation: () => actionCreateCustomStation(player, payload),
    hireStaff: () => actionHireStaff(player, payload),
    fireStaff: () => actionFireStaff(player, payload),
    research: () => actionResearch(player, payload),
    cancelResearch: () => actionCancelResearch(player, payload),
    energyStrategy: () => actionEnergyStrategy(player, payload),
    buyResource: () => actionBuyResource(player, payload),
    setElectricityOrder: () => actionSetElectricityOrder(player, payload),
    takeLoan: () => actionTakeLoan(player, payload),
    repayLoan: () => actionRepayLoan(player, payload),
    rename: () => actionRename(player, payload),
    resetCompany: () => actionResetCompany(player, payload)
  };

  const handler = handlers[type];
  if (!handler) return { ok: false, error: 'Action inconnue.' };
  const result = handler();
  if (result.ok) saveState();
  return result;
}

function actionBuyTrain(player, payload) {
  const model = BALANCE.trains[payload.modelId];
  if (!model) return fail('Modèle inconnu.');
  if (model.unlockEpoch > player.epoch) return fail('Ce matériel n’est pas encore débloqué.', `Il sera accessible à partir de l’époque : ${BALANCE.epochs[model.unlockEpoch]?.name || model.unlockEpoch + 1}.`);
  const requiredTechLevel = Math.max(1, Math.floor(Number(model.requiredTechLevel || 1)));
  if (model.requiredTech && !hasTech(player, model.requiredTech, requiredTechLevel)) {
    const tech = techNodeById(model.requiredTech);
    return fail('Recherche requise avant achat.', `Débloque d’abord : ${tech?.title || model.requiredTech} niveau ${requiredTechLevel}.`);
  }
  const multiplier = currentPriceMultiplier(player, model.energyType);
  const price = Math.round(model.price * multiplier);
  if (!canPay(player, price)) return fail(`Trésorerie insuffisante. Prix: ${money(price)}.`);
  player.cash -= price;
  const train = createTrainInstance(payload.modelId, player.id);
  player.trains.push(train);
  notify(player, `Achat confirmé : ${model.name} pour ${money(price)}.`);
  return ok();
}

function actionSellTrain(player, payload) {
  const train = player.trains.find(t => t.id === payload.trainId);
  if (!train) return fail('Train introuvable.');
  if (train.maintenance?.active) return fail('Ce train est en maintenance.', 'Attends la fin de l’intervention avant de le vendre.');
  const used = player.lines.some(l => l.trainId === train.id && l.active);
  if (used) return fail('Ce train est affecté à une ligne active. Fermez ou modifiez la ligne avant de le vendre.');
  const model = BALANCE.trains[train.modelId];
  const value = Math.max(5000, Math.round(model.price * (0.45 - Math.min(0.3, train.age / 1000)) * train.condition));
  player.cash += value;
  player.trains = player.trains.filter(t => t.id !== train.id);
  notify(player, `${model.name} vendu pour ${money(value)}.`);
  return ok();
}



function actionUpdateTrainComposition(player, payload) {
  const train = player.trains.find(t => t.id === payload.trainId);
  if (!train) return fail('Train introuvable.');
  if (train.maintenance?.active) return fail('Composition indisponible.', 'Le train est actuellement en maintenance.');
  const model = BALANCE.trains[train.modelId];
  if (!model) return fail('Modèle introuvable.');
  const current = ensureTrainComposition(train, model);
  const requestedMode = payload.mode || current.mode;
  const spec = compositionSpecForModel(model, requestedMode);
  const updated = { ...current, mode: spec.mode };

  if (spec.mode === 'multiple_unit') {
    updated.powerUnits = clamp(Math.round(Number(payload.powerUnits ?? current.powerUnits)), spec.powerUnits.min, spec.powerUnits.max);
  } else if (spec.mode === 'passenger_loco') {
    updated.passengerCars = clamp(Math.round(Number(payload.passengerCars ?? current.passengerCars)), spec.passengerCars.min, spec.passengerCars.max);
    const variant = compositionVariantForMode('passenger_loco', payload.passengerVariant ?? current.passengerVariant);
    if (!compositionVariantUnlockedForPlayer(player, model, variant)) {
      const tech = variant?.requiredTech ? techNodeById(variant.requiredTech) : null;
      return fail('Variante non débloquée.', tech ? `Recherche requise : ${tech.title}.` : 'Cette variante demande une époque plus avancée.');
    }
    updated.passengerVariant = variant?.id || current.passengerVariant;
  } else {
    updated.freightCars = clamp(Math.round(Number(payload.freightCars ?? current.freightCars)), spec.freightCars.min, spec.freightCars.max);
    const variant = compositionVariantForMode('freight_loco', payload.freightVariant ?? current.freightVariant);
    if (!compositionVariantUnlockedForPlayer(player, model, variant)) {
      const tech = variant?.requiredTech ? techNodeById(variant.requiredTech) : null;
      return fail('Variante non débloquée.', tech ? `Recherche requise : ${tech.title}.` : 'Cette variante demande une époque plus avancée.');
    }
    updated.freightVariant = variant?.id || current.freightVariant;
  }

  const before = getTrainOperatingProfile({ ...train, composition: current }, model);
  train.composition = { ...current, ...updated, mode: spec.mode };
  const after = getTrainOperatingProfile(train, model);
  refreshPlayerLineStatsNow(player);
  notify(player, `Composition mise à jour pour ${model.name} : ${after.compositionSummary}.`);
  return ok(`Composition mise à jour (${before.compositionSummary} → ${after.compositionSummary}).`);
}

function ticketPriceCeiling(distance) {
  const km = Math.max(1, Number(distance || 0));
  // Plafond progressif : les petites lignes restent cohérentes,
  // les longues lignes peuvent monter jusqu'au plafond absolu de 50 €.
  return Math.round(Math.min(TICKET_PRICE_CAP_ABSOLUTE, Math.max(8, 6 + km * 0.32)));
}

function clampTicketPrice(price, distance) {
  const value = Number(price);
  const fallback = Math.max(1, Math.round(Math.max(1, Number(distance || 0)) * DEFAULT_PASSENGER_TARIFF));
  const normalized = Number.isFinite(value) ? Math.max(0, value) : fallback;
  return Math.min(ticketPriceCeiling(distance), Math.round(normalized));
}

function tariffFromTicketPrice(price, distance) {
  const routeDistance = Math.max(1, Number(distance || 0));
  return clampTicketPrice(price, routeDistance) / routeDistance;
}

function lineTariffFromPayload(payload, distance) {
  const routeDistance = Math.max(1, Number(distance || 0));
  if (payload.ticketPrice !== undefined) {
    return tariffFromTicketPrice(payload.ticketPrice, routeDistance);
  }
  const tariff = Number(payload.tariff);
  if (Number.isFinite(tariff)) {
    return tariffFromTicketPrice(Math.max(0, tariff) * routeDistance, routeDistance);
  }
  return tariffFromTicketPrice(routeDistance * DEFAULT_PASSENGER_TARIFF, routeDistance);
}

function lineTicketPriceFromPayload(payload, distance, fallbackLine = null) {
  const routeDistance = Math.max(1, Number(distance || 0));
  if (payload?.ticketPrice !== undefined) {
    return clampTicketPrice(payload.ticketPrice, routeDistance);
  }
  if (payload?.tariff !== undefined) {
    const tariff = Number(payload.tariff);
    if (Number.isFinite(tariff)) return clampTicketPrice(Math.max(0, tariff) * routeDistance, routeDistance);
  }
  if (fallbackLine) return lineTicketPrice(fallbackLine, routeDistance);
  return clampTicketPrice(routeDistance * DEFAULT_PASSENGER_TARIFF, routeDistance);
}

function setLineTicketPrice(line, ticketPrice, distance = lineDistance(line)) {
  const routeDistance = Math.max(1, Number(distance || 0));
  const price = clampTicketPrice(ticketPrice, routeDistance);
  line.ticketPrice = price;
  line.tariff = tariffFromTicketPrice(price, routeDistance);
  return price;
}

function lineTicketPrice(line, distance = lineDistance(line)) {
  const routeDistance = Math.max(1, Number(distance || 0));
  const storedPrice = Number(line?.ticketPrice);
  if (Number.isFinite(storedPrice)) return clampTicketPrice(storedPrice, routeDistance);
  const tariff = Number(line?.tariff);
  if (Number.isFinite(tariff)) return clampTicketPrice(Math.max(0, tariff) * routeDistance, routeDistance);
  return clampTicketPrice(routeDistance * DEFAULT_PASSENGER_TARIFF, routeDistance);
}

function lineEffectiveTariff(line, distance = lineDistance(line)) {
  const routeDistance = Math.max(1, Number(distance || 0));
  return lineTicketPrice(line, routeDistance) / routeDistance;
}

function actionCreateLine(player, payload) {
  const rawStops = sanitizeStopsPayload(payload.stops, payload.from, payload.to);
  const stops = payload.preserveOrder ? rawStops : coherentStopOrder(rawStops);
  const trainId = String(payload.trainId || '');
  const service = ['passengers', 'freight', 'mixed'].includes(payload.service) ? payload.service : 'passengers';
  const frequency = clamp(Number(payload.frequency || 2), 1, 20);

  const invalidReason = validateLineStops(stops);
  if (invalidReason) return fail(invalidReason);
  const train = player.trains.find(t => t.id === trainId);
  if (!train) return fail('Train introuvable.');
  if (train.maintenance?.active) return fail('Ce train est indisponible.', `Maintenance en cours : ${formatCycles(train.maintenance.daysLeft)} restant(s).`);
  if (player.lines.some(l => l.trainId === trainId && l.active)) return fail('Ce train est déjà affecté à une ligne active.');
  const model = BALANCE.trains[train.modelId];
  const operatingModel = getTrainOperatingProfile(train, model, player);
  if (service === 'freight' && operatingModel.freight <= 0) return fail('Ce train ne peut pas transporter de fret.');

  const routeInfo = routeBetweenStops(stops);
  if (!routeInfo.ids.length || routeInfo.distance <= 0) {
    return fail('Aucun itinéraire ferroviaire connu entre ces arrêts.', 'Choisis des gares reliées au réseau, ou ajoute une liaison dans buildRailGraph() côté serveur.');
  }
  const ownershipProblem = lineStopsOwnershipProblem(stops);
  if (ownershipProblem) return fail(ownershipProblem, 'Seuls les arrêts explicitement desservis doivent appartenir à une compagnie.');
  const ticketPrice = lineTicketPriceFromPayload(payload, routeInfo.distance);
  const tariff = tariffFromTicketPrice(ticketPrice, routeInfo.distance);
  const effectiveRange = effectiveTrainRange(player, operatingModel, routeInfo);
  if (routeInfo.distance > effectiveRange) {
    const routeText = routeInfo.ids.map(id => stationById(id)?.name || id).join(' → ');
    return fail(
      `Portée insuffisante pour ${model.name}. Distance de ligne : ${Math.round(routeInfo.distance)} km. Portée actuelle : ${Math.round(effectiveRange)} km.`,
      `Choisis une ligne plus courte, achète un matériel avec plus de portée, ou développe les recherches de la même ère. Itinéraire calculé : ${routeText}.`
    );
  }

  const setupCost = Math.round(2500 + routeInfo.distance * 220 + Math.max(0, stops.length - 2) * 1400 + (service !== 'passengers' ? routeInfo.distance * 100 : 0));
  if (!canPay(player, setupCost)) return fail(`Trésorerie insuffisante. Coût de lancement: ${money(setupCost)}.`);

  player.cash -= setupCost;
  const line = createLineInstance(player, stops, trainId, service, frequency, ticketPrice);
  player.lines.push(line);
  notify(player, `Nouvelle ligne ouverte : ${lineStopsNames(stops)}.`);
  return ok();
}

function actionCloseLine(player, payload) {
  const line = player.lines.find(l => l.id === payload.lineId);
  if (!line) return fail('Ligne introuvable.');
  line.active = false;
  notify(player, `${lineRouteName(lineStops(line))} fermée.`);
  return ok();
}

function refreshPlayerLineStatsNow(player) {
  try {
    const lineMarkets = buildLineMarkets();
    simulatePlayer(player, lineMarkets, null, { dryRun: true });
  } catch (error) {
    console.warn('Recalcul immédiat des lignes impossible:', error.message);
  }
}


function actionUpdateLine(player, payload) {
  const line = player.lines.find(l => l.id === payload.lineId);
  if (!line) return fail('Ligne introuvable.');
  let changedOperationalData = false;

  if (Array.isArray(payload.stops)) {
    const rawStops = sanitizeStopsPayload(payload.stops, null, null);
    const stops = payload.preserveOrder ? rawStops : coherentStopOrder(rawStops);
    const invalidReason = validateLineStops(stops);
    if (invalidReason) return fail(invalidReason);
    const routeInfo = routeBetweenStops(stops);
    if (!routeInfo.ids.length || routeInfo.distance <= 0) return fail('Impossible de calculer un itinéraire pour cette nouvelle suite d’arrêts.');
    const ownershipProblem = lineStopsOwnershipProblem(stops);
    if (ownershipProblem) return fail(ownershipProblem, 'Seuls les arrêts explicitement desservis doivent appartenir à une compagnie.');
    const train = player.trains.find(t => t.id === (payload.trainId || line.trainId));
    const model = train ? BALANCE.trains[train.modelId] : null;
    const operatingModel = train && model ? getTrainOperatingProfile(train, model, player) : null;
    if (train && operatingModel) {
      const effectiveRange = effectiveTrainRange(player, operatingModel, routeInfo);
      if (routeInfo.distance > effectiveRange) {
        return fail(
          `Modification impossible : ${model.name} ne couvre pas la distance de ligne (${Math.round(routeInfo.distance)} km).`,
          `Portée actuelle : ${Math.round(effectiveRange)} km. Réduis la distance, change de matériel ou développe les recherches de la même ère.`
        );
      }
    }
    const preservedTicketPrice = lineTicketPrice(line, lineDistance(line));
    line.stops = [...stops];
    normalizeLine(line);
    if (payload.ticketPrice === undefined && payload.tariff === undefined) setLineTicketPrice(line, preservedTicketPrice, lineDistance(line));
    changedOperationalData = true;
  }

  if (payload.frequency !== undefined) {
    line.frequency = clamp(Number(payload.frequency), 1, 20);
    changedOperationalData = true;
  }
  if (payload.ticketPrice !== undefined || payload.tariff !== undefined) {
    setLineTicketPrice(line, lineTicketPriceFromPayload(payload, lineDistance(line), line), lineDistance(line));
    changedOperationalData = true;
  }
  if (payload.trainId) {
    const train = player.trains.find(t => t.id === payload.trainId);
    if (!train) return fail('Train introuvable.');
    if (train.maintenance?.active) return fail('Ce train est en maintenance.', `Il sera disponible dans ${formatCycles(train.maintenance.daysLeft)}.`);
    if (player.lines.some(l => l.id !== line.id && l.trainId === train.id && l.active)) return fail('Ce train est déjà utilisé ailleurs.');
    const model = BALANCE.trains[train.modelId];
    const operatingModel = getTrainOperatingProfile(train, model, player);
    const routeInfo = routeBetweenStops(lineStops(line));
    const effectiveRange = effectiveTrainRange(player, operatingModel, routeInfo);
    if (routeInfo.distance > effectiveRange) {
      return fail(
        `Changement impossible : ${model.name} ne couvre pas la distance de ligne (${Math.round(routeInfo.distance)} km).`,
        `Portée actuelle : ${Math.round(effectiveRange)} km. Réduis la distance, change de matériel ou développe les recherches de la même ère.`
      );
    }
    if (line.service === 'freight' && operatingModel.freight <= 0) return fail('Ce train ne peut pas assurer un service fret.');
    line.trainId = train.id;
    changedOperationalData = true;
  }
  if (payload.electrify) {
    const distance = lineDistance(line);
    const techDiscount = (1 - Math.min(0.2, player.tech.energy * 0.03)) * (hasTech(player, 'electric_substations') ? 0.92 : 1);
    const cost = Math.round(distance * 125000 * techDiscount);
    if (line.electrified) return fail('Ligne déjà électrifiée.');
    if (!canPay(player, cost)) return fail(`Électrification impossible : ${money(cost)} requis.`);
    player.cash -= cost;
    line.electrified = true;
    for (const stopId of lineStops(line)) {
      if (player.stations?.[stopId]) normalizeStationAsset(player, stopId).electrified = true;
    }
    changedOperationalData = true;
    notify(player, `Électrification terminée sur ${lineRouteName(lineStops(line))} pour ${money(cost)}.`);
  }
  if (changedOperationalData) refreshPlayerLineStatsNow(player);
  return ok(`Ligne modifiée. Billet moyen : ${money(lineTicketPrice(line))}.`);
}

function actionUpgradeStation(player, payload) {
  const stationId = String(payload.stationId || '');
  const kind = String(payload.kind || 'level');
  const station = stationById(stationId);
  if (!station) return fail('Gare introuvable.');
  if (!['level', 'commerce', 'maintenance', 'depot'].includes(kind)) return fail('Amélioration inconnue.');

  const currentOwner = stationOwnerInfo(stationId);
  if (currentOwner && currentOwner.player.id !== player.id) {
    return fail(`${station.name} appartient déjà à ${currentOwner.player.name}.`, 'Choisis une ville non possédée ou développe tes propres gares.');
  }

  const wasUnowned = !currentOwner;
  if (wasUnowned && kind !== 'level') {
    return fail('Achat requis.', `Achète d’abord ${station.name} avant de construire des commerces, ateliers ou dépôts.`);
  }

  const asset = ensureStationAsset(player, stationId);
  const maxed =
    !wasUnowned && (
      (kind === 'level' && asset.level >= 5) ||
      (kind === 'commerce' && asset.commerce >= 4) ||
      (kind === 'maintenance' && asset.maintenance >= 4) ||
      (kind === 'depot' && asset.depot)
    );
  if (maxed) return fail('Cette amélioration est déjà au maximum.');

  const cost = wasUnowned ? stationAcquisitionCost(station) : stationUpgradeCost(station, asset, kind);
  if (!Number.isFinite(cost) || cost <= 0) return fail('Coût d’amélioration invalide.');
  if (!canPay(player, cost)) return fail(`Trésorerie insuffisante. Coût: ${money(cost)}.`);

  player.cash -= cost;
  if (wasUnowned) {
    notify(player, `${station.name} acquise pour ${money(cost)} : Les autres compagnies devront payer des droits de passage pour l’utiliser.`);
    return ok('Ville achetée.');
  }

  if (kind === 'level') {
    asset.level += 1;
    notify(player, `${station.name} améliorée au niveau ${asset.level} pour ${money(cost)}.`);
  } else if (kind === 'commerce') {
    asset.commerce += 1;
    notify(player, `Commerces développés à ${station.name} pour ${money(cost)}.`);
  } else if (kind === 'maintenance') {
    asset.maintenance += 1;
    notify(player, `Atelier renforcé à ${station.name} pour ${money(cost)}.`);
  } else if (kind === 'depot') {
    asset.depot = true;
    notify(player, `Dépôt créé à ${station.name} pour ${money(cost)}.`);
  }
  return ok('Gare améliorée.');
}


function stationAcquisitionCost(station) {
  if (station?.custom) return Math.round(65000 * state.market.steel);
  const population = Number(station?.population || 0);
  if (population > 0) {
    // Prix volontairement très progressif : petites villes accessibles,
    // métropoles et capitale réservées à une phase avancée.
    return Math.round((120000 + population * 3.2 + Math.pow(population, 1.12) * 0.9) * state.market.steel);
  }
  const demand = Number(station?.baseDemand || 80);
  return Math.round((75000 + Math.pow(demand, 1.18) * 1050) * state.market.steel);
}

function stationUpgradeCost(station, asset, kind) {
  if (kind === 'level') return Math.round((85000 + station.baseDemand * 55) * asset.level * state.market.steel);
  if (kind === 'commerce') return Math.round(50000 * (asset.commerce + 1) * asset.level);
  if (kind === 'maintenance') return Math.round(90000 * (asset.maintenance + 1) * asset.level);
  if (kind === 'depot') return 180000;
  return 0;
}


function actionCreateCustomStation(player, payload) {
  const lat = Number(payload.lat);
  const lon = Number(payload.lon);
  const name = cleanText(payload.name || 'Nouvel arrêt', 38);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return fail('Coordonnées invalides.');
  if (!isInFranceBounds(lat, lon)) return fail('Point hors zone.', 'Choisis un emplacement situé en France métropolitaine ou en Corse.');
  if (name.length < 2) return fail('Nom trop court.');

  const creationCost = Math.round(55000 * state.market.steel);
  if (!canPay(player, creationCost)) return fail(`Trésorerie insuffisante. Coût de création : ${money(creationCost)}.`);

  const id = `OSM_${crypto.randomUUID().slice(0, 8)}`;
  const baseDemand = estimateDemandFromLocation(lat, lon);
  const freight = estimateFreightFromLocation(lat, lon);
  const tourism = estimateTourismFromLocation(lat, lon);
  const station = {
    id,
    name,
    lat,
    lon,
    region: 'Arrêts personnalisés',
    baseDemand,
    freight,
    tourism,
    custom: true,
    ownerId: player.id,
    createdDay: state.day
  };
  state.customStations ||= {};
  state.customStations[id] = station;
  player.cash -= creationCost;
  player.stations[id] = { level: 1, depot: false, commerce: 0, maintenance: 0, electrified: false };
  _routeCache.clear();
  invalidatePublicWorldCache();
  notify(player, `Nouvel arrêt personnalisé créé : ${name}.`);
  state.news.push({ day: state.day, text: `${player.name} ouvre un nouvel arrêt à ${name}.` });
  return ok('Arrêt personnalisé créé.');
}

function estimateDemandFromLocation(lat, lon) {
  // Paris / grandes métropoles approchées par la proximité de gares existantes.
  let best = 90;
  for (const s of WORLD.stations) {
    const d = haversine(lat, lon, s.lat, s.lon);
    const influence = s.baseDemand * Math.exp(-d / 55);
    best = Math.max(best, influence);
  }
  return Math.round(clamp(best, 60, 500));
}

function estimateFreightFromLocation(lat, lon) {
  let best = 25;
  for (const s of WORLD.stations) {
    const d = haversine(lat, lon, s.lat, s.lon);
    best = Math.max(best, s.freight * Math.exp(-d / 70));
  }
  return Math.round(clamp(best, 10, 150));
}

function estimateTourismFromLocation(lat, lon) {
  let best = 30;
  for (const s of WORLD.stations) {
    const d = haversine(lat, lon, s.lat, s.lon);
    best = Math.max(best, s.tourism * Math.exp(-d / 85));
  }
  return Math.round(clamp(best, 20, 120));
}

function actionHireStaff(player, payload) {
  const role = String(payload.role || '');
  const count = clamp(Math.floor(Number(payload.count || 1)), 1, 50);
  const def = BALANCE.staff[role];
  if (!def) return fail('Métier inconnu.');
  const cost = Math.round(def.hireCost * count);
  if (!canPay(player, cost)) return fail(`Trésorerie insuffisante. Coût: ${money(cost)}.`);
  player.cash -= cost;
  player.staff[role] = (player.staff[role] || 0) + count;
  notify(player, `${count} ${def.label}${count > 1 ? 's' : ''} recruté${count > 1 ? 's' : ''}.`);
  return ok();
}

function actionFireStaff(player, payload) {
  const role = String(payload.role || '');
  const count = clamp(Math.floor(Number(payload.count || 1)), 1, 50);
  const def = BALANCE.staff[role];
  if (!def) return fail('Métier inconnu.');
  const current = player.staff[role] || 0;
  if (current < count) return fail('Effectif insuffisant.');
  const severance = Math.round(def.salary * count * 0.7);
  if (!canPay(player, severance)) return fail(`Indemnités insuffisantes en trésorerie : ${money(severance)}.`);
  player.cash -= severance;
  player.staff[role] -= count;
  player.reputation = Math.max(0, player.reputation - count * 0.3);
  notify(player, `${count} poste${count > 1 ? 's' : ''} supprimé${count > 1 ? 's' : ''}.`);
  return ok();
}

function actionRepairTrain(player, payload) {
  const trainId = String(payload.trainId || '');
  const modeId = String(payload.mode || 'standard');
  const train = player.trains.find(t => t.id === trainId);
  if (!train) return fail('Train introuvable.');
  normalizeTrain(train, player.id);
  if (train.maintenance?.active) return fail('Ce train est déjà en maintenance.', `Fin prévue dans ${formatCycles(train.maintenance.daysLeft)}.`);

  const model = BALANCE.trains[train.modelId];
  const mode = BALANCE.maintenanceActions[modeId];
  if (!mode) return fail('Type de maintenance inconnu.');
  if (mode.requiredTech && !hasTech(player, mode.requiredTech)) {
    const tech = techNodeById(mode.requiredTech);
    return fail('Recherche requise pour cette maintenance.', `Débloque d’abord : ${tech?.title || mode.requiredTech}.`);
  }
  if (mode.requiresDepot && !hasMaintenanceWorkshop(player)) {
    return fail('Atelier requis.', 'Construis un atelier de maintenance ou un dépôt dans au moins une gare exploitée.');
  }
  const targetCondition = Math.max(train.condition, Math.min(mode.target || 0.99, train.condition + mode.restore));
  if (targetCondition <= train.condition + 0.005) return fail('Cette intervention n’apporterait presque aucune amélioration.', `Choisis une intervention plus lourde ou attends que l’état descende sous ${Math.round((mode.target || 0.99) * 100)}%.`);

  const cost = maintenanceActionCost(player, train, model, mode);
  if (!canPay(player, cost)) return fail(`Trésorerie insuffisante. Coût: ${money(cost)}.`);
  const duration = maintenanceDuration(player, mode);
  player.cash -= cost;
  train.maintenance = {
    active: true,
    mode: modeId,
    label: mode.name,
    daysLeft: duration,
    duration,
    targetCondition,
    startedDay: state.day,
    cost
  };
  notify(player, `${model.name} envoyé en maintenance (${mode.name}) : ${formatCycles(duration)}, ${money(cost)}.`);
  return ok('Maintenance planifiée.');
}

function actionSetMaintenancePolicy(player, payload) {
  const policy = String(payload.policy || 'standard');
  if (!BALANCE.maintenancePolicies[policy]) return fail('Politique de maintenance inconnue.');
  player.maintenancePolicy = policy;
  notify(player, `Politique de maintenance définie : ${BALANCE.maintenancePolicies[policy].name}.`);
  return ok('Politique de maintenance modifiée.');
}

function actionResearch(player, payload) {
  const nodeId = String(payload.nodeId || '');
  const node = techNodeById(nodeId);
  if (!node) return fail('Recherche inconnue.');
  player.researchQueue = normalizeResearchQueue(player.researchQueue);
  const currentLevel = plannedTechLevel(player, nodeId);
  const targetLevel = currentLevel + 1;
  if (targetLevel > techNodeMaxLevel(node)) return fail('Niveau de recherche hors limite technique.');
  if (player.researchQueue.length >= 12) return fail('File R&D pleine.', 'Attends qu’un projet démarre avant d’ajouter d’autres recherches.');
  if (player.epoch < (node.requiredEpoch || 0)) {
    return fail('Époque insuffisante.', `Cette recherche demande l’époque : ${BALANCE.epochs[node.requiredEpoch]?.name || node.requiredEpoch + 1}.`);
  }
  const missing = missingResearchPrereqs(player, node, targetLevel, true);
  if (missing.length) {
    const labels = missing.map(researchPrereqLabelServer).join(', ');
    return fail('Prérequis manquant.', `Débloque d’abord : ${labels}.`);
  }
  const costMoney = researchCostMoney(node, targetLevel);
  if (!canPay(player, costMoney)) return fail(`Budget insuffisant. Requis : ${money(costMoney)}.`);
  const durationMs = researchDurationMs(node, targetLevel);
  player.cash -= costMoney;
  const queued = {
    nodeId,
    targetLevel,
    durationMs,
    costMoney,
    queuedAt: Date.now()
  };
  if (!player.researchProject) {
    startResearchProject(player, queued);
    notify(player, `Projet R&D lancé : ${node.title} niveau ${targetLevel}.`);
    return ok('Projet R&D lancé.');
  }
  player.researchQueue.push(queued);
  notify(player, `Projet R&D ajouté à la file : ${node.title} niveau ${targetLevel}.`);
  return ok('Projet R&D ajouté à la file.');
}


function actionCancelResearch(player, payload) {
  const source = String(payload.source || payload.scope || '').toLowerCase();
  player.researchProject = normalizeResearchProject(player.researchProject);
  player.researchQueue = normalizeResearchQueue(player.researchQueue);

  const cancelled = [];
  let cancelledActive = false;

  if (source === 'active' || source === 'project') {
    const project = player.researchProject;
    if (!project) return fail('Aucune recherche active à annuler.');
    if (payload.nodeId && project.nodeId !== String(payload.nodeId)) return fail('La recherche active ne correspond plus.', 'L’interface a probablement été rafraîchie entre-temps.');
    cancelled.push(refundResearchItem(player, project, 'active'));
    player.researchProject = null;
    cancelledActive = true;
  } else if (source === 'queue' || source === 'queued') {
    const index = Math.floor(Number(payload.index));
    if (!Number.isInteger(index) || index < 0 || index >= player.researchQueue.length) return fail('Recherche introuvable dans la file.', 'La file R&D a probablement changé entre-temps.');
    const [item] = player.researchQueue.splice(index, 1);
    cancelled.push(refundResearchItem(player, item, 'queue'));
  } else {
    return fail('Type d’annulation inconnu.', 'Précise une recherche active ou une recherche en file d’attente.');
  }

  const cascaded = pruneInvalidQueuedResearch(player);
  if (!player.researchProject) startNextQueuedResearch(player);

  const all = [...cancelled, ...cascaded];
  const totalRefund = all.reduce((sum, item) => sum + Number(item.refund || 0), 0);
  const names = all.map(item => item.title).filter(Boolean);
  const cascadeText = cascaded.length ? ` ${cascaded.length} recherche(s) dépendante(s) annulée(s) aussi.` : '';
  notify(player, `R&D annulée : ${names.join(', ')}. Remboursement total : ${money(totalRefund)}.${cascadeText}`);
  return ok(`Recherche annulée. Remboursement : ${money(totalRefund)}.${cascadeText}`);
}

function refundResearchItem(player, item, source = 'queue') {
  const node = techNodeById(item?.nodeId);
  const baseRefund = Math.max(0, Math.round(Number(item?.costMoney || 0)));
  const operatingRefund = source === 'active' ? Math.max(0, Math.round(Number(item?.operatingCostAccrued || 0))) : 0;
  const refund = baseRefund + operatingRefund;
  player.cash += refund;
  if (operatingRefund > 0) {
    player.stats ||= {};
    player.stats.expenses = Math.max(0, Math.round(Number(player.stats.expenses || 0) - operatingRefund));
    player.stats.profit = Math.round(Number(player.stats.profit || 0) + operatingRefund);
  }
  return {
    source,
    nodeId: item?.nodeId || '',
    targetLevel: item?.targetLevel || 1,
    title: node ? `${node.title} niv. ${item?.targetLevel || 1}` : item?.nodeId || 'Recherche',
    refund,
    baseRefund,
    operatingRefund
  };
}

function pruneInvalidQueuedResearch(player) {
  player.researchQueue = normalizeResearchQueue(player.researchQueue);
  const levels = new Map();
  for (const [id, level] of Object.entries(player.techUnlocked || {})) levels.set(id, Math.max(0, Math.floor(Number(level || 0))));
  if (player.researchProject?.nodeId) {
    levels.set(player.researchProject.nodeId, Math.max(levels.get(player.researchProject.nodeId) || 0, Math.floor(Number(player.researchProject.targetLevel || 0))));
  }

  const prereqMetByLevelMap = req => {
    if (!req) return true;
    if (req.anyOf) return req.anyOf.some(prereqMetByLevelMap);
    return (levels.get(req.id) || 0) >= req.level;
  };

  const kept = [];
  const cancelled = [];
  for (const item of player.researchQueue) {
    const node = techNodeById(item.nodeId);
    const currentLevel = levels.get(item.nodeId) || 0;
    const validLevel = Boolean(node) && item.targetLevel === currentLevel + 1 && item.targetLevel <= techNodeMaxLevel(node);
    const missing = node ? researchPrereqsForLevel(node, item.targetLevel).filter(req => !prereqMetByLevelMap(req)) : [{ id: 'missing', level: 1 }];
    if (validLevel && !missing.length) {
      kept.push(item);
      levels.set(item.nodeId, Math.max(currentLevel, item.targetLevel));
    } else {
      cancelled.push(refundResearchItem(player, item, 'cascade'));
    }
  }
  player.researchQueue = kept;
  return cancelled;
}

function processTrainMaintenance(player) {
  for (const train of player.trains) {
    normalizeTrain(train, player.id);
    if (!train.maintenance?.active) continue;
    train.maintenance.daysLeft -= 1;
    if (train.maintenance.daysLeft <= 0) {
      const model = BALANCE.trains[train.modelId];
      train.condition = clamp(train.maintenance.targetCondition || Math.max(train.condition, 0.9), 0.1, 1);
      train.maintenance = { active: false, mode: null, daysLeft: 0, duration: 0, targetCondition: 0, lastServiceDay: state.day };
      notify(player, `${model?.name || 'Train'} ressort d’atelier : État ${Math.round(train.condition * 100)}%.`);
    }
  }
}

function processResearchProject(player) {
  const project = normalizeResearchProject(player.researchProject);
  player.researchProject = project;
  if (!project) {
    startNextQueuedResearch(player);
    return;
  }
  const node = techNodeById(project.nodeId);
  if (!node) {
    player.researchProject = null;
    return;
  }
  const now = Date.now();
  const elapsedMs = Math.max(0, now - (project.updatedAt || now));
  project.remainingMs = Math.max(0, project.remainingMs - elapsedMs * researchWorkRate(player));
  project.updatedAt = now;
  if (project.remainingMs > 0) {
    player.researchProject = project;
    return;
  }
  const previousLevel = techLevel(player, node.id);
  const nextLevel = Math.max(previousLevel, project.targetLevel);
  player.techUnlocked[node.id] = nextLevel;
  player.tech[node.branch] = recomputeBranchLevel(player, node.branch);
  player.researchProject = null;
  notify(player, `Recherche terminée : ${node.title} niveau ${nextLevel}.`);
  checkEpochUnlock(player);
  startNextQueuedResearch(player);
}

function startResearchProject(player, item) {
  const node = techNodeById(item.nodeId);
  if (!node) return false;
  const now = Date.now();
  player.researchProject = {
    nodeId: node.id,
    targetLevel: item.targetLevel,
    remainingMs: item.durationMs,
    durationMs: item.durationMs,
    costMoney: item.costMoney,
    operatingCostAccrued: 0,
    startedAt: now,
    updatedAt: now
  };
  return true;
}

function startNextQueuedResearch(player) {
  player.researchQueue = normalizeResearchQueue(player.researchQueue);
  while (!player.researchProject && player.researchQueue.length) {
    const next = player.researchQueue.shift();
    const node = techNodeById(next.nodeId);
    if (!node) continue;
    const expectedLevel = techLevel(player, next.nodeId) + 1;
    const validLevel = next.targetLevel === expectedLevel && next.targetLevel <= techNodeMaxLevel(node);
    const missing = missingResearchPrereqs(player, node, next.targetLevel, false);
    if (!validLevel || missing.length) {
      player.cash += next.costMoney || 0;
      notify(player, `Projet R&D annulé et remboursé : ${node.title}.`);
      continue;
    }
    startResearchProject(player, next);
    notify(player, `Projet R&D démarré depuis la file : ${node.title} niveau ${next.targetLevel}.`);
  }
}

function researchWorkRate(player) {
  const reputationBonus = Math.min(0.32, Math.max(0, player.reputation - 50) * 0.004);
  const socialBonus = techLevel(player, 'crew_training') * 0.025;
  const labTechBonus = Math.min(0.22, techLevel(player, 'centralized_control') * 0.018);
  return round2(1 + reputationBonus + socialBonus + labTechBonus);
}

function boundedExponential(base, growth, exponent, cap = Number.MAX_SAFE_INTEGER) {
  const b = Math.max(0, Number(base || 0));
  const g = Math.max(1.01, Number(growth || 1));
  const e = Math.max(0, Number(exponent || 0));
  if (!Number.isFinite(b) || b <= 0) return 0;
  const logValue = Math.log(b) + Math.log(g) * e;
  if (!Number.isFinite(logValue) || logValue >= Math.log(cap)) return cap;
  return Math.min(cap, b * Math.exp(Math.log(g) * e));
}

function researchCostMoney(node, targetLevel) {
  const level = clamp(Math.floor(Number(targetLevel || 1)), 1, RESEARCH_TECHNICAL_MAX_LEVEL);
  const base = Number(node.baseCostMoney ?? node.costMoney ?? 50000);
  const growth = Number(node.costGrowth ?? 1.62);
  const epochFactor = 1 + Math.max(0, Number(node.requiredEpoch || 0)) * 0.22;
  return Math.round(boundedExponential(base * epochFactor, growth, level - 1));
}

function researchDurationMs(node, targetLevel) {
  const level = clamp(Math.floor(Number(targetLevel || 1)), 1, RESEARCH_TECHNICAL_MAX_LEVEL);
  const base = Number(node.baseDurationSeconds ?? node.baseDuration ?? node.duration ?? 30);
  const growth = Number(node.durationGrowth ?? 1.5);
  return Math.max(15000, Math.round(boundedExponential(base, growth, level - 1, 315360000) * 1000));
}

function techLevel(player, nodeId) {
  const value = player?.techUnlocked?.[nodeId];
  if (value === true) return 1;
  return clamp(Math.floor(Number(value || 0)), 0, RESEARCH_TECHNICAL_MAX_LEVEL);
}

function techNodeMaxLevel(node) {
  const raw = Number(node?.maxLevel);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : RESEARCH_TECHNICAL_MAX_LEVEL;
}

function hasTech(player, nodeId, level = 1) {
  return techLevel(player, nodeId) >= level;
}

function normalizeResearchPrereqItem(item) {
  if (!item) return null;
  if (typeof item === 'string') return { id: item, level: 1 };
  if (Array.isArray(item.anyOf)) {
    const anyOf = item.anyOf.map(normalizeResearchPrereqItem).filter(Boolean).filter(req => !req.anyOf);
    return anyOf.length ? { anyOf } : null;
  }
  return { id: item.id, level: Math.max(1, Math.floor(Number(item.level || 1))) };
}

function researchPrereqsForLevel(node, targetLevel) {
  const all = [...(node.prereq || [])];
  for (const entry of node.levelPrereq || []) {
    if (targetLevel >= Number(entry.level || 1)) all.push(...(entry.requires || []));
  }
  return all.map(normalizeResearchPrereqItem).filter(Boolean);
}

function researchPrereqSatisfied(player, req, includePlanned = false) {
  if (req.anyOf) return req.anyOf.some(option => researchPrereqSatisfied(player, option, includePlanned));
  const level = includePlanned ? plannedTechLevel(player, req.id) : techLevel(player, req.id);
  return level >= req.level;
}

function researchPrereqLabelServer(req) {
  if (req.anyOf) return req.anyOf.map(researchPrereqLabelServer).join(' ou ');
  return `${techNodeById(req.id)?.title || req.id} niv. ${req.level}`;
}

function missingResearchPrereqs(player, node, targetLevel, includePlanned = false) {
  return researchPrereqsForLevel(node, targetLevel).filter(req => !researchPrereqSatisfied(player, req, includePlanned));
}

function plannedTechLevel(player, nodeId) {
  let level = techLevel(player, nodeId);
  if (player.researchProject?.nodeId === nodeId) level = Math.max(level, player.researchProject.targetLevel || 0);
  for (const item of normalizeResearchQueue(player.researchQueue)) {
    if (item.nodeId === nodeId) level = Math.max(level, item.targetLevel || 0);
  }
  return level;
}

function recomputeBranchLevel(player, branch) {
  let total = 0;
  for (const group of Object.values(BALANCE.techTree || {})) {
    for (const node of group.nodes || []) {
      if (node.branch === branch) total += techLevel(player, node.id) * (node.levelValue || 1);
    }
  }
  return total;
}

function hasMaintenanceWorkshop(player) {
  return Object.values(player.stations || {}).some(a => a.depot || (a.maintenance || 0) > 0);
}

function maintenanceActionCost(player, train, model, mode) {
  const missing = Math.max(0.02, 1 - train.condition);
  const workshopDiscount = Math.min(0.18, totalMaintenance(player) * 0.025);
  const techDiscount = (hasTech(player, 'steam_workshops') ? 0.92 : 1) * (hasTech(player, 'electric_standardized_maintenance') ? 0.94 : 1);
  return Math.round((mode.baseCost + model.price * mode.priceFactor * missing) * (1 - workshopDiscount) * techDiscount);
}

function maintenanceDuration(player, mode) {
  const workshopBonus = Math.min(0.35, totalMaintenance(player) * 0.035 + (player.staff.mechanics || 0) * 0.012);
  const techBonus = Math.min(0.24, techLevel(player, 'steam_workshops') * 0.045) + Math.min(0.1, techLevel(player, 'electric_standardized_maintenance') * 0.02);
  return Math.max(1, Math.ceil(mode.days * (1 - workshopBonus - techBonus)));
}

function actionEnergyStrategy(player, payload) {
  const strategy = String(payload.strategy || 'spot');
  if (!['spot', 'stable', 'green', 'cheap'].includes(strategy)) return fail('Contrat énergie inconnu.');
  player.energyStrategy = strategy;
  notify(player, `Stratégie énergie définie : ${BALANCE.energyStrategies[strategy].name}.`);
  return ok();
}

function actionTakeLoan(player, payload) {
  const amount = clamp(Math.round(Number(payload.amount || 100000)), 50000, 5000000);
  player.cash += amount;
  player.debt += Math.round(amount * 1.08);
  notify(player, `Emprunt contracté : ${money(amount)}. Dette à rembourser : ${money(Math.round(amount * 1.08))}.`);
  return ok();
}

function actionRepayLoan(player, payload) {
  const amount = clamp(Math.round(Number(payload.amount || 100000)), 10000, Math.max(10000, player.debt));
  if (player.debt <= 0) return fail('Aucune dette à rembourser.');
  if (!canPay(player, amount)) return fail('Trésorerie insuffisante.');
  const paid = Math.min(amount, player.debt);
  player.cash -= paid;
  player.debt -= paid;
  notify(player, `Dette remboursée : ${money(paid)}.`);
  return ok();
}

function actionRename(player, payload) {
  player.name = cleanText(payload.name || player.name, 28);
  player.color = validateColor(payload.color) || player.color;
  notify(player, 'Identité de compagnie modifiée.');
  return ok();
}

function actionResetCompany(player, payload) {
  if (payload.confirm !== 'RESET') return fail('Confirmation requise.');
  delete state.players[player.id];
  return ok('Compagnie supprimée. Rechargez la page pour recommencer.');
}

function simulateTick() {
  state.day += 1;
  state.now = Date.now();
  state.eraYear = 1850 + Math.floor(state.day / 12);
  updateMarket();
  updateEvents();
  const lineMarkets = buildLineMarkets();
  const passageRightsLedger = new Map();
  for (const player of Object.values(state.players)) {
    simulatePlayer(player, lineMarkets, passageRightsLedger);
  }
  applyPassageRightsLedger(passageRightsLedger);
  maybeCreateNpc();
}

function simulatePlayer(player, lineMarkets, passageRightsLedger = null, options = {}) {
  const dryRun = Boolean(options.dryRun);
  if (!dryRun) {
    processTrainMaintenance(player);
    processResearchProject(player);
  }
  let revenue = 0;
  let expenses = 0;
  let passengers = 0;
  let freight = 0;
  let co2 = 0;
  let punctualityWeighted = 0;
  let satisfactionWeighted = 0;
  let weight = 0;
  let marketScore = 0;

  const staffing = computeStaffing(player);
  const staffNeeds = computeStaffNeeds(player);
  const driverCoverage = driverCoverageForNeed(player, staffNeeds.drivers);
  const lineInfrastructureMultiplier = clamp(1.22 - staffing.engineers * 0.22, 0.78, 1.18);
  const totalOwnedLineKm = player.lines
    .filter(line => line?.active && lineStops(line).length >= 2)
    .reduce((sum, line) => sum + lineDistance(line), 0);
  const totalLineInfrastructurePool = totalOwnedLineKm * ECONOMY.lineInfrastructureMaintenancePerKm * lineInfrastructureMultiplier;
  const policy = BALANCE.maintenancePolicies[player.maintenancePolicy] || BALANCE.maintenancePolicies.standard;
  const maintenanceCapacity = 1 + (player.staff.mechanics || 0) * 0.08 + totalMaintenance(player) * 0.12 + techLevel(player, 'electric_standardized_maintenance') * 0.16 + techLevel(player, 'steam_workshops') * 0.1;
  const eventFactor = currentEventFactor();
  const activeLineStats = [];
  const resourceRuntime = createResourceRuntime(player);

  for (const line of player.lines) {
    if (!line.active) continue;
    const train = player.trains.find(t => t.id === line.trainId);
    if (!train) continue;
    if (train.maintenance?.active) {
      line.stats = { passengers: 0, freightTons: 0, revenue: 0, expenses: 0, profit: 0, punctuality: 0, satisfaction: 20, share: 0, status: 'maintenance' };
      continue;
    }
    const model = BALANCE.trains[train.modelId];
    const operatingModel = getTrainOperatingProfile(train, model, player);
    const stops = lineStops(line);
    const from = stationById(stops[0]);
    const to = stationById(stops[stops.length - 1]);
    const distance = lineDistance(line);
    const lineNeeds = computeLineStaffNeeds(player, line);
    const lineDriverCoverage = lineNeeds.drivers > 0 ? driverCoverage : 1;
    const allocatedDrivers = lineNeeds.drivers > 0 ? lineNeeds.drivers * lineDriverCoverage : 0;
    const effectiveLine = lineWithEffectiveFrequency(line, lineDriverCoverage);
    const effectiveFrequency = Number(effectiveLine.frequency || 0);
    const lineStaffingStats = {
      needs: lineNeeds,
      driverCoverage: round2(lineDriverCoverage * 100),
      allocatedDrivers: round2(allocatedDrivers),
      requiredDrivers: lineNeeds.drivers,
      effectiveFrequency: round2(effectiveFrequency),
      requestedFrequency: Number(line.frequency || 0)
    };
    if (lineDriverCoverage <= 0) {
      line.stats = {
        passengers: 0,
        freightTons: 0,
        revenue: 0,
        expenses: 0,
        profit: 0,
        punctuality: 0,
        satisfaction: 8,
        share: 0,
        status: 'driver-shortage',
        staffing: lineStaffingStats,
        capacity: {
          passengers: 0,
          freightTons: 0,
          passengerLoad: null,
          freightLoad: null,
          crewFactor: 0,
          stationFactor: round2(lineStationFactor(player, line) * 100),
          capacityFactor: 0,
          driverCoverage: 0,
          effectiveFrequency: 0,
          requestedFrequency: Number(line.frequency || 0),
          trainComposition: operatingModel.compositionSummary
        }
      };
      continue;
    }
    const resourceCheck = reserveLineResource(player, resourceRuntime, operatingModel, effectiveLine, distance, dryRun);
    if (!resourceCheck.ok) {
      const label = resourceCheck.type === 'electricity' ? 'électricité commandée insuffisante' : `${resourceCheck.type === 'coal' ? 'charbon' : 'diesel'} insuffisant`;
      line.stats = {
        passengers: 0,
        freightTons: 0,
        revenue: 0,
        expenses: 0,
        profit: 0,
        punctuality: 0,
        satisfaction: 18,
        share: 0,
        status: 'resource-shortage',
        staffing: lineStaffingStats,
        capacity: {
          passengers: 0,
          freightTons: 0,
          passengerLoad: null,
          freightLoad: null,
          crewFactor: 0,
          stationFactor: round2(lineStationFactor(player, line) * 100),
          capacityFactor: 0,
          driverCoverage: round2(lineDriverCoverage * 100),
          effectiveFrequency: round2(effectiveFrequency),
          requestedFrequency: Number(line.frequency || 0),
          trainComposition: operatingModel.compositionSummary
        },
        resource: {
          type: resourceCheck.type,
          requiredPerHour: round2(resourceCheck.amountPerHour || 0),
          requiredPerTick: round2(resourceCheck.amountPerTick || 0),
          label
        }
      };
      continue;
    }
    const routeDemand = computeRouteDemand(from, to, line, player, eventFactor);
    const passengerDetails = lineCanServeMarket(operatingModel, 'passengers') && lineMarketServices(line).includes('passengers')
      ? computeLineAttractivenessDetails(player, effectiveLine, operatingModel, train, distance, staffing, 'passengers')
      : null;
    const freightDetails = lineCanServeMarket(operatingModel, 'freight') && lineMarketServices(line).includes('freight')
      ? computeLineAttractivenessDetails(player, effectiveLine, operatingModel, train, distance, staffing, 'freight')
      : null;
    const passengerMarket = passengerDetails
      ? marketSnapshot(lineMarkets[routeKey(stops[0], stops[stops.length - 1], 'passengers')] || [], line.id, passengerDetails.score)
      : null;
    const freightMarket = freightDetails
      ? marketSnapshot(lineMarkets[routeKey(stops[0], stops[stops.length - 1], 'freight')] || [], line.id, freightDetails.score)
      : null;
    const scoredShares = [passengerMarket?.share, freightMarket?.share].filter(Number.isFinite);
    if (scoredShares.length) marketScore += scoredShares.reduce((sum, share) => sum + share, 0) / scoredShares.length;

    const crewFactor = Math.min(staffing.controllers, staffing.dispatchers);
    const stationFactor = lineStationFactor(player, line);
    const capacityFactor = Math.min(1, crewFactor * stationFactor);
    const fareComplianceFactor = clamp(0.76 + staffing.controllers * 0.24, 0.72, 1.06);
    const stationAgentFlowFactor = clamp(0.76 + staffing.stationAgents * 0.24, 0.72, 1.08);
    const dispatchRevenueFactor = clamp(0.78 + staffing.dispatchers * 0.22, 0.76, 1.07);
    const maxPax = operatingModel.capacity * effectiveFrequency * capacityFactor;
    const maxFreight = operatingModel.freight * effectiveFrequency * capacityFactor;
    let linePax = 0;
    let lineFreight = 0;

    const passengerCapture = passengerDetails ? demandCaptureFromAttractiveness(passengerDetails, 'passengers') : 0;
    const freightCapture = freightDetails ? demandCaptureFromAttractiveness(freightDetails, 'freight') : 0;

    if (line.service === 'passengers' || line.service === 'mixed') {
      const share = passengerMarket?.share || 0;
      linePax = Math.max(0, Math.min(maxPax, routeDemand.passengers * share * passengerCapture * stationAgentFlowFactor));
    }
    if (line.service === 'freight' || line.service === 'mixed') {
      const share = freightMarket?.share || 0;
      lineFreight = Math.max(0, Math.min(maxFreight, routeDemand.freight * share * freightCapture));
    }

    const effectiveTicketPrice = lineTicketPrice(line, distance);
    const effectiveTariff = effectiveTicketPrice / Math.max(1, distance);
    setLineTicketPrice(line, effectiveTicketPrice, distance);
    const profitabilityMultiplier = operatingModel.profitabilityMultiplier || 1;
    const ticketRevenue = linePax * effectiveTicketPrice * profitabilityMultiplier * ECONOMY.passengerRevenueMultiplier * fareComplianceFactor;
    const ancillaryRevenue = linePax * 0.35 * averageCommerce(player, line);
    const freightRevenue = lineFreight * distance * (0.045 + player.tech.freight * 0.003) * (operatingModel.freightRevenueMultiplier || 1) * (operatingModel.profitabilityMultiplier || 1) * ECONOMY.freightRevenueMultiplier;
    const serviceRevenue = ticketRevenue + ancillaryRevenue + freightRevenue;
    const lineRevenue = serviceRevenue * dispatchRevenueFactor;
    const energyCost = computeEnergyCost(player, operatingModel, distance, effectiveFrequency, line.electrified);
    const maintenanceCost = operatingModel.maintenance * distance * effectiveFrequency * (1 + (1 - train.condition) * 1.5) * (1 - Math.min(0.22, player.tech.operations * 0.025)) * policy.costMultiplier * (1 - Math.min(0.16, techLevel(player, 'steam_workshops') * 0.025)) * ECONOMY.maintenanceCostMultiplier;
    const passageRights = computePassageRights(player, effectiveLine, operatingModel, distance);
    const accessCost = passageRights.total;
    if (!dryRun) recordPassageRights(passageRightsLedger, player, line, passageRights);
    const lineInfrastructureCost = totalOwnedLineKm > 0 ? totalLineInfrastructurePool * (distance / totalOwnedLineKm) : 0;
    const variableExpenses = energyCost + maintenanceCost + accessCost + lineInfrastructureCost;
    const contribution = lineRevenue - variableExpenses;
    revenue += lineRevenue;
    expenses += variableExpenses;

    const wearBase = (distance * effectiveFrequency / 120000) * (1.15 - Math.min(0.35, maintenanceCapacity / 20));
    const mechanicWearFactor = clamp(1.16 - staffing.mechanics * 0.16, 0.74, 1.14);
    const techWear = (1 - Math.min(0.14, techLevel(player, 'electric_standardized_maintenance') * 0.025)) * (1 - Math.min(0.1, techLevel(player, 'steam_workshops') * 0.018));
    const wear = wearBase * mechanicWearFactor * policy.wearMultiplier * techWear;
    const projectedCondition = clamp(train.condition - wear, 0.12, 1);
    if (!dryRun) {
      train.condition = projectedCondition;
      train.age += 1;
    }
    const reliabilityCondition = dryRun ? train.condition : projectedCondition;
    const reliability = clamp(operatingModel.reliability * reliabilityCondition * (0.86 + Math.min(0.18, maintenanceCapacity / 30)) * crewFactor + policy.reliabilityBonus + techLevel(player, 'safety_training') * 0.006, 0.18, 0.995);
    const delayRisk = 1 - reliability;
    const dispatcherPunctualityBonus = (dispatchRevenueFactor - 1) * 22;
    const stationSatisfactionBonus = (stationAgentFlowFactor - 1) * 20;
    const punctuality = clamp(100 - delayRisk * 100 - Math.max(0, effectiveFrequency - 10) * 1.4 - Math.max(0, 1 - lineDriverCoverage) * 18 + dispatcherPunctualityBonus, 35, 99);
    const satisfaction = clamp(
      30 + operatingModel.comfort * 45 + player.reputation * 0.23 + Math.min(12, effectiveFrequency) - effectiveTariff * 65 + averageStationLevel(player, line) * 4 + Math.max(0, stops.length - 2) * 1.5 - Math.max(0, 1 - lineDriverCoverage) * 12 + stationSatisfactionBonus,
      10,
      100
    );

    line.stats = {
      passengers: Math.round(linePax),
      freightTons: Math.round(lineFreight),
      revenue: Math.round(lineRevenue),
      expenses: Math.round(variableExpenses),
      profit: Math.round(contribution),
      punctuality: round2(punctuality),
      satisfaction: round2(satisfaction),
      share: round2((scoredShares.reduce((sum, share) => sum + share, 0) / Math.max(1, scoredShares.length)) * 100),
      status: lineDriverCoverage < 0.999 ? 'driver-shortage' : 'ok',
      staffing: lineStaffingStats,
      market: {
        passengerDemand: Math.round(routeDemand.passengers),
        freightDemand: Math.round(routeDemand.freight),
        passengerShare: passengerMarket ? round2(passengerMarket.share * 100) : null,
        freightShare: freightMarket ? round2(freightMarket.share * 100) : null,
        passengerRank: passengerMarket?.rank || null,
        freightRank: freightMarket?.rank || null,
        passengerCompetitors: passengerMarket?.competitorCount || 0,
        freightCompetitors: freightMarket?.competitorCount || 0,
        passengerLeader: passengerMarket?.leader || null,
        freightLeader: freightMarket?.leader || null,
        passengerScore: passengerDetails ? round2(passengerDetails.score) : null,
        freightScore: freightDetails ? round2(freightDetails.score) : null,
        passengerDemandCapture: passengerDetails ? round2(passengerCapture * 100) : null,
        freightDemandCapture: freightDetails ? round2(freightCapture * 100) : null
      },
      attractiveness: {
        passenger: passengerDetails,
        freight: freightDetails
      },
      capacity: {
        passengers: Math.round(maxPax),
        freightTons: Math.round(maxFreight),
        passengerLoad: maxPax > 0 ? round2(linePax / maxPax * 100) : null,
        freightLoad: maxFreight > 0 ? round2(lineFreight / maxFreight * 100) : null,
        crewFactor: round2(crewFactor * 100),
        stationFactor: round2(stationFactor * 100),
        capacityFactor: round2(capacityFactor * 100),
        driverCoverage: round2(lineDriverCoverage * 100),
        effectiveFrequency: round2(effectiveFrequency),
        requestedFrequency: Number(line.frequency || 0),
        trainComposition: operatingModel.compositionSummary
      },
      finance: {
        ticketPrice: Math.round(effectiveTicketPrice),
        farePerKm: round2(effectiveTariff),
        ticketRevenue: Math.round(ticketRevenue),
        ancillaryRevenue: Math.round(ancillaryRevenue),
        freightRevenue: Math.round(freightRevenue),
        dispatchRevenueBoost: Math.round(Math.max(0, lineRevenue - serviceRevenue)),
        lineInfrastructureCost: Math.round(lineInfrastructureCost),
        energyCost: Math.round(energyCost),
        resourceType: resourceCheck.type,
        resourceConsumptionPerHour: round2(resourceCheck.amountPerHour || 0),
        maintenanceCost: Math.round(maintenanceCost),
        accessCost: Math.round(accessCost),
        passageRights: Math.round(accessCost),
        variableExpenses: Math.round(variableExpenses),
        contribution: Math.round(contribution),
        allocatedOverhead: 0,
        netProfit: Math.round(contribution),
        margin: lineRevenue > 0 ? round2(contribution / lineRevenue * 100) : 0
      }
    };
    activeLineStats.push({ line, stats: line.stats, weight: Math.max(1, lineRevenue, distance * line.frequency) });

    passengers += linePax;
    freight += lineFreight;
    co2 += computeCo2(operatingModel, distance, effectiveFrequency);
    punctualityWeighted += punctuality * Math.max(1, linePax + lineFreight * 0.5);
    satisfactionWeighted += satisfaction * Math.max(1, linePax + lineFreight * 0.5);
    weight += Math.max(1, linePax + lineFreight * 0.5);
  }

  const staffCost = Object.entries(player.staff).reduce((sum, [role, count]) => sum + (BALANCE.staff[role]?.salary || 0) * count / ECONOMY.staffCostDivisor, 0) * (1 - Math.min(0.1, techLevel(player, 'crew_training') * 0.018));
  const stationCost = Object.values(player.stations).reduce((sum, a) => sum + (a.level * ECONOMY.stationLevelCost + a.commerce * ECONOMY.stationCommerceCost + a.maintenance * ECONOMY.stationMaintenanceCost + (a.depot ? ECONOMY.stationDepotCost : 0)), 0);
  const debtCost = player.debt * ECONOMY.debtInterestPerTick;
  const idleTrainCost = player.trains.reduce((sum, train) => {
    const used = player.lines.some(line => line.active && line.trainId === train.id);
    const model = BALANCE.trains[train.modelId];
    return sum + (!used && model ? model.price * ECONOMY.idleTrainStorageFactor : 0);
  }, 0);
  const stationRevenue = computeOwnedStationRevenue(player, passengers, freight);
  const researchCost = researchOperatingCost(player);
  if (!dryRun && player.researchProject && researchCost > 0) {
    const refundableLabCost = Math.max(0, Math.round(ECONOMY.researchLabBaseCost || 0));
    player.researchProject.operatingCostAccrued = Math.max(0, Math.round(Number(player.researchProject.operatingCostAccrued || 0) + refundableLabCost));
  }
  revenue += stationRevenue;
  const sharedCosts = staffCost + stationCost + debtCost + idleTrainCost + researchCost;
  const allocationWeight = activeLineStats.reduce((sum, item) => sum + item.weight, 0);
  for (const item of activeLineStats) {
    const overhead = allocationWeight > 0 ? sharedCosts * item.weight / allocationWeight : sharedCosts / Math.max(1, activeLineStats.length);
    const finance = item.stats.finance || {};
    const variableExpenses = Number(finance.variableExpenses || item.stats.expenses || 0);
    const contribution = Number(finance.contribution || item.stats.profit || 0);
    finance.allocatedOverhead = Math.round(overhead);
    finance.netProfit = Math.round(contribution - overhead);
    finance.totalExpenses = Math.round(variableExpenses + overhead);
    finance.netMargin = item.stats.revenue > 0 ? round2((contribution - overhead) / item.stats.revenue * 100) : 0;
    item.stats.finance = finance;
    item.stats.expenses = finance.totalExpenses;
    item.stats.profit = finance.netProfit;
  }
  expenses += sharedCosts;

  const profit = revenue - expenses;
  if (dryRun) return { revenue, expenses, profit, passengers, freight, co2 };
  player.cash += profit;
  if (player.cash < -100000) {
    player.debt += Math.abs(player.cash) * 1.12;
    notify(player, `Découvert converti en dette : ${money(Math.abs(player.cash))}.`);
    player.cash = 0;
    player.reputation = Math.max(0, player.reputation - 1.5);
  }

  const punctuality = weight ? punctualityWeighted / weight : player.stats.punctuality;
  const satisfaction = weight ? satisfactionWeighted / weight : player.stats.satisfaction;
  player.reputation = clamp(player.reputation + (satisfaction - 55) * 0.006 + (punctuality - 88) * 0.004 + (profit > 0 ? 0.02 : -0.03), 0, 100);
  player.research = round2(researchWorkRate(player));
  player.co2 += co2;

  player.stats.passengers += Math.round(passengers);
  player.stats.freightTons += Math.round(freight);
  player.stats.revenue += Math.round(revenue);
  player.stats.expenses += Math.round(expenses);
  player.stats.profit += Math.round(profit);
  player.stats.lastRevenue = Math.round(revenue);
  player.stats.lastExpenses = Math.round(expenses);
  player.stats.lastProfit = Math.round(profit);
  const lineFinanceTotals = activeLineStats.reduce((acc, item) => {
    const finance = item.stats?.finance || {};
    acc.ticketRevenue += Number(finance.ticketRevenue || 0);
    acc.ancillaryRevenue += Number(finance.ancillaryRevenue || 0);
    acc.freightRevenue += Number(finance.freightRevenue || 0);
    acc.dispatchRevenueBoost += Number(finance.dispatchRevenueBoost || 0);
    acc.energyCost += Number(finance.energyCost || 0);
    acc.trainMaintenanceCost += Number(finance.maintenanceCost || 0);
    acc.lineInfrastructureCost += Number(finance.lineInfrastructureCost || 0);
    acc.accessCost += Number(finance.accessCost || 0);
    acc.variableExpenses += Number(finance.variableExpenses || 0);
    return acc;
  }, {
    ticketRevenue: 0,
    ancillaryRevenue: 0,
    freightRevenue: 0,
    dispatchRevenueBoost: 0,
    energyCost: 0,
    trainMaintenanceCost: 0,
    lineInfrastructureCost: 0,
    accessCost: 0,
    variableExpenses: 0
  });
  player.stats.lastBreakdown = {
    lineRevenue: Math.round(revenue - stationRevenue),
    stationRevenue: Math.round(stationRevenue),
    ticketRevenue: Math.round(lineFinanceTotals.ticketRevenue),
    ancillaryRevenue: Math.round(lineFinanceTotals.ancillaryRevenue),
    freightRevenue: Math.round(lineFinanceTotals.freightRevenue),
    dispatchRevenueBoost: Math.round(lineFinanceTotals.dispatchRevenueBoost),
    energyCost: Math.round(lineFinanceTotals.energyCost),
    trainMaintenanceCost: Math.round(lineFinanceTotals.trainMaintenanceCost),
    lineInfrastructureCost: Math.round(lineFinanceTotals.lineInfrastructureCost),
    accessCost: Math.round(lineFinanceTotals.accessCost),
    staffCost: Math.round(staffCost),
    stationCost: Math.round(stationCost),
    debtCost: Math.round(debtCost),
    idleTrainCost: Math.round(idleTrainCost),
    researchCost: Math.round(researchCost),
    variableLineCost: Math.round(Math.max(0, expenses - sharedCosts)),
    sharedCosts: Math.round(sharedCosts)
  };
  player.stats.punctuality = round2(punctuality);
  player.stats.satisfaction = round2(satisfaction);
  player.stats.marketShare = round2(marketScore);

  checkEpochUnlock(player);

  if (state.day % 30 === 0) {
    const worst = player.trains.filter(t => t.condition < 0.38).slice(0, 1)[0];
    if (worst) {
      const model = BALANCE.trains[worst.modelId];
      notify(player, `Maintenance urgente recommandée : ${model.name} à ${Math.round(worst.condition * 100)}% d’état.`);
    }
  }
}

function buildLineMarkets() {
  const markets = {};
  for (const player of Object.values(state.players)) {
    const staffing = computeStaffing(player);
    const needs = computeStaffNeeds(player);
    const driverCoverage = driverCoverageForNeed(player, needs.drivers);
    if (driverCoverage <= 0) continue;
    for (const line of player.lines) {
      if (!line.active) continue;
      const train = player.trains.find(t => t.id === line.trainId);
      if (!train) continue;
      if (train.maintenance?.active) continue;
      const model = BALANCE.trains[train.modelId];
      const operatingModel = getTrainOperatingProfile(train, model, player);
      const stops = lineStops(line);
      const distance = lineDistance(line);
      const effectiveLine = lineWithEffectiveFrequency(line, driverCoverage);
      for (const market of lineMarketServices(line)) {
        if (!lineCanServeMarket(operatingModel, market)) continue;
        const key = routeKey(stops[0], stops[stops.length - 1], market);
        if (!markets[key]) markets[key] = [];
        const details = computeLineAttractivenessDetails(player, effectiveLine, operatingModel, train, distance, staffing, market);
        markets[key].push({
          playerId: player.id,
          companyName: player.name,
          lineId: line.id,
          lineCode: lineRouteName(lineStops(line)),
          market,
          score: details.score
        });
      }
    }
  }
  return markets;
}

function lineMarketServices(line) {
  if (line.service === 'mixed') return ['passengers', 'freight'];
  if (line.service === 'freight') return ['freight'];
  return ['passengers'];
}

function lineCanServeMarket(model, market) {
  if (!model) return false;
  if (market === 'freight') return (model.freight || 0) > 0;
  return (model.capacity || 0) > 0;
}

function marketSnapshot(competitors, lineId, score) {
  const entries = Array.isArray(competitors) ? competitors : [];
  const totalScore = entries.reduce((sum, c) => sum + Math.max(0, Number(c.score || 0)), 0) || Math.max(0.1, score);
  const sorted = [...entries].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const rank = Math.max(1, sorted.findIndex(c => c.lineId === lineId) + 1 || 1);
  const leaderEntry = sorted[0] || null;
  const share = entries.length > 1 ? clamp(score / totalScore, 0.03, 0.94) : 1;
  return {
    share,
    rank,
    competitorCount: Math.max(0, entries.length - 1),
    leader: leaderEntry ? { companyName: leaderEntry.companyName, lineCode: leaderEntry.lineCode, score: round2(leaderEntry.score) } : null,
    totalScore: round2(totalScore)
  };
}

function demandCaptureFromAttractiveness(details, market = 'passengers') {
  if (!details || !Number.isFinite(details.score)) return 0;
  const normalized = clamp(details.score / (market === 'freight' ? 3.2 : 4.2), 0, 1.35);
  // Courbe v54 : assez dure pour ne pas capter toute la demande,
  // mais une ligne correcte n'est plus condamnée par défaut.
  const base = market === 'freight' ? 0.20 : 0.18;
  const span = market === 'freight' ? 0.74 : 0.76;
  const curve = market === 'freight' ? 0.78 : 0.74;
  return clamp(base + Math.pow(normalized, curve) * span, market === 'freight' ? 0.12 : 0.12, market === 'freight' ? 0.96 : 0.95);
}

function computeLineAttractiveness(player, line, model, train, distance, staffing, market = 'passengers') {
  return computeLineAttractivenessDetails(player, line, model, train, distance, staffing, market).score;
}

function computeLineAttractivenessDetails(player, line, model, train, distance, staffing, market = 'passengers') {
  const time = distance / Math.max(25, model.speed);
  const frequencyBoost = Math.sqrt(line.frequency);
  const ticketPrice = lineTicketPrice(line, distance);
  const fareCap = ticketPriceCeiling(distance);
  // À plafond atteint : facteur prix = 0 %. Plus le billet s'approche du plafond
  // propre à la distance, plus l'attractivité liée au prix s'effondre.
  const priceRatio = fareCap > 0 ? clamp(ticketPrice / fareCap, 0, 1) : 1;
  const priceBoost = market === 'passengers' ? 1.32 * Math.max(0, 1 - priceRatio) : 1;
  const comfortBoost = market === 'passengers'
    ? (0.62 + model.comfort) * (0.92 + Math.min(0.26, (model.capacity || 0) / 1600))
    : (0.58 + Math.min(1.15, (model.freight || 0) / 950)) * (1 + Math.min(0.24, (player.tech.freight || 0) * 0.028));
  const repBoost = 0.5 + player.reputation / 100;
  const conditionBoost = 0.35 + train.condition;
  const staffBoost = market === 'passengers'
    ? Math.min(staffing.drivers, staffing.controllers, staffing.dispatchers, 1.25)
    : Math.min(staffing.drivers, staffing.dispatchers, staffing.mechanics + 0.08, 1.25);
  const stationBoost = Math.min(1.24, lineStationFactor(player, line));
  const opsBoost = (1 + Math.min(0.1, techLevel(player, 'block_signaling') * 0.02)) * (1 + Math.min(0.12, techLevel(player, 'centralized_control') * 0.024));
  const freightBoost = market === 'freight'
    ? (1 + Math.min(0.13, techLevel(player, 'specialized_wagons') * 0.026)) * (1 + Math.min(0.16, techLevel(player, 'container_hubs') * 0.032))
    : 1;
  const score = Math.max(0.1, frequencyBoost * comfortBoost * repBoost * conditionBoost * priceBoost * staffBoost * stationBoost * opsBoost * freightBoost / Math.sqrt(Math.max(0.2, time)));
  return {
    market,
    score: round2(score),
    factors: {
      price: market === 'passengers' ? round2(priceBoost / 1.32 * 100) : null,
      frequency: round2(clamp(frequencyBoost / Math.sqrt(12), 0, 1.25) * 100),
      speed: round2(clamp((model.speed || 1) / 180, 0.25, 1.35) * 100),
      comfortOrCapacity: round2(clamp(comfortBoost / (market === 'passengers' ? 1.6 : 1.8), 0, 1.3) * 100),
      reputation: round2(clamp(repBoost / 1.5, 0, 1.2) * 100),
      condition: round2(clamp(conditionBoost / 1.35, 0, 1.1) * 100),
      staff: round2(clamp(staffBoost, 0, 1.25) * 100),
      stations: round2(clamp(stationBoost, 0, 1.24) * 100),
      operations: round2(clamp(opsBoost * freightBoost, 0, 1.35) * 100)
    }
  };
}


function computeRouteDemand(from, to, line, player, eventFactor) {
  const stops = lineStops(line);
  const distance = lineDistance(line);
  const mids = stops.slice(1, -1).map(id => stationById(id)).filter(Boolean);
  const fromDemand = effectiveStationPassengerDemand(from);
  const toDemand = effectiveStationPassengerDemand(to);
  const stopDemand = mids.reduce((sum, s) => sum + effectiveStationPassengerDemand(s) * 0.18 + s.tourism * 0.6 + s.freight * 0.2, 0);
  const demandBase = Math.sqrt(fromDemand * toDemand) * 0.9 + stopDemand;
  const tourismMid = mids.reduce((sum, s) => sum + s.tourism, 0);
  const tourism = 1 + (from.tourism + to.tourism + tourismMid * 0.5) / 160;
  const distanceFactor = clamp(1.25 - distance / 900, 0.25, 1.2);
  const eraFactor = 0.85 + player.epoch * 0.18;
  const reputation = 0.75 + player.reputation / 190;
  const stationTech = (1 + Math.min(0.13, techLevel(player, 'passenger_flow') * 0.026)) * (1 + Math.min(0.16, techLevel(player, 'intermodal_hubs') * 0.032));
  const stopBonus = 1 + Math.max(0, stops.length - 2) * 0.07;
  const passengerDemand = demandBase * tourism * distanceFactor * eraFactor * state.market.demand * eventFactor.passenger * reputation * stationTech * stopBonus * ECONOMY.passengerDemandMultiplier;
  const freightMid = mids.reduce((sum, s) => sum + s.freight, 0);
  const freightBase = Math.sqrt((from.freight + 18) * (to.freight + 18)) * 5.5 + freightMid * 1.8;
  const freightTech = (1 + Math.min(0.15, techLevel(player, 'specialized_wagons') * 0.03)) * (1 + Math.min(0.2, techLevel(player, 'container_hubs') * 0.04));
  const freightDemand = freightBase * clamp(distance / 180, 0.5, 2.2) * state.market.freight * eventFactor.freight * (0.75 + player.tech.freight * 0.08) * freightTech * Math.max(1, 1 + Math.max(0, stops.length - 2) * 0.05) * ECONOMY.freightDemandMultiplier;
  return { passengers: passengerDemand, freight: freightDemand };
}


function computeEnergyCost(player, model, distance, frequency, electrified) {
  const type = model.energyType;
  const resourceType = trainResourceType(model);
  if (resourceType === 'coal' || resourceType === 'diesel') return 0;
  if (resourceType === 'electricity') {
    const strategy = BALANCE.energyStrategies[player.energyStrategy] || BALANCE.energyStrategies.spot;
    const price = (state.market.electricity || 0.34) * (strategy.multiplier?.electricity || strategy.defaultMultiplier || 1);
    const hourlyDemand = resourceDemandPerHour(model, distance, frequency);
    return (hourlyDemand * price * 100) / ticksPerRealHour();
  }
  return 0;
}

function normalizeResources(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    coal: Math.max(0, Number(r.coal || 0)),
    diesel: Math.max(0, Number(r.diesel || 0)),
    electricityOrder: Math.max(0, Number(r.electricityOrder || 0))
  };
}

function ticksPerRealHour() {
  return 3600000 / Math.max(250, TICK_MS);
}

function trainResourceType(model) {
  if (!model) return null;
  if (model.energyType === 'coal') return 'coal';
  if (model.energyType === 'diesel') return 'diesel';
  if (model.energyType === 'electricity' || model.energyType === 'battery') return 'electricity';
  return null;
}

function resourceDemandPerHour(model, distance, frequency) {
  const type = trainResourceType(model);
  if (!type) return 0;
  const tuning = { coal: 1.0, diesel: 0.8, electricity: model.energyType === 'battery' ? 0.55 : 0.7 }[type] || 1;
  return Math.max(0, Number(model.energy || 0) * Math.max(0, Number(distance || 0)) * Math.max(0, Number(frequency || 0)) * tuning / 100);
}

function computePlayerResourceFlow(player) {
  player.resources = normalizeResources(player.resources);
  const consumption = { coal: 0, diesel: 0, electricity: 0 };
  const sources = { coal: [], diesel: [], electricity: [] };
  const driverCoverage = driverCoverageForNeed(player);
  for (const line of player.lines || []) {
    if (!line.active) continue;
    const train = player.trains.find(t => t.id === line.trainId);
    if (!train || train.maintenance?.active) continue;
    const model = BALANCE.trains[train.modelId];
    if (!model) continue;
    const operatingModel = getTrainOperatingProfile(train, model, player);
    const type = trainResourceType(operatingModel);
    if (!type) continue;
    const effectiveLine = lineWithEffectiveFrequency(line, driverCoverage);
    const perHour = resourceDemandPerHour(operatingModel, lineDistance(line), effectiveLine.frequency);
    consumption[type] += perHour;
    sources[type].push({
      lineId: line.id,
      lineCode: lineRouteName(lineStops(line)),
      lineName: lineRouteName(lineStops(line)),
      trainName: model.name,
      amountPerHour: round2(perHour)
    });
  }
  return {
    stocks: normalizeResources(player.resources),
    consumption: {
      coal: round2(consumption.coal),
      diesel: round2(consumption.diesel),
      electricity: round2(consumption.electricity)
    },
    production: {
      electricity: round2(player.resources.electricityOrder || 0)
    },
    balance: {
      coal: round2((player.resources.coal || 0) - consumption.coal),
      diesel: round2((player.resources.diesel || 0) - consumption.diesel),
      electricity: round2((player.resources.electricityOrder || 0) - consumption.electricity)
    },
    sources
  };
}

function createResourceRuntime(player) {
  player.resources = normalizeResources(player.resources);
  return {
    electricityRemainingPerHour: Math.max(0, Number(player.resources.electricityOrder || 0))
  };
}

function reserveLineResource(player, runtime, model, line, distance, dryRun = false) {
  const type = trainResourceType(model);
  if (!type) return { ok: true, type: null, amountPerHour: 0, amountPerTick: 0 };
  const perHour = resourceDemandPerHour(model, distance, line.frequency);
  const perTick = perHour / ticksPerRealHour();

  if (type === 'electricity') {
    if ((runtime.electricityRemainingPerHour || 0) + 1e-9 < perHour) {
      return { ok: false, type, amountPerHour: perHour, amountPerTick: perTick, reason: 'electricity_order' };
    }
    runtime.electricityRemainingPerHour -= perHour;
    return { ok: true, type, amountPerHour: perHour, amountPerTick: perTick };
  }

  if ((player.resources[type] || 0) + 1e-9 < perTick) {
    return { ok: false, type, amountPerHour: perHour, amountPerTick: perTick, reason: 'stock' };
  }
  if (!dryRun) player.resources[type] = Math.max(0, (player.resources[type] || 0) - perTick);
  return { ok: true, type, amountPerHour: perHour, amountPerTick: perTick };
}

function actionBuyResource(player, payload) {
  const type = String(payload.type || '').toLowerCase();
  const qty = Math.max(0, Math.min(100000, Number(payload.quantity || 0)));
  if (!['coal', 'diesel'].includes(type)) return fail('Ressource inconnue.');
  if (type === 'diesel' && player.epoch < 1) return fail('Diesel verrouillé.', 'Atteins l’ère du diesel pour acheter du gazole.');
  if (qty <= 0) return fail('Quantité invalide.');
  player.resources = normalizeResources(player.resources);
  const price = Number(state.market[type] || 1) * 100;
  const cost = Math.round(qty * price);
  if (!canPay(player, cost)) return fail(`Trésorerie insuffisante. Coût : ${money(cost)}.`);
  player.cash -= cost;
  player.resources[type] += qty;
  notify(player, `${type === 'coal' ? 'Charbon' : 'Diesel'} acheté : ${round2(qty)} unités pour ${money(cost)}.`);
  return ok(`${type === 'coal' ? 'Charbon' : 'Diesel'} acheté.`);
}

function actionSetElectricityOrder(player, payload) {
  if (player.epoch < 2) return fail('Contrat électrique verrouillé.', 'Atteins l’ère électrique pour commander de l’électricité.');
  const amount = Math.max(0, Math.min(50000, Number(payload.amount || 0)));
  player.resources = normalizeResources(player.resources);
  player.resources.electricityOrder = round2(amount);
  notify(player, `Commande électrique ajustée : ${round2(amount)} MW/h.`);
  return ok('Commande électrique modifiée.');
}


function computeOwnedStationRevenue(player, passengers, freightTons) {
  const assets = Object.values(player.stations || {});
  if (!assets.length) return 0;
  const stationBase = assets.reduce((sum, asset) => (
    sum
    + (asset.level || 1) * ECONOMY.ownedStationIncomeBase
    + (asset.commerce || 0) * ECONOMY.ownedStationCommerceIncome
    + (asset.depot ? 24 : 0)
  ), 0);
  const trafficIncome = passengers * 0.18 + freightTons * 0.032;
  const flowBonus = 1 + Math.min(0.18, techLevel(player, 'passenger_flow') * 0.025 + techLevel(player, 'intermodal_hubs') * 0.035);
  return (stationBase + trafficIncome) * flowBonus;
}

function researchOperatingCost(player) {
  return player.researchProject ? ECONOMY.researchLabBaseCost : 0;
}

function computeCo2(model, distance, frequency) {
  const factor = { coal: 4.2, diesel: 2.7, electricity: 0.45, hydrogen: 0.2, battery: 0.15 }[model.energyType] || 1;
  return model.energy * distance * frequency * factor * (model.co2Multiplier || 1) / 100;
}


function emptyStaffNeeds() {
  return { drivers: 0, controllers: 0, stationAgents: 0, mechanics: 0, dispatchers: 0, engineers: 0 };
}

function computeLineStaffNeeds(player, line) {
  if (!line?.active) return emptyStaffNeeds();
  const stops = lineStops(line);
  if (stops.length < 2) return emptyStaffNeeds();
  const distance = lineDistance(line);
  const frequency = clamp(Number(line.frequency || 0), 1, 20);
  const longLineFactor = 1 + Math.max(0, distance - 180) / 420;
  const stopFactor = 1 + Math.max(0, stops.length - 2) * 0.08;
  const passengerService = line.service === 'passengers' || line.service === 'mixed';
  const train = player?.trains?.find(t => t.id === line.trainId);

  return {
    drivers: Math.max(1, Math.ceil((frequency / 2) * longLineFactor * stopFactor)),
    controllers: passengerService ? Math.max(1, Math.ceil((frequency / 3.2) * Math.min(1.8, longLineFactor) * Math.min(1.45, stopFactor))) : 0,
    stationAgents: Math.max(1, Math.ceil(frequency / 20 + stops.length * 0.18 + Math.max(0, stops.length - 2) * 0.16)),
    mechanics: train ? Math.max(1, Math.ceil(0.22 + distance * frequency / 1800)) : Math.max(0, Math.ceil(distance * frequency / 2200)),
    dispatchers: Math.max(1, Math.ceil(0.34 + (frequency / 18) * Math.min(1.5, stopFactor))),
    engineers: Math.max(0, Math.ceil(distance / 220 + frequency / 16 - 0.5))
  };
}

function computeStaffNeeds(player) {
  const activeLines = player.lines.filter(l => l.active);
  const stationCount = Object.keys(player.stations || {}).length;
  const trains = player.trains.length;
  if (!activeLines.length && !stationCount && !trains) return emptyStaffNeeds();

  const needs = emptyStaffNeeds();
  let dailyKm = 0;
  let stationWork = 0;

  for (const line of activeLines) {
    const lineNeeds = computeLineStaffNeeds(player, line);
    needs.drivers += lineNeeds.drivers;
    needs.controllers += lineNeeds.controllers;
    needs.dispatchers += lineNeeds.dispatchers;
    needs.engineers += lineNeeds.engineers;
    dailyKm += lineDistance(line) * clamp(Number(line.frequency || 0), 1, 20);
    stationWork += Math.max(0, lineStops(line).length - 2);
  }

  return {
    drivers: activeLines.length ? Math.max(1, needs.drivers) : 0,
    controllers: needs.controllers > 0 ? Math.max(1, needs.controllers) : 0,
    stationAgents: stationCount || activeLines.length ? Math.max(1, Math.ceil(stationCount * 0.65 + activeLines.length * 0.12 + stationWork * 0.16)) : 0,
    mechanics: trains ? Math.max(1, Math.ceil(trains * 0.55 + dailyKm / 1800)) : 0,
    dispatchers: activeLines.length ? Math.max(1, needs.dispatchers) : 0,
    engineers: needs.engineers > 0 ? Math.max(1, needs.engineers) : 0
  };
}

function driverCoverageForNeed(player, need = null) {
  const required = Math.max(0, Number((need ?? computeStaffNeeds(player).drivers) || 0));
  if (required <= 0) return 1;
  return clamp(Number(player.staff?.drivers || 0) / required, 0, 1);
}

function lineWithEffectiveFrequency(line, driverCoverage) {
  const coverage = clamp(Number(driverCoverage), 0, 1);
  if (coverage >= 0.999) return line;
  return { ...line, frequency: Math.max(0, Number(line.frequency || 0) * coverage) };
}

function computeStaffing(player) {
  const needs = computeStaffNeeds(player);
  const training = Math.min(0.24, techLevel(player, 'crew_training') * 0.045);
  const safety = Math.min(0.12, techLevel(player, 'safety_training') * 0.025);
  const driverBase = driverCoverageForNeed(player, needs.drivers);
  return {
    drivers: needs.drivers > 0 ? clamp(driverBase + (driverBase > 0 ? training : 0), 0, 1.25) : 1.25,
    controllers: ratio(player.staff.controllers, needs.controllers) + training,
    stationAgents: ratio(player.staff.stationAgents, needs.stationAgents) + safety,
    mechanics: ratio(player.staff.mechanics, needs.mechanics) + training,
    dispatchers: ratio(player.staff.dispatchers, needs.dispatchers) + training,
    engineers: ratio(player.staff.engineers, needs.engineers)
  };
}

function ratio(value, need) {
  const required = Number(need || 0);
  if (required <= 0) return 1.25;
  return clamp((Number(value || 0) + 0.4) / required, 0.25, 1.25);
}

function updateMarket() {
  const drift = () => (Math.random() - 0.5) * 0.035;
  for (const key of Object.keys(state.market)) {
    const base = createMarket()[key];
    state.market[key] = round2(clamp(state.market[key] + drift(), base * 0.55, base * 1.85));
  }
  for (const event of state.events) {
    if (event.kind === 'energy') {
      state.market.diesel = round2(state.market.diesel * 1.01);
      state.market.electricity = round2(state.market.electricity * 1.006);
    }
    if (event.kind === 'tourism') state.market.demand = round2(state.market.demand * 1.003);
    if (event.kind === 'freight') state.market.freight = round2(state.market.freight * 1.005);
  }
}

function updateEvents() {
  for (const event of state.events) event.remaining -= 1;
  state.events = state.events.filter(e => e.remaining > 0);
  if (Math.random() < 0.08 || state.events.length === 0) {
    const event = createEvent(null, Math.floor(8 + Math.random() * 20));
    state.events.push(event);
    state.news.push({ day: state.day, text: event.title });
    state.news = state.news.slice(-60);
  }
}

function currentEventFactor() {
  let passenger = 1;
  let freight = 1;
  for (const event of state.events) {
    passenger *= event.passenger || 1;
    freight *= event.freight || 1;
  }
  return { passenger, freight };
}

function createEvent(forcedKind, duration) {
  const events = [
    { kind: 'tourism', title: 'Vacances scolaires : Forte demande voyageurs sur les axes touristiques.', passenger: 1.18, freight: 0.98 },
    { kind: 'energy', title: 'Tension sur les marchés de l’énergie : Les coûts de traction augmentent.', passenger: 1.0, freight: 0.96 },
    { kind: 'weather', title: 'Météo difficile : La ponctualité devient plus fragile.', passenger: 0.94, freight: 0.92 },
    { kind: 'freight', title: 'Rebond industriel : Les contrats fret sont plus nombreux.', passenger: 1.0, freight: 1.2 },
    { kind: 'expo', title: 'Grand événement national : Hausse temporaire des déplacements longue distance.', passenger: 1.14, freight: 1.02 },
    { kind: 'social', title: 'Tensions sociales sectorielles : Les compagnies sous-effectif sont pénalisées.', passenger: 0.97, freight: 0.97 }
  ];
  const event = forcedKind ? events.find(e => e.kind === forcedKind) || events[0] : events[Math.floor(Math.random() * events.length)];
  return { ...event, remaining: duration };
}

function epochTrafficTotal(player) {
  return Math.max(0, Math.round(Number(player.stats?.passengers || 0) + Number(player.stats?.freightTons || 0)));
}

function checkEpochUnlock(player) {
  let unlocked = false;
  while (true) {
    const totalTech = Object.values(player.tech).reduce((a, b) => a + b, 0);
    const next = BALANCE.epochs[player.epoch + 1];
    if (!next) return unlocked;
    const trafficTotal = epochTrafficTotal(player);
    if (totalTech < next.requiredTech || trafficTotal < next.requiredTraffic) return unlocked;
    player.epoch += 1;
    unlocked = true;
    notify(player, `Nouvelle époque débloquée : ${BALANCE.epochs[player.epoch].name}.`);
    state.news.push({ day: state.day, text: `${player.name} entre dans l’époque : ${BALANCE.epochs[player.epoch].name}.` });
  }
}

function maybeCreateNpc() {
  if (Object.keys(state.players).length >= 10) return;
  if (state.day < state.nextNpcAt) return;
  state.nextNpcAt += 22 + Math.floor(Math.random() * 18);
  const names = ['TransHexagone', 'Ouest Rail', 'Nord Fret', 'Azur Express', 'Massif Central Rail', 'Atlantique Sillons'];
  const regions = [...new Set(WORLD.stations.map(s => s.region))];
  const name = names[Math.floor(Math.random() * names.length)] + ' IA';
  const player = createPlayer({ name, color: randomColor(), region: regions[Math.floor(Math.random() * regions.length)] });
  player.cash += 100000;
  notify(player, 'Concurrent IA créé.');
}

function compositionDefaultModeForModel(model) {
  const label = `${model?.name || ''} ${model?.type || ''}`.toLowerCase();
  const isMultipleUnit = /(autorail|rame|tgv|duplex|régio|ter|hydrogène|batterie|train de nuit|maglev|grande vitesse)/.test(label);
  if (isMultipleUnit) return 'multiple_unit';
  const passengerDominant = (model.capacity || 0) >= Math.max(80, (model.freight || 0) * 0.9);
  return passengerDominant && (model.capacity || 0) > 0 ? 'passenger_loco' : 'freight_loco';
}

function compositionAvailableModesForModel(model) {
  const defaultMode = compositionDefaultModeForModel(model);
  if (defaultMode === 'multiple_unit') return ['multiple_unit'];
  return ['passenger_loco', 'freight_loco'];
}

function compositionSpecForModel(model, preferredMode = null) {
  const defaultMode = compositionDefaultModeForModel(model);
  if (defaultMode === 'multiple_unit') {
    const defaultUnits = clamp(Math.round((model.capacity || 180) / 220), 1, 5);
    return {
      mode: 'multiple_unit',
      availableModes: ['multiple_unit'],
      powerUnits: { min: 1, max: Math.max(defaultUnits + 2, 4), default: defaultUnits },
      label: 'Engins moteurs',
      variants: []
    };
  }
  const availableModes = compositionAvailableModesForModel(model);
  const mode = availableModes.includes(preferredMode) ? preferredMode : defaultMode;
  const passengerDefault = clamp(Math.round((Math.max(model.capacity || 100, 100)) / 90), 1, 8);
  const freightDefault = clamp(Math.round((Math.max(model.freight || 200, 180)) / 180), 2, 14);
  if (mode === 'passenger_loco') {
    return {
      mode,
      availableModes,
      passengerCars: { min: 1, max: Math.max(passengerDefault + 5, 8), default: passengerDefault },
      label: 'Voitures voyageurs',
      variants: compositionVariantsForMode('passenger_loco')
    };
  }
  return {
    mode,
    availableModes,
    freightCars: { min: 2, max: Math.max(freightDefault + 6, 12), default: freightDefault },
    label: 'Wagons fret',
    variants: compositionVariantsForMode('freight_loco')
  };
}

function ensureTrainComposition(train, model) {
  const base = train.composition && typeof train.composition === 'object' ? train.composition : {};
  const spec = compositionSpecForModel(model, base.mode);
  const passengerVariant = compositionVariantForMode('passenger_loco', base.passengerVariant)?.id || 'standard';
  const freightVariant = compositionVariantForMode('freight_loco', base.freightVariant)?.id || 'covered';
  train.composition = {
    mode: spec.mode,
    passengerCars: clamp(Math.round(Number(base.passengerCars ?? compositionSpecForModel(model, 'passenger_loco').passengerCars?.default ?? 0)), compositionSpecForModel(model, 'passenger_loco').passengerCars?.min ?? 0, compositionSpecForModel(model, 'passenger_loco').passengerCars?.max ?? 0),
    freightCars: clamp(Math.round(Number(base.freightCars ?? compositionSpecForModel(model, 'freight_loco').freightCars?.default ?? 0)), compositionSpecForModel(model, 'freight_loco').freightCars?.min ?? 0, compositionSpecForModel(model, 'freight_loco').freightCars?.max ?? 0),
    powerUnits: clamp(Math.round(Number(base.powerUnits ?? compositionSpecForModel(model, 'multiple_unit').powerUnits?.default ?? 1)), compositionSpecForModel(model, 'multiple_unit').powerUnits?.min ?? 1, compositionSpecForModel(model, 'multiple_unit').powerUnits?.max ?? 1),
    passengerVariant,
    freightVariant
  };
  return train.composition;
}


const _techNodeListCache = [];
const _researchEffectCache = new Map();

function allTechNodes() {
  if (_techNodeListCache.length) return _techNodeListCache;
  for (const group of Object.values(BALANCE.techTree || {})) {
    for (const node of group.nodes || []) _techNodeListCache.push(node);
  }
  return _techNodeListCache;
}

function normalizeEffectText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseResearchNumericEffects(effectText) {
  const text = normalizeEffectText(effectText);
  if (!text || text.includes('niveaux suivants') || text.includes('aucune fonctionnalite')) return [];
  const regex = /([+-])\s*(\d+(?:[.,]\d+)?)\s*%\s*(portee|autonomie|vitesse max|fiabilite|consommation|impact environnemental|rentabilite)/g;
  const effects = [];
  let match;
  while ((match = regex.exec(text))) {
    const sign = match[1] === '-' ? -1 : 1;
    const rawValue = Number(String(match[2]).replace(',', '.')) / 100;
    const label = match[3];
    const kind = (
      label === 'vitesse max' ? 'speed' :
      label === 'fiabilite' ? 'reliability' :
      label === 'consommation' ? 'energy' :
      label === 'impact environnemental' ? 'environment' :
      label === 'rentabilite' ? 'profitability' :
      'range'
    );
    effects.push({ kind, value: sign * rawValue });
  }
  return effects;
}

function nodeNumericEffects(node) {
  if (!node?.id) return [];
  if (_researchEffectCache.has(node.id)) return _researchEffectCache.get(node.id);
  const parsed = [];
  for (const effect of node.improves || []) parsed.push(...parseResearchNumericEffects(effect));
  _researchEffectCache.set(node.id, parsed);
  return parsed;
}

function modelResearchEra(model) {
  return Math.max(1, Number(model?.unlockEpoch || 0) + 1);
}


function researchLevelEffectUnits(level) {
  const n = Math.max(0, Math.floor(Number(level || 0)));
  if (n <= 5) return n;
  return 5 + 2 * (1 - Math.pow(0.75, n - 5));
}

function eraResearchModifiers(player, era) {
  const modifiers = { speed: 1, range: 1, reliability: 1, energy: 1, environment: 1, profitability: 1 };
  if (!player || !era) return modifiers;
  for (const node of allTechNodes()) {
    if (Number(node.era || 0) !== Number(era)) continue;
    const level = techLevel(player, node.id);
    if (level <= 0) continue;
    const units = researchLevelEffectUnits(level);
    for (const effect of nodeNumericEffects(node)) {
      const adjusted = effect.value * units;
      modifiers[effect.kind] *= Math.max(0.08, 1 + adjusted);
    }
  }
  return modifiers;
}

function modelWithEraResearch(player, model) {
  if (!player || !model) return { ...model, profitabilityMultiplier: 1, co2Multiplier: 1 };
  const modifiers = eraResearchModifiers(player, modelResearchEra(model));
  return {
    ...model,
    speed: Math.max(20, round2((model.speed || 0) * modifiers.speed)),
    range: Math.max(1, round2((model.range || 0) * modifiers.range)),
    reliability: clamp((model.reliability || 0) * modifiers.reliability, 0.18, 0.995),
    energy: Math.max(0.01, round2((model.energy || 0) * modifiers.energy)),
    profitabilityMultiplier: round2(modifiers.profitability),
    co2Multiplier: round2(modifiers.environment)
  };
}

function getTrainOperatingProfile(train, model, player = null) {
  const sourceModel = modelWithEraResearch(player, model);
  const composition = ensureTrainComposition(train, sourceModel);
  const spec = compositionSpecForModel(sourceModel, composition.mode);
  const profile = { ...sourceModel, compositionMode: spec.mode, compositionSpec: spec, composition, freightRevenueMultiplier: 1, co2Multiplier: sourceModel.co2Multiplier || 1 };
  if (spec.mode === 'multiple_unit') {
    const defaultUnits = spec.powerUnits.default;
    const ratio = composition.powerUnits / Math.max(1, defaultUnits);
    profile.capacity = Math.max(0, Math.round(sourceModel.capacity * ratio));
    profile.freight = Math.max(0, Math.round((sourceModel.freight || 0) * ratio));
    profile.speed = Math.max(35, Math.round(sourceModel.speed * (1 - Math.max(0, ratio - 1) * 0.015)));
    profile.energy = round2(sourceModel.energy * ratio * (0.95 + ratio * 0.05));
    profile.maintenance = round2(sourceModel.maintenance * ratio * (0.92 + ratio * 0.08));
    profile.reliability = clamp(sourceModel.reliability - Math.max(0, ratio - 1) * 0.015, 0.45, 0.995);
    profile.comfort = clamp(sourceModel.comfort - Math.max(0, ratio - 1) * 0.01, 0.08, 1);
    profile.variant = null;
    profile.compositionSummary = `${composition.powerUnits} engin(s) moteur(s)`;
    return profile;
  }
  if (spec.mode === 'passenger_loco') {
    const variant = compositionVariantForMode('passenger_loco', composition.passengerVariant);
    const defaultCars = spec.passengerCars.default;
    const ratio = composition.passengerCars / Math.max(1, defaultCars);
    profile.capacity = Math.max(0, Math.round(sourceModel.capacity * ratio));
    profile.freight = Math.max(0, Math.round((sourceModel.freight || 0) * Math.min(1.2, 0.65 + composition.passengerCars * 0.08)));
    profile.speed = Math.max(30, Math.round(sourceModel.speed * (1 - Math.max(0, ratio - 1) * 0.03)));
    profile.energy = round2(sourceModel.energy * (0.72 + ratio * 0.28 + Math.max(0, ratio - 1) * 0.08));
    profile.maintenance = round2(sourceModel.maintenance * (0.76 + ratio * 0.24 + Math.max(0, ratio - 1) * 0.05));
    profile.reliability = clamp(sourceModel.reliability - Math.max(0, ratio - 1) * 0.02, 0.45, 0.995);
    profile.comfort = clamp(sourceModel.comfort + Math.min(0.06, Math.max(0, ratio - 1) * 0.015), 0.08, 1);
    profile.capacity = Math.max(0, Math.round(profile.capacity * variant.capacityMultiplier));
    profile.speed = Math.max(30, Math.round(profile.speed * variant.speedMultiplier));
    profile.energy = round2(profile.energy * variant.energyMultiplier);
    profile.maintenance = round2(profile.maintenance * variant.maintenanceMultiplier);
    profile.reliability = clamp(profile.reliability + variant.reliabilityDelta, 0.45, 0.995);
    profile.comfort = clamp(profile.comfort + variant.comfortDelta, 0.08, 1);
    profile.variant = { id: variant.id, name: variant.name, shortLabel: variant.shortLabel, asset: variant.asset };
    profile.compositionSummary = `${composition.passengerCars} voiture(s) · ${variant.shortLabel}`;
    return profile;
  }
  const variant = compositionVariantForMode('freight_loco', composition.freightVariant);
  const defaultWagons = spec.freightCars.default;
  const ratio = composition.freightCars / Math.max(1, defaultWagons);
  profile.freight = Math.max(0, Math.round(sourceModel.freight * ratio));
  profile.capacity = Math.max(0, Math.round((sourceModel.capacity || 0) * Math.max(0.4, 1 - Math.max(0, ratio - 1) * 0.18)));
  profile.speed = Math.max(25, Math.round(sourceModel.speed * (1 - Math.max(0, ratio - 1) * 0.035)));
  profile.energy = round2(sourceModel.energy * (0.7 + ratio * 0.3 + Math.max(0, ratio - 1) * 0.1));
  profile.maintenance = round2(sourceModel.maintenance * (0.74 + ratio * 0.26 + Math.max(0, ratio - 1) * 0.06));
  profile.reliability = clamp(sourceModel.reliability - Math.max(0, ratio - 1) * 0.022, 0.45, 0.995);
  profile.comfort = clamp(sourceModel.comfort - Math.max(0, ratio - 1) * 0.01, 0.05, 1);
  profile.freight = Math.max(0, Math.round(profile.freight * variant.capacityMultiplier));
  profile.speed = Math.max(25, Math.round(profile.speed * variant.speedMultiplier));
  profile.energy = round2(profile.energy * variant.energyMultiplier);
  profile.maintenance = round2(profile.maintenance * variant.maintenanceMultiplier);
  profile.reliability = clamp(profile.reliability + variant.reliabilityDelta, 0.45, 0.995);
  profile.freightRevenueMultiplier = variant.revenueMultiplier || 1;
  profile.variant = { id: variant.id, name: variant.name, shortLabel: variant.shortLabel, cargoType: variant.cargoType || null, asset: variant.asset };
  profile.compositionSummary = `${composition.freightCars} wagon(s) · ${variant.shortLabel}`;
  return profile;
}

function publicTrain(train, player = null) {
  const model = BALANCE.trains[train.modelId];
  if (!model) return train;
  const profile = getTrainOperatingProfile(train, model, player);
  return {
    ...train,
    composition: profile.composition,
    compositionMode: profile.compositionMode,
    compositionSpec: profile.compositionSpec,
    compositionSummary: profile.compositionSummary,
    profile: {
      capacity: profile.capacity,
      freight: profile.freight,
      speed: profile.speed,
      range: profile.range,
      energy: profile.energy,
      maintenance: profile.maintenance,
      reliability: profile.reliability,
      comfort: profile.comfort,
      variant: profile.variant || null,
      freightRevenueMultiplier: profile.freightRevenueMultiplier || 1
    }
  };
}

function createTrainInstance(modelId, ownerId) {
  const train = {
    id: crypto.randomUUID(),
    modelId,
    ownerId,
    condition: 0.96,
    age: 0,
    acquiredDay: state.day || 1,
    maintenance: { active: false, mode: null, daysLeft: 0, duration: 0, targetCondition: 0, lastServiceDay: state.day || 1 }
  };
  const model = BALANCE.trains[modelId];
  if (model) ensureTrainComposition(train, model);
  return train;
}

function normalizeTrain(raw, ownerId) {
  if (!raw || typeof raw !== 'object') return null;
  raw.id = raw.id || crypto.randomUUID();
  raw.ownerId = raw.ownerId || ownerId;
  raw.condition = clamp(Number(raw.condition ?? 0.9), 0.05, 1);
  raw.age = Math.max(0, Math.floor(Number(raw.age || 0)));
  raw.acquiredDay = raw.acquiredDay || state.day || 1;
  const m = raw.maintenance && typeof raw.maintenance === 'object' ? raw.maintenance : {};
  raw.maintenance = {
    active: Boolean(m.active),
    mode: m.mode || null,
    label: m.label || null,
    daysLeft: Math.max(0, Math.floor(Number(m.daysLeft || 0))),
    duration: Math.max(0, Math.floor(Number(m.duration || 0))),
    targetCondition: clamp(Number(m.targetCondition || 0), 0, 1),
    startedDay: m.startedDay || null,
    cost: Math.round(Number(m.cost || 0)),
    lastServiceDay: m.lastServiceDay || raw.acquiredDay
  };
  const model = BALANCE.trains[raw.modelId];
  if (model) ensureTrainComposition(raw, model);
  if (raw.maintenance.active && raw.maintenance.daysLeft <= 0) raw.maintenance.active = false;
  return raw;
}


function createLineInstance(player, stops, trainId, service, frequency, ticketPrice) {
  const normalizedStops = sanitizeStopsPayload(stops, null, null);
  const count = player.lines.length + 1;
  return normalizeLine({
    id: crypto.randomUUID(),
    code: `${player.name.substring(0, 3).toUpperCase()}-${String(count).padStart(3, '0')}`,
    from: normalizedStops[0],
    to: normalizedStops[normalizedStops.length - 1],
    stops: normalizedStops,
    trainId,
    service,
    frequency,
    ticketPrice,
    tariff: tariffFromTicketPrice(ticketPrice, routeBetweenStops(normalizedStops).distance),
    active: true,
    electrified: false,
    createdDay: state.day,
    stats: { passengers: 0, freightTons: 0, revenue: 0, expenses: 0, profit: 0, punctuality: 100, satisfaction: 50, share: 0 }
  });
}

function lineStops(line) {
  const raw = Array.isArray(line?.stops) && line.stops.length ? line.stops : [line?.from, line?.to];
  return [...new Set(raw.map(id => String(id || '').trim()).filter(Boolean))];
}

function sanitizeStopsPayload(rawStops, from, to) {
  const base = Array.isArray(rawStops) && rawStops.length ? rawStops : [from, to];
  const cleaned = [];
  for (const id of base) {
    const value = String(id || '').trim();
    if (!value) continue;
    if (!cleaned.length || cleaned[cleaned.length - 1] !== value) cleaned.push(value);
  }
  return cleaned;
}

function validateLineStops(stops) {
  if (!Array.isArray(stops) || stops.length < 2) return 'Une ligne doit comporter au moins 2 arrêts.';
  if (new Set(stops).size < 2) return 'Les arrêts de la ligne doivent être différents.';
  for (const stopId of stops) {
    if (!stationById(stopId)) return `Arrêt invalide : ${stopId}.`;
  }
  return '';
}

function stationOwnerInfo(stationId) {
  for (const candidate of Object.values(state.players || {})) {
    if (candidate?.stations?.[stationId]) {
      return { player: candidate, asset: normalizeStationAsset(candidate, stationId) };
    }
  }
  const custom = state.customStations?.[stationId];
  if (custom?.ownerId && state.players[custom.ownerId]) {
    const owner = state.players[custom.ownerId];
    return { player: owner, asset: ensureStationAsset(owner, stationId) };
  }
  return null;
}

function lineStopsOwnershipProblem(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
  for (const stopId of ids) {
    const station = stationById(stopId);
    if (!station) return `Arrêt invalide : ${stopId}.`;
    if (!stationOwnerInfo(stopId)) {
      return `Impossible d’ouvrir cette ligne : ${station.name} n’appartient à aucune compagnie. Achète d’abord cette ville dans l’onglet Gares.`;
    }
  }
  return '';
}

function computePassageRights(player, line, model, distance) {
  const stops = lineStops(line);
  const external = [];
  for (const stopId of stops) {
    const owner = stationOwnerInfo(stopId);
    if (!owner || owner.player.id === player.id) continue;
    external.push({ stationId: stopId, owner: owner.player, asset: owner.asset });
  }
  if (!external.length) return { total: 0, allocations: [] };

  const base = 0.018 * distance * line.frequency * (model.capacity + model.freight * 0.8);
  const total = base * (external.length / Math.max(1, stops.length));
  const weighted = external.map(item => ({
    ...item,
    weight: 1 + (item.asset.level || 1) * 0.18 + (item.asset.commerce || 0) * 0.08 + (item.asset.maintenance || 0) * 0.05
  }));
  const weightSum = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;
  const byOwner = new Map();

  for (const item of weighted) {
    const amount = total * item.weight / weightSum;
    const prev = byOwner.get(item.owner.id) || { ownerId: item.owner.id, amount: 0, stations: [] };
    prev.amount += amount;
    prev.stations.push(item.stationId);
    byOwner.set(item.owner.id, prev);
  }

  return {
    total,
    allocations: [...byOwner.values()].map(item => ({
      ...item,
      amount: Math.round(item.amount)
    }))
  };
}

function recordPassageRights(ledger, payer, line, rights) {
  if (!ledger || !rights?.allocations?.length) return;
  for (const allocation of rights.allocations) {
    if (!allocation.amount || allocation.amount <= 0) continue;
    const current = ledger.get(allocation.ownerId) || { revenue: 0, lines: 0 };
    current.revenue += allocation.amount;
    current.lines += 1;
    ledger.set(allocation.ownerId, current);
  }
}

function applyPassageRightsLedger(ledger) {
  if (!ledger) return;
  for (const [ownerId, entry] of ledger.entries()) {
    const owner = state.players[ownerId];
    const amount = Math.round(entry.revenue || 0);
    if (!owner || amount <= 0) continue;
    owner.cash += amount;
    owner.stats.revenue += amount;
    owner.stats.profit += amount;
    owner.stats.lastRevenue += amount;
    owner.stats.lastProfit += amount;
  }
}

function normalizeLine(line) {
  if (!line || typeof line !== 'object') return line;
  const stops = sanitizeStopsPayload(line.stops, line.from, line.to);
  line.stops = stops.length >= 2 ? stops : [line.from, line.to].filter(Boolean);
  line.from = line.stops[0];
  line.to = line.stops[line.stops.length - 1];
  line.name = lineRouteName(line.stops);
  if (!line.stats) line.stats = { passengers: 0, freightTons: 0, revenue: 0, expenses: 0, profit: 0, punctuality: 100, satisfaction: 50, share: 0 };
  const distance = lineDistance(line);
  setLineTicketPrice(line, lineTicketPrice(line, distance), distance);
  return line;
}

function lineRouteName(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.length < 2) return 'Ligne';
  const first = stationById(ids[0])?.name || ids[0];
  const last = stationById(ids[ids.length - 1])?.name || ids[ids.length - 1];
  return `${first} → ${last}`;
}

function lineDistance(line) {
  return routeBetweenStops(lineStops(line)).distance;
}

function lineRouteInfo(line) {
  return routeBetweenStops(lineStops(line));
}

function lineStopsNames(stops) {
  return stops.map(id => stationById(id)?.name || id).join(' → ');
}

function routeDistanceForStopOrder(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
  let total = 0;
  for (let i = 1; i < ids.length; i++) total += distanceBetween(ids[i - 1], ids[i]);
  return total;
}

function bestIntermediateInsertIndex(stops, stopId) {
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.length < 2) return Math.max(0, ids.length - 1);
  let bestIndex = 0;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ids.length - 1; i++) {
    const before = ids[i];
    const after = ids[i + 1];
    const added = distanceBetween(before, stopId) + distanceBetween(stopId, after) - distanceBetween(before, after);
    if (added < bestCost) {
      bestCost = added;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function insertStopAtBestIntermediatePosition(stops, stopId) {
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.includes(stopId)) return ids;
  if (ids.length < 2) return [...ids, stopId];
  const index = bestIntermediateInsertIndex(ids, stopId);
  return [...ids.slice(0, index + 1), stopId, ...ids.slice(index + 1)];
}

function coherentStopOrder(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.length <= 2) return ids;

  const originalDistance = routeDistanceForStopOrder(ids);
  let best = ids;
  let bestDistance = originalDistance;

  function visit(prefix, remaining) {
    if (!remaining.length) {
      const d = routeDistanceForStopOrder(prefix);
      if (d > 0 && d < bestDistance) {
        bestDistance = d;
        best = [...prefix];
      }
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      visit([...prefix, remaining[i]], [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
    }
  }

  if (ids.length <= 7) {
    // On garde le premier arrêt, puis on cherche l’ordre le plus continu.
    // Exemple corrigé : Nantes → La Roche-sur-Yon → Montaigu devient
    // Nantes → Montaigu → La Roche-sur-Yon.
    visit([ids[0]], ids.slice(1));
  } else {
    let ordered = [ids[0]];
    const remaining = ids.slice(1);
    while (remaining.length) {
      let bestIndex = 0;
      let bestCost = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i++) {
        const d = distanceBetween(ordered[ordered.length - 1], remaining[i]);
        if (d < bestCost) {
          bestCost = d;
          bestIndex = i;
        }
      }
      ordered.push(remaining.splice(bestIndex, 1)[0]);
    }
    const d = routeDistanceForStopOrder(ordered);
    if (d > 0 && d < bestDistance) {
      bestDistance = d;
      best = ordered;
    }
  }

  return bestDistance < originalDistance * 0.96 ? best : ids;
}

function ensureStationAsset(player, stationId) {
  if (!player.stations || typeof player.stations !== 'object') player.stations = {};
  if (!player.stations[stationId]) player.stations[stationId] = { level: 1, depot: false, commerce: 0, maintenance: 0, electrified: false };
  return normalizeStationAsset(player, stationId);
}

function normalizeStationAsset(player, stationId) {
  const raw = player.stations[stationId] || {};
  const asset = {
    level: clamp(Math.floor(Number(raw.level || 1)), 1, 5),
    depot: Boolean(raw.depot),
    commerce: clamp(Math.floor(Number(raw.commerce || 0)), 0, 4),
    maintenance: clamp(Math.floor(Number(raw.maintenance || 0)), 0, 4),
    electrified: Boolean(raw.electrified)
  };
  player.stations[stationId] = asset;
  return asset;
}

function stationCapacityFactor(player, stationId) {
  const asset = player.stations[stationId];
  if (!asset) return 0.75;
  const techBoost = (hasTech(player, 'passenger_flow') ? 0.05 : 0) + (hasTech(player, 'intermodal_hubs') ? 0.04 : 0);
  return clamp(0.75 + asset.level * 0.1 + asset.maintenance * 0.025 + techBoost, 0.65, 1.45);
}


function averageCommerce(player, lineOrA, maybeB) {
  const ids = Array.isArray(lineOrA) ? lineOrA : (typeof lineOrA === 'object' && lineOrA?.id ? lineStops(lineOrA) : [lineOrA, maybeB]);
  const values = ids.map(id => player.stations[id]?.commerce || 0);
  return 1 + (values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length));
}

function averageStationLevel(player, lineOrA, maybeB) {
  const ids = Array.isArray(lineOrA) ? lineOrA : (typeof lineOrA === 'object' && lineOrA?.id ? lineStops(lineOrA) : [lineOrA, maybeB]);
  const values = ids.map(id => player.stations[id]?.level || 0);
  return values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
}

function lineStationFactor(player, line) {
  const ids = lineStops(line);
  const factors = ids.map(id => stationCapacityFactor(player, id));
  const minFactor = Math.min(...factors);
  const avgFactor = factors.reduce((sum, v) => sum + v, 0) / Math.max(1, factors.length);
  return clamp(minFactor * 0.65 + avgFactor * 0.35, 0.6, 1.4);
}

function techNodeById(nodeId) {
  for (const group of Object.values(BALANCE.techTree || {})) {
    const found = (group.nodes || []).find(n => n.id === nodeId);
    if (found) return found;
  }
  return null;
}

function totalMaintenance(player) {
  return Object.values(player.stations).reduce((sum, a) => sum + (a.maintenance || 0), 0);
}

function currentPriceMultiplier(player, energyType) {
  return 1 + Math.max(0, state.market.steel - 1) * 0.35 + (energyType === 'electricity' ? Math.max(0, state.market.electricity - 0.34) * 0.1 : 0);
}

function canPay(player, amount) {
  return player.cash >= amount;
}

function notify(player, text) {
  player.notifications.push({ day: state.day, text });
  player.notifications = player.notifications.slice(-40);
}

function ok(message = 'Action réalisée.') { return { ok: true, message }; }
function fail(error, hint = '') { return { ok: false, error, hint }; }

function scorePlayer(player) {
  return player.cash * 0.01 - player.debt * 0.006 + player.reputation * 800 + player.stats.passengers * 0.04 + player.stats.freightTons * 0.08 + player.lines.filter(l => l.active).length * 2000 + player.epoch * 45000;
}

function routeKey(from, to, service) {
  const sorted = [from, to].sort().join('-');
  const market = service === 'mixed' ? 'mixed' : service;
  return `${sorted}:${market}`;
}

function nearestStation(stationId, maxKm, preferredRegion) {
  const origin = stationById(stationId);
  if (!origin) return null;
  const candidates = WORLD.stations
    .filter(s => s.id !== stationId)
    .map(s => ({ ...s, dist: distanceBetween(stationId, s.id), sameRegion: s.region === preferredRegion }))
    .filter(s => s.dist <= maxKm || s.sameRegion)
    .sort((a, b) => (b.sameRegion - a.sameRegion) || a.dist - b.dist);
  return candidates[0] || null;
}

function stationById(id) {
  return WORLD.stationIndex[id] || communeCache.byId?.[id] || state.customStations?.[id] || null;
}


function routeAdjacencyFor(a, b) {
  const adjacency = {};
  for (const [id, list] of Object.entries(WORLD.railAdjacency || {})) adjacency[id] = [...list];

  for (const id of [a, b]) {
    if (!id || WORLD.stationIndex[id]) continue;
    const station = stationById(id);
    if (!station) continue;
    adjacency[id] ||= [];
    const nearest = WORLD.stations
      .map(s => ({ id: s.id, d: haversine(station.lat, station.lon, s.lat, s.lon) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, station.commune ? 4 : 3);
    for (const n of nearest) {
      adjacency[id].push(n.id);
      (adjacency[n.id] ||= []).push(id);
    }
  }
  return adjacency;
}

const _routeCache = new Map();


function distanceBetween(a, b) {
  return routeBetween(a, b).distance;
}

function routeBetweenStops(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.length < 2) return { ids, distance: 0, maxSegment: 0 };
  const key = `multi::${ids.join('::')}`;
  if (_routeCache.has(key)) return _routeCache.get(key);

  let mergedIds = [ids[0]];
  let distance = 0;
  let maxSegment = 0;

  for (let i = 1; i < ids.length; i++) {
    const segment = routeBetween(ids[i - 1], ids[i]);
    distance += segment.distance || 0;
    maxSegment = Math.max(maxSegment, segment.maxSegment || 0);
    const segIds = segment.ids?.length ? segment.ids : [ids[i - 1], ids[i]];
    mergedIds.push(...segIds.slice(1));
  }

  const route = { ids: mergedIds, distance: Math.round(distance), maxSegment: Math.round(maxSegment) };
  _routeCache.set(key, route);
  return route;
}

function routeBetween(a, b) {
  if (a === b) return { ids: [a], distance: 0, maxSegment: 0 };
  const key = `${a}::${b}`;
  if (_routeCache.has(key)) return _routeCache.get(key);
  const reverseKey = `${b}::${a}`;
  if (_routeCache.has(reverseKey)) {
    const reverse = _routeCache.get(reverseKey);
    const route = { ...reverse, ids: [...reverse.ids].reverse() };
    _routeCache.set(key, route);
    return route;
  }

  const adjacency = routeAdjacencyFor(a, b);
  const nodes = new Set([...Object.keys(adjacency), a, b]);
  const dist = {};
  const prev = {};
  const visited = new Set();

  for (const n of nodes) dist[n] = Number.POSITIVE_INFINITY;
  dist[a] = 0;

  while (visited.size < nodes.size) {
    let u = null;
    let best = Number.POSITIVE_INFINITY;
    for (const n of nodes) {
      if (!visited.has(n) && dist[n] < best) {
        best = dist[n];
        u = n;
      }
    }
    if (!u || u === b || !Number.isFinite(best)) break;
    visited.add(u);

    for (const v of adjacency[u] || []) {
      if (visited.has(v)) continue;
      const alt = dist[u] + edgeDistance(u, v);
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }

  let ids = [];
  if (Number.isFinite(dist[b])) {
    let cur = b;
    ids.push(cur);
    while (prev[cur]) {
      cur = prev[cur];
      ids.push(cur);
    }
    ids.reverse();
  } else {
    ids = [a, b];
    dist[b] = edgeDistance(a, b);
  }

  let maxSegment = 0;
  for (let i = 1; i < ids.length; i++) {
    maxSegment = Math.max(maxSegment, edgeDistance(ids[i - 1], ids[i]));
  }

  const route = {
    ids,
    distance: Math.round(dist[b] || 0),
    maxSegment: Math.round(maxSegment || 0)
  };
  _routeCache.set(key, route);
  return route;
}

function effectiveTrainRange(player, model, routeInfo) {
  return Math.max(1, Math.round(Number(model?.range || 0)));
}

function edgeDistance(a, b) {
  const sa = stationById(a);
  const sb = stationById(b);
  if (!sa || !sb) return 0;
  return haversine(sa.lat, sa.lon, sb.lat, sb.lon);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function randomColor() {
  const colors = ['#60a5fa', '#f97316', '#22c55e', '#e879f9', '#f43f5e', '#facc15', '#14b8a6', '#a78bfa'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function sanitizeCompanyLogo(value) {
  const id = String(value || '').trim();
  return COMPANY_LOGOS.includes(id) ? id : COMPANY_LOGOS[0];
}

function validateColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : null;
}

function cleanText(value, max) {
  return String(value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) || 'Compagnie';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) { return Math.round(value * 100) / 100; }
function money(value) { return `${Math.round(value).toLocaleString('fr-FR')} €`; }
function formatCycles(value) {
  const cycles = Math.max(1, Math.ceil(Number(value || 1)));
  return cycles <= 1 ? '1 cycle' : `${cycles} cycles`;
}

function buildBalance() {
  const epochs = [
    { id: 0, name: 'Ère de la vapeur', year: 1850, requiredTech: 0, requiredTraffic: 0 },
    { id: 1, name: 'Ère du diesel', year: 1930, requiredTech: 4, requiredTraffic: 30000 },
    { id: 2, name: 'Ère de l’électrique', year: 1950, requiredTech: 9, requiredTraffic: 110000 },
    { id: 3, name: 'Ère de la grande vitesse', year: 1980, requiredTech: 17, requiredTraffic: 350000 },
    { id: 4, name: 'Ère de l’hydrogène', year: 2025, requiredTech: 28, requiredTraffic: 900000 },
    { id: 5, name: 'Ère de la batterie', year: 2035, requiredTech: 42, requiredTraffic: 1800000 },
    { id: 6, name: 'Ère de la sustentation magnétique', year: 2050, requiredTech: 58, requiredTraffic: 3200000 }
  ];
  const trains = {
    steam_030_mixte: { id: 'steam_030_mixte', name: 'Locomotive vapeur 030 mixte', unlockEpoch: 0, type: 'Vapeur mixte', speed: 55, capacity: 140, freight: 120, energyType: 'coal', energy: 9.5, maintenance: 0.62, price: 95000, reliability: 0.78, comfort: 0.32, range: 50, description: 'Modèle de départ polyvalent, lent mais économique pour ouvrir les premières lignes.', requiredTech: 'steam_first_locomotives', requiredTechLevel: 1 },
    steam_120_omnibus: { id: 'steam_120_omnibus', name: 'Locomotive vapeur 120 omnibus', unlockEpoch: 0, type: 'Vapeur voyageurs', speed: 70, capacity: 210, freight: 60, energyType: 'coal', energy: 10.8, maintenance: 0.66, price: 135000, reliability: 0.75, comfort: 0.38, range: 75, description: 'Vapeur de desserte voyageurs, adaptée aux lignes régionales naissantes.', requiredTech: 'steam_first_locomotives', requiredTechLevel: 3 },
    steam_040_freight: { id: 'steam_040_freight', name: 'Locomotive vapeur 040 marchandises', unlockEpoch: 0, type: 'Vapeur fret', speed: 45, capacity: 40, freight: 360, energyType: 'coal', energy: 13.2, maintenance: 0.74, price: 155000, reliability: 0.8, comfort: 0.22, range: 90, description: 'Machine lente et tractrice pour les premiers trafics de marchandises.', requiredTech: 'steam_freight_locomotives', requiredTechLevel: 4 },
    steam_220_express: { id: 'steam_220_express', name: 'Locomotive vapeur 220 express', unlockEpoch: 0, type: 'Vapeur express', speed: 95, capacity: 300, freight: 80, energyType: 'coal', energy: 14.2, maintenance: 0.86, price: 235000, reliability: 0.79, comfort: 0.48, range: 125, description: 'Vapeur rapide pour les grands axes voyageurs de l’ère vapeur.', requiredTech: 'steam_passenger_locomotives', requiredTechLevel: 5 },
    steam_241_articulated: { id: 'steam_241_articulated', name: 'Locomotive vapeur articulée 241', unlockEpoch: 0, type: 'Vapeur lourde articulée', speed: 90, capacity: 420, freight: 520, energyType: 'coal', energy: 17.0, maintenance: 1.02, price: 390000, reliability: 0.82, comfort: 0.5, range: 150, description: 'Matériel vapeur lourd de fin d’ère, puissant mais coûteux à entretenir.', requiredTech: 'steam_articulated_locomotives', requiredTechLevel: 8 },

    diesel_shunter_030: { id: 'diesel_shunter_030', name: 'Locotracteur diesel de manœuvre', unlockEpoch: 1, type: 'Diesel manœuvre', speed: 70, capacity: 40, freight: 420, energyType: 'diesel', energy: 6.0, maintenance: 0.43, price: 310000, reliability: 0.83, comfort: 0.24, range: 125, description: 'Engin simple et fiable pour manœuvres, embranchements et fret court.', requiredTech: 'diesel_shunters', requiredTechLevel: 1 },
    diesel_light_railcar: { id: 'diesel_light_railcar', name: 'Autorail diesel léger', unlockEpoch: 1, type: 'Autorail diesel', speed: 110, capacity: 160, freight: 0, energyType: 'diesel', energy: 4.8, maintenance: 0.4, price: 420000, reliability: 0.86, comfort: 0.56, range: 150, description: 'Matériel économique pour lignes secondaires non électrifiées.', requiredTech: 'diesel_light_railcars', requiredTechLevel: 3 },
    diesel_mechanical_regional: { id: 'diesel_mechanical_regional', name: 'Automotrice diesel mécanique', unlockEpoch: 1, type: 'Diesel régional', speed: 125, capacity: 230, freight: 20, energyType: 'diesel', energy: 5.4, maintenance: 0.44, price: 650000, reliability: 0.87, comfort: 0.62, range: 175, description: 'Rame régionale diesel plus capacitaire, efficace hors caténaire.', requiredTech: 'diesel_mechanical', requiredTechLevel: 4 },
    diesel_hydraulic_express: { id: 'diesel_hydraulic_express', name: 'Locomotive diesel hydraulique voyageurs', unlockEpoch: 1, type: 'Diesel voyageurs', speed: 150, capacity: 430, freight: 120, energyType: 'diesel', energy: 7.2, maintenance: 0.56, price: 1150000, reliability: 0.88, comfort: 0.66, range: 210, description: 'Locomotive diesel rapide pour relations voyageurs sans électrification.', requiredTech: 'diesel_passenger_locomotives', requiredTechLevel: 6 },
    diesel_electric_freight: { id: 'diesel_electric_freight', name: 'Locomotive diesel-électrique fret', unlockEpoch: 1, type: 'Diesel-électrique fret', speed: 110, capacity: 0, freight: 950, energyType: 'diesel', energy: 8.8, maintenance: 0.58, price: 1450000, reliability: 0.9, comfort: 0.2, range: 250, description: 'Fret lourd non électrifié, performant sur longues distances.', requiredTech: 'diesel_freight_locomotives', requiredTechLevel: 8 },

    electric_pioneer_loco: { id: 'electric_pioneer_loco', name: 'Locomotive électrique pionnière', unlockEpoch: 2, type: 'Électrique pionnière', speed: 115, capacity: 260, freight: 180, energyType: 'electricity', energy: 6.4, maintenance: 0.55, price: 520000, reliability: 0.84, comfort: 0.5, range: 250, description: 'Premier matériel électrique polyvalent pour lignes équipées.', requiredTech: 'electric_first_trains', requiredTechLevel: 1 },
    electric_third_rail_emu: { id: 'electric_third_rail_emu', name: 'Automotrice troisième rail', unlockEpoch: 2, type: 'Électrique urbain', speed: 100, capacity: 520, freight: 0, energyType: 'electricity', energy: 5.2, maintenance: 0.42, price: 980000, reliability: 0.88, comfort: 0.56, range: 280, description: 'Rame dense pour dessertes urbaines et périurbaines électrifiées.', requiredTech: 'electric_third_rail', requiredTechLevel: 3 },
    electric_dc_regional_emu: { id: 'electric_dc_regional_emu', name: 'Automotrice courant continu régionale', unlockEpoch: 2, type: 'Électrique régionale', speed: 160, capacity: 430, freight: 0, energyType: 'electricity', energy: 5.6, maintenance: 0.38, price: 1250000, reliability: 0.91, comfort: 0.68, range: 320, description: 'Rame régionale performante sur réseau électrifié continu.', requiredTech: 'electric_dc_catenary', requiredTechLevel: 4 },
    electric_dual_current_loco: { id: 'electric_dual_current_loco', name: 'Locomotive bicourant multiservice', unlockEpoch: 2, type: 'Électrique bicourant', speed: 200, capacity: 520, freight: 520, energyType: 'electricity', energy: 8.2, maintenance: 0.64, price: 4200000, reliability: 0.92, comfort: 0.7, range: 360, description: 'Locomotive voyageurs/fret capable de passer entre réseaux électriques.', requiredTech: 'electric_dual_current_trains', requiredTechLevel: 6 },
    electric_heavy_freight: { id: 'electric_heavy_freight', name: 'Locomotive électrique fret lourd', unlockEpoch: 2, type: 'Fret électrique', speed: 140, capacity: 0, freight: 1450, energyType: 'electricity', energy: 9.5, maintenance: 0.62, price: 5100000, reliability: 0.93, comfort: 0.22, range: 400, description: 'Fret lourd électrifié avec très bonne fiabilité et coût énergétique bas.', requiredTech: 'electric_locomotives', requiredTechLevel: 8 },

    hsv_intercity_200: { id: 'hsv_intercity_200', name: 'Train rapide Intercités 200', unlockEpoch: 3, type: 'Train rapide', speed: 200, capacity: 560, freight: 60, energyType: 'electricity', energy: 7.2, maintenance: 0.5, price: 1800000, reliability: 0.9, comfort: 0.72, range: 350, description: 'Matériel de transition vers la grande vitesse, adapté aux grands axes classiques.', requiredTech: 'hsv_first_fast_trains', requiredTechLevel: 1 },
    hsv_trainset_pioneer: { id: 'hsv_trainset_pioneer', name: 'Rame grande vitesse première génération', unlockEpoch: 3, type: 'Grande vitesse', speed: 300, capacity: 690, freight: 0, energyType: 'electricity', energy: 13.5, maintenance: 1.1, price: 14500000, reliability: 0.93, comfort: 0.82, range: 450, description: 'Première rame très rapide, chère mais structurante pour les grands axes.', requiredTech: 'hsv_trainsets', requiredTechLevel: 3 },
    hsv_duplex_capacity: { id: 'hsv_duplex_capacity', name: 'Rame grande vitesse Duplex', unlockEpoch: 3, type: 'Grande vitesse haute capacité', speed: 320, capacity: 1030, freight: 0, energyType: 'electricity', energy: 15.2, maintenance: 1.25, price: 23000000, reliability: 0.94, comfort: 0.86, range: 550, description: 'Grande vitesse à très forte capacité pour axes saturés.', requiredTech: 'hsv_trainsets', requiredTechLevel: 5 },
    hsv_distributed_trainset: { id: 'hsv_distributed_trainset', name: 'Rame grande vitesse à traction répartie', unlockEpoch: 3, type: 'Grande vitesse avancée', speed: 330, capacity: 820, freight: 0, energyType: 'electricity', energy: 13.8, maintenance: 1.05, price: 26000000, reliability: 0.95, comfort: 0.87, range: 625, description: 'Rame de grande vitesse plus efficace grâce à la traction répartie.', requiredTech: 'hsv_distributed_traction', requiredTechLevel: 6 },
    hsv_premium_long_distance: { id: 'hsv_premium_long_distance', name: 'Rame grande distance premium', unlockEpoch: 3, type: 'Grande vitesse premium', speed: 320, capacity: 620, freight: 0, energyType: 'electricity', energy: 14.6, maintenance: 1.18, price: 28500000, reliability: 0.95, comfort: 0.94, range: 700, description: 'Matériel très confortable pour relations longues distances à forte marge.', requiredTech: 'hsv_premium_long_distance', requiredTechLevel: 8 },

    hydrogen_regional_unit: { id: 'hydrogen_regional_unit', name: 'Rame hydrogène régionale', unlockEpoch: 4, type: 'Hydrogène régional', speed: 140, capacity: 300, freight: 0, energyType: 'hydrogen', energy: 4.2, maintenance: 0.36, price: 6200000, reliability: 0.9, comfort: 0.76, range: 250, description: 'Rame propre pour lignes non électrifiées à autonomie correcte.', requiredTech: 'hydrogen_regional_trains', requiredTechLevel: 1 },
    hydrogen_fuel_cell_unit: { id: 'hydrogen_fuel_cell_unit', name: 'Rame hydrogène à pile combustible', unlockEpoch: 4, type: 'Hydrogène optimisé', speed: 150, capacity: 330, freight: 20, energyType: 'hydrogen', energy: 3.9, maintenance: 0.34, price: 7400000, reliability: 0.92, comfort: 0.78, range: 310, description: 'Chaîne hydrogène plus efficace et plus fiable pour dessertes régionales.', requiredTech: 'hydrogen_fuel_cell', requiredTechLevel: 3 },
    hydrogen_rural_unit: { id: 'hydrogen_rural_unit', name: 'Rame hydrogène lignes rurales', unlockEpoch: 4, type: 'Hydrogène rural', speed: 130, capacity: 220, freight: 30, energyType: 'hydrogen', energy: 3.4, maintenance: 0.3, price: 5600000, reliability: 0.91, comfort: 0.72, range: 350, description: 'Matériel sobre pour lignes peu denses et longues antennes rurales.', requiredTech: 'hydrogen_rural_lines', requiredTechLevel: 4 },
    hydrogen_long_range_unit: { id: 'hydrogen_long_range_unit', name: 'Rame hydrogène longue distance', unlockEpoch: 4, type: 'Hydrogène longue distance', speed: 170, capacity: 420, freight: 40, energyType: 'hydrogen', energy: 4.6, maintenance: 0.42, price: 9800000, reliability: 0.92, comfort: 0.82, range: 425, description: 'Autonomie élevée pour itinéraires non électrifiés de grande longueur.', requiredTech: 'hydrogen_long_distance_tanks', requiredTechLevel: 6 },
    hydrogen_next_gen_unit: { id: 'hydrogen_next_gen_unit', name: 'Rame hydrogène nouvelle génération', unlockEpoch: 4, type: 'Hydrogène avancé', speed: 180, capacity: 480, freight: 60, energyType: 'hydrogen', energy: 3.7, maintenance: 0.36, price: 13200000, reliability: 0.94, comfort: 0.84, range: 500, description: 'Hydrogène late game : propre, fiable et adapté aux longues relations régionales.', requiredTech: 'hydrogen_next_generation', requiredTechLevel: 8 },

    battery_suburban_unit: { id: 'battery_suburban_unit', name: 'Rame batterie périurbaine', unlockEpoch: 5, type: 'Batterie périurbaine', speed: 140, capacity: 380, freight: 0, energyType: 'battery', energy: 3.7, maintenance: 0.24, price: 5400000, reliability: 0.95, comfort: 0.82, range: 150, description: 'Rame à batterie pour courtes antennes non électrifiées autour des pôles urbains.', requiredTech: 'battery_suburban_trains', requiredTechLevel: 1 },
    battery_regional_unit: { id: 'battery_regional_unit', name: 'Rame batterie régionale', unlockEpoch: 5, type: 'Batterie régionale', speed: 160, capacity: 420, freight: 0, energyType: 'battery', energy: 3.9, maintenance: 0.25, price: 6900000, reliability: 0.95, comfort: 0.84, range: 220, description: 'Rame régionale à batterie pour lignes partiellement électrifiées.', requiredTech: 'battery_regional_trains', requiredTechLevel: 3 },
    battery_fast_charge_unit: { id: 'battery_fast_charge_unit', name: 'Rame batterie recharge rapide', unlockEpoch: 5, type: 'Batterie recharge rapide', speed: 160, capacity: 460, freight: 0, energyType: 'battery', energy: 3.6, maintenance: 0.26, price: 7600000, reliability: 0.94, comfort: 0.84, range: 280, description: 'Exploite les gares équipées pour réduire les temps de recharge.', requiredTech: 'battery_fast_station_charging', requiredTechLevel: 4 },
    battery_modular_unit: { id: 'battery_modular_unit', name: 'Rame batterie modulaire', unlockEpoch: 5, type: 'Batterie modulaire', speed: 165, capacity: 500, freight: 80, energyType: 'battery', energy: 3.8, maintenance: 0.23, price: 8600000, reliability: 0.96, comfort: 0.86, range: 340, description: 'Architecture modulaire, plus fiable et plus simple à adapter au service.', requiredTech: 'battery_modular', requiredTechLevel: 6 },
    battery_high_density_unit: { id: 'battery_high_density_unit', name: 'Rame batterie haute densité', unlockEpoch: 5, type: 'Batterie haute densité', speed: 180, capacity: 560, freight: 100, energyType: 'battery', energy: 3.5, maintenance: 0.24, price: 11800000, reliability: 0.96, comfort: 0.88, range: 400, description: 'Batterie avancée à forte autonomie, adaptée aux services régionaux ambitieux.', requiredTech: 'battery_high_density', requiredTechLevel: 8 },

    maglev_shuttle_pioneer: { id: 'maglev_shuttle_pioneer', name: 'Navette maglev pionnière', unlockEpoch: 6, type: 'Maglev pionnier', speed: 360, capacity: 420, freight: 0, energyType: 'electricity', energy: 10.5, maintenance: 0.88, price: 32000000, reliability: 0.9, comfort: 0.86, range: 650, description: 'Première navette à sustentation magnétique, très coûteuse mais très rapide.', requiredTech: 'maglev_levitation', requiredTechLevel: 1 },
    maglev_guided_regional: { id: 'maglev_guided_regional', name: 'Rame maglev guidée', unlockEpoch: 6, type: 'Maglev guidé', speed: 420, capacity: 520, freight: 0, energyType: 'electricity', energy: 10.8, maintenance: 0.82, price: 39000000, reliability: 0.93, comfort: 0.88, range: 850, description: 'Maglev plus fiable grâce au guidage magnétique maîtrisé.', requiredTech: 'maglev_guidance', requiredTechLevel: 3 },
    maglev_linear_express: { id: 'maglev_linear_express', name: 'Maglev express linéaire', unlockEpoch: 6, type: 'Maglev express', speed: 500, capacity: 600, freight: 0, energyType: 'electricity', energy: 11.5, maintenance: 0.9, price: 52000000, reliability: 0.94, comfort: 0.9, range: 1050, description: 'Propulsion linéaire pour liaisons express à très haute vitesse.', requiredTech: 'maglev_linear_propulsion', requiredTechLevel: 4 },
    maglev_metropolitan_express: { id: 'maglev_metropolitan_express', name: 'Maglev express métropolitain', unlockEpoch: 6, type: 'Maglev métropolitain', speed: 520, capacity: 760, freight: 0, energyType: 'electricity', energy: 12.4, maintenance: 0.92, price: 68000000, reliability: 0.95, comfort: 0.91, range: 1250, description: 'Très forte capacité pour liaisons express entre métropoles.', requiredTech: 'maglev_metro_express_links', requiredTechLevel: 6 },
    maglev_next_gen_unit: { id: 'maglev_next_gen_unit', name: 'Maglev nouvelle génération', unlockEpoch: 6, type: 'Maglev nouvelle génération', speed: 600, capacity: 820, freight: 60, energyType: 'electricity', energy: 10.9, maintenance: 0.78, price: 92000000, reliability: 0.97, comfort: 0.95, range: 1500, description: 'Matériel ultime de très late game : vitesse extrême, confort et fiabilité.', requiredTech: 'maglev_next_generation', requiredTechLevel: 8 }
  };
  const staff = {
    drivers: { label: 'Conducteur', salary: 4300, hireCost: 9000 },
    controllers: { label: 'Contrôleur', salary: 3300, hireCost: 6500 },
    stationAgents: { label: 'Agent de gare', salary: 3100, hireCost: 5200 },
    mechanics: { label: 'Mainteneur', salary: 3700, hireCost: 7200 },
    dispatchers: { label: 'Régulateur', salary: 4600, hireCost: 10500 },
    engineers: { label: 'Agent de l’infra', salary: 5600, hireCost: 14000 }
  };
  const energyStrategies = {
    spot: { name: 'Marché spot', defaultMultiplier: 1, multiplier: {} },
    stable: { name: 'Contrat stable', defaultMultiplier: 1.08, multiplier: { diesel: 1.03, electricity: 1.04, coal: 1.05, hydrogen: 1.04, battery: 1.04 } },
    cheap: { name: 'Achat opportuniste', defaultMultiplier: 0.92, multiplier: { diesel: 0.93, electricity: 0.94, coal: 0.9, hydrogen: 0.98, battery: 0.96 } },
    green: { name: 'Énergie bas carbone', defaultMultiplier: 1.16, multiplier: { electricity: 1.08, hydrogen: 1.1, battery: 1.07, diesel: 1.25, coal: 1.35 } }
  };
  const maintenancePolicies = {
    economy: { id: 'economy', name: 'Économie', description: 'Coûts bas, usure accélérée et fiabilité plus faible.', costMultiplier: 0.82, wearMultiplier: 1.22, reliabilityBonus: -0.025 },
    standard: { id: 'standard', name: 'Standard', description: 'Équilibre entre coût, usure et disponibilité.', costMultiplier: 1.0, wearMultiplier: 1.0, reliabilityBonus: 0 },
    preventive: { id: 'preventive', name: 'Préventive', description: 'Plus chère, mais réduit l’usure et les retards.', costMultiplier: 1.18, wearMultiplier: 0.78, reliabilityBonus: 0.018 },
    intensive: { id: 'intensive', name: 'Intensive', description: 'Très chère, adaptée au matériel stratégique et aux lignes fortes.', costMultiplier: 1.38, wearMultiplier: 0.62, reliabilityBonus: 0.035 }
  };

  const maintenanceActions = {
    light: { id: 'light', name: 'Révision légère', description: 'Intervention courte. Remonte légèrement l’état.', baseCost: 4500, priceFactor: 0.018, restore: 0.18, target: 0.82, days: 1, requiresDepot: false },
    standard: { id: 'standard', name: 'Révision atelier', description: 'Remise à niveau solide. Demande un atelier ou dépôt.', baseCost: 12000, priceFactor: 0.045, restore: 0.38, target: 0.92, days: 3, requiresDepot: true },
    heavy: { id: 'heavy', name: 'Grande révision', description: 'Réparation lourde pour matériel très usé.', baseCost: 32000, priceFactor: 0.085, restore: 0.62, target: 0.98, days: 6, requiresDepot: true, requiredTech: 'steam_workshops' },
    refurbish: { id: 'refurbish', name: 'Rénovation complète', description: 'Très coûteux, mais remet presque à neuf.', baseCost: 70000, priceFactor: 0.13, restore: 0.9, target: 1, days: 10, requiresDepot: true, requiredTech: 'electric_standardized_maintenance' }
  };

  for (const model of Object.values(trains)) {
    model.compositionSpec = compositionSpecForModel(model);
  }
  const techTree = buildTechTree();

  return {
    epochs,
    trains,
    staff,
    techLabels: {
      traction: 'Traction',
      energy: 'Énergie',
      operations: 'Exploitation',
      stations: 'Gares',
      social: 'Social',
      freight: 'Fret'
    },
    energyStrategies,
    maintenancePolicies,
    maintenanceActions,
    techTree,
    public: { epochs, trains, staff, energyStrategies, maintenancePolicies, maintenanceActions, techTree, techLabels: {
      traction: 'Traction',
      energy: 'Énergie',
      operations: 'Exploitation',
      stations: 'Gares',
      social: 'Social',
      freight: 'Fret'
    } }
  };
}


function buildTechTree() {
  const groups = {
    traction: { id: 'traction', label: 'Traction', description: 'Matériels roulants, chaînes de traction, vitesse et types de trains.', nodes: [] },
    energy: { id: 'energy', label: 'Énergie', description: 'Alimentation, carburants, stockage, recharge, autonomie et consommation.', nodes: [] },
    maintenance: { id: 'maintenance', label: 'Maintenance', description: 'Dépôts, ateliers, freinage, fiabilité, sécurité et standardisation.', nodes: [] },
    operations: { id: 'operations', label: 'Exploitation', description: 'Signalisation, régulation, débit et ponctualité.', nodes: [] },
    stations: { id: 'stations', label: 'Gares', description: 'Capacité, services voyageurs, hubs et immobilier ferroviaire.', nodes: [] },
    freight: { id: 'freight', label: 'Fret', description: 'Wagons, contrats, terminaux et corridors logistiques.', nodes: [] },
    social: { id: 'social', label: 'RH', description: 'Formation, sécurité, productivité et organisation humaine.', nodes: [] }
  };

  const add = (group, id, title, description, requiredEpoch, prereq, unlocks, improves, options = {}) => {
    groups[group].nodes.push({
      id,
      branch: options.branch || group,
      title,
      description,
      requiredEpoch,
      prereq,
      unlocks,
      improves,
      effects: [...(unlocks || []), ...(improves || [])],
      maxLevel: options.maxLevel ?? 0,
      baseCostMoney: options.baseCostMoney || 45000 + requiredEpoch * 65000,
      baseDurationSeconds: options.baseDurationSeconds,
      costGrowth: options.costGrowth || 1.62,
      durationGrowth: options.durationGrowth || 1.48,
      levelValue: options.levelValue || 1,
      levelPrereq: options.levelPrereq || [],
      era: options.era || null,
      eraLabel: options.eraLabel || '',
      infiniteScaling: options.infiniteScaling ?? null,
      disableAutoLevelEffect: Boolean(options.disableAutoLevelEffect)
    });
  };


  // Arbre Traction refondu depuis le document utilisateur : 7 ères ferroviaires avec dépendances par niveaux.
  add('traction', "steam_first_locomotives", "Premières locomotives à vapeur", "Ère 1 — Train à vapeur. Effets : +5% portée, +3% vitesse max.", 0, [], [], ["+5% portée", "+3% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_improved_boilers", "Chaudières améliorées", "Ère 1 — Train à vapeur. Effets : +8% vitesse max, -4% consommation.", 0, [{"id": "steam_first_locomotives", "level": 3}], [], ["+8% vitesse max", "-4% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_coal_water_reserves", "Réserves de charbon et d’eau", "Ère 1 — Train à vapeur. Effets : +12% portée.", 0, [{"id": "steam_first_locomotives", "level": 3}], [], ["+12% portée", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "steam_depots", "Dépôts vapeur", "Ère 1 — Train à vapeur. Effets : +10% portée, +4% fiabilité.", 0, [{"id": "steam_coal_water_reserves", "level": 3}], [], ["+10% portée", "+4% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "steam_passenger_locomotives", "Locomotives voyageurs vapeur", "Ère 1 — Train à vapeur. Effets : +10% vitesse max, +5% rentabilité.", 0, [{"id": "steam_improved_boilers", "level": 4}], ["Locomotive vapeur 220 express"], ["+10% vitesse max", "+5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "steam_freight_locomotives", "Locomotives marchandises vapeur", "Ère 1 — Train à vapeur. Effets : +6% rentabilité, +5% fiabilité.", 0, [{"id": "steam_improved_boilers", "level": 4}], ["Locomotive vapeur 040 marchandises"], ["+6% rentabilité", "+5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_economized", "Vapeur économisée", "Ère 1 — Train à vapeur. Effets : -8% consommation, +6% rentabilité.", 0, [{"id": "steam_improved_boilers", "level": 5}], [], ["-8% consommation", "+6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_superheated", "Vapeur surchauffée", "Ère 1 — Train à vapeur. Effets : +10% vitesse max, -6% consommation, +4% fiabilité.", 0, [{"id": "steam_economized", "level": 5}], [], ["+10% vitesse max", "-6% consommation", "+4% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "steam_articulated_locomotives", "Locomotives articulées", "Ère 1 — Train à vapeur. Effets : +8% portée, +6% rentabilité.", 0, [{"id": "steam_freight_locomotives", "level": 5}, {"id": "steam_superheated", "level": 3}], ["Locomotive vapeur articulée 241"], ["+8% portée", "+6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "steam_reinforced_brakes", "Freins renforcés", "Ère 1 — Train à vapeur. Effets : +4% vitesse max, +8% fiabilité.", 0, [{"id": "steam_passenger_locomotives", "level": 3}, {"id": "steam_freight_locomotives", "level": 3}], [], ["+4% vitesse max", "+8% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "steam_workshops", "Ateliers vapeur", "Ère 1 — Train à vapeur. Effets : +10% fiabilité, +5% rentabilité.", 0, [{"id": "steam_depots", "level": 5}], [], ["+10% fiabilité", "+5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_oil_fired", "Vapeur au fuel", "Ère 1 — Train à vapeur. Effets : -7% consommation, +6% fiabilité, -4% impact environnemental.", 0, [{"id": "steam_superheated", "level": 5}, {"id": "steam_workshops", "level": 5}], [], ["-7% consommation", "+6% fiabilité", "-4% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_first_engines", "Premiers moteurs diesel", "Ère 2 — Train diesel. Effets : +8% portée, +5% fiabilité, -5% consommation.", 1, [{"id": "steam_workshops", "level": 5}, {"id": "steam_economized", "level": 5}], ["Autorail diesel léger"], ["+8% portée", "+5% fiabilité", "-5% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_light_railcars", "Autorails légers", "Ère 2 — Train diesel. Effets : -10% consommation, +8% rentabilité.", 1, [{"id": "diesel_first_engines", "level": 3}], ["Autorail diesel léger", "Automotrice diesel mécanique"], ["-10% consommation", "+8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_shunters", "Locomotives de manœuvre diesel", "Ère 2 — Train diesel. Effets : +6% fiabilité, +5% rentabilité.", 1, [{"id": "diesel_first_engines", "level": 3}], ["Locotracteur diesel de manœuvre"], ["+6% fiabilité", "+5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "diesel_long_range_tanks", "Réservoirs grande autonomie", "Ère 2 — Train diesel. Effets : +15% portée.", 1, [{"id": "diesel_first_engines", "level": 4}], [], ["+15% portée", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "diesel_fuel_depots", "Dépôts carburant", "Ère 2 — Train diesel. Effets : +10% portée, +5% fiabilité.", 1, [{"id": "diesel_long_range_tanks", "level": 3}], [], ["+10% portée", "+5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_mechanical", "Diesel mécanique", "Ère 2 — Train diesel. Effets : +5% fiabilité, +4% rentabilité.", 1, [{"id": "diesel_first_engines", "level": 5}], ["Automotrice diesel mécanique"], ["+5% fiabilité", "+4% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_hydraulic", "Diesel hydraulique", "Ère 2 — Train diesel. Effets : +7% vitesse max, -4% consommation.", 1, [{"id": "diesel_mechanical", "level": 5}], [], ["+7% vitesse max", "-4% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_electric", "Diesel-électrique", "Ère 2 — Train diesel. Effets : +8% fiabilité, -6% consommation, +5% rentabilité.", 1, [{"id": "diesel_mechanical", "level": 5}, {"id": "diesel_shunters", "level": 3}], [], ["+8% fiabilité", "-6% consommation", "+5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_passenger_locomotives", "Locomotives diesel voyageurs", "Ère 2 — Train diesel. Effets : +8% vitesse max, +6% rentabilité.", 1, [{"anyOf": [{"id": "diesel_hydraulic", "level": 4}, {"id": "diesel_electric", "level": 4}]}], ["Locomotive diesel hydraulique voyageurs"], ["+8% vitesse max", "+6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_freight_locomotives", "Locomotives diesel fret", "Ère 2 — Train diesel. Effets : +10% rentabilité, +5% fiabilité.", 1, [{"id": "diesel_electric", "level": 5}], ["Locomotive diesel-électrique fret"], ["+10% rentabilité", "+5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_multiple_units", "Unités multiples diesel", "Ère 2 — Train diesel. Effets : +7% vitesse max, +6% fiabilité.", 1, [{"id": "diesel_passenger_locomotives", "level": 5}, {"id": "diesel_electric", "level": 3}], [], ["+7% vitesse max", "+6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "diesel_modern", "Diesel moderne", "Ère 2 — Train diesel. Effets : -10% consommation, -8% impact environnemental, +8% rentabilité.", 1, [{"id": "diesel_electric", "level": 8}, {"id": "diesel_fuel_depots", "level": 5}], [], ["-10% consommation", "-8% impact environnemental", "+8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_first_trains", "Premiers trains électriques", "Ère 3 — Train électrique. Effets : +8% vitesse max, -8% consommation, -10% impact environnemental.", 2, [{"anyOf": [{"id": "steam_workshops", "level": 5}, {"id": "diesel_first_engines", "level": 5}]}], ["Locomotive électrique pionnière"], ["+8% vitesse max", "-8% consommation", "-10% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_third_rail", "Troisième rail", "Ère 3 — Train électrique. Effets : +6% rentabilité, +5% fiabilité.", 2, [{"id": "electric_first_trains", "level": 3}], ["Automotrice troisième rail"], ["+6% rentabilité", "+5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_dc_catenary", "Caténaire à courant continu", "Ère 3 — Train électrique. Effets : +8% portée, -6% consommation.", 2, [{"id": "electric_third_rail", "level": 5}], [], ["+8% portée", "-6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_ac_catenary", "Caténaire à courant alternatif monophasé", "Ère 3 — Train électrique. Effets : +12% portée, -8% consommation.", 2, [{"id": "electric_dc_catenary", "level": 8}], [], ["+12% portée", "-8% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_substations", "Sous-stations électriques", "Ère 3 — Train électrique. Effets : +8% fiabilité, -5% consommation.", 2, [{"id": "electric_dc_catenary", "level": 5}], [], ["+8% fiabilité", "-5% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_emus", "Automotrices électriques", "Ère 3 — Train électrique. Effets : +10% vitesse max, +6% rentabilité.", 2, [{"id": "electric_third_rail", "level": 5}, {"id": "electric_improved_motors", "level": 3}], ["Automotrice courant continu régionale"], ["+10% vitesse max", "+6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_locomotives", "Locomotives électriques", "Ère 3 — Train électrique. Effets : +8% vitesse max, +7% rentabilité.", 2, [{"id": "electric_dc_catenary", "level": 5}, {"id": "electric_substations", "level": 3}], ["Locomotive bicourant multiservice", "Locomotive électrique fret lourd"], ["+8% vitesse max", "+7% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_improved_motors", "Moteurs électriques améliorés", "Ère 3 — Train électrique. Effets : +8% vitesse max, -6% consommation, +5% fiabilité.", 2, [{"id": "electric_first_trains", "level": 5}], [], ["+8% vitesse max", "-6% consommation", "+5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_electronic_control", "Commande électronique de traction", "Ère 3 — Train électrique. Effets : -8% consommation, +6% fiabilité.", 2, [{"id": "electric_improved_motors", "level": 5}], [], ["-8% consommation", "+6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "electric_braking", "Freinage électrique", "Ère 3 — Train électrique. Effets : -5% consommation, +8% fiabilité.", 2, [{"id": "electric_electronic_control", "level": 3}], [], ["-5% consommation", "+8% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_energy_recovery", "Récupération d’énergie", "Ère 3 — Train électrique. Effets : -10% consommation, +8% rentabilité, -6% impact environnemental.", 2, [{"id": "electric_braking", "level": 5}, {"id": "electric_substations", "level": 5}], [], ["-10% consommation", "+8% rentabilité", "-6% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_dual_current_trains", "Trains bicourants", "Ère 3 — Train électrique. Effets : +10% portée, +6% rentabilité.", 2, [{"id": "electric_dc_catenary", "level": 8}, {"id": "electric_ac_catenary", "level": 5}], ["Locomotive bicourant multiservice"], ["+10% portée", "+6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_multi_current_trains", "Trains multicourants", "Ère 3 — Train électrique. Effets : +15% portée, +8% rentabilité.", 2, [{"id": "electric_dual_current_trains", "level": 8}], [], ["+15% portée", "+8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "electric_antislip", "Antipatinage automatique", "Ère 3 — Train électrique. Effets : +10% fiabilité, +4% vitesse max.", 2, [{"id": "electric_electronic_control", "level": 5}], [], ["+10% fiabilité", "+4% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "electric_standardized_maintenance", "Maintenance électrique standardisée", "Ère 3 — Train électrique. Effets : +10% fiabilité, +6% rentabilité.", 2, [{"id": "electric_locomotives", "level": 5}, {"id": "electric_emus", "level": 5}], [], ["+10% fiabilité", "+6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "hsv_first_fast_trains", "Premiers trains rapides", "Ère 4 — Train à grande vitesse. Effets : +12% vitesse max, +6% rentabilité.", 3, [{"anyOf": [{"id": "steam_passenger_locomotives", "level": 8}, {"id": "diesel_passenger_locomotives", "level": 8}, {"id": "electric_locomotives", "level": 5}]}], ["Train rapide Intercités 200"], ["+12% vitesse max", "+6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_aerodynamics", "Aérodynamique ferroviaire", "Ère 4 — Train à grande vitesse. Effets : +10% vitesse max, -8% consommation.", 3, [{"id": "hsv_first_fast_trains", "level": 5}], [], ["+10% vitesse max", "-8% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_lightweight_materials", "Matériel allégé", "Ère 4 — Train à grande vitesse. Effets : +8% vitesse max, -6% consommation.", 3, [{"id": "hsv_first_fast_trains", "level": 5}], [], ["+8% vitesse max", "-6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('maintenance', "hsv_high_speed_braking", "Freinage haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +8% vitesse max, +10% fiabilité.", 3, [{"anyOf": [{"id": "steam_reinforced_brakes", "level": 8}, {"id": "electric_braking", "level": 5}]}], [], ["+8% vitesse max", "+10% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_adapted_tracks", "Voies adaptées à la grande vitesse", "Ère 4 — Train à grande vitesse. Effets : +15% vitesse max, +8% rentabilité.", 3, [{"id": "hsv_aerodynamics", "level": 5}, {"id": "hsv_high_speed_braking", "level": 5}], [], ["+15% vitesse max", "+8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('energy', "hsv_catenary", "Caténaire haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +10% vitesse max, -6% consommation.", 3, [{"id": "electric_ac_catenary", "level": 8}, {"id": "electric_substations", "level": 8}], [], ["+10% vitesse max", "-6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_trainsets", "Rames à grande vitesse", "Ère 4 — Train à grande vitesse. Effets : +18% vitesse max, +10% rentabilité.", 3, [{"id": "hsv_adapted_tracks", "level": 5}, {"id": "hsv_catenary", "level": 5}], ["Rame grande vitesse première génération"], ["+18% vitesse max", "+10% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('energy', "hsv_high_power_onboard", "Puissance embarquée élevée", "Ère 4 — Train à grande vitesse. Effets : +12% vitesse max, -5% consommation.", 3, [{"id": "hsv_trainsets", "level": 5}, {"id": "electric_improved_motors", "level": 8}], [], ["+12% vitesse max", "-5% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_stability", "Stabilité à haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +8% vitesse max, +10% fiabilité.", 3, [{"id": "hsv_aerodynamics", "level": 8}, {"id": "hsv_lightweight_materials", "level": 5}], [], ["+8% vitesse max", "+10% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_signaling", "Signalisation haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +10% vitesse max, +8% fiabilité.", 3, [{"id": "hsv_adapted_tracks", "level": 8}], [], ["+10% vitesse max", "+8% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_distributed_traction", "Traction répartie haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +8% vitesse max, -6% consommation, +6% fiabilité.", 3, [{"id": "hsv_trainsets", "level": 8}, {"id": "electric_electronic_control", "level": 8}], ["Rame grande vitesse Duplex"], ["+8% vitesse max", "-6% consommation", "+6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_premium_long_distance", "Services grande distance premium", "Ère 4 — Train à grande vitesse. Effets : +12% rentabilité.", 3, [{"id": "hsv_trainsets", "level": 5}, {"id": "hsv_stability", "level": 5}], ["Rame grande distance premium"], ["+12% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hydrogen_first_trains", "Premiers trains à hydrogène", "Ère 5 — Train à hydrogène. Effets : +8% portée, -12% impact environnemental.", 4, [{"id": "diesel_modern", "level": 5}, {"id": "electric_electronic_control", "level": 5}], ["Rame hydrogène régionale"], ["+8% portée", "-12% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_fuel_cell", "Pile à combustible ferroviaire", "Ère 5 — Train à hydrogène. Effets : -8% consommation, +6% fiabilité.", 4, [{"id": "hydrogen_first_trains", "level": 3}], ["Rame hydrogène à pile combustible"], ["-8% consommation", "+6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_secure_tanks", "Réservoirs hydrogène sécurisés", "Ère 5 — Train à hydrogène. Effets : +12% portée, +6% fiabilité.", 4, [{"id": "hydrogen_first_trains", "level": 3}], [], ["+12% portée", "+6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_refueling_stations", "Stations de ravitaillement hydrogène", "Ère 5 — Train à hydrogène. Effets : +15% portée, +5% rentabilité.", 4, [{"id": "hydrogen_secure_tanks", "level": 5}], [], ["+15% portée", "+5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_green", "Hydrogène vert", "Ère 5 — Train à hydrogène. Effets : -15% impact environnemental, +5% rentabilité.", 4, [{"id": "hydrogen_refueling_stations", "level": 5}], [], ["-15% impact environnemental", "+5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('maintenance', "hydrogen_specialized_maintenance", "Maintenance hydrogène spécialisée", "Ère 5 — Train à hydrogène. Effets : +10% fiabilité, +5% rentabilité.", 4, [{"id": "hydrogen_fuel_cell", "level": 5}], [], ["+10% fiabilité", "+5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('traction', "hydrogen_regional_trains", "Trains régionaux hydrogène", "Ère 5 — Train à hydrogène. Effets : +8% portée, +6% rentabilité.", 4, [{"id": "hydrogen_fuel_cell", "level": 5}, {"id": "hydrogen_refueling_stations", "level": 3}], ["Rame hydrogène régionale"], ["+8% portée", "+6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_optimized_energy_recharge", "Recharge énergétique optimisée", "Ère 5 — Train à hydrogène. Effets : -8% consommation, +8% rentabilité.", 4, [{"id": "hydrogen_fuel_cell", "level": 8}], [], ["-8% consommation", "+8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('maintenance', "hydrogen_enhanced_safety", "Sécurité hydrogène renforcée", "Ère 5 — Train à hydrogène. Effets : +12% fiabilité.", 4, [{"id": "hydrogen_secure_tanks", "level": 8}], [], ["+12% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_long_distance_tanks", "Réservoirs longue distance", "Ère 5 — Train à hydrogène. Effets : +18% portée.", 4, [{"id": "hydrogen_secure_tanks", "level": 8}, {"id": "hydrogen_enhanced_safety", "level": 5}], ["Rame hydrogène longue distance"], ["+18% portée", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('traction', "hydrogen_rural_lines", "Hydrogène pour lignes rurales", "Ère 5 — Train à hydrogène. Effets : +10% rentabilité, -8% impact environnemental.", 4, [{"id": "hydrogen_regional_trains", "level": 5}], [], ["+10% rentabilité", "-8% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_next_generation", "Hydrogène nouvelle génération", "Ère 5 — Train à hydrogène. Effets : +12% portée, -10% consommation, -10% impact environnemental.", 4, [{"id": "hydrogen_green", "level": 8}, {"id": "hydrogen_fuel_cell", "level": 8}, {"id": "hydrogen_enhanced_safety", "level": 5}], ["Rame hydrogène nouvelle génération"], ["+12% portée", "-10% consommation", "-10% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('traction', "battery_first_trains", "Premiers trains à batterie", "Ère 6 — Train à batterie. Effets : +10% autonomie, -15% impact environnemental.", 5, [{"id": "electric_energy_recovery", "level": 5}, {"id": "electric_electronic_control", "level": 5}], ["Rame batterie périurbaine"], ["+10% autonomie", "-15% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_railway_batteries", "Batteries ferroviaires", "Ère 6 — Train à batterie. Effets : +12% autonomie, +5% fiabilité.", 5, [{"id": "battery_first_trains", "level": 3}], [], ["+12% autonomie", "+5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_catenary_charging", "Recharge sous caténaire", "Ère 6 — Train à batterie. Effets : +10% autonomie, -6% consommation.", 5, [{"id": "battery_railway_batteries", "level": 3}, {"id": "electric_ac_catenary", "level": 5}], [], ["+10% autonomie", "-6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_fast_station_charging", "Recharge rapide en gare", "Ère 6 — Train à batterie. Effets : +8% autonomie, +6% rentabilité.", 5, [{"id": "battery_railway_batteries", "level": 5}, {"id": "electric_substations", "level": 5}], ["Rame batterie recharge rapide"], ["+8% autonomie", "+6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_long_range", "Batteries longue autonomie", "Ère 6 — Train à batterie. Effets : +18% autonomie.", 5, [{"id": "battery_railway_batteries", "level": 8}], [], ["+18% autonomie", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('maintenance', "battery_thermal_management", "Gestion thermique des batteries", "Ère 6 — Train à batterie. Effets : +10% fiabilité, +6% autonomie.", 5, [{"id": "battery_railway_batteries", "level": 5}], [], ["+10% fiabilité", "+6% autonomie", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_brake_energy_recovery", "Récupération d’énergie au freinage", "Ère 6 — Train à batterie. Effets : +10% autonomie, -8% consommation.", 5, [{"id": "electric_energy_recovery", "level": 8}, {"id": "battery_railway_batteries", "level": 5}], [], ["+10% autonomie", "-8% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('traction', "battery_suburban_trains", "Trains périurbains à batterie", "Ère 6 — Train à batterie. Effets : +8% rentabilité, -8% impact environnemental.", 5, [{"id": "battery_fast_station_charging", "level": 5}, {"id": "battery_thermal_management", "level": 3}], ["Rame batterie périurbaine"], ["+8% rentabilité", "-8% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('traction', "battery_regional_trains", "Trains régionaux à batterie", "Ère 6 — Train à batterie. Effets : +12% autonomie, +6% rentabilité.", 5, [{"id": "battery_long_range", "level": 5}, {"id": "battery_catenary_charging", "level": 5}], ["Rame batterie régionale"], ["+12% autonomie", "+6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('maintenance', "battery_modular", "Batteries modulaires", "Ère 6 — Train à batterie. Effets : +8% fiabilité, +6% rentabilité.", 5, [{"id": "battery_thermal_management", "level": 5}], ["Rame batterie modulaire"], ["+8% fiabilité", "+6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_auto_charge_optimization", "Optimisation automatique de charge", "Ère 6 — Train à batterie. Effets : -10% consommation, +8% autonomie.", 5, [{"id": "battery_modular", "level": 5}, {"id": "electric_electronic_control", "level": 8}], [], ["-10% consommation", "+8% autonomie", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_high_density", "Batteries haute densité", "Ère 6 — Train à batterie. Effets : +20% autonomie, +6% vitesse max.", 5, [{"id": "battery_long_range", "level": 8}, {"id": "battery_thermal_management", "level": 8}], ["Rame batterie haute densité"], ["+20% autonomie", "+6% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('traction', "maglev_levitation", "Sustentation magnétique", "Ère 7 — Train à sustentation magnétique. Effets : +20% vitesse max, -8% consommation. Note : Si le moteur du jeu ne permet pas de dépendre d’une recherche située plus bas, remplacer par : Rames à grande vitesse niveau 8 + Caténaire haute vitesse niveau 8.", 6, [{"id": "hsv_trainsets", "level": 8}, {"id": "maglev_high_power_energy", "level": 1}], ["Navette maglev pionnière"], ["+20% vitesse max", "-8% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_guidance", "Guidage magnétique", "Ère 7 — Train à sustentation magnétique. Effets : +12% fiabilité, +8% vitesse max.", 6, [{"id": "maglev_levitation", "level": 3}], ["Rame maglev guidée"], ["+12% fiabilité", "+8% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_linear_propulsion", "Propulsion linéaire", "Ère 7 — Train à sustentation magnétique. Effets : +18% vitesse max, -6% consommation.", 6, [{"id": "maglev_levitation", "level": 5}, {"id": "maglev_guidance", "level": 3}], ["Maglev express linéaire"], ["+18% vitesse max", "-6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_special_tracks", "Voies magnétiques spéciales", "Ère 7 — Train à sustentation magnétique. Effets : +15% vitesse max, +8% fiabilité.", 6, [{"id": "maglev_guidance", "level": 5}], [], ["+15% vitesse max", "+8% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_stations", "Gares maglev", "Ère 7 — Train à sustentation magnétique. Effets : +8% rentabilité, +6% fiabilité.", 6, [{"id": "maglev_special_tracks", "level": 3}], [], ["+8% rentabilité", "+6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_very_high_speed", "Très haute vitesse", "Ère 7 — Train à sustentation magnétique. Effets : +25% vitesse max, +10% rentabilité.", 6, [{"id": "maglev_linear_propulsion", "level": 8}, {"id": "maglev_special_tracks", "level": 8}], [], ["+25% vitesse max", "+10% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_silence_comfort", "Silence et confort avancés", "Ère 7 — Train à sustentation magnétique. Effets : +10% rentabilité, -6% impact environnemental.", 6, [{"id": "maglev_levitation", "level": 5}, {"id": "maglev_stations", "level": 3}], [], ["+10% rentabilité", "-6% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('maintenance', "maglev_contactless_maintenance", "Maintenance sans contact roue-rail", "Ère 7 — Train à sustentation magnétique. Effets : +12% fiabilité, +8% rentabilité.", 6, [{"id": "maglev_guidance", "level": 8}], [], ["+12% fiabilité", "+8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('maintenance', "maglev_advanced_high_speed_safety", "Sécurité haute vitesse avancée", "Ère 7 — Train à sustentation magnétique. Effets : +15% fiabilité.", 6, [{"id": "maglev_very_high_speed", "level": 5}, {"id": "hsv_signaling", "level": 8}], [], ["+15% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('energy', "maglev_high_power_energy", "Énergie haute puissance", "Ère 7 — Train à sustentation magnétique. Effets : +12% vitesse max, -5% consommation.", 6, [{"id": "hsv_catenary", "level": 8}, {"id": "electric_substations", "level": 8}], [], ["+12% vitesse max", "-5% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_metro_express_links", "Liaisons express métropolitaines", "Ère 7 — Train à sustentation magnétique. Effets : +15% rentabilité, +10% vitesse max.", 6, [{"id": "maglev_very_high_speed", "level": 5}, {"id": "maglev_stations", "level": 5}], ["Maglev express métropolitain"], ["+15% rentabilité", "+10% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_next_generation", "Maglev nouvelle génération", "Ère 7 — Train à sustentation magnétique. Effets : +20% vitesse max, -10% consommation, +10% fiabilité.", 6, [{"id": "maglev_very_high_speed", "level": 8}, {"id": "maglev_advanced_high_speed_safety", "level": 8}, {"id": "maglev_contactless_maintenance", "level": 8}], ["Maglev nouvelle génération"], ["+20% vitesse max", "-10% consommation", "+10% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});


  add('operations', 'manual_dispatch', 'Régulation manuelle structurée', 'Pose les bases des roulements et priorités de circulation.', 0, [], [], ['Ponctualité de base par niveau']);
  add('operations', 'block_signaling', 'Block automatique', 'Augmente le débit et réduit les conflits de circulation.', 1, ['manual_dispatch'], [], ['Attractivité et ponctualité par niveau']);
  add('operations', 'passing_loops', 'Évitements cadencés', 'Rend les lignes secondaires plus fréquentes.', 1, ['manual_dispatch'], [], ['Fréquence soutenable sur petites lignes']);
  add('operations', 'centralized_control', 'Commande centralisée', 'Supervise plusieurs lignes depuis un poste unique.', 2, ['block_signaling'], [], ['Attractivité réseau et prérequis grande vitesse']);
  add('operations', 'clockface_timetable', 'Horaire cadencé', 'Rend les lignes plus lisibles pour les voyageurs.', 2, ['centralized_control'], [], ['Demande voyageurs et satisfaction accrues']);
  add('operations', 'incident_protocols', 'Plans incidents', 'Réduit l’impact des événements météo et sociaux.', 2, ['centralized_control'], [], ['Résilience événementielle par niveau']);
  add('operations', 'platform_dispatching', 'Gestion quais centralisée', 'Réduit les conflits dans les grandes gares.', 3, ['clockface_timetable', 'passenger_flow'], [], ['Capacité des nœuds accrue']);
  add('operations', 'traffic_simulation', 'Simulation de trafic', 'Prévoit la saturation avant ouverture des lignes.', 3, ['centralized_control'], [], ['Meilleure marge sur fréquences élevées']);
  add('operations', 'night_services', 'Exploitation de nuit', 'Organise sûreté, roulements et maintenance nocturne.', 4, ['centralized_control'], ['Trains de nuit modernes'], ['Revenus longue distance et disponibilité améliorés']);
  add('operations', 'dynamic_pricing', 'Yield management ferroviaire', 'Optimise le prix moyen sans casser l’attractivité.', 4, ['traffic_simulation'], [], ['Revenus voyageurs par niveau']);
  add('operations', 'automated_dispatch', 'Régulation automatisée', 'Optimise les priorités à grande échelle.', 5, ['traffic_simulation', 'electric_electronic_control'], [], ['Ponctualité réseau avancée']);
  add('operations', 'driverless_corridors', 'Corridors supervisés', 'Prépare le fret autonome et les corridors très cadencés.', 5, ['automated_dispatch'], ['Rame batterie modulaire mieux exploité'], ['Débit et coûts RH réduits']);

  add('stations', 'passenger_flow', 'Gestion des flux voyageurs', 'Améliore la capacité effective et la lisibilité des gares.', 0, [], [], ['Capacité gares et demande voyageurs par niveau']);
  add('stations', 'ticket_halls', 'Salles des billets modernisées', 'Réduit les frictions d’accès aux trains.', 0, ['passenger_flow'], [], ['Satisfaction voyageurs par niveau']);
  add('stations', 'platform_canopies', 'Abris de quais', 'Améliore le confort des gares exposées.', 0, ['ticket_halls'], [], ['Confort et réputation locale']);
  add('stations', 'station_retail', 'Commerces de gare', 'Augmente les revenus annexes des flux voyageurs.', 1, ['ticket_halls'], [], ['Revenus gares par niveau']);
  add('stations', 'park_and_ride', 'Parcs relais', 'Améliore la capture périurbaine.', 1, ['passenger_flow'], [], ['Demande régionale par niveau']);
  add('stations', 'accessibility_program', 'Accessibilité universelle', 'Rend les gares plus efficaces et attractives.', 2, ['platform_canopies'], [], ['Satisfaction et flux par niveau']);
  add('stations', 'intermodal_hubs', 'Hubs intermodaux', 'Connecte trains, bus, tramways, vélos et parkings.', 2, ['park_and_ride', 'passenger_flow'], [], ['Demande voyageurs et capacité intermodale']);
  add('stations', 'major_terminal_design', 'Conception grands terminaux', 'Débloque une exploitation dense des métropoles.', 3, ['intermodal_hubs'], [], ['Capacité grands nœuds par niveau']);
  add('stations', 'station_hotels', 'Services longue distance', 'Améliore les gares de correspondance premium.', 3, ['station_retail'], [], ['Revenus annexes et satisfaction']);
  add('stations', 'real_time_information', 'Information voyageurs temps réel', 'Réduit l’impact des retards perçus.', 3, ['centralized_control', 'accessibility_program'], [], ['Satisfaction et réputation par niveau']);
  add('stations', 'urban_air_rights', 'Valorisation immobilière', 'Transforme les grandes gares en actifs de long terme.', 4, ['major_terminal_design', 'station_retail'], [], ['Revenus gares par niveau']);
  add('stations', 'smart_station_ops', 'Gares intelligentes', 'Automatise flux, énergie et maintenance bâtiment.', 5, ['real_time_information', 'electric_electronic_control'], [], ['Charges fixes de gare réduites']);

  add('freight', 'basic_freight_yards', 'Triages marchandises', 'Structure les premiers flux fret exploitables.', 0, [], [], ['Demande fret locale par niveau']);
  add('freight', 'specialized_wagons', 'Wagons spécialisés', 'Adapte les wagons aux céréales, bois, citernes et vracs.', 1, ['basic_freight_yards'], [], ['Demande et revenus fret par niveau']);
  add('freight', 'midi_freight_stock', 'Wagons Midi électriques', 'Débloque les wagons fret des compositions électriques pionnières.', 1, ['specialized_wagons'], ['6 variantes fret Midi'], ['Rendement des wagons par niveau']);
  add('freight', 'cold_chain', 'Chaîne du froid ferroviaire', 'Ouvre des contrats alimentaires plus rentables.', 1, ['specialized_wagons'], [], ['Revenus fret premium par niveau']);
  add('freight', 'bulk_contracts', 'Contrats vrac lourds', 'Sécurise minerais, granulats et céréales.', 1, ['basic_freight_yards'], [], ['Volume fret par niveau']);
  add('freight', 'freight_diesel', 'Diesel fret lourd', 'Débloque les locomotives diesel fret non électrifiées.', 2, ['specialized_wagons', 'diesel_freight_locomotives'], ['Locomotive diesel-électrique fret'], ['Coût et fiabilité fret diesel']);
  add('freight', 'port_shuttles', 'Navettes portuaires', 'Améliore les flux depuis ports et zones logistiques.', 2, ['freight_diesel'], [], ['Demande fret maritime par niveau']);
  add('freight', 'container_hubs', 'Terminaux conteneurs', 'Organise le fret intermodal longue distance.', 3, ['port_shuttles'], ['Locomotive électrique fret lourd'], ['Demande conteneurs par niveau']);
  add('freight', 'hazmat_protocols', 'Protocoles matières dangereuses', 'Accède à des contrats difficiles mais rentables.', 3, ['cold_chain'], [], ['Revenus fret spécialisés par niveau']);
  add('freight', 'last_mile_rail', 'Dernier kilomètre ferroviaire', 'Relie zones industrielles et terminaux urbains.', 4, ['container_hubs'], [], ['Capture fret locale par niveau']);
  add('freight', 'automated_freight_ops', 'Exploitation fret automatisée', 'Prépare les trains autonomes de marchandises.', 5, ['driverless_corridors', 'container_hubs'], ['Rame batterie modulaire'], ['Coûts RH fret réduits']);
  add('freight', 'freight_marketplace', 'Bourse contrats fret', 'Met en concurrence les flux et améliore le remplissage.', 5, ['automated_freight_ops'], [], ['Taux de chargement fret par niveau']);

  add('social', 'crew_training', 'Formation polyvalente', 'Améliore la productivité des équipes de circulation.', 0, [], [], ['Efficacité RH et masse salariale par niveau']);
  add('social', 'safety_training', 'Culture sécurité', 'Réduit les erreurs d’exploitation et améliore la fiabilité perçue.', 1, ['crew_training'], [], ['Fiabilité et Agents de gare plus efficaces']);
  add('social', 'apprenticeship_tracks', 'Écoles métiers ferroviaires', 'Réduit le coût des recrutements futurs.', 0, ['crew_training'], [], ['Recrutement moins coûteux par niveau']);
  add('social', 'driver_rosters', 'Roulements Conducteurs', 'Stabilise les lignes à forte fréquence.', 1, ['crew_training'], [], ['Besoin Conducteur mieux couvert']);
  add('social', 'controller_service', 'Service commercial embarqué', 'Améliore satisfaction et revenus annexes.', 1, ['safety_training'], [], ['Satisfaction voyageurs par niveau']);
  add('social', 'mechanic_certification', 'Certification Mainteneurs', 'Améliore la qualité des interventions atelier.', 1, ['crew_training'], [], ['Maintenance plus efficace par niveau']);
  add('social', 'dispatcher_school', 'École de régulation', 'Renforce la ponctualité des réseaux complexes.', 2, ['driver_rosters', 'manual_dispatch'], [], ['Régulation et ponctualité par niveau']);
  add('social', 'social_dialogue', 'Dialogue social structuré', 'Réduit l’impact des tensions sociales.', 2, ['safety_training'], [], ['Résilience sociale par niveau']);
  add('social', 'engineering_office', 'Bureau d’études interne', 'Accélère légèrement les projets R&D complexes.', 2, ['apprenticeship_tracks'], [], ['Vitesse de recherche par niveau']);
  add('social', 'knowledge_management', 'Capitalisation technique', 'Rend chaque technologie plus facile à exploiter.', 3, ['engineering_office'], [], ['Effets de niveau plus rentables']);
  add('social', 'digital_training', 'Formation simulateur', 'Améliore la conduite des matériels modernes.', 4, ['dispatcher_school', 'real_time_information'], [], ['Fiabilité matériel moderne par niveau']);
  add('social', 'autonomous_supervision', 'Supervision des systèmes autonomes', 'Prépare les équipes au rail automatisé.', 5, ['digital_training', 'automated_dispatch'], [], ['Réduction coûts RH futurs']);

  add('operations', 'network_revenue_control', 'Pilotage revenu réseau', 'Arbitre prix, fréquence et capacité entre lignes concurrentes.', 4, ['dynamic_pricing', 'traffic_simulation'], [], ['Marge des lignes denses améliorée']);
  add('operations', 'ai_timetable_planner', 'Planificateur horaire assisté', 'Construit des sillons robustes sur réseau complexe.', 5, ['automated_dispatch', 'knowledge_management'], [], ['Ponctualité et capacité réseau futures']);
  add('stations', 'station_energy_retrofit', 'Rénovation énergétique des gares', 'Réduit les coûts fixes des bâtiments voyageurs.', 3, ['electric_electronic_control', 'station_retail'], [], ['Charges de gares réduites par niveau']);
  add('stations', 'crowd_simulation', 'Simulation de foule', 'Évite la saturation des terminaux majeurs.', 4, ['major_terminal_design', 'real_time_information'], [], ['Capacité des grandes gares accrue']);
  add('freight', 'rail_road_interfaces', 'Interfaces rail-route', 'Améliore les plateformes combinées régionales.', 3, ['container_hubs'], [], ['Capture fret intermodal accrue']);
  add('freight', 'premium_logistics', 'Logistique premium', 'Structure les contrats urgents à forte marge.', 4, ['hazmat_protocols', 'cold_chain'], [], ['Revenus fret premium par niveau']);
  add('social', 'talent_retention', 'Fidélisation des talents', 'Stabilise les équipes qualifiées sur le long terme.', 3, ['social_dialogue', 'apprenticeship_tracks'], [], ['Coûts RH et qualité de service améliorés']);
  add('social', 'research_campus', 'Campus R&D ferroviaire', 'Accélère les recherches avancées sans achat instantané.', 4, ['engineering_office', 'knowledge_management'], [], ['Vitesse laboratoire par niveau']);

  return finalizeTechTree(groups);
}

function researchNodePrereqWeight(node) {
  const weightOf = item => {
    const req = normalizeResearchPrereqItem(item);
    if (!req) return 0;
    if (req.anyOf) return Math.min(...req.anyOf.map(weightOf));
    return Math.max(1, Math.floor(Number(req.level || 1)));
  };
  return (node.prereq || []).reduce((sum, item) => sum + weightOf(item), 0);
}

function computedResearchBaseDurationSeconds(node) {
  // Niveau 1 début de jeu : environ 30 secondes.
  // Plus l’époque et la profondeur de l’arbre augmentent, plus le niveau 1 démarre long.
  const epoch = Math.max(0, Number(node.requiredEpoch || 0));
  const prereqWeight = researchNodePrereqWeight(node);
  const branchExtra = prereqWeight ? (node.branch === 'social' ? 0 : node.branch === 'operations' ? 8 : node.branch === 'traction' ? 10 : 6) : 0;
  return Math.round(30 * Math.pow(2.05, epoch) + prereqWeight * 14 + branchExtra);
}

function finalizeTechTree(tree) {
  for (const group of Object.values(tree)) {
    for (const node of group.nodes || []) {
      // 0/null/undefined = illimité côté jeu. Les anciens plafonds ne sont plus utilisés.
      node.maxLevel = 0;
      node.unlimited = true;
      node.baseCostMoney ??= node.costMoney ?? 50000;
      node.baseDurationSeconds ??= node.baseDuration ?? node.duration ?? computedResearchBaseDurationSeconds(node);
      node.costGrowth ??= node.unlockOnly ? 1.35 : 1.62;
      node.durationGrowth ??= node.unlockOnly ? 1.34 : 1.50;
      node.levelValue ??= 1;
      node.unlocks ||= [];
      node.improves ||= node.effects || [];
      const levelEffect = node.disableAutoLevelEffect ? '' : researchLevelEffectText(node);
      if (levelEffect && !node.improves.includes(levelEffect)) node.improves.push(levelEffect);
      node.effects = [...node.unlocks, ...node.improves];
    }
  }
  return tree;
}

function researchLevelEffectText(node) {
  const byId = {
    steam_power: '+4 % de portée vapeur par niveau.',
    regen_braking: '-3,5 % de coût électricité/batterie par niveau, plafonné à -18 %.',
    energy_dispatch: '-2,4 % de coût énergie général par niveau, plafonné à -12 %.',
    depot_methods: '-2,5 % de coût maintenance et -1,8 % d’usure par niveau, avec plafond.',
    rapid_workshops: '-4,5 % de durée d’atelier par niveau, avec plafond.',
    predictive_maintenance: '-2,5 % d’usure et +0,16 capacité maintenance par niveau.',
    safety_training: '+0,6 point de fiabilité et meilleure efficacité des agents par niveau.',
    block_signaling: '+2 % d’attractivité exploitation par niveau, plafonné à +10 %.',
    centralized_control: '+2,4 % d’attractivité réseau par niveau, plafonné à +12 %.',
    passenger_flow: '+2,6 % de flux voyageurs et capacité gares par niveau, plafonné à +13 %.',
    intermodal_hubs: '+3,2 % de demande intermodale par niveau, plafonné à +16 %.',
    specialized_wagons: '+3 % de demande fret spécialisée par niveau, plafonné à +15 %.',
    container_hubs: '+4 % de demande conteneurs par niveau, plafonné à +20 %.',
    crew_training: '+4,5 % d’efficacité RH par niveau et baisse progressive de masse salariale.'
  };
  if (byId[node.id]) return byId[node.id];
  const byBranch = {
    traction: '+1 niveau de branche Traction : Meilleure portée, vitesse commerciale ou confort selon le matériel concerné.',
    energy: '+1 niveau de branche Énergie : Coûts de traction plus stables et meilleure efficacité énergétique.',
    maintenance: '+1 niveau de branche Maintenance : Moins d’usure, moins d’immobilisation ou moins de coût atelier.',
    operations: '+1 niveau de branche Exploitation : Meilleure ponctualité, débit ou robustesse des fréquences.',
    stations: '+1 niveau de branche Gares : Plus de capacité, satisfaction ou revenus annexes.',
    freight: '+1 niveau de branche Fret : Meilleure capture de demande, taux de chargement ou revenu par tonne.',
    social: '+1 niveau de branche RH : Meilleure productivité, sécurité ou vitesse de recherche.'
  };
  return byBranch[node.branch] || byBranch[node.group] || '';
}

function buildWorld() {
  const stations = [
    st('PAR', 'Paris', 48.8566, 2.3522, 'Île-de-France', 1000, 90, 100),
    st('LYO', 'Lyon Part-Dieu', 45.7600, 4.8590, 'Auvergne-Rhône-Alpes', 720, 85, 72),
    st('MAR', 'Marseille Saint-Charles', 43.3027, 5.3806, 'Provence-Alpes-Côte d’Azur', 650, 95, 88),
    st('LIL', 'Lille Flandres', 50.6366, 3.0709, 'Hauts-de-France', 560, 80, 55),
    st('BOR', 'Bordeaux Saint-Jean', 44.8259, -0.5567, 'Nouvelle-Aquitaine', 520, 70, 78),
    st('NAN', 'Nantes', 47.2173, -1.5419, 'Pays de la Loire', 470, 74, 65),
    st('STR', 'Strasbourg', 48.5850, 7.7330, 'Grand Est', 420, 70, 68),
    st('REN', 'Rennes', 48.1035, -1.6722, 'Bretagne', 390, 48, 58),
    st('TOU', 'Toulouse Matabiau', 43.6111, 1.4536, 'Occitanie', 520, 60, 67),
    st('MON', 'Montpellier Saint-Roch', 43.6045, 3.8806, 'Occitanie', 360, 48, 75),
    st('NIC', 'Nice-Ville', 43.7046, 7.2619, 'Provence-Alpes-Côte d’Azur', 400, 42, 96),
    st('GRE', 'Grenoble', 45.1910, 5.7140, 'Auvergne-Rhône-Alpes', 270, 42, 82),
    st('DIJ', 'Dijon', 47.3230, 5.0270, 'Bourgogne-Franche-Comté', 260, 70, 45),
    st('MET', 'Metz', 49.1090, 6.1770, 'Grand Est', 230, 74, 35),
    st('NAN2', 'Nancy', 48.6890, 6.1740, 'Grand Est', 220, 62, 42),
    st('REI', 'Reims', 49.2583, 4.0317, 'Grand Est', 240, 48, 46),
    st('AMI', 'Amiens', 49.8940, 2.2950, 'Hauts-de-France', 200, 42, 35),
    st('ROU', 'Rouen Rive-Droite', 49.4480, 1.0940, 'Normandie', 260, 58, 45),
    st('LEH', 'Le Havre', 49.4920, 0.1250, 'Normandie', 220, 120, 46),
    st('BRET', 'Brétigny-sur-Orge', 48.6114, 2.3059, 'Île-de-France', passengerDemandFromPopulation(26658), 26, 34, 26658),
    st('LONJ', 'Longjumeau', 48.6951, 2.2943, 'Île-de-France', passengerDemandFromPopulation(21700), 24, 30, 21700),
    st('CAE', 'Caen', 49.1829, -0.3707, 'Normandie', 220, 38, 50),
    st('FAL', 'Falaise', 48.8920, -0.1970, 'Normandie', passengerDemandFromPopulation(8000), 20, 30, 8000),
    st('BAY', 'Bayeux', 49.2765, -0.7039, 'Normandie', 80, 18, 58),
    st('ARP', 'Arpajon', 48.5896, 2.2467, 'Île-de-France', passengerDemandFromPopulation(11144), 22, 28, 11144),
    st('CHB', 'Cherbourg', 49.6337, -1.6221, 'Normandie', 120, 55, 42),
    st('BRE', 'Brest', 48.3904, -4.4861, 'Bretagne', 210, 62, 63),
    st('QUI', 'Quimper', 47.9960, -4.0960, 'Bretagne', 140, 28, 64),
    st('LOR', 'Lorient', 47.7480, -3.3660, 'Bretagne', 140, 55, 54),
    st('VAN', 'Vannes', 47.6580, -2.7600, 'Bretagne', 150, 26, 70),
    st('STB', 'Saint-Brieuc', 48.5070, -2.7650, 'Bretagne', 140, 30, 48),
    st('ANG', 'Angers Saint-Laud', 47.4640, -0.5560, 'Pays de la Loire', 230, 44, 52),
    st('LEM', 'Le Mans', 48.0060, 0.1990, 'Pays de la Loire', 260, 60, 45),
    st('TOU2', 'Tours', 47.3900, 0.6930, 'Centre-Val de Loire', 250, 46, 70),
    st('ORL', 'Orléans', 47.9020, 1.9040, 'Centre-Val de Loire', 230, 48, 46),
    st('LIM', 'Limoges', 45.8360, 1.2670, 'Nouvelle-Aquitaine', 190, 38, 42),
    st('POI', 'Poitiers', 46.5820, 0.3400, 'Nouvelle-Aquitaine', 210, 40, 45),
    st('LAR', 'La Rochelle', 46.1520, -1.1450, 'Nouvelle-Aquitaine', 180, 48, 82),
    st('BIA', 'Biarritz', 43.4590, -1.5450, 'Nouvelle-Aquitaine', 170, 30, 88),
    st('PAU', 'Pau', 43.2950, -0.3700, 'Nouvelle-Aquitaine', 160, 28, 58),
    st('AGE', 'Agen', 44.2040, 0.6170, 'Nouvelle-Aquitaine', 120, 36, 38),
    st('CLE', 'Clermont-Ferrand', 45.7780, 3.0870, 'Auvergne-Rhône-Alpes', 230, 44, 62),
    st('STE', 'Saint-Étienne', 45.4430, 4.3990, 'Auvergne-Rhône-Alpes', 220, 58, 35),
    st('VAL', 'Valence TGV', 44.9910, 4.9780, 'Auvergne-Rhône-Alpes', 200, 52, 52),
    st('AVI', 'Avignon TGV', 43.9210, 4.7860, 'Provence-Alpes-Côte d’Azur', 230, 42, 80),
    st('TOU3', 'Toulon', 43.1280, 5.9290, 'Provence-Alpes-Côte d’Azur', 260, 80, 82),
    st('CAN', 'Cannes', 43.5528, 7.0174, 'Provence-Alpes-Côte d’Azur', 220, 28, 96),
    st('PER', 'Perpignan', 42.6960, 2.8790, 'Occitanie', 190, 44, 72),
    st('NIM', 'Nîmes', 43.8330, 4.3660, 'Occitanie', 220, 42, 62),
    st('BEZ', 'Béziers', 43.3440, 3.2190, 'Occitanie', 150, 40, 62),
    st('CAR', 'Carcassonne', 43.2130, 2.3530, 'Occitanie', 130, 22, 80),
    st('ALB', 'Albi', 43.9290, 2.1460, 'Occitanie', 120, 28, 55),
    st('MUL', 'Mulhouse', 47.7420, 7.3430, 'Grand Est', 210, 92, 42),
    st('BES', 'Besançon', 47.2380, 6.0250, 'Bourgogne-Franche-Comté', 170, 48, 48),
    st('BEL', 'Belfort-Montbéliard TGV', 47.5860, 6.8990, 'Bourgogne-Franche-Comté', 140, 70, 36),
    st('CHA', 'Chambéry', 45.5720, 5.9200, 'Auvergne-Rhône-Alpes', 180, 34, 86),
    st('ANN', 'Annecy', 45.9010, 6.1220, 'Auvergne-Rhône-Alpes', 170, 28, 90),
    st('MAC', 'Mâcon-Loché TGV', 46.2830, 4.7780, 'Bourgogne-Franche-Comté', 130, 52, 42),
    st('AUX', 'Auxerre', 47.7970, 3.5700, 'Bourgogne-Franche-Comté', 110, 34, 42),
    st('TRO', 'Troyes', 48.2970, 4.0740, 'Grand Est', 160, 44, 40),
    st('DUN', 'Dunkerque', 51.0340, 2.3770, 'Hauts-de-France', 160, 130, 34),
    st('CAL', 'Calais', 50.9510, 1.8580, 'Hauts-de-France', 150, 75, 45),
    st('ARR', 'Arras', 50.2860, 2.7810, 'Hauts-de-France', 190, 46, 42),
    st('VAL2', 'Valenciennes', 50.3570, 3.5260, 'Hauts-de-France', 170, 75, 32),
    st('LAV', 'Laval', 48.0730, -0.7710, 'Pays de la Loire', 110, 26, 35),
    st('LRS', 'La Roche-sur-Yon', 46.6710, -1.4350, 'Pays de la Loire', 120, 34, 50),
    st('NEV', 'Nevers', 46.9930, 3.1580, 'Bourgogne-Franche-Comté', 120, 44, 35),
    st('BOU', 'Bourges', 47.0830, 2.3960, 'Centre-Val de Loire', 130, 40, 42),
    st('CHA2', 'Châteauroux', 46.8090, 1.6910, 'Centre-Val de Loire', 100, 30, 32)
  ];
  const stationIndex = Object.fromEntries(stations.map(s => [s.id, s]));
  const regions = [...new Set(stations.map(s => s.region))].sort();
  const outlines = franceOutlines();
  const railGraph = buildRailGraph();
  return {
    bounds: computeBounds(outlines),
    stations,
    stationIndex,
    regions,
    outline: outlines[0],
    outlines,
    railGraph,
    railAdjacency: buildRailAdjacencyIndex(railGraph)
  };
}

function franceOutlines() {
  const mainland = [
    [2.55, 51.09], [2.13, 51.04], [1.58, 50.99], [1.25, 50.73], [1.64, 50.22], [1.36, 50.06], [1.08, 49.95],
    [0.68, 49.51], [0.22, 49.47], [-0.10, 49.42], [-0.36, 49.34], [-0.65, 49.33], [-1.00, 49.37], [-1.27, 49.39],
    [-1.62, 49.66], [-1.86, 49.72], [-2.20, 49.49], [-2.48, 49.31], [-2.80, 49.18], [-3.22, 48.85], [-3.52, 48.79],
    [-3.91, 48.73], [-4.37, 48.52], [-4.77, 48.41], [-4.73, 48.22], [-4.56, 48.06], [-4.70, 47.85], [-4.46, 47.75],
    [-4.18, 47.79], [-3.75, 47.72], [-3.49, 47.63], [-3.19, 47.53], [-2.82, 47.43], [-2.48, 47.33], [-2.17, 47.27],
    [-1.86, 47.06], [-1.62, 46.82], [-1.30, 46.42], [-1.17, 46.16], [-1.17, 45.72], [-1.08, 45.41], [-1.20, 45.12],
    [-1.10, 44.79], [-1.24, 44.65], [-1.16, 44.37], [-1.29, 44.10], [-1.54, 43.78], [-1.78, 43.49], [-1.48, 43.35],
    [-1.19, 43.25], [-0.74, 43.12], [-0.38, 42.98], [0.00, 42.87], [0.56, 42.82], [1.14, 42.72], [1.64, 42.62],
    [2.13, 42.43], [2.51, 42.34], [3.04, 42.32], [3.15, 42.43], [3.07, 42.78], [3.30, 43.05], [3.73, 43.23],
    [4.24, 43.34], [4.70, 43.38], [5.05, 43.26], [5.36, 43.20], [5.77, 43.10], [6.17, 43.09], [6.57, 43.16],
    [6.93, 43.36], [7.39, 43.55], [7.53, 43.79], [7.72, 44.05], [7.47, 44.31], [7.05, 44.71], [6.82, 45.08],
    [7.05, 45.46], [6.78, 45.75], [6.84, 46.18], [6.43, 46.43], [6.53, 46.78], [6.14, 47.04], [6.55, 47.49],
    [7.05, 47.67], [7.50, 47.62], [7.60, 47.82], [7.80, 48.13], [7.62, 48.58], [7.15, 48.97], [6.72, 49.17],
    [6.18, 49.46], [5.82, 49.55], [5.47, 49.50], [5.04, 49.78], [4.58, 49.99], [4.08, 49.99], [3.62, 50.31],
    [3.15, 50.52], [2.78, 50.73], [2.55, 51.09]
  ];
  const corsica = [
    [8.55, 42.95], [8.78, 43.02], [9.08, 42.86], [9.28, 42.66], [9.44, 42.43], [9.54, 42.10], [9.50, 41.78],
    [9.30, 41.42], [8.98, 41.34], [8.73, 41.52], [8.57, 41.82], [8.62, 42.16], [8.54, 42.46], [8.55, 42.72], [8.55, 42.95]
  ];
  return [mainland, corsica];
}

function buildRailGraph() {
  return [
    ['PAR', 'LIL'], ['PAR', 'AMI'], ['PAR', 'ROU'], ['PAR', 'CAE'], ['ROU', 'PAR'], ['CAE', 'REN'], ['REN', 'NAN'], ['LIL', 'DUN'], ['LIL', 'CAL'], ['LIL', 'ARR'], ['ARR', 'AMI'], ['AMI', 'ROU'], ['ROU', 'LEH'], ['ROU', 'CAE'], ['CAE', 'BAY'], ['BAY', 'CHB'],
    ['PAR', 'REI'], ['REI', 'MET'], ['MET', 'NAN2'], ['NAN2', 'STR'], ['STR', 'MUL'], ['MUL', 'BEL'], ['BEL', 'BES'], ['BES', 'DIJ'], ['DIJ', 'PAR'],
    ['PAR', 'ORL'], ['ORL', 'TOU2'], ['TOU2', 'POI'], ['POI', 'BOR'], ['BOR', 'BIA'], ['BIA', 'PAU'], ['BOR', 'AGE'], ['AGE', 'TOU'],
    ['PAR', 'LEM'], ['LEM', 'LAV'], ['LAV', 'REN'], ['REN', 'STB'], ['STB', 'BRE'], ['BRE', 'QUI'], ['QUI', 'LOR'], ['LOR', 'VAN'], ['VAN', 'NAN'], ['NAN', 'ANG'], ['ANG', 'TOU2'],
    ['NAN', 'LRS'], ['LRS', 'LAR'], ['LAR', 'BOR'], ['PAR', 'AUX'], ['AUX', 'DIJ'], ['DIJ', 'MAC'], ['MAC', 'LYO'], ['LYO', 'STE'], ['LYO', 'VAL'], ['VAL', 'AVI'],
    ['AVI', 'MAR'], ['MAR', 'TOU3'], ['TOU3', 'CAN'], ['CAN', 'NIC'], ['AVI', 'NIM'], ['NIM', 'MON'], ['MON', 'BEZ'], ['BEZ', 'PER'], ['BEZ', 'CAR'], ['CAR', 'TOU'],
    ['TOU', 'ALB'], ['TOU', 'AGE'], ['PAR', 'NEV'], ['NEV', 'BOU'], ['BOU', 'CHA2'], ['CHA2', 'LIM'], ['LIM', 'POI'], ['LYO', 'GRE'], ['GRE', 'CHA'], ['CHA', 'ANN'], ['CLE', 'LYO'], ['CLE', 'NEV']
  ];
}

function buildRailAdjacencyIndex(graph) {
  const adj = {};
  for (const [a, b] of graph) {
    (adj[a] ||= []).push(b);
    (adj[b] ||= []).push(a);
  }
  return adj;
}

function computeBounds(outlines) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const shape of outlines) {
    for (const [lon, lat] of shape) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLon: minLon - 0.35, maxLon: maxLon + 0.35, minLat: minLat - 0.25, maxLat: maxLat + 0.2 };
}

function st(id, name, lat, lon, region, baseDemand, freight, tourism, population = 0) {
  const station = { id, name, lat, lon, region, baseDemand, freight, tourism };
  if (Number.isFinite(Number(population)) && Number(population) > 0) {
    station.population = Math.round(Number(population));
    station.baseDemand = passengerDemandFromPopulation(population);
    station.populationSource = 'manuel';
  }
  return station;
}
