// Routage HTTP/API, réponses JSON et fichiers statiques.
async function handleApi(req, res, url) {
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
    if (auth) revokeSession(auth.user, auth.token);
    saveState();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const auth = authenticateRequest(req, url, {});
    const playerId = auth?.user?.playerId || '';
    await waitForCommuneCache(3500);
    if (sanitizeStateStationReferencesForPublicWorld()) saveState();
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


  if (req.method === 'GET' && url.pathname === '/api/sncf/route-geometry') {
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';
    const profile = normalizeRailRouteProfile(url.searchParams.get('profile') || 'default');
    const startedAt = Date.now();
    const geometry = await sncfRouteGeometryForStationsFast(from, to, { profile });
    sendCachedJson(res, 200, {
      ok: true,
      from,
      to,
      profile,
      geometry,
      distance: Math.round(polylineDistanceKm(geometry || [])),
      pointCount: Array.isArray(geometry) ? geometry.length : 0,
      source: geometry?.length ? 'sncf-formes-des-lignes-du-rfn' : 'none',
      durationMs: Date.now() - startedAt,
      cacheVersion: SNCF_RFN_ROUTE_CACHE_VERSION
    }, 31536000);
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
    sendCachedJson(res, 200, {
      ok: true,
      stops: route.ids || stops,
      profile,
      geometry: route.geometry || [],
      distance: Math.round(polylineDistanceKm(route.geometry || [])),
      pointCount: Array.isArray(route.geometry) ? route.geometry.length : 0,
      chunks: route.chunks || [],
      source: route.geometry?.length ? 'sncf-formes-des-lignes-du-rfn-sequence' : 'none',
      durationMs: Date.now() - startedAt,
      cacheVersion: SNCF_RFN_ROUTE_CACHE_VERSION
    }, 31536000);
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
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

