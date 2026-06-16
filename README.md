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
- Carte de France avec contours métropolitains détaillés, Corse incluse, réseau ferré de fond, points de villes/gares reconstruits depuis les données officielles et géométries SNCF RFN quand elles sont disponibles.
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
- Classement multijoueur entre comptes réels uniquement, sans génération de compagnies IA.
- Sauvegarde automatique dans `data/save.json`.
- Panneau administrateur réservé au compte `Xenao`, avec édition des compagnies et journal de connexions horodatées.

## Données ferroviaires

Le serveur utilise les données SNCF Open Data lorsque l’accès réseau est disponible :

- `gares-de-voyageurs` pour récupérer les gares voyageurs, leurs coordonnées GPS, leur code commune et leur code UIC ;
- `geo.api.gouv.fr/communes` pour placer les communes jouables qui n’ont pas de gare voyageurs connue ;
- `formes-des-lignes-du-rfn` pour calculer des géométries de route suivant les lignes du Réseau Ferré National.

Le cache `data/communes-5000-population.json` est reconstruit dès que son format est obsolète, afin d’éviter les anciens placements manuels. Les géométries RFN sont mises en cache localement dans `data/sncf-rfn-lines-cache.json` après le premier chargement. Si les API ou le réseau sont indisponibles, le jeu reste lançable avec le dernier cache local et ses fallbacks de tracé.

## Notes

Ce projet est un MVP autonome côté serveur Node.js. Le client peut charger Leaflet et des données SNCF/Overpass en ligne pour enrichir la carte, mais le jeu reste lançable localement avec ses données internes si ces services ne répondent pas.
