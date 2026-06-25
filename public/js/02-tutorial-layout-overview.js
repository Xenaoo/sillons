// Tutoriel, rendu global, onglets, topbar, vue compagnie et finances.
function currentTutorialState() {
  return app.state?.me?.tutorial || null;
}

function currentTutorialStep() {
  const tutorial = currentTutorialState();
  if (!tutorial || tutorial.completed || tutorial.enabled === false) return null;
  return TUTORIAL_STEPS[TUTORIAL_STEP_INDEX[tutorial.stepId] ?? 0] || TUTORIAL_STEPS[0];
}

function nextTutorialStepId(stepId) {
  const index = TUTORIAL_STEP_INDEX[stepId] ?? 0;
  return TUTORIAL_STEPS[Math.min(TUTORIAL_STEPS.length - 1, index + 1)]?.id || 'done';
}

function tutorialConditionMet(step) {
  const me = app.state?.me;
  if (!step || !me) return false;
  const wait = step.wait || '';
  if (!wait) return false;
  if (wait.startsWith('activeTab:')) return app.activeTab === wait.split(':')[1];
  if (wait.startsWith('fleetSubtab:')) return app.activeTab === 'fleet' && app.activeFleetSubtab === wait.split(':')[1];
  if (wait.startsWith('linesSubtab:')) return app.activeTab === 'lines' && app.activeLinesSubtab === wait.split(':')[1];
  if (wait === 'hasTrain') return (me.trains || []).length > 0;
  if (wait === 'hasLine') return (me.lines || []).some(line => line.active);
  if (wait === 'compositionTrainSelected') return compositionSelectedIds().length > 0;
  if (wait === 'compositionEditorOpen') return Boolean(app.compositionEditorTrainId);
  if (wait === 'compositionSaved') return Boolean(me.tutorial?.actionLog?.compositionSaved);
  if (wait.startsWith('tech:')) {
    const [, nodeId, level] = wait.split(':');
    return Number(me.techUnlocked?.[nodeId] || 0) >= Math.max(1, Number(level || 1));
  }
  return false;
}

function prepareTutorialStepView(step) {
  if (!step) return false;
  let changed = false;
  if (step.tab && app.activeTab !== step.tab) {
    app.activeTab = step.tab;
    localStorage.setItem('sillons.activeTab', app.activeTab);
    changed = true;
  }
  if (step.subtab === 'composition' && app.activeFleetSubtab !== 'composition') {
    app.activeFleetSubtab = 'composition';
    localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
    changed = true;
  }
  if (step.subtab === 'catalog' && app.activeFleetSubtab !== 'catalog') {
    app.activeFleetSubtab = 'catalog';
    localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
    changed = true;
  }
  if (step.subtab === 'maintenance' && app.activeFleetSubtab !== 'maintenance') {
    app.activeFleetSubtab = 'maintenance';
    localStorage.setItem('sillons.fleetSubtab', app.activeFleetSubtab);
    changed = true;
  }
  if (step.subtab === 'create' && app.activeLinesSubtab !== 'create') {
    app.activeLinesSubtab = 'create';
    localStorage.setItem('sillons.linesSubtab', app.activeLinesSubtab);
    changed = true;
  }
  if (step.subtab === 'manage' && app.activeLinesSubtab !== 'manage') {
    app.activeLinesSubtab = 'manage';
    localStorage.setItem('sillons.linesSubtab', app.activeLinesSubtab);
    changed = true;
  }
  return changed;
}

async function syncTutorial(payload) {
  if (app.tutorial.syncing) return;
  app.tutorial.syncing = true;
  try {
    await performAction('tutorial', payload);
  } finally {
    app.tutorial.syncing = false;
  }
}

function advanceTutorial(step = currentTutorialStep()) {
  if (!step) return;
  if (step.id === 'done') return syncTutorial({ op: 'complete' });
  syncTutorial({ op: 'advance', stepId: nextTutorialStepId(step.id) });
}

function skipTutorial() {
  syncTutorial({ op: 'complete' });
}

function renderTutorialOverlay() {
  clearTimeout(app.tutorial.timer);
  const existing = $('#tutorialOverlay');
  const step = currentTutorialStep();
  if (!step) {
    existing?.remove();
    $('#tutorialTargetHalo')?.remove();
    clearTimeout(app.tutorial.positionTimer);
    app.tutorial.lastScrollKey = '';
    return;
  }
  if (prepareTutorialStepView(step)) {
    setTimeout(renderAll, 0);
    return;
  }
  const freshStep = currentTutorialStep();
  if (freshStep && tutorialConditionMet(freshStep)) {
    app.tutorial.timer = setTimeout(() => advanceTutorial(freshStep), 220);
    return;
  }

  let overlay = existing;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tutorialOverlay';
    overlay.className = 'tutorial-overlay';
    document.body.appendChild(overlay);
  }
  const index = (TUTORIAL_STEP_INDEX[freshStep.id] ?? 0) + 1;
  const total = TUTORIAL_STEPS.length;
  overlay.innerHTML = `
    <div class="tutorial-card">
      <div class="tutorial-kicker">Tutoriel guidé · ${index}/${total}</div>
      <h3>${escapeHtml(freshStep.title)}</h3>
      <p>${escapeHtml(freshStep.body)}</p>
      <div class="tutorial-actions">
        ${freshStep.wait ? '<span class="tutorial-wait">Action attendue</span>' : `<button type="button" class="primary" data-tutorial-next>${escapeHtml(freshStep.action || 'Continuer')}</button>`}
        <button type="button" class="ghost" data-tutorial-skip>Terminer</button>
      </div>
    </div>
  `;
  overlay.querySelector('[data-tutorial-next]')?.addEventListener('click', () => advanceTutorial(freshStep));
  overlay.querySelector('[data-tutorial-skip]')?.addEventListener('click', skipTutorial);
  scheduleTutorialOverlayPosition(0, { scroll: true });
}

function tutorialTargetForStep(step = currentTutorialStep()) {
  if (!step?.target) return null;
  try {
    return document.querySelector(step.target) || document.querySelector('#tabContent') || document.querySelector('.side.panel');
  } catch {
    return document.querySelector('#tabContent') || document.querySelector('.side.panel');
  }
}

