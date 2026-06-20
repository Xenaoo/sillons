# HANDOFF COMPLET — Projet Sillons

Version de référence : **v69.3.1**  
Archive de référence : `sillons-v69-3-1.zip`  
Archive de transmission générée : `sillons-v69-3-1-handoff.zip`  
Date de handoff : 2026-06-20  
But : permettre à une autre IA ou à un développeur de reprendre le projet Sillons sans perdre le contexte, les règles de livraison, l’architecture, les zones fragiles et l’historique récent.

---

## 1. Résumé du projet

**Sillons** est un jeu navigateur multijoueur de gestion ferroviaire en France.

Le joueur crée une compagnie ferroviaire, achète du matériel roulant, crée des lignes, gère les recherches, l’énergie, les gares, les ressources, les employés, la maintenance, les compositions, les sillons, les péages, la concurrence et la progression technologique par ères.

Le projet fonctionne avec :

- un serveur **Node.js** sans dépendance externe lourde ;
- un client **HTML/CSS/JS natif** ;
- une sauvegarde JSON dans `data/save.json` ;
- une carte **Leaflet** ;
- un canvas de rendu maison au-dessus de Leaflet ;
- des données ferroviaires RFN/SNCF pour les tracés ;
- des caches persistants pour accélérer les routes RFN ;
- un modèle interne de capacité de sillons.

---

## 2. État courant v69.3.1

### 2.1 Versions actives

```text
Projet : v69.3.1
Package npm : 69.3.1
Schéma save : 167
Cache serveur RFN : rfn-route-v16
Cache client RFN : sncf-geometry-v17
Cache vitesse RFN : rfn-speed-v1
Modèle capacité sillons : sillon-capacity-v2
```

Emplacements principaux :

```text
src/server/parts/00-config-bootstrap.js
public/js/00-core-state.js
public/app.js
public/index.html
public/styles.css
package.json
package-lock.json
data/save.json
changelog.md
```

### 2.2 Vérifications effectuées pour ce handoff

Commande :

```bash
cd /mnt/data/sillons_handoff_v6931
npm run check
```

Résultat :

```text
OK — syntaxe contrôlée sur 23 fichier(s) JS et 2 bundles reconstitués.
```

Démarrage testé :

```bash
node server.js
```

Résultat observé :

```text
Sillons lancé sur http://127.0.0.1:3000
Workers RFN actifs : 3 thread(s).
Cache RFN SNCF prêt : 1385 géométrie(s).
Cache RFN lignes prêt : 51/51 tracé(s) déjà en cache.
```

Endpoint testé :

```text
http://127.0.0.1:3000/api/state
```

Résultat observé :

```text
OK — 4 joueurs chargés.
```

### 2.3 État de la sauvegarde incluse

`data/save.json` contient actuellement :

```text
version : 167
joueurs : 4
utilisateurs : 4
lignes : 51
lignes actives : 29
matériels roulants : 160
bugReports : 0
customStations : absent
lignes avec sillonModel : 51/51
lignes avec sillon-capacity-v2 : 51/51
lignes avec backgroundUsed non nul : 0/51
lignes où playerCapacity != theoreticalCapacity : 0/51
```

Joueurs présents :

```text
Xenao — 11 lignes
Raphaële — 3 lignes
Déraille & Fils — 29 lignes
Badge Rail — 8 lignes
```

Attention : `data/save.json` contient des comptes, hashes de mots de passe, sels, sessions, historiques de connexion, IPs ou user agents selon les comptes. Ne jamais publier publiquement cette save réelle sans nettoyage.

---

## 3. Règles non négociables de livraison

### 3.1 Versionnage

Le format attendu est strictement :

```text
vXX.YY.ZZ
```

- `XX` : ajout majeur / refonte importante ;
- `YY` : petit ajout ou modification fonctionnelle ;
- `ZZ` : bugfix / correctif ciblé.

Exemples :

```text
v69.3.2  -> bugfix
v69.4.0  -> petit ajout / modification fonctionnelle
v70.0.0  -> refonte majeure
```

Le package npm doit rester **sans `v`** :

```json
"version": "69.3.2"
```

Ne pas incrémenter la version lors d’une simple prise de connaissance ou d’un handoff sans modification fonctionnelle.

### 3.2 Fichiers à mettre à jour à chaque modification livrée

À chaque modification réelle du projet, mettre à jour :

```text
src/server/parts/00-config-bootstrap.js
  PROJECT_VERSION
  STATE_SCHEMA_VERSION
  SNCF_RFN_ROUTE_CACHE_VERSION si moteur RFN modifié
  SNCF_RFN_SPEED_CACHE_VERSION si modèle/cache vitesse modifié
  SILLON_CAPACITY_MODEL_VERSION si modèle sillons modifié

public/js/00-core-state.js
  PROJECT_VERSION
  PERSISTED_OSM_ROUTE_CACHE_VERSION si rendu/calc géométrie ou profil route client modifié

public/app.js
  SILLONS_CLIENT_VERSION

public/index.html
  badge version en bas à droite

public/styles.css
  imports CSS avec ?v=vXX.YY.ZZ

package.json
package-lock.json

data/save.json
  version du schéma

changelog.md
  ajouter une section en haut
```

