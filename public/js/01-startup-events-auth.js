// Initialisation, événements statiques, authentification, notifications et scroll compositions.
const STATE_SNAPSHOT_DB = 'sillons-state-snapshot-v1';
const STATE_SNAPSHOT_STORE = 'players';
const STATE_SESSION_SNAPSHOT_KEY = 'sillons.stateSnapshot.v1';
const STATE_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function init() {
  app.bootTimings = { startedAt: performance.now(), initMs: 0, snapshotMs: 0 };
  app.map.canvas = $('#map');
  app.map.ctx = app.map.canvas.getContext('2d');
  hydratePersistedOsmRouteCache();
  bindStaticEvents();
  preloadArt();
  preloadMapSprites();
  initOsmMap();
  startResearchAnimationLoop();
  requestAnimationFrame(drawLoop);
  window.addEventListener('pagehide', persistStateSnapshotBeforeReload);
  app.bootTimings.initMs = performance.now() - app.bootTimings.startedAt;

  const snapshotStartedAt = performance.now();
  const snapshot = await readStateSnapshot();
  app.bootTimings.snapshotHit = Boolean(snapshot);
  if (snapshot) applyStateSnapshot(snapshot);
  app.bootTimings.snapshotMs = performance.now() - snapshotStartedAt;

  void refreshState(true);
  setInterval(() => refreshState(false, { includeAdmin: app.activeTab === 'admin' }), 2300);
}

function openStateSnapshotDb() {
  if (!window.indexedDB) return Promise.reject(new Error('IndexedDB indisponible.'));
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(STATE_SNAPSHOT_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STATE_SNAPSHOT_STORE)) {
        request.result.createObjectStore(STATE_SNAPSHOT_STORE, { keyPath: 'playerId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Ouverture IndexedDB impossible.'));
  });
}

