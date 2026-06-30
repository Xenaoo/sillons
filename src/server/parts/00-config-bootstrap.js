// Configuration, constantes, initialisation générale et démarrage HTTP.
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const SAVE_DB_FILE = process.env.SILLONS_SAVE_DB_FILE || path.join(ROOT, 'data', 'save.sqlite');
const LEGACY_SAVE_FILE = path.join(ROOT, 'data', 'save.json');
const CHANGELOG_FILE = path.join(ROOT, 'changelog.md');
const PROJECT_VERSION = 'v0.71.10';
const STATE_SCHEMA_VERSION = 190;
const HOUR_MS = 60 * 60 * 1000;
const ERA_TRANSITION_DURATIONS_MS = Object.freeze({
  1: 5 * 24 * HOUR_MS,
  2: 10 * 24 * HOUR_MS,
  3: 15 * 24 * HOUR_MS,
  4: 21 * 24 * HOUR_MS,
  5: 30 * 24 * HOUR_MS,
  6: 45 * 24 * HOUR_MS
});
const COMMUNE_CACHE_FILE = path.join(ROOT, 'data', 'communes-5000-population.json');
const MIN_COMMUNE_POPULATION = 0;
const COMMUNE_CACHE_MIN_READY_COUNT = 3000;
const COMMUNE_CACHE_SOURCE_VERSION = 10;
const COMMUNE_API_URL = 'https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,codeDepartement,population,centre&geometry=centre&format=json';
const SNCF_STATION_DATASET = 'liste-des-gares';
const SNCF_STATION_API_URL = `https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/${SNCF_STATION_DATASET}/records`;
const SNCF_STATION_EXPORT_URL = `https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/${SNCF_STATION_DATASET}/exports/json`;
const SNCF_STATION_PAGE_SIZE = 100;
const SNCF_PASSENGER_TRAFFIC_DATASET = 'frequentation-gares';
const SNCF_PASSENGER_TRAFFIC_EXPORT_URL = `https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/${SNCF_PASSENGER_TRAFFIC_DATASET}/exports/json`;
const SNCF_RFN_GEOJSON_URL = 'https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/formes-des-lignes-du-rfn/exports/geojson';
const SNCF_RFN_CACHE_FILE = path.join(ROOT, 'data', 'sncf-rfn-lines-cache.json');
const SNCF_RFN_ROUTE_CACHE_FILE = path.join(ROOT, 'data', 'sncf-rfn-route-cache.json');
const CLIENT_BOOT_METRICS_FILE = path.join(ROOT, 'data', 'client-boot-metrics.json');
const SNCF_RFN_ROUTE_CACHE_VERSION = 'rfn-route-v17';
const SNCF_RFN_SPEED_DATASET = 'vitesse-maximale-nominale-sur-ligne';
const SNCF_RFN_SPEED_GEOJSON_URL = `https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/${SNCF_RFN_SPEED_DATASET}/exports/geojson`;
const SNCF_RFN_SPEED_JSON_URL = `https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/${SNCF_RFN_SPEED_DATASET}/exports/json`;
const SNCF_RFN_SPEED_CACHE_FILE = path.join(ROOT, 'data', 'sncf-rfn-speed-cache.json');
const SNCF_RFN_SPEED_CACHE_VERSION = 'rfn-speed-v1';
const SNCF_RFN_SPEED_SPATIAL_CELL_DEG = 0.08;
const SNCF_RFN_SPEED_FETCH_TIMEOUT_MS = 7000;
const SNCF_RFN_DEFAULT_SPEED_KMH = 100;
const SILLON_CAPACITY_MODEL_VERSION = 'sillon-capacity-v2';
const SNCF_RFN_SPATIAL_CELL_DEG = 0.18;
const POPULATION_TABULAR_RESOURCE_ID = 'be303501-5c46-48a1-87b4-3d198423ff49';
const POPULATION_TABULAR_API_URL = `https://tabular-api.data.gouv.fr/api/resources/${POPULATION_TABULAR_RESOURCE_ID}/data/`;
const POPULATION_TABULAR_PAGE_SIZE = 200;
const ADMIN_USERNAME_KEY = 'xenao';
const LEGACY_STATION_COMMUNE_IDS = Object.freeze({
  PAR: 'PAR_GARE_DU_NORD', COM_75056: 'PAR_GARE_DU_NORD', LYO: 'COM_69123', MAR: 'COM_13055', LIL: 'COM_59350', BOR: 'COM_33063', NAN: 'COM_44109', STR: 'COM_67482', REN: 'COM_35238', TOU: 'COM_31555',
  MON: 'COM_34172', NIC: 'COM_06088', GRE: 'COM_38185', DIJ: 'COM_21231', MET: 'COM_57463', NAN2: 'COM_54395', REI: 'COM_51454', AMI: 'COM_80021',
  ROU: 'COM_76540', LEH: 'COM_76351', BRET: 'COM_91103', LONJ: 'COM_91345', CAE: 'COM_14118', FAL: 'COM_14258', BAY: 'COM_14047', ARP: 'COM_91021',
  CHB: 'COM_50129', BRE: 'COM_29019', QUI: 'COM_29232', LOR: 'COM_56121', VAN: 'COM_56260', STB: 'COM_22278', ANG: 'COM_49007', LEM: 'COM_72181',
  TOU2: 'COM_37261', ORL: 'COM_45234', LIM: 'COM_87085', POI: 'COM_86194', LAR: 'COM_17300', BIA: 'COM_64122', PAU: 'COM_64445', AGE: 'COM_47001',
  CLE: 'COM_63113', STE: 'COM_42218', VAL: 'COM_26362', AVI: 'COM_84007', TOU3: 'COM_83137', CAN: 'COM_06029', PER: 'COM_66136', NIM: 'COM_30189',
  BEZ: 'COM_34032', CAR: 'COM_11069', ALB: 'COM_81004', MUL: 'COM_68224', BES: 'COM_25056', BEL: 'COM_90068', CHA: 'COM_73065', ANN: 'COM_74010',
  MAC: 'COM_71270', AUX: 'COM_89024', TRO: 'COM_10387', DUN: 'COM_59183', CAL: 'COM_62193', ARR: 'COM_62041', VAL2: 'COM_59606', LAV: 'COM_53130',
  LRS: 'COM_85191', NEV: 'COM_58194', BOU: 'COM_18033', CHA2: 'COM_36044'
});
const COMMUNE_DEPARTMENTS = [
  '01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19',
  '2A','2B',
  '21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39',
  '40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59',
  '60','61','62','63','64','65','66','67','68','69','70','71','72','73','74','75','76','77','78','79',
  '80','81','82','83','84','85','86','87','88','89','90','91','92','93','94','95'
];
const TICK_MS = 2000;
// Le tick cadence les calculs économiques, mais les circulations ferroviaires
// suivent strictement l'horloge réelle (vitesses RFN, matériel et arrêts).
const PASSENGER_SIMULATION_VERSION = 4;
const SAVE_EVERY_TICKS = 15;
const ROUTE_CACHE_MAX_ENTRIES = 5000;
const DEFAULT_PASSENGER_TARIFF = 0.08;
const AUTH_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_ACTIVE_WINDOW_MS = 90 * 1000;
const ACTIVITY_HEARTBEAT_INTERVAL_MS = 60 * 1000;
const USER_ACTIVITY_HISTORY_MAX = 2000;
const AUTH_PASSWORD_MIN_LENGTH = 6;
const API_JSON_BODY_LIMIT = 8_000_000;
const BUG_REPORT_MAX_IMAGES = 3;
const BUG_REPORT_MAX_IMAGE_CHARS = 950_000;
const BUG_REPORT_MAX_STORED = 120;
const COMPOSITION_REFUND_RATE = 0.78;
const SNCF_ROUTE_GEOMETRY_CACHE_MAX = 6000;
const SNCF_ROUTE_WORKER_POOL_SIZE = Math.max(1, Math.min(Number(process.env.SILLONS_RFN_WORKERS || 3), Math.max(1, (os.cpus?.().length || 2) - 1), 4));
const SNCF_ROUTE_WORKER_TIMEOUT_MS = 120000;
const SNCF_ROUTE_PREWARM_DELAY_MS = 3500;
// Les passages d'époque sont ralentis par le trafic cumulé requis, sans délai temporel artificiel.
const STARTER_PLAYER_ID = '4c7dfa51-225a-487a-aa42-1b0776c4e1d5';
// Plafond global du billet : volontairement haut pour laisser le joueur arbitrer
// entre revenus et attractivité. À 50 €, les petites lignes deviennent très peu attractives.
const TICKET_PRICE_CAP_ABSOLUTE = 28;
// Départ v49 : aucune ligne, aucun train, aucun salarié. Capital suffisant
// pour un premier achat sérieux, mais insuffisant pour contrôler une métropole.
const STARTING_CASH = 1000000;
// Les recherches sont jouées comme illimitées. Cette limite technique évite seulement les valeurs JS absurdes.
const RESEARCH_TECHNICAL_MAX_LEVEL = 1000000;
const COMPANY_LOGOS = ["steam_front", "winged_wheel", "semaphore", "royal_track", "tunnel_arch", "electric_rail", "mountain_rail", "laurel_wheel", "pantograph", "conductor_cap", "grand_station", "freight_wagon", "star_track", "compass_rail", "monogram_rail", "bridge_truss", "boiler_gauge", "gear_wheel", "lantern_wings", "switch_roundel"];
const ECONOMY = Object.freeze({
  passengerDemandMultiplier: 2.85,
  freightDemandMultiplier: 1.8,
  passengerRevenueMultiplier: 14.0,
  freightRevenueMultiplier: 8.5,
  energyCostMultiplier: 0.34,
  maintenanceCostMultiplier: 0.62,
  lineInfrastructureMaintenancePerKm: 12.6,
  lineCommercialCostThreshold: 4500,
  lineCommercialCostRate: 0.08,
  staffCostDivisor: 82,
  debtInterestPerTick: 0.00012,
  stationLevelCost: 58,
  stationCommerceCost: 64,
  stationMaintenanceCost: 92,
  stationDepotCost: 150,
  ownedStationIncomeBase: 120,
  ownedStationCommerceIncome: 280,
  stationAccessTollBase: 18,
  stationAccessTollCapacityFactor: 0.045,
  idleTrainStorageFactor: 0.000055,
  researchLabBaseCost: 180,
  researchLabEngineerCost: 95
});


