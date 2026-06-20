// Authentification, comptes, tutoriel, bugs et administration.
function sendCachedJson(res, status, payload, maxAgeSeconds = 604800) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': `public, max-age=${Math.max(0, Math.round(maxAgeSeconds))}, immutable`
  });
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
    activityHistory: [],
    createdAt: Date.now(),
    lastLoginAt: null,
    bugReportsReadAt: 0
  };
}


function normalizeLoginHistory(raw, fallbackLastLoginAt = null) {
  const values = Array.isArray(raw) ? raw : [];
  const cleaned = values
    .map(entry => {
      const at = Number(entry?.at ?? entry?.time ?? entry);
      if (!Number.isFinite(at) || at <= 0) return null;
      return {
        at,
        userAgent: cleanOptionalText(entry?.userAgent || '', 140),
        ip: cleanOptionalText(entry?.ip || '', 80)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at);
  const fallback = Number(fallbackLastLoginAt || 0);
  if (!cleaned.length && Number.isFinite(fallback) && fallback > 0) cleaned.push({ at: fallback, userAgent: '', ip: '' });
  return cleaned.slice(-250);
}

function normalizeActivityHistory(raw) {
  const values = Array.isArray(raw) ? raw : [];
  return values
    .map(entry => {
      const at = Number(entry?.at ?? entry?.time ?? entry);
      if (!Number.isFinite(at) || at <= 0) return null;
      const type = cleanOptionalText(entry?.type || entry?.kind || 'session', 40) || 'session';
      const detail = cleanOptionalText(entry?.detail || entry?.action || '', 80);
      return { at, type, detail };
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at)
    .slice(-USER_ACTIVITY_HISTORY_MAX);
}

function recordUserActivity(user, type = 'session', detail = '') {
  if (!user) return;
  const now = Date.now();
  const normalizedType = cleanOptionalText(type, 40) || 'session';
  const normalizedDetail = cleanOptionalText(detail, 80);
  const history = normalizeActivityHistory(user.activityHistory);
  const last = history[history.length - 1];
  if (normalizedType === 'session' && last?.type === 'session' && now - Number(last.at || 0) < ACTIVITY_HEARTBEAT_INTERVAL_MS) {
    user.activityHistory = history;
    return;
  }
  history.push({ at: now, type: normalizedType, detail: normalizedDetail });
  user.activityHistory = history.slice(-USER_ACTIVITY_HISTORY_MAX);
}

function clientIpFromRequest(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req?.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}

function recordUserLogin(user, req = null) {
  if (!user) return;
  user.loginHistory = normalizeLoginHistory(user.loginHistory, user.lastLoginAt);
  user.loginHistory.push({
    at: Date.now(),
    userAgent: cleanOptionalText(req?.headers?.['user-agent'] || '', 140),
    ip: cleanOptionalText(clientIpFromRequest(req), 80)
  });
  user.loginHistory = user.loginHistory.slice(-250);
  user.lastLoginAt = user.loginHistory[user.loginHistory.length - 1]?.at || Date.now();
}

function isAdminUser(user) {
  return String(user?.usernameKey || '').toLowerCase() === ADMIN_USERNAME_KEY;
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
      lastLoginAt: value.lastLoginAt || null,
      loginHistory: normalizeLoginHistory(value.loginHistory, value.lastLoginAt),
      activityHistory: normalizeActivityHistory(value.activityHistory),
      bugReportsReadAt: Number.isFinite(Number(value.bugReportsReadAt)) ? Math.max(0, Number(value.bugReportsReadAt)) : 0
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

function issueSession(user, req = null) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(token);
  user.sessions = user.sessions && typeof user.sessions === 'object' ? user.sessions : {};
  user.sessions[tokenHash] = {
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    expiresAt: Date.now() + AUTH_SESSION_MAX_AGE_MS
  };
  recordUserLogin(user, req);
  recordUserActivity(user, 'login');
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
  return String(bearer || body.authToken || '').trim();
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
    recordUserActivity(user, 'session', url?.pathname || '');
    return { user, token, player: state.players?.[user.playerId] || null };
  }
  return null;
}

function authPayload(user, token) {
  return {
    token,
    username: user.username,
    playerId: user.playerId,
    isAdmin: isAdminUser(user),
    expiresAt: user.sessions?.[sha256(token)]?.expiresAt || null
  };
}


function normalizeBugImage(raw = {}, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanOptionalText(raw.name || `image-${index + 1}.jpg`, 90) || `image-${index + 1}.jpg`;
  const type = cleanOptionalText(raw.type || 'image/jpeg', 40);
  const dataUrl = String(raw.dataUrl || raw.data || '').trim();
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(dataUrl)) return null;
  if (dataUrl.length > BUG_REPORT_MAX_IMAGE_CHARS) return null;
  return {
    id: cleanOptionalText(raw.id || crypto.randomUUID(), 80),
    name,
    type,
    dataUrl,
    size: Math.max(0, Math.round(Number(raw.size || Math.ceil(dataUrl.length * 0.75))))
  };
}

function normalizeBugReports(raw = []) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map(item => {
    if (!item || typeof item !== 'object') return null;
    const id = cleanOptionalText(item.id || crypto.randomUUID(), 80);
    const title = cleanText(item.title || 'Bug signalé', 120);
    const description = cleanText(item.description || item.body || '', 4000);
    const status = item.status === 'closed' ? 'closed' : 'open';
    const images = Array.isArray(item.images)
      ? item.images.map((image, index) => normalizeBugImage(image, index)).filter(Boolean).slice(0, BUG_REPORT_MAX_IMAGES)
      : [];
    return {
      id,
      title,
      description,
      severity: ['low', 'normal', 'high', 'critical'].includes(item.severity) ? item.severity : 'normal',
      status,
      reporterId: cleanOptionalText(item.reporterId || '', 80),
      reporterName: cleanText(item.reporterName || 'Joueur', 80),
      createdAt: Number(item.createdAt || Date.now()),
      createdDay: Math.max(1, Math.round(Number(item.createdDay || 1))),
      closedAt: status === 'closed' ? Number(item.closedAt || Date.now()) : null,
      closedBy: status === 'closed' ? cleanOptionalText(item.closedBy || '', 80) : '',
      closedByName: status === 'closed' ? cleanText(item.closedByName || '', 80) : '',
      resolution: status === 'closed' ? cleanText(item.resolution || 'Réglé', 500) : '',
      images
    };
  }).filter(Boolean)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, BUG_REPORT_MAX_STORED);
}

