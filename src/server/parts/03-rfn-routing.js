// Moteur RFN, cache, workers et calculs de géométrie ferroviaire.
let sncfRailLinesCache = null;
let sncfRailLinesLoadedAt = 0;
let sncfRailLineSpatialIndex = null;
let sncfPersistentRouteCacheLoaded = false;
let sncfPersistentRouteCacheSaveTimer = null;
const sncfRouteGeometryResultCache = new Map();
const sncfRouteGeometrySequenceResultCache = new Map();

function normalizeRailRouteProfile(profile) {
  const value = String(profile || '').trim().toLowerCase();
  if (['highspeed', 'classic'].includes(value)) return value;
  return 'default';
}

function sncfRouteCacheKey(a, b, profile = 'default') {
  return `${normalizeRailRouteProfile(profile)}::${currentStationId(a)}::${currentStationId(b)}`;
}

function sncfRouteSequenceCacheKey(ids, profile = 'default') {
  return `${normalizeRailRouteProfile(profile)}::${(ids || []).map(currentStationId).filter(Boolean).join('>')}`;
}

function ensureSncfPersistentRouteCacheLoaded() {
  if (sncfPersistentRouteCacheLoaded) return;
  sncfPersistentRouteCacheLoaded = true;
  try {
    if (!fs.existsSync(SNCF_RFN_ROUTE_CACHE_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(SNCF_RFN_ROUTE_CACHE_FILE, 'utf8'));
    if (parsed?.version !== SNCF_RFN_ROUTE_CACHE_VERSION) return;
    const routes = Array.isArray(parsed.routes) ? parsed.routes : [];
    const sequences = Array.isArray(parsed.sequences) ? parsed.sequences : [];
    for (const entry of routes) {
      const key = Array.isArray(entry) ? entry[0] : entry?.key;
      const geometry = Array.isArray(entry) ? entry[1] : entry?.geometry;
      if (typeof key === 'string' && Array.isArray(geometry) && geometry.length >= 2) {
        sncfRouteGeometryResultCache.set(key, simplifyGeoPolyline(geometry));
      }
      if (sncfRouteGeometryResultCache.size >= SNCF_ROUTE_GEOMETRY_CACHE_MAX) break;
    }
    for (const entry of sequences) {
      const key = Array.isArray(entry) ? entry[0] : entry?.key;
      const route = Array.isArray(entry) ? entry[1] : entry?.route;
      if (typeof key === 'string' && route && Array.isArray(route.geometry) && route.geometry.length >= 2) {
        sncfRouteGeometrySequenceResultCache.set(key, {
          ids: Array.isArray(route.ids) ? route.ids : [],
          geometry: simplifyGeoPolyline(route.geometry),
          chunks: Array.isArray(route.chunks) ? route.chunks : []
        });
      }
      if (sncfRouteGeometrySequenceResultCache.size >= SNCF_ROUTE_GEOMETRY_CACHE_MAX) break;
    }
  } catch (error) {
    console.warn('Cache itinéraires RFN illisible:', error.message);
  }
}

function scheduleSncfPersistentRouteCacheSave() {
  if (!isMainThread) return;
  if (sncfPersistentRouteCacheSaveTimer) return;
  sncfPersistentRouteCacheSaveTimer = setTimeout(() => {
    sncfPersistentRouteCacheSaveTimer = null;
    try {
      const payload = {
        version: SNCF_RFN_ROUTE_CACHE_VERSION,
        savedAt: Date.now(),
        routes: [...sncfRouteGeometryResultCache.entries()].slice(-SNCF_ROUTE_GEOMETRY_CACHE_MAX),
        sequences: [...sncfRouteGeometrySequenceResultCache.entries()].slice(-SNCF_ROUTE_GEOMETRY_CACHE_MAX)
      };
      fs.writeFileSync(SNCF_RFN_ROUTE_CACHE_FILE, JSON.stringify(payload));
    } catch (error) {
      console.warn('Cache itinéraires RFN non écrit:', error.message);
    }
  }, 900);
  if (typeof sncfPersistentRouteCacheSaveTimer.unref === 'function') sncfPersistentRouteCacheSaveTimer.unref();
}

function rememberSncfRouteGeometrySequence(key, route) {
  ensureSncfPersistentRouteCacheLoaded();
  if (sncfRouteGeometrySequenceResultCache.has(key)) sncfRouteGeometrySequenceResultCache.delete(key);
  const normalized = {
    ids: Array.isArray(route?.ids) ? route.ids : [],
    geometry: simplifyGeoPolyline(Array.isArray(route?.geometry) ? route.geometry : []),
    chunks: Array.isArray(route?.chunks) ? route.chunks : []
  };
  sncfRouteGeometrySequenceResultCache.set(key, normalized);
  while (sncfRouteGeometrySequenceResultCache.size > SNCF_ROUTE_GEOMETRY_CACHE_MAX) {
    const oldest = sncfRouteGeometrySequenceResultCache.keys().next().value;
    sncfRouteGeometrySequenceResultCache.delete(oldest);
  }
  scheduleSncfPersistentRouteCacheSave();
  return normalized;
}

function rememberSncfRouteGeometry(key, geometry) {
  ensureSncfPersistentRouteCacheLoaded();
  if (sncfRouteGeometryResultCache.has(key)) sncfRouteGeometryResultCache.delete(key);
  sncfRouteGeometryResultCache.set(key, simplifyGeoPolyline(Array.isArray(geometry) ? geometry : []));
  while (sncfRouteGeometryResultCache.size > SNCF_ROUTE_GEOMETRY_CACHE_MAX) {
    const oldest = sncfRouteGeometryResultCache.keys().next().value;
    sncfRouteGeometryResultCache.delete(oldest);
  }
  scheduleSncfPersistentRouteCacheSave();
  return sncfRouteGeometryResultCache.get(key);
}

class SncfRouteWorkerPool {
  constructor(size = 1) {
    this.size = Math.max(1, Math.round(size || 1));
    this.workers = [];
    this.queue = [];
    this.nextId = 1;
    for (let i = 0; i < this.size; i += 1) this.workers.push(this.createWorker(i));
  }

  createWorker(index) {
    const worker = new Worker(__filename, {
      workerData: { role: 'rfn-route-worker', index },
      env: { ...process.env, SILLONS_RFN_WORKERS: '0' }
    });
    const slot = { worker, busy: false, current: null, index };
    worker.on('message', message => this.handleMessage(slot, message));
    worker.on('error', error => this.handleFailure(slot, error));
    worker.on('exit', code => {
      if (slot.current) this.handleFailure(slot, new Error(`Worker RFN interrompu (${code}).`));
      const pos = this.workers.indexOf(slot);
      if (pos >= 0 && isMainThread) this.workers[pos] = this.createWorker(index);
      this.pump();
    });
    return slot;
  }

  handleMessage(slot, message = {}) {
    const current = slot.current;
    if (!current || message.id !== current.id) return;
    clearTimeout(current.timer);
    slot.busy = false;
    slot.current = null;
    if (message.ok) current.resolve(message.result);
    else current.reject(new Error(message.error || 'Calcul RFN worker échoué.'));
    this.pump();
  }

  handleFailure(slot, error) {
    const current = slot.current;
    if (current) {
      clearTimeout(current.timer);
      current.reject(error);
    }
    slot.busy = false;
    slot.current = null;
    try { slot.worker.terminate(); } catch {}
    this.pump();
  }

  run(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, task, resolve, reject, timer: null });
      this.pump();
    });
  }

  pump() {
    for (const slot of this.workers) {
      if (slot.busy) continue;
      const job = this.queue.shift();
      if (!job) return;
      slot.busy = true;
      slot.current = job;
      job.timer = setTimeout(() => {
        this.handleFailure(slot, new Error('Timeout calcul RFN worker.'));
      }, SNCF_ROUTE_WORKER_TIMEOUT_MS);
      if (typeof job.timer.unref === 'function') job.timer.unref();
      slot.worker.postMessage({ id: job.id, task: job.task });
    }
  }
}

let sncfRouteWorkerPool = null;
let sncfRouteWorkerFailureLogged = false;

function getSncfRouteWorkerPool() {
  if (!isMainThread || SNCF_ROUTE_WORKER_POOL_SIZE <= 0) return null;
  if (!sncfRouteWorkerPool) sncfRouteWorkerPool = new SncfRouteWorkerPool(SNCF_ROUTE_WORKER_POOL_SIZE);
  return sncfRouteWorkerPool;
}

async function runSncfRouteWorkerTask(task) {
  const pool = getSncfRouteWorkerPool();
  if (!pool) return null;
  try {
    return await pool.run(task);
  } catch (error) {
    if (!sncfRouteWorkerFailureLogged) {
      sncfRouteWorkerFailureLogged = true;
      console.warn('Workers RFN indisponibles, fallback mono-thread :', error.message);
    }
    return null;
  }
}

async function sncfRouteGeometryForStationsFast(fromKey, toKey, options = {}) {
  const profile = normalizeRailRouteProfile(options.profile || 'default');
  const cacheKey = sncfRouteCacheKey(fromKey, toKey, profile);
  ensureSncfPersistentRouteCacheLoaded();
  if (sncfRouteGeometryResultCache.has(cacheKey)) return sncfRouteGeometryResultCache.get(cacheKey);
  const workerResult = await runSncfRouteWorkerTask({ kind: 'pair', from: fromKey, to: toKey, profile, options });
  if (Array.isArray(workerResult?.geometry) && workerResult.geometry.length >= 2) {
    return rememberSncfRouteGeometry(cacheKey, workerResult.geometry);
  }
  return sncfRouteGeometryForStations(fromKey, toKey, options);
}

