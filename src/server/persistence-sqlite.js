'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA_VERSION = 2;
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS schema_info (version INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS game_state (
    id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER, created_at INTEGER, now_at INTEGER,
    day INTEGER, era_year INTEGER, tick_speed INTEGER, extra_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS market_prices (resource_id TEXT PRIMARY KEY, price REAL NOT NULL);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE, player_id TEXT,
    password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER, last_login_at INTEGER,
    bug_reports_read_at INTEGER, fields_json TEXT NOT NULL, extra_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS users_player_id_idx ON users(player_id);
  CREATE TABLE IF NOT EXISTS user_sessions (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL,
    created_at INTEGER, last_seen_at INTEGER, expires_at INTEGER, PRIMARY KEY (user_id, token_hash)
  );
  CREATE INDEX IF NOT EXISTS user_sessions_expiry_idx ON user_sessions(expires_at);
  CREATE TABLE IF NOT EXISTS user_login_history (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, position INTEGER NOT NULL,
    at INTEGER, user_agent TEXT, ip TEXT, payload_json TEXT NOT NULL, PRIMARY KEY (user_id, position)
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, logo TEXT, region TEXT,
    cash REAL, debt REAL, epoch INTEGER, research REAL, maintenance_policy TEXT, reputation REAL, co2 REAL,
    energy_strategy TEXT, created_at INTEGER, last_seen INTEGER, epoch_started_at INTEGER,
    notifications_read_at INTEGER, fields_json TEXT NOT NULL, extra_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS players_last_seen_idx ON players(last_seen DESC);
  CREATE TABLE IF NOT EXISTS player_tech (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, tech_id TEXT NOT NULL, level REAL NOT NULL,
    PRIMARY KEY (player_id, tech_id)
  );
  CREATE TABLE IF NOT EXISTS player_research (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, research_id TEXT NOT NULL, level INTEGER NOT NULL,
    PRIMARY KEY (player_id, research_id)
  );
  CREATE TABLE IF NOT EXISTS research_projects (
    player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE, node_id TEXT NOT NULL, target_level INTEGER,
    remaining_ms REAL, duration_ms REAL, cost_money REAL, operating_cost_accrued REAL, started_at INTEGER, updated_at INTEGER,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS research_queue (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, position INTEGER NOT NULL,
    node_id TEXT, target_level INTEGER, duration_ms REAL, cost_money REAL, queued_at INTEGER, payload_json TEXT NOT NULL,
    PRIMARY KEY (player_id, position)
  );
  CREATE TABLE IF NOT EXISTS player_era_transitions (
    player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE, payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS player_resources (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, resource_id TEXT NOT NULL, value_json TEXT NOT NULL,
    PRIMARY KEY (player_id, resource_id)
  );
  CREATE TABLE IF NOT EXISTS player_staff (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, role_id TEXT NOT NULL, amount REAL NOT NULL,
    PRIMARY KEY (player_id, role_id)
  );
  CREATE TABLE IF NOT EXISTS player_stats (
    player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    passengers REAL, freight_tons REAL, revenue REAL, expenses REAL, profit REAL,
    last_revenue REAL, last_expenses REAL, last_profit REAL, punctuality REAL, satisfaction REAL, market_share REAL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS player_tutorials (
    player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE, enabled INTEGER, completed INTEGER,
    step_id TEXT, started_at INTEGER, updated_at INTEGER, fields_json TEXT NOT NULL, extra_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS player_tutorial_actions (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, action_id TEXT NOT NULL, completed INTEGER NOT NULL,
    PRIMARY KEY (player_id, action_id)
  );

  CREATE TABLE IF NOT EXISTS player_stations (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, station_id TEXT NOT NULL,
    level INTEGER, depot INTEGER, commerce INTEGER, maintenance INTEGER, electrified INTEGER,
    fields_json TEXT NOT NULL, extra_json TEXT NOT NULL DEFAULT '{}', PRIMARY KEY (player_id, station_id)
  );
  CREATE TABLE IF NOT EXISTS trains (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, id TEXT NOT NULL, model_id TEXT,
    owner_id TEXT, condition REAL, age REAL, acquired_day INTEGER, fields_json TEXT NOT NULL,
    extra_json TEXT NOT NULL DEFAULT '{}', PRIMARY KEY (player_id, id)
  );
  CREATE INDEX IF NOT EXISTS trains_model_idx ON trains(model_id);
  CREATE TABLE IF NOT EXISTS train_maintenance (
    player_id TEXT NOT NULL, train_id TEXT NOT NULL, payload_json TEXT NOT NULL,
    PRIMARY KEY (player_id, train_id), FOREIGN KEY (player_id, train_id) REFERENCES trains(player_id, id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS train_compositions (
    player_id TEXT NOT NULL, train_id TEXT NOT NULL, payload_json TEXT NOT NULL,
    PRIMARY KEY (player_id, train_id), FOREIGN KEY (player_id, train_id) REFERENCES trains(player_id, id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lines (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, id TEXT NOT NULL, code TEXT, name TEXT,
    from_station_id TEXT, to_station_id TEXT, train_id TEXT, service TEXT, frequency REAL, ticket_price REAL,
    tariff REAL, active INTEGER, electrified INTEGER, created_day INTEGER, fields_json TEXT NOT NULL,
    extra_json TEXT NOT NULL DEFAULT '{}', PRIMARY KEY (player_id, id)
  );
  CREATE INDEX IF NOT EXISTS lines_endpoints_idx ON lines(from_station_id, to_station_id);
  CREATE TABLE IF NOT EXISTS line_stops (
    player_id TEXT NOT NULL, line_id TEXT NOT NULL, position INTEGER NOT NULL, station_id TEXT NOT NULL,
    PRIMARY KEY (player_id, line_id, position), FOREIGN KEY (player_id, line_id) REFERENCES lines(player_id, id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS line_trains (
    player_id TEXT NOT NULL, line_id TEXT NOT NULL, position INTEGER NOT NULL, train_id TEXT NOT NULL,
    PRIMARY KEY (player_id, line_id, position), FOREIGN KEY (player_id, line_id) REFERENCES lines(player_id, id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS line_stats (
    player_id TEXT NOT NULL, line_id TEXT NOT NULL, payload_json TEXT NOT NULL,
    PRIMARY KEY (player_id, line_id), FOREIGN KEY (player_id, line_id) REFERENCES lines(player_id, id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS line_sillon_models (
    player_id TEXT NOT NULL, line_id TEXT NOT NULL, payload_json TEXT NOT NULL,
    PRIMARY KEY (player_id, line_id), FOREIGN KEY (player_id, line_id) REFERENCES lines(player_id, id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS player_notifications (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, id TEXT NOT NULL, created_at INTEGER,
    text TEXT, position INTEGER NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY (player_id, id)
  );
  CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON player_notifications(created_at DESC);

  CREATE TABLE IF NOT EXISTS events (position INTEGER PRIMARY KEY, kind TEXT, title TEXT, remaining REAL, payload_json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS news (position INTEGER PRIMARY KEY, day INTEGER, text TEXT, payload_json TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS news_day_idx ON news(day DESC);
  CREATE TABLE IF NOT EXISTS bug_reports (
    id TEXT PRIMARY KEY, position INTEGER NOT NULL UNIQUE, title TEXT, description TEXT, severity TEXT, status TEXT,
    reporter_id TEXT, reporter_name TEXT, created_at INTEGER, created_day INTEGER, closed_at INTEGER,
    closed_by TEXT, closed_by_name TEXT, resolution TEXT, extra_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS bug_report_images (
    bug_report_id TEXT NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE, position INTEGER NOT NULL,
    image_data TEXT NOT NULL, PRIMARY KEY (bug_report_id, position)
  );
`;

const PLAYER_FIELDS = [
  ['id', 'id'], ['name', 'name'], ['color', 'color'], ['logo', 'logo'], ['region', 'region'],
  ['cash', 'cash'], ['debt', 'debt'], ['epoch', 'epoch'], ['research', 'research'],
  ['maintenancePolicy', 'maintenance_policy'], ['reputation', 'reputation'], ['co2', 'co2'],
  ['energyStrategy', 'energy_strategy'], ['createdAt', 'created_at'], ['lastSeen', 'last_seen'],
  ['epochStartedAt', 'epoch_started_at'], ['notificationsReadAt', 'notifications_read_at']
];
const USER_FIELDS = [
  ['id', 'id'], ['username', 'username'], ['usernameKey', 'username_key'], ['playerId', 'player_id'],
  ['passwordSalt', 'password_salt'], ['passwordHash', 'password_hash'], ['createdAt', 'created_at'],
  ['lastLoginAt', 'last_login_at'], ['bugReportsReadAt', 'bug_reports_read_at']
];
const TRAIN_FIELDS = [['id', 'id'], ['modelId', 'model_id'], ['ownerId', 'owner_id'], ['condition', 'condition'], ['age', 'age'], ['acquiredDay', 'acquired_day']];
const LINE_FIELDS = [
  ['id', 'id'], ['code', 'code'], ['name', 'name'], ['from', 'from_station_id'], ['to', 'to_station_id'],
  ['trainId', 'train_id'], ['service', 'service'], ['frequency', 'frequency'], ['ticketPrice', 'ticket_price'],
  ['tariff', 'tariff'], ['active', 'active', 'boolean'], ['electrified', 'electrified', 'boolean'], ['createdDay', 'created_day']
];
const STATION_FIELDS = [['level', 'level'], ['depot', 'depot', 'boolean'], ['commerce', 'commerce'], ['maintenance', 'maintenance'], ['electrified', 'electrified', 'boolean']];
const TUTORIAL_FIELDS = [['enabled', 'enabled', 'boolean'], ['completed', 'completed', 'boolean'], ['stepId', 'step_id'], ['startedAt', 'started_at'], ['updatedAt', 'updated_at']];

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function omit(object, keys) {
  const ignored = new Set(keys);
  return Object.fromEntries(Object.entries(object || {}).filter(([key]) => !ignored.has(key)));
}

function fieldNames(object, fields) {
  return fields.map(([key]) => key).filter(key => has(object, key));
}

function fieldValues(object, fields) {
  return fields.map(([key, , kind]) => {
    if (!has(object, key)) return null;
    return kind === 'boolean' ? (object[key] ? 1 : 0) : object[key];
  });
}

function restoreFields(row, fields, extraJson) {
  const result = parseJson(extraJson, {});
  const present = new Set(parseJson(row.fields_json, []));
  for (const [key, column, kind] of fields) {
    if (!present.has(key)) continue;
    result[key] = kind === 'boolean' ? Boolean(row[column]) : row[column];
  }
  return result;
}

function tableExists(db, table) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
}

function readLegacyState(db) {
  if (!tableExists(db, 'state_meta')) return null;
  const global = db.prepare("SELECT value FROM state_meta WHERE key = 'global'").get();
  if (!global) return null;
  const state = parseJson(global.value, null);
  if (!state || typeof state !== 'object') return null;
  const users = {};
  for (const row of db.prepare('SELECT payload FROM users ORDER BY rowid').all()) {
    const user = parseJson(row.payload, null);
    if (user?.usernameKey) users[user.usernameKey] = user;
  }
  const players = {};
  for (const row of db.prepare('SELECT id, payload FROM players ORDER BY rowid').all()) {
    const player = parseJson(row.payload, null);
    if (player) players[row.id] = player;
  }
  return {
    ...state,
    users,
    players,
    events: db.prepare('SELECT payload FROM events ORDER BY position').all().map(row => parseJson(row.payload, null)).filter(Boolean),
    news: db.prepare('SELECT payload FROM news ORDER BY position').all().map(row => parseJson(row.payload, null)).filter(Boolean),
    bugReports: db.prepare('SELECT payload FROM bug_reports ORDER BY position').all().map(row => parseJson(row.payload, null)).filter(Boolean)
  };
}

function renameLegacyTables(db) {
  for (const table of ['state_meta', 'users', 'players', 'events', 'news', 'bug_reports']) {
    if (tableExists(db, table)) db.exec(`ALTER TABLE ${table} RENAME TO legacy_${table}`);
  }
}

function dropLegacyTables(db) {
  for (const table of ['legacy_state_meta', 'legacy_users', 'legacy_players', 'legacy_events', 'legacy_news', 'legacy_bug_reports']) {
    if (tableExists(db, table)) db.exec(`DROP TABLE ${table}`);
  }
}

function createSaveStore(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const isLegacy = tableExists(db, 'players') && tableColumns(db, 'players').includes('payload');
  const legacyState = isLegacy ? readLegacyState(db) : null;
  if (isLegacy) renameLegacyTables(db);
  db.exec(SCHEMA);
  if (!db.prepare('SELECT 1 FROM schema_info').get()) db.prepare('INSERT INTO schema_info(version) VALUES (?)').run(SCHEMA_VERSION);
  else db.prepare('UPDATE schema_info SET version = ?').run(SCHEMA_VERSION);

  const insert = {
    gameState: db.prepare('INSERT INTO game_state(id, version, created_at, now_at, day, era_year, tick_speed, extra_json) VALUES (1, ?, ?, ?, ?, ?, ?, ?)'),
    market: db.prepare('INSERT INTO market_prices(resource_id, price) VALUES (?, ?)'),
    user: db.prepare('INSERT INTO users(id, username, username_key, player_id, password_salt, password_hash, created_at, last_login_at, bug_reports_read_at, fields_json, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    session: db.prepare('INSERT INTO user_sessions(user_id, token_hash, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)'),
    login: db.prepare('INSERT INTO user_login_history(user_id, position, at, user_agent, ip, payload_json) VALUES (?, ?, ?, ?, ?, ?)'),
    player: db.prepare('INSERT INTO players(id, name, color, logo, region, cash, debt, epoch, research, maintenance_policy, reputation, co2, energy_strategy, created_at, last_seen, epoch_started_at, notifications_read_at, fields_json, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    tech: db.prepare('INSERT INTO player_tech(player_id, tech_id, level) VALUES (?, ?, ?)'),
    research: db.prepare('INSERT INTO player_research(player_id, research_id, level) VALUES (?, ?, ?)'),
    project: db.prepare('INSERT INTO research_projects(player_id, node_id, target_level, remaining_ms, duration_ms, cost_money, operating_cost_accrued, started_at, updated_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    queue: db.prepare('INSERT INTO research_queue(player_id, position, node_id, target_level, duration_ms, cost_money, queued_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    transition: db.prepare('INSERT INTO player_era_transitions(player_id, payload_json) VALUES (?, ?)'),
    resource: db.prepare('INSERT INTO player_resources(player_id, resource_id, value_json) VALUES (?, ?, ?)'),
    staff: db.prepare('INSERT INTO player_staff(player_id, role_id, amount) VALUES (?, ?, ?)'),
    stats: db.prepare('INSERT INTO player_stats(player_id, passengers, freight_tons, revenue, expenses, profit, last_revenue, last_expenses, last_profit, punctuality, satisfaction, market_share, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    tutorial: db.prepare('INSERT INTO player_tutorials(player_id, enabled, completed, step_id, started_at, updated_at, fields_json, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    tutorialAction: db.prepare('INSERT INTO player_tutorial_actions(player_id, action_id, completed) VALUES (?, ?, ?)'),
    station: db.prepare('INSERT INTO player_stations(player_id, station_id, level, depot, commerce, maintenance, electrified, fields_json, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    train: db.prepare('INSERT INTO trains(player_id, id, model_id, owner_id, condition, age, acquired_day, fields_json, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    maintenance: db.prepare('INSERT INTO train_maintenance(player_id, train_id, payload_json) VALUES (?, ?, ?)'),
    composition: db.prepare('INSERT INTO train_compositions(player_id, train_id, payload_json) VALUES (?, ?, ?)'),
    line: db.prepare('INSERT INTO lines(player_id, id, code, name, from_station_id, to_station_id, train_id, service, frequency, ticket_price, tariff, active, electrified, created_day, fields_json, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    stop: db.prepare('INSERT INTO line_stops(player_id, line_id, position, station_id) VALUES (?, ?, ?, ?)'),
    lineTrain: db.prepare('INSERT INTO line_trains(player_id, line_id, position, train_id) VALUES (?, ?, ?, ?)'),
    lineStats: db.prepare('INSERT INTO line_stats(player_id, line_id, payload_json) VALUES (?, ?, ?)'),
    sillonModel: db.prepare('INSERT INTO line_sillon_models(player_id, line_id, payload_json) VALUES (?, ?, ?)'),
    notification: db.prepare('INSERT INTO player_notifications(player_id, id, created_at, text, position, payload_json) VALUES (?, ?, ?, ?, ?, ?)'),
    event: db.prepare('INSERT INTO events(position, kind, title, remaining, payload_json) VALUES (?, ?, ?, ?, ?)'),
    news: db.prepare('INSERT INTO news(position, day, text, payload_json) VALUES (?, ?, ?, ?)'),
    bug: db.prepare('INSERT INTO bug_reports(id, position, title, description, severity, status, reporter_id, reporter_name, created_at, created_day, closed_at, closed_by, closed_by_name, resolution, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    bugImage: db.prepare('INSERT INTO bug_report_images(bug_report_id, position, image_data) VALUES (?, ?, ?)')
  };

  function read() {
    const game = db.prepare('SELECT * FROM game_state WHERE id = 1').get();
    if (!game) return null;
    const state = {
      ...parseJson(game.extra_json, {}), version: game.version, createdAt: game.created_at, now: game.now_at,
      day: game.day, eraYear: game.era_year, tickSpeed: game.tick_speed, market: {}, events: [], news: [], bugReports: [], users: {}, players: {}
    };
    for (const row of db.prepare('SELECT * FROM market_prices ORDER BY resource_id').all()) state.market[row.resource_id] = row.price;
    for (const row of db.prepare('SELECT * FROM users ORDER BY username_key').all()) {
      const user = restoreFields(row, USER_FIELDS, row.extra_json);
      user.sessions = {};
      for (const session of db.prepare('SELECT * FROM user_sessions WHERE user_id = ? ORDER BY token_hash').all(row.id)) user.sessions[session.token_hash] = { createdAt: session.created_at, lastSeenAt: session.last_seen_at, expiresAt: session.expires_at };
      user.loginHistory = db.prepare('SELECT payload_json FROM user_login_history WHERE user_id = ? ORDER BY position').all(row.id).map(item => parseJson(item.payload_json, {}));
      state.users[user.usernameKey] = user;
    }
    for (const row of db.prepare('SELECT * FROM players ORDER BY rowid').all()) {
      const player = restoreFields(row, PLAYER_FIELDS, row.extra_json);
      const playerId = row.id;
      player.tech = Object.fromEntries(db.prepare('SELECT tech_id, level FROM player_tech WHERE player_id = ? ORDER BY tech_id').all(playerId).map(item => [item.tech_id, item.level]));
      player.techUnlocked = Object.fromEntries(db.prepare('SELECT research_id, level FROM player_research WHERE player_id = ? ORDER BY research_id').all(playerId).map(item => [item.research_id, item.level]));
      const project = db.prepare('SELECT payload_json FROM research_projects WHERE player_id = ?').get(playerId);
      player.researchProject = project ? parseJson(project.payload_json, null) : null;
      player.researchQueue = db.prepare('SELECT payload_json FROM research_queue WHERE player_id = ? ORDER BY position').all(playerId).map(item => parseJson(item.payload_json, {}));
      const transition = db.prepare('SELECT payload_json FROM player_era_transitions WHERE player_id = ?').get(playerId);
      player.eraTransition = transition ? parseJson(transition.payload_json, null) : null;
      player.resources = Object.fromEntries(db.prepare('SELECT resource_id, value_json FROM player_resources WHERE player_id = ? ORDER BY resource_id').all(playerId).map(item => [item.resource_id, parseJson(item.value_json, null)]));
      player.staff = Object.fromEntries(db.prepare('SELECT role_id, amount FROM player_staff WHERE player_id = ? ORDER BY role_id').all(playerId).map(item => [item.role_id, item.amount]));
      const stats = db.prepare('SELECT payload_json FROM player_stats WHERE player_id = ?').get(playerId);
      player.stats = stats ? parseJson(stats.payload_json, {}) : {};
      const tutorialRow = db.prepare('SELECT * FROM player_tutorials WHERE player_id = ?').get(playerId);
      if (tutorialRow) {
        player.tutorial = restoreFields(tutorialRow, TUTORIAL_FIELDS, tutorialRow.extra_json);
        player.tutorial.actionLog = Object.fromEntries(db.prepare('SELECT action_id, completed FROM player_tutorial_actions WHERE player_id = ? ORDER BY action_id').all(playerId).map(item => [item.action_id, Boolean(item.completed)]));
      }
      player.stations = {};
      for (const station of db.prepare('SELECT * FROM player_stations WHERE player_id = ? ORDER BY station_id').all(playerId)) player.stations[station.station_id] = restoreFields(station, STATION_FIELDS, station.extra_json);
      player.trains = db.prepare('SELECT * FROM trains WHERE player_id = ? ORDER BY rowid').all(playerId).map(trainRow => {
        const train = restoreFields(trainRow, TRAIN_FIELDS, trainRow.extra_json);
        const maintenance = db.prepare('SELECT payload_json FROM train_maintenance WHERE player_id = ? AND train_id = ?').get(playerId, trainRow.id);
        const composition = db.prepare('SELECT payload_json FROM train_compositions WHERE player_id = ? AND train_id = ?').get(playerId, trainRow.id);
        if (maintenance) train.maintenance = parseJson(maintenance.payload_json, null);
        if (composition) train.composition = parseJson(composition.payload_json, null);
        return train;
      });
      player.lines = db.prepare('SELECT * FROM lines WHERE player_id = ? ORDER BY rowid').all(playerId).map(lineRow => {
        const line = restoreFields(lineRow, LINE_FIELDS, lineRow.extra_json);
        line.stops = db.prepare('SELECT station_id FROM line_stops WHERE player_id = ? AND line_id = ? ORDER BY position').all(playerId, lineRow.id).map(item => item.station_id);
        line.trainIds = db.prepare('SELECT train_id FROM line_trains WHERE player_id = ? AND line_id = ? ORDER BY position').all(playerId, lineRow.id).map(item => item.train_id);
        const statsRow = db.prepare('SELECT payload_json FROM line_stats WHERE player_id = ? AND line_id = ?').get(playerId, lineRow.id);
        const sillon = db.prepare('SELECT payload_json FROM line_sillon_models WHERE player_id = ? AND line_id = ?').get(playerId, lineRow.id);
        if (statsRow) line.stats = parseJson(statsRow.payload_json, null);
        if (sillon) line.sillonModel = parseJson(sillon.payload_json, null);
        return line;
      });
      player.notifications = db.prepare('SELECT payload_json FROM player_notifications WHERE player_id = ? ORDER BY position').all(playerId).map(item => parseJson(item.payload_json, {}));
      state.players[playerId] = player;
    }
    state.events = db.prepare('SELECT payload_json FROM events ORDER BY position').all().map(row => parseJson(row.payload_json, {}));
    state.news = db.prepare('SELECT payload_json FROM news ORDER BY position').all().map(row => parseJson(row.payload_json, {}));
    state.bugReports = db.prepare('SELECT * FROM bug_reports ORDER BY position').all().map(row => ({
      ...parseJson(row.extra_json, {}), id: row.id, title: row.title, description: row.description, severity: row.severity,
      status: row.status, reporterId: row.reporter_id, reporterName: row.reporter_name, createdAt: row.created_at,
      createdDay: row.created_day, closedAt: row.closed_at, closedBy: row.closed_by, closedByName: row.closed_by_name,
      resolution: row.resolution,
      images: db.prepare('SELECT image_data FROM bug_report_images WHERE bug_report_id = ? ORDER BY position').all(row.id).map(image => parseJson(image.image_data, image.image_data))
    }));
    return state;
  }

  function write(state) {
    const globalKeys = ['version', 'createdAt', 'now', 'day', 'eraYear', 'tickSpeed', 'market', 'events', 'news', 'bugReports', 'users', 'players'];
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(`DELETE FROM user_sessions; DELETE FROM user_login_history; DELETE FROM users; DELETE FROM player_tech; DELETE FROM player_research; DELETE FROM research_projects; DELETE FROM research_queue; DELETE FROM player_era_transitions; DELETE FROM player_resources; DELETE FROM player_staff; DELETE FROM player_stats; DELETE FROM player_tutorial_actions; DELETE FROM player_tutorials; DELETE FROM player_stations; DELETE FROM train_maintenance; DELETE FROM train_compositions; DELETE FROM trains; DELETE FROM line_stops; DELETE FROM line_trains; DELETE FROM line_stats; DELETE FROM line_sillon_models; DELETE FROM lines; DELETE FROM player_notifications; DELETE FROM players; DELETE FROM market_prices; DELETE FROM events; DELETE FROM news; DELETE FROM bug_report_images; DELETE FROM bug_reports; DELETE FROM game_state;`);
      insert.gameState.run(state.version ?? null, state.createdAt ?? null, state.now ?? null, state.day ?? null, state.eraYear ?? null, state.tickSpeed ?? null, JSON.stringify(omit(state, globalKeys)));
      for (const [resourceId, price] of Object.entries(state.market || {})) insert.market.run(resourceId, Number(price));
      for (const user of Object.values(state.users || {})) {
        if (!user?.id || !user.usernameKey) continue;
        const extra = omit(user, [...USER_FIELDS.map(([key]) => key), 'sessions', 'loginHistory']);
        insert.user.run(...fieldValues(user, USER_FIELDS), JSON.stringify(fieldNames(user, USER_FIELDS)), JSON.stringify(extra));
        for (const [tokenHash, session] of Object.entries(user.sessions || {})) insert.session.run(user.id, tokenHash, session?.createdAt ?? null, session?.lastSeenAt ?? null, session?.expiresAt ?? null);
        for (const [position, login] of (user.loginHistory || []).entries()) insert.login.run(user.id, position, login?.at ?? null, login?.userAgent ?? null, login?.ip ?? null, JSON.stringify(login));
      }
      for (const [playerId, player] of Object.entries(state.players || {})) {
        if (!player) continue;
        const relationKeys = ['tech', 'techUnlocked', 'researchProject', 'researchQueue', 'eraTransition', 'resources', 'staff', 'stats', 'tutorial', 'stations', 'trains', 'lines', 'notifications'];
        insert.player.run(...fieldValues(player, PLAYER_FIELDS), JSON.stringify(fieldNames(player, PLAYER_FIELDS)), JSON.stringify(omit(player, [...PLAYER_FIELDS.map(([key]) => key), ...relationKeys])));
        for (const [techId, level] of Object.entries(player.tech || {})) insert.tech.run(playerId, techId, Number(level));
        for (const [researchId, level] of Object.entries(player.techUnlocked || {})) insert.research.run(playerId, researchId, Number(level));
        if (player.researchProject) {
          const project = player.researchProject;
          insert.project.run(playerId, project.nodeId ?? null, project.targetLevel ?? null, project.remainingMs ?? null, project.durationMs ?? null, project.costMoney ?? null, project.operatingCostAccrued ?? null, project.startedAt ?? null, project.updatedAt ?? null, JSON.stringify(project));
        }
        for (const [position, item] of (player.researchQueue || []).entries()) insert.queue.run(playerId, position, item?.nodeId ?? null, item?.targetLevel ?? null, item?.durationMs ?? null, item?.costMoney ?? null, item?.queuedAt ?? null, JSON.stringify(item));
        if (player.eraTransition) insert.transition.run(playerId, JSON.stringify(player.eraTransition));
        for (const [resourceId, value] of Object.entries(player.resources || {})) insert.resource.run(playerId, resourceId, JSON.stringify(value));
        for (const [roleId, amount] of Object.entries(player.staff || {})) insert.staff.run(playerId, roleId, Number(amount));
        if (player.stats) {
          const stats = player.stats;
          insert.stats.run(playerId, stats.passengers ?? null, stats.freightTons ?? null, stats.revenue ?? null, stats.expenses ?? null, stats.profit ?? null, stats.lastRevenue ?? null, stats.lastExpenses ?? null, stats.lastProfit ?? null, stats.punctuality ?? null, stats.satisfaction ?? null, stats.marketShare ?? null, JSON.stringify(stats));
        }
        if (player.tutorial) {
          const tutorial = player.tutorial;
          insert.tutorial.run(playerId, ...fieldValues(tutorial, TUTORIAL_FIELDS), JSON.stringify(fieldNames(tutorial, TUTORIAL_FIELDS)), JSON.stringify(omit(tutorial, [...TUTORIAL_FIELDS.map(([key]) => key), 'actionLog'])));
          for (const [actionId, completed] of Object.entries(tutorial.actionLog || {})) insert.tutorialAction.run(playerId, actionId, completed ? 1 : 0);
        }
        for (const [stationId, station] of Object.entries(player.stations || {})) insert.station.run(playerId, stationId, ...fieldValues(station, STATION_FIELDS), JSON.stringify(fieldNames(station, STATION_FIELDS)), JSON.stringify(omit(station, STATION_FIELDS.map(([key]) => key))));
        for (const train of player.trains || []) {
          if (!train?.id) continue;
          insert.train.run(playerId, ...fieldValues(train, TRAIN_FIELDS), JSON.stringify(fieldNames(train, TRAIN_FIELDS)), JSON.stringify(omit(train, [...TRAIN_FIELDS.map(([key]) => key), 'maintenance', 'composition'])));
          if (has(train, 'maintenance')) insert.maintenance.run(playerId, train.id, JSON.stringify(train.maintenance));
          if (has(train, 'composition')) insert.composition.run(playerId, train.id, JSON.stringify(train.composition));
        }
        for (const line of player.lines || []) {
          if (!line?.id) continue;
          insert.line.run(playerId, ...fieldValues(line, LINE_FIELDS), JSON.stringify(fieldNames(line, LINE_FIELDS)), JSON.stringify(omit(line, [...LINE_FIELDS.map(([key]) => key), 'stops', 'trainIds', 'stats', 'sillonModel'])));
          for (const [position, stationId] of (line.stops || []).entries()) insert.stop.run(playerId, line.id, position, stationId);
          for (const [position, trainId] of (line.trainIds || []).entries()) insert.lineTrain.run(playerId, line.id, position, trainId);
          if (has(line, 'stats')) insert.lineStats.run(playerId, line.id, JSON.stringify(line.stats));
          if (has(line, 'sillonModel')) insert.sillonModel.run(playerId, line.id, JSON.stringify(line.sillonModel));
        }
        for (const [position, notification] of (player.notifications || []).entries()) {
          const id = notification?.id || `${playerId}:${position}`;
          insert.notification.run(playerId, id, notification?.createdAt ?? null, notification?.text ?? null, position, JSON.stringify(notification));
        }
      }
      for (const [position, event] of (state.events || []).entries()) insert.event.run(position, event?.kind ?? null, event?.title ?? null, event?.remaining ?? null, JSON.stringify(event));
      for (const [position, item] of (state.news || []).entries()) insert.news.run(position, item?.day ?? null, item?.text ?? null, JSON.stringify(item));
      for (const [position, report] of (state.bugReports || []).entries()) {
        const images = report?.images || [];
        const known = ['id', 'title', 'description', 'severity', 'status', 'reporterId', 'reporterName', 'createdAt', 'createdDay', 'closedAt', 'closedBy', 'closedByName', 'resolution', 'images'];
        insert.bug.run(report?.id || `report-${position}`, position, report?.title ?? null, report?.description ?? null, report?.severity ?? null, report?.status ?? null, report?.reporterId ?? null, report?.reporterName ?? null, report?.createdAt ?? null, report?.createdDay ?? null, report?.closedAt ?? null, report?.closedBy ?? null, report?.closedByName ?? null, report?.resolution ?? null, JSON.stringify(omit(report, known)));
        for (const [imagePosition, image] of images.entries()) insert.bugImage.run(report?.id || `report-${position}`, imagePosition, JSON.stringify(image));
      }
      db.exec('COMMIT');
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  if (legacyState) write(legacyState);
  if (db.prepare('SELECT 1 FROM game_state WHERE id = 1').get()) {
    dropLegacyTables(db);
    db.exec(SCHEMA);
  }

  return {
    read,
    write,
    close: () => {
      try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } finally { db.close(); }
    }
  };
}

module.exports = { createSaveStore };
