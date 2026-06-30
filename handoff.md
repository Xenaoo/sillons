# Handoff — Sillons

## 1. Objet du projet

Sillons est un jeu navigateur multijoueur de gestion ferroviaire, centré sur la France et le Réseau Ferré National (RFN). Chaque joueur crée une compagnie, achète du matériel roulant, compose des trains, ouvre des lignes voyageurs ou fret, recrute les équipes nécessaires et fait progresser sa compagnie par la recherche.

Le projet est un MVP autonome : il ne dépend ni d’Express ni de Socket.io. Le serveur Node.js conserve l’état partagé, simule l’économie et expose une API HTTP ; le client est une application JavaScript servie depuis `public/`.

## 2. État de référence

- Branche actuelle : `main`.
- Version de code actuelle : `v0.71.13` (package npm : `0.71.13`).
- Schéma de sauvegarde actuel : `190`.
- Runtime requis : Node.js `>= 22.5` pour SQLite natif.
- Persistance principale : `data/save.sqlite`.
- Les modifications R&D v70 sont présentes dans le répertoire de travail et ne sont pas encore commitées au moment de cette rédaction.

## 3. Lancement et vérifications

Depuis la racine du projet :

```powershell
node server.js
```

Le jeu écoute par défaut sur `http://127.0.0.1:3000`.

Scripts disponibles :

```powershell
npm.cmd run check
npm.cmd run check:stations
npm.cmd run migrate:save
npm.cmd run reset
```

Sous PowerShell, utiliser `npm.cmd` plutôt que `npm` si la politique d’exécution bloque `npm.ps1`.

`npm.cmd run check` vérifie la syntaxe des fichiers JS découpés et des bundles reconstitués. Il n’existe pas encore de suite de tests métier automatisée : toute évolution économique ou de migration doit être vérifiée avec une sauvegarde temporaire et un démarrage isolé du serveur.

Variables utiles :

- `PORT` : port HTTP du serveur.
- `HOST` : hôte d’écoute, par défaut `127.0.0.1`.
- `SILLONS_SAVE_DB_FILE` : chemin alternatif de base SQLite, indispensable pour tester une migration sans toucher à `data/save.sqlite`.
- `SILLONS_RFN_WORKERS` : nombre de workers de routage RFN.


### Notes récentes v0.71.x

- Le calcul économique des lignes utilise désormais un modèle réseau cumulatif par couples origine/destination commerciaux.
- Une ligne avec arrêts intermédiaires est découpée en marchés OD : chaque couple de gares desservi est créé une seule fois au niveau réseau.
- Toutes les lignes qui desservent le même couple OD se partagent ce marché selon leur attractivité ; les voyageurs et tonnes transportés ne sont plus additionnés plusieurs fois sur les tronçons/gares communs.
- La demande voyageurs OD est normalisée par budget de gare pour éviter qu’une gare commune génère une demande illimitée quand plusieurs lignes se superposent.
- `Demande voy. / an` et `Demande fret / an` restent des valeurs structurelles stables : les facteurs dynamiques `state.market.demand`, `state.market.freight` et événements temporaires agissent sur le potentiel économique effectif, pas sur ces champs affichés.
- `handoff.md` doit rester dans l’archive de travail actuelle.
- Les changements v0.71.01 à v0.71.11 concernent surtout le cycle achat/fabrication des trains, les bâtiments de maintenance, les maintenances globales, les annulations et les corrections visuelles de `Parc`.
- v0.71.12 sort les tuiles OpenStreetMap du chemin critique de chargement : Leaflet et le canvas s'initialisent immediatement, puis le fond OSM externe est ajoute apres `load`.
- v0.71.13 force la peinture du shell connecte avant le chargement complet et differe le premier rendu lourd de la carte apres F5.

## 4. Architecture

### Serveur

`server.js` charge `src/server/bootstrap.js`. Le bootstrap concatène les fichiers `src/server/parts/` dans un unique contexte `vm`, en ordre lexical. Les fonctions peuvent donc être partagées entre fichiers, mais les initialisations top-level restent sensibles à l’ordre de chargement.

| Fichier | Responsabilité |
|---|---|
| `00-config-bootstrap.js` | Configuration globale, constantes, SQLite, monde et démarrage HTTP. |
| `01-http-api.js` | Routes API, authentification de requêtes et fichiers statiques. |
| `02-auth-bugs-admin.js` | Comptes, sessions, tutoriel, signalements et administration. |
| `03-rfn-routing.js` | Chargement RFN, caches, workers et itinéraires réels. |
| `04-state-world-data.js` | Chargement/migration de sauvegarde, normalisation des joueurs et des gares. |
| `05-public-actions.js` | Actions joueur : trains, lignes, gares, personnel, R&D, budget. |
| `06-simulation-economy.js` | Boucle de simulation, ressources, maintenance, économie et R&D. |
| `07-fleet-lines-infra.js` | Modèles de train, compositions, sillons, profils de ligne et notifications. |
| `08-balance-world-utils.js` | Balance, catalogue, arbre R&D, époques et utilitaires globaux. |

