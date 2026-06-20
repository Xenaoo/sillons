# Sillons — jeu navigateur de gestion ferroviaire multijoueur

Prototype complet jouable, sans dépendance npm externe.

## Lancement

Node.js 22.5 ou plus récent est requis pour le pilote SQLite natif.

```bash
node server.js
```

Puis ouvrir :

```text
http://localhost:3000
```

Plusieurs joueurs peuvent se connecter depuis plusieurs onglets ou machines du même réseau local.

## Fonctionnalités incluses

- Serveur Node.js natif, sans Express ni Socket.io.
- Interface web HTML/CSS/JS.
- Carte de France avec contours métropolitains détaillés, Corse incluse, réseau ferré de fond, gares réelles issues de SNCF Open Data et tracés calculés sur les géométries RFN officielles.
- Multijoueur par état serveur partagé et polling.
- Création de compagnie.
- Achat de matériel roulant.
- Création de lignes voyageurs, fret ou mixtes.
- Gestion de fréquence, tarifs, revenus et fréquence effective selon la couverture conducteurs.
- Gares améliorables avec prix affiché dans les fiches/infobulles, niveaux maximums, sélection persistante, et revente avec remboursement de la gare, des niveaux, commerces, ateliers et dépôts.
- Salariés : conducteurs, contrôleurs, agents de gare, mainteneurs, régulateurs, ingénieurs.
- Énergie : charbon, diesel, électricité, hydrogène, batteries.
- Recherche et progression d’époque ralentie par des seuils élevés de trafic cumulé, sans délai temporel artificiel.
- Événements dynamiques.
- Classement multijoueur entre comptes réels uniquement, sans génération de compagnies IA.
- Utilisation possible des gares possédées par un autre joueur, avec péage uniquement lorsque la ligne dessert une gare concurrente.
- Sauvegarde automatique SQLite dans `data/save.sqlite` (migration automatique de l'ancien `data/save.json`).
- Panneau administrateur réservé au compte `Xenao`, avec édition des compagnies et journal de connexions horodatées.


## Structure du code

Le projet est découpé par grands domaines fonctionnels. Le comportement de jeu reste piloté par `server.js` et `public/app.js`, mais ces deux fichiers sont maintenant des points d’entrée légers.

### Serveur

- `server.js` : point d’entrée minimal.
- `src/server/bootstrap.js` : charge les fichiers serveur dans l’ordre historique pour préserver le comportement existant.
- `src/server/parts/00-config-bootstrap.js` : configuration, constantes, initialisation générale et démarrage HTTP.
- `src/server/parts/01-http-api.js` : routage HTTP/API, réponses JSON et fichiers statiques.
- `src/server/parts/02-auth-bugs-admin.js` : authentification, comptes, tutoriel, bugs et administration.
- `src/server/parts/03-rfn-routing.js` : moteur RFN, cache, workers et calculs de géométrie ferroviaire.
- `src/server/parts/04-state-world-data.js` : migration de sauvegarde, monde public, gares et chargements de données.
- `src/server/parts/05-public-actions.js` : état public, création joueur et actions de gameplay.
- `src/server/parts/06-simulation-economy.js` : simulation, économie, marché, énergie, maintenance et R&D.
- `src/server/parts/07-fleet-lines-infra.js` : matériel roulant, lignes, sillons, infrastructures et notifications.
- `src/server/parts/08-balance-world-utils.js` : score, routes simplifiées, balance, arbre R&D, monde de base et utilitaires généraux.

### Client

- `public/app.js` : loader client minimal.
- `public/js/00-core-state.js` : constantes client, état global, alias gares et données UI communes.
- `public/js/01-startup-events-auth.js` : initialisation, événements statiques, authentification, notifications et scroll compositions.
- `public/js/02-tutorial-layout-overview.js` : tutoriel, rendu global, onglets, topbar, vue compagnie et finances.
- `public/js/03-research-lines-foundations.js` : helpers R&D, métriques, art et fondations des écrans.
- `public/js/04-lines.js` : création, modification, gestion et affichage des lignes.
- `public/js/05-fleet-compositions.js` : parc, catalogue, maintenance et compositions du matériel roulant.
- `public/js/06-stations-staff-research.js` : gares, RH et écran R&D complet.
- `public/js/07-resources-budget-market.js` : énergie, budget et marché.
- `public/js/08-actions-modals.js` : gestion des actions, formulaires, modales et changelog.
- `public/js/09-map-rendering.js` : rendu carte, tracés, trains, gares et interactions de base.
- `public/js/10-routing-line-utils.js` : routage client, brouillon de ligne, recherche gares et utilitaires finaux.

### Styles

- `public/styles.css` : fichier d’imports CSS.
- `public/css/00-base-layout.css` : base, layout, notifications, panneaux et formulaires communs.
- `public/css/01-theme-map-ui.css` : thème visuel, carte, onglets, OSM et tooltips.
- `public/css/02-lines-fleet-research.css` : lignes, catalogue, maintenance, recherche et ressources.
- `public/css/03-accounts-budget-admin.css` : comptes joueurs, changelog, RH, budget, admin et panneau latéral.
- `public/css/04-compositions.css` : achat de sillons, atelier de compositions et vignettes Parc.
- `public/css/05-bugs-research-overview.css` : bugs, bouton carte, recherche R&D, vue financière et filtres compositions.

### Contrôle

```bash
npm run check
```

Cette commande vérifie maintenant la syntaxe de tous les fichiers JS découpés et des deux bundles reconstitués.

## Données ferroviaires

Le serveur utilise les données SNCF Open Data lorsque l’accès réseau est disponible :

- `liste-des-gares` pour récupérer les gares voyageurs et fret, leurs coordonnées GPS exactes, leur code UIC/GAIA et leurs lignes RFN ;
- `population-municipale-des-communes-france-entiere` sur data.gouv.fr pour rapprocher chaque gare de la population municipale de sa commune ;
- `formes-des-lignes-du-rfn` pour calculer des géométries de route suivant les lignes du Réseau Ferré National.

Le cache `data/communes-5000-population.json` conserve le nom historique du fichier mais contient désormais uniquement des gares réelles. Les anciennes communes jouables hors gare et la création de gares personnalisées sont désactivées. Les géométries RFN sont mises en cache localement dans `data/sncf-rfn-lines-cache.json` après le premier chargement. Si un segment n’a pas de tracé RFN exploitable, la création ou la modification de ligne est refusée au lieu de générer un itinéraire fictif.

## Notes

Ce projet est un MVP autonome côté serveur Node.js. Le client peut charger Leaflet et les caches SNCF locaux pour enrichir la carte, mais les lignes jouables restent limitées aux gares et itinéraires RFN validés côté serveur.
