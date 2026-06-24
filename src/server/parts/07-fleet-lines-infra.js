// Matériel roulant, lignes, sillons, infrastructures et notifications.
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
      'range'
    );
    effects.push({ kind, value: sign * rawValue });
  }
  return effects;
}

function nodeNumericEffects(node) {
  if (!node?.id) return [];
  if (_researchEffectCache.has(node.id)) return _researchEffectCache.get(node.id);
  const allowedKinds = new Set(['speed', 'range', 'reliability', 'comfort', 'maintenance', 'energy', 'environment', 'profitability']);
  const structured = Array.isArray(node.trainEffects)
    ? node.trainEffects
      .filter(effect => allowedKinds.has(effect?.kind) && Number.isFinite(Number(effect?.value)))
      .map(effect => ({ kind: effect.kind, value: Number(effect.value), target: effect.target || {} }))
    : [];
  const parsed = structured.length
    ? structured
    : (node.improves || []).flatMap(parseResearchNumericEffects);
  _researchEffectCache.set(node.id, parsed);
  return parsed;
}

function modelResearchEra(model) {
  return Math.max(1, Number(model?.unlockEpoch || 0) + 1);
}


function researchLevelEffectUnits(level) {
  const n = Math.max(0, Math.floor(Number(level || 0)));
  if (n <= 5) return n;
  // Les niveaux restent utiles après 5, tout en évitant une croissance
  // disproportionnée sur les parties de très longue durée.
  return 5 + 1.5 * Math.log1p(n - 5);
}

function researchEffectAppliesToModel(effect, model) {
  const target = effect?.target || {};
  if (Number(target.era || 0) > 0 && Number(target.era) !== modelResearchEra(model)) return false;
  const energyTypes = Array.isArray(target.energyTypes) ? target.energyTypes.filter(Boolean) : [];
  if (energyTypes.length && !energyTypes.includes(model?.energyType)) return false;
  if (target.service === 'passenger' && Number(model?.capacity || 0) <= 0) return false;
  if (target.service === 'freight' && Number(model?.freight || 0) <= 0) return false;
  return true;
}

function researchModifiersForModel(player, model) {
  const modifiers = { speed: 1, range: 1, reliability: 1, comfort: 1, maintenance: 1, energy: 1, environment: 1, profitability: 1 };
  if (!player || !model) return modifiers;
  for (const node of allTechNodes()) {
    const level = techLevel(player, node.id);
    if (level <= 0) continue;
    const units = researchLevelEffectUnits(level);
    for (const effect of nodeNumericEffects(node)) {
      if (!researchEffectAppliesToModel(effect, model)) continue;
      const adjusted = effect.value * units;
      modifiers[effect.kind] *= Math.max(0.08, 1 + adjusted);
    }
  }
  return modifiers;
}

function modelWithEraResearch(player, model) {
  if (!player || !model) return { ...model, profitabilityMultiplier: 1, co2Multiplier: 1 };
  const modifiers = researchModifiersForModel(player, model);
  return {
    ...model,
    speed: Math.max(20, round2((model.speed || 0) * modifiers.speed)),
    range: Math.max(1, round2((model.range || 0) * modifiers.range)),
    reliability: clamp((model.reliability || 0) * modifiers.reliability, 0.18, 0.995),
    comfort: clamp((model.comfort || 0) * modifiers.comfort, 0.05, 1),
    maintenance: Math.max(0.01, round2((model.maintenance || 0) * modifiers.maintenance)),
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
    const unitCount = clamp(Math.round(Number(composition.powerUnits || spec.powerUnits.default || 1)), spec.powerUnits.min, spec.powerUnits.max);
    const ratio = unitCount;
    profile.capacity = Math.max(0, Math.round(sourceModel.capacity * ratio));
    profile.freight = 0;
    profile.speed = Math.max(35, Math.round(sourceModel.speed * (1 - Math.max(0, ratio - 1) * 0.015)));
    profile.energy = round2(sourceModel.energy * ratio * (0.95 + ratio * 0.05));
    profile.maintenance = round2(sourceModel.maintenance * ratio * (0.92 + ratio * 0.08));
    profile.reliability = clamp(sourceModel.reliability - Math.max(0, ratio - 1) * 0.015, 0.45, 0.995);
    profile.comfort = clamp(sourceModel.comfort - Math.max(0, ratio - 1) * 0.01, 0.08, 1);
    profile.variant = null;
    profile.compositionSummary = `${unitCount} rame${unitCount > 1 ? 's' : ''} en UM`;
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
  const passengerRun = raw.passengerRun && typeof raw.passengerRun === 'object' ? raw.passengerRun : null;
  raw.passengerRun = passengerRun ? {
    simulationVersion: Math.max(0, Math.floor(Number(passengerRun.simulationVersion || 0))),
    lineId: typeof passengerRun.lineId === 'string' ? passengerRun.lineId : null,
    stopIndex: Math.max(0, Math.floor(Number(passengerRun.stopIndex || 0))),
    direction: Number(passengerRun.direction) < 0 ? -1 : 1,
    nextStopAt: Math.max(0, Number(passengerRun.nextStopAt || 0)),
    departedAt: Math.max(0, Number(passengerRun.departedAt || 0)),
    lastStopAt: Math.max(0, Number(passengerRun.lastStopAt || 0)),
    dwellUntil: Math.max(0, Number(passengerRun.dwellUntil || 0)),
    legFromIndex: Math.max(0, Math.floor(Number(passengerRun.legFromIndex || 0))),
    legToIndex: Math.max(0, Math.floor(Number(passengerRun.legToIndex || 0))),
    legMs: Math.max(0, Number(passengerRun.legMs || 0)),
    started: Boolean(passengerRun.started),
    load: Math.max(0, Math.floor(Number(passengerRun.load || 0))),
    cohorts: Array.isArray(passengerRun.cohorts) ? passengerRun.cohorts
      .map(cohort => ({
        originIndex: Math.max(0, Math.floor(Number(cohort?.originIndex || 0))),
        destinationIndex: Math.max(0, Math.floor(Number(cohort?.destinationIndex || 0))),
        count: Math.max(0, Math.floor(Number(cohort?.count || 0)))
      }))
      .filter(cohort => cohort.count > 0 && cohort.originIndex !== cohort.destinationIndex) : [],
    lastBoarded: Math.max(0, Math.floor(Number(passengerRun.lastBoarded || 0))),
    lastAlighted: Math.max(0, Math.floor(Number(passengerRun.lastAlighted || 0))),
    lastRevenue: Math.max(0, Number(passengerRun.lastRevenue || 0))
  } : null;
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
        distance: Math.max(1, Math.round(Number(segment.distance || 0))),
        speedProfile: normalizeLineSpeedProfile(segment.speedProfile)
      }))
      .filter(segment => segment.from && segment.to && segment.from !== segment.to && segment.distance > 0);
  }
  line.speedProfile = normalizeLineSpeedProfile(routeInfo.speedProfile);
  return line;
}

function normalizeLineSpeedProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const segments = (Array.isArray(raw.segments) ? raw.segments : [])
    .map(segment => {
      const fromKm = Math.max(0, Number(segment?.fromKm || 0));
      const toKm = Math.max(0, Number(segment?.toKm || 0));
      const speedKmh = Math.round(Number(segment?.speedKmh || 0));
      if (![fromKm, toKm, speedKmh].every(Number.isFinite) || toKm <= fromKm || speedKmh < 5) return null;
      return { fromKm, toKm, distanceKm: Math.max(0, Number(segment?.distanceKm || toKm - fromKm)), speedKmh, source: segment?.source || raw.source || 'fallback' };
    })
    .filter(Boolean);
  if (!segments.length) return null;
  return {
    source: raw.source || 'fallback',
    totalKm: Math.max(0, Number(raw.totalKm || segments[segments.length - 1].toKm || 0)),
    coverage: clamp(Number(raw.coverage || 0), 0, 1),
    averageSpeedKmh: Math.max(5, Number(raw.averageSpeedKmh || 0) || Math.round(segments.reduce((sum, segment) => sum + segment.speedKmh * segment.distanceKm, 0) / Math.max(0.001, segments.reduce((sum, segment) => sum + segment.distanceKm, 0)))),
    minSpeedKmh: Math.max(5, Number(raw.minSpeedKmh || 0) || Math.min(...segments.map(segment => segment.speedKmh))),
    maxSpeedKmh: Math.max(5, Number(raw.maxSpeedKmh || 0) || Math.max(...segments.map(segment => segment.speedKmh))),
    segments
  };
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
  const trainsById = new Map((player?.trains || []).map(train => [train.id, train]));
  return ids
    .map(id => trainsById.get(id))
    .filter(Boolean)
    .filter(train => !availableOnly || (!train.maintenance?.active && trainConditionValue(train) > 0));
}

function lineCadenceTiming(service, stopCount) {
  const intermediateStops = Math.max(0, Number(stopCount || 0) - 2);
  if (service === 'freight') return { intermediateStops, dwellMinutes: 5, turnaroundMinutes: 18 };
  if (service === 'mixed') return { intermediateStops, dwellMinutes: 4, turnaroundMinutes: 12 };
  return { intermediateStops, dwellMinutes: 3, turnaroundMinutes: 8 };
}

function speedProfileTravelMinutes(speedProfile, trainSpeedKmh, fallbackDistanceKm = 0) {
  const maxTrainSpeed = Math.max(5, Number(trainSpeedKmh || 0));
  const segments = speedProfile?.segments || [];
  const durationHours = segments.reduce((sum, segment) => {
    const distance = Math.max(0, Number(segment?.distanceKm || (Number(segment?.toKm) - Number(segment?.fromKm)) || 0));
    const rfnLimit = Math.max(5, Number(segment?.speedKmh || speedProfile?.averageSpeedKmh || maxTrainSpeed));
    return sum + distance / Math.max(5, Math.min(maxTrainSpeed, rfnLimit));
  }, 0);
  if (durationHours > 0) return durationHours * 60;
  const distance = Math.max(0, Number(fallbackDistanceKm || speedProfile?.totalKm || 0));
  return distance > 0 ? distance / maxTrainSpeed * 60 : 0;
}