### 3.3 Vérifications obligatoires avant livraison

Commande minimale :

```bash
npm run check
```

Résultat attendu :

```text
OK — syntaxe contrôlée sur 23 fichier(s) JS et 2 bundles reconstitués.
```

Tester ensuite :

```bash
node server.js
```

Puis vérifier :

```text
http://localhost:3000/api/state
```

Optionnel mais recommandé :

```bash
npm run check:stations
```

Note : `check:stations` signale actuellement 3 doublons connus de gares parisiennes surface/souterrain. Ce n’est pas considéré comme un bug bloquant dans l’état actuel.

### 3.4 Archives

Pour les archives normales de livraison, exclure :

```text
handoff.md
HANDOFF.md
handoff_manifest.json
```

Exception : quand l’utilisateur demande explicitement un handoff, l’archive de transmission peut inclure `HANDOFF.md`.

### 3.5 Format Discord

Après chaque livraison/modification, répondre avec :

- résumé ;
- version ;
- vérifications ;
- lien archive ;
- bloc Discord prêt à copier-coller.

---

## 4. Architecture globale

Le projet a été scindé en fichiers plus petits, mais les fichiers découpés ne sont **pas** de vrais modules isolés. Ils sont concaténés ou exécutés dans un contexte commun pour préserver le comportement historique du monolithe.

Ne pas transformer brutalement ces fichiers en modules ES/CommonJS séparés sans audit complet.

---

## 5. Serveur

### 5.1 Entrée serveur

```text
server.js -> require('./src/server/bootstrap')
```

`src/server/bootstrap.js` lit les fichiers dans `src/server/parts/`, les trie par nom, puis les exécute dans un contexte VM unique.

Ordre serveur :

```text
src/server/parts/00-config-bootstrap.js
src/server/parts/01-http-api.js
src/server/parts/02-auth-bugs-admin.js
src/server/parts/03-rfn-routing.js
src/server/parts/04-state-world-data.js
src/server/parts/05-public-actions.js
src/server/parts/06-simulation-economy.js
src/server/parts/07-fleet-lines-infra.js
src/server/parts/08-balance-world-utils.js
```

### 5.2 Rôle des fichiers serveur

#### `00-config-bootstrap.js`

Contient :

- versions globales ;
- constantes de gameplay ;
- chemins fichiers ;
- données statiques ;
- paramètres RFN ;
- paramètres vitesse RFN ;
- modèle capacité sillons ;
- modèles de trains ;
- recherches ;
- ères ;
- utilitaires globaux de base ;
- warm cache lignes SNCF.

Constantes importantes :

```text
PROJECT_VERSION = 'v69.3.1'
STATE_SCHEMA_VERSION = 167
SNCF_RFN_ROUTE_CACHE_VERSION = 'rfn-route-v16'
SNCF_RFN_SPEED_CACHE_VERSION = 'rfn-speed-v1'
SILLON_CAPACITY_MODEL_VERSION = 'sillon-capacity-v2'
SNCF_RFN_DEFAULT_SPEED_KMH = 100
TRAIN_MODELS
RESEARCH_TREE
ERA_DEFINITIONS
```

#### `01-http-api.js`

Contient :

- serveur HTTP ;
- endpoints API ;
- dispatch des actions ;
- réponses JSON ;
- endpoints RFN ;
- changelog.

Endpoints importants :

```text
/api/state
/api/action
/api/changelog
/api/sncf/route-geometry
/api/sncf/route-geometry-sequence
```

Depuis v69.1.0, les endpoints RFN peuvent renvoyer un `speedProfile`.

#### `02-auth-bugs-admin.js`

Contient :

- authentification ;
- comptes ;
- sessions ;
- création compte ;
- login/logout ;
- menu bugs ;
- signalement de bugs avec images ;
- clôture de bug par Xenao ;
- pastille Bugs pour Xenao.

Fonctions importantes :

```text
actionSubmitBugReport
actionCloseBugReport
actionMarkBugReportsRead
notifyAdminBugReport
unreadBugReportCountForUser
```

#### `03-rfn-routing.js`

Fichier très sensible.

Contient :

- chargement des lignes RFN ;
- index spatial ;
- cache persistant des routes ;
- workers Node.js ;
- calcul des tracés ;
- profils `classic`, `highspeed`, `default` ;
- validation des suites d’arrêts ;
- calcul des profils vitesse RFN ;
- téléchargement/cache du dataset SNCF vitesse ;
- réparation de gaps ;
- préchauffage cache.

