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
  const playerCapacity = theoreticalCapacity;
  const displayCapacity = theoreticalCapacity;
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