function lineRouteTravelMinutes(line, trainSpeedKmh) {
  return speedProfileTravelMinutes(line?.speedProfile, trainSpeedKmh, lineDistance(line));
}

function lineLegTravelMinutes(line, fromStopIndex, toStopIndex, trainSpeedKmh) {
  const stops = lineStops(line);
  const from = clamp(Math.floor(Number(fromStopIndex || 0)), 0, Math.max(0, stops.length - 1));
  const to = clamp(Math.floor(Number(toStopIndex || 0)), 0, Math.max(0, stops.length - 1));
  const segmentIndex = Math.min(from, to);
  const segment = Array.isArray(line?.routeSegments) ? line.routeSegments[segmentIndex] : null;
  const fallbackDistance = Math.max(0, Number(segment?.distance || lineDistance(line) / Math.max(1, stops.length - 1)));
  return speedProfileTravelMinutes(segment?.speedProfile, trainSpeedKmh, fallbackDistance);
}

function computeLineCadence(player, line, { availableTrains = null, utilizationFactor = 1 } = {}) {
  const plannedTrains = lineAssignedTrains(player, line);
  const operatingTrains = Array.isArray(availableTrains)
    ? availableTrains
    : plannedTrains.filter(train => !train.maintenance?.active && trainConditionValue(train) > 0);
  const timingTrains = operatingTrains.length ? operatingTrains : plannedTrains;
  const timing = lineCadenceTiming(line?.service, lineStops(line).length);
  const distance = Math.max(0, Number(lineDistance(line) || 0));
  const speeds = timingTrains
    .map(train => {
      const model = BALANCE.trains[train?.modelId];
      return model ? Number(getTrainOperatingProfile(train, model, player).speed || model.speed) : 0;
    })
    .filter(speed => Number.isFinite(speed) && speed > 0);
  const operatingSpeedKmh = Math.max(25, Math.min(...(speeds.length ? speeds : [80])));
  const travelMinutes = lineRouteTravelMinutes(line, operatingSpeedKmh);
  const oneWayMinutes = distance > 0
    ? travelMinutes + timing.intermediateStops * timing.dwellMinutes
    : 0;
  const roundTripMinutes = oneWayMinutes > 0
    ? oneWayMinutes * 2 + timing.turnaroundMinutes * 2
    : 0;
  const plannedTrainCount = plannedTrains.length;
  const availableTrainCount = operatingTrains.length;
  const plannedHeadwayMinutes = plannedTrainCount > 0 && roundTripMinutes > 0
    ? roundTripMinutes / plannedTrainCount
    : null;
  const effectiveTrainCount = Math.max(0, availableTrainCount * clamp(Number(utilizationFactor), 0, 1));
  const headwayMinutes = effectiveTrainCount > 0 && roundTripMinutes > 0
    ? roundTripMinutes / effectiveTrainCount
    : null;
  const regularOffsets = plannedHeadwayMinutes == null
    ? []
    : plannedTrains.map((train, index) => ({ trainId: train.id, offsetMinutes: round2(index * plannedHeadwayMinutes) }));

  return {
    version: 'cadence-v1',
    plannedTrainCount,
    availableTrainCount,
    effectiveTrainCount: round2(effectiveTrainCount),
    operatingSpeedKmh: Math.round(operatingSpeedKmh),
    travelMinutes: round2(travelMinutes),
    intermediateStops: timing.intermediateStops,
    dwellMinutes: timing.dwellMinutes,
    oneWayMinutes: round2(oneWayMinutes),
    turnaroundMinutes: timing.turnaroundMinutes,
    roundTripMinutes: round2(roundTripMinutes),
    plannedHeadwayMinutes: plannedHeadwayMinutes == null ? null : round2(plannedHeadwayMinutes),
    headwayMinutes: headwayMinutes == null ? null : round2(headwayMinutes),
    departuresPerHour: headwayMinutes ? round2(60 / headwayMinutes) : 0,
    status: !plannedTrainCount ? 'no-train' : !availableTrainCount ? 'suspended' : effectiveTrainCount + 0.001 < plannedTrainCount ? 'reduced' : 'normal',
    regularOffsets
  };
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

function normalizePlayerLineAssignments(player) {
  if (!player || typeof player !== 'object') return false;
  const existingTrainIds = new Set((player.trains || []).map(train => String(train?.id || '')).filter(Boolean));
  let changed = false;
  for (const line of player.lines || []) {
    if (!line || typeof line !== 'object') continue;
    const currentIds = lineTrainIds(line);
    const nextIds = currentIds.filter(id => existingTrainIds.has(id));
    const nextTrainId = nextIds[0] || '';
    if (currentIds.length !== nextIds.length || line.trainId !== nextTrainId || !Array.isArray(line.trainIds)) changed = true;
    line.trainIds = nextIds;
    line.trainId = nextTrainId;
  }
  return changed;
}

function removeTrainFromPlayerLines(player, trainId) {
  if (!player || !trainId) return false;
  const id = String(trainId);
  let changed = false;
  for (const line of player.lines || []) {
    if (!line || typeof line !== 'object') continue;
    const currentIds = lineTrainIds(line);
    const nextIds = currentIds.filter(candidate => candidate !== id);
    if (currentIds.length === nextIds.length) continue;
    line.trainIds = nextIds;
    line.trainId = nextIds[0] || '';
    changed = true;
  }
  return changed;
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
    owner.stats.lastBreakdown = owner.stats.lastBreakdown || {};
    owner.stats.lastBreakdown.realizedPassageRightsRevenue = Math.round(Number(owner.stats.lastBreakdown.realizedPassageRightsRevenue || 0) + amount);
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
  line.sillonModel = buildLineSillonModel(line);
  return line;
}


function refreshPersistedLineSillonModels() {
  for (const player of Object.values(state?.players || {})) {
    if (!Array.isArray(player?.lines)) continue;
    player.lines = player.lines.map(line => normalizeLine(line)).filter(Boolean);
  }
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

const SILLON_PARIS_ORLEANS_MAIN_NAME_PATTERNS = [
  /etampes/, /etrechy/, /lardy/, /marolles.*hurepoix/, /bretigny.*orge/,
  /saint.*michel.*orge/, /sainte.*genevieve.*bois/, /savigny.*orge/,
  /juvisy/, /choisy.*roi/, /vitry.*seine/, /ivry.*seine/, /austerlitz/
];

const SILLON_DOURDAN_BRANCH_NAME_PATTERNS = [
  /dourdan/, /saint.*cheron/, /breuillet/, /arpajon/, /saint.*germain.*arpajon/,
  /egly/, /ollainville/, /norville/, /bretigny.*orge/
];

function stationNameMatchesAnyPattern(station, patterns) {
  const text = normalizeSearch(`${station?.id || ''} ${station?.name || ''} ${station?.stationName || ''}`);
  return patterns.some(pattern => pattern.test(text));
}


function stationDeptCode(station) {
  const code = String(station?.codeDepartement || station?.code || station?.postal || station?.codesPostaux?.[0] || '');
  return code.slice(0, 2);
}

function stationIdOrNameMatches(station, regex) {
  const text = normalizeSearch(`${station?.id || ''} ${station?.name || ''}`);
  return regex.test(text);
}

function idfSillonDept(dept) {
  return ['75', '77', '78', '91', '92', '93', '94', '95'].includes(String(dept || '').slice(0, 2));
}

function denseSillonDept(dept) {
  return ['75', '92', '93', '94', '69', '13', '59'].includes(String(dept || '').slice(0, 2));
}

function stationSillonDemandIndex(station) {
  if (!station) return 0;
  const population = Math.max(0, Number(station.population || 0));
  const baseDemand = Math.max(0, Number(station.baseDemand || 0));
  const annualPassengers = Math.max(0, Number(station.annualPassengers || 0));
  const passengerScore = annualPassengers > 0 ? Math.log10(annualPassengers + 10) * 95 : 0;
  const terminalScore = station.majorTerminal ? 440 : station.multiStation ? 220 : 0;
  const stationScore = station.hasPassengerStation ? 90 : 0;
  const freightScore = station.hasFreightStation ? Math.max(35, Number(station.freight || 0) * 0.6) : 0;
  return baseDemand + Math.min(900, population / 2500) + passengerScore + terminalScore + stationScore + freightScore;
}

function sillonCapacityModelPayload(input = {}) {
  const theoreticalCapacity = clamp(Math.round(Number(input.theoreticalCapacity || input.capacity || 0)), 2, 48);
  const backgroundUsed = 0;
  const playerCapacity = theoreticalCapacity;
  return {
    version: SILLON_CAPACITY_MODEL_VERSION,
    class: input.class || 'regional',
    reason: input.reason || 'Modèle interne capacité RFN',
    theoreticalCapacity,
    backgroundUsed,
    playerCapacity,
    capacity: playerCapacity,
    tags: Array.isArray(input.tags) ? input.tags.filter(Boolean).slice(0, 8) : []
  };
}

function segmentSpecificCapacityModel(segment, a, b) {
  const idA = currentStationId(segment.from);
  const idB = currentStationId(segment.to);
  const onDourdanBranch = (SILLON_DOURDAN_BRANCH_IDS.has(idA) && SILLON_DOURDAN_BRANCH_IDS.has(idB))
    || (stationNameMatchesAnyPattern(a, SILLON_DOURDAN_BRANCH_NAME_PATTERNS) && stationNameMatchesAnyPattern(b, SILLON_DOURDAN_BRANCH_NAME_PATTERNS));
  const onParisOrleans = (SILLON_PARIS_ORLEANS_MAIN_IDS.has(idA) && SILLON_PARIS_ORLEANS_MAIN_IDS.has(idB))
    || (stationNameMatchesAnyPattern(a, SILLON_PARIS_ORLEANS_MAIN_NAME_PATTERNS) && stationNameMatchesAnyPattern(b, SILLON_PARIS_ORLEANS_MAIN_NAME_PATTERNS));

  // Antenne Dourdan ↔ Brétigny : 8 sillons/h théoriques entièrement disponibles aux joueurs.
  if (onDourdanBranch && !onParisOrleans) return sillonCapacityModelPayload({
    class: 'branch',
    theoreticalCapacity: 8,
    reason: 'Antenne périurbaine moins capacitaire',
    tags: ['antenne']
  });

  // Axe Paris-Austerlitz ↔ Brétigny ↔ Étampes : 24 sillons/h théoriques entièrement disponibles aux joueurs.
  if (onParisOrleans) return sillonCapacityModelPayload({
    class: 'suburban-mainline',
    theoreticalCapacity: 24,
    reason: 'Axe structurant Paris-Orléans',
    tags: ['axe structurant', 'banlieue dense']
  });

  const nameA = normalizeSearch(a?.name || '');
  const nameB = normalizeSearch(b?.name || '');
  const pairName = `${nameA} ${nameB}`;
  if (/\bdourdan\b/.test(pairName) && /\bbretigny\b/.test(pairName)) return sillonCapacityModelPayload({
    class: 'branch',
    theoreticalCapacity: 8,
    reason: 'Antenne Dourdan-Brétigny détectée par nom',
    tags: ['antenne']
  });
  if (/\betampes\b/.test(pairName) && /(austerlitz|bretigny|juvisy)/.test(pairName)) return sillonCapacityModelPayload({
    class: 'suburban-mainline',
    theoreticalCapacity: 24,
    reason: 'Axe Étampes-Brétigny-Paris détecté par nom',
    tags: ['axe structurant']
  });

  return null;
}

function segmentSillonCapacityModel(segment) {
  const a = stationById(segment.from);
  const b = stationById(segment.to);
  const distance = Math.max(1, Number(segment.distance || distanceBetween(segment.from, segment.to) || 1));
  const specific = segmentSpecificCapacityModel(segment, a, b);
  if (specific) return { ...specific, distance: round2(distance) };

  const demandA = stationSillonDemandIndex(a);
  const demandB = stationSillonDemandIndex(b);
  const maxDemand = Math.max(demandA, demandB);
  const sumDemand = demandA + demandB;
  const deptA = stationDeptCode(a);
  const deptB = stationDeptCode(b);
  const idfA = idfSillonDept(deptA) || /^PAR_/.test(String(a?.id || ''));
  const idfB = idfSillonDept(deptB) || /^PAR_/.test(String(b?.id || ''));
  const denseCore = denseSillonDept(deptA) || denseSillonDept(deptB) || /^PAR_/.test(String(a?.id || '')) || /^PAR_/.test(String(b?.id || ''));
  const hub = Boolean(a?.majorTerminal || b?.majorTerminal || maxDemand >= 1400);
  const secondaryBranch = distance <= 35 && sumDemand < 760 && maxDemand < 460;

  let theoreticalCapacity = 12;
  let cls = 'regional';
  const tags = [];

  if (denseCore && distance <= 35 && hub) {
    theoreticalCapacity = 32;
    cls = 'metropolitan-core';
    tags.push('nœud dense', 'gare majeure');
  } else if (denseCore && distance <= 45) {
    theoreticalCapacity = 28;
    cls = 'metropolitan';
    tags.push('zone dense');
  } else if (idfA && idfB && distance <= 60 && !secondaryBranch) {
    theoreticalCapacity = 24;
    cls = 'suburban-mainline';
    tags.push('Île-de-France');
  } else if (idfA && idfB && secondaryBranch) {
    theoreticalCapacity = 10;
    cls = 'suburban-branch';
    tags.push('antenne IDF');
  } else if (sumDemand >= 2200 || maxDemand >= 1300 || hub) {
    theoreticalCapacity = 24;
    cls = 'national-mainline';
    tags.push('axe national');
  } else if (sumDemand >= 1350 || maxDemand >= 780) {
    theoreticalCapacity = 20;
    cls = 'intercity-mainline';
    tags.push('intercités');
  } else if (sumDemand >= 800 || maxDemand >= 480) {
    theoreticalCapacity = 16;
    cls = 'regional-mainline';
    tags.push('régional structurant');
  } else if (distance >= 120 && sumDemand < 650) {
    theoreticalCapacity = 8;
    cls = 'long-rural';
    tags.push('longue section peu dense');
  } else if (distance >= 70 && sumDemand < 760) {
    theoreticalCapacity = 10;
    cls = 'regional-secondary';
    tags.push('secondaire');
  } else if (distance <= 25 && sumDemand >= 560) {
    theoreticalCapacity = 14;
    cls = 'local-busy';
    tags.push('local chargé');
  } else {
    theoreticalCapacity = 12;
    cls = 'regional';
    tags.push('régional');
  }

  if (distance <= 12 && theoreticalCapacity < 20 && sumDemand >= 900) {
    theoreticalCapacity += 2;
    tags.push('courte section');
  }
  if (distance >= 160) {
    tags.push('espacement long');
  }

  return sillonCapacityModelPayload({
    class: cls,
    theoreticalCapacity,
    reason: 'Modèle interne : densité, rôle des gares et distance',
    tags
  });
}

function segmentCapacityPerHour(segment) {
  return segmentSillonCapacityModel(segment).playerCapacity;
}

function buildLineSillonModel(line) {
  const segments = lineSegments(line);
  if (!segments.length) {
    return {
      version: SILLON_CAPACITY_MODEL_VERSION,
      theoreticalCapacity: 0,
      backgroundUsed: 0,
      playerCapacity: 0,
      lineCapacity: 0,
      bottleneck: null,
      segments: []
    };
  }
  const details = segments.map(segment => {
    const model = segmentSillonCapacityModel(segment);
    return {
      key: segment.key,
      from: segment.from,
      to: segment.to,
      fromName: stationById(segment.from)?.name || segment.from,
      toName: stationById(segment.to)?.name || segment.to,
      distance: round2(segment.distance || 0),
      class: model.class,
      reason: model.reason,
      theoreticalCapacity: round2(model.theoreticalCapacity),
      backgroundUsed: round2(model.backgroundUsed),
      playerCapacity: round2(model.playerCapacity),
      capacity: round2(model.playerCapacity),
      tags: model.tags || []
    };
  });
  const bottleneck = details.reduce((best, item) => !best || item.playerCapacity < best.playerCapacity ? item : best, null);
  const theoreticalBottleneck = details.reduce((best, item) => !best || item.theoreticalCapacity < best.theoreticalCapacity ? item : best, null);
  const sums = details.reduce((acc, item) => {
    acc.theoretical += Number(item.theoreticalCapacity || 0);
    acc.player += Number(item.playerCapacity || 0);
    return acc;
  }, { theoretical: 0, player: 0 });
  return {
    version: SILLON_CAPACITY_MODEL_VERSION,
    theoreticalCapacity: round2(bottleneck?.theoreticalCapacity || theoreticalBottleneck?.theoreticalCapacity || 0),
    backgroundUsed: round2(bottleneck?.backgroundUsed || 0),
    playerCapacity: round2(bottleneck?.playerCapacity || 0),
    lineCapacity: round2(bottleneck?.playerCapacity || 0),
    averageTheoreticalCapacity: round2(sums.theoretical / Math.max(1, details.length)),
    averagePlayerCapacity: round2(sums.player / Math.max(1, details.length)),
    bottleneck,
    segments: details
  };
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

function researchedSillonCapacity(player, line) {
  const slots = { passengers: 1, freight: 1 };
  for (const node of allTechNodes()) {
    const bonus = node?.sillonSlots;
    const level = techLevel(player, node?.id);
    if (!bonus || level <= 0) continue;
    slots.passengers += Math.max(0, Number(bonus.passengers || 0)) * level;
    slots.freight += Math.max(0, Number(bonus.freight || 0)) * level;
  }
  if (line?.service === 'freight') return slots.freight;
  if (line?.service === 'mixed') return Math.min(slots.passengers, slots.freight);
  return slots.passengers;
}

function computeLineSillonLimit(player, line, usage = null) {
  const requested = lineSlotDemand(player, line);
  const lineResearchCapacity = Math.max(0, Number(researchedSillonCapacity(player, line) || 0));
  const sillonUsage = usage || buildSillonUsage();
  const segments = lineSegments(line);
  if (!segments.length) {
    const maxFrequency = Math.min(requested, lineResearchCapacity || requested);
    return {
      requestedFrequency: requested,
      lineResearchCapacity,
      maxFrequency,
      effectiveFrequency: maxFrequency,
      constrained: maxFrequency + 0.001 < requested,
      bottleneck: null,
      segments: []
    };
  }

  let maxFrequency = Number.POSITIVE_INFINITY;
  let lineCapacity = Number.POSITIVE_INFINITY;
  let theoreticalCapacity = Number.POSITIVE_INFINITY;
  let bottleneck = null;
  const details = [];
  for (const segment of segments) {
    const model = segmentSillonCapacityModel(segment);
    // La capacité RFN est un plafond physique partagé. La compagnie ne peut
    // toutefois exploiter qu'un sillon au départ, puis débloque sa capacité
    // commerciale par les deux sous-arbres d'Exploitation. Cette limite R&D
    // doit brider uniquement la ligne courante : elle ne doit pas réduire la
    // capacité physique du tronçon, sinon une autre ligne consommant un seul
    // sillon peut ramener celle-ci à zéro et suspendre à tort l'exploitation.
    const capacity = Math.max(0, Number(model.playerCapacity || model.theoreticalCapacity || 0));
    const entry = sillonUsage.get(segment.key);
    const ownRequested = (entry?.entries || [])
      .filter(item => item.playerId === player.id && item.lineId === line.id)
      .reduce((sum, item) => sum + Number(item.frequency || 0), 0);
    const usedByOthers = Math.max(0, Number(entry?.used || 0) - ownRequested);
    const usedByOthersDetails = [];
    const otherUsage = new Map();
    for (const item of entry?.entries || []) {
      if (item.playerId === player.id && item.lineId === line.id) continue;
      const otherPlayer = state.players?.[item.playerId];
      const otherLine = otherPlayer?.lines?.find(candidate => candidate.id === item.lineId);
      const key = `${item.playerId || 'unknown'}::${item.lineId || 'unknown'}`;
      const current = otherUsage.get(key) || {
        playerId: item.playerId || '',
        playerName: cleanText(otherPlayer?.name || 'Autre compagnie', 40),
        lineId: item.lineId || '',
        lineName: cleanText(otherLine ? lineRouteName(lineStops(otherLine)) : 'Ligne', 64),
        frequency: 0
      };
      current.frequency += Number(item.frequency || 0);
      otherUsage.set(key, current);
    }
    for (const item of otherUsage.values()) {
      if (item.frequency > 0) usedByOthersDetails.push({ ...item, frequency: round2(item.frequency) });
    }
    const usedByPlayers = usedByOthers + requested;
    const totalUsed = usedByPlayers;
    const available = Math.max(0, capacity - usedByOthers);
    const availableForLine = Math.max(0, Math.min(available, lineResearchCapacity || available));
    const utilizationPercent = Number(model.theoreticalCapacity || 0) > 0
      ? clamp(totalUsed / Number(model.theoreticalCapacity || 1) * 100, 0, 200)
      : 0;
    const detail = {
      key: segment.key,
      from: segment.from,
      to: segment.to,
      fromName: stationById(segment.from)?.name || segment.from,
      toName: stationById(segment.to)?.name || segment.to,
      distance: round2(segment.distance || 0),
      modelVersion: model.version,
      class: model.class,
      reason: model.reason,
      tags: model.tags || [],
      theoreticalCapacity: round2(model.theoreticalCapacity || 0),
      backgroundUsed: round2(model.backgroundUsed || 0),
      lineResearchCapacity: round2(lineResearchCapacity),
      playerCapacity: round2(capacity || 0),
      capacity: round2(capacity || 0),
      usedByOthers: round2(usedByOthers),
      usedByOthersDetails,
      usedByPlayers: round2(usedByPlayers),
      totalUsed: round2(totalUsed),
      utilizationPercent: round2(utilizationPercent),
      available: round2(available),
      availableForLine: round2(availableForLine),
      requested
    };
    details.push(detail);
    if (capacity < lineCapacity) lineCapacity = capacity;
    if (Number(model.theoreticalCapacity || 0) < theoreticalCapacity) theoreticalCapacity = Number(model.theoreticalCapacity || 0);
    if (availableForLine < maxFrequency) {
      maxFrequency = availableForLine;
      bottleneck = detail;
    }
  }

  if (!Number.isFinite(maxFrequency)) maxFrequency = requested;
  if (!Number.isFinite(lineCapacity)) lineCapacity = maxFrequency;
  if (!Number.isFinite(theoreticalCapacity)) theoreticalCapacity = lineCapacity;
  if (bottleneck && Number.isFinite(Number(bottleneck.theoreticalCapacity))) theoreticalCapacity = Number(bottleneck.theoreticalCapacity);
  if (bottleneck && Number.isFinite(Number(bottleneck.playerCapacity ?? bottleneck.capacity))) lineCapacity = Number(bottleneck.playerCapacity ?? bottleneck.capacity);
  const effectiveFrequency = Math.max(0, Math.min(requested, maxFrequency));
  const totalUsedAtBottleneck = bottleneck ? Number(bottleneck.totalUsed || 0) : requested;
  return {
    modelVersion: SILLON_CAPACITY_MODEL_VERSION,
    requestedFrequency: round2(requested),
    theoreticalCapacity: round2(theoreticalCapacity),
    backgroundUsed: 0,
    lineResearchCapacity: round2(lineResearchCapacity),
    lineCapacity: round2(lineCapacity),
    playerCapacity: round2(lineCapacity),
    maxFrequency: round2(maxFrequency),
    effectiveFrequency: round2(effectiveFrequency),
    usedByPlayers: round2((bottleneck?.usedByPlayers ?? requested) || 0),
    totalUsed: round2(totalUsedAtBottleneck),
    utilizationPercent: bottleneck ? round2(bottleneck.utilizationPercent || 0) : 0,
    constrained: effectiveFrequency + 0.001 < requested,
    bottleneck,
    segments: details
  };
}

function sillonStatsPayload(info) {
  if (!info) return null;
  return {
    modelVersion: info.modelVersion || SILLON_CAPACITY_MODEL_VERSION,
    requestedFrequency: round2(info.requestedFrequency || 0),
    theoreticalCapacity: round2(info.theoreticalCapacity ?? info.bottleneck?.theoreticalCapacity ?? 0),
    backgroundUsed: round2(info.backgroundUsed ?? info.bottleneck?.backgroundUsed ?? 0),
    lineResearchCapacity: round2(info.lineResearchCapacity ?? info.bottleneck?.lineResearchCapacity ?? 0),
    lineCapacity: round2(info.lineCapacity ?? info.maxFrequency ?? 0),
    playerCapacity: round2(info.playerCapacity ?? info.lineCapacity ?? info.maxFrequency ?? 0),
    maxFrequency: round2(info.maxFrequency || 0),
    effectiveFrequency: round2(info.effectiveFrequency || 0),
    usedByPlayers: round2(info.usedByPlayers ?? info.bottleneck?.usedByPlayers ?? info.requestedFrequency ?? 0),
    totalUsed: round2(info.totalUsed ?? info.bottleneck?.totalUsed ?? 0),
    utilizationPercent: round2(info.utilizationPercent ?? info.bottleneck?.utilizationPercent ?? 0),
    constrained: Boolean(info.constrained),
    bottleneck: info.bottleneck ? {
      key: info.bottleneck.key,
      from: info.bottleneck.from,
      to: info.bottleneck.to,
      fromName: info.bottleneck.fromName,
      toName: info.bottleneck.toName,
      distance: round2(info.bottleneck.distance || 0),
      modelVersion: info.bottleneck.modelVersion || info.modelVersion || SILLON_CAPACITY_MODEL_VERSION,
      class: cleanText(info.bottleneck.class || '', 32),
      reason: cleanText(info.bottleneck.reason || '', 120),
      tags: Array.isArray(info.bottleneck.tags) ? info.bottleneck.tags.map(tag => cleanText(tag, 32)).filter(Boolean).slice(0, 8) : [],
      theoreticalCapacity: round2(info.bottleneck.theoreticalCapacity || 0),
      backgroundUsed: round2(info.bottleneck.backgroundUsed || 0),
      lineResearchCapacity: round2(info.bottleneck.lineResearchCapacity ?? info.lineResearchCapacity ?? 0),
      playerCapacity: round2(info.bottleneck.playerCapacity ?? info.bottleneck.capacity ?? 0),
      capacity: round2(info.bottleneck.capacity || 0),
      usedByOthers: round2(info.bottleneck.usedByOthers || 0),
      usedByOthersDetails: Array.isArray(info.bottleneck.usedByOthersDetails)
        ? info.bottleneck.usedByOthersDetails.map(item => ({
          playerId: String(item.playerId || ''),
          playerName: cleanText(item.playerName || 'Autre compagnie', 40),
          lineId: String(item.lineId || ''),
          lineName: cleanText(item.lineName || 'Ligne', 64),
          frequency: round2(item.frequency || 0)
        }))
        : [],
      usedByPlayers: round2(info.bottleneck.usedByPlayers || 0),
      totalUsed: round2(info.bottleneck.totalUsed || 0),
      utilizationPercent: round2(info.bottleneck.utilizationPercent || 0),
      available: round2(info.bottleneck.available || 0),
      availableForLine: round2(info.bottleneck.availableForLine ?? info.bottleneck.available ?? 0)
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

function normalizeNotifications(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => {
      if (typeof item === 'string') {
        const text = cleanText(item, 180);
        return text ? { id: crypto.randomUUID(), text, createdAt: Date.now() } : null;
      }
      if (!item || typeof item !== 'object') return null;
      const text = cleanText(item.text || item.message || '', 220);
      if (!text) return null;
      const createdAt = Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now();
      return {
        id: cleanText(item.id || '', 80) || crypto.randomUUID(),
        text,
        createdAt
      };
    })
    .filter(Boolean)
    .slice(-40);
}

function actionMarkNotificationsRead(player, payload = {}) {
  player.notifications = normalizeNotifications(player.notifications);
  const newest = player.notifications.reduce((max, item) => Math.max(max, Number(item.createdAt || 0) || 0), 0);
  const requested = Number(payload.readAt || 0);
  player.notificationsReadAt = Math.max(Number(player.notificationsReadAt || 0) || 0, newest, Number.isFinite(requested) ? requested : 0);
  return ok('Notifications lues.');
}

function notify(player, text) {
  player.notifications = normalizeNotifications(player.notifications);
  player.notifications.push({ id: crypto.randomUUID(), text: cleanText(text, 220), createdAt: Date.now() });
  player.notifications = player.notifications.slice(-40);
}

function ok(message = 'Action réalisée.') { return { ok: true, message }; }
