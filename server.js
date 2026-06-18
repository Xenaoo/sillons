'use strict';

// Point d'entrée serveur minimal.
// Le code métier est découpé dans src/server/parts/* et chargé dans un seul contexte
// afin de conserver strictement le comportement historique du serveur.
require('./src/server/bootstrap');