Fonctions importantes :

```text
sncfRouteGeometryForStationsFast
sncfRouteGeometryForStopSequenceFast
sncfRouteGeometryForStations
sncfRouteGeometryForStopSequence
realRailRouteBetweenStops
buildPathFromRailShapeLines
filterRfnLinesForRouteCorridor
normalizeRouteGeometryReactive
repairSparseRouteGaps
prewarmExistingLineRouteGeometryCache
routeSpeedProfileForCoords / fonctions vitesse associées
```

Données vitesse :

```text
Dataset : vitesse-maximale-nominale-sur-ligne
Source : SNCF Open Data / Opendatasoft
Cache prévu : data/sncf-rfn-speed-cache.json
Version : rfn-speed-v1
Fallback : vitesse par défaut 100 km/h si l’API/cache vitesse est indisponible.
```

Attention : l’archive v69.3.1 inclut `sncf-rfn-lines-cache.json` et `sncf-rfn-route-cache.json`, mais pas forcément `sncf-rfn-speed-cache.json`. Le serveur sait retomber en fallback si le cache vitesse est absent ou si l’accès réseau est impossible.

#### `04-state-world-data.js`

Contient :

- création d’état initial ;
- migrations de save ;
- nettoyage/normalisation ;
- monde public ;
- gares ;
- joueurs ;
- données exposées au client.

Fonctions importantes :

```text
createState
migrateState
loadState
saveState
publicWorld
normalizeResearchProject
normalizeResearchQueue
```

La migration v69.3.1 doit conserver `data/save.json.version = 167`.

#### `05-public-actions.js`

Contient :

- actions déclenchées par le client ;
- création/modification de lignes ;
- achat train ;
- affectation train ;
- achat/vente gare ;
- recherche ;
- passage d’ère ;
- ressources ;
- notifications.

Fonctions importantes :

```text
actionCreateLine
actionUpdateLine
actionBuyTrain
actionResearch
actionCancelResearch
actionStartEraTransition
refreshPlayerLineStatsNow
```

Les affectations de trains utilisent maintenant la disponibilité des sillons calculée dans `computeLineSillonLimit`.

#### `06-simulation-economy.js`

Contient :

- tick simulation ;
- revenus/dépenses ;
- demande voyageurs/fret ;
- attractivité ;
- énergie ;
- CO₂ ;
- R&D ;
- staff ;
- sillons.

Fonctions importantes :

```text
processResearchProject
startResearchProject
startNextQueuedResearch
computeLineAttractiveness
computeRouteDemand
reserveLineResource
computeLineStaffNeeds
routeProfileForLine
lineWithEffectiveFrequency
```

`lineWithEffectiveFrequency` limite la fréquence effective selon les conducteurs disponibles et les sillons disponibles.

#### `07-fleet-lines-infra.js`

Contient :

- modèles de matériel roulant ;
- compositions ;
- lignes ;
- distances ;
- validation des arrêts ;
- infrastructure ;
- coûts ;
- modèle sillons.

Fonctions importantes :

```text
modelWithEraResearch
createLineInstance
normalizeLineTrainIds
validateLineStops
normalizeLine
lineRouteInfo
computeLineSillonLimit
buildSillonUsage
buildLineSillonModel
segmentSillonCapacityModel
sillonStatsPayload
computeLineInfrastructureCost
```

Modèle sillons actuel :

```text
SILLON_CAPACITY_MODEL_VERSION = 'sillon-capacity-v2'
backgroundUsed = 0
playerCapacity = theoreticalCapacity
lineCapacity = theoreticalCapacity
```

Les joueurs possèdent 100 % de la capacité théorique RFN. Il n’y a plus d’occupation de fond fictive SNCF/TER/TGV/fret/travaux.

Calcul conceptuel actuel :

```text
capacité théorique RFN = capacité totale du tronçon limitant
capacité joueurs = capacité théorique RFN
sillons utilisés par cette ligne = nombre de trains/fréquence demandée de la ligne
sillons utilisés par les autres joueurs = somme des autres lignes passant par le même tronçon
sillons disponibles = capacité théorique RFN - cette ligne - autres joueurs
```

Attention technique : `buildLineSillonModel` contient actuellement deux lignes `backgroundUsed` identiques dans l’objet retourné. C’est redondant et non bloquant, car la seconde écrase la première avec la même valeur. À nettoyer lors d’une future passe si ce fichier est retouché.

#### `08-balance-world-utils.js`

Contient :

- utilitaires géographiques ;
- routing simple historique ;
- équilibrage ;
- calculs génériques ;
- constantes secondaires ;
- aides de recherche ;
- modèles de trains et arbre de recherche.

Fonctions/constantes importantes :

