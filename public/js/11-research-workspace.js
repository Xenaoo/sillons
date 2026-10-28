// Catalogue R&D : une seule liste filtrable, détails intégrés et états explicites.
function researchNodeState(node) {
  const acquired = techLevel(node.id);
  const planned = plannedTechLevel(node.id);
  const max = techMaxLevel(node);
  const complete = Number.isFinite(max) && acquired >= max;
  const pending = planned > acquired;
  const capped = Number.isFinite(max) && planned >= max;
  const target = capped ? max : planned + 1;
  const cost = complete || capped ? 0 : researchCostMoneyClient(node, target);
  const duration = researchDurationClient(node, target) / Math.max(.01, researchWorkRateClient());
  const reason = complete ? 'Tous les niveaux sont acquis.' : capped ? 'Le dernier niveau est déjà en cours ou dans la file.'
    : researchBlockedByEraTransition() ? 'Passage d’époque en cours.'
    : techLockedReason(node, target) || (app.state.me.cash < cost ? 'Budget insuffisant.' : '');
  const status = complete ? 'complete' : pending ? 'pending' : reason ? 'locked' : 'available';
  const label = { complete: 'Acquise', pending: 'Planifiée', locked: 'Bloquée', available: 'Disponible' }[status];
  return { acquired, planned, max, target, cost, duration, reason, status, label, launchable: !reason };
}

