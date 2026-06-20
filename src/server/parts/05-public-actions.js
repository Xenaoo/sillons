// État public, création joueur et actions de gameplay.
function publicState(playerId, authUser = null) {
  const players = activePlayers().map(p => publicPlayer(p));
  const me = playerId ? players.find(p => p.id === playerId) || null : null;
  return {
    ok: true,
    serverTime: Date.now(),
    auth: authUser ? {
      username: authUser.username,
      playerId: authUser.playerId,
      isAdmin: isAdminUser(authUser),
      bugReportsReadAt: Number(authUser.bugReportsReadAt || 0) || 0,
      bugReportsUnreadCount: unreadBugReportCountForUser(authUser)
    } : null,
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
    bugReports: publicBugReports(authUser),
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
    eraTransition: publicEraTransition(p),
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
    notifications: normalizeNotifications(p.notifications).slice(-40).reverse(),
    notificationsReadAt: Number(p.notificationsReadAt || 0) || 0
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

function publicEraTransition(player) {
  player.eraTransition = normalizeEraTransition(player.eraTransition, player);
  const transition = player.eraTransition;
  if (!transition) return null;
  const target = BALANCE.epochs[transition.targetEpoch];
  return {
    ...transition,
    targetName: target?.name || `Époque ${transition.targetEpoch + 1}`,
    progress: round2((1 - transition.remainingMs / Math.max(1, transition.durationMs)) * 100),
    endAt: Date.now() + Math.max(0, transition.remainingMs),
    workRate: 1
  };
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
    eraTransition: null,
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
      id: crypto.randomUUID(),
      text: `Compagnie créée avec ${money(STARTING_CASH)}. Lance d’abord une recherche de traction, puis achète ton premier matériel roulant dans l’onglet Parc.`,
      createdAt: Date.now()
    }],
    notificationsReadAt: 0,
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
    duplicateTrain: () => actionDuplicateTrain(player, payload),
    sellTrain: () => actionSellTrain(player, payload),
    repairTrain: () => actionRepairTrain(player, payload),
    repairAllTrains: () => actionRepairAllTrains(player, payload),
    updateTrainComposition: () => actionUpdateTrainComposition(player, payload),
    setMaintenancePolicy: () => actionSetMaintenancePolicy(player, payload),
    createLine: () => actionCreateLine(player, payload),
    assignTrainToLine: () => actionAssignTrainToLine(player, payload),
    setTrainLineAssignment: () => actionSetTrainLineAssignment(player, payload),
    closeLine: () => actionCloseLine(player, payload),
    updateLine: () => actionUpdateLine(player, payload),
    upgradeStation: () => actionUpgradeStation(player, payload),
    sellStation: () => actionSellStation(player, payload),
    hireStaff: () => actionHireStaff(player, payload),
    fireStaff: () => actionFireStaff(player, payload),
    research: () => actionResearch(player, payload),
    cancelResearch: () => actionCancelResearch(player, payload),
    startEpochTransition: () => actionStartEpochTransition(player, payload),
    energyStrategy: () => actionEnergyStrategy(player, payload),
    buyResource: () => actionBuyResource(player, payload),
    setElectricityOrder: () => actionSetElectricityOrder(player, payload),
    takeLoan: () => actionTakeLoan(player, payload),
    repayLoan: () => actionRepayLoan(player, payload),
    rename: () => actionRename(player, payload),
    resetCompany: () => actionResetCompany(player, payload),
    tutorial: () => actionTutorial(player, payload),
    submitBugReport: () => actionSubmitBugReport(player, payload),
    closeBugReport: () => actionCloseBugReport(player, payload),
    markBugReportsRead: () => actionMarkBugReportsRead(player, payload),
    markNotificationsRead: () => actionMarkNotificationsRead(player, payload)
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
  const quantity = clamp(Math.floor(Number(payload.quantity || 1)), 1, 99);
  const multiplier = currentPriceMultiplier(player, model.energyType);
  const unitPrice = Math.round(model.price * multiplier);
  const price = Math.round(unitPrice * quantity);
  if (!canPay(player, price)) return fail(`Trésorerie insuffisante. Prix: ${money(price)}.`);
  player.cash -= price;
  for (let i = 0; i < quantity; i++) {
    player.trains.push(createTrainInstance(payload.modelId, player.id));
  }
  markTutorialAction(player, 'buyTrain');
  const quantityLabel = quantity > 1 ? `${quantity} exemplaires` : '1 exemplaire';
  notify(player, `Achat confirmé : ${quantityLabel} de ${model.name} pour ${money(price)}.`);
  return ok(quantity > 1 ? `${quantity} trains achetés.` : 'Train acheté.');
}


