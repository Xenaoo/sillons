'use strict';

// Microbenchmarks reproductibles, sans serveur ni accès à la sauvegarde réelle.
// La référence est la version Git HEAD des fonctions modifiées.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const BASE_REF = process.env.SILLONS_BENCH_BASE_REF || 'HEAD';
const baseline = file => execFileSync('git', ['show', `${BASE_REF}:${file}`], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
const current = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function measure(operation, iterations = 7) {
  const blocking = [], total = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = operation(i);
    blocking.push(performance.now() - start);
    await result;
    total.push(performance.now() - start);
  }
  return { blockingMs: +median(blocking).toFixed(2), totalMs: +median(total).toFixed(2) };
}

async function main() {
  const httpFile = 'src/server/parts/01-http-api.js';
  const loadHttp = code => {
    const sandbox = vm.createContext({ fs, path, crypto, zlib, Buffer, process });
    vm.runInContext(code, sandbox);
    return sandbox.compressStaticBody;
  };
  const before = loadHttp(baseline(httpFile));
  const after = loadHttp(current(httpFile));
  const body = fs.readFileSync(path.join(ROOT, 'public/app.min.js'));
  const res = { __sillonsAcceptEncoding: 'br' };
  const compression = {
    bytes: body.length,
    before: await measure(i => before(res, `cold-${i}.js`, body)),
    after: await measure(i => after(res, `cold-${i}.js`, body))
  };
  const authCode = current('src/server/parts/02-auth-bugs-admin.js');
  const auth = vm.createContext({ crypto, Buffer });
  vm.runInContext(authCode, auth);
  const passwords = {
    before: await measure(() => crypto.scryptSync('audit-password', 'salt', 64)),
    after: await measure(() => auth.passwordHash('audit-password', 'salt'))
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sillons-bench-'));
  const moduleBefore = { exports: {} };
  vm.runInNewContext(baseline('src/server/persistence-sqlite.js'), { require, module: moduleBefore, Buffer, console });
  const oldStore = moduleBefore.exports.createSaveStore(path.join(dir, 'before.sqlite'));
  const newStore = require('../src/server/persistence-sqlite').createSaveStore(path.join(dir, 'after.sqlite'));
  let saves;
  try {
    const fixture = {
      version: 190, day: 1, users: {}, market: { coal: 1.1 }, events: [], news: [], bugReports: [],
      players: { a: { id: 'a', name: 'Audit', cash: 1000000,
        trains: Array.from({ length: 200 }, (_, i) => ({ id: `train-${i}`, modelId: 'steam_001_141_r', condition: .95 })),
        lines: Array.from({ length: 40 }, (_, i) => ({ id: `line-${i}`, stops: ['a', 'b'], trainIds: [`train-${i}`], active: true }))
      } }
    };
    saves = { trains: 200, lines: 40,
      before: await measure(i => oldStore.write({ ...fixture, day: i + 1 })),
      after: await measure(i => newStore.write({ ...fixture, day: i + 1 })) };
  } finally {
    oldStore.close(); newStore.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const baseRevision = execFileSync('git', ['rev-parse', BASE_REF], { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim();
  console.log(JSON.stringify({ node: process.version, baseRevision, samples: 7, compression, passwords, saves }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
