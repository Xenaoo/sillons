const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const sourceUrl = process.argv[2] || process.env.SILLONS_PMTILES_URL;
const outputFile = path.resolve(process.argv[3] || process.env.SILLONS_PMTILES_FILE || path.join('public', 'assets', 'maps', 'world.pmtiles'));

if (!sourceUrl) {
  console.error('Usage: npm.cmd run install:local-map -- <url-pmtiles> [fichier-sortie]');
  process.exit(1);
}

function download(url, destination, redirects = 0) {
  if (redirects > 5) throw new Error('Trop de redirections pendant le telechargement PMTiles.');
  const parsed = new URL(url);
  const client = parsed.protocol === 'http:' ? http : https;
  const tempFile = `${destination}.download`;

  fs.mkdirSync(path.dirname(destination), { recursive: true });

  return new Promise((resolve, reject) => {
    const request = client.get(parsed, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        const next = response.headers.location ? new URL(response.headers.location, parsed).toString() : '';
        if (!next) {
          reject(new Error(`Redirection PMTiles invalide (${response.statusCode}).`));
          return;
        }
        download(next, destination, redirects + 1).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Telechargement PMTiles refuse (${response.statusCode}).`));
        return;
      }

      const total = Number(response.headers['content-length'] || 0);
      let received = 0;
      let lastLog = 0;
      const stream = fs.createWriteStream(tempFile);
      response.on('data', chunk => {
        received += chunk.length;
        if (total && received - lastLog >= 64 * 1024 * 1024) {
          lastLog = received;
          const percent = ((received / total) * 100).toFixed(1);
          process.stdout.write(`\r${percent}% (${Math.round(received / 1024 / 1024)} Mo)`);
        }
      });
      response.pipe(stream);
      stream.on('finish', () => {
        stream.close(() => {
          if (total) process.stdout.write('\n');
          fs.renameSync(tempFile, destination);
          resolve();
        });
      });
      stream.on('error', reject);
    });

    request.on('error', reject);
  }).catch(error => {
    try { fs.rmSync(tempFile, { force: true }); } catch {}
    throw error;
  });
}

download(sourceUrl, outputFile).then(() => {
  console.log(`Carte locale installee : ${outputFile}`);
}).catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
