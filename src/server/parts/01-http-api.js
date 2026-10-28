// Routage HTTP/API, réponses JSON et fichiers statiques.
const CLIENT_SCRIPT_PARTS = Object.freeze([
  '00-core-state.js',
  '01-startup-events-auth.js',
  '02-tutorial-layout-overview.js',
  '03-research-lines-foundations.js',
  '04-lines.js',
  '05-fleet-compositions.js',
  '06-stations-staff-research.js',
  '07-resources-budget-market.js',
  '08-actions-modals.js',
  '09-map-rendering.js',
  '10-routing-line-utils.js',
  '11-research-workspace.js'
]);

const CLIENT_STYLE_PARTS = Object.freeze([
  '00-base-layout.css',
  '01-theme-map-ui.css',
  '02-lines-fleet-research.css',
  '03-accounts-budget-admin.css',
  '04-compositions.css',
  '05-bugs-research-overview.css',
  '06-visual-polish.css',
  '07-research-workspace.css'
]);

const STATIC_LONG_CACHE = 'public, max-age=31536000, immutable';
const STATIC_NO_STORE = 'no-store';
const TEXT_STATIC_EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.md']);
const PRECOMPRESSED_STATIC_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.ico', '.gz', '.br']);
const staticBundleCache = new Map();
const staticCompressionCache = new Map();
const staticCompressionPending = new Map();
const staticFileCache = new Map();
const STATIC_CACHE_MAX_BYTES = 16 * 1024 * 1024;

function rememberStaticEntry(cache, key, entry) {
  cache.delete(key);
  if (entry.body.length > STATIC_CACHE_MAX_BYTES) return;
  cache.set(key, entry);
  let bytes = 0;
  for (const value of cache.values()) bytes += value.body.length;
  while (cache.size > 64 || bytes > STATIC_CACHE_MAX_BYTES) {
    const oldest = cache.keys().next().value;
    bytes -= cache.get(oldest).body.length;
    cache.delete(oldest);
  }
}

async function readStaticFile(filePath) {
  const stat = await fs.promises.stat(filePath);
  if (!stat.isFile()) throw httpError(404, 'Not found');
  const signature = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
  const cached = staticFileCache.get(filePath);
  if (cached?.signature === signature) {
    staticFileCache.delete(filePath);
    staticFileCache.set(filePath, cached);
    return cached.body;
  }
  const body = await fs.promises.readFile(filePath);
  rememberStaticEntry(staticFileCache, filePath, { signature, body });
  return body;
}

function fileSignature(files) {
  return files.map(file => {
    const stat = fs.statSync(file);
    return `${file}:${stat.mtimeMs}:${stat.size}`;
  }).join('|');
}

function readClientBundle(kind, dir, names, prelude = '', postlude = '') {
  const files = names.map(name => path.join(dir, name));
  const signature = fileSignature(files);
  const cached = staticBundleCache.get(kind);
  if (cached?.signature === signature) return cached.body;
  const body = [
    prelude,
    ...files.map((file, index) => `\n/* ===== ${names[index]} ===== */\n${fs.readFileSync(file, 'utf8')}`),
    postlude
  ].filter(Boolean).join('\n');
  staticBundleCache.set(kind, { signature, body });
  return body;
}

function clientScriptBundle() {
  return readClientBundle(
    'client-js',
    path.join(PUBLIC_DIR, 'js'),
    CLIENT_SCRIPT_PARTS,
    [
      "'use strict';",
      "function showSillonsClientBootError(error) {",
      "  console.error(error);",
      "  const host = document.getElementById('toastHost') || document.body;",
      "  const div = document.createElement('div');",
      "  div.className = 'toast bad';",
      "  div.textContent = 'Erreur de chargement du client Sillons.';",
      "  host.appendChild(div);",
      "}",
      "window.__sillonsClientBootError = showSillonsClientBootError;"
    ].join('\n'),
    [
      "if (typeof init === 'function') Promise.resolve(init()).then(() => { window.__sillonsFullClientReady = true; document.dispatchEvent(new Event('sillons:client-ready')); }).catch(showSillonsClientBootError);",
      "else showSillonsClientBootError(new Error('Initialisation client absente.'));"
    ].join('\n')
  );
}