### Client

`public/app.js` charge les fichiers de `public/js/` dans l’ordre numérique. Les vues principales sont :

- `02-tutorial-layout-overview.js` : navigation, tutoriel, vue compagnie et finances.
- `04-lines.js` + `10-routing-line-utils.js` : lignes, arrêts, routage et tarifs.
- `05-fleet-compositions.js` : catalogue, parc, compositions et maintenance.
- `06-stations-staff-research.js` : gares, RH, arbre R&D et passages d’ère.
- `07-resources-budget-market.js` : énergie, budget et marché.
- `09-map-rendering.js` : carte, gares, lignes et animations.

Les styles sont découpés dans `public/css/` et agrégés par `public/styles.css`.

## 5. Données et persistance

### Sauvegarde

La sauvegarde est stockée dans SQLite. Le code de persistance est dans `src/server/persistence-sqlite.js`. L’ancien format JSON est migré automatiquement lorsqu’il existe encore.

Tables importantes :

- `players`, `player_tech`, `player_research`, `research_projects`, `research_queue`.
- `trains`, `train_compositions`, `train_maintenance`.
- `lines`, `line_stops`, `line_sillon_models`.
- `player_stations`, `player_staff`, `player_resources`, `player_stats`.

Les propriétés qui ne sont pas des colonnes explicites sont préservées dans `extra_json`. C’est le cas de `researchTreeVersion` et `legacyTechFloor` ajoutés par la migration R&D v2.

Ne pas supprimer `data/save.sqlite` pour tester une migration. Utiliser `SILLONS_SAVE_DB_FILE` avec un fichier temporaire ou `npm.cmd run reset` uniquement lorsqu’une remise à zéro est explicitement voulue.

### Données RFN

Les gares et géométries proviennent de caches locaux et, si nécessaire, de SNCF Open Data / data.gouv.fr. La fréquentation voyageurs SNCF 2024 est rapprochée par code UIC et alimente le potentiel voyageurs des lignes ; une hausse de `COMMUNE_CACHE_SOURCE_VERSION` force son actualisation. Les lignes jouables doivent suivre des segments RFN validés ; le jeu refuse un itinéraire sans géométrie exploitable plutôt que de générer une voie fictive.

Fichiers de cache principaux :

- `data/communes-5000-population.json` : gares et données associées.
- `data/sncf-rfn-lines-cache.json` : géométries de lignes RFN.
- `data/sncf-rfn-route-cache.json` : itinéraires calculés.
- `data/sncf-rfn-speed-cache.json` : vitesses nominales.
- `data/sillons_train_catalog_v1.json` : catalogue de matériels roulants.

## 6. Boucle de jeu

1. Le joueur lance une recherche de traction.
2. Il achète un train dans le catalogue une fois la recherche requise terminée.
3. Il crée une ligne sur un itinéraire RFN réel et y affecte du matériel.
4. La simulation calcule demande, recettes, personnel, énergie, maintenance, ponctualité et trafic cumulé.
5. Le trafic et la R&D ouvrent progressivement les époques suivantes.

Les services disponibles sont `passengers`, `freight` et `mixed`. Les gares peuvent comporter un niveau, des commerces, un dépôt, un atelier et un statut d’électrification. Les lignes achètent des sillons ; leur fréquence reste plafonnée par la capacité physique du segment RFN le plus contraignant.

## 7. R&D v2 — système en vigueur

L’arbre actif est défini dans `buildTechTree()` de `src/server/parts/08-balance-world-utils.js`.

### Principes

- 118 recherches, réparties sur les sept ères de traction.
- Chaque recherche possède exactement cinq niveaux.
- Coût par niveau : croissance exponentielle × `1.72`.
- Durée par niveau : croissance exponentielle × `1.54`.
- Les premiers niveaux vapeur sont intentionnellement courts et accessibles : première locomotive à 15 k€ et environ 35 secondes.
- Les recherches profondes exigent fréquemment d’autres recherches aux niveaux 2, 3 ou 4 ; elles ne reposent pas uniquement sur des prérequis niveau 1.
- Le niveau 1 donne un déblocage visible ; les niveaux suivants améliorent le système et ouvrent les jalons plus avancés.

### Déblocages réellement appliqués

- Achat de trains depuis le catalogue, via `requiredTech` et `requiredTechLevel`.
- Lignes voyageurs, fret et mixtes.
- Lignes avec arrêts intermédiaires.
- Nombre de sillons voyageurs et fret par ligne.
- Dépôts, ateliers, niveaux de gare et commerces.
- Électrification des lignes.
- Interventions lourdes de maintenance et rénovation complète.
- Variantes de composition voyageurs ou fret déjà présentes dans l’atelier.