function tutorialViewportMetrics() {
  const vv = window.visualViewport;
  return {
    width: vv?.width || window.innerWidth,
    height: vv?.height || window.innerHeight,
    offsetLeft: vv?.offsetLeft || 0,
    offsetTop: vv?.offsetTop || 0
  };
}

function isCompactTutorialViewport() {
  const view = tutorialViewportMetrics();
  return view.width <= 760 || view.height <= 560;
}

function scheduleTutorialOverlayPosition(delay = 0, options = {}) {
  clearTimeout(app.tutorial.positionTimer);
  app.tutorial.positionTimer = setTimeout(() => {
    if (app.tutorial.positionFrame) cancelAnimationFrame(app.tutorial.positionFrame);
    app.tutorial.positionFrame = requestAnimationFrame(() => updateTutorialOverlayPosition(options));
  }, delay);
}

function updateTutorialOverlayPosition(options = {}) {
  const overlay = $('#tutorialOverlay');
  const step = currentTutorialStep();
  if (!overlay || !step) return;
  const target = tutorialTargetForStep(step);
  const card = overlay.querySelector('.tutorial-card');
  if (!target || !card) return;
  const scrollKey = `${step.id}:${step.target || ''}`;
  if (options.scroll !== false && app.tutorial.lastScrollKey !== scrollKey) {
    app.tutorial.lastScrollKey = scrollKey;
    target.scrollIntoView?.({
      behavior: isCompactTutorialViewport() ? 'auto' : 'smooth',
      block: isCompactTutorialViewport() ? 'center' : 'center',
      inline: 'center'
    });
    scheduleTutorialOverlayPosition(isCompactTutorialViewport() ? 80 : 260, { scroll: false });
    return;
  }
  positionTutorialElements(target, card, step);
}

function positionTutorialElements(target, card, step) {
  const view = tutorialViewportMetrics();
  const rect = target?.getBoundingClientRect?.();
  if (!rect) return;
  const halo = document.getElementById('tutorialTargetHalo') || (() => {
    const el = document.createElement('div');
    el.id = 'tutorialTargetHalo';
    el.className = 'tutorial-target-halo';
    document.body.appendChild(el);
    return el;
  })();
  const margin = isCompactTutorialViewport() ? 8 : 10;
  const pad = isCompactTutorialViewport() ? 5 : 6;
  const left = Math.max(view.offsetLeft + margin, rect.left - pad);
  const top = Math.max(view.offsetTop + margin, rect.top - pad);
  const maxRight = view.offsetLeft + view.width - margin;
  const maxBottom = view.offsetTop + view.height - margin;
  const width = Math.max(24, Math.min(rect.width + pad * 2, maxRight - left));
  const height = Math.max(24, Math.min(rect.height + pad * 2, maxBottom - top));
  halo.style.left = `${Math.round(left)}px`;
  halo.style.top = `${Math.round(top)}px`;
  halo.style.width = `${Math.round(width)}px`;
  halo.style.height = `${Math.round(height)}px`;
  if (isCompactTutorialViewport()) {
    card.dataset.arrow = 'none';
    card.style.left = '';
    card.style.top = '';
    return;
  }
  const cardRect = card.getBoundingClientRect();
  let cardLeft = rect.right + 18;
  let cardTop = rect.top + rect.height / 2 - cardRect.height / 2;
  if (cardLeft + cardRect.width > view.offsetLeft + view.width - margin) cardLeft = rect.left - cardRect.width - 18;
  if (cardLeft < view.offsetLeft + margin) cardLeft = Math.min(view.offsetLeft + view.width - cardRect.width - margin, view.offsetLeft + margin);
  cardTop = Math.max(view.offsetTop + margin, Math.min(view.offsetTop + view.height - cardRect.height - margin, cardTop));
  card.style.left = `${Math.round(cardLeft)}px`;
  card.style.top = `${Math.round(cardTop)}px`;
  card.dataset.arrow = cardLeft > rect.left ? 'left' : 'right';
}

function renderAll() {
  if (!app.state) return;
  const compositionScrollKey = currentCompositionScrollKey();
  const researchTreeScroll = app.activeTab === 'research' ? (() => {
    const tree = document.querySelector('.research-skilltree-scroll');
    return tree ? { left: tree.scrollLeft, top: tree.scrollTop } : null;
  })() : null;
  captureCompositionScrollPosition();
  renderTopbar();
  renderTabs();
  renderTutorialOverlay();
  applyLayoutMode();
  syncFocusedLineUi();
  scheduleCompositionRefitScrollAdjustment();
  scheduleMobileMapViewportFix();
  requestMapRedraw();
  requestAnimationFrame(() => {
    if (compositionScrollKey) restoreCompositionScrollPosition(compositionScrollKey);
    if (researchTreeScroll) {
      const tree = document.querySelector('.research-skilltree-scroll');
      if (tree) {
        tree.scrollLeft = researchTreeScroll.left;
        tree.scrollTop = researchTreeScroll.top;
      }
    }
  });
  app.lastRenderKey = stateRenderSignature();
}

function renderTopbar() {
  const me = app.state.me;
  $('#companySubtitle').textContent = me ? `${me.name} · ${me.eraName}` : 'Non connecté';
  const logo = $('#companyLogoBadge');
  const fallback = $('#companyLogoFallback');
  if (logo) {
    const selected = COMPANY_LOGOS.find(item => item.id === me?.logo) || COMPANY_LOGOS[0];
    logo.src = selected.src;
    logo.alt = selected.label;
    logo.classList.toggle('hidden', !me);
  }
  if (fallback) fallback.classList.toggle('hidden', !!me);
  const logoutBtn = $('#logoutBtn');
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !app.authToken);
  const tutorialBtn = $('#tutorialBtn');
  if (tutorialBtn) tutorialBtn.classList.toggle('hidden', !me);
  const mapToggleBtn = $('#mapToggleBtn');
  if (mapToggleBtn) mapToggleBtn.remove();
  const topStats = $('#topStats');
  renderNotificationDropdown();
  if (!me) {
    topStats.innerHTML = `<span class="stat-pill">Serveur <b>connecté</b></span>`;
    return;
  }
  topStats.innerHTML = [
    pill('Cash', money(me.cash), me.cash >= 0 ? 'good-text' : 'bad-text'),
    pill('Résultat/h', moneyPerHour(me.stats.lastProfit), me.stats.lastProfit >= 0 ? 'good-text' : 'bad-text', topResultTooltip(me)),
    pill('Charbon', resourceStockLabel('coal'), '', resourceTopTooltip('coal')),
    pill('Diesel', resourceStockLabel('diesel'), '', resourceTopTooltip('diesel')),
    pill('Électricité', resourceStockLabel('electricity'), '', resourceTopTooltip('electricity')),
    pill('Réputation', `${Math.round(me.reputation)}/100`),
    pill('Ponctualité', `${Math.round(me.stats.punctuality)}%`)
  ].join('');
}