function clientStyleBundle() {
  return readClientBundle('client-css', path.join(PUBLIC_DIR, 'css'), CLIENT_STYLE_PARTS);
}

function acceptsContentEncoding(res, encoding) {
  const entries = String(res.__sillonsAcceptEncoding || '').toLowerCase().split(',').map(value => {
    const [name, ...parameters] = value.trim().split(';');
    const quality = parameters.find(parameter => /^\s*q\s*=/.test(parameter));
    return { name: name.trim(), q: quality ? Number(quality.split('=')[1]) : 1 };
  });
  const entry = entries.find(item => item.name === encoding) || entries.find(item => item.name === '*');
  return Boolean(entry && entry.q > 0 && entry.q <= 1);
}

async function compressStaticBody(res, filePath, body) {
  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_STATIC_EXTENSIONS.has(ext) || PRECOMPRESSED_STATIC_EXTENSIONS.has(ext) || body.length < 1024) {
    return { body, encoding: '' };
  }
  const encoding = acceptsContentEncoding(res, 'br') ? 'br' : acceptsContentEncoding(res, 'gzip') ? 'gzip' : '';
  if (!encoding || body.length > STATIC_CACHE_MAX_BYTES) return { body, encoding: '' };
  const cacheKey = `${encoding}:${filePath}:${crypto.createHash('sha256').update(body).digest('hex')}`;
  const cached = staticCompressionCache.get(cacheKey);
  if (cached) {
    staticCompressionCache.delete(cacheKey);
    staticCompressionCache.set(cacheKey, cached);
    return { body: cached.body, encoding };
  }
  if (!staticCompressionPending.has(cacheKey)) {
    if (staticCompressionPending.size >= 16) return { body, encoding: '' };
    const pending = new Promise(resolve => {
      const finish = (error, compressed) => {
        if (error) return resolve({ body, encoding: '' });
        rememberStaticEntry(staticCompressionCache, cacheKey, { body: compressed });
        resolve({ body: compressed, encoding });
      };
      if (encoding === 'br') zlib.brotliCompress(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }, finish);
      else zlib.gzip(body, { level: 6 }, finish);
    }).finally(() => staticCompressionPending.delete(cacheKey));
    staticCompressionPending.set(cacheKey, pending);
  }
  return staticCompressionPending.get(cacheKey);
}

function staticCacheControl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.js' || ext === '.css') return 'no-cache';
  return ['.png', '.jpg', '.jpeg', '.webp', '.ico', '.js', '.css', '.svg', '.pmtiles', '.mvt'].includes(ext)
    ? STATIC_LONG_CACHE
    : STATIC_NO_STORE;
}

function optimizedStaticAssetPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.png') return filePath;
  const jpgPath = filePath.slice(0, -4) + '.jpg';
  if (fs.existsSync(jpgPath)) return jpgPath;
  const optimizedPngPath = filePath.slice(0, -4) + '.opt.png';
  return fs.existsSync(optimizedPngPath) ? optimizedPngPath : filePath;
}

async function sendStaticBody(req, res, filePath, body, cacheControl = staticCacheControl(filePath)) {
  if (res.destroyed || res.writableEnded) return;
  const raw = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  const etag = `W/"${crypto.createHash('sha256').update(raw).digest('hex')}"`;
  const validators = String(req.headers?.['if-none-match'] || '').split(',').map(value => value.trim().replace(/^W\//, ''));
  if (validators.includes('*') || validators.includes(etag.replace(/^W\//, ''))) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': cacheControl, Vary: 'Accept-Encoding' });
    res.end();
    return;
  }
  const compressed = await compressStaticBody(res, filePath, raw);
  if (res.destroyed || res.writableEnded) return;
  const headers = {
    ETag: etag,
    'Content-Type': mimeType(filePath),
    'Cache-Control': cacheControl,
    'Content-Length': compressed.body.length,
    Vary: 'Accept-Encoding',
    'X-Content-Type-Options': 'nosniff'
  };
  if (compressed.encoding) {
    headers['Content-Encoding'] = compressed.encoding;
    headers.Vary = 'Accept-Encoding';
  }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.end(compressed.body);
}

function parseByteRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader || '').trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  let start = match[1] === '' ? NaN : Number(match[1]);
  let end = match[2] === '' ? NaN : Number(match[2]);
  if (!Number.isFinite(start) && Number.isFinite(end)) {
    const suffixLength = Math.max(0, Math.floor(end));
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end)) end = size - 1;
  }
  start = Math.max(0, Math.floor(start));
  end = Math.min(size - 1, Math.floor(end));
  if (start > end || start >= size) return null;
  return { start, end };
}

