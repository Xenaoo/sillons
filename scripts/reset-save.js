const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, '..', 'data');
for (const name of ['save.sqlite', 'save.sqlite-wal', 'save.sqlite-shm', 'save.json']) {
  const file = path.join(dataDir, name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
console.log('Sauvegarde supprimée.');