```text
addLocalRouteShortcut
getRouteCache
rememberRouteCache
computedResearchBaseDurationSeconds
TRAIN_MODELS
RESEARCH_TREE
ERA_DEFINITIONS
```

---

## 6. Client

### 6.1 Entrée client

`public/app.js` est un loader minimal.

Il charge séquentiellement les fichiers de `public/js/`, les concatène et injecte un script unique dans la page afin de préserver la portée historique du monolithe.

Ordre client :

```text
public/js/00-core-state.js
public/js/01-startup-events-auth.js
public/js/02-tutorial-layout-overview.js
public/js/03-research-lines-foundations.js
public/js/04-lines.js
public/js/05-fleet-compositions.js
public/js/06-stations-staff-research.js
public/js/07-resources-budget-market.js
public/js/08-actions-modals.js
public/js/09-map-rendering.js
public/js/10-routing-line-utils.js
```

### 6.2 Rôle des fichiers client

#### `00-core-state.js`

Contient :

- version client ;
- état global `app` ;
- constantes UI ;
- fonctions de formatage ;
- canonicalisation noms de gares/lignes ;
- état carte et caches client.

Constantes :

```text
PROJECT_VERSION = 'v69.3.1'
PERSISTED_OSM_ROUTE_CACHE_VERSION = 'sncf-geometry-v17'
```

État carte important :

```text
app.map.navigating
app.map.trainMarkers
app.map.trainMarkerLayer
app.map.trainMarkerJobs
app.map.trainMarkerZoomFrame
```

Certains champs trainMarker sont hérités d’essais précédents d’overlay DOM/Leaflet. L’approche active depuis v69.1.10 est le rendu canvas commun, mais du code dormant reste présent.

#### `01-startup-events-auth.js`

Contient :

- initialisation ;
- login/register/logout ;
- boucle fetch `/api/state` ;
- gestion des ticks ;
- notifications ;
- cache navigateur des tracés ;
- badge Bugs ;
- initialisation Leaflet.

Fonctions importantes :

```text
init
fetchState
hydratePersistedOsmRouteCache
persistOsmRouteCache
syncBugTabBadge
markBugReportsRead
initOsmMap
resetMapCanvasTransform
```

Carte Leaflet actuelle :

```js
zoomAnimation: false
markerZoomAnimation: false
fadeAnimation: false
```

Ces options ont été désactivées après les bugs de téléportation des pastilles pendant les pan/zoom.

#### `02-tutorial-layout-overview.js`

Contient :

- tutoriel ;
- layout principal ;
- menu Vue ;
- score/CO₂ ;
- notifications persistantes ;
- bugs UI ;
- focus ligne carte.

Fonctions importantes :

```text
renderOverview
renderBugs
focusLineOnMap
clearFocusedLine
scoreTooltipClient
```

#### `03-research-lines-foundations.js`

Contient :

- menu R&D ;
- recherche rapide R&D ;
- file d’attente rétractable ;
- timer global file R&D ;
- passage d’ère manuel.

#### `04-lines.js`

Contient :

- menu Lignes ;
- création/modification ;
- aperçu ligne ;
- liste des lignes ;
- panneaux d’analyse ;
- affichage des cartes de lignes.

L’affichage des sillons dans les vignettes doit utiliser les données exposées dans `line.stats.capacity.sillons`.

#### `05-fleet-compositions.js`

Contient :

- menu Parc ;
- Catalogue ;
- Maintenance ;
- Compositions ;
- sélection du matériel ;
- bouton Modifier ;
- filtres modèle/affectation ;
- calcul affichage des sillons disponibles lors de l’affectation.

Fonctions importantes :

```text
routeProfileForLineClient
trainCurrentLine
assignableLinesForTrain
safeAssignableLinesForTrain
lineAvailableSillonsClient
```

#### `06-stations-staff-research.js`

Contient :

- menu Gares ;
- RH/personnel ;
- morceaux liés aux recherches/bonus.

#### `07-resources-budget-market.js`

Contient :

- menu Énergie ;
- budget ;
- marché ;
- tooltip stock à zéro.

#### `08-actions-modals.js`

Contient :

- appels API ;
- modales ;
- changelog ;
- actions utilisateur ;
- messages d’erreur ;
- modale d’achat/affectation de sillons.

#### `09-map-rendering.js`

Fichier client très sensible.

Contient :

- rendu carte canvas ;
- gares ;
- lignes ;
- trains ;
- hitbox ;
- clic sur ligne ;
- clic vide/gare ;
- surbrillance ;
- aperçu de ligne en création ;
- animation des pastilles trains.

Fonctions importantes :

```text
drawMap
drawAllLines
drawLineDraftPreview
drawTrainMarkersOnCanvas
computeTrainMarkerPose
trainGeoPoseAlongCoords
clearTrainMarkerLayer
registerLineHitTarget
hitLineAt
selectMapLine
drawRailLine
```