const PARIS_TERMINAL_STATIONS = Object.freeze([
  { id: 'PAR_AUSTERLITZ', name: 'Paris Austerlitz', code: '75056', postal: '75013', lat: 48.8417, lon: 2.3659, stationUic: '87547000', stationName: 'Paris Austerlitz', annualPassengers: 23798578 },
  { id: 'PAR_MONTPARNASSE', name: 'Paris Montparnasse', code: '75056', postal: '75015', lat: 48.8406, lon: 2.3195, stationUic: '87391003', stationName: 'Paris Montparnasse', annualPassengers: 68925312 },
  { id: 'PAR_GARE_DE_LYON', name: 'Paris Gare de Lyon', code: '75056', postal: '75012', lat: 48.8443, lon: 2.3730, stationUic: '87686006', stationName: 'Paris Gare de Lyon', annualPassengers: 113224000 },
  { id: 'PAR_GARE_DU_NORD', name: 'Paris Gare du Nord', code: '75056', postal: '75010', lat: 48.8809, lon: 2.3553, stationUic: '87271007', stationName: 'Paris Gare du Nord', annualPassengers: 257024152 },
  { id: 'PAR_GARE_DE_L_EST', name: "Paris Gare de l'Est", code: '75056', postal: '75010', lat: 48.8768, lon: 2.3591, stationUic: '87113001', stationName: 'Paris Est', annualPassengers: 42725621 },
  { id: 'PAR_SAINT_LAZARE', name: 'Paris Saint-Lazare', code: '75056', postal: '75008', lat: 48.8763, lon: 2.3249, stationUic: '87384008', stationName: 'Paris Saint-Lazare', annualPassengers: 114093491 }
]);
const PARIS_TERMINAL_SOURCE = 'sncf-gares-de-voyageurs + frequentation-gares-2024';
const PARIS_INTERCHANGE_SOURCE = 'sillons-manual-rer-interchange';
// Cette gare est publiée dans le référentiel « gares de voyageurs », mais pas
// dans « liste-des-gares » utilisé pour la génération générale du monde.
// Le fallback reste sans effet dès que la source principale l'expose.
const MISSING_SNCF_STATION_FALLBACK_SOURCE = 'sncf-gares-de-voyageurs fallback';
const MISSING_SNCF_STATION_FALLBACKS = Object.freeze([
  {
    id: 'GARE_87382861',
    code: '78646',
    name: 'Versailles-Rive-Droite',
    postal: '78000',
    lat: 48.8096525,
    lon: 2.1347523,
    stationUic: '87382861',
    stationIdGare: 'e9cdfa6c-5807-4882-beb4-e33e07e470f9',
    stationName: 'Versailles Rive Droite'
  }
]);
const PARIS_INTERCHANGE_STATIONS = Object.freeze([
  {
    id: 'PAR_CHATELET_LES_HALLES',
    code: '75056',
    name: 'Châtelet-les-Halles',
    postal: '75001',
    lat: 48.861742,
    lon: 2.34701,
    stationName: 'Châtelet-les-Halles',
    stationUic: '',
    annualPassengers: 0,
    codeLignes: ['981000', '984000'],
    aliases: ['Chatelet les Halles', 'Châtelet Les Halles', 'Les Halles']
  }
]);
const PARIS_COMMUNE_POPULATION = 2133111;