function isMapVisible() {
  return true;
}

function toggleMapVisibility() {
  // Carte permanente : la navigation reste accessible sans masquer la carte.
  app.mapPref = 'show';
  localStorage.setItem('sillons.mapPref', app.mapPref);
  applyLayoutMode();
}

function applyLayoutMode() {
  const layout = $('.layout');
  if (!layout) return;
  layout.classList.remove('map-hidden');
  layout.classList.add('map-visible');
  $('.map-section')?.classList.remove('hidden-by-layout');
  requestAnimationFrame(() => resizeCanvas());
}

function syncFocusedLineUi() {
  const btn = $('#clearFocusedLineBtn');
  if (!btn) return;
  btn.classList.toggle('hidden', !app.focusedLineId);
}

function clearFocusedLine() {
  app.focusedLineId = '';
  localStorage.removeItem('sillons.focusedLineId');
  syncFocusedLineUi();
  invalidateMapProjection('line-focus-clear');
  drawMap();
}

function focusLineOnMap(lineId, { fit = true, toggle = false } = {}) {
  const id = String(lineId || '');
  const line = app.state?.me?.lines?.find(l => l.id === id && l.active);
  if (!line) return;
  if (toggle && app.focusedLineId === id) {
    clearFocusedLine();
    return;
  }
  app.focusedLineId = id;
  localStorage.setItem('sillons.focusedLineId', id);
  syncFocusedLineUi();
  if (fit && app.map.leaflet) {
    const latLngs = lineStopsOf(line)
      .map(id => station(id))
      .map(s => [stationRouteLat(s), stationRouteLon(s)])
      .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
    if (latLngs.length) {
      try {
        app.map.leaflet.fitBounds(latLngs, { padding: [34, 34], maxZoom: 11, animate: true });
      } catch {}
    }
  }
  invalidateMapProjection('line-focus');
  drawMap();
}


function currentIsoFactor() {
  return app.map.view.zoom <= 1.15 ? 0 : Math.min(1, (app.map.view.zoom - 1.15) / 0.95);
}

function getViewMatrix() {
  const z = app.map.view.zoom;
  const iso = currentIsoFactor();
  const a = z;
  const b = -0.08 * z * iso;
  const c = 0.28 * z * iso;
  const d = z * (1 - 0.2 * iso);
  return { a, b, c, d };
}

function applyViewTransform(ctx) {
  const cx = app.map.width / 2 + app.map.view.panX;
  const cy = app.map.height / 2 + app.map.view.panY;
  const { a, b, c, d } = getViewMatrix();
  ctx.translate(cx, cy);
  ctx.transform(a, b, c, d, 0, 0);
  ctx.translate(-app.map.width / 2, -app.map.height / 2);
}

function toViewPoint(p) {
  const { a, b, c, d } = getViewMatrix();
  const ox = p.x - app.map.width / 2;
  const oy = p.y - app.map.height / 2;
  return {
    x: app.map.width / 2 + app.map.view.panX + a * ox + c * oy,
    y: app.map.height / 2 + app.map.view.panY + b * ox + d * oy
  };
}

function fromViewPoint(p) {
  const { a, b, c, d } = getViewMatrix();
  const det = a * d - b * c || 1;
  const vx = p.x - (app.map.width / 2 + app.map.view.panX);
  const vy = p.y - (app.map.height / 2 + app.map.view.panY);
  const ox = (d * vx - c * vy) / det;
  const oy = (-b * vx + a * vy) / det;
  return { x: app.map.width / 2 + ox, y: app.map.height / 2 + oy };
}

function setMapZoom(nextZoom, focusPoint = null) {
  const previous = app.map.view.zoom;
  const zoom = Math.max(1, Math.min(3.2, nextZoom));
  if (Math.abs(zoom - previous) < 0.001) return;
  if (focusPoint) {
    const rawBefore = fromViewPoint(focusPoint);
    app.map.view.zoom = zoom;
    const screenAfter = toViewPoint(rawBefore);
    app.map.view.panX += focusPoint.x - screenAfter.x;
    app.map.view.panY += focusPoint.y - screenAfter.y;
  } else {
    app.map.view.zoom = zoom;
  }
}

function resetMapView() {
  app.map.view.zoom = 1;
  app.map.view.panX = 0;
  app.map.view.panY = 0;
}

function artPoint(nx, ny) {
  const frame = app.map.frame?.image;
  if (!frame) return { x: 0, y: 0 };
  return { x: frame.x + frame.width * nx, y: frame.y + frame.height * ny };
}

function edgeKey(a, b) {
  return [a, b].sort().join('|');
}

function pill(label, value, cls = '', tip = '') {
  const isCash = label === 'Cash';
  return `<span class="stat-pill ${isCash ? 'cash-pill' : ''}" ${isCash ? 'id="cashPill"' : ''} ${tooltipAttr(tip)}>${escapeHtml(label)} <b class="${cls}">${escapeHtml(value)}</b>${isCash ? '<span class="cash-fx-layer" id="cashFxLayer" aria-hidden="true"></span>' : ''}</span>`;
}

function formatSignedMoney(value) {
  const n = Math.round(Number(value || 0));
  return `${n > 0 ? '+' : ''}${formatInt(n)} €`;
}

function animateCashDelta(delta) {
  const amount = Math.round(Number(delta || 0));
  if (!amount) return;
  const host = $('#cashFxLayer') || $('#cashPill');
  if (!host) return;

  const bubble = document.createElement('span');
  bubble.className = `cash-fx ${amount > 0 ? 'gain' : 'loss'}`;
  bubble.textContent = formatSignedMoney(amount);
  host.appendChild(bubble);

  requestAnimationFrame(() => bubble.classList.add('show'));

  setTimeout(() => {
    bubble.classList.remove('show');
    bubble.classList.add('hide');
    setTimeout(() => bubble.remove(), 420);
  }, 1050);
}


