# Sillons — jeu navigateur de gestion ferroviaire multijoueur

Prototype complet jouable, sans dépendance externe.

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
- Carte canvas de France avec contours métropolitains détaillés, Corse incluse, réseau ferré de fond et gares positionnées.
- Multijoueur par état serveur partagé et polling.
- Création de compagnie.
- Achat de matériel roulant.
- Création de lignes voyageurs, fret ou mixtes.
- Gestion de fréquence, tarifs et revenus.
- Gares améliorables avec coût affiché, niveaux maximums et sélection persistante.
- Salariés : conducteurs, contrôleurs, agents de gare, mainteneurs, régulateurs, ingénieurs.
- Énergie : charbon, diesel, électricité, hydrogène, batteries.
- Recherche et progression d’époque.
- Événements dynamiques.
- Classement multijoueur.
- Sauvegarde automatique dans `data/save.json`.

## Notes

Ce projet est un MVP autonome. La carte reste dessinée en canvas sans dépendance externe, mais le contour métropolitain a été affiné et la sélection des gares est conservée entre les refreshs de l’état serveur. Pour une version production, remplacer la carte canvas par un fond OpenStreetMap/Leaflet ou MapLibre, et brancher des données SNCF Open Data pour les gares, fréquentations et services.