const STATION_DISPLAY_NAME_ALIASES = Object.freeze({
  'paris-vaugirard': 'Paris Montparnasse',
  'paris vaugirard': 'Paris Montparnasse',
  'paris-vaugirard-ceinture': 'Paris Montparnasse',
  'paris vaugirard ceinture': 'Paris Montparnasse'
});
const MONTPARNASSE_STATION_UIC_ALIASES = new Set(['87391003', '87391102']);

function canonicalStationDisplayName(name) {
  const raw = String(name || '').trim();
  if (!raw) return raw;
  const normalized = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

function canonicalizeStationDisplay(station) {
  if (!station || typeof station !== 'object') return station;
  const next = { ...station };
  const uic = String(next.stationUic || next.codeUic || '').split(',')[0].trim();
  const id = String(next.id || '').trim();
  const forcedMontparnasse = id === 'PAR_MONTPARNASSE' || MONTPARNASSE_STATION_UIC_ALIASES.has(uic);
  const canonicalName = forcedMontparnasse ? 'Paris Montparnasse' : canonicalStationDisplayName(next.name);
  if (canonicalName && canonicalName !== next.name) next.name = canonicalName;
  const canonicalStationName = forcedMontparnasse ? 'Paris Montparnasse' : canonicalStationDisplayName(next.stationName || next.name);
  if (canonicalStationName && canonicalStationName !== next.stationName) next.stationName = canonicalStationName;
  return next;
}

function canonicalizeStationLabelText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/Paris[- ]Vaugirard(?:[- ]Ceinture)?/gi, 'Paris Montparnasse')
    .replace(/Paris Montparnasse[- ]Ceinture/gi, 'Paris Montparnasse');
}