État actuel des pastilles trains :

- depuis v69.1.10, les pastilles doivent être dessinées dans le **même canvas** que les lignes ;
- `drawMap()` appelle :

```js
const trainDrawQueue = drawAllLines(ctx, lite) || [];
drawStations(ctx, lite);
drawTrainMarkersOnCanvas(ctx, trainDrawQueue, lite);
```

- cela garantit que les pastilles sont dessinées après les lignes et les gares ;
- `drawTrainMarkersOnCanvas()` commence par `clearTrainMarkerLayer()` pour supprimer les anciens overlays DOM/panes ;
- des fonctions d’overlay DOM (`ensureTrainMarkerLayer`, `syncTrainMarkerLayer`, etc.) existent encore mais ne doivent pas être réactivées sans refonte complète ;
- le CSS masque `#sillonsTrainOverlay`, `.sillons-train-overlay`, `.leaflet-sillonsTrainPane-pane`, `.sillons-train-pane`.

Historique important : plusieurs versions intermédiaires ont tenté overlay DOM, pane Leaflet et marqueurs Leaflet. Elles ont provoqué ou n’ont pas réglé les bugs de téléportation/masquage. Le choix courant est de garder lignes + gares + trains dans un seul canvas, avec zoom Leaflet non animé et redessin continu pendant navigation.

#### `10-routing-line-utils.js`

Contient :

- calcul client des routes ;
- fetch RFN ;
- cache client ;
- fallback ;
- construction des arrêts de draft ;
- synchronisation formulaire ligne.

Fonctions importantes :

```text
fetchSncfRouteGeometry
fetchSncfRouteGeometryForStopSequence
ensureOsmRouteGeometryForStops
getRouteForStops
expandVisualRouteEntries
buildLineDraftStops
updateLinePreview
```

Les routes client doivent conserver :

```text
points       -> points écran pour dessin canvas
coords       -> coordonnées géographiques RFN [lon, lat]
speedProfile -> profil vitesse utilisé pour l’animation des trains
```

---

## 7. CSS

`public/styles.css` importe :

```text
public/css/00-base-layout.css?v=v69.3.1
public/css/01-theme-map-ui.css?v=v69.3.1
public/css/02-lines-fleet-research.css?v=v69.3.1
public/css/03-accounts-budget-admin.css?v=v69.3.1
public/css/04-compositions.css?v=v69.3.1
public/css/05-bugs-research-overview.css?v=v69.3.1
```

Lors d’un changement CSS, mettre à jour les query versions dans `public/styles.css`.

Zones CSS récentes et sensibles :

```text
public/css/02-lines-fleet-research.css
  section v69.1.10 : neutralisation transform canvas / masquage overlays trains
  section v69.3.1 : pastille "XX disponible(s)" dans la case Sillons
```

Affichage sillons actuel :

- la case affiche `utilisés / capacité RFN théorique` ;
- une petite pastille en haut à droite affiche `XX disponible(s)` ;
- la pastille CSS utilise `.line-sillon-badge` ;
- si le nombre restant est critique, `.line-sillon-badge.warn` peut être appliqué.

---

## 8. Fonctionnalités actuellement présentes

### 8.1 Comptes

- création compte ;
- connexion ;
- sessions persistantes ;
- mots de passe hashés ;
- compte admin fonctionnel : `Xenao`.

### 8.2 Tutoriel

Le tutoriel ne demande plus d’acheter un train avant d’avoir fait la recherche nécessaire.

### 8.3 Capital initial

Les nouveaux joueurs commencent avec :

```text
1 000 000 €
```

### 8.4 Bugs

Menu `Bugs` :

- tout le monde peut signaler un bug ;
- titre, gravité, description ;
- jusqu’à 3 images jointes ;
- tous les joueurs voient la liste en lecture seule ;
- Xenao peut clôturer ;
- Xenao reçoit une pastille sur le bouton Bugs quand un nouveau bug est déposé.

### 8.5 Notifications persistantes

- onglet déroulant en haut ;
- compteur non lu ;
- date/heure réelle, pas jour de jeu ;
- ouverture = marque comme lu ;
- historique sauvegardé côté serveur.

### 8.6 R&D

- file d’attente rétractable par défaut ;
- timer global de fin de file ;
- recherche rapide dans tout l’arbre ;
- passage d’ère manuel via bouton ;
- passage d’ère bloque toute recherche ;
- aucune recherche ne doit être en cours/file non vide au lancement d’un passage d’ère.

Durées de transition d’ère :

```text
Diesel : 3h
Électrique : 6h
Grande vitesse : 12h
Hydrogène : 24h
Batterie : 36h
Maglev : 48h
```

### 8.7 Matériel roulant / compositions

Les autorails, automotrices, rames, TGV, maglev, etc. sont des unités multiples voyageurs.

