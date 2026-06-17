## Version v64.6.4 — correctif démarrage après nettoyage des anciens points

- incrément de version : badge interface `v64.6.4`, version serveur/client `v64.6.4`, package `64.6.4` et schéma serveur `114` ;
- restauration des helpers client supprimés par erreur lors de la purge des anciens arrêts manuels : calculs de ligne, sillons, recherche de gares, itinéraires RFN et libellés de lignes ;
- conservation du nettoyage des anciens points manuels sans réintroduire leur création ni leurs traces dans la sauvegarde ;
- correction du plantage de rendu initial qui affichait à tort `Impossible de joindre le serveur local`.

## Version v64.6.3 — correction du démarrage après purge des anciens points

- incrément de version : badge interface `v64.6.3`, version serveur/client `v64.6.3`, package `64.6.3` et schéma serveur `113` ;
- correction du blocage au chargement affichant à tort `Impossible de joindre le serveur local` après la purge des anciens points manuels ;
- ajout d'une sécurisation serveur qui nettoie automatiquement les références de gares orphelines dans les lignes et possessions au premier chargement d'état ;
- nettoyage complémentaire de `data/save.json` : plus aucune ligne ne référence d'identifiant de gare absent du monde public ;
- sécurisation client : une référence de gare manquante ne peut plus faire planter le rendu initial de l'interface.

## Version v64.6.2 — purge des anciens points manuels

- incrément de version : badge interface `v64.6.2`, version serveur/client `v64.6.2`, package `64.6.2` et schéma serveur `112` ;
- suppression des derniers mécanismes de création/stockage manuel de points côté serveur et interface ;
- nettoyage de la sauvegarde fournie : suppression du bloc historique dédié, retrait des gares `anciens identifiants manuels` des possessions et des lignes, et suppression des lignes devenues invalides ;
- maintien des itinéraires et gares réelles SNCF uniquement.

## Version v64.6.0 — lignes : sillons disponibles et détail du tronçon limitant

- incrément de version : badge interface `v64.6.0`, version serveur/client `v64.6.0`, package `64.6.0` et schéma serveur `110` ;
- menu `Lignes > Modifier` : suppression de la case `Trains` dans les statistiques de fiche ligne ;
- case `Sillons` : affichage limité au nombre de sillons réellement disponibles sur le tronçon limitant ;
- tooltip `Sillons` : ajout d’un affichage ligne par ligne avec le tronçon limitant et l’utilisation déjà consommée par les autres compagnies/lignes ;
- serveur : enrichissement des statistiques de sillons avec le détail des lignes tierces utilisant le tronçon limitant.

## Version v64.5.2 — désélection du filtre carte des lignes

- incrément de version : badge interface `v64.5.2`, version serveur/client `v64.5.2`, package `64.5.2` et schéma serveur `109` ;
- menu `Lignes > Modifier` : le premier clic sur une ligne conserve le comportement existant, avec centrage et filtre de la carte sur cette ligne ;
- un second clic sur la même ligne déjà sélectionnée désélectionne maintenant la ligne et retire le filtre appliqué à la carte ;
- le bouton `Carte` suit le même comportement de bascule, tandis que le bouton `Modifier` continue d'ouvrir l'éditeur sans désélectionner la ligne.

## Version v64.5.0 — sélection directe des compositions

- incrément de version : badge interface `v64.5.0`, version serveur/client `v64.5.0`, package `64.5.0` et schéma serveur `107` ;
- menu `Parc > Compositions` : ajout d'un bouton `Tout sélectionner` pour sélectionner l'ensemble du parc possédé en une action ;
- suppression des boutons de tri `Par ère` et `Voyageurs / Fret` ; les trains restent présentés par ère avec les catégories masquables existantes ;
- suppression du contrôle `Sélection` en haut à gauche des vignettes ; une vignette se sélectionne ou se désélectionne désormais par clic sur une zone non fonctionnelle de la carte ;
- ajustements CSS de la barre de sélection et des vignettes pour conserver un comportement lisible sur desktop et mobile.

## Version v64.4.1 — correction du cadrage des vignettes Maintenance

- incrément de version : badge interface `v64.4.1`, version serveur/client `v64.4.1`, package `64.4.1` et schéma serveur `106` ;
- correction du bug de cadrage des vignettes dans `Parc > Maintenance` : les cartes reprennent une disposition verticale cohérente avec le catalogue au lieu de forcer un affichage en deux colonnes trop étroit ;
- sécurisation de l'affichage des pastilles de statut/ligne longue dans les vignettes de maintenance ;
- suppression de l'aperçu miniature de composition sous la ligne `Composition` dans les vignettes de maintenance.

## Version v64.4.0 — maintenance du parc alignée sur le catalogue

- incrément de version : badge interface `v64.4.0`, version serveur/client `v64.4.0`, package `64.4.0` et schéma serveur `105` ;
- catalogue du parc : suppression des tooltips sur les boutons `Acheter` ;
- maintenance du parc : vignettes rapprochées du format visuel du catalogue, avec grille par ère et catégories masquables ;
- maintenance du parc : tri des matériels possédés par ère puis par nom de modèle ;
- maintenance du parc : suppression de la ligne `Affectation`, remplacée par la ligne exploitée directement dans la pastille haute droite de la vignette ;
- maintenance du parc : affichage de l’usure historique en temps réel au lieu des cycles ;
- maintenance du parc : suppression des lignes `Capacité`, `Portée`, `Dernier service` et du panneau `Bonus recherches hérités`.

# Changelog

## Version v64:2:0 — achat groupé depuis le catalogue du parc

- incrément de version : badge interface `v64:2:0`, version serveur/client `v64:2:0`, package `64.2.0` et schéma serveur `103` ;
- ajout d’un champ `Quantité` sur chaque carte de matériel dans `Parc > Catalogue`, initialisé à `1` pour conserver l’achat unitaire par défaut ;
- ajout du calcul immédiat du total estimé selon la quantité choisie et le prix unitaire courant ;
- ajout d’une confirmation dédiée lors d’un achat de plusieurs trains ;
- adaptation de l’action serveur `buyTrain` pour accepter une quantité, valider la borne `1 à 99`, débiter le coût total et créer tous les exemplaires achetés.


## Version v64.1.5 — correction définitive du scroll Composition et carte mobile

- incrément de version : badge interface `v64.1.5`, package `64.1.5` et schéma serveur `102` ;
- correction du scroll dans `Parc > Compositions` : le conteneur scrollable est maintenant le panneau `Trains de la compagnie`, plus la grille interne qui était écrasée par les règles flex/grid ;
- suppression du conflit qui réduisait `.composition-group-list` à une hauteur quasi nulle et empêchait la molette/le tactile de déplacer les vignettes ;
- conservation du scroll indépendant de l’éditeur de composition à droite ;
- ajout de garde-fous CSS et JS pour maintenir la carte visible sur téléphone, y compris après changement d’onglet, redimensionnement ou état de panneau réduit.

## Version v64.1.4 — audit et correction du verrouillage de scroll Composition

- incrément de version : badge interface `v64.1.4`, package `64.1.4` et schéma serveur `101` ;
- cause corrigée : `scheduleCompositionRefitScrollAdjustment()` quittait immédiatement dès que l’utilisateur n’était plus dans `Parc > Compositions`, donc la classe `.composition-scroll-mode` et les styles inline de `#tabContent` restaient actifs après changement de menu ;
- ajout d’un nettoyage explicite des styles de scroll quand on quitte l’onglet Composition, afin que les autres menus récupèrent toujours leur défilement normal ;
- suppression du verrouillage total de `#tabContent` comme dépendance principale : le panneau conserve désormais un scroll de secours, tandis que la liste des trains garde son scroll interne ;
- correction CSS du bug `height: 0 !important` hérité de `v64.1.2` sur `.composition-group-list` : la liste reprend une hauteur flexible et scrollable ;
- renforcement du layout Composition : en-tête et barre de tri fixes, liste des vignettes scrollable, éditeur de droite scrollable séparément.

## Version v64.1.3 — déblocage du scroll Composition

- incrément de version : badge interface `v64.1.3`, package `64.1.3` et schéma serveur `100` ;
- correction du verrouillage CSS introduit en `v64.1.2` : les hauteurs calculées en JavaScript étaient annulées par des règles `!important`, ce qui empêchait le panneau Composition de scroller ;
- application des hauteurs calculées avec priorité explicite sur le layout, la carte de liste, la liste des trains et l’éditeur ;
- calcul de la hauteur de la liste à partir de l’en-tête et de la barre d’actions, pour que seule la zone des vignettes défile ;
- restauration du scroll de l’éditeur de composition à droite, sans bloquer le panneau complet ;
- adaptation du comportement sous 900 px : le panneau global redevient scrollable et la liste conserve son propre défilement tactile.

## Version v64.1.2 — correction réelle du scroll Composition

- incrément de version : badge interface `v64.1.2`, package `64.1.2` et schéma serveur `99` ;
- verrouillage de l’onglet Parc > Compositions en mode hauteur fixe quand l’atelier est ouvert ;
- la carte `Trains de la compagnie` devient un conteneur flex à hauteur contrainte ;
- seule la liste `.composition-group-list` défile dans le panneau de gauche ;
- ajout d’une interception roue/tactile en capture pour empêcher le scroll parent de prendre la main sur le panneau Composition ;
- suppression de la dépendance au scroll général de `#tabContent` sur desktop dans ce sous-menu.

## Version v64.1.1 — correctif définitif du scroll Composition

- incrément de version : badge interface `v64.1.1`, package `64.1.1` et schéma serveur `98` ;
- correction du panneau `Trains de la compagnie` : la zone des vignettes possède désormais un scroll indépendant forcé, avec hauteur recalculée après rendu, redimensionnement et viewport mobile ;
- ajout d'une interception dédiée de la molette et du tactile dans le menu Composition pour empêcher le scroll parent de capter le défilement de la liste ;
- réorganisation CSS du panneau en colonne flexible : en-tête, filtre et actions restent fixes, seule la liste des sections de trains défile ;
- amélioration du bloc de tri `Par ère` / `Voyageurs / Fret` pour éviter les textes tronqués sur les panneaux étroits.

## Version v64.1.0 — correctifs menu Composition et réaffectation des trains

- incrément de version : badge interface `v64.1.0`, package `64.1.0` et schéma serveur `97` ;
- correction robuste du scroll indépendant dans le menu Composition : la liste des sections de trains calcule désormais sa hauteur utile selon la position réelle dans le viewport, puis conserve son propre défilement vertical ;
- déplacement du choix de tri hors d’un `select` trop étroit : le tri du parc se fait maintenant via deux boutons lisibles `Par ère` et `Voyageurs / Fret` ;
- correction des alignements des vignettes : libellé `Sélection` non tronqué, statut de ligne borné proprement et choix d’affectation contenu dans la carte ;
- ajout de la réaffectation directe depuis le menu Composition : un train déjà affecté peut être retiré de sa ligne ou déplacé vers une autre ligne compatible ;
- ajout de l’action serveur `setTrainLineAssignment`, avec validation de compatibilité service / portée, achat de sillon sur la nouvelle ligne et libération de l’ancienne ligne ;
- correction des besoins de personnel pour les lignes actives sans train affecté : elles ne génèrent plus de besoin opérationnel tant qu’aucun matériel n’y circule.

## Version v64.0.1 — correctif lisibilité et scroll du menu Composition

- incrément de version : badge interface `v64.0.1`, package `64.0.1` et schéma serveur `96` ;
- correction de la grille de vignettes du menu Composition : largeur minimale augmentée, contenus contenus dans les cartes et suppression des débordements des boutons / listes déroulantes ;
- correction des libellés longs de lignes et statuts : ellipses propres, titres bornés et textes empêchés de sortir des cadres ;
- correction du scroll indépendant de la liste des trains : la zone des sections de trains possède désormais une hauteur bornée et son propre défilement vertical ;
- amélioration de la lisibilité du choix de tri `Par ère` / `Voyageurs / fret`, notamment sur écran étroit ;
- adaptation responsive des en-têtes de sections réductibles pour éviter les titres coupés ou illisibles.

## Version v64.0.0 — refonte du menu Composition

- incrément de version : badge interface `v64.0.0`, package `64.0.0` et schéma serveur `95` ;
- refonte du menu Composition : l’atelier d’édition ne s’ouvre plus automatiquement et apparaît uniquement après clic sur une vignette de train ou sur le bouton d’édition de la sélection ;
- remplacement de la liste verticale simple par des vignettes de trains, visuellement proches des cartes de recherche / catalogue ;
- classement du parc soit par sections d’ère, soit par sections de type de composition `Voyageurs`, `Fret` ou `Mixte`, avec sections réductibles persistées localement ;
- intégration directe dans chaque vignette des actions `Dupliquer`, `Affecter à une ligne` et `Vendre` ;
- ajout d’une sélection multiple permettant d’appliquer une composition à un ensemble de trains compatibles ;
- l’action serveur `updateTrainComposition` accepte désormais plusieurs trains en une seule opération, valide la compatibilité de chaque matériel, calcule le coût / remboursement global et recalcule les lignes après application ;
- ajustements CSS du panneau pour conserver un scroll indépendant de la liste des vignettes et une mise en page lisible sur écran étroit.

## Version v63.0.0 — gestion des sillons, filtre concurrents et atelier de trains

- incrément de version : badge interface `v63.0.0`, package `63.0.0` et schéma serveur `94` ;
- ajout d’un filtre de carte permettant d’afficher ou masquer les tracés et trains des autres joueurs ;
- ajout d’un mode focus de ligne : clic sur une fiche ligne ou bouton `Carte`, centrage de la vue sur le tracé, surbrillance de la ligne et masquage temporaire des autres tracés pendant l’édition ;
- remplacement de l’achat direct des gares libres par une logique d’achat de sillons sur les lignes : les gares libres restent utilisables, l’ajout de matériel à une ligne consomme et achète des sillons ;
- l’éditeur de ligne affiche les sillons disponibles, les sillons nouvellement demandés et le coût estimé avant sauvegarde ;
- ajout d’une action serveur et interface pour affecter un train libre à une ligne depuis le menu Composition ;
- ajout d’une action serveur et interface pour dupliquer un train avec sa composition actuelle ;
- ajout d’un tri du parc possédé par ère puis type, ou par type puis ère ;
- la liste des trains dans le menu Composition possède désormais son propre scroll indépendant de la fenêtre et de l’éditeur de composition.

## Version v62.26.3 — correctif tunnel RER parisien et Châtelet-les-Halles

- incrément de version : badge interface `v62.26.3`, package `62.26.3` et schéma serveur `93` ;
- correction du calcul RFN quand une gare est proche de plusieurs faisceaux ou niveaux de voies : le serveur relie désormais chaque extrémité de segment à plusieurs ancrages RFN proches au lieu d’un seul point le plus proche ;
- correction du segment `Paris-Nord → Paris-Gare-de-Lyon`, qui pouvait échouer car `Paris-Gare-de-Lyon` était accrochée au mauvais faisceau alors que le tunnel RER existe dans les formes RFN ;
- validation du parcours complet `Creil → Melun` de la capture : les 29 segments sont maintenant calculés, pour environ `101 km` ;
- ajout de la gare RER `Châtelet-les-Halles`, absente du dataset SNCF `liste-des-gares`, avec coordonnées alignées sur les formes RFN souterraines ;
- mise à jour du cache local des gares pour intégrer `Châtelet-les-Halles` sans dépendre d’un rafraîchissement réseau.

## Version v62.26.2 — raccords RFN courts entre tronçons voisins

- incrément de version : badge interface `v62.26.2`, package `62.26.2` et schéma serveur `92` ;
- ajout de raccords virtuels très courts entre composantes RFN voisines afin de compenser certains découpages non jointifs du dataset `formes-des-lignes-du-rfn` ;
- correction de segments réels qui échouaient malgré leur existence sur le RFN, notamment dans les zones de bifurcations, faisceaux et tunnels urbains ;
- conservation du blocage lorsque deux gares restent réellement trop éloignées d’un tronçon RFN exploitable.

## Version v62.26.1 — correctifs carte mobile, gares visibles et création de ligne

- incrément de version : badge interface `v62.26.1`, package `62.26.1` et schéma serveur `91` ;
- correction du layout mobile : la page peut à nouveau défiler, la carte conserve une hauteur propre sur téléphone et Leaflet est redimensionné lors des changements de viewport mobile ;
- restauration du rendu des gares sur la carte avec de petites pastilles carrées ;
- ajout d’un affichage progressif des gares selon le niveau de zoom, avec filtrage viewport et anti-chevauchement conservés ;
- conservation des noms uniquement au zoom maximal pour les gares possédées, afin d’éviter une carte trop chargée ;
- correction de l’ajout des arrêts intermédiaires dans la création de ligne : les gares sont maintenant conservées dans l’ordre choisi par le joueur, sans réinsertion automatique approximative ;
- assouplissement serveur de la création/modification de ligne : les gares libres peuvent être desservies ou traversées, et les péages ne s’appliquent que sur les gares appartenant à une autre compagnie.

## Version v62.26.0 — gares réelles et itinéraires RFN obligatoires

- incrément de version : badge interface `v62.26.0`, package `0.6.26` et schéma serveur `90` ;
- remplacement du modèle communes par les gares réelles de `liste-des-gares`, avec coordonnées SNCF exactes, UIC/GAIA, nature voyageurs/fret et codes lignes RFN ;
- suppression de la notion de ville de moins ou plus de `5 000` habitants : les points jouables sont des gares SNCF réelles uniquement ;
- rapprochement de la demande avec la population municipale communale issue de data.gouv.fr, avec agrégation Paris/Lyon/Marseille par arrondissements et fallback de cache local si l’API tabulaire est indisponible ;
- création de points manuels désactivée côté client et côté serveur ;
- création et modification de ligne bloquées quand aucun itinéraire réel n’est trouvé dans `formes-des-lignes-du-rfn` entre deux arrêts ;
- suppression des fallbacks visuels fictifs côté client : une ligne sans géométrie RFN reste en attente ou introuvable ;
- validation voyageurs/fret par gare : une ligne voyageurs exige des gares voyageurs, une ligne fret exige des gares fret, une ligne mixte exige les deux ;
- optimisation carte : filtrage viewport des gares dessinables, cache de signature de liste, simplification serveur des polylignes RFN et réduction des recalculs quand une géométrie arrive.