function canonicalizePersistedStationLabels(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) {
      const value = obj[i];
      if (typeof value === 'string') obj[i] = canonicalizeStationLabelText(value);
      else canonicalizePersistedStationLabels(value);
    }
    return obj;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') obj[key] = canonicalizeStationLabelText(value);
    else canonicalizePersistedStationLabels(value);
  }
  return obj;
}

const DEPARTMENT_NAME_TO_CODE = Object.freeze({
  AIN: '01',
  AISNE: '02',
  ALLIER: '03',
  'ALPES-DE-HAUTE-PROVENCE': '04',
  'HAUTES-ALPES': '05',
  'ALPES-MARITIMES': '06',
  ARDECHE: '07',
  ARDENNES: '08',
  ARIEGE: '09',
  AUBE: '10',
  AUDE: '11',
  AVEYRON: '12',
  'BOUCHES-DU-RHONE': '13',
  CALVADOS: '14',
  CANTAL: '15',
  CHARENTE: '16',
  'CHARENTE-MARITIME': '17',
  CHER: '18',
  CORREZE: '19',
  'CORSE-DU-SUD': '2A',
  'HAUTE-CORSE': '2B',
  "COTE-D'OR": '21',
  'COTES-D\'ARMOR': '22',
  CREUSE: '23',
  DORDOGNE: '24',
  DOUBS: '25',
  DROME: '26',
  EURE: '27',
  'EURE-ET-LOIR': '28',
  FINISTERE: '29',
  GARD: '30',
  'HAUTE-GARONNE': '31',
  GERS: '32',
  GIRONDE: '33',
  HERAULT: '34',
  'ILLE-ET-VILAINE': '35',
  INDRE: '36',
  'INDRE-ET-LOIRE': '37',
  ISERE: '38',
  JURA: '39',
  LANDES: '40',
  'LOIR-ET-CHER': '41',
  LOIRE: '42',
  'HAUTE-LOIRE': '43',
  'LOIRE-ATLANTIQUE': '44',
  LOIRET: '45',
  LOT: '46',
  'LOT-ET-GARONNE': '47',
  LOZERE: '48',
  'MAINE-ET-LOIRE': '49',
  MANCHE: '50',
  MARNE: '51',
  'HAUTE-MARNE': '52',
  MAYENNE: '53',
  'MEURTHE-ET-MOSELLE': '54',
  MEUSE: '55',
  MORBIHAN: '56',
  MOSELLE: '57',
  NIEVRE: '58',
  NORD: '59',
  OISE: '60',
  ORNE: '61',
  'PAS-DE-CALAIS': '62',
  'PUY-DE-DOME': '63',
  'PYRENEES-ATLANTIQUES': '64',
  'HAUTES-PYRENEES': '65',
  'PYRENEES-ORIENTALES': '66',
  'BAS-RHIN': '67',
  'HAUT-RHIN': '68',
  RHONE: '69',
  'HAUTE-SAONE': '70',
  'SAONE-ET-LOIRE': '71',
  SARTHE: '72',
  SAVOIE: '73',
  'HAUTE-SAVOIE': '74',
  PARIS: '75',
  'SEINE-MARITIME': '76',
  'SEINE-ET-MARNE': '77',
  YVELINES: '78',
  'DEUX-SEVRES': '79',
  SOMME: '80',
  TARN: '81',
  'TARN-ET-GARONNE': '82',
  VAR: '83',
  VAUCLUSE: '84',
  VENDEE: '85',
  VIENNE: '86',
  'HAUTE-VIENNE': '87',
  VOSGES: '88',
  YONNE: '89',
  'TERRITOIRE-DE-BELFORT': '90',
  ESSONNE: '91',
  'HAUTS-DE-SEINE': '92',
  'SEINE-SAINT-DENIS': '93',
  'VAL-DE-MARNE': '94',
  "VAL-D'OISE": '95'
});

