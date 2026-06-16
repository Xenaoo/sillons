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
- Carte de France avec contours métropolitains détaillés, Corse incluse, réseau ferré de fond, gares positionnées et géométries SNCF RFN quand elles sont disponibles.
- Multijoueur par état serveur partagé et polling.
- Création de compagnie.
- Achat de matériel roulant.
- Création de lignes voyageurs, fret ou mixtes.
- Gestion de fréquence, tarifs, revenus et fréquence effective selon la couverture conducteurs.
- Gares améliorables avec coût affiché, niveaux maximums et sélection persistante.
- Salariés : conducteurs, contrôleurs, agents de gare, mainteneurs, régulateurs, ingénieurs.
- Énergie : charbon, diesel, électricité, hydrogène, batteries.
- Recherche et progression d’époque.
- Événements dynamiques.
- Classement multijoueur.
- Sauvegarde automatique dans `data/save.json`.
- Panneau administrateur réservé au compte `Xenao`, avec édition des compagnies et journal de connexions horodatées.

## Données ferroviaires

Le serveur utilise les données SNCF Open Data lorsque l’accès réseau est disponible :

- `gares-de-voyageurs` pour récupérer les gares voyageurs et leurs coordonnées GPS ;
- `formes-des-lignes-du-rfn` pour calculer des géométries de route suivant les lignes du Réseau Ferré National.

Les géométries RFN sont mises en cache localement dans `data/sncf-rfn-lines-cache.json` après le premier chargement. Si l’API SNCF ou le réseau sont indisponibles, le jeu conserve ses données internes et ses fallbacks de tracé.

## Notes

Ce projet est un MVP autonome côté serveur Node.js. Le client peut charger Leaflet et des données SNCF/Overpass en ligne pour enrichir la carte, mais le jeu reste lançable localement avec ses données internes si ces services ne répondent pas.