function animateCashDeltaFromStates(previousState, nextState) {
  const previousCash = Number(previousState?.me?.cash);
  const nextCash = Number(nextState?.me?.cash);
  if (Number.isFinite(previousCash) && Number.isFinite(nextCash) && previousCash !== nextCash) {
    animateCashDelta(nextCash - previousCash);
  }
}

function syncAdminTabVisibility() {
  const button = $('#adminTabBtn');
  if (!button) return;
  const isAdmin = Boolean(app.state?.auth?.isAdmin);
  button.classList.toggle('hidden', !isAdmin);
  if (!isAdmin && app.activeTab === 'admin') app.activeTab = 'overview';
}

function isAdminSession() {
  return Boolean(app.state?.auth?.isAdmin && app.state?.admin);
}

function renderTabs() {
  if (!app.state) return;
  syncAdminTabVisibility();
  if (app.activeTab === 'admin' && !app.state.auth?.isAdmin) {
    app.activeTab = 'overview';
    localStorage.setItem('sillons.activeTab', app.activeTab);
  }
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === app.activeTab));
  if (app.activeTab === 'bugs') markBugReportsRead({ syncServer: true, skipRender: true });
  syncBugTabBadge();
  const content = $('#tabContent');
  const side = $('.side.panel');
  const menuImage = ART.tabs[app.activeTab] || ART.tabs.overview;
  if (side) {
    side.dataset.menu = app.activeTab;
    side.style.setProperty('--menu-bg', `url("${menuImage}")`);
  }
  content.dataset.tab = app.activeTab;
  content.dataset.fleetSubtab = app.activeTab === 'fleet' ? (app.activeFleetSubtab || '') : '';
  if (!app.state.me) {
    if (side) side.style.setProperty('--menu-bg', `url("${ART.tabs.overview}")`);
    content.innerHTML = `<div class="card"><h2>Créer une compagnie</h2><p class="muted">La partie commence après création de la compagnie.</p></div>`;
    return;
  }
  const renderers = {
    overview: renderOverview,
    lines: renderLines,
    fleet: renderFleet,
    stations: renderStations,
    staff: renderStaff,
    research: renderResearch,
    resources: renderResources,
    market: renderMarket,
    budget: renderBudget,
    bugs: renderBugs,
    admin: renderAdmin
  };
  content.innerHTML = renderers[app.activeTab]?.() || renderOverview();
  if (app.activeTab === 'lines') { refreshLineSearchWidgets(); updateLinePreview(); }
  if (app.activeTab === 'stations') refreshStationSearchWidgets();
  setTimeout(renderTutorialOverlay, 0);
}


function bugSeverityLabel(value) {
  return ({ low: 'Mineur', normal: 'Normal', high: 'Gênant', critical: 'Bloquant' })[value] || 'Normal';
}

function bugStatusLabel(value) {
  return value === 'closed' ? 'Clôturé' : 'Ouvert';
}

function renderBugImages(images = []) {
  if (!images.length) return '';
  return `<div class="bug-image-grid">${images.map(image => `
    <a href="${escapeAttr(image.dataUrl)}" target="_blank" rel="noopener" title="Ouvrir l’image">
      <img src="${escapeAttr(image.dataUrl)}" alt="${escapeAttr(image.name || 'Image bug')}">
    </a>
  `).join('')}</div>`;
}

function renderBugCard(bug) {
  const admin = Boolean(app.state?.auth?.isAdmin);
  const closed = bug.status === 'closed';
  return `
    <article class="bug-card ${closed ? 'closed' : 'open'}">
      <div class="bug-card-head">
        <div>
          <h3>${escapeHtml(bug.title)}</h3>
          <p class="small muted">Signalé par ${escapeHtml(bug.reporterName || 'Joueur')} · ${escapeHtml(formatDateTime(bug.createdAt))}</p>
        </div>
        <div class="bug-tags">
          <span class="tag ${closed ? '' : 'warn'}">${escapeHtml(bugStatusLabel(bug.status))}</span>
          <span class="tag">${escapeHtml(bugSeverityLabel(bug.severity))}</span>
        </div>
      </div>
      <p>${escapeHtml(bug.description || '')}</p>
      ${renderBugImages(bug.images || [])}
      ${closed ? `<p class="small muted">Clôturé par ${escapeHtml(bug.closedByName || 'Admin')} · ${escapeHtml(bug.resolution || 'Réglé')}</p>` : ''}
      ${admin && !closed ? `<div class="actions"><button class="primary" data-action="close-bug-report" data-id="${escapeAttr(bug.id)}">Clôturer comme réglé</button></div>` : ''}
    </article>
  `;
}