async function readStateSnapshot() {
  const playerId = String(app.playerId || '');
  if (!app.authToken || !playerId) return null;
  const sessionSnapshot = readSessionStateSnapshot(playerId);
  if (sessionSnapshot) return sessionSnapshot;
  try {
    const db = await openStateSnapshotDb();
    const record = await new Promise((resolve, reject) => {
      const transaction = db.transaction(STATE_SNAPSHOT_STORE, 'readonly');
      const request = transaction.objectStore(STATE_SNAPSHOT_STORE).get(playerId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Lecture IndexedDB impossible.'));
    });
    db.close();
    if (!record?.state || Date.now() - Number(record.savedAt || 0) > STATE_SNAPSHOT_MAX_AGE_MS) return null;
    if (String(record.state.auth?.playerId || record.state.me?.id || '') !== playerId) return null;
    return record.state;
  } catch (error) {
    console.warn('Cache local de session indisponible:', error.message);
    return null;
  }
}

function isUsableStateSnapshot(record, playerId) {
  if (!record?.state || Date.now() - Number(record.savedAt || 0) > STATE_SNAPSHOT_MAX_AGE_MS) return false;
  return String(record.playerId || record.state.auth?.playerId || record.state.me?.id || '') === playerId;
}

function readSessionStateSnapshot(playerId) {
  try {
    const raw = window.sessionStorage?.getItem(STATE_SESSION_SNAPSHOT_KEY);
    const record = raw ? JSON.parse(raw) : null;
    return isUsableStateSnapshot(record, playerId) ? record.state : null;
  } catch (error) {
    return null;
  }
}

function writeSessionStateSnapshot(playerId, data) {
  try {
    window.sessionStorage?.setItem(STATE_SESSION_SNAPSHOT_KEY, JSON.stringify({ playerId, savedAt: Date.now(), state: data }));
  } catch (error) {
    // Les navigateurs aux quotas faibles conservent toujours le secours IndexedDB.
  }
}

function compactStateSnapshot(data) {
  const snapshotStations = Array.isArray(data?.world?.stations)
    ? data.world.stations.map(station => ({
      id: station.id,
      name: station.name,
      commune: Boolean(station.commune),
      multiStation: Boolean(station.multiStation),
      lat: station.lat,
      lon: station.lon,
      railLat: station.railLat,
      railLon: station.railLon,
      placement: station.placement,
      population: station.population,
      baseDemand: station.baseDemand,
      freight: station.freight,
      annualPassengers: station.annualPassengers,
      passengerTrafficYear: station.passengerTrafficYear,
      purchaseCost: station.purchaseCost,
      majorTerminal: Boolean(station.majorTerminal),
      hasPassengerStation: Boolean(station.hasPassengerStation),
      hasFreightStation: Boolean(station.hasFreightStation)
    }))
    : [];
  // Le premier rendu n'a besoin que de la compagnie courante. Les données des
  // autres joueurs et les rapports administratifs arrivent à la synchronisation
  // suivante ; cela garde le snapshot sous le quota des stockages synchrones.
  return {
    ...data,
    world: data.world ? { ...data.world, stations: snapshotStations } : data.world,
    bugReports: [],
    admin: null
  };
}

function scheduleStateSnapshot(data) {
  const playerId = String(data?.auth?.playerId || data?.me?.id || '');
  if (!playerId || !data?.me) return;
  const snapshot = compactStateSnapshot(data);
  clearTimeout(app.stateSnapshotTimer);
  app.stateSnapshotTimer = setTimeout(async () => {
    try {
      writeSessionStateSnapshot(playerId, snapshot);
      const db = await openStateSnapshotDb();
      const transaction = db.transaction(STATE_SNAPSHOT_STORE, 'readwrite');
      transaction.objectStore(STATE_SNAPSHOT_STORE).put({ playerId, savedAt: Date.now(), state: snapshot });
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => { db.close(); console.warn('Écriture du cache local impossible.'); };
    } catch (error) {
      console.warn('Cache local de session indisponible:', error.message);
    }
  }, 0);
}

function persistStateSnapshotBeforeReload() {
  const playerId = String(app.state?.auth?.playerId || app.state?.me?.id || '');
  if (!playerId || !app.state?.me) return;
  writeSessionStateSnapshot(playerId, compactStateSnapshot(app.state));
}

function applyStateSnapshot(data) {
  if (!data?.ok || !data?.me || !data?.world) return false;
  canonicalizeStateStationDisplays(data);
  app.serverClockOffset = Number(data.serverTime || Date.now()) - Date.now();
  app.routeDataSignature = worldRouteSignature(data);
  app.state = data;
  $('#setup')?.classList.add('hidden');
  ensureSelectedStation();
  resizeCanvas();
  renderAll();
  return true;
}


function syncSidePanelCollapseUi(animate = true) {
  const layout = document.querySelector('.layout');
  const btn = $('#panelCollapseBtn');
  if (!layout || !btn) return;
  layout.classList.toggle('side-collapsed', !!app.sidePanelCollapsed);
  layout.classList.toggle('no-panel-transition', !animate);
  btn.classList.toggle('is-collapsed', !!app.sidePanelCollapsed);
  btn.setAttribute('aria-label', app.sidePanelCollapsed ? 'Rouvrir le panneau latéral' : 'Réduire le panneau latéral');
  btn.title = app.sidePanelCollapsed ? 'Rouvrir le panneau latéral' : 'Réduire le panneau latéral';
  const arrow = btn.querySelector('span');
  if (arrow) arrow.textContent = app.sidePanelCollapsed ? '‹' : '›';
  requestAnimationFrame(() => {
    if (layout.classList.contains('no-panel-transition')) layout.classList.remove('no-panel-transition');
    resizeCanvas();
    scheduleLeafletInvalidateSize();
    drawMap();
  });
}

function toggleSidePanelCollapse() {
  app.sidePanelCollapsed = !app.sidePanelCollapsed;
  localStorage.setItem('sillons.sidePanelCollapsed', app.sidePanelCollapsed ? '1' : '0');
  syncSidePanelCollapseUi(true);
}

function bindStaticEvents() {
  $('#setupForm').addEventListener('submit', handleAuthSubmit);
  $('#authLoginTab')?.addEventListener('click', () => setAuthMode('login'));
  $('#authRegisterTab')?.addEventListener('click', () => setAuthMode('register'));
  $('#logoutBtn')?.addEventListener('click', logoutAccount);

  $('#tabs').addEventListener('click', event => {
    const button = event.target.closest('button[data-tab]');
    if (!button) return;
    app.activeTab = button.dataset.tab;
    localStorage.setItem('sillons.activeTab', app.activeTab);
    if (app.activeTab === 'bugs') markBugReportsRead({ syncServer: true, skipRender: true });
    renderAll();
    if (app.activeTab === 'admin' && app.state?.auth?.isAdmin && !app.state.admin) {
      void refreshState(false, { includeAdmin: true });
    }
  });

  $('#mapToggleBtn')?.addEventListener('click', toggleMapVisibility);
  $('#panelCollapseBtn')?.addEventListener('click', toggleSidePanelCollapse);
  syncSidePanelCollapseUi(false);
  $('#zoomInBtn')?.addEventListener('click', () => app.map.leaflet?.zoomIn());
  $('#zoomOutBtn')?.addEventListener('click', () => app.map.leaflet?.zoomOut());
  $('#zoomResetBtn')?.addEventListener('click', fitFranceMap);
  const showOtherLinesBox = $('#showOtherLines');
  if (showOtherLinesBox) {
    showOtherLinesBox.checked = app.showOtherLines;
    syncOtherLinesToggle();
    showOtherLinesBox.addEventListener('change', event => {
      app.showOtherLines = !!event.target.checked;
      localStorage.setItem('sillons.showOtherLines', app.showOtherLines ? '1' : '0');
      syncOtherLinesToggle();
      invalidateMapProjection('line-filter');
      drawMap();
    });
  }
  $('#clearFocusedLineBtn')?.addEventListener('click', clearFocusedLine);
  $('#addStopBtn')?.addEventListener('click', enableStationPlacement);
  $('#cancelStopBtn')?.addEventListener('click', disableStationPlacement);
  $('#renameBtn').addEventListener('click', openCompanyModal);
  $('#tutorialBtn')?.addEventListener('click', () => syncTutorial({ op: 'restart' }));
  $('#resetBtn').addEventListener('click', openResetModal);
  document.addEventListener('click', event => {
    const versionBadge = event.target.closest('#versionBadge');
    if (!versionBadge) return;
    event.preventDefault();
    openChangelogModal();
  });

  document.addEventListener('click', event => {
    const toggle = event.target.closest?.('#notificationToggleBtn');
    const panel = event.target.closest?.('.notification-dropdown-panel');
    if (toggle) {
      event.preventDefault();
      app.notificationsOpen = !app.notificationsOpen;
      if (app.notificationsOpen) markNotificationsRead({ syncServer: true, skipRender: true });
      renderNotificationDropdown(true);
      return;
    }
    if (panel) return;
    if (app.notificationsOpen) {
      app.notificationsOpen = false;
      renderNotificationDropdown(true);
    }
  });

  $('#logoPicker')?.addEventListener('click', event => {
    const card = event.target.closest('[data-logo-id]');
    if (!card) return;
    selectSetupLogo(card.dataset.logoId);
  });

  document.addEventListener('focusin', markUiInteraction, true);
  document.addEventListener('pointerdown', event => {
    if (isInteractiveElement(event.target)) markUiInteraction();
  }, true);
  document.addEventListener('input', event => {
  if (event.target.id === 'compPassengerCars') { const n = $('#compPassengerCarsValue'); if (n) n.value = event.target.value; }
  if (event.target.id === 'compPassengerCarsValue') { const n = $('#compPassengerCars'); if (n) n.value = event.target.value; }
  if (event.target.id === 'compFreightCars') { const n = $('#compFreightCarsValue'); if (n) n.value = event.target.value; }
  if (event.target.id === 'compFreightCarsValue') { const n = $('#compFreightCars'); if (n) n.value = event.target.value; }
  if (event.target.id === 'compPowerUnits') { const n = $('#compPowerUnitsValue'); if (n) n.value = event.target.value; }
  if (event.target.id === 'compPowerUnitsValue') { const n = $('#compPowerUnits'); if (n) n.value = event.target.value; }
    if (isInteractiveElement(event.target)) markUiInteraction();
  }, true);
  document.addEventListener('change', event => {
    if (event.target?.id === 'fleetSortMode') {
      app.fleetSortMode = event.target.value || 'era';
      localStorage.setItem('sillons.fleetSortMode', app.fleetSortMode);
      renderAll();
    }
    if (isInteractiveElement(event.target)) markUiInteraction();
  }, true);

  const tabContent = $('#tabContent');
  tabContent.addEventListener('click', onTabContentClick);
  tabContent.addEventListener('change', onTabContentChange);
  bindCompositionIndependentScroll(tabContent);
  tabContent.addEventListener('input', event => {
    if (['lineTicketPrice', 'lineTicketPriceRange'].includes(event.target.id)) {
      updateLineDraftFromForm(event.target.id);
      updateLinePreview(event.target.id);
    }
    if (event.target?.dataset?.buyTrainQty) {
      updateTrainPurchaseTotal(event.target, { commit: false });
    }
    if (event.target?.id === 'researchSearchInput') {
      app.researchSearchQuery = event.target.value || '';
      localStorage.setItem('sillons.researchSearchQuery', app.researchSearchQuery);
      refreshResearchSearchResults();
    }
    if (event.target.classList?.contains('station-search-input')) {
      updateStationSearch(event.target.dataset.role, event.target.value);
    }
  });

  window.addEventListener('resize', () => { resizeCanvas(); scheduleCompositionRefitScrollAdjustment(); hideGlobalTooltip(); scheduleTutorialOverlayPosition(60, { scroll: false }); });
  window.visualViewport?.addEventListener('resize', () => { resizeCanvas(); scheduleCompositionRefitScrollAdjustment(); scheduleTutorialOverlayPosition(60, { scroll: false }); });
  window.visualViewport?.addEventListener('scroll', () => { scheduleCompositionRefitScrollAdjustment(); scheduleTutorialOverlayPosition(30, { scroll: false }); });
  window.addEventListener('scroll', () => scheduleTutorialOverlayPosition(30, { scroll: false }), true);
  bindGlobalTooltips();
}


function syncOtherLinesToggle() {
  const input = $('#showOtherLines');
  const toggle = $('.other-lines-toggle');
  const state = $('#showOtherLinesState');
  if (!input || !toggle) return;
  const active = !!input.checked;
  toggle.classList.toggle('is-active', active);
  toggle.classList.toggle('is-muted', !active);
  toggle.setAttribute('aria-label', active
    ? 'Les lignes des autres joueurs sont affichées sur la carte. Cliquer pour les masquer.'
    : 'Les lignes des autres joueurs sont masquées sur la carte. Cliquer pour les afficher.');
  toggle.title = active
    ? 'Les lignes et trains des autres joueurs sont actuellement visibles. Clique pour les masquer.'
    : 'Les lignes et trains des autres joueurs sont actuellement masqués. Clique pour les afficher.';
  if (state) state.textContent = active ? 'Affichées sur la carte' : 'Masquées sur la carte';
}

function bindGlobalTooltips() {
  document.addEventListener('pointerover', event => {
    const target = event.target.closest?.('[data-tooltip]');
    if (!target) return;
    showGlobalTooltip(target);
  });
  document.addEventListener('pointerout', event => {
    const target = event.target.closest?.('[data-tooltip]');
    if (target) hideGlobalTooltip();
  });
  document.addEventListener('focusin', event => {
    const target = event.target.closest?.('[data-tooltip]');
    if (target) showGlobalTooltip(target);
  });
  document.addEventListener('focusout', event => {
    if (event.target.closest?.('[data-tooltip]')) hideGlobalTooltip();
  });
  document.addEventListener('scroll', hideGlobalTooltip, true);
  document.addEventListener('scroll', event => {
    const editor = event.target?.closest?.('.composition-editor-card');
    if (editor || event.target?.classList?.contains('composition-editor-card') || event.target?.classList?.contains('composition-strip') || event.target?.classList?.contains('composition-group-list')) {
      captureCompositionScrollPosition();
    }
  }, true);
}

function tooltipLineClass(line) {
  const text = String(line || '').trim().toLowerCase();
  if (!text) return '';
  if (/^bonus\b|^\[\+\]|^\+/.test(text)) return 'tooltip-line--production';
  if (/^malus\b|^\[-\]|^-/.test(text)) return 'tooltip-line--consumption';
  if (text.startsWith('dépenses') || text.startsWith('depenses') || text.startsWith('charges') || text.startsWith('consommation')) return 'tooltip-line--consumption';
  if (text.startsWith('revenus') || text.startsWith('stock disponible') || text.startsWith('commande producteur') || text.startsWith('production')) return 'tooltip-line--production';
  if (text.startsWith('résultat net') || text.startsWith('resultat net')) {
    const match = text.match(/([-+]?\d[\d\s.,]*)\s*€/);
    if (match) return String(match[1]).trim().startsWith('-') ? 'tooltip-line--consumption' : 'tooltip-line--production';
  }
  if (/^-{4,}$/.test(text)) return 'tooltip-line--separator';
  return '';
}

function renderTooltipLine(line) {
  const cls = tooltipLineClass(line);
  const row = document.createElement('div');
  row.className = `tooltip-line ${cls}`.trim();
  const valueSplit = String(line || '').split(/:(.+)/);
  if (cls === 'tooltip-line--separator') {
    row.textContent = '────────────────────────────';
    return row;
  }
  if (valueSplit.length >= 3) {
    const label = document.createElement('span');
    label.className = 'tooltip-label';
    label.textContent = `${valueSplit[0]} : `;
    const value = document.createElement('b');
    value.className = 'tooltip-value';
    value.textContent = valueSplit[1].trim();
    row.append(label, value);
  } else {
    row.textContent = line;
  }
  return row;
}

function showGlobalTooltip(target) {
  const text = target.dataset.tooltip;
  if (!text) return;
  let tip = $('#globalTooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'globalTooltip';
    tip.className = 'global-tooltip';
    document.body.appendChild(tip);
  }
  tip.innerHTML = '';
  String(text).split('\n').forEach(line => tip.appendChild(renderTooltipLine(line)));
  tip.classList.add('visible');

  const rect = target.getBoundingClientRect();
  const margin = 12;
  const maxWidth = Math.min(460, window.innerWidth - margin * 2);
  tip.style.maxWidth = `${maxWidth}px`;
  tip.style.left = '0px';
  tip.style.top = '0px';

  const box = tip.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - box.width / 2;
  left = Math.max(margin, Math.min(window.innerWidth - box.width - margin, left));

  let top = rect.top - box.height - 12;
  if (top < margin) top = rect.bottom + 12;
  if (top + box.height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - box.height - margin);

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function hideGlobalTooltip() {
  const tip = $('#globalTooltip');
  if (tip) tip.classList.remove('visible');
}


function invalidateMapProjection(reason = 'projection') {
  app.routeCache.clear();
  app.map.needsRouteReproject = false;
  app.map.stationDrawCache = { key: '', items: [] };
  app.map.visibleStationCache = { key: '', stations: [] };
}

function markMapProjectionDirty() {
  app.map.needsRouteReproject = true;
  app.map.stationDrawCache.key = '';
}

function rememberCacheEntry(cache, key, value, maxEntries) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
    if (cache === app.osmRouteCache) app.routeSpeedCache.delete(oldestKey);
  }
  if (cache === app.osmRouteCache) schedulePersistedOsmRouteCacheSave();
  return value;
}

