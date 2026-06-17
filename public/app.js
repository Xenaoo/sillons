'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const RESEARCH_TECHNICAL_MAX_LEVEL = 1000000;
const PROJECT_VERSION = 'v62.23.0';
const ROUTE_CACHE_MAX_ENTRIES = 2500;
const OSM_ROUTE_CACHE_MAX_ENTRIES = 500;

const COMPANY_LOGOS = [
  { id: 'steam_front', label: 'Locomotive vapeur', src: '/assets/company_logos/steam_front.png' },
  { id: 'winged_wheel', label: 'Roue ailée', src: '/assets/company_logos/winged_wheel.png' },
  { id: 'semaphore', label: 'Sémaphore', src: '/assets/company_logos/semaphore.png' },
  { id: 'royal_track', label: 'Blason voie', src: '/assets/company_logos/royal_track.png' },
  { id: 'tunnel_arch', label: 'Tunnel', src: '/assets/company_logos/tunnel_arch.png' },
  { id: 'electric_rail', label: 'Éclair rail', src: '/assets/company_logos/electric_rail.png' },
  { id: 'mountain_rail', label: 'Montagne', src: '/assets/company_logos/mountain_rail.png' },
  { id: 'laurel_wheel', label: 'Laurier', src: '/assets/company_logos/laurel_wheel.png' },
  { id: 'pantograph', label: 'Pantographe', src: '/assets/company_logos/pantograph.png' },
  { id: 'conductor_cap', label: 'Casquette', src: '/assets/company_logos/conductor_cap.png' },
  { id: 'grand_station', label: 'Grande gare', src: '/assets/company_logos/grand_station.png' },
  { id: 'freight_wagon', label: 'Wagon fret', src: '/assets/company_logos/freight_wagon.png' },
  { id: 'star_track', label: 'Étoile rail', src: '/assets/company_logos/star_track.png' },
  { id: 'compass_rail', label: 'Boussole', src: '/assets/company_logos/compass_rail.png' },
  { id: 'monogram_rail', label: 'Monogramme', src: '/assets/company_logos/monogram_rail.png' },
  { id: 'bridge_truss', label: 'Pont', src: '/assets/company_logos/bridge_truss.png' },
  { id: 'boiler_gauge', label: 'Chaudière', src: '/assets/company_logos/boiler_gauge.png' },
  { id: 'gear_wheel', label: 'Engrenage', src: '/assets/company_logos/gear_wheel.png' },
  { id: 'lantern_wings', label: 'Lanterne', src: '/assets/company_logos/lantern_wings.png' },
  { id: 'switch_roundel', label: 'Aiguillage', src: '/assets/company_logos/switch_roundel.png' }
];


const app = {
  authToken: localStorage.getItem('sillons.authToken') || '',
  playerId: localStorage.getItem('sillons.authToken') ? (localStorage.getItem('sillons.playerId') || '') : '',
  authMode: 'login',
  state: null,
  activeTab: localStorage.getItem('sillons.activeTab') || 'overview',
  activeResearchTab: localStorage.getItem('sillons.researchTab') || 'traction',
  researchEraCollapsed: loadJson('sillons.researchEraCollapsed', {}),
  activeLinesSubtab: localStorage.getItem('sillons.linesSubtab') || 'create',
  activeFleetSubtab: localStorage.getItem('sillons.fleetSubtab') || 'catalog',
  sidePanelCollapsed: localStorage.getItem('sillons.sidePanelCollapsed') === '1',
  admin: { selectedPlayerId: localStorage.getItem('sillons.adminSelectedPlayer') || '' },
  mapPref: 'show',
  selectedStation: localStorage.getItem('sillons.selectedStation') || null,
  hoverStation: null,
  mapSprites: { trains: {}, stations: {} },
  map: {
    canvas: null,
    ctx: null,
    leaflet: null,
    mapReady: false,
    stationPlacement: false,
    invalidatingSize: false,
    dpr: 1,
    width: 0,
    height: 0,
    stationHit: [],
    frame: null,
    navigating: false,
    needsRouteReproject: false,
    lastDrawAt: 0,
    lastFullDrawAt: 0,
    stationDrawCache: { key: '', items: [] },
    visibleStationCache: { key: '', stations: [] },
    routeDataSignature: '',
    trainMotion: {},
    lastMoveEventAt: 0,
    panOverlay: { active: false, anchorLatLng: null, anchorPoint: null, raf: false },
    creatingCustomStation: false,
    view: { zoom: 1, panX: 0, panY: 0 },
    drag: { active: false, moved: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 }
  },
  routeCache: new Map(),
  osmRouteCache: new Map(),
  osmRoutePending: new Set(),
  osmRouteMissing: new Set(),
  lineDraft: loadJson('sillons.lineDraft', {}),
  stationSearch: { query: '', candidateId: '' },
  stationSortMode: localStorage.getItem('sillons.stationSortMode') || 'alpha',
  ownedStationSortMode: localStorage.getItem('sillons.ownedStationSortMode') || 'alpha',
  ownedStationsCollapsed: localStorage.getItem('sillons.ownedStationsCollapsed') === '1',
  budgetCollapsed: loadJson('sillons.budgetCollapsed', {}),
  lineCollapsed: loadJson('sillons.lineCollapsed', {}),
  highlightResearchId: '',
  highlightUiTarget: '',
  dynamicBound: false,
  uiInteractionUntil: 0,
  pendingActions: new Set(),
  refreshInFlight: false,
  serverClockOffset: 0,
  lastRenderKey: '',
  lastNotificationKey: '',
  stationListCache: { source: null, signature: '', deduped: [] },
  selectedCompositionTrainId: localStorage.getItem('sillons.selectedCompositionTrainId') || '',
  compositionEditorModes: loadJson('sillons.compositionEditorModes', {}),
  compositionScrollState: loadJson('sillons.compositionScrollState', {}),
  pendingCompositionScrollRestore: null,
  researchProgressCache: {},
  tutorial: { syncing: false, currentId: '', rect: null, timer: null, positionTimer: null, positionFrame: null, lastScrollKey: '' },
  epochTrafficAnimation: { displayed: null, target: null, lastTarget: null, lastTargetAt: 0, lastFrameAt: 0, rate: 0 }
};


const TUTORIAL_STEPS = [
  { id: 'welcome', target: '.brand', title: 'Bienvenue dans Sillons', body: 'Ce tutoriel guidé va te faire découvrir le jeu de A à Z : acheter un train, régler sa composition, ouvrir une ligne, puis lire les menus importants.', action: 'Commencer' },
  { id: 'overview', target: '#tabs [data-tab="overview"]', title: 'Vue générale', body: 'La Vue donne le résumé de ta compagnie : résultat, réseau, matériel, réputation et alertes. C’est ton poste de contrôle.', action: 'Continuer' },
  { id: 'fleet-tab', target: '#tabs [data-tab="fleet"]', title: 'Va dans le Parc', body: 'Clique sur Parc. C’est ici que tu achètes tes trains, règles les compositions et lances les opérations de maintenance.', wait: 'activeTab:fleet' },
  { id: 'fleet-catalog', target: '[data-fleet-subtab="catalog"]', tab: 'fleet', title: 'Catalogue du matériel', body: 'Le catalogue liste les trains disponibles. Compare prix, vitesse, capacité, énergie, fiabilité et portée avant d’acheter.', wait: 'fleetSubtab:catalog' },
  { id: 'buy-train', target: '[data-action="buy-train"]:not([disabled])', tab: 'fleet', subtab: 'catalog', title: 'Acheter un train', body: 'Achète un premier train adapté à une ligne courte. Si tu as déjà un train, cette étape est automatiquement validée.', wait: 'hasTrain' },
  { id: 'fleet-composition-tab', target: '[data-fleet-subtab="composition"]', tab: 'fleet', title: 'Atelier de compositions', body: 'Clique sur Compositions. Tu vas choisir manuellement les voitures ou wagons pour adapter le train à ton service.', wait: 'fleetSubtab:composition' },
  { id: 'select-composition-train', target: '[data-action="select-composition-train"], [data-action="open-composition"]', tab: 'fleet', subtab: 'composition', title: 'Choisir le train à régler', body: 'Sélectionne le train que tu veux configurer. Les réglages de composition apparaissent ensuite à droite.', wait: 'compositionTrainSelected' },
  { id: 'manual-composition', target: '.composition-editor-card, [data-action="save-train-composition"]', tab: 'fleet', subtab: 'composition', title: 'Composition manuelle', body: 'Règle le nombre de voitures voyageurs ou de wagons. La composition modifie capacité, vitesse, maintenance et rentabilité.', action: 'J’ai compris' },
  { id: 'save-composition', target: '[data-action="save-train-composition"]', tab: 'fleet', subtab: 'composition', title: 'Enregistrer la composition', body: 'Clique sur Enregistrer la composition pour valider le réglage. Cette étape attend une vraie sauvegarde.', wait: 'compositionSaved' },
  { id: 'lines-tab', target: '#tabs [data-tab="lines"]', title: 'Créer une ligne', body: 'Clique sur Lignes. C’est le cœur du jeu : une ligne relie des gares, utilise un train et produit des recettes.', wait: 'activeTab:lines' },
  { id: 'lines-create', target: '[data-lines-subtab="create"]', tab: 'lines', title: 'Sous-menu Créer', body: 'Le sous-menu Créer sert à préparer une nouvelle desserte : départ, terminus, arrêts, train et prix.', wait: 'linesSubtab:create' },
  { id: 'line-from', target: '#lineFromSearch', tab: 'lines', subtab: 'create', title: 'Choisir le départ', body: 'Renseigne la gare d’origine. La recherche accepte les gares principales et les villes jouables.', action: 'Continuer' },
  { id: 'line-to', target: '#lineToSearch', tab: 'lines', subtab: 'create', title: 'Choisir le terminus', body: 'Renseigne la destination. Une ligne courte est préférable au début pour limiter l’usure, le charbon et les coûts.', action: 'Continuer' },
  { id: 'line-train', target: '#lineTrain', tab: 'lines', subtab: 'create', title: 'Affecter un train', body: 'Sélectionne le train libre à utiliser. Un train en maintenance ou à 0 % d’état ne peut pas produire de trafic.', action: 'Continuer' },
  { id: 'line-price', target: '#lineTicketPrice', tab: 'lines', subtab: 'create', title: 'Fixer le prix', body: 'Un prix trop élevé réduit l’attractivité. Cherche un équilibre entre volume de voyageurs et recette par billet.', action: 'Continuer' },
  { id: 'create-line', target: '#createLineBtn:not([disabled])', tab: 'lines', subtab: 'create', title: 'Ouvrir la ligne', body: 'Clique sur Ouvrir la ligne. Si tu possèdes déjà une ligne active, l’étape est validée automatiquement.', wait: 'hasLine' },
  { id: 'lines-manage', target: '[data-lines-subtab="manage"]', tab: 'lines', title: 'Modifier les lignes', body: 'Le sous-menu Modifier sert à suivre la finance, les besoins métiers, la capacité, les arrêts et l’état opérationnel de chaque ligne.', wait: 'linesSubtab:manage' },
  { id: 'stations-tab', target: '#tabs [data-tab="stations"]', title: 'Gares', body: 'Clique sur Gares. Tu peux améliorer les niveaux, commerces, ateliers et dépôts pour soutenir le trafic et la maintenance.', wait: 'activeTab:stations' },
  { id: 'staff-tab', target: '#tabs [data-tab="staff"]', title: 'Ressources humaines', body: 'Clique sur RH. Les conducteurs sont obligatoires, les autres métiers améliorent recettes, régularité, satisfaction, maintenance et infrastructure.', wait: 'activeTab:staff' },
  { id: 'maintenance-tab', target: '[data-fleet-subtab="maintenance"]', tab: 'fleet', title: 'Maintenance', body: 'Retourne dans Parc puis Maintenance. Surveille l’état des trains : à 0 %, ils ne roulent plus et disparaissent de la carte.', wait: 'fleetSubtab:maintenance' },
  { id: 'research-tab', target: '#tabs [data-tab="research"]', title: 'Recherche', body: 'Clique sur R&D. Les recherches débloquent du matériel, de l’exploitation, de l’énergie, du fret, des gares et des bonus sociaux.', wait: 'activeTab:research' },
  { id: 'resources-tab', target: '#tabs [data-tab="resources"]', title: 'Énergie', body: 'Clique sur Énergie. Surveille charbon, diesel et électricité : sans ressource, les lignes concernées s’arrêtent.', wait: 'activeTab:resources' },
  { id: 'market-tab', target: '#tabs [data-tab="market"]', title: 'Marché et financement', body: 'Clique sur Marché. Tu y ajustes les contrats et le financement pour accompagner la croissance de la compagnie.', wait: 'activeTab:market' },
  { id: 'budget-tab', target: '#tabs [data-tab="budget"]', title: 'Budget', body: 'Clique sur Budget. C’est le menu à consulter pour comprendre chaque recette, dépense, charge fixe et résultat net.', wait: 'activeTab:budget' },
  { id: 'done', target: '#tabs [data-tab="overview"]', title: 'Tutoriel terminé', body: 'Tu as vu le chemin principal. Tu peux maintenant optimiser lignes, parc, RH, maintenance, recherche et budget.', action: 'Terminer' }
];

const TUTORIAL_STEP_INDEX = Object.fromEntries(TUTORIAL_STEPS.map((step, index) => [step.id, index]));

const serviceLabels = {
  passengers: 'Voyageurs',
  freight: 'Fret',
  mixed: 'Mixte'
};

const COMPOSITION_ART = {
  coach: '/assets/composition/coach_passenger.png',
  wagon: '/assets/composition/wagon_freight.png',
  power: '/assets/composition/power_unit.png',
  workshop: '/assets/composition/composition_workshop_bg.png'
};

const CLIENT_COMPOSITION_VARIANTS = {
  passenger_loco: [
    { id: 'standard', name: 'Standard', shortLabel: 'Standard', description: 'Voiture polyvalente équilibrée pour la majorité des lignes voyageurs.', asset: '/assets/composition/variants/passenger_standard.png', stats: { capacityMultiplier: 1, speedMultiplier: 1, energyMultiplier: 1, maintenanceMultiplier: 1, reliabilityDelta: 0, comfortDelta: 0, revenueMultiplier: 1 } },
    { id: 'commuter', name: 'Banlieue dense', shortLabel: 'Banlieue', description: 'Plus de places debout et de portes, idéale pour les lignes tendues du quotidien.', asset: '/assets/composition/variants/passenger_commuter.png', stats: { capacityMultiplier: 1.18, speedMultiplier: 1.02, energyMultiplier: 1.04, maintenanceMultiplier: 1.05, reliabilityDelta: -0.008, comfortDelta: -0.1, revenueMultiplier: 1 } },
    { id: 'comfort', name: 'Grand confort', shortLabel: 'Confort', description: 'Moins de sièges mais meilleure image, adaptée aux dessertes premium et longues.', asset: '/assets/composition/variants/passenger_comfort.png', stats: { capacityMultiplier: 0.88, speedMultiplier: 0.98, energyMultiplier: 1.05, maintenanceMultiplier: 1.08, reliabilityDelta: 0.008, comfortDelta: 0.14, revenueMultiplier: 1 } },
    { id: 'sleeper', name: 'Couchettes', shortLabel: 'Couchettes', description: 'Voiture de nuit haut de gamme, capacité réduite mais très confortable.', asset: '/assets/composition/variants/passenger_sleeper.png', stats: { capacityMultiplier: 0.68, speedMultiplier: 0.94, energyMultiplier: 1.08, maintenanceMultiplier: 1.14, reliabilityDelta: -0.004, comfortDelta: 0.2, revenueMultiplier: 1 } },
    { id: 'midi_standard', name: 'Voiture Midi standard', shortLabel: 'Midi std.', description: 'Voiture métallique moderne pour les premières locomotives électriques. Offre équilibrée et plus fiable.', asset: '/assets/composition/era2/passenger_midi_standard.png', stats: { capacityMultiplier: 1.06, speedMultiplier: 1.04, energyMultiplier: 0.98, maintenanceMultiplier: 0.94, reliabilityDelta: 0.018, comfortDelta: 0.04, revenueMultiplier: 1 }, requiredEpoch: 1, requiredTech: 'diesel_passenger_locomotives', requiredModelEpoch: 1 },
    { id: 'midi_commuter', name: 'Voiture Midi banlieue', shortLabel: 'Midi banlieue', description: 'Voiture dense à accès rapides, adaptée aux axes électrifiés à fort trafic.', asset: '/assets/composition/era2/passenger_midi_commuter.png', stats: { capacityMultiplier: 1.26, speedMultiplier: 1.05, energyMultiplier: 1.02, maintenanceMultiplier: 0.98, reliabilityDelta: 0.01, comfortDelta: -0.05, revenueMultiplier: 1 }, requiredEpoch: 1, requiredTech: 'diesel_passenger_locomotives', requiredModelEpoch: 1 },
    { id: 'midi_express', name: 'Voiture Midi express', shortLabel: 'Midi express', description: 'Voiture plus confortable et rapide, pensée pour les services régionaux électrifiés de qualité.', asset: '/assets/composition/era2/passenger_midi_express.png', stats: { capacityMultiplier: 0.96, speedMultiplier: 1.08, energyMultiplier: 1.0, maintenanceMultiplier: 1.02, reliabilityDelta: 0.02, comfortDelta: 0.12, revenueMultiplier: 1 }, requiredEpoch: 1, requiredTech: 'diesel_passenger_locomotives', requiredModelEpoch: 1 },
    { id: 'midi_sleeper', name: 'Voiture Midi couchettes', shortLabel: 'Midi nuit', description: 'Voiture longue distance nocturne, coûteuse mais très attractive sur les liaisons de nuit.', asset: '/assets/composition/era2/passenger_midi_sleeper.png', stats: { capacityMultiplier: 0.72, speedMultiplier: 1.02, energyMultiplier: 1.04, maintenanceMultiplier: 1.10, reliabilityDelta: 0.005, comfortDelta: 0.24, revenueMultiplier: 1 }, requiredEpoch: 1, requiredTech: 'diesel_passenger_locomotives', requiredModelEpoch: 1 }
  ],
  freight_loco: [
    { id: 'covered', name: 'Wagon couvert', shortLabel: 'Couvert', description: 'Marchandises générales et palettes. Référence polyvalente.', cargoType: 'Marchandises générales', asset: '/assets/composition/variants/freight_covered.png', stats: { capacityMultiplier: 1, speedMultiplier: 1, energyMultiplier: 1, maintenanceMultiplier: 1, reliabilityDelta: 0, comfortDelta: 0, revenueMultiplier: 1 } },
    { id: 'tank', name: 'Wagon citerne', shortLabel: 'Citerne', description: 'Liquides, carburants et produits chimiques à forte valeur.', cargoType: 'Liquides / carburants', asset: '/assets/composition/variants/freight_tank.png', stats: { capacityMultiplier: 0.92, speedMultiplier: 0.95, energyMultiplier: 1.08, maintenanceMultiplier: 1.09, reliabilityDelta: -0.01, comfortDelta: 0, revenueMultiplier: 1.18 } },
    { id: 'hopper', name: 'Trémie vrac', shortLabel: 'Trémie', description: 'Vracs lourds : céréales, minerais, granulats. Très capacitaire.', cargoType: 'Vrac lourd', asset: '/assets/composition/variants/freight_hopper.png', stats: { capacityMultiplier: 1.22, speedMultiplier: 0.92, energyMultiplier: 1.11, maintenanceMultiplier: 1.07, reliabilityDelta: -0.016, comfortDelta: 0, revenueMultiplier: 0.94 } },
    { id: 'flatbed', name: 'Plat / ranchers', shortLabel: 'Plat', description: 'Bois, acier, engins et charges longues.', cargoType: 'Charges longues', asset: '/assets/composition/variants/freight_flatbed.png', stats: { capacityMultiplier: 0.96, speedMultiplier: 0.98, energyMultiplier: 0.98, maintenanceMultiplier: 0.98, reliabilityDelta: 0.004, comfortDelta: 0, revenueMultiplier: 1.04 } },
    { id: 'reefer', name: 'Frigorifique', shortLabel: 'Frigo', description: 'Produits frais à forte valeur, wagon plus coûteux à exploiter.', cargoType: 'Denrées fraîches', asset: '/assets/composition/variants/freight_reefer.png', stats: { capacityMultiplier: 0.82, speedMultiplier: 0.96, energyMultiplier: 1.12, maintenanceMultiplier: 1.12, reliabilityDelta: -0.004, comfortDelta: 0, revenueMultiplier: 1.25 } },
    { id: 'container', name: 'Porte-conteneurs', shortLabel: 'Conteneurs', description: 'Flux intermodaux rapides, bien adaptés aux longues distances.', cargoType: 'Intermodal', asset: '/assets/composition/variants/freight_container.png', stats: { capacityMultiplier: 1.08, speedMultiplier: 1.02, energyMultiplier: 1.04, maintenanceMultiplier: 1.04, reliabilityDelta: 0.005, comfortDelta: 0, revenueMultiplier: 1.12 } },
    { id: 'midi_covered', name: 'Couvert Midi métallique', shortLabel: 'Midi couvert', description: 'Wagon couvert renforcé pour marchandises générales sous caténaires pionnières.', cargoType: 'Marchandises générales', asset: '/assets/composition/era2/freight_midi_covered.png', stats: { capacityMultiplier: 1.12, speedMultiplier: 1.04, energyMultiplier: 0.98, maintenanceMultiplier: 0.96, reliabilityDelta: 0.014, comfortDelta: 0, revenueMultiplier: 1.04 }, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
    { id: 'midi_tank', name: 'Citerne Midi', shortLabel: 'Midi citerne', description: 'Citerne moderne pour liquides industriels, plus rentable mais plus exigeante.', cargoType: 'Liquides / carburants', asset: '/assets/composition/era2/freight_midi_tank.png', stats: { capacityMultiplier: 1.00, speedMultiplier: 1.00, energyMultiplier: 1.04, maintenanceMultiplier: 1.06, reliabilityDelta: 0.002, comfortDelta: 0, revenueMultiplier: 1.22 }, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
    { id: 'midi_hopper', name: 'Trémie Midi', shortLabel: 'Midi trémie', description: 'Trémie lourde pour minerais et vracs, très capacitaire sur les axes industriels.', cargoType: 'Vrac lourd', asset: '/assets/composition/era2/freight_midi_hopper.png', stats: { capacityMultiplier: 1.34, speedMultiplier: 0.96, energyMultiplier: 1.08, maintenanceMultiplier: 1.05, reliabilityDelta: -0.006, comfortDelta: 0, revenueMultiplier: 0.98 }, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
    { id: 'midi_flatbed', name: 'Plat Midi ranchers', shortLabel: 'Midi plat', description: 'Wagon plat modernisé pour acier, bois et engins lourds.', cargoType: 'Charges longues', asset: '/assets/composition/era2/freight_midi_flatbed.png', stats: { capacityMultiplier: 1.05, speedMultiplier: 1.02, energyMultiplier: 0.98, maintenanceMultiplier: 0.96, reliabilityDelta: 0.012, comfortDelta: 0, revenueMultiplier: 1.08 }, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
    { id: 'midi_reefer', name: 'Frigorifique Midi', shortLabel: 'Midi frigo', description: 'Fourgon frigorifique électrique, faible tonnage mais forte valeur transportée.', cargoType: 'Denrées fraîches', asset: '/assets/composition/era2/freight_midi_reefer.png', stats: { capacityMultiplier: 0.90, speedMultiplier: 1.03, energyMultiplier: 1.10, maintenanceMultiplier: 1.10, reliabilityDelta: 0.004, comfortDelta: 0, revenueMultiplier: 1.30 }, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
    { id: 'midi_container', name: 'Porte-caisses Midi', shortLabel: 'Midi caisses', description: 'Précurseur intermodal pour caisses et conteneurs légers, performant sur longues distances.', cargoType: 'Intermodal', asset: '/assets/composition/era2/freight_midi_container.png', stats: { capacityMultiplier: 1.18, speedMultiplier: 1.06, energyMultiplier: 1.02, maintenanceMultiplier: 1.02, reliabilityDelta: 0.016, comfortDelta: 0, revenueMultiplier: 1.16 }, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 }
  ]
};


const energyLabels = {
  coal: 'Charbon',
  diesel: 'Diesel',
  electricity: 'Électricité',
  hydrogen: 'Hydrogène',
  battery: 'Batterie'
};
const staffOrder = ['drivers', 'controllers', 'stationAgents', 'mechanics', 'dispatchers', 'engineers'];
const techOrder = ['traction', 'energy', 'maintenance', 'operations', 'stations', 'social', 'freight'];
const DEFAULT_PASSENGER_TARIFF = 0.08;
const DEFAULT_TICKET_DISTANCE = 120;
// Même plafond que côté serveur : prix billet maximum fixe.
const TICKET_PRICE_CAP_ABSOLUTE = 28;
const MAINTENANCE_COST_MULTIPLIER_CLIENT = 0.48;
const STAFF_COST_DIVISOR_CLIENT = 82;


const ART = {
  map: '/assets/art/hero-france-map.png',
  tabs: {
    overview: '/assets/art/hero-overview-v12.png',
    lines: '/assets/art/hero-lines-v12.png',
    fleet: '/assets/art/hero-fleet-v12.png',
    stations: '/assets/art/hero-stations-v12.png',
    staff: '/assets/art/hero-staff-v12.png',
    research: '/assets/art/hero-research-v12.png',
    market: '/assets/art/hero-market-v12.png',
    resources: '/assets/art/hero-market-v12.png',
    budget: '/assets/art/hero-market-v12.png'
  },
  researchGroups: {
    traction: '/assets/art/board-traction.png',
    energy: '/assets/art/board-energy.png',
    maintenance: '/assets/art/board-maintenance.png',
    operations: '/assets/art/board-operations.png',
    stations: '/assets/art/board-transports.png',
    freight: '/assets/art/board-freight.png',
    social: '/assets/art/board-transports.png'
  },
  researchNodes: {}
};

const artImages = {};

const MAP_ART_FRAME = { x: 0.177, y: 0.067, w: 0.58, h: 0.79 };
const AUTO_MAP_TABS = new Set(['overview', 'lines', 'stations']);

const TRAIN_MAP_SPRITES = {};

const STATION_MAP_SPRITES = {
  1: '/assets/map/stations/station_level_1.png',
  2: '/assets/map/stations/station_level_2.png',
  3: '/assets/map/stations/station_level_3.png',
  4: '/assets/map/stations/station_level_4.png',
  5: '/assets/map/stations/station_level_5.png',
  6: '/assets/map/stations/station_level_6.png'
};

const MAP_CITY_ANCHORS = {
  BRE: [0.177, 0.315], REN: [0.276, 0.365], NAN: [0.337, 0.418],
  ROU: [0.425, 0.181], AMI: [0.500, 0.165], LIL: [0.571, 0.112],
  PAR: [0.508, 0.276], REI: [0.580, 0.232], STR: [0.713, 0.302],
  ORL: [0.505, 0.400], TOU2: [0.431, 0.421], BOR: [0.346, 0.609],
  TOU: [0.431, 0.741], MON: [0.549, 0.784], MAR: [0.663, 0.785],
  NIC: [0.774, 0.708], DIJ: [0.624, 0.431], LYO: [0.588, 0.548],
  CLE: [0.504, 0.551], LEH: [0.396, 0.170], CAE: [0.339, 0.222],
  CHB: [0.245, 0.164], QUI: [0.174, 0.428], LOR: [0.229, 0.411],
  VAN: [0.266, 0.391], STB: [0.225, 0.332], ANG: [0.369, 0.400],
  POI: [0.395, 0.520], LIM: [0.447, 0.592], LAR: [0.336, 0.528],
  BIA: [0.299, 0.785], PAU: [0.343, 0.762], AGE: [0.409, 0.681],
  STE: [0.565, 0.587], VAL: [0.601, 0.642], AVI: [0.626, 0.695],
  TOU3: [0.714, 0.730], CAN: [0.745, 0.712], NIM: [0.592, 0.730],
  BEZ: [0.518, 0.742], PER: [0.491, 0.808], CAR: [0.479, 0.703],
  ALB: [0.453, 0.676], MET: [0.618, 0.215], NAN2: [0.641, 0.242],
  MUL: [0.735, 0.347], BES: [0.634, 0.371], BEL: [0.690, 0.354],
  MAC: [0.566, 0.502], AUX: [0.551, 0.358], TRO: [0.590, 0.276],
  DUN: [0.553, 0.080], CAL: [0.517, 0.098], ARR: [0.527, 0.146],
  LAV: [0.340, 0.370], LRS: [0.311, 0.488], NEV: [0.526, 0.488],
  BOU: [0.492, 0.505], CHA2: [0.463, 0.545], BAY: [0.310, 0.243],
  GRE: [0.617, 0.593], CHA: [0.639, 0.571], ANN: [0.661, 0.542]
};

const RAIL_SEGMENT_SHAPES = {
  'PAR|LIL': [[0.535,0.235],[0.552,0.172]],
  'PAR|AMI': [[0.483,0.225]], 'PAR|ROU': [[0.455,0.232]], 'PAR|CAE': [[0.420,0.246]],
  'AMI|ARR': [[0.516,0.154]], 'AMI|ROU': [[0.464,0.182]], 'ROU|LEH': [[0.404,0.169]],
  'ROU|CAE': [[0.387,0.205]], 'CAE|REN': [[0.306,0.272]], 'CAE|BAY': [[0.318,0.233]], 'BAY|CHB': [[0.273,0.202]],
  'REN|NAN': [[0.301,0.392]], 'NAN|ANG': [[0.356,0.408]], 'ANG|TOU2': [[0.400,0.408]],
  'PAR|REI': [[0.546,0.255]], 'REI|MET': [[0.602,0.225]], 'MET|NAN2': [[0.629,0.232]], 'NAN2|STR': [[0.684,0.264]],
  'STR|MUL': [[0.725,0.328]], 'MUL|BEL': [[0.709,0.344]], 'BEL|BES': [[0.669,0.365]], 'BES|DIJ': [[0.628,0.395]],
  'DIJ|PAR': [[0.602,0.388],[0.558,0.339]], 'PAR|AUX': [[0.551,0.321]], 'AUX|DIJ': [[0.592,0.378]],
  'PAR|ORL': [[0.505,0.338]], 'ORL|TOU2': [[0.463,0.404]], 'TOU2|POI': [[0.420,0.470]],
  'POI|BOR': [[0.370,0.575]], 'BOR|BIA': [[0.318,0.740]], 'BIA|PAU': [[0.323,0.774]],
  'BOR|AGE': [[0.394,0.646]], 'AGE|TOU': [[0.417,0.704]], 'TOU|AGE': [[0.417,0.704]], 'TOU|ALB': [[0.444,0.692]],
  'PAR|LEM': [[0.445,0.335]], 'LEM|LAV': [[0.360,0.366]], 'LAV|REN': [[0.320,0.358]],
  'REN|STB': [[0.255,0.338]], 'STB|BRE': [[0.196,0.319]], 'BRE|QUI': [[0.170,0.382]], 'QUI|LOR': [[0.208,0.418]], 'LOR|VAN': [[0.248,0.404]], 'VAN|NAN': [[0.292,0.402]],
  'NAN|LRS': [[0.317,0.470]], 'LRS|LAR': [[0.324,0.504]], 'LAR|BOR': [[0.337,0.563]],
  'DIJ|MAC': [[0.593,0.472]], 'MAC|LYO': [[0.578,0.526]], 'LYO|STE': [[0.576,0.574]], 'LYO|VAL': [[0.594,0.605]], 'VAL|AVI': [[0.614,0.670]], 'AVI|MAR': [[0.648,0.748]],
  'MAR|TOU3': [[0.688,0.749]], 'TOU3|CAN': [[0.726,0.719]], 'CAN|NIC': [[0.762,0.711]],
  'AVI|NIM': [[0.607,0.709]], 'NIM|MON': [[0.566,0.756]], 'MON|BEZ': [[0.527,0.760]], 'BEZ|PER': [[0.499,0.793]], 'BEZ|CAR': [[0.492,0.726]], 'CAR|TOU': [[0.453,0.705]],
  'PAR|NEV': [[0.515,0.432]], 'NEV|BOU': [[0.497,0.497]], 'BOU|CHA2': [[0.471,0.528]], 'CHA2|LIM': [[0.454,0.574]], 'LIM|POI': [[0.422,0.542]],
  'LYO|GRE': [[0.609,0.578]], 'GRE|CHA': [[0.628,0.565]], 'CHA|ANN': [[0.649,0.544]],
  'CLE|LYO': [[0.548,0.556]], 'CLE|NEV': [[0.515,0.511]], 'NIM|AVI': [[0.607,0.709]], 'MON|NIM': [[0.566,0.756]],
  'PER|BEZ': [[0.499,0.793]], 'TOU|CAR': [[0.453,0.705]], 'MAR|AVI': [[0.648,0.748]], 'NIC|CAN': [[0.762,0.711]]
};

init();

async function init() {
  app.map.canvas = $('#map');
  app.map.ctx = app.map.canvas.getContext('2d');
  bindStaticEvents();
  preloadArt();
  preloadMapSprites();
  initOsmMap();
  await refreshState(true);
  setInterval(() => refreshState(false), 2300);
  startResearchAnimationLoop();
  requestAnimationFrame(drawLoop);
}


function syncSidePanelCollapseUi(animate = true) {
  const layout = document.querySelector('.layout');
  const btn = $('#panelCollapseBtn');
  if (!layout || !btn) return;
  layout.classList.toggle('side-collapsed', !!app.sidePanelCollapsed);
  layout.classList.toggle('no-panel-transition', !animate);
  btn.classList.toggle('is-collapsed', !!app.sidePanelCollapsed);
  btn.setAttribute('aria-label', app.sidePanelCollapsed ? 'Rouvrir le panneau latéral' : 'Réduire le panneau latéral');
  btn.title = app.sidePanelCollapsed ? 'Rouvrir le panneau latéral' : 'Réduire le panneau latéral';
  const arrow = btn.querySelector('span');
  if (arrow) arrow.textContent = app.sidePanelCollapsed ? '‹' : '›';
  requestAnimationFrame(() => {
    if (layout.classList.contains('no-panel-transition')) layout.classList.remove('no-panel-transition');
    resizeCanvas();
    scheduleLeafletInvalidateSize();
    drawMap();
  });
}

function toggleSidePanelCollapse() {
  app.sidePanelCollapsed = !app.sidePanelCollapsed;
  localStorage.setItem('sillons.sidePanelCollapsed', app.sidePanelCollapsed ? '1' : '0');
  syncSidePanelCollapseUi(true);
}

function bindStaticEvents() {
  $('#setupForm').addEventListener('submit', handleAuthSubmit);
  $('#authLoginTab')?.addEventListener('click', () => setAuthMode('login'));
  $('#authRegisterTab')?.addEventListener('click', () => setAuthMode('register'));
  $('#logoutBtn')?.addEventListener('click', logoutAccount);

  $('#tabs').addEventListener('click', event => {
    const button = event.target.closest('button[data-tab]');
    if (!button) return;
    app.activeTab = button.dataset.tab;
    localStorage.setItem('sillons.activeTab', app.activeTab);
    renderAll();
  });

  $('#mapToggleBtn')?.addEventListener('click', toggleMapVisibility);
  $('#panelCollapseBtn')?.addEventListener('click', toggleSidePanelCollapse);
  syncSidePanelCollapseUi(false);
  $('#zoomInBtn')?.addEventListener('click', () => app.map.leaflet?.zoomIn());
  $('#zoomOutBtn')?.addEventListener('click', () => app.map.leaflet?.zoomOut());
  $('#zoomResetBtn')?.addEventListener('click', fitFranceMap);
  $('#addStopBtn')?.addEventListener('click', enableStationPlacement);
  $('#cancelStopBtn')?.addEventListener('click', disableStationPlacement);
  $('#renameBtn').addEventListener('click', openCompanyModal);
  $('#tutorialBtn')?.addEventListener('click', () => syncTutorial({ op: 'restart' }));
  $('#resetBtn').addEventListener('click', openResetModal);
  document.addEventListener('click', event => {
    const versionBadge = event.target.closest('#versionBadge');
    if (!versionBadge) return;
    event.preventDefault();
    openChangelogModal();
  });

  $('#logoPicker')?.addEventListener('click', event => {
    const card = event.target.closest('[data-logo-id]');
    if (!card) return;
    selectSetupLogo(card.dataset.logoId);
  });

  document.addEventListener('focusin', markUiInteraction, true);
  document.addEventListener('pointerdown', event => {
    if (isInteractiveElement(event.target)) markUiInteraction();
  }, true);
  document.addEventListener('input', event => {
  if (event.target.id === 'compPassengerCars') { const n = $('#compPassengerCarsValue'); if (n) n.value = event.target.value; }
  if (event.target.id === 'compPassengerCarsValue') { const n = $('#compPassengerCars'); if (n) n.value = event.target.value; }
  if (event.target.id === 'compFreightCars') { const n = $('#compFreightCarsValue'); if (n) n.value = event.target.value; }
  if (event.target.id === 'compFreightCarsValue') { const n = $('#compFreightCars'); if (n) n.value = event.target.value; }
  if (event.target.id === 'compPowerUnits') { const n = $('#compPowerUnitsValue'); if (n) n.value = event.target.value; }
  if (event.target.id === 'compPowerUnitsValue') { const n = $('#compPowerUnits'); if (n) n.value = event.target.value; }
    if (isInteractiveElement(event.target)) markUiInteraction();
  }, true);
  document.addEventListener('change', event => {
    if (isInteractiveElement(event.target)) markUiInteraction();
  }, true);

  const tabContent = $('#tabContent');
  tabContent.addEventListener('click', onTabContentClick);
  tabContent.addEventListener('change', onTabContentChange);
  tabContent.addEventListener('input', event => {
    if (['lineTicketPrice', 'lineTicketPriceRange'].includes(event.target.id)) {
      updateLineDraftFromForm(event.target.id);
      updateLinePreview(event.target.id);
    }
    if (event.target.classList?.contains('station-search-input')) {
      updateStationSearch(event.target.dataset.role, event.target.value);
    }
  });

  window.addEventListener('resize', () => { resizeCanvas(); hideGlobalTooltip(); scheduleTutorialOverlayPosition(60, { scroll: false }); });
  window.visualViewport?.addEventListener('resize', () => scheduleTutorialOverlayPosition(60, { scroll: false }));
  window.visualViewport?.addEventListener('scroll', () => scheduleTutorialOverlayPosition(30, { scroll: false }));
  window.addEventListener('scroll', () => scheduleTutorialOverlayPosition(30, { scroll: false }), true);
  bindGlobalTooltips();
}


function bindGlobalTooltips() {
  document.addEventListener('pointerover', event => {
    const target = event.target.closest?.('[data-tooltip]');
    if (!target) return;
    showGlobalTooltip(target);
  });
  document.addEventListener('pointerout', event => {
    const target = event.target.closest?.('[data-tooltip]');
    if (target) hideGlobalTooltip();
  });
  document.addEventListener('focusin', event => {
    const target = event.target.closest?.('[data-tooltip]');
    if (target) showGlobalTooltip(target);
  });
  document.addEventListener('focusout', event => {
    if (event.target.closest?.('[data-tooltip]')) hideGlobalTooltip();
  });
  document.addEventListener('scroll', hideGlobalTooltip, true);
  document.addEventListener('scroll', event => {
    const editor = event.target?.closest?.('.composition-editor-card');
    if (editor || event.target?.classList?.contains('composition-editor-card') || event.target?.classList?.contains('composition-strip')) {
      captureCompositionScrollPosition();
    }
  }, true);
}

function tooltipLineClass(line) {
  const text = String(line || '').trim().toLowerCase();
  if (!text) return '';
  if (/^bonus\b|^\[\+\]|^\+/.test(text)) return 'tooltip-line--production';
  if (/^malus\b|^\[-\]|^-/.test(text)) return 'tooltip-line--consumption';
  if (text.startsWith('dépenses') || text.startsWith('depenses') || text.startsWith('charges') || text.startsWith('consommation')) return 'tooltip-line--consumption';
  if (text.startsWith('revenus') || text.startsWith('stock disponible') || text.startsWith('commande producteur') || text.startsWith('production')) return 'tooltip-line--production';
  if (text.startsWith('résultat net') || text.startsWith('resultat net')) {
    const match = text.match(/([-+]?\d[\d\s.,]*)\s*€/);
    if (match) return String(match[1]).trim().startsWith('-') ? 'tooltip-line--consumption' : 'tooltip-line--production';
  }
  if (/^-{4,}$/.test(text)) return 'tooltip-line--separator';
  return '';
}

function renderTooltipLine(line) {
  const cls = tooltipLineClass(line);
  const row = document.createElement('div');
  row.className = `tooltip-line ${cls}`.trim();
  const valueSplit = String(line || '').split(/:(.+)/);
  if (cls === 'tooltip-line--separator') {
    row.textContent = '────────────────────────────';
    return row;
  }
  if (valueSplit.length >= 3) {
    const label = document.createElement('span');
    label.className = 'tooltip-label';
    label.textContent = `${valueSplit[0]} : `;
    const value = document.createElement('b');
    value.className = 'tooltip-value';
    value.textContent = valueSplit[1].trim();
    row.append(label, value);
  } else {
    row.textContent = line;
  }
  return row;
}

function showGlobalTooltip(target) {
  const text = target.dataset.tooltip;
  if (!text) return;
  let tip = $('#globalTooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'globalTooltip';
    tip.className = 'global-tooltip';
    document.body.appendChild(tip);
  }
  tip.innerHTML = '';
  String(text).split('\n').forEach(line => tip.appendChild(renderTooltipLine(line)));
  tip.classList.add('visible');

  const rect = target.getBoundingClientRect();
  const margin = 12;
  const maxWidth = Math.min(460, window.innerWidth - margin * 2);
  tip.style.maxWidth = `${maxWidth}px`;
  tip.style.left = '0px';
  tip.style.top = '0px';

  const box = tip.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - box.width / 2;
  left = Math.max(margin, Math.min(window.innerWidth - box.width - margin, left));

  let top = rect.top - box.height - 12;
  if (top < margin) top = rect.bottom + 12;
  if (top + box.height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - box.height - margin);

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function hideGlobalTooltip() {
  const tip = $('#globalTooltip');
  if (tip) tip.classList.remove('visible');
}


function invalidateMapProjection(reason = 'projection') {
  app.routeCache.clear();
  app.map.needsRouteReproject = false;
  app.map.stationDrawCache = { key: '', items: [] };
  app.map.visibleStationCache = { key: '', stations: [] };
}

function markMapProjectionDirty() {
  app.map.needsRouteReproject = true;
  app.map.stationDrawCache.key = '';
}

function rememberCacheEntry(cache, key, value, maxEntries) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  return value;
}

function getCacheEntry(cache, key) {
  if (!cache.has(key)) return null;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function startPanOverlay() {
  if (!app.map.leaflet || !app.map.canvas || app.map.panOverlay.active) return;
  app.map.panOverlay.active = true;
  app.map.panOverlay.anchorLatLng = app.map.leaflet.getCenter();
  app.map.panOverlay.anchorPoint = app.map.leaflet.latLngToContainerPoint(app.map.panOverlay.anchorLatLng);
  app.map.panOverlay.raf = false;
  app.map.canvas.classList.add('map-pan-overlay');
  app.map.canvas.style.willChange = 'transform';
}

function updatePanOverlay() {
  const overlay = app.map.panOverlay;
  if (!overlay.active || overlay.raf || !app.map.leaflet || !app.map.canvas || !overlay.anchorLatLng || !overlay.anchorPoint) return;
  overlay.raf = true;
  requestAnimationFrame(() => {
    overlay.raf = false;
    if (!overlay.active || !app.map.leaflet || !app.map.canvas) return;
    const current = app.map.leaflet.latLngToContainerPoint(overlay.anchorLatLng);
    const dx = current.x - overlay.anchorPoint.x;
    const dy = current.y - overlay.anchorPoint.y;
    app.map.canvas.style.transform = `translate3d(${Math.round(dx)}px, ${Math.round(dy)}px, 0)`;
  });
}

function endPanOverlay() {
  const overlay = app.map.panOverlay;
  if (!overlay.active || !app.map.canvas) return;
  overlay.active = false;
  overlay.anchorLatLng = null;
  overlay.anchorPoint = null;
  overlay.raf = false;
  app.map.canvas.style.transform = '';
  app.map.canvas.style.willChange = '';
  app.map.canvas.classList.remove('map-pan-overlay');
}

function worldRouteSignature(state = app.state) {
  if (!state?.players || !state?.world) return '';
  const playerSig = state.players.map(p => `${p.id}:${(p.lines || []).map(l => `${l.id}:${lineStopsOf(l).join('>')}:${lineTrainIdsOf(l).join('+')}:${l.active ? 1 : 0}:${l.electrified ? 1 : 0}`).join('|')}`).join('||');
  const customCount = state.world.stations?.filter?.(s => s.custom)?.length || 0;
  const communeStatus = state.world.communesStatus || {};
  const stationSig = `${state.world.stations?.length || 0}:${communeStatus.status || ''}:${communeStatus.count || 0}:${communeStatus.updatedAt || ''}`;
  return `${playerSig}::stations:${stationSig}::custom:${customCount}`;
}

function stateRenderSignature(state = app.state) {
  if (!state?.game) return '';
  const me = state.me;
  const game = state.game;
  const events = (game.events || []).map(e => `${e.kind}:${e.remaining}`).join('|');
  const news = (game.news || []).map(n => `${n.day}:${n.text}`).join('|');
  const world = state.world?.communesStatus;
  const meSig = me ? [
    me.id,
    me.cash,
    me.debt,
    me.epoch,
    Math.round(me.research * 100),
    Math.round(me.reputation * 100),
    me.stats?.lastRevenue,
    me.stats?.lastExpenses,
    me.stats?.lastProfit,
    me.stats?.passengers,
    me.stats?.freightTons,
    epochTrafficTotalClient(me),
    Object.values(me.staff || {}).join(','),
    Object.keys(me.stations || {}).length,
    (me.trains || []).map(t => `${t.id}:${Math.round((t.condition || 0) * 1000)}:${t.profile?.speed || ''}:${t.profile?.energy || ''}:${t.maintenance?.active ? t.maintenance.daysLeft : 0}`).join('|'),
    (me.lines || []).map(l => `${l.id}:${l.active ? 1 : 0}:${l.frequency}:${l.tariff}:${l.service}:${lineTrainIdsOf(l).join('+')}:${lineStopsOf(l).join('>')}:${l.stats?.revenue}:${l.stats?.expenses}:${l.stats?.profit}:${l.stats?.passengers}:${l.stats?.freightTons}:${l.stats?.market?.passengerShare}:${l.stats?.market?.freightShare}`).join('|'),
    Object.entries(me.techUnlocked || {}).sort().map(([id, level]) => `${id}:${level}`).join(','),
    me.researchProject ? `${me.researchProject.nodeId}:${me.researchProject.targetLevel}:${me.researchProject.durationMs}:${me.researchProject.costMoney || 0}:${me.researchProject.startedAt || 0}` : '',
    (me.researchQueue || []).map(item => `${item.nodeId}:${item.targetLevel}`).join('|')
  ].join(';') : 'setup';
  return [
    game.day,
    game.eraYear,
    game.playerCount,
    events,
    news,
    world?.status || '',
    world?.count || 0,
    worldRouteSignature(state),
    meSig
  ].join('::');
}

async function refreshState(first) {
  if (app.refreshInFlight) return;
  app.refreshInFlight = true;
  try {
    const response = await fetch('/api/state', { cache: 'no-store', headers: authHeaders() });
    const data = await readJsonResponse(response, 'Reponse serveur invalide.');
    if (response.status === 401) {
      clearAuthState();
      $('#setup')?.classList.remove('hidden');
    }
    if (!data.ok) throw new Error(data.error || 'État indisponible.');
    app.serverClockOffset = Number(data.serverTime || Date.now()) - Date.now();
    const previousSignature = app.routeDataSignature;
    const previousCash = Number(app.state?.me?.cash);
    app.state = data;
    const nextSignature = worldRouteSignature(data);
    if (nextSignature !== previousSignature) {
      app.routeDataSignature = nextSignature;
      invalidateMapProjection('state-change');
    }
    if (first) {
      renderSetupLogoPicker();
      if (!data.me) { $('#setup').classList.remove('hidden'); setAuthMode(app.authMode || 'login'); }
      resizeCanvas();
    }
    if (data.auth?.playerId) { app.playerId = data.auth.playerId; localStorage.setItem('sillons.playerId', app.playerId); }
    if (data.me) {
      $('#setup').classList.add('hidden');
      maybeNotify(data.me);
      ensureSelectedStation();
    }
    const nextRenderKey = stateRenderSignature(data);
    const shouldRender = first || nextRenderKey !== app.lastRenderKey;
    if (!shouldRender) return;
    if (!first && isInteractiveUiActive()) {
      // Ne pas reconstruire l’onglet pendant une interaction utilisateur :
      // menus déroulants, saisie, sliders, suggestions et formulaires restent ouverts.
      renderTopbar();
    } else {
      renderAll();
    }
    const nextCash = Number(data.me?.cash);
    if (!first && Number.isFinite(previousCash) && Number.isFinite(nextCash) && previousCash !== nextCash) {
      animateCashDelta(nextCash - previousCash);
    }
  } catch (error) {
    if (first) toast('Impossible de joindre le serveur local. Lance `node server.js` puis recharge la page.', 'error');
    console.error(error);
  } finally {
    app.refreshInFlight = false;
  }
}


function initOsmMap() {
  const target = $('#osmMap');
  if (!target) return;
  if (!window.L) {
    target.innerHTML = '<div class="osm-error">Carte indisponible. Vérifie ta connexion internet.</div><canvas id="map" width="1200" height="820"></canvas>';
    app.map.canvas = $('#map');
    app.map.ctx = app.map.canvas?.getContext('2d');
    resizeCanvas();
    return;
  }

  app.map.leaflet = L.map(target, {
    center: [46.75, 2.35],
    zoom: 6,
    minZoom: 5,
    maxZoom: 13,
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true
  });

  addReliableFrenchTileLayer(app.map.leaflet);

  L.control.zoom({ position: 'bottomright' }).addTo(app.map.leaflet);

  app.map.leaflet.on('zoomstart', () => {
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    resizeCanvas();
    markMapProjectionDirty();
  });
  app.map.leaflet.on('zoom', () => {
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    markMapProjectionDirty();
  });
  app.map.leaflet.on('zoomend', () => {
    app.map.navigating = false;
    endPanOverlay();
    resizeCanvas();
    updateIsoClass();
    invalidateMapProjection('zoom-end');
  });

  app.map.leaflet.on('movestart', () => {
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    startPanOverlay();
  });
  app.map.leaflet.on('move', () => {
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    updatePanOverlay();
  });
  app.map.leaflet.on('moveend resize', () => {
    app.map.navigating = false;
    endPanOverlay();
    resizeCanvas();
    updateIsoClass();
    invalidateMapProjection('move-end');
  });
  app.map.leaflet.on('mousemove', onOsmMouseMove);
  app.map.leaflet.on('mouseout', () => {
    app.hoverStation = null;
    app.map.leaflet.getContainer().style.cursor = app.map.stationPlacement ? 'crosshair' : '';
  });
  app.map.leaflet.on('click', onOsmClick);

  // Filet de sécurité v43 : en mode création d’arrêt, on capte aussi le clic
  // DOM du conteneur. Cela évite que les hitboxes canvas/Leaflet ou certains
  // overlays empêchent la création sur une zone vide de la carte.
  target.addEventListener('click', event => {
    if (!app.map.stationPlacement || !app.map.leaflet || app.map.creatingCustomStation) return;
    if (event.target.closest?.('.leaflet-control')) return;
    event.preventDefault();
    event.stopPropagation();
    const point = app.map.leaflet.mouseEventToContainerPoint(event);
    const latlng = app.map.leaflet.containerPointToLatLng(point);
    createCustomStationFromLatLng(latlng);
  }, true);

  app.map.leaflet.whenReady(() => {
    app.map.mapReady = true;
    resizeCanvas();
    fitFranceMap();
    updateIsoClass();
  });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(target);
  }
}

function addReliableFrenchTileLayer(map) {
  const layers = [
    {
      name: 'Carte standard',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution: 'Cartographie'
      }
    },
    {
      name: 'Carte France',
      url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
      options: {
        maxZoom: 20,
        subdomains: ['a', 'b', 'c'],
        attribution: 'Cartographie · rendu Carte France'
      }
    },
    {
      name: 'Carte secours',
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      options: {
        maxZoom: 19,
        attribution: 'Cartographie'
      }
    }
  ];

  let index = 0;
  let current = null;
  let errorCount = 0;

  function installLayer(nextIndex) {
    index = Math.min(nextIndex, layers.length - 1);
    const def = layers[index];
    errorCount = 0;
    if (current) {
      current.off('tileerror');
      try { map.removeLayer(current); } catch {}
    }
    current = L.tileLayer(def.url, {
      ...def.options,
      crossOrigin: false,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 3
    });
    current.on('tileerror', () => {
      errorCount += 1;
      if (errorCount >= 4 && index < layers.length - 1) installLayer(index + 1);
    });
    current.addTo(map);
    app.map.tileLayerName = def.name;
  }

  installLayer(0);
}


function fitFranceMap() {
  if (!app.map.leaflet) return;
  app.map.leaflet.fitBounds([[41.2, -5.3], [51.2, 9.7]], { padding: [20, 20] });
}

function updateIsoClass() {
  const section = $('.map-section');
  if (!section || !app.map.leaflet) return;
  const iso = app.map.leaflet.getZoom() >= 9;
  section.classList.toggle('osm-isometric', iso);
}

function enableStationPlacement() {
  app.map.stationPlacement = true;
  app.map.creatingCustomStation = false;
  $('#addStopBtn')?.classList.add('hidden');
  $('#cancelStopBtn')?.classList.remove('hidden');
  $('#mapHint').textContent = 'Mode création : Clique n’importe où sur la carte pour créer un nouvel arrêt jouable.';
  const container = app.map.leaflet?.getContainer();
  container?.classList.add('placing-stop');
  app.map.leaflet?.dragging?.disable?.();
}

function disableStationPlacement() {
  app.map.stationPlacement = false;
  app.map.creatingCustomStation = false;
  $('#addStopBtn')?.classList.remove('hidden');
  $('#cancelStopBtn')?.classList.add('hidden');
  $('#mapHint').textContent = 'Clique une gare, ou active “Créer arrêt” puis clique n’importe où en France.';
  const container = app.map.leaflet?.getContainer();
  container?.classList.remove('placing-stop');
  app.map.leaflet?.dragging?.enable?.();
}

function validCustomStationLatLng(lat, lng) {
  // Zone volontairement légèrement plus large que la France métropolitaine :
  // elle couvre aussi la Corse et évite les faux refus près des frontières/côtes.
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 40.6 && lat <= 51.8 && lng >= -5.9 && lng <= 10.4;
}


function customStationCreationQuote(lat, lon) {
  const demand = estimateDemandFromLocationClient(lat, lon);
  const freight = estimateFreightFromLocationClient(lat, lon);
  const tourism = estimateTourismFromLocationClient(lat, lon);
  const market = Number(app.state?.game?.market?.steel || 1);
  const nearby = dedupedStations(app.state?.world?.stations || [])
    .filter(s => !s.custom && Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lon)))
    .map(s => ({ station: s, distance: haversineClient(lat, lon, Number(s.lat), Number(s.lon)) }))
    .filter(entry => Number.isFinite(entry.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);

  const localValue = 52000 + demand * 720 + freight * 420 + tourism * 260;
  let weightedNeighbourValue = localValue;
  const closest = nearby[0] || null;
  const closestDistance = closest?.distance ?? 80;

  if (nearby.length) {
    let totalWeight = 0;
    let totalValue = 0;
    for (const entry of nearby) {
      const d = Math.max(0.5, entry.distance);
      const weight = 1 / Math.pow(d + 8, 1.35);
      totalWeight += weight;
      totalValue += stationAcquisitionCost(entry.station) * weight;
    }
    if (totalWeight > 0) weightedNeighbourValue = totalValue / totalWeight;
  }

  const proximityFactor = closestDistance < 4 ? 1.22 : closestDistance < 12 ? 1.10 : closestDistance > 55 ? 0.82 : 1;
  const blended = (localValue * 0.58 + weightedNeighbourValue * 0.42) * proximityFactor * market;
  const cost = Math.round(clamp(blended, 90000, 6500000));
  return {
    cost,
    demand,
    freight,
    tourism,
    closestName: closest?.station?.name || '',
    closestDistance: closest ? Math.round(closest.distance * 10) / 10 : null
  };
}

function estimateDemandFromLocationClient(lat, lon) {
  let best = 90;
  for (const s of dedupedStations(app.state?.world?.stations || [])) {
    if (!Number.isFinite(Number(s.lat)) || !Number.isFinite(Number(s.lon))) continue;
    const d = haversineClient(lat, lon, Number(s.lat), Number(s.lon));
    const influence = Number(s.baseDemand || 80) * Math.exp(-d / 55);
    best = Math.max(best, influence);
  }
  return Math.round(clamp(best, 60, 500));
}

function estimateFreightFromLocationClient(lat, lon) {
  let best = 25;
  for (const s of dedupedStations(app.state?.world?.stations || [])) {
    if (!Number.isFinite(Number(s.lat)) || !Number.isFinite(Number(s.lon))) continue;
    const d = haversineClient(lat, lon, Number(s.lat), Number(s.lon));
    best = Math.max(best, Number(s.freight || 20) * Math.exp(-d / 70));
  }
  return Math.round(clamp(best, 10, 150));
}

function estimateTourismFromLocationClient(lat, lon) {
  let best = 30;
  for (const s of dedupedStations(app.state?.world?.stations || [])) {
    if (!Number.isFinite(Number(s.lat)) || !Number.isFinite(Number(s.lon))) continue;
    const d = haversineClient(lat, lon, Number(s.lat), Number(s.lon));
    best = Math.max(best, Number(s.tourism || 20) * Math.exp(-d / 85));
  }
  return Math.round(clamp(best, 10, 120));
}

async function createCustomStationFromLatLng(latlng) {
  if (!app.map.stationPlacement || app.map.creatingCustomStation) return false;
  const lat = Number(latlng?.lat);
  const lng = Number(latlng?.lng);
  if (!validCustomStationLatLng(lat, lng)) {
    toast('Choisis un emplacement sur la zone de jeu France / Corse.', 'error');
    return true;
  }

  const defaultName = `Arrêt ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  const name = window.prompt('Nom du nouvel arrêt / gare :', defaultName);
  if (!name) return true;

  const quote = customStationCreationQuote(lat, lng);
  const nearest = quote.closestName ? `\nGare de référence la plus proche : ${quote.closestName} (${quote.closestDistance} km).` : '';
  const message = `Créer la gare « ${name} » ?\n\nPrix proposé : ${money(quote.cost)}\nDemande estimée : ${formatInt(quote.demand)} voyageurs, ${formatInt(quote.freight)} fret, ${formatInt(quote.tourism)} tourisme.${nearest}\n\nCe montant sera débité immédiatement.`;
  if (!(await gameConfirm('Créer un arrêt', message, { confirmLabel: 'Créer l’arrêt' }))) return true;
  if (Number(app.state?.me?.cash || 0) < quote.cost) {
    toast(`Trésorerie insuffisante. Coût estimé : ${money(quote.cost)}.`, 'error');
    return true;
  }

  app.map.creatingCustomStation = true;
  try {
    await doAction('createCustomStation', { name, lat, lon: lng, quotedCost: quote.cost });
  } finally {
    disableStationPlacement();
  }
  return true;
}

function onOsmMouseMove(event) {
  if (app.map.navigating) return;
  const p = { x: event.containerPoint.x, y: event.containerPoint.y };
  const hit = app.map.stationPlacement ? null : hitStationAt(p);
  app.hoverStation = hit?.id || null;
  const container = app.map.leaflet.getContainer();
  container.style.cursor = app.map.stationPlacement ? 'crosshair' : hit ? 'pointer' : '';
}

async function onOsmClick(event) {
  if (app.map.stationPlacement) {
    await createCustomStationFromLatLng(event.latlng);
    return;
  }

  const p = { x: event.containerPoint.x, y: event.containerPoint.y };
  const hit = hitStationAt(p) || nearestStationAt(p, 28) || nearestProjectedStationAt(p, 32);
  if (hit) {
    setSelectedStation(hit.id);
    const selected = station(hit.id);
    app.stationSearch.query = stationSearchLabel(selected);
    app.stationSearch.candidateId = hit.id;
    app.activeTab = 'stations';
    localStorage.setItem('sillons.activeTab', app.activeTab);
    renderAll();
  }
}


function setAuthMode(mode) {
  app.authMode = mode === 'register' ? 'register' : 'login';
  $('#authLoginTab')?.classList.toggle('active', app.authMode === 'login');
  $('#authRegisterTab')?.classList.toggle('active', app.authMode === 'register');
  $('#registerFields')?.classList.toggle('hidden', app.authMode !== 'register');
  const submit = $('#authSubmitBtn');
  if (submit) submit.textContent = app.authMode === 'register' ? 'Créer le compte' : 'Se connecter';
  const password = $('#authPassword');
  if (password) password.autocomplete = app.authMode === 'register' ? 'new-password' : 'current-password';
  const hint = $('#authModeHint');
  if (hint) hint.textContent = app.authMode === 'register'
    ? 'Crée un compte joueur : Une compagnie neuve sera liée à cet identifiant.'
    : 'Entre ton identifiant et ton mot de passe pour reprendre ta compagnie.';
}

function authHeaders() {
  return app.authToken ? { Authorization: `Bearer ${app.authToken}` } : {};
}

function clearAuthState() {
  app.authToken = '';
  app.playerId = '';
  localStorage.removeItem('sillons.authToken');
  localStorage.removeItem('sillons.playerId');
}

function applyAuthResponse(response) {
  if (!response?.ok || !response.auth?.token) return false;
  app.authToken = response.auth.token;
  app.playerId = response.auth.playerId || response.playerId || '';
  localStorage.setItem('sillons.authToken', app.authToken);
  localStorage.setItem('sillons.playerId', app.playerId);
  app.state = response.state || app.state;
  $('#setup')?.classList.add('hidden');
  renderAll(true);
  return true;
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const username = $('#authUsername')?.value || '';
  const password = $('#authPassword')?.value || '';
  const payload = { username, password };
  if (app.authMode === 'register') {
    payload.companyName = $('#companyName')?.value || '';
    payload.color = $('#companyColor')?.value || '#60a5fa';
    payload.logo = currentSetupLogoId();
  }
  const url = app.authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
  try {
    const response = await post(url, payload, { auth: false });
    if (!response.ok) return toast(response.error || 'Connexion impossible.', 'error');
    applyAuthResponse(response);
    toast(app.authMode === 'register' ? 'Compte créé et connecté.' : 'Connexion réussie.', 'ok');
  } catch (error) {
    toast(error.message || 'Connexion impossible.', 'error');
  }
}

async function logoutAccount() {
  if (app.authToken) await post('/api/auth/logout', {}, { auth: true }).catch(() => null);
  clearAuthState();
  app.state = null;
  $('#setup')?.classList.remove('hidden');
  setAuthMode('login');
  await refreshState(true);
  toast('Déconnecté.', 'ok');
}

function currentSetupLogoId() {
  const hidden = $('#companyLogo');
  const current = String(hidden?.value || '').trim();
  return COMPANY_LOGOS.some(logo => logo.id === current) ? current : COMPANY_LOGOS[0].id;
}

function selectSetupLogo(logoId) {
  const safe = COMPANY_LOGOS.some(logo => logo.id === logoId) ? logoId : COMPANY_LOGOS[0].id;
  const hidden = $('#companyLogo');
  if (hidden) hidden.value = safe;
  $$('.logo-choice').forEach(card => card.classList.toggle('selected', card.dataset.logoId === safe));
  const preview = $('#setupLogoPreview');
  const item = COMPANY_LOGOS.find(logo => logo.id === safe) || COMPANY_LOGOS[0];
  if (preview) {
    preview.src = item.src;
    preview.alt = item.label;
  }
  const label = $('#setupLogoLabel');
  if (label) label.textContent = item.label;
}

function renderSetupLogoPicker() {
  const picker = $('#logoPicker');
  if (!picker) return;
  picker.innerHTML = COMPANY_LOGOS.map(logo => `
    <button class="logo-choice" type="button" data-logo-id="${logo.id}" title="${escapeAttr(logo.label)}">
      <img src="${logo.src}" alt="${escapeAttr(logo.label)}">
      <span>${escapeHtml(logo.label)}</span>
    </button>
  `).join('');
  selectSetupLogo(currentSetupLogoId());
}


function maybeNotify(me) {
  const first = me.notifications?.[0];
  if (!first) return;
  const key = `${first.day}:${first.text}`;
  if (app.lastNotificationKey && app.lastNotificationKey !== key) toast(first.text, 'ok');
  app.lastNotificationKey = key;
}


function currentCompositionScrollKey() {
  if (app.activeTab !== 'fleet' || app.activeFleetSubtab !== 'composition') return null;
  return app.selectedCompositionTrainId || 'default';
}

function captureCompositionScrollPosition() {
  const key = currentCompositionScrollKey();
  if (!key) return;
  const editor = document.querySelector('.composition-editor-card');
  if (!editor) return;
  const strip = editor.querySelector('.composition-strip.large');
  app.compositionScrollState[key] = {
    top: editor.scrollTop || 0,
    stripLeft: strip?.scrollLeft || 0
  };
  localStorage.setItem('sillons.compositionScrollState', JSON.stringify(app.compositionScrollState));
}

function restoreCompositionScrollPosition(key = currentCompositionScrollKey()) {
  if (!key) return;
  const saved = app.compositionScrollState?.[key];
  if (!saved) return;
  const editor = document.querySelector('.composition-editor-card');
  if (!editor) return;
  const restore = () => {
    editor.scrollTop = Number(saved.top || 0);
    const strip = editor.querySelector('.composition-strip.large');
    if (strip) strip.scrollLeft = Number(saved.stripLeft || 0);
  };
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
}


function currentTutorialState() {
  return app.state?.me?.tutorial || null;
}

function currentTutorialStep() {
  const tutorial = currentTutorialState();
  if (!tutorial || tutorial.completed || tutorial.enabled === false) return null;
  return TUTORIAL_STEPS[TUTORIAL_STEP_INDEX[tutorial.stepId] ?? 0] || TUTORIAL_STEPS[0];
}

function nextTutorialStepId(stepId) {
  const index = TUTORIAL_STEP_INDEX[stepId] ?? 0;
  return TUTORIAL_STEPS[Math.min(TUTORIAL_STEPS.length - 1, index + 1)]?.id || 'done';
}

function tutorialConditionMet(step) {
  const me = app.state?.me;
  if (!step || !me) return false;
  const wait = step.wait || '';
  if (!wait) return false;
  if (wait.startsWith('activeTab:')) return app.activeTab === wait.split(':')[1];
  if (wait.startsWith('fleetSubtab:')) return app.activeTab === 'fleet' && app.activeFleetSubtab === wait.split(':')[1];
  if (wait.startsWith('linesSubtab:')) return app.activeTab === 'lines' && app.activeLinesSubtab === wait.split(':')[1];
  if (wait === 'hasTrain') return (me.trains || []).length > 0;
  if (wait === 'hasLine') return (me.lines || []).some(line => line.active);
  if (wait === 'compositionTrainSelected') return Boolean(app.selectedCompositionTrainId || (me.trains || [])[0]?.id);
  if (wait === 'compositionSaved') return Boolean(me.tutorial?.actionLog?.compositionSaved);
  return false;
}

function prepareTutorialStepView(step) {
  if (!step) return false;
  let changed = false;
  if (step.tab && app.activeTab !== step.tab) {
    app.activeTab = step.tab;
    localStorage.setItem('sillons.activeTab', app.activeTab);
    changed = true;
  }
  if (step.subtab === 'composition' && app.activeFleetSubtab !== 'composition') {
    app.activeFleetSubtab = 'composition';
    localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
    changed = true;
  }
  if (step.subtab === 'catalog' && app.activeFleetSubtab !== 'catalog') {
    app.activeFleetSubtab = 'catalog';
    localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
    changed = true;
  }
  if (step.subtab === 'maintenance' && app.activeFleetSubtab !== 'maintenance') {
    app.activeFleetSubtab = 'maintenance';
    localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
    changed = true;
  }
  if (step.subtab === 'create' && app.activeLinesSubtab !== 'create') {
    app.activeLinesSubtab = 'create';
    localStorage.setItem('sillons.linesSubtab', app.activeLinesSubtab);
    changed = true;
  }
  if (step.subtab === 'manage' && app.activeLinesSubtab !== 'manage') {
    app.activeLinesSubtab = 'manage';
    localStorage.setItem('sillons.linesSubtab', app.activeLinesSubtab);
    changed = true;
  }
  if (step.id === 'select-composition-train' && !app.selectedCompositionTrainId) {
    const first = app.state?.me?.trains?.[0]?.id;
    if (first) {
      app.selectedCompositionTrainId = first;
      localStorage.setItem('sillons.selectedCompositionTrainId', first);
      changed = true;
    }
  }
  return changed;
}

async function syncTutorial(payload) {
  if (app.tutorial.syncing) return;
  app.tutorial.syncing = true;
  try {
    await performAction('tutorial', payload);
  } finally {
    app.tutorial.syncing = false;
  }
}

function advanceTutorial(step = currentTutorialStep()) {
  if (!step) return;
  if (step.id === 'done') return syncTutorial({ op: 'complete' });
  syncTutorial({ op: 'advance', stepId: nextTutorialStepId(step.id) });
}

function skipTutorial() {
  syncTutorial({ op: 'complete' });
}

function renderTutorialOverlay() {
  clearTimeout(app.tutorial.timer);
  const existing = $('#tutorialOverlay');
  const step = currentTutorialStep();
  if (!step) {
    existing?.remove();
    $('#tutorialTargetHalo')?.remove();
    clearTimeout(app.tutorial.positionTimer);
    app.tutorial.lastScrollKey = '';
    return;
  }
  if (prepareTutorialStepView(step)) {
    setTimeout(renderAll, 0);
    return;
  }
  const freshStep = currentTutorialStep();
  if (freshStep && tutorialConditionMet(freshStep)) {
    app.tutorial.timer = setTimeout(() => advanceTutorial(freshStep), 220);
    return;
  }

  let overlay = existing;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tutorialOverlay';
    overlay.className = 'tutorial-overlay';
    document.body.appendChild(overlay);
  }
  const index = (TUTORIAL_STEP_INDEX[freshStep.id] ?? 0) + 1;
  const total = TUTORIAL_STEPS.length;
  overlay.innerHTML = `
    <div class="tutorial-card">
      <div class="tutorial-kicker">Tutoriel guidé · ${index}/${total}</div>
      <h3>${escapeHtml(freshStep.title)}</h3>
      <p>${escapeHtml(freshStep.body)}</p>
      <div class="tutorial-actions">
        ${freshStep.wait ? '<span class="tutorial-wait">Action attendue</span>' : `<button type="button" class="primary" data-tutorial-next>${escapeHtml(freshStep.action || 'Continuer')}</button>`}
        <button type="button" class="ghost" data-tutorial-skip>Terminer</button>
      </div>
    </div>
  `;
  overlay.querySelector('[data-tutorial-next]')?.addEventListener('click', () => advanceTutorial(freshStep));
  overlay.querySelector('[data-tutorial-skip]')?.addEventListener('click', skipTutorial);
  scheduleTutorialOverlayPosition(0, { scroll: true });
}

function tutorialTargetForStep(step = currentTutorialStep()) {
  if (!step?.target) return null;
  try {
    return document.querySelector(step.target) || document.querySelector('#tabContent') || document.querySelector('.side.panel');
  } catch {
    return document.querySelector('#tabContent') || document.querySelector('.side.panel');
  }
}

function tutorialViewportMetrics() {
  const vv = window.visualViewport;
  return {
    width: vv?.width || window.innerWidth,
    height: vv?.height || window.innerHeight,
    offsetLeft: vv?.offsetLeft || 0,
    offsetTop: vv?.offsetTop || 0
  };
}

function isCompactTutorialViewport() {
  const view = tutorialViewportMetrics();
  return view.width <= 760 || view.height <= 560;
}

function scheduleTutorialOverlayPosition(delay = 0, options = {}) {
  clearTimeout(app.tutorial.positionTimer);
  app.tutorial.positionTimer = setTimeout(() => {
    if (app.tutorial.positionFrame) cancelAnimationFrame(app.tutorial.positionFrame);
    app.tutorial.positionFrame = requestAnimationFrame(() => updateTutorialOverlayPosition(options));
  }, delay);
}

function updateTutorialOverlayPosition(options = {}) {
  const overlay = $('#tutorialOverlay');
  const step = currentTutorialStep();
  if (!overlay || !step) return;
  const target = tutorialTargetForStep(step);
  const card = overlay.querySelector('.tutorial-card');
  if (!target || !card) return;
  const scrollKey = `${step.id}:${step.target || ''}`;
  if (options.scroll !== false && app.tutorial.lastScrollKey !== scrollKey) {
    app.tutorial.lastScrollKey = scrollKey;
    target.scrollIntoView?.({
      behavior: isCompactTutorialViewport() ? 'auto' : 'smooth',
      block: isCompactTutorialViewport() ? 'center' : 'center',
      inline: 'center'
    });
    scheduleTutorialOverlayPosition(isCompactTutorialViewport() ? 80 : 260, { scroll: false });
    return;
  }
  positionTutorialElements(target, card, step);
}

function positionTutorialElements(target, card, step) {
  const view = tutorialViewportMetrics();
  const rect = target?.getBoundingClientRect?.();
  if (!rect) return;
  const halo = document.getElementById('tutorialTargetHalo') || (() => {
    const el = document.createElement('div');
    el.id = 'tutorialTargetHalo';
    el.className = 'tutorial-target-halo';
    document.body.appendChild(el);
    return el;
  })();
  const margin = isCompactTutorialViewport() ? 8 : 10;
  const pad = isCompactTutorialViewport() ? 5 : 6;
  const left = Math.max(view.offsetLeft + margin, rect.left - pad);
  const top = Math.max(view.offsetTop + margin, rect.top - pad);
  const maxRight = view.offsetLeft + view.width - margin;
  const maxBottom = view.offsetTop + view.height - margin;
  const width = Math.max(24, Math.min(rect.width + pad * 2, maxRight - left));
  const height = Math.max(24, Math.min(rect.height + pad * 2, maxBottom - top));
  halo.style.left = `${Math.round(left)}px`;
  halo.style.top = `${Math.round(top)}px`;
  halo.style.width = `${Math.round(width)}px`;
  halo.style.height = `${Math.round(height)}px`;
  if (isCompactTutorialViewport()) {
    card.dataset.arrow = 'none';
    card.style.left = '';
    card.style.top = '';
    return;
  }
  const cardRect = card.getBoundingClientRect();
  let cardLeft = rect.right + 18;
  let cardTop = rect.top + rect.height / 2 - cardRect.height / 2;
  if (cardLeft + cardRect.width > view.offsetLeft + view.width - margin) cardLeft = rect.left - cardRect.width - 18;
  if (cardLeft < view.offsetLeft + margin) cardLeft = Math.min(view.offsetLeft + view.width - cardRect.width - margin, view.offsetLeft + margin);
  cardTop = Math.max(view.offsetTop + margin, Math.min(view.offsetTop + view.height - cardRect.height - margin, cardTop));
  card.style.left = `${Math.round(cardLeft)}px`;
  card.style.top = `${Math.round(cardTop)}px`;
  card.dataset.arrow = cardLeft > rect.left ? 'left' : 'right';
}

function renderAll() {
  if (!app.state) return;
  const compositionScrollKey = currentCompositionScrollKey();
  captureCompositionScrollPosition();
  renderTopbar();
  renderTabs();
  renderTutorialOverlay();
  applyLayoutMode();
  if (compositionScrollKey) restoreCompositionScrollPosition(compositionScrollKey);
  app.lastRenderKey = stateRenderSignature();
}

function renderTopbar() {
  const me = app.state.me;
  $('#companySubtitle').textContent = me ? `${me.name} · ${me.eraName}` : 'Non connecté';
  const logo = $('#companyLogoBadge');
  const fallback = $('#companyLogoFallback');
  if (logo) {
    const selected = COMPANY_LOGOS.find(item => item.id === me?.logo) || COMPANY_LOGOS[0];
    logo.src = selected.src;
    logo.alt = selected.label;
    logo.classList.toggle('hidden', !me);
  }
  if (fallback) fallback.classList.toggle('hidden', !!me);
  const logoutBtn = $('#logoutBtn');
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !app.authToken);
  const tutorialBtn = $('#tutorialBtn');
  if (tutorialBtn) tutorialBtn.classList.toggle('hidden', !me);
  const mapToggleBtn = $('#mapToggleBtn');
  if (mapToggleBtn) mapToggleBtn.remove();
  const topStats = $('#topStats');
  if (!me) {
    topStats.innerHTML = `<span class="stat-pill">Serveur <b>connecté</b></span>`;
    return;
  }
  topStats.innerHTML = [
    pill('Cash', money(me.cash), me.cash >= 0 ? 'good-text' : 'bad-text'),
    pill('Résultat/h', moneyPerHour(me.stats.lastProfit), me.stats.lastProfit >= 0 ? 'good-text' : 'bad-text', topResultTooltip(me)),
    pill('Charbon', resourceStockLabel('coal'), '', resourceTopTooltip('coal')),
    pill('Diesel', resourceStockLabel('diesel'), '', resourceTopTooltip('diesel')),
    pill('Électricité', resourceStockLabel('electricity'), '', resourceTopTooltip('electricity')),
    pill('Réputation', `${Math.round(me.reputation)}/100`),
    pill('Ponctualité', `${Math.round(me.stats.punctuality)}%`)
  ].join('');
}


function isMapVisible() {
  return true;
}

function toggleMapVisibility() {
  // Carte permanente : la navigation reste accessible sans masquer la carte.
  app.mapPref = 'show';
  localStorage.setItem('sillons.mapPref', app.mapPref);
  applyLayoutMode();
}

function applyLayoutMode() {
  const layout = $('.layout');
  if (!layout) return;
  layout.classList.remove('map-hidden');
  layout.classList.add('map-visible');
  $('.map-section')?.classList.remove('hidden-by-layout');
  requestAnimationFrame(() => resizeCanvas());
}



function currentIsoFactor() {
  return app.map.view.zoom <= 1.15 ? 0 : Math.min(1, (app.map.view.zoom - 1.15) / 0.95);
}

function getViewMatrix() {
  const z = app.map.view.zoom;
  const iso = currentIsoFactor();
  const a = z;
  const b = -0.08 * z * iso;
  const c = 0.28 * z * iso;
  const d = z * (1 - 0.2 * iso);
  return { a, b, c, d };
}

function applyViewTransform(ctx) {
  const cx = app.map.width / 2 + app.map.view.panX;
  const cy = app.map.height / 2 + app.map.view.panY;
  const { a, b, c, d } = getViewMatrix();
  ctx.translate(cx, cy);
  ctx.transform(a, b, c, d, 0, 0);
  ctx.translate(-app.map.width / 2, -app.map.height / 2);
}

function toViewPoint(p) {
  const { a, b, c, d } = getViewMatrix();
  const ox = p.x - app.map.width / 2;
  const oy = p.y - app.map.height / 2;
  return {
    x: app.map.width / 2 + app.map.view.panX + a * ox + c * oy,
    y: app.map.height / 2 + app.map.view.panY + b * ox + d * oy
  };
}

function fromViewPoint(p) {
  const { a, b, c, d } = getViewMatrix();
  const det = a * d - b * c || 1;
  const vx = p.x - (app.map.width / 2 + app.map.view.panX);
  const vy = p.y - (app.map.height / 2 + app.map.view.panY);
  const ox = (d * vx - c * vy) / det;
  const oy = (-b * vx + a * vy) / det;
  return { x: app.map.width / 2 + ox, y: app.map.height / 2 + oy };
}

function setMapZoom(nextZoom, focusPoint = null) {
  const previous = app.map.view.zoom;
  const zoom = Math.max(1, Math.min(3.2, nextZoom));
  if (Math.abs(zoom - previous) < 0.001) return;
  if (focusPoint) {
    const rawBefore = fromViewPoint(focusPoint);
    app.map.view.zoom = zoom;
    const screenAfter = toViewPoint(rawBefore);
    app.map.view.panX += focusPoint.x - screenAfter.x;
    app.map.view.panY += focusPoint.y - screenAfter.y;
  } else {
    app.map.view.zoom = zoom;
  }
}

function resetMapView() {
  app.map.view.zoom = 1;
  app.map.view.panX = 0;
  app.map.view.panY = 0;
}

function artPoint(nx, ny) {
  const frame = app.map.frame?.image;
  if (!frame) return { x: 0, y: 0 };
  return { x: frame.x + frame.width * nx, y: frame.y + frame.height * ny };
}

function edgeKey(a, b) {
  return [a, b].sort().join('|');
}

function pill(label, value, cls = '', tip = '') {
  const isCash = label === 'Cash';
  return `<span class="stat-pill ${isCash ? 'cash-pill' : ''}" ${isCash ? 'id="cashPill"' : ''} ${tooltipAttr(tip)}>${escapeHtml(label)} <b class="${cls}">${escapeHtml(value)}</b>${isCash ? '<span class="cash-fx-layer" id="cashFxLayer" aria-hidden="true"></span>' : ''}</span>`;
}

function formatSignedMoney(value) {
  const n = Math.round(Number(value || 0));
  return `${n > 0 ? '+' : ''}${formatInt(n)} €`;
}

function animateCashDelta(delta) {
  const amount = Math.round(Number(delta || 0));
  if (!amount) return;
  const host = $('#cashFxLayer') || $('#cashPill');
  if (!host) return;

  const bubble = document.createElement('span');
  bubble.className = `cash-fx ${amount > 0 ? 'gain' : 'loss'}`;
  bubble.textContent = formatSignedMoney(amount);
  host.appendChild(bubble);

  requestAnimationFrame(() => bubble.classList.add('show'));

  setTimeout(() => {
    bubble.classList.remove('show');
    bubble.classList.add('hide');
    setTimeout(() => bubble.remove(), 420);
  }, 1050);
}


function animateCashDeltaFromStates(previousState, nextState) {
  const previousCash = Number(previousState?.me?.cash);
  const nextCash = Number(nextState?.me?.cash);
  if (Number.isFinite(previousCash) && Number.isFinite(nextCash) && previousCash !== nextCash) {
    animateCashDelta(nextCash - previousCash);
  }
}

function syncAdminTabVisibility() {
  const button = $('#adminTabBtn');
  if (!button) return;
  const isAdmin = Boolean(app.state?.auth?.isAdmin);
  button.classList.toggle('hidden', !isAdmin);
  if (!isAdmin && app.activeTab === 'admin') app.activeTab = 'overview';
}

function isAdminSession() {
  return Boolean(app.state?.auth?.isAdmin && app.state?.admin);
}

function renderTabs() {
  if (!app.state) return;
  syncAdminTabVisibility();
  if (app.activeTab === 'admin' && !app.state.auth?.isAdmin) {
    app.activeTab = 'overview';
    localStorage.setItem('sillons.activeTab', app.activeTab);
  }
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === app.activeTab));
  const content = $('#tabContent');
  const side = $('.side.panel');
  const menuImage = ART.tabs[app.activeTab] || ART.tabs.overview;
  if (side) {
    side.dataset.menu = app.activeTab;
    side.style.setProperty('--menu-bg', `url("${menuImage}")`);
  }
  content.dataset.tab = app.activeTab;
  if (!app.state.me) {
    if (side) side.style.setProperty('--menu-bg', `url("${ART.tabs.overview}")`);
    content.innerHTML = `<div class="card"><h2>Créer une compagnie</h2><p class="muted">La partie commence après création de la compagnie.</p></div>`;
    return;
  }
  const renderers = {
    overview: renderOverview,
    lines: renderLines,
    fleet: renderFleet,
    stations: renderStations,
    staff: renderStaff,
    research: renderResearch,
    resources: renderResources,
    market: renderMarket,
    budget: renderBudget,
    admin: renderAdmin
  };
  content.innerHTML = renderers[app.activeTab]?.() || renderOverview();
  if (app.activeTab === 'lines') { refreshLineSearchWidgets(); updateLinePreview(); }
  if (app.activeTab === 'stations') refreshStationSearchWidgets();
  setTimeout(renderTutorialOverlay, 0);
}

function renderAdmin() {
  if (!isAdminSession()) {
    return `<div class="card"><h2>Admin</h2><p class="muted">Accès réservé au compte Xenao.</p></div>`;
  }
  const players = app.state.admin.players || [];
  if (!players.length) return `<div class="card"><h2>Admin</h2><p class="muted">Aucun joueur à administrer.</p></div>`;
  let selected = players.find(p => p.id === app.admin.selectedPlayerId) || players[0];
  app.admin.selectedPlayerId = selected.id;
  localStorage.setItem('sillons.adminSelectedPlayer', selected.id);
  const logRows = (selected.loginHistory || []).map(entry => `
    <tr>
      <td>${escapeHtml(formatDateTime(entry.at))}</td>
      <td>${escapeHtml(entry.ip || '—')}</td>
      <td>${escapeHtml(entry.userAgent || '—')}</td>
    </tr>
  `).join('');
  const rawJson = escapeHtml(JSON.stringify(selected.rawPlayer || {}, null, 2));
  return `
    ${renderSectionHero('ADMINISTRATION', 'Console Xenao', 'Pilote les comptes joueurs, corrige leur progression et consulte les connexions horodatées enregistrées côté serveur.', ART.tabs.budget, ['Accès privé', `${players.length} joueurs`, `${selected.loginCount || 0} connexions`])}
    <div class="admin-grid">
      <section class="card admin-list-card">
        <h2>Comptes joueurs</h2>
        <div class="admin-player-list">
          ${players.map(player => `
            <button type="button" class="admin-player-row ${player.id === selected.id ? 'active' : ''}" data-action="admin-select-player" data-id="${escapeAttr(player.id)}">
              <span><strong>${escapeHtml(player.name)}</strong><em>${escapeHtml(player.username || 'Sans compte lié')}</em></span>
              <b>${money(player.cash)}</b>
            </button>
          `).join('')}
        </div>
      </section>
      <section class="card admin-detail-card">
        <div class="admin-detail-head">
          <div>
            <h2>${escapeHtml(selected.name)}</h2>
            <p class="muted small">Identifiant : ${escapeHtml(selected.username || 'aucun')} · ID joueur : <code>${escapeHtml(selected.id)}</code></p>
          </div>
          <span class="tag ${selected.isAdmin ? 'good' : ''}">${selected.isAdmin ? 'Admin' : 'Joueur'}</span>
        </div>
        <div class="card-grid">
          ${metric('Trésorerie', money(selected.cash))}
          ${metric('Dette', money(selected.debt))}
          ${metric('Lignes actives', `${selected.activeLines}/${selected.lines}`)}
          ${metric('Connexions', selected.loginCount || 0)}
        </div>
        <div class="admin-action-panel">
          <label>Nom de compagnie
            <input id="adminCompanyName" maxlength="28" value="${escapeAttr(selected.name)}">
          </label>
          <label>Trésorerie exacte
            <input id="adminCash" type="number" step="1000" value="${Number(selected.cash || 0)}">
          </label>
          <label>Ajouter / retirer
            <input id="adminCashDelta" type="number" step="1000" placeholder="ex : 1000000 ou -500000">
          </label>
          <div class="actions">
            <button class="primary" data-action="admin-save-quick" data-id="${escapeAttr(selected.id)}">Enregistrer nom + trésorerie</button>
            <button data-action="admin-add-cash" data-id="${escapeAttr(selected.id)}">Appliquer variation</button>
          </div>
        </div>
      </section>
    </div>
    <section class="card">
      <h2>Connexions horodatées</h2>
      <p class="muted small">Le journal est alimenté à chaque connexion réussie. Les anciennes sauvegardes récupèrent au moins la dernière connexion connue.</p>
      <div class="admin-log-wrap">
        <table class="admin-log-table">
          <thead><tr><th>Date</th><th>IP</th><th>Navigateur</th></tr></thead>
          <tbody>${logRows || '<tr><td colspan="3">Aucune connexion enregistrée.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
    <section class="card">
      <h2>Édition avancée du joueur</h2>
      <p class="muted small">Zone volontairement puissante : modifie le JSON puis enregistre. Le serveur remigre la compagnie pour éviter les champs essentiels cassés.</p>
      <textarea id="adminRawPlayerJson" class="admin-json-editor" spellcheck="false">${rawJson}</textarea>
      <div class="actions">
        <button class="primary" data-action="admin-save-json" data-id="${escapeAttr(selected.id)}">Enregistrer le JSON joueur</button>
      </div>
    </section>
  `;
}

async function adminUpdatePlayer(payload) {
  const data = await post('/api/admin/player', payload);
  if (!data.ok) {
    toast(data.error || 'Modification admin refusée.', 'error');
    return data;
  }
  app.state = data.state || app.state;
  toast(data.message || 'Modification admin enregistrée.', 'ok');
  renderAll(true);
  return data;
}

function formatDateTime(value) {
  const date = new Date(Number(value || 0));
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
}

function renderOverview() {
  const me = app.state.me;
  const activeLines = me.lines.filter(l => l.active).length;
  const ranking = [...app.state.players].sort((a, b) => b.score - a.score);
  const myRank = ranking.findIndex(p => p.id === me.id) + 1;
  return `
    ${renderSectionHero('POSTE DE COMMANDE', me.name, 'Pilote ton entreprise ferroviaire depuis un tableau de bord entièrement intégré à la direction artistique pixel-art du projet.', ART.tabs.overview, [me.eraName, `${activeLines} lignes actives`, `${me.trains.length} trains`])}

    <div class="card">
      <h2>${escapeHtml(me.name)}</h2>
      <div class="card-grid">
        ${metric('Score', formatInt(me.score))}
        ${metric('Classement', `${myRank}/${ranking.length}`)}
        ${metric('Voyageurs transportés', formatInt(me.stats.passengers))}
        ${metric('Fret transporté', `${formatInt(me.stats.freightTons)} t`)}
        ${metric('Dette', money(me.debt), me.debt > 0 ? 'warn-text' : '')}
        ${metric('CO₂ cumulé', `${formatInt(me.co2)} t`, me.co2 > 5000 ? 'warn-text' : '')}
      </div>
    </div>

    <div class="card">
      <h3>Réseau</h3>
      <div class="card-grid">
        ${metric('Lignes actives', activeLines)}
        ${metric('Trains', me.trains.length)}
        ${metric('Gares exploitées', Object.keys(me.stations).length)}
        ${metric('Capacité R&D', `${round(researchWorkRateClient(me))}x`)}
      </div>
    </div>

    ${renderFinanceSummary(me)}

    <div class="card">
      <h3>Événements en cours</h3>
      <div class="list">
        ${app.state.game.events.map(e => `
          <div class="list-item">
            <div class="item-title"><strong>${escapeHtml(e.title)}</strong><span class="tag">Temporaire</span></div>
            <div class="kv"><span>Voyageurs</span><b>×${round(e.passenger || 1)}</b><span>Fret</span><b>×${round(e.freight || 1)}</b></div>
          </div>
        `).join('') || '<p class="muted">Aucun événement.</p>'}
      </div>
    </div>

    <div class="card">
      <h3>Classement multijoueur</h3>
      <div class="list">
        ${ranking.slice(0, 8).map((p, i) => `
          <div class="list-item">
            <div class="item-title">
              <strong><span style="color:${p.color}">●</span> #${i + 1} ${escapeHtml(p.name)}</strong>
              <span class="tag">${formatInt(p.score)}</span>
            </div>
            <div class="kv"><span>Époque</span><b>${escapeHtml(p.eraName)}</b><span>Cash</span><b>${money(p.cash)}</b></div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <h3>Journal</h3>
      <div class="list">
        ${app.state.game.news.map(n => `<div class="list-item">${escapeHtml(n.text)}</div>`).join('')}
      </div>
    </div>
  `;
}

function metric(label, value, cls = '') {
  return `<div class="metric"><span>${escapeHtml(label)}</span><b class="${cls}">${escapeHtml(String(value))}</b></div>`;
}

function renderFinanceSummary(me) {
  const b = me.stats?.lastBreakdown || {};
  const operatingMargin = me.stats.lastRevenue > 0 ? Math.round((me.stats.lastProfit / me.stats.lastRevenue) * 100) : 0;
  return `
    <div class="card">
      <h3>Résultat d’exploitation</h3>
      <div class="card-grid">
        ${metric('Revenus lignes /h', moneyPerHour(b.lineRevenue || me.stats.lastRevenue))}
        ${metric('Revenus gares /h', moneyPerHour(b.stationRevenue || 0), (b.stationRevenue || 0) > 0 ? 'good-text' : '')}
        ${metric('Coûts variables /h', moneyPerHour(b.variableLineCost || 0), 'warn-text')}
        ${metric('Charges fixes /h', moneyPerHour(b.sharedCosts || 0), 'warn-text')}
        ${metric('Résultat net /h', moneyPerHour(me.stats.lastProfit), me.stats.lastProfit >= 0 ? 'good-text' : 'bad-text')}
        ${metric('Marge', `${operatingMargin}%`, operatingMargin >= 0 ? 'good-text' : 'bad-text')}
      </div>
      <div class="kv finance-kv">
        <span>Personnel</span><b>${moneyPerHour(b.staffCost || 0)}</b>
        <span>Gares</span><b>${moneyPerHour(b.stationCost || 0)}</b>
        <span>Dette</span><b>${moneyPerHour(b.debtCost || 0)}</b>
        <span>Parc inutilisé</span><b>${moneyPerHour(b.idleTrainCost || 0)}</b>
        <span>R&D</span><b>${moneyPerHour(b.researchCost || 0)}</b>
      </div>
    </div>
  `;
}

function techLevel(nodeId) {
  const value = app.state?.me?.techUnlocked?.[nodeId];
  if (value === true) return 1;
  return Math.max(0, Math.floor(Number(value || 0)));
}

function plannedTechLevel(nodeId) {
  let level = techLevel(nodeId);
  const project = app.state?.me?.researchProject;
  if (project?.nodeId === nodeId) level = Math.max(level, Number(project.targetLevel || 0));
  for (const item of app.state?.me?.researchQueue || []) {
    if (item.nodeId === nodeId) level = Math.max(level, Number(item.targetLevel || 0));
  }
  return level;
}

function techMaxLevel(node) {
  const raw = Number(node?.maxLevel);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : Number.POSITIVE_INFINITY;
}

function techMaxLevelLabel(node) {
  return Number.isFinite(techMaxLevel(node)) ? String(techMaxLevel(node)) : '∞';
}

function nextTechLevel(node) {
  const max = techMaxLevel(node);
  const next = techLevel(node.id) + 1;
  return Number.isFinite(max) ? Math.min(max, next) : next;
}

function boundedExponentialClient(base, growth, exponent, cap = Number.MAX_SAFE_INTEGER) {
  const b = Math.max(0, Number(base || 0));
  const g = Math.max(1.01, Number(growth || 1));
  const e = Math.max(0, Number(exponent || 0));
  if (!Number.isFinite(b) || b <= 0) return 0;
  const logValue = Math.log(b) + Math.log(g) * e;
  if (!Number.isFinite(logValue) || logValue >= Math.log(cap)) return cap;
  return Math.min(cap, b * Math.exp(Math.log(g) * e));
}

function researchCostMoneyClient(node, targetLevel) {
  const level = Math.min(RESEARCH_TECHNICAL_MAX_LEVEL, Math.max(1, Math.floor(Number(targetLevel || 1))));
  const base = Number(node.baseCostMoney ?? node.costMoney ?? 50000);
  const growth = Number(node.costGrowth ?? 1.62);
  const epochFactor = 1 + Math.max(0, Number(node.requiredEpoch || 0)) * 0.22;
  return Math.round(boundedExponentialClient(base * epochFactor, growth, level - 1));
}

function researchDurationClient(node, targetLevel) {
  const level = Math.min(RESEARCH_TECHNICAL_MAX_LEVEL, Math.max(1, Math.floor(Number(targetLevel || 1))));
  const base = Number(node.baseDurationSeconds ?? node.baseDuration ?? node.duration ?? 30);
  const growth = Number(node.durationGrowth ?? 1.5);
  return Math.max(15000, Math.round(boundedExponentialClient(base, growth, level - 1, 315360000) * 1000));
}

function researchWorkRateClient(me = app.state?.me) {
  return me?.researchProject?.workRate || me?.research || 1;
}

function normalizeResearchPrereqItemClient(item) {
  if (!item) return null;
  if (typeof item === 'string') return { id: item, level: 1 };
  if (Array.isArray(item.anyOf)) {
    const anyOf = item.anyOf.map(normalizeResearchPrereqItemClient).filter(Boolean).filter(req => !req.anyOf);
    return anyOf.length ? { anyOf } : null;
  }
  return { id: item.id, level: Math.max(1, Math.floor(Number(item.level || 1))) };
}

function researchPrereqsForLevelClient(node, targetLevel) {
  const all = [...(node.prereq || [])];
  for (const entry of node.levelPrereq || []) {
    if (targetLevel >= Number(entry.level || 1)) all.push(...(entry.requires || []));
  }
  return all.map(normalizeResearchPrereqItemClient).filter(Boolean);
}

function researchPrereqSatisfiedClient(req) {
  if (req.anyOf) return req.anyOf.some(researchPrereqSatisfiedClient);
  return plannedTechLevel(req.id) >= req.level;
}

function researchPrereqLabelClient(req) {
  if (req.anyOf) return req.anyOf.map(researchPrereqLabelClient).join(' ou ');
  return `${techNodeTitle(req.id)} niv. ${req.level}`;
}

function researchGroupForNode(nodeId) {
  const tree = app.state?.balance?.techTree || {};
  for (const group of Object.values(tree)) {
    if ((group.nodes || []).some(node => node.id === nodeId)) return group.id;
  }
  return '';
}


function researchEraStorageKey(groupId, bucket) {
  const era = bucket?.era || 0;
  const label = bucket?.label || 'Général';
  return `${groupId || 'research'}::${era}::${label}`;
}

function researchEraBucketForNode(nodeId) {
  const tree = app.state?.balance?.techTree || {};
  for (const group of Object.values(tree)) {
    const node = (group.nodes || []).find(item => item.id === nodeId);
    if (node) {
      return {
        groupId: group.id,
        bucket: { era: node.era || 0, label: node.eraLabel || group.label || 'Général' }
      };
    }
  }
  return null;
}

function isResearchEraCollapsed(groupId, bucket) {
  return Boolean(app.researchEraCollapsed?.[researchEraStorageKey(groupId, bucket)]);
}

function setResearchEraCollapsed(groupId, bucket, collapsed) {
  const key = researchEraStorageKey(groupId, bucket);
  app.researchEraCollapsed = { ...(app.researchEraCollapsed || {}), [key]: Boolean(collapsed) };
  if (!collapsed) delete app.researchEraCollapsed[key];
  localStorage.setItem('sillons.researchEraCollapsed', JSON.stringify(app.researchEraCollapsed));
}

function toggleResearchEra(groupId, bucketKey) {
  const tree = app.state?.balance?.techTree || {};
  const group = tree[groupId];
  if (!group) return;
  const nodes = group.nodes || [];
  const buckets = researchEraBucketsForGroup(group);
  const bucket = buckets.find(item => item.key === bucketKey);
  if (!bucket) return;
  setResearchEraCollapsed(groupId, bucket, !isResearchEraCollapsed(groupId, bucket));
  renderAll();
}

function focusResearchNode(nodeId) {
  const groupId = researchGroupForNode(nodeId);
  if (!groupId) return;
  app.activeTab = 'research';
  app.activeResearchTab = groupId;
  app.highlightResearchId = nodeId;
  const bucketInfo = researchEraBucketForNode(nodeId);
  if (bucketInfo) setResearchEraCollapsed(bucketInfo.groupId, bucketInfo.bucket, false);
  localStorage.setItem('sillons.activeTab', app.activeTab);
  localStorage.setItem('sillons.researchTab', app.activeResearchTab);
  renderAll();
  requestAnimationFrame(() => {
    const el = document.querySelector(`.tech-node[data-node-id="${CSS.escape(nodeId)}"]`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  setTimeout(() => {
    if (app.highlightResearchId === nodeId) {
      app.highlightResearchId = '';
      renderAll();
    }
  }, 2800);
}

function researchEffectTarget(effect, node) {
  const text = `${effect || ''} ${node?.title || ''} ${node?.branch || ''}`.toLowerCase();
  if (/rh|équipe|conducteur|agent|formation|salariale|recrutement/.test(text)) return { tab: 'staff', label: 'Ressources humaines' };
  if (/gare|station|hub|quai|commerce|terminal voyageurs|flux voyageurs|bâtiment/.test(text)) return { tab: 'stations', label: 'Gares' };
  if (/énergie|charbon|diesel|électr|batterie|hydrogène|caténaire|co2/.test(text)) return { tab: 'market', label: 'Énergie & contrats' };
  if (/fret|wagon|conteneur|marchandises|vrac|logistique|portuaire/.test(text)) return { tab: 'lines', label: 'Lignes fret' };
  if (/maintenance|atelier|dépôt|révision|usure|fiabilité/.test(text)) return { tab: 'fleet', fleetSubtab: 'maintenance', label: 'Maintenance du parc' };
  if (/rame|locomotive|train|matériel|voiture|duplex|autorail|pacific|mountain|tgv|maglev/.test(text)) return { tab: 'fleet', fleetSubtab: 'catalog', label: 'Catalogue du parc' };
  return { tab: 'overview', label: 'Tableau de bord' };
}

function focusUiTarget(tab, targetLabel = '', fleetSubtab = '') {
  app.activeTab = tab || 'overview';
  if (app.activeTab === 'fleet' && ['catalog', 'maintenance', 'composition'].includes(fleetSubtab)) {
    app.activeFleetSubtab = fleetSubtab;
    localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
  }
  app.highlightUiTarget = targetLabel || app.activeTab;
  localStorage.setItem('sillons.activeTab', app.activeTab);
  renderAll();
  requestAnimationFrame(() => {
    const content = $('#tabContent');
    content?.classList.add('ui-glow-target');
    content?.scrollTo?.({ top: 0, behavior: 'smooth' });
  });
  setTimeout(() => {
    $('#tabContent')?.classList.remove('ui-glow-target');
    app.highlightUiTarget = '';
  }, 2400);
}

function formatResearchTime(valueMs) {
  const totalSeconds = Math.max(0, Math.ceil(Number(valueMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(n => String(n).padStart(2, '0')).join(':');
}

function formatCycles(value) {
  const n = Math.max(0, Math.ceil(Number(value || 0)));
  return n <= 1 ? '1 cycle' : `${n} cycles`;
}

function serverNow() {
  return Date.now() + (app.serverClockOffset || 0);
}

function researchProjectKey(project) {
  if (!project) return '';
  return `${project.nodeId || ''}:${project.targetLevel || 0}:${project.startedAt || 0}:${project.durationMs || 0}`;
}

function researchProgressPercentFromData(endAt, durationMs, workRate) {
  const now = serverNow();
  const remainingRealMs = Math.max(0, Number(endAt || 0) - now);
  const remainingWorkMs = remainingRealMs * Math.max(0.01, Number(workRate || 1));
  return Math.max(0, Math.min(100, (1 - remainingWorkMs / Math.max(1, Number(durationMs || 1))) * 100));
}

function researchProgressPercent(project) {
  if (!project) return 0;
  return researchProgressPercentFromData(project.endAt, project.durationMs, project.workRate || 1);
}

function applyResearchProgress(el, rawProgress) {
  const key = el.dataset.researchKey || '';
  const last = key ? Number(app.researchProgressCache[key] ?? el.dataset.lastProgress ?? 0) : Number(el.dataset.lastProgress || 0);
  // Évite le rollback visuel quand un refresh serveur reconstruit l'état avec quelques ms de décalage.
  const progress = key ? Math.max(last, rawProgress) : rawProgress;
  el.dataset.lastProgress = String(progress);
  if (key) app.researchProgressCache[key] = progress;
  el.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function updateResearchTimers() {
  const now = serverNow();
  document.querySelectorAll('[data-research-timer]').forEach(el => {
    const endAt = Number(el.dataset.endAt || 0);
    el.textContent = formatResearchTime(Math.max(0, endAt - now));
  });
  document.querySelectorAll('[data-research-progress]').forEach(el => {
    const endAt = Number(el.dataset.endAt || 0);
    const durationMs = Math.max(1, Number(el.dataset.durationMs || 1));
    const workRate = Math.max(0.01, Number(el.dataset.workRate || 1));
    const progress = researchProgressPercentFromData(endAt, durationMs, workRate);
    applyResearchProgress(el, progress);
  });
}

function startResearchAnimationLoop() {
  const tick = () => {
    updateResearchTimers();
    updateEpochTrafficAnimation();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function compositionMetric(label, value, tooltip, cls = '', secondaryValue = '') {
  return `
    <div class="metric composition-metric ${tooltip ? 'metric-has-tooltip' : ''}" ${tooltip ? `tabindex="0" ${tooltipAttr(tooltip)}` : ''}>
      <div class="metric-label-row">
        <span>${escapeHtml(label)}</span>
        ${tooltip ? '<i class="metric-info" aria-hidden="true">i</i>' : ''}
      </div>
      <b class="${cls}">${escapeHtml(String(value))}</b>
      ${secondaryValue ? `<small class="composition-metric-secondary">${escapeHtml(String(secondaryValue))}</small>` : ''}
    </div>`;
}

function variantMetricValue(multiplier = 1, delta = 0, mode = 'multiplier') {
  if (mode === 'delta') {
    const pct = Math.round(Number(delta || 0) * 100);
    return pct === 0 ? '0%' : `${pct > 0 ? '+' : ''}${pct}%`;
  }
  const pct = Math.round((Number(multiplier || 1) - 1) * 100);
  return pct === 0 ? '0%' : `${pct > 0 ? '+' : ''}${pct}%`;
}

function renderVariantStatRow(label, value, cls = '') {
  return `<div class="variant-stat-row"><span>${escapeHtml(label)}</span><b class="${cls}">${escapeHtml(String(value))}</b></div>`;
}

function tooltipAttr(text) {
  const safe = escapeAttr(String(text || '').trim());
  return safe ? ` aria-label="${safe}" data-tooltip="${safe}"` : '';
}

function lineElectrificationCost(line) {
  const me = app.state.me;
  const techDiscount = (1 - Math.min(0.2, (me.tech.energy || 0) * 0.03)) * (hasTech('electric_substations') ? 0.92 : 1);
  return Math.round(lineDistance(line) * 125000 * techDiscount);
}

function lineElectrificationTooltip(line) {
  const cost = lineElectrificationCost(line);
  return `Électrifie cette ligne pour ${money(cost)}. Effets : Toute la ligne et tous ses arrêts deviennent électrifiés ; les trains électriques peuvent y circuler ; la facture énergétique et le CO₂ baissent pour les matériels électriques.`;
}

function stationUpgradeTooltip(station, asset, upgrade) {
  const effects = {
    level: upgrade.label === 'Acheter'
      ? 'achète la ville, permet d’y créer des lignes et donne droit aux revenus de passage payés par les concurrents.'
      : 'augmente la capacité et l’attractivité de la gare ; débloque une meilleure base pour les autres améliorations.',
    commerce: 'ajoute des revenus annexes et améliore la satisfaction voyageurs.',
    maintenance: 'augmente la capacité d’atelier, réduit les coûts/durées de maintenance et aide à maintenir le parc fiable.',
    depot: 'permet le stationnement et améliore la portée pratique des trains vapeur sur les itinéraires qui passent par cette gare.'
  };
  const nextAsset = { ...(asset || {}) };
  if (upgrade.kind === 'level') nextAsset.level = upgrade.label === 'Acheter' ? 1 : Number(nextAsset.level || 1) + 1;
  if (upgrade.kind === 'commerce') nextAsset.commerce = Number(nextAsset.commerce || 0) + 1;
  if (upgrade.kind === 'maintenance') nextAsset.maintenance = Number(nextAsset.maintenance || 0) + 1;
  if (upgrade.kind === 'depot') nextAsset.depot = true;
  const nextCost = stationOperatingCostBreakdown(nextAsset).total;
  return `${upgrade.label} à ${station.name}. Coût immédiat : ${money(upgrade.cost)}. Coût d’exploitation après amélioration : ${moneyPerHour(nextCost)}. Effet : ${effects[upgrade.kind] || 'Amélioration de la gare.'}`;
}

function staffRoleLabel(label, count = 1) {
  const singular = String(label || 'Métier');
  if (Number(count || 0) <= 1) return singular;
  return {
    Conducteur: 'Conducteurs',
    Contrôleur: 'Contrôleurs',
    'Agent de gare': 'Agents de gare',
    Mainteneur: 'Mainteneurs',
    Régulateur: 'Régulateurs',
    'Agent de l’infra': 'Agents de l’infra'
  }[singular] || `${singular}s`;
}

function staffActionTooltip(role, count, kind) {
  const def = app.state.balance.staff[role];
  if (kind === 'hire') {
    return [
      `Action : Recruter ${count} ${staffRoleLabel(def.label, count)}`,
      `Coût immédiat : ${money(def.hireCost * count)}`,
      `Salaire ajouté : ${staffSalaryPerHour(def, count)}`
    ].join('\n');
  }
  return [
    `Action : Licencier ${count} ${staffRoleLabel(def.label, count)}`,
    `Salaire retiré : ${staffSalaryPerHour(def, count)}`
  ].join('\n');
}

function maintenancePolicyTooltip(policy) {
  const sign = policy.reliabilityBonus >= 0 ? '+' : '';
  return `${policy.name}. ${policy.description} Coût d’entretien ×${round(policy.costMultiplier)}, usure ×${round(policy.wearMultiplier)}, fiabilité ${sign}${Math.round(policy.reliabilityBonus * 100)} points.`;
}

function energyStrategyTooltip(id, strategy) {
  return `${strategy.name}. ${energyStrategyDescription(id)} Effet : Modifie les multiplicateurs de prix énergie dès le prochain calcul d’exploitation.`;
}



function preloadArt() {
  const sources = new Set([
    ART.map,
    ...Object.values(ART.tabs),
    ...Object.values(ART.researchGroups),
    ...Object.values(ART.researchNodes)
  ]);
  sources.forEach(src => {
    if (!src || artImages[src]) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    artImages[src] = img;
  });
}


function preloadMapSprites() {
  Object.entries(TRAIN_MAP_SPRITES).forEach(([id, src]) => {
    if (!src || app.mapSprites.trains[id]) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    app.mapSprites.trains[id] = img;
  });
  Object.entries(STATION_MAP_SPRITES).forEach(([level, src]) => {
    if (!src || app.mapSprites.stations[level]) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    app.mapSprites.stations[level] = img;
  });
}

function stationPrestigeStage(asset) {
  if (!asset) return 1;
  const score = Number(asset.level || 1)
    + Math.floor(Number(asset.commerce || 0) / 2)
    + Math.floor(Number(asset.maintenance || 0) / 2)
    + (asset.depot ? 1 : 0);
  return Math.max(1, Math.min(6, score));
}

function getTrainMapSprite(modelId) {
  return app.mapSprites.trains[modelId] || null;
}

function getStationMapSprite(asset) {
  return app.mapSprites.stations[String(stationPrestigeStage(asset))] || null;
}

function mapMaxZoomReached() {
  const map = app.map.leaflet;
  if (!map?.getZoom) return false;
  const max = Number(map.getMaxZoom?.() || 13);
  return Number(map.getZoom()) >= max;
}

function drawSmallMapMarker(ctx, p, radius, fill, selected = false) {
  if (selected) {
    ctx.fillStyle = 'rgba(250, 204, 21, 0.26)';
    ctx.fillRect(Math.round(p.x - 14), Math.round(p.y - 14), 28, 28);
  }
  ctx.fillStyle = 'rgba(8, 12, 18, 0.95)';
  ctx.fillRect(Math.round(p.x - radius - 1), Math.round(p.y - radius - 1), radius * 2 + 2, radius * 2 + 2);
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(p.x - radius + 1), Math.round(p.y - radius + 1), radius * 2 - 2, radius * 2 - 2);
}

function artForResearchGroup(id) {
  return ART.researchGroups[id] || ART.tabs.research;
}

function artForTechNode(id) {
  return ART.researchNodes[id] || null;
}

function renderSectionHero(kicker, title, text, image, tags = []) {
  return `
    <div class="menu-context card">
      <div class="menu-context__inner">
        ${kicker ? `<div class="hero-kicker">${escapeHtml(kicker)}</div>` : ''}
        <h2>${escapeHtml(title)}</h2>
        ${text ? `<p>${escapeHtml(text)}</p>` : ''}
        ${tags.length ? `<div class="hero-tags">${tags.map(tag => `<span class="tag">${escapeHtml(String(tag))}</span>`).join('')}</div>` : ''}
      </div>
    </div>
  `;
}


function renderStationSearchField(role, label, stationId, query = '') {
  const selected = station(stationId);
  const value = query || (selected ? stationSearchLabel(selected) : '');
  return `
    <label class="station-search-label">${escapeHtml(label)}
      <div class="station-search" data-role="${role}">
        <input id="line${capitalize(role)}Search" class="station-search-input" data-role="${role}" value="${escapeAttr(value)}" placeholder="Ex : Bayeux, Lille, Marseille..." autocomplete="off">
        <input id="line${capitalize(role)}" type="hidden" value="${escapeAttr(stationId || '')}">
        <div id="line${capitalize(role)}Suggestions" class="station-suggestions"></div>
      </div>
    </label>
  `;
}


function renderLines() {
  const me = app.state.me;
  const status = app.state.world.communesStatus;
  const communeTag = status ? `${formatInt(status.count || 0)} villes` : 'Villes';
  const active = ['create', 'manage'].includes(app.activeLinesSubtab) ? app.activeLinesSubtab : 'create';

  return `
    ${renderSectionHero('LIGNES & GARES', 'Création et exploitation des dessertes', 'Crée une nouvelle ligne dans un espace dédié, puis gère et modifie tes lignes existantes dans un second sous-onglet.', ART.tabs.lines, ['Carte interactive', communeTag, 'Lignes multi-arrêts'])}

    <div class="line-workspace">
      <div class="line-subtabs" role="tablist" aria-label="Gestion des lignes">
        <button type="button" data-lines-subtab="create" class="${active === 'create' ? 'active' : ''}">
          <span>Créer</span>
          <b>Nouvelle ligne</b>
        </button>
        <button type="button" data-lines-subtab="manage" class="${active === 'manage' ? 'active' : ''}">
          <span>Modifier</span>
          <b>${me.lines.filter(l => l.active).length} ligne(s)</b>
        </button>
      </div>

      ${active === 'create' ? renderCreateLinePanel() : renderManageLinesPanel()}
    </div>
  `;
}


function lineDistanceCalculatorData(draft = app.lineDraft) {
  const from = draft?.from;
  const to = draft?.to;
  if (!from || !to || from === to) return null;
  const direct = getRouteForStops([from, to]);
  const preparedStops = buildLineDraftStops();
  const prepared = preparedStops.length >= 2 ? getRouteForStops(preparedStops) : direct;
  return {
    from,
    to,
    directDistance: Math.round(direct.distance || 0),
    preparedDistance: Math.round(prepared.distance || 0),
    maxSegment: Math.round(prepared.maxSegment || 0),
    label: `${station(from)?.name || from} → ${station(to)?.name || to}`
  };
}

function renderLineDistanceCalculator(draft = app.lineDraft) {
  const data = lineDistanceCalculatorData(draft);
  return `
    <div id="lineDistanceCalculator" class="line-distance-calculator">
      ${data ? renderLineDistanceCalculatorContent(data) : '<span>Calculateur de distance</span><b>Sélectionne un départ et un terminus pour calculer la distance sans acheter.</b>'}
    </div>
  `;
}

function renderLineDistanceCalculatorContent(data) {
  const viaText = data.preparedDistance !== data.directDistance
    ? ` · avec arrêts préparés : ${formatInt(data.preparedDistance)} km`
    : '';
  return `<span>Calculateur de distance</span><b>${escapeHtml(data.label)} : ${formatInt(data.directDistance)} km${viaText} · tronçon max ${formatInt(data.maxSegment)} km</b>`;
}

function updateLineDistanceCalculator() {
  const box = $('#lineDistanceCalculator');
  if (!box) return;
  const data = lineDistanceCalculatorData(app.lineDraft);
  box.innerHTML = data
    ? renderLineDistanceCalculatorContent(data)
    : '<span>Calculateur de distance</span><b>Sélectionne un départ et un terminus pour calculer la distance sans acheter.</b>';
}

function renderCreateLinePanel() {
  const me = app.state.me;
  const freeTrains = me.trains.filter(t => !t.maintenance?.active && !me.lines.some(l => l.active && lineHasTrain(l, t.id)));
  const draft = normalizeLineDraft(freeTrains);
  const trainOptions = freeTrains.map(t => {
    const model = app.state.balance.trains[t.modelId];
    const meta = model ? `${model.speed} km/h · ${model.capacity} voy. · état ${Math.round(t.condition * 100)}%` : `état ${Math.round(t.condition * 100)}%`;
    return `<option value="${t.id}" ${t.id === draft.trainId ? 'selected' : ''}>${escapeHtml(trainName(t))} · ${escapeHtml(meta)}</option>`;
  }).join('');
  const ticketDistance = draftTicketDistance(draft);

  return `
    <div class="line-create-layout">
      <div class="card line-builder-card">
        <div class="line-card-heading">
          <div>
            <h2>Créer une ligne</h2>
            <p class="muted small">Sélectionne un départ, un terminus, puis ajoute uniquement les arrêts utiles. Le parcours affiché se met à jour avant validation.</p>
          </div>
          <span class="tag good">Étape 1</span>
        </div>

        <div class="form-grid" id="lineForm">
          <div class="route-choice-grid">
            ${renderStationSearchField('from', 'Départ', draft.from, draft.fromQuery)}
            ${renderStationSearchField('to', 'Terminus', draft.to, draft.toQuery)}
          </div>

          ${renderLineDistanceCalculator(draft)}

          <div class="line-route-preview-card">
            <div class="line-route-title">
              <span>Parcours préparé</span>
              <b>${buildLineDraftStops().length} arrêt(s)</b>
            </div>
            <div class="line-stop-strip">${renderDraftStopStrip(buildLineDraftStops(), draft.waypoints)}</div>
          </div>

          <details class="line-advanced-stop" ${draft.waypoints.length ? 'open' : ''}>
            <summary>
              <span>Arrêts intermédiaires</span>
              <b>${draft.waypoints.length ? `${draft.waypoints.length} ajouté(s)` : 'Optionnel'}</b>
            </summary>
            <div class="line-advanced-body">
              <p class="muted small">Ajoute une ville desservie entre le départ et le terminus. Le jeu la place à la meilleure position, puis tu peux corriger l’ordre dans l’onglet Modifier.</p>
              ${renderStationSearchField('via', 'Ajouter une desserte', draft.viaCandidate, draft.viaQuery)}
              <button type="button" id="addWaypointBtn" class="primary" ${tooltipAttr('Ajoute cette gare comme arrêt intermédiaire dans le parcours préparé.')}>Ajouter cette desserte</button>
              ${draft.waypoints.length ? `<div class="line-waypoint-list">${draft.waypoints.map((id, index) => renderWaypointChip(id, index)).join('')}</div>` : '<p class="muted small">Aucune desserte intermédiaire ajoutée.</p>'}
            </div>
          </details>

          <div class="line-service-grid">
            <label>Matériel disponible
              <select id="lineTrain">${trainOptions || '<option value="">Aucun train libre</option>'}</select>
            </label>
            <label>Service
              <select id="lineService">${serviceOptions(draft.service)}</select>
            </label>
            <label>Prix billet moyen
              ${renderTicketPriceControl({
                inputId: 'lineTicketPrice',
                rangeId: 'lineTicketPriceRange',
                hintId: 'lineTicketPriceHint',
                price: draft.ticketPrice,
                distance: ticketDistance
              })}
            </label>
          </div>

          <div id="linePreview" class="line-preview muted small">Choisis au moins un départ, une arrivée et un train.</div>

          <div class="line-create-actions">
            <button id="createLineBtn" class="primary big-action" ${tooltipAttr('Ouvre la ligne avec les arrêts, le train et le prix du billet choisis.')} ${freeTrains.length ? '' : 'disabled'}>
              Ouvrir la ligne
            </button>
          </div>
        </div>
      </div>

      <div class="card line-help-card">
        <h3>Lecture rapide</h3>
        <div class="line-help-steps">
          <div><b>1</b><span>Départ et terminus</span></div>
          <div><b>2</b><span>Dessertes optionnelles</span></div>
          <div><b>3</b><span>Train et prix</span></div>
          <div><b>4</b><span>Validation</span></div>
        </div>
        <p class="muted small">Pour modifier l’ordre exact des gares, utilise ensuite l’onglet <strong>Modifier</strong> : il contient le glissé-déposé.</p>
      </div>
    </div>
  `;
}

function renderManageLinesPanel() {
  const me = app.state.me;
  const lines = me.lines.filter(l => l.active);
  const activeLines = lines.length;
  const totalProfit = lines.reduce((sum, l) => sum + Number(l.stats?.finance?.netProfit ?? l.stats?.profit ?? 0), 0);
  const totalRevenue = lines.reduce((sum, l) => sum + Number(l.stats?.revenue || 0), 0);
  const totalPassengers = lines.reduce((sum, l) => sum + Number(l.stats?.passengers || 0), 0);
  return `
    <div class="line-manage-layout">
      <div class="line-management-summary">
        ${metric('Lignes actives', `${activeLines}/${me.lines.length}`)}
        ${metric('Recettes lignes /h', moneyPerHour(totalRevenue))}
        ${metric('Net estimé /h', moneyPerHour(totalProfit), totalProfit >= 0 ? 'good-text' : 'bad-text')}
        ${metric('Voyageurs J-1', formatInt(totalPassengers))}
      </div>

      <div class="card">
        <div class="line-card-heading">
          <div>
            <h2>Modifier les lignes</h2>
            <p class="muted small">Chaque ligne se modifie depuis une fiche claire : Matériel, prix du billet, arrêts, ordre des gares et électrification.</p>
          </div>
          <span class="tag">${activeLines} ligne(s)</span>
        </div>

        <div class="line-list-modern">
          ${lines.length ? lines.map(renderLineItem).join('') : '<p class="muted">Aucune ligne active à modifier. Crée une ligne ou ouvre une nouvelle desserte dans le sous-onglet Créer.</p>'}
        </div>
      </div>
    </div>
  `;
}

function lineMarketShareLabel(line) {
  const market = line.stats?.market || {};
  const parts = [];
  if (Number.isFinite(market.passengerShare)) parts.push(`V ${round(market.passengerShare)}%`);
  if (Number.isFinite(market.freightShare)) parts.push(`F ${round(market.freightShare)}%`);
  return parts.length ? parts.join(' / ') : 'N/A';
}

function lineAttractivenessLabel(line) {
  const passenger = line.stats?.attractiveness?.passenger?.score;
  const freight = line.stats?.attractiveness?.freight?.score;
  const scores = [passenger, freight].filter(Number.isFinite);
  return scores.length ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 'N/A';
}

function lineRankLabel(market, key) {
  const rank = market?.[`${key}Rank`];
  const competitors = market?.[`${key}Competitors`] || 0;
  if (!rank) return 'N/A';
  return `#${rank} / ${competitors} conc.`;
}

function linePercent(value) {
  return Number.isFinite(value) ? `${round(value)}%` : 'N/A';
}

function lineMoney(value) {
  return moneyPerHour(Number(value || 0));
}

function renderLineInsightPanels(line) {
  const stats = line.stats || {};
  const finance = stats.finance || {};
  const market = stats.market || {};
  const capacity = stats.capacity || {};
  const contribution = Number(finance.contribution ?? stats.profit ?? 0);
  const netProfit = Number(finance.netProfit ?? stats.profit ?? 0);
  const factorDetails = line.service === 'freight'
    ? stats.attractiveness?.freight
    : stats.attractiveness?.passenger || stats.attractiveness?.freight;

  return `
    <div class="line-insight-grid">
      <section class="line-insight-panel">
        <h4>Finance /h</h4>
        <div class="line-kv">
          <span>Recettes</span><b>${lineMoney(stats.revenue)}</b>
          <span>Couts variables</span><b>${lineMoney(finance.variableExpenses ?? stats.expenses)}</b>
          <span>Frais alloues</span><b>${lineMoney(finance.allocatedOverhead)}</b>
          <span>Net estime</span><b class="${netProfit >= 0 ? 'good-text' : 'bad-text'}">${lineMoney(netProfit)}</b>
        </div>
        <div class="line-finance-pills">
          <span class="income">Billets <b>${lineMoney(finance.ticketRevenue)}</b></span>
          <span class="income">Services <b>${lineMoney(finance.ancillaryRevenue)}</b></span>
          <span class="income">Fret <b>${lineMoney(finance.freightRevenue)}</b></span>
          <span class="income">Régulation <b>${lineMoney(finance.dispatchRevenueBoost)}</b></span>
          <span class="expense">Énergie <b>${lineMoney(finance.energyCost)}</b></span>
          <span class="expense">Maintenance train <b>${lineMoney(finance.maintenanceCost)}</b></span>
          <span class="expense">Entretien ligne <b>${lineMoney(finance.lineInfrastructureCost)}</b></span>
          <span class="expense">Vente & distribution <b>${lineMoney(finance.commercialSalesCost)}</b></span>
          <span class="expense">Contrôle & fraude <b>${lineMoney(finance.commercialControlCost)}</b></span>
          <span class="expense">Organisation commerciale <b>${lineMoney(finance.commercialAdministrationCost)}</b></span>
          <span class="expense">Péage gares concurrentes <b>${lineMoney(finance.accessCost)}</b></span>
        </div>
      </section>

      <section class="line-insight-panel">
        <h4>Demande & capacite</h4>
        <div class="line-kv">
          <span>Demande voy.</span><b>${formatInt(market.passengerDemand || 0)}</b>
          <span>Transportes</span><b>${formatInt(stats.passengers || 0)}</b>
          <span>Demande fret</span><b>${formatInt(market.freightDemand || 0)} t</b>
          <span>Transporte</span><b>${formatInt(stats.freightTons || 0)} t</b>
          <span>Charge voy.</span><b>${linePercent(capacity.passengerLoad)}</b>
          <span>Charge fret</span><b>${linePercent(capacity.freightLoad)}</b>
          <span>Sillons actifs</span><b>${Number.isFinite(capacity.effectiveFrequency) ? round(capacity.effectiveFrequency) : round(lineSlotDemandClient(line))}</b>
          <span>Composition</span><b>${escapeHtml(capacity.trainComposition || 'Standard')}</b>
        </div>
      </section>

      <section class="line-insight-panel line-factor-panel">
        <h4>Attractivite</h4>
        ${renderLineFactorBars(factorDetails)}
        <p class="small muted">Contribution avant frais fixes : <b class="${contribution >= 0 ? 'good-text' : 'bad-text'}">${lineMoney(contribution)}</b></p>
      </section>

      ${renderLineStaffNeedsCard(line)}
    </div>
  `;
}

function lineDriverCoverageForDisplay(line) {
  const fromStats = Number(line.stats?.staffing?.driverCoverage);
  if (Number.isFinite(fromStats)) return Math.max(0, Math.min(100, fromStats));
  return Math.round(driverCoverageClient() * 100);
}

function lineStaffNeedsStatusClass(line) {
  const coverage = lineDriverCoverageForDisplay(line);
  if (coverage >= 100) return 'good';
  if (coverage >= 60) return 'warn';
  return 'bad';
}

function renderLineStaffNeedsCard(line, options = {}) {
  const needs = lineStaffNeedsClient(line);
  const coverage = lineDriverCoverageForDisplay(line);
  const cls = lineStaffNeedsStatusClass(line);
  const effectiveFrequency = line.stats?.capacity?.effectiveFrequency ?? line.stats?.staffing?.effectiveFrequency;
  const requestedFrequency = line.stats?.capacity?.requestedFrequency ?? lineSlotDemandClient(line);
  const roleBars = staffOrder
    .filter(role => role !== 'stationAgents')
    .map(role => renderLineStaffNeedBar(role, needs[role] || 0, line))
    .join('');

  return `
    <section class="line-insight-panel line-staff-needs-card ${cls}">
      <h4>Salariés nécessaires</h4>
      <div class="line-staff-bars">${roleBars}</div>
      ${Number.isFinite(effectiveFrequency) && Number.isFinite(Number(requestedFrequency)) && Number(effectiveFrequency) < Number(requestedFrequency)
        ? `<p class="small muted">Sillons exploités : ${round(effectiveFrequency)} / ${round(requestedFrequency)} faute de Conducteurs.</p>`
        : '<p class="small muted">Conducteurs suffisants : tous les trains affectés peuvent circuler.</p>'}
    </section>
  `;
}

function lineRoleCoverageClient(role, need, line = null) {
  if (role === 'drivers' && line) return Math.round(lineDriverCoverageForDisplay(line));
  const required = Math.max(0, Number(need || 0));
  if (required <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(Number(app.state.me?.staff?.[role] || 0) / required * 100)));
}

function renderLineStaffNeedBar(role, need, line = null) {
  const label = app.state.balance.staff[role]?.label || role;
  const required = Math.max(0, Number(need || 0));
  const owned = Number(app.state.me?.staff?.[role] || 0);
  const pct = lineRoleCoverageClient(role, required, line);
  const status = pct >= 100 ? 'good' : pct >= 60 ? 'warn' : 'bad';
  const summary = required > 0 ? `${formatInt(owned)} / ${formatInt(required)}` : 'Non requis';
  return `
    <div class="line-role-bar ${status}">
      <div class="line-role-bar-head">
        <span>${escapeHtml(label)} ${summary}</span>
        <b class="${status}-text">${pct}%</b>
      </div>
      <i><em style="width:${pct}%"></em></i>
    </div>
  `;
}

function renderLineFactorBars(details) {
  if (!details?.factors) return '<p class="small muted">Données disponibles après le prochain cycle simulé.</p>';
  const labels = {
    price: 'Prix',
    frequency: 'Sillons',
    speed: 'Vitesse',
    comfortOrCapacity: details.market === 'freight' ? 'Capacite fret' : 'Confort/capacite',
    reputation: 'Reputation',
    condition: 'Etat train',
    staff: 'RH',
    stations: 'Gares',
    operations: 'Exploitation'
  };
  return `
    <div class="line-factor-list">
      ${Object.entries(details.factors)
        .filter(([, value]) => Number.isFinite(value))
        .map(([key, value]) => {
          const pct = Math.max(0, Math.min(125, Number(value || 0)));
          return `
            <div class="line-factor">
              <span>${escapeHtml(labels[key] || key)}</span>
              <b>${round(value)}%</b>
              <i><em style="width:${Math.min(100, pct)}%"></em></i>
            </div>
          `;
        }).join('')}
    </div>
  `;
}

function lineSillonLabel(line) {
  const sillons = line?.stats?.capacity?.sillons || line?.stats?.staffing?.sillons || null;
  if (!sillons) return '';
  const requested = Number(sillons.requestedFrequency ?? lineSlotDemandClient(line));
  const capacity = Number(sillons.lineCapacity ?? sillons.bottleneck?.capacity ?? sillons.maxFrequency ?? requested);
  const available = Number(sillons.maxFrequency ?? capacity);
  const effective = Number(sillons.effectiveFrequency ?? Math.min(requested, available));
  const bottleneck = sillons.bottleneck ? `${sillons.bottleneck.fromName || sillons.bottleneck.from} → ${sillons.bottleneck.toName || sillons.bottleneck.to}` : '';
  return [
    `Sillons utilisés : ${round(requested)}/${round(capacity)}`,
    `Trains effectivement admis : ${round(effective)}`,
    Number.isFinite(available) ? `Disponibles pour cette ligne : ${round(available)}` : '',
    bottleneck ? `Tronçon limitant : ${bottleneck}` : '',
    sillons.bottleneck?.usedByOthers ? `Déjà utilisés par d'autres : ${round(sillons.bottleneck.usedByOthers)}` : ''
  ].filter(Boolean).join(' · ');
}

function renderLineSillonMini(line) {
  const sillons = line?.stats?.capacity?.sillons || line?.stats?.staffing?.sillons || null;
  if (!sillons) return '';
  const requested = Number(sillons.requestedFrequency ?? lineSlotDemandClient(line));
  const capacity = Number(sillons.lineCapacity ?? sillons.bottleneck?.capacity ?? sillons.maxFrequency ?? requested);
  const cls = sillons.constrained || requested > capacity ? 'warn-text' : 'good-text';
  const value = `${round(requested)}/${round(capacity)} sillons`;
  const tip = lineSillonLabel(line);
  return `<div><span>Sillons</span><b class="${cls}" ${tooltipAttr(tip)}>${escapeHtml(value)}</b></div>`;
}

function renderLineItem(line) {
  const stops = lineStopsOf(line);
  const assignedTrains = lineAssignedTrainsClient(line);
  const train = assignedTrains[0];
  const model = train ? app.state.balance.trains[train.modelId] : null;
  const trainLabel = assignedTrains.length > 1 ? `${assignedTrains.length} trains` : (model?.name || 'Aucun');
  const profit = Number(line.stats?.finance?.netProfit ?? line.stats?.profit ?? 0);
  const profitCls = profit >= 0 ? 'good-text' : 'bad-text';
  const ticketPrice = lineTicketPrice(line);
  const electrifyCost = line.electrified ? 0 : lineElectrificationCost(line);
  const canElectrify = !line.electrified && app.state.me.cash >= electrifyCost;
  const collapsed = !!app.lineCollapsed?.[line.id];
  const operationalStatus = line.stats?.status === 'driver-shortage'
    ? { cls: 'bad', label: 'Conducteurs insuffisants' }
    : line.stats?.status === 'resource-shortage'
      ? { cls: 'bad', label: 'Ressource insuffisante' }
      : line.stats?.status === 'sillon-limited'
        ? { cls: 'warn', label: 'Sillons limités' }
        : line.stats?.status === 'maintenance'
          ? { cls: 'warn', label: 'Maintenance' }
          : line.stats?.status === 'train-out-of-service'
            ? { cls: 'bad', label: 'Train immobilisé' }
            : { cls: line.active ? 'good' : 'bad', label: line.active ? 'Active' : 'Fermée' };
  const shortStops = stops.length > 4
    ? `${station(stops[0])?.name || stops[0]} → ${stops.length - 2} arrêts → ${station(stops[stops.length - 1])?.name || stops[stops.length - 1]}`
    : lineStopsLabel(stops);

  const collapsedSummary = `
    <div class="line-card-collapsed-summary">
      <span>Train <b>${escapeHtml(trainLabel)}</b></span>
      <span>Distance <b>${formatInt(lineDistance(line))} km</b></span>
      <span>Trains <b>${assignedTrains.length}</b></span>
      <span>Sillons <b>${escapeHtml(String(round(line.stats?.capacity?.sillons?.requestedFrequency ?? lineSlotDemandClient(line))))}/${escapeHtml(String(round(line.stats?.capacity?.sillons?.lineCapacity ?? line.stats?.capacity?.sillons?.bottleneck?.capacity ?? line.stats?.capacity?.sillons?.maxFrequency ?? lineSlotDemandClient(line))))}</b></span>
      <span>Net /h <b class="${profitCls}">${moneyPerHour(profit)}</b></span>
    </div>
  `;

  const expandedContent = `
      <div class="line-card-modern-route">
        <span>${stops.map((id, index) => `<i title="${escapeAttr(station(id)?.name || id)}">${index + 1}</i>`).join('<b></b>')}</span>
      </div>

      <div class="line-card-modern-stats">
        <div><span>Trains</span><b>${escapeHtml(trainLabel)}</b></div>
        <div><span>Distance</span><b>${formatInt(lineDistance(line))} km</b></div>
        <div><span>Service</span><b>${serviceLabels[line.service]}</b></div>
        <div><span>Trains affectés</span><b>${assignedTrains.length}</b></div>
        ${renderLineSillonMini(line)}
        <div><span>Billet moyen</span><b>${money(ticketPrice)}</b></div>
        <div><span>Attractivite</span><b>${escapeHtml(String(lineAttractivenessLabel(line)))}</b></div>
        <div><span>Net estimé /h</span><b class="${profitCls}">${moneyPerHour(profit)}</b></div>
      </div>

      ${renderLineInsightPanels(line)}

      <div class="line-card-modern-actions">
        <button data-action="edit-line" data-id="${line.id}" ${tooltipAttr('Ouvre l’éditeur complet : trains affectés, prix du billet, arrêts et ordre des gares en glissé-déposé.')}>Modifier</button>
        <button data-action="electrify-line" data-id="${line.id}" ${tooltipAttr(line.electrified ? 'Cette ligne est déjà électrifiée.' : lineElectrificationTooltip(line))} ${line.electrified || !canElectrify ? 'disabled' : ''}>
          ${line.electrified ? 'Électrifiée' : `Électrifier · ${money(electrifyCost)}`}
        </button>
        <button class="danger close-line-btn" data-action="close-line" data-id="${line.id}" ${tooltipAttr('Ferme la ligne. Le train est libéré et la ligne ne génère plus de revenus.')} ${line.active ? '' : 'disabled'}>Fermer</button>
      </div>
  `;

  return `
    <article class="line-card-modern ${line.active ? '' : 'inactive'} ${collapsed ? 'collapsed' : ''}">
      <header class="line-card-modern-head">
        <div>
          <div class="line-title-row">
            <h3>${escapeHtml(linePublicName(line))}</h3>
            ${renderLineServicePill(line, train, model)}
          </div>
          <p>${escapeHtml(shortStops)}</p>
        </div>
        <div class="line-card-modern-head-actions">
          <span class="tag ${operationalStatus.cls}">${escapeHtml(operationalStatus.label)}</span>
          <button type="button" class="line-collapse-btn" data-action="toggle-line-card" data-id="${line.id}" aria-expanded="${collapsed ? 'false' : 'true'}">
            ${collapsed ? 'Déplier' : 'Réduire'}
          </button>
        </div>
      </header>

      ${collapsed ? collapsedSummary : expandedContent}
    </article>
  `;
}

function trainEraLabel(epochId) {
  return app.state.balance.epochs[epochId]?.name || `Époque ${Number(epochId) + 1}`;
}

function trainStrengths(model) {
  const parts = [];
  if (model.speed >= 250) parts.push('très grande vitesse');
  else if (model.speed >= 160) parts.push('rapide');
  if (model.capacity >= 700) parts.push('haute capacité');
  else if (model.capacity >= 400) parts.push('capacité solide');
  if (model.freight >= 1200) parts.push('fret lourd');
  else if (model.freight >= 500) parts.push('fret polyvalent');
  if (model.reliability >= 0.92) parts.push('fiabilité élevée');
  if (model.maintenance <= 0.42) parts.push('maintenance légère');
  if (model.comfort >= 0.82) parts.push('premium');
  return parts.slice(0, 3).join(' · ') || 'polyvalent';
}

function formatTrainStatModifier(baseDisplay, modifiedDisplay) {
  if (baseDisplay == null || modifiedDisplay == null || modifiedDisplay === '') return '';
  const base = String(baseDisplay).trim();
  const next = String(modifiedDisplay).trim();
  return !next || base === next ? '' : `<small class="train-stat-modifier good-text">→ ${escapeHtml(next)}</small>`;
}

function renderTrainStat(label, value, ratio, cls = '', modifiedValue = '', modifiedRatio = null) {
  const pct = Math.max(4, Math.min(100, Math.round(ratio * 100)));
  const extraPct = modifiedRatio == null ? pct : Math.max(pct, Math.min(100, Math.round(modifiedRatio * 100)));
  const addPct = Math.max(0, extraPct - pct);
  const hasModifier = modifiedValue !== '' && modifiedValue != null && String(modifiedValue) !== String(value) && addPct > 0;
  return `
    <div class="train-stat ${cls} ${hasModifier ? 'has-modifier' : ''}">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(String(value))}${hasModifier ? formatTrainStatModifier(value, modifiedValue) : ''}</b>
      <i><em style="width:${pct}%"></em>${hasModifier ? `<strong style="left:${pct}%; width:${addPct}%"></strong>` : ''}</i>
    </div>`;
}

function renderTrainArt(model) {
  return `<div class="train-art train-art-placeholder" aria-label="Visuel à refaire pour ${escapeAttr(model.name)}"><span>Visuel matériel</span><b>À refaire</b></div>`;
}



function trainRuntimeProfile(train, model = app.state.balance.trains[train.modelId]) {
  const p = train?.profile || {};
  return {
    capacity: Number.isFinite(p.capacity) ? p.capacity : Number(model?.capacity || 0),
    freight: Number.isFinite(p.freight) ? p.freight : Number(model?.freight || 0),
    speed: Number.isFinite(p.speed) ? p.speed : Number(model?.speed || 0),
    range: Number.isFinite(p.range) ? p.range : Number(model?.range || 0),
    energy: Number.isFinite(p.energy) ? p.energy : Number(model?.energy || 0),
    maintenance: Number.isFinite(p.maintenance) ? p.maintenance : Number(model?.maintenance || 0),
    reliability: Number.isFinite(p.reliability) ? p.reliability : Number(model?.reliability || 0),
    comfort: Number.isFinite(p.comfort) ? p.comfort : Number(model?.comfort || 0)
  };
}

function compositionDefaultModeForModelClient(model) {
  const label = `${model?.name || ''} ${model?.type || ''}`.toLowerCase();
  const isMultipleUnit = /(autorail|rame|tgv|duplex|régio|ter|hydrogène|batterie|train de nuit|maglev|grande vitesse)/.test(label);
  if (isMultipleUnit) return 'multiple_unit';
  const passengerDominant = (model?.capacity || 0) >= Math.max(80, (model?.freight || 0) * 0.9);
  return passengerDominant && (model?.capacity || 0) > 0 ? 'passenger_loco' : 'freight_loco';
}

function buildClientCompositionSpec(model, preferredMode = null) {
  const defaultMode = compositionDefaultModeForModelClient(model);
  if (defaultMode === 'multiple_unit') {
    const defaultUnits = clamp(Math.round((model?.capacity || 180) / 220), 1, 5);
    return {
      mode: 'multiple_unit',
      availableModes: ['multiple_unit'],
      powerUnits: { min: 1, max: Math.max(defaultUnits + 2, 4), default: defaultUnits },
      label: 'Engins moteurs',
      variants: []
    };
  }
  const availableModes = ['passenger_loco', 'freight_loco'];
  const mode = availableModes.includes(preferredMode) ? preferredMode : defaultMode;
  const passengerDefault = clamp(Math.round((Math.max(model?.capacity || 100, 100)) / 90), 1, 8);
  const freightDefault = clamp(Math.round((Math.max(model?.freight || 200, 180)) / 180), 2, 14);
  if (mode === 'passenger_loco') {
    return {
      mode,
      availableModes,
      passengerCars: { min: 1, max: Math.max(passengerDefault + 5, 8), default: passengerDefault },
      label: 'Voitures voyageurs',
      variants: CLIENT_COMPOSITION_VARIANTS?.passenger_loco || []
    };
  }
  return {
    mode,
    availableModes,
    freightCars: { min: 2, max: Math.max(freightDefault + 6, 12), default: freightDefault },
    label: 'Wagons fret',
    variants: CLIENT_COMPOSITION_VARIANTS?.freight_loco || []
  };
}

function activeCompositionMode(train, model = app.state.balance.trains[train.modelId]) {
  return app.compositionEditorModes?.[train.id] || train?.composition?.mode || train?.compositionMode || train?.compositionSpec?.mode || compositionDefaultModeForModelClient(model);
}

function trainCompositionSpec(train, model = app.state.balance.trains[train.modelId]) {
  const mode = activeCompositionMode(train, model);
  return buildClientCompositionSpec(model, mode);
}

function compositionVariantUnlockedForClient(variant, model) {
  const me = app.state?.me;
  if (!variant || !me) return false;
  if ((variant.requiredEpoch || 0) > (me.epoch || 0)) return false;
  if ((variant.requiredModelEpoch || 0) > (model?.unlockEpoch || 0)) return false;
  if (variant.requiredTech && !me.techUnlocked?.[variant.requiredTech]) return false;
  return true;
}

function trainCompositionVariants(train, model = app.state.balance.trains[train.modelId]) {
  return (trainCompositionSpec(train, model)?.variants || []).filter(variant => compositionVariantUnlockedForClient(variant, model));
}

function selectedCompositionVariant(train, model = app.state.balance.trains[train.modelId]) {
  const spec = trainCompositionSpec(train, model);
  const variants = trainCompositionVariants(train, model);
  if (!variants.length) return null;
  const composition = train?.composition || {};
  const selectedId = spec.mode === 'freight_loco' ? composition.freightVariant : composition.passengerVariant;
  return variants.find(v => v.id === selectedId) || variants[0] || null;
}

function compositionVariantAssetMultiplierClient(variant) {
  if (!variant) return 1;
  const stats = variant.stats || variant;
  const raw = 1
    + (Number(stats.capacityMultiplier ?? 1) - 1) * 0.42
    + (Number(stats.speedMultiplier ?? 1) - 1) * 0.35
    + (Number(stats.revenueMultiplier ?? 1) - 1) * 0.38
    + Math.max(0, Number(stats.comfortDelta || 0)) * 0.55
    + Math.max(0, Number(stats.reliabilityDelta || 0)) * 2.5
    + Math.max(0, Number(stats.maintenanceMultiplier ?? 1) - 1) * 0.14
    + Math.max(0, Number(stats.energyMultiplier ?? 1) - 1) * 0.10
    + Math.max(0, Number(variant.requiredModelEpoch ?? variant.requiredEpoch ?? 0)) * 0.08;
  return clamp(raw, 0.72, 1.85);
}

function compositionVariantByIdClient(mode, id) {
  const list = CLIENT_COMPOSITION_VARIANTS?.[mode] || [];
  return list.find(v => v.id === id) || list[0] || null;
}

function compositionUnitCostClient(model, mode, variantId = '') {
  const modelPrice = Math.max(50000, Number(model?.price || 0));
  if (mode === 'multiple_unit') {
    const spec = buildClientCompositionSpec(model, 'multiple_unit');
    const defaultUnits = Math.max(1, Number(spec.powerUnits?.default || 1));
    return Math.max(85000, Math.round(modelPrice * 0.58 / defaultUnits));
  }
  if (mode === 'freight_loco') {
    const spec = buildClientCompositionSpec(model, 'freight_loco');
    const defaultWagons = Math.max(1, Number(spec.freightCars?.default || 1));
    const variant = compositionVariantByIdClient('freight_loco', variantId || 'covered');
    return Math.max(18000, Math.round(modelPrice * 0.34 / defaultWagons * compositionVariantAssetMultiplierClient(variant)));
  }
  const spec = buildClientCompositionSpec(model, 'passenger_loco');
  const defaultCars = Math.max(1, Number(spec.passengerCars?.default || 1));
  const variant = compositionVariantByIdClient('passenger_loco', variantId || 'standard');
  return Math.max(26000, Math.round(modelPrice * 0.38 / defaultCars * compositionVariantAssetMultiplierClient(variant)));
}

function compositionAssetValueClient(model, composition, mode = null) {
  if (!model || !composition) return 0;
  const activeMode = mode || composition.mode || compositionDefaultModeForModelClient(model);
  if (activeMode === 'multiple_unit') {
    const spec = buildClientCompositionSpec(model, 'multiple_unit');
    const count = clamp(Math.round(Number(composition.powerUnits ?? spec.powerUnits?.default ?? 1)), spec.powerUnits.min, spec.powerUnits.max);
    return Math.round(count * compositionUnitCostClient(model, 'multiple_unit'));
  }
  if (activeMode === 'freight_loco') {
    const spec = buildClientCompositionSpec(model, 'freight_loco');
    const count = clamp(Math.round(Number(composition.freightCars ?? spec.freightCars?.default ?? 0)), spec.freightCars.min, spec.freightCars.max);
    return Math.round(count * compositionUnitCostClient(model, 'freight_loco', composition.freightVariant || 'covered'));
  }
  const spec = buildClientCompositionSpec(model, 'passenger_loco');
  const count = clamp(Math.round(Number(composition.passengerCars ?? spec.passengerCars?.default ?? 0)), spec.passengerCars.min, spec.passengerCars.max);
  return Math.round(count * compositionUnitCostClient(model, 'passenger_loco', composition.passengerVariant || 'standard'));
}

function compositionChangeEconomyClient(train, payload) {
  const model = app.state.balance.trains[train.modelId];
  const current = train.composition || {};
  const mode = payload?.mode || activeCompositionMode(train, model);
  const target = { ...current, mode };
  if (mode === 'multiple_unit') target.powerUnits = Number(payload.powerUnits ?? current.powerUnits ?? buildClientCompositionSpec(model, 'multiple_unit').powerUnits.default);
  if (mode === 'freight_loco') {
    target.freightCars = Number(payload.freightCars ?? current.freightCars ?? buildClientCompositionSpec(model, 'freight_loco').freightCars.default);
    target.freightVariant = payload.freightVariant || current.freightVariant || 'covered';
  }
  if (mode === 'passenger_loco') {
    target.passengerCars = Number(payload.passengerCars ?? current.passengerCars ?? buildClientCompositionSpec(model, 'passenger_loco').passengerCars.default);
    target.passengerVariant = payload.passengerVariant || current.passengerVariant || 'standard';
  }
  const beforeValue = compositionAssetValueClient(model, current, current.mode || compositionDefaultModeForModelClient(model));
  const afterValue = compositionAssetValueClient(model, target, target.mode);
  const delta = Math.round(afterValue - beforeValue);
  const conditionFactor = clamp(Number(train?.condition || 0), 0.05, 1);
  return {
    beforeValue,
    afterValue,
    delta,
    cost: delta > 0 ? delta : 0,
    refund: delta < 0 ? Math.round(Math.abs(delta) * 0.78 * conditionFactor) : 0,
    target
  };
}

function renderCompositionCostSummary(train) {
  const model = app.state.balance.trains[train.modelId];
  const composition = train.composition || {};
  const value = compositionAssetValueClient(model, composition, composition.mode || activeCompositionMode(train, model));
  const condition = Math.round(clamp(Number(train.condition || 0), 0, 1) * 100);
  return `
    <div class="composition-cost-summary" id="compositionCostSummary">
      <span>Valeur voitures/wagons actuelle : <b>${money(value)}</b></span>
      <span class="small muted">Tout ajout est facturé. Tout retrait est remboursé à 78% de sa valeur, corrigé par l’usure du train (${condition}%).</span>
    </div>`;
}

function trainResaleEstimateClient(train, model = app.state.balance.trains[train.modelId]) {
  if (!train || !model) return 0;
  const defaultMode = compositionDefaultModeForModelClient(model);
  const defaultSpec = buildClientCompositionSpec(model, defaultMode);
  const defaultComposition = defaultMode === 'multiple_unit'
    ? { mode: defaultMode, powerUnits: defaultSpec.powerUnits.default }
    : defaultMode === 'freight_loco'
      ? { mode: defaultMode, freightCars: defaultSpec.freightCars.default, freightVariant: 'covered' }
      : { mode: defaultMode, passengerCars: defaultSpec.passengerCars.default, passengerVariant: 'standard' };
  const defaultCompositionValue = compositionAssetValueClient(model, defaultComposition, defaultMode);
  const baseTractionValue = Math.max(Math.round(Number(model.price || 0) * 0.42), Math.round(Number(model.price || 0) - defaultCompositionValue));
  const currentCompositionValue = compositionAssetValueClient(model, train.composition || defaultComposition, train.composition?.mode || defaultMode);
  const capitalValue = Math.max(0, baseTractionValue + currentCompositionValue);
  return Math.max(5000, Math.round(capitalValue * (0.45 - Math.min(0.3, Number(train.age || 0) / 1000)) * clamp(Number(train.condition || 0), 0, 1)));
}

function trainConditionPerformanceFactorClient(train) {
  const condition = clamp(Number(train?.condition ?? 1), 0, 1);
  if (condition <= 0) return 0;
  return clamp(0.35 + condition * 0.65, 0.35, 1);
}

function applyTrainConditionToPreview(profile, train) {
  const factor = trainConditionPerformanceFactorClient(train);
  if (factor <= 0) {
    profile.nominalSpeed = profile.speed;
    profile.speed = 0;
    profile.reliability = 0;
    profile.conditionSpeedFactor = 0;
    return profile;
  }
  profile.nominalSpeed = profile.speed;
  profile.speed = Math.max(5, Math.round(profile.speed * factor));
  profile.reliability = clamp(profile.reliability * (0.25 + factor * 0.75), 0.05, 0.995);
  profile.conditionSpeedFactor = round(factor);
  return profile;
}

function formatMaintenanceCountdown(hours) {
  if (hours == null || !Number.isFinite(Number(hours))) return '—';
  const h = Math.max(0, Number(hours));
  if (h <= 0) return 'Maintenance requise';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${round(h)} h`;
  return `${round(h / 24)} j`;
}

function trainProjectionLabel(train) {
  const projection = train?.maintenanceProjection || {};
  if (train?.maintenance?.active) return 'En atelier';
  if (Number(train?.condition || 0) <= 0) return 'Maintenance requise';
  return `0% dans ${formatMaintenanceCountdown(projection.hoursToZero)}`;
}

function metricFormatOptions(metricKey) {
  if (metricKey === 'reliability' || metricKey === 'comfort') return { decimals: 0, unit: '%', factor: 100 };
  if (metricKey === 'energy' || metricKey === 'maintenance') return { decimals: 1, unit: '', factor: 1 };
  if (metricKey === 'freight') return { decimals: 0, unit: ' t', factor: 1 };
  if (metricKey === 'speed' || metricKey === 'range') return { decimals: 0, unit: ' km', factor: 1 };
  return { decimals: 0, unit: '', factor: 1 };
}

function formatMetricAbsolute(metricKey, value) {
  const cfg = metricFormatOptions(metricKey);
  const scaled = Number(value || 0) * cfg.factor;
  const rounded = cfg.decimals ? round(scaled) : Math.round(scaled);
  return `${formatInt(rounded)}${cfg.unit}`;
}

function formatMetricDelta(metricKey, value) {
  const cfg = metricFormatOptions(metricKey);
  const scaled = Number(value || 0) * cfg.factor;
  const rounded = cfg.decimals ? round(Math.abs(scaled)) : Math.round(Math.abs(scaled));
  return `${scaled > 0 ? '+' : '-'}${formatInt(rounded)}${cfg.unit}`;
}

function buildMetricTooltip(metricLabel, metricKey, detail) {
  const lines = [detail.description || metricLabel, `Base : ${formatMetricAbsolute(metricKey, detail.base)}`];
  for (const step of detail.steps || []) {
    if (!step || Math.abs(Number(step.delta || 0)) < 0.0001) continue;
    lines.push(`${step.delta >= 0 ? 'Bonus' : 'Malus'} ${step.label} : ${formatMetricDelta(metricKey, step.delta)}`);
    for (const sub of step.sources || []) lines.push(`${sub.delta >= 0 ? 'Bonus' : 'Malus'} ${sub.label} : ${sub.value}`);
  }
  lines.push('----');
  lines.push(`Final : ${formatMetricAbsolute(metricKey, detail.final)}`);
  return lines.join('\n');
}

function computeOperatingProfileDetailed(train, model = app.state.balance.trains[train.modelId]) {
  const sourceModel = effectiveModelWithResearchClient(model);
  const researchInfo = trainInheritedResearchBonus(model);
  const spec = trainCompositionSpec(train, model);
  const c = train?.composition || {};
  const baseProfile = {
    capacity: Number(model?.capacity || 0),
    freight: Number(model?.freight || 0),
    speed: Number(model?.speed || 0),
    range: Number(model?.range || 0),
    energy: Number(model?.energy || 0),
    maintenance: Number(model?.maintenance || 0),
    reliability: Number(model?.reliability || 0),
    comfort: Number(model?.comfort || 0)
  };
  const profile = {
    capacity: Number(sourceModel?.capacity || 0),
    freight: Number(sourceModel?.freight || 0),
    speed: Number(sourceModel?.speed || 0),
    range: Number(sourceModel?.range || 0),
    energy: Number(sourceModel?.energy || 0),
    maintenance: Number(sourceModel?.maintenance || 0),
    reliability: Number(sourceModel?.reliability || 0),
    comfort: Number(sourceModel?.comfort || 0)
  };
  const metrics = {};
  const metricLabels = {
    capacity: 'Voyageurs / train', freight: 'Fret / train', speed: 'Vitesse commerciale', range: 'Portée', reliability: 'Fiabilité', comfort: 'Confort', energy: 'Énergie', maintenance: 'Maintenance'
  };
  const descriptions = {
    capacity: 'Nombre maximal de voyageurs transportés par train après prise en compte de la composition choisie.',
    freight: 'Tonnage maximal de fret transportable par train avec cette composition.',
    speed: 'Vitesse de référence retenue en exploitation. Elle influence le temps de rotation, la productivité et la capacité quotidienne.',
    range: 'Distance maximale admissible pour ce train après composition et recherches. Une ligne plus longue sera refusée.',
    reliability: 'Probabilité de rouler sans incident majeur. Plus elle est basse, plus le risque de panne, retard et perte d’attractivité augmente.',
    comfort: 'Qualité perçue du service par les voyageurs : agrément, image et standing.',
    energy: 'Consommation énergétique de référence pour cette composition. Une valeur plus élevée alourdit les coûts d’exploitation.',
    maintenance: 'Coût d’entretien unitaire issu du matériel, de la composition et de l’état du train.'
  };
  for (const key of Object.keys(baseProfile)) {
    metrics[key] = { key, label: metricLabels[key], description: descriptions[key], base: Number(baseProfile[key] || 0), steps: [] };
    const researchDelta = Number(profile[key] || 0) - Number(baseProfile[key] || 0);
    if (Math.abs(researchDelta) >= 0.0001) {
      const sourceLines = researchInfo.effects
        .filter(effect => (key === 'range' ? ['range', 'autonomy'].includes(effect.kind) : effect.kind === key))
        .map(effect => ({ label: `${effect.title} niv. ${effect.level}`, delta: researchDelta >= 0 ? 1 : -1, value: effect.signedPercent || '' }))
        .filter(item => item.value);
      metrics[key].steps.push({ label: 'recherches héritées', delta: researchDelta, sources: sourceLines });
    }
  }

  const beforeComposition = { ...profile };
  if (spec.mode === 'multiple_unit') {
    const defaultUnits = spec.powerUnits.default;
    const ratio = Number(c.powerUnits || defaultUnits) / Math.max(1, defaultUnits);
    profile.capacity = Math.max(0, Math.round(profile.capacity * ratio));
    profile.freight = Math.max(0, Math.round(profile.freight * ratio));
    profile.speed = Math.max(35, Math.round(profile.speed * (1 - Math.max(0, ratio - 1) * 0.015)));
    profile.energy = round(profile.energy * ratio * (0.95 + ratio * 0.05));
    profile.maintenance = round(profile.maintenance * ratio * (0.92 + ratio * 0.08));
    profile.reliability = clamp(profile.reliability - Math.max(0, ratio - 1) * 0.015, 0.45, 0.995);
    profile.comfort = clamp(profile.comfort - Math.max(0, ratio - 1) * 0.01, 0.08, 1);
  } else if (spec.mode === 'passenger_loco') {
    const variant = selectedCompositionVariant(train, model) || { stats: {}, capacityMultiplier: 1, speedMultiplier: 1, energyMultiplier: 1, maintenanceMultiplier: 1, reliabilityDelta: 0, comfortDelta: 0 };
    const stats = variant.stats || variant;
    const defaultCars = spec.passengerCars.default;
    const ratio = Number(c.passengerCars || defaultCars) / Math.max(1, defaultCars);
    profile.capacity = Math.max(0, Math.round(profile.capacity * ratio));
    profile.freight = Math.max(0, Math.round((sourceModel?.freight || 0) * Math.min(1.2, 0.65 + Number(c.passengerCars || defaultCars) * 0.08)));
    profile.speed = Math.max(30, Math.round(profile.speed * (1 - Math.max(0, ratio - 1) * 0.03)));
    profile.energy = round(profile.energy * (0.72 + ratio * 0.28 + Math.max(0, ratio - 1) * 0.08));
    profile.maintenance = round(profile.maintenance * (0.76 + ratio * 0.24 + Math.max(0, ratio - 1) * 0.05));
    profile.reliability = clamp(profile.reliability - Math.max(0, ratio - 1) * 0.02, 0.45, 0.995);
    profile.comfort = clamp(profile.comfort + Math.min(0.06, Math.max(0, ratio - 1) * 0.015), 0.08, 1);
    profile.capacity = Math.max(0, Math.round(profile.capacity * (stats.capacityMultiplier || 1)));
    profile.speed = Math.max(30, Math.round(profile.speed * (stats.speedMultiplier || 1)));
    profile.energy = round(profile.energy * (stats.energyMultiplier || 1));
    profile.maintenance = round(profile.maintenance * (stats.maintenanceMultiplier || 1));
    profile.reliability = clamp(profile.reliability + (stats.reliabilityDelta || 0), 0.45, 0.995);
    profile.comfort = clamp(profile.comfort + (stats.comfortDelta || 0), 0.08, 1);
  } else {
    const variant = selectedCompositionVariant(train, model) || { stats: {} };
    const stats = variant.stats || variant;
    const defaultWagons = spec.freightCars.default;
    const ratio = Number(c.freightCars || defaultWagons) / Math.max(1, defaultWagons);
    profile.freight = Math.max(0, Math.round((sourceModel?.freight || 0) * ratio));
    profile.capacity = Math.max(0, Math.round((sourceModel?.capacity || 0) * Math.max(0.4, 1 - Math.max(0, ratio - 1) * 0.18)));
    profile.speed = Math.max(25, Math.round(profile.speed * (1 - Math.max(0, ratio - 1) * 0.035)));
    profile.energy = round(profile.energy * (0.7 + ratio * 0.3 + Math.max(0, ratio - 1) * 0.1));
    profile.maintenance = round(profile.maintenance * (0.74 + ratio * 0.26 + Math.max(0, ratio - 1) * 0.06));
    profile.reliability = clamp(profile.reliability - Math.max(0, ratio - 1) * 0.022, 0.45, 0.995);
    profile.comfort = clamp(profile.comfort - Math.max(0, ratio - 1) * 0.01, 0.05, 1);
    profile.freight = Math.max(0, Math.round(profile.freight * (stats.capacityMultiplier || 1)));
    profile.speed = Math.max(25, Math.round(profile.speed * (stats.speedMultiplier || 1)));
    profile.energy = round(profile.energy * (stats.energyMultiplier || 1));
    profile.maintenance = round(profile.maintenance * (stats.maintenanceMultiplier || 1));
    profile.reliability = clamp(profile.reliability + (stats.reliabilityDelta || 0), 0.45, 0.995);
  }
  for (const key of Object.keys(beforeComposition)) {
    const delta = Number(profile[key] || 0) - Number(beforeComposition[key] || 0);
    if (Math.abs(delta) >= 0.0001) metrics[key].steps.push({ label: 'composition', delta, sources: [] });
  }

  const beforeCondition = { ...profile };
  applyTrainConditionToPreview(profile, train);
  for (const key of Object.keys(beforeCondition)) {
    const delta = Number(profile[key] || 0) - Number(beforeCondition[key] || 0);
    if (Math.abs(delta) >= 0.0001) metrics[key].steps.push({ label: 'état du train', delta, sources: [] });
  }
  for (const key of Object.keys(metrics)) metrics[key].final = Number(profile[key] || 0);
  return { profile, metrics };
}

function previewOperatingProfile(train, model = app.state.balance.trains[train.modelId]) {
  return computeOperatingProfileDetailed(train, model).profile;
}

function deriveCompositionSummary(train) {
  const c = train?.composition || {};
  const spec = trainCompositionSpec(train);
  const variant = selectedCompositionVariant(train);
  if (spec.mode === 'multiple_unit') return `${c.powerUnits || spec.powerUnits?.default || 1} engin(s) moteur(s)`;
  if (spec.mode === 'freight_loco') return `${c.freightCars || spec.freightCars?.default || 0} wagon(s) · ${variant?.shortLabel || 'Fret'}`;
  return `${c.passengerCars || spec.passengerCars?.default || 0} voiture(s) · ${variant?.shortLabel || 'Voyageurs'}`;
}

function renderCompositionPart(type, src, alt = '') {
  return `<span class="composition-part composition-${type}"><img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy"></span>`;
}

function renderTrainCompositionStrip(train, model, size = 'large') {
  const spec = trainCompositionSpec(train, model);
  const c = train?.composition || {};
  const variant = selectedCompositionVariant(train, model);
  const parts = [];
  if (spec.mode === 'multiple_unit') {
    const count = Math.max(1, Number(c.powerUnits || 1));
    for (let i = 0; i < count; i += 1) parts.push(renderCompositionPart('power', COMPOSITION_ART.power, model.name));
  } else if (spec.mode === 'freight_loco') {
    const wagonArt = variant?.asset || COMPOSITION_ART.wagon;
    parts.push(renderCompositionPart('engine', COMPOSITION_ART.power, model.name));
    const count = Math.max(1, Number(c.freightCars || spec.freightCars?.default || 2));
    for (let i = 0; i < count; i += 1) parts.push(renderCompositionPart('wagon', wagonArt, variant?.name || 'Wagon fret'));
  } else {
    const coachArt = variant?.asset || COMPOSITION_ART.coach;
    parts.push(renderCompositionPart('engine', COMPOSITION_ART.power, model.name));
    const count = Math.max(1, Number(c.passengerCars || spec.passengerCars?.default || 1));
    for (let i = 0; i < count; i += 1) parts.push(renderCompositionPart('coach', coachArt, variant?.name || 'Voiture voyageurs'));
  }
  return `<div class="composition-strip ${size}">${parts.join('')}</div>`;
}

function renderCompositionModeTabs(train, model) {
  const spec = trainCompositionSpec(train, model);
  if (!spec.availableModes || spec.availableModes.length <= 1) return '';
  const labels = { passenger_loco: 'Voitures voyageurs', freight_loco: 'Wagons de marchandises' };
  return `
    <div class="composition-mode-tabs">
      ${spec.availableModes.map(mode => `<button type="button" class="composition-mode-tab ${spec.mode === mode ? 'active' : ''}" data-comp-mode="${mode}" data-id="${train.id}">${labels[mode] || mode}</button>`).join('')}
    </div>`;
}

function renderCompositionVariantPicker(train, model) {
  const spec = trainCompositionSpec(train, model);
  const variants = trainCompositionVariants(train, model);
  if (!variants.length) return '';
  const current = selectedCompositionVariant(train, model);
  const inputName = spec.mode === 'freight_loco' ? 'compFreightVariant' : 'compPassengerVariant';
  const heading = spec.mode === 'freight_loco' ? 'Type de wagon' : 'Type de voiture';
  const intro = spec.mode === 'freight_loco'
    ? 'Choisis la famille de wagons à exploiter. Chaque type détermine la marchandise prioritaire, la charge utile et la valeur de transport.'
    : 'Choisis la famille de voitures à accrocher à la locomotive. Chaque variante modifie capacité, confort, vitesse commerciale et coût d’exploitation.';

  return `
    <div class="composition-variant-section">
      <div class="composition-variant-heading">
        <strong>${heading}</strong>
        <span class="small muted">${intro}</span>
        <span class="small muted">D’autres variantes apparaissent à l’époque suivante après les recherches dédiées.</span>
      </div>
      <div class="composition-variant-grid">
        ${variants.map(variant => {
          const selected = current?.id === variant.id;
          const stats = variant.stats || {};
          const statRows = spec.mode === 'freight_loco'
            ? [
                renderVariantStatRow('Charge utile', variantMetricValue(stats.capacityMultiplier || 1), (stats.capacityMultiplier || 1) >= 1 ? 'good-text' : 'warn-text'),
                renderVariantStatRow('Valeur transportée', variantMetricValue(stats.revenueMultiplier || 1), (stats.revenueMultiplier || 1) >= 1 ? 'good-text' : 'warn-text'),
                renderVariantStatRow('Vitesse', variantMetricValue(stats.speedMultiplier || 1), (stats.speedMultiplier || 1) >= 1 ? 'good-text' : 'warn-text'),
                renderVariantStatRow('Coût maintenance', variantMetricValue(stats.maintenanceMultiplier || 1), (stats.maintenanceMultiplier || 1) <= 1 ? 'good-text' : 'warn-text')
              ].join('')
            : [
                renderVariantStatRow('Capacité', variantMetricValue(stats.capacityMultiplier || 1), (stats.capacityMultiplier || 1) >= 1 ? 'good-text' : 'warn-text'),
                renderVariantStatRow('Confort', variantMetricValue(1, stats.comfortDelta || 0, 'delta'), (stats.comfortDelta || 0) >= 0 ? 'good-text' : 'warn-text'),
                renderVariantStatRow('Vitesse', variantMetricValue(stats.speedMultiplier || 1), (stats.speedMultiplier || 1) >= 1 ? 'good-text' : 'warn-text'),
                renderVariantStatRow('Coût maintenance', variantMetricValue(stats.maintenanceMultiplier || 1), (stats.maintenanceMultiplier || 1) <= 1 ? 'good-text' : 'warn-text')
              ].join('');
          return `
            <label class="composition-variant-card">
              <input type="radio" name="${escapeAttr(inputName)}" value="${escapeAttr(variant.id)}" ${selected ? 'checked' : ''}>
              <div class="composition-variant-thumb">
                <img src="${escapeAttr(variant.asset || '')}" alt="${escapeAttr(variant.name)}" loading="lazy">
              </div>
              <div class="composition-variant-copy">
                <div class="composition-variant-title-row">
                  <strong>${escapeHtml(variant.name)}</strong>
                  ${variant.cargoType ? `<span class="tag">${escapeHtml(variant.cargoType)}</span>` : ''}
                </div>
                <p class="small muted">${escapeHtml(variant.description || '')}</p>
                <div class="composition-variant-stats">${statRows}</div>
              </div>
            </label>`;
        }).join('')}
      </div>
    </div>`;
}

function trainCurrentLine(trainId) {

  return app.state.me.lines.find(l => l.active && lineHasTrain(l, trainId)) || null;
}

function renderCompositionTrainListItem(train) {
  const model = app.state.balance.trains[train.modelId];
  const profile = previewOperatingProfile(train, model);
  const active = app.selectedCompositionTrainId === train.id;
  const line = trainCurrentLine(train.id);
  const inMaint = !!train.maintenance?.active;
  const canSell = !line && !inMaint;
  const statusLabel = line ? linePublicName(line) : inMaint ? 'En atelier' : 'Libre';
  const sellEstimate = trainResaleEstimateClient(train, model);
  return `
    <article class="composition-train-item ${active ? 'active' : ''}">
      <button type="button" class="composition-train-select" data-action="select-composition-train" data-id="${train.id}">
        <div class="composition-train-head">
          <strong>${escapeHtml(model.name)}</strong>
          <span class="tag" title="${escapeAttr(statusLabel)}">${escapeHtml(statusLabel)}</span>
        </div>
        <span class="small muted">${escapeHtml(deriveCompositionSummary(train))}</span>
        <div class="composition-mini-stats">
          <b>${formatInt(profile.capacity)} voy.</b>
          <b>${formatInt(profile.freight)} t</b>
          <b>${formatInt(profile.range)} km</b>
        </div>
      </button>
      <div class="composition-train-actions">
        <button type="button" class="danger ghost composition-sell-train-btn" data-action="sell-train" data-id="${train.id}" ${canSell ? '' : 'disabled'} ${tooltipAttr(canSell ? `Vendre ce train inutilisé. Estimation : ${money(sellEstimate)}.` : line ? 'Impossible : train affecté à une ligne active.' : 'Impossible : train en maintenance.')}>Vendre</button>
      </div>
    </article>
  `;
}


function compositionProfileWithChange(train, model, spec, key, value) {
  const clone = {
    ...train,
    composition: {
      ...(train.composition || {}),
      mode: spec.mode,
      [key]: value
    }
  };
  return previewOperatingProfile(clone, model);
}

function profileDeltaValue(next, current, key) {
  return Number(next?.[key] || 0) - Number(current?.[key] || 0);
}

function deltaSigned(value, suffix = '', decimals = 0) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const rounded = decimals ? round(abs) : Math.round(abs);
  return `${n > 0 ? '+' : n < 0 ? '-' : '±'}${rounded}${suffix}`;
}

function compositionDeltaClass(value, positiveIsGood = true) {
  const n = Number(value || 0);
  if (Math.abs(n) < 0.0001) return '';
  return (positiveIsGood ? n > 0 : n < 0) ? 'good-text' : 'warn-text';
}

function renderCompositionDeltaItem(label, value, suffix = '', positiveIsGood = true, decimals = 0) {
  return `
    <div class="composition-delta-item">
      <span>${escapeHtml(label)}</span>
      <b class="${compositionDeltaClass(value, positiveIsGood)}">${escapeHtml(deltaSigned(value, suffix, decimals))}</b>
    </div>`;
}

function renderCompositionMarginalImpact(train, model, spec, profile) {
  let key = '';
  let label = '';
  let current = 0;
  let max = 0;

  if (spec.mode === 'multiple_unit') {
    key = 'powerUnits';
    label = '+1 engin moteur';
    current = Number(train.composition?.powerUnits || spec.powerUnits?.default || 1);
    max = Number(spec.powerUnits?.max || current);
  } else if (spec.mode === 'freight_loco') {
    key = 'freightCars';
    label = '+1 wagon fret';
    current = Number(train.composition?.freightCars || spec.freightCars?.default || 0);
    max = Number(spec.freightCars?.max || current);
  } else {
    key = 'passengerCars';
    label = '+1 voiture voyageurs';
    current = Number(train.composition?.passengerCars || spec.passengerCars?.default || 0);
    max = Number(spec.passengerCars?.max || current);
  }

  if (!key || current >= max) {
    return `
      <div class="composition-delta-card">
        <div>
          <strong>Impact marginal</strong>
          <p class="small muted">La composition est déjà au maximum autorisé pour ce matériel.</p>
        </div>
      </div>`;
  }

  const nextProfile = compositionProfileWithChange(train, model, spec, key, current + 1);
  const capacityDelta = profileDeltaValue(nextProfile, profile, 'capacity');
  const freightDelta = profileDeltaValue(nextProfile, profile, 'freight');
  const speedDelta = profileDeltaValue(nextProfile, profile, 'speed');
  const energyDelta = profileDeltaValue(nextProfile, profile, 'energy');
  const maintenanceDelta = profileDeltaValue(nextProfile, profile, 'maintenance');
  const reliabilityDelta = profileDeltaValue(nextProfile, profile, 'reliability') * 100;
  const comfortDelta = profileDeltaValue(nextProfile, profile, 'comfort') * 100;

  return `
    <div class="composition-delta-card">
      <div class="composition-delta-head">
        <strong>Impact de ${escapeHtml(label)}</strong>
        <span class="small muted">Comparaison immédiate avant enregistrement.</span>
      </div>
      <div class="composition-delta-grid">
        ${renderCompositionDeltaItem('Voyageurs', capacityDelta, '', true)}
        ${renderCompositionDeltaItem('Fret', freightDelta, ' t', true)}
        ${renderCompositionDeltaItem('Vitesse', speedDelta, ' km/h', true)}
        ${renderCompositionDeltaItem('Énergie', energyDelta, '', false, 1)}
        ${renderCompositionDeltaItem('Maintenance', maintenanceDelta, '', false, 2)}
        ${renderCompositionDeltaItem('Fiabilité', reliabilityDelta, '%', true, 1)}
        ${renderCompositionDeltaItem('Confort', comfortDelta, '%', true, 1)}
      </div>
    </div>`;
}

function renderCompositionEditor(train) {
  if (!train) return '<p class="muted">Sélectionne un train à configurer.</p>';
  const model = app.state.balance.trains[train.modelId];
  const spec = trainCompositionSpec(train, model);
  const detailBundle = computeOperatingProfileDetailed(train, model);
  const profile = detailBundle.profile;
  const metricDetails = detailBundle.metrics;
  const composition = train.composition || {};
  const line = trainCurrentLine(train.id);
  const variant = selectedCompositionVariant(train, model);
  let quantityControl = '';
  let variantPanel = '';

  if (spec.mode === 'multiple_unit') {
    quantityControl = `
      <div class="composition-control-box">
        <div class="composition-control-head">
          <strong>Nombre d'engins moteurs</strong>
          <span class="small muted">Ajuste la longueur de rame.</span>
        </div>
        <div class="composition-control-row wide">
          <input id="compPowerUnits" type="range" min="${spec.powerUnits.min}" max="${spec.powerUnits.max}" value="${composition.powerUnits || spec.powerUnits.default}">
          <input id="compPowerUnitsValue" class="plain-input composition-number-input" type="number" min="${spec.powerUnits.min}" max="${spec.powerUnits.max}" value="${composition.powerUnits || spec.powerUnits.default}">
        </div>
      </div>`;
  } else if (spec.mode === 'freight_loco') {
    quantityControl = `
      <div class="composition-control-box">
        <div class="composition-control-head">
          <strong>Nombre de wagons fret</strong>
          <span class="small muted">Dose la capacité utile du convoi en fonction de la demande fret.</span>
        </div>
        <div class="composition-control-row wide">
          <input id="compFreightCars" type="range" min="${spec.freightCars.min}" max="${spec.freightCars.max}" value="${composition.freightCars || spec.freightCars.default}">
          <input id="compFreightCarsValue" class="plain-input composition-number-input" type="number" min="${spec.freightCars.min}" max="${spec.freightCars.max}" value="${composition.freightCars || spec.freightCars.default}">
        </div>
      </div>`;
    variantPanel = renderCompositionVariantPicker(train, model);
  } else {
    quantityControl = `
      <div class="composition-control-box">
        <div class="composition-control-head">
          <strong>Nombre de voitures voyageurs</strong>
          <span class="small muted">Ajuste la capacité offerte sans surcadencer la ligne.</span>
        </div>
        <div class="composition-control-row wide">
          <input id="compPassengerCars" type="range" min="${spec.passengerCars.min}" max="${spec.passengerCars.max}" value="${composition.passengerCars || spec.passengerCars.default}">
          <input id="compPassengerCarsValue" class="plain-input composition-number-input" type="number" min="${spec.passengerCars.min}" max="${spec.passengerCars.max}" value="${composition.passengerCars || spec.passengerCars.default}">
        </div>
      </div>`;
    variantPanel = renderCompositionVariantPicker(train, model);
  }

  return `
    <div class="composition-workshop-shell" style="background-image: linear-gradient(180deg, rgba(4,10,22,.74), rgba(4,10,22,.92)), url('${COMPOSITION_ART.workshop}');">
      <div class="fleet-card-heading">
        <div>
          <h2>Atelier de composition</h2>
          <p class="muted small">Ajuste la longueur utile du train et sélectionne les voitures / wagons spécialisés pour façonner précisément les performances de la rame.</p>
        </div>
        <span class="tag">${line ? `Affecté à ${escapeHtml(linePublicName(line))}` : 'Train libre'}</span>
      </div>

      ${renderCompositionModeTabs(train, model)}

      <div class="composition-editor-top">
        <div class="composition-train-card">
          ${renderTrainArt(model)}
          <div>
            <strong>${escapeHtml(model.name)}</strong>
            <p class="small muted">${escapeHtml(deriveCompositionSummary(train))}</p>
            <p class="small muted">Mode : ${spec.mode === 'multiple_unit' ? 'Rame multiple' : spec.mode === 'freight_loco' ? 'Locomotive + wagons' : 'Locomotive + voitures'}</p>
            ${variant ? `<p class="small muted">Variante active : <b>${escapeHtml(variant.name)}</b>${variant.cargoType ? ` · ${escapeHtml(variant.cargoType)}` : ''}</p>` : ''}
          </div>
        </div>
        <div class="composition-capacity-card">
          <b>Capacité réelle par train</b>
          <span>${formatInt(profile.capacity)} voyageurs · ${formatInt(profile.freight)} t fret</span>
          <span>${formatInt(profile.speed)} km/h · Portée ${formatInt(profile.range)} km</span>
          <span>Maintenance ${round(profile.maintenance)} · ${Math.round(profile.reliability * 100)}% fiabilité · ${Math.round(profile.comfort * 100)}% confort</span>
          ${variant ? `<span class="small muted">${escapeHtml(variant.description || '')}</span>` : ''}
        </div>
      </div>

      ${renderTrainCompositionStrip(train, model, 'large')}

      <div class="composition-stat-grid">
        ${compositionMetric('Voyageurs / train', formatInt(profile.capacity), buildMetricTooltip('Voyageurs / train', 'capacity', metricDetails.capacity), profile.capacity >= (model.capacity || 0) ? 'good-text' : '', `Base ${formatInt(metricDetails.capacity.base)}`)}
        ${compositionMetric('Fret / train', `${formatInt(profile.freight)} t`, buildMetricTooltip('Fret / train', 'freight', metricDetails.freight), profile.freight >= (model.freight || 0) ? 'good-text' : '', `Base ${formatInt(metricDetails.freight.base)} t`)}
        ${compositionMetric('Vitesse commerciale', `${formatInt(profile.speed)} km/h`, buildMetricTooltip('Vitesse commerciale', 'speed', metricDetails.speed), '', `Base ${formatInt(metricDetails.speed.base)} km/h`)}
        ${compositionMetric('Portée', `${formatInt(profile.range)} km`, buildMetricTooltip('Portée', 'range', metricDetails.range), profile.range >= (model.range || 0) ? 'good-text' : '', `Base ${formatInt(metricDetails.range.base)} km`)}
        ${compositionMetric('Fiabilité', `${Math.round(profile.reliability * 100)}%`, buildMetricTooltip('Fiabilité', 'reliability', metricDetails.reliability), profile.reliability >= 0.88 ? 'good-text' : '', `Base ${Math.round(metricDetails.reliability.base * 100)}%`)}
        ${compositionMetric('Confort', `${Math.round(profile.comfort * 100)}%`, buildMetricTooltip('Confort', 'comfort', metricDetails.comfort), profile.comfort >= 0.75 ? 'good-text' : '', `Base ${Math.round(metricDetails.comfort.base * 100)}%`)}
        ${compositionMetric('Énergie', round(profile.energy), buildMetricTooltip('Énergie', 'energy', metricDetails.energy), profile.energy <= (model.energy || 0) ? 'good-text' : 'warn-text', `Base ${round(metricDetails.energy.base)}`)}
      </div>

      ${renderCompositionMarginalImpact(train, model, spec, profile)}

      <div class="composition-controls refined-layout ${variantPanel ? 'has-variants' : ''}">
        <div class="composition-controls-top">
          ${quantityControl}
          <div class="composition-save-box">
            ${renderCompositionCostSummary(train)}
            <p class="small muted">Impact ligne : capacité d’exploitation = composition × trains affectés. Les variantes permettent de spécialiser ton offre voyageurs ou la marchandise transportée.</p>
            <button class="primary" data-action="save-train-composition" data-id="${train.id}">Enregistrer la composition</button>
          </div>
        </div>
        ${variantPanel ? `<div class="composition-variant-panel">${variantPanel}</div>` : ''}
      </div>
    </div>
  `;
}

function renderFleetCompositionPanel() {
  const me = app.state.me;
  if (!me.trains.length) {
    return `<div class="card"><h2>Compositions</h2><p class="muted">Achète d’abord un train dans le catalogue pour accéder à l’atelier de composition.</p></div>`;
  }
  if (!me.trains.some(t => t.id === app.selectedCompositionTrainId)) {
    app.selectedCompositionTrainId = me.trains[0].id;
    localStorage.setItem('sillons.selectedCompositionTrainId', app.selectedCompositionTrainId);
  }
  const selected = me.trains.find(t => t.id === app.selectedCompositionTrainId) || me.trains[0];
  const configurable = me.trains.filter(t => !!t.compositionSpec).length;
  const avgSeats = me.trains.length ? Math.round(me.trains.reduce((sum, t) => sum + trainRuntimeProfile(t).capacity, 0) / me.trains.length) : 0;

  return `
    <div class="fleet-composition-layout">
      <div class="card fleet-kpi-card composition-kpi-card">
        ${metric('Trains configurables', configurable)}
        ${metric('Capacité moyenne', `${avgSeats} voy.`)}
        ${metric('Sélection active', deriveCompositionSummary(selected), 'metric-value-selection')}
        ${metric('Lignes actives', me.lines.filter(l => l.active).length)}
      </div>

      <div class="card composition-list-card">
        <div class="fleet-card-heading">
          <div>
            <h2>Trains de la compagnie</h2>
            <p class="muted small">Sélectionne un matériel pour ajuster sa composition visuelle et opérationnelle.</p>
          </div>
          <span class="tag">${me.trains.length} unité(s)</span>
        </div>
        <div class="composition-train-list">
          ${me.trains.map(renderCompositionTrainListItem).join('')}
        </div>
      </div>

      <div class="card composition-editor-card">
        ${renderCompositionEditor(selected)}
      </div>
    </div>
  `;
}

function renderFleet() {
  const me = app.state.me;
  const active = ['catalog', 'maintenance', 'composition'].includes(app.activeFleetSubtab) ? app.activeFleetSubtab : 'catalog';
  const models = Object.values(app.state.balance.trains);
  const available = models.filter(t => trainModelUnlocked(t));
  const locked = models.filter(t => !trainModelUnlocked(t));
  const inWorkshop = me.trains.filter(t => t.maintenance?.active).length;
  const avgCondition = me.trains.length ? Math.round(me.trains.reduce((sum, t) => sum + Number(t.condition || 0), 0) / me.trains.length * 100) : 0;
  const heroTitle = active === 'catalog' ? 'Catalogue du matériel roulant' : active === 'maintenance' ? 'Maintenance du matériel' : 'Atelier de compositions';
  const heroText = active === 'catalog'
    ? 'Achète du matériel adapté à tes lignes : Capacité, vitesse, énergie, confort, fret ou fiabilité.'
    : active === 'maintenance'
      ? 'Choisis une politique d’entretien et planifie les interventions pour éviter l’usure excessive du parc.'
      : 'Allonge ou raccourcis les trains pour ajuster la capacité : voitures voyageurs, wagons fret et engins moteurs.';

  return `
    ${renderSectionHero('PARC FERROVIAIRE', heroTitle, heroText, ART.tabs.fleet, ['Matériel', 'Atelier', 'Compositions'])}

    <div class="fleet-workspace">
      <div class="fleet-subtabs" role="tablist" aria-label="Parc ferroviaire">
        <button type="button" data-fleet-subtab="catalog" class="${active === 'catalog' ? 'active' : ''}">
          <span>Catalogue</span>
          <b>${available.length} disponible(s)</b>
        </button>
        <button type="button" data-fleet-subtab="maintenance" class="${active === 'maintenance' ? 'active' : ''}">
          <span>Maintenance</span>
          <b>${inWorkshop} en atelier</b>
        </button>
        <button type="button" data-fleet-subtab="composition" class="${active === 'composition' ? 'active' : ''}">
          <span>Compositions</span>
          <b>${me.trains.length} train(s)</b>
        </button>
      </div>

      ${active === 'catalog' ? renderFleetCatalogPanel(available, locked) : active === 'maintenance' ? renderFleetMaintenancePanel(avgCondition, inWorkshop) : renderFleetCompositionPanel()}
    </div>
  `;
}

function renderFleetCatalogPanel(available, locked) {
  const me = app.state.me;
  const models = Object.values(app.state.balance.trains);
  const byEpoch = {};
  for (const model of models) (byEpoch[model.unlockEpoch] ||= []).push(model);

  return `
    <div class="fleet-catalog-layout">
      <div class="card fleet-kpi-card">
        ${metric('Budget achat', money(me.cash))}
        ${metric('Matériels achetables', available.length)}
        ${metric('Matériels verrouillés', locked.length)}
        ${metric('Époque actuelle', me.eraName)}
      </div>

      <div class="card rolling-stock-catalog fleet-catalog-card">
        <div class="fleet-card-heading">
          <div>
            <h2>Catalogue de matériel roulant</h2>
            <p class="muted small">Les cartes sont classées par époque. Utilise-les comme choix de stratégie : Économique, grande capacité, Fret, Vitesse, Confort ou Énergie propre.</p>
          </div>
          <span class="tag">${models.length} modèles</span>
        </div>

        <div class="era-catalog">
          ${Object.entries(byEpoch).map(([epoch, list]) => `
            <section class="era-block fleet-era-block">
              <div class="era-title">
                <strong>${escapeHtml(trainEraLabel(Number(epoch)))}</strong>
                <span class="tag">${list.length} matériels</span>
              </div>
              <div class="train-card-grid fleet-catalog-grid">
                ${list.sort((a,b) => a.price - b.price).map(model => renderTrainCatalogItem(model, trainModelUnlocked(model))).join('')}
              </div>
            </section>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderFleetMaintenancePanel(avgCondition, inWorkshop) {
  const me = app.state.me;
  const free = me.trains.filter(t => !t.maintenance?.active && !me.lines.some(l => l.active && lineHasTrain(l, t.id))).length;
  const assigned = me.trains.filter(t => me.lines.some(l => l.active && lineHasTrain(l, t.id))).length;

  return `
    <div class="fleet-maintenance-layout">
      <div class="card fleet-kpi-card">
        ${metric('État moyen', `${avgCondition}%`, avgCondition >= 70 ? 'good-text' : avgCondition >= 45 ? '' : 'bad-text')}
        ${metric('En atelier', inWorkshop)}
        ${metric('Affectés', assigned)}
        ${metric('Libres', free)}
      </div>

      ${renderMaintenancePolicyCard()}

      <div class="card fleet-bulk-maintenance-card">
        <div class="fleet-card-heading">
          <div>
            <h2>Maintenance globale</h2>
            <p class="muted small">Envoie en une seule action tous les trains éligibles en révision atelier. Les trains déjà en atelier ou presque neufs sont ignorés.</p>
          </div>
          <button class="danger confirm-danger" data-action="repair-all-trains" data-mode="standard" ${me.trains.length ? '' : 'disabled'}>Tout envoyer en maintenance</button>
        </div>
      </div>

      <div class="card fleet-owned-card">
        <div class="fleet-card-heading">
          <div>
            <h2>Parc de la compagnie</h2>
            <p class="muted small">Lance les interventions depuis les cartes de matériel. Un train usé perd en vitesse et en ponctualité. À 0 %, il est immobilisé et sa ligne ne produit plus rien.</p>
          </div>
          <span class="tag">${me.trains.length} unité(s)</span>
        </div>
        <div class="owned-train-grid fleet-owned-grid">
          ${me.trains.map(t => renderOwnedTrain(t)).join('') || '<p class="muted">Aucun matériel.</p>'}
        </div>
      </div>
    </div>
  `;
}

function renderMaintenancePolicyCard() {
  const me = app.state.me;
  const policies = app.state.balance.maintenancePolicies || {};
  return `
    <div class="card fleet-policy-card">
      <div class="fleet-card-heading">
        <div>
          <h2>Politique de maintenance</h2>
          <p class="muted small">La politique influence l’usure, les coûts récurrents et la fiabilité du parc en exploitation.</p>
        </div>
        <span class="tag good">${escapeHtml(policies[me.maintenancePolicy]?.name || 'Active')}</span>
      </div>
      <div class="maintenance-policy-grid">
        ${Object.values(policies).map(policy => `
          <article class="maintenance-policy-card ${me.maintenancePolicy === policy.id ? 'active' : ''}">
            <div class="policy-head">
              <strong>${escapeHtml(policy.name)}</strong>
              <span class="tag ${me.maintenancePolicy === policy.id ? 'good' : ''}">${me.maintenancePolicy === policy.id ? 'Active' : 'Choix'}</span>
            </div>
            <p class="small muted">${escapeHtml(policy.description)}</p>
            <div class="policy-stats">
              <div><span>Coût</span><b>×${round(policy.costMultiplier)}</b></div>
              <div><span>Usure</span><b>×${round(policy.wearMultiplier)}</b></div>
              <div><span>Fiabilité</span><b>${policy.reliabilityBonus >= 0 ? '+' : ''}${Math.round(policy.reliabilityBonus * 100)} pts</b></div>
            </div>
            <button data-action="maintenance-policy" data-id="${policy.id}" ${tooltipAttr(maintenancePolicyTooltip(policy))} ${me.maintenancePolicy === policy.id ? 'disabled' : ''}>${me.maintenancePolicy === policy.id ? 'Politique active' : 'Appliquer'}</button>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function trainModelRequiredTechLevel(model) {
  return Math.max(1, Math.floor(Number(model.requiredTechLevel || 1)));
}

function trainModelResearchRequirementLabel(model) {
  if (!model.requiredTech) return 'Aucune recherche';
  return `${techNodeTitle(model.requiredTech)} niv. ${trainModelRequiredTechLevel(model)}`;
}

function trainModelEpochRequirementChip(model) {
  const requiredEpoch = Math.max(0, Number(model.unlockEpoch || 0));
  const currentEpoch = Math.max(0, Number(app.state.me?.epoch || 0));
  const ok = currentEpoch >= requiredEpoch;
  const label = trainEraLabel(requiredEpoch);
  const tip = ok
    ? `Ère requise atteinte : ${label}.`
    : `Ère requise : ${label}. Ère actuelle : ${trainEraLabel(currentEpoch)}.`;
  return `<span class="research-prereq train-prereq-chip ${ok ? 'met' : 'missing'}" ${tooltipAttr(tip)}><small>Ère</small>${escapeHtml(label)}</span>`;
}

function trainModelResearchRequirementChip(model) {
  if (!model.requiredTech) {
    return '<span class="research-prereq train-prereq-chip met"><small>Recherche</small>Aucune</span>';
  }
  const requiredLevel = trainModelRequiredTechLevel(model);
  const currentLevel = techLevel(model.requiredTech);
  const ok = currentLevel >= requiredLevel;
  const techTitle = techNodeTitle(model.requiredTech);
  const label = `${techTitle} · niv. ${formatInt(currentLevel)}/${formatInt(requiredLevel)}`;
  const tip = ok
    ? `${techTitle} niveau ${requiredLevel} atteint.`
    : `${techTitle} requis au niveau ${requiredLevel}. Niveau actuel : ${currentLevel}.`;
  if (ok) {
    return `<span class="research-prereq train-prereq-chip met" ${tooltipAttr(tip)}><small>Recherche</small>${escapeHtml(label)}</span>`;
  }
  return `<button type="button" class="research-prereq train-prereq-chip missing" data-action="focus-research" data-id="${escapeAttr(model.requiredTech)}" ${tooltipAttr(tip)}><small>Recherche</small>${escapeHtml(label)}</button>`;
}


function trainResearchEra(model) {
  return Math.max(1, Number(model?.unlockEpoch || 0) + 1);
}

function normalizeResearchEffectTextClient(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseResearchNumericEffectsClient(effectText) {
  const text = normalizeResearchEffectTextClient(effectText);
  if (!text || text.includes('niveaux suivants') || text.includes('aucune fonctionnalite')) return [];
  const regex = /([+-])\s*(\d+(?:[.,]\d+)?)\s*%\s*(portee|autonomie|vitesse max|fiabilite|consommation|impact environnemental|rentabilite)/g;
  const effects = [];
  let match;
  while ((match = regex.exec(text))) {
    const sign = match[1] === '-' ? -1 : 1;
    const rawValue = Number(String(match[2]).replace(',', '.')) / 100;
    const label = match[3];
    const kind = (
      label === 'vitesse max' ? 'speed' :
      label === 'fiabilite' ? 'reliability' :
      label === 'consommation' ? 'energy' :
      label === 'impact environnemental' ? 'environment' :
      label === 'rentabilite' ? 'profitability' :
      label === 'autonomie' ? 'autonomy' :
      'range'
    );
    effects.push({ kind, value: sign * rawValue });
  }
  return effects;
}

function researchNodesForEraClient(era) {
  const nodes = [];
  for (const group of Object.values(app.state?.balance?.techTree || {})) {
    for (const node of group.nodes || []) {
      if (Number(node.era || 0) === Number(era)) nodes.push(node);
    }
  }
  return nodes;
}

function trainInheritedResearchBonus(model) {
  const modifiers = { speed: 1, range: 1, autonomy: 1, reliability: 1, energy: 1, environment: 1, profitability: 1 };
  const sources = [];
  const effects = [];
  for (const node of researchNodesForEraClient(trainResearchEra(model))) {
    const level = techLevel(node.id);
    if (level <= 0) continue;
    const units = researchLevelEffectUnitsClient(level);
    const nodeEffects = [];
    for (const effectText of node.improves || []) {
      for (const effect of parseResearchNumericEffectsClient(effectText)) {
        const multiplier = Math.max(0.08, 1 + effect.value * units);
        modifiers[effect.kind] *= multiplier;
        nodeEffects.push({
          kind: effect.kind,
          rawValue: effect.value,
          units,
          multiplier,
          signedPercent: signedPercentFromMultiplier(multiplier, effect.kind === 'energy' || effect.kind === 'environment')
        });
      }
    }
    if (nodeEffects.length) {
      const source = { title: node.title, level, effects: nodeEffects };
      sources.push(source);
      for (const item of nodeEffects) effects.push({ ...item, title: node.title, level });
    }
  }
  return { modifiers, sources, effects };
}

function signedPercentFromMultiplier(multiplier, inverse = false) {
  const value = inverse ? (1 - multiplier) : (multiplier - 1);
  const pct = Math.round(value * 1000) / 10;
  if (Math.abs(pct) < 0.05) return '';
  return `${pct > 0 ? '+' : ''}${pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}%`;
}

function effectiveModelWithResearchClient(model) {
  const { modifiers } = trainInheritedResearchBonus(model);
  const rangeMultiplier = model.energyType === 'battery'
    ? modifiers.range * modifiers.autonomy
    : modifiers.range;
  return {
    ...model,
    speed: Math.max(20, Math.round(Number(model?.speed || 0) * modifiers.speed)),
    range: Math.max(1, Math.round(Number(model?.range || 0) * rangeMultiplier)),
    reliability: clamp(Number(model?.reliability || 0) * modifiers.reliability, 0.18, 0.995),
    energy: Math.max(0.01, round(Number(model?.energy || 0) * modifiers.energy)),
    researchModifiers: modifiers
  };
}

function trainEffectiveCatalogRange(model) {
  return effectiveModelWithResearchClient(model).range;
}

function renderTrainInheritedResearchBonuses(model) {
  const { modifiers, sources } = trainInheritedResearchBonus(model);
  const autonomyOrRange = model.energyType === 'battery'
    ? ['Autonomie', modifiers.autonomy * modifiers.range, false]
    : ['Portée', modifiers.range, false];
  const items = [
    autonomyOrRange,
    ['Vitesse max', modifiers.speed, false],
    ['Fiabilité', modifiers.reliability, false],
    ['Consommation', modifiers.energy, true],
    ['Impact env.', modifiers.environment, true],
    ['Rentabilité', modifiers.profitability, false]
  ]
    .map(([label, multiplier, inverse]) => ({ label, value: signedPercentFromMultiplier(multiplier, inverse) }))
    .filter(item => item.value);

  if (!items.length) {
    return `
      <div class="train-research-bonus-panel empty">
        <div class="train-research-bonus-title">Bonus recherches hérités</div>
        <span>Aucun bonus actif pour cette ère</span>
      </div>
    `;
  }

  const sourceLabel = sources.slice(0, 3).map(src => `${src.title} niv. ${src.level}`).join(' · ');
  const more = sources.length > 3 ? ` · +${sources.length - 3}` : '';
  return `
    <div class="train-research-bonus-panel">
      <div class="train-research-bonus-title">Bonus recherches hérités</div>
      <div class="train-research-bonus-grid">
        ${items.map(item => `<span><small>${escapeHtml(item.label)}</small><b>${escapeHtml(item.value)}</b></span>`).join('')}
      </div>
      <p>${escapeHtml(sourceLabel + more)}</p>
    </div>
  `;
}

function renderTrainRequirementPills(model) {
  return `
    <div class="train-prereq-panel">
      <div class="train-prereq-title">Prérequis</div>
      <div class="research-prereqs train-requirements compact">
        ${trainModelEpochRequirementChip(model)}
        ${trainModelResearchRequirementChip(model)}
      </div>
    </div>
  `;
}

function renderTrainCatalogItem(model, buyable) {
  const reason = trainModelLockedReason(model);
  const effective = effectiveModelWithResearchClient(model);
  const effectiveRange = effective.range;
  return `
    <div class="list-item train-catalog-card ${buyable ? 'buyable' : 'locked'}">
      ${renderTrainArt(model)}
      <div class="train-card-body">
        <div class="item-title">
          <strong>${escapeHtml(model.name)}</strong>
          <span class="tag ${buyable ? 'good' : 'warn'}">${buyable ? money(model.price) : 'À débloquer'}</span>
        </div>
        <p class="small muted">${escapeHtml(model.description || trainStrengths(model))}</p>
        <div class="train-stat-grid">
          ${renderTrainStat('Vitesse', `${model.speed} km/h`, model.speed / 420, model.speed >= 250 ? 'good' : '', `${effective.speed} km/h`, effective.speed / 420)}
          ${renderTrainStat('Portée', `${formatInt(model.range)} km`, (model.range || 0) / 1400, effectiveRange >= 900 ? 'good' : '', `${formatInt(effectiveRange)} km`, effectiveRange / 1400)}
          ${renderTrainStat('Voyageurs', `${model.capacity}`, model.capacity / 1100, model.capacity >= 650 ? 'good' : '')}
          ${renderTrainStat('Fret', `${model.freight} t`, model.freight / 2200, model.freight >= 900 ? 'good' : '')}
          ${renderTrainStat('Fiabilité', `${Math.round(model.reliability * 100)}%`, model.reliability, effective.reliability >= 0.92 ? 'good' : '', `${Math.round(effective.reliability * 100)}%`, effective.reliability)}
          ${renderTrainStat('Confort', `${Math.round(model.comfort * 100)}%`, model.comfort, model.comfort >= 0.8 ? 'good' : '')}
          ${renderTrainStat('Maint./h', maintenanceHourlyRange(model), 1 - Math.min(1, model.maintenance / 1.3), model.maintenance <= 0.45 ? 'good' : 'warn')}
        </div>
        ${renderTrainRequirementPills(model)}
        ${renderTrainInheritedResearchBonuses(model)}
        <div class="actions">
          <button class="primary" data-action="buy-train" data-id="${model.id}" ${tooltipAttr(`Achète ${model.name}. Coût : ${money(model.price)}. ${model.description || ''} Vitesse : ${model.speed} km/h. Capacité : ${model.capacity} voyageurs. Fret : ${model.freight} t. Fiabilité : ${Math.round(model.reliability * 100)}%.`)} ${buyable ? '' : 'disabled'}>Acheter</button>
        </div>
      </div>
    </div>
  `;
}



function renderOwnedTrain(train) {
  const model = app.state.balance.trains[train.modelId];
  const line = app.state.me.lines.find(l => l.active && lineHasTrain(l, train.id));
  const maint = train.maintenance || {};
  const inMaint = !!maint.active;
  const actions = app.state.balance.maintenanceActions || {};
  const condition = Math.round((train.condition || 0) * 100);
  const conditionClass = condition > 70 ? 'good' : condition > 40 ? 'warn' : 'bad';
  const profile = previewOperatingProfile(train, model);
  const sellTip = line
    ? 'Impossible de vendre : Ce train est affecté à une ligne active.'
    : inMaint
      ? 'Impossible de vendre : Ce train est en maintenance.'
      : `Vend ce train d’occasion. Valeur influencée par son état (${condition}%).`;

  return `
    <div class="list-item owned-train-card">
      ${renderTrainArt(model)}
      <div class="owned-train-body">
        <div class="item-title">
          <strong>${escapeHtml(model.name)}</strong>
          <span class="tag ${inMaint ? 'warn' : condition <= 0 ? 'bad' : line ? 'good' : ''}">${inMaint ? 'En atelier' : condition <= 0 ? 'Immobilisé' : line ? 'En service' : 'Libre'}</span>
        </div>
        <p class="small muted">${escapeHtml(model.description || trainStrengths(model))}</p>
        <div class="train-condition-head">
          <span>État ${condition}%</span>
          <b class="${conditionClass}-text">${escapeHtml(trainProjectionLabel(train))}</b>
        </div>
        <div class="progress train-condition-bar ${conditionClass}"><i style="width:${condition}%"></i></div>
        <div class="kv" style="margin-top:8px">
          <span>Affectation</span><b>${line ? escapeHtml(linePublicName(line)) : 'Libre'}</b>
          <span>Disponibilité</span><b>${inMaint ? `${escapeHtml(maint.label || 'Maintenance')} · ${formatCycles(maint.daysLeft)}` : 'Disponible'}</b>
          <span>Usure historique</span><b>${formatInt(train.age)} cycles</b>
          <span>Composition</span><b>${escapeHtml(deriveCompositionSummary(train))}</b>
          <span>Capacité</span><b>${formatInt(profile.capacity)} voy. / ${formatInt(profile.freight)} t</b>
          <span>Portée</span><b>${formatInt(profile.range)} km</b>
          <span>Maintenance</span><b>${maintenanceHourlyRange(profile, line ? lineDistance(line) : 100, 1, train.condition)}</b>
          <span>Dernier service</span><b>${maint.lastServiceDay || train.acquiredDay ? 'Effectué' : '-'}</b>
        </div>
        ${renderTrainInheritedResearchBonuses(model)}
        <div class="owned-train-composition-preview">
          ${renderTrainCompositionStrip(train, model, 'mini')}
        </div>
        ${inMaint ? `
          <p class="small muted">Le train est immobilisé. Toute ligne qui l’utilise reste ouverte mais ne produit rien jusqu’à la fin de l’intervention.</p>
        ` : `
          <div class="maintenance-actions">
            ${Object.values(actions).map(action => renderMaintenanceButton(train, model, action)).join('')}
          </div>
        `}
        <div class="actions">
          <button data-action="open-composition" data-id="${train.id}">Composition</button>
          <button class="danger" data-action="sell-train" data-id="${train.id}" ${tooltipAttr(sellTip)} ${line || inMaint ? 'disabled' : ''}>Vendre</button>
        </div>
      </div>
    </div>
  `;
}

function renderMaintenanceButton(train, model, action) {
  const locked = maintenanceActionLockedReason(action);
  const preview = maintenancePreview(train, model, action);
  const targetCondition = Math.max(train.condition, Math.min(action.target || 0.99, train.condition + action.restore));
  const disabled = locked || targetCondition <= train.condition + 0.005;
  return `
    <button class="maintenance-btn" data-action="repair-train" data-id="${train.id}" data-mode="${action.id}" ${tooltipAttr(`${action.name}. ${action.description || ''} ${preview}. Effet : Immobilise le train pendant l’intervention, puis remonte son état, sa vitesse effective et sa ponctualité.`)} ${disabled ? 'disabled' : ''}>
      <strong>${escapeHtml(action.name)}</strong>
      <span>${preview}</span>
      ${locked ? `<em>${escapeHtml(locked)}</em>` : ''}
    </button>
  `;
}

function renderStations() {
  const me = app.state.me;
  const selected = app.selectedStation ? station(app.selectedStation) : null;
  const stationSearchValue = stationSearchDisplayValue(selected);
  const ownedEntries = sortOwnedStationEntries(Object.entries(me.stations || {}));
  const collapsed = app.ownedStationsCollapsed;
  return `
    ${renderSectionHero('AMÉNAGEMENT DU RÉSEAU', 'Gestion des gares', 'Développe les pôles voyageurs, les ateliers et les dépôts tout en gardant la sélection de gare stable côté interface.', ART.tabs.stations, ['Niveaux', 'Commerces', 'Ateliers'])}

    <div class="card">
      <h2>Gare sélectionnée</h2>
      <div class="station-management-search">
        <div class="station-search-header">
          <label class="station-search-label">Rechercher une gare à améliorer
            <div class="station-search" data-role="station">
              <input id="lineStationSearch" class="station-search-input" data-role="station" value="${escapeAttr(stationSearchValue)}" placeholder="Ex : Caen, Bayeux, Lisieux..." autocomplete="off">
              <input id="lineStation" type="hidden" value="${escapeAttr(app.stationSearch.candidateId || app.selectedStation || '')}">
              <div id="lineStationSuggestions" class="station-suggestions" role="listbox"></div>
            </div>
          </label>
          <label class="station-sort-inline">Tri des villes
            <select id="stationSort">
              ${stationSortOptions(app.stationSortMode)}
            </select>
          </label>
        </div>
      </div>
      <div id="selectedStationPanel" style="margin-top:10px">
        ${renderSelectedStationPanel()}
      </div>
    </div>

    ${renderStationAgentsCard()}

    <div class="card station-owned-card ${collapsed ? 'collapsed' : ''}">
      <button type="button" class="research-era-heading station-owned-heading" data-action="toggle-owned-stations" aria-expanded="${collapsed ? 'false' : 'true'}">
        <span class="research-era-title">
          <span class="research-era-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
          <span>Gares exploitées</span>
        </span>
        <span class="research-era-meta">${ownedEntries.length} gare${ownedEntries.length > 1 ? 's' : ''} · ${collapsed ? 'Déplier' : 'Réduire'}</span>
      </button>
      ${collapsed ? '' : `
        <div class="station-owned-toolbar">
          <label>Trier les gares
            <select id="ownedStationSort">${ownedStationSortOptions(app.ownedStationSortMode)}</select>
          </label>
        </div>
        <div class="station-owned-grid">
          ${ownedEntries.map(([id, asset]) => renderStationAsset(station(id), asset)).join('') || '<p class="muted">Aucune gare exploitée.</p>'}
        </div>`}
    </div>
  `;
}

function renderStationAgentsCard() {
  const me = app.state.me;
  const need = Math.max(0, Number(staffNeed('stationAgents') || 0));
  const owned = Number(me.staff?.stationAgents || 0);
  const pct = need <= 0 ? 100 : Math.max(0, Math.min(100, Math.round(owned / need * 100)));
  const status = pct >= 100 ? 'good' : pct >= 60 ? 'warn' : 'bad';
  const activeLines = me.lines.filter(line => line.active).length;
  const stationCount = Object.keys(me.stations || {}).length;
  const intermediateStops = me.lines
    .filter(line => line.active)
    .reduce((sum, line) => sum + Math.max(0, lineStopsOf(line).length - 2), 0);
  return `
    <div class="card station-agents-card ${status}">
      <h2>Agents de gare</h2>
      <p class="muted small">Les Agents de gare ne sont plus affichés dans les besoins propres à chaque ligne. Ils sont dimensionnés ici, selon les gares exploitées, les lignes actives et les arrêts intermédiaires.</p>
      <div class="line-role-bar ${status}">
        <div class="line-role-bar-head">
          <span>Agents de gare ${formatInt(owned)} / ${formatInt(need)}</span>
          <b class="${status}-text">${pct}%</b>
        </div>
        <i><em style="width:${pct}%"></em></i>
      </div>
      <div class="kv station-agents-kv">
        <span>Gares exploitées</span><b>${formatInt(stationCount)}</b>
        <span>Lignes actives</span><b>${formatInt(activeLines)}</b>
        <span>Arrêts intermédiaires</span><b>${formatInt(intermediateStops)}</b>
        <span>Effet</span><b>Satisfaction + flux voyageurs</b>
      </div>
    </div>
  `;
}

function renderSelectedStationPanel() {
  const selected = app.selectedStation ? station(app.selectedStation) : null;
  if (!selected) return '<p class="muted">Écris le nom d’une gare pour l’afficher, ou clique une gare sur la carte.</p>';
  return renderSelectedStation(selected);
}

function updateSelectedStationPanel() {
  const panel = $('#selectedStationPanel');
  if (panel) panel.innerHTML = renderSelectedStationPanel();
}

function renderSelectedStation(s) {
  const owner = stationOwnerClient(s.id);
  const ownedByMe = owner?.player?.id === app.state.me.id;
  const asset = ownedByMe ? app.state.me.stations[s.id] : owner?.asset || null;
  const preview = asset || { level: 1, commerce: 0, maintenance: 0, depot: false, electrified: false };
  const cash = app.state.me.cash;
  const lockedByOwner = owner && !ownedByMe;
  const unowned = !owner;
  const acquisitionCost = stationAcquisitionCost(s);
  const upgrades = [
    { kind: 'level', label: asset ? `Niveau +1` : 'Acheter', maxed: asset ? preview.level >= 5 : false, cost: asset ? stationUpgradeCost(s, preview, 'level') : acquisitionCost },
    { kind: 'commerce', label: 'Commerces', maxed: unowned || preview.commerce >= 4, cost: stationUpgradeCost(s, preview, 'commerce') },
    { kind: 'maintenance', label: 'Atelier', maxed: unowned || preview.maintenance >= 4, cost: stationUpgradeCost(s, preview, 'maintenance') },
    { kind: 'depot', label: 'Dépôt', maxed: unowned || !!preview.depot, cost: stationUpgradeCost(s, preview, 'depot') }
  ];
  return `
    <div class="list-item selected-station-card">
      <div class="item-title"><strong>${escapeHtml(s.name)}</strong><span class="tag">${owner ? `Propriétaire : ${escapeHtml(owner.player.name)}` : 'Ville libre'}</span></div>
      <div class="kv">
        <span>Demande voyageurs</span><b>${formatInt(s.baseDemand)}</b>
        <span>Demande fret</span><b>${formatInt(s.freight)}</b>
        <span>Population</span><b>${s.population ? formatInt(s.population) : '—'}</b>
        ${s.annualPassengers ? `<span>Fréquentation ${s.passengerTrafficYear || 2024}</span><b>${formatInt(s.annualPassengers)} voy./an</b>` : ''}
        <span>Prix d'achat</span><b>${money(acquisitionCost)}</b>
        <span>Niveau gare</span><b>${asset ? asset.level : 'Non possédée'}</b>
        <span>Commerces</span><b>${asset ? asset.commerce : 0}/4</b>
        <span>Atelier</span><b>${asset ? asset.maintenance : 0}/4</b>
        <span>Dépôt</span><b>${asset?.depot ? 'Oui' : 'Non'}</b>
        <span>Électrifiée</span><b>${asset?.electrified ? 'Oui' : 'Non'}</b>
        ${asset ? `<span>Remboursement vente</span><b>${money(stationSaleRefundBreakdown(s, asset).total)}</b>` : ''}
        ${asset ? stationOperatingCostRows(asset) : ''}
      </div>
      <div class="actions station-upgrades">
        ${upgrades.map(up => `
          <button data-action="upgrade-station" data-kind="${up.kind}" data-id="${s.id}" ${tooltipAttr(lockedByOwner ? `Cette ville appartient déjà à ${owner.player.name}.` : stationUpgradeTooltip(s, preview, up))} ${lockedByOwner || up.maxed || cash < up.cost ? 'disabled' : ''}>
            ${escapeHtml(up.label)} <span>${!asset && up.kind !== 'level' ? 'Verrouillé' : up.maxed ? 'Max' : money(up.cost)}</span>
          </button>
        `).join('')}
        ${ownedByMe ? `<button class="danger" data-action="sell-station" data-id="${s.id}" ${tooltipAttr(stationSaleTooltip(s, asset))} ${activeStationUsersClient(s.id).length ? 'disabled' : ''}>Vendre <span>${money(stationSaleRefundBreakdown(s, asset).total)}</span></button>` : ''}
      </div>
      ${lockedByOwner ? `<p class="muted small">Cette ville est possédée par ${escapeHtml(owner.player.name)}. Tu peux l’utiliser avec un péage de gare si ta ligne la dessert.</p>` : asset ? '<p class="muted small">Ville possédée par ta compagnie. Les concurrents paieront un péage s’ils la desservent.</p>' : '<p class="muted small">Première action : Acheter la ville. Elle deviendra ensuite utilisable pour ouvrir des lignes.</p>'}
    </div>
  `;
}


function stationPriceFromAnnualPassengers(annualPassengers) {
  const passengers = Math.max(0, Number(annualPassengers || 0));
  if (!Number.isFinite(passengers) || passengers <= 0) return 0;
  return Math.round(100000 + Math.pow(passengers / 1000000, 1.25) * 35000);
}

function stationAcquisitionCost(s) {
  const annualPassengers = Number(s?.annualPassengers || s?.passengers2024 || 0);
  if (s?.majorTerminal && Number.isFinite(annualPassengers) && annualPassengers > 0) return stationPriceFromAnnualPassengers(annualPassengers) * 50;
  const storedPurchaseCost = Number(s?.purchaseCost || s?.acquisitionCost || 0);
  if (Number.isFinite(storedPurchaseCost) && storedPurchaseCost > 0) return Math.round(storedPurchaseCost);
  if (Number.isFinite(annualPassengers) && annualPassengers > 0) return stationPriceFromAnnualPassengers(annualPassengers);
  if (s?.custom) {
    const stored = Number(s.creationCost || s.purchaseCost || 0);
    if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
    return Math.round(65000 * app.state.game.market.steel);
  }
  const population = Number(s?.population || 0);
  if (population > 0) {
    return Math.round((120000 + population * 3.2 + Math.pow(population, 1.12) * 0.9) * app.state.game.market.steel);
  }
  const demand = Number(s?.baseDemand || 80);
  return Math.round((75000 + Math.pow(demand, 1.18) * 1050) * app.state.game.market.steel);
}

function stationSortOptions(selected = 'alpha') {
  const options = [
    ['alpha', 'Alphabétique'],
    ['priceAsc', 'Prix croissant'],
    ['priceDesc', 'Prix décroissant'],
    ['demandDesc', 'Demande voyageurs']
  ];
  return options.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}

function ownedStationSortOptions(selected = 'alpha') {
  const options = [
    ['alpha', 'Alphabétique'],
    ['costDesc', 'Coût / valeur'],
    ['levelDesc', 'Niveau']
  ];
  return options.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}

function sortOwnedStationEntries(entries, mode = app.ownedStationSortMode) {
  const collator = new Intl.Collator('fr', { sensitivity: 'base' });
  const decorated = entries
    .map(([id, asset]) => ({ id, asset, station: station(id) }))
    .filter(item => item.station);
  const byName = (a, b) => collator.compare(a.station.name || '', b.station.name || '');
  if (mode === 'costDesc') {
    decorated.sort((a, b) => stationAcquisitionCost(b.station) - stationAcquisitionCost(a.station) || byName(a, b));
  } else if (mode === 'levelDesc') {
    decorated.sort((a, b) => Number(b.asset?.level || 1) - Number(a.asset?.level || 1) || byName(a, b));
  } else {
    decorated.sort(byName);
  }
  return decorated.map(item => [item.id, item.asset]);
}

function stationSortPrice(s) {
  return stationAcquisitionCost(s);
}

function sortStationsForPurchase(list, mode = app.stationSortMode) {
  const stations = [...(list || [])];
  const collator = new Intl.Collator('fr', { sensitivity: 'base' });
  const byName = (a, b) => collator.compare(a.name || '', b.name || '');
  const byPrice = (a, b) => stationSortPrice(a) - stationSortPrice(b);
  const byDemand = (a, b) => Number(b.baseDemand || 0) - Number(a.baseDemand || 0) || byName(a, b);

  if (mode === 'priceAsc') return stations.sort((a, b) => byPrice(a, b) || byName(a, b));
  if (mode === 'priceDesc') return stations.sort((a, b) => byPrice(b, a) || byName(a, b));
  if (mode === 'demandDesc') return stations.sort(byDemand);
  return stations.sort(byName);
}

function stationPurchaseStatusLabel(s) {
  const owner = stationOwnerClient(s.id);
  if (!owner) return 'Libre';
  if (owner.player.id === app.state?.me?.id) return 'À toi';
  return `Possédée par ${owner.player.name}`;
}

function stationPurchaseMetaLabel(s) {
  return `${stationMetaLabel(s)} · Achat ${money(stationSortPrice(s))} · ${stationPurchaseStatusLabel(s)}`;
}

function stationUpgradeCost(s, asset, kind) {
  if (kind === 'level') return Math.round((85000 + s.baseDemand * 55) * asset.level * app.state.game.market.steel);
  if (kind === 'commerce') return Math.round(50000 * (asset.commerce + 1) * asset.level);
  if (kind === 'maintenance') return Math.round(90000 * (asset.maintenance + 1) * asset.level);
  if (kind === 'depot') return 180000;
  return 0;
}

function stationSaleRefundBreakdown(s, asset = {}) {
  const normalized = {
    level: Math.max(1, Math.min(5, Math.floor(Number(asset.level || 1)))),
    commerce: Math.max(0, Math.min(4, Math.floor(Number(asset.commerce || 0)))),
    maintenance: Math.max(0, Math.min(4, Math.floor(Number(asset.maintenance || 0)))),
    depot: Boolean(asset.depot)
  };
  const acquisition = stationAcquisitionCost(s);
  let levels = 0;
  for (let level = 1; level < normalized.level; level++) levels += stationUpgradeCost(s, { ...normalized, level }, 'level');
  let commerces = 0;
  for (let commerce = 0; commerce < normalized.commerce; commerce++) commerces += stationUpgradeCost(s, { ...normalized, commerce }, 'commerce');
  let maintenance = 0;
  for (let step = 0; step < normalized.maintenance; step++) maintenance += stationUpgradeCost(s, { ...normalized, maintenance: step }, 'maintenance');
  const depot = normalized.depot ? stationUpgradeCost(s, normalized, 'depot') : 0;
  const total = Math.round(acquisition + levels + commerces + maintenance + depot);
  return { acquisition, levels, commerces, maintenance, depot, total };
}

function activeStationUsersClient(stationId) {
  const users = [];
  for (const player of app.state?.players || []) {
    for (const line of player.lines || []) {
      if (!line?.active) continue;
      if (lineStopsOf(line).includes(stationId)) users.push({ player, line });
    }
  }
  return users;
}

function stationSaleTooltip(s, asset) {
  const users = activeStationUsersClient(s.id);
  if (users.length) {
    const first = users[0];
    return `Vente impossible : ${s.name} est encore desservie par ${lineDisplayName(first.line)} (${first.player.name}). Ferme ou modifie d’abord les lignes actives qui l’utilisent.`;
  }
  const refund = stationSaleRefundBreakdown(s, asset);
  return `Vend ${s.name} et rembourse la gare, les niveaux, les commerces, les ateliers et le dépôt. Remboursement total : ${money(refund.total)}.`;
}

function economyValue(key, fallback = 0) {
  const value = Number(app.state?.balance?.economy?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function stationOperatingCostBreakdown(asset = {}) {
  const level = Number(asset.level || 0) * economyValue('stationLevelCost', 58);
  const commerce = Number(asset.commerce || 0) * economyValue('stationCommerceCost', 64);
  const maintenance = Number(asset.maintenance || 0) * economyValue('stationMaintenanceCost', 92);
  const depot = asset.depot ? economyValue('stationDepotCost', 150) : 0;
  return { level, commerce, maintenance, depot, total: level + commerce + maintenance + depot };
}

function stationOperatingCostRows(asset = {}) {
  const cost = stationOperatingCostBreakdown(asset);
  return `
    <span>Coût/h commerces</span><b>${moneyPerHour(cost.commerce)}</b>
    <span>Coût/h atelier</span><b>${moneyPerHour(cost.maintenance)}</b>
    <span>Coût/h dépôt</span><b>${moneyPerHour(cost.depot)}</b>
    <span>Coût/h total gare</span><b>${moneyPerHour(cost.total)}</b>
  `;
}

function renderStationAsset(s, asset) {
  if (!s) return '';
  const users = activeStationUsersClient(s.id);
  const lines = users.filter(entry => entry.player.id === app.state.me.id).length;
  const refund = stationSaleRefundBreakdown(s, asset);
  const cost = stationAcquisitionCost(s);
  return `
    <article class="station-owned-tile">
      <div class="station-owned-tile-head">
        <strong>${escapeHtml(s.name)}</strong>
        <span class="tag">${lines} ligne${lines > 1 ? 's' : ''}</span>
      </div>
      <div class="station-owned-tile-price">
        <span>Valeur base</span>
        <b>${money(cost)}</b>
      </div>
      <div class="station-owned-mini-stats">
        <div><span>Niv.</span><b>${asset.level}</b></div>
        <div><span>Com.</span><b>${asset.commerce}</b></div>
        <div><span>Atel.</span><b>${asset.maintenance}</b></div>
        <div><span>Dépôt</span><b>${asset.depot ? 'Oui' : 'Non'}</b></div>
      </div>
      <div class="station-owned-tile-foot">
        <span>Revente ${money(refund.total)}</span>
        <div class="station-owned-actions">
          <button data-action="select-station" data-id="${s.id}" ${tooltipAttr('Sélectionne cette gare, centre ton travail sur sa fiche et permet de lancer ses améliorations.')}>Voir</button>
          <button class="danger" data-action="sell-station" data-id="${s.id}" ${tooltipAttr(stationSaleTooltip(s, asset))} ${users.length ? 'disabled' : ''}>Vendre</button>
        </div>
      </div>
    </article>
  `;
}

function emptyStaffNeedsClient() {
  return { drivers: 0, controllers: 0, stationAgents: 0, mechanics: 0, dispatchers: 0, engineers: 0 };
}


function lineSlotDemandClient(line) {
  return Math.max(0, lineAssignedTrainsClient(line).length || lineTrainIdsOf(line).length || 0);
}

function lineStaffNeedsClient(line) {
  if (line?.staffNeeds) return line.staffNeeds;
  if (!line?.active) return emptyStaffNeedsClient();
  const stops = lineStopsOf(line);
  if (stops.length < 2) return emptyStaffNeedsClient();
  const dist = lineDistance(line);
  const trainCount = Math.max(1, lineSlotDemandClient(line) || 1);
  const longLineFactor = 1 + Math.max(0, dist - 180) / 420;
  const stopFactor = 1 + Math.max(0, stops.length - 2) * 0.08;
  const passengerService = line.service === 'passengers' || line.service === 'mixed';
  return {
    drivers: Math.max(1, Math.ceil(trainCount * longLineFactor * stopFactor)),
    controllers: passengerService ? Math.max(1, Math.ceil(trainCount * 0.75 * Math.min(1.8, longLineFactor) * Math.min(1.45, stopFactor))) : 0,
    stationAgents: Math.max(1, Math.ceil(trainCount * 0.12 + stops.length * 0.18 + Math.max(0, stops.length - 2) * 0.16)),
    mechanics: Math.max(1, Math.ceil(trainCount * 0.55 + dist * trainCount / 2200)),
    dispatchers: Math.max(1, Math.ceil(0.34 + (trainCount / 6) * Math.min(1.5, stopFactor))),
    engineers: Math.max(0, Math.ceil(dist / 220 + trainCount / 8 - 0.5))
  };
}

function computeStaffNeedsClient() {
  const me = app.state.me;
  if (me.staffNeeds) return me.staffNeeds;
  const activeLines = me.lines.filter(l => l.active);
  const stationCount = Object.keys(me.stations || {}).length;
  if (!activeLines.length && !stationCount && !me.trains.length) return emptyStaffNeedsClient();

  const needs = emptyStaffNeedsClient();
  let dailyKm = 0;
  let stationWork = 0;
  for (const line of activeLines) {
    const lineNeeds = lineStaffNeedsClient(line);
    needs.drivers += lineNeeds.drivers;
    needs.controllers += lineNeeds.controllers;
    needs.dispatchers += lineNeeds.dispatchers;
    needs.engineers += lineNeeds.engineers;
    dailyKm += lineDistance(line) * Math.max(1, lineSlotDemandClient(line) || 1);
    stationWork += Math.max(0, lineStopsOf(line).length - 2);
  }
  return {
    drivers: activeLines.length ? Math.max(1, needs.drivers) : 0,
    controllers: needs.controllers > 0 ? Math.max(1, needs.controllers) : 0,
    stationAgents: stationCount || activeLines.length ? Math.max(1, Math.ceil(stationCount * 0.65 + activeLines.length * 0.12 + stationWork * 0.16)) : 0,
    mechanics: me.trains.length ? Math.max(1, Math.ceil(me.trains.length * 0.55 + dailyKm / 1800)) : 0,
    dispatchers: activeLines.length ? Math.max(1, needs.dispatchers) : 0,
    engineers: needs.engineers > 0 ? Math.max(1, needs.engineers) : 0
  };
}

function staffNeed(role) {
  return computeStaffNeedsClient()[role] || 0;
}

function staffRatio(role, count) {
  const need = staffNeed(role);
  if (need <= 0) return 1.25;
  return Math.min(1.25, Math.max(0.25, (Number(count || 0) + 0.4) / need));
}

function driverCoverageClient() {
  const need = staffNeed('drivers');
  if (need <= 0) return 1;
  return Math.max(0, Math.min(1, Number(app.state.me?.staff?.drivers || 0) / need));
}

function staffStatus(role, count) {
  const need = Math.ceil(staffNeed(role));
  if (need <= 0) return { label: 'Non requis', cls: 'good', pct: 100 };
  const owned = Number(count || 0);
  if (owned >= need) return { label: 'Effectif suffisant', cls: 'good', pct: 100 };
  return { label: 'Sous-effectif', cls: 'bad', pct: Math.max(0, Math.round(owned / Math.max(1, need) * 100)) };
}

function staffRoleImpact(role) {
  return {
    drivers: {
      title: 'Capacité réelle des trains',
      effects: ['Plus de Conducteurs = plus de trains exploitables sans pénalité.', 'Sous-effectif : Capacité réduite, ponctualité et attractivité en baisse.']
    },
    controllers: {
      title: 'Service à bord et recettes',
      effects: ['Améliore la qualité voyageurs et limite la fraude.', 'Sous-effectif : Satisfaction et part de marché plus faibles.']
    },
    stationAgents: {
      title: 'Accueil et flux voyageurs',
      effects: ['Augmente la satisfaction et le flux de voyageurs sur les lignes.', 'Sous-effectif : Demande passagers et qualité de service plus faibles.']
    },
    mechanics: {
      title: 'Maintenance du parc',
      effects: ['Ralentit la vitesse à laquelle les trains réclament une maintenance.', 'Sous-effectif : Usure accélérée, immobilisations plus fréquentes et coûts plus lourds.']
    },
    dispatchers: {
      title: 'Régularité et recettes',
      effects: ['Améliore la régularité et ajoute un bonus direct aux revenus des lignes.', 'Sous-effectif : Ponctualité et rendement commercial reculent.']
    },
    engineers: {
      title: 'Entretien de l’infrastructure',
      effects: ['Réduit les coûts d’entretien des lignes au kilomètre.', 'Sous-effectif : La maintenance de l’infrastructure pèse davantage sur chaque ligne.']
    }
  }[role] || { title: 'Effet opérationnel', effects: ['Améliore la robustesse de la compagnie.'] };
}

function staffRoleTooltip(role, count) {
  const def = app.state.balance.staff[role];
  const impact = staffRoleImpact(role);
  const need = Math.ceil(staffNeed(role));
  const status = staffStatus(role, count);
  return [
    `${def.label}`,
    `Besoin actuel : ${need}`,
    `Effectif actuel : ${Number(count || 0)}`,
    `Statut : ${status.label}`,
    '---------------------------------------------',
    `Apport réel : ${impact.title}`,
    ...impact.effects.map(effect => `• ${effect}`)
  ].join('\n');
}


function renderStaff() {
  const me = app.state.me;
  return `
    ${renderSectionHero('RESSOURCES HUMAINES', 'Gestion des équipes', 'Pilote les métiers essentiels : conduite, contrôle, maintenance, régulation, gares et infrastructure.', ART.tabs.staff, [])}

    <div class="card staff-dashboard-card">
      <div class="staff-dashboard-head">
        <div>
          <h2>Ressources humaines</h2>
          <p class="muted small">Les besoins sont calculés selon les lignes actives, les gares exploitées, le parc et les kilomètres à entretenir.</p>
        </div>
      </div>
      <div class="staff-grid-compact">
        ${staffOrder.map(role => renderStaffRole(role, me.staff[role] || 0)).join('')}
      </div>
    </div>
  `;
}

function renderStaffRole(role, count) {
  const def = app.state.balance.staff[role];
  const need = Math.ceil(staffNeed(role));
  const status = staffStatus(role, count);
  const impact = staffRoleImpact(role);
  const progress = Math.min(100, Math.round((count / Math.max(1, need)) * 100));
  return `
    <div class="list-item staff-card staff-card-compact ${status.cls}" ${tooltipAttr(staffRoleTooltip(role, count))}>
      <div class="item-title staff-compact-title">
        <strong>${escapeHtml(def.label)}</strong>
        <span class="tag ${status.cls}">${count}/${need}</span>
      </div>
      <p class="staff-impact"><b>${escapeHtml(impact.title)}</b></p>
      <div class="staff-meter"><i style="width:${progress}%"></i></div>
      <div class="staff-compact-kv">
        <span>Salaire</span><b>${staffSalaryPerHour(def)}</b>
        <span>Recrutement</span><b>${money(def.hireCost)}</b>
      </div>
      <div class="staff-amount-control">
        <label>Quantité
          <input id="staffAmount_${role}" type="number" min="1" max="5000" step="1" value="1">
        </label>
      </div>
      <div class="actions staff-compact-actions">
        <button class="danger" data-action="fire-staff" data-role="${role}" data-count="1" ${tooltipAttr(staffActionTooltip(role, 1, 'fire'))} ${count <= 0 ? 'disabled' : ''}>-1</button>
        <button data-action="hire-staff" data-role="${role}" data-count="1" ${tooltipAttr(staffActionTooltip(role, 1, 'hire'))}>+1</button>
        <button class="danger" data-action="fire-staff" data-role="${role}" data-count-input="staffAmount_${role}" ${tooltipAttr('Supprime la quantité saisie pour ce métier.')} ${count <= 0 ? 'disabled' : ''}>Licencier</button>
        <button data-action="hire-staff" data-role="${role}" data-count-input="staffAmount_${role}" ${tooltipAttr('Recrute la quantité saisie pour ce métier.')}>Recruter</button>
      </div>
    </div>
  `;
}


function prepareEpochTrafficAnimation(target) {
  const anim = app.epochTrafficAnimation || (app.epochTrafficAnimation = {});
  const now = performance.now();
  const nextTarget = Math.max(0, Number(target || 0));

  if (anim.displayed == null || anim.target == null) {
    anim.displayed = nextTarget;
    anim.target = nextTarget;
    anim.lastTarget = nextTarget;
    anim.lastTargetAt = now;
    anim.lastFrameAt = now;
    anim.rate = 0;
    return anim.displayed;
  }

  if (nextTarget !== anim.target) {
    const elapsedSeconds = Math.max(0.25, (now - (anim.lastTargetAt || now)) / 1000);
    const observedRate = Math.max(0, (nextTarget - anim.target) / elapsedSeconds);
    anim.rate = observedRate > 0
      ? (anim.rate > 0 ? anim.rate * 0.65 + observedRate * 0.35 : observedRate)
      : anim.rate * 0.75;
    anim.lastTarget = anim.target;
    anim.target = nextTarget;
    anim.lastTargetAt = now;
  }

  return anim.displayed;
}

function formatAnimatedTraffic(value) {
  return formatInt(Math.max(0, Math.round(Number(value || 0))));
}

function updateEpochTrafficAnimation() {
  const valueEl = document.querySelector('[data-epoch-traffic-value]');
  const barEl = document.querySelector('[data-epoch-traffic-progress]');
  if (!valueEl || !barEl) return;

  const anim = app.epochTrafficAnimation || (app.epochTrafficAnimation = {});
  const target = Math.max(0, Number(valueEl.dataset.target || 0));
  const required = Math.max(1, Number(valueEl.dataset.required || 1));
  const now = performance.now();

  if (anim.displayed == null || anim.target == null) {
    anim.displayed = target;
    anim.target = target;
    anim.lastFrameAt = now;
  }

  if (target !== anim.target) prepareEpochTrafficAnimation(target);

  const dt = Math.min(0.08, Math.max(0.001, (now - (anim.lastFrameAt || now)) / 1000));
  anim.lastFrameAt = now;

  if (anim.displayed < anim.target) {
    const remaining = anim.target - anim.displayed;
    const averagedRate = Math.max(1, Number(anim.rate || 0));
    const easingStep = remaining * 0.035;
    const rateStep = averagedRate * dt;
    anim.displayed = Math.min(anim.target, anim.displayed + Math.max(easingStep, rateStep));
  } else if (anim.displayed > anim.target) {
    // En cas de reset ou de nouvelle partie, on redescend sans inertie.
    anim.displayed = anim.target;
  }

  const shown = Math.round(anim.displayed);
  valueEl.textContent = `${formatAnimatedTraffic(shown)} / ${formatInt(required)}`;
  const pct = Math.max(0, Math.min(100, shown / required * 100));
  barEl.style.width = `${pct}%`;
}

function epochTrafficTotalClient(me = app.state?.me) {
  return Math.max(0, Math.round(Number(me?.stats?.passengers || 0) + Number(me?.stats?.freightTons || 0)));
}

function renderResearch() {
  const me = app.state.me;
  const next = app.state.balance.epochs[me.epoch + 1];
  const totalTech = Object.values(me.tech).reduce((a, b) => a + b, 0);
  const trafficTotal = epochTrafficTotalClient(me);
  const techProgress = next ? Math.min(100, totalTech / Math.max(1, next.requiredTech) * 100) : 100;
  const trafficProgress = next ? Math.min(100, trafficTotal / Math.max(1, next.requiredTraffic) * 100) : 100;
  const displayedTraffic = next ? prepareEpochTrafficAnimation(trafficTotal) : trafficTotal;
  const displayedTrafficProgress = next ? Math.min(100, displayedTraffic / Math.max(1, next.requiredTraffic) * 100) : 100;
  const progress = next ? Math.min(techProgress, trafficProgress) : 100;
  const tree = app.state.balance.techTree || {};
  const tabs = Object.values(tree);
  if (!tree[app.activeResearchTab]) app.activeResearchTab = tabs[0]?.id || 'traction';
  const active = tree[app.activeResearchTab] || tabs[0];
  const project = me.researchProject;
  return `
    ${renderSectionHero('R&D FERROVIAIRE', active?.label || 'Recherche', active?.description || 'Débloque concrètement de nouveaux matériels, process et infrastructures.', artForResearchGroup(active?.id), [me.eraName, `${round(researchWorkRateClient(me))}x capacité`, `${Object.keys(me.techUnlocked || {}).length} axes engagés`])}

    <div class="card">
      <h2>Recherche & époques</h2>
      <div class="card-grid">
        ${metric('Époque actuelle', me.eraName)}
        ${metric('Capacité laboratoire', `${round(researchWorkRateClient(me))}x`)}
        ${metric('Axes engagés', Object.keys(me.techUnlocked || {}).length)}
        ${metric('Niveaux cumulés', totalTech)}
      </div>
      ${project ? `
        <hr>
        <div class="research-active">
          <div class="item-title">
            <strong>${escapeHtml(project.title)} niv. ${project.targetLevel}</strong>
            <span class="tag warn research-clock" data-research-timer data-end-at="${Math.round(project.endAt || 0)}">${formatResearchTime(project.realRemainingMs ?? project.remainingMs)}</span>
          </div>
          <div class="progress research-progress"><i data-research-progress data-research-key="${escapeAttr(researchProjectKey(project))}" data-end-at="${Math.round(project.endAt || 0)}" data-duration-ms="${Math.round(project.durationMs || 1)}" data-work-rate="${Number(project.workRate || 1)}" data-last-progress="${round(researchProgressPercent(project))}" style="width:${round(researchProgressPercent(project))}%"></i></div>
          <div class="research-project-footer">
            <p class="small muted">Projet en cours. Coût initial engagé : ${money(project.costMoney || 0)}. Pendant toute la durée de la recherche, le laboratoire ajoute aussi ${moneyPerHour(economyValue('researchLabBaseCost', 180))} aux dépenses/h.</p>
            <button class="danger research-cancel-btn" data-action="cancel-research" data-source="active" data-id="${escapeAttr(project.nodeId)}" data-level="${Number(project.targetLevel || 1)}" ${tooltipAttr(`Annule ${project.title || project.nodeId} et rembourse ${money(project.costMoney || 0)}. Les recherches en file qui dépendaient de ce projet seront aussi annulées et remboursées.`)}>Annuler</button>
          </div>
        </div>
      ` : `<p class="small muted">Aucun projet actif. Lancer une recherche applique un coût initial, puis ajoute ${moneyPerHour(economyValue('researchLabBaseCost', 180))} aux dépenses/h jusqu’à la fin du projet.</p>`}
      ${renderResearchQueue(me)}
      <hr>
      ${next ? `
        <div class="epoch-requirements">
          <div class="item-title">
            <strong>Prochaine époque : ${escapeHtml(next.name)}</strong>
            <span class="tag ${progress >= 100 ? 'good' : 'warn'}">${round(progress)}%</span>
          </div>
          <div class="epoch-requirement-row">
            <div>
              <span>Technologie</span>
              <b class="${totalTech >= next.requiredTech ? 'good-text' : ''}">${formatInt(totalTech)} / ${formatInt(next.requiredTech)}</b>
            </div>
            <div class="progress"><i style="width:${techProgress}%"></i></div>
          </div>
          <div class="epoch-requirement-row">
            <div>
              <span>Trafic cumulé</span>
              <b class="${trafficTotal >= next.requiredTraffic ? 'good-text' : ''}" data-epoch-traffic-value data-target="${trafficTotal}" data-required="${next.requiredTraffic}">${formatAnimatedTraffic(displayedTraffic)} / ${formatInt(next.requiredTraffic)}</b>
            </div>
            <div class="progress epoch-traffic-progress"><i data-epoch-traffic-progress style="width:${displayedTrafficProgress}%"></i></div>
          </div>
          <p class="small muted">Le trafic cumulé additionne tous les <b>voyageurs transportés</b> et toutes les <b>tonnes de fret livrées</b> depuis la création de ta compagnie. Il n’y a plus de délai réel artificiel : la progression dépend de la technologie et d’un volume de trafic beaucoup plus élevé.</p>
        </div>
      ` : '<p class="muted">Toutes les époques sont débloquées.</p>'}
    </div>

    <div class="card">
      <h2>Arbre technologique</h2>
      <div class="research-tabs">
        ${tabs.map(group => `<button data-action="research-tab" data-id="${group.id}" class="${group.id === active.id ? 'active' : ''}">${escapeHtml(group.label)}</button>`).join('')}
      </div>
      <p class="small muted">${escapeHtml(active.description || '')}</p>
      ${renderResearchNodeGrid(active)}
    </div>
  `;
}

function renderResearchPrereqChip(req) {
  if (req.anyOf) {
    const ok = researchPrereqSatisfiedClient(req);
    const label = researchPrereqLabelClient(req);
    if (ok) return `<span class="research-prereq met">${escapeHtml(label)}</span>`;
    return `<span class="research-prereq missing">${escapeHtml(label)}</span>`;
  }
  const ok = techLevel(req.id) >= req.level;
  return ok
    ? `<span class="research-prereq met">${escapeHtml(techNodeTitle(req.id))} niv. ${req.level}</span>`
    : `<button type="button" class="research-prereq missing" data-action="focus-research" data-id="${escapeAttr(req.id)}">${escapeHtml(techNodeTitle(req.id))} niv. ${req.level}</button>`;
}

function renderTechNode(node) {
  const level = plannedTechLevel(node.id);
  const acquiredLevel = techLevel(node.id);
  const maxLevel = techMaxLevel(node);
  const unlimited = !Number.isFinite(maxLevel);
  const complete = !unlimited && level >= maxLevel;
  const targetLevel = complete ? maxLevel : (unlimited ? level + 1 : Math.min(maxLevel, level + 1));
  const locked = complete ? '' : techLockedReason(node, targetLevel);
  const costMoney = researchCostMoneyClient(node, targetLevel);
  const durationMs = researchDurationClient(node, targetLevel);
  const busy = Boolean(app.state.me.researchProject);
  const affordable = app.state.me.cash >= costMoney;
  const image = artForTechNode(node.id);
  const prereqs = researchPrereqsForLevelClient(node, targetLevel);
  const visibleImproves = (node.improves || []).filter(effect => !String(effect || '').toLowerCase().startsWith('niveaux suivants'));
  const highlighted = app.highlightResearchId === node.id;
  return `
    <div class="tech-node ${complete ? 'unlocked' : locked ? 'locked' : ''} ${highlighted ? 'research-glow' : ''}" data-node-id="${escapeAttr(node.id)}">
      ${image
        ? `<div class="tech-node-media" style="--node-image: url('${escapeAttr(image)}');"></div>`
        : `<div class="tech-node-media tech-node-placeholder"><span>Visuel à intégrer</span></div>`}
      <div class="tech-node-body">
        <div class="item-title">
          <strong>${escapeHtml(node.title)}</strong>
          <span class="tag ${complete ? 'good' : locked ? 'bad' : affordable ? 'warn' : ''}">
            ${complete ? 'Max' : `Niv. ${acquiredLevel}${level > acquiredLevel ? ` · prévu ${level}` : ''}`}
          </span>
        </div>
        <div class="kv">
          <span>Prochain niveau</span><b>${complete ? 'Terminé' : `Niv. ${targetLevel}`}</b>
          <span>Coût</span><b>${complete ? '-' : money(costMoney)}</b>
          <span>Durée estimée</span><b>${complete ? '-' : formatResearchTime(durationMs)}</b>
        </div>
        <div class="research-prereqs">
          ${researchEpochPrereqPill(node)}
          ${prereqs.length ? prereqs.map(req => renderResearchPrereqChip(req)).join('') : '<span class="research-prereq met">Aucun prérequis recherche</span>'}
        </div>
        <div class="research-info-grid">
          <div>
            <h4>Débloque</h4>
            ${(node.unlocks || []).length ? node.unlocks.map(effect => renderResearchEffectChip(effect, node)).join('') : '<span>Aucune fonctionnalité immédiate</span>'}
          </div>
          <div>
            <h4>Améliore</h4>
            ${visibleImproves.length ? visibleImproves.map(effect => renderResearchEffectChip(effect, node)).join('') : '<span>Contribution au niveau de branche</span>'}
          </div>
        </div>
        <div class="actions">
          <button class="primary" data-action="research-node" data-id="${node.id}" ${tooltipAttr(`Recherche : ${node.title}. Budget : ${money(costMoney)}. Durée estimée : ${formatResearchTime(durationMs)}. Débloque : ${(node.unlocks || []).join(', ') || 'aucune fonctionnalité immédiate'}. Améliore : ${(node.improves || []).join(', ') || 'niveau de branche.'}`)} ${complete || locked || !affordable ? 'disabled' : ''}>
            ${complete ? 'Maximum' : busy ? `Ajouter à la file niv. ${targetLevel}` : affordable ? `Lancer niv. ${targetLevel}` : 'Budget insuffisant'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function researchEraBucketsForGroup(group) {
  const nodes = group?.nodes || [];
  const buckets = [];
  for (const node of nodes) {
    const key = `${node.era || 0}:${node.eraLabel || group?.label || 'Général'}`;
    let bucket = buckets.find(item => item.key === key);
    if (!bucket) {
      bucket = { key, era: node.era || 0, label: node.eraLabel || group?.label || 'Général', nodes: [] };
      buckets.push(bucket);
    }
    bucket.nodes.push(node);
  }
  return buckets;
}

function renderResearchNodeGrid(group) {
  const nodes = group?.nodes || [];
  const hasEraBuckets = nodes.some(node => node.era || node.eraLabel);
  if (!hasEraBuckets) {
    return `<div class="tech-tree">${nodes.map(node => renderTechNode(node)).join('')}</div>`;
  }
  const buckets = researchEraBucketsForGroup(group);
  return `<div class="research-era-list">${buckets.map(bucket => {
    const collapsed = isResearchEraCollapsed(group.id, bucket);
    const title = `${bucket.era ? `${bucket.era}. ` : ''}${escapeHtml(bucket.label)}`;
    const buttonLabel = collapsed ? 'Déplier' : 'Réduire';
    return `
      <section class="research-era-section ${collapsed ? 'collapsed' : ''}">
        <button type="button" class="research-era-heading" data-action="toggle-research-era" data-group="${escapeAttr(group.id)}" data-bucket="${escapeAttr(bucket.key)}" aria-expanded="${collapsed ? 'false' : 'true'}">
          <span class="research-era-title">
            <span class="research-era-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
            <span>${title}</span>
          </span>
          <span class="research-era-meta">${bucket.nodes.length} recherches · ${buttonLabel}</span>
        </button>
        ${collapsed ? '' : `<div class="tech-tree">${bucket.nodes.map(node => renderTechNode(node)).join('')}</div>`}
      </section>
    `;
  }).join('')}</div>`;
}

function renderResearchQueue(me) {
  const queue = me.researchQueue || [];
  if (!queue.length) return '';
  return `
    <hr>
    <div class="research-queue">
      <div class="item-title">
        <strong>File d’attente R&D</strong>
        <span class="tag">${queue.length}/12</span>
      </div>
      <div class="research-queue-list">
        ${queue.map((item, index) => `
          <div class="research-queue-item" data-action="focus-research" data-id="${escapeAttr(item.nodeId)}">
            <span class="queue-rank">${index + 1}</span>
            <div>
              <strong>${escapeHtml(item.title || item.nodeId)} niv. ${item.targetLevel}</strong>
              <span>${formatResearchTime(item.durationMs)} · ${money(item.costMoney || 0)}</span>
            </div>
            <button class="danger research-cancel-btn" data-action="cancel-research" data-source="queue" data-index="${index}" data-id="${escapeAttr(item.nodeId)}" data-level="${Number(item.targetLevel || 1)}" ${tooltipAttr(`Retire cette recherche de la file et rembourse ${money(item.costMoney || 0)}. Toute recherche suivante qui en dépend serait aussi annulée et remboursée.`)}>Annuler</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}


function researchLevelEffectUnitsClient(level) {
  const n = Math.max(0, Math.floor(Number(level || 0)));
  if (n <= 5) return n;
  return 5 + 2 * (1 - Math.pow(0.75, n - 5));
}

function researchLevelNextIncrementUnitsClient(currentLevel) {
  const n = Math.max(0, Math.floor(Number(currentLevel || 0)));
  return Math.max(0, researchLevelEffectUnitsClient(n + 1) - researchLevelEffectUnitsClient(n));
}

function formatResearchEffectPercentClient(value) {
  const pct = Math.round(value * 1000) / 10;
  if (Math.abs(pct) < 0.05) return '0%';
  return `${pct > 0 ? '+' : ''}${pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}%`;
}

function researchEffectLabelClient(kind) {
  return {
    speed: 'Vitesse max',
    reliability: 'Fiabilité',
    energy: 'Consommation',
    environment: 'Impact env.',
    profitability: 'Rentabilité',
    autonomy: 'Autonomie',
    range: 'Portée'
  }[kind] || 'Bonus';
}

function renderResearchNumericEffectChip(effect, parsed, node) {
  const target = researchEffectTarget(effect, node);
  const currentLevel = techLevel(node.id);
  const currentUnits = researchLevelEffectUnitsClient(currentLevel);
  const nextUnits = researchLevelNextIncrementUnitsClient(currentLevel);
  const currentValue = parsed.value * currentUnits;
  const nextValue = parsed.value * nextUnits;
  return `
    <button type="button" class="research-effect-chip research-effect-chip--numeric" data-action="focus-effect" data-tab="${escapeAttr(target.tab)}" data-subtab="${escapeAttr(target.fleetSubtab || '')}" data-label="${escapeAttr(target.label)}">
      <span>${escapeHtml(researchEffectLabelClient(parsed.kind))}</span>
      <small>Actuel ${escapeHtml(formatResearchEffectPercentClient(currentValue))} · Prochain ${escapeHtml(formatResearchEffectPercentClient(nextValue))}</small>
    </button>
  `;
}

function renderResearchEffectChip(effect, node) {
  const parsed = parseResearchNumericEffectsClient(effect)[0];
  if (parsed) return renderResearchNumericEffectChip(effect, parsed, node);
  const target = researchEffectTarget(effect, node);
  return `
    <button type="button" class="research-effect-chip" data-action="focus-effect" data-tab="${escapeAttr(target.tab)}" data-subtab="${escapeAttr(target.fleetSubtab || '')}" data-label="${escapeAttr(target.label)}">
      <span>${escapeHtml(effect)}</span>
    </button>
  `;
}


function resourcePurchaseCost(type, quantity) {
  const price = Number(app.state?.game?.market?.[type] || 1) * 100;
  return Math.round(Number(quantity || 0) * price);
}

function renderResourceSourceList(type) {
  const flow = app.state.me.resourceFlow || {};
  const sources = flow.sources?.[type] || [];
  const unit = type === 'electricity' ? 'MW/h' : 'u/h';
  if (!sources.length) return '<p class="muted small">Aucune consommation active.</p>';
  return `<div class="resource-source-list">${sources.map(s => `
    <div class="resource-source-row">
      <span>🟥 ${escapeHtml(s.lineName || s.lineCode || 'Ligne')} · ${escapeHtml(s.trainName || 'Train')}</span>
      <b>${round(s.amountPerHour)} ${unit}</b>
    </div>
  `).join('')}</div>`;
}

function renderResourceCard(type, cfg) {
  const me = app.state.me;
  const flow = me.resourceFlow || {};
  const locked = cfg.requiredEpoch > me.epoch;
  const stock = type === 'electricity' ? Number(me.resources?.electricityOrder || 0) : Number(me.resources?.[type] || 0);
  const consumption = Number(flow.consumption?.[type] || 0);
  const unit = type === 'electricity' ? 'MW/h' : 'unités';
  const buyQty = type === 'coal' ? 500 : 300;
  return `
    <div class="card resource-card ${locked ? 'locked' : ''}">
      <div class="item-title">
        <strong>${escapeHtml(cfg.label)}</strong>
        <span class="tag ${locked ? 'bad' : 'good'}">${locked ? `Verrouillé · ${escapeHtml(trainEraLabel(cfg.requiredEpoch))}` : 'Disponible'}</span>
      </div>
      <p class="small muted">${escapeHtml(cfg.description)}</p>
      <div class="card-grid">
        ${metric(type === 'electricity' ? 'Commande actuelle' : 'Stock actuel', `${round(stock)} ${unit}`)}
        ${metric('Consommation /h', `${round(consumption)} ${type === 'electricity' ? 'MW/h' : 'u/h'}`, consumption > 0 ? 'warn-text' : '')}
        ${metric('Solde /h', type === 'electricity' ? `${round((flow.production?.electricity || 0) - consumption)} MW/h` : `${round(stock)} u`, type === 'electricity' && (flow.production?.electricity || 0) < consumption ? 'bad-text' : 'good-text')}
      </div>
      ${renderResourceSourceList(type)}
      ${type === 'electricity' ? `
        <label class="resource-control">Commande producteur
          <input id="electricityOrderInput" type="number" min="0" step="10" value="${round(stock)}" ${locked ? 'disabled' : ''}>
        </label>
        <button class="primary" data-action="set-electricity-order" ${locked ? 'disabled' : ''}>Enregistrer la commande</button>
      ` : ['coal', 'diesel'].includes(type) ? `
        <div class="resource-buy-custom">
          <label>Quantité à acheter
            <input id="resourceQty_${escapeAttr(type)}" class="resource-qty-input" type="number" min="1" max="100000" step="100" value="${buyQty}" ${locked ? 'disabled' : ''}>
          </label>
          <span class="small muted">Prix indicatif pour ${formatInt(buyQty)} u : ${money(resourcePurchaseCost(type, buyQty))}</span>
          <button class="primary" data-action="buy-resource" data-type="${escapeAttr(type)}" data-quantity-input="resourceQty_${escapeAttr(type)}" ${locked ? 'disabled' : ''}>Acheter cette quantité</button>
        </div>
      ` : `
        <div class="resource-buy-row">
          <span>Fonction prévue pour une prochaine ère.</span>
          <button disabled>Verrouillé</button>
        </div>
      `}
    </div>
  `;
}

function renderResources() {
  const me = app.state.me;
  return `
    ${renderSectionHero('ÉNERGIE & CARBURANTS', 'Approvisionnement', 'Stocke le charbon et le diesel, puis commande la puissance électrique nécessaire aux trains modernes.', ART.tabs.resources, ['Charbon', 'Diesel', 'Électricité'])}
    <div class="card">
      <h2>Vue d’ensemble</h2>
      <p class="muted small">Les trains vapeur et diesel consomment un stock acheté. Les trains électriques et batteries utilisent une commande producteur exprimée en MW/h. Si l’approvisionnement est insuffisant, les lignes concernées ne circulent pas.</p>
      <div class="card-grid">
        ${metric('Charbon', resourceStockLabel('coal'))}
        ${metric('Diesel', resourceStockLabel('diesel'))}
        ${metric('Électricité', resourceStockLabel('electricity'))}
        ${metric('Résultat /h', moneyPerHour(me.stats.lastProfit), me.stats.lastProfit >= 0 ? 'good-text' : 'bad-text')}
      </div>
    </div>
    <div class="resource-grid">
      ${renderResourceCard('coal', { label: 'Charbon', requiredEpoch: 0, description: 'Stock consommé par les locomotives vapeur en fonction du poids, de la distance et du nombre de trains affectés.' })}
      ${renderResourceCard('diesel', { label: 'Diesel', requiredEpoch: 1, description: 'Stock consommé par les matériels diesel. Verrouillé tant que l’ère diesel n’est pas atteinte.' })}
      ${renderResourceCard('electricity', { label: 'Électricité', requiredEpoch: 2, description: 'Commande de puissance auprès du producteur. Les trains électriques et batteries ne circulent que si la commande couvre la demande.' })}
      ${renderResourceCard('hydrogen', { label: 'Hydrogène', requiredEpoch: 4, description: 'Prévu pour les futures rames hydrogène. Fonction grisée tant que cette ère n’est pas atteinte.' })}
    </div>
  `;
}


function budgetValueClass(type, value = 0) {
  if (type === 'revenue') return 'good-text';
  if (type === 'expense') return 'bad-text';
  if (type === 'net') return Number(value || 0) >= 0 ? 'good-text' : 'bad-text';
  return '';
}

function budgetRow(label, value, type = 'neutral', detail = '') {
  const numeric = Number(value || 0);
  return `
    <div class="budget-row ${type}">
      <span>${escapeHtml(label)}${detail ? `<em>${escapeHtml(detail)}</em>` : ''}</span>
      <b class="${budgetValueClass(type, numeric)}">${moneyPerHour(numeric)}</b>
    </div>
  `;
}

function budgetRawRow(label, value, cls = '', detail = '') {
  return `
    <div class="budget-row neutral">
      <span>${escapeHtml(label)}${detail ? `<em>${escapeHtml(detail)}</em>` : ''}</span>
      <b class="${cls}">${escapeHtml(String(value))}</b>
    </div>
  `;
}

function budgetSection(id, title, rows, meta = '') {
  const collapsed = app.budgetCollapsed?.[id] === true;
  return `
    <section class="card budget-section ${collapsed ? 'collapsed' : ''}">
      <button type="button" class="research-era-heading budget-heading" data-action="toggle-budget-section" data-id="${escapeAttr(id)}" aria-expanded="${collapsed ? 'false' : 'true'}">
        <span class="research-era-title">
          <span class="research-era-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
          <span>${escapeHtml(title)}</span>
        </span>
        <span class="research-era-meta">${escapeHtml(meta || (collapsed ? 'Déplier' : 'Réduire'))}</span>
      </button>
      ${collapsed ? '' : `<div class="budget-section-body">${rows}</div>`}
    </section>
  `;
}

function renderBudgetLineDetail() {
  const lines = app.state.me.lines.filter(line => line.active);
  if (!lines.length) return '<p class="muted small">Aucune ligne active.</p>';
  return lines.map((line, index) => {
    const stats = line.stats || {};
    const finance = stats.finance || {};
    const name = linePublicName(line) || `Ligne ${index + 1}`;
    const net = Number(finance.netProfit ?? stats.profit ?? 0);
    return `
      <div class="budget-line-card">
        <div class="item-title">
          <strong>${escapeHtml(name)}</strong>
          <span class="tag ${net >= 0 ? 'good' : 'bad'}">${moneyPerHour(net)}</span>
        </div>
        <div class="budget-mini-grid">
          ${budgetRow('Recettes', stats.revenue || 0, 'revenue')}
          ${budgetRow('Coûts variables', finance.variableExpenses ?? stats.expenses ?? 0, 'expense')}
          ${budgetRow('Frais alloués', finance.allocatedOverhead || 0, 'expense')}
          ${budgetRow('Net', net, 'net')}
        </div>
      </div>
    `;
  }).join('');
}

function renderBudget() {
  const me = app.state.me;
  const b = me.stats?.lastBreakdown || {};
  const revenueTotal = Number(me.stats.lastRevenue || 0);
  const expenseTotal = Number(me.stats.lastExpenses || 0);
  const net = Number(me.stats.lastProfit || 0);
  const variable = Number(b.variableLineCost || 0);
  const knownVariableBase = Number(b.energyCost || 0) + Number(b.trainMaintenanceCost || 0) + Number(b.lineInfrastructureCost || 0) + Number(b.accessCost || 0);
  const commercialOperatingCost = Number(b.commercialOperatingCost || Math.max(0, variable - knownVariableBase));
  const commercialSalesCost = Number(b.commercialSalesCost || commercialOperatingCost * 0.42);
  const commercialControlCost = Number(b.commercialControlCost || commercialOperatingCost * 0.28);
  const commercialAdministrationCost = Number(b.commercialAdministrationCost || commercialOperatingCost * 0.30);
  const operatingMargin = revenueTotal > 0 ? Math.round((net / revenueTotal) * 100) : 0;

  return `
    ${renderSectionHero('BUDGET', 'Lecture financière complète', 'Analyse les revenus, les dépenses et le résultat net de la compagnie avec des catégories réductibles.', ART.tabs.budget, ['Résultat', 'Revenus', 'Dépenses'])}

    ${budgetSection('result', 'Résultat et structure financière', `
      ${budgetRow('Résultat net courant', net, 'net', 'Recettes - dépenses')}
      ${budgetRawRow('Trésorerie disponible', money(me.cash), me.cash >= 0 ? 'good-text' : 'bad-text')}
      ${budgetRawRow('Dette totale', money(me.debt), me.debt > 0 ? 'bad-text' : 'good-text')}
    `, net >= 0 ? `+${moneyPerHour(net)}` : moneyPerHour(net))}

    <div class="budget-two-column">
      ${budgetSection('revenues', 'Recettes', `
        ${budgetRow('Billets voyageurs', b.ticketRevenue || 0, 'revenue', 'Demande captée × longueur × prix unitaire, avec bonus salariés bornés')}
        ${budgetRow('Services voyageurs', b.ancillaryRevenue || 0, 'revenue', 'Commerces et services associés')}
        ${budgetRow('Fret', b.freightRevenue || 0, 'revenue', 'Tonnage transporté')}
        ${budgetRow('Bonus régulation', b.dispatchRevenueBoost || 0, 'revenue', 'Effet des Régulateurs')}
        ${budgetRow('Revenus des gares', b.stationRevenue || 0, 'revenue', 'Gares possédées')}
        ${budgetRow('Péages de gares', b.passageRightsRevenue || 0, 'revenue', 'Revenus payés par les autres joueurs quand ils desservent tes gares')}
      `, moneyPerHour(revenueTotal))}

      ${budgetSection('expenses', 'Dépenses', `
        ${budgetRow('Énergie', b.energyCost || 0, 'expense', 'Électricité ou ressources consommées')}
        ${budgetRow('Maintenance matériel roulant', b.trainMaintenanceCost || 0, 'expense', 'Usure liée aux circulations')}
        ${budgetRow('Entretien des lignes', b.lineInfrastructureCost || 0, 'expense', 'Entretien infrastructure triplé, partagé entre joueurs qui utilisent les mêmes tronçons')}
        ${budgetRow('Péage gares concurrentes', b.accessCost || 0, 'expense', 'Coût payé uniquement quand ta ligne dessert une gare possédée par un autre joueur')}
        ${budgetRow('Vente & distribution', commercialSalesCost, 'expense', 'Billetterie, canaux de vente, information tarifaire et distribution')}
        ${budgetRow('Contrôle & fraude', commercialControlCost, 'expense', 'Fraude résiduelle, litiges voyageurs et dispositifs de contrôle')}
        ${budgetRow('Organisation commerciale', commercialAdministrationCost, 'expense', 'Support client, planification commerciale et organisation opérationnelle')}
        ${budgetRow('Personnel', b.staffCost || 0, 'expense', 'Salaires')}
        ${budgetRow('Gares', b.stationCost || 0, 'expense', 'Niveaux, commerces, ateliers, dépôts')}
        ${budgetRow('Dette', b.debtCost || 0, 'expense', 'Intérêts et charge financière')}
        ${budgetRow('Parc inutilisé', b.idleTrainCost || 0, 'expense', 'Stockage du matériel non affecté')}
        ${budgetRow('R&D', b.researchCost || 0, 'expense', 'Coût/h du laboratoire pendant un projet actif')}
      `, moneyPerHour(expenseTotal))}
    </div>

    ${budgetSection('lines', 'Détail par ligne', renderBudgetLineDetail(), `${me.lines.filter(line => line.active).length} ligne${me.lines.filter(line => line.active).length > 1 ? 's' : ''}`)}
  `;
}

function renderMarket() {
  const me = app.state.me;
  const market = app.state.game.market;
  return `
    ${renderSectionHero('ÉNERGIE & FINANCE', 'Marché et contrats', 'Ajuste ta stratégie énergétique, contracte des financements et prépare l’arrivée des technologies avancées.', ART.tabs.market, ['Électricité', 'Hydrogène', 'Financement'])}

    <div class="card">
      <h2>Marché énergie</h2>
      <div class="card-grid">
        ${metric('Charbon', `${round(market.coal)} €/u`)}
        ${metric('Diesel', `${round(market.diesel)} €/u`)}
        ${metric('Électricité', `${round(market.electricity)} €/u`)}
        ${metric('Hydrogène', `${round(market.hydrogen)} €/u`)}
      </div>
    </div>
    <div class="card">
      <h2>Contrat énergie</h2>
      <div class="list">
        ${Object.entries(app.state.balance.energyStrategies).map(([id, s]) => `
          <div class="list-item">
            <div class="item-title"><strong>${escapeHtml(s.name)}</strong><span class="tag ${me.energyStrategy === id ? 'good' : ''}">${me.energyStrategy === id ? 'Actif' : 'Disponible'}</span></div>
            <p class="small muted">${energyStrategyDescription(id)}</p>
            <div class="actions"><button data-action="energy-strategy" data-id="${id}" ${tooltipAttr(energyStrategyTooltip(id, s))} ${me.energyStrategy === id ? 'disabled' : ''}>Choisir</button></div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="card finance-card">
      <h2>Financement</h2>
      <div class="card-grid finance-summary-grid">
        ${metric('Trésorerie', money(me.cash), me.cash >= 0 ? 'good-text' : 'bad-text')}
        ${metric('Dette', money(me.debt), me.debt > 0 ? 'warn-text' : 'good-text')}
      </div>
      <div class="actions">
        <button data-action="loan" data-amount="100000" ${tooltipAttr('Ajoute immédiatement 100 000 € de trésorerie et augmente la dette. Effet : Plus de marge d’investissement, mais des remboursements/intérêts pèseront sur la compagnie.')}>Emprunter 100 000 €</button>
        <button data-action="loan" data-amount="500000" ${tooltipAttr('Ajoute immédiatement 500 000 € de trésorerie et augmente fortement la dette. À utiliser pour gros investissements : Matériel, gares, électrification.')}>Emprunter 500 000 €</button>
      </div>
      <div class="debt-repay-control">
        <label>Montant à rembourser
          <input id="debtRepayAmount" type="number" min="1" step="1000" value="${Math.min(100000, Math.max(0, Math.round(me.debt || 0)))}" placeholder="Ex : 250000" ${me.debt <= 0 ? 'disabled' : ''}>
        </label>
        <div class="debt-repay-actions">
          <button data-action="repay" data-amount-input="debtRepayAmount" ${tooltipAttr('Rembourse le montant saisi, dans la limite de la dette et de la trésorerie disponible.')} ${me.debt <= 0 ? 'disabled' : ''}>Rembourser ce montant</button>
          <button data-action="repay" data-amount="${Math.max(0, Math.round(me.debt || 0))}" ${tooltipAttr('Rembourse toute la dette si la trésorerie le permet.')} ${me.debt <= 0 ? 'disabled' : ''}>Tout rembourser</button>
        </div>
      </div>
    </div>
  `;
}

function energyStrategyDescription(id) {
  return {
    spot: 'Prix normal, exposition complète aux variations.',
    stable: 'Un peu plus cher, mais moins brutal sur la durée.',
    cheap: 'Moins cher, adapté aux compagnies fragiles mais moins vertueux.',
    green: 'Plus cher, meilleur pour une stratégie bas carbone.'
  }[id] || '';
}

async function onTabContentClick(event) {
  markUiInteraction();
  const suggestion = event.target.closest('[data-station-choice]');
  if (suggestion) {
    chooseStationSuggestion(suggestion.dataset.role, suggestion.dataset.stationChoice);
    return;
  }

  const lineSubtab = event.target.closest('[data-lines-subtab]');
  if (lineSubtab) {
    app.activeLinesSubtab = lineSubtab.dataset.linesSubtab;
    localStorage.setItem('sillons.linesSubtab', app.activeLinesSubtab);
    renderAll();
    return;
  }

  const fleetSubtab = event.target.closest('[data-fleet-subtab]');
  if (fleetSubtab) {
    app.activeFleetSubtab = fleetSubtab.dataset.fleetSubtab;
    localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
    renderAll();
    return;
  }


  const compositionModeTab = event.target.closest('[data-comp-mode]');
  if (compositionModeTab) {
    app.compositionEditorModes[compositionModeTab.dataset.id] = compositionModeTab.dataset.compMode;
    localStorage.setItem('sillons.compositionEditorModes', JSON.stringify(app.compositionEditorModes));
    renderAll();
    return;
  }

  const button = event.target.closest('[data-action], #createLineBtn, #addWaypointBtn');
  if (!button) return;
  if (button.id === 'createLineBtn') {
    updateLineDraftFromForm(document.activeElement?.id || '');
    const draft = app.lineDraft;
    doAction('createLine', {
      from: draft.from,
      to: draft.to,
      stops: buildLineDraftStops(),
      preserveOrder: true,
      trainId: draft.trainId,
      service: draft.service,
      ticketPrice: Number(draft.ticketPrice),
      tariff: Number(draft.tariff)
    });
    return;
  }
  if (button.id === 'addWaypointBtn') {
    addDraftWaypoint();
    return;
  }
  const action = button.dataset.action;
  if (action === 'admin-select-player') {
    app.admin.selectedPlayerId = button.dataset.id || '';
    localStorage.setItem('sillons.adminSelectedPlayer', app.admin.selectedPlayerId);
    renderAll();
    return;
  }
  if (action === 'admin-save-quick') {
    return adminUpdatePlayer({
      targetPlayerId: button.dataset.id,
      name: $('#adminCompanyName')?.value || '',
      cash: Number($('#adminCash')?.value || 0)
    });
  }
  if (action === 'admin-add-cash') {
    const raw = $('#adminCashDelta')?.value || '';
    if (!raw.trim()) return toast('Saisis une variation de trésorerie.', 'error');
    return adminUpdatePlayer({ targetPlayerId: button.dataset.id, cashDelta: Number(raw) });
  }
  if (action === 'admin-save-json') {
    try {
      const rawPlayer = JSON.parse($('#adminRawPlayerJson')?.value || '{}');
      return adminUpdatePlayer({ targetPlayerId: button.dataset.id, rawPlayer });
    } catch (error) {
      toast(`JSON invalide : ${error.message}`, 'error');
      return;
    }
  }
  if (action === 'focus-research') return focusResearchNode(button.dataset.id);
  if (action === 'focus-effect') return focusUiTarget(button.dataset.tab, button.dataset.label, button.dataset.subtab);
if (action === 'select-composition-train') {
  app.selectedCompositionTrainId = button.dataset.id || '';
  localStorage.setItem('sillons.selectedCompositionTrainId', app.selectedCompositionTrainId);
  renderAll();
  return;
}
if (action === 'open-composition') {
  app.activeTab = 'fleet';
  app.activeFleetSubtab = 'composition';
  app.selectedCompositionTrainId = button.dataset.id || '';
  localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
  localStorage.setItem('sillons.selectedCompositionTrainId', app.selectedCompositionTrainId);
  renderAll();
  return;
}
if (action === 'save-train-composition') {
  const trainId = button.dataset.id;
  const train = app.state.me.trains.find(t => t.id === trainId);
  if (!train) return;
  const spec = trainCompositionSpec(train);
  const payload = { trainId, mode: spec.mode };
  if (spec.mode === 'multiple_unit') payload.powerUnits = Number($('#compPowerUnitsValue')?.value || $('#compPowerUnits')?.value || 1);
  else if (spec.mode === 'freight_loco') {
    payload.freightCars = Number($('#compFreightCarsValue')?.value || $('#compFreightCars')?.value || 2);
    payload.freightVariant = document.querySelector('input[name="compFreightVariant"]:checked')?.value || '';
  } else {
    payload.passengerCars = Number($('#compPassengerCarsValue')?.value || $('#compPassengerCars')?.value || 1);
    payload.passengerVariant = document.querySelector('input[name="compPassengerVariant"]:checked')?.value || '';
  }
  const economy = compositionChangeEconomyClient(train, payload);
  if (economy.cost > 0) {
    if (!(await gameConfirm('Modifier la composition', `Coût des voitures/wagons ajoutés : ${money(economy.cost)}.`, { confirmLabel: 'Modifier' }))) return;
  } else if (economy.refund > 0) {
    if (!(await gameConfirm('Modifier la composition', `Remboursement estimé au prorata de l’usure : ${money(economy.refund)}.`, { confirmLabel: 'Modifier' }))) return;
  }
  return doAction('updateTrainComposition', payload);
}
    if (action === 'buy-train') return doAction('buyTrain', { modelId: button.dataset.id });
  if (action === 'sell-train') {
    const train = app.state.me.trains.find(t => t.id === button.dataset.id);
    const model = train ? app.state.balance.trains[train.modelId] : null;
    const estimate = train && model ? trainResaleEstimateClient(train, model) : 0;
    const message = `Vendre ${train ? trainName(train) : 'ce train'} ?${estimate ? `

Valeur estimée : ${money(estimate)}.` : ''}`;
    if (!(await gameConfirm('Vendre un train', message, { confirmLabel: 'Vendre', danger: true }))) return;
    return doAction('sellTrain', { trainId: button.dataset.id });
  }
  if (action === 'repair-train') return doAction('repairTrain', { trainId: button.dataset.id, mode: button.dataset.mode });
  if (action === 'repair-all-trains') {
    const mode = button.dataset.mode || 'standard';
    if (!(await gameConfirm('Maintenance globale', 'Envoyer tous les trains éligibles en maintenance atelier ?\n\nLes trains affectés à des lignes seront immobilisés pendant l’intervention.', { confirmLabel: 'Tout envoyer', danger: true }))) return;
    return doAction('repairAllTrains', { mode });
  }
  if (action === 'maintenance-policy') return doAction('setMaintenancePolicy', { policy: button.dataset.id });
  if (action === 'toggle-line-card') {
    const id = button.dataset.id || '';
    if (id) {
      app.lineCollapsed[id] = !app.lineCollapsed[id];
      localStorage.setItem('sillons.lineCollapsed', JSON.stringify(app.lineCollapsed));
      renderAll();
    }
    return;
  }
  if (action === 'close-line') {
    const line = app.state.me.lines.find(l => l.id === button.dataset.id);
    const message = `Fermer ${line ? linePublicName(line) : 'cette ligne'} ?

Les trains seront libérés et la ligne ne générera plus de revenus.`;
    if (!(await gameConfirm('Fermer la ligne', message, { confirmLabel: 'Fermer la ligne', danger: true }))) return;
    return doAction('closeLine', { lineId: button.dataset.id });
  }
  if (action === 'electrify-line') return doAction('updateLine', { lineId: button.dataset.id, electrify: true });
  if (action === 'edit-line') return openLineModal(button.dataset.id);
  if (action === 'remove-waypoint') { removeDraftWaypoint(button.dataset.index); return; }
  if (action === 'upgrade-station') return doAction('upgradeStation', { stationId: button.dataset.id, kind: button.dataset.kind });
  if (action === 'sell-station') {
    const s = station(button.dataset.id);
    const asset = app.state.me.stations?.[button.dataset.id];
    const refund = s && asset ? stationSaleRefundBreakdown(s, asset).total : 0;
    if (!(await gameConfirm('Vendre la gare', `Vendre ${s?.name || 'cette gare'} pour ${money(refund)} ?`, { confirmLabel: 'Vendre', danger: true }))) return;
    return doAction('sellStation', { stationId: button.dataset.id });
  }
  if (action === 'select-station') {
    setSelectedStation(button.dataset.id);
    const selected = station(button.dataset.id);
    app.stationSearch.query = stationSearchLabel(selected);
    app.stationSearch.candidateId = button.dataset.id || '';
    app.activeTab = 'stations';
    localStorage.setItem('sillons.activeTab', app.activeTab);
    renderAll();
    return;
  }
  if (action === 'hire-staff') {
    const input = button.dataset.countInput ? $(`#${button.dataset.countInput}`) : null;
    const count = Math.max(1, Math.floor(Number(input?.value || button.dataset.count || 1)));
    return doAction('hireStaff', { role: button.dataset.role, count });
  }
  if (action === 'fire-staff') {
    const input = button.dataset.countInput ? $(`#${button.dataset.countInput}`) : null;
    const count = Math.max(1, Math.floor(Number(input?.value || button.dataset.count || 1)));
    return doAction('fireStaff', { role: button.dataset.role, count });
  }
  if (action === 'cancel-research') return doAction('cancelResearch', { source: button.dataset.source, index: Number(button.dataset.index), nodeId: button.dataset.id, targetLevel: Number(button.dataset.level) });
  if (action === 'research-node') return doAction('research', { nodeId: button.dataset.id });
  if (action === 'research-tab') { app.activeResearchTab = button.dataset.id; localStorage.setItem('sillons.researchTab', app.activeResearchTab); renderAll(); return; }
  if (action === 'toggle-research-era') { toggleResearchEra(button.dataset.group, button.dataset.bucket); return; }
  if (action === 'toggle-owned-stations') { app.ownedStationsCollapsed = !app.ownedStationsCollapsed; localStorage.setItem('sillons.ownedStationsCollapsed', app.ownedStationsCollapsed ? '1' : '0'); renderAll(); return; }
  if (action === 'toggle-budget-section') {
    const id = button.dataset.id || 'main';
    app.budgetCollapsed[id] = !app.budgetCollapsed[id];
    localStorage.setItem('sillons.budgetCollapsed', JSON.stringify(app.budgetCollapsed));
    renderAll();
    return;
  }
  if (action === 'research') return doAction('research', { branch: button.dataset.branch });
  if (action === 'energy-strategy') return doAction('energyStrategy', { strategy: button.dataset.id });
  if (action === 'buy-resource') {
    const input = button.dataset.quantityInput ? $(`#${button.dataset.quantityInput}`) : null;
    const quantity = Number(input?.value || button.dataset.quantity || 0);
    return doAction('buyResource', { type: button.dataset.type, quantity });
  }
  if (action === 'set-electricity-order') return doAction('setElectricityOrder', { amount: Number($('#electricityOrderInput')?.value || 0) });
  if (action === 'loan') return doAction('takeLoan', { amount: Number(button.dataset.amount) });
  if (action === 'repay') {
    const input = button.dataset.amountInput ? $(`#${button.dataset.amountInput}`) : null;
    const amount = Math.max(1, Math.round(Number(input?.value || button.dataset.amount || 0)));
    return doAction('repayLoan', { amount });
  }
}

function onTabContentChange(event) {
  markUiInteraction();
  if (event.target.id === 'stationSort') {
    app.stationSortMode = event.target.value || 'alpha';
    localStorage.setItem('sillons.stationSortMode', app.stationSortMode);
    if ($('#lineStationSearch')?.value) updateStationSearch('station', $('#lineStationSearch').value);
    return;
  }
  if (event.target.id === 'ownedStationSort') {
    app.ownedStationSortMode = event.target.value || 'alpha';
    localStorage.setItem('sillons.ownedStationSortMode', app.ownedStationSortMode);
    renderAll();
    return;
  }
  if (['lineTicketPrice', 'lineTicketPriceRange'].includes(event.target.id)) {
    updateLineDraftFromForm(event.target.id);
    updateLinePreview(event.target.id);
    return;
  }
  if (['lineTrain', 'lineService'].includes(event.target.id)) {
    updateLineDraftFromForm(event.target.id);
    updateLinePreview(event.target.id);
  }
}

async function performAction(type, payload) {
  const actionKey = `${type}:${JSON.stringify(payload || {})}`;
  if (app.pendingActions.has(actionKey)) return null;
  app.pendingActions.add(actionKey);
  document.body.classList.add('is-busy');
  try {
    const response = await post('/api/action', { playerId: app.playerId, type, payload });
    if (response.state?.serverTime) app.serverClockOffset = Number(response.state.serverTime || Date.now()) - Date.now();
    app.state = response.state || app.state;
    invalidateMapProjection('action');
    if (app.state?.me) ensureSelectedStation();
    if (!response.ok) {
      toast([response.error, response.hint].filter(Boolean).join(' ' ) || 'Action refusée.', 'error');
    } else {
      if (type === 'createLine') {
        app.lineDraft.trainId = '';
        app.lineDraft.waypoints = [];
        app.lineDraft.viaCandidate = '';
        app.lineDraft.viaQuery = '';
        saveLineDraft();
      }
      toast(response.message || 'Action réalisée.', 'ok');
    }
    renderAll(true);
    setTimeout(renderTutorialOverlay, 40);
    const actionCashDelta = Number(response.cashDelta);
    if (Number.isFinite(actionCashDelta) && actionCashDelta !== 0) {
      animateCashDelta(actionCashDelta);
    }
    return response;
  } catch (error) {
    toast(error.message || 'Erreur réseau.', 'error');
    return { ok: false, error: error.message || 'Erreur réseau.' };
  } finally {
    app.pendingActions.delete(actionKey);
    if (!app.pendingActions.size) document.body.classList.remove('is-busy');
  }
}


async function doAction(type, payload) {
  await performAction(type, payload);
}

async function post(url, payload, options = {}) {
  const useAuth = options.auth !== false;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(useAuth ? authHeaders() : {}) },
    body: JSON.stringify(payload)
  });
  const data = await readJsonResponse(response, 'Reponse serveur invalide.');
  if (response.status === 401) {
    clearAuthState();
    $('#setup')?.classList.remove('hidden');
  }
  return data;
}

async function readJsonResponse(response, fallbackMessage = 'Reponse invalide.') {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const suffix = response?.status ? ` (${response.status})` : '';
    throw new Error(`${fallbackMessage}${suffix}`);
  }
}


function openLineModal(lineId) {
  const line = app.state.me.lines.find(l => l.id === lineId);
  if (!line) return;
  const stops = lineStopsOf(line);
  const freeOrCurrent = app.state.me.trains.filter(t => lineHasTrain(line, t.id) || !app.state.me.lines.some(l => l.active && lineHasTrain(l, t.id)));
  app.lineEditor = {
    lineId,
    stops: [...stops],
    trainIds: lineTrainIdsOf(line),
    trainId: lineTrainIdsOf(line)[0] || '',
    service: line.service || 'passengers',
    tariff: line.tariff,
    ticketPrice: lineTicketPrice(line),
    candidateId: '',
    candidateQuery: '',
    insertAfter: 'auto',
    draggingIndex: null
  };

  const renderEditorStopRow = (id, index) => {
    const s = station(id);
    const canRemove = app.lineEditor.stops.length > 2;
    return `
      <div class="editor-stop-row" draggable="true" data-editor-stop-index="${index}">
        <div class="drag-handle" title="Glisser pour changer l’ordre">☰</div>
        <div class="editor-stop-main">
          <strong>${index + 1}. ${escapeHtml(s?.name || id)}</strong>
          <span>${index === 0 ? 'Départ' : index === app.lineEditor.stops.length - 1 ? 'Terminus' : 'Arrêt intermédiaire'}</span>
        </div>
        <div class="editor-stop-actions">
          <button type="button" data-editor-move="${index}" data-direction="-1" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-editor-move="${index}" data-direction="1" ${index === app.lineEditor.stops.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="danger ghost" data-editor-remove="${index}" ${canRemove ? '' : 'disabled'}>Retirer</button>
        </div>
      </div>
    `;
  };

  const renderEditorHtml = () => {
    const editorDistance = getRouteForStops(app.lineEditor.stops).distance || 0;
    app.lineEditor.ticketPrice = normalizeTicketPrice(app.lineEditor.ticketPrice, lineTicketPrice(line), editorDistance);
    app.lineEditor.tariff = ticketPriceToTariff(app.lineEditor.ticketPrice, editorDistance);
    const selectedTrainCount = app.lineEditor.trainIds.length;
    const trainChoices = freeOrCurrent.map(t => {
      const selected = app.lineEditor.trainIds.includes(t.id);
      const profile = previewOperatingProfile(t, app.state.balance.trains[t.modelId]);
      const model = app.state.balance.trains[t.modelId];
      return `
        <label class="line-train-choice ${selected ? 'selected' : ''}" title="${escapeAttr(trainName(t))}">
          <input type="checkbox" class="edit-line-train-check" value="${escapeAttr(t.id)}" ${selected ? 'checked' : ''}>
          <span class="line-train-choice-check">${selected ? '✓' : ''}</span>
          <span class="line-train-choice-main">
            <span class="line-train-choice-visual" aria-hidden="true">
              <i></i><i></i><i></i><i></i>
            </span>
            <b>${escapeHtml(trainName(t))}</b>
            <em>${escapeHtml(model?.type || 'Matériel')}</em>
            <small>${formatInt(profile.capacity)} voy. · ${formatInt(profile.freight)} t · ${formatInt(profile.range)} km · ${formatInt(profile.speed)} km/h</small>
          </span>
        </label>`;
    }).join('');
    return `
    <div class="form-grid line-editor">
      <div class="form-grid">
        <label>Type de transport
          <select id="editLineService">${serviceOptions(app.lineEditor.service)}</select>
        </label>
      </div>
      <div class="line-editor-train-picker">
        <div class="line-editor-subtitle">
          <div>
            <strong>Trains affectés à cette ligne</strong>
            <span class="small muted">Coche plusieurs trains libres pour augmenter la capacité de la ligne.</span>
          </div>
          <span class="tag ${selectedTrainCount ? 'good' : 'warn'}">${selectedTrainCount} sélectionné${selectedTrainCount > 1 ? 's' : ''}</span>
        </div>
        <div class="line-train-choice-grid">${trainChoices || '<p class="muted small">Aucun train libre.</p>'}</div>
      </div>
      <div class="two form-grid">
        <label>Prix billet moyen
          ${renderTicketPriceControl({
            inputId: 'editLineTicketPrice',
            rangeId: 'editLineTicketPriceRange',
            hintId: 'editLineTicketPriceHint',
            price: app.lineEditor.ticketPrice,
            distance: editorDistance
          })}
        </label>
      </div>

      <div class="card inset-card line-editor-card">
        <h3>Parcours de la ligne</h3>
        <p class="muted small">Glisse-dépose les arrêts pour modifier l’ordre. Le premier arrêt devient le départ, le dernier devient le terminus et le nom de ligne est recalculé.</p>
        <div class="line-stop-strip">${renderDraftStopStrip(app.lineEditor.stops)}</div>
        <div class="editor-stop-list drag-list">
          ${app.lineEditor.stops.map(renderEditorStopRow).join('')}
        </div>
        <div class="form-grid">
          <label>Position d’insertion
            <select id="lineEditorInsertPos">
              <option value="auto" ${app.lineEditor.insertAfter === 'auto' ? 'selected' : ''}>Meilleure position entre deux arrêts</option>
              ${app.lineEditor.stops.map((id, index) => {
                const stationName = station(id)?.name || id;
                const label = index === app.lineEditor.stops.length - 1 ? `Prolonger après ${stationName}` : `Après ${stationName}`;
                return `<option value="${index}" ${String(index) === String(app.lineEditor.insertAfter) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
              }).join('')}
            </select>
          </label>
          <label>Ajouter un arrêt
            <div class="station-search-wrap">
              <input id="editorStopSearch" class="station-search-input" value="${escapeAttr(app.lineEditor.candidateQuery)}" placeholder="Ex : Bayeux, Caen, Paris..." autocomplete="off">
              <input id="editorStopId" type="hidden" value="${escapeAttr(app.lineEditor.candidateId)}">
              <div id="editorStopSuggestions" class="station-suggestions"></div>
            </div>
          </label>
          <button id="addEditorStopBtn" type="button" class="primary">Ajouter à la ligne</button>
        </div>
      </div>

      <button id="saveLineBtn" type="button" class="primary">Enregistrer</button>
    </div>
  `;
  };

  openModal('Modifier la ligne', renderEditorHtml());

  const rerenderBody = () => {
    $('#modalBody').innerHTML = renderEditorHtml();
    bindEditor();
  };

  const moveStop = (fromIndex, toIndex) => {
    const stops = app.lineEditor.stops;
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
    if (fromIndex < 0 || fromIndex >= stops.length || toIndex < 0 || toIndex >= stops.length || fromIndex === toIndex) return;
    const [item] = stops.splice(fromIndex, 1);
    stops.splice(toIndex, 0, item);
    app.lineEditor.insertAfter = 'auto';
    rerenderBody();
  };

  const bindEditor = () => {
    const syncEditorTicketControls = sourceId => {
      const editorDistance = getRouteForStops(app.lineEditor.stops).distance || 0;
      const control = sourceId === 'editLineTicketPriceRange' ? $('#editLineTicketPriceRange') : $('#editLineTicketPrice');
      app.lineEditor.ticketPrice = normalizeTicketPrice(control?.value, app.lineEditor.ticketPrice, editorDistance);
      app.lineEditor.tariff = ticketPriceToTariff(app.lineEditor.ticketPrice, editorDistance);
      refreshTicketPriceControl('editLineTicketPrice', 'editLineTicketPriceRange', 'editLineTicketPriceHint', editorDistance, app.lineEditor.ticketPrice, sourceId);
    };
    $('#editLineService')?.addEventListener('change', e => app.lineEditor.service = e.target.value);
    document.querySelectorAll('.edit-line-train-check').forEach(input => input.addEventListener('change', () => {
      const checked = [...document.querySelectorAll('.edit-line-train-check:checked')].map(item => item.value);
      app.lineEditor.trainIds = checked;
      document.querySelectorAll('.line-train-choice').forEach(label => {
        const box = label.querySelector('.edit-line-train-check');
        const selected = !!box?.checked;
        label.classList.toggle('selected', selected);
        const check = label.querySelector('.line-train-choice-check');
        if (check) check.textContent = selected ? '✓' : '';
      });
      const tag = document.querySelector('.line-editor-subtitle .tag');
      if (tag) {
        tag.classList.toggle('good', checked.length > 0);
        tag.classList.toggle('warn', checked.length <= 0);
        tag.textContent = `${checked.length} sélectionné${checked.length > 1 ? 's' : ''}`;
      }
    }));
    $('#editLineTicketPrice').addEventListener('input', () => syncEditorTicketControls('editLineTicketPrice'));
    $('#editLineTicketPrice').addEventListener('change', () => syncEditorTicketControls('editLineTicketPrice'));
    $('#editLineTicketPriceRange').addEventListener('input', () => syncEditorTicketControls('editLineTicketPriceRange'));
    $('#editLineTicketPriceRange').addEventListener('change', () => syncEditorTicketControls('editLineTicketPriceRange'));
    $('#lineEditorInsertPos').addEventListener('change', e => app.lineEditor.insertAfter = e.target.value);
    $('#editorStopSearch').addEventListener('input', e => {
      app.lineEditor.candidateQuery = e.target.value;
      const matches = findStationMatches(e.target.value, 10);
      const box = $('#editorStopSuggestions');
      box.innerHTML = matches.length ? matches.map(s => `
        <button type="button" class="station-suggest-item" data-role="editor" data-station-choice="${escapeAttr(s.id)}">
          <strong>${escapeHtml(s.name)}</strong>
          <span>${escapeHtml(stationMetaLabel(s))}</span>
        </button>
      `).join('') : '<div class="station-suggest-empty">Aucune ville trouvée.</div>';
    });
    $('#editorStopSuggestions').addEventListener('click', event => {
      const btn = event.target.closest('[data-station-choice]');
      if (!btn) return;
      chooseStationSuggestion('editor', btn.dataset.stationChoice);
    });
    $('#addEditorStopBtn').addEventListener('click', () => {
      const stopId = app.lineEditor.candidateId || $('#editorStopId').value;
      if (!stopId || !station(stopId)) return toast('Choisis un arrêt valide.', 'error');
      if (app.lineEditor.stops.includes(stopId)) return toast('Cet arrêt est déjà présent sur la ligne.', 'error');

      if (app.lineEditor.insertAfter === 'auto') {
        app.lineEditor.stops = insertStopAtBestIntermediatePosition(app.lineEditor.stops, stopId);
      } else {
        const afterIndex = Number(app.lineEditor.insertAfter);
        app.lineEditor.stops.splice(afterIndex + 1, 0, stopId);
      }

      app.lineEditor.candidateId = '';
      app.lineEditor.candidateQuery = '';
      app.lineEditor.insertAfter = 'auto';
      rerenderBody();
    });

    document.querySelectorAll('[data-editor-remove]').forEach(btn => btn.addEventListener('click', () => {
      if (app.lineEditor.stops.length <= 2) return;
      app.lineEditor.stops.splice(Number(btn.dataset.editorRemove), 1);
      app.lineEditor.insertAfter = 'auto';
      rerenderBody();
    }));

    document.querySelectorAll('[data-editor-move]').forEach(btn => btn.addEventListener('click', () => {
      moveStop(Number(btn.dataset.editorMove), Number(btn.dataset.editorMove) + Number(btn.dataset.direction));
    }));

    document.querySelectorAll('.editor-stop-row').forEach(row => {
      row.addEventListener('dragstart', event => {
        app.lineEditor.draggingIndex = Number(row.dataset.editorStopIndex);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(app.lineEditor.draggingIndex));
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        app.lineEditor.draggingIndex = null;
      });
      row.addEventListener('dragover', event => {
        event.preventDefault();
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', event => {
        event.preventDefault();
        row.classList.remove('drag-over');
        const from = Number(event.dataTransfer.getData('text/plain'));
        const to = Number(row.dataset.editorStopIndex);
        moveStop(from, to);
      });
    });

    $('#saveLineBtn').addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();

      const editorDistance = getRouteForStops(app.lineEditor.stops).distance || 0;
      const input = $('#editLineTicketPrice');
      const range = $('#editLineTicketPriceRange');
      const rawPrice = input?.value !== undefined && input?.value !== '' ? input.value : range?.value;
      const ticketPrice = normalizeTicketPrice(rawPrice, app.lineEditor.ticketPrice, editorDistance);
      app.lineEditor.ticketPrice = ticketPrice;
      app.lineEditor.tariff = ticketPriceToTariff(ticketPrice, editorDistance);
      if (input) input.value = String(ticketPrice);
      refreshTicketPriceControl('editLineTicketPrice', 'editLineTicketPriceRange', 'editLineTicketPriceHint', editorDistance, ticketPrice, 'editLineTicketPrice');

      const response = await performAction('updateLine', {
        lineId,
        trainIds: [...app.lineEditor.trainIds],
        service: $('#editLineService')?.value || app.lineEditor.service,
        ticketPrice,
        stops: [...app.lineEditor.stops],
        preserveOrder: true
      });

      if (response?.ok) {
        const modal = $('#modal');
        if (modal?.open) modal.close();
        app.lineEditor = null;
      }
    });
  };

  bindEditor();
}

function openCompanyModal() {
  if (!app.state?.me) return;
  openModal('Compagnie', `
    <div class="form-grid">
      <label>Nom <input id="renameName" maxlength="28" value="${escapeAttr(app.state.me.name)}"></label>
      <label>Couleur <input id="renameColor" type="color" value="${escapeAttr(app.state.me.color)}"></label>
      <button id="saveCompanyBtn" class="primary" value="close">Enregistrer</button>
    </div>
  `);
  $('#saveCompanyBtn').addEventListener('click', () => doAction('rename', { name: $('#renameName').value, color: $('#renameColor').value }));
}

function openResetModal() {
  if (!app.state?.me) return;
  openModal('Réinitialiser la compagnie', `
    <p>Cette action supprime ta compagnie de cette sauvegarde serveur.</p>
    <p class="muted small">Tape <code>RESET</code> pour confirmer.</p>
    <div class="form-grid">
      <input id="resetConfirm" placeholder="RESET">
      <button id="confirmResetBtn" class="danger" value="close">Supprimer</button>
    </div>
  `);
  $('#confirmResetBtn').addEventListener('click', async () => {
    const confirm = $('#resetConfirm').value;
    await doAction('resetCompany', { confirm });
    if (confirm === 'RESET') {
      await logoutAccount();
    }
  });
}


function openChangelogModal() {
  openModal('Changelog', `
    <div class="changelog-popup changelog-popup--loading">
      <p class="muted">Chargement du changelog…</p>
    </div>
  `, { wide: true });

  fetch('/api/changelog', { cache: 'no-store' })
    .then(response => readJsonResponse(response, 'Changelog invalide.'))
    .then(data => {
      if (!data?.ok) throw new Error(data?.error || 'Changelog indisponible.');
      const modalBody = $('#modalBody');
      if (!modalBody) return;
      modalBody.innerHTML = `
        <div class="changelog-popup">
          <div class="changelog-intro">
            <strong>${escapeHtml(data.version || PROJECT_VERSION)}</strong>
            <span class="muted small">Versions les plus récentes en premier.</span>
          </div>
          ${renderChangelogMarkdown(data.changelog || '')}
        </div>
      `;
    })
    .catch(error => {
      const modalBody = $('#modalBody');
      if (!modalBody) return;
      modalBody.innerHTML = `
        <div class="changelog-popup">
          <p class="bad-text">Impossible de charger le changelog.</p>
          <p class="muted small">${escapeHtml(error.message)}</p>
        </div>
      `;
    });
}

function renderChangelogMarkdown(markdown) {
  const ordered = sortChangelogSections(markdown);
  const lines = ordered.split(/\r?\n/);
  const html = [];
  let listOpen = false;
  let entryOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push('</ul>');
      listOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^#\s+CHANGELOG\s*$/i.test(line)) {
      closeList();
      continue;
    }
    const versionMatch = line.match(/^##\s+(.+)$/);
    if (versionMatch) {
      closeList();
      if (entryOpen) html.push('</section>');
      html.push(`<section class="changelog-entry"><h3>${formatChangelogInline(versionMatch[1])}</h3>`);
      entryOpen = true;
      continue;
    }
    const subheadingMatch = line.match(/^###\s+(.+)$/);
    if (subheadingMatch) {
      closeList();
      html.push(`<h4>${formatChangelogInline(subheadingMatch[1])}</h4>`);
      continue;
    }
    const bulletMatch = line.match(/^-\s+(.+)$/);
    if (bulletMatch) {
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      html.push(`<li>${formatChangelogInline(bulletMatch[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${formatChangelogInline(line)}</p>`);
  }
  closeList();
  if (entryOpen) html.push('</section>');
  return html.join('');
}

function sortChangelogSections(markdown) {
  const text = String(markdown || '').replace(/\r\n/g, '\n');
  const firstSectionIndex = text.search(/^##\s+Version\s+v/im);
  if (firstSectionIndex < 0) return text;

  const intro = text.slice(0, firstSectionIndex).trim();
  const body = text.slice(firstSectionIndex);
  const matches = [...body.matchAll(/^##\s+Version\s+v([0-9]+(?:\.[0-9]+)*).*$/gim)];
  if (!matches.length) return text;

  const sections = matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : body.length;
    return {
      version: parseVersionParts(match[1]),
      order: index,
      content: body.slice(start, end).trim()
    };
  });

  sections.sort((a, b) => compareVersionParts(b.version, a.version) || b.order - a.order);
  return [intro, sections.map(section => section.content).join('\n\n')].filter(Boolean).join('\n\n');
}

function parseVersionParts(version) {
  return String(version || '').split('.').map(part => Number(part) || 0);
}

function compareVersionParts(a, b) {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

function formatChangelogInline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function openModal(title, html, options = {}) {
  const modal = $('#modal');
  modal.classList.toggle('modal--wide', !!options.wide);
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  modal.showModal();
}


function gameConfirm(title, message, options = {}) {
  const modal = $('#modal');
  if (!modal) return Promise.resolve(false);
  return new Promise(resolve => {
    const confirmLabel = options.confirmLabel || 'Confirmer';
    const cancelLabel = options.cancelLabel || 'Annuler';
    const danger = !!options.danger;
    let settled = false;

    const finish = value => {
      if (settled) return;
      settled = true;
      modal.removeEventListener('close', onClose);
      if (modal.open) modal.close();
      resolve(!!value);
    };
    const onClose = () => finish(false);

    modal.classList.toggle('modal--wide', !!options.wide);
    $('#modalTitle').textContent = title || 'Confirmation';
    $('#modalBody').innerHTML = `
      <div class="game-confirm">
        <div class="game-confirm-icon ${danger ? 'danger' : ''}">${danger ? '!' : '?'}</div>
        <div class="game-confirm-copy">${String(message || '').split('\n').map(line => `<p>${escapeHtml(line || ' ')}</p>`).join('')}</div>
        <div class="game-confirm-actions">
          <button type="button" class="ghost" data-confirm-cancel>${escapeHtml(cancelLabel)}</button>
          <button type="button" class="${danger ? 'danger confirm-danger' : 'primary'}" data-confirm-ok>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;
    modal.addEventListener('close', onClose, { once: true });
    $('#modalBody').querySelector('[data-confirm-cancel]')?.addEventListener('click', () => finish(false));
    $('#modalBody').querySelector('[data-confirm-ok]')?.addEventListener('click', () => finish(true));
    modal.showModal();
  });
}

function resizeCanvas() {
  if (!app.map.canvas || !app.map.ctx) return;
  const holder = $('#osmMap') || app.map.canvas;
  const rect = holder.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const width = Math.max(400, Math.ceil(rect.width));
  const height = Math.max(300, Math.ceil(rect.height));
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.floor(width * dpr);
  const pixelHeight = Math.floor(height * dpr);
  const sizeChanged = app.map.canvas.width !== pixelWidth || app.map.canvas.height !== pixelHeight || app.map.width !== width || app.map.height !== height || app.map.dpr !== dpr;

  app.map.dpr = dpr;
  app.map.width = width;
  app.map.height = height;

  if (app.map.canvas.width !== pixelWidth || app.map.canvas.height !== pixelHeight) {
    app.map.canvas.width = pixelWidth;
    app.map.canvas.height = pixelHeight;
  }
  app.map.canvas.style.width = '100%';
  app.map.canvas.style.height = '100%';
  app.map.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (sizeChanged) {
    invalidateMapProjection('canvas-resize');
    scheduleLeafletInvalidateSize();
  }
}

function scheduleLeafletInvalidateSize() {
  if (!app.map.leaflet || app.map.invalidatingSize) return;
  app.map.invalidatingSize = true;
  requestAnimationFrame(() => {
    try {
      app.map.leaflet.invalidateSize({ pan: false, animate: false });
    } finally {
      app.map.invalidatingSize = false;
    }
  });
}

function hasPixelMapArt() {
  const img = artImages[ART.map];
  return !!(img && img.complete && img.naturalWidth);
}

function updateMapFrame() {
  const w = app.map.width;
  const h = app.map.height;
  if (!w || !h) return;
  const img = artImages[ART.map];
  const iw = img?.naturalWidth || 1672;
  const ih = img?.naturalHeight || 1024;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  app.map.frame = {
    image: { x: dx, y: dy, width: dw, height: dh },
    france: {
      x: dx + dw * MAP_ART_FRAME.x,
      y: dy + dh * MAP_ART_FRAME.y,
      width: dw * MAP_ART_FRAME.w,
      height: dh * MAP_ART_FRAME.h
    }
  };
}


function drawLoop(timestamp = performance.now()) {
  if (document.hidden) {
    app.map.lastDrawAt = timestamp;
    requestAnimationFrame(drawLoop);
    return;
  }

  if (app.map.panOverlay.active) {
    // Pendant le déplacement Leaflet, on ne redessine plus le canvas :
    // il est simplement translaté par GPU, puis recalculé au moveend.
    requestAnimationFrame(drawLoop);
    return;
  }

  const moving = app.map.navigating;
  const delay = moving ? 84 : 33; // ~12 fps pendant le zoom, ~30 fps le reste.
  if (timestamp - app.map.lastDrawAt >= delay) {
    drawMap({ lite: moving });
    app.map.lastDrawAt = timestamp;
    if (!moving) app.map.lastFullDrawAt = timestamp;
  }
  requestAnimationFrame(drawLoop);
}

function drawMap(options = {}) {
  if (!app.state?.world || !app.map.ctx) return;
  const ctx = app.map.ctx;
  const w = app.map.width;
  const h = app.map.height;
  if (!w || !h) return;

  if (app.map.needsRouteReproject) invalidateMapProjection('dirty-projection');

  const lite = !!options.lite;
  ctx.clearRect(0, 0, w, h);
  drawAllLines(ctx, lite);
  drawStations(ctx, lite);
  if (!lite) drawMapHud(ctx);
  if (!lite) drawTooltip(ctx);
}



function drawMapHud(ctx) {
  if (!app.map.leaflet) return;
  ctx.save();
  const zoom = app.map.leaflet.getZoom();
  const label = zoom >= 9 ? `Carte · zoom ${zoom} · vue isométrique visuelle` : `Carte · zoom ${zoom}`;
  ctx.font = '12px "Trebuchet MS", system-ui';
  const width = ctx.measureText(label).width + 18;
  const x = app.map.width - width - 18;
  const y = app.map.height - 34;
  ctx.fillStyle = 'rgba(7, 12, 22, 0.82)';
  ctx.strokeStyle = 'rgba(217, 168, 82, 0.25)';
  roundRect(ctx, x, y, width, 22, 10);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f0dfb8';
  ctx.fillText(label, x + 9, y + 15);
  ctx.restore();
}

function drawBackdropArt(ctx, w, h) {
  const img = artImages[ART.map];
  if (!img || !img.complete || !img.naturalWidth) return;
  updateMapFrame();
  const frame = app.map.frame?.image;
  if (!frame) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame.x, frame.y, frame.width, frame.height);
  ctx.restore();
}

function drawSea(ctx, w, h) {
  ctx.save();
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#0a2340');
  gradient.addColorStop(0.55, '#0c355a');
  gradient.addColorStop(1, '#07182d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const shimmer = ctx.createRadialGradient(w * 0.22, h * 0.16, 10, w * 0.22, h * 0.16, w * 0.75);
  shimmer.addColorStop(0, 'rgba(147, 197, 253, 0.16)');
  shimmer.addColorStop(1, 'rgba(147, 197, 253, 0)');
  ctx.fillStyle = shimmer;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawGrid(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(191, 219, 254, 0.045)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.restore();
}

function drawFrance(ctx) {
  const outlines = app.state.world.outlines || [app.state.world.outline || []];
  ctx.save();
  const land = ctx.createLinearGradient(0, 0, app.map.width, app.map.height);
  land.addColorStop(0, '#1f5f4a');
  land.addColorStop(0.45, '#2f7c5f');
  land.addColorStop(1, '#8aa163');

  const relief = ctx.createLinearGradient(app.map.width * 0.2, 0, app.map.width * 0.8, app.map.height);
  relief.addColorStop(0, 'rgba(255,255,255,0.16)');
  relief.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  relief.addColorStop(1, 'rgba(0,0,0,0.12)');

  ctx.shadowColor = 'rgba(2, 6, 23, 0.42)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  for (const outline of outlines) {
    if (!outline?.length) continue;
    pathFromLonLat(ctx, outline);
    ctx.fillStyle = land;
    ctx.fill();
    pathFromLonLat(ctx, outline);
    ctx.fillStyle = relief;
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  for (const outline of outlines) {
    if (!outline?.length) continue;
    pathFromLonLat(ctx, outline);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.lineWidth = 2.3;
    ctx.stroke();
    pathFromLonLat(ctx, outline);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.lineWidth = 7;
    ctx.stroke();
  }

  // subtle internal texture clipped to land
  ctx.save();
  for (const outline of outlines) {
    if (!outline?.length) continue;
    pathFromLonLat(ctx, outline);
  }
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.lineWidth = 1;
  for (let i = -app.map.height; i < app.map.width; i += 18) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + app.map.height * 0.5, app.map.height);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function pathFromLonLat(ctx, coords) {
  ctx.beginPath();
  coords.forEach(([lon, lat], i) => {
    const p = project(lon, lat);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
}

function drawBaseRailNetwork(ctx) {
  const graph = app.state.world.railGraph || [];
  if (!graph.length) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.16)';
  ctx.lineWidth = 1.25;
  ctx.setLineDash([]);
  for (const [from, to] of graph) {
    const aStation = station(from);
    const bStation = station(to);
    if (!aStation || !bStation) continue;
    const a = projectStationPoint(aStation);
    const b = projectStationPoint(bStation);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}


function visualLineWithEffectiveFrequency(line) {
  return line;
}

function drawAllLines(ctx, lite = false) {
  const players = app.state.players || [];
  const me = app.state.me || null;
  const maxZoom = mapMaxZoomReached();

  const drawLinesForPlayer = (player, own = false) => {
    if (!player) return;
    for (const line of player.lines || []) {
      if (!line.active) continue;
      const route = getRouteForStops(lineStopsOf(line));
      if (!route.points.length) continue;

      drawRailLine(ctx, route.points, player.color, own, line.electrified, lite);
      if (lite) continue;

      // Les trains du joueur connecté sont toujours dessinés.
      // Ceux des autres compagnies restent masqués tant que le zoom maximal n'est pas atteint.
      if (!own && !maxZoom) continue;

      const trains = lineAssignedTrainsClient(line, player)
        .filter(t => !t.maintenance?.active && Number(t.condition || 0) > 0);
      if (!trains.length) continue;

      // Les états de pénurie masquent seulement les trains concurrents.
      // Le joueur connecté doit toujours voir son exploitation et son animation.
      if (!own && (
        line.stats?.status === 'resource-shortage'
        || line.stats?.status === 'driver-shortage'
        || line.stats?.status === 'train-out-of-service'
      )) continue;

      const visualLine = visualLineWithEffectiveFrequency(line);
      const speeds = trains.map(train => {
        const model = app.state.balance.trains[train.modelId];
        return model ? trainVisualAverageSpeedKmH(train, model, visualLine) : 0;
      }).filter(speed => speed > 0);
      const averageSpeed = speeds.length ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 70;

      trains.forEach((train, index) => {
        const model = app.state.balance.trains[train.modelId];
        if (!model) return;
        drawTrainSprite(ctx, route.points, player.color, { ...visualLine, id: `${player.id}:${line.id}`, visualAverageSpeed: averageSpeed }, model, own, train, index, trains.length);
      });
    }
  };

  for (const player of players) {
    if (me && player.id === me.id) continue;
    drawLinesForPlayer(player, false);
  }
  drawLinesForPlayer(me, true);
}

function drawRailLine(ctx, points, color, own, electrified, lite = false) {
  if (!points?.length) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = own ? 0.96 : 0.68;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);

  // sleeper/shadow pass
  ctx.strokeStyle = 'rgba(10, 15, 24, 0.85)';
  ctx.lineWidth = own ? 8 : 6;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  // main rail pass
  ctx.strokeStyle = color || '#d9a852';
  ctx.lineWidth = own ? 4 : 2.8;
  ctx.shadowColor = color || 'rgba(236, 205, 127, 0.25)';
  ctx.shadowBlur = lite ? 0 : (own ? 8 : 3);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  if (electrified) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(160, 220, 255, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y - 2);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y - 2);
    ctx.stroke();
  }
  ctx.restore();
}

function trainVisualAverageSpeedKmH(train, model, line) {
  const profile = train ? trainRuntimeProfile(train, model) : {};
  const maxSpeed = Number(profile.speed || model?.speed || 90);
  const condition = Math.max(0.35, Math.min(1, Number(train?.condition ?? 0.9)));
  const stopCount = Math.max(2, lineStopsOf(line).length);
  const stopPenalty = Math.max(0.58, 1 - Math.max(0, stopCount - 2) * 0.045);
  const servicePenalty = line?.service === 'freight' ? 0.62 : line?.service === 'mixed' ? 0.68 : 0.74;
  const conditionPenalty = 0.72 + condition * 0.28;
  return Math.max(18, maxSpeed * servicePenalty * stopPenalty * conditionPenalty);
}

function trainVisualOneWaySeconds(line, train, model) {
  const distanceKm = Math.max(1, Number(lineDistance(line) || 1));
  const averageSpeed = Number(line?.visualAverageSpeed || 0) > 0
    ? Number(line.visualAverageSpeed)
    : trainVisualAverageSpeedKmH(train, model, line);
  const travelHours = distanceKm / Math.max(1, averageSpeed);
  const secondsPerTravelHour = 18;
  return Math.max(5.5, Math.min(55, travelHours * secondsPerTravelHour));
}

function trainVisualInstanceCount(line) {
  return Math.max(1, Math.round(Number(line?.slotUsage?.used || line?.trainCount || 1)));
}

function trainVisualPhase(line, train, model, instanceIndex = 0, instanceCount = 1) {
  const oneWaySeconds = trainVisualOneWaySeconds(line, train, model);
  const roundTripMs = oneWaySeconds * 2 * 1000;
  const key = `${line.id}:${train?.id || 'train'}:${instanceIndex}`;
  const now = performance.now();
  const motion = app.map.trainMotion || (app.map.trainMotion = {});
  let entry = motion[key];
  if (!entry) {
    const seed = (hashCode(`${line.id}:${train?.id || ''}`) % 10000) / 10000;
    const offset = instanceCount > 1 ? instanceIndex / instanceCount : 0;
    entry = motion[key] = { phase: (seed + offset) % 2, lastAt: now };
  } else {
    const elapsed = Math.max(0, Math.min(250, now - Number(entry.lastAt || now)));
    const phaseDelta = elapsed * 2 / Math.max(1000, roundTripMs);
    entry.phase = (Number(entry.phase || 0) + phaseDelta) % 2;
    entry.lastAt = now;
  }
  return entry.phase;
}

function drawTrainDot(ctx, points, color, line, model, own, train, instanceIndex = 0, instanceCount = 1) {
  const phase = trainVisualPhase(line, train, model, instanceIndex, instanceCount);
  const reverse = phase > 1;
  const progress = reverse ? 2 - phase : phase;
  const t = Math.max(0.001, Math.min(0.999, progress));
  const pose = pointAndAngleAlongPolyline(points, t);
  const speed = Number(line?.visualAverageSpeed || trainVisualAverageSpeedKmH(train, model, line) || 0);
  const normalizedSpeed = clamp((speed - 35) / 165, 0, 1);
  const trainCount = Math.max(1, instanceCount);
  const densityShrink = clamp(1 - Math.max(0, trainCount - 1) * 0.025, 0.78, 1);
  const radius = (own ? 7.2 : 5.8) * densityShrink;
  const haloRadius = radius + 4 + normalizedSpeed * 3;
  const pulse = 0.72 + 0.28 * Math.sin(performance.now() / 260 + instanceIndex * 0.9);
  const directionX = Math.cos(reverse ? pose.angle + Math.PI : pose.angle);
  const directionY = Math.sin(reverse ? pose.angle + Math.PI : pose.angle);
  const dotColor = color || '#d9a852';

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = own ? 0.98 : 0.88;

  ctx.shadowColor = dotColor;
  ctx.shadowBlur = own ? 14 + normalizedSpeed * 6 : 8 + normalizedSpeed * 3;

  ctx.beginPath();
  ctx.arc(0, 0, haloRadius * pulse, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(dotColor, own ? 0.18 : 0.12);
  ctx.fill();

  // Trainée dans le sens de circulation. Sa longueur reflète la vitesse moyenne.
  const trailLength = 8 + normalizedSpeed * 12;
  const gradient = ctx.createLinearGradient(-directionX * trailLength, -directionY * trailLength, 0, 0);
  gradient.addColorStop(0, hexToRgba(dotColor, 0));
  gradient.addColorStop(1, hexToRgba(dotColor, own ? 0.55 : 0.38));
  ctx.strokeStyle = gradient;
  ctx.lineWidth = Math.max(2.2, radius * 0.52);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-directionX * trailLength, -directionY * trailLength);
  ctx.lineTo(-directionX * radius * 0.45, -directionY * radius * 0.45);
  ctx.stroke();

  ctx.shadowBlur = own ? 10 : 5;
  ctx.beginPath();
  ctx.arc(0, 0, radius + 1.8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(5, 10, 18, 0.96)';
  ctx.fill();

  const dotGradient = ctx.createRadialGradient(-radius * 0.35, -radius * 0.45, 1, 0, 0, radius + 1);
  dotGradient.addColorStop(0, 'rgba(255,255,255,0.92)');
  dotGradient.addColorStop(0.22, '#f8df98');
  dotGradient.addColorStop(0.5, dotColor);
  dotGradient.addColorStop(1, own ? '#16372b' : '#2b2134');
  ctx.fillStyle = dotGradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = own ? 2 : 1.4;
  ctx.strokeStyle = own ? 'rgba(252, 230, 170, 0.95)' : 'rgba(252, 230, 170, 0.62)';
  ctx.stroke();

  if (trainCount > 1) {
    ctx.font = `${Math.max(8, Math.round(radius * 1.08))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(3, 8, 14, 0.92)';
    ctx.fillText(String(instanceIndex + 1), 0, 0.4);
  }
  ctx.restore();
}

function drawTrainSprite(ctx, points, color, line, model, own, train = null, instanceIndex = 0, instanceCount = 1) {
  if (!points?.length) return;
  drawTrainDot(ctx, points, color, line, model, own, train, instanceIndex, Math.max(1, instanceCount));
}

function drawPixelTrainBody(ctx, color, model) {
  ctx.fillStyle = 'rgba(8, 12, 18, 0.95)';
  ctx.fillRect(-14, -7, 28, 14);
  ctx.fillStyle = color;
  ctx.fillRect(-12, -5, 22, 10);
  ctx.fillStyle = '#f3d48a';
  ctx.fillRect(10, -2, 4, 4);
  ctx.fillStyle = '#dbeafe';
  ctx.fillRect(-8, -4, 4, 3);
  ctx.fillRect(-3, -4, 4, 3);
  if ((model?.capacity || 0) > 100 || model?.type?.toLowerCase().includes('tgv')) {
    ctx.fillStyle = 'rgba(8, 12, 18, 0.95)';
    ctx.fillRect(14, -5, 10, 10);
    ctx.fillStyle = color;
    ctx.fillRect(15, -4, 8, 8);
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(17, -3, 4, 2);
  }
  // rails
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#2c3647';
  ctx.fillRect(-15, 7, 12, 2);
  ctx.fillRect(2, 7, 12, 2);
}

function drawSteamPuffs(ctx, t) {
  const phase = (t * 8) % 1;
  ctx.fillStyle = 'rgba(245, 245, 245, 0.85)';
  ctx.fillRect(-15 - phase * 8, -10, 4, 4);
  ctx.fillStyle = 'rgba(220, 225, 235, 0.65)';
  ctx.fillRect(-19 - phase * 10, -14, 5, 5);
}

function drawDieselExhaust(ctx, t) {
  const phase = (t * 7) % 1;
  ctx.fillStyle = 'rgba(170, 180, 190, 0.55)';
  ctx.fillRect(-16 - phase * 9, -11, 4, 4);
}

function drawPantographSpark(ctx, t) {
  if ((t * 10) % 1 > 0.55) return;
  ctx.fillStyle = 'rgba(125, 211, 252, 0.9)';
  ctx.fillRect(-2, -10, 5, 2);
  ctx.fillRect(0, -12, 2, 2);
}

function pointAndAngleAlongPolyline(points, t) {
  const p = pointAlongPolyline(points, t);
  const p2 = pointAlongPolyline(points, Math.min(0.999, t + 0.01));
  return { x: p.x, y: p.y, angle: Math.atan2(p2.y - p.y, p2.x - p.x) };
}

function polylineMetrics(points) {
  if (points._metrics) return points._metrics;
  const segments = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const len = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    total += len;
    segments.push({ len, total });
  }
  points._metrics = { segments, total };
  return points._metrics;
}

function pointAlongPolyline(points, t) {
  if (points.length === 1) return points[0];
  const { segments, total } = polylineMetrics(points);
  let target = total * t;
  for (let i = 1; i < points.length; i++) {
    const len = segments[i - 1]?.len || 0;
    if (target <= len) {
      const r = len ? target / len : 0;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * r,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * r
      };
    }
    target -= len;
  }
  return points[points.length - 1];
}


function shouldDrawStation(s, asset, selected) {
  if (selected || asset) return true;
  const zoom = app.map.leaflet?.getZoom?.() || 6;
  const pop = Number(s.population || s.baseDemand * 450 || 0);
  if (s.custom) return zoom >= 8;
  if (zoom < 6) return pop >= 200000 || s.id === 'PAR';
  if (zoom < 7) return pop >= 100000;
  if (zoom < 10) return pop >= 40000;
  if (!mapMaxZoomReached()) return pop >= 15000 || !s.commune;
  return pop >= 5000 || !s.commune;
}

function stationViewportCacheKey(lite = false) {
  const map = app.map.leaflet;
  const zoom = map?.getZoom?.() || 6;
  let boundsKey = 'static';
  if (map?.getBounds) {
    const b = map.getBounds();
    const round = v => Math.round(v * 20) / 20;
    boundsKey = `${round(b.getWest())},${round(b.getSouth())},${round(b.getEast())},${round(b.getNorth())}`;
  }
  const owned = Object.keys(app.state?.me?.stations || {}).sort().join(',');
  const stations = app.state?.world?.stations || [];
  const stationSignature = stationListSignature(stations);
  const collisionRadius = stationCollisionRadiusForZoom();
  return `${lite ? 'lite' : 'full'}:${Math.round(zoom * 2) / 2}:${collisionRadius}:${boundsKey}:${stationSignature}:${app.selectedStation || ''}:${owned}`;
}

function stationMapPriority(s, asset, selected, served) {
  const pop = Number(s.population || s.baseDemand * 450 || 0);
  if (selected) return 1_000_000_000;
  if (asset) return 900_000_000 + (asset.level || 1) * 100_000 + pop;
  if (served) return 800_000_000 + pop;
  if (!s.commune) return 700_000_000 + pop;
  if (s.custom) return 650_000_000 + pop;
  return pop;
}

function stationCollisionRadiusForZoom() {
  const zoom = Number(app.map.leaflet?.getZoom?.() || 6);
  const max = Number(app.map.leaflet?.getMaxZoom?.() || 13);
  if (zoom >= max) return 13;
  if (zoom >= max - 1) return 16;
  if (zoom >= 10) return 19;
  if (zoom >= 8) return 22;
  return 26;
}

function stationMarkerRadiusForItem(item) {
  if (item.selected) return 9;
  if (item.asset) return 7;
  if (item.custom) return 5.8;
  return 5;
}

function stationMarkerMinDistance(a, b, baseRadius) {
  return Math.max(baseRadius, stationMarkerRadiusForItem(a) + stationMarkerRadiusForItem(b) + 5);
}

function stationItemOverlaps(item, kept, baseRadius) {
  for (const other of kept) {
    const minDistance = stationMarkerMinDistance(item, other, baseRadius);
    if (Math.hypot(item.p.x - other.p.x, item.p.y - other.p.y) < minDistance) return true;
  }
  return false;
}

function drawableStations(lite = false) {
  const key = stationViewportCacheKey(lite);
  if (app.map.stationDrawCache.key === key) return app.map.stationDrawCache.items;

  const me = app.state.me;
  const servedStationIds = new Set((me?.lines || [])
    .filter(line => line.active)
    .flatMap(line => lineStopsOf(line)));
  const candidates = [];

  for (const s of dedupedStations(app.state.world.stations)) {
    const asset = me?.stations?.[s.id];
    const selected = app.selectedStation === s.id;
    const served = servedStationIds.has(s.id);
    if (lite && !selected && !asset && !s.custom) continue;
    if (!shouldDrawStation(s, asset, selected)) continue;
    const p = projectStationPoint(s);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < -40 || p.x > app.map.width + 40 || p.y < -40 || p.y > app.map.height + 40) continue;
    candidates.push({
      s,
      p,
      asset,
      selected,
      served,
      custom: !!s.custom,
      priority: stationMapPriority(s, asset, selected, served)
    });
  }

  const baseRadius = stationCollisionRadiusForZoom();
  const protectedItems = [];
  const normalItems = [];

  candidates
    .sort((a, b) => b.priority - a.priority || String(a.s.name || '').localeCompare(String(b.s.name || ''), 'fr'))
    .forEach(item => {
      if (item.selected || item.asset) protectedItems.push(item);
      else normalItems.push(item);
    });

  const kept = [];
  for (const item of protectedItems) {
    for (let i = kept.length - 1; i >= 0; i -= 1) {
      const other = kept[i];
      if (!other.selected && !other.asset && stationItemOverlaps(item, [other], baseRadius)) kept.splice(i, 1);
    }
    if (!stationItemOverlaps(item, kept.filter(other => other.selected || other.asset), baseRadius)) kept.push(item);
  }

  for (const item of normalItems) {
    if (!stationItemOverlaps(item, kept, baseRadius)) kept.push(item);
  }

  kept.sort((a, b) => a.priority - b.priority);
  app.map.stationDrawCache = { key, items: kept };
  return kept;
}

function drawStations(ctx, lite = false) {
  if (!lite) app.map.stationHit = [];
  const items = drawableStations(lite);
  const zoomMax = mapMaxZoomReached();
  const myLines = app.state?.me?.lines || [];

  for (const item of items) {
    const { s, p, asset, selected, custom } = item;
    const hover = !lite && app.hoverStation === s.id;
    const served = myLines.some(line => line.active && lineStopsOf(line).includes(s.id));
    const stage = stationPrestigeStage(asset);
    const sprite = asset ? getStationMapSprite(asset) : null;
    const showSprite = !!(zoomMax && sprite?.complete && sprite.naturalWidth && asset);
    const markerR = selected ? 9 : asset ? 7 : custom ? 5.8 : 5;

    if (!lite) app.map.stationHit.push({ id: s.id, x: p.x, y: p.y, r: showSprite ? 30 : (selected ? 24 : asset ? 20 : 16) });

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (showSprite) {
      const scale = (selected || hover ? 0.34 : 0.30) + stage * 0.014;
      const w = sprite.naturalWidth * scale;
      const h = sprite.naturalHeight * scale;
      const drawX = p.x - w / 2;
      const drawY = p.y - h - 8;

      roundRect(ctx, drawX - 4, drawY - 4, w + 8, h + 8, 9);
      ctx.fillStyle = 'rgba(4, 10, 18, 0.68)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = selected ? 'rgba(240,200,117,0.62)' : hover ? 'rgba(147,197,253,0.50)' : 'rgba(217,168,82,0.22)';
      ctx.stroke();

      ctx.drawImage(sprite, drawX, drawY, w, h);

      drawSmallMapMarker(ctx, p, 4, app.state.me?.color || '#d9a852', selected);

      if (!lite) {
        app.map.stationHit.push({ id: s.id, x: drawX, y: drawY, width: w, height: h, r: 0 });
      }
    } else {
      const fill = asset ? app.state.me.color : custom ? '#e0b34f' : 'rgba(238, 232, 210, 0.95)';
      drawSmallMapMarker(ctx, p, markerR, fill, selected);
      if (asset) {
        ctx.fillStyle = '#f5d07f';
        ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - markerR - 5), 2, 4);
      }
    }

    const shouldLabel = !lite && (selected || hover || served || asset?.level >= 3 || (custom && app.map.leaflet?.getZoom() >= 8));
    if (shouldLabel) {
      ctx.font = '12px "Trebuchet MS", system-ui';
      const label = shortStationName(s.name);
      const labelW = Math.min(170, ctx.measureText(label).width + 12);
      const lx = Math.round(p.x + 12);
      const ly = Math.round(showSprite ? p.y + 8 : p.y - 24);
      roundRect(ctx, lx, ly, labelW, 17, 7);
      ctx.fillStyle = hover ? 'rgba(2,6,23,.92)' : 'rgba(2,6,23,.82)';
      ctx.fill();
      ctx.strokeStyle = asset ? 'rgba(217,168,82,0.26)' : 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(246,236,214,.98)';
      ctx.fillText(label, lx + 6, ly + 12);
      app.map.stationHit.push({ id: s.id, x: lx, y: ly, width: labelW, height: 17, r: 0 });
    }

    ctx.restore();
  }
}

function shortStationName(name) {
  return String(name).replace(' Saint-Charles', '').replace(' Saint-Roch', '').replace(' Part-Dieu', '').replace(' Rive-Droite', '').replace(' Flandres', '').replace(' Matabiau', '').replace('-Ville', '').replace('-Jean', '');
}

function drawTooltip(ctx) {
  if (!app.hoverStation) return;
  const s = station(app.hoverStation);
  const hit = app.map.stationHit.find(h => h.id === app.hoverStation);
  if (!s || !hit) return;

  const owner = stationOwnerClient(s.id);
  const ownedByMe = owner?.player?.id === app.state?.me?.id;
  const asset = owner?.asset || null;
  const sprite = asset ? getStationMapSprite(asset) : null;
  const hasSprite = Boolean(asset && sprite?.complete && sprite.naturalWidth);

  const lines = (app.state.players || [])
    .flatMap(player => (player.lines || []).map(line => ({ ...line, owner: player })))
    .filter(line => line.active && lineStopsOf(line).includes(s.id));

  const stage = stationPrestigeStage(asset);
  const level = Number(asset?.level || 0);
  const commerce = Number(asset?.commerce || 0);
  const maintenance = Number(asset?.maintenance || 0);

  const margin = 12;
  const width = Math.min(hasSprite ? 386 : 286, Math.max(220, app.map.width - margin * 2));
  const height = Math.min(hasSprite ? 226 : 190, Math.max(150, app.map.height - margin * 2));
  const anchorX = Number.isFinite(hit.width) ? hit.x + hit.width : hit.x;
  const anchorY = Number.isFinite(hit.height) ? hit.y : hit.y;

  let x = anchorX + 18;
  if (x + width > app.map.width - margin) x = anchorX - width - 18;
  x = Math.max(margin, Math.min(app.map.width - width - margin, x));

  let y = anchorY - Math.round(height * 0.48);
  y = Math.max(margin, Math.min(app.map.height - height - margin, y));

  ctx.save();
  ctx.imageSmoothingEnabled = true;

  // Lien visuel entre le marqueur et la fiche, toujours borné dans le canvas.
  ctx.strokeStyle = 'rgba(217,168,82,.42)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hit.x, hit.y);
  ctx.lineTo(x > anchorX ? x : x + width, y + height * 0.5);
  ctx.stroke();

  // Fond principal.
  ctx.shadowColor = 'rgba(0,0,0,.42)';
  ctx.shadowBlur = 24;
  roundRect(ctx, x, y, width, height, 16);
  const panel = ctx.createLinearGradient(x, y, x + width, y + height);
  panel.addColorStop(0, 'rgba(6,13,26,.98)');
  panel.addColorStop(0.58, 'rgba(12,24,43,.97)');
  panel.addColorStop(1, 'rgba(24,32,47,.98)');
  ctx.fillStyle = panel;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(217,168,82,.40)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Bandeau haut.
  roundRect(ctx, x + 1, y + 1, width - 2, 46, 15);
  ctx.fillStyle = 'rgba(18,32,58,.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(81,142,205,.28)';
  ctx.beginPath();
  ctx.moveTo(x + 14, y + 47);
  ctx.lineTo(x + width - 14, y + 47);
  ctx.stroke();

  function fitTooltipText(text, maxWidth) {
    let value = String(text || '');
    if (ctx.measureText(value).width <= maxWidth) return value;
    while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
    return `${value}…`;
  }

  // Badge statut. Calculé avant les textes pour réserver l'espace à droite.
  const badgeText = owner ? `Niv. ${level || 1}` : 'Libre';
  ctx.font = '700 11px "Trebuchet MS", system-ui';
  const badgeW = Math.min(96, Math.ceil(ctx.measureText(badgeText).width) + 20);
  const reservedRight = badgeW + 24;
  const textMaxW = Math.max(96, width - reservedRight - 24);

  ctx.font = '700 15px "Trebuchet MS", system-ui';
  ctx.fillStyle = '#f6e8c9';
  ctx.fillText(fitTooltipText(shortStationName(s.name), textMaxW), x + 16, y + 20);

  ctx.font = '12px "Trebuchet MS", system-ui';
  ctx.fillStyle = '#b8aa84';
  const acquisitionCost = stationAcquisitionCost(s);
  const trafficText = s.annualPassengers ? ` · ${formatInt(s.annualPassengers)} voy./an` : '';
  const subtitle = owner
    ? `${ownedByMe ? 'Ta gare' : `Propriétaire : ${owner.player.name}`} · Prix base ${money(acquisitionCost)}${trafficText}`
    : `Achat requis · Prix ${money(acquisitionCost)}${trafficText}`;
  ctx.fillText(fitTooltipText(subtitle, textMaxW), x + 16, y + 38);

  roundRect(ctx, x + width - badgeW - 14, y + 11, badgeW, 23, 11);
  ctx.fillStyle = owner ? 'rgba(217,168,82,.18)' : 'rgba(148,163,184,.14)';
  ctx.fill();
  ctx.strokeStyle = owner ? 'rgba(217,168,82,.35)' : 'rgba(148,163,184,.22)';
  ctx.stroke();
  ctx.font = '700 11px "Trebuchet MS", system-ui';
  ctx.fillStyle = owner ? '#f0c875' : '#d1d5db';
  ctx.fillText(badgeText, x + width - badgeW - 4, y + 26);

  const contentY = y + 60;

  if (hasSprite) {
    const artX = x + 14;
    const artY = contentY;
    const artW = 154;
    const artH = 128;

    roundRect(ctx, artX, artY, artW, artH, 14);
    ctx.fillStyle = 'rgba(4,10,18,.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(217,168,82,.24)';
    ctx.stroke();

    roundRect(ctx, artX + 14, artY + artH - 26, artW - 28, 12, 6);
    ctx.fillStyle = 'rgba(17,24,39,.84)';
    ctx.fill();

    const maxW = artW - 22;
    const maxH = artH - 30;
    const scale = Math.min(maxW / sprite.naturalWidth, maxH / sprite.naturalHeight) * 1.12;
    const sw = Math.round(sprite.naturalWidth * scale);
    const sh = Math.round(sprite.naturalHeight * scale);
    const sx = artX + Math.round((artW - sw) / 2);
    const sy = artY + Math.round((artH - sh) / 2) - 2;

    ctx.shadowColor = 'rgba(0,0,0,.34)';
    ctx.shadowBlur = 10;
    ctx.drawImage(sprite, sx, sy, sw, sh);
    ctx.shadowBlur = 0;

    ctx.font = '700 11px "Trebuchet MS", system-ui';
    ctx.fillStyle = '#f0c875';
    ctx.fillText('Aperçu gare', artX + 14, artY + 19);
  }

  const infoX = hasSprite ? x + 184 : x + 16;
  const infoW = hasSprite ? width - 198 : width - 32;
  const chipW = Math.floor((infoW - 8) / 2);

  function chip(cx, cy, cw, label, value, accent = '#f6e8c9') {
    roundRect(ctx, cx, cy, cw, 40, 11);
    ctx.fillStyle = 'rgba(8,15,29,.58)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(81,142,205,.16)';
    ctx.stroke();

    ctx.font = '11px "Trebuchet MS", system-ui';
    ctx.fillStyle = '#b8aa84';
    ctx.fillText(label, cx + 9, cy + 15);

    ctx.font = '700 13px "Trebuchet MS", system-ui';
    ctx.fillStyle = accent;
    ctx.fillText(String(value), cx + 9, cy + 31);
  }

  chip(infoX, contentY, chipW, 'Dessertes', lines.length);
  chip(infoX + chipW + 8, contentY, chipW, 'Niveau', level || 0, '#f0c875');
  chip(infoX, contentY + 48, chipW, 'Commerce', commerce);
  chip(infoX + chipW + 8, contentY + 48, chipW, 'Atelier', maintenance);

  const footerY = y + height - 32;
  roundRect(ctx, x + 14, footerY, width - 28, 21, 10);
  ctx.fillStyle = owner ? (ownedByMe ? 'rgba(76,175,80,.16)' : 'rgba(217,168,82,.13)') : 'rgba(255,255,255,.055)';
  ctx.fill();
  ctx.strokeStyle = owner ? 'rgba(217,168,82,.22)' : 'rgba(255,255,255,.08)';
  ctx.stroke();

  ctx.font = '12px "Trebuchet MS", system-ui';
  ctx.fillStyle = owner ? (ownedByMe ? '#9be7a2' : '#f0c875') : '#d3c7ac';
  const footerText = owner
    ? (ownedByMe ? `Péage perçu · prix base ${money(acquisitionCost)}` : `Péage dû · prix base ${money(acquisitionCost)}`)
    : `Prix d’achat : ${money(acquisitionCost)}`;
  ctx.fillText(fitTooltipText(footerText, width - 54), x + 25, footerY + 14);

  ctx.restore();
}


function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function projectBaseSimple(lon, lat) {
  const b = app.state.world.bounds;
  const lat0 = ((b.minLat + b.maxLat) / 2) * Math.PI / 180;
  const minX = b.minLon * Math.cos(lat0);
  const maxX = b.maxLon * Math.cos(lat0);
  const xRaw = lon * Math.cos(lat0);

  if (app.map.frame?.france) {
    const frame = app.map.frame.france;
    const padX = frame.width * 0.04;
    const padY = frame.height * 0.04;
    const x = frame.x + padX + ((xRaw - minX) / (maxX - minX)) * (frame.width - padX * 2);
    const y = frame.y + padY + (1 - ((lat - b.minLat) / (b.maxLat - b.minLat))) * (frame.height - padY * 2);
    return { x, y };
  }

  const pad = Math.min(app.map.width, app.map.height) * 0.075;
  const x = pad + ((xRaw - minX) / (maxX - minX)) * (app.map.width - pad * 2);
  const y = pad + (1 - ((lat - b.minLat) / (b.maxLat - b.minLat))) * (app.map.height - pad * 2);
  return { x, y };
}

function correctedProjection(base) {
  if (!app.state?.world?.stations?.length || !app.map.frame?.image) return base;
  let sumW = 0, dx = 0, dy = 0;
  for (const [id, anchor] of Object.entries(MAP_CITY_ANCHORS)) {
    const s = station(id);
    if (!s) continue;
    const ref = projectBaseSimple(s.lon, s.lat);
    const target = artPoint(anchor[0], anchor[1]);
    const dist = Math.max(18, Math.hypot(base.x - ref.x, base.y - ref.y));
    const w = 1 / (dist * dist);
    sumW += w;
    dx += (target.x - ref.x) * w;
    dy += (target.y - ref.y) * w;
  }
  return sumW ? { x: base.x + dx / sumW, y: base.y + dy / sumW } : base;
}

function project(lon, lat) {
  if (app.map.leaflet && app.map.mapReady) {
    const p = app.map.leaflet.latLngToContainerPoint([lat, lon]);
    return { x: p.x, y: p.y };
  }
  return projectBaseSimple(lon, lat);
}


function stationRouteLon(station) {
  return Number(station?.railLon ?? station?.stationLon ?? station?.lon);
}

function stationRouteLat(station) {
  return Number(station?.railLat ?? station?.stationLat ?? station?.lat);
}

function projectStationPoint(station) {
  if (!station) return { x: NaN, y: NaN };
  return project(stationRouteLon(station), stationRouteLat(station));
}

function stationRouteDistanceClient(a, b) {
  const latA = stationRouteLat(a);
  const lonA = stationRouteLon(a);
  const latB = stationRouteLat(b);
  const lonB = stationRouteLon(b);
  if (![latA, lonA, latB, lonB].every(Number.isFinite)) return 0;
  return haversineClient(latA, lonA, latB, lonB);
}

function projectStationOnRailSegmentClient(station, segment) {
  const a = app.state?.world?.stationIndex?.[segment?.from];
  const b = app.state?.world?.stationIndex?.[segment?.to];
  if (!station || !a || !b) return null;
  const ax = Number(a.lon), ay = Number(a.lat);
  const bx = Number(b.lon), by = Number(b.lat);
  const px = Number(station.lon), py = Number(station.lat);
  if (![ax, ay, bx, by, px, py].every(Number.isFinite)) return null;
  const vx = bx - ax;
  const vy = by - ay;
  const denom = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / denom));
  const lon = ax + vx * t;
  const lat = ay + vy * t;
  return { lat, lon, distanceKm: haversineClient(py, px, lat, lon), from: segment.from, to: segment.to };
}

function nearestRailAnchorsForStationClient(station, count = 4) {
  const segments = app.state?.world?.railSegments || [];
  const ranked = segments
    .map(segment => ({ segment, snap: projectStationOnRailSegmentClient(station, segment) }))
    .filter(item => item.snap)
    .sort((a, b) => a.snap.distanceKm - b.snap.distanceKm);
  const anchors = [];
  for (const item of ranked.slice(0, Math.max(2, count))) {
    for (const id of [item.segment.from, item.segment.to]) {
      if (!anchors.includes(id)) anchors.push(id);
      if (anchors.length >= count) return anchors;
    }
  }
  return anchors;
}

function stationsShareProjectedRailSegmentClient(a, b) {
  const sa = station(a);
  const sb = station(b);
  if (!sa || !sb) return false;
  if (sa.railSegment && sb.railSegment && sa.railSegment === sb.railSegment) return true;
  if (sa.stationUic && sb.stationUic && sa.stationUic === sb.stationUic) return true;
  return false;
}

function addLocalRouteShortcutClient(adjacency, a, b) {
  if (!a || !b || a === b) return;
  const sa = station(a);
  const sb = station(b);
  if (!sa || !sb) return;
  const direct = stationRouteDistanceClient(sa, sb);
  if (!Number.isFinite(direct) || direct <= 0) return;
  const allowDirect = direct <= 45 || stationsShareProjectedRailSegmentClient(a, b);
  if (!allowDirect) return;
  adjacency[a] ||= [];
  adjacency[b] ||= [];
  if (!adjacency[a].includes(b)) adjacency[a].push(b);
  if (!adjacency[b].includes(a)) adjacency[b].push(a);
}

function routeAdjacencyForClient(a, b) {
  const base = app.state?.world?.railAdjacency || {};
  const adjacency = {};
  for (const [id, list] of Object.entries(base)) adjacency[id] = [...list];

  addLocalRouteShortcutClient(adjacency, a, b);

  for (const id of [a, b]) {
    if (!id || adjacency[id]) continue;
    const s = station(id);
    if (!s) continue;
    const anchors = nearestRailAnchorsForStationClient(s, s.commune ? 6 : 4);
    const fallback = anchors.length
      ? anchors
      : dedupedStations(app.state?.world?.stations || [])
          .filter(candidate => app.state?.world?.railAdjacency?.[candidate.id])
          .map(candidate => ({ id: candidate.id, distance: stationRouteDistanceClient(s, candidate) }))
          .sort((x, y) => x.distance - y.distance)
          .slice(0, s.commune ? 4 : 3)
          .map(item => item.id);
    adjacency[id] ||= [];
    for (const anchorId of fallback) {
      adjacency[id].push(anchorId);
      (adjacency[anchorId] ||= []).push(id);
    }
  }
  return adjacency;
}


function hitStationAt(p) {
  return app.map.stationHit
    .map(h => {
      if (Number.isFinite(h.width) && Number.isFinite(h.height)) {
        const inside = p.x >= h.x && p.x <= h.x + h.width && p.y >= h.y && p.y <= h.y + h.height;
        return { ...h, d: inside ? 0 : Number.POSITIVE_INFINITY };
      }
      return { ...h, d: Math.hypot(h.x - p.x, h.y - p.y) };
    })
    .filter(h => h.d <= (h.r || 0))
    .sort((a, b) => a.d - b.d)[0] || null;
}

function onMapDown(event) {
  if (event.button !== 0) return;
  const p = pointer(event);
  app.map.drag.active = true;
  app.map.drag.moved = false;
  app.map.drag.startX = p.x;
  app.map.drag.startY = p.y;
  app.map.drag.startPanX = app.map.view.panX;
  app.map.drag.startPanY = app.map.view.panY;
  document.body.classList.add('dragging-map');
}

function onWindowMapDrag(event) {
  if (!app.map.drag.active) return;
  const p = pointer(event, app.map.canvas);
  const dx = p.x - app.map.drag.startX;
  const dy = p.y - app.map.drag.startY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) app.map.drag.moved = true;
  if (app.map.view.zoom > 1 || app.map.drag.moved) {
    app.map.view.panX = app.map.drag.startPanX + dx;
    app.map.view.panY = app.map.drag.startPanY + dy;
  }
}

function onMapUp() {
  if (!app.map.drag.active) return;
  app.map.drag.active = false;
  document.body.classList.remove('dragging-map');
}

function onMapWheel(event) {
  event.preventDefault();
  const p = pointer(event);
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  setMapZoom(app.map.view.zoom * factor, p);
}

function onMapMove(event) {
  const p = pointer(event);
  const hit = hitStationAt(p);
  app.hoverStation = hit?.id || null;
  app.map.canvas.style.cursor = hit ? 'pointer' : 'crosshair';
}

function onMapClick(event) {
  if (app.map.drag.moved) { app.map.drag.moved = false; return; }
  const p = pointer(event);
  const hit = hitStationAt(p) || nearestStationAt(p, 24);
  if (hit) {
    setSelectedStation(hit.id);
    app.activeTab = 'stations';
    localStorage.setItem('sillons.activeTab', app.activeTab);
    renderAll();
  }
}

function nearestStationAt(p, maxDistance = 20) {
  return app.map.stationHit
    .map(h => ({ ...h, d: Math.hypot(h.x - p.x, h.y - p.y) }))
    .filter(h => h.d <= maxDistance)
    .sort((a, b) => a.d - b.d)[0] || null;
}

function nearestProjectedStationAt(p, maxDistance = 28) {
  const stations = dedupedStations(app.state?.world?.stations || []);
  let best = null;
  for (const s of stations) {
    const sp = projectStationPoint(s);
    if (!Number.isFinite(sp.x) || !Number.isFinite(sp.y)) continue;
    if (sp.x < -80 || sp.x > app.map.width + 80 || sp.y < -80 || sp.y > app.map.height + 80) continue;
    const d = Math.hypot(sp.x - p.x, sp.y - p.y);
    if (d <= maxDistance && (!best || d < best.d)) best = { id: s.id, x: sp.x, y: sp.y, r: maxDistance, d };
  }
  return best;
}

function setSelectedStation(stationId) {
  if (!stationId || !station(stationId)) {
    app.selectedStation = null;
    localStorage.removeItem('sillons.selectedStation');
    return;
  }
  app.selectedStation = stationId;
  localStorage.setItem('sillons.selectedStation', stationId);
}

function pointer(event, sourceCanvas = app.map.canvas) {
  const rect = sourceCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function stationListSignature(list) {
  const stations = Array.isArray(list) ? list : [];
  const ids = stations.map(s => `${s?.id || ''}:${s?.code || s?.communeCode || ''}:${s?.population || 0}`).join('|');
  let hash = 0;
  for (let i = 0; i < ids.length; i += 1) hash = ((hash << 5) - hash + ids.charCodeAt(i)) | 0;
  const customCount = stations.reduce((count, s) => count + (s?.custom ? 1 : 0), 0);
  const communes = app.state?.world?.communesStatus || {};
  return `${stations.length}:${hash}:${ids.length}:${customCount}:${communes.status || ''}:${communes.updatedAt || ''}:${communes.count || 0}`;
}

function dedupedStations(list = app.state?.world?.stations || []) {
  if (app.stationListCache.source === list) return app.stationListCache.deduped;
  const signature = stationListSignature(list);
  if (app.stationListCache.signature === signature) {
    app.stationListCache.source = list;
    return app.stationListCache.deduped;
  }

  const out = [];
  for (const s of list) {
    if (!s) continue;
    const dup = out.find(existing => isStationDuplicateClient(s, existing));
    if (!dup) out.push(s);
  }
  app.stationListCache = { source: list, signature, deduped: out };
  return out;
}

function stationCommuneCodeClient(station) {
  return String(station?.code || station?.communeCode || '').trim();
}

function isStationDuplicateClient(a, b) {
  if (!a || !b || a.id === b.id) return false;
  const acode = stationCommuneCodeClient(a);
  const bcode = stationCommuneCodeClient(b);
  const sameMultiStationCommune = a.multiStation && b.multiStation && acode && bcode && acode === bcode;
  if (acode && bcode && acode === bcode && !sameMultiStationCommune) return true;

  const an = stationDedupNameClient(a.name);
  const bn = stationDedupNameClient(b.name);
  const exactSameName = an && bn && an === bn;
  const close = Number.isFinite(a.lat) && Number.isFinite(a.lon) && Number.isFinite(b.lat) && Number.isFinite(b.lon)
    ? haversineClient(a.lat, a.lon, b.lat, b.lon) <= 1.25
    : false;
  return Boolean(exactSameName && close);
}

function stationDedupNameClient(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/gare|station|sncf|saint|sainte|st\.?|ste\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function haversineClient(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const a1 = lat1 * Math.PI / 180, a2 = lat2 * Math.PI / 180;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function stationOptions(selectedId = '') {
  const selected = station(selectedId);
  const candidates = sortStationsForPurchase(dedupedStations(app.state.world.stations), app.stationSortMode);
  if (selected && !candidates.some(s => s.id === selected.id)) candidates.unshift(selected);
  return candidates
    .map(s => {
      const owner = stationOwnerClient(s.id);
      const status = owner ? owner.player.id === app.state?.me?.id ? 'à toi' : `possédée: ${owner.player.name}` : 'libre';
      return `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escapeHtml(s.name)} · ${money(stationSortPrice(s))} · demande ${formatInt(s.baseDemand)} · ${escapeHtml(status)}</option>`;
    })
    .join('');
}


function station(id) {
  return app.state.world.stationIndex[id] || dedupedStations(app.state.world.stations).find(s => s.id === id);
}

function trainName(train) {
  const model = app.state.balance.trains[train.modelId];
  return model ? model.name : train.modelId;
}

function distance(a, b) {
  const route = getRoute(a, b);
  return route.distance || 0;
}


function routeGeometryKey(a, b) {
  return `${a}->${b}`;
}

function geometryForRoute(a, b) {
  const direct = cachedRailGeometryForRoute(a, b);
  if (direct) return direct;
  const key = routeGeometryKey(a, b);
  if (!app.osmRouteMissing.has(key) && !app.osmRouteMissing.has(routeGeometryKey(b, a))) ensureRailwayRouteGeometry(a, b);
  return null;
}

function cachedRailGeometryForRoute(a, b) {
  const direct = getCacheEntry(app.osmRouteCache, routeGeometryKey(a, b));
  if (direct) return direct;
  const reverse = getCacheEntry(app.osmRouteCache, routeGeometryKey(b, a));
  if (reverse) return [...reverse].reverse();
  return null;
}

async function ensureRailwayRouteGeometry(a, b) {
  const key = routeGeometryKey(a, b);
  if (app.osmRoutePending.has(key) || app.osmRouteMissing.has(key) || app.osmRouteMissing.has(routeGeometryKey(b, a))) return;
  if (app.osmRoutePending.size >= 3) return;
  const sa = station(a), sb = station(b);
  if (!sa || !sb) return;
  const directKm = stationRouteDistanceClient(sa, sb);
  if (!Number.isFinite(directKm) || directKm <= 0 || directKm > 900) return;

  const latA = stationRouteLat(sa), lonA = stationRouteLon(sa);
  const latB = stationRouteLat(sb), lonB = stationRouteLon(sb);
  if (![latA, lonA, latB, lonB].every(Number.isFinite)) return;

  app.osmRoutePending.add(key);
  let foundGeometry = false;
  try {
    // Priorité stricte au RFN serveur : il utilise le dataset SNCF officiel et peut
    // reconstruire un chemin via les gares intermédiaires même si elles ne sont pas
    // des arrêts commerciaux de la ligne créée par le joueur.
    const sncf = await fetchSncfRouteGeometry(a, b);
    if (sncf?.length >= 2) {
      rememberCacheEntry(app.osmRouteCache, key, sncf, OSM_ROUTE_CACHE_MAX_ENTRIES);
      foundGeometry = true;
      app.routeCache.clear();
      invalidateMapProjection('sncf-rail-geometry-loaded');
      return;
    }

    const pad = Math.min(0.42, Math.max(0.055, directKm / 760));
    const south = Math.min(latA, latB) - pad;
    const north = Math.max(latA, latB) + pad;
    const west = Math.min(lonA, lonB) - pad;
    const east = Math.max(lonA, lonB) + pad;
    const bboxArea = Math.abs(north - south) * Math.abs(east - west);
    if (bboxArea > 4.6) return;

    const query = `
[out:json][timeout:18];
(
  way["railway"~"^(rail|light_rail|subway|tram|narrow_gauge)$"]["service"!~"^(yard|siding|spur)$"](${south},${west},${north},${east});
);
out geom;
`;
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `data=${encodeURIComponent(query)}`,
      cache: 'force-cache'
    });
    if (!response.ok) throw new Error(`rail geometry ${response.status}`);
    const data = await response.json();
    const coords = buildRailwayPathFromOverpass(data.elements || [], { lat: latA, lon: lonA }, { lat: latB, lon: lonB }, directKm);
    if (coords.length >= 2) {
      rememberCacheEntry(app.osmRouteCache, key, coords, OSM_ROUTE_CACHE_MAX_ENTRIES);
      foundGeometry = true;
      app.routeCache.clear();
      invalidateMapProjection('rail-geometry-loaded');
    }
  } catch (error) {
    // Non bloquant : le graphe ferroviaire interne reste utilisé.
  } finally {
    if (!foundGeometry) app.osmRouteMissing.add(key);
    app.osmRoutePending.delete(key);
  }
}

async function fetchSncfRouteGeometry(a, b) {
  try {
    const response = await fetch(`/api/sncf/route-geometry?from=${encodeURIComponent(a)}&to=${encodeURIComponent(b)}`, {
      cache: 'force-cache',
      headers: authHeaders()
    });
    if (!response.ok) return [];
    const data = await response.json();
    const coords = Array.isArray(data.geometry) ? data.geometry : [];
    return coords
      .map(pair => [Number(pair[0]), Number(pair[1])])
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  } catch {
    return [];
  }
}

function coordKey(lon, lat) {
  return `${Number(lon).toFixed(5)},${Number(lat).toFixed(5)}`;
}

function buildRailwayPathFromOverpass(elements, start, end, directKm) {
  const graph = new Map();
  const coordsByKey = new Map();

  function addNode(lon, lat) {
    if (![lon, lat].every(Number.isFinite)) return null;
    const key = coordKey(lon, lat);
    coordsByKey.set(key, [lon, lat]);
    if (!graph.has(key)) graph.set(key, []);
    return key;
  }

  for (const way of elements || []) {
    const geom = Array.isArray(way.geometry) ? way.geometry : [];
    for (let i = 1; i < geom.length; i++) {
      const a = geom[i - 1];
      const b = geom[i];
      const ka = addNode(Number(a.lon), Number(a.lat));
      const kb = addNode(Number(b.lon), Number(b.lat));
      if (!ka || !kb || ka === kb) continue;
      const weight = haversineClient(Number(a.lat), Number(a.lon), Number(b.lat), Number(b.lon));
      graph.get(ka).push([kb, weight]);
      graph.get(kb).push([ka, weight]);
    }
  }

  if (graph.size < 2) return [];
  const startKey = nearestRailNodeKey(coordsByKey, start);
  const endKey = nearestRailNodeKey(coordsByKey, end);
  if (!startKey || !endKey || startKey === endKey) return [];

  const ids = dijkstraRailNodePath(graph, startKey, endKey);
  if (ids.length < 2) return [];
  const path = ids.map(id => coordsByKey.get(id)).filter(Boolean);
  const pathDistance = polylineGeoDistance(path);
  if (pathDistance <= 0 || pathDistance > Math.max(35, directKm * 2.75)) return [];
  return [[start.lon, start.lat], ...path, [end.lon, end.lat]];
}

function nearestRailNodeKey(coordsByKey, point) {
  let best = null;
  for (const [key, [lon, lat]] of coordsByKey.entries()) {
    const distance = haversineClient(point.lat, point.lon, lat, lon);
    if (!best || distance < best.distance) best = { key, distance };
  }
  return best?.key || null;
}

function dijkstraRailNodePath(graph, startKey, endKey) {
  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const open = new Set(graph.keys());
  while (open.size) {
    let current = null;
    let best = Number.POSITIVE_INFINITY;
    for (const key of open) {
      const d = dist.get(key) ?? Number.POSITIVE_INFINITY;
      if (d < best) { best = d; current = key; }
    }
    if (!current || current === endKey || !Number.isFinite(best)) break;
    open.delete(current);
    for (const [next, weight] of graph.get(current) || []) {
      if (!open.has(next)) continue;
      const alt = best + weight;
      if (alt < (dist.get(next) ?? Number.POSITIVE_INFINITY)) {
        dist.set(next, alt);
        prev.set(next, current);
      }
    }
  }
  if (!dist.has(endKey)) return [];
  const out = [endKey];
  let cur = endKey;
  while (prev.has(cur)) {
    cur = prev.get(cur);
    out.push(cur);
  }
  out.reverse();
  return out;
}

function polylineGeoDistance(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineClient(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return total;
}

function getRoute(a, b) {
  const key = `${a}::${b}`;
  const cached = getCacheEntry(app.routeCache, key);
  if (cached) return cached;
  const reverseKey = `${b}::${a}`;
  const reverse = getCacheEntry(app.routeCache, reverseKey);
  if (reverse) {
    const route = {
      ...reverse,
      ids: [...reverse.ids].reverse(),
      points: [...(reverse.points || [])].reverse()
    };
    return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
  }
  const adjacency = routeAdjacencyForClient(a, b);
  const nodes = new Set([...Object.keys(adjacency), a, b]);
  const dist = {};
  const prev = {};
  const unvisited = new Set(nodes);
  for (const n of nodes) dist[n] = Number.POSITIVE_INFINITY;
  dist[a] = 0;

  while (unvisited.size) {
    let u = null;
    let best = Number.POSITIVE_INFINITY;
    for (const n of unvisited) {
      if (dist[n] < best) { best = dist[n]; u = n; }
    }
    if (!u || u === b || !Number.isFinite(best)) break;
    unvisited.delete(u);
    for (const v of adjacency[u] || []) {
      if (!unvisited.has(v)) continue;
      const alt = dist[u] + directRailDistance(u, v);
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }

  let ids = [];
  if (Number.isFinite(dist[b])) {
    let cur = b;
    ids.push(cur);
    while (prev[cur]) { cur = prev[cur]; ids.push(cur); }
    ids.reverse();
  } else {
    ids = [a, b];
    dist[b] = directRailDistance(a, b);
  }
  const direct = directRailDistance(a, b);
  if (direct > 0 && Number.isFinite(dist[b]) && dist[b] > Math.max(35, direct * 2.35) && direct <= 85) {
    ids = [a, b];
    dist[b] = direct;
  }

  let maxSegment = 0;
  let points = [];
  for (let i = 1; i < ids.length; i++) {
    maxSegment = Math.max(maxSegment, directRailDistance(ids[i - 1], ids[i]));
    const segment = resolveSegmentPath(ids[i - 1], ids[i]);
    if (!points.length) points.push(...segment);
    else points.push(...segment.slice(1));
  }
  if (!points.length && ids.length) points = ids.map(id => station(id)).filter(Boolean).map(projectStationPoint);
  const route = {
    ids,
    distance: Math.round(dist[b] || 0),
    maxSegment: Math.round(maxSegment || 0),
    points
  };
  return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
}

function resolveSegmentPath(a, b) {
  const sa = station(a), sb = station(b);
  if (!sa || !sb) return [];

  const geometry = geometryForRoute(a, b);
  if (geometry?.length >= 2) {
    return geometry.map(([lon, lat]) => project(lon, lat)).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  }

  const start = projectStationPoint(sa);
  const end = projectStationPoint(sb);
  return fallbackSinuousRailSegmentPath(a, b, start, end);
}

function fallbackSinuousRailSegmentPath(a, b, start, end) {
  if (String(a) > String(b)) return fallbackSinuousRailSegmentPath(b, a, end, start).reverse();
  if (!start || !end) return [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (!Number.isFinite(dist) || dist <= 0) return [start, end];

  const nx = -dy / dist;
  const ny = dx / dist;
  const tx = dx / dist;
  const ty = dy / dist;
  const seed = hashCode(`fallback-sinuous:${a}|${b}`);
  const phaseA = deterministicUnit(seed + 11);
  const phaseB = deterministicUnit(seed + 29);
  const phaseC = deterministicUnit(seed + 47);
  const polarity = deterministicUnit(seed + 71) < 0.5 ? -1 : 1;

  // Fallback visuel uniquement : aucun tracé SNCF/RFN ou Overpass n'a été trouvé.
  // On génère donc un corridor ferroviaire fictif, mais volontairement doux :
  // peu de changements de direction, courbure progressive et points spline
  // suréchantillonnés pour éviter les cassures visibles au dézoom.
  const shortFactor = clamp(dist / 120, 0.36, 1);
  const anchorCount = Math.max(4, Math.min(10, Math.ceil(dist / 115) + 2));
  const amplitude = Math.min(46, Math.max(5.5, dist * 0.045)) * shortFactor;
  const drift = Math.min(18, Math.max(2, dist * 0.015));
  const anchors = [];

  for (let i = 0; i <= anchorCount; i++) {
    const t = i / anchorCount;
    const envelope = Math.sin(Math.PI * t);
    const easedEnvelope = Math.pow(Math.max(0, envelope), 0.94);
    const broad = Math.sin((t + phaseA * 0.28) * Math.PI * 2) * 0.56;
    const secondary = Math.sin((t * 1.72 + phaseB) * Math.PI * 2) * 0.24;
    const local = (deterministicUnit(seed + 101 + i * 37) - 0.5) * 0.26;
    const lateral = easedEnvelope * amplitude * polarity * (broad + secondary + local);
    const longitudinal = envelope * drift * Math.sin((t * 1.35 + phaseC) * Math.PI * 2) * 0.34;

    anchors.push({
      x: start.x + dx * t + nx * lateral + tx * longitudinal,
      y: start.y + dy * t + ny * lateral + ty * longitudinal
    });
  }

  anchors[0] = { ...start };
  anchors[anchors.length - 1] = { ...end };

  const samplesPerSegment = dist < 90 ? 8 : dist < 240 ? 10 : 12;
  const points = catmullRomRoutePoints(anchors, samplesPerSegment);
  points[0] = { ...start };
  points[points.length - 1] = { ...end };
  return cleanRoutePoints(points);
}

function catmullRomRoutePoints(anchors, samplesPerSegment = 10) {
  if (!Array.isArray(anchors) || anchors.length < 3) return anchors || [];
  const points = [];
  const samples = Math.max(4, Math.min(18, Math.round(samplesPerSegment || 10)));
  for (let i = 0; i < anchors.length - 1; i++) {
    const p0 = anchors[Math.max(0, i - 1)];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = anchors[Math.min(anchors.length - 1, i + 2)];
    const firstSample = i === 0 ? 0 : 1;
    for (let step = firstSample; step <= samples; step++) {
      const t = step / samples;
      points.push(catmullRomPoint(p0, p1, p2, p3, t));
    }
  }
  return points;
}

function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}

function directRailDistance(a, b) {
  const sa = station(a), sb = station(b);
  if (!sa || !sb) return 0;
  return stationRouteDistanceClient(sa, sb);
}

function ensureSelectedStation() {
  const current = app.selectedStation || localStorage.getItem('sillons.selectedStation') || '';
  if (current && station(current)) {
    app.selectedStation = current;
    localStorage.setItem('sillons.selectedStation', current);
    return;
  }
  const owned = app.state?.me ? Object.keys(app.state.me.stations || {}) : [];
  if (owned.length) {
    setSelectedStation(owned[0]);
  }
}




function lineStopsOf(line) {
  const raw = Array.isArray(line?.stops) && line.stops.length ? line.stops : [line?.from, line?.to];
  return raw.map(id => String(id || '').trim()).filter(Boolean);
}

function lineTrainIdsOf(line) {
  const raw = Array.isArray(line?.trainIds) && line.trainIds.length ? line.trainIds : [line?.trainId];
  return [...new Set(raw.map(id => String(id || '').trim()).filter(Boolean))];
}

function lineHasTrain(line, trainId) {
  return lineTrainIdsOf(line).includes(String(trainId || '').trim());
}

function lineAssignedTrainsClient(line, player = app.state?.me) {
  const trains = player?.trains || [];
  return lineTrainIdsOf(line).map(id => trains.find(t => t.id === id)).filter(Boolean);
}

function stationOwnerClient(stationId) {
  for (const player of app.state?.players || []) {
    if (player?.stations?.[stationId]) return { player, asset: player.stations[stationId] };
  }
  return null;
}

function lineOwnershipProblemClient(stops) {
  const ids = Array.isArray(stops) ? stops : [];
  for (const stopId of ids) {
    const s = station(stopId);
    if (!s) return `Arrêt invalide : ${stopId}.`;
    if (!stationOwnerClient(stopId)) return `${s.name} n’appartient à aucune compagnie. Achète d’abord cette ville dans l’onglet Gares.`;
  }
  return '';
}

function lineExternalRightsLabel(stops) {
  const ids = Array.isArray(stops) ? stops : [];
  const owners = new Map();
  for (const stopId of ids) {
    const owner = stationOwnerClient(stopId);
    if (owner && owner.player.id !== app.state?.me?.id) owners.set(owner.player.id, owner.player.name);
  }
  if (!owners.size) return '';
  return `Péage de gare dû à : ${[...owners.values()].join(', ')}.`;
}

function lineStopsLabel(stops) {
  return stops.map(id => station(id)?.name || id).join(' → ');
}

function lineDisplayName(line) {
  const stops = lineStopsOf(line);
  if (stops.length >= 2) return `${station(stops[0])?.name || stops[0]} → ${station(stops[stops.length - 1])?.name || stops[stops.length - 1]}`;
  if (line.name && !/^\w{2,4}-\d{3}$/i.test(String(line.name))) return line.name;
  return line.code || 'Ligne';
}

function linePublicName(line) {
  const stops = lineStopsOf(line);
  if (stops.length >= 2) {
    return `${station(stops[0])?.name || stops[0]} → ${station(stops[stops.length - 1])?.name || stops[stops.length - 1]}`;
  }
  return lineDisplayName(line);
}

function lineCompositionService(line, train = null, model = null) {
  const candidateTrain = train || app.state?.me?.trains?.find(t => t.id === line?.trainId);
  const candidateModel = model || (candidateTrain ? app.state?.balance?.trains?.[candidateTrain.modelId] : null);
  const explicitMode = candidateTrain?.composition?.mode || candidateTrain?.compositionMode || candidateTrain?.compositionSpec?.mode;
  if (explicitMode === 'freight_loco') return { key: 'freight', label: 'Fret' };
  if (explicitMode === 'passenger_loco') return { key: 'passengers', label: 'Voyageur' };
  if (line?.service === 'freight') return { key: 'freight', label: 'Fret' };
  if (line?.service === 'passengers') return { key: 'passengers', label: 'Voyageur' };
  const profile = candidateTrain && candidateModel ? previewOperatingProfile(candidateTrain, candidateModel) : candidateModel;
  const pax = Number(profile?.capacity ?? candidateModel?.capacity ?? 0);
  const freight = Number(profile?.freight ?? candidateModel?.freight ?? 0);
  if (freight > pax && freight >= 80) return { key: 'freight', label: 'Fret' };
  return { key: 'passengers', label: 'Voyageur' };
}

function renderLineServicePill(line, train = null, model = null) {
  const svc = lineCompositionService(line, train, model);
  return `<span class="tag line-service-pill ${escapeAttr(svc.key)}">${escapeHtml(svc.label)}</span>`;
}

function routeDistanceForStopOrder(stops) {
  const ids = stops.filter(Boolean);
  let total = 0;
  for (let i = 1; i < ids.length; i++) total += distance(ids[i - 1], ids[i]);
  return total;
}

function bestIntermediateInsertIndex(stops, stopId) {
  const ids = stops.filter(Boolean);
  if (ids.length < 2) return Math.max(0, ids.length - 1);
  let bestIndex = 0;
  let bestCost = Number.POSITIVE_INFINITY;

  // Pour une desserte intermédiaire, on teste entre deux arrêts existants.
  // On évite donc l'ajout automatique après le terminus, source des demi-tours visuels.
  for (let i = 0; i < ids.length - 1; i++) {
    const before = ids[i];
    const after = ids[i + 1];
    const added = distance(before, stopId) + distance(stopId, after) - distance(before, after);
    if (added < bestCost) {
      bestCost = added;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function insertStopAtBestIntermediatePosition(stops, stopId) {
  const ids = stops.filter(Boolean);
  if (ids.includes(stopId)) return ids;
  if (ids.length < 2) return [...ids, stopId];
  const index = bestIntermediateInsertIndex(ids, stopId);
  return [...ids.slice(0, index + 1), stopId, ...ids.slice(index + 1)];
}

function coherentStopOrder(stops) {
  const ids = stops.filter(Boolean);
  if (ids.length <= 2) return ids;

  const originalDistance = routeDistanceForStopOrder(ids);
  let best = ids;
  let bestDistance = originalDistance;

  function visit(prefix, remaining) {
    if (!remaining.length) {
      const d = routeDistanceForStopOrder(prefix);
      if (d > 0 && d < bestDistance) {
        bestDistance = d;
        best = [...prefix];
      }
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      visit([...prefix, remaining[i]], [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
    }
  }

  if (ids.length <= 7) {
    // On garde le premier arrêt puis on évite les ordres qui forcent un demi-tour.
    visit([ids[0]], ids.slice(1));
  } else {
    let ordered = [ids[0]];
    const remaining = ids.slice(1);
    while (remaining.length) {
      let bestIndex = 0;
      let bestCost = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i++) {
        const d = distance(ordered[ordered.length - 1], remaining[i]);
        if (d < bestCost) {
          bestCost = d;
          bestIndex = i;
        }
      }
      ordered.push(remaining.splice(bestIndex, 1)[0]);
    }
    const d = routeDistanceForStopOrder(ordered);
    if (d > 0 && d < bestDistance) {
      bestDistance = d;
      best = ordered;
    }
  }

  return bestDistance < originalDistance * 0.96 ? best : ids;
}

function buildLineDraftStops() {
  return stopsFromLineDraft(app.lineDraft || {});
}

function renderDraftStopStrip(stops, waypoints = []) {
  if (!stops.length) return '<span class="muted small">Aucun arrêt sélectionné.</span>';
  return stops.map((id, index) => {
    const s = station(id);
    const cls = index === 0 ? 'origin' : index === stops.length - 1 ? 'terminal' : 'via';
    const label = index === 0 ? 'Départ' : index === stops.length - 1 ? 'Arrivée' : 'Intermédiaire';
    return `<span class="line-stop-pill ${cls}"><b>${escapeHtml(label)}</b> ${escapeHtml(s?.name || id)}</span>`;
  }).join('<span class="line-stop-arrow">→</span>');
}

function renderWaypointChip(id, index) {
  const s = station(id);
  return `<div class="line-waypoint-chip"><span>${index + 1}. ${escapeHtml(s?.name || id)}</span><button type="button" data-action="remove-waypoint" data-index="${index}">Retirer</button></div>`;
}

function addDraftWaypoint() {
  updateLineDraftFromForm();
  const draft = app.lineDraft;
  const stopId = draft.viaCandidate;
  if (!stopId || !station(stopId)) {
    toast('Choisis d’abord une suggestion pour l’arrêt intermédiaire.', 'error');
    return;
  }
  const currentStops = buildLineDraftStops();
  if (currentStops.includes(stopId)) {
    toast('Cet arrêt est déjà présent sur la ligne.', 'error');
    return;
  }

  const newStops = insertStopAtBestIntermediatePosition(currentStops, stopId);
  draft.waypoints = newStops.slice(1, -1);
  draft.viaCandidate = '';
  draft.viaQuery = '';
  saveLineDraft();
  renderAll();
}

function removeDraftWaypoint(index) {
  const draft = app.lineDraft || {};
  draft.waypoints = (draft.waypoints || []).filter((_, i) => i !== Number(index));
  saveLineDraft();
  renderAll();
}

function geometryKeyForStops(ids) {
  return `stops::${ids.join('>')}`;
}

function geometryForStopSequence(ids) {
  const key = geometryKeyForStops(ids);
  const direct = getCacheEntry(app.osmRouteCache, key);
  if (direct) return direct;
  ensureOsmRouteGeometryForStops(ids);
  return null;
}

async function ensureOsmRouteGeometryForStops(ids) {
  if (!app.map.leaflet || !Array.isArray(ids) || ids.length < 2) return;
  const key = geometryKeyForStops(ids);
  if (app.osmRoutePending.has(key)) return;
  const stations = ids.map(id => station(id)).filter(Boolean);
  if (stations.length !== ids.length) return;
  app.osmRoutePending.add(key);
  try {
    for (let i = 1; i < ids.length; i++) {
      await ensureRailwayRouteGeometry(ids[i - 1], ids[i]);
    }
    const coords = [];
    for (let i = 1; i < ids.length; i++) {
      const segment = cachedRailGeometryForRoute(ids[i - 1], ids[i]);
      if (!segment?.length) return;
      if (!coords.length) coords.push(...segment);
      else coords.push(...segment.slice(1));
    }
    if (coords.length >= 2) {
      rememberCacheEntry(app.osmRouteCache, key, coords, OSM_ROUTE_CACHE_MAX_ENTRIES);
      app.routeCache.delete(`multi::${ids.join('::')}`);
    }
  } catch (error) {
    // Non bloquant : on garde l'itinéraire ferroviaire de secours.
  } finally {
    app.osmRoutePending.delete(key);
  }
}

function cleanRoutePoints(points) {
  if (!Array.isArray(points) || points.length < 3) return points || [];
  const deduped = [];
  for (const p of points) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 2) deduped.push(p);
  }

  const cleaned = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const a = cleaned[cleaned.length - 1];
    const b = deduped[i];
    const c = deduped[i + 1];
    const ab = Math.hypot(b.x - a.x, b.y - a.y);
    const bc = Math.hypot(c.x - b.x, c.y - b.y);
    const ac = Math.hypot(c.x - a.x, c.y - a.y);
    // Supprime les micro-retours visuels quand un point fait un crochet quasi demi-tour.
    if (ab < 16 && bc < 16 && ac < Math.max(ab, bc) * 0.58) continue;
    cleaned.push(b);
  }
  cleaned.push(deduped[deduped.length - 1]);
  return cleaned;
}

function pointFromStationId(id) {
  const s = station(id);
  if (!s) return null;
  const p = projectStationPoint(s);
  return Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
}

function deterministicUnit(seed) {
  const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function sampleCatmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}

const COASTAL_VISUAL_WAYPOINTS = {
  // Correction visuelle : la liaison La Roche-sur-Yon → La Rochelle ne doit
  // jamais couper la baie / l’océan. Ces points suivent l’intérieur des terres
  // autour de Luçon / Marans, uniquement pour le rendu carte.
  'LRS|LAR': [
    { lon: -1.245, lat: 46.515 },
    { lon: -1.140, lat: 46.395 },
    { lon: -1.015, lat: 46.290 }
  ]
};

function visualGuidePointFromEntry(entry) {
  if (typeof entry === 'string') return pointFromStationId(entry);
  if (entry && Number.isFinite(entry.lon) && Number.isFinite(entry.lat)) {
    const p = project(entry.lon, entry.lat);
    return Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  }
  return null;
}

function expandVisualRouteEntries(ids) {
  const entries = [];
  for (let i = 0; i < ids.length; i++) {
    if (!entries.length || entries[entries.length - 1] !== ids[i]) entries.push(ids[i]);
    if (i >= ids.length - 1) continue;

    const a = ids[i];
    const b = ids[i + 1];
    const direct = COASTAL_VISUAL_WAYPOINTS[`${a}|${b}`];
    const reverse = COASTAL_VISUAL_WAYPOINTS[`${b}|${a}`];
    const waypoints = direct || (reverse ? [...reverse].reverse() : null);
    if (waypoints) entries.push(...waypoints);
  }
  return entries;
}

function organicRailSplineThroughStops(ids) {
  const entries = expandVisualRouteEntries(ids);
  const anchors = entries.map(visualGuidePointFromEntry).filter(Boolean);
  if (anchors.length < 2) return anchors;

  const points = [];
  const routeSeed = hashCode(ids.join('>'));

  for (let i = 0; i < anchors.length - 1; i++) {
    const p0 = anchors[Math.max(0, i - 1)];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = anchors[Math.min(anchors.length - 1, i + 2)];
    const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const steps = Math.max(22, Math.min(62, Math.round(chord / 13)));
    const seed = routeSeed + hashCode(`${i}:${Math.round(p1.x)}:${Math.round(p1.y)}:${Math.round(p2.x)}:${Math.round(p2.y)}`);

    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const base = sampleCatmullRom(p0, p1, p2, p3, t);
      const ahead = sampleCatmullRom(p0, p1, p2, p3, Math.min(1, t + 0.025));
      const dx = ahead.x - base.x;
      const dy = ahead.y - base.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const envelope = Math.sin(Math.PI * t);
      const wave1 = Math.sin((t * 2.1 + deterministicUnit(seed)) * Math.PI * 2);
      const wave2 = Math.sin((t * 4.0 + deterministicUnit(seed + 17)) * Math.PI * 2) * 0.36;

      // Les segments côtiers reçoivent une ondulation plus faible pour éviter
      // qu’une courbe décorative ne reparte vers l’océan.
      const isCoastalGuided = entries.some(e => typeof e !== 'string');
      const maxAmp = isCoastalGuided ? 26 : 42;
      const amplitude = Math.min(maxAmp, Math.max(8, chord * 0.035));
      const offset = envelope * amplitude * (wave1 + wave2);

      points.push({
        x: base.x + nx * offset,
        y: base.y + ny * offset
      });
    }
  }

  points.push(anchors[anchors.length - 1]);
  return cleanRoutePoints(smoothPolyline(points, 2));
}

function smoothPolyline(points, passes = 1) {
  let out = points || [];
  for (let pass = 0; pass < passes; pass++) {
    if (out.length < 4) return out;
    const next = [out[0]];
    for (let i = 1; i < out.length - 1; i++) {
      const a = out[i - 1];
      const b = out[i];
      const c = out[i + 1];
      next.push({
        x: a.x * 0.18 + b.x * 0.64 + c.x * 0.18,
        y: a.y * 0.18 + b.y * 0.64 + c.y * 0.18
      });
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

function routeHasVisualBacktrack(points) {
  if (!Array.isArray(points) || points.length < 8) return false;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  const direct = Math.hypot(points[points.length - 1].x - points[0].x, points[points.length - 1].y - points[0].y);
  if (direct > 0 && total > direct * 2.9) return true;

  let reversals = 0;
  for (let i = 2; i < points.length; i++) {
    const ax = points[i - 1].x - points[i - 2].x;
    const ay = points[i - 1].y - points[i - 2].y;
    const bx = points[i].x - points[i - 1].x;
    const by = points[i].y - points[i - 1].y;
    const al = Math.hypot(ax, ay);
    const bl = Math.hypot(bx, by);
    if (al < 8 || bl < 8) continue;
    const dot = (ax * bx + ay * by) / (al * bl);
    if (dot < -0.70) reversals++;
  }
  return reversals >= 4;
}

function getRouteForStops(stops) {
  const ids = Array.isArray(stops) ? stops.filter(Boolean) : lineStopsOf(stops);
  const key = `multi::${ids.join('::')}`;
  const cached = getCacheEntry(app.routeCache, key);
  if (cached) return cached;
  if (ids.length < 2) {
    const single = { ids, distance: 0, maxSegment: 0, points: [] };
    return rememberCacheEntry(app.routeCache, key, single, ROUTE_CACHE_MAX_ENTRIES);
  }

  let mergedIds = [ids[0]];
  let distanceTotal = 0;
  let maxSegment = 0;
  let points = [];

  for (let i = 1; i < ids.length; i++) {
    const segment = getRoute(ids[i - 1], ids[i]);
    mergedIds.push(...segment.ids.slice(1));
    distanceTotal += segment.distance || 0;
    maxSegment = Math.max(maxSegment, segment.maxSegment || 0);

    if (!points.length) points.push(...segment.points);
    else points.push(...segment.points.slice(1));
  }

  points = cleanRoutePoints(points);
  if (routeHasVisualBacktrack(points)) {
    const visualIds = [...new Set(mergedIds)];
    points = organicRailSplineThroughStops(visualIds);
  }

  const route = { ids: mergedIds, distance: Math.round(distanceTotal), maxSegment: Math.round(maxSegment), points };
  return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
}

function lineDistance(line) {
  return getRouteForStops(lineStopsOf(line)).distance || 0;
}

function normalizedTicketDistance(distance) {
  const value = Number(distance);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TICKET_DISTANCE;
}

function suggestedTicketPrice(distance) {
  const km = normalizedTicketDistance(distance);
  return Math.max(1, Math.round(km * DEFAULT_PASSENGER_TARIFF));
}

function ticketPriceCeiling(distance) {
  const km = normalizedTicketDistance(distance);
  return Math.round(Math.min(TICKET_PRICE_CAP_ABSOLUTE, Math.max(5, 2.5 + km * 0.18)));
}

function normalizeTicketPrice(value, fallback = suggestedTicketPrice(DEFAULT_TICKET_DISTANCE), distance = DEFAULT_TICKET_DISTANCE) {
  const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
  const price = hasValue ? Number(value) : Number.NaN;
  const base = Number.isFinite(price) ? price : Number(fallback);
  const normalized = Math.max(0, Math.round(Number.isFinite(base) ? base : suggestedTicketPrice(distance)));
  return Math.min(ticketPriceCeiling(distance), normalized);
}

function ticketPriceToTariff(ticketPrice, distance) {
  const km = normalizedTicketDistance(distance);
  const price = normalizeTicketPrice(ticketPrice, suggestedTicketPrice(distance), distance);
  return price / km;
}

function tariffToTicketPrice(tariff, distance) {
  const km = normalizedTicketDistance(distance);
  const rate = Number(tariff);
  const value = Number.isFinite(rate) ? Math.max(0, rate) * km : suggestedTicketPrice(distance);
  return normalizeTicketPrice(value, suggestedTicketPrice(distance), distance);
}

function ticketSliderMax(distance, ticketPrice) {
  return ticketPriceCeiling(distance);
}

function renderTicketPriceControl({ inputId, rangeId, hintId, price, distance }) {
  const cap = ticketPriceCeiling(distance);
  const ticketPrice = normalizeTicketPrice(price, suggestedTicketPrice(distance), distance);
  return `
    <div class="ticket-price-control" data-ticket-control="${escapeAttr(inputId)}">
      <div class="ticket-price-row">
        <input id="${escapeAttr(rangeId)}" class="ticket-price-range" type="range" min="0" max="${cap}" step="1" value="${ticketPrice}" data-ticket-input-id="${escapeAttr(inputId)}">
        <div class="ticket-price-entry">
          <input id="${escapeAttr(inputId)}" class="ticket-price-input" type="number" min="0" max="${cap}" step="1" inputmode="numeric" value="${escapeAttr(ticketPrice)}" data-ticket-range-id="${escapeAttr(rangeId)}">
          <span>€</span>
        </div>
      </div>
      <span id="${escapeAttr(hintId)}" class="input-hint">${escapeHtml(ticketPriceHint(distance, ticketPrice))}</span>
    </div>
  `;
}

function stopsFromLineDraft(draft = app.lineDraft || {}) {
  return [draft.from, ...((draft.waypoints || []).filter(Boolean)), draft.to].filter(Boolean);
}

function draftTicketDistance(draft = app.lineDraft || {}) {
  const stops = stopsFromLineDraft(draft);
  return stops.length >= 2 ? getRouteForStops(stops).distance || 0 : 0;
}

function lineTicketPrice(line) {
  const stored = Number(line?.ticketPrice);
  if (Number.isFinite(stored)) return normalizeTicketPrice(stored, tariffToTicketPrice(line.tariff, lineDistance(line)), lineDistance(line));
  return tariffToTicketPrice(line.tariff, lineDistance(line));
}

function ticketPriceHint(distance, ticketPrice) {
  const km = normalizedTicketDistance(distance);
  const cap = ticketPriceCeiling(distance);
  const normalized = normalizeTicketPrice(ticketPrice, suggestedTicketPrice(distance), distance);
  const tariffPer100Km = round(ticketPriceToTariff(normalized, distance) * 100);
  if (!Number.isFinite(Number(distance)) || Number(distance) <= 0) {
    return `Ajuste au curseur ou tape le montant. Plafond provisoire : ${money(cap)}. Equivalent ${tariffPer100Km} EUR / 100 km.`;
  }
  return `${formatInt(km)} km. Plafond billet : ${money(cap)}. Equivalent ${tariffPer100Km} EUR / 100 km.`;
}

function syncLineDraftTicket(distance = draftTicketDistance()) {
  const draft = app.lineDraft || {};
  const price = normalizeTicketPrice(draft.ticketPrice, tariffToTicketPrice(draft.tariff, distance), distance);
  draft.ticketPrice = price;
  draft.tariff = ticketPriceToTariff(price, distance);
  return price;
}

function refreshLineTicketInput(distance, ticketPrice, sourceId = '') {
  refreshTicketPriceControl('lineTicketPrice', 'lineTicketPriceRange', 'lineTicketPriceHint', distance, ticketPrice, sourceId);
}

function refreshTicketPriceControl(inputId, rangeId, hintId, distance, ticketPrice, sourceId = '') {
  const input = $(`#${inputId}`);
  const range = $(`#${rangeId}`);
  const normalized = normalizeTicketPrice(ticketPrice, suggestedTicketPrice(distance), distance);
  const cap = ticketPriceCeiling(distance);

  if (range) {
    range.max = String(cap);
    if (sourceId !== rangeId) range.value = String(normalized);
  }

  if (input) {
    input.max = String(cap);
    const inputIsSource = sourceId === inputId;
    const inputHasFocus = document.activeElement === input;
    const inputValueTooHigh = Number(input.value) > cap;
    if (!inputIsSource || !inputHasFocus || inputValueTooHigh) input.value = String(normalized);
  }

  const hint = $(`#${hintId}`);
  if (hint) hint.textContent = ticketPriceHint(distance, normalized);
}


function normalizeLineDraft(freeTrains = []) {
  const draft = { ...app.lineDraft };
  draft.from = draft.from || '';
  draft.to = draft.to || '';
  draft.fromQuery = draft.fromQuery || stationSearchLabel(station(draft.from));
  draft.toQuery = draft.toQuery || stationSearchLabel(station(draft.to));
  draft.waypoints = Array.isArray(draft.waypoints) ? draft.waypoints.filter(Boolean) : [];
  draft.viaCandidate = draft.viaCandidate || '';
  draft.viaQuery = draft.viaQuery || '';
  draft.trainId = draft.trainId || freeTrains[0]?.id || '';
  draft.service = draft.service || 'passengers';
  draft.frequency = clampNumber(draft.frequency, 1, 20, 4);
  const ticketDistance = draftTicketDistance(draft);
  draft.ticketPrice = normalizeTicketPrice(draft.ticketPrice, tariffToTicketPrice(draft.tariff, ticketDistance), ticketDistance);
  draft.tariff = ticketPriceToTariff(draft.ticketPrice, ticketDistance);
  app.lineDraft = draft;
  saveLineDraft();
  return draft;
}

function updateLineDraftFromForm(sourceId = '') {
  if (!$('#lineForm')) return app.lineDraft;
  const nextDraft = {
    from: $('#lineFrom')?.value || app.lineDraft.from || '',
    to: $('#lineTo')?.value || app.lineDraft.to || '',
    fromQuery: $('#lineFromSearch')?.value || app.lineDraft.fromQuery || '',
    toQuery: $('#lineToSearch')?.value || app.lineDraft.toQuery || '',
    waypoints: Array.isArray(app.lineDraft.waypoints) ? app.lineDraft.waypoints : [],
    viaCandidate: $('#lineVia')?.value || app.lineDraft.viaCandidate || '',
    viaQuery: $('#lineViaSearch')?.value || app.lineDraft.viaQuery || '',
    trainId: $('#lineTrain')?.value || app.lineDraft.trainId || '',
    service: $('#lineService')?.value || app.lineDraft.service || 'passengers'
  };
  const ticketDistance = draftTicketDistance(nextDraft);
  const priceControl = sourceId === 'lineTicketPriceRange' ? $('#lineTicketPriceRange') : $('#lineTicketPrice');
  const rawTicketPrice = priceControl?.value;
  nextDraft.ticketPrice = normalizeTicketPrice(
    rawTicketPrice !== undefined && rawTicketPrice !== '' ? rawTicketPrice : app.lineDraft.ticketPrice,
    tariffToTicketPrice(app.lineDraft.tariff, ticketDistance),
    ticketDistance
  );
  nextDraft.tariff = ticketPriceToTariff(nextDraft.ticketPrice, ticketDistance);
  app.lineDraft = nextDraft;
  saveLineDraft();
  return app.lineDraft;
}


function updateStationSearch(role, rawValue) {
  if (role === 'station') {
    app.stationSearch.query = rawValue;
    const query = String(rawValue || '').trim();
    if (!query) {
      app.stationSearch.candidateId = '';
      setSelectedStation(null);
      const hidden = $('#lineStation');
      if (hidden) hidden.value = '';
      renderStationSuggestions('station', [], rawValue);
      updateSelectedStationPanel();
      return;
    }

    const matches = findStationMatches(rawValue, 10, app.stationSortMode);
    const best = matches[0] || null;
    app.stationSearch.candidateId = best?.id || '';
    if (best) setSelectedStation(best.id);
    else setSelectedStation(null);
    const hidden = $('#lineStation');
    if (hidden) hidden.value = app.stationSearch.candidateId;
    renderStationSuggestions('station', matches, rawValue);
    updateSelectedStationPanel();
    return;
  }

  const key = role === 'to' ? 'to' : role === 'via' ? 'viaCandidate' : 'from';
  const queryKey = role === 'to' ? 'toQuery' : role === 'via' ? 'viaQuery' : 'fromQuery';
  app.lineDraft[queryKey] = rawValue;
  const matches = findStationMatches(rawValue, 10);
  const best = matches[0];
  if (best) app.lineDraft[key] = best.id;
  const hidden = $(`#line${capitalize(role)}${role === 'via' ? '' : ''}`);
  if (hidden) hidden.value = app.lineDraft[key] || '';
  renderStationSuggestions(role, matches, rawValue);
  saveLineDraft();
  updateLinePreview();
}

function chooseStationSuggestion(role, stationId) {
  const s = station(stationId);
  if (!s) return;
  if (role === 'station') {
    setSelectedStation(s.id);
    app.stationSearch.query = stationSearchLabel(s);
    app.stationSearch.candidateId = s.id;
    const input = $('#lineStationSearch');
    const hidden = $('#lineStation');
    const box = $('#lineStationSuggestions');
    if (input) input.value = app.stationSearch.query;
    if (hidden) hidden.value = s.id;
    if (box) box.innerHTML = '';
    if (app.map.leaflet) app.map.leaflet.setView([s.lat, s.lon], Math.max(app.map.leaflet.getZoom(), 9), { animate: true });
    app.activeTab = 'stations';
    localStorage.setItem('sillons.activeTab', app.activeTab);
    renderAll();
    return;
  }
  if (role === 'from' || role === 'to') {
    const key = role;
    app.lineDraft[key] = s.id;
    app.lineDraft[`${key}Query`] = stationSearchLabel(s);
  } else if (role === 'via') {
    app.lineDraft.viaCandidate = s.id;
    app.lineDraft.viaQuery = stationSearchLabel(s);
  } else if (role === 'editor') {
    if (!app.lineEditor) return;
    app.lineEditor.candidateId = s.id;
    app.lineEditor.candidateQuery = stationSearchLabel(s);
    const input = $('#editorStopSearch');
    const hidden = $('#editorStopId');
    if (input) input.value = app.lineEditor.candidateQuery;
    if (hidden) hidden.value = s.id;
    const box = $('#editorStopSuggestions');
    if (box) box.innerHTML = '';
    return;
  }
  const input = $(`#line${capitalize(role)}Search`);
  const hidden = $(`#line${capitalize(role)}`);
  if (input) input.value = role === 'via' ? app.lineDraft.viaQuery : app.lineDraft[`${role}Query`];
  if (hidden) hidden.value = role === 'via' ? app.lineDraft.viaCandidate : s.id;
  const box = $(`#line${capitalize(role)}Suggestions`);
  if (box) box.innerHTML = '';
  saveLineDraft();
  updateLinePreview();
  if (app.map.leaflet) app.map.leaflet.setView([s.lat, s.lon], Math.max(app.map.leaflet.getZoom(), 8), { animate: true });
}

function refreshLineSearchWidgets() {
  if (!$('#lineForm')) return;
  for (const role of ['from', 'to']) {
    const value = app.lineDraft[`${role}Query`] || stationSearchLabel(station(app.lineDraft[role]));
    const input = $(`#line${capitalize(role)}Search`);
    if (input && document.activeElement !== input) input.value = value || '';
    const hidden = $(`#line${capitalize(role)}`);
    if (hidden) hidden.value = app.lineDraft[role] || '';
  }
  const viaInput = $('#lineViaSearch');
  if (viaInput && document.activeElement !== viaInput) viaInput.value = app.lineDraft.viaQuery || '';
  const viaHidden = $('#lineVia');
  if (viaHidden) viaHidden.value = app.lineDraft.viaCandidate || '';
}


function renderStationSearchResults(rawValue = '', sortMode = app.stationSortMode) {
  const query = String(rawValue || '').trim();
  if (!query) return '<p class="muted small">Saisis le nom d’une gare pour afficher les résultats ici.</p>';
  const matches = findStationMatches(query, 8, sortMode);
  if (!matches.length) return '<p class="muted small">Aucune gare trouvée.</p>';
  return matches.map(s => `
    <button type="button" class="station-result-card" data-role="station" data-station-choice="${escapeAttr(s.id)}">
      <strong>${escapeHtml(s.name)}</strong>
      <span>${escapeHtml(stationPurchaseMetaLabel(s))}</span>
    </button>
  `).join('');
}

function updateStationSearchResults() {
  const box = $('#stationSearchResults');
  if (!box) return;
  box.innerHTML = renderStationSearchResults(app.stationSearch.query, app.stationSortMode);
}

function renderStationSuggestions(role, matches, rawValue) {
  const box = $(`#line${capitalize(role)}Suggestions`);
  if (!box) return;
  if (!String(rawValue || '').trim()) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = matches.length ? matches.map(s => `
    <button type="button" class="station-suggest-item" data-role="${role}" data-station-choice="${escapeAttr(s.id)}">
      <strong>${escapeHtml(s.name)}</strong>
      <span>${escapeHtml(role === 'station' ? stationPurchaseMetaLabel(s) : stationMetaLabel(s))}</span>
    </button>
  `).join('') : '<div class="station-suggest-empty">Aucune ville trouvée.</div>';
}

function findStationMatches(query, limit = 12, sortMode = '') {
  const q = normalizeSearchText(query || '');
  const all = dedupedStations(app.state?.world?.stations || []);
  if (!q) {
    const candidates = sortMode ? sortStationsForPurchase(all, sortMode) : topStationCandidates(limit);
    return candidates.slice(0, limit);
  }
  const matches = all
    .map(s => {
      const name = normalizeSearchText(s.name);
      const postal = (s.codesPostaux || []).join(' ');
      const starts = name.startsWith(q) ? 1200 : 0;
      const exact = name === q ? 3000 : 0;
      const includes = name.includes(q) ? 450 : 0;
      const postalScore = postal.includes(q) ? 800 : 0;
      const owned = app.state.me?.stations?.[s.id] ? 500 : 0;
      const pop = Number(s.population || s.baseDemand * 450 || 10000);
      return { s, score: exact + starts + includes + postalScore + owned + Math.log10(pop) * 12 };
    })
    .filter(x => x.score > 0);

  const collator = new Intl.Collator('fr', { sensitivity: 'base' });
  const ordered = matches
    .sort((a, b) => b.score - a.score || collator.compare(a.s.name || '', b.s.name || ''))
    .map(x => x.s);

  return ordered.slice(0, limit);
}

function topStationCandidates(limit = 12) {
  return dedupedStations(app.state?.world?.stations || [])
    .sort((a, b) => Number(b.population || b.baseDemand * 450 || 0) - Number(a.population || a.baseDemand * 450 || 0))
    .slice(0, limit);
}

function stationSearchLabel(s) {
  if (!s) return '';
  const pop = s.population ? ` · ${formatInt(s.population)} hab.` : '';
  return `${s.name}${pop}`;
}

function stationMetaLabel(s) {
  if (!s) return '';
  if (s.annualPassengers) return `${formatInt(s.annualPassengers)} voy./an · ${s.codesPostaux?.[0] || s.codeDepartement || 'France'}`;
  if (s.population) return `${formatInt(s.population)} hab. · ${s.codesPostaux?.[0] || s.codeDepartement || 'France'}`;
  if (s.custom) return 'Arrêt personnalisé';
  return s.region || 'Gare principale';
}

function normalizeSearchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function capitalize(value) {
  return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
}

function saveLineDraft() {
  localStorage.setItem('sillons.lineDraft', JSON.stringify(app.lineDraft || {}));
}

function serviceOptions(selected = 'passengers') {
  return Object.entries(serviceLabels)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`)
    .join('');
}

function isInteractiveElement(target) {
  const el = target?.closest?.('input, select, textarea, button, [contenteditable="true"], .station-suggest-item, .logo-choice, .line-waypoint-chip, .modal, details, summary');
  if (!el) return false;
  if (el.closest('#topStats')) return false;
  return Boolean(el.closest('#tabContent, #setup, .modal, #logoPicker'));
}

function markUiInteraction(duration = 1800) {
  app.uiInteractionUntil = Math.max(app.uiInteractionUntil || 0, performance.now() + duration);
}

function isInteractiveUiActive() {
  if (performance.now() < (app.uiInteractionUntil || 0)) return true;
  const active = document.activeElement;
  if (!active || active === document.body) return false;
  if (active.matches?.('input, select, textarea, button, [contenteditable="true"]')) {
    return Boolean(active.closest('#tabContent, #setup, .modal'));
  }
  return Boolean(active.closest?.('.station-suggestions, .modal'));
}

function isStationSearchFocused() {
  const active = document.activeElement;
  return !!(active && active.id === 'lineStationSearch');
}

function stationSearchDisplayValue(selected) {
  if (isStationSearchFocused()) return $('#lineStationSearch')?.value || app.stationSearch.query || '';
  if (app.stationSearch.query && app.stationSearch.candidateId && app.stationSearch.candidateId === app.selectedStation) return app.stationSearch.query;
  return stationSearchLabel(selected);
}

function refreshStationSearchWidgets() {
  if (!$('#lineStationSearch')) return;
  const selected = station(app.selectedStation);
  const input = $('#lineStationSearch');
  const hidden = $('#lineStation');
  if (input && document.activeElement !== input) input.value = stationSearchDisplayValue(selected) || '';
  if (hidden) hidden.value = app.stationSearch.candidateId || app.selectedStation || '';
  if (input && document.activeElement !== input) {
    const box = $('#lineStationSuggestions');
    if (box) box.innerHTML = '';
  }
}

function isLineFormFocused() {
  const active = document.activeElement;
  return !!(active && $('#lineForm')?.contains(active));
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}


function hasTech(nodeId, level = 1) {
  return techLevel(nodeId) >= level;
}

function techNodeTitle(nodeId) {
  const node = techNodeById(nodeId);
  return node ? node.title : nodeId;
}

function techNodeById(nodeId) {
  const tree = app.state?.balance?.techTree || {};
  for (const group of Object.values(tree)) {
    const found = (group.nodes || []).find(n => n.id === nodeId);
    if (found) return found;
  }
  return null;
}

function researchPrereqLabel(node, targetLevel) {
  const prereqs = researchPrereqsForLevelClient(node, targetLevel);
  return prereqs.length ? prereqs.map(researchPrereqLabelClient).join(', ') : 'Aucun';
}

function researchEpochPrereqPill(node) {
  const requiredEpoch = Math.max(0, Number(node.requiredEpoch || 0));
  const epoch = app.state.balance.epochs?.[requiredEpoch];
  const ok = (app.state.me?.epoch || 0) >= requiredEpoch;
  const label = epoch?.name || `Époque ${requiredEpoch + 1}`;
  return `<span class="research-prereq ${ok ? 'met' : 'missing'}">Époque : ${escapeHtml(label)}</span>`;
}

function techLockedReason(node, targetLevel = 1) {
  const me = app.state.me;
  if (me.epoch < (node.requiredEpoch || 0)) return `Époque requise : ${app.state.balance.epochs[node.requiredEpoch]?.name || node.requiredEpoch + 1}.`;
  const missing = researchPrereqsForLevelClient(node, targetLevel).filter(req => !researchPrereqSatisfiedClient(req));
  if (missing.length) return `Prérequis : ${missing.map(researchPrereqLabelClient).join(', ')}.`;
  return '';
}

function trainModelUnlocked(model) {
  return !trainModelLockedReason(model);
}

function trainModelLockedReason(model) {
  const me = app.state.me;
  if (model.unlockEpoch > me.epoch) return app.state.balance.epochs[model.unlockEpoch]?.name || `Époque ${model.unlockEpoch + 1}`;
  const requiredTechLevel = trainModelRequiredTechLevel(model);
  if (model.requiredTech && !hasTech(model.requiredTech, requiredTechLevel)) return `${techNodeTitle(model.requiredTech)} niv. ${requiredTechLevel}`;
  return '';
}

function maintenanceActionLockedReason(action) {
  if (action.requiredTech && !hasTech(action.requiredTech)) return `Recherche : ${techNodeTitle(action.requiredTech)}`;
  if (action.requiresDepot && !Object.values(app.state.me.stations || {}).some(a => a.depot || (a.maintenance || 0) > 0)) return 'Atelier ou dépôt requis';
  return '';
}

function maintenancePreview(train, model, action) {
  const missing = Math.max(0.02, 1 - train.condition);
  const totalWorkshop = Object.values(app.state.me.stations || {}).reduce((s, a) => s + (a.maintenance || 0), 0);
  const workshopDiscount = Math.min(0.18, totalWorkshop * 0.025);
  const techDiscount = (hasTech('steam_workshops') ? 0.92 : 1) * (hasTech('electric_standardized_maintenance') ? 0.94 : 1);
  const cost = Math.round((action.baseCost + model.price * action.priceFactor * missing) * (1 - workshopDiscount) * techDiscount);
  const workshopBonus = Math.min(0.35, totalWorkshop * 0.035 + (app.state.me.staff.mechanics || 0) * 0.012);
  const techBonus = (hasTech('steam_workshops') ? 0.22 : 0) + (hasTech('electric_standardized_maintenance') ? 0.08 : 0);
  const days = Math.max(1, Math.ceil(action.days * (1 - workshopBonus - techBonus)));
  const target = Math.round(Math.max(train.condition, Math.min(action.target || 0.99, train.condition + action.restore)) * 100);
  return `${money(cost)} · ${formatCycles(days)} · vers ${target}%`;
}


function updateLinePreview(sourceId = '') {
  updateLineDistanceCalculator();
  const box = $('#linePreview');
  if (!box || !app.state?.me) return;
  const stops = buildLineDraftStops();
  const trainId = $('#lineTrain')?.value;
  const train = app.state.me.trains.find(t => t.id === trainId);
  const model = train ? app.state.balance.trains[train.modelId] : null;
  const button = $('#createLineBtn');

  if (stops.length < 2 || !model) {
    box.className = 'line-preview muted small';
    box.textContent = 'Choisis au moins un départ, une arrivée et un train.';
    if (button) button.disabled = !model;
    return;
  }
  if (train.maintenance?.active) {
    box.className = 'line-preview bad small';
    box.textContent = `Train indisponible : Maintenance en cours, ${formatCycles(train.maintenance.daysLeft)} restant(s).`;
    if (button) button.disabled = true;
    return;
  }
  if (new Set(stops).size !== stops.length) {
    box.className = 'line-preview bad small';
    box.textContent = 'La ligne contient un arrêt en doublon. Chaque arrêt ne doit apparaître qu’une seule fois.';
    if (button) button.disabled = true;
    return;
  }

  const route = getRouteForStops(stops);
  const ticketPrice = syncLineDraftTicket(route.distance);
  refreshLineTicketInput(route.distance, ticketPrice, sourceId);

  const ownershipProblem = lineOwnershipProblemClient(stops);
  if (ownershipProblem) {
    box.className = 'line-preview bad small';
    box.textContent = ownershipProblem;
    if (button) button.disabled = true;
    return;
  }
  const routeText = stops.map(id => station(id)?.name || id).join(' → ');
  const rightsText = lineExternalRightsLabel(stops);
  const base = `Distance réseau : ${formatInt(route.distance)} km · Billet moyen : ${money(ticketPrice)} · Tronçon le plus long : ${formatInt(route.maxSegment)} km · ${stops.length} arrêt(s).${rightsText ? ` ${rightsText}` : ''}`;
  const effective = effectiveTrainRangeClient(train, model);
  const ok = route.distance <= effective;
  const detail = ok
    ? ` Compatible : Portée ${formatInt(effective)} km. Itinéraire : ${routeText}.`
    : ` Incompatible : Portée ${formatInt(effective)} km. La distance totale de ligne dépasse la portée du matériel. Itinéraire : ${routeText}.`;

  box.className = `line-preview ${ok ? 'good' : 'bad'} small`;
  box.textContent = base + detail;
  if (button) button.disabled = !ok;
}

function effectiveTrainRangeClient(train, model) {
  const profileRange = Number(train?.profile?.range);
  if (Number.isFinite(profileRange) && profileRange > 0) return Math.round(profileRange);
  return trainEffectiveCatalogRange(model);
}

function toast(message, type = 'ok') {
  const host = $('#toastHost');
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.textContent = message;
  host.appendChild(div);
  setTimeout(() => div.remove(), 4200);
}

function formatInt(value) {
  return Math.round(Number(value || 0)).toLocaleString('fr-FR');
}

function money(value) {
  return `${formatInt(value)} €`;
}

function ticksPerRealHour() {
  return 3600000 / Math.max(250, Number(app.state?.game?.tickMs || 4500));
}

function moneyPerHour(value) {
  return `${money(Number(value || 0) * ticksPerRealHour())}/h`;
}

function topResultTooltip(me) {
  const b = me.stats?.lastBreakdown || {};
  const revenues = Number(b.lineRevenue || me.stats.lastRevenue || 0) + Number(b.stationRevenue || 0);
  const expenses = Number(b.variableLineCost || 0) + Number(b.sharedCosts || 0);
  return [
    `Revenus totaux : ${moneyPerHour(revenues)}`,
    `Dépenses totales : ${moneyPerHour(expenses)}`,
    `Résultat net : ${moneyPerHour(me.stats.lastProfit)}`,
    '---------------------------------------------',
    `Revenus des lignes : ${moneyPerHour(b.lineRevenue || me.stats.lastRevenue)}`,
    `Revenus des gares : ${moneyPerHour(b.stationRevenue || 0)}`,
    `Dépenses variables : ${moneyPerHour(b.variableLineCost || 0)}`,
    `Charges fixes : ${moneyPerHour(b.sharedCosts || 0)}`
  ].join('\n');
}

function resourceTopTooltip(type) {
  const flow = app.state?.me?.resourceFlow || {};
  const sources = flow.sources?.[type] || [];
  const consumption = Number(flow.consumption?.[type] || 0);
  const production = type === 'electricity' ? Number(flow.production?.electricity || 0) : 0;
  const stock = Number(flow.stocks?.[type] || 0);
  const label = { coal: 'Charbon', diesel: 'Diesel', electricity: 'Électricité' }[type] || type;
  const unit = type === 'electricity' ? 'MW/h' : 'u/h';
  const stockLine = type === 'electricity'
    ? `Commande producteur : ${round(production)} MW/h`
    : `Stock disponible : ${round(stock)} u`;
  const lines = [
    label,
    stockLine,
    `Consommation totale : ${round(consumption)} ${unit}`,
    `Production totale : ${round(production)} ${unit}`,
    '---------------------------------------------',
    ...(sources.length
      ? sources.slice(0, 10).map(s => `Consommation train ${s.lineName || s.lineCode || 'Ligne'} · ${s.trainName || 'Train'} : ${round(s.amountPerHour)} ${unit}`)
      : ['Aucune consommation active'])
  ];
  return lines.join('\n');
}

function resourceStockLabel(type) {
  const me = app.state?.me;
  const flow = me?.resourceFlow || {};
  if (type === 'electricity') return `${round(flow.consumption?.electricity || 0)}/${round(flow.production?.electricity || 0)} MW/h`;
  return `${round(me?.resources?.[type] || 0)} u`;
}

function maintenanceHourlyRange(model, distance = 100, frequency = 1, condition = null) {
  const base = Number(model?.maintenance || 0) * Math.max(1, Number(distance || 100)) * Math.max(1, Number(frequency || 1)) * MAINTENANCE_COST_MULTIPLIER_CLIENT;
  const toHourly = value => money(value * ticksPerRealHour());
  const min = base;
  const max = base * 2.5;
  if (Number.isFinite(condition)) {
    const current = base * (1 + (1 - Math.max(0, Math.min(1, condition))) * 1.5);
    return `${toHourly(current)}/h actuel · ${toHourly(min)}–${toHourly(max)}/h`;
  }
  return `${toHourly(min)}–${toHourly(max)}/h`;
}

function staffSalaryPerHour(def, count = 1) {
  return moneyPerHour((Number(def?.salary || 0) * Number(count || 1)) / STAFF_COST_DIVISOR_CLIENT);
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function hexToRgba(hex, alpha = 1) {
  const raw = String(hex || '').replace('#', '').trim();
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  const value = /^[0-9a-f]{6}$/i.test(full) ? full : 'd9a852';
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(Number(alpha), 0, 1)})`;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}


function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
