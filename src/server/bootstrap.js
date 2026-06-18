'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PARTS_DIR = path.join(__dirname, 'parts');
const SERVER_ENTRY = path.join(ROOT, 'server.js');

function loadServerParts() {
  const partFiles = fs.readdirSync(PARTS_DIR)
    .filter(name => name.endsWith('.js'))
    .sort();
  const prelude = [
    "'use strict';",
    `const require = globalThis.__sillonsRuntimeRequire;`,
    `const __dirname = ${JSON.stringify(ROOT)};`,
    `const __filename = ${JSON.stringify(SERVER_ENTRY)};`,
    ''
  ].join('\n');
  const body = partFiles
    .map(name => `\n// ===== src/server/parts/${name} =====\n${fs.readFileSync(path.join(PARTS_DIR, name), 'utf8')}`)
    .join('\n');
  globalThis.__sillonsRuntimeRequire = require;
  try {
    vm.runInThisContext(prelude + body, { filename: SERVER_ENTRY, displayErrors: true });
  } finally {
    delete globalThis.__sillonsRuntimeRequire;
  }
}

loadServerParts();