Règles :

- voyageurs uniquement ;
- fret à 0 ;
- pas de voitures/wagons ajoutables ;
- ajout d’une rame complète en UM ;
- coût d’ajout = coût du matériel de base ;
- TGV max 2 rames ;
- autorails/automotrices/rames max 3 rames.

Le menu `Parc -> Compositions` :

- clic sur matériel = sélection ;
- bouton Modifier disponible ensuite ;
- filtres modèle possédé ;
- filtres trains libres / ligne spécifique.

### 8.8 Lignes

- création/modification de ligne possible sans acheter les gares traversées/desservies ;
- gares d’autres compagnies utilisables avec péages ;
- lignes cliquables sur la carte ;
- clic ligne = même résultat que clic dans menu Lignes ;
- clic vide ou gare = désélection de ligne ;
- hitbox des gares réduite ;
- aperçu de ligne en création en surbrillance jaune.

### 8.9 Carte

- bouton `Lignes des autres joueurs` explicite ;
- affichage/masquage des lignes des autres joueurs ;
- rendu canvas ;
- sélection/focus ligne ;
- draft de ligne en temps réel ;
- pastilles trains animées selon planning temps réel ;
- zoom Leaflet non animé pour stabiliser le canvas.

### 8.10 Animation des trains

Depuis v69.1.1, les trains ne doivent plus utiliser une vitesse visuelle compressée.

Règles :

- animation en secondes réelles ;
- vitesse calculée par tronçon RFN via `speedProfile` ;
- plafonnement par vitesse du matériel ;
- prise en compte de l’état du train ;
- facteur d’exploitation pour inertie/accélération/freinage ;
- arrêt de 60 secondes dans chaque gare desservie ;
- espacement des trains d’une même ligne sur un cycle aller-retour réel.

Cas de référence utilisateur :

```text
St-Martin-d'Étampes → St-Quentin-en-Yvelines
Durée attendue approximative : 1h50 avec arrêts de 1 min dans les gares desservies.
```

### 8.11 Vue / économie

- tooltips Score ;
- tooltips CO₂ cumulé ;
- résultat d’exploitation sous forme de vignettes ;
- code couleur vert/rouge ;
- tooltips de sources des dépenses ;
- bloc Journal retiré.

### 8.12 Énergie

- menu Énergie indique l’heure de rupture prévue pour les ressources ;
- tooltips haut de page Charbon/Diesel/Électricité indiquent aussi l’heure de stock à zéro.

### 8.13 Gares

- `Paris-Vaugirard` doit s’afficher comme `Paris Montparnasse` ;
- le renommage est forcé côté serveur et côté client.

### 8.14 Sillons

Modèle actuel : `sillon-capacity-v2`.

L’utilisateur a demandé que les joueurs aient la possession complète des sillons. Il ne faut donc pas réintroduire d’occupation de fond fictive.

Affichage attendu dans les vignettes :

```text
Sillons
3/32        [17 disponible(s)]
```

Sens des valeurs :

```text
3  = sillons utilisés par cette ligne
32 = capacité théorique RFN du tronçon limitant
17 disponible(s) = capacité restante après cette ligne + autres lignes de joueurs
```

Tooltip attendu :

- tronçon limitant ;
- capacité RFN totale ;
- capacité possédée par les joueurs ;
- sillons utilisés par cette ligne ;
- sillons utilisés par les autres joueurs ;
- occupation joueurs totale ;
- sillons restants affectables ;
- marge RFN restante ;
- autres lignes utilisatrices détaillées ;
- profil/tags du tronçon.

Ne plus afficher :

```text
Trafic RFN existant estimé
Occupation de fond
backgroundUsed > 0
```

---

## 9. Historique RFN important

Le RFN est le chantier le plus sensible.

### 9.1 Ce qui a été fait

- correction des tracés trop simplifiés entre Étampes et Épinay ;
- distinction profil LGV/classique ;
- correction Paris-Est → Strasbourg ;
- correction partielle Lyon / Part-Dieu ;
- durcissement de la validation en zone dense ;
- cache serveur persistant ;
- workers Node.js ;
- préchauffage des routes existantes ;
- raccords visuels hors RFN fortement réduits/supprimés à partir de v69.0.0 ;
- précision des nœuds RFN portée à 5 décimales ;
- simplification des géométries moins agressive ;
- ajout de profils vitesse RFN.

### 9.2 Points sensibles

Ne pas considérer le fond OpenStreetMap comme source de vérité du moteur RFN. Le moteur ne connaît que les lignes chargées depuis les données SNCF/RFN.

Des cas comme Avignon ou Lyon montrent que :

- le fond de carte peut afficher une voie ;
- le graphe RFN du jeu peut ne pas avoir l’arête correspondante ;
- ou l’avoir mal connectée ;
- le calcul peut alors faire une boucle ou un tout droit.