async function sncfRouteGeometryForStopSequenceFast(stops, options = {}) {
  const profile = normalizeRailRouteProfile(options.profile || 'default');
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.length < 2) return { ids, geometry: [], chunks: [] };
  const cacheKey = sncfRouteSequenceCacheKey(ids, profile);
  ensureSncfPersistentRouteCacheLoaded();
  if (sncfRouteGeometrySequenceResultCache.has(cacheKey)) return sncfRouteGeometrySequenceResultCache.get(cacheKey);
  const workerResult = await runSncfRouteWorkerTask({ kind: 'sequence', stops: ids, profile, options });
  if (Array.isArray(workerResult?.geometry) && workerResult.geometry.length >= 2) {
    return rememberSncfRouteGeometrySequence(cacheKey, {
      ids: Array.isArray(workerResult.ids) ? workerResult.ids : ids,
      geometry: workerResult.geometry,
      chunks: Array.isArray(workerResult.chunks) ? workerResult.chunks : []
    });
  }
  return sncfRouteGeometryForStopSequence(ids, options);
}

async function handleSncfRouteWorkerMessage(message = {}) {
  const { id, task = {} } = message;
  const started = Date.now();
  try {
    let result = null;
    const profile = normalizeRailRouteProfile(task.profile || 'default');
    if (task.kind === 'sequence') {
      const route = await sncfRouteGeometryForStopSequence(task.stops || [], { ...(task.options || {}), profile });
      result = {
        ids: route.ids || task.stops || [],
        geometry: route.geometry || [],
        chunks: route.chunks || [],
        durationMs: Date.now() - started
      };
    } else if (task.kind === 'pair') {
      const geometry = await sncfRouteGeometryForStations(task.from, task.to, { ...(task.options || {}), profile });
      result = { geometry: geometry || [], durationMs: Date.now() - started };
    } else {
      throw new Error('Type de tâche RFN inconnu.');
    }
    parentPort.postMessage({ id, ok: true, result });
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: error.message || String(error) });
  }
}

if (!isMainThread && workerData?.role === 'rfn-route-worker' && parentPort) {
  parentPort.on('message', message => handleSncfRouteWorkerMessage(message));
}

function collectExistingLineRouteCacheJobs() {
  const jobs = [];
  const seen = new Set();
  for (const player of Object.values(state.players || {})) {
    for (const line of player?.lines || []) {
      const ids = lineStops(line);
      if (ids.length < 2) continue;
      const profile = routeProfileForLine(player, line);
      const key = sncfRouteSequenceCacheKey(ids, profile);
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push({ key, ids, profile, lineId: line.id, playerId: player.id, name: line.name || ids.join(' → ') });
    }
  }
  return jobs;
}

async function prewarmExistingLineRouteGeometryCache() {
  if (!isMainThread) return;
  const allJobs = collectExistingLineRouteCacheJobs();
  ensureSncfPersistentRouteCacheLoaded();
  const jobs = allJobs.filter(job => !sncfRouteGeometrySequenceResultCache.has(job.key));
  if (!allJobs.length) return;
  if (!jobs.length) {
    console.log(`Cache RFN lignes prêt : ${allJobs.length}/${allJobs.length} tracé(s) déjà en cache.`);
    return;
  }
  const started = Date.now();
  let done = 0;
  let failed = 0;
  console.log(`Pré-calcul RFN lignes : ${jobs.length}/${allJobs.length} tracé(s) à générer avec ${SNCF_ROUTE_WORKER_POOL_SIZE} worker(s).`);
  const concurrency = Math.max(1, SNCF_ROUTE_WORKER_POOL_SIZE);
  let cursor = 0;
  async function next() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      try {
        const route = await sncfRouteGeometryForStopSequenceFast(job.ids, { profile: job.profile });
        if (Array.isArray(route?.geometry) && route.geometry.length >= 2) done += 1;
        else failed += 1;
      } catch (error) {
        failed += 1;
        console.warn(`Pré-calcul RFN échoué (${job.name}) :`, error.message);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
  scheduleSncfPersistentRouteCacheSave();
  console.log(`Pré-calcul RFN lignes terminé : ${done} ok, ${failed} échec(s), ${(Date.now() - started) / 1000}s.`);
}

function geoPointDistanceToSegment(point, a, b) {
  const lon = Number(point?.[0]);
  const lat = Number(point?.[1]);
  const lonA = Number(a?.[0]);
  const latA = Number(a?.[1]);
  const lonB = Number(b?.[0]);
  const latB = Number(b?.[1]);
  if (![lon, lat, lonA, latA, lonB, latB].every(Number.isFinite)) return 0;
  const scale = Math.cos(((latA + latB) / 2) * Math.PI / 180) || 1;
  const x = lon * scale;
  const y = lat;
  const ax = lonA * scale;
  const ay = latA;
  const bx = lonB * scale;
  const by = latB;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0) return Math.hypot(x - ax, y - ay);
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / lenSq, 0, 1);
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
}

function rdpGeoPolyline(points, epsilon) {
  if (!Array.isArray(points) || points.length <= 2) return points || [];
  let bestIndex = -1;
  let bestDistance = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = geoPointDistanceToSegment(points[i], first, last);
    if (distance > bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  if (bestDistance <= epsilon || bestIndex < 0) return [first, last];
  const left = rdpGeoPolyline(points.slice(0, bestIndex + 1), epsilon);
  const right = rdpGeoPolyline(points.slice(bestIndex), epsilon);
  return left.slice(0, -1).concat(right);
}

function decimateGeoPolyline(points, maxPoints) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points || [];
  const out = [points[0]];
  const step = (points.length - 2) / Math.max(1, maxPoints - 2);
  for (let i = 1; i < maxPoints - 1; i += 1) {
    out.push(points[Math.max(1, Math.min(points.length - 2, Math.round(i * step)))]);
  }
  out.push(points[points.length - 1]);
  return out;
}

function simplifyGeoPolyline(points, maxPoints = 900) {
  const clean = [];
  for (const point of points || []) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const lon = Number(point[0]);
    const lat = Number(point[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const previous = clean[clean.length - 1];
    if (previous && Math.abs(previous[0] - lon) < 0.000001 && Math.abs(previous[1] - lat) < 0.000001) continue;
    clean.push([roundCoord(lon), roundCoord(lat)]);
  }
  if (clean.length <= maxPoints) return clean;
  const working = clean.length > 6000 ? decimateGeoPolyline(clean, 3000) : clean;
  let epsilon = 0.00003;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const simplified = rdpGeoPolyline(working, epsilon);
    if (simplified.length <= maxPoints) return simplified;
    epsilon *= 1.8;
  }
  return decimateGeoPolyline(working, maxPoints);
}

async function loadSncfRailShapeLines() {
  if (sncfRailLinesCache?.length) return sncfRailLinesCache;
  try {
    if (fs.existsSync(SNCF_RFN_CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SNCF_RFN_CACHE_FILE, 'utf8'));
      if (Array.isArray(parsed.lines) && parsed.lines.length) {
        sncfRailLinesCache = parsed.lines
          .filter(line => Array.isArray(line?.coords) && line.coords.length >= 2)
          .map(line => ({ ...line, bounds: line.bounds || geoLineBounds(line.coords) }));
        sncfRailLineSpatialIndex = buildSncfRailLineSpatialIndex(sncfRailLinesCache);
        sncfRailLinesLoadedAt = Number(parsed.updatedAt || Date.now());
        return sncfRailLinesCache;
      }
    }
  } catch (error) {
    console.warn('Cache RFN SNCF illisible:', error.message);
  }

  const geojson = await fetchJsonWithTimeout(SNCF_RFN_GEOJSON_URL, 120000);
  const lines = extractGeoJsonRailLines(geojson)
    .filter(line => line.coords.length >= 2)
    .map(line => ({ ...line, bounds: geoLineBounds(line.coords) }));
  if (!lines.length) throw new Error('Aucune géométrie RFN exploitable.');
  sncfRailLinesCache = lines;
  sncfRailLineSpatialIndex = buildSncfRailLineSpatialIndex(sncfRailLinesCache);
  sncfRailLinesLoadedAt = Date.now();
  try {
    fs.writeFileSync(SNCF_RFN_CACHE_FILE, JSON.stringify({ updatedAt: sncfRailLinesLoadedAt, source: 'formes-des-lignes-du-rfn', lines }, null, 0));
  } catch (error) {
    console.warn('Cache RFN SNCF non écrit:', error.message);
  }
  return sncfRailLinesCache;
}

function extractGeoJsonRailLines(geojson) {
  const features = Array.isArray(geojson?.features) ? geojson.features : Array.isArray(geojson) ? geojson : [];
  const lines = [];
  for (const feature of features) {
    const geometry = feature?.geometry || feature?.geo_shape || feature;
    const properties = feature?.properties || feature?.fields || feature || {};
    const status = String(properties.mnemo || properties.MNEMO || properties.statut || properties.status || '').toUpperCase();
    const rejected = /FERM|DÉPOS|DEPOS|HORS|ABANDON|NON\s*EXPLOIT/.test(status);
    for (const coords of geometryToLineStrings(geometry)) {
      const clean = coords
        .map(pair => [Number(pair[0]), Number(pair[1])])
        .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && isInFranceBounds(lat, lon));
      if (clean.length >= 2 && !rejected) lines.push({
        coords: clean,
        status,
        codeLigne: String(properties.code_ligne || properties.codeLigne || properties.code || properties.CODE_LIGNE || properties.mnemo_ligne || '').trim(),
        libelle: String(properties.libelle || properties.Libelle || properties.nom || properties.nom_ligne || '').trim()
      });
    }
  }
  return lines;
}

function geometryToLineStrings(geometry) {
  if (!geometry || typeof geometry !== 'object') return [];
  const type = geometry.type;
  const coords = geometry.coordinates;
  if (type === 'LineString' && Array.isArray(coords)) return [coords];
  if (type === 'MultiLineString' && Array.isArray(coords)) return coords;
  if (type === 'Feature') return geometryToLineStrings(geometry.geometry);
  if (type === 'GeometryCollection' && Array.isArray(geometry.geometries)) return geometry.geometries.flatMap(geometryToLineStrings);
  return [];
}

function geoLineBounds(coords) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coords || []) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

function boundsIntersects(a, b) {
  return a.minLon <= b.maxLon && a.maxLon >= b.minLon && a.minLat <= b.maxLat && a.maxLat >= b.minLat;
}