function sendRangeStaticFile(req, res, filePath, cacheControl = staticCacheControl(filePath)) {
  fs.stat(filePath, (statError, stat) => {
    if (res.destroyed || res.writableEnded) return;
    if (statError || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const size = stat.size;
    const commonHeaders = {
      'Accept-Ranges': 'bytes',
      'Content-Type': mimeType(filePath),
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff'
    };
    const rangeHeader = req.headers.range;
    if (!rangeHeader) {
      res.writeHead(200, { ...commonHeaders, 'Content-Length': size });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      pipeStaticFile(req, res, filePath);
      return;
    }
    const range = parseByteRange(rangeHeader, size);
    if (!range) {
      res.writeHead(416, { ...commonHeaders, 'Content-Range': `bytes */${size}` });
      res.end();
      return;
    }
    const length = range.end - range.start + 1;
    res.writeHead(206, {
      ...commonHeaders,
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      'Content-Length': length
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    pipeStaticFile(req, res, filePath, { start: range.start, end: range.end });
  });
}

function pipeStaticFile(req, res, filePath, options) {
  const stream = fs.createReadStream(filePath, options);
  const close = () => stream.destroy();
  res.once('close', close);
  stream.once('error', error => res.destroy(error));
  stream.once('close', () => res.removeListener('close', close));
  stream.pipe(res);
}

async function handleApi(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/client-boot-metrics') {
    const body = await readBody(req);
    const numeric = (value, max = 60_000) => Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
    lastClientBootMetrics = {
      receivedAt: Date.now(),
      initMs: numeric(body.initMs),
      snapshotMs: numeric(body.snapshotMs),
      snapshotHit: numeric(body.snapshotHit, 1),
      requestMs: numeric(body.requestMs),
      parseMs: numeric(body.parseMs),
      normalizeMs: numeric(body.normalizeMs),
      renderMs: numeric(body.renderMs),
      totalMs: numeric(body.totalMs),
      stateBytes: numeric(body.stateBytes, 100_000_000),
      serverTiming: String(body.serverTiming || '').slice(0, 400)
    };
    try {
      fs.writeFileSync(CLIENT_BOOT_METRICS_FILE, JSON.stringify(lastClientBootMetrics, null, 2));
    } catch (error) {
      console.warn('Écriture des métriques de démarrage impossible:', error.message);
    }
    sendJson(res, 204, {});
    return;
  }

  // Sonde de diagnostic locale, sans données de compte ni de partie.
  if (req.method === 'GET' && url.pathname === '/api/client-boot-metrics') {
    sendJson(res, 200, { ok: true, metrics: lastClientBootMetrics });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    const body = await readBody(req);
    const result = await registerAccount(body, req);
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readBody(req);
    const result = await loginAccount(body, req);
    sendJson(res, result.ok ? 200 : 401, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const auth = authenticateRequest(req, url, {});
    if (auth) {
      recordUserActivity(auth.user, 'logout');
      revokeSession(auth.user, auth.token);
    }
    saveState();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const stateStartedAt = process.hrtime.bigint();
    const auth = authenticateRequest(req, url, {});
    if (Object.keys(state.users || {}).length && !auth) {
      sendJson(res, 401, { ok: false, error: 'Connexion requise.' });
      return;
    }
    const playerId = auth?.user?.playerId || '';
    const includeAdmin = url.searchParams.get('include') === 'admin';
    // Ne bloque jamais l'écran de jeu sur une actualisation réseau des gares.
    // Un cache local, même en cours de rafraîchissement, suffit à construire
    // le monde ; le rafraîchissement se poursuit en arrière-plan.
    if (Object.keys(communeCache.byId || {}).length) {
      ensureCommuneCacheReady(false).catch(error => console.warn('Actualisation des gares différée:', error.message));
    } else {
      await waitForCommuneCache(3500);
    }
    const stationReferencesChanged = sanitizeStateStationReferencesForPublicWorld();
    const includeStatic = url.searchParams.get('compact') !== '1'
      || url.searchParams.get('worldRevision') !== publicWorld().revision;
    const payload = publicState(playerId, auth?.user || null, { includeAdmin, includeStatic });
    const stateBuildMs = Number(process.hrtime.bigint() - stateStartedAt) / 1e6;
    res.setHeader('Server-Timing', `state;dur=${stateBuildMs.toFixed(1)}`);
    sendJson(res, 200, payload);
    // La persistance ne doit pas retenir le premier rendu client : la réponse
    // contient déjà les références nettoyées. L'écriture SQLite suit ensuite.
    if (stationReferencesChanged) setImmediate(saveState);
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


  if (req.method === 'GET' && url.pathname === '/api/sncf/route-geometry') {
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';
    const profile = normalizeRailRouteProfile(url.searchParams.get('profile') || 'default');
    const startedAt = Date.now();
    const geometry = await sncfRouteGeometryForStationsFast(from, to, { profile });
    const speedProfile = await sncfSpeedProfileForGeometry(geometry || []);
    const speedCacheMaxAge = speedProfile?.source === SNCF_RFN_SPEED_DATASET ? 31536000 : 3600;
    sendCachedJson(res, 200, {
      ok: true,
      from,
      to,
      profile,
      geometry,
      speedProfile,
      distance: Math.round(polylineDistanceKm(geometry || [])),
      pointCount: Array.isArray(geometry) ? geometry.length : 0,
      source: geometry?.length ? 'sncf-formes-des-lignes-du-rfn' : 'none',
      speedSource: speedProfile?.source || 'none',
      durationMs: Date.now() - startedAt,
      cacheVersion: SNCF_RFN_ROUTE_CACHE_VERSION,
      speedCacheVersion: SNCF_RFN_SPEED_CACHE_VERSION
    }, speedCacheMaxAge);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/sncf/route-geometry-sequence') {
    const rawStops = url.searchParams.get('stops') || '';
    const stops = rawStops
      .split(/[>,|;,]+/)
      .map(value => value.trim())
      .filter(Boolean);
    const profile = normalizeRailRouteProfile(url.searchParams.get('profile') || 'default');
    const startedAt = Date.now();
    const route = await sncfRouteGeometryForStopSequenceFast(stops, { profile });
    const speedProfile = await sncfSpeedProfileForGeometry(route.geometry || []);
    const speedCacheMaxAge = speedProfile?.source === SNCF_RFN_SPEED_DATASET ? 31536000 : 3600;
    sendCachedJson(res, 200, {
      ok: true,
      stops: route.ids || stops,
      profile,
      geometry: route.geometry || [],
      speedProfile,
      distance: Math.round(polylineDistanceKm(route.geometry || [])),
      pointCount: Array.isArray(route.geometry) ? route.geometry.length : 0,
      chunks: route.chunks || [],
      source: route.geometry?.length ? 'sncf-formes-des-lignes-du-rfn-sequence' : 'none',
      speedSource: speedProfile?.source || 'none',
      durationMs: Date.now() - startedAt,
      cacheVersion: SNCF_RFN_ROUTE_CACHE_VERSION,
      speedCacheVersion: SNCF_RFN_SPEED_CACHE_VERSION
    }, speedCacheMaxAge);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/player') {
    const body = await readBody(req);
    const auth = authenticateRequest(req, url, body);
    if (!isAdminUser(auth?.user)) {
      sendJson(res, 403, { ok: false, error: 'Accès admin refusé.' });
      return;
    }
    const target = adminFindPlayer(body);
    const result = target
      ? await enqueuePlayerAction(target.id, () => adminUpdatePlayer(body, auth.user))
      : fail('Compte joueur introuvable.');
    if (result.ok) recordUserActivity(auth.user, 'admin', 'update-player');
    sendJson(res, result.ok ? 200 : 400, { ...result, state: publicState(auth.user.playerId, auth.user) });
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
    const result = await applyAction(playerId, body.type, body.payload || {});
    if (result.ok && auth?.user) recordUserActivity(auth.user, 'action', String(body.type || 'unknown'));
    const cashDelta = result.cashDelta || 0;
    const includeStatic = body.worldRevision !== publicWorld().revision;
    sendJson(res, result.ok ? 200 : 400, { ...result, cashDelta, state: publicState(playerId, auth?.user || null, { includeStatic }) });
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

async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  let filePath;
  try {
    filePath = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  if (filePath === '/') filePath = '/index.html';
  if (filePath.includes('\0') || filePath.includes('\\') || filePath.includes(':')) throw httpError(400, 'Bad request');
  // Les anciens assistants de connexion locaux ne sont pas des pages publiques.
  if (/(?:^|\/)_[^/]*\.html$/i.test(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const absolute = path.resolve(PUBLIC_DIR, `.${filePath}`);
  const relative = path.relative(PUBLIC_DIR, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (process.env.SILLONS_DYNAMIC_ASSETS === '1' && filePath === '/styles.css') {
    await sendStaticBody(req, res, absolute, clientStyleBundle());
    return;
  }
  if (process.env.SILLONS_DYNAMIC_ASSETS === '1' && filePath === '/app.js') {
    await sendStaticBody(req, res, absolute, clientScriptBundle());
    return;
  }
  if (path.extname(absolute).toLowerCase() === '.pmtiles') {
    sendRangeStaticFile(req, res, absolute);
    return;
  }
  const responsePath = optimizedStaticAssetPath(absolute);
  let data;
  try {
    data = await readStaticFile(responsePath);
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code) && error.statusCode !== 404) throw error;
    if (!res.destroyed && !res.writableEnded) { res.writeHead(404); res.end('Not found'); }
    return;
  }
  const cacheControl = url.searchParams.get('v') === PROJECT_VERSION
    ? STATIC_LONG_CACHE : staticCacheControl(responsePath);
  await sendStaticBody(req, res, responsePath, data, cacheControl);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      bytes += chunk.length;
      if (bytes > API_JSON_BODY_LIMIT) {
        tooLarge = true;
        chunks.length = 0;
        reject(httpError(413, 'Payload trop volumineux.'));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => {
      if (tooLarge) return;
      try {
        const data = Buffer.concat(chunks).toString('utf8');
        const parsed = data ? JSON.parse(data) : {};
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Objet JSON attendu.');
        resolve(parsed);
      } catch {
        reject(httpError(400, 'JSON invalide.'));
      }
    });
    req.on('error', reject);
    req.on('aborted', () => reject(httpError(400, 'Requête interrompue.')));
  });
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendJson(res, status, payload) {
  const startedAt = process.hrtime.bigint();
  const raw = Buffer.from(JSON.stringify(payload));
  const stringifyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  const encoding = raw.length < 1024 || status === 204 ? ''
    : acceptsContentEncoding(res, 'br') ? 'br'
    : acceptsContentEncoding(res, 'gzip') ? 'gzip' : '';
  const compressionStartedAt = process.hrtime.bigint();
  const finish = (error, compressed) => {
    if (res.destroyed || res.writableEnded) return;
    const actualEncoding = error ? '' : encoding;
    const body = actualEncoding ? compressed : raw;
    const existingTiming = String(res.getHeader('Server-Timing') || '');
    const compressionMs = Number(process.hrtime.bigint() - compressionStartedAt) / 1e6;
    res.setHeader('Server-Timing', `${existingTiming}${existingTiming ? ', ' : ''}json;dur=${stringifyMs.toFixed(1)}${actualEncoding ? `, ${actualEncoding};dur=${compressionMs.toFixed(1)}` : ''}`);
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      Vary: 'Accept-Encoding',
      'X-Content-Type-Options': 'nosniff'
    };
    if (status !== 204) headers['Content-Length'] = body.length;
    if (actualEncoding) headers['Content-Encoding'] = actualEncoding;
    res.writeHead(status, headers);
    res.end(status === 204 ? undefined : body);
  };
  // Le pool natif compresse sans immobiliser la simulation ni les autres joueurs.
  if (encoding === 'br') {
    zlib.brotliCompress(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }, finish);
  } else if (encoding === 'gzip') {
    zlib.gzip(raw, { level: 4 }, finish);
  } else {
    finish(null, raw);
  }
}
