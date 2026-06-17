# Sillons — jeu navigateur de gestion ferroviaire multijoueur

Prototype complet jouable, sans dépendance npm externe.

## Lancement

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
- Sauvegarde automatique dans `data/save.json`.
- Panneau administrateur réservé au compte `Xenao`, avec édition des compagnies et journal de connexions horodatées.

## Données ferroviaires

Le serveur utilise les données SNCF Open Data lorsque l’accès réseau est disponible :

- `liste-des-gares` pour récupérer les gares voyageurs et fret, leurs coordonnées GPS exactes, leur code UIC/GAIA et leurs lignes RFN ;
- `population-municipale-des-communes-france-entiere` sur data.gouv.fr pour rapprocher chaque gare de la population municipale de sa commune ;
- `formes-des-lignes-du-rfn` pour calculer des géométries de route suivant les lignes du Réseau Ferré National.

Le cache `data/communes-5000-population.json` conserve le nom historique du fichier mais contient désormais uniquement des gares réelles. Les anciennes communes jouables hors gare et la création manuelle de points sont désactivées. Les géométries RFN sont mises en cache localement dans `data/sncf-rfn-lines-cache.json` après le premier chargement. Si un segment n’a pas de tracé RFN exploitable, la création ou la modification de ligne est refusée au lieu de générer un itinéraire fictif.

## Notes

Ce projet est un MVP autonome côté serveur Node.js. Le client peut charger Leaflet et les caches SNCF locaux pour enrichir la carte, mais les lignes jouables restent limitées aux gares et itinéraires RFN validés côté serveur.