function cloneTrainInstanceForPlayer(sourceTrain, playerId) {
  const clone = createTrainInstance(sourceTrain.modelId, playerId);
  clone.condition = Math.max(0.5, Math.min(1, Number(sourceTrain.condition || 1)));
  clone.age = Math.max(0, Math.round(Number(sourceTrain.age || 0)));
  clone.composition = JSON.parse(JSON.stringify(sourceTrain.composition || {}));
  clone.name = sourceTrain.name ? `${sourceTrain.name} bis` : clone.name;
  return clone;
}

function actionDuplicateTrain(player, payload) {
  const source = player.trains.find(t => t.id === String(payload.trainId || ''));
  if (!source) return fail('Train introuvable.');
  if (source.maintenance?.active) return fail('Duplication indisponible.', 'Le train source est actuellement en maintenance.');
  const model = BALANCE.trains[source.modelId];
  if (!model) return fail('Modèle introuvable.');
  const multiplier = currentPriceMultiplier(player, model.energyType);
  const price = Math.round(model.price * multiplier * 0.98);
  if (!canPay(player, price)) return fail(`Trésorerie insuffisante. Prix: ${money(price)}.`);
  player.cash -= price;
  const clone = cloneTrainInstanceForPlayer(source, player.id);
  player.trains.push(clone);
  notify(player, `${model.name} dupliqué avec la même composition pour ${money(price)}.`);
  return ok('Train dupliqué.');
}

function lineSillonPurchaseCost(line, count = 1) {
  const distance = Math.max(1, lineDistance(line));
  const stops = Math.max(2, lineStops(line).length);
  return Math.round(Math.max(2500, distance * 780 + stops * 240) * Math.max(1, Number(count || 1)));
}

function newlyAddedTrainIds(currentIds, nextIds) {
  const current = new Set((currentIds || []).map(id => String(id || '').trim()).filter(Boolean));
  return [...new Set((nextIds || []).map(id => String(id || '').trim()).filter(Boolean))].filter(id => !current.has(id));
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
  removeTrainFromPlayerLines(player, train.id);
  notify(player, `${model.name} vendu pour ${money(value)}.`);
  return ok();
}



