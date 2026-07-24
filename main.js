import './input-guard.js'; // sistema anti-clics involuntarios: debe cargar antes que cualquier wiring de clicks
import './undo.js'; // Ctrl+Z global

import { accessToken, initAuth, requestSignIn, signOut, verifyBiometric, loadSavedToken, trySilentGoogleAuth } from './auth.js';
import { esc } from './utils.js';
import { activeBaseModulos } from './db-state.js';
import { initBasesSheet, bases, connectToDatabase, showDbPicker } from './bases.js';
import { loadStories } from './contenido.js';
import { switchSubTab, openTaskModal, enterTareasView, openDueBadgeDropdown, closeDueBadgeDropdown } from './tareas.js';
import { loadProcesos, loadRecetasData, loadEjecucionesData } from './procesos.js';
import { loadCompras, renderComprasList } from './compras.js';
import { loadFerias, renderFeriasDisponibles, renderFeriasConfirmadas } from './ferias.js';
import { loadStockTestigos, loadStockMovimientos, renderStockResumen, renderStockTrazabilidad, renderStockTestigoList } from './stock.js';
import { renderInformes } from './informes.js';
import { loadQRs, renderQRList } from './qr.js';
import { loadIdeas, renderIdeasList, openIdeaModal } from './ideas.js';

// ── State ─────────────────────────────────────────────────────────────────────
let currentView = 'home';
let deferredInstallPrompt = null;

const USER_KEY = 'ss_userInfo';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const screenBiometric   = document.getElementById('screenBiometric');
const btnBiometric      = document.getElementById('btnBiometric');
const btnFallbackGoogle = document.getElementById('btnFallbackGoogle');
const bioIcon           = document.getElementById('bioIcon');
const bioSubtitle       = document.getElementById('bioSubtitle');
const screenSignIn   = document.getElementById('screenSignIn');
const screenApp      = document.getElementById('screenApp');
const screenDbPicker = document.getElementById('screenDbPicker');
const btnSignIn      = document.getElementById('btnSignIn');
const btnSignOut     = document.getElementById('btnSignOut');
const btnSettings    = document.getElementById('btnSettings');
const userMenu       = document.getElementById('userMenu');

// ── Navigation ────────────────────────────────────────────────────────────────

export function navigateTo(view) {
  currentView = view;

  document.getElementById('viewHome').style.display      = view === 'home'      ? '' : 'none';
  document.getElementById('viewContenido').style.display = view === 'contenido' ? '' : 'none';
  document.getElementById('viewTareas').style.display    = view === 'tareas'    ? '' : 'none';
  document.getElementById('viewProcesos').style.display  = view === 'procesos'  ? '' : 'none';
  document.getElementById('viewCompras').style.display   = view === 'compras'   ? '' : 'none';
  document.getElementById('viewFerias').style.display    = view === 'ferias'    ? '' : 'none';
  document.getElementById('viewStock').style.display     = view === 'stock'     ? '' : 'none';
  document.getElementById('viewInformes').style.display  = view === 'informes'  ? '' : 'none';
  document.getElementById('viewQR').style.display        = view === 'qr'        ? '' : 'none';
  document.getElementById('viewIdeas').style.display     = view === 'ideas'     ? '' : 'none';

  // Load data for the selected view
  if (view === 'tareas') {
    enterTareasView();
  }
  if (view === 'procesos') {
    loadProcesos();
  }
  if (view === 'compras') {
    loadCompras().then(() => renderComprasList());
  }
  if (view === 'ferias') {
    Promise.all([loadFerias(), loadRecetasData(), loadEjecucionesData()])
      .then(() => { renderFeriasDisponibles(); renderFeriasConfirmadas(); });
  }
  if (view === 'stock') {
    Promise.all([loadRecetasData(), loadEjecucionesData(), loadFerias(), loadStockTestigos(), loadStockMovimientos()])
      .then(() => { renderStockResumen(); renderStockTrazabilidad(); renderStockTestigoList(); });
  }
  if (view === 'informes') {
    renderInformes();
  }
  if (view === 'qr') {
    loadQRs().then(() => renderQRList());
  }
  if (view === 'ideas') {
    loadIdeas().then(() => renderIdeasList());
  }

  window.scrollTo(0, 0);
}

