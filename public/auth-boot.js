'use strict';

(function bootPublicAuth() {
  const APP_VERSION = 'v0.71.0-perf4';
  const LEAFLET_VERSION = '1.9.4';
  const AUTH_TOKEN_KEY = 'sillons.authToken';
  const PLAYER_ID_KEY = 'sillons.playerId';
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
    if (assetLoaded('link[href]', 'href', href)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Chargement CSS impossible: ${href}`));
      document.head.appendChild(link);
    });
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

  async function loadApp() {
    if (window.__sillonsAppLoading) return;
    window.__sillonsAppLoading = true;
    document.body.classList.remove('auth-boot');
    await loadStyle(`/vendor/leaflet/leaflet.css?v=${LEAFLET_VERSION}`);
    await loadStyle(`/styles.css?v=${APP_VERSION}`);
    await loadScript(`/vendor/leaflet/leaflet.js?v=${LEAFLET_VERSION}`);
    await loadScript(`/app.js?v=${APP_VERSION}`);
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
      localStorage.setItem(AUTH_TOKEN_KEY, data.auth.token);
      localStorage.setItem(PLAYER_ID_KEY, data.auth.playerId || data.playerId || '');
      $('#setup')?.classList.add('hidden');
      await loadApp();
    } catch (error) {
      toast(error.message || 'Connexion impossible.', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  function initPublicAuth() {
    if (localStorage.getItem(AUTH_TOKEN_KEY)) {
      loadApp().catch(error => toast(error.message || 'Chargement impossible.', 'error'));
      return;
    }
    document.body.classList.add('auth-boot');
    $('#setup')?.classList.remove('hidden');
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