function getCacheEntry(cache, key) {
  if (!cache.has(key)) return null;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function normalizePersistedRouteGeometry(value) {
  const rawGeometry = Array.isArray(value) ? value : (Array.isArray(value?.geometry) ? value.geometry : []);
  if (!Array.isArray(rawGeometry) || rawGeometry.length < 2) return null;
  const coords = rawGeometry
    .map(pair => Array.isArray(pair) ? [Number(pair[0]), Number(pair[1])] : null)
    .filter(pair => pair && Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
  return coords.length >= 2 ? coords : null;
}

function persistableOsmRouteCacheEntries() {
  return [...app.osmRouteCache.entries()]
    .slice(-OSM_ROUTE_CACHE_MAX_ENTRIES)
    .map(([key, geometry]) => {
      const normalized = normalizePersistedRouteGeometry(geometry);
      if (!normalized) return null;
      const speedProfile = normalizeRouteSpeedProfile(app.routeSpeedCache.get(key), normalized);
      return [key, speedProfile ? { geometry: normalized, speedProfile } : normalized];
    })
    .filter(Boolean);
}

function hydratePersistedOsmRouteCache() {
  const payload = loadJson(PERSISTED_OSM_ROUTE_CACHE_KEY, null);
  if (!payload || payload.version !== PERSISTED_OSM_ROUTE_CACHE_VERSION) return;
  if (Date.now() - Number(payload.savedAt || 0) > PERSISTED_OSM_ROUTE_CACHE_MAX_AGE_MS) {
    localStorage.removeItem(PERSISTED_OSM_ROUTE_CACHE_KEY);
    return;
  }
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [key, geometry] = entry;
    const normalized = normalizePersistedRouteGeometry(geometry);
    if (typeof key === 'string' && normalized) {
      app.osmRouteCache.set(key, normalized);
      const speedProfile = normalizeRouteSpeedProfile(geometry?.speedProfile, normalized);
      if (speedProfile) app.routeSpeedCache.set(key, speedProfile);
      while (app.osmRouteCache.size > OSM_ROUTE_CACHE_MAX_ENTRIES) {
        const oldestKey = app.osmRouteCache.keys().next().value;
        app.osmRouteCache.delete(oldestKey);
        app.routeSpeedCache.delete(oldestKey);
      }
    }
  }
}

function schedulePersistedOsmRouteCacheSave() {
  clearTimeout(app.osmRouteCachePersistTimer);
  app.osmRouteCachePersistTimer = setTimeout(persistOsmRouteCache, PERSISTED_OSM_ROUTE_CACHE_SAVE_DELAY_MS);
}

function persistOsmRouteCache() {
  app.osmRouteCachePersistTimer = null;
  let entries = persistableOsmRouteCacheEntries();
  while (entries.length) {
    try {
      localStorage.setItem(PERSISTED_OSM_ROUTE_CACHE_KEY, JSON.stringify({
        version: PERSISTED_OSM_ROUTE_CACHE_VERSION,
        savedAt: Date.now(),
        entries
      }));
      return;
    } catch {
      entries = entries.slice(Math.ceil(entries.length / 2));
    }
  }
  localStorage.removeItem(PERSISTED_OSM_ROUTE_CACHE_KEY);
}

function resetMapCanvasTransform() {
  const overlay = app.map.panOverlay || {};
  overlay.active = false;
  overlay.finishing = false;
  overlay.zooming = false;
  overlay.raf = false;
  overlay.transform = '';
  if (app.map.canvas) {
    app.map.canvas.style.transform = '';
    app.map.canvas.style.transformOrigin = '';
    app.map.canvas.style.willChange = '';
    app.map.canvas.classList.remove('map-pan-overlay');
  }
}

function cloneLeafletPoint(point) {
  if (!point) return null;
  return { x: Number(point.x || 0), y: Number(point.y || 0) };
}

function leafletNewPixelOrigin(center, zoom) {
  const map = app.map.leaflet;
  if (!map) return null;
  try {
    if (typeof map._getNewPixelOrigin === 'function') {
      return cloneLeafletPoint(map._getNewPixelOrigin(center, zoom));
    }
    const projected = map.project(center, zoom);
    const halfSize = map.getSize().divideBy(2);
    return cloneLeafletPoint(projected.subtract(halfSize));
  } catch {
    return null;
  }
}

function startPanOverlay(mode = 'pan') {
  resetMapCanvasTransform();
}

function setMapOverlayTransform(center, zoom) {
  const overlay = app.map.panOverlay;
  const map = app.map.leaflet;
  const canvas = app.map.canvas;
  if (!overlay.active || !map || !canvas) return;

  const baseZoom = Number.isFinite(Number(overlay.baseZoom)) ? Number(overlay.baseZoom) : map.getZoom();
  const baseOrigin = overlay.basePixelOrigin || cloneLeafletPoint(map.getPixelOrigin?.());
  const targetZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : map.getZoom();
  const targetCenter = center || map.getCenter();
  const targetOrigin = leafletNewPixelOrigin(targetCenter, targetZoom);
  if (!baseOrigin || !targetOrigin) return;

  const scale = map.getZoomScale ? map.getZoomScale(targetZoom, baseZoom) : Math.pow(2, targetZoom - baseZoom);
  const dx = (baseOrigin.x * scale) - targetOrigin.x;
  const dy = (baseOrigin.y * scale) - targetOrigin.y;
  const roundedDx = Math.round(dx * 1000) / 1000;
  const roundedDy = Math.round(dy * 1000) / 1000;
  const roundedScale = Math.round(scale * 1000000) / 1000000;
  overlay.transform = `translate3d(${roundedDx}px, ${roundedDy}px, 0) scale(${roundedScale})`;
  canvas.style.transform = overlay.transform;
}

function updatePanOverlay() {
  resetMapCanvasTransform();
}

function updateZoomOverlay(event) {
  resetMapCanvasTransform();
  markMapProjectionDirty();
  requestMapRedraw({ lite: true });
}

function endPanOverlay() {
  resetMapCanvasTransform();
  requestMapRedraw({ lite: false });
}

function worldRouteSignature(state = app.state) {
  if (!state?.players || !state?.world) return '';
  const playerSig = state.players.map(p => `${p.id}:${(p.lines || []).map(l => `${l.id}:${lineStopsOf(l).join('>')}:${lineTrainIdsOf(l).join('+')}:${l.active ? 1 : 0}:${l.electrified ? 1 : 0}`).join('|')}`).join('||');
  const communeStatus = state.world.communesStatus || {};
  const stationSig = `${state.world.stations?.length || 0}:${communeStatus.status || ''}:${communeStatus.count || 0}:${communeStatus.updatedAt || ''}`;
  return `${playerSig}::stations:${stationSig}`;
}

function stateRenderSignature(state = app.state) {
  if (!state?.game) return '';
  const me = state.me;
  const game = state.game;
  const events = (game.events || []).map(e => `${e.kind}:${e.remaining}`).join('|');
  const news = (game.news || []).map(n => `${n.day}:${n.text}`).join('|');
  const world = state.world?.communesStatus;
  const bugSig = (state.bugReports || []).map(bug => `${bug.id}:${bug.status}:${bug.createdAt}:${bug.closedAt || 0}`).join('|');
  const bugReadSig = `${state.auth?.bugReportsReadAt || 0}:${state.auth?.bugReportsUnreadCount || 0}`;
  const adminSig = state.auth?.isAdmin ? [
    state.admin?.activity?.generatedAt || 0,
    state.admin?.activity?.onlineCount || 0,
    state.admin?.activity?.activeSessionCount || 0,
    (state.admin?.activity?.recentActivity || []).slice(0, 8).map(event => `${event.at}:${event.playerId}:${event.type}:${event.detail || ''}`).join('|')
  ].join(';') : '';
  const meSig = me ? [
    me.id,
    me.cash,
    me.debt,
    me.epoch,
    Math.round(me.research * 100),
    Math.round(me.reputation * 100),
    me.stats?.lastRevenue,
    me.stats?.lastExpenses,
    me.stats?.lastProfit,
    me.stats?.passengers,
    me.stats?.freightTons,
    epochTrafficTotalClient(me),
    Object.values(me.staff || {}).join(','),
    Object.keys(me.stations || {}).length,
    (me.trains || []).map(t => `${t.id}:${Math.round((t.condition || 0) * 1000)}:${t.profile?.speed || ''}:${t.profile?.energy || ''}:${t.maintenance?.active ? t.maintenance.daysLeft : 0}`).join('|'),
    (me.lines || []).map(l => `${l.id}:${l.active ? 1 : 0}:${l.frequency}:${l.tariff}:${l.service}:${lineTrainIdsOf(l).join('+')}:${lineStopsOf(l).join('>')}:${l.stats?.revenue}:${l.stats?.expenses}:${l.stats?.profit}:${l.stats?.passengers}:${l.stats?.freightTons}:${l.stats?.market?.passengerShare}:${l.stats?.market?.freightShare}:${l.stats?.capacity?.sillons?.maxFrequency}:${l.stats?.capacity?.sillons?.lineCapacity}:${l.stats?.capacity?.sillons?.theoreticalCapacity}:${l.stats?.capacity?.sillons?.backgroundUsed}:${l.stats?.capacity?.sillons?.totalUsed}:${l.stats?.capacity?.sillons?.utilizationPercent}`).join('|'),
    Object.entries(me.techUnlocked || {}).sort().map(([id, level]) => `${id}:${level}`).join(','),
    me.researchProject ? `${me.researchProject.nodeId}:${me.researchProject.targetLevel}:${me.researchProject.durationMs}:${me.researchProject.costMoney || 0}:${me.researchProject.startedAt || 0}` : '',
    (me.researchQueue || []).map(item => `${item.nodeId}:${item.targetLevel}`).join('|')
  ].join(';') : 'setup';
  return [
    game.day,
    game.eraYear,
    game.playerCount,
    events,
    news,
    world?.status || '',
    world?.count || 0,
    worldRouteSignature(state),
    bugSig,
    bugReadSig,
    meSig,
    adminSig
  ].join('::');
}


function isFleetSubmenuAutoRefreshFrozen() {
  // La maintenance doit refléter immédiatement les sorties d'atelier ; seuls les
  // sous-menus avec sélections ou champs à préserver restent gelés entre deux ticks.
  return app.activeTab === 'fleet' && ['catalog', 'composition'].includes(app.activeFleetSubtab || '');
}

function isResearchTreeAutoRefreshFrozen() {
  return app.activeTab === 'research' && Boolean(app.selectedResearchId);
}

async function refreshState(first, { includeAdmin = false } = {}) {
  if (app.refreshInFlight) return;
  app.refreshInFlight = true;
  try {
    const requestStartedAt = performance.now();
    const stateUrl = includeAdmin ? '/api/state?include=admin' : '/api/state';
    const response = await fetch(stateUrl, { cache: 'no-store', headers: authHeaders() });
    const responseReceivedAt = performance.now();
    const data = await readJsonResponse(response, 'Reponse serveur invalide.');
    const parsedAt = performance.now();
    if (response.status === 401) {
      clearAuthState();
      $('#setup')?.classList.remove('hidden');
    }
    if (!data.ok) throw new Error(data.error || 'État indisponible.');
    canonicalizeStateStationDisplays(data);
    const normalizedAt = performance.now();
    app.serverClockOffset = Number(data.serverTime || Date.now()) - Date.now();
    const previousSignature = app.routeDataSignature;
    const previousCash = Number(app.state?.me?.cash);
    app.state = data;
    scheduleStateSnapshot(data);
    const nextSignature = worldRouteSignature(data);
    if (nextSignature !== previousSignature) {
      app.routeDataSignature = nextSignature;
      invalidateMapProjection('state-change');
    }
    if (first) {
      renderSetupLogoPicker();
      if (!data.me) { $('#setup').classList.remove('hidden'); setAuthMode(app.authMode || 'login'); }
      resizeCanvas();
    }
    if (data.auth?.playerId) { app.playerId = data.auth.playerId; localStorage.setItem('sillons.playerId', app.playerId); }
    if (data.me) {
      $('#setup').classList.add('hidden');
      maybeNotify(data.me);
      ensureSelectedStation();
    }
    const nextRenderKey = stateRenderSignature(data);
    const shouldRender = first || nextRenderKey !== app.lastRenderKey;
    if (!shouldRender) return;
    if (!first && (isFleetSubmenuAutoRefreshFrozen() || isResearchTreeAutoRefreshFrozen())) {
      // Les sous-menus du Parc ne sont plus reconstruits à chaque tick serveur :
      // les sélections, scrolls, boutons et champs restent stables jusqu'à une action utilisateur.
      renderTopbar();
      app.lastRenderKey = nextRenderKey;
    } else if (!first && isInteractiveUiActive()) {
      // Ne pas reconstruire l’onglet pendant une interaction utilisateur :
      // menus déroulants, saisie, sliders, suggestions et formulaires restent ouverts.
      renderTopbar();
    } else {
      renderAll();
    }
    if (first) {
      reportClientBootMetrics({
        initMs: app.bootTimings?.initMs || 0,
        snapshotMs: app.bootTimings?.snapshotMs || 0,
        snapshotHit: app.bootTimings?.snapshotHit ? 1 : 0,
        requestMs: responseReceivedAt - requestStartedAt,
        parseMs: parsedAt - responseReceivedAt,
        normalizeMs: normalizedAt - parsedAt,
        renderMs: performance.now() - normalizedAt,
        totalMs: performance.now() - (app.bootTimings?.startedAt || requestStartedAt),
        stateBytes: Number(response.headers.get('content-length') || 0),
        serverTiming: response.headers.get('server-timing') || ''
      });
    }
    const nextCash = Number(data.me?.cash);
    if (!first && Number.isFinite(previousCash) && Number.isFinite(nextCash) && previousCash !== nextCash) {
      animateCashDelta(nextCash - previousCash);
    }
  } catch (error) {
    if (first) toast('Impossible de joindre le serveur local. Lance `node server.js` puis recharge la page.', 'error');
    console.error(error);
  } finally {
    app.refreshInFlight = false;
  }
}


function reportClientBootMetrics(metrics) {
  const clean = {
    ...Object.fromEntries(Object.entries(metrics).filter(([key]) => key !== 'serverTiming').map(([key, value]) => [key, Math.round(Number(value) || 0)])),
    serverTiming: String(metrics.serverTiming || '').slice(0, 400)
  };
  window.__sillonsBootMetrics = clean;
  const body = JSON.stringify(clean);
  if (navigator.sendBeacon?.('/api/client-boot-metrics', body)) return;
  fetch('/api/client-boot-metrics', { method: 'POST', body, keepalive: true }).catch(() => null);
}

function initOsmMap() {
  const target = $('#osmMap');
  if (!target) return;
  if (!window.L) {
    target.innerHTML = '<div class="osm-error">Carte indisponible. Vérifie ta connexion internet.</div><canvas id="map" width="1200" height="820"></canvas>';
    app.map.canvas = $('#map');
    app.map.ctx = app.map.canvas?.getContext('2d');
    resizeCanvas();
    return;
  }

  app.map.leaflet = L.map(target, {
    center: [46.75, 2.35],
    zoom: 6,
    minZoom: 5,
    maxZoom: 13,
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true,
    zoomAnimation: false,
    markerZoomAnimation: false,
    fadeAnimation: false
  });

  addReliableFrenchTileLayer(app.map.leaflet);
  clearTrainMarkerLayer();

  L.control.zoom({ position: 'bottomright' }).addTo(app.map.leaflet);

  app.map.leaflet.on('zoomstart', () => {
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    resetMapCanvasTransform();
    resizeCanvas();
    invalidateMapProjection('zoom-start');
    requestMapRedraw({ lite: true });
  });
  app.map.leaflet.on('zoomanim', () => {
    // Les animations de zoom Leaflet sont désactivées pour cette carte canvas.
    // Si un navigateur déclenche malgré tout l'événement, on force un redraw simple.
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    resetMapCanvasTransform();
    invalidateMapProjection('zoom-anim');
    requestMapRedraw({ lite: true });
  });
  app.map.leaflet.on('zoom', () => {
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    resetMapCanvasTransform();
    invalidateMapProjection('zoom');
    requestMapRedraw({ lite: true });
  });
  app.map.leaflet.on('zoomend', () => {
    app.map.navigating = false;
    app.map.trainMarkerZoomFrame = null;
    resetMapCanvasTransform();
    resizeCanvas();
    updateIsoClass();
    invalidateMapProjection('zoom-end');
    requestMapRedraw({ lite: false });
  });

  app.map.leaflet.on('movestart', () => {
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    resetMapCanvasTransform();
    markMapProjectionDirty();
    requestMapRedraw({ lite: true });
  });
  app.map.leaflet.on('move', () => {
    app.map.navigating = true;
    app.map.lastMoveEventAt = performance.now();
    resetMapCanvasTransform();
    markMapProjectionDirty();
    requestMapRedraw({ lite: true });
  });
  app.map.leaflet.on('moveend', () => {
    app.map.navigating = false;
    resetMapCanvasTransform();
    resizeCanvas();
    updateIsoClass();
    invalidateMapProjection('move-end');
    requestMapRedraw({ lite: false });
  });
  app.map.leaflet.on('resize', () => {
    app.map.navigating = false;
    resetMapCanvasTransform();
    resizeCanvas();
    updateIsoClass();
    invalidateMapProjection('map-resize');
    requestMapRedraw({ lite: false });
  });
  app.map.leaflet.on('mousemove', onOsmMouseMove);
  app.map.leaflet.on('mouseout', () => {
    app.hoverStation = null;
    app.hoverLine = null;
    app.map.leaflet.getContainer().style.cursor = '';
  });
  app.map.leaflet.on('click', onOsmClick);

  app.map.leaflet.whenReady(() => {
    app.map.mapReady = true;
    resizeCanvas();
    fitFranceMap();
    updateIsoClass();
  });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(target);
  }
}

