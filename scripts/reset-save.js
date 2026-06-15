const fs = require('fs');
const path = require('path');
const save = path.join(__dirname, '..', 'data', 'save.json');
if (fs.existsSync(save)) fs.unlinkSync(save);
console.log('Sauvegarde supprimée.');
