# Audit et optimisations — v0.71.56

Passe du 5 septembre 2026, sur le client, le transport HTTP, les caches, la carte, la persistance et les parcours de gestion. Les essais ont utilisé une copie SQLite indépendante, dans un dossier temporaire, avec une compagnie de 232 trains, 40 lignes et 93 gares. La sauvegarde du répertoire de travail avait déjà une modification avant cette passe ; les essais n'y ont pas écrit.

## Changements

- Catalogue : seule l'époque actuelle est dépliée initialement. Les choix d'ouverture sont mémorisés, y compris pour la première époque (indice zéro). Les cartes hors écran peuvent différer leur mise en page.
- Maintenance : 12 trains par page et par époque, commandes précédent/suivant, et ouverture de la page du train sélectionné sur la carte. Les actions globales continuent à porter sur tout le parc.
- Compositions : les compatibilités des lignes sont calculées à l'ouverture du sélecteur d'affectation, au lieu de les recalculer pour les 232 trains à chaque rendu. Le sélecteur se réactualise après un nouvel état serveur et conserve un choix encore valide.
- Navigation : maintien du défilement lors des mises à jour du même écran, indication accessible de l'onglet actif, focus clavier visible. Le simple focus d'un bouton ne bloque plus indéfiniment les actualisations. Correction du passage d'un événement `focusin` à une fonction attendant une durée numérique.
- Panneaux Parc/R&D : rendu stable entre les ticks, mais reconstruction lors des changements structurels (recherche, fabrication, maintenance, affectation, équipements). Une modification différée pendant la saisie est comparée au dernier écran effectivement rendu.
- Synchronisation : délai maximal sur le polling, rejet des réponses devenues obsolètes après une action ou une reconnexion, conservation des demandes de rafraîchissement forcé reçues pendant une requête. Suspension des compteurs visuels lorsque la page est cachée.
- Gares : index de recherche réutilisé, prise en compte effective du tri choisi, absence de mutation de la liste partagée lors du classement des suggestions. Un nouveau monde remplace correctement les anciennes fiches de gares, même lorsque leurs IDs sont identiques.
- Monde statique : version explicite incluant la version applicative et celle du cache des gares. Le serveur renvoie le monde et la balance lorsque le client a une version ancienne, même en mode compact.
- HTTP : compression JSON asynchrone, respect de `q=0`, cache de compression borné et identifié par le contenu, scripts/styles sans version revalidés, en-têtes de type renforcés, lecture directe de l'image optimisée. Correction du décodage UTF-8 entre paquets, limite JSON en octets et refus des plages PMTiles vides.
- Les anciennes pages locales `_settoken*.html` ne sont plus exposées par le serveur HTTP.
- Lisibilité : illustration de fond atténuée, surfaces plus opaques sans flous répétés, bandeaux plus courts. Correction de la grille mobile : la carte n'est plus réduite à quelques pixels par une colonne implicite.

## Mesures indicatives

Mesures issues de l'instrumentation existante `data-sillons-render-tabs-ms`, sur la même copie de compagnie. Elles mesurent le travail de rendu JavaScript, pas le délai réseau ni la totalité du temps jusqu'à l'affichage. Les dimensions de la fenêtre et la charge machine ont varié pendant la session : ce sont des observations de diagnostic, pas un benchmark contrôlé.

| Écran | Avant | Après | Éléments HTML avant → après |
| --- | ---: | ---: | ---: |
| Catalogue | 56 ms | 12 ms | 7 397 → 1 229 |
| Maintenance | 245 ms | 46 ms | 13 215 → 1 639 |
| Compositions | 1 179 ms | 212 ms | 10 169 → 5 916 |

Au dernier parcours des dix onglets joueurs, les rendus observés vont de 1 à 20 ms, hors sous-menus Maintenance/Compositions. La liste des lignes existantes a été mesurée à 17 ms. La compression JSON sort du chemin synchrone du serveur ; le délai HTTP total n'a pas montré de baisse nette dans ces essais. Le niveau de compression dynamique réduit légèrement le travail au prix d'environ 4 % d'octets compressés supplémentaires sur ce scénario.

## Vérifications

- `npm run build:static` : bundles régénérés, version et URLs mises à jour.
- `npm run check` : 33 fichiers JavaScript et deux bundles reconstitués valides, incluant désormais SQLite, le démarrage d'authentification et les scripts.
- `npm test` : 12 tests de régression sans serveur ni écriture de sauvegarde, couvrant encodage/compression, corps JSON, plages PMTiles, recherche, catalogue, stabilité des panneaux, réponse de polling obsolète et interaction.
- HTTP sur copie isolée : état complet/compact, invalidation d'une ancienne version, refus sans authentification, blocage des pages de connexion de diagnostic, image JPEG optimisée et lecture partielle PMTiles.
- Actions sur copie isolée : achat d'un train, création de sa fabrication, annulation, recrutement/licenciement, emprunt/remboursement, achat de charbon, refus d'une action inconnue.
- Navigateur : dix onglets joueurs, gestion des lignes, tri décroissant des gares, changement de page en maintenance et chargement des options d'affectation au clavier. Pas d'erreur applicative dans les journaux consultés.
- Affichage à 390 × 844 et 1 024 × 768 : carte et panneaux à la largeur disponible, sans débordement horizontal de la page. À 390 px, la largeur de la carte passe de 2 à 359 px. Le viewport temporaire a été réinitialisé.

## Points restant à surveiller

`npm run check:stations` reste en avertissement bloquant sur trois groupes de coordonnées gare identiques : Paris-Austerlitz, Paris-Gare-de-Lyon et Paris-Nord (fiches surface/souterraines). Les contrôles d'IDs, de codes UIC, de codes INSEE hors multi-gares, et de coordonnées publiques avec nom ne signalent aucun doublon. Les fiches ont des identifiants distincts ; elles n'ont pas été supprimées sur la seule égalité des coordonnées.

Cette passe ne constitue pas une preuve de correction de toutes les combinaisons économiques, migrations historiques, actions administrateur ou situations multijoueurs. Les calculs économiques et la structure SQLite n'ont pas été modifiés. Le JavaScript reste organisé en parties concaténées ; une migration vers des modules et des tests métier plus étendus serait un chantier distinct.

Pour utiliser tous les correctifs, redémarrer le serveur Sillons puis recharger le site. La version `v0.71.56` renouvelle les URLs des bundles. Aucun commit ni déploiement distant n'a été effectué.
