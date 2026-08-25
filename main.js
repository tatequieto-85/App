import './input-guard.js'; // sistema anti-clics involuntarios: debe cargar antes que cualquier wiring de clicks
import './undo.js'; // Ctrl+Z global

import { accessToken, initAuth, requestSignIn, signOut, verifyBiometric, loadSavedToken, trySilentGoogleAuth } from './auth.js';
import { esc, safeLoad } from './utils.js';
import { activeBaseModulos } from './db-state.js';
import { initBasesSheet, bases, connectToDatabase, showDbPicker } from './bases.js';
import { loadStories } from './contenido.js';
import { switchSubTab, openTaskModal, enterTareasView, openDueBadgeDropdown, closeDueBadgeDropdown } from './tareas.js';
import { loadProcesos, loadRecetasData, loadEjecucionesData } from './procesos.js';
import { loadCompras, renderComprasList } from './compras.js';
import { loadFerias, renderFerias, openTodaysFeriaCounterIfAny } from './ferias.js';
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

const VALID_VIEWS = ['home', 'contenido', 'tareas', 'procesos', 'compras', 'ferias', 'stock', 'informes', 'qr', 'ideas'];
let handlingPopState = false; // evita pushear un history entry nuevo al responder a atrás/adelante

export function navigateTo(view) {
  currentView = view;

  if (!handlingPopState) {
    const hash = view === 'home' ? '' : '#' + view;
    if (hash !== location.hash) history.pushState({ view }, '', hash || location.pathname + location.search);
  }

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
    safeLoad(loadCompras, 'comprasList').then(ok => { if (ok) renderComprasList(); });
  }
  if (view === 'ferias') {
    safeLoad(() => Promise.all([loadFerias(), loadRecetasData(), loadEjecucionesData()]), 'feriasList')
      .then(ok => { if (ok) { renderFerias(); openTodaysFeriaCounterIfAny(); } });
  }
  if (view === 'stock') {
    safeLoad(() => Promise.all([loadRecetasData(), loadEjecucionesData(), loadFerias(), loadStockTestigos(), loadStockMovimientos()]), 'stockResumenList')
      .then(ok => { if (ok) { renderStockResumen(); renderStockTrazabilidad(); renderStockTestigoList(); } });
  }
  if (view === 'informes') {
    renderInformes();
  }
  if (view === 'qr') {
    safeLoad(loadQRs, 'qrList').then(ok => { if (ok) renderQRList(); });
  }
  if (view === 'ideas') {
    safeLoad(loadIdeas, 'ideasList').then(ok => { if (ok) renderIdeasList(); });
  }

  window.scrollTo(0, 0);
}

// Le da función real al botón atrás/adelante del navegador (y al botón físico
// "atrás" de Android, que dispara lo mismo en una PWA instalada): sin esto,
// navegar entre módulos nunca tocaba el historial y ese botón no hacía nada
// útil dentro de la app.
window.addEventListener('popstate', e => {
  const view = (e.state && e.state.view) || (location.hash ? location.hash.slice(1) : 'home');
  if (!VALID_VIEWS.includes(view) || (view !== 'home' && !activeBaseModulos.includes(view))) return;
  handlingPopState = true;
  navigateTo(view);
  handlingPopState = false;
});

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
    restoreViewFromHash();
  } else {
    showDbPicker();
  }
}

