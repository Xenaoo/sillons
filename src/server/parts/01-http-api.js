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
  '10-routing-line-utils.js'
]);

const CLIENT_STYLE_PARTS = Object.freeze([
  '00-base-layout.css',
  '01-theme-map-ui.css',
  '02-lines-fleet-research.css',
  '03-accounts-budget-admin.css',
  '04-compositions.css',
  '05-bugs-research-overview.css'
]);

const STATIC_LONG_CACHE = 'public, max-age=31536000, immutable';
const STATIC_NO_STORE = 'no-store';
const TEXT_STATIC_EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.md']);
const PRECOMPRESSED_STATIC_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.ico', '.gz', '.br']);
const staticBundleCache = new Map();

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
  const escaped = encoding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|,)\\s*${escaped}(?:;|,|$)`, 'i').test(String(res.__sillonsAcceptEncoding || ''));
}

function compressStaticBody(res, filePath, body) {
  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_STATIC_EXTENSIONS.has(ext) || PRECOMPRESSED_STATIC_EXTENSIONS.has(ext) || body.length < 1024) {
    return { body, encoding: '' };
  }
  if (acceptsContentEncoding(res, 'br') && zlib.brotliCompressSync) {
    return {
      body: zlib.brotliCompressSync(body, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 }
      }),
      encoding: 'br'
    };
  }
  if (acceptsContentEncoding(res, 'gzip')) {
    return { body: zlib.gzipSync(body, { level: 6 }), encoding: 'gzip' };
  }
  return { body, encoding: '' };
}

function staticCacheControl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.ico', '.js', '.css', '.svg'].includes(ext)
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

function sendStaticBody(req, res, filePath, body, cacheControl = staticCacheControl(filePath)) {
  const raw = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  const compressed = compressStaticBody(res, filePath, raw);
  const headers = {
    'Content-Type': mimeType(filePath),
    'Cache-Control': cacheControl,
    'Content-Length': compressed.body.length
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
    const result = registerAccount(body, req);
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readBody(req);
    const result = loginAccount(body, req);
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
    const payload = publicState(playerId, auth?.user || null, { includeAdmin });
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
    const result = adminUpdatePlayer(body || {}, auth.user);
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
    const playerBefore = state.players?.[playerId] || null;
    const cashBefore = Number(playerBefore?.cash);
    const result = await applyAction(playerId, body.type, body.payload || {});
    if (result.ok && auth?.user) recordUserActivity(auth.user, 'action', String(body.type || 'unknown'));
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
  if (filePath === '/styles.css') {
    sendStaticBody(req, res, absolute, clientStyleBundle(), STATIC_LONG_CACHE);
    return;
  }
  if (filePath === '/app.js') {
    sendStaticBody(req, res, absolute, clientScriptBundle(), STATIC_LONG_CACHE);
    return;
  }
  fs.readFile(absolute, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const responsePath = optimizedStaticAssetPath(absolute);
    if (responsePath !== absolute) {
      fs.readFile(responsePath, (optimizedErr, optimizedData) => {
        if (optimizedErr) {
          sendStaticBody(req, res, absolute, data);
          return;
        }
        sendStaticBody(req, res, responsePath, optimizedData);
      });
      return;
    }
    sendStaticBody(req, res, absolute, data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      data += chunk;
      if (data.length > API_JSON_BODY_LIMIT) {
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
  const serializeStartedAt = process.hrtime.bigint();
  const json = JSON.stringify(payload);
  const stringifyMs = Number(process.hrtime.bigint() - serializeStartedAt) / 1e6;
  const acceptsBr = acceptsContentEncoding(res, 'br');
  const acceptsGzip = acceptsContentEncoding(res, 'gzip');
  if (acceptsBr && zlib.brotliCompressSync && json.length >= 1024) {
    const brStartedAt = process.hrtime.bigint();
    const body = zlib.brotliCompressSync(Buffer.from(json), {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 }
    });
    const brMs = Number(process.hrtime.bigint() - brStartedAt) / 1e6;
    const existingTiming = String(res.getHeader('Server-Timing') || '');
    res.setHeader('Server-Timing', `${existingTiming}${existingTiming ? ', ' : ''}json;dur=${stringifyMs.toFixed(1)}, br;dur=${brMs.toFixed(1)}`);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Encoding': 'br',
      'Content-Length': body.length,
      Vary: 'Accept-Encoding'
    });
    res.end(body);
    return;
  }
  if (acceptsGzip) {
    const gzipStartedAt = process.hrtime.bigint();
    const body = zlib.gzipSync(json, { level: 6 });
    const gzipMs = Number(process.hrtime.bigint() - gzipStartedAt) / 1e6;
    const existingTiming = String(res.getHeader('Server-Timing') || '');
    res.setHeader('Server-Timing', `${existingTiming}${existingTiming ? ', ' : ''}json;dur=${stringifyMs.toFixed(1)}, gzip;dur=${gzipMs.toFixed(1)}`);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Encoding': 'gzip',
      'Content-Length': body.length,
      Vary: 'Accept-Encoding'
    });
    res.end(body);
    return;
  }
  const existingTiming = String(res.getHeader('Server-Timing') || '');
  res.setHeader('Server-Timing', `${existingTiming}${existingTiming ? ', ' : ''}json;dur=${stringifyMs.toFixed(1)}`);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Accept-Encoding' });
  res.end(json);
}