## Version v62.25.0 — restauration des tracés RFN précis

- incrément de version : badge interface `v62.25.0`, package `0.6.25` et schéma serveur `89` ;
- correction du rendu des tracés : les géométries détaillées RFN/SNCF ne sont plus remplacées par une spline organique de sécurité ;
- les tracés conservent les points détaillés du RFN quand ils existent ;
- les échecs temporaires de chargement RFN/Overpass ne sont plus mémorisés définitivement côté client ;
- le serveur ne met plus en cache permanent les réponses RFN vides lorsque le cache officiel n’est pas encore prêt ;
- ajout d’un préchargement RFN serveur en arrière-plan au démarrage ;
- la carte reste allégée : les gares restent masquées sauf noms des gares possédées au zoom maximal.

## Version v62.24.0 — carte allégée et rééquilibrage économique

- incrément de version : badge interface `v62.24.0`, package `0.6.24` et schéma serveur `88` ;
- affichage carte fortement allégé : seules les lignes restent visibles en vue normale ;
- les marqueurs de gares sont masqués sur la carte afin de limiter la surcharge visuelle ;
- au zoom maximal, seuls les noms des gares possédées par le joueur sont affichés ;
- les gares restent cliquables sur la carte même si elles ne sont plus affichées ;
- rééquilibrage monétaire global : hausse importante des revenus voyageurs et fret ;
- réduction des coûts variables énergie / maintenance ;
- forte baisse des coûts commerciaux automatiques afin qu’une petite ligne exploitée avec un petit train vise environ `50 000 €/h` de revenu net global.

## Version v62.23.0 — saisie libre RH et remboursement de dette

- incrément de version : badge interface `v62.23.0`, package `0.6.23` et schéma serveur `87` ;
- ajout d’un champ de quantité pour chaque métier dans l’onglet RH ;
- les actions de recrutement et licenciement peuvent maintenant utiliser la quantité saisie ;
- relèvement de la limite technique par action RH à `5000` salariés ;
- ajout d’un champ de remboursement libre dans le panneau Financement ;
- ajout d’un bouton de remboursement total de la dette ;
- le serveur accepte désormais un remboursement libre, plafonné à la dette réelle et contrôlé par la trésorerie disponible.

## Version v62.22.0 — pastilles animées sur les lignes

- incrément de version : badge interface `v62.22.0`, package `0.6.22` et schéma serveur `86` ;
- remplacement des sprites de trains pixel-art sur la carte par des pastilles rondes animées ;
- une pastille correspond maintenant à un train affecté à la ligne ;
- la quantité de pastilles suit donc directement le nombre de trains placés sur la ligne ;
- la vitesse visuelle des pastilles dépend de la vitesse moyenne des trains affectés à la ligne, avec les pénalités liées au service, aux arrêts et à l’état du matériel ;
- ajout d’une trainée de mouvement dont la longueur varie avec la vitesse moyenne ;
- conservation des règles de visibilité : trains du joueur toujours visibles, trains des autres joueurs visibles seulement au zoom maximal.

## Version v62.21.0 — capacités de sillons réalistes

- incrément de version : badge interface `v62.21.0`, package `0.6.21` et schéma serveur `85` ;
- correction de l’affichage des sillons : les lignes affichent désormais `sillons utilisés / capacité réelle du tronçon limitant`, au lieu de `sillons effectifs / sillons demandés` ;
- ajout d’une capacité dédiée pour l’axe Paris-Austerlitz ↔ Brétigny ↔ Étampes : `18 trains/h` ;
- ajout d’une capacité dédiée pour l’antenne Dourdan ↔ Brétigny : `4 trains/h` ;
- amélioration de l’heuristique générale des capacités de tronçons selon densité urbaine, distance, Île-de-France et axes principaux/secondaires ;
- les sillons consommés restent déterminés par le nombre de trains affectés à la ligne.

## Version v62.20.0 — sillons par trains et suppression de la fréquence

- incrément de version : badge interface `v62.20.0`, package `0.6.20` et schéma serveur `84` ;
- suppression de la notion de fréquence dans l’interface de création et de modification des lignes ;
- les sillons consommés sont désormais déterminés par le nombre de trains affectés à la ligne ;
- correction du compteur de sillons : il affiche les trains/sillons effectivement exploitables sur les tronçons limitants ;
- correction du prix billet dans la fenêtre de modification : le montant saisi est sauvegardé et n’est plus réécrit automatiquement par le recalcul économique ;
- nettoyage visuel de la sélection des trains dans la fenêtre de modification ;
- les trains animés sont dessinés à raison d’une animation par train affecté, sans duplication liée à une ancienne fréquence.

## Version v62.19.0 — sillons ferroviaires et péages de passage

- incrément de version : badge interface `v62.19.0`, package `0.6.19` et schéma serveur `83` ;
- ajout d’un système de sillons par tronçon : chaque segment possède une capacité maximale en trains/h ;
- une ligne peut emprunter un tronçon déjà utilisé, mais sa fréquence effective est plafonnée par le tronçon le plus contraint ;
- les calculs d’exploitation utilisent la fréquence réellement disponible après limitation des sillons : capacité, revenus, énergie, maintenance et usure ;
- les cartes de lignes affichent la fréquence sillons effective/demandée et le tronçon limitant en infobulle ;
- les péages de gare restent conservés et s’appliquent maintenant aussi aux gares traversées visuellement par l’itinéraire, même lorsqu’elles ne sont pas ajoutées comme arrêt commercial ;
- les coûts d’infrastructure utilisent les segments réels du parcours calculé, y compris les gares intermédiaires implicites.

## Version v62.18.0 — restauration largeur panneau

- incrément de version : badge interface `v62.18.0`, package `0.6.18` et schéma serveur `82` ;
- correction du layout carte/panneau : retour à une grille propre en deux colonnes, sans colonne vide centrale ;
- le panneau de droite reprend toute la largeur disponible à droite de la carte ;
- la flèche est repositionnée en overlay sur la séparation carte/panneau, sans consommer une colonne de largeur ;
- le mode réduit conserve un panneau à environ un quart de la fenêtre sans casser l’affichage ;
- renforcement du redimensionnement visuel de la carte : le conteneur OSM et le canvas occupent bien 100 % de leur colonne.

## Version v62.17.0 — correction panneau latéral et trains du joueur

- incrément de version : badge interface `v62.17.0`, package `0.6.17` et schéma serveur `81` ;
- correction du layout du panneau latéral : la largeur normale du panneau est restaurée ;
- repositionnement de la flèche sur la séparation carte/panneau, légèrement décalée vers la droite ;
- correction de l’overflow qui faisait sortir le panneau de la fenêtre en mode réduit ;
- audit et correction du rendu des trains : les trains du joueur connecté sont maintenant dessinés depuis `app.state.me` en passe dédiée ;
- les trains du joueur connecté restent visibles quel que soit le zoom ;
- les trains des autres joueurs restent masqués jusqu’au zoom maximal.

## Version v62.16.0 — carte, maintenance globale, ressources et gares compactes

- incrément de version : badge interface `v62.16.0`, package `0.6.16` et schéma serveur `80` ;
- les trains animés du joueur restent toujours visibles, quelle que soit l’échelle de zoom ;
- les trains animés des autres joueurs n’apparaissent qu’au zoom maximal ;
- repositionnement du bouton flèche entre carte et panneau, en colonne dédiée, pour éviter le chevauchement avec les cartes ;
- amélioration du panneau rétracté : la largeur se recalcule proprement et le contenu évite les débordements horizontaux ;
- ajout d’un champ de quantité personnalisée pour acheter du charbon et du diesel ;
- ajout d’un bouton de maintenance globale pour envoyer tous les trains éligibles en révision atelier ;
- refonte de l’onglet Gares : les gares possédées s’affichent en grille compacte avec 4 à 5 cartes par rangée selon la largeur disponible ;
- ajout d’un tri des gares possédées par ordre alphabétique, coût/valeur ou niveau.

## Version v62.15.0 — carte multi-joueurs, confirmations intégrées et panneau rétractable

- incrément de version : badge interface `v62.15.0`, package `0.6.15` et schéma serveur `79` ;
- les trains animés des autres joueurs ne sont affichés qu’à partir d’un zoom suffisant afin de réduire la surcharge visuelle ;
- les lignes des autres joueurs utilisent maintenant la couleur de leur entreprise sur la carte ;
- remplacement des confirmations navigateur par des fenêtres de confirmation intégrées à la DA du jeu ;
- ajout d’un bouton flèche entre la carte et le panneau latéral pour rétracter/rouvrir le panneau avec animation ;
- le panneau rétracté occupe environ un quart de la fenêtre, laissant plus de place à la carte ;
- amélioration visuelle de la sélection multi-trains dans le menu de modification de ligne ;
- accentuation rouge du bouton de fermeture de ligne ;
- conservation du calcul de péage de gare indexé sur le niveau de gare : `+12,5%` par niveau au-dessus du niveau 1.

## Version v62.14.0 — composition, fermeture de ligne et péages de niveau

- incrément de version : badge interface `v62.14.0`, package `0.6.14` et schéma serveur `78` ;
- correction des statistiques catalogue : les flèches vertes ne sont plus affichées quand aucune valeur modifiée n’est fournie ;
- amélioration visuelle de la sélection multi-trains dans le menu de modification de ligne ;
- recadrage des noms de ligne longs dans Parc → Composition pour éviter les débordements ;
- ajout d’un bouton de vente des trains inutilisés directement dans Parc → Composition ;
- ajout d’une confirmation avant fermeture d’une ligne ;
- renforcement visuel du bouton `Fermer` sur les lignes ;
- augmentation des péages de gare selon le niveau de gare : `+12,5%` par niveau au-dessus du niveau 1, en plus des bonus commerces, ateliers et dépôt.

## Version v62.13.0 — barres de bonus lisibles et recherches rééquilibrées

- incrément de version : badge interface `v62.13.0`, package `0.6.13` et schéma serveur `77` ;
- correction des barres de statistiques du catalogue : la base reste en jaune et seul le supplément après modificateur apparaît en vert ;
- division par `10` de tous les effets numériques de recherche : un ancien bonus de `+5%` donne maintenant `+0,5%` par niveau ;
- les valeurs affichées dans les fiches de recherche et les calculs serveur utilisent les nouveaux bonus réduits.

## Version v62.12.0 — composition détaillée et gares parisiennes revalorisées

- incrément de version : badge interface `v62.12.0`, package `0.6.12` et schéma serveur `76` ;
- cartes matériel : affichage des statistiques de base et des statistiques réellement modifiées en vert, avec prolongation verte des barres correspondantes ;
- atelier de composition : statistiques recalculées après application de tous les modificateurs (recherches héritées, composition et état du train) ;
- atelier de composition : ajout d’infobulles détaillant chaque source de bonus/malus avec code couleur vert/rouge ;
- correction du bug qui laissait la portée à `0 km` dans le panneau de composition ;
- revalorisation des grandes gares parisiennes (Austerlitz, Gare de Lyon, Gare du Nord, Gare de l’Est, Saint-Lazare et Montparnasse) avec un prix d’achat multiplié par `50`, y compris en affichage et au calcul réel côté serveur.


# CHANGELOG

## Version v62.11.0 — grandes gares parisiennes et tarifs par fréquentation

- incrément de version : badge interface `v62.11.0`, package `0.6.11` et schéma serveur `75` ;
- remplacement de l’entrée unique `Paris` par six grandes gares parisiennes distinctes : Paris Austerlitz, Paris Montparnasse, Paris Gare de Lyon, Paris Gare du Nord, Paris Gare de l’Est et Paris Saint-Lazare ;
- placement de ces gares à leurs coordonnées propres au lieu du centroïde communal de Paris ;
- migration des anciennes références `PAR` et `COM_75056` vers `PAR_GARE_DU_NORD` pour éviter les lignes orphelines ;
- ajout d’une exception de dédoublonnage contrôlée pour les communes multi-gares : plusieurs gares peuvent partager le code INSEE `75056` uniquement si elles ont des IDs et codes UIC distincts ;
- ajout de la fréquentation annuelle 2024 aux grandes gares parisiennes ;
- recalcul du prix d’achat des grandes gares parisiennes selon leur fréquentation, avec une formule commençant à 100 000 € pour les très petites gares et une progression forte pour les hubs ;
- affichage de la fréquentation annuelle dans la fiche de gare et les libellés de recherche.

## Version v62.10.0 — lignes multi-trains et tracés RFN renforcés

- incrément de version : badge interface `v62.10.0`, package `0.6.10` et schéma serveur `74` ;
- ajout du changement de type de transport dans le menu de modification des lignes : `Voyageurs`, `Fret` ou `Mixte` ;
- ajout de l’affectation de plusieurs trains à une même ligne depuis le menu de modification ;
- les trains affectés à une ligne sont validés côté serveur : pas de train déjà utilisé ailleurs, pas de train en maintenance, portée minimale suffisante et compatibilité avec le service demandé ;
- les statistiques d’exploitation agrègent désormais la capacité, le fret, la consommation, la maintenance, la fiabilité et le confort des trains affectés à la ligne ;
- les besoins en conducteurs et mainteneurs tiennent compte du nombre de trains sur une ligne ;
- la carte affiche les circulations de tous les trains affectés à une ligne au lieu d’un seul train principal ;
- renforcement de la priorité RFN pour les tracés entre gares réelles : le client interroge maintenant le serveur RFN avant les restrictions Overpass, même pour les trajets plus longs ;
- correction du graphe RFN serveur : jonctions moins fragiles, zone de recherche élargie, Dijkstra autorisé sur davantage de nœuds et garde-fou de détour moins agressif afin de suivre la voie réelle via les gares intermédiaires quand elles existent ;
- ajout de la portée dans `Parc -> Composition`, dans la liste des trains et les métriques de l’atelier ;
- correction explicite du badge de version en bas à droite, qui affiche maintenant la même version que le serveur.

## Version v62.9.0 — compositions payantes, carte corrigée et optimisation des tracés

- incrément de version : badge interface `v62.9.0`, package `0.6.9` et schéma serveur `73` ;
- correction de la mise en page `Parc -> Composition` : la liste des trains ne déborde plus du cadre et l’éditeur utilise une colonne fluide ;
- ajout d’une économie de composition : les voitures, wagons et unités motrices ajoutés sont facturés selon la valeur du matériel ;
- ajout du remboursement des voitures/wagons retirés, calculé à 78 % de leur valeur puis corrigé par l’état d’usure du train ;
- prise en compte de la valeur réelle de la composition lors de la revente d’un train afin d’éviter les incohérences après retrait de voitures ou wagons ;
- ajout d’une confirmation avant modification de composition quand l’opération coûte de l’argent ou génère un remboursement ;
- audit performance de la création de lignes longues : cache serveur des géométries SNCF/RFN, Dijkstra RFN accéléré par file de priorité et réutilisation de la distance déjà calculée lors de la création ;
- réduction des appels concurrents de géométrie côté client pour éviter de saturer le serveur quand une ligne comporte beaucoup d’arrêts ;
- renforcement du placement des gares SNCF : extraction plus robuste des champs, appairage plus strict par code commune INSEE et distance maximale contrôlée ;
- ajout d’un audit automatique des placements incohérents avec correction ciblée de Grigny vers `Grigny Centre` quand les données SNCF ne sont pas encore disponibles.

## Version v62.8.0 — progression d’époque au trafic et création de gare payante

- incrément de version : badge interface `v62.8.0`, package `0.6.8` et schéma serveur `72` ;
- suppression du prérequis temporel des passages d’époque : il n’y a plus de délai réel minimum entre deux ères ;
- remplacement du ralentissement temporel par des seuils de trafic cumulés fortement augmentés : 15 000 000 pour le diesel, puis 75 000 000, 300 000 000, 1 200 000 000, 4 000 000 000 et 12 000 000 000 pour les ères suivantes ;
- retrait de l’indicateur `Temps dans l’époque` de l’onglet R&D ;
- ajout du prix d’achat dans la fiche et l’infobulle de chaque gare ;
- création des points manuels rendue explicitement payante avec une fenêtre de validation indiquant le prix proposé avant débit ;
- calcul du prix des points manuels à partir du potentiel local et des prix des gares proches, pour éviter un tarif fixe uniforme ;
- mémorisation du coût de création d’une point manuel afin que sa revente rembourse bien la valeur de création.


## Version v62.7.0 — péages limités aux gares et progression d’époque ralentie

- incrément de version : badge interface `v62.7.0`, package `0.6.7` et schéma serveur `71` ;
- suppression du péage de tronçon symétrique : deux joueurs qui circulent sur le même segment ne se paient plus mutuellement ;
- conservation d’un seul péage : une compagnie paie uniquement lorsqu’une ligne dessert une gare possédée par un autre joueur ;
- mise à jour des libellés financiers pour distinguer clairement les `Péages de gares` des coûts d’entretien de ligne ;
- ajout d’un délai réel minimum de 60 heures dans chaque époque avant de pouvoir débloquer la suivante, en plus des prérequis de technologie et de trafic ;
- ajout d’un indicateur `Temps dans l’époque` dans l’onglet R&D.

## Version v62.6.0 — tracés fictifs plus doux au dézoom