function prepareTrainCompositionUpdate(player, train, payload) {
  if (!train) return { ok: false, result: fail('Train introuvable.') };
  if (train.maintenance?.active) return { ok: false, result: fail('Composition indisponible.', 'Le train est actuellement en maintenance.') };
  const model = BALANCE.trains[train.modelId];
  if (!model) return { ok: false, result: fail('Modèle introuvable.') };
  const current = ensureTrainComposition(train, model);
  const requestedMode = payload.mode || current.mode;
  const availableModes = compositionAvailableModesForModel(model);
  if (payload.mode && !availableModes.includes(requestedMode)) {
    return { ok: false, result: fail('Composition incompatible.', `${model.name} ne peut pas recevoir ce type de composition.`) };
  }
  const spec = compositionSpecForModel(model, requestedMode);
  const updated = { ...current, mode: spec.mode };

  if (spec.mode === 'multiple_unit') {
    updated.powerUnits = clamp(Math.round(Number(payload.powerUnits ?? current.powerUnits)), spec.powerUnits.min, spec.powerUnits.max);
    updated.passengerCars = 0;
    updated.freightCars = 0;
  } else if (spec.mode === 'passenger_loco') {
    updated.passengerCars = clamp(Math.round(Number(payload.passengerCars ?? current.passengerCars)), spec.passengerCars.min, spec.passengerCars.max);
    const variant = compositionVariantForMode('passenger_loco', payload.passengerVariant ?? current.passengerVariant);
    if (!compositionVariantUnlockedForPlayer(player, model, variant)) {
      const tech = variant?.requiredTech ? techNodeById(variant.requiredTech) : null;
      return { ok: false, result: fail('Variante non débloquée.', tech ? `Recherche requise : ${tech.title}.` : 'Cette variante demande une époque plus avancée.') };
    }
    updated.passengerVariant = variant?.id || current.passengerVariant;
  } else {
    updated.freightCars = clamp(Math.round(Number(payload.freightCars ?? current.freightCars)), spec.freightCars.min, spec.freightCars.max);
    const variant = compositionVariantForMode('freight_loco', payload.freightVariant ?? current.freightVariant);
    if (!compositionVariantUnlockedForPlayer(player, model, variant)) {
      const tech = variant?.requiredTech ? techNodeById(variant.requiredTech) : null;
      return { ok: false, result: fail('Variante non débloquée.', tech ? `Recherche requise : ${tech.title}.` : 'Cette variante demande une époque plus avancée.') };
    }
    updated.freightVariant = variant?.id || current.freightVariant;
  }

  const targetComposition = { ...current, ...updated, mode: spec.mode };
  const economy = compositionChangeEconomy(model, current, targetComposition, train);
  const before = getTrainOperatingProfile({ ...train, composition: current }, model);
  const after = getTrainOperatingProfile({ ...train, composition: targetComposition }, model);
  return { ok: true, train, model, current, targetComposition, economy, before, after };
}

