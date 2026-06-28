// Migration de sauvegarde, monde public, gares et chargements de données.
var saveStore;

function getSaveStore() {
  if (!saveStore) {
    const { createSaveStore } = require(path.join(__dirname, 'src', 'server', 'persistence-sqlite'));
    saveStore = createSaveStore(SAVE_DB_FILE);
  }
  return saveStore;
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
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';
}

function loadOrCreateState() {
  try {
    const loaded = getSaveStore().read();
    if (loaded?.players) {
      const migrated = migrateState(loaded);
      if (migrated.__trainCatalogMigrated) {
        delete migrated.__trainCatalogMigrated;
        getSaveStore().write(migrated);
      }
      return migrated;
    }
  } catch (error) {
    console.warn('Base SQLite illisible, tentative de reprise depuis le JSON.', error.message);
  }

  if (fs.existsSync(LEGACY_SAVE_FILE)) {
    try {
      const loaded = JSON.parse(fs.readFileSync(LEGACY_SAVE_FILE, 'utf8'));
      if (loaded && loaded.players) {
        const migrated = migrateState(loaded);
        getSaveStore().write(migrated);
        console.log(`Sauvegarde JSON migrée vers ${path.basename(SAVE_DB_FILE)}.`);
        return migrated;
      }
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
  const migrated = {
    version: STATE_SCHEMA_VERSION,
    createdAt: loaded.createdAt || Date.now(),
    now: loaded.now || Date.now(),
    day: Number(loaded.day || 1),
    eraYear: Number(loaded.eraYear || 1850),
    tickSpeed: TICK_MS,
    market: { ...createMarket(), ...(loaded.market || {}) },
    events: Array.isArray(loaded.events) ? loaded.events : [],
    news: Array.isArray(loaded.news) ? loaded.news : [],
    bugReports: normalizeBugReports(loaded.bugReports || []),
    users: normalizeUsers(loaded.users || {}),
    players: purgeUnlinkedPlayers(players, loaded.users || {}),
  };
  canonicalizePersistedStationLabels(migrated.players);
  if (migrateLegacyTrainCatalogModels(migrated.players)) migrated.__trainCatalogMigrated = true;
  return migrated;
}

function migrateLegacyTrainCatalogModels(players) {
  // Les identifiants ci-dessous couvrent le catalogue historique complet.
  // Les remplacements gardent la même ère et le même usage (voyageurs, fret
  // ou mixte), tout en conservant l'id du train et ses affectations de ligne.
  const replacements = {
    steam_030_mixte: 'steam_001_141_r',
    steam_120_omnibus: 'steam_002_231_k',
    steam_040_freight: 'steam_005_150_p',
    steam_220_express: 'steam_007_231_g',
    steam_241_articulated: 'steam_003_241_p',
    diesel_shunter_030: 'diesel_009_bb_66000',
    diesel_light_railcar: 'diesel_006_x_4300',
    diesel_mechanical_regional: 'diesel_005_x_73500',
    diesel_hydraulic_express: 'diesel_001_cc_72000',
    diesel_electric_freight: 'diesel_010_bb_75000',
    electric_pioneer_loco: 'electric_loco_003_bb_22200',
    electric_third_rail_emu: 'electric_emu_006_z_5600',
    electric_dc_regional_emu: 'electric_emu_010_regio_2n',
    electric_dual_current_loco: 'electric_loco_002_bb_26000',
    electric_heavy_freight: 'electric_loco_001_cc_6500',
    hsv_intercity_200: 'high_speed_001_tgv_sud_est',
    hsv_trainset_pioneer: 'high_speed_001_tgv_sud_est',
    hsv_duplex_capacity: 'high_speed_004_tgv_duplex',
    hsv_distributed_trainset: 'high_speed_007_euroduplex_2n2',
    hsv_premium_long_distance: 'high_speed_010_tgv_m',
    hydrogen_regional_unit: 'hydrogen_001_regiolis_h2',
    hydrogen_fuel_cell_unit: 'hydrogen_002_coradia_ilint',
    hydrogen_rural_unit: 'hydrogen_007_hybari',
    hydrogen_long_range_unit: 'hydrogen_004_mireo_plus_h',
    hydrogen_next_gen_unit: 'hydrogen_010_vittal_one_h2',
    battery_suburban_unit: 'battery_001_agc_batteries',
    battery_regional_unit: 'battery_003_coradia_bemu',
    battery_fast_charge_unit: 'battery_004_flirt_akku',
    battery_modular_unit: 'battery_007_talent_3_bemu',
    battery_high_density_unit: 'battery_004_flirt_akku',
    maglev_shuttle_pioneer: 'maglev_005_transrapid_09',
    maglev_guided_regional: 'maglev_003_shanghai_transrapid',
    maglev_linear_express: 'maglev_004_transrapid_08',
    maglev_metropolitan_express: 'maglev_001_l0_series',
    maglev_next_gen_unit: 'maglev_001_l0_series'
  };
  let changed = false;
  for (const player of Object.values(players || {})) {
    if (!player || !Array.isArray(player.trains)) continue;
    let playerChanged = false;
    for (const train of player.trains) {
      const replacement = replacements[train?.modelId];
      if (!replacement || !BALANCE.trains[replacement]) continue;
      train.modelId = replacement;
      // Les locomotives restent des locomotives et les automotrices des UM :
      // les lignes conservent donc leurs ids de trains et leur service.
      ensureTrainComposition(train, BALANCE.trains[replacement]);
      changed = true;
      playerChanged = true;
    }
    if (playerChanged) normalizePlayerLineAssignments(player);
  }
  return changed;
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

function legacyResearchTreeAliases() {
  return {
  steam_coal_water_reserves: 'steam_depots', steam_economized: 'steam_improved_boilers', steam_superheated: 'steam_improved_boilers', steam_oil_fired: 'steam_workshops',
  diesel_hydraulic: 'diesel_passenger_locomotives', diesel_modern: 'diesel_electric',
  electric_antislip: 'electric_electronic_control',
  hsv_premium_long_distance: 'hsv_premium_long_distance', hsv_high_speed_braking: 'hsv_high_speed_braking', hsv_adapted_tracks: 'hsv_adapted_tracks',
  clockface_timetable: 'traffic_simulation', incident_protocols: 'safety_training', platform_dispatching: 'traffic_simulation', network_revenue_control: 'dynamic_pricing',
  rail_road_interfaces: 'container_hubs', port_shuttles: 'container_hubs', hazmat_protocols: 'specialized_wagons', last_mile_rail: 'container_hubs', automated_freight_ops: 'driverless_corridors', freight_marketplace: 'container_hubs', premium_logistics: 'container_hubs', cold_chain: 'specialized_wagons', bulk_contracts: 'basic_freight_yards', freight_diesel: 'diesel_freight_locomotives',
  park_and_ride: 'intermodal_hubs', platform_canopies: 'passenger_flow', station_retail: 'ticket_halls', accessibility_program: 'passenger_flow', major_terminal_design: 'intermodal_hubs', station_hotels: 'intermodal_hubs', real_time_information: 'traffic_simulation', urban_air_rights: 'intermodal_hubs', smart_station_ops: 'intermodal_hubs', station_energy_retrofit: 'electric_substations', crowd_simulation: 'intermodal_hubs',
  apprenticeship_tracks: 'crew_training', driver_rosters: 'crew_training', controller_service: 'crew_training', dispatcher_school: 'centralized_control', social_dialogue: 'safety_training', engineering_office: 'traffic_simulation', knowledge_management: 'traffic_simulation', digital_training: 'automated_dispatch', autonomous_supervision: 'driverless_corridors', talent_retention: 'crew_training', research_campus: 'traffic_simulation',
  battery_suburban_trains: 'battery_suburban_trains', battery_regional_trains: 'battery_regional_trains', battery_fast_station_charging: 'battery_fast_station_charging', battery_modular: 'battery_modular', battery_high_density: 'battery_high_density',
    maglev_interchange_hubs: 'maglev_interchange_hubs', maglev_operations_certification: 'maglev_operations_certification'
  };
}

function grantResearchLevel(unlocked, nodeId, level = 1) {
  const node = techNodeById(nodeId);
  if (!node) return false;
  const max = Math.max(1, Number(node.maxLevel || 5));
  unlocked[nodeId] = Math.max(Number(unlocked[nodeId] || 0), Math.min(max, Math.max(1, Math.floor(Number(level || 1)))));
  return true;
}

function grantExistingResearchRights(player, unlocked) {
  for (const train of player.trains || []) {
    const model = BALANCE.trains?.[train?.modelId];
    if (model?.requiredTech) grantResearchLevel(unlocked, model.requiredTech, model.requiredTechLevel || 1);
    const passengerVariant = train?.composition?.passengerVariant;
    const freightVariant = train?.composition?.freightVariant;
    if (passengerVariant) {
      const variant = compositionVariantForMode('passenger_loco', passengerVariant);
      if (variant?.requiredTech) grantResearchLevel(unlocked, variant.requiredTech, 1);
    }
    if (freightVariant) {
      const variant = compositionVariantForMode('freight_loco', freightVariant);
      if (variant?.requiredTech) grantResearchLevel(unlocked, variant.requiredTech, 1);
    }
  }
  for (const line of player.lines || []) {
    if (line?.service === 'freight') grantResearchLevel(unlocked, 'steam_freight_locomotives', 1);
    if (line?.service === 'mixed') {
      grantResearchLevel(unlocked, 'steam_passenger_locomotives', 2);
      grantResearchLevel(unlocked, 'steam_freight_locomotives', 2);
    }
    if (!line?.service || line.service === 'passengers') grantResearchLevel(unlocked, 'steam_passenger_locomotives', 1);
    const stops = Array.isArray(line?.stops) ? line.stops : [];
    if (stops.length > 2) grantResearchLevel(unlocked, 'manual_dispatch', 2);
    if (line?.electrified) grantResearchLevel(unlocked, 'electric_substations', 2);
  }
  for (const asset of Object.values(player.stations || {})) {
    if (!asset) continue;
    if (Number(asset.level || 1) > 1) grantResearchLevel(unlocked, 'passenger_flow', 1);
    if (Number(asset.commerce || 0) > 0) grantResearchLevel(unlocked, 'ticket_halls', 1);
    if (Number(asset.maintenance || 0) > 0) grantResearchLevel(unlocked, 'steam_workshops', 1);
    if (asset.depot) grantResearchLevel(unlocked, 'steam_depots', 1);
    if (asset.electrified) grantResearchLevel(unlocked, 'electric_substations', 2);
  }
  const facilities = player.maintenanceFacilities || {};
  if (Number(facilities.depot?.level ?? facilities.depot ?? 0) > 0) grantResearchLevel(unlocked, 'steam_depots', 1);
  if (Number(facilities.workshop?.level ?? facilities.workshop ?? 0) > 0) grantResearchLevel(unlocked, 'steam_workshops', 1);
  if (Number(facilities.technicentre?.level ?? facilities.technicentre ?? 0) > 0) grantResearchLevel(unlocked, 'electric_standardized_maintenance', 1);
}

function normalizeMaintenanceFacilities(player) {
  const raw = player.maintenanceFacilities && typeof player.maintenanceFacilities === 'object' ? player.maintenanceFacilities : {};
  const legacyStations = Object.values(player.stations || {});
  const legacyDepotLevels = legacyStations.reduce((sum, asset) => sum + (asset?.depot ? 1 : 0), 0);
  const legacyWorkshopLevels = legacyStations.reduce((sum, asset) => sum + Math.max(0, Math.floor(Number(asset?.maintenance || 0))), 0);
  const readLevel = id => {
    const value = raw[id];
    return Math.max(0, Math.floor(Number(value?.level ?? value ?? 0)));
  };
  player.maintenanceFacilities = {
    depot: { level: Math.max(readLevel('depot'), legacyDepotLevels) },
    workshop: { level: Math.max(readLevel('workshop'), legacyWorkshopLevels) },
    technicentre: { level: readLevel('technicentre') }
  };
  return player.maintenanceFacilities;
}

function migrateResearchTree(player) {
  const researchTreeVersion = 2;
  const aliases = legacyResearchTreeAliases();
  const wasCurrent = Number(player.researchTreeVersion || 0) >= researchTreeVersion;
  const unlocked = wasCurrent ? { ...(player.techUnlocked || {}) } : {};
  const legacyBranchLevels = { ...(player.tech || {}) };
  const credit = (id, level) => {
    const target = aliases[id] || id;
    return grantResearchLevel(unlocked, target, level);
  };

  if (!wasCurrent) {
    for (const [id, level] of Object.entries(player.techUnlocked || {})) credit(id, level);
    const inFlight = [player.researchProject, ...(Array.isArray(player.researchQueue) ? player.researchQueue : [])].filter(Boolean);
    for (const project of inFlight) credit(project.nodeId, project.targetLevel || 1);
    player.researchProject = null;
    player.researchQueue = [];
    player.legacyTechFloor = Object.fromEntries(Object.entries(legacyBranchLevels).map(([branch, level]) => [branch, Math.max(0, Math.floor(Number(level || 0)))]));
    player.researchTreeVersion = researchTreeVersion;
    player.notifications ||= [];
    player.notifications.push('Arbre R&D migré : les recherches déjà terminées ou en cours ont été créditées dans les nouveaux jalons.');
  }

  // Une compagnie ne perd jamais l’accès à un train, une gare, une ligne ou un
  // équipement qu’elle possède déjà.
  grantExistingResearchRights(player, unlocked);
  for (let era = 1; era <= Number(player.epoch || 0); era++) {
    for (const milestone of BALANCE.epochs?.[era]?.requiredResearch || []) grantResearchLevel(unlocked, milestone.id, milestone.level || 1);
  }
  player.techUnlocked = unlocked;
  return player;
}

function migratePlayer(player, fallbackId) {
  const p = player && typeof player === 'object' ? player : {};
  const techDefaults = { traction: 0, energy: 0, maintenance: 0, operations: 0, stations: 0, social: 0, freight: 0 };
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
  migrateResearchTree(p);
  p.researchProject = normalizeResearchProject(p.researchProject);
  p.researchQueue = normalizeResearchQueue(p.researchQueue);
  p.eraTransition = normalizeEraTransition(p.eraTransition, p);
  p.maintenancePolicy = BALANCE.maintenancePolicies[p.maintenancePolicy] ? p.maintenancePolicy : 'standard';
  p.maintenanceFacilities = normalizeMaintenanceFacilities(p);
  p.staff = { ...staffDefaults, ...(p.staff || {}) };
  p.tutorial = createTutorialState(p.tutorial);
  p.stats = { ...statsDefaults, ...(p.stats || {}) };
  p.trains = Array.isArray(p.trains) ? p.trains.map(t => normalizeTrain(t, p.id)).filter(Boolean) : [];
  p.lines = Array.isArray(p.lines) ? p.lines : [];
  p.stations = p.stations && typeof p.stations === 'object' ? p.stations : {};
  migrateLegacyStationReferences(p);
  normalizePlayerLineAssignments(p);
  for (const stationId of Object.keys(p.stations)) normalizeStationAsset(p, stationId);
  p.energyStrategy = BALANCE.energyStrategies[p.energyStrategy] ? p.energyStrategy : 'spot';
  p.resources = normalizeResources(p.resources);
  p.notifications = normalizeNotifications(p.notifications);
  p.notificationsReadAt = Number.isFinite(Number(p.notificationsReadAt)) ? Math.max(0, Number(p.notificationsReadAt)) : 0;
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

function eraTransitionDurationMs(targetEpoch) {
  const epoch = clamp(Math.floor(Number(targetEpoch || 0)), 1, BALANCE.epochs.length - 1);
  return ERA_TRANSITION_DURATIONS_MS[epoch] || 45 * 24 * HOUR_MS;
}

function normalizeEraTransition(raw, player = null) {
  if (!raw || typeof raw !== 'object') return null;
  const currentEpoch = Math.floor(Number(player?.epoch ?? -1));
  const targetEpoch = clamp(Math.floor(Number(raw.targetEpoch || 0)), 1, BALANCE.epochs.length - 1);
  if (!BALANCE.epochs[targetEpoch]) return null;
  if (currentEpoch >= 0 && targetEpoch <= currentEpoch) return null;
  const durationMs = Math.max(1000, Math.floor(Number(raw.durationMs || eraTransitionDurationMs(targetEpoch))));
  const remainingMs = clamp(Math.ceil(Number(raw.remainingMs ?? durationMs)), 0, durationMs);
  if (remainingMs <= 0) return null;
  return {
    targetEpoch,
    remainingMs,
    durationMs,
    startedAt: Number(raw.startedAt || Date.now()),
    updatedAt: Number(raw.updatedAt || Date.now())
  };
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
    bugReports: [],
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
  getSaveStore().write(state);
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
  const maxSnapKm = population >= 50000 ? 12 : population >= 15000 ? 9 : 7;
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
  const existing = Array.isArray(existingStations) ? existingStations : [];
  // Cette liste contient plus de 3 000 gares. L'ancienne version comparait
  // chaque gare à l'ensemble des gares déjà retenues et reconstruisait ce
  // tableau à chaque itération : O(n²) au premier /api/state.
  const seenIds = new Set();
  const seenPhysical = new Set();
  const stationCodes = new Map();
  const stationsByNormalizedName = new Map();

  const registerStation = station => {
    if (!station) return;
    const id = String(station.id || '').trim();
    if (id) seenIds.add(id);
    const physicalKey = stationPhysicalKey(station);
    if (physicalKey) seenPhysical.add(physicalKey);
    const code = stationCommuneCode(station);
    if (code) {
      const entry = stationCodes.get(code) || { count: 0, hasNonMultiStation: false };
      entry.count += 1;
      entry.hasNonMultiStation ||= !station.multiStation;
      stationCodes.set(code, entry);
    }
    const name = stationDedupName(station.name);
    if (!name) return;
    const list = stationsByNormalizedName.get(name) || [];
    list.push(station);
    stationsByNormalizedName.set(name, list);
  };

  for (const station of existing) registerStation(station);
  for (const raw of stations || []) {
    if (!raw || !raw.id) continue;
    const station = canonicalizeStationDisplay({ ...raw, id: currentStationId(raw.id) });
    const id = String(station.id || '').trim();
    if (!id || seenIds.has(id)) continue;
    const physicalKey = stationPhysicalKey(station);
    if (physicalKey && seenPhysical.has(physicalKey)) continue;

    const code = stationCommuneCode(station);
    const sameCode = code ? stationCodes.get(code) : null;
    // Une commune mono-gare masque toutes ses autres entrées. Une commune
    // multi-gares ne peut coexister qu'avec d'autres entrées multi-gares.
    if (sameCode && (sameCode.hasNonMultiStation || !station.multiStation)) continue;

    const name = stationDedupName(station.name);
    const sameName = name ? stationsByNormalizedName.get(name) : null;
    const duplicateByNameAndLocation = sameName?.some(existingStation => {
      const candidateLat = Number(station.lat);
      const candidateLon = Number(station.lon);
      const existingLat = Number(existingStation.lat);
      const existingLon = Number(existingStation.lon);
      return Number.isFinite(candidateLat) && Number.isFinite(candidateLon)
        && Number.isFinite(existingLat) && Number.isFinite(existingLon)
        && haversine(candidateLat, candidateLon, existingLat, existingLon) <= 1.25;
    });
    if (duplicateByNameAndLocation) continue;

    out.push(station);
    registerStation(station);
  }
  return out;
}


function publicWorld() {
  const communeCount = Object.keys(communeCache.byId || {}).length;
  // La cache est invalidée explicitement lors d'un rafraîchissement des gares.
  // Éviter de trier et concaténer les 3 420 codes à chaque F5.
  const cacheKey = `${communeCache.status}:${communeCache.updatedAt || ''}:${communeCache.sourceVersion || 0}:${MIN_COMMUNE_POPULATION}:${communeCount}:${communeCache.error || ''}`;
  if (publicWorldCache.key === cacheKey && publicWorldCache.value) return publicWorldCache.value;

  const communeStations = deduplicatePublicStations(Object.values(communeCache.byId || {}).map(stationRailPlacement));
  // Conserver les fiches complètes côté serveur pour les actions de jeu, mais
  // ne transmettre au navigateur que les champs utilisés par la carte, la
  // recherche et les fiches de gare. Les données de provenance SNCF et les
  // doublons de coordonnées faisaient peser plus de 3 Mo sur chaque état.
  const stations = communeStations.map(publicStationForClient);
  const stationIndex = Object.fromEntries(communeStations.map(s => [s.id, s]));
  const world = {
    ...WORLD,
    stations,
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
  // Le serveur a besoin d'un index, mais le client le reconstruit déjà depuis
  // `stations`. Le rendre non énumérable évite d'envoyer les mêmes 3 420 gares
  // une seconde fois dans chaque réponse /api/state.
  Object.defineProperty(world, 'stationIndex', { value: stationIndex, enumerable: false });
  publicWorldCache = { key: cacheKey, value: world };
  return world;
}

function publicStationForClient(station) {
  return {
    id: station.id,
    name: station.name,
    commune: Boolean(station.commune),
    multiStation: Boolean(station.multiStation),
    lat: Number(station.lat),
    lon: Number(station.lon),
    railLat: Number(station.railLat ?? station.stationLat ?? station.lat),
    railLon: Number(station.railLon ?? station.stationLon ?? station.lon),
    placement: station.placement || 'commune',
    population: Number(station.population || 0),
    baseDemand: Number(station.baseDemand || 0),
    freight: Number(station.freight || 0),
    annualPassengers: Number(station.annualPassengers || 0),
    passengerTrafficYear: Number(station.passengerTrafficYear || 0),
    purchaseCost: Number(station.purchaseCost || station.acquisitionCost || 0),
    majorTerminal: Boolean(station.majorTerminal),
    codesPostaux: Array.isArray(station.codesPostaux) ? station.codesPostaux : [],
    codeDepartement: station.codeDepartement || '',
    region: station.region || '',
    hasPassengerStation: Boolean(station.hasPassengerStation),
    hasFreightStation: Boolean(station.hasFreightStation),
    stationUic: station.stationUic || station.codeUic || '',
    stationName: station.stationName || station.name
  };
}

function sanitizeStateStationReferencesForPublicWorld() {
  const world = publicWorld();
  // Cette normalisation est une migration des sauvegardes, pas une donnée qui
  // doit être recalculée à chaque rafraîchissement client. Elle est relancée
  // automatiquement dès que `invalidatePublicWorldCache()` remplace le monde.
  if (publicWorldCache.stationReferencesSanitized) return false;
  const stationIndex = world?.stationIndex || {};
  const hasStation = id => Boolean(id && stationIndex[currentStationId(id)]);
  const normalizeId = id => {
    const canonical = currentStationId(id);
    return hasStation(canonical) ? canonical : '';
  };
  const stationLabel = id => stationIndex[id]?.name || id;
  let changed = false;

  for (const player of Object.values(state?.players || {})) {
    if (!player || typeof player !== 'object') continue;

    const cleanStations = {};
    for (const [stationId, asset] of Object.entries(player.stations || {})) {
      const nextId = normalizeId(stationId);
      if (!nextId) { changed = true; continue; }
      const normalizedAsset = asset && typeof asset === 'object' ? { ...asset } : {};
      normalizedAsset.id = nextId;
      if (normalizedAsset.stationId) normalizedAsset.stationId = nextId;
      cleanStations[nextId] = { ...(cleanStations[nextId] || {}), ...normalizedAsset };
      if (nextId !== stationId) changed = true;
    }
    player.stations = cleanStations;

    const cleanLines = [];
    for (const line of Array.isArray(player.lines) ? player.lines : []) {
      if (!line || typeof line !== 'object') { changed = true; continue; }
      const rawStops = Array.isArray(line.stops) && line.stops.length
        ? line.stops
        : [line.from, line.to].filter(Boolean);
      const validStops = [];
      for (const rawId of rawStops) {
        const nextId = normalizeId(rawId);
        if (!nextId) { if (rawId) changed = true; continue; }
        if (!validStops.includes(nextId)) validStops.push(nextId);
        if (nextId !== rawId) changed = true;
      }
      const from = normalizeId(line.from) || validStops[0] || '';
      const to = normalizeId(line.to) || validStops[validStops.length - 1] || '';
      if (from && !validStops.includes(from)) validStops.unshift(from);
      if (to && !validStops.includes(to)) validStops.push(to);
      if (validStops.length < 2) { changed = true; continue; }
      const nextFrom = validStops[0];
      const nextTo = validStops[validStops.length - 1];
      const lineChanged = line.from !== nextFrom || line.to !== nextTo || JSON.stringify(line.stops || []) !== JSON.stringify(validStops);
      if (lineChanged) changed = true;
      line.from = nextFrom;
      line.to = nextTo;
      line.stops = validStops;
      if (Array.isArray(line.route)) line.route = line.route.map(normalizeId).filter(Boolean);
      if (Array.isArray(line.routeIds)) line.routeIds = line.routeIds.map(normalizeId).filter(Boolean);
      if (Array.isArray(line.stopIds)) line.stopIds = line.stopIds.map(normalizeId).filter(Boolean);
      const nextName = `${stationLabel(nextFrom)} → ${stationLabel(nextTo)}`;
      if (line.name !== nextName || /(?:COM_|PAR_)[A-Za-z0-9_]*/i.test(String(line.name))) {
        line.name = nextName;
        changed = true;
      }
      if (lineChanged && line.stats) {
        delete line.stats;
        changed = true;
      }
      cleanLines.push(line);
    }
    if ((player.lines || []).length !== cleanLines.length) changed = true;
    player.lines = cleanLines;
  }
  publicWorldCache.stationReferencesSanitized = true;
  return changed;
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

function parisInterchangeStationEntry(entry) {
  return normalizeCommuneStation({
    id: entry.id,
    code: entry.code,
    name: entry.name,
    lat: roundCoord(entry.lat),
    lon: roundCoord(entry.lon),
    population: PARIS_COMMUNE_POPULATION,
    region: 'Paris — gare RER souterraine',
    codesPostaux: [entry.postal],
    codeDepartement: '75',
    baseDemand: 1450,
    freight: 40,
    tourism: 115,
    commune: true,
    populationSource: 'point RER ajouté manuellement car absent de liste-des-gares',
    realStation: true,
    multiStation: true,
    allowSameCommuneStation: true,
    stationLat: roundCoord(entry.lat),
    stationLon: roundCoord(entry.lon),
    stationName: entry.stationName || entry.name,
    stationUic: entry.stationUic || '',
    stationTrigramme: '',
    stationIdGare: entry.id,
    stationSource: PARIS_INTERCHANGE_SOURCE,
    hasPassengerStation: true,
    hasFreightStation: false,
    stationKind: 'rer-interchange',
    codeLignes: Array.isArray(entry.codeLignes) ? entry.codeLignes : [],
    sourceRecords: 1,
    purchaseCost: 0
  });
}

function applyParisInterchangeStations(byId) {
  if (!byId || typeof byId !== 'object') return { added: 0 };
  let added = 0;
  for (const entry of PARIS_INTERCHANGE_STATIONS) {
    const station = parisInterchangeStationEntry(entry);
    if (!station?.id) continue;
    byId[station.id] = station;
    added += 1;
  }
  return { added };
}

function missingSncfStationFallbackEntry(entry) {
  return normalizeCommuneStation({
    id: entry.id,
    code: entry.code,
    name: entry.name,
    lat: roundCoord(entry.lat),
    lon: roundCoord(entry.lon),
    population: 84095,
    region: 'Gare voyageurs',
    codesPostaux: [entry.postal],
    codeDepartement: '78',
    commune: true,
    realStation: true,
    multiStation: true,
    allowSameCommuneStation: true,
    populationSource: 'data.gouv.fr population municipale',
    stationLat: roundCoord(entry.lat),
    stationLon: roundCoord(entry.lon),
    stationName: entry.stationName || entry.name,
    stationUic: entry.stationUic,
    stationTrigramme: 'VRD',
    stationIdGare: entry.stationIdGare || entry.id,
    stationSource: MISSING_SNCF_STATION_FALLBACK_SOURCE,
    hasPassengerStation: true,
    hasFreightStation: false,
    stationKind: 'passenger',
    sourceRecords: 1
  });
}

function applyMissingSncfStationFallbacks(byId) {
  if (!byId || typeof byId !== 'object') return { added: 0 };
  let added = 0;
  for (const entry of MISSING_SNCF_STATION_FALLBACKS) {
    const hasEquivalentStation = Object.values(byId).some(station =>
      String(station.stationUic || '') === entry.stationUic
      || stationDedupName(station.name) === stationDedupName(entry.name)
    );
    if (hasEquivalentStation) continue;
    const station = missingSncfStationFallbackEntry(entry);
    if (!station?.id) continue;
    byId[station.id] = station;
    added += 1;
  }
  return { added };
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
      const normalized = canonicalizeStationDisplay(normalizeCommuneStation(station));
      if (normalized) byId[normalized.id] = normalized;
    }
    applyMissingSncfStationFallbacks(byId);
    applyParisInterchangeStations(byId);
    for (const [id, station] of Object.entries(byId)) byId[id] = canonicalizeStationDisplay(station);
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

function normalizeSncfUic(value) {
  const match = String(value || '').match(/\d{8}/);
  return match ? match[0] : '';
}

async function fetchSncfPassengerTraffic() {
  const exported = await fetchJsonWithTimeout(SNCF_PASSENGER_TRAFFIC_EXPORT_URL, 90000);
  const byUic = new Map();
  for (const record of sncfRecordsFromPayload(exported)) {
    const uic = normalizeSncfUic(record.code_uic_complet || record.code_uic || record.uic);
    const annualPassengers = Math.max(0, Math.round(Number(record.total_voyageurs_2024 || 0)));
    if (!uic || !annualPassengers) continue;
    const previous = byUic.get(uic);
    if (!previous || annualPassengers > previous.annualPassengers) {
      byUic.set(uic, { annualPassengers, year: 2024 });
    }
  }
  if (byUic.size < 2500) throw new Error(`Fréquentation SNCF incomplète: ${byUic.size}/2500`);
  return byUic;
}

function applySncfPassengerTraffic(byId, trafficByUic) {
  let matched = 0;
  for (const station of Object.values(byId || {})) {
    const traffic = trafficByUic?.get(normalizeSncfUic(station.stationUic));
    if (!traffic) continue;
    station.annualPassengers = traffic.annualPassengers;
    station.passengerTrafficYear = traffic.year;
    station.passengerTrafficSource = 'SNCF fréquentation des gares';
    matched += 1;
  }
  return matched;
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
    const [populationIndex, sncfStations, passengerTraffic] = await Promise.all([
      fetchPopulationMunicipaleIndex(),
      fetchSncfRailwayStations(),
      fetchSncfPassengerTraffic()
    ]);
    const built = buildStationsFromSncfList(sncfStations, populationIndex);
    const byId = {};
    for (const station of built.stations) byId[station.id] = station;
    applyMissingSncfStationFallbacks(byId);
    applyParisInterchangeStations(byId);
    const passengerTrafficMatched = applySncfPassengerTraffic(byId, passengerTraffic);
    const coverageCount = Object.keys(byId).length;
    if (coverageCount < COMMUNE_CACHE_MIN_READY_COUNT) {
      throw new Error(`Couverture gares SNCF incomplete: ${coverageCount}/${COMMUNE_CACHE_MIN_READY_COUNT}`);
    }
    const sncfStats = {
      ...built.stats,
      totalStations: coverageCount,
      matched: built.stats.populationMatched,
      source: SNCF_STATION_DATASET,
      passengerTrafficDataset: SNCF_PASSENGER_TRAFFIC_DATASET,
      passengerTrafficYear: 2024,
      passengerTrafficRecords: passengerTraffic.size,
      passengerTrafficMatched,
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
      source: 'SNCF liste-des-gares + fréquentation-gares 2024 + data.gouv.fr population municipale des communes',
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

function passengerDemandFromSncfTraffic(annualPassengers) {
  const traffic = Math.max(0, Number(annualPassengers || 0));
  if (!Number.isFinite(traffic) || traffic <= 0) return 0;
  // Conversion de la fréquentation annuelle réelle en potentiel jouable :
  // elle conserve l'ordre des gares SNCF sans injecter des millions de
  // voyageurs dans un seul tick serveur.
  return Math.round(clamp(70 + Math.pow(traffic / 1000, 0.62) * 20, 70, 1600));
}

function effectiveStationPassengerDemand(station) {
  if (!station) return 80;
  const annualPassengers = Number(station.annualPassengers || 0);
  if (Number.isFinite(annualPassengers) && annualPassengers > 0) return passengerDemandFromSncfTraffic(annualPassengers);
  const population = Number(station.population || 0);
  if (Number.isFinite(population) && population > 0) return passengerDemandFromPopulation(population);
  const commune = closestCommuneForStation(station);
  if (commune?.population) return passengerDemandFromPopulation(commune.population);
  return clamp(Number(station.baseDemand || 80), 60, 1600);
}

function stationAnnualPassengerDemand(station) {
  const annualPassengers = Math.max(0, Number(station?.annualPassengers || 0));
  if (Number.isFinite(annualPassengers) && annualPassengers > 0) return annualPassengers;
  // Les rares gares absentes du jeu de fréquentation SNCF conservent une
  // estimation annuelle dérivée de leur bassin de population.
  return Math.max(0, effectiveStationPassengerDemand(station) * 1000);
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
  const q = normalizeStationSearchText(query || '');
  const all = Object.values(communeCache.byId || {});
  if (!q) return all.sort((a, b) => (b.population || 0) - (a.population || 0)).slice(0, limit);
  return all
    .map(s => {
      const name = normalizeStationSearchText(s.name);
      const postal = (s.codesPostaux || []).join(' ');
      const exact = name === q;
      const starts = name.startsWith(q);
      const includes = name.includes(q);
      const postalMatch = postal.includes(q);
      // Les correspondances de nom sont groupées avant les correspondances
      // secondaires afin que « droite » retrouve Versailles-Rive-Droite.
      const rank = exact ? 0 : starts ? 1 : includes ? 2 : postalMatch ? 3 : 4;
      return {
        s,
        rank,
        score: Math.log10((s.population || 5000)) * 10,
        matches: exact || starts || includes || postalMatch
      };
    })
    .filter(x => x.matches)
    .sort((a, b) => a.rank - b.rank || b.score - a.score || String(a.s.name || '').localeCompare(String(b.s.name || ''), 'fr'))
    .slice(0, limit)
    .map(x => x.s);
}

function normalizeStationSearchText(value) {
  return normalizeSearch(value)
    .replace(/[’'`]/g, ' ')
    .replace(/[-_/.,;:()[\]{}]+/g, ' ')
    .replace(/\b(?:st|ste)\.?(?=\s|$)/g, 'saint')
    .replace(/\bsainte\b/g, 'saint')
    .replace(/\s+/g, ' ')
    .trim();
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

function isInFranceBounds(lat, lon) {
  return lat >= 41.0 && lat <= 51.5 && lon >= -5.7 && lon <= 10.2;
}