function publicBugReports(authUser = null) {
  state.bugReports = normalizeBugReports(state.bugReports || []);
  const isAdmin = isAdminUser(authUser);
  return state.bugReports.map(bug => ({
    id: bug.id,
    title: bug.title,
    description: bug.description,
    severity: bug.severity,
    status: bug.status,
    reporterName: bug.reporterName,
    createdAt: bug.createdAt,
    createdDay: bug.createdDay,
    closedAt: bug.closedAt,
    closedByName: bug.closedByName,
    resolution: bug.resolution,
    images: bug.images,
    canClose: isAdmin && bug.status !== 'closed'
  }));
}

function latestBugReportCreatedAt() {
  return normalizeBugReports(state.bugReports || [])
    .reduce((max, bug) => Math.max(max, Number(bug.createdAt || 0) || 0), 0);
}

function unreadBugReportCountForUser(user = null) {
  if (!isAdminUser(user)) return 0;
  const readAt = Number.isFinite(Number(user.bugReportsReadAt)) ? Math.max(0, Number(user.bugReportsReadAt)) : 0;
  return normalizeBugReports(state.bugReports || [])
    .filter(bug => bug.status !== 'closed' && (Number(bug.createdAt || 0) || 0) > readAt)
    .length;
}

function notifyAdminBugReport(report, reporterPlayer) {
  for (const user of Object.values(state.users || {})) {
    if (!isAdminUser(user)) continue;
    const adminPlayer = state.players?.[user.playerId];
    if (!adminPlayer) continue;
    notify(adminPlayer, `Nouveau bug signalé par ${reporterPlayer?.name || report.reporterName || 'un joueur'} : ${report.title}`);
  }
}