function renderResearch() {
  const me = app.state.me;
  const groups = Object.values(app.state.balance.techTree || {});
  if (!groups.some(group => group.id === app.activeResearchTab)) app.activeResearchTab = groups[0]?.id || '';
  const project = me.researchProject;
  const next = app.state.balance.epochs[me.epoch + 1];
  const totalTech = Object.values(me.tech || {}).reduce((a, b) => a + Number(b || 0), 0);
  const traffic = epochTrafficTotalClient(me);
  const eras = [...new Map(allResearchEntriesClient().map(({ node }) => [String(node.era || 0), node.eraLabel || 'Général'])).entries()];
  return `<section class="rd-workspace" aria-label="Recherche et développement">
    <header class="rd-header"><div><span class="rd-eyebrow">Développement du réseau</span><h2>Recherche & développement</h2></div>
      <span class="rd-capacity" tabindex="0" ${tooltipAttr(researchCapacityTooltipClient(me))}>Laboratoire · ${round(researchWorkRateClient(me))}× <span aria-hidden="true">ⓘ</span></span>
    </header>
    <section class="rd-program" aria-label="Programme en cours">
      ${project ? `<div class="rd-program-heading"><div><span class="rd-eyebrow">En cours</span><strong>${escapeHtml(project.title || techNodeTitle(project.nodeId))} <small>niv. ${Number(project.targetLevel || 1)}</small></strong></div>
        <span class="rd-time" data-research-timer data-end-at="${Math.round(project.endAt || 0)}">${formatResearchTime(project.realRemainingMs ?? project.remainingMs)}</span>
        <button class="ghost danger" data-action="cancel-research" data-source="active" data-id="${escapeAttr(project.nodeId)}" data-level="${Number(project.targetLevel || 1)}" ${tooltipAttr(`Remboursement : ${money(project.costMoney || 0)}\nLes projets dépendants seront aussi annulés et remboursés.`)}>Annuler</button></div>
        <div class="progress research-progress"><i data-research-progress data-research-key="${escapeAttr(researchProjectKey(project))}" data-end-at="${Math.round(project.endAt || 0)}" data-duration-ms="${Math.round(project.durationMs || 1)}" data-work-rate="${Number(project.workRate || 1)}" data-last-progress="${round(researchProgressPercent(project))}" style="width:${round(researchProgressPercent(project))}%"></i></div>`
        : `<div class="rd-program-heading"><strong>${me.eraTransition ? 'Passage d’époque en cours' : 'Laboratoire disponible'}</strong><span>${me.eraTransition ? 'Les recherches reprendront à la fin de la transition.' : 'Choisissez une technologie pour lancer un projet.'}</span></div>`}
      <p class="rd-note">Fonctionnement du laboratoire : ${moneyPerHour(economyValue('researchLabBaseCost', 180))} pendant un projet, en plus du coût initial.</p>
      ${renderResearchQueue(me)}
    </section>
    <details class="rd-epoch" ${app.researchEpochOpen || me.eraTransition ? 'open' : ''}>
      <summary><span>Époque · <b>${escapeHtml(me.eraName)}</b></span><span>${next ? `Objectif : ${escapeHtml(next.name)}` : 'Toutes les époques débloquées'}</span></summary>
      <div class="rd-epoch-body">${next ? `<div class="rd-epoch-metrics"><span>Technologie <b>${formatInt(totalTech)} / ${formatInt(next.requiredTech)}</b></span><span>Trafic cumulé <b>${formatInt(traffic)} / ${formatInt(next.requiredTraffic)}</b></span></div>
        <div class="rd-prereqs">${(next.requiredResearch || []).map(renderResearchDetailPrereq).join('')}</div>` : ''}
        ${renderEraTransitionPanel(me, next, totalTech, traffic)}</div>
    </details>
    <nav class="rd-branches" aria-label="Branches de recherche">${groups.map(group => `<button type="button" data-action="research-tab" data-id="${escapeAttr(group.id)}" aria-pressed="${group.id === app.activeResearchTab}" class="${group.id === app.activeResearchTab ? 'active' : ''}">${escapeHtml(group.label)} <span>${(group.nodes || []).length}</span></button>`).join('')}</nav>
    <div class="rd-filters">
      <label class="rd-search"><span>Rechercher dans toute la R&D</span><input type="search" id="researchSearchInput" value="${escapeAttr(app.researchSearchQuery || '')}" placeholder="Technologie, train, bonus…" autocomplete="off"></label>
      <label><span>État</span><select id="researchStatusFilter">${[['all','Tous les états'],['available','Disponibles'],['pending','Planifiées'],['locked','Bloquées'],['complete','Déjà étudiées']].map(([value,label]) => `<option value="${value}" ${(app.researchStatusFilter || 'all') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label><span>Époque</span><select id="researchEraFilter"><option value="all">Toutes les époques</option>${eras.map(([value,label]) => `<option value="${escapeAttr(value)}" ${app.researchEraFilter === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
    </div>
    <div id="researchSearchResults" class="rd-results">${renderResearchSearchResults()}</div>
  </section>`;
}

function renderResearchSearchResults(query = app.researchSearchQuery) {
  const searching = Boolean(String(query || '').trim());
  const entries = searching ? researchSearchResults(query) : allResearchEntriesClient().filter(({ group }) => group.id === app.activeResearchTab);
  const status = app.researchStatusFilter || 'all';
  const era = app.researchEraFilter || 'all';
  const filtered = entries.filter(({ node }) => (status === 'all' || (status === 'complete' ? techLevel(node.id) > 0 : researchNodeState(node).status === status)) && (era === 'all' || String(node.era || 0) === era));
  const groups = new Map();
  for (const entry of filtered) {
    const label = entry.node.eraLabel || 'Général';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(entry);
  }
  return `<div class="rd-results-heading"><span role="status">${filtered.length} technologie${filtered.length > 1 ? 's' : ''}${searching ? ' · Toutes les branches' : ''}</span><button type="button" class="ghost" data-action="reset-research-filters">Réinitialiser</button></div>
    ${filtered.length ? [...groups].map(([label, items]) => `<section class="rd-era-group"><h3>${escapeHtml(label)} <span>${items.length}</span></h3><div class="rd-list">${items.map(({ node, group }) => renderResearchCompactRow(node, searching ? group.label : '')).join('')}</div></section>`).join('') : '<p class="rd-empty">Aucune technologie ne correspond à ces critères. Essayez une autre recherche ou réinitialisez les filtres.</p>'}`;
}

function renderResearchCompactRow(node, branch = '') {
  const state = researchNodeState(node);
  const selected = app.selectedResearchId === node.id;
  const summary = (node.unlocks || [])[0] || node.description || (node.improves || [])[0] || 'Développement de la branche';
  return `<article class="rd-row ${selected ? 'selected' : ''}" data-node-id="${escapeAttr(node.id)}">
    <div class="rd-row-main">
      <button class="rd-row-select" type="button" data-action="select-research-node" data-id="${escapeAttr(node.id)}" aria-expanded="${selected}">
        <strong>${escapeHtml(node.title)} <span class="rd-level">niv. ${state.acquired}${Number.isFinite(state.max) ? `/${state.max}` : ' · ∞'}</span></strong>
        <span class="rd-row-summary">${branch ? `${escapeHtml(branch)} · ` : ''}${escapeHtml(summary)}</span>
      </button>
      <span class="rd-status ${state.status}">${state.label}</span>
      <div class="rd-row-cost"><b>${state.cost ? money(state.cost) : '—'}</b><span>${state.cost ? formatResearchTime(state.duration) : state.status === 'complete' ? 'Terminée' : `Prévu : niv. ${state.planned}`}</span></div>
      <button class="rd-info" type="button" data-action="select-research-node" data-id="${escapeAttr(node.id)}" aria-label="Détails : ${escapeAttr(node.title)}" ${tooltipAttr(`${node.title}\nÉtat : ${state.label}${state.planned > state.acquired ? ` · niveau ${state.planned} prévu` : ''}\n${state.reason || `Coût : ${money(state.cost)}\nDurée à capacité actuelle : ${formatResearchTime(state.duration)}`}\nOuvrir la fiche pour les effets et prérequis.`)}>ⓘ</button>
    </div>
    ${selected ? renderResearchDetailOverlay() : ''}
  </article>`;
}

function renderResearchDetailOverlay() {
  const node = techNodeById(app.selectedResearchId);
  if (!node) return '';
  const state = researchNodeState(node);
  const prereqs = researchPrereqsForLevelClient(node, state.target);
  const effects = (node.improves || node.effects || []).filter(effect => effect && !String(effect).toLowerCase().includes('niveaux suivants'));
  return `<section class="rd-inspector" aria-label="Détails : ${escapeAttr(node.title)}">
    <div class="rd-inspector-heading"><p>${escapeHtml(node.description || 'Consultez les effets et conditions de cette technologie.')}</p><button type="button" class="ghost" data-action="close-research-detail" aria-label="Fermer les détails">×</button></div>
    <div class="rd-inspector-columns"><div><h4>Effets & déblocages</h4><ul>${[...effects, ...(node.unlocks || [])].map(effect => `<li>${escapeHtml(effect)}</li>`).join('') || '<li>Contribution au niveau de la branche.</li>'}</ul></div>
      <div><h4>Prérequis · niveau ${state.target}</h4><p>${escapeHtml(node.eraLabel || 'Époque initiale')}</p><div class="rd-prereqs">${prereqs.length ? prereqs.map(renderResearchDetailPrereq).join('') : '<span>Aucune technologie requise.</span>'}</div></div></div>
    <footer class="rd-inspector-footer"><span>${escapeHtml(state.reason || `Niveau ${state.target} · ${money(state.cost)} · ${formatResearchTime(state.duration)}`)}</span>
      <button type="button" class="primary" data-action="research-node" data-id="${escapeAttr(node.id)}" ${state.launchable ? '' : 'disabled'}>${state.status === 'complete' ? 'Acquise' : !state.launchable ? 'Indisponible' : app.state.me.researchProject ? `Ajouter à la file · niv. ${state.target}` : `Lancer · niv. ${state.target}`}</button></footer>
  </section>`;
}

function refreshResearchSearchResults() {
  hideGlobalTooltip();
  const results = $('#researchSearchResults');
  if (results) results.innerHTML = renderResearchSearchResults();
}

function bindResearchWorkspace() {
  $('#tabContent').addEventListener('change', event => {
    if (event.target.id === 'researchStatusFilter') app.researchStatusFilter = event.target.value;
    else if (event.target.id === 'researchEraFilter') app.researchEraFilter = event.target.value;
    else return;
    refreshResearchSearchResults();
  });
  $('#tabContent').addEventListener('toggle', event => {
    if (event.target.matches('.rd-epoch')) app.researchEpochOpen = event.target.open;
  }, true);
}
