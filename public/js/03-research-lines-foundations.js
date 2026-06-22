// Helpers R&D, métriques, art et fondations des écrans.
function techLevel(nodeId) {
  const value = app.state?.me?.techUnlocked?.[nodeId];
  if (value === true) return 1;
  return Math.max(0, Math.floor(Number(value || 0)));
}

function plannedTechLevel(nodeId) {
  let level = techLevel(nodeId);
  const project = app.state?.me?.researchProject;
  if (project?.nodeId === nodeId) level = Math.max(level, Number(project.targetLevel || 0));
  for (const item of app.state?.me?.researchQueue || []) {
    if (item.nodeId === nodeId) level = Math.max(level, Number(item.targetLevel || 0));
  }
  return level;
}

function techMaxLevel(node) {
  const raw = Number(node?.maxLevel);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : Number.POSITIVE_INFINITY;
}

function techMaxLevelLabel(node) {
  return Number.isFinite(techMaxLevel(node)) ? String(techMaxLevel(node)) : '∞';
}

function nextTechLevel(node) {
  const max = techMaxLevel(node);
  const next = techLevel(node.id) + 1;
  return Number.isFinite(max) ? Math.min(max, next) : next;
}

function boundedExponentialClient(base, growth, exponent, cap = Number.MAX_SAFE_INTEGER) {
  const b = Math.max(0, Number(base || 0));
  const g = Math.max(1.01, Number(growth || 1));
  const e = Math.max(0, Number(exponent || 0));
  if (!Number.isFinite(b) || b <= 0) return 0;
  const logValue = Math.log(b) + Math.log(g) * e;
  if (!Number.isFinite(logValue) || logValue >= Math.log(cap)) return cap;
  return Math.min(cap, b * Math.exp(Math.log(g) * e));
}

function researchCostMoneyClient(node, targetLevel) {
  const level = Math.min(RESEARCH_TECHNICAL_MAX_LEVEL, Math.max(1, Math.floor(Number(targetLevel || 1))));
  const base = Number(node.baseCostMoney ?? node.costMoney ?? 50000);
  const growth = Number(node.costGrowth ?? 1.62);
  const epochFactor = 1 + Math.max(0, Number(node.requiredEpoch || 0)) * 0.22;
  return Math.round(boundedExponentialClient(base * epochFactor, growth, level - 1));
}

function researchDurationClient(node, targetLevel) {
  const level = Math.min(RESEARCH_TECHNICAL_MAX_LEVEL, Math.max(1, Math.floor(Number(targetLevel || 1))));
  const base = Number(node.baseDurationSeconds ?? node.baseDuration ?? node.duration ?? 30);
  const growth = Number(node.durationGrowth ?? 1.5);
  return Math.max(15000, Math.round(boundedExponentialClient(base, growth, level - 1, 315360000) * 1000));
}

function researchWorkRateClient(me = app.state?.me) {
  return me?.researchProject?.workRate || me?.research || 1;
}

function researchCapacityTooltipClient(me = app.state?.me) {
  const reputation = Number(me?.reputation || 0);
  const reputationBonus = Math.min(0.32, Math.max(0, reputation - 50) * 0.004);
  const crewTrainingLevel = techLevel('crew_training');
  const crewTrainingBonus = crewTrainingLevel * 0.025;
  const centralizedControlLevel = techLevel('centralized_control');
  const centralizedControlBonus = Math.min(0.22, centralizedControlLevel * 0.018);
  const total = 1 + reputationBonus + crewTrainingBonus + centralizedControlBonus;
  return [
    'Capacité R&D : vitesse réelle de progression des recherches.',
    `Valeur actuelle : ${round(researchWorkRateClient(me))}x. Une valeur de 1,20x signifie +20% de vitesse.`,
    '---------------------------------------------',
    'Sources des modificateurs :',
    'Base laboratoire : 1,00x',
    `Réputation (${Math.round(reputation)}/100) : +${round(reputationBonus)}x`,
    `Formation équipages niv. ${crewTrainingLevel} : +${round(crewTrainingBonus)}x`,
    `Commande centralisée niv. ${centralizedControlLevel} : +${round(centralizedControlBonus)}x`,
    `Total calculé : ${round(total)}x`
  ].join('\n');
}