function actionSubmitBugReport(player, payload = {}) {
  const title = cleanText(payload.title || '', 120);
  const description = cleanText(payload.description || '', 4000);
  if (title.length < 4) return fail('Titre trop court.', 'Indique un titre de bug suffisamment explicite.');
  if (description.length < 10) return fail('Description trop courte.', 'Décris ce que tu as fait, ce qui s’est produit et ce qui était attendu.');
  const images = Array.isArray(payload.images)
    ? payload.images.map((image, index) => normalizeBugImage(image, index)).filter(Boolean).slice(0, BUG_REPORT_MAX_IMAGES)
    : [];
  if (Array.isArray(payload.images) && payload.images.length && !images.length) {
    return fail('Image refusée.', 'Formats acceptés : PNG, JPEG ou WebP, avec une taille raisonnable.');
  }
  const report = {
    id: crypto.randomUUID(),
    title,
    description,
    severity: ['low', 'normal', 'high', 'critical'].includes(payload.severity) ? payload.severity : 'normal',
    status: 'open',
    reporterId: player.id,
    reporterName: player.name,
    createdAt: Date.now(),
    createdDay: state.day,
    closedAt: null,
    closedBy: '',
    closedByName: '',
    resolution: '',
    images
  };
  state.bugReports = normalizeBugReports([report, ...(state.bugReports || [])]);
  notify(player, 'Bug signalé : Il apparaît maintenant dans la liste commune des signalements.');
  notifyAdminBugReport(report, player);
  return ok('Bug signalé.');
}

function actionCloseBugReport(player, payload = {}) {
  const user = Object.values(state.users || {}).find(item => item.playerId === player.id);
  if (!isAdminUser(user)) return fail('Accès réservé au compte Xenao.');
  const id = String(payload.id || payload.bugId || '').trim();
  state.bugReports = normalizeBugReports(state.bugReports || []);
  const bug = state.bugReports.find(item => item.id === id);
  if (!bug) return fail('Signalement introuvable.');
  if (bug.status === 'closed') return ok('Signalement déjà clôturé.');
  bug.status = 'closed';
  bug.closedAt = Date.now();
  bug.closedBy = player.id;
  bug.closedByName = player.name;
  bug.resolution = cleanText(payload.resolution || 'Réglé', 500);
  state.bugReports = normalizeBugReports(state.bugReports);
  return ok('Signalement clôturé.');
}

function actionMarkBugReportsRead(player, payload = {}) {
  const user = Object.values(state.users || {}).find(item => item.playerId === player.id);
  if (!isAdminUser(user)) return fail('Accès réservé au compte Xenao.');
  const latest = latestBugReportCreatedAt();
  const requested = Number(payload.readAt || 0);
  user.bugReportsReadAt = Math.max(
    Number(user.bugReportsReadAt || 0) || 0,
    latest,
    Number.isFinite(requested) ? requested : 0
  );
  return ok('Signalements lus.');
}

function createTutorialState(raw = null) {
  const t = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: t.enabled !== false,
    completed: Boolean(t.completed),
    stepId: cleanText(t.stepId || 'welcome', 80),
    actionLog: t.actionLog && typeof t.actionLog === 'object' ? { ...t.actionLog } : {},
    startedAt: Number(t.startedAt || Date.now()),
    updatedAt: Number(t.updatedAt || Date.now())
  };
}

function markTutorialAction(player, key) {
  if (!player || !key) return;
  player.tutorial = createTutorialState(player.tutorial);
  player.tutorial.actionLog[key] = true;
  player.tutorial.updatedAt = Date.now();
}

