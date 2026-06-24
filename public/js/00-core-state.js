// Constantes client, état global, alias gares et données UI communes.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const RESEARCH_TECHNICAL_MAX_LEVEL = 1000000;
const PROJECT_VERSION = 'v0.70.11';
const ROUTE_CACHE_MAX_ENTRIES = 2500;
const OSM_ROUTE_CACHE_MAX_ENTRIES = 3500;
const OSM_ROUTE_FETCH_PARALLEL_LIMIT = 10;
const PERSISTED_OSM_ROUTE_CACHE_KEY = 'sillons.osmRouteCache.v1';
// Invalide les géométries client antérieures à la correction des branches urbaines RFN.
const PERSISTED_OSM_ROUTE_CACHE_VERSION = 'sncf-geometry-v19';
const PERSISTED_OSM_ROUTE_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 180;
const PERSISTED_OSM_ROUTE_CACHE_SAVE_DELAY_MS = 500;

const STATION_DISPLAY_NAME_ALIASES = Object.freeze({
  'paris-vaugirard': 'Paris Montparnasse',
  'paris vaugirard': 'Paris Montparnasse',
  'paris-vaugirard-ceinture': 'Paris Montparnasse',
  'paris vaugirard ceinture': 'Paris Montparnasse'
});
const MONTPARNASSE_STATION_UIC_ALIASES = new Set(['87391003', '87391102']);

function canonicalStationDisplayNameClient(name) {
  const raw = String(name || '').trim();
  if (!raw) return raw;
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const compact = normalized.replace(/\s+/g, '-');
  return STATION_DISPLAY_NAME_ALIASES[normalized]
    || STATION_DISPLAY_NAME_ALIASES[compact]
    || raw;
}

function canonicalizeStationDisplayClient(station) {
  if (!station || typeof station !== 'object') return station;
  const uic = String(station.stationUic || station.codeUic || '').split(',')[0].trim();
  const id = String(station.id || '').trim();
  const forcedMontparnasse = id === 'PAR_MONTPARNASSE' || MONTPARNASSE_STATION_UIC_ALIASES.has(uic);
  const nextName = forcedMontparnasse ? 'Paris Montparnasse' : canonicalStationDisplayNameClient(station.name);
  const nextStationName = forcedMontparnasse ? 'Paris Montparnasse' : canonicalStationDisplayNameClient(station.stationName || station.name);
  if (nextName === station.name && nextStationName === station.stationName) return station;
  return { ...station, name: nextName || station.name, stationName: nextStationName || station.stationName };
}

function canonicalizeStationLabelTextClient(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/Paris[- ]Vaugirard(?:[- ]Ceinture)?/gi, 'Paris Montparnasse')
    .replace(/Paris Montparnasse[- ]Ceinture/gi, 'Paris Montparnasse');
}

function canonicalizeLineLabelsClient(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach(canonicalizeLineLabelsClient);
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') obj[key] = canonicalizeStationLabelTextClient(value);
    else if (value && typeof value === 'object') canonicalizeLineLabelsClient(value);
  }
}