function addReliableFrenchTileLayer(map) {
  const layers = [
    {
      name: 'Carte standard',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution: 'Cartographie'
      }
    },
    {
      name: 'Carte France',
      url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
      options: {
        maxZoom: 20,
        subdomains: ['a', 'b', 'c'],
        attribution: 'Cartographie · rendu Carte France'
      }
    },
    {
      name: 'Carte secours',
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      options: {
        maxZoom: 19,
        attribution: 'Cartographie'
      }
    }
  ];

  let index = 0;
  let current = null;
  let errorCount = 0;

  function installLayer(nextIndex) {
    index = Math.min(nextIndex, layers.length - 1);
    const def = layers[index];
    errorCount = 0;
    if (current) {
      current.off('tileerror');
      try { map.removeLayer(current); } catch {}
    }
    current = L.tileLayer(def.url, {
      ...def.options,
      crossOrigin: false,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 3
    });
    current.on('tileerror', () => {
      errorCount += 1;
      if (errorCount >= 4 && index < layers.length - 1) installLayer(index + 1);
    });
    current.addTo(map);
    app.map.tileLayerName = def.name;
  }

  installLayer(0);
}


function fitFranceMap() {
  if (!app.map.leaflet) return;
  app.map.leaflet.fitBounds([[41.2, -5.3], [51.2, 9.7]], { padding: [20, 20] });
}