function buildSncfRailLineSpatialIndex(lines) {
  const cells = new Map();
  const cellSize = SNCF_RFN_SPATIAL_CELL_DEG;
  const cellKey = (ix, iy) => `${ix}:${iy}`;
  for (let index = 0; index < (lines || []).length; index += 1) {
    const bounds = lines[index]?.bounds;
    if (!bounds) continue;
    const minX = Math.floor(bounds.minLon / cellSize);
    const maxX = Math.floor(bounds.maxLon / cellSize);
    const minY = Math.floor(bounds.minLat / cellSize);
    const maxY = Math.floor(bounds.maxLat / cellSize);
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const key = cellKey(x, y);
        const bucket = cells.get(key) || [];
        bucket.push(index);
        cells.set(key, bucket);
      }
    }
  }
  return { cellSize, cells };
}

function sncfRailLinesInBounds(lines, bbox) {
  const source = Array.isArray(lines) ? lines : [];
  if (!bbox || !sncfRailLineSpatialIndex?.cells?.size) return source.filter(line => boundsIntersects(line.bounds, bbox));
  const { cellSize, cells } = sncfRailLineSpatialIndex;
  const seen = new Set();
  const out = [];
  const minX = Math.floor(bbox.minLon / cellSize);
  const maxX = Math.floor(bbox.maxLon / cellSize);
  const minY = Math.floor(bbox.minLat / cellSize);
  const maxY = Math.floor(bbox.maxLat / cellSize);
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const bucket = cells.get(`${x}:${y}`);
      if (!bucket?.length) continue;
      for (const index of bucket) {
        if (seen.has(index)) continue;
        seen.add(index);
        const line = source[index];
        if (line?.bounds && boundsIntersects(line.bounds, bbox)) out.push(line);
      }
    }
  }
  return out;
}

function rfnCoordKey(lon, lat) {
  return `${Number(lon).toFixed(4)},${Number(lat).toFixed(4)}`;
}

function buildRfnGraphComponents(graph) {
  const componentByNode = new Map();
  const sizes = [];
  for (const node of graph.keys()) {
    if (componentByNode.has(node)) continue;
    const componentId = sizes.length;
    let size = 0;
    const stack = [node];
    componentByNode.set(node, componentId);
    while (stack.length) {
      const current = stack.pop();
      size += 1;
      for (const [next] of graph.get(current) || []) {
        if (componentByNode.has(next)) continue;
        componentByNode.set(next, componentId);
        stack.push(next);
      }
    }
    sizes.push(size);
  }
  return { componentByNode, sizes };
}

function connectNearbyRfnComponents(graph, coordsByKey, directKm) {
  if (!graph?.size || !coordsByKey?.size) return 0;
  const { componentByNode, sizes } = buildRfnGraphComponents(graph);
  if (sizes.length <= 1) return 0;

  // Les géométries RFN SNCF sont parfois découpées en tronçons voisins mais non
  // strictement raccordés par coordonnées identiques, notamment aux bifurcations,
  // faisceaux complexes et entrées de tunnels urbains. On ajoute donc quelques
  // raccords virtuels très courts entre composantes proches, sans fabriquer de
  // grands segments fictifs.
  const thresholdKm = Math.min(0.22, Math.max(0.11, Math.max(1, Number(directKm || 0)) * 0.0075));
  const cellSize = thresholdKm / 80;
  const cells = new Map();

  function cellKey(ix, iy) {
    return `${ix}:${iy}`;
  }

  for (const [key, coord] of coordsByKey.entries()) {
    const lon = Number(coord?.[0]);
    const lat = Number(coord?.[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const ix = Math.floor(lon / cellSize);
    const iy = Math.floor(lat / cellSize);
    const bucketKey = cellKey(ix, iy);
    const bucket = cells.get(bucketKey) || [];
    bucket.push(key);
    cells.set(bucketKey, bucket);
  }

  const bestByComponentPair = new Map();
  for (const [a, coordA] of coordsByKey.entries()) {
    const compA = componentByNode.get(a);
    if (compA === undefined) continue;
    const lonA = Number(coordA?.[0]);
    const latA = Number(coordA?.[1]);
    if (!Number.isFinite(lonA) || !Number.isFinite(latA)) continue;
    const ix = Math.floor(lonA / cellSize);
    const iy = Math.floor(latA / cellSize);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = cells.get(cellKey(ix + dx, iy + dy));
        if (!bucket?.length) continue;
        for (const b of bucket) {
          if (a >= b) continue;
          const compB = componentByNode.get(b);
          if (compB === undefined || compA === compB) continue;
          const coordB = coordsByKey.get(b);
          const lonB = Number(coordB?.[0]);
          const latB = Number(coordB?.[1]);
          if (!Number.isFinite(lonB) || !Number.isFinite(latB)) continue;
          const distance = haversine(latA, lonA, latB, lonB);
          if (!Number.isFinite(distance) || distance <= 0 || distance > thresholdKm) continue;
          const pairKey = compA < compB ? `${compA}:${compB}` : `${compB}:${compA}`;
          const previous = bestByComponentPair.get(pairKey);
          if (!previous || distance < previous.distance) {
            bestByComponentPair.set(pairKey, { a, b, distance });
          }
        }
      }
    }
  }

  let added = 0;
  for (const link of bestByComponentPair.values()) {
    if (!link?.a || !link?.b || !Number.isFinite(link.distance) || link.distance <= 0) continue;
    graph.get(link.a)?.push([link.b, link.distance]);
    graph.get(link.b)?.push([link.a, link.distance]);
    added += 1;
  }
  return added;
}

function connectStationRfnJunctions(graph, coordsByKey, start, end, directKm) {
  if (!graph?.size || !coordsByKey?.size || !start || !end) return 0;
  const direct = Number(directKm || 0);
  if (!Number.isFinite(direct) || direct <= 0) return 0;

  const radiusKm = direct <= 35 ? 0.95 : direct <= 100 ? 0.7 : 0.45;
  const pad = Math.min(1.2, Math.max(0.08, direct / 120));
  const bbox = {
    minLat: Math.min(start.lat, end.lat) - pad,
    maxLat: Math.max(start.lat, end.lat) + pad,
    minLon: Math.min(start.lon, end.lon) - pad,
    maxLon: Math.max(start.lon, end.lon) + pad
  };

  const { componentByNode } = buildRfnGraphComponents(graph);
  const cellSize = Math.max(0.004, radiusKm / 90);
  const cells = new Map();
  const cellKey = (ix, iy) => `${ix}:${iy}`;

  for (const [key, coord] of coordsByKey.entries()) {
    const lon = Number(coord?.[0]);
    const lat = Number(coord?.[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const ix = Math.floor(lon / cellSize);
    const iy = Math.floor(lat / cellSize);
    const bucketKey = cellKey(ix, iy);
    const bucket = cells.get(bucketKey) || [];
    bucket.push(key);
    cells.set(bucketKey, bucket);
  }

  const stations = Object.values(communeCache.byId || {});
  let added = 0;
  for (const rawStation of stations) {
    const station = canonicalizeStationDisplay(rawStation);
    const point = stationRoutePoint(station) || stationRawPoint(station);
    if (!point) continue;
    if (point.lat < bbox.minLat || point.lat > bbox.maxLat || point.lon < bbox.minLon || point.lon > bbox.maxLon) continue;

    const ix = Math.floor(point.lon / cellSize);
    const iy = Math.floor(point.lat / cellSize);
    const byComponent = new Map();
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dy = -2; dy <= 2; dy += 1) {
        const bucket = cells.get(cellKey(ix + dx, iy + dy));
        if (!bucket?.length) continue;
        for (const key of bucket) {
          const coord = coordsByKey.get(key);
          if (!coord) continue;
          const distance = haversine(point.lat, point.lon, coord[1], coord[0]);
          if (!Number.isFinite(distance) || distance <= 0 || distance > radiusKm) continue;
          const component = componentByNode.get(key);
          if (component === undefined) continue;
          const previous = byComponent.get(component);
          if (!previous || distance < previous.distance) byComponent.set(component, { key, distance });
        }
      }
    }
    const anchors = [...byComponent.values()].sort((a, b) => a.distance - b.distance).slice(0, 5);
    if (anchors.length < 2) continue;
    for (let i = 0; i < anchors.length; i += 1) {
      for (let j = i + 1; j < anchors.length; j += 1) {
        const a = anchors[i];
        const b = anchors[j];
        if (!a?.key || !b?.key || a.key === b.key) continue;
        const coordA = coordsByKey.get(a.key);
        const coordB = coordsByKey.get(b.key);
        if (!coordA || !coordB) continue;
        const distance = haversine(coordA[1], coordA[0], coordB[1], coordB[0]);
        if (!Number.isFinite(distance) || distance <= 0 || distance > radiusKm * 1.25) continue;
        const weight = distance * 1.45 + 0.04;
        graph.get(a.key)?.push([b.key, weight]);
        graph.get(b.key)?.push([a.key, weight]);
        added += 1;
      }
    }
  }
  return added;
}

function routeProgressOnSegment(point, start, end) {
  if (!point || !start || !end) return null;
  const lon = Number(point.lon ?? point[0]);
  const lat = Number(point.lat ?? point[1]);
  const lonA = Number(start.lon ?? start[0]);
  const latA = Number(start.lat ?? start[1]);
  const lonB = Number(end.lon ?? end[0]);
  const latB = Number(end.lat ?? end[1]);
  if (![lon, lat, lonA, latA, lonB, latB].every(Number.isFinite)) return null;
  const meanLat = ((lat + latA + latB) / 3) * Math.PI / 180;
  const kmPerLon = 111.32 * (Math.cos(meanLat) || 1);
  const kmPerLat = 110.57;
  const px = lon * kmPerLon;
  const py = lat * kmPerLat;
  const ax = lonA * kmPerLon;
  const ay = latA * kmPerLat;
  const bx = lonB * kmPerLon;
  const by = latB * kmPerLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0) return null;
  return clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
}

