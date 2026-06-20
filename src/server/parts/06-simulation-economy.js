// Simulation, économie, marché, énergie, maintenance et R&D.
function processEraTransition(player) {
  const transition = normalizeEraTransition(player.eraTransition, player);
  player.eraTransition = transition;
  if (!transition) return false;
  const now = Date.now();
  const elapsedMs = Math.max(0, now - (transition.updatedAt || now));
  transition.remainingMs = Math.max(0, transition.remainingMs - elapsedMs);
  transition.updatedAt = now;
  if (transition.remainingMs > 0) {
    player.eraTransition = transition;
    return true;
  }
  const target = BALANCE.epochs[transition.targetEpoch];
  player.epoch = Math.max(player.epoch, transition.targetEpoch);
  player.eraTransition = null;
  notify(player, `Nouvelle époque atteinte : ${target?.name || 'époque suivante'}. Les recherches sont de nouveau disponibles.`);
  state.news.push({ day: state.day, text: `${player.name} entre dans l’époque : ${target?.name || 'époque suivante'}.` });
  return true;
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
  player.eraTransition = normalizeEraTransition(player.eraTransition, player);
  if (player.eraTransition) return false;
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
    processEraTransition(player);
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
        environment: {
          co2PerHour: 0,
          energyType: operatingModel.energyType || resourceCheck.type || '—',
          distance: round2(distance),
          frequency: round2(effectiveFrequency)
        },
        co2PerHour: 0,
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
    const lineCo2 = computeCo2(operatingModel, distance, serviceFactor);
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
      environment: {
        co2PerHour: Math.round(lineCo2),
        energyType: operatingModel.energyType || resourceCheck.type || '—',
        distance: round2(distance),
        frequency: round2(serviceFactor),
        consumptionReference: round2(operatingModel.energy || 0)
      },
      co2PerHour: Math.round(lineCo2),
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
  if (player) return Math.max(0, lineAssignedTrains(player, line).length);
  return Math.max(0, lineTrainIds(line).length);
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
  const assignedCount = lineSlotDemand(player, line);
  if (assignedCount <= 0) return emptyStaffNeeds();
  const distance = lineDistance(line);
  const trainCount = Math.max(1, assignedCount);
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
  // Depuis v66.0.0, les prérequis ne débloquent plus l'époque automatiquement.
  // Ils rendent seulement disponible le bouton de transition dans le menu R&D.
  return epochRequirementsMet(player, player.epoch + 1);
}

function trainModelSearchLabel(model) {
  return `${model?.id || ''} ${model?.name || ''} ${model?.type || ''}`.toLowerCase();
}

function trainModelIdSearchLabel(model) {
  return String(model?.id || '').toLowerCase();
}

function isMultipleUnitModel(model) {
  if (!model) return false;
  if (model.multipleUnit === true || model.compositionFamily === 'multiple_unit') return true;
  const id = trainModelIdSearchLabel(model);
  if (/(^|_)(emu|railcar|trainset|unit)(_|$)/.test(id)) return true;
  const label = trainModelSearchLabel(model);
  return /(autorail|automotrice|rame|navette|tgv|duplex|régio|regio|ter|hydrogène|hydrogene|batterie|maglev|grande vitesse)/.test(label);
}

function routeProfileForModel(model) {
  if (!model) return 'default';
  return isHighSpeedTrainsetModel(model) ? 'highspeed' : 'classic';
}

function routeProfileForLine(player, line) {
  const trains = lineAssignedTrains(player, line) || [];
  if (!trains.length) return 'default';
  return trains.some(train => routeProfileForModel(BALANCE.trains[train?.modelId]) === 'highspeed') ? 'highspeed' : 'classic';
}

function isHighSpeedTrainsetModel(model) {
  if (!model) return false;
  if (Number(model.multipleUnitMax || 0) === 2) return true;
  const id = trainModelIdSearchLabel(model);
  if (/^(hsv_|tgv)/.test(id) || /(_tgv|_duplex|trainset)/.test(id)) return true;
  const label = trainModelSearchLabel(model);
  return /(tgv|grande vitesse|duplex)/.test(label);
}

function multipleUnitMaxUnitsForModel(model) {
  if (!isMultipleUnitModel(model)) return 1;
  const explicit = Math.floor(Number(model?.multipleUnitMax || 0));
  if (explicit >= 1) return clamp(explicit, 1, 3);
  return isHighSpeedTrainsetModel(model) ? 2 : 3;
}

function compositionDefaultModeForModel(model) {
  if (isMultipleUnitModel(model)) return 'multiple_unit';
  const passengerDominant = (model.capacity || 0) >= Math.max(80, (model.freight || 0) * 0.9);
  return passengerDominant && (model.capacity || 0) > 0 ? 'passenger_loco' : 'freight_loco';
}

function normalizeTrainModelCompositionFlags(trains) {
  for (const model of Object.values(trains || {})) {
    if (!model || !isMultipleUnitModel(model)) continue;
    model.compositionFamily = 'multiple_unit';
    model.multipleUnit = true;
    model.passengerOnly = true;
    model.freight = 0;
    model.multipleUnitMax = multipleUnitMaxUnitsForModel(model);
  }
}

function compositionAvailableModesForModel(model) {
  const defaultMode = compositionDefaultModeForModel(model);
  if (defaultMode === 'multiple_unit') return ['multiple_unit'];
  return ['passenger_loco', 'freight_loco'];
}

function compositionSpecForModel(model, preferredMode = null) {
  const defaultMode = compositionDefaultModeForModel(model);
  if (defaultMode === 'multiple_unit') {
    const maxUnits = multipleUnitMaxUnitsForModel(model);
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
  if (spec.mode === 'multiple_unit') {
    train.composition = {
      mode: 'multiple_unit',
      passengerCars: 0,
      freightCars: 0,
      powerUnits: clamp(Math.round(Number(base.powerUnits ?? spec.powerUnits?.default ?? 1)), spec.powerUnits?.min ?? 1, spec.powerUnits?.max ?? 1),
      passengerVariant,
      freightVariant
    };
    return train.composition;
  }
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
    return Math.round(modelPrice);
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
  const requestedMode = mode || composition.mode || compositionDefaultModeForModel(model);
  const activeMode = compositionSpecForModel(model, requestedMode).mode;
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
  const composition = ensureTrainComposition(train, model);
  const currentCompositionValue = compositionAssetValue(model, composition, composition.mode);
  if (defaultMode === 'multiple_unit') {
    return Math.max(0, currentCompositionValue);
  }
  const defaultComposition = defaultCompositionForModel(model, defaultMode);
  const defaultCompositionValue = compositionAssetValue(model, defaultComposition, defaultMode);
  const baseTractionValue = Math.max(Math.round(Number(model?.price || 0) * 0.42), Math.round(Number(model?.price || 0) - defaultCompositionValue));
  return Math.max(0, baseTractionValue + currentCompositionValue);
}

