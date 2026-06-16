'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, 'data', 'communes-5000-population.json');

function normalize(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/gare|station|sncf|saint|sainte|st\.?|ste\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function push(map, key, item) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

function duplicates(map) {
  return [...map.entries()].filter(([, items]) => items.length > 1);
}

const raw = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
const stations = Array.isArray(raw.stations) ? raw.stations : [];
const byId = new Map();
const byCode = new Map();
const byStationUic = new Map();
const byStationCoord = new Map();
const byPublicCoordName = new Map();

for (const station of stations) {
  const item = `${station.id || '?'} ${station.name || ''}`;
  push(byId, station.id, item);
  if (!station.multiStation && !station.allowSameCommuneStation) push(byCode, station.code, item);
  push(byStationUic, station.stationUic, item);
  const lat = Number(station.stationLat ?? station.lat);
  const lon = Number(station.stationLon ?? station.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    push(byPublicCoordName, `${lat.toFixed(5)},${lon.toFixed(5)}:${normalize(station.name)}`, item);
  }
  const slat = Number(station.stationLat);
  const slon = Number(station.stationLon);
  if (Number.isFinite(slat) && Number.isFinite(slon)) {
    push(byStationCoord, `${slat.toFixed(5)},${slon.toFixed(5)}`, item);
  }
}

const checks = [
  ['IDs', duplicates(byId)],
  ['codes INSEE hors communes multi-gares', duplicates(byCode)],
  ['codes UIC gare', duplicates(byStationUic)],
  ['coordonnées gare', duplicates(byStationCoord)],
  ['coordonnées publiques + nom', duplicates(byPublicCoordName)]
];

let errors = 0;
console.log(`Contrôle doublons gares/villes — ${stations.length} entrées`);
console.log(`sourceVersion=${raw.sourceVersion || 0}, sncfMatched=${raw.sncfStats?.matched || 0}, sncfStations=${raw.sncfStats?.totalStations || 0}`);
for (const [label, dups] of checks) {
  if (!dups.length) {
    console.log(`OK — aucun doublon sur ${label}`);
    continue;
  }
  console.error(`DOUBLONS — ${label}: ${dups.length}`);
  for (const [key, items] of dups.slice(0, 8)) console.error(`  ${key}: ${items.join(' | ')}`);
  errors += dups.length;
}

if (errors) process.exit(1);
