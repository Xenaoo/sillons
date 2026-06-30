// Score, routes simplifiées, balance, arbre R&D, monde de base et utilitaires généraux.
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
  const canonical = currentStationId(id);
  const found = communeCache.byId?.[canonical] || communeCache.byId?.[id] || null;
  return found ? canonicalizeStationDisplay(found) : null;
}


function routeAdjacencyFor(a, b) {
  const adjacency = {};
  for (const [id, list] of Object.entries(WORLD.railAdjacency || {})) adjacency[id] = [...list];

  addLocalRouteShortcut(adjacency, a, b);

  for (const id of [a, b]) {
    if (!id || WORLD.stationIndex[id]) continue;
    const station = stationById(id);
    if (!station) continue;
    adjacency[id] ||= [];
    const anchors = nearestRailAnchorsForStation(station, station.commune ? 6 : 4);
    const stationPoint = stationRoutePoint(station) || stationRawPoint(station);
    const nearest = anchors.length
      ? anchors.map(anchorId => ({ id: anchorId }))
      : WORLD.stations
          .map(s => {
            const candidatePoint = stationRoutePoint(s) || stationRawPoint(s);
            return { id: s.id, d: candidatePoint && stationPoint ? haversine(stationPoint.lat, stationPoint.lon, candidatePoint.lat, candidatePoint.lon) : Infinity };
          })
          .sort((x, y) => x.d - y.d)
          .slice(0, station.commune ? 4 : 3);
    for (const n of nearest) {
      adjacency[id].push(n.id);
      (adjacency[n.id] ||= []).push(id);
    }
  }
  return adjacency;
}


function stationsShareProjectedRailSegment(a, b) {
  const pa = stationRailPlacement(stationById(a));
  const pb = stationRailPlacement(stationById(b));
  if (!pa || !pb) return false;
  if (pa.railSegment && pb.railSegment && pa.railSegment === pb.railSegment) return true;
  if (pa.stationUic && pb.stationUic && pa.stationUic === pb.stationUic) return true;
  return false;
}

function addLocalRouteShortcut(adjacency, a, b) {
  if (!a || !b || a === b) return;
  const sa = stationById(a);
  const sb = stationById(b);
  if (!sa || !sb) return;
  const direct = edgeDistance(a, b);
  if (!Number.isFinite(direct) || direct <= 0) return;
  const allowDirect = direct <= 45 || stationsShareProjectedRailSegment(a, b);
  if (!allowDirect) return;
  adjacency[a] ||= [];
  adjacency[b] ||= [];
  if (!adjacency[a].includes(b)) adjacency[a].push(b);
  if (!adjacency[b].includes(a)) adjacency[b].push(a);
}

const _routeCache = new Map();

function getRouteCache(key) {
  if (!_routeCache.has(key)) return null;
  const value = _routeCache.get(key);
  _routeCache.delete(key);
  _routeCache.set(key, value);
  return value;
}

function rememberRouteCache(key, route) {
  if (_routeCache.has(key)) _routeCache.delete(key);
  _routeCache.set(key, route);
  while (_routeCache.size > ROUTE_CACHE_MAX_ENTRIES) {
    const oldestKey = _routeCache.keys().next().value;
    _routeCache.delete(oldestKey);
  }
  return route;
}


function distanceBetween(a, b) {
  return routeBetween(a, b).distance;
}

function routeBetweenStops(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.length < 2) return { ids, distance: 0, maxSegment: 0 };
  const key = `multi::${ids.join('::')}`;
  const cached = getRouteCache(key);
  if (cached) return cached;

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
  return rememberRouteCache(key, route);
}