- incrément de version : badge interface `v62.6.0`, package `0.6.6` et schéma serveur `70` ;
- amélioration du fallback des itinéraires sans géométrie SNCF/RFN ou Overpass : le tracé reste sinueux mais utilise maintenant un corridor à courbure progressive ;
- réduction des changements de direction trop serrés et de l'amplitude excessive des méandres ;
- suréchantillonnage du tracé par spline Catmull-Rom pour supprimer les cassures visuelles quand la carte est dézoomée ;
- rendu des lignes avec jointures et extrémités arrondies afin d'éviter les angles agressifs sur les tracés fictifs.

## Version v62.5.0 — fallback sinueux des tracés sans géométrie SNCF

- incrément de version : badge interface `v62.5.0`, package `0.6.5` et schéma serveur `69` ;
- remplacement du fallback visuel des tronçons sans géométrie SNCF/RFN ou Overpass : l'ancien arc unique est supprimé au profit d'un tracé sinueux déterministe ;
- conservation des coordonnées exactes des gares en début et fin de tronçon, sans déplacement des points officiels ;
- génération stable par paire de gares : le même tronçon garde la même forme à chaque affichage, dans les deux sens ;
- les géométries officielles SNCF/RFN et les tracés réels chargés restent prioritaires ; le fallback sinueux ne s'applique que lorsqu'aucun tracé réel exploitable n'est disponible.

## Version v62.4.0 — revente des gares et péages de desserte

- incrément de version : badge interface `v62.4.0`, package `0.6.4` et schéma serveur `68` ;
- ajout d’une action de vente des gares possédées, accessible depuis la fiche de gare et la liste des gares exploitées ;
- calcul du remboursement en additionnant la valeur actuelle de la gare, des niveaux construits, des commerces, des ateliers de maintenance et du dépôt ;
- blocage de la vente lorsqu’une ligne active, du joueur ou d’un autre compte, dessert encore la gare afin d’éviter des lignes actives rattachées à une gare redevenue libre ;
- conservation de la possibilité de créer une ligne passant par une gare possédée par un autre joueur ;
- ajout du péage de gare explicite : une ligne qui dessert une gare concurrente paie un montant récurrent au propriétaire, en complément des droits déjà calculés sur les tronçons partagés ;
- détail financier enrichi avec `stationAccessCost` et `infrastructurePassageCost`, tout en conservant `accessCost` comme total de péage.

## Version v62.3.0 — suppression des compagnies IA

- incrément de version : badge interface `v62.3.0`, package `0.6.3` et schéma serveur `67` ;
- suppression définitive de la génération automatique de concurrents IA pendant la simulation ;
- nettoyage de la sauvegarde : seules les compagnies réellement liées à un compte utilisateur sont conservées ;
- retrait du champ technique `nextNpcAt`, devenu inutile ;
- les calculs de marché, d’usage d’infrastructure, de droits de passage, de classement public et d’administration ne prennent plus en compte de compagnies sans compte ;
- remplacement du libellé `IA / sans compte` par `Sans compte lié` dans l’interface admin, au cas où une ancienne sauvegarde externe contiendrait encore un joueur orphelin.

## Version v62.2.0 — reconstruction officielle des gares et villes

- incrément de version : badge interface `v62.2.0`, package `0.6.2` et schéma serveur `66` ;
- suppression de l’affichage public des anciennes gares manuelles lorsque le cache communes officiel est disponible ;
- reconstruction des points jouables depuis `gares-de-voyageurs` : association stricte par code commune INSEE, lecture de `nom_gare`, `position_geographique`, `code_commune`, `code_uic`, `id_gare` et `trigramme` ;
- placement des communes sans gare voyageurs sur les coordonnées officielles `geo.api.gouv.fr/communes`, sans projection automatique sur une voie ferrée voisine ;
- invalidation automatique de l’ancien cache de communes afin de forcer une reconstruction avec le nouveau schéma de placement ;
- migration des anciennes références de gares internes (`CAE`, `BAY`, etc.) vers leurs identifiants communes `COM_...` pour préserver les lignes et gares déjà possédées ;
- ajout d’un contrôle anti-doublons `npm run check:stations` vérifiant IDs, codes INSEE, codes UIC, coordonnées de gares et coordonnées publiques + noms ;
- maintien du garde-fou de distance : les trajets locaux incohérents, comme Dreux — Vernouillet, retombent sur une distance directe cohérente au lieu d’un détour ferroviaire absurde.

## Version v62.1.0 — administration Xenao et tracés SNCF RFN

- incrément de version : badge interface `v62.1.0`, package `0.6.1` et schéma serveur `65` ;
- attribution de `10 000 000 €` de trésorerie à la compagnie `Raphaële` dans `data/save.json` ;
- ajout d’un panneau `Admin` visible et utilisable uniquement par le compte `Xenao` ;
- ajout d’une API admin protégée permettant de modifier chaque compagnie : nom, trésorerie exacte, variation de trésorerie et JSON joueur avancé ;
- ajout d’un journal de connexions horodatées par compte, conservant les 250 dernières connexions avec date, IP et navigateur quand disponibles ;
- exposition du tableau de bord admin uniquement dans l’état public envoyé au compte `Xenao`, sans diffuser les hashs de mots de passe ;
- bascule de la source gares SNCF vers `gares-de-voyageurs`, avec lecture des coordonnées GPS `position_geographique`, du code commune et du code UIC quand ils sont disponibles ;
- ajout d’un chargement serveur des géométries `formes-des-lignes-du-rfn` en GeoJSON, avec cache local, graphe ferroviaire et calcul d’itinéraire RFN entre deux gares ;
- le client demande maintenant d’abord la géométrie RFN au serveur avant d’utiliser les fallbacks Overpass ou internes ;
- correction des distances incohérentes entre gares proches : ajout de raccourcis locaux cohérents et garde-fou de distance pour éviter des détours absurdes comme Dreux — Vernouillet affiché à environ 149 km.

## Version v62.0.0 — refonte ferroviaire de la carte

- incrément majeur de version : badge interface `v62.0.0`, package `0.6.0` et schéma serveur `64` ;
- ajout d’un moteur de placement ferroviaire : les villes issues des communes sont désormais positionnées visuellement sur la gare connue ou, à défaut, projetées sur le tronçon ferroviaire le plus proche quand celui-ci est cohérent avec la ville ;
- conservation des coordonnées d’origine des communes dans les données publiques, avec indication du mode de placement (`station`, `rail-snap` ou `commune`) ;
- ajout d’une table publique `railSegments` permettant au client de connaître les tronçons ferroviaires internes ;
- le serveur relie désormais les villes non présentes dans le graphe ferroviaire aux tronçons les plus proches, plutôt qu’à de simples gares voisines arbitraires ;
- le calcul des distances et des itinéraires utilise les coordonnées ferroviaires projetées quand elles existent ;
- le rendu de carte utilise les coordonnées ferroviaires projetées pour les pastilles, la sélection et les tracés ;
- ajout d’un chargement progressif de géométries ferroviaires réelles côté client : quand un tronçon ferroviaire public est disponible dans les données de voies, le tracé suit la géométrie des rails ;
- fallback conservé : si aucune géométrie ferroviaire détaillée n’est disponible ou si la requête est trop large, le jeu utilise le graphe ferroviaire interne et ses corridors.

## Version v61.3.2 — revenus voyageurs bornés et effets salariés rationalisés

- incrément de version de cette passe : badge interface `v61.3.2`, package `0.5.7` et schéma serveur `63` ;
- recalcul des revenus voyageurs sur une base plus stricte : demande captée × distance × prix unitaire au kilomètre ;
- ajout d’un prix de billet ajusté à la demande, mais borné pour éviter les montants extravagants ;
- baisse du plafond de billet pour éviter que d’anciennes sauvegardes ou des réglages extrêmes produisent des revenus incohérents ;
- baisse du multiplicateur global de revenus voyageurs ;
- les effets salariés sont maintenant appliqués comme modificateurs bornés par rapport aux besoins RH globaux de la compagnie ;
- les Contrôleurs donnent au maximum +15 % de revenus voyageurs quand l’effectif requis est atteint ;
- les Agents de gare et Régulateurs ne peuvent plus amplifier brutalement les revenus ou la capacité ;
- clarification des descriptions Budget pour `Vente & distribution`, `Contrôle & fraude` et `Organisation commerciale`.

## Version v61.3.1 — correction contrôleurs et nettoyage Budget

- incrément de version de cette passe : badge interface `v61.3.1`, package `0.5.6` et schéma serveur `62` ;
- suppression du bandeau de synthèse `Recettes / Dépenses / Résultat / Marge` dans l’onglet Budget ;
- centrage du bouton `France` dans les contrôles de carte ;
- correction de l’effet des Contrôleurs : ils ne multiplient plus la capacité, l’attractivité ni les bénéfices de façon excessive ;
- l’effet des Contrôleurs est plafonné à +15 % de revenus voyageurs lorsque l’effectif nécessaire est atteint ;
- les Contrôleurs réduisent désormais les dépenses `Vente & distribution` et `Contrôle & fraude`, au lieu de les augmenter mécaniquement ;
- les dépenses commerciales sont calculées sur la base commerciale hors bonus de contrôle, afin d’éviter les incohérences de budget.

## Version v61.3.0 — dépenses clarifiées, péages et coûts partagés

- incrément de version de cette passe : badge interface `v61.3.0`, package `0.5.5` et schéma serveur `61` ;
- triplement du coût d’entretien des lignes ;
- partage du coût d’entretien d’un tronçon entre les joueurs qui utilisent le même tronçon ;
- séparation des `Péages` côté dépenses et des `Droits de passage` côté recettes ;
- les droits de passage sont maintenant alimentés par les autres joueurs qui empruntent des tronçons déjà utilisés par ta compagnie ;
- remplacement du poste vague `Exploitation commerciale` par trois postes détaillés : `Vente & distribution`, `Contrôle & fraude`, `Organisation commerciale` ;
- affichage des sections `Recettes` et `Dépenses` côte à côte dans l’onglet Budget sur les écrans assez larges ;
- ajout d’une indication claire en R&D : un coût/h de laboratoire s’ajoute pendant toute la durée d’un projet actif ;
- ajout dans l’onglet Gares du coût/h lié aux commerces, aux ateliers et aux dépôts.

## Version v61.2.0 — budget simplifié et dépenses regroupées

- incrément de version de cette passe : badge interface `v61.2.0`, package `0.5.4` et schéma serveur `60` ;
- suppression définitive des lignes `Écart variable temporaire` et `Écart de charges fixes temporaire` dans l’onglet `Budget` ;
- regroupement des anciennes sections `Dépenses variables d’exploitation` et `Charges fixes` dans une section unique `Dépenses` ;
- déplacement de la section `Résultat et structure financière` en haut de la page, juste après les indicateurs de synthèse ;
- retrait des lignes `Recettes cumulées`, `Dépenses cumulées` et `Profit cumulé` de cette section ;
- conservation du détail utile : résultat net courant, trésorerie disponible, dette totale, recettes, dépenses et détail par ligne.

## Version v61.1.1 — budget détaillé et libellés financiers corrigés

- incrément de version de cette passe : badge interface `v61.1.1`, package `0.5.3` et schéma serveur `59` ;
- suppression des lignes de total en bas des sections du budget, car les montants de synthèse sont déjà affichés dans l’en-tête des catégories ;
- suppression du libellé vague `Autres coûts variables` ;
- ajout du poste explicite `Exploitation commerciale`, correspondant aux frais progressifs liés aux volumes encaissés : vente, exploitation, contrôle et organisation commerciale ;
- ajout de `commercialOperatingCost` dans le détail serveur `lastBreakdown`, afin que le budget ne regroupe plus ce coût dans une catégorie indéterminée ;
- correction de la tooltip financière de la barre supérieure : remplacement de `Production` et `Consommation` par `Revenus` et `Dépenses` ;
- correction de la classification couleur des tooltips financières utilisant les nouveaux libellés.

## Version v61.1.0 — lignes repliables, finance de ligne clarifiée et marge réduite

- incrément de version de cette passe : badge interface `v61.1.0`, package `0.5.2` et schéma serveur `58` ;
- ajout d’un bouton `Réduire / Déplier` sur chaque ligne possédée dans `Lignes > Modifier` ;
- les lignes repliées conservent un résumé lisible : train, distance, fréquence et résultat net par heure ;
- réorganisation des pastilles `Finance /h` en grille propre, séparant visuellement recettes et dépenses ;
- ajout d’un poste `Exploitation commerciale` dans les frais variables des lignes ;
- rééquilibrage économique des lignes très rentables : les recettes élevées supportent maintenant des coûts commerciaux progressifs afin de ramener la marge nette d’une ligne isolée vers une plage beaucoup plus raisonnable ;
- conservation du détail financier existant : billets, services, fret, régulation, énergie, maintenance train, entretien ligne et péages.

## Version v61.0.0 — tutoriel guidé complet pour tous les joueurs

- incrément de version de cette passe : badge interface `v61.0.0`, package `0.5.0` et schéma d’état serveur `57` ;
- ajout d’un tutoriel guidé persistant pour tous les joueurs, y compris les compagnies déjà en cours via migration automatique de la sauvegarde ;
- ajout d’un état tutoriel sauvegardé par compagnie : étape courante, activation, achèvement et actions déjà validées ;
- ajout d’un bouton `Tutoriel` dans la barre supérieure pour relancer le parcours à tout moment ;
- ajout de pastilles et d’un halo de ciblage dans la DA du jeu, avec carte explicative pointant vers les boutons, onglets, sous-onglets et champs importants ;
- parcours détaillé de démarrage : vue générale, achat d’un train, réglage manuel de composition, enregistrement de la composition, création d’une ligne, choix départ/terminus, train, fréquence et prix ;
- progression automatique quand l’action attendue est réellement effectuée : achat de train, sauvegarde de composition, création de ligne, changement d’onglet ou de sous-onglet ;
- explication des menus importants : `Vue`, `Lignes`, `Parc`, `Gares`, `RH`, `R&D`, `Énergie`, `Marché` et `Budget` ;
- le tutoriel reste compatible avec les parties avancées : les étapes déjà satisfaites par l’état de la compagnie peuvent être validées sans bloquer le joueur ;
- ajout d’actions serveur dédiées au tutoriel pour avancer, terminer, masquer ou relancer le parcours sans dépendre du stockage local du navigateur.

## Version v60.51.0 — usure progressive, immobilisation et rééquilibrage économique

- incrément de version de cette passe : badge interface `v60.51.0`, package `0.4.44` et schéma d’état serveur `56` ;
- refonte du rythme d’usure des trains : un matériel en service passe désormais de 100 % à 0 % sur une base de 12 à 36 heures selon sa génération, avec modulation par l’intensité de service, la politique de maintenance, les mainteneurs et les recherches ;
- l’état du train influe maintenant directement sur sa vitesse effective et sa fiabilité : plus l’état baisse, plus la vitesse, la ponctualité et l’attractivité se dégradent ;
- à 0 %, le train est immobilisé : la ligne associée ne transporte plus de voyageurs ou de fret, ne génère plus de recettes et n’affiche plus de train animé sur la carte ;
- l’onglet `Parc > Maintenance` affiche désormais l’état du train au niveau de la barre d’état, avec le temps estimé avant immobilisation à 0 % ;
- suppression de l’ancien affichage de l’état en haut à droite de la carte de train, remplacé par un statut de disponibilité plus clair ;
- rééquilibrage économique de début de jeu : recettes voyageurs plus contenues, coûts de maintenance et d’infrastructure plus structurants, objectif d’une première ligne autour d’environ 1 M€/h de recettes et quelques centaines de milliers d’euros/h de marge nette en exploitation correcte ;
- sauvegarde de départ ajustée : train initial remis à 100 %, effectif initial aligné sur les besoins de la ligne Caen → Bayeux et stock de charbon conservé à 100 unités.

## Version v60.50.2 — correction inscription mobile

- Incrément de version de cette passe : badge interface `v60.50.2`, package `0.4.43` et schéma d’état serveur `55` ;
- Correction du formulaire de connexion / création de compte sur téléphone : la fenêtre d’inscription peut maintenant défiler verticalement ;
- Ajustement de la carte d’inscription sur petits écrans : marges réduites, bloc logo compact et sélecteur de logos moins haut ;
- Le bouton `Créer le compte` reste accessible même quand le clavier mobile ou la hauteur réduite de l’écran limite l’espace disponible ;
- Aucun changement de gameplay ni de données économiques dans cette passe.

## Version v60.50.1 — correction RH et charbon de départ

- Incrément de version de cette passe : badge interface `v60.50.1`, package `0.4.42` et schéma d’état serveur `54` ;
- Correction visuelle des vignettes RH : lorsqu’un métier est en sous-effectif par rapport au besoin estimé, toute la vignette est désormais teintée en rouge ;
- Suppression de la ligne `Couverture` dans les vignettes RH ;
- Suppression des pastilles d’en-tête visibles dans l’onglet `RH` ;
- Simplification des infobulles des boutons `-1`, `+1` et `+5` : elles affichent uniquement le résultat direct de l’action ;
- Ajout d’une infobulle dédiée sur chaque vignette métier, décrivant l’apport réel du métier dans le moteur du jeu ;
- Correction de l’affichage des salaires dans les infobulles RH pour éviter le doublon `/h/h` ;
- Le départ de jeu préparé contient maintenant seulement `100` unités de charbon ;
- Les nouvelles compagnies créées démarrent également avec `100` unités de charbon.

## Version v60.50.0 — RH lisible et typage fiable des lignes

- Incrément de version de cette passe : badge interface `v60.50.0`, package `0.4.41` et schéma d’état serveur `53` ;
- réorganisation des boutons RH : le bouton `-1` est maintenant placé avant `+1` et `+5` ;
- restructuration des infobulles RH en lignes distinctes : action, coût, salaire, besoin, effectif après action, statut et effet métier ;
- les vignettes RH en sous-effectif sont maintenant teintées en rouge sur toute leur surface, comme les vignettes de ligne en anomalie ;
- correction de la détection `Voyageur` / `Fret` des lignes : le type affiché se base d’abord sur le mode de composition explicite du matériel roulant, et non plus sur une comparaison fragile capacité/fret ;
- correction du cas de la sauvegarde de départ : la ligne Caen → Bayeux équipée en composition voyageurs n’est plus affichée comme ligne fret ;
- durcissement préventif : si une ligne possède des arrêts valides, son nom public est toujours reconstruit sous la forme `Gare d’origine → Gare de destination`, sans réutiliser un ancien code interne.

