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
        ${budgetRow('Gares', b.stationCost || 0, 'expense', 'Niveaux, commerces, ateliers, dépôts')}
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