function routeCorridorMetrics(start, end, geometry) {
  const coords = Array.isArray(geometry) ? geometry : [];
  if (!start || !end || coords.length < 2) return { maxDeviationKm: Infinity, averageDeviationKm: Infinity, p95DeviationKm: Infinity };
  const deviations = [];
  for (const coord of coords) {
    const distance = routeCorridorDistanceKm(coord, start, end);
    if (Number.isFinite(distance)) deviations.push(distance);
  }
  if (!deviations.length) return { maxDeviationKm: Infinity, averageDeviationKm: Infinity, p95DeviationKm: Infinity };
  deviations.sort((a, b) => a - b);
  const average = deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
  return {
    maxDeviationKm: deviations[deviations.length - 1],
    averageDeviationKm: average,
    p95DeviationKm: deviations[Math.min(deviations.length - 1, Math.floor(deviations.length * 0.95))]
  };
}

function corridorDeviationLimitKm(directKm) {
  const direct = Number(directKm || 0);
  if (!Number.isFinite(direct) || direct <= 0) return Infinity;
  if (direct <= 35) return Math.max(2.6, direct * 0.18);
  if (direct <= 90) return Math.max(4.8, direct * 0.13);
  return Math.max(10, direct * 0.10);
}

function routeBacktrackingMetrics(start, end, geometry) {
  const coords = Array.isArray(geometry) ? geometry : [];
  if (!start || !end || coords.length < 2) return { regression: 0, reversals: 0 };
  let previous = null;
  let regression = 0;
  let reversals = 0;
  for (const coord of coords) {
    const progress = routeProgressOnSegment(coord, start, end);
    if (!Number.isFinite(progress)) continue;
    if (previous !== null) {
      const delta = progress - previous;
      if (delta < -0.018) {
        regression += Math.abs(delta);
        reversals += 1;
      }
    }
    previous = progress;
  }
  return { regression, reversals };
}

function routeCorridorScore(start, end, geometry) {
  const metrics = routeCorridorMetrics(start, end, geometry);
  const distance = polylineDistanceKm(geometry || []);
  if (!Number.isFinite(distance) || distance <= 0) return Infinity;
  const backtracking = routeBacktrackingMetrics(start, end, geometry);
  return distance
    + metrics.averageDeviationKm * 5
    + metrics.p95DeviationKm * 3
    + metrics.maxDeviationKm * 2
    + backtracking.regression * distance * 18
    + backtracking.reversals * 1.4;
}

function corridorWaypointCandidates(fromKey, toKey, start, end, directKm) {
  const direct = Number(directKm || 0);
  if (!Number.isFinite(direct) || direct <= 0 || direct > 120) return [];
  const corridorWidth = direct <= 35 ? Math.max(2.9, direct * 0.19) : Math.max(4.5, direct * 0.12);
  const exclude = new Set([currentStationId(fromKey), currentStationId(toKey)]);
  const candidates = [];
  for (const rawStation of Object.values(communeCache.byId || {})) {
    const station = canonicalizeStationDisplay(rawStation);
    const id = currentStationId(station?.id || '');
    if (!id || exclude.has(id)) continue;
    const point = stationRoutePoint(station) || stationRawPoint(station);
    if (!point) continue;
    const progress = routeProgressOnSegment(point, start, end);
    if (!Number.isFinite(progress) || progress < 0.16 || progress > 0.86) continue;
    const deviation = routeCorridorDistanceKm([point.lon, point.lat], start, end);
    if (!Number.isFinite(deviation) || deviation > corridorWidth) continue;
    const fromDistance = haversine(start.lat, start.lon, point.lat, point.lon);
    const toDistance = haversine(point.lat, point.lon, end.lat, end.lon);
    if (fromDistance < Math.max(1.8, direct * 0.08) || toDistance < Math.max(1.8, direct * 0.08)) continue;
    const importance = (station.hasPassengerStation ? 1.5 : 0) + Math.min(3, Number(station.baseDemand || station.population || 0) / 90000);
    candidates.push({ id, station, point, progress, deviation, importance, score: deviation + Math.abs(progress - 0.5) * 1.2 - importance * 0.25 });
  }
  return candidates.sort((a, b) => a.score - b.score).slice(0, 8);
}

const RFN_STRATEGIC_CORRIDOR_STATION_IDS = Object.freeze([
  // Grands nœuds utiles pour départager les corridors urbains quand le RFN
  // contient plusieurs branches parallèles très proches.
  'GARE_87723197', // Lyon-Part-Dieu
  'GARE_87722025', // Lyon-Perrache
  'GARE_87686006', // Paris-Gare-de-Lyon
  'GARE_87271031', // Paris-Nord
  'GARE_87113001', // Paris-Est
  'GARE_87391003', // Paris-Montparnasse principal selon sources SNCF
  'GARE_87751008', // Marseille-St-Charles
  'GARE_87286005', // Lille-Flandres
  'GARE_87212027', // Lille-Europe
  'GARE_87481002', // Bordeaux-St-Jean
  'GARE_87484006', // Toulouse-Matabiau
  'GARE_87471003', // Nantes
  'GARE_87471300', // Rennes
  'GARE_87223263', // Strasbourg-Ville
  'GARE_87611004'  // Nice-Ville
]);

function strategicCorridorWaypointCandidates(fromKey, toKey, start, end, directKm) {
  const direct = Number(directKm || 0);
  if (!Number.isFinite(direct) || direct <= 0 || direct > 180) return [];
  const exclude = new Set([currentStationId(fromKey), currentStationId(toKey)]);
  const corridorWidth = direct <= 35 ? Math.max(3.6, direct * 0.24) : Math.max(6.0, direct * 0.14);
  const out = [];
  for (const id of RFN_STRATEGIC_CORRIDOR_STATION_IDS) {
    if (exclude.has(id)) continue;
    const station = stationById(id);
    const point = stationRoutePoint(station) || stationRawPoint(station);
    if (!point) continue;
    const progress = routeProgressOnSegment(point, start, end);
    if (!Number.isFinite(progress) || progress < 0.07 || progress > 0.93) continue;
    const deviation = routeCorridorDistanceKm([point.lon, point.lat], start, end);
    if (!Number.isFinite(deviation) || deviation > corridorWidth) continue;
    const fromDistance = haversine(start.lat, start.lon, point.lat, point.lon);
    const toDistance = haversine(point.lat, point.lon, end.lat, end.lon);
    if (fromDistance < Math.max(1.2, direct * 0.04) || toDistance < Math.max(1.2, direct * 0.04)) continue;
    out.push({ id, station, point, progress, deviation, strategic: true, score: deviation + Math.abs(progress - 0.5) * 0.7 - 2.4 });
  }
  return out.sort((a, b) => a.score - b.score).slice(0, 4);
}

function mergeRouteWaypointCandidates(base, extra) {
  const byId = new Map();
  for (const candidate of [...(extra || []), ...(base || [])]) {
    if (!candidate?.id || byId.has(candidate.id)) continue;
    byId.set(candidate.id, candidate);
  }
  return [...byId.values()].sort((a, b) => a.score - b.score).slice(0, 10);
}

async function improveSncfRouteGeometryWithCorridorWaypoint(fromKey, toKey, geometry, profile, directKm) {
  const coords = Array.isArray(geometry) ? geometry : [];
  if (coords.length < 2) return coords;
  const fromStation = stationById(fromKey);
  const toStation = stationById(toKey);
  const start = stationRoutePoint(fromStation) || stationRawPoint(fromStation);
  const end = stationRoutePoint(toStation) || stationRawPoint(toStation);
  if (!start || !end) return coords;
  if (Number(directKm || 0) > 180) return coords;

  const limit = corridorDeviationLimitKm(directKm);
  const currentMetrics = routeCorridorMetrics(start, end, coords);
  const currentDistance = polylineDistanceKm(coords);
  const currentScore = routeCorridorScore(start, end, coords);
  const currentBacktracking = routeBacktrackingMetrics(start, end, coords);
  let best = { geometry: coords, score: currentScore, metrics: currentMetrics, distance: currentDistance, waypoint: null };

  const genericCandidates = (currentMetrics.p95DeviationKm > limit * 0.72 || currentBacktracking.reversals > 0)
    ? corridorWaypointCandidates(fromKey, toKey, start, end, directKm)
    : [];
  const strategicCandidates = strategicCorridorWaypointCandidates(fromKey, toKey, start, end, directKm);
  const candidates = mergeRouteWaypointCandidates(genericCandidates, strategicCandidates);
  if (!candidates.length) return coords;

  for (const candidate of candidates) {
    // On garde les raccords de gare/jonction actifs ici. Les désactiver empêchait
    // justement certains corridors urbains réels d’être retrouvés, notamment à Lyon.
    const first = await sncfRouteGeometryForStations(fromKey, candidate.id, { profile, disableAutoWaypoint: true });
    const second = await sncfRouteGeometryForStations(candidate.id, toKey, { profile, disableAutoWaypoint: true });
    if (!Array.isArray(first) || first.length < 2 || !Array.isArray(second) || second.length < 2) continue;
    const merged = mergeGeoCoordinateSequences([first, second]);
    const distance = polylineDistanceKm(merged);
    if (!Number.isFinite(distance) || distance <= 0) continue;
    const maxAllowed = candidate.strategic
      ? Math.max(currentDistance * 1.55, Number(directKm || 0) + 32)
      : Math.max(currentDistance * 1.42, Number(directKm || 0) + 24);
    if (distance > maxAllowed) continue;
    const metrics = routeCorridorMetrics(start, end, merged);
    const score = routeCorridorScore(start, end, merged);
    const substantiallyCleaner = metrics.p95DeviationKm < best.metrics.p95DeviationKm * 0.82
      || metrics.maxDeviationKm < best.metrics.maxDeviationKm * 0.82
      || score < best.score - Math.max(1.2, Number(directKm || 0) * 0.04);
    const strategicTieBreak = candidate.strategic && score <= best.score + Math.max(2.2, Number(directKm || 0) * 0.08)
      && metrics.p95DeviationKm <= best.metrics.p95DeviationKm * 1.05
      && distance <= Math.max(best.distance * 1.18, Number(directKm || 0) + 18);
    if ((substantiallyCleaner || strategicTieBreak) && score < best.score + 3.5) {
      best = { geometry: merged, score, metrics, distance, waypoint: candidate.id };
    }
  }
  return best.geometry;
}