## Version v60.49.0 — RH compacte, carte neutralisée, animation trains et noms de lignes

- incrément de version de cette passe : badge interface `v60.49.0`, package `0.4.40` et schéma d’état serveur `52` ;
- réorganisation de l’onglet `RH` avec des vignettes compactes affichées trois par rangée sur écran large ;
- réduction de la hauteur des cartes RH : résumé du rôle, couverture, salaire, coût de recrutement et actions restent visibles sans déroulé excessif ;
- retrait des mentions cartographiques techniques visibles par le joueur dans l’interface et dans le changelog affiché par le popup ;
- correction de l’animation des trains : la phase de déplacement est maintenant conservée côté client entre deux états serveur, ce qui évite les sauts/téléportations lors des ticks ;
- l’adaptation de la vitesse aux statistiques du matériel est conservée, mais les variations d’état ou de fréquence ne réinitialisent plus la position visuelle ;
- les cartes de lignes n’affichent plus le code interne `COM-001` comme nom visible ;
- les lignes sont présentées sous la forme `Gare d’origine → Gare de destination` ;
- ajout d’une pastille de type à côté du nom de ligne, déterminée depuis la composition effective du matériel roulant : `Voyageur` ou `Fret` ;
- remplacement des affichages secondaires utilisant encore le code interne de ligne dans les affectations de trains, les ressources et le budget.

## Version v60.48.1 — capitalisation UI et salaires RH stables

- incrément de version de cette passe : badge interface `v60.48.1`, package `0.4.39` et schéma d’état serveur `51` ;
- passe de capitalisation sur les textes visibles ajoutés/modifiés récemment : débuts de phrases après deux-points, infobulles, détails de budget et messages RH ;
- capitalisation des noms de métiers exposés par l’équilibrage serveur : `Conducteur`, `Contrôleur`, `Agent de gare`, `Mainteneur`, `Régulateur` et `Agent de l’infra` ;
- correction de la fluctuation des salaires RH à chaque tick serveur ;
- cause corrigée : les salaires étaient multipliés par `state.market.labor`, qui dérive légèrement à chaque mise à jour du marché même quand aucun effectif ne change ;
- les salaires et coûts de recrutement sont maintenant fixes tant que le nombre de salariés et les éventuels bonus de recherche ne changent pas ;
- conservation du marché du travail dans l’état de marché, mais il n’est plus appliqué aux salaires RH récurrents.

## Version v60.48.0 — onglet Budget et réorganisation des besoins RH

- incrément de version de cette passe : badge interface `v60.48.0`, package `0.4.38` et schéma d’état serveur `50` ;
- retrait des `agents de gare` dans la vignette `Salariés nécessaires` des fiches de ligne du menu `Modifier` ;
- intégration des besoins en agents de gare directement dans l’onglet `Gares`, avec une barre de couverture dédiée, les gares exploitées, les lignes actives et les arrêts intermédiaires ;
- uniformisation de la ligne `Conducteurs` dans la vignette des lignes : elle utilise désormais la même présentation en barre que les autres métiers ;
- ajout d’un nouvel onglet principal `Budget` ;
- l’onglet `Budget` détaille les recettes, dépenses variables, charges fixes, résultat net, trésorerie, dette, cumul financier et détail par ligne ;
- ajout d’un code couleur clair : recettes en positif, dépenses en négatif, résultat net selon son signe ;
- toutes les grandes catégories du budget sont réductibles et mémorisées localement ;
- enrichissement du détail financier serveur : billets, services, fret, bonus régulation, énergie, maintenance matériel, entretien des lignes, péages et charges fixes sont exposés séparément.

## Version v60.47.0 — métiers de ligne affinés et entretien d’infrastructure

- incrément de version de cette passe : badge interface `v60.47.0`, package `0.4.37` et schéma d’état serveur `49` ;
- refonte de la vignette `Salariés nécessaires` dans le menu `Modifier` des lignes : les anciennes cases ont été retirées et remplacées par des barres de couverture scrollables et lisibles ;
- la barre supérieure des conducteurs affiche maintenant le stock disponible et le besoin de la ligne, puis les autres métiers sont présentés sous forme de barres : contrôleurs, agents de gare, mainteneurs, régulateurs et agents de l’infra ;
- confirmation et maintien du caractère obligatoire des conducteurs : sans conducteur, un train ne peut toujours pas exploiter sa ligne ;
- ajout d’un effet direct des contrôleurs sur les recettes voyageurs via une réduction simulée de la fraude ;
- ajout d’un effet direct des agents de gare sur la satisfaction et sur le flux voyageurs capté par les lignes ;
- renforcement du rôle des mainteneurs : ils ralentissent désormais explicitement la vitesse d’usure, donc la fréquence à laquelle les trains réclament une maintenance ;
- renforcement du rôle des régulateurs : ils améliorent la ponctualité et apportent aussi un bonus direct aux revenus des lignes ;
- transformation des `ingénieurs` en `agents de l’infra`, avec un nouveau rôle dédié à la réduction des coûts d’entretien des lignes ;
- ajout d’un nouveau coût variable `entretien ligne`, calculé au prorata de la distance de chaque ligne et répercuté sur le coût global au kilomètre exploité par le joueur ;
- ajout du détail financier de ligne correspondant dans les panneaux d’analyse : énergie, maintenance train, entretien ligne et péages sont maintenant visibles séparément.

## Version v60.46.0 — conducteurs requis et besoins salariés par ligne

- incrément de version de cette passe : badge interface `v60.46.0`, package `0.4.36` et schéma d’état serveur `48` ;
- ajout d’un blocage réel de l’exploitation en cas d’absence de conducteurs : avec 0 conducteur disponible, les lignes actives ne produisent plus de trafic, de recettes ni de consommation ;
- ajout d’une réduction proportionnelle de la fréquence effective lorsque les conducteurs disponibles sont inférieurs au besoin total de la compagnie ;
- la réduction est répartie au prorata des besoins conducteurs de chaque ligne : une ligne qui demande plus de conducteurs reçoit une part plus importante, mais toutes les lignes subissent la même couverture globale ;
- les marchés, l’attractivité, la capacité, la consommation de ressources, les coûts variables, l’usure et les trains affichés tiennent compte de cette fréquence effective ;
- ajout dans les fiches de lignes du sous-onglet `Modifier` d’une vignette `Salariés nécessaires` listant les besoins par métier : conducteurs, contrôleurs, agents de gare, mainteneurs, régulateurs et ingénieurs ;
- la vignette indique aussi la couverture conducteurs et signale la fréquence réduite si l’effectif est insuffisant ;
- les lignes en manque de conducteurs affichent maintenant un statut explicite `Conducteurs insuffisants`.

## Version v60.45.1 — correction du clic sur le badge de version

- correction du bug empêchant l’ouverture du popup changelog au clic sur le badge de version ;
- cause corrigée : le script initialisait l’écouteur avant que le bouton `#versionBadge` soit présent dans le DOM ;
- remplacement de l’écoute directe par une écoute déléguée au document, afin que le clic fonctionne même si le badge est injecté ou placé après le script ;
- mise à jour du badge interface en `v60.45.1` et du package en `0.4.35` ;
- aucun changement du schéma de sauvegarde, car la correction ne modifie pas les données serveur.

## Version v60.45.0 — badge de version cliquable et popup changelog

- adoption du format de version complet `XX.YY.ZZ` demandé : badge interface `v60.45.0`, package `0.4.34` et schéma d’état serveur `47` ;
- transformation du badge de version en bouton cliquable, tout en conservant son affichage discret en bas à droite ;
- ajout d’une route serveur `/api/changelog` qui expose le contenu de `changelog.md` sans rendre le fichier directement public ;
- ouverture d’un popup dédié au changelog depuis le badge de version ;
- le popup présente les versions de la plus récente à la plus ancienne, même si le fichier source contient d’anciennes sections dans un autre ordre ;
- ajout d’une zone scrollable dans le popup pour consulter l’historique complet sans sortir de l’interface ;
- rendu HTML léger du Markdown du changelog : titres, listes, paragraphes et codes inline ;
- conservation de `data/save.json` dans l’archive, sans `HANDOFF.md` ni `handoff_manifest.json`.

## Version v6

Ajouts principaux :

- maintenance complète du matériel roulant ;
- politiques de maintenance : économie, standard, préventive, intensive ;
- interventions : révision légère, révision atelier, grande révision, rénovation complète ;
- immobilisation réelle des trains en atelier ;
- effet de l’état du matériel sur la ponctualité, les coûts, la fiabilité et la production ;
- nouvel arbre de recherche avec sous-menus ;
- recherches concrètes débloquant du matériel, des interventions, des bonus énergie, fret, gares, RH et exploitation.

## Version v9

- carte retravaillée pour coller beaucoup plus fidèlement au visuel pixel-art ;
- positionnement des villes recalibré par ancrages visuels ;
- tracés ferroviaires d'affichage améliorés avec des segments guidés ;
- zoom molette + déplacement glissé ;
- bascule progressive vers une vue isométrique quand le zoom augmente ;
- commandes de zoom intégrées à l'interface.

## Version v10 — Carte interactive

- Carte principale remplacée par une carte Carte interactive via moteur cartographique.
- Ajout d'une surcouche canvas pour les gares, lignes et trains animés.
- Possibilité de créer un point manuel n'importe où en France via le bouton **Créer point**.
- Les points manuels sont sauvegardés dans `data/save.json`.
- Les lignes peuvent être créées entre gares de base et points Carte manuels.
- Le moteur économique existant reste utilisé : demande, fret, tourisme, coût de ligne, maintenance, trains, énergie, salariés et recherche.
- Les trains restent animés sur la surcouche de carte.
- Le zoom et le déplacement sont gérés par moteur cartographique/Carte interactive.
- À fort zoom, l'interface indique une vue isométrique visuelle pour les circulations et les sprites.

Note : cette version utilise les fonds cartographiques Carte interactive depuis Internet. Sans connexion, la carte Carte ne pourra pas charger ses fonds cartographiques.

## Version v11 — Villes population réelle et recherche textuelle

- Chargement automatique des communes françaises avec leur population réelle via `geo.api.gouv.fr`.
- Cache local dans `data/communes-population.json` pour éviter de retélécharger la liste à chaque lancement.
- Les communes chargées deviennent des points jouables dans le moteur : création de ligne, calcul de distance, demande voyageurs, fret, tourisme, affichage carte.
- Les points de communes sont masqués quand la carte est dézoomée, puis apparaissent progressivement selon le niveau de zoom.
- Le formulaire de création de ligne utilise maintenant une recherche textuelle avec suggestions au lieu de longs menus déroulants.
- Les gares principales, communes ≥population réelle et points manuels sont recherchables.

Note : le premier chargement complet des communes nécessite une connexion Internet, comme la carte Carte interactive. Si le téléchargement échoue, le jeu reste jouable avec les gares de base et les points Carte manuels.

## Version v12

- suppression de la catégorie `communes ≥population réelle` dans le choix de région de départ ;
- thème de la carte Carte interactive recoloré pour s'aligner sur l'interface sombre bleu nuit / laiton ;
- nouveaux bandeaux d'illustration pour tous les menus principaux, au bon format, sans rognage, dans la même DA pixel-art ;
- carte désormais conservée à l'écran en permanence, avec interface élargie pour rendre tous les menus utilisables sans masquer la carte.

## Version v13 — correction UI demandée

Cette version corrige réellement les points demandés après la v12 :

- la catégorie `communes ≥population réelle` n'apparaît plus dans le choix de région de départ ;
- le bouton de masquage de carte est retiré : la carte reste visible en permanence ;
- la mise en page est reconstruite avec une carte permanente à gauche et des menus utilisables à droite ;
- les onglets sont accessibles via une barre horizontale défilable si nécessaire ;
- la carte utilise désormais un fond sombre basé sur les données Carte interactive/style cartographique, plus proche de la charte graphique ;
- les fonds cartographiques sont recolorées dans une ambiance bleu nuit / laiton ;
- les bandeaux des menus sont intégrés avec de vraies balises image en `object-fit: contain`, afin d'éviter le rognage ;
- les images générées pour les menus principaux sont intégrées dans `public/assets/art/`.

## Version v14 — réparation après audit

Correctifs :

- correction du crash JavaScript au démarrage : le code essayait encore d'attacher un listener à `#mapToggleBtn`, alors que le bouton avait été supprimé en v13 ;
- l'application ne s'arrêtait donc plus au chargement du front ;
- le bouton de masquage de carte reste supprimé, mais le code est maintenant robuste ;
- vérification serveur : `GET /api/state`, création de joueur, création de ligne, politique de maintenance ;
- vérification syntaxique : `server.js` et `public/app.js`.

Note : le message serveur `Chargement communes ≥population impossible: fetch failed` n'est pas bloquant. Il indique seulement que le serveur n'a pas pu joindre l'API des communes pendant le test. Le jeu démarre quand même avec les gares de base et utilisera le cache local si disponible.

## Version v15 — correction carte + infobulles

Correctifs carte :

- correction du canvas de surcouche qui gardait des dimensions CSS héritées (`height: calc(...)`) au lieu d'occuper tout le conteneur moteur cartographique ;
- ajout d'un recalcul fiable de la taille du canvas ;
- ajout d'un `ResizeObserver` sur la carte ;
- appel sécurisé à `leaflet.invalidateSize()` après changements de layout/zoom/déplacement ;
- stabilisation du rendu pour éviter les zones vides sur le côté droit lors du zoom ou du déplacement.

Ajouts UX :

- infobulles explicatives sur les actions ambiguës ;
- bouton `Électrifier` affiche le coût avant clic et explique les effets ;
- infobulles sur achat/vente de trains, maintenance, politique de maintenance, améliorations de gare, RH, recherche, énergie, emprunts et contrôles de carte.

## Version v16 — fonds fixes par menu

- les images de chaque menu ne sont plus affichées comme gros bandeaux en haut ;
- chaque image devient un arrière-plan fixe du panneau de menu correspondant ;
- le contenu du menu défile au-dessus, sans déplacer l’image ;
- la barre d’onglets a été redessinée en boutons arrondis, sans ligne parasite derrière ;
- les cartes internes ont été renforcées visuellement pour rester lisibles sur les fonds illustrés.

## Version v17 — lisibilité carte, tooltips et RH

- les tooltips sont maintenant rendus dans une infobulle globale en position fixe ;
- les infobulles sont automatiquement contraintes à l'intérieur de la fenêtre ;
- remplacement du fond Carte sombre trop noir par des fonds cartographiques style cartographique Voyager recolorées bleu nuit / doré ;
- détails de carte beaucoup plus lisibles tout en restant dans la DA ;
- onglet RH enrichi : chaque métier affiche son besoin estimé, son taux de couverture, son statut et ses effets concrets ;
- les fonds de menus sont rendus plus visibles via une baisse d'opacité des cartes et un fond illustré plus clair.

## Version v18 — RH liée aux circulations + tracés routés

- les besoins RH ne dépendent plus seulement du nombre de lignes ;
- les conducteurs nécessaires sont calculés à partir de la fréquence quotidienne et de la distance :
  - une ligne courte/moyenne à 8 circulations/jour demande environ 4 conducteurs ;
  - les longues lignes augmentent progressivement ce besoin ;
- les contrôleurs, régulateurs, mécaniciens et agents de gare utilisent aussi une logique plus liée à l'exploitation réelle ;
- les besoins calculés sont exposés dans l'API via `staffNeeds` ;
- les tracés de lignes ne sont plus de simples segments droits :
  - le client tente de récupérer une géométrie calcul d’itinéraire/Carte interactive entre les deux points ;
  - si l'API externe est indisponible, un tracé courbe de secours est utilisé ;
- l'opacité des menus a encore été abaissée pour mieux voir les images de fond.

## Version v19 — matériel roulant, doublons de gares et opacité

- opacité des menus encore réduite pour rendre les images d’arrière-plan nettement plus visibles ;
- déduplication des gares entre gares principales, communes API et points manuels ;
- correction spécifique des doublons type `Le Havre` quand une commune et une gare principale se superposent ;
- catalogue matériel roulant étendu à 24 modèles, soit plusieurs choix par époque ;
- chaque matériel a maintenant une image dédiée dans `public/assets/art/rolling_stock/` ;
- les cartes de matériel affichent des statistiques différenciées : vitesse, capacité voyageurs, fret, fiabilité, confort, maintenance, énergie, autonomie, coût ;
- le menu Parc regroupe les trains par époque et donne une lecture stratégique plus claire.

## Version v21 — hotfix crash simulation

Correction critique :

- réintégration de `computeEnergyCost()` dans `server.js`.
- La v20 pouvait démarrer puis planter au premier tick de simulation avec :
  `ReferenceError: computeEnergyCost is not defined`.
- Test de démarrage serveur effectué.
- Test de tick simulation effectué.
- Test API création de ligne multi-arrêts effectué.
- Test API modification des arrêts d’une ligne effectué.
- Test API modification du matériel affecté effectué.

## Version v22 — UI lignes et Parc

Corrections :

- les suggestions de desserte apparaissent maintenant comme un menu déroulant intégré sous le champ de recherche ;
- quand une gare est ajoutée après le terminus précédent, le nom fonctionnel de la ligne est recalculé :
  exemple `Paris → Rouen` devient `Paris → Le Havre` après ajout de Le Havre derrière Rouen ;
