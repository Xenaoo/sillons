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
