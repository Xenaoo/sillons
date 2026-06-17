'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const SAVE_FILE = path.join(ROOT, 'data', 'save.json');
const CHANGELOG_FILE = path.join(ROOT, 'changelog.md');
const PROJECT_VERSION = 'v62.26.1';
const STATE_SCHEMA_VERSION = 91;
const COMMUNE_CACHE_FILE = path.join(ROOT, 'data', 'communes-5000-population.json');
const MIN_COMMUNE_POPULATION = 0;
const COMMUNE_CACHE_MIN_READY_COUNT = 3000;
const COMMUNE_CACHE_SOURCE_VERSION = 8;
const COMMUNE_API_URL = 'https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,codeDepartement,population,centre&geometry=centre&format=json';
const SNCF_STATION_DATASET = 'liste-des-gares';
const SNCF_STATION_API_URL = `https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/${SNCF_STATION_DATASET}/records`;
const SNCF_STATION_EXPORT_URL = `https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/${SNCF_STATION_DATASET}/exports/json`;
const SNCF_STATION_PAGE_SIZE = 100;
const SNCF_RFN_GEOJSON_URL = 'https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/formes-des-lignes-du-rfn/exports/geojson';
const SNCF_RFN_CACHE_FILE = path.join(ROOT, 'data', 'sncf-rfn-lines-cache.json');
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
const SAVE_EVERY_TICKS = 15;
const ROUTE_CACHE_MAX_ENTRIES = 5000;
const DEFAULT_PASSENGER_TARIFF = 0.08;
const AUTH_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const AUTH_PASSWORD_MIN_LENGTH = 6;
const COMPOSITION_REFUND_RATE = 0.78;
const SNCF_ROUTE_GEOMETRY_CACHE_MAX = 1800;
// Les passages d'époque sont ralentis par le trafic cumulé requis, sans délai temporel artificiel.
const STARTER_PLAYER_ID = '4c7dfa51-225a-487a-aa42-1b0776c4e1d5';
// Plafond global du billet : volontairement haut pour laisser le joueur arbitrer
// entre revenus et attractivité. À 50 €, les petites lignes deviennent très peu attractives.
const TICKET_PRICE_CAP_ABSOLUTE = 28;
// Départ v49 : aucune ligne, aucun train, aucun salarié. Capital suffisant
// pour un premier achat sérieux, mais insuffisant pour contrôler une métropole.
const STARTING_CASH = 500000;
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
const PARIS_COMMUNE_POPULATION = 2133111;

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

setInterval(() => {
  simulateTick();
  tickCount += 1;
  if (tickCount % SAVE_EVERY_TICKS === 0) saveState();
}, TICK_MS);

process.on('SIGINT', () => {
  saveState();
  process.exit(0);
});

function warmSncfRailShapeLinesCache() {
  loadSncfRailShapeLines()
    .then(lines => console.log(`Cache RFN SNCF prêt : ${lines.length} géométrie(s).`))
    .catch(error => console.warn('Préchargement RFN SNCF différé :', error.message));
}

setTimeout(warmSncfRailShapeLinesCache, 0);

const server = http.createServer(async (req, res) => {
  try {
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
  refreshCommuneCache(false).catch(error => console.warn('Chargement des populations communales impossible:', error.message));
});

async function handleApi(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    const body = await readBody(req);
    const result = registerAccount(body, req);
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readBody(req);
    const result = loginAccount(body, req);
    sendJson(res, result.ok ? 200 : 401, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const auth = authenticateRequest(req, url, {});
    if (auth) revokeSession(auth.user, auth.token);
    saveState();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const auth = authenticateRequest(req, url, {});
    const playerId = auth?.user?.playerId || '';
    await waitForCommuneCache(3500);
    sendJson(res, 200, publicState(playerId, auth?.user || null));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/changelog') {
    try {
      const changelog = fs.readFileSync(CHANGELOG_FILE, 'utf8');
      sendJson(res, 200, { ok: true, version: PROJECT_VERSION, changelog });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: `Changelog indisponible : ${error.message}` });
    }
    return;
  }


  if (req.method === 'GET' && url.pathname === '/api/sncf/route-geometry') {
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';
    const geometry = await sncfRouteGeometryForStations(from, to);
    sendJson(res, 200, {
      ok: true,
      from,
      to,
      geometry,
      distance: Math.round(polylineDistanceKm(geometry || [])),
      pointCount: Array.isArray(geometry) ? geometry.length : 0,
      source: geometry?.length ? 'sncf-formes-des-lignes-du-rfn' : 'none'
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/player') {
    const body = await readBody(req);
    const auth = authenticateRequest(req, url, body);
    if (!isAdminUser(auth?.user)) {
      sendJson(res, 403, { ok: false, error: 'Accès admin refusé.' });
      return;
    }
    const result = adminUpdatePlayer(body || {}, auth.user);
    sendJson(res, result.ok ? 200 : 400, { ...result, state: publicState(auth.user.playerId, auth.user) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/new-player') {
    if (Object.keys(state.users || {}).length) {
      sendJson(res, 401, { ok: false, error: 'Création directe désactivée : Crée un compte ou connecte-toi.' });
      return;
    }
    const body = await readBody(req);
    const player = createPlayer(body);
    sendJson(res, 200, { ok: true, playerId: player.id, state: publicState(player.id, null) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/action') {
    const body = await readBody(req);
    const auth = authenticateRequest(req, url, body);
    if (Object.keys(state.users || {}).length && !auth) {
      sendJson(res, 401, { ok: false, error: 'Connexion requise.' });
      return;
    }
    const playerId = auth?.user?.playerId || body.playerId || '';
    const playerBefore = state.players?.[playerId] || null;
    const cashBefore = Number(playerBefore?.cash);
    const result = await applyAction(playerId, body.type, body.payload || {});
    const playerAfter = state.players?.[playerId] || null;
    const cashAfter = Number(playerAfter?.cash);
    const cashDelta = Number.isFinite(cashBefore) && Number.isFinite(cashAfter)
      ? Math.round(cashAfter - cashBefore)
      : 0;
    sendJson(res, result.ok ? 200 : 400, { ...result, cashDelta, state: publicState(playerId, auth?.user || null) });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/communes/search') {
    const q = url.searchParams.get('q') || '';
    await waitForCommuneCache(3500);
    sendJson(res, 200, { ok: true, status: communeCache.status, results: searchCommuneStations(q, 30) });
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Route API inconnue.' });
}

function serveStatic(req, res, url) {
  let filePath;
  try {
    filePath = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  if (filePath === '/') filePath = '/index.html';
  const absolute = path.resolve(PUBLIC_DIR, `.${filePath}`);
  const relative = path.relative(PUBLIC_DIR, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(absolute, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(absolute).toLowerCase();
    const cacheControl = ['.png', '.jpg', '.jpeg', '.webp', '.ico'].includes(ext)
      ? 'public, max-age=604800, immutable'
      : 'no-store';
    res.writeHead(200, { 'Content-Type': mimeType(absolute), 'Cache-Control': cacheControl });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      data += chunk;
      if (data.length > 1_000_000) {
        tooLarge = true;
        reject(httpError(413, 'Payload trop volumineux.'));
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(httpError(400, 'JSON invalide.'));
      }
    });
    req.on('error', reject);
  });
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function normalizeUsername(raw) {
  const username = String(raw || '').trim();
  const key = username.toLowerCase();
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    return { ok: false, error: 'Identifiant invalide : 3 à 32 caractères, lettres, chiffres, point, tiret ou underscore.' };
  }
  return { ok: true, username, key };
}

function passwordError(raw) {
  const password = String(raw || '');
  if (password.length < AUTH_PASSWORD_MIN_LENGTH) return `Mot de passe trop court : ${AUTH_PASSWORD_MIN_LENGTH} caractères minimum.`;
  if (password.length > 160) return 'Mot de passe trop long.';
  return '';
}

function passwordHash(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 64).toString('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function createUserRecord(username, password, playerId) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    id: crypto.randomUUID(),
    username,
    usernameKey: username.toLowerCase(),
    playerId,
    passwordSalt: salt,
    passwordHash: passwordHash(password, salt),
    sessions: {},
    createdAt: Date.now(),
    lastLoginAt: null
  };
}


function normalizeLoginHistory(raw, fallbackLastLoginAt = null) {
  const values = Array.isArray(raw) ? raw : [];
  const cleaned = values
    .map(entry => {
      const at = Number(entry?.at ?? entry?.time ?? entry);
      if (!Number.isFinite(at) || at <= 0) return null;
      return {
        at,
        userAgent: cleanOptionalText(entry?.userAgent || '', 140),
        ip: cleanOptionalText(entry?.ip || '', 80)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at);
  const fallback = Number(fallbackLastLoginAt || 0);
  if (!cleaned.length && Number.isFinite(fallback) && fallback > 0) cleaned.push({ at: fallback, userAgent: '', ip: '' });
  return cleaned.slice(-250);
}

function clientIpFromRequest(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req?.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}

function recordUserLogin(user, req = null) {
  if (!user) return;
  user.loginHistory = normalizeLoginHistory(user.loginHistory, user.lastLoginAt);
  user.loginHistory.push({
    at: Date.now(),
    userAgent: cleanOptionalText(req?.headers?.['user-agent'] || '', 140),
    ip: cleanOptionalText(clientIpFromRequest(req), 80)
  });
  user.loginHistory = user.loginHistory.slice(-250);
  user.lastLoginAt = user.loginHistory[user.loginHistory.length - 1]?.at || Date.now();
}

function isAdminUser(user) {
  return String(user?.usernameKey || '').toLowerCase() === ADMIN_USERNAME_KEY;
}

function normalizeUsers(raw = {}) {
  const out = {};
  const entries = Array.isArray(raw) ? raw.map(u => [u?.usernameKey || u?.username, u]) : Object.entries(raw || {});
  const now = Date.now();
  for (const [, value] of entries) {
    if (!value || typeof value !== 'object') continue;
    const parsed = normalizeUsername(value.username || value.usernameKey || '');
    if (!parsed.ok || !value.passwordHash || !value.passwordSalt || !value.playerId) continue;
    const sessions = {};
    for (const [hash, session] of Object.entries(value.sessions || {})) {
      const expiresAt = Number(session?.expiresAt || 0);
      if (hash && expiresAt > now) sessions[hash] = {
        createdAt: Number(session.createdAt || now),
        lastSeenAt: Number(session.lastSeenAt || now),
        expiresAt
      };
    }
    out[parsed.key] = {
      id: value.id || crypto.randomUUID(),
      username: parsed.username,
      usernameKey: parsed.key,
      playerId: String(value.playerId),
      passwordSalt: String(value.passwordSalt),
      passwordHash: String(value.passwordHash),
      sessions,
      createdAt: Number(value.createdAt || now),
      lastLoginAt: value.lastLoginAt || null,
      loginHistory: normalizeLoginHistory(value.loginHistory, value.lastLoginAt)
    };
  }
  return out;
}

function verifyPassword(user, password) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const expected = Buffer.from(String(user.passwordHash), 'hex');
  const actual = Buffer.from(passwordHash(password, user.passwordSalt), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function issueSession(user, req = null) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(token);
  user.sessions = user.sessions && typeof user.sessions === 'object' ? user.sessions : {};
  user.sessions[tokenHash] = {
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    expiresAt: Date.now() + AUTH_SESSION_MAX_AGE_MS
  };
  recordUserLogin(user, req);
  return token;
}

function revokeSession(user, token) {
  if (!user || !token) return;
  const tokenHash = sha256(token);
  if (user.sessions?.[tokenHash]) delete user.sessions[tokenHash];
}

function authTokenFromRequest(req, url, body = {}) {
  const header = String(req.headers.authorization || '');
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1];
  return String(bearer || body.authToken || url.searchParams.get('authToken') || '').trim();
}

function authenticateRequest(req, url, body = {}) {
  const token = authTokenFromRequest(req, url, body);
  if (!token) return null;
  const tokenHash = sha256(token);
  const now = Date.now();
  for (const user of Object.values(state.users || {})) {
    const session = user.sessions?.[tokenHash];
    if (!session) continue;
    if (Number(session.expiresAt || 0) <= now) {
      delete user.sessions[tokenHash];
      return null;
    }
    session.lastSeenAt = now;
    return { user, token, player: state.players?.[user.playerId] || null };
  }
  return null;
}

function authPayload(user, token) {
  return {
    token,
    username: user.username,
    playerId: user.playerId,
    isAdmin: isAdminUser(user),
    expiresAt: user.sessions?.[sha256(token)]?.expiresAt || null
  };
}

function createTutorialState(raw = null) {
  const t = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: t.enabled !== false,
    completed: Boolean(t.completed),
    stepId: cleanText(t.stepId || 'welcome', 80),
    actionLog: t.actionLog && typeof t.actionLog === 'object' ? { ...t.actionLog } : {},
    startedAt: Number(t.startedAt || Date.now()),
    updatedAt: Number(t.updatedAt || Date.now())
  };
}

function markTutorialAction(player, key) {
  if (!player || !key) return;
  player.tutorial = createTutorialState(player.tutorial);
  player.tutorial.actionLog[key] = true;
  player.tutorial.updatedAt = Date.now();
}

function actionTutorial(player, payload = {}) {
  player.tutorial = createTutorialState(player.tutorial);
  const op = String(payload.op || '');
  if (op === 'disable') {
    player.tutorial.enabled = false;
    player.tutorial.updatedAt = Date.now();
    return ok('Tutoriel masqué.');
  }
  if (op === 'restart') {
    player.tutorial = createTutorialState({ enabled: true, completed: false, stepId: 'welcome', actionLog: {} });
    return ok('Tutoriel relancé.');
  }
  if (op === 'complete') {
    player.tutorial.completed = true;
    player.tutorial.enabled = false;
    player.tutorial.stepId = 'done';
    player.tutorial.updatedAt = Date.now();
    return ok('Tutoriel terminé.');
  }
  const next = cleanText(payload.stepId || payload.nextStepId || 'welcome', 80);
  player.tutorial.enabled = true;
  player.tutorial.stepId = next;
  player.tutorial.updatedAt = Date.now();
  return ok('Tutoriel mis à jour.');
}


function claimableStarterPlayer() {
  const linked = new Set(Object.values(state.users || {}).map(user => user.playerId).filter(Boolean));
  const preferred = state.players?.[STARTER_PLAYER_ID];
  if (preferred && !linked.has(preferred.id)) return preferred;
  return null;
}

function updateClaimedPlayerIdentity(player, body = {}) {
  if (!player) return null;
  const nextName = cleanText(body.companyName || body.name || player.name || 'Compagnie', 28);
  const nextColor = validateColor(body.color) || player.color || randomColor();
  player.name = nextName;
  player.color = nextColor;
  player.logo = sanitizeCompanyLogo(body.logo || player.logo);
  player.lastSeen = Date.now();
  notify(player, 'Compte joueur créé : Cette compagnie est maintenant liée à ton identifiant.');
  return player;
}

function registerAccount(body = {}, req = null) {
  const parsed = normalizeUsername(body.username);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const passError = passwordError(body.password);
  if (passError) return { ok: false, error: passError };
  state.users = normalizeUsers(state.users || {});
  if (state.users[parsed.key]) return { ok: false, error: 'Cet identifiant existe déjà.' };
  const starter = !Object.keys(state.users).length ? claimableStarterPlayer() : null;
  const player = starter
    ? updateClaimedPlayerIdentity(starter, body)
    : createPlayer({
      name: body.companyName || body.name || `Compagnie ${parsed.username}`,
      color: body.color,
      logo: body.logo
    });
  const user = createUserRecord(parsed.username, body.password, player.id);
  const token = issueSession(user, req);
  state.users[parsed.key] = user;
  saveState();
  return { ok: true, auth: authPayload(user, token), playerId: player.id, state: publicState(player.id, user) };
}

function loginAccount(body = {}, req = null) {
  const parsed = normalizeUsername(body.username);
  if (!parsed.ok) return { ok: false, error: 'Identifiant ou mot de passe incorrect.' };
  state.users = normalizeUsers(state.users || {});
  const user = state.users[parsed.key];
  if (!user || !verifyPassword(user, String(body.password || ''))) {
    return { ok: false, error: 'Identifiant ou mot de passe incorrect.' };
  }
  if (!state.players[user.playerId]) {
    const player = createPlayer({ name: body.companyName || `Compagnie ${user.username}` });
    user.playerId = player.id;
  }
  const token = issueSession(user, req);
  saveState();
  return { ok: true, auth: authPayload(user, token), playerId: user.playerId, state: publicState(user.playerId, user) };
}


function buildAdminDashboard() {
  const usersByPlayer = new Map();
  for (const user of Object.values(state.users || {})) {
    usersByPlayer.set(user.playerId, user);
  }
  const players = activePlayers().map(player => {
    const user = usersByPlayer.get(player.id) || null;
    const history = normalizeLoginHistory(user?.loginHistory, user?.lastLoginAt).slice(-80).reverse();
    const sessions = Object.values(user?.sessions || {}).filter(session => Number(session.expiresAt || 0) > Date.now());
    return {
      id: player.id,
      name: player.name,
      cash: Math.round(Number(player.cash || 0)),
      debt: Math.round(Number(player.debt || 0)),
      score: Math.round(scorePlayer(player)),
      lines: Array.isArray(player.lines) ? player.lines.length : 0,
      activeLines: Array.isArray(player.lines) ? player.lines.filter(l => l.active).length : 0,
      trains: Array.isArray(player.trains) ? player.trains.length : 0,
      username: user?.username || '',
      usernameKey: user?.usernameKey || '',
      isAdmin: isAdminUser(user),
      createdAt: player.createdAt || null,
      lastSeen: player.lastSeen || null,
      lastLoginAt: user?.lastLoginAt || null,
      loginCount: normalizeLoginHistory(user?.loginHistory, user?.lastLoginAt).length,
      activeSessions: sessions.length,
      loginHistory: history,
      rawPlayer: player
    };
  }).sort((a, b) => (b.isAdmin - a.isAdmin) || String(a.name).localeCompare(String(b.name), 'fr'));
  return { players, generatedAt: Date.now() };
}

function adminFindPlayer(payload = {}) {
  const targetPlayerId = String(payload.targetPlayerId || payload.playerId || '').trim();
  if (targetPlayerId && state.players[targetPlayerId]) return state.players[targetPlayerId];
  const usernameKey = String(payload.usernameKey || payload.username || '').trim().toLowerCase();
  const user = usernameKey ? state.users?.[usernameKey] : null;
  if (user?.playerId && state.players[user.playerId]) return state.players[user.playerId];
  return null;
}

function adminUpdatePlayer(payload = {}, adminUser = null) {
  const target = adminFindPlayer(payload);
  if (!target) return fail('Compte joueur introuvable.');
  const beforeName = target.name;

  if (payload.rawPlayer && typeof payload.rawPlayer === 'object') {
    const replacement = migratePlayer({ ...payload.rawPlayer, id: target.id }, target.id);
    state.players[target.id] = replacement;
  }

  const player = state.players[target.id];
  if (payload.cash !== undefined && payload.cash !== '') {
    const cash = Number(payload.cash);
    if (!Number.isFinite(cash)) return fail('Montant de trésorerie invalide.');
    player.cash = Math.round(cash);
  }
  if (payload.cashDelta !== undefined && payload.cashDelta !== '') {
    const delta = Number(payload.cashDelta);
    if (!Number.isFinite(delta)) return fail('Variation de trésorerie invalide.');
    player.cash = Math.round(Number(player.cash || 0) + delta);
  }
  if (payload.name !== undefined) {
    player.name = cleanText(payload.name || player.name, 28);
  }
  if (payload.color !== undefined) {
    player.color = validateColor(payload.color) || player.color;
  }
  if (payload.reputation !== undefined && payload.reputation !== '') {
    player.reputation = clamp(Number(payload.reputation || 0), 0, 100);
  }

  player.lastSeen = Date.now();
  notify(player, `Modification admin appliquée par ${adminUser?.username || 'admin'}.`);
  state.news.push({ day: state.day, text: `Administration : ${beforeName} a été mis à jour.` });
  state.news = state.news.slice(-60);
  saveState();
  return ok('Modification admin enregistrée.');
}

let sncfRailLinesCache = null;
let sncfRailLinesLoadedAt = 0;
const sncfRouteGeometryResultCache = new Map();

function sncfRouteCacheKey(a, b) {
  return `${currentStationId(a)}::${currentStationId(b)}`;
}

function rememberSncfRouteGeometry(key, geometry) {
  if (sncfRouteGeometryResultCache.has(key)) sncfRouteGeometryResultCache.delete(key);
  sncfRouteGeometryResultCache.set(key, simplifyGeoPolyline(Array.isArray(geometry) ? geometry : []));
  while (sncfRouteGeometryResultCache.size > SNCF_ROUTE_GEOMETRY_CACHE_MAX) {
    const oldest = sncfRouteGeometryResultCache.keys().next().value;
    sncfRouteGeometryResultCache.delete(oldest);
  }
  return sncfRouteGeometryResultCache.get(key);
}

function geoPointDistanceToSegment(point, a, b) {
  const lon = Number(point?.[0]);
  const lat = Number(point?.[1]);
  const lonA = Number(a?.[0]);
  const latA = Number(a?.[1]);
  const lonB = Number(b?.[0]);
  const latB = Number(b?.[1]);
  if (![lon, lat, lonA, latA, lonB, latB].every(Number.isFinite)) return 0;
  const scale = Math.cos(((latA + latB) / 2) * Math.PI / 180) || 1;
  const x = lon * scale;
  const y = lat;
  const ax = lonA * scale;
  const ay = latA;
  const bx = lonB * scale;
  const by = latB;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0) return Math.hypot(x - ax, y - ay);
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / lenSq, 0, 1);
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
}

function rdpGeoPolyline(points, epsilon) {
  if (!Array.isArray(points) || points.length <= 2) return points || [];
  let bestIndex = -1;
  let bestDistance = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = geoPointDistanceToSegment(points[i], first, last);
    if (distance > bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  if (bestDistance <= epsilon || bestIndex < 0) return [first, last];
  const left = rdpGeoPolyline(points.slice(0, bestIndex + 1), epsilon);
  const right = rdpGeoPolyline(points.slice(bestIndex), epsilon);
  return left.slice(0, -1).concat(right);
}

function decimateGeoPolyline(points, maxPoints) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points || [];
  const out = [points[0]];
  const step = (points.length - 2) / Math.max(1, maxPoints - 2);
  for (let i = 1; i < maxPoints - 1; i += 1) {
    out.push(points[Math.max(1, Math.min(points.length - 2, Math.round(i * step)))]);
  }
  out.push(points[points.length - 1]);
  return out;
}

function simplifyGeoPolyline(points, maxPoints = 900) {
  const clean = [];
  for (const point of points || []) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const lon = Number(point[0]);
    const lat = Number(point[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const previous = clean[clean.length - 1];
    if (previous && Math.abs(previous[0] - lon) < 0.000001 && Math.abs(previous[1] - lat) < 0.000001) continue;
    clean.push([roundCoord(lon), roundCoord(lat)]);
  }
  if (clean.length <= maxPoints) return clean;
  const working = clean.length > 6000 ? decimateGeoPolyline(clean, 3000) : clean;
  let epsilon = 0.00003;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const simplified = rdpGeoPolyline(working, epsilon);
    if (simplified.length <= maxPoints) return simplified;
    epsilon *= 1.8;
  }
  return decimateGeoPolyline(working, maxPoints);
}

async function loadSncfRailShapeLines() {
  if (sncfRailLinesCache?.length) return sncfRailLinesCache;
  try {
    if (fs.existsSync(SNCF_RFN_CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SNCF_RFN_CACHE_FILE, 'utf8'));
      if (Array.isArray(parsed.lines) && parsed.lines.length) {
        sncfRailLinesCache = parsed.lines
          .filter(line => Array.isArray(line?.coords) && line.coords.length >= 2)
          .map(line => ({ ...line, bounds: line.bounds || geoLineBounds(line.coords) }));
        sncfRailLinesLoadedAt = Number(parsed.updatedAt || Date.now());
        return sncfRailLinesCache;
      }
    }
  } catch (error) {
    console.warn('Cache RFN SNCF illisible:', error.message);
  }

  const geojson = await fetchJsonWithTimeout(SNCF_RFN_GEOJSON_URL, 120000);
  const lines = extractGeoJsonRailLines(geojson)
    .filter(line => line.coords.length >= 2)
    .map(line => ({ ...line, bounds: geoLineBounds(line.coords) }));
  if (!lines.length) throw new Error('Aucune géométrie RFN exploitable.');
  sncfRailLinesCache = lines;
  sncfRailLinesLoadedAt = Date.now();
  try {
    fs.writeFileSync(SNCF_RFN_CACHE_FILE, JSON.stringify({ updatedAt: sncfRailLinesLoadedAt, source: 'formes-des-lignes-du-rfn', lines }, null, 0));
  } catch (error) {
    console.warn('Cache RFN SNCF non écrit:', error.message);
  }
  return sncfRailLinesCache;
}

function extractGeoJsonRailLines(geojson) {
  const features = Array.isArray(geojson?.features) ? geojson.features : Array.isArray(geojson) ? geojson : [];
  const lines = [];
  for (const feature of features) {
    const geometry = feature?.geometry || feature?.geo_shape || feature;
    const properties = feature?.properties || feature?.fields || feature || {};
    const status = String(properties.mnemo || properties.MNEMO || properties.statut || properties.status || '').toUpperCase();
    const rejected = /FERM|DÉPOS|DEPOS|HORS|ABANDON|NON\s*EXPLOIT/.test(status);
    for (const coords of geometryToLineStrings(geometry)) {
      const clean = coords
        .map(pair => [Number(pair[0]), Number(pair[1])])
        .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && isInFranceBounds(lat, lon));
      if (clean.length >= 2 && !rejected) lines.push({ coords: clean, status });
    }
  }
  return lines;
}

function geometryToLineStrings(geometry) {
  if (!geometry || typeof geometry !== 'object') return [];
  const type = geometry.type;
  const coords = geometry.coordinates;
  if (type === 'LineString' && Array.isArray(coords)) return [coords];
  if (type === 'MultiLineString' && Array.isArray(coords)) return coords;
  if (type === 'Feature') return geometryToLineStrings(geometry.geometry);
  if (type === 'GeometryCollection' && Array.isArray(geometry.geometries)) return geometry.geometries.flatMap(geometryToLineStrings);
  return [];
}

function geoLineBounds(coords) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coords || []) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

function boundsIntersects(a, b) {
  return a.minLon <= b.maxLon && a.maxLon >= b.minLon && a.minLat <= b.maxLat && a.maxLat >= b.minLat;
}

function rfnCoordKey(lon, lat) {
  return `${Number(lon).toFixed(4)},${Number(lat).toFixed(4)}`;
}

async function sncfRouteGeometryForStations(fromId, toId) {
  const fromKey = currentStationId(fromId);
  const toKey = currentStationId(toId);
  const key = sncfRouteCacheKey(fromKey, toKey);
  if (sncfRouteGeometryResultCache.has(key)) return sncfRouteGeometryResultCache.get(key);
  const reverseKey = sncfRouteCacheKey(toKey, fromKey);
  if (sncfRouteGeometryResultCache.has(reverseKey)) {
    const reversed = [...sncfRouteGeometryResultCache.get(reverseKey)].reverse();
    return rememberSncfRouteGeometry(key, reversed);
  }

  const from = stationById(fromKey);
  const to = stationById(toKey);
  if (!from || !to) return [];
  const start = stationRoutePoint(from) || stationRawPoint(from);
  const end = stationRoutePoint(to) || stationRawPoint(to);
  if (!start || !end) return [];
  const directKm = haversine(start.lat, start.lon, end.lat, end.lon);
  if (!Number.isFinite(directKm) || directKm <= 0 || directKm > 1300) return [];

  try {
    const lines = await loadSncfRailShapeLines();
    const pad = Math.min(2.2, Math.max(0.12, directKm / 85));
    const bbox = {
      minLat: Math.min(start.lat, end.lat) - pad,
      maxLat: Math.max(start.lat, end.lat) + pad,
      minLon: Math.min(start.lon, end.lon) - pad,
      maxLon: Math.max(start.lon, end.lon) + pad
    };
    const relevant = lines.filter(line => boundsIntersects(line.bounds, bbox));
    if (relevant.length > 850 && directKm < 180) {
      const tighterPad = Math.min(0.9, Math.max(0.08, directKm / 150));
      const tightBox = {
        minLat: Math.min(start.lat, end.lat) - tighterPad,
        maxLat: Math.max(start.lat, end.lat) + tighterPad,
        minLon: Math.min(start.lon, end.lon) - tighterPad,
        maxLon: Math.max(start.lon, end.lon) + tighterPad
      };
      const tighter = lines.filter(line => boundsIntersects(line.bounds, tightBox));
      if (tighter.length >= 1) relevant.splice(0, relevant.length, ...tighter);
    }
    const geometry = buildPathFromRailShapeLines(relevant, start, end, directKm);
    return geometry?.length ? rememberSncfRouteGeometry(key, geometry) : [];
  } catch (error) {
    console.warn('Géométrie SNCF RFN indisponible:', error.message);
    return [];
  }
}

function buildPathFromRailShapeLines(lines, start, end, directKm) {
  const graph = new Map();
  const coordsByKey = new Map();
  function addNode(lon, lat) {
    const key = rfnCoordKey(lon, lat);
    coordsByKey.set(key, [lon, lat]);
    if (!graph.has(key)) graph.set(key, []);
    return key;
  }
  for (const line of lines || []) {
    const coords = line.coords || [];
    for (let i = 1; i < coords.length; i++) {
      const [lonA, latA] = coords[i - 1];
      const [lonB, latB] = coords[i];
      const a = addNode(lonA, latA);
      const b = addNode(lonB, latB);
      if (a === b) continue;
      const weight = haversine(latA, lonA, latB, lonB);
      graph.get(a).push([b, weight]);
      graph.get(b).push([a, weight]);
    }
  }
  if (graph.size < 2) return [];
  const startKey = nearestRfnNodeKey(coordsByKey, start);
  const endKey = nearestRfnNodeKey(coordsByKey, end);
  if (!startKey || !endKey || startKey === endKey) return [];
  const startGap = pointToCoordDistance(start, coordsByKey.get(startKey));
  const endGap = pointToCoordDistance(end, coordsByKey.get(endKey));
  const maxGap = Math.min(14, Math.max(3.5, directKm * 0.18));
  if (startGap > maxGap || endGap > maxGap) return [];
  const ids = dijkstraWeightedGraph(graph, startKey, endKey, 60000);
  if (ids.length < 2) return [];
  const path = ids.map(id => coordsByKey.get(id)).filter(Boolean);
  const distance = polylineDistanceKm(path);
  if (distance <= 0 || distance > Math.max(45, directKm * 4.8)) return [];
  return [[start.lon, start.lat], ...path, [end.lon, end.lat]];
}

function nearestRfnNodeKey(coordsByKey, point) {
  let best = null;
  for (const [key, [lon, lat]] of coordsByKey.entries()) {
    const distance = haversine(point.lat, point.lon, lat, lon);
    if (!best || distance < best.distance) best = { key, distance };
  }
  return best?.key || null;
}

function pointToCoordDistance(point, coord) {
  if (!point || !coord) return Infinity;
  return haversine(point.lat, point.lon, coord[1], coord[0]);
}

function dijkstraWeightedGraph(graph, startKey, endKey, maxVisited = 5000) {
  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const visited = new Set();
  const heap = [[0, startKey]];

  function push(item) {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (heap[p][0] <= item[0]) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = item;
  }

  function pop() {
    if (!heap.length) return null;
    const root = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      let i = 0;
      while (true) {
        const left = i * 2 + 1;
        const right = left + 1;
        if (left >= heap.length) break;
        let child = left;
        if (right < heap.length && heap[right][0] < heap[left][0]) child = right;
        if (heap[child][0] >= last[0]) break;
        heap[i] = heap[child];
        i = child;
      }
      heap[i] = last;
    }
    return root;
  }

  while (heap.length && visited.size < Math.min(maxVisited, graph.size)) {
    const currentEntry = pop();
    if (!currentEntry) break;
    const [best, current] = currentEntry;
    if (visited.has(current)) continue;
    if (!Number.isFinite(best)) break;
    visited.add(current);
    if (current === endKey) break;

    for (const [next, weight] of graph.get(current) || []) {
      if (visited.has(next)) continue;
      const alt = best + weight;
      if (alt < (dist.get(next) ?? Infinity)) {
        dist.set(next, alt);
        prev.set(next, current);
        push([alt, next]);
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

function polylineDistanceKm(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  return total;
}

async function realRailRouteBetweenStops(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.length < 2) return { ids, distance: 0, maxSegment: 0, segments: [], missing: null };

  const segments = [];
  let distance = 0;
  let maxSegment = 0;
  for (let i = 1; i < ids.length; i += 1) {
    const from = ids[i - 1];
    const to = ids[i];
    const geometry = await sncfRouteGeometryForStations(from, to);
    const segmentDistance = polylineDistanceKm(geometry || []);
    if (!Array.isArray(geometry) || geometry.length < 2 || !Number.isFinite(segmentDistance) || segmentDistance <= 0) {
      return {
        ids: [],
        distance: 0,
        maxSegment: 0,
        segments,
        missing: { from, to }
      };
    }
    const rounded = Math.max(1, Math.round(segmentDistance));
    segments.push({ from, to, distance: rounded });
    distance += segmentDistance;
    maxSegment = Math.max(maxSegment, segmentDistance);
  }

  return {
    ids,
    distance: Math.round(distance),
    maxSegment: Math.round(maxSegment),
    segments,
    missing: null
  };
}

function mimeType(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';
}

function loadOrCreateState() {
  if (fs.existsSync(SAVE_FILE)) {
    try {
      const loaded = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
      if (loaded && loaded.players) return migrateState(loaded);
    } catch (error) {
      console.warn('Sauvegarde illisible, nouvelle partie créée.', error.message);
    }
  }
  return createState();
}


function userLinkedPlayerIds(users = {}) {
  return new Set(Object.values(users || {}).map(user => String(user?.playerId || '')).filter(Boolean));
}

function purgeUnlinkedPlayers(players = {}, users = {}) {
  const linkedIds = userLinkedPlayerIds(users);
  if (!linkedIds.size) return players;
  const out = {};
  for (const [id, player] of Object.entries(players || {})) {
    if (linkedIds.has(String(id))) out[id] = player;
  }
  return out;
}

function activePlayers() {
  const linkedIds = userLinkedPlayerIds(state.users || {});
  const players = Object.values(state.players || {});
  if (!linkedIds.size) return players;
  return players.filter(player => linkedIds.has(String(player.id)));
}

function migrateState(loaded) {
  const players = {};
  for (const [id, player] of Object.entries(loaded.players || {})) {
    players[id] = migratePlayer(player, id);
  }
  return {
    version: STATE_SCHEMA_VERSION,
    createdAt: loaded.createdAt || Date.now(),
    now: loaded.now || Date.now(),
    day: Number(loaded.day || 1),
    eraYear: Number(loaded.eraYear || 1850),
    tickSpeed: TICK_MS,
    market: { ...createMarket(), ...(loaded.market || {}) },
    events: Array.isArray(loaded.events) ? loaded.events : [],
    news: Array.isArray(loaded.news) ? loaded.news.slice(0, 50) : [],
    customStations: normalizeCustomStations(loaded.customStations),
    users: normalizeUsers(loaded.users || {}),
    players: purgeUnlinkedPlayers(players, loaded.users || {}),
  };
}


function currentStationId(id) {
  const raw = String(id || '').trim();
  if (!raw) return '';
  const legacy = LEGACY_STATION_COMMUNE_IDS[raw] || raw;
  return stationAliasMap.get(legacy) || stationAliasMap.get(raw) || legacy;
}

function stationAliasScore(station, hintName = '') {
  if (!station) return -Infinity;
  const hint = stationDedupName(hintName);
  const name = stationDedupName(station.name || station.stationName || '');
  const passenger = station.hasPassengerStation ? 2000 : 0;
  const freight = station.hasFreightStation ? 250 : 0;
  const demand = Number(station.population || station.baseDemand || 0);
  const exact = hint && name === hint ? 5000 : 0;
  const partial = hint && (name.includes(hint) || hint.includes(name)) ? 1200 : 0;
  return passenger + freight + exact + partial + Math.min(1500, demand / 1200);
}

function bestStationAliasCandidate(stations, hintName = '') {
  return [...(stations || [])]
    .sort((a, b) => stationAliasScore(b, hintName) - stationAliasScore(a, hintName)
      || String(a.name || '').localeCompare(String(b.name || ''), 'fr'))
    [0] || null;
}

function rebuildStationAliasMap(byId = {}) {
  const aliases = new Map();
  const stations = Object.values(byId || {});
  const byCommune = new Map();
  const byUic = new Map();

  for (const station of stations) {
    if (!station?.id) continue;
    const code = stationCommuneCode(station);
    if (code) {
      const key = `COM_${String(code).replace(/[^A-Za-z0-9]/g, '')}`;
      if (!byCommune.has(key)) byCommune.set(key, []);
      byCommune.get(key).push(station);
    }
    const uic = String(station.stationUic || station.codeUic || '').split(',')[0].trim();
    if (uic) {
      byUic.set(uic, station);
      aliases.set(uic, station.id);
      aliases.set(`GARE_${uic}`, station.id);
    }
  }

  for (const [legacyId, uic] of Object.entries(LEGACY_EXPLICIT_STATION_UIC_IDS)) {
    const station = byUic.get(uic);
    if (station?.id) aliases.set(legacyId, station.id);
  }

  for (const [communeId, candidates] of byCommune.entries()) {
    const best = bestStationAliasCandidate(candidates);
    if (best?.id) aliases.set(communeId, best.id);
  }

  for (const [legacyId, communeId] of Object.entries(LEGACY_STATION_COMMUNE_IDS)) {
    if (aliases.has(legacyId)) continue;
    const explicit = aliases.get(communeId);
    if (explicit) {
      aliases.set(legacyId, explicit);
      continue;
    }
    const candidates = byCommune.get(communeId) || [];
    const hint = WORLD.stationIndex?.[legacyId]?.name || WORLD.stationIndex?.[communeId]?.name || '';
    const best = bestStationAliasCandidate(candidates, hint);
    if (best?.id) aliases.set(legacyId, best.id);
  }

  stationAliasMap = aliases;
  return aliases;
}

function remapStateStationAliases() {
  for (const player of Object.values(state?.players || {})) migrateLegacyStationReferences(player);
}

function migrateLegacyStationReferences(player) {
  if (!player || typeof player !== 'object') return player;

  const remappedStations = {};
  for (const [stationId, asset] of Object.entries(player.stations || {})) {
    const nextId = currentStationId(stationId);
    const normalizedAsset = asset && typeof asset === 'object' ? { ...asset } : {};
    if (normalizedAsset.id) normalizedAsset.id = currentStationId(normalizedAsset.id);
    if (normalizedAsset.stationId) normalizedAsset.stationId = currentStationId(normalizedAsset.stationId);
    remappedStations[nextId] = { ...(remappedStations[nextId] || {}), ...normalizedAsset };
  }
  player.stations = remappedStations;

  if (Array.isArray(player.lines)) {
    for (const line of player.lines) {
      if (!line || typeof line !== 'object') continue;
      line.from = currentStationId(line.from);
      line.to = currentStationId(line.to);
      if (Array.isArray(line.stops)) line.stops = line.stops.map(currentStationId).filter(Boolean);
      if (Array.isArray(line.route)) line.route = line.route.map(currentStationId).filter(Boolean);
      if (Array.isArray(line.routeIds)) line.routeIds = line.routeIds.map(currentStationId).filter(Boolean);
      if (Array.isArray(line.stopIds)) line.stopIds = line.stopIds.map(currentStationId).filter(Boolean);
    }
  }

  return player;
}

function migratePlayer(player, fallbackId) {
  const p = player && typeof player === 'object' ? player : {};
  const techDefaults = { traction: 0, energy: 0, operations: 0, stations: 0, social: 0, freight: 0 };
  const staffDefaults = { drivers: 0, controllers: 0, stationAgents: 0, mechanics: 0, dispatchers: 0, engineers: 0 };
  const statsDefaults = {
    passengers: 0,
    freightTons: 0,
    revenue: 0,
    expenses: 0,
    profit: 0,
    lastRevenue: 0,
    lastExpenses: 0,
    lastProfit: 0,
    punctuality: 90,
    satisfaction: 50,
    marketShare: 0
  };
  p.id = p.id || fallbackId;
  p.name = cleanText(p.name || 'Compagnie', 28);
  p.color = validateColor(p.color) || randomColor();
  p.logo = sanitizeCompanyLogo(p.logo);
  p.cash = Number.isFinite(Number(p.cash)) ? Number(p.cash) : 0;
  p.debt = Number.isFinite(Number(p.debt)) ? Number(p.debt) : 0;
  p.epoch = clamp(Math.floor(Number(p.epoch || 0)), 0, BALANCE.epochs.length - 1);
  p.research = Number.isFinite(Number(p.research)) ? Number(p.research) : 0;
  p.tech = { ...techDefaults, ...(p.tech || {}) };
  p.techUnlocked = normalizeTechUnlocked(p.techUnlocked);
  p.researchProject = normalizeResearchProject(p.researchProject);
  p.researchQueue = normalizeResearchQueue(p.researchQueue);
  p.maintenancePolicy = BALANCE.maintenancePolicies[p.maintenancePolicy] ? p.maintenancePolicy : 'standard';
  p.staff = { ...staffDefaults, ...(p.staff || {}) };
  p.tutorial = createTutorialState(p.tutorial);
  p.stats = { ...statsDefaults, ...(p.stats || {}) };
  p.trains = Array.isArray(p.trains) ? p.trains.map(t => normalizeTrain(t, p.id)).filter(Boolean) : [];
  p.lines = Array.isArray(p.lines) ? p.lines : [];
  p.stations = p.stations && typeof p.stations === 'object' ? p.stations : {};
  migrateLegacyStationReferences(p);
  for (const stationId of Object.keys(p.stations)) normalizeStationAsset(p, stationId);
  p.energyStrategy = BALANCE.energyStrategies[p.energyStrategy] ? p.energyStrategy : 'spot';
  p.resources = normalizeResources(p.resources);
  p.notifications = Array.isArray(p.notifications) ? p.notifications : [];
  p.reputation = Number.isFinite(Number(p.reputation)) ? Number(p.reputation) : 50;
  p.co2 = Number.isFinite(Number(p.co2)) ? Number(p.co2) : 0;
  p.region = cleanText(p.region || 'France', 40);
  p.createdAt = p.createdAt || Date.now();
  p.lastSeen = p.lastSeen || Date.now();
  return p;
}

function normalizeTechUnlocked(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, value] of Object.entries(raw)) {
    if (value === true) out[id] = 1;
    else if (value === false || value == null) continue;
    else out[id] = clamp(Math.floor(Number(value) || 0), 0, RESEARCH_TECHNICAL_MAX_LEVEL);
  }
  return out;
}

function normalizeResearchProject(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const node = techNodeById(raw.nodeId);
  const targetLevel = Math.max(1, Math.floor(Number(raw.targetLevel || 1)));
  if (!node || targetLevel < 1 || targetLevel > RESEARCH_TECHNICAL_MAX_LEVEL) return null;
  const durationMs = Math.max(1000, Math.floor(Number(raw.durationMs || (raw.duration ? Number(raw.duration) * 1000 : researchDurationMs(node, targetLevel)))));
  const remainingMs = clamp(Math.ceil(Number(raw.remainingMs ?? (raw.remaining ? Number(raw.remaining) * 1000 : durationMs))), 0, durationMs);
  if (remainingMs <= 0) return null;
  return {
    nodeId: node.id,
    targetLevel,
    remainingMs,
    durationMs,
    costMoney: Math.max(0, Math.round(Number(raw.costMoney || researchCostMoney(node, targetLevel)))),
    operatingCostAccrued: Math.max(0, Math.round(Number(raw.operatingCostAccrued || 0))),
    startedAt: Number(raw.startedAt || Date.now()),
    updatedAt: Number(raw.updatedAt || Date.now())
  };
}

function normalizeResearchQueue(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => {
    if (!item || typeof item !== 'object') return null;
    const node = techNodeById(item.nodeId);
    const targetLevel = Math.max(1, Math.floor(Number(item.targetLevel || 1)));
    if (!node || targetLevel < 1 || targetLevel > RESEARCH_TECHNICAL_MAX_LEVEL) return null;
    const durationMs = Math.max(1000, Math.floor(Number(item.durationMs || researchDurationMs(node, targetLevel))));
    return {
      nodeId: node.id,
      targetLevel,
      durationMs,
      costMoney: Math.max(0, Math.round(Number(item.costMoney || researchCostMoney(node, targetLevel)))),
      queuedAt: Number(item.queuedAt || Date.now())
    };
  }).filter(Boolean).slice(0, 12);
}

function createState() {
  return {
    version: STATE_SCHEMA_VERSION,
    createdAt: Date.now(),
    now: Date.now(),
    day: 1,
    eraYear: 1850,
    tickSpeed: TICK_MS,
    market: createMarket(),
    events: [createEvent('expo', 12)],
    news: [{ day: 1, text: 'Le marché ferroviaire français s’ouvre aux premières compagnies privées.' }],
    customStations: {},
    users: {},
    players: {}
  };
}

function createMarket() {
  return {
    coal: 1.1,
    diesel: 2.35,
    electricity: 0.34,
    hydrogen: 1.9,
    battery: 0.42,
    steel: 1.0,
    labor: 1.0,
    demand: 1.0,
    freight: 1.0
  };
}

function saveState() {
  fs.mkdirSync(path.dirname(SAVE_FILE), { recursive: true });
  fs.writeFileSync(SAVE_FILE, JSON.stringify(state, null, 2));
}



function stationRawPoint(station) {
  if (!station) return null;
  const lat = Number(station.lat);
  const lon = Number(station.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

function projectStationOnSegment(stationPoint, segment) {
  const a = stationById(segment?.from);
  const b = stationById(segment?.to);
  if (!stationPoint || !a || !b) return null;
  const ax = Number(a.lon), ay = Number(a.lat);
  const bx = Number(b.lon), by = Number(b.lat);
  const px = Number(stationPoint.lon), py = Number(stationPoint.lat);
  if (![ax, ay, bx, by, px, py].every(Number.isFinite)) return null;
  const vx = bx - ax;
  const vy = by - ay;
  const denom = vx * vx + vy * vy || 1;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / denom, 0, 1);
  const lon = ax + vx * t;
  const lat = ay + vy * t;
  const distanceKm = haversine(py, px, lat, lon);
  return { lat, lon, t, distanceKm, from: segment.from, to: segment.to };
}

function nearestRailProjection(station) {
  const point = stationRawPoint(station);
  if (!point || !WORLD?.railSegments?.length) return null;
  let best = null;
  for (const segment of WORLD.railSegments) {
    const snap = projectStationOnSegment(point, segment);
    if (!snap) continue;
    if (!best || snap.distanceKm < best.distanceKm) best = snap;
  }
  return best;
}

function stationRailPlacement(station) {
  if (!station) return null;
  if (WORLD.stationIndex?.[station.id]) {
    return {
      ...station,
      railLat: Number(station.lat),
      railLon: Number(station.lon),
      placement: 'station',
      railDistanceKm: 0
    };
  }

  const stationLat = Number(station.stationLat);
  const stationLon = Number(station.stationLon);
  if (Number.isFinite(stationLat) && Number.isFinite(stationLon)) {
    return {
      ...station,
      originalLat: Number(station.lat),
      originalLon: Number(station.lon),
      railLat: stationLat,
      railLon: stationLon,
      placement: 'sncf-station',
      railDistanceKm: round2(haversine(Number(station.lat), Number(station.lon), stationLat, stationLon)),
      railSource: station.stationSource || 'sncf-gares-de-voyageurs'
    };
  }

  if (station.commune) {
    return {
      ...station,
      railLat: Number(station.lat),
      railLon: Number(station.lon),
      placement: 'commune',
      railDistanceKm: null,
      railSource: station.populationSource || 'geo.api.gouv.fr'
    };
  }

  const snap = nearestRailProjection(station);
  const population = Number(station.population || 0);
  const maxSnapKm = station.custom ? 5 : population >= 50000 ? 12 : population >= 15000 ? 9 : 7;
  if (snap && snap.distanceKm <= maxSnapKm) {
    return {
      ...station,
      originalLat: Number(station.lat),
      originalLon: Number(station.lon),
      railLat: roundCoord(snap.lat),
      railLon: roundCoord(snap.lon),
      placement: 'rail-snap',
      railDistanceKm: round2(snap.distanceKm),
      railSegment: `${snap.from}-${snap.to}`
    };
  }

  return {
    ...station,
    railLat: Number(station.lat),
    railLon: Number(station.lon),
    placement: 'commune',
    railDistanceKm: snap ? round2(snap.distanceKm) : null
  };
}

function stationRoutePoint(station) {
  if (!station) return null;
  const placed = stationRailPlacement(station) || station;
  const lat = Number(placed.railLat ?? placed.lat);
  const lon = Number(placed.railLon ?? placed.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : stationRawPoint(station);
}

function nearestRailAnchorsForStation(station, count = 4) {
  const point = stationRoutePoint(station);
  if (!point || !WORLD?.railSegments?.length) return [];
  const ranked = [];
  for (const segment of WORLD.railSegments) {
    const snap = projectStationOnSegment(point, segment);
    if (!snap) continue;
    ranked.push({ segment, distanceKm: snap.distanceKm });
  }
  ranked.sort((a, b) => a.distanceKm - b.distanceKm);
  const anchors = [];
  for (const item of ranked.slice(0, Math.max(2, count))) {
    for (const id of [item.segment.from, item.segment.to]) {
      if (!anchors.includes(id)) anchors.push(id);
      if (anchors.length >= count) return anchors;
    }
  }
  return anchors;
}

function railPlacementStats(stations) {
  const total = stations.length || 0;
  const sncf = stations.filter(s => s.placement === 'sncf-station').length;
  const snapped = stations.filter(s => s.placement === 'rail-snap' || s.placement === 'station' || s.placement === 'sncf-station').length;
  return { total, snapped, sncf, percent: total ? Math.round(snapped / total * 100) : 0 };
}


function stationPhysicalKey(station) {
  if (!station) return '';
  const uic = String(station.stationUic || station.codeUic || '').split(',')[0].trim();
  const gaia = String(station.stationIdGare || station.idGare || '').trim();
  if (station.multiStation && uic) return `uic:${uic}`;
  if (station.multiStation && gaia) return `gaia:${gaia}`;
  const code = stationCommuneCode(station);
  if (code) return `code:${code}`;
  if (uic) return `uic:${uic}`;
  const lat = Number(station.railLat ?? station.stationLat ?? station.lat);
  const lon = Number(station.railLon ?? station.stationLon ?? station.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return `coord:${lat.toFixed(4)},${lon.toFixed(4)}:${stationDedupName(station.name)}`;
  return `id:${String(station.id || '')}`;
}

function deduplicatePublicStations(stations, existingStations = []) {
  const out = [];
  const seenIds = new Set();
  const seenPhysical = new Set((existingStations || []).map(stationPhysicalKey).filter(Boolean));
  const existing = Array.isArray(existingStations) ? existingStations : [];
  for (const raw of stations || []) {
    if (!raw || !raw.id) continue;
    const station = { ...raw, id: currentStationId(raw.id) };
    const id = String(station.id || '').trim();
    if (!id || seenIds.has(id)) continue;
    if (isDuplicatePublicStation(station, [...existing, ...out])) continue;
    const physicalKey = stationPhysicalKey(station);
    if (physicalKey && seenPhysical.has(physicalKey)) continue;
    seenIds.add(id);
    if (physicalKey) seenPhysical.add(physicalKey);
    out.push(station);
  }
  return out;
}


function publicWorld() {
  const customIds = '';
  const communeCodes = Object.values(communeCache.byId || {}).map(s => s.code || s.id).sort().join(',');
  const communeCount = Object.keys(communeCache.byId || {}).length;
  const cacheKey = `${communeCache.status}:${communeCache.updatedAt || ''}:${MIN_COMMUNE_POPULATION}:${communeCount}:${communeCodes.length}:${communeCache.error || ''}:${customIds}`;
  if (publicWorldCache.key === cacheKey && publicWorldCache.value) return publicWorldCache.value;

  const customStations = [];
  const baseStations = [];
  const communeStations = deduplicatePublicStations(Object.values(communeCache.byId || {}).map(stationRailPlacement), baseStations);
  const publicStationsWithoutCustom = [...baseStations, ...communeStations];
  const customFiltered = deduplicatePublicStations(customStations.map(stationRailPlacement), publicStationsWithoutCustom);
  const stations = deduplicatePublicStations([...baseStations, ...communeStations, ...customFiltered]);
  const stationIndex = Object.fromEntries(stations.map(s => [s.id, s]));
  const world = {
    ...WORLD,
    stations,
    stationIndex,
    customStations: customFiltered,
    communeStations,
    communesStatus: {
      status: communeCache.status,
      count: communeStations.length,
      minPopulation: MIN_COMMUNE_POPULATION,
      updatedAt: communeCache.updatedAt,
      error: communeCache.error || '',
      sncfMatched: communeCache.sncfStats?.matched || 0,
      sncfStations: communeCache.sncfStats?.totalStations || 0,
      sourceVersion: communeCache.sourceVersion || 0,
      unmatchedCities: communeCache.sncfStats?.unmatchedCities || 0,
      duplicateStationCandidates: communeCache.sncfStats?.duplicateStationCandidates || 0
    },
    railPlacement: railPlacementStats(stations),
    regions: [...new Set(WORLD.regions)].sort()
  };
  publicWorldCache = { key: cacheKey, value: world };
  return world;
}

function closestCommuneForStation(station) {
  const communes = Object.values(communeCache.byId || {});
  let best = null;
  for (const commune of communes) {
    if (!Number.isFinite(commune.lat) || !Number.isFinite(commune.lon)) continue;
    const d = haversine(station.lat, station.lon, commune.lat, commune.lon);
    if (d <= 18 && (!best || d < best.distance)) best = { commune, distance: d };
  }
  return best?.commune || null;
}

function enrichBaseStationsWithPopulation(stations) {
  if (!Object.keys(communeCache.byId || {}).length) return stations;
  return stations.map(station => {
    if (Number.isFinite(Number(station.population)) && Number(station.population) > 0) return station;
    const commune = closestCommuneForStation(station);
    if (!commune) return station;
    return {
      ...station,
      population: commune.population,
      baseDemand: passengerDemandFromPopulation(commune.population),
      populationSource: 'geo.api.gouv.fr',
      communeCode: commune.code,
      codesPostaux: commune.codesPostaux || [],
      codeDepartement: commune.codeDepartement || ''
    };
  });
}

function invalidatePublicWorldCache() {
  publicWorldCache = { key: '', value: null };
}

function stationCommuneCode(station) {
  return String(station?.code || station?.communeCode || '').trim();
}

function isDuplicatePublicStation(candidate, existingStations) {
  if (!candidate || !Array.isArray(existingStations)) return false;
  const candidateCode = stationCommuneCode(candidate);
  const cname = stationDedupName(candidate.name);
  for (const s of existingStations) {
    const existingCode = stationCommuneCode(s);
    const sameMultiStationCommune = candidate.multiStation && s.multiStation && candidateCode && existingCode && candidateCode === existingCode;
    if (candidateCode && existingCode && candidateCode === existingCode && !sameMultiStationCommune) return true;
    if (candidate.id && s.id && candidate.id === s.id) return true;

    const sname = stationDedupName(s.name);
    const exactSameName = cname && sname && cname === sname;
    const close = Number.isFinite(candidate.lat) && Number.isFinite(candidate.lon) && Number.isFinite(s.lat) && Number.isFinite(s.lon)
      ? haversine(candidate.lat, candidate.lon, s.lat, s.lon) <= 1.25
      : false;
    if (exactSameName && close) return true;
  }
  return false;
}

function stationDedupName(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/gare|station|sncf|saint|sainte|st\.?|ste\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}


function stationPriceFromAnnualPassengers(annualPassengers) {
  const passengers = Math.max(0, Number(annualPassengers || 0));
  if (!Number.isFinite(passengers) || passengers <= 0) return 0;
  // Fréquentation SNCF 2024 : la plus petite gare commence à 100 k€,
  // puis le prix augmente fortement pour les hubs nationaux.
  return Math.round(100000 + Math.pow(passengers / 1000000, 1.25) * 35000);
}

function parisTerminalStationEntry(entry) {
  const price = stationPriceFromAnnualPassengers(entry.annualPassengers) * 50;
  const demand = Math.round(clamp(160 + Math.pow(entry.annualPassengers / 1000000, 0.74) * 58, 220, 1600));
  return {
    id: entry.id,
    code: entry.code,
    name: entry.name,
    lat: roundCoord(entry.lat),
    lon: roundCoord(entry.lon),
    population: PARIS_COMMUNE_POPULATION,
    region: 'Paris — grande gare terminus',
    codesPostaux: [entry.postal],
    codeDepartement: '75',
    baseDemand: demand,
    freight: Math.round(clamp(38 + Math.log10(entry.annualPassengers) * 14, 70, 170)),
    tourism: Math.round(clamp(78 + Math.log10(entry.annualPassengers) * 3, 90, 120)),
    commune: true,
    populationSource: 'geo.api.gouv.fr + découpage Paris multi-gares',
    stationLat: roundCoord(entry.lat),
    stationLon: roundCoord(entry.lon),
    stationName: entry.stationName,
    stationUic: entry.stationUic,
    stationTrigramme: '',
    stationIdGare: entry.stationUic,
    stationSource: PARIS_TERMINAL_SOURCE,
    hasPassengerStation: true,
    hasFreightStation: false,
    annualPassengers: Math.round(entry.annualPassengers),
    passengerTrafficYear: 2024,
    purchaseCost: price,
    stationKind: 'paris-terminal',
    majorTerminal: true,
    multiStation: true,
    allowSameCommuneStation: true
  };
}

function applyParisTerminalStations(byId) {
  if (!byId || typeof byId !== 'object') return { removed: 0, added: 0 };
  let removed = 0;
  for (const key of Object.keys(byId)) {
    const station = byId[key];
    if (!station) continue;
    const isParisCommune = String(station.code || station.communeCode || '') === '75056';
    const isOldParis = key === 'COM_75056' || (isParisCommune && !station.multiStation && stationDedupName(station.name || '') === 'paris');
    if (isOldParis) {
      delete byId[key];
      removed += 1;
    }
  }
  let added = 0;
  for (const entry of PARIS_TERMINAL_STATIONS) {
    byId[entry.id] = parisTerminalStationEntry(entry);
    added += 1;
  }
  return { removed, added };
}

function loadCommuneCache() {
  try {
    if (!fs.existsSync(COMMUNE_CACHE_FILE)) return { status: 'loading', updatedAt: null, byId: {}, error: '' };
    const parsed = JSON.parse(fs.readFileSync(COMMUNE_CACHE_FILE, 'utf8'));
    const byId = {};
    for (const station of parsed.stations || []) {
      const normalized = normalizeCommuneStation(station);
      if (normalized) byId[normalized.id] = normalized;
    }
    rebuildStationAliasMap(byId);
    const sourceVersion = Number(parsed.sourceVersion || 0);
    const missingAuthoritativePlacement = Object.values(byId).some(s => (s.hasPassengerStation || s.hasFreightStation) && (!Number.isFinite(Number(s.stationLat)) || !Number.isFinite(Number(s.stationLon)))) || !parsed.sncfStats;
    const status = sourceVersion >= COMMUNE_CACHE_SOURCE_VERSION && !missingAuthoritativePlacement ? 'ready-cache' : 'stale-cache';
    return { status, updatedAt: parsed.updatedAt || null, byId, error: '', sncfStats: parsed.sncfStats || null, sourceVersion };
  } catch (error) {
    return { status: 'error', updatedAt: null, byId: {}, error: error.message };
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json', 'User-Agent': 'Sillons/1.0 (+local game data refresh)' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    return fetchJsonWithNativeRequest(url, timeoutMs, error);
  } finally {
    clearTimeout(timeout);
  }
}

function fetchJsonWithNativeRequest(url, timeoutMs = 60000, originalError = null, redirectDepth = 0) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(error);
      return;
    }
    const transport = parsed.protocol === 'http:' ? http : https;
    const request = transport.get(parsed, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Sillons/1.0 (+local game data refresh)'
      }
    }, response => {
      const status = Number(response.statusCode || 0);
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location && redirectDepth < 4) {
        response.resume();
        const nextUrl = new URL(location, parsed).toString();
        fetchJsonWithNativeRequest(nextUrl, timeoutMs, originalError, redirectDepth + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }
      const chunks = [];
      response.setEncoding('utf8');
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(chunks.join('')));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`HTTP native timeout after ${timeoutMs}ms`));
    });
    request.on('error', error => {
      if (originalError) {
        error.message = `${error.message} (fetch fallback after: ${originalError.message})`;
      }
      reject(error);
    });
  });
}

function delayMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function addCommuneToIndex(byId, commune) {
  const station = communeToStation(commune);
  if (!station) return;
  const key = station.code ? `COM_${String(station.code).replace(/[^A-Za-z0-9]/g, '')}` : station.id;
  if (!byId[key] || Number(station.population || 0) > Number(byId[key].population || 0)) {
    byId[key] = { ...station, id: key };
  }
}

async function fetchCommunesPrimary() {
  const data = await fetchJsonWithTimeout(COMMUNE_API_URL, 90000);
  const byId = {};
  for (const commune of Array.isArray(data) ? data : []) addCommuneToIndex(byId, commune);
  return byId;
}

async function fetchCommunesByDepartments() {
  const byId = {};
  const concurrency = 8;
  for (let i = 0; i < COMMUNE_DEPARTMENTS.length; i += concurrency) {
    const chunk = COMMUNE_DEPARTMENTS.slice(i, i + concurrency);
    const results = await Promise.allSettled(chunk.map(dep => {
      const url = `https://geo.api.gouv.fr/departements/${encodeURIComponent(dep)}/communes?fields=nom,code,codesPostaux,codeDepartement,population,centre&geometry=centre&format=json`;
      return fetchJsonWithNativeRequest(url, 30000);
    }));
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const commune of Array.isArray(result.value) ? result.value : []) addCommuneToIndex(byId, commune);
    }
  }
  return byId;
}

async function fetchSncfRailwayStations() {
  try {
    const exported = await fetchJsonWithTimeout(SNCF_STATION_EXPORT_URL, 90000);
    const stations = sncfRecordsFromPayload(exported).map(normalizeSncfRailwayStation).filter(Boolean);
    if (stations.length >= COMMUNE_CACHE_MIN_READY_COUNT) return stations;
    console.warn(`Export complet liste-des-gares incomplet: ${stations.length} entrée(s), bascule pagination.`);
  } catch (error) {
    console.warn('Export complet liste-des-gares indisponible:', error.message);
  }

  const fields = 'code_uic,libelle,fret,voyageurs,code_ligne,rg_troncon,pk,commune,departemen,idreseau,idgaia,x_wgs84,y_wgs84,c_geo';
  const firstUrl = `${SNCF_STATION_API_URL}?select=${encodeURIComponent(fields)}&limit=${SNCF_STATION_PAGE_SIZE}&offset=0`;
  const first = await fetchJsonWithTimeout(firstUrl, 45000);
  const total = Math.max(0, Number(first.total_count || first.nhits || 0));
  const pages = [first];
  const offsets = [];
  for (let offset = SNCF_STATION_PAGE_SIZE; offset < total; offset += SNCF_STATION_PAGE_SIZE) offsets.push(offset);

  const concurrency = 6;
  for (let i = 0; i < offsets.length; i += concurrency) {
    const chunk = offsets.slice(i, i + concurrency);
    const results = await Promise.allSettled(chunk.map(offset => {
      const url = `${SNCF_STATION_API_URL}?select=${encodeURIComponent(fields)}&limit=${SNCF_STATION_PAGE_SIZE}&offset=${offset}`;
      return fetchJsonWithTimeout(url, 45000);
    }));
    for (const result of results) {
      if (result.status === 'fulfilled') pages.push(result.value);
      else console.warn('Page liste-des-gares indisponible:', result.reason?.message || result.reason);
    }
  }

  return pages.flatMap(sncfRecordsFromPayload).map(normalizeSncfRailwayStation).filter(Boolean);
}

function sncfRecordsFromPayload(payload) {
  if (Array.isArray(payload)) return payload.map(flattenSncfRecord);
  if (Array.isArray(payload?.results)) return payload.results.map(flattenSncfRecord);
  if (Array.isArray(payload?.records)) return payload.records.map(record => flattenSncfRecord(record.fields || record.record || record));
  if (Array.isArray(payload?.features)) return payload.features.map(feature => flattenSncfRecord({ ...(feature.properties || {}), geometry: feature.geometry }));
  return [];
}

function flattenSncfRecord(record) {
  if (!record || typeof record !== 'object') return {};
  const fields = record.fields && typeof record.fields === 'object' ? record.fields : record;
  return { ...fields, geometry: record.geometry || fields.geometry || fields.geo_shape };
}

function geoPointFromSncfRecord(raw) {
  const geometry = raw.geometry || raw.geo_shape;
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
    const lon = Number(geometry.coordinates[0]);
    const lat = Number(geometry.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const point = raw.position_geographique || raw.geo_point_2d || raw.c_geo || raw.coordonnees_geographiques || raw['Position géographique'];
  if (Array.isArray(point) && point.length >= 2) return { lat: Number(point[0]), lon: Number(point[1]) };
  if (point && typeof point === 'object') {
    const lat = Number(point.lat ?? point.latitude ?? point.y);
    const lon = Number(point.lon ?? point.lng ?? point.longitude ?? point.x);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const lat = Number(raw.latitude ?? raw.lat ?? raw.y_wgs84);
  const lon = Number(raw.longitude ?? raw.lon ?? raw.x_wgs84);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

function firstStringField(raw, names) {
  for (const name of names) {
    const value = raw?.[name];
    if (Array.isArray(value) && value.length) return value.join(', ');
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function normalizeSncfRailwayStation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const point = geoPointFromSncfRecord(raw);
  if (!point || !isInFranceBounds(point.lat, point.lon)) return null;
  const label = cleanText(firstStringField(raw, [
    'libelle', 'Libelle', 'nom_gare', 'Nom_Gare', 'Nom gare', 'nom', 'Nom', 'libelle_gare', 'gare', 'Gare', 'nom_long'
  ]) || firstStringField(raw, ['commune', 'nom_commune']) || 'Gare', 80);
  const communeName = firstStringField(raw, ['commune', 'nom_commune', 'Nom_Commune', 'ville', 'localite']) || label || '';
  const departementName = firstStringField(raw, ['departemen', 'departement', 'département', 'Departement', 'Département']);
  const codeCommune = firstStringField(raw, [
    'code_commune', 'Code_Commune', 'Code Commune', 'code_insee', 'codeinsee', 'insee', 'code_insee_commune', 'commune_code'
  ]).replace(/[^0-9AB]/gi, '').toUpperCase();
  const communeKey = normalizeNameKey(communeName);
  const rawUic = raw.code_uic ?? raw.Code_UIC ?? raw['Code_UIC'] ?? raw.uic ?? raw.UIC;
  const codeUic = Array.isArray(rawUic) ? rawUic.join(',') : String(rawUic || '');
  const voyageurs = /^o(ui)?$/i.test(firstStringField(raw, ['voyageurs', 'Voyageurs']));
  const fret = /^o(ui)?$/i.test(firstStringField(raw, ['fret', 'Fret']));
  if (!label || (!voyageurs && !fret)) return null;
  return {
    communeKey,
    communeName: cleanText(communeName, 80),
    departementName: cleanOptionalText(departementName, 80),
    codeCommune,
    label,
    lat: point.lat,
    lon: point.lon,
    voyageurs,
    fret,
    trigramme: firstStringField(raw, ['trigramme', 'Trigramme', 'code_gare']).slice(0, 12),
    segmentDrg: firstStringField(raw, ['segment_drg', 'Segment_DRG', 'Segment(s) DRG']),
    codeUic: codeUic.slice(0, 64),
    idGare: firstStringField(raw, ['idgaia', 'id_gaia', 'id_gare', 'Id_Gare', 'Id gare', 'id', 'recordid']).slice(0, 64),
    idReseau: firstStringField(raw, ['idreseau', 'id_reseau']).slice(0, 24),
    codeLigne: firstStringField(raw, ['code_ligne', 'Code Ligne']).slice(0, 16),
    rgTroncon: Number(raw.rg_troncon ?? raw.RG_TRONCON ?? 0),
    pk: firstStringField(raw, ['pk', 'PK']).slice(0, 24)
  };
}

function sncfStationGroupKey(station) {
  const uic = String(station?.codeUic || '').split(',')[0].trim();
  if (uic) return `uic:${uic}`;
  if (station?.idGare) return `gaia:${station.idGare}`;
  return `coord:${normalizeNameKey(station?.label)}:${roundCoord(station?.lat)}:${roundCoord(station?.lon)}`;
}

function safeStationIdPart(value, max = 48) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max);
}

function stationIdFromSncfGroup(groupKey, primary) {
  const uic = String(primary?.codeUic || '').split(',')[0].trim();
  if (uic) return `GARE_${safeStationIdPart(uic, 20)}`;
  if (primary?.idGare) return `GAIA_${safeStationIdPart(primary.idGare, 48)}`;
  return `GARE_${crypto.createHash('sha1').update(String(groupKey)).digest('hex').slice(0, 12)}`;
}

function choosePrimarySncfStation(records) {
  const list = (records || []).filter(Boolean);
  if (!list.length) return null;
  const avgLat = list.reduce((sum, item) => sum + Number(item.lat || 0), 0) / list.length;
  const avgLon = list.reduce((sum, item) => sum + Number(item.lon || 0), 0) / list.length;
  return [...list].sort((a, b) => {
    const passengerDelta = Number(Boolean(b.voyageurs)) - Number(Boolean(a.voyageurs));
    if (passengerDelta) return passengerDelta;
    const freightDelta = Number(Boolean(b.fret)) - Number(Boolean(a.fret));
    if (freightDelta) return freightDelta;
    const da = haversine(avgLat, avgLon, a.lat, a.lon);
    const db = haversine(avgLat, avgLon, b.lat, b.lon);
    return da - db || Number(a.rgTroncon || 0) - Number(b.rgTroncon || 0);
  })[0];
}

function departmentCodeFromName(name) {
  const key = String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, '-')
    .trim();
  return DEPARTMENT_NAME_TO_CODE[key] || '';
}

function normalizePopulationRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const code = String(raw.codgeo || raw.code || '').trim();
  const name = cleanOptionalText(raw.libgeo || raw.nom || '', 100);
  const dep = String(raw.dep || '').trim();
  const population = ['p23_pop', 'p22_pop', 'p21_pop', 'p20_pop', 'p19_pop']
    .map(field => Number(raw[field]))
    .find(value => Number.isFinite(value) && value >= 0);
  if (!code || !name || !Number.isFinite(population)) return null;
  return {
    code,
    name,
    dep,
    population: Math.round(population),
    nameKey: normalizeNameKey(name),
    sourceField: Number.isFinite(Number(raw.p23_pop)) ? 'p23_pop' : Number.isFinite(Number(raw.p22_pop)) ? 'p22_pop' : 'population'
  };
}

function makePopulationRecord({ code, name, dep, population, sourceField = 'p23_pop' }) {
  const cleanName = cleanOptionalText(name, 100);
  const roundedPopulation = Math.max(0, Math.round(Number(population || 0)));
  if (!code || !cleanName || !Number.isFinite(roundedPopulation)) return null;
  return {
    code: String(code),
    name: cleanName,
    dep: String(dep || ''),
    population: roundedPopulation,
    nameKey: normalizeNameKey(cleanName),
    sourceField
  };
}

function addAggregatedPlmPopulationRecords(records) {
  const out = [...(records || [])];
  const existingCodes = new Set(out.map(record => record.code).filter(Boolean));
  const configs = [
    { code: '75056', name: 'Paris', dep: '75', key: 'paris', minParts: 20 },
    { code: '69123', name: 'Lyon', dep: '69', key: 'lyon', minParts: 9 },
    { code: '13055', name: 'Marseille', dep: '13', key: 'marseille', minParts: 16 }
  ];

  for (const config of configs) {
    if (existingCodes.has(config.code)) continue;
    const parts = out.filter(record =>
      record.dep === config.dep
      && String(record.nameKey || '').startsWith(`${config.key} `)
      && String(record.nameKey || '').endsWith(' arrondissement')
    );
    if (parts.length < config.minParts) continue;
    const aggregate = makePopulationRecord({
      code: config.code,
      name: config.name,
      dep: config.dep,
      population: parts.reduce((sum, record) => sum + Number(record.population || 0), 0),
      sourceField: 'p23_pop arrondissements'
    });
    if (aggregate) {
      out.push(aggregate);
      existingCodes.add(aggregate.code);
    }
  }

  return out;
}

async function fetchPopulationMunicipalePage(page, attempt = 1) {
  const url = `${POPULATION_TABULAR_API_URL}?page=${page}&page_size=${POPULATION_TABULAR_PAGE_SIZE}`;
  try {
    return await fetchJsonWithNativeRequest(url, 45000);
  } catch (error) {
    if (attempt >= 3) throw error;
    await delayMs(250 * attempt);
    return fetchPopulationMunicipalePage(page, attempt + 1);
  }
}

function buildPopulationIndex(records, source) {
  const byCode = new Map();
  const byDeptName = new Map();
  const byName = new Map();
  for (const record of records || []) {
    byCode.set(record.code, record);
    if (record.dep && record.nameKey) byDeptName.set(`${record.dep}:${record.nameKey}`, record);
    if (record.nameKey) {
      if (!byName.has(record.nameKey)) byName.set(record.nameKey, []);
      byName.get(record.nameKey).push(record);
    }
  }
  return { records, byCode, byDeptName, byName, source };
}

async function fetchDataGouvPopulationMunicipaleIndex() {
  const first = await fetchPopulationMunicipalePage(1);
  const total = Math.max(0, Number(first?.meta?.total || 0));
  const pages = [first];
  const pageCount = Math.ceil(total / POPULATION_TABULAR_PAGE_SIZE);
  const pageNumbers = [];
  for (let page = 2; page <= pageCount; page += 1) pageNumbers.push(page);

  const failedPages = [];
  const concurrency = 6;
  for (let i = 0; i < pageNumbers.length; i += concurrency) {
    const chunk = pageNumbers.slice(i, i + concurrency);
    const results = await Promise.allSettled(chunk.map(fetchPopulationMunicipalePage));
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (result.status === 'fulfilled') pages.push(result.value);
      else {
        failedPages.push(chunk[index]);
        console.warn('Page population municipale indisponible:', result.reason?.message || result.reason);
      }
    }
  }

  for (const page of failedPages) {
    try {
      pages.push(await fetchPopulationMunicipalePage(page, 1));
    } catch (error) {
      console.warn(`Page population municipale ${page} toujours indisponible:`, error.message || error);
    }
  }

  const rawRecords = pages
    .flatMap(page => Array.isArray(page?.data) ? page.data : [])
    .map(normalizePopulationRecord)
    .filter(Boolean);
  if (total && rawRecords.length < Math.floor(total * 0.98)) {
    throw new Error(`DonnÃ©es population municipales incomplÃ¨tes: ${rawRecords.length}/${total}`);
  }
  const records = addAggregatedPlmPopulationRecords(rawRecords);
  return buildPopulationIndex(records, 'data.gouv.fr population municipale p23_pop');
}

function normalizeGeoApiPopulationRecord(station) {
  return makePopulationRecord({
    code: station.code,
    name: station.name,
    dep: station.codeDepartement,
    population: station.population,
    sourceField: 'geo.api.gouv.fr population'
  });
}

async function fetchGeoApiPopulationIndex() {
  const byId = await fetchCommunesByDepartments();
  const records = Object.values(byId)
    .map(normalizeGeoApiPopulationRecord)
    .filter(Boolean);
  if (records.length < 30000) throw new Error(`Fallback population geo.api.gouv.fr incomplet: ${records.length}/30000`);
  return buildPopulationIndex(records, 'geo.api.gouv.fr population communale fallback');
}

async function fetchPopulationMunicipaleIndex() {
  try {
    return await fetchDataGouvPopulationMunicipaleIndex();
  } catch (error) {
    console.warn('Population data.gouv.fr indisponible, fallback geo.api.gouv.fr:', error.message || error);
    return fetchGeoApiPopulationIndex();
  }
}

function populationForSncfStation(station, populationIndex) {
  if (!station || !populationIndex) return null;
  if (station.codeCommune && populationIndex.byCode.has(station.codeCommune)) return populationIndex.byCode.get(station.codeCommune);
  const dep = departmentCodeFromName(station.departementName);
  const key = dep && station.communeKey ? `${dep}:${station.communeKey}` : '';
  if (key && populationIndex.byDeptName.has(key)) return populationIndex.byDeptName.get(key);
  const sameName = populationIndex.byName.get(station.communeKey) || [];
  return sameName.length === 1 ? sameName[0] : null;
}

function buildStationsFromSncfList(sncfStations, populationIndex) {
  const groups = new Map();
  for (const record of sncfStations || []) {
    const key = sncfStationGroupKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  const stations = [];
  let populationMatched = 0;
  let duplicateRecords = 0;
  for (const [groupKey, records] of groups.entries()) {
    const primary = choosePrimarySncfStation(records);
    if (!primary) continue;
    duplicateRecords += Math.max(0, records.length - 1);
    const population = populationForSncfStation(primary, populationIndex);
    if (population) populationMatched += 1;
    const inhabitants = Math.max(0, Number(population?.population || 0));
    const populationSourceLabel = populationIndex?.source || 'population municipale';
    const hasPassengerStation = records.some(record => record.voyageurs);
    const hasFreightStation = records.some(record => record.fret);
    const baseDemand = hasPassengerStation
      ? (inhabitants > 0 ? passengerDemandFromPopulation(inhabitants) : 90)
      : (inhabitants > 0 ? Math.max(35, Math.round(passengerDemandFromPopulation(inhabitants) * 0.35)) : 35);
    const freight = Math.round(clamp((inhabitants > 0 ? Math.sqrt(inhabitants) * 0.62 : 30) + (hasFreightStation ? 42 : 0), 10, 190));
    const tourism = Math.round(clamp(30 + (inhabitants > 0 ? Math.log10(Math.max(inhabitants, 1)) * 12 : 8), 35, 120));
    const codeLignes = [...new Set(records.map(record => record.codeLigne).filter(Boolean))].sort();
    stations.push(normalizeCommuneStation({
      id: stationIdFromSncfGroup(groupKey, primary),
      code: population?.code || primary.codeCommune || '',
      name: primary.label,
      lat: roundCoord(primary.lat),
      lon: roundCoord(primary.lon),
      population: inhabitants,
      region: hasPassengerStation && hasFreightStation ? 'Gare voyageurs et fret' : hasPassengerStation ? 'Gare voyageurs' : 'Gare fret',
      codesPostaux: [],
      codeDepartement: population?.dep || departmentCodeFromName(primary.departementName),
      baseDemand,
      freight,
      tourism,
      commune: true,
      realStation: true,
      multiStation: true,
      allowSameCommuneStation: true,
      populationSource: population ? `${populationSourceLabel} (${population.sourceField})` : 'population municipale non rapprochée',
      communeName: primary.communeName,
      stationLat: roundCoord(primary.lat),
      stationLon: roundCoord(primary.lon),
      stationName: primary.label,
      stationUic: String(primary.codeUic || '').split(',')[0].trim(),
      stationTrigramme: primary.trigramme || '',
      stationIdGare: primary.idGare || primary.idReseau || '',
      stationSource: 'sncf-liste-des-gares',
      hasPassengerStation,
      hasFreightStation,
      stationKind: hasPassengerStation && hasFreightStation ? 'mixed' : hasPassengerStation ? 'passenger' : 'freight',
      codeLignes,
      sourceRecords: records.length
    }));
  }

  return {
    stations: stations.filter(Boolean).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr')),
    stats: {
      source: SNCF_STATION_DATASET,
      totalRecords: sncfStations.length,
      groupedStations: groups.size,
      duplicateRecords,
      populationMatched,
      populationTotal: populationIndex?.records?.length || 0,
      populationSource: populationIndex?.source || ''
    }
  };
}

function buildSncfStationIndex(stations) {
  const index = { byCommuneCode: new Map(), byName: new Map() };
  for (const station of stations || []) {
    if (station?.codeCommune) {
      if (!index.byCommuneCode.has(station.codeCommune)) index.byCommuneCode.set(station.codeCommune, []);
      index.byCommuneCode.get(station.codeCommune).push(station);
    }
    if (station?.communeKey) {
      if (!index.byName.has(station.communeKey)) index.byName.set(station.communeKey, []);
      index.byName.get(station.communeKey).push(station);
    }
  }
  return index;
}

function stationPlacementAllowedDistance(commune, exactCode = false) {
  const population = Number(commune?.population || 0);
  if (exactCode) return population >= 200000 ? 28 : population >= 50000 ? 20 : 14;
  return population >= 200000 ? 18 : population >= 50000 ? 12 : 8;
}

function selectBestSncfStationForCommune(commune, candidates) {
  const communeLat = Number(commune.lat);
  const communeLon = Number(commune.lon);
  const communeCode = String(commune.code || commune.communeCode || '').trim();
  const communeKey = normalizeSearch(commune.name || '');
  const communeDedup = stationDedupName(commune.name || '');
  const ranked = (candidates || [])
    .map(candidate => {
      const distanceKm = haversine(communeLat, communeLon, candidate.lat, candidate.lon);
      const label = candidate.label || '';
      const labelSearch = normalizeSearch(label);
      const labelKey = stationDedupName(label);
      const exactLabel = labelKey === communeDedup || labelSearch === communeKey;
      const includesLabel = communeKey && (labelSearch.includes(communeKey) || communeKey.includes(labelSearch));
      const exactCode = Boolean(communeCode && candidate.codeCommune === communeCode);
      const maxDistance = stationPlacementAllowedDistance(commune, exactCode);
      const nameCompatible = exactCode || exactLabel || includesLabel;
      const score = (exactCode ? 10000 : 0) + (exactLabel ? 1200 : 0) + (includesLabel ? 260 : 0) - distanceKm * (exactCode ? 5 : 16);
      return { candidate, distanceKm, score, exactCode, nameCompatible, maxDistance };
    })
    .filter(item => Number.isFinite(item.distanceKm) && item.distanceKm <= item.maxDistance && item.nameCompatible)
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
  return ranked[0]?.candidate || null;
}

function enrichCommunesWithSncfStations(byId, sncfStations) {
  const index = buildSncfStationIndex(sncfStations);
  let matched = 0;
  let duplicateStationCandidates = 0;
  const usedStationKeys = new Set();

  for (const station of Object.values(byId || {})) {
    delete station.stationLat;
    delete station.stationLon;
    delete station.stationName;
    delete station.stationUic;
    delete station.stationTrigramme;
    delete station.stationSource;
    delete station.hasPassengerStation;
    delete station.hasFreightStation;

    const communeCode = String(station.code || station.communeCode || '').trim();
    const communeKey = normalizeSearch(station.name || '');
    const exactCodeCandidates = communeCode ? (index.byCommuneCode.get(communeCode) || []) : [];
    const rawNameCandidates = exactCodeCandidates.length ? [] : (communeKey ? (index.byName.get(communeKey) || []) : []);
    const nameCandidates = rawNameCandidates.filter(candidate => {
      const distanceKm = haversine(Number(station.lat), Number(station.lon), candidate.lat, candidate.lon);
      return Number.isFinite(distanceKm) && distanceKm <= stationPlacementAllowedDistance(station, false);
    });
    const candidates = [...exactCodeCandidates, ...nameCandidates].filter((item, idx, arr) => arr.indexOf(item) === idx);
    if (!candidates.length) continue;

    if (candidates.length > 1) duplicateStationCandidates += candidates.length - 1;
    const best = selectBestSncfStationForCommune(station, candidates);
    if (!best) continue;

    const key = best.idGare || best.codeUic || `${best.lat.toFixed(5)},${best.lon.toFixed(5)}`;
    if (usedStationKeys.has(key)) continue;
    usedStationKeys.add(key);

    station.stationLat = roundCoord(best.lat);
    station.stationLon = roundCoord(best.lon);
    station.stationName = best.label;
    station.stationUic = best.codeUic;
    station.stationTrigramme = best.trigramme;
    station.stationIdGare = best.idGare;
    station.stationSource = 'sncf-gares-de-voyageurs';
    station.hasPassengerStation = true;
    matched += 1;
  }

  return {
    matched,
    totalStations: sncfStations.length,
    source: 'gares-de-voyageurs',
    unmatchedCities: Math.max(0, Object.keys(byId || {}).length - matched),
    duplicateStationCandidates
  };
}

function clearPassengerStationPlacement(station) {
  delete station.stationLat;
  delete station.stationLon;
  delete station.stationName;
  delete station.stationUic;
  delete station.stationTrigramme;
  delete station.stationIdGare;
  delete station.stationSource;
  delete station.hasPassengerStation;
}

function applyCriticalStationPlacementFallbacks(byId) {
  const fixes = [
    { code: '91286', stationName: 'Grigny Centre', lat: 48.6544, lon: 2.3946, uic: '', source: 'critical-fallback-grigny-centre' }
  ];
  let applied = 0;
  for (const fix of fixes) {
    const id = `COM_${fix.code}`;
    const station = byId?.[id] || Object.values(byId || {}).find(s => String(s.code || '') === fix.code);
    if (!station) continue;
    const existingLat = Number(station.stationLat);
    const existingLon = Number(station.stationLon);
    const existingDistance = Number.isFinite(existingLat) && Number.isFinite(existingLon)
      ? haversine(Number(station.lat), Number(station.lon), existingLat, existingLon)
      : Infinity;
    const fallbackDistance = haversine(Number(station.lat), Number(station.lon), fix.lat, fix.lon);
    if (!station.hasPassengerStation || existingDistance > Math.max(2.5, fallbackDistance + 1.2)) {
      station.stationLat = roundCoord(fix.lat);
      station.stationLon = roundCoord(fix.lon);
      station.stationName = fix.stationName;
      station.stationUic = fix.uic || station.stationUic || '';
      station.stationTrigramme = station.stationTrigramme || '';
      station.stationIdGare = station.stationIdGare || '';
      station.stationSource = fix.source;
      station.hasPassengerStation = true;
      applied += 1;
    }
  }
  return applied;
}

function auditStationPlacements(byId) {
  let cleared = 0;
  for (const station of Object.values(byId || {})) {
    if (!station.hasPassengerStation) continue;
    const lat = Number(station.stationLat);
    const lon = Number(station.stationLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isInFranceBounds(lat, lon)) {
      clearPassengerStationPlacement(station);
      cleared += 1;
      continue;
    }
    const exactCode = Boolean(station.stationSource === 'sncf-gares-de-voyageurs' && station.stationUic !== undefined);
    const maxDistance = stationPlacementAllowedDistance(station, exactCode) + 4;
    const distanceKm = haversine(Number(station.lat), Number(station.lon), lat, lon);
    if (!Number.isFinite(distanceKm) || distanceKm > maxDistance) {
      clearPassengerStationPlacement(station);
      cleared += 1;
    }
  }
  const fixed = applyCriticalStationPlacementFallbacks(byId);
  return { cleared, fixed };
}

function applyCriticalCommuneFallbacks(byId) {
  const critical = [
    { code: '91103', nom: 'Brétigny-sur-Orge', population: 26658, centre: { coordinates: [2.3059, 48.6114] }, codesPostaux: ['91220'], codeDepartement: '91' },
    { code: '91021', nom: 'Arpajon', population: 11144, centre: { coordinates: [2.2467, 48.5896] }, codesPostaux: ['91290'], codeDepartement: '91' },
    { code: '91345', nom: 'Longjumeau', population: 21700, centre: { coordinates: [2.2943, 48.6951] }, codesPostaux: ['91160'], codeDepartement: '91' },
    { code: '91376', nom: 'Marolles-en-Hurepoix', population: 5708, centre: { coordinates: [2.2992, 48.5641] }, codesPostaux: ['91630'], codeDepartement: '91' },
    { code: '14258', nom: 'Falaise', population: 8000, centre: { coordinates: [-0.1970, 48.8920] }, codesPostaux: ['14700'], codeDepartement: '14' }
  ];
  for (const commune of critical) addCommuneToIndex(byId, commune);
  return byId;
}

async function refreshCommuneCache(force = false) {
  const ageMs = communeCache.updatedAt ? Date.now() - Number(communeCache.updatedAt) : Infinity;
  if (!force && communeCacheUsable(communeCache) && ageMs < 7 * 24 * 3600 * 1000) {
    communeCache.status = 'ready-cache';
    return communeCache;
  }

  communeCache.status = 'loading';
  try {
    const [populationIndex, sncfStations] = await Promise.all([
      fetchPopulationMunicipaleIndex(),
      fetchSncfRailwayStations()
    ]);
    const built = buildStationsFromSncfList(sncfStations, populationIndex);
    const byId = {};
    for (const station of built.stations) byId[station.id] = station;
    const coverageCount = Object.keys(byId).length;
    if (coverageCount < COMMUNE_CACHE_MIN_READY_COUNT) {
      throw new Error(`Couverture gares SNCF incomplete: ${coverageCount}/${COMMUNE_CACHE_MIN_READY_COUNT}`);
    }
    const sncfStats = {
      ...built.stats,
      totalStations: coverageCount,
      matched: built.stats.populationMatched,
      source: SNCF_STATION_DATASET,
      populationSource: built.stats.populationSource || 'population-municipale-des-communes-france-entiere',
      populationResourceId: POPULATION_TABULAR_RESOURCE_ID
    };
    communeCache = { status: 'ready-live', updatedAt: Date.now(), byId, error: '', sncfStats, sourceVersion: COMMUNE_CACHE_SOURCE_VERSION };
    rebuildStationAliasMap(byId);
    remapStateStationAliases();
    _routeCache.clear();
    invalidatePublicWorldCache();
    fs.mkdirSync(path.dirname(COMMUNE_CACHE_FILE), { recursive: true });
    fs.writeFileSync(COMMUNE_CACHE_FILE, JSON.stringify({
      updatedAt: communeCache.updatedAt,
      minPopulation: MIN_COMMUNE_POPULATION,
      sourceVersion: COMMUNE_CACHE_SOURCE_VERSION,
      source: 'SNCF liste-des-gares + data.gouv.fr population municipale des communes',
      sncfStats,
      stations: Object.values(byId)
    }, null, 2));
    console.log(`Gares SNCF jouables chargées: ${Object.keys(byId).length} (${sncfStats.matched || 0} populations communales rapprochées)`);
    return communeCache;
  } catch (error) {
    communeCache.status = Object.keys(communeCache.byId || {}).length ? 'ready-cache-error' : 'error';
    communeCache.error = error.message;
    throw error;
  }
}


function passengerDemandFromPopulation(population) {
  const pop = Math.max(0, Number(population || 0));
  if (!Number.isFinite(pop) || pop <= 0) return 0;
  // Courbe volontairement sous-linéaire : la population reste le facteur principal,
  // sans écraser les différences de tourisme, desserte et époque.
  return Math.round(clamp(35 + Math.pow(pop / 1000, 0.70) * 24, 70, 1600));
}

function effectiveStationPassengerDemand(station) {
  if (!station) return 80;
  const population = Number(station.population || 0);
  if (Number.isFinite(population) && population > 0) return passengerDemandFromPopulation(population);
  const commune = closestCommuneForStation(station);
  if (commune?.population) return passengerDemandFromPopulation(commune.population);
  return clamp(Number(station.baseDemand || 80), 60, 1600);
}

function communeToStation(commune) {
  const population = Number(commune.population || 0);
  if (population < MIN_COMMUNE_POPULATION) return null;
  const coordinates = commune.centre?.coordinates || commune.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isInFranceBounds(lat, lon)) return null;
  return normalizeCommuneStation({
    id: `COM_${String(commune.code || '').replace(/[^A-Za-z0-9]/g, '')}`,
    code: String(commune.code || ''),
    name: commune.nom,
    lat,
    lon,
    population,
    region: 'Ville française',
    codesPostaux: Array.isArray(commune.codesPostaux) ? commune.codesPostaux : [],
    codeDepartement: commune.codeDepartement || '',
    baseDemand: passengerDemandFromPopulation(population),
    freight: Math.round(clamp(Math.sqrt(population) * 0.65, 20, 160)),
    tourism: Math.round(clamp(25 + Math.log10(Math.max(population, MIN_COMMUNE_POPULATION)) * 13, 35, 105)),
    commune: true,
    populationSource: 'geo.api.gouv.fr'
  });
}


function normalizeCommuneStation(station) {
  if (!station || typeof station !== 'object') return null;
  const lat = Number(station.lat);
  const lon = Number(station.lon);
  const stationLat = Number(station.stationLat);
  const stationLon = Number(station.stationLon);
  const population = Number(station.population || 0);
  if (!station.id || population < MIN_COMMUNE_POPULATION || !Number.isFinite(lat) || !Number.isFinite(lon) || !isInFranceBounds(lat, lon)) return null;
  const providedDemand = Number(station.baseDemand);
  const baseDemand = population > 0
    ? passengerDemandFromPopulation(population)
    : (Number.isFinite(providedDemand) && providedDemand > 0 ? providedDemand : 70);
  const normalized = {
    id: String(station.id),
    code: String(station.code || '').slice(0, 12),
    name: cleanText(station.name || 'Gare', 48),
    lat,
    lon,
    population: Math.round(population),
    region: cleanText(station.region || 'Gare RFN', 48),
    codesPostaux: Array.isArray(station.codesPostaux) ? station.codesPostaux.slice(0, 8) : [],
    codeDepartement: String(station.codeDepartement || '').slice(0, 4),
    baseDemand: Math.round(clamp(baseDemand, 0, 1600)),
    freight: clamp(Number(station.freight || Math.sqrt(population) * 0.65), 0, 170),
    tourism: clamp(Number(station.tourism || 35), 0, 120),
    commune: Boolean(station.commune),
    populationSource: station.populationSource || 'data.gouv.fr population municipale'
  };
  if (station.realStation) normalized.realStation = true;
  if (Array.isArray(station.codeLignes)) normalized.codeLignes = station.codeLignes.slice(0, 16).map(code => String(code).slice(0, 16));
  if (Number.isFinite(Number(station.sourceRecords))) normalized.sourceRecords = Math.max(1, Math.round(Number(station.sourceRecords)));
  const annualPassengers = Number(station.annualPassengers || station.passengers2024 || 0);
  const purchaseCost = station.majorTerminal && Number.isFinite(annualPassengers) && annualPassengers > 0
    ? stationPriceFromAnnualPassengers(annualPassengers) * 50
    : Number(station.purchaseCost || station.acquisitionCost || 0);
  if (Number.isFinite(annualPassengers) && annualPassengers > 0) normalized.annualPassengers = Math.round(annualPassengers);
  if (Number.isFinite(Number(station.passengerTrafficYear))) normalized.passengerTrafficYear = Math.round(Number(station.passengerTrafficYear));
  if (Number.isFinite(purchaseCost) && purchaseCost > 0) normalized.purchaseCost = Math.round(purchaseCost);
  if (station.stationKind) normalized.stationKind = cleanText(station.stationKind, 40);
  if (station.communeName) normalized.communeName = cleanText(station.communeName, 80);
  if (station.majorTerminal) normalized.majorTerminal = true;
  if (station.multiStation) normalized.multiStation = true;
  if (station.allowSameCommuneStation) normalized.allowSameCommuneStation = true;
  if (Number.isFinite(stationLat) && Number.isFinite(stationLon) && isInFranceBounds(stationLat, stationLon)) {
    normalized.stationLat = stationLat;
    normalized.stationLon = stationLon;
    normalized.stationName = cleanText(station.stationName || station.name || 'Gare', 64);
    normalized.stationUic = String(station.stationUic || '').slice(0, 16);
    normalized.stationTrigramme = String(station.stationTrigramme || '').slice(0, 12);
    normalized.stationIdGare = String(station.stationIdGare || station.stationUic || '').slice(0, 64);
    normalized.stationSource = station.stationSource || 'sncf-liste-des-gares';
    normalized.hasPassengerStation = Boolean(station.hasPassengerStation);
    normalized.hasFreightStation = Boolean(station.hasFreightStation);
  }
  return normalized;
}


function searchCommuneStations(query, limit = 30) {
  const q = normalizeSearch(query || '');
  const all = Object.values(communeCache.byId || {});
  if (!q) return all.sort((a, b) => (b.population || 0) - (a.population || 0)).slice(0, limit);
  return all
    .map(s => {
      const name = normalizeSearch(s.name);
      const postal = (s.codesPostaux || []).join(' ');
      const starts = name.startsWith(q) ? 1000 : 0;
      const includes = name.includes(q) ? 300 : 0;
      const postalScore = postal.includes(q) ? 400 : 0;
      return { s, score: starts + includes + postalScore + Math.log10((s.population || 5000)) * 10 };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.s);
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizeNameKey(value) {
  return normalizeSearch(value)
    .replace(/\bste?\b/g, 'saint')
    .replace(/\bsaints\b/g, 'saint')
    .replace(/\bsainte\b/g, 'saint')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCustomStations(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, station] of Object.entries(raw)) {
    const normalized = normalizeCustomStation(station, id);
    if (normalized) out[normalized.id] = normalized;
  }
  return out;
}

function normalizeCustomStation(station, fallbackId) {
  if (!station || typeof station !== 'object') return null;
  const id = String(station.id || fallbackId || '').slice(0, 40);
  const lat = Number(station.lat);
  const lon = Number(station.lon);
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lon) || !isInFranceBounds(lat, lon)) return null;
  return {
    id,
    name: cleanText(station.name || 'Arrêt personnalisé', 38),
    lat,
    lon,
    region: cleanText(station.region || 'Arrêts personnalisés', 40),
    baseDemand: clamp(Number(station.baseDemand || 95), 30, 420),
    freight: clamp(Number(station.freight || 28), 0, 140),
    tourism: clamp(Number(station.tourism || 40), 0, 110),
    custom: true,
    ownerId: station.ownerId || null,
    createdDay: Number(station.createdDay || state?.day || 1),
    creationCost: Math.max(0, Math.round(Number(station.creationCost || station.purchaseCost || 0))),
    pricingSource: station.pricingSource || 'local-neighbourhood'
  };
}

function isInFranceBounds(lat, lon) {
  return lat >= 41.0 && lat <= 51.5 && lon >= -5.7 && lon <= 10.2;
}

function publicState(playerId, authUser = null) {
  const players = activePlayers().map(p => publicPlayer(p));
  const me = playerId ? players.find(p => p.id === playerId) || null : null;
  return {
    ok: true,
    serverTime: Date.now(),
    auth: authUser ? { username: authUser.username, playerId: authUser.playerId, isAdmin: isAdminUser(authUser) } : null,
    world: publicWorld(),
    balance: BALANCE.public,
    game: {
      day: state.day,
      eraYear: state.eraYear,
      tickMs: TICK_MS,
      market: state.market,
      events: state.events,
      news: state.news.slice(-12).reverse(),
      playerCount: activePlayers().length
    },
    players,
    me,
    admin: isAdminUser(authUser) ? buildAdminDashboard() : null
  };
}

function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    logo: p.logo,
    region: p.region,
    cash: Math.round(p.cash),
    debt: Math.round(p.debt),
    reputation: round2(p.reputation),
    co2: Math.round(p.co2),
    epoch: p.epoch,
    eraName: BALANCE.epochs[p.epoch]?.name || 'Inconnue',
    research: round2(p.research),
    tech: p.tech,
    techUnlocked: p.techUnlocked || {},
    researchProject: publicResearchProject(p),
    researchQueue: publicResearchQueue(p),
    maintenancePolicy: p.maintenancePolicy || 'standard',
    score: Math.round(scorePlayer(p)),
    stats: p.stats,
    trains: p.trains.map(t => publicTrain(t, p)),
    lines: p.lines.map(line => ({ ...normalizeLine(line), staffNeeds: computeLineStaffNeeds(p, line) })),
    stations: p.stations,
    staff: p.staff,
    staffNeeds: computeStaffNeeds(p),
    tutorial: createTutorialState(p.tutorial),
    energyStrategy: p.energyStrategy,
    resources: normalizeResources(p.resources),
    resourceFlow: computePlayerResourceFlow(p),
    notifications: p.notifications.slice(-12).reverse()
  };
}

function publicResearchProject(player) {
  const project = normalizeResearchProject(player.researchProject);
  player.researchProject = project;
  if (!project) return null;
  const node = techNodeById(project.nodeId);
  const workRate = Math.max(0.01, researchWorkRate(player));
  const realRemainingMs = Math.max(0, project.remainingMs / workRate);
  return {
    ...project,
    title: node?.title || project.nodeId,
    branch: node?.branch || '',
    progress: round2((1 - project.remainingMs / Math.max(1, project.durationMs)) * 100),
    remainingMs: project.remainingMs,
    realRemainingMs,
    durationMs: project.durationMs,
    endAt: Date.now() + realRemainingMs,
    workRate
  };
}

function publicResearchQueue(player) {
  player.researchQueue = normalizeResearchQueue(player.researchQueue);
  return player.researchQueue.map(item => {
    const node = techNodeById(item.nodeId);
    return {
      ...item,
      title: node?.title || item.nodeId,
      branch: node?.branch || '',
      durationMs: item.durationMs
    };
  });
}

function createPlayer(input) {
  const id = crypto.randomUUID();
  const name = cleanText(input.name || `Compagnie ${Object.keys(state.players).length + 1}`, 28);
  const color = validateColor(input.color) || randomColor();
  const logo = sanitizeCompanyLogo(input.logo);
  const region = 'France';

  const player = {
    id,
    name,
    color,
    logo,
    region,
    cash: STARTING_CASH,
    debt: 0,
    epoch: 0,
    research: 0,
    tech: {
      traction: 0,
      energy: 0,
      operations: 0,
      stations: 0,
      social: 0,
      freight: 0
    },
    techUnlocked: {},
    researchProject: null,
    researchQueue: [],
    maintenancePolicy: 'standard',
    reputation: 50,
    co2: 0,
    energyStrategy: 'spot',
    resources: normalizeResources({ coal: 100 }),
    staff: {
      drivers: 0,
      controllers: 0,
      stationAgents: 0,
      mechanics: 0,
      dispatchers: 0,
      engineers: 0
    },
    tutorial: createTutorialState(),
    trains: [],
    lines: [],
    stations: {},
    stats: {
      passengers: 0,
      freightTons: 0,
      revenue: 0,
      expenses: 0,
      profit: 0,
      lastRevenue: 0,
      lastExpenses: 0,
      lastProfit: 0,
      punctuality: 91,
      satisfaction: 55,
      marketShare: 0
    },
    notifications: [{
      day: state.day,
      text: `Compagnie créée avec ${money(STARTING_CASH)}. Achète un premier matériel roulant dans l’onglet Parc, puis ouvre ta première ligne courte ou régionale.`
    }],
    createdAt: Date.now(),
    lastSeen: Date.now()
  };

  state.players[id] = player;
  state.news.push({ day: state.day, text: `${player.name} entre sur le marché ferroviaire.` });
  saveState();
  return player;
}


async function applyAction(playerId, type, payload) {
  const player = state.players[playerId];
  if (!player) return { ok: false, error: 'Joueur introuvable.' };
  player.lastSeen = Date.now();

  const handlers = {
    buyTrain: () => actionBuyTrain(player, payload),
    sellTrain: () => actionSellTrain(player, payload),
    repairTrain: () => actionRepairTrain(player, payload),
    repairAllTrains: () => actionRepairAllTrains(player, payload),
    updateTrainComposition: () => actionUpdateTrainComposition(player, payload),
    setMaintenancePolicy: () => actionSetMaintenancePolicy(player, payload),
    createLine: () => actionCreateLine(player, payload),
    closeLine: () => actionCloseLine(player, payload),
    updateLine: () => actionUpdateLine(player, payload),
    upgradeStation: () => actionUpgradeStation(player, payload),
    sellStation: () => actionSellStation(player, payload),
    createCustomStation: () => actionCreateCustomStation(player, payload),
    hireStaff: () => actionHireStaff(player, payload),
    fireStaff: () => actionFireStaff(player, payload),
    research: () => actionResearch(player, payload),
    cancelResearch: () => actionCancelResearch(player, payload),
    energyStrategy: () => actionEnergyStrategy(player, payload),
    buyResource: () => actionBuyResource(player, payload),
    setElectricityOrder: () => actionSetElectricityOrder(player, payload),
    takeLoan: () => actionTakeLoan(player, payload),
    repayLoan: () => actionRepayLoan(player, payload),
    rename: () => actionRename(player, payload),
    resetCompany: () => actionResetCompany(player, payload),
    tutorial: () => actionTutorial(player, payload)
  };

  const handler = handlers[type];
  if (!handler) return { ok: false, error: 'Action inconnue.' };
  const result = await handler();
  if (result.ok) saveState();
  return result;
}

function actionBuyTrain(player, payload) {
  const model = BALANCE.trains[payload.modelId];
  if (!model) return fail('Modèle inconnu.');
  if (model.unlockEpoch > player.epoch) return fail('Ce matériel n’est pas encore débloqué.', `Il sera accessible à partir de l’époque : ${BALANCE.epochs[model.unlockEpoch]?.name || model.unlockEpoch + 1}.`);
  const requiredTechLevel = Math.max(1, Math.floor(Number(model.requiredTechLevel || 1)));
  if (model.requiredTech && !hasTech(player, model.requiredTech, requiredTechLevel)) {
    const tech = techNodeById(model.requiredTech);
    return fail('Recherche requise avant achat.', `Débloque d’abord : ${tech?.title || model.requiredTech} niveau ${requiredTechLevel}.`);
  }
  const multiplier = currentPriceMultiplier(player, model.energyType);
  const price = Math.round(model.price * multiplier);
  if (!canPay(player, price)) return fail(`Trésorerie insuffisante. Prix: ${money(price)}.`);
  player.cash -= price;
  const train = createTrainInstance(payload.modelId, player.id);
  player.trains.push(train);
  markTutorialAction(player, 'buyTrain');
  notify(player, `Achat confirmé : ${model.name} pour ${money(price)}.`);
  return ok();
}

function actionSellTrain(player, payload) {
  const train = player.trains.find(t => t.id === payload.trainId);
  if (!train) return fail('Train introuvable.');
  if (train.maintenance?.active) return fail('Ce train est en maintenance.', 'Attends la fin de l’intervention avant de le vendre.');
  const used = player.lines.some(l => l.active && lineTrainIds(l).includes(train.id));
  if (used) return fail('Ce train est affecté à une ligne active. Fermez ou modifiez la ligne avant de le vendre.');
  const model = BALANCE.trains[train.modelId];
  const capitalValue = trainCapitalValue(model, train);
  const value = Math.max(5000, Math.round(capitalValue * (0.45 - Math.min(0.3, train.age / 1000)) * train.condition));
  player.cash += value;
  player.trains = player.trains.filter(t => t.id !== train.id);
  notify(player, `${model.name} vendu pour ${money(value)}.`);
  return ok();
}



function actionUpdateTrainComposition(player, payload) {
  const train = player.trains.find(t => t.id === payload.trainId);
  if (!train) return fail('Train introuvable.');
  if (train.maintenance?.active) return fail('Composition indisponible.', 'Le train est actuellement en maintenance.');
  const model = BALANCE.trains[train.modelId];
  if (!model) return fail('Modèle introuvable.');
  const current = ensureTrainComposition(train, model);
  const requestedMode = payload.mode || current.mode;
  const spec = compositionSpecForModel(model, requestedMode);
  const updated = { ...current, mode: spec.mode };

  if (spec.mode === 'multiple_unit') {
    updated.powerUnits = clamp(Math.round(Number(payload.powerUnits ?? current.powerUnits)), spec.powerUnits.min, spec.powerUnits.max);
  } else if (spec.mode === 'passenger_loco') {
    updated.passengerCars = clamp(Math.round(Number(payload.passengerCars ?? current.passengerCars)), spec.passengerCars.min, spec.passengerCars.max);
    const variant = compositionVariantForMode('passenger_loco', payload.passengerVariant ?? current.passengerVariant);
    if (!compositionVariantUnlockedForPlayer(player, model, variant)) {
      const tech = variant?.requiredTech ? techNodeById(variant.requiredTech) : null;
      return fail('Variante non débloquée.', tech ? `Recherche requise : ${tech.title}.` : 'Cette variante demande une époque plus avancée.');
    }
    updated.passengerVariant = variant?.id || current.passengerVariant;
  } else {
    updated.freightCars = clamp(Math.round(Number(payload.freightCars ?? current.freightCars)), spec.freightCars.min, spec.freightCars.max);
    const variant = compositionVariantForMode('freight_loco', payload.freightVariant ?? current.freightVariant);
    if (!compositionVariantUnlockedForPlayer(player, model, variant)) {
      const tech = variant?.requiredTech ? techNodeById(variant.requiredTech) : null;
      return fail('Variante non débloquée.', tech ? `Recherche requise : ${tech.title}.` : 'Cette variante demande une époque plus avancée.');
    }
    updated.freightVariant = variant?.id || current.freightVariant;
  }

  const targetComposition = { ...current, ...updated, mode: spec.mode };
  const economy = compositionChangeEconomy(model, current, targetComposition, train);
  if (economy.cost > 0 && !canPay(player, economy.cost)) {
    return fail(`Trésorerie insuffisante. Coût de composition : ${money(economy.cost)}.`);
  }

  const before = getTrainOperatingProfile({ ...train, composition: current }, model);
  if (economy.cost > 0) player.cash -= economy.cost;
  if (economy.refund > 0) player.cash += economy.refund;
  train.composition = targetComposition;
  const after = getTrainOperatingProfile(train, model);
  markTutorialAction(player, 'compositionSaved');
  refreshPlayerLineStatsNow(player);
  const cashText = economy.cost > 0
    ? `Coût : ${money(economy.cost)}.`
    : economy.refund > 0
      ? `Remboursement : ${money(economy.refund)}.`
      : 'Aucun coût.';
  notify(player, `Composition mise à jour pour ${model.name} : ${after.compositionSummary}. ${cashText}`);
  return ok(`Composition mise à jour (${before.compositionSummary} → ${after.compositionSummary}). ${cashText}`);
}

function ticketPriceCeiling(distance) {
  const km = Math.max(1, Number(distance || 0));
  // Plafond progressif volontairement sobre : le prix dépend de la longueur,
  // mais les petites et moyennes lignes ne peuvent plus atteindre des billets extravagants.
  return Math.round(Math.min(TICKET_PRICE_CAP_ABSOLUTE, Math.max(5, 2.5 + km * 0.18)));
}

function demandAdjustedTicketPrice(line, distance, demand) {
  const km = Math.max(1, Number(distance || 0));
  const rawUnitPrice = lineEffectiveTariff(line, km);
  const unitPrice = clamp(rawUnitPrice, 0.035, 0.16);
  const demandFactor = clamp(0.9 + Math.log10(1 + Math.max(0, Number(demand || 0)) / 280) * 0.10, 0.9, 1.10);
  return clampTicketPrice(km * unitPrice * demandFactor, km);
}

function clampTicketPrice(price, distance) {
  const value = Number(price);
  const fallback = Math.max(1, Math.round(Math.max(1, Number(distance || 0)) * DEFAULT_PASSENGER_TARIFF));
  const normalized = Number.isFinite(value) ? Math.max(0, value) : fallback;
  return Math.min(ticketPriceCeiling(distance), Math.round(normalized));
}

function tariffFromTicketPrice(price, distance) {
  const routeDistance = Math.max(1, Number(distance || 0));
  return clampTicketPrice(price, routeDistance) / routeDistance;
}

function lineTariffFromPayload(payload, distance) {
  const routeDistance = Math.max(1, Number(distance || 0));
  if (payload.ticketPrice !== undefined) {
    return tariffFromTicketPrice(payload.ticketPrice, routeDistance);
  }
  const tariff = Number(payload.tariff);
  if (Number.isFinite(tariff)) {
    return tariffFromTicketPrice(Math.max(0, tariff) * routeDistance, routeDistance);
  }
  return tariffFromTicketPrice(routeDistance * DEFAULT_PASSENGER_TARIFF, routeDistance);
}

function lineTicketPriceFromPayload(payload, distance, fallbackLine = null) {
  const routeDistance = Math.max(1, Number(distance || 0));
  if (payload?.ticketPrice !== undefined) {
    return clampTicketPrice(payload.ticketPrice, routeDistance);
  }
  if (payload?.tariff !== undefined) {
    const tariff = Number(payload.tariff);
    if (Number.isFinite(tariff)) return clampTicketPrice(Math.max(0, tariff) * routeDistance, routeDistance);
  }
  if (fallbackLine) return lineTicketPrice(fallbackLine, routeDistance);
  return clampTicketPrice(routeDistance * DEFAULT_PASSENGER_TARIFF, routeDistance);
}

function setLineTicketPrice(line, ticketPrice, distance = lineDistance(line)) {
  const routeDistance = Math.max(1, Number(distance || 0));
  const price = clampTicketPrice(ticketPrice, routeDistance);
  line.ticketPrice = price;
  line.tariff = tariffFromTicketPrice(price, routeDistance);
  return price;
}

function lineTicketPrice(line, distance = lineDistance(line)) {
  const routeDistance = Math.max(1, Number(distance || 0));
  const storedPrice = Number(line?.ticketPrice);
  if (Number.isFinite(storedPrice)) return clampTicketPrice(storedPrice, routeDistance);
  const tariff = Number(line?.tariff);
  if (Number.isFinite(tariff)) return clampTicketPrice(Math.max(0, tariff) * routeDistance, routeDistance);
  return clampTicketPrice(routeDistance * DEFAULT_PASSENGER_TARIFF, routeDistance);
}

function lineEffectiveTariff(line, distance = lineDistance(line)) {
  const routeDistance = Math.max(1, Number(distance || 0));
  return lineTicketPrice(line, routeDistance) / routeDistance;
}

async function actionCreateLine(player, payload) {
  const rawStops = sanitizeStopsPayload(payload.stops, payload.from, payload.to);
  const stops = rawStops;
  const trainId = String(payload.trainId || '');
  const service = ['passengers', 'freight', 'mixed'].includes(payload.service) ? payload.service : 'passengers';
  const frequency = 1;

  const invalidReason = validateLineStops(stops);
  if (invalidReason) return fail(invalidReason);
  const serviceStopProblem = validateLineStopService(stops, service);
  if (serviceStopProblem) return fail(serviceStopProblem);
  const train = player.trains.find(t => t.id === trainId);
  if (!train) return fail('Train introuvable.');
  if (train.maintenance?.active) return fail('Ce train est indisponible.', `Maintenance en cours : ${formatCycles(train.maintenance.daysLeft)} restant(s).`);
  if (trainUsedByActiveLine(player, trainId)) return fail('Ce train est déjà affecté à une ligne active.');
  const model = BALANCE.trains[train.modelId];
  const operatingModel = getTrainOperatingProfile(train, model, player);
  if (!lineServiceCompatibleWithProfile(service, operatingModel)) return fail('Ce train n’est pas compatible avec ce type de service.');

  const routeInfo = await realRailRouteBetweenStops(stops);
  if (!routeInfo.ids.length || routeInfo.distance <= 0) {
    const missing = routeInfo.missing;
    const from = missing ? stationById(missing.from)?.name || missing.from : '';
    const to = missing ? stationById(missing.to)?.name || missing.to : '';
    return fail('Aucun itinéraire RFN réel entre ces gares.', missing ? `Segment introuvable dans formes-des-lignes-du-rfn : ${from} → ${to}.` : 'Choisis des gares reliées par le Réseau Ferré National.');
  }
  const ownershipProblem = lineStopsOwnershipProblem(stops);
  if (ownershipProblem) return fail(ownershipProblem);
  const ticketPrice = lineTicketPriceFromPayload(payload, routeInfo.distance);
  const tariff = tariffFromTicketPrice(ticketPrice, routeInfo.distance);
  const effectiveRange = effectiveTrainRange(player, operatingModel, routeInfo);
  if (routeInfo.distance > effectiveRange) {
    const routeText = routeInfo.ids.map(id => stationById(id)?.name || id).join(' → ');
    return fail(
      `Portée insuffisante pour ${model.name}. Distance de ligne : ${Math.round(routeInfo.distance)} km. Portée actuelle : ${Math.round(effectiveRange)} km.`,
      `Choisis une ligne plus courte, achète un matériel avec plus de portée, ou développe les recherches de la même ère. Itinéraire calculé : ${routeText}.`
    );
  }

  const setupCost = Math.round(2500 + routeInfo.distance * 220 + Math.max(0, stops.length - 2) * 1400 + (service !== 'passengers' ? routeInfo.distance * 100 : 0));
  if (!canPay(player, setupCost)) return fail(`Trésorerie insuffisante. Coût de lancement: ${money(setupCost)}.`);

  player.cash -= setupCost;
  const line = createLineInstance(player, stops, trainId, service, frequency, ticketPrice, routeInfo);
  player.lines.push(line);
  markTutorialAction(player, 'createLine');
  notify(player, `Nouvelle ligne ouverte : ${lineStopsNames(stops)}.`);
  return ok();
}

function actionCloseLine(player, payload) {
  const line = player.lines.find(l => l.id === payload.lineId);
  if (!line) return fail('Ligne introuvable.');
  line.active = false;
  notify(player, `${lineRouteName(lineStops(line))} fermée.`);
  return ok();
}

function refreshPlayerLineStatsNow(player) {
  try {
    const lineMarkets = buildLineMarkets();
    simulatePlayer(player, lineMarkets, null, { dryRun: true });
  } catch (error) {
    console.warn('Recalcul immédiat des lignes impossible:', error.message);
  }
}


async function actionUpdateLine(player, payload) {
  const line = player.lines.find(l => l.id === payload.lineId);
  if (!line) return fail('Ligne introuvable.');
  normalizeLine(line);
  let changedOperationalData = false;

  const currentStops = lineStops(line);
  let nextStops = currentStops;
  if (Array.isArray(payload.stops)) {
    const rawStops = sanitizeStopsPayload(payload.stops, null, null);
    nextStops = rawStops;
  }

  const requestedService = payload.service !== undefined ? String(payload.service || '').trim() : line.service;
  const nextService = ['passengers', 'freight', 'mixed'].includes(requestedService) ? requestedService : line.service;

  let nextTrainIds = lineTrainIds(line);
  if (Array.isArray(payload.trainIds)) {
    nextTrainIds = [...new Set(payload.trainIds.map(id => String(id || '').trim()).filter(Boolean))];
  } else if (payload.trainId) {
    nextTrainIds = [String(payload.trainId || '').trim()].filter(Boolean);
  }

  const invalidReason = validateLineStops(nextStops);
  if (invalidReason) return fail(invalidReason);
  const serviceStopProblem = validateLineStopService(nextStops, nextService);
  if (serviceStopProblem) return fail(serviceStopProblem);
  if (!nextTrainIds.length) return fail('Sélectionne au moins un train pour cette ligne.');

  const routeInfo = await realRailRouteBetweenStops(nextStops);
  if (!routeInfo.ids.length || routeInfo.distance <= 0) {
    const missing = routeInfo.missing;
    const from = missing ? stationById(missing.from)?.name || missing.from : '';
    const to = missing ? stationById(missing.to)?.name || missing.to : '';
    return fail('Impossible de calculer un itinéraire RFN réel pour cette suite d’arrêts.', missing ? `Segment introuvable dans formes-des-lignes-du-rfn : ${from} → ${to}.` : '');
  }
  const ownershipProblem = lineStopsOwnershipProblem(nextStops);
  if (ownershipProblem) return fail(ownershipProblem);
  if (!Array.isArray(payload.stops) && (!Number.isFinite(Number(line.distance)) || !Array.isArray(line.routeSegments) || !line.routeSegments.length)) {
    applyValidatedRouteToLine(line, routeInfo);
    changedOperationalData = true;
  }

  const selectedTrains = [];
  for (const trainId of nextTrainIds) {
    const train = player.trains.find(t => t.id === trainId);
    if (!train) return fail(`Train introuvable : ${trainId}.`);
    if (train.maintenance?.active) return fail('Un train sélectionné est en maintenance.', `${BALANCE.trains[train.modelId]?.name || 'Train'} sera disponible dans ${formatCycles(train.maintenance.daysLeft)}.`);
    if (trainUsedByActiveLine(player, train.id, line.id)) return fail('Un train sélectionné est déjà utilisé ailleurs.', 'Retire-le de son autre ligne avant de l’affecter ici.');
    selectedTrains.push(train);
  }

  const bundle = combinedOperatingProfile(player, selectedTrains);
  if (!bundle) return fail('Aucun matériel exploitable sélectionné.');
  const effectiveRange = effectiveTrainRange(player, bundle.profile, routeInfo);
  if (routeInfo.distance > effectiveRange) {
    return fail(
      `Modification impossible : la ligne fait ${Math.round(routeInfo.distance)} km, alors que la portée minimale des trains sélectionnés est ${Math.round(effectiveRange)} km.`,
      'Retire les trains trop courts, choisis une ligne plus courte ou développe les recherches de la même ère.'
    );
  }
  if (!lineServiceCompatibleWithProfile(nextService, bundle.profile)) {
    const label = nextService === 'freight' ? 'fret' : nextService === 'mixed' ? 'mixte' : 'voyageurs';
    return fail(`Service ${label} impossible avec les trains sélectionnés.`, 'Choisis du matériel compatible avec le type de transport demandé.');
  }

  if (Array.isArray(payload.stops)) {
    const preservedTicketPrice = lineTicketPrice(line, lineDistance(line));
    line.stops = [...nextStops];
    applyValidatedRouteToLine(line, routeInfo);
    normalizeLine(line);
    if (payload.ticketPrice === undefined && payload.tariff === undefined) setLineTicketPrice(line, preservedTicketPrice, lineDistance(line));
    changedOperationalData = true;
  }

  if (payload.service !== undefined && line.service !== nextService) {
    line.service = nextService;
    changedOperationalData = true;
  }

  const currentTrainKey = lineTrainIds(line).join('|');
  const nextTrainKey = nextTrainIds.join('|');
  if (currentTrainKey !== nextTrainKey) {
    line.trainIds = [...nextTrainIds];
    line.trainId = nextTrainIds[0];
    changedOperationalData = true;
  }
  if (payload.ticketPrice !== undefined || payload.tariff !== undefined) {
    setLineTicketPrice(line, lineTicketPriceFromPayload(payload, lineDistance(line), line), lineDistance(line));
    changedOperationalData = true;
  }
  if (payload.electrify) {
    const distance = lineDistance(line);
    const techDiscount = (1 - Math.min(0.2, player.tech.energy * 0.03)) * (hasTech(player, 'electric_substations') ? 0.92 : 1);
    const cost = Math.round(distance * 125000 * techDiscount);
    if (line.electrified) return fail('Ligne déjà électrifiée.');
    if (!canPay(player, cost)) return fail(`Électrification impossible : ${money(cost)} requis.`);
    player.cash -= cost;
    line.electrified = true;
    for (const stopId of lineStops(line)) {
      if (player.stations?.[stopId]) normalizeStationAsset(player, stopId).electrified = true;
    }
    changedOperationalData = true;
    notify(player, `Électrification terminée sur ${lineRouteName(lineStops(line))} pour ${money(cost)}.`);
  }
  normalizeLine(line);
  if (changedOperationalData) refreshPlayerLineStatsNow(player);
  return ok(`Ligne modifiée. Billet moyen : ${money(lineTicketPrice(line))}.`);
}

function actionUpgradeStation(player, payload) {
  const stationId = String(payload.stationId || '');
  const kind = String(payload.kind || 'level');
  const station = stationById(stationId);
  if (!station) return fail('Gare introuvable.');
  if (!['level', 'commerce', 'maintenance', 'depot'].includes(kind)) return fail('Amélioration inconnue.');

  const currentOwner = stationOwnerInfo(stationId);
  if (currentOwner && currentOwner.player.id !== player.id) {
    return fail(`${station.name} appartient déjà à ${currentOwner.player.name}.`, 'Choisis une gare non possédée ou développe tes propres gares.');
  }

  const wasUnowned = !currentOwner;
  if (wasUnowned && kind !== 'level') {
    return fail('Achat requis.', `Achète d’abord ${station.name} avant de construire des commerces, ateliers ou dépôts.`);
  }

  const asset = ensureStationAsset(player, stationId);
  const maxed =
    !wasUnowned && (
      (kind === 'level' && asset.level >= 5) ||
      (kind === 'commerce' && asset.commerce >= 4) ||
      (kind === 'maintenance' && asset.maintenance >= 4) ||
      (kind === 'depot' && asset.depot)
    );
  if (maxed) return fail('Cette amélioration est déjà au maximum.');

  const cost = wasUnowned ? stationAcquisitionCost(station) : stationUpgradeCost(station, asset, kind);
  if (!Number.isFinite(cost) || cost <= 0) return fail('Coût d’amélioration invalide.');
  if (!canPay(player, cost)) return fail(`Trésorerie insuffisante. Coût: ${money(cost)}.`);

  player.cash -= cost;
  if (wasUnowned) {
    notify(player, `${station.name} acquise pour ${money(cost)} : les autres compagnies devront payer un péage de gare si elles la desservent.`);
    return ok('Ville achetée.');
  }

  if (kind === 'level') {
    asset.level += 1;
    notify(player, `${station.name} améliorée au niveau ${asset.level} pour ${money(cost)}.`);
  } else if (kind === 'commerce') {
    asset.commerce += 1;
    notify(player, `Commerces développés à ${station.name} pour ${money(cost)}.`);
  } else if (kind === 'maintenance') {
    asset.maintenance += 1;
    notify(player, `Atelier renforcé à ${station.name} pour ${money(cost)}.`);
  } else if (kind === 'depot') {
    asset.depot = true;
    notify(player, `Dépôt créé à ${station.name} pour ${money(cost)}.`);
  }
  return ok('Gare améliorée.');
}


function stationAcquisitionCost(station) {
  const annualPassengers = Number(station?.annualPassengers || station?.passengers2024 || 0);
  if (station?.majorTerminal && Number.isFinite(annualPassengers) && annualPassengers > 0) return stationPriceFromAnnualPassengers(annualPassengers) * 50;
  const storedPurchaseCost = Number(station?.purchaseCost || station?.acquisitionCost || 0);
  if (Number.isFinite(storedPurchaseCost) && storedPurchaseCost > 0) return Math.round(storedPurchaseCost);
  if (Number.isFinite(annualPassengers) && annualPassengers > 0) return stationPriceFromAnnualPassengers(annualPassengers);
  if (station?.custom) {
    const stored = Number(station.creationCost || station.purchaseCost || 0);
    if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
    return Math.round(65000 * state.market.steel);
  }
  const population = Number(station?.population || 0);
  if (population > 0) {
    // Prix volontairement très progressif : petites villes accessibles,
    // métropoles et capitale réservées à une phase avancée.
    return Math.round((120000 + population * 3.2 + Math.pow(population, 1.12) * 0.9) * state.market.steel);
  }
  const demand = Number(station?.baseDemand || 80);
  return Math.round((75000 + Math.pow(demand, 1.18) * 1050) * state.market.steel);
}

function stationUpgradeCost(station, asset, kind) {
  if (kind === 'level') return Math.round((85000 + station.baseDemand * 55) * asset.level * state.market.steel);
  if (kind === 'commerce') return Math.round(50000 * (asset.commerce + 1) * asset.level);
  if (kind === 'maintenance') return Math.round(90000 * (asset.maintenance + 1) * asset.level);
  if (kind === 'depot') return 180000;
  return 0;
}

function stationSaleRefundBreakdown(station, asset) {
  const normalized = {
    level: clamp(Math.floor(Number(asset?.level || 1)), 1, 5),
    commerce: clamp(Math.floor(Number(asset?.commerce || 0)), 0, 4),
    maintenance: clamp(Math.floor(Number(asset?.maintenance || 0)), 0, 4),
    depot: Boolean(asset?.depot)
  };
  const acquisition = stationAcquisitionCost(station);
  let levels = 0;
  for (let level = 1; level < normalized.level; level++) {
    levels += stationUpgradeCost(station, { ...normalized, level }, 'level');
  }
  let commerces = 0;
  for (let commerce = 0; commerce < normalized.commerce; commerce++) {
    commerces += stationUpgradeCost(station, { ...normalized, commerce }, 'commerce');
  }
  let maintenance = 0;
  for (let step = 0; step < normalized.maintenance; step++) {
    maintenance += stationUpgradeCost(station, { ...normalized, maintenance: step }, 'maintenance');
  }
  const depot = normalized.depot ? stationUpgradeCost(station, normalized, 'depot') : 0;
  const total = Math.round(acquisition + levels + commerces + maintenance + depot);
  return { acquisition, levels, commerces, maintenance, depot, total };
}

function stationSaleBlockingLine(stationId) {
  for (const player of activePlayers()) {
    for (const line of player.lines || []) {
      if (!line?.active) continue;
      if (lineStops(line).includes(stationId)) {
        return { player, line };
      }
    }
  }
  return null;
}

function actionSellStation(player, payload) {
  const stationId = String(payload.stationId || '');
  const station = stationById(stationId);
  if (!station) return fail('Gare introuvable.');
  if (!player.stations?.[stationId]) return fail('Cette gare ne t’appartient pas.');

  const blocking = stationSaleBlockingLine(stationId);
  if (blocking) {
    const lineName = lineRouteName(lineStops(blocking.line));
    const ownerName = blocking.player.id === player.id ? 'ta compagnie' : blocking.player.name;
    return fail(
      'Vente impossible : gare encore utilisée.',
      `${station.name} est desservie par ${lineName} (${ownerName}). Ferme ou modifie d’abord les lignes actives qui utilisent cette gare.`
    );
  }

  const asset = normalizeStationAsset(player, stationId);
  const refund = stationSaleRefundBreakdown(station, asset);
  player.cash += refund.total;
  delete player.stations[stationId];

  const custom = state.customStations?.[stationId];
  if (custom?.ownerId === player.id) delete state.customStations[stationId];

  notify(
    player,
    `${station.name} vendue : remboursement ${money(refund.total)} ` +
    `(gare ${money(refund.acquisition)}, niveaux ${money(refund.levels)}, commerces ${money(refund.commerces)}, ateliers ${money(refund.maintenance)}, dépôt ${money(refund.depot)}).`
  );
  return ok(`${station.name} vendue pour ${money(refund.total)}.`);
}



function customStationCreationCost(lat, lon) {
  const demand = estimateDemandFromLocation(lat, lon);
  const freight = estimateFreightFromLocation(lat, lon);
  const tourism = estimateTourismFromLocation(lat, lon);
  const market = Number(state?.market?.steel || 1);
  const nearby = (publicWorld().stations || [])
    .filter(s => !s.custom && Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lon)))
    .map(s => ({ station: s, distance: haversine(lat, lon, Number(s.lat), Number(s.lon)) }))
    .filter(entry => Number.isFinite(entry.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);

  const localValue = 52000 + demand * 720 + freight * 420 + tourism * 260;
  let weightedNeighbourValue = localValue;
  let closestDistance = nearby[0]?.distance ?? 80;
  let closestName = nearby[0]?.station?.name || '';

  if (nearby.length) {
    let totalWeight = 0;
    let totalValue = 0;
    for (const entry of nearby) {
      const d = Math.max(0.5, entry.distance);
      const weight = 1 / Math.pow(d + 8, 1.35);
      const stationPrice = stationAcquisitionCost(entry.station);
      totalWeight += weight;
      totalValue += stationPrice * weight;
    }
    if (totalWeight > 0) weightedNeighbourValue = totalValue / totalWeight;
  }

  // Mélange volontaire : le coût suit les gares proches, mais reste borné par le potentiel local
  // pour éviter une gare rurale hors de prix juste parce qu'une métropole est assez proche.
  const proximityFactor = closestDistance < 4 ? 1.22 : closestDistance < 12 ? 1.10 : closestDistance > 55 ? 0.82 : 1;
  const blended = (localValue * 0.58 + weightedNeighbourValue * 0.42) * proximityFactor * market;
  const cost = Math.round(clamp(blended, 90000, 6500000));
  return {
    cost,
    demand,
    freight,
    tourism,
    closestDistance: round2(closestDistance),
    closestName
  };
}

function actionCreateCustomStation(player, payload) {
  return fail('Création de gare désactivée.', 'Les points jouables sont maintenant limités aux gares réelles du Réseau Ferré National.');
}

function estimateDemandFromLocation(lat, lon) {
  // Paris / grandes métropoles approchées par la proximité de gares existantes.
  let best = 90;
  for (const s of WORLD.stations) {
    const d = haversine(lat, lon, s.lat, s.lon);
    const influence = s.baseDemand * Math.exp(-d / 55);
    best = Math.max(best, influence);
  }
  return Math.round(clamp(best, 60, 500));
}

function estimateFreightFromLocation(lat, lon) {
  let best = 25;
  for (const s of WORLD.stations) {
    const d = haversine(lat, lon, s.lat, s.lon);
    best = Math.max(best, s.freight * Math.exp(-d / 70));
  }
  return Math.round(clamp(best, 10, 150));
}

function estimateTourismFromLocation(lat, lon) {
  let best = 30;
  for (const s of WORLD.stations) {
    const d = haversine(lat, lon, s.lat, s.lon);
    best = Math.max(best, s.tourism * Math.exp(-d / 85));
  }
  return Math.round(clamp(best, 20, 120));
}

function actionHireStaff(player, payload) {
  const role = String(payload.role || '');
  const count = clamp(Math.floor(Number(payload.count || 1)), 1, 5000);
  const def = BALANCE.staff[role];
  if (!def) return fail('Métier inconnu.');
  const cost = Math.round(def.hireCost * count);
  if (!canPay(player, cost)) return fail(`Trésorerie insuffisante. Coût: ${money(cost)}.`);
  player.cash -= cost;
  player.staff[role] = (player.staff[role] || 0) + count;
  notify(player, `${count} ${def.label}${count > 1 ? 's' : ''} recruté${count > 1 ? 's' : ''}.`);
  return ok();
}

function actionFireStaff(player, payload) {
  const role = String(payload.role || '');
  const count = clamp(Math.floor(Number(payload.count || 1)), 1, 5000);
  const def = BALANCE.staff[role];
  if (!def) return fail('Métier inconnu.');
  const current = player.staff[role] || 0;
  if (current < count) return fail('Effectif insuffisant.');
  const severance = Math.round(def.salary * count * 0.7);
  if (!canPay(player, severance)) return fail(`Indemnités insuffisantes en trésorerie : ${money(severance)}.`);
  player.cash -= severance;
  player.staff[role] -= count;
  player.reputation = Math.max(0, player.reputation - count * 0.3);
  notify(player, `${count} poste${count > 1 ? 's' : ''} supprimé${count > 1 ? 's' : ''}.`);
  return ok();
}

function actionRepairTrain(player, payload) {
  const trainId = String(payload.trainId || '');
  const modeId = String(payload.mode || 'standard');
  const train = player.trains.find(t => t.id === trainId);
  if (!train) return fail('Train introuvable.');
  normalizeTrain(train, player.id);
  if (train.maintenance?.active) return fail('Ce train est déjà en maintenance.', `Fin prévue dans ${formatCycles(train.maintenance.daysLeft)}.`);

  const model = BALANCE.trains[train.modelId];
  const mode = BALANCE.maintenanceActions[modeId];
  if (!mode) return fail('Type de maintenance inconnu.');
  if (mode.requiredTech && !hasTech(player, mode.requiredTech)) {
    const tech = techNodeById(mode.requiredTech);
    return fail('Recherche requise pour cette maintenance.', `Débloque d’abord : ${tech?.title || mode.requiredTech}.`);
  }
  if (mode.requiresDepot && !hasMaintenanceWorkshop(player)) {
    return fail('Atelier requis.', 'Construis un atelier de maintenance ou un dépôt dans au moins une gare exploitée.');
  }
  const targetCondition = Math.max(train.condition, Math.min(mode.target || 0.99, train.condition + mode.restore));
  if (targetCondition <= train.condition + 0.005) return fail('Cette intervention n’apporterait presque aucune amélioration.', `Choisis une intervention plus lourde ou attends que l’état descende sous ${Math.round((mode.target || 0.99) * 100)}%.`);

  const cost = maintenanceActionCost(player, train, model, mode);
  if (!canPay(player, cost)) return fail(`Trésorerie insuffisante. Coût: ${money(cost)}.`);
  const duration = maintenanceDuration(player, mode);
  player.cash -= cost;
  train.maintenance = {
    active: true,
    mode: modeId,
    label: mode.name,
    daysLeft: duration,
    duration,
    targetCondition,
    startedDay: state.day,
    cost
  };
  notify(player, `${model.name} envoyé en maintenance (${mode.name}) : ${formatCycles(duration)}, ${money(cost)}.`);
  return ok('Maintenance planifiée.');
}

function actionRepairAllTrains(player, payload) {
  const modeId = String(payload.mode || 'standard');
  const mode = BALANCE.maintenanceActions[modeId];
  if (!mode) return fail('Type de maintenance inconnu.');
  if (mode.requiredTech && !hasTech(player, mode.requiredTech)) {
    const tech = techNodeById(mode.requiredTech);
    return fail('Recherche requise pour cette maintenance.', `Débloque d’abord : ${tech?.title || mode.requiredTech}.`);
  }
  if (mode.requiresDepot && !hasMaintenanceWorkshop(player)) {
    return fail('Atelier requis.', 'Construis un atelier de maintenance ou un dépôt dans au moins une gare exploitée.');
  }

  const candidates = [];
  let totalCost = 0;
  for (const train of player.trains || []) {
    normalizeTrain(train, player.id);
    if (train.maintenance?.active) continue;
    const model = BALANCE.trains[train.modelId];
    if (!model) continue;
    const targetCondition = Math.max(train.condition, Math.min(mode.target || 0.99, train.condition + mode.restore));
    if (targetCondition <= train.condition + 0.005) continue;
    const cost = maintenanceActionCost(player, train, model, mode);
    candidates.push({ train, model, targetCondition, cost });
    totalCost += cost;
  }

  if (!candidates.length) return fail('Aucun train éligible.', 'Tous les trains sont déjà en maintenance ou dans un état trop élevé pour cette intervention.');
  totalCost = Math.round(totalCost);
  if (!canPay(player, totalCost)) return fail(`Trésorerie insuffisante. Coût total : ${money(totalCost)}.`);

  const duration = maintenanceDuration(player, mode);
  player.cash -= totalCost;
  for (const item of candidates) {
    item.train.maintenance = {
      active: true,
      mode: modeId,
      label: mode.name,
      daysLeft: duration,
      duration,
      targetCondition: item.targetCondition,
      startedDay: state.day,
      cost: item.cost
    };
  }
  notify(player, `${candidates.length} train(s) envoyés en maintenance (${mode.name}) : ${formatCycles(duration)}, ${money(totalCost)}.`);
  return ok(`${candidates.length} train(s) envoyés en maintenance.`);
}

function actionSetMaintenancePolicy(player, payload) {
  const policy = String(payload.policy || 'standard');
  if (!BALANCE.maintenancePolicies[policy]) return fail('Politique de maintenance inconnue.');
  player.maintenancePolicy = policy;
  notify(player, `Politique de maintenance définie : ${BALANCE.maintenancePolicies[policy].name}.`);
  return ok('Politique de maintenance modifiée.');
}

function actionResearch(player, payload) {
  const nodeId = String(payload.nodeId || '');
  const node = techNodeById(nodeId);
  if (!node) return fail('Recherche inconnue.');
  player.researchQueue = normalizeResearchQueue(player.researchQueue);
  const currentLevel = plannedTechLevel(player, nodeId);
  const targetLevel = currentLevel + 1;
  if (targetLevel > techNodeMaxLevel(node)) return fail('Niveau de recherche hors limite technique.');
  if (player.researchQueue.length >= 12) return fail('File R&D pleine.', 'Attends qu’un projet démarre avant d’ajouter d’autres recherches.');
  if (player.epoch < (node.requiredEpoch || 0)) {
    return fail('Époque insuffisante.', `Cette recherche demande l’époque : ${BALANCE.epochs[node.requiredEpoch]?.name || node.requiredEpoch + 1}.`);
  }
  const missing = missingResearchPrereqs(player, node, targetLevel, true);
  if (missing.length) {
    const labels = missing.map(researchPrereqLabelServer).join(', ');
    return fail('Prérequis manquant.', `Débloque d’abord : ${labels}.`);
  }
  const costMoney = researchCostMoney(node, targetLevel);
  if (!canPay(player, costMoney)) return fail(`Budget insuffisant. Requis : ${money(costMoney)}.`);
  const durationMs = researchDurationMs(node, targetLevel);
  player.cash -= costMoney;
  const queued = {
    nodeId,
    targetLevel,
    durationMs,
    costMoney,
    queuedAt: Date.now()
  };
  if (!player.researchProject) {
    startResearchProject(player, queued);
    notify(player, `Projet R&D lancé : ${node.title} niveau ${targetLevel}.`);
    return ok('Projet R&D lancé.');
  }
  player.researchQueue.push(queued);
  notify(player, `Projet R&D ajouté à la file : ${node.title} niveau ${targetLevel}.`);
  return ok('Projet R&D ajouté à la file.');
}


function actionCancelResearch(player, payload) {
  const source = String(payload.source || payload.scope || '').toLowerCase();
  player.researchProject = normalizeResearchProject(player.researchProject);
  player.researchQueue = normalizeResearchQueue(player.researchQueue);

  const cancelled = [];
  let cancelledActive = false;

  if (source === 'active' || source === 'project') {
    const project = player.researchProject;
    if (!project) return fail('Aucune recherche active à annuler.');
    if (payload.nodeId && project.nodeId !== String(payload.nodeId)) return fail('La recherche active ne correspond plus.', 'L’interface a probablement été rafraîchie entre-temps.');
    cancelled.push(refundResearchItem(player, project, 'active'));
    player.researchProject = null;
    cancelledActive = true;
  } else if (source === 'queue' || source === 'queued') {
    const index = Math.floor(Number(payload.index));
    if (!Number.isInteger(index) || index < 0 || index >= player.researchQueue.length) return fail('Recherche introuvable dans la file.', 'La file R&D a probablement changé entre-temps.');
    const [item] = player.researchQueue.splice(index, 1);
    cancelled.push(refundResearchItem(player, item, 'queue'));
  } else {
    return fail('Type d’annulation inconnu.', 'Précise une recherche active ou une recherche en file d’attente.');
  }

  const cascaded = pruneInvalidQueuedResearch(player);
  if (!player.researchProject) startNextQueuedResearch(player);

  const all = [...cancelled, ...cascaded];
  const totalRefund = all.reduce((sum, item) => sum + Number(item.refund || 0), 0);
  const names = all.map(item => item.title).filter(Boolean);
  const cascadeText = cascaded.length ? ` ${cascaded.length} recherche(s) dépendante(s) annulée(s) aussi.` : '';
  notify(player, `R&D annulée : ${names.join(', ')}. Remboursement total : ${money(totalRefund)}.${cascadeText}`);
  return ok(`Recherche annulée. Remboursement : ${money(totalRefund)}.${cascadeText}`);
}

function refundResearchItem(player, item, source = 'queue') {
  const node = techNodeById(item?.nodeId);
  const baseRefund = Math.max(0, Math.round(Number(item?.costMoney || 0)));
  const operatingRefund = source === 'active' ? Math.max(0, Math.round(Number(item?.operatingCostAccrued || 0))) : 0;
  const refund = baseRefund + operatingRefund;
  player.cash += refund;
  if (operatingRefund > 0) {
    player.stats ||= {};
    player.stats.expenses = Math.max(0, Math.round(Number(player.stats.expenses || 0) - operatingRefund));
    player.stats.profit = Math.round(Number(player.stats.profit || 0) + operatingRefund);
  }
  return {
    source,
    nodeId: item?.nodeId || '',
    targetLevel: item?.targetLevel || 1,
    title: node ? `${node.title} niv. ${item?.targetLevel || 1}` : item?.nodeId || 'Recherche',
    refund,
    baseRefund,
    operatingRefund
  };
}

function pruneInvalidQueuedResearch(player) {
  player.researchQueue = normalizeResearchQueue(player.researchQueue);
  const levels = new Map();
  for (const [id, level] of Object.entries(player.techUnlocked || {})) levels.set(id, Math.max(0, Math.floor(Number(level || 0))));
  if (player.researchProject?.nodeId) {
    levels.set(player.researchProject.nodeId, Math.max(levels.get(player.researchProject.nodeId) || 0, Math.floor(Number(player.researchProject.targetLevel || 0))));
  }

  const prereqMetByLevelMap = req => {
    if (!req) return true;
    if (req.anyOf) return req.anyOf.some(prereqMetByLevelMap);
    return (levels.get(req.id) || 0) >= req.level;
  };

  const kept = [];
  const cancelled = [];
  for (const item of player.researchQueue) {
    const node = techNodeById(item.nodeId);
    const currentLevel = levels.get(item.nodeId) || 0;
    const validLevel = Boolean(node) && item.targetLevel === currentLevel + 1 && item.targetLevel <= techNodeMaxLevel(node);
    const missing = node ? researchPrereqsForLevel(node, item.targetLevel).filter(req => !prereqMetByLevelMap(req)) : [{ id: 'missing', level: 1 }];
    if (validLevel && !missing.length) {
      kept.push(item);
      levels.set(item.nodeId, Math.max(currentLevel, item.targetLevel));
    } else {
      cancelled.push(refundResearchItem(player, item, 'cascade'));
    }
  }
  player.researchQueue = kept;
  return cancelled;
}

function processTrainMaintenance(player) {
  for (const train of player.trains) {
    normalizeTrain(train, player.id);
    if (!train.maintenance?.active) continue;
    train.maintenance.daysLeft -= 1;
    if (train.maintenance.daysLeft <= 0) {
      const model = BALANCE.trains[train.modelId];
      train.condition = clamp(train.maintenance.targetCondition || Math.max(train.condition, 0.9), 0.1, 1);
      train.maintenance = { active: false, mode: null, daysLeft: 0, duration: 0, targetCondition: 0, lastServiceDay: state.day };
      notify(player, `${model?.name || 'Train'} ressort d’atelier : État ${Math.round(train.condition * 100)}%.`);
    }
  }
}

function processResearchProject(player) {
  const project = normalizeResearchProject(player.researchProject);
  player.researchProject = project;
  if (!project) {
    startNextQueuedResearch(player);
    return;
  }
  const node = techNodeById(project.nodeId);
  if (!node) {
    player.researchProject = null;
    return;
  }
  const now = Date.now();
  const elapsedMs = Math.max(0, now - (project.updatedAt || now));
  project.remainingMs = Math.max(0, project.remainingMs - elapsedMs * researchWorkRate(player));
  project.updatedAt = now;
  if (project.remainingMs > 0) {
    player.researchProject = project;
    return;
  }
  const previousLevel = techLevel(player, node.id);
  const nextLevel = Math.max(previousLevel, project.targetLevel);
  player.techUnlocked[node.id] = nextLevel;
  player.tech[node.branch] = recomputeBranchLevel(player, node.branch);
  player.researchProject = null;
  notify(player, `Recherche terminée : ${node.title} niveau ${nextLevel}.`);
  checkEpochUnlock(player);
  startNextQueuedResearch(player);
}

function startResearchProject(player, item) {
  const node = techNodeById(item.nodeId);
  if (!node) return false;
  const now = Date.now();
  player.researchProject = {
    nodeId: node.id,
    targetLevel: item.targetLevel,
    remainingMs: item.durationMs,
    durationMs: item.durationMs,
    costMoney: item.costMoney,
    operatingCostAccrued: 0,
    startedAt: now,
    updatedAt: now
  };
  return true;
}

function startNextQueuedResearch(player) {
  player.researchQueue = normalizeResearchQueue(player.researchQueue);
  while (!player.researchProject && player.researchQueue.length) {
    const next = player.researchQueue.shift();
    const node = techNodeById(next.nodeId);
    if (!node) continue;
    const expectedLevel = techLevel(player, next.nodeId) + 1;
    const validLevel = next.targetLevel === expectedLevel && next.targetLevel <= techNodeMaxLevel(node);
    const missing = missingResearchPrereqs(player, node, next.targetLevel, false);
    if (!validLevel || missing.length) {
      player.cash += next.costMoney || 0;
      notify(player, `Projet R&D annulé et remboursé : ${node.title}.`);
      continue;
    }
    startResearchProject(player, next);
    notify(player, `Projet R&D démarré depuis la file : ${node.title} niveau ${next.targetLevel}.`);
  }
}

function researchWorkRate(player) {
  const reputationBonus = Math.min(0.32, Math.max(0, player.reputation - 50) * 0.004);
  const socialBonus = techLevel(player, 'crew_training') * 0.025;
  const labTechBonus = Math.min(0.22, techLevel(player, 'centralized_control') * 0.018);
  return round2(1 + reputationBonus + socialBonus + labTechBonus);
}

function boundedExponential(base, growth, exponent, cap = Number.MAX_SAFE_INTEGER) {
  const b = Math.max(0, Number(base || 0));
  const g = Math.max(1.01, Number(growth || 1));
  const e = Math.max(0, Number(exponent || 0));
  if (!Number.isFinite(b) || b <= 0) return 0;
  const logValue = Math.log(b) + Math.log(g) * e;
  if (!Number.isFinite(logValue) || logValue >= Math.log(cap)) return cap;
  return Math.min(cap, b * Math.exp(Math.log(g) * e));
}

function researchCostMoney(node, targetLevel) {
  const level = clamp(Math.floor(Number(targetLevel || 1)), 1, RESEARCH_TECHNICAL_MAX_LEVEL);
  const base = Number(node.baseCostMoney ?? node.costMoney ?? 50000);
  const growth = Number(node.costGrowth ?? 1.62);
  const epochFactor = 1 + Math.max(0, Number(node.requiredEpoch || 0)) * 0.22;
  return Math.round(boundedExponential(base * epochFactor, growth, level - 1));
}

function researchDurationMs(node, targetLevel) {
  const level = clamp(Math.floor(Number(targetLevel || 1)), 1, RESEARCH_TECHNICAL_MAX_LEVEL);
  const base = Number(node.baseDurationSeconds ?? node.baseDuration ?? node.duration ?? 30);
  const growth = Number(node.durationGrowth ?? 1.5);
  return Math.max(15000, Math.round(boundedExponential(base, growth, level - 1, 315360000) * 1000));
}

function techLevel(player, nodeId) {
  const value = player?.techUnlocked?.[nodeId];
  if (value === true) return 1;
  return clamp(Math.floor(Number(value || 0)), 0, RESEARCH_TECHNICAL_MAX_LEVEL);
}

function techNodeMaxLevel(node) {
  const raw = Number(node?.maxLevel);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : RESEARCH_TECHNICAL_MAX_LEVEL;
}

function hasTech(player, nodeId, level = 1) {
  return techLevel(player, nodeId) >= level;
}

function normalizeResearchPrereqItem(item) {
  if (!item) return null;
  if (typeof item === 'string') return { id: item, level: 1 };
  if (Array.isArray(item.anyOf)) {
    const anyOf = item.anyOf.map(normalizeResearchPrereqItem).filter(Boolean).filter(req => !req.anyOf);
    return anyOf.length ? { anyOf } : null;
  }
  return { id: item.id, level: Math.max(1, Math.floor(Number(item.level || 1))) };
}

function researchPrereqsForLevel(node, targetLevel) {
  const all = [...(node.prereq || [])];
  for (const entry of node.levelPrereq || []) {
    if (targetLevel >= Number(entry.level || 1)) all.push(...(entry.requires || []));
  }
  return all.map(normalizeResearchPrereqItem).filter(Boolean);
}

function researchPrereqSatisfied(player, req, includePlanned = false) {
  if (req.anyOf) return req.anyOf.some(option => researchPrereqSatisfied(player, option, includePlanned));
  const level = includePlanned ? plannedTechLevel(player, req.id) : techLevel(player, req.id);
  return level >= req.level;
}

function researchPrereqLabelServer(req) {
  if (req.anyOf) return req.anyOf.map(researchPrereqLabelServer).join(' ou ');
  return `${techNodeById(req.id)?.title || req.id} niv. ${req.level}`;
}

function missingResearchPrereqs(player, node, targetLevel, includePlanned = false) {
  return researchPrereqsForLevel(node, targetLevel).filter(req => !researchPrereqSatisfied(player, req, includePlanned));
}

function plannedTechLevel(player, nodeId) {
  let level = techLevel(player, nodeId);
  if (player.researchProject?.nodeId === nodeId) level = Math.max(level, player.researchProject.targetLevel || 0);
  for (const item of normalizeResearchQueue(player.researchQueue)) {
    if (item.nodeId === nodeId) level = Math.max(level, item.targetLevel || 0);
  }
  return level;
}

function recomputeBranchLevel(player, branch) {
  let total = 0;
  for (const group of Object.values(BALANCE.techTree || {})) {
    for (const node of group.nodes || []) {
      if (node.branch === branch) total += techLevel(player, node.id) * (node.levelValue || 1);
    }
  }
  return total;
}

function hasMaintenanceWorkshop(player) {
  return Object.values(player.stations || {}).some(a => a.depot || (a.maintenance || 0) > 0);
}

function maintenanceActionCost(player, train, model, mode) {
  const missing = Math.max(0.02, 1 - train.condition);
  const workshopDiscount = Math.min(0.18, totalMaintenance(player) * 0.025);
  const techDiscount = (hasTech(player, 'steam_workshops') ? 0.92 : 1) * (hasTech(player, 'electric_standardized_maintenance') ? 0.94 : 1);
  return Math.round((mode.baseCost + model.price * mode.priceFactor * missing) * (1 - workshopDiscount) * techDiscount);
}

function maintenanceDuration(player, mode) {
  const workshopBonus = Math.min(0.35, totalMaintenance(player) * 0.035 + (player.staff.mechanics || 0) * 0.012);
  const techBonus = Math.min(0.24, techLevel(player, 'steam_workshops') * 0.045) + Math.min(0.1, techLevel(player, 'electric_standardized_maintenance') * 0.02);
  return Math.max(1, Math.ceil(mode.days * (1 - workshopBonus - techBonus)));
}

function actionEnergyStrategy(player, payload) {
  const strategy = String(payload.strategy || 'spot');
  if (!['spot', 'stable', 'green', 'cheap'].includes(strategy)) return fail('Contrat énergie inconnu.');
  player.energyStrategy = strategy;
  notify(player, `Stratégie énergie définie : ${BALANCE.energyStrategies[strategy].name}.`);
  return ok();
}

function actionTakeLoan(player, payload) {
  const amount = clamp(Math.round(Number(payload.amount || 100000)), 50000, 5000000);
  player.cash += amount;
  player.debt += Math.round(amount * 1.08);
  notify(player, `Emprunt contracté : ${money(amount)}. Dette à rembourser : ${money(Math.round(amount * 1.08))}.`);
  return ok();
}

function actionRepayLoan(player, payload) {
  if (player.debt <= 0) return fail('Aucune dette à rembourser.');
  const requested = Math.round(Number(payload.amount || 0));
  if (!Number.isFinite(requested) || requested <= 0) return fail('Montant de remboursement invalide.');
  const paid = Math.min(requested, Math.round(player.debt));
  if (!canPay(player, paid)) return fail(`Trésorerie insuffisante. Montant demandé : ${money(paid)}.`);
  player.cash -= paid;
  player.debt -= paid;
  notify(player, `Dette remboursée : ${money(paid)}.`);
  return ok('Dette remboursée.');
}

function actionRename(player, payload) {
  player.name = cleanText(payload.name || player.name, 28);
  player.color = validateColor(payload.color) || player.color;
  notify(player, 'Identité de compagnie modifiée.');
  return ok();
}

function actionResetCompany(player, payload) {
  if (payload.confirm !== 'RESET') return fail('Confirmation requise.');
  delete state.players[player.id];
  return ok('Compagnie supprimée. Rechargez la page pour recommencer.');
}

function simulateTick() {
  state.day += 1;
  state.now = Date.now();
  state.eraYear = 1850 + Math.floor(state.day / 12);
  updateMarket();
  updateEvents();
  const lineMarkets = buildLineMarkets();
  const infrastructureUsage = buildInfrastructureUsage();
  const passageRightsLedger = new Map();
  for (const player of activePlayers()) {
    simulatePlayer(player, lineMarkets, passageRightsLedger, { infrastructureUsage });
  }
  applyPassageRightsLedger(passageRightsLedger);
}

function simulatePlayer(player, lineMarkets, passageRightsLedger = null, options = {}) {
  const dryRun = Boolean(options.dryRun);
  if (!dryRun) {
    processTrainMaintenance(player);
    processResearchProject(player);
  }
  let revenue = 0;
  let expenses = 0;
  let passengers = 0;
  let freight = 0;
  let co2 = 0;
  let punctualityWeighted = 0;
  let satisfactionWeighted = 0;
  let weight = 0;
  let marketScore = 0;

  const staffing = computeStaffing(player);
  const staffNeeds = computeStaffNeeds(player);
  const driverCoverage = driverCoverageForNeed(player, staffNeeds.drivers);
  const lineInfrastructureMultiplier = clamp(1.22 - staffing.engineers * 0.22, 0.78, 1.18);
  const infrastructureUsage = options.infrastructureUsage || buildInfrastructureUsage();
  const sillonUsage = options.sillonUsage || buildSillonUsage();
  const policy = BALANCE.maintenancePolicies[player.maintenancePolicy] || BALANCE.maintenancePolicies.standard;
  const maintenanceCapacity = 1 + (player.staff.mechanics || 0) * 0.08 + totalMaintenance(player) * 0.12 + techLevel(player, 'electric_standardized_maintenance') * 0.16 + techLevel(player, 'steam_workshops') * 0.1;
  const eventFactor = currentEventFactor();
  const activeLineStats = [];
  const resourceRuntime = createResourceRuntime(player);

  for (const line of player.lines) {
    if (!line.active) continue;
    normalizeLineTrainIds(line);
    const assignedTrains = lineAssignedTrains(player, line);
    if (!assignedTrains.length) continue;
    const availableTrains = assignedTrains.filter(t => !t.maintenance?.active && trainConditionValue(t) > 0);
    const bundle = combinedOperatingProfile(player, availableTrains);
    const stoppedBundle = bundle || combinedOperatingProfile(player, assignedTrains);
    if (!stoppedBundle) continue;
    const train = stoppedBundle.primaryTrain;
    const model = stoppedBundle.primaryModel;
    const operatingModel = stoppedBundle.profile;
    const stops = lineStops(line);
    const from = stationById(stops[0]);
    const to = stationById(stops[stops.length - 1]);
    const distance = lineDistance(line);
    if (!from || !to || !Number.isFinite(distance) || distance <= 0) {
      line.stats = {
        passengers: 0,
        freightTons: 0,
        revenue: 0,
        expenses: 0,
        profit: 0,
        punctuality: 0,
        satisfaction: 0,
        share: 0,
        status: 'invalid-route',
        message: 'Itinéraire RFN ou gare réelle introuvable après mise à jour des données.'
      };
      continue;
    }
    const lineNeeds = computeLineStaffNeeds(player, line);
    const lineDriverCoverage = lineNeeds.drivers > 0 ? driverCoverage : 1;
    const allocatedDrivers = lineNeeds.drivers > 0 ? lineNeeds.drivers * lineDriverCoverage : 0;
    const sillonInfo = computeLineSillonLimit(player, line, sillonUsage);
    const effectiveLine = lineWithEffectiveFrequency(line, lineDriverCoverage, sillonInfo);
    const effectiveFrequency = Number(effectiveLine.effectiveSlots ?? effectiveLine.frequency ?? 0);
    const serviceFactor = lineUtilizationFactor(effectiveLine);
    const requestedSillons = Number(sillonInfo?.requestedFrequency ?? lineSlotDemand(player, line));
    const lineStaffingStats = {
      needs: lineNeeds,
      driverCoverage: round2(lineDriverCoverage * 100),
      allocatedDrivers: round2(allocatedDrivers),
      requiredDrivers: lineNeeds.drivers,
      effectiveFrequency: round2(effectiveFrequency),
      requestedFrequency: round2(requestedSillons),
      sillons: sillonStatsPayload(sillonInfo)
    };
    if (!bundle) {
      const stoppedForCondition = assignedTrains.every(t => trainConditionValue(t) <= 0);
      line.stats = {
        passengers: 0,
        freightTons: 0,
        revenue: 0,
        expenses: 0,
        profit: 0,
        punctuality: 0,
        satisfaction: stoppedForCondition ? 4 : 20,
        share: 0,
        status: stoppedForCondition ? 'train-out-of-service' : 'maintenance',
        staffing: lineStaffingStats,
        capacity: {
          passengers: 0,
          freightTons: 0,
          passengerLoad: null,
          freightLoad: null,
          crewFactor: 0,
          stationFactor: round2(lineStationFactor(player, line) * 100),
          capacityFactor: 0,
          driverCoverage: round2(lineDriverCoverage * 100),
          effectiveFrequency: 0,
          requestedFrequency: round2(requestedSillons),
          trainComposition: operatingModel.compositionSummary,
          sillons: sillonStatsPayload(sillonInfo)
        },
        finance: {
          ticketPrice: Math.round(lineTicketPrice(line, distance)),
          farePerKm: round2(lineTicketPrice(line, distance) / Math.max(1, distance)),
          ticketRevenue: 0,
          ancillaryRevenue: 0,
          freightRevenue: 0,
          dispatchRevenueBoost: 0,
          lineInfrastructureCost: 0,
          commercialOperatingCost: 0,
          commercialSalesCost: 0,
          commercialControlCost: 0,
          commercialAdministrationCost: 0,
          energyCost: 0,
          maintenanceCost: 0,
          accessCost: 0,
          passageRights: 0,
          infrastructurePassageCost: 0,
          stationAccessCost: 0,
          variableExpenses: 0,
          contribution: 0,
          allocatedOverhead: 0,
          netProfit: 0,
          margin: 0
        }
      };
      continue;
    }
    if (lineDriverCoverage <= 0) {
      line.stats = {
        passengers: 0,
        freightTons: 0,
        revenue: 0,
        expenses: 0,
        profit: 0,
        punctuality: 0,
        satisfaction: 8,
        share: 0,
        status: 'driver-shortage',
        staffing: lineStaffingStats,
        capacity: {
          passengers: 0,
          freightTons: 0,
          passengerLoad: null,
          freightLoad: null,
          crewFactor: 0,
          stationFactor: round2(lineStationFactor(player, line) * 100),
          capacityFactor: 0,
          driverCoverage: 0,
          effectiveFrequency: 0,
          requestedFrequency: round2(requestedSillons),
          trainComposition: operatingModel.compositionSummary,
          sillons: sillonStatsPayload(sillonInfo)
        }
      };
      continue;
    }
    const resourceCheck = reserveLineResource(player, resourceRuntime, operatingModel, effectiveLine, distance, dryRun);
    if (!resourceCheck.ok) {
      const label = resourceCheck.type === 'electricity' ? 'électricité commandée insuffisante' : `${resourceCheck.type === 'coal' ? 'charbon' : 'diesel'} insuffisant`;
      line.stats = {
        passengers: 0,
        freightTons: 0,
        revenue: 0,
        expenses: 0,
        profit: 0,
        punctuality: 0,
        satisfaction: 18,
        share: 0,
        status: 'resource-shortage',
        staffing: lineStaffingStats,
        capacity: {
          passengers: 0,
          freightTons: 0,
          passengerLoad: null,
          freightLoad: null,
          crewFactor: 0,
          stationFactor: round2(lineStationFactor(player, line) * 100),
          capacityFactor: 0,
          driverCoverage: round2(lineDriverCoverage * 100),
          effectiveFrequency: round2(effectiveFrequency),
          requestedFrequency: round2(requestedSillons),
          trainComposition: operatingModel.compositionSummary,
          sillons: sillonStatsPayload(sillonInfo)
        },
        resource: {
          type: resourceCheck.type,
          requiredPerHour: round2(resourceCheck.amountPerHour || 0),
          requiredPerTick: round2(resourceCheck.amountPerTick || 0),
          label
        }
      };
      continue;
    }
    const routeDemand = computeRouteDemand(from, to, line, player, eventFactor);
    const passengerDetails = lineCanServeMarket(operatingModel, 'passengers') && lineMarketServices(line).includes('passengers')
      ? computeLineAttractivenessDetails(player, effectiveLine, operatingModel, train, distance, staffing, 'passengers')
      : null;
    const freightDetails = lineCanServeMarket(operatingModel, 'freight') && lineMarketServices(line).includes('freight')
      ? computeLineAttractivenessDetails(player, effectiveLine, operatingModel, train, distance, staffing, 'freight')
      : null;
    const passengerMarket = passengerDetails
      ? marketSnapshot(lineMarkets[routeKey(stops[0], stops[stops.length - 1], 'passengers')] || [], line.id, passengerDetails.score)
      : null;
    const freightMarket = freightDetails
      ? marketSnapshot(lineMarkets[routeKey(stops[0], stops[stops.length - 1], 'freight')] || [], line.id, freightDetails.score)
      : null;
    const scoredShares = [passengerMarket?.share, freightMarket?.share].filter(Number.isFinite);
    if (scoredShares.length) marketScore += scoredShares.reduce((sum, share) => sum + share, 0) / scoredShares.length;

    const controllerCoverage = lineNeeds.controllers > 0 ? clamp(Number(player.staff.controllers || 0) / Math.max(1, staffNeeds.controllers || lineNeeds.controllers), 0, 1) : 1;
    const stationAgentCoverage = lineNeeds.stationAgents > 0 ? clamp(Number(player.staff.stationAgents || 0) / Math.max(1, staffNeeds.stationAgents || lineNeeds.stationAgents), 0, 1) : 1;
    const dispatcherCoverage = lineNeeds.dispatchers > 0 ? clamp(Number(player.staff.dispatchers || 0) / Math.max(1, staffNeeds.dispatchers || lineNeeds.dispatchers), 0, 1) : 1;
    const crewFactor = clamp(0.72 + dispatcherCoverage * 0.28, 0.72, 1);
    const stationFactor = lineStationFactor(player, line);
    const capacityFactor = Math.min(1, crewFactor * stationFactor);
    const fareComplianceFactor = 1 + controllerCoverage * 0.15;
    const stationAgentFlowFactor = clamp(0.86 + stationAgentCoverage * 0.14, 0.86, 1);
    const dispatchRevenueFactor = clamp(0.94 + dispatcherCoverage * 0.06, 0.94, 1.03);
    const maxPax = operatingModel.capacity * serviceFactor * capacityFactor;
    const maxFreight = operatingModel.freight * serviceFactor * capacityFactor;
    let linePax = 0;
    let lineFreight = 0;

    const passengerCapture = passengerDetails ? demandCaptureFromAttractiveness(passengerDetails, 'passengers') : 0;
    const freightCapture = freightDetails ? demandCaptureFromAttractiveness(freightDetails, 'freight') : 0;

    if (line.service === 'passengers' || line.service === 'mixed') {
      const share = passengerMarket?.share || 0;
      linePax = Math.max(0, Math.min(maxPax, routeDemand.passengers * share * passengerCapture * stationAgentFlowFactor));
    }
    if (line.service === 'freight' || line.service === 'mixed') {
      const share = freightMarket?.share || 0;
      lineFreight = Math.max(0, Math.min(maxFreight, routeDemand.freight * share * freightCapture));
    }

    const effectiveTicketPrice = lineTicketPrice(line, distance);
    const effectiveTariff = effectiveTicketPrice / Math.max(1, distance);
    const profitabilityMultiplier = operatingModel.profitabilityMultiplier || 1;
    const baseTicketRevenue = linePax * distance * effectiveTariff * profitabilityMultiplier * ECONOMY.passengerRevenueMultiplier;
    const ticketRevenue = baseTicketRevenue * fareComplianceFactor;
    const ancillaryRevenue = linePax * 0.35 * averageCommerce(player, line);
    const freightRevenue = lineFreight * distance * (0.045 + player.tech.freight * 0.003) * (operatingModel.freightRevenueMultiplier || 1) * (operatingModel.profitabilityMultiplier || 1) * ECONOMY.freightRevenueMultiplier;
    const serviceRevenue = ticketRevenue + ancillaryRevenue + freightRevenue;
    const lineRevenue = serviceRevenue * dispatchRevenueFactor;
    const energyCost = computeEnergyCost(player, operatingModel, distance, serviceFactor, line.electrified);
    const maintenanceCost = operatingModel.maintenance * distance * serviceFactor * (1 + (1 - train.condition) * 1.5) * (1 - Math.min(0.22, player.tech.operations * 0.025)) * policy.costMultiplier * (1 - Math.min(0.16, techLevel(player, 'steam_workshops') * 0.025)) * ECONOMY.maintenanceCostMultiplier;
    const passageRights = computePassageRights(player, effectiveLine, operatingModel, distance, infrastructureUsage);
    const accessCost = passageRights.total;
    if (!dryRun) recordPassageRights(passageRightsLedger, player, line, passageRights);
    const lineInfrastructureCost = computeLineInfrastructureCost(player, line, lineInfrastructureMultiplier, infrastructureUsage);
    const commercialBaseRevenue = baseTicketRevenue + ancillaryRevenue + freightRevenue;
    const grossCommercialOperatingCost = Math.max(0, commercialBaseRevenue - ECONOMY.lineCommercialCostThreshold) * ECONOMY.lineCommercialCostRate;
    const commercialSalesCost = grossCommercialOperatingCost * 0.42 * (1 - controllerCoverage * 0.08);
    const commercialControlCost = grossCommercialOperatingCost * 0.28 * (1 - controllerCoverage * 0.22);
    const commercialAdministrationCost = grossCommercialOperatingCost * 0.30;
    const commercialOperatingCost = commercialSalesCost + commercialControlCost + commercialAdministrationCost;
    const variableExpenses = energyCost + maintenanceCost + accessCost + lineInfrastructureCost + commercialOperatingCost;
    const contribution = lineRevenue - variableExpenses;
    revenue += lineRevenue;
    expenses += variableExpenses;

    let reliabilityCondition = 0;
    for (const entry of bundle.entries) {
      const wear = computeTrainWearPerTick(player, entry.train, entry.model, effectiveLine, entry.profile, staffing, policy);
      const projectedCondition = clamp(entry.train.condition - wear, 0, 1);
      reliabilityCondition += dryRun ? trainConditionValue(entry.train) : projectedCondition;
      if (!dryRun) {
        entry.train.condition = projectedCondition;
        entry.train.age += 1;
      }
    }
    reliabilityCondition = reliabilityCondition / Math.max(1, bundle.entries.length);
    const reliability = clamp(operatingModel.reliability * reliabilityCondition * (0.86 + Math.min(0.18, maintenanceCapacity / 30)) * crewFactor + policy.reliabilityBonus + techLevel(player, 'safety_training') * 0.006, 0.18, 0.995);
    const delayRisk = 1 - reliability;
    const dispatcherPunctualityBonus = (dispatchRevenueFactor - 1) * 22;
    const stationSatisfactionBonus = (stationAgentFlowFactor - 1) * 20;
    const punctuality = clamp(100 - delayRisk * 100 - Math.max(0, effectiveFrequency - 10) * 1.4 - Math.max(0, 1 - lineDriverCoverage) * 18 + dispatcherPunctualityBonus, 35, 99);
    const satisfaction = clamp(
      30 + operatingModel.comfort * 45 + player.reputation * 0.23 + Math.min(12, effectiveFrequency) - effectiveTariff * 65 + averageStationLevel(player, line) * 4 + Math.max(0, stops.length - 2) * 1.5 - Math.max(0, 1 - lineDriverCoverage) * 12 + stationSatisfactionBonus,
      10,
      100
    );

    line.stats = {
      passengers: Math.round(linePax),
      freightTons: Math.round(lineFreight),
      revenue: Math.round(lineRevenue),
      expenses: Math.round(variableExpenses),
      profit: Math.round(contribution),
      punctuality: round2(punctuality),
      satisfaction: round2(satisfaction),
      share: round2((scoredShares.reduce((sum, share) => sum + share, 0) / Math.max(1, scoredShares.length)) * 100),
      status: lineDriverCoverage < 0.999 ? 'driver-shortage' : (sillonInfo.constrained ? 'sillon-limited' : 'ok'),
      staffing: lineStaffingStats,
      market: {
        passengerDemand: Math.round(routeDemand.passengers),
        freightDemand: Math.round(routeDemand.freight),
        passengerShare: passengerMarket ? round2(passengerMarket.share * 100) : null,
        freightShare: freightMarket ? round2(freightMarket.share * 100) : null,
        passengerRank: passengerMarket?.rank || null,
        freightRank: freightMarket?.rank || null,
        passengerCompetitors: passengerMarket?.competitorCount || 0,
        freightCompetitors: freightMarket?.competitorCount || 0,
        passengerLeader: passengerMarket?.leader || null,
        freightLeader: freightMarket?.leader || null,
        passengerScore: passengerDetails ? round2(passengerDetails.score) : null,
        freightScore: freightDetails ? round2(freightDetails.score) : null,
        passengerDemandCapture: passengerDetails ? round2(passengerCapture * 100) : null,
        freightDemandCapture: freightDetails ? round2(freightCapture * 100) : null
      },
      attractiveness: {
        passenger: passengerDetails,
        freight: freightDetails
      },
      capacity: {
        passengers: Math.round(maxPax),
        freightTons: Math.round(maxFreight),
        passengerLoad: maxPax > 0 ? round2(linePax / maxPax * 100) : null,
        freightLoad: maxFreight > 0 ? round2(lineFreight / maxFreight * 100) : null,
        crewFactor: round2(crewFactor * 100),
        stationFactor: round2(stationFactor * 100),
        capacityFactor: round2(capacityFactor * 100),
        driverCoverage: round2(lineDriverCoverage * 100),
        effectiveFrequency: round2(effectiveFrequency),
        requestedFrequency: round2(requestedSillons),
        trainComposition: operatingModel.compositionSummary,
        sillons: sillonStatsPayload(sillonInfo)
      },
      finance: {
        ticketPrice: Math.round(effectiveTicketPrice),
        farePerKm: round2(effectiveTariff),
        ticketRevenue: Math.round(ticketRevenue),
        ancillaryRevenue: Math.round(ancillaryRevenue),
        freightRevenue: Math.round(freightRevenue),
        dispatchRevenueBoost: Math.round(Math.max(0, lineRevenue - serviceRevenue)),
        lineInfrastructureCost: Math.round(lineInfrastructureCost),
        commercialOperatingCost: Math.round(commercialOperatingCost),
        commercialSalesCost: Math.round(commercialSalesCost),
        commercialControlCost: Math.round(commercialControlCost),
        commercialAdministrationCost: Math.round(commercialAdministrationCost),
        energyCost: Math.round(energyCost),
        resourceType: resourceCheck.type,
        resourceConsumptionPerHour: round2(resourceCheck.amountPerHour || 0),
        maintenanceCost: Math.round(maintenanceCost),
        accessCost: Math.round(accessCost),
        passageRights: Math.round(accessCost),
        infrastructurePassageCost: Math.round(passageRights.infrastructureTotal || 0),
        stationAccessCost: Math.round(passageRights.stationTotal || 0),
        variableExpenses: Math.round(variableExpenses),
        contribution: Math.round(contribution),
        allocatedOverhead: 0,
        netProfit: Math.round(contribution),
        margin: lineRevenue > 0 ? round2(contribution / lineRevenue * 100) : 0
      }
    };
    activeLineStats.push({ line, stats: line.stats, weight: Math.max(1, lineRevenue, distance * Math.max(1, effectiveFrequency)) });

    passengers += linePax;
    freight += lineFreight;
    co2 += computeCo2(operatingModel, distance, serviceFactor);
    punctualityWeighted += punctuality * Math.max(1, linePax + lineFreight * 0.5);
    satisfactionWeighted += satisfaction * Math.max(1, linePax + lineFreight * 0.5);
    weight += Math.max(1, linePax + lineFreight * 0.5);
  }

  const staffCost = Object.entries(player.staff).reduce((sum, [role, count]) => sum + (BALANCE.staff[role]?.salary || 0) * count / ECONOMY.staffCostDivisor, 0) * (1 - Math.min(0.1, techLevel(player, 'crew_training') * 0.018));
  const stationCost = Object.values(player.stations).reduce((sum, a) => sum + (a.level * ECONOMY.stationLevelCost + a.commerce * ECONOMY.stationCommerceCost + a.maintenance * ECONOMY.stationMaintenanceCost + (a.depot ? ECONOMY.stationDepotCost : 0)), 0);
  const debtCost = player.debt * ECONOMY.debtInterestPerTick;
  const idleTrainCost = player.trains.reduce((sum, train) => {
    const used = player.lines.some(line => line.active && lineTrainIds(line).includes(train.id));
    const model = BALANCE.trains[train.modelId];
    return sum + (!used && model ? model.price * ECONOMY.idleTrainStorageFactor : 0);
  }, 0);
  const stationRevenue = computeOwnedStationRevenue(player, passengers, freight);
  const researchCost = researchOperatingCost(player);
  if (!dryRun && player.researchProject && researchCost > 0) {
    const refundableLabCost = Math.max(0, Math.round(ECONOMY.researchLabBaseCost || 0));
    player.researchProject.operatingCostAccrued = Math.max(0, Math.round(Number(player.researchProject.operatingCostAccrued || 0) + refundableLabCost));
  }
  revenue += stationRevenue;
  const sharedCosts = staffCost + stationCost + debtCost + idleTrainCost + researchCost;
  const allocationWeight = activeLineStats.reduce((sum, item) => sum + item.weight, 0);
  for (const item of activeLineStats) {
    const overhead = allocationWeight > 0 ? sharedCosts * item.weight / allocationWeight : sharedCosts / Math.max(1, activeLineStats.length);
    const finance = item.stats.finance || {};
    const variableExpenses = Number(finance.variableExpenses || item.stats.expenses || 0);
    const contribution = Number(finance.contribution || item.stats.profit || 0);
    finance.allocatedOverhead = Math.round(overhead);
    finance.netProfit = Math.round(contribution - overhead);
    finance.totalExpenses = Math.round(variableExpenses + overhead);
    finance.netMargin = item.stats.revenue > 0 ? round2((contribution - overhead) / item.stats.revenue * 100) : 0;
    item.stats.finance = finance;
    item.stats.expenses = finance.totalExpenses;
    item.stats.profit = finance.netProfit;
  }
  expenses += sharedCosts;

  const profit = revenue - expenses;
  if (dryRun) return { revenue, expenses, profit, passengers, freight, co2 };
  player.cash += profit;
  if (player.cash < -100000) {
    player.debt += Math.abs(player.cash) * 1.12;
    notify(player, `Découvert converti en dette : ${money(Math.abs(player.cash))}.`);
    player.cash = 0;
    player.reputation = Math.max(0, player.reputation - 1.5);
  }

  const punctuality = weight ? punctualityWeighted / weight : player.stats.punctuality;
  const satisfaction = weight ? satisfactionWeighted / weight : player.stats.satisfaction;
  player.reputation = clamp(player.reputation + (satisfaction - 55) * 0.006 + (punctuality - 88) * 0.004 + (profit > 0 ? 0.02 : -0.03), 0, 100);
  player.research = round2(researchWorkRate(player));
  player.co2 += co2;

  player.stats.passengers += Math.round(passengers);
  player.stats.freightTons += Math.round(freight);
  player.stats.revenue += Math.round(revenue);
  player.stats.expenses += Math.round(expenses);
  player.stats.profit += Math.round(profit);
  player.stats.lastRevenue = Math.round(revenue);
  player.stats.lastExpenses = Math.round(expenses);
  player.stats.lastProfit = Math.round(profit);
  const lineFinanceTotals = activeLineStats.reduce((acc, item) => {
    const finance = item.stats?.finance || {};
    acc.ticketRevenue += Number(finance.ticketRevenue || 0);
    acc.ancillaryRevenue += Number(finance.ancillaryRevenue || 0);
    acc.freightRevenue += Number(finance.freightRevenue || 0);
    acc.dispatchRevenueBoost += Number(finance.dispatchRevenueBoost || 0);
    acc.energyCost += Number(finance.energyCost || 0);
    acc.trainMaintenanceCost += Number(finance.maintenanceCost || 0);
    acc.lineInfrastructureCost += Number(finance.lineInfrastructureCost || 0);
    acc.commercialOperatingCost += Number(finance.commercialOperatingCost || 0);
    acc.commercialSalesCost += Number(finance.commercialSalesCost || 0);
    acc.commercialControlCost += Number(finance.commercialControlCost || 0);
    acc.commercialAdministrationCost += Number(finance.commercialAdministrationCost || 0);
    acc.accessCost += Number(finance.accessCost || 0);
    acc.infrastructurePassageCost += Number(finance.infrastructurePassageCost || 0);
    acc.stationAccessCost += Number(finance.stationAccessCost || 0);
    acc.variableExpenses += Number(finance.variableExpenses || 0);
    return acc;
  }, {
    ticketRevenue: 0,
    ancillaryRevenue: 0,
    freightRevenue: 0,
    dispatchRevenueBoost: 0,
    energyCost: 0,
    trainMaintenanceCost: 0,
    lineInfrastructureCost: 0,
    commercialOperatingCost: 0,
    commercialSalesCost: 0,
    commercialControlCost: 0,
    commercialAdministrationCost: 0,
    accessCost: 0,
    infrastructurePassageCost: 0,
    stationAccessCost: 0,
    variableExpenses: 0
  });
  player.stats.lastBreakdown = {
    lineRevenue: Math.round(revenue - stationRevenue),
    stationRevenue: Math.round(stationRevenue),
    ticketRevenue: Math.round(lineFinanceTotals.ticketRevenue),
    ancillaryRevenue: Math.round(lineFinanceTotals.ancillaryRevenue),
    freightRevenue: Math.round(lineFinanceTotals.freightRevenue),
    dispatchRevenueBoost: Math.round(lineFinanceTotals.dispatchRevenueBoost),
    energyCost: Math.round(lineFinanceTotals.energyCost),
    trainMaintenanceCost: Math.round(lineFinanceTotals.trainMaintenanceCost),
    lineInfrastructureCost: Math.round(lineFinanceTotals.lineInfrastructureCost),
    commercialOperatingCost: Math.round(lineFinanceTotals.commercialOperatingCost),
    commercialSalesCost: Math.round(lineFinanceTotals.commercialSalesCost),
    commercialControlCost: Math.round(lineFinanceTotals.commercialControlCost),
    commercialAdministrationCost: Math.round(lineFinanceTotals.commercialAdministrationCost),
    accessCost: Math.round(lineFinanceTotals.accessCost),
    infrastructurePassageCost: Math.round(lineFinanceTotals.infrastructurePassageCost),
    stationAccessCost: Math.round(lineFinanceTotals.stationAccessCost),
    passageRightsRevenue: 0,
    staffCost: Math.round(staffCost),
    stationCost: Math.round(stationCost),
    debtCost: Math.round(debtCost),
    idleTrainCost: Math.round(idleTrainCost),
    researchCost: Math.round(researchCost),
    variableLineCost: Math.round(Math.max(0, expenses - sharedCosts)),
    sharedCosts: Math.round(sharedCosts)
  };
  player.stats.punctuality = round2(punctuality);
  player.stats.satisfaction = round2(satisfaction);
  player.stats.marketShare = round2(marketScore);

  checkEpochUnlock(player);

  if (state.day % 30 === 0) {
    const worst = player.trains.filter(t => t.condition < 0.38).slice(0, 1)[0];
    if (worst) {
      const model = BALANCE.trains[worst.modelId];
      notify(player, `Maintenance urgente recommandée : ${model.name} à ${Math.round(worst.condition * 100)}% d’état.`);
    }
  }
}

function buildLineMarkets() {
  const markets = {};
  for (const player of activePlayers()) {
    const staffing = computeStaffing(player);
    const needs = computeStaffNeeds(player);
    const driverCoverage = driverCoverageForNeed(player, needs.drivers);
    if (driverCoverage <= 0) continue;
    for (const line of player.lines) {
      if (!line.active) continue;
      normalizeLineTrainIds(line);
      const bundle = combinedOperatingProfile(player, lineAssignedTrains(player, line, { availableOnly: true }));
      if (!bundle) continue;
      const train = bundle.primaryTrain;
      const operatingModel = bundle.profile;
      const stops = lineStops(line);
      const distance = lineDistance(line);
      const effectiveLine = lineWithEffectiveFrequency(line, driverCoverage);
      for (const market of lineMarketServices(line)) {
        if (!lineCanServeMarket(operatingModel, market)) continue;
        const key = routeKey(stops[0], stops[stops.length - 1], market);
        if (!markets[key]) markets[key] = [];
        const details = computeLineAttractivenessDetails(player, effectiveLine, operatingModel, train, distance, staffing, market);
        markets[key].push({
          playerId: player.id,
          companyName: player.name,
          lineId: line.id,
          lineCode: lineRouteName(lineStops(line)),
          market,
          score: details.score
        });
      }
    }
  }
  return markets;
}

function lineMarketServices(line) {
  if (line.service === 'mixed') return ['passengers', 'freight'];
  if (line.service === 'freight') return ['freight'];
  return ['passengers'];
}

function lineCanServeMarket(model, market) {
  if (!model) return false;
  if (market === 'freight') return (model.freight || 0) > 0;
  return (model.capacity || 0) > 0;
}

function marketSnapshot(competitors, lineId, score) {
  const entries = Array.isArray(competitors) ? competitors : [];
  const totalScore = entries.reduce((sum, c) => sum + Math.max(0, Number(c.score || 0)), 0) || Math.max(0.1, score);
  const sorted = [...entries].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const rank = Math.max(1, sorted.findIndex(c => c.lineId === lineId) + 1 || 1);
  const leaderEntry = sorted[0] || null;
  const share = entries.length > 1 ? clamp(score / totalScore, 0.03, 0.94) : 1;
  return {
    share,
    rank,
    competitorCount: Math.max(0, entries.length - 1),
    leader: leaderEntry ? { companyName: leaderEntry.companyName, lineCode: leaderEntry.lineCode, score: round2(leaderEntry.score) } : null,
    totalScore: round2(totalScore)
  };
}

function demandCaptureFromAttractiveness(details, market = 'passengers') {
  if (!details || !Number.isFinite(details.score)) return 0;
  const normalized = clamp(details.score / (market === 'freight' ? 3.2 : 4.2), 0, 1.35);
  // Courbe v54 : assez dure pour ne pas capter toute la demande,
  // mais une ligne correcte n'est plus condamnée par défaut.
  const base = market === 'freight' ? 0.20 : 0.18;
  const span = market === 'freight' ? 0.74 : 0.76;
  const curve = market === 'freight' ? 0.78 : 0.74;
  return clamp(base + Math.pow(normalized, curve) * span, market === 'freight' ? 0.12 : 0.12, market === 'freight' ? 0.96 : 0.95);
}

function computeLineAttractiveness(player, line, model, train, distance, staffing, market = 'passengers') {
  return computeLineAttractivenessDetails(player, line, model, train, distance, staffing, market).score;
}

function computeLineAttractivenessDetails(player, line, model, train, distance, staffing, market = 'passengers') {
  const time = distance / Math.max(25, model.speed);
  const frequencyBoost = Math.sqrt(line.frequency);
  const ticketPrice = lineTicketPrice(line, distance);
  const fareCap = ticketPriceCeiling(distance);
  // À plafond atteint : facteur prix = 0 %. Plus le billet s'approche du plafond
  // propre à la distance, plus l'attractivité liée au prix s'effondre.
  const priceRatio = fareCap > 0 ? clamp(ticketPrice / fareCap, 0, 1) : 1;
  const priceBoost = market === 'passengers' ? 1.32 * Math.max(0, 1 - priceRatio) : 1;
  const comfortBoost = market === 'passengers'
    ? (0.62 + model.comfort) * (0.92 + Math.min(0.26, (model.capacity || 0) / 1600))
    : (0.58 + Math.min(1.15, (model.freight || 0) / 950)) * (1 + Math.min(0.24, (player.tech.freight || 0) * 0.028));
  const repBoost = 0.5 + player.reputation / 100;
  const conditionBoost = 0.35 + train.condition;
  const staffBoost = market === 'passengers'
    ? Math.min(staffing.drivers, staffing.dispatchers, 1.25)
    : Math.min(staffing.drivers, staffing.dispatchers, staffing.mechanics + 0.08, 1.25);
  const stationBoost = Math.min(1.24, lineStationFactor(player, line));
  const opsBoost = (1 + Math.min(0.1, techLevel(player, 'block_signaling') * 0.02)) * (1 + Math.min(0.12, techLevel(player, 'centralized_control') * 0.024));
  const freightBoost = market === 'freight'
    ? (1 + Math.min(0.13, techLevel(player, 'specialized_wagons') * 0.026)) * (1 + Math.min(0.16, techLevel(player, 'container_hubs') * 0.032))
    : 1;
  const score = Math.max(0.1, frequencyBoost * comfortBoost * repBoost * conditionBoost * priceBoost * staffBoost * stationBoost * opsBoost * freightBoost / Math.sqrt(Math.max(0.2, time)));
  return {
    market,
    score: round2(score),
    factors: {
      price: market === 'passengers' ? round2(priceBoost / 1.32 * 100) : null,
      frequency: round2(clamp(frequencyBoost / Math.sqrt(12), 0, 1.25) * 100),
      speed: round2(clamp((model.speed || 1) / 180, 0.25, 1.35) * 100),
      comfortOrCapacity: round2(clamp(comfortBoost / (market === 'passengers' ? 1.6 : 1.8), 0, 1.3) * 100),
      reputation: round2(clamp(repBoost / 1.5, 0, 1.2) * 100),
      condition: round2(clamp(conditionBoost / 1.35, 0, 1.1) * 100),
      staff: round2(clamp(staffBoost, 0, 1.25) * 100),
      stations: round2(clamp(stationBoost, 0, 1.24) * 100),
      operations: round2(clamp(opsBoost * freightBoost, 0, 1.35) * 100)
    }
  };
}


function computeRouteDemand(from, to, line, player, eventFactor) {
  const stops = lineStops(line);
  const distance = lineDistance(line);
  const mids = stops.slice(1, -1).map(id => stationById(id)).filter(Boolean);
  const fromDemand = effectiveStationPassengerDemand(from);
  const toDemand = effectiveStationPassengerDemand(to);
  const stopDemand = mids.reduce((sum, s) => sum + effectiveStationPassengerDemand(s) * 0.18 + s.tourism * 0.6 + s.freight * 0.2, 0);
  const demandBase = Math.sqrt(fromDemand * toDemand) * 0.9 + stopDemand;
  const tourismMid = mids.reduce((sum, s) => sum + s.tourism, 0);
  const tourism = 1 + (from.tourism + to.tourism + tourismMid * 0.5) / 160;
  const distanceFactor = clamp(1.25 - distance / 900, 0.25, 1.2);
  const eraFactor = 0.85 + player.epoch * 0.18;
  const reputation = 0.75 + player.reputation / 190;
  const stationTech = (1 + Math.min(0.13, techLevel(player, 'passenger_flow') * 0.026)) * (1 + Math.min(0.16, techLevel(player, 'intermodal_hubs') * 0.032));
  const stopBonus = 1 + Math.max(0, stops.length - 2) * 0.07;
  const passengerDemand = demandBase * tourism * distanceFactor * eraFactor * state.market.demand * eventFactor.passenger * reputation * stationTech * stopBonus * ECONOMY.passengerDemandMultiplier;
  const freightMid = mids.reduce((sum, s) => sum + s.freight, 0);
  const freightBase = Math.sqrt((from.freight + 18) * (to.freight + 18)) * 5.5 + freightMid * 1.8;
  const freightTech = (1 + Math.min(0.15, techLevel(player, 'specialized_wagons') * 0.03)) * (1 + Math.min(0.2, techLevel(player, 'container_hubs') * 0.04));
  const freightDemand = freightBase * clamp(distance / 180, 0.5, 2.2) * state.market.freight * eventFactor.freight * (0.75 + player.tech.freight * 0.08) * freightTech * Math.max(1, 1 + Math.max(0, stops.length - 2) * 0.05) * ECONOMY.freightDemandMultiplier;
  return { passengers: passengerDemand, freight: freightDemand };
}


function computeEnergyCost(player, model, distance, frequency, electrified) {
  const type = model.energyType;
  const resourceType = trainResourceType(model);
  if (resourceType === 'coal' || resourceType === 'diesel') return 0;
  if (resourceType === 'electricity') {
    const strategy = BALANCE.energyStrategies[player.energyStrategy] || BALANCE.energyStrategies.spot;
    const price = (state.market.electricity || 0.34) * (strategy.multiplier?.electricity || strategy.defaultMultiplier || 1);
    const hourlyDemand = resourceDemandPerHour(model, distance, frequency);
    return (hourlyDemand * price * 100) / ticksPerRealHour();
  }
  return 0;
}

function normalizeResources(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    coal: Math.max(0, Number(r.coal || 0)),
    diesel: Math.max(0, Number(r.diesel || 0)),
    electricityOrder: Math.max(0, Number(r.electricityOrder || 0))
  };
}

function ticksPerRealHour() {
  return 3600000 / Math.max(250, TICK_MS);
}

function trainResourceType(model) {
  if (!model) return null;
  if (model.energyType === 'coal') return 'coal';
  if (model.energyType === 'diesel') return 'diesel';
  if (model.energyType === 'electricity' || model.energyType === 'battery') return 'electricity';
  return null;
}

function resourceDemandPerHour(model, distance, frequency) {
  const type = trainResourceType(model);
  if (!type) return 0;
  const tuning = { coal: 1.0, diesel: 0.8, electricity: model.energyType === 'battery' ? 0.55 : 0.7 }[type] || 1;
  return Math.max(0, Number(model.energy || 0) * Math.max(0, Number(distance || 0)) * Math.max(0, Number(frequency || 0)) * tuning / 100);
}

function computePlayerResourceFlow(player) {
  player.resources = normalizeResources(player.resources);
  const consumption = { coal: 0, diesel: 0, electricity: 0 };
  const sources = { coal: [], diesel: [], electricity: [] };
  const driverCoverage = driverCoverageForNeed(player);
  for (const line of player.lines || []) {
    if (!line.active) continue;
    normalizeLineTrainIds(line);
    const bundle = combinedOperatingProfile(player, lineAssignedTrains(player, line, { availableOnly: true }));
    if (!bundle) continue;
    const operatingModel = bundle.profile;
    const type = trainResourceType(operatingModel);
    if (!type) continue;
    const effectiveLine = lineWithEffectiveFrequency(line, driverCoverage);
    const perHour = resourceDemandPerHour(operatingModel, lineDistance(line), effectiveLine.frequency);
    consumption[type] += perHour;
    sources[type].push({
      lineId: line.id,
      lineCode: lineRouteName(lineStops(line)),
      lineName: lineRouteName(lineStops(line)),
      trainName: bundle.entries.length > 1 ? `${bundle.entries.length} trains` : bundle.primaryModel.name,
      amountPerHour: round2(perHour)
    });
  }
  return {
    stocks: normalizeResources(player.resources),
    consumption: {
      coal: round2(consumption.coal),
      diesel: round2(consumption.diesel),
      electricity: round2(consumption.electricity)
    },
    production: {
      electricity: round2(player.resources.electricityOrder || 0)
    },
    balance: {
      coal: round2((player.resources.coal || 0) - consumption.coal),
      diesel: round2((player.resources.diesel || 0) - consumption.diesel),
      electricity: round2((player.resources.electricityOrder || 0) - consumption.electricity)
    },
    sources
  };
}

function createResourceRuntime(player) {
  player.resources = normalizeResources(player.resources);
  return {
    electricityRemainingPerHour: Math.max(0, Number(player.resources.electricityOrder || 0))
  };
}

function reserveLineResource(player, runtime, model, line, distance, dryRun = false) {
  const type = trainResourceType(model);
  if (!type) return { ok: true, type: null, amountPerHour: 0, amountPerTick: 0 };
  const perHour = resourceDemandPerHour(model, distance, lineUtilizationFactor(line));
  const perTick = perHour / ticksPerRealHour();

  if (type === 'electricity') {
    if ((runtime.electricityRemainingPerHour || 0) + 1e-9 < perHour) {
      return { ok: false, type, amountPerHour: perHour, amountPerTick: perTick, reason: 'electricity_order' };
    }
    runtime.electricityRemainingPerHour -= perHour;
    return { ok: true, type, amountPerHour: perHour, amountPerTick: perTick };
  }

  if ((player.resources[type] || 0) + 1e-9 < perTick) {
    return { ok: false, type, amountPerHour: perHour, amountPerTick: perTick, reason: 'stock' };
  }
  if (!dryRun) player.resources[type] = Math.max(0, (player.resources[type] || 0) - perTick);
  return { ok: true, type, amountPerHour: perHour, amountPerTick: perTick };
}

function actionBuyResource(player, payload) {
  const type = String(payload.type || '').toLowerCase();
  const qty = Math.max(0, Math.min(100000, Number(payload.quantity || 0)));
  if (!['coal', 'diesel'].includes(type)) return fail('Ressource inconnue.');
  if (type === 'diesel' && player.epoch < 1) return fail('Diesel verrouillé.', 'Atteins l’ère du diesel pour acheter du gazole.');
  if (qty <= 0) return fail('Quantité invalide.');
  player.resources = normalizeResources(player.resources);
  const price = Number(state.market[type] || 1) * 100;
  const cost = Math.round(qty * price);
  if (!canPay(player, cost)) return fail(`Trésorerie insuffisante. Coût : ${money(cost)}.`);
  player.cash -= cost;
  player.resources[type] += qty;
  notify(player, `${type === 'coal' ? 'Charbon' : 'Diesel'} acheté : ${round2(qty)} unités pour ${money(cost)}.`);
  return ok(`${type === 'coal' ? 'Charbon' : 'Diesel'} acheté.`);
}

function actionSetElectricityOrder(player, payload) {
  if (player.epoch < 2) return fail('Contrat électrique verrouillé.', 'Atteins l’ère électrique pour commander de l’électricité.');
  const amount = Math.max(0, Math.min(50000, Number(payload.amount || 0)));
  player.resources = normalizeResources(player.resources);
  player.resources.electricityOrder = round2(amount);
  notify(player, `Commande électrique ajustée : ${round2(amount)} MW/h.`);
  return ok('Commande électrique modifiée.');
}


function computeOwnedStationRevenue(player, passengers, freightTons) {
  const assets = Object.values(player.stations || {});
  if (!assets.length) return 0;
  const stationBase = assets.reduce((sum, asset) => (
    sum
    + (asset.level || 1) * ECONOMY.ownedStationIncomeBase
    + (asset.commerce || 0) * ECONOMY.ownedStationCommerceIncome
    + (asset.depot ? 24 : 0)
  ), 0);
  const trafficIncome = passengers * 0.18 + freightTons * 0.032;
  const flowBonus = 1 + Math.min(0.18, techLevel(player, 'passenger_flow') * 0.025 + techLevel(player, 'intermodal_hubs') * 0.035);
  return (stationBase + trafficIncome) * flowBonus;
}

function researchOperatingCost(player) {
  return player.researchProject ? ECONOMY.researchLabBaseCost : 0;
}

function computeCo2(model, distance, frequency) {
  const factor = { coal: 4.2, diesel: 2.7, electricity: 0.45, hydrogen: 0.2, battery: 0.15 }[model.energyType] || 1;
  return model.energy * distance * frequency * factor * (model.co2Multiplier || 1) / 100;
}

function trainBaseWearLifetimeHours(model) {
  const generation = clamp(Math.floor(Number(model?.unlockEpoch || 0)), 0, 6);
  return clamp(12 + generation * 4, 12, 36);
}

function trainConditionValue(train) {
  return clamp(Number(train?.condition ?? 1), 0, 1);
}

function trainConditionPerformanceFactor(train) {
  const condition = trainConditionValue(train);
  if (condition <= 0) return 0;
  return clamp(0.35 + condition * 0.65, 0.35, 1);
}

function computeTrainWearPerTick(player, train, model, line, profile = null, staffing = null, policy = null) {
  if (!train || !model || !line?.active || train.maintenance?.active || trainConditionValue(train) <= 0) return 0;
  const activeProfile = profile || getTrainOperatingProfile(train, model, player);
  const activeStaffing = staffing || computeStaffing(player);
  const activePolicy = policy || BALANCE.maintenancePolicies[player.maintenancePolicy] || BALANCE.maintenancePolicies.standard;
  const baseHours = trainBaseWearLifetimeHours(model);
  const frequencyFactor = clamp(lineUtilizationFactor(line), 0.55, 1.15);
  const distanceFactor = clamp(lineDistance(line) / 26, 0.8, 1.35);
  const maintenanceLoad = clamp(Number(activeProfile.maintenance || model.maintenance || 0.5) / Math.max(0.25, Number(model.maintenance || 0.5)), 0.85, 1.22);
  const mechanicFactor = clamp(1.1 - Number(activeStaffing.mechanics || 0) * 0.1, 0.82, 1.12);
  const techWear = (1 - Math.min(0.12, techLevel(player, 'electric_standardized_maintenance') * 0.02)) * (1 - Math.min(0.08, techLevel(player, 'steam_workshops') * 0.014));
  const intensity = frequencyFactor * distanceFactor * maintenanceLoad * mechanicFactor * (activePolicy.wearMultiplier || 1) * techWear;
  const effectiveHours = clamp(baseHours / Math.max(0.1, intensity), 12, 36);
  return (TICK_MS / 3600000) / effectiveHours;
}

function trainMaintenanceProjection(player, train, model, profile = null) {
  const line = player?.lines?.find(l => l.active && lineTrainIds(l).includes(train?.id));
  const baseHours = trainBaseWearLifetimeHours(model);
  if (!line) return { active: false, baseHours, hoursToZero: null, label: 'Non affecté' };
  if (train?.maintenance?.active) return { active: false, baseHours, hoursToZero: null, label: 'En atelier' };
  if (trainConditionValue(train) <= 0) return { active: false, baseHours, hoursToZero: 0, label: 'Immobilisé' };
  const wearPerTick = computeTrainWearPerTick(player, train, model, line, profile);
  if (wearPerTick <= 0) return { active: false, baseHours, hoursToZero: null, label: 'Aucune usure' };
  return {
    active: true,
    baseHours,
    hoursToZero: round2(trainConditionValue(train) / wearPerTick / ticksPerRealHour()),
    wearPerHour: round2(wearPerTick * ticksPerRealHour() * 100),
    label: 'En service'
  };
}


function emptyStaffNeeds() {
  return { drivers: 0, controllers: 0, stationAgents: 0, mechanics: 0, dispatchers: 0, engineers: 0 };
}


function lineSlotDemand(player, line) {
  normalizeLineTrainIds(line);
  const assigned = player ? lineAssignedTrains(player, line).length : 0;
  const ids = lineTrainIds(line).length;
  return Math.max(0, assigned || ids || 0);
}

function lineUtilizationFactor(line) {
  const explicit = Number(line?.utilizationFactor);
  if (Number.isFinite(explicit)) return clamp(explicit, 0, 1);
  return 1;
}

function computeLineStaffNeeds(player, line) {
  if (!line?.active) return emptyStaffNeeds();
  const stops = lineStops(line);
  if (stops.length < 2) return emptyStaffNeeds();
  normalizeLineTrainIds(line);
  const distance = lineDistance(line);
  const trainCount = Math.max(1, lineSlotDemand(player, line) || 1);
  const longLineFactor = 1 + Math.max(0, distance - 180) / 420;
  const stopFactor = 1 + Math.max(0, stops.length - 2) * 0.08;
  const passengerService = line.service === 'passengers' || line.service === 'mixed';

  return {
    drivers: Math.max(1, Math.ceil(trainCount * longLineFactor * stopFactor)),
    controllers: passengerService ? Math.max(1, Math.ceil(trainCount * 0.75 * Math.min(1.8, longLineFactor) * Math.min(1.45, stopFactor))) : 0,
    stationAgents: Math.max(1, Math.ceil(trainCount * 0.12 + stops.length * 0.18 + Math.max(0, stops.length - 2) * 0.16)),
    mechanics: Math.max(1, Math.ceil(trainCount * 0.55 + distance * trainCount / 2200)),
    dispatchers: Math.max(1, Math.ceil(0.34 + (trainCount / 6) * Math.min(1.5, stopFactor))),
    engineers: Math.max(0, Math.ceil(distance / 220 + trainCount / 8 - 0.5))
  };
}

function computeStaffNeeds(player) {
  const activeLines = player.lines.filter(l => l.active);
  const stationCount = Object.keys(player.stations || {}).length;
  const trains = player.trains.length;
  if (!activeLines.length && !stationCount && !trains) return emptyStaffNeeds();

  const needs = emptyStaffNeeds();
  let dailyKm = 0;
  let stationWork = 0;

  for (const line of activeLines) {
    const lineNeeds = computeLineStaffNeeds(player, line);
    needs.drivers += lineNeeds.drivers;
    needs.controllers += lineNeeds.controllers;
    needs.dispatchers += lineNeeds.dispatchers;
    needs.engineers += lineNeeds.engineers;
    dailyKm += lineDistance(line) * Math.max(1, lineSlotDemand(player, line) || 1);
    stationWork += Math.max(0, lineStops(line).length - 2);
  }

  return {
    drivers: activeLines.length ? Math.max(1, needs.drivers) : 0,
    controllers: needs.controllers > 0 ? Math.max(1, needs.controllers) : 0,
    stationAgents: stationCount || activeLines.length ? Math.max(1, Math.ceil(stationCount * 0.65 + activeLines.length * 0.12 + stationWork * 0.16)) : 0,
    mechanics: trains ? Math.max(1, Math.ceil(trains * 0.55 + dailyKm / 1800)) : 0,
    dispatchers: activeLines.length ? Math.max(1, needs.dispatchers) : 0,
    engineers: needs.engineers > 0 ? Math.max(1, needs.engineers) : 0
  };
}

function driverCoverageForNeed(player, need = null) {
  const required = Math.max(0, Number((need ?? computeStaffNeeds(player).drivers) || 0));
  if (required <= 0) return 1;
  return clamp(Number(player.staff?.drivers || 0) / required, 0, 1);
}

function lineWithEffectiveFrequency(line, driverCoverage, sillonInfo = null) {
  const coverage = clamp(Number(driverCoverage), 0, 1);
  const requested = Math.max(0, Number(sillonInfo?.requestedFrequency ?? lineTrainIds(line).length ?? 0));
  const driverLimited = requested * coverage;
  const sillonLimited = sillonInfo ? Math.max(0, Number(sillonInfo.maxFrequency ?? requested)) : requested;
  const effectiveSlots = Math.max(0, Math.min(driverLimited, sillonLimited));
  const utilizationFactor = requested > 0 ? clamp(effectiveSlots / requested, 0, 1) : 0;
  return {
    ...line,
    frequency: effectiveSlots,
    requestedFrequency: requested,
    effectiveSlots,
    utilizationFactor
  };
}

function computeStaffing(player) {
  const needs = computeStaffNeeds(player);
  const training = Math.min(0.24, techLevel(player, 'crew_training') * 0.045);
  const safety = Math.min(0.12, techLevel(player, 'safety_training') * 0.025);
  const driverBase = driverCoverageForNeed(player, needs.drivers);
  return {
    drivers: needs.drivers > 0 ? clamp(driverBase + (driverBase > 0 ? training : 0), 0, 1.25) : 1.25,
    controllers: ratio(player.staff.controllers, needs.controllers) + training,
    stationAgents: ratio(player.staff.stationAgents, needs.stationAgents) + safety,
    mechanics: ratio(player.staff.mechanics, needs.mechanics) + training,
    dispatchers: ratio(player.staff.dispatchers, needs.dispatchers) + training,
    engineers: ratio(player.staff.engineers, needs.engineers)
  };
}

function ratio(value, need) {
  const required = Number(need || 0);
  if (required <= 0) return 1.25;
  return clamp((Number(value || 0) + 0.4) / required, 0.25, 1.25);
}

function updateMarket() {
  const drift = () => (Math.random() - 0.5) * 0.035;
  for (const key of Object.keys(state.market)) {
    const base = createMarket()[key];
    state.market[key] = round2(clamp(state.market[key] + drift(), base * 0.55, base * 1.85));
  }
  for (const event of state.events) {
    if (event.kind === 'energy') {
      state.market.diesel = round2(state.market.diesel * 1.01);
      state.market.electricity = round2(state.market.electricity * 1.006);
    }
    if (event.kind === 'tourism') state.market.demand = round2(state.market.demand * 1.003);
    if (event.kind === 'freight') state.market.freight = round2(state.market.freight * 1.005);
  }
}

function updateEvents() {
  for (const event of state.events) event.remaining -= 1;
  state.events = state.events.filter(e => e.remaining > 0);
  if (Math.random() < 0.08 || state.events.length === 0) {
    const event = createEvent(null, Math.floor(8 + Math.random() * 20));
    state.events.push(event);
    state.news.push({ day: state.day, text: event.title });
    state.news = state.news.slice(-60);
  }
}

function currentEventFactor() {
  let passenger = 1;
  let freight = 1;
  for (const event of state.events) {
    passenger *= event.passenger || 1;
    freight *= event.freight || 1;
  }
  return { passenger, freight };
}

function createEvent(forcedKind, duration) {
  const events = [
    { kind: 'tourism', title: 'Vacances scolaires : Forte demande voyageurs sur les axes touristiques.', passenger: 1.18, freight: 0.98 },
    { kind: 'energy', title: 'Tension sur les marchés de l’énergie : Les coûts de traction augmentent.', passenger: 1.0, freight: 0.96 },
    { kind: 'weather', title: 'Météo difficile : La ponctualité devient plus fragile.', passenger: 0.94, freight: 0.92 },
    { kind: 'freight', title: 'Rebond industriel : Les contrats fret sont plus nombreux.', passenger: 1.0, freight: 1.2 },
    { kind: 'expo', title: 'Grand événement national : Hausse temporaire des déplacements longue distance.', passenger: 1.14, freight: 1.02 },
    { kind: 'social', title: 'Tensions sociales sectorielles : Les compagnies sous-effectif sont pénalisées.', passenger: 0.97, freight: 0.97 }
  ];
  const event = forcedKind ? events.find(e => e.kind === forcedKind) || events[0] : events[Math.floor(Math.random() * events.length)];
  return { ...event, remaining: duration };
}

function epochTrafficTotal(player) {
  return Math.max(0, Math.round(Number(player.stats?.passengers || 0) + Number(player.stats?.freightTons || 0)));
}
function checkEpochUnlock(player) {
  let unlocked = false;
  while (true) {
    const totalTech = Object.values(player.tech).reduce((a, b) => a + b, 0);
    const next = BALANCE.epochs[player.epoch + 1];
    if (!next) return unlocked;
    const trafficTotal = epochTrafficTotal(player);
    if (totalTech < next.requiredTech || trafficTotal < next.requiredTraffic) return unlocked;
    player.epoch += 1;
    unlocked = true;
    notify(player, `Nouvelle époque débloquée : ${BALANCE.epochs[player.epoch].name}.`);
    state.news.push({ day: state.day, text: `${player.name} entre dans l’époque : ${BALANCE.epochs[player.epoch].name}.` });
  }
}

function compositionDefaultModeForModel(model) {
  const label = `${model?.name || ''} ${model?.type || ''}`.toLowerCase();
  const isMultipleUnit = /(autorail|rame|tgv|duplex|régio|ter|hydrogène|batterie|train de nuit|maglev|grande vitesse)/.test(label);
  if (isMultipleUnit) return 'multiple_unit';
  const passengerDominant = (model.capacity || 0) >= Math.max(80, (model.freight || 0) * 0.9);
  return passengerDominant && (model.capacity || 0) > 0 ? 'passenger_loco' : 'freight_loco';
}

function compositionAvailableModesForModel(model) {
  const defaultMode = compositionDefaultModeForModel(model);
  if (defaultMode === 'multiple_unit') return ['multiple_unit'];
  return ['passenger_loco', 'freight_loco'];
}

function compositionSpecForModel(model, preferredMode = null) {
  const defaultMode = compositionDefaultModeForModel(model);
  if (defaultMode === 'multiple_unit') {
    const defaultUnits = clamp(Math.round((model.capacity || 180) / 220), 1, 5);
    return {
      mode: 'multiple_unit',
      availableModes: ['multiple_unit'],
      powerUnits: { min: 1, max: Math.max(defaultUnits + 2, 4), default: defaultUnits },
      label: 'Engins moteurs',
      variants: []
    };
  }
  const availableModes = compositionAvailableModesForModel(model);
  const mode = availableModes.includes(preferredMode) ? preferredMode : defaultMode;
  const passengerDefault = clamp(Math.round((Math.max(model.capacity || 100, 100)) / 90), 1, 8);
  const freightDefault = clamp(Math.round((Math.max(model.freight || 200, 180)) / 180), 2, 14);
  if (mode === 'passenger_loco') {
    return {
      mode,
      availableModes,
      passengerCars: { min: 1, max: Math.max(passengerDefault + 5, 8), default: passengerDefault },
      label: 'Voitures voyageurs',
      variants: compositionVariantsForMode('passenger_loco')
    };
  }
  return {
    mode,
    availableModes,
    freightCars: { min: 2, max: Math.max(freightDefault + 6, 12), default: freightDefault },
    label: 'Wagons fret',
    variants: compositionVariantsForMode('freight_loco')
  };
}

function ensureTrainComposition(train, model) {
  const base = train.composition && typeof train.composition === 'object' ? train.composition : {};
  const spec = compositionSpecForModel(model, base.mode);
  const passengerVariant = compositionVariantForMode('passenger_loco', base.passengerVariant)?.id || 'standard';
  const freightVariant = compositionVariantForMode('freight_loco', base.freightVariant)?.id || 'covered';
  train.composition = {
    mode: spec.mode,
    passengerCars: clamp(Math.round(Number(base.passengerCars ?? compositionSpecForModel(model, 'passenger_loco').passengerCars?.default ?? 0)), compositionSpecForModel(model, 'passenger_loco').passengerCars?.min ?? 0, compositionSpecForModel(model, 'passenger_loco').passengerCars?.max ?? 0),
    freightCars: clamp(Math.round(Number(base.freightCars ?? compositionSpecForModel(model, 'freight_loco').freightCars?.default ?? 0)), compositionSpecForModel(model, 'freight_loco').freightCars?.min ?? 0, compositionSpecForModel(model, 'freight_loco').freightCars?.max ?? 0),
    powerUnits: clamp(Math.round(Number(base.powerUnits ?? compositionSpecForModel(model, 'multiple_unit').powerUnits?.default ?? 1)), compositionSpecForModel(model, 'multiple_unit').powerUnits?.min ?? 1, compositionSpecForModel(model, 'multiple_unit').powerUnits?.max ?? 1),
    passengerVariant,
    freightVariant
  };
  return train.composition;
}


function defaultCompositionForModel(model, preferredMode = null) {
  const spec = compositionSpecForModel(model, preferredMode);
  return {
    mode: spec.mode,
    passengerCars: compositionSpecForModel(model, 'passenger_loco').passengerCars?.default || 0,
    freightCars: compositionSpecForModel(model, 'freight_loco').freightCars?.default || 0,
    powerUnits: compositionSpecForModel(model, 'multiple_unit').powerUnits?.default || 1,
    passengerVariant: 'standard',
    freightVariant: 'covered'
  };
}

function compositionVariantAssetMultiplier(variant) {
  if (!variant) return 1;
  const capacity = Number(variant.capacityMultiplier ?? 1);
  const speed = Number(variant.speedMultiplier ?? 1);
  const energy = Number(variant.energyMultiplier ?? 1);
  const maintenance = Number(variant.maintenanceMultiplier ?? 1);
  const revenue = Number(variant.revenueMultiplier ?? 1);
  const comfort = Number(variant.comfortDelta ?? 0);
  const reliability = Number(variant.reliabilityDelta ?? 0);
  const eraPremium = Math.max(0, Number(variant.requiredModelEpoch ?? variant.requiredEpoch ?? 0)) * 0.08;
  const raw = 1
    + (capacity - 1) * 0.42
    + (speed - 1) * 0.35
    + (revenue - 1) * 0.38
    + Math.max(0, comfort) * 0.55
    + Math.max(0, reliability) * 2.5
    + Math.max(0, maintenance - 1) * 0.14
    + Math.max(0, energy - 1) * 0.10
    + eraPremium;
  return clamp(raw, 0.72, 1.85);
}

function compositionUnitCost(model, mode, variantId = '') {
  const modelPrice = Math.max(50000, Number(model?.price || 0));
  if (mode === 'multiple_unit') {
    const spec = compositionSpecForModel(model, 'multiple_unit');
    const defaultUnits = Math.max(1, Number(spec.powerUnits?.default || 1));
    const pool = modelPrice * 0.58;
    return Math.max(85000, Math.round(pool / defaultUnits));
  }
  if (mode === 'freight_loco') {
    const spec = compositionSpecForModel(model, 'freight_loco');
    const defaultWagons = Math.max(1, Number(spec.freightCars?.default || 1));
    const variant = compositionVariantForMode('freight_loco', variantId || 'covered');
    const pool = modelPrice * 0.34;
    return Math.max(18000, Math.round(pool / defaultWagons * compositionVariantAssetMultiplier(variant)));
  }
  const spec = compositionSpecForModel(model, 'passenger_loco');
  const defaultCars = Math.max(1, Number(spec.passengerCars?.default || 1));
  const variant = compositionVariantForMode('passenger_loco', variantId || 'standard');
  const pool = modelPrice * 0.38;
  return Math.max(26000, Math.round(pool / defaultCars * compositionVariantAssetMultiplier(variant)));
}

function compositionAssetValue(model, composition, mode = null) {
  if (!model || !composition) return 0;
  const activeMode = mode || composition.mode || compositionDefaultModeForModel(model);
  if (activeMode === 'multiple_unit') {
    const spec = compositionSpecForModel(model, 'multiple_unit');
    const count = clamp(Math.round(Number(composition.powerUnits ?? spec.powerUnits?.default ?? 1)), spec.powerUnits.min, spec.powerUnits.max);
    return Math.round(count * compositionUnitCost(model, 'multiple_unit'));
  }
  if (activeMode === 'freight_loco') {
    const spec = compositionSpecForModel(model, 'freight_loco');
    const count = clamp(Math.round(Number(composition.freightCars ?? spec.freightCars?.default ?? 0)), spec.freightCars.min, spec.freightCars.max);
    return Math.round(count * compositionUnitCost(model, 'freight_loco', composition.freightVariant || 'covered'));
  }
  const spec = compositionSpecForModel(model, 'passenger_loco');
  const count = clamp(Math.round(Number(composition.passengerCars ?? spec.passengerCars?.default ?? 0)), spec.passengerCars.min, spec.passengerCars.max);
  return Math.round(count * compositionUnitCost(model, 'passenger_loco', composition.passengerVariant || 'standard'));
}

function compositionChangeEconomy(model, beforeComposition, afterComposition, train) {
  const beforeValue = compositionAssetValue(model, beforeComposition, beforeComposition?.mode);
  const afterValue = compositionAssetValue(model, afterComposition, afterComposition?.mode);
  const delta = Math.round(afterValue - beforeValue);
  const conditionFactor = clamp(Number(train?.condition || 0), 0.05, 1);
  const cost = delta > 0 ? delta : 0;
  const refund = delta < 0 ? Math.round(Math.abs(delta) * COMPOSITION_REFUND_RATE * conditionFactor) : 0;
  return { beforeValue, afterValue, delta, cost, refund, conditionFactor, refundRate: COMPOSITION_REFUND_RATE };
}

function trainCapitalValue(model, train) {
  const defaultMode = compositionDefaultModeForModel(model);
  const defaultComposition = defaultCompositionForModel(model, defaultMode);
  const defaultCompositionValue = compositionAssetValue(model, defaultComposition, defaultMode);
  const baseTractionValue = Math.max(Math.round(Number(model?.price || 0) * 0.42), Math.round(Number(model?.price || 0) - defaultCompositionValue));
  const composition = ensureTrainComposition(train, model);
  const currentCompositionValue = compositionAssetValue(model, composition, composition.mode);
  return Math.max(0, baseTractionValue + currentCompositionValue);
}


const _techNodeListCache = [];
const _researchEffectCache = new Map();

function allTechNodes() {
  if (_techNodeListCache.length) return _techNodeListCache;
  for (const group of Object.values(BALANCE.techTree || {})) {
    for (const node of group.nodes || []) _techNodeListCache.push(node);
  }
  return _techNodeListCache;
}

function normalizeEffectText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseResearchNumericEffects(effectText) {
  const text = normalizeEffectText(effectText);
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
      'range'
    );
    effects.push({ kind, value: sign * rawValue });
  }
  return effects;
}

function nodeNumericEffects(node) {
  if (!node?.id) return [];
  if (_researchEffectCache.has(node.id)) return _researchEffectCache.get(node.id);
  const parsed = [];
  for (const effect of node.improves || []) parsed.push(...parseResearchNumericEffects(effect));
  _researchEffectCache.set(node.id, parsed);
  return parsed;
}

function modelResearchEra(model) {
  return Math.max(1, Number(model?.unlockEpoch || 0) + 1);
}


function researchLevelEffectUnits(level) {
  const n = Math.max(0, Math.floor(Number(level || 0)));
  if (n <= 5) return n;
  return 5 + 2 * (1 - Math.pow(0.75, n - 5));
}

function eraResearchModifiers(player, era) {
  const modifiers = { speed: 1, range: 1, reliability: 1, energy: 1, environment: 1, profitability: 1 };
  if (!player || !era) return modifiers;
  for (const node of allTechNodes()) {
    if (Number(node.era || 0) !== Number(era)) continue;
    const level = techLevel(player, node.id);
    if (level <= 0) continue;
    const units = researchLevelEffectUnits(level);
    for (const effect of nodeNumericEffects(node)) {
      const adjusted = effect.value * units;
      modifiers[effect.kind] *= Math.max(0.08, 1 + adjusted);
    }
  }
  return modifiers;
}

function modelWithEraResearch(player, model) {
  if (!player || !model) return { ...model, profitabilityMultiplier: 1, co2Multiplier: 1 };
  const modifiers = eraResearchModifiers(player, modelResearchEra(model));
  return {
    ...model,
    speed: Math.max(20, round2((model.speed || 0) * modifiers.speed)),
    range: Math.max(1, round2((model.range || 0) * modifiers.range)),
    reliability: clamp((model.reliability || 0) * modifiers.reliability, 0.18, 0.995),
    energy: Math.max(0.01, round2((model.energy || 0) * modifiers.energy)),
    profitabilityMultiplier: round2(modifiers.profitability),
    co2Multiplier: round2(modifiers.environment)
  };
}

function applyTrainConditionToProfile(profile, train) {
  const factor = trainConditionPerformanceFactor(train);
  if (factor <= 0) {
    profile.speed = 0;
    profile.reliability = 0;
    profile.conditionSpeedFactor = 0;
    return profile;
  }
  profile.nominalSpeed = profile.speed;
  profile.speed = Math.max(5, Math.round(profile.speed * factor));
  profile.reliability = clamp(profile.reliability * (0.25 + factor * 0.75), 0.05, 0.995);
  profile.conditionSpeedFactor = round2(factor);
  return profile;
}

function getTrainOperatingProfile(train, model, player = null) {
  const sourceModel = modelWithEraResearch(player, model);
  const composition = ensureTrainComposition(train, sourceModel);
  const spec = compositionSpecForModel(sourceModel, composition.mode);
  const profile = { ...sourceModel, compositionMode: spec.mode, compositionSpec: spec, composition, freightRevenueMultiplier: 1, co2Multiplier: sourceModel.co2Multiplier || 1 };
  if (spec.mode === 'multiple_unit') {
    const defaultUnits = spec.powerUnits.default;
    const ratio = composition.powerUnits / Math.max(1, defaultUnits);
    profile.capacity = Math.max(0, Math.round(sourceModel.capacity * ratio));
    profile.freight = Math.max(0, Math.round((sourceModel.freight || 0) * ratio));
    profile.speed = Math.max(35, Math.round(sourceModel.speed * (1 - Math.max(0, ratio - 1) * 0.015)));
    profile.energy = round2(sourceModel.energy * ratio * (0.95 + ratio * 0.05));
    profile.maintenance = round2(sourceModel.maintenance * ratio * (0.92 + ratio * 0.08));
    profile.reliability = clamp(sourceModel.reliability - Math.max(0, ratio - 1) * 0.015, 0.45, 0.995);
    profile.comfort = clamp(sourceModel.comfort - Math.max(0, ratio - 1) * 0.01, 0.08, 1);
    profile.variant = null;
    profile.compositionSummary = `${composition.powerUnits} engin(s) moteur(s)`;
    return applyTrainConditionToProfile(profile, train);
  }
  if (spec.mode === 'passenger_loco') {
    const variant = compositionVariantForMode('passenger_loco', composition.passengerVariant);
    const defaultCars = spec.passengerCars.default;
    const ratio = composition.passengerCars / Math.max(1, defaultCars);
    profile.capacity = Math.max(0, Math.round(sourceModel.capacity * ratio));
    profile.freight = Math.max(0, Math.round((sourceModel.freight || 0) * Math.min(1.2, 0.65 + composition.passengerCars * 0.08)));
    profile.speed = Math.max(30, Math.round(sourceModel.speed * (1 - Math.max(0, ratio - 1) * 0.03)));
    profile.energy = round2(sourceModel.energy * (0.72 + ratio * 0.28 + Math.max(0, ratio - 1) * 0.08));
    profile.maintenance = round2(sourceModel.maintenance * (0.76 + ratio * 0.24 + Math.max(0, ratio - 1) * 0.05));
    profile.reliability = clamp(sourceModel.reliability - Math.max(0, ratio - 1) * 0.02, 0.45, 0.995);
    profile.comfort = clamp(sourceModel.comfort + Math.min(0.06, Math.max(0, ratio - 1) * 0.015), 0.08, 1);
    profile.capacity = Math.max(0, Math.round(profile.capacity * variant.capacityMultiplier));
    profile.speed = Math.max(30, Math.round(profile.speed * variant.speedMultiplier));
    profile.energy = round2(profile.energy * variant.energyMultiplier);
    profile.maintenance = round2(profile.maintenance * variant.maintenanceMultiplier);
    profile.reliability = clamp(profile.reliability + variant.reliabilityDelta, 0.45, 0.995);
    profile.comfort = clamp(profile.comfort + variant.comfortDelta, 0.08, 1);
    profile.variant = { id: variant.id, name: variant.name, shortLabel: variant.shortLabel, asset: variant.asset };
    profile.compositionSummary = `${composition.passengerCars} voiture(s) · ${variant.shortLabel}`;
    return applyTrainConditionToProfile(profile, train);
  }
  const variant = compositionVariantForMode('freight_loco', composition.freightVariant);
  const defaultWagons = spec.freightCars.default;
  const ratio = composition.freightCars / Math.max(1, defaultWagons);
  profile.freight = Math.max(0, Math.round(sourceModel.freight * ratio));
  profile.capacity = Math.max(0, Math.round((sourceModel.capacity || 0) * Math.max(0.4, 1 - Math.max(0, ratio - 1) * 0.18)));
  profile.speed = Math.max(25, Math.round(sourceModel.speed * (1 - Math.max(0, ratio - 1) * 0.035)));
  profile.energy = round2(sourceModel.energy * (0.7 + ratio * 0.3 + Math.max(0, ratio - 1) * 0.1));
  profile.maintenance = round2(sourceModel.maintenance * (0.74 + ratio * 0.26 + Math.max(0, ratio - 1) * 0.06));
  profile.reliability = clamp(sourceModel.reliability - Math.max(0, ratio - 1) * 0.022, 0.45, 0.995);
  profile.comfort = clamp(sourceModel.comfort - Math.max(0, ratio - 1) * 0.01, 0.05, 1);
  profile.freight = Math.max(0, Math.round(profile.freight * variant.capacityMultiplier));
  profile.speed = Math.max(25, Math.round(profile.speed * variant.speedMultiplier));
  profile.energy = round2(profile.energy * variant.energyMultiplier);
  profile.maintenance = round2(profile.maintenance * variant.maintenanceMultiplier);
  profile.reliability = clamp(profile.reliability + variant.reliabilityDelta, 0.45, 0.995);
  profile.freightRevenueMultiplier = variant.revenueMultiplier || 1;
  profile.variant = { id: variant.id, name: variant.name, shortLabel: variant.shortLabel, cargoType: variant.cargoType || null, asset: variant.asset };
  profile.compositionSummary = `${composition.freightCars} wagon(s) · ${variant.shortLabel}`;
  return applyTrainConditionToProfile(profile, train);
}

function publicTrain(train, player = null) {
  const model = BALANCE.trains[train.modelId];
  if (!model) return train;
  const profile = getTrainOperatingProfile(train, model, player);
  return {
    ...train,
    composition: profile.composition,
    compositionMode: profile.compositionMode,
    compositionSpec: profile.compositionSpec,
    compositionSummary: profile.compositionSummary,
    profile: {
      capacity: profile.capacity,
      freight: profile.freight,
      speed: profile.speed,
      range: profile.range,
      energy: profile.energy,
      maintenance: profile.maintenance,
      reliability: profile.reliability,
      comfort: profile.comfort,
      variant: profile.variant || null,
      freightRevenueMultiplier: profile.freightRevenueMultiplier || 1,
      conditionSpeedFactor: profile.conditionSpeedFactor ?? 1,
      nominalSpeed: profile.nominalSpeed || profile.speed
    },
    maintenanceProjection: trainMaintenanceProjection(player, train, model, profile)
  };
}

function createTrainInstance(modelId, ownerId) {
  const train = {
    id: crypto.randomUUID(),
    modelId,
    ownerId,
    condition: 0.96,
    age: 0,
    acquiredDay: state.day || 1,
    maintenance: { active: false, mode: null, daysLeft: 0, duration: 0, targetCondition: 0, lastServiceDay: state.day || 1 }
  };
  const model = BALANCE.trains[modelId];
  if (model) ensureTrainComposition(train, model);
  return train;
}

function normalizeTrain(raw, ownerId) {
  if (!raw || typeof raw !== 'object') return null;
  raw.id = raw.id || crypto.randomUUID();
  raw.ownerId = raw.ownerId || ownerId;
  raw.condition = clamp(Number(raw.condition ?? 0.9), 0, 1);
  raw.age = Math.max(0, Math.floor(Number(raw.age || 0)));
  raw.acquiredDay = raw.acquiredDay || state.day || 1;
  const m = raw.maintenance && typeof raw.maintenance === 'object' ? raw.maintenance : {};
  raw.maintenance = {
    active: Boolean(m.active),
    mode: m.mode || null,
    label: m.label || null,
    daysLeft: Math.max(0, Math.floor(Number(m.daysLeft || 0))),
    duration: Math.max(0, Math.floor(Number(m.duration || 0))),
    targetCondition: clamp(Number(m.targetCondition || 0), 0, 1),
    startedDay: m.startedDay || null,
    cost: Math.round(Number(m.cost || 0)),
    lastServiceDay: m.lastServiceDay || raw.acquiredDay
  };
  const model = BALANCE.trains[raw.modelId];
  if (model) ensureTrainComposition(raw, model);
  if (raw.maintenance.active && raw.maintenance.daysLeft <= 0) raw.maintenance.active = false;
  return raw;
}


function applyValidatedRouteToLine(line, routeInfo) {
  if (!line || !routeInfo) return line;
  const distance = Math.max(0, Math.round(Number(routeInfo.distance || 0)));
  if (distance > 0) line.distance = distance;
  if (Number.isFinite(Number(routeInfo.maxSegment))) line.maxSegment = Math.max(0, Math.round(Number(routeInfo.maxSegment || 0)));
  if (Array.isArray(routeInfo.segments)) {
    line.routeSegments = routeInfo.segments
      .map(segment => ({
        from: currentStationId(segment.from),
        to: currentStationId(segment.to),
        distance: Math.max(1, Math.round(Number(segment.distance || 0)))
      }))
      .filter(segment => segment.from && segment.to && segment.from !== segment.to && segment.distance > 0);
  }
  return line;
}

function createLineInstance(player, stops, trainId, service, frequency, ticketPrice, knownRoute = null) {
  const normalizedStops = sanitizeStopsPayload(stops, null, null);
  const count = player.lines.length + 1;
  const routeDistance = Number(knownRoute?.distance || knownRoute || routeBetweenStops(normalizedStops).distance);
  return normalizeLine(applyValidatedRouteToLine({
    id: crypto.randomUUID(),
    code: `${player.name.substring(0, 3).toUpperCase()}-${String(count).padStart(3, '0')}`,
    from: normalizedStops[0],
    to: normalizedStops[normalizedStops.length - 1],
    stops: normalizedStops,
    trainId,
    trainIds: [trainId],
    service,
    frequency,
    ticketPrice,
    distance: Math.max(1, Math.round(routeDistance || 0)),
    tariff: tariffFromTicketPrice(ticketPrice, Math.max(1, Number(routeDistance || 0))),
    active: true,
    electrified: false,
    createdDay: state.day,
    stats: { passengers: 0, freightTons: 0, revenue: 0, expenses: 0, profit: 0, punctuality: 100, satisfaction: 50, share: 0 }
  }, knownRoute && typeof knownRoute === 'object' ? knownRoute : null));
}

function lineStops(line) {
  const raw = Array.isArray(line?.stops) && line.stops.length ? line.stops : [line?.from, line?.to];
  return [...new Set(raw.map(id => String(id || '').trim()).filter(Boolean))];
}

function lineTrainIds(line) {
  const raw = Array.isArray(line?.trainIds) && line.trainIds.length ? line.trainIds : [line?.trainId];
  return [...new Set(raw.map(id => String(id || '').trim()).filter(Boolean))];
}

function lineAssignedTrains(player, line, { availableOnly = false } = {}) {
  const ids = lineTrainIds(line);
  return ids
    .map(id => player?.trains?.find(t => t.id === id))
    .filter(Boolean)
    .filter(train => !availableOnly || (!train.maintenance?.active && trainConditionValue(train) > 0));
}

function trainUsedByActiveLine(player, trainId, exceptLineId = '') {
  return (player?.lines || []).some(line => line?.active && line.id !== exceptLineId && lineTrainIds(line).includes(trainId));
}

function normalizeLineTrainIds(line) {
  const ids = lineTrainIds(line);
  line.trainIds = ids;
  line.trainId = ids[0] || line.trainId || '';
  return ids;
}

function combinedOperatingProfile(player, trains) {
  const entries = (trains || [])
    .map(train => {
      const model = BALANCE.trains[train?.modelId];
      if (!train || !model) return null;
      return { train, model, profile: getTrainOperatingProfile(train, model, player) };
    })
    .filter(Boolean);
  if (!entries.length) return null;

  const first = entries[0].profile;
  if (entries.length === 1) return { profile: first, primaryTrain: entries[0].train, primaryModel: entries[0].model, entries };

  const capacityWeight = value => Math.max(1, Number(value?.capacity || 0) + Number(value?.freight || 0) * 0.25);
  const totalWeight = entries.reduce((sum, entry) => sum + capacityWeight(entry.profile), 0) || entries.length;
  const weightedAverage = key => entries.reduce((sum, entry) => sum + Number(entry.profile[key] || 0) * capacityWeight(entry.profile), 0) / totalWeight;
  const sum = key => entries.reduce((total, entry) => total + Number(entry.profile[key] || 0), 0);
  const energyTypes = [...new Set(entries.map(entry => entry.profile.energyType || entry.model.energyType).filter(Boolean))];
  const minRange = Math.min(...entries.map(entry => Number(entry.profile.range || entry.model.range || 0)).filter(Number.isFinite));
  const aggregate = {
    ...first,
    id: 'aggregate-line-profile',
    name: `${entries.length} trains affectés`,
    type: 'Composition multi-trains',
    speed: Math.min(...entries.map(entry => Number(entry.profile.speed || entry.model.speed || 0)).filter(Number.isFinite)),
    capacity: sum('capacity'),
    freight: sum('freight'),
    energy: sum('energy'),
    maintenance: sum('maintenance'),
    reliability: weightedAverage('reliability'),
    comfort: weightedAverage('comfort'),
    range: Number.isFinite(minRange) ? minRange : Number(first.range || 0),
    energyType: energyTypes.length === 1 ? energyTypes[0] : (first.energyType || entries[0].model.energyType),
    profitabilityMultiplier: weightedAverage('profitabilityMultiplier') || 1,
    freightRevenueMultiplier: weightedAverage('freightRevenueMultiplier') || 1,
    compositionSummary: `${entries.length} trains · ${Math.round(sum('capacity'))} voy. · ${Math.round(sum('freight'))} t`
  };
  return { profile: aggregate, primaryTrain: entries[0].train, primaryModel: entries[0].model, entries };
}

function lineServiceCompatibleWithProfile(service, profile) {
  if (service === 'freight') return Number(profile?.freight || 0) > 0;
  if (service === 'mixed') return Number(profile?.capacity || 0) > 0 && Number(profile?.freight || 0) > 0;
  return Number(profile?.capacity || 0) > 0;
}

function sanitizeStopsPayload(rawStops, from, to) {
  const base = Array.isArray(rawStops) && rawStops.length ? rawStops : [from, to];
  const cleaned = [];
  for (const id of base) {
    const value = String(id || '').trim();
    if (!value) continue;
    if (!cleaned.length || cleaned[cleaned.length - 1] !== value) cleaned.push(value);
  }
  return cleaned;
}

function validateLineStops(stops) {
  if (!Array.isArray(stops) || stops.length < 2) return 'Une ligne doit comporter au moins 2 arrêts.';
  if (new Set(stops).size < 2) return 'Les arrêts de la ligne doivent être différents.';
  for (const stopId of stops) {
    if (!stationById(stopId)) return `Arrêt invalide : ${stopId}.`;
  }
  return '';
}

function validateLineStopService(stops, service) {
  for (const stopId of stops || []) {
    const station = stationById(stopId);
    if (!station) return `Gare inconnue : ${stopId}.`;
    const passengerOk = Boolean(station.hasPassengerStation);
    const freightOk = Boolean(station.hasFreightStation);
    if (service === 'passengers' && !passengerOk) return `${station.name} n’est pas une gare voyageurs.`;
    if (service === 'freight' && !freightOk) return `${station.name} n’est pas une gare fret.`;
    if (service === 'mixed' && (!passengerOk || !freightOk)) return `${station.name} ne permet pas un service mixte voyageurs + fret.`;
  }
  return '';
}

function stationOwnerInfo(stationId) {
  for (const candidate of activePlayers()) {
    if (candidate?.stations?.[stationId]) {
      return { player: candidate, asset: normalizeStationAsset(candidate, stationId) };
    }
  }
  const custom = state.customStations?.[stationId];
  if (custom?.ownerId && state.players[custom.ownerId]) {
    const owner = state.players[custom.ownerId];
    return { player: owner, asset: ensureStationAsset(owner, stationId) };
  }
  return null;
}

function lineStopsOwnershipProblem(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
  for (const stopId of ids) {
    if (!stationById(stopId)) return `Arrêt invalide : ${stopId}.`;
  }
  // Les gares libres peuvent désormais être desservies ou simplement traversées.
  // Les péages ne sont dus que lorsqu'une gare appartient réellement à une autre compagnie.
  return '';
}

function computePassageRights(player, line, model, distance, infrastructureUsage = null) {
  const byOwner = new Map();
  let stationTotal = 0;

  function addAllocation(ownerId, amount, sourceKey) {
    const owner = state.players[ownerId];
    if (!owner || !Number.isFinite(amount) || amount <= 0) return;
    const current = byOwner.get(ownerId) || { ownerId, amount: 0, segments: [] };
    current.amount += amount;
    if (sourceKey) current.segments.push(sourceKey);
    byOwner.set(ownerId, current);
  }

  const capacityBase = Math.max(1, Number(model.capacity || 0) + Number(model.freight || 0) * 0.65);
  const frequency = Math.max(0, lineUtilizationFactor(line));
  if (frequency <= 0) {
    return { total: 0, infrastructureTotal: 0, stationTotal: 0, allocations: [] };
  }

  // Péage de gare : payé quand la ligne dessert une gare tierce
  // OU quand son itinéraire calculé passe visuellement par cette gare sans arrêt commercial.
  for (const stopId of [...new Set(linePathIds(line))]) {
    const ownerInfo = stationOwnerInfo(stopId);
    if (!ownerInfo || ownerInfo.player.id === player.id) continue;
    const asset = ownerInfo.asset || { level: 1, commerce: 0, maintenance: 0, depot: false };
    const stationLevel = clamp(Number(asset.level || 1), 1, 5);
    const qualityFactor = 1
      + Math.max(0, stationLevel - 1) * 0.125
      + clamp(Number(asset.commerce || 0), 0, 4) * 0.04
      + clamp(Number(asset.maintenance || 0), 0, 4) * 0.025
      + (asset.depot ? 0.06 : 0);
    const stopAmount = (ECONOMY.stationAccessTollBase + capacityBase * ECONOMY.stationAccessTollCapacityFactor) * frequency * qualityFactor;
    stationTotal += stopAmount;
    addAllocation(ownerInfo.player.id, stopAmount, `station:${stopId}`);
  }

  const total = stationTotal;
  return {
    total,
    infrastructureTotal: 0,
    stationTotal,
    allocations: [...byOwner.values()].map(item => ({
      ...item,
      amount: Math.round(item.amount)
    }))
  };
}

function recordPassageRights(ledger, payer, line, rights) {
  if (!ledger || !rights?.allocations?.length) return;
  for (const allocation of rights.allocations) {
    if (!allocation.amount || allocation.amount <= 0) continue;
    const current = ledger.get(allocation.ownerId) || { revenue: 0, lines: 0 };
    current.revenue += allocation.amount;
    current.lines += 1;
    ledger.set(allocation.ownerId, current);
  }
}

function applyPassageRightsLedger(ledger) {
  if (!ledger) return;
  for (const [ownerId, entry] of ledger.entries()) {
    const owner = state.players[ownerId];
    const amount = Math.round(entry.revenue || 0);
    if (!owner || amount <= 0) continue;
    owner.cash += amount;
    owner.stats.revenue += amount;
    owner.stats.profit += amount;
    owner.stats.lastRevenue += amount;
    owner.stats.lastProfit += amount;
    owner.stats.lastBreakdown = owner.stats.lastBreakdown || {};
    owner.stats.lastBreakdown.passageRightsRevenue = Math.round(Number(owner.stats.lastBreakdown.passageRightsRevenue || 0) + amount);
  }
}

function normalizeLine(line) {
  if (!line || typeof line !== 'object') return line;
  const stops = sanitizeStopsPayload(line.stops, line.from, line.to);
  line.stops = stops.length >= 2 ? stops : [line.from, line.to].filter(Boolean);
  line.from = line.stops[0];
  line.to = line.stops[line.stops.length - 1];
  if (Number.isFinite(Number(line.distance))) line.distance = Math.max(0, Math.round(Number(line.distance)));
  if (Number.isFinite(Number(line.maxSegment))) line.maxSegment = Math.max(0, Math.round(Number(line.maxSegment)));
  normalizeLineTrainIds(line);
  line.name = lineRouteName(line.stops);
  if (!line.stats) line.stats = { passengers: 0, freightTons: 0, revenue: 0, expenses: 0, profit: 0, punctuality: 100, satisfaction: 50, share: 0 };
  const distance = lineDistance(line);
  setLineTicketPrice(line, lineTicketPrice(line, distance), distance);
  return line;
}

function lineRouteName(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.length < 2) return 'Ligne';
  const first = stationById(ids[0])?.name || ids[0];
  const last = stationById(ids[ids.length - 1])?.name || ids[ids.length - 1];
  return `${first} → ${last}`;
}

function lineDistance(line) {
  const stored = Number(line?.distance);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  return routeBetweenStops(lineStops(line)).distance;
}

function lineSegmentKey(a, b) {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  return [left, right].sort().join('::');
}

function linePathIds(line) {
  if (Array.isArray(line?.routeSegments) && line.routeSegments.length) {
    const ids = [line.routeSegments[0].from];
    for (const segment of line.routeSegments) ids.push(segment.to);
    return [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))];
  }
  const route = routeBetweenStops(lineStops(line));
  const ids = Array.isArray(route?.ids) && route.ids.length ? route.ids : lineStops(line);
  return [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))];
}

function lineSegments(line) {
  if (Array.isArray(line?.routeSegments) && line.routeSegments.length) {
    return line.routeSegments
      .map(segment => ({
        from: currentStationId(segment.from),
        to: currentStationId(segment.to),
        key: lineSegmentKey(segment.from, segment.to),
        distance: Math.max(1, Math.round(Number(segment.distance || 0)))
      }))
      .filter(segment => segment.from && segment.to && segment.from !== segment.to && segment.distance > 0);
  }
  const stops = linePathIds(line);
  const segments = [];
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1];
    const to = stops[i];
    if (!from || !to || from === to) continue;
    segments.push({
      from,
      to,
      key: lineSegmentKey(from, to),
      distance: Math.max(1, distanceBetween(from, to))
    });
  }
  return segments;
}

const SILLON_PARIS_ORLEANS_MAIN_IDS = new Set([
  'COM_91223', // Étampes
  'COM_91226', // Étréchy
  'COM_91330', // Lardy
  'COM_91376', // Marolles-en-Hurepoix
  'COM_91103', // Brétigny-sur-Orge
  'COM_91570', // Saint-Michel-sur-Orge
  'COM_91549', // Sainte-Geneviève-des-Bois
  'COM_91589', // Savigny-sur-Orge
  'COM_91326', // Juvisy-sur-Orge
  'COM_94081', // Vitry-sur-Seine
  'COM_94022', // Choisy-le-Roi
  'COM_94041', // Ivry-sur-Seine
  'PAR_AUSTERLITZ'
]);

const SILLON_DOURDAN_BRANCH_IDS = new Set([
  'COM_91200', // Dourdan
  'COM_91540', // Saint-Chéron
  'COM_91105', // Breuillet
  'COM_91021', // Arpajon
  'COM_91552', // Saint-Germain-lès-Arpajon
  'COM_91207', // Égly
  'COM_91461', // Ollainville
  'COM_91103'  // Brétigny-sur-Orge
]);

function stationDeptCode(station) {
  const code = String(station?.codeDepartement || station?.code || station?.postal || station?.codesPostaux?.[0] || '');
  return code.slice(0, 2);
}

function stationIdOrNameMatches(station, regex) {
  const text = normalizeSearch(`${station?.id || ''} ${station?.name || ''}`);
  return regex.test(text);
}

function segmentSpecificCapacityPerHour(segment, a, b) {
  const idA = currentStationId(segment.from);
  const idB = currentStationId(segment.to);
  const onDourdanBranch = SILLON_DOURDAN_BRANCH_IDS.has(idA) && SILLON_DOURDAN_BRANCH_IDS.has(idB);
  const onParisOrleans = SILLON_PARIS_ORLEANS_MAIN_IDS.has(idA) && SILLON_PARIS_ORLEANS_MAIN_IDS.has(idB);

  // Antenne Dourdan ↔ Brétigny : voie moins capacitaire, référence demandée 4 trains/h.
  if (onDourdanBranch && !onParisOrleans) return 4;

  // Axe Paris-Austerlitz ↔ Brétigny ↔ Étampes : capacité haute, référence demandée 18 trains/h.
  if (onParisOrleans) return 18;

  const nameA = normalizeSearch(a?.name || '');
  const nameB = normalizeSearch(b?.name || '');
  const pairName = `${nameA} ${nameB}`;
  if (/\bdourdan\b/.test(pairName) && /\bbretigny\b/.test(pairName)) return 4;
  if (/\betampes\b/.test(pairName) && /(austerlitz|bretigny|juvisy)/.test(pairName)) return 18;

  return null;
}

function segmentCapacityPerHour(segment) {
  const a = stationById(segment.from);
  const b = stationById(segment.to);
  const distance = Math.max(1, Number(segment.distance || distanceBetween(segment.from, segment.to) || 1));
  const specific = segmentSpecificCapacityPerHour(segment, a, b);
  if (Number.isFinite(specific) && specific > 0) return clamp(Math.round(specific), 2, 40);

  const demandA = Number(a?.baseDemand || 0) + Math.min(900, Number(a?.population || 0) / 2500);
  const demandB = Number(b?.baseDemand || 0) + Math.min(900, Number(b?.population || 0) / 2500);
  const maxDemand = Math.max(demandA, demandB);
  const sumDemand = demandA + demandB;
  const deptA = stationDeptCode(a);
  const deptB = stationDeptCode(b);
  const idfA = ['75', '77', '78', '91', '92', '93', '94', '95'].includes(deptA) || /^PAR_/.test(String(a?.id || ''));
  const idfB = ['75', '77', '78', '91', '92', '93', '94', '95'].includes(deptB) || /^PAR_/.test(String(b?.id || ''));
  const denseCore = ['75', '92', '93', '94'].includes(deptA) || ['75', '92', '93', '94'].includes(deptB) || /^PAR_/.test(String(a?.id || '')) || /^PAR_/.test(String(b?.id || ''));
  const secondaryBranch = distance <= 35 && sumDemand < 620 && maxDemand < 380;

  let capacity = 8;
  if (denseCore && distance <= 45) capacity = 20;
  else if (idfA && idfB && distance <= 55 && !secondaryBranch) capacity = 14;
  else if (idfA && idfB && secondaryBranch) capacity = 6;
  else if (sumDemand >= 1500 || maxDemand >= 850) capacity = 18;
  else if (sumDemand >= 900 || maxDemand >= 520) capacity = 14;
  else if (sumDemand >= 520 || maxDemand >= 300) capacity = 10;
  else if (distance >= 120 && sumDemand < 500) capacity = 4;
  else if (distance >= 70 && sumDemand < 650) capacity = 6;
  else if (distance <= 25 && sumDemand >= 380) capacity = 8;
  else capacity = 6;

  return clamp(Math.round(capacity), 2, 40);
}

function buildSillonUsage() {
  const usage = new Map();
  for (const player of activePlayers()) {
    for (const line of player.lines || []) {
      if (!line?.active) continue;
      const requested = lineSlotDemand(player, line);
      if (requested <= 0) continue;
      for (const segment of lineSegments(line)) {
        const capacity = segmentCapacityPerHour(segment);
        const entry = usage.get(segment.key) || {
          key: segment.key,
          from: segment.from,
          to: segment.to,
          distance: segment.distance,
          capacity,
          used: 0,
          entries: []
        };
        entry.capacity = Math.min(Number(entry.capacity || capacity), capacity);
        entry.distance = Math.max(entry.distance || 0, segment.distance || 0);
        entry.used += requested;
        entry.entries.push({ playerId: player.id, lineId: line.id, frequency: requested });
        usage.set(segment.key, entry);
      }
    }
  }
  return usage;
}

function computeLineSillonLimit(player, line, usage = null) {
  const requested = lineSlotDemand(player, line);
  const sillonUsage = usage || buildSillonUsage();
  const segments = lineSegments(line);
  if (!segments.length) {
    return {
      requestedFrequency: requested,
      maxFrequency: requested,
      effectiveFrequency: requested,
      constrained: false,
      bottleneck: null,
      segments: []
    };
  }

  let maxFrequency = Number.POSITIVE_INFINITY;
  let lineCapacity = Number.POSITIVE_INFINITY;
  let bottleneck = null;
  const details = [];
  for (const segment of segments) {
    const capacity = segmentCapacityPerHour(segment);
    const entry = sillonUsage.get(segment.key);
    const ownRequested = (entry?.entries || [])
      .filter(item => item.playerId === player.id && item.lineId === line.id)
      .reduce((sum, item) => sum + Number(item.frequency || 0), 0);
    const usedByOthers = Math.max(0, Number(entry?.used || 0) - ownRequested);
    const totalUsed = usedByOthers + requested;
    const available = Math.max(0, capacity - usedByOthers);
    const detail = {
      key: segment.key,
      from: segment.from,
      to: segment.to,
      fromName: stationById(segment.from)?.name || segment.from,
      toName: stationById(segment.to)?.name || segment.to,
      capacity,
      usedByOthers: round2(usedByOthers),
      totalUsed: round2(totalUsed),
      available: round2(available),
      requested
    };
    details.push(detail);
    if (capacity < lineCapacity) lineCapacity = capacity;
    if (available < maxFrequency) {
      maxFrequency = available;
      bottleneck = detail;
    }
  }

  if (!Number.isFinite(maxFrequency)) maxFrequency = requested;
  if (!Number.isFinite(lineCapacity)) lineCapacity = maxFrequency;
  const effectiveFrequency = Math.max(0, Math.min(requested, maxFrequency));
  return {
    requestedFrequency: round2(requested),
    lineCapacity: round2(lineCapacity),
    maxFrequency: round2(maxFrequency),
    effectiveFrequency: round2(effectiveFrequency),
    constrained: effectiveFrequency + 0.001 < requested,
    bottleneck,
    segments: details
  };
}

function sillonStatsPayload(info) {
  if (!info) return null;
  return {
    requestedFrequency: round2(info.requestedFrequency || 0),
    lineCapacity: round2(info.lineCapacity ?? info.maxFrequency ?? 0),
    maxFrequency: round2(info.maxFrequency || 0),
    effectiveFrequency: round2(info.effectiveFrequency || 0),
    constrained: Boolean(info.constrained),
    bottleneck: info.bottleneck ? {
      key: info.bottleneck.key,
      from: info.bottleneck.from,
      to: info.bottleneck.to,
      fromName: info.bottleneck.fromName,
      toName: info.bottleneck.toName,
      capacity: round2(info.bottleneck.capacity || 0),
      usedByOthers: round2(info.bottleneck.usedByOthers || 0),
      totalUsed: round2(info.bottleneck.totalUsed || 0),
      available: round2(info.bottleneck.available || 0)
    } : null
  };
}

function buildInfrastructureUsage() {
  const usage = new Map();
  for (const player of activePlayers()) {
    for (const line of player.lines || []) {
      if (!line?.active) continue;
      for (const segment of lineSegments(line)) {
        const entry = usage.get(segment.key) || { distance: segment.distance, users: new Set(), entries: [] };
        entry.distance = Math.max(entry.distance || 0, segment.distance || 0);
        entry.users.add(player.id);
        entry.entries.push({ playerId: player.id, lineId: line.id });
        usage.set(segment.key, entry);
      }
    }
  }
  return usage;
}

function computeLineInfrastructureCost(player, line, multiplier = 1, infrastructureUsage = null) {
  const usage = infrastructureUsage || buildInfrastructureUsage();
  let total = 0;
  for (const segment of lineSegments(line)) {
    const entry = usage.get(segment.key);
    const sharedUsers = Math.max(1, entry?.users?.size || 1);
    total += segment.distance * ECONOMY.lineInfrastructureMaintenancePerKm * multiplier / sharedUsers;
  }
  return total;
}

function lineRouteInfo(line) {
  return routeBetweenStops(lineStops(line));
}

function lineStopsNames(stops) {
  return stops.map(id => stationById(id)?.name || id).join(' → ');
}

function routeDistanceForStopOrder(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
  let total = 0;
  for (let i = 1; i < ids.length; i++) total += distanceBetween(ids[i - 1], ids[i]);
  return total;
}

function bestIntermediateInsertIndex(stops, stopId) {
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.length < 2) return Math.max(0, ids.length - 1);
  let bestIndex = 0;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ids.length - 1; i++) {
    const before = ids[i];
    const after = ids[i + 1];
    const added = distanceBetween(before, stopId) + distanceBetween(stopId, after) - distanceBetween(before, after);
    if (added < bestCost) {
      bestCost = added;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function insertStopAtBestIntermediatePosition(stops, stopId) {
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.includes(stopId)) return ids;
  if (ids.length < 2) return [...ids, stopId];
  const index = bestIntermediateInsertIndex(ids, stopId);
  return [...ids.slice(0, index + 1), stopId, ...ids.slice(index + 1)];
}

function coherentStopOrder(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
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
    // On garde le premier arrêt, puis on cherche l’ordre le plus continu.
    // Exemple corrigé : Nantes → La Roche-sur-Yon → Montaigu devient
    // Nantes → Montaigu → La Roche-sur-Yon.
    visit([ids[0]], ids.slice(1));
  } else {
    let ordered = [ids[0]];
    const remaining = ids.slice(1);
    while (remaining.length) {
      let bestIndex = 0;
      let bestCost = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i++) {
        const d = distanceBetween(ordered[ordered.length - 1], remaining[i]);
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

function ensureStationAsset(player, stationId) {
  if (!player.stations || typeof player.stations !== 'object') player.stations = {};
  if (!player.stations[stationId]) player.stations[stationId] = { level: 1, depot: false, commerce: 0, maintenance: 0, electrified: false };
  return normalizeStationAsset(player, stationId);
}

function normalizeStationAsset(player, stationId) {
  const raw = player.stations[stationId] || {};
  const asset = {
    level: clamp(Math.floor(Number(raw.level || 1)), 1, 5),
    depot: Boolean(raw.depot),
    commerce: clamp(Math.floor(Number(raw.commerce || 0)), 0, 4),
    maintenance: clamp(Math.floor(Number(raw.maintenance || 0)), 0, 4),
    electrified: Boolean(raw.electrified)
  };
  player.stations[stationId] = asset;
  return asset;
}

function stationCapacityFactor(player, stationId) {
  const asset = player.stations[stationId];
  if (!asset) return 0.75;
  const techBoost = (hasTech(player, 'passenger_flow') ? 0.05 : 0) + (hasTech(player, 'intermodal_hubs') ? 0.04 : 0);
  return clamp(0.75 + asset.level * 0.1 + asset.maintenance * 0.025 + techBoost, 0.65, 1.45);
}


function averageCommerce(player, lineOrA, maybeB) {
  const ids = Array.isArray(lineOrA) ? lineOrA : (typeof lineOrA === 'object' && lineOrA?.id ? lineStops(lineOrA) : [lineOrA, maybeB]);
  const values = ids.map(id => player.stations[id]?.commerce || 0);
  return 1 + (values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length));
}

function averageStationLevel(player, lineOrA, maybeB) {
  const ids = Array.isArray(lineOrA) ? lineOrA : (typeof lineOrA === 'object' && lineOrA?.id ? lineStops(lineOrA) : [lineOrA, maybeB]);
  const values = ids.map(id => player.stations[id]?.level || 0);
  return values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
}

function lineStationFactor(player, line) {
  const ids = lineStops(line);
  const factors = ids.map(id => stationCapacityFactor(player, id));
  const minFactor = Math.min(...factors);
  const avgFactor = factors.reduce((sum, v) => sum + v, 0) / Math.max(1, factors.length);
  return clamp(minFactor * 0.65 + avgFactor * 0.35, 0.6, 1.4);
}

function techNodeById(nodeId) {
  for (const group of Object.values(BALANCE.techTree || {})) {
    const found = (group.nodes || []).find(n => n.id === nodeId);
    if (found) return found;
  }
  return null;
}

function totalMaintenance(player) {
  return Object.values(player.stations).reduce((sum, a) => sum + (a.maintenance || 0), 0);
}

function currentPriceMultiplier(player, energyType) {
  return 1 + Math.max(0, state.market.steel - 1) * 0.35 + (energyType === 'electricity' ? Math.max(0, state.market.electricity - 0.34) * 0.1 : 0);
}

function canPay(player, amount) {
  return player.cash >= amount;
}

function notify(player, text) {
  player.notifications.push({ day: state.day, text });
  player.notifications = player.notifications.slice(-40);
}

function ok(message = 'Action réalisée.') { return { ok: true, message }; }
function fail(error, hint = '') { return { ok: false, error, hint }; }

function scorePlayer(player) {
  return player.cash * 0.01 - player.debt * 0.006 + player.reputation * 800 + player.stats.passengers * 0.04 + player.stats.freightTons * 0.08 + player.lines.filter(l => l.active).length * 2000 + player.epoch * 45000;
}

function routeKey(from, to, service) {
  const sorted = [from, to].sort().join('-');
  const market = service === 'mixed' ? 'mixed' : service;
  return `${sorted}:${market}`;
}

function nearestStation(stationId, maxKm, preferredRegion) {
  const origin = stationById(stationId);
  if (!origin) return null;
  const candidates = WORLD.stations
    .filter(s => s.id !== stationId)
    .map(s => ({ ...s, dist: distanceBetween(stationId, s.id), sameRegion: s.region === preferredRegion }))
    .filter(s => s.dist <= maxKm || s.sameRegion)
    .sort((a, b) => (b.sameRegion - a.sameRegion) || a.dist - b.dist);
  return candidates[0] || null;
}

function stationById(id) {
  const canonical = currentStationId(id);
  return communeCache.byId?.[canonical] || communeCache.byId?.[id] || null;
}


function routeAdjacencyFor(a, b) {
  const adjacency = {};
  for (const [id, list] of Object.entries(WORLD.railAdjacency || {})) adjacency[id] = [...list];

  addLocalRouteShortcut(adjacency, a, b);

  for (const id of [a, b]) {
    if (!id || WORLD.stationIndex[id]) continue;
    const station = stationById(id);
    if (!station) continue;
    adjacency[id] ||= [];
    const anchors = nearestRailAnchorsForStation(station, station.commune ? 6 : 4);
    const stationPoint = stationRoutePoint(station) || stationRawPoint(station);
    const nearest = anchors.length
      ? anchors.map(anchorId => ({ id: anchorId }))
      : WORLD.stations
          .map(s => {
            const candidatePoint = stationRoutePoint(s) || stationRawPoint(s);
            return { id: s.id, d: candidatePoint && stationPoint ? haversine(stationPoint.lat, stationPoint.lon, candidatePoint.lat, candidatePoint.lon) : Infinity };
          })
          .sort((x, y) => x.d - y.d)
          .slice(0, station.commune ? 4 : 3);
    for (const n of nearest) {
      adjacency[id].push(n.id);
      (adjacency[n.id] ||= []).push(id);
    }
  }
  return adjacency;
}


function stationsShareProjectedRailSegment(a, b) {
  const pa = stationRailPlacement(stationById(a));
  const pb = stationRailPlacement(stationById(b));
  if (!pa || !pb) return false;
  if (pa.railSegment && pb.railSegment && pa.railSegment === pb.railSegment) return true;
  if (pa.stationUic && pb.stationUic && pa.stationUic === pb.stationUic) return true;
  return false;
}

function addLocalRouteShortcut(adjacency, a, b) {
  if (!a || !b || a === b) return;
  const sa = stationById(a);
  const sb = stationById(b);
  if (!sa || !sb) return;
  const direct = edgeDistance(a, b);
  if (!Number.isFinite(direct) || direct <= 0) return;
  const allowDirect = direct <= 45 || stationsShareProjectedRailSegment(a, b);
  if (!allowDirect) return;
  adjacency[a] ||= [];
  adjacency[b] ||= [];
  if (!adjacency[a].includes(b)) adjacency[a].push(b);
  if (!adjacency[b].includes(a)) adjacency[b].push(a);
}

const _routeCache = new Map();

function getRouteCache(key) {
  if (!_routeCache.has(key)) return null;
  const value = _routeCache.get(key);
  _routeCache.delete(key);
  _routeCache.set(key, value);
  return value;
}

function rememberRouteCache(key, route) {
  if (_routeCache.has(key)) _routeCache.delete(key);
  _routeCache.set(key, route);
  while (_routeCache.size > ROUTE_CACHE_MAX_ENTRIES) {
    const oldestKey = _routeCache.keys().next().value;
    _routeCache.delete(oldestKey);
  }
  return route;
}


function distanceBetween(a, b) {
  return routeBetween(a, b).distance;
}

function routeBetweenStops(stops) {
  const ids = sanitizeStopsPayload(stops, null, null);
  if (ids.length < 2) return { ids, distance: 0, maxSegment: 0 };
  const key = `multi::${ids.join('::')}`;
  const cached = getRouteCache(key);
  if (cached) return cached;

  let mergedIds = [ids[0]];
  let distance = 0;
  let maxSegment = 0;

  for (let i = 1; i < ids.length; i++) {
    const segment = routeBetween(ids[i - 1], ids[i]);
    distance += segment.distance || 0;
    maxSegment = Math.max(maxSegment, segment.maxSegment || 0);
    const segIds = segment.ids?.length ? segment.ids : [ids[i - 1], ids[i]];
    mergedIds.push(...segIds.slice(1));
  }

  const route = { ids: mergedIds, distance: Math.round(distance), maxSegment: Math.round(maxSegment) };
  return rememberRouteCache(key, route);
}

function routeBetween(a, b) {
  if (a === b) return { ids: [a], distance: 0, maxSegment: 0 };
  const key = `${a}::${b}`;
  const cached = getRouteCache(key);
  if (cached) return cached;
  const reverseKey = `${b}::${a}`;
  const reverse = getRouteCache(reverseKey);
  if (reverse) {
    const route = { ...reverse, ids: [...reverse.ids].reverse() };
    return rememberRouteCache(key, route);
  }

  const adjacency = routeAdjacencyFor(a, b);
  const nodes = new Set([...Object.keys(adjacency), a, b]);
  const dist = {};
  const prev = {};
  const visited = new Set();

  for (const n of nodes) dist[n] = Number.POSITIVE_INFINITY;
  dist[a] = 0;

  while (visited.size < nodes.size) {
    let u = null;
    let best = Number.POSITIVE_INFINITY;
    for (const n of nodes) {
      if (!visited.has(n) && dist[n] < best) {
        best = dist[n];
        u = n;
      }
    }
    if (!u || u === b || !Number.isFinite(best)) break;
    visited.add(u);

    for (const v of adjacency[u] || []) {
      if (visited.has(v)) continue;
      const alt = dist[u] + edgeDistance(u, v);
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
    while (prev[cur]) {
      cur = prev[cur];
      ids.push(cur);
    }
    ids.reverse();
  } else {
    ids = [a, b];
    dist[b] = edgeDistance(a, b);
  }

  const direct = edgeDistance(a, b);
  if (direct > 0 && Number.isFinite(dist[b]) && dist[b] > Math.max(35, direct * 2.35) && direct <= 85) {
    ids = [a, b];
    dist[b] = direct;
  }

  let maxSegment = 0;
  for (let i = 1; i < ids.length; i++) {
    maxSegment = Math.max(maxSegment, edgeDistance(ids[i - 1], ids[i]));
  }

  const route = {
    ids,
    distance: Math.round(dist[b] || 0),
    maxSegment: Math.round(maxSegment || 0)
  };
  return rememberRouteCache(key, route);
}

function effectiveTrainRange(player, model, routeInfo) {
  return Math.max(1, Math.round(Number(model?.range || 0)));
}

function edgeDistance(a, b) {
  const sa = stationRoutePoint(stationById(a));
  const sb = stationRoutePoint(stationById(b));
  if (!sa || !sb) return 0;
  return haversine(sa.lat, sa.lon, sb.lat, sb.lon);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function randomColor() {
  const colors = ['#60a5fa', '#f97316', '#22c55e', '#e879f9', '#f43f5e', '#facc15', '#14b8a6', '#a78bfa'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function sanitizeCompanyLogo(value) {
  const id = String(value || '').trim();
  return COMPANY_LOGOS.includes(id) ? id : COMPANY_LOGOS[0];
}

function validateColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : null;
}

function cleanText(value, max) {
  return String(value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) || 'Compagnie';
}

function cleanOptionalText(value, max) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) { return Math.round(value * 100) / 100; }
function roundCoord(value) { return Math.round(Number(value) * 1000000) / 1000000; }
function money(value) { return `${Math.round(value).toLocaleString('fr-FR')} €`; }
function formatCycles(value) {
  const cycles = Math.max(1, Math.ceil(Number(value || 1)));
  return cycles <= 1 ? '1 cycle' : `${cycles} cycles`;
}

function buildBalance() {
  const epochs = [
    { id: 0, name: 'Ère de la vapeur', year: 1850, requiredTech: 0, requiredTraffic: 0 },
    { id: 1, name: 'Ère du diesel', year: 1930, requiredTech: 4, requiredTraffic: 15000000 },
    { id: 2, name: 'Ère de l’électrique', year: 1950, requiredTech: 9, requiredTraffic: 75000000 },
    { id: 3, name: 'Ère de la grande vitesse', year: 1980, requiredTech: 17, requiredTraffic: 300000000 },
    { id: 4, name: 'Ère de l’hydrogène', year: 2025, requiredTech: 28, requiredTraffic: 1200000000 },
    { id: 5, name: 'Ère de la batterie', year: 2035, requiredTech: 42, requiredTraffic: 4000000000 },
    { id: 6, name: 'Ère de la sustentation magnétique', year: 2050, requiredTech: 58, requiredTraffic: 12000000000 }
  ];
  const trains = {
    steam_030_mixte: { id: 'steam_030_mixte', name: 'Locomotive vapeur 030 mixte', unlockEpoch: 0, type: 'Vapeur mixte', speed: 55, capacity: 140, freight: 120, energyType: 'coal', energy: 9.5, maintenance: 0.62, price: 95000, reliability: 0.78, comfort: 0.32, range: 50, description: 'Modèle de départ polyvalent, lent mais économique pour ouvrir les premières lignes.', requiredTech: 'steam_first_locomotives', requiredTechLevel: 1 },
    steam_120_omnibus: { id: 'steam_120_omnibus', name: 'Locomotive vapeur 120 omnibus', unlockEpoch: 0, type: 'Vapeur voyageurs', speed: 70, capacity: 210, freight: 60, energyType: 'coal', energy: 10.8, maintenance: 0.66, price: 135000, reliability: 0.75, comfort: 0.38, range: 75, description: 'Vapeur de desserte voyageurs, adaptée aux lignes régionales naissantes.', requiredTech: 'steam_first_locomotives', requiredTechLevel: 3 },
    steam_040_freight: { id: 'steam_040_freight', name: 'Locomotive vapeur 040 marchandises', unlockEpoch: 0, type: 'Vapeur fret', speed: 45, capacity: 40, freight: 360, energyType: 'coal', energy: 13.2, maintenance: 0.74, price: 155000, reliability: 0.8, comfort: 0.22, range: 90, description: 'Machine lente et tractrice pour les premiers trafics de marchandises.', requiredTech: 'steam_freight_locomotives', requiredTechLevel: 4 },
    steam_220_express: { id: 'steam_220_express', name: 'Locomotive vapeur 220 express', unlockEpoch: 0, type: 'Vapeur express', speed: 95, capacity: 300, freight: 80, energyType: 'coal', energy: 14.2, maintenance: 0.86, price: 235000, reliability: 0.79, comfort: 0.48, range: 125, description: 'Vapeur rapide pour les grands axes voyageurs de l’ère vapeur.', requiredTech: 'steam_passenger_locomotives', requiredTechLevel: 5 },
    steam_241_articulated: { id: 'steam_241_articulated', name: 'Locomotive vapeur articulée 241', unlockEpoch: 0, type: 'Vapeur lourde articulée', speed: 90, capacity: 420, freight: 520, energyType: 'coal', energy: 17.0, maintenance: 1.02, price: 390000, reliability: 0.82, comfort: 0.5, range: 150, description: 'Matériel vapeur lourd de fin d’ère, puissant mais coûteux à entretenir.', requiredTech: 'steam_articulated_locomotives', requiredTechLevel: 8 },

    diesel_shunter_030: { id: 'diesel_shunter_030', name: 'Locotracteur diesel de manœuvre', unlockEpoch: 1, type: 'Diesel manœuvre', speed: 70, capacity: 40, freight: 420, energyType: 'diesel', energy: 6.0, maintenance: 0.43, price: 310000, reliability: 0.83, comfort: 0.24, range: 125, description: 'Engin simple et fiable pour manœuvres, embranchements et fret court.', requiredTech: 'diesel_shunters', requiredTechLevel: 1 },
    diesel_light_railcar: { id: 'diesel_light_railcar', name: 'Autorail diesel léger', unlockEpoch: 1, type: 'Autorail diesel', speed: 110, capacity: 160, freight: 0, energyType: 'diesel', energy: 4.8, maintenance: 0.4, price: 420000, reliability: 0.86, comfort: 0.56, range: 150, description: 'Matériel économique pour lignes secondaires non électrifiées.', requiredTech: 'diesel_light_railcars', requiredTechLevel: 3 },
    diesel_mechanical_regional: { id: 'diesel_mechanical_regional', name: 'Automotrice diesel mécanique', unlockEpoch: 1, type: 'Diesel régional', speed: 125, capacity: 230, freight: 20, energyType: 'diesel', energy: 5.4, maintenance: 0.44, price: 650000, reliability: 0.87, comfort: 0.62, range: 175, description: 'Rame régionale diesel plus capacitaire, efficace hors caténaire.', requiredTech: 'diesel_mechanical', requiredTechLevel: 4 },
    diesel_hydraulic_express: { id: 'diesel_hydraulic_express', name: 'Locomotive diesel hydraulique voyageurs', unlockEpoch: 1, type: 'Diesel voyageurs', speed: 150, capacity: 430, freight: 120, energyType: 'diesel', energy: 7.2, maintenance: 0.56, price: 1150000, reliability: 0.88, comfort: 0.66, range: 210, description: 'Locomotive diesel rapide pour relations voyageurs sans électrification.', requiredTech: 'diesel_passenger_locomotives', requiredTechLevel: 6 },
    diesel_electric_freight: { id: 'diesel_electric_freight', name: 'Locomotive diesel-électrique fret', unlockEpoch: 1, type: 'Diesel-électrique fret', speed: 110, capacity: 0, freight: 950, energyType: 'diesel', energy: 8.8, maintenance: 0.58, price: 1450000, reliability: 0.9, comfort: 0.2, range: 250, description: 'Fret lourd non électrifié, performant sur longues distances.', requiredTech: 'diesel_freight_locomotives', requiredTechLevel: 8 },

    electric_pioneer_loco: { id: 'electric_pioneer_loco', name: 'Locomotive électrique pionnière', unlockEpoch: 2, type: 'Électrique pionnière', speed: 115, capacity: 260, freight: 180, energyType: 'electricity', energy: 6.4, maintenance: 0.55, price: 520000, reliability: 0.84, comfort: 0.5, range: 250, description: 'Premier matériel électrique polyvalent pour lignes équipées.', requiredTech: 'electric_first_trains', requiredTechLevel: 1 },
    electric_third_rail_emu: { id: 'electric_third_rail_emu', name: 'Automotrice troisième rail', unlockEpoch: 2, type: 'Électrique urbain', speed: 100, capacity: 520, freight: 0, energyType: 'electricity', energy: 5.2, maintenance: 0.42, price: 980000, reliability: 0.88, comfort: 0.56, range: 280, description: 'Rame dense pour dessertes urbaines et périurbaines électrifiées.', requiredTech: 'electric_third_rail', requiredTechLevel: 3 },
    electric_dc_regional_emu: { id: 'electric_dc_regional_emu', name: 'Automotrice courant continu régionale', unlockEpoch: 2, type: 'Électrique régionale', speed: 160, capacity: 430, freight: 0, energyType: 'electricity', energy: 5.6, maintenance: 0.38, price: 1250000, reliability: 0.91, comfort: 0.68, range: 320, description: 'Rame régionale performante sur réseau électrifié continu.', requiredTech: 'electric_dc_catenary', requiredTechLevel: 4 },
    electric_dual_current_loco: { id: 'electric_dual_current_loco', name: 'Locomotive bicourant multiservice', unlockEpoch: 2, type: 'Électrique bicourant', speed: 200, capacity: 520, freight: 520, energyType: 'electricity', energy: 8.2, maintenance: 0.64, price: 4200000, reliability: 0.92, comfort: 0.7, range: 360, description: 'Locomotive voyageurs/fret capable de passer entre réseaux électriques.', requiredTech: 'electric_dual_current_trains', requiredTechLevel: 6 },
    electric_heavy_freight: { id: 'electric_heavy_freight', name: 'Locomotive électrique fret lourd', unlockEpoch: 2, type: 'Fret électrique', speed: 140, capacity: 0, freight: 1450, energyType: 'electricity', energy: 9.5, maintenance: 0.62, price: 5100000, reliability: 0.93, comfort: 0.22, range: 400, description: 'Fret lourd électrifié avec très bonne fiabilité et coût énergétique bas.', requiredTech: 'electric_locomotives', requiredTechLevel: 8 },

    hsv_intercity_200: { id: 'hsv_intercity_200', name: 'Train rapide Intercités 200', unlockEpoch: 3, type: 'Train rapide', speed: 200, capacity: 560, freight: 60, energyType: 'electricity', energy: 7.2, maintenance: 0.5, price: 1800000, reliability: 0.9, comfort: 0.72, range: 350, description: 'Matériel de transition vers la grande vitesse, adapté aux grands axes classiques.', requiredTech: 'hsv_first_fast_trains', requiredTechLevel: 1 },
    hsv_trainset_pioneer: { id: 'hsv_trainset_pioneer', name: 'Rame grande vitesse première génération', unlockEpoch: 3, type: 'Grande vitesse', speed: 300, capacity: 690, freight: 0, energyType: 'electricity', energy: 13.5, maintenance: 1.1, price: 14500000, reliability: 0.93, comfort: 0.82, range: 450, description: 'Première rame très rapide, chère mais structurante pour les grands axes.', requiredTech: 'hsv_trainsets', requiredTechLevel: 3 },
    hsv_duplex_capacity: { id: 'hsv_duplex_capacity', name: 'Rame grande vitesse Duplex', unlockEpoch: 3, type: 'Grande vitesse haute capacité', speed: 320, capacity: 1030, freight: 0, energyType: 'electricity', energy: 15.2, maintenance: 1.25, price: 23000000, reliability: 0.94, comfort: 0.86, range: 550, description: 'Grande vitesse à très forte capacité pour axes saturés.', requiredTech: 'hsv_trainsets', requiredTechLevel: 5 },
    hsv_distributed_trainset: { id: 'hsv_distributed_trainset', name: 'Rame grande vitesse à traction répartie', unlockEpoch: 3, type: 'Grande vitesse avancée', speed: 330, capacity: 820, freight: 0, energyType: 'electricity', energy: 13.8, maintenance: 1.05, price: 26000000, reliability: 0.95, comfort: 0.87, range: 625, description: 'Rame de grande vitesse plus efficace grâce à la traction répartie.', requiredTech: 'hsv_distributed_traction', requiredTechLevel: 6 },
    hsv_premium_long_distance: { id: 'hsv_premium_long_distance', name: 'Rame grande distance premium', unlockEpoch: 3, type: 'Grande vitesse premium', speed: 320, capacity: 620, freight: 0, energyType: 'electricity', energy: 14.6, maintenance: 1.18, price: 28500000, reliability: 0.95, comfort: 0.94, range: 700, description: 'Matériel très confortable pour relations longues distances à forte marge.', requiredTech: 'hsv_premium_long_distance', requiredTechLevel: 8 },

    hydrogen_regional_unit: { id: 'hydrogen_regional_unit', name: 'Rame hydrogène régionale', unlockEpoch: 4, type: 'Hydrogène régional', speed: 140, capacity: 300, freight: 0, energyType: 'hydrogen', energy: 4.2, maintenance: 0.36, price: 6200000, reliability: 0.9, comfort: 0.76, range: 250, description: 'Rame propre pour lignes non électrifiées à autonomie correcte.', requiredTech: 'hydrogen_regional_trains', requiredTechLevel: 1 },
    hydrogen_fuel_cell_unit: { id: 'hydrogen_fuel_cell_unit', name: 'Rame hydrogène à pile combustible', unlockEpoch: 4, type: 'Hydrogène optimisé', speed: 150, capacity: 330, freight: 20, energyType: 'hydrogen', energy: 3.9, maintenance: 0.34, price: 7400000, reliability: 0.92, comfort: 0.78, range: 310, description: 'Chaîne hydrogène plus efficace et plus fiable pour dessertes régionales.', requiredTech: 'hydrogen_fuel_cell', requiredTechLevel: 3 },
    hydrogen_rural_unit: { id: 'hydrogen_rural_unit', name: 'Rame hydrogène lignes rurales', unlockEpoch: 4, type: 'Hydrogène rural', speed: 130, capacity: 220, freight: 30, energyType: 'hydrogen', energy: 3.4, maintenance: 0.3, price: 5600000, reliability: 0.91, comfort: 0.72, range: 350, description: 'Matériel sobre pour lignes peu denses et longues antennes rurales.', requiredTech: 'hydrogen_rural_lines', requiredTechLevel: 4 },
    hydrogen_long_range_unit: { id: 'hydrogen_long_range_unit', name: 'Rame hydrogène longue distance', unlockEpoch: 4, type: 'Hydrogène longue distance', speed: 170, capacity: 420, freight: 40, energyType: 'hydrogen', energy: 4.6, maintenance: 0.42, price: 9800000, reliability: 0.92, comfort: 0.82, range: 425, description: 'Autonomie élevée pour itinéraires non électrifiés de grande longueur.', requiredTech: 'hydrogen_long_distance_tanks', requiredTechLevel: 6 },
    hydrogen_next_gen_unit: { id: 'hydrogen_next_gen_unit', name: 'Rame hydrogène nouvelle génération', unlockEpoch: 4, type: 'Hydrogène avancé', speed: 180, capacity: 480, freight: 60, energyType: 'hydrogen', energy: 3.7, maintenance: 0.36, price: 13200000, reliability: 0.94, comfort: 0.84, range: 500, description: 'Hydrogène late game : propre, fiable et adapté aux longues relations régionales.', requiredTech: 'hydrogen_next_generation', requiredTechLevel: 8 },

    battery_suburban_unit: { id: 'battery_suburban_unit', name: 'Rame batterie périurbaine', unlockEpoch: 5, type: 'Batterie périurbaine', speed: 140, capacity: 380, freight: 0, energyType: 'battery', energy: 3.7, maintenance: 0.24, price: 5400000, reliability: 0.95, comfort: 0.82, range: 150, description: 'Rame à batterie pour courtes antennes non électrifiées autour des pôles urbains.', requiredTech: 'battery_suburban_trains', requiredTechLevel: 1 },
    battery_regional_unit: { id: 'battery_regional_unit', name: 'Rame batterie régionale', unlockEpoch: 5, type: 'Batterie régionale', speed: 160, capacity: 420, freight: 0, energyType: 'battery', energy: 3.9, maintenance: 0.25, price: 6900000, reliability: 0.95, comfort: 0.84, range: 220, description: 'Rame régionale à batterie pour lignes partiellement électrifiées.', requiredTech: 'battery_regional_trains', requiredTechLevel: 3 },
    battery_fast_charge_unit: { id: 'battery_fast_charge_unit', name: 'Rame batterie recharge rapide', unlockEpoch: 5, type: 'Batterie recharge rapide', speed: 160, capacity: 460, freight: 0, energyType: 'battery', energy: 3.6, maintenance: 0.26, price: 7600000, reliability: 0.94, comfort: 0.84, range: 280, description: 'Exploite les gares équipées pour réduire les temps de recharge.', requiredTech: 'battery_fast_station_charging', requiredTechLevel: 4 },
    battery_modular_unit: { id: 'battery_modular_unit', name: 'Rame batterie modulaire', unlockEpoch: 5, type: 'Batterie modulaire', speed: 165, capacity: 500, freight: 80, energyType: 'battery', energy: 3.8, maintenance: 0.23, price: 8600000, reliability: 0.96, comfort: 0.86, range: 340, description: 'Architecture modulaire, plus fiable et plus simple à adapter au service.', requiredTech: 'battery_modular', requiredTechLevel: 6 },
    battery_high_density_unit: { id: 'battery_high_density_unit', name: 'Rame batterie haute densité', unlockEpoch: 5, type: 'Batterie haute densité', speed: 180, capacity: 560, freight: 100, energyType: 'battery', energy: 3.5, maintenance: 0.24, price: 11800000, reliability: 0.96, comfort: 0.88, range: 400, description: 'Batterie avancée à forte autonomie, adaptée aux services régionaux ambitieux.', requiredTech: 'battery_high_density', requiredTechLevel: 8 },

    maglev_shuttle_pioneer: { id: 'maglev_shuttle_pioneer', name: 'Navette maglev pionnière', unlockEpoch: 6, type: 'Maglev pionnier', speed: 360, capacity: 420, freight: 0, energyType: 'electricity', energy: 10.5, maintenance: 0.88, price: 32000000, reliability: 0.9, comfort: 0.86, range: 650, description: 'Première navette à sustentation magnétique, très coûteuse mais très rapide.', requiredTech: 'maglev_levitation', requiredTechLevel: 1 },
    maglev_guided_regional: { id: 'maglev_guided_regional', name: 'Rame maglev guidée', unlockEpoch: 6, type: 'Maglev guidé', speed: 420, capacity: 520, freight: 0, energyType: 'electricity', energy: 10.8, maintenance: 0.82, price: 39000000, reliability: 0.93, comfort: 0.88, range: 850, description: 'Maglev plus fiable grâce au guidage magnétique maîtrisé.', requiredTech: 'maglev_guidance', requiredTechLevel: 3 },
    maglev_linear_express: { id: 'maglev_linear_express', name: 'Maglev express linéaire', unlockEpoch: 6, type: 'Maglev express', speed: 500, capacity: 600, freight: 0, energyType: 'electricity', energy: 11.5, maintenance: 0.9, price: 52000000, reliability: 0.94, comfort: 0.9, range: 1050, description: 'Propulsion linéaire pour liaisons express à très haute vitesse.', requiredTech: 'maglev_linear_propulsion', requiredTechLevel: 4 },
    maglev_metropolitan_express: { id: 'maglev_metropolitan_express', name: 'Maglev express métropolitain', unlockEpoch: 6, type: 'Maglev métropolitain', speed: 520, capacity: 760, freight: 0, energyType: 'electricity', energy: 12.4, maintenance: 0.92, price: 68000000, reliability: 0.95, comfort: 0.91, range: 1250, description: 'Très forte capacité pour liaisons express entre métropoles.', requiredTech: 'maglev_metro_express_links', requiredTechLevel: 6 },
    maglev_next_gen_unit: { id: 'maglev_next_gen_unit', name: 'Maglev nouvelle génération', unlockEpoch: 6, type: 'Maglev nouvelle génération', speed: 600, capacity: 820, freight: 60, energyType: 'electricity', energy: 10.9, maintenance: 0.78, price: 92000000, reliability: 0.97, comfort: 0.95, range: 1500, description: 'Matériel ultime de très late game : vitesse extrême, confort et fiabilité.', requiredTech: 'maglev_next_generation', requiredTechLevel: 8 }
  };
  const staff = {
    drivers: { label: 'Conducteur', salary: 4300, hireCost: 9000 },
    controllers: { label: 'Contrôleur', salary: 3300, hireCost: 6500 },
    stationAgents: { label: 'Agent de gare', salary: 3100, hireCost: 5200 },
    mechanics: { label: 'Mainteneur', salary: 3700, hireCost: 7200 },
    dispatchers: { label: 'Régulateur', salary: 4600, hireCost: 10500 },
    engineers: { label: 'Agent de l’infra', salary: 5600, hireCost: 14000 }
  };
  const energyStrategies = {
    spot: { name: 'Marché spot', defaultMultiplier: 1, multiplier: {} },
    stable: { name: 'Contrat stable', defaultMultiplier: 1.08, multiplier: { diesel: 1.03, electricity: 1.04, coal: 1.05, hydrogen: 1.04, battery: 1.04 } },
    cheap: { name: 'Achat opportuniste', defaultMultiplier: 0.92, multiplier: { diesel: 0.93, electricity: 0.94, coal: 0.9, hydrogen: 0.98, battery: 0.96 } },
    green: { name: 'Énergie bas carbone', defaultMultiplier: 1.16, multiplier: { electricity: 1.08, hydrogen: 1.1, battery: 1.07, diesel: 1.25, coal: 1.35 } }
  };
  const maintenancePolicies = {
    economy: { id: 'economy', name: 'Économie', description: 'Coûts bas, usure accélérée et fiabilité plus faible.', costMultiplier: 0.82, wearMultiplier: 1.22, reliabilityBonus: -0.025 },
    standard: { id: 'standard', name: 'Standard', description: 'Équilibre entre coût, usure et disponibilité.', costMultiplier: 1.0, wearMultiplier: 1.0, reliabilityBonus: 0 },
    preventive: { id: 'preventive', name: 'Préventive', description: 'Plus chère, mais réduit l’usure et les retards.', costMultiplier: 1.18, wearMultiplier: 0.78, reliabilityBonus: 0.018 },
    intensive: { id: 'intensive', name: 'Intensive', description: 'Très chère, adaptée au matériel stratégique et aux lignes fortes.', costMultiplier: 1.38, wearMultiplier: 0.62, reliabilityBonus: 0.035 }
  };

  const maintenanceActions = {
    light: { id: 'light', name: 'Révision légère', description: 'Intervention courte. Remonte légèrement l’état.', baseCost: 4500, priceFactor: 0.018, restore: 0.18, target: 0.82, days: 1, requiresDepot: false },
    standard: { id: 'standard', name: 'Révision atelier', description: 'Remise à niveau solide. Demande un atelier ou dépôt.', baseCost: 12000, priceFactor: 0.045, restore: 0.38, target: 0.92, days: 3, requiresDepot: true },
    heavy: { id: 'heavy', name: 'Grande révision', description: 'Réparation lourde pour matériel très usé.', baseCost: 32000, priceFactor: 0.085, restore: 0.62, target: 0.98, days: 6, requiresDepot: true, requiredTech: 'steam_workshops' },
    refurbish: { id: 'refurbish', name: 'Rénovation complète', description: 'Très coûteux, mais remet presque à neuf.', baseCost: 70000, priceFactor: 0.13, restore: 0.9, target: 1, days: 10, requiresDepot: true, requiredTech: 'electric_standardized_maintenance' }
  };

  for (const model of Object.values(trains)) {
    model.compositionSpec = compositionSpecForModel(model);
  }
  const techTree = buildTechTree();

  return {
    epochs,
    trains,
    staff,
    techLabels: {
      traction: 'Traction',
      energy: 'Énergie',
      operations: 'Exploitation',
      stations: 'Gares',
      social: 'Social',
      freight: 'Fret'
    },
    energyStrategies,
    maintenancePolicies,
    maintenanceActions,
    techTree,
    public: { epochs, trains, staff, energyStrategies, maintenancePolicies, maintenanceActions, techTree, economy: {
      researchLabBaseCost: ECONOMY.researchLabBaseCost,
      stationLevelCost: ECONOMY.stationLevelCost,
      stationCommerceCost: ECONOMY.stationCommerceCost,
      stationMaintenanceCost: ECONOMY.stationMaintenanceCost,
      stationDepotCost: ECONOMY.stationDepotCost,
      stationAccessTollBase: ECONOMY.stationAccessTollBase,
      stationAccessTollCapacityFactor: ECONOMY.stationAccessTollCapacityFactor
    }, techLabels: {
      traction: 'Traction',
      energy: 'Énergie',
      operations: 'Exploitation',
      stations: 'Gares',
      social: 'Social',
      freight: 'Fret'
    } }
  };
}


function buildTechTree() {
  const groups = {
    traction: { id: 'traction', label: 'Traction', description: 'Matériels roulants, chaînes de traction, vitesse et types de trains.', nodes: [] },
    energy: { id: 'energy', label: 'Énergie', description: 'Alimentation, carburants, stockage, recharge, autonomie et consommation.', nodes: [] },
    maintenance: { id: 'maintenance', label: 'Maintenance', description: 'Dépôts, ateliers, freinage, fiabilité, sécurité et standardisation.', nodes: [] },
    operations: { id: 'operations', label: 'Exploitation', description: 'Signalisation, régulation, débit et ponctualité.', nodes: [] },
    stations: { id: 'stations', label: 'Gares', description: 'Capacité, services voyageurs, hubs et immobilier ferroviaire.', nodes: [] },
    freight: { id: 'freight', label: 'Fret', description: 'Wagons, contrats, terminaux et corridors logistiques.', nodes: [] },
    social: { id: 'social', label: 'RH', description: 'Formation, sécurité, productivité et organisation humaine.', nodes: [] }
  };

  const add = (group, id, title, description, requiredEpoch, prereq, unlocks, improves, options = {}) => {
    groups[group].nodes.push({
      id,
      branch: options.branch || group,
      title,
      description,
      requiredEpoch,
      prereq,
      unlocks,
      improves,
      effects: [...(unlocks || []), ...(improves || [])],
      maxLevel: options.maxLevel ?? 0,
      baseCostMoney: options.baseCostMoney || 45000 + requiredEpoch * 65000,
      baseDurationSeconds: options.baseDurationSeconds,
      costGrowth: options.costGrowth || 1.62,
      durationGrowth: options.durationGrowth || 1.48,
      levelValue: options.levelValue || 1,
      levelPrereq: options.levelPrereq || [],
      era: options.era || null,
      eraLabel: options.eraLabel || '',
      infiniteScaling: options.infiniteScaling ?? null,
      disableAutoLevelEffect: Boolean(options.disableAutoLevelEffect)
    });
  };


  // Arbre Traction refondu depuis le document utilisateur : 7 ères ferroviaires avec dépendances par niveaux.
  add('traction', "steam_first_locomotives", "Premières locomotives à vapeur", "Ère 1 — Train à vapeur. Effets : +0,5% portée, +0,3% vitesse max.", 0, [], [], ["+0,5% portée", "+0,3% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_improved_boilers", "Chaudières améliorées", "Ère 1 — Train à vapeur. Effets : +0,8% vitesse max, -0,4% consommation.", 0, [{"id": "steam_first_locomotives", "level": 3}], [], ["+0,8% vitesse max", "-0,4% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_coal_water_reserves", "Réserves de charbon et d’eau", "Ère 1 — Train à vapeur. Effets : +1,2% portée.", 0, [{"id": "steam_first_locomotives", "level": 3}], [], ["+1,2% portée", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "steam_depots", "Dépôts vapeur", "Ère 1 — Train à vapeur. Effets : +1% portée, +0,4% fiabilité.", 0, [{"id": "steam_coal_water_reserves", "level": 3}], [], ["+1% portée", "+0,4% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "steam_passenger_locomotives", "Locomotives voyageurs vapeur", "Ère 1 — Train à vapeur. Effets : +1% vitesse max, +0,5% rentabilité.", 0, [{"id": "steam_improved_boilers", "level": 4}], ["Locomotive vapeur 220 express"], ["+1% vitesse max", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "steam_freight_locomotives", "Locomotives marchandises vapeur", "Ère 1 — Train à vapeur. Effets : +0,6% rentabilité, +0,5% fiabilité.", 0, [{"id": "steam_improved_boilers", "level": 4}], ["Locomotive vapeur 040 marchandises"], ["+0,6% rentabilité", "+0,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_economized", "Vapeur économisée", "Ère 1 — Train à vapeur. Effets : -0,8% consommation, +0,6% rentabilité.", 0, [{"id": "steam_improved_boilers", "level": 5}], [], ["-0,8% consommation", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_superheated", "Vapeur surchauffée", "Ère 1 — Train à vapeur. Effets : +1% vitesse max, -0,6% consommation, +0,4% fiabilité.", 0, [{"id": "steam_economized", "level": 5}], [], ["+1% vitesse max", "-0,6% consommation", "+0,4% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "steam_articulated_locomotives", "Locomotives articulées", "Ère 1 — Train à vapeur. Effets : +0,8% portée, +0,6% rentabilité.", 0, [{"id": "steam_freight_locomotives", "level": 5}, {"id": "steam_superheated", "level": 3}], ["Locomotive vapeur articulée 241"], ["+0,8% portée", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "steam_reinforced_brakes", "Freins renforcés", "Ère 1 — Train à vapeur. Effets : +0,4% vitesse max, +0,8% fiabilité.", 0, [{"id": "steam_passenger_locomotives", "level": 3}, {"id": "steam_freight_locomotives", "level": 3}], [], ["+0,4% vitesse max", "+0,8% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "steam_workshops", "Ateliers vapeur", "Ère 1 — Train à vapeur. Effets : +1% fiabilité, +0,5% rentabilité.", 0, [{"id": "steam_depots", "level": 5}], [], ["+1% fiabilité", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "steam_oil_fired", "Vapeur au fuel", "Ère 1 — Train à vapeur. Effets : -0,7% consommation, +0,6% fiabilité, -0,4% impact environnemental.", 0, [{"id": "steam_superheated", "level": 5}, {"id": "steam_workshops", "level": 5}], [], ["-0,7% consommation", "+0,6% fiabilité", "-0,4% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 1, "eraLabel": "Train à vapeur", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_first_engines", "Premiers moteurs diesel", "Ère 2 — Train diesel. Effets : +0,8% portée, +0,5% fiabilité, -0,5% consommation.", 1, [{"id": "steam_workshops", "level": 5}, {"id": "steam_economized", "level": 5}], ["Autorail diesel léger"], ["+0,8% portée", "+0,5% fiabilité", "-0,5% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_light_railcars", "Autorails légers", "Ère 2 — Train diesel. Effets : -1% consommation, +0,8% rentabilité.", 1, [{"id": "diesel_first_engines", "level": 3}], ["Autorail diesel léger", "Automotrice diesel mécanique"], ["-1% consommation", "+0,8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_shunters", "Locomotives de manœuvre diesel", "Ère 2 — Train diesel. Effets : +0,6% fiabilité, +0,5% rentabilité.", 1, [{"id": "diesel_first_engines", "level": 3}], ["Locotracteur diesel de manœuvre"], ["+0,6% fiabilité", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "diesel_long_range_tanks", "Réservoirs grande autonomie", "Ère 2 — Train diesel. Effets : +1,5% portée.", 1, [{"id": "diesel_first_engines", "level": 4}], [], ["+1,5% portée", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "diesel_fuel_depots", "Dépôts carburant", "Ère 2 — Train diesel. Effets : +1% portée, +0,5% fiabilité.", 1, [{"id": "diesel_long_range_tanks", "level": 3}], [], ["+1% portée", "+0,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_mechanical", "Diesel mécanique", "Ère 2 — Train diesel. Effets : +0,5% fiabilité, +0,4% rentabilité.", 1, [{"id": "diesel_first_engines", "level": 5}], ["Automotrice diesel mécanique"], ["+0,5% fiabilité", "+0,4% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_hydraulic", "Diesel hydraulique", "Ère 2 — Train diesel. Effets : +0,7% vitesse max, -0,4% consommation.", 1, [{"id": "diesel_mechanical", "level": 5}], [], ["+0,7% vitesse max", "-0,4% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_electric", "Diesel-électrique", "Ère 2 — Train diesel. Effets : +0,8% fiabilité, -0,6% consommation, +0,5% rentabilité.", 1, [{"id": "diesel_mechanical", "level": 5}, {"id": "diesel_shunters", "level": 3}], [], ["+0,8% fiabilité", "-0,6% consommation", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_passenger_locomotives", "Locomotives diesel voyageurs", "Ère 2 — Train diesel. Effets : +0,8% vitesse max, +0,6% rentabilité.", 1, [{"anyOf": [{"id": "diesel_hydraulic", "level": 4}, {"id": "diesel_electric", "level": 4}]}], ["Locomotive diesel hydraulique voyageurs"], ["+0,8% vitesse max", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_freight_locomotives", "Locomotives diesel fret", "Ère 2 — Train diesel. Effets : +1% rentabilité, +0,5% fiabilité.", 1, [{"id": "diesel_electric", "level": 5}], ["Locomotive diesel-électrique fret"], ["+1% rentabilité", "+0,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "diesel_multiple_units", "Unités multiples diesel", "Ère 2 — Train diesel. Effets : +0,7% vitesse max, +0,6% fiabilité.", 1, [{"id": "diesel_passenger_locomotives", "level": 5}, {"id": "diesel_electric", "level": 3}], [], ["+0,7% vitesse max", "+0,6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "diesel_modern", "Diesel moderne", "Ère 2 — Train diesel. Effets : -1% consommation, -0,8% impact environnemental, +0,8% rentabilité.", 1, [{"id": "diesel_electric", "level": 8}, {"id": "diesel_fuel_depots", "level": 5}], [], ["-1% consommation", "-0,8% impact environnemental", "+0,8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 2, "eraLabel": "Train diesel", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_first_trains", "Premiers trains électriques", "Ère 3 — Train électrique. Effets : +0,8% vitesse max, -0,8% consommation, -1% impact environnemental.", 2, [{"anyOf": [{"id": "steam_workshops", "level": 5}, {"id": "diesel_first_engines", "level": 5}]}], ["Locomotive électrique pionnière"], ["+0,8% vitesse max", "-0,8% consommation", "-1% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_third_rail", "Troisième rail", "Ère 3 — Train électrique. Effets : +0,6% rentabilité, +0,5% fiabilité.", 2, [{"id": "electric_first_trains", "level": 3}], ["Automotrice troisième rail"], ["+0,6% rentabilité", "+0,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_dc_catenary", "Caténaire à courant continu", "Ère 3 — Train électrique. Effets : +0,8% portée, -0,6% consommation.", 2, [{"id": "electric_third_rail", "level": 5}], [], ["+0,8% portée", "-0,6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_ac_catenary", "Caténaire à courant alternatif monophasé", "Ère 3 — Train électrique. Effets : +1,2% portée, -0,8% consommation.", 2, [{"id": "electric_dc_catenary", "level": 8}], [], ["+1,2% portée", "-0,8% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_substations", "Sous-stations électriques", "Ère 3 — Train électrique. Effets : +0,8% fiabilité, -0,5% consommation.", 2, [{"id": "electric_dc_catenary", "level": 5}], [], ["+0,8% fiabilité", "-0,5% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_emus", "Automotrices électriques", "Ère 3 — Train électrique. Effets : +1% vitesse max, +0,6% rentabilité.", 2, [{"id": "electric_third_rail", "level": 5}, {"id": "electric_improved_motors", "level": 3}], ["Automotrice courant continu régionale"], ["+1% vitesse max", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_locomotives", "Locomotives électriques", "Ère 3 — Train électrique. Effets : +0,8% vitesse max, +0,7% rentabilité.", 2, [{"id": "electric_dc_catenary", "level": 5}, {"id": "electric_substations", "level": 3}], ["Locomotive bicourant multiservice", "Locomotive électrique fret lourd"], ["+0,8% vitesse max", "+0,7% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_improved_motors", "Moteurs électriques améliorés", "Ère 3 — Train électrique. Effets : +0,8% vitesse max, -0,6% consommation, +0,5% fiabilité.", 2, [{"id": "electric_first_trains", "level": 5}], [], ["+0,8% vitesse max", "-0,6% consommation", "+0,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_electronic_control", "Commande électronique de traction", "Ère 3 — Train électrique. Effets : -0,8% consommation, +0,6% fiabilité.", 2, [{"id": "electric_improved_motors", "level": 5}], [], ["-0,8% consommation", "+0,6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "electric_braking", "Freinage électrique", "Ère 3 — Train électrique. Effets : -0,5% consommation, +0,8% fiabilité.", 2, [{"id": "electric_electronic_control", "level": 3}], [], ["-0,5% consommation", "+0,8% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('energy', "electric_energy_recovery", "Récupération d’énergie", "Ère 3 — Train électrique. Effets : -1% consommation, +0,8% rentabilité, -0,6% impact environnemental.", 2, [{"id": "electric_braking", "level": 5}, {"id": "electric_substations", "level": 5}], [], ["-1% consommation", "+0,8% rentabilité", "-0,6% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_dual_current_trains", "Trains bicourants", "Ère 3 — Train électrique. Effets : +1% portée, +0,6% rentabilité.", 2, [{"id": "electric_dc_catenary", "level": 8}, {"id": "electric_ac_catenary", "level": 5}], ["Locomotive bicourant multiservice"], ["+1% portée", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "electric_multi_current_trains", "Trains multicourants", "Ère 3 — Train électrique. Effets : +1,5% portée, +0,8% rentabilité.", 2, [{"id": "electric_dual_current_trains", "level": 8}], [], ["+1,5% portée", "+0,8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "electric_antislip", "Antipatinage automatique", "Ère 3 — Train électrique. Effets : +1% fiabilité, +0,4% vitesse max.", 2, [{"id": "electric_electronic_control", "level": 5}], [], ["+1% fiabilité", "+0,4% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('maintenance', "electric_standardized_maintenance", "Maintenance électrique standardisée", "Ère 3 — Train électrique. Effets : +1% fiabilité, +0,6% rentabilité.", 2, [{"id": "electric_locomotives", "level": 5}, {"id": "electric_emus", "level": 5}], [], ["+1% fiabilité", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 3, "eraLabel": "Train électrique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true});
  add('traction', "hsv_first_fast_trains", "Premiers trains rapides", "Ère 4 — Train à grande vitesse. Effets : +1,2% vitesse max, +0,6% rentabilité.", 3, [{"anyOf": [{"id": "steam_passenger_locomotives", "level": 8}, {"id": "diesel_passenger_locomotives", "level": 8}, {"id": "electric_locomotives", "level": 5}]}], ["Train rapide Intercités 200"], ["+1,2% vitesse max", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_aerodynamics", "Aérodynamique ferroviaire", "Ère 4 — Train à grande vitesse. Effets : +1% vitesse max, -0,8% consommation.", 3, [{"id": "hsv_first_fast_trains", "level": 5}], [], ["+1% vitesse max", "-0,8% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_lightweight_materials", "Matériel allégé", "Ère 4 — Train à grande vitesse. Effets : +0,8% vitesse max, -0,6% consommation.", 3, [{"id": "hsv_first_fast_trains", "level": 5}], [], ["+0,8% vitesse max", "-0,6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('maintenance', "hsv_high_speed_braking", "Freinage haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +0,8% vitesse max, +1% fiabilité.", 3, [{"anyOf": [{"id": "steam_reinforced_brakes", "level": 8}, {"id": "electric_braking", "level": 5}]}], [], ["+0,8% vitesse max", "+1% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_adapted_tracks", "Voies adaptées à la grande vitesse", "Ère 4 — Train à grande vitesse. Effets : +1,5% vitesse max, +0,8% rentabilité.", 3, [{"id": "hsv_aerodynamics", "level": 5}, {"id": "hsv_high_speed_braking", "level": 5}], [], ["+1,5% vitesse max", "+0,8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('energy', "hsv_catenary", "Caténaire haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +1% vitesse max, -0,6% consommation.", 3, [{"id": "electric_ac_catenary", "level": 8}, {"id": "electric_substations", "level": 8}], [], ["+1% vitesse max", "-0,6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_trainsets", "Rames à grande vitesse", "Ère 4 — Train à grande vitesse. Effets : +1,8% vitesse max, +1% rentabilité.", 3, [{"id": "hsv_adapted_tracks", "level": 5}, {"id": "hsv_catenary", "level": 5}], ["Rame grande vitesse première génération"], ["+1,8% vitesse max", "+1% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('energy', "hsv_high_power_onboard", "Puissance embarquée élevée", "Ère 4 — Train à grande vitesse. Effets : +1,2% vitesse max, -0,5% consommation.", 3, [{"id": "hsv_trainsets", "level": 5}, {"id": "electric_improved_motors", "level": 8}], [], ["+1,2% vitesse max", "-0,5% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_stability", "Stabilité à haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +0,8% vitesse max, +1% fiabilité.", 3, [{"id": "hsv_aerodynamics", "level": 8}, {"id": "hsv_lightweight_materials", "level": 5}], [], ["+0,8% vitesse max", "+1% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_signaling", "Signalisation haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +1% vitesse max, +0,8% fiabilité.", 3, [{"id": "hsv_adapted_tracks", "level": 8}], [], ["+1% vitesse max", "+0,8% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_distributed_traction", "Traction répartie haute vitesse", "Ère 4 — Train à grande vitesse. Effets : +0,8% vitesse max, -0,6% consommation, +0,6% fiabilité.", 3, [{"id": "hsv_trainsets", "level": 8}, {"id": "electric_electronic_control", "level": 8}], ["Rame grande vitesse Duplex"], ["+0,8% vitesse max", "-0,6% consommation", "+0,6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hsv_premium_long_distance", "Services grande distance premium", "Ère 4 — Train à grande vitesse. Effets : +1,2% rentabilité.", 3, [{"id": "hsv_trainsets", "level": 5}, {"id": "hsv_stability", "level": 5}], ["Rame grande distance premium"], ["+1,2% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 4, "eraLabel": "Train à grande vitesse", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 520000, "baseDurationSeconds": 350});
  add('traction', "hydrogen_first_trains", "Premiers trains à hydrogène", "Ère 5 — Train à hydrogène. Effets : +0,8% portée, -1,2% impact environnemental.", 4, [{"id": "diesel_modern", "level": 5}, {"id": "electric_electronic_control", "level": 5}], ["Rame hydrogène régionale"], ["+0,8% portée", "-1,2% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_fuel_cell", "Pile à combustible ferroviaire", "Ère 5 — Train à hydrogène. Effets : -0,8% consommation, +0,6% fiabilité.", 4, [{"id": "hydrogen_first_trains", "level": 3}], ["Rame hydrogène à pile combustible"], ["-0,8% consommation", "+0,6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_secure_tanks", "Réservoirs hydrogène sécurisés", "Ère 5 — Train à hydrogène. Effets : +1,2% portée, +0,6% fiabilité.", 4, [{"id": "hydrogen_first_trains", "level": 3}], [], ["+1,2% portée", "+0,6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_refueling_stations", "Stations de ravitaillement hydrogène", "Ère 5 — Train à hydrogène. Effets : +1,5% portée, +0,5% rentabilité.", 4, [{"id": "hydrogen_secure_tanks", "level": 5}], [], ["+1,5% portée", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_green", "Hydrogène vert", "Ère 5 — Train à hydrogène. Effets : -1,5% impact environnemental, +0,5% rentabilité.", 4, [{"id": "hydrogen_refueling_stations", "level": 5}], [], ["-1,5% impact environnemental", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('maintenance', "hydrogen_specialized_maintenance", "Maintenance hydrogène spécialisée", "Ère 5 — Train à hydrogène. Effets : +1% fiabilité, +0,5% rentabilité.", 4, [{"id": "hydrogen_fuel_cell", "level": 5}], [], ["+1% fiabilité", "+0,5% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('traction', "hydrogen_regional_trains", "Trains régionaux hydrogène", "Ère 5 — Train à hydrogène. Effets : +0,8% portée, +0,6% rentabilité.", 4, [{"id": "hydrogen_fuel_cell", "level": 5}, {"id": "hydrogen_refueling_stations", "level": 3}], ["Rame hydrogène régionale"], ["+0,8% portée", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_optimized_energy_recharge", "Recharge énergétique optimisée", "Ère 5 — Train à hydrogène. Effets : -0,8% consommation, +0,8% rentabilité.", 4, [{"id": "hydrogen_fuel_cell", "level": 8}], [], ["-0,8% consommation", "+0,8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('maintenance', "hydrogen_enhanced_safety", "Sécurité hydrogène renforcée", "Ère 5 — Train à hydrogène. Effets : +1,2% fiabilité.", 4, [{"id": "hydrogen_secure_tanks", "level": 8}], [], ["+1,2% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_long_distance_tanks", "Réservoirs longue distance", "Ère 5 — Train à hydrogène. Effets : +1,8% portée.", 4, [{"id": "hydrogen_secure_tanks", "level": 8}, {"id": "hydrogen_enhanced_safety", "level": 5}], ["Rame hydrogène longue distance"], ["+1,8% portée", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('traction', "hydrogen_rural_lines", "Hydrogène pour lignes rurales", "Ère 5 — Train à hydrogène. Effets : +1% rentabilité, -0,8% impact environnemental.", 4, [{"id": "hydrogen_regional_trains", "level": 5}], [], ["+1% rentabilité", "-0,8% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('energy', "hydrogen_next_generation", "Hydrogène nouvelle génération", "Ère 5 — Train à hydrogène. Effets : +1,2% portée, -1% consommation, -1% impact environnemental.", 4, [{"id": "hydrogen_green", "level": 8}, {"id": "hydrogen_fuel_cell", "level": 8}, {"id": "hydrogen_enhanced_safety", "level": 5}], ["Rame hydrogène nouvelle génération"], ["+1,2% portée", "-1% consommation", "-1% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 5, "eraLabel": "Train à hydrogène", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 745000, "baseDurationSeconds": 415});
  add('traction', "battery_first_trains", "Premiers trains à batterie", "Ère 6 — Train à batterie. Effets : +1% autonomie, -1,5% impact environnemental.", 5, [{"id": "electric_energy_recovery", "level": 5}, {"id": "electric_electronic_control", "level": 5}], ["Rame batterie périurbaine"], ["+1% autonomie", "-1,5% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_railway_batteries", "Batteries ferroviaires", "Ère 6 — Train à batterie. Effets : +1,2% autonomie, +0,5% fiabilité.", 5, [{"id": "battery_first_trains", "level": 3}], [], ["+1,2% autonomie", "+0,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_catenary_charging", "Recharge sous caténaire", "Ère 6 — Train à batterie. Effets : +1% autonomie, -0,6% consommation.", 5, [{"id": "battery_railway_batteries", "level": 3}, {"id": "electric_ac_catenary", "level": 5}], [], ["+1% autonomie", "-0,6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_fast_station_charging", "Recharge rapide en gare", "Ère 6 — Train à batterie. Effets : +0,8% autonomie, +0,6% rentabilité.", 5, [{"id": "battery_railway_batteries", "level": 5}, {"id": "electric_substations", "level": 5}], ["Rame batterie recharge rapide"], ["+0,8% autonomie", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_long_range", "Batteries longue autonomie", "Ère 6 — Train à batterie. Effets : +1,8% autonomie.", 5, [{"id": "battery_railway_batteries", "level": 8}], [], ["+1,8% autonomie", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('maintenance', "battery_thermal_management", "Gestion thermique des batteries", "Ère 6 — Train à batterie. Effets : +1% fiabilité, +0,6% autonomie.", 5, [{"id": "battery_railway_batteries", "level": 5}], [], ["+1% fiabilité", "+0,6% autonomie", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_brake_energy_recovery", "Récupération d’énergie au freinage", "Ère 6 — Train à batterie. Effets : +1% autonomie, -0,8% consommation.", 5, [{"id": "electric_energy_recovery", "level": 8}, {"id": "battery_railway_batteries", "level": 5}], [], ["+1% autonomie", "-0,8% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('traction', "battery_suburban_trains", "Trains périurbains à batterie", "Ère 6 — Train à batterie. Effets : +0,8% rentabilité, -0,8% impact environnemental.", 5, [{"id": "battery_fast_station_charging", "level": 5}, {"id": "battery_thermal_management", "level": 3}], ["Rame batterie périurbaine"], ["+0,8% rentabilité", "-0,8% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('traction', "battery_regional_trains", "Trains régionaux à batterie", "Ère 6 — Train à batterie. Effets : +1,2% autonomie, +0,6% rentabilité.", 5, [{"id": "battery_long_range", "level": 5}, {"id": "battery_catenary_charging", "level": 5}], ["Rame batterie régionale"], ["+1,2% autonomie", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('maintenance', "battery_modular", "Batteries modulaires", "Ère 6 — Train à batterie. Effets : +0,8% fiabilité, +0,6% rentabilité.", 5, [{"id": "battery_thermal_management", "level": 5}], ["Rame batterie modulaire"], ["+0,8% fiabilité", "+0,6% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_auto_charge_optimization", "Optimisation automatique de charge", "Ère 6 — Train à batterie. Effets : -1% consommation, +0,8% autonomie.", 5, [{"id": "battery_modular", "level": 5}, {"id": "electric_electronic_control", "level": 8}], [], ["-1% consommation", "+0,8% autonomie", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('energy', "battery_high_density", "Batteries haute densité", "Ère 6 — Train à batterie. Effets : +2% autonomie, +0,6% vitesse max.", 5, [{"id": "battery_long_range", "level": 8}, {"id": "battery_thermal_management", "level": 8}], ["Rame batterie haute densité"], ["+2% autonomie", "+0,6% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 6, "eraLabel": "Train à batterie", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 800000, "baseDurationSeconds": 480});
  add('traction', "maglev_levitation", "Sustentation magnétique", "Ère 7 — Train à sustentation magnétique. Effets : +2% vitesse max, -0,8% consommation. Note : Si le moteur du jeu ne permet pas de dépendre d’une recherche située plus bas, remplacer par : Rames à grande vitesse niveau 8 + Caténaire haute vitesse niveau 8.", 6, [{"id": "hsv_trainsets", "level": 8}, {"id": "maglev_high_power_energy", "level": 1}], ["Navette maglev pionnière"], ["+2% vitesse max", "-0,8% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_guidance", "Guidage magnétique", "Ère 7 — Train à sustentation magnétique. Effets : +1,2% fiabilité, +0,8% vitesse max.", 6, [{"id": "maglev_levitation", "level": 3}], ["Rame maglev guidée"], ["+1,2% fiabilité", "+0,8% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_linear_propulsion", "Propulsion linéaire", "Ère 7 — Train à sustentation magnétique. Effets : +1,8% vitesse max, -0,6% consommation.", 6, [{"id": "maglev_levitation", "level": 5}, {"id": "maglev_guidance", "level": 3}], ["Maglev express linéaire"], ["+1,8% vitesse max", "-0,6% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_special_tracks", "Voies magnétiques spéciales", "Ère 7 — Train à sustentation magnétique. Effets : +1,5% vitesse max, +0,8% fiabilité.", 6, [{"id": "maglev_guidance", "level": 5}], [], ["+1,5% vitesse max", "+0,8% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_stations", "Gares maglev", "Ère 7 — Train à sustentation magnétique. Effets : +0,8% rentabilité, +0,6% fiabilité.", 6, [{"id": "maglev_special_tracks", "level": 3}], [], ["+0,8% rentabilité", "+0,6% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_very_high_speed", "Très haute vitesse", "Ère 7 — Train à sustentation magnétique. Effets : +2,5% vitesse max, +1% rentabilité.", 6, [{"id": "maglev_linear_propulsion", "level": 8}, {"id": "maglev_special_tracks", "level": 8}], [], ["+2,5% vitesse max", "+1% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_silence_comfort", "Silence et confort avancés", "Ère 7 — Train à sustentation magnétique. Effets : +1% rentabilité, -0,6% impact environnemental.", 6, [{"id": "maglev_levitation", "level": 5}, {"id": "maglev_stations", "level": 3}], [], ["+1% rentabilité", "-0,6% impact environnemental", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('maintenance', "maglev_contactless_maintenance", "Maintenance sans contact roue-rail", "Ère 7 — Train à sustentation magnétique. Effets : +1,2% fiabilité, +0,8% rentabilité.", 6, [{"id": "maglev_guidance", "level": 8}], [], ["+1,2% fiabilité", "+0,8% rentabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('maintenance', "maglev_advanced_high_speed_safety", "Sécurité haute vitesse avancée", "Ère 7 — Train à sustentation magnétique. Effets : +1,5% fiabilité.", 6, [{"id": "maglev_very_high_speed", "level": 5}, {"id": "hsv_signaling", "level": 8}], [], ["+1,5% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('energy', "maglev_high_power_energy", "Énergie haute puissance", "Ère 7 — Train à sustentation magnétique. Effets : +1,2% vitesse max, -0,5% consommation.", 6, [{"id": "hsv_catenary", "level": 8}, {"id": "electric_substations", "level": 8}], [], ["+1,2% vitesse max", "-0,5% consommation", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_metro_express_links", "Liaisons express métropolitaines", "Ère 7 — Train à sustentation magnétique. Effets : +1,5% rentabilité, +1% vitesse max.", 6, [{"id": "maglev_very_high_speed", "level": 5}, {"id": "maglev_stations", "level": 5}], ["Maglev express métropolitain"], ["+1,5% rentabilité", "+1% vitesse max", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});
  add('traction', "maglev_next_generation", "Maglev nouvelle génération", "Ère 7 — Train à sustentation magnétique. Effets : +2% vitesse max, -1% consommation, +1% fiabilité.", 6, [{"id": "maglev_very_high_speed", "level": 8}, {"id": "maglev_advanced_high_speed_safety", "level": 8}, {"id": "maglev_contactless_maintenance", "level": 8}], ["Maglev nouvelle génération"], ["+2% vitesse max", "-1% consommation", "+1% fiabilité", "Niveaux suivants : 10% des bonus initiaux par niveau."], {"era": 7, "eraLabel": "Train à sustentation magnétique", "infiniteScaling": 0.1, "disableAutoLevelEffect": true, "baseCostMoney": 855000, "baseDurationSeconds": 545});


  add('operations', 'manual_dispatch', 'Régulation manuelle structurée', 'Pose les bases des roulements et priorités de circulation.', 0, [], [], ['Ponctualité de base par niveau']);
  add('operations', 'block_signaling', 'Block automatique', 'Augmente le débit et réduit les conflits de circulation.', 1, ['manual_dispatch'], [], ['Attractivité et ponctualité par niveau']);
  add('operations', 'passing_loops', 'Évitements cadencés', 'Augmente le débit exploitable des lignes secondaires.', 1, ['manual_dispatch'], [], ['Débit soutenable sur petites lignes']);
  add('operations', 'centralized_control', 'Commande centralisée', 'Supervise plusieurs lignes depuis un poste unique.', 2, ['block_signaling'], [], ['Attractivité réseau et prérequis grande vitesse']);
  add('operations', 'clockface_timetable', 'Horaire cadencé', 'Rend les lignes plus lisibles pour les voyageurs.', 2, ['centralized_control'], [], ['Demande voyageurs et satisfaction accrues']);
  add('operations', 'incident_protocols', 'Plans incidents', 'Réduit l’impact des événements météo et sociaux.', 2, ['centralized_control'], [], ['Résilience événementielle par niveau']);
  add('operations', 'platform_dispatching', 'Gestion quais centralisée', 'Réduit les conflits dans les grandes gares.', 3, ['clockface_timetable', 'passenger_flow'], [], ['Capacité des nœuds accrue']);
  add('operations', 'traffic_simulation', 'Simulation de trafic', 'Prévoit la saturation avant ouverture des lignes.', 3, ['centralized_control'], [], ['Meilleure marge sur axes saturés']);
  add('operations', 'night_services', 'Exploitation de nuit', 'Organise sûreté, roulements et maintenance nocturne.', 4, ['centralized_control'], ['Trains de nuit modernes'], ['Revenus longue distance et disponibilité améliorés']);
  add('operations', 'dynamic_pricing', 'Yield management ferroviaire', 'Optimise le prix moyen sans casser l’attractivité.', 4, ['traffic_simulation'], [], ['Revenus voyageurs par niveau']);
  add('operations', 'automated_dispatch', 'Régulation automatisée', 'Optimise les priorités à grande échelle.', 5, ['traffic_simulation', 'electric_electronic_control'], [], ['Ponctualité réseau avancée']);
  add('operations', 'driverless_corridors', 'Corridors supervisés', 'Prépare le fret autonome et les corridors très cadencés.', 5, ['automated_dispatch'], ['Rame batterie modulaire mieux exploité'], ['Débit et coûts RH réduits']);

  add('stations', 'passenger_flow', 'Gestion des flux voyageurs', 'Améliore la capacité effective et la lisibilité des gares.', 0, [], [], ['Capacité gares et demande voyageurs par niveau']);
  add('stations', 'ticket_halls', 'Salles des billets modernisées', 'Réduit les frictions d’accès aux trains.', 0, ['passenger_flow'], [], ['Satisfaction voyageurs par niveau']);
  add('stations', 'platform_canopies', 'Abris de quais', 'Améliore le confort des gares exposées.', 0, ['ticket_halls'], [], ['Confort et réputation locale']);
  add('stations', 'station_retail', 'Commerces de gare', 'Augmente les revenus annexes des flux voyageurs.', 1, ['ticket_halls'], [], ['Revenus gares par niveau']);
  add('stations', 'park_and_ride', 'Parcs relais', 'Améliore la capture périurbaine.', 1, ['passenger_flow'], [], ['Demande régionale par niveau']);
  add('stations', 'accessibility_program', 'Accessibilité universelle', 'Rend les gares plus efficaces et attractives.', 2, ['platform_canopies'], [], ['Satisfaction et flux par niveau']);
  add('stations', 'intermodal_hubs', 'Hubs intermodaux', 'Connecte trains, bus, tramways, vélos et parkings.', 2, ['park_and_ride', 'passenger_flow'], [], ['Demande voyageurs et capacité intermodale']);
  add('stations', 'major_terminal_design', 'Conception grands terminaux', 'Débloque une exploitation dense des métropoles.', 3, ['intermodal_hubs'], [], ['Capacité grands nœuds par niveau']);
  add('stations', 'station_hotels', 'Services longue distance', 'Améliore les gares de correspondance premium.', 3, ['station_retail'], [], ['Revenus annexes et satisfaction']);
  add('stations', 'real_time_information', 'Information voyageurs temps réel', 'Réduit l’impact des retards perçus.', 3, ['centralized_control', 'accessibility_program'], [], ['Satisfaction et réputation par niveau']);
  add('stations', 'urban_air_rights', 'Valorisation immobilière', 'Transforme les grandes gares en actifs de long terme.', 4, ['major_terminal_design', 'station_retail'], [], ['Revenus gares par niveau']);
  add('stations', 'smart_station_ops', 'Gares intelligentes', 'Automatise flux, énergie et maintenance bâtiment.', 5, ['real_time_information', 'electric_electronic_control'], [], ['Charges fixes de gare réduites']);

  add('freight', 'basic_freight_yards', 'Triages marchandises', 'Structure les premiers flux fret exploitables.', 0, [], [], ['Demande fret locale par niveau']);
  add('freight', 'specialized_wagons', 'Wagons spécialisés', 'Adapte les wagons aux céréales, bois, citernes et vracs.', 1, ['basic_freight_yards'], [], ['Demande et revenus fret par niveau']);
  add('freight', 'midi_freight_stock', 'Wagons Midi électriques', 'Débloque les wagons fret des compositions électriques pionnières.', 1, ['specialized_wagons'], ['6 variantes fret Midi'], ['Rendement des wagons par niveau']);
  add('freight', 'cold_chain', 'Chaîne du froid ferroviaire', 'Ouvre des contrats alimentaires plus rentables.', 1, ['specialized_wagons'], [], ['Revenus fret premium par niveau']);
  add('freight', 'bulk_contracts', 'Contrats vrac lourds', 'Sécurise minerais, granulats et céréales.', 1, ['basic_freight_yards'], [], ['Volume fret par niveau']);
  add('freight', 'freight_diesel', 'Diesel fret lourd', 'Débloque les locomotives diesel fret non électrifiées.', 2, ['specialized_wagons', 'diesel_freight_locomotives'], ['Locomotive diesel-électrique fret'], ['Coût et fiabilité fret diesel']);
  add('freight', 'port_shuttles', 'Navettes portuaires', 'Améliore les flux depuis ports et zones logistiques.', 2, ['freight_diesel'], [], ['Demande fret maritime par niveau']);
  add('freight', 'container_hubs', 'Terminaux conteneurs', 'Organise le fret intermodal longue distance.', 3, ['port_shuttles'], ['Locomotive électrique fret lourd'], ['Demande conteneurs par niveau']);
  add('freight', 'hazmat_protocols', 'Protocoles matières dangereuses', 'Accède à des contrats difficiles mais rentables.', 3, ['cold_chain'], [], ['Revenus fret spécialisés par niveau']);
  add('freight', 'last_mile_rail', 'Dernier kilomètre ferroviaire', 'Relie zones industrielles et terminaux urbains.', 4, ['container_hubs'], [], ['Capture fret locale par niveau']);
  add('freight', 'automated_freight_ops', 'Exploitation fret automatisée', 'Prépare les trains autonomes de marchandises.', 5, ['driverless_corridors', 'container_hubs'], ['Rame batterie modulaire'], ['Coûts RH fret réduits']);
  add('freight', 'freight_marketplace', 'Bourse contrats fret', 'Met en concurrence les flux et améliore le remplissage.', 5, ['automated_freight_ops'], [], ['Taux de chargement fret par niveau']);

  add('social', 'crew_training', 'Formation polyvalente', 'Améliore la productivité des équipes de circulation.', 0, [], [], ['Efficacité RH et masse salariale par niveau']);
  add('social', 'safety_training', 'Culture sécurité', 'Réduit les erreurs d’exploitation et améliore la fiabilité perçue.', 1, ['crew_training'], [], ['Fiabilité et Agents de gare plus efficaces']);
  add('social', 'apprenticeship_tracks', 'Écoles métiers ferroviaires', 'Réduit le coût des recrutements futurs.', 0, ['crew_training'], [], ['Recrutement moins coûteux par niveau']);
  add('social', 'driver_rosters', 'Roulements Conducteurs', 'Stabilise les lignes à fort trafic.', 1, ['crew_training'], [], ['Besoin Conducteur mieux couvert']);
  add('social', 'controller_service', 'Service commercial embarqué', 'Améliore satisfaction et revenus annexes.', 1, ['safety_training'], [], ['Satisfaction voyageurs par niveau']);
  add('social', 'mechanic_certification', 'Certification Mainteneurs', 'Améliore la qualité des interventions atelier.', 1, ['crew_training'], [], ['Maintenance plus efficace par niveau']);
  add('social', 'dispatcher_school', 'École de régulation', 'Renforce la ponctualité des réseaux complexes.', 2, ['driver_rosters', 'manual_dispatch'], [], ['Régulation et ponctualité par niveau']);
  add('social', 'social_dialogue', 'Dialogue social structuré', 'Réduit l’impact des tensions sociales.', 2, ['safety_training'], [], ['Résilience sociale par niveau']);
  add('social', 'engineering_office', 'Bureau d’études interne', 'Accélère légèrement les projets R&D complexes.', 2, ['apprenticeship_tracks'], [], ['Vitesse de recherche par niveau']);
  add('social', 'knowledge_management', 'Capitalisation technique', 'Rend chaque technologie plus facile à exploiter.', 3, ['engineering_office'], [], ['Effets de niveau plus rentables']);
  add('social', 'digital_training', 'Formation simulateur', 'Améliore la conduite des matériels modernes.', 4, ['dispatcher_school', 'real_time_information'], [], ['Fiabilité matériel moderne par niveau']);
  add('social', 'autonomous_supervision', 'Supervision des systèmes autonomes', 'Prépare les équipes au rail automatisé.', 5, ['digital_training', 'automated_dispatch'], [], ['Réduction coûts RH futurs']);

  add('operations', 'network_revenue_control', 'Pilotage revenu réseau', 'Arbitre prix, capacité et saturation entre lignes concurrentes.', 4, ['dynamic_pricing', 'traffic_simulation'], [], ['Marge des lignes denses améliorée']);
  add('operations', 'ai_timetable_planner', 'Planificateur horaire assisté', 'Construit des sillons robustes sur réseau complexe.', 5, ['automated_dispatch', 'knowledge_management'], [], ['Ponctualité et capacité réseau futures']);
  add('stations', 'station_energy_retrofit', 'Rénovation énergétique des gares', 'Réduit les coûts fixes des bâtiments voyageurs.', 3, ['electric_electronic_control', 'station_retail'], [], ['Charges de gares réduites par niveau']);
  add('stations', 'crowd_simulation', 'Simulation de foule', 'Évite la saturation des terminaux majeurs.', 4, ['major_terminal_design', 'real_time_information'], [], ['Capacité des grandes gares accrue']);
  add('freight', 'rail_road_interfaces', 'Interfaces rail-route', 'Améliore les plateformes combinées régionales.', 3, ['container_hubs'], [], ['Capture fret intermodal accrue']);
  add('freight', 'premium_logistics', 'Logistique premium', 'Structure les contrats urgents à forte marge.', 4, ['hazmat_protocols', 'cold_chain'], [], ['Revenus fret premium par niveau']);
  add('social', 'talent_retention', 'Fidélisation des talents', 'Stabilise les équipes qualifiées sur le long terme.', 3, ['social_dialogue', 'apprenticeship_tracks'], [], ['Coûts RH et qualité de service améliorés']);
  add('social', 'research_campus', 'Campus R&D ferroviaire', 'Accélère les recherches avancées sans achat instantané.', 4, ['engineering_office', 'knowledge_management'], [], ['Vitesse laboratoire par niveau']);

  return finalizeTechTree(groups);
}

function researchNodePrereqWeight(node) {
  const weightOf = item => {
    const req = normalizeResearchPrereqItem(item);
    if (!req) return 0;
    if (req.anyOf) return Math.min(...req.anyOf.map(weightOf));
    return Math.max(1, Math.floor(Number(req.level || 1)));
  };
  return (node.prereq || []).reduce((sum, item) => sum + weightOf(item), 0);
}

function computedResearchBaseDurationSeconds(node) {
  // Niveau 1 début de jeu : environ 30 secondes.
  // Plus l’époque et la profondeur de l’arbre augmentent, plus le niveau 1 démarre long.
  const epoch = Math.max(0, Number(node.requiredEpoch || 0));
  const prereqWeight = researchNodePrereqWeight(node);
  const branchExtra = prereqWeight ? (node.branch === 'social' ? 0 : node.branch === 'operations' ? 8 : node.branch === 'traction' ? 10 : 6) : 0;
  return Math.round(30 * Math.pow(2.05, epoch) + prereqWeight * 14 + branchExtra);
}

function finalizeTechTree(tree) {
  for (const group of Object.values(tree)) {
    for (const node of group.nodes || []) {
      // 0/null/undefined = illimité côté jeu. Les anciens plafonds ne sont plus utilisés.
      node.maxLevel = 0;
      node.unlimited = true;
      node.baseCostMoney ??= node.costMoney ?? 50000;
      node.baseDurationSeconds ??= node.baseDuration ?? node.duration ?? computedResearchBaseDurationSeconds(node);
      node.costGrowth ??= node.unlockOnly ? 1.35 : 1.62;
      node.durationGrowth ??= node.unlockOnly ? 1.34 : 1.50;
      node.levelValue ??= 1;
      node.unlocks ||= [];
      node.improves ||= node.effects || [];
      const levelEffect = node.disableAutoLevelEffect ? '' : researchLevelEffectText(node);
      if (levelEffect && !node.improves.includes(levelEffect)) node.improves.push(levelEffect);
      node.effects = [...node.unlocks, ...node.improves];
    }
  }
  return tree;
}

function researchLevelEffectText(node) {
  const byId = {
    steam_power: '+4 % de portée vapeur par niveau.',
    regen_braking: '-3,5 % de coût électricité/batterie par niveau, plafonné à -18 %.',
    energy_dispatch: '-2,4 % de coût énergie général par niveau, plafonné à -12 %.',
    depot_methods: '-2,5 % de coût maintenance et -1,8 % d’usure par niveau, avec plafond.',
    rapid_workshops: '-4,5 % de durée d’atelier par niveau, avec plafond.',
    predictive_maintenance: '-2,5 % d’usure et +0,16 capacité maintenance par niveau.',
    safety_training: '+0,6 point de fiabilité et meilleure efficacité des agents par niveau.',
    block_signaling: '+2 % d’attractivité exploitation par niveau, plafonné à +10 %.',
    centralized_control: '+2,4 % d’attractivité réseau par niveau, plafonné à +12 %.',
    passenger_flow: '+2,6 % de flux voyageurs et capacité gares par niveau, plafonné à +13 %.',
    intermodal_hubs: '+3,2 % de demande intermodale par niveau, plafonné à +16 %.',
    specialized_wagons: '+3 % de demande fret spécialisée par niveau, plafonné à +15 %.',
    container_hubs: '+4 % de demande conteneurs par niveau, plafonné à +20 %.',
    crew_training: '+4,5 % d’efficacité RH par niveau et baisse progressive de masse salariale.'
  };
  if (byId[node.id]) return byId[node.id];
  const byBranch = {
    traction: '+1 niveau de branche Traction : Meilleure portée, vitesse commerciale ou confort selon le matériel concerné.',
    energy: '+1 niveau de branche Énergie : Coûts de traction plus stables et meilleure efficacité énergétique.',
    maintenance: '+1 niveau de branche Maintenance : Moins d’usure, moins d’immobilisation ou moins de coût atelier.',
    operations: '+1 niveau de branche Exploitation : Meilleure ponctualité, débit ou robustesse des sillons.',
    stations: '+1 niveau de branche Gares : Plus de capacité, satisfaction ou revenus annexes.',
    freight: '+1 niveau de branche Fret : Meilleure capture de demande, taux de chargement ou revenu par tonne.',
    social: '+1 niveau de branche RH : Meilleure productivité, sécurité ou vitesse de recherche.'
  };
  return byBranch[node.branch] || byBranch[node.group] || '';
}

function buildWorld() {
  const stations = [
    st('PAR', 'Paris', 48.8566, 2.3522, 'Île-de-France', 1000, 90, 100),
    st('LYO', 'Lyon Part-Dieu', 45.7600, 4.8590, 'Auvergne-Rhône-Alpes', 720, 85, 72),
    st('MAR', 'Marseille Saint-Charles', 43.3027, 5.3806, 'Provence-Alpes-Côte d’Azur', 650, 95, 88),
    st('LIL', 'Lille Flandres', 50.6366, 3.0709, 'Hauts-de-France', 560, 80, 55),
    st('BOR', 'Bordeaux Saint-Jean', 44.8259, -0.5567, 'Nouvelle-Aquitaine', 520, 70, 78),
    st('NAN', 'Nantes', 47.2173, -1.5419, 'Pays de la Loire', 470, 74, 65),
    st('STR', 'Strasbourg', 48.5850, 7.7330, 'Grand Est', 420, 70, 68),
    st('REN', 'Rennes', 48.1035, -1.6722, 'Bretagne', 390, 48, 58),
    st('TOU', 'Toulouse Matabiau', 43.6111, 1.4536, 'Occitanie', 520, 60, 67),
    st('MON', 'Montpellier Saint-Roch', 43.6045, 3.8806, 'Occitanie', 360, 48, 75),
    st('NIC', 'Nice-Ville', 43.7046, 7.2619, 'Provence-Alpes-Côte d’Azur', 400, 42, 96),
    st('GRE', 'Grenoble', 45.1910, 5.7140, 'Auvergne-Rhône-Alpes', 270, 42, 82),
    st('DIJ', 'Dijon', 47.3230, 5.0270, 'Bourgogne-Franche-Comté', 260, 70, 45),
    st('MET', 'Metz', 49.1090, 6.1770, 'Grand Est', 230, 74, 35),
    st('NAN2', 'Nancy', 48.6890, 6.1740, 'Grand Est', 220, 62, 42),
    st('REI', 'Reims', 49.2583, 4.0317, 'Grand Est', 240, 48, 46),
    st('AMI', 'Amiens', 49.8940, 2.2950, 'Hauts-de-France', 200, 42, 35),
    st('ROU', 'Rouen Rive-Droite', 49.4480, 1.0940, 'Normandie', 260, 58, 45),
    st('LEH', 'Le Havre', 49.4920, 0.1250, 'Normandie', 220, 120, 46),
    st('BRET', 'Brétigny-sur-Orge', 48.6114, 2.3059, 'Île-de-France', passengerDemandFromPopulation(26658), 26, 34, 26658),
    st('LONJ', 'Longjumeau', 48.6951, 2.2943, 'Île-de-France', passengerDemandFromPopulation(21700), 24, 30, 21700),
    st('CAE', 'Caen', 49.1829, -0.3707, 'Normandie', 220, 38, 50),
    st('FAL', 'Falaise', 48.8920, -0.1970, 'Normandie', passengerDemandFromPopulation(8000), 20, 30, 8000),
    st('BAY', 'Bayeux', 49.2765, -0.7039, 'Normandie', 80, 18, 58),
    st('ARP', 'Arpajon', 48.5896, 2.2467, 'Île-de-France', passengerDemandFromPopulation(11144), 22, 28, 11144),
    st('CHB', 'Cherbourg', 49.6337, -1.6221, 'Normandie', 120, 55, 42),
    st('BRE', 'Brest', 48.3904, -4.4861, 'Bretagne', 210, 62, 63),
    st('QUI', 'Quimper', 47.9960, -4.0960, 'Bretagne', 140, 28, 64),
    st('LOR', 'Lorient', 47.7480, -3.3660, 'Bretagne', 140, 55, 54),
    st('VAN', 'Vannes', 47.6580, -2.7600, 'Bretagne', 150, 26, 70),
    st('STB', 'Saint-Brieuc', 48.5070, -2.7650, 'Bretagne', 140, 30, 48),
    st('ANG', 'Angers Saint-Laud', 47.4640, -0.5560, 'Pays de la Loire', 230, 44, 52),
    st('LEM', 'Le Mans', 48.0060, 0.1990, 'Pays de la Loire', 260, 60, 45),
    st('TOU2', 'Tours', 47.3900, 0.6930, 'Centre-Val de Loire', 250, 46, 70),
    st('ORL', 'Orléans', 47.9020, 1.9040, 'Centre-Val de Loire', 230, 48, 46),
    st('LIM', 'Limoges', 45.8360, 1.2670, 'Nouvelle-Aquitaine', 190, 38, 42),
    st('POI', 'Poitiers', 46.5820, 0.3400, 'Nouvelle-Aquitaine', 210, 40, 45),
    st('LAR', 'La Rochelle', 46.1520, -1.1450, 'Nouvelle-Aquitaine', 180, 48, 82),
    st('BIA', 'Biarritz', 43.4590, -1.5450, 'Nouvelle-Aquitaine', 170, 30, 88),
    st('PAU', 'Pau', 43.2950, -0.3700, 'Nouvelle-Aquitaine', 160, 28, 58),
    st('AGE', 'Agen', 44.2040, 0.6170, 'Nouvelle-Aquitaine', 120, 36, 38),
    st('CLE', 'Clermont-Ferrand', 45.7780, 3.0870, 'Auvergne-Rhône-Alpes', 230, 44, 62),
    st('STE', 'Saint-Étienne', 45.4430, 4.3990, 'Auvergne-Rhône-Alpes', 220, 58, 35),
    st('VAL', 'Valence TGV', 44.9910, 4.9780, 'Auvergne-Rhône-Alpes', 200, 52, 52),
    st('AVI', 'Avignon TGV', 43.9210, 4.7860, 'Provence-Alpes-Côte d’Azur', 230, 42, 80),
    st('TOU3', 'Toulon', 43.1280, 5.9290, 'Provence-Alpes-Côte d’Azur', 260, 80, 82),
    st('CAN', 'Cannes', 43.5528, 7.0174, 'Provence-Alpes-Côte d’Azur', 220, 28, 96),
    st('PER', 'Perpignan', 42.6960, 2.8790, 'Occitanie', 190, 44, 72),
    st('NIM', 'Nîmes', 43.8330, 4.3660, 'Occitanie', 220, 42, 62),
    st('BEZ', 'Béziers', 43.3440, 3.2190, 'Occitanie', 150, 40, 62),
    st('CAR', 'Carcassonne', 43.2130, 2.3530, 'Occitanie', 130, 22, 80),
    st('ALB', 'Albi', 43.9290, 2.1460, 'Occitanie', 120, 28, 55),
    st('MUL', 'Mulhouse', 47.7420, 7.3430, 'Grand Est', 210, 92, 42),
    st('BES', 'Besançon', 47.2380, 6.0250, 'Bourgogne-Franche-Comté', 170, 48, 48),
    st('BEL', 'Belfort-Montbéliard TGV', 47.5860, 6.8990, 'Bourgogne-Franche-Comté', 140, 70, 36),
    st('CHA', 'Chambéry', 45.5720, 5.9200, 'Auvergne-Rhône-Alpes', 180, 34, 86),
    st('ANN', 'Annecy', 45.9010, 6.1220, 'Auvergne-Rhône-Alpes', 170, 28, 90),
    st('MAC', 'Mâcon-Loché TGV', 46.2830, 4.7780, 'Bourgogne-Franche-Comté', 130, 52, 42),
    st('AUX', 'Auxerre', 47.7970, 3.5700, 'Bourgogne-Franche-Comté', 110, 34, 42),
    st('TRO', 'Troyes', 48.2970, 4.0740, 'Grand Est', 160, 44, 40),
    st('DUN', 'Dunkerque', 51.0340, 2.3770, 'Hauts-de-France', 160, 130, 34),
    st('CAL', 'Calais', 50.9510, 1.8580, 'Hauts-de-France', 150, 75, 45),
    st('ARR', 'Arras', 50.2860, 2.7810, 'Hauts-de-France', 190, 46, 42),
    st('VAL2', 'Valenciennes', 50.3570, 3.5260, 'Hauts-de-France', 170, 75, 32),
    st('LAV', 'Laval', 48.0730, -0.7710, 'Pays de la Loire', 110, 26, 35),
    st('LRS', 'La Roche-sur-Yon', 46.6710, -1.4350, 'Pays de la Loire', 120, 34, 50),
    st('NEV', 'Nevers', 46.9930, 3.1580, 'Bourgogne-Franche-Comté', 120, 44, 35),
    st('BOU', 'Bourges', 47.0830, 2.3960, 'Centre-Val de Loire', 130, 40, 42),
    st('CHA2', 'Châteauroux', 46.8090, 1.6910, 'Centre-Val de Loire', 100, 30, 32)
  ];
  const stationIndex = Object.fromEntries(stations.map(s => [s.id, s]));
  const regions = [...new Set(stations.map(s => s.region))].sort();
  const outlines = franceOutlines();
  const railGraph = buildRailGraph();
  const railSegments = buildRailSegments(railGraph, stationIndex);
  return {
    bounds: computeBounds(outlines),
    stations,
    stationIndex,
    regions,
    outline: outlines[0],
    outlines,
    railGraph,
    railSegments,
    railAdjacency: buildRailAdjacencyIndex(railGraph)
  };
}

function franceOutlines() {
  const mainland = [
    [2.55, 51.09], [2.13, 51.04], [1.58, 50.99], [1.25, 50.73], [1.64, 50.22], [1.36, 50.06], [1.08, 49.95],
    [0.68, 49.51], [0.22, 49.47], [-0.10, 49.42], [-0.36, 49.34], [-0.65, 49.33], [-1.00, 49.37], [-1.27, 49.39],
    [-1.62, 49.66], [-1.86, 49.72], [-2.20, 49.49], [-2.48, 49.31], [-2.80, 49.18], [-3.22, 48.85], [-3.52, 48.79],
    [-3.91, 48.73], [-4.37, 48.52], [-4.77, 48.41], [-4.73, 48.22], [-4.56, 48.06], [-4.70, 47.85], [-4.46, 47.75],
    [-4.18, 47.79], [-3.75, 47.72], [-3.49, 47.63], [-3.19, 47.53], [-2.82, 47.43], [-2.48, 47.33], [-2.17, 47.27],
    [-1.86, 47.06], [-1.62, 46.82], [-1.30, 46.42], [-1.17, 46.16], [-1.17, 45.72], [-1.08, 45.41], [-1.20, 45.12],
    [-1.10, 44.79], [-1.24, 44.65], [-1.16, 44.37], [-1.29, 44.10], [-1.54, 43.78], [-1.78, 43.49], [-1.48, 43.35],
    [-1.19, 43.25], [-0.74, 43.12], [-0.38, 42.98], [0.00, 42.87], [0.56, 42.82], [1.14, 42.72], [1.64, 42.62],
    [2.13, 42.43], [2.51, 42.34], [3.04, 42.32], [3.15, 42.43], [3.07, 42.78], [3.30, 43.05], [3.73, 43.23],
    [4.24, 43.34], [4.70, 43.38], [5.05, 43.26], [5.36, 43.20], [5.77, 43.10], [6.17, 43.09], [6.57, 43.16],
    [6.93, 43.36], [7.39, 43.55], [7.53, 43.79], [7.72, 44.05], [7.47, 44.31], [7.05, 44.71], [6.82, 45.08],
    [7.05, 45.46], [6.78, 45.75], [6.84, 46.18], [6.43, 46.43], [6.53, 46.78], [6.14, 47.04], [6.55, 47.49],
    [7.05, 47.67], [7.50, 47.62], [7.60, 47.82], [7.80, 48.13], [7.62, 48.58], [7.15, 48.97], [6.72, 49.17],
    [6.18, 49.46], [5.82, 49.55], [5.47, 49.50], [5.04, 49.78], [4.58, 49.99], [4.08, 49.99], [3.62, 50.31],
    [3.15, 50.52], [2.78, 50.73], [2.55, 51.09]
  ];
  const corsica = [
    [8.55, 42.95], [8.78, 43.02], [9.08, 42.86], [9.28, 42.66], [9.44, 42.43], [9.54, 42.10], [9.50, 41.78],
    [9.30, 41.42], [8.98, 41.34], [8.73, 41.52], [8.57, 41.82], [8.62, 42.16], [8.54, 42.46], [8.55, 42.72], [8.55, 42.95]
  ];
  return [mainland, corsica];
}

function buildRailGraph() {
  return [
    ['PAR', 'LIL'], ['PAR', 'AMI'], ['PAR', 'ROU'], ['PAR', 'CAE'], ['ROU', 'PAR'], ['CAE', 'REN'], ['REN', 'NAN'], ['LIL', 'DUN'], ['LIL', 'CAL'], ['LIL', 'ARR'], ['ARR', 'AMI'], ['AMI', 'ROU'], ['ROU', 'LEH'], ['ROU', 'CAE'], ['CAE', 'BAY'], ['BAY', 'CHB'],
    ['PAR', 'REI'], ['REI', 'MET'], ['MET', 'NAN2'], ['NAN2', 'STR'], ['STR', 'MUL'], ['MUL', 'BEL'], ['BEL', 'BES'], ['BES', 'DIJ'], ['DIJ', 'PAR'],
    ['PAR', 'ORL'], ['ORL', 'TOU2'], ['TOU2', 'POI'], ['POI', 'BOR'], ['BOR', 'BIA'], ['BIA', 'PAU'], ['BOR', 'AGE'], ['AGE', 'TOU'],
    ['PAR', 'LEM'], ['LEM', 'LAV'], ['LAV', 'REN'], ['REN', 'STB'], ['STB', 'BRE'], ['BRE', 'QUI'], ['QUI', 'LOR'], ['LOR', 'VAN'], ['VAN', 'NAN'], ['NAN', 'ANG'], ['ANG', 'TOU2'],
    ['NAN', 'LRS'], ['LRS', 'LAR'], ['LAR', 'BOR'], ['PAR', 'AUX'], ['AUX', 'DIJ'], ['DIJ', 'MAC'], ['MAC', 'LYO'], ['LYO', 'STE'], ['LYO', 'VAL'], ['VAL', 'AVI'],
    ['AVI', 'MAR'], ['MAR', 'TOU3'], ['TOU3', 'CAN'], ['CAN', 'NIC'], ['AVI', 'NIM'], ['NIM', 'MON'], ['MON', 'BEZ'], ['BEZ', 'PER'], ['BEZ', 'CAR'], ['CAR', 'TOU'],
    ['TOU', 'ALB'], ['TOU', 'AGE'], ['PAR', 'NEV'], ['NEV', 'BOU'], ['BOU', 'CHA2'], ['CHA2', 'LIM'], ['LIM', 'POI'], ['LYO', 'GRE'], ['GRE', 'CHA'], ['CHA', 'ANN'], ['CLE', 'LYO'], ['CLE', 'NEV']
  ];
}

function buildRailSegments(graph, stationIndex) {
  return (graph || [])
    .map(([from, to]) => {
      const a = stationIndex[from];
      const b = stationIndex[to];
      if (!a || !b) return null;
      return {
        from,
        to,
        distance: Math.round(haversine(a.lat, a.lon, b.lat, b.lon)),
        geometry: [
          [Number(a.lon), Number(a.lat)],
          [Number(b.lon), Number(b.lat)]
        ]
      };
    })
    .filter(Boolean);
}

function buildRailAdjacencyIndex(graph) {
  const adj = {};
  for (const [a, b] of graph) {
    (adj[a] ||= []).push(b);
    (adj[b] ||= []).push(a);
  }
  return adj;
}

function computeBounds(outlines) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const shape of outlines) {
    for (const [lon, lat] of shape) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLon: minLon - 0.35, maxLon: maxLon + 0.35, minLat: minLat - 0.25, maxLat: maxLat + 0.2 };
}

function st(id, name, lat, lon, region, baseDemand, freight, tourism, population = 0) {
  const station = { id, name, lat, lon, region, baseDemand, freight, tourism };
  if (Number.isFinite(Number(population)) && Number(population) > 0) {
    station.population = Math.round(Number(population));
    station.baseDemand = passengerDemandFromPopulation(population);
    station.populationSource = 'manuel';
  }
  return station;
}
