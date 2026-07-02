# Cartes locales PMTiles

Place ici une archive PMTiles compatible Protomaps nommee `world.pmtiles`.

Au demarrage, Sillons tente de charger `/assets/maps/world.pmtiles` depuis le serveur local. Si le fichier existe, le fond Leaflet utilise cette carte vectorielle locale avec des requetes HTTP Range (`206 Partial Content`). Si le fichier est absent, aucun service de tuiles externe n'est appele et le jeu conserve son fond de carte interne.

Exemple d'installation depuis une URL PMTiles :

```powershell
npm.cmd run install:local-map -- https://exemple.local/world.pmtiles
```

Le fichier PMTiles n'est pas versionne pour eviter d'ajouter une carte mondiale volumineuse au depot.