function actionTutorial(player, payload = {}) {
  player.tutorial = createTutorialState(player.tutorial);
  const op = String(payload.op || '');
  if (op === 'disable') {
    player.tutorial.enabled = false;
    player.tutorial.updatedAt = Date.now();
    return ok('Tutoriel masqué.');
  }
  if (op === 'restart') {
    player.tutorial = createTutorialState({ enabled: true, completed: false, stepId: 'welcome', actionLog: {} });
    return ok('Tutoriel relancé.');
  }
  if (op === 'complete') {
    player.tutorial.completed = true;
    player.tutorial.enabled = false;
    player.tutorial.stepId = 'done';
    player.tutorial.updatedAt = Date.now();
    return ok('Tutoriel terminé.');
  }
  const next = cleanText(payload.stepId || payload.nextStepId || 'welcome', 80);
  player.tutorial.enabled = true;
  player.tutorial.stepId = next;
  player.tutorial.updatedAt = Date.now();
  return ok('Tutoriel mis à jour.');
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

function registerAccount(body = {}, req = null) {
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
  const token = issueSession(user, req);
  state.users[parsed.key] = user;
  saveState();
  return { ok: true, auth: authPayload(user, token), playerId: player.id, state: publicState(player.id, user) };
}

function loginAccount(body = {}, req = null) {
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
  const token = issueSession(user, req);
  saveState();
  return { ok: true, auth: authPayload(user, token), playerId: user.playerId, state: publicState(user.playerId, user) };
}


function sessionIsActive(session, now = Date.now()) {
  return Number(session?.expiresAt || 0) > now && Number(session?.lastSeenAt || 0) >= now - SESSION_ACTIVE_WINDOW_MS;
}

function buildActivityTimeline(players, now = Date.now()) {
  const bucketMs = 60 * 60 * 1000;
  const points = [];
  for (let offset = 23; offset >= 0; offset -= 1) {
    const end = now - offset * bucketMs;
    const start = end - bucketMs;
    let online = 0;
    let activities = 0;
    for (const player of players) {
      const history = player.activityTimeline || [];
      if (history.some(event => Number(event.at || 0) > end - SESSION_ACTIVE_WINDOW_MS && Number(event.at || 0) <= end)) online += 1;
      activities += history.filter(event => Number(event.at || 0) > start && Number(event.at || 0) <= end && event.type !== 'session').length;
    }
    points.push({ at: end, online, activities });
  }
  return points;
}

function buildAdminDashboard() {
  const now = Date.now();
  const usersByPlayer = new Map(Object.values(state.users || {}).map(user => [user.playerId, user]));
  const players = activePlayers().map(player => {
    const user = usersByPlayer.get(player.id) || null;
    const allSessions = Object.values(user?.sessions || {}).filter(session => Number(session.expiresAt || 0) > now);
    const activeSessions = allSessions.filter(session => sessionIsActive(session, now));
    const activityHistory = normalizeActivityHistory(user?.activityHistory);
    const lastActivityAt = Math.max(
      Number(player.lastSeen || 0),
      Number(user?.lastLoginAt || 0),
      ...allSessions.map(session => Number(session.lastSeenAt || 0)),
      ...activityHistory.map(event => Number(event.at || 0))
    );
    return {
      id: player.id,
      name: player.name,
      cash: Math.round(Number(player.cash || 0)),
      debt: Math.round(Number(player.debt || 0)),
      score: Math.round(scorePlayer(player)),
      lines: Array.isArray(player.lines) ? player.lines.length : 0,
      activeLines: Array.isArray(player.lines) ? player.lines.filter(line => line.active).length : 0,
      trains: Array.isArray(player.trains) ? player.trains.length : 0,
      username: user?.username || '',
      usernameKey: user?.usernameKey || '',
      isAdmin: isAdminUser(user),
      createdAt: player.createdAt || null,
      lastSeen: player.lastSeen || null,
      lastLoginAt: user?.lastLoginAt || null,
      lastActivityAt: lastActivityAt || null,
      online: activeSessions.length > 0,
      activeSessions: activeSessions.length,
      validSessions: allSessions.length,
      sessions: allSessions.map(session => ({
        createdAt: Number(session.createdAt || 0) || null,
        lastSeenAt: Number(session.lastSeenAt || 0) || null,
        expiresAt: Number(session.expiresAt || 0) || null,
        active: sessionIsActive(session, now)
      })).sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0)),
      loginCount: normalizeLoginHistory(user?.loginHistory, user?.lastLoginAt).length,
      loginHistory: normalizeLoginHistory(user?.loginHistory, user?.lastLoginAt).slice(-80).reverse(),
      activityTimeline: activityHistory,
      rawPlayer: player
    };
  }).sort((a, b) => (Number(b.online) - Number(a.online)) || (b.isAdmin - a.isAdmin) || String(a.name).localeCompare(String(b.name), 'fr'));

  const activityEvents = players.flatMap(player => (player.activityTimeline || []).map(event => ({
    ...event,
    playerId: player.id,
    playerName: player.name,
    username: player.username,
    online: player.online
  }))).sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
  const recentActivity = activityEvents.slice(0, 80);
  const since = now - 24 * HOUR_MS;
  const activityBreakdown = {};
  for (const event of activityEvents.filter(event => Number(event.at || 0) >= since && event.type !== 'session')) {
    const key = event.type || 'autre';
    activityBreakdown[key] = (activityBreakdown[key] || 0) + 1;
  }
  const onlinePlayers = players.filter(player => player.online);
  const timeline = buildActivityTimeline(players, now);
  for (const player of players) delete player.activityTimeline;
  return {
    players,
    activity: {
      onlineCount: onlinePlayers.length,
      activeSessionCount: onlinePlayers.reduce((sum, player) => sum + player.activeSessions, 0),
      onlinePlayers: onlinePlayers.map(player => ({ id: player.id, name: player.name, username: player.username, activeSessions: player.activeSessions, lastActivityAt: player.lastActivityAt, lines: player.activeLines, trains: player.trains })),
      recentActivity,
      activityBreakdown,
      timeline,
      activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
      generatedAt: now
    },
    bugReports: publicBugReports({ usernameKey: ADMIN_USERNAME_KEY, username: 'Xenao' }),
    openBugs: normalizeBugReports(state.bugReports || []).filter(bug => bug.status !== 'closed').length,
    generatedAt: now
  };
}