function normalizeResearchPrereqItemClient(item) {
  if (!item) return null;
  if (typeof item === 'string') return { id: item, level: 1 };
  if (Array.isArray(item.anyOf)) {
    const anyOf = item.anyOf.map(normalizeResearchPrereqItemClient).filter(Boolean).filter(req => !req.anyOf);
    return anyOf.length ? { anyOf } : null;
  }
  return { id: item.id, level: Math.max(1, Math.floor(Number(item.level || 1))) };
}

function researchPrereqsForLevelClient(node, targetLevel) {
  const all = [...(node.prereq || [])];
  for (const entry of node.levelPrereq || []) {
    if (targetLevel >= Number(entry.level || 1)) all.push(...(entry.requires || []));
  }
  return all.map(normalizeResearchPrereqItemClient).filter(Boolean);
}

function researchPrereqSatisfiedClient(req) {
  if (req.anyOf) return req.anyOf.some(researchPrereqSatisfiedClient);
  return plannedTechLevel(req.id) >= req.level;
}

function researchPrereqLabelClient(req) {
  if (req.anyOf) return req.anyOf.map(researchPrereqLabelClient).join(' ou ');
  return `${techNodeTitle(req.id)} niv. ${req.level}`;
}

function researchGroupForNode(nodeId) {
  const tree = app.state?.balance?.techTree || {};
  for (const group of Object.values(tree)) {
    if ((group.nodes || []).some(node => node.id === nodeId)) return group.id;
  }
  return '';
}


function researchEraStorageKey(groupId, bucket) {
  const era = bucket?.era || 0;
  const label = bucket?.label || 'Général';
  return `${groupId || 'research'}::${era}::${label}`;
}

function researchEraBucketForNode(nodeId) {
  const tree = app.state?.balance?.techTree || {};
  for (const group of Object.values(tree)) {
    const node = (group.nodes || []).find(item => item.id === nodeId);
    if (node) {
      return {
        groupId: group.id,
        bucket: { era: node.era || 0, label: node.eraLabel || group.label || 'Général' }
      };
    }
  }
  return null;
}

function isResearchEraCollapsed(groupId, bucket) {
  return Boolean(app.researchEraCollapsed?.[researchEraStorageKey(groupId, bucket)]);
}

function setResearchEraCollapsed(groupId, bucket, collapsed) {
  const key = researchEraStorageKey(groupId, bucket);
  app.researchEraCollapsed = { ...(app.researchEraCollapsed || {}), [key]: Boolean(collapsed) };
  if (!collapsed) delete app.researchEraCollapsed[key];
  localStorage.setItem('sillons.researchEraCollapsed', JSON.stringify(app.researchEraCollapsed));
}

function toggleResearchEra(groupId, bucketKey) {
  const tree = app.state?.balance?.techTree || {};
  const group = tree[groupId];
  if (!group) return;
  const nodes = group.nodes || [];
  const buckets = researchEraBucketsForGroup(group);
  const bucket = buckets.find(item => item.key === bucketKey);
  if (!bucket) return;
  setResearchEraCollapsed(groupId, bucket, !isResearchEraCollapsed(groupId, bucket));
  renderAll();
}