La séparation importante est :

```text
rendu visuel ≠ validation gameplay stricte
```

Les raccords hors RFN ne doivent pas revenir comme raccourcis visuels massifs.

### 9.3 Cas de test RFN connus

Tester régulièrement :

```text
St-Martin-d'Étampes → St-Quentin-en-Yvelines
Étampes → Épinay-sur-Orge
Javel → St-Quentin-en-Yvelines
Paris-Est → Strasbourg-Ville
Collonges-Fontaines → Vénissieux
Sathonay-Rillieux → Vénissieux
Villeneuve-St-Georges → Malesherbes via Orangis-Bois-de-l'Épine
Valence → Avignon-Centre
Nice-St-Roch → Marseille-Blancarde
Lyon-Part-Dieu → Chambéry-Challes-les-Eaux
Creil → Melun
```

### 9.4 Caches RFN

Fichiers :

```text
data/sncf-rfn-lines-cache.json
data/sncf-rfn-route-cache.json
data/sncf-rfn-speed-cache.json  # peut être absent, généré si API vitesse joignable
```

Versions actuelles :

```text
route serveur : rfn-route-v16
vitesse serveur : rfn-speed-v1
cache client : sncf-geometry-v17
```

Si le moteur RFN change, incrémenter au minimum :

```text
SNCF_RFN_ROUTE_CACHE_VERSION
PERSISTED_OSM_ROUTE_CACHE_VERSION
```

Si le modèle vitesse/profil vitesse change, incrémenter aussi :

```text
SNCF_RFN_SPEED_CACHE_VERSION
PERSISTED_OSM_ROUTE_CACHE_VERSION si le client doit vider ses routes/profils
```

---

## 10. Historique récent des versions majeures/récentes

### v69.0.0 — précision RFN

- suppression des grands raccourcis visuels hors RFN ;
- suppression de corrections locales court-circuitant les boucles par des droites ;
- réduction forte de la distance d’ancrage gare → RFN ;
- granularité RFN portée à 5 décimales ;
- géométries moins simplifiées ;
- cache serveur RFN `rfn-route-v16` ;
- cache client `sncf-geometry-v15`.

### v69.1.0 / v69.1.1 — vitesses et animation temps réel

- ajout dataset SNCF `vitesse-maximale-nominale-sur-ligne` ;
- ajout `speedProfile` dans les endpoints RFN ;
- correction du déplacement pour ne plus utiliser la compression `18 secondes écran = 1 heure` ;
- arrêt de 60 secondes dans chaque gare ;
- déplacement selon vitesse tronçon + matériel + état.

### v69.1.2 à v69.1.10 — pastilles trains / pan / zoom

Plusieurs approches ont été testées :

- second passage canvas ;
- verrouillage canvas pendant pan ;
- gestion scale zoom ;
- couche HTML dédiée ;
- vrais marqueurs Leaflet ;
- overlay DOM corrigé ;
- retour au canvas commun.

État final retenu en v69.1.10 et toujours présent en v69.3.1 :

- pastilles dessinées dans le même canvas que les lignes ;
- pastilles dessinées après lignes et gares ;
- suppression/masquage des overlays DOM/panes historiques ;
- animations zoom Leaflet désactivées ;
- canvas redessiné avec projection courante pendant pan/zoom.

Attention : il reste du code dormant d’overlay dans `09-map-rendering.js` et du CSS masquant les anciens overlays. Ne pas le réactiver accidentellement.

### v69.2.0 à v69.3.1 — modèle sillons

- création modèle interne de capacité sillons ;
- puis suppression de l’occupation RFN de fond à la demande utilisateur ;
- modèle actuel `sillon-capacity-v2` ;
- joueurs = 100 % de la capacité théorique ;
- vignette sillons = `utilisés / capacité RFN` ;
- pastille haut droite = `XX disponible(s)` ;
- tooltip nettoyé, sans trafic de fond.

---

## 11. Données et sécurité

### 11.1 Fichier de save

```text
data/save.json
```

Contient tout l’état :

- joueurs ;
- utilisateurs ;
- sessions ;
- lignes ;
- trains ;
- recherches ;
- gares ;
- ressources ;
- bugs ;
- notifications ;
- marché ;
- jour/temps de simulation ;
- modèle sillons des lignes.

### 11.2 Données sensibles

La save peut contenir :

- salts ;
- hashes ;
- sessions ;
- historiques de login ;
- user agents ;
- IPs.

Ne pas publier la save réelle publiquement sans nettoyage.

### 11.3 Arrêts personnalisés

Les anciens arrêts personnalisés ont été retirés. Il ne doit plus y avoir de :

```text
customStations
customStation
createCustomStation
creatingCustomStation
Arrêt personnalisé
OSM_[...]
```

