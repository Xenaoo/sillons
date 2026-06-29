'use strict';

function showSillonsClientBootError(error) {

  console.error(error);

  const host = document.getElementById('toastHost') || document.body;

  const div = document.createElement('div');

  div.className = 'toast bad';

  div.textContent = 'Erreur de chargement du client Sillons.';

  host.appendChild(div);

}

window.__sillonsClientBootError = showSillonsClientBootError;

// ===== 00-core-state.js =====
// Constantes client, état global, alias gares et données UI communes.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const RESEARCH_TECHNICAL_MAX_LEVEL = 1000000;
const PROJECT_VERSION = 'v0.71.0';
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

const BOOT_AUTH = window.__sillonsBootAuth || {};
const INITIAL_AUTH_TOKEN = localStorage.getItem('sillons.authToken') || BOOT_AUTH.token || '';
const INITIAL_PLAYER_ID = INITIAL_AUTH_TOKEN ? (localStorage.getItem('sillons.playerId') || BOOT_AUTH.playerId || '') : '';

const app = {
  authToken: INITIAL_AUTH_TOKEN,
  playerId: INITIAL_PLAYER_ID,
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
  hoverTrain: null,
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
  constructionProgressCache: {},
  maintenanceProgressCache: {},
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
  { id: 'stations-tab', target: '#tabs [data-tab="stations"]', title: 'Gares', body: 'Clique sur Gares. Tu peux améliorer les niveaux et commerces pour soutenir le trafic. Les bâtiments de maintenance sont dans Parc > Maintenance.', wait: 'activeTab:stations' },
  { id: 'staff-tab', target: '#tabs [data-tab="staff"]', title: 'Ressources humaines', body: 'Clique sur RH. Les conducteurs sont obligatoires, les autres métiers améliorent recettes, régularité, satisfaction, maintenance et infrastructure.', wait: 'activeTab:staff' },
  { id: 'maintenance-tab', target: 'button[data-fleet-subtab="maintenance"]', tab: 'fleet', title: 'Maintenance', body: 'Retourne dans Parc puis Maintenance. Achète dépôts, ateliers et technicentres, puis surveille l’état des trains : à 0 %, ils ne roulent plus.', wait: 'fleetSubtab:maintenance' },
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


// ===== 01-startup-events-auth.js =====
// Initialisation, événements statiques, authentification, notifications et scroll compositions.
const STATE_SNAPSHOT_DB = 'sillons-state-snapshot-v1';
const STATE_SNAPSHOT_STORE = 'players';
const STATE_SESSION_SNAPSHOT_KEY = 'sillons.stateSnapshot.v1';
const STATE_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function init() {
  app.bootTimings = { startedAt: performance.now(), initMs: 0, snapshotMs: 0 };
  app.map.canvas = $('#map');
  app.map.ctx = app.map.canvas.getContext('2d');
  hydratePersistedOsmRouteCache();
  bindStaticEvents();
  if (!app.authToken) {
    renderSetupLogoPicker();
    $('#setup')?.classList.remove('hidden');
    setAuthMode(app.authMode || 'login');
  }
  startResearchAnimationLoop();
  window.addEventListener('pagehide', persistStateSnapshotBeforeReload);
  app.bootTimings.initMs = performance.now() - app.bootTimings.startedAt;

  const snapshotStartedAt = performance.now();
  let renderedFromCachedState = false;
  const bootState = consumeBootState();
  app.bootTimings.snapshotHit = Boolean(bootState);
  if (bootState) renderedFromCachedState = applyStateSnapshot(bootState);
  if (!renderedFromCachedState) {
    const snapshot = await readStateSnapshot();
    app.bootTimings.snapshotHit = Boolean(snapshot);
    if (snapshot) renderedFromCachedState = applyStateSnapshot(snapshot);
  }
  app.bootTimings.snapshotMs = performance.now() - snapshotStartedAt;

  window.setTimeout(() => {
    void refreshState(!renderedFromCachedState);
  }, renderedFromCachedState ? 900 : 0);
  setInterval(() => refreshState(false, { includeAdmin: app.activeTab === 'admin' }), 2300);
}

function consumeBootState() {
  const bootAuth = window.__sillonsBootAuth;
  if (bootAuth?.token) {
    app.authToken = String(bootAuth.token || '');
    app.playerId = String(bootAuth.playerId || app.playerId || '');
  }
  const data = window.__sillonsBootState;
  if (data) {
    try { delete window.__sillonsBootState; } catch (error) { window.__sillonsBootState = null; }
  }
  if (!data?.ok || !data?.me || !data?.world) return null;
  const expectedPlayerId = String(app.playerId || localStorage.getItem('sillons.playerId') || '').trim();
  const actualPlayerId = String(data.auth?.playerId || data.me?.id || '').trim();
  if (!actualPlayerId || (expectedPlayerId && actualPlayerId !== expectedPlayerId)) return null;
  return data;
}

function openStateSnapshotDb() {
  if (!window.indexedDB) return Promise.reject(new Error('IndexedDB indisponible.'));
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(STATE_SNAPSHOT_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STATE_SNAPSHOT_STORE)) {
        request.result.createObjectStore(STATE_SNAPSHOT_STORE, { keyPath: 'playerId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Ouverture IndexedDB impossible.'));
  });
}

async function readStateSnapshot() {
  const playerId = String(app.playerId || '');
  if (!app.authToken || !playerId) return null;
  const sessionSnapshot = readSessionStateSnapshot(playerId);
  if (sessionSnapshot) return sessionSnapshot;
  try {
    const db = await openStateSnapshotDb();
    const record = await new Promise((resolve, reject) => {
      const transaction = db.transaction(STATE_SNAPSHOT_STORE, 'readonly');
      const request = transaction.objectStore(STATE_SNAPSHOT_STORE).get(playerId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Lecture IndexedDB impossible.'));
    });
    db.close();
    if (!record?.state || Date.now() - Number(record.savedAt || 0) > STATE_SNAPSHOT_MAX_AGE_MS) return null;
    if (String(record.state.auth?.playerId || record.state.me?.id || '') !== playerId) return null;
    return record.state;
  } catch (error) {
    console.warn('Cache local de session indisponible:', error.message);
    return null;
  }
}

function isUsableStateSnapshot(record, playerId) {
  if (!record?.state || Date.now() - Number(record.savedAt || 0) > STATE_SNAPSHOT_MAX_AGE_MS) return false;
  return String(record.playerId || record.state.auth?.playerId || record.state.me?.id || '') === playerId;
}

function readSessionStateSnapshot(playerId) {
  try {
    const raw = window.sessionStorage?.getItem(STATE_SESSION_SNAPSHOT_KEY);
    const record = raw ? JSON.parse(raw) : null;
    return isUsableStateSnapshot(record, playerId) ? record.state : null;
  } catch (error) {
    return null;
  }
}

function writeSessionStateSnapshot(playerId, data) {
  try {
    window.sessionStorage?.setItem(STATE_SESSION_SNAPSHOT_KEY, JSON.stringify({ playerId, savedAt: Date.now(), state: data }));
  } catch (error) {
    // Les navigateurs aux quotas faibles conservent toujours le secours IndexedDB.
  }
}

function compactStateSnapshot(data) {
  const snapshotStations = Array.isArray(data?.world?.stations)
    ? data.world.stations.map(station => ({
      id: station.id,
      name: station.name,
      commune: Boolean(station.commune),
      multiStation: Boolean(station.multiStation),
      lat: station.lat,
      lon: station.lon,
      railLat: station.railLat,
      railLon: station.railLon,
      placement: station.placement,
      population: station.population,
      baseDemand: station.baseDemand,
      freight: station.freight,
      annualPassengers: station.annualPassengers,
      passengerTrafficYear: station.passengerTrafficYear,
      purchaseCost: station.purchaseCost,
      majorTerminal: Boolean(station.majorTerminal),
      hasPassengerStation: Boolean(station.hasPassengerStation),
      hasFreightStation: Boolean(station.hasFreightStation)
    }))
    : [];
  // Le premier rendu n'a besoin que de la compagnie courante. Les données des
  // autres joueurs et les rapports administratifs arrivent à la synchronisation
  // suivante ; cela garde le snapshot sous le quota des stockages synchrones.
  return {
    ...data,
    world: data.world ? { ...data.world, stations: snapshotStations } : data.world,
    bugReports: [],
    admin: null
  };
}

function scheduleStateSnapshot(data) {
  const playerId = String(data?.auth?.playerId || data?.me?.id || '');
  if (!playerId || !data?.me) return;
  const snapshot = compactStateSnapshot(data);
  clearTimeout(app.stateSnapshotTimer);
  app.stateSnapshotTimer = setTimeout(async () => {
    try {
      writeSessionStateSnapshot(playerId, snapshot);
      const db = await openStateSnapshotDb();
      const transaction = db.transaction(STATE_SNAPSHOT_STORE, 'readwrite');
      transaction.objectStore(STATE_SNAPSHOT_STORE).put({ playerId, savedAt: Date.now(), state: snapshot });
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => { db.close(); console.warn('Écriture du cache local impossible.'); };
    } catch (error) {
      console.warn('Cache local de session indisponible:', error.message);
    }
  }, 0);
}

function persistStateSnapshotBeforeReload() {
  const playerId = String(app.state?.auth?.playerId || app.state?.me?.id || '');
  if (!playerId || !app.state?.me) return;
  writeSessionStateSnapshot(playerId, compactStateSnapshot(app.state));
}

function applyStateSnapshot(data) {
  if (!data?.ok || !data?.me || !data?.world) return false;
  canonicalizeStateStationDisplays(data);
  app.serverClockOffset = Number(data.serverTime || Date.now()) - Date.now();
  app.routeDataSignature = worldRouteSignature(data);
  app.state = data;
  document.body.classList.remove('auth-boot', 'app-shell-boot');
  $('#setup')?.classList.add('hidden');
  ensureMapInitialized();
  ensureSelectedStation();
  resizeCanvas();
  renderAll();
  return true;
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
    if (app.activeTab === 'bugs') markBugReportsRead({ syncServer: true, skipRender: true });
    renderAll();
    if (app.activeTab === 'admin' && app.state?.auth?.isAdmin && !app.state.admin) {
      void refreshState(false, { includeAdmin: true });
    }
  });

  $('#mapToggleBtn')?.addEventListener('click', toggleMapVisibility);
  $('#panelCollapseBtn')?.addEventListener('click', toggleSidePanelCollapse);
  syncSidePanelCollapseUi(false);
  $('#zoomInBtn')?.addEventListener('click', () => app.map.leaflet?.zoomIn());
  $('#zoomOutBtn')?.addEventListener('click', () => app.map.leaflet?.zoomOut());
  $('#zoomResetBtn')?.addEventListener('click', fitFranceMap);
  const showOtherLinesBox = $('#showOtherLines');
  if (showOtherLinesBox) {
    showOtherLinesBox.checked = app.showOtherLines;
    syncOtherLinesToggle();
    showOtherLinesBox.addEventListener('change', event => {
      app.showOtherLines = !!event.target.checked;
      localStorage.setItem('sillons.showOtherLines', app.showOtherLines ? '1' : '0');
      syncOtherLinesToggle();
      invalidateMapProjection('line-filter');
      drawMap();
    });
  }
  $('#clearFocusedLineBtn')?.addEventListener('click', clearFocusedLine);
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

  document.addEventListener('click', event => {
    const toggle = event.target.closest?.('#notificationToggleBtn');
    const panel = event.target.closest?.('.notification-dropdown-panel');
    if (toggle) {
      event.preventDefault();
      app.notificationsOpen = !app.notificationsOpen;
      if (app.notificationsOpen) markNotificationsRead({ syncServer: true, skipRender: true });
      renderNotificationDropdown(true);
      return;
    }
    if (panel) return;
    if (app.notificationsOpen) {
      app.notificationsOpen = false;
      renderNotificationDropdown(true);
    }
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
    if (event.target?.id === 'fleetSortMode') {
      app.fleetSortMode = event.target.value || 'era';
      localStorage.setItem('sillons.fleetSortMode', app.fleetSortMode);
      renderAll();
    }
    if (isInteractiveElement(event.target)) markUiInteraction();
  }, true);

  const tabContent = $('#tabContent');
  tabContent.addEventListener('click', onTabContentClick);
  tabContent.addEventListener('change', onTabContentChange);
  bindResearchDetailDrag();
  bindCompositionIndependentScroll(tabContent);
  tabContent.addEventListener('input', event => {
    if (['lineTicketPrice', 'lineTicketPriceRange'].includes(event.target.id)) {
      updateLineDraftFromForm(event.target.id);
      updateLinePreview(event.target.id);
    }
    if (event.target?.dataset?.buyTrainQty) {
      updateTrainPurchaseTotal(event.target, { commit: false });
    }
    if (event.target?.id === 'researchSearchInput') {
      app.researchSearchQuery = event.target.value || '';
      localStorage.setItem('sillons.researchSearchQuery', app.researchSearchQuery);
      refreshResearchSearchResults();
    }
    if (event.target.classList?.contains('station-search-input')) {
      updateStationSearch(event.target.dataset.role, event.target.value);
    }
  });

  window.addEventListener('resize', () => { resizeCanvas(); scheduleCompositionRefitScrollAdjustment(); hideGlobalTooltip(); constrainResearchDetailPanel(); scheduleTutorialOverlayPosition(60, { scroll: false }); });
  window.visualViewport?.addEventListener('resize', () => { resizeCanvas(); scheduleCompositionRefitScrollAdjustment(); scheduleTutorialOverlayPosition(60, { scroll: false }); });
  window.visualViewport?.addEventListener('scroll', () => { scheduleCompositionRefitScrollAdjustment(); scheduleTutorialOverlayPosition(30, { scroll: false }); });
  window.addEventListener('scroll', () => scheduleTutorialOverlayPosition(30, { scroll: false }), true);
  bindGlobalTooltips();
}


function syncOtherLinesToggle() {
  const input = $('#showOtherLines');
  const toggle = $('.other-lines-toggle');
  const state = $('#showOtherLinesState');
  if (!input || !toggle) return;
  const active = !!input.checked;
  toggle.classList.toggle('is-active', active);
  toggle.classList.toggle('is-muted', !active);
  toggle.setAttribute('aria-label', active
    ? 'Les lignes des autres joueurs sont affichées sur la carte. Cliquer pour les masquer.'
    : 'Les lignes des autres joueurs sont masquées sur la carte. Cliquer pour les afficher.');
  toggle.title = active
    ? 'Les lignes et trains des autres joueurs sont actuellement visibles. Clique pour les masquer.'
    : 'Les lignes et trains des autres joueurs sont actuellement masqués. Clique pour les afficher.';
  if (state) state.textContent = active ? 'Affichées sur la carte' : 'Masquées sur la carte';
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
    if (editor || event.target?.classList?.contains('composition-editor-card') || event.target?.classList?.contains('composition-strip') || event.target?.classList?.contains('composition-group-list')) {
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
    if (cache === app.osmRouteCache) app.routeSpeedCache.delete(oldestKey);
  }
  if (cache === app.osmRouteCache) schedulePersistedOsmRouteCacheSave();
  return value;
}

function getCacheEntry(cache, key) {
  if (!cache.has(key)) return null;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function normalizePersistedRouteGeometry(value) {
  const rawGeometry = Array.isArray(value) ? value : (Array.isArray(value?.geometry) ? value.geometry : []);
  if (!Array.isArray(rawGeometry) || rawGeometry.length < 2) return null;
  const coords = rawGeometry
    .map(pair => Array.isArray(pair) ? [Number(pair[0]), Number(pair[1])] : null)
    .filter(pair => pair && Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
  return coords.length >= 2 ? coords : null;
}

function persistableOsmRouteCacheEntries() {
  return [...app.osmRouteCache.entries()]
    .slice(-OSM_ROUTE_CACHE_MAX_ENTRIES)
    .map(([key, geometry]) => {
      const normalized = normalizePersistedRouteGeometry(geometry);
      if (!normalized) return null;
      const speedProfile = normalizeRouteSpeedProfile(app.routeSpeedCache.get(key), normalized);
      return [key, speedProfile ? { geometry: normalized, speedProfile } : normalized];
    })
    .filter(Boolean);
}

function hydratePersistedOsmRouteCache() {
  const payload = loadJson(PERSISTED_OSM_ROUTE_CACHE_KEY, null);
  if (!payload || payload.version !== PERSISTED_OSM_ROUTE_CACHE_VERSION) return;
  if (Date.now() - Number(payload.savedAt || 0) > PERSISTED_OSM_ROUTE_CACHE_MAX_AGE_MS) {
    localStorage.removeItem(PERSISTED_OSM_ROUTE_CACHE_KEY);
    return;
  }
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [key, geometry] = entry;
    const normalized = normalizePersistedRouteGeometry(geometry);
    if (typeof key === 'string' && normalized) {
      app.osmRouteCache.set(key, normalized);
      const speedProfile = normalizeRouteSpeedProfile(geometry?.speedProfile, normalized);
      if (speedProfile) app.routeSpeedCache.set(key, speedProfile);
      while (app.osmRouteCache.size > OSM_ROUTE_CACHE_MAX_ENTRIES) {
        const oldestKey = app.osmRouteCache.keys().next().value;
        app.osmRouteCache.delete(oldestKey);
        app.routeSpeedCache.delete(oldestKey);
      }
    }
  }
}

function schedulePersistedOsmRouteCacheSave() {
  clearTimeout(app.osmRouteCachePersistTimer);
  app.osmRouteCachePersistTimer = setTimeout(persistOsmRouteCache, PERSISTED_OSM_ROUTE_CACHE_SAVE_DELAY_MS);
}

function persistOsmRouteCache() {
  app.osmRouteCachePersistTimer = null;
  let entries = persistableOsmRouteCacheEntries();
  while (entries.length) {
    try {
      localStorage.setItem(PERSISTED_OSM_ROUTE_CACHE_KEY, JSON.stringify({
        version: PERSISTED_OSM_ROUTE_CACHE_VERSION,
        savedAt: Date.now(),
        entries
      }));
      return;
    } catch {
      entries = entries.slice(Math.ceil(entries.length / 2));
    }
  }
  localStorage.removeItem(PERSISTED_OSM_ROUTE_CACHE_KEY);
}

function resetMapCanvasTransform() {
  const overlay = app.map.panOverlay || {};
  overlay.active = false;
  overlay.finishing = false;
  overlay.zooming = false;
  overlay.raf = false;
  overlay.transform = '';
  if (app.map.canvas) {
    app.map.canvas.style.transform = '';
    app.map.canvas.style.transformOrigin = '';
    app.map.canvas.style.willChange = '';
    app.map.canvas.classList.remove('map-pan-overlay');
  }
}

function cloneLeafletPoint(point) {
  if (!point) return null;
  return { x: Number(point.x || 0), y: Number(point.y || 0) };
}

function leafletNewPixelOrigin(center, zoom) {
  const map = app.map.leaflet;
  if (!map) return null;
  try {
    if (typeof map._getNewPixelOrigin === 'function') {
      return cloneLeafletPoint(map._getNewPixelOrigin(center, zoom));
    }
    const projected = map.project(center, zoom);
    const halfSize = map.getSize().divideBy(2);
    return cloneLeafletPoint(projected.subtract(halfSize));
  } catch {
    return null;
  }
}

function startPanOverlay(mode = 'pan') {
  resetMapCanvasTransform();
}

function setMapOverlayTransform(center, zoom) {
  const overlay = app.map.panOverlay;
  const map = app.map.leaflet;
  const canvas = app.map.canvas;
  if (!overlay.active || !map || !canvas) return;

  const baseZoom = Number.isFinite(Number(overlay.baseZoom)) ? Number(overlay.baseZoom) : map.getZoom();
  const baseOrigin = overlay.basePixelOrigin || cloneLeafletPoint(map.getPixelOrigin?.());
  const targetZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : map.getZoom();
  const targetCenter = center || map.getCenter();
  const targetOrigin = leafletNewPixelOrigin(targetCenter, targetZoom);
  if (!baseOrigin || !targetOrigin) return;

  const scale = map.getZoomScale ? map.getZoomScale(targetZoom, baseZoom) : Math.pow(2, targetZoom - baseZoom);
  const dx = (baseOrigin.x * scale) - targetOrigin.x;
  const dy = (baseOrigin.y * scale) - targetOrigin.y;
  const roundedDx = Math.round(dx * 1000) / 1000;
  const roundedDy = Math.round(dy * 1000) / 1000;
  const roundedScale = Math.round(scale * 1000000) / 1000000;
  overlay.transform = `translate3d(${roundedDx}px, ${roundedDy}px, 0) scale(${roundedScale})`;
  canvas.style.transform = overlay.transform;
}

function updatePanOverlay() {
  resetMapCanvasTransform();
}

function updateZoomOverlay(event) {
  resetMapCanvasTransform();
  markMapProjectionDirty();
  requestMapRedraw({ lite: true });
}

function endPanOverlay() {
  resetMapCanvasTransform();
  requestMapRedraw({ lite: false });
}

function worldRouteSignature(state = app.state) {
  if (!state?.players || !state?.world) return '';
  const playerSig = state.players.map(p => `${p.id}:${(p.lines || []).map(l => `${l.id}:${lineStopsOf(l).join('>')}:${lineTrainIdsOf(l).join('+')}:${l.active ? 1 : 0}:${l.electrified ? 1 : 0}`).join('|')}`).join('||');
  const communeStatus = state.world.communesStatus || {};
  const stationSig = `${state.world.stations?.length || 0}:${communeStatus.status || ''}:${communeStatus.count || 0}:${communeStatus.updatedAt || ''}`;
  return `${playerSig}::stations:${stationSig}`;
}

function stateRenderSignature(state = app.state) {
  if (!state?.game) return '';
  const me = state.me;
  const game = state.game;
  const events = (game.events || []).map(e => `${e.kind}:${e.remaining}`).join('|');
  const news = (game.news || []).map(n => `${n.day}:${n.text}`).join('|');
  const world = state.world?.communesStatus;
  const bugSig = (state.bugReports || []).map(bug => `${bug.id}:${bug.status}:${bug.createdAt}:${bug.closedAt || 0}`).join('|');
  const bugReadSig = `${state.auth?.bugReportsReadAt || 0}:${state.auth?.bugReportsUnreadCount || 0}`;
  const adminSig = state.auth?.isAdmin ? [
    state.admin?.activity?.generatedAt || 0,
    state.admin?.activity?.onlineCount || 0,
    state.admin?.activity?.activeSessionCount || 0,
    (state.admin?.activity?.recentActivity || []).slice(0, 8).map(event => `${event.at}:${event.playerId}:${event.type}:${event.detail || ''}`).join('|')
  ].join(';') : '';
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
    (me.trains || []).map(t => `${t.id}:${Math.round((t.condition || 0) * 1000)}:${t.profile?.speed || ''}:${t.profile?.energy || ''}:${t.maintenance?.active ? Math.ceil(Number(t.maintenance.remainingMs || 0) / 1000) : 0}:${t.construction?.active ? Math.ceil(Number(t.construction.remainingMs || 0) / 1000) : 0}`).join('|'),
    (me.lines || []).map(l => `${l.id}:${l.active ? 1 : 0}:${l.frequency}:${l.tariff}:${l.service}:${lineTrainIdsOf(l).join('+')}:${lineStopsOf(l).join('>')}:${l.stats?.revenue}:${l.stats?.expenses}:${l.stats?.profit}:${l.stats?.passengers}:${l.stats?.freightTons}:${l.stats?.market?.passengerShare}:${l.stats?.market?.freightShare}:${l.stats?.capacity?.sillons?.maxFrequency}:${l.stats?.capacity?.sillons?.lineCapacity}:${l.stats?.capacity?.sillons?.theoreticalCapacity}:${l.stats?.capacity?.sillons?.backgroundUsed}:${l.stats?.capacity?.sillons?.totalUsed}:${l.stats?.capacity?.sillons?.utilizationPercent}`).join('|'),
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
    bugSig,
    bugReadSig,
    meSig,
    adminSig
  ].join('::');
}


function isFleetSubmenuAutoRefreshFrozen() {
  // La maintenance doit refléter immédiatement les sorties d'atelier ; seuls les
  // sous-menus avec sélections ou champs à préserver restent gelés entre deux ticks.
  return app.activeTab === 'fleet' && ['catalog', 'composition'].includes(app.activeFleetSubtab || '');
}

function isResearchTreeAutoRefreshFrozen() {
  // L’arbre R&D est lourd et doit rester parfaitement stable pendant la
  // consultation. On gèle donc sa reconstruction automatique entre deux ticks
  // serveur ; seules les actions utilisateur déclenchent un rendu complet.
  return app.activeTab === 'research';
}

async function refreshState(first, { includeAdmin = false } = {}) {
  if (app.refreshInFlight) return;
  app.refreshInFlight = true;
  try {
    const requestStartedAt = performance.now();
    const stateUrl = includeAdmin ? '/api/state?include=admin' : '/api/state';
    const response = await fetch(stateUrl, { cache: 'no-store', headers: authHeaders() });
    const responseReceivedAt = performance.now();
    const data = await readJsonResponse(response, 'Reponse serveur invalide.');
    const parsedAt = performance.now();
    if (response.status === 401) {
      clearAuthState();
      $('#setup')?.classList.remove('hidden');
    }
    if (!data.ok) throw new Error(data.error || 'État indisponible.');
    canonicalizeStateStationDisplays(data);
    const normalizedAt = performance.now();
    app.serverClockOffset = Number(data.serverTime || Date.now()) - Date.now();
    const previousSignature = app.routeDataSignature;
    const previousCash = Number(app.state?.me?.cash);
    app.state = data;
    scheduleStateSnapshot(data);
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
      ensureMapInitialized();
      maybeNotify(data.me);
      ensureSelectedStation();
    }
    const nextRenderKey = stateRenderSignature(data);
    const shouldRender = first || nextRenderKey !== app.lastRenderKey;
    if (!shouldRender) return;
    if (!first && (isFleetSubmenuAutoRefreshFrozen() || isResearchTreeAutoRefreshFrozen())) {
      // Les sous-menus du Parc ne sont plus reconstruits à chaque tick serveur :
      // les sélections, scrolls, boutons et champs restent stables jusqu'à une action utilisateur.
      renderTopbar();
      app.lastRenderKey = nextRenderKey;
    } else if (!first && isInteractiveUiActive()) {
      // Ne pas reconstruire l’onglet pendant une interaction utilisateur :
      // menus déroulants, saisie, sliders, suggestions et formulaires restent ouverts.
      renderTopbar();
    } else {
      renderAll();
    }
    if (first) {
      reportClientBootMetrics({
        initMs: app.bootTimings?.initMs || 0,
        snapshotMs: app.bootTimings?.snapshotMs || 0,
        snapshotHit: app.bootTimings?.snapshotHit ? 1 : 0,
        requestMs: responseReceivedAt - requestStartedAt,
        parseMs: parsedAt - responseReceivedAt,
        normalizeMs: normalizedAt - parsedAt,
        renderMs: performance.now() - normalizedAt,
        totalMs: performance.now() - (app.bootTimings?.startedAt || requestStartedAt),
        stateBytes: Number(response.headers.get('content-length') || 0),
        serverTiming: response.headers.get('server-timing') || ''
      });
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


function reportClientBootMetrics(metrics) {
  const clean = {
    ...Object.fromEntries(Object.entries(metrics).filter(([key]) => key !== 'serverTiming').map(([key, value]) => [key, Math.round(Number(value) || 0)])),
    serverTiming: String(metrics.serverTiming || '').slice(0, 400)
  };
  window.__sillonsBootMetrics = clean;
  const body = JSON.stringify(clean);
  if (navigator.sendBeacon?.('/api/client-boot-metrics', body)) return;
  fetch('/api/client-boot-metrics', { method: 'POST', body, keepalive: true }).catch(() => null);
}

function startMapDrawLoop() {
  if (app.map.drawLoopStarted) return;
  app.map.drawLoopStarted = true;
  requestAnimationFrame(drawLoop);
}

function ensureMapInitialized() {
  if (app.map.mapReady || app.map.leaflet || app.map.initializing) {
    startMapDrawLoop();
    return;
  }
  app.map.initializing = true;
  loadArtImage(ART.map);
  initOsmMap();
  startMapDrawLoop();
}

function initOsmMap() {
  if (app.map.mapReady || app.map.leaflet) return;
  const target = $('#osmMap');
  if (!target) {
    app.map.initializing = false;
    return;
  }
  if (!window.L) {
    target.innerHTML = '<div class="osm-error">Carte indisponible. Vérifie ta connexion internet.</div><canvas id="map" width="1200" height="820"></canvas>';
    app.map.canvas = $('#map');
    app.map.ctx = app.map.canvas?.getContext('2d');
    resizeCanvas();
    app.map.mapReady = true;
    app.map.initializing = false;
    return;
  }

  app.map.leaflet = L.map(target, {
    center: [46.75, 2.35],
    zoom: 6,
    minZoom: 5,
    maxZoom: 13,
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true,
    zoomAnimation: false,
    markerZoomAnimation: false,
    fadeAnimation: false
  });

  addReliableFrenchTileLayer(app.map.leaflet);
  clearTrainMarkerLayer();

  L.control.zoom({ position: 'bottomright' }).addTo(app.map.leaflet);

  app.map.leaflet.on('zoomstart', () => {
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    resetMapCanvasTransform();
    resizeCanvas();
    invalidateMapProjection('zoom-start');
    requestMapRedraw({ lite: true });
  });
  app.map.leaflet.on('zoomanim', () => {
    // Les animations de zoom Leaflet sont désactivées pour cette carte canvas.
    // Si un navigateur déclenche malgré tout l'événement, on force un redraw simple.
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    resetMapCanvasTransform();
    invalidateMapProjection('zoom-anim');
    requestMapRedraw({ lite: true });
  });
  app.map.leaflet.on('zoom', () => {
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    resetMapCanvasTransform();
    invalidateMapProjection('zoom');
    requestMapRedraw({ lite: true });
  });
  app.map.leaflet.on('zoomend', () => {
    app.map.navigating = false;
    app.map.trainMarkerZoomFrame = null;
    resetMapCanvasTransform();
    resizeCanvas();
    updateIsoClass();
    invalidateMapProjection('zoom-end');
    requestMapRedraw({ lite: false });
  });

  app.map.leaflet.on('movestart', () => {
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    resetMapCanvasTransform();
    markMapProjectionDirty();
    requestMapRedraw({ lite: true });
  });
  app.map.leaflet.on('move', () => {
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    resetMapCanvasTransform();
    markMapProjectionDirty();
    requestMapRedraw({ lite: true });
  });
  app.map.leaflet.on('moveend', () => {
    app.map.navigating = false;
    resetMapCanvasTransform();
    resizeCanvas();
    updateIsoClass();
    invalidateMapProjection('move-end');
    requestMapRedraw({ lite: false });
  });
  app.map.leaflet.on('resize', () => {
    app.map.navigating = false;
    resetMapCanvasTransform();
    resizeCanvas();
    updateIsoClass();
    invalidateMapProjection('map-resize');
    requestMapRedraw({ lite: false });
  });
  app.map.leaflet.on('mousemove', onOsmMouseMove);
  app.map.leaflet.on('mouseout', () => {
    app.hoverTrain = null;
    app.hoverStation = null;
    app.hoverLine = null;
    updateTrainMarkerPositions();
    requestMapRedraw();
    app.map.leaflet.getContainer().style.cursor = '';
  });
  app.map.leaflet.on('click', onOsmClick);

  app.map.leaflet.whenReady(() => {
    app.map.mapReady = true;
    app.map.initializing = false;
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
  toast('Création désactivée : seules les gares réelles SNCF sont jouables.');
  $('#addStopBtn')?.classList.add('hidden');
  $('#cancelStopBtn')?.classList.add('hidden');
  const hint = $('#mapHint');
  if (hint) hint.textContent = 'Clique une gare réelle du Réseau Ferré National.';
}

function disableStationPlacement() {
  app.map.stationPlacement = false;
  $('#addStopBtn')?.classList.add('hidden');
  $('#cancelStopBtn')?.classList.add('hidden');
  const hint = $('#mapHint');
  if (hint) hint.textContent = 'Clique une gare réelle du Réseau Ferré National.';
  const container = app.map.leaflet?.getContainer();
  container?.classList.remove('placing-stop');
  app.map.leaflet?.dragging?.enable?.();
}

function onOsmMouseMove(event) {
  if (app.map.navigating) return;
  const p = { x: event.containerPoint.x, y: event.containerPoint.y };
  const trainHit = hitTrainAt(p);
  const stationHit = trainHit ? null : hitStationAt(p);
  const lineHit = trainHit || stationHit ? null : hitLineAt(p);
  const nextTrain = trainHit ? { playerId: trainHit.playerId, trainId: trainHit.trainId } : null;
  const nextStation = stationHit?.id || null;
  const nextLine = lineHit ? { playerId: lineHit.playerId, lineId: lineHit.lineId, own: !!lineHit.own } : null;
  const hoverChanged = app.hoverStation !== nextStation
    || String(app.hoverTrain?.trainId || '') !== String(nextTrain?.trainId || '')
    || String(app.hoverTrain?.playerId || '') !== String(nextTrain?.playerId || '')
    || String(app.hoverLine?.lineId || '') !== String(nextLine?.lineId || '')
    || String(app.hoverLine?.playerId || '') !== String(nextLine?.playerId || '');
  app.hoverTrain = nextTrain;
  app.hoverStation = nextStation;
  app.hoverLine = nextLine;
  if (hoverChanged) {
    updateTrainMarkerPositions();
    requestMapRedraw();
  }
  const container = app.map.leaflet.getContainer();
  container.style.cursor = trainHit || stationHit || lineHit ? 'pointer' : '';
}

async function onOsmClick(event) {
  const p = { x: event.containerPoint.x, y: event.containerPoint.y };
  const trainHit = hitTrainAt(p);
  if (trainHit) {
    followTrainOnMap(trainHit.trainId, trainHit.playerId);
    return;
  }
  const stationHit = hitStationAt(p) || nearestStationAt(p, 10) || nearestProjectedStationAt(p, 12);
  if (stationHit) {
    if (app.focusedLineId) clearFocusedLine();
    setSelectedStation(stationHit.id);
    const selected = station(stationHit.id);
    app.stationSearch.query = stationSearchLabel(selected);
    app.stationSearch.candidateId = stationHit.id;
    app.activeTab = 'stations';
    localStorage.setItem('sillons.activeTab', app.activeTab);
    renderAll();
    return;
  }
  const lineHit = hitLineAt(p);
  if (lineHit) {
    selectMapLine(lineHit);
    return;
  }
  stopFollowingTrain();
  if (app.focusedLineId) clearFocusedLine();
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
  document.body.classList.remove('auth-boot', 'app-shell-boot');
  $('#setup')?.classList.add('hidden');
  if (response.state) scheduleStateSnapshot(response.state);
  ensureMapInitialized();
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


function bugReportsReadStorageKey() {
  const playerId = app.state?.auth?.playerId || app.playerId || 'anonymous';
  return `sillons.bugReportsReadAt.${playerId}`;
}

function localBugReportsReadAt() {
  return Number(localStorage.getItem(bugReportsReadStorageKey()) || 0) || 0;
}

function currentBugReportsReadAt() {
  return Math.max(Number(app.state?.auth?.bugReportsReadAt || 0) || 0, localBugReportsReadAt());
}

function latestBugReportCreatedAtClient(reports = app.state?.bugReports || []) {
  return (Array.isArray(reports) ? reports : []).reduce((max, bug) => Math.max(max, Number(bug?.createdAt || 0) || 0), 0);
}

function unreadBugReportCountClient(reports = app.state?.bugReports || []) {
  if (!app.state?.auth?.isAdmin) return 0;
  const readAt = currentBugReportsReadAt();
  return (Array.isArray(reports) ? reports : [])
    .filter(bug => bug?.status !== 'closed' && (Number(bug?.createdAt || 0) || 0) > readAt)
    .length;
}

function syncBugTabBadge() {
  const button = document.querySelector('#tabs [data-tab="bugs"]');
  if (!button) return;
  const count = unreadBugReportCountClient();
  const label = 'Bugs';
  button.classList.toggle('has-bug-unread', count > 0);
  button.title = count > 0
    ? `${formatInt(count)} nouveau${count > 1 ? 'x' : ''} signalement${count > 1 ? 's' : ''} de bug à lire.`
    : 'Signalements de bugs';
  button.innerHTML = count > 0
    ? `${label}<span class="tab-badge" aria-label="${formatInt(count)} nouveau${count > 1 ? 'x' : ''} bug${count > 1 ? 's' : ''}">${formatInt(count)}</span>`
    : label;
}

function markBugReportsRead({ syncServer = false, skipRender = false } = {}) {
  if (!app.state?.auth?.isAdmin) return;
  const latest = latestBugReportCreatedAtClient();
  if (!latest || latest <= currentBugReportsReadAt()) {
    syncBugTabBadge();
    return;
  }
  localStorage.setItem(bugReportsReadStorageKey(), String(latest));
  if (app.state?.auth) {
    app.state.auth.bugReportsReadAt = Math.max(Number(app.state.auth.bugReportsReadAt || 0) || 0, latest);
    app.state.auth.bugReportsUnreadCount = 0;
  }
  syncBugTabBadge();
  if (!skipRender) renderTabs();
  if (!syncServer || app.bugReportReadSyncInFlight) return;
  app.bugReportReadSyncInFlight = true;
  post('/api/action', { playerId: app.playerId, type: 'markBugReportsRead', payload: { readAt: latest } })
    .then(response => {
      if (response?.state) app.state = response.state;
      syncBugTabBadge();
    })
    .catch(() => null)
    .finally(() => { app.bugReportReadSyncInFlight = false; });
}


function maybeNotify(me) {
  const first = me.notifications?.[0];
  if (!first) return;
  const key = notificationKey(first);
  if (app.lastNotificationKey && app.lastNotificationKey !== key) toast(first.text, 'ok');
  app.lastNotificationKey = key;
}

function notificationKey(notification) {
  return String(notification?.id || `${notification?.createdAt ?? ''}:${notification?.text || ''}`);
}

function notificationCreatedAt(notification) {
  const value = Number(notification?.createdAt || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function notificationDateTimeLabel(notification) {
  const createdAt = notificationCreatedAt(notification);
  return createdAt ? formatDateTime(createdAt) : 'Horodatage indisponible';
}

function notificationReadStorageKey() {
  const playerId = app.state?.me?.id || app.playerId || 'anonymous';
  return `sillons.notificationsReadAt.${playerId}`;
}

function localNotificationReadAt() {
  return Number(localStorage.getItem(notificationReadStorageKey()) || 0) || 0;
}

function currentNotificationReadAt() {
  return Math.max(Number(app.state?.me?.notificationsReadAt || 0) || 0, localNotificationReadAt());
}

function latestNotificationCreatedAt(notifications = []) {
  return notifications.reduce((max, item) => Math.max(max, notificationCreatedAt(item)), 0);
}

function unreadNotificationCount(notifications = []) {
  const readAt = currentNotificationReadAt();
  return notifications.filter(item => notificationCreatedAt(item) > readAt).length;
}

function markNotificationsRead({ syncServer = false, skipRender = false } = {}) {
  const me = app.state?.me;
  const notifications = Array.isArray(me?.notifications) ? me.notifications : [];
  const latest = latestNotificationCreatedAt(notifications);
  if (!latest || latest <= currentNotificationReadAt()) return;
  localStorage.setItem(notificationReadStorageKey(), String(latest));
  if (me) me.notificationsReadAt = Math.max(Number(me.notificationsReadAt || 0) || 0, latest);
  if (!skipRender) renderNotificationDropdown(true);
  if (!syncServer || app.notificationReadSyncInFlight) return;
  app.notificationReadSyncInFlight = true;
  post('/api/action', { playerId: app.playerId, type: 'markNotificationsRead', payload: { readAt: latest } })
    .then(response => {
      if (response?.state) app.state = response.state;
      renderNotificationDropdown(true);
    })
    .catch(() => null)
    .finally(() => { app.notificationReadSyncInFlight = false; });
}

function notificationRenderSignature(notifications, open, unreadCount) {
  const items = notifications.map(item => `${notificationKey(item)}:${notificationCreatedAt(item)}:${item.text || ''}`).join('|');
  return `${app.state?.me?.id || ''}::${open ? 1 : 0}::${unreadCount}::${items}`;
}

function renderNotificationDropdown(force = false) {
  const mount = $('#notificationMount');
  if (!mount) return;
  const me = app.state?.me;
  if (!me) {
    app.notificationRenderSignature = '';
    mount.innerHTML = '';
    return;
  }
  const notifications = Array.isArray(me.notifications) ? me.notifications : [];
  const open = !!app.notificationsOpen;
  if (open) markNotificationsRead({ syncServer: true, skipRender: true });
  const total = notifications.length;
  const unreadCount = unreadNotificationCount(notifications);
  const hasItems = total > 0;
  const signature = notificationRenderSignature(notifications, open, unreadCount);
  if (!force && signature === app.notificationRenderSignature) return;
  app.notificationRenderSignature = signature;
  const items = notifications.map(notification => `
    <article class="notification-item ${notificationCreatedAt(notification) > currentNotificationReadAt() ? 'is-unread' : ''}">
      <div class="notification-item__meta">${escapeHtml(notificationDateTimeLabel(notification))}</div>
      <div class="notification-item__text">${escapeHtml(notification.text || 'Notification sans contenu.')}</div>
    </article>
  `).join('');
  mount.innerHTML = `
    <div class="notification-dropdown ${open ? 'is-open' : ''}">
      <button id="notificationToggleBtn" class="notification-toggle ${unreadCount ? 'has-unread' : ''}" type="button" aria-expanded="${open ? 'true' : 'false'}" title="Afficher ou masquer l’historique des notifications.">
        <span class="notification-toggle__icon" aria-hidden="true">◆</span>
        <span class="notification-toggle__label">Notifications</span>
        <span class="notification-toggle__count" aria-label="${formatInt(unreadCount)} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}">${formatInt(unreadCount)}</span>
      </button>
      ${open ? `
        <div class="notification-dropdown-panel" role="region" aria-label="Notifications">
          <div class="notification-dropdown-head">
            <strong>Notifications</strong>
            <span>${formatInt(total)} enregistrée${total > 1 ? 's' : ''}</span>
          </div>
          <div class="notification-dropdown-list">
            ${hasItems ? items : '<div class="notification-empty">Aucune notification enregistrée pour le moment.</div>'}
          </div>
          <p class="notification-dropdown-foot">Historique conservé dans la sauvegarde serveur. Les nouvelles notifications restent ici après disparition du message temporaire.</p>
        </div>
      ` : ''}
    </div>
  `;
}


function currentCompositionScrollKey() {
  if (app.activeTab !== 'fleet' || app.activeFleetSubtab !== 'composition') return null;
  return app.compositionEditorTrainId || app.selectedCompositionTrainId || 'default';
}

function captureCompositionScrollPosition() {
  const key = currentCompositionScrollKey();
  if (!key) return;
  const editor = document.querySelector('.composition-editor-card');
  const list = document.querySelector('.composition-group-list');
  const strip = editor?.querySelector('.composition-strip.large');
  app.compositionScrollState[key] = {
    top: editor?.scrollTop || 0,
    listTop: list?.scrollTop || 0,
    stripLeft: strip?.scrollLeft || 0
  };
  localStorage.setItem('sillons.compositionScrollState', JSON.stringify(app.compositionScrollState));
}

function restoreCompositionScrollPosition(key = currentCompositionScrollKey()) {
  if (!key) return;
  const saved = app.compositionScrollState?.[key];
  if (!saved) return;
  const editor = document.querySelector('.composition-editor-card');
  const list = document.querySelector('.composition-group-list');
  const restore = () => {
    if (editor) editor.scrollTop = Number(saved.top || 0);
    if (list) list.scrollTop = Number(saved.listTop || 0);
    const strip = editor?.querySelector('.composition-strip.large');
    if (strip) strip.scrollLeft = Number(saved.stripLeft || 0);
  };
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
}


function compositionScrollContainerFromTarget(target) {
  if (app.activeTab !== 'fleet' || app.activeFleetSubtab !== 'composition') return null;
  if (!target?.closest) return null;
  const list = target.closest('.composition-group-list');
  if (list) return list;
  const card = target.closest('.composition-refit-list-card');
  return card?.querySelector?.('.composition-group-list') || null;
}

function compositionListCanScroll(list) {
  return !!list && (list.scrollHeight - list.clientHeight) > 2;
}

function scrollCompositionListBy(list, deltaY) {
  if (!compositionListCanScroll(list)) return false;
  const max = Math.max(0, list.scrollHeight - list.clientHeight);
  const previous = list.scrollTop;
  const next = Math.max(0, Math.min(max, previous + deltaY));
  if (Math.abs(next - previous) < 0.5) return false;
  list.scrollTop = next;
  captureCompositionScrollPosition();
  return true;
}

function bindCompositionIndependentScroll(root) {
  if (!root || root.dataset.compositionScrollBound === '1') return;
  root.dataset.compositionScrollBound = '1';

  root.addEventListener('wheel', event => {
    handleCompositionWheel(event);
  }, { passive: false });

  root.addEventListener('touchstart', event => {
    handleCompositionTouchStart(event);
  }, { passive: true });

  root.addEventListener('touchmove', event => {
    handleCompositionTouchMove(event);
  }, { passive: false });

  root.addEventListener('touchend', () => { app.compositionTouchScroll = null; }, { passive: true });
  root.addEventListener('touchcancel', () => { app.compositionTouchScroll = null; }, { passive: true });

  if (!document.documentElement.dataset.compositionGlobalScrollBound) {
    document.documentElement.dataset.compositionGlobalScrollBound = '1';
    document.addEventListener('wheel', event => {
      if (!event.target?.closest?.('.composition-refit-list-card')) return;
      handleCompositionWheel(event);
    }, { passive: false, capture: true });
    document.addEventListener('touchstart', event => {
      if (!event.target?.closest?.('.composition-refit-list-card')) return;
      handleCompositionTouchStart(event);
    }, { passive: true, capture: true });
    document.addEventListener('touchmove', event => {
      if (!event.target?.closest?.('.composition-refit-list-card')) return;
      handleCompositionTouchMove(event);
    }, { passive: false, capture: true });
    document.addEventListener('touchend', () => { app.compositionTouchScroll = null; }, { passive: true, capture: true });
    document.addEventListener('touchcancel', () => { app.compositionTouchScroll = null; }, { passive: true, capture: true });
  }
}

function handleCompositionWheel(event) {
  if (event.defaultPrevented) return;
  if (event.target?.closest?.('select')) return;
  const list = compositionScrollContainerFromTarget(event.target);
  if (!list) return;
  adjustCompositionRefitScroll();
  if (!compositionListCanScroll(list)) return;
  if (scrollCompositionListBy(list, event.deltaY)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }
}

function handleCompositionTouchStart(event) {
  const touch = event.touches?.[0];
  if (!touch) return;
  const list = compositionScrollContainerFromTarget(event.target);
  adjustCompositionRefitScroll();
  if (!list || !compositionListCanScroll(list)) {
    app.compositionTouchScroll = null;
    return;
  }
  app.compositionTouchScroll = {
    id: touch.identifier,
    y: touch.clientY,
    list
  };
}

function handleCompositionTouchMove(event) {
  const state = app.compositionTouchScroll;
  if (!state?.list || !compositionListCanScroll(state.list)) return;
  const touches = Array.from(event.touches || []);
  const touch = touches.find(item => item.identifier === state.id) || touches[0];
  if (!touch) return;
  const delta = state.y - touch.clientY;
  state.y = touch.clientY;
  if (scrollCompositionListBy(state.list, delta)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }
}

function scheduleCompositionRefitScrollAdjustment() {
  // Cette routine doit aussi tourner quand on QUITTE Parc > Compositions.
  // Sinon la classe .composition-scroll-mode et les styles inline qui bloquent
  // le scroll restent accrochés à #tabContent et cassent les autres menus.
  adjustCompositionRefitScroll();
  requestAnimationFrame(() => {
    adjustCompositionRefitScroll();
    requestAnimationFrame(adjustCompositionRefitScroll);
  });
  window.setTimeout(adjustCompositionRefitScroll, 120);
}

function clearCompositionScrollInlineState(content) {
  const properties = [
    'display', 'grid-template-rows', 'gap', 'min-height', 'height', 'max-height',
    'overflow', 'overflow-x', 'overflow-y'
  ];
  if (content) {
    content.classList.remove('composition-scroll-mode');
    content.classList.remove('composition-narrow-workspace');
    for (const property of properties) content.style.removeProperty(property);
  }
  app.compositionTouchScroll = null;
}

function adjustCompositionRefitScroll() {
  const content = document.querySelector('#tabContent');
  const compositionActive = app.activeTab === 'fleet' && app.activeFleetSubtab === 'composition';
  if (content) {
    content.classList.toggle('composition-scroll-mode', compositionActive);
    content.dataset.fleetSubtab = app.activeTab === 'fleet' ? (app.activeFleetSubtab || '') : '';
  }
  if (!compositionActive) {
    clearCompositionScrollInlineState(content);
    return;
  }

  const workspace = document.querySelector('.fleet-workspace');
  const layout = document.querySelector('.composition-refit-layout');
  const card = document.querySelector('.composition-refit-list-card');
  const list = document.querySelector('.composition-group-list');
  const editor = document.querySelector('.composition-refit-editor');
  if (!card || !list) return;

  const setImportant = (node, property, value) => {
    if (!node) return;
    node.style.setProperty(property, value, 'important');
  };
  const clearImportant = (node, properties) => {
    if (!node) return;
    for (const property of properties) node.style.removeProperty(property);
  };

  const viewportHeight = Math.max(480, Math.floor(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 720));
  const layoutWidth = Math.floor(layout?.getBoundingClientRect?.().width || window.innerWidth || document.documentElement.clientWidth || 0);
  const narrowWorkspace = Boolean(editor && layoutWidth > 0 && layoutWidth < 760);
  const viewportStacked = Boolean(window.matchMedia?.('(max-width: 900px)')?.matches);
  const stacked = Boolean(viewportStacked || narrowWorkspace);
  const bottomSafe = window.matchMedia?.('(max-width: 700px)')?.matches ? 10 : 16;

  if (content) {
    content.classList.toggle('composition-narrow-workspace', narrowWorkspace);
    setImportant(content, 'min-height', '0');
    setImportant(content, 'overflow-x', 'hidden');
    // Garde un scroll de secours sur #tabContent : si un calcul de hauteur échoue,
    // la page reste exploitable et les autres menus ne sont plus impactés.
    setImportant(content, 'overflow-y', 'auto');
  }
  if (workspace) {
    setImportant(workspace, 'min-height', '0');
    setImportant(workspace, 'overflow', 'visible');
  }

  if (layout) {
    clearImportant(layout, ['height', 'max-height']);
    setImportant(layout, 'overflow', 'visible');
  }

  const cardTop = Math.max(0, card.getBoundingClientRect().top);
  const availableCardHeight = stacked
    ? Math.max(360, Math.min(Math.floor(viewportHeight * 0.72), Math.floor(viewportHeight - cardTop - bottomSafe)))
    : Math.max(360, Math.floor(viewportHeight - cardTop - bottomSafe));

  card.style.setProperty('--composition-list-card-height', `${availableCardHeight}px`);
  setImportant(card, 'display', 'flex');
  setImportant(card, 'flex-direction', 'column');
  setImportant(card, 'min-height', '0');
  setImportant(card, 'height', `${availableCardHeight}px`);
  setImportant(card, 'max-height', `${availableCardHeight}px`);
  setImportant(card, 'overflow', 'hidden');
  setImportant(card, 'overscroll-behavior', 'contain');

  const cardStyle = window.getComputedStyle(card);
  const paddingTop = parseFloat(cardStyle.paddingTop || '0') || 0;
  const paddingBottom = parseFloat(cardStyle.paddingBottom || '0') || 0;
  const gap = parseFloat(cardStyle.rowGap || cardStyle.gap || '0') || 0;
  const header = card.querySelector(':scope > .fleet-card-heading');
  const toolbar = card.querySelector(':scope > .composition-refit-toolbar');
  const fixedHeight = (header?.offsetHeight || 0) + (toolbar?.offsetHeight || 0) + paddingTop + paddingBottom + gap * 2;
  const availableListHeight = Math.max(180, Math.floor(availableCardHeight - fixedHeight));

  list.style.setProperty('--composition-group-list-height', `${availableListHeight}px`);
  setImportant(list, 'display', 'block');
  setImportant(list, 'align-content', 'normal');
  setImportant(list, 'flex', '1 1 auto');
  setImportant(list, 'min-height', '0');
  setImportant(list, 'height', `${availableListHeight}px`);
  setImportant(list, 'max-height', `${availableListHeight}px`);
  setImportant(list, 'overflow-y', 'auto');
  setImportant(list, 'overflow-x', 'hidden');
  setImportant(list, 'overscroll-behavior', 'contain');
  setImportant(list, '-webkit-overflow-scrolling', 'touch');
  setImportant(list, 'touch-action', 'pan-y');

  if (editor) {
    if (viewportStacked && !narrowWorkspace) {
      clearImportant(editor, ['height', 'max-height']);
      setImportant(editor, 'overflow-y', 'visible');
    } else {
      const editorTop = Math.max(0, editor.getBoundingClientRect().top);
      const editorHeight = Math.max(360, Math.floor(viewportHeight - editorTop - bottomSafe));
      setImportant(editor, 'min-height', '0');
      setImportant(editor, 'height', `${editorHeight}px`);
      setImportant(editor, 'max-height', `${editorHeight}px`);
      setImportant(editor, 'overflow-y', 'auto');
      setImportant(editor, 'overflow-x', 'hidden');
    }
  }
}


// ===== 02-tutorial-layout-overview.js =====
// Tutoriel, rendu global, onglets, topbar, vue compagnie et finances.
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
  if (wait === 'compositionTrainSelected') return compositionSelectedIds().length > 0;
  if (wait === 'compositionEditorOpen') return Boolean(app.compositionEditorTrainId);
  if (wait === 'compositionSaved') return Boolean(me.tutorial?.actionLog?.compositionSaved);
  if (wait.startsWith('tech:')) {
    const [, nodeId, level] = wait.split(':');
    return Number(me.techUnlocked?.[nodeId] || 0) >= Math.max(1, Number(level || 1));
  }
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
  const researchTreeScroll = app.activeTab === 'research' ? (() => {
    const tree = document.querySelector('.research-skilltree-scroll');
    return tree ? { left: tree.scrollLeft, top: tree.scrollTop } : null;
  })() : null;
  captureCompositionScrollPosition();
  renderTopbar();
  renderTabs();
  renderTutorialOverlay();
  applyLayoutMode();
  syncFocusedLineUi();
  scheduleCompositionRefitScrollAdjustment();
  scheduleMobileMapViewportFix();
  requestMapRedraw();
  requestAnimationFrame(() => {
    if (compositionScrollKey) restoreCompositionScrollPosition(compositionScrollKey);
    if (researchTreeScroll) {
      const tree = document.querySelector('.research-skilltree-scroll');
      if (tree) {
        tree.scrollLeft = researchTreeScroll.left;
        tree.scrollTop = researchTreeScroll.top;
      }
    }
  });
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
  renderNotificationDropdown();
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

function syncFocusedLineUi() {
  const btn = $('#clearFocusedLineBtn');
  if (!btn) return;
  btn.classList.toggle('hidden', !app.focusedLineId);
}

function clearFocusedLine() {
  app.focusedLineId = '';
  localStorage.removeItem('sillons.focusedLineId');
  syncFocusedLineUi();
  invalidateMapProjection('line-focus-clear');
  drawMap();
}

function focusLineOnMap(lineId, { fit = true, toggle = false } = {}) {
  const id = String(lineId || '');
  const line = app.state?.me?.lines?.find(l => l.id === id && l.active);
  if (!line) return;
  if (toggle && app.focusedLineId === id) {
    clearFocusedLine();
    return;
  }
  app.focusedLineId = id;
  localStorage.setItem('sillons.focusedLineId', id);
  syncFocusedLineUi();
  if (fit && app.map.leaflet) {
    const latLngs = lineStopsOf(line)
      .map(id => station(id))
      .map(s => [stationRouteLat(s), stationRouteLon(s)])
      .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
    if (latLngs.length) {
      try {
        app.map.leaflet.fitBounds(latLngs, { padding: [34, 34], maxZoom: 11, animate: true });
      } catch {}
    }
  }
  invalidateMapProjection('line-focus');
  drawMap();
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
  if (app.activeTab === 'bugs') markBugReportsRead({ syncServer: true, skipRender: true });
  syncBugTabBadge();
  const content = $('#tabContent');
  const side = $('.side.panel');
  const menuImage = ART.tabs[app.activeTab] || ART.tabs.overview;
  if (side) {
    side.dataset.menu = app.activeTab;
    side.style.setProperty('--menu-bg', `url("${menuImage}")`);
  }
  content.dataset.tab = app.activeTab;
  content.dataset.fleetSubtab = app.activeTab === 'fleet' ? (app.activeFleetSubtab || '') : '';
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
    bugs: renderBugs,
    admin: renderAdmin
  };
  content.innerHTML = renderers[app.activeTab]?.() || renderOverview();
  if (app.activeTab === 'lines') { refreshLineSearchWidgets(); updateLinePreview(); }
  if (app.activeTab === 'stations') refreshStationSearchWidgets();
  setTimeout(renderTutorialOverlay, 0);
}


function bugSeverityLabel(value) {
  return ({ low: 'Mineur', normal: 'Normal', high: 'Gênant', critical: 'Bloquant' })[value] || 'Normal';
}

function bugStatusLabel(value) {
  return value === 'closed' ? 'Clôturé' : 'Ouvert';
}

function renderBugImages(images = []) {
  if (!images.length) return '';
  return `<div class="bug-image-grid">${images.map(image => `
    <a href="${escapeAttr(image.dataUrl)}" target="_blank" rel="noopener" title="Ouvrir l’image">
      <img src="${escapeAttr(image.dataUrl)}" alt="${escapeAttr(image.name || 'Image bug')}">
    </a>
  `).join('')}</div>`;
}

function renderBugCard(bug) {
  const admin = Boolean(app.state?.auth?.isAdmin);
  const closed = bug.status === 'closed';
  return `
    <article class="bug-card ${closed ? 'closed' : 'open'}">
      <div class="bug-card-head">
        <div>
          <h3>${escapeHtml(bug.title)}</h3>
          <p class="small muted">Signalé par ${escapeHtml(bug.reporterName || 'Joueur')} · ${escapeHtml(formatDateTime(bug.createdAt))}</p>
        </div>
        <div class="bug-tags">
          <span class="tag ${closed ? '' : 'warn'}">${escapeHtml(bugStatusLabel(bug.status))}</span>
          <span class="tag">${escapeHtml(bugSeverityLabel(bug.severity))}</span>
        </div>
      </div>
      <p>${escapeHtml(bug.description || '')}</p>
      ${renderBugImages(bug.images || [])}
      ${closed ? `<p class="small muted">Clôturé par ${escapeHtml(bug.closedByName || 'Admin')} · ${escapeHtml(bug.resolution || 'Réglé')}</p>` : ''}
      ${admin && !closed ? `<div class="actions"><button class="primary" data-action="close-bug-report" data-id="${escapeAttr(bug.id)}">Clôturer comme réglé</button></div>` : ''}
    </article>
  `;
}

function renderBugs() {
  const reports = app.state?.bugReports || [];
  const openCount = reports.filter(bug => bug.status !== 'closed').length;
  const closedCount = reports.length - openCount;
  return `
    ${renderSectionHero('BUGS & SIGNALEMENTS', 'Registre partagé', 'Signale un problème avec une description précise et des captures. La liste est visible par tous pour éviter les doublons.', ART.tabs.bugs, [`${openCount} ouverts`, `${closedCount} clôturés`, app.state?.auth?.isAdmin ? 'Gestion Xenao' : 'Lecture commune'])}

    <section class="card bug-submit-card">
      <h2>Signaler un bug</h2>
      <p class="muted small">Décris les étapes pour reproduire le problème. Les images sont redimensionnées avant envoi pour garder la sauvegarde légère.</p>
      <div class="bug-form-grid">
        <label>Titre
          <input id="bugTitle" maxlength="120" placeholder="Ex : La carte ne se recharge plus après...">
        </label>
        <label>Gravité
          <select id="bugSeverity">
            <option value="normal">Normal</option>
            <option value="low">Mineur</option>
            <option value="high">Gênant</option>
            <option value="critical">Bloquant</option>
          </select>
        </label>
      </div>
      <label>Description
        <textarea id="bugDescription" rows="5" maxlength="4000" placeholder="Ce que j’ai fait, ce que j’ai obtenu, ce que j’attendais..."></textarea>
      </label>
      <label>Images jointes
        <input id="bugImages" type="file" accept="image/png,image/jpeg,image/webp" multiple>
      </label>
      <div class="actions">
        <button class="primary" data-action="submit-bug-report">Envoyer le signalement</button>
      </div>
    </section>

    <section class="card bug-list-card">
      <div class="fleet-card-heading">
        <div>
          <h2>Signalements existants</h2>
          <p class="muted small">Tous les joueurs peuvent consulter cette liste. Seul le compte Xenao peut clôturer un bug.</p>
        </div>
        <span class="tag">${reports.length} signalement(s)</span>
      </div>
      <div class="bug-list">
        ${reports.map(renderBugCard).join('') || '<p class="muted">Aucun bug signalé pour le moment.</p>'}
      </div>
    </section>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Lecture image impossible.'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image invalide.'));
    image.src = dataUrl;
  });
}

async function bugAttachmentFromFile(file) {
  if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type || '')) throw new Error('Format image refusé.');
  if (file.size > 4_000_000) throw new Error(`${file.name} dépasse 4 Mo.`);
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(dataUrl);
  const maxSide = 1200;
  const ratio = Math.min(1, maxSide / Math.max(image.width || 1, image.height || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((image.width || 1) * ratio));
  canvas.height = Math.max(1, Math.round((image.height || 1) * ratio));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  let output = canvas.toDataURL('image/jpeg', 0.76);
  if (output.length > 900_000) output = canvas.toDataURL('image/jpeg', 0.58);
  if (output.length > 950_000) throw new Error(`${file.name} reste trop lourde après compression.`);
  return { name: file.name || 'capture.jpg', type: 'image/jpeg', size: Math.round(output.length * 0.75), dataUrl: output };
}

async function collectBugImageAttachments() {
  const input = $('#bugImages');
  const files = Array.from(input?.files || []).slice(0, 3);
  const images = [];
  for (const file of files) images.push(await bugAttachmentFromFile(file));
  return images;
}

function adminActivityLabel(type, detail = '') {
  const label = {
    login: 'Connexion réussie',
    logout: 'Déconnexion',
    session: 'Session active',
    action: 'Action de jeu',
    admin: 'Action d’administration'
  }[type] || type || 'Activité';
  return detail ? `${label} · ${detail}` : label;
}

function adminRelativeTime(value) {
  const delta = Math.max(0, Date.now() - Number(value || 0));
  if (!Number.isFinite(delta)) return '—';
  if (delta < 10_000) return 'à l’instant';
  if (delta < 60_000) return `il y a ${Math.round(delta / 1000)} s`;
  if (delta < 3_600_000) return `il y a ${Math.round(delta / 60_000)} min`;
  return `il y a ${Math.round(delta / 3_600_000)} h`;
}

function renderAdminActivityChart(timeline = []) {
  if (!timeline.length) return '<p class="muted small">L’historique se construit au fil des sessions.</p>';
  const width = 760;
  const height = 190;
  const padding = 28;
  const max = Math.max(1, ...timeline.flatMap(point => [Number(point.online || 0), Number(point.activities || 0)]));
  const pointFor = (value, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, timeline.length - 1);
    const y = height - padding - (Number(value || 0) * (height - padding * 2)) / max;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const online = timeline.map((point, index) => pointFor(point.online, index)).join(' ');
  const activities = timeline.map((point, index) => pointFor(point.activities, index)).join(' ');
  const first = formatDateTime(timeline[0]?.at);
  const last = formatDateTime(timeline[timeline.length - 1]?.at);
  return `
    <div class="admin-chart-legend"><span class="admin-legend-online">Joueurs actifs</span><span class="admin-legend-actions">Actions / connexions</span><em>maximum : ${formatInt(max)}</em></div>
    <svg class="admin-activity-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Activité des dernières 24 heures">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="admin-chart-axis" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" class="admin-chart-axis" />
      <polyline points="${activities}" class="admin-chart-line admin-chart-actions" />
      <polyline points="${online}" class="admin-chart-line admin-chart-online" />
    </svg>
    <div class="admin-chart-labels"><span>${escapeHtml(first)}</span><span>${escapeHtml(last)}</span></div>
  `;
}

function renderAdminActivity(activity, players) {
  const onlineRows = (activity.onlinePlayers || []).map(player => `
    <tr>
      <td><span class="admin-online-dot"></span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.username || 'sans compte')}</small></td>
      <td>${formatInt(player.activeSessions)} session${player.activeSessions > 1 ? 's' : ''}</td>
      <td>${formatInt(player.lines)} ligne${player.lines > 1 ? 's' : ''} active${player.lines > 1 ? 's' : ''}</td>
      <td title="${escapeAttr(formatDateTime(player.lastActivityAt))}">${escapeHtml(adminRelativeTime(player.lastActivityAt))}</td>
    </tr>
  `).join('');
  const recentRows = (activity.recentActivity || []).map(event => `
    <tr>
      <td title="${escapeAttr(formatDateTime(event.at))}">${escapeHtml(formatDateTime(event.at))}</td>
      <td><span class="${event.online ? 'admin-online-dot' : 'admin-offline-dot'}"></span>${escapeHtml(event.playerName)}</td>
      <td>${escapeHtml(adminActivityLabel(event.type, event.detail))}</td>
    </tr>
  `).join('');
  const breakdown = Object.entries(activity.activityBreakdown || {}).map(([type, count]) => `<span class="tag">${escapeHtml(adminActivityLabel(type))} : ${formatInt(count)}</span>`).join('') || '<span class="muted small">Aucune action mémorisée sur les dernières 24 h.</span>';
  return `
    <section class="admin-activity-metrics card-grid">
      ${metric('Joueurs en ligne', `${formatInt(activity.onlineCount || 0)}/${formatInt(players.length)}`)}
      ${metric('Sessions actives', formatInt(activity.activeSessionCount || 0))}
      ${metric('Fenêtre de présence', `${Math.round(Number(activity.activeWindowMs || 0) / 1000)} s`)}
      ${metric('Dernière mise à jour', adminRelativeTime(activity.generatedAt))}
    </section>
    <section class="card admin-chart-card">
      <div class="admin-detail-head"><div><h2>Présence et activité — 24 h</h2><p class="muted small">Actualisé à chaque synchronisation ; une session est considérée active si elle a communiqué avec le serveur dans la fenêtre indiquée.</p></div></div>
      ${renderAdminActivityChart(activity.timeline || [])}
      <div class="admin-activity-breakdown">${breakdown}</div>
    </section>
    <div class="admin-grid admin-activity-grid">
      <section class="card">
        <h2>Joueurs actuellement en ligne</h2>
        <div class="admin-log-wrap">
          <table class="admin-log-table"><thead><tr><th>Joueur</th><th>Sessions</th><th>Exploitation</th><th>Dernière activité</th></tr></thead>
          <tbody>${onlineRows || '<tr><td colspan="4">Aucun joueur actif actuellement.</td></tr>'}</tbody></table>
        </div>
      </section>
      <section class="card">
        <h2>Flux d’activité récent</h2>
        <div class="admin-log-wrap">
          <table class="admin-log-table"><thead><tr><th>Horodatage</th><th>Joueur</th><th>Événement</th></tr></thead>
          <tbody>${recentRows || '<tr><td colspan="3">Aucune activité enregistrée.</td></tr>'}</tbody></table>
        </div>
      </section>
    </div>
  `;
}

function renderAdminAccounts(players, selected) {
  const logRows = (selected.loginHistory || []).map(entry => `
    <tr><td>${escapeHtml(formatDateTime(entry.at))}</td><td>${escapeHtml(entry.ip || '—')}</td><td>${escapeHtml(entry.userAgent || '—')}</td></tr>
  `).join('');
  const sessionRows = (selected.sessions || []).map(session => `
    <tr><td><span class="${session.active ? 'admin-online-dot' : 'admin-offline-dot'}"></span>${session.active ? 'Active' : 'Inactive'}</td><td>${escapeHtml(formatDateTime(session.lastSeenAt))}</td><td>${escapeHtml(formatDateTime(session.expiresAt))}</td></tr>
  `).join('');
  const rawJson = escapeHtml(JSON.stringify(selected.rawPlayer || {}, null, 2));
  return `
    <div class="admin-grid">
      <section class="card admin-list-card"><h2>Comptes joueurs</h2><div class="admin-player-list">
        ${players.map(player => `<button type="button" class="admin-player-row ${player.id === selected.id ? 'active' : ''}" data-action="admin-select-player" data-id="${escapeAttr(player.id)}"><span><strong>${player.online ? '<i class="admin-online-dot"></i>' : ''}${escapeHtml(player.name)}</strong><em>${escapeHtml(player.username || 'Sans compte lié')} · ${escapeHtml(adminRelativeTime(player.lastActivityAt))}</em></span><b>${money(player.cash)}</b></button>`).join('')}
      </div></section>
      <section class="card admin-detail-card">
        <div class="admin-detail-head"><div><h2>${escapeHtml(selected.name)}</h2><p class="muted small">Identifiant : ${escapeHtml(selected.username || 'aucun')} · ID joueur : <code>${escapeHtml(selected.id)}</code></p></div><span class="tag ${selected.online ? 'good' : ''}">${selected.online ? 'En ligne' : (selected.isAdmin ? 'Admin' : 'Hors ligne')}</span></div>
        <div class="card-grid">${metric('Trésorerie', money(selected.cash))}${metric('Dette', money(selected.debt))}${metric('Lignes actives', `${selected.activeLines}/${selected.lines}`)}${metric('Sessions', `${selected.activeSessions || 0}/${selected.validSessions || 0}`)}</div>
        <div class="admin-action-panel"><label>Nom de compagnie<input id="adminCompanyName" maxlength="28" value="${escapeAttr(selected.name)}"></label><label>Trésorerie exacte<input id="adminCash" type="number" step="1000" value="${Number(selected.cash || 0)}"></label><label>Ajouter / retirer<input id="adminCashDelta" type="number" step="1000" placeholder="ex : 1000000 ou -500000"></label><div class="actions"><button class="primary" data-action="admin-save-quick" data-id="${escapeAttr(selected.id)}">Enregistrer nom + trésorerie</button><button data-action="admin-add-cash" data-id="${escapeAttr(selected.id)}">Appliquer variation</button></div></div>
      </section>
    </div>
    <div class="admin-grid admin-session-grid">
      <section class="card"><h2>Sessions</h2><div class="admin-log-wrap"><table class="admin-log-table"><thead><tr><th>État</th><th>Dernière activité</th><th>Expiration</th></tr></thead><tbody>${sessionRows || '<tr><td colspan="3">Aucune session valide.</td></tr>'}</tbody></table></div></section>
      <section class="card"><h2>Connexions horodatées</h2><div class="admin-log-wrap"><table class="admin-log-table"><thead><tr><th>Date</th><th>IP</th><th>Navigateur</th></tr></thead><tbody>${logRows || '<tr><td colspan="3">Aucune connexion enregistrée.</td></tr>'}</tbody></table></div></section>
    </div>
    <section class="card"><h2>Édition avancée du joueur</h2><p class="muted small">Zone volontairement puissante : modifie le JSON puis enregistre. Le serveur remigre la compagnie pour éviter les champs essentiels cassés.</p><textarea id="adminRawPlayerJson" class="admin-json-editor" spellcheck="false">${rawJson}</textarea><div class="actions"><button class="primary" data-action="admin-save-json" data-id="${escapeAttr(selected.id)}">Enregistrer le JSON joueur</button></div></section>
  `;
}

function renderAdmin() {
  if (app.state?.auth?.isAdmin && !app.state.admin) {
    return `<div class="card"><h2>Admin</h2><p class="muted">Chargement de la console d’administration…</p></div>`;
  }
  if (!isAdminSession()) return `<div class="card"><h2>Admin</h2><p class="muted">Accès réservé au compte Xenao.</p></div>`;
  const players = app.state.admin.players || [];
  if (!players.length) return `<div class="card"><h2>Admin</h2><p class="muted">Aucun joueur à administrer.</p></div>`;
  const activity = app.state.admin.activity || {};
  const selected = players.find(player => player.id === app.admin.selectedPlayerId) || players[0];
  app.admin.selectedPlayerId = selected.id;
  localStorage.setItem('sillons.adminSelectedPlayer', selected.id);
  const activeSubtab = app.admin.activeSubtab === 'accounts' ? 'accounts' : 'activity';
  return `
    ${renderSectionHero('ADMINISTRATION', 'Console Xenao', 'Surveille les sessions actives, l’activité des compagnies et les données de connexion, puis administre les comptes si nécessaire.', ART.tabs.budget, ['Accès privé', `${activity.onlineCount || 0} en ligne`, `${players.length} joueurs`])}
    <div class="admin-subtabs"><button type="button" class="${activeSubtab === 'activity' ? 'active' : ''}" data-admin-subtab="activity">Activité en direct</button><button type="button" class="${activeSubtab === 'accounts' ? 'active' : ''}" data-admin-subtab="accounts">Comptes & édition</button></div>
    ${activeSubtab === 'activity' ? renderAdminActivity(activity, players) : renderAdminAccounts(players, selected)}
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
        ${metric('Score', formatInt(me.score), '', scoreTooltipClient(me, activeLines))}
        ${metric('Classement', `${myRank}/${ranking.length}`)}
        ${metric('Voyageurs transportés', formatInt(me.stats.passengers))}
        ${metric('Fret transporté', `${formatInt(me.stats.freightTons)} t`)}
        ${metric('Dette', money(me.debt), me.debt > 0 ? 'warn-text' : '')}
        ${metric('CO₂ cumulé', `${formatInt(me.co2)} t`, me.co2 > 5000 ? 'warn-text' : '', co2TooltipClient(me))}
      </div>
    </div>

    <div class="card">
      <h3>Réseau</h3>
      <div class="card-grid">
        ${metric('Lignes actives', activeLines)}
        ${metric('Trains', me.trains.length)}
        ${metric('Gares exploitées', Object.keys(me.stations).length)}
        ${metric('Capacité R&D', `${round(researchWorkRateClient(me))}x`, '', researchCapacityTooltipClient(me))}
      </div>
    </div>

    ${renderFinanceSummary(me)}

    <div class="card">
      <h3>Événements en cours</h3>
      <div class="list">
        ${app.state.game.events.map(e => {
          const tickMs = Math.max(250, Number(app.state?.game?.tickMs || 2000));
          const remainingMs = Math.max(0, Number(e.remainingMs || 0) || Number(e.remaining || 0) * tickMs);
          const punctuality = Number(e.punctualityPenalty || 0);
          const satisfaction = Number(e.satisfactionPenalty || 0);
          return `
            <div class="list-item">
              <div class="item-title"><strong>${escapeHtml(e.title)}</strong><span class="tag">${escapeHtml(formatDurationMs(remainingMs))}</span></div>
              <div class="kv">
                <span>Voyageurs</span><b>×${round(e.passenger || 1)}</b>
                <span>Fret</span><b>×${round(e.freight || 1)}</b>
                ${punctuality ? `<span>Ponctualité</span><b>-${round(punctuality)} pts</b>` : ''}
                ${satisfaction ? `<span>Satisfaction</span><b>-${round(satisfaction)} pts</b>` : ''}
              </div>
            </div>
          `;
        }).join('') || '<p class="muted">Aucun événement.</p>'}
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
  `;
}

function metric(label, value, cls = '', tip = '') {
  return `<div class="metric" ${tooltipAttr(tip)}><span>${escapeHtml(label)}</span><b class="${cls}">${escapeHtml(String(value))}</b></div>`;
}

function scoreTooltipClient(me, activeLines = 0) {
  const cashScore = Math.round(Number(me?.cash || 0) * 0.01);
  const debtScore = Math.round(-Number(me?.debt || 0) * 0.006);
  const reputationScore = Math.round(Number(me?.reputation || 0) * 800);
  const passengerScore = Math.round(Number(me?.stats?.passengers || 0) * 0.04);
  const freightScore = Math.round(Number(me?.stats?.freightTons || 0) * 0.08);
  const lineScore = Math.round(activeLines * 2000);
  const epochScore = Math.round(Number(me?.epoch || 0) * 45000);
  const total = cashScore + debtScore + reputationScore + passengerScore + freightScore + lineScore + epochScore;
  return [
    'Score : indicateur global de progression de la compagnie.',
    `Total actuel calculé : ${formatInt(total)} pts.`,
    '---------------------------------------------',
    'Sources du score :',
    `Trésorerie : ${formatInt(cashScore)} pts`,
    `Dette : ${formatInt(debtScore)} pts`,
    `Réputation : ${formatInt(reputationScore)} pts`,
    `Voyageurs cumulés : ${formatInt(passengerScore)} pts`,
    `Fret cumulé : ${formatInt(freightScore)} pts`,
    `Lignes actives (${activeLines}) : ${formatInt(lineScore)} pts`,
    `Époque : ${formatInt(epochScore)} pts`,
    '---------------------------------------------',
    'Les voyageurs, le fret et les lignes actives viennent directement de l’exploitation des lignes.'
  ].join('\n');
}

function co2TooltipClient(me) {
  const activeLines = (me?.lines || [])
    .filter(line => line?.active)
    .map(line => ({
      name: linePublicName(line),
      co2: Number(line?.stats?.environment?.co2PerHour ?? line?.stats?.co2PerHour ?? 0),
      energy: line?.stats?.environment?.energyType || line?.stats?.finance?.resourceType || '—'
    }))
    .filter(item => item.co2 > 0)
    .sort((a, b) => b.co2 - a.co2);
  const totalNow = activeLines.reduce((sum, item) => sum + item.co2, 0);
  const lines = [
    'CO₂ cumulé : total historique émis par la compagnie.',
    'Il augmente à chaque cycle d’exploitation selon les trains actifs, leur énergie, leur consommation, la distance et la fréquence.',
    `Cumul actuel : ${formatInt(me?.co2 || 0)} t.`,
    `Émissions actuelles estimées : ${formatInt(totalNow)} t/h.`,
    '---------------------------------------------',
    'Sources actuelles par ligne :'
  ];
  if (!activeLines.length) {
    lines.push('Aucune émission actuelle : aucune ligne active émettrice détectée.');
  } else {
    for (const item of activeLines.slice(0, 8)) {
      lines.push(`${item.name} : ${formatInt(item.co2)} t/h · énergie ${item.energy}`);
    }
    if (activeLines.length > 8) lines.push(`+ ${activeLines.length - 8} autre(s) ligne(s).`);
  }
  return lines.join('\n');
}

function financeMetric(label, amount, kind, tip = '') {
  const cls = kind === 'income' ? 'good-text' : (kind === 'expense' ? 'bad-text' : (Number(amount || 0) >= 0 ? 'good-text' : 'bad-text'));
  return metric(label, moneyPerHour(amount || 0), cls, tip);
}

function financeBreakdownTooltip(label, amount, details = []) {
  const lines = [
    `${label} : ${moneyPerHour(amount || 0)}.`,
    '---------------------------------------------',
    ...details.filter(Boolean)
  ];
  return lines.join('\n');
}

function renderFinanceSummary(me) {
  const b = me.stats?.lastBreakdown || {};
  const operatingMargin = me.stats.lastRevenue > 0 ? Math.round((me.stats.lastProfit / me.stats.lastRevenue) * 100) : 0;
  const variableLineCost = Number(b.variableLineCost || 0);
  const sharedCosts = Number(b.sharedCosts || 0);
  return `
    <div class="card">
      <h3>Résultat d’exploitation</h3>
      <div class="card-grid finance-card-grid">
        ${financeMetric('Revenus lignes /h', b.lineRevenue || me.stats.lastRevenue, 'income', financeBreakdownTooltip('Revenus lignes', b.lineRevenue || me.stats.lastRevenue, [
          `Billets voyageurs : ${moneyPerHour(b.ticketRevenue || 0)}`,
          `Recettes annexes voyageurs : ${moneyPerHour(b.ancillaryRevenue || 0)}`,
          `Fret : ${moneyPerHour(b.freightRevenue || 0)}`,
          `Bonus exploitation / dispatch : ${moneyPerHour(b.dispatchRevenueBoost || 0)}`
        ]))}
        ${financeMetric('Revenus gares /h', b.stationRevenue || 0, 'income', financeBreakdownTooltip('Revenus gares', b.stationRevenue || 0, [
          'Sources : niveau des gares possédées, commerce, dépôts, trafic voyageurs et trafic fret.',
          'Les recherches de flux voyageurs et de pôles intermodaux peuvent augmenter cette recette.'
        ]))}
        ${financeMetric('Coûts variables /h', variableLineCost, 'expense', financeBreakdownTooltip('Coûts variables', variableLineCost, [
          `Énergie : ${moneyPerHour(b.energyCost || 0)}`,
          `Maintenance trains : ${moneyPerHour(b.trainMaintenanceCost || 0)}`,
          `Infrastructure des lignes : ${moneyPerHour(b.lineInfrastructureCost || 0)}`,
          `Exploitation commerciale : ${moneyPerHour(b.commercialOperatingCost || 0)}`,
          `Péages : ${moneyPerHour(b.accessCost || 0)} dont infrastructure ${moneyPerHour(b.infrastructurePassageCost || 0)} et gares ${moneyPerHour(b.stationAccessCost || 0)}`
        ]))}
        ${financeMetric('Charges fixes /h', sharedCosts, 'expense', financeBreakdownTooltip('Charges fixes', sharedCosts, [
          `Personnel : ${moneyPerHour(b.staffCost || 0)}`,
          `Gares possédées : ${moneyPerHour(b.stationCost || 0)}`,
          `Intérêts de dette : ${moneyPerHour(b.debtCost || 0)}`,
          `Parc inutilisé : ${moneyPerHour(b.idleTrainCost || 0)}`,
          `Laboratoire R&D actif : ${moneyPerHour(b.researchCost || 0)}`
        ]))}
        ${financeMetric('Personnel /h', b.staffCost || 0, 'expense', financeBreakdownTooltip('Personnel', b.staffCost || 0, [
          'Somme des salaires horaires : conducteurs, contrôleurs, agents de gare, mécaniciens, régulateurs et ingénieurs.',
          'La Formation équipages réduit une partie de cette charge.'
        ]))}
        ${financeMetric('Gares /h', b.stationCost || 0, 'expense', financeBreakdownTooltip('Gares', b.stationCost || 0, [
          'Coût d’exploitation des gares possédées : niveau, commerces, maintenance et dépôts.'
        ]))}
        ${financeMetric('Dette /h', b.debtCost || 0, 'expense', financeBreakdownTooltip('Dette', b.debtCost || 0, [
          'Intérêts appliqués à la dette de la compagnie.'
        ]))}
        ${financeMetric('Parc inutilisé /h', b.idleTrainCost || 0, 'expense', financeBreakdownTooltip('Parc inutilisé', b.idleTrainCost || 0, [
          'Coût de stockage et d’immobilisation des trains non affectés à une ligne active.'
        ]))}
        ${financeMetric('R&D /h', b.researchCost || 0, 'expense', financeBreakdownTooltip('R&D', b.researchCost || 0, [
          'Coût du laboratoire quand une recherche est en cours.'
        ]))}
        ${metric('Résultat net /h', moneyPerHour(me.stats.lastProfit), me.stats.lastProfit >= 0 ? 'good-text' : 'bad-text', financeBreakdownTooltip('Résultat net', me.stats.lastProfit, [
          'Calcul : revenus lignes + revenus gares - coûts variables - charges fixes.'
        ]))}
        ${metric('Marge', `${operatingMargin}%`, operatingMargin >= 0 ? 'good-text' : 'bad-text', [
          `Marge d’exploitation : ${operatingMargin}%.`,
          'Calcul : résultat net / revenus totaux.'
        ].join('\n'))}
      </div>
    </div>
  `;
}


// ===== 03-research-lines-foundations.js =====
// Helpers R&D, métriques, art et fondations des écrans.
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

function researchCapacityTooltipClient(me = app.state?.me) {
  const reputation = Number(me?.reputation || 0);
  const reputationBonus = Math.min(0.32, Math.max(0, reputation - 50) * 0.004);
  const crewTrainingLevel = techLevel('crew_training');
  const crewTrainingBonus = crewTrainingLevel * 0.025;
  const centralizedControlLevel = techLevel('centralized_control');
  const centralizedControlBonus = Math.min(0.22, centralizedControlLevel * 0.018);
  const total = 1 + reputationBonus + crewTrainingBonus + centralizedControlBonus;
  return [
    'Capacité R&D : vitesse réelle de progression des recherches.',
    `Valeur actuelle : ${round(researchWorkRateClient(me))}x. Une valeur de 1,20x signifie +20% de vitesse.`,
    '---------------------------------------------',
    'Sources des modificateurs :',
    'Base laboratoire : 1,00x',
    `Réputation (${Math.round(reputation)}/100) : +${round(reputationBonus)}x`,
    `Formation équipages niv. ${crewTrainingLevel} : +${round(crewTrainingBonus)}x`,
    `Commande centralisée niv. ${centralizedControlLevel} : +${round(centralizedControlBonus)}x`,
    `Total calculé : ${round(total)}x`
  ].join('\n');
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

function selectResearchNode(nodeId) {
  const groupId = researchGroupForNode(nodeId);
  if (!groupId) return;
  if (typeof hideGlobalTooltip === 'function') hideGlobalTooltip();
  app.activeTab = 'research';
  app.activeResearchTab = groupId;
  app.selectedResearchId = nodeId;
  app.highlightResearchId = '';
  localStorage.setItem('sillons.activeTab', app.activeTab);
  localStorage.setItem('sillons.researchTab', app.activeResearchTab);
  renderAll();
  requestAnimationFrame(() => {
    const el = document.querySelector(`.tech-node[data-node-id="${CSS.escape(nodeId)}"]`);
    if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    constrainResearchDetailPanel();
  });
}

function closeResearchDetails() {
  if (!app.selectedResearchId) return;
  if (typeof hideGlobalTooltip === 'function') hideGlobalTooltip();
  app.selectedResearchId = '';
  renderAll();
}

function bindResearchDetailDrag() {
  const startDrag = (event, id) => {
    const panel = event.target.closest?.('[data-research-detail-drag]');
    if (!panel) return;
    if (event.target.closest('button, a, input, select, textarea, [data-action]')) return;
    const offset = app.researchDetailOffset || { x: 0, y: 0 };
    app.researchDetailDrag = {
      pointerId: id,
      panel,
      x: Number(offset.x || 0),
      y: Number(offset.y || 0),
      lastX: event.clientX,
      lastY: event.clientY
    };
    panel.classList.add('is-dragging');
    event.preventDefault();
  };

  const moveDrag = (event, id) => {
    const drag = app.researchDetailDrag;
    if (!drag || drag.pointerId !== id) return;
    let dx = event.clientX - drag.lastX;
    let dy = event.clientY - drag.lastY;
    const rect = drag.panel.getBoundingClientRect();
    const margin = 10;
    if (rect.left + dx < margin) dx += margin - (rect.left + dx);
    if (rect.right + dx > window.innerWidth - margin) dx -= rect.right + dx - (window.innerWidth - margin);
    if (rect.top + dy < margin) dy += margin - (rect.top + dy);
    if (rect.bottom + dy > window.innerHeight - margin) dy -= rect.bottom + dy - (window.innerHeight - margin);
    drag.x += dx;
    drag.y += dy;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    app.researchDetailOffset = { x: Math.round(drag.x), y: Math.round(drag.y) };
    drag.panel.style.setProperty('--research-detail-x', `${app.researchDetailOffset.x}px`);
    drag.panel.style.setProperty('--research-detail-y', `${app.researchDetailOffset.y}px`);
    event.preventDefault();
  };

  const finishDrag = id => {
    const drag = app.researchDetailDrag;
    if (!drag || drag.pointerId !== id) return;
    drag.panel.classList.remove('is-dragging');
    localStorage.setItem('sillons.researchDetailOffset', JSON.stringify(app.researchDetailOffset || { x: 0, y: 0 }));
    app.researchDetailDrag = null;
  };

  // Souris : clic gauche maintenu, indépendamment du comportement PointerEvent
  // que certains navigateurs réservent au bouton du milieu dans ce contexte.
  document.addEventListener('mousedown', event => {
    if (event.button !== 0) return;
    startDrag(event, 'mouse-left');
  }, true);
  document.addEventListener('mousemove', event => moveDrag(event, 'mouse-left'), true);
  document.addEventListener('mouseup', event => {
    if (event.button === 0) finishDrag('mouse-left');
  }, true);

  // Tactile et stylet conservent PointerEvent.
  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    startDrag(event, `pointer-${event.pointerId}`);
  }, true);
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') moveDrag(event, `pointer-${event.pointerId}`);
  }, true);
  document.addEventListener('pointerup', event => finishDrag(`pointer-${event.pointerId}`), true);
  document.addEventListener('pointercancel', event => finishDrag(`pointer-${event.pointerId}`), true);
}

function constrainResearchDetailPanel() {
  const panel = document.querySelector('.research-detail-panel');
  if (!panel) return;
  const rect = panel.getBoundingClientRect();
  const margin = 10;
  let dx = 0;
  let dy = 0;
  if (rect.left < margin) dx = margin - rect.left;
  if (rect.right + dx > window.innerWidth - margin) dx += window.innerWidth - margin - (rect.right + dx);
  if (rect.top < margin) dy = margin - rect.top;
  if (rect.bottom + dy > window.innerHeight - margin) dy += window.innerHeight - margin - (rect.bottom + dy);
  if (!dx && !dy) return;
  const offset = app.researchDetailOffset || { x: 0, y: 0 };
  app.researchDetailOffset = { x: Math.round(Number(offset.x || 0) + dx), y: Math.round(Number(offset.y || 0) + dy) };
  panel.style.setProperty('--research-detail-x', `${app.researchDetailOffset.x}px`);
  panel.style.setProperty('--research-detail-y', `${app.researchDetailOffset.y}px`);
  localStorage.setItem('sillons.researchDetailOffset', JSON.stringify(app.researchDetailOffset));
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

function researchQueueCompletionInfo(me = app.state?.me) {
  if (!me) return null;
  const queue = Array.isArray(me.researchQueue) ? me.researchQueue : [];
  const project = me.researchProject || null;
  const launchedCount = queue.length + (project ? 1 : 0);
  if (!launchedCount) return null;
  const workRate = Math.max(0.01, Number(researchWorkRateClient(me) || 1));
  let remainingRealMs = 0;
  if (project) {
    if (Number.isFinite(Number(project.endAt)) && Number(project.endAt) > 0) {
      remainingRealMs += Math.max(0, Number(project.endAt) - serverNow());
    } else {
      remainingRealMs += Math.max(0, Number(project.realRemainingMs ?? project.remainingMs ?? 0));
    }
  }
  for (const item of queue) {
    remainingRealMs += Math.max(0, Number(item.durationMs || 0)) / workRate;
  }
  const endAt = serverNow() + remainingRealMs;
  return {
    launchedCount,
    queueCount: queue.length,
    workRate,
    remainingRealMs,
    endAt
  };
}

function formatCycles(value) {
  const n = Math.max(0, Math.ceil(Number(value || 0)));
  return n <= 1 ? '1 cycle' : `${n} cycles`;
}

function formatDurationMs(value) {
  const totalMinutes = Math.max(1, Math.ceil(Number(value || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${totalMinutes} min`;
  if (minutes <= 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
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

function constructionProgressPercentFromData(endAt, durationMs) {
  const now = serverNow();
  const remainingMs = Math.max(0, Number(endAt || 0) - now);
  return Math.max(0, Math.min(100, (1 - remainingMs / Math.max(1, Number(durationMs || 1))) * 100));
}

function applyConstructionProgress(el, rawProgress) {
  const key = el.dataset.constructionKey || '';
  const last = key ? Number(app.constructionProgressCache[key] ?? el.dataset.lastProgress ?? 0) : Number(el.dataset.lastProgress || 0);
  const progress = key ? Math.max(last, rawProgress) : rawProgress;
  el.dataset.lastProgress = String(progress);
  if (key) app.constructionProgressCache[key] = progress;
  el.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function applyMaintenanceProgress(el, rawProgress) {
  const key = el.dataset.maintenanceKey || '';
  const last = key ? Number(app.maintenanceProgressCache[key] ?? el.dataset.lastProgress ?? 0) : Number(el.dataset.lastProgress || 0);
  const progress = key ? Math.max(last, rawProgress) : rawProgress;
  el.dataset.lastProgress = String(progress);
  if (key) app.maintenanceProgressCache[key] = progress;
  el.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function updateConstructionTimers() {
  const now = serverNow();
  document.querySelectorAll('[data-construction-timer]').forEach(el => {
    const endAt = Number(el.dataset.endAt || 0);
    el.textContent = formatResearchTime(Math.max(0, endAt - now));
  });
  document.querySelectorAll('[data-construction-progress]').forEach(el => {
    const endAt = Number(el.dataset.endAt || 0);
    const durationMs = Math.max(1, Number(el.dataset.durationMs || 1));
    const progress = constructionProgressPercentFromData(endAt, durationMs);
    applyConstructionProgress(el, progress);
  });
}

function updateMaintenanceTimers() {
  const now = serverNow();
  document.querySelectorAll('[data-maintenance-timer]').forEach(el => {
    const endAt = Number(el.dataset.endAt || 0);
    el.textContent = formatResearchTime(Math.max(0, endAt - now));
  });
  document.querySelectorAll('[data-maintenance-progress]').forEach(el => {
    const endAt = Number(el.dataset.endAt || 0);
    const durationMs = Math.max(1, Number(el.dataset.durationMs || 1));
    const progress = constructionProgressPercentFromData(endAt, durationMs);
    applyMaintenanceProgress(el, progress);
  });
}

function updateResearchTimers() {
  const now = serverNow();
  document.querySelectorAll('[data-research-timer], [data-research-total-timer]').forEach(el => {
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
  updateConstructionTimers();
  updateMaintenanceTimers();
}

function startResearchAnimationLoop() {
  if (app.researchAnimationLoopStarted) return;
  app.researchAnimationLoopStarted = true;
  const tick = () => {
    updateResearchTimers();
    updateEpochTrafficAnimation();
    const visibleResearch = app.activeTab === 'research' || document.querySelector('[data-research-timer], [data-research-total-timer], [data-construction-timer], [data-maintenance-timer], [data-epoch-traffic-value]');
    window.setTimeout(tick, visibleResearch ? 250 : 1000);
  };
  window.setTimeout(tick, 250);
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
  if (!app.state?.me?.stations?.[station?.id] && upgrade.kind === 'level') {
    return `${station.name} est libre. L’achat direct de gare est retiré : ajoute-la à une ligne et achète des sillons pour y faire rouler ton matériel.`;
  }
  const effects = {
    level: upgrade.label === 'Acheter'
      ? 'achète la gare, permet d’y créer des lignes et donne droit aux revenus de passage payés par les concurrents.'
      : 'augmente la capacité et l’attractivité de la gare ; débloque une meilleure base pour les autres améliorations.',
    commerce: 'ajoute des revenus annexes et améliore la satisfaction voyageurs.'
  };
  const nextAsset = { ...(asset || {}) };
  if (upgrade.kind === 'level') nextAsset.level = upgrade.label === 'Acheter' ? 1 : Number(nextAsset.level || 1) + 1;
  if (upgrade.kind === 'commerce') nextAsset.commerce = Number(nextAsset.commerce || 0) + 1;
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



function loadArtImage(src) {
  if (!src) return null;
  if (artImages[src]) return artImages[src];
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => requestMapRedraw({ lite: false });
  img.src = src;
  artImages[src] = img;
  return img;
}

function preloadArt(sources = [ART.map]) {
  const queue = new Set(sources.filter(Boolean));
  if (app.activeTab && ART.tabs[app.activeTab]) queue.add(ART.tabs[app.activeTab]);
  queue.forEach(src => {
    loadArtImage(src);
  });
}


function preloadMapSprites() {
  Object.entries(TRAIN_MAP_SPRITES).forEach(([id, src]) => {
    if (!src || app.mapSprites.trains[id]) return;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => requestMapRedraw({ lite: false });
    img.src = src;
    app.mapSprites.trains[id] = img;
  });
  Object.entries(STATION_MAP_SPRITES).forEach(([level, src]) => {
    if (!src || app.mapSprites.stations[level]) return;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => requestMapRedraw({ lite: false });
    img.src = src;
    app.mapSprites.stations[level] = img;
  });
}

function stationPrestigeStage(asset) {
  if (!asset) return 1;
  const score = Number(asset.level || 1)
    + Math.floor(Number(asset.commerce || 0) / 2);
  return Math.max(1, Math.min(6, score));
}

function getTrainMapSprite(modelId) {
  return app.mapSprites.trains[modelId] || null;
}

function getStationMapSprite(asset) {
  const level = String(stationPrestigeStage(asset));
  if (!app.mapSprites.stations[level] && STATION_MAP_SPRITES[level]) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => requestMapRedraw({ lite: false });
    img.src = STATION_MAP_SPRITES[level];
    app.mapSprites.stations[level] = img;
  }
  return app.mapSprites.stations[level] || null;
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


// ===== 04-lines.js =====
// Création, modification, gestion et affichage des lignes.
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
  const communeTag = status ? `${formatInt(status.count || 0)} gares` : 'Gares';
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
  const profile = routeProfileForDraftClient(draft);
  const direct = getRouteForStops([from, to], { profile });
  const preparedStops = buildLineDraftStops();
  const prepared = preparedStops.length >= 2 ? getRouteForStops(preparedStops, { profile }) : direct;
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
  if (!data.directDistance || !data.preparedDistance) {
    return `<span>Calculateur de distance</span><b>${escapeHtml(data.label)} : itinéraire RFN en cours ou introuvable</b>`;
  }
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
  const freeTrains = me.trains.filter(t => !t.construction?.active && !t.maintenance?.active && !me.lines.some(l => l.active && lineHasTrain(l, t.id)));
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
              <p class="muted small">Ajoute les gares desservies dans l’ordre exact du parcours : le jeu valide ensuite chaque segment RFN réel sans réorganiser les arrêts.</p>
              ${renderStationSearchField('via', 'Ajouter une desserte', draft.viaCandidate, draft.viaQuery)}
              <button type="button" id="addWaypointBtn" class="primary" ${tooltipAttr('Ajoute cette gare à la suite des arrêts intermédiaires déjà préparés.')}>Ajouter cette desserte</button>
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
        ${metric('Voyageurs prévus / an', formatInt(totalPassengers))}
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

function formatCadenceMinutes(value) {
  const minutes = Math.max(0, Math.round(Number(value || 0)));
  if (!minutes) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return `${hours} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}`;
}

function lineCadenceLabel(line) {
  const cadence = lineCadenceClient(line);
  if (!cadence?.plannedTrainCount) return '—';
  if (!Number(cadence.headwayMinutes)) return 'Suspendue';
  return `Toutes les ${formatCadenceMinutes(cadence.headwayMinutes)}`;
}

function lineCadenceTooltip(line) {
  const cadence = lineCadenceClient(line);
  if (!cadence?.plannedTrainCount) return 'Aucun train n’est affecté à cette ligne.';
  const lines = [
    'Cadencement réparti régulièrement sur le cycle complet aller-retour.',
    `Trajet aller estimé : ${formatCadenceMinutes(cadence.oneWayMinutes)} à ${round(cadence.operatingSpeedKmh)} km/h.`,
    `Cycle aller-retour : ${formatCadenceMinutes(cadence.roundTripMinutes)}, retournements inclus.`,
    `Trains affectés : ${cadence.plannedTrainCount}.`,
    `Intervalle programmé : toutes les ${formatCadenceMinutes(cadence.plannedHeadwayMinutes)}.`
  ];
  if (Number(cadence.headwayMinutes)) {
    lines.push(`Intervalle exploité : toutes les ${formatCadenceMinutes(cadence.headwayMinutes)} (${round(cadence.departuresPerHour)} départ(s)/h/sens).`);
  } else {
    lines.push('Exploitation suspendue : aucun train disponible.');
  }
  if (cadence.status === 'reduced') lines.push('Cadence dégradée par une indisponibilité, les conducteurs ou les sillons.');
  return lines.join('\n');
}

function renderLineInsightPanels(line) {
  const stats = line.stats || {};
  const finance = stats.finance || {};
  const market = stats.market || {};
  const capacity = stats.capacity || {};
  const lineSillonData = lineSillonDataClient(line);
  const cadence = lineCadenceClient(line);
  const contribution = Number(finance.contribution ?? stats.profit ?? 0);
  const netProfit = Number(finance.netProfit ?? stats.profit ?? 0);
  const factorDetails = line.service === 'freight'
    ? stats.attractiveness?.freight
    : stats.attractiveness?.passenger || stats.attractiveness?.freight;

  return `
    <div class="line-insight-grid">
      <section class="line-insight-panel">
        <h4>Finance /h (moyenne)</h4>
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
          <span>Demande voy. / an</span><b>${formatInt(market.passengerDemand || 0)} voy.</b>
          <span>Transportés / an</span><b>${formatInt(stats.passengers || 0)} voy.</b>
          <span>Demande fret / an</span><b>${formatInt(market.freightDemand || 0)} t</b>
          <span>Transporté / an</span><b>${formatInt(stats.freightTons || 0)} t</b>
          <span>Capacité voy. / an</span><b>${formatInt(capacity.passengers || 0)} voy.</b>
          <span>Capacité fret / an</span><b>${formatInt(capacity.freightTons || 0)} t</b>
          <span>Charge voy.</span><b>${linePercent(capacity.passengerLoad)}</b>
          <span>Charge fret</span><b>${linePercent(capacity.freightLoad)}</b>
          <span>Trains en circulation</span><b>${Number.isFinite(capacity.activeTrainCount) ? `${round(capacity.activeTrainCount)} / ${round(capacity.availableTrainCount || 0)}` : '—'}</b>
          <span>Allers simples / an</span><b>${formatInt(capacity.annualOneWayTrips || 0)}</b>
          <span>Cadence exploitée</span><b>${lineCadenceLabel(line)}</b>
          <span>Cycle aller-retour</span><b>${formatCadenceMinutes(cadence.roundTripMinutes)}</b>
          <span>Sillons actifs</span><b>${Number.isFinite(capacity.effectiveFrequency) ? round(capacity.effectiveFrequency) : round(lineSlotDemandClient(line))}</b>
          ${lineSillonData ? `<span>Capacité totale RFN</span><b>${round(lineSillonData.theoreticalCapacity)}</b>` : ''}
          ${lineSillonData ? `<span>Capacité joueurs</span><b>${round(lineSillonData.playerCapacity)} / ${round(lineSillonData.theoreticalCapacity)}</b>` : ''}
          ${lineSillonData ? `<span>Déjà utilisés joueurs</span><b>${round(lineSillonData.usedByPlayers)} / ${round(lineSillonData.playerCapacity)}</b>` : ''}
          ${lineSillonData ? `<span>Disponibles pour cette ligne</span><b>${round(lineSillonData.remainingForLine)}</b>` : ''}
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

function lineSillonDataClient(line) {
  const sillons = line?.stats?.capacity?.sillons || line?.stats?.staffing?.sillons || null;
  if (!sillons) return null;
  const bottleneck = sillons.bottleneck || null;
  const fallbackCapacity = Number(sillons.theoreticalCapacity ?? bottleneck?.theoreticalCapacity ?? sillons.lineCapacity ?? sillons.playerCapacity ?? sillons.maxFrequency ?? lineSlotDemandClient(line));
  const theoreticalCapacity = Math.max(0, Math.floor(Number.isFinite(fallbackCapacity) ? fallbackCapacity : 0));
  const rawPlayerCapacity = Number(sillons.playerCapacity ?? bottleneck?.playerCapacity ?? theoreticalCapacity);
  const playerCapacity = Math.max(0, Math.floor(Number.isFinite(rawPlayerCapacity) ? rawPlayerCapacity : theoreticalCapacity));
  const displayCapacity = playerCapacity || theoreticalCapacity;
  const rawResearchCapacity = Number(sillons.lineResearchCapacity ?? bottleneck?.lineResearchCapacity ?? 0);
  const lineResearchCapacity = Math.max(0, Math.floor(Number.isFinite(rawResearchCapacity) ? rawResearchCapacity : 0));
  const rawUsedByPlayer = Number(sillons.requestedFrequency ?? lineSlotDemandClient(line));
  const usedByPlayer = Math.max(0, Math.floor(Number.isFinite(rawUsedByPlayer) ? rawUsedByPlayer : 0));
  const backgroundUsed = 0;
  const fallbackAvailable = Number(sillons.maxFrequency ?? bottleneck?.available ?? playerCapacity);
  const rawUsedByOthers = Number(bottleneck?.usedByOthers ?? Math.max(0, playerCapacity - fallbackAvailable));
  const usedByOthers = Math.max(0, Math.floor(Number.isFinite(rawUsedByOthers) ? rawUsedByOthers : 0));
  const usedByPlayers = Math.max(0, usedByOthers + usedByPlayer);
  const totalUsed = usedByPlayers;
  const available = Math.max(0, Math.floor(playerCapacity - usedByOthers));
  const remainingForLine = Math.max(0, Math.floor(playerCapacity - usedByOthers - usedByPlayer));
  const theoreticalRemaining = Math.max(0, Math.floor(theoreticalCapacity - totalUsed));
  const utilizationPercent = theoreticalCapacity > 0 ? totalUsed / theoreticalCapacity * 100 : 0;
  return {
    sillons,
    bottleneck,
    available,
    displayCapacity,
    theoreticalCapacity,
    playerCapacity,
    lineResearchCapacity,
    backgroundUsed,
    usedByPlayer,
    usedByOthers,
    usedByPlayers,
    totalUsed,
    remainingForLine,
    theoreticalRemaining,
    utilizationPercent
  };
}

function lineSillonOtherUsageLabel(bottleneck) {
  const used = Math.max(0, Number(bottleneck?.usedByOthers || 0));
  const details = Array.isArray(bottleneck?.usedByOthersDetails) ? bottleneck.usedByOthersDetails : [];
  if (!details.length) return `Utilisé par autres joueurs : ${round(used)} sillon(s)/h`;
  const detailText = details
    .filter(item => Number(item.frequency || 0) > 0)
    .slice(0, 6)
    .map(item => `${item.playerName || 'Autre compagnie'} · ${item.lineName || 'Ligne'}`)
    .join(' ; ');
  const more = details.length > 6 ? ` ; +${details.length - 6}` : '';
  return `Utilisé par autres joueurs : ${round(used)} sillon(s)/h (${detailText}${more})`;
}

function lineSillonLabel(line) {
  const data = lineSillonDataClient(line);
  if (!data) return '';
  const {
    sillons,
    bottleneck,
    displayCapacity,
    theoreticalCapacity,
    playerCapacity,
    lineResearchCapacity,
    usedByPlayer,
    usedByPlayers,
    remainingForLine,
    theoreticalRemaining,
    utilizationPercent
  } = data;
  const from = bottleneck ? (bottleneck.fromName || bottleneck.from || 'N/A') : 'N/A';
  const to = bottleneck ? (bottleneck.toName || bottleneck.to || 'N/A') : 'N/A';
  const tags = Array.isArray(bottleneck?.tags) && bottleneck.tags.length ? `Profil : ${bottleneck.tags.join(', ')}` : '';
  return [
    `Tronçon limitant : ${from} -> ${to}`,
    `Capacité totale RFN : ${round(theoreticalCapacity)} sillon(s)/h`,
    `Capacité possédée par les joueurs : ${round(playerCapacity)} / ${round(theoreticalCapacity)} sillon(s)/h`,
    lineResearchCapacity && lineResearchCapacity < playerCapacity ? `Limite R&D de cette ligne : ${round(lineResearchCapacity)} sillon(s)/h` : '',
    `Sillons utilisés par cette ligne : ${round(usedByPlayer)} / ${round(displayCapacity)} sillon(s)/h`,
    lineSillonOtherUsageLabel(bottleneck),
    `Occupation joueurs sur le tronçon : ${round(usedByPlayers)} / ${round(playerCapacity)} sillon(s)/h (${round(utilizationPercent)}%)`,
    `Sillons restants affectables à cette ligne : ${round(remainingForLine)} sillon(s)/h`,
    `Marge RFN restante après joueurs : ${round(theoreticalRemaining)} sillon(s)/h`,
    tags,
    sillons.constrained ? 'Statut : ligne limitée par les sillons disponibles.' : ''
  ].filter(Boolean).join('\n');
}

function renderLineSillonMini(line) {
  const data = lineSillonDataClient(line);
  if (!data) return '';
  const { sillons, playerCapacity, displayCapacity, usedByPlayer, remainingForLine } = data;
  const requested = Number(sillons.requestedFrequency ?? lineSlotDemandClient(line));
  const cls = sillons.constrained || requested > playerCapacity ? 'warn-text' : 'good-text';
  const badgeCls = remainingForLine > 0 ? 'good' : 'warn';
  const tip = lineSillonLabel(line);
  return `<div class="line-sillon-stat" ${tooltipAttr(tip)}><span>Sillons</span><em class="line-sillon-badge ${badgeCls}" aria-label="${formatInt(remainingForLine)} sillon(s) disponible(s)">${formatInt(remainingForLine)} disponible(s)</em><b class="${cls}">${formatInt(usedByPlayer)}/${formatInt(displayCapacity)}</b></div>`;
}

function renderLineSillonCollapsedSummary(line) {
  const data = lineSillonDataClient(line);
  if (!data) return '';
  const requested = Number(data.sillons.requestedFrequency ?? lineSlotDemandClient(line));
  const cls = data.sillons.constrained || requested > data.playerCapacity ? 'warn-text' : 'good-text';
  const badgeCls = data.remainingForLine > 0 ? 'good' : 'warn';
  return `<span class="line-sillon-summary" ${tooltipAttr(lineSillonLabel(line))}>Sillons <em class="line-sillon-badge ${badgeCls}" aria-label="${formatInt(data.remainingForLine)} sillon(s) disponible(s)">${formatInt(data.remainingForLine)} disponible(s)</em><b class="${cls}">${formatInt(data.usedByPlayer)}/${formatInt(data.displayCapacity)}</b></span>`;
}

function renderLineItem(line) {
  const stops = lineStopsOf(line);
  const assignedTrains = lineAssignedTrainsClient(line);
  const train = assignedTrains[0];
  const model = train ? app.state.balance.trains[train.modelId] : null;
  const trainLabel = assignedTrains.length > 1 ? `${assignedTrains.length} trains` : (model?.name || 'Aucun');
  const cadence = lineCadenceClient(line);
  const cadenceLabel = lineCadenceLabel(line);
  const cadenceTip = lineCadenceTooltip(line);
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
        : line.stats?.status === 'construction'
          ? { cls: 'warn', label: 'Train en fabrication' }
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
      <span>Distance <b>${formatInt(lineDistance(line))} km</b></span>
      <span ${tooltipAttr(cadenceTip)}>Cadence <b>${escapeHtml(cadenceLabel)}</b></span>
      ${renderLineSillonCollapsedSummary(line)}
      <span>Net /h <b class="${profitCls}">${moneyPerHour(profit)}</b></span>
    </div>
  `;

  const expandedContent = `
      <div class="line-card-modern-route">
        <span>${stops.map((id, index) => `<i title="${escapeAttr(station(id)?.name || id)}">${index + 1}</i>`).join('<b></b>')}</span>
      </div>

      <div class="line-card-modern-stats">
        <div><span>Distance</span><b>${formatInt(lineDistance(line))} km</b></div>
        <div><span>Service</span><b>${serviceLabels[line.service]}</b></div>
        <div><span>Trains affectés</span><b>${assignedTrains.length}</b></div>
        <div ${tooltipAttr(cadenceTip)}><span>Cadence</span><b>${escapeHtml(cadenceLabel)}</b></div>
        <div ${tooltipAttr(cadenceTip)}><span>Cycle A/R</span><b>${formatCadenceMinutes(cadence.roundTripMinutes)}</b></div>
        ${renderLineSillonMini(line)}
        <div><span>Billet moyen</span><b>${money(ticketPrice)}</b></div>
        <div><span>Attractivite</span><b>${escapeHtml(String(lineAttractivenessLabel(line)))}</b></div>
        <div><span>Net estimé /h</span><b class="${profitCls}">${moneyPerHour(profit)}</b></div>
      </div>

      ${renderLineInsightPanels(line)}

      <div class="line-card-modern-actions">
        <button data-action="focus-line" data-id="${line.id}" ${tooltipAttr('Centre la carte sur cette ligne et masque temporairement les autres tracés.')}>Carte</button>
        <button data-action="edit-line" data-id="${line.id}" ${tooltipAttr('Ouvre l’éditeur complet : trains affectés, prix du billet, arrêts et ordre des gares en glissé-déposé.')}>Modifier</button>
        <button data-action="electrify-line" data-id="${line.id}" ${tooltipAttr(line.electrified ? 'Cette ligne est déjà électrifiée.' : lineElectrificationTooltip(line))} ${line.electrified || !canElectrify ? 'disabled' : ''}>
          ${line.electrified ? 'Électrifiée' : `Électrifier · ${money(electrifyCost)}`}
        </button>
        <button class="danger close-line-btn" data-action="close-line" data-id="${line.id}" ${tooltipAttr('Ferme la ligne. Le train est libéré et la ligne ne génère plus de revenus.')} ${line.active ? '' : 'disabled'}>Fermer</button>
      </div>
  `;

  return `
    <article class="line-card-modern ${line.active ? '' : 'inactive'} ${collapsed ? 'collapsed' : ''} ${app.focusedLineId === line.id ? 'map-focused' : ''}" data-line-id="${escapeAttr(line.id)}">
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


// ===== 05-fleet-compositions.js =====
// Parc, catalogue, maintenance et compositions du matériel roulant.
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
  return !next || base === next
    ? ''
    : `<span class="train-stat-modifier"><span class="train-stat-modifier-base">${escapeHtml(base)}</span> <span aria-hidden="true">→</span> <span class="train-stat-modifier-after">${escapeHtml(next)}</span></span>`;
}

function trainResearchPercentValues(baseValue, modifiedValue) {
  const base = `${Math.round(Number(baseValue || 0) * 100)}%`;
  if (Math.abs(Number(modifiedValue || 0) - Number(baseValue || 0)) < 0.00001) return { base, modified: base };
  const adjusted = Math.round(Number(modifiedValue || 0) * 1000) / 10;
  return {
    base,
    modified: `${adjusted.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}%`
  };
}

function renderTrainStat(label, value, ratio, cls = '', modifiedValue = '', modifiedRatio = null) {
  const pct = Math.max(4, Math.min(100, Math.round(ratio * 100)));
  const extraPct = modifiedRatio == null ? pct : Math.max(pct, Math.min(100, Math.round(modifiedRatio * 100)));
  const hasModifier = modifiedValue !== '' && modifiedValue != null && String(modifiedValue) !== String(value);
  const improvesBar = hasModifier && modifiedRatio != null && Number(modifiedRatio) > Number(ratio);
  const addPct = improvesBar ? Math.min(100 - pct, Math.max(2, extraPct - pct)) : 0;
  const hasBarBonus = improvesBar && addPct > 0;
  return `
    <div class="train-stat ${cls} ${hasModifier ? 'has-modifier' : ''}">
      <span>${escapeHtml(label)}</span>
      <b>${hasModifier ? formatTrainStatModifier(value, modifiedValue) : escapeHtml(String(value))}</b>
      <i><em style="width:${pct}%"></em>${hasBarBonus ? `<strong style="left:${pct}%; width:${addPct}%"></strong>` : ''}</i>
    </div>`;
}

const TRAIN_ART_BY_MODEL_ID = Object.freeze({
  steam_001_141_r: '/assets/trains/steam/steam_001_141_r.png',
  steam_002_231_k: '/assets/trains/steam/steam_002_231_k.png',
  steam_003_241_p: '/assets/trains/steam/steam_003_241_p.png',
  steam_004_141_p: '/assets/trains/steam/steam_004_141_p.png',
  steam_005_150_p: '/assets/trains/steam/steam_005_150_p.png',
  steam_006_140_c: '/assets/trains/steam/steam_006_140_c.png',
  steam_007_231_g: '/assets/trains/steam/steam_007_231_g.png',
  steam_008_241_a: '/assets/trains/steam/steam_008_241_a.png',
  steam_009_232_u1: '/assets/trains/steam/steam_009_232_u1.png',
  steam_010_030_tu: '/assets/trains/steam/steam_010_030_tu.png',
  diesel_001_cc_72000: '/assets/trains/diesel/diesel_001_cc_72000.png',
  diesel_002_bb_67400: '/assets/trains/diesel/diesel_002_bb_67400.png',
  diesel_003_x_2800: '/assets/trains/diesel/diesel_003_x_2800.png',
  diesel_004_x_72500: '/assets/trains/diesel/diesel_004_x_72500.png',
  diesel_005_x_73500: '/assets/trains/diesel/diesel_005_x_73500.png',
  diesel_006_x_4300: '/assets/trains/diesel/diesel_006_x_4300.png',
  diesel_007_bb_67000: '/assets/trains/diesel/diesel_007_bb_67000.png',
  diesel_008_a1a_a1a_68000: '/assets/trains/diesel/diesel_008_a1a_a1a_68000.png',
  diesel_009_bb_66000: '/assets/trains/diesel/diesel_009_bb_66000.png',
  diesel_010_bb_75000: '/assets/trains/diesel/diesel_010_bb_75000.png',
  electric_loco_001_cc_6500: '/assets/trains/electric/electric_loco_001_cc_6500.png',
  electric_loco_002_bb_26000: '/assets/trains/electric/electric_loco_002_bb_26000.png',
  electric_loco_003_bb_22200: '/assets/trains/electric/electric_loco_003_bb_22200.png',
  electric_loco_004_bb_15000: '/assets/trains/electric/electric_loco_004_bb_15000.png',
  electric_loco_005_bb_7200: '/assets/trains/electric/electric_loco_005_bb_7200.png',
  electric_emu_006_z_5600: '/assets/trains/electric/electric_emu_006_z_5600.png',
  electric_emu_007_z_20500: '/assets/trains/electric/electric_emu_007_z_20500.png',
  electric_emu_008_z_50000: '/assets/trains/electric/electric_emu_008_z_50000.png',
  electric_emu_009_z_21500: '/assets/trains/electric/electric_emu_009_z_21500.png',
  electric_emu_010_regio_2n: '/assets/trains/electric/electric_emu_010_regio_2n.png',
  high_speed_001_tgv_sud_est: '/assets/trains/high_speed/high_speed_001_tgv_sud_est.png',
  high_speed_002_tgv_atlantique: '/assets/trains/high_speed/high_speed_002_tgv_atlantique.png',
  high_speed_003_tgv_reseau: '/assets/trains/high_speed/high_speed_003_tgv_reseau.png',
  high_speed_004_tgv_duplex: '/assets/trains/high_speed/high_speed_004_tgv_duplex.png',
  high_speed_005_tgv_pos: '/assets/trains/high_speed/high_speed_005_tgv_pos.png',
  high_speed_006_tgv_dasye: '/assets/trains/high_speed/high_speed_006_tgv_dasye.png',
  high_speed_007_euroduplex_2n2: '/assets/trains/high_speed/high_speed_007_euroduplex_2n2.png',
  high_speed_008_thalys_pbka: '/assets/trains/high_speed/high_speed_008_thalys_pbka.png',
  high_speed_009_eurostar_tmst: '/assets/trains/high_speed/high_speed_009_eurostar_tmst.png',
  high_speed_010_tgv_m: '/assets/trains/high_speed/high_speed_010_tgv_m.png',
  hydrogen_001_regiolis_h2: '/assets/trains/hydrogen/hydrogen_001_regiolis_h2.png',
  hydrogen_002_coradia_ilint: '/assets/trains/hydrogen/hydrogen_002_coradia_ilint.png',
  hydrogen_003_coradia_stream_h: '/assets/trains/hydrogen/hydrogen_003_coradia_stream_h.png',
  hydrogen_004_mireo_plus_h: '/assets/trains/hydrogen/hydrogen_004_mireo_plus_h.png',
  hydrogen_005_flirt_h2: '/assets/trains/hydrogen/hydrogen_005_flirt_h2.png',
  hydrogen_006_fch2rail: '/assets/trains/hydrogen/hydrogen_006_fch2rail.png',
  hydrogen_007_hybari: '/assets/trains/hydrogen/hydrogen_007_hybari.png',
  hydrogen_008_crrc_h2: '/assets/trains/hydrogen/hydrogen_008_crrc_h2.png',
  hydrogen_009_hyundai_h2: '/assets/trains/hydrogen/hydrogen_009_hyundai_h2.png',
  hydrogen_010_vittal_one_h2: '/assets/trains/hydrogen/hydrogen_010_vittal_one_h2.png',
  battery_001_agc_batteries: '/assets/trains/battery/battery_001_agc_batteries.png',
  battery_002_regiolis_hybride: '/assets/trains/battery/battery_002_regiolis_hybride.png',
  battery_003_coradia_bemu: '/assets/trains/battery/battery_003_coradia_bemu.png',
  battery_004_flirt_akku: '/assets/trains/battery/battery_004_flirt_akku.png',
  battery_005_mireo_plus_b: '/assets/trains/battery/battery_005_mireo_plus_b.png',
  battery_006_cityjet_eco: '/assets/trains/battery/battery_006_cityjet_eco.png',
  battery_007_talent_3_bemu: '/assets/trains/battery/battery_007_talent_3_bemu.png',
  battery_008_class_230_battery: '/assets/trains/battery/battery_008_class_230_battery.png',
  battery_009_hitachi_blues: '/assets/trains/battery/battery_009_hitachi_blues.png',
  battery_010_ev_e301_accum: '/assets/trains/battery/battery_010_ev_e301_accum.png',
  maglev_001_l0_series: '/assets/trains/maglev/maglev_001_l0_series.png',
  maglev_002_mlx01: '/assets/trains/maglev/maglev_002_mlx01.png',
  maglev_003_shanghai_transrapid: '/assets/trains/maglev/maglev_003_shanghai_transrapid.png',
  maglev_004_transrapid_08: '/assets/trains/maglev/maglev_004_transrapid_08.png',
  maglev_005_transrapid_09: '/assets/trains/maglev/maglev_005_transrapid_09.png',
  maglev_006_linimo: '/assets/trains/maglev/maglev_006_linimo.png',
  maglev_007_incheon: '/assets/trains/maglev/maglev_007_incheon.png',
  maglev_008_changsha: '/assets/trains/maglev/maglev_008_changsha.png',
  maglev_009_beijing_s1: '/assets/trains/maglev/maglev_009_beijing_s1.png',
  maglev_010_birmingham: '/assets/trains/maglev/maglev_010_birmingham.png'
});

function trainArtUrl(model) {
  const src = TRAIN_ART_BY_MODEL_ID[model?.id];
  return src ? `${src}?v=${encodeURIComponent(PROJECT_VERSION)}` : '';
}

function trainArtClass(model) {
  const classes = ['train-art'];
  if (model?.era) classes.push(`train-art-${String(model.era).replace(/[^a-z0-9_-]/gi, '-')}`);
  if (model?.id?.startsWith('high_speed_')) classes.push('train-art-high-speed');
  return classes.join(' ');
}

function renderTrainArt(model) {
  const artUrl = trainArtUrl(model);
  if (artUrl) {
    return `<div class="${escapeAttr(trainArtClass(model))}" data-train-art-id="${escapeAttr(model.id)}" aria-label="Visuel de ${escapeAttr(model.name)}"><img src="${escapeAttr(artUrl)}" alt="Illustration du train ${escapeAttr(model.name)}" loading="lazy" decoding="async"></div>`;
  }
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

function trainModelSearchLabelClient(model) {
  return `${model?.id || ''} ${model?.name || ''} ${model?.type || ''}`.toLowerCase();
}

function trainModelIdSearchLabelClient(model) {
  return String(model?.id || '').toLowerCase();
}

function isMultipleUnitModelClient(model) {
  if (!model) return false;
  if (model.multipleUnit === true || model.compositionFamily === 'multiple_unit' || model.compositionSpec?.mode === 'multiple_unit') return true;
  const id = trainModelIdSearchLabelClient(model);
  if (/(^|_)(emu|railcar|trainset|unit)(_|$)/.test(id)) return true;
  const label = trainModelSearchLabelClient(model);
  return /(autorail|automotrice|rame|navette|tgv|duplex|régio|regio|ter|hydrogène|hydrogene|batterie|maglev|grande vitesse)/.test(label);
}

function isHighSpeedTrainsetModelClient(model) {
  if (!model) return false;
  if (Number(model.multipleUnitMax || 0) === 2) return true;
  const id = trainModelIdSearchLabelClient(model);
  if (/^(hsv_|tgv)/.test(id) || /(_tgv|_duplex|trainset)/.test(id)) return true;
  const label = trainModelSearchLabelClient(model);
  return /(tgv|grande vitesse|duplex)/.test(label);
}


function normalizeRouteProfileClient(profile) {
  const value = String(profile || '').trim().toLowerCase();
  if (['highspeed', 'classic'].includes(value)) return value;
  return 'default';
}

function routeProfileForModelClient(model) {
  if (!model) return 'default';
  return isHighSpeedTrainsetModelClient(model) ? 'highspeed' : 'classic';
}

function routeProfileForTrainClient(train) {
  const model = train ? app.state?.balance?.trains?.[train.modelId] : null;
  return routeProfileForModelClient(model);
}

function routeProfileForLineClient(line, player = app.state?.me) {
  const trains = lineAssignedTrainsClient(line, player || app.state?.me || {}) || [];
  if (!trains.length) return 'default';
  return trains.some(train => routeProfileForTrainClient(train) === 'highspeed') ? 'highspeed' : 'classic';
}

function routeProfileForDraftClient(draft = app.lineDraft || {}) {
  const trainId = $('#lineTrain')?.value || draft.trainId || '';
  const train = app.state?.me?.trains?.find(t => t.id === trainId) || null;
  return routeProfileForTrainClient(train);
}

function multipleUnitMaxUnitsForModelClient(model) {
  if (!isMultipleUnitModelClient(model)) return 1;
  const explicit = Math.floor(Number(model?.multipleUnitMax || model?.compositionSpec?.powerUnits?.max || 0));
  if (explicit >= 1) return clamp(explicit, 1, 3);
  return isHighSpeedTrainsetModelClient(model) ? 2 : 3;
}

function compositionDefaultModeForModelClient(model) {
  if (isMultipleUnitModelClient(model)) return 'multiple_unit';
  const passengerDominant = (model?.capacity || 0) >= Math.max(80, (model?.freight || 0) * 0.9);
  return passengerDominant && (model?.capacity || 0) > 0 ? 'passenger_loco' : 'freight_loco';
}

function buildClientCompositionSpec(model, preferredMode = null) {
  const defaultMode = compositionDefaultModeForModelClient(model);
  if (defaultMode === 'multiple_unit') {
    const maxUnits = multipleUnitMaxUnitsForModelClient(model);
    return {
      mode: 'multiple_unit',
      availableModes: ['multiple_unit'],
      powerUnits: { min: 1, max: maxUnits, default: 1 },
      label: 'Rames en unité multiple',
      unitLabel: 'rame',
      passengerOnly: true,
      unitCapacity: Math.max(0, Math.round(Number(model?.capacity || 0))),
      unitCost: Math.max(0, Math.round(Number(model?.price || 0))),
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
  if (isMultipleUnitModelClient(model)) return 'multiple_unit';
  const requested = app.compositionEditorModes?.[train.id] || train?.composition?.mode || train?.compositionMode || train?.compositionSpec?.mode || compositionDefaultModeForModelClient(model);
  return buildClientCompositionSpec(model, requested).mode;
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
    return Math.round(modelPrice);
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
  const requestedMode = mode || composition.mode || compositionDefaultModeForModelClient(model);
  const activeMode = buildClientCompositionSpec(model, requestedMode).mode;
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
      <span>Valeur composition actuelle : <b>${money(value)}</b></span>
      <span class="small muted">Tout ajout est facturé. Pour les rames en unité multiple, chaque rame ajoutée coûte le prix du matériel de base. Tout retrait est remboursé à 78% de sa valeur, corrigé par l’usure du train (${condition}%).</span>
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
  const currentCompositionValue = compositionAssetValueClient(model, train.composition || defaultComposition, train.composition?.mode || defaultMode);
  const defaultCompositionValue = compositionAssetValueClient(model, defaultComposition, defaultMode);
  const baseTractionValue = defaultMode === 'multiple_unit'
    ? 0
    : Math.max(Math.round(Number(model.price || 0) * 0.42), Math.round(Number(model.price || 0) - defaultCompositionValue));
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
  if (train?.construction?.active) return `Livraison dans ${formatResearchTime(train.construction.remainingMs || train.construction.durationMs || 0)}`;
  if (train?.maintenance?.active) return 'En maintenance';
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
    const unitCount = clamp(Math.round(Number(c.powerUnits || spec.powerUnits.default || 1)), spec.powerUnits.min, spec.powerUnits.max);
    const ratio = unitCount;
    profile.capacity = Math.max(0, Math.round(profile.capacity * ratio));
    profile.freight = 0;
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
  if (spec.mode === 'multiple_unit') {
    const count = c.powerUnits || spec.powerUnits?.default || 1;
    return `${count} rame${count > 1 ? 's' : ''} en UM`;
  }
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

function trainServiceClass(model) {
  if (!model) return 'passengers';
  const cap = Number(model.capacity || 0);
  const freight = Number(model.freight || 0);
  if (freight > 0 && cap <= 0) return 'freight';
  if (freight > 0 && cap > 0) return 'mixed';
  return 'passengers';
}

function trainServiceSortLabel(kind) {
  return kind === 'freight' ? 'Fret' : kind === 'mixed' ? 'Mixte' : 'Voyageurs';
}

function compositionValidTrainIds() {
  return new Set((app.state?.me?.trains || []).map(train => train.id));
}

function compositionSelectedIds() {
  const valid = compositionValidTrainIds();
  const ids = Array.isArray(app.selectedCompositionTrainIds) ? app.selectedCompositionTrainIds : [];
  return [...new Set(ids.map(id => String(id || '').trim()).filter(id => valid.has(id)))];
}

function setCompositionSelection(ids, primaryId = '') {
  const valid = compositionValidTrainIds();
  const cleaned = [...new Set((ids || []).map(id => String(id || '').trim()).filter(id => valid.has(id)))];
  app.selectedCompositionTrainIds = cleaned;
  app.selectedCompositionTrainId = cleaned.includes(primaryId) ? primaryId : (cleaned[0] || '');
  if (app.compositionEditorTrainId && !cleaned.includes(app.compositionEditorTrainId)) {
    app.compositionEditorTrainId = '';
    localStorage.removeItem('sillons.compositionEditorTrainId');
  }
  localStorage.setItem('sillons.selectedCompositionTrainIds', JSON.stringify(cleaned));
  if (app.selectedCompositionTrainId) localStorage.setItem('sillons.selectedCompositionTrainId', app.selectedCompositionTrainId);
  else localStorage.removeItem('sillons.selectedCompositionTrainId');
}

function setCompositionEditorTrain(trainId = '') {
  const id = String(trainId || '').trim();
  if (id && !compositionValidTrainIds().has(id)) return false;
  const train = id ? app.state?.me?.trains?.find(item => item.id === id) : null;
  if (train?.construction?.active) return false;
  app.compositionEditorTrainId = id;
  if (id) localStorage.setItem('sillons.compositionEditorTrainId', id);
  else localStorage.removeItem('sillons.compositionEditorTrainId');
  return true;
}


function toggleCompositionCardSelection(trainId) {
  const id = String(trainId || '').trim();
  if (!compositionValidTrainIds().has(id)) return;
  const selected = new Set(compositionSelectedIds());
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  const next = [...selected];
  setCompositionSelection(next, selected.has(app.selectedCompositionTrainId) ? app.selectedCompositionTrainId : (selected.has(id) ? id : (next[0] || '')));
  renderAll();
}

function compositionEditTargetIds(primaryId = '') {
  const selected = compositionSelectedIds();
  if (selected.length) return selected;
  const valid = compositionValidTrainIds();
  return primaryId && valid.has(primaryId) ? [primaryId] : [];
}

function compositionGroupStorageKey(mode, key) {
  return `${mode || 'era'}::${key || 'default'}`;
}

function isCompositionGroupCollapsed(mode, key) {
  return Boolean(app.compositionGroupCollapsed?.[compositionGroupStorageKey(mode, key)]);
}

function setCompositionGroupCollapsed(mode, key, collapsed) {
  const storageKey = compositionGroupStorageKey(mode, key);
  app.compositionGroupCollapsed = { ...(app.compositionGroupCollapsed || {}), [storageKey]: Boolean(collapsed) };
  if (!collapsed) delete app.compositionGroupCollapsed[storageKey];
  localStorage.setItem('sillons.compositionGroupCollapsed', JSON.stringify(app.compositionGroupCollapsed));
}

function sortedCompositionTrains(trains) {
  const mode = 'era';
  return [...(trains || [])].sort((a, b) => {
    const ma = app.state.balance.trains[a.modelId] || {};
    const mb = app.state.balance.trains[b.modelId] || {};
    const eraA = Number(ma.unlockEpoch ?? ma.epoch ?? 0);
    const eraB = Number(mb.unlockEpoch ?? mb.epoch ?? 0);
    const typeA = trainServiceClass(ma);
    const typeB = trainServiceClass(mb);
    if (mode === 'type') {
      if (typeA !== typeB) return trainServiceSortLabel(typeA).localeCompare(trainServiceSortLabel(typeB), 'fr');
      if (eraA !== eraB) return eraA - eraB;
    } else {
      if (eraA !== eraB) return eraA - eraB;
      if (typeA !== typeB) return trainServiceSortLabel(typeA).localeCompare(trainServiceSortLabel(typeB), 'fr');
    }
    return String(ma.name || '').localeCompare(String(mb.name || ''), 'fr') || String(a.id || '').localeCompare(String(b.id || ''), 'fr');
  });
}

function groupCompositionTrains(trains) {
  const mode = 'era';
  const groups = [];
  for (const train of sortedCompositionTrains(trains)) {
    const model = app.state.balance.trains[train.modelId] || {};
    const era = Number(model.unlockEpoch ?? model.epoch ?? 0);
    const type = trainServiceClass(model);
    const key = mode === 'type' ? type : `era-${era}`;
    let group = groups.find(item => item.key === key);
    if (!group) {
      group = mode === 'type'
        ? { key, label: trainServiceSortLabel(type), meta: 'type de composition', trains: [] }
        : { key, label: trainEraLabel(era), meta: 'ère matériel', trains: [] };
      groups.push(group);
    }
    group.trains.push(train);
  }
  return groups;
}


function compositionOwnedModelOptions(trains = app.state?.me?.trains || []) {
  const map = new Map();
  for (const train of trains || []) {
    const model = app.state?.balance?.trains?.[train.modelId] || null;
    const id = train.modelId || '';
    if (!id) continue;
    const existing = map.get(id) || { id, label: model?.name || id, count: 0 };
    existing.count += 1;
    existing.label = model?.name || existing.label;
    map.set(id, existing);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

function compositionAssignmentFilterOptions() {
  const lines = (app.state?.me?.lines || [])
    .filter(line => line.active)
    .slice()
    .sort((a, b) => linePublicName(a).localeCompare(linePublicName(b), 'fr'));
  return [
    { id: 'all', label: 'Tous les trains' },
    { id: 'construction', label: 'En fabrication' },
    { id: 'free', label: 'Trains libres' },
    ...lines.map(line => ({ id: `line:${line.id}`, label: linePublicName(line) }))
  ];
}

function compositionTrainAssignmentKey(train) {
  if (!train) return 'free';
  if (train.construction?.active) return 'construction';
  const line = trainCurrentLine(train.id);
  if (line) return `line:${line.id}`;
  return 'free';
}

function compositionFilteredTrains(trains = app.state?.me?.trains || []) {
  const modelFilter = app.compositionModelFilter || 'all';
  const assignmentFilter = app.compositionAssignmentFilter || 'all';
  return (trains || []).filter(train => {
    if (modelFilter !== 'all' && train.modelId !== modelFilter) return false;
    if (assignmentFilter !== 'all' && compositionTrainAssignmentKey(train) !== assignmentFilter) return false;
    return true;
  });
}

function compositionFilteredTrainIds() {
  return compositionFilteredTrains().map(train => train.id).filter(Boolean);
}

function compositionSelectionSaleSummary(selectedIds = compositionSelectedIds()) {
  const selected = new Set(selectedIds);
  const trains = (app.state?.me?.trains || []).filter(train => selected.has(train.id));
  const unavailable = trains.filter(train => train.construction?.active || train.maintenance?.active || trainCurrentLine(train.id));
  const estimatedValue = trains.reduce((total, train) => {
    const model = app.state.balance.trains[train.modelId];
    return total + (model ? trainResaleEstimateClient(train, model) : 0);
  }, 0);
  return { trains, unavailable, estimatedValue };
}

function setCompositionModelFilter(value) {
  const allowed = new Set(['all', ...compositionOwnedModelOptions().map(option => option.id)]);
  app.compositionModelFilter = allowed.has(value) ? value : 'all';
  localStorage.setItem('sillons.compositionModelFilter', app.compositionModelFilter);
}

function setCompositionAssignmentFilter(value) {
  const allowed = new Set(compositionAssignmentFilterOptions().map(option => option.id));
  app.compositionAssignmentFilter = allowed.has(value) ? value : 'all';
  localStorage.setItem('sillons.compositionAssignmentFilter', app.compositionAssignmentFilter);
}

function assignableLinesForTrain(train, currentLine = null) {
  if (!train || train.construction?.active || train.maintenance?.active) return [];
  const model = app.state.balance.trains[train.modelId];
  const profile = previewOperatingProfile(train, model);
  const currentLineId = currentLine?.id || '';
  return (app.state.me?.lines || [])
    .filter(line => line.active && line.id !== currentLineId && !lineHasTrain(line, train.id) && !lineAssignedTrainsClient(line).some(t => t.id === train.id))
    .filter(line => lineServiceCompatibleWithProfileClient(line.service || 'passengers', profile))
    .filter(line => lineDistance(line) <= Number(profile.range || 0))
    .sort((a, b) => linePublicName(a).localeCompare(linePublicName(b), 'fr'));
}

function lineServiceCompatibleWithProfileClient(service, profile) {
  if (service === 'freight') return Number(profile?.freight || 0) > 0;
  if (service === 'mixed') return Number(profile?.capacity || 0) > 0 && Number(profile?.freight || 0) > 0;
  return Number(profile?.capacity || 0) > 0;
}

function lineAvailableSillonsClient(line) {
  const sillons = line?.stats?.capacity?.sillons || line?.stats?.staffing?.sillons || null;
  if (!sillons) return null;
  const max = Number(sillons.maxFrequency ?? sillons.bottleneck?.available ?? sillons.lineCapacity ?? 0);
  const requested = Math.max(0, Math.floor(Number(sillons.requestedFrequency ?? lineSlotDemandClient(line))));
  const maxForLine = Math.max(0, Math.floor(max));
  const available = Math.max(0, maxForLine - requested);
  return { available, requested, maxForLine, capacity: Math.max(0, Math.floor(Number(sillons.lineCapacity ?? max))) };
}

function slotPurchaseCostClient(line, count = 1) {
  const distance = Math.max(1, lineDistance(line));
  const stops = Math.max(2, lineStopsOf(line).length);
  return Math.round(Math.max(2500, distance * 780 + stops * 240) * Math.max(1, Number(count || 1)));
}


function renderCompositionTrainFallbackCard(train, reason = '') {
  const trainId = escapeAttr(train?.id || '');
  const modelId = escapeHtml(train?.modelId || 'matériel inconnu');
  const detail = reason ? ` · ${escapeHtml(reason)}` : '';
  return `
    <article class="composition-train-vignette composition-train-vignette-error" data-composition-select-card data-id="${trainId}" role="button" tabindex="0">
      <div class="composition-vignette-main">
        <div class="composition-vignette-media"><div class="train-art train-art-placeholder"><span>Matériel</span><b>Erreur</b></div></div>
        <div class="composition-vignette-body">
          <div class="composition-vignette-title">
            <strong>${modelId}</strong>
            <span>Composition indisponible${detail}</span>
          </div>
          <span class="small muted">Cette vignette est neutralisée pour ne pas bloquer tout le menu Compositions.</span>
        </div>
      </div>
    </article>`;
}

function safeTrainProfileForComposition(train, model) {
  try {
    return previewOperatingProfile(train, model);
  } catch (error) {
    console.warn('Profil de composition indisponible', train?.id, train?.modelId, error);
    return trainRuntimeProfile(train, model);
  }
}

function safeAssignableLinesForTrain(train, currentLine = null) {
  try {
    return assignableLinesForTrain(train, currentLine);
  } catch (error) {
    console.warn('Lignes compatibles indisponibles pour le train', train?.id, train?.modelId, error);
    return [];
  }
}

function safeCompositionSummary(train, model = null) {
  try {
    return deriveCompositionSummary(train);
  } catch (error) {
    console.warn('Résumé de composition indisponible', train?.id, train?.modelId, error);
    const spec = model ? buildClientCompositionSpec(model, compositionDefaultModeForModelClient(model)) : null;
    if (spec?.mode === 'multiple_unit') return `${spec.powerUnits?.default || 1} rame en UM`;
    if (spec?.mode === 'freight_loco') return `${spec.freightCars?.default || 0} wagon(s)`;
    if (spec?.mode === 'passenger_loco') return `${spec.passengerCars?.default || 0} voiture(s)`;
    return 'Composition à vérifier';
  }
}

function renderCompositionTrainVignette(train, selectedTrainIds = new Set(compositionSelectedIds())) {
  const model = app.state.balance.trains[train.modelId];
  if (!model) return renderCompositionTrainFallbackCard(train, 'modèle absent du référentiel');
  const profile = safeTrainProfileForComposition(train, model);
  const active = app.compositionEditorTrainId === train.id;
  const selected = selectedTrainIds.has(train.id);
  const line = trainCurrentLine(train.id);
  const inConstruction = !!train.construction?.active;
  const inMaint = !!train.maintenance?.active;
  const canSell = !line && !inConstruction && !inMaint;
  const assignable = safeAssignableLinesForTrain(train, line);
  const hasAssignmentAction = !!line || (assignable.length > 0 && !inConstruction && !inMaint);
  const statusLabel = line ? linePublicName(line) : inConstruction ? 'En fabrication' : inMaint ? 'En maintenance' : 'Libre';
  const assignButtonLabel = line ? 'Appliquer' : 'Affecter';
  const sellEstimate = trainResaleEstimateClient(train, model);
  const era = trainEraLabel(Number(model.unlockEpoch ?? model.epoch ?? 0));
  const serviceLabel = trainServiceSortLabel(trainServiceClass(model));
  return `
    <article class="composition-train-vignette ${active ? 'active' : ''} ${selected ? 'selected' : ''}" data-composition-select-card data-id="${escapeAttr(train.id)}" role="button" tabindex="0" aria-pressed="${selected ? 'true' : 'false'}" title="Cliquer dans une zone libre pour ${selected ? 'retirer ce train de la sélection' : 'sélectionner ce train'}">
      <div class="composition-vignette-select-row">
        <span class="tag composition-status-tag" title="${escapeAttr(statusLabel)}">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="composition-vignette-main" aria-hidden="true">
        <div class="composition-vignette-media">
          ${renderTrainArt(model)}
        </div>
        <div class="composition-vignette-body">
          <div class="composition-vignette-title">
            <strong>${escapeHtml(model.name)}</strong>
            <span>${escapeHtml(era)} · ${escapeHtml(serviceLabel)}</span>
          </div>
          <span class="small muted">${escapeHtml(safeCompositionSummary(train, model))}</span>
          <div class="composition-mini-stats">
            <b>${formatInt(profile.capacity)} voy.</b>
            <b>${formatInt(profile.freight)} t</b>
            <b>${formatInt(profile.speed)} km/h</b>
            <b>${formatInt(profile.range)} km</b>
          </div>
        </div>
      </div>
      <div class="composition-assign-row">
        <select class="composition-assign-select" data-assign-line-select="${escapeAttr(train.id)}" ${hasAssignmentAction ? '' : 'disabled'}>
          <option value="">${line ? 'Changer / retirer...' : inConstruction ? 'En fabrication' : inMaint ? 'En maintenance' : assignable.length ? 'Affecter à une ligne...' : 'Aucune ligne compatible'}</option>
          ${line ? `<option value="__remove__">Retirer de la ligne actuelle</option>` : ''}
          ${assignable.map(candidate => {
            const slots = lineAvailableSillonsClient(candidate);
            const label = slots ? `${linePublicName(candidate)} · ${slots.available} sillons dispo` : linePublicName(candidate);
            return `<option value="${escapeAttr(candidate.id)}">${escapeHtml(label)}</option>`;
          }).join('')}
        </select>
        <button type="button" class="ghost" data-action="assign-train-line" data-id="${escapeAttr(train.id)}" ${hasAssignmentAction ? '' : 'disabled'}>${escapeHtml(assignButtonLabel)}</button>
      </div>
      <div class="composition-train-actions">
        <button type="button" class="ghost" data-action="duplicate-train" data-id="${escapeAttr(train.id)}" ${inConstruction || inMaint ? 'disabled' : ''} ${tooltipAttr(inConstruction ? 'Impossible : train encore en fabrication.' : inMaint ? 'Impossible : train en maintenance.' : `Duplique ce matériel avec la même composition. Coût : ${money(Math.round((model?.price || 0) * 0.98))}.`)}>Dupliquer</button>
        <button type="button" class="danger ghost composition-sell-train-btn" data-action="sell-train" data-id="${escapeAttr(train.id)}" ${canSell ? '' : 'disabled'} ${tooltipAttr(canSell ? `Vendre ce train inutilisé. Estimation : ${money(sellEstimate)}.` : line ? 'Impossible : train affecté à une ligne active.' : inConstruction ? 'Impossible : train en fabrication.' : 'Impossible : train en maintenance.')}>Vendre</button>
      </div>
    </article>
  `;
}

function renderCompositionTrainGroup(group, selectedTrainIds = new Set(compositionSelectedIds())) {
  const mode = 'era';
  const collapsed = isCompositionGroupCollapsed(mode, group.key);
  const selectedCount = group.trains.reduce((count, train) => count + (selectedTrainIds.has(train.id) ? 1 : 0), 0);
  return `
    <section class="composition-train-group ${collapsed ? 'collapsed' : ''}">
      <button type="button" class="research-era-heading composition-group-heading" data-action="toggle-composition-group" data-mode="${escapeAttr(mode)}" data-key="${escapeAttr(group.key)}" aria-expanded="${collapsed ? 'false' : 'true'}">
        <span class="research-era-title">
          <span class="research-era-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
          <span>${escapeHtml(group.label)}</span>
        </span>
        <span class="research-era-meta">${group.trains.length} train${group.trains.length > 1 ? 's' : ''}${selectedCount ? ` · ${selectedCount} sélectionné${selectedCount > 1 ? 's' : ''}` : ''} · ${collapsed ? 'Déplier' : 'Réduire'}</span>
      </button>
      ${collapsed ? '' : `<div class="composition-vignette-grid">${group.trains.map(train => {
        try { return renderCompositionTrainVignette(train, selectedTrainIds); }
        catch (error) {
          console.warn('Vignette de composition ignorée', train?.id, train?.modelId, error);
          return renderCompositionTrainFallbackCard(train, error?.message || 'erreur de rendu');
        }
      }).join('')}</div>`}
    </section>
  `;
}

function renderCompositionFilterToolbar(displayedTrains) {
  const modelOptions = compositionOwnedModelOptions();
  const assignmentOptions = compositionAssignmentFilterOptions();
  const modelFilter = modelOptions.some(option => option.id === app.compositionModelFilter) ? app.compositionModelFilter : 'all';
  const assignmentFilter = assignmentOptions.some(option => option.id === app.compositionAssignmentFilter) ? app.compositionAssignmentFilter : 'all';
  const visibleCount = displayedTrains.length;
  return `
    <div class="composition-filter-toolbar">
      <label>
        <span>Modèle affiché</span>
        <select data-composition-filter="model">
          <option value="all" ${modelFilter === 'all' ? 'selected' : ''}>Tous les modèles possédés</option>
          ${modelOptions.map(option => `<option value="${escapeAttr(option.id)}" ${modelFilter === option.id ? 'selected' : ''}>${escapeHtml(option.label)} · ${option.count}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>Affectation</span>
        <select data-composition-filter="assignment">
          ${assignmentOptions.map(option => `<option value="${escapeAttr(option.id)}" ${assignmentFilter === option.id ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
        </select>
      </label>
      <span class="tag">${visibleCount} affiché${visibleCount > 1 ? 's' : ''}</span>
    </div>
  `;
}

function renderCompositionSelectionToolbar(selectedIds, displayedTrains) {
  const selectedCount = selectedIds.length;
  const visibleIds = (displayedTrains || []).map(train => train.id).filter(Boolean);
  const visibleCount = visibleIds.length;
  const allVisibleSelected = visibleCount > 0 && visibleIds.every(id => selectedIds.includes(id));
  const sale = compositionSelectionSaleSummary(selectedIds);
  const saleBlocked = sale.unavailable.length > 0;
  const editBlocked = sale.trains.some(train => train.construction?.active);
  const saleTooltip = saleBlocked
    ? `Vente impossible : ${sale.unavailable.length} train${sale.unavailable.length > 1 ? 's sont' : ' est'} en fabrication, en maintenance ou affecté à une ligne active.`
    : `Vendre les ${selectedCount} trains sélectionnés. Valeur estimée : ${money(sale.estimatedValue)}.`;
  const editTooltip = editBlocked ? 'Composition indisponible tant qu’un train sélectionné est en fabrication.' : 'Modifier la composition des trains sélectionnés.';
  const hint = selectedCount
    ? 'Sélection faite. Clique sur Modifier pour ouvrir l’atelier d’édition de la composition.'
    : 'Clique sur une zone libre d’une vignette pour sélectionner un ou plusieurs trains.';
  return `
    <div class="composition-list-toolbar composition-refit-toolbar">
      ${renderCompositionFilterToolbar(displayedTrains || [])}
      <div class="composition-selection-hint small muted">${escapeHtml(hint)}</div>
      <div class="composition-selection-actions">
        <span class="tag ${selectedCount ? 'good' : ''}">${selectedCount} sélectionné${selectedCount > 1 ? 's' : ''}</span>
        <button type="button" class="ghost" data-action="select-visible-composition-trains" ${allVisibleSelected || !visibleCount ? 'disabled' : ''}>Tout sélectionner affiché</button>
        <button type="button" class="primary" data-action="edit-composition-selection" ${tooltipAttr(editTooltip)} ${selectedCount && !editBlocked ? '' : 'disabled'}>Modifier</button>
        <button type="button" class="ghost" data-action="clear-composition-selection" ${selectedCount ? '' : 'disabled'}>Vider</button>
        ${selectedCount > 1 ? `<button type="button" class="danger ghost" data-action="sell-composition-selection" ${tooltipAttr(saleTooltip)} ${saleBlocked ? 'disabled' : ''}>Tout vendre</button>` : ''}
      </div>
    </div>
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
    label = '+1 rame en UM';
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
  if (!model) return `<p class="muted">Modèle introuvable pour ce train : ${escapeHtml(train.modelId || 'inconnu')}.</p>`;
  const targetIds = compositionEditTargetIds(train.id);
  const targetCount = Math.max(1, targetIds.length);
  const spec = trainCompositionSpec(train, model);
  let detailBundle;
  try {
    detailBundle = computeOperatingProfileDetailed(train, model);
  } catch (error) {
    console.warn('Détail de composition indisponible', train?.id, train?.modelId, error);
    detailBundle = { profile: trainRuntimeProfile(train, model), metrics: {} };
  }
  const profile = detailBundle.profile || trainRuntimeProfile(train, model);
  const metricDetails = detailBundle.metrics || {};
  for (const key of ['capacity', 'freight', 'speed', 'range', 'reliability', 'comfort', 'energy', 'maintenance']) {
    if (!metricDetails[key]) metricDetails[key] = { key, label: key, description: '', base: Number(model?.[key] || 0), final: Number(profile?.[key] || 0), steps: [] };
  }
  const composition = train.composition || {};
  const line = trainCurrentLine(train.id);
  const variant = selectedCompositionVariant(train, model);
  let quantityControl = '';
  let variantPanel = '';

  if (spec.mode === 'multiple_unit') {
    quantityControl = `
      <div class="composition-control-box">
        <div class="composition-control-head">
          <strong>Nombre de rames en unité multiple</strong>
          <span class="small muted">Ajoute une rame complète : coût identique au matériel de base, voyageurs uniquement.</span>
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
      <div class="fleet-card-heading composition-editor-heading">
        <div>
          <h2>Atelier de composition</h2>
          <p class="muted small">Ajuste la longueur utile du train et sélectionne les voitures / wagons spécialisés. En sélection multiple, l’enregistrement applique le réglage aux trains compatibles.</p>
        </div>
        <div class="composition-editor-heading-actions">
          <span class="tag ${targetCount > 1 ? 'good' : ''}">${targetCount > 1 ? `${targetCount} trains ciblés` : line ? `Affecté à ${escapeHtml(linePublicName(line))}` : 'Train libre'}</span>
          <button type="button" class="ghost" data-action="close-composition-editor">Fermer</button>
        </div>
      </div>

      ${renderCompositionModeTabs(train, model)}

      <div class="composition-editor-top">
        <div class="composition-train-card">
          ${renderTrainArt(model)}
          <div>
            <strong>${escapeHtml(model.name)}</strong>
            <p class="small muted">${escapeHtml(safeCompositionSummary(train, model))}</p>
            <p class="small muted">Mode : ${spec.mode === 'multiple_unit' ? 'Unité multiple voyageurs' : spec.mode === 'freight_loco' ? 'Locomotive + wagons' : 'Locomotive + voitures'}</p>
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
            <button class="primary" data-action="save-train-composition" data-id="${train.id}">${targetCount > 1 ? `Enregistrer sur ${targetCount} trains` : 'Enregistrer la composition'}</button>
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

  const validIds = compositionValidTrainIds();
  const cleanedSelection = compositionSelectedIds();
  if (cleanedSelection.length !== (app.selectedCompositionTrainIds || []).length) setCompositionSelection(cleanedSelection, app.selectedCompositionTrainId);
  if (app.selectedCompositionTrainId && !validIds.has(app.selectedCompositionTrainId)) {
    app.selectedCompositionTrainId = '';
    localStorage.removeItem('sillons.selectedCompositionTrainId');
  }
  setCompositionModelFilter(app.compositionModelFilter || 'all');
  setCompositionAssignmentFilter(app.compositionAssignmentFilter || 'all');
  if (app.compositionEditorTrainId && !validIds.has(app.compositionEditorTrainId)) setCompositionEditorTrain('');
  if (app.compositionEditorTrainId && cleanedSelection.length && !cleanedSelection.includes(app.compositionEditorTrainId)) setCompositionEditorTrain(cleanedSelection[0] || '');
  if (app.compositionEditorTrainId && !cleanedSelection.length) setCompositionEditorTrain('');
  const selected = me.trains.find(t => t.id === app.compositionEditorTrainId) || null;
  const displayedTrains = compositionFilteredTrains(me.trains);
  const groups = groupCompositionTrains(displayedTrains);
  const selectedTrainIds = new Set(cleanedSelection);
  const deliveredTrains = me.trains.filter(t => !t.construction?.active);
  const configurable = deliveredTrains.filter(t => !!t.compositionSpec).length;
  const avgSeats = deliveredTrains.length ? Math.round(deliveredTrains.reduce((sum, t) => sum + trainRuntimeProfile(t).capacity, 0) / deliveredTrains.length) : 0;

  return `
    <div class="fleet-composition-layout composition-refit-layout ${selected ? 'has-editor' : 'no-editor'}">
      <div class="card fleet-kpi-card composition-kpi-card">
        ${metric('Trains configurables', configurable)}
        ${metric('Capacité moyenne', `${avgSeats} voy.`)}
        ${metric('Sélection multiple', `${cleanedSelection.length} train${cleanedSelection.length > 1 ? 's' : ''}`)}
        ${metric('Lignes actives', me.lines.filter(l => l.active).length)}
      </div>

      <div class="card composition-list-card composition-refit-list-card">
        <div class="fleet-card-heading">
          <div>
            <h2>Trains de la compagnie</h2>
            <p class="muted small">Sélectionne un ou plusieurs matériels, puis clique sur Modifier pour ouvrir l’atelier de composition.</p>
          </div>
          <span class="tag">${displayedTrains.length}/${me.trains.length} unité(s)</span>
        </div>
        ${renderCompositionSelectionToolbar(cleanedSelection, displayedTrains)}
        <div class="composition-train-list composition-group-list">
          ${groups.length ? groups.map(group => renderCompositionTrainGroup(group, selectedTrainIds)).join('') : '<p class="muted composition-empty-filter">Aucun train ne correspond aux filtres sélectionnés.</p>'}
        </div>
      </div>

      ${selected ? `<div class="card composition-editor-card composition-refit-editor">${(() => {
        try { return renderCompositionEditor(selected); }
        catch (error) {
          console.warn('Éditeur de composition indisponible', selected?.id, selected?.modelId, error);
          return `<p class="muted">Impossible d’ouvrir l’éditeur pour ce train. La liste reste accessible.</p>`;
        }
      })()}</div>` : ''}
    </div>
  `;
}


function renderFleet() {
  const me = app.state.me;
  const active = ['catalog', 'maintenance', 'composition'].includes(app.activeFleetSubtab) ? app.activeFleetSubtab : 'catalog';
  const models = Object.values(app.state.balance.trains);
  const available = models.filter(t => trainModelUnlocked(t));
  const locked = models.filter(t => !trainModelUnlocked(t));
  const inConstruction = me.trains.filter(t => t.construction?.active).length;
  const inWorkshop = me.trains.filter(t => t.maintenance?.active).length;
  const avgCondition = me.trains.length ? Math.round(me.trains.reduce((sum, t) => sum + Number(t.condition || 0), 0) / me.trains.length * 100) : 0;
  const heroTitle = active === 'catalog' ? 'Catalogue du matériel roulant' : active === 'maintenance' ? 'Maintenance du matériel' : 'Atelier de compositions';
  const heroText = active === 'catalog'
    ? 'Achète du matériel adapté à tes lignes : Capacité, vitesse, énergie, confort, fret ou fiabilité.'
    : active === 'maintenance'
      ? 'Choisis une politique d’entretien et planifie les interventions pour éviter l’usure excessive du parc.'
      : 'Allonge ou raccourcis les trains pour ajuster la capacité : voitures voyageurs, wagons fret ou rames en unité multiple.';

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
          <b>${inWorkshop} en maintenance · ${inConstruction} en fabrication</b>
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


function fleetCatalogEraStorageKey(epoch) {
  return `epoch::${Math.max(0, Number(epoch || 0))}`;
}

function isFleetCatalogEraCollapsed(epoch) {
  return Boolean(app.fleetCatalogEraCollapsed?.[fleetCatalogEraStorageKey(epoch)]);
}

function setFleetCatalogEraCollapsed(epoch, collapsed) {
  const key = fleetCatalogEraStorageKey(epoch);
  app.fleetCatalogEraCollapsed = { ...(app.fleetCatalogEraCollapsed || {}), [key]: Boolean(collapsed) };
  if (!collapsed) delete app.fleetCatalogEraCollapsed[key];
  localStorage.setItem('sillons.fleetCatalogEraCollapsed', JSON.stringify(app.fleetCatalogEraCollapsed));
}


function fleetMaintenanceEraStorageKey(epoch) {
  return `epoch::${Math.max(0, Number(epoch || 0))}`;
}

function isFleetMaintenanceEraCollapsed(epoch) {
  return Boolean(app.fleetMaintenanceEraCollapsed?.[fleetMaintenanceEraStorageKey(epoch)]);
}

function setFleetMaintenanceEraCollapsed(epoch, collapsed) {
  const key = fleetMaintenanceEraStorageKey(epoch);
  app.fleetMaintenanceEraCollapsed = { ...(app.fleetMaintenanceEraCollapsed || {}), [key]: Boolean(collapsed) };
  if (!collapsed) delete app.fleetMaintenanceEraCollapsed[key];
  localStorage.setItem('sillons.fleetMaintenanceEraCollapsed', JSON.stringify(app.fleetMaintenanceEraCollapsed));
}

function constructionTrainSort(a, b) {
  const am = app.state.balance.trains[a.modelId] || {};
  const bm = app.state.balance.trains[b.modelId] || {};
  const ar = Number(a.construction?.remainingMs ?? a.construction?.durationMs ?? 0);
  const br = Number(b.construction?.remainingMs ?? b.construction?.durationMs ?? 0);
  return ar - br || String(am.name || '').localeCompare(String(bm.name || ''), 'fr') || String(a.id).localeCompare(String(b.id));
}

function trainConstructionCardTitle(train, model) {
  const suffix = String(train?.id || '').slice(0, 4).toUpperCase();
  return `${model?.name || 'Train'}${suffix ? ` #${suffix}` : ''}`;
}

function renderFleetConstructionQueue() {
  const trains = (app.state.me?.trains || []).filter(train => train.construction?.active).sort(constructionTrainSort);
  if (!trains.length) return '';
  return `
    <div class="card fleet-construction-card">
      <div class="fleet-card-heading">
        <div>
          <h2>Fabrications en cours</h2>
          <p class="muted small">Suivi des commandes lancées. Chaque train est livré automatiquement à la fin de ses essais.</p>
        </div>
        <span class="tag warn">${trains.length} chantier${trains.length > 1 ? 's' : ''}</span>
      </div>
      <div class="train-card-grid fleet-construction-grid">
        ${trains.map(train => {
          const model = app.state.balance.trains[train.modelId] || {};
          return `
            <article class="list-item train-catalog-card construction-train-card" data-train-id="${escapeAttr(train.id)}">
              ${renderTrainArt(model)}
              <div class="train-card-body">
                <div class="item-title">
                  <strong>${escapeHtml(trainConstructionCardTitle(train, model))}</strong>
                  <span class="tag warn">En fabrication</span>
                </div>
                <p class="small muted construction-train-description">${escapeHtml(model.description || trainStrengths(model))}</p>
                <div class="construction-train-progress">
                  ${renderTrainConstructionPanel(train, model)}
                </div>
                <div class="actions construction-train-actions">
                  <button class="danger" data-action="cancel-train-construction" data-id="${escapeAttr(train.id)}">Annuler la construction</button>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderFleetCatalogPanel(available, locked) {
  const me = app.state.me;
  const models = Object.values(app.state.balance.trains);
  const byEpoch = {};
  for (const model of models) (byEpoch[model.unlockEpoch] ||= []).push(model);
  const eraEntries = Object.entries(byEpoch).sort((a, b) => Number(a[0]) - Number(b[0]));

  return `
    <div class="fleet-catalog-layout">
      <div class="card fleet-kpi-card">
        ${metric('Budget achat', money(me.cash))}
        ${metric('Matériels achetables', available.length)}
        ${metric('Matériels verrouillés', locked.length)}
        ${metric('Époque actuelle', me.eraName)}
      </div>

      ${renderFleetConstructionQueue()}

      <div class="card rolling-stock-catalog fleet-catalog-card">
        <div class="fleet-card-heading">
          <div>
            <h2>Catalogue de matériel roulant</h2>
            <p class="muted small">Les cartes sont classées par époque. Utilise-les comme choix de stratégie : Économique, grande capacité, Fret, Vitesse, Confort ou Énergie propre.</p>
          </div>
          <span class="tag">${models.length} modèles</span>
        </div>

        <div class="era-catalog">
          ${eraEntries.map(([epoch, list]) => {
            const collapsed = isFleetCatalogEraCollapsed(epoch);
            return `
              <section class="era-block fleet-era-block ${collapsed ? 'collapsed' : ''}">
                <button type="button" class="era-title fleet-era-toggle" data-action="toggle-fleet-catalog-era" data-epoch="${escapeAttr(String(epoch))}" aria-expanded="${collapsed ? 'false' : 'true'}">
                  <span class="research-era-title">
                    <span class="research-era-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
                    <strong>${escapeHtml(trainEraLabel(Number(epoch)))}</strong>
                  </span>
                  <span class="research-era-meta">${list.length} matériels · ${collapsed ? 'Déplier' : 'Masquer'}</span>
                </button>
                ${collapsed ? '' : `
                  <div class="train-card-grid fleet-catalog-grid">
                    ${list.sort((a, b) => a.price - b.price).map(model => renderTrainCatalogItem(model, trainModelUnlocked(model))).join('')}
                  </div>
                `}
              </section>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderFleetMaintenancePanel(avgCondition, inWorkshop) {
  const me = app.state.me;
  const constructing = me.trains.filter(t => t.construction?.active).length;
  const maintenanceTrains = (me.trains || []).filter(t => !t.construction?.active);
  const free = maintenanceTrains.filter(t => !t.maintenance?.active && !me.lines.some(l => l.active && lineHasTrain(l, t.id))).length;
  const assigned = maintenanceTrains.filter(t => me.lines.some(l => l.active && lineHasTrain(l, t.id))).length;
  const mapSelectedTrainId = typeof selectedOwnedMapTrainId === 'function' ? selectedOwnedMapTrainId() : '';
  const standardAction = app.state.balance.maintenanceActions?.standard || null;
  const bulkLocked = standardAction ? maintenanceActionLockedReason(standardAction) : '';
  const trainsByEpoch = {};
  for (const train of maintenanceTrains) {
    const model = app.state.balance.trains[train.modelId] || {};
    const epoch = Number(model.unlockEpoch ?? model.epoch ?? 0);
    (trainsByEpoch[epoch] ||= []).push(train);
  }
  const eraEntries = Object.entries(trainsByEpoch).sort((a, b) => Number(a[0]) - Number(b[0]));

  return `
    <div class="fleet-maintenance-layout">
      <div class="card fleet-kpi-card">
        ${metric('État moyen', `${avgCondition}%`, avgCondition >= 70 ? 'good-text' : avgCondition >= 45 ? '' : 'bad-text')}
        ${metric('En fabrication', constructing)}
        ${metric('En maintenance', inWorkshop)}
        ${metric('Affectés', assigned)}
        ${metric('Libres', free)}
      </div>

      ${renderMaintenanceFacilitiesCard()}

      ${renderMaintenancePolicyCard()}

      <div class="card fleet-bulk-maintenance-card">
        <div class="fleet-card-heading">
          <div>
            <h2>Maintenance globale</h2>
            <p class="muted small">Envoie en une seule action tous les trains éligibles en maintenance intermédiaire. La durée dépend de l’état restant de chaque train et du niveau d’atelier.</p>
          </div>
          <button class="danger confirm-danger" data-action="repair-all-trains" data-mode="standard" ${tooltipAttr(bulkLocked || 'Lance une maintenance intermédiaire sur tous les trains éligibles.')} ${maintenanceTrains.length && !bulkLocked ? '' : 'disabled'}>Tout envoyer en maintenance</button>
        </div>
      </div>

      <div class="card fleet-owned-card">
        <div class="fleet-card-heading">
          <div>
            <h2>Parc de la compagnie</h2>
            <p class="muted small">Lance les interventions depuis les cartes de matériel. Un train usé perd en vitesse et en ponctualité. À 0 %, il est immobilisé et sa ligne ne produit plus rien.</p>
          </div>
          <span class="tag">${maintenanceTrains.length} unité(s)</span>
        </div>
        <div class="era-catalog fleet-maintenance-era-list">
          ${eraEntries.length ? eraEntries.map(([epoch, trains]) => {
            const selectedInEra = mapSelectedTrainId && trains.some(t => String(t.id) === mapSelectedTrainId);
            const collapsed = !selectedInEra && isFleetMaintenanceEraCollapsed(epoch);
            const sorted = trains.sort((a, b) => {
              const ma = app.state.balance.trains[a.modelId] || {};
              const mb = app.state.balance.trains[b.modelId] || {};
              return String(ma.name || '').localeCompare(String(mb.name || ''), 'fr') || String(a.id).localeCompare(String(b.id));
            });
            return `
              <section class="era-block fleet-era-block ${collapsed ? 'collapsed' : ''}">
                <button type="button" class="era-title fleet-era-toggle" data-action="toggle-fleet-maintenance-era" data-epoch="${escapeAttr(String(epoch))}" aria-expanded="${collapsed ? 'false' : 'true'}">
                  <span class="research-era-title">
                    <span class="research-era-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
                    <strong>${escapeHtml(trainEraLabel(Number(epoch)))}</strong>
                  </span>
                  <span class="research-era-meta">${sorted.length} train${sorted.length > 1 ? 's' : ''} · ${collapsed ? 'Déplier' : 'Masquer'}</span>
                </button>
                ${collapsed ? '' : `
                  <div class="train-card-grid fleet-catalog-grid fleet-maintenance-grid">
                    ${sorted.map(t => renderOwnedTrain(t)).join('')}
                  </div>
                `}
              </section>
            `;
          }).join('') : '<p class="muted">Aucun matériel.</p>'}
        </div>
      </div>
    </div>
  `;
}

function renderMaintenanceFacilitiesCard() {
  const facilities = Object.values(app.state.balance.maintenanceFacilities || {});
  const cash = Number(app.state.me.cash || 0);
  return `
    <div class="card fleet-maintenance-facilities-card">
      <div class="fleet-card-heading">
        <div>
          <h2>Bâtiments de maintenance</h2>
          <p class="muted small">Les niveaux sont illimités. Chaque niveau coûte plus cher et réduit la durée d’indisponibilité des trains pour le type d’intervention associé.</p>
        </div>
        <span class="tag">${facilities.length} filières</span>
      </div>
      <div class="maintenance-policy-grid maintenance-facility-grid">
        ${facilities.map(facility => renderMaintenanceFacility(facility, cash)).join('')}
      </div>
    </div>
  `;
}

function renderFacilityConstructionPanel(facility, construction) {
  const key = `facility:${facility.id}:${construction.targetLevel}:${construction.startedAt || 0}:${construction.durationMs || 0}`;
  return `
    <div class="facility-construction-panel">
      <div class="facility-construction-head">
        <div>
          <span>Chantier niveau ${formatInt(construction.targetLevel)}</span>
          <b>${construction.percent}%</b>
        </div>
        <strong class="research-clock" data-construction-timer data-end-at="${Math.round(construction.endAt || 0)}">${formatResearchTime(construction.remainingMs)}</strong>
      </div>
      <div class="progress research-progress facility-construction-progress"><i data-construction-progress data-construction-key="${escapeAttr(key)}" data-end-at="${Math.round(construction.endAt || 0)}" data-duration-ms="${Math.round(construction.durationMs || 1)}" data-last-progress="${construction.percent}" style="width:${construction.percent}%"></i></div>
      <div class="facility-construction-meta">
        <span>Durée totale : ${escapeHtml(formatResearchTime(construction.durationMs))}</span>
        <span>Activation automatique à la fin</span>
      </div>
    </div>
  `;
}

function renderMaintenanceFacility(facility, cash) {
  const level = maintenanceFacilityLevelClient(facility.id);
  const nextCost = maintenanceFacilityUpgradeCostClient(facility.id);
  const nextDuration = maintenanceFacilityConstructionDurationMsClient(facility.id);
  const construction = maintenanceFacilityConstructionClient(facility.id);
  const currentReduction = Math.round((1 - maintenanceFacilityDurationMultiplierClient(facility.id)) * 100);
  const nextReduction = Math.round((1 - Math.max(0.18, 1 - Math.min(Number(facility.maxDurationReduction || 0), (level + 1) * Number(facility.durationReductionPerLevel || 0)))) * 100);
  const locked = facility.requiredTech && !hasTech(facility.requiredTech)
    ? `Recherche : ${techNodeTitle(facility.requiredTech)}`
    : '';
  const disabled = locked || construction.active || cash < nextCost;
  const tooltip = construction.active
    ? `${facility.name} niveau ${construction.targetLevel} en construction. Fin prévue : ${formatResearchTime(construction.remainingMs)}.`
    : locked
      ? `${facility.name}. ${locked}.`
      : `${facility.name}. ${facility.description} Niveau actuel ${level}, réduction actuelle ${currentReduction}%, prochain niveau ${nextReduction}%. Coût : ${money(nextCost)}. Durée : ${formatResearchTime(nextDuration)}.`;
  return `
    <article class="maintenance-policy-card maintenance-facility-card ${level > 0 ? 'active' : ''}">
      <div class="policy-head">
        <strong>${escapeHtml(facility.name)}</strong>
        <span class="tag ${level > 0 ? 'good' : 'warn'}">Niv. ${formatInt(level)}</span>
      </div>
      <p class="small muted">${escapeHtml(facility.description)}</p>
      <div class="policy-stats">
        <div><span>Usage</span><b>${escapeHtml(facility.actionLabel || 'Maintenance')}</b></div>
        <div><span>Réduction</span><b>${currentReduction}%</b></div>
        <div><span>Niv. suivant</span><b>${nextReduction}%</b></div>
        <div><span>Construction</span><b>${construction.active ? formatResearchTime(construction.remainingMs) : formatResearchTime(nextDuration)}</b></div>
      </div>
      ${locked ? `<em class="small bad-text">${escapeHtml(locked)}</em>` : ''}
      ${construction.active ? renderFacilityConstructionPanel(facility, construction) : ''}
      <button data-action="buy-maintenance-facility" data-facility="${escapeAttr(facility.id)}" ${tooltipAttr(tooltip)} ${disabled ? 'disabled' : ''}>
        ${construction.active ? `Niveau ${formatInt(construction.targetLevel)} en chantier` : `Construire niveau ${formatInt(level + 1)}`}
        <span>${construction.active ? formatResearchTime(construction.remainingMs) : `${money(nextCost)} · ${formatResearchTime(nextDuration)}`}</span>
      </button>
    </article>
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
  const regex = /([+-])\s*(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+)?(portee|autonomie|vitesse(?: max)?|fiabilite|confort|cout de maintenance\/h|cout maintenance\/h|consommation|impact environnemental|rentabilite)/g;
  const effects = [];
  let match;
  while ((match = regex.exec(text))) {
    const sign = match[1] === '-' ? -1 : 1;
    const rawValue = Number(String(match[2]).replace(',', '.')) / 100;
    const label = match[3];
    const kind = (
      label === 'vitesse max' || label === 'vitesse' ? 'speed' :
      label === 'fiabilite' ? 'reliability' :
      label === 'confort' ? 'comfort' :
      label === 'cout de maintenance/h' || label === 'cout maintenance/h' ? 'maintenance' :
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

function researchEffectAppliesToModelClient(effect, model) {
  const target = effect?.target || {};
  if (Number(target.era || 0) > 0 && Number(target.era) !== trainResearchEra(model)) return false;
  const energyTypes = Array.isArray(target.energyTypes) ? target.energyTypes.filter(Boolean) : [];
  if (energyTypes.length && !energyTypes.includes(model?.energyType)) return false;
  if (target.service === 'passenger' && Number(model?.capacity || 0) <= 0) return false;
  if (target.service === 'freight' && Number(model?.freight || 0) <= 0) return false;
  return true;
}

function nodeTrainEffectsClient(node) {
  const allowedKinds = new Set(['speed', 'range', 'autonomy', 'reliability', 'comfort', 'maintenance', 'energy', 'environment', 'profitability']);
  const structured = Array.isArray(node?.trainEffects)
    ? node.trainEffects
      .filter(effect => allowedKinds.has(effect?.kind) && Number.isFinite(Number(effect?.value)))
      .map(effect => ({ kind: effect.kind, value: Number(effect.value), target: effect.target || {} }))
    : [];
  return structured.length
    ? structured
    : (node?.improves || []).flatMap(parseResearchNumericEffectsClient);
}

function trainInheritedResearchBonus(model) {
  const modifiers = { speed: 1, range: 1, autonomy: 1, reliability: 1, comfort: 1, maintenance: 1, energy: 1, environment: 1, profitability: 1 };
  const sources = [];
  const effects = [];
  for (const node of researchNodesForEraClient(trainResearchEra(model))) {
    const level = techLevel(node.id);
    if (level <= 0) continue;
    const units = researchLevelEffectUnitsClient(level);
    const nodeEffects = [];
    for (const effect of nodeTrainEffectsClient(node)) {
      if (!researchEffectAppliesToModelClient(effect, model)) continue;
      const multiplier = Math.max(0.08, 1 + effect.value * units);
      modifiers[effect.kind] *= multiplier;
      nodeEffects.push({
        kind: effect.kind,
        rawValue: effect.value,
        units,
        multiplier,
        signedPercent: signedPercentFromMultiplier(multiplier, effect.kind === 'energy' || effect.kind === 'environment' || effect.kind === 'maintenance')
      });
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
    comfort: clamp(Number(model?.comfort || 0) * modifiers.comfort, 0.05, 1),
    maintenance: Math.max(0.01, round(Number(model?.maintenance || 0) * modifiers.maintenance)),
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
    ['Confort', modifiers.comfort, false],
    ['Coût maintenance/h', modifiers.maintenance, true],
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

  return `
    <div class="train-research-bonus-panel">
      <div class="train-research-bonus-title">Bonus recherches hérités</div>
      <div class="train-research-bonus-grid">
        ${items.map(item => `<span><small>${escapeHtml(item.label)}</small><b>${escapeHtml(item.value)}</b></span>`).join('')}
      </div>
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

function trainPurchaseUnitPriceClient(model) {
  const market = app.state?.game?.market || {};
  const steel = Number(market.steel ?? 1);
  const electricity = Number(market.electricity ?? 0.34);
  const multiplier = 1
    + Math.max(0, steel - 1) * 0.35
    + (model.energyType === 'electricity' ? Math.max(0, electricity - 0.34) * 0.1 : 0);
  return Math.round(Number(model.price || 0) * multiplier);
}

const TRAIN_CONSTRUCTION_STAGES = [
  'Commande validée',
  'Caisse et bogies',
  'Traction et énergie',
  'Aménagements',
  'Essais et réception'
];

function trainConstructionProgress(train, model = null) {
  const construction = train?.construction || {};
  const durationMs = Math.max(0, Number(construction.durationMs || (model ? trainConstructionDurationMsClient(model) : 0)));
  const remainingMs = Math.max(0, Number(construction.remainingMs ?? (construction.active ? durationMs : 0)));
  const progress = durationMs > 0 ? clamp(1 - remainingMs / durationMs, 0, 1) : (construction.active ? 0 : 1);
  return {
    active: Boolean(construction.active),
    durationMs,
    remainingMs,
    endAt: serverNow() + remainingMs,
    startedAt: construction.startedAt || 0,
    progress,
    percent: Math.round(progress * 100)
  };
}

function trainConstructionStageIndex(info) {
  const count = TRAIN_CONSTRUCTION_STAGES.length;
  if (!info?.active || info.progress >= 1) return count - 1;
  return clamp(Math.floor(info.progress * count), 0, count - 1);
}

function renderTrainConstructionPanel(train, model) {
  const info = trainConstructionProgress(train, model);
  const stageIndex = trainConstructionStageIndex(info);
  const stageLabel = TRAIN_CONSTRUCTION_STAGES[stageIndex] || 'Fabrication';
  const key = `train:${train.id || model?.id || 'train'}:${info.startedAt || 0}:${info.durationMs || 0}`;
  return `
    <div class="train-construction-panel">
      <div class="train-construction-head">
        <div>
          <span>Fabrication</span>
          <b>${escapeHtml(stageLabel)} · ${info.percent}%</b>
        </div>
        <strong class="research-clock" data-construction-timer data-end-at="${Math.round(info.endAt || 0)}">${formatResearchTime(info.remainingMs)}</strong>
      </div>
      <div class="progress research-progress train-construction-bar"><i data-construction-progress data-construction-key="${escapeAttr(key)}" data-end-at="${Math.round(info.endAt || 0)}" data-duration-ms="${Math.round(info.durationMs || 1)}" data-last-progress="${info.percent}" style="width:${info.percent}%"></i></div>
      <div class="train-construction-meta">
        <span>Durée totale : ${escapeHtml(formatResearchTime(info.durationMs))}</span>
        <span>Livraison automatique à 100%</span>
      </div>
      <div class="train-construction-steps">
        ${TRAIN_CONSTRUCTION_STAGES.map((label, index) => {
          const state = index < stageIndex ? 'done' : index === stageIndex ? 'current' : 'pending';
          return `<span class="construction-step ${state}"><i>${index + 1}</i><b>${escapeHtml(label)}</b></span>`;
        }).join('')}
      </div>
    </div>
  `;
}

function trainMaintenanceProgress(train) {
  const maint = train?.maintenance || {};
  const tickMs = Math.max(250, Number(app.state?.game?.tickMs || 2000));
  const remainingFallback = Number(maint.daysLeft || 0) * tickMs;
  const legacyDuration = Number(maint.duration || 0) * tickMs;
  const remainingMs = Math.max(0, Number(maint.remainingMs || remainingFallback || (maint.active ? maint.durationMs : 0) || 0));
  const durationMs = Math.max(remainingMs, Number(maint.durationMs || legacyDuration || remainingMs || 0));
  const progress = durationMs > 0 ? clamp(1 - remainingMs / durationMs, 0, 1) : (maint.active ? 0 : 1);
  return {
    active: Boolean(maint.active),
    label: maint.label || 'Maintenance',
    durationMs,
    remainingMs,
    endAt: serverNow() + remainingMs,
    startedAt: maint.startedAt || 0,
    targetCondition: Number(maint.targetCondition || 0),
    progress,
    percent: Math.round(progress * 100)
  };
}

function renderTrainMaintenancePanel(train) {
  const info = trainMaintenanceProgress(train);
  const key = `maintenance:${train.id || 'train'}:${info.startedAt || 0}:${info.durationMs || 0}`;
  const target = info.targetCondition > 0 ? `État cible : ${Math.round(info.targetCondition * 100)}%` : 'Retour automatique en service';
  return `
    <div class="train-maintenance-panel">
      <div class="train-maintenance-head">
        <div>
          <span>Maintenance en cours</span>
          <b>${escapeHtml(info.label)} · ${info.percent}%</b>
        </div>
        <strong class="research-clock" data-maintenance-timer data-end-at="${Math.round(info.endAt || 0)}">${formatResearchTime(info.remainingMs)}</strong>
      </div>
      <div class="progress research-progress train-maintenance-bar"><i data-maintenance-progress data-maintenance-key="${escapeAttr(key)}" data-end-at="${Math.round(info.endAt || 0)}" data-duration-ms="${Math.round(info.durationMs || 1)}" data-last-progress="${info.percent}" style="width:${info.percent}%"></i></div>
      <div class="train-maintenance-meta">
        <span>Durée totale : ${escapeHtml(formatResearchTime(info.durationMs))}</span>
        <span>${escapeHtml(target)}</span>
      </div>
    </div>
  `;
}

function parseTrainPurchaseQuantityDraft(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const quantity = Math.floor(Number(raw));
  if (!Number.isFinite(quantity)) return null;
  return clamp(quantity, 1, 99);
}

function normalizeTrainPurchaseQuantity(value) {
  return parseTrainPurchaseQuantityDraft(value) ?? 1;
}

function trainPurchaseDurationLabel(durationMs, quantity) {
  const count = Math.max(1, Math.floor(Number(quantity || 1)));
  const time = formatResearchTime(durationMs);
  return count <= 1 ? time : `${formatInt(count)} × ${time}`;
}

function updateTrainPurchaseTotal(input, options = {}) {
  if (!input) return;
  const modelId = input.dataset.buyTrainQty || '';
  const quantity = parseTrainPurchaseQuantityDraft(input.value);
  const committedQuantity = quantity ?? 1;
  if (options.commit) input.value = String(committedQuantity);
  const card = input.closest('.train-catalog-card');
  const total = card?.querySelector(`[data-buy-train-total="${CSS.escape(modelId)}"]`);
  const duration = card?.querySelector(`[data-buy-train-duration="${CSS.escape(modelId)}"]`);
  const unitPrice = Math.max(0, Math.round(Number(input.dataset.unitPrice || 0)));
  const constructionMs = Math.max(0, Math.round(Number(input.dataset.constructionMs || 0)));
  if (total) total.textContent = quantity === null ? '—' : money(unitPrice * quantity);
  if (duration) duration.textContent = quantity === null ? '—' : trainPurchaseDurationLabel(constructionMs, committedQuantity);
}


function estimateTrainPowerKw(model) {
  const speed = Math.max(0, Number(model?.speed || 0));
  const capacity = Math.max(0, Number(model?.capacity || 0));
  const freight = Math.max(0, Number(model?.freight || 0));
  const typeLabel = `${model?.name || ''} ${model?.type || ''}`.toLowerCase();
  const energyType = String(model?.energyType || '').toLowerCase();
  let multiplier = energyType === 'coal'
    ? 0.72
    : energyType === 'diesel'
      ? 0.88
      : energyType === 'battery'
        ? 0.92
        : energyType === 'hydrogen'
          ? 0.96
          : 1;
  if (/(grande vitesse|tgv|maglev)/.test(typeLabel)) multiplier *= 1.22;
  else if (/(autorail|rame|duplex|regio|régio|navette)/.test(typeLabel)) multiplier *= 1.08;
  else if (/(fret|marchand)/.test(typeLabel) && freight > capacity) multiplier *= 1.1;
  const weightedLoad = capacity * 5 + freight * 1.6 + speed * 18 + Math.max(capacity, freight * 0.25);
  return Math.max(350, Math.round((weightedLoad * multiplier) / 50) * 50);
}

function renderTrainCatalogItem(model, buyable) {
  const effective = effectiveModelWithResearchClient(model);
  const effectiveRange = effective.range;
  const reliabilityValues = trainResearchPercentValues(model.reliability, effective.reliability);
  const comfortValues = trainResearchPercentValues(model.comfort, effective.comfort);
  const baseMaintenanceHourly = maintenanceHourlyRange(model);
  const effectiveMaintenanceHourly = maintenanceHourlyRange(effective);
  const baseMaintenanceRatio = 1 - Math.min(1, Number(model.maintenance || 0) / 1.3);
  const effectiveMaintenanceRatio = 1 - Math.min(1, Number(effective.maintenance || 0) / 1.3);
  const unitPrice = trainPurchaseUnitPriceClient(model);
  const constructionMs = trainConstructionDurationMsClient(model);
  const powerKw = estimateTrainPowerKw(model);
  const multipleUnit = isMultipleUnitModelClient(model);
  const muSpec = multipleUnit ? buildClientCompositionSpec(model, 'multiple_unit') : null;
  return `
    <div class="list-item train-catalog-card ${buyable ? 'buyable' : 'locked'}">
      ${renderTrainArt(model)}
      <div class="train-card-body">
        <div class="item-title">
          <strong>${escapeHtml(model.name)}</strong>
          <span class="tag ${buyable ? 'good' : 'warn'}">${buyable ? money(unitPrice) : 'À débloquer'}</span>
        </div>
        <p class="small muted">${escapeHtml(model.description || trainStrengths(model))}</p>
        <div class="train-stat-grid">
          ${renderTrainStat('Vitesse', `${model.speed} km/h`, model.speed / 420, model.speed >= 250 ? 'good' : '', `${effective.speed} km/h`, effective.speed / 420)}
          ${renderTrainStat('Portée', `${formatInt(model.range)} km`, (model.range || 0) / 1400, effectiveRange >= 900 ? 'good' : '', `${formatInt(effectiveRange)} km`, effectiveRange / 1400)}
          ${renderTrainStat('Puissance', `${formatInt(powerKw)} kW`, powerKw / 20000, powerKw >= 8000 ? 'good' : '')}
          ${multipleUnit ? renderTrainStat('Capacité rame', `${formatInt(model.capacity)} voy.`, Math.min(1, (model.capacity || 0) / 1100), model.capacity >= 650 ? 'good' : '') : ''}
          ${multipleUnit ? renderTrainStat('UM max', `${muSpec.powerUnits.max} rame${muSpec.powerUnits.max > 1 ? 's' : ''}`, muSpec.powerUnits.max / 3, muSpec.powerUnits.max >= 3 ? 'good' : '') : ''}
          ${renderTrainStat('Fiabilité', reliabilityValues.base, model.reliability, effective.reliability >= 0.92 ? 'good' : '', reliabilityValues.modified, effective.reliability)}
          ${renderTrainStat('Confort', comfortValues.base, model.comfort, model.comfort >= 0.8 ? 'good' : '', comfortValues.modified, effective.comfort)}
          ${renderTrainStat('Fabrication', formatResearchTime(constructionMs), constructionMs / (20 * 60 * 60 * 1000), constructionMs <= 60 * 60 * 1000 ? 'good' : constructionMs >= 8 * 60 * 60 * 1000 ? 'warn' : '')}
          ${renderTrainStat('Maint./h', baseMaintenanceHourly, baseMaintenanceRatio, model.maintenance <= 0.45 ? 'good' : 'warn', effectiveMaintenanceHourly, effectiveMaintenanceRatio)}
        </div>
        ${renderTrainRequirementPills(model)}
        ${renderTrainInheritedResearchBonuses(model)}
        <div class="train-buy-control">
          <label>
            <span>Quantité</span>
            <input type="number" min="1" max="99" step="1" value="1" inputmode="numeric" data-buy-train-qty="${escapeAttr(model.id)}" data-unit-price="${unitPrice}" data-construction-ms="${constructionMs}" ${buyable ? '' : 'disabled'}>
          </label>
          <span class="train-buy-total">Total <b data-buy-train-total="${escapeAttr(model.id)}">${money(unitPrice)}</b></span>
        </div>
        <div class="actions train-buy-actions">
          <button class="primary train-buy-button" data-action="buy-train" data-id="${model.id}" data-unit-price="${unitPrice}" ${tooltipAttr(buyable ? `Lance la fabrication. Durée estimée : ${formatResearchTime(constructionMs)} par train.` : 'Prérequis manquants.')} ${buyable ? '' : 'disabled'}>Acheter</button>
          <span class="train-buy-duration" title="Durée de fabrication selon la quantité saisie.">
            <small>Fabrication</small>
            <b data-buy-train-duration="${escapeAttr(model.id)}">${trainPurchaseDurationLabel(constructionMs, 1)}</b>
          </span>
        </div>
      </div>
    </div>
  `;
}




function formatTrainServiceTime(train) {
  const tickMs = Math.max(250, Number(app.state?.game?.tickMs || 2000));
  const totalSeconds = Math.max(0, Math.floor(Number(train?.age || 0) * tickMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${formatInt(days)} j ${hours} h`;
  if (hours > 0) return `${formatInt(hours)} h ${minutes} min`;
  if (minutes > 0) return `${formatInt(minutes)} min ${seconds} s`;
  return `${formatInt(seconds)} s`;
}

function renderOwnedTrain(train) {
  const model = app.state.balance.trains[train.modelId];
  const line = app.state.me.lines.find(l => l.active && lineHasTrain(l, train.id));
  const construction = train.construction || {};
  const inConstruction = !!construction.active;
  const maint = train.maintenance || {};
  const inMaint = !!maint.active;
  const maintenanceInfo = inMaint ? trainMaintenanceProgress(train) : null;
  const mapSelected = typeof selectedOwnedMapTrainId === 'function' && selectedOwnedMapTrainId() === String(train.id);
  const actions = app.state.balance.maintenanceActions || {};
  const condition = Math.round((train.condition || 0) * 100);
  const conditionClass = condition > 70 ? 'good' : condition > 40 ? 'warn' : 'bad';
  const profile = previewOperatingProfile(train, model);
  const passengerRun = train.passengerRun || {};
  const passengerCapacity = Math.max(0, Number(profile.capacity || 0));
  const passengerLoad = Math.max(0, Math.round(Number(passengerRun.load || 0)));
  const passengerLoadPercent = passengerCapacity > 0 ? clamp(Math.round(passengerLoad / passengerCapacity * 100), 0, 100) : 0;
  const servedStops = line ? lineStopsOf(line) : [];
  const lastServedStation = line && passengerRun.started
    ? station(servedStops[clamp(Number(passengerRun.stopIndex || 0), 0, Math.max(0, servedStops.length - 1))])
    : null;
  const sellTip = line
    ? 'Impossible de vendre : Ce train est affecté à une ligne active.'
    : inConstruction
      ? 'Impossible de vendre : Ce train est en fabrication.'
      : inMaint
        ? 'Impossible de vendre : Ce train est en maintenance.'
        : `Vend ce train d’occasion. Valeur influencée par son état (${condition}%).`;
  const statusLabel = inConstruction
    ? 'En fabrication'
    : line
      ? linePublicName(line)
      : inMaint
        ? 'En maintenance'
        : condition <= 0
          ? 'Immobilisé'
          : 'Libre';
  const statusClass = inConstruction || inMaint ? 'warn' : condition <= 0 ? 'bad' : line ? 'good' : '';
  const maintenanceRemaining = maintenanceInfo ? formatResearchTime(maintenanceInfo.remainingMs) : '';
  const constructionRemaining = formatResearchTime(Number(construction.remainingMs || 0) || Number(construction.durationMs || 0));

  return `
    <div class="list-item train-catalog-card owned-train-card maintenance-train-card ${mapSelected ? 'map-selected' : ''}" data-train-id="${escapeAttr(train.id)}" aria-selected="${mapSelected ? 'true' : 'false'}">
      ${renderTrainArt(model)}
      <div class="train-card-body owned-train-body">
        <div class="item-title">
          <strong>${escapeHtml(model.name)}</strong>
          <span class="tag ${statusClass}">${escapeHtml(statusLabel)}</span>
        </div>
        <p class="small muted">${escapeHtml(model.description || trainStrengths(model))}</p>
        <div class="train-condition-head">
          <span>État ${condition}%</span>
          <b class="${conditionClass}-text">${escapeHtml(trainProjectionLabel(train))}</b>
        </div>
        <div class="progress train-condition-bar ${conditionClass}"><i style="width:${condition}%"></i></div>
        <div class="owned-train-detail-grid">
          <div><span>Disponibilité</span><b>${inConstruction ? `Livraison · ${constructionRemaining}` : inMaint ? `${escapeHtml(maint.label || 'Maintenance')} · ${maintenanceRemaining}` : 'Disponible'}</b></div>
          <div><span>Usure historique</span><b>${escapeHtml(formatTrainServiceTime(train))}</b></div>
          <div><span>Composition</span><b>${escapeHtml(deriveCompositionSummary(train))}</b></div>
          <div><span>Maintenance</span><b>${maintenanceHourlyRange(profile, line ? lineDistance(line) : 100, 1, train.condition)}</b></div>
        </div>
        ${!inConstruction && passengerCapacity > 0 ? `
          <div class="train-passenger-load" title="Le remplissage ne change qu’à l’arrivée dans une gare desservie.">
            <div><span>Remplissage</span><b>${passengerLoadPercent}% · ${formatInt(passengerLoad)} / ${formatInt(passengerCapacity)} voyageurs</b></div>
            <div class="progress train-passenger-load-bar"><i style="width:${passengerLoadPercent}%"></i></div>
            ${lastServedStation ? `<small>Dernière desserte : ${escapeHtml(lastServedStation.name)}</small>` : ''}
            ${passengerRun.lastAlighted > 0 ? `<small>${formatInt(passengerRun.lastAlighted)} descente(s) au dernier arrêt · ${formatSignedMoney(passengerRun.lastRevenue || 0)}</small>` : ''}
          </div>
        ` : ''}
        ${inConstruction ? `
          ${renderTrainConstructionPanel(train, model)}
          <p class="small muted">Le train sera automatiquement livré à la fin de la fabrication. Il ne peut pas encore être affecté, modifié, maintenu ou vendu.</p>
        ` : inMaint ? `
          ${renderTrainMaintenancePanel(train)}
          <p class="small muted">Le train est immobilisé. Toute ligne qui l’utilise reste ouverte mais ne produit rien jusqu’à la fin de l’intervention.</p>
        ` : `
          <div class="maintenance-actions">
            ${Object.values(actions).map(action => renderMaintenanceButton(train, model, action)).join('')}
          </div>
        `}
        <div class="actions">
          <button data-action="follow-train" data-id="${train.id}" ${line && !inConstruction && !inMaint && condition > 0 ? '' : 'disabled'} ${tooltipAttr(line && !inConstruction && !inMaint && condition > 0 ? 'Centre la carte sur ce train et active son suivi.' : 'Le suivi est disponible lorsqu’un train circule sur une ligne active.')}>Suivre sur la carte</button>
          <button data-action="open-composition" data-id="${train.id}" ${inConstruction ? 'disabled' : ''} ${tooltipAttr(inConstruction ? 'Composition disponible après livraison.' : 'Ouvre l’atelier de composition.')}>Composition</button>
          <button class="danger" data-action="sell-train" data-id="${train.id}" ${tooltipAttr(sellTip)} ${line || inConstruction || inMaint ? 'disabled' : ''}>Vendre</button>
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
  const facility = action.facility ? maintenanceFacilityNameClient(action.facility) : 'Maintenance';
  return `
    <button class="maintenance-btn" data-action="repair-train" data-id="${train.id}" data-mode="${action.id}" ${tooltipAttr(`${action.name}. ${action.description || ''} Bâtiment : ${facility}. ${preview}. Effet : Immobilise le train pendant l’intervention, puis remonte son état, sa vitesse effective et sa ponctualité.`)} ${disabled ? 'disabled' : ''}>
      <strong>${escapeHtml(action.name)}</strong>
      <small>${escapeHtml(facility)}</small>
      <span>${preview}</span>
      ${locked ? `<em>${escapeHtml(locked)}</em>` : ''}
    </button>
  `;
}


// ===== 06-stations-staff-research.js =====
// Gares, RH et écran R&D complet.
function renderStations() {
  const me = app.state.me;
  const selected = app.selectedStation ? station(app.selectedStation) : null;
  const stationSearchValue = stationSearchDisplayValue(selected);
  const ownedEntries = sortOwnedStationEntries(Object.entries(me.stations || {}));
  const collapsed = app.ownedStationsCollapsed;
  return `
    ${renderSectionHero('AMÉNAGEMENT DU RÉSEAU', 'Gestion des gares', 'Développe les pôles voyageurs et les commerces tout en gardant la sélection de gare stable côté interface.', ART.tabs.stations, ['Niveaux', 'Commerces', 'Péages'])}

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
          <label class="station-sort-inline">Tri des gares
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
    { kind: 'level', label: asset ? `Niveau +1` : 'Gare libre', maxed: !asset || preview.level >= 5, cost: asset ? stationUpgradeCost(s, preview, 'level') : 0 },
    { kind: 'commerce', label: 'Commerces', maxed: unowned || preview.commerce >= 4, cost: stationUpgradeCost(s, preview, 'commerce') }
  ];
  return `
    <div class="list-item selected-station-card">
      <div class="item-title"><strong>${escapeHtml(s.name)}</strong><span class="tag">${owner ? `Propriétaire : ${escapeHtml(owner.player.name)}` : 'Ville libre'}</span></div>
      <div class="kv">
        <span>Demande voyageurs</span><b>${s.annualPassengers ? `${formatInt(s.annualPassengers)} voy./an` : `${formatInt(s.baseDemand)} estimée`}</b>
        <span>Demande fret</span><b>${formatInt(s.freight)}</b>
        <span>Population</span><b>${s.population ? formatInt(s.population) : '—'}</b>
        ${s.annualPassengers ? `<span>Source de fréquentation</span><b>SNCF ${s.passengerTrafficYear || 2024}</b>` : ''}
        <span>Mode d’accès</span><b>${asset ? 'Gare exploitée' : 'Sillons sur ligne'}</b>
        <span>Niveau gare</span><b>${asset ? asset.level : 'Non possédée'}</b>
        <span>Commerces</span><b>${asset ? asset.commerce : 0}/4</b>
        <span>Électrifiée</span><b>${asset?.electrified ? 'Oui' : 'Non'}</b>
        ${asset ? `<span>Remboursement vente</span><b>${money(stationSaleRefundBreakdown(s, asset).total)}</b>` : ''}
        ${asset ? stationOperatingCostRows(asset) : ''}
      </div>
      <div class="actions station-upgrades">
        ${upgrades.map(up => `
          <button data-action="upgrade-station" data-kind="${up.kind}" data-id="${s.id}" ${tooltipAttr(lockedByOwner ? `Cette gare appartient déjà à ${owner.player.name}.` : stationUpgradeTooltip(s, preview, up))} ${lockedByOwner || up.maxed || cash < up.cost ? 'disabled' : ''}>
            ${escapeHtml(up.label)} <span>${!asset ? 'Via sillons' : up.maxed ? 'Max' : money(up.cost)}</span>
          </button>
        `).join('')}
        ${ownedByMe ? `<button class="danger" data-action="sell-station" data-id="${s.id}" ${tooltipAttr(stationSaleTooltip(s, asset))}>Vendre <span>${money(stationSaleRefundBreakdown(s, asset).total)}</span></button>` : ''}
      </div>
      ${lockedByOwner ? `<p class="muted small">Cette gare est possédée par ${escapeHtml(owner.player.name)}. Tu peux l’utiliser avec un péage de gare si ta ligne la dessert.</p>` : asset ? '<p class="muted small">Gare possédée par ta compagnie. Les concurrents paieront un péage s’ils la desservent.</p>' : '<p class="muted small">L’achat direct de gare est remplacé par l’achat de sillons : ajoute cette gare à une ligne, puis affecte du matériel à cette ligne.</p>'}
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
  return 0;
}

function stationSaleRefundBreakdown(s, asset = {}) {
  const normalized = {
    level: Math.max(1, Math.min(5, Math.floor(Number(asset.level || 1)))),
    commerce: Math.max(0, Math.min(4, Math.floor(Number(asset.commerce || 0)))),
    maintenance: 0,
    depot: false
  };
  const acquisition = stationAcquisitionCost(s);
  let levels = 0;
  for (let level = 1; level < normalized.level; level++) levels += stationUpgradeCost(s, { ...normalized, level }, 'level');
  let commerces = 0;
  for (let commerce = 0; commerce < normalized.commerce; commerce++) commerces += stationUpgradeCost(s, { ...normalized, commerce }, 'commerce');
  const maintenance = 0;
  const depot = 0;
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
  const refund = stationSaleRefundBreakdown(s, asset);
  const circulation = users.length
    ? ` ${users.length} ligne${users.length > 1 ? 's' : ''} la desservent encore et resteront actives.`
    : '';
  return `Vend ${s.name} et rembourse la gare, les niveaux et les commerces. Remboursement total : ${money(refund.total)}.${circulation}`;
}

function economyValue(key, fallback = 0) {
  const value = Number(app.state?.balance?.economy?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function stationOperatingCostBreakdown(asset = {}) {
  const level = Number(asset.level || 0) * economyValue('stationLevelCost', 58);
  const commerce = Number(asset.commerce || 0) * economyValue('stationCommerceCost', 64);
  const maintenance = 0;
  const depot = 0;
  return { level, commerce, maintenance, depot, total: level + commerce + maintenance + depot };
}

function stationOperatingCostRows(asset = {}) {
  const cost = stationOperatingCostBreakdown(asset);
  return `
    <span>Coût/h commerces</span><b>${moneyPerHour(cost.commerce)}</b>
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
      </div>
      <div class="station-owned-tile-foot">
        <span>Revente ${money(refund.total)}</span>
        <div class="station-owned-actions">
          <button data-action="select-station" data-id="${s.id}" ${tooltipAttr('Sélectionne cette gare, centre ton travail sur sa fiche et permet de lancer ses améliorations.')}>Voir</button>
          <button class="danger" data-action="sell-station" data-id="${s.id}" ${tooltipAttr(stationSaleTooltip(s, asset))}>Vendre</button>
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

function eraTransitionDurationMsClient(targetEpoch) {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const durations = { 1: 5 * day, 2: 10 * day, 3: 15 * day, 4: 21 * day, 5: 30 * day, 6: 45 * day };
  return durations[Math.max(1, Math.floor(Number(targetEpoch || 1)))] || 45 * day;
}

function eraTransitionProgressPercent(transition) {
  if (!transition) return 0;
  return researchProgressPercentFromData(transition.endAt, transition.durationMs, 1);
}

function epochRequirementsMetClient(me, next, totalTech, trafficTotal) {
  if (!me || !next) return false;
  const milestones = next.requiredResearch || [];
  const milestonesMet = milestones.every(req => techLevel(req.id) >= Number(req.level || 1));
  return Number(totalTech || 0) >= Number(next.requiredTech || 0) && Number(trafficTotal || 0) >= Number(next.requiredTraffic || 0) && milestonesMet;
}

function missingEpochMilestonesClient(next) {
  return (next?.requiredResearch || []).filter(req => techLevel(req.id) < Number(req.level || 1));
}

function renderEraTransitionPanel(me, next, totalTech, trafficTotal) {
  const transition = me?.eraTransition || null;
  if (transition) {
    const pct = eraTransitionProgressPercent(transition);
    return `
      <div class="era-transition-panel active">
        <div class="item-title">
          <strong>Passage d’époque en cours : ${escapeHtml(transition.targetName || next?.name || 'époque suivante')}</strong>
          <span class="tag warn research-clock" data-research-timer data-end-at="${Math.round(transition.endAt || 0)}">${formatResearchTime(Math.max(0, Number(transition.endAt || 0) - serverNow()))}</span>
        </div>
        <div class="progress research-progress"><i data-research-progress data-research-key="era:${Number(transition.targetEpoch || 0)}:${Number(transition.startedAt || 0)}" data-end-at="${Math.round(transition.endAt || 0)}" data-duration-ms="${Math.round(transition.durationMs || 1)}" data-work-rate="1" data-last-progress="${round(pct)}" style="width:${round(pct)}%"></i></div>
        <p class="small muted">La R&D est verrouillée pendant cette transition. Aucune recherche ne peut être lancée ou ajoutée à la file jusqu’à la fin du passage d’époque.</p>
      </div>
    `;
  }
  if (!next) return '';
  const ready = epochRequirementsMetClient(me, next, totalTech, trafficTotal);
  const blockedByResearch = Boolean(me?.researchProject) || Boolean((me?.researchQueue || []).length);
  const durationMs = eraTransitionDurationMsClient((me?.epoch || 0) + 1);
  let reason = '';
  if (!ready) reason = 'Complète les prérequis de technologie et de trafic cumulé.';
  if (!ready) {
    const missing = missingEpochMilestonesClient(next);
    if (missing.length) reason = `Jalons manquants : ${missing.map(req => `${techNodeTitle(req.id)} niv. ${req.level || 1}`).join(', ')}.`;
  } else if (blockedByResearch) reason = 'Aucune recherche ne doit être active ou en attente pour lancer le passage d’époque.';
  else reason = `Durée prévue : ${formatResearchTime(durationMs)}. Pendant ce temps, aucune recherche ne sera disponible.`;
  return `
    <div class="era-transition-panel ${ready ? 'ready' : ''}">
      <div>
        <strong>Passage à l’époque suivante</strong>
        <p class="small muted">${escapeHtml(reason)}</p>
      </div>
      <button type="button" class="primary" data-action="start-epoch-transition" ${!ready || blockedByResearch ? 'disabled' : ''} ${tooltipAttr(`Lance le passage vers ${next.name}. Durée prévue : ${formatResearchTime(durationMs)}. Aucune recherche ne pourra être effectuée pendant cette période.`)}>
        Lancer le passage à l’ère suivante
      </button>
    </div>
  `;
}

function researchBlockedByEraTransition() {
  return Boolean(app.state?.me?.eraTransition);
}


function allResearchEntriesClient() {
  const tree = app.state?.balance?.techTree || {};
  const entries = [];
  for (const group of Object.values(tree)) {
    for (const node of group.nodes || []) entries.push({ group, node });
  }
  return entries;
}

function researchSearchHaystack(entry) {
  const { group, node } = entry || {};
  const prereqs = [];
  for (const req of researchPrereqsForLevelClient(node, Math.max(1, plannedTechLevel(node?.id) + 1))) {
    prereqs.push(researchPrereqLabelClient(req));
  }
  return normalizeSearchText([
    node?.id,
    node?.title,
    node?.description,
    node?.branch,
    node?.eraLabel,
    group?.label,
    group?.description,
    ...(node?.unlocks || []),
    ...(node?.improves || []),
    ...prereqs
  ].filter(Boolean).join(' '));
}

function researchSearchResults(query) {
  const q = normalizeSearchText(query || '');
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return allResearchEntriesClient()
    .map(entry => {
      const haystack = researchSearchHaystack(entry);
      if (!tokens.every(token => haystack.includes(token))) return null;
      const title = normalizeSearchText(entry.node?.title || '');
      const group = normalizeSearchText(entry.group?.label || '');
      const id = normalizeSearchText(entry.node?.id || '');
      let score = 0;
      if (title === q) score += 120;
      if (title.startsWith(q)) score += 80;
      if (title.includes(q)) score += 55;
      if (id.includes(q)) score += 35;
      if (group.includes(q)) score += 18;
      score += Math.max(0, 12 - Math.max(0, title.length - q.length) / 8);
      return { ...entry, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || String(a.node?.title || '').localeCompare(String(b.node?.title || ''), 'fr'));
}

function renderResearchSearchStatus(node) {
  const acquiredLevel = techLevel(node.id);
  const plannedLevel = plannedTechLevel(node.id);
  const maxLevel = techMaxLevel(node);
  const unlimited = !Number.isFinite(maxLevel);
  const complete = Number.isFinite(maxLevel) && plannedLevel >= maxLevel;
  if (complete) return `<span class="tag good">Niveau max</span>`;
  if (plannedLevel > acquiredLevel) return `<span class="tag warn">Niv. ${acquiredLevel} · prévu ${plannedLevel}${unlimited ? ' · ∞' : ''}</span>`;
  if (acquiredLevel > 0) return `<span class="tag good">Niv. ${acquiredLevel}${unlimited ? ' · ∞' : ''}</span>`;
  return unlimited ? '<span class="tag">Sans plafond · ∞</span>' : '<span class="tag">Non lancé</span>';
}

function renderResearchSearchResult(entry) {
  const { group, node } = entry;
  const acquiredLevel = techLevel(node.id);
  const plannedLevel = plannedTechLevel(node.id);
  const maxLevel = techMaxLevel(node);
  const complete = Number.isFinite(maxLevel) && plannedLevel >= maxLevel;
  const targetLevel = complete ? maxLevel : (Number.isFinite(maxLevel) ? Math.min(maxLevel, plannedLevel + 1) : plannedLevel + 1);
  const locked = complete ? '' : techLockedReason(node, targetLevel);
  const costMoney = complete ? 0 : researchCostMoneyClient(node, targetLevel);
  const durationMs = complete ? 0 : researchDurationClient(node, targetLevel);
  const affordable = app.state.me.cash >= costMoney;
  const eraBlocked = researchBlockedByEraTransition();
  const unlocks = (node.unlocks || []).slice(0, 3);
  const improves = (node.improves || []).filter(effect => !String(effect || '').toLowerCase().startsWith('niveaux suivants')).slice(0, 3);
  const image = artForTechNode(node.id);
  return `
    <article class="research-search-result" data-node-id="${escapeAttr(node.id)}">
      ${image ? `<div class="research-search-thumb" style="--node-image:url('${escapeAttr(image)}')"></div>` : '<div class="research-search-thumb placeholder">R&D</div>'}
      <div class="research-search-main">
        <div class="item-title">
          <strong>${escapeHtml(node.title)}</strong>
          ${renderResearchSearchStatus(node)}
        </div>
        <p class="small muted">${escapeHtml(group.label || 'Recherche')} · ${escapeHtml(node.eraLabel || trainEraLabel(node.requiredEpoch || 0))}</p>
        <div class="research-search-meta">
          <span>Prochain : <b>${complete ? 'Terminé' : `niv. ${targetLevel}`}</b></span>
          <span>Coût : <b>${complete ? '-' : money(costMoney)}</b></span>
          <span>Durée : <b>${complete ? '-' : formatResearchTime(durationMs)}</b></span>
        </div>
        <div class="research-search-effects">
          ${unlocks.length ? unlocks.map(effect => `<span>${escapeHtml(effect)}</span>`).join('') : '<span>Aucun déblocage immédiat</span>'}
          ${improves.length ? improves.map(effect => `<span>${escapeHtml(effect)}</span>`).join('') : ''}
        </div>
      </div>
      <div class="research-search-actions">
        <button type="button" data-action="focus-research" data-id="${escapeAttr(node.id)}">Voir</button>
        <button type="button" class="primary" data-action="research-node" data-id="${escapeAttr(node.id)}" ${complete || locked || !affordable || eraBlocked ? 'disabled' : ''}>${complete ? 'Max' : eraBlocked ? 'R&D bloquée' : app.state.me.researchProject ? 'Ajouter' : 'Lancer'}</button>
      </div>
    </article>
  `;
}

function renderResearchSearchResults(query = app.researchSearchQuery) {
  const raw = String(query || '').trim();
  if (!raw) {
    return '<p class="small muted">Saisis le nom d’une recherche, d’un matériel, d’un bonus, d’une branche ou d’une époque. La recherche couvre tout l’arbre R&D, pas seulement l’onglet ouvert.</p>';
  }
  const results = researchSearchResults(raw);
  if (!results.length) {
    return `<p class="small muted">Aucune recherche trouvée pour <b>${escapeHtml(raw)}</b>.</p>`;
  }
  return `
    <div class="research-search-summary">${results.length} résultat${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''}</div>
    <div class="research-search-list">${results.map(renderResearchSearchResult).join('')}</div>
  `;
}

function renderResearchSearchPanel() {
  const query = app.researchSearchQuery || '';
  return `
    <div class="research-search-panel">
      <div class="research-search-header">
        <div>
          <h3>Recherche rapide R&D</h3>
          <p class="small muted">Retrouve n’importe quelle recherche de l’arbre, même dans une autre branche.</p>
        </div>
        ${query ? `<button type="button" data-action="clear-research-search">Effacer</button>` : ''}
      </div>
      <label class="research-search-box">
        <span>Rechercher</span>
        <input id="researchSearchInput" value="${escapeAttr(query)}" placeholder="Ex : TGV, diesel, signalisation, confort, fret..." autocomplete="off">
      </label>
      <div id="researchSearchResults" class="research-search-results">${renderResearchSearchResults(query)}</div>
    </div>
  `;
}


function renderResearchToolbarSearch() {
  const query = app.researchSearchQuery || '';
  return `
    <div class="research-toolbar-search">
      <div class="research-toolbar-search__header">
        <div>
          <strong>Recherche rapide</strong>
          <span>Un accès direct à toute la R&D.</span>
        </div>
        ${query ? `<button type="button" class="ghost" data-action="clear-research-search">Effacer</button>` : ''}
      </div>
      <label class="research-toolbar-search__input">
        <input id="researchSearchInput" value="${escapeAttr(query)}" placeholder="Ex : TGV, diesel, signalisation, confort, fret..." autocomplete="off">
      </label>
      <div id="researchSearchResults" class="research-toolbar-search__results">
        ${query
          ? renderResearchSearchResults(query)
          : '<p class="research-toolbar-search__hint">Saisis un nom de recherche, de train, de bonus ou d’époque pour retrouver instantanément le bon nœud.</p>'}
      </div>
    </div>
  `;
}

function refreshResearchSearchResults() {
  const results = $('#researchSearchResults');
  if (results) results.innerHTML = renderResearchSearchResults(app.researchSearchQuery);
}


function researchActiveTargetLevel(node) {
  const level = plannedTechLevel(node.id);
  const max = techMaxLevel(node);
  if (Number.isFinite(max) && level >= max) return max;
  return level + 1;
}

function collectResearchOverview(tabs, me = app.state?.me) {
  const groups = Array.isArray(tabs) ? tabs : [];
  const allNodes = groups.flatMap(group => group?.nodes || []);
  const eraCounts = new Map();
  let unlocked = 0;
  let available = 0;
  let locked = 0;
  for (const node of allNodes) {
    const targetLevel = researchActiveTargetLevel(node);
    const max = techMaxLevel(node);
    const acquired = techLevel(node.id);
    const complete = Number.isFinite(max) && acquired >= max;
    const nodeLocked = complete ? false : Boolean(techLockedReason(node, targetLevel)) || researchBlockedByEraTransition();
    if (complete) unlocked += 1;
    else if (nodeLocked) locked += 1;
    else available += 1;
    const eraKey = `${Number(node.era || 0)}:${node.eraLabel || `Ère ${node.era || ''}`}`;
    if (!eraCounts.has(eraKey)) {
      eraCounts.set(eraKey, { era: Number(node.era || 0), label: node.eraLabel || `Ère ${node.era || ''}`, count: 0 });
    }
    eraCounts.get(eraKey).count += 1;
  }
  return {
    total: allNodes.length,
    unlocked,
    available,
    locked,
    branchCounts: groups.map(group => ({
      id: group.id,
      label: group.label,
      description: group.description,
      count: (group.nodes || []).length
    })),
    eraCounts: Array.from(eraCounts.values()).sort((a, b) => a.era - b.era || a.label.localeCompare(b.label, 'fr'))
  };
}

function renderResearchBoardMenu(tabs, active, me, next, progress) {
  const overview = collectResearchOverview(tabs, me);
  const currentEraIndex = Math.max(0, Number(me.epoch || 0));
  return `
    <div class="research-board-menu research-board-menu--compact">
      <section class="research-board-block research-board-block--summary">
        <div class="research-board-heading research-board-heading--compact">
          <div>
            <h3>Navigation R&D</h3>
            <p class="small muted">Branches, états et raccourcis regroupés dans une zone compacte.</p>
          </div>
          <span class="tag">${overview.total} recherches</span>
        </div>
        <div class="research-summary-grid">
          <div class="research-summary-section">
            <span class="research-summary-label">Branches</span>
            <div class="research-branch-strip research-branch-strip--compact">
              ${overview.branchCounts.map(group => `
                <button data-action="research-tab" data-id="${group.id}" class="research-branch-pill ${group.id === active.id ? 'active' : ''}" ${tooltipAttr(`${group.label} · ${group.count} recherches`)}>
                  <span>${escapeHtml(group.label)}</span>
                  <b>${group.count}</b>
                </button>
              `).join('')}
            </div>
          </div>
          <div class="research-summary-section research-summary-section--legend">
            <span class="research-summary-label">Légende</span>
            <div class="research-legend-strip research-legend-strip--compact">
              <span class="research-legend-pill research-legend-pill--unlocked">Débloquée · ${overview.unlocked}</span>
              <span class="research-legend-pill research-legend-pill--available">Disponible · ${overview.available}</span>
              <span class="research-legend-pill research-legend-pill--locked">Verrouillée · ${overview.locked}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="research-board-block research-board-block--overview">
        <div class="research-board-heading research-board-heading--compact">
          <div>
            <h3>État du programme</h3>
            <p class="small muted">Synthèse de l’époque et de la suite.</p>
          </div>
          <span class="tag ${progress >= 100 ? 'good' : 'warn'}">${round(progress)}%</span>
        </div>
        <div class="research-progress-strip research-progress-strip--compact">
          <div class="research-progress-pill">
            <span>Époque actuelle</span>
            <b>${escapeHtml(me.eraName)}</b>
          </div>
          <div class="research-progress-pill">
            <span>Capacité labo</span>
            <b>${round(researchWorkRateClient(me))}x</b>
          </div>
          <div class="research-progress-pill">
            <span>Prochaine cible</span>
            <b>${escapeHtml(next?.name || 'Toutes débloquées')}</b>
          </div>
        </div>
      </section>

      <section class="research-board-block research-board-block--eras-compact">
        <div class="research-board-heading research-board-heading--compact">
          <div>
            <h3>Ères du projet</h3>
            <p class="small muted">Répartition réelle des recherches par époque.</p>
          </div>
        </div>
        <div class="research-era-strip research-era-strip--compact">
          ${overview.eraCounts.map(item => `
            <span class="research-era-pill ${item.era - 1 <= currentEraIndex ? 'current' : ''}">
              <b>${item.era}</b>
              <span>${escapeHtml(String(item.label || '').replace(/^Train à /, ''))}</span>
              <small>${item.count}</small>
            </span>
          `).join('')}
        </div>
      </section>

      <section class="research-board-block research-board-block--search-compact">
        ${renderResearchToolbarSearch()}
      </section>
    </div>
  `;
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
  const eraTransition = me.eraTransition || null;
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
      ` : eraTransition ? `<p class="small muted">R&D indisponible : passage d’époque en cours.</p>` : `<p class="small muted">Aucun projet actif. Lancer une recherche applique un coût initial, puis ajoute ${moneyPerHour(economyValue('researchLabBaseCost', 180))} aux dépenses/h jusqu’à la fin du projet.</p>`}
      ${renderResearchQueueCompletion(me)}
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
          <p class="small muted">Le trafic cumulé additionne tous les <b>voyageurs transportés</b> et toutes les <b>tonnes de fret livrées</b> depuis la création de ta compagnie. Les jalons structurants, le trafic et une transition longue gardent chaque ère importante sur une partie qui se joue sur plusieurs mois.</p>
          ${(next.requiredResearch || []).length ? `
            <div class="epoch-requirement-row epoch-milestones">
              <div><span>Jalons structurants</span></div>
              <div class="research-prereq-list">${(next.requiredResearch || []).map(req => {
                const met = techLevel(req.id) >= Number(req.level || 1);
                return `<span class="research-prereq ${met ? 'met' : 'missing'}">${escapeHtml(techNodeTitle(req.id))} niv. ${Number(req.level || 1)}</span>`;
              }).join('')}</div>
            </div>
          ` : ''}
          ${renderEraTransitionPanel(me, next, totalTech, trafficTotal)}
        </div>
      ` : '<p class="muted">Toutes les époques sont débloquées.</p>'}
    </div>

    <div class="card card--research-tree">
      <div class="research-tree-header">
        <div>
          <h2>Arbre technologique</h2>
          <p class="small muted">Les recherches sont encore plus resserrées horizontalement pour pouvoir afficher jusqu’à 10 colonnes à l’écran sans déplacement latéral sur une largeur standard.</p>
        </div>
        <span class="tag">${(active?.nodes || []).length} recherches · ${escapeHtml(active?.label || 'Branche')}</span>
      </div>
      ${renderResearchBoardMenu(tabs, active, me, next, progress)}
      <div class="research-tree-stage">
        <p class="small muted">Branche affichée : <b>${escapeHtml(active?.label || '')}</b> · clique sur un nœud pour ses détails et ses prérequis.</p>
        ${renderResearchNodeGrid(active)}
      </div>
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
  const eraBlocked = researchBlockedByEraTransition();
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
            ${complete ? 'Max' : `Niv. ${acquiredLevel}${level > acquiredLevel ? ` · prévu ${level}` : ''}${unlimited ? ' · ∞' : ''}`}
          </span>
        </div>
        <div class="kv">
          <span>Prochain niveau</span><b>${complete ? 'Terminé' : `Niv. ${targetLevel}`}</b>
          ${unlimited ? '<span>Plafond</span><b>∞</b>' : ''}
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
          <button class="primary" data-action="research-node" data-id="${node.id}" ${tooltipAttr(`Recherche : ${node.title}. Budget : ${money(costMoney)}. Durée estimée : ${formatResearchTime(durationMs)}. Débloque : ${(node.unlocks || []).join(', ') || 'aucune fonctionnalité immédiate'}. Améliore : ${(node.improves || []).join(', ') || 'niveau de branche.'}`)} ${complete || locked || !affordable || eraBlocked ? 'disabled' : ''}>
            ${complete ? 'Maximum' : eraBlocked ? 'R&D bloquée par le passage d’époque' : busy ? `Ajouter à la file niv. ${targetLevel}` : affordable ? `Lancer niv. ${targetLevel}` : 'Budget insuffisant'}
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

function renderResearchDetailPrereq(req) {
  if (req.anyOf) {
    return `<div class="research-detail-prereq-group"><span>Un des prérequis suivants :</span>${req.anyOf.map(renderResearchDetailPrereq).join('')}</div>`;
  }
  const ready = researchPrereqSatisfiedClient(req);
  return `<button type="button" class="research-detail-prereq ${ready ? 'met' : ''}" data-action="research-detail-prereq" data-id="${escapeAttr(req.id)}"><span>${escapeHtml(techNodeTitle(req.id))}</span><b>niv. ${Number(req.level || 1)}</b></button>`;
}

function renderResearchDetailOverlay() {
  const nodeId = app.selectedResearchId || '';
  const node = techNodeById(nodeId);
  if (!node) return '';
  const level = plannedTechLevel(node.id);
  const acquired = techLevel(node.id);
  const max = techMaxLevel(node);
  const complete = Number.isFinite(max) && level >= max;
  const targetLevel = complete ? max : level + 1;
  const locked = complete ? '' : techLockedReason(node, targetLevel);
  const affordable = app.state.me.cash >= researchCostMoneyClient(node, targetLevel);
  const prereqs = researchPrereqsForLevelClient(node, targetLevel);
  const effects = (node.improves || node.effects || []).filter(effect => effect && !String(effect).toLowerCase().includes('niveaux suivants')).slice(0, 4);
  const unlocks = (node.unlocks || []).slice(0, 4);
  const launchable = !complete && !locked && affordable && !researchBlockedByEraTransition();
  const savedOffset = app.researchDetailOffset || {};
  const offsetX = Number.isFinite(Number(savedOffset.x)) ? Math.round(Number(savedOffset.x)) : 0;
  const offsetY = Number.isFinite(Number(savedOffset.y)) ? Math.round(Number(savedOffset.y)) : 0;
  return `
    <div class="research-detail-overlay" role="presentation">
      <section class="research-detail-panel" data-research-detail-drag role="dialog" aria-modal="true" aria-label="Détail de la recherche ${escapeAttr(node.title)}" style="--research-detail-x:${offsetX}px;--research-detail-y:${offsetY}px">
        <div class="research-detail-heading">
          <div class="research-detail-heading-main">
            <div>
              <span class="research-detail-kicker">${escapeHtml(node.eraLabel || 'Recherche ferroviaire')}</span>
              <strong>${escapeHtml(node.title)}</strong>
            </div>
            <button type="button" class="ghost research-detail-close" data-action="close-research-detail" aria-label="Fermer la fiche de recherche">×</button>
          </div>
          <span class="tag ${complete ? 'good' : locked ? 'bad' : 'warn'}">${complete ? 'Acquise' : `Niv. ${acquired} → ${targetLevel}${Number.isFinite(max) ? '' : ' · ∞'}`}</span>
        </div>
        <p>${escapeHtml(node.description || '')}</p>
        ${effects.length ? `<div class="research-detail-section"><small>Effets</small>${effects.map(effect => `<span>${escapeHtml(effect)}</span>`).join('')}</div>` : ''}
        ${unlocks.length ? `<div class="research-detail-section"><small>Débloque</small>${unlocks.map(unlock => `<span>${escapeHtml(unlock)}</span>`).join('')}</div>` : ''}
        <div class="research-detail-section research-detail-section--prereqs">
          <small>Prérequis</small>
          ${prereqs.length ? prereqs.map(renderResearchDetailPrereq).join('') : '<span class="research-detail-ready">Aucun prérequis</span>'}
        </div>
        <div class="research-detail-footer">
          <span>${complete ? 'Recherche terminée' : `${money(researchCostMoneyClient(node, targetLevel))} · ${formatResearchTime(researchDurationClient(node, targetLevel))}`}</span>
          <button type="button" class="primary" data-action="research-node" data-id="${escapeAttr(node.id)}" ${launchable ? '' : 'disabled'}>${complete ? 'Acquise' : locked ? 'Prérequis requis' : affordable ? `Lancer niv. ${targetLevel}` : 'Budget insuffisant'}</button>
        </div>
      </section>
    </div>`;
}

function renderResearchNodeGrid(group) {
  const nodes = group?.nodes || [];
  if (!nodes.length) return '<p class="muted">Aucune recherche disponible.</p>';

  const nodePitch = 128;
  const eraHeight = 410;
  const trackGap = 30;
  const connectorStub = 12;
  // Laisse une vraie respiration entre le libellé d’un hexagone et le suivant,
  // y compris pour les intitulés longs sur trois lignes.
  const nodeWidth = 128;
  const hexCenterX = Math.round(nodeWidth / 2);
  const byEra = new Map();
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  for (const node of nodes) {
    const era = Math.max(1, Math.min(7, Number(node.era || node.requiredEpoch + 1 || 1)));
    if (!byEra.has(era)) byEra.set(era, []);
    byEra.get(era).push(node);
  }

  const internalParents = node => researchPrereqsForLevelClient(node, 1)
    .flatMap(req => req.anyOf || [req])
    .map(req => nodeById.get(req.id))
    .filter(Boolean);
  const depthCache = new Map();
  const branchDepth = (node, path = new Set()) => {
    if (depthCache.has(node.id)) return depthCache.get(node.id);
    if (path.has(node.id)) return 0;
    const nextPath = new Set(path).add(node.id);
    const depth = internalParents(node).reduce((max, parent) => Math.max(max, branchDepth(parent, nextPath) + 1), 0);
    depthCache.set(node.id, depth);
    return depth;
  };

  const positions = new Map();
  let maxColumns = 1;
  for (const [era, eraNodes] of byEra) {
    const initialOrder = new Map(eraNodes.map((node, index) => [node.id, index]));
    eraNodes.sort((a, b) => {
      const subtreeA = a.subtree || (a.branch === 'freight' ? 'freight' : 'passengers');
      const subtreeB = b.subtree || (b.branch === 'freight' ? 'freight' : 'passengers');
      const parentScore = node => {
        const parentColumns = internalParents(node)
          .map(parent => positions.get(parent.id)?.column)
          .filter(Number.isFinite);
        return parentColumns.length ? parentColumns.reduce((sum, column) => sum + column, 0) / parentColumns.length : -1;
      };
      const laneA = subtreeA === 'freight' ? 1 : 0;
      const laneB = subtreeB === 'freight' ? 1 : 0;
      return laneA - laneB
        || parentScore(a) - parentScore(b)
        || branchDepth(a) - branchDepth(b)
        || initialOrder.get(a.id) - initialOrder.get(b.id);
    });
    let previousColumn = -1;
    eraNodes.forEach((node, index) => {
      const parentColumns = internalParents(node)
        .map(parent => positions.get(parent.id)?.column)
        .filter(Number.isFinite);
      const desiredColumn = parentColumns.length
        ? Math.round(parentColumns.reduce((sum, column) => sum + column, 0) / parentColumns.length)
        : index;
      const column = Math.max(previousColumn + 1, desiredColumn);
      previousColumn = column;
      positions.set(node.id, {
        // Une même génération partage une ligne parfaitement horizontale.
        x: 28 + column * nodePitch,
        y: 238 + (era - 1) * eraHeight,
        era,
        column
      });
    });
    maxColumns = Math.max(maxColumns, previousColumn + 1);
  }
  const treeWidth = Math.max(980, 70 + maxColumns * nodePitch);
  const treeHeight = 230 + 7 * eraHeight;
  const links = [];
  const linkLabels = [];
  const linkNodes = [];
  const sameEraTracks = new Map();
  const crossEraTracks = new Map();
  const allocateTrack = (store, key, x1, x2) => {
    const tracks = store.get(key) || [];
    const start = Math.min(x1, x2) - 8;
    const end = Math.max(x1, x2) + 8;
    let index = tracks.findIndex(ranges => ranges.every(range => end < range.start || start > range.end));
    if (index < 0) {
      index = tracks.length;
      tracks.push([]);
    }
    tracks[index].push({ start, end });
    store.set(key, tracks);
    return index;
  };
  for (const node of nodes) {
    const target = positions.get(node.id);
    for (const req of researchPrereqsForLevelClient(node, 1)) {
      const requirements = req.anyOf || [req];
      const source = requirements.map(item => ({ item, position: positions.get(item.id), node: nodeById.get(item.id) })).find(item => item.position && item.node);
      if (!source || !target) continue;
      const sameEra = source.position.era === target.era;
      const x1 = source.position.x + hexCenterX;
      const y1 = sameEra ? source.position.y + 4 : source.position.y + 84;
      const x2 = target.x + hexCenterX;
      const y2 = target.y + 4;
      const level = source.item.level || 1;
      const met = researchPrereqSatisfiedClient(source.item);
      const selected = app.selectedResearchId === node.id;
      const track = sameEra
        ? allocateTrack(sameEraTracks, String(source.position.era), x1, x2)
        : allocateTrack(crossEraTracks, `${source.position.era}:${target.era}`, x1, x2);
      const laneY = sameEra ? y1 - 22 - track * trackGap : y2 - 32 - track * trackGap;
      const direction = x2 >= x1 ? 1 : -1;
      const route = `M ${x1} ${y1} V ${laneY} H ${x2 - connectorStub * direction} L ${x2} ${y2}`;
      const labelX = Math.round((x1 + x2) / 2);
      const labelY = laneY - 12;
      if (level > 1) linkLabels.push(`<g class="research-tree-link-label ${met ? 'met' : ''} ${selected ? 'selected' : ''}" transform="translate(${labelX} ${labelY})"><rect x="-14" y="-11" width="28" height="21" rx="10.5"></rect><text y="3">${level}</text></g>`);
      const marker = selected ? 'researchTreeArrowSelected' : met ? 'researchTreeArrowMet' : 'researchTreeArrow';
      linkNodes.push(`<g class="research-tree-link-node ${met ? 'met' : ''} ${selected ? 'selected' : ''}"><circle cx="${x1}" cy="${y1}" r="4.8"></circle><circle cx="${x2}" cy="${y2}" r="4.8"></circle></g>`);
      links.push(`<g class="research-tree-link-group ${met ? 'met' : ''} ${selected ? 'selected' : ''}"><path class="research-tree-link-shadow" d="${route}" mask="url(#researchTreeTextMask)"></path><path class="research-tree-link" d="${route}" marker-end="url(#${marker})" mask="url(#researchTreeTextMask)"></path><path class="research-tree-link-shadow research-tree-link-shadow-dotted" d="${route}" clip-path="url(#researchTreeTextClip)"></path><path class="research-tree-link research-tree-link-dotted" d="${route}" clip-path="url(#researchTreeTextClip)"></path></g>`);
    }
  }
  const eras = [1, 2, 3, 4, 5, 6, 7].map(era => {
    const sample = byEra.get(era)?.[0];
    const label = sample?.eraLabel || `Ère ${era}`;
    const unlocked = Number(app.state?.me?.epoch || 0) >= era - 1;
    return `<div class="research-era-gate ${unlocked ? 'unlocked' : ''}" style="top:${(era - 1) * eraHeight + 104}px" ${tooltipAttr(`${label}. ${unlocked ? 'Ère disponible.' : 'Passage d’époque requis : atteignez les objectifs de technologie et de trafic dans le panneau supérieur.'}`)}><span>${era}. ${escapeHtml(label.replace(/^Train à /, ''))}</span></div>`;
  }).join('');
  const titleZones = nodes.map(node => {
    const pos = positions.get(node.id);
    return {
      x: pos.x + 2,
      y: pos.y + 86,
      width: 124,
      height: 30
    };
  });
  const hexes = nodes.map(node => {
    const pos = positions.get(node.id);
    const level = plannedTechLevel(node.id);
    const acquired = techLevel(node.id);
    const max = techMaxLevel(node);
    const complete = Number.isFinite(max) && level >= max;
    const target = complete ? max : level + 1;
    const locked = complete ? '' : techLockedReason(node, target);
    const affordable = app.state.me.cash >= researchCostMoneyClient(node, target);
    const subtree = node.subtree || (node.branch === 'freight' ? 'freight' : 'passengers');
    const effectSource = (node.improves || []).length ? node.improves : node.unlocks || [];
    const effects = effectSource
      .filter(effect => effect && !String(effect).toLowerCase().includes('niveaux suivants'))
      .slice(0, 2)
      .join(' · ') || 'Amélioration de la branche';
    const prereqs = researchPrereqsForLevelClient(node, target).map(researchPrereqLabelClient).join(', ') || 'Aucun';
    const details = `${node.title}\nEffet : ${effects}${prereqs !== 'Aucun' ? `\nPrérequis : ${prereqs}` : ''}`;
    const tooltip = app.selectedResearchId ? '' : tooltipAttr(details);
    return `
      <article class="research-hex-node tech-node ${complete ? 'unlocked' : locked ? 'locked' : ''} ${subtree === 'freight' ? 'freight' : 'passengers'} ${app.selectedResearchId === node.id ? 'selected' : ''}" data-node-id="${escapeAttr(node.id)}" style="left:${pos.x}px;top:${pos.y}px" ${tooltip}>
        <button type="button" class="research-hex" data-action="select-research-node" data-id="${escapeAttr(node.id)}" ${tooltip}>
          <span class="research-hex__level">${acquired}</span>
          <span class="research-hex__state">${locked ? 'Verrouillé' : complete ? 'Max atteint' : 'Niveau actuel'}</span>
        </button>
        <strong class="research-hex__title">${escapeHtml(node.title)}</strong>
      </article>`;
  }).join('');
  const selectedClass = app.selectedResearchId ? 'has-selection' : '';
  const titleMaskRects = titleZones.map(zone => `<rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" rx="8"></rect>`).join('');
  return `<div class="research-skilltree-scroll"><div class="research-skilltree ${selectedClass}" style="width:${treeWidth}px;height:${treeHeight}px"><svg class="research-skilltree__links" viewBox="0 0 ${treeWidth} ${treeHeight}" aria-hidden="true"><defs><marker id="researchTreeArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path fill="#a4c1c5" d="M 0 0 L 8 4 L 0 8 z"></path></marker><marker id="researchTreeArrowMet" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path fill="#6fda9e" d="M 0 0 L 8 4 L 0 8 z"></path></marker><marker id="researchTreeArrowSelected" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path fill="#f4cb72" d="M 0 0 L 8 4 L 0 8 z"></path></marker><mask id="researchTreeTextMask"><rect x="0" y="0" width="${treeWidth}" height="${treeHeight}" fill="white"></rect>${titleMaskRects.replace(/<rect/g, '<rect fill="black"')}</mask><clipPath id="researchTreeTextClip">${titleMaskRects}</clipPath></defs>${links.join('')}${linkNodes.join('')}${linkLabels.join('')}</svg>${eras}${hexes}</div></div>${renderResearchDetailOverlay()}`;
}

function isResearchQueueCollapsed() {
  return app.researchQueueCollapsed !== false;
}

function setResearchQueueCollapsed(collapsed) {
  app.researchQueueCollapsed = Boolean(collapsed);
  localStorage.setItem('sillons.researchQueueCollapsed', app.researchQueueCollapsed ? '1' : '0');
}

function toggleResearchQueue() {
  setResearchQueueCollapsed(!isResearchQueueCollapsed());
  renderAll();
}

function renderResearchQueueCompletion(me) {
  const info = researchQueueCompletionInfo(me);
  if (!info) return '';
  const queuedText = info.queueCount
    ? `${info.queueCount} recherche${info.queueCount > 1 ? 's' : ''} en attente`
    : 'aucune recherche en attente';
  const activeText = me?.researchProject ? 'projet en cours inclus' : 'aucun projet actif';
  return `
    <hr>
    <div class="research-total-timer-card">
      <div class="item-title">
        <strong>Fin de la file R&D complète</strong>
        <span class="tag warn research-clock" data-research-total-timer data-end-at="${Math.round(info.endAt || 0)}">${formatResearchTime(info.remainingRealMs)}</span>
      </div>
      <div class="research-total-details">
        <span>Toutes les recherches lancées seront terminées vers <b>${escapeHtml(formatDateTime(info.endAt))}</b>.</span>
        <small>Calcul au rythme actuel : ${round(info.workRate)}x · ${activeText} · ${queuedText}.</small>
      </div>
    </div>
  `;
}

function renderResearchQueue(me) {
  const queue = me.researchQueue || [];
  if (!queue.length) return '';
  const workRate = Math.max(0.01, Number(researchWorkRateClient(me) || 1));
  const collapsed = isResearchQueueCollapsed();
  const buttonLabel = collapsed ? 'Déplier' : 'Réduire';
  return `
    <hr>
    <section class="research-queue ${collapsed ? 'collapsed' : ''}">
      <button type="button" class="research-queue-heading" data-action="toggle-research-queue" aria-expanded="${collapsed ? 'false' : 'true'}" ${tooltipAttr(collapsed ? 'Déplier la file d’attente R&D.' : 'Rétracter la file d’attente R&D pour garder le bas du menu visible.')}>
        <span class="research-era-title">
          <span class="research-era-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
          <span>File d’attente R&D</span>
        </span>
        <span class="research-era-meta">${queue.length}/12 · ${buttonLabel}</span>
      </button>
      ${collapsed ? '' : `
        <div class="research-queue-list">
          ${queue.map((item, index) => {
            const realDurationMs = Math.max(0, Number(item.durationMs || 0)) / workRate;
            return `
            <div class="research-queue-item" data-action="focus-research" data-id="${escapeAttr(item.nodeId)}">
              <span class="queue-rank">${index + 1}</span>
              <div>
                <strong>${escapeHtml(item.title || item.nodeId)} niv. ${item.targetLevel}</strong>
                <span>${formatResearchTime(realDurationMs)} à capacité actuelle · ${money(item.costMoney || 0)}</span>
              </div>
              <button class="danger research-cancel-btn" data-action="cancel-research" data-source="queue" data-index="${index}" data-id="${escapeAttr(item.nodeId)}" data-level="${Number(item.targetLevel || 1)}" ${tooltipAttr(`Retire cette recherche de la file et rembourse ${money(item.costMoney || 0)}. Toute recherche suivante qui en dépend serait aussi annulée et remboursée.`)}>Annuler</button>
            </div>
          `;
          }).join('')}
        </div>
      `}
    </section>
  `;
}


function researchLevelEffectUnitsClient(level) {
  const n = Math.max(0, Math.floor(Number(level || 0)));
  if (n <= 5) return n;
  return 5 + 1.5 * Math.log1p(n - 5);
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
    comfort: 'Confort',
    maintenance: 'Coût maintenance/h',
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


// ===== 07-resources-budget-market.js =====
// Énergie, budget et marché.
function resourceDisplayLabel(type) {
  return { coal: 'Charbon', diesel: 'Diesel', electricity: 'Électricité', hydrogen: 'Hydrogène', battery: 'Batterie' }[type] || type;
}

function resourceCurrentStockClient(type) {
  const me = app.state?.me || {};
  const flow = me.resourceFlow || {};
  if (type === 'electricity') return Number(flow.production?.electricity ?? me.resources?.electricityOrder ?? 0);
  return Number(flow.stocks?.[type] ?? me.resources?.[type] ?? 0);
}

function formatResourceZeroTimeClient(hoursFromNow) {
  if (!Number.isFinite(hoursFromNow) || hoursFromNow < 0) return 'inconnue';
  const target = new Date(Date.now() + hoursFromNow * 3600000);
  const time = target.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const afterTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  if (target.toDateString() === now.toDateString()) return `aujourd’hui à ${time}`;
  if (target.toDateString() === tomorrow.toDateString()) return `demain à ${time}`;
  if (target >= afterTomorrow) {
    const date = target.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    return `le ${date} à ${time}`;
  }
  return time;
}

function resourceZeroInfoClient(type) {
  const flow = app.state?.me?.resourceFlow || {};
  const consumption = Number(flow.consumption?.[type] || 0);
  if (type === 'electricity') {
    const production = Number(flow.production?.electricity || app.state?.me?.resources?.electricityOrder || 0);
    if (consumption <= 0) return { label: 'Aucune rupture prévue', detail: 'Aucune consommation électrique active.', cls: 'good-text' };
    if (production <= 0) return { label: 'Maintenant', detail: 'Stock à 0 : maintenant. Aucune commande producteur ne couvre les trains électriques.', cls: 'bad-text' };
    if (production < consumption) return { label: 'Maintenant', detail: `Stock à 0 : maintenant. Déficit de ${round(consumption - production)} MW/h.`, cls: 'bad-text' };
    return { label: 'Aucune rupture prévue', detail: `La commande couvre la consommation actuelle avec une marge de ${round(production - consumption)} MW/h.`, cls: 'good-text' };
  }
  const stock = resourceCurrentStockClient(type);
  if (consumption <= 0) {
    return { label: stock > 0 ? 'Aucune rupture prévue' : 'Stock nul', detail: stock > 0 ? 'Aucune consommation active : le stock ne baisse pas.' : 'Stock déjà nul, mais aucune consommation active.', cls: stock > 0 ? 'good-text' : 'warn-text' };
  }
  if (stock <= 0) return { label: 'Maintenant', detail: 'Stock à 0 : maintenant.', cls: 'bad-text' };
  const hours = stock / consumption;
  const when = formatResourceZeroTimeClient(hours);
  return { label: when, detail: `Stock à 0 : ${when} au rythme actuel (${round(consumption)} u/h).`, cls: hours <= 1 ? 'bad-text' : hours <= 6 ? 'warn-text' : 'good-text' };
}

function resourceZeroTooltipLine(type) {
  return resourceZeroInfoClient(type).detail;
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
        ${metric('Stock à 0', resourceZeroInfoClient(type).label, resourceZeroInfoClient(type).cls, resourceZeroTooltipLine(type))}
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
        ${metric('Charbon', resourceStockLabel('coal'), '', resourceTopTooltip('coal'))}
        ${metric('Diesel', resourceStockLabel('diesel'), '', resourceTopTooltip('diesel'))}
        ${metric('Électricité', resourceStockLabel('electricity'), '', resourceTopTooltip('electricity'))}
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
        ${budgetRow('Gares', b.stationCost || 0, 'expense', 'Niveaux et commerces')}
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


// ===== 08-actions-modals.js =====
// Gestion des actions, formulaires, modales et changelog.
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
  const researchDetailOverlay = event.target.closest('.research-detail-overlay');
  if (researchDetailOverlay && event.target === researchDetailOverlay) {
    closeResearchDetails();
    return;
  }
  const suggestion = event.target.closest('[data-station-choice]');
  if (suggestion) {
    chooseStationSuggestion(suggestion.dataset.role, suggestion.dataset.stationChoice);
    return;
  }

  const lineSubtab = event.target.closest('button[data-lines-subtab]');
  if (lineSubtab) {
    app.activeLinesSubtab = lineSubtab.dataset.linesSubtab;
    localStorage.setItem('sillons.linesSubtab', app.activeLinesSubtab);
    renderAll();
    return;
  }

  const fleetSubtab = event.target.closest('button[data-fleet-subtab]');
  if (fleetSubtab) {
    app.activeFleetSubtab = fleetSubtab.dataset.fleetSubtab;
    localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
    renderAll();
    return;
  }


  const compositionFilter = event.target.closest('[data-composition-filter]');
  if (compositionFilter) {
    if (compositionFilter.dataset.compositionFilter === 'model') setCompositionModelFilter(compositionFilter.value || 'all');
    if (compositionFilter.dataset.compositionFilter === 'assignment') setCompositionAssignmentFilter(compositionFilter.value || 'all');
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

  const compositionCard = event.target.closest('[data-composition-select-card]');
  if (compositionCard && !event.target.closest('button, a, input, select, textarea, label, [data-action], [data-comp-mode], [data-station-choice]')) {
    toggleCompositionCardSelection(compositionCard.dataset.id || '');
    return;
  }

  const adminSubtab = event.target.closest('[data-admin-subtab]');
  if (adminSubtab) {
    app.admin.activeSubtab = adminSubtab.dataset.adminSubtab || 'activity';
    localStorage.setItem('sillons.adminSubtab', app.admin.activeSubtab);
    renderAll();
    return;
  }

  const button = event.target.closest('[data-action], #createLineBtn, #addWaypointBtn');
  if (!button) {
    const lineCard = event.target.closest('.line-card-modern[data-line-id]');
    if (lineCard) {
      focusLineOnMap(lineCard.dataset.lineId || '', { toggle: true });
      return;
    }
    return;
  }
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
  if (action === 'select-research-node') return selectResearchNode(button.dataset.id);
  if (action === 'research-detail-prereq') return selectResearchNode(button.dataset.id);
  if (action === 'focus-effect') return focusUiTarget(button.dataset.tab, button.dataset.label, button.dataset.subtab);
if (action === 'select-composition-train') {
  const trainId = button.dataset.id || '';
  const existingSelection = compositionSelectedIds();
  const nextSelection = existingSelection.includes(trainId) && existingSelection.length > 1 ? existingSelection : [trainId];
  setCompositionSelection(nextSelection, trainId);
  setCompositionEditorTrain(trainId);
  renderAll();
  return;
}
if (action === 'toggle-composition-train-selection') {
  const trainId = button.dataset.id || '';
  const selected = new Set(compositionSelectedIds());
  if (button.checked) selected.add(trainId);
  else selected.delete(trainId);
  setCompositionSelection([...selected], selected.has(app.selectedCompositionTrainId) ? app.selectedCompositionTrainId : ([...selected][0] || ''));
  renderAll();
  return;
}
if (action === 'select-all-composition-trains' || action === 'select-visible-composition-trains') {
  const ids = action === 'select-visible-composition-trains' ? compositionFilteredTrainIds() : [...compositionValidTrainIds()];
  setCompositionSelection(ids, ids[0] || '');
  renderAll();
  return;
}
if (action === 'edit-composition-selection') {
  const ids = compositionSelectedIds();
  if (!ids.length) return toast('Sélectionne au moins un train.', 'error');
  const selectedTrains = (app.state?.me?.trains || []).filter(train => ids.includes(train.id));
  if (selectedTrains.some(train => train.construction?.active)) return toast('Composition indisponible : un train sélectionné est encore en fabrication.', 'error');
  setCompositionSelection(ids, ids[0]);
  setCompositionEditorTrain(ids[0]);
  renderAll();
  return;
}
if (action === 'clear-composition-selection') {
  setCompositionSelection([], '');
  setCompositionEditorTrain('');
  renderAll();
  return;
}
if (action === 'sell-composition-selection') {
  const ids = compositionSelectedIds();
  if (ids.length < 2) return toast('Sélectionne au moins deux trains.', 'error');
  const sale = compositionSelectionSaleSummary(ids);
  if (sale.unavailable.length) return toast('Vente impossible : un ou plusieurs trains sont en fabrication, en maintenance ou affectés à une ligne active.', 'error');
  const message = `Vendre définitivement les ${ids.length} trains sélectionnés ?

Valeur estimée totale : ${money(sale.estimatedValue)}.

Cette action est irréversible.`;
  if (!(await gameConfirm('Vendre les trains sélectionnés', message, { confirmLabel: 'Tout vendre', danger: true }))) return;
  return doAction('sellSelectedTrains', { trainIds: ids });
}
if (action === 'close-composition-editor') {
  setCompositionEditorTrain('');
  renderAll();
  return;
}
if (action === 'toggle-composition-group') {
  const mode = button.dataset.mode || app.fleetSortMode || 'era';
  const key = button.dataset.key || '';
  setCompositionGroupCollapsed(mode, key, !isCompositionGroupCollapsed(mode, key));
  renderAll();
  return;
}
if (action === 'open-composition') {
  const trainId = button.dataset.id || '';
  const train = app.state?.me?.trains?.find(item => item.id === trainId);
  if (train?.construction?.active) return toast('Composition disponible après livraison du train.', 'error');
  app.activeTab = 'fleet';
  app.activeFleetSubtab = 'composition';
  setCompositionSelection([trainId], trainId);
  setCompositionEditorTrain(trainId);
  localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
  renderAll();
  return;
}
if (action === 'follow-train') {
  followTrainOnMap(button.dataset.id || '', app.state?.me?.id || '');
  return;
}
if (action === 'save-train-composition') {
  const trainId = button.dataset.id;
  const train = app.state.me.trains.find(t => t.id === trainId);
  if (!train) return;
  const targetIds = compositionEditTargetIds(trainId);
  if (!targetIds.length) return toast('Aucun train sélectionné.', 'error');
  const targetTrains = (app.state?.me?.trains || []).filter(item => targetIds.includes(item.id));
  if (targetTrains.some(item => item.construction?.active)) return toast('Composition indisponible : un train ciblé est encore en fabrication.', 'error');
  const spec = trainCompositionSpec(train);
  const payload = { trainId, trainIds: targetIds, mode: spec.mode };
  if (spec.mode === 'multiple_unit') {
    delete app.compositionEditorModes?.[trainId];
    localStorage.setItem('sillons.compositionEditorModes', JSON.stringify(app.compositionEditorModes || {}));
    payload.powerUnits = Number($('#compPowerUnitsValue')?.value || $('#compPowerUnits')?.value || 1);
  }
  else if (spec.mode === 'freight_loco') {
    payload.freightCars = Number($('#compFreightCarsValue')?.value || $('#compFreightCars')?.value || 2);
    payload.freightVariant = document.querySelector('input[name="compFreightVariant"]:checked')?.value || '';
  } else {
    payload.passengerCars = Number($('#compPassengerCarsValue')?.value || $('#compPassengerCars')?.value || 1);
    payload.passengerVariant = document.querySelector('input[name="compPassengerVariant"]:checked')?.value || '';
  }
  const economy = targetIds.reduce((acc, id) => {
    const targetTrain = app.state.me.trains.find(t => t.id === id);
    if (!targetTrain) return acc;
    const item = compositionChangeEconomyClient(targetTrain, payload);
    acc.cost += Number(item.cost || 0);
    acc.refund += Number(item.refund || 0);
    return acc;
  }, { cost: 0, refund: 0 });
  const countLabel = targetIds.length > 1 ? `${targetIds.length} trains` : 'ce train';
  if (economy.cost > 0) {
    if (!(await gameConfirm('Modifier la composition', `Appliquer cette composition à ${countLabel} ?

Coût estimé : ${money(economy.cost)}.${economy.refund > 0 ? `
Remboursement estimé : ${money(economy.refund)}.` : ''}`, { confirmLabel: 'Modifier' }))) return;
  } else if (economy.refund > 0) {
    if (!(await gameConfirm('Modifier la composition', `Appliquer cette composition à ${countLabel} ?

Remboursement estimé : ${money(economy.refund)}.`, { confirmLabel: 'Modifier' }))) return;
  }
  return doAction('updateTrainComposition', payload);
}
    if (action === 'buy-train') {
      const modelId = button.dataset.id || '';
      const input = document.querySelector(`[data-buy-train-qty="${CSS.escape(modelId)}"]`);
      const quantity = normalizeTrainPurchaseQuantity(input?.value || 1);
      if (input) updateTrainPurchaseTotal(input, { commit: true });
    if (quantity > 1) {
      const model = app.state?.balance?.trains?.[modelId];
      const unitPrice = Math.max(0, Math.round(Number(button.dataset.unitPrice || (model ? trainPurchaseUnitPriceClient(model) : 0))));
      const totalPrice = unitPrice * quantity;
      const buildTime = model ? trainConstructionDurationMsClient(model) : 0;
      if (!(await gameConfirm('Acheter plusieurs trains', `Acheter ${quantity} exemplaires de ${model?.name || 'ce matériel'} ?

Coût total estimé : ${money(totalPrice)}.
Fabrication estimée : ${formatResearchTime(buildTime)} par train.`, { confirmLabel: 'Acheter' }))) return;
    }
      return doAction('buyTrain', { modelId, quantity });
    }
  if (action === 'duplicate-train') {
    const train = app.state.me.trains.find(t => t.id === button.dataset.id);
    const model = train ? app.state.balance.trains[train.modelId] : null;
    const price = Math.round((model?.price || 0) * 0.98);
    const buildTime = model ? trainConstructionDurationMsClient(model) : 0;
    if (!(await gameConfirm('Dupliquer un train', `Acheter un exemplaire identique de ${model?.name || 'ce matériel'} avec la même composition ?

Coût estimé : ${money(price)}.
Fabrication estimée : ${formatResearchTime(buildTime)}.`, { confirmLabel: 'Dupliquer' }))) return;
    return doAction('duplicateTrain', { trainId: button.dataset.id });
  }
  if (action === 'cancel-train-construction') {
    const train = app.state.me.trains.find(t => t.id === button.dataset.id);
    const model = train ? app.state.balance.trains[train.modelId] : null;
    const refund = Math.max(0, Math.round(Number(train?.construction?.pricePaid || (model ? trainPurchaseUnitPriceClient(model) : 0))));
    const remaining = formatResearchTime(train?.construction?.remainingMs || train?.construction?.durationMs || 0);
    if (!(await gameConfirm('Annuler la construction', `Annuler la fabrication de ${model?.name || 'ce train'} ?

Temps restant : ${remaining}.
Remboursement estimé : ${money(refund)}.`, { confirmLabel: 'Annuler la construction', danger: true }))) return;
    return doAction('cancelTrainConstruction', { trainId: button.dataset.id });
  }
  if (action === 'assign-train-line') {
    const trainId = button.dataset.id;
    const select = document.querySelector(`[data-assign-line-select="${CSS.escape(trainId)}"]`);
    const lineId = select?.value || '';
    if (!lineId) return toast('Choisis une action ou une ligne compatible.', 'error');
    const currentLine = trainCurrentLine(trainId);
    if (lineId === '__remove__') {
      if (!(await gameConfirm('Retirer le train', `Retirer ce train de ${currentLine ? linePublicName(currentLine) : 'sa ligne actuelle'} ?`, { confirmLabel: 'Retirer' }))) return;
      return doAction('setTrainLineAssignment', { trainId, lineId: '' });
    }
    const line = app.state.me.lines.find(l => l.id === lineId);
    const cost = line ? slotPurchaseCostClient(line, 1) : 0;
    const title = currentLine ? 'Changer de ligne' : 'Acheter un sillon';
    const message = currentLine
      ? `Déplacer ce train de ${linePublicName(currentLine)} vers ${line ? linePublicName(line) : 'cette ligne'} ?

Cette action achète 1 sillon sur la nouvelle ligne. Coût : ${money(cost)}.`
      : `Affecter ce train à ${line ? linePublicName(line) : 'cette ligne'} ?

Cette action achète 1 sillon supplémentaire sur la ligne. Coût : ${money(cost)}.`;
    if (!(await gameConfirm(title, message, { confirmLabel: currentLine ? 'Déplacer' : 'Acheter le sillon' }))) return;
    return doAction('setTrainLineAssignment', { trainId, lineId });
  }
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
    if (!(await gameConfirm('Maintenance globale', 'Envoyer tous les trains éligibles en maintenance intermédiaire ?\n\nLa durée dépend de leur état restant et du niveau d’atelier.', { confirmLabel: 'Tout envoyer', danger: true }))) return;
    return doAction('repairAllTrains', { mode });
  }
  if (action === 'buy-maintenance-facility') return doAction('buyMaintenanceFacility', { facility: button.dataset.facility });
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
  if (action === 'focus-line') { focusLineOnMap(button.dataset.id || '', { toggle: true }); return; }
  if (action === 'edit-line') { focusLineOnMap(button.dataset.id || ''); return openLineModal(button.dataset.id); }
  if (action === 'remove-waypoint') { removeDraftWaypoint(button.dataset.index); return; }
  if (action === 'upgrade-station') return doAction('upgradeStation', { stationId: button.dataset.id, kind: button.dataset.kind });
  if (action === 'sell-station') {
    const s = station(button.dataset.id);
    const asset = app.state.me.stations?.[button.dataset.id];
    const refund = s && asset ? stationSaleRefundBreakdown(s, asset).total : 0;
    const servedLines = s ? activeStationUsersClient(s.id).length : 0;
    const circulationNotice = servedLines
      ? ` ${servedLines} ligne${servedLines > 1 ? 's' : ''} la desservent encore ; elles resteront actives.`
      : '';
    if (!(await gameConfirm('Vendre la gare', `Vendre ${s?.name || 'cette gare'} pour ${money(refund)} ?${circulationNotice}`, { confirmLabel: 'Vendre', danger: true }))) return;
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
  if (action === 'close-research-detail') { closeResearchDetails(); return; }
  if (action === 'cancel-research') return doAction('cancelResearch', { source: button.dataset.source, index: Number(button.dataset.index), nodeId: button.dataset.id, targetLevel: Number(button.dataset.level) });
  if (action === 'research-node') return doAction('research', { nodeId: button.dataset.id });
  if (action === 'start-epoch-transition') {
    const nextName = app.state?.balance?.epochs?.[(app.state?.me?.epoch || 0) + 1]?.name || 'l’époque suivante';
    if (!(await gameConfirm('Lancer le passage d’époque', `Lancer le passage vers ${nextName} ? La R&D sera indisponible jusqu’à la fin et aucune recherche ne doit être en cours.`, { confirmLabel: 'Lancer' }))) return;
    return doAction('startEpochTransition', {});
  }
  if (action === 'research-tab') { app.activeResearchTab = button.dataset.id; app.selectedResearchId = ''; localStorage.setItem('sillons.researchTab', app.activeResearchTab); renderAll(); return; }
  if (action === 'clear-research-search') { app.researchSearchQuery = ''; localStorage.removeItem('sillons.researchSearchQuery'); renderAll(); return; }
  if (action === 'toggle-research-queue') { toggleResearchQueue(); return; }
  if (action === 'submit-bug-report') {
    try {
      const title = $('#bugTitle')?.value || '';
      const description = $('#bugDescription')?.value || '';
      const severity = $('#bugSeverity')?.value || 'normal';
      const images = await collectBugImageAttachments();
      return doAction('submitBugReport', { title, description, severity, images });
    } catch (error) {
      toast(error.message || 'Image refusée.', 'error');
      return;
    }
  }
  if (action === 'close-bug-report') return doAction('closeBugReport', { id: button.dataset.id, resolution: 'Réglé' });
  if (action === 'toggle-fleet-catalog-era') { const epoch = Number(button.dataset.epoch || 0); setFleetCatalogEraCollapsed(epoch, !isFleetCatalogEraCollapsed(epoch)); renderAll(); return; }
  if (action === 'toggle-fleet-maintenance-era') { const epoch = Number(button.dataset.epoch || 0); setFleetMaintenanceEraCollapsed(epoch, !isFleetMaintenanceEraCollapsed(epoch)); renderAll(); return; }
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
  if (event.target?.dataset?.buyTrainQty) {
    updateTrainPurchaseTotal(event.target, { commit: true });
    return;
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
    if (response.state) {
      canonicalizeStateStationDisplays(response.state);
      app.state = response.state;
    }
    invalidateMapProjection('action');
    if (app.state?.me) ensureSelectedStation();
    if (!response.ok) {
      toast([response.error, response.hint].filter(Boolean).join(' ' ) || 'Action refusée.', 'error');
    } else {
      if (type === 'sellSelectedTrains') {
        setCompositionSelection([], '');
        setCompositionEditorTrain('');
      }
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

  const compatibleTrainsForService = service => freeOrCurrent
    .map(train => {
      const model = app.state.balance.trains[train.modelId];
      const profile = model ? previewOperatingProfile(train, model) : null;
      return { train, model, profile };
    })
    .filter(item => item.model && lineServiceCompatibleWithProfileClient(service, item.profile));

  const renderEditorHtml = () => {
    const editorDistance = getRouteForStops(app.lineEditor.stops).distance || 0;
    app.lineEditor.ticketPrice = normalizeTicketPrice(app.lineEditor.ticketPrice, lineTicketPrice(line), editorDistance);
    app.lineEditor.tariff = ticketPriceToTariff(app.lineEditor.ticketPrice, editorDistance);
    const selectedTrainCount = app.lineEditor.trainIds.length;
    const currentTrainIds = lineTrainIdsOf(line);
    const addedSillons = app.lineEditor.trainIds.filter(id => !currentTrainIds.includes(id)).length;
    const sillonData = lineAvailableSillonsClient(line);
    const maxForLine = sillonData ? Math.max(0, sillonData.maxForLine) : selectedTrainCount;
    const availableForLine = Math.max(0, maxForLine - selectedTrainCount);
    const sillonCost = addedSillons > 0 ? slotPurchaseCostClient(line, addedSillons) : 0;
    const compatibleTrains = compatibleTrainsForService(app.lineEditor.service);
    const trainChoices = compatibleTrains.map(({ train: t, model, profile }) => {
      const selected = app.lineEditor.trainIds.includes(t.id);
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
            <strong>Sillons et trains affectés à cette ligne</strong>
            <span class="small muted">Chaque train coché consomme 1 sillon. Les nouveaux sillons sont achetés sur la ligne, sans achat de gare.</span>
          </div>
          <span class="tag ${selectedTrainCount ? 'good' : 'warn'}">${selectedTrainCount}/${maxForLine} sillons</span>
        </div>
        <div class="line-sillon-purchase-summary">
          <div><span>Sillons disponibles</span><b id="lineEditorAvailableSillons">${sillonData ? formatInt(availableForLine) : 'N/A'}</b></div>
          <div><span>Nouveaux à acheter</span><b id="lineEditorAddedSillons">${formatInt(addedSillons)}</b></div>
          <div><span>Coût estimé</span><b id="lineEditorSillonCost">${money(sillonCost)}</b></div>
        </div>
        <div class="line-train-choice-grid">${trainChoices || '<p class="muted small">Aucun train libre compatible avec ce type de transport.</p>'}</div>
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

  openModal('Modifier la ligne', renderEditorHtml(), { wide: true });
  const modalForFocus = $('#modal');
  modalForFocus?.addEventListener('close', clearFocusedLine, { once: true });

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
    $('#editLineService')?.addEventListener('change', e => {
      app.lineEditor.service = e.target.value;
      const compatibleIds = new Set(compatibleTrainsForService(app.lineEditor.service).map(item => item.train.id));
      app.lineEditor.trainIds = app.lineEditor.trainIds.filter(id => compatibleIds.has(id));
      app.lineEditor.trainId = app.lineEditor.trainIds[0] || '';
      rerenderBody();
    });
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
        const slots = lineAvailableSillonsClient(line);
        const currentIds = lineTrainIdsOf(line);
        const maxForLine = slots ? Math.max(0, slots.maxForLine) : checked.length;
        const available = Math.max(0, maxForLine - checked.length);
        const addedSillons = checked.filter(id => !currentIds.includes(id)).length;
        const sillonCost = addedSillons > 0 ? slotPurchaseCostClient(line, addedSillons) : 0;
        tag.textContent = `${checked.length}/${maxForLine} sillons`;
        const availableLabel = $('#lineEditorAvailableSillons');
        const addedLabel = $('#lineEditorAddedSillons');
        const costLabel = $('#lineEditorSillonCost');
        if (availableLabel) availableLabel.textContent = formatInt(available);
        if (addedLabel) addedLabel.textContent = formatInt(addedSillons);
        if (costLabel) costLabel.textContent = money(sillonCost);
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
      `).join('') : '<div class="station-suggest-empty">Aucune gare trouvée.</div>';
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


// ===== 09-map-rendering.js =====
// Rendu carte, tracés, trains, gares et interactions de base.
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

function scheduleMobileMapViewportFix() {
  const section = document.querySelector('.map-section');
  const holder = document.querySelector('#osmMap');
  if (!section || !holder) return;
  const run = () => {
    if (window.matchMedia?.('(max-width: 1100px)')?.matches) {
      section.classList.remove('hidden-by-layout');
      section.style.removeProperty('display');
      const height = holder.getBoundingClientRect().height;
      if (height < 260) holder.style.minHeight = '300px';
    }
    resizeCanvas();
    scheduleLeafletInvalidateSize();
  };
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });
  window.setTimeout(run, 180);
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


function requestMapRedraw(options = {}) {
  if (app.map.redrawRaf) return;
  app.map.redrawRaf = true;
  requestAnimationFrame(() => {
    app.map.redrawRaf = false;
    drawMap({ lite: !!options.lite });
    app.map.lastFullDrawAt = performance.now();
  });
}


function drawLoop(timestamp = performance.now()) {
  if (document.hidden) {
    app.map.lastDrawAt = timestamp;
    requestAnimationFrame(drawLoop);
    return;
  }

  const moving = app.map.navigating;
  const markerDelay = moving ? 16 : 33;
  if (timestamp - Number(app.map.lastTrainMarkerSyncAt || 0) >= markerDelay) {
    syncTrainMarkerLayer();
    updateFollowedTrainPosition();
    app.map.lastTrainMarkerSyncAt = timestamp;
  }

  const fullDelay = moving ? 120 : 1000;
  if (!app.map.redrawRaf && timestamp - Number(app.map.lastFullDrawAt || 0) >= fullDelay) {
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
  const trainDrawQueue = drawAllLines(ctx, lite) || [];
  drawStations(ctx, lite);
  syncTrainMarkerLayer(trainDrawQueue);
  updateFollowedTrainPosition();
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
  if (!lite) app.map.lineHit = [];
  const trainDrawQueue = [];
  const players = app.state.players || [];
  const me = app.state.me || null;
  const focusedLineId = app.focusedLineId && me?.lines?.some(l => l.id === app.focusedLineId && l.active) ? app.focusedLineId : '';
  if (app.focusedLineId && !focusedLineId) clearFocusedLine();

  const drawLinesForPlayer = (player, own = false) => {
    if (!player) return;
    for (const line of player.lines || []) {
      if (!line.active) continue;
      if (focusedLineId && (!own || line.id !== focusedLineId)) continue;
      const routeProfile = routeProfileForLineClient(line, player);
      const route = getRouteForStops(lineStopsOf(line), { profile: routeProfile });
      if (!route.points.length) continue;
      if (!lite) registerLineHitTarget(player, line, route.points, own);

      drawRailLine(ctx, route.points, player.color, own, line.electrified, lite, focusedLineId === line.id);

      // Les trains des lignes affichées restent visibles à tous les niveaux de
      // zoom ; sinon les circulations semblent disparaitre de la carte.

      const trains = lineAssignedTrainsClient(line, player)
        .filter(t => !t.construction?.active && !t.maintenance?.active && Number(t.condition || 0) > 0);
      if (!trains.length) continue;

      // Les états de pénurie masquent seulement les trains concurrents.
      // Le joueur connecté doit toujours voir son exploitation et son animation.
      if (!own && (
        line.stats?.status === 'resource-shortage'
        || line.stats?.status === 'driver-shortage'
        || line.stats?.status === 'construction'
        || line.stats?.status === 'train-out-of-service'
      )) continue;

      const visualLine = visualLineWithEffectiveFrequency(line);
      const visualRoute = { ...route, coords: route.coords || [], speedProfile: route.speedProfile || line.speedProfile || null };
      const speeds = trains.map(train => {
        const model = app.state.balance.trains[train.modelId];
        return model ? trainVisualAverageSpeedKmH(train, model, visualLine, visualRoute) : 0;
      }).filter(speed => speed > 0);
      const averageSpeed = speeds.length ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 70;

      trains.forEach((train, index) => {
        const model = app.state.balance.trains[train.modelId];
        if (!model) return;
        trainDrawQueue.push({
          points: route.points,
          color: player.color,
          line: { ...visualLine, id: `${player.id}:${line.id}`, sourceLineId: line.id, visualAverageSpeed: averageSpeed },
          model,
          own,
          playerId: player.id,
          playerName: player.name,
          train,
          instanceIndex: index,
          instanceCount: trains.length,
          route: visualRoute
        });
      });
    }
  };

  if (!focusedLineId && app.showOtherLines) {
    for (const player of players) {
      if (me && player.id === me.id) continue;
      drawLinesForPlayer(player, false);
    }
  }
  drawLinesForPlayer(me, true);
  drawLineDraftPreview(ctx, lite);
  app.map.trainMarkerJobs = trainDrawQueue;
  return trainDrawQueue;
}

function drawLineDraftPreview(ctx, lite = false) {
  if (app.activeTab !== 'lines' || app.activeLinesSubtab !== 'create') return;
  const stops = buildLineDraftStops();
  if (!Array.isArray(stops) || stops.length < 2) return;
  const profile = routeProfileForDraftClient();
  const route = getRouteForStops(stops, { profile });
  let points = Array.isArray(route.points) && route.points.length >= 2 ? route.points : [];
  if (!points.length) {
    points = stops.map(pointFromStationId).filter(Boolean);
  }
  if (points.length < 2) return;
  drawDraftRailLine(ctx, points, lite, route.pending);
  if (!lite) drawDraftStopMarkers(ctx, stops);
}

function drawDraftRailLine(ctx, points, lite = false, pending = false) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalAlpha = pending ? 0.66 : 0.95;
  ctx.setLineDash([14, 9]);
  ctx.strokeStyle = 'rgba(4, 8, 16, 0.92)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.strokeStyle = pending ? 'rgba(251, 191, 36, 0.72)' : '#facc15';
  ctx.lineWidth = 5.2;
  ctx.shadowColor = 'rgba(250, 204, 21, 0.72)';
  ctx.shadowBlur = lite ? 0 : 18;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
}

function drawDraftStopMarkers(ctx, stops) {
  ctx.save();
  ctx.font = '11px "Trebuchet MS", system-ui';
  stops.forEach((id, index) => {
    const point = pointFromStationId(id);
    if (!point) return;
    ctx.fillStyle = 'rgba(4, 8, 16, 0.95)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, index === 0 || index === stops.length - 1 ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}


function registerLineHitTarget(player, line, points, own = false) {
  if (!line?.id || !Array.isArray(points) || points.length < 2) return;
  app.map.lineHit.push({
    playerId: player?.id || '',
    playerName: player?.name || '',
    lineId: line.id,
    lineName: linePublicName(line),
    own: !!own,
    points
  });
}

function pointSegmentDistance(p, a, b) {
  const ax = Number(a?.x);
  const ay = Number(a?.y);
  const bx = Number(b?.x);
  const by = Number(b?.y);
  if (![p.x, p.y, ax, ay, bx, by].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - ax, p.y - ay);
  const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (ax + t * dx), p.y - (ay + t * dy));
}

function lineHitDistance(p, target) {
  const points = target?.points || [];
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i += 1) {
    const distance = pointSegmentDistance(p, points[i - 1], points[i]);
    if (distance < best) best = distance;
  }
  return best;
}

function hitLineAt(p, maxDistance = null) {
  const zoom = app.map.leaflet?.getZoom?.() || 7;
  const threshold = Number.isFinite(maxDistance) ? maxDistance : Math.max(9, Math.min(18, 21 - zoom));
  return (app.map.lineHit || [])
    .map((target, index) => ({ ...target, index, d: lineHitDistance(p, target) }))
    .filter(target => target.d <= threshold)
    .sort((a, b) => {
      if (a.own !== b.own) return a.own ? -1 : 1;
      if (a.d !== b.d) return a.d - b.d;
      return b.index - a.index;
    })[0] || null;
}

function selectMapLine(hit) {
  if (!hit?.lineId) return;
  if (!hit.own) {
    toast(`Ligne de ${hit.playerName || 'autre joueur'} : ${hit.lineName || hit.lineId}.`, 'info');
    return;
  }
  focusLineOnMap(hit.lineId, { fit: false, toggle: true });
}

function drawRailLine(ctx, points, color, own, electrified, lite = false, highlighted = false) {
  if (!points?.length) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = highlighted ? 1 : (own ? 0.96 : 0.68);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);

  // sleeper/shadow pass
  ctx.strokeStyle = 'rgba(10, 15, 24, 0.85)';
  ctx.lineWidth = highlighted ? 13 : (own ? 8 : 6);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  // main rail pass
  ctx.strokeStyle = color || '#d9a852';
  ctx.lineWidth = highlighted ? 6.4 : (own ? 4 : 2.8);
  ctx.shadowColor = color || 'rgba(236, 205, 127, 0.25)';
  ctx.shadowBlur = lite ? 0 : (highlighted ? 18 : (own ? 8 : 3));
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

const TRAIN_REALTIME_SECONDS_PER_TRAVEL_HOUR = 3600;
const TRAIN_DWELL_SECONDS_PER_SERVED_STOP = 60;
const TRAIN_MOTION_PLAN_CACHE_MAX_ENTRIES = 900;

function trainVisualConditionMultiplier(train) {
  const condition = Math.max(0.35, Math.min(1, Number(train?.condition ?? 0.9)));
  return 0.76 + condition * 0.24;
}

function trainVisualEffectiveMaxSpeedKmH(train, model) {
  const profile = train ? trainRuntimeProfile(train, model) : {};
  const maxSpeed = Number(profile.speed || model?.speed || 90);
  // `train.profile.speed` est déjà corrigée côté serveur de l'état et de la
  // composition. La pénaliser une seconde fois désynchronisait la carte.
  return Math.max(5, maxSpeed);
}

function trainVisualAverageSpeedKmH(train, model, line, route = null) {
  const speedProfile = route?.speedProfile || line?.speedProfile || null;
  const maxSpeed = trainVisualEffectiveMaxSpeedKmH(train, model);
  if (speedProfile?.segments?.length) {
    let distanceKm = 0;
    let durationHours = 0;
    for (const segment of speedProfile.segments) {
      const segmentDistance = Math.max(0, Number(segment.distanceKm || (Number(segment.toKm) - Number(segment.fromKm)) || 0));
      const trackSpeed = Math.max(5, Number(segment.speedKmh || speedProfile.averageSpeedKmh || 100));
      const effectiveSpeed = Math.max(8, Math.min(maxSpeed, trackSpeed));
      distanceKm += segmentDistance;
      durationHours += segmentDistance / effectiveSpeed;
    }
    if (distanceKm > 0 && durationHours > 0) return Math.max(18, distanceKm / durationHours);
  }

  const profile = train ? trainRuntimeProfile(train, model) : {};
  const legacyMaxSpeed = Number(profile.speed || model?.speed || 90);
  return Math.max(5, legacyMaxSpeed);
}

function trainVisualOneWaySeconds(line, train, model, route = null) {
  const distanceKm = trainVisualRouteDistanceKm(line, route);
  const speedProfile = route?.speedProfile || line?.speedProfile || null;
  const dwellSeconds = trainVisualDwellSecondsForLine(line);
  if (speedProfile?.segments?.length) {
    const maxSpeed = trainVisualEffectiveMaxSpeedKmH(train, model);
    const durationHours = speedProfile.segments.reduce((sum, segment) => {
      const segmentDistance = Math.max(0, Number(segment.distanceKm || (Number(segment.toKm) - Number(segment.fromKm)) || 0));
      const trackSpeed = Math.max(5, Number(segment.speedKmh || speedProfile.averageSpeedKmh || 100));
      return sum + segmentDistance / Math.max(8, Math.min(maxSpeed, trackSpeed));
    }, 0);
    if (durationHours > 0) return durationHours * TRAIN_REALTIME_SECONDS_PER_TRAVEL_HOUR + dwellSeconds;
  }
  const averageSpeed = Number(line?.visualAverageSpeed || 0) > 0
    ? Number(line.visualAverageSpeed)
    : trainVisualAverageSpeedKmH(train, model, line, route);
  const travelHours = distanceKm / Math.max(1, averageSpeed);
  return travelHours * TRAIN_REALTIME_SECONDS_PER_TRAVEL_HOUR + dwellSeconds;
}

function trainVisualInstanceCount(line) {
  return Math.max(1, Math.round(Number(line?.slotUsage?.used || line?.trainCount || 1)));
}

function speedProfileSegmentAtKm(speedProfile, km) {
  const segments = speedProfile?.segments || [];
  if (!segments.length) return null;
  const value = Number(km) || 0;
  for (const segment of segments) {
    if (value >= Number(segment.fromKm || 0) && value <= Number(segment.toKm || 0)) return segment;
  }
  return value < Number(segments[0].fromKm || 0) ? segments[0] : segments[segments.length - 1];
}

function trainVisualSpeedAtKm(line, train, model, route, km) {
  const speedProfile = route?.speedProfile || line?.speedProfile || null;
  const maxSpeed = trainVisualEffectiveMaxSpeedKmH(train, model);
  if (speedProfile?.segments?.length) {
    const segment = speedProfileSegmentAtKm(speedProfile, km);
    const trackSpeed = Math.max(5, Number(segment?.speedKmh || speedProfile.averageSpeedKmh || 100));
    return Math.max(8, Math.min(maxSpeed, trackSpeed));
  }
  return trainVisualAverageSpeedKmH(train, model, line, route);
}

function trainVisualRouteDistanceKm(line, route) {
  const value = Number(route?.speedProfile?.totalKm || route?.distance || lineDistance(line) || 1);
  return Math.max(1, Number.isFinite(value) ? value : 1);
}

function trainVisualDwellSecondsForStop(line, stopIndex) {
  const stops = lineStopsOf(line);
  const cadence = typeof lineCadenceClient === 'function' ? lineCadenceClient(line) : null;
  const isTerminus = stopIndex === 0 || stopIndex === stops.length - 1;
  const minutes = isTerminus
    ? Number(cadence?.turnaroundMinutes || 8)
    : Number(cadence?.dwellMinutes || 3);
  return Math.max(0, minutes * 60);
}

function trainVisualDwellSecondsForLine(line) {
  // Demande explicite : 1 minute d'arrêt dans chacune des gares desservies.
  return lineStopsOf(line).reduce((sum, _stop, index) => sum + trainVisualDwellSecondsForStop(line, index), 0);
}

function trainVisualCommercialSpeedFactor(line, legDistanceKm) {
  return 1;
}

function positiveModulo(value, modulo) {
  if (!Number.isFinite(value) || !Number.isFinite(modulo) || modulo <= 0) return 0;
  return ((value % modulo) + modulo) % modulo;
}

function closestProgressOnPolyline(point, points, minT = 0, maxT = 1) {
  if (!point || !points?.length) return null;
  const { segments, total } = polylineMetrics(points);
  if (!Number.isFinite(total) || total <= 0) return null;
  const safeMinT = clamp(Number(minT) || 0, 0, 1);
  const safeMaxT = clamp(Number(maxT) || 1, safeMinT, 1);
  let walked = 0;
  let best = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = segments[i - 1]?.len || Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= 0) continue;
    const startT = walked / total;
    const endT = (walked + len) / total;
    walked += len;
    if (endT < safeMinT - 0.035 || startT > safeMaxT + 0.035) continue;
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const ratio = clamp(((point.x - a.x) * vx + (point.y - a.y) * vy) / (len * len), 0, 1);
    const rawT = (walked - len + len * ratio) / total;
    const t = clamp(rawT, safeMinT, safeMaxT);
    const candidate = pointAlongPolyline(points, t);
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    const orderPenalty = Math.abs(t - rawT) * 260;
    const score = distance + orderPenalty;
    if (!best || score < best.score) best = { t, distance, score };
  }
  return best;
}

function geoPolylineMetrics(coords) {
  const line = validRouteCoords(coords);
  const segments = [];
  let total = 0;
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1];
    const b = line[i];
    const len = haversineClient(a[1], a[0], b[1], b[0]);
    total += Math.max(0, len);
    segments.push({ len, total });
  }
  return { line, segments, total };
}

function closestProgressOnGeoPolyline(point, coords, minT = 0, maxT = 1) {
  if (!point || !Number.isFinite(point.lon) || !Number.isFinite(point.lat)) return null;
  const { line, segments, total } = geoPolylineMetrics(coords);
  if (line.length < 2 || !Number.isFinite(total) || total <= 0) return null;

  const safeMinT = clamp(Number(minT) || 0, 0, 1);
  const safeMaxT = clamp(Number(maxT) || 1, safeMinT, 1);
  const lat0 = Number(point.lat) * Math.PI / 180;
  const cosLat = Math.max(0.08, Math.cos(lat0));
  const toLocal = ([lon, lat]) => ({
    x: (Number(lon) - Number(point.lon)) * cosLat * 111.32,
    y: (Number(lat) - Number(point.lat)) * 110.57
  });

  let walked = 0;
  let best = null;
  for (let i = 1; i < line.length; i += 1) {
    const aGeo = line[i - 1];
    const bGeo = line[i];
    const len = segments[i - 1]?.len || haversineClient(aGeo[1], aGeo[0], bGeo[1], bGeo[0]);
    if (len <= 0) continue;
    const startT = walked / total;
    const endT = (walked + len) / total;
    walked += len;
    if (endT < safeMinT - 0.035 || startT > safeMaxT + 0.035) continue;

    const a = toLocal(aGeo);
    const b = toLocal(bGeo);
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const denom = vx * vx + vy * vy;
    const ratio = denom > 0 ? clamp(((-a.x) * vx + (-a.y) * vy) / denom, 0, 1) : 0;
    const rawT = (walked - len + len * ratio) / total;
    const t = clamp(rawT, safeMinT, safeMaxT);
    const candidateKm = t * total;
    const localX = a.x + vx * ratio;
    const localY = a.y + vy * ratio;
    const distance = Math.hypot(localX, localY);
    const orderPenalty = Math.abs(t - rawT) * Math.max(3, total * 0.02);
    const score = distance + orderPenalty;
    if (!best || score < best.score) best = { t, km: candidateKm, distance, score };
  }
  return best;
}

function trainVisualStopPositionsKm(line, route, points, totalKm) {
  const ids = lineStopsOf(line);
  if (ids.length < 2) return [0, totalKm];
  const positions = [];
  const minGapKm = Math.min(0.25, Math.max(0.03, totalKm * 0.00025));
  const minGapT = Math.min(0.0025, Math.max(0.00002, minGapKm / Math.max(1, totalKm)));
  let previousT = 0;
  for (let i = 0; i < ids.length; i++) {
    if (i === 0) {
      positions.push(0);
      previousT = 0;
      continue;
    }
    if (i === ids.length - 1) {
      positions.push(totalKm);
      previousT = 1;
      continue;
    }
    const remaining = ids.length - 1 - i;
    const minT = Math.min(0.995, previousT + minGapT);
    const maxT = Math.max(minT, 1 - remaining * minGapT);
    const fallbackT = i / Math.max(1, ids.length - 1);
    const s = station(ids[i]);
    let t = fallbackT;
    const lon = stationRouteLon(s);
    const lat = stationRouteLat(s);
    if ([lon, lat].every(Number.isFinite) && Array.isArray(route?.coords) && route.coords.length >= 2) {
      const nearest = closestProgressOnGeoPolyline({ lon, lat }, route.coords, minT, maxT);
      if (nearest && Number.isFinite(nearest.t)) t = nearest.t;
    } else if ([lon, lat].every(Number.isFinite) && points?.length) {
      // Fallback hors Leaflet : utilisé seulement si la route n'a pas encore de
      // coordonnées géographiques. Le chemin normal ne dépend plus de l'écran.
      const projectedStation = project(lon, lat);
      const nearest = closestProgressOnPolyline(projectedStation, points, minT, maxT);
      if (nearest && Number.isFinite(nearest.t)) t = nearest.t;
    }
    t = clamp(t, minT, maxT);
    positions.push(Math.max(0, Math.min(totalKm, t * totalKm)));
    previousT = t;
  }
  return positions;
}

function trainMotionPlanCacheKey(line, train, model, route, points, totalKm) {
  const speedProfile = route?.speedProfile || line?.speedProfile || null;
  const speedSig = speedProfile?.segments?.length
    ? `${Math.round(Number(speedProfile.totalKm || totalKm) * 1000)}:${speedProfile.coverage || 0}:${speedProfile.minSpeedKmh || ''}:${speedProfile.maxSpeedKmh || ''}:${speedProfile.segments.length}`
    : 'no-speed-profile';
  const coords = validRouteCoords(route?.coords || []);
  const c0 = coords[0] || null;
  const c1 = coords[coords.length - 1] || null;
  const coordSig = coords.length
    ? `${coords.length}:${Math.round(c0[0] * 100000)}:${Math.round(c0[1] * 100000)}:${Math.round(c1[0] * 100000)}:${Math.round(c1[1] * 100000)}`
    : `screen-fallback:${points?.length || 0}`;
  const conditionSig = Math.round((Number(train?.condition ?? 1) || 1) * 1000);
  return `${line.id}:${train?.id || 'train'}:${model?.id || train?.modelId || ''}:${conditionSig}:${Math.round(totalKm * 1000)}:${speedSig}:${lineStopsOf(line).join('>')}:${coordSig}`;
}

function appendTrainRunEvents(events, line, train, model, route, fromKm, toKm, elapsedSeconds, speedScale = 1) {
  let currentKm = Math.max(0, Math.min(fromKm, toKm));
  const targetKm = Math.max(fromKm, toKm);
  let elapsed = elapsedSeconds;
  let guard = 0;
  while (currentKm < targetKm - 0.0001 && guard++ < 20000) {
    const segment = speedProfileSegmentAtKm(route?.speedProfile || line?.speedProfile || null, currentKm + 0.00005);
    let nextBoundary = Number(segment?.toKm || targetKm);
    if (!Number.isFinite(nextBoundary) || nextBoundary <= currentKm + 0.0001) nextBoundary = targetKm;
    const nextKm = Math.min(targetKm, Math.max(currentKm + 0.0001, nextBoundary));
    const rawSpeedKmh = trainVisualSpeedAtKm(line, train, model, route, currentKm + (nextKm - currentKm) / 2);
    const speedKmh = Math.max(5, rawSpeedKmh * Math.max(0.1, Number(speedScale || 1)));
    const durationSeconds = ((nextKm - currentKm) / Math.max(5, speedKmh)) * TRAIN_REALTIME_SECONDS_PER_TRAVEL_HOUR;
    if (durationSeconds > 0.0001) {
      events.push({
        type: 'run',
        fromKm: currentKm,
        toKm: nextKm,
        startSec: elapsed,
        endSec: elapsed + durationSeconds,
        speedKmh
      });
      elapsed += durationSeconds;
    }
    currentKm = nextKm;
  }
  return elapsed;
}

function buildTrainMotionPlan(line, train, model, route, points) {
  const totalKm = trainVisualRouteDistanceKm(line, route);
  const key = trainMotionPlanCacheKey(line, train, model, route, points, totalKm);
  const cache = app.map.trainMotionPlans || (app.map.trainMotionPlans = new Map());
  const cached = cache.get(key);
  if (cached) return cached;

  const stopPositions = trainVisualStopPositionsKm(line, route, points, totalKm);
  const events = [];
  let elapsed = 0;
  let dwellTotalSeconds = 0;
  for (let i = 0; i < stopPositions.length; i++) {
    const km = Math.max(0, Math.min(totalKm, Number(stopPositions[i]) || 0));
    const dwellSeconds = trainVisualDwellSecondsForStop(line, i);
    dwellTotalSeconds += dwellSeconds;
    events.push({
      type: 'dwell',
      fromKm: km,
      toKm: km,
      startSec: elapsed,
      endSec: elapsed + dwellSeconds,
      speedKmh: 0,
      stopIndex: i
    });
    elapsed += dwellSeconds;
    if (i < stopPositions.length - 1) {
      const nextKm = Math.max(km, Math.min(totalKm, Number(stopPositions[i + 1]) || totalKm));
      const legDistanceKm = Math.max(0, nextKm - km);
      const speedScale = trainVisualCommercialSpeedFactor(line, legDistanceKm);
      elapsed = appendTrainRunEvents(events, line, train, model, route, km, nextKm, elapsed, speedScale);
    }
  }

  const plan = {
    key,
    totalKm,
    oneWaySeconds: Math.max(1, elapsed),
    roundTripSeconds: Math.max(2, elapsed * 2),
    stopCount: stopPositions.length,
    dwellSeconds: dwellTotalSeconds,
    events
  };
  cache.set(key, plan);
  while (cache.size > TRAIN_MOTION_PLAN_CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  return plan;
}

function trainMotionAtOneWaySecond(plan, second) {
  const value = Math.max(0, Math.min(Number(second) || 0, Number(plan?.oneWaySeconds || 0)));
  const events = plan?.events || [];
  for (const event of events) {
    if (value >= Number(event.startSec || 0) && value <= Number(event.endSec || 0)) {
      if (event.type === 'dwell') return { positionKm: Number(event.fromKm || 0), speedKmh: 0, dwell: true };
      const duration = Math.max(0.0001, Number(event.endSec || 0) - Number(event.startSec || 0));
      const ratio = clamp((value - Number(event.startSec || 0)) / duration, 0, 1);
      return {
        positionKm: Number(event.fromKm || 0) + (Number(event.toKm || 0) - Number(event.fromKm || 0)) * ratio,
        speedKmh: Number(event.speedKmh || 0),
        dwell: false
      };
    }
  }
  return { positionKm: Number(plan?.totalKm || 0), speedKmh: 0, dwell: true };
}

function trainVisualLegPositionAtRatio(line, train, model, route, fromKm, toKm, ratio) {
  const targetRatio = clamp(Number(ratio || 0), 0, 1);
  const direction = toKm >= fromKm ? 1 : -1;
  const targetKm = toKm;
  let currentKm = fromKm;
  const slices = [];
  let totalSeconds = 0;
  let guard = 0;
  while ((direction > 0 ? currentKm < targetKm - 0.0001 : currentKm > targetKm + 0.0001) && guard++ < 20000) {
    const probe = currentKm + direction * 0.00005;
    const segment = speedProfileSegmentAtKm(route?.speedProfile || line?.speedProfile || null, probe);
    let boundary = direction > 0 ? Number(segment?.toKm || targetKm) : Number(segment?.fromKm || targetKm);
    if (!Number.isFinite(boundary) || (direction > 0 ? boundary <= currentKm + 0.0001 : boundary >= currentKm - 0.0001)) boundary = targetKm;
    const nextKm = direction > 0
      ? Math.min(targetKm, Math.max(currentKm + 0.0001, boundary))
      : Math.max(targetKm, Math.min(currentKm - 0.0001, boundary));
    const speedKmh = Math.max(5, trainVisualSpeedAtKm(line, train, model, route, (currentKm + nextKm) / 2));
    const durationSeconds = Math.abs(nextKm - currentKm) / speedKmh * TRAIN_REALTIME_SECONDS_PER_TRAVEL_HOUR;
    slices.push({ fromKm: currentKm, toKm: nextKm, speedKmh, durationSeconds });
    totalSeconds += durationSeconds;
    currentKm = nextKm;
  }
  if (!slices.length || totalSeconds <= 0) {
    return { positionKm: fromKm + (toKm - fromKm) * targetRatio, speedKmh: trainVisualSpeedAtKm(line, train, model, route, (fromKm + toKm) / 2) };
  }
  let remainingSeconds = totalSeconds * targetRatio;
  for (const slice of slices) {
    if (remainingSeconds <= slice.durationSeconds) {
      const progress = clamp(remainingSeconds / Math.max(0.0001, slice.durationSeconds), 0, 1);
      return { positionKm: slice.fromKm + (slice.toKm - slice.fromKm) * progress, speedKmh: slice.speedKmh };
    }
    remainingSeconds -= slice.durationSeconds;
  }
  const last = slices[slices.length - 1];
  return { positionKm: last.toKm, speedKmh: last.speedKmh };
}

function trainServerMotion(line, train, model, route, points) {
  const run = train?.passengerRun;
  const sourceLineId = line?.sourceLineId || line?.id;
  if (!run?.started || !run.lineId || run.lineId !== sourceLineId) return null;

  const totalKm = trainVisualRouteDistanceKm(line, route);
  const stops = trainVisualStopPositionsKm(line, route, points, totalKm);
  if (stops.length < 2 || totalKm <= 0) return null;

  const fromIndex = clamp(Math.floor(Number(run.legFromIndex ?? run.stopIndex ?? 0)), 0, stops.length - 1);
  const toIndex = clamp(Math.floor(Number(run.legToIndex ?? (fromIndex + (Number(run.direction || 1) < 0 ? -1 : 1)))), 0, stops.length - 1);
  const direction = toIndex < fromIndex ? -1 : 1;
  const fromKm = Number(stops[fromIndex] || 0);
  const toKm = Number(stops[toIndex] || fromKm);
  const now = typeof serverNow === 'function' ? serverNow() : Date.now();
  const departedAt = Math.max(0, Number(run.departedAt || run.dwellUntil || run.lastStopAt || 0));
  const nextStopAt = Math.max(0, Number(run.nextStopAt || 0));
  const legMs = Math.max(0, Number(run.legMs || nextStopAt - departedAt || 0));
  if (!departedAt || !nextStopAt || nextStopAt <= departedAt || !legMs) return null;

  // Une courte immobilisation rend l'arrivée explicite. Pendant ce créneau,
  // le remplissage et les recettes affichés correspondent visuellement à la gare.
  const dwellUntil = Math.max(0, Number(run.dwellUntil || departedAt));
  if (now <= departedAt) {
    return {
      progress: clamp(fromKm / totalKm, 0, 1),
      reverse: direction < 0,
      speedKmh: 0,
      dwell: true,
      oneWaySeconds: legMs / 1000,
      stopCount: stops.length,
      dwellSeconds: Math.max(0, departedAt - Number(run.lastStopAt || departedAt)) / 1000
    };
  }
  if (now >= nextStopAt) {
    return {
      progress: clamp(toKm / totalKm, 0, 1),
      reverse: direction < 0,
      speedKmh: 0,
      dwell: true,
      oneWaySeconds: legMs / 1000,
      stopCount: stops.length,
      dwellSeconds: Math.max(0, departedAt - Number(run.lastStopAt || departedAt)) / 1000
    };
  }

  const ratio = clamp((now - departedAt) / Math.max(1, nextStopAt - departedAt), 0, 1);
  const legPosition = trainVisualLegPositionAtRatio(line, train, model, route, fromKm, toKm, ratio);
  const positionKm = legPosition.positionKm;
  const speedKmh = legPosition.speedKmh;
  return {
    progress: clamp(positionKm / totalKm, 0, 1),
    reverse: direction < 0,
    speedKmh,
    dwell: false,
    oneWaySeconds: legMs / 1000,
    stopCount: stops.length,
    dwellSeconds: Math.max(0, dwellUntil - Number(run.lastStopAt || dwellUntil)) / 1000
  };
}

function trainMotionCycleSecond(line, train, instanceIndex, instanceCount, cycleSeconds) {
  const trainCount = Math.max(1, Number(instanceCount || 1));
  const seed = (Math.abs(hashCode(`${line?.id || 'line'}:${train?.id || 'train'}`)) % 100000) / 100000;
  const spacing = trainCount > 1 ? (cycleSeconds / trainCount) * Number(instanceIndex || 0) : seed * cycleSeconds;
  const nowSeconds = (typeof serverNow === 'function' ? serverNow() : Date.now()) / 1000;
  return positiveModulo(nowSeconds + spacing + seed * 311, cycleSeconds);
}

function trainMotionFromPlan(plan, totalKm, cycleSecond) {
  const reverse = cycleSecond >= plan.oneWaySeconds;
  const oneWaySecond = reverse ? cycleSecond - plan.oneWaySeconds : cycleSecond;
  const oneWay = trainMotionAtOneWaySecond(plan, oneWaySecond);
  const positionKm = reverse ? totalKm - Number(oneWay.positionKm || 0) : Number(oneWay.positionKm || 0);
  return {
    progress: Math.max(0.001, Math.min(0.999, positionKm / Math.max(0.001, totalKm))),
    reverse,
    speedKmh: Number(oneWay.speedKmh || 0),
    dwell: Boolean(oneWay.dwell),
    oneWaySeconds: plan.oneWaySeconds,
    stopCount: plan.stopCount,
    dwellSeconds: plan.dwellSeconds
  };
}

function trainVisualMotion(line, train, model, route, instanceIndex = 0, instanceCount = 1, points = null) {
  const totalKm = trainVisualRouteDistanceKm(line, route);
  const hasGeoRoute = Array.isArray(route?.coords) && route.coords.length >= 2;
  if (!hasGeoRoute && !points?.length) {
    return { progress: 0.5, reverse: false, speedKmh: 0, dwell: false, oneWaySeconds: 0 };
  }

  const trainCount = Math.max(1, Number(instanceCount || 1));
  if (trainCount <= 1) {
    const serverMotion = trainServerMotion(line, train, model, route, points);
    if (serverMotion) return serverMotion;
  }

  const plan = buildTrainMotionPlan(line, train, model, route, points);
  const cycleSeconds = Math.max(2, Number(plan.roundTripSeconds || plan.oneWaySeconds * 2 || 2));
  const cycleSecond = trainMotionCycleSecond(line, train, instanceIndex, trainCount, cycleSeconds);
  return trainMotionFromPlan(plan, totalKm, cycleSecond);
}


function drawTrainMarkerCanvas(ctx, point, job, pose, lite = false) {
  if (!ctx || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const color = trainMarkerColor(job?.color);
  const motion = pose?.motion || {};
  const speed = motion.dwell ? 0 : Number(motion.speedKmh || job?.line?.visualAverageSpeed || trainVisualAverageSpeedKmH(job?.train, job?.model, job?.line, job?.route) || 0);
  const normalizedSpeed = clamp((speed - 35) / 165, 0, 1);
  const own = !!job?.own;
  const trainCount = Math.max(1, Number(job?.instanceCount || 1));
  const index = Number(job?.instanceIndex || 0);
  const densityShrink = clamp(1 - Math.max(0, trainCount - 1) * 0.025, 0.78, 1);
  const radius = (own ? 7.2 : 5.8) * densityShrink;
  const haloRadius = radius + 4 + normalizedSpeed * 3;
  const angle = (Number(pose?.bearing || 0) - 90) * Math.PI / 180;

  ctx.save();
  ctx.translate(point.x, point.y);

  if (!lite) {
    ctx.save();
    ctx.globalAlpha = motion.dwell ? 0.30 : 0.48;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, haloRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (!motion.dwell && !lite) {
    const trailLength = 10 + normalizedSpeed * 14;
    ctx.save();
    ctx.rotate(angle);
    const gradient = ctx.createLinearGradient(-trailLength - radius, 0, -radius * 0.2, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, color);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-trailLength - radius * 0.2, 0);
    ctx.lineTo(-radius * 0.25, 0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.shadowColor = color;
  ctx.shadowBlur = own ? 13 : 9;
  ctx.fillStyle = '#050a12';
  ctx.beginPath();
  ctx.arc(0, 0, radius + 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(252, 230, 170, .96)';
  ctx.lineWidth = own ? 2.1 : 1.35;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.beginPath();
  ctx.arc(-radius * 0.35, -radius * 0.38, Math.max(1.2, radius * 0.24), 0, Math.PI * 2);
  ctx.fill();

  if (trainCount > 1 && !lite) {
    ctx.fillStyle = 'rgba(3, 8, 14, .96)';
    ctx.font = '700 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), 0, 0.4);
  }
  ctx.restore();
}

function drawTrainMarkersOnCanvas(ctx, jobs = [], lite = false) {
  app.map.trainHit = [];
  if (!ctx || !Array.isArray(jobs) || !jobs.length) {
    clearTrainMarkerLayer();
    return;
  }
  clearTrainMarkerLayer();
  const sorted = [...jobs].sort((a, b) => (a?.own === b?.own ? 0 : a?.own ? 1 : -1));
  for (const job of sorted) {
    const pose = computeTrainMarkerPose(job);
    if (!pose || !Number.isFinite(pose.lat) || !Number.isFinite(pose.lon)) continue;
    const point = project(pose.lon, pose.lat);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    registerTrainHitTarget(job, point, pose);
    drawTrainMarkerCanvas(ctx, point, job, pose, lite);
  }
}

function registerTrainHitTarget(job, point, pose) {
  if (!job?.train?.id || !point) return;
  const radius = job.own ? 18 : 15;
  app.map.trainHit.push({
    playerId: job.playerId || '',
    playerName: job.playerName || '',
    trainId: job.train.id,
    lineId: job.line?.sourceLineId || job.line?.id || '',
    trainName: trainMarkerDisplayName(job),
    lineName: trainMarkerLineLabel(job),
    own: Boolean(job.own),
    point,
    pose,
    job,
    radius
  });
}

function hitTrainAt(point, maxDistance = null) {
  const threshold = Number.isFinite(maxDistance) ? maxDistance : 20;
  return (app.map.trainHit || [])
    .map((target, index) => ({ ...target, index, d: Math.hypot(Number(target.point?.x || 0) - point.x, Number(target.point?.y || 0) - point.y) }))
    .filter(target => target.d <= Math.max(threshold, target.radius || 0))
    .sort((a, b) => {
      if (a.own !== b.own) return a.own ? -1 : 1;
      if (a.d !== b.d) return a.d - b.d;
      return b.index - a.index;
    })[0] || null;
}

function findTrainMapJob(trainId, playerId = '') {
  return (app.map.trainMarkerJobs || []).find(job => (
    String(job?.train?.id || '') === String(trainId || '')
    && (!playerId || String(job?.playerId || '') === String(playerId))
  )) || null;
}

function updateFollowedTrainPosition(force = false) {
  const followed = app.map.followedTrain;
  if (!followed || !app.map.leaflet) return false;
  const job = findTrainMapJob(followed.trainId, followed.playerId);
  if (!job) {
    app.map.followedTrain = null;
    return false;
  }
  const pose = computeTrainMarkerPose(job);
  if (!pose || !Number.isFinite(pose.lat) || !Number.isFinite(pose.lon)) return false;

  const now = performance.now();
  if (!force && now - Number(app.map.lastFollowCenterAt || 0) < 260) return true;
  const map = app.map.leaflet;
  const target = [pose.lat, pose.lon];
  const current = map.getCenter?.();
  const distance = current && typeof map.distance === 'function' ? map.distance(current, target) : Number.POSITIVE_INFINITY;
  const threshold = Math.max(250, Number(map.getBounds?.()?.getNorthEast?.().distanceTo?.(map.getBounds?.()?.getSouthWest?.()) || 0) * 0.12);
  if (!force && Number.isFinite(distance) && distance < threshold) return true;

  app.map.lastFollowCenterAt = now;
  app.map.followingProgrammatically = true;
  try {
    const zoom = force ? Math.max(8, Number(map.getZoom?.() || 8)) : Number(map.getZoom?.() || 8);
    map.setView(target, zoom, { animate: false, noMoveStart: true });
  } finally {
    requestAnimationFrame(() => { app.map.followingProgrammatically = false; });
  }
  return true;
}

function followTrainOnMap(trainId, playerId = app.state?.me?.id || '') {
  const job = findTrainMapJob(trainId, playerId);
  if (!job) {
    toast('Ce train n’est pas actuellement visible sur une ligne active.', 'error');
    return;
  }
  app.map.followedTrain = { trainId: job.train.id, playerId: job.playerId || playerId };
  app.hoverTrain = null;
  $('#osmMap')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  updateFollowedTrainPosition(true);
  updateTrainMarkerPositions();
  syncMaintenanceTrainMapSelection({ reveal: true });
  toast(`Suivi du train : ${trainMarkerDisplayName(job)} - ${trainMarkerLineLabel(job)}. Clique hors d'un train pour arreter le suivi.`, 'info');
  return;
  /*
  toast(`Suivi activé : ${trainMarkerDisplayName(job)} · ${trainMarkerLineLabel(job)}. Clique hors d'un train pour l'arrêter.`, 'info');
  return;
  toast(`Suivi activé : ${job.model?.name || 'train'}. Clique hors d’un train pour l’arrêter.`, 'info');
  */
}

function stopFollowingTrain() {
  if (!app.map.followedTrain) return;
  app.map.followedTrain = null;
  updateTrainMarkerPositions();
  syncMaintenanceTrainMapSelection();
}

function syncMaintenanceTrainMapSelection({ reveal = false, rerendered = false } = {}) {
  const selectedId = selectedOwnedMapTrainId();
  let selectedCard = null;
  for (const card of document.querySelectorAll('.maintenance-train-card[data-train-id]')) {
    const active = selectedId && card.dataset.trainId === selectedId;
    card.classList.toggle('map-selected', Boolean(active));
    card.setAttribute('aria-selected', active ? 'true' : 'false');
    if (active) selectedCard = card;
  }
  if (reveal && selectedId && !selectedCard && !rerendered && app.activeTab === 'fleet' && app.activeFleetSubtab === 'maintenance') {
    renderAll();
    requestAnimationFrame(() => syncMaintenanceTrainMapSelection({ reveal: true, rerendered: true }));
    return;
  }
  if (reveal && selectedCard) {
    try { selectedCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch {}
  }
}


function ensureTrainMarkerLayer() {
  const container = app.map.leaflet?.getContainer?.() || $('#osmMap');
  if (!container) return null;

  // Les versions 69.1.6/69.1.8 ont laissé deux systèmes concurrents :
  // - un overlay DOM historique ;
  // - un pane Leaflet natif inséré dans .leaflet-map-pane.
  // Le pane Leaflet restait prisonnier du stacking-context de Leaflet, qui est
  // placé sous le canvas #map. Les pastilles pouvaient donc passer sous les
  // tracés. On revient à un overlay DOM unique, sibling direct du canvas, au
  // z-index supérieur, et on projette explicitement en coordonnées container.
  for (const selector of ['#sillonsTrainLayer', '.leaflet-sillonsTrainPane-pane', '.sillons-train-pane']) {
    for (const obsolete of Array.from(container.querySelectorAll?.(selector) || [])) {
      if (obsolete.id === 'sillonsTrainOverlay') continue;
      try { obsolete.remove(); } catch {}
    }
  }

  if (app.map.trainMarkerLayer && app.map.trainMarkerLayer.nodeType === 1 && app.map.trainMarkerLayer.id === 'sillonsTrainOverlay') {
    return app.map.trainMarkerLayer;
  }

  let layer = container.querySelector?.('#sillonsTrainOverlay');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'sillonsTrainOverlay';
    container.appendChild(layer);
  }
  layer.className = 'sillons-train-overlay';
  layer.style.zIndex = '950';
  layer.style.pointerEvents = 'none';
  app.map.trainMarkerLayer = layer;
  app.map.trainMarkerPaneReady = true;
  return layer;
}

function trainMarkerKey(job) {
  const lineId = String(job?.line?.id || 'line');
  const trainId = String(job?.train?.id || job?.train?.modelId || 'train');
  return `${lineId}:${trainId}:${Number(job?.instanceIndex || 0)}`;
}

function validRouteCoords(coords) {
  return (Array.isArray(coords) ? coords : [])
    .map(pair => [Number(pair?.[0]), Number(pair?.[1])])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
}

function bearingDegreesBetweenCoords(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  const lat1 = Number(a[1]) * Math.PI / 180;
  const lat2 = Number(b[1]) * Math.PI / 180;
  const dLon = (Number(b[0]) - Number(a[0])) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const deg = Math.atan2(y, x) * 180 / Math.PI;
  return Number.isFinite(deg) ? deg : 0;
}

function trainGeoPoseAlongCoords(coords, progress) {
  const line = validRouteCoords(coords);
  if (!line.length) return null;
  if (line.length === 1) return { lat: line[0][1], lon: line[0][0], bearing: 0 };

  const targetT = clamp(Number(progress) || 0, 0, 1);
  let total = 0;
  const lengths = [];
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1];
    const b = line[i];
    const len = haversineClient(a[1], a[0], b[1], b[0]);
    lengths.push(len);
    total += Math.max(0, len);
  }
  if (!Number.isFinite(total) || total <= 0) {
    return { lat: line[0][1], lon: line[0][0], bearing: bearingDegreesBetweenCoords(line[0], line[1]) };
  }

  const targetKm = total * targetT;
  let walked = 0;
  for (let i = 1; i < line.length; i += 1) {
    const len = Math.max(0, lengths[i - 1] || 0);
    if (walked + len >= targetKm || i === line.length - 1) {
      const ratio = len > 0 ? clamp((targetKm - walked) / len, 0, 1) : 0;
      const a = line[i - 1];
      const b = line[i];
      return {
        lat: a[1] + (b[1] - a[1]) * ratio,
        lon: a[0] + (b[0] - a[0]) * ratio,
        bearing: bearingDegreesBetweenCoords(a, b)
      };
    }
    walked += len;
  }
  const last = line[line.length - 1];
  return { lat: last[1], lon: last[0], bearing: bearingDegreesBetweenCoords(line[line.length - 2], last) };
}

function trainMarkerColor(color) {
  const raw = String(color || '#d9a852').trim();
  return /^#[0-9a-f]{3,8}$/i.test(raw) ? raw : '#d9a852';
}

function trainShortIdentifier(train) {
  const id = String(train?.id || '').trim();
  if (!id) return '';
  return id.length > 6 ? id.slice(-4).toUpperCase() : id.toUpperCase();
}

function trainMarkerDisplayName(job) {
  const suffix = trainShortIdentifier(job?.train);
  return `${job?.model?.name || job?.train?.modelId || 'Train'}${suffix ? ` #${suffix}` : ''}`;
}

function trainMarkerLineLabel(job) {
  return job?.line?.name || linePublicName(job?.line || {}) || job?.line?.sourceLineId || job?.line?.id || 'Ligne active';
}

function isSameMapTrainSelection(selection, job) {
  return Boolean(selection?.trainId && job?.train?.id
    && String(selection.trainId) === String(job.train.id)
    && (!selection.playerId || String(selection.playerId) === String(job.playerId || '')));
}

function trainMarkerIsFollowed(job) {
  return isSameMapTrainSelection(app.map.followedTrain, job);
}

function trainMarkerIsHovered(job) {
  return isSameMapTrainSelection(app.hoverTrain, job);
}

function selectedOwnedMapTrainId() {
  const followed = app.map?.followedTrain;
  const ownPlayerId = app.state?.me?.id || '';
  return followed?.trainId && (!followed.playerId || followed.playerId === ownPlayerId) ? String(followed.trainId) : '';
}

function trainMarkerTooltipText(job, pose) {
  const motion = pose?.motion || {};
  const speed = motion.dwell ? 0 : Number(motion.speedKmh || 0);
  const speedLabel = speed > 0 ? `${Math.round(speed)} km/h` : 'A l arret';
  const owner = job?.own ? 'Ta compagnie' : (job?.playerName || 'Autre compagnie');
  return `${trainMarkerDisplayName(job)}\n${trainMarkerLineLabel(job)} · ${owner} · ${speedLabel}`;
}

function trainMarkerIconHtml(job, pose) {
  const trainCount = Math.max(1, Number(job?.instanceCount || 1));
  const index = Number(job?.instanceIndex || 0);
  const color = trainMarkerColor(job?.color);
  const motion = pose?.motion || {};
  const speed = motion.dwell ? 0 : Number(motion.speedKmh || job?.line?.visualAverageSpeed || trainVisualAverageSpeedKmH(job?.train, job?.model, job?.line, job?.route) || 0);
  const normalizedSpeed = clamp((speed - 35) / 165, 0, 1);
  const own = !!job?.own;
  const densityShrink = clamp(1 - Math.max(0, trainCount - 1) * 0.025, 0.78, 1);
  const radius = (own ? 7.2 : 5.8) * densityShrink;
  const haloRadius = radius + 4 + normalizedSpeed * 3;
  const label = trainCount > 1 ? String(index + 1) : '';
  const angle = Number(pose?.bearing || 0);
  const dwellClass = motion.dwell ? ' is-dwelling' : '';
  const followedClass = trainMarkerIsFollowed(job) ? ' is-followed' : '';
  const hoverClass = trainMarkerIsHovered(job) ? ' is-hovered' : '';
  const ownClass = own ? ' own' : ' other';
  const tooltip = trainMarkerTooltipText(job, pose);
  const line = trainMarkerLineLabel(job);
  return `<span class="sillons-train-marker${ownClass}${dwellClass}${followedClass}${hoverClass}" style="--train-color:${color};--train-angle:${angle}deg;--train-radius:${radius}px;--train-halo:${haloRadius}px;--train-speed:${normalizedSpeed}">
    <span class="sillons-train-marker__halo"></span>
    <span class="sillons-train-marker__trail"></span>
    <span class="sillons-train-marker__core">${escapeHtml(label)}</span>
    <span class="sillons-train-marker__label"><strong>${escapeHtml(trainMarkerDisplayName(job))}</strong><em>${escapeHtml(line)}</em></span>
    <span class="sr-only">${escapeHtml(tooltip)}</span>
  </span>`;
}

function computeTrainMarkerPose(job) {
  if (!job?.route?.coords?.length || !job.model) return null;
  const motion = trainVisualMotion(job.line, job.train, job.model, job.route, job.instanceIndex, job.instanceCount, job.points);
  const pose = trainGeoPoseAlongCoords(job.route.coords, motion.progress);
  if (!pose || ![pose.lat, pose.lon].every(Number.isFinite)) return null;
  return { ...pose, motion };
}

function trainMarkerCurrentZoomFrame() {
  const frame = app.map.trainMarkerZoomFrame;
  if (!frame || !Number.isFinite(Number(frame.zoom)) || !frame.center) return null;
  const age = performance.now() - Number(frame.at || 0);
  return age < 650 ? frame : null;
}

function trainMarkerNewContainerPoint(map, latLng, frame) {
  if (!map || !frame) return null;
  const zoom = Number(frame.zoom);
  const center = frame.center;
  if (!Number.isFinite(zoom) || !center) return null;
  try {
    // Leaflet._latLngToNewLayerPoint renvoie déjà le point dans le viewport
    // cible du zoom. Les versions précédentes ajoutaient l'offset courant du
    // map-pane, ce qui doublait le décalage pendant les zooms animés.
    if (typeof map._latLngToNewLayerPoint === 'function') {
      const p = map._latLngToNewLayerPoint(latLng, zoom, center);
      const x = Number(p?.x);
      const y = Number(p?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    }
    const projected = map.project?.(latLng, zoom);
    const origin = typeof map._getNewPixelOrigin === 'function' ? map._getNewPixelOrigin(center, zoom) : null;
    const x = Number(projected?.x) - Number(origin?.x);
    const y = Number(projected?.y) - Number(origin?.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  } catch {
    return null;
  }
}

function trainMarkerProjectedPoint(pose, explicitFrame = null) {
  const map = app.map.leaflet;
  if (!pose) return null;
  if (!map) {
    const fallback = project(pose.lon, pose.lat);
    return [fallback?.x, fallback?.y].every(Number.isFinite) ? fallback : null;
  }
  const latLng = [pose.lat, pose.lon];
  const frame = explicitFrame || trainMarkerCurrentZoomFrame();
  if (frame) {
    const zoomPoint = trainMarkerNewContainerPoint(map, latLng, frame);
    if (zoomPoint) return zoomPoint;
  }
  try {
    const point = map.latLngToContainerPoint?.(latLng);
    const x = Number(point?.x);
    const y = Number(point?.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  } catch {
    return null;
  }
}

function trainMarkerSignature(job, pose) {
  return `${trainMarkerColor(job.color)}:${job.own ? 1 : 0}:${job.instanceIndex || 0}:${job.instanceCount || 1}:${pose?.motion?.dwell ? 1 : 0}:${Math.round(Number(pose?.motion?.speedKmh || 0) / 10)}:${Math.round(Number(pose?.bearing || 0) / 2)}:${trainMarkerIsFollowed(job) ? 1 : 0}:${trainMarkerIsHovered(job) ? 1 : 0}`;
}

function applyTrainMarkerElementPosition(el, point, pose, job) {
  if (!el || !point) return;
  const ownBoost = job?.own ? 1000 : 0;
  const selectedBoost = trainMarkerIsFollowed(job) || trainMarkerIsHovered(job) ? 2200 : 0;
  const x = Math.round((Number(point.x) - 22) * 1000) / 1000;
  const y = Math.round((Number(point.y) - 22) * 1000) / 1000;
  el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  el.style.zIndex = String(30000 + ownBoost + selectedBoost + Number(job?.instanceIndex || 0));
  const inner = el.querySelector?.('.sillons-train-marker');
  if (inner) inner.style.setProperty('--train-angle', `${Number(pose?.bearing || 0)}deg`);
}

function syncTrainMarkerLayer(jobs = null, options = {}) {
  const layer = ensureTrainMarkerLayer();
  if (!layer) return;

  const markers = app.map.trainMarkers || (app.map.trainMarkers = new Map());
  if (Array.isArray(jobs)) app.map.trainMarkerJobs = jobs;
  const activeJobs = Array.isArray(jobs) ? jobs : (app.map.trainMarkerJobs || []);
  const frame = options.zoomFrame || trainMarkerCurrentZoomFrame();
  const seen = new Set();
  app.map.trainHit = [];
  layer.classList.toggle('is-navigating', !!app.map.navigating);

  for (const job of activeJobs) {
    const pose = computeTrainMarkerPose(job);
    if (!pose) continue;
    const point = trainMarkerProjectedPoint(pose, frame);
    if (!point) continue;
    registerTrainHitTarget(job, point, pose);

    const key = trainMarkerKey(job);
    const sig = trainMarkerSignature(job, pose);
    seen.add(key);
    const tooltip = trainMarkerTooltipText(job, pose);

    let record = markers.get(key);
    if (!record || !record.el) {
      const el = document.createElement('div');
      el.className = 'sillons-train-marker-icon';
      el.setAttribute('data-train-marker-key', key);
      el.setAttribute('role', 'img');
      el.innerHTML = trainMarkerIconHtml(job, pose);
      layer.appendChild(el);
      record = { el, sig: '' };
      markers.set(key, record);
    }
    record.el.dataset.trainId = String(job?.train?.id || '');
    record.el.dataset.playerId = String(job?.playerId || '');
    record.el.dataset.lineId = String(job?.line?.sourceLineId || job?.line?.id || '');
    record.el.title = tooltip;
    record.el.setAttribute('aria-label', tooltip.replace(/\n+/g, ' · '));

    if (record.sig !== sig) {
      record.el.innerHTML = trainMarkerIconHtml(job, pose);
      record.sig = sig;
    }
    applyTrainMarkerElementPosition(record.el, point, pose, job);
  }

  for (const [key, record] of markers.entries()) {
    if (seen.has(key)) continue;
    try { record.el?.remove?.(); } catch {}
    markers.delete(key);
  }
}

function requestTrainMarkerLayerSync(options = {}) {
  if (options?.zoomFrame) app.map.trainMarkerZoomFrame = { ...options.zoomFrame, at: performance.now() };
  if (options?.immediate) requestMapRedraw({ lite: !!app.map.navigating });
  else updateTrainMarkerPositions();
}

function updateTrainMarkerPositions() {
  if (app.map.trainMarkerRaf) return;
  app.map.trainMarkerRaf = true;
  requestAnimationFrame(() => {
    app.map.trainMarkerRaf = false;
    syncTrainMarkerLayer();
    updateFollowedTrainPosition();
  });
}

function clearTrainMarkerLayer() {
  const markers = app.map.trainMarkers || new Map();
  for (const record of markers.values()) {
    try { record.el?.remove?.(); } catch {}
  }
  markers.clear();
  const layer = app.map.trainMarkerLayer;
  if (layer?.nodeType === 1) {
    try { layer.remove(); } catch { layer.textContent = ''; }
  }
  app.map.trainMarkerLayer = null;
  app.map.trainHit = [];
  const container = app.map.leaflet?.getContainer?.() || $('#osmMap');
  for (const selector of ['#sillonsTrainOverlay', '#sillonsTrainLayer', '.leaflet-sillonsTrainPane-pane', '.sillons-train-pane']) {
    for (const obsolete of Array.from(container?.querySelectorAll?.(selector) || [])) {
      try { obsolete.remove(); } catch {}
    }
  }
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
  const zoom = Number(app.map.leaflet?.getZoom?.() || 6);
  const pop = Number(s.population || s.baseDemand * 450 || 0);
  if (zoom < 6) return pop >= 300000 || s.id === 'PAR';
  if (zoom < 7) return pop >= 150000;
  if (zoom < 8) return pop >= 80000;
  if (zoom < 9) return pop >= 45000;
  if (zoom < 10) return pop >= 25000;
  if (zoom < 11) return pop >= 12000 || !s.commune;
  if (zoom < 12) return pop >= 5000 || !s.commune;
  return true;
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
  if (item.selected) return 8;
  if (item.asset) return 6.5;
  if (item.served) return 5.8;
  return 4.8;
}

function stationHitRadiusForItem(item) {
  // Hitbox resserrée : la gare reste cliquable sur son marqueur,
  // mais elle ne bloque plus abusivement la sélection des lignes proches.
  if (item.selected) return 9;
  if (item.asset) return 7;
  if (item.served) return 6;
  return 5;
}

function stationSquareSizeForItem(item) {
  const zoom = Number(app.map.leaflet?.getZoom?.() || 6);
  if (item.selected) return 12;
  if (item.asset) return zoom >= 11 ? 10 : 9;
  if (item.served) return zoom >= 11 ? 8 : 7;
  return zoom >= 12 ? 6 : zoom >= 10 ? 5 : 4;
}

function drawStationSquareMarker(ctx, item) {
  const { p, asset, selected, served } = item;
  const size = stationSquareSizeForItem(item);
  const half = Math.round(size / 2);
  const x = Math.round(p.x) - half;
  const y = Math.round(p.y) - half;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = selected
    ? 'rgba(250, 204, 21, .55)'
    : asset
      ? 'rgba(217, 168, 82, .34)'
      : 'rgba(15, 23, 42, .30)';
  ctx.shadowBlur = selected ? 10 : asset ? 7 : 3;

  ctx.fillStyle = selected
    ? 'rgba(250, 204, 21, .96)'
    : asset
      ? 'rgba(217, 168, 82, .92)'
      : served
        ? 'rgba(106, 197, 143, .88)'
        : 'rgba(230, 220, 195, .76)';
  ctx.fillRect(x, y, size, size);

  ctx.shadowBlur = 0;
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeStyle = selected
    ? 'rgba(255, 246, 200, .98)'
    : asset
      ? 'rgba(255, 236, 179, .82)'
      : 'rgba(4, 8, 16, .72)';
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, size - 1), Math.max(1, size - 1));
  ctx.restore();
}

function stationMarkerMinDistance(a, b, baseRadius) {
  return Math.max(baseRadius, stationMarkerRadiusForItem(a) + stationMarkerRadiusForItem(b) + 5);
}

function createStationCollisionGrid(cellSize = 48) {
  const cells = new Map();
  const cellForPoint = point => ({ x: Math.floor(point.x / cellSize), y: Math.floor(point.y / cellSize) });
  const keyForCell = (x, y) => `${x}:${y}`;

  return {
    overlaps(item, baseRadius) {
      const cell = cellForPoint(item.p);
      // La distance d'exclusion maximale est inférieure à une cellule. On ne
      // compare donc qu'aux voisins immédiats, au lieu de toutes les gares.
      for (let x = cell.x - 1; x <= cell.x + 1; x += 1) {
        for (let y = cell.y - 1; y <= cell.y + 1; y += 1) {
          for (const other of cells.get(keyForCell(x, y)) || []) {
            const minDistance = stationMarkerMinDistance(item, other, baseRadius);
            if (Math.hypot(item.p.x - other.p.x, item.p.y - other.p.y) < minDistance) return true;
          }
        }
      }
      return false;
    },
    add(item) {
      const cell = cellForPoint(item.p);
      const key = keyForCell(cell.x, cell.y);
      const items = cells.get(key) || [];
      items.push(item);
      cells.set(key, items);
    }
  };
}

function drawableStations(lite = false) {
  const key = stationViewportCacheKey(lite);
  if (app.map.stationDrawCache.key === key) return app.map.stationDrawCache.items;

  const me = app.state.me;
  const servedStationIds = new Set((me?.lines || [])
    .filter(line => line.active)
    .flatMap(line => lineStopsOf(line)));
  const candidates = [];
  const bounds = app.map.leaflet?.getBounds?.();
  const viewport = bounds ? {
    west: bounds.getWest() - 0.18,
    east: bounds.getEast() + 0.18,
    south: bounds.getSouth() - 0.12,
    north: bounds.getNorth() + 0.12
  } : null;

  for (const s of dedupedStations(app.state.world.stations)) {
    const asset = me?.stations?.[s.id];
    const selected = app.selectedStation === s.id;
    const served = servedStationIds.has(s.id);
    if (lite && !selected && !asset && !served) continue;
    if (!shouldDrawStation(s, asset, selected)) continue;
    if (viewport && !selected && !asset) {
      const lat = stationRouteLat(s);
      const lon = stationRouteLon(s);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < viewport.south || lat > viewport.north || lon < viewport.west || lon > viewport.east) continue;
    }
    const p = projectStationPoint(s);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < -40 || p.x > app.map.width + 40 || p.y < -40 || p.y > app.map.height + 40) continue;
    candidates.push({
      s,
      p,
      asset,
      selected,
      served,
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
  const collisionGrid = createStationCollisionGrid();
  for (const item of protectedItems) {
    if (!collisionGrid.overlaps(item, baseRadius)) {
      kept.push(item);
      collisionGrid.add(item);
    }
  }

  for (const item of normalItems) {
    if (!collisionGrid.overlaps(item, baseRadius)) {
      kept.push(item);
      collisionGrid.add(item);
    }
  }

  kept.sort((a, b) => a.priority - b.priority);
  app.map.stationDrawCache = { key, items: kept };
  return kept;
}

function drawStations(ctx, lite = false) {
  if (!lite) app.map.stationHit = [];
  const items = drawableStations(lite);
  const zoomMax = mapMaxZoomReached();

  for (const item of items) {
    const { s, p, asset } = item;

    if (!lite) {
      // Les gares restent cliquables même si elles ne sont pas rendues visuellement.
      app.map.stationHit.push({ id: s.id, x: p.x, y: p.y, r: stationHitRadiusForItem(item) });
    }

    drawStationSquareMarker(ctx, item);

    // Les noms restent réservés au zoom maximal pour éviter de recharger la carte.
    if (!zoomMax || !asset) continue;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.font = '12px "Trebuchet MS", system-ui';
    const label = shortStationName(s.name);
    const labelW = Math.min(170, ctx.measureText(label).width + 12);
    const lx = Math.round(p.x + 8);
    const ly = Math.round(p.y - 10);
    roundRect(ctx, lx, ly, labelW, 17, 7);
    ctx.fillStyle = 'rgba(2,6,23,.86)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(217,168,82,0.30)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(246,236,214,.98)';
    ctx.fillText(label, lx + 6, ly + 12);
    // Le libellé reste visuel uniquement : la hitbox reste centrée sur le marqueur
    // pour éviter qu'un long nom de gare capture les clics destinés aux lignes.
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
    : `Gare libre · accès par sillons de ligne${trafficText}`;
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
  chip(infoX + chipW + 8, contentY + 48, chipW, 'Péage', owner ? 'Actif' : 'Libre');

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
    : 'Achat direct retiré · utilise les sillons d’une ligne';
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
  const trainHit = hitTrainAt(p);
  const stationHit = trainHit ? null : hitStationAt(p);
  const lineHit = trainHit || stationHit ? null : hitLineAt(p);
  const nextTrain = trainHit ? { playerId: trainHit.playerId, trainId: trainHit.trainId } : null;
  const nextStation = stationHit?.id || null;
  const nextLine = lineHit ? { playerId: lineHit.playerId, lineId: lineHit.lineId, own: !!lineHit.own } : null;
  const hoverChanged = app.hoverStation !== nextStation
    || String(app.hoverTrain?.trainId || '') !== String(nextTrain?.trainId || '')
    || String(app.hoverTrain?.playerId || '') !== String(nextTrain?.playerId || '')
    || String(app.hoverLine?.lineId || '') !== String(nextLine?.lineId || '')
    || String(app.hoverLine?.playerId || '') !== String(nextLine?.playerId || '');
  app.hoverTrain = nextTrain;
  app.hoverStation = nextStation;
  app.hoverLine = nextLine;
  if (hoverChanged) {
    updateTrainMarkerPositions();
    requestMapRedraw();
  }
  app.map.canvas.style.cursor = trainHit || stationHit || lineHit ? 'pointer' : 'crosshair';
}

function onMapClick(event) {
  if (app.map.drag.moved) { app.map.drag.moved = false; return; }
  const p = pointer(event);
  const trainHit = hitTrainAt(p);
  if (trainHit) {
    followTrainOnMap(trainHit.trainId, trainHit.playerId);
    return;
  }
  const stationHit = hitStationAt(p) || nearestStationAt(p, 10);
  if (stationHit) {
    setSelectedStation(stationHit.id);
    app.activeTab = 'stations';
    localStorage.setItem('sillons.activeTab', app.activeTab);
    renderAll();
    return;
  }
  const lineHit = hitLineAt(p);
  if (lineHit) selectMapLine(lineHit);
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
  if (app.stationSignatureCache.source === list) return app.stationSignatureCache.signature;
  const ids = stations.map(s => `${s?.id || ''}:${s?.code || s?.communeCode || ''}:${s?.population || 0}`).join('|');
  let hash = 0;
  for (let i = 0; i < ids.length; i += 1) hash = ((hash << 5) - hash + ids.charCodeAt(i)) | 0;
  const communes = app.state?.world?.communesStatus || {};
  const signature = `${stations.length}:${hash}:${ids.length}:${communes.status || ''}:${communes.updatedAt || ''}:${communes.count || 0}`;
  app.stationSignatureCache = { source: list, signature };
  return signature;
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
  const world = app.state?.world || {};
  if (!world.stationIndex && Array.isArray(world.stations)) {
    world.stationIndex = Object.fromEntries(world.stations.map(item => [item.id, item]));
  }
  const found = world.stationIndex?.[id] || dedupedStations(world.stations || []).find(s => s.id === id);
  return canonicalizeStationDisplayClient(found);
}


// ===== 10-routing-line-utils.js =====
// Routage client, brouillon de ligne, recherche gares et utilitaires finaux.
function trainName(train) {
  const model = app.state.balance.trains[train.modelId];
  return model ? model.name : train.modelId;
}

function distance(a, b) {
  const route = getRoute(a, b);
  return route.distance || 0;
}


function routeGeometryKey(a, b, profile = 'default') {
  return `${normalizeRouteProfileClient(profile)}::${a}->${b}`;
}

function routeGeometryStationPoint(id) {
  const s = station(id);
  if (!s) return null;
  const lon = stationRouteLon(s);
  const lat = stationRouteLat(s);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

function coordDistanceKm(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return Infinity;
  return haversineClient(Number(a[1]), Number(a[0]), Number(b[1]), Number(b[0]));
}

function addEndpointIfNeeded(coords, point, atStart) {
  if (!point || !Array.isArray(coords)) return coords || [];
  const end = atStart ? coords[0] : coords[coords.length - 1];
  if (!end || coordDistanceKm(point, end) > 0.03) return atStart ? [point, ...coords] : [...coords, point];
  const copy = [...coords];
  if (atStart) copy[0] = point;
  else copy[copy.length - 1] = point;
  return copy;
}

function officialRouteAliasForStation(id) {
  return id;
}

function routeGeometryAliasPair(a, b) {
  return {
    a: officialRouteAliasForStation(a),
    b: officialRouteAliasForStation(b)
  };
}

function geometryWithRequestedEndpoints(geometry, requestedA, requestedB, aliasA, aliasB) {
  let coords = Array.isArray(geometry) ? geometry : [];
  if (!coords.length && aliasA === aliasB) {
    const start = routeGeometryStationPoint(requestedA);
    const end = routeGeometryStationPoint(requestedB);
    return start && end ? [start, end] : [];
  }
  if (requestedA !== aliasA) coords = addEndpointIfNeeded(coords, routeGeometryStationPoint(requestedA), true);
  if (requestedB !== aliasB) coords = addEndpointIfNeeded(coords, routeGeometryStationPoint(requestedB), false);
  return coords;
}

function geometryForRoute(a, b, profile = 'default') {
  const direct = cachedRailGeometryForRoute(a, b, profile);
  if (direct) return direct;
  const alias = routeGeometryAliasPair(a, b);
  if (alias.a !== a || alias.b !== b) {
    if (alias.a === alias.b) return geometryWithRequestedEndpoints([], a, b, alias.a, alias.b);
    const aliasGeometry = cachedRailGeometryForRoute(alias.a, alias.b, profile);
    if (aliasGeometry) return geometryWithRequestedEndpoints(aliasGeometry, a, b, alias.a, alias.b);
    const aliasKey = routeGeometryKey(alias.a, alias.b, profile);
    if (!routeGeometryMarkedMissing(aliasKey) && !routeGeometryMarkedMissing(routeGeometryKey(alias.b, alias.a, profile))) {
      ensureRailwayRouteGeometry(alias.a, alias.b, profile);
    }
    return null;
  }
  const key = routeGeometryKey(a, b, profile);
  if (!routeGeometryMarkedMissing(key) && !routeGeometryMarkedMissing(routeGeometryKey(b, a, profile))) ensureRailwayRouteGeometry(a, b, profile);
  return null;
}

function cachedRailGeometryForRoute(a, b, profile = 'default') {
  const direct = getCacheEntry(app.osmRouteCache, routeGeometryKey(a, b, profile));
  if (direct) return direct;
  const reverse = getCacheEntry(app.osmRouteCache, routeGeometryKey(b, a, profile));
  if (reverse) return [...reverse].reverse();
  return null;
}


function normalizeRouteSpeedProfile(profile, geometry = null) {
  if (!profile || typeof profile !== 'object') return null;
  const geometryDistance = Array.isArray(geometry) && geometry.length >= 2 ? polylineGeoDistance(geometry) : 0;
  const totalKm = Number(profile.totalKm || geometryDistance || 0);
  const rawSegments = Array.isArray(profile.segments) ? profile.segments : [];
  const segments = [];
  for (const raw of rawSegments) {
    const fromKm = Math.max(0, Number(raw?.fromKm));
    const toKm = Math.max(0, Number(raw?.toKm));
    const speedKmh = Math.round(Number(raw?.speedKmh));
    if (![fromKm, toKm, speedKmh].every(Number.isFinite) || toKm <= fromKm || speedKmh < 5) continue;
    segments.push({
      fromKm,
      toKm,
      distanceKm: Math.max(0, Number(raw?.distanceKm || (toKm - fromKm))),
      speedKmh: Math.min(350, Math.max(5, speedKmh)),
      source: raw?.source || 'sncf-speed'
    });
  }
  if (!segments.length) return null;
  const safeTotal = Number.isFinite(totalKm) && totalKm > 0 ? totalKm : segments[segments.length - 1].toKm;
  const speeds = segments.map(segment => segment.speedKmh).filter(Number.isFinite);
  return {
    source: profile.source || 'sncf-speed',
    totalKm: safeTotal,
    coverage: Math.max(0, Math.min(1, Number(profile.coverage || 0))),
    averageSpeedKmh: Number(profile.averageSpeedKmh || 0) || null,
    minSpeedKmh: speeds.length ? Math.min(...speeds) : null,
    maxSpeedKmh: speeds.length ? Math.max(...speeds) : null,
    segments
  };
}

function reverseRouteSpeedProfile(profile, totalKm = null) {
  if (!profile?.segments?.length) return null;
  const distance = Number(totalKm || profile.totalKm || profile.segments[profile.segments.length - 1]?.toKm || 0);
  if (!Number.isFinite(distance) || distance <= 0) return profile;
  const segments = profile.segments
    .map(segment => ({
      fromKm: Math.max(0, distance - Number(segment.toKm || 0)),
      toKm: Math.max(0, distance - Number(segment.fromKm || 0)),
      distanceKm: Math.max(0, Number(segment.distanceKm || 0)),
      speedKmh: Number(segment.speedKmh),
      source: segment.source || 'sncf-speed'
    }))
    .filter(segment => segment.toKm > segment.fromKm)
    .sort((a, b) => a.fromKm - b.fromKm);
  return normalizeRouteSpeedProfile({ ...profile, totalKm: distance, segments });
}

function rememberRouteSpeedProfile(key, profile, geometry = null) {
  if (typeof key !== 'string') return null;
  const normalized = normalizeRouteSpeedProfile(profile, geometry);
  if (normalized) app.routeSpeedCache.set(key, normalized);
  return normalized;
}

function routeSpeedProfileForKey(key) {
  return typeof key === 'string' ? (app.routeSpeedCache.get(key) || null) : null;
}

function routeSpeedProfileForRoute(a, b, profile = 'default') {
  const directKey = routeGeometryKey(a, b, profile);
  const direct = routeSpeedProfileForKey(directKey);
  if (direct) return direct;
  const reverseKey = routeGeometryKey(b, a, profile);
  const reverse = routeSpeedProfileForKey(reverseKey);
  return reverse ? reverseRouteSpeedProfile(reverse) : null;
}

function appendRouteSpeedProfileSegments(out, profile, offsetKm = 0) {
  if (!Array.isArray(out) || !profile?.segments?.length) return;
  const offset = Number(offsetKm) || 0;
  for (const segment of profile.segments) {
    const fromKm = offset + Number(segment.fromKm || 0);
    const toKm = offset + Number(segment.toKm || 0);
    const speedKmh = Number(segment.speedKmh || 0);
    if (![fromKm, toKm, speedKmh].every(Number.isFinite) || toKm <= fromKm || speedKmh < 5) continue;
    const previous = out[out.length - 1];
    if (previous && previous.speedKmh === speedKmh && previous.source === (segment.source || 'sncf-speed') && Math.abs(previous.toKm - fromKm) < 0.03) {
      previous.toKm = toKm;
      previous.distanceKm = Math.max(0, previous.toKm - previous.fromKm);
    } else {
      out.push({ fromKm, toKm, distanceKm: toKm - fromKm, speedKmh, source: segment.source || 'sncf-speed' });
    }
  }
}

function combinedRouteSpeedProfile(segments, totalKm = 0) {
  if (!Array.isArray(segments) || !segments.length) return null;
  const safeTotal = Number(totalKm) > 0 ? Number(totalKm) : segments[segments.length - 1]?.toKm || 0;
  return normalizeRouteSpeedProfile({ source: 'sncf-speed-combined', totalKm: safeTotal, coverage: 1, segments });
}

function routeGeometryMarkedMissing(key) {
  const at = Number(app.osmRouteMissing?.get?.(key) || 0);
  if (!at) return false;
  if (Date.now() - at > 45000) {
    app.osmRouteMissing.delete(key);
    return false;
  }
  return true;
}

function markRouteGeometryMissing(key) {
  app.osmRouteMissing.set(key, Date.now());
}

async function ensureRailwayRouteGeometry(a, b, profile = 'default') {
  const key = routeGeometryKey(a, b, profile);
  if (app.osmRoutePending.has(key) || routeGeometryMarkedMissing(key) || routeGeometryMarkedMissing(routeGeometryKey(b, a, profile))) return;
  if (app.osmRoutePending.size >= OSM_ROUTE_FETCH_PARALLEL_LIMIT) return;
  const sa = station(a), sb = station(b);
  if (!sa || !sb) return;
  const directKm = stationRouteDistanceClient(sa, sb);
  if (!Number.isFinite(directKm) || directKm <= 0 || directKm > 1300) return;

  const latA = stationRouteLat(sa), lonA = stationRouteLon(sa);
  const latB = stationRouteLat(sb), lonB = stationRouteLon(sb);
  if (![latA, lonA, latB, lonB].every(Number.isFinite)) return;

  app.osmRoutePending.add(key);
  let foundGeometry = false;
  try {
    // Priorité stricte au RFN serveur : il utilise le dataset SNCF officiel et peut
    // reconstruire un chemin via les gares intermédiaires même si elles ne sont pas
    // des arrêts commerciaux de la ligne créée par le joueur.
    const sncf = await fetchSncfRouteGeometry(a, b, profile);
    if (sncf?.length >= 2) {
      rememberCacheEntry(app.osmRouteCache, key, sncf, OSM_ROUTE_CACHE_MAX_ENTRIES);
      app.osmRouteMissing.delete(key);
      app.osmRouteMissing.delete(routeGeometryKey(b, a, profile));
      foundGeometry = true;
      app.routeCache.clear();
      invalidateMapProjection('sncf-rail-geometry-loaded');
      if (app.activeTab === 'lines') updateLinePreview();
      return;
    }
  } catch (error) {
    // Non bloquant : le serveur refusera de toute façon les créations sans RFN.
  } finally {
    if (!foundGeometry) markRouteGeometryMissing(key);
    app.osmRoutePending.delete(key);
    if (!foundGeometry && app.activeTab === 'lines') {
      app.routeCache.clear();
      updateLinePreview();
    }
  }
}

async function fetchSncfRouteGeometry(a, b, profile = 'default') {
  try {
    const routeProfile = normalizeRouteProfileClient(profile);
    const response = await fetch(`/api/sncf/route-geometry?from=${encodeURIComponent(a)}&to=${encodeURIComponent(b)}&profile=${encodeURIComponent(routeProfile)}&rv=${encodeURIComponent(PERSISTED_OSM_ROUTE_CACHE_VERSION)}`, {
      cache: 'default',
      headers: authHeaders()
    });
    if (!response.ok) return [];
    const data = await response.json();
    const coords = Array.isArray(data.geometry) ? data.geometry : [];
    const normalized = coords
      .map(pair => [Number(pair[0]), Number(pair[1])])
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
    if (normalized.length >= 2) rememberRouteSpeedProfile(routeGeometryKey(a, b, routeProfile), data.speedProfile, normalized);
    return normalized;
  } catch {
    return [];
  }
}

async function fetchSncfRouteGeometryForStopSequence(ids, profile = 'default') {
  try {
    const cleanIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (cleanIds.length < 2) return [];
    const routeProfile = normalizeRouteProfileClient(profile);
    const response = await fetch(`/api/sncf/route-geometry-sequence?stops=${encodeURIComponent(cleanIds.join(','))}&profile=${encodeURIComponent(routeProfile)}&rv=${encodeURIComponent(PERSISTED_OSM_ROUTE_CACHE_VERSION)}`, {
      cache: 'default',
      headers: authHeaders()
    });
    if (!response.ok) return [];
    const data = await response.json();
    const coords = Array.isArray(data.geometry) ? data.geometry : [];
    const normalized = coords
      .map(pair => [Number(pair[0]), Number(pair[1])])
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
    if (normalized.length >= 2) rememberRouteSpeedProfile(geometryKeyForStops(cleanIds, routeProfile), data.speedProfile, normalized);
    return normalized;
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

function getRoute(a, b, options = {}) {
  const profile = normalizeRouteProfileClient(options.profile || 'default');
  const key = `${profile}::${a}::${b}`;
  const cached = getCacheEntry(app.routeCache, key);
  if (cached) return cached;
  const reverseKey = `${profile}::${b}::${a}`;
  const reverse = getCacheEntry(app.routeCache, reverseKey);
  if (reverse) {
    const route = {
      ...reverse,
      ids: [...reverse.ids].reverse(),
      points: [...(reverse.points || [])].reverse(),
      coords: [...(reverse.coords || [])].reverse(),
      speedProfile: reverseRouteSpeedProfile(reverse.speedProfile, reverse.distance)
    };
    return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
  }

  const geometry = geometryForRoute(a, b, profile);
  if (!geometry?.length) {
    const route = { ids: [a, b].filter(Boolean), distance: 0, maxSegment: 0, points: [], coords: [], pending: !routeGeometryMarkedMissing(routeGeometryKey(a, b, profile)) };
    return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
  }

  const points = geometry
    .map(([lon, lat]) => project(lon, lat))
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  const distance = Math.round(polylineGeoDistance(geometry));
  const route = {
    ids: [a, b],
    distance,
    maxSegment: distance,
    points,
    coords: geometry,
    speedProfile: routeSpeedProfileForRoute(a, b, profile)
  };
  return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
}

function resolveSegmentPath(a, b) {
  const sa = station(a), sb = station(b);
  if (!sa || !sb) return [];

  const geometry = geometryForRoute(a, b);
  if (geometry?.length >= 2) {
    const projected = geometry.map(([lon, lat]) => project(lon, lat)).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (projected.length >= 2) return projected;
  }

  return [];
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
  const trainsById = new Map((player?.trains || []).map(train => [train.id, train]));
  return lineTrainIdsOf(line).map(id => trainsById.get(id)).filter(Boolean);
}

function lineCadenceTimingClient(service, stopCount) {
  const intermediateStops = Math.max(0, Number(stopCount || 0) - 2);
  if (service === 'freight') return { intermediateStops, dwellMinutes: 5, turnaroundMinutes: 18 };
  if (service === 'mixed') return { intermediateStops, dwellMinutes: 4, turnaroundMinutes: 12 };
  return { intermediateStops, dwellMinutes: 3, turnaroundMinutes: 8 };
}

function lineCadenceClient(line) {
  const stored = line?.stats?.cadence;
  if (stored && Number.isFinite(Number(stored.roundTripMinutes))) return stored;

  const plannedTrains = lineAssignedTrainsClient(line);
  const operatingTrains = plannedTrains.filter(train => !train.construction?.active && !train.maintenance?.active && Number(train.condition ?? 1) > 0);
  const timingTrains = operatingTrains.length ? operatingTrains : plannedTrains;
  const timing = lineCadenceTimingClient(line?.service, lineStopsOf(line).length);
  const speeds = timingTrains
    .map(train => Number(train.profile?.speed || app.state.balance.trains[train.modelId]?.speed || 0))
    .filter(speed => Number.isFinite(speed) && speed > 0);
  const operatingSpeedKmh = Math.max(25, Math.min(...(speeds.length ? speeds : [80])));
  const distance = Math.max(0, Number(lineDistance(line) || 0));
  const profileSegments = line?.speedProfile?.segments || [];
  const rfnTravelMinutes = profileSegments.reduce((sum, segment) => {
    const segmentDistance = Math.max(0, Number(segment?.distanceKm || (Number(segment?.toKm) - Number(segment?.fromKm)) || 0));
    const limit = Math.max(5, Number(segment?.speedKmh || line?.speedProfile?.averageSpeedKmh || operatingSpeedKmh));
    return sum + segmentDistance / Math.max(5, Math.min(operatingSpeedKmh, limit)) * 60;
  }, 0);
  const oneWayMinutes = distance > 0
    ? (rfnTravelMinutes || distance / operatingSpeedKmh * 60) + timing.intermediateStops * timing.dwellMinutes
    : 0;
  const roundTripMinutes = oneWayMinutes > 0
    ? oneWayMinutes * 2 + timing.turnaroundMinutes * 2
    : 0;
  const plannedTrainCount = plannedTrains.length;
  const availableTrainCount = operatingTrains.length;
  const requestedFrequency = Number(line?.stats?.capacity?.requestedFrequency ?? lineSlotDemandClient(line));
  const effectiveFrequency = Number(line?.stats?.capacity?.effectiveFrequency ?? requestedFrequency);
  const utilizationFactor = requestedFrequency > 0 ? Math.max(0, Math.min(1, effectiveFrequency / requestedFrequency)) : 0;
  const effectiveTrainCount = availableTrainCount * utilizationFactor;
  const plannedHeadwayMinutes = plannedTrainCount > 0 && roundTripMinutes > 0 ? roundTripMinutes / plannedTrainCount : null;
  const headwayMinutes = effectiveTrainCount > 0 && roundTripMinutes > 0 ? roundTripMinutes / effectiveTrainCount : null;
  return {
    version: 'cadence-v1',
    plannedTrainCount,
    availableTrainCount,
    effectiveTrainCount: round(effectiveTrainCount),
    operatingSpeedKmh: Math.round(operatingSpeedKmh),
    intermediateStops: timing.intermediateStops,
    dwellMinutes: timing.dwellMinutes,
    oneWayMinutes: round(oneWayMinutes),
    turnaroundMinutes: timing.turnaroundMinutes,
    roundTripMinutes: round(roundTripMinutes),
    plannedHeadwayMinutes: plannedHeadwayMinutes == null ? null : round(plannedHeadwayMinutes),
    headwayMinutes: headwayMinutes == null ? null : round(headwayMinutes),
    departuresPerHour: headwayMinutes ? round(60 / headwayMinutes) : 0,
    status: !plannedTrainCount ? 'no-train' : !availableTrainCount ? 'suspended' : effectiveTrainCount + 0.001 < plannedTrainCount ? 'reduced' : 'normal'
  };
}

function stationOwnerClient(stationId) {
  for (const player of app.state?.players || []) {
    if (player?.stations?.[stationId]) return { player, asset: player.stations[stationId] };
  }
  return null;
}

function validateLineStopServiceClient(stops, service) {
  for (const stopId of stops || []) {
    const s = station(stopId);
    if (!s) return `Gare inconnue : ${stopId}.`;
    const passengerOk = Boolean(s.hasPassengerStation);
    const freightOk = Boolean(s.hasFreightStation);
    if (service === 'passengers' && !passengerOk) return `${s.name} n’est pas une gare voyageurs.`;
    if (service === 'freight' && !freightOk) return `${s.name} n’est pas une gare fret.`;
    if (service === 'mixed' && (!passengerOk || !freightOk)) return `${s.name} ne permet pas un service mixte voyageurs + fret.`;
  }
  return '';
}

function lineOwnershipProblemClient(stops) {
  const ids = Array.isArray(stops) ? stops : [];
  for (const stopId of ids) {
    if (!station(stopId)) return `Arrêt invalide : ${stopId}.`;
  }
  // Les gares libres peuvent être desservies sans achat préalable.
  // Le propriétaire d'une gare, s'il existe, sert uniquement au calcul des péages.
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
  if (explicitMode === 'multiple_unit' || isMultipleUnitModelClient(candidateModel)) return { key: 'passengers', label: 'Voyageur' };
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

  // En création de ligne, l'ordre est celui préparé par le joueur :
  // départ → arrêts ajoutés successivement → terminus.
  // L'ancienne insertion automatique "meilleure position" pouvait déplacer une
  // gare au mauvais endroit quand les distances provisoires n'étaient pas encore
  // confirmées par la géométrie RFN.
  draft.waypoints = [...(draft.waypoints || []), stopId];
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

function geometryKeyForStops(ids, profile = 'default') {
  return `stops::${normalizeRouteProfileClient(profile)}::${ids.join('>')}`;
}

function geometryForStopSequence(ids, profile = 'default') {
  const key = geometryKeyForStops(ids, profile);
  const direct = getCacheEntry(app.osmRouteCache, key);
  if (direct) return direct;
  ensureOsmRouteGeometryForStops(ids, profile);
  return null;
}

async function ensureOsmRouteGeometryForStops(ids, profile = 'default') {
  if (!app.map.leaflet || !Array.isArray(ids) || ids.length < 2) return;
  const key = geometryKeyForStops(ids, profile);
  if (app.osmRoutePending.has(key) || app.osmRoutePending.size >= OSM_ROUTE_FETCH_PARALLEL_LIMIT) return;
  const stations = ids.map(id => station(id)).filter(Boolean);
  if (stations.length !== ids.length) return;
  app.osmRoutePending.add(key);
  try {
    const sequenceGeometry = await fetchSncfRouteGeometryForStopSequence(ids, profile);
    if (sequenceGeometry?.length >= 2) {
      rememberCacheEntry(app.osmRouteCache, key, sequenceGeometry, OSM_ROUTE_CACHE_MAX_ENTRIES);
      app.routeCache.delete(`multi::${normalizeRouteProfileClient(profile)}::${ids.join('::')}`);
      invalidateMapProjection('sncf-sequence-geometry-loaded');
      if (app.activeTab === 'lines') updateLinePreview('sncf-sequence-geometry-loaded');
      return;
    }

    for (let i = 1; i < ids.length; i++) {
      await ensureRailwayRouteGeometry(ids[i - 1], ids[i], profile);
    }
    const coords = [];
    for (let i = 1; i < ids.length; i++) {
      const segment = cachedRailGeometryForRoute(ids[i - 1], ids[i], profile);
      if (!segment?.length) return;
      if (!coords.length) coords.push(...segment);
      else coords.push(...segment.slice(1));
    }
    if (coords.length >= 2) {
      rememberCacheEntry(app.osmRouteCache, key, coords, OSM_ROUTE_CACHE_MAX_ENTRIES);
      app.routeCache.delete(`multi::${normalizeRouteProfileClient(profile)}::${ids.join('::')}`);
      invalidateMapProjection('sncf-segment-geometry-loaded');
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

function getRouteForStops(stops, options = {}) {
  const profile = normalizeRouteProfileClient(options.profile || 'default');
  const ids = Array.isArray(stops) ? stops.filter(Boolean) : lineStopsOf(stops);
  const key = `multi::${profile}::${ids.join('::')}`;
  const cached = getCacheEntry(app.routeCache, key);
  if (cached) return cached;
  if (ids.length < 2) {
    const single = { ids, distance: 0, maxSegment: 0, points: [], coords: [] };
    return rememberCacheEntry(app.routeCache, key, single, ROUTE_CACHE_MAX_ENTRIES);
  }

  const sequenceGeometry = geometryForStopSequence(ids, profile);
  if (sequenceGeometry?.length >= 2) {
    const sequencePoints = sequenceGeometry
      .map(([lon, lat]) => project(lon, lat))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (sequencePoints.length >= 2) {
      const distance = Math.round(polylineGeoDistance(sequenceGeometry));
      const route = {
        ids,
        distance,
        maxSegment: distance,
        points: cleanRoutePoints(sequencePoints),
        coords: sequenceGeometry,
        speedProfile: routeSpeedProfileForKey(key)
      };
      return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
    }
  }

  let mergedIds = [ids[0]];
  let distanceTotal = 0;
  let maxSegment = 0;
  let points = [];
  let coords = [];
  const mergedSpeedSegments = [];

  for (let i = 1; i < ids.length; i++) {
    const segment = getRoute(ids[i - 1], ids[i], { profile });
    if (!segment.distance || !segment.points?.length) {
      const route = { ids, distance: 0, maxSegment: 0, points: [], coords: [], pending: Boolean(segment.pending) };
      return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
    }
    mergedIds.push(...segment.ids.slice(1));
    const offsetKm = distanceTotal;
    distanceTotal += segment.distance || 0;
    maxSegment = Math.max(maxSegment, segment.maxSegment || 0);
    appendRouteSpeedProfileSegments(mergedSpeedSegments, segment.speedProfile, offsetKm);

    if (!points.length) points.push(...segment.points);
    else points.push(...segment.points.slice(1));
    if (Array.isArray(segment.coords) && segment.coords.length) {
      if (!coords.length) coords.push(...segment.coords);
      else coords.push(...segment.coords.slice(1));
    }
  }

  points = cleanRoutePoints(points);
  // Ne plus remplacer un tracé détaillé par une spline organique.
  // Cette ancienne sécurité était utile pour certains fallbacks, mais elle pouvait
  // dégrader un vrai parcours RFN en le simplifiant visuellement.
  const route = { ids: mergedIds, distance: Math.round(distanceTotal), maxSegment: Math.round(maxSegment), points, coords, speedProfile: combinedRouteSpeedProfile(mergedSpeedSegments, distanceTotal) };
  return rememberCacheEntry(app.routeCache, key, route, ROUTE_CACHE_MAX_ENTRIES);
}

function lineDistance(line) {
  const stored = Number(line?.distance);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
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
  return stops.length >= 2 ? getRouteForStops(stops, { profile: routeProfileForDraftClient(draft) }).distance || 0 : 0;
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
  `).join('') : '<div class="station-suggest-empty">Aucune gare trouvée.</div>';
}

function findStationMatches(query, limit = 12, sortMode = '') {
  const q = normalizeStationSearchText(query || '');
  const all = dedupedStations(app.state?.world?.stations || []);
  if (!q) {
    const candidates = sortMode ? sortStationsForPurchase(all, sortMode) : topStationCandidates(limit);
    return candidates.slice(0, limit);
  }
  const matches = all
    .map(s => {
      const name = normalizeStationSearchText(s.name);
      const postal = (s.codesPostaux || []).join(' ');
      // Le rang est volontairement distinct du score : une gare dont le nom
      // commence par la saisie doit toujours précéder une simple occurrence.
      const exact = name === q;
      const starts = name.startsWith(q);
      const includes = name.includes(q);
      const postalMatch = postal.includes(q);
      const rank = exact ? 0 : starts ? 1 : includes ? 2 : postalMatch ? 3 : 4;
      const owned = app.state.me?.stations?.[s.id] ? 500 : 0;
      const pop = Number(s.population || s.baseDemand * 450 || 10000);
      return {
        s,
        rank,
        score: owned + Math.log10(pop) * 12,
        matches: exact || starts || includes || postalMatch
      };
    })
    .filter(x => x.matches);

  const collator = new Intl.Collator('fr', { sensitivity: 'base' });
  const ordered = matches
    .sort((a, b) => a.rank - b.rank || b.score - a.score || collator.compare(a.s.name || '', b.s.name || ''))
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
  return s.region || 'Gare principale';
}

function normalizeSearchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeStationSearchText(value) {
  return normalizeSearchText(value)
    .replace(/[’'`]/g, ' ')
    .replace(/[-_/.,;:()[\]{}]+/g, ' ')
    .replace(/\b(?:st|ste)\.?(?=\s|$)/g, 'saint')
    .replace(/\bsainte\b/g, 'saint')
    .replace(/\s+/g, ' ')
    .trim();
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

function trainConstructionDurationMsClient(model) {
  const maxEpoch = Math.max(1, (app.state?.balance?.epochs?.length || 7) - 1);
  const era = clamp(Math.floor(Number(model?.unlockEpoch || 0)), 0, maxEpoch);
  const techRank = clamp((Math.max(1, Number(model?.requiredTechLevel || 1)) - 1) / 7, 0, 1);
  const price = Math.max(95000, Number(model?.price || 95000));
  const priceRank = clamp((Math.log10(price) - Math.log10(95000)) / (Math.log10(92000000) - Math.log10(95000)), 0, 1);
  const inEraRank = clamp(techRank * 0.7 + priceRank * 0.3, 0, 1);
  const globalRank = clamp((era + inEraRank) / (maxEpoch + 1), 0, 1);
  const minMs = 60 * 1000;
  const maxMs = 20 * 60 * 60 * 1000;
  return Math.round(minMs + Math.pow(globalRank, 1.55) * (maxMs - minMs));
}

function maintenanceActionLockedReason(action) {
  if (action.requiredTech && !hasTech(action.requiredTech)) return `Recherche : ${techNodeTitle(action.requiredTech)}`;
  if (action.facility && maintenanceFacilityLevelClient(action.facility) <= 0) {
    return maintenanceFacilityUnderConstructionClient(action.facility)
      ? `${maintenanceFacilityNameClient(action.facility)} en construction`
      : `${maintenanceFacilityNameClient(action.facility)} requis`;
  }
  return '';
}

function maintenanceFacilityLevelClient(facilityId) {
  const raw = app.state?.me?.maintenanceFacilities?.[facilityId];
  return Math.max(0, Math.floor(Number(raw?.level ?? raw ?? 0)));
}

function maintenanceFacilityConstructionClient(facilityId) {
  const raw = app.state?.me?.maintenanceFacilities?.[facilityId];
  const construction = raw?.construction || {};
  const durationMs = Math.max(0, Number(construction.durationMs || 0));
  const remainingMs = Math.max(0, Number(construction.remainingMs ?? (construction.active ? durationMs : 0)));
  const progress = durationMs > 0 ? clamp(1 - remainingMs / durationMs, 0, 1) : (construction.active ? 0 : 1);
  return {
    active: Boolean(construction.active) && remainingMs > 0,
    targetLevel: Math.max(0, Math.floor(Number(construction.targetLevel || maintenanceFacilityLevelClient(facilityId) + 1))),
    durationMs,
    remainingMs,
    endAt: serverNow() + remainingMs,
    progress,
    percent: Math.round(progress * 100),
    startedAt: construction.startedAt || 0
  };
}

function maintenanceFacilityUnderConstructionClient(facilityId) {
  return maintenanceFacilityConstructionClient(facilityId).active;
}

function maintenanceFacilityNameClient(facilityId) {
  return app.state?.balance?.maintenanceFacilities?.[facilityId]?.name || 'Bâtiment';
}

function maintenanceFacilityUpgradeCostClient(facilityId) {
  const facility = app.state?.balance?.maintenanceFacilities?.[facilityId];
  if (!facility) return 0;
  const level = maintenanceFacilityLevelClient(facilityId);
  return Math.round(Number(facility.baseCost || 0) * Math.pow(Number(facility.growth || 1.25), level));
}

function maintenanceFacilityConstructionDurationMsClient(facilityId) {
  const facility = app.state?.balance?.maintenanceFacilities?.[facilityId];
  if (!facility) return 0;
  const level = maintenanceFacilityLevelClient(facilityId);
  const baseMs = Math.max(0, Number(facility.baseConstructionMs || 0));
  const growth = Math.max(1, Number(facility.constructionGrowth || facility.growth || 1.25));
  return Math.round(baseMs * Math.pow(growth, level));
}

function maintenanceFacilityDurationMultiplierClient(facilityId) {
  const facility = app.state?.balance?.maintenanceFacilities?.[facilityId];
  if (!facility) return 1;
  const level = maintenanceFacilityLevelClient(facilityId);
  const reduction = Math.min(Number(facility.maxDurationReduction || 0), level * Number(facility.durationReductionPerLevel || 0));
  return clamp(1 - reduction, 0.18, 1);
}

function totalMaintenanceFacilityScoreClient() {
  return maintenanceFacilityLevelClient('depot') * 0.45
    + maintenanceFacilityLevelClient('workshop')
    + maintenanceFacilityLevelClient('technicentre') * 1.35;
}

function maintenanceDurationMsClient(train, model, action) {
  const condition = clamp(Number(train?.condition ?? 1), 0, 1);
  const durabilityFactor = 0.35 + (1 - condition) * 1.65;
  const facilityMultiplier = maintenanceFacilityDurationMultiplierClient(action.facility);
  const mechanicBonus = Math.min(0.16, Number(app.state?.me?.staff?.mechanics || 0) * 0.006);
  const branchBonus = Math.min(0.18, Number(app.state?.me?.tech?.maintenance || 0) * 0.004);
  const techBonus = branchBonus + Math.min(0.24, techLevel('steam_workshops') * 0.045) + Math.min(0.1, techLevel('electric_standardized_maintenance') * 0.02);
  const skillMultiplier = clamp(1 - mechanicBonus - techBonus, 0.42, 1);
  const baseMinutes = Math.max(1, Number(action.baseMinutes || action.days * 12 || 15));
  return Math.max(60000, Math.ceil(baseMinutes * 60000 * durabilityFactor * facilityMultiplier * skillMultiplier));
}

function maintenancePreview(train, model, action) {
  const missing = Math.max(0.02, 1 - train.condition);
  const workshopDiscount = Math.min(0.18, totalMaintenanceFacilityScoreClient() * 0.025);
  const branchDiscount = 1 - Math.min(0.24, Number(app.state?.me?.tech?.maintenance || 0) * 0.006);
  const techDiscount = branchDiscount * (hasTech('steam_workshops') ? 0.92 : 1) * (hasTech('electric_standardized_maintenance') ? 0.94 : 1);
  const cost = Math.round((action.baseCost + model.price * action.priceFactor * missing) * (1 - workshopDiscount) * techDiscount);
  const durationMs = maintenanceDurationMsClient(train, model, action);
  const target = Math.round(Math.max(train.condition, Math.min(action.target || 0.99, train.condition + action.restore)) * 100);
  const condition = Math.round(clamp(Number(train?.condition || 0), 0, 1) * 100);
  return `${money(cost)} · ${formatDurationMs(durationMs)} · état ${condition}% → ${target}%`;
}


function updateLinePreview(sourceId = '') {
  updateLineDistanceCalculator();
  const box = $('#linePreview');
  if (!box || !app.state?.me) return;
  const stops = buildLineDraftStops();
  const trainId = $('#lineTrain')?.value;
  const service = $('#lineService')?.value || app.lineDraft.service || 'passengers';
  const train = app.state.me.trains.find(t => t.id === trainId);
  const model = train ? app.state.balance.trains[train.modelId] : null;
  const button = $('#createLineBtn');

  if (stops.length < 2 || !model) {
    box.className = 'line-preview muted small';
    box.textContent = 'Choisis au moins un départ, une arrivée et un train.';
    if (button) button.disabled = !model;
    return;
  }
  if (train.construction?.active) {
    box.className = 'line-preview bad small';
    box.textContent = `Train indisponible : fabrication en cours, ${formatResearchTime(train.construction.remainingMs || train.construction.durationMs || 0)} restantes.`;
    if (button) button.disabled = true;
    return;
  }
  if (train.maintenance?.active) {
    box.className = 'line-preview bad small';
    box.textContent = `Train indisponible : Maintenance en cours, ${formatDurationMs(train.maintenance.remainingMs || train.maintenance.daysLeft * Math.max(250, Number(app.state?.game?.tickMs || 2000)))} restantes.`;
    if (button) button.disabled = true;
    return;
  }
  if (new Set(stops).size !== stops.length) {
    box.className = 'line-preview bad small';
    box.textContent = 'La ligne contient un arrêt en doublon. Chaque arrêt ne doit apparaître qu’une seule fois.';
    if (button) button.disabled = true;
    return;
  }
  const serviceStopProblem = validateLineStopServiceClient(stops, service);
  if (serviceStopProblem) {
    box.className = 'line-preview bad small';
    box.textContent = serviceStopProblem;
    if (button) button.disabled = true;
    return;
  }

  const route = getRouteForStops(stops, { profile: routeProfileForDraftClient() });
  if (!route.distance) {
    box.className = 'line-preview bad small';
    box.textContent = route.pending
      ? 'Calcul de l’itinéraire RFN en cours. Patiente quelques secondes avant validation.'
      : 'Aucun itinéraire réel trouvé dans le RFN pour cette suite de gares.';
    if (button) button.disabled = true;
    return;
  }
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
  const base = `Distance réseau : ${formatInt(route.distance)} km · Billet moyen : ${money(ticketPrice)} · Tronçon le plus long : ${formatInt(route.maxSegment)} km · ${stops.length} arrêt(s).${rightsText ? ` ${rightsText}` : ' Gares libres utilisables sans achat préalable.'}`;
  const effective = effectiveTrainRangeClient(train, model);
  const ok = route.distance <= effective;
  const detail = ok
    ? ` Compatible : Portée ${formatInt(effective)} km. Itinéraire : ${routeText}.`
    : ` Incompatible : Portée ${formatInt(effective)} km. La distance totale de ligne dépasse la portée du matériel. Itinéraire : ${routeText}.`;

  box.className = `line-preview ${ok ? 'good' : 'bad'} small`;
  box.textContent = base + detail;
  if (button) button.disabled = !ok;
  drawMap();
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
    'Projection moyenne : capacité, vitesse et trains en circulation.',
    'Les encaissements réels interviennent uniquement aux gares desservies.',
    '---------------------------------------------',
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
    resourceZeroTooltipLine(type),
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


if (typeof init === 'function') Promise.resolve(init()).catch(showSillonsClientBootError);

else showSillonsClientBootError(new Error('Initialisation client absente.'));