function updateIsoClass() {
  const section = $('.map-section');
  if (!section || !app.map.leaflet) return;
  const iso = app.map.leaflet.getZoom() >= 9;
  section.classList.toggle('osm-isometric', iso);
}

function enableStationPlacement() {
  toast('Création désactivée : seules les gares réelles SNCF sont jouables.');
  $('#addStopBtn')?.classList.add('hidden');
  $('#cancelStopBtn')?.classList.add('hidden');
  const hint = $('#mapHint');
  if (hint) hint.textContent = 'Clique une gare réelle du Réseau Ferré National.';
}

function disableStationPlacement() {
  app.map.stationPlacement = false;
  $('#addStopBtn')?.classList.add('hidden');
  $('#cancelStopBtn')?.classList.add('hidden');
  const hint = $('#mapHint');
  if (hint) hint.textContent = 'Clique une gare réelle du Réseau Ferré National.';
  const container = app.map.leaflet?.getContainer();
  container?.classList.remove('placing-stop');
  app.map.leaflet?.dragging?.enable?.();
}

function onOsmMouseMove(event) {
  if (app.map.navigating) return;
  const p = { x: event.containerPoint.x, y: event.containerPoint.y };
  const stationHit = hitStationAt(p);
  const lineHit = stationHit ? null : hitLineAt(p);
  app.hoverStation = stationHit?.id || null;
  app.hoverLine = lineHit ? { playerId: lineHit.playerId, lineId: lineHit.lineId, own: !!lineHit.own } : null;
  const container = app.map.leaflet.getContainer();
  container.style.cursor = stationHit || lineHit ? 'pointer' : '';
}