function canonicalizeStateStationDisplays(data) {
  const world = data?.world;
  if (world?.stations && Array.isArray(world.stations)) {
    world.stations = world.stations.map(canonicalizeStationDisplayClient);
    world.stationIndex = Object.fromEntries(world.stations.map(station => [station.id, station]));
  } else if (world?.stationIndex && typeof world.stationIndex === 'object') {
    world.stationIndex = Object.fromEntries(Object.entries(world.stationIndex).map(([id, station]) => [id, canonicalizeStationDisplayClient(station)]));
  }
  canonicalizeLineLabelsClient(data?.me?.lines || []);
  canonicalizeLineLabelsClient(data?.players || []);
  return data;
}

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
  selectedResearchId: '',
  researchDetailOffset: loadJson('sillons.researchDetailOffset', { x: 0, y: 0 }),
  researchDetailDrag: null,
  researchSearchQuery: localStorage.getItem('sillons.researchSearchQuery') || '',
  researchQueueCollapsed: localStorage.getItem('sillons.researchQueueCollapsed') !== '0',
  researchEraCollapsed: loadJson('sillons.researchEraCollapsed', {}),
  activeLinesSubtab: localStorage.getItem('sillons.linesSubtab') || 'create',
  activeFleetSubtab: localStorage.getItem('sillons.fleetSubtab') || 'catalog',
  fleetCatalogEraCollapsed: loadJson('sillons.fleetCatalogEraCollapsed', {}),
  fleetMaintenanceEraCollapsed: loadJson('sillons.fleetMaintenanceEraCollapsed', {}),
  sidePanelCollapsed: localStorage.getItem('sillons.sidePanelCollapsed') === '1',
  admin: {
    selectedPlayerId: localStorage.getItem('sillons.adminSelectedPlayer') || '',
    activeSubtab: localStorage.getItem('sillons.adminSubtab') || 'activity'
  },
  mapPref: 'show',
  showOtherLines: localStorage.getItem('sillons.showOtherLines') !== '0',
  focusedLineId: localStorage.getItem('sillons.focusedLineId') || '',
  fleetSortMode: localStorage.getItem('sillons.fleetSortMode') || 'era',
  compositionGroupCollapsed: loadJson('sillons.compositionGroupCollapsed', {}),
  selectedCompositionTrainIds: loadJson('sillons.selectedCompositionTrainIds', []),
  compositionModelFilter: localStorage.getItem('sillons.compositionModelFilter') || 'all',
  compositionAssignmentFilter: localStorage.getItem('sillons.compositionAssignmentFilter') || 'all',
  compositionEditorTrainId: localStorage.getItem('sillons.compositionEditorTrainId') || '',
  selectedStation: localStorage.getItem('sillons.selectedStation') || null,
  hoverStation: null,
  hoverLine: null,
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
    lineHit: [],
    trainHit: [],
    frame: null,
    navigating: false,
    needsRouteReproject: false,
    lastDrawAt: 0,
    lastFullDrawAt: 0,
    stationDrawCache: { key: '', items: [] },
    visibleStationCache: { key: '', stations: [] },
    routeDataSignature: '',
    trainMotion: {},
    trainMotionPlans: new Map(),
    trainMarkers: new Map(),
    trainMarkerLayer: null,
    trainMarkerJobs: [],
    trainMarkerPaneReady: false,
    trainMarkerRaf: false,
    trainMarkerZoomFrame: null,
    lastTrainMarkerSyncAt: 0,
    followedTrain: null,
    lastFollowCenterAt: 0,
    followingProgrammatically: false,
    redrawAfterPan: false,
    lastMoveEventAt: 0,
    panOverlay: { active: false, finishing: false, zooming: false, baseZoom: null, basePixelOrigin: null, anchorLatLng: null, anchorPoint: null, raf: false, transform: '' },
    view: { zoom: 1, panX: 0, panY: 0 },
    drag: { active: false, moved: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 }
  },
  routeCache: new Map(),
  osmRouteCache: new Map(),
  routeSpeedCache: new Map(),
  osmRouteCachePersistTimer: null,
  osmRoutePending: new Set(),
  osmRouteMissing: new Map(),
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
  notificationRenderSignature: '',
  notificationReadSyncInFlight: false,
  bugReportReadSyncInFlight: false,
  notificationsOpen: false,
  stationListCache: { source: null, signature: '', deduped: [] },
  stationSignatureCache: { source: null, signature: '' },
  selectedCompositionTrainId: '',
  compositionEditorModes: loadJson('sillons.compositionEditorModes', {}),
  compositionScrollState: loadJson('sillons.compositionScrollState', {}),
  compositionTouchScroll: null,
  pendingCompositionScrollRestore: null,
  researchProgressCache: {},
  tutorial: { syncing: false, currentId: '', rect: null, timer: null, positionTimer: null, positionFrame: null, lastScrollKey: '' },
  epochTrafficAnimation: { displayed: null, target: null, lastTarget: null, lastTargetAt: 0, lastFrameAt: 0, rate: 0 }
};