function routeBetween(a, b) {
  if (a === b) return { ids: [a], distance: 0, maxSegment: 0 };
  const key = `${a}::${b}`;
  const cached = getRouteCache(key);
  if (cached) return cached;
  const reverseKey = `${b}::${a}`;
  const reverse = getRouteCache(reverseKey);
  if (reverse) {
    const route = { ...reverse, ids: [...reverse.ids].reverse() };
    return rememberRouteCache(key, route);
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

  const direct = edgeDistance(a, b);
  if (direct > 0 && Number.isFinite(dist[b]) && dist[b] > Math.max(35, direct * 2.35) && direct <= 85) {
    ids = [a, b];
    dist[b] = direct;
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
  return rememberRouteCache(key, route);
}

function effectiveTrainRange(player, model, routeInfo) {
  return Math.max(1, Math.round(Number(model?.range || 0)));
}

function edgeDistance(a, b) {
  const sa = stationRoutePoint(stationById(a));
  const sb = stationRoutePoint(stationById(b));
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

function cleanOptionalText(value, max) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) { return Math.round(value * 100) / 100; }
function roundCoord(value) { return Math.round(Number(value) * 1000000) / 1000000; }
function money(value) { return `${Math.round(value).toLocaleString('fr-FR')} €`; }
function formatCycles(value) {
  const cycles = Math.max(1, Math.ceil(Number(value || 1)));
  return cycles <= 1 ? '1 cycle' : `${cycles} cycles`;
}

function formatDurationMs(value) {
  const totalMinutes = Math.max(1, Math.ceil(Number(value || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${totalMinutes} min`;
  if (minutes <= 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function trainConstructionDurationMs(model) {
  const maxEpoch = Math.max(1, (BALANCE?.epochs?.length || 7) - 1);
  const era = clamp(Math.floor(Number(model?.unlockEpoch || 0)), 0, maxEpoch);
  const techRank = clamp((Math.max(1, Number(model?.requiredTechLevel || 1)) - 1) / 7, 0, 1);
  const price = Math.max(95000, Number(model?.price || 95000));
  const priceRank = clamp((Math.log10(price) - Math.log10(95000)) / (Math.log10(92000000) - Math.log10(95000)), 0, 1);
  const inEraRank = clamp(techRank * 0.7 + priceRank * 0.3, 0, 1);
  const globalRank = clamp((era + inEraRank) / (maxEpoch + 1), 0, 1);
  const minMs = 60 * 1000;
  const maxMs = 20 * HOUR_MS;
  return Math.round(minMs + Math.pow(globalRank, 1.55) * (maxMs - minMs));
}

function maintenanceFacilityConstructionDurationMs(player, facilityId) {
  const facility = BALANCE.maintenanceFacilities?.[facilityId];
  if (!facility) return 0;
  const level = maintenanceFacilityLevel(player, facilityId);
  const baseMs = Math.max(0, Number(facility.baseConstructionMs || 0));
  const growth = Math.max(1, Number(facility.constructionGrowth || facility.growth || 1.25));
  return Math.round(baseMs * Math.pow(growth, level));
}

function trainCatalogEntries() {
  const file = path.join(__dirname, 'data', 'sillons_train_catalog_v1.json');
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
  const trains = Array.isArray(catalog?.trains) ? catalog.trains : [];
  if (Number(catalog?.schemaVersion) !== 1 || trains.length !== 70) {
    throw new Error('Catalogue trains invalide : 70 modèles attendus.');
  }
  const ids = new Set(trains.map(train => String(train?.id || '')));
  if (ids.size !== 70 || ids.has('')) throw new Error('Catalogue trains invalide : identifiants uniques requis.');
  return trains;
}

function catalogGameplay(entry, key) {
  return Number(entry?.gameplay?.[key] || 0);
}

function catalogHasRole(entry, role) {
  return (entry?.role || []).some(value => String(value).toLowerCase() === role);
}

function catalogEnergyType(entry) {
  const era = String(entry?.era || '');
  if (era === 'steam') return 'coal';
  if (era === 'diesel') return 'diesel';
  if (era === 'hydrogen') return 'hydrogen';
  if (era === 'battery') return 'battery';
  return 'electricity';
}

function catalogTrainSpeed(entry) {
  const score = catalogGameplay(entry, 'speed');
  const era = entry.era;
  const formulas = {
    steam: () => 45 + score * 1.45,
    diesel: () => 75 + score * 1.65,
    electric: () => 80 + score * 2.1,
    high_speed: () => 160 + score * 2,
    hydrogen: () => 70 + score * 1.7,
    battery: () => 95 + score * 1.5,
    maglev: () => 70 + score * 5
  };
  return Math.round((formulas[era] || (() => 80 + score * 1.5))());
}

function catalogTrainRange(entry) {
  const score = catalogGameplay(entry, 'range');
  const factor = { steam: 3, diesel: 3.4, electric: 4, high_speed: 6, hydrogen: 4.5, battery: 3.8, maglev: 13 }[entry.era] || 4;
  return Math.max(30, Math.round(score * factor));
}

function catalogTrainPrice(entry) {
  const score = catalogGameplay(entry, 'purchaseCost');
  switch (entry.era) {
    case 'steam': return Math.round(30000 + score * 5000);
    case 'diesel': return Math.round(180000 + score * 20000);
    case 'electric': return Math.round(300000 + score * score * 650);
    case 'high_speed': return Math.round(500000 + Math.pow(Math.max(0, score - 60), 2) * 12000);
    case 'hydrogen': return Math.round(1000000 + Math.max(0, score - 45) * 180000);
    case 'battery': return Math.round(1500000 + score * 120000);
    case 'maglev': return Math.round(10000000 + score * 800000);
    default: return Math.round(250000 + score * 50000);
  }
}

function catalogTrainEnergy(entry) {
  const efficiency = catalogGameplay(entry, 'efficiency');
  const baseline = { steam: 18, diesel: 10, electric: 9.5, high_speed: 16, hydrogen: 6, battery: 6, maglev: 15 }[entry.era] || 9;
  const factor = { steam: 0.3, diesel: 0.1, electric: 0.05, high_speed: 0.05, hydrogen: 0.03, battery: 0.03, maglev: 0.05 }[entry.era] || 0.05;
  return round2(Math.max(0.1, baseline - efficiency * factor));
}

function catalogTrainMaintenance(entry) {
  const score = catalogGameplay(entry, 'maintenanceCost');
  const factor = { steam: 0.95, diesel: 0.65, electric: 0.6, high_speed: 0.95, hydrogen: 0.5, battery: 0.4, maglev: 0.9 }[entry.era] || 0.6;
  return round2(0.16 + score / 100 * factor);
}

function catalogTrainRequiredTech(entry) {
  const freightOnly = catalogHasRole(entry, 'fret') && !(catalogHasRole(entry, 'voyageurs') || catalogHasRole(entry, 'voyageurs régional'));
  const level = Math.max(1, Math.floor(catalogGameplay(entry, 'unlockLevel')));
  if (entry.era === 'steam') {
    if (freightOnly) return level <= 2 ? 'steam_freight_locomotives' : 'steam_articulated_locomotives';
    return level <= 1 ? 'steam_first_locomotives' : level <= 2 ? 'steam_passenger_locomotives' : level <= 3 ? 'steam_reinforced_brakes' : 'steam_articulated_locomotives';
  }
  if (entry.era === 'diesel') {
    if (freightOnly) return level <= 1 ? 'diesel_shunters' : 'diesel_freight_locomotives';
    if (entry.category === 'autorail') return level <= 1 ? 'diesel_light_railcars' : 'diesel_mechanical';
    return level <= 1 ? 'diesel_first_engines' : 'diesel_passenger_locomotives';
  }
  if (entry.era === 'electric') {
    if (entry.category === 'automotrice') return level <= 1 ? 'electric_third_rail' : level <= 2 ? 'electric_dc_catenary' : 'electric_emus';
    return level <= 1 ? 'electric_first_trains' : level <= 2 ? 'electric_locomotives' : 'electric_dual_current_trains';
  }
  if (entry.era === 'high_speed') return level <= 1 ? 'hsv_first_fast_trains' : level <= 2 ? 'hsv_trainsets' : level <= 4 ? 'hsv_distributed_traction' : 'hsv_premium_long_distance';
  if (entry.era === 'hydrogen') return level <= 1 ? 'hydrogen_first_trains' : level <= 2 ? 'hydrogen_regional_trains' : level <= 4 ? 'hydrogen_rural_lines' : 'hydrogen_next_generation';
  if (entry.era === 'battery') return level <= 1 ? 'battery_first_trains' : level <= 2 ? 'battery_suburban_trains' : level <= 3 ? 'battery_regional_trains' : 'battery_high_density';
  if (entry.era === 'maglev') return level <= 1 ? 'maglev_levitation' : level <= 3 ? 'maglev_guidance' : level <= 4 ? 'maglev_linear_propulsion' : 'maglev_next_generation';
  return '';
}

function catalogTrainModel(entry) {
  const power = catalogGameplay(entry, 'tractionPower');
  const freightOnly = catalogHasRole(entry, 'fret') && !(catalogHasRole(entry, 'voyageurs') || catalogHasRole(entry, 'voyageurs régional'));
  const maneuver = catalogHasRole(entry, 'manœuvre');
  const locomotive = entry.category === 'locomotive';
  let capacity = 0;
  let freight = 0;
  if (locomotive) {
    capacity = freightOnly || maneuver ? 0 : Math.round(150 + power * 3.8);
    freight = maneuver ? Math.round(180 + power * 8) : freightOnly ? Math.round(250 + power * 9) : Math.round(80 + power * 5.3);
  } else if (entry.era === 'high_speed') {
    capacity = Math.round(600 + power * 5.2);
  } else if (entry.era === 'maglev') {
    capacity = Math.round(450 + power * 5);
  } else if (entry.era === 'electric') {
    capacity = Math.round(440 + power * 4);
  } else if (entry.era === 'diesel') {
    capacity = Math.round(300 + power * 6);
  } else {
    capacity = Math.round(380 + power * 5);
  }

  const type = locomotive
    ? `Locomotive ${entry.traction}`
    : entry.category === 'rame grande vitesse'
      ? 'Rame grande vitesse'
      : entry.category === 'rame maglev'
        ? 'Rame maglev'
        : 'Automotrice';
  return {
    id: entry.id,
    name: entry.gameName,
    type,
    unlockEpoch: { steam: 0, diesel: 1, electric: 2, high_speed: 3, hydrogen: 4, battery: 5, maglev: 6 }[entry.era],
    speed: catalogTrainSpeed(entry),
    capacity,
    freight,
    energyType: catalogEnergyType(entry),
    energy: catalogTrainEnergy(entry),
    maintenance: catalogTrainMaintenance(entry),
    price: catalogTrainPrice(entry),
    reliability: round2(clamp(0.35 + catalogGameplay(entry, 'reliability') * 0.0065, 0.45, 0.97)),
    comfort: round2(clamp(0.2 + catalogGameplay(entry, 'prestige') * 0.007, 0.2, 0.95)),
    range: catalogTrainRange(entry),
    description: entry.notes,
    requiredTech: catalogTrainRequiredTech(entry),
    requiredTechLevel: Math.min(5, Math.max(1, Math.floor(catalogGameplay(entry, 'unlockLevel')))),
    catalog: {
      era: entry.era,
      priority: entry.priority,
      category: entry.category,
      traction: entry.traction,
      role: entry.role,
      origin: entry.origin,
      realReference: entry.realReference,
      realWorld: entry.realWorld,
      gameplay: entry.gameplay
    }
  };
}

function buildTrainCatalogModels() {
  const models = {};
  for (const entry of trainCatalogEntries()) models[entry.id] = catalogTrainModel(entry);
  normalizeTrainModelCompositionFlags(models);
  return models;
}

function buildBalance() {
  const epochs = [
    { id: 0, name: 'Ère de la vapeur', year: 1850, requiredTech: 0, requiredTraffic: 0, requiredResearch: [] },
    { id: 1, name: 'Ère du diesel', year: 1930, requiredTech: 20, requiredTraffic: 25000000, requiredResearch: [{ id: 'steam_network_standards', level: 4 }, { id: 'passenger_slots_steam', level: 2 }, { id: 'freight_slots_steam', level: 2 }] },
    { id: 2, name: 'Ère de l’électrique', year: 1950, requiredTech: 50, requiredTraffic: 125000000, requiredResearch: [{ id: 'diesel_electric', level: 4 }, { id: 'block_signaling', level: 4 }, { id: 'passenger_slots_diesel', level: 2 }] },
    { id: 3, name: 'Ère de la grande vitesse', year: 1980, requiredTech: 90, requiredTraffic: 600000000, requiredResearch: [{ id: 'electric_locomotives', level: 4 }, { id: 'electric_energy_recovery', level: 3 }, { id: 'freight_slots_electric', level: 2 }] },
    { id: 4, name: 'Ère de l’hydrogène', year: 2025, requiredTech: 145, requiredTraffic: 2500000000, requiredResearch: [{ id: 'hsv_trainsets', level: 4 }, { id: 'hsv_signaling', level: 4 }, { id: 'traffic_simulation', level: 3 }] },
    { id: 5, name: 'Ère de la batterie', year: 2035, requiredTech: 205, requiredTraffic: 8000000000, requiredResearch: [{ id: 'hydrogen_regional_trains', level: 4 }, { id: 'hydrogen_refueling_stations', level: 3 }, { id: 'dynamic_pricing', level: 3 }] },
    { id: 6, name: 'Ère de la sustentation magnétique', year: 2050, requiredTech: 275, requiredTraffic: 24000000000, requiredResearch: [{ id: 'battery_regional_trains', level: 4 }, { id: 'battery_auto_charge_optimization', level: 3 }, { id: 'driverless_corridors', level: 3 }] }
  ];
  /* Catalogue historique retiré en v69.8.13 :
    steam_030_mixte: { id: 'steam_030_mixte', name: 'Locomotive vapeur 030 mixte', unlockEpoch: 0, type: 'Vapeur mixte', speed: 55, capacity: 140, freight: 120, energyType: 'coal', energy: 9.5, maintenance: 0.62, price: 95000, reliability: 0.78, comfort: 0.32, range: 50, description: 'Modèle de départ polyvalent, lent mais économique pour ouvrir les premières lignes.', requiredTech: 'steam_first_locomotives', requiredTechLevel: 1 },
    steam_120_omnibus: { id: 'steam_120_omnibus', name: 'Locomotive vapeur 120 omnibus', unlockEpoch: 0, type: 'Vapeur voyageurs', speed: 70, capacity: 210, freight: 60, energyType: 'coal', energy: 10.8, maintenance: 0.66, price: 135000, reliability: 0.75, comfort: 0.38, range: 75, description: 'Vapeur de desserte voyageurs, adaptée aux lignes régionales naissantes.', requiredTech: 'steam_first_locomotives', requiredTechLevel: 3 },
    steam_040_freight: { id: 'steam_040_freight', name: 'Locomotive vapeur 040 marchandises', unlockEpoch: 0, type: 'Vapeur fret', speed: 45, capacity: 40, freight: 360, energyType: 'coal', energy: 13.2, maintenance: 0.74, price: 155000, reliability: 0.8, comfort: 0.22, range: 90, description: 'Machine lente et tractrice pour les premiers trafics de marchandises.', requiredTech: 'steam_freight_locomotives', requiredTechLevel: 4 },
    steam_220_express: { id: 'steam_220_express', name: 'Locomotive vapeur 220 express', unlockEpoch: 0, type: 'Vapeur express', speed: 95, capacity: 300, freight: 80, energyType: 'coal', energy: 14.2, maintenance: 0.86, price: 235000, reliability: 0.79, comfort: 0.48, range: 125, description: 'Vapeur rapide pour les grands axes voyageurs de l’ère vapeur.', requiredTech: 'steam_passenger_locomotives', requiredTechLevel: 5 },
    steam_241_articulated: { id: 'steam_241_articulated', name: 'Locomotive vapeur articulée 241', unlockEpoch: 0, type: 'Vapeur lourde articulée', speed: 90, capacity: 420, freight: 520, energyType: 'coal', energy: 17.0, maintenance: 1.02, price: 390000, reliability: 0.82, comfort: 0.5, range: 150, description: 'Matériel vapeur lourd de fin d’ère, puissant mais coûteux à entretenir.', requiredTech: 'steam_articulated_locomotives', requiredTechLevel: 8 },

    diesel_shunter_030: { id: 'diesel_shunter_030', name: 'Locotracteur diesel de manœuvre', unlockEpoch: 1, type: 'Diesel manœuvre', speed: 70, capacity: 40, freight: 420, energyType: 'diesel', energy: 6.0, maintenance: 0.43, price: 310000, reliability: 0.83, comfort: 0.24, range: 125, description: 'Engin simple et fiable pour manœuvres, embranchements et fret court.', requiredTech: 'diesel_shunters', requiredTechLevel: 1 },
    diesel_light_railcar: { id: 'diesel_light_railcar', name: 'Autorail diesel léger', unlockEpoch: 1, type: 'Autorail diesel', speed: 110, capacity: 540, freight: 0, energyType: 'diesel', energy: 4.8, maintenance: 0.4, price: 420000, reliability: 0.86, comfort: 0.56, range: 150, description: 'Matériel économique pour lignes secondaires non électrifiées.', requiredTech: 'diesel_light_railcars', requiredTechLevel: 3 },
    diesel_mechanical_regional: { id: 'diesel_mechanical_regional', name: 'Automotrice diesel mécanique', unlockEpoch: 1, type: 'Diesel régional', speed: 125, capacity: 620, freight: 0, energyType: 'diesel', energy: 5.4, maintenance: 0.44, price: 650000, reliability: 0.87, comfort: 0.62, range: 175, description: 'Rame régionale diesel plus capacitaire, efficace hors caténaire.', requiredTech: 'diesel_mechanical', requiredTechLevel: 4 },
    diesel_hydraulic_express: { id: 'diesel_hydraulic_express', name: 'Locomotive diesel hydraulique voyageurs', unlockEpoch: 1, type: 'Diesel voyageurs', speed: 150, capacity: 430, freight: 120, energyType: 'diesel', energy: 7.2, maintenance: 0.56, price: 1150000, reliability: 0.88, comfort: 0.66, range: 210, description: 'Locomotive diesel rapide pour relations voyageurs sans électrification.', requiredTech: 'diesel_passenger_locomotives', requiredTechLevel: 6 },
    diesel_electric_freight: { id: 'diesel_electric_freight', name: 'Locomotive diesel-électrique fret', unlockEpoch: 1, type: 'Diesel-électrique fret', speed: 110, capacity: 0, freight: 950, energyType: 'diesel', energy: 8.8, maintenance: 0.58, price: 1450000, reliability: 0.9, comfort: 0.2, range: 250, description: 'Fret lourd non électrifié, performant sur longues distances.', requiredTech: 'diesel_freight_locomotives', requiredTechLevel: 8 },

    electric_pioneer_loco: { id: 'electric_pioneer_loco', name: 'Locomotive électrique pionnière', unlockEpoch: 2, type: 'Électrique pionnière', speed: 115, capacity: 260, freight: 180, energyType: 'electricity', energy: 6.4, maintenance: 0.55, price: 520000, reliability: 0.84, comfort: 0.5, range: 250, description: 'Premier matériel électrique polyvalent pour lignes équipées.', requiredTech: 'electric_first_trains', requiredTechLevel: 1 },
    electric_third_rail_emu: { id: 'electric_third_rail_emu', name: 'Automotrice troisième rail', unlockEpoch: 2, type: 'Électrique urbain', speed: 100, capacity: 780, freight: 0, energyType: 'electricity', energy: 5.2, maintenance: 0.42, price: 980000, reliability: 0.88, comfort: 0.56, range: 280, description: 'Rame dense pour dessertes urbaines et périurbaines électrifiées.', requiredTech: 'electric_third_rail', requiredTechLevel: 3 },
    electric_dc_regional_emu: { id: 'electric_dc_regional_emu', name: 'Automotrice courant continu régionale', unlockEpoch: 2, type: 'Électrique régionale', speed: 160, capacity: 650, freight: 0, energyType: 'electricity', energy: 5.6, maintenance: 0.38, price: 1250000, reliability: 0.91, comfort: 0.68, range: 320, description: 'Rame régionale performante sur réseau électrifié continu.', requiredTech: 'electric_dc_catenary', requiredTechLevel: 4 },
    electric_dual_current_loco: { id: 'electric_dual_current_loco', name: 'Locomotive bicourant multiservice', unlockEpoch: 2, type: 'Électrique bicourant', speed: 200, capacity: 520, freight: 520, energyType: 'electricity', energy: 8.2, maintenance: 0.64, price: 4200000, reliability: 0.92, comfort: 0.7, range: 360, description: 'Locomotive voyageurs/fret capable de passer entre réseaux électriques.', requiredTech: 'electric_dual_current_trains', requiredTechLevel: 6 },
    electric_heavy_freight: { id: 'electric_heavy_freight', name: 'Locomotive électrique fret lourd', unlockEpoch: 2, type: 'Fret électrique', speed: 140, capacity: 0, freight: 1450, energyType: 'electricity', energy: 9.5, maintenance: 0.62, price: 5100000, reliability: 0.93, comfort: 0.22, range: 400, description: 'Fret lourd électrifié avec très bonne fiabilité et coût énergétique bas.', requiredTech: 'electric_locomotives', requiredTechLevel: 8 },

    hsv_intercity_200: { id: 'hsv_intercity_200', name: 'Train rapide Intercités 200', unlockEpoch: 3, type: 'Train rapide', speed: 200, capacity: 560, freight: 60, energyType: 'electricity', energy: 7.2, maintenance: 0.5, price: 1800000, reliability: 0.9, comfort: 0.72, range: 350, description: 'Matériel de transition vers la grande vitesse, adapté aux grands axes classiques.', requiredTech: 'hsv_first_fast_trains', requiredTechLevel: 1 },
    hsv_trainset_pioneer: { id: 'hsv_trainset_pioneer', name: 'Rame grande vitesse première génération', unlockEpoch: 3, type: 'Grande vitesse', speed: 300, capacity: 760, freight: 0, energyType: 'electricity', energy: 13.5, maintenance: 1.1, price: 14500000, reliability: 0.93, comfort: 0.82, range: 450, description: 'Première rame très rapide, chère mais structurante pour les grands axes.', requiredTech: 'hsv_trainsets', requiredTechLevel: 3 },
    hsv_duplex_capacity: { id: 'hsv_duplex_capacity', name: 'Rame grande vitesse Duplex', unlockEpoch: 3, type: 'Grande vitesse haute capacité', speed: 320, capacity: 1040, freight: 0, energyType: 'electricity', energy: 15.2, maintenance: 1.25, price: 23000000, reliability: 0.94, comfort: 0.86, range: 550, description: 'Grande vitesse à très forte capacité pour axes saturés.', requiredTech: 'hsv_trainsets', requiredTechLevel: 5 },
    hsv_distributed_trainset: { id: 'hsv_distributed_trainset', name: 'Rame grande vitesse à traction répartie', unlockEpoch: 3, type: 'Grande vitesse avancée', speed: 330, capacity: 850, freight: 0, energyType: 'electricity', energy: 13.8, maintenance: 1.05, price: 26000000, reliability: 0.95, comfort: 0.87, range: 625, description: 'Rame de grande vitesse plus efficace grâce à la traction répartie.', requiredTech: 'hsv_distributed_traction', requiredTechLevel: 6 },
    hsv_premium_long_distance: { id: 'hsv_premium_long_distance', name: 'Rame grande distance premium', unlockEpoch: 3, type: 'Grande vitesse premium', speed: 320, capacity: 690, freight: 0, energyType: 'electricity', energy: 14.6, maintenance: 1.18, price: 28500000, reliability: 0.95, comfort: 0.94, range: 700, description: 'Matériel très confortable pour relations longues distances à forte marge.', requiredTech: 'hsv_premium_long_distance', requiredTechLevel: 8 },

    hydrogen_regional_unit: { id: 'hydrogen_regional_unit', name: 'Rame hydrogène régionale', unlockEpoch: 4, type: 'Hydrogène régional', speed: 140, capacity: 580, freight: 0, energyType: 'hydrogen', energy: 4.2, maintenance: 0.36, price: 6200000, reliability: 0.9, comfort: 0.76, range: 250, description: 'Rame propre pour lignes non électrifiées à autonomie correcte.', requiredTech: 'hydrogen_regional_trains', requiredTechLevel: 1 },
    hydrogen_fuel_cell_unit: { id: 'hydrogen_fuel_cell_unit', name: 'Rame hydrogène à pile combustible', unlockEpoch: 4, type: 'Hydrogène optimisé', speed: 150, capacity: 600, freight: 0, energyType: 'hydrogen', energy: 3.9, maintenance: 0.34, price: 7400000, reliability: 0.92, comfort: 0.78, range: 310, description: 'Chaîne hydrogène plus efficace et plus fiable pour dessertes régionales.', requiredTech: 'hydrogen_fuel_cell', requiredTechLevel: 3 },
    hydrogen_rural_unit: { id: 'hydrogen_rural_unit', name: 'Rame hydrogène lignes rurales', unlockEpoch: 4, type: 'Hydrogène rural', speed: 130, capacity: 540, freight: 0, energyType: 'hydrogen', energy: 3.4, maintenance: 0.3, price: 5600000, reliability: 0.91, comfort: 0.72, range: 350, description: 'Matériel sobre pour lignes peu denses et longues antennes rurales.', requiredTech: 'hydrogen_rural_lines', requiredTechLevel: 4 },
    hydrogen_long_range_unit: { id: 'hydrogen_long_range_unit', name: 'Rame hydrogène longue distance', unlockEpoch: 4, type: 'Hydrogène longue distance', speed: 170, capacity: 650, freight: 0, energyType: 'hydrogen', energy: 4.6, maintenance: 0.42, price: 9800000, reliability: 0.92, comfort: 0.82, range: 425, description: 'Autonomie élevée pour itinéraires non électrifiés de grande longueur.', requiredTech: 'hydrogen_long_distance_tanks', requiredTechLevel: 6 },
    hydrogen_next_gen_unit: { id: 'hydrogen_next_gen_unit', name: 'Rame hydrogène nouvelle génération', unlockEpoch: 4, type: 'Hydrogène avancé', speed: 180, capacity: 720, freight: 0, energyType: 'hydrogen', energy: 3.7, maintenance: 0.36, price: 13200000, reliability: 0.94, comfort: 0.84, range: 500, description: 'Hydrogène late game : propre, fiable et adapté aux longues relations régionales.', requiredTech: 'hydrogen_next_generation', requiredTechLevel: 8 },

    battery_suburban_unit: { id: 'battery_suburban_unit', name: 'Rame batterie périurbaine', unlockEpoch: 5, type: 'Batterie périurbaine', speed: 140, capacity: 680, freight: 0, energyType: 'battery', energy: 3.7, maintenance: 0.24, price: 5400000, reliability: 0.95, comfort: 0.82, range: 150, description: 'Rame à batterie pour courtes antennes non électrifiées autour des pôles urbains.', requiredTech: 'battery_suburban_trains', requiredTechLevel: 1 },
    battery_regional_unit: { id: 'battery_regional_unit', name: 'Rame batterie régionale', unlockEpoch: 5, type: 'Batterie régionale', speed: 160, capacity: 650, freight: 0, energyType: 'battery', energy: 3.9, maintenance: 0.25, price: 6900000, reliability: 0.95, comfort: 0.84, range: 220, description: 'Rame régionale à batterie pour lignes partiellement électrifiées.', requiredTech: 'battery_regional_trains', requiredTechLevel: 3 },
    battery_fast_charge_unit: { id: 'battery_fast_charge_unit', name: 'Rame batterie recharge rapide', unlockEpoch: 5, type: 'Batterie recharge rapide', speed: 160, capacity: 700, freight: 0, energyType: 'battery', energy: 3.6, maintenance: 0.26, price: 7600000, reliability: 0.94, comfort: 0.84, range: 280, description: 'Exploite les gares équipées pour réduire les temps de recharge.', requiredTech: 'battery_fast_station_charging', requiredTechLevel: 4 },
    battery_modular_unit: { id: 'battery_modular_unit', name: 'Rame batterie modulaire', unlockEpoch: 5, type: 'Batterie modulaire', speed: 165, capacity: 760, freight: 0, energyType: 'battery', energy: 3.8, maintenance: 0.23, price: 8600000, reliability: 0.96, comfort: 0.86, range: 340, description: 'Architecture modulaire, plus fiable et plus simple à adapter au service.', requiredTech: 'battery_modular', requiredTechLevel: 6 },
    battery_high_density_unit: { id: 'battery_high_density_unit', name: 'Rame batterie haute densité', unlockEpoch: 5, type: 'Batterie haute densité', speed: 180, capacity: 820, freight: 0, energyType: 'battery', energy: 3.5, maintenance: 0.24, price: 11800000, reliability: 0.96, comfort: 0.88, range: 400, description: 'Batterie avancée à forte autonomie, adaptée aux services régionaux ambitieux.', requiredTech: 'battery_high_density', requiredTechLevel: 8 },

    maglev_shuttle_pioneer: { id: 'maglev_shuttle_pioneer', name: 'Navette maglev pionnière', unlockEpoch: 6, type: 'Maglev pionnier', speed: 360, capacity: 620, freight: 0, energyType: 'electricity', energy: 10.5, maintenance: 0.88, price: 32000000, reliability: 0.9, comfort: 0.86, range: 650, description: 'Première navette à sustentation magnétique, très coûteuse mais très rapide.', requiredTech: 'maglev_levitation', requiredTechLevel: 1 },
    maglev_guided_regional: { id: 'maglev_guided_regional', name: 'Rame maglev guidée', unlockEpoch: 6, type: 'Maglev guidé', speed: 420, capacity: 700, freight: 0, energyType: 'electricity', energy: 10.8, maintenance: 0.82, price: 39000000, reliability: 0.93, comfort: 0.88, range: 850, description: 'Maglev plus fiable grâce au guidage magnétique maîtrisé.', requiredTech: 'maglev_guidance', requiredTechLevel: 3 },
    maglev_linear_express: { id: 'maglev_linear_express', name: 'Maglev express linéaire', unlockEpoch: 6, type: 'Maglev express', speed: 500, capacity: 760, freight: 0, energyType: 'electricity', energy: 11.5, maintenance: 0.9, price: 52000000, reliability: 0.94, comfort: 0.9, range: 1050, description: 'Propulsion linéaire pour liaisons express à très haute vitesse.', requiredTech: 'maglev_linear_propulsion', requiredTechLevel: 4 },
    maglev_metropolitan_express: { id: 'maglev_metropolitan_express', name: 'Maglev express métropolitain', unlockEpoch: 6, type: 'Maglev métropolitain', speed: 520, capacity: 900, freight: 0, energyType: 'electricity', energy: 12.4, maintenance: 0.92, price: 68000000, reliability: 0.95, comfort: 0.91, range: 1250, description: 'Très forte capacité pour liaisons express entre métropoles.', requiredTech: 'maglev_metro_express_links', requiredTechLevel: 6 },
    maglev_next_gen_unit: { id: 'maglev_next_gen_unit', name: 'Maglev nouvelle génération', unlockEpoch: 6, type: 'Maglev nouvelle génération', speed: 600, capacity: 980, freight: 0, energyType: 'electricity', energy: 10.9, maintenance: 0.78, price: 92000000, reliability: 0.97, comfort: 0.95, range: 1500, description: 'Matériel ultime de très late game : vitesse extrême, confort et fiabilité.', requiredTech: 'maglev_next_generation', requiredTechLevel: 8 }
  };
  */
  const trains = buildTrainCatalogModels();
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
    light: { id: 'light', name: 'Petite maintenance', description: 'Intervention courte en dépôt. Remonte légèrement l’état.', baseCost: 4500, priceFactor: 0.018, restore: 0.18, target: 0.82, baseMinutes: 18, facility: 'depot' },
    standard: { id: 'standard', name: 'Maintenance intermédiaire', description: 'Remise à niveau solide en atelier.', baseCost: 12000, priceFactor: 0.045, restore: 0.38, target: 0.92, baseMinutes: 55, facility: 'workshop' },
    heavy: { id: 'heavy', name: 'Grande révision atelier', description: 'Réparation lourde en atelier pour matériel très usé.', baseCost: 32000, priceFactor: 0.085, restore: 0.62, target: 0.98, baseMinutes: 130, facility: 'workshop', requiredTech: 'steam_workshops' },
    refurbish: { id: 'refurbish', name: 'Rénovation technicentre', description: 'Très coûteux, mais remet presque à neuf dans un technicentre.', baseCost: 70000, priceFactor: 0.13, restore: 0.9, target: 1, baseMinutes: 420, facility: 'technicentre', requiredTech: 'electric_standardized_maintenance' }
  };

  const maintenanceFacilities = {
    depot: {
      id: 'depot',
      name: 'Dépôt',
      shortName: 'Dépôt',
      description: 'Indispensable pour la petite maintenance. Chaque niveau accélère les petites interventions.',
      actionLabel: 'Petite maintenance',
      baseCost: 160000,
      growth: 1.25,
      baseConstructionMs: 2 * HOUR_MS,
      constructionGrowth: 1.25,
      durationReductionPerLevel: 0.02,
      maxDurationReduction: 0.24,
      requiredTech: 'steam_depots'
    },
    workshop: {
      id: 'workshop',
      name: 'Atelier',
      shortName: 'Atelier',
      description: 'Indispensable pour la maintenance intermédiaire et les grandes révisions. Chaque niveau réduit l’indisponibilité.',
      actionLabel: 'Maintenance intermédiaire',
      baseCost: 420000,
      growth: 1.25,
      baseConstructionMs: 6 * HOUR_MS,
      constructionGrowth: 1.25,
      durationReductionPerLevel: 0.025,
      maxDurationReduction: 0.30,
      requiredTech: 'steam_workshops'
    },
    technicentre: {
      id: 'technicentre',
      name: 'Technicentre',
      shortName: 'Technicentre',
      description: 'Indispensable pour les rénovations complètes. Chaque niveau rend les immobilisations lourdes plus courtes.',
      actionLabel: 'Rénovations',
      baseCost: 1800000,
      growth: 1.25,
      baseConstructionMs: 18 * HOUR_MS,
      constructionGrowth: 1.25,
      durationReductionPerLevel: 0.03,
      maxDurationReduction: 0.36,
      requiredTech: 'electric_standardized_maintenance'
    }
  };

  normalizeTrainModelCompositionFlags(trains);
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
    maintenanceFacilities,
    techTree,
    public: { epochs, trains, staff, energyStrategies, maintenancePolicies, maintenanceActions, techTree, economy: {
      researchLabBaseCost: ECONOMY.researchLabBaseCost,
      stationLevelCost: ECONOMY.stationLevelCost,
      stationCommerceCost: ECONOMY.stationCommerceCost,
      stationMaintenanceCost: ECONOMY.stationMaintenanceCost,
      stationDepotCost: ECONOMY.stationDepotCost,
      stationAccessTollBase: ECONOMY.stationAccessTollBase,
      stationAccessTollCapacityFactor: ECONOMY.stationAccessTollCapacityFactor
    }, maintenanceFacilities, techLabels: {
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
  // Arbre R&D v2 : la progression est d'abord faite de déblocages jouables.
  // Les identifiants historiques encore utilisés par le catalogue sont conservés
  // pour permettre une migration sans priver les compagnies de leur parc.
  {
    const groups = {
      traction: { id: 'traction', label: 'Traction', description: 'Matériels roulants, compositions et nouvelles dessertes.', nodes: [] },
      energy: { id: 'energy', label: 'Énergie', description: 'Carburants, électrification, recharge et autonomie.', nodes: [] },
      maintenance: { id: 'maintenance', label: 'Maintenance', description: 'Dépôts, ateliers, interventions et fiabilité du parc.', nodes: [] },
      operations: { id: 'operations', label: 'Exploitation', description: 'Lignes, sillons, fret, régulation et capacité du réseau.', nodes: [] },
      stations: { id: 'stations', label: 'Gares', description: 'Services voyageurs, capacité et correspondances.', nodes: [] },
      social: { id: 'social', label: 'Équipes', description: 'Formation des conducteurs, mainteneurs et régulateurs.', nodes: [] }
    };
    const eraLabels = ['Train à vapeur', 'Train diesel', 'Train électrique', 'Train à grande vitesse', 'Train à hydrogène', 'Train à batterie', 'Train à sustentation magnétique'];
    const eraBalance = [
      { cost: 15000, duration: 35 }, { cost: 85000, duration: 300 }, { cost: 260000, duration: 1100 },
      { cost: 750000, duration: 3600 }, { cost: 1800000, duration: 10800 }, { cost: 3600000, duration: 25200 },
      { cost: 7000000, duration: 57600 }
    ];
    const addV2 = (era, group, id, title, description, prereq = [], unlocks = [], options = {}) => {
      const displayGroup = group === 'freight' ? 'operations' : group;
      const pacing = eraBalance[era];
      groups[displayGroup].nodes.push({
        id,
        branch: options.branch || group,
        title,
        description,
        requiredEpoch: era,
        prereq,
        unlocks,
        improves: options.improves || [],
        effects: [...unlocks, ...(options.improves || [])],
        maxLevel: null,
        unlimited: true,
        baseCostMoney: options.baseCostMoney || pacing.cost,
        baseDurationSeconds: options.baseDurationSeconds || pacing.duration,
        costGrowth: 1.72,
        durationGrowth: 1.54,
        levelValue: 1,
        levelPrereq: options.levelPrereq || [],
        era: era + 1,
        eraLabel: eraLabels[era],
        subtree: options.subtree || (group === 'freight' ? 'freight' : ''),
        sillonSlots: options.sillonSlots || null
      });
    };
    const req = (id, level = 1) => ({ id, level });
    const any = (...entries) => ({ anyOf: entries });

    // Le niveau 1 offre rapidement une première action. Les niveaux 2 à 5
    // professionnalisent l'usage et sont requis par les jalons suivants.
    const tree = [
      [0, [
        ['traction', 'steam_first_locomotives', 'Première locomotive à vapeur', 'Débloque l’achat du premier matériel roulant et lance la compagnie.', [], ['Acheter les locomotives vapeur de départ']],
        ['operations', 'steam_passenger_locomotives', 'Haltes et service voyageurs', 'Débloque la création de lignes voyageurs et les voitures voyageurs.', [req('steam_first_locomotives')], ['Créer des lignes voyageurs']],
        ['freight', 'steam_freight_locomotives', 'Wagons marchandises', 'Débloque les lignes fret et les premières compositions marchandises.', [req('steam_first_locomotives')], ['Créer des lignes fret']],
        ['maintenance', 'steam_depots', 'Dépôts charbon et eau', 'Débloque l’achat de dépôts dans Parc > Maintenance.', [req('steam_first_locomotives')], ['Construire un dépôt']],
        ['operations', 'manual_dispatch', 'Aiguillages et régulation manuelle', 'Débloque les lignes à plus de deux arrêts.', [req('steam_passenger_locomotives')], ['Créer des lignes avec arrêts intermédiaires']],
        ['operations', 'passenger_slots_steam', 'Horaires voyageurs coordonnés', 'Débloque davantage de sillons voyageurs par ligne.', [req('manual_dispatch', 2)], ['+2 sillons voyageurs par ligne'], { sillonSlots: { passengers: 2 } }],
        ['freight', 'freight_slots_steam', 'Marches marchandises organisées', 'Débloque davantage de sillons fret par ligne.', [req('steam_freight_locomotives', 2)], ['+2 sillons fret par ligne'], { sillonSlots: { freight: 2 }, subtree: 'freight' }],
        ['stations', 'passenger_flow', 'Accès voyageurs en gare', 'Débloque la montée en niveau des gares.', [req('steam_passenger_locomotives')], ['Améliorer le niveau d’une gare']],
        ['stations', 'ticket_halls', 'Guichets et salles d’attente', 'Débloque les commerces de gare.', [req('passenger_flow', 2)], ['Développer les commerces de gare']],
        ['social', 'crew_training', 'Formation des équipages', 'Débloque les premiers gains de productivité des conducteurs.', [req('steam_passenger_locomotives')], ['Réduire les besoins d’équipage']],
        ['energy', 'steam_improved_boilers', 'Chaudières améliorées', 'Débloque les locomotives vapeur plus puissantes.', [req('steam_first_locomotives', 2)], ['Acheter des locomotives vapeur intermédiaires']],
        ['maintenance', 'steam_reinforced_brakes', 'Frein continu automatique', 'Débloque les compositions voyageurs express et les trains plus longs.', [req('steam_passenger_locomotives', 2), req('steam_freight_locomotives', 2)], ['Utiliser des compositions express']],
        ['maintenance', 'steam_workshops', 'Ateliers vapeur', 'Débloque les ateliers de compagnie et la grande révision.', [req('steam_depots', 2), req('steam_improved_boilers', 2)], ['Construire un atelier', 'Débloquer la grande révision']],
        ['freight', 'basic_freight_yards', 'Triages locaux', 'Débloque les wagons spécialisés et les flux de fret plus rentables.', [req('steam_freight_locomotives', 2)], ['Débloquer les wagons spécialisés'], { subtree: 'freight' }],
        ['operations', 'steam_network_standards', 'Normes de réseau vapeur', 'Jalon de maturité requis pour préparer l’ère diesel.', [req('steam_improved_boilers', 3), req('manual_dispatch', 3), req('steam_workshops', 2)], ['Jalon vers l’ère diesel']]
      ]],
      [1, [
        ['traction', 'diesel_first_engines', 'Moteurs diesel ferroviaires', 'Débloque les premiers matériels diesel.', [req('steam_network_standards', 3), req('steam_workshops', 2)], ['Acheter les premiers trains diesel']],
        ['traction', 'diesel_light_railcars', 'Autorails légers', 'Débloque des rames économiques pour les lignes secondaires.', [req('diesel_first_engines', 2)], ['Acheter des autorails diesel']],
        ['traction', 'diesel_shunters', 'Locotracteurs de manœuvre', 'Débloque des locomotives fret courtes et maniables.', [req('diesel_first_engines', 2)], ['Acheter des locotracteurs diesel']],
        ['energy', 'diesel_long_range_tanks', 'Réservoirs grande autonomie', 'Débloque des lignes diesel plus longues.', [req('diesel_first_engines', 3)], ['Étendre la portée diesel']],
        ['energy', 'diesel_fuel_depots', 'Dépôts carburant', 'Améliore le ravitaillement des trains diesel.', [req('diesel_long_range_tanks', 2), req('steam_depots', 3)], ['Réduire les coûts de ravitaillement diesel']],
        ['traction', 'diesel_mechanical', 'Transmission diesel mécanique', 'Débloque les automotrices régionales diesel.', [req('diesel_first_engines', 3)], ['Acheter des automotrices diesel régionales']],
        ['traction', 'diesel_electric', 'Transmission diesel-électrique', 'Débloque une traction diesel plus puissante et fiable.', [req('diesel_mechanical', 3), req('diesel_shunters', 2)], ['Acheter des locomotives diesel-électriques']],
        ['traction', 'diesel_passenger_locomotives', 'Services diesel express', 'Débloque les locomotives diesel voyageurs et les voitures Midi.', [any(req('diesel_mechanical', 3), req('diesel_electric', 3))], ['Acheter des locomotives diesel voyageurs', 'Utiliser les voitures Midi']],
        ['traction', 'diesel_freight_locomotives', 'Diesel fret lourd', 'Débloque les locomotives diesel fret et les grands trains de marchandises.', [req('diesel_electric', 3), req('basic_freight_yards', 3)], ['Acheter des locomotives diesel fret']],
        ['traction', 'diesel_multiple_units', 'Unités multiples diesel', 'Débloque des dessertes régionales plus fréquentes.', [req('diesel_passenger_locomotives', 3)], ['Exploiter plusieurs autorails ensemble']],
        ['maintenance', 'diesel_lubrication_program', 'Entretien diesel préventif', 'Réduit l’usure et prépare la maintenance moderne.', [req('diesel_electric', 2), req('steam_workshops', 3)], ['Réduire l’usure diesel']],
        ['operations', 'block_signaling', 'Block automatique lumineux', 'Débloque une circulation plus dense et plus régulière.', [req('manual_dispatch', 3), req('steam_network_standards', 2)], ['Augmenter la capacité des lignes']],
        ['operations', 'passing_loops', 'Évitements cadencés', 'Débloque davantage de capacité sur les lignes secondaires.', [req('block_signaling', 2), req('diesel_light_railcars', 2)], ['Augmenter la fréquence des lignes secondaires']],
        ['freight', 'specialized_wagons', 'Wagons spécialisés', 'Débloque citernes, trémies, plats et frigorifiques.', [req('basic_freight_yards', 3)], ['Choisir des wagons spécialisés'], { subtree: 'freight' }],
        ['operations', 'passenger_slots_diesel', 'Cadencement régional diesel', 'Débloque des sillons voyageurs supplémentaires.', [req('diesel_multiple_units', 3), req('block_signaling', 3)], ['+3 sillons voyageurs par ligne'], { sillonSlots: { passengers: 3 } }],
        ['freight', 'freight_slots_diesel', 'Acheminement diesel organisé', 'Débloque des sillons fret supplémentaires.', [req('diesel_freight_locomotives', 3), req('passing_loops', 2)], ['+3 sillons fret par ligne'], { sillonSlots: { freight: 3 }, subtree: 'freight' }]
      ]],
      [2, [
        ['traction', 'electric_first_trains', 'Premiers trains électriques', 'Débloque le matériel électrique pionnier.', [req('diesel_electric', 4), req('block_signaling', 3)], ['Acheter les premiers trains électriques']],
        ['energy', 'electric_third_rail', 'Troisième rail urbain', 'Débloque les automotrices électriques urbaines.', [req('electric_first_trains', 2)], ['Acheter des automotrices urbaines']],
        ['energy', 'electric_dc_catenary', 'Caténaire courant continu', 'Débloque l’électrification des lignes et les rames régionales électriques.', [req('electric_third_rail', 2)], ['Électrifier une ligne', 'Acheter des rames régionales électriques']],
        ['energy', 'electric_ac_catenary', 'Caténaire 25 kV', 'Débloque des corridors électrifiés plus performants.', [req('electric_dc_catenary', 3)], ['Réduire le coût d’électrification']],
        ['energy', 'electric_substations', 'Sous-stations électriques', 'Débloque l’électrification réellement exploitable des lignes.', [req('electric_dc_catenary', 2)], ['Électrifier des lignes'], { improves: ['-2% coût d’électrification par niveau'] }],
        ['traction', 'electric_improved_motors', 'Moteurs électriques performants', 'Débloque les rames électriques plus rapides.', [req('electric_first_trains', 3)], ['Acheter des trains électriques intermédiaires']],
        ['traction', 'electric_emus', 'Automotrices électriques', 'Débloque les dessertes électriques fréquentes.', [req('electric_third_rail', 3), req('electric_improved_motors', 2)], ['Acheter des automotrices électriques']],
        ['traction', 'electric_locomotives', 'Locomotives électriques', 'Débloque le fret lourd et les locomotives multicourants.', [req('electric_dc_catenary', 3), req('electric_substations', 2)], ['Acheter des locomotives électriques']],
        ['traction', 'electric_electronic_control', 'Commande électronique de traction', 'Débloque une exploitation électrique plus efficace.', [req('electric_improved_motors', 3)], ['Améliorer l’efficacité des trains électriques']],
        ['maintenance', 'electric_braking', 'Freinage électrique', 'Débloque le freinage régénératif et améliore la fiabilité.', [req('electric_electronic_control', 2)], ['Réduire les coûts énergétiques électriques']],
        ['energy', 'electric_energy_recovery', 'Récupération d’énergie', 'Débloque une consommation réduite sur les lignes électrifiées.', [req('electric_braking', 3), req('electric_substations', 3)], ['Réduire la consommation électrique']],
        ['traction', 'electric_dual_current_trains', 'Trains bicourants', 'Débloque des matériels voyageurs et fret polyvalents.', [req('electric_dc_catenary', 4), req('electric_ac_catenary', 2)], ['Acheter des trains bicourants']],
        ['traction', 'electric_multi_current_trains', 'Trains multicourants', 'Débloque les matériels électriques de haut niveau.', [req('electric_dual_current_trains', 3)], ['Acheter des trains multicourants']],
        ['maintenance', 'electric_standardized_maintenance', 'Maintenance électrique standardisée', 'Débloque la rénovation complète des trains.', [req('electric_locomotives', 3), req('electric_emus', 3)], ['Débloquer la rénovation complète']],
        ['operations', 'passenger_slots_electric', 'Grille horaire électrifiée', 'Débloque des sillons voyageurs supplémentaires.', [req('electric_emus', 3), req('block_signaling', 4)], ['+5 sillons voyageurs par ligne'], { sillonSlots: { passengers: 5 } }],
        ['freight', 'freight_slots_electric', 'Corridors fret électrifiés', 'Débloque des sillons fret supplémentaires.', [req('electric_locomotives', 3), req('specialized_wagons', 3)], ['+5 sillons fret par ligne'], { sillonSlots: { freight: 5 }, subtree: 'freight' }]
      ]],
      [3, [
        ['traction', 'hsv_first_fast_trains', 'Services rapides', 'Débloque les premiers trains rapides Intercités.', [req('electric_locomotives', 4), req('electric_multi_current_trains', 2)], ['Acheter des trains rapides']],
        ['traction', 'hsv_aerodynamics', 'Aérodynamique ferroviaire', 'Prépare les rames rapides et limite leur consommation.', [req('hsv_first_fast_trains', 2)], ['Améliorer la vitesse des trains rapides']],
        ['traction', 'hsv_lightweight_materials', 'Matériel allégé', 'Débloque des rames plus légères et plus capacitaires.', [req('hsv_first_fast_trains', 2)], ['Améliorer capacité et vitesse']],
        ['maintenance', 'hsv_high_speed_braking', 'Freinage haute vitesse', 'Débloque les rames grande vitesse en toute sécurité.', [req('hsv_aerodynamics', 2), req('electric_braking', 3)], ['Acheter des rames grande vitesse']],
        ['operations', 'hsv_adapted_tracks', 'Infrastructure grande vitesse', 'Débloque l’usage commercial des lignes à grande vitesse.', [req('electric_ac_catenary', 3), req('electric_energy_recovery', 2)], ['Ouvrir des services grande vitesse']],
        ['energy', 'hsv_catenary', 'Alimentation grande vitesse', 'Prépare la puissance nécessaire aux rames rapides.', [req('hsv_adapted_tracks', 2), req('electric_substations', 3)], ['Réduire les coûts énergétiques grande vitesse']],
        ['traction', 'hsv_trainsets', 'Rames grande vitesse articulées', 'Débloque les rames TGV de première génération et Duplex.', [req('hsv_catenary', 2), req('hsv_high_speed_braking', 2)], ['Acheter des rames TGV']],
        ['energy', 'hsv_high_power_onboard', 'Puissance embarquée élevée', 'Débloque les rames rapides les plus performantes.', [req('hsv_trainsets', 2)], ['Acheter des rames grande vitesse avancées']],
        ['traction', 'hsv_stability', 'Stabilité à haute vitesse', 'Débloque des circulations rapides plus fiables.', [req('hsv_trainsets', 2), req('hsv_lightweight_materials', 2)], ['Améliorer la fiabilité grande vitesse']],
        ['operations', 'centralized_control', 'Commande centralisée', 'Débloque l’exploitation d’un réseau dense depuis un poste unique.', [req('block_signaling', 4), req('electric_electronic_control', 3)], ['Débloquer la régulation centralisée']],
        ['operations', 'hsv_signaling', 'Signalisation en cabine', 'Débloque les sillons grande vitesse et les rames rapides.', [req('centralized_control', 2), req('hsv_stability', 2)], ['Débloquer les services grande vitesse']],
        ['traction', 'hsv_distributed_traction', 'Traction répartie', 'Débloque les rames grande vitesse modernes.', [req('hsv_signaling', 3), req('hsv_high_power_onboard', 3)], ['Acheter des rames grande vitesse modernes']],
        ['stations', 'intermodal_hubs', 'Pôles de correspondance', 'Débloque des gares intermodales et une demande voyageurs accrue.', [req('passenger_flow', 3), req('centralized_control', 2)], ['Développer des correspondances en gare']],
        ['operations', 'traffic_simulation', 'Simulation de trafic', 'Débloque l’anticipation des saturations et les réseaux denses.', [req('centralized_control', 3), req('passenger_slots_electric', 2)], ['Augmenter la capacité réseau']],
        ['operations', 'passenger_slots_high_speed', 'Sillons grande vitesse cadencés', 'Débloque des sillons voyageurs supplémentaires.', [req('hsv_signaling', 3), req('traffic_simulation', 2)], ['+8 sillons voyageurs par ligne'], { sillonSlots: { passengers: 8 } }],
        ['freight', 'freight_slots_high_speed', 'Plan de transport fret optimisé', 'Débloque des sillons fret supplémentaires.', [req('traffic_simulation', 3), req('freight_slots_electric', 2)], ['+8 sillons fret par ligne'], { sillonSlots: { freight: 8 }, subtree: 'freight' }]
      ]],
      [4, [
        ['traction', 'hydrogen_first_trains', 'Prototype hydrogène', 'Débloque les premiers trains à hydrogène.', [req('hsv_trainsets', 3), req('electric_energy_recovery', 3)], ['Acheter les premiers trains à hydrogène']],
        ['energy', 'hydrogen_fuel_cell', 'Pile à combustible ferroviaire', 'Débloque des rames hydrogène plus efficaces.', [req('hydrogen_first_trains', 2)], ['Acheter des rames hydrogène optimisées']],
        ['energy', 'hydrogen_secure_tanks', 'Réservoirs hydrogène sécurisés', 'Débloque une autonomie hydrogène exploitable.', [req('hydrogen_first_trains', 2)], ['Étendre la portée hydrogène']],
        ['energy', 'hydrogen_refueling_stations', 'Stations hydrogène', 'Débloque l’installation de ravitaillement hydrogène en gare.', [req('hydrogen_secure_tanks', 3), req('steam_depots', 4)], ['Construire une station hydrogène']],
        ['energy', 'hydrogen_green', 'Hydrogène bas carbone', 'Débloque la stratégie d’énergie hydrogène propre.', [req('hydrogen_refueling_stations', 2)], ['Réduire l’impact carbone hydrogène']],
        ['maintenance', 'hydrogen_specialized_maintenance', 'Maintenance hydrogène', 'Débloque l’entretien spécialisé des rames hydrogène.', [req('hydrogen_fuel_cell', 2), req('electric_standardized_maintenance', 3)], ['Réduire l’usure hydrogène']],
        ['traction', 'hydrogen_regional_trains', 'Rames hydrogène régionales', 'Débloque les rames hydrogène pour les lignes secondaires.', [req('hydrogen_fuel_cell', 2), req('hydrogen_secure_tanks', 2)], ['Acheter des rames hydrogène régionales']],
        ['energy', 'hydrogen_optimized_energy_recharge', 'Gestion énergétique hydrogène', 'Améliore l’autonomie et les coûts des rames hydrogène.', [req('hydrogen_fuel_cell', 3), req('hydrogen_specialized_maintenance', 2)], ['Réduire la consommation hydrogène']],
        ['maintenance', 'hydrogen_enhanced_safety', 'Sécurité hydrogène renforcée', 'Débloque les rames hydrogène à forte autonomie.', [req('hydrogen_secure_tanks', 3), req('hydrogen_specialized_maintenance', 2)], ['Acheter des rames hydrogène longue distance']],
        ['energy', 'hydrogen_long_distance_tanks', 'Réservoirs longue distance', 'Débloque les relations hydrogène plus longues.', [req('hydrogen_enhanced_safety', 3), req('hydrogen_optimized_energy_recharge', 2)], ['Acheter des rames hydrogène longue distance']],
        ['traction', 'hydrogen_rural_lines', 'Desserte rurale hydrogène', 'Débloque un matériel sobre pour les lignes peu denses.', [req('hydrogen_regional_trains', 3), req('hydrogen_long_distance_tanks', 2)], ['Acheter des rames hydrogène rurales']],
        ['traction', 'hydrogen_next_generation', 'Hydrogène nouvelle génération', 'Débloque les rames hydrogène les plus abouties.', [req('hydrogen_green', 3), req('hydrogen_long_distance_tanks', 3)], ['Acheter des rames hydrogène avancées']],
        ['operations', 'night_services', 'Services de nuit', 'Débloque l’exploitation nocturne et les compositions couchettes.', [req('centralized_control', 3), req('hsv_trainsets', 3)], ['Créer des services de nuit', 'Utiliser des voitures couchettes']],
        ['operations', 'dynamic_pricing', 'Tarification dynamique', 'Débloque les réglages tarifaires avancés des lignes.', [req('traffic_simulation', 3), req('night_services', 2)], ['Optimiser les tarifs des lignes']],
        ['operations', 'passenger_slots_hydrogen', 'Dessertes à autonomie étendue', 'Débloque des sillons voyageurs supplémentaires.', [req('hydrogen_regional_trains', 3), req('dynamic_pricing', 2)], ['+11 sillons voyageurs par ligne'], { sillonSlots: { passengers: 11 } }],
        ['freight', 'freight_slots_hydrogen', 'Corridors logistiques étendus', 'Débloque des sillons fret supplémentaires.', [req('hydrogen_long_distance_tanks', 3), req('freight_slots_high_speed', 2)], ['+11 sillons fret par ligne'], { sillonSlots: { freight: 11 }, subtree: 'freight' }]
      ]],
      [5, [
        ['traction', 'battery_first_trains', 'Premiers trains à batterie', 'Débloque les premiers matériels à batterie.', [req('hydrogen_regional_trains', 3), req('electric_energy_recovery', 4)], ['Acheter les premiers trains à batterie']],
        ['energy', 'battery_railway_batteries', 'Batteries ferroviaires', 'Débloque l’autonomie de base des rames à batterie.', [req('battery_first_trains', 2)], ['Étendre la portée batterie']],
        ['energy', 'battery_catenary_charging', 'Recharge sous caténaire', 'Débloque l’exploitation sur lignes partiellement électrifiées.', [req('battery_railway_batteries', 2), req('electric_ac_catenary', 3)], ['Recharger une rame batterie sous caténaire']],
        ['energy', 'battery_fast_station_charging', 'Recharge rapide en gare', 'Débloque la recharge rapide dans les gares équipées.', [req('battery_railway_batteries', 3), req('electric_substations', 4)], ['Installer une recharge rapide en gare']],
        ['energy', 'battery_long_range', 'Batteries longue autonomie', 'Débloque des relations batterie plus longues.', [req('battery_railway_batteries', 3), req('battery_catenary_charging', 2)], ['Acheter des rames batterie longue autonomie']],
        ['maintenance', 'battery_thermal_management', 'Gestion thermique des batteries', 'Débloque une maintenance batterie fiable.', [req('battery_railway_batteries', 3), req('electric_standardized_maintenance', 4)], ['Réduire l’usure des batteries']],
        ['energy', 'battery_brake_energy_recovery', 'Récupération au freinage', 'Améliore l’autonomie des rames à batterie.', [req('battery_railway_batteries', 3), req('electric_energy_recovery', 4)], ['Réduire la consommation batterie']],
        ['traction', 'battery_suburban_trains', 'Rames batterie périurbaines', 'Débloque les dessertes périurbaines à batterie.', [req('battery_catenary_charging', 2)], ['Acheter des rames batterie périurbaines']],
        ['traction', 'battery_regional_trains', 'Rames batterie régionales', 'Débloque les services régionaux à batterie.', [req('battery_long_range', 2), req('battery_thermal_management', 2)], ['Acheter des rames batterie régionales']],
        ['maintenance', 'battery_modular', 'Batteries modulaires', 'Débloque les rames batterie modulaires et leur rénovation.', [req('battery_thermal_management', 3), req('battery_regional_trains', 2)], ['Acheter des rames batterie modulaires']],
        ['energy', 'battery_auto_charge_optimization', 'Planification de recharge', 'Débloque une recharge batterie automatisée plus efficace.', [req('battery_modular', 2), req('traffic_simulation', 4)], ['Améliorer l’autonomie batterie']],
        ['energy', 'battery_high_density', 'Batteries haute densité', 'Débloque les rames batterie les plus autonomes.', [req('battery_long_range', 3), req('battery_thermal_management', 3)], ['Acheter des rames batterie haute densité']],
        ['operations', 'automated_dispatch', 'Régulation automatisée', 'Débloque une exploitation à très forte fréquence.', [req('traffic_simulation', 4), req('electric_electronic_control', 4)], ['Augmenter la ponctualité réseau']],
        ['operations', 'driverless_corridors', 'Corridors supervisés', 'Débloque le fret automatique sous supervision.', [req('automated_dispatch', 3), req('battery_auto_charge_optimization', 2)], ['Débloquer le fret supervisé']],
        ['operations', 'passenger_slots_battery', 'Roulements batterie interurbains', 'Débloque des sillons voyageurs supplémentaires.', [req('battery_regional_trains', 3), req('automated_dispatch', 2)], ['+15 sillons voyageurs par ligne'], { sillonSlots: { passengers: 15 } }],
        ['freight', 'freight_slots_battery', 'Fret cadencé sous supervision', 'Débloque des sillons fret supplémentaires.', [req('driverless_corridors', 2), req('freight_slots_hydrogen', 2)], ['+15 sillons fret par ligne'], { sillonSlots: { freight: 15 }, subtree: 'freight' }]
      ]],
      [6, [
        ['traction', 'maglev_levitation', 'Sustentation magnétique', 'Débloque la première navette maglev.', [req('battery_high_density', 3), req('automated_dispatch', 3)], ['Acheter une navette maglev']],
        ['traction', 'maglev_guidance', 'Guidage magnétique actif', 'Débloque les rames maglev guidées.', [req('maglev_levitation', 2)], ['Acheter des rames maglev guidées']],
        ['traction', 'maglev_linear_propulsion', 'Propulsion linéaire', 'Débloque les maglev express.', [req('maglev_guidance', 2)], ['Acheter des maglev express']],
        ['operations', 'maglev_special_tracks', 'Corridors maglev dédiés', 'Débloque l’exploitation commerciale des lignes maglev.', [req('maglev_linear_propulsion', 2), req('hsv_adapted_tracks', 4)], ['Ouvrir des corridors maglev']],
        ['stations', 'maglev_stations', 'Terminaux maglev', 'Débloque les gares adaptées aux correspondances maglev.', [req('maglev_special_tracks', 2), req('intermodal_hubs', 3)], ['Développer un terminal maglev']],
        ['traction', 'maglev_very_high_speed', 'Très haute vitesse', 'Débloque les maglev très rapides.', [req('maglev_special_tracks', 3), req('maglev_guidance', 3)], ['Acheter des maglev très haute vitesse']],
        ['stations', 'maglev_silence_comfort', 'Confort maglev avancé', 'Débloque un gain d’attractivité pour les liaisons maglev.', [req('maglev_very_high_speed', 2), req('maglev_stations', 2)], ['Améliorer l’attractivité maglev']],
        ['maintenance', 'maglev_contactless_maintenance', 'Maintenance sans contact', 'Débloque une maintenance maglev plus légère.', [req('maglev_guidance', 3), req('electric_standardized_maintenance', 5)], ['Réduire la maintenance maglev']],
        ['maintenance', 'maglev_advanced_high_speed_safety', 'Sécurité très haute vitesse', 'Débloque les services maglev avancés.', [req('maglev_very_high_speed', 3), req('maglev_stations', 3)], ['Débloquer les services maglev avancés']],
        ['energy', 'maglev_high_power_energy', 'Alimentation haute puissance', 'Prépare les liaisons maglev métropolitaines.', [req('maglev_linear_propulsion', 3), req('battery_auto_charge_optimization', 3)], ['Améliorer l’efficacité maglev']],
        ['traction', 'maglev_metro_express_links', 'Liaisons maglev métropolitaines', 'Débloque les maglev de grande capacité.', [req('maglev_very_high_speed', 3), req('maglev_stations', 3)], ['Acheter des maglev métropolitains']],
        ['traction', 'maglev_next_generation', 'Maglev nouvelle génération', 'Débloque le matériel maglev le plus performant.', [req('maglev_advanced_high_speed_safety', 3), req('maglev_contactless_maintenance', 3), req('maglev_high_power_energy', 3)], ['Acheter des maglev nouvelle génération']],
        ['operations', 'ai_timetable_planner', 'Planificateur horaire assisté', 'Débloque une gestion de capacité en temps réel.', [req('automated_dispatch', 4), req('maglev_special_tracks', 2)], ['Augmenter la capacité réseau avancée']],
        ['stations', 'maglev_interchange_hubs', 'Pôles d’échanges maglev', 'Débloque des correspondances maglev avec le réseau classique.', [req('maglev_stations', 3), req('intermodal_hubs', 4)], ['Développer des correspondances maglev']],
        ['social', 'maglev_operations_certification', 'Certification exploitation maglev', 'Débloque la conduite et l’exploitation maglev avancées.', [req('maglev_guidance', 3), req('driverless_corridors', 3)], ['Réduire les besoins RH maglev']],
        ['operations', 'passenger_slots_maglev', 'Régulation très haute capacité', 'Débloque des sillons voyageurs supplémentaires.', [req('maglev_very_high_speed', 3), req('ai_timetable_planner', 2)], ['+25 sillons voyageurs par ligne'], { sillonSlots: { passengers: 25 } }],
        ['freight', 'freight_slots_maglev', 'Logistique temps réel intégrée', 'Débloque des sillons fret supplémentaires.', [req('ai_timetable_planner', 3), req('freight_slots_battery', 3)], ['+25 sillons fret par ligne'], { sillonSlots: { freight: 25 }, subtree: 'freight' }]
      ]]
    ];
    for (const [era, nodes] of tree) {
      for (const [group, id, title, description, prereq, unlocks, options] of nodes) addV2(era, group, id, title, description, prereq, unlocks, options || {});
    }
    addV2(1, 'freight', 'midi_freight_stock', 'Wagons Midi métalliques', 'Débloque les variantes de wagons Midi déjà présentes dans l’atelier de compositions.', [req('specialized_wagons', 2), req('diesel_freight_locomotives', 2)], ['Utiliser les wagons Midi dans les compositions'], { subtree: 'freight' });
    addV2(0, 'traction', 'steam_articulated_locomotives', 'Locomotives vapeur articulées', 'Débloque les locomotives vapeur lourdes de fin d’ère.', [req('steam_improved_boilers', 4), req('steam_reinforced_brakes', 3), req('steam_workshops', 3)], ['Acheter des locomotives vapeur lourdes']);
    addV2(3, 'traction', 'hsv_premium_long_distance', 'Grande vitesse longue distance', 'Débloque les rames grande vitesse premium pour les relations les plus rentables.', [req('hsv_trainsets', 3), req('hsv_stability', 3), req('traffic_simulation', 2)], ['Acheter des rames grande vitesse premium']);
    addV2(1, 'social', 'safety_training', 'Culture sécurité', 'Débloque un bonus de fiabilité pour toutes les équipes.', [req('crew_training', 2), req('block_signaling', 2)], ['Améliorer la fiabilité des lignes']);
    addV2(1, 'social', 'mechanic_certification', 'Certification mainteneurs', 'Débloque une maintenance diesel plus efficace.', [req('steam_workshops', 3), req('diesel_lubrication_program', 2)], ['Réduire la durée des maintenances']);
    addV2(3, 'freight', 'container_hubs', 'Terminaux conteneurs', 'Débloque les compositions porte-conteneurs et le fret intermodal longue distance.', [req('specialized_wagons', 4), req('traffic_simulation', 2)], ['Utiliser des porte-conteneurs'], { subtree: 'freight' });
    const totalNodes = Object.values(groups).reduce((sum, group) => sum + group.nodes.length, 0);
    if (totalNodes < 100) throw new Error(`Arbre R&D incomplet : ${totalNodes} recherches.`);
    synchronizeTechTreeWithTrainCatalog(groups);
    return finalizeTechTree(groups);
  }
  /*
   * Arbre v1 conservé temporairement dans l'historique du fichier : il ne fait
   * plus partie du programme et pourra être retiré lors du prochain nettoyage
   * de versions anciennes.
   */
  /*
  const groups = {
    traction: { id: 'traction', label: 'Traction', description: 'Matériels roulants, chaînes de traction, vitesse et types de trains.', nodes: [] },
    energy: { id: 'energy', label: 'Énergie', description: 'Alimentation, carburants, stockage, recharge, autonomie et consommation.', nodes: [] },
    maintenance: { id: 'maintenance', label: 'Maintenance', description: 'Dépôts, ateliers, freinage, fiabilité, sécurité et standardisation.', nodes: [] },
    operations: { id: 'operations', label: 'Exploitation', description: 'Deux sous-arbres complémentaires : voyageurs et fret. Ils organisent les sillons, la portée commerciale et le débit réellement utilisable sur le RFN.', nodes: [] },
    stations: { id: 'stations', label: 'Gares', description: 'Capacité, services voyageurs, hubs et immobilier ferroviaire.', nodes: [] },
    social: { id: 'social', label: 'RH', description: 'Formation, sécurité, productivité et organisation humaine.', nodes: [] }
  };

  const eraLabels = ['Train à vapeur', 'Train diesel', 'Train électrique', 'Train à grande vitesse', 'Train à hydrogène', 'Train à batterie', 'Train à sustentation magnétique'];
  const add = (group, id, title, description, requiredEpoch, prereq, unlocks, improves, options = {}) => {
    // Le fret reste une branche économique distincte pour les calculs existants,
    // mais il est présenté dans le sous-arbre Exploitation demandé par le jeu.
    const displayGroup = group === 'freight' ? 'operations' : group;
    groups[displayGroup].nodes.push({
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
      era: options.era || Math.min(7, Number(requiredEpoch || 0) + 1),
      eraLabel: options.eraLabel || eraLabels[Math.min(6, Math.max(0, Number(requiredEpoch || 0)))],
      infiniteScaling: options.infiniteScaling ?? null,
      disableAutoLevelEffect: Boolean(options.disableAutoLevelEffect),
      subtree: options.subtree || (group === 'freight' ? 'freight' : options.branch === 'freight' ? 'freight' : ''),
      sillonSlots: options.sillonSlots || null
    });
  };


  // Arbre Traction refondu depuis le document utilisateur : 7 ères ferroviaires avec dépendances par niveaux.
  add('traction', "steam_first_locomotives", "Premières locomotives à vapeur", "Ère 1 — Train à vapeur. Effets : +0,5% portée, +0,3% vitesse max.", 0, [], [], ["+0,5% portée", "+0,3% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_improved_boilers", "Chaudières améliorées", "Ère 1 — Train à vapeur. Effets : +0,8% vitesse max, -0,4% consommation.", 0, [{"id": "steam_first_locomotives", "level": 3}], [], ["+0,8% vitesse max", "-0,4% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_coal_water_reserves", "Réserves de charbon et d’eau", "Ère 1 — Train à vapeur. Effets : +1,2% portée.", 0, [{"id": "steam_first_locomotives", "level": 3}], [], ["+1,2% portée", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "steam_depots", "Dépôts vapeur", "Ère 1 — Train à vapeur. Effets : +1% portée, +0,4% fiabilité.", 0, [{"id": "steam_coal_water_reserves", "level": 3}], [], ["+1% portée", "+0,4% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "steam_passenger_locomotives", "Locomotives voyageurs vapeur", "Ère 1 — Train à vapeur. Effets : +1% vitesse max, +0,5% rentabilité.", 0, [{"id": "steam_improved_boilers", "level": 4}], ["Locomotive vapeur 220 express"], ["+1% vitesse max", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "steam_freight_locomotives", "Locomotives marchandises vapeur", "Ère 1 — Train à vapeur. Effets : +0,6% rentabilité, +0,5% fiabilité.", 0, [{"id": "steam_improved_boilers", "level": 4}], ["Locomotive vapeur 040 marchandises"], ["+0,6% rentabilité", "+0,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_economized", "Vapeur économisée", "Ère 1 — Train à vapeur. Effets : -0,8% consommation, +0,6% rentabilité.", 0, [{"id": "steam_improved_boilers", "level": 5}], [], ["-0,8% consommation", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_superheated", "Vapeur surchauffée", "Ère 1 — Train à vapeur. Effets : +1% vitesse max, -0,6% consommation, +0,4% fiabilité.", 0, [{"id": "steam_economized", "level": 5}], [], ["+1% vitesse max", "-0,6% consommation", "+0,4% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "steam_articulated_locomotives", "Locomotives articulées", "Ère 1 — Train à vapeur. Effets : +0,8% portée, +0,6% rentabilité.", 0, [{"id": "steam_freight_locomotives", "level": 5}, {"id": "steam_superheated", "level": 3}], ["Locomotive vapeur articulée 241"], ["+0,8% portée", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "steam_reinforced_brakes", "Freins renforcés", "Ère 1 — Train à vapeur. Effets : +0,4% vitesse max, +0,8% fiabilité.", 0, [{"id": "steam_passenger_locomotives", "level": 3}, {"id": "steam_freight_locomotives", "level": 3}], [], ["+0,4% vitesse max", "+0,8% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "steam_workshops", "Ateliers vapeur", "Ère 1 — Train à vapeur. Effets : +1% fiabilité, +0,5% rentabilité.", 0, [{"id": "steam_depots", "level": 5}], [], ["+1% fiabilité", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_oil_fired", "Vapeur au fuel", "Ère 1 — Train à vapeur. Effets : -0,7% consommation, +0,6% fiabilité, -0,4% impact environnemental.", 0, [{"id": "steam_superheated", "level": 5}, {"id": "steam_workshops", "level": 5}], [], ["-0,7% consommation", "+0,6% fiabilité", "-0,4% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_first_engines", "Premiers moteurs diesel", "Ère 2 — Train diesel. Effets : +0,8% portée, +0,5% fiabilité, -0,5% consommation.", 1, [{"id": "steam_workshops", "level": 5}, {"id": "steam_economized", "level": 5}], ["Autorail diesel léger"], ["+0,8% portée", "+0,5% fiabilité", "-0,5% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_light_railcars", "Autorails légers", "Ère 2 — Train diesel. Effets : -1% consommation, +0,8% rentabilité.", 1, [{"id": "diesel_first_engines", "level": 3}], ["Autorail diesel léger", "Automotrice diesel mécanique"], ["-1% consommation", "+0,8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_shunters", "Locomotives de manœuvre diesel", "Ère 2 — Train diesel. Effets : +0,6% fiabilité, +0,5% rentabilité.", 1, [{"id": "diesel_first_engines", "level": 3}], ["Locotracteur diesel de manœuvre"], ["+0,6% fiabilité", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "diesel_long_range_tanks", "Réservoirs grande autonomie", "Ère 2 — Train diesel. Effets : +1,5% portée.", 1, [{"id": "diesel_first_engines", "level": 4}], [], ["+1,5% portée", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "diesel_fuel_depots", "Dépôts carburant", "Ère 2 — Train diesel. Effets : +1% portée, +0,5% fiabilité.", 1, [{"id": "diesel_long_range_tanks", "level": 3}], [], ["+1% portée", "+0,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_mechanical", "Diesel mécanique", "Ère 2 — Train diesel. Effets : +0,5% fiabilité, +0,4% rentabilité.", 1, [{"id": "diesel_first_engines", "level": 5}], ["Automotrice diesel mécanique"], ["+0,5% fiabilité", "+0,4% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_hydraulic", "Diesel hydraulique", "Ère 2 — Train diesel. Effets : +0,7% vitesse max, -0,4% consommation.", 1, [{"id": "diesel_mechanical", "level": 5}], [], ["+0,7% vitesse max", "-0,4% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_electric", "Diesel-électrique", "Ère 2 — Train diesel. Effets : +0,8% fiabilité, -0,6% consommation, +0,5% rentabilité.", 1, [{"id": "diesel_mechanical", "level": 5}, {"id": "diesel_shunters", "level": 3}], [], ["+0,8% fiabilité", "-0,6% consommation", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_passenger_locomotives", "Locomotives diesel voyageurs", "Ère 2 — Train diesel. Effets : +0,8% vitesse max, +0,6% rentabilité.", 1, [{"anyOf": [{"id": "diesel_hydraulic", "level": 4}, {"id": "diesel_electric", "level": 4}]}], ["Locomotive diesel hydraulique voyageurs"], ["+0,8% vitesse max", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_freight_locomotives", "Locomotives diesel fret", "Ère 2 — Train diesel. Effets : +1% rentabilité, +0,5% fiabilité.", 1, [{"id": "diesel_electric", "level": 5}], ["Locomotive diesel-électrique fret"], ["+1% rentabilité", "+0,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_multiple_units", "Unités multiples diesel", "Ère 2 — Train diesel. Effets : +0,7% vitesse max, +0,6% fiabilité.", 1, [{"id": "diesel_passenger_locomotives", "level": 5}, {"id": "diesel_electric", "level": 3}], [], ["+0,7% vitesse max", "+0,6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "diesel_modern", "Diesel moderne", "Ère 2 — Train diesel. Effets : -1% consommation, -0,8% impact environnemental, +0,8% rentabilité.", 1, [{"id": "diesel_electric", "level": 8}, {"id": "diesel_fuel_depots", "level": 5}], [], ["-1% consommation", "-0,8% impact environnemental", "+0,8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_first_trains", "Premiers trains électriques", "Ère 3 — Train électrique. Effets : +0,8% vitesse max, -0,8% consommation, -1% impact environnemental.", 2, [{"anyOf": [{"id": "steam_workshops", "level": 5}, {"id": "diesel_first_engines", "level": 5}]}], ["Locomotive électrique pionnière"], ["+0,8% vitesse max", "-0,8% consommation", "-1% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_third_rail", "Troisième rail", "Ère 3 — Train électrique. Effets : +0,6% rentabilité, +0,5% fiabilité.", 2, [{"id": "electric_first_trains", "level": 3}], ["Automotrice troisième rail"], ["+0,6% rentabilité", "+0,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_dc_catenary", "Caténaire à courant continu", "Ère 3 — Train électrique. Effets : +0,8% portée, -0,6% consommation.", 2, [{"id": "electric_third_rail", "level": 5}], [], ["+0,8% portée", "-0,6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_ac_catenary", "Caténaire à courant alternatif monophasé", "Ère 3 — Train électrique. Effets : +1,2% portée, -0,8% consommation.", 2, [{"id": "electric_dc_catenary", "level": 8}], [], ["+1,2% portée", "-0,8% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_substations", "Sous-stations électriques", "Ère 3 — Train électrique. Effets : +0,8% fiabilité, -0,5% consommation.", 2, [{"id": "electric_dc_catenary", "level": 5}], [], ["+0,8% fiabilité", "-0,5% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_emus", "Automotrices électriques", "Ère 3 — Train électrique. Effets : +1% vitesse max, +0,6% rentabilité.", 2, [{"id": "electric_third_rail", "level": 5}, {"id": "electric_improved_motors", "level": 3}], ["Automotrice courant continu régionale"], ["+1% vitesse max", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_locomotives", "Locomotives électriques", "Ère 3 — Train électrique. Effets : +0,8% vitesse max, +0,7% rentabilité.", 2, [{"id": "electric_dc_catenary", "level": 5}, {"id": "electric_substations", "level": 3}], ["Locomotive bicourant multiservice", "Locomotive électrique fret lourd"], ["+0,8% vitesse max", "+0,7% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_improved_motors", "Moteurs électriques améliorés", "Ère 3 — Train électrique. Effets : +0,8% vitesse max, -0,6% consommation, +0,5% fiabilité.", 2, [{"id": "electric_first_trains", "level": 5}], [], ["+0,8% vitesse max", "-0,6% consommation", "+0,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_electronic_control", "Commande électronique de traction", "Ère 3 — Train électrique. Effets : -0,8% consommation, +0,6% fiabilité.", 2, [{"id": "electric_improved_motors", "level": 5}], [], ["-0,8% consommation", "+0,6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "electric_braking", "Freinage électrique", "Ère 3 — Train électrique. Effets : -0,5% consommation, +0,8% fiabilité.", 2, [{"id": "electric_electronic_control", "level": 3}], [], ["-0,5% consommation", "+0,8% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_energy_recovery", "Récupération d’énergie", "Ère 3 — Train électrique. Effets : -1% consommation, +0,8% rentabilité, -0,6% impact environnemental.", 2, [{"id": "electric_braking", "level": 5}, {"id": "electric_substations", "level": 5}], [], ["-1% consommation", "+0,8% rentabilité", "-0,6% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_dual_current_trains", "Trains bicourants", "Ère 3 — Train électrique. Effets : +1% portée, +0,6% rentabilité.", 2, [{"id": "electric_dc_catenary", "level": 8}, {"id": "electric_ac_catenary", "level": 5}], ["Locomotive bicourant multiservice"], ["+1% portée", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_multi_current_trains", "Trains multicourants", "Ère 3 — Train électrique. Effets : +1,5% portée, +0,8% rentabilité.", 2, [{"id": "electric_dual_current_trains", "level": 8}], [], ["+1,5% portée", "+0,8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "electric_antislip", "Antipatinage automatique", "Ère 3 — Train électrique. Effets : +1% fiabilité, +0,4% vitesse max.", 2, [{"id": "electric_electronic_control", "level": 5}], [], ["+1% fiabilité", "+0,4% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "electric_standardized_maintenance", "Maintenance électrique standardisée", "Ère 3 — Train électrique. Effets : +1% fiabilité, +0,6% rentabilité.", 2, [{"id": "electric_locomotives", "level": 5}, {"id": "electric_emus", "level": 5}], [], ["+1% fiabilité", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "hsv_first_fast_trains", "Premiers trains rapides", "Ère 4 — Train à grande vitesse. Effets : +1,2% vitesse max, +0,6% rentabilité.", 3, [{"anyOf": [{"id": "steam_passenger_locomotives", "level": 8}, {"id": "diesel_passenger_locomotives", "level": 8}, {"id": "electric_locomotives", "level": 5}]}], ["Train rapide Intercités 200"], ["+1,2% vitesse max", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_aerodynamics", "Aérodynamique ferroviaire", "Ère 4 — Train à grande vitesse. Effets : +1% vitesse max, -0,8% consommation.", 3, [{"id": "hsv_first_fast_trains", "level": 5}], [], ["+1% vitesse max", "-0,8% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_lightweight_materials", "Matériel allégé", "Ère 4 — Train à grande vitesse. Effets : +0,8% vitesse max, -0,6% consommation.", 3, [{"id": "hsv_first_fast_trains", "level": 5}], [], ["+0,8% vitesse max", "-0,6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('maintenance', "hsv_high_speed_braking", "Freinage haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +0,8% vitesse max, +1% fiabilité.", 3, [{"anyOf": [{"id": "steam_reinforced_brakes", "level": 8}, {"id": "electric_braking", "level": 5}]}], [], ["+0,8% vitesse max", "+1% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_adapted_tracks", "Voies adaptées à la grande vitesse", "Ère 4 — Train à grande vitesse. Effets : +1,5% vitesse max, +0,8% rentabilité.", 3, [{"id": "hsv_aerodynamics", "level": 5}, {"id": "hsv_high_speed_braking", "level": 5}], [], ["+1,5% vitesse max", "+0,8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('energy', "hsv_catenary", "Caténaire haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +1% vitesse max, -0,6% consommation.", 3, [{"id": "electric_ac_catenary", "level": 8}, {"id": "electric_substations", "level": 8}], [], ["+1% vitesse max", "-0,6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_trainsets", "Rames à grande vitesse", "Ère 4 — Train à grande vitesse. Effets : +1,8% vitesse max, +1% rentabilité.", 3, [{"id": "hsv_adapted_tracks", "level": 5}, {"id": "hsv_catenary", "level": 5}], ["Rame grande vitesse première génération"], ["+1,8% vitesse max", "+1% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('energy', "hsv_high_power_onboard", "Puissance embarquée élevée", "Ère 4 — Train à grande vitesse. Effets : +1,2% vitesse max, -0,5% consommation.", 3, [{"id": "hsv_trainsets", "level": 5}, {"id": "electric_improved_motors", "level": 8}], [], ["+1,2% vitesse max", "-0,5% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_stability", "Stabilité à haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +0,8% vitesse max, +1% fiabilité.", 3, [{"id": "hsv_aerodynamics", "level": 8}, {"id": "hsv_lightweight_materials", "level": 5}], [], ["+0,8% vitesse max", "+1% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_signaling", "Signalisation haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +1% vitesse max, +0,8% fiabilité.", 3, [{"id": "hsv_adapted_tracks", "level": 8}], [], ["+1% vitesse max", "+0,8% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_distributed_traction", "Traction répartie haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +0,8% vitesse max, -0,6% consommation, +0,6% fiabilité.", 3, [{"id": "hsv_trainsets", "level": 8}, {"id": "electric_electronic_control", "level": 8}], ["Rame grande vitesse Duplex"], ["+0,8% vitesse max", "-0,6% consommation", "+0,6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_premium_long_distance", "Services grande distance premium", "Ère 4 — Train à grande vitesse. Effets : +1,2% rentabilité.", 3, [{"id": "hsv_trainsets", "level": 5}, {"id": "hsv_stability", "level": 5}], ["Rame grande distance premium"], ["+1,2% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hydrogen_first_trains", "Premiers trains à hydrogène", "Ère 5 — Train à hydrogène. Effets : +0,8% portée, -1,2% impact environnemental.", 4, [{"id": "diesel_modern", "level": 5}, {"id": "electric_electronic_control", "level": 5}], ["Rame hydrogène régionale"], ["+0,8% portée", "-1,2% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_fuel_cell", "Pile à combustible ferroviaire", "Ère 5 — Train à hydrogène. Effets : -0,8% consommation, +0,6% fiabilité.", 4, [{"id": "hydrogen_first_trains", "level": 3}], ["Rame hydrogène à pile combustible"], ["-0,8% consommation", "+0,6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_secure_tanks", "Réservoirs hydrogène sécurisés", "Ère 5 — Train à hydrogène. Effets : +1,2% portée, +0,6% fiabilité.", 4, [{"id": "hydrogen_first_trains", "level": 3}], [], ["+1,2% portée", "+0,6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_refueling_stations", "Stations de ravitaillement hydrogène", "Ère 5 — Train à hydrogène. Effets : +1,5% portée, +0,5% rentabilité.", 4, [{"id": "hydrogen_secure_tanks", "level": 5}], [], ["+1,5% portée", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_green", "Hydrogène vert", "Ère 5 — Train à hydrogène. Effets : -1,5% impact environnemental, +0,5% rentabilité.", 4, [{"id": "hydrogen_refueling_stations", "level": 5}], [], ["-1,5% impact environnemental", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('maintenance', "hydrogen_specialized_maintenance", "Maintenance hydrogène spécialisée", "Ère 5 — Train à hydrogène. Effets : +1% fiabilité, +0,5% rentabilité.", 4, [{"id": "hydrogen_fuel_cell", "level": 5}], [], ["+1% fiabilité", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('traction', "hydrogen_regional_trains", "Trains régionaux hydrogène", "Ère 5 — Train à hydrogène. Effets : +0,8% portée, +0,6% rentabilité.", 4, [{"id": "hydrogen_fuel_cell", "level": 5}, {"id": "hydrogen_refueling_stations", "level": 3}], ["Rame hydrogène régionale"], ["+0,8% portée", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_optimized_energy_recharge", "Recharge énergétique optimisée", "Ère 5 — Train à hydrogène. Effets : -0,8% consommation, +0,8% rentabilité.", 4, [{"id": "hydrogen_fuel_cell", "level": 8}], [], ["-0,8% consommation", "+0,8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('maintenance', "hydrogen_enhanced_safety", "Sécurité hydrogène renforcée", "Ère 5 — Train à hydrogène. Effets : +1,2% fiabilité.", 4, [{"id": "hydrogen_secure_tanks", "level": 8}], [], ["+1,2% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_long_distance_tanks", "Réservoirs longue distance", "Ère 5 — Train à hydrogène. Effets : +1,8% portée.", 4, [{"id": "hydrogen_secure_tanks", "level": 8}, {"id": "hydrogen_enhanced_safety", "level": 5}], ["Rame hydrogène longue distance"], ["+1,8% portée", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('traction', "hydrogen_rural_lines", "Hydrogène pour lignes rurales", "Ère 5 — Train à hydrogène. Effets : +1% rentabilité, -0,8% impact environnemental.", 4, [{"id": "hydrogen_regional_trains", "level": 5}], [], ["+1% rentabilité", "-0,8% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_next_generation", "Hydrogène nouvelle génération", "Ère 5 — Train à hydrogène. Effets : +1,2% portée, -1% consommation, -1% impact environnemental.", 4, [{"id": "hydrogen_green", "level": 8}, {"id": "hydrogen_fuel_cell", "level": 8}, {"id": "hydrogen_enhanced_safety", "level": 5}], ["Rame hydrogène nouvelle génération"], ["+1,2% portée", "-1% consommation", "-1% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('traction', "battery_first_trains", "Premiers trains à batterie", "Ère 6 — Train à batterie. Effets : +1% autonomie, -1,5% impact environnemental.", 5, [{"id": "electric_energy_recovery", "level": 5}, {"id": "electric_electronic_control", "level": 5}], ["Rame batterie périurbaine"], ["+1% autonomie", "-1,5% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_railway_batteries", "Batteries ferroviaires", "Ère 6 — Train à batterie. Effets : +1,2% autonomie, +0,5% fiabilité.", 5, [{"id": "battery_first_trains", "level": 3}], [], ["+1,2% autonomie", "+0,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_catenary_charging", "Recharge sous caténaire", "Ère 6 — Train à batterie. Effets : +1% autonomie, -0,6% consommation.", 5, [{"id": "battery_railway_batteries", "level": 3}, {"id": "electric_ac_catenary", "level": 5}], [], ["+1% autonomie", "-0,6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_fast_station_charging", "Recharge rapide en gare", "Ère 6 — Train à batterie. Effets : +0,8% autonomie, +0,6% rentabilité.", 5, [{"id": "battery_railway_batteries", "level": 5}, {"id": "electric_substations", "level": 5}], ["Rame batterie recharge rapide"], ["+0,8% autonomie", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_long_range", "Batteries longue autonomie", "Ère 6 — Train à batterie. Effets : +1,8% autonomie.", 5, [{"id": "battery_railway_batteries", "level": 8}], [], ["+1,8% autonomie", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('maintenance', "battery_thermal_management", "Gestion thermique des batteries", "Ère 6 — Train à batterie. Effets : +1% fiabilité, +0,6% autonomie.", 5, [{"id": "battery_railway_batteries", "level": 5}], [], ["+1% fiabilité", "+0,6% autonomie", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_brake_energy_recovery", "Récupération d’énergie au freinage", "Ère 6 — Train à batterie. Effets : +1% autonomie, -0,8% consommation.", 5, [{"id": "electric_energy_recovery", "level": 8}, {"id": "battery_railway_batteries", "level": 5}], [], ["+1% autonomie", "-0,8% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('traction', "battery_suburban_trains", "Trains périurbains à batterie", "Ère 6 — Train à batterie. Effets : +0,8% rentabilité, -0,8% impact environnemental.", 5, [{"id": "battery_fast_station_charging", "level": 5}, {"id": "battery_thermal_management", "level": 3}], ["Rame batterie périurbaine"], ["+0,8% rentabilité", "-0,8% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('traction', "battery_regional_trains", "Trains régionaux à batterie", "Ère 6 — Train à batterie. Effets : +1,2% autonomie, +0,6% rentabilité.", 5, [{"id": "battery_long_range", "level": 5}, {"id": "battery_catenary_charging", "level": 5}], ["Rame batterie régionale"], ["+1,2% autonomie", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('maintenance', "battery_modular", "Batteries modulaires", "Ère 6 — Train à batterie. Effets : +0,8% fiabilité, +0,6% rentabilité.", 5, [{"id": "battery_thermal_management", "level": 5}], ["Rame batterie modulaire"], ["+0,8% fiabilité", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_auto_charge_optimization", "Optimisation automatique de charge", "Ère 6 — Train à batterie. Effets : -1% consommation, +0,8% autonomie.", 5, [{"id": "battery_modular", "level": 5}, {"id": "electric_electronic_control", "level": 8}], [], ["-1% consommation", "+0,8% autonomie", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_high_density", "Batteries haute densité", "Ère 6 — Train à batterie. Effets : +2% autonomie, +0,6% vitesse max.", 5, [{"id": "battery_long_range", "level": 8}, {"id": "battery_thermal_management", "level": 8}], ["Rame batterie haute densité"], ["+2% autonomie", "+0,6% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('traction', "maglev_levitation", "Sustentation magnétique", "Ère 7 — Train à sustentation magnétique. Effets : +2% vitesse max, -0,8% consommation. Note : Si le moteur du jeu ne permet pas de dépendre d’une recherche située plus bas, remplacer par : Rames à grande vitesse niveau 8 + Caténaire haute vitesse niveau 8.", 6, [{"id": "hsv_trainsets", "level": 8}, {"id": "maglev_high_power_energy", "level": 1}], ["Navette maglev pionnière"], ["+2% vitesse max", "-0,8% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_guidance", "Guidage magnétique", "Ère 7 — Train à sustentation magnétique. Effets : +1,2% fiabilité, +0,8% vitesse max.", 6, [{"id": "maglev_levitation", "level": 3}], ["Rame maglev guidée"], ["+1,2% fiabilité", "+0,8% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_linear_propulsion", "Propulsion linéaire", "Ère 7 — Train à sustentation magnétique. Effets : +1,8% vitesse max, -0,6% consommation.", 6, [{"id": "maglev_levitation", "level": 5}, {"id": "maglev_guidance", "level": 3}], ["Maglev express linéaire"], ["+1,8% vitesse max", "-0,6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_special_tracks", "Voies magnétiques spéciales", "Ère 7 — Train à sustentation magnétique. Effets : +1,5% vitesse max, +0,8% fiabilité.", 6, [{"id": "maglev_guidance", "level": 5}], [], ["+1,5% vitesse max", "+0,8% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_stations", "Gares maglev", "Ère 7 — Train à sustentation magnétique. Effets : +0,8% rentabilité, +0,6% fiabilité.", 6, [{"id": "maglev_special_tracks", "level": 3}], [], ["+0,8% rentabilité", "+0,6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_very_high_speed", "Très haute vitesse", "Ère 7 — Train à sustentation magnétique. Effets : +2,5% vitesse max, +1% rentabilité.", 6, [{"id": "maglev_linear_propulsion", "level": 8}, {"id": "maglev_special_tracks", "level": 8}], [], ["+2,5% vitesse max", "+1% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_silence_comfort", "Silence et confort avancés", "Ère 7 — Train à sustentation magnétique. Effets : +1% rentabilité, -0,6% impact environnemental.", 6, [{"id": "maglev_levitation", "level": 5}, {"id": "maglev_stations", "level": 3}], [], ["+1% rentabilité", "-0,6% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('maintenance', "maglev_contactless_maintenance", "Maintenance sans contact roue-rail", "Ère 7 — Train à sustentation magnétique. Effets : +1,2% fiabilité, +0,8% rentabilité.", 6, [{"id": "maglev_guidance", "level": 8}], [], ["+1,2% fiabilité", "+0,8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('maintenance', "maglev_advanced_high_speed_safety", "Sécurité haute vitesse avancée", "Ère 7 — Train à sustentation magnétique. Effets : +1,5% fiabilité.", 6, [{"id": "maglev_very_high_speed", "level": 5}, {"id": "hsv_signaling", "level": 8}], [], ["+1,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('energy', "maglev_high_power_energy", "Énergie haute puissance", "Ère 7 — Train à sustentation magnétique. Effets : +1,2% vitesse max, -0,5% consommation.", 6, [{"id": "hsv_catenary", "level": 8}, {"id": "electric_substations", "level": 8}], [], ["+1,2% vitesse max", "-0,5% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_metro_express_links", "Liaisons express métropolitaines", "Ère 7 — Train à sustentation magnétique. Effets : +1,5% rentabilité, +1% vitesse max.", 6, [{"id": "maglev_very_high_speed", "level": 5}, {"id": "maglev_stations", "level": 5}], ["Maglev express métropolitain"], ["+1,5% rentabilité", "+1% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_next_generation", "Maglev nouvelle génération", "Ère 7 — Train à sustentation magnétique. Effets : +2% vitesse max, -1% consommation, +1% fiabilité.", 6, [{"id": "maglev_very_high_speed", "level": 8}, {"id": "maglev_advanced_high_speed_safety", "level": 8}, {"id": "maglev_contactless_maintenance", "level": 8}], ["Maglev nouvelle génération"], ["+2% vitesse max", "-1% consommation", "+1% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});


  add('operations', 'manual_dispatch', 'Régulation manuelle structurée', 'Pose les bases des roulements et priorités de circulation.', 0, [], [], ['Ponctualité de base par niveau']);
  add('operations', 'block_signaling', 'Block automatique', 'Augmente le débit et réduit les conflits de circulation.', 1, ['manual_dispatch'], [], ['Attractivité et ponctualité par niveau']);
  add('operations', 'passing_loops', 'Évitements cadencés', 'Augmente le débit exploitable des lignes secondaires.', 1, ['manual_dispatch'], [], ['Débit soutenable sur petites lignes']);
  add('operations', 'centralized_control', 'Commande centralisée', 'Supervise plusieurs lignes depuis un poste unique.', 2, ['block_signaling'], [], ['Attractivité réseau et prérequis grande vitesse']);
  add('operations', 'clockface_timetable', 'Horaire cadencé', 'Rend les lignes plus lisibles pour les voyageurs.', 2, ['centralized_control'], [], ['Demande voyageurs et satisfaction accrues']);
  add('operations', 'incident_protocols', 'Plans incidents', 'Réduit l’impact des événements météo et sociaux.', 2, ['centralized_control'], [], ['Résilience événementielle par niveau']);
  add('operations', 'platform_dispatching', 'Gestion quais centralisée', 'Réduit les conflits dans les grandes gares.', 3, ['clockface_timetable', 'passenger_flow'], [], ['Capacité des nœuds accrue']);
  add('operations', 'traffic_simulation', 'Simulation de trafic', 'Prévoit la saturation avant ouverture des lignes.', 3, ['centralized_control'], [], ['Meilleure marge sur axes saturés']);
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
  add('social', 'driver_rosters', 'Roulements Conducteurs', 'Stabilise les lignes à fort trafic.', 1, ['crew_training'], [], ['Besoin Conducteur mieux couvert']);
  add('social', 'controller_service', 'Service commercial embarqué', 'Améliore satisfaction et revenus annexes.', 1, ['safety_training'], [], ['Satisfaction voyageurs par niveau']);
  add('social', 'mechanic_certification', 'Certification Mainteneurs', 'Améliore la qualité des interventions atelier.', 1, ['crew_training'], [], ['Maintenance plus efficace par niveau']);
  add('social', 'dispatcher_school', 'École de régulation', 'Renforce la ponctualité des réseaux complexes.', 2, ['driver_rosters', 'manual_dispatch'], [], ['Régulation et ponctualité par niveau']);
  add('social', 'social_dialogue', 'Dialogue social structuré', 'Réduit l’impact des tensions sociales.', 2, ['safety_training'], [], ['Résilience sociale par niveau']);
  add('social', 'engineering_office', 'Bureau d’études interne', 'Accélère légèrement les projets R&D complexes.', 2, ['apprenticeship_tracks'], [], ['Vitesse de recherche par niveau']);
  add('social', 'knowledge_management', 'Capitalisation technique', 'Rend chaque technologie plus facile à exploiter.', 3, ['engineering_office'], [], ['Effets de niveau plus rentables']);
  add('social', 'digital_training', 'Formation simulateur', 'Améliore la conduite des matériels modernes.', 4, ['dispatcher_school', 'real_time_information'], [], ['Fiabilité matériel moderne par niveau']);
  add('social', 'autonomous_supervision', 'Supervision des systèmes autonomes', 'Prépare les équipes au rail automatisé.', 5, ['digital_training', 'automated_dispatch'], [], ['Réduction coûts RH futurs']);

  add('operations', 'network_revenue_control', 'Pilotage revenu réseau', 'Arbitre prix, capacité et saturation entre lignes concurrentes.', 4, ['dynamic_pricing', 'traffic_simulation'], [], ['Marge des lignes denses améliorée']);
  add('operations', 'ai_timetable_planner', 'Planificateur horaire assisté', 'Construit des sillons robustes sur réseau complexe.', 5, ['automated_dispatch', 'knowledge_management'], [], ['Ponctualité et capacité réseau futures']);
  add('stations', 'station_energy_retrofit', 'Rénovation énergétique des gares', 'Réduit les coûts fixes des bâtiments voyageurs.', 3, ['electric_electronic_control', 'station_retail'], [], ['Charges de gares réduites par niveau']);
  add('stations', 'crowd_simulation', 'Simulation de foule', 'Évite la saturation des terminaux majeurs.', 4, ['major_terminal_design', 'real_time_information'], [], ['Capacité des grandes gares accrue']);
  add('freight', 'rail_road_interfaces', 'Interfaces rail-route', 'Améliore les plateformes combinées régionales.', 3, ['container_hubs'], [], ['Capture fret intermodal accrue']);
  add('freight', 'premium_logistics', 'Logistique premium', 'Structure les contrats urgents à forte marge.', 4, ['hazmat_protocols', 'cold_chain'], [], ['Revenus fret premium par niveau']);
  add('social', 'talent_retention', 'Fidélisation des talents', 'Stabilise les équipes qualifiées sur le long terme.', 3, ['social_dialogue', 'apprenticeship_tracks'], [], ['Coûts RH et qualité de service améliorés']);
  add('social', 'research_campus', 'Campus R&D ferroviaire', 'Accélère les recherches avancées sans achat instantané.', 4, ['engineering_office', 'knowledge_management'], [], ['Vitesse laboratoire par niveau']);

  // Les trois branches de support gardent un jalon technique à chaque ère.
  add('maintenance', 'diesel_lubrication_program', 'Programme de lubrification diesel', 'Normalise l’analyse des huiles et le remplacement préventif des organes mécaniques diesel.', 1, [{ id: 'diesel_first_engines', level: 3 }], [], ['Usure réduite et coût atelier abaissé']);
  add('stations', 'maglev_interchange_hubs', 'Pôles d’échanges maglev', 'Organise les correspondances avec les réseaux classiques autour des terminaux de très haute vitesse.', 6, [{ id: 'maglev_stations', level: 3 }, { id: 'intermodal_hubs', level: 5 }], [], ['Revenus gares et flux voyageurs accrus']);
  add('social', 'maglev_operations_certification', 'Certification exploitation maglev', 'Forme les équipes aux procédures de supervision et d’évacuation des systèmes à sustentation magnétique.', 6, [{ id: 'autonomous_supervision', level: 3 }, { id: 'maglev_guidance', level: 3 }], [], ['Besoin RH et coût salarial réduits']);

  // Débit commercial : chaque ligne débute à un seul sillon. Ces jalons ouvrent
  // progressivement des sillons supplémentaires, sans jamais dépasser la
  // capacité physique calculée pour le segment RFN le plus contraignant.
  const capacityEras = [
    { key: 'steam', epoch: 0, label: 'Train à vapeur', passenger: 'steam_passenger_locomotives', freight: 'steam_freight_locomotives', passengerTitle: 'Horaires voyageurs coordonnés', freightTitle: 'Marches marchandises organisées' },
    { key: 'diesel', epoch: 1, label: 'Train diesel', passenger: 'diesel_multiple_units', freight: 'diesel_freight_locomotives', passengerTitle: 'Cadencement régional diesel', freightTitle: 'Triage et acheminement diesel' },
    { key: 'electric', epoch: 2, label: 'Train électrique', passenger: 'electric_emus', freight: 'electric_locomotives', passengerTitle: 'Grille horaire électrifiée', freightTitle: 'Corridors fret électrifiés' },
    { key: 'high_speed', epoch: 3, label: 'Train à grande vitesse', passenger: 'hsv_signaling', freight: 'traffic_simulation', passengerTitle: 'Sillons grande vitesse cadencés', freightTitle: 'Plan de transport fret optimisé' },
    { key: 'hydrogen', epoch: 4, label: 'Train à hydrogène', passenger: 'hydrogen_regional_trains', freight: 'premium_logistics', passengerTitle: 'Dessertes régionales à autonomie étendue', freightTitle: 'Corridors logistiques à autonomie étendue' },
    { key: 'battery', epoch: 5, label: 'Train à batterie', passenger: 'battery_regional_trains', freight: 'driverless_corridors', passengerTitle: 'Roulements batterie interurbains', freightTitle: 'Fret cadencé sous supervision' },
    { key: 'maglev', epoch: 6, label: 'Train à sustentation magnétique', passenger: 'maglev_very_high_speed', freight: 'ai_timetable_planner', passengerTitle: 'Régulation très haute capacité', freightTitle: 'Logistique temps réel intégrée' }
  ];
  const slotIncrements = [1, 2, 3, 5, 7, 10, 20];
  for (const [index, era] of capacityEras.entries()) {
    const slots = slotIncrements[index];
    const previousPassenger = index ? [{ id: `passenger_slots_${capacityEras[index - 1].key}`, level: 1 }] : [];
    const previousFreight = index ? [{ id: `freight_slots_${capacityEras[index - 1].key}`, level: 1 }] : [];
    add('operations', `passenger_slots_${era.key}`, era.passengerTitle,
      `Augmente de ${slots} le nombre de sillons voyageurs utilisables par ligne, dans la limite de la capacité RFN. Les roulements plus réguliers étendent aussi la portée commerciale des dessertes.`,
      era.epoch, [...previousPassenger, { id: era.passenger, level: 1 }], [], [`+${slots} sillon${slots > 1 ? 's' : ''} voyageurs par ligne`, '+3% portée commerciale voyageurs'],
      { era: index + 1, eraLabel: era.label, maxLevel: 1, subtree: 'passengers', sillonSlots: { passengers: slots }, baseCostMoney: 62000 + index * 98000, baseDurationSeconds: 55 + index * 50 });
    add('freight', `freight_slots_${era.key}`, era.freightTitle,
      `Augmente de ${slots} le nombre de sillons fret utilisables par ligne, dans la limite de la capacité RFN. La planification des marches allonge la portée commerciale des trains de marchandises.`,
      era.epoch, [...previousFreight, { id: era.freight, level: 1 }], [], [`+${slots} sillon${slots > 1 ? 's' : ''} fret par ligne`, '+3% portée commerciale fret'],
      { era: index + 1, eraLabel: era.label, maxLevel: 1, subtree: 'freight', sillonSlots: { freight: slots }, baseCostMoney: 62000 + index * 98000, baseDurationSeconds: 55 + index * 50 });
  }

  synchronizeTechTreeWithTrainCatalog(groups);
  return finalizeTechTree(groups);
}
  */
}

function synchronizeTechTreeWithTrainCatalog(tree) {
  const nodes = new Map(Object.values(tree || {}).flatMap(group => group.nodes || []).map(node => [node.id, node]));
  const looksLikeLegacyRollingStock = value => /locomotive|rame|train|autorail|automotrice|maglev|navette|tgv|duplex/i.test(String(value || ''));

  for (const node of nodes.values()) {
    // Les mentions de matériels génériques de l'ancien catalogue ne doivent
    // plus apparaître dans les récompenses de recherche.
    node.unlocks = (node.unlocks || []).filter(unlock => !looksLikeLegacyRollingStock(unlock));
    node.catalogTrainIds = [];
  }

  for (const entry of trainCatalogEntries()) {
    const node = nodes.get(catalogTrainRequiredTech(entry));
    if (!node) throw new Error(`Recherche manquante pour le train ${entry.id}.`);
    node.unlocks.push(entry.gameName);
    node.catalogTrainIds.push(entry.id);
  }

  // Les intitulés de l'arbre v2 sont déjà formulés pour expliquer les
  // déblocages jouables. Les anciens remplacements de libellés ne s'appliquent
  // donc plus.
  return tree;

  const realTechnologyContext = {
    steam_first_locomotives: ['Standardisation des locomotives vapeur SNCF', 'Chaudières timbrées, distribution Walschaerts et normalisation de l’exploitation des 141 R.'],
    diesel_first_engines: ['Traction diesel-électrique', 'Moteur diesel, génératrice/alternateur et traction électrique embarquée des locomotives de ligne.'],
    electric_first_trains: ['Électrification 1,5 kV / 25 kV', 'Caténaires, sous-stations et moteurs de traction pour les grandes séries électriques françaises.'],
    hsv_first_fast_trains: ['LGV et signalisation en cabine', 'Infrastructure dédiée, TVM et freinage dimensionné pour les premières rames TGV.'],
    hsv_trainsets: ['Rames TGV articulées', 'Architecture articulée, bogies partagés et motrices d’extrémité des TGV Sud-Est et Atlantique.'],
    hsv_distributed_traction: ['Traction répartie IGBT', 'Électronique de puissance et traction répartie des Euroduplex et rames modernes.'],
    hsv_premium_long_distance: ['Plateforme Avelia Horizon', 'Architecture modulable et capacitaire inspirée du TGV M pour les liaisons longue distance.'],
    hydrogen_first_trains: ['Chaîne hydrogène ferroviaire', 'Pile à combustible, batteries tampon et stockage gazeux pour les automotrices hydrogène.'],
    hydrogen_regional_trains: ['Automotrices hydrogène régionales', 'Industrialisation des architectures Coradia iLint, Régiolis H2 et Mireo Plus H.'],
    hydrogen_next_generation: ['Hydrogène haute autonomie', 'Réservoirs composites, supervision énergétique et chaînes de traction de nouvelle génération.'],
    battery_first_trains: ['Batteries lithium-ion ferroviaires', 'Modules de traction batterie et recharge sous caténaire pour les premiers BEMU.'],
    battery_regional_trains: ['Automotrices BEMU régionales', 'Gestion énergétique, recharge opportuniste et autonomie renforcée pour les dessertes régionales.'],
    battery_high_density: ['Batteries haute densité', 'Cellules à haute énergie, refroidissement actif et systèmes de gestion batterie avancés.'],
    maglev_levitation: ['Sustentation électrodynamique supraconductrice', 'Guidage sans contact et aimants supraconducteurs inspirés des prototypes SCMaglev.'],
    maglev_guidance: ['Guidage magnétique actif', 'Contrôle de stabilité et positionnement actif à grande vitesse.'],
    maglev_linear_propulsion: ['Moteur linéaire synchrone', 'Propulsion linéaire, alimentation segmentée et contrôle précis de la vitesse.'],
    maglev_next_generation: ['Maglev grande vitesse de nouvelle génération', 'Chaîne de traction et sécurité système pour les plateformes MLX01 et L0 Series.']
  };
  for (const [id, [title, description]] of Object.entries(realTechnologyContext)) {
    const node = nodes.get(id);
    if (!node) continue;
    node.title = title;
    node.description = description;
  }
  return tree;
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

function researchTrainScope(node) {
  const era = clamp(Math.floor(Number(node?.era || Number(node?.requiredEpoch || 0) + 1)), 1, 7);
  const text = (String(node?.id || '') + ' ' + String(node?.title || '') + ' ' + String(node?.description || '')).toLowerCase();
  const mentionsFreight = /fret|wagon|triage|marchandise|logistique|conteneur/.test(text);
  const mentionsPassenger = /voyageur|confort|gare|correspondance|intermodal/.test(text);
  let service = 'all';
  if (node?.branch === 'freight' || node?.subtree === 'freight' || (mentionsFreight && !mentionsPassenger)) service = 'freight';
  else if (node?.branch === 'stations' || node?.subtree === 'passengers' || (mentionsPassenger && !mentionsFreight)) service = 'passenger';
  const energyType = ['coal', 'diesel', 'electricity', 'electricity', 'hydrogen', 'battery', 'electricity'][era - 1];
  const eraLabel = ['vapeur', 'diesel', 'électriques', 'grande vitesse', 'hydrogène', 'batterie', 'maglev'][era - 1];
  const serviceLabel = service === 'freight' ? 'fret' : service === 'passenger' ? 'voyageurs' : 'tous services';
  return { era, service, energyTypes: energyType ? [energyType] : [], label: eraLabel + ' · ' + serviceLabel };
}

function researchTrainEffectsForNode(node) {
  const scope = researchTrainScope(node);
  const text = (String(node.id || '') + ' ' + String(node.title || '') + ' ' + String(node.description || '')).toLowerCase();
  const effects = [];
  const add = (kind, value) => effects.push({ kind, value, target: scope });

  if (node.branch === 'maintenance' || /maintenance|atelier|frein|sécurité|lubrification|révision|dépôt/.test(text)) {
    add('reliability', 0.008);
    add('maintenance', -0.012);
  } else if (node.branch === 'stations' || /confort|gare|correspondance|intermodal|voyageur/.test(text)) {
    add('comfort', 0.01);
    add('reliability', 0.004);
  } else if (node.branch === 'social' || /équipage|conducteur|certification|formation|rh/.test(text)) {
    add('reliability', 0.007);
    add('maintenance', -0.006);
  } else if (node.branch === 'energy' || /énergie|caténaire|réservoir|recharge|batterie|carburant|hydrogène|alimentation/.test(text)) {
    add('range', 0.011);
    add('maintenance', -0.006);
  } else if (node.branch === 'freight' || scope.service === 'freight') {
    add('speed', 0.007);
    add('maintenance', -0.007);
  } else if (node.branch === 'operations' || /signalisation|horaire|régulation|sillon|cadencement|dispatch|circulation/.test(text)) {
    add('speed', 0.006);
    add('reliability', 0.006);
  } else if (/portée|autonomie|longue distance|réservoir/.test(text)) {
    add('range', 0.012);
    add('reliability', 0.004);
  } else if (/stabilité|guidage|sécurité/.test(text)) {
    add('reliability', 0.01);
    add('speed', 0.005);
  } else if (/confort|premium|couchette/.test(text)) {
    add('comfort', 0.012);
    add('reliability', 0.004);
  } else {
    add('speed', 0.01);
    add('reliability', 0.004);
  }
  return effects;
}

function researchTrainEffectText(effect) {
  const labels = {
    speed: 'vitesse',
    range: 'portée',
    reliability: 'fiabilité',
    comfort: 'confort',
    maintenance: 'coût de maintenance/h'
  };
  const pct = Math.abs(Number(effect?.value || 0) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const sign = Number(effect?.value || 0) >= 0 ? '+' : '-';
  return 'Trains concernés (' + (effect?.target?.label || 'matériels de l’époque') + ') : ' + sign + pct + ' % de ' + (labels[effect?.kind] || 'performance') + ' par niveau.';
}

function finalizeTechTree(tree) {
  for (const group of Object.values(tree)) {
    for (const node of group.nodes || []) {
      // Les déblocages arrivent tôt, puis la spécialisation reste disponible
      // sans niveau maximum affiché.
      node.maxLevel = null;
      node.unlimited = true;
      node.baseCostMoney ??= node.costMoney ?? 50000;
      node.baseDurationSeconds ??= node.baseDuration ?? node.duration ?? computedResearchBaseDurationSeconds(node);
      node.costGrowth ??= 1.72;
      node.durationGrowth ??= 1.54;
      node.levelValue ??= 1;
      node.unlocks ||= [];
      node.improves ||= node.effects || [];
      node.trainEffects = researchTrainEffectsForNode(node);
      const trainEffectTexts = node.trainEffects.map(researchTrainEffectText);
      node.improves = (node.improves || []).filter(effect => !String(effect || '').startsWith('Trains concernés ('));
      node.improves.unshift(...trainEffectTexts);
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
    operations: '+1 niveau de branche Exploitation : Meilleure ponctualité, débit ou robustesse des sillons.',
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
  const railSegments = buildRailSegments(railGraph, stationIndex);
  return {
    bounds: computeBounds(outlines),
    stations,
    stationIndex,
    regions,
    outline: outlines[0],
    outlines,
    railGraph,
    railSegments,
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

function buildRailSegments(graph, stationIndex) {
  return (graph || [])
    .map(([from, to]) => {
      const a = stationIndex[from];
      const b = stationIndex[to];
      if (!a || !b) return null;
      return {
        from,
        to,
        distance: Math.round(haversine(a.lat, a.lon, b.lat, b.lon)),
        geometry: [
          [Number(a.lon), Number(a.lat)],
          [Number(b.lon), Number(b.lat)]
        ]
      };
    })
    .filter(Boolean);
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