- `from` et `to` suivent toujours le premier et le dernier arrêt du parcours ;
- le train animé utilise le parcours complet de la première à la dernière gare ;
- le tracé multi-arrêts tente maintenant une géométrie calcul d’itinéraire globale avec tous les arrêts, afin de limiter les retours et demi-tours visuels ;
- nettoyage visuel des micro-retours de tracé ;
- refonte du rendu des cartes du menu Parc :
  images mieux contenues ;
  première ligne de 4 matériels testée avec une présentation plus propre ;
  vignettes empêchées de sortir de la fenêtre.

## Version v23 — insertion cohérente des arrêts intermédiaires

Correction ciblée :

- lors de l’ajout d’un arrêt intermédiaire, le jeu calcule automatiquement la meilleure position entre les arrêts existants ;
- l’éditeur propose maintenant par défaut `Meilleure position entre deux arrêts` au lieu de prolonger après le terminus ;
- sécurité côté serveur : si un ordre d’arrêts provoque un détour net ou un demi-tour, l’ordre est corrigé en gardant le premier arrêt et en cherchant la desserte la plus continue ;
- cas testé : `Nantes → La Roche-sur-Yon` + ajout de `Montaigu-Vendée` envoyé en mauvais ordre devient bien `Nantes → Montaigu-Vendée → La Roche-sur-Yon` ;
- le nom de ligne reste cohérent avec les vrais terminus : `Nantes → La Roche-sur-Yon`.

## Version v24 — correction insertion manuelle + glissé-déposé

Corrections :

- l’ordre choisi explicitement dans l’interface est maintenant conservé côté serveur (`preserveOrder`) ;
- l’ajout d’un arrêt entre deux gares ne peut plus être réordonné automatiquement en fin de parcours ;
- l’éditeur de ligne possède maintenant une vraie liste d’arrêts réorganisable :
  - glissé-déposé ;
  - boutons ↑ / ↓ ;
  - suppression d’arrêt ;
  - ajout d’arrêt avec insertion automatique ou position explicite ;
- le premier arrêt devient le départ ;
- le dernier arrêt devient le terminus ;
- le nom fonctionnel de ligne est recalculé depuis ces deux extrémités ;
- test API : `Nantes → Montaigu-Vendée → La Roche-sur-Yon` est conservé dans cet ordre.

## Version v25 — tracé visuel continu des dessertes multi-arrêts

Correction ciblée :

- les lignes avec arrêts intermédiaires ne concatènent plus plusieurs géométries qui peuvent créer un aller-retour visuel ;
- le rendu carte des lignes multi-arrêts utilise désormais un corridor continu passant par les arrêts dans l’ordre de desserte ;
- le train animé suit ce corridor continu ;
- les calculs d’exploitation conservent les distances réseau, mais l’affichage évite les demi-tours locaux ;
- cas traité : `Nantes → Montaigu-Vendée → La Roche-sur-Yon` ne dessine plus de crochet aller-retour à droite de Montaigu.

## Version v26 — tracés multi-arrêts réalistes

Correction ciblée :

- le rendu des lignes multi-arrêts ne remplace plus le trajet par une courbe artificielle ;
- le tracé visuel part maintenant d’un itinéraire réel/sinueux entre le départ et le terminus ;
- les arrêts intermédiaires déforment localement ce corridor pour que la ligne passe par eux ;
- on évite ainsi les demi-tours visuels tout en conservant un aspect naturel et sinueux ;
- le train animé suit ce tracé réaliste.

## Version v27 — recalcul intégral organique des tracés multi-arrêts

Correction ciblée :

- lors de l’ajout d’un arrêt intermédiaire, le tracé visuel est recalculé sur toute la ligne ;
- le rendu n’ajoute plus une simple bifurcation locale vers l’arrêt ;
- le jeu tente d’utiliser une géométrie complète calcul d’itinéraire `départ → arrêts → terminus` quand elle est disponible ;
- sinon, il génère un corridor complet organique et sinueux, avec points intermédiaires déterministes sur toute la longueur ;
- l’objectif est d’obtenir une ligne globalement redessinée, plus naturelle, plutôt qu’un tracé droit ou une courbe artificielle uniquement autour de l’arrêt.

## Version v28 — corridor organique forcé pour les lignes multi-arrêts

Correction ciblée :

- suppression de l’usage calcul d’itinéraire pour le rendu visuel des lignes multi-arrêts, car il recréait une branche rigide vers la gare intermédiaire ;
- le tracé est maintenant recalculé intégralement en corridor ferroviaire organique :
  départ → arrêts intermédiaires → terminus ;
- la sinuosité est appliquée sur toute la longueur, pas uniquement autour de la gare ajoutée ;
- le rendu évite les segments droits ou les bifurcations locales artificielles ;
- le train animé suit ce corridor complet.

## Version v29 — refonte de l’interface Lignes

Refonte ciblée de l’onglet Lignes :

- ajout de deux sous-onglets :
  - `Créer` pour l’ouverture d’une nouvelle ligne ;
  - `Modifier` pour la gestion des lignes existantes ;
- formulaire de création simplifié :
  - départ ;
  - terminus ;
  - dessertes intermédiaires en section optionnelle ;
  - matériel, service, fréquence, tarif ;
  - prévisualisation du parcours ;
- onglet de modification plus lisible :
  - cartes de lignes modernisées ;
  - résumé des lignes actives, du profit J-1 et du trafic ;
  - accès clair à la modification complète ;
- conservation de l’éditeur existant avec glissé-déposé des arrêts ;
- la version v28 reste le point de retour avant cette refonte.

## Version v30 — sous-onglets du menu Parc

Refonte ciblée de l’onglet Parc :

- ajout de deux sous-onglets :
  - `Catalogue` pour l’achat et la comparaison du matériel roulant ;
  - `Maintenance` pour la politique d’entretien et les interventions sur le parc ;
- visuel du catalogue amélioré :
  - cartes par époque plus lisibles ;
  - intégration d’image renforcée ;
  - résumé budget / modèles disponibles / modèles verrouillés ;
- visuel maintenance amélioré :
  - cartes de politique de maintenance dédiées ;
  - indicateurs état moyen, trains en atelier, affectés et libres ;
  - parc détenu regroupé dans l’espace maintenance.

## Version v31 — optimisation de navigation de la carte

Optimisation ciblée, sans changement fonctionnel :

- réduction du rendu canvas pendant le déplacement et le zoom de la carte ;
- suppression des recalculs de routes à chaque événement `move` / `zoom` moteur cartographique ;
- recalcul des projections groupé et différé ;
- rendu léger pendant la navigation : lignes conservées, trains et labels secondaires temporairement allégés ;
- cache des gares visibles selon zoom et viewport ;
- cache des longueurs de polylignes pour éviter de recalculer les distances à chaque frame d’animation ;
- la carte repasse en rendu complet à la fin du déplacement ou du zoom.

## Version v32 — optimisation spécifique du déplacement de carte

Optimisation ciblée du pan moteur cartographique :

- pendant le déplacement de la carte, le canvas des lignes/gares n’est plus redessiné en continu ;
- le canvas est déplacé par transformation GPU `translate3d`, puis recalculé proprement à la fin du mouvement ;
- les recalculs de projection, de routes et de gares visibles sont différés au `moveend` ;
- le zoom conserve l’optimisation de la v31 ;
- aucun changement de gameplay.

## Version v33 — tracés sans océan + badge de version

Corrections ciblées :

- le rendu visuel des lignes multi-arrêts s’appuie davantage sur le réseau ferroviaire résolu par le jeu ;
- ajout d’un guidage côtier spécifique pour empêcher la liaison `La Roche-sur-Yon → La Rochelle` de couper l’océan ;
- la correction est uniquement visuelle : les calculs économiques et d’exploitation restent inchangés ;
- ajout d’un badge de version fixe en bas à droite de l’écran : `v33`.

## Version v34 — sprites de carte pour trains et gares

Amélioration visuelle ciblée de la carte :

- intégration de 24 sprites de train dédiés à la carte, un par matériel roulant ;
- le train animé affiché sur une ligne utilise maintenant une petite image correspondant au matériel réellement affecté ;
- intégration de 6 sprites de gare de prestige ;
- les gares appartenant au joueur utilisent désormais une image évolutive selon leur niveau et leur prestige technique/commercial ;
- conservation des anciens marqueurs simples pour les gares non développées ou non possédées ;
- badge de version mis à jour en `v34`.

## Version v35 — lisibilité des sprites de carte

Ajustement visuel ciblé de la carte :

- trains circulants redessinés avec un support contrasté pour mieux ressortir sur les voies ;
- sprites de train réduits et rendus plus nets pour éviter l’effet flou ou envahissant ;
- sprites de gare repositionnés au-dessus du point de gare, avec socle et repère clair ;
- affichage des grandes vignettes limité aux gares réellement desservies / sélectionnées / surdéveloppées ;
- libellés de gare repositionnés pour éviter le chevauchement avec les sprites ;
- badge de version mis à jour en `v35`.

## Version v36 — gares en tooltip et train générique

Correction visuelle ciblée de la carte :

- les sprites de gare ne s’affichent directement sur la carte que lorsque le zoom moteur cartographique est au maximum ;
- hors zoom maximal, les gares restent en marqueurs simples pour garder une carte lisible ;
- le visuel de prestige de la gare est affiché dans le tooltip au survol, avec un panneau sombre cohérent avec l’interface ;
- le tooltip affiche aussi niveau, prestige, nombre de lignes, commerces, atelier et dépôt ;
- les zones de survol prennent aussi en compte les libellés de gare dessinés sur la carte ;
- les trains en circulation reviennent à une image générique simple, en attendant une meilleure solution visuelle.

## Version v37 — correction sélection des gares dans l’onglet Gares

Correction ciblée :

- ajout d’un champ de recherche complet dans l’onglet `Gares` ;
- la liste déroulante de l’onglet `Gares` contient désormais toutes les gares disponibles, y compris les petites gares et points manuels ;
- sélection d’une gare par suggestion de recherche ;
- correction de la sélection depuis la carte avec un fallback géographique si le cache de hitbox est obsolète ;
- amélioration possible sur une petite gare ou une gare issue d’un ancien mode manuel sans passer par la création de ligne ;
- badge de version mis à jour en `v37`.

## Version v38 — stabilité de la recherche de gare

Correction ciblée :

- le champ de recherche de l’onglet `Gares` ne se réinitialise plus pendant la saisie ;
- les rafraîchissements automatiques du serveur ne reconstruisent plus l’onglet pendant que l’utilisateur tape ;
- la recherche garde son texte et son candidat courant ;
- la sélection via suggestion, carte, liste ou fiche synchronise correctement le champ de recherche ;
- amélioration d’une point manuel retestée ;
- badge de version mis à jour en `v38`.

## Version v40 — audit et réparation de la carte

Correctif de stabilité après la v39 :

- audit comparatif v38/v39 ;
- correction d’une erreur de patch v39 qui avait supprimé plusieurs fonctions critiques de la carte :
  - projection ;
  - hitbox des gares ;
  - sélection de gare ;
  - options de gares ;
  - calculs de distance / route côté client ;
- retour sur une base v38 stable ;
- réapplication propre de l’amélioration du tooltip de gare en remplaçant uniquement la fonction concernée ;
- tooltip de gare agrandi et plus lisible ;
- vérification que les fonctions critiques de carte sont de nouveau présentes ;
- badge de version mis à jour en `v40`.

## Version v42 — plafond cohérent du prix du billet

Analyse et correction de la logique tarifaire :

- reprise de la base fournie en v41 ;
- audit côté serveur et côté client de la conversion `prix du billet moyen` ↔ `tarif au kilomètre` ;
- ajout d’un plafond cohérent côté serveur, donc non contournable par requête API ;
- ajout du même plafond côté interface ;
- le curseur du prix du billet est désormais borné au plafond calculé ;
- le champ numérique indique aussi ce plafond ;
- les anciens tarifs sauvegardés sont normalisés au chargement ;
- le message d’aide indique la distance, le plafond et l’équivalent €/100 km ;
- badge de version mis à jour en `v42`.

Règle de plafond appliquée :

- `plafond = 8 € + 0,18 € / km` ;
- minimum pratique : `12 €` ;
- plafond absolu : `220 €`.

Exemples :

- 100 km : plafond ≈ 26 € ;
- 300 km : plafond ≈ 62 € ;
- 600 km : plafond ≈ 116 € ;
- très longue distance : plafond maximal 220 €.

## Version v43 — départ sans ligne/train + création libre de gare

Modifications de départ de partie :

- un nouveau joueur commence désormais avec `0` train ;
- un nouveau joueur commence désormais avec `0` ligne ;
- un nouveau joueur commence désormais avec `0` gare exploitée ;
- capital de départ fixé à `220 000 €` ;
- ce capital permet d’acheter un premier matériel vapeur régional et d’ouvrir une première ligne courte/moyenne ;
- le capital ne permet pas d’acheter immédiatement du matériel longue distance avancé.

Correction création de gare / arrêt sur la carte :

- refonte du mode `Créer point` ;
- en mode création, le clic sur la carte crée toujours un nouveau point à l’endroit cliqué au lieu de sélectionner une gare existante ;
- ajout d’un gestionnaire de clic de secours directement sur le conteneur moteur cartographique ;
- désactivation temporaire du déplacement de carte pendant la pose d’un arrêt pour éviter les clics perdus ;
- zone de validité légèrement élargie pour couvrir correctement France, Corse, frontières et côtes ;
- création d’point manuele retestée côté API ;
- badge de version mis à jour en `v43`.

## Version v44 — création de compagnie simplifiée + logos ferroviaires

Création de compagnie :

- suppression du choix de région au lancement ;
- le formulaire de départ ne conserve plus que :
  - le nom ;
  - la couleur ;
  - le logo ;
- la région est désormais fixée côté données à `France` tant que cette notion n’a pas d’utilité de gameplay.

Logos :

- génération et intégration d’une sélection de `20` logos ferroviaires en pixel-art cohérents avec la DA du jeu ;
- logos disponibles au choix dès la création de la compagnie ;
- aperçu du logo sélectionné dans l’écran de création ;
- logo choisi sauvegardé dans les données du joueur ;
- logo affiché ensuite dans la barre supérieure du jeu.

Technique :

- validation côté serveur du logo sélectionné ;
- fallback automatique sur un logo par défaut si une valeur invalide est reçue ;
- badge de version mis à jour en `v44`.

## Version v45 — logos de compagnie physiquement intégrés

Rappel/correction :

- les logos demandés sont bien **ajoutés au projet** ;
- ils sont stockés dans `public/assets/company_logos/` ;
- ils sont utilisables dans le formulaire de création de compte ;
- le logo choisi est sauvegardé dans les données du joueur ;
- le logo est réaffiché dans la barre supérieure une fois la compagnie créée.

Contenu :

- `20` logos pixel-art ferroviaires ;
- intégration front (`index.html`, `public/app.js`, `public/styles.css`) ;
- validation serveur (`server.js`) du logo sélectionné ;
- fallback automatique sur un logo par défaut en cas de valeur invalide.

## Version v46 — recadrage des logos

Correction visuelle ciblée :

- recadrage des logos de compagnie ;
- correction spécifique du mauvais cadrage de la première rangée ;
- remplacement du découpage naïf par grille par un découpage basé sur la détection des cadres dorés ;
- conservation des `20` logos dans `public/assets/company_logos/` ;
- aucun changement de gameplay ;
- badge de version mis à jour en `v46`.

## Version v46.1 — correctif cadrage logos première rangée

Correctif ciblé :

- nouvelle correction du découpage de la première rangée de logos ;
- conservation explicite de la partie basse du liseré doré ;
- aucun autre changement.

Convention de version :

- lorsqu’une version précédente doit être corrigée après retour utilisateur,
  la numérotation passe désormais en format `XX.X` (ex. `v46.1`, `v46.2`, etc.).

## Version v47 — populations réelles, départ sans salariés, nettoyage libellés

Données de population :

- remplacement du chargement limité aux communes importantes par un chargement des communes françaises avec population disponible ;
- récupération via l’API Géo officielle `geo.api.gouv.fr` ;
- cache local renommé en `data/communes-population.json` ;
- enrichissement des gares principales du jeu avec la population réelle de la commune la plus proche ;
- suppression des libellés visibles `ancien libellé de seuil communal`.

Départ de partie :

- un nouveau joueur commence avec `0` salarié ;
- les besoins RH affichés restent à `0` tant que le joueur n’a ni train, ni gare exploitée, ni ligne active ;
- suppression du gain de recherche passif avant démarrage réel de l’activité ;
- objectif : aucune dépense passive avant le premier vrai investissement.

## Version v47.1 — correctif performance populations

Correctif après audit de la v47 :

- la v47 chargeait trop large et pouvait envoyer toutes les communes françaises au client ;
- retour à un seuil de population `>= 10 000 habitants` pour les communes jouables ;
- conservation de la population réelle pour ces communes ;
- cache renommé en `data/communes-10000-population.json` pour éviter de réutiliser un ancien cache trop lourd ;
- les anciens caches trop larges sont filtrés au chargement ;
- aucun retour du libellé visible supprimé précédemment ;
- conservation du départ sans salarié et sans dépense passive.

## Version v48 — tooltips bornés, propriété des villes, carte Carte FR

Carte et tooltips :

- correction du tooltip de ville/gare qui sortait du cadre canvas ;
- recalcul de hauteur du tooltip non possédé ;
- bornage strict `x/y` dans la carte ;
- affichage du propriétaire de la ville dans le tooltip ;
- indication claire si une ville est libre, possédée par le joueur ou possédée par un concurrent.

Carte Carte interactive :

- remplacement du rendu Carto Voyager par les fonds cartographiques Carte France ;
- objectif : libellés de carte plus adaptés au français.

Propriété des villes et lignes :

