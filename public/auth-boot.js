'use strict';

(function bootPublicAuth() {
  const APP_VERSION = 'v0.71.13';
  const LEAFLET_VERSION = '1.9.4';
  const AUTH_TOKEN_KEY = 'sillons.authToken';
  const PLAYER_ID_KEY = 'sillons.playerId';
  const STATE_SESSION_SNAPSHOT_KEY = 'sillons.stateSnapshot.v1';
  const STATE_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const APP_ASSETS = {
    leafletCss: `/vendor/leaflet/leaflet.css?v=${LEAFLET_VERSION}`,
    styles: `/styles.css?v=${APP_VERSION}`,
    leafletJs: `/vendor/leaflet/leaflet.js?v=${LEAFLET_VERSION}`,
    appJs: `/app.js?v=${APP_VERSION}`
  };
  const LOGOS = [
    ['steam_front', 'Locomotive vapeur'],
    ['winged_wheel', 'Roue ailee'],
    ['semaphore', 'Semaphore'],
    ['royal_track', 'Blason voie'],
    ['tunnel_arch', 'Tunnel'],
    ['electric_rail', 'Eclair rail'],
    ['mountain_rail', 'Montagne'],
    ['laurel_wheel', 'Laurier'],
    ['pantograph', 'Pantographe'],
    ['conductor_cap', 'Casquette'],
    ['grand_station', 'Grande gare'],
    ['freight_wagon', 'Wagon fret'],
    ['star_track', 'Etoile rail'],
    ['compass_rail', 'Boussole'],
    ['monogram_rail', 'Monogramme'],
    ['bridge_truss', 'Pont'],
    ['boiler_gauge', 'Chaudiere'],
    ['gear_wheel', 'Engrenage'],
    ['lantern_wings', 'Lanterne'],
    ['switch_roundel', 'Aiguillage']
  ];

  const $ = selector => document.querySelector(selector);
  let appWarmPromise = null;
  let warmIntentBound = false;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function toast(message, kind = 'info') {
    const host = $('#toastHost') || document.body;
    const div = document.createElement('div');
    div.className = `toast ${kind === 'error' ? 'error' : kind}`;
    div.textContent = message;
    host.appendChild(div);
    window.setTimeout(() => div.remove(), 4200);
  }

  function assetLoaded(selector, attr, value) {
    return Array.from(document.querySelectorAll(selector)).some(el => String(el[attr] || '').includes(value));
  }

  function loadStyle(href) {
    if (assetLoaded('link[rel="stylesheet"][href]', 'href', href)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Chargement CSS impossible: ${href}`));
      document.head.appendChild(link);
    });
  }

  function preloadAsset(href, as) {
    if (assetLoaded(`link[rel="preload"][as="${as}"][href]`, 'href', href)) return Promise.resolve();
    if (as === 'script' && assetLoaded('script[src]', 'src', href)) return Promise.resolve();
    if (as === 'style' && assetLoaded('link[rel="stylesheet"][href]', 'href', href)) return Promise.resolve();
    return new Promise(resolve => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = as;
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => resolve();
      document.head.appendChild(link);
    });
  }

  function warmAppAssets() {
    if (appWarmPromise) return appWarmPromise;
    appWarmPromise = Promise.all([
      preloadAsset(APP_ASSETS.leafletCss, 'style'),
      preloadAsset(APP_ASSETS.styles, 'style'),
      preloadAsset(APP_ASSETS.leafletJs, 'script'),
      preloadAsset(APP_ASSETS.appJs, 'script')
    ]).catch(() => null);
    return appWarmPromise;
  }

  function bindWarmupIntent() {
    if (warmIntentBound) return;
    warmIntentBound = true;
    const options = { once: true, passive: true, capture: true };
    const warm = () => { void warmAppAssets(); };
    document.addEventListener('pointerdown', warm, options);
    document.addEventListener('keydown', warm, options);
    document.addEventListener('focusin', warm, options);
    document.addEventListener('touchstart', warm, options);
  }

  function loadScript(src) {
    if (assetLoaded('script[src]', 'src', src)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Chargement JS impossible: ${src}`));
      document.body.appendChild(script);
    });
  }

  function statePlayerId(state) {
    return String(state?.auth?.playerId || state?.me?.id || '').trim();
  }

  function seedBootAuth(auth, fallbackPlayerId = '') {
    const token = String(auth?.token || localStorage.getItem(AUTH_TOKEN_KEY) || '').trim();
    const playerId = String(auth?.playerId || fallbackPlayerId || localStorage.getItem(PLAYER_ID_KEY) || '').trim();
    if (!token) return null;
    window.__sillonsBootAuth = { token, playerId };
    return window.__sillonsBootAuth;
  }

  function seedBootState(state) {
    if (!state?.ok || !state?.me || !state?.world) return null;
    const playerId = statePlayerId(state);
    if (!playerId) return null;
    window.__sillonsBootState = state;
    try {
      sessionStorage.setItem(STATE_SESSION_SNAPSHOT_KEY, JSON.stringify({ playerId, savedAt: Date.now(), state }));
    } catch (error) {
      // Le client complet conservera le secours IndexedDB si sessionStorage est plein.
    }
    return state;
  }

  function readBootSnapshot() {
    try {
      const playerId = String(localStorage.getItem(PLAYER_ID_KEY) || '').trim();
      if (!playerId) return null;
      const raw = sessionStorage.getItem(STATE_SESSION_SNAPSHOT_KEY);
      const record = raw ? JSON.parse(raw) : null;
      if (!record?.state || String(record.playerId || statePlayerId(record.state)) !== playerId) return null;
      if (Date.now() - Number(record.savedAt || 0) > STATE_SNAPSHOT_MAX_AGE_MS) return null;
      const state = record.state?.ok && record.state?.me && record.state?.world ? record.state : null;
      if (state) window.__sillonsBootState = state;
      return state;
    } catch (error) {
      return null;
    }
  }

  function formatInt(value) {
    return new Intl.NumberFormat('fr-FR').format(Math.round(Number(value || 0)));
  }

  function money(value) {
    return `${formatInt(value)} €`;
  }

  function bootMetric(label, value) {
    return `<div class="metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
  }

  function renderConnectedShell(state) {
    const me = state?.me;
    if (!me) return false;
    const activeLines = Array.isArray(me.lines) ? me.lines.filter(line => line?.active).length : 0;
    const activeTrains = Array.isArray(me.trains) ? me.trains.length : 0;
    $('#setup')?.classList.add('hidden');
    document.body.classList.remove('auth-boot');
    document.body.classList.add('app-shell-boot');

    const subtitle = $('#companySubtitle');
    if (subtitle) subtitle.textContent = me.name || 'Compagnie connectee';
    const badge = $('#companyLogoBadge');
    const fallback = $('#companyLogoFallback');
    if (badge && me.logo) {
      badge.src = `/assets/company_logos/${encodeURIComponent(me.logo)}.png`;
      badge.classList.remove('hidden');
      if (fallback) fallback.classList.add('hidden');
    }
    const topStats = $('#topStats');
    if (topStats) {
      topStats.innerHTML = [
        bootMetric('Tresorerie', money(me.cash)),
        bootMetric('Score', formatInt(me.score)),
        bootMetric('Lignes', formatInt(activeLines)),
        bootMetric('Trains', formatInt(activeTrains))
      ].join('');
    }
    document.querySelectorAll('#tabs button[data-tab]').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === 'overview');
    });
    const tabContent = $('#tabContent');
    if (tabContent) {
      tabContent.dataset.tab = 'overview';
      tabContent.innerHTML = `
        <div class="card boot-dashboard">
          <h2>${escapeHtml(me.name || 'Poste de commande')}</h2>
          <div class="card-grid">
            ${bootMetric('Tresorerie', money(me.cash))}
            ${bootMetric('Score', formatInt(me.score))}
            ${bootMetric('Lignes actives', formatInt(activeLines))}
            ${bootMetric('Parc roulant', formatInt(activeTrains))}
          </div>
        </div>
      `;
    }
    drawBootMapShell(state);
    return true;
  }

  function renderEmptyShell() {
    $('#setup')?.classList.add('hidden');
    document.body.classList.remove('auth-boot');
    document.body.classList.add('app-shell-boot');
    const subtitle = $('#companySubtitle');
    if (subtitle) subtitle.textContent = 'Session ouverte';
    const tabContent = $('#tabContent');
    if (tabContent) {
      tabContent.innerHTML = '<div class="card boot-dashboard"><h2>Sillons</h2><div class="card-grid"><div class="metric"><span>Poste</span><b>Commande</b></div></div></div>';
    }
    drawBootMapShell(null);
  }

  function drawBootMapShell(state) {
    const canvas = $('#map');
    const holder = $('#osmMap');
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return;
    const rect = holder?.getBoundingClientRect?.() || { width: 900, height: 620 };
    const width = Math.max(400, Math.floor(rect.width || 900));
    const height = Math.max(300, Math.floor(rect.height || 620));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#091b2e');
    gradient.addColorStop(0.58, '#102a3f');
    gradient.addColorStop(1, '#07111d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(217,168,82,.20)';
    ctx.lineWidth = 1;
    for (let x = 24; x < width; x += 72) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 24; y < height; y += 72) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    const lineCount = Array.isArray(state?.me?.lines) ? state.me.lines.filter(line => line?.active).length : 0;
    ctx.fillStyle = 'rgba(244,234,210,.88)';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText('Carte reseau', 24, 34);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(244,234,210,.62)';
    ctx.fillText(`${formatInt(lineCount)} ligne${lineCount > 1 ? 's' : ''} active${lineCount > 1 ? 's' : ''}`, 24, 56);
  }

  async function loadApp(options = {}) {
    if (window.__sillonsAppLoading) return;
    window.__sillonsAppLoading = true;
    let bootState = options.state ? seedBootState(options.state) : null;
    if (bootState) renderConnectedShell(bootState);
    else renderEmptyShell();
    await afterBootShellPaint();
    if (!bootState) {
      bootState = readBootSnapshot();
      if (bootState) {
        renderConnectedShell(bootState);
        await afterBootShellPaint();
      }
    }
    void warmAppAssets();
    await Promise.all([
      loadStyle(APP_ASSETS.leafletCss),
      loadStyle(APP_ASSETS.styles)
    ]);
    await loadScript(APP_ASSETS.leafletJs);
    await loadScript(APP_ASSETS.appJs);
  }

  function afterBootShellPaint() {
    return new Promise(resolve => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      window.setTimeout(done, 80);
      requestAnimationFrame(() => window.setTimeout(done, 0));
    });
  }

  function setAuthMode(mode) {
    const next = mode === 'register' ? 'register' : 'login';
    $('#authLoginTab')?.classList.toggle('active', next === 'login');
    $('#authRegisterTab')?.classList.toggle('active', next === 'register');
    $('#registerFields')?.classList.toggle('hidden', next !== 'register');
    const submit = $('#authSubmitBtn');
    if (submit) submit.textContent = next === 'register' ? 'Creer le compte' : 'Se connecter';
    const password = $('#authPassword');
    if (password) password.autocomplete = next === 'register' ? 'new-password' : 'current-password';
    const hint = $('#authModeHint');
    if (hint) {
      hint.textContent = next === 'register'
        ? 'Cree un compte joueur : une compagnie neuve sera liee a cet identifiant.'
        : 'Entre ton identifiant et ton mot de passe pour reprendre ta compagnie.';
    }
    document.documentElement.dataset.authMode = next;
  }

  function currentLogoId() {
    const value = String($('#companyLogo')?.value || '').trim();
    return LOGOS.some(([id]) => id === value) ? value : LOGOS[0][0];
  }

  function selectLogo(id) {
    const safe = LOGOS.some(([logoId]) => logoId === id) ? id : LOGOS[0][0];
    const hidden = $('#companyLogo');
    if (hidden) hidden.value = safe;
    const selected = LOGOS.find(([logoId]) => logoId === safe) || LOGOS[0];
    const preview = $('#setupLogoPreview');
    if (preview) {
      preview.src = `/assets/company_logos/${selected[0]}.png`;
      preview.alt = selected[1];
    }
    const label = $('#setupLogoLabel');
    if (label) label.textContent = selected[1];
    document.querySelectorAll('.logo-choice').forEach(button => {
      button.classList.toggle('selected', button.dataset.logoId === safe);
    });
  }

  function renderLogoPicker() {
    const picker = $('#logoPicker');
    if (!picker || picker.dataset.ready === '1') return;
    picker.dataset.ready = '1';
    picker.innerHTML = LOGOS.map(([id, label]) => `
      <button class="logo-choice" type="button" data-logo-id="${escapeHtml(id)}" title="${escapeHtml(label)}">
        <img src="/assets/company_logos/${escapeHtml(id)}.png" alt="${escapeHtml(label)}" loading="lazy" decoding="async">
        <span>${escapeHtml(label)}</span>
      </button>
    `).join('');
    selectLogo(currentLogoId());
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Connexion impossible.');
    return data;
  }

  async function onSubmit(event) {
    event.preventDefault();
    const warming = warmAppAssets();
    const mode = document.documentElement.dataset.authMode === 'register' ? 'register' : 'login';
    const payload = {
      username: $('#authUsername')?.value || '',
      password: $('#authPassword')?.value || ''
    };
    if (mode === 'register') {
      payload.companyName = $('#companyName')?.value || '';
      payload.color = $('#companyColor')?.value || '#60a5fa';
      payload.logo = currentLogoId();
    }
    const submit = $('#authSubmitBtn');
    if (submit) submit.disabled = true;
    try {
      const data = await postJson(mode === 'register' ? '/api/auth/register' : '/api/auth/login', payload);
      seedBootAuth(data.auth, data.playerId);
      localStorage.setItem(AUTH_TOKEN_KEY, data.auth.token);
      localStorage.setItem(PLAYER_ID_KEY, data.auth.playerId || data.playerId || '');
      $('#setup')?.classList.add('hidden');
      seedBootState(data.state);
      void warming;
      await loadApp({ state: data.state });
    } catch (error) {
      toast(error.message || 'Connexion impossible.', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  function initPublicAuth() {
    if (localStorage.getItem(AUTH_TOKEN_KEY)) {
      seedBootAuth(null);
      loadApp().catch(error => toast(error.message || 'Chargement impossible.', 'error'));
      return;
    }
    document.body.classList.add('auth-boot');
    $('#setup')?.classList.remove('hidden');
    bindWarmupIntent();
    setAuthMode('login');
    $('#authLoginTab')?.addEventListener('click', () => setAuthMode('login'));
    $('#authRegisterTab')?.addEventListener('click', () => {
      setAuthMode('register');
      renderLogoPicker();
    });
    $('#logoPicker')?.addEventListener('click', event => {
      const button = event.target.closest?.('[data-logo-id]');
      if (button) selectLogo(button.dataset.logoId);
    });
    $('#setupForm')?.addEventListener('submit', onSubmit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPublicAuth, { once: true });
  } else {
    initPublicAuth();
  }
})();