const LEGACY_EXPLICIT_STATION_UIC_IDS = Object.freeze({
  PAR_AUSTERLITZ: '87547000',
  PAR_MONTPARNASSE: '87391003',
  PAR_GARE_DE_LYON: '87686006',
  PAR_GARE_DU_NORD: '87271007',
  PAR_GARE_DE_L_EST: '87113001',
  PAR_SAINT_LAZARE: '87384008'
});

const PASSENGER_COMPOSITION_VARIANTS = Object.freeze({
  standard: { id: 'standard', name: 'Standard', shortLabel: 'Standard', description: 'Voiture polyvalente équilibrée pour la majorité des lignes voyageurs.', asset: '/assets/composition/variants/passenger_standard.png', capacityMultiplier: 1, speedMultiplier: 1, energyMultiplier: 1, maintenanceMultiplier: 1, reliabilityDelta: 0, comfortDelta: 0 },
  commuter: { id: 'commuter', name: 'Banlieue dense', shortLabel: 'Banlieue', description: 'Plus de places debout et de portes, idéale pour les lignes tendues du quotidien.', asset: '/assets/composition/variants/passenger_commuter.png', capacityMultiplier: 1.18, speedMultiplier: 1.02, energyMultiplier: 1.04, maintenanceMultiplier: 1.05, reliabilityDelta: -0.008, comfortDelta: -0.1 },
  comfort: { id: 'comfort', name: 'Grand confort', shortLabel: 'Confort', description: 'Moins de sièges mais meilleure image, adaptée aux dessertes premium et longues.', asset: '/assets/composition/variants/passenger_comfort.png', capacityMultiplier: 0.88, speedMultiplier: 0.98, energyMultiplier: 1.05, maintenanceMultiplier: 1.08, reliabilityDelta: 0.008, comfortDelta: 0.14 },
  sleeper: { id: 'sleeper', name: 'Couchettes', shortLabel: 'Couchettes', description: 'Voiture de nuit haut de gamme, capacité réduite mais très confortable.', asset: '/assets/composition/variants/passenger_sleeper.png', capacityMultiplier: 0.68, speedMultiplier: 0.94, energyMultiplier: 1.08, maintenanceMultiplier: 1.14, reliabilityDelta: -0.004, comfortDelta: 0.2 },
  midi_standard: { id: 'midi_standard', name: 'Voiture Midi standard', shortLabel: 'Midi std.', description: 'Voiture métallique moderne pour les premières locomotives électriques. Offre équilibrée et plus fiable.', asset: '/assets/composition/era2/passenger_midi_standard.png', capacityMultiplier: 1.06, speedMultiplier: 1.04, energyMultiplier: 0.98, maintenanceMultiplier: 0.94, reliabilityDelta: 0.018, comfortDelta: 0.04, requiredEpoch: 1, requiredTech: 'diesel_passenger_locomotives', requiredModelEpoch: 1 },
  midi_commuter: { id: 'midi_commuter', name: 'Voiture Midi banlieue', shortLabel: 'Midi banlieue', description: 'Voiture dense à accès rapides, adaptée aux axes électrifiés à fort trafic.', asset: '/assets/composition/era2/passenger_midi_commuter.png', capacityMultiplier: 1.26, speedMultiplier: 1.05, energyMultiplier: 1.02, maintenanceMultiplier: 0.98, reliabilityDelta: 0.01, comfortDelta: -0.05, requiredEpoch: 1, requiredTech: 'diesel_passenger_locomotives', requiredModelEpoch: 1 },
  midi_express: { id: 'midi_express', name: 'Voiture Midi express', shortLabel: 'Midi express', description: 'Voiture plus confortable et rapide, pensée pour les services régionaux électrifiés de qualité.', asset: '/assets/composition/era2/passenger_midi_express.png', capacityMultiplier: 0.96, speedMultiplier: 1.08, energyMultiplier: 1.0, maintenanceMultiplier: 1.02, reliabilityDelta: 0.02, comfortDelta: 0.12, requiredEpoch: 1, requiredTech: 'diesel_passenger_locomotives', requiredModelEpoch: 1 },
  midi_sleeper: { id: 'midi_sleeper', name: 'Voiture Midi couchettes', shortLabel: 'Midi nuit', description: 'Voiture longue distance nocturne, coûteuse mais très attractive sur les liaisons de nuit.', asset: '/assets/composition/era2/passenger_midi_sleeper.png', capacityMultiplier: 0.72, speedMultiplier: 1.02, energyMultiplier: 1.04, maintenanceMultiplier: 1.10, reliabilityDelta: 0.005, comfortDelta: 0.24, requiredEpoch: 1, requiredTech: 'diesel_passenger_locomotives', requiredModelEpoch: 1 }
});