function renderBugs() {
  const reports = app.state?.bugReports || [];
  const openCount = reports.filter(bug => bug.status !== 'closed').length;
  const closedCount = reports.length - openCount;
  return `
    ${renderSectionHero('BUGS & SIGNALEMENTS', 'Registre partagé', 'Signale un problème avec une description précise et des captures. La liste est visible par tous pour éviter les doublons.', ART.tabs.bugs, [`${openCount} ouverts`, `${closedCount} clôturés`, app.state?.auth?.isAdmin ? 'Gestion Xenao' : 'Lecture commune'])}

    <section class="card bug-submit-card">
      <h2>Signaler un bug</h2>
      <p class="muted small">Décris les étapes pour reproduire le problème. Les images sont redimensionnées avant envoi pour garder la sauvegarde légère.</p>
      <div class="bug-form-grid">
        <label>Titre
          <input id="bugTitle" maxlength="120" placeholder="Ex : La carte ne se recharge plus après...">
        </label>
        <label>Gravité
          <select id="bugSeverity">
            <option value="normal">Normal</option>
            <option value="low">Mineur</option>
            <option value="high">Gênant</option>
            <option value="critical">Bloquant</option>
          </select>
        </label>
      </div>
      <label>Description
        <textarea id="bugDescription" rows="5" maxlength="4000" placeholder="Ce que j’ai fait, ce que j’ai obtenu, ce que j’attendais..."></textarea>
      </label>
      <label>Images jointes
        <input id="bugImages" type="file" accept="image/png,image/jpeg,image/webp" multiple>
      </label>
      <div class="actions">
        <button class="primary" data-action="submit-bug-report">Envoyer le signalement</button>
      </div>
    </section>

    <section class="card bug-list-card">
      <div class="fleet-card-heading">
        <div>
          <h2>Signalements existants</h2>
          <p class="muted small">Tous les joueurs peuvent consulter cette liste. Seul le compte Xenao peut clôturer un bug.</p>
        </div>
        <span class="tag">${reports.length} signalement(s)</span>
      </div>
      <div class="bug-list">
        ${reports.map(renderBugCard).join('') || '<p class="muted">Aucun bug signalé pour le moment.</p>'}
      </div>
    </section>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Lecture image impossible.'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image invalide.'));
    image.src = dataUrl;
  });
}

async function bugAttachmentFromFile(file) {
  if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type || '')) throw new Error('Format image refusé.');
  if (file.size > 4_000_000) throw new Error(`${file.name} dépasse 4 Mo.`);
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(dataUrl);
  const maxSide = 1200;
  const ratio = Math.min(1, maxSide / Math.max(image.width || 1, image.height || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((image.width || 1) * ratio));
  canvas.height = Math.max(1, Math.round((image.height || 1) * ratio));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  let output = canvas.toDataURL('image/jpeg', 0.76);
  if (output.length > 900_000) output = canvas.toDataURL('image/jpeg', 0.58);
  if (output.length > 950_000) throw new Error(`${file.name} reste trop lourde après compression.`);
  return { name: file.name || 'capture.jpg', type: 'image/jpeg', size: Math.round(output.length * 0.75), dataUrl: output };
}

async function collectBugImageAttachments() {
  const input = $('#bugImages');
  const files = Array.from(input?.files || []).slice(0, 3);
  const images = [];
  for (const file of files) images.push(await bugAttachmentFromFile(file));
  return images;
}

function adminActivityLabel(type, detail = '') {
  const label = {
    login: 'Connexion réussie',
    logout: 'Déconnexion',
    session: 'Session active',
    action: 'Action de jeu',
    admin: 'Action d’administration'
  }[type] || type || 'Activité';
  return detail ? `${label} · ${detail}` : label;
}

function adminRelativeTime(value) {
  const delta = Math.max(0, Date.now() - Number(value || 0));
  if (!Number.isFinite(delta)) return '—';
  if (delta < 10_000) return 'à l’instant';
  if (delta < 60_000) return `il y a ${Math.round(delta / 1000)} s`;
  if (delta < 3_600_000) return `il y a ${Math.round(delta / 60_000)} min`;
  return `il y a ${Math.round(delta / 3_600_000)} h`;
}

function renderAdminActivityChart(timeline = []) {
  if (!timeline.length) return '<p class="muted small">L’historique se construit au fil des sessions.</p>';
  const width = 760;
  const height = 190;
  const padding = 28;
  const max = Math.max(1, ...timeline.flatMap(point => [Number(point.online || 0), Number(point.activities || 0)]));
  const pointFor = (value, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, timeline.length - 1);
    const y = height - padding - (Number(value || 0) * (height - padding * 2)) / max;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const online = timeline.map((point, index) => pointFor(point.online, index)).join(' ');
  const activities = timeline.map((point, index) => pointFor(point.activities, index)).join(' ');
  const first = formatDateTime(timeline[0]?.at);
  const last = formatDateTime(timeline[timeline.length - 1]?.at);
  return `
    <div class="admin-chart-legend"><span class="admin-legend-online">Joueurs actifs</span><span class="admin-legend-actions">Actions / connexions</span><em>maximum : ${formatInt(max)}</em></div>
    <svg class="admin-activity-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Activité des dernières 24 heures">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="admin-chart-axis" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" class="admin-chart-axis" />
      <polyline points="${activities}" class="admin-chart-line admin-chart-actions" />
      <polyline points="${online}" class="admin-chart-line admin-chart-online" />
    </svg>
    <div class="admin-chart-labels"><span>${escapeHtml(first)}</span><span>${escapeHtml(last)}</span></div>
  `;
}

function renderAdminActivity(activity, players) {
  const onlineRows = (activity.onlinePlayers || []).map(player => `
    <tr>
      <td><span class="admin-online-dot"></span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.username || 'sans compte')}</small></td>
      <td>${formatInt(player.activeSessions)} session${player.activeSessions > 1 ? 's' : ''}</td>
      <td>${formatInt(player.lines)} ligne${player.lines > 1 ? 's' : ''} active${player.lines > 1 ? 's' : ''}</td>
      <td title="${escapeAttr(formatDateTime(player.lastActivityAt))}">${escapeHtml(adminRelativeTime(player.lastActivityAt))}</td>
    </tr>
  `).join('');
  const recentRows = (activity.recentActivity || []).map(event => `
    <tr>
      <td title="${escapeAttr(formatDateTime(event.at))}">${escapeHtml(formatDateTime(event.at))}</td>
      <td><span class="${event.online ? 'admin-online-dot' : 'admin-offline-dot'}"></span>${escapeHtml(event.playerName)}</td>
      <td>${escapeHtml(adminActivityLabel(event.type, event.detail))}</td>
    </tr>
  `).join('');
  const breakdown = Object.entries(activity.activityBreakdown || {}).map(([type, count]) => `<span class="tag">${escapeHtml(adminActivityLabel(type))} : ${formatInt(count)}</span>`).join('') || '<span class="muted small">Aucune action mémorisée sur les dernières 24 h.</span>';
  return `
    <section class="admin-activity-metrics card-grid">
      ${metric('Joueurs en ligne', `${formatInt(activity.onlineCount || 0)}/${formatInt(players.length)}`)}
      ${metric('Sessions actives', formatInt(activity.activeSessionCount || 0))}
      ${metric('Fenêtre de présence', `${Math.round(Number(activity.activeWindowMs || 0) / 1000)} s`)}
      ${metric('Dernière mise à jour', adminRelativeTime(activity.generatedAt))}
    </section>
    <section class="card admin-chart-card">
      <div class="admin-detail-head"><div><h2>Présence et activité — 24 h</h2><p class="muted small">Actualisé à chaque synchronisation ; une session est considérée active si elle a communiqué avec le serveur dans la fenêtre indiquée.</p></div></div>
      ${renderAdminActivityChart(activity.timeline || [])}
      <div class="admin-activity-breakdown">${breakdown}</div>
    </section>
    <div class="admin-grid admin-activity-grid">
      <section class="card">
        <h2>Joueurs actuellement en ligne</h2>
        <div class="admin-log-wrap">
          <table class="admin-log-table"><thead><tr><th>Joueur</th><th>Sessions</th><th>Exploitation</th><th>Dernière activité</th></tr></thead>
          <tbody>${onlineRows || '<tr><td colspan="4">Aucun joueur actif actuellement.</td></tr>'}</tbody></table>
        </div>
      </section>
      <section class="card">
        <h2>Flux d’activité récent</h2>
        <div class="admin-log-wrap">
          <table class="admin-log-table"><thead><tr><th>Horodatage</th><th>Joueur</th><th>Événement</th></tr></thead>
          <tbody>${recentRows || '<tr><td colspan="3">Aucune activité enregistrée.</td></tr>'}</tbody></table>
        </div>
      </section>
    </div>
  `;
}

function renderAdminAccounts(players, selected) {
  const logRows = (selected.loginHistory || []).map(entry => `
    <tr><td>${escapeHtml(formatDateTime(entry.at))}</td><td>${escapeHtml(entry.ip || '—')}</td><td>${escapeHtml(entry.userAgent || '—')}</td></tr>
  `).join('');
  const sessionRows = (selected.sessions || []).map(session => `
    <tr><td><span class="${session.active ? 'admin-online-dot' : 'admin-offline-dot'}"></span>${session.active ? 'Active' : 'Inactive'}</td><td>${escapeHtml(formatDateTime(session.lastSeenAt))}</td><td>${escapeHtml(formatDateTime(session.expiresAt))}</td></tr>
  `).join('');
  const rawJson = escapeHtml(JSON.stringify(selected.rawPlayer || {}, null, 2));
  return `
    <div class="admin-grid">
      <section class="card admin-list-card"><h2>Comptes joueurs</h2><div class="admin-player-list">
        ${players.map(player => `<button type="button" class="admin-player-row ${player.id === selected.id ? 'active' : ''}" data-action="admin-select-player" data-id="${escapeAttr(player.id)}"><span><strong>${player.online ? '<i class="admin-online-dot"></i>' : ''}${escapeHtml(player.name)}</strong><em>${escapeHtml(player.username || 'Sans compte lié')} · ${escapeHtml(adminRelativeTime(player.lastActivityAt))}</em></span><b>${money(player.cash)}</b></button>`).join('')}
      </div></section>
      <section class="card admin-detail-card">
        <div class="admin-detail-head"><div><h2>${escapeHtml(selected.name)}</h2><p class="muted small">Identifiant : ${escapeHtml(selected.username || 'aucun')} · ID joueur : <code>${escapeHtml(selected.id)}</code></p></div><span class="tag ${selected.online ? 'good' : ''}">${selected.online ? 'En ligne' : (selected.isAdmin ? 'Admin' : 'Hors ligne')}</span></div>
        <div class="card-grid">${metric('Trésorerie', money(selected.cash))}${metric('Dette', money(selected.debt))}${metric('Lignes actives', `${selected.activeLines}/${selected.lines}`)}${metric('Sessions', `${selected.activeSessions || 0}/${selected.validSessions || 0}`)}</div>
        <div class="admin-action-panel"><label>Nom de compagnie<input id="adminCompanyName" maxlength="28" value="${escapeAttr(selected.name)}"></label><label>Trésorerie exacte<input id="adminCash" type="number" step="1000" value="${Number(selected.cash || 0)}"></label><label>Ajouter / retirer<input id="adminCashDelta" type="number" step="1000" placeholder="ex : 1000000 ou -500000"></label><div class="actions"><button class="primary" data-action="admin-save-quick" data-id="${escapeAttr(selected.id)}">Enregistrer nom + trésorerie</button><button data-action="admin-add-cash" data-id="${escapeAttr(selected.id)}">Appliquer variation</button></div></div>
      </section>
    </div>
    <div class="admin-grid admin-session-grid">
      <section class="card"><h2>Sessions</h2><div class="admin-log-wrap"><table class="admin-log-table"><thead><tr><th>État</th><th>Dernière activité</th><th>Expiration</th></tr></thead><tbody>${sessionRows || '<tr><td colspan="3">Aucune session valide.</td></tr>'}</tbody></table></div></section>
      <section class="card"><h2>Connexions horodatées</h2><div class="admin-log-wrap"><table class="admin-log-table"><thead><tr><th>Date</th><th>IP</th><th>Navigateur</th></tr></thead><tbody>${logRows || '<tr><td colspan="3">Aucune connexion enregistrée.</td></tr>'}</tbody></table></div></section>
    </div>
    <section class="card"><h2>Édition avancée du joueur</h2><p class="muted small">Zone volontairement puissante : modifie le JSON puis enregistre. Le serveur remigre la compagnie pour éviter les champs essentiels cassés.</p><textarea id="adminRawPlayerJson" class="admin-json-editor" spellcheck="false">${rawJson}</textarea><div class="actions"><button class="primary" data-action="admin-save-json" data-id="${escapeAttr(selected.id)}">Enregistrer le JSON joueur</button></div></section>
  `;
}

function renderAdmin() {
  if (app.state?.auth?.isAdmin && !app.state.admin) {
    return `<div class="card"><h2>Admin</h2><p class="muted">Chargement de la console d’administration…</p></div>`;
  }
  if (!isAdminSession()) return `<div class="card"><h2>Admin</h2><p class="muted">Accès réservé au compte Xenao.</p></div>`;
  const players = app.state.admin.players || [];
  if (!players.length) return `<div class="card"><h2>Admin</h2><p class="muted">Aucun joueur à administrer.</p></div>`;
  const activity = app.state.admin.activity || {};
  const selected = players.find(player => player.id === app.admin.selectedPlayerId) || players[0];
  app.admin.selectedPlayerId = selected.id;
  localStorage.setItem('sillons.adminSelectedPlayer', selected.id);
  const activeSubtab = app.admin.activeSubtab === 'accounts' ? 'accounts' : 'activity';
  return `
    ${renderSectionHero('ADMINISTRATION', 'Console Xenao', 'Surveille les sessions actives, l’activité des compagnies et les données de connexion, puis administre les comptes si nécessaire.', ART.tabs.budget, ['Accès privé', `${activity.onlineCount || 0} en ligne`, `${players.length} joueurs`])}
    <div class="admin-subtabs"><button type="button" class="${activeSubtab === 'activity' ? 'active' : ''}" data-admin-subtab="activity">Activité en direct</button><button type="button" class="${activeSubtab === 'accounts' ? 'active' : ''}" data-admin-subtab="accounts">Comptes & édition</button></div>
    ${activeSubtab === 'activity' ? renderAdminActivity(activity, players) : renderAdminAccounts(players, selected)}
  `;
}

async function adminUpdatePlayer(payload) {
  const data = await post('/api/admin/player', payload);
  if (!data.ok) {
    toast(data.error || 'Modification admin refusée.', 'error');
    return data;
  }
  app.state = data.state || app.state;
  toast(data.message || 'Modification admin enregistrée.', 'ok');
  renderAll(true);
  return data;
}

function formatDateTime(value) {
  const date = new Date(Number(value || 0));
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
}

function renderOverview() {
  const me = app.state.me;
  const activeLines = me.lines.filter(l => l.active).length;
  const ranking = [...app.state.players].sort((a, b) => b.score - a.score);
  const myRank = ranking.findIndex(p => p.id === me.id) + 1;
  return `
    ${renderSectionHero('POSTE DE COMMANDE', me.name, 'Pilote ton entreprise ferroviaire depuis un tableau de bord entièrement intégré à la direction artistique pixel-art du projet.', ART.tabs.overview, [me.eraName, `${activeLines} lignes actives`, `${me.trains.length} trains`])}

    <div class="card">
      <h2>${escapeHtml(me.name)}</h2>
      <div class="card-grid">
        ${metric('Score', formatInt(me.score), '', scoreTooltipClient(me, activeLines))}
        ${metric('Classement', `${myRank}/${ranking.length}`)}
        ${metric('Voyageurs transportés', formatInt(me.stats.passengers))}
        ${metric('Fret transporté', `${formatInt(me.stats.freightTons)} t`)}
        ${metric('Dette', money(me.debt), me.debt > 0 ? 'warn-text' : '')}
        ${metric('CO₂ cumulé', `${formatInt(me.co2)} t`, me.co2 > 5000 ? 'warn-text' : '', co2TooltipClient(me))}
      </div>
    </div>

    <div class="card">
      <h3>Réseau</h3>
      <div class="card-grid">
        ${metric('Lignes actives', activeLines)}
        ${metric('Trains', me.trains.length)}
        ${metric('Gares exploitées', Object.keys(me.stations).length)}
        ${metric('Capacité R&D', `${round(researchWorkRateClient(me))}x`, '', researchCapacityTooltipClient(me))}
      </div>
    </div>

    ${renderFinanceSummary(me)}

    <div class="card">
      <h3>Événements en cours</h3>
      <div class="list">
        ${app.state.game.events.map(e => `
          <div class="list-item">
            <div class="item-title"><strong>${escapeHtml(e.title)}</strong><span class="tag">Temporaire</span></div>
            <div class="kv"><span>Voyageurs</span><b>×${round(e.passenger || 1)}</b><span>Fret</span><b>×${round(e.freight || 1)}</b></div>
          </div>
        `).join('') || '<p class="muted">Aucun événement.</p>'}
      </div>
    </div>

    <div class="card">
      <h3>Classement multijoueur</h3>
      <div class="list">
        ${ranking.slice(0, 8).map((p, i) => `
          <div class="list-item">
            <div class="item-title">
              <strong><span style="color:${p.color}">●</span> #${i + 1} ${escapeHtml(p.name)}</strong>
              <span class="tag">${formatInt(p.score)}</span>
            </div>
            <div class="kv"><span>Époque</span><b>${escapeHtml(p.eraName)}</b><span>Cash</span><b>${money(p.cash)}</b></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function metric(label, value, cls = '', tip = '') {
  return `<div class="metric" ${tooltipAttr(tip)}><span>${escapeHtml(label)}</span><b class="${cls}">${escapeHtml(String(value))}</b></div>`;
}

function scoreTooltipClient(me, activeLines = 0) {
  const cashScore = Math.round(Number(me?.cash || 0) * 0.01);
  const debtScore = Math.round(-Number(me?.debt || 0) * 0.006);
  const reputationScore = Math.round(Number(me?.reputation || 0) * 800);
  const passengerScore = Math.round(Number(me?.stats?.passengers || 0) * 0.04);
  const freightScore = Math.round(Number(me?.stats?.freightTons || 0) * 0.08);
  const lineScore = Math.round(activeLines * 2000);
  const epochScore = Math.round(Number(me?.epoch || 0) * 45000);
  const total = cashScore + debtScore + reputationScore + passengerScore + freightScore + lineScore + epochScore;
  return [
    'Score : indicateur global de progression de la compagnie.',
    `Total actuel calculé : ${formatInt(total)} pts.`,
    '---------------------------------------------',
    'Sources du score :',
    `Trésorerie : ${formatInt(cashScore)} pts`,
    `Dette : ${formatInt(debtScore)} pts`,
    `Réputation : ${formatInt(reputationScore)} pts`,
    `Voyageurs cumulés : ${formatInt(passengerScore)} pts`,
    `Fret cumulé : ${formatInt(freightScore)} pts`,
    `Lignes actives (${activeLines}) : ${formatInt(lineScore)} pts`,
    `Époque : ${formatInt(epochScore)} pts`,
    '---------------------------------------------',
    'Les voyageurs, le fret et les lignes actives viennent directement de l’exploitation des lignes.'
  ].join('\n');
}

function co2TooltipClient(me) {
  const activeLines = (me?.lines || [])
    .filter(line => line?.active)
    .map(line => ({
      name: linePublicName(line),
      co2: Number(line?.stats?.environment?.co2PerHour ?? line?.stats?.co2PerHour ?? 0),
      energy: line?.stats?.environment?.energyType || line?.stats?.finance?.resourceType || '—'
    }))
    .filter(item => item.co2 > 0)
    .sort((a, b) => b.co2 - a.co2);
  const totalNow = activeLines.reduce((sum, item) => sum + item.co2, 0);
  const lines = [
    'CO₂ cumulé : total historique émis par la compagnie.',
    'Il augmente à chaque cycle d’exploitation selon les trains actifs, leur énergie, leur consommation, la distance et la fréquence.',
    `Cumul actuel : ${formatInt(me?.co2 || 0)} t.`,
    `Émissions actuelles estimées : ${formatInt(totalNow)} t/h.`,
    '---------------------------------------------',
    'Sources actuelles par ligne :'
  ];
  if (!activeLines.length) {
    lines.push('Aucune émission actuelle : aucune ligne active émettrice détectée.');
  } else {
    for (const item of activeLines.slice(0, 8)) {
      lines.push(`${item.name} : ${formatInt(item.co2)} t/h · énergie ${item.energy}`);
    }
    if (activeLines.length > 8) lines.push(`+ ${activeLines.length - 8} autre(s) ligne(s).`);
  }
  return lines.join('\n');
}

function financeMetric(label, amount, kind, tip = '') {
  const cls = kind === 'income' ? 'good-text' : (kind === 'expense' ? 'bad-text' : (Number(amount || 0) >= 0 ? 'good-text' : 'bad-text'));
  return metric(label, moneyPerHour(amount || 0), cls, tip);
}

function financeBreakdownTooltip(label, amount, details = []) {
  const lines = [
    `${label} : ${moneyPerHour(amount || 0)}.`,
    '---------------------------------------------',
    ...details.filter(Boolean)
  ];
  return lines.join('\n');
}

function renderFinanceSummary(me) {
  const b = me.stats?.lastBreakdown || {};
  const operatingMargin = me.stats.lastRevenue > 0 ? Math.round((me.stats.lastProfit / me.stats.lastRevenue) * 100) : 0;
  const variableLineCost = Number(b.variableLineCost || 0);
  const sharedCosts = Number(b.sharedCosts || 0);
  return `
    <div class="card">
      <h3>Résultat d’exploitation</h3>
      <div class="card-grid finance-card-grid">
        ${financeMetric('Revenus lignes /h', b.lineRevenue || me.stats.lastRevenue, 'income', financeBreakdownTooltip('Revenus lignes', b.lineRevenue || me.stats.lastRevenue, [
          `Billets voyageurs : ${moneyPerHour(b.ticketRevenue || 0)}`,
          `Recettes annexes voyageurs : ${moneyPerHour(b.ancillaryRevenue || 0)}`,
          `Fret : ${moneyPerHour(b.freightRevenue || 0)}`,
          `Bonus exploitation / dispatch : ${moneyPerHour(b.dispatchRevenueBoost || 0)}`
        ]))}
        ${financeMetric('Revenus gares /h', b.stationRevenue || 0, 'income', financeBreakdownTooltip('Revenus gares', b.stationRevenue || 0, [
          'Sources : niveau des gares possédées, commerce, dépôts, trafic voyageurs et trafic fret.',
          'Les recherches de flux voyageurs et de pôles intermodaux peuvent augmenter cette recette.'
        ]))}
        ${financeMetric('Coûts variables /h', variableLineCost, 'expense', financeBreakdownTooltip('Coûts variables', variableLineCost, [
          `Énergie : ${moneyPerHour(b.energyCost || 0)}`,
          `Maintenance trains : ${moneyPerHour(b.trainMaintenanceCost || 0)}`,
          `Infrastructure des lignes : ${moneyPerHour(b.lineInfrastructureCost || 0)}`,
          `Exploitation commerciale : ${moneyPerHour(b.commercialOperatingCost || 0)}`,
          `Péages : ${moneyPerHour(b.accessCost || 0)} dont infrastructure ${moneyPerHour(b.infrastructurePassageCost || 0)} et gares ${moneyPerHour(b.stationAccessCost || 0)}`
        ]))}
        ${financeMetric('Charges fixes /h', sharedCosts, 'expense', financeBreakdownTooltip('Charges fixes', sharedCosts, [
          `Personnel : ${moneyPerHour(b.staffCost || 0)}`,
          `Gares possédées : ${moneyPerHour(b.stationCost || 0)}`,
          `Intérêts de dette : ${moneyPerHour(b.debtCost || 0)}`,
          `Parc inutilisé : ${moneyPerHour(b.idleTrainCost || 0)}`,
          `Laboratoire R&D actif : ${moneyPerHour(b.researchCost || 0)}`
        ]))}
        ${financeMetric('Personnel /h', b.staffCost || 0, 'expense', financeBreakdownTooltip('Personnel', b.staffCost || 0, [
          'Somme des salaires horaires : conducteurs, contrôleurs, agents de gare, mécaniciens, régulateurs et ingénieurs.',
          'La Formation équipages réduit une partie de cette charge.'
        ]))}
        ${financeMetric('Gares /h', b.stationCost || 0, 'expense', financeBreakdownTooltip('Gares', b.stationCost || 0, [
          'Coût d’exploitation des gares possédées : niveau, commerces, maintenance et dépôts.'
        ]))}
        ${financeMetric('Dette /h', b.debtCost || 0, 'expense', financeBreakdownTooltip('Dette', b.debtCost || 0, [
          'Intérêts appliqués à la dette de la compagnie.'
        ]))}
        ${financeMetric('Parc inutilisé /h', b.idleTrainCost || 0, 'expense', financeBreakdownTooltip('Parc inutilisé', b.idleTrainCost || 0, [
          'Coût de stockage et d’immobilisation des trains non affectés à une ligne active.'
        ]))}
        ${financeMetric('R&D /h', b.researchCost || 0, 'expense', financeBreakdownTooltip('R&D', b.researchCost || 0, [
          'Coût du laboratoire quand une recherche est en cours.'
        ]))}
        ${metric('Résultat net /h', moneyPerHour(me.stats.lastProfit), me.stats.lastProfit >= 0 ? 'good-text' : 'bad-text', financeBreakdownTooltip('Résultat net', me.stats.lastProfit, [
          'Calcul : revenus lignes + revenus gares - coûts variables - charges fixes.'
        ]))}
        ${metric('Marge', `${operatingMargin}%`, operatingMargin >= 0 ? 'good-text' : 'bad-text', [
          `Marge d’exploitation : ${operatingMargin}%.`,
          'Calcul : résultat net / revenus totaux.'
        ].join('\n'))}
      </div>
    </div>
  `;
}
