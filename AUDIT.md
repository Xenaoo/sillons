# Audit et optimisations — v0.71.59

Passe du 28 octobre 2026. Les modifications déjà présentes dans le répertoire de travail, notamment l'espace R&D et les styles, ont été conservées. Les scénarios ont utilisé des bases SQLite temporaires, une compagnie synthétique et un serveur local isolé. Aucun scénario n'a utilisé la sauvegarde de travail pour ses mutations.

## Corrections appliquées

- **Transport** : compression Brotli/gzip des fichiers asynchrone ; calculs simultanés identiques regroupés ; caches de fichiers et de compression limités chacun à 64 entrées et 16 Mio. Les fichiers modifiés invalident leur cache. ETag permet une réponse 304 sans retransmettre ni recompresser le contenu. HEAD et les clients déconnectés sont pris en compte.
- **Actions** : les réponses n'incluent plus le monde et la balance lorsque le client en connaît la révision ; une ancienne révision reçoit toujours les données complètes. Les anciens clients restent compatibles. Les instantanés sont numérotés par instance serveur pour empêcher une ancienne réponse d'écraser un état récent.
- **Concurrence** : une file bornée par compagnie ordonne les actions et les modifications administrateur, tout en laissant les autres joueurs continuer. Deux créations simultanées ne peuvent plus engager le même train. Le delta de trésorerie est mesuré dans l'action exécutée et ne cumule plus les opérations précédentes en attente.
- **Validation** : paramètres numériques non finis, objets JSON de forme invalide, noms d'actions hérités du prototype et identifiants de compte réservés refusés. Les modifications administrateur sont validées avant de remplacer le joueur ; une requête refusée ne laisse plus une trésorerie partiellement modifiée.
- **Authentification** : scrypt asynchrone, compatible avec les empreintes existantes, avec quatre calculs simultanés maximum. Une inscription concurrente du même identifiant ne crée qu'un compte et une compagnie. La normalisation des comptes au chargement est conservée ; elle n'est plus répétée à chaque connexion.
- **RFN** : les workers ne chargent ni ne migrent la sauvegarde SQLite. Les demandes identiques partagent un calcul ; la file est bornée et le délai inclut l'attente. Après une panne, les tâches suivantes attendent un worker vivant. Un échec ou une saturation produit une erreur 503 contrôlée au lieu de relancer le calcul sur le fil principal. Un résultat vide ne déclenche plus le même calcul une deuxième fois sur le serveur.
- **Persistance** : une erreur SQLite ou une migration JSON impossible arrête explicitement le chargement ; aucune partie vide ou ancienne sauvegarde JSON ne remplace silencieusement une base illisible. Transactions et rollback conservés, `synchronous=FULL` explicite. Le checkpoint forcé après chaque COMMIT est supprimé ; SQLite assure ses checkpoints automatiques et un checkpoint est effectué à la fermeture. Les arrêts SIGINT/SIGTERM attendent les requêtes actives, avec une limite de dix secondes, puis sauvegardent et ferment SQLite.
- **Client** : délais réseau bornés ; les opérations RFN conservent un délai plus long. Une réponse d'une ancienne session est ignorée. Après une erreur réseau, le client relit l'état sans rejouer l'achat ou l'emprunt. Les actions actualisent aussi le cache d'instantané.
- **Carte** : le canvas utilise les dimensions réelles du conteneur, y compris en dessous de 400 px, pour rester aligné avec Leaflet sur mobile. Une demande de redessin complet n'est plus perdue lorsqu'un rendu allégé est déjà planifié. La révision du monde participe à l'invalidation des projections.
- **Fichiers servis** : chemins Windows invalides et méthodes autres que GET/HEAD refusés ; erreurs des flux PMTiles prises en charge. Les bundles dynamiques incluent les fichiers R&D et les styles déjà ajoutés au projet, avec revalidation des URLs sans version. Les bundles de production ont été régénérés en v0.71.59.

## Mesures

Microbenchmarks sous Node.js 24.16.0, médiane de sept échantillons, référence Git `96e9d108b3f858f068dbaf1ab231197e1650bf3f`. La compression utilise le même bundle de 497 627 octets dans les deux variantes, avec un cache froid. La sauvegarde synthétique comporte 200 trains et 40 lignes dans des bases temporaires.

| Opération | Blocage avant | Blocage après | Durée totale avant → après |
| --- | ---: | ---: | ---: |
| Compression Brotli du bundle | 7,44 ms | 0,29 ms | 7,45 → 7,49 ms |
| Empreinte du mot de passe | 23,87 ms | 0,04 ms | 23,88 → 24,67 ms |
| Écriture SQLite | 13,20 ms | 3,62 ms | 13,20 → 3,62 ms |

Le gain des opérations asynchrones concerne la disponibilité du fil principal pour les autres requêtes et la simulation ; leur durée totale n'est pas réduite dans ces mesures. Les temps SQLite varient avec le disque : une autre passe a mesuré 7,52 → 3,50 ms. Ces résultats ne constituent pas un benchmark de charge prolongée.

Le parcours HTTP sur une compagnie neuve mesure **2 056 919 octets** pour l'état complet et **3 783 octets** pour l'état compact, soit **99,82 % de données non compressées en moins**. Le gain dépend de la taille de la compagnie ; ce pourcentage ne mesure pas le temps d'affichage du navigateur.

Reproduction : `npm run benchmark`. Après un commit, définir `SILLONS_BENCH_BASE_REF=96e9d108b3f858f068dbaf1ab231197e1650bf3f` pour conserver la même référence historique.

## Validation et limites

- `npm run build:static` : bundles reconstruits.
- `npm run check` : syntaxe valide sur 37 fichiers JS et deux bundles reconstitués.
- `npm test` : **38 tests réussis**, dont un serveur HTTP réel isolé, les inscriptions concurrentes, les sessions, les actions compactes, la double affectation, le rollback SQLite, les réponses obsolètes, les workers et le canvas mobile. Dans un environnement bloquant les connexions locales, le test HTTP nécessite l'autorisation d'accéder à 127.0.0.1.
- `git diff --check` : aucune erreur d'espacement.
- `npm run check:stations` : les trois groupes de coordonnées déjà signalés restent présents (Paris-Austerlitz, Paris-Gare-de-Lyon, Paris-Nord, avec fiches de surface/souterraines distinctes). Le contrôle retourne encore un code d'erreur. Aucun doublon d'ID ni de code UIC n'est signalé ; aucune fiche n'a été supprimée sur la seule égalité des coordonnées.

Cette passe ne prouve pas une fiabilité de 100 %. Aucun parcours visuel complet dans un navigateur, test de charge prolongée ni validation exhaustive des calculs économiques et migrations historiques n'a été effectué dans cette passe. Les scénarios RFN de panne et de concurrence sont simulés ; le démarrage réel d'un worker sans accès SQLite est également testé. L'accès aux services SNCF externes n'a pas été nécessaire aux tests.

SQLite réécrit encore l'état complet de façon synchrone : la durée est réduite ici, mais elle reste à surveiller pour de très grandes parties. Un instantané externe d'une base ouverte doit tenir compte du journal WAL, par exemple via l'API de sauvegarde SQLite. Les tests temporaires ne remplacent pas une politique de sauvegarde et de restauration.

Pour activer les corrections, redémarrer le serveur puis recharger la page. Aucun commit ni déploiement distant n'a été effectué.

---

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