// ── PWA install prompt (aparece una sola vez por dispositivo) ────────────────

const INSTALL_BANNER_SHOWN_KEY = 'ss_installBannerShown';

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (localStorage.getItem(INSTALL_BANNER_SHOWN_KEY)) return;
  document.getElementById('installBanner').style.display = '';
  localStorage.setItem(INSTALL_BANNER_SHOWN_KEY, '1');
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  document.getElementById('installBanner').style.display = 'none';
});

async function triggerInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    deferredInstallPrompt = null;
    document.getElementById('installBanner').style.display = 'none';
  }
}

document.getElementById('btnInstall').addEventListener('click', triggerInstall);
document.getElementById('btnDismissInstall').addEventListener('click', () => {
  document.getElementById('installBanner').style.display = 'none';
});

// ── Desactivar zoom una vez la app está instalada (modo standalone) ──────────

function isStandalonePWA() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

if (isStandalonePWA()) {
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  }
  document.documentElement.style.touchAction = 'pan-x pan-y';
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('touchmove', e => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
}

// ── Pantallas de sesión ───────────────────────────────────────────────────────

function showBiometricScreen() {
  screenBiometric.style.display = '';
  screenSignIn.style.display    = 'none';
  screenApp.style.display       = 'none';
  const info = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
  if (info.name) bioSubtitle.textContent = `Hola, ${info.name.split(' ')[0]}`;
}

function showSignInScreen() {
  screenBiometric.style.display = 'none';
  screenSignIn.style.display    = '';
  screenApp.style.display       = 'none';
  userMenu.style.display        = 'none';
  document.getElementById('userMenuDropdown').style.display = 'none';
}

// ── Google Auth ───────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  const poll = setInterval(() => {
    if (window.google?.accounts?.oauth2) { clearInterval(poll); initAuth(onAuthSuccess, showSignInScreen); }
  }, 100);
});

btnSignIn.addEventListener('click', () => requestSignIn());

btnBiometric.addEventListener('click', async () => {
  btnBiometric.disabled = true;
  btnBiometric.textContent = 'Verificando…';
  bioIcon.textContent = '⏳';

  const ok = await verifyBiometric();
  if (!ok) {
    bioIcon.textContent     = '❌';
    bioSubtitle.textContent = 'No se pudo verificar. Intenta de nuevo.';
    btnBiometric.disabled   = false;
    btnBiometric.textContent = 'Intentar de nuevo';
    return;
  }

  bioIcon.textContent     = '✅';
  bioSubtitle.textContent = 'Verificado. Conectando…';

  if (loadSavedToken()) { await onAuthSuccess(); return; }
  const silentOk = await trySilentGoogleAuth();
  if (silentOk) { await onAuthSuccess(); return; }

  bioIcon.textContent = '🔐';
  bioSubtitle.textContent = 'Sesión expirada. Inicia sesión con Google una vez.';
  btnBiometric.style.display     = 'none';
  btnFallbackGoogle.style.display = '';
  btnBiometric.disabled = false;
});

btnFallbackGoogle.addEventListener('click', () => { showSignInScreen(); });

btnSignOut.addEventListener('click', () => {
  signOut(() => showSignInScreen());
});