async function sncfRouteGeometryForStations(fromId, toId, options = {}) {
  const profile = normalizeRailRouteProfile(options.profile || 'default');
  const fromKey = currentStationId(fromId);
  const toKey = currentStationId(toId);
  const disableAutoWaypoint = options.disableAutoWaypoint === true;
  ensureSncfPersistentRouteCacheLoaded();
  const key = sncfRouteCacheKey(fromKey, toKey, profile);
  if (!disableAutoWaypoint && sncfRouteGeometryResultCache.has(key)) return sncfRouteGeometryResultCache.get(key);
  const reverseKey = sncfRouteCacheKey(toKey, fromKey, profile);
  if (!disableAutoWaypoint && sncfRouteGeometryResultCache.has(reverseKey)) {
    const reversed = [...sncfRouteGeometryResultCache.get(reverseKey)].reverse();
    return rememberSncfRouteGeometry(key, reversed);
  }

  const from = stationById(fromKey);
  const to = stationById(toKey);
  if (!from || !to) return [];
  const start = stationRoutePoint(from) || stationRawPoint(from);
  const end = stationRoutePoint(to) || stationRawPoint(to);
  if (!start || !end) return [];
  const directKm = haversine(start.lat, start.lon, end.lat, end.lon);
  if (!Number.isFinite(directKm) || directKm <= 0 || directKm > 1300) return [];

  try {
    const lines = await loadSncfRailShapeLines();
    const pad = Math.min(2.2, Math.max(0.12, directKm / 85));
    const bbox = {
      minLat: Math.min(start.lat, end.lat) - pad,
      maxLat: Math.max(start.lat, end.lat) + pad,
      minLon: Math.min(start.lon, end.lon) - pad,
      maxLon: Math.max(start.lon, end.lon) + pad
    };
    const relevant = sncfRailLinesInBounds(lines, bbox);
    if (relevant.length > 850 && directKm < 180) {
      const tighterPad = Math.min(0.9, Math.max(0.08, directKm / 150));
      const tightBox = {
        minLat: Math.min(start.lat, end.lat) - tighterPad,
        maxLat: Math.max(start.lat, end.lat) + tighterPad,
        minLon: Math.min(start.lon, end.lon) - tighterPad,
        maxLon: Math.max(start.lon, end.lon) + tighterPad
      };
      const tighter = sncfRailLinesInBounds(lines, tightBox);
      if (tighter.length >= 1) relevant.splice(0, relevant.length, ...tighter);
    }
    const corridorRelevant = filterRfnLinesForRouteCorridor(relevant, start, end, directKm, profile, 'primary');
    let geometry = buildPathFromRailShapeLines(corridorRelevant, start, end, directKm, { profile, stationJunctions: options.disableStationJunctions !== true });
    if (!Array.isArray(geometry) || geometry.length < 2) {
      const fallbackRelevant = filterRfnLinesForRouteCorridor(relevant, start, end, directKm, profile, 'fallback');
      if (fallbackRelevant.length !== corridorRelevant.length) {
        geometry = buildPathFromRailShapeLines(fallbackRelevant, start, end, directKm, { profile, stationJunctions: options.disableStationJunctions !== true });
      }
    }
    if ((!Array.isArray(geometry) || geometry.length < 2) && relevant.length !== corridorRelevant.length && relevant.length <= 420) {
      geometry = buildPathFromRailShapeLines(relevant, start, end, directKm, { profile, stationJunctions: options.disableStationJunctions !== true });
    }
    if (!Array.isArray(geometry) || geometry.length < 2) return [];
    const improved = disableAutoWaypoint ? geometry : await improveSncfRouteGeometryWithCorridorWaypoint(fromKey, toKey, geometry, profile, directKm);
    return disableAutoWaypoint ? improved : rememberSncfRouteGeometry(key, improved);
  } catch (error) {
    console.warn('Géométrie SNCF RFN indisponible:', error.message);
    return [];
  }
}

function projectPointOnGeoPolyline(point, coords) {
  if (!point || !Array.isArray(coords) || coords.length < 2) return null;
  const pLat = Number(point.lat);
  const pLon = Number(point.lon);
  if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return null;
  let cumulative = 0;
  let best = null;
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1];
    const b = coords[i];
    const lonA = Number(a?.[0]);
    const latA = Number(a?.[1]);
    const lonB = Number(b?.[0]);
    const latB = Number(b?.[1]);
    if (![lonA, latA, lonB, latB].every(Number.isFinite)) continue;
    const segKm = haversine(latA, lonA, latB, lonB);
    if (!Number.isFinite(segKm) || segKm <= 0) continue;

    const meanLat = ((latA + latB + pLat) / 3) * Math.PI / 180;
    const kmPerLon = 111.32 * (Math.cos(meanLat) || 1);
    const kmPerLat = 110.57;
    const ax = lonA * kmPerLon;
    const ay = latA * kmPerLat;
    const bx = lonB * kmPerLon;
    const by = latB * kmPerLat;
    const px = pLon * kmPerLon;
    const py = pLat * kmPerLat;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1) : 0;
    const lon = lonA + (lonB - lonA) * t;
    const lat = latA + (latB - latA) * t;
    const distance = haversine(pLat, pLon, lat, lon);
    const atKm = cumulative + segKm * t;
    if (!best || distance < best.distanceKm) {
      best = { distanceKm: distance, atKm, index: i - 1, t, lon, lat };
    }
    cumulative += segKm;
  }
  if (!best) return null;
  best.totalKm = cumulative;
  return best;
}


const RFN_NEAR_PASSENGER_STATION_TOLERANCE_KM = 0.28;
const RFN_SUBURBAN_DENSE_STATION_TOLERANCE_KM = 0.45;
const RFN_NEAR_PASSENGER_STATION_RADIUS_KM = 1.25;
const RFN_SUBURBAN_DENSE_DEPARTMENTS = new Set(['75', '77', '78', '91', '92', '93', '94', '95', '69', '13', '31', '33', '44', '59', '67']);
const rfnStationDensityCache = new Map();

function rfnStationDensityMetrics(stationId) {
  const id = currentStationId(stationId);
  if (!id) return null;
  if (rfnStationDensityCache.has(id)) return rfnStationDensityCache.get(id);
  const station = stationById(id);
  const point = stationRoutePoint(station) || stationRawPoint(station);
  if (!station || !point) {
    const empty = { nearestPassengerKm: Infinity, passengerWithin3Km: 0, passengerWithin5Km: 0, passengerWithin8Km: 0, denseDepartment: false };
    rfnStationDensityCache.set(id, empty);
    return empty;
  }
  let nearestPassengerKm = Infinity;
  let passengerWithin3Km = 0;
  let passengerWithin5Km = 0;
  let passengerWithin8Km = 0;
  for (const rawOther of Object.values(communeCache.byId || {})) {
    const other = canonicalizeStationDisplay(rawOther);
    const otherId = currentStationId(other?.id || '');
    if (!otherId || otherId === id || !other?.hasPassengerStation) continue;
    const otherPoint = stationRoutePoint(other) || stationRawPoint(other);
    if (!otherPoint) continue;
    const distance = haversine(point.lat, point.lon, otherPoint.lat, otherPoint.lon);
    if (!Number.isFinite(distance)) continue;
    nearestPassengerKm = Math.min(nearestPassengerKm, distance);
    if (distance <= 3) passengerWithin3Km += 1;
    if (distance <= 5) passengerWithin5Km += 1;
    if (distance <= 8) passengerWithin8Km += 1;
  }
  const dep = String(station.codeDepartement || station.code || '').slice(0, 2);
  const metrics = {
    nearestPassengerKm,
    passengerWithin3Km,
    passengerWithin5Km,
    passengerWithin8Km,
    denseDepartment: RFN_SUBURBAN_DENSE_DEPARTMENTS.has(dep)
  };
  rfnStationDensityCache.set(id, metrics);
  return metrics;
}

function rfnStationGeometryToleranceKm(stationId, baseAllowedKm) {
  const base = Number(baseAllowedKm);
  if (!Number.isFinite(base) || base <= 0) return baseAllowedKm;
  const station = stationById(stationId);
  if (!station?.hasPassengerStation) return base;
  const metrics = rfnStationDensityMetrics(stationId);
  if (!metrics) return base;
  // En zone très dense, deux gares voyageurs peuvent être séparées par moins d'un
  // kilomètre. Une tolérance large validait alors une branche parallèle voisine
  // (cas Javel → St-Quentin via Bellevue/Sèvres au lieu de Meudon-Val-Fleury).
  if (metrics.nearestPassengerKm <= RFN_NEAR_PASSENGER_STATION_RADIUS_KM) {
    return Math.min(base, RFN_NEAR_PASSENGER_STATION_TOLERANCE_KM);
  }
  const suburbanDense = metrics.passengerWithin3Km >= 2
    || metrics.passengerWithin5Km >= 4
    || (metrics.denseDepartment && metrics.passengerWithin8Km >= 5);
  if (suburbanDense) return Math.min(base, RFN_SUBURBAN_DENSE_STATION_TOLERANCE_KM);
  return base;
}


function rfnStationIsDenseForRouting(stationId) {
  const station = stationById(stationId);
  if (!station?.hasPassengerStation) return false;
  const metrics = rfnStationDensityMetrics(stationId);
  if (!metrics) return false;
  return metrics.nearestPassengerKm <= RFN_NEAR_PASSENGER_STATION_RADIUS_KM
    || metrics.passengerWithin3Km >= 2
    || metrics.passengerWithin5Km >= 4
    || (metrics.denseDepartment && metrics.passengerWithin8Km >= 5);
}

function rfnStopSequenceLikelyDense(ids) {
  const list = Array.isArray(ids) ? ids : [];
  if (list.length <= 2) return list.some(rfnStationIsDenseForRouting);
  let dense = 0;
  for (const id of list) {
    if (rfnStationIsDenseForRouting(id)) dense += 1;
    if (dense >= 2) return true;
  }
  return false;
}

