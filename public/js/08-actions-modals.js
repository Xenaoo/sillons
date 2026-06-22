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
  if (sale.unavailable.length) return toast('Vente impossible : un ou plusieurs trains sont en maintenance ou affectés à une ligne active.', 'error');
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
  app.activeTab = 'fleet';
  app.activeFleetSubtab = 'composition';
  setCompositionSelection([trainId], trainId);
  setCompositionEditorTrain(trainId);
  localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
  renderAll();
  return;
}
if (action === 'save-train-composition') {
  const trainId = button.dataset.id;
  const train = app.state.me.trains.find(t => t.id === trainId);
  if (!train) return;
  const targetIds = compositionEditTargetIds(trainId);
  if (!targetIds.length) return toast('Aucun train sélectionné.', 'error');
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
        if (!(await gameConfirm('Acheter plusieurs trains', `Acheter ${quantity} exemplaires de ${model?.name || 'ce matériel'} ?

Coût total estimé : ${money(totalPrice)}.`, { confirmLabel: 'Acheter' }))) return;
      }
      return doAction('buyTrain', { modelId, quantity });
    }
  if (action === 'duplicate-train') {
    const train = app.state.me.trains.find(t => t.id === button.dataset.id);
    const model = train ? app.state.balance.trains[train.modelId] : null;
    const price = Math.round((model?.price || 0) * 0.98);
    if (!(await gameConfirm('Dupliquer un train', `Acheter un exemplaire identique de ${model?.name || 'ce matériel'} avec la même composition ?

Coût estimé : ${money(price)}.`, { confirmLabel: 'Dupliquer' }))) return;
    return doAction('duplicateTrain', { trainId: button.dataset.id });
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
    app.state = response.state || app.state;
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