async function onAuthSuccess() {
  screenBiometric.style.display = 'none';
  screenSignIn.style.display    = 'none';
  screenApp.style.display       = ''; // se muestra de inmediato con sus estados "Cargando…"; showDbPicker() la oculta si hace falta elegir base
  screenDbPicker.style.display  = 'none';
  userMenu.style.display        = '';

  try {
    const u = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then(r => r.json());
    setUserMenuInfo(u.name, u.email);
    localStorage.setItem(USER_KEY, JSON.stringify({ name: u.name, email: u.email }));
    const firstName = (u.name || '').split(' ')[0];
    if (firstName) document.getElementById('homeGreeting').textContent = `Hola, ${firstName}`;
  } catch {
    const saved = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    setUserMenuInfo(saved.name, saved.email);
    const firstName = (saved.name || '').split(' ')[0];
    if (firstName) document.getElementById('homeGreeting').textContent = `Hola, ${firstName}`;
  }

  // El registro de bases de datos siempre vive en CONFIG.SHEET_ID; se
  // autosiembra en la primera ejecución con la base "Tatequieto" existente.
  await initBasesSheet();

  if (bases.length === 1) {
    await connectToDatabase(bases[0]);
  } else {
    showDbPicker();
  }
}

// ── User menu ─────────────────────────────────────────────────────────────────

function setUserMenuInfo(name, email) {
  const label = (name || email || '?').trim();
  document.getElementById('userAvatar').textContent  = label ? label[0].toUpperCase() : '?';
  document.getElementById('userMenuName').textContent  = name  || '';
  document.getElementById('userMenuEmail').textContent = email || '';
}

// Muestra la versión desplegada (toma el nombre de caché de sw.js, la misma
// referencia que ya usamos para verificar despliegues de GitHub Pages).
fetch('sw.js').then(r => r.text()).then(text => {
  const match = text.match(/const CACHE = '([^']+)'/);
  if (match) document.getElementById('userMenuVersion').textContent = 'Versión ' + match[1];
}).catch(() => {});

document.getElementById('userMenuTrigger').addEventListener('click', e => {
  e.stopPropagation();
  const dropdown = document.getElementById('userMenuDropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? '' : 'none';
});
document.addEventListener('click', e => {
  if (!userMenu.contains(e.target)) document.getElementById('userMenuDropdown').style.display = 'none';
});
btnSettings.addEventListener('click', () => {
  document.getElementById('userMenuDropdown').style.display = 'none';
});
btnSignOut.addEventListener('click', () => {
  document.getElementById('userMenuDropdown').style.display = 'none';
});

document.querySelectorAll('.due-badge').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const cat = btn.dataset.dueCat;
    const isOpenForThis = document.getElementById('dueBadgeDropdown').style.display !== 'none' && btn.classList.contains('active');
    if (isOpenForThis) closeDueBadgeDropdown();
    else openDueBadgeDropdown(cat);
  });
});
document.addEventListener('click', e => {
  if (!document.getElementById('dueBadges').contains(e.target)) closeDueBadgeDropdown();
});

// ── Sesión: refresco silencioso periódico ────────────────────────────────────

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && accessToken) {
    await trySilentGoogleAuth();
    loadStories();
  }
});

setInterval(async () => {
  if (accessToken && screenApp.style.display !== 'none') await trySilentGoogleAuth();
}, 50 * 60 * 1000);

setInterval(() => { if (accessToken) loadStories(); }, 60000);

// ── Event listeners: navegación genérica ─────────────────────────────────────

document.getElementById('headerLogoBtn').addEventListener('click', () => navigateTo('home'));

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => navigateTo(el.dataset.nav));
});

// ── Command palette (Ctrl+K) ─────────────────────────────────────────────────