async function onOsmClick(event) {
  const p = { x: event.containerPoint.x, y: event.containerPoint.y };
  const stationHit = hitStationAt(p) || nearestStationAt(p, 10) || nearestProjectedStationAt(p, 12);
  if (stationHit) {
    if (app.focusedLineId) clearFocusedLine();
    setSelectedStation(stationHit.id);
    const selected = station(stationHit.id);
    app.stationSearch.query = stationSearchLabel(selected);
    app.stationSearch.candidateId = stationHit.id;
    app.activeTab = 'stations';
    localStorage.setItem('sillons.activeTab', app.activeTab);
    renderAll();
    return;
  }
  const lineHit = hitLineAt(p);
  if (lineHit) {
    selectMapLine(lineHit);
    return;
  }
  if (app.focusedLineId) clearFocusedLine();
}


function setAuthMode(mode) {
  app.authMode = mode === 'register' ? 'register' : 'login';
  $('#authLoginTab')?.classList.toggle('active', app.authMode === 'login');
  $('#authRegisterTab')?.classList.toggle('active', app.authMode === 'register');
  $('#registerFields')?.classList.toggle('hidden', app.authMode !== 'register');
  const submit = $('#authSubmitBtn');
  if (submit) submit.textContent = app.authMode === 'register' ? 'Créer le compte' : 'Se connecter';
  const password = $('#authPassword');
  if (password) password.autocomplete = app.authMode === 'register' ? 'new-password' : 'current-password';
  const hint = $('#authModeHint');
  if (hint) hint.textContent = app.authMode === 'register'
    ? 'Crée un compte joueur : Une compagnie neuve sera liée à cet identifiant.'
    : 'Entre ton identifiant et ton mot de passe pour reprendre ta compagnie.';
}

function authHeaders() {
  return app.authToken ? { Authorization: `Bearer ${app.authToken}` } : {};
}

function clearAuthState() {
  app.authToken = '';
  app.playerId = '';
  localStorage.removeItem('sillons.authToken');
  localStorage.removeItem('sillons.playerId');
}

function applyAuthResponse(response) {
  if (!response?.ok || !response.auth?.token) return false;
  app.authToken = response.auth.token;
  app.playerId = response.auth.playerId || response.playerId || '';
  localStorage.setItem('sillons.authToken', app.authToken);
  localStorage.setItem('sillons.playerId', app.playerId);
  app.state = response.state || app.state;
  $('#setup')?.classList.add('hidden');
  renderAll(true);
  return true;
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const username = $('#authUsername')?.value || '';
  const password = $('#authPassword')?.value || '';
  const payload = { username, password };
  if (app.authMode === 'register') {
    payload.companyName = $('#companyName')?.value || '';
    payload.color = $('#companyColor')?.value || '#60a5fa';
    payload.logo = currentSetupLogoId();
  }
  const url = app.authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
  try {
    const response = await post(url, payload, { auth: false });
    if (!response.ok) return toast(response.error || 'Connexion impossible.', 'error');
    applyAuthResponse(response);
    toast(app.authMode === 'register' ? 'Compte créé et connecté.' : 'Connexion réussie.', 'ok');
  } catch (error) {
    toast(error.message || 'Connexion impossible.', 'error');
  }
}

async function logoutAccount() {
  if (app.authToken) await post('/api/auth/logout', {}, { auth: true }).catch(() => null);
  clearAuthState();
  app.state = null;
  $('#setup')?.classList.remove('hidden');
  setAuthMode('login');
  await refreshState(true);
  toast('Déconnecté.', 'ok');
}

function currentSetupLogoId() {
  const hidden = $('#companyLogo');
  const current = String(hidden?.value || '').trim();
  return COMPANY_LOGOS.some(logo => logo.id === current) ? current : COMPANY_LOGOS[0].id;
}

function selectSetupLogo(logoId) {
  const safe = COMPANY_LOGOS.some(logo => logo.id === logoId) ? logoId : COMPANY_LOGOS[0].id;
  const hidden = $('#companyLogo');
  if (hidden) hidden.value = safe;
  $$('.logo-choice').forEach(card => card.classList.toggle('selected', card.dataset.logoId === safe));
  const preview = $('#setupLogoPreview');
  const item = COMPANY_LOGOS.find(logo => logo.id === safe) || COMPANY_LOGOS[0];
  if (preview) {
    preview.src = item.src;
    preview.alt = item.label;
  }
  const label = $('#setupLogoLabel');
  if (label) label.textContent = item.label;
}

function renderSetupLogoPicker() {
  const picker = $('#logoPicker');
  if (!picker) return;
  picker.innerHTML = COMPANY_LOGOS.map(logo => `
    <button class="logo-choice" type="button" data-logo-id="${logo.id}" title="${escapeAttr(logo.label)}">
      <img src="${logo.src}" alt="${escapeAttr(logo.label)}">
      <span>${escapeHtml(logo.label)}</span>
    </button>
  `).join('');
  selectSetupLogo(currentSetupLogoId());
}


function bugReportsReadStorageKey() {
  const playerId = app.state?.auth?.playerId || app.playerId || 'anonymous';
  return `sillons.bugReportsReadAt.${playerId}`;
}

function localBugReportsReadAt() {
  return Number(localStorage.getItem(bugReportsReadStorageKey()) || 0) || 0;
}

function currentBugReportsReadAt() {
  return Math.max(Number(app.state?.auth?.bugReportsReadAt || 0) || 0, localBugReportsReadAt());
}

function latestBugReportCreatedAtClient(reports = app.state?.bugReports || []) {
  return (Array.isArray(reports) ? reports : []).reduce((max, bug) => Math.max(max, Number(bug?.createdAt || 0) || 0), 0);
}

function unreadBugReportCountClient(reports = app.state?.bugReports || []) {
  if (!app.state?.auth?.isAdmin) return 0;
  const readAt = currentBugReportsReadAt();
  return (Array.isArray(reports) ? reports : [])
    .filter(bug => bug?.status !== 'closed' && (Number(bug?.createdAt || 0) || 0) > readAt)
    .length;
}

function syncBugTabBadge() {
  const button = document.querySelector('#tabs [data-tab="bugs"]');
  if (!button) return;
  const count = unreadBugReportCountClient();
  const label = 'Bugs';
  button.classList.toggle('has-bug-unread', count > 0);
  button.title = count > 0
    ? `${formatInt(count)} nouveau${count > 1 ? 'x' : ''} signalement${count > 1 ? 's' : ''} de bug à lire.`
    : 'Signalements de bugs';
  button.innerHTML = count > 0
    ? `${label}<span class="tab-badge" aria-label="${formatInt(count)} nouveau${count > 1 ? 'x' : ''} bug${count > 1 ? 's' : ''}">${formatInt(count)}</span>`
    : label;
}

function markBugReportsRead({ syncServer = false, skipRender = false } = {}) {
  if (!app.state?.auth?.isAdmin) return;
  const latest = latestBugReportCreatedAtClient();
  if (!latest || latest <= currentBugReportsReadAt()) {
    syncBugTabBadge();
    return;
  }
  localStorage.setItem(bugReportsReadStorageKey(), String(latest));
  if (app.state?.auth) {
    app.state.auth.bugReportsReadAt = Math.max(Number(app.state.auth.bugReportsReadAt || 0) || 0, latest);
    app.state.auth.bugReportsUnreadCount = 0;
  }
  syncBugTabBadge();
  if (!skipRender) renderTabs();
  if (!syncServer || app.bugReportReadSyncInFlight) return;
  app.bugReportReadSyncInFlight = true;
  post('/api/action', { playerId: app.playerId, type: 'markBugReportsRead', payload: { readAt: latest } })
    .then(response => {
      if (response?.state) app.state = response.state;
      syncBugTabBadge();
    })
    .catch(() => null)
    .finally(() => { app.bugReportReadSyncInFlight = false; });
}


function maybeNotify(me) {
  const first = me.notifications?.[0];
  if (!first) return;
  const key = notificationKey(first);
  if (app.lastNotificationKey && app.lastNotificationKey !== key) toast(first.text, 'ok');
  app.lastNotificationKey = key;
}