const TUTORIAL_STEPS = [
  { id: 'welcome', target: '.brand', title: 'Bienvenue dans Sillons', body: 'Ce tutoriel guidé suit maintenant l’ordre réel du début de partie : lancer une recherche, acheter un train, régler sa composition, puis ouvrir une ligne.', action: 'Commencer' },
  { id: 'overview', target: '#tabs [data-tab="overview"]', title: 'Vue générale', body: 'La Vue donne le résumé de ta compagnie : résultat, réseau, matériel, réputation et alertes. C’est ton poste de contrôle.', action: 'Continuer' },
  { id: 'research-tab', target: '#tabs [data-tab="research"]', title: 'Commencer par la R&D', body: 'Clique sur R&D. Le premier matériel nécessite une recherche de traction avant achat.', wait: 'activeTab:research' },
  { id: 'first-research', target: '[data-action="research-node"][data-id="steam_first_locomotives"]:not([disabled])', tab: 'research', title: 'Débloquer les premières locomotives', body: 'Lance la recherche Premières locomotives à vapeur. Quand elle sera terminée, le premier train deviendra achetable.', wait: 'tech:steam_first_locomotives:1' },
  { id: 'fleet-tab', target: '#tabs [data-tab="fleet"]', title: 'Va dans le Parc', body: 'Clique sur Parc. C’est ici que tu achètes tes trains, règles les compositions et lances les opérations de maintenance.', wait: 'activeTab:fleet' },
  { id: 'fleet-catalog', target: 'button[data-fleet-subtab="catalog"]', tab: 'fleet', title: 'Catalogue du matériel', body: 'Le catalogue liste les trains disponibles. Compare prix, vitesse, puissance, énergie, fiabilité et portée avant d’acheter.', wait: 'fleetSubtab:catalog' },
  { id: 'buy-train', target: '[data-action="buy-train"]:not([disabled])', tab: 'fleet', subtab: 'catalog', title: 'Acheter un train', body: 'Achète un premier train adapté à une ligne courte. Si tu as déjà un train, cette étape est automatiquement validée.', wait: 'hasTrain' },
  { id: 'fleet-composition-tab', target: 'button[data-fleet-subtab="composition"]', tab: 'fleet', title: 'Atelier de compositions', body: 'Clique sur Compositions. Tu vas choisir manuellement les voitures ou wagons pour adapter le train à ton service.', wait: 'fleetSubtab:composition' },
  { id: 'select-composition-train', target: '.composition-train-vignette[data-composition-select-card], [data-action="open-composition"]', tab: 'fleet', subtab: 'composition', title: 'Choisir le train à régler', body: 'Clique sur une vignette de train pour la sélectionner. Le bouton Modifier devient ensuite disponible.', wait: 'compositionTrainSelected' },
  { id: 'manual-composition', target: '[data-action="edit-composition-selection"]:not([disabled]), .composition-editor-card', tab: 'fleet', subtab: 'composition', title: 'Ouvrir la modification', body: 'Clique sur Modifier pour afficher l’atelier d’édition de la composition.', wait: 'compositionEditorOpen' },
  { id: 'save-composition', target: '[data-action="save-train-composition"]', tab: 'fleet', subtab: 'composition', title: 'Enregistrer la composition', body: 'Clique sur Enregistrer la composition pour valider le réglage. Cette étape attend une vraie sauvegarde.', wait: 'compositionSaved' },
  { id: 'lines-tab', target: '#tabs [data-tab="lines"]', title: 'Créer une ligne', body: 'Clique sur Lignes. C’est le cœur du jeu : une ligne relie des gares, utilise un train et produit des recettes.', wait: 'activeTab:lines' },
  { id: 'lines-create', target: '[data-lines-subtab="create"]', tab: 'lines', title: 'Sous-menu Créer', body: 'Le sous-menu Créer sert à préparer une nouvelle desserte : départ, terminus, arrêts, train et prix.', wait: 'linesSubtab:create' },
  { id: 'line-from', target: '#lineFromSearch', tab: 'lines', subtab: 'create', title: 'Choisir le départ', body: 'Renseigne la gare d’origine. Tu n’as plus besoin d’acheter les gares desservies avant de créer une ligne.', action: 'Continuer' },
  { id: 'line-to', target: '#lineToSearch', tab: 'lines', subtab: 'create', title: 'Choisir le terminus', body: 'Renseigne la destination. Une ligne courte est préférable au début pour limiter l’usure, le charbon et les coûts.', action: 'Continuer' },
  { id: 'line-train', target: '#lineTrain', tab: 'lines', subtab: 'create', title: 'Affecter un train', body: 'Sélectionne le train libre à utiliser. Un train en maintenance ou à 0 % d’état ne peut pas produire de trafic.', action: 'Continuer' },
  { id: 'line-price', target: '#lineTicketPrice', tab: 'lines', subtab: 'create', title: 'Fixer le prix', body: 'Un prix trop élevé réduit l’attractivité. Cherche un équilibre entre volume de voyageurs et recette par billet.', action: 'Continuer' },
  { id: 'create-line', target: '#createLineBtn:not([disabled])', tab: 'lines', subtab: 'create', title: 'Ouvrir la ligne', body: 'Clique sur Ouvrir la ligne. Si tu possèdes déjà une ligne active, l’étape est validée automatiquement.', wait: 'hasLine' },
  { id: 'lines-manage', target: '[data-lines-subtab="manage"]', tab: 'lines', title: 'Modifier les lignes', body: 'Le sous-menu Modifier sert à suivre la finance, les besoins métiers, la capacité, les arrêts et l’état opérationnel de chaque ligne.', wait: 'linesSubtab:manage' },
  { id: 'stations-tab', target: '#tabs [data-tab="stations"]', title: 'Gares', body: 'Clique sur Gares. Tu peux améliorer les niveaux, commerces, ateliers et dépôts pour soutenir le trafic et la maintenance.', wait: 'activeTab:stations' },
  { id: 'staff-tab', target: '#tabs [data-tab="staff"]', title: 'Ressources humaines', body: 'Clique sur RH. Les conducteurs sont obligatoires, les autres métiers améliorent recettes, régularité, satisfaction, maintenance et infrastructure.', wait: 'activeTab:staff' },
  { id: 'maintenance-tab', target: 'button[data-fleet-subtab="maintenance"]', tab: 'fleet', title: 'Maintenance', body: 'Retourne dans Parc puis Maintenance. Surveille l’état des trains : à 0 %, ils ne roulent plus et disparaissent de la carte.', wait: 'fleetSubtab:maintenance' },
  { id: 'resources-tab', target: '#tabs [data-tab="resources"]', title: 'Énergie', body: 'Clique sur Énergie. Surveille charbon, diesel et électricité : sans ressource, les lignes concernées s’arrêtent.', wait: 'activeTab:resources' },
  { id: 'market-tab', target: '#tabs [data-tab="market"]', title: 'Marché et financement', body: 'Clique sur Marché. Tu y ajustes les contrats et le financement pour accompagner la croissance de la compagnie.', wait: 'activeTab:market' },
  { id: 'budget-tab', target: '#tabs [data-tab="budget"]', title: 'Budget', body: 'Clique sur Budget. C’est le menu à consulter pour comprendre chaque recette, dépense, charge fixe et résultat net.', wait: 'activeTab:budget' },
  { id: 'bugs-tab', target: '#tabs [data-tab="bugs"]', title: 'Signalements de bugs', body: 'Clique sur Bugs. Ce menu permet de déclarer un problème, joindre des captures et consulter les signalements déjà remontés.', wait: 'activeTab:bugs' },
  { id: 'done', target: '#tabs [data-tab="overview"]', title: 'Tutoriel terminé', body: 'Tu as vu le chemin principal. Tu peux maintenant optimiser lignes, parc, RH, maintenance, recherche, énergie, budget et signalements.', action: 'Terminer' }
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
    budget: '/assets/art/hero-market-v12.png',
    bugs: '/assets/art/hero-overview-v12.png'
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