Exception : le terme `OSM` peut rester dans un nom de cache OpenStreetMap général côté client selon le contexte. Aucun arrêt personnalisé ne doit revenir dans la save ou les lignes.

Commande de contrôle :

```bash
grep -RIn -E "OSM_[0-9a-f]|Arr[êe]t personnalis[ée]|customStations|customStation|createCustomStation|creatingCustomStation" server.js src public data/save.json
```

---

## 12. Commandes utiles

Démarrer :

```bash
npm start
# ou
node server.js
```

Vérifier syntaxe :

```bash
npm run check
```

Reset save :

```bash
npm run reset
```

Vérifier doublons gares :

```bash
npm run check:stations
```

Chercher versions :

```bash
grep -R "v69.3.1\|69.3.1\|STATE_SCHEMA_VERSION\|SNCF_RFN_ROUTE_CACHE_VERSION\|PERSISTED_OSM_ROUTE_CACHE_VERSION\|SILLON_CAPACITY_MODEL_VERSION" -n . --exclude-dir=node_modules
```

Créer une archive normale sans handoff :

```bash
zip -qr /mnt/data/sillons-vXX-YY-ZZ.zip . \
  -x 'handoff.md' 'HANDOFF.md' 'handoff_manifest.json' \
     './handoff.md' './HANDOFF.md' './handoff_manifest.json'
```

Créer une archive de handoff :

```bash
cp /mnt/data/SILLONS_HANDOFF_vXX.YY.ZZ.md ./HANDOFF.md
zip -qr /mnt/data/sillons-vXX-YY-ZZ-handoff.zip .
```

---

## 13. Procédure recommandée pour toute future demande

1. Partir de la dernière archive livrée : actuellement `sillons-v69-3-1.zip`.
2. Extraire dans un dossier propre.
3. Vérifier la version active.
4. Identifier si la demande est :
   - bugfix ;
   - petit ajout ;
   - refonte majeure.
5. Incrémenter la version selon la règle.
6. Modifier le code en respectant le découpage actuel.
7. Mettre à jour `changelog.md` en haut.
8. Mettre à jour les versions serveur/client/package/badge/save.
9. Incrémenter les caches seulement si nécessaire.
10. Lancer `npm run check`.
11. Tester `node server.js` + `/api/state`.
12. Tester manuellement le flux concerné en navigateur si carte/UI.
13. Créer l’archive.
14. Répondre avec résumé, version, vérifications, lien archive et bloc Discord.

---

## 14. Points de vigilance prioritaires

### 14.1 Carte / pastilles trains

Sujet très fragile.

La carte combine :

- Leaflet pour fond de carte et projection ;
- canvas maison `#map` pour lignes, gares, trains ;
- caches de points écran ;
- routes RFN géographiques `coords` ;
- projection Leaflet `latLngToContainerPoint` ou équivalents internes.

Approche actuelle : un seul canvas pour éviter les référentiels concurrents.

À éviter sans refonte complète :

- réactiver `#sillonsTrainOverlay` ;
- réactiver `sillonsTrainPane` ;
- dessiner les pastilles dans un pane Leaflet sous/sur le canvas sans audit stacking ;
- réactiver `zoomAnimation` Leaflet sans revoir le canvas ;
- mélanger ancienne projection écran et nouvelle projection géographique pendant pan/zoom.

Si un bug de pastilles réapparaît, vérifier d’abord :

```text
public/js/09-map-rendering.js
  drawMap
  drawAllLines
  drawTrainMarkersOnCanvas
  clearTrainMarkerLayer
  computeTrainMarkerPose
  trainGeoPoseAlongCoords

public/js/01-startup-events-auth.js
  initOsmMap
  resetMapCanvasTransform
  événements zoom/move

public/css/02-lines-fleet-research.css
  règles #map
  règles #sillonsTrainOverlay masquées
```

### 14.2 Sillons

L’utilisateur a explicitement demandé :

```text
Les joueurs doivent avoir une possession complète des sillons.
Supprimer la notion d'occupation de fond.
```

Ne pas réintroduire de trafic RFN existant estimé dans les calculs, sauf demande explicite.

### 14.3 RFN

Ne pas réintroduire les anciens raccourcis visuels en ligne droite. Les tracés doivent suivre le RFN autant que possible.

### 14.4 Save réelle

Toujours rappeler que la save contient des données sensibles si l’archive est destinée à être partagée hors environnement privé.

---

## 15. Dernière archive officielle et archive de transmission

Dernière archive officielle de travail :

```text
sillons-v69-3-1.zip
```

Handoff Markdown généré :

```text
SILLONS_HANDOFF_v69.3.1.md
```

Archive de transmission générée :

```text
sillons-v69-3-1-handoff.zip
```

Cette archive de transmission inclut le projet v69.3.1 et `HANDOFF.md` à la racine.