- une ligne ne peut être ouverte que si toutes les villes traversées par l’itinéraire appartiennent à une compagnie ;
- validation côté serveur sur la route complète calculée, pas seulement sur les arrêts sélectionnés ;
- validation côté interface avant le bouton d’ouverture ;
- une ville déjà possédée par un joueur ne peut plus être achetée/améliorée par un autre ;
- les lignes empruntant des villes possédées par d’autres joueurs paient des droits de passage ;
- ces droits sont reversés au propriétaire des villes et comptabilisés dans ses revenus/profits ;
- suppression de l’auto-acquisition des gares lors de la création/modification d’une ligne.

## Version v48.1 — correctif carte et refresh interface

Correctif de la v48 :

- réparation de l’affichage de la carte de fond ;
- remplacement du chargement direct Carte France par un chargeur de fonds cartographiques plus robuste ;
- rendu principal : Carte interactive standard, dont les libellés français sont conservés sur la France ;
- fallback automatique vers Carte France puis style cartographique Voyager si les fonds cartographiques échouent ;
- correction du refresh automatique qui reconstruisait les formulaires pendant une interaction joueur ;
- les menus déroulants, champs texte, sliders, suggestions et formulaires ne sont plus détruits pendant qu’ils sont utilisés ;
- correction appliquée globalement, pas seulement au sélecteur de gare ;
- badge de version mis à jour en `v48.1`.

## Version v49 — prix d’achat des villes, capital 500k, tooltip corrigé

Équilibrage économique :

- capital de départ fixé à `500 000 €` ;
- ajout d’un prix d’achat des villes dépendant fortement de leur population réelle ;
- les petites villes restent accessibles en début de partie ;
- les grandes villes et métropoles coûtent plusieurs millions ;
- Paris et les très grosses villes deviennent des objectifs long terme ;
- si la population réelle n’est pas encore disponible, le prix utilise une formule de secours basée sur la demande de la gare.

Achat des villes :

- acheter une ville ne la fait plus monter directement au niveau 2 ;
- une ville achetée démarre au niveau 1 ;
- les commerces, ateliers et dépôts sont verrouillés tant que la ville n’est pas achetée ;
- côté serveur, impossible d’acheter une amélioration autre que l’achat initial sur une ville libre.

Tooltip :

- correction du badge haut droit `Libre` ;
- le texte de titre et de sous-titre réserve maintenant l’espace du badge ;
- les textes trop longs sont tronqués proprement pour éviter les superpositions.

## Version v50 — tri des villes à acheter

Onglet Gares :

- ajout d’un menu `Tri des villes` au-dessus de la liste complète ;
- modes disponibles :
  - alphabétique ;
  - prix croissant ;
  - prix décroissant ;
  - demande voyageurs ;
- le tri s’applique à la liste complète des villes ;
- le tri s’applique aussi aux suggestions de recherche dans l’onglet Gares ;
- les suggestions affichent maintenant le prix d’achat estimé et le statut de propriété ;
- le choix de tri est sauvegardé dans le navigateur.

## Version v50.1 — correctif lignes fermées et propriété directe des arrêts

Correctifs :

- les lignes fermées ne sont plus affichées dans le sous-menu `Modifier` de l’onglet Lignes ;
- le compteur du sous-menu `Modifier` ne compte plus que les lignes actives ;
- les totaux du panneau de gestion des lignes se basent maintenant sur les lignes actives ;
- correction de la validation de propriété des villes :
  - création/modification de ligne : seules les villes explicitement choisies comme arrêts doivent être possédées ;
  - les villes intermédiaires du chemin réseau calculé ne bloquent plus l’ouverture ;
  - les droits de passage ne s’appliquent plus qu’aux arrêts réellement desservis.

## Version v50.2 — correctif prix du billet

Correctif ciblé :

- le prix du billet de création de ligne relit maintenant explicitement la source de l’événement ;
- le curseur `range` n’est plus ignoré quand le navigateur ne lui donne pas le focus actif ;
- correction surtout utile sous Firefox pendant le glissé du curseur ;
- le champ numérique et le curseur restent synchronisés ;
- une valeur temporairement vide dans le champ numérique ne se transforme plus immédiatement en billet à `0 €` ;
- la sauvegarde serveur du prix reste inchangée et continue d’appliquer le plafond cohérent par distance.

## Version v50.3 — correctif renforcé prix du billet

Correctif renforcé après échec du v50.2 :

- `updateLinePreview` reçoit maintenant explicitement la source de l’événement ;
- le champ numérique et le slider sont synchronisés même si Firefox ne donne pas le focus au slider ;
- gestion des événements `input` et `change` pour le prix du billet ;
- même correction appliquée à la création de ligne et à l’éditeur de ligne ;
- la prévisualisation calcule maintenant la distance et resynchronise le prix avant d’afficher les erreurs de propriété de ville ;
- le champ numérique est forcé à jour quand le slider est la source ;
- le slider est forcé à jour quand le champ numérique est la source ;
- le plafond par distance côté serveur reste inchangé.

## Version v50.4 — réécriture du contrôle prix billet

Correction après échec des correctifs v50.2/v50.3 :

- suppression du slider `range` du prix du billet ;
- remplacement par un contrôle numérique direct avec boutons `-5`, `-1`, `+1`, `+5` ;
- une seule source de vérité : le champ numérique ;
- la création de ligne lit directement cette valeur ;
- l’éditeur de ligne lit directement cette valeur ;
- suppression des dépendances à `document.activeElement` et aux événements instables du slider ;
- conservation du plafond cohérent par distance côté client et côté serveur.

## Version v50.5 — application réelle du prix billet à l’enregistrement

Correctif ciblé sur le bouton `Enregistrer` de l’éditeur de ligne :

- le bouton `Enregistrer` n’est plus un bouton de soumission implicite du formulaire de dialogue ;
- le clic bloque maintenant explicitement le comportement par défaut du formulaire ;
- le prix affiché dans le champ est relu directement au moment exact de l’enregistrement ;
- le payload serveur est simplifié : le prix billet est envoyé comme source unique, sans tarif concurrent ;
- l’action `updateLine` est maintenant attendue (`await`) avant fermeture du dialogue ;
- le dialogue ne se ferme qu’après réponse positive du serveur ;
- l’état local est rafraîchi après l’enregistrement.

## Version v50.6 — correction réelle du prix billet appliqué aux lignes

Audit et correctif serveur/client :

- le serveur stockait bien le nouveau tarif, mais les statistiques de ligne restaient sur l’ancien calcul jusqu’au tick suivant ;
- ajout d’un recalcul immédiat non destructif des statistiques de ligne après modification :
  - attractivité ;
  - facteur prix ;
  - satisfaction ;
  - recettes billet ;
  - recettes totales ;
  - profit ;
- ce recalcul immédiat ne modifie pas la trésorerie, l’usure ou l’âge des trains ;
- la simulation normale continue ensuite avec le nouveau prix au tick suivant ;
- le bouton `Enregistrer` continue de relire explicitement le prix affiché ;
- le message de retour indique maintenant le billet moyen appliqué.

Test validé :

- ligne créée avec billet à 4 € ;
- stats calculées ;
- modification à 14 € ;
- dès la réponse `updateLine`, le tarif, l’attractivité, le facteur prix et les revenus changent ;
- après tick, les nouveaux revenus restent calculés avec le nouveau prix.

## Version v50.7 — prix billet comme source de vérité

Correctif final de la chaîne prix billet :

- ajout d’un champ `ticketPrice` stocké directement sur chaque ligne ;
- le client affiche désormais `line.ticketPrice` en priorité, au lieu de recalculer le billet moyen depuis `tariff × distance` ;
- le serveur conserve `ticketPrice` lors des appels `/api/state` ;
- `normalizeLine()` ne rabat plus le prix vers le tarif par défaut ;
- la création et la modification de ligne écrivent explicitement `ticketPrice` ;
- `tariff` devient une valeur dérivée de `ticketPrice / distance` ;
- la simulation utilise `ticketPrice` pour les recettes billet ;
- l’attractivité utilise le tarif dérivé de `ticketPrice` ;
- les statistiques financières exposent maintenant aussi `finance.ticketPrice` et `finance.farePerKm`.

Validation effectuée :

- ligne créée avec billet à 4 € ;
- plusieurs appels `/api/state` conservent 4 € ;
- tick serveur : revenus calculés avec 4 € ;
- modification à 12 € ;
- réponse `updateLine` affiche bien 12 € ;
- plusieurs appels `/api/state` conservent 12 € ;
- attractivité, facteur prix, satisfaction, recettes billet, recettes totales et profit changent immédiatement ;
- tick suivant : le billet reste à 12 € et les revenus restent calculés avec 12 €.

## Version v51 — plafond billet 50 €, slider restauré

Prix du billet :

- plafond global du billet fixé à `50 €` ;
- le plafond n’est plus dépendant de la distance ;
- `ticketPrice` reste la source de vérité ajoutée en v50.7 ;
- `tariff` reste une valeur dérivée de `ticketPrice / distance` ;
- la simulation continue d’utiliser `ticketPrice` pour les recettes billet.

Interface :

- retour du slider pour régler le prix du billet ;
- conservation d’un champ numérique permettant de saisir manuellement le montant ;
- suppression des boutons incrémentaux `-5`, `-1`, `+1`, `+5` ;
- le slider et le champ numérique restent synchronisés ;
- même comportement dans la création et dans la modification de ligne.

Attractivité :

- à `50 €`, le facteur prix devient très bas ;
- les prix moyens restent nettement plus attractifs ;
- l’impact prix reste visible dans les statistiques d’attractivité.

Validation :

- tentative de création à `60 €` plafonnée à `50 €` ;
- billet à `50 €` conservé dans `/api/state` ;
- facteur prix très bas à `50 €` ;
- modification à `12 €` appliquée ;
- facteur prix, revenus et stats changent ;
- slider présent ;
- saisie numérique présente ;
- boutons incrémentaux supprimés.

## Version v52 — plafonds billet par distance et alignement interface

Prix du billet :

- remplacement du plafond unique par un plafond dépendant de la distance ;
- formule actuelle : `min(50 €, max(8 €, 6 € + 0,32 € × km))` ;
- les petites lignes ont donc un plafond nettement plus bas ;
- les longues lignes peuvent atteindre le plafond absolu de `50 €` ;
- `ticketPrice` reste la source de vérité introduite en v50.7.

Attractivité :

- quand le billet atteint le plafond de la ligne, le facteur d’attractivité `Prix` tombe à `0 %` ;
- en baissant le prix, le facteur prix remonte immédiatement ;
- la simulation continue d’utiliser le prix affiché pour les revenus.

Interface :

- suppression des flèches natives blanches des champs numériques ;
- conservation du slider ;
- conservation de la saisie numérique manuelle ;
- suppression définitive des boutons incrémentaux ;
- alignement du bloc fréquence / prix billet ;
- alignement du slider, du champ prix et du texte d’aide.

Validation :

- ligne courte Caen → Bayeux : tentative à `60 €` plafonnée à `17 €` ;
- facteur prix à `0 %` au plafond ;
- modification à `8 €` appliquée ;
- facteur prix remonte ;
- revenus et stats changent ;
- slider présent ;
- champ numérique présent ;
- flèches natives masquées par CSS ;
- boutons incrémentaux absents.

## Version v53 — maintenance carte, attractivité remodelée, demi-tour visuel

Carte :

- un train animé n’est plus affiché sur la carte si le matériel affecté à sa ligne est en maintenance ;
- le tracé de la ligne reste visible, mais le train disparaît pendant l’immobilisation ;
- le train animé ne revient plus brutalement au départ lorsqu’il atteint le terminus ;
- il effectue maintenant un demi-tour visuel et repart dans l’autre sens.

Attractivité et équilibre économique :

- ajout d’un facteur de capture de demande dépendant de l’attractivité absolue de la ligne ;
- une ligne seule sur un marché ne capte plus automatiquement 100 % de la demande ;
- le prix, la fréquence, l’état du train, la RH, les gares et la réputation influencent désormais davantage le volume réellement transporté ;
- cela rend l’équilibre financier plus exigeant ;
- une ligne correcte peut néanmoins améliorer sa capture de demande avec un prix cohérent, de meilleures fréquences, du matériel plus confortable, des gares développées et de meilleurs effectifs ;
- ajout de `passengerDemandCapture` et `freightDemandCapture` dans les statistiques de marché ;
- l’interface affiche maintenant la capture de demande dans le panneau Marché.

Validation :

- une ligne au prix plafond garde un facteur prix à 0 % ;
- une baisse du billet améliore le facteur prix et la capture de demande ;
- les voyageurs transportés deviennent inférieurs à la demande totale quand l’attractivité est insuffisante ;
- train en maintenance : les stats de la ligne restent à zéro côté serveur et le sprite est masqué côté carte ;
- animation : le train utilise maintenant un mouvement aller-retour au lieu d’une boucle avec téléportation.

## Version v54 — audit économie et rééquilibrage des premières lignes

Audit de la sauvegarde :

- la ligne Pont-Audemer → Port-Jérôme-sur-Seine est rentable avant frais fixes ;
- le déficit vient surtout des frais fixes alloués :
  - dette élevée ;
  - masse salariale importante ;
  - coûts fixes de gares, atelier et dépôt ;
- le réglage du prix seul ne pouvait pas compenser ces charges ;
- réduire la cadence aide les coûts variables, mais ne règle pas le poids des frais fixes.

Rééquilibrage :

- réduction des coûts d’énergie opérationnels :
  - charbon : facteur 0,58 ;
  - diesel : facteur 0,72 ;
  - électricité : facteur 0,78 ;
  - hydrogène : facteur 0,76 ;
  - batterie : facteur 0,72 ;
- baisse des frais fixes journaliers des gares :
  - niveau de gare : 280 → 95 ;
  - commerce : 120 → 90 ;
  - atelier : 170 → 140 ;
  - dépôt : 250 → 210 ;
- baisse du poids journalier de la dette :
  - 0,045 % → 0,030 % ;
- courbe de capture de demande un peu moins punitive :
  - une ligne correcte ne capte toujours pas automatiquement toute la demande ;
  - mais elle n’est plus condamnée à rester déficitaire malgré un prix et une cadence raisonnables.

Validation :

- cas court de départ avec locomotive vapeur 030 ;
- cadence 1, billet 8 € : quasi équilibre ;
- cadence 2, billet 8 € : léger bénéfice ;
- billet plus élevé mais sous plafond : bénéfice possible si la demande suit ;
- cadence trop élevée reste pénalisante ;
- la dette et le sureffectif restent des risques réels, mais ne rendent plus la ligne mécaniquement impossible.

## Version v55.5.2 — correction réelle onglet Parc

Correctif ciblé après rupture de l’onglet Parc :

- ajout des définitions client manquantes pour les variantes de composition ;
- ajout de l’état client `compositionEditorModes` utilisé par les onglets Voitures / Wagons ;
- conservation du helper `clamp` côté client ;
- sécurisation de la lecture des variantes côté interface ;
- exposition de la variante active et du multiplicateur fret côté API ;
- validation API de changement voiture voyageurs → wagons de marchandises sur un même train.

## Version v55.5.7 — scroll interne propre des compositions

Correction du scroll de l’atelier de composition :

- suppression du conteneur `fleet-composition-scroll` de la v55.5.6 qui coupait l’accès au bas ;
- le scroll est maintenant porté uniquement par la carte `composition-editor-card` ;
- les sous-onglets du Parc et la structure de la page restent fixes pendant le défilement de l’atelier ;
- ajout de `overscroll-behavior: contain` pour éviter que la page entière suive le scroll ;
- scrollbar harmonisée avec la direction artistique ;
- sur écran étroit, retour au scroll naturel pour ne pas bloquer le contenu.

## Version v55.5.8 — scroll horizontal composition effective

Correction de la bande de composition effective :

- la bande locomotive + voitures/wagons peut maintenant défiler horizontalement ;
- le débordement latéral n’est plus coupé ;
- ajout d’une scrollbar horizontale cohérente avec la DA ;
- ajout d’un scroll-snap léger pour garder les véhicules lisibles ;
- conservation du scroll vertical interne de l’atelier ajouté en v55.5.7.

## Version v55.5.9 — conservation de la position de l’atelier Composition

Correction du retour en haut lors des refresh serveur :

- mémorisation de la position verticale de la carte `composition-editor-card` ;
- restauration automatique après reconstruction du DOM lors des refresh `/api/state` ;
- mémorisation aussi du scroll horizontal de la bande composition effective ;
- stockage par train sélectionné ;
- conservation du scroll vertical interne et du scroll horizontal ajoutés précédemment.

## Version v55.6 — variantes Midi époque suivante

Ajout de compositions débloquables pour l’époque suivante :

- intégration de 10 nouveaux visuels pixel-art dans `public/assets/composition/era2/` ;
- 4 variantes de voitures voyageurs style Midi / électrique pionnière ;
- 6 variantes de wagons de marchandises style Midi / électrique pionnière ;
- variantes disponibles uniquement à partir de l’époque 2 du jeu ;
- variantes limitées aux locomotives débloquées à partir de cette époque ;
- nouvelles recherches :
  - `Voitures de l’ère diesel` dans Traction ;
  - `Wagons Midi électriques` dans Fret ;
- l’interface Compositions masque ces variantes tant que l’époque et la recherche ne sont pas débloquées ;
- le serveur refuse aussi toute sélection non débloquée pour éviter les contournements côté client.

## Version v56 — refonte économie, finances et R&D long terme

Règle de maintenance :

- toute modification fonctionnelle doit maintenant être reportée dans ce changelog ;
- la version visible et la version serveur doivent être montées avec les changements de gameplay.

Version :

- badge interface mis à jour en `v56` ;
- version npm montée en `0.2.0` ;
- version d’état serveur montée en `11` pour marquer la migration économie/R&D.

Refonte de l’économie :