function routeGeometryMatchesStopSequence(ids, geometry, options = {}) {
  const coords = Array.isArray(geometry) ? geometry : [];
  if (!Array.isArray(ids) || ids.length < 2 || coords.length < 2) return { ok: false, reason: 'empty' };
  const totalKm = polylineDistanceKm(coords);
  if (!Number.isFinite(totalKm) || totalKm <= 0) return { ok: false, reason: 'distance' };

  const maxStationDistanceKm = Number(options.maxStationDistanceKm ?? 1.0);
  const maxTerminalDistanceKm = Number(options.maxTerminalDistanceKm ?? 1.7);
  const minProgressKm = Number(options.minProgressKm ?? 0.04);
  const maxLegFactor = Number(options.maxLegFactor ?? 3.0);
  const maxLegExtraKm = Number(options.maxLegExtraKm ?? 18);
  const maxGlobalDistanceFactor = Number(options.maxGlobalDistanceFactor ?? 3.2);
  const allowLargeTerminalOffset = options.allowLargeTerminalOffset === true;
  let previousAt = -Infinity;
  let worstDistance = 0;
  const projections = [];

  for (let i = 0; i < ids.length; i += 1) {
    const stop = stationById(ids[i]);
    const point = stationRoutePoint(stop) || stationRawPoint(stop);
    const projection = projectPointOnGeoPolyline(point, coords);
    if (!projection) return { ok: false, reason: 'projection', stationId: ids[i] };
    const isTerminal = i === 0 || i === ids.length - 1;
    let allowed = isTerminal ? maxTerminalDistanceKm : maxStationDistanceKm;
    const baseAllowed = allowed;
    const denseAllowed = rfnStationGeometryToleranceKm(ids[i], allowed);
    if (!(allowLargeTerminalOffset && isTerminal)) allowed = Math.min(allowed, denseAllowed);
    if (allowLargeTerminalOffset && isTerminal) allowed = Math.max(allowed, projection.distanceKm);
    if (projection.distanceKm > allowed) {
      return {
        ok: false,
        reason: 'too-far',
        stationId: ids[i],
        distanceKm: projection.distanceKm,
        allowed,
        baseAllowed,
        denseAllowed
      };
    }
    if (i > 0 && projection.atKm + minProgressKm < previousAt) {
      return { ok: false, reason: 'order', stationId: ids[i], atKm: projection.atKm, previousAt };
    }
    previousAt = Math.max(previousAt, projection.atKm);
    worstDistance = Math.max(worstDistance, projection.distanceKm);
    projections.push({ id: ids[i], atKm: projection.atKm, distanceKm: projection.distanceKm });
  }

  const startStation = stationById(ids[0]);
  const endStation = stationById(ids[ids.length - 1]);
  const startPoint = stationRoutePoint(startStation) || stationRawPoint(startStation);
  const endPoint = stationRoutePoint(endStation) || stationRawPoint(endStation);
  const directTotalKm = startPoint && endPoint ? haversine(startPoint.lat, startPoint.lon, endPoint.lat, endPoint.lon) : 0;
  if (directTotalKm > 0 && totalKm > Math.max(35, directTotalKm * maxGlobalDistanceFactor)) {
    return { ok: false, reason: 'global-detour', totalKm, directKm: directTotalKm };
  }

  for (let i = 1; i < projections.length; i += 1) {
    const fromStation = stationById(ids[i - 1]);
    const toStation = stationById(ids[i]);
    const fromPoint = stationRoutePoint(fromStation) || stationRawPoint(fromStation);
    const toPoint = stationRoutePoint(toStation) || stationRawPoint(toStation);
    if (!fromPoint || !toPoint) continue;
    const directKm = haversine(fromPoint.lat, fromPoint.lon, toPoint.lat, toPoint.lon);
    const alongKm = Math.max(0, projections[i].atKm - projections[i - 1].atKm);
    if (Number.isFinite(directKm) && directKm > 0.4 && Number.isFinite(alongKm)) {
      const allowedAlong = Math.max(directKm + maxLegExtraKm, directKm * maxLegFactor);
      if (alongKm > allowedAlong) {
        return {
          ok: false,
          reason: 'leg-detour',
          from: ids[i - 1],
          to: ids[i],
          alongKm,
          directKm,
          allowedKm: allowedAlong
        };
      }
    }
  }

  return { ok: true, totalKm, worstDistance, projections };
}

function routeGeometryValidationScore(validation, stopsCovered = 2) {
  if (!validation?.ok) return Infinity;
  const distance = Number(validation.totalKm || 0);
  const worst = Number(validation.worstDistance || 0);
  const coverageBonus = Math.max(0, Number(stopsCovered || 0) - 2) * 1.8;
  return distance + worst * 18 - coverageBonus;
}

