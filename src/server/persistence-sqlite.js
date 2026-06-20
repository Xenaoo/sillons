'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS state_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username_key TEXT NOT NULL UNIQUE,
    player_id TEXT,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS users_player_id_idx ON users(player_id);
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    last_seen INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS players_last_seen_idx ON players(last_seen DESC);
  CREATE TABLE IF NOT EXISTS events (position INTEGER PRIMARY KEY, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS news (position INTEGER PRIMARY KEY, day INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS news_day_idx ON news(day DESC);
  CREATE TABLE IF NOT EXISTS bug_reports (position INTEGER PRIMARY KEY, created_at INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx ON bug_reports(created_at DESC);
`;

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function createSaveStore(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const statements = {
    getGlobal: db.prepare("SELECT value FROM state_meta WHERE key = 'global'"),
    getUsers: db.prepare('SELECT payload FROM users ORDER BY rowid'),
    getPlayers: db.prepare('SELECT id, payload FROM players ORDER BY rowid'),
    getEvents: db.prepare('SELECT payload FROM events ORDER BY position'),
    getNews: db.prepare('SELECT payload FROM news ORDER BY position'),
    getBugReports: db.prepare('SELECT payload FROM bug_reports ORDER BY position'),
    insertMeta: db.prepare('INSERT INTO state_meta(key, value) VALUES (?, ?)'),
    insertUser: db.prepare('INSERT INTO users(id, username_key, player_id, payload) VALUES (?, ?, ?, ?)'),
    insertPlayer: db.prepare('INSERT INTO players(id, name, last_seen, payload) VALUES (?, ?, ?, ?)'),
    insertEvent: db.prepare('INSERT INTO events(position, payload) VALUES (?, ?)'),
    insertNews: db.prepare('INSERT INTO news(position, day, payload) VALUES (?, ?, ?)'),
    insertBugReport: db.prepare('INSERT INTO bug_reports(position, created_at, payload) VALUES (?, ?, ?)')
  };

  function read() {
    const globalRow = statements.getGlobal.get();
    if (!globalRow) return null;
    const global = parseJson(globalRow.value, null);
    if (!global || typeof global !== 'object') return null;

    const users = {};
    for (const row of statements.getUsers.all()) {
      const user = parseJson(row.payload, null);
      if (user?.usernameKey) users[user.usernameKey] = user;
    }
    const players = {};
    for (const row of statements.getPlayers.all()) {
      const player = parseJson(row.payload, null);
      if (player) players[row.id] = player;
    }
    return {
      ...global,
      users,
      players,
      events: statements.getEvents.all().map(row => parseJson(row.payload, null)).filter(Boolean),
      news: statements.getNews.all().map(row => parseJson(row.payload, null)).filter(Boolean),
      bugReports: statements.getBugReports.all().map(row => parseJson(row.payload, null)).filter(Boolean)
    };
  }

  function write(state) {
    const global = {
      version: state.version,
      createdAt: state.createdAt,
      now: state.now,
      day: state.day,
      eraYear: state.eraYear,
      tickSpeed: state.tickSpeed,
      market: state.market
    };
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('DELETE FROM state_meta; DELETE FROM users; DELETE FROM players; DELETE FROM events; DELETE FROM news; DELETE FROM bug_reports;');
      statements.insertMeta.run('global', JSON.stringify(global));
      for (const user of Object.values(state.users || {})) {
        if (user?.id && user.usernameKey) statements.insertUser.run(String(user.id), String(user.usernameKey), user.playerId ? String(user.playerId) : null, JSON.stringify(user));
      }
      for (const [id, player] of Object.entries(state.players || {})) {
        if (player) statements.insertPlayer.run(String(id), String(player.name || 'Compagnie'), Number(player.lastSeen || 0), JSON.stringify(player));
      }
      for (const [position, event] of (state.events || []).entries()) statements.insertEvent.run(position, JSON.stringify(event));
      for (const [position, item] of (state.news || []).entries()) statements.insertNews.run(position, Number(item?.day || 0), JSON.stringify(item));
      for (const [position, report] of (state.bugReports || []).entries()) statements.insertBugReport.run(position, Number(report?.createdAt || 0), JSON.stringify(report));
      db.exec('COMMIT');
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return { read, write, close: () => db.close() };
}

module.exports = { createSaveStore };