const FREIGHT_COMPOSITION_VARIANTS = Object.freeze({
  covered: { id: 'covered', name: 'Wagon couvert', shortLabel: 'Couvert', description: 'Marchandises générales et palettes. Référence polyvalente.', cargoType: 'Marchandises générales', asset: '/assets/composition/variants/freight_covered.png', capacityMultiplier: 1, speedMultiplier: 1, energyMultiplier: 1, maintenanceMultiplier: 1, reliabilityDelta: 0, revenueMultiplier: 1 },
  tank: { id: 'tank', name: 'Wagon citerne', shortLabel: 'Citerne', description: 'Liquides, carburants et produits chimiques à forte valeur.', cargoType: 'Liquides / carburants', asset: '/assets/composition/variants/freight_tank.png', capacityMultiplier: 0.92, speedMultiplier: 0.95, energyMultiplier: 1.08, maintenanceMultiplier: 1.09, reliabilityDelta: -0.01, revenueMultiplier: 1.18 },
  hopper: { id: 'hopper', name: 'Trémie vrac', shortLabel: 'Trémie', description: 'Vracs lourds : céréales, minerais, granulats. Très capacitaire.', cargoType: 'Vrac lourd', asset: '/assets/composition/variants/freight_hopper.png', capacityMultiplier: 1.22, speedMultiplier: 0.92, energyMultiplier: 1.11, maintenanceMultiplier: 1.07, reliabilityDelta: -0.016, revenueMultiplier: 0.94 },
  flatbed: { id: 'flatbed', name: 'Plat / ranchers', shortLabel: 'Plat', description: 'Bois, acier, engins et charges longues.', cargoType: 'Charges longues', asset: '/assets/composition/variants/freight_flatbed.png', capacityMultiplier: 0.96, speedMultiplier: 0.98, energyMultiplier: 0.98, maintenanceMultiplier: 0.98, reliabilityDelta: 0.004, revenueMultiplier: 1.04 },
  reefer: { id: 'reefer', name: 'Frigorifique', shortLabel: 'Frigo', description: 'Produits frais à forte valeur, wagon plus coûteux à exploiter.', cargoType: 'Denrées fraîches', asset: '/assets/composition/variants/freight_reefer.png', capacityMultiplier: 0.82, speedMultiplier: 0.96, energyMultiplier: 1.12, maintenanceMultiplier: 1.12, reliabilityDelta: -0.004, revenueMultiplier: 1.25 },
  container: { id: 'container', name: 'Porte-conteneurs', shortLabel: 'Conteneurs', description: 'Flux intermodaux rapides, bien adaptés aux longues distances.', cargoType: 'Intermodal', asset: '/assets/composition/variants/freight_container.png', capacityMultiplier: 1.08, speedMultiplier: 1.02, energyMultiplier: 1.04, maintenanceMultiplier: 1.04, reliabilityDelta: 0.005, revenueMultiplier: 1.12 },
  midi_covered: { id: 'midi_covered', name: 'Couvert Midi métallique', shortLabel: 'Midi couvert', description: 'Wagon couvert renforcé pour marchandises générales sous caténaires pionnières.', cargoType: 'Marchandises générales', asset: '/assets/composition/era2/freight_midi_covered.png', capacityMultiplier: 1.12, speedMultiplier: 1.04, energyMultiplier: 0.98, maintenanceMultiplier: 0.96, reliabilityDelta: 0.014, revenueMultiplier: 1.04, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
  midi_tank: { id: 'midi_tank', name: 'Citerne Midi', shortLabel: 'Midi citerne', description: 'Citerne moderne pour liquides industriels, plus rentable mais plus exigeante.', cargoType: 'Liquides / carburants', asset: '/assets/composition/era2/freight_midi_tank.png', capacityMultiplier: 1.00, speedMultiplier: 1.00, energyMultiplier: 1.04, maintenanceMultiplier: 1.06, reliabilityDelta: 0.002, revenueMultiplier: 1.22, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
  midi_hopper: { id: 'midi_hopper', name: 'Trémie Midi', shortLabel: 'Midi trémie', description: 'Trémie lourde pour minerais et vracs, très capacitaire sur les axes industriels.', cargoType: 'Vrac lourd', asset: '/assets/composition/era2/freight_midi_hopper.png', capacityMultiplier: 1.34, speedMultiplier: 0.96, energyMultiplier: 1.08, maintenanceMultiplier: 1.05, reliabilityDelta: -0.006, revenueMultiplier: 0.98, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
  midi_flatbed: { id: 'midi_flatbed', name: 'Plat Midi ranchers', shortLabel: 'Midi plat', description: 'Wagon plat modernisé pour acier, bois et engins lourds.', cargoType: 'Charges longues', asset: '/assets/composition/era2/freight_midi_flatbed.png', capacityMultiplier: 1.05, speedMultiplier: 1.02, energyMultiplier: 0.98, maintenanceMultiplier: 0.96, reliabilityDelta: 0.012, revenueMultiplier: 1.08, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
  midi_reefer: { id: 'midi_reefer', name: 'Frigorifique Midi', shortLabel: 'Midi frigo', description: 'Fourgon frigorifique électrique, faible tonnage mais forte valeur transportée.', cargoType: 'Denrées fraîches', asset: '/assets/composition/era2/freight_midi_reefer.png', capacityMultiplier: 0.90, speedMultiplier: 1.03, energyMultiplier: 1.10, maintenanceMultiplier: 1.10, reliabilityDelta: 0.004, revenueMultiplier: 1.30, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 },
  midi_container: { id: 'midi_container', name: 'Porte-caisses Midi', shortLabel: 'Midi caisses', description: 'Précurseur intermodal pour caisses et conteneurs légers, performant sur longues distances.', cargoType: 'Intermodal', asset: '/assets/composition/era2/freight_midi_container.png', capacityMultiplier: 1.18, speedMultiplier: 1.06, energyMultiplier: 1.02, maintenanceMultiplier: 1.02, reliabilityDelta: 0.016, revenueMultiplier: 1.16, requiredEpoch: 1, requiredTech: 'midi_freight_stock', requiredModelEpoch: 1 }
});

function compositionVariantsForMode(mode) {
  const source = mode === 'passenger_loco' ? PASSENGER_COMPOSITION_VARIANTS : mode === 'freight_loco' ? FREIGHT_COMPOSITION_VARIANTS : null;
  if (!source) return [];
  return Object.values(source).map(variant => ({
    id: variant.id,
    name: variant.name,
    shortLabel: variant.shortLabel,
    description: variant.description,
    cargoType: variant.cargoType || null,
    asset: variant.asset,
    stats: {
      capacityMultiplier: variant.capacityMultiplier,
      speedMultiplier: variant.speedMultiplier,
      energyMultiplier: variant.energyMultiplier,
      maintenanceMultiplier: variant.maintenanceMultiplier,
      reliabilityDelta: variant.reliabilityDelta,
      comfortDelta: variant.comfortDelta || 0,
      revenueMultiplier: variant.revenueMultiplier || 1
    },
    requiredEpoch: variant.requiredEpoch || 0,
    requiredTech: variant.requiredTech || null,
    requiredModelEpoch: variant.requiredModelEpoch || 0
  }));
}

function compositionVariantForMode(mode, id) {
  const source = mode === 'passenger_loco' ? PASSENGER_COMPOSITION_VARIANTS : mode === 'freight_loco' ? FREIGHT_COMPOSITION_VARIANTS : null;
  if (!source) return null;
  const first = Object.values(source)[0] || null;
  return source[id] || first;
}

function compositionVariantUnlockedForPlayer(player, model, variant) {
  if (!variant) return false;
  if ((variant.requiredEpoch || 0) > (player?.epoch || 0)) return false;
  if ((variant.requiredModelEpoch || 0) > (model?.unlockEpoch || 0)) return false;
  if (variant.requiredTech && !hasTech(player, variant.requiredTech)) return false;
  return true;
}



const WORLD = buildWorld();
const BALANCE = buildBalance();
let stationAliasMap = new Map();
let state = loadOrCreateState();
let communeCache = loadCommuneCache();
remapStateStationAliases();
let tickCount = 0;
let publicWorldCache = { key: '', value: null };
let communeRefreshPromise = null;
let lastClientBootMetrics = null;

async function ensureCommuneCacheReady(force = false) {
  if (!force && communeCacheUsable(communeCache) && communeCache.status !== 'loading') return communeCache;
  if (!communeRefreshPromise) {
    communeRefreshPromise = refreshCommuneCache(force).finally(() => {
      communeRefreshPromise = null;
    });
  }
  return communeRefreshPromise;
}

function communeCacheUsable(cache = communeCache) {
  if (cache?.status === 'stale-cache') return false;
  const byId = cache?.byId || {};
  const count = Object.keys(byId).length;
  if (count < COMMUNE_CACHE_MIN_READY_COUNT) return false;
  return Object.values(byId).some(station => station?.hasPassengerStation) && Object.values(byId).some(station => station?.hasFreightStation);
}

async function waitForCommuneCache(maxMs = 3500) {
  try {
    await Promise.race([
      ensureCommuneCacheReady(false),
      new Promise(resolve => setTimeout(resolve, maxMs))
    ]);
  } catch (error) {
    console.warn('Chargement communes différé:', error.message);
  }
}

function warmSncfRailShapeLinesCache() {
  loadSncfRailShapeLines()
    .then(lines => console.log(`Cache RFN SNCF prêt : ${lines.length} géométrie(s).`))
    .catch(error => console.warn('Préchargement RFN SNCF différé :', error.message));
}

if (isMainThread) {
  setInterval(() => {
    simulateTick();
    tickCount += 1;
    if (tickCount % SAVE_EVERY_TICKS === 0) saveState();
  }, TICK_MS);

  process.on('SIGINT', () => {
    saveState();
    process.exit(0);
  });

  // Le cache RFN pèse plusieurs Mo et son indexation est synchrone. Le charger
  // au démarrage bloquait toutes les premières requêtes, dont /api/state. Les
  // géométries sont maintenant chargées à la demande lors d’un calcul d’itinéraire.

  const server = http.createServer(async (req, res) => {
    try {
      res.__sillonsAcceptEncoding = req.headers['accept-encoding'] || '';
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
        return;
      }
      serveStatic(req, res, url);
    } catch (error) {
      sendJson(res, error.statusCode || 500, { ok: false, error: error.message });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Sillons lancé sur http://${HOST}:${PORT}`);
    console.log(`Workers RFN actifs : ${SNCF_ROUTE_WORKER_POOL_SIZE} thread(s).`);
    refreshCommuneCache(false).catch(error => console.warn('Chargement des populations communales impossible:', error.message));
  });
}