function mergeGeoCoordinateSequences(sequences) {
  const out = [];
  for (const sequence of sequences || []) {
    const coords = Array.isArray(sequence) ? sequence : [];
    for (const coord of coords) {
      if (!Array.isArray(coord) || coord.length < 2) continue;
      const lon = Number(coord[0]);
      const lat = Number(coord[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      const last = out[out.length - 1];
      if (last && Math.abs(last[0] - lon) < 0.000001 && Math.abs(last[1] - lat) < 0.000001) continue;
      out.push([roundCoord(lon), roundCoord(lat)]);
    }
  }
  return out;
}


function stationDirectDistanceKm(a, b) {
  const stationA = stationById(a);
  const stationB = stationById(b);
  const pointA = stationRoutePoint(stationA) || stationRawPoint(stationA);
  const pointB = stationRoutePoint(stationB) || stationRawPoint(stationB);
  if (!pointA || !pointB) return Infinity;
  const distance = haversine(pointA.lat, pointA.lon, pointB.lat, pointB.lon);
  return Number.isFinite(distance) ? distance : Infinity;
}

async function sncfRouteGeometryForStopSequence(stops, options = {}) {
  const profile = normalizeRailRouteProfile(options.profile || 'default');
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.length < 2) return { ids, geometry: [], chunks: [] };
  const cacheKey = sncfRouteSequenceCacheKey(ids, profile);
  ensureSncfPersistentRouteCacheLoaded();
  if (sncfRouteGeometrySequenceResultCache.has(cacheKey)) return sncfRouteGeometrySequenceResultCache.get(cacheKey);

  const denseSequence = rfnStopSequenceLikelyDense(ids);
  const fullDirectKm = stationDirectDistanceKm(ids[0], ids[ids.length - 1]);
  const globalDistanceLimitKm = profile === 'highspeed' ? 320 : 115;
  const shouldTryGlobal = ids.length === 2
    && Number.isFinite(fullDirectKm)
    && fullDirectKm <= globalDistanceLimitKm;
  if (shouldTryGlobal) {
    const directGeometry = await sncfRouteGeometryForStations(ids[0], ids[ids.length - 1], { profile, disableAutoWaypoint: ids.length > 2 });
    const directValidation = routeGeometryMatchesStopSequence(ids, directGeometry, {
      // Un tracé global est accepté uniquement s’il colle réellement à chaque gare
      // de la suite. Les branches parallèles ou voies voisines qui passent seulement
      // "à proximité" sont refusées puis recalculées en sous-parcours.
      maxStationDistanceKm: denseSequence ? 0.55 : 0.75,
      maxTerminalDistanceKm: denseSequence ? 1.05 : 1.35,
      maxLegFactor: denseSequence ? 2.35 : 2.75,
      maxLegExtraKm: denseSequence ? 9 : 14,
      maxGlobalDistanceFactor: profile === 'highspeed' ? 3.6 : 3.0
    });
    if (directValidation.ok) {
      return rememberSncfRouteGeometrySequence(cacheKey, {
        ids,
        geometry: directGeometry,
        chunks: [{
          fromIndex: 0,
          toIndex: ids.length - 1,
          mode: 'global',
          pointCount: directGeometry.length,
          worstStopDistanceKm: round2(directValidation.worstDistance || 0)
        }]
      });
    }
  }

  const chunks = [];
  const geometries = [];
  let index = 0;
  while (index < ids.length - 1) {
    let accepted = null;
    const maxTo = Math.min(ids.length - 1, index + (denseSequence ? 3 : 5));

    // On évalue plusieurs longueurs de sous-parcours et on garde le meilleur
    // compromis fidélité/continuité, au lieu de prendre systématiquement le plus
    // long tronçon admissible. Cela évite les globaux visuellement incohérents
    // tout en conservant des géométries plus détaillées que le segment par segment.
    const candidateTargets = [];
    const offsets = denseSequence ? [3, 2, 1] : [5, 3, 2, 1];
    for (const offset of offsets) {
      const to = Math.min(maxTo, index + offset);
      if (to > index && !candidateTargets.includes(to)) candidateTargets.push(to);
    }

    let bestCandidate = null;
    for (const to of candidateTargets.sort((a, b) => b - a)) {
      const candidateDirectKm = stationDirectDistanceKm(ids[index], ids[to]);
      const candidateDistanceLimitKm = denseSequence ? 42 : (profile === 'highspeed' ? 240 : 95);
      if (to > index + 1 && Number.isFinite(candidateDirectKm) && candidateDirectKm > candidateDistanceLimitKm) continue;
      const geometry = await sncfRouteGeometryForStations(ids[index], ids[to], { profile, disableAutoWaypoint: true });
      if (!Array.isArray(geometry) || geometry.length < 2) continue;
      const slice = ids.slice(index, to + 1);
      const validation = routeGeometryMatchesStopSequence(slice, geometry, {
        maxStationDistanceKm: to > index + 1 ? 0.75 : 1.15,
        maxTerminalDistanceKm: to > index + 1 ? 1.35 : 1.7,
        maxLegFactor: to > index + 1 ? 2.85 : 3.6,
        maxLegExtraKm: to > index + 1 ? 14 : 22,
        maxGlobalDistanceFactor: profile === 'highspeed' ? 3.8 : 3.25
      });
      if (!validation.ok) continue;
      const candidate = {
        to,
        geometry,
        validation,
        mode: to > index + 1 ? 'subsequence' : 'segment',
        score: routeGeometryValidationScore(validation, slice.length)
      };
      if (!bestCandidate || candidate.score < bestCandidate.score - 24 || (Math.abs(candidate.score - bestCandidate.score) <= 24 && candidate.to > bestCandidate.to)) {
        bestCandidate = candidate;
      }
      // Si un long sous-parcours est propre, inutile de tester tous les plus courts.
      if (to > index + 3 && validation.worstDistance <= 0.35) break;
    }

    if (bestCandidate) accepted = bestCandidate;

    if (!accepted) {
      const geometry = await sncfRouteGeometryForStations(ids[index], ids[index + 1], { profile });
      if (!Array.isArray(geometry) || geometry.length < 2) return rememberSncfRouteGeometrySequence(cacheKey, { ids, geometry: [], chunks: [] });
      const validation = routeGeometryMatchesStopSequence(ids.slice(index, index + 2), geometry, {
        maxStationDistanceKm: 1.5,
        maxTerminalDistanceKm: 2.2,
        maxLegFactor: 4.2,
        maxLegExtraKm: 30,
        allowLargeTerminalOffset: true
      });
      accepted = {
        to: index + 1,
        geometry,
        validation,
        mode: validation.ok ? 'segment-fallback' : 'segment-forced',
        score: validation.ok ? routeGeometryValidationScore(validation, 2) : Infinity
      };
    }

    geometries.push(accepted.geometry);
    chunks.push({
      fromIndex: index,
      toIndex: accepted.to,
      from: ids[index],
      to: ids[accepted.to],
      mode: accepted.mode,
      pointCount: accepted.geometry.length,
      worstStopDistanceKm: round2(accepted.validation?.worstDistance || 0)
    });
    index = accepted.to;
  }

  const geometry = mergeGeoCoordinateSequences(geometries);
  return rememberSncfRouteGeometrySequence(cacheKey, { ids, geometry, chunks });
}


const HIGH_SPEED_RAIL_LINE_CODES = new Set([
  // Principales lignes LGV SNCF. Utilisé si le cache RFN contient un code ligne.
  '005000', '226000', '431000', '752000', '834000', '836000', '837000', '834300'
]);

const HIGH_SPEED_RAIL_CORRIDORS = [
  { id: 'lgv-est', radiusKm: 11, anchors: [[2.62, 48.88], [3.99, 49.21], [5.27, 48.98], [6.17, 48.95], [7.73, 48.58]] },
  { id: 'lgv-nord', radiusKm: 12, anchors: [[2.45, 49.02], [2.83, 49.45], [3.05, 49.88], [3.07, 50.34], [3.08, 50.64]] },
  { id: 'lgv-atlantique-ouest', radiusKm: 13, anchors: [[2.27, 48.73], [1.84, 48.54], [0.19, 47.99], [-1.68, 48.10]] },
  { id: 'lgv-atlantique-sud-ouest', radiusKm: 13, anchors: [[2.27, 48.73], [1.84, 48.54], [0.70, 47.39], [0.34, 46.58], [-0.58, 44.84]] },
  { id: 'lgv-sud-est', radiusKm: 13, anchors: [[2.37, 48.64], [3.17, 47.89], [4.46, 46.80], [4.86, 45.76]] },
  { id: 'lgv-mediterranee', radiusKm: 14, anchors: [[4.86, 45.76], [4.89, 44.93], [4.80, 43.95], [4.79, 43.45], [5.38, 43.30]] },
  { id: 'lgv-rhone-alpes', radiusKm: 13, anchors: [[4.86, 45.76], [5.10, 45.55], [5.18, 45.35], [4.89, 44.93]] },
  { id: 'lgv-rhin-rhone', radiusKm: 13, anchors: [[5.04, 47.32], [5.80, 47.47], [6.45, 47.58], [7.25, 47.74]] },
  { id: 'contournement-nimes-montpellier', radiusKm: 10, anchors: [[4.36, 43.80], [4.70, 43.70], [3.88, 43.58]] }
];

function geoPointToSegmentDistanceKm(point, a, b) {
  if (!Array.isArray(point) || !Array.isArray(a) || !Array.isArray(b)) return Infinity;
  const lon = Number(point[0]);
  const lat = Number(point[1]);
  const lonA = Number(a[0]);
  const latA = Number(a[1]);
  const lonB = Number(b[0]);
  const latB = Number(b[1]);
  if (![lon, lat, lonA, latA, lonB, latB].every(Number.isFinite)) return Infinity;
  const meanLat = ((lat + latA + latB) / 3) * Math.PI / 180;
  const kmPerLon = 111.32 * (Math.cos(meanLat) || 1);
  const kmPerLat = 110.57;
  const px = lon * kmPerLon;
  const py = lat * kmPerLat;
  const ax = lonA * kmPerLon;
  const ay = latA * kmPerLat;
  const bx = lonB * kmPerLon;
  const by = latB * kmPerLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function distanceToHighSpeedCorridorKm(coord, corridor) {
  const anchors = corridor?.anchors || [];
  let best = Infinity;
  for (let i = 1; i < anchors.length; i += 1) {
    best = Math.min(best, geoPointToSegmentDistanceKm(coord, anchors[i - 1], anchors[i]));
  }
  return best;
}

function isLikelyHighSpeedRailShapeLine(line) {
  if (!line || typeof line !== 'object') return false;
  if (line.highSpeed === true || line.routeClass === 'highspeed') return true;
  const rawCode = String(line.codeLigne || line.code_ligne || line.lineCode || line.code || '').trim();
  if (rawCode && HIGH_SPEED_RAIL_LINE_CODES.has(rawCode.padStart(6, '0'))) return true;
  const coords = Array.isArray(line.coords) ? line.coords : [];
  if (coords.length < 2) return false;
  const samples = [];
  const sampleCount = Math.min(7, Math.max(3, coords.length));
  for (let i = 0; i < sampleCount; i += 1) {
    const index = Math.round((coords.length - 1) * (i / Math.max(1, sampleCount - 1)));
    const coord = coords[index];
    if (Array.isArray(coord) && coord.length >= 2) samples.push(coord);
  }
  if (!samples.length) return false;
  let bestHits = 0;
  let bestAverage = Infinity;
  for (const corridor of HIGH_SPEED_RAIL_CORRIDORS) {
    const distances = samples.map(coord => distanceToHighSpeedCorridorKm(coord, corridor));
    const hits = distances.filter(distance => distance <= corridor.radiusKm).length;
    const average = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
    if (hits > bestHits || (hits === bestHits && average < bestAverage)) {
      bestHits = hits;
      bestAverage = average;
    }
  }
  return bestHits >= Math.ceil(samples.length * 0.72) && bestAverage <= 9.5;
}

function routeCorridorDistanceKm(coord, start, end) {
  if (!coord || !start || !end) return 0;
  return geoPointToSegmentDistanceKm(coord, [start.lon, start.lat], [end.lon, end.lat]);
}

function rfnRouteCorridorFilterRadiusKm(directKm, profile = 'default', mode = 'primary') {
  const direct = Number(directKm || 0);
  if (!Number.isFinite(direct) || direct <= 0) return Infinity;
  let radius;
  if (direct <= 12) radius = Math.max(1.45, direct * 0.22);
  else if (direct <= 35) radius = Math.max(2.4, direct * 0.18);
  else if (direct <= 90) radius = Math.max(4.2, direct * 0.14);
  else if (direct <= 260) radius = Math.max(9.5, direct * 0.095);
  else radius = Math.max(18, direct * 0.07);
  if (profile === 'highspeed') radius *= 1.18;
  if (mode === 'fallback') radius *= 1.9;
  return radius;
}

function rfnLineApproxDistanceToRouteKm(line, start, end, maxSamples = 28) {
  const coords = Array.isArray(line?.coords) ? line.coords : [];
  if (!coords.length) return Infinity;
  const step = Math.max(1, Math.floor(coords.length / Math.max(3, maxSamples)));
  let best = Infinity;
  for (let i = 0; i < coords.length; i += step) {
    const coord = coords[i];
    const distance = routeCorridorDistanceKm(coord, start, end);
    if (Number.isFinite(distance) && distance < best) best = distance;
    if (best <= 0.08) return best;
  }
  const last = coords[coords.length - 1];
  const lastDistance = routeCorridorDistanceKm(last, start, end);
  if (Number.isFinite(lastDistance) && lastDistance < best) best = lastDistance;
  return best;
}

function rfnLineNearEndpointKm(line, start, end, radiusKm) {
  const coords = Array.isArray(line?.coords) ? line.coords : [];
  if (!coords.length) return false;
  const step = Math.max(1, Math.floor(coords.length / 18));
  for (let i = 0; i < coords.length; i += step) {
    const coord = coords[i];
    if (!Array.isArray(coord)) continue;
    const dStart = haversine(start.lat, start.lon, coord[1], coord[0]);
    if (Number.isFinite(dStart) && dStart <= radiusKm) return true;
    const dEnd = haversine(end.lat, end.lon, coord[1], coord[0]);
    if (Number.isFinite(dEnd) && dEnd <= radiusKm) return true;
  }
  return false;
}

function filterRfnLinesForRouteCorridor(lines, start, end, directKm, profile = 'default', mode = 'primary') {
  const source = Array.isArray(lines) ? lines : [];
  if (!source.length || !start || !end) return source;
  const direct = Number(directKm || 0);
  if (!Number.isFinite(direct) || direct <= 0) return source;
  const radius = rfnRouteCorridorFilterRadiusKm(direct, profile, mode);
  const endpointRadius = Math.min(9, Math.max(1.8, direct * 0.11, radius * 0.72));
  const out = [];
  for (const line of source) {
    if (!line?.coords?.length) continue;
    const highSpeed = profile === 'highspeed' && isLikelyHighSpeedRailShapeLine(line);
    const allowed = highSpeed ? radius * 1.45 : radius;
    const distance = rfnLineApproxDistanceToRouteKm(line, start, end, highSpeed ? 34 : 24);
    if (Number.isFinite(distance) && distance <= allowed) {
      out.push(line);
      continue;
    }
    // Les extrémités peuvent se trouver dans des faisceaux très denses. On garde
    // quelques tronçons autour des gares de départ/arrivée pour conserver les
    // raccordements, sans embarquer toute la boîte RFN.
    if (rfnLineNearEndpointKm(line, start, end, endpointRadius)) out.push(line);
  }
  return out.length >= 2 ? out : source;
}

function railRouteCorridorPenalty(distanceKm, coordA, coordB, start, end, directKm, profile) {
  const distance = Number(distanceKm);
  const direct = Number(directKm);
  if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(direct) || direct <= 0) return 0;
  const mid = [
    (Number(coordA?.[0]) + Number(coordB?.[0])) / 2,
    (Number(coordA?.[1]) + Number(coordB?.[1])) / 2
  ];
  if (!mid.every(Number.isFinite)) return 0;

  // Le RFN réel peut s'écarter d'une ligne droite, mais sur des parcours urbains
  // courts, le plus court chemin brut privilégiait parfois une boucle ferroviaire
  // opposée à l'axe naturel de la ligne (cas Lyon : passage par Vaise/Perrache au
  // lieu de l'axe Sathonay/Part-Dieu). On ajoute donc une pénalité progressive de
  // corridor : faible sur les longues liaisons, plus sensible sur les petits
  // itinéraires où deux branches parallèles existent.
  const corridorKm = direct <= 35
    ? Math.max(0.9, direct * 0.10)
    : direct <= 90
      ? Math.max(2.8, direct * 0.10)
      : Math.max(8, direct * 0.08);
  const deviationKm = routeCorridorDistanceKm(mid, start, end);
  if (!Number.isFinite(deviationKm) || deviationKm <= corridorKm) return 0;

  const excess = deviationKm - corridorKm;
  const relative = excess / corridorKm;
  const corridorFactor = direct <= 35 ? 8.5 : direct <= 90 ? 2.2 : 0.65;
  const profileFactor = profile === 'highspeed' ? 0.65 : 1;
  return distance * Math.min(7, relative * relative * corridorFactor * profileFactor);
}

function railRouteEdgeWeight(distanceKm, line, profile, context = {}) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance <= 0) return distanceKm;
  const highSpeed = isLikelyHighSpeedRailShapeLine(line);
  let weight = distance;
  if (profile === 'highspeed') weight = highSpeed ? distance * 0.34 : distance;
  else if (profile === 'classic') weight = highSpeed ? distance * 8.5 : distance;
  return weight + railRouteCorridorPenalty(distance, context.coordA, context.coordB, context.start, context.end, context.directKm, profile);
}