// Si la URL ya tenía un módulo en el hash (recarga de página, o el ícono de
// iOS/Android reabriendo en la última pestaña), entra ahí directo en vez de
// forzar Home siempre. Sin esto, recargar a mitad de Tareas/Ferias perdía
// dónde estabas.
function restoreViewFromHash() {
  const view = location.hash.slice(1);
  if (view && VALID_VIEWS.includes(view) && activeBaseModulos.includes(view)) {
    handlingPopState = true; // ya está en la URL, no hace falta pushear de nuevo
    navigateTo(view);
    handlingPopState = false;
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

setInterval(() => { if (accessToken && currentView === 'contenido') loadStories(); }, 60000);

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
  { label: 'Tareas · Calendario',    module: 'tareas',    action: () => { navigateTo('tareas'); switchSubTab('calendario'); } },
  { label: 'Procesos · Recetas',     module: 'procesos',  action: () => { navigateTo('procesos'); document.querySelector('[data-procesostab="recetas"]')?.click(); } },
  { label: 'Procesos · Ejecuciones', module: 'procesos',  action: () => { navigateTo('procesos'); document.querySelector('[data-procesostab="ejecuciones"]')?.click(); } },
  { label: 'Compras',                module: 'compras',   action: () => navigateTo('compras') },
  { label: 'Ferias',                 module: 'ferias',    action: () => navigateTo('ferias') },
  { label: 'Stock · Resumen',        module: 'stock',     action: () => { navigateTo('stock'); document.querySelector('[data-stocktab="resumen"]')?.click(); } },
  { label: 'Stock · Trazabilidad',   module: 'stock',     action: () => { navigateTo('stock'); document.querySelector('[data-stocktab="trazabilidad"]')?.click(); } },
  { label: 'Stock · Producto testigo', module: 'stock',   action: () => { navigateTo('stock'); document.querySelector('[data-stocktab="testigo"]')?.click(); } },
  { label: 'Informes',               module: 'informes',  action: () => navigateTo('informes') },
  { label: 'QR',                     module: 'qr',        action: () => navigateTo('qr') },
  { label: 'Ideas',                  module: 'ideas',     action: () => navigateTo('ideas') },
  { label: 'Bases de datos',         action: () => showDbPicker() },
  { label: '+ Nueva tarea',          module: 'tareas',    action: () => { navigateTo('tareas'); openTaskModal(null, null); } },
  { label: '+ Nueva receta',         module: 'procesos',  action: () => { navigateTo('procesos'); document.getElementById('btnNewReceta')?.click(); } },
  { label: '+ Registrar compra',     module: 'compras',   action: () => { navigateTo('compras'); document.getElementById('btnNewCompra')?.click(); } },
  { label: '+ Nueva feria',          module: 'ferias',    action: () => { navigateTo('ferias'); document.getElementById('btnNewFeria')?.click(); } },
  { label: 'Abrir contador de hoy',  module: 'ferias',    action: () => { navigateTo('ferias'); openTodaysFeriaCounterIfAny(); } },
  { label: '+ Ajuste de stock',      module: 'stock',     action: () => { navigateTo('stock'); document.querySelector('[data-stocktab="resumen"]')?.click(); document.getElementById('btnNewStockAjuste')?.click(); } },
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
    // Solo mueve el resaltado (toggle de clase) en vez de volver a llamar a
    // renderCommandPaletteList(): reconstruir el innerHTML de toda la lista
    // en cada mouseenter reemplazaba el nodo justo debajo del cursor a mitad
    // de un click (mousedown/mouseup ya no encontraban el mismo elemento),
    // por lo que un click real (mouse) podía perder el gesto y no navegar a
    // ningún lado — el teclado (Enter) no se veía afectado porque no pasa
    // por hover.
    el.addEventListener('mouseenter', () => {
      commandPaletteIndex = +el.dataset.idx;
      list.querySelectorAll('.command-palette-item').forEach(item =>
        item.classList.toggle('active', +item.dataset.idx === commandPaletteIndex)
      );
    });
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
  // sw.js hace skipWaiting() + clients.claim(), así que en cuanto detecta una
  // versión nueva la activa sola en segundo plano y esta pestaña cambia de
  // controlador. La primera vez que un SW toma el control de una pestaña recién
  // abierta también dispara ese evento, así que la ignoramos — solo un cambio
  // posterior es realmente "hay una versión nueva, hace falta recargar".
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    document.getElementById('btnSyncVersion').style.display = '';
  });

  navigator.serviceWorker.register('./sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });

    // Búsqueda manual de actualización (a diferencia del chequeo automático de
    // arriba, que solo pasa al volver a la pestaña): si sw.js detecta una
    // versión nueva, se activa sola (skipWaiting + clients.claim) y dispara el
    // 'controllerchange' de arriba, que muestra "Sincronizar" — este botón
    // solo fuerza ese chequeo ahora mismo y avisa si no había nada nuevo.
    const btnCheck = document.getElementById('btnCheckUpdate');
    btnCheck.addEventListener('click', async () => {
      btnCheck.disabled = true;
      btnCheck.textContent = 'Buscando…';
      try { await reg.update(); } catch {}
      setTimeout(() => {
        if (document.getElementById('btnSyncVersion').style.display === 'none') {
          btnCheck.textContent = '✅ Al día';
          setTimeout(() => { btnCheck.textContent = '🔍 Buscar'; btnCheck.disabled = false; }, 2500);
        } else {
          btnCheck.textContent = '🔍 Buscar';
          btnCheck.disabled = false;
        }
      }, 1500);
    });
  }).catch(err => console.warn('SW:', err));

  document.getElementById('btnSyncVersion').addEventListener('click', () => location.reload());
}