- ajout d’un bloc d’équilibrage centralisé côté serveur (`ECONOMY`) pour piloter revenus, charges, dette, gares, R&D et matériel inutilisé ;
- rééquilibrage des revenus voyageurs et fret pour permettre une rentabilité réelle avec de bons choix ;
- baisse et clarification des coûts variables d’énergie et de maintenance ;
- baisse du poids des charges fixes trop punitives en début de partie ;
- ajout de revenus propres aux gares exploitées, dépendant du niveau, du commerce et du trafic ;
- ajout d’un coût de parc inutilisé pour pénaliser les achats non exploités ;
- ajout d’un coût de fonctionnement R&D lié au laboratoire actif et aux ingénieurs ;
- ajout d’un détail financier dans les stats joueur : revenus lignes, revenus gares, coûts variables, personnel, gares, dette, R&D, parc inutilisé et charges fixes ;
- validation sur sauvegarde existante : une exploitation cohérente peut repasser positive, tandis que dette, sureffectif, fréquence excessive et actifs inutilisés restent dangereux.

Refonte de la recherche :

- suppression de l’achat instantané de recherches ;
- ajout d’un projet R&D actif par compagnie ;
- chaque projet a un niveau cible, un coût, une durée et une progression ;
- les recherches ont plusieurs niveaux, avec coût et durée croissants ;
- les prérequis peuvent dépendre d’un niveau précis d’une autre recherche ;
- les anciens déblocages booléens sont migrés automatiquement vers un niveau 1 ;
- les recherches restent compatibles avec les déblocages existants de matériel, variantes, maintenance et services ;
- les niveaux améliorent progressivement leurs effets : énergie, maintenance, RH, exploitation, fret, gares, flux voyageurs et portée vapeur.

Interface :

- suppression des jours visibles dans l’interface joueur ;
- les délais nécessaires sont affichés en cycles plutôt qu’en jours ;
- la topbar affiche désormais le résultat plutôt que le profit J-1 ;
- ajout d’un panneau “Résultat d’exploitation” dans la vue d’ensemble ;
- l’écran R&D affiche la capacité laboratoire, le projet actif, la progression, les niveaux, les coûts, les durées et les prérequis ;
- la fréquence n’est plus libellée “par jour” dans les formulaires et cartes de ligne.

Validation :

- `npm.cmd run check` OK ;
- API `/api/state` OK ;
- création d’un joueur temporaire et lancement d’un projet R&D OK ;
- sauvegarde de test restaurée après validation pour ne pas polluer `data/save.json`.

## Version v57 — refonte complète de l’arbre de recherche

Version :

- badge interface mis à jour en `v57` ;
- version npm montée en `0.3.0` ;
- version d’état serveur montée en `12` pour migrer les durées R&D en temps réel.

Refonte serveur :

- reconstruction complète de l’arbre de recherche ;
- ajout de 103 recherches réparties en 7 branches :
  - Traction ;
  - Énergie ;
  - Maintenance ;
  - Exploitation ;
  - Gares ;
  - Fret ;
  - RH ;
- conservation des identifiants critiques déjà utilisés par les déblocages de matériel et de variantes ;
- chaque recherche possède plusieurs niveaux utiles, pas seulement des prérequis ;
- chaque niveau augmente les effets de branche ou les effets spécifiques de la recherche ;
- les prérequis peuvent viser une recherche précise et un niveau précis ;
- les recherches sont débloquées progressivement par époque, branche et prérequis.

Temps réel R&D :

- remplacement des durées en cycles par des durées en millisecondes côté serveur ;
- chaque projet expose `remainingMs`, `durationMs` et `endAt` ;
- le serveur décrémente les projets selon le temps réellement écoulé et la capacité du laboratoire ;
- compatibilité conservée avec les anciennes sauvegardes qui auraient encore des durées en cycles.

Interface R&D :

- affichage du temps restant au format `HH:mm:ss` ;
- mise à jour du compte à rebours en temps réel entre deux refreshs serveur ;
- barre de progression live dans la direction artistique sombre/laiton ;
- prérequis affichés en badges lisibles :
  - vert quand le prérequis est satisfait ;
  - rouge quand il manque ;
- séparation claire entre :
  - ce que la recherche débloque ;
  - ce qu’elle améliore ;
- affichage explicite de `Effet augmenté au niveau X` ;
- remplacement des images de recherche par un cadre vide `Visuel à intégrer`, prêt pour de futurs visuels adaptés.

Validation :

- `node --check server.js` OK ;
- `node --check public/app.js` OK ;
- API `/api/state` OK avec 103 recherches exposées ;
- création d’un joueur temporaire et lancement d’un projet R&D OK ;
- vérification navigateur de l’onglet R&D :
  - 17 recherches visibles dans Traction ;
  - cadres vides présents ;
  - prérequis affichés ;
  - panneaux Débloque/Améliore présents ;
  - durée `HH:mm:ss` visible ;
  - aucune mention de jours dans l’écran ;
- sauvegarde de test restaurée après validation pour ne pas polluer `data/save.json`.

## Version v58 — file R&D et navigation des recherches

Version :

- badge interface mis à jour en `v58` ;
- version npm montée en `0.4.0` ;
- version d’état serveur montée en `13` pour migrer la file d’attente R&D.

File d’attente R&D :

- ajout d’une file d’attente de 12 recherches maximum par compagnie ;
- les recherches peuvent être ajoutées à la suite pendant qu’un projet est déjà actif ;
- les coûts sont payés à l’ajout en file, ce qui empêche de planifier au-delà des ressources disponibles ;
- les niveaux déjà actifs ou en attente sont pris en compte pour planifier les niveaux suivants ;
- à la fin d’un projet, le serveur lance automatiquement la prochaine recherche valide de la file.

Navigation et lisibilité :

- les prérequis manquants rouges sont maintenant cliquables ;
- un clic sur un prérequis manquant ouvre la bonne branche R&D, centre la recherche concernée et applique un glow sur sa vignette ;
- les cartes affichent le niveau acquis et le niveau déjà prévu par les recherches en cours ou en attente ;
- les blocs `Débloque` et `Améliore` sont cliquables et indiquent explicitement l’écran cible ;
- un clic sur une amélioration ouvre l’onglet concerné et met l’écran en évidence avec un glow ;
- les effets génériques ont été précisés par branche ou par recherche pour mieux expliquer l’intérêt de chaque niveau.

Validation :

- `node --check server.js` OK ;
- `node --check public/app.js` OK ;
- `npm.cmd run check` OK ;
- test API de file d’attente OK avec projet actif, deux recherches en attente et paiement immédiat ;
- validation navigateur OK :
  - prérequis rouge cliquable vers la recherche manquante ;
  - glow de la vignette R&D ciblée ;
  - chips `Débloque` / `Améliore` avec destination explicite ;
  - ouverture du sous-écran ciblé avec glow ;
  - ajout d’un niveau suivant dans la file R&D pendant qu’un projet est actif ;
- sauvegarde de test restaurée après validation pour ne pas polluer `data/save.json`.

## Version v59 — annulation R&D avec remboursement

Ajouts sur la base v58 :

- annulation possible du projet R&D actif ;
- annulation possible d’une recherche dans la file d’attente ;
- remboursement intégral des frais déjà investis ;
- annulation automatique et remboursement des recherches dépendantes devenues invalides ;
- si le projet actif est annulé, la file est nettoyée puis le prochain projet valide démarre automatiquement ;
- ajout des boutons `Annuler` dans la recherche active et dans la file R&D ;
- sécurisation serveur : impossible de garder bloquée une recherche dont le prérequis annulé n’est plus planifié.

## Version v60 — recherches à niveaux illimités

Refonte de la progression R&D :

- les recherches ne sont plus limitées à 5 niveaux ;
- chaque nouvelle recherche lance le niveau suivant disponible, sans plafond de gameplay ;
- coût exponentiel à chaque niveau ;
- durée exponentielle à chaque niveau ;
- les premières recherches de début de partie démarrent autour de 30 secondes au niveau 1 ;
- les recherches plus avancées dans l’arbre et les ères commencent avec des durées plus longues dès le niveau 1 ;
- l’interface affiche désormais `∞` comme plafond ;
- les recherches de déblocage restent utiles au niveau 1, puis continuent d’améliorer leur branche aux niveaux suivants ;
- les annulations et remboursements de la v59 restent compatibles avec les niveaux illimités.

## Version v60.1 — correction onglet R&D

Correctif après la v60 :

- correction d’une constante client manquante (`RESEARCH_TECHNICAL_MAX_LEVEL`) ;
- l’onglet R&D peut de nouveau calculer les coûts et durées des recherches illimitées ;
- conservation du système de niveaux illimités, coût exponentiel et durée exponentielle ;
- conservation de l’annulation/remboursement des recherches.

## Version v60.2 — nettoyage UI R&D

- suppression de l’affichage ` /∞ ` dans le badge de niveau des recherches ;
- le badge n’affiche plus que le niveau actuel ;
- suppression de la mention `Niveaux illimités : coût et durée augmentent exponentiellement.` dans les vignettes R&D ;
- suppression de la mention `progression illimitée` dans le bandeau des effets ;
- conservation du système de recherches illimitées de la v60.

## Version v60.3 — progression R&D fluide

Correction de la barre d’avancement des recherches :

- suppression du rollback visuel peu après le lancement d’une recherche ;
- la signature de rendu ne dépend plus du temps restant seconde par seconde ;
- la barre n’est plus reconstruite à chaque refresh serveur ;
- animation continue via `requestAnimationFrame` ;
- prise en compte du `workRate` laboratoire dans le calcul du temps réel restant ;
- mémorisation locale du dernier pourcentage affiché pour éviter les retours arrière visuels ;
- transition CSS courte pour lisser les micro-ajustements.

## Version v60.4 — lisibilité prérequis d’époque

Amélioration de l’interface R&D :

- le prérequis d’époque est maintenant affiché sous forme de pastille ;
- pastille verte si l’époque est atteinte ;
- pastille rouge si l’époque n’est pas encore atteinte ;
- la pastille est placée avec les autres prérequis de recherche ;
- retrait de l’ancienne ligne séparée `Époque requise` dans la grille de détails.

## Version v60.5 — pastilles file d’attente R&D

Amélioration visuelle de la file d’attente des recherches :

- pastilles de position retravaillées ;
- petit liseré doré ;
- chiffre bien centré ;
- espacement et alignement plus propres dans chaque ligne.

## Version v60.6 — trafic requis explicite et fonctionnel

Correction du déblocage des époques :

- conservation du prérequis de trafic ;
- affichage clair du trafic cumulé actuel et requis ;
- le trafic cumulé = voyageurs transportés + tonnes de fret livrées depuis la création de la compagnie ;
- affichage séparé de la progression Technologie et Trafic ;
- correction du déblocage : l’époque suivante est maintenant testée à chaque cycle de simulation, et plus seulement tous les 30 jours ;
- le déblocage ne devrait donc plus attendre un dépassement massif du seuil affiché.

## Version v60.7 — impact composition et trafic R&D lissé

Améliorations :

- ajout d’un bloc `Impact de +1 voiture / +1 wagon / +1 engin moteur` dans l’atelier de composition ;
- comparaison claire des effets marginaux : voyageurs, fret, vitesse, énergie, maintenance, fiabilité, confort ;
- les coûts d’énergie et de maintenance apparaissent en avertissement quand ils augmentent ;
- lissage visuel du trafic cumulé dans R&D ;
- le compteur et la barre de trafic cumulé progressent progressivement entre deux ticks ;
- la vitesse d’animation se base sur le gain observé aux ticks précédents pour éviter les sauts secs.

## Version v60.8 — pastilles queue R&D et animation cash

- centrage renforcé du nombre dans les pastilles de file d’attente R&D ;
- ajout d’une animation flottante sur le cash lors de chaque gain ou dépense ;
- la variation s’affiche brièvement au-dessus du cash puis disparaît en fondu.

## Version v60.9 — animation cash sur toutes les actions

Correction de l’animation de trésorerie :

- l’animation `+/- montant` se déclenche désormais aussi après les actions joueur ;
- achat de train, achat de gare, lancement de recherche, annulation/remboursement de recherche, création de ligne, etc. ;
- conservation de l’animation déjà présente lors des ticks serveur ;
- comparaison du cash avant/après réponse serveur puis affichage immédiat après rendu de la topbar.

## Version v60.11 — annulation R&D remboursement réellement complet

Correction du reliquat de -180 € après lancement puis annulation d’une recherche :

- les frais d’exploitation laboratoire accumulés pendant une recherche active sont maintenant suivis dans `operatingCostAccrued` ;
- l’annulation d’une recherche active rembourse le coût initial + les frais laboratoire déjà prélevés ;
- les statistiques cumulées `expenses` et `profit` sont aussi corrigées quand ces frais sont remboursés ;
- les recherches en file restent remboursées normalement, sans frais d’exploitation puisqu’elles ne sont pas encore actives ;
- l’animation cash affiche maintenant le remboursement total exact renvoyé par le serveur.

## Version v60.11 — alignement des ères sur les paliers Traction

- renommage des ères globales du jeu pour correspondre aux 7 paliers de recherche Traction : vapeur, diesel, électrique, grande vitesse, hydrogène, batterie, sustentation magnétique ;
- ajout d’une septième ère dédiée à la sustentation magnétique ;
- alignement des verrous d’époque des recherches Traction sur ces 7 paliers.

## Version v60.12 — parc matériel cohérent par ère

- incrément de version de cette passe : badge interface `v60.12` et schéma d’état serveur `14` ;
- remplacement du catalogue Parc par 35 modèles, soit exactement 5 matériels roulants par ère ;
- correction des incohérences d’époque : les matériels vapeur restent dans l’ère vapeur, les diesel dans l’ère diesel, etc. ;
- ajout de modèles cohérents pour les ères hydrogène, batterie et sustentation magnétique ;
- retrait des visuels spécifiques des trains : les cartes du Parc affichent désormais un emplacement neutre `Visuel matériel — À refaire` ;
- suppression du dossier `public/assets/art/rolling_stock/` et des sprites `public/assets/map/trains/` pour repartir sur une base graphique saine.

## Version v60.13 — parc : grille homogène et prérequis visibles

- incrément de version de cette passe : badge interface `v60.13`, package `0.4.2` et schéma d’état serveur `15` ;
- correction de la grille du catalogue Parc : la 1re ère n’est plus limitée à 4 vignettes par ligne ;
- ajout de prérequis de recherche avec niveau précis sur les modèles de matériel roulant ;
- affichage des recherches requises directement sur les vignettes du catalogue ;
- retrait des anciennes pastilles de type/énergie/portée dans le catalogue pour éviter les informations parasites du type `Vapeur mixte`, `Charbon`, `360 km`.

## Version v60.14 — parc : prérequis compacts et niveaux cohérents

- incrément de version de cette passe : badge interface `v60.14`, package `0.4.3` et schéma d’état serveur `16` ;
- affichage compact du prérequis de recherche sur les vignettes du parc ;
- prérequis affiché en vert si le niveau requis est atteint, en rouge sinon ;
- suppression du texte redondant `À débloquer` sur les cartes du catalogue ;
- tous les matériels roulants non initiaux de chaque ère exigent désormais une recherche de niveau 3 minimum.

## Version v60.15 — parc : prérequis harmonisés avec les recherches

- incrément de version de cette passe : badge interface `v60.15`, package `0.4.4` et schéma d’état serveur `17` ;
- refonte visuelle du bloc de prérequis sur les vignettes du Parc : rendu en pastilles proche de l’arbre de recherche ;
- retour de l’information d’ère requise sur chaque matériel roulant ;
- affichage compact de deux prérequis distincts : `Ère` et `Recherche` ;
- pastilles vertes si le prérequis est atteint, rouges s’il manque ;
- les recherches manquantes restent cliquables pour ouvrir directement le nœud concerné dans l’onglet Recherche.

## Version v60.16 — parc : prérequis recentrés et retour à la ligne

- incrément de version de cette passe : badge interface `v60.16`, package `0.4.5` et schéma d’état serveur `18` ;
- correction du panneau `Prérequis` sur les vignettes du parc ;
- les prérequis `Ère` et `Recherche` sont désormais empilés verticalement ;
- le texte est centré et peut revenir à la ligne pour éviter tout débordement hors vignette.

## Version v60.17 — parc : niveaux de déblocage progressifs

- incrément de version de cette passe : badge interface `v60.17`, package `0.4.6` et schéma d’état serveur `19` ;
- correction des prérequis de recherche du parc roulant : les matériels non initiaux ne sont plus tous bloqués au niveau 3 ;
- répartition progressive des niveaux requis entre 3 et 8 selon la position du matériel dans son ère ;
- conservation du premier matériel de chaque ère en déblocage initial niveau 1.

## Version v60.18 — recherche : ères réductibles

- incrément de version de cette passe : badge interface `v60.18`, package `0.4.7` et schéma d’état serveur `20` ;
- les listes de recherches sont désormais réductibles par ère dans chaque onglet concerné ;
- l’état réduit/déplié est conservé côté navigateur ;
- l’ouverture directe d’une recherche depuis un prérequis déplie automatiquement son ère.

## Version v60.19 — recherche : vignettes compactes

- incrément de version de cette passe : badge interface `v60.19`, package `0.4.8` et schéma d’état serveur `21` ;
- refonte compacte des vignettes de recherche sur le modèle du parc ;
- affichage des recherches en grille de 5 cartes par rangée sur grand écran ;
- réduction des médias, textes, prérequis, effets et boutons pour limiter la hauteur des cartes ;
- sécurisation des retours à la ligne et de l’overflow pour éviter les sorties de cadre.

## Version v60.20 — recherche : correction des vignettes compactes

- incrément de version de cette passe : badge interface `v60.20`, package `0.4.9` et schéma d’état serveur `22` ;
- correction de la présentation des vignettes de recherche ;
- le titre repasse sur des lignes horizontales normales, sans affichage vertical ;
- conservation du format compact avec 5 cartes par rangée sur grand écran ;
- sécurisation supplémentaire des retours à la ligne et du contenu pour rester dans les cadres.

## Version v60.21 — recherche : alignement visuel et effets par ère