function focusResearchNode(nodeId) {
  const groupId = researchGroupForNode(nodeId);
  if (!groupId) return;
  app.activeTab = 'research';
  app.activeResearchTab = groupId;
  app.highlightResearchId = nodeId;
  const bucketInfo = researchEraBucketForNode(nodeId);
  if (bucketInfo) setResearchEraCollapsed(bucketInfo.groupId, bucketInfo.bucket, false);
  localStorage.setItem('sillons.activeTab', app.activeTab);
  localStorage.setItem('sillons.researchTab', app.activeResearchTab);
  renderAll();
  requestAnimationFrame(() => {
    const el = document.querySelector(`.tech-node[data-node-id="${CSS.escape(nodeId)}"]`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  setTimeout(() => {
    if (app.highlightResearchId === nodeId) {
      app.highlightResearchId = '';
      renderAll();
    }
  }, 2800);
}

function selectResearchNode(nodeId) {
  const groupId = researchGroupForNode(nodeId);
  if (!groupId) return;
  app.activeTab = 'research';
  app.activeResearchTab = groupId;
  app.selectedResearchId = nodeId;
  app.highlightResearchId = '';
  localStorage.setItem('sillons.activeTab', app.activeTab);
  localStorage.setItem('sillons.researchTab', app.activeResearchTab);
  renderAll();
  requestAnimationFrame(() => {
    const el = document.querySelector(`.tech-node[data-node-id="${CSS.escape(nodeId)}"]`);
    if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  });
}

function closeResearchDetails() {
  if (!app.selectedResearchId) return;
  app.selectedResearchId = '';
  renderAll();
}

function researchEffectTarget(effect, node) {
  const text = `${effect || ''} ${node?.title || ''} ${node?.branch || ''}`.toLowerCase();
  if (/rh|équipe|conducteur|agent|formation|salariale|recrutement/.test(text)) return { tab: 'staff', label: 'Ressources humaines' };
  if (/gare|station|hub|quai|commerce|terminal voyageurs|flux voyageurs|bâtiment/.test(text)) return { tab: 'stations', label: 'Gares' };
  if (/énergie|charbon|diesel|électr|batterie|hydrogène|caténaire|co2/.test(text)) return { tab: 'market', label: 'Énergie & contrats' };
  if (/fret|wagon|conteneur|marchandises|vrac|logistique|portuaire/.test(text)) return { tab: 'lines', label: 'Lignes fret' };
  if (/maintenance|atelier|dépôt|révision|usure|fiabilité/.test(text)) return { tab: 'fleet', fleetSubtab: 'maintenance', label: 'Maintenance du parc' };
  if (/rame|locomotive|train|matériel|voiture|duplex|autorail|pacific|mountain|tgv|maglev/.test(text)) return { tab: 'fleet', fleetSubtab: 'catalog', label: 'Catalogue du parc' };
  return { tab: 'overview', label: 'Tableau de bord' };
}

function focusUiTarget(tab, targetLabel = '', fleetSubtab = '') {
  app.activeTab = tab || 'overview';
  if (app.activeTab === 'fleet' && ['catalog', 'maintenance', 'composition'].includes(fleetSubtab)) {
    app.activeFleetSubtab = fleetSubtab;
    localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
  }
  app.highlightUiTarget = targetLabel || app.activeTab;
  localStorage.setItem('sillons.activeTab', app.activeTab);
  renderAll();
  requestAnimationFrame(() => {
    const content = $('#tabContent');
    content?.classList.add('ui-glow-target');
    content?.scrollTo?.({ top: 0, behavior: 'smooth' });
  });
  setTimeout(() => {
    $('#tabContent')?.classList.remove('ui-glow-target');
    app.highlightUiTarget = '';
  }, 2400);
}

function formatResearchTime(valueMs) {
  const totalSeconds = Math.max(0, Math.ceil(Number(valueMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(n => String(n).padStart(2, '0')).join(':');
}

function researchQueueCompletionInfo(me = app.state?.me) {
  if (!me) return null;
  const queue = Array.isArray(me.researchQueue) ? me.researchQueue : [];
  const project = me.researchProject || null;
  const launchedCount = queue.length + (project ? 1 : 0);
  if (!launchedCount) return null;
  const workRate = Math.max(0.01, Number(researchWorkRateClient(me) || 1));
  let remainingRealMs = 0;
  if (project) {
    if (Number.isFinite(Number(project.endAt)) && Number(project.endAt) > 0) {
      remainingRealMs += Math.max(0, Number(project.endAt) - serverNow());
    } else {
      remainingRealMs += Math.max(0, Number(project.realRemainingMs ?? project.remainingMs ?? 0));
    }
  }
  for (const item of queue) {
    remainingRealMs += Math.max(0, Number(item.durationMs || 0)) / workRate;
  }
  const endAt = serverNow() + remainingRealMs;
  return {
    launchedCount,
    queueCount: queue.length,
    workRate,
    remainingRealMs,
    endAt
  };
}

function formatCycles(value) {
  const n = Math.max(0, Math.ceil(Number(value || 0)));
  return n <= 1 ? '1 cycle' : `${n} cycles`;
}

function serverNow() {
  return Date.now() + (app.serverClockOffset || 0);
}

function researchProjectKey(project) {
  if (!project) return '';
  return `${project.nodeId || ''}:${project.targetLevel || 0}:${project.startedAt || 0}:${project.durationMs || 0}`;
}

function researchProgressPercentFromData(endAt, durationMs, workRate) {
  const now = serverNow();
  const remainingRealMs = Math.max(0, Number(endAt || 0) - now);
  const remainingWorkMs = remainingRealMs * Math.max(0.01, Number(workRate || 1));
  return Math.max(0, Math.min(100, (1 - remainingWorkMs / Math.max(1, Number(durationMs || 1))) * 100));
}

function researchProgressPercent(project) {
  if (!project) return 0;
  return researchProgressPercentFromData(project.endAt, project.durationMs, project.workRate || 1);
}

function applyResearchProgress(el, rawProgress) {
  const key = el.dataset.researchKey || '';
  const last = key ? Number(app.researchProgressCache[key] ?? el.dataset.lastProgress ?? 0) : Number(el.dataset.lastProgress || 0);
  // Évite le rollback visuel quand un refresh serveur reconstruit l'état avec quelques ms de décalage.
  const progress = key ? Math.max(last, rawProgress) : rawProgress;
  el.dataset.lastProgress = String(progress);
  if (key) app.researchProgressCache[key] = progress;
  el.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function updateResearchTimers() {
  const now = serverNow();
  document.querySelectorAll('[data-research-timer], [data-research-total-timer]').forEach(el => {
    const endAt = Number(el.dataset.endAt || 0);
    el.textContent = formatResearchTime(Math.max(0, endAt - now));
  });
  document.querySelectorAll('[data-research-progress]').forEach(el => {
    const endAt = Number(el.dataset.endAt || 0);
    const durationMs = Math.max(1, Number(el.dataset.durationMs || 1));
    const workRate = Math.max(0.01, Number(el.dataset.workRate || 1));
    const progress = researchProgressPercentFromData(endAt, durationMs, workRate);
    applyResearchProgress(el, progress);
  });
}

function startResearchAnimationLoop() {
  const tick = () => {
    updateResearchTimers();
    updateEpochTrafficAnimation();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function compositionMetric(label, value, tooltip, cls = '', secondaryValue = '') {
  return `
    <div class="metric composition-metric ${tooltip ? 'metric-has-tooltip' : ''}" ${tooltip ? `tabindex="0" ${tooltipAttr(tooltip)}` : ''}>
      <div class="metric-label-row">
        <span>${escapeHtml(label)}</span>
        ${tooltip ? '<i class="metric-info" aria-hidden="true">i</i>' : ''}
      </div>
      <b class="${cls}">${escapeHtml(String(value))}</b>
      ${secondaryValue ? `<small class="composition-metric-secondary">${escapeHtml(String(secondaryValue))}</small>` : ''}
    </div>`;
}

function variantMetricValue(multiplier = 1, delta = 0, mode = 'multiplier') {
  if (mode === 'delta') {
    const pct = Math.round(Number(delta || 0) * 100);
    return pct === 0 ? '0%' : `${pct > 0 ? '+' : ''}${pct}%`;
  }
  const pct = Math.round((Number(multiplier || 1) - 1) * 100);
  return pct === 0 ? '0%' : `${pct > 0 ? '+' : ''}${pct}%`;
}

function renderVariantStatRow(label, value, cls = '') {
  return `<div class="variant-stat-row"><span>${escapeHtml(label)}</span><b class="${cls}">${escapeHtml(String(value))}</b></div>`;
}

function tooltipAttr(text) {
  const safe = escapeAttr(String(text || '').trim());
  return safe ? ` aria-label="${safe}" data-tooltip="${safe}"` : '';
}

function lineElectrificationCost(line) {
  const me = app.state.me;
  const techDiscount = (1 - Math.min(0.2, (me.tech.energy || 0) * 0.03)) * (hasTech('electric_substations') ? 0.92 : 1);
  return Math.round(lineDistance(line) * 125000 * techDiscount);
}

function lineElectrificationTooltip(line) {
  const cost = lineElectrificationCost(line);
  return `Électrifie cette ligne pour ${money(cost)}. Effets : Toute la ligne et tous ses arrêts deviennent électrifiés ; les trains électriques peuvent y circuler ; la facture énergétique et le CO₂ baissent pour les matériels électriques.`;
}

function stationUpgradeTooltip(station, asset, upgrade) {
  if (!app.state?.me?.stations?.[station?.id] && upgrade.kind === 'level') {
    return `${station.name} est libre. L’achat direct de gare est retiré : ajoute-la à une ligne et achète des sillons pour y faire rouler ton matériel.`;
  }
  const effects = {
    level: upgrade.label === 'Acheter'
      ? 'achète la gare, permet d’y créer des lignes et donne droit aux revenus de passage payés par les concurrents.'
      : 'augmente la capacité et l’attractivité de la gare ; débloque une meilleure base pour les autres améliorations.',
    commerce: 'ajoute des revenus annexes et améliore la satisfaction voyageurs.',
    maintenance: 'augmente la capacité d’atelier, réduit les coûts/durées de maintenance et aide à maintenir le parc fiable.',
    depot: 'permet le stationnement et améliore la portée pratique des trains vapeur sur les itinéraires qui passent par cette gare.'
  };
  const nextAsset = { ...(asset || {}) };
  if (upgrade.kind === 'level') nextAsset.level = upgrade.label === 'Acheter' ? 1 : Number(nextAsset.level || 1) + 1;
  if (upgrade.kind === 'commerce') nextAsset.commerce = Number(nextAsset.commerce || 0) + 1;
  if (upgrade.kind === 'maintenance') nextAsset.maintenance = Number(nextAsset.maintenance || 0) + 1;
  if (upgrade.kind === 'depot') nextAsset.depot = true;
  const nextCost = stationOperatingCostBreakdown(nextAsset).total;
  return `${upgrade.label} à ${station.name}. Coût immédiat : ${money(upgrade.cost)}. Coût d’exploitation après amélioration : ${moneyPerHour(nextCost)}. Effet : ${effects[upgrade.kind] || 'Amélioration de la gare.'}`;
}

function staffRoleLabel(label, count = 1) {
  const singular = String(label || 'Métier');
  if (Number(count || 0) <= 1) return singular;
  return {
    Conducteur: 'Conducteurs',
    Contrôleur: 'Contrôleurs',
    'Agent de gare': 'Agents de gare',
    Mainteneur: 'Mainteneurs',
    Régulateur: 'Régulateurs',
    'Agent de l’infra': 'Agents de l’infra'
  }[singular] || `${singular}s`;
}

function staffActionTooltip(role, count, kind) {
  const def = app.state.balance.staff[role];
  if (kind === 'hire') {
    return [
      `Action : Recruter ${count} ${staffRoleLabel(def.label, count)}`,
      `Coût immédiat : ${money(def.hireCost * count)}`,
      `Salaire ajouté : ${staffSalaryPerHour(def, count)}`
    ].join('\n');
  }
  return [
    `Action : Licencier ${count} ${staffRoleLabel(def.label, count)}`,
    `Salaire retiré : ${staffSalaryPerHour(def, count)}`
  ].join('\n');
}

function maintenancePolicyTooltip(policy) {
  const sign = policy.reliabilityBonus >= 0 ? '+' : '';
  return `${policy.name}. ${policy.description} Coût d’entretien ×${round(policy.costMultiplier)}, usure ×${round(policy.wearMultiplier)}, fiabilité ${sign}${Math.round(policy.reliabilityBonus * 100)} points.`;
}

function energyStrategyTooltip(id, strategy) {
  return `${strategy.name}. ${energyStrategyDescription(id)} Effet : Modifie les multiplicateurs de prix énergie dès le prochain calcul d’exploitation.`;
}



function preloadArt() {
  const sources = new Set([
    ART.map,
    ...Object.values(ART.tabs),
    ...Object.values(ART.researchGroups),
    ...Object.values(ART.researchNodes)
  ]);
  sources.forEach(src => {
    if (!src || artImages[src]) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    artImages[src] = img;
  });
}


function preloadMapSprites() {
  Object.entries(TRAIN_MAP_SPRITES).forEach(([id, src]) => {
    if (!src || app.mapSprites.trains[id]) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    app.mapSprites.trains[id] = img;
  });
  Object.entries(STATION_MAP_SPRITES).forEach(([level, src]) => {
    if (!src || app.mapSprites.stations[level]) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    app.mapSprites.stations[level] = img;
  });
}

function stationPrestigeStage(asset) {
  if (!asset) return 1;
  const score = Number(asset.level || 1)
    + Math.floor(Number(asset.commerce || 0) / 2)
    + Math.floor(Number(asset.maintenance || 0) / 2)
    + (asset.depot ? 1 : 0);
  return Math.max(1, Math.min(6, score));
}

function getTrainMapSprite(modelId) {
  return app.mapSprites.trains[modelId] || null;
}

function getStationMapSprite(asset) {
  return app.mapSprites.stations[String(stationPrestigeStage(asset))] || null;
}

function mapMaxZoomReached() {
  const map = app.map.leaflet;
  if (!map?.getZoom) return false;
  const max = Number(map.getMaxZoom?.() || 13);
  return Number(map.getZoom()) >= max;
}

function drawSmallMapMarker(ctx, p, radius, fill, selected = false) {
  if (selected) {
    ctx.fillStyle = 'rgba(250, 204, 21, 0.26)';
    ctx.fillRect(Math.round(p.x - 14), Math.round(p.y - 14), 28, 28);
  }
  ctx.fillStyle = 'rgba(8, 12, 18, 0.95)';
  ctx.fillRect(Math.round(p.x - radius - 1), Math.round(p.y - radius - 1), radius * 2 + 2, radius * 2 + 2);
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(p.x - radius + 1), Math.round(p.y - radius + 1), radius * 2 - 2, radius * 2 - 2);
}

function artForResearchGroup(id) {
  return ART.researchGroups[id] || ART.tabs.research;
}

function artForTechNode(id) {
  return ART.researchNodes[id] || null;
}

function renderSectionHero(kicker, title, text, image, tags = []) {
  return `
    <div class="menu-context card">
      <div class="menu-context__inner">
        ${kicker ? `<div class="hero-kicker">${escapeHtml(kicker)}</div>` : ''}
        <h2>${escapeHtml(title)}</h2>
        ${text ? `<p>${escapeHtml(text)}</p>` : ''}
        ${tags.length ? `<div class="hero-tags">${tags.map(tag => `<span class="tag">${escapeHtml(String(tag))}</span>`).join('')}</div>` : ''}
      </div>
    </div>
  `;
}

