'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const serverPartFiles = fs.readdirSync(path.join(ROOT, 'src/server/parts')).filter(name => name.endsWith('.js')).sort();
const clientPartFiles = fs.readdirSync(path.join(ROOT, 'public/js')).filter(name => name.endsWith('.js')).sort();
const files = [
  'server.js',
  'src/server/bootstrap.js',
  ...serverPartFiles.map(name => `src/server/parts/${name}`),
  'public/app.js',
  ...clientPartFiles.map(name => `public/js/${name}`)
];

function checkFile(file) {
  const result = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(`\n[SYNTAX ERROR] ${file}\n`);
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    return false;
  }
  return true;
}

function checkGenerated(name, source) {
  const file = path.join(os.tmpdir(), `sillons-${name}-${process.pid}.js`);
  fs.writeFileSync(file, source, 'utf8');
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  fs.rmSync(file, { force: true });
  if (result.status !== 0) {
    process.stderr.write(`\n[SYNTAX ERROR] bundle ${name}\n`);
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    return false;
  }
  return true;
}

let ok = true;
for (const file of files) ok = checkFile(file) && ok;

const serverBundle = [
  "'use strict';",
  ...serverPartFiles.map(name => fs.readFileSync(path.join(ROOT, 'src/server/parts', name), 'utf8'))
].join('\n');
ok = checkGenerated('server-bundle', serverBundle) && ok;

const clientBundle = [
  "'use strict';",
  ...clientPartFiles.map(name => fs.readFileSync(path.join(ROOT, 'public/js', name), 'utf8')),
  "if (typeof init === 'function') init();"
].join('\n');
ok = checkGenerated('client-bundle', clientBundle) && ok;

if (!ok) process.exit(1);
console.log(`OK — syntaxe contrôlée sur ${files.length} fichier(s) JS et 2 bundles reconstitués.`);