- incrément de version de cette passe : badge interface `v60.21`, package `0.4.10` et schéma d’état serveur `23` ;
- cartes de recherche : suppression de la ligne `Branche`, renommage de `Budget` en `Coût` et suppression de la ligne `Effet augmenté au niveau ...` ;
- alignement du bouton de lancement en bas de chaque carte pour uniformiser la ligne de vignettes ;
- application des bonus/malus de recherche aux matériels roulants de la même ère uniquement ;
- prise en compte de ces effets sur les profils des trains, les revenus, la consommation, la fiabilité, la portée/vitesse et le CO₂ du matériel concerné.

## Version v60.22 — recherche : audit anti-débordement

- incrément de version de cette passe : badge interface `v60.22`, package `0.4.11` et schéma d’état serveur `24` ;
- audit global des vignettes de recherche pour éviter les débordements de texte ;
- réduction et resserrage des blocs texte, prérequis, effets et boutons ;
- compactage particulier du message de verrouillage/prérequis en bas de carte ;
- conservation de l’alignement du bouton de lancement en bas de vignette.

## Version v60.23 — recherche : lisibilité restaurée

- incrément de version de cette passe : badge interface `v60.23`, package `0.4.12` et schéma d’état serveur `25` ;
- augmentation de la taille de police des vignettes de recherche ;
- suppression des doublons visuels qui provoquaient le tassement : message de verrouillage bas de carte et ligne `Voir : ...` répétée sous chaque effet ;
- masquage des lignes `Niveaux suivants : ...` dans l’affichage des cartes pour conserver les bonus principaux lisibles ;
- conservation de l’alignement du bouton en bas de carte sans débordement hors cadre.

## Version v60.24 — recherche : descriptions redondantes retirées

- incrément de version de cette passe : badge interface `v60.24`, package `0.4.13` et schéma d’état serveur `26` ;
- suppression de la phrase descriptive des vignettes de recherche, du type `Ère X — ... Effets : ...` ;
- conservation des bonus détaillés dans les blocs `Débloque` et `Améliore` ;
- gain de place vertical sans réduire la taille de police.

## Version v60.25 — recherche/parc : descriptions supprimées et bonus hérités visibles

- incrément de version de cette passe : badge interface `v60.25`, package `0.4.14` et schéma d’état serveur `27` ;
- suppression effective des phrases descriptives redondantes dans les vignettes de recherche ;
- ajout d’un bloc `Bonus recherches hérités` sur chaque matériel roulant du catalogue ;
- ajout du même bloc sur les matériels roulants possédés ;
- les bonus affichés sont calculés uniquement depuis les recherches de la même ère que le matériel.

## Version v60.26 — parc/recherche : prérequis simplifiés et rendements décroissants

- incrément de version de cette passe : badge interface `v60.26`, package `0.4.15` et schéma d’état serveur `28` ;
- catalogue du parc : suppression du doublon de prérequis de recherche dans le badge supérieur des matériels verrouillés ;
- harmonisation de la taille des pastilles `Ère` et `Recherche` dans les prérequis du parc ;
- vignettes de recherche : les effets affichent désormais le bonus actuel et le bonus ajouté par le prochain niveau ;
- nouvelle courbe de progression : bonus complet pour chacun des 5 premiers niveaux, puis rendement décroissant à partir du niveau 6 ;
- serveur et client utilisent la même courbe pour calculer et afficher les bonus hérités.

## Version v60.27 — parc : portée opérationnelle et distances exactes

- incrément de version de cette passe : badge interface `v60.27`, package `0.4.16` et schéma d’état serveur `29` ;
- ajout de la portée en kilomètres sur chaque matériel du catalogue du parc ;
- ajout de la portée en kilomètres sur les matériels possédés ;
- la portée devient bloquante pour tous les matériels roulants, et non plus uniquement pour la vapeur ;
- une ligne ne peut plus être créée, modifiée ou recevoir un train si la distance de ligne dépasse la portée opérationnelle du matériel ;
- les distances serveur entre gares utilisent désormais la distance géographique réelle entre coordonnées de gares, sans coefficient artificiel de majoration ;
- suppression du badge `Année` dans la barre supérieure.

## Version v60.28 — portée, distances et recherche gares

- incrément de version de cette passe : badge interface `v60.28`, package `0.4.17` et schéma d’état serveur `30` ;
- correction de l’écart entre la portée affichée dans le parc et celle utilisée dans la création de ligne ;
- le client et le serveur utilisent désormais la même portée opérationnelle issue du profil du train ;
- forte réduction des portées des matériels des premières ères, avec progression jusqu’à environ 1 500 km en fin d’arbre ;
- suppression du coefficient artificiel de distance côté client, pour aligner l’affichage avec le serveur ;
- ajout d’un calculateur de distance départ/terminus dans la création de ligne, sans achat ni validation ;
- amélioration de la recherche de gare dans l’onglet Gares avec résultats persistants visibles sous le champ de recherche.

## Version v60.29 — équilibrage portées et affichage horaire

- incrément de version de cette passe : badge interface `v60.29`, package `0.4.18` et schéma d’état serveur `31` ;
- rééquilibrage complet des portées par ère :
  - vapeur : 50 à 150 km ;
  - diesel : 125 à 250 km ;
  - électrique : 250 à 400 km ;
  - grande vitesse : 350 à 700 km ;
  - hydrogène : 250 à 500 km ;
  - batterie : 150 à 400 km, avec maintenance réduite, confort et fiabilité renforcés ;
  - sustentation magnétique : 650 à 1 500 km ;
- simulation serveur accélérée : tick toutes les 2 secondes pour des chiffres plus réactifs ;
- revenus, charges et résultats d’exploitation affichés en taux horaire réel (`€/h`) ;
- affichage maintenance clarifié : estimation `€/h` avec fourchette selon état du matériel.

## Version v60.30 — sauvegarde de départ préparée

- incrément de version de cette passe : badge interface `v60.30`, package `0.4.19` et schéma d’état serveur `32` ;
- ajout d’un `data/save.json` livré dans l’archive ;
- conservation de l’ID joueur fourni : `4c7dfa51-225a-487a-aa42-1b0776c4e1d5` ;
- solde initial fixé à 10 000 000 € ;
- ligne initiale créée : Caen → Bayeux ;
- matériel initial affecté : `Locomotive vapeur 030 mixte` ;
- recherche associée débloquée : `Premières locomotives à vapeur` niveau 1 ;
- deux gares de départ possédées : Caen et Bayeux ;
- effectif minimal ajouté pour que la ligne puisse démarrer avec des agents.

## Version v60.31 — gestion énergie et carburants

- incrément de version de cette passe : badge interface `v60.31`, package `0.4.20` et schéma d’état serveur `33` ;
- ajout d’un nouvel onglet `Énergie` dédié à l’approvisionnement ;
- ajout des ressources joueur : charbon, diesel et commande électrique ;
- les trains vapeur consomment le stock de charbon ;
- les trains diesel consomment le stock de diesel ;
- les trains électriques et batteries consomment une commande producteur en MW/h ;
- la consommation varie avec le modèle, la distance, la fréquence et la composition, donc avec le poids réel du train ;
- si le stock ou la commande électrique est insuffisant, la ligne concernée ne circule plus ;
- ajout des indicateurs supérieurs : Charbon, Diesel, Électricité ;
- ajout de tooltips dynamiques sur Résultat/h, Charbon, Diesel et Électricité avec sources de production et de consommation ;
- la sauvegarde de départ inclut désormais 2 000 unités de charbon.

## Version v60.32 — tooltips ressources nettoyées

- incrément de version de cette passe : badge interface `v60.32`, package `0.4.21` et schéma d’état serveur `34` ;
- suppression du doublon de tooltip à droite de la fenêtre ;
- conservation d’une seule tooltip globale, positionnée près de la donnée survolée ;
- reformattage des tooltips `Résultat/h`, `Charbon`, `Diesel` et `Électricité` avec retours à la ligne lisibles ;
- format standardisé : consommation totale, production totale, séparation, puis détail par train/source.

## Version v60.33 — tooltips colorées

- incrément de version de cette passe : badge interface `v60.33`, package `0.4.22` et schéma d’état serveur `35` ;
- les tooltips ne sont plus rendues en texte brut ;
- les valeurs/lignes de consommation sont affichées en rouge ;
- les valeurs/lignes de production, stock disponible et commande producteur sont affichées en vert ;
- le séparateur est rendu avec un style discret pour améliorer la lecture.

## Version v60.34 — lignes : retrait Marché et demande voyageurs par population

- incrément de version de cette passe : badge interface `v60.34`, package `0.4.23` et schéma d’état serveur `36` ;
- suppression des données `Marché` dans `Lignes > Modifier les lignes` ;
- suppression de `Part moyenne` dans le résumé de modification des lignes ;
- suppression de `Part marché` dans les cartes de ligne ;
- suppression du panneau `Marché` dans le détail d’une ligne ;
- correction de la demande voyageurs des communes : la demande est désormais dérivée de la population par une courbe sous-linéaire ;
- les anciennes valeurs issues du cache communal sont recalculées à la migration/normalisation pour éviter les anomalies du type Lisieux à 850 et Caen à 220 ;
- les gares de base enrichies par les données de population recalculent également leur demande voyageurs.

## Version v60.35 — gares : recherche directe et liste repliable

- incrément de version de cette passe : badge interface `v60.35`, package `0.4.24` et schéma d’état serveur `37` ;
- suppression des suggestions sous le champ de recherche de l’onglet `Gares` ;
- correction de la recherche : taper un nom sélectionne maintenant directement le meilleur résultat trouvé ;
- suppression du menu `Ou choisir dans la liste complète` ;
- déplacement du tri des villes sur la même ligne que `Rechercher une gare à améliorer`, à droite ;
- renommage de `Potentiel fret` en `Demande fret` ;
- retrait de l’information `Tourisme` dans la fiche de gare sélectionnée ;
- le bloc `Gares exploitées` est désormais repliable/dépliable par clic, comme les ères de recherche.

## Version v60.36 — gares : recherche avec menu déroulant

- incrément de version de cette passe : badge interface `v60.36`, package `0.4.25` et schéma d’état serveur `38` ;
- ajout d’un menu déroulant de résultats sous le champ `Rechercher une gare à améliorer` ;
- les suggestions apparaissent uniquement lorsque le champ contient du texte ;
- champ vide : aucune ville affichée sous la recherche et sélection courante vidée ;
- la recherche conserve la sélection automatique du meilleur résultat, mais permet aussi de choisir une autre ville dans la liste proposée.

## Version v60.37 — communes dès 5 000 habitants

- incrément de version de cette passe : badge interface `v60.37`, package `0.4.26` et schéma d’état serveur `39` ;
- seuil des communes jouables abaissé de 10 000 à 5 000 habitants ;
- cache communal renommé en `data/communes-5000-population.json` pour forcer une reconstruction propre et éviter de réutiliser l’ancien cache 10 000 habitants ;
- correction du filtre de dédoublonnage : une commune n’est plus supprimée uniquement parce qu’elle est proche d’une grosse gare existante ; seules les vraies quasi-doublons de nom sont filtrées ;
- ajout manuel de sécurité de Brétigny-sur-Orge dans les gares de base pour qu’elle soit présente même si l’API communes n’a pas encore fini de charger ;
- l’état public du monde expose maintenant le seuil minimal de population chargé (`minPopulation`).

## Version v60.38 — communes > 5 000 : chargement exhaustif et dédoublonnage strict

- incrément de version de cette passe : badge interface `v60.38`, package `0.4.27` et schéma d’état serveur `40` ;
- `/api/state` attend maintenant le chargement du cache communal quand il est vide, au lieu d’afficher uniquement les gares de base au premier rendu ;
- `/api/communes/search` force aussi le chargement du cache communal si nécessaire ;
- le filtre de doublons est resserré :
  - doublon uniquement si même code INSEE/commune ;
  - ou même nom normalisé et coordonnées quasi identiques ;
  - suppression du dédoublonnage agressif par nom proche ou distance large ;
- le cache monde tient compte du seuil `MIN_COMMUNE_POPULATION`, du nombre de communes et de la signature des codes communes ;
- Arpajon est ajouté en filet de sécurité manuel, comme Brétigny-sur-Orge, en attendant le chargement complet API ;
- l’objectif est de conserver toutes les communes de plus de 5 000 habitants sans doublon.

## Version v60.39 — communes > 5 000 : source renforcée et affichage carte

- incrément de version de cette passe : badge interface `v60.39`, package `0.4.28` et schéma d’état serveur `41` ;
- correction du rendu carte : les communes > 5 000 habitants peuvent maintenant apparaître au zoom maximal sans devoir cliquer dessus ;
- le cache de dessin de la carte tient compte de la signature complète de la liste des gares, donc il se met à jour quand le cache communal se charge ;
- dédoublonnage client corrigé : suppression des règles trop agressives qui masquaient des communes proches d’autres villes ;
- source communes renforcée côté serveur :
  - tentative de chargement global ;
  - fallback par départements en parallèle si la source globale est incomplète ou si Longjumeau manque ;
  - dédoublonnage par code INSEE ;
- ajout de Longjumeau en filet de sécurité manuel, comme Arpajon et Brétigny-sur-Orge ;
- `/api/state` reste responsive même si la source distante met du temps à répondre : le cache continue à se charger en arrière-plan, puis l’interface se met à jour au prochain rafraîchissement.

## Version v60.40 — carte : pastilles des villes > 5 000 visibles sans sélection

- incrément de version de cette passe : badge interface `v60.40`, package `0.4.29` et schéma d’état serveur `42` ;
- correction de la cause principale du cas Falaise : les communes entre 5 000 et 15 000 habitants n’étaient dessinées qu’à partir d’un zoom très élevé, alors qu’une sélection forcée passait outre le filtre ;
- la carte affiche maintenant les communes de plus de 5 000 habitants dès le palier de zoom fin, sans devoir cliquer dessus ;
- renforcement du cache de dessin : la signature de la liste de gares inclut désormais les identifiants, codes et populations, pour éviter une liste dessinée obsolète ;
- renforcement de la source départementale : utilisation du endpoint documenté `/departements/{code}/communes` ;
- ajout de Falaise en filet de sécurité manuel, avec code INSEE `14258`, comme Longjumeau/Arpajon/Brétigny-sur-Orge ;
- `data/save.json` conservé dans l’archive.

## Version v60.41 — carte : petites villes seulement au zoom maximal

- incrément de version de cette passe : badge interface `v60.41`, package `0.4.30` et schéma d’état serveur `43` ;
- les communes restent toutes disponibles dans la base, la recherche et la sélection ;
- sur la carte, les communes de 5 000 à 15 000 habitants ne sont dessinées qu’au zoom maximal ;
- les villes moyennes restent affichées avant le zoom maximal pour conserver des repères ;
- objectif : réduire la surcharge visuelle de la carte sans retirer de villes jouables.

## Version v60.42 — carte : anti-chevauchement des pastilles

- incrément de version de cette passe : badge interface `v60.42`, package `0.4.31` et schéma d’état serveur `44` ;
- ajout d’un filtre anti-chevauchement en pixels pour les pastilles de villes ;
- les pastilles sont triées par priorité avant dessin :
  - ville sélectionnée ;
  - gares possédées ;
  - villes desservies ;
  - gares principales ;
  - puis population décroissante ;
- si deux pastilles se chevaucheraient, la moins prioritaire est masquée sur la carte ;
- les villes masquées restent disponibles dans la recherche, la sélection et les menus ;
- la distance minimale entre pastilles dépend du zoom pour éviter la surcharge visuelle autour des zones très denses comme l’Île-de-France ;
- le cache de dessin tient compte du rayon anti-chevauchement.

## Version v60.43 — animation trains basée sur temps de parcours réel

- incrément de version de cette passe : badge interface `v60.43`, package `0.4.32` et schéma d’état serveur `45` ;
- remplacement de l’ancienne animation basée sur `model.speed / 160` ;
- l’animation utilise maintenant :
  - distance réelle de la ligne ;
  - vitesse effective du train (`train.profile.speed`) après composition et recherches ;
  - état du matériel ;
  - nombre d’arrêts intermédiaires ;
  - type de service voyageurs/fret/mixte ;
- le temps visuel d’un aller simple est proportionnel à `distance / vitesse moyenne estimée`, compressé pour rester lisible à l’écran ;
- la fréquence de ligne n’accélère plus artificiellement le train : elle augmente le nombre de rames visibles, avec des positions décalées ;
- une ligne en pénurie de ressource n’affiche plus de train en circulation ;
- l’animation reste bornée pour éviter les trajets trop rapides ou trop lents.

## Version v60.44 — comptes joueurs, connexion et sauvegarde par entreprise

- incrément de version de cette passe : badge interface `v60.44`, package `0.4.33` et schéma d’état serveur `46` ;
- ajout d’un écran de connexion / création de compte ;
- chaque compte possède un identifiant et un mot de passe ;
- les mots de passe ne sont pas stockés en clair : ils sont salés puis dérivés avec `crypto.scryptSync` ;
- les sessions utilisent un jeton aléatoire côté navigateur, stocké côté serveur sous forme de hash SHA-256 ;
- les comptes, sessions et liens compte → entreprise sont sauvegardés dans `data/save.json` ;
- `/api/state` et `/api/action` utilisent maintenant le jeton de session pour retrouver la compagnie du joueur ;
- si des comptes existent, les actions directes par simple `playerId` sont refusées ;
- chaque nouveau compte crée sa propre entreprise et ses propres données ;
- dans une sauvegarde propre sans compte, le premier compte créé récupère la compagnie de départ préparée (`4c7dfa51-225a-487a-aa42-1b0776c4e1d5`) avec ses 10 000 000 €, sa ligne initiale, son train et ses recherches ;
- ajout d’un bouton `Déconnexion` dans la barre supérieure ;
- conservation de `data/save.json` dans l’archive, sans `HANDOFF.md` ni `handoff_manifest.json`.