function adminFindPlayer(payload = {}) {
  const targetPlayerId = String(payload.targetPlayerId || payload.playerId || '').trim();
  if (targetPlayerId && state.players[targetPlayerId]) return state.players[targetPlayerId];
  const usernameKey = String(payload.usernameKey || payload.username || '').trim().toLowerCase();
  const user = usernameKey ? state.users?.[usernameKey] : null;
  if (user?.playerId && state.players[user.playerId]) return state.players[user.playerId];
  return null;
}

function adminUpdatePlayer(payload = {}, adminUser = null) {
  const target = adminFindPlayer(payload);
  if (!target) return fail('Compte joueur introuvable.');
  const beforeName = target.name;

  if (payload.rawPlayer && typeof payload.rawPlayer === 'object') {
    const replacement = migratePlayer({ ...payload.rawPlayer, id: target.id }, target.id);
    state.players[target.id] = replacement;
  }

  const player = state.players[target.id];
  if (payload.cash !== undefined && payload.cash !== '') {
    const cash = Number(payload.cash);
    if (!Number.isFinite(cash)) return fail('Montant de trésorerie invalide.');
    player.cash = Math.round(cash);
  }
  if (payload.cashDelta !== undefined && payload.cashDelta !== '') {
    const delta = Number(payload.cashDelta);
    if (!Number.isFinite(delta)) return fail('Variation de trésorerie invalide.');
    player.cash = Math.round(Number(player.cash || 0) + delta);
  }
  if (payload.name !== undefined) {
    player.name = cleanText(payload.name || player.name, 28);
  }
  if (payload.color !== undefined) {
    player.color = validateColor(payload.color) || player.color;
  }
  if (payload.reputation !== undefined && payload.reputation !== '') {
    player.reputation = clamp(Number(payload.reputation || 0), 0, 100);
  }

  player.lastSeen = Date.now();
  notify(player, `Modification admin appliquée par ${adminUser?.username || 'admin'}.`);
  state.news.push({ day: state.day, text: `Administration : ${beforeName} a été mis à jour.` });
  state.news = state.news.slice(-60);
  saveState();
  return ok('Modification admin enregistrée.');
}
