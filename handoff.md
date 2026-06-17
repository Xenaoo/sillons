# Handoff IA - Projet Sillons

## Resume rapide

Sillons est un jeu navigateur multijoueur de gestion ferroviaire en France. Le projet est volontairement autonome : serveur Node.js natif, frontend HTML/CSS/JS, pas de dependance npm externe. Toute la logique metier est principalement dans `server.js`; toute l'interface et le rendu carte sont dans `public/app.js`.

Etat courant du depot : branche `main`, synchro avec `origin/main`, seul fichier non suivi detecte avant ce handoff : `sillons.rar`.

## Lancement et verification

```bash
npm start
# ou
node server.js
```

URL par defaut : `http://127.0.0.1:3000` ou `http://localhost:3000`.

Commandes utiles :

```bash
npm run check          # node --check server.js && node --check public/app.js
npm run reset          # reset data/save.json via scripts/reset-save.js
npm run check:stations # controle doublons de gares
```

Node requis : `>=18`.

## Fichiers importants

- `server.js` : serveur HTTP natif, API, auth, simulation economique, sauvegarde, migrations, donnees monde, calculs de lignes, recherche, maintenance, energie, admin.
- `public/app.js` : application client, polling `/api/state`, rendu UI complet, carte Leaflet + canvas, formulaires, modales, actions joueur.
- `public/index.html` : squelette DOM et chargement Leaflet depuis CDN.
- `public/styles.css` : toute la presentation.
- `data/save.json` : etat persistant joueurs/comptes/progression. A manipuler avec prudence.
- `data/communes-5000-population.json` : cache de gares/communes enrichi, nom historique mais contient surtout des gares reelles.
- `data/sncf-rfn-lines-cache.json` : cache local des geometries RFN SNCF.
- `changelog.md` : changelog affiche par l'app.
- `scripts/reset-save.js` : reset de sauvegarde.
- `scripts/check-station-duplicates.js` : audit des gares.

## Architecture serveur

Le serveur demarre dans `server.js` :

- constantes projet/version/schema en haut (`PROJECT_VERSION = v64.1.5`, `STATE_SCHEMA_VERSION = 102`);
- `WORLD = buildWorld()`, `BALANCE = buildBalance()`, puis `state = loadOrCreateState()`;
- tick de simulation toutes les `TICK_MS = 2000`;
- sauvegarde automatique toutes les `SAVE_EVERY_TICKS = 15`;
- fichiers statiques servis depuis `public/`;
- sauvegarde sur `SIGINT`.

Routes API principales :

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/state`
- `GET /api/changelog`
- `GET /api/sncf/route-geometry?from=...&to=...`
- `POST /api/admin/player`
- `POST /api/new-player` ancien fallback, desactive si des users existent
- `POST /api/action`
- `GET /api/communes/search?q=...`

Les actions joueur passent par `applyAction(playerId, type, payload)`. Types connus :

`buyTrain`, `duplicateTrain`, `sellTrain`, `repairTrain`, `repairAllTrains`, `updateTrainComposition`, `setMaintenancePolicy`, `createLine`, `assignTrainToLine`, `setTrainLineAssignment`, `closeLine`, `updateLine`, `upgradeStation`, `sellStation`, `createCustomStation`, `hireStaff`, `fireStaff`, `research`, `cancelResearch`, `energyStrategy`, `buyResource`, `setElectricityOrder`, `takeLoan`, `repayLoan`, `rename`, `resetCompany`, `tutorial`.

Compte admin : identifiant normalise `xenao` (`ADMIN_USERNAME_KEY`). L'onglet admin apparait cote client si la session est admin.

## Architecture client

`public/app.js` est un gros fichier global. L'etat client est dans l'objet `app` :

- auth : `authToken`, `playerId`, `authMode`;
- donnees serveur : `state`;
- UI persistante via `localStorage` : onglets, recherche, carte, compositions, collapses;
- carte : `app.map`, canvas, Leaflet, cache de placement et animation;
- creation de ligne : `lineDraft`;
- caches route : `routeCache`, `osmRouteCache`.

Flux principal :

1. `init()` initialise UI, carte, auth, polling.
2. `refreshState()` appelle `/api/state`.
3. `renderAll()` re-render topbar, tabs, panneau courant, carte.
4. Les boutons/formulaires appellent `performAction()` puis `doAction()` vers `POST /api/action`.

Le client duplique certains calculs serveur pour previews UI : couts gares, tickets, recherche, staff, maintenance, composition, etc. Quand une regle metier change cote serveur, chercher le miroir cote client pour eviter des previews incoherentes.

## Donnees externes et caches

Le serveur tente d'utiliser :

- SNCF Open Data `liste-des-gares`;
- SNCF Open Data `formes-des-lignes-du-rfn`;
- data.gouv/tabular API pour populations communales.

Si le reseau est indisponible, les caches dans `data/` permettent de continuer. La creation/modification de lignes repose sur des geometries RFN valides; un segment sans trace exploitable peut etre refuse au lieu de generer une route fictive.

## Points sensibles

- `server.js` et `public/app.js` sont tres volumineux : privilegier des edits chirurgicaux et rechercher les fonctions par nom avec `rg`.
- Eviter de casser `data/save.json`; il contient comptes, hash de mots de passe, sessions, compagnies et progression.
- Toute evolution de schema doit passer par `migrateState()` / `migratePlayer()` et incrementer proprement si necessaire.
- Beaucoup de logique est dupliquee serveur/client pour l'affichage previsionnel. Toujours verifier les deux cotes.
- `README.md` et certains textes affichent des caracteres mal encodes dans la sortie terminal, mais les fichiers semblent utilises en francais par l'app.
- `sillons.rar` est non suivi et lourd; ne pas le committer sans demande explicite.
- Pas de framework ni bundler : pas d'import ES, pas de TypeScript, pas de build step.

## Strategie de travail recommandee

1. Lire `package.json`, puis localiser les fonctions avec `rg`.
2. Pour une regle metier : modifier d'abord `server.js`, puis le miroir client dans `public/app.js`.
3. Pour une UI : modifier `public/app.js`, `public/styles.css`, et verifier dans le navigateur.
4. Lancer `npm run check` apres chaque changement JS.
5. Pour fonctionnalite carte/lignes : tester avec une vraie session, car le rendu depend de `/api/state`, des caches SNCF et du canvas.

## Pistes de reperage rapide

- API : `handleApi`
- Actions : `applyAction`
- Simulation : `simulateTick`, `simulatePlayer`
- Etat public : `publicState`, `publicWorld`
- Creation ligne : `actionCreateLine`, `actionUpdateLine`, `realRailRouteBetweenStops`
- Gares : `actionUpgradeStation`, `actionSellStation`, `stationAcquisitionCost`
- Trains/compositions : `actionBuyTrain`, `actionUpdateTrainComposition`, `compositionSpecForModel`
- Recherche : `buildTechTree`, `actionResearch`, `processResearchProject`
- Client render global : `renderAll`
- Onglets client : `renderOverview`, `renderLines`, `renderFleet`, `renderStations`, `renderStaff`, `renderResearch`, `renderResources`, `renderMarket`, `renderBudget`, `renderAdmin`
- Carte : `initOsmMap`, `drawMap`, `drawAllLines`, `drawStations`, `ensureRailwayRouteGeometry`