function actionUpdateTrainComposition(player, payload) {
  const requestedIds = Array.isArray(payload.trainIds) && payload.trainIds.length
    ? payload.trainIds
    : [payload.trainId];
  const trainIds = [...new Set(requestedIds.map(id => String(id || '').trim()).filter(Boolean))];
  if (!trainIds.length) return fail('Aucun train sélectionné.');

  const updates = [];
  for (const trainId of trainIds) {
    const train = player.trains.find(t => t.id === trainId);
    const prepared = prepareTrainCompositionUpdate(player, train, payload);
    if (!prepared.ok) return prepared.result;
    updates.push(prepared);
  }

  const totalCost = updates.reduce((sum, item) => sum + Math.max(0, Number(item.economy.cost || 0)), 0);
  const totalRefund = updates.reduce((sum, item) => sum + Math.max(0, Number(item.economy.refund || 0)), 0);
  const netCost = totalCost - totalRefund;
  if (netCost > 0 && !canPay(player, netCost)) {
    return fail(`Trésorerie insuffisante. Coût net de composition : ${money(netCost)}.`);
  }

  player.cash -= totalCost;
  player.cash += totalRefund;
  for (const update of updates) {
    update.train.composition = update.targetComposition;
  }

  markTutorialAction(player, 'compositionSaved');
  refreshPlayerLineStatsNow(player);
  const cashText = totalCost > 0
    ? `Coût : ${money(totalCost)}${totalRefund > 0 ? `, remboursement : ${money(totalRefund)}` : ''}.`
    : totalRefund > 0
      ? `Remboursement : ${money(totalRefund)}.`
      : 'Aucun coût.';
  if (updates.length === 1) {
    const update = updates[0];
    notify(player, `Composition mise à jour pour ${update.model.name} : ${update.after.compositionSummary}. ${cashText}`);
    return ok(`Composition mise à jour (${update.before.compositionSummary} → ${update.after.compositionSummary}). ${cashText}`);
  }
  notify(player, `${updates.length} compositions mises à jour. ${cashText}`);
  return ok(`${updates.length} compositions mises à jour. ${cashText}`);
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


async function actionAssignTrainToLine(player, payload) {
  const line = player.lines.find(l => l.id === String(payload.lineId || '') && l.active);
  if (!line) return fail('Ligne active introuvable.');
  normalizeLine(line);
  const trainId = String(payload.trainId || '').trim();
  const train = player.trains.find(t => t.id === trainId);
  if (!train) return fail('Train introuvable.');
  if (lineTrainIds(line).includes(trainId)) return fail('Ce train est déjà affecté à cette ligne.');
  if (train.maintenance?.active) return fail('Ce train est indisponible.', `Maintenance en cours : ${formatCycles(train.maintenance.daysLeft)} restant(s).`);
  if (trainUsedByActiveLine(player, trainId, line.id)) return fail('Ce train est déjà utilisé ailleurs.', 'Retire-le de son autre ligne avant de l’affecter ici.');
  const model = BALANCE.trains[train.modelId];
  const operatingModel = getTrainOperatingProfile(train, model, player);
  if (!lineServiceCompatibleWithProfile(line.service || 'passengers', operatingModel)) return fail('Ce train n’est pas compatible avec le service de la ligne.');

  const routeInfo = await realRailRouteBetweenStops(lineStops(line));
  if (!routeInfo.ids.length || routeInfo.distance <= 0) return fail('Impossible de recalculer l’itinéraire RFN de cette ligne.');
  const effectiveRange = effectiveTrainRange(player, operatingModel, routeInfo);
  if (routeInfo.distance > effectiveRange) return fail(`Portée insuffisante : ligne ${Math.round(routeInfo.distance)} km, train ${Math.round(effectiveRange)} km.`);

  const currentIds = lineTrainIds(line);
  const nextIds = [...new Set([...currentIds, trainId])];
  const usage = buildSillonUsage();
  const previousIds = line.trainIds;
  line.trainIds = nextIds;
  line.trainId = nextIds[0];
  const sillonInfo = computeLineSillonLimit(player, line, usage);
  line.trainIds = previousIds;
  line.trainId = currentIds[0] || line.trainId;
  if (sillonInfo.constrained) {
    return fail('Sillon indisponible sur cette ligne.', `Disponibles au tronçon limitant : ${Math.floor(Number(sillonInfo.maxFrequency || 0))}.`);
  }

  const cost = lineSillonPurchaseCost(line, 1);
  if (!canPay(player, cost)) return fail(`Trésorerie insuffisante. Coût du sillon : ${money(cost)}.`);
  player.cash -= cost;
  line.trainIds = nextIds;
  line.trainId = nextIds[0];
  line.sillonRightsCost = Math.round(Number(line.sillonRightsCost || 0) + cost);
  normalizeLine(line);
  refreshPlayerLineStatsNow(player);
  notify(player, `Sillon acheté sur ${lineRouteName(lineStops(line))} : ${BALANCE.trains[train.modelId]?.name || 'train'} affecté pour ${money(cost)}.`);
  return ok('Sillon acheté et train affecté.');
}

async function actionSetTrainLineAssignment(player, payload) {
  const trainId = String(payload.trainId || '').trim();
  const targetLineId = String(payload.lineId || '').trim();
  const train = player.trains.find(t => t.id === trainId);
  if (!train) return fail('Train introuvable.');

  const currentLine = (player.lines || []).find(line => line?.active && lineTrainIds(line).includes(trainId)) || null;
  if (!targetLineId) {
    if (!currentLine) return ok('Ce train est déjà libre.');
    const nextCurrentIds = lineTrainIds(currentLine).filter(id => id !== trainId);
    currentLine.trainIds = nextCurrentIds;
    currentLine.trainId = nextCurrentIds[0] || '';
    refreshPlayerLineStatsNow(player);
    notify(player, `${BALANCE.trains[train.modelId]?.name || 'Train'} retiré de ${lineRouteName(lineStops(currentLine))}.`);
    return ok('Train retiré de la ligne.');
  }

  const targetLine = player.lines.find(l => l.id === targetLineId && l.active);
  if (!targetLine) return fail('Ligne active introuvable.');
  normalizeLine(targetLine);
  if (currentLine?.id === targetLine.id) return ok('Ce train est déjà affecté à cette ligne.');
  if (train.maintenance?.active) return fail('Ce train est indisponible.', `Maintenance en cours : ${formatCycles(train.maintenance.daysLeft)} restant(s).`);

  const model = BALANCE.trains[train.modelId];
  const operatingModel = getTrainOperatingProfile(train, model, player);
  if (!lineServiceCompatibleWithProfile(targetLine.service || 'passengers', operatingModel)) return fail('Ce train n’est pas compatible avec le service de la ligne.');

  const routeInfo = await realRailRouteBetweenStops(lineStops(targetLine));
  if (!routeInfo.ids.length || routeInfo.distance <= 0) return fail('Impossible de recalculer l’itinéraire RFN de cette ligne.');
  const effectiveRange = effectiveTrainRange(player, operatingModel, routeInfo);
  if (routeInfo.distance > effectiveRange) return fail(`Portée insuffisante : ligne ${Math.round(routeInfo.distance)} km, train ${Math.round(effectiveRange)} km.`);

  const targetIds = lineTrainIds(targetLine).filter(id => id !== trainId);
  const nextTargetIds = [...new Set([...targetIds, trainId])];
  const originalTargetIds = Array.isArray(targetLine.trainIds) ? [...targetLine.trainIds] : undefined;
  const originalTargetTrainId = targetLine.trainId;
  const originalCurrentIds = currentLine ? (Array.isArray(currentLine.trainIds) ? [...currentLine.trainIds] : undefined) : undefined;
  const originalCurrentTrainId = currentLine?.trainId;

  if (currentLine && currentLine.id !== targetLine.id) {
    const nextCurrentIds = lineTrainIds(currentLine).filter(id => id !== trainId);
    currentLine.trainIds = nextCurrentIds;
    currentLine.trainId = nextCurrentIds[0] || '';
  }
  targetLine.trainIds = nextTargetIds;
  targetLine.trainId = nextTargetIds[0] || '';
  const usage = buildSillonUsage();
  const sillonInfo = computeLineSillonLimit(player, targetLine, usage);

  if (currentLine && currentLine.id !== targetLine.id) {
    if (originalCurrentIds !== undefined) currentLine.trainIds = originalCurrentIds;
    else delete currentLine.trainIds;
    currentLine.trainId = originalCurrentTrainId;
  }
  if (originalTargetIds !== undefined) targetLine.trainIds = originalTargetIds;
  else delete targetLine.trainIds;
  targetLine.trainId = originalTargetTrainId;

  if (sillonInfo.constrained) {
    return fail('Sillon indisponible sur cette ligne.', `Disponibles au tronçon limitant : ${Math.floor(Number(sillonInfo.maxFrequency || 0))}.`);
  }

  const cost = lineSillonPurchaseCost(targetLine, 1);
  if (!canPay(player, cost)) return fail(`Trésorerie insuffisante. Coût du sillon : ${money(cost)}.`);
  player.cash -= cost;

  if (currentLine && currentLine.id !== targetLine.id) {
    const nextCurrentIds = lineTrainIds(currentLine).filter(id => id !== trainId);
    currentLine.trainIds = nextCurrentIds;
    currentLine.trainId = nextCurrentIds[0] || '';
  }
  targetLine.trainIds = nextTargetIds;
  targetLine.trainId = nextTargetIds[0] || '';
  targetLine.sillonRightsCost = Math.round(Number(targetLine.sillonRightsCost || 0) + cost);
  refreshPlayerLineStatsNow(player);
  notify(player, `${BALANCE.trains[train.modelId]?.name || 'Train'} ${currentLine ? 'déplacé' : 'affecté'} sur ${lineRouteName(lineStops(targetLine))} pour ${money(cost)}.`);
  return ok(currentLine ? 'Train déplacé et sillon acheté.' : 'Train affecté et sillon acheté.');
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

  const currentTrainIds = lineTrainIds(line);
  const currentTrainKey = currentTrainIds.join('|');
  const nextTrainKey = nextTrainIds.join('|');
  if (currentTrainKey !== nextTrainKey) {
    const addedTrainIds = newlyAddedTrainIds(currentTrainIds, nextTrainIds);
    if (addedTrainIds.length) {
      const previousIds = line.trainIds;
      const previousId = line.trainId;
      const usage = buildSillonUsage();
      line.trainIds = [...nextTrainIds];
      line.trainId = nextTrainIds[0];
      const sillonInfo = computeLineSillonLimit(player, line, usage);
      line.trainIds = previousIds;
      line.trainId = previousId;
      if (sillonInfo.constrained) {
        return fail('Sillons insuffisants sur cette ligne.', `Disponibles au tronçon limitant : ${Math.floor(Number(sillonInfo.maxFrequency || 0))}.`);
      }
      const sillonCost = lineSillonPurchaseCost(line, addedTrainIds.length);
      if (!canPay(player, sillonCost)) return fail(`Trésorerie insuffisante. Coût des sillons : ${money(sillonCost)}.`);
      player.cash -= sillonCost;
      line.sillonRightsCost = Math.round(Number(line.sillonRightsCost || 0) + sillonCost);
    }
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
  if (wasUnowned) {
    return fail('Achat de gare retiré.', `${station.name} reste libre : utilise l’achat de sillons depuis une ligne pour y faire circuler ton matériel.`);
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

  const cost = stationUpgradeCost(station, asset, kind);
  if (!Number.isFinite(cost) || cost <= 0) return fail('Coût d’amélioration invalide.');
  if (!canPay(player, cost)) return fail(`Trésorerie insuffisante. Coût: ${money(cost)}.`);

  player.cash -= cost;
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

  notify(
    player,
    `${station.name} vendue : remboursement ${money(refund.total)} ` +
    `(gare ${money(refund.acquisition)}, niveaux ${money(refund.levels)}, commerces ${money(refund.commerces)}, ateliers ${money(refund.maintenance)}, dépôt ${money(refund.depot)}).`
  );
  return ok(`${station.name} vendue pour ${money(refund.total)}.`);
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
  player.eraTransition = normalizeEraTransition(player.eraTransition, player);
  if (player.eraTransition) {
    const target = BALANCE.epochs[player.eraTransition.targetEpoch];
    return fail('Transition d’époque en cours.', `Aucune recherche ne peut être lancée pendant le passage vers ${target?.name || 'l’époque suivante'}.`);
  }
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


function epochRequirementsMet(player, targetEpoch = player.epoch + 1) {
  const next = BALANCE.epochs[targetEpoch];
  if (!next) return false;
  const totalTech = Object.values(player.tech || {}).reduce((a, b) => a + Number(b || 0), 0);
  const trafficTotal = epochTrafficTotal(player);
  return totalTech >= Number(next.requiredTech || 0) && trafficTotal >= Number(next.requiredTraffic || 0);
}

function actionStartEpochTransition(player, payload) {
  player.eraTransition = normalizeEraTransition(player.eraTransition, player);
  if (player.eraTransition) return fail('Transition d’époque déjà en cours.', 'Attends la fin du passage d’ère avant d’en lancer un autre.');
  player.researchProject = normalizeResearchProject(player.researchProject);
  player.researchQueue = normalizeResearchQueue(player.researchQueue);
  if (player.researchProject) return fail('Recherche en cours.', 'Termine ou annule la recherche active avant de lancer le passage à l’époque suivante.');
  if (player.researchQueue.length) return fail('File R&D non vide.', 'Vide ou laisse terminer la file de recherche avant de lancer le passage à l’époque suivante.');
  const targetEpoch = player.epoch + 1;
  const next = BALANCE.epochs[targetEpoch];
  if (!next) return fail('Aucune époque suivante.', 'Toutes les époques sont déjà débloquées.');
  if (!epochRequirementsMet(player, targetEpoch)) {
    const totalTech = Object.values(player.tech || {}).reduce((a, b) => a + Number(b || 0), 0);
    const trafficTotal = epochTrafficTotal(player);
    return fail('Prérequis d’époque incomplets.', `Requis : ${Math.round(totalTech)}/${next.requiredTech} technologie et ${Math.round(trafficTotal)}/${next.requiredTraffic} trafic cumulé.`);
  }
  const now = Date.now();
  const durationMs = eraTransitionDurationMs(targetEpoch);
  player.eraTransition = { targetEpoch, remainingMs: durationMs, durationMs, startedAt: now, updatedAt: now };
  notify(player, `Passage d’époque lancé : ${next.name}. R&D indisponible jusqu’à la fin de la transition.`);
  return ok(`Passage vers ${next.name} lancé.`);
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

