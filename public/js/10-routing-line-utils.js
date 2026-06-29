// Routage client, brouillon de ligne, recherche gares et utilitaires finaux.
function trainName(train) {
  const model = app.state.balance.trains[train.modelId];
  return model ? model.name : train.modelId;
}

function distance(a, b) {
  const route = getRoute(a, b);
  return route.distance || 0;
}


function routeGeometryKey(a, b, profile = 'default') {
  return `${normalizeRouteProfileClient(profile)}::${a}->${b}`;
}

function routeGeometryStationPoint(id) {
  const s = station(id);
  if (!s) return null;
  const lon = stationRouteLon(s);
  const lat = stationRouteLat(s);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

function coordDistanceKm(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return Infinity;
  return haversineClient(Number(a[1]), Number(a[0]), Number(b[1]), Number(b[0]));
}

function addEndpointIfNeeded(coords, point, atStart) {
  if (!point || !Array.isArray(coords)) return coords || [];
  const end = atStart ? coords[0] : coords[coords.length - 1];
  if (!end || coordDistanceKm(point, end) > 0.03) return atStart ? [point, ...coords] : [...coords, point];
  const copy = [...coords];
  if (atStart) copy[0] = point;
  else copy[copy.length - 1] = point;
  return copy;
}

function officialRouteAliasForStation(id) {
  return id;
}

function routeGeometryAliasPair(a, b) {
  return {
    a: officialRouteAliasForStation(a),
    b: officialRouteAliasForStation(b)
  };
}

function geometryWithRequestedEndpoints(geometry, requestedA, requestedB, aliasA, aliasB) {
  let coords = Array.isArray(geometry) ? geometry : [];
  if (!coords.length && aliasA === aliasB) {
    const start = routeGeometryStationPoint(requestedA);
    const end = routeGeometryStationPoint(requestedB);
    return start && end ? [start, end] : [];
  }
  if (requestedA !== aliasA) coords = addEndpointIfNeeded(coords, routeGeometryStationPoint(requestedA), true);
  if (requestedB !== aliasB) coords = addEndpointIfNeeded(coords, routeGeometryStationPoint(requestedB), false);
  return coords;
}

function geometryForRoute(a, b, profile = 'default') {
  const direct = cachedRailGeometryForRoute(a, b, profile);
  if (direct) return direct;
  const alias = routeGeometryAliasPair(a, b);
  if (alias.a !== a || alias.b !== b) {
    if (alias.a === alias.b) return geometryWithRequestedEndpoints([], a, b, alias.a, alias.b);
    const aliasGeometry = cachedRailGeometryForRoute(alias.a, alias.b, profile);
    if (aliasGeometry) return geometryWithRequestedEndpoints(aliasGeometry, a, b, alias.a, alias.b);
    const aliasKey = routeGeometryKey(alias.a, alias.b, profile);
    if (!routeGeometryMarkedMissing(aliasKey) && !routeGeometryMarkedMissing(routeGeometryKey(alias.b, alias.a, profile))) {
      ensureRailwayRouteGeometry(alias.a, alias.b, profile);
    }
    return null;
  }
  const key = routeGeometryKey(a, b, profile);
  if (!routeGeometryMarkedMissing(key) && !routeGeometryMarkedMissing(routeGeometryKey(b, a, profile))) ensureRailwayRouteGeometry(a, b, profile);
  return null;
}

function cachedRailGeometryForRoute(a, b, profile = 'default') {
  const direct = getCacheEntry(app.osmRouteCache, routeGeometryKey(a, b, profile));
  if (direct) return direct;
  const reverse = getCacheEntry(app.osmRouteCache, routeGeometryKey(b, a, profile));
  if (reverse) return [...reverse].reverse();
  return null;
}


function normalizeRouteSpeedProfile(profile, geometry = null) {
  if (!profile || typeof profile !== 'object') return null;
  const geometryDistance = Array.isArray(geometry) && geometry.length >= 2 ? polylineGeoDistance(geometry) : 0;
  const totalKm = Number(profile.totalKm || geometryDistance || 0);
  const rawSegments = Array.isArray(profile.segments) ? profile.segments : [];
  const segments = [];
  for (const raw of rawSegments) {
    const fromKm = Math.max(0, Number(raw?.fromKm));
    const toKm = Math.max(0, Number(raw?.toKm));
    const speedKmh = Math.round(Number(raw?.speedKmh));
    if (![fromKm, toKm, speedKmh].every(Number.isFinite) || toKm <= fromKm || speedKmh < 5) continue;
    segments.push({
      fromKm,
      toKm,
      distanceKm: Math.max(0, Number(raw?.distanceKm || (toKm - fromKm))),
      speedKmh: Math.min(350, Math.max(5, speedKmh)),
      source: raw?.source || 'sncf-speed'
    });
  }
  if (!segments.length) return null;
  const safeTotal = Number.isFinite(totalKm) && totalKm > 0 ? totalKm : segments[segments.length - 1].toKm;
  const speeds = segments.map(segment => segment.speedKmh).filter(Number.isFinite);
  return {
    source: profile.source || 'sncf-speed',
    totalKm: safeTotal,
    coverage: Math.max(0, Math.min(1, Number(profile.coverage || 0))),
    averageSpeedKmh: Number(profile.averageSpeedKmh || 0) || null,
    minSpeedKmh: speeds.length ? Math.min(...speeds) : null,
    maxSpeedKmh: speeds.length ? Math.max(...speeds) : null,
    segments
  };
}

function reverseRouteSpeedProfile(profile, totalKm = null) {
  if (!profile?.segments?.length) return null;
  const distance = Number(totalKm || profile.totalKm || profile.segments[profile.segments.length - 1]?.toKm || 0);
  if (!Number.isFinite(distance) || distance <= 0) return profile;
  const segments = profile.segments
    .map(segment => ({
      fromKm: Math.max(0, distance - Number(segment.toKm || 0)),
      toKm: Math.max(0, distance - Number(segment.fromKm || 0)),
      distanceKm: Math.max(0, Number(segment.distanceKm || 0)),
      speedKmh: Number(segment.speedKmh),
      source: segment.source || 'sncf-speed'
    }))
    .filter(segment => segment.toKm > segment.fromKm)
    .sort((a, b) => a.fromKm - b.fromKm);
  return normalizeRouteSpeedProfile({ ...profile, totalKm: distance, segments });
}

function rememberRouteSpeedProfile(key, profile, geometry = null) {
  if (typeof key !== 'string') return null;
  const normalized = normalizeRouteSpeedProfile(profile, geometry);
  if (normalized) app.routeSpeedCache.set(key, normalized);
  return normalized;
}

function routeSpeedProfileForKey(key) {
  return typeof key === 'string' ? (app.routeSpeedCache.get(key) || null) : null;
}

function routeSpeedProfileForRoute(a, b, profile = 'default') {
  const directKey = routeGeometryKey(a, b, profile);
  const direct = routeSpeedProfileForKey(directKey);
  if (direct) return direct;
  const reverseKey = routeGeometryKey(b, a, profile);
  const reverse = routeSpeedProfileForKey(reverseKey);
  return reverse ? reverseRouteSpeedProfile(reverse) : null;
}

function appendRouteSpeedProfileSegments(out, profile, offsetKm = 0) {
  if (!Array.isArray(out) || !profile?.segments?.length) return;
  const offset = Number(offsetKm) || 0;
  for (const segment of profile.segments) {
    const fromKm = offset + Number(segment.fromKm || 0);
    const toKm = offset + Number(segment.toKm || 0);
    const speedKmh = Number(segment.speedKmh || 0);
    if (![fromKm, toKm, speedKmh].every(Number.isFinite) || toKm <= fromKm || speedKmh < 5) continue;
    const previous = out[out.length - 1];
    if (previous && previous.speedKmh === speedKmh && previous.source === (segment.source || 'sncf-speed') && Math.abs(previous.toKm - fromKm) < 0.03) {
      previous.toKm = toKm;
      previous.distanceKm = Math.max(0, previous.toKm - previous.fromKm);
    } else {
      out.push({ fromKm, toKm, distanceKm: toKm - fromKm, speedKmh, source: segment.source || 'sncf-speed' });
    }
  }
}

function combinedRouteSpeedProfile(segments, totalKm = 0) {
  if (!Array.isArray(segments) || !segments.length) return null;
  const safeTotal = Number(totalKm) > 0 ? Number(totalKm) : segments[segments.length - 1]?.toKm || 0;
  return normalizeRouteSpeedProfile({ source: 'sncf-speed-combined', totalKm: safeTotal, coverage: 1, segments });
}

function routeGeometryMarkedMissing(key) {
  const at = Number(app.osmRouteMissing?.get?.(key) || 0);
  if (!at) return false;
  if (Date.now() - at > 45000) {
    app.osmRouteMissing.delete(key);
    return false;
  }
  return true;
}

function markRouteGeometryMissing(key) {
  app.osmRouteMissing.set(key, Date.now());
}

async function ensureRailwayRouteGeometry(a, b, profile = 'default') {
  const key = routeGeometryKey(a, b, profile);
  if (app.osmRoutePending.has(key) || routeGeometryMarkedMissing(key) || routeGeometryMarkedMissing(routeGeometryKey(b, a, profile))) return;
  if (app.osmRoutePending.size >= OSM_ROUTE_FETCH_PARALLEL_LIMIT) return;
  const sa = station(a), sb = station(b);
  if (!sa || !sb) return;
  const directKm = stationRouteDistanceClient(sa, sb);
  if (!Number.isFinite(directKm) || directKm <= 0 || directKm > 1300) return;

  const latA = stationRouteLat(sa), lonA = stationRouteLon(sa);
  const latB = stationRouteLat(sb), lonB = stationRouteLon(sb);
  if (![latA, lonA, latB, lonB].every(Number.isFinite)) return;

  app.osmRoutePending.add(key);
  let foundGeometry = false;
  try {
    // Priorité stricte au RFN serveur : il utilise le dataset SNCF officiel et peut
    // reconstruire un chemin via les gares intermédiaires même si elles ne sont pas
    // des arrêts commerciaux de la ligne créée par le joueur.
    const sncf = await fetchSncfRouteGeometry(a, b, profile);
    if (sncf?.length >= 2) {
      rememberCacheEntry(app.osmRouteCache, key, sncf, OSM_ROUTE_CACHE_MAX_ENTRIES);
      app.osmRouteMissing.delete(key);
      app.osmRouteMissing.delete(routeGeometryKey(b, a, profile));
      foundGeometry = true;
      app.routeCache.clear();
      invalidateMapProjection('sncf-rail-geometry-loaded');
      if (app.activeTab === 'lines') updateLinePreview();
      return;
    }
  } catch (error) {
    // Non bloquant : le serveur refusera de toute façon les créations sans RFN.
  } finally {
    if (!foundGeometry) markRouteGeometryMissing(key);
    app.osmRoutePending.delete(key);
    if (!foundGeometry && app.activeTab === 'lines') {
      app.routeCache.clear();
      updateLinePreview();
    }
  }
}

async function fetchSncfRouteGeometry(a, b, profile = 'default') {
  try {
    const routeProfile = normalizeRouteProfileClient(profile);
    const response = await fetch(`/api/sncf/route-geometry?from=${encodeURIComponent(a)}&to=${encodeURIComponent(b)}&profile=${encodeURIComponent(routeProfile)}&rv=${encodeURIComponent(PERSISTED_OSM_ROUTE_CACHE_VERSION)}`, {
      cache: 'default',
      headers: authHeaders()
    });
    if (!response.ok) return [];
    const data = await response.json();
    const coords = Array.isArray(data.geometry) ? data.geometry : [];
    const normalized = coords
      .map(pair => [Number(pair[0]), Number(pair[1])])
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
    if (normalized.length >= 2) rememberRouteSpeedProfile(routeGeometryKey(a, b, routeProfile), data.speedProfile, normalized);
    return normalized;
  } catch {
    return [];
  }
}

async function fetchSncfRouteGeometryForStopSequence(ids, profile = 'default') {
  try {
    const cleanIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (cleanIds.length < 2) return [];
    const routeProfile = normalizeRouteProfileClient(profile);
    const response = await fetch(`/api/sncf/route-geometry-sequence?stops=${encodeURIComponent(cleanIds.join(','))}&profile=${encodeURIComponent(routeProfile)}&rv=${encodeURIComponent(PERSISTED_OSM_ROUTE_CACHE_VERSION)}`, {
      cache: 'default',
      headers: authHeaders()
    });
    if (!response.ok) return [];
    const data = await response.json();
    const coords = Array.isArray(data.geometry) ? data.geometry : [];
    const normalized = coords
      .map(pair => [Number(pair[0]), Number(pair[1])])
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
    if (normalized.length >= 2) rememberRouteSpeedProfile(geometryKeyForStops(cleanIds, routeProfile), data.speedProfile, normalized);
    return normalized;
  } catch {
    return [];
  }
}

function coordKey(lon, lat) {
  return `${Number(lon).toFixed(5)},${Number(lat).toFixed(5)}`;
}

function buildRailwayPathFromOverpass(elements, start, end, directKm) {
  const graph = new Map();
  const coordsByKey = new Map();

  function addNode(lon, lat) {
    if (![lon, lat].every(Number.isFinite)) return null;
    const key = coordKey(lon, lat);
    coordsByKey.set(key, [lon, lat]);
    if (!graph.has(key)) graph.set(key, []);
    return key;
  }

  for (const way of elements || []) {
    const geom = Array.isArray(way.geometry) ? way.geometry : [];
    for (let i = 1; i < geom.length; i++) {
      const a = geom[i - 1];
      const b = geom[i];
      const ka = addNode(Number(a.lon), Number(a.lat));
      const kb = addNode(Number(b.lon), Number(b.lat));
      if (!ka || !kb || ka === kb) continue;
      const weight = haversineClient(Number(a.lat), Number(a.lon), Number(b.lat), Number(b.lon));
      graph.get(ka).push([kb, weight]);
      graph.get(kb).push([ka, weight]);
    }
  }

  if (graph.size < 2) return [];
  const startKey = nearestRailNodeKey(coordsByKey, start);
  const endKey = nearestRailNodeKey(coordsByKey, end);
  if (!startKey || !endKey || startKey === endKey) return [];

  const ids = dijkstraRailNodePath(graph, startKey, endKey);
  if (ids.length < 2) return [];
  const path = ids.map(id => coordsByKey.get(id)).filter(Boolean);
  const pathDistance = polylineGeoDistance(path);
  if (pathDistance <= 0 || pathDistance > Math.max(35, directKm * 2.75)) return [];
  return [[start.lon, start.lat], ...path, [end.lon, end.lat]];
}

function nearestRailNodeKey(coordsByKey, point) {
  let best = null;
  for (const [key, [lon, lat]] of coordsByKey.entries()) {
    const distance = haversineClient(point.lat, point.lon, lat, lon);
    if (!best || distance < best.distance) best = { key, distance };
  }
  return best?.key || null;
}

function dijkstraRailNodePath(graph, startKey, endKey) {
  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const open = new Set(graph.keys());
  while (open.size) {
    let current = null;
    let best = Number.POSITIVE_INFINITY;
    for (const key of open) {
      const d = dist.get(key) ?? Number.POSITIVE_INFINITY;
      if (d < best) { best = d; current = key; }
    }
    if (!current || current === endKey || !Number.isFinite(best)) break;
    open.delete(current);
    for (const [next, weight] of graph.get(current) || []) {
      if (!open.has(next)) continue;
      const alt = best + weight;
      if (alt < (dist.get(next) ?? Number.POSITIVE_INFINITY)) {
        dist.set(next, alt);
        prev.set(next, current);
      }
    }
  }
  if (!dist.has(endKey)) return [];
  const out = [endKey];
  let cur = endKey;
  while (prev.has(cur)) {
    cur = prev.get(cur);
    out.push(cur);
  }
  out.reverse();
  return out;
}

function polylineGeoDistance(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineClient(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return total;
}

function getRoute(a, b, options = {}) {
  const profile = normalizeRouteProfileClient(options.profile || 'default');
  const key = `${profile}::${a}::${b}`;
  const cached = getCacheEntry(app.routeCache, key);
  if (cached) return cached;
  const reverseKey = `${profile}::${b}::${a}`;
  const reverse = getCacheEntry(app.routeCache, reverseKey);
  if (reverse) {
    const route = {
      ...reverse,
      ids: [...reverse.ids].reverse(),
      points: [...(reverse.points || [])].reverse(),
      coords: [...(reverse.coords || [])].reverse(),
      speedProfile: reverseRouteSpeedProfile(reverse.speedProfile, reverse.distance)
    };
    return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
  }

  const geometry = geometryForRoute(a, b, profile);
  if (!geometry?.length) {
    const route = { ids: [a, b].filter(Boolean), distance: 0, maxSegment: 0, points: [], coords: [], pending: !routeGeometryMarkedMissing(routeGeometryKey(a, b, profile)) };
    return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
  }

  const points = geometry
    .map(([lon, lat]) => project(lon, lat))
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  const distance = Math.round(polylineGeoDistance(geometry));
  const route = {
    ids: [a, b],
    distance,
    maxSegment: distance,
    points,
    coords: geometry,
    speedProfile: routeSpeedProfileForRoute(a, b, profile)
  };
  return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
}

function resolveSegmentPath(a, b) {
  const sa = station(a), sb = station(b);
  if (!sa || !sb) return [];

  const geometry = geometryForRoute(a, b);
  if (geometry?.length >= 2) {
    const projected = geometry.map(([lon, lat]) => project(lon, lat)).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (projected.length >= 2) return projected;
  }

  return [];
}

function fallbackSinuousRailSegmentPath(a, b, start, end) {
  if (String(a) > String(b)) return fallbackSinuousRailSegmentPath(b, a, end, start).reverse();
  if (!start || !end) return [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (!Number.isFinite(dist) || dist <= 0) return [start, end];

  const nx = -dy / dist;
  const ny = dx / dist;
  const tx = dx / dist;
  const ty = dy / dist;
  const seed = hashCode(`fallback-sinuous:${a}|${b}`);
  const phaseA = deterministicUnit(seed + 11);
  const phaseB = deterministicUnit(seed + 29);
  const phaseC = deterministicUnit(seed + 47);
  const polarity = deterministicUnit(seed + 71) < 0.5 ? -1 : 1;

  // Fallback visuel uniquement : aucun tracé SNCF/RFN ou Overpass n'a été trouvé.
  // On génère donc un corridor ferroviaire fictif, mais volontairement doux :
  // peu de changements de direction, courbure progressive et points spline
  // suréchantillonnés pour éviter les cassures visibles au dézoom.
  const shortFactor = clamp(dist / 120, 0.36, 1);
  const anchorCount = Math.max(4, Math.min(10, Math.ceil(dist / 115) + 2));
  const amplitude = Math.min(46, Math.max(5.5, dist * 0.045)) * shortFactor;
  const drift = Math.min(18, Math.max(2, dist * 0.015));
  const anchors = [];

  for (let i = 0; i <= anchorCount; i++) {
    const t = i / anchorCount;
    const envelope = Math.sin(Math.PI * t);
    const easedEnvelope = Math.pow(Math.max(0, envelope), 0.94);
    const broad = Math.sin((t + phaseA * 0.28) * Math.PI * 2) * 0.56;
    const secondary = Math.sin((t * 1.72 + phaseB) * Math.PI * 2) * 0.24;
    const local = (deterministicUnit(seed + 101 + i * 37) - 0.5) * 0.26;
    const lateral = easedEnvelope * amplitude * polarity * (broad + secondary + local);
    const longitudinal = envelope * drift * Math.sin((t * 1.35 + phaseC) * Math.PI * 2) * 0.34;

    anchors.push({
      x: start.x + dx * t + nx * lateral + tx * longitudinal,
      y: start.y + dy * t + ny * lateral + ty * longitudinal
    });
  }

  anchors[0] = { ...start };
  anchors[anchors.length - 1] = { ...end };

  const samplesPerSegment = dist < 90 ? 8 : dist < 240 ? 10 : 12;
  const points = catmullRomRoutePoints(anchors, samplesPerSegment);
  points[0] = { ...start };
  points[points.length - 1] = { ...end };
  return cleanRoutePoints(points);
}

function catmullRomRoutePoints(anchors, samplesPerSegment = 10) {
  if (!Array.isArray(anchors) || anchors.length < 3) return anchors || [];
  const points = [];
  const samples = Math.max(4, Math.min(18, Math.round(samplesPerSegment || 10)));
  for (let i = 0; i < anchors.length - 1; i++) {
    const p0 = anchors[Math.max(0, i - 1)];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = anchors[Math.min(anchors.length - 1, i + 2)];
    const firstSample = i === 0 ? 0 : 1;
    for (let step = firstSample; step <= samples; step++) {
      const t = step / samples;
      points.push(catmullRomPoint(p0, p1, p2, p3, t));
    }
  }
  return points;
}

function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}

function directRailDistance(a, b) {
  const sa = station(a), sb = station(b);
  if (!sa || !sb) return 0;
  return stationRouteDistanceClient(sa, sb);
}

function ensureSelectedStation() {
  const current = app.selectedStation || localStorage.getItem('sillons.selectedStation') || '';
  if (current && station(current)) {
    app.selectedStation = current;
    localStorage.setItem('sillons.selectedStation', current);
    return;
  }
  const owned = app.state?.me ? Object.keys(app.state.me.stations || {}) : [];
  if (owned.length) {
    setSelectedStation(owned[0]);
  }
}




function lineStopsOf(line) {
  const raw = Array.isArray(line?.stops) && line.stops.length ? line.stops : [line?.from, line?.to];
  return raw.map(id => String(id || '').trim()).filter(Boolean);
}

function lineTrainIdsOf(line) {
  const raw = Array.isArray(line?.trainIds) && line.trainIds.length ? line.trainIds : [line?.trainId];
  return [...new Set(raw.map(id => String(id || '').trim()).filter(Boolean))];
}

function lineHasTrain(line, trainId) {
  return lineTrainIdsOf(line).includes(String(trainId || '').trim());
}

function lineAssignedTrainsClient(line, player = app.state?.me) {
  const trainsById = new Map((player?.trains || []).map(train => [train.id, train]));
  return lineTrainIdsOf(line).map(id => trainsById.get(id)).filter(Boolean);
}

function lineCadenceTimingClient(service, stopCount) {
  const intermediateStops = Math.max(0, Number(stopCount || 0) - 2);
  if (service === 'freight') return { intermediateStops, dwellMinutes: 5, turnaroundMinutes: 18 };
  if (service === 'mixed') return { intermediateStops, dwellMinutes: 4, turnaroundMinutes: 12 };
  return { intermediateStops, dwellMinutes: 3, turnaroundMinutes: 8 };
}

function lineCadenceClient(line) {
  const stored = line?.stats?.cadence;
  if (stored && Number.isFinite(Number(stored.roundTripMinutes))) return stored;

  const plannedTrains = lineAssignedTrainsClient(line);
  const operatingTrains = plannedTrains.filter(train => !train.construction?.active && !train.maintenance?.active && Number(train.condition ?? 1) > 0);
  const timingTrains = operatingTrains.length ? operatingTrains : plannedTrains;
  const timing = lineCadenceTimingClient(line?.service, lineStopsOf(line).length);
  const speeds = timingTrains
    .map(train => Number(train.profile?.speed || app.state.balance.trains[train.modelId]?.speed || 0))
    .filter(speed => Number.isFinite(speed) && speed > 0);
  const operatingSpeedKmh = Math.max(25, Math.min(...(speeds.length ? speeds : [80])));
  const distance = Math.max(0, Number(lineDistance(line) || 0));
  const profileSegments = line?.speedProfile?.segments || [];
  const rfnTravelMinutes = profileSegments.reduce((sum, segment) => {
    const segmentDistance = Math.max(0, Number(segment?.distanceKm || (Number(segment?.toKm) - Number(segment?.fromKm)) || 0));
    const limit = Math.max(5, Number(segment?.speedKmh || line?.speedProfile?.averageSpeedKmh || operatingSpeedKmh));
    return sum + segmentDistance / Math.max(5, Math.min(operatingSpeedKmh, limit)) * 60;
  }, 0);
  const oneWayMinutes = distance > 0
    ? (rfnTravelMinutes || distance / operatingSpeedKmh * 60) + timing.intermediateStops * timing.dwellMinutes
    : 0;
  const roundTripMinutes = oneWayMinutes > 0
    ? oneWayMinutes * 2 + timing.turnaroundMinutes * 2
    : 0;
  const plannedTrainCount = plannedTrains.length;
  const availableTrainCount = operatingTrains.length;
  const requestedFrequency = Number(line?.stats?.capacity?.requestedFrequency ?? lineSlotDemandClient(line));
  const effectiveFrequency = Number(line?.stats?.capacity?.effectiveFrequency ?? requestedFrequency);
  const utilizationFactor = requestedFrequency > 0 ? Math.max(0, Math.min(1, effectiveFrequency / requestedFrequency)) : 0;
  const effectiveTrainCount = availableTrainCount * utilizationFactor;
  const plannedHeadwayMinutes = plannedTrainCount > 0 && roundTripMinutes > 0 ? roundTripMinutes / plannedTrainCount : null;
  const headwayMinutes = effectiveTrainCount > 0 && roundTripMinutes > 0 ? roundTripMinutes / effectiveTrainCount : null;
  return {
    version: 'cadence-v1',
    plannedTrainCount,
    availableTrainCount,
    effectiveTrainCount: round(effectiveTrainCount),
    operatingSpeedKmh: Math.round(operatingSpeedKmh),
    intermediateStops: timing.intermediateStops,
    dwellMinutes: timing.dwellMinutes,
    oneWayMinutes: round(oneWayMinutes),
    turnaroundMinutes: timing.turnaroundMinutes,
    roundTripMinutes: round(roundTripMinutes),
    plannedHeadwayMinutes: plannedHeadwayMinutes == null ? null : round(plannedHeadwayMinutes),
    headwayMinutes: headwayMinutes == null ? null : round(headwayMinutes),
    departuresPerHour: headwayMinutes ? round(60 / headwayMinutes) : 0,
    status: !plannedTrainCount ? 'no-train' : !availableTrainCount ? 'suspended' : effectiveTrainCount + 0.001 < plannedTrainCount ? 'reduced' : 'normal'
  };
}

function stationOwnerClient(stationId) {
  for (const player of app.state?.players || []) {
    if (player?.stations?.[stationId]) return { player, asset: player.stations[stationId] };
  }
  return null;
}

function validateLineStopServiceClient(stops, service) {
  for (const stopId of stops || []) {
    const s = station(stopId);
    if (!s) return `Gare inconnue : ${stopId}.`;
    const passengerOk = Boolean(s.hasPassengerStation);
    const freightOk = Boolean(s.hasFreightStation);
    if (service === 'passengers' && !passengerOk) return `${s.name} n’est pas une gare voyageurs.`;
    if (service === 'freight' && !freightOk) return `${s.name} n’est pas une gare fret.`;
    if (service === 'mixed' && (!passengerOk || !freightOk)) return `${s.name} ne permet pas un service mixte voyageurs + fret.`;
  }
  return '';
}

function lineOwnershipProblemClient(stops) {
  const ids = Array.isArray(stops) ? stops : [];
  for (const stopId of ids) {
    if (!station(stopId)) return `Arrêt invalide : ${stopId}.`;
  }
  // Les gares libres peuvent être desservies sans achat préalable.
  // Le propriétaire d'une gare, s'il existe, sert uniquement au calcul des péages.
  return '';
}

function lineExternalRightsLabel(stops) {
  const ids = Array.isArray(stops) ? stops : [];
  const owners = new Map();
  for (const stopId of ids) {
    const owner = stationOwnerClient(stopId);
    if (owner && owner.player.id !== app.state?.me?.id) owners.set(owner.player.id, owner.player.name);
  }
  if (!owners.size) return '';
  return `Péage de gare dû à : ${[...owners.values()].join(', ')}.`;
}

function lineStopsLabel(stops) {
  return stops.map(id => station(id)?.name || id).join(' → ');
}

function lineDisplayName(line) {
  const stops = lineStopsOf(line);
  if (stops.length >= 2) return `${station(stops[0])?.name || stops[0]} → ${station(stops[stops.length - 1])?.name || stops[stops.length - 1]}`;
  if (line.name && !/^\w{2,4}-\d{3}$/i.test(String(line.name))) return line.name;
  return line.code || 'Ligne';
}

function linePublicName(line) {
  const stops = lineStopsOf(line);
  if (stops.length >= 2) {
    return `${station(stops[0])?.name || stops[0]} → ${station(stops[stops.length - 1])?.name || stops[stops.length - 1]}`;
  }
  return lineDisplayName(line);
}

function lineCompositionService(line, train = null, model = null) {
  const candidateTrain = train || app.state?.me?.trains?.find(t => t.id === line?.trainId);
  const candidateModel = model || (candidateTrain ? app.state?.balance?.trains?.[candidateTrain.modelId] : null);
  const explicitMode = candidateTrain?.composition?.mode || candidateTrain?.compositionMode || candidateTrain?.compositionSpec?.mode;
  if (explicitMode === 'multiple_unit' || isMultipleUnitModelClient(candidateModel)) return { key: 'passengers', label: 'Voyageur' };
  if (explicitMode === 'freight_loco') return { key: 'freight', label: 'Fret' };
  if (explicitMode === 'passenger_loco') return { key: 'passengers', label: 'Voyageur' };
  if (line?.service === 'freight') return { key: 'freight', label: 'Fret' };
  if (line?.service === 'passengers') return { key: 'passengers', label: 'Voyageur' };
  const profile = candidateTrain && candidateModel ? previewOperatingProfile(candidateTrain, candidateModel) : candidateModel;
  const pax = Number(profile?.capacity ?? candidateModel?.capacity ?? 0);
  const freight = Number(profile?.freight ?? candidateModel?.freight ?? 0);
  if (freight > pax && freight >= 80) return { key: 'freight', label: 'Fret' };
  return { key: 'passengers', label: 'Voyageur' };
}

function renderLineServicePill(line, train = null, model = null) {
  const svc = lineCompositionService(line, train, model);
  return `<span class="tag line-service-pill ${escapeAttr(svc.key)}">${escapeHtml(svc.label)}</span>`;
}

function routeDistanceForStopOrder(stops) {
  const ids = stops.filter(Boolean);
  let total = 0;
  for (let i = 1; i < ids.length; i++) total += distance(ids[i - 1], ids[i]);
  return total;
}

function bestIntermediateInsertIndex(stops, stopId) {
  const ids = stops.filter(Boolean);
  if (ids.length < 2) return Math.max(0, ids.length - 1);
  let bestIndex = 0;
  let bestCost = Number.POSITIVE_INFINITY;

  // Pour une desserte intermédiaire, on teste entre deux arrêts existants.
  // On évite donc l'ajout automatique après le terminus, source des demi-tours visuels.
  for (let i = 0; i < ids.length - 1; i++) {
    const before = ids[i];
    const after = ids[i + 1];
    const added = distance(before, stopId) + distance(stopId, after) - distance(before, after);
    if (added < bestCost) {
      bestCost = added;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function insertStopAtBestIntermediatePosition(stops, stopId) {
  const ids = stops.filter(Boolean);
  if (ids.includes(stopId)) return ids;
  if (ids.length < 2) return [...ids, stopId];
  const index = bestIntermediateInsertIndex(ids, stopId);
  return [...ids.slice(0, index + 1), stopId, ...ids.slice(index + 1)];
}

function coherentStopOrder(stops) {
  const ids = stops.filter(Boolean);
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
    // On garde le premier arrêt puis on évite les ordres qui forcent un demi-tour.
    visit([ids[0]], ids.slice(1));
  } else {
    let ordered = [ids[0]];
    const remaining = ids.slice(1);
    while (remaining.length) {
      let bestIndex = 0;
      let bestCost = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i++) {
        const d = distance(ordered[ordered.length - 1], remaining[i]);
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

function buildLineDraftStops() {
  return stopsFromLineDraft(app.lineDraft || {});
}

function renderDraftStopStrip(stops, waypoints = []) {
  if (!stops.length) return '<span class="muted small">Aucun arrêt sélectionné.</span>';
  return stops.map((id, index) => {
    const s = station(id);
    const cls = index === 0 ? 'origin' : index === stops.length - 1 ? 'terminal' : 'via';
    const label = index === 0 ? 'Départ' : index === stops.length - 1 ? 'Arrivée' : 'Intermédiaire';
    return `<span class="line-stop-pill ${cls}"><b>${escapeHtml(label)}</b> ${escapeHtml(s?.name || id)}</span>`;
  }).join('<span class="line-stop-arrow">→</span>');
}

function renderWaypointChip(id, index) {
  const s = station(id);
  return `<div class="line-waypoint-chip"><span>${index + 1}. ${escapeHtml(s?.name || id)}</span><button type="button" data-action="remove-waypoint" data-index="${index}">Retirer</button></div>`;
}

function addDraftWaypoint() {
  updateLineDraftFromForm();
  const draft = app.lineDraft;
  const stopId = draft.viaCandidate;
  if (!stopId || !station(stopId)) {
    toast('Choisis d’abord une suggestion pour l’arrêt intermédiaire.', 'error');
    return;
  }
  const currentStops = buildLineDraftStops();
  if (currentStops.includes(stopId)) {
    toast('Cet arrêt est déjà présent sur la ligne.', 'error');
    return;
  }

  // En création de ligne, l'ordre est celui préparé par le joueur :
  // départ → arrêts ajoutés successivement → terminus.
  // L'ancienne insertion automatique "meilleure position" pouvait déplacer une
  // gare au mauvais endroit quand les distances provisoires n'étaient pas encore
  // confirmées par la géométrie RFN.
  draft.waypoints = [...(draft.waypoints || []), stopId];
  draft.viaCandidate = '';
  draft.viaQuery = '';
  saveLineDraft();
  renderAll();
}

function removeDraftWaypoint(index) {
  const draft = app.lineDraft || {};
  draft.waypoints = (draft.waypoints || []).filter((_, i) => i !== Number(index));
  saveLineDraft();
  renderAll();
}

function geometryKeyForStops(ids, profile = 'default') {
  return `stops::${normalizeRouteProfileClient(profile)}::${ids.join('>')}`;
}

function geometryForStopSequence(ids, profile = 'default') {
  const key = geometryKeyForStops(ids, profile);
  const direct = getCacheEntry(app.osmRouteCache, key);
  if (direct) return direct;
  ensureOsmRouteGeometryForStops(ids, profile);
  return null;
}

async function ensureOsmRouteGeometryForStops(ids, profile = 'default') {
  if (!app.map.leaflet || !Array.isArray(ids) || ids.length < 2) return;
  const key = geometryKeyForStops(ids, profile);
  if (app.osmRoutePending.has(key) || app.osmRoutePending.size >= OSM_ROUTE_FETCH_PARALLEL_LIMIT) return;
  const stations = ids.map(id => station(id)).filter(Boolean);
  if (stations.length !== ids.length) return;
  app.osmRoutePending.add(key);
  try {
    const sequenceGeometry = await fetchSncfRouteGeometryForStopSequence(ids, profile);
    if (sequenceGeometry?.length >= 2) {
      rememberCacheEntry(app.osmRouteCache, key, sequenceGeometry, OSM_ROUTE_CACHE_MAX_ENTRIES);
      app.routeCache.delete(`multi::${normalizeRouteProfileClient(profile)}::${ids.join('::')}`);
      invalidateMapProjection('sncf-sequence-geometry-loaded');
      if (app.activeTab === 'lines') updateLinePreview('sncf-sequence-geometry-loaded');
      return;
    }

    for (let i = 1; i < ids.length; i++) {
      await ensureRailwayRouteGeometry(ids[i - 1], ids[i], profile);
    }
    const coords = [];
    for (let i = 1; i < ids.length; i++) {
      const segment = cachedRailGeometryForRoute(ids[i - 1], ids[i], profile);
      if (!segment?.length) return;
      if (!coords.length) coords.push(...segment);
      else coords.push(...segment.slice(1));
    }
    if (coords.length >= 2) {
      rememberCacheEntry(app.osmRouteCache, key, coords, OSM_ROUTE_CACHE_MAX_ENTRIES);
      app.routeCache.delete(`multi::${normalizeRouteProfileClient(profile)}::${ids.join('::')}`);
      invalidateMapProjection('sncf-segment-geometry-loaded');
    }
  } catch (error) {
    // Non bloquant : on garde l'itinéraire ferroviaire de secours.
  } finally {
    app.osmRoutePending.delete(key);
  }
}

function cleanRoutePoints(points) {
  if (!Array.isArray(points) || points.length < 3) return points || [];
  const deduped = [];
  for (const p of points) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 2) deduped.push(p);
  }

  const cleaned = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const a = cleaned[cleaned.length - 1];
    const b = deduped[i];
    const c = deduped[i + 1];
    const ab = Math.hypot(b.x - a.x, b.y - a.y);
    const bc = Math.hypot(c.x - b.x, c.y - b.y);
    const ac = Math.hypot(c.x - a.x, c.y - a.y);
    // Supprime les micro-retours visuels quand un point fait un crochet quasi demi-tour.
    if (ab < 16 && bc < 16 && ac < Math.max(ab, bc) * 0.58) continue;
    cleaned.push(b);
  }
  cleaned.push(deduped[deduped.length - 1]);
  return cleaned;
}

function pointFromStationId(id) {
  const s = station(id);
  if (!s) return null;
  const p = projectStationPoint(s);
  return Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
}

function deterministicUnit(seed) {
  const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function sampleCatmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}

const COASTAL_VISUAL_WAYPOINTS = {
  // Correction visuelle : la liaison La Roche-sur-Yon → La Rochelle ne doit
  // jamais couper la baie / l’océan. Ces points suivent l’intérieur des terres
  // autour de Luçon / Marans, uniquement pour le rendu carte.
  'LRS|LAR': [
    { lon: -1.245, lat: 46.515 },
    { lon: -1.140, lat: 46.395 },
    { lon: -1.015, lat: 46.290 }
  ]
};

function visualGuidePointFromEntry(entry) {
  if (typeof entry === 'string') return pointFromStationId(entry);
  if (entry && Number.isFinite(entry.lon) && Number.isFinite(entry.lat)) {
    const p = project(entry.lon, entry.lat);
    return Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  }
  return null;
}

function expandVisualRouteEntries(ids) {
  const entries = [];
  for (let i = 0; i < ids.length; i++) {
    if (!entries.length || entries[entries.length - 1] !== ids[i]) entries.push(ids[i]);
    if (i >= ids.length - 1) continue;

    const a = ids[i];
    const b = ids[i + 1];
    const direct = COASTAL_VISUAL_WAYPOINTS[`${a}|${b}`];
    const reverse = COASTAL_VISUAL_WAYPOINTS[`${b}|${a}`];
    const waypoints = direct || (reverse ? [...reverse].reverse() : null);
    if (waypoints) entries.push(...waypoints);
  }
  return entries;
}

function organicRailSplineThroughStops(ids) {
  const entries = expandVisualRouteEntries(ids);
  const anchors = entries.map(visualGuidePointFromEntry).filter(Boolean);
  if (anchors.length < 2) return anchors;

  const points = [];
  const routeSeed = hashCode(ids.join('>'));

  for (let i = 0; i < anchors.length - 1; i++) {
    const p0 = anchors[Math.max(0, i - 1)];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = anchors[Math.min(anchors.length - 1, i + 2)];
    const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const steps = Math.max(22, Math.min(62, Math.round(chord / 13)));
    const seed = routeSeed + hashCode(`${i}:${Math.round(p1.x)}:${Math.round(p1.y)}:${Math.round(p2.x)}:${Math.round(p2.y)}`);

    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const base = sampleCatmullRom(p0, p1, p2, p3, t);
      const ahead = sampleCatmullRom(p0, p1, p2, p3, Math.min(1, t + 0.025));
      const dx = ahead.x - base.x;
      const dy = ahead.y - base.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const envelope = Math.sin(Math.PI * t);
      const wave1 = Math.sin((t * 2.1 + deterministicUnit(seed)) * Math.PI * 2);
      const wave2 = Math.sin((t * 4.0 + deterministicUnit(seed + 17)) * Math.PI * 2) * 0.36;

      // Les segments côtiers reçoivent une ondulation plus faible pour éviter
      // qu’une courbe décorative ne reparte vers l’océan.
      const isCoastalGuided = entries.some(e => typeof e !== 'string');
      const maxAmp = isCoastalGuided ? 26 : 42;
      const amplitude = Math.min(maxAmp, Math.max(8, chord * 0.035));
      const offset = envelope * amplitude * (wave1 + wave2);

      points.push({
        x: base.x + nx * offset,
        y: base.y + ny * offset
      });
    }
  }

  points.push(anchors[anchors.length - 1]);
  return cleanRoutePoints(smoothPolyline(points, 2));
}

function smoothPolyline(points, passes = 1) {
  let out = points || [];
  for (let pass = 0; pass < passes; pass++) {
    if (out.length < 4) return out;
    const next = [out[0]];
    for (let i = 1; i < out.length - 1; i++) {
      const a = out[i - 1];
      const b = out[i];
      const c = out[i + 1];
      next.push({
        x: a.x * 0.18 + b.x * 0.64 + c.x * 0.18,
        y: a.y * 0.18 + b.y * 0.64 + c.y * 0.18
      });
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

function routeHasVisualBacktrack(points) {
  if (!Array.isArray(points) || points.length < 8) return false;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  const direct = Math.hypot(points[points.length - 1].x - points[0].x, points[points.length - 1].y - points[0].y);
  if (direct > 0 && total > direct * 2.9) return true;

  let reversals = 0;
  for (let i = 2; i < points.length; i++) {
    const ax = points[i - 1].x - points[i - 2].x;
    const ay = points[i - 1].y - points[i - 2].y;
    const bx = points[i].x - points[i - 1].x;
    const by = points[i].y - points[i - 1].y;
    const al = Math.hypot(ax, ay);
    const bl = Math.hypot(bx, by);
    if (al < 8 || bl < 8) continue;
    const dot = (ax * bx + ay * by) / (al * bl);
    if (dot < -0.70) reversals++;
  }
  return reversals >= 4;
}

function getRouteForStops(stops, options = {}) {
  const profile = normalizeRouteProfileClient(options.profile || 'default');
  const ids = Array.isArray(stops) ? stops.filter(Boolean) : lineStopsOf(stops);
  const key = `multi::${profile}::${ids.join('::')}`;
  const cached = getCacheEntry(app.routeCache, key);
  if (cached) return cached;
  if (ids.length < 2) {
    const single = { ids, distance: 0, maxSegment: 0, points: [], coords: [] };
    return rememberCacheEntry(app.routeCache, key, single, ROUTE_CACHE_MAX_ENTRIES);
  }

  const sequenceGeometry = geometryForStopSequence(ids, profile);
  if (sequenceGeometry?.length >= 2) {
    const sequencePoints = sequenceGeometry
      .map(([lon, lat]) => project(lon, lat))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (sequencePoints.length >= 2) {
      const distance = Math.round(polylineGeoDistance(sequenceGeometry));
      const route = {
        ids,
        distance,
        maxSegment: distance,
        points: cleanRoutePoints(sequencePoints),
        coords: sequenceGeometry,
        speedProfile: routeSpeedProfileForKey(key)
      };
      return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
    }
  }

  let mergedIds = [ids[0]];
  let distanceTotal = 0;
  let maxSegment = 0;
  let points = [];
  let coords = [];
  const mergedSpeedSegments = [];

  for (let i = 1; i < ids.length; i++) {
    const segment = getRoute(ids[i - 1], ids[i], { profile });
    if (!segment.distance || !segment.points?.length) {
      const route = { ids, distance: 0, maxSegment: 0, points: [], coords: [], pending: Boolean(segment.pending) };
      return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
    }
    mergedIds.push(...segment.ids.slice(1));
    const offsetKm = distanceTotal;
    distanceTotal += segment.distance || 0;
    maxSegment = Math.max(maxSegment, segment.maxSegment || 0);
    appendRouteSpeedProfileSegments(mergedSpeedSegments, segment.speedProfile, offsetKm);

    if (!points.length) points.push(...segment.points);
    else points.push(...segment.points.slice(1));
    if (Array.isArray(segment.coords) && segment.coords.length) {
      if (!coords.length) coords.push(...segment.coords);
      else coords.push(...segment.coords.slice(1));
    }
  }

  points = cleanRoutePoints(points);
  // Ne plus remplacer un tracé détaillé par une spline organique.
  // Cette ancienne sécurité était utile pour certains fallbacks, mais elle pouvait
  // dégrader un vrai parcours RFN en le simplifiant visuellement.
  const route = { ids: mergedIds, distance: Math.round(distanceTotal), maxSegment: Math.round(maxSegment), points, coords, speedProfile: combinedRouteSpeedProfile(mergedSpeedSegments, distanceTotal) };
  return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
}

function lineDistance(line) {
  const stored = Number(line?.distance);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  return getRouteForStops(lineStopsOf(line)).distance || 0;
}

function normalizedTicketDistance(distance) {
  const value = Number(distance);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TICKET_DISTANCE;
}

function suggestedTicketPrice(distance) {
  const km = normalizedTicketDistance(distance);
  return Math.max(1, Math.round(km * DEFAULT_PASSENGER_TARIFF));
}

function ticketPriceCeiling(distance) {
  const km = normalizedTicketDistance(distance);
  return Math.round(Math.min(TICKET_PRICE_CAP_ABSOLUTE, Math.max(5, 2.5 + km * 0.18)));
}

function normalizeTicketPrice(value, fallback = suggestedTicketPrice(DEFAULT_TICKET_DISTANCE), distance = DEFAULT_TICKET_DISTANCE) {
  const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
  const price = hasValue ? Number(value) : Number.NaN;
  const base = Number.isFinite(price) ? price : Number(fallback);
  const normalized = Math.max(0, Math.round(Number.isFinite(base) ? base : suggestedTicketPrice(distance)));
  return Math.min(ticketPriceCeiling(distance), normalized);
}

function ticketPriceToTariff(ticketPrice, distance) {
  const km = normalizedTicketDistance(distance);
  const price = normalizeTicketPrice(ticketPrice, suggestedTicketPrice(distance), distance);
  return price / km;
}

function tariffToTicketPrice(tariff, distance) {
  const km = normalizedTicketDistance(distance);
  const rate = Number(tariff);
  const value = Number.isFinite(rate) ? Math.max(0, rate) * km : suggestedTicketPrice(distance);
  return normalizeTicketPrice(value, suggestedTicketPrice(distance), distance);
}

function ticketSliderMax(distance, ticketPrice) {
  return ticketPriceCeiling(distance);
}

function renderTicketPriceControl({ inputId, rangeId, hintId, price, distance }) {
  const cap = ticketPriceCeiling(distance);
  const ticketPrice = normalizeTicketPrice(price, suggestedTicketPrice(distance), distance);
  return `
    <div class="ticket-price-control" data-ticket-control="${escapeAttr(inputId)}">
      <div class="ticket-price-row">
        <input id="${escapeAttr(rangeId)}" class="ticket-price-range" type="range" min="0" max="${cap}" step="1" value="${ticketPrice}" data-ticket-input-id="${escapeAttr(inputId)}">
        <div class="ticket-price-entry">
          <input id="${escapeAttr(inputId)}" class="ticket-price-input" type="number" min="0" max="${cap}" step="1" inputmode="numeric" value="${escapeAttr(ticketPrice)}" data-ticket-range-id="${escapeAttr(rangeId)}">
          <span>€</span>
        </div>
      </div>
      <span id="${escapeAttr(hintId)}" class="input-hint">${escapeHtml(ticketPriceHint(distance, ticketPrice))}</span>
    </div>
  `;
}

function stopsFromLineDraft(draft = app.lineDraft || {}) {
  return [draft.from, ...((draft.waypoints || []).filter(Boolean)), draft.to].filter(Boolean);
}

function draftTicketDistance(draft = app.lineDraft || {}) {
  const stops = stopsFromLineDraft(draft);
  return stops.length >= 2 ? getRouteForStops(stops, { profile: routeProfileForDraftClient(draft) }).distance || 0 : 0;
}

function lineTicketPrice(line) {
  const stored = Number(line?.ticketPrice);
  if (Number.isFinite(stored)) return normalizeTicketPrice(stored, tariffToTicketPrice(line.tariff, lineDistance(line)), lineDistance(line));
  return tariffToTicketPrice(line.tariff, lineDistance(line));
}

function ticketPriceHint(distance, ticketPrice) {
  const km = normalizedTicketDistance(distance);
  const cap = ticketPriceCeiling(distance);
  const normalized = normalizeTicketPrice(ticketPrice, suggestedTicketPrice(distance), distance);
  const tariffPer100Km = round(ticketPriceToTariff(normalized, distance) * 100);
  if (!Number.isFinite(Number(distance)) || Number(distance) <= 0) {
    return `Ajuste au curseur ou tape le montant. Plafond provisoire : ${money(cap)}. Equivalent ${tariffPer100Km} EUR / 100 km.`;
  }
  return `${formatInt(km)} km. Plafond billet : ${money(cap)}. Equivalent ${tariffPer100Km} EUR / 100 km.`;
}

function syncLineDraftTicket(distance = draftTicketDistance()) {
  const draft = app.lineDraft || {};
  const price = normalizeTicketPrice(draft.ticketPrice, tariffToTicketPrice(draft.tariff, distance), distance);
  draft.ticketPrice = price;
  draft.tariff = ticketPriceToTariff(price, distance);
  return price;
}

function refreshLineTicketInput(distance, ticketPrice, sourceId = '') {
  refreshTicketPriceControl('lineTicketPrice', 'lineTicketPriceRange', 'lineTicketPriceHint', distance, ticketPrice, sourceId);
}

function refreshTicketPriceControl(inputId, rangeId, hintId, distance, ticketPrice, sourceId = '') {
  const input = $(`#${inputId}`);
  const range = $(`#${rangeId}`);
  const normalized = normalizeTicketPrice(ticketPrice, suggestedTicketPrice(distance), distance);
  const cap = ticketPriceCeiling(distance);

  if (range) {
    range.max = String(cap);
    if (sourceId !== rangeId) range.value = String(normalized);
  }

  if (input) {
    input.max = String(cap);
    const inputIsSource = sourceId === inputId;
    const inputHasFocus = document.activeElement === input;
    const inputValueTooHigh = Number(input.value) > cap;
    if (!inputIsSource || !inputHasFocus || inputValueTooHigh) input.value = String(normalized);
  }

  const hint = $(`#${hintId}`);
  if (hint) hint.textContent = ticketPriceHint(distance, normalized);
}


function normalizeLineDraft(freeTrains = []) {
  const draft = { ...app.lineDraft };
  draft.from = draft.from || '';
  draft.to = draft.to || '';
  draft.fromQuery = draft.fromQuery || stationSearchLabel(station(draft.from));
  draft.toQuery = draft.toQuery || stationSearchLabel(station(draft.to));
  draft.waypoints = Array.isArray(draft.waypoints) ? draft.waypoints.filter(Boolean) : [];
  draft.viaCandidate = draft.viaCandidate || '';
  draft.viaQuery = draft.viaQuery || '';
  draft.trainId = draft.trainId || freeTrains[0]?.id || '';
  draft.service = draft.service || 'passengers';
  draft.frequency = clampNumber(draft.frequency, 1, 20, 4);
  const ticketDistance = draftTicketDistance(draft);
  draft.ticketPrice = normalizeTicketPrice(draft.ticketPrice, tariffToTicketPrice(draft.tariff, ticketDistance), ticketDistance);
  draft.tariff = ticketPriceToTariff(draft.ticketPrice, ticketDistance);
  app.lineDraft = draft;
  saveLineDraft();
  return draft;
}

function updateLineDraftFromForm(sourceId = '') {
  if (!$('#lineForm')) return app.lineDraft;
  const nextDraft = {
    from: $('#lineFrom')?.value || app.lineDraft.from || '',
    to: $('#lineTo')?.value || app.lineDraft.to || '',
    fromQuery: $('#lineFromSearch')?.value || app.lineDraft.fromQuery || '',
    toQuery: $('#lineToSearch')?.value || app.lineDraft.toQuery || '',
    waypoints: Array.isArray(app.lineDraft.waypoints) ? app.lineDraft.waypoints : [],
    viaCandidate: $('#lineVia')?.value || app.lineDraft.viaCandidate || '',
    viaQuery: $('#lineViaSearch')?.value || app.lineDraft.viaQuery || '',
    trainId: $('#lineTrain')?.value || app.lineDraft.trainId || '',
    service: $('#lineService')?.value || app.lineDraft.service || 'passengers'
  };
  const ticketDistance = draftTicketDistance(nextDraft);
  const priceControl = sourceId === 'lineTicketPriceRange' ? $('#lineTicketPriceRange') : $('#lineTicketPrice');
  const rawTicketPrice = priceControl?.value;
  nextDraft.ticketPrice = normalizeTicketPrice(
    rawTicketPrice !== undefined && rawTicketPrice !== '' ? rawTicketPrice : app.lineDraft.ticketPrice,
    tariffToTicketPrice(app.lineDraft.tariff, ticketDistance),
    ticketDistance
  );
  nextDraft.tariff = ticketPriceToTariff(nextDraft.ticketPrice, ticketDistance);
  app.lineDraft = nextDraft;
  saveLineDraft();
  return app.lineDraft;
}


function updateStationSearch(role, rawValue) {
  if (role === 'station') {
    app.stationSearch.query = rawValue;
    const query = String(rawValue || '').trim();
    if (!query) {
      app.stationSearch.candidateId = '';
      setSelectedStation(null);
      const hidden = $('#lineStation');
      if (hidden) hidden.value = '';
      renderStationSuggestions('station', [], rawValue);
      updateSelectedStationPanel();
      return;
    }

    const matches = findStationMatches(rawValue, 10, app.stationSortMode);
    const best = matches[0] || null;
    app.stationSearch.candidateId = best?.id || '';
    if (best) setSelectedStation(best.id);
    else setSelectedStation(null);
    const hidden = $('#lineStation');
    if (hidden) hidden.value = app.stationSearch.candidateId;
    renderStationSuggestions('station', matches, rawValue);
    updateSelectedStationPanel();
    return;
  }

  const key = role === 'to' ? 'to' : role === 'via' ? 'viaCandidate' : 'from';
  const queryKey = role === 'to' ? 'toQuery' : role === 'via' ? 'viaQuery' : 'fromQuery';
  app.lineDraft[queryKey] = rawValue;
  const matches = findStationMatches(rawValue, 10);
  const best = matches[0];
  if (best) app.lineDraft[key] = best.id;
  const hidden = $(`#line${capitalize(role)}${role === 'via' ? '' : ''}`);
  if (hidden) hidden.value = app.lineDraft[key] || '';
  renderStationSuggestions(role, matches, rawValue);
  saveLineDraft();
  updateLinePreview();
}

function chooseStationSuggestion(role, stationId) {
  const s = station(stationId);
  if (!s) return;
  if (role === 'station') {
    setSelectedStation(s.id);
    app.stationSearch.query = stationSearchLabel(s);
    app.stationSearch.candidateId = s.id;
    const input = $('#lineStationSearch');
    const hidden = $('#lineStation');
    const box = $('#lineStationSuggestions');
    if (input) input.value = app.stationSearch.query;
    if (hidden) hidden.value = s.id;
    if (box) box.innerHTML = '';
    if (app.map.leaflet) app.map.leaflet.setView([s.lat, s.lon], Math.max(app.map.leaflet.getZoom(), 9), { animate: true });
    app.activeTab = 'stations';
    localStorage.setItem('sillons.activeTab', app.activeTab);
    renderAll();
    return;
  }
  if (role === 'from' || role === 'to') {
    const key = role;
    app.lineDraft[key] = s.id;
    app.lineDraft[`${key}Query`] = stationSearchLabel(s);
  } else if (role === 'via') {
    app.lineDraft.viaCandidate = s.id;
    app.lineDraft.viaQuery = stationSearchLabel(s);
  } else if (role === 'editor') {
    if (!app.lineEditor) return;
    app.lineEditor.candidateId = s.id;
    app.lineEditor.candidateQuery = stationSearchLabel(s);
    const input = $('#editorStopSearch');
    const hidden = $('#editorStopId');
    if (input) input.value = app.lineEditor.candidateQuery;
    if (hidden) hidden.value = s.id;
    const box = $('#editorStopSuggestions');
    if (box) box.innerHTML = '';
    return;
  }
  const input = $(`#line${capitalize(role)}Search`);
  const hidden = $(`#line${capitalize(role)}`);
  if (input) input.value = role === 'via' ? app.lineDraft.viaQuery : app.lineDraft[`${role}Query`];
  if (hidden) hidden.value = role === 'via' ? app.lineDraft.viaCandidate : s.id;
  const box = $(`#line${capitalize(role)}Suggestions`);
  if (box) box.innerHTML = '';
  saveLineDraft();
  updateLinePreview();
  if (app.map.leaflet) app.map.leaflet.setView([s.lat, s.lon], Math.max(app.map.leaflet.getZoom(), 8), { animate: true });
}

function refreshLineSearchWidgets() {
  if (!$('#lineForm')) return;
  for (const role of ['from', 'to']) {
    const value = app.lineDraft[`${role}Query`] || stationSearchLabel(station(app.lineDraft[role]));
    const input = $(`#line${capitalize(role)}Search`);
    if (input && document.activeElement !== input) input.value = value || '';
    const hidden = $(`#line${capitalize(role)}`);
    if (hidden) hidden.value = app.lineDraft[role] || '';
  }
  const viaInput = $('#lineViaSearch');
  if (viaInput && document.activeElement !== viaInput) viaInput.value = app.lineDraft.viaQuery || '';
  const viaHidden = $('#lineVia');
  if (viaHidden) viaHidden.value = app.lineDraft.viaCandidate || '';
}


function renderStationSearchResults(rawValue = '', sortMode = app.stationSortMode) {
  const query = String(rawValue || '').trim();
  if (!query) return '<p class="muted small">Saisis le nom d’une gare pour afficher les résultats ici.</p>';
  const matches = findStationMatches(query, 8, sortMode);
  if (!matches.length) return '<p class="muted small">Aucune gare trouvée.</p>';
  return matches.map(s => `
    <button type="button" class="station-result-card" data-role="station" data-station-choice="${escapeAttr(s.id)}">
      <strong>${escapeHtml(s.name)}</strong>
      <span>${escapeHtml(stationPurchaseMetaLabel(s))}</span>
    </button>
  `).join('');
}

function updateStationSearchResults() {
  const box = $('#stationSearchResults');
  if (!box) return;
  box.innerHTML = renderStationSearchResults(app.stationSearch.query, app.stationSortMode);
}

function renderStationSuggestions(role, matches, rawValue) {
  const box = $(`#line${capitalize(role)}Suggestions`);
  if (!box) return;
  if (!String(rawValue || '').trim()) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = matches.length ? matches.map(s => `
    <button type="button" class="station-suggest-item" data-role="${role}" data-station-choice="${escapeAttr(s.id)}">
      <strong>${escapeHtml(s.name)}</strong>
      <span>${escapeHtml(role === 'station' ? stationPurchaseMetaLabel(s) : stationMetaLabel(s))}</span>
    </button>
  `).join('') : '<div class="station-suggest-empty">Aucune gare trouvée.</div>';
}

function findStationMatches(query, limit = 12, sortMode = '') {
  const q = normalizeStationSearchText(query || '');
  const all = dedupedStations(app.state?.world?.stations || []);
  if (!q) {
    const candidates = sortMode ? sortStationsForPurchase(all, sortMode) : topStationCandidates(limit);
    return candidates.slice(0, limit);
  }
  const matches = all
    .map(s => {
      const name = normalizeStationSearchText(s.name);
      const postal = (s.codesPostaux || []).join(' ');
      // Le rang est volontairement distinct du score : une gare dont le nom
      // commence par la saisie doit toujours précéder une simple occurrence.
      const exact = name === q;
      const starts = name.startsWith(q);
      const includes = name.includes(q);
      const postalMatch = postal.includes(q);
      const rank = exact ? 0 : starts ? 1 : includes ? 2 : postalMatch ? 3 : 4;
      const owned = app.state.me?.stations?.[s.id] ? 500 : 0;
      const pop = Number(s.population || s.baseDemand * 450 || 10000);
      return {
        s,
        rank,
        score: owned + Math.log10(pop) * 12,
        matches: exact || starts || includes || postalMatch
      };
    })
    .filter(x => x.matches);

  const collator = new Intl.Collator('fr', { sensitivity: 'base' });
  const ordered = matches
    .sort((a, b) => a.rank - b.rank || b.score - a.score || collator.compare(a.s.name || '', b.s.name || ''))
    .map(x => x.s);

  return ordered.slice(0, limit);
}

function topStationCandidates(limit = 12) {
  return dedupedStations(app.state?.world?.stations || [])
    .sort((a, b) => Number(b.population || b.baseDemand * 450 || 0) - Number(a.population || a.baseDemand * 450 || 0))
    .slice(0, limit);
}

function stationSearchLabel(s) {
  if (!s) return '';
  const pop = s.population ? ` · ${formatInt(s.population)} hab.` : '';
  return `${s.name}${pop}`;
}

function stationMetaLabel(s) {
  if (!s) return '';
  if (s.annualPassengers) return `${formatInt(s.annualPassengers)} voy./an · ${s.codesPostaux?.[0] || s.codeDepartement || 'France'}`;
  if (s.population) return `${formatInt(s.population)} hab. · ${s.codesPostaux?.[0] || s.codeDepartement || 'France'}`;
  return s.region || 'Gare principale';
}

function normalizeSearchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeStationSearchText(value) {
  return normalizeSearchText(value)
    .replace(/[’'`]/g, ' ')
    .replace(/[-_/.,;:()[\]{}]+/g, ' ')
    .replace(/\b(?:st|ste)\.?(?=\s|$)/g, 'saint')
    .replace(/\bsainte\b/g, 'saint')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalize(value) {
  return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
}

function saveLineDraft() {
  localStorage.setItem('sillons.lineDraft', JSON.stringify(app.lineDraft || {}));
}

function serviceOptions(selected = 'passengers') {
  return Object.entries(serviceLabels)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`)
    .join('');
}

function isInteractiveElement(target) {
  const el = target?.closest?.('input, select, textarea, button, [contenteditable="true"], .station-suggest-item, .logo-choice, .line-waypoint-chip, .modal, details, summary');
  if (!el) return false;
  if (el.closest('#topStats')) return false;
  return Boolean(el.closest('#tabContent, #setup, .modal, #logoPicker'));
}

function markUiInteraction(duration = 1800) {
  app.uiInteractionUntil = Math.max(app.uiInteractionUntil || 0, performance.now() + duration);
}

function isInteractiveUiActive() {
  if (performance.now() < (app.uiInteractionUntil || 0)) return true;
  const active = document.activeElement;
  if (!active || active === document.body) return false;
  if (active.matches?.('input, select, textarea, button, [contenteditable="true"]')) {
    return Boolean(active.closest('#tabContent, #setup, .modal'));
  }
  return Boolean(active.closest?.('.station-suggestions, .modal'));
}

function isStationSearchFocused() {
  const active = document.activeElement;
  return !!(active && active.id === 'lineStationSearch');
}

function stationSearchDisplayValue(selected) {
  if (isStationSearchFocused()) return $('#lineStationSearch')?.value || app.stationSearch.query || '';
  if (app.stationSearch.query && app.stationSearch.candidateId && app.stationSearch.candidateId === app.selectedStation) return app.stationSearch.query;
  return stationSearchLabel(selected);
}

function refreshStationSearchWidgets() {
  if (!$('#lineStationSearch')) return;
  const selected = station(app.selectedStation);
  const input = $('#lineStationSearch');
  const hidden = $('#lineStation');
  if (input && document.activeElement !== input) input.value = stationSearchDisplayValue(selected) || '';
  if (hidden) hidden.value = app.stationSearch.candidateId || app.selectedStation || '';
  if (input && document.activeElement !== input) {
    const box = $('#lineStationSuggestions');
    if (box) box.innerHTML = '';
  }
}

function isLineFormFocused() {
  const active = document.activeElement;
  return !!(active && $('#lineForm')?.contains(active));
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}


function hasTech(nodeId, level = 1) {
  return techLevel(nodeId) >= level;
}

function techNodeTitle(nodeId) {
  const node = techNodeById(nodeId);
  return node ? node.title : nodeId;
}

function techNodeById(nodeId) {
  const tree = app.state?.balance?.techTree || {};
  for (const group of Object.values(tree)) {
    const found = (group.nodes || []).find(n => n.id === nodeId);
    if (found) return found;
  }
  return null;
}

function researchPrereqLabel(node, targetLevel) {
  const prereqs = researchPrereqsForLevelClient(node, targetLevel);
  return prereqs.length ? prereqs.map(researchPrereqLabelClient).join(', ') : 'Aucun';
}

function researchEpochPrereqPill(node) {
  const requiredEpoch = Math.max(0, Number(node.requiredEpoch || 0));
  const epoch = app.state.balance.epochs?.[requiredEpoch];
  const ok = (app.state.me?.epoch || 0) >= requiredEpoch;
  const label = epoch?.name || `Époque ${requiredEpoch + 1}`;
  return `<span class="research-prereq ${ok ? 'met' : 'missing'}">Époque : ${escapeHtml(label)}</span>`;
}

function techLockedReason(node, targetLevel = 1) {
  const me = app.state.me;
  if (me.epoch < (node.requiredEpoch || 0)) return `Époque requise : ${app.state.balance.epochs[node.requiredEpoch]?.name || node.requiredEpoch + 1}.`;
  const missing = researchPrereqsForLevelClient(node, targetLevel).filter(req => !researchPrereqSatisfiedClient(req));
  if (missing.length) return `Prérequis : ${missing.map(researchPrereqLabelClient).join(', ')}.`;
  return '';
}

function trainModelUnlocked(model) {
  return !trainModelLockedReason(model);
}

function trainModelLockedReason(model) {
  const me = app.state.me;
  if (model.unlockEpoch > me.epoch) return app.state.balance.epochs[model.unlockEpoch]?.name || `Époque ${model.unlockEpoch + 1}`;
  const requiredTechLevel = trainModelRequiredTechLevel(model);
  if (model.requiredTech && !hasTech(model.requiredTech, requiredTechLevel)) return `${techNodeTitle(model.requiredTech)} niv. ${requiredTechLevel}`;
  return '';
}

function trainConstructionDurationMsClient(model) {
  const maxEpoch = Math.max(1, (app.state?.balance?.epochs?.length || 7) - 1);
  const era = clamp(Math.floor(Number(model?.unlockEpoch || 0)), 0, maxEpoch);
  const techRank = clamp((Math.max(1, Number(model?.requiredTechLevel || 1)) - 1) / 7, 0, 1);
  const price = Math.max(95000, Number(model?.price || 95000));
  const priceRank = clamp((Math.log10(price) - Math.log10(95000)) / (Math.log10(92000000) - Math.log10(95000)), 0, 1);
  const inEraRank = clamp(techRank * 0.7 + priceRank * 0.3, 0, 1);
  const globalRank = clamp((era + inEraRank) / (maxEpoch + 1), 0, 1);
  const minMs = 60 * 1000;
  const maxMs = 20 * 60 * 60 * 1000;
  return Math.round(minMs + Math.pow(globalRank, 1.55) * (maxMs - minMs));
}

function maintenanceActionLockedReason(action) {
  if (action.requiredTech && !hasTech(action.requiredTech)) return `Recherche : ${techNodeTitle(action.requiredTech)}`;
  if (action.facility && maintenanceFacilityLevelClient(action.facility) <= 0) {
    return maintenanceFacilityUnderConstructionClient(action.facility)
      ? `${maintenanceFacilityNameClient(action.facility)} en construction`
      : `${maintenanceFacilityNameClient(action.facility)} requis`;
  }
  return '';
}

function maintenanceFacilityLevelClient(facilityId) {
  const raw = app.state?.me?.maintenanceFacilities?.[facilityId];
  return Math.max(0, Math.floor(Number(raw?.level ?? raw ?? 0)));
}

function maintenanceFacilityConstructionClient(facilityId) {
  const raw = app.state?.me?.maintenanceFacilities?.[facilityId];
  const construction = raw?.construction || {};
  const durationMs = Math.max(0, Number(construction.durationMs || 0));
  const remainingMs = Math.max(0, Number(construction.remainingMs ?? (construction.active ? durationMs : 0)));
  const progress = durationMs > 0 ? clamp(1 - remainingMs / durationMs, 0, 1) : (construction.active ? 0 : 1);
  return {
    active: Boolean(construction.active) && remainingMs > 0,
    targetLevel: Math.max(0, Math.floor(Number(construction.targetLevel || maintenanceFacilityLevelClient(facilityId) + 1))),
    durationMs,
    remainingMs,
    endAt: serverNow() + remainingMs,
    progress,
    percent: Math.round(progress * 100),
    startedAt: construction.startedAt || 0
  };
}

function maintenanceFacilityUnderConstructionClient(facilityId) {
  return maintenanceFacilityConstructionClient(facilityId).active;
}

function maintenanceFacilityNameClient(facilityId) {
  return app.state?.balance?.maintenanceFacilities?.[facilityId]?.name || 'Bâtiment';
}

function maintenanceFacilityUpgradeCostClient(facilityId) {
  const facility = app.state?.balance?.maintenanceFacilities?.[facilityId];
  if (!facility) return 0;
  const level = maintenanceFacilityLevelClient(facilityId);
  return Math.round(Number(facility.baseCost || 0) * Math.pow(Number(facility.growth || 1.25), level));
}

function maintenanceFacilityConstructionDurationMsClient(facilityId) {
  const facility = app.state?.balance?.maintenanceFacilities?.[facilityId];
  if (!facility) return 0;
  const level = maintenanceFacilityLevelClient(facilityId);
  const baseMs = Math.max(0, Number(facility.baseConstructionMs || 0));
  const growth = Math.max(1, Number(facility.constructionGrowth || facility.growth || 1.25));
  return Math.round(baseMs * Math.pow(growth, level));
}

function maintenanceFacilityDurationMultiplierClient(facilityId) {
  const facility = app.state?.balance?.maintenanceFacilities?.[facilityId];
  if (!facility) return 1;
  const level = maintenanceFacilityLevelClient(facilityId);
  const reduction = Math.min(Number(facility.maxDurationReduction || 0), level * Number(facility.durationReductionPerLevel || 0));
  return clamp(1 - reduction, 0.18, 1);
}

function totalMaintenanceFacilityScoreClient() {
  return maintenanceFacilityLevelClient('depot') * 0.45
    + maintenanceFacilityLevelClient('workshop')
    + maintenanceFacilityLevelClient('technicentre') * 1.35;
}

function maintenanceDurationMsClient(train, model, action) {
  const condition = clamp(Number(train?.condition ?? 1), 0, 1);
  const durabilityFactor = 0.35 + (1 - condition) * 1.65;
  const facilityMultiplier = maintenanceFacilityDurationMultiplierClient(action.facility);
  const mechanicBonus = Math.min(0.16, Number(app.state?.me?.staff?.mechanics || 0) * 0.006);
  const branchBonus = Math.min(0.18, Number(app.state?.me?.tech?.maintenance || 0) * 0.004);
  const techBonus = branchBonus + Math.min(0.24, techLevel('steam_workshops') * 0.045) + Math.min(0.1, techLevel('electric_standardized_maintenance') * 0.02);
  const skillMultiplier = clamp(1 - mechanicBonus - techBonus, 0.42, 1);
  const baseMinutes = Math.max(1, Number(action.baseMinutes || action.days * 12 || 15));
  return Math.max(60000, Math.ceil(baseMinutes * 60000 * durabilityFactor * facilityMultiplier * skillMultiplier));
}

function maintenancePreview(train, model, action) {
  const missing = Math.max(0.02, 1 - train.condition);
  const workshopDiscount = Math.min(0.18, totalMaintenanceFacilityScoreClient() * 0.025);
  const branchDiscount = 1 - Math.min(0.24, Number(app.state?.me?.tech?.maintenance || 0) * 0.006);
  const techDiscount = branchDiscount * (hasTech('steam_workshops') ? 0.92 : 1) * (hasTech('electric_standardized_maintenance') ? 0.94 : 1);
  const cost = Math.round((action.baseCost + model.price * action.priceFactor * missing) * (1 - workshopDiscount) * techDiscount);
  const durationMs = maintenanceDurationMsClient(train, model, action);
  const target = Math.round(Math.max(train.condition, Math.min(action.target || 0.99, train.condition + action.restore)) * 100);
  const condition = Math.round(clamp(Number(train?.condition || 0), 0, 1) * 100);
  return `${money(cost)} · ${formatDurationMs(durationMs)} · état ${condition}% → ${target}%`;
}


function updateLinePreview(sourceId = '') {
  updateLineDistanceCalculator();
  const box = $('#linePreview');
  if (!box || !app.state?.me) return;
  const stops = buildLineDraftStops();
  const trainId = $('#lineTrain')?.value;
  const service = $('#lineService')?.value || app.lineDraft.service || 'passengers';
  const train = app.state.me.trains.find(t => t.id === trainId);
  const model = train ? app.state.balance.trains[train.modelId] : null;
  const button = $('#createLineBtn');

  if (stops.length < 2 || !model) {
    box.className = 'line-preview muted small';
    box.textContent = 'Choisis au moins un départ, une arrivée et un train.';
    if (button) button.disabled = !model;
    return;
  }
  if (train.construction?.active) {
    box.className = 'line-preview bad small';
    box.textContent = `Train indisponible : fabrication en cours, ${formatResearchTime(train.construction.remainingMs || train.construction.durationMs || 0)} restantes.`;
    if (button) button.disabled = true;
    return;
  }
  if (train.maintenance?.active) {
    box.className = 'line-preview bad small';
    box.textContent = `Train indisponible : Maintenance en cours, ${formatDurationMs(train.maintenance.remainingMs || train.maintenance.daysLeft * Math.max(250, Number(app.state?.game?.tickMs || 2000)))} restantes.`;
    if (button) button.disabled = true;
    return;
  }
  if (new Set(stops).size !== stops.length) {
    box.className = 'line-preview bad small';
    box.textContent = 'La ligne contient un arrêt en doublon. Chaque arrêt ne doit apparaître qu’une seule fois.';
    if (button) button.disabled = true;
    return;
  }
  const serviceStopProblem = validateLineStopServiceClient(stops, service);
  if (serviceStopProblem) {
    box.className = 'line-preview bad small';
    box.textContent = serviceStopProblem;
    if (button) button.disabled = true;
    return;
  }

  const route = getRouteForStops(stops, { profile: routeProfileForDraftClient() });
  if (!route.distance) {
    box.className = 'line-preview bad small';
    box.textContent = route.pending
      ? 'Calcul de l’itinéraire RFN en cours. Patiente quelques secondes avant validation.'
      : 'Aucun itinéraire réel trouvé dans le RFN pour cette suite de gares.';
    if (button) button.disabled = true;
    return;
  }
  const ticketPrice = syncLineDraftTicket(route.distance);
  refreshLineTicketInput(route.distance, ticketPrice, sourceId);

  const ownershipProblem = lineOwnershipProblemClient(stops);
  if (ownershipProblem) {
    box.className = 'line-preview bad small';
    box.textContent = ownershipProblem;
    if (button) button.disabled = true;
    return;
  }
  const routeText = stops.map(id => station(id)?.name || id).join(' → ');
  const rightsText = lineExternalRightsLabel(stops);
  const base = `Distance réseau : ${formatInt(route.distance)} km · Billet moyen : ${money(ticketPrice)} · Tronçon le plus long : ${formatInt(route.maxSegment)} km · ${stops.length} arrêt(s).${rightsText ? ` ${rightsText}` : ' Gares libres utilisables sans achat préalable.'}`;
  const effective = effectiveTrainRangeClient(train, model);
  const ok = route.distance <= effective;
  const detail = ok
    ? ` Compatible : Portée ${formatInt(effective)} km. Itinéraire : ${routeText}.`
    : ` Incompatible : Portée ${formatInt(effective)} km. La distance totale de ligne dépasse la portée du matériel. Itinéraire : ${routeText}.`;

  box.className = `line-preview ${ok ? 'good' : 'bad'} small`;
  box.textContent = base + detail;
  if (button) button.disabled = !ok;
  drawMap();
}

function effectiveTrainRangeClient(train, model) {
  const profileRange = Number(train?.profile?.range);
  if (Number.isFinite(profileRange) && profileRange > 0) return Math.round(profileRange);
  return trainEffectiveCatalogRange(model);
}

function toast(message, type = 'ok') {
  const host = $('#toastHost');
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.textContent = message;
  host.appendChild(div);
  setTimeout(() => div.remove(), 4200);
}

function formatInt(value) {
  return Math.round(Number(value || 0)).toLocaleString('fr-FR');
}

function money(value) {
  return `${formatInt(value)} €`;
}

function ticksPerRealHour() {
  return 3600000 / Math.max(250, Number(app.state?.game?.tickMs || 4500));
}

function moneyPerHour(value) {
  return `${money(Number(value || 0) * ticksPerRealHour())}/h`;
}

function topResultTooltip(me) {
  const b = me.stats?.lastBreakdown || {};
  const revenues = Number(b.lineRevenue || me.stats.lastRevenue || 0) + Number(b.stationRevenue || 0);
  const expenses = Number(b.variableLineCost || 0) + Number(b.sharedCosts || 0);
  return [
    'Projection moyenne : capacité, vitesse et trains en circulation.',
    'Les encaissements réels interviennent uniquement aux gares desservies.',
    '---------------------------------------------',
    `Revenus totaux : ${moneyPerHour(revenues)}`,
    `Dépenses totales : ${moneyPerHour(expenses)}`,
    `Résultat net : ${moneyPerHour(me.stats.lastProfit)}`,
    '---------------------------------------------',
    `Revenus des lignes : ${moneyPerHour(b.lineRevenue || me.stats.lastRevenue)}`,
    `Revenus des gares : ${moneyPerHour(b.stationRevenue || 0)}`,
    `Dépenses variables : ${moneyPerHour(b.variableLineCost || 0)}`,
    `Charges fixes : ${moneyPerHour(b.sharedCosts || 0)}`
  ].join('\n');
}

function resourceTopTooltip(type) {
  const flow = app.state?.me?.resourceFlow || {};
  const sources = flow.sources?.[type] || [];
  const consumption = Number(flow.consumption?.[type] || 0);
  const production = type === 'electricity' ? Number(flow.production?.electricity || 0) : 0;
  const stock = Number(flow.stocks?.[type] || 0);
  const label = { coal: 'Charbon', diesel: 'Diesel', electricity: 'Électricité' }[type] || type;
  const unit = type === 'electricity' ? 'MW/h' : 'u/h';
  const stockLine = type === 'electricity'
    ? `Commande producteur : ${round(production)} MW/h`
    : `Stock disponible : ${round(stock)} u`;
  const lines = [
    label,
    stockLine,
    resourceZeroTooltipLine(type),
    `Consommation totale : ${round(consumption)} ${unit}`,
    `Production totale : ${round(production)} ${unit}`,
    '---------------------------------------------',
    ...(sources.length
      ? sources.slice(0, 10).map(s => `Consommation train ${s.lineName || s.lineCode || 'Ligne'} · ${s.trainName || 'Train'} : ${round(s.amountPerHour)} ${unit}`)
      : ['Aucune consommation active'])
  ];
  return lines.join('\n');
}

function resourceStockLabel(type) {
  const me = app.state?.me;
  const flow = me?.resourceFlow || {};
  if (type === 'electricity') return `${round(flow.consumption?.electricity || 0)}/${round(flow.production?.electricity || 0)} MW/h`;
  return `${round(me?.resources?.[type] || 0)} u`;
}

function maintenanceHourlyRange(model, distance = 100, frequency = 1, condition = null) {
  const base = Number(model?.maintenance || 0) * Math.max(1, Number(distance || 100)) * Math.max(1, Number(frequency || 1)) * MAINTENANCE_COST_MULTIPLIER_CLIENT;
  const toHourly = value => money(value * ticksPerRealHour());
  const min = base;
  const max = base * 2.5;
  if (Number.isFinite(condition)) {
    const current = base * (1 + (1 - Math.max(0, Math.min(1, condition))) * 1.5);
    return `${toHourly(current)}/h actuel · ${toHourly(min)}–${toHourly(max)}/h`;
  }
  return `${toHourly(min)}–${toHourly(max)}/h`;
}

function staffSalaryPerHour(def, count = 1) {
  return moneyPerHour((Number(def?.salary || 0) * Number(count || 1)) / STAFF_COST_DIVISOR_CLIENT);
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function hexToRgba(hex, alpha = 1) {
  const raw = String(hex || '').replace('#', '').trim();
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  const value = /^[0-9a-f]{6}$/i.test(full) ? full : 'd9a852';
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(Number(alpha), 0, 1)})`;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}


function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
