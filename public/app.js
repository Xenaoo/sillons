'use strict';

// Point d'entrée client minimal.
// Les fichiers métier sont récupérés puis exécutés comme un seul script afin de
// préserver la portée et le hoisting historiques de l'ancien public/app.js.
const SILLONS_CLIENT_VERSION = 'v69.16.1';
const SILLONS_CLIENT_PARTS = [
  '00-core-state.js',
  '01-startup-events-auth.js',
  '02-tutorial-layout-overview.js',
  '03-research-lines-foundations.js',
  '04-lines.js',
  '05-fleet-compositions.js',
  '06-stations-staff-research.js',
  '07-resources-budget-market.js',
  '08-actions-modals.js',
  '09-map-rendering.js',
  '10-routing-line-utils.js'
];

function showSillonsClientBootError(error) {
  console.error(error);
  const host = document.getElementById('toastHost') || document.body;
  const div = document.createElement('div');
  div.className = 'toast bad';
  div.textContent = 'Erreur de chargement du client Sillons.';
  host.appendChild(div);
}

window.__sillonsClientBootError = showSillonsClientBootError;

async function fetchSillonsClientPart(src) {
  const response = await fetch(`/js/${src}?v=${encodeURIComponent(SILLONS_CLIENT_VERSION)}`, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Chargement impossible : ${src}`);
  return `\n// ===== public/js/${src} =====\n${await response.text()}`;
}

(async function loadSillonsClient() {
  try {
    const parts = await Promise.all(SILLONS_CLIENT_PARTS.map(fetchSillonsClientPart));
    const script = document.createElement('script');
    script.textContent = [
      "'use strict';",
      ...parts,
      '',
      "if (typeof init === 'function') Promise.resolve(init()).catch(window.__sillonsClientBootError);",
      "else window.__sillonsClientBootError(new Error('Initialisation client absente.'));"
    ].join('\n');
    document.head.appendChild(script);
  } catch (error) {
    showSillonsClientBootError(error);
  }
})();