const COMMAND_PALETTE_ITEMS = [
  { label: 'Inicio',                 action: () => navigateTo('home') },
  { label: 'Contenido',              module: 'contenido', action: () => navigateTo('contenido') },
  { label: 'Tareas · Kanban',        module: 'tareas',    action: () => { navigateTo('tareas'); switchSubTab('kanban'); } },
  { label: 'Tareas · Lista',         module: 'tareas',    action: () => { navigateTo('tareas'); switchSubTab('lista'); } },
  { label: 'Tareas · Gantt',         module: 'tareas',    action: () => { navigateTo('tareas'); switchSubTab('gantt'); } },
  { label: 'Procesos · Recetas',     module: 'procesos',  action: () => { navigateTo('procesos'); document.querySelector('[data-procesostab="recetas"]')?.click(); } },
  { label: 'Procesos · Ejecuciones', module: 'procesos',  action: () => { navigateTo('procesos'); document.querySelector('[data-procesostab="ejecuciones"]')?.click(); } },
  { label: 'Informes',               module: 'informes',  action: () => navigateTo('informes') },
  { label: 'QR',                     module: 'qr',        action: () => navigateTo('qr') },
  { label: 'Ideas',                  module: 'ideas',     action: () => navigateTo('ideas') },
  { label: '+ Nueva tarea',          module: 'tareas',    action: () => { navigateTo('tareas'); openTaskModal(null, null); } },
  { label: '+ Nueva receta',         module: 'procesos',  action: () => { navigateTo('procesos'); document.getElementById('btnNewReceta')?.click(); } },
  { label: '+ Generar QR',           module: 'qr',        action: () => { navigateTo('qr'); document.getElementById('qrNombre')?.focus(); } },
  { label: '+ Nueva idea',           module: 'ideas',     action: () => { navigateTo('ideas'); openIdeaModal(null); } },
];

let commandPaletteIndex = 0;
let commandPaletteFiltered = COMMAND_PALETTE_ITEMS;

function normalizeForSearch(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function renderCommandPaletteList() {
  const list = document.getElementById('commandPaletteList');
  if (!commandPaletteFiltered.length) {
    list.innerHTML = '<div class="command-palette-empty">Sin resultados.</div>';
    return;
  }
  list.innerHTML = commandPaletteFiltered.map((item, i) =>
    `<div class="command-palette-item${i === commandPaletteIndex ? ' active' : ''}" data-idx="${i}">${esc(item.label)}</div>`
  ).join('');
  list.querySelectorAll('.command-palette-item').forEach(el => {
    el.addEventListener('click', () => runCommandPaletteItem(+el.dataset.idx));
    el.addEventListener('mouseenter', () => { commandPaletteIndex = +el.dataset.idx; renderCommandPaletteList(); });
  });
}

function filterCommandPalette(query) {
  const q = normalizeForSearch(query);
  const enabled = COMMAND_PALETTE_ITEMS.filter(item => !item.module || activeBaseModulos.includes(item.module));
  commandPaletteFiltered = q
    ? enabled.filter(item => normalizeForSearch(item.label).includes(q))
    : enabled;
  commandPaletteIndex = 0;
  renderCommandPaletteList();
}

function runCommandPaletteItem(idx) {
  const item = commandPaletteFiltered[idx];
  if (!item) return;
  closeCommandPalette();
  item.action();
}

function openCommandPalette() {
  const overlay = document.getElementById('commandPaletteOverlay');
  const input   = document.getElementById('commandPaletteInput');
  input.value = '';
  filterCommandPalette('');
  overlay.classList.add('open');
  setTimeout(() => input.focus(), 50);
}

function closeCommandPalette() {
  document.getElementById('commandPaletteOverlay').classList.remove('open');
}

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openCommandPalette();
  } else if (e.key === 'Escape' && document.getElementById('commandPaletteOverlay').classList.contains('open')) {
    closeCommandPalette();
  }
});

document.getElementById('btnCommandPalette').addEventListener('click', openCommandPalette);
document.getElementById('commandPaletteOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('commandPaletteOverlay')) closeCommandPalette();
});
document.getElementById('commandPaletteInput').addEventListener('input', function () {
  filterCommandPalette(this.value);
});
document.getElementById('commandPaletteInput').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    commandPaletteIndex = Math.min(commandPaletteIndex + 1, commandPaletteFiltered.length - 1);
    renderCommandPaletteList();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    commandPaletteIndex = Math.max(commandPaletteIndex - 1, 0);
    renderCommandPaletteList();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    runCommandPaletteItem(commandPaletteIndex);
  }
});

// ── Service Worker ────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW:', err));
}