function notificationKey(notification) {
  return String(notification?.id || `${notification?.createdAt ?? ''}:${notification?.text || ''}`);
}

function notificationCreatedAt(notification) {
  const value = Number(notification?.createdAt || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function notificationDateTimeLabel(notification) {
  const createdAt = notificationCreatedAt(notification);
  return createdAt ? formatDateTime(createdAt) : 'Horodatage indisponible';
}

function notificationReadStorageKey() {
  const playerId = app.state?.me?.id || app.playerId || 'anonymous';
  return `sillons.notificationsReadAt.${playerId}`;
}

function localNotificationReadAt() {
  return Number(localStorage.getItem(notificationReadStorageKey()) || 0) || 0;
}

function currentNotificationReadAt() {
  return Math.max(Number(app.state?.me?.notificationsReadAt || 0) || 0, localNotificationReadAt());
}

function latestNotificationCreatedAt(notifications = []) {
  return notifications.reduce((max, item) => Math.max(max, notificationCreatedAt(item)), 0);
}

function unreadNotificationCount(notifications = []) {
  const readAt = currentNotificationReadAt();
  return notifications.filter(item => notificationCreatedAt(item) > readAt).length;
}

function markNotificationsRead({ syncServer = false, skipRender = false } = {}) {
  const me = app.state?.me;
  const notifications = Array.isArray(me?.notifications) ? me.notifications : [];
  const latest = latestNotificationCreatedAt(notifications);
  if (!latest || latest <= currentNotificationReadAt()) return;
  localStorage.setItem(notificationReadStorageKey(), String(latest));
  if (me) me.notificationsReadAt = Math.max(Number(me.notificationsReadAt || 0) || 0, latest);
  if (!skipRender) renderNotificationDropdown(true);
  if (!syncServer || app.notificationReadSyncInFlight) return;
  app.notificationReadSyncInFlight = true;
  post('/api/action', { playerId: app.playerId, type: 'markNotificationsRead', payload: { readAt: latest } })
    .then(response => {
      if (response?.state) app.state = response.state;
      renderNotificationDropdown(true);
    })
    .catch(() => null)
    .finally(() => { app.notificationReadSyncInFlight = false; });
}

function notificationRenderSignature(notifications, open, unreadCount) {
  const items = notifications.map(item => `${notificationKey(item)}:${notificationCreatedAt(item)}:${item.text || ''}`).join('|');
  return `${app.state?.me?.id || ''}::${open ? 1 : 0}::${unreadCount}::${items}`;
}

function renderNotificationDropdown(force = false) {
  const mount = $('#notificationMount');
  if (!mount) return;
  const me = app.state?.me;
  if (!me) {
    app.notificationRenderSignature = '';
    mount.innerHTML = '';
    return;
  }
  const notifications = Array.isArray(me.notifications) ? me.notifications : [];
  const open = !!app.notificationsOpen;
  if (open) markNotificationsRead({ syncServer: true, skipRender: true });
  const total = notifications.length;
  const unreadCount = unreadNotificationCount(notifications);
  const hasItems = total > 0;
  const signature = notificationRenderSignature(notifications, open, unreadCount);
  if (!force && signature === app.notificationRenderSignature) return;
  app.notificationRenderSignature = signature;
  const items = notifications.map(notification => `
    <article class="notification-item ${notificationCreatedAt(notification) > currentNotificationReadAt() ? 'is-unread' : ''}">
      <div class="notification-item__meta">${escapeHtml(notificationDateTimeLabel(notification))}</div>
      <div class="notification-item__text">${escapeHtml(notification.text || 'Notification sans contenu.')}</div>
    </article>
  `).join('');
  mount.innerHTML = `
    <div class="notification-dropdown ${open ? 'is-open' : ''}">
      <button id="notificationToggleBtn" class="notification-toggle ${unreadCount ? 'has-unread' : ''}" type="button" aria-expanded="${open ? 'true' : 'false'}" title="Afficher ou masquer l’historique des notifications.">
        <span class="notification-toggle__icon" aria-hidden="true">◆</span>
        <span class="notification-toggle__label">Notifications</span>
        <span class="notification-toggle__count" aria-label="${formatInt(unreadCount)} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}">${formatInt(unreadCount)}</span>
      </button>
      ${open ? `
        <div class="notification-dropdown-panel" role="region" aria-label="Notifications">
          <div class="notification-dropdown-head">
            <strong>Notifications</strong>
            <span>${formatInt(total)} enregistrée${total > 1 ? 's' : ''}</span>
          </div>
          <div class="notification-dropdown-list">
            ${hasItems ? items : '<div class="notification-empty">Aucune notification enregistrée pour le moment.</div>'}
          </div>
          <p class="notification-dropdown-foot">Historique conservé dans la sauvegarde serveur. Les nouvelles notifications restent ici après disparition du message temporaire.</p>
        </div>
      ` : ''}
    </div>
  `;
}


function currentCompositionScrollKey() {
  if (app.activeTab !== 'fleet' || app.activeFleetSubtab !== 'composition') return null;
  return app.compositionEditorTrainId || app.selectedCompositionTrainId || 'default';
}

function captureCompositionScrollPosition() {
  const key = currentCompositionScrollKey();
  if (!key) return;
  const editor = document.querySelector('.composition-editor-card');
  const list = document.querySelector('.composition-group-list');
  const strip = editor?.querySelector('.composition-strip.large');
  app.compositionScrollState[key] = {
    top: editor?.scrollTop || 0,
    listTop: list?.scrollTop || 0,
    stripLeft: strip?.scrollLeft || 0
  };
  localStorage.setItem('sillons.compositionScrollState', JSON.stringify(app.compositionScrollState));
}

function restoreCompositionScrollPosition(key = currentCompositionScrollKey()) {
  if (!key) return;
  const saved = app.compositionScrollState?.[key];
  if (!saved) return;
  const editor = document.querySelector('.composition-editor-card');
  const list = document.querySelector('.composition-group-list');
  const restore = () => {
    if (editor) editor.scrollTop = Number(saved.top || 0);
    if (list) list.scrollTop = Number(saved.listTop || 0);
    const strip = editor?.querySelector('.composition-strip.large');
    if (strip) strip.scrollLeft = Number(saved.stripLeft || 0);
  };
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
}


function compositionScrollContainerFromTarget(target) {
  if (app.activeTab !== 'fleet' || app.activeFleetSubtab !== 'composition') return null;
  if (!target?.closest) return null;
  const list = target.closest('.composition-group-list');
  if (list) return list;
  const card = target.closest('.composition-refit-list-card');
  return card?.querySelector?.('.composition-group-list') || null;
}

function compositionListCanScroll(list) {
  return !!list && (list.scrollHeight - list.clientHeight) > 2;
}

function scrollCompositionListBy(list, deltaY) {
  if (!compositionListCanScroll(list)) return false;
  const max = Math.max(0, list.scrollHeight - list.clientHeight);
  const previous = list.scrollTop;
  const next = Math.max(0, Math.min(max, previous + deltaY));
  if (Math.abs(next - previous) < 0.5) return false;
  list.scrollTop = next;
  captureCompositionScrollPosition();
  return true;
}

function bindCompositionIndependentScroll(root) {
  if (!root || root.dataset.compositionScrollBound === '1') return;
  root.dataset.compositionScrollBound = '1';

  root.addEventListener('wheel', event => {
    handleCompositionWheel(event);
  }, { passive: false });

  root.addEventListener('touchstart', event => {
    handleCompositionTouchStart(event);
  }, { passive: true });

  root.addEventListener('touchmove', event => {
    handleCompositionTouchMove(event);
  }, { passive: false });

  root.addEventListener('touchend', () => { app.compositionTouchScroll = null; }, { passive: true });
  root.addEventListener('touchcancel', () => { app.compositionTouchScroll = null; }, { passive: true });

  if (!document.documentElement.dataset.compositionGlobalScrollBound) {
    document.documentElement.dataset.compositionGlobalScrollBound = '1';
    document.addEventListener('wheel', event => {
      if (!event.target?.closest?.('.composition-refit-list-card')) return;
      handleCompositionWheel(event);
    }, { passive: false, capture: true });
    document.addEventListener('touchstart', event => {
      if (!event.target?.closest?.('.composition-refit-list-card')) return;
      handleCompositionTouchStart(event);
    }, { passive: true, capture: true });
    document.addEventListener('touchmove', event => {
      if (!event.target?.closest?.('.composition-refit-list-card')) return;
      handleCompositionTouchMove(event);
    }, { passive: false, capture: true });
    document.addEventListener('touchend', () => { app.compositionTouchScroll = null; }, { passive: true, capture: true });
    document.addEventListener('touchcancel', () => { app.compositionTouchScroll = null; }, { passive: true, capture: true });
  }
}

function handleCompositionWheel(event) {
  if (event.defaultPrevented) return;
  if (event.target?.closest?.('select')) return;
  const list = compositionScrollContainerFromTarget(event.target);
  if (!list) return;
  adjustCompositionRefitScroll();
  if (!compositionListCanScroll(list)) return;
  if (scrollCompositionListBy(list, event.deltaY)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }
}

function handleCompositionTouchStart(event) {
  const touch = event.touches?.[0];
  if (!touch) return;
  const list = compositionScrollContainerFromTarget(event.target);
  adjustCompositionRefitScroll();
  if (!list || !compositionListCanScroll(list)) {
    app.compositionTouchScroll = null;
    return;
  }
  app.compositionTouchScroll = {
    id: touch.identifier,
    y: touch.clientY,
    list
  };
}

function handleCompositionTouchMove(event) {
  const state = app.compositionTouchScroll;
  if (!state?.list || !compositionListCanScroll(state.list)) return;
  const touches = Array.from(event.touches || []);
  const touch = touches.find(item => item.identifier === state.id) || touches[0];
  if (!touch) return;
  const delta = state.y - touch.clientY;
  state.y = touch.clientY;
  if (scrollCompositionListBy(state.list, delta)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }
}

function scheduleCompositionRefitScrollAdjustment() {
  // Cette routine doit aussi tourner quand on QUITTE Parc > Compositions.
  // Sinon la classe .composition-scroll-mode et les styles inline qui bloquent
  // le scroll restent accrochés à #tabContent et cassent les autres menus.
  adjustCompositionRefitScroll();
  requestAnimationFrame(() => {
    adjustCompositionRefitScroll();
    requestAnimationFrame(adjustCompositionRefitScroll);
  });
  window.setTimeout(adjustCompositionRefitScroll, 120);
}

function clearCompositionScrollInlineState(content) {
  const properties = [
    'display', 'grid-template-rows', 'gap', 'min-height', 'height', 'max-height',
    'overflow', 'overflow-x', 'overflow-y'
  ];
  if (content) {
    content.classList.remove('composition-scroll-mode');
    content.classList.remove('composition-narrow-workspace');
    for (const property of properties) content.style.removeProperty(property);
  }
  app.compositionTouchScroll = null;
}

function adjustCompositionRefitScroll() {
  const content = document.querySelector('#tabContent');
  const compositionActive = app.activeTab === 'fleet' && app.activeFleetSubtab === 'composition';
  if (content) {
    content.classList.toggle('composition-scroll-mode', compositionActive);
    content.dataset.fleetSubtab = app.activeTab === 'fleet' ? (app.activeFleetSubtab || '') : '';
  }
  if (!compositionActive) {
    clearCompositionScrollInlineState(content);
    return;
  }

  const workspace = document.querySelector('.fleet-workspace');
  const layout = document.querySelector('.composition-refit-layout');
  const card = document.querySelector('.composition-refit-list-card');
  const list = document.querySelector('.composition-group-list');
  const editor = document.querySelector('.composition-refit-editor');
  if (!card || !list) return;

  const setImportant = (node, property, value) => {
    if (!node) return;
    node.style.setProperty(property, value, 'important');
  };
  const clearImportant = (node, properties) => {
    if (!node) return;
    for (const property of properties) node.style.removeProperty(property);
  };

  const viewportHeight = Math.max(480, Math.floor(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 720));
  const layoutWidth = Math.floor(layout?.getBoundingClientRect?.().width || window.innerWidth || document.documentElement.clientWidth || 0);
  const narrowWorkspace = Boolean(editor && layoutWidth > 0 && layoutWidth < 760);
  const viewportStacked = Boolean(window.matchMedia?.('(max-width: 900px)')?.matches);
  const stacked = Boolean(viewportStacked || narrowWorkspace);
  const bottomSafe = window.matchMedia?.('(max-width: 700px)')?.matches ? 10 : 16;

  if (content) {
    content.classList.toggle('composition-narrow-workspace', narrowWorkspace);
    setImportant(content, 'min-height', '0');
    setImportant(content, 'overflow-x', 'hidden');
    // Garde un scroll de secours sur #tabContent : si un calcul de hauteur échoue,
    // la page reste exploitable et les autres menus ne sont plus impactés.
    setImportant(content, 'overflow-y', 'auto');
  }
  if (workspace) {
    setImportant(workspace, 'min-height', '0');
    setImportant(workspace, 'overflow', 'visible');
  }

  if (layout) {
    clearImportant(layout, ['height', 'max-height']);
    setImportant(layout, 'overflow', 'visible');
  }

  const cardTop = Math.max(0, card.getBoundingClientRect().top);
  const availableCardHeight = stacked
    ? Math.max(360, Math.min(Math.floor(viewportHeight * 0.72), Math.floor(viewportHeight - cardTop - bottomSafe)))
    : Math.max(360, Math.floor(viewportHeight - cardTop - bottomSafe));

  card.style.setProperty('--composition-list-card-height', `${availableCardHeight}px`);
  setImportant(card, 'display', 'flex');
  setImportant(card, 'flex-direction', 'column');
  setImportant(card, 'min-height', '0');
  setImportant(card, 'height', `${availableCardHeight}px`);
  setImportant(card, 'max-height', `${availableCardHeight}px`);
  setImportant(card, 'overflow', 'hidden');
  setImportant(card, 'overscroll-behavior', 'contain');

  const cardStyle = window.getComputedStyle(card);
  const paddingTop = parseFloat(cardStyle.paddingTop || '0') || 0;
  const paddingBottom = parseFloat(cardStyle.paddingBottom || '0') || 0;
  const gap = parseFloat(cardStyle.rowGap || cardStyle.gap || '0') || 0;
  const header = card.querySelector(':scope > .fleet-card-heading');
  const toolbar = card.querySelector(':scope > .composition-refit-toolbar');
  const fixedHeight = (header?.offsetHeight || 0) + (toolbar?.offsetHeight || 0) + paddingTop + paddingBottom + gap * 2;
  const availableListHeight = Math.max(180, Math.floor(availableCardHeight - fixedHeight));

  list.style.setProperty('--composition-group-list-height', `${availableListHeight}px`);
  setImportant(list, 'display', 'block');
  setImportant(list, 'align-content', 'normal');
  setImportant(list, 'flex', '1 1 auto');
  setImportant(list, 'min-height', '0');
  setImportant(list, 'height', `${availableListHeight}px`);
  setImportant(list, 'max-height', `${availableListHeight}px`);
  setImportant(list, 'overflow-y', 'auto');
  setImportant(list, 'overflow-x', 'hidden');
  setImportant(list, 'overscroll-behavior', 'contain');
  setImportant(list, '-webkit-overflow-scrolling', 'touch');
  setImportant(list, 'touch-action', 'pan-y');

  if (editor) {
    if (viewportStacked && !narrowWorkspace) {
      clearImportant(editor, ['height', 'max-height']);
      setImportant(editor, 'overflow-y', 'visible');
    } else {
      const editorTop = Math.max(0, editor.getBoundingClientRect().top);
      const editorHeight = Math.max(360, Math.floor(viewportHeight - editorTop - bottomSafe));
      setImportant(editor, 'min-height', '0');
      setImportant(editor, 'height', `${editorHeight}px`);
      setImportant(editor, 'max-height', `${editorHeight}px`);
      setImportant(editor, 'overflow-y', 'auto');
      setImportant(editor, 'overflow-x', 'hidden');
    }
  }
}
