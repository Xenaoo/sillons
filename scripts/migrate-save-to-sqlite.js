'use strict';

const fs = require('fs');
const path = require('path');
const { createSaveStore } = require('../src/server/persistence-sqlite');

const dataDir = path.join(__dirname, '..', 'data');
const legacyFile = path.join(dataDir, 'save.json');
const databaseFile = path.join(dataDir, 'save.sqlite');

if (!fs.existsSync(legacyFile)) {
  throw new Error(`Sauvegarde JSON introuvable : ${legacyFile}`);
}

const state = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
if (!state || typeof state !== 'object' || !state.players) {
  throw new Error('La sauvegarde JSON ne contient pas de joueurs.');
}

const store = createSaveStore(databaseFile);
try {
  store.write(state);
} finally {
  store.close();
}

console.log(`Sauvegarde SQLite créée : ${databaseFile}`);