function buildPathFromRailShapeLines(lines, start, end, directKm, options = {}) {
  const profile = normalizeRailRouteProfile(options.profile || 'default');
  const graph = new Map();
  const coordsByKey = new Map();
  function addNode(lon, lat) {
    const key = rfnCoordKey(lon, lat);
    coordsByKey.set(key, [lon, lat]);
    if (!graph.has(key)) graph.set(key, []);
    return key;
  }
  for (const line of lines || []) {
    const coords = line.coords || [];
    for (let i = 1; i < coords.length; i++) {
      const [lonA, latA] = coords[i - 1];
      const [lonB, latB] = coords[i];
      const a = addNode(lonA, latA);
      const b = addNode(lonB, latB);
      if (a === b) continue;
      const distanceKm = haversine(latA, lonA, latB, lonB);
      const weight = railRouteEdgeWeight(distanceKm, line, profile, { coordA: [lonA, latA], coordB: [lonB, latB], start, end, directKm });
      graph.get(a).push([b, weight]);
      graph.get(b).push([a, weight]);
    }
  }
  if (graph.size < 2) return [];
  connectNearbyRfnComponents(graph, coordsByKey, directKm);
  if (options.stationJunctions !== false) connectStationRfnJunctions(graph, coordsByKey, start, end, directKm);

  const maxGap = Math.min(14, Math.max(3.5, directKm * 0.18));
  const startAnchors = nearestRfnNodeKeys(coordsByKey, start, { maxDistanceKm: maxGap, maxCount: 24 });
  const endAnchors = nearestRfnNodeKeys(coordsByKey, end, { maxDistanceKm: maxGap, maxCount: 24 });
  if (!startAnchors.length || !endAnchors.length) return [];

  const startKey = '__route_start__';
  const endKey = '__route_end__';
  graph.set(startKey, []);
  graph.set(endKey, []);
  coordsByKey.set(startKey, [start.lon, start.lat]);
  coordsByKey.set(endKey, [end.lon, end.lat]);

  for (const anchor of startAnchors) {
    graph.get(startKey).push([anchor.key, anchor.distance]);
    graph.get(anchor.key)?.push([startKey, anchor.distance]);
  }
  for (const anchor of endAnchors) {
    graph.get(endKey).push([anchor.key, anchor.distance]);
    graph.get(anchor.key)?.push([endKey, anchor.distance]);
  }

  // Ne pas borner artificiellement la recherche pour les longues liaisons.
  // Le RFN complet autour d’un axe comme Paris-Est → Strasbourg dépasse 100 000
  // nœuds dans la boîte de calcul ; l’ancien plafond fixe à 60 000 visites arrêtait
  // Dijkstra avant d’atteindre le terminus, puis la création de ligne échouait.
  const maxVisited = Math.max(60000, graph.size);
  const heuristicScale = profile === 'highspeed' ? 0.32 : 0.98;
  const ids = dijkstraWeightedGraph(graph, startKey, endKey, maxVisited, coordsByKey, heuristicScale);
  if (ids.length < 2) return [];
  const path = ids
    .filter(id => id !== startKey && id !== endKey)
    .map(id => coordsByKey.get(id))
    .filter(Boolean);
  const distance = polylineDistanceKm([[start.lon, start.lat], ...path, [end.lon, end.lat]]);
  if (distance <= 0 || distance > Math.max(45, directKm * 4.8)) return [];
  return [[start.lon, start.lat], ...path, [end.lon, end.lat]];
}

function nearestRfnNodeKeys(coordsByKey, point, options = {}) {
  const maxCount = Math.max(1, Number(options.maxCount || 8));
  const maxDistanceKm = Number(options.maxDistanceKm || Infinity);
  const ranked = [];
  for (const [key, [lon, lat]] of coordsByKey.entries()) {
    const distance = haversine(point.lat, point.lon, lat, lon);
    if (!Number.isFinite(distance) || distance > maxDistanceKm) continue;
    ranked.push({ key, distance });
  }
  return ranked.sort((a, b) => a.distance - b.distance).slice(0, maxCount);
}

function nearestRfnNodeKey(coordsByKey, point) {
  return nearestRfnNodeKeys(coordsByKey, point, { maxCount: 1 })[0]?.key || null;
}

function pointToCoordDistance(point, coord) {
  if (!point || !coord) return Infinity;
  return haversine(point.lat, point.lon, coord[1], coord[0]);
}

function dijkstraWeightedGraph(graph, startKey, endKey, maxVisited = 5000, coordsByKey = null, heuristicScale = 0) {
  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const visited = new Set();
  const heap = [[0, startKey]];

  const endCoord = coordsByKey?.get(endKey);
  function heuristic(key) {
    if (!coordsByKey || !endCoord || !Number.isFinite(heuristicScale) || heuristicScale <= 0) return 0;
    const coord = coordsByKey.get(key);
    if (!coord) return 0;
    const distance = haversine(coord[1], coord[0], endCoord[1], endCoord[0]);
    return Number.isFinite(distance) ? distance * heuristicScale : 0;
  }

  function push(item) {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (heap[p][0] <= item[0]) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = item;
  }

  function pop() {
    if (!heap.length) return null;
    const root = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      let i = 0;
      while (true) {
        const left = i * 2 + 1;
        const right = left + 1;
        if (left >= heap.length) break;
        let child = left;
        if (right < heap.length && heap[right][0] < heap[left][0]) child = right;
        if (heap[child][0] >= last[0]) break;
        heap[i] = heap[child];
        i = child;
      }
      heap[i] = last;
    }
    return root;
  }

  while (heap.length && visited.size < Math.min(maxVisited, graph.size)) {
    const currentEntry = pop();
    if (!currentEntry) break;
    const [, current] = currentEntry;
    if (visited.has(current)) continue;
    const best = dist.get(current);
    if (!Number.isFinite(best)) break;
    visited.add(current);
    if (current === endKey) break;

    for (const [next, weight] of graph.get(current) || []) {
      if (visited.has(next)) continue;
      const edgeWeight = Number(weight);
      if (!Number.isFinite(edgeWeight) || edgeWeight <= 0) continue;
      const alt = best + edgeWeight;
      if (alt < (dist.get(next) ?? Infinity)) {
        dist.set(next, alt);
        prev.set(next, current);
        push([alt + heuristic(next), next]);
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

function polylineDistanceKm(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  return total;
}

async function realRailRouteBetweenStops(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.length < 2) return { ids, distance: 0, maxSegment: 0, segments: [], missing: null };

  const pairs = [];
  for (let i = 1; i < ids.length; i += 1) pairs.push({ from: ids[i - 1], to: ids[i] });
  const geometries = isMainThread && getSncfRouteWorkerPool()
    ? await Promise.all(pairs.map(pair => sncfRouteGeometryForStationsFast(pair.from, pair.to)))
    : await (async () => {
        const out = [];
        for (const pair of pairs) out.push(await sncfRouteGeometryForStations(pair.from, pair.to));
        return out;
      })();

  const segments = [];
  let distance = 0;
  let maxSegment = 0;
  for (let i = 0; i < pairs.length; i += 1) {
    const { from, to } = pairs[i];
    const geometry = geometries[i];
    const segmentDistance = polylineDistanceKm(geometry || []);
    if (!Array.isArray(geometry) || geometry.length < 2 || !Number.isFinite(segmentDistance) || segmentDistance <= 0) {
      return {
        ids: [],
        distance: 0,
        maxSegment: 0,
        segments,
        missing: { from, to }
      };
    }
    const rounded = Math.max(1, Math.round(segmentDistance));
    segments.push({ from, to, distance: rounded });
    distance += segmentDistance;
    maxSegment = Math.max(maxSegment, segmentDistance);
  }

  return {
    ids,
    distance: Math.round(distance),
    maxSegment: Math.round(maxSegment),
    segments,
    missing: null
  };
}