Les vérifications côté serveur sont dans `src/server/parts/05-public-actions.js`. Ne jamais se limiter à masquer une action côté client : le serveur doit refuser l’action tant que la recherche est absente.

### Passage d’ère

Une transition d’ère requiert simultanément :

- un total de niveaux technologiques ;
- un trafic cumulé minimal ;
- des jalons structurants précis dans `epochs[].requiredResearch`.

Les transitions sont volontairement longues afin de donner une durée de vie de plusieurs mois :

| Passage | Durée réelle |
|---|---:|
| Vapeur → Diesel | 5 jours |
| Diesel → Électrique | 10 jours |
| Électrique → Grande vitesse | 15 jours |
| Grande vitesse → Hydrogène | 21 jours |
| Hydrogène → Batterie | 30 jours |
| Batterie → Maglev | 45 jours |

Pendant une transition, la R&D est verrouillée mais l’exploitation continue. Les jalons et l’état de progression sont affichés dans l’écran R&D client.

### Migration des compagnies existantes

`migrateResearchTree()` dans `src/server/parts/04-state-world-data.js` assure la compatibilité :

- conversion des identifiants de recherche historiques vers les nœuds v2 ;
- crédit immédiat des recherches en cours et en file vers leur équivalent ;
- conservation des droits requis par les trains, compositions, lignes, gares et électrifications déjà possédés ;
- conservation d’un plancher de bonus de branche avec `legacyTechFloor` ;
- ajout de `researchTreeVersion: 2` pour rendre la migration idempotente.

Point important : les fonctions de migration sont appelées pendant le chargement d’état, avant l’exécution de certaines initialisations top-level des fichiers chargés plus loin. Préférer des fonctions ou constantes locales dans les migrations, et éviter de dépendre d’un `const` top-level qui serait encore dans sa zone morte temporelle.

## 8. Convention de versionnement

À partir de maintenant, la convention fonctionnelle est `0.XX.YY` :

- `XX` : ajout de contenu.
- `YY` : modification de contenu ou correctif.

Utiliser `v0.XX.YY` dans l’interface, l’API et le changelog.

Attention : `package.json` doit rester valide pour npm et SemVer, qui n’accepte pas les zéros non significatifs. Pour une version affichée `v0.01.00`, utiliser `0.1.0` dans `package.json` et `package-lock.json`, tout en conservant l’affichage `v0.01.00` dans le projet.

La première version appliquant cette convention est `v0.70.01`.

Toute version doit être mise à jour de façon cohérente dans :

- `src/server/parts/00-config-bootstrap.js` (`PROJECT_VERSION`, et schéma si nécessaire) ;
- `public/js/00-core-state.js` ;
- `public/index.html` (cache busting CSS/JS et badge) ;
- `public/app.js` (`SILLONS_CLIENT_VERSION`, cache des modules client) ;
- `package.json` et `package-lock.json` ;
- `changelog.md` ;
- ce fichier si une convention ou un état de reprise change.

## 9. Règles de modification

- Utiliser `apply_patch` pour éditer les fichiers.
- Préserver les changements existants du répertoire de travail qui ne concernent pas la demande.
- Ne pas utiliser `git reset --hard` ni `git checkout --` sans demande explicite.
- Avant une migration de sauvegarde, démarrer le serveur avec `SILLONS_SAVE_DB_FILE` pointant vers un fichier temporaire et vérifier le joueur migré.
- Après un changement JavaScript, exécuter `npm.cmd run check` sous PowerShell.
- Après tout changement d’un déblocage, vérifier le triptyque : interface, validation serveur, effet dans la simulation ou le catalogue.

## 10. Points d’attention techniques

- Le serveur partage l’état de tous les joueurs : toute action modifie `state` puis déclenche une sauvegarde si elle réussit.
- L’administration est réservée au compte `Xenao` dans la configuration actuelle.
- Les stations non possédées peuvent être desservies ; les gares concurrentes impliquent un péage.
- Les ressources sont charbon, diesel, électricité, hydrogène et batterie. Les modèles batterie consomment l’électricité dans la simulation actuelle.
- Le maglev reste représenté comme matériel de fin de progression ; les lignes suivent encore le RFN. Un futur système de corridors maglev indépendants nécessiterait une mécanique de routage et d’infrastructure séparée.
- Le commentaire de l’ancien arbre R&D v1 est conservé dans `08-balance-world-utils.js` comme référence historique, mais l’unique arbre exécuté est v2.

## 11. Checklist avant livraison d’une évolution

- [ ] Version mise à jour selon la convention.
- [ ] Changelog mis à jour.
- [ ] Migration de sauvegarde prévue si des identifiants ou structures persistées changent.
- [ ] Déblocage validé côté serveur, et pas seulement dans l’interface.
- [ ] Catalogue, compositions et sauvegardes existantes vérifiés si une recherche est renommée ou supprimée.
- [ ] `npm.cmd run check` exécuté.
- [ ] Test de démarrage avec une base temporaire effectué pour les changements de serveur ou de migration.
