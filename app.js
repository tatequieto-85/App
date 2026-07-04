// ── Iconos SVG reutilizables (line-icons, sin emojis) ────────────────────────
const ICON_FILM     = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>';
const ICON_IMAGE    = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
const ICON_FOLDER   = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
const ICON_DOWNLOAD = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const ICON_CHECK    = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 9.01"/></svg>';
const ICON_CALENDAR = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const ICON_TRASH    = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
const ICON_EDIT     = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>';
const ICON_SPINNER  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="icon-spin"><path d="M21 12a9 9 0 11-9-9"/></svg>';
const ICON_COPY     = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';

// ── State ─────────────────────────────────────────────────────────────────────
let accessToken    = null;
let tokenExpiry    = null;
let tokenClient    = null;
let selectedFiles  = [];
let storiesSheetId = null;

// Kanban state
let kanbanColumns      = [];
let kanbanAreas        = [];
let kanbanTasks        = [];
let kanbanTasksSheetId = null;
let kanbanEditId       = null;
let taskAutosaveTimer  = null;
let kanbanActiveFilters = {};
let listaActiveFilters  = {};
let draggedId          = null;
let showTerminal       = false;

// Gantt state
let ganttProjects         = [];
let ganttProjectsSheetId  = null;
let ganttProjectsLoaded   = false;
let currentGanttProjectId = null;
let ganttZoom              = 'week'; // 'day' | 'week' | 'month'
let ganttCollapsedAreas    = new Set();

// Calendar state
let calendarMonth = (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

// Informes state
let informesRange = 'semana'; // 'semana' | 'mes' | 'todo'

// Navigation state
let currentView   = 'home';
let currentSubTab = 'kanban';
let deferredInstallPrompt = null;

// Undo (Ctrl+Z) state
let undoStack = [];

// Ingredientes state
let ingredientes         = [];
let ingredientesSheetId  = null;

// Compras state
let compras              = [];
let comprasSheetId       = null;
let comprasHistorialIng  = null;

// Procesos / Recetas state
let recetas              = [];
let ejecuciones          = [];
let recetasSheetId       = null;
let ejecucionesSheetId   = null;
let recetaBlocks         = [];
let recetaBlocksSheetId  = null;
let recetaBlocksLoaded   = false;
let draggedRecetaId      = null;
let draggedBlockId       = null;
let collapsedRecetaBlocks = new Set();
let currentProcesosTab   = 'recetas';
let editRecetaId         = null;
let recetaFixedFirst     = null; // etapa fija de inicio (oculta en el editor)
let recetaFixedLast      = null; // etapa fija de cierre (oculta en el editor)
let executionState       = null;
let evaluacionPendiente  = null;
let evalRating           = 0;
let evalScores           = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0 };
let evaluacionTotalInsumosG = 0;
let evalObsRows          = []; // { text, createdAt } rows for Fase 1 observaciones
let taskDetailId         = null;
let ejecucionDetailId    = null;
let lastTapTime          = {};   // for double-tap detection on mobile
let draggedColName       = null; // for kanban column drag-reorder
let draggedInstrRow      = null; // for instruction row drag-reorder
let draggedInstrList     = null;
let recetaDetailId       = null; // for recipe detail view
let evalClockInterval    = null; // clock in evaluation modal
let fase2EvalEjId        = null; // ejecucion being evaluated (fase2)
let sineresisEvalEjId    = null; // ejecucion being evaluated (sineresis)
let fase2Scores          = { D3: 0, D6: 0 };

const TERMINAL_STATES = ['Realizado', 'Cancelado', 'Postpuesto'];
const DEFAULT_COLUMNS = [
  { name: 'Pendiente',   color: '#6B5050', terminal: false },
  { name: 'En proceso',  color: '#714B67', terminal: false },
  { name: 'En revisión', color: '#7A9C3E', terminal: false },
  { name: 'Realizado',   color: '#2E7D32', terminal: true  },
  { name: 'Cancelado',   color: '#C62828', terminal: true  },
  { name: 'Postpuesto',  color: '#546E7A', terminal: true  },
];
const DEFAULT_AREAS = ['Marketing', 'Ventas', 'Producción', 'Administración'];

// Paleta crema/pastel para diferenciar áreas (Gantt) sin romper el look de la app.
const AREA_PASTEL_PALETTE = [
  { bg: '#F5E8D3', text: '#7A6A45' }, // crema
  { bg: '#F0DCC9', text: '#7A5A3E' }, // durazno
  { bg: '#E9D8E3', text: '#71495F' }, // malva pastel (eco del brand)
  { bg: '#DCE6D6', text: '#4E6B45' }, // salvia
  { bg: '#D8E1EA', text: '#3E5B75' }, // azul grisáceo
  { bg: '#E7E1CE', text: '#6B6440' }, // oliva claro
  { bg: '#F1DEDA', text: '#8A4F47' }, // coral pastel
  { bg: '#DDE8E3', text: '#3E7264' }, // menta
];

function getAreaColor(area) {
  const key = area || 'Sin área';
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AREA_PASTEL_PALETTE[Math.abs(hash) % AREA_PASTEL_PALETTE.length];
}

const CRED_KEY   = 'ss_credId';
const USER_KEY   = 'ss_userInfo';
const TOKEN_KEY  = 'ss_token';
const EXPIRY_KEY = 'ss_tokenExpiry';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const screenBiometric   = document.getElementById('screenBiometric');
const btnBiometric      = document.getElementById('btnBiometric');
const btnFallbackGoogle = document.getElementById('btnFallbackGoogle');
const bioIcon           = document.getElementById('bioIcon');
const bioSubtitle       = document.getElementById('bioSubtitle');
const screenSignIn  = document.getElementById('screenSignIn');
const screenApp     = document.getElementById('screenApp');
const btnSignIn     = document.getElementById('btnSignIn');
const btnSignOut    = document.getElementById('btnSignOut');
const btnSettings   = document.getElementById('btnSettings');
const userMenu      = document.getElementById('userMenu');

const dropzone      = document.getElementById('dropzone');
const dropzoneInner = document.getElementById('dropzoneInner');
const fileInput     = document.getElementById('fileInput');
const previewEl     = document.getElementById('dropzonePreview');
const uploadProg    = document.getElementById('uploadProgress');
const progressFill  = document.getElementById('progressFill');
const progressText  = document.getElementById('progressText');

const fTitle        = document.getElementById('fTitle');
const fActions      = document.getElementById('fActions');
const fSchedule     = document.getElementById('fSchedule');
const btnAdd        = document.getElementById('btnAddStory');
const formFeedback  = document.getElementById('formFeedback');
const storiesList   = document.getElementById('storiesList');
const pendingBadge  = document.getElementById('pendingBadge');
const todayAlert    = document.getElementById('todayAlert');

const settingsOverlay  = document.getElementById('settingsOverlay');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const settingsPhone    = document.getElementById('settingsPhone');
const settingsApikey   = document.getElementById('settingsApikey');
const btnSaveSettings  = document.getElementById('btnSaveSettings');
const settingsFeedback = document.getElementById('settingsFeedback');

// ── Navigation ────────────────────────────────────────────────────────────────

function navigateTo(view) {
  currentView = view;

  document.getElementById('viewHome').style.display      = view === 'home'      ? '' : 'none';
  document.getElementById('viewContenido').style.display = view === 'contenido' ? '' : 'none';
  document.getElementById('viewTareas').style.display    = view === 'tareas'    ? '' : 'none';
  document.getElementById('viewProcesos').style.display  = view === 'procesos'  ? '' : 'none';
  document.getElementById('viewCompras').style.display   = view === 'compras'   ? '' : 'none';
  document.getElementById('viewInformes').style.display  = view === 'informes'  ? '' : 'none';

  // Back button: hidden on home, visible in modules
  document.getElementById('btnBack').style.display = view === 'home' ? 'none' : '';

  // Load data for the selected view
  if (view === 'tareas') {
    // Siempre iniciar en pestaña Kanban
    currentSubTab = 'kanban';
    document.querySelectorAll('.sub-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.subtab === 'kanban');
    });
    document.getElementById('subTabKanban').style.display     = '';
    document.getElementById('subTabLista').style.display      = 'none';
    document.getElementById('subTabGantt').style.display      = 'none';
    document.getElementById('subTabCalendario').style.display = 'none';
    document.getElementById('kanbanToolbar').style.display    = '';
    document.getElementById('ganttToolbar').style.display     = 'none';
    document.getElementById('calendarToolbar').style.display  = 'none';
    document.getElementById('btnManageBoard').style.display   = '';

    document.getElementById('kanbanBoard').innerHTML =
      '<div class="loading-state" style="padding:48px 0">Cargando…</div>';
    loadKanbanConfig().then(() => loadKanbanTasks()).then(() => {
      populateAreaSelects();
      populateStatusSelects();
      renderKanban();
    });
  }
  if (view === 'procesos') {
    loadProcesos();
  }
  if (view === 'compras') {
    loadCompras().then(() => renderComprasList());
  }
  if (view === 'informes') {
    renderInformes();
  }

  window.scrollTo(0, 0);
}

function renderCurrentSubTab() {
  if (currentSubTab === 'kanban') renderKanban();
  else if (currentSubTab === 'gantt') renderGanttChart();
  else if (currentSubTab === 'calendario') renderCalendar();
  else renderKanbanList();
}

async function switchSubTab(subtab) {
  currentSubTab = subtab;

  document.querySelectorAll('.sub-tab-btn').forEach(b => {
    if (b.dataset.subtab) b.classList.toggle('active', b.dataset.subtab === subtab);
  });
  document.getElementById('subTabKanban').style.display     = subtab === 'kanban'     ? '' : 'none';
  document.getElementById('subTabLista').style.display      = subtab === 'lista'      ? '' : 'none';
  document.getElementById('subTabGantt').style.display      = subtab === 'gantt'      ? '' : 'none';
  document.getElementById('subTabCalendario').style.display = subtab === 'calendario' ? '' : 'none';
  document.getElementById('kanbanToolbar').style.display    = subtab === 'kanban'     ? '' : 'none';
  document.getElementById('ganttToolbar').style.display     = subtab === 'gantt'      ? '' : 'none';
  document.getElementById('calendarToolbar').style.display  = subtab === 'calendario' ? '' : 'none';
  document.getElementById('btnManageBoard').style.display   = (subtab === 'gantt' || subtab === 'calendario') ? 'none' : '';

  await loadKanbanConfig();
  await loadKanbanTasks();
  populateAreaSelects();
  populateStatusSelects();
  if (subtab === 'gantt' && !ganttProjectsLoaded) await loadGanttProjects();
  populateProjectSelects();

  if (subtab === 'kanban') renderKanban();
  else if (subtab === 'gantt') renderGanttChart();
  else if (subtab === 'calendario') renderCalendar();
  else renderKanbanList();
}

// ── Undo (Ctrl+Z) ─────────────────────────────────────────────────────────────

function pushUndo(undoFn) {
  undoStack.push(undoFn);
  if (undoStack.length > 20) undoStack.shift();
}

async function undoLastAction() {
  const fn = undoStack.pop();
  if (!fn) return;
  try { await fn(); } catch (e) { console.error('Error al deshacer:', e); }
}

document.addEventListener('keydown', e => {
  const tag        = (e.target.tagName || '').toLowerCase();
  const isEditable = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    if (isEditable) return; // dejar el undo nativo de texto en campos editables
    e.preventDefault();
    undoLastAction();
  }
});

// ── Sistema anti-clics involuntarios (ignora taps fantasma tras un scroll) ────
// En móvil, si el usuario desliza/hace scroll y el dedo se levanta sobre un
// botón o tarjeta, el navegador dispara igual un "click" sintético. Aquí se
// detecta ese movimiento y se cancela ese click (y el "tap" de doble-toque).

const TOUCH_TAP_MOVE_THRESHOLD = 10; // px
let touchTapStartX  = 0;
let touchTapStartY  = 0;
let touchTapMoved   = false;
let suppressNextClick = false;

document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return;
  touchTapStartX = e.touches[0].clientX;
  touchTapStartY = e.touches[0].clientY;
  touchTapMoved  = false;
}, { passive: true, capture: true });

document.addEventListener('touchmove', e => {
  if (touchTapMoved || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - touchTapStartX;
  const dy = e.touches[0].clientY - touchTapStartY;
  if (Math.hypot(dx, dy) > TOUCH_TAP_MOVE_THRESHOLD) touchTapMoved = true;
}, { passive: true, capture: true });

document.addEventListener('touchend', () => {
  if (touchTapMoved) suppressNextClick = true;
}, { capture: true });

document.addEventListener('click', e => {
  if (!suppressNextClick) return;
  suppressNextClick = false;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}, { capture: true });

function wasAccidentalTouch() {
  return touchTapMoved;
}

// ── PWA install prompt ────────────────────────────────────────────────────────

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('installBanner').style.display = '';
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

// ── WebAuthn / Biometric ──────────────────────────────────────────────────────

function webAuthnAvailable() {
  return !!(window.PublicKeyCredential && navigator.credentials?.create);
}

async function registerBiometric() {
  if (!webAuthnAvailable()) return false;
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge:  crypto.getRandomValues(new Uint8Array(32)),
      rp:         { name: 'Story Scheduler TateQuieto', id: window.location.hostname },
      user:       { id: crypto.getRandomValues(new Uint8Array(16)), name: 'user', displayName: 'TateQuieto' },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
      authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000
    }});
    localStorage.setItem(CRED_KEY, btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
    return true;
  } catch (e) {
    console.log('Biometric registration skipped:', e.message);
    return false;
  }
}

async function verifyBiometric() {
  const stored = localStorage.getItem(CRED_KEY);
  if (!stored || !webAuthnAvailable()) return false;
  try {
    const credId = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    const result = await navigator.credentials.get({ publicKey: {
      challenge:        crypto.getRandomValues(new Uint8Array(32)),
      rpId:             window.location.hostname,
      userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: credId }],
      timeout:          60000
    }});
    return !!result;
  } catch (e) {
    console.log('Biometric failed:', e.message);
    return false;
  }
}

function saveToken(token, expiresIn) {
  accessToken = token;
  tokenExpiry = Date.now() + expiresIn * 1000;
  localStorage.setItem(TOKEN_KEY,  token);
  localStorage.setItem(EXPIRY_KEY, tokenExpiry.toString());
}

function loadSavedToken() {
  const token  = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0');
  if (token && Date.now() < expiry - 5 * 60 * 1000) {
    accessToken = token;
    tokenExpiry = expiry;
    return true;
  }
  return false;
}

async function trySilentGoogleAuth() {
  if (!tokenClient) return false;
  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve(false), 8000);
    const saved   = tokenClient.callback;
    tokenClient.callback = resp => {
      clearTimeout(timeout);
      tokenClient.callback = saved;
      if (resp.error || !resp.access_token) { resolve(false); return; }
      saveToken(resp.access_token, resp.expires_in);
      resolve(true);
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

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
    if (window.google?.accounts?.oauth2) { clearInterval(poll); initAuth(); }
  }, 100);
});

async function initAuth() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: async (resp) => {
      if (resp.error) return console.error('Auth error:', resp.error);
      saveToken(resp.access_token, resp.expires_in);
      await onAuthSuccess();
    }
  });

  if (loadSavedToken()) { await onAuthSuccess(); return; }
  const silentOk = await trySilentGoogleAuth();
  if (silentOk) { await onAuthSuccess(); return; }
  showSignInScreen();
}

btnSignIn.addEventListener('click', () => tokenClient.requestAccessToken({ prompt: '' }));

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

  if (loadSavedToken()) { await onAuthSuccess(false); return; }
  const silentOk = await trySilentGoogleAuth();
  if (silentOk) { await onAuthSuccess(false); return; }

  bioIcon.textContent = '🔐';
  bioSubtitle.textContent = 'Sesión expirada. Inicia sesión con Google una vez.';
  btnBiometric.style.display     = 'none';
  btnFallbackGoogle.style.display = '';
  btnBiometric.disabled = false;
});

btnFallbackGoogle.addEventListener('click', () => { showSignInScreen(); });

btnSignOut.addEventListener('click', () => {
  google.accounts.oauth2.revoke(accessToken, () => {
    accessToken = null;
    localStorage.removeItem(CRED_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    showSignInScreen();
  });
});

async function ensureToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) return;
  if (loadSavedToken()) return;
  await new Promise((resolve, reject) => {
    const saved = tokenClient.callback;
    tokenClient.callback = (resp) => {
      tokenClient.callback = saved;
      if (resp.error) { reject(new Error(resp.error)); return; }
      saveToken(resp.access_token, resp.expires_in);
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

async function onAuthSuccess() {
  screenBiometric.style.display = 'none';
  screenSignIn.style.display    = 'none';
  screenApp.style.display       = '';
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

  await initSheet();
  await initKanbanSheets();
  await loadKanbanTasks();
  await initRecetasSheets();
  await initIngredientesSheet();
  await initComprasSheet();
  setDefaultDateTime();
  await loadStories();

  navigateTo('home');
  checkPendingEvalNotifications();
}

// ── User menu ─────────────────────────────────────────────────────────────────

function setUserMenuInfo(name, email) {
  const label = (name || email || '?').trim();
  document.getElementById('userAvatar').textContent  = label ? label[0].toUpperCase() : '?';
  document.getElementById('userMenuName').textContent  = name  || '';
  document.getElementById('userMenuEmail').textContent = email || '';
}

document.getElementById('userMenuTrigger').addEventListener('click', e => {
  e.stopPropagation();
  const dropdown = document.getElementById('userMenuDropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? '' : 'none';
});
document.addEventListener('click', e => {
  if (!userMenu.contains(e.target)) document.getElementById('userMenuDropdown').style.display = 'none';
});
document.getElementById('btnSettings').addEventListener('click', () => {
  document.getElementById('userMenuDropdown').style.display = 'none';
});
document.getElementById('btnSignOut').addEventListener('click', () => {
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

// ── WhatsApp notification (recordatorio diario) ──────────────────────────────
// El envío automático de las 9am/4pm lo hace notificacion-apps-script.gs desde
// Google Apps Script (corre server-side aunque la app/navegador estén cerrados).
// sendDailyReminder() se conserva solo para el botón manual "Probar envío".

async function sendDailyReminder(hour) {
  try {
    const cfg = await loadConfig();
    if (!cfg.phone || !cfg.apikey) return;

    const opts  = { timeZone: 'America/Bogota' };
    const today = new Date().toLocaleDateString('en-CA', opts);

    let todayStories = [];
    try {
      const data = await sheetsReq('/values/Stories!A:K');
      const rows = (data.values || []).slice(1);
      todayStories = rows
        .filter(r => r[0] && r[8] !== 'TRUE' && r[3])
        .filter(r => new Date(r[3]).toLocaleDateString('en-CA', opts) === today)
        .map(r => ({ title: r[1] || '' }));
    } catch {}

    const emoji = hour === 9 ? '🌅' : '🌆';
    const saludo = hour === 9 ? 'Buenos días' : 'Buenas tardes';
    let msg = `${emoji} *TateQuieto* — ${saludo}!\n`;

    if (todayStories.length) {
      msg += `\n📣 ${todayStories.length} historia${todayStories.length !== 1 ? 's' : ''} programada${todayStories.length !== 1 ? 's' : ''} para hoy:\n`;
      todayStories.forEach(s => { msg += `• ${s.title}\n`; });
    } else {
      msg += `\n✅ No hay historias programadas para hoy.`;
    }

    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cfg.phone)}&text=${encodeURIComponent(msg)}&apikey=${encodeURIComponent(cfg.apikey)}`;
    await fetch(url, { mode: 'no-cors' });
  } catch (e) {
    console.warn('sendDailyReminder:', e);
  }
}

// ── Eval stage WA notifications ──────────────────────────────────────────────

const EVAL_NOTIF_KEY = 'ss_eval_notifs';

function getEvalNotifs() {
  return safeParseJSON(localStorage.getItem(EVAL_NOTIF_KEY), []);
}

function saveEvalNotifs(notifs) {
  localStorage.setItem(EVAL_NOTIF_KEY, JSON.stringify(notifs));
}

function scheduleEvalNotifications(ej) {
  const ev = ej.evaluacion || {};
  const notifs = getEvalNotifs().filter(n => !(n.ejId === ej.id));
  if (ev.fase2UnlockAt) {
    notifs.push({ ejId: ej.id, loteId: ej.loteId, recetaNombre: ej.nombreReceta,
      unlockAt: ev.fase2UnlockAt, type: 'fase2', sent: false });
  }
  if (ev.sineresisUnlockAt) {
    notifs.push({ ejId: ej.id, loteId: ej.loteId, recetaNombre: ej.nombreReceta,
      unlockAt: ev.sineresisUnlockAt, type: 'sineresis', sent: false });
  }
  saveEvalNotifs(notifs);
  armEvalNotifTimers();
}

function armEvalNotifTimers() {
  const now = Date.now();
  getEvalNotifs().forEach(n => {
    if (n.sent) return;
    const msUntil = new Date(n.unlockAt).getTime() - now;
    if (msUntil <= 0) {
      sendEvalWANotification(n);
    } else {
      setTimeout(() => sendEvalWANotification(n), msUntil);
    }
  });
}

async function sendEvalWANotification(notif) {
  const notifs = getEvalNotifs();
  const idx = notifs.findIndex(n => n.ejId === notif.ejId && n.type === notif.type);
  if (idx >= 0 && notifs[idx].sent) return;
  if (idx >= 0) notifs[idx].sent = true;
  saveEvalNotifs(notifs);

  try {
    const cfg = await loadConfig();
    if (!cfg.phone || !cfg.apikey) return;
    const lote = notif.loteId || '—';
    const receta = notif.recetaNombre || '';
    let msg;
    if (notif.type === 'fase2') {
      msg = `🧊 *TATEAPP — Fase 2 lista*\n\nLote ${lote} (${receta})\n\nYa puedes evaluar:\n• Prueba en frío\n• Estabilidad de color\n• Verificación de sello y vacío\n\nProcesos → Ejecuciones → botón "Evaluar Fase 2"`;
    } else {
      msg = `💧 *TATEAPP — Sinéresis lista*\n\nLote ${lote} (${receta})\n\nHan pasado 24h. Evalúa la sinéresis ahora.\n\nProcesos → Ejecuciones → botón "Evaluar Sinéresis"`;
    }
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cfg.phone)}&text=${encodeURIComponent(msg)}&apikey=${encodeURIComponent(cfg.apikey)}`;
    await fetch(url, { mode: 'no-cors' });
  } catch (e) {
    console.warn('sendEvalWANotification:', e);
  }
}

function checkPendingEvalNotifications() {
  armEvalNotifTimers();
}

// ── Procesos: Fase 2 / Sinéresis evaluation ───────────────────────────────────

function openFase2Eval(ejId) {
  const ej = ejecuciones.find(e => e.id === ejId);
  if (!ej) return;
  fase2EvalEjId = ejId;
  fase2Scores = { D3: 0, D6: 0 };
  document.querySelectorAll('.fase2-scale-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('fase2SelloTapa').checked = false;
  document.getElementById('fase2SelloPop').checked  = false;
  document.getElementById('fase2SelloOlor').checked = false;
  document.getElementById('fase2Feedback').textContent = '';
  document.getElementById('fase2LoteLabel').textContent =
    `Lote ${ej.loteId || '—'} — ${ej.nombreReceta}`;
  document.getElementById('fase2EvalOverlay').classList.add('open');
}

function openSineresisEval(ejId) {
  const ej = ejecuciones.find(e => e.id === ejId);
  if (!ej) return;
  sineresisEvalEjId = ejId;
  document.querySelectorAll('input[name="sinEvalOpt"]').forEach(r => r.checked = false);
  document.getElementById('sineresisFeedback').textContent = '';
  document.getElementById('sineresisLoteLabel').textContent =
    `Lote ${ej.loteId || '—'} — ${ej.nombreReceta}`;
  document.getElementById('sineresisEvalOverlay').classList.add('open');
}

document.getElementById('btnCloseFase2Eval').addEventListener('click', () => {
  document.getElementById('fase2EvalOverlay').classList.remove('open');
});
document.getElementById('btnCloseSineresisEval').addEventListener('click', () => {
  document.getElementById('sineresisEvalOverlay').classList.remove('open');
});

document.querySelectorAll('.fase2-scale-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const dim = btn.dataset.dim;
    const val = +btn.dataset.val;
    fase2Scores[dim] = val;
    document.querySelectorAll(`.fase2-scale-btn[data-dim="${dim}"]`).forEach(b => {
      b.classList.toggle('active', +b.dataset.val === val);
    });
  });
});

document.getElementById('btnSaveFase2').addEventListener('click', async () => {
  const ej = ejecuciones.find(e => e.id === fase2EvalEjId);
  if (!ej) return;
  const btn = document.getElementById('btnSaveFase2');
  const fb  = document.getElementById('fase2Feedback');

  const unratedFase2 = ['D3', 'D6'].filter(d => !fase2Scores[d]);
  if (unratedFase2.length) {
    return setFb(fb, `Falta calificar: ${unratedFase2.map(d => EVAL_DIM_LABELS[d]).join(', ')}.`, 'err');
  }

  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const fase2Data = {
      scores:    { ...fase2Scores },
      scoreTotal: fase2Scores.D3 + fase2Scores.D6,
      sello: {
        tapa: document.getElementById('fase2SelloTapa').checked,
        pop:  document.getElementById('fase2SelloPop').checked,
        olor: document.getElementById('fase2SelloOlor').checked,
      }
    };
    ej.evaluacion.fase2        = fase2Data;
    ej.evaluacion.scores.D3    = fase2Scores.D3;
    ej.evaluacion.scores.D6    = fase2Scores.D6;
    ej.evaluacion.sello        = fase2Data.sello;
    ej.evaluacion.scoreTotal   = (ej.evaluacion.scoreTotal || 0) + fase2Data.scoreTotal;
    await updateEjecucion(ej);
    await loadEjecucionesData();
    renderEjecucionesList();
    setFb(fb, '✅ Fase 2 guardada correctamente.', 'ok');
    setTimeout(() => document.getElementById('fase2EvalOverlay').classList.remove('open'), 2000);
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar Fase 2';
  }
});

document.getElementById('btnSaveSineresis').addEventListener('click', async () => {
  const ej = ejecuciones.find(e => e.id === sineresisEvalEjId);
  if (!ej) return;
  const val = document.querySelector('input[name="sinEvalOpt"]:checked')?.value;
  if (!val) return setFb(document.getElementById('sineresisFeedback'), 'Selecciona una opción.', 'err');
  const btn = document.getElementById('btnSaveSineresis');
  const fb  = document.getElementById('sineresisFeedback');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    ej.evaluacion.sineresis = val;
    await updateEjecucion(ej);
    await loadEjecucionesData();
    renderEjecucionesList();
    setFb(fb, '✅ Sinéresis guardada correctamente.', 'ok');
    setTimeout(() => document.getElementById('sineresisEvalOverlay').classList.remove('open'), 2000);
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar Sinéresis';
  }
});

// ── Sheets API helpers ────────────────────────────────────────────────────────

const SHEETS_BASE = () => `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}`;

async function sheetsReq(path, opts = {}) {
  await ensureToken();
  const url     = path.startsWith('http') ? path : `${SHEETS_BASE()}${path}`;
  const isGet   = !opts.method || opts.method === 'GET';
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(isGet ? {} : { 'Content-Type': 'application/json' }),
    ...(opts.headers || {})
  };
  const resp = await fetch(url, { ...opts, headers });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets error ${resp.status}`);
  }
  return resp.json();
}

async function initSheet() {
  const info = await sheetsReq('');
  const tabs  = info.sheets || [];
  const hasS  = tabs.find(s => s.properties.title === 'Stories');
  const hasC  = tabs.find(s => s.properties.title === 'Config');

  if (hasS) storiesSheetId = hasS.properties.sheetId;

  const reqs = [];
  if (!hasS) reqs.push({ addSheet: { properties: { title: 'Stories' } } });
  if (!hasC) reqs.push({ addSheet: { properties: { title: 'Config'  } } });

  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST', body: JSON.stringify({ requests: reqs })
    });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'Stories')
        storiesSheetId = r.addSheet.properties.sheetId;
    });
  }

  const sd = await sheetsReq('/values/Stories!A1').catch(() => ({}));
  if (!sd.values) {
    await sheetsReq('/values/Stories!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID','Title','Actions','ScheduledAt','DriveFileId','OriginalName','MimeType','ThumbUrl','Sent','SentAt','CreatedAt']] })
    });
  }

  const cd = await sheetsReq('/values/Config!A1').catch(() => ({}));
  if (!cd.values) {
    await sheetsReq('/values/Config!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['phone','3122132279'],['apikey','']] })
    });
  }
}

// ── Stories CRUD ──────────────────────────────────────────────────────────────

function parseArr(val) {
  if (!val) return [];
  try {
    const a = JSON.parse(val);
    return Array.isArray(a) ? a : [val];
  } catch {
    return val ? [val] : [];
  }
}

async function loadStories() {
  try {
    const data = await sheetsReq('/values/Stories!A:K');
    const rows = (data.values || []).slice(1);

    const stories = rows
      .filter(r => r[0])
      .map((r, i) => ({
        id:           r[0]  || '',
        title:        r[1]  || '',
        actions:      r[2]  || '',
        scheduledAt:  r[3]  || '',
        driveFileIds: parseArr(r[4]),
        origNames:    parseArr(r[5]),
        mimeTypes:    parseArr(r[6]),
        thumbUrls:    parseArr(r[7]),
        sent:         r[8] === 'TRUE',
        sentAt:       r[9]  || '',
        createdAt:    r[10] || '',
        rowIndex:     i + 2
      }))
      .filter(s => !s.sent)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    renderStories(stories);
  } catch (e) {
    console.error('loadStories:', e);
  }
}

async function appendStory(story) {
  await sheetsReq('/values/Stories!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      story.id, story.title, story.actions, story.scheduledAt,
      story.driveFileId, story.origName, story.mimeType, story.thumbUrl,
      'FALSE', '', story.createdAt
    ]] })
  });
}

async function deleteRow(rowIndex) {
  if (storiesSheetId === null) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'Stories');
    if (tab) storiesSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{
      deleteDimension: {
        range: {
          sheetId:    storiesSheetId,
          dimension:  'ROWS',
          startIndex: rowIndex - 1,
          endIndex:   rowIndex
        }
      }
    }]})
  });
}

async function deleteStory(story) {
  for (const fid of (story.driveFileIds || [])) {
    await deleteDriveFile(fid);
  }
  await deleteRow(story.rowIndex);
}

// ── Config ────────────────────────────────────────────────────────────────────

async function loadConfig() {
  const data = await sheetsReq('/values/Config!A:B');
  const cfg  = {};
  (data.values || []).forEach(r => { if (r[0]) cfg[r[0]] = r[1] || ''; });
  return cfg;
}

async function saveConfig(phone, apikey) {
  await sheetsReq('/values/Config!A1:B2?valueInputOption=RAW', {
    method: 'PUT',
    body: JSON.stringify({ values: [['phone', phone], ['apikey', apikey]] })
  });
}

// ── Google Drive ──────────────────────────────────────────────────────────────

async function uploadToDrive(file, onProgress) {
  await ensureToken();

  const initResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      Authorization:             `Bearer ${accessToken}`,
      'Content-Type':            'application/json',
      'X-Upload-Content-Type':   file.type,
      'X-Upload-Content-Length': String(file.size)
    },
    body: JSON.stringify({ name: file.name, mimeType: file.type })
  });
  if (!initResp.ok) throw new Error('No se pudo iniciar la subida a Drive');
  const uploadUrl = initResp.headers.get('Location');

  const fileData = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(`Drive upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Error de conexión al subir'));
    xhr.send(file);
  });

  await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  });

  return fileData;
}

function thumbUrl(fileId) {
  if (!fileId) return '';
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;
}

async function deleteDriveFile(fileId) {
  if (!fileId) return;
  try {
    await ensureToken();
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  } catch (e) {
    console.warn('Drive delete failed:', fileId, e.message);
  }
}

async function downloadDriveFile(fileId, origName) {
  await ensureToken();
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) throw new Error(`Error ${resp.status} al descargar`);
  const blob = await resp.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = origName || fileId;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Multi-file dropzone ───────────────────────────────────────────────────────

function addFiles(files) {
  for (const f of files) selectedFiles.push(f);
  renderFilePreview();
}

function removeFileAt(idx) {
  selectedFiles.splice(idx, 1);
  renderFilePreview();
}

function clearFiles() {
  selectedFiles = [];
  fileInput.value = '';
  renderFilePreview();
}

function renderFilePreview() {
  previewEl.innerHTML = '';
  if (!selectedFiles.length) {
    dropzoneInner.style.display = '';
    return;
  }
  dropzoneInner.style.display = 'none';

  selectedFiles.forEach((file, idx) => {
    const item = document.createElement('div');
    item.className = 'preview-item';

    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      item.appendChild(img);
    } else if (file.type.startsWith('video/')) {
      const vid = document.createElement('video');
      vid.src = URL.createObjectURL(file);
      vid.muted = true;
      item.appendChild(vid);
    } else {
      const icon = document.createElement('div');
      icon.className = 'preview-icon';
      icon.textContent = '📎';
      item.appendChild(icon);
    }

    const nm = document.createElement('div');
    nm.className = 'preview-name';
    nm.textContent = file.name;
    item.appendChild(nm);

    const rm = document.createElement('button');
    rm.className = 'preview-remove';
    rm.textContent = '✕';
    rm.title = 'Quitar';
    rm.addEventListener('click', e => { e.stopPropagation(); removeFileAt(idx); });
    item.appendChild(rm);

    previewEl.appendChild(item);
  });
}

dropzone.addEventListener('click', e => {
  if (!e.target.closest('#uploadProgress') && !e.target.closest('.preview-remove')) {
    fileInput.click();
  }
});
dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault(); dropzone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files));
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) addFiles(Array.from(fileInput.files));
  fileInput.value = '';
});

// ── Add story ─────────────────────────────────────────────────────────────────

btnAdd.addEventListener('click', async () => {
  const title   = fTitle.value.trim();
  const actions = fActions.value.trim();
  const sched   = fSchedule.value;

  if (!title) return setFb(formFeedback, 'El título es obligatorio.', 'err');
  if (!sched) return setFb(formFeedback, 'La fecha es obligatoria.',  'err');

  btnAdd.disabled = true; btnAdd.textContent = 'Guardando…';

  try {
    const fileIds = [], origNames = [], mimeTypes = [], thumbUrls = [];

    if (selectedFiles.length) {
      uploadProg.style.display = '';
      progressFill.style.width = '0%';

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        progressText.textContent = `Subiendo archivo ${i + 1} de ${selectedFiles.length}…`;

        const fd = await uploadToDrive(file, pct => {
          const overall = ((i + pct / 100) / selectedFiles.length) * 100;
          progressFill.style.width = `${Math.round(overall)}%`;
        });

        fileIds.push(fd.id);
        origNames.push(file.name);
        mimeTypes.push(file.type);
        thumbUrls.push(thumbUrl(fd.id));
      }

      progressFill.style.width = '100%';
      progressText.textContent = `✅ ${fileIds.length} archivo${fileIds.length !== 1 ? 's' : ''} guardado${fileIds.length !== 1 ? 's' : ''} en Drive`;
      await delay(1000);
      uploadProg.style.display = 'none';
    }

    await appendStory({
      id:          crypto.randomUUID(),
      title, actions,
      scheduledAt: new Date(sched).toISOString(),
      driveFileId: JSON.stringify(fileIds),
      origName:    JSON.stringify(origNames),
      mimeType:    JSON.stringify(mimeTypes),
      thumbUrl:    JSON.stringify(thumbUrls),
      createdAt:   new Date().toISOString()
    });

    setFb(formFeedback, '✅ Historia programada correctamente.', 'ok');
    fTitle.value = ''; fActions.value = ''; clearFiles();
    setDefaultDateTime();
    await loadStories();
  } catch (e) {
    console.error(e);
    setFb(formFeedback, `Error: ${e.message}`, 'err');
  } finally {
    btnAdd.disabled = false; btnAdd.textContent = 'Programar historia';
    uploadProg.style.display = 'none';
  }
});

// ── Today check ───────────────────────────────────────────────────────────────

function isToday(isoDate) {
  if (!isoDate) return false;
  const opts  = { timeZone: 'America/Bogota' };
  const toDay = d => new Date(d).toLocaleDateString('en-CA', opts);
  return toDay(isoDate) === toDay(new Date());
}

// ── Render stories ────────────────────────────────────────────────────────────

function renderStories(stories) {
  const pending      = stories.length;
  const todayStories = stories.filter(s => isToday(s.scheduledAt));

  pendingBadge.textContent = `${pending} pendiente${pending !== 1 ? 's' : ''}`;

  if (todayStories.length) {
    const n = todayStories.length;
    todayAlert.textContent   = `📣 ${n === 1 ? 'Tienes 1 historia para publicar HOY' : `Tienes ${n} historias para publicar HOY`}`;
    todayAlert.style.display = '';
  } else {
    todayAlert.style.display = 'none';
  }

  if (!stories.length) {
    storiesList.innerHTML = '<div class="empty-state">Aún no hay historias programadas</div>';
    return;
  }

  storiesList.innerHTML = stories.map(storyCardHTML).join('');

  storiesList.querySelectorAll('[data-delete-row]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta historia y sus archivos de Drive?')) return;
      const rowIndex = +btn.dataset.deleteRow;
      const story    = stories.find(s => s.rowIndex === rowIndex);
      btn.disabled   = true;
      try { await deleteStory(story); await loadStories(); }
      catch (e) { alert(`Error al eliminar: ${e.message}`); btn.disabled = false; }
    });
  });

  storiesList.querySelectorAll('[data-drive-id]').forEach(btn => {
    btn.addEventListener('click', () =>
      window.open(`https://drive.google.com/file/d/${btn.dataset.driveId}/view`, '_blank')
    );
  });

  storiesList.querySelectorAll('[data-download-row]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rowIndex = +btn.dataset.downloadRow;
      const story    = stories.find(s => s.rowIndex === rowIndex);
      btn.disabled   = true;
      btn.innerHTML  = ICON_SPINNER;
      try {
        for (let i = 0; i < story.driveFileIds.length; i++) {
          await downloadDriveFile(story.driveFileIds[i], story.origNames[i]);
          if (i < story.driveFileIds.length - 1) await delay(400);
        }
      } catch (e) { alert(`Error al descargar: ${e.message}`); }
      finally { btn.disabled = false; btn.innerHTML = ICON_DOWNLOAD; }
    });
  });

  storiesList.querySelectorAll('[data-publish-row]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Marcar como publicada? Esto eliminará la historia y sus archivos de Drive.')) return;
      const rowIndex = +btn.dataset.publishRow;
      const story    = stories.find(s => s.rowIndex === rowIndex);
      btn.disabled   = true;
      try { await deleteStory(story); await loadStories(); }
      catch (e) { alert(`Error: ${e.message}`); btn.disabled = false; }
    });
  });
}

function storyCardHTML(s) {
  const today      = isToday(s.scheduledAt);
  const firstThumb = s.thumbUrls[0];
  const extraCount = s.driveFileIds.length > 1
    ? `<span class="thumb-count">${s.driveFileIds.length}</span>` : '';

  let thumbContent;
  if (firstThumb) {
    thumbContent = `<img src="${firstThumb}" alt="" loading="lazy" onerror="this.style.display='none'">${extraCount}`;
  } else if (s.mimeTypes[0]?.startsWith('video/')) {
    thumbContent = ICON_FILM;
  } else if (s.driveFileIds.length) {
    thumbContent = ICON_IMAGE;
  } else {
    thumbContent = '';
  }

  const actions = s.actions
    ? esc(s.actions)
    : '<em style="opacity:.55">Sin acciones especificadas</em>';

  const driveBtn = s.driveFileIds[0]
    ? `<button class="btn-sm" data-drive-id="${s.driveFileIds[0]}" title="Ver en Drive">${ICON_FOLDER}</button>` : '';

  const dlBtn = s.driveFileIds.length
    ? `<button class="btn-sm btn-dl" data-download-row="${s.rowIndex}" title="Descargar archivo(s)">${ICON_DOWNLOAD}</button>` : '';

  const todayBadge = today ? '<span class="today-badge">HOY</span>' : '';

  return `
    <div class="story-card${today ? ' today' : ''}">
      <div class="story-thumb">${thumbContent}</div>
      <div class="story-body">
        <div class="story-title">${todayBadge}${esc(s.title)}</div>
        <div class="story-date">${ICON_CALENDAR}${fmtDate(s.scheduledAt)}</div>
        <div class="story-actions">${actions}</div>
        <div class="story-footer">
          <button class="btn-pub" data-publish-row="${s.rowIndex}">${ICON_CHECK}Publicada</button>
          <div class="story-footer-icons">${driveBtn}${dlBtn}</div>
        </div>
      </div>
      <div class="story-actions-btn">
        <button class="story-delete" data-delete-row="${s.rowIndex}" title="Eliminar">${ICON_TRASH}</button>
      </div>
    </div>`;
}

// ── Settings modal ────────────────────────────────────────────────────────────

let settingsOriginal = { phone: '', apikey: '' };

btnSettings.addEventListener('click', async () => {
  try {
    const cfg = await loadConfig();
    settingsPhone.value  = cfg.phone  || '3122132279';
    settingsApikey.value = cfg.apikey || '';
  } catch {}
  settingsOriginal = { phone: settingsPhone.value, apikey: settingsApikey.value };
  settingsFeedback.className = 'feedback';
  settingsFeedback.textContent = '';
  settingsOverlay.classList.add('open');
});

function isSettingsFormDirty() {
  return settingsPhone.value !== settingsOriginal.phone || settingsApikey.value !== settingsOriginal.apikey;
}

function closeSettingsModal() {
  confirmCloseIfDirty('settingsOverlay', isSettingsFormDirty);
}

btnCloseSettings.addEventListener('click', closeSettingsModal);

document.getElementById('btnTestWhatsApp').addEventListener('click', async () => {
  const fb = settingsFeedback;
  setFb(fb, 'Enviando…', '');
  try {
    await sendDailyReminder(new Date().getHours());
    setFb(fb, '✅ Mensaje enviado (revisa WhatsApp en unos segundos).', 'ok');
  } catch (e) {
    setFb(fb, `Error: ${e.message}`, 'err');
  }
});
settingsOverlay.addEventListener('click', e => {
  if (e.target === settingsOverlay) closeSettingsModal();
});

btnSaveSettings.addEventListener('click', async () => {
  const phone  = settingsPhone.value.trim();
  const apikey = settingsApikey.value.trim();
  if (!apikey) return setFb(settingsFeedback, 'La API key es obligatoria.', 'err');
  try {
    await saveConfig(phone, apikey);
    setFb(settingsFeedback, '✅ Guardado en Google Sheets.', 'ok');
    setTimeout(() => settingsOverlay.classList.remove('open'), 1800);
  } catch (e) {
    setFb(settingsFeedback, `Error: ${e.message}`, 'err');
  }
});

// ── Instagram Emoji Picker ────────────────────────────────────────────────────

const INSTAGRAM_EMOJIS = [
  '❤️','🧡','💛','💚','💙','💜','🖤','❤️‍🔥','💔','💕','💞','💓','💗','💖','💝',
  '🔥','✨','💫','⭐','🌟','💥','🎉','🎊','🎁','🏆','🥇','🎯','💎','🔑','🌈',
  '😍','🥰','😘','🤩','😎','😁','😊','🤗','🥳','😂','🤣','😏','🤭','🫶','🙌',
  '👍','👏','💪','✌️','🤞','👌','🫰','💯','🙏','👇','👆','➡️','⬇️','📌','📍',
  '📸','📷','🎬','🎥','📲','💬','🗣️','📢','📣','🛒','🏷️','💳','🤑','💰','🔗',
  '🌶️','🫑','🧄','🧅','🌮','🍕','🥑','🍅','🥥','🫙','🧃','🍯','🫕','🥘','🍲',
  '🌺','🌸','🌻','🌼','🌿','🍃','🌱','🪴','🌾','🍀','🎋','🌵','🌴','🦋','🐝',
  '🚀','⚡','🌊','🏔️','🎶','🎵','🎸','🎤','🎧','🎨','✍️','📚','💡','🛠️','⚙️',
];

function initEmojiPicker() {
  const panel = document.getElementById('emojiPanel');
  const btn   = document.getElementById('btnToggleEmoji');
  if (!panel || !btn) return;

  panel.innerHTML = INSTAGRAM_EMOJIS.map(e =>
    `<button class="emoji-btn" type="button">${e}</button>`
  ).join('');

  panel.querySelectorAll('.emoji-btn').forEach(emojiBtn => {
    emojiBtn.addEventListener('click', () => {
      insertEmoji(emojiBtn.textContent);
    });
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#emojiPanel') && !e.target.closest('#btnToggleEmoji')) {
      panel.classList.remove('open');
    }
  });
}

function insertEmoji(emoji) {
  const ta    = fActions;
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  ta.value = ta.value.substring(0, start) + emoji + ta.value.substring(end);
  ta.selectionStart = ta.selectionEnd = start + emoji.length;
  ta.focus();
  document.getElementById('emojiPanel')?.classList.remove('open');
}

window.addEventListener('load', initEmojiPicker);

// ── Utils ─────────────────────────────────────────────────────────────────────

function setFb(el, msg, type) {
  el.textContent = msg; el.className = `feedback ${type}`;
  if (type === 'ok') setTimeout(() => { el.textContent = ''; el.className = 'feedback'; }, 4500);
}

function confirmCloseIfDirty(overlayId, isDirtyFn) {
  if (isDirtyFn() && !confirm('¿Salir sin guardar? Se perderán los cambios.')) return;
  document.getElementById(overlayId).classList.remove('open');
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function normalizeObsList(obs) {
  if (!obs) return [];
  if (Array.isArray(obs)) return obs.map(o => typeof o === 'string' ? { text: o } : o).filter(o => o && o.text);
  if (typeof obs === 'string') return obs.trim() ? [{ text: obs.trim() }] : [];
  return [];
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// ── Borrador de nueva tarea (persistencia ante cierre accidental) ─────────────

function saveTaskDraft() {
  if (kanbanEditId) return;
  const draft = {
    area:     document.getElementById('taskArea')?.value    || '',
    title:    document.getElementById('taskTitle')?.value   || '',
    desc:     document.getElementById('taskDesc')?.value    || '',
    due:      document.getElementById('taskDue')?.value     || '',
    status:   document.getElementById('taskStatus')?.value  || '',
    priority: document.getElementById('taskPriority')?.value || '',
    project:  document.getElementById('taskProject')?.value || '',
    start:    document.getElementById('taskStart')?.value    || '',
    subtasks: collectSubtasks()
  };
  if (draft.title || draft.desc || draft.subtasks.length) {
    localStorage.setItem('ss_draftTask', JSON.stringify(draft));
  }
}

function loadTaskDraft() {
  return safeParseJSON(localStorage.getItem('ss_draftTask'), null);
}

function clearTaskDraft() {
  localStorage.removeItem('ss_draftTask');
}

// ── Autoguardado silencioso del modal de tarea ────────────────────────────────

function startTaskAutosave() {
  stopTaskAutosave();
  taskAutosaveTimer = setInterval(performTaskAutosave, 25000);
}

function stopTaskAutosave() {
  if (taskAutosaveTimer) { clearInterval(taskAutosaveTimer); taskAutosaveTimer = null; }
}

async function performTaskAutosave() {
  if (!document.getElementById('taskOverlay')?.classList.contains('open')) { stopTaskAutosave(); return; }
  const title = document.getElementById('taskTitle')?.value.trim();
  if (!title) return; // nada útil que guardar todavía

  const area      = document.getElementById('taskArea').value;
  const desc      = document.getElementById('taskDesc').value.trim();
  const due       = document.getElementById('taskDue').value;
  const status    = document.getElementById('taskStatus').value;
  const priority  = document.getElementById('taskPriority').value;
  const projectId = document.getElementById('taskProject').value;
  const startDate = document.getElementById('taskStart').value;
  const subtasks  = collectSubtasks();

  try {
    if (kanbanEditId) {
      const task = kanbanTasks.find(t => t.id === kanbanEditId);
      if (!task) return;
      const next = {
        area, title, desc, dueDate: due, status, subtasks, priority,
        projectId, startDate: projectId ? startDate : ''
      };
      const prevComparable = JSON.stringify({
        area: task.area, title: task.title, desc: task.desc, dueDate: task.dueDate,
        status: task.status, subtasks: task.subtasks, priority: task.priority,
        projectId: task.projectId, startDate: task.startDate
      });
      if (JSON.stringify(next) === prevComparable) return; // sin cambios
      Object.assign(task, next);
      await updateKanbanTask(task);
    } else {
      if (!due) return; // esperar a que haya fecha límite antes de crear la fila
      const now = new Date().toISOString();
      const newId = crypto.randomUUID();
      await appendKanbanTask({
        id: newId, area, title, desc, dueDate: due, status, createdAt: now, updatedAt: now,
        subtasks, observations: [], priority, projectId, startDate: projectId ? startDate : '',
        dependsOn: [], timeSessions: []
      });
      await loadKanbanTasks();
      kanbanEditId = newId;
      clearTaskDraft();
    }
  } catch (e) { /* fallo silencioso: se reintenta en el próximo ciclo */ }
}

function fmtDueShort(dateStr) {
  if (!dateStr) return '';
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff < 0)  return `⚠️ vencida`;
  if (diff === 0) return `🔴 hoy`;
  if (diff === 1) return `🟡 mañana`;
  return `📅 ${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' })}`;
}

function fmtSeconds(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function setDefaultDateTime() {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  fSchedule.value = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && accessToken) {
    if (Date.now() > tokenExpiry - 5 * 60 * 1000) await trySilentGoogleAuth();
    loadStories();
  }
});

setInterval(async () => {
  if (accessToken && screenApp.style.display !== 'none') await trySilentGoogleAuth();
}, 50 * 60 * 1000);

setInterval(() => { if (accessToken) loadStories(); }, 60000);

// ── Kanban Sheet Init ─────────────────────────────────────────────────────────

async function initKanbanSheets() {
  const info = await sheetsReq('');
  const tabs  = info.sheets || [];
  const hasTasks = tabs.find(s => s.properties.title === 'KanbanTasks');
  const hasConf  = tabs.find(s => s.properties.title === 'KanbanConfig');
  const hasGantt = tabs.find(s => s.properties.title === 'GanttProjects');

  if (hasTasks) kanbanTasksSheetId    = hasTasks.properties.sheetId;
  if (hasGantt) ganttProjectsSheetId  = hasGantt.properties.sheetId;

  const reqs = [];
  if (!hasTasks) reqs.push({ addSheet: { properties: { title: 'KanbanTasks'  } } });
  if (!hasConf)  reqs.push({ addSheet: { properties: { title: 'KanbanConfig' } } });
  if (!hasGantt) reqs.push({ addSheet: { properties: { title: 'GanttProjects' } } });

  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST', body: JSON.stringify({ requests: reqs })
    });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'KanbanTasks')
        kanbanTasksSheetId = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'GanttProjects')
        ganttProjectsSheetId = r.addSheet.properties.sheetId;
    });
  }

  const td = await sheetsReq('/values/KanbanTasks!A1:P1').catch(() => ({}));
  if (!td.values || (td.values[0] || []).length < 16) {
    await sheetsReq('/values/KanbanTasks!A1:P1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['ID','Area','Title','Description','DueDate','Status','CreatedAt','UpdatedAt','Subtasks','Observations','Priority','StartDate','ProjectId','DependsOn','TimeSessions','SortOrder']] })
    });
  }

  const gd = await sheetsReq('/values/GanttProjects!A1').catch(() => ({}));
  if (!gd.values) {
    await sheetsReq('/values/GanttProjects!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID','Name','Color','CreatedAt']] })
    });
  }

  const kd = await sheetsReq('/values/KanbanConfig!A1').catch(() => ({}));
  if (!kd.values) {
    await sheetsReq('/values/KanbanConfig!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [
        ['columns', JSON.stringify(DEFAULT_COLUMNS)],
        ['areas',   JSON.stringify(DEFAULT_AREAS)]
      ]})
    });
    kanbanColumns = DEFAULT_COLUMNS;
    kanbanAreas   = DEFAULT_AREAS;
  } else {
    await loadKanbanConfig();
  }
}

// ── Kanban Config ─────────────────────────────────────────────────────────────

async function loadKanbanConfig() {
  const data = await sheetsReq('/values/KanbanConfig!A:B');
  const cfg  = {};
  (data.values || []).forEach(r => { if (r[0]) cfg[r[0]] = r[1] || ''; });
  try { kanbanColumns = JSON.parse(cfg.columns) || DEFAULT_COLUMNS; } catch { kanbanColumns = DEFAULT_COLUMNS; }
  try { kanbanAreas   = JSON.parse(cfg.areas)   || DEFAULT_AREAS;   } catch { kanbanAreas   = DEFAULT_AREAS;   }
}

async function saveKanbanConfig() {
  await sheetsReq('/values/KanbanConfig!A1:B2?valueInputOption=RAW', {
    method: 'PUT',
    body: JSON.stringify({ values: [
      ['columns', JSON.stringify(kanbanColumns)],
      ['areas',   JSON.stringify(kanbanAreas)]
    ]})
  });
}

// ── Kanban Tasks CRUD ─────────────────────────────────────────────────────────

async function loadKanbanTasks() {
  const data = await sheetsReq('/values/KanbanTasks!A:P');
  const rows = (data.values || []).slice(1);
  kanbanTasks = rows
    .filter(r => r[0])
    .map((r, i) => ({
      id:           r[0] || '',
      area:         r[1] || '',
      title:        r[2] || '',
      desc:         r[3] || '',
      dueDate:      r[4] || '',
      status:       r[5] || '',
      createdAt:    r[6] || '',
      updatedAt:    r[7] || '',
      subtasks:     safeParseJSON(r[8], []),
      observations: safeParseJSON(r[9], []),
      priority:     r[10] || '',
      startDate:    r[11] || '',
      projectId:    r[12] || '',
      dependsOn:    safeParseJSON(r[13], []),
      timeSessions: safeParseJSON(r[14], []),
      sortOrder:    r[15] !== undefined && r[15] !== '' ? +r[15] : null,
      rowIndex:     i + 2
    }));
  updateDueBadgeCounts();
}

async function appendKanbanTask(task) {
  await sheetsReq('/values/KanbanTasks!A:P:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      task.id, task.area, task.title, task.desc,
      task.dueDate, task.status, task.createdAt, task.updatedAt,
      JSON.stringify(task.subtasks || []),
      JSON.stringify(task.observations || []),
      task.priority || '',
      task.startDate || '',
      task.projectId || '',
      JSON.stringify(task.dependsOn || []),
      JSON.stringify(task.timeSessions || []),
      task.sortOrder ?? ''
    ]]})
  });
}

async function updateKanbanTask(task) {
  await sheetsReq(`/values/KanbanTasks!A${task.rowIndex}:P${task.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      task.id, task.area, task.title, task.desc,
      task.dueDate, task.status, task.createdAt, new Date().toISOString(),
      JSON.stringify(task.subtasks || []),
      JSON.stringify(task.observations || []),
      task.priority || '',
      task.startDate || '',
      task.projectId || '',
      JSON.stringify(task.dependsOn || []),
      JSON.stringify(task.timeSessions || []),
      task.sortOrder ?? ''
    ]]})
  });
}

async function deleteKanbanTaskRow(rowIndex) {
  if (!kanbanTasksSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'KanbanTasks');
    if (tab) kanbanTasksSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{
      deleteDimension: {
        range: {
          sheetId:    kanbanTasksSheetId,
          dimension:  'ROWS',
          startIndex: rowIndex - 1,
          endIndex:   rowIndex
        }
      }
    }]})
  });
}

async function deleteTaskWithUndo(taskId, rowIndex) {
  const task = kanbanTasks.find(t => t.id === taskId);
  const snapshot = task ? JSON.parse(JSON.stringify(task)) : null;
  await deleteKanbanTaskRow(rowIndex);
  await loadKanbanTasks();
  if (snapshot) {
    pushUndo(async () => {
      await appendKanbanTask(snapshot);
      await loadKanbanTasks();
      renderCurrentSubTab();
    });
  }
}

// ── Gantt Projects CRUD ─────────────────────────────────────────────────────────

async function loadGanttProjects() {
  const data = await sheetsReq('/values/GanttProjects!A:D');
  const rows = (data.values || []).slice(1);
  ganttProjects = rows
    .filter(r => r[0])
    .map((r, i) => ({
      id:        r[0] || '',
      name:      r[1] || '',
      color:     r[2] || '#714B67',
      createdAt: r[3] || '',
      rowIndex:  i + 2
    }));
  ganttProjectsLoaded = true;
  if (currentGanttProjectId && !ganttProjects.find(p => p.id === currentGanttProjectId))
    currentGanttProjectId = null;
  if (!currentGanttProjectId && ganttProjects.length) currentGanttProjectId = ganttProjects[0].id;
}

async function appendGanttProject(project) {
  await sheetsReq('/values/GanttProjects!A:D:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[project.id, project.name, project.color, project.createdAt]] })
  });
}

async function updateGanttProject(project) {
  await sheetsReq(`/values/GanttProjects!A${project.rowIndex}:D${project.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[project.id, project.name, project.color, project.createdAt]] })
  });
}

async function deleteGanttProjectRow(rowIndex) {
  if (!ganttProjectsSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'GanttProjects');
    if (tab) ganttProjectsSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{
      deleteDimension: {
        range: {
          sheetId:    ganttProjectsSheetId,
          dimension:  'ROWS',
          startIndex: rowIndex - 1,
          endIndex:   rowIndex
        }
      }
    }]})
  });
}

async function deleteGanttProject(projectId) {
  const project = ganttProjects.find(p => p.id === projectId);
  if (!project) return;
  const affected = kanbanTasks.filter(t => t.projectId === projectId);
  await deleteGanttProjectRow(project.rowIndex);
  for (const t of affected) {
    t.projectId = ''; t.startDate = '';
    await updateKanbanTask(t);
  }
  await loadGanttProjects();
}

// ── Kanban Render ─────────────────────────────────────────────────────────────

function fmtDue(dateStr) {
  if (!dateStr) return { text: '', cls: '' };
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((d - today) / 86400000);
  const label = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' });
  if (diff < 0)  return { text: `⚠️ ${label}`, cls: 'overdue' };
  if (diff === 0) return { text: `🔴 HOY`,      cls: 'today'  };
  if (diff === 1) return { text: `🟡 Mañana`,   cls: ''       };
  return { text: `📅 ${label}`, cls: '' };
}

function getDueStatus(dateStr) {
  if (!dateStr) return '';
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff < 0) return 'vencido';
  if (diff === 0) return 'hoy';
  if (diff <= 3) return 'porVencer';
  return 'normal';
}

// ── Header due-date badges (Hoy / Atrasado / A futuro) ────────────────────────

function getDueCategory(dateStr) {
  if (!dateStr) return null;
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff < 0)  return 'atrasado';
  if (diff === 0) return 'hoy';
  return 'futuro';
}

function getTasksByDueCategory(cat) {
  return kanbanTasks
    .filter(t => !TERMINAL_STATES.includes(t.status) && getDueCategory(t.dueDate) === cat)
    .sort((a, b) => (a.dueDate || '') < (b.dueDate || '') ? -1 : 1);
}

function updateDueBadgeCounts() {
  const hoyEl      = document.getElementById('dueCountHoy');
  const atrasadoEl = document.getElementById('dueCountAtrasado');
  const futuroEl   = document.getElementById('dueCountFuturo');
  if (!hoyEl || !atrasadoEl || !futuroEl) return;
  hoyEl.textContent      = getTasksByDueCategory('hoy').length;
  atrasadoEl.textContent = getTasksByDueCategory('atrasado').length;
  futuroEl.textContent   = getTasksByDueCategory('futuro').length;
}

const DUE_CATEGORY_LABELS = { hoy: 'Tareas para hoy', atrasado: 'Tareas atrasadas', futuro: 'Tareas a futuro' };

function renderDueBadgeDropdown(cat) {
  const tasks = getTasksByDueCategory(cat);
  document.getElementById('dueBadgeDropdownTitle').textContent = `${DUE_CATEGORY_LABELS[cat]} (${tasks.length})`;
  const list = document.getElementById('dueBadgeDropdownList');
  if (!tasks.length) {
    list.innerHTML = '<div class="due-badge-dropdown-empty">No hay tareas.</div>';
    return;
  }
  list.innerHTML = tasks.map(t => `
    <div class="due-badge-dropdown-item" data-task="${esc(t.id)}">
      <span class="due-badge-item-title">${esc(t.title)}</span>
      <span class="due-badge-item-meta">${esc(t.area)} · ${fmtDueShort(t.dueDate)}</span>
    </div>
  `).join('');
  list.querySelectorAll('[data-task]').forEach(el => {
    el.addEventListener('click', () => {
      closeDueBadgeDropdown();
      navigateTo('tareas');
      openTaskDetail(el.dataset.task);
    });
  });
}

function openDueBadgeDropdown(cat) {
  renderDueBadgeDropdown(cat);
  document.querySelectorAll('.due-badge').forEach(b => b.classList.toggle('active', b.dataset.dueCat === cat));
  document.getElementById('dueBadgeDropdown').style.display = '';
}

function closeDueBadgeDropdown() {
  document.getElementById('dueBadgeDropdown').style.display = 'none';
  document.querySelectorAll('.due-badge').forEach(b => b.classList.remove('active'));
}

const PRIORITY_LABELS = { alta: '🔴 Alta', media: '🟡 Media', baja: '🟢 Baja' };

function getTrafficLight(dateStr) {
  if (!dateStr) return null;
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff < 0)  return { cls: 'traffic-red',    tip: `Vencida hace ${Math.abs(diff)} día${Math.abs(diff) !== 1 ? 's' : ''}` };
  if (diff === 0) return { cls: 'traffic-orange', tip: 'Vence HOY' };
  if (diff <= 2)  return { cls: 'traffic-yellow', tip: `${diff} día${diff !== 1 ? 's' : ''} restante${diff !== 1 ? 's' : ''}` };
  if (diff <= 7)  return { cls: 'traffic-green',  tip: `${diff} días restantes` };
  return { cls: 'traffic-gray', tip: `${diff} días restantes` };
}

function renderKanban() {
  const board      = document.getElementById('kanbanBoard');
  if (!board) return;
  updateFilterButtonLabel('kanbanFilterBtn', kanbanActiveFilters);
  const areaFilter     = kanbanActiveFilters.area     || '';
  const priorityFilter = kanbanActiveFilters.priority || '';
  const dueFilter      = kanbanActiveFilters.due      || '';

  let tasks = kanbanTasks;
  if (areaFilter)     tasks = tasks.filter(t => t.area === areaFilter);
  if (priorityFilter) tasks = tasks.filter(t => t.priority === priorityFilter);
  if (dueFilter)      tasks = tasks.filter(t => getDueStatus(t.dueDate) === dueFilter);
  const visibleCols = kanbanColumns.filter(c => !c.terminal || showTerminal);

  board.innerHTML = '';

  visibleCols.forEach(col => {
    const colTasks = tasks.filter(t => t.status === col.name);
    const colEl    = document.createElement('div');
    colEl.className = 'kanban-col' + (col.terminal ? ' terminal' : '');

    colEl.innerHTML = `
      <div class="kanban-col-header" draggable="true" title="Arrastra para reordenar columna">
        <span class="kanban-col-dot" style="background:${esc(col.color)}"></span>
        <span class="kanban-col-title">${esc(col.name)}</span>
        <span class="kanban-col-count">${colTasks.length}</span>
        ${col.terminal ? '' : `<button class="kanban-add-card-icon" data-col="${esc(col.name)}" title="Agregar tarea" draggable="false">+</button>`}
        <span class="col-drag-handle" title="Mover columna">⠿</span>
      </div>
      <div class="kanban-col-body" data-col="${esc(col.name)}"></div>
    `;

    // ── Column drag-to-reorder ────────────────────────────────────────────
    const colHeader = colEl.querySelector('.kanban-col-header');
    colHeader.addEventListener('dragstart', e => {
      draggedColName = col.name;
      colEl.classList.add('col-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation();
    });
    colHeader.addEventListener('dragend', () => {
      colEl.classList.remove('col-dragging');
      document.querySelectorAll('.kanban-col.col-drag-over').forEach(c => c.classList.remove('col-drag-over'));
      draggedColName = null;
    });
    colEl.addEventListener('dragover', e => {
      if (!draggedColName || draggedColName === col.name) return;
      e.preventDefault();
      colEl.classList.add('col-drag-over');
    });
    colEl.addEventListener('dragleave', e => {
      if (!colEl.contains(e.relatedTarget)) colEl.classList.remove('col-drag-over');
    });
    colEl.addEventListener('drop', async e => {
      colEl.classList.remove('col-drag-over');
      if (!draggedColName || draggedColName === col.name) return;
      e.preventDefault(); e.stopPropagation();
      const fromIdx = kanbanColumns.findIndex(c => c.name === draggedColName);
      const toIdx   = kanbanColumns.findIndex(c => c.name === col.name);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = kanbanColumns.splice(fromIdx, 1);
      kanbanColumns.splice(toIdx, 0, moved);
      renderKanban();
      try { await saveKanbanConfig(); } catch {}
    });

    const colBody = colEl.querySelector('.kanban-col-body');

    colTasks.forEach(task => {
      const due = fmtDue(task.dueDate);
      const tl  = getTrafficLight(task.dueDate);
      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.setAttribute('draggable', 'true');
      card.dataset.id  = task.id;

      const subtasksBullets = (task.subtasks || []).map(s => {
        const sdue = s.dueDate ? `<span class="subtask-bullet-date">${fmtDueShort(s.dueDate)}</span>` : '';
        return `<div class="subtask-bullet${s.done ? ' done' : ''}">• ${esc(s.text)}${sdue}</div>`;
      }).join('');

      card.innerHTML = `
        <div class="kanban-card-area">${esc(task.area)}${task.priority ? `<span class="kanban-card-priority kanban-priority-${esc(task.priority)}">${PRIORITY_LABELS[task.priority] || ''}</span>` : ''}</div>
        <div class="kanban-card-title">${esc(task.title)}</div>
        ${task.desc ? `<div class="kanban-card-desc">${esc(task.desc)}</div>` : ''}
        ${subtasksBullets ? `<div class="kanban-card-subtasks">${subtasksBullets}</div>` : ''}
        ${due.text   ? `<div class="kanban-card-due ${due.cls}">${due.text}</div>` : ''}
        <div class="kanban-card-footer">
          <span class="kanban-card-hint">doble clic = ver detalle</span>
          <div style="display:flex;gap:4px">
            <button data-edit="${task.id}" title="Editar">${ICON_EDIT}</button>
            <button data-del="${task.id}" data-row="${task.rowIndex}" title="Eliminar">${ICON_TRASH}</button>
          </div>
        </div>
        ${tl ? `<div class="kanban-traffic-bar ${tl.cls}" title="${tl.tip}"></div>` : ''}
      `;

      card.addEventListener('dblclick', (e) => {
        if (e.target.closest('button')) return;
        openTaskDetail(task.id);
      });

      card.addEventListener('touchend', (e) => {
        if (e.target.closest('button') || wasAccidentalTouch()) return;
        const now = Date.now();
        const last = lastTapTime[task.id] || 0;
        lastTapTime[task.id] = now;
        if (now - last < 350) openTaskDetail(task.id);
      });

      card.addEventListener('dragstart', e => {
        if (draggedColName) { e.preventDefault(); return; }
        draggedId = task.id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        draggedId = null;
      });

      colBody.appendChild(card);
    });

    colEl.addEventListener('dragover', e => {
      if (draggedColName || !draggedId) return; // column drag takes priority
      e.preventDefault();
    });
    colEl.addEventListener('drop', async e => {
      if (!draggedId) return;
      e.preventDefault();
      const newStatus = col.name;
      const task = kanbanTasks.find(t => t.id === draggedId);
      if (!task || task.status === newStatus) return;
      if (TERMINAL_STATES.includes(newStatus)) {
        if (!confirm(`¿Finalizar la tarea como "${newStatus}"?`)) return;
      }
      const prevStatus = task.status;
      task.status = newStatus;
      if (TERMINAL_STATES.includes(newStatus)) stopTaskTimer(task);
      renderKanban();
      try {
        await updateKanbanTask(task);
        pushUndo(async () => {
          const t = kanbanTasks.find(x => x.id === task.id);
          if (!t) return;
          t.status = prevStatus;
          await updateKanbanTask(t);
          renderCurrentSubTab();
        });
      }
      catch (err) { alert('Error al guardar: ' + err.message); await loadKanbanTasks(); renderKanban(); }
    });

    board.appendChild(colEl);
  });

  const termCount = kanbanTasks.filter(t => TERMINAL_STATES.includes(t.status)).length;
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'kanban-toggle-terminal';
  toggleBtn.textContent = showTerminal
    ? '⬆️ Ocultar finalizadas'
    : `⬇️ Finalizadas (${termCount})`;
  toggleBtn.addEventListener('click', () => { showTerminal = !showTerminal; renderKanban(); });
  board.appendChild(toggleBtn);

  board.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openTaskModal(null, btn.dataset.edit));
  });
  board.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta tarea?')) return;
      btn.disabled = true;
      try {
        await deleteTaskWithUndo(btn.dataset.del, +btn.dataset.row);
        renderKanban();
      } catch (e) { alert('Error: ' + e.message); btn.disabled = false; }
    });
  });
  board.querySelectorAll('.kanban-add-card-icon').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openTaskModal(btn.dataset.col, null); });
  });
}

// ── Lista Render ──────────────────────────────────────────────────────────────

function renderKanbanList() {
  const container    = document.getElementById('tasksList');
  if (!container) return;
  updateFilterButtonLabel('listaFilterBtn', listaActiveFilters);
  const areaFilter     = listaActiveFilters.area     || '';
  const statusFilter   = listaActiveFilters.status   || '';
  const priorityFilter = listaActiveFilters.priority || '';
  const dueFilter      = listaActiveFilters.due      || '';

  let tasks = [...kanbanTasks];
  if (areaFilter)     tasks = tasks.filter(t => t.area     === areaFilter);
  if (statusFilter)   tasks = tasks.filter(t => t.status   === statusFilter);
  if (priorityFilter) tasks = tasks.filter(t => t.priority === priorityFilter);
  if (dueFilter)      tasks = tasks.filter(t => getDueStatus(t.dueDate) === dueFilter);
  tasks.sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1);

  if (!tasks.length) {
    container.innerHTML = '<div class="empty-state">No hay tareas con estos filtros.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'tasks-table';
  table.innerHTML = `<thead><tr>
    <th>Área</th><th>Tarea</th><th>Estado</th><th>Prioridad</th><th>Fecha límite</th><th>Tiempo</th><th></th>
  </tr></thead><tbody></tbody>`;

  const tbody = table.querySelector('tbody');
  tasks.forEach(task => {
    const col   = kanbanColumns.find(c => c.name === task.status);
    const color = col ? col.color : '#999';
    const due   = fmtDue(task.dueDate);
    const stCount = (task.subtasks || []).length;
    const tr    = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.innerHTML = `
      <td><span style="font-size:12px;color:var(--text-sub)">${esc(task.area)}</span></td>
      <td>
        <strong style="font-size:13px;color:var(--vinotinto);display:block">${esc(task.title)}</strong>
        ${task.desc ? `<span style="font-size:11px;color:var(--text-sub)">${esc(task.desc)}</span>` : ''}
        ${stCount ? `<span style="font-size:11px;color:var(--text-sub)">📋 ${stCount} sub-tarea${stCount !== 1 ? 's' : ''}</span>` : ''}
      </td>
      <td><span class="status-pill" style="background:${color}22;color:${color}">${esc(task.status)}</span></td>
      <td>${task.priority ? `<span class="kanban-card-priority kanban-priority-${esc(task.priority)}">${PRIORITY_LABELS[task.priority] || ''}</span>` : ''}</td>
      <td><span class="kanban-card-due ${due.cls}" style="font-size:12px">${due.text}</span></td>
      <td><span style="font-size:12px;color:var(--text-sub)">${(task.timeSessions || []).length ? fmtDuration(getTaskTotalMs(task)) : '—'}</span></td>
      <td style="white-space:nowrap">
        <button class="task-action-btn" data-view="${task.id}" title="Ver detalle">👁</button>
        <button class="task-action-btn" data-edit="${task.id}" title="Editar">${ICON_EDIT}</button>
        <button class="task-action-btn" data-del="${task.id}" data-row="${task.rowIndex}" title="Eliminar">${ICON_TRASH}</button>
      </td>
    `;
    tr.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      openTaskDetail(task.id);
    });
    tbody.appendChild(tr);
  });

  container.innerHTML = '';
  container.appendChild(table);

  container.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => openTaskDetail(btn.dataset.view));
  });
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openTaskModal(null, btn.dataset.edit));
  });
  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta tarea?')) return;
      btn.disabled = true;
      try {
        await deleteTaskWithUndo(btn.dataset.del, +btn.dataset.row);
        renderKanbanList();
      } catch (e) { alert('Error: ' + e.message); btn.disabled = false; }
    });
  });
}

// ── Calendario Render ────────────────────────────────────────────────────────

function renderCalendar() {
  const wrap = document.getElementById('calendarWrap');
  if (!wrap) return;

  const year  = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const monthLabelEl = document.getElementById('calendarMonthLabel');
  if (monthLabelEl) {
    const label = calendarMonth.toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
    monthLabelEl.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  }

  const firstOfMonth = new Date(year, month, 1);
  const startOffset  = (firstOfMonth.getDay() + 6) % 7; // lunes = 0
  const gridStart    = new Date(year, month, 1 - startOffset);
  const daysInGrid   = 42; // 6 semanas
  const todayISO     = toISODate(new Date());

  const tasksByDate = {};
  kanbanTasks.forEach(t => {
    if (!t.dueDate) return;
    (tasksByDate[t.dueDate] ||= []).push(t);
  });

  const weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const headerHTML = weekdayLabels.map(d => `<div class="calendar-weekday">${d}</div>`).join('');

  let cellsHTML = '';
  for (let i = 0; i < daysInGrid; i++) {
    const d = addDays(gridStart, i);
    const iso = toISODate(d);
    const inMonth = d.getMonth() === month;
    const dayTasks = (tasksByDate[iso] || []).slice().sort((a, b) => (a.title || '') < (b.title || '') ? -1 : 1);
    const chips = dayTasks.map(t => {
      const app = ganttBarAppearance(t);
      const c   = getAreaColor(t.area);
      return `<div class="calendar-chip ${app.cls}" data-task="${esc(t.id)}" style="background:${c.bg};color:${c.text}" title="${esc(t.area)} · ${esc(t.title)}">${esc(t.title)}</div>`;
    }).join('');
    cellsHTML += `
      <div class="calendar-cell${inMonth ? '' : ' calendar-cell--out'}${iso === todayISO ? ' calendar-cell--today' : ''}">
        <div class="calendar-cell-date">${d.getDate()}</div>
        <div class="calendar-cell-chips">${chips}</div>
      </div>`;
  }

  wrap.innerHTML = `
    <div class="calendar-grid">
      <div class="calendar-header-row">${headerHTML}</div>
      <div class="calendar-body">${cellsHTML}</div>
    </div>
  `;

  wrap.querySelectorAll('[data-task]').forEach(el => {
    el.addEventListener('click', () => openTaskDetail(el.dataset.task));
  });
}

// ── Gantt render engine ───────────────────────────────────────────────────────

const GANTT_UNIT_WIDTH = { day: 60, week: 22, month: 6 };

function parseISODate(s) { return new Date(s + 'T00:00:00'); }
function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function diffDays(a, b) { return Math.round((b - a) / 86400000); }

// ── Dependencias entre tareas ─────────────────────────────────────────────────

function getTransitiveDependents(taskId, tasks) {
  const result = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    tasks.forEach(t => {
      if (!result.has(t.id) && (t.dependsOn || []).some(id => id === taskId || result.has(id))) {
        result.add(t.id);
        changed = true;
      }
    });
  }
  return result;
}

function cascadeDependencyShift(changedTask, projectTasks, visited = new Set()) {
  if (visited.has(changedTask.id)) return [];
  visited.add(changedTask.id);
  const changedEnd = parseISODate(changedTask.dueDate);
  const moved = [];
  projectTasks
    .filter(t => (t.dependsOn || []).includes(changedTask.id))
    .forEach(dep => {
      const depStart = parseISODate(dep.startDate || dep.dueDate);
      if (depStart < changedEnd) {
        const dur = diffDays(parseISODate(dep.startDate || dep.dueDate), parseISODate(dep.dueDate || dep.startDate));
        dep.startDate = toISODate(changedEnd);
        dep.dueDate   = toISODate(addDays(changedEnd, dur));
        moved.push(dep, ...cascadeDependencyShift(dep, projectTasks, visited));
      }
    });
  return moved;
}

async function applyCascade(changedTask) {
  const projectTasks = kanbanTasks.filter(t => t.projectId === changedTask.projectId);
  const moved = cascadeDependencyShift(changedTask, projectTasks);
  for (const t of moved) await updateKanbanTask(t);
  return moved;
}

// ── Cronómetro por tarea ──────────────────────────────────────────────────────

let taskTimerInterval = null;

function isTimerRunning(task) {
  const sessions = task.timeSessions || [];
  const last = sessions[sessions.length - 1];
  return !!last && !last.end;
}

function getTaskTotalMs(task) {
  return (task.timeSessions || []).reduce((sum, s) =>
    sum + ((s.end ? new Date(s.end) : new Date()) - new Date(s.start)), 0);
}

function fmtDuration(ms) {
  if (!ms || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getInProgressColumnName() {
  const named = kanbanColumns.find(c => !c.terminal && c.name.trim().toLowerCase() === 'en proceso');
  if (named) return named.name;
  const nonTerm = kanbanColumns.filter(c => !c.terminal);
  return (nonTerm[1] || nonTerm[0])?.name || null;
}

function stopTaskTimer(task) {
  const sessions = task.timeSessions || [];
  const last = sessions[sessions.length - 1];
  if (last && !last.end) last.end = new Date().toISOString();
}

function startTaskTimerClock(task) {
  stopTaskTimerClock();
  const el = document.getElementById('taskTimerTotal');
  if (!el) return;
  const update = () => { el.textContent = fmtDuration(getTaskTotalMs(task)); };
  update();
  taskTimerInterval = setInterval(update, 1000);
}

function stopTaskTimerClock() {
  if (taskTimerInterval) { clearInterval(taskTimerInterval); taskTimerInterval = null; }
}

function ganttBarAppearance(task) {
  if (task.status === 'Realizado') return { cls: 'status-done', color: '#2E7D32', icon: '✓ ' };
  if (TERMINAL_STATES.includes(task.status)) return { cls: 'status-dimmed', color: '#546E7A', icon: '' };
  const col = kanbanColumns.find(c => c.name === task.status);
  return { cls: '', color: col ? col.color : '#999', icon: '' };
}

function renderGanttChart() {
  const projectsBar = document.getElementById('ganttProjectsBar');
  const wrap        = document.getElementById('ganttWrap');
  if (!projectsBar || !wrap) return;

  if (!ganttProjects.length) {
    projectsBar.innerHTML = '';
    wrap.innerHTML = `<div class="empty-state">Aún no hay proyectos Gantt.<br/><button class="btn-primary" id="ganttEmptyAddProject" style="margin-top:12px">+ Nuevo proyecto</button></div>`;
    document.getElementById('ganttEmptyAddProject')?.addEventListener('click', () => document.getElementById('btnManageGanttProjects').click());
    return;
  }
  if (!currentGanttProjectId || !ganttProjects.find(p => p.id === currentGanttProjectId))
    currentGanttProjectId = ganttProjects[0].id;

  projectsBar.innerHTML = ganttProjects.map(p => `
    <button type="button" class="gantt-project-chip${p.id === currentGanttProjectId ? ' active' : ''}" data-project="${esc(p.id)}">
      <span class="gantt-project-chip-dot" style="background:${esc(p.color)}"></span>${esc(p.name)}
    </button>
  `).join('') + `<button type="button" class="gantt-project-chip gantt-project-chip-add" id="ganttAddProjectChip">+ Proyecto</button>`;

  projectsBar.querySelectorAll('[data-project]').forEach(btn => {
    btn.addEventListener('click', () => { currentGanttProjectId = btn.dataset.project; renderGanttChart(); });
  });
  document.getElementById('ganttAddProjectChip').addEventListener('click', () => document.getElementById('btnManageGanttProjects').click());

  const tasks = kanbanTasks
    .filter(t => t.projectId === currentGanttProjectId)
    .slice()
    .sort((a, b) => {
      const hasA = a.sortOrder !== null && a.sortOrder !== undefined;
      const hasB = b.sortOrder !== null && b.sortOrder !== undefined;
      if (hasA && hasB) return a.sortOrder - b.sortOrder;
      if (hasA) return -1;
      if (hasB) return 1;
      return (a.startDate || '9999') < (b.startDate || '9999') ? -1 : 1;
    });

  if (!tasks.length) {
    wrap.innerHTML = `<div class="empty-state">Este proyecto aún no tiene tareas.<br/><button class="btn-primary" id="ganttEmptyAddTask" style="margin-top:12px">+ Nueva tarea</button></div>`;
    document.getElementById('ganttEmptyAddTask')?.addEventListener('click', () => openTaskModal(null, null, currentGanttProjectId));
    return;
  }

  const unitWidth = GANTT_UNIT_WIDTH[ganttZoom] || GANTT_UNIT_WIDTH.week;
  const todayD    = new Date(); todayD.setHours(0, 0, 0, 0);

  let minDate = tasks.reduce((m, t) => { const d = parseISODate(t.startDate || t.dueDate); return !m || d < m ? d : m; }, null);
  let maxDate = tasks.reduce((m, t) => { const d = parseISODate(t.dueDate || t.startDate); return !m || d > m ? d : m; }, null);
  if (todayD < minDate) minDate = todayD;
  if (todayD > maxDate) maxDate = todayD;

  const pad = ganttZoom === 'month' ? 30 : ganttZoom === 'week' ? 7 : 3;
  minDate = addDays(minDate, -pad);
  maxDate = addDays(maxDate, pad);
  const totalDays     = diffDays(minDate, maxDate) + 1;
  const timelineWidth = totalDays * unitWidth;

  let headerHTML = '';
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(minDate, i);
    if (ganttZoom === 'day') {
      headerHTML += `<div class="gantt-header-cell" style="width:${unitWidth}px">${d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', timeZone: 'America/Bogota' })}</div>`;
    } else if (ganttZoom === 'week') {
      const isStart = d.getDay() === 1;
      headerHTML += `<div class="gantt-header-cell gantt-header-cell--thin${isStart ? ' gantt-mark-start' : ''}" style="width:${unitWidth}px">${isStart ? d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' }) : ''}</div>`;
    } else {
      const isStart = d.getDate() === 1;
      headerHTML += `<div class="gantt-header-cell gantt-header-cell--thin${isStart ? ' gantt-mark-start' : ''}" style="width:${unitWidth}px">${isStart ? d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit', timeZone: 'America/Bogota' }) : ''}</div>`;
    }
  }

  const todayOffset = diffDays(minDate, todayD);
  const todayLine = (todayOffset >= 0 && todayOffset < totalDays)
    ? `<div class="gantt-today-line" style="left:${todayOffset * unitWidth}px"></div>` : '';

  // ── Agrupar tareas por área ────────────────────────────────────────────────
  const GROUP_ROW_H = 32, TASK_ROW_H = 40;
  const areaOrder = [];
  kanbanAreas.forEach(a => { if (tasks.some(t => t.area === a)) areaOrder.push(a); });
  tasks.forEach(t => { if (t.area && !areaOrder.includes(t.area)) areaOrder.push(t.area); });
  if (tasks.some(t => !t.area)) areaOrder.push('');

  const displayItems = [];
  areaOrder.forEach(area => {
    const groupTasks = tasks.filter(t => (t.area || '') === area);
    if (!groupTasks.length) return;
    const areaKey = area || 'Sin área';
    displayItems.push({ type: 'group', area, areaKey, count: groupTasks.length, collapsed: ganttCollapsedAreas.has(areaKey) });
    if (!ganttCollapsedAreas.has(areaKey)) groupTasks.forEach(t => displayItems.push({ type: 'task', task: t }));
  });

  let curY = 0;
  const barGeom = {};
  displayItems.forEach(item => {
    if (item.type === 'group') { curY += GROUP_ROW_H; return; }
    const t = item.task;
    const s = parseISODate(t.startDate || t.dueDate);
    const e = parseISODate(t.dueDate || t.startDate);
    const left  = diffDays(minDate, s) * unitWidth;
    const width = Math.max(unitWidth * 0.6, (diffDays(s, e) + 1) * unitWidth - 2);
    barGeom[t.id] = { left, width, y: curY };
    curY += TASK_ROW_H;
  });
  const totalRowsHeight = curY;

  const sidebarHTML = displayItems.map(item => {
    if (item.type === 'group') {
      const c = getAreaColor(item.areaKey);
      return `
        <div class="gantt-group-row" data-area-toggle="${esc(item.areaKey)}" style="background:${c.bg};color:${c.text}">
          <span class="gantt-group-chevron">${item.collapsed ? '▸' : '▾'}</span>
          <span class="gantt-group-name">${esc(item.areaKey)}</span>
          <span class="gantt-group-count">${item.count}</span>
        </div>`;
    }
    const t = item.task;
    return `<div class="gantt-row-label" draggable="true" data-task="${esc(t.id)}" title="Arrastra para reordenar · ${esc(t.title)}">${esc(t.title)}</div>`;
  }).join('');

  const rowsHTML = displayItems.map(item => {
    if (item.type === 'group') {
      const c = getAreaColor(item.areaKey);
      return `<div class="gantt-group-band" style="background:${c.bg}"></div>`;
    }
    const t   = item.task;
    const geom = barGeom[t.id];
    const app = ganttBarAppearance(t);
    return `
      <div class="gantt-row">
        <div class="gantt-bar ${app.cls}" data-task="${esc(t.id)}" style="left:${geom.left}px;width:${geom.width}px;background:${app.color}">
          <div class="gantt-bar-handle gantt-bar-handle--left" data-handle="start"></div>
          <span class="gantt-bar-label">${app.icon}${esc(t.title)}</span>
          <button type="button" class="gantt-bar-done" data-done="${esc(t.id)}" title="Marcar como Realizado">✓</button>
          <div class="gantt-bar-handle gantt-bar-handle--right" data-handle="end"></div>
          <div class="gantt-bar-connect" title="Arrastra para conectar con otra tarea"></div>
        </div>
      </div>`;
  }).join('');

  let depsPaths = '';
  tasks.forEach(t => {
    (t.dependsOn || []).forEach(predId => {
      const pred = barGeom[predId];
      const dep  = barGeom[t.id];
      if (!pred || !dep) return;
      const x1 = pred.left + pred.width, y1 = pred.y + 20;
      const x2 = dep.left,               y2 = dep.y + 20;
      const midX = x1 + Math.max(10, (x2 - x1) / 2);
      depsPaths += `<path d="M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}" class="gantt-dep-path" marker-end="url(#ganttArrow)"/>`;
    });
  });
  const depsSvg = depsPaths
    ? `<svg class="gantt-deps-svg" width="${timelineWidth}" height="${totalRowsHeight}">
        <defs><marker id="ganttArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" class="gantt-dep-arrowhead"/>
        </marker></defs>
        ${depsPaths}
      </svg>`
    : '';

  wrap.innerHTML = `
    <div class="gantt-grid">
      <div class="gantt-sidebar">
        <div class="gantt-sidebar-header"></div>
        ${sidebarHTML}
      </div>
      <div class="gantt-timeline" id="ganttTimelineScroll">
        <div class="gantt-timeline-inner" style="width:${timelineWidth}px">
          <div class="gantt-header-row">${headerHTML}</div>
          <div class="gantt-bars" style="width:${timelineWidth}px">
            ${depsSvg}
            ${todayLine}
            ${rowsHTML}
          </div>
        </div>
      </div>
    </div>
  `;

  wireGanttBarInteractions(tasks, unitWidth);
  wireGanttRowReorder(tasks);

  document.querySelectorAll('[data-area-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.areaToggle;
      if (ganttCollapsedAreas.has(key)) ganttCollapsedAreas.delete(key);
      else ganttCollapsedAreas.add(key);
      renderGanttChart();
    });
  });

  const scrollEl = document.getElementById('ganttTimelineScroll');
  if (scrollEl) scrollEl.scrollLeft = Math.max(0, todayOffset * unitWidth - 200);
}

function wireGanttRowReorder(tasks) {
  let draggedGanttTaskId = null;

  document.querySelectorAll('.gantt-row-label').forEach(label => {
    label.addEventListener('dragstart', e => {
      draggedGanttTaskId = label.dataset.task;
      label.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    label.addEventListener('dragend', () => {
      label.classList.remove('dragging');
      document.querySelectorAll('.gantt-row-label.drag-over-top, .gantt-row-label.drag-over-bottom')
        .forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
      draggedGanttTaskId = null;
    });
    label.addEventListener('dragover', e => {
      if (!draggedGanttTaskId || draggedGanttTaskId === label.dataset.task) return;
      e.preventDefault();
      const rect = label.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      label.classList.toggle('drag-over-top', before);
      label.classList.toggle('drag-over-bottom', !before);
    });
    label.addEventListener('dragleave', () => {
      label.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    label.addEventListener('drop', async e => {
      if (!draggedGanttTaskId || draggedGanttTaskId === label.dataset.task) return;
      e.preventDefault();
      const before = label.classList.contains('drag-over-top');
      label.classList.remove('drag-over-top', 'drag-over-bottom');

      const fromIdx = tasks.findIndex(t => t.id === draggedGanttTaskId);
      let toIdx     = tasks.findIndex(t => t.id === label.dataset.task);
      if (fromIdx === -1 || toIdx === -1) return;

      const reordered = tasks.slice();
      const [moved] = reordered.splice(fromIdx, 1);
      toIdx = reordered.findIndex(t => t.id === label.dataset.task);
      reordered.splice(before ? toIdx : toIdx + 1, 0, moved);

      reordered.forEach((t, i) => { t.sortOrder = i; });
      renderGanttChart();
      try {
        for (const t of reordered) await updateKanbanTask(t);
      } catch (err) {
        alert('Error al guardar el orden: ' + err.message);
        await loadKanbanTasks();
        renderGanttChart();
      }
    });
  });
}

function wireGanttBarInteractions(tasks, unitWidth) {
  document.querySelectorAll('.gantt-bar').forEach(barEl => {
    const task = tasks.find(t => t.id === barEl.dataset.task);
    if (!task) return;

    barEl.querySelectorAll('.gantt-bar-handle').forEach(handle => {
      handle.addEventListener('pointerdown', e => {
        e.stopPropagation();
        startGanttDrag(e, task, handle.dataset.handle, barEl, unitWidth);
      });
    });
    barEl.addEventListener('pointerdown', e => {
      if (e.target.closest('.gantt-bar-handle') || e.target.closest('.gantt-bar-done') || e.target.closest('.gantt-bar-connect')) return;
      startGanttDrag(e, task, 'move', barEl, unitWidth);
    });
    barEl.addEventListener('dblclick', e => {
      if (e.target.closest('.gantt-bar-done') || e.target.closest('.gantt-bar-handle') || e.target.closest('.gantt-bar-connect')) return;
      openTaskDetail(task.id);
    });
    barEl.querySelector('.gantt-bar-connect')?.addEventListener('pointerdown', e => {
      e.stopPropagation();
      startDependencyConnect(e, task, barEl, tasks);
    });
    barEl.querySelector('.gantt-bar-done')?.addEventListener('click', async e => {
      e.stopPropagation();
      if (task.status === 'Realizado') return;
      if (!confirm(`¿Finalizar la tarea como "Realizado"?`)) return;
      const prevStatus = task.status;
      task.status = 'Realizado';
      stopTaskTimer(task);
      try {
        await updateKanbanTask(task);
        renderGanttChart();
        if (currentSubTab === 'kanban') renderKanban();
        pushUndo(async () => {
          const t = kanbanTasks.find(x => x.id === task.id);
          if (!t) return;
          t.status = prevStatus;
          await updateKanbanTask(t);
          renderCurrentSubTab();
        });
      } catch (err) { alert('Error al guardar: ' + err.message); await loadKanbanTasks(); renderGanttChart(); }
    });
  });
}

function startGanttDrag(e, task, mode, barEl, unitWidth) {
  e.preventDefault();
  const startX    = e.clientX;
  const origStart = parseISODate(task.startDate || task.dueDate);
  const origEnd   = parseISODate(task.dueDate || task.startDate);
  const origLeft  = parseFloat(barEl.style.left);
  const origWidth = parseFloat(barEl.style.width);
  barEl.setPointerCapture(e.pointerId);
  barEl.classList.add('dragging');
  let deltaDays = 0;

  function onMove(ev) {
    deltaDays = Math.round((ev.clientX - startX) / unitWidth);
    if (mode === 'move') {
      barEl.style.left = (origLeft + deltaDays * unitWidth) + 'px';
    } else if (mode === 'start') {
      let newLeft  = origLeft + deltaDays * unitWidth;
      let newWidth = origWidth - deltaDays * unitWidth;
      if (newWidth < unitWidth * 0.6) { newWidth = unitWidth * 0.6; newLeft = origLeft + origWidth - newWidth; }
      barEl.style.left  = newLeft + 'px';
      barEl.style.width = newWidth + 'px';
    } else if (mode === 'end') {
      barEl.style.width = Math.max(unitWidth * 0.6, origWidth + deltaDays * unitWidth) + 'px';
    }
  }

  async function onUp(ev) {
    barEl.releasePointerCapture(ev.pointerId);
    barEl.classList.remove('dragging');
    barEl.removeEventListener('pointermove', onMove);
    barEl.removeEventListener('pointerup', onUp);
    barEl.removeEventListener('pointercancel', onUp);
    if (!deltaDays) return;

    let newStart = origStart, newEnd = origEnd;
    if (mode === 'move')  { newStart = addDays(origStart, deltaDays); newEnd = addDays(origEnd, deltaDays); }
    if (mode === 'start') { newStart = addDays(origStart, deltaDays); if (newStart > origEnd) newStart = origEnd; }
    if (mode === 'end')   { newEnd = addDays(origEnd, deltaDays); if (newEnd < origStart) newEnd = origStart; }

    const projectTasksBefore = kanbanTasks
      .filter(t => t.projectId === task.projectId)
      .map(t => ({ id: t.id, startDate: t.startDate, dueDate: t.dueDate }));

    task.startDate = toISODate(newStart);
    task.dueDate    = toISODate(newEnd);
    try {
      await updateKanbanTask(task);
      await applyCascade(task);
      renderGanttChart();
      pushUndo(async () => {
        for (const snap of projectTasksBefore) {
          const t = kanbanTasks.find(x => x.id === snap.id);
          if (!t || (t.startDate === snap.startDate && t.dueDate === snap.dueDate)) continue;
          t.startDate = snap.startDate; t.dueDate = snap.dueDate;
          await updateKanbanTask(t);
        }
        renderCurrentSubTab();
      });
    } catch (err) {
      alert('Error al guardar: ' + err.message);
      await loadKanbanTasks();
      renderGanttChart();
    }
  }

  barEl.addEventListener('pointermove', onMove);
  barEl.addEventListener('pointerup', onUp);
  barEl.addEventListener('pointercancel', onUp);
}

function startDependencyConnect(e, sourceTask, sourceBarEl, tasks) {
  e.preventDefault();
  const barsContainer = sourceBarEl.closest('.gantt-bars');
  if (!barsContainer) return;

  const containerRect = barsContainer.getBoundingClientRect();
  const barRect        = sourceBarEl.getBoundingClientRect();
  const startX = barRect.right - containerRect.left;
  const startY = barRect.top + barRect.height / 2 - containerRect.top;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'gantt-connect-preview');
  svg.setAttribute('width', containerRect.width);
  svg.setAttribute('height', containerRect.height);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', startX); line.setAttribute('y1', startY);
  line.setAttribute('x2', startX); line.setAttribute('y2', startY);
  svg.appendChild(line);
  barsContainer.appendChild(svg);

  const handle = e.target;
  handle.setPointerCapture(e.pointerId);
  let hoveredBar = null;

  function onMove(ev) {
    const x = ev.clientX - containerRect.left;
    const y = ev.clientY - containerRect.top;
    line.setAttribute('x2', x);
    line.setAttribute('y2', y);

    const barUnder = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.gantt-bar');
    const valid = barUnder && barUnder !== sourceBarEl ? barUnder : null;
    if (valid !== hoveredBar) {
      hoveredBar?.classList.remove('connect-target');
      hoveredBar = valid;
      hoveredBar?.classList.add('connect-target');
    }
  }

  async function onUp(ev) {
    handle.releasePointerCapture(ev.pointerId);
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onUp);
    hoveredBar?.classList.remove('connect-target');
    svg.remove();

    const targetBarEl = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.gantt-bar');
    if (!targetBarEl || targetBarEl === sourceBarEl) return;
    const targetTask = tasks.find(t => t.id === targetBarEl.dataset.task);
    if (!targetTask || (targetTask.dependsOn || []).includes(sourceTask.id)) return;

    const projectTasks = kanbanTasks.filter(t => t.projectId === sourceTask.projectId);
    if (getTransitiveDependents(targetTask.id, projectTasks).has(sourceTask.id)) {
      alert('No se puede conectar: crearía una dependencia circular.');
      return;
    }

    targetTask.dependsOn = [...new Set([...(targetTask.dependsOn || []), sourceTask.id])];
    try {
      await updateKanbanTask(targetTask);
      await applyCascade(sourceTask);
      renderGanttChart();
    } catch (err) {
      alert('Error al guardar: ' + err.message);
      await loadKanbanTasks();
      renderGanttChart();
    }
  }

  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onUp);
}

// ── Selects population ────────────────────────────────────────────────────────

function populateAreaSelects() {
  const taskAreaEl = document.getElementById('taskArea');
  if (taskAreaEl) {
    const cur = taskAreaEl.value;
    taskAreaEl.innerHTML = kanbanAreas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
    if (cur) taskAreaEl.value = cur;
  }
}

function populateStatusSelects() {
  const taskStatusEl = document.getElementById('taskStatus');
  if (taskStatusEl) {
    const cur = taskStatusEl.value;
    taskStatusEl.innerHTML = kanbanColumns.map(c =>
      `<option value="${esc(c.name)}">${esc(c.name)}${c.terminal ? ' ✓' : ''}</option>`
    ).join('');
    if (cur) taskStatusEl.value = cur;
  }
}

function populateProjectSelects() {
  const taskProjectEl = document.getElementById('taskProject');
  if (taskProjectEl) {
    const cur = taskProjectEl.value;
    taskProjectEl.innerHTML = `<option value="">Ninguno</option>` +
      ganttProjects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    if (cur) taskProjectEl.value = cur;
  }
}

// ── Filtros personalizados (Kanban / Lista) ───────────────────────────────────

const FILTER_FIELDS = {
  area: {
    label: 'Área',
    getOptions: () => kanbanAreas.map(a => ({ value: a, label: a }))
  },
  status: {
    label: 'Estado',
    getOptions: () => kanbanColumns.map(c => ({ value: c.name, label: c.name }))
  },
  priority: {
    label: 'Prioridad',
    getOptions: () => ([
      { value: 'alta',  label: '🔴 Alta' },
      { value: 'media', label: '🟡 Media' },
      { value: 'baja',  label: '🟢 Baja' }
    ])
  },
  due: {
    label: 'Fecha límite',
    getOptions: () => ([
      { value: 'vencido',   label: '⚠️ Vencidos' },
      { value: 'hoy',       label: '🔴 Hoy' },
      { value: 'porVencer', label: '🟡 Por vencer' }
    ])
  }
};

function loadSavedFilters(scope) {
  return safeParseJSON(localStorage.getItem(`ss_savedFilters_${scope}`), []);
}
function persistSavedFilters(scope, list) {
  localStorage.setItem(`ss_savedFilters_${scope}`, JSON.stringify(list));
}

function updateFilterButtonLabel(btnId, activeFilters) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const count = Object.values(activeFilters).filter(Boolean).length;
  btn.textContent = count ? `Filtros (${count})` : 'Filtros';
  btn.classList.toggle('filter-btn--active', count > 0);
}

function closeFilterPanel() {
  document.querySelectorAll('.filter-panel').forEach(p => p.remove());
  if (window._filterPanelCleanup) { window._filterPanelCleanup(); window._filterPanelCleanup = null; }
}

function openFilterPanel(anchorEl, { scope, fieldKeys, activeFilters, onApply }) {
  closeFilterPanel();

  const pop = document.createElement('div');
  pop.className = 'filter-panel';
  document.body.appendChild(pop);

  function render() {
    const usedKeys      = fieldKeys.filter(k => activeFilters[k]);
    const availableKeys = fieldKeys.filter(k => !activeFilters[k]);

    const rowsHTML = usedKeys.map(key => {
      const def  = FILTER_FIELDS[key];
      const opts = def.getOptions();
      const optsHTML = opts.map(o =>
        `<option value="${esc(o.value)}" ${o.value === activeFilters[key] ? 'selected' : ''}>${esc(o.label)}</option>`
      ).join('');
      return `
        <div class="filter-row">
          <span class="filter-row-label">${esc(def.label)}</span>
          <select class="field-select filter-row-select" data-key="${key}">${optsHTML}</select>
          <button type="button" class="filter-row-remove" data-key="${key}" title="Quitar">✕</button>
        </div>`;
    }).join('');

    const addHTML = availableKeys.length ? `
      <select class="field-select" id="filterAddSelect">
        <option value="">+ Agregar filtro…</option>
        ${availableKeys.map(k => `<option value="${k}">${esc(FILTER_FIELDS[k].label)}</option>`).join('')}
      </select>` : '';

    const saved = loadSavedFilters(scope);
    const savedHTML = saved.length ? `
      <div class="filter-panel-subtitle">Filtros guardados</div>
      <div class="filter-saved-list">
        ${saved.map((s, i) => `
          <div class="filter-saved-chip" data-idx="${i}">
            <span class="filter-saved-name">${esc(s.name)}</span>
            <button type="button" class="filter-saved-del" data-idx="${i}" title="Eliminar">✕</button>
          </div>`).join('')}
      </div>` : '';

    const saveRowHTML = usedKeys.length ? `
      <div class="filter-save-row">
        <input type="text" class="field-input" id="filterSaveName" placeholder="Nombre del filtro…" />
        <button type="button" class="btn-outline btn-sm" id="filterSaveBtn">Guardar</button>
      </div>` : '';

    pop.innerHTML = `
      <div class="filter-panel-header">
        <span>Filtros</span>
        ${usedKeys.length ? `<button type="button" class="filter-clear-btn" id="filterClearBtn">Limpiar</button>` : ''}
      </div>
      <div class="filter-rows">${rowsHTML || '<div class="filter-empty">Sin filtros activos.</div>'}</div>
      ${addHTML}
      ${savedHTML}
      ${saveRowHTML}
    `;

    pop.querySelectorAll('.filter-row-select').forEach(sel => {
      sel.addEventListener('change', () => {
        activeFilters[sel.dataset.key] = sel.value;
        onApply(); render();
      });
    });
    pop.querySelectorAll('.filter-row-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        delete activeFilters[btn.dataset.key];
        onApply(); render();
      });
    });
    pop.querySelector('#filterAddSelect')?.addEventListener('change', function() {
      const key = this.value;
      if (!key) return;
      const firstOpt = FILTER_FIELDS[key].getOptions()[0];
      activeFilters[key] = firstOpt ? firstOpt.value : '';
      onApply(); render();
    });
    pop.querySelector('#filterClearBtn')?.addEventListener('click', () => {
      fieldKeys.forEach(k => delete activeFilters[k]);
      onApply(); render();
    });
    pop.querySelector('#filterSaveBtn')?.addEventListener('click', () => {
      const nameInput = pop.querySelector('#filterSaveName');
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      const list = loadSavedFilters(scope);
      list.push({ name, filters: { ...activeFilters } });
      persistSavedFilters(scope, list);
      render();
    });
    pop.querySelectorAll('.filter-saved-chip').forEach(chip => {
      chip.addEventListener('click', e => {
        if (e.target.closest('.filter-saved-del')) return;
        const preset = loadSavedFilters(scope)[+chip.dataset.idx];
        if (!preset) return;
        fieldKeys.forEach(k => delete activeFilters[k]);
        Object.assign(activeFilters, preset.filters);
        onApply(); render();
      });
    });
    pop.querySelectorAll('.filter-saved-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const list = loadSavedFilters(scope);
        list.splice(+btn.dataset.idx, 1);
        persistSavedFilters(scope, list);
        render();
      });
    });
  }

  render();

  const rect = anchorEl.getBoundingClientRect();
  pop.style.top  = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 420)) + 'px';
  pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 300)) + 'px';

  function onDocClick(e) {
    if (!pop.contains(e.target) && e.target !== anchorEl) closeFilterPanel();
  }
  function onKeydown(e) { if (e.key === 'Escape') closeFilterPanel(); }
  setTimeout(() => {
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeydown);
  }, 0);

  window._filterPanelCleanup = () => {
    document.removeEventListener('mousedown', onDocClick);
    document.removeEventListener('keydown', onKeydown);
  };
}

function toggleTaskStartVisibility() {
  const hasProject = !!document.getElementById('taskProject').value;
  document.getElementById('taskStartWrap').style.display = hasProject ? '' : 'none';
  updateTaskDatesTrigger();
}

function fmtDateShortEs(iso) {
  if (!iso) return '';
  return parseISODate(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
}

function updateTaskDatesTrigger() {
  const trigger = document.getElementById('taskDatesTrigger');
  const label   = document.getElementById('taskDatesLabel');
  if (!trigger || !label) return;
  const hasProject = !!document.getElementById('taskProject').value;
  const due   = document.getElementById('taskDue').value;
  const start = document.getElementById('taskStart').value;
  if (hasProject) {
    label.textContent   = 'Fechas de la tarea (inicio y fin) *';
    trigger.textContent = (start && due) ? `${fmtDateShortEs(start)} → ${fmtDateShortEs(due)}` : 'Elegir fechas…';
  } else {
    label.textContent   = 'Fecha límite de la tarea *';
    trigger.textContent = due ? fmtDateShortEs(due) : 'Elegir fecha…';
  }
}

document.getElementById('taskDatesTrigger').addEventListener('click', () => {
  const dueInput = document.getElementById('taskDue');
  if (dueInput.disabled) return;
  const hasProject  = !!document.getElementById('taskProject').value;
  const startInput  = document.getElementById('taskStart');
  const today       = toISODate(new Date());
  openCalendarPopover(document.getElementById('taskDatesTrigger'), {
    mode:  hasProject ? 'range' : 'single',
    start: startInput.value || today,
    end:   dueInput.value || today,
    onApply: (start, end) => {
      if (hasProject) startInput.value = start;
      dueInput.value = end;
      updateTaskDatesTrigger();
      if (!kanbanEditId) saveTaskDraft();
    }
  });
});

// ── Calendario de selección de fechas (popover) ───────────────────────────────

function closeCalendarPopover() {
  document.querySelectorAll('.cal-popover').forEach(p => p.remove());
  if (window._calPopoverCleanup) { window._calPopoverCleanup(); window._calPopoverCleanup = null; }
}

function openCalendarPopover(anchorEl, { mode, start, end, onApply }) {
  closeCalendarPopover();

  const pop = document.createElement('div');
  pop.className = 'cal-popover';
  document.body.appendChild(pop);

  let selStart = start, selEnd = end;
  let rangeAnchor = null;
  let viewMonth = parseISODate(selEnd || selStart || toISODate(new Date()));
  viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);

  function render() {
    const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
    const monthLabel = viewMonth.toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
    const firstOfMonth = new Date(y, m, 1);
    const startOffset  = (firstOfMonth.getDay() + 6) % 7; // lunes = 0
    const gridStart    = new Date(y, m, 1 - startOffset);
    const todayISO     = toISODate(new Date());

    let daysHTML = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      const iso = toISODate(d);
      const inMonth  = d.getMonth() === m;
      const isSel    = mode === 'single' ? iso === selEnd : (iso === selStart || iso === selEnd);
      const inRange  = mode === 'range' && selStart && selEnd && iso > selStart && iso < selEnd;
      daysHTML += `<button type="button" class="cal-day${inMonth ? '' : ' cal-day--out'}${iso === todayISO ? ' cal-day--today' : ''}${isSel ? ' cal-day--selected' : ''}${inRange ? ' cal-day--in-range' : ''}" data-date="${iso}">${d.getDate()}</button>`;
    }

    const hint = mode === 'range' ? (rangeAnchor ? 'Elige la fecha final' : 'Elige la fecha de inicio') : '';

    pop.innerHTML = `
      <div class="cal-popover-header">
        <button type="button" class="cal-nav-btn" data-nav="-1">‹</button>
        <span class="cal-popover-title">${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</span>
        <button type="button" class="cal-nav-btn" data-nav="1">›</button>
      </div>
      <div class="cal-weekdays"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div>
      <div class="cal-days">${daysHTML}</div>
      ${hint ? `<div class="cal-popover-footer">${hint}</div>` : ''}
    `;

    pop.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + Number(btn.dataset.nav), 1);
        render();
      });
    });
    pop.querySelectorAll('.cal-day').forEach(btn => {
      btn.addEventListener('click', () => {
        const iso = btn.dataset.date;
        if (mode === 'single') {
          closeCalendarPopover();
          onApply(iso, iso);
          return;
        }
        if (!rangeAnchor) {
          rangeAnchor = iso;
          selStart = selEnd = iso;
          render();
        } else {
          const finalStart = iso < rangeAnchor ? iso : rangeAnchor;
          const finalEnd   = iso < rangeAnchor ? rangeAnchor : iso;
          closeCalendarPopover();
          onApply(finalStart, finalEnd);
        }
      });
    });
  }

  render();

  const rect = anchorEl.getBoundingClientRect();
  pop.style.top  = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 340)) + 'px';
  pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 280)) + 'px';

  function onDocClick(e) {
    if (!pop.contains(e.target) && e.target !== anchorEl) closeCalendarPopover();
  }
  function onKeydown(e) { if (e.key === 'Escape') closeCalendarPopover(); }
  setTimeout(() => {
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeydown);
  }, 0);

  window._calPopoverCleanup = () => {
    document.removeEventListener('mousedown', onDocClick);
    document.removeEventListener('keydown', onKeydown);
  };
}

function renderDependsChecklist(projectId, excludeTaskId, checkedIds) {
  const wrap      = document.getElementById('taskDependsWrap');
  const container = document.getElementById('taskDependsList');
  if (!wrap || !container) return;
  if (!projectId) { wrap.style.display = 'none'; container.innerHTML = ''; return; }
  wrap.style.display = '';

  const projectTasks = kanbanTasks.filter(t => t.projectId === projectId && t.id !== excludeTaskId);
  const blocked = excludeTaskId
    ? getTransitiveDependents(excludeTaskId, kanbanTasks.filter(t => t.projectId === projectId))
    : new Set();
  const eligible = projectTasks.filter(t => !blocked.has(t.id));

  if (!eligible.length) {
    container.innerHTML = '<div class="empty-state" style="padding:6px 0;font-size:12px">No hay otras tareas disponibles en este proyecto.</div>';
    return;
  }
  const checked = new Set(checkedIds || []);
  container.innerHTML = eligible.map(t => `
    <label class="task-depends-item">
      <input type="checkbox" value="${esc(t.id)}" ${checked.has(t.id) ? 'checked' : ''}/>
      <span>${esc(t.title)}</span>
    </label>
  `).join('');
}

function collectDependsOn() {
  return Array.from(document.querySelectorAll('#taskDependsList input[type=checkbox]:checked')).map(cb => cb.value);
}

// ── Task modal ────────────────────────────────────────────────────────────────

async function openTaskModal(defaultStatus, editId, defaultProjectId) {
  kanbanEditId = editId || null;
  const overlay = document.getElementById('taskOverlay');
  populateAreaSelects();
  populateStatusSelects();
  if (!ganttProjectsLoaded) await loadGanttProjects();
  populateProjectSelects();

  if (editId) {
    const task = kanbanTasks.find(t => t.id === editId);
    if (!task) return;
    document.getElementById('taskModalTitle').textContent = 'Editar tarea';
    document.getElementById('taskArea').value   = task.area;
    document.getElementById('taskTitle').value  = task.title;
    document.getElementById('taskDesc').value   = task.desc;
    document.getElementById('taskDue').value    = task.dueDate;
    document.getElementById('taskStatus').value = task.status;
    document.getElementById('taskPriority').value = task.priority || '';
    document.getElementById('taskProject').value  = task.projectId || '';
    document.getElementById('taskStart').value    = task.startDate || '';
    renderDependsChecklist(task.projectId || '', task.id, task.dependsOn || []);
    renderSubtasksList(task.subtasks || []);
  } else {
    document.getElementById('taskModalTitle').textContent = 'Nueva tarea';
    const draft = loadTaskDraft();
    if (draft && (draft.title || draft.desc || (draft.subtasks || []).length)) {
      document.getElementById('taskArea').value   = draft.area   || kanbanAreas[0] || '';
      document.getElementById('taskTitle').value  = draft.title  || '';
      document.getElementById('taskDesc').value   = draft.desc   || '';
      document.getElementById('taskDue').value    = draft.due    || toISODate(new Date());
      document.getElementById('taskStatus').value = draft.status || defaultStatus || kanbanColumns.find(c => !c.terminal)?.name || '';
      document.getElementById('taskPriority').value = draft.priority || '';
      document.getElementById('taskProject').value  = draft.project || defaultProjectId || '';
      document.getElementById('taskStart').value     = draft.start   || toISODate(new Date());
      renderDependsChecklist(draft.project || defaultProjectId || '', null, []);
      renderSubtasksList(draft.subtasks || []);
      const fb = document.getElementById('taskFeedback');
      fb.textContent = '↩ Borrador restaurado';
      fb.className   = 'feedback';
      fb.style.color = 'var(--brand)';
    } else {
      document.getElementById('taskArea').value   = kanbanAreas[0] || '';
      document.getElementById('taskTitle').value  = '';
      document.getElementById('taskDesc').value   = '';
      document.getElementById('taskDue').value    = toISODate(new Date());
      const firstNonTerm = kanbanColumns.find(c => !c.terminal);
      document.getElementById('taskStatus').value = defaultStatus || firstNonTerm?.name || '';
      document.getElementById('taskPriority').value = 'alta';
      document.getElementById('taskProject').value  = defaultProjectId || '';
      document.getElementById('taskStart').value     = toISODate(new Date());
      renderDependsChecklist(defaultProjectId || '', null, []);
      renderSubtasksList([]);
      document.getElementById('taskFeedback').textContent = '';
      document.getElementById('taskFeedback').className   = 'feedback';
      document.getElementById('taskFeedback').style.color = '';
    }
  }

  toggleTaskStartVisibility();
  document.getElementById('taskFeedback').textContent = '';
  overlay.classList.add('open');
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
  startTaskAutosave();
}

document.getElementById('taskProject').addEventListener('change', function() {
  toggleTaskStartVisibility();
  renderDependsChecklist(this.value, kanbanEditId, []);
  if (!kanbanEditId) saveTaskDraft();
});

function isTaskFormDirty() {
  const title    = document.getElementById('taskTitle')?.value.trim();
  const desc     = document.getElementById('taskDesc')?.value.trim();
  const subtasks = collectSubtasks();
  return !!(title || desc || subtasks.length);
}

function closeTaskModal() {
  confirmCloseIfDirty('taskOverlay', isTaskFormDirty);
  if (!document.getElementById('taskOverlay').classList.contains('open')) stopTaskAutosave();
}

document.getElementById('btnCloseTask').addEventListener('click', closeTaskModal);
document.getElementById('taskOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('taskOverlay')) closeTaskModal();
});

document.getElementById('btnSaveTask').addEventListener('click', async () => {
  const area     = document.getElementById('taskArea').value;
  const title    = document.getElementById('taskTitle').value.trim();
  const desc     = document.getElementById('taskDesc').value.trim();
  const due      = document.getElementById('taskDue').value;
  const status   = document.getElementById('taskStatus').value;
  const priority = document.getElementById('taskPriority').value;
  const projectId = document.getElementById('taskProject').value;
  const startDate  = document.getElementById('taskStart').value;
  const dependsOn  = projectId ? collectDependsOn() : [];
  const subtasks = collectSubtasks();
  const fb       = document.getElementById('taskFeedback');

  if (!title)    return setFb(fb, 'El título es obligatorio.', 'err');
  if (!due)      return setFb(fb, 'La fecha límite es obligatoria.', 'err');
  if (!priority) return setFb(fb, 'La prioridad es obligatoria.', 'err');
  if (projectId) {
    if (!area)      return setFb(fb, 'El área es obligatoria en tareas de un proyecto Gantt.', 'err');
    if (!startDate) return setFb(fb, 'La fecha de inicio es obligatoria en tareas de un proyecto Gantt.', 'err');
    if (startDate > due) return setFb(fb, 'La fecha de inicio no puede ser posterior a la fecha límite.', 'err');
  }

  const btn = document.getElementById('btnSaveTask');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    let savedId = kanbanEditId;
    let undoSaveFn = null;
    if (kanbanEditId) {
      const task = kanbanTasks.find(t => t.id === kanbanEditId);
      if (task) {
        const prevSnapshot = JSON.parse(JSON.stringify(task));
        task.area = area; task.title = title; task.desc = desc;
        task.dueDate = due; task.status = status; task.subtasks = subtasks;
        task.priority = priority; task.projectId = projectId; task.startDate = projectId ? startDate : '';
        task.dependsOn = dependsOn;
        if (TERMINAL_STATES.includes(status)) stopTaskTimer(task);
        await updateKanbanTask(task);
        undoSaveFn = async () => {
          const t = kanbanTasks.find(x => x.id === prevSnapshot.id);
          if (!t) return;
          Object.assign(t, prevSnapshot);
          await updateKanbanTask(t);
          renderCurrentSubTab();
        };
      }
    } else {
      const now = new Date().toISOString();
      savedId = crypto.randomUUID();
      await appendKanbanTask({
        id: savedId, area, title, desc,
        dueDate: due, status, createdAt: now, updatedAt: now,
        subtasks, observations: [], priority,
        projectId, startDate: projectId ? startDate : '',
        dependsOn, timeSessions: []
      });
      undoSaveFn = async () => {
        const t = kanbanTasks.find(x => x.id === savedId);
        if (!t) return;
        await deleteKanbanTaskRow(t.rowIndex);
        await loadKanbanTasks();
        renderCurrentSubTab();
      };
    }
    clearTaskDraft();
    await loadKanbanTasks();
    if (undoSaveFn) pushUndo(undoSaveFn);

    const savedTask = kanbanTasks.find(t => t.id === savedId);
    if (savedTask && savedTask.projectId) {
      const projectTasks = kanbanTasks.filter(t => t.projectId === savedTask.projectId);
      const moved = [];
      (savedTask.dependsOn || []).forEach(predId => {
        const pred = projectTasks.find(t => t.id === predId);
        if (pred) moved.push(...cascadeDependencyShift(pred, projectTasks));
      });
      if (moved.length) {
        for (const t of moved) await updateKanbanTask(t);
        await loadKanbanTasks();
      }
    }

    document.getElementById('taskOverlay').classList.remove('open');
    stopTaskAutosave();

    renderCurrentSubTab();
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar tarea';
  }
});

// ── Board management modal ────────────────────────────────────────────────────

function renderColsList() {
  const container = document.getElementById('colsList');
  container.innerHTML = kanbanColumns.map(col => `
    <div class="mgmt-item">
      <span class="mgmt-item-dot" style="background:${esc(col.color)}"></span>
      <span class="mgmt-item-name">${esc(col.name)}</span>
      ${col.terminal
        ? '<span class="mgmt-item-tag">Terminal</span>'
        : `<button class="mgmt-item-del" data-del-col="${esc(col.name)}">✕</button>`}
    </div>
  `).join('');

  container.querySelectorAll('[data-del-col]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.delCol;
      if (!confirm(`¿Eliminar el estado "${name}"?`)) return;
      kanbanColumns = kanbanColumns.filter(c => c.name !== name);
      try {
        await saveKanbanConfig();
        renderColsList();
        populateStatusSelects();
        setFb(document.getElementById('boardFeedback'), `✅ Estado eliminado.`, 'ok');
      } catch (e) { setFb(document.getElementById('boardFeedback'), 'Error: ' + e.message, 'err'); }
    });
  });
}

function renderAreasList() {
  const container = document.getElementById('areasList');
  container.innerHTML = kanbanAreas.map(area => `
    <div class="mgmt-item">
      <span class="mgmt-item-name">${esc(area)}</span>
      <button class="mgmt-item-del" data-del-area="${esc(area)}">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-del-area]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.delArea;
      if (!confirm(`¿Eliminar el área "${name}"?`)) return;
      kanbanAreas = kanbanAreas.filter(a => a !== name);
      try {
        await saveKanbanConfig();
        renderAreasList();
        populateAreaSelects();
        setFb(document.getElementById('boardFeedback'), `✅ Área eliminada.`, 'ok');
      } catch (e) { setFb(document.getElementById('boardFeedback'), 'Error: ' + e.message, 'err'); }
    });
  });
}

document.getElementById('btnManageBoard').addEventListener('click', () => {
  renderColsList();
  renderAreasList();
  document.getElementById('boardFeedback').textContent = '';
  document.getElementById('boardOverlay').classList.add('open');
});
function isBoardFormDirty() {
  const colName  = document.getElementById('newColName')?.value.trim();
  const areaName = document.getElementById('newAreaName')?.value.trim();
  return !!(colName || areaName);
}

function closeBoardModal() {
  confirmCloseIfDirty('boardOverlay', isBoardFormDirty);
}

document.getElementById('btnCloseBoard').addEventListener('click', closeBoardModal);
document.getElementById('boardOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('boardOverlay')) closeBoardModal();
});

document.getElementById('btnAddCol').addEventListener('click', async () => {
  const name  = document.getElementById('newColName').value.trim();
  const color = document.getElementById('newColColor').value;
  const fb    = document.getElementById('boardFeedback');
  if (!name) return setFb(fb, 'El nombre del estado es obligatorio.', 'err');
  if (kanbanColumns.find(c => c.name.toLowerCase() === name.toLowerCase()))
    return setFb(fb, 'Ya existe un estado con ese nombre.', 'err');

  kanbanColumns.push({ name, color, terminal: false });
  document.getElementById('newColName').value = '';
  try {
    await saveKanbanConfig();
    renderColsList();
    populateStatusSelects();
    setFb(fb, `✅ Estado "${name}" agregado.`, 'ok');
  } catch (e) { setFb(fb, 'Error: ' + e.message, 'err'); }
});

document.getElementById('btnAddArea').addEventListener('click', async () => {
  const name = document.getElementById('newAreaName').value.trim();
  const fb   = document.getElementById('boardFeedback');
  if (!name) return setFb(fb, 'El nombre del área es obligatorio.', 'err');
  if (kanbanAreas.includes(name)) return setFb(fb, 'Ya existe esa área.', 'err');

  kanbanAreas.push(name);
  document.getElementById('newAreaName').value = '';
  try {
    await saveKanbanConfig();
    renderAreasList();
    populateAreaSelects();
    setFb(fb, `✅ Área "${name}" agregada.`, 'ok');
  } catch (e) { setFb(fb, 'Error: ' + e.message, 'err'); }
});

// ── Gantt projects management modal ─────────────────────────────────────────

function renderGanttProjectsList() {
  const container = document.getElementById('ganttProjectsList');
  if (ganttProjects.length === 0) {
    container.innerHTML = '<div class="empty-state">Aún no hay proyectos.</div>';
    return;
  }
  container.innerHTML = ganttProjects.map(p => `
    <div class="mgmt-item">
      <span class="mgmt-item-dot" style="background:${esc(p.color)}"></span>
      <span class="mgmt-item-name">${esc(p.name)}</span>
      <button class="mgmt-item-del" data-del-project="${esc(p.id)}">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-del-project]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const project = ganttProjects.find(p => p.id === btn.dataset.delProject);
      if (!project) return;
      if (!confirm(`¿Eliminar el proyecto "${project.name}"? Las tareas no se borrarán, quedarán sin proyecto.`)) return;
      const fb = document.getElementById('ganttProjectFeedback');
      try {
        await deleteGanttProject(project.id);
        renderGanttProjectsList();
        populateProjectSelects();
        renderGanttChart();
        setFb(fb, `✅ Proyecto eliminado.`, 'ok');
      } catch (e) { setFb(fb, 'Error: ' + e.message, 'err'); }
    });
  });
}

document.getElementById('btnManageGanttProjects').addEventListener('click', () => {
  renderGanttProjectsList();
  document.getElementById('ganttProjectFeedback').textContent = '';
  document.getElementById('ganttProjectOverlay').classList.add('open');
});
function isGanttProjectFormDirty() {
  return !!document.getElementById('newGanttProjectName')?.value.trim();
}

function closeGanttProjectModal() {
  confirmCloseIfDirty('ganttProjectOverlay', isGanttProjectFormDirty);
}

document.getElementById('btnCloseGanttProjects').addEventListener('click', closeGanttProjectModal);
document.getElementById('ganttProjectOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('ganttProjectOverlay')) closeGanttProjectModal();
});

document.getElementById('btnAddGanttProject').addEventListener('click', async () => {
  const name  = document.getElementById('newGanttProjectName').value.trim();
  const color = document.getElementById('newGanttProjectColor').value;
  const fb    = document.getElementById('ganttProjectFeedback');
  if (!name) return setFb(fb, 'El nombre del proyecto es obligatorio.', 'err');
  if (ganttProjects.find(p => p.name.toLowerCase() === name.toLowerCase()))
    return setFb(fb, 'Ya existe un proyecto con ese nombre.', 'err');

  const project = { id: crypto.randomUUID(), name, color, createdAt: new Date().toISOString() };
  try {
    await appendGanttProject(project);
    await loadGanttProjects();
    if (!currentGanttProjectId) currentGanttProjectId = project.id;
    document.getElementById('newGanttProjectName').value = '';
    renderGanttProjectsList();
    populateProjectSelects();
    renderGanttChart();
    setFb(fb, `✅ Proyecto "${name}" agregado.`, 'ok');
  } catch (e) { setFb(fb, 'Error: ' + e.message, 'err'); }
});

// ── Subtasks (viñetas) helpers ────────────────────────────────────────────────

function renderSubtasksList(items) {
  const container = document.getElementById('subtasksList');
  if (!container) return;
  container.innerHTML = '';
  items.forEach((item, idx) => {
    container.appendChild(buildSubtaskRow(item, idx));
  });
  recalcTaskDueFromSubtasks();
}

function buildSubtaskRow(item, idx) {
  const row = document.createElement('div');
  row.className = 'subtask-item';
  row.dataset.idx = idx;
  row.innerHTML = `
    <span class="subtask-bullet-icon">•</span>
    <input class="subtask-text-input field-input" type="text" value="${esc(item.text || '')}" placeholder="Descripción de la sub-tarea…" />
    <input class="subtask-date-input field-input" type="date" value="${item.dueDate || ''}" title="Fecha límite de esta viñeta" />
    <button class="subtask-remove" title="Quitar">✕</button>
  `;
  row.querySelector('.subtask-remove').addEventListener('click', () => { row.remove(); recalcTaskDueFromSubtasks(); });
  row.querySelector('.subtask-date-input').addEventListener('input', recalcTaskDueFromSubtasks);
  return row;
}

function collectSubtasks() {
  const rows = document.querySelectorAll('#subtasksList .subtask-item');
  return Array.from(rows).map(row => ({
    text:    row.querySelector('.subtask-text-input').value.trim(),
    dueDate: row.querySelector('.subtask-date-input').value || '',
    done:    false
  })).filter(s => s.text);
}

function recalcTaskDueFromSubtasks() {
  const dueInput = document.getElementById('taskDue');
  if (!dueInput) return;
  const dates = Array.from(document.querySelectorAll('#subtasksList .subtask-date-input'))
    .map(el => el.value).filter(Boolean);
  const trigger = document.getElementById('taskDatesTrigger');
  if (dates.length) {
    dueInput.value = dates.reduce((max, d) => d > max ? d : max);
    dueInput.disabled = true;
    dueInput.title = 'Se calcula automáticamente: la fecha más lejana entre las sub-tareas.';
    if (trigger) { trigger.disabled = true; trigger.title = dueInput.title; }
  } else {
    dueInput.disabled = false;
    dueInput.title = '';
    if (trigger) { trigger.disabled = false; trigger.title = ''; }
  }
  updateTaskDatesTrigger();
}

document.getElementById('btnAddSubtask').addEventListener('click', () => {
  const container = document.getElementById('subtasksList');
  const idx = container.querySelectorAll('.subtask-item').length;
  container.appendChild(buildSubtaskRow({ text: '', dueDate: '' }, idx));
  container.lastElementChild.querySelector('.subtask-text-input').focus();
});

// ── Task detail view (read-only + observations) ───────────────────────────────

function openTaskDetail(taskId) {
  const task = kanbanTasks.find(t => t.id === taskId);
  if (!task) return;
  taskDetailId = taskId;

  const col   = kanbanColumns.find(c => c.name === task.status);
  const color = col ? col.color : '#999';
  const due   = fmtDue(task.dueDate);

  const subtasksHTML = (task.subtasks || []).map(s => {
    const range = s.startDate && s.dueDate && s.startDate !== s.dueDate
      ? `${fmtDueShort(s.startDate)} → ${fmtDueShort(s.dueDate)}`
      : (s.dueDate ? fmtDueShort(s.dueDate) : '');
    const sd = range ? `<span class="subtask-bullet-date">${range}</span>` : '';
    return `<div class="detail-subtask-item${s.done ? ' done' : ''}">
      <span class="detail-subtask-bullet">•</span>
      <span>${esc(s.text)}</span>${sd}
    </div>`;
  }).join('');

  const statusOptions = kanbanColumns.map(c =>
    `<option value="${esc(c.name)}" ${c.name === task.status ? 'selected' : ''}>${esc(c.name)}</option>`
  ).join('');

  document.getElementById('taskDetailModalTitle').textContent = task.title;
  document.getElementById('taskDetailContent').innerHTML = `
    <div class="detail-row"><span class="detail-label">Área</span><span class="detail-value">${esc(task.area)}</span></div>
    <div class="detail-row">
      <span class="detail-label">Estado</span>
      <select class="field-select" id="detailStatusSelect" style="font-size:13px;padding:5px 10px">
        ${statusOptions}
      </select>
      <span id="detailStatusSaving" style="font-size:11px;color:var(--text-sub);display:none">Guardando…</span>
    </div>
    <div class="detail-row"><span class="detail-label">Fecha límite</span><span class="kanban-card-due ${due.cls}">${due.text || '—'}</span></div>
    <div class="detail-row">
      <span class="detail-label">Tiempo dedicado</span>
      <span class="detail-timer-total" id="taskTimerTotal">${fmtDuration(getTaskTotalMs(task))}</span>
      <button class="btn-outline btn-sm" id="taskTimerBtn" type="button">${
        (task.timeSessions || []).length === 0 ? '▶ Iniciar tarea' : (isTimerRunning(task) ? '⏸ Pausar' : '▶ Retomar')
      }</button>
    </div>
    ${task.priority ? `<div class="detail-row"><span class="detail-label">Prioridad</span><span class="kanban-card-priority kanban-priority-${esc(task.priority)}">${PRIORITY_LABELS[task.priority] || ''}</span></div>` : ''}
    ${task.desc ? `<div class="detail-row detail-row--col"><span class="detail-label">Descripción</span><span class="detail-value">${esc(task.desc)}</span></div>` : ''}
    <div class="detail-row detail-row--col">
      <span class="detail-label">Sub-tareas</span>
      <div class="detail-subtasks">${subtasksHTML || '<div class="detail-subtask-empty">Sin sub-tareas aún.</div>'}</div>
      <div class="detail-subtask-add">
        <input type="text" id="detailSubtaskText" class="field-input" placeholder="Nueva sub-tarea…" />
        <div class="detail-subtask-add-dates">
          <input type="date" id="detailSubtaskStart" class="field-input" title="Fecha de inicio" />
          <input type="date" id="detailSubtaskEnd" class="field-input" title="Fecha de fin" />
        </div>
        <button class="btn-outline btn-sm" id="btnDetailAddSubtask" type="button">+ Agregar sub-tarea</button>
      </div>
    </div>
    <div class="detail-row detail-row--meta"><span class="detail-label">Creada</span><span class="detail-value">${fmtDate(task.createdAt)}</span></div>
    <div class="detail-row detail-row--meta"><span class="detail-label">Actualizada</span><span class="detail-value">${fmtDate(task.updatedAt)}</span></div>
  `;

  const detailStatusSel = document.getElementById('detailStatusSelect');
  if (detailStatusSel) {
    detailStatusSel.addEventListener('change', async function() {
      const newStatus = this.value;
      const t = kanbanTasks.find(x => x.id === taskDetailId);
      if (!t || t.status === newStatus) return;
      if (TERMINAL_STATES.includes(newStatus) && !confirm(`¿Finalizar la tarea como "${newStatus}"?`)) {
        this.value = t.status;
        return;
      }
      const prev = t.status;
      t.status   = newStatus;
      if (TERMINAL_STATES.includes(newStatus)) stopTaskTimer(t);
      const savingEl = document.getElementById('detailStatusSaving');
      if (savingEl) savingEl.style.display = '';
      try {
        await updateKanbanTask(t);
        openTaskDetail(taskDetailId);
        renderCurrentSubTab();
        pushUndo(async () => {
          const t2 = kanbanTasks.find(x => x.id === t.id);
          if (!t2) return;
          t2.status = prev;
          await updateKanbanTask(t2);
          if (taskDetailId === t2.id) openTaskDetail(taskDetailId);
          renderCurrentSubTab();
        });
      } catch (e) {
        t.status   = prev;
        this.value = prev;
        alert('Error al cambiar estado: ' + e.message);
      } finally {
        if (savingEl) savingEl.style.display = 'none';
      }
    });
  }

  const timerBtn = document.getElementById('taskTimerBtn');
  if (timerBtn) {
    timerBtn.addEventListener('click', async () => {
      const t = kanbanTasks.find(x => x.id === taskDetailId);
      if (!t) return;
      t.timeSessions = t.timeSessions || [];
      const neverStarted = t.timeSessions.length === 0;
      if (isTimerRunning(t)) {
        stopTaskTimer(t);
      } else {
        t.timeSessions.push({ start: new Date().toISOString(), end: null });
        if (neverStarted) {
          const firstNonTerm = kanbanColumns.find(c => !c.terminal);
          if (TERMINAL_STATES.includes(t.status) || t.status === firstNonTerm?.name) {
            const target = getInProgressColumnName();
            if (target) t.status = target;
          }
        }
      }
      timerBtn.disabled = true;
      try {
        await updateKanbanTask(t);
        openTaskDetail(taskDetailId);
        renderCurrentSubTab();
      } catch (e) {
        alert('Error al guardar: ' + e.message);
        await loadKanbanTasks();
        openTaskDetail(taskDetailId);
      }
    });
  }
  if (isTimerRunning(task)) startTaskTimerClock(task); else stopTaskTimerClock();

  const today = toISODate(new Date());
  document.getElementById('detailSubtaskStart').value = today;
  document.getElementById('detailSubtaskEnd').value   = today;
  document.getElementById('btnDetailAddSubtask').addEventListener('click', async () => {
    const text  = document.getElementById('detailSubtaskText').value.trim();
    const start = document.getElementById('detailSubtaskStart').value;
    const end   = document.getElementById('detailSubtaskEnd').value;
    if (!text) return;
    const t = kanbanTasks.find(x => x.id === taskDetailId);
    if (!t) return;
    const addBtn = document.getElementById('btnDetailAddSubtask');
    addBtn.disabled = true;
    try {
      t.subtasks = t.subtasks || [];
      t.subtasks.push({ text, startDate: start, dueDate: end, done: false });
      await updateKanbanTask(t);
      openTaskDetail(taskDetailId);
      renderCurrentSubTab();
      pushUndo(async () => {
        const t2 = kanbanTasks.find(x => x.id === t.id);
        if (!t2 || !(t2.subtasks || []).length) return;
        t2.subtasks.pop();
        await updateKanbanTask(t2);
        if (taskDetailId === t2.id) openTaskDetail(taskDetailId);
        renderCurrentSubTab();
      });
    } catch (e) {
      alert('Error al guardar: ' + e.message);
    } finally {
      addBtn.disabled = false;
    }
  });

  renderObservations(task);

  document.getElementById('obsInput').value = '';
  document.getElementById('taskDetailOverlay').classList.add('open');
}

function renderObservations(task) {
  const list = document.getElementById('observationsList');
  const obs  = task.observations || [];
  if (!obs.length) {
    list.innerHTML = '<div class="obs-empty">Aún sin observaciones</div>';
    return;
  }
  list.innerHTML = obs.map(o => {
    const attachmentsHTML = (o.attachments || []).map(a => {
      const isImage = (a.mimeType || '').startsWith('image/');
      const viewUrl = `https://drive.google.com/file/d/${a.fileId}/view`;
      return isImage
        ? `<a class="obs-attachment obs-attachment--img" href="${viewUrl}" target="_blank" rel="noopener"><img src="${thumbUrl(a.fileId)}" alt="${esc(a.name)}" /></a>`
        : `<a class="obs-attachment obs-attachment--file" href="${viewUrl}" target="_blank" rel="noopener">📄 ${esc(a.name)}</a>`;
    }).join('');
    return `
      <div class="obs-item">
        ${o.text ? `<div class="obs-text">${esc(o.text)}</div>` : ''}
        ${attachmentsHTML ? `<div class="obs-attachments">${attachmentsHTML}</div>` : ''}
        <div class="obs-date">${fmtDate(o.createdAt)}</div>
      </div>
    `;
  }).join('');
  list.scrollTop = list.scrollHeight;
}

document.getElementById('btnCloseTaskDetail').addEventListener('click', () => {
  stopTaskTimerClock();
  document.getElementById('taskDetailOverlay').classList.remove('open');
});
document.getElementById('taskDetailOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('taskDetailOverlay')) {
    stopTaskTimerClock();
    document.getElementById('taskDetailOverlay').classList.remove('open');
  }
});

document.getElementById('btnEditFromDetail').addEventListener('click', () => {
  stopTaskTimerClock();
  document.getElementById('taskDetailOverlay').classList.remove('open');
  openTaskModal(null, taskDetailId);
});

document.getElementById('btnAddObs').addEventListener('click', async () => {
  const text = document.getElementById('obsInput').value.trim();
  if (!text) return;
  const task = kanbanTasks.find(t => t.id === taskDetailId);
  if (!task) return;

  const btn = document.getElementById('btnAddObs');
  btn.disabled = true;
  try {
    task.observations = task.observations || [];
    task.observations.push({ text, createdAt: new Date().toISOString() });
    await updateKanbanTask(task);
    document.getElementById('obsInput').value = '';
    renderObservations(task);
    pushUndo(async () => {
      const t = kanbanTasks.find(x => x.id === task.id);
      if (!t || !(t.observations || []).length) return;
      t.observations.pop();
      await updateKanbanTask(t);
      if (taskDetailId === t.id) renderObservations(t);
    });
  } catch (e) {
    alert('Error al guardar: ' + e.message);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('btnAttachObs').addEventListener('click', () => {
  document.getElementById('obsFileInput').click();
});

document.getElementById('obsFileInput').addEventListener('change', async function() {
  const files = Array.from(this.files || []);
  this.value = '';
  if (!files.length) return;
  const task = kanbanTasks.find(t => t.id === taskDetailId);
  if (!task) return;

  const attachBtn = document.getElementById('btnAttachObs');
  attachBtn.disabled = true;
  const list = document.getElementById('observationsList');
  if (list.querySelector('.obs-empty')) list.innerHTML = '';
  const placeholder = document.createElement('div');
  placeholder.className = 'obs-item obs-item--uploading';
  placeholder.textContent = `Subiendo ${files.length} archivo(s)…`;
  list.appendChild(placeholder);
  list.scrollTop = list.scrollHeight;

  try {
    const attachments = [];
    for (const file of files) {
      const data = await uploadToDrive(file);
      attachments.push({ fileId: data.id, name: file.name, mimeType: file.type });
    }
    task.observations = task.observations || [];
    task.observations.push({ text: '', createdAt: new Date().toISOString(), attachments });
    await updateKanbanTask(task);
    renderObservations(task);
    pushUndo(async () => {
      const t = kanbanTasks.find(x => x.id === task.id);
      if (!t || !(t.observations || []).length) return;
      const removed = t.observations.pop();
      await updateKanbanTask(t);
      for (const a of (removed.attachments || [])) await deleteDriveFile(a.fileId);
      if (taskDetailId === t.id) renderObservations(t);
    });
  } catch (e) {
    placeholder.remove();
    alert('Error al subir archivo: ' + e.message);
  } finally {
    attachBtn.disabled = false;
  }
});

// ── Event listeners: navigation ───────────────────────────────────────────────

document.getElementById('btnBack').addEventListener('click', () => navigateTo('home'));
document.getElementById('headerLogoBtn').addEventListener('click', () => navigateTo('home'));

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => navigateTo(el.dataset.nav));
});

document.querySelectorAll('.sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchSubTab(btn.dataset.subtab));
});

document.getElementById('btnNewTask').addEventListener('click', () =>
  openTaskModal(null, null, currentSubTab === 'gantt' ? currentGanttProjectId : null));

document.getElementById('kanbanFilterBtn').addEventListener('click', () => {
  openFilterPanel(document.getElementById('kanbanFilterBtn'), {
    scope: 'kanban',
    fieldKeys: ['area', 'priority', 'due'],
    activeFilters: kanbanActiveFilters,
    onApply: renderKanban
  });
});
document.getElementById('listaFilterBtn').addEventListener('click', () => {
  openFilterPanel(document.getElementById('listaFilterBtn'), {
    scope: 'lista',
    fieldKeys: ['area', 'status', 'priority', 'due'],
    activeFilters: listaActiveFilters,
    onApply: renderKanbanList
  });
});

document.querySelectorAll('#ganttZoomSwitch .gantt-zoom-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    ganttZoom = btn.dataset.zoom;
    document.querySelectorAll('#ganttZoomSwitch .gantt-zoom-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderGanttChart();
  });
});

document.getElementById('btnCalendarPrev').addEventListener('click', () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById('btnCalendarNext').addEventListener('click', () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  renderCalendar();
});
document.getElementById('btnCalendarToday').addEventListener('click', () => {
  calendarMonth = (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; })();
  renderCalendar();
});

// ── Ingredientes: Sheet CRUD ──────────────────────────────────────────────────

async function initIngredientesSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasI = tabs.find(s => s.properties.title === 'Ingredientes');

  if (hasI) {
    ingredientesSheetId = hasI.properties.sheetId;
  } else {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Ingredientes' } } }] })
    });
    const added = res.replies?.[0]?.addSheet?.properties;
    if (added) ingredientesSheetId = added.sheetId;
    await sheetsReq('/values/Ingredientes!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Nombre', 'CreadoEn', 'Unidad']] })
    });
  }
  await loadIngredientes();
}

async function loadIngredientes() {
  const data = await sheetsReq('/values/Ingredientes!A:D');
  const rows = (data.values || []).slice(1);
  ingredientes = rows.filter(r => r[0]).map((r, i) => ({
    id:       r[0] || '',
    nombre:   r[1] || '',
    creadoEn: r[2] || '',
    unidad:   r[3] || '',
    rowIndex: i + 2
  }));
}

async function appendIngrediente(nombre, unidad) {
  await sheetsReq('/values/Ingredientes!A:D:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[crypto.randomUUID(), nombre, new Date().toISOString(), unidad || '']] })
  });
}

async function updateIngrediente(ing) {
  await sheetsReq(`/values/Ingredientes!A${ing.rowIndex}:D${ing.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[ing.id, ing.nombre, ing.creadoEn, ing.unidad || '']] })
  });
}

function getIngredienteUnidad(nombre) {
  const found = findIngredienteDuplicate(nombre);
  return found?.unidad || '';
}

async function deleteIngredienteRow(rowIndex) {
  if (!ingredientesSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'Ingredientes');
    if (tab) ingredientesSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: ingredientesSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
}

// ── Ingredientes: Normalización y duplicados ──────────────────────────────────

function normalizeIngName(name) {
  return (name || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/s$/, '');
}

function findIngredienteDuplicate(nombre) {
  const norm = normalizeIngName(nombre);
  return ingredientes.find(ing => normalizeIngName(ing.nombre) === norm) || null;
}

async function tryAddIngrediente(nombre, unidad) {
  const trimmed = nombre.trim();
  if (!trimmed) return null;
  const dup = findIngredienteDuplicate(trimmed);
  if (dup) return dup.nombre;
  try {
    await appendIngrediente(trimmed, unidad);
    await loadIngredientes();
    return trimmed;
  } catch (e) {
    console.warn('tryAddIngrediente:', e.message);
    return trimmed;
  }
}

// ── Ingredientes: Autocomplete ────────────────────────────────────────────────

function attachIngredienteAutocomplete(input) {
  let dropdown = null;

  function removeDropdown() {
    if (dropdown) { dropdown.remove(); dropdown = null; }
  }

  function positionDropdown() {
    if (!dropdown) return;
    const rect = input.getBoundingClientRect();
    dropdown.style.top  = (rect.bottom + window.scrollY + 2) + 'px';
    dropdown.style.left = (rect.left + window.scrollX) + 'px';
    dropdown.style.width = Math.max(rect.width, 200) + 'px';
  }

  function showDropdown() {
    removeDropdown();
    const val = input.value.trim();
    if (!val) return;

    const lower = val.toLowerCase();
    const matches = ingredientes.filter(ing => ing.nombre.toLowerCase().includes(lower));
    const exactMatch = !!findIngredienteDuplicate(val);

    if (!matches.length && (exactMatch || val.length < 2)) return;

    dropdown = document.createElement('div');
    dropdown.className = 'ingrediente-autocomplete';

    matches.forEach(ing => {
      const opt = document.createElement('div');
      opt.className = 'autocomplete-option';
      opt.textContent = ing.nombre;
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = ing.nombre;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        removeDropdown();
      });
      dropdown.appendChild(opt);
    });

    if (!exactMatch && val.length >= 2) {
      const addOpt = document.createElement('div');
      addOpt.className = 'autocomplete-option autocomplete-add';
      addOpt.innerHTML = `+ Agregar "<strong>${esc(val)}</strong>"`;
      addOpt.addEventListener('mousedown', async e => {
        e.preventDefault();
        const unidad = prompt(`¿Unidad de medida para "${val}"? (g, kg, L, unidades…)`, '') || '';
        const result = await tryAddIngrediente(val, unidad.trim());
        if (result) input.value = result;
        removeDropdown();
      });
      dropdown.appendChild(addOpt);
    }

    document.body.appendChild(dropdown);
    positionDropdown();
  }

  input.addEventListener('input', showDropdown);
  input.addEventListener('focus', showDropdown);
  input.addEventListener('blur', () => setTimeout(removeDropdown, 180));
  window.addEventListener('scroll', removeDropdown, { passive: true, capture: true });
}

// ── Ingredientes: Modal ───────────────────────────────────────────────────────

function openIngredientesModal(firstTime) {
  document.getElementById('ingredientesModalTitle').textContent =
    firstTime ? 'Configurar ingredientes' : 'Gestionar ingredientes';
  document.getElementById('ingredientesFeedback').textContent = '';
  document.getElementById('nuevoIngrediente').value = '';
  renderIngredientesList();
  document.getElementById('ingredientesOverlay').classList.add('open');
}

function renderIngredientesList() {
  const container = document.getElementById('ingredientesList');
  if (!ingredientes.length) {
    container.innerHTML = '<div class="empty-state">No hay ingredientes registrados. Agrega el primero.</div>';
    return;
  }
  const sorted = [...ingredientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  container.innerHTML = sorted.map(ing => `
    <div class="mgmt-item">
      <span class="mgmt-item-name">${esc(ing.nombre)}</span>
      <input class="field-input mgmt-item-unidad" type="text" value="${esc(ing.unidad || '')}" placeholder="Unidad" data-row="${ing.rowIndex}" />
      <button class="mgmt-item-del" data-del-ing="${ing.rowIndex}">✕</button>
    </div>
  `).join('');
  container.querySelectorAll('.mgmt-item-unidad').forEach(inp => {
    inp.addEventListener('change', async () => {
      const ing = ingredientes.find(i => i.rowIndex === +inp.dataset.row);
      if (!ing) return;
      inp.disabled = true;
      try {
        await updateIngrediente({ ...ing, unidad: inp.value.trim() });
        await loadIngredientes();
        setFb(document.getElementById('ingredientesFeedback'), '✅ Unidad actualizada.', 'ok');
      } catch (e) {
        setFb(document.getElementById('ingredientesFeedback'), 'Error: ' + e.message, 'err');
      } finally {
        inp.disabled = false;
      }
    });
  });
  container.querySelectorAll('[data-del-ing]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = +btn.dataset.delIng;
      const ing = ingredientes.find(i => i.rowIndex === row);
      if (!confirm(`¿Eliminar "${ing?.nombre}"?`)) return;
      btn.disabled = true;
      try {
        await deleteIngredienteRow(row);
        await loadIngredientes();
        renderIngredientesList();
        setFb(document.getElementById('ingredientesFeedback'), '✅ Ingrediente eliminado.', 'ok');
      } catch (e) {
        setFb(document.getElementById('ingredientesFeedback'), 'Error: ' + e.message, 'err');
        btn.disabled = false;
      }
    });
  });
}

function isIngredientesFormDirty() {
  return !!document.getElementById('nuevoIngrediente')?.value.trim();
}

function closeIngredientesModal() {
  confirmCloseIfDirty('ingredientesOverlay', isIngredientesFormDirty);
}

document.getElementById('btnCloseIngredientes').addEventListener('click', closeIngredientesModal);
document.getElementById('ingredientesOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('ingredientesOverlay')) closeIngredientesModal();
});

document.getElementById('btnManageIngredientes').addEventListener('click', () => openIngredientesModal(false));

document.getElementById('btnAddIngrediente').addEventListener('click', async () => {
  const input       = document.getElementById('nuevoIngrediente');
  const unidadInput = document.getElementById('nuevoIngredienteUnidad');
  const nombre      = input.value.trim();
  const unidad      = unidadInput.value.trim();
  const fb = document.getElementById('ingredientesFeedback');
  if (!nombre) return setFb(fb, 'Escribe el nombre del ingrediente.', 'err');
  if (!unidad) return setFb(fb, 'Indica la unidad de medida (g, kg, L…).', 'err');

  const dup = findIngredienteDuplicate(nombre);
  if (dup) return setFb(fb, `Ya existe "${dup.nombre}" (similar a "${nombre}").`, 'err');

  const btn = document.getElementById('btnAddIngrediente');
  btn.disabled = true;
  try {
    await appendIngrediente(nombre, unidad);
    await loadIngredientes();
    renderIngredientesList();
    input.value = '';
    unidadInput.value = '';
    setFb(fb, `✅ "${nombre}" agregado.`, 'ok');
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('nuevoIngrediente').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnAddIngrediente').click();
});

// ── Compras: Sheets init + CRUD ────────────────────────────────────────────────

async function initComprasSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasC = tabs.find(s => s.properties.title === 'Compras');

  if (hasC) {
    comprasSheetId = hasC.properties.sheetId;
  } else {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Compras' } } }] })
    });
    const added = res.replies?.[0]?.addSheet?.properties;
    if (added) comprasSheetId = added.sheetId;
    await sheetsReq('/values/Compras!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Ingrediente', 'Cantidad', 'PrecioTotal', 'Fecha', 'CreadoEn']] })
    });
  }
  await loadCompras();
}

async function loadCompras() {
  const data = await sheetsReq('/values/Compras!A:F');
  const rows = (data.values || []).slice(1);
  compras = rows.filter(r => r[0]).map((r, i) => ({
    id:          r[0] || '',
    ingrediente: r[1] || '',
    cantidad:    parseFloat(r[2]) || 0,
    precioTotal: parseFloat(r[3]) || 0,
    fecha:       r[4] || '',
    creadoEn:    r[5] || '',
    rowIndex:    i + 2
  }));
}

async function appendCompra(c) {
  await sheetsReq('/values/Compras!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), c.ingrediente, c.cantidad, c.precioTotal, c.fecha, new Date().toISOString()
    ]]})
  });
}

async function deleteCompraRow(rowIndex) {
  if (!comprasSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'Compras');
    if (tab) comprasSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: comprasSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
}

function comprasForIngrediente(nombre) {
  const key = normalizeIngName(nombre);
  return compras.filter(c => normalizeIngName(c.ingrediente) === key);
}

function getLatestCompra(nombre) {
  const list = comprasForIngrediente(nombre);
  if (!list.length) return null;
  return list.slice().sort((a, b) => {
    const da = a.fecha || a.creadoEn || '';
    const db = b.fecha || b.creadoEn || '';
    if (da !== db) return da < db ? 1 : -1;
    return (a.creadoEn || '') < (b.creadoEn || '') ? 1 : -1;
  })[0];
}

function getUnitPrice(nombre) {
  const last = getLatestCompra(nombre);
  if (!last || !last.cantidad) return null;
  return last.precioTotal / last.cantidad;
}

function fmtCOP(n) {
  return (n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

function computeCostoProduccion(etapasData) {
  let total = 0;
  const incompleto = [];
  (etapasData || []).forEach(stage => {
    (stage.insumosConfirmados || []).forEach(ins => {
      const qty = parseFloat(ins.cantidadReal) || 0;
      if (!qty) return;
      const price = getUnitPrice(ins.nombre);
      if (price == null) {
        if (!incompleto.includes(ins.nombre)) incompleto.push(ins.nombre);
        return;
      }
      total += qty * price;
    });
  });
  return { total, incompleto };
}

// ── Compras: UI ────────────────────────────────────────────────────────────────

function renderComprasList() {
  const container = document.getElementById('comprasList');
  if (!container) return;
  if (!ingredientes.length) {
    container.innerHTML = '<div class="empty-state">No hay ingredientes registrados todavía. Agrégalos desde Procesos → Ingredientes.</div>';
    return;
  }
  const sorted = [...ingredientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const rowsHTML = sorted.map(ing => {
    const last      = getLatestCompra(ing.nombre);
    const unitPrice = last && last.cantidad ? last.precioTotal / last.cantidad : null;
    return `
      <tr>
        <td>${esc(ing.nombre)}</td>
        <td>${esc(ing.unidad || '—')}</td>
        <td>${unitPrice != null ? `${fmtCOP(unitPrice)} / ${esc(ing.unidad || 'u')}` : 'Sin compras'}</td>
        <td>${last ? (fmtDateShortEs(last.fecha) || fmtDate(last.creadoEn)) : '—'}</td>
        <td style="white-space:nowrap">
          <button class="task-action-btn" data-add-compra="${esc(ing.nombre)}" title="Registrar compra">🛒</button>
          ${last ? `<button class="task-action-btn" data-historial="${esc(ing.nombre)}" title="Ver historial">📜</button>` : ''}
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="tasks-table">
      <thead><tr><th>Ingrediente</th><th>Unidad</th><th>Último precio</th><th>Última compra</th><th></th></tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
  `;

  container.querySelectorAll('[data-add-compra]').forEach(btn => {
    btn.addEventListener('click', () => openCompraModal(btn.dataset.addCompra));
  });
  container.querySelectorAll('[data-historial]').forEach(btn => {
    btn.addEventListener('click', () => openCompraHistorial(btn.dataset.historial));
  });
}

function updateCompraUnidadHint() {
  const nombre = document.getElementById('compraIngrediente').value.trim();
  const unidad = getIngredienteUnidad(nombre);
  document.getElementById('compraUnidadHint').textContent = unidad ? `· en ${unidad}` : '';
}

function updateCompraFechaTrigger() {
  const trigger = document.getElementById('compraFechaTrigger');
  const val     = document.getElementById('compraFecha').value;
  trigger.textContent = val ? fmtDateShortEs(val) : 'Elegir fecha…';
}

function openCompraModal(nombrePrefill) {
  document.getElementById('compraFeedback').textContent = '';
  const ingInput = document.getElementById('compraIngrediente');
  ingInput.value    = nombrePrefill || '';
  ingInput.disabled = !!nombrePrefill;
  document.getElementById('compraCantidad').value    = '';
  document.getElementById('compraPrecioTotal').value = '';
  document.getElementById('compraFecha').value = toISODate(new Date());
  updateCompraFechaTrigger();
  updateCompraUnidadHint();
  document.getElementById('compraOverlay').classList.add('open');
  if (!nombrePrefill) setTimeout(() => ingInput.focus(), 100);
}

attachIngredienteAutocomplete(document.getElementById('compraIngrediente'));
document.getElementById('compraIngrediente').addEventListener('input', updateCompraUnidadHint);
document.getElementById('compraIngrediente').addEventListener('change', updateCompraUnidadHint);

document.getElementById('compraFechaTrigger').addEventListener('click', () => {
  const fechaInput = document.getElementById('compraFecha');
  openCalendarPopover(document.getElementById('compraFechaTrigger'), {
    mode:  'single',
    start: fechaInput.value || toISODate(new Date()),
    end:   fechaInput.value || toISODate(new Date()),
    onApply: (start, end) => {
      fechaInput.value = end;
      updateCompraFechaTrigger();
    }
  });
});

function closeCompraModal() {
  document.getElementById('compraOverlay').classList.remove('open');
}
document.getElementById('btnCloseCompra').addEventListener('click', closeCompraModal);
document.getElementById('compraOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('compraOverlay')) closeCompraModal();
});
document.getElementById('btnNewCompra').addEventListener('click', () => openCompraModal(null));

document.getElementById('btnSaveCompra').addEventListener('click', async () => {
  const ingInput     = document.getElementById('compraIngrediente');
  const nombre       = ingInput.value.trim();
  const cantidad     = parseFloat(document.getElementById('compraCantidad').value);
  const precioTotal  = parseFloat(document.getElementById('compraPrecioTotal').value);
  const fecha        = document.getElementById('compraFecha').value;
  const fb           = document.getElementById('compraFeedback');

  if (!nombre) return setFb(fb, 'Indica el ingrediente.', 'err');
  const dup = findIngredienteDuplicate(nombre);
  if (!dup) return setFb(fb, `"${nombre}" no está en la lista de ingredientes. Elígelo de las sugerencias o usa "+ Agregar" mientras escribes.`, 'err');
  if (!cantidad || cantidad <= 0) return setFb(fb, 'La cantidad debe ser mayor a 0.', 'err');
  if (!precioTotal || precioTotal <= 0) return setFb(fb, 'El precio total debe ser mayor a 0.', 'err');
  if (!fecha) return setFb(fb, 'Indica la fecha de compra.', 'err');

  const btn = document.getElementById('btnSaveCompra');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await appendCompra({ ingrediente: dup.nombre, cantidad, precioTotal, fecha });
    await loadCompras();
    renderComprasList();
    closeCompraModal();
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar compra';
  }
});

function openCompraHistorial(nombre) {
  comprasHistorialIng = nombre;
  document.getElementById('compraHistorialTitle').textContent = `Historial de compras — ${nombre}`;
  renderCompraHistorialList();
  document.getElementById('compraHistorialOverlay').classList.add('open');
}

function renderCompraHistorialList() {
  const container = document.getElementById('compraHistorialList');
  const list = comprasForIngrediente(comprasHistorialIng).slice().sort((a, b) => {
    const da = a.fecha || a.creadoEn || '', db = b.fecha || b.creadoEn || '';
    return da < db ? 1 : da > db ? -1 : 0;
  });
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">Sin compras registradas.</div>';
    return;
  }
  const unidad = getIngredienteUnidad(comprasHistorialIng) || 'u';
  container.innerHTML = list.map(c => `
    <div class="mgmt-item">
      <span class="mgmt-item-name">
        ${esc(fmtDateShortEs(c.fecha) || '—')} — ${c.cantidad} ${esc(unidad)} por ${fmtCOP(c.precioTotal)}
        <span class="mgmt-item-tag">${fmtCOP(c.cantidad ? c.precioTotal / c.cantidad : 0)}/${esc(unidad)}</span>
      </span>
      <button class="mgmt-item-del" data-del-compra="${c.rowIndex}">✕</button>
    </div>
  `).join('');
  container.querySelectorAll('[data-del-compra]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta compra?')) return;
      btn.disabled = true;
      try {
        await deleteCompraRow(+btn.dataset.delCompra);
        await loadCompras();
        renderCompraHistorialList();
        renderComprasList();
      } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
      }
    });
  });
}

document.getElementById('btnCloseCompraHistorial').addEventListener('click', () => {
  document.getElementById('compraHistorialOverlay').classList.remove('open');
});
document.getElementById('compraHistorialOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('compraHistorialOverlay')) {
    document.getElementById('compraHistorialOverlay').classList.remove('open');
  }
});

// ── Procesos: Sheets init ─────────────────────────────────────────────────────

async function initRecetasSheets() {
  const info = await sheetsReq('');
  const tabs  = info.sheets || [];
  const hasR  = tabs.find(s => s.properties.title === 'RecetasPlantillas');
  const hasE  = tabs.find(s => s.properties.title === 'RecetasEjecuciones');
  const hasB  = tabs.find(s => s.properties.title === 'RecetaBlocks');

  if (hasR) recetasSheetId       = hasR.properties.sheetId;
  if (hasE) ejecucionesSheetId   = hasE.properties.sheetId;
  if (hasB) recetaBlocksSheetId  = hasB.properties.sheetId;

  const reqs = [];
  if (!hasR) reqs.push({ addSheet: { properties: { title: 'RecetasPlantillas'  } } });
  if (!hasE) reqs.push({ addSheet: { properties: { title: 'RecetasEjecuciones' } } });
  if (!hasB) reqs.push({ addSheet: { properties: { title: 'RecetaBlocks' } } });

  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST', body: JSON.stringify({ requests: reqs })
    });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'RecetasPlantillas')
        recetasSheetId = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'RecetasEjecuciones')
        ejecucionesSheetId = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'RecetaBlocks')
        recetaBlocksSheetId = r.addSheet.properties.sheetId;
    });
  }

  const rd = await sheetsReq('/values/RecetasPlantillas!A1:G1').catch(() => ({}));
  if (!rd.values || (rd.values[0] || []).length < 7) {
    await sheetsReq('/values/RecetasPlantillas!A1:G1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['ID','Nombre','Descripcion','Etapas','CreadoEn','IngredientesMaestros','BlockId']] })
    });
  }

  const bd = await sheetsReq('/values/RecetaBlocks!A1').catch(() => ({}));
  if (!bd.values) {
    await sheetsReq('/values/RecetaBlocks!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID','Nombre','CreadoEn','SortOrder']] })
    });
  }

  const ed = await sheetsReq('/values/RecetasEjecuciones!A1').catch(() => ({}));
  if (!ed.values) {
    await sheetsReq('/values/RecetasEjecuciones!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID','RecetaID','NombreReceta','LoteID','FechaInicio','FechaFin','Estado','DuracionTotal','EtapasData','Evaluacion','CreadoEn']] })
    });
  }
}

// ── Procesos: CRUD ────────────────────────────────────────────────────────────

async function loadRecetasData() {
  const data = await sheetsReq('/values/RecetasPlantillas!A:G');
  const rows = (data.values || []).slice(1);
  recetas = rows.filter(r => r[0]).map((r, i) => ({
    id:                   r[0] || '',
    nombre:               r[1] || '',
    descripcion:          r[2] || '',
    etapas:               safeParseJSON(r[3], []),
    creadoEn:             r[4] || '',
    ingredientesMaestros: safeParseJSON(r[5], []),
    blockId:              r[6] || '',
    rowIndex:             i + 2
  }));
}

async function appendReceta(rec) {
  await sheetsReq('/values/RecetasPlantillas!A:G:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      rec.id, rec.nombre, rec.descripcion, JSON.stringify(rec.etapas), rec.creadoEn,
      JSON.stringify(rec.ingredientesMaestros || []), rec.blockId || ''
    ]]})
  });
}

async function updateReceta(rec) {
  await sheetsReq(`/values/RecetasPlantillas!A${rec.rowIndex}:G${rec.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      rec.id, rec.nombre, rec.descripcion, JSON.stringify(rec.etapas), rec.creadoEn,
      JSON.stringify(rec.ingredientesMaestros || []), rec.blockId || ''
    ]]})
  });
}

async function deleteRecetaRow(rowIndex) {
  if (!recetasSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'RecetasPlantillas');
    if (tab) recetasSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: recetasSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
}

// ── Recetas: Bloques CRUD ────────────────────────────────────────────────────

async function loadRecetaBlocks() {
  const data = await sheetsReq('/values/RecetaBlocks!A:D');
  const rows = (data.values || []).slice(1);
  recetaBlocks = rows.filter(r => r[0]).map((r, i) => ({
    id:        r[0] || '',
    nombre:    r[1] || '',
    creadoEn:  r[2] || '',
    sortOrder: r[3] !== undefined && r[3] !== '' ? +r[3] : i,
    rowIndex:  i + 2
  }));
  recetaBlocks.sort((a, b) => a.sortOrder - b.sortOrder);
  recetaBlocksLoaded = true;
}

async function appendRecetaBlock(block) {
  const sortOrder = recetaBlocks.length;
  await sheetsReq('/values/RecetaBlocks!A:D:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[block.id, block.nombre, block.creadoEn, sortOrder]] })
  });
}

async function updateRecetaBlock(block) {
  await sheetsReq(`/values/RecetaBlocks!A${block.rowIndex}:D${block.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[block.id, block.nombre, block.creadoEn, block.sortOrder ?? 0]] })
  });
}

async function deleteRecetaBlockRow(rowIndex) {
  if (!recetaBlocksSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'RecetaBlocks');
    if (tab) recetaBlocksSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: recetaBlocksSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
}

async function deleteRecetaBlock(blockId) {
  const block = recetaBlocks.find(b => b.id === blockId);
  if (!block) return;
  const affected = recetas.filter(r => r.blockId === blockId);
  await deleteRecetaBlockRow(block.rowIndex);
  for (const r of affected) {
    r.blockId = '';
    await updateReceta(r);
  }
  await loadRecetaBlocks();
}

async function loadEjecucionesData() {
  const data = await sheetsReq('/values/RecetasEjecuciones!A:K');
  const rows = (data.values || []).slice(1);
  ejecuciones = rows.filter(r => r[0]).map((r, i) => ({
    id:            r[0]  || '',
    recetaId:      r[1]  || '',
    nombreReceta:  r[2]  || '',
    loteId:        r[3]  || '',
    fechaInicio:   r[4]  || '',
    fechaFin:      r[5]  || '',
    estado:        r[6]  || '',
    duracionTotal: r[7]  || '',
    etapasData:    safeParseJSON(r[8], []),
    evaluacion:    safeParseJSON(r[9], {}),
    creadoEn:      r[10] || '',
    observations:  safeParseJSON(r[11], []),
    rowIndex:      i + 2
  }));
}

async function appendEjecucion(ej) {
  await sheetsReq('/values/RecetasEjecuciones!A:L:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      ej.id, ej.recetaId, ej.nombreReceta, ej.loteId,
      ej.fechaInicio, ej.fechaFin, ej.estado, ej.duracionTotal,
      JSON.stringify(ej.etapasData), JSON.stringify(ej.evaluacion), ej.creadoEn,
      JSON.stringify(ej.observations || [])
    ]]})
  });
}

async function updateEjecucion(ej) {
  await sheetsReq(`/values/RecetasEjecuciones!A${ej.rowIndex}:L${ej.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      ej.id, ej.recetaId, ej.nombreReceta, ej.loteId,
      ej.fechaInicio, ej.fechaFin, ej.estado, ej.duracionTotal,
      JSON.stringify(ej.etapasData), JSON.stringify(ej.evaluacion), ej.creadoEn,
      JSON.stringify(ej.observations || [])
    ]]})
  });
}

// ── Procesos: Render ──────────────────────────────────────────────────────────

async function loadProcesos() {
  try {
    await loadRecetasData();
    await loadRecetaBlocks();
    await loadEjecucionesData();
    renderRecetasList();
    renderEjecucionesList();
  } catch (e) {
    console.error('loadProcesos:', e);
  }
}

function recetaCardHTML(r) {
  return `
    <div class="receta-card" data-id="${esc(r.id)}" draggable="true" title="Doble clic para ver detalle">
      <div class="receta-card-body">
        <div class="receta-card-title">${esc(r.nombre)}</div>
        ${r.descripcion ? `<div class="receta-card-desc">${esc(r.descripcion)}</div>` : ''}
        <div class="receta-card-meta">🥄 ${r.etapas.length} etapa${r.etapas.length !== 1 ? 's' : ''} &nbsp;·&nbsp; doble clic = ver pasos</div>
      </div>
      <div class="receta-card-actions">
        <button class="btn-ejecutar" data-ejecutar="${esc(r.id)}">▶ Ejecutar</button>
        <button class="btn-outline btn-sm" data-dup-receta="${esc(r.id)}" title="Duplicar receta">${ICON_COPY}</button>
        <button class="btn-outline btn-sm" data-edit-receta="${esc(r.id)}">${ICON_EDIT}</button>
        <button class="btn-outline btn-sm" data-del-receta="${esc(r.id)}" data-row="${r.rowIndex}">${ICON_TRASH}</button>
      </div>
    </div>`;
}

function renderRecetasList() {
  const container = document.getElementById('recetasList');
  if (!container) return;

  if (!recetas.length) {
    container.innerHTML = '<div class="empty-state">No hay recetas. Crea la primera con "+ Nueva receta".</div>';
    return;
  }

  if (!recetaBlocks.length) {
    container.innerHTML = recetas.map(recetaCardHTML).join('');
  } else {
    const sections = recetaBlocks.map(b => ({
      id: b.id, nombre: b.nombre, items: recetas.filter(r => r.blockId === b.id)
    }));
    sections.push({
      id: '', nombre: 'Sin bloque',
      items: recetas.filter(r => !r.blockId || !recetaBlocks.find(b => b.id === r.blockId))
    });

    container.innerHTML = sections.map(sec => {
      const toggleKey  = sec.id || '__sinbloque__';
      const collapsed  = collapsedRecetaBlocks.has(toggleKey);
      const draggable  = !!sec.id;
      return `
      <div class="receta-block-section">
        <div class="receta-block-header" data-block-id="${esc(sec.id)}" ${draggable ? 'draggable="true"' : ''}>
          ${draggable ? '<span class="receta-block-drag-handle" title="Arrastra para reordenar bloque">⠿</span>' : ''}
          <button type="button" class="receta-block-collapse-btn" data-block-toggle="${esc(toggleKey)}" title="Colapsar/Expandir">${collapsed ? '▸' : '▾'}</button>
          <span class="receta-block-title">${esc(sec.nombre)}</span>
          <span class="receta-block-count">${sec.items.length}</span>
        </div>
        <div class="receta-block-body" data-block-drop="${esc(sec.id)}" style="${collapsed ? 'display:none' : ''}">
          ${sec.items.length ? sec.items.map(recetaCardHTML).join('') : '<div class="receta-block-empty">Arrastra una receta aquí</div>'}
        </div>
      </div>
    `;
    }).join('');

    container.querySelectorAll('.receta-block-body').forEach(zone => {
      zone.addEventListener('dragover', e => {
        if (!draggedRecetaId) return;
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', e => {
        if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
      });
      zone.addEventListener('drop', async e => {
        if (!draggedRecetaId) return;
        e.preventDefault();
        zone.classList.remove('drag-over');
        const rec = recetas.find(r => r.id === draggedRecetaId);
        if (!rec) return;
        const newBlockId = zone.dataset.blockDrop;
        if ((rec.blockId || '') === newBlockId) return;
        rec.blockId = newBlockId;
        renderRecetasList();
        try { await updateReceta(rec); }
        catch (err) { alert('Error al guardar: ' + err.message); await loadRecetasData(); renderRecetasList(); }
      });
    });

    container.querySelectorAll('[data-block-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.blockToggle;
        if (collapsedRecetaBlocks.has(key)) collapsedRecetaBlocks.delete(key);
        else collapsedRecetaBlocks.add(key);
        renderRecetasList();
      });
    });

    container.querySelectorAll('.receta-block-header[draggable="true"]').forEach(header => {
      const blockId = header.dataset.blockId;
      const section = header.closest('.receta-block-section');
      header.addEventListener('dragstart', e => {
        draggedBlockId = blockId;
        section.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
      });
      header.addEventListener('dragend', () => {
        section.classList.remove('dragging');
        document.querySelectorAll('.receta-block-section.block-drag-over').forEach(el => el.classList.remove('block-drag-over'));
        draggedBlockId = null;
      });
      section.addEventListener('dragover', e => {
        if (!draggedBlockId || draggedBlockId === blockId) return;
        e.preventDefault();
        section.classList.add('block-drag-over');
      });
      section.addEventListener('dragleave', e => {
        if (!section.contains(e.relatedTarget)) section.classList.remove('block-drag-over');
      });
      section.addEventListener('drop', async e => {
        if (!draggedBlockId || draggedBlockId === blockId) return;
        e.preventDefault();
        e.stopPropagation();
        section.classList.remove('block-drag-over');
        const fromIdx = recetaBlocks.findIndex(b => b.id === draggedBlockId);
        const toIdx   = recetaBlocks.findIndex(b => b.id === blockId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = recetaBlocks.splice(fromIdx, 1);
        recetaBlocks.splice(toIdx, 0, moved);
        recetaBlocks.forEach((b, i) => { b.sortOrder = i; });
        renderRecetasList();
        try { for (const b of recetaBlocks) await updateRecetaBlock(b); }
        catch (err) { alert('Error al guardar el orden: ' + err.message); await loadRecetaBlocks(); renderRecetasList(); }
      });
    });
  }

  container.querySelectorAll('.receta-card[data-id]').forEach(card => {
    card.addEventListener('dblclick', e => {
      if (e.target.closest('button')) return;
      openRecetaDetail(card.dataset.id);
    });
    card.addEventListener('touchend', e => {
      if (e.target.closest('button') || wasAccidentalTouch()) return;
      const now = Date.now();
      const last = lastTapTime['rec_' + card.dataset.id] || 0;
      lastTapTime['rec_' + card.dataset.id] = now;
      if (now - last < 350) openRecetaDetail(card.dataset.id);
    });
    card.addEventListener('dragstart', e => {
      draggedRecetaId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.receta-block-body.drag-over').forEach(el => el.classList.remove('drag-over'));
      draggedRecetaId = null;
    });
  });
  container.querySelectorAll('[data-ejecutar]').forEach(btn => {
    btn.addEventListener('click', () => startExecution(btn.dataset.ejecutar));
  });
  container.querySelectorAll('[data-dup-receta]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rec = recetas.find(r => r.id === btn.dataset.dupReceta);
      if (!rec) return;
      btn.disabled = true;
      try {
        await appendReceta({
          id: crypto.randomUUID(),
          nombre: rec.nombre + ' (copia)',
          descripcion: rec.descripcion,
          etapas: JSON.parse(JSON.stringify(rec.etapas)),
          ingredientesMaestros: JSON.parse(JSON.stringify(rec.ingredientesMaestros || [])),
          blockId: rec.blockId || '',
          creadoEn: new Date().toISOString()
        });
        await loadRecetasData();
        renderRecetasList();
      } catch (e) { alert('Error al duplicar: ' + e.message); btn.disabled = false; }
    });
  });
  container.querySelectorAll('[data-edit-receta]').forEach(btn => {
    btn.addEventListener('click', () => openRecetaModal(btn.dataset.editReceta));
  });
  container.querySelectorAll('[data-del-receta]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta receta?')) return;
      btn.disabled = true;
      try {
        await deleteRecetaRow(+btn.dataset.row);
        await loadRecetasData();
        renderRecetasList();
      } catch (e) { alert('Error: ' + e.message); btn.disabled = false; }
    });
  });
}

// ── Recetas: Bloques management modal ────────────────────────────────────────

function renderRecetaBlocksList() {
  const container = document.getElementById('recetaBlocksList');
  if (recetaBlocks.length === 0) {
    container.innerHTML = '<div class="empty-state">Aún no hay bloques.</div>';
    return;
  }
  container.innerHTML = recetaBlocks.map(b => `
    <div class="mgmt-item">
      <span class="mgmt-item-name">${esc(b.nombre)}</span>
      <button class="mgmt-item-del" data-del-block="${esc(b.id)}">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-del-block]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const block = recetaBlocks.find(b => b.id === btn.dataset.delBlock);
      if (!block) return;
      if (!confirm(`¿Eliminar el bloque "${block.nombre}"? Las recetas no se borrarán, quedarán sin bloque.`)) return;
      const fb = document.getElementById('recetaBlockFeedback');
      try {
        await deleteRecetaBlock(block.id);
        renderRecetaBlocksList();
        renderRecetasList();
        setFb(fb, `✅ Bloque eliminado.`, 'ok');
      } catch (e) { setFb(fb, 'Error: ' + e.message, 'err'); }
    });
  });
}

document.getElementById('btnManageRecetaBlocks').addEventListener('click', async () => {
  if (!recetaBlocksLoaded) await loadRecetaBlocks();
  renderRecetaBlocksList();
  document.getElementById('recetaBlockFeedback').textContent = '';
  document.getElementById('recetaBlockOverlay').classList.add('open');
});

function isRecetaBlockFormDirty() {
  return !!document.getElementById('newRecetaBlockName')?.value.trim();
}

function closeRecetaBlockModal() {
  confirmCloseIfDirty('recetaBlockOverlay', isRecetaBlockFormDirty);
}

document.getElementById('btnCloseRecetaBlocks').addEventListener('click', closeRecetaBlockModal);
document.getElementById('recetaBlockOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('recetaBlockOverlay')) closeRecetaBlockModal();
});

document.getElementById('btnAddRecetaBlock').addEventListener('click', async () => {
  const nombre = document.getElementById('newRecetaBlockName').value.trim();
  const fb     = document.getElementById('recetaBlockFeedback');
  if (!nombre) return setFb(fb, 'El nombre del bloque es obligatorio.', 'err');
  if (recetaBlocks.find(b => b.nombre.toLowerCase() === nombre.toLowerCase()))
    return setFb(fb, 'Ya existe un bloque con ese nombre.', 'err');

  try {
    await appendRecetaBlock({ id: crypto.randomUUID(), nombre, creadoEn: new Date().toISOString() });
    await loadRecetaBlocks();
    document.getElementById('newRecetaBlockName').value = '';
    renderRecetaBlocksList();
    renderRecetasList();
    setFb(fb, `✅ Bloque "${nombre}" agregado.`, 'ok');
  } catch (e) { setFb(fb, 'Error: ' + e.message, 'err'); }
});

function renderEjecucionesList() {
  const container = document.getElementById('ejecucionesList');
  if (!container) return;

  if (!ejecuciones.length) {
    container.innerHTML = '<div class="empty-state">Aún no hay ejecuciones registradas.</div>';
    return;
  }

  const sorted = [...ejecuciones].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));

  container.innerHTML = sorted.map(ej => {
    const ev = ej.evaluacion || {};
    const stars = ev.calificacion ? '★'.repeat(ev.calificacion) + '☆'.repeat(5 - ev.calificacion) : '—';
    const durMin = ej.duracionTotal ? Math.round(+ej.duracionTotal / 60) + ' min' : '—';
    const now = Date.now();

    // Phase 2 status
    let fase2Html = '';
    if (ev.fase2UnlockAt) {
      const unlockMs = new Date(ev.fase2UnlockAt).getTime();
      if (ev.fase2) {
        fase2Html = `<div class="eval-stage-done">✅ Fase 2 evaluada</div>`;
      } else if (now >= unlockMs) {
        fase2Html = `<button class="btn-eval-stage btn-fase2-eval" data-fase2-id="${esc(ej.id)}">🧊 Evaluar Fase 2</button>`;
      } else {
        const ms = unlockMs - now;
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        fase2Html = `<div class="eval-stage-pending">🧊 Fase 2 en ${h > 0 ? h + 'h ' : ''}${m}m</div>`;
      }
    }

    // Sinéresis status
    let sinHtml = '';
    if (ev.sineresisUnlockAt) {
      const sinUnlockMs = new Date(ev.sineresisUnlockAt).getTime();
      if (ev.sineresis != null) {
        sinHtml = `<div class="eval-stage-done">✅ Sinéresis: ${ev.sineresis === 'ok' ? 'Sin separación ✓' : 'Separación visible ✗'}</div>`;
      } else if (now >= sinUnlockMs) {
        sinHtml = `<button class="btn-eval-stage btn-sineresis-eval" data-sin-id="${esc(ej.id)}">💧 Evaluar Sinéresis</button>`;
      } else {
        const ms = sinUnlockMs - now;
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        sinHtml = `<div class="eval-stage-pending">💧 Sinéresis en ${h > 0 ? h + 'h ' : ''}${m}m</div>`;
      }
    }

    return `
      <div class="ejecucion-card" data-ej-id="${esc(ej.id)}" style="cursor:pointer">
        <div class="ejecucion-card-header">
          <span class="ejecucion-lote">${esc(ej.loteId || 'Sin lote')}</span>
          <span class="ejecucion-estado estado-${ej.estado === 'Completada' ? 'ok' : 'prog'}">${esc(ej.estado)}</span>
        </div>
        <div class="ejecucion-receta">${esc(ej.nombreReceta)}</div>
        <div class="ejecucion-meta">
          📅 ${fmtDate(ej.fechaInicio)} &nbsp;·&nbsp; ⏱ ${durMin}
          ${ev.calificacion ? `&nbsp;·&nbsp; <span class="ejecucion-stars">${stars}</span>` : ''}
        </div>
        ${normalizeObsList(ev.observaciones).length ? `<div class="ejecucion-obs">${normalizeObsList(ev.observaciones).map(o => esc(o.text)).join(' · ')}</div>` : ''}
        ${fase2Html || sinHtml ? `<div class="eval-stages-row">${fase2Html}${sinHtml}</div>` : ''}
        <div class="ejecucion-hint">doble clic = ver detalle</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-ej-id]').forEach(card => {
    const ejId = card.dataset.ejId;
    card.addEventListener('dblclick', () => openEjecucionDetail(ejId));
    card.addEventListener('touchend', () => {
      if (wasAccidentalTouch()) return;
      const now  = Date.now();
      const last = lastTapTime['ej_' + ejId] || 0;
      lastTapTime['ej_' + ejId] = now;
      if (now - last < 350) openEjecucionDetail(ejId);
    });
  });

  container.querySelectorAll('.btn-fase2-eval').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openFase2Eval(btn.dataset.fase2Id); });
  });
  container.querySelectorAll('.btn-sineresis-eval').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openSineresisEval(btn.dataset.sinId); });
  });
}

// ── Procesos: Recipe detail view ──────────────────────────────────────────────

function openRecetaDetail(recetaId) {
  const rec = recetas.find(r => r.id === recetaId);
  if (!rec) return;
  recetaDetailId = recetaId;

  document.getElementById('recetaDetailTitle').textContent = rec.nombre;

  const maestros = rec.ingredientesMaestros || [];
  const ingredientesHTML = maestros.length
    ? `<div class="receta-detail-ingredientes">
        <div class="receta-detail-ingredientes-title">🧂 Ingredientes de la receta</div>
        ${maestros.map(ing =>
          `<div class="detail-insumo-row">• ${esc(ing.nombre)}: <strong>${ing.cantidadTotal} ${esc(ing.unidad)}</strong></div>`
        ).join('')}
      </div>`
    : '';

  const etapasHTML = rec.etapas.map((et, i) => {
    const instrHTML = buildInstruccionesHTML(et.instrucciones);

    const insumosHTML = (et.insumos || []).filter(ins => ins.nombre).map(ins =>
      `<div class="detail-insumo-row">• ${esc(ins.nombre)}: <strong>${ins.cantidad} ${esc(ins.unidad)}</strong></div>`
    ).join('');

    return `
      <div class="receta-detail-etapa">
        <div class="receta-detail-etapa-header">
          <span class="etapa-num">ETAPA ${i + 1}</span>
          <span class="receta-detail-etapa-nombre">${esc(et.nombre)}</span>
          ${et.tiempoEstimado ? `<span class="receta-detail-etapa-tiempo">⏱ ${et.tiempoEstimado} min</span>` : ''}
        </div>
        ${instrHTML}
        ${insumosHTML ? `<div class="receta-detail-insumos"><div class="receta-detail-insumos-title">Insumos:</div>${insumosHTML}</div>` : ''}
      </div>
    `;
  }).join('');

  document.getElementById('recetaDetailBody').innerHTML = `
    ${rec.descripcion ? `<div class="info-box">${esc(rec.descripcion)}</div>` : ''}
    ${ingredientesHTML}
    <div class="receta-detail-etapas">${etapasHTML || '<div class="empty-state">Esta receta no tiene etapas.</div>'}</div>
  `;

  document.getElementById('btnEditFromRecetaDetail').onclick = () => {
    document.getElementById('recetaDetailOverlay').classList.remove('open');
    openRecetaModal(recetaId);
  };
  document.getElementById('btnDownloadRecetaDetail').onclick = () => downloadRecetaTxt(recetaId);
  document.getElementById('recetaDetailOverlay').classList.add('open');
}

function downloadRecetaTxt(recetaId) {
  const rec = recetas.find(r => r.id === recetaId);
  if (!rec) return;

  const lines = [];
  lines.push(rec.nombre.toUpperCase());
  lines.push('='.repeat(rec.nombre.length));
  if (rec.descripcion) {
    lines.push('');
    lines.push(rec.descripcion);
  }

  const maestros = rec.ingredientesMaestros || [];
  if (maestros.length) {
    lines.push('');
    lines.push('INGREDIENTES DE LA RECETA');
    maestros.forEach(ing => lines.push(`- ${ing.nombre}: ${ing.cantidadTotal} ${ing.unidad}`));
  }

  rec.etapas.forEach((et, i) => {
    lines.push('');
    lines.push(`ETAPA ${i + 1}: ${et.nombre}${et.tiempoEstimado ? ` (${et.tiempoEstimado} min)` : ''}`);

    const instrucciones = parseInstrucciones(et.instrucciones);
    let stepNum = 0;
    instrucciones.forEach(item => {
      const text = item.text || item;
      const tipo = item.tipo || 'paso';
      const alarmMin = parseInt(item.alarmMin) || 0;
      const num = tipo === 'viñeta' ? '-' : `${++stepNum}.`;
      lines.push(`  ${num} ${text}${alarmMin > 0 ? ` (alarma: ${alarmMin} min)` : ''}`);
    });

    const insumos = (et.insumos || []).filter(ins => ins.nombre);
    if (insumos.length) {
      lines.push('  Insumos:');
      insumos.forEach(ins => lines.push(`    - ${ins.nombre}: ${ins.cantidad} ${ins.unidad}`));
    }
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${rec.nombre.replace(/[^\w\-]+/g, '_')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('btnCloseRecetaDetail').addEventListener('click', () => {
  document.getElementById('recetaDetailOverlay').classList.remove('open');
});
document.getElementById('recetaDetailOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('recetaDetailOverlay'))
    document.getElementById('recetaDetailOverlay').classList.remove('open');
});

// ── Procesos: Ejecucion analysis ──────────────────────────────────────────────

function generateEjecucionAnalysis(ej) {
  const ev     = ej.evaluacion || {};
  const etapas = ej.etapasData || [];
  if (!etapas.length && !ev.scoreTotal && !ev.rendimiento) return '';

  let html = '<div class="analysis-block"><div class="analysis-title">📊 Análisis de la ejecución</div>';

  // Time precision
  const receta = recetas.find(r => r.id === ej.recetaId);
  const durReal = +ej.duracionTotal || 0;
  if (receta) {
    const durPlan = receta.etapas.reduce((sum, et) => sum + (et.tiempoEstimado || 0) * 60, 0);
    if (durPlan > 0) {
      const prec = Math.max(0, Math.round(100 - Math.abs((durReal - durPlan) / durPlan * 100)));
      const color = prec >= 80 ? '#10B981' : prec >= 60 ? '#F59E0B' : '#EF4444';
      html += `<div class="analysis-row">
        <span class="analysis-label">Precisión temporal</span>
        <span class="analysis-value" style="color:${color};font-weight:700">${prec}%</span>
      </div>`;
      html += `<div class="analysis-row">
        <span class="analysis-label">Tiempo real / planificado</span>
        <span class="analysis-value">${Math.round(durReal/60)} min / ${Math.round(durPlan/60)} min</span>
      </div>`;
    }
  }

  // Stage breakdown
  if (etapas.length > 0) {
    html += '<div class="analysis-subtitle">Tiempo por etapa</div>';
    etapas.forEach((et, i) => {
      const planned = receta?.etapas.find(e => e.nombre === et.nombre)?.tiempoEstimado;
      const realMin = Math.round(et.duracionReal / 60);
      let diffStr   = '';
      if (planned) {
        const delta = Math.round(et.duracionReal / 60) - planned;
        if (delta > 0) diffStr = `<span style="color:#F59E0B">+${delta} min</span>`;
        else if (delta < 0) diffStr = `<span style="color:#10B981">${delta} min</span>`;
        else diffStr = `<span style="color:#10B981">exacto ✓</span>`;
      }
      html += `<div class="analysis-stage-row">
        <span class="analysis-stage-name">Etapa ${i+1}: ${esc(et.nombre)}</span>
        <span>${realMin} min${planned ? ` / ${planned} min plan ${diffStr}` : ''}</span>
      </div>`;
    });
  }

  // Insumo variance
  const variances = etapas.flatMap(et =>
    (et.insumosConfirmados || []).filter(ins => Math.abs(ins.cantidadReal - ins.cantidadPlanificada) > 0.01)
  );
  if (variances.length) {
    html += '<div class="analysis-subtitle">Variaciones en insumos</div>';
    variances.forEach(ins => {
      const delta = ins.cantidadReal - ins.cantidadPlanificada;
      const pct   = Math.round(Math.abs(delta) / (ins.cantidadPlanificada || 1) * 100);
      const color = pct > 10 ? '#F59E0B' : '#10B981';
      html += `<div class="analysis-row">
        <span class="analysis-label">${esc(ins.nombre)}</span>
        <span style="color:${color}">${ins.cantidadReal} vs ${ins.cantidadPlanificada} ${esc(ins.unidad)} (${delta > 0 ? '+' : ''}${delta.toFixed(1)})</span>
      </div>`;
    });
  }

  // Quality summary
  if (ev.scoreTotal !== undefined) {
    const lvl = SCORE_LEVELS.find(l => ev.scoreTotal >= l.min) || SCORE_LEVELS[SCORE_LEVELS.length - 1];
    html += `<div class="analysis-row" style="border-top:1px solid var(--border);padding-top:8px;margin-top:8px">
      <span class="analysis-label">Puntaje calidad</span>
      <span class="analysis-value">${ev.scoreTotal}/30 — ${lvl.label}</span>
    </div>`;
  }
  if (ev.ph !== undefined) {
    const phColor = ev.ph <= 4.0 ? '#10B981' : ev.ph <= 4.4 ? '#F59E0B' : '#EF4444';
    const phLabel = ev.ph <= 4.0 ? '✓ Óptimo' : ev.ph <= 4.4 ? '⚠ Aceptable (no óptimo)' : '✗ Revisar';
    html += `<div class="analysis-row">
      <span class="analysis-label">pH medido</span>
      <span class="analysis-value" style="color:${phColor}">${ev.ph} ${phLabel}</span>
    </div>`;
  }
  if (ev.rendimiento) {
    const color = ev.rendimiento >= 80 ? '#10B981' : ev.rendimiento >= 65 ? '#F59E0B' : '#EF4444';
    html += `<div class="analysis-row">
      <span class="analysis-label">Rendimiento</span>
      <span class="analysis-value" style="color:${color}">${ev.rendimiento.toFixed(1)}% (${(ev.frascos230||0)*230+(ev.frascos180||0)*180+(ev.excedente||0)} ml de ${ev.totalInsumosG || '?'} g)</span>
    </div>`;
  }
  if (ev.frascos230 || ev.frascos180) {
    const total = (ev.frascos230 || 0) + (ev.frascos180 || 0);
    html += `<div class="analysis-row">
      <span class="analysis-label">Frascos producidos</span>
      <span class="analysis-value">${total} total (${ev.frascos230 || 0}×230ml + ${ev.frascos180 || 0}×180ml)</span>
    </div>`;
  }
  if (ev.costoProduccion != null) {
    const incompleto = (ev.costoIncompleto || []).length > 0;
    html += `<div class="analysis-row">
      <span class="analysis-label">Costo de producción</span>
      <span class="analysis-value" style="${incompleto ? 'color:#F97316' : ''}">${fmtCOP(ev.costoProduccion)}${incompleto ? ` (incompleto: sin compra de ${ev.costoIncompleto.join(', ')})` : ''}</span>
    </div>`;
  }

  html += '</div>';
  return html;
}

// ── Procesos: Ejecucion detail (read-only + observations) ────────────────────

function openEjecucionDetail(ejId) {
  const ej = ejecuciones.find(e => e.id === ejId);
  if (!ej) return;
  ejecucionDetailId = ejId;

  const ev     = ej.evaluacion || {};
  const stars  = ev.calificacion ? '★'.repeat(ev.calificacion) + '☆'.repeat(5 - ev.calificacion) : '';
  const durMin = ej.duracionTotal ? Math.round(+ej.duracionTotal / 60) + ' min' : '—';

  const etapasHTML = (ej.etapasData || []).length
    ? `<div class="detail-etapas-list">
        ${ej.etapasData.map((et, i) => {
          const durEt = Math.floor(et.duracionReal / 60) + ':' + String(et.duracionReal % 60).padStart(2, '0') + ' min';
          const insHTML = (et.insumosConfirmados || []).map(ins =>
            `<div class="detail-insumo-row">• ${esc(ins.nombre)}: <strong>${ins.cantidadReal} ${esc(ins.unidad)}</strong><span class="detail-insumo-planned"> (plan: ${ins.cantidadPlanificada})</span></div>`
          ).join('');
          const stageObs = normalizeObsList(et.observaciones);
          const obsHTML = stageObs.length
            ? `<div class="detail-etapa-obs-title">Observaciones:</div>${stageObs.map(o => `<div class="detail-insumo-row">• ${esc(o.text)}</div>`).join('')}`
            : '';
          return `<div class="detail-etapa-item">
            <div class="detail-etapa-nombre">Etapa ${i + 1}: ${esc(et.nombre)}</div>
            <div class="detail-etapa-dur">⏱ ${durEt}</div>
            ${insHTML}
            ${obsHTML}
          </div>`;
        }).join('')}
      </div>`
    : '';

  // Generate analysis
  const analysisHTML = generateEjecucionAnalysis(ej);

  document.getElementById('ejecucionDetailTitle').textContent = ej.nombreReceta;
  document.getElementById('ejecucionDetailContent').innerHTML = `
    <div class="detail-row"><span class="detail-label">Lote</span><span class="detail-value">${esc(ej.loteId || '—')}</span></div>
    ${ev.fechaVencimiento ? `<div class="detail-row"><span class="detail-label">Vencimiento</span><span class="detail-value">${esc(ev.fechaVencimiento)}</span></div>` : ''}
    <div class="detail-row"><span class="detail-label">Estado</span><span class="status-pill" style="background:#2E7D3222;color:#2E7D32">${esc(ej.estado)}</span></div>
    <div class="detail-row"><span class="detail-label">Inicio</span><span class="detail-value">${fmtDate(ej.fechaInicio)}</span></div>
    <div class="detail-row"><span class="detail-label">Fin</span><span class="detail-value">${fmtDate(ej.fechaFin)}</span></div>
    <div class="detail-row"><span class="detail-label">Duración</span><span class="detail-value">${durMin}</span></div>
    ${stars ? `<div class="detail-row"><span class="detail-label">Calificación</span><span class="detail-value ejecucion-stars">${stars}</span></div>` : ''}
    ${normalizeObsList(ev.observaciones).length ? `<div class="detail-row detail-row--col"><span class="detail-label">Evaluación</span><span class="detail-value">${normalizeObsList(ev.observaciones).map(o => `• ${esc(o.text)}`).join('<br>')}</span></div>` : ''}
    ${etapasHTML ? `<div class="detail-row detail-row--col"><span class="detail-label">Etapas</span>${etapasHTML}</div>` : ''}
    ${analysisHTML}
    <div style="margin-top:12px">
      <button class="btn-outline" id="btnDownloadEjecucionTxt" style="width:100%">${ICON_DOWNLOAD} Descargar TXT de esta ejecución</button>
    </div>
  `;

  document.getElementById('btnDownloadEjecucionTxt')?.addEventListener('click', () => downloadSingleEjecucionTxt(ej));

  renderEjecucionObsList(ej);
  document.getElementById('ejecucionObsInput').value = '';
  document.getElementById('ejecucionDetailOverlay').classList.add('open');
}

function renderEjecucionObsList(ej) {
  const list = document.getElementById('ejecucionObsList');
  const obs  = ej.observations || [];
  if (!obs.length) {
    list.innerHTML = '<div class="obs-empty">Aún sin observaciones</div>';
    return;
  }
  list.innerHTML = obs.map(o => `
    <div class="obs-item">
      <div class="obs-text">${esc(o.text)}</div>
      <div class="obs-date">${fmtDate(o.createdAt)}</div>
    </div>
  `).join('');
  list.scrollTop = list.scrollHeight;
}

document.getElementById('btnCloseEjecucionDetail').addEventListener('click', () => {
  document.getElementById('ejecucionDetailOverlay').classList.remove('open');
});
document.getElementById('ejecucionDetailOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('ejecucionDetailOverlay'))
    document.getElementById('ejecucionDetailOverlay').classList.remove('open');
});

document.getElementById('btnAddEjecucionObs').addEventListener('click', async () => {
  const text = document.getElementById('ejecucionObsInput').value.trim();
  if (!text) return;
  const ej = ejecuciones.find(e => e.id === ejecucionDetailId);
  if (!ej) return;

  const btn = document.getElementById('btnAddEjecucionObs');
  btn.disabled = true;
  try {
    ej.observations = ej.observations || [];
    ej.observations.push({ text, createdAt: new Date().toISOString() });
    await updateEjecucion(ej);
    document.getElementById('ejecucionObsInput').value = '';
    renderEjecucionObsList(ej);
  } catch (e) {
    alert('Error al guardar: ' + e.message);
  } finally {
    btn.disabled = false;
  }
});

// ── Procesos: Sub-tab navigation ──────────────────────────────────────────────

document.querySelectorAll('[data-procesostab]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentProcesosTab = btn.dataset.procesostab;
    document.querySelectorAll('[data-procesostab]').forEach(b =>
      b.classList.toggle('active', b.dataset.procesostab === currentProcesosTab)
    );
    document.getElementById('subTabRecetas').style.display     = currentProcesosTab === 'recetas'     ? '' : 'none';
    document.getElementById('subTabEjecuciones').style.display = currentProcesosTab === 'ejecuciones' ? '' : 'none';
    document.getElementById('btnNewReceta').style.display      = currentProcesosTab === 'recetas'     ? '' : 'none';
    document.getElementById('btnManageRecetaBlocks').style.display = currentProcesosTab === 'recetas' ? '' : 'none';
  });
});

// ── Procesos: Ingredientes maestros de receta (checklist) ────────────────────

function renderIngredientesMaestrosList(savedMaestros) {
  const container = document.getElementById('ingredientesMaestrosList');
  const addBtn    = document.getElementById('btnAddIngMaestro');
  if (addBtn) addBtn.style.display = 'none';
  if (!container) return;
  container.innerHTML = '';

  if (!ingredientes.length) {
    container.innerHTML = '<p class="mgmt-note" style="margin:8px 0">Sin ingredientes en el catálogo. Agrégalos con 🧂 Ingredientes.</p>';
    return;
  }

  ingredientes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(ing => {
    const saved     = (savedMaestros || []).find(s => normalizeIngName(s.nombre) === normalizeIngName(ing.nombre));
    const isChecked = !!saved;

    const row = document.createElement('div');
    row.className = 'ing-check-row';
    row.innerHTML = `
      <label class="ing-check-label">
        <input type="checkbox" class="ing-check-cb" data-nombre="${esc(ing.nombre)}" ${isChecked ? 'checked' : ''} />
        <span class="ing-check-nombre">${esc(ing.nombre)}</span>
      </label>
      <div class="ing-check-qty-wrap" style="${isChecked ? '' : 'visibility:hidden'}">
        <input class="field-input ing-check-qty" type="number" min="0" step="any" value="${isChecked && saved.cantidadTotal ? saved.cantidadTotal : ''}" placeholder="Total" style="width:78px" />
        <span class="ing-check-unidad-display">${esc(ing.unidad || '—')}</span>
        <span class="ing-check-auto-badge" title="Calculado desde etapas">⟳ auto</span>
      </div>
    `;

    const cb   = row.querySelector('.ing-check-cb');
    const wrap = row.querySelector('.ing-check-qty-wrap');
    cb.addEventListener('change', () => {
      wrap.style.visibility = cb.checked ? '' : 'hidden';
      if (!cb.checked) {
        row.querySelector('.ing-check-qty').value = '';
        row.querySelector('.ing-check-auto-badge').style.display = 'none';
      }
    });

    container.appendChild(row);
  });
}

function collectIngredientesMaestros() {
  return Array.from(document.querySelectorAll('.ing-check-row'))
    .filter(row => row.querySelector('.ing-check-cb').checked)
    .map(row => {
      const nombre = row.querySelector('.ing-check-cb').dataset.nombre;
      return {
        nombre,
        cantidadTotal: parseFloat(row.querySelector('.ing-check-qty').value) || 0,
        unidad:        getIngredienteUnidad(nombre)
      };
    });
}

function syncIngMaestroTotals() {
  const totals = {};
  document.querySelectorAll('#etapasList .etapa-item:not([data-fija]) .insumo-row').forEach(row => {
    const nombre = row.querySelector('.insumo-nombre')?.value.trim();
    if (!nombre) return;
    const qty   = parseFloat(row.querySelector('.insumo-cantidad')?.value) || 0;
    const key   = normalizeIngName(nombre);
    totals[key] = (totals[key] || 0) + qty;
  });

  document.querySelectorAll('.ing-check-row').forEach(row => {
    const cb    = row.querySelector('.ing-check-cb');
    const key   = normalizeIngName(cb.dataset.nombre);
    const wrap  = row.querySelector('.ing-check-qty-wrap');
    const qtyIn = row.querySelector('.ing-check-qty');
    const badge = row.querySelector('.ing-check-auto-badge');

    if (totals[key] !== undefined && totals[key] > 0) {
      if (!cb.checked) { cb.checked = true; wrap.style.visibility = ''; }
      qtyIn.value = totals[key];
      if (badge) badge.style.display = '';
    } else {
      if (badge) badge.style.display = 'none';
    }
  });
}

// ── Procesos: Receta modal (crear / editar) ───────────────────────────────────

function openRecetaModal(editId) {
  editRecetaId = editId || null;
  const overlay = document.getElementById('recetaOverlay');
  document.getElementById('recetaFeedback').textContent = '';

  if (editId) {
    const rec = recetas.find(r => r.id === editId);
    if (!rec) return;
    document.getElementById('recetaModalTitle').textContent = 'Editar receta';
    document.getElementById('recetaNombre').value = rec.nombre;
    document.getElementById('recetaDesc').value   = rec.descripcion || '';
    const etapas       = rec.etapas || [];
    const fixedStages   = etapas.filter(e => e.fija);
    const middleEtapas  = etapas.filter(e => !e.fija);
    recetaFixedFirst = fixedStages[0] || { ...LIMPIEZA_ETAPA, id: crypto.randomUUID() };
    recetaFixedLast  = fixedStages[fixedStages.length - 1] || { ...LIMPIEZA_ETAPA, id: crypto.randomUUID() };
    renderEtapasList(middleEtapas);
    renderIngredientesMaestrosList(rec.ingredientesMaestros || []);
  } else {
    document.getElementById('recetaModalTitle').textContent = 'Nueva receta';
    document.getElementById('recetaNombre').value = '';
    document.getElementById('recetaDesc').value   = '';
    recetaFixedFirst = { ...LIMPIEZA_ETAPA, id: crypto.randomUUID() };
    recetaFixedLast  = { ...LIMPIEZA_ETAPA, id: crypto.randomUUID() };
    renderEtapasList([]);
    renderIngredientesMaestrosList([]);
  }

  overlay.classList.add('open');
  setTimeout(() => document.getElementById('recetaNombre').focus(), 100);
}

function renderEtapasList(etapas) {
  const container = document.getElementById('etapasList');
  container.innerHTML = '';
  etapas.forEach((et, idx) => addEtapaToList(et, idx));
}

function addEtapaToList(etapa, idx, insertBeforeEl) {
  const container = document.getElementById('etapasList');
  const num = idx !== undefined ? idx : container.querySelectorAll('.etapa-item').length;
  const instrArr = parseInstrucciones(etapa.instrucciones);
  const isEditing = !!editRecetaId;
  const isFija = !!etapa.fija;

  const item = document.createElement('div');
  item.className = 'etapa-item' + (isFija ? ' etapa-item--fija' : '');
  if (isFija) item.dataset.fija = 'true';

  item.innerHTML = `
    <div class="etapa-header">
      <span class="etapa-num">Etapa ${num + 2}</span>
      ${isFija ? '<span class="etapa-fija-tag">🔒 Fija</span>' : ''}
      <button class="etapa-collapse-btn" title="Colapsar/Expandir etapa">▼</button>
      ${isFija ? '' : '<button class="etapa-del" title="Eliminar etapa">✕</button>'}
    </div>
    <div class="etapa-body">
      <label class="field-label">Nombre de la etapa *</label>
      <input class="field-input etapa-nombre" type="text" value="${esc(etapa.nombre || '')}" placeholder="Ej: Lavado de materia prima" />
      <label class="field-label">Instrucciones <span class="field-label-hint">· # = paso numerado &nbsp;•  = viñeta</span></label>
      <div class="instrucciones-list"></div>
      <button class="btn-outline btn-sm btn-add-instruccion" style="margin-top:4px;margin-bottom:14px">+ Agregar instrucción</button>
      <label class="field-label">Tiempo estimado (minutos)</label>
      <input class="field-input etapa-tiempo" type="number" min="1" value="${etapa.tiempoEstimado || ''}" placeholder="15" style="width:120px" />
      ${!isFija ? `
      <label class="field-label">Insumos / ingredientes</label>
      <div class="insumos-list"></div>
      <button class="btn-outline btn-sm btn-add-insumo" style="margin-top:4px">+ Agregar insumo</button>
      ` : ''}
    </div>
  `;

  // Populate instruction rows
  const instrList = item.querySelector('.instrucciones-list');
  instrArr.forEach(instr => instrList.appendChild(buildInstruccionRow(instr.text, instr.tipo, instr.alarmMin)));

  // Populate insumo rows (non-fixed stages only)
  const insList = item.querySelector('.insumos-list');
  if (insList) (etapa.insumos || []).forEach((ins, iIdx) => insList.appendChild(buildInsumoRow(ins, iIdx)));

  // Collapse/expand toggle
  const collapseBtn = item.querySelector('.etapa-collapse-btn');
  const etapaBody   = item.querySelector('.etapa-body');

  // Collapse non-first stages when editing; always collapse fixed stages beyond first
  if ((isEditing && idx !== undefined && idx > 0) || (isFija && num > 0)) {
    etapaBody.style.display = 'none';
    collapseBtn.textContent = '▶';
  }

  collapseBtn.addEventListener('click', () => {
    if (!etapaBody) return;
    const collapsed = etapaBody.style.display === 'none';
    etapaBody.style.display = collapsed ? '' : 'none';
    collapseBtn.textContent  = collapsed ? '▼' : '▶';
  });

  const delBtn = item.querySelector('.etapa-del');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      item.remove();
      renumberEtapas();
    });
  }
  item.querySelector('.btn-add-instruccion').addEventListener('click', () => {
    instrList.appendChild(buildInstruccionRow('', 'paso'));
    instrList.lastElementChild.querySelector('.instruccion-text').focus();
  });
  const addInsumoBtn = item.querySelector('.btn-add-insumo');
  if (addInsumoBtn && insList) {
    addInsumoBtn.addEventListener('click', () => {
      insList.appendChild(buildInsumoRow({}, insList.children.length));
    });
  }

  if (insertBeforeEl) {
    container.insertBefore(item, insertBeforeEl);
  } else {
    container.appendChild(item);
  }
}

function parseInstrucciones(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map(item => typeof item === 'string' ? { text: item, tipo: 'paso' } : item);
  }
  return val.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text, tipo: 'paso' }));
}

function buildInstruccionesHTML(instrucciones, interactive = false) {
  const arr = parseInstrucciones(instrucciones);
  if (!arr.length) return '';
  let stepNum = 0;
  return `<div class="exec-instrucciones">
    ${arr.map(item => {
      const text     = item.text || item;
      const tipo     = item.tipo || 'paso';
      const alarmMin = parseInt(item.alarmMin) || 0;
      const num = tipo === 'viñeta' ? '•' : `${++stepNum}.`;
      let alarmHTML = '';
      if (alarmMin > 0) {
        alarmHTML = interactive
          ? `<button type="button" class="instr-alarm-btn" data-alarm-min="${alarmMin}" data-instr-text="${esc(text)}">▶ Iniciar alarma (${alarmMin} min)</button>`
          : `<span class="exec-instruccion-alarm">⏰ ${alarmMin} min</span>`;
      }
      return `<div class="exec-instruccion-row"><span class="exec-instruccion-num">${num}</span> ${esc(text)}${alarmHTML}</div>`;
    }).join('')}
  </div>`;
}

function buildInstruccionRow(text, tipo = 'paso', alarmMin) {
  const row = document.createElement('div');
  row.className = 'instruccion-row';
  row.innerHTML = `
    <span class="instr-drag-handle" title="Arrastrar para reordenar">⠿</span>
    <button class="instruccion-tipo-btn" data-tipo="${tipo}" type="button" title="${tipo === 'viñeta' ? 'Cambiar a paso numerado' : 'Cambiar a viñeta'}">${tipo === 'viñeta' ? '•' : '#'}</button>
    <input class="field-input instruccion-text" type="text" value="${esc(text || '')}" placeholder="Describir el paso…" style="flex:1" />
    <input class="field-input instruccion-alarm" type="number" min="1" step="1" value="${alarmMin ? esc(String(alarmMin)) : ''}" placeholder="⏰ min" title="Alarma con sonido (minutos, opcional)" style="width:72px;flex:none" />
    <button class="subtask-remove" title="Quitar paso">✕</button>
  `;

  row.querySelector('.instruccion-tipo-btn').addEventListener('click', e => {
    const btn    = e.currentTarget;
    const newTipo = btn.dataset.tipo === 'viñeta' ? 'paso' : 'viñeta';
    btn.dataset.tipo = newTipo;
    btn.textContent  = newTipo === 'viñeta' ? '•' : '#';
    btn.title        = newTipo === 'viñeta' ? 'Cambiar a paso numerado' : 'Cambiar a viñeta';
  });
  row.querySelector('.subtask-remove').addEventListener('click', () => row.remove());

  // ── Drag to reorder within the same instrucciones-list ──────────────────
  const handle = row.querySelector('.instr-drag-handle');

  // Only make row draggable while pressing the handle
  handle.addEventListener('mousedown', () => { row.draggable = true; });
  document.addEventListener('mouseup', () => { row.draggable = false; }, { passive: true });

  row.addEventListener('dragstart', e => {
    draggedInstrRow  = row;
    draggedInstrList = row.parentElement;
    row.classList.add('instr-dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  row.addEventListener('dragend', () => {
    row.draggable = false;
    row.classList.remove('instr-dragging');
    document.querySelectorAll('.instruccion-row.instr-drag-over').forEach(r => r.classList.remove('instr-drag-over'));
    draggedInstrRow = null; draggedInstrList = null;
  });

  row.addEventListener('dragover', e => {
    if (!draggedInstrRow || draggedInstrRow === row) return;
    if (row.parentElement !== draggedInstrList) return;
    e.preventDefault();
    row.classList.add('instr-drag-over');
  });

  row.addEventListener('dragleave', () => row.classList.remove('instr-drag-over'));

  row.addEventListener('drop', e => {
    row.classList.remove('instr-drag-over');
    if (!draggedInstrRow || draggedInstrRow === row) return;
    if (row.parentElement !== draggedInstrList) return;
    e.preventDefault();
    const list = row.parentElement;
    const rows = Array.from(list.children);
    const fromIdx = rows.indexOf(draggedInstrRow);
    const toIdx   = rows.indexOf(row);
    list.insertBefore(draggedInstrRow, fromIdx < toIdx ? row.nextSibling : row);
  });

  return row;
}

function buildInsumoRow(ins, idx) {
  const row = document.createElement('div');
  row.className = 'insumo-row';
  const unidad = getIngredienteUnidad(ins.nombre || '');
  row.innerHTML = `
    <input class="field-input insumo-nombre" type="text" value="${esc(ins.nombre || '')}" placeholder="Insumo" style="flex:2" autocomplete="off" />
    <input class="field-input insumo-cantidad" type="number" value="${ins.cantidad || ''}" placeholder="Cant." style="flex:1;min-width:70px" min="0" step="any" />
    <span class="insumo-unidad-display" title="Unidad definida en el ingrediente">${esc(unidad || '—')}</span>
    <button class="subtask-remove" title="Quitar">✕</button>
  `;
  const nombreInput   = row.querySelector('.insumo-nombre');
  const unidadDisplay = row.querySelector('.insumo-unidad-display');
  row.querySelector('.subtask-remove').addEventListener('click', () => { row.remove(); syncIngMaestroTotals(); });
  row.querySelector('.insumo-cantidad').addEventListener('input', syncIngMaestroTotals);
  nombreInput.addEventListener('change', () => {
    unidadDisplay.textContent = getIngredienteUnidad(nombreInput.value.trim()) || '—';
    syncIngMaestroTotals();
  });
  attachIngredienteAutocomplete(nombreInput);
  return row;
}

function renumberEtapas() {
  document.querySelectorAll('#etapasList .etapa-item').forEach((item, i) => {
    const span = item.querySelector('.etapa-num');
    if (span) span.textContent = `Etapa ${i + 2}`;
  });
}

function collectEtapas() {
  return Array.from(document.querySelectorAll('#etapasList .etapa-item')).map(item => {
    const insumos = Array.from(item.querySelectorAll('.insumo-row')).map(row => {
      const nombre = row.querySelector('.insumo-nombre').value.trim();
      return {
        nombre,
        cantidad: parseFloat(row.querySelector('.insumo-cantidad').value) || 0,
        unidad:   getIngredienteUnidad(nombre)
      };
    }).filter(ins => ins.nombre);
    const instrucciones = Array.from(item.querySelectorAll('.instruccion-row'))
      .map(row => ({
        text: row.querySelector('.instruccion-text').value.trim(),
        tipo: row.querySelector('.instruccion-tipo-btn')?.dataset.tipo || 'paso',
        alarmMin: parseInt(row.querySelector('.instruccion-alarm')?.value) || 0
      }))
      .filter(i => i.text);
    return {
      id:             crypto.randomUUID(),
      nombre:         item.querySelector('.etapa-nombre').value.trim(),
      instrucciones,
      tiempoEstimado: parseInt(item.querySelector('.etapa-tiempo').value) || 0,
      insumos,
      fija:           false
    };
  }).filter(et => et.nombre);
}

// Etapas fijas (Limpieza inicial/final) + las etapas editables del medio,
// en el orden real en que se ejecutan.
function collectEtapasFull() {
  return [recetaFixedFirst, ...collectEtapas(), recetaFixedLast];
}

document.getElementById('btnAddEtapa').addEventListener('click', () => {
  addEtapaToList({}, undefined);
  renumberEtapas();
});

function isRecetaFormDirty() {
  const nombre = document.getElementById('recetaNombre')?.value.trim();
  const desc   = document.getElementById('recetaDesc')?.value.trim();
  const hasEtapas       = document.querySelectorAll('#etapasList .etapa-item').length > 0;
  const hasIngredientes = document.querySelectorAll('.ing-check-cb:checked').length > 0;
  return !!(nombre || desc || hasEtapas || hasIngredientes);
}

function closeRecetaModal() {
  confirmCloseIfDirty('recetaOverlay', isRecetaFormDirty);
}

document.getElementById('btnCloseReceta').addEventListener('click', closeRecetaModal);
document.getElementById('recetaOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('recetaOverlay')) closeRecetaModal();
});

document.getElementById('btnSaveReceta').addEventListener('click', async () => {
  const nombre       = document.getElementById('recetaNombre').value.trim();
  const desc         = document.getElementById('recetaDesc').value.trim();
  const middleEtapas = collectEtapas();
  const etapas       = collectEtapasFull();
  const fb           = document.getElementById('recetaFeedback');

  if (!nombre) return setFb(fb, 'El nombre de la receta es obligatorio.', 'err');
  if (!middleEtapas.length) return setFb(fb, 'Agrega al menos una etapa.', 'err');

  const ingredientesMaestros = collectIngredientesMaestros();
  const hayCantidadNegativa = etapas.some(et => et.insumos.some(ins => ins.cantidad < 0))
    || ingredientesMaestros.some(im => im.cantidadTotal < 0);
  if (hayCantidadNegativa) return setFb(fb, 'Las cantidades de insumos no pueden ser negativas.', 'err');

  const btn = document.getElementById('btnSaveReceta');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    if (editRecetaId) {
      const rec = recetas.find(r => r.id === editRecetaId);
      if (rec) {
        rec.nombre = nombre; rec.descripcion = desc; rec.etapas = etapas;
        rec.ingredientesMaestros = ingredientesMaestros;
        await updateReceta(rec);
      }
    } else {
      await appendReceta({
        id: crypto.randomUUID(), nombre, descripcion: desc, etapas,
        ingredientesMaestros,
        creadoEn: new Date().toISOString()
      });
    }
    await loadRecetasData();
    renderRecetasList();
    document.getElementById('recetaOverlay').classList.remove('open');
    setFb(fb, '✅ Receta guardada.', 'ok');
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar receta';
  }
});

document.getElementById('btnNewReceta').addEventListener('click', () => openRecetaModal(null));

// ── Escape key closes any open modal ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = document.querySelector('.modal-overlay.open');
  if (!open) return;
  // Don't close execution/recipe-editor modals accidentally — they confirm via their own buttons
  if (open.id === 'ejecutarOverlay') return;
  if (open.id === 'recetaOverlay') { closeRecetaModal(); return; }
  open.classList.remove('open');
});

// ── Procesos: Lot utilities ───────────────────────────────────────────────────

function generateLotId(recipeName) {
  const now  = new Date();
  const abbr = (recipeName || 'LOT').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'LOT';
  const opts = { timeZone: 'America/Bogota' };
  const date = now.toLocaleDateString('en-CA', opts).replace(/-/g, '');
  const time = now.toLocaleTimeString('es-CO', { ...opts, hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '');
  return `TQ-${abbr}-${date}-${time}`;
}

const LIMPIEZA_ETAPA = {
  nombre: 'Limpieza',
  instrucciones: [
    { text: 'Limpieza de barril', tipo: 'viñeta' },
    { text: 'Limpieza de pisos', tipo: 'viñeta' },
    { text: 'Limpieza de zona', tipo: 'viñeta' }
  ],
  tiempoEstimado: 60,
  insumos: [],
  fija: true
};

const SCORE_LEVELS = [
  { min: 27, label: 'ÓPTIMO',         cls: 'level-opt' },
  { min: 21, label: 'CORRECTO',       cls: 'level-ok'  },
  { min: 15, label: 'ACEPTABLE',      cls: 'level-acc' },
  { min:  9, label: 'EN DESARROLLO',  cls: 'level-dev' },
  { min:  0, label: 'REFORMULAR',     cls: 'level-bad' },
];

const SCORE_LEVELS_FASE1 = [
  { min: 18, label: 'ÓPTIMO',         cls: 'level-opt' },
  { min: 14, label: 'CORRECTO',       cls: 'level-ok'  },
  { min: 10, label: 'ACEPTABLE',      cls: 'level-acc' },
  { min:  6, label: 'EN DESARROLLO',  cls: 'level-dev' },
  { min:  0, label: 'REFORMULAR',     cls: 'level-bad' },
];

function updateEvalScore() {
  const phase1Dims = ['D1', 'D2', 'D4', 'D5'];
  const filled = phase1Dims.filter(d => evalScores[d] > 0).length;
  const total  = phase1Dims.reduce((sum, d) => sum + evalScores[d], 0);
  const valEl  = document.getElementById('evalScoreValue');
  const lvlEl  = document.getElementById('evalScoreLevel');
  if (!valEl) return;
  valEl.textContent = filled > 0 ? `${total}/20` : '—/20';
  if (filled === 4) {
    const lvl = SCORE_LEVELS_FASE1.find(l => total >= l.min) || SCORE_LEVELS_FASE1[SCORE_LEVELS_FASE1.length - 1];
    lvlEl.textContent = lvl.label;
    lvlEl.className   = `eval-score-level ${lvl.cls}`;
  } else {
    lvlEl.textContent = `${filled}/4 dimensiones evaluadas`;
    lvlEl.className   = 'eval-score-level';
  }
}

// ── Eval modal clock ──────────────────────────────────────────────────────────

function startEvalClock() {
  const el = document.getElementById('evalClock');
  if (!el) return;
  if (evalClockInterval) clearInterval(evalClockInterval);
  const update = () => {
    el.textContent = new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  };
  update();
  evalClockInterval = setInterval(update, 1000);
}

function stopEvalClock() {
  if (evalClockInterval) { clearInterval(evalClockInterval); evalClockInterval = null; }
}

// ── Procesos: Recipe execution with stage timer ───────────────────────────────

function saveExecutionProgress() {
  if (!executionState) return;
  try {
    localStorage.setItem('ss_exec_progress', JSON.stringify({
      recetaId:          executionState.receta.id,
      currentStageIndex: executionState.currentStageIndex,
      stagesData:        executionState.stagesData,
      stageObsDraft:     executionState.stageObsDraft || {},
      savedAt:           new Date().toISOString()
    }));
  } catch {}
}

function clearExecutionProgress() {
  localStorage.removeItem('ss_exec_progress');
}

function startExecution(recetaId) {
  const receta = recetas.find(r => r.id === recetaId);
  if (!receta || !receta.etapas.length) return alert('Esta receta no tiene etapas definidas.');

  // Check for saved in-progress execution
  const saved = safeParseJSON(localStorage.getItem('ss_exec_progress'), null);
  if (saved && saved.recetaId === recetaId) {
    const elapsed = Math.round((Date.now() - new Date(saved.savedAt)) / 60000);
    if (confirm(`Hay una ejecución guardada de esta receta (hace ${elapsed} min).\n¿Continuar desde la etapa ${saved.currentStageIndex + 1}?`)) {
      executionState = {
        receta,
        currentStageIndex: saved.currentStageIndex,
        stageStartTime:    Date.now(),
        timerInterval:     null,
        stagesData:        saved.stagesData,
        stageObsDraft:     saved.stageObsDraft || {}
      };
      document.getElementById('ejecutarTitle').textContent = `Receta: ${receta.nombre}`;
      document.getElementById('ejecutarOverlay').classList.add('open');
      renderExecutionStep();
      return;
    }
    clearExecutionProgress();
  }

  executionState = {
    receta,
    currentStageIndex: 0,
    stageStartTime: Date.now(),
    timerInterval: null,
    stagesData: [],
    stageObsDraft: {}
  };

  document.getElementById('ejecutarTitle').textContent = `Receta: ${receta.nombre}`;
  document.getElementById('ejecutarOverlay').classList.add('open');
  renderExecutionStep();
}

function goBackStage() {
  if (!executionState || executionState.currentStageIndex === 0) return;
  if (executionState.timerInterval) clearInterval(executionState.timerInterval);
  executionState.stagesData.pop();
  executionState.currentStageIndex--;
  renderExecutionStep();
}

function buildExecInsumosSection(receta, etapa) {
  const maestros = receta.ingredientesMaestros || [];
  if (maestros.length) {
    const rows = maestros.map((ing, i) => `
      <div class="exec-insumo-row">
        <span class="exec-insumo-nombre">${esc(ing.nombre)}</span>
        <span class="exec-insumo-planned">(total planeado: ${ing.cantidadTotal} ${esc(ing.unidad)})</span>
        <div style="display:flex;align-items:center;gap:6px">
          <input class="field-input exec-insumo-real" data-ing-idx="${i}" type="number" value="" min="0" step="any" style="width:90px" placeholder="0" />
          <span>${esc(ing.unidad)}</span>
        </div>
      </div>
    `).join('');
    return `
      <div class="exec-insumos-section">
        <h4 class="exec-insumos-title">¿Cuánto usaste en esta etapa?</h4>
        <p class="exec-insumos-note">Ingresa la cantidad real de cada ingrediente usado en esta etapa. Déjalo en 0 si no lo usaste aquí.</p>
        <div class="exec-insumos-list">${rows}</div>
      </div>`;
  }
  if (etapa.insumos && etapa.insumos.length) {
    const rows = etapa.insumos.map((ins, i) => `
      <div class="exec-insumo-row">
        <span class="exec-insumo-nombre">${esc(ins.nombre)}</span>
        <span class="exec-insumo-planned">(planeado: ${ins.cantidad} ${esc(ins.unidad)})</span>
        <div style="display:flex;align-items:center;gap:6px">
          <input class="field-input exec-insumo-real" data-idx="${i}" type="number" value="${ins.cantidad}" min="0" step="any" style="width:90px" />
          <span>${esc(ins.unidad)}</span>
        </div>
      </div>
    `).join('');
    return `
      <div class="exec-insumos-section">
        <h4 class="exec-insumos-title">Confirmar insumos usados</h4>
        <p class="exec-insumos-note">Verifica o ajusta las cantidades reales antes de continuar.</p>
        <div class="exec-insumos-list">${rows}</div>
      </div>`;
  }
  return '';
}

function maybeShowComparacion(receta, stagesData) {
  const maestros = receta.ingredientesMaestros || [];
  if (maestros.length) {
    showComparacionIngredientes(receta, stagesData);
  } else {
    document.getElementById('evaluacionOverlay').classList.add('open');
    startEvalClock();
  }
}

function showComparacionIngredientes(receta, stagesData) {
  const maestros = receta.ingredientesMaestros || [];
  const totalReal = {};
  stagesData.forEach(stage => {
    (stage.insumosConfirmados || []).forEach(ins => {
      const key = normalizeIngName(ins.nombre);
      totalReal[key] = (totalReal[key] || { nombre: ins.nombre, cantidad: 0, unidad: ins.unidad });
      totalReal[key].cantidad += parseFloat(ins.cantidadReal) || 0;
    });
  });

  const rows = maestros.map(ing => {
    const key    = normalizeIngName(ing.nombre);
    const real   = totalReal[key] ? totalReal[key].cantidad : 0;
    const plan   = parseFloat(ing.cantidadTotal) || 0;
    const delta  = real - plan;
    const sign   = delta > 0 ? '+' : '';
    const cls    = Math.abs(delta) < 0.001 ? 'comp-delta--ok' : (delta < 0 ? 'comp-delta--low' : 'comp-delta--high');
    return `
      <div class="comp-row">
        <span class="comp-nombre">${esc(ing.nombre)}</span>
        <span class="comp-plan">${plan} ${esc(ing.unidad)}</span>
        <span class="comp-actual">${real} ${esc(ing.unidad)}</span>
        <span class="comp-delta ${cls}">${sign}${delta.toFixed(2)}</span>
      </div>`;
  }).join('');

  document.getElementById('comparacionBody').innerHTML = `
    <div class="comp-header">
      <span class="comp-nombre">Ingrediente</span>
      <span class="comp-plan">Planeado</span>
      <span class="comp-actual">Usado</span>
      <span class="comp-delta">Diferencia</span>
    </div>
    ${rows}
  `;
  document.getElementById('comparacionOverlay').classList.add('open');
}

document.getElementById('btnContinuarEval').addEventListener('click', () => {
  document.getElementById('comparacionOverlay').classList.remove('open');
  document.getElementById('evaluacionOverlay').classList.add('open');
  startEvalClock();
});

function renderExecStageObsList() {
  const list = document.getElementById('execStageObsList');
  if (!list || !executionState) return;
  const rows = (executionState.stageObsDraft || {})[executionState.currentStageIndex] || [];
  if (!rows.length) {
    list.innerHTML = '<div class="obs-empty">Aún sin observaciones</div>';
    return;
  }
  list.innerHTML = rows.map(o => `<div class="obs-item"><div class="obs-text">${esc(o.text)}</div></div>`).join('');
  list.scrollTop = list.scrollHeight;
}

function renderExecutionStep() {
  if (!executionState) return;
  const { receta, currentStageIndex } = executionState;
  const etapa = receta.etapas[currentStageIndex];
  const total = receta.etapas.length;
  const isLast = currentStageIndex === total - 1;

  if (executionState.timerInterval) clearInterval(executionState.timerInterval);
  (executionState.alarmTimeouts || []).forEach(id => clearTimeout(id));
  (executionState.alarmIntervals || []).forEach(id => clearInterval(id));
  executionState.alarmTimeouts  = [];
  executionState.alarmIntervals = [];
  executionState.stageStartTime = Date.now();

  const body = document.getElementById('ejecutarBody');
  body.innerHTML = `
    <div class="exec-progress">
      <div class="exec-progress-bar" style="width:${((currentStageIndex + 1) / total * 100).toFixed(0)}%"></div>
    </div>
    <div class="exec-step-nav">
      ${currentStageIndex > 0 ? `<button class="btn-back-stage" id="btnBackStage">← Etapa anterior</button>` : '<span></span>'}
      <div class="exec-step-label">Etapa ${currentStageIndex + 1} de ${total}</div>
    </div>
    <h3 class="exec-stage-name">ETAPA ${currentStageIndex + 1}: ${esc(etapa.nombre)}</h3>
    ${buildInstruccionesHTML(etapa.instrucciones, true)}
    ${etapa.tiempoEstimado ? `<div class="exec-time-hint">⏱ Tiempo estimado: ${etapa.tiempoEstimado} min</div>` : ''}

    <div class="exec-timer-wrap">
      <div class="exec-timer-label">Tiempo en esta etapa</div>
      <div class="exec-timer" id="execTimer">00:00</div>
    </div>

    ${buildExecInsumosSection(receta, etapa)}

    <div class="exec-obs-section">
      <h4 class="exec-insumos-title">Observaciones de esta etapa</h4>
      <div id="execStageObsList" class="obs-list"></div>
      <div class="obs-input-wrap">
        <textarea class="field-textarea obs-textarea" id="execStageObsInput" rows="2" placeholder="Escribe una observación de esta etapa…"></textarea>
        <button type="button" class="btn-outline obs-btn" id="btnAddExecStageObs">Agregar</button>
      </div>
    </div>

    <div style="margin-top:20px">
      <button class="btn-primary exec-next-btn" id="btnNextStage">
        ${isLast
          ? ICON_CHECK + 'Finalizar receta'
          : 'Siguiente etapa <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-left:4px"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'}
      </button>
    </div>
  `;

  renderExecStageObsList();
  document.getElementById('btnAddExecStageObs').addEventListener('click', () => {
    const input = document.getElementById('execStageObsInput');
    const text  = input.value.trim();
    if (!text) return;
    executionState.stageObsDraft = executionState.stageObsDraft || {};
    const idx = executionState.currentStageIndex;
    executionState.stageObsDraft[idx] = executionState.stageObsDraft[idx] || [];
    executionState.stageObsDraft[idx].push({ text, createdAt: new Date().toISOString() });
    input.value = '';
    renderExecStageObsList();
    saveExecutionProgress();
  });

  executionState.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - executionState.stageStartTime) / 1000);
    const timerEl = document.getElementById('execTimer');
    if (timerEl) timerEl.textContent = fmtSeconds(elapsed);
  }, 1000);

  scheduleStageAlarms(body);

  document.getElementById('btnNextStage').addEventListener('click', () => advanceStage());
  const backBtn = document.getElementById('btnBackStage');
  if (backBtn) backBtn.addEventListener('click', () => goBackStage());
}

// ── Procesos: Alarmas por instrucción (inicio manual, opcional, con sonido) ──

function scheduleStageAlarms(body) {
  body.querySelectorAll('.instr-alarm-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleInstructionAlarm(btn));
  });
}

function toggleInstructionAlarm(btn) {
  const minutes = parseFloat(btn.dataset.alarmMin);
  const row     = btn.closest('.exec-instruccion-row');
  const text    = btn.dataset.instrText || '';

  if (btn.dataset.running === 'true') {
    clearTimeout(+btn.dataset.timeoutId);
    clearInterval(+btn.dataset.intervalId);
    resetAlarmBtn(btn, minutes);
    return;
  }

  let remaining = Math.round(minutes * 60);
  btn.dataset.running = 'true';
  btn.classList.add('instr-alarm-btn--running');

  const updateLabel = () => {
    const m = Math.floor(remaining / 60), s = remaining % 60;
    btn.textContent = `⏳ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} · cancelar`;
  };
  updateLabel();

  const intervalId = setInterval(() => {
    remaining--;
    if (remaining >= 0) updateLabel();
  }, 1000);

  const timeoutId = setTimeout(() => {
    clearInterval(intervalId);
    resetAlarmBtn(btn, minutes, true);
    triggerInstructionAlarm(row, text);
  }, minutes * 60000);

  btn.dataset.timeoutId  = timeoutId;
  btn.dataset.intervalId = intervalId;
  executionState.alarmTimeouts.push(timeoutId);
  executionState.alarmIntervals.push(intervalId);
}

function resetAlarmBtn(btn, minutes, fired = false) {
  btn.dataset.running = 'false';
  btn.classList.remove('instr-alarm-btn--running');
  btn.textContent = fired
    ? `▶ Reiniciar alarma (${minutes} min)`
    : `▶ Iniciar alarma (${minutes} min)`;
}

function triggerInstructionAlarm(row, text) {
  playAlarmSound();
  if (row && row.isConnected) {
    row.classList.add('instr-alarm-fired');
    setTimeout(() => row.classList.remove('instr-alarm-fired'), 4200);
  }
  showAlarmToast(text);
}

function showAlarmToast(text) {
  const toast = document.createElement('div');
  toast.className = 'alarm-toast';
  toast.innerHTML = `⏰ <span>${esc(text || 'Alarma de paso')}</span><button class="alarm-toast-close" title="Cerrar">✕</button>`;
  document.body.appendChild(toast);
  const remove = () => toast.remove();
  toast.querySelector('.alarm-toast-close').addEventListener('click', remove);
  setTimeout(remove, 15000);
}

let alarmAudioCtx = null;
function playAlarmSound() {
  try {
    if (!alarmAudioCtx) alarmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = alarmAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const beepAt = (startOffset, freq) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t0 = ctx.currentTime + startOffset;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      osc.start(t0);
      osc.stop(t0 + 0.6);
    };
    // Secuencia prolongada: ~7s de aviso, alternando dos tonos.
    for (let i = 0; i < 10; i++) {
      beepAt(i * 0.75, i % 2 === 0 ? 880 : 660);
    }
  } catch (e) {
    console.warn('playAlarmSound:', e.message);
  }
}

function advanceStage() {
  if (!executionState) return;
  const { receta, currentStageIndex } = executionState;
  const etapa = receta.etapas[currentStageIndex];

  clearInterval(executionState.timerInterval);
  const duracion = Math.floor((Date.now() - executionState.stageStartTime) / 1000);

  const maestros = receta.ingredientesMaestros || [];
  let insumosConfirmados;
  if (maestros.length) {
    insumosConfirmados = maestros.map((ing, i) => {
      const realInput = document.querySelector(`.exec-insumo-real[data-ing-idx="${i}"]`);
      const qty = realInput ? parseFloat(realInput.value) || 0 : 0;
      return { nombre: ing.nombre, cantidadPlanificada: ing.cantidadTotal, cantidadReal: qty, unidad: ing.unidad };
    }).filter(ins => ins.cantidadReal > 0);
  } else {
    insumosConfirmados = (etapa.insumos || []).map((ins, i) => {
      const realInput = document.querySelector(`.exec-insumo-real[data-idx="${i}"]`);
      return {
        nombre:              ins.nombre,
        cantidadPlanificada: ins.cantidad,
        cantidadReal:        realInput ? parseFloat(realInput.value) || 0 : ins.cantidad,
        unidad:              ins.unidad
      };
    });
  }

  executionState.stagesData.push({
    nombre:              etapa.nombre,
    duracionReal:        duracion,
    insumosConfirmados,
    observaciones:       (executionState.stageObsDraft || {})[currentStageIndex] || []
  });

  saveExecutionProgress();

  if (currentStageIndex < receta.etapas.length - 1) {
    executionState.currentStageIndex++;
    renderExecutionStep();
  } else {
    finishExecution();
  }
}

function finishExecution() {
  if (!executionState) return;
  if (executionState.timerInterval) clearInterval(executionState.timerInterval);
  (executionState.alarmTimeouts || []).forEach(id => clearTimeout(id));
  (executionState.alarmIntervals || []).forEach(id => clearInterval(id));

  const { receta, stagesData } = executionState;
  const durTotal = stagesData.reduce((sum, s) => sum + s.duracionReal, 0);

  evaluacionPendiente = {
    id:           crypto.randomUUID(),
    recetaId:     receta.id,
    nombreReceta: receta.nombre,
    loteId:       '',
    fechaInicio:  new Date(Date.now() - durTotal * 1000).toISOString(),
    fechaFin:     new Date().toISOString(),
    estado:       'Completada',
    duracionTotal: durTotal,
    etapasData:   stagesData,
    evaluacion:   {},
    creadoEn:     new Date().toISOString()
  };

  executionState = null;
  document.getElementById('ejecutarOverlay').classList.remove('open');

  const durMin = Math.round(durTotal / 60);
  document.getElementById('evalResumen').innerHTML =
    `✅ <strong>${esc(receta.nombre)}</strong> completada.<br/>
     Duración total: <strong>${durMin} min</strong> · ${stagesData.length} etapa${stagesData.length !== 1 ? 's' : ''} registrada${stagesData.length !== 1 ? 's' : ''}.`;

  // Reset evaluation form
  evalScores = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0 };
  document.querySelectorAll('.eval-scale-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('evalPH').value          = '';
  document.getElementById('evalPHStatus').textContent = '';
  document.getElementById('evalPHStatus').className   = 'eval-ph-status';
  document.getElementById('evalScoreValue').textContent = '—/20';
  document.getElementById('evalScoreLevel').textContent  = '';
  document.getElementById('evalScoreLevel').className    = 'eval-score-level';
  evalObsRows = [];
  document.getElementById('evalObsInput').value = '';
  renderEvalObsList();
  document.getElementById('evaluacionFeedback').textContent = '';
  setEvalStars(0);

  // Auto-fill lot metadata
  document.getElementById('evalLoteId').value = generateLotId(receta.nombre);
  const todayIso = new Date().toISOString().slice(0, 10);
  document.getElementById('evalFechaElaboracion').value = todayIso;
  const expDate = new Date(); expDate.setMonth(expDate.getMonth() + 6);
  document.getElementById('evalFechaVencimiento').value = expDate.toISOString().slice(0, 10);

  // Sum all insumos from stages (all units treated as grams/ml equivalently)
  evaluacionTotalInsumosG = stagesData.reduce((sum, stage) =>
    sum + (stage.insumosConfirmados || []).reduce((s, ins) => {
      const u   = (ins.unidad || '').toLowerCase().trim();
      const qty = parseFloat(ins.cantidadReal) || 0;
      if (u === 'kg') return s + qty * 1000;
      if (u === 'l')  return s + qty * 1000;
      return s + qty;
    }, 0)
  , 0);

  const insEl = document.getElementById('evalInsumosTotal');
  insEl.textContent = evaluacionTotalInsumosG > 0
    ? `Total ingredientes usados (suma de etapas): ${evaluacionTotalInsumosG} g`
    : 'No se registraron insumos con cantidad en las etapas.';

  const costo   = computeCostoProduccion(stagesData);
  const costoEl = document.getElementById('evalCostoProduccion');
  costoEl.textContent = costo.incompleto.length
    ? `Costo de producción: ${fmtCOP(costo.total)} (incompleto — sin compra registrada de: ${costo.incompleto.join(', ')})`
    : `Costo de producción del lote: ${fmtCOP(costo.total)}`;
  costoEl.classList.toggle('eval-costo-warn', costo.incompleto.length > 0);

  document.getElementById('evalFrascos230').value = '';
  document.getElementById('evalFrascos180').value = '';
  document.getElementById('evalExcedente').value = '';
  document.getElementById('evalFrascosTotal').textContent = '—';
  document.getElementById('evalRendimientoResult').textContent = '';
  document.getElementById('evalRendimientoResult').className = 'eval-rendimiento-result';

  // Set unlock times for timed evaluation stages
  const nowMs = Date.now();
  evaluacionPendiente.fase2UnlockAt      = new Date(nowMs + 60 * 60 * 1000).toISOString();
  evaluacionPendiente.sineresisUnlockAt  = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();

  maybeShowComparacion(receta, stagesData);
}

document.getElementById('btnCancelEjecutar').addEventListener('click', () => {
  if (!confirm('¿Cancelar la ejecución? Se perderán los datos de las etapas ya registradas.')) return;
  if (executionState?.timerInterval) clearInterval(executionState.timerInterval);
  (executionState?.alarmTimeouts || []).forEach(id => clearTimeout(id));
  (executionState?.alarmIntervals || []).forEach(id => clearInterval(id));
  executionState = null;
  clearExecutionProgress();
  document.getElementById('ejecutarOverlay').classList.remove('open');
});

// ── Procesos: Evaluación de lote ──────────────────────────────────────────────

function setEvalStars(val) {
  evalRating = val;
  document.querySelectorAll('.star-btn').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.val <= val);
  });
}

document.querySelectorAll('.star-btn').forEach(btn => {
  btn.addEventListener('click', () => setEvalStars(+btn.dataset.val));
});

function isEvaluacionFormDirty() {
  const hasScores = Object.values(evalScores).some(v => v > 0);
  const hasPH     = !!document.getElementById('evalPH')?.value;
  const hasObs    = evalObsRows.length > 0;
  return hasScores || hasPH || hasObs || evalRating > 0;
}

document.getElementById('btnCloseEvaluacion').addEventListener('click', () => {
  if (isEvaluacionFormDirty() && !confirm('¿Salir sin guardar? Se perderán los cambios.')) return;
  stopEvalClock();
  document.getElementById('evaluacionOverlay').classList.remove('open');
});

document.getElementById('btnSaveEvaluacion').addEventListener('click', async () => {
  const loteId = document.getElementById('evalLoteId').value.trim();
  const phVal  = parseFloat(document.getElementById('evalPH').value);
  const fb     = document.getElementById('evaluacionFeedback');

  if (!loteId) return setFb(fb, 'El número de lote es obligatorio.', 'err');
  if (isNaN(phVal)) return setFb(fb, 'El pH es obligatorio antes de envasar (I-01).', 'err');
  if (phVal > 4.4)  return setFb(fb, `⚠️ pH ${phVal.toFixed(2)} > 4.4 — agregar ácido cítrico 0.5 g y remedir. No se puede finalizar sin pH ≤ 4.4.`, 'err');
  if (!evaluacionPendiente) return;

  const f230 = parseInt(document.getElementById('evalFrascos230').value) || 0;
  const f180 = parseInt(document.getElementById('evalFrascos180').value) || 0;
  const exc  = parseInt(document.getElementById('evalExcedente').value) || 0;
  if (f230 < 0 || f180 < 0 || exc < 0) return setFb(fb, 'Los frascos y el excedente no pueden ser negativos.', 'err');

  const phase1Dims = ['D1', 'D2', 'D4', 'D5'];
  const unratedPhase1 = phase1Dims.filter(d => !evalScores[d]);
  if (unratedPhase1.length) {
    return setFb(fb, `Falta calificar: ${unratedPhase1.map(d => EVAL_DIM_LABELS[d]).join(', ')}.`, 'err');
  }
  const scoreTotal = phase1Dims.reduce((sum, d) => sum + evalScores[d], 0);

  const btn = document.getElementById('btnSaveEvaluacion');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    const costo = computeCostoProduccion(evaluacionPendiente.etapasData);
    evaluacionPendiente.loteId = loteId;
    evaluacionPendiente.evaluacion = {
      calificacion:       evalRating,
      observaciones:      [...evalObsRows],
      ph:                 phVal,
      scores:             { ...evalScores },
      scoreTotal,
      fase2UnlockAt:      evaluacionPendiente.fase2UnlockAt,
      sineresisUnlockAt:  evaluacionPendiente.sineresisUnlockAt,
      fase2:              null,
      sineresis:          null,
      fase2WASent:        false,
      sineresisWASent:    false,
      fechaElaboracion:   document.getElementById('evalFechaElaboracion').value,
      fechaVencimiento:   document.getElementById('evalFechaVencimiento').value,
      frascos230:         f230,
      frascos180:         f180,
      excedente:          exc,
      totalInsumosG:      evaluacionTotalInsumosG,
      rendimiento:        (() => {
        const ml = f230 * 230 + f180 * 180 + exc;
        return (ml > 0 && evaluacionTotalInsumosG > 0)
          ? Math.round(ml / evaluacionTotalInsumosG * 10000) / 100
          : null;
      })(),
      costoProduccion:    Math.round(costo.total),
      costoIncompleto:    costo.incompleto
    };

    await appendEjecucion(evaluacionPendiente);
    clearExecutionProgress();
    scheduleEvalNotifications(evaluacionPendiente);
    await loadEjecucionesData();
    renderEjecucionesList();

    const lvl = SCORE_LEVELS_FASE1.find(l => scoreTotal >= l.min);
    setFb(fb, `✅ Fase 1 guardada — ${scoreTotal}/20 (${lvl?.label || ''}). Fase 2 en 1h y Sinéresis en 24h en Ejecuciones.`, 'ok');
    setTimeout(() => {
      stopEvalClock();
      document.getElementById('evaluacionOverlay').classList.remove('open');
    }, 3000);
    evaluacionPendiente = null;
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar Fase 1';
  }
});

// ── Evaluación técnica: scale buttons & pH ────────────────────────────────────

document.querySelectorAll('.eval-scale-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const dim = btn.dataset.dim;
    const val = +btn.dataset.val;
    evalScores[dim] = val;
    document.querySelectorAll(`.eval-scale-btn[data-dim="${dim}"]`).forEach(b => {
      b.classList.toggle('active', +b.dataset.val === val);
    });
    updateEvalScore();
  });
});

document.getElementById('evalPH').addEventListener('input', function () {
  const val    = parseFloat(this.value);
  const status = document.getElementById('evalPHStatus');
  if (!isNaN(val)) {
    if (val <= 4.0) {
      status.textContent = '✓ pH óptimo';
      status.className   = 'eval-ph-status ok';
    } else if (val <= 4.4) {
      status.textContent = '⚠ Aceptable, no óptimo (margen hasta 4.4)';
      status.className   = 'eval-ph-status warn';
    } else {
      status.textContent = '✗ Ajustar — agregar ácido cítrico 0.5 g';
      status.className   = 'eval-ph-status err';
    }
  } else {
    status.textContent = '';
    status.className   = 'eval-ph-status';
  }
});

function renderEvalObsList() {
  const list = document.getElementById('evalObsList');
  if (!evalObsRows.length) {
    list.innerHTML = '<div class="obs-empty">Aún sin observaciones</div>';
    return;
  }
  list.innerHTML = evalObsRows.map(o => `<div class="obs-item"><div class="obs-text">${esc(o.text)}</div></div>`).join('');
  list.scrollTop = list.scrollHeight;
}

document.getElementById('btnAddEvalObs').addEventListener('click', () => {
  const input = document.getElementById('evalObsInput');
  const text  = input.value.trim();
  if (!text) return;
  evalObsRows.push({ text, createdAt: new Date().toISOString() });
  input.value = '';
  renderEvalObsList();
});

// ── Rendimiento & Frascos auto-calc ───────────────────────────────────────────

function updateFrascosTotal() {
  const f230 = parseInt(document.getElementById('evalFrascos230').value) || 0;
  const f180 = parseInt(document.getElementById('evalFrascos180').value) || 0;
  const exc  = parseInt(document.getElementById('evalExcedente').value) || 0;
  const totalMl = f230 * 230 + f180 * 180 + exc;
  const fTot = f230 + f180;

  const totEl = document.getElementById('evalFrascosTotal');
  totEl.textContent = (fTot > 0 || exc > 0)
    ? `${fTot} frasco${fTot !== 1 ? 's' : ''} · ${totalMl} ml total`
    : '—';

  const rEl = document.getElementById('evalRendimientoResult');
  if (totalMl > 0 && evaluacionTotalInsumosG > 0) {
    const pct = (totalMl / evaluacionTotalInsumosG * 100).toFixed(1);
    rEl.textContent = `Rendimiento I-09: ${pct}%`;
    rEl.className   = 'eval-rendimiento-result ' + (parseFloat(pct) >= 70 ? 'ok' : 'warn');
  } else {
    rEl.textContent = '';
    rEl.className   = 'eval-rendimiento-result';
  }
}

['evalFrascos230', 'evalFrascos180', 'evalExcedente'].forEach(id =>
  document.getElementById(id).addEventListener('input', updateFrascosTotal)
);

// ── Download ejecuciones TXT ──────────────────────────────────────────────────

const EVAL_DIM_LABELS = {
  D1: 'D1 · Adherencia al alimento (I-03)',
  D2: 'D2 · Homogeneidad de textura (I-05)',
  D3: 'D3 · Prueba en frío (I-06)',
  D4: 'D4 · Prueba de inversión (I-02)',
  D5: 'D5 · Brillo superficial (I-04)',
  D6: 'D6 · Estabilidad de color al aire (I-07)'
};

function ejecucionToText(ej) {
  const ev = ej.evaluacion || {};
  const sep = '═══════════════════════════════════════';
  const lines = [];

  lines.push(sep);
  lines.push(`REGISTRO DE LOTE: ${ej.loteId || '—'}`);
  lines.push(`Receta: ${ej.nombreReceta}`);
  lines.push(sep);
  lines.push('');
  lines.push(`Estado: ${ej.estado || '—'}`);
  lines.push(`Inicio de producción: ${ej.fechaInicio ? new Date(ej.fechaInicio).toLocaleString('es-CO') : '—'}`);
  lines.push(`Fin de producción: ${ej.fechaFin ? new Date(ej.fechaFin).toLocaleString('es-CO') : '—'}`);
  lines.push(`Duración total: ${Math.round((ej.duracionTotal || 0) / 60)} min`);
  if (ev.fechaElaboracion) lines.push(`Fecha de elaboración: ${ev.fechaElaboracion}   Vencimiento estimado: ${ev.fechaVencimiento || '—'}`);

  // ── Etapas ──
  lines.push('', '── ETAPAS REALIZADAS (qué se hizo y cómo) ─────────────');
  if (ej.etapasData?.length) {
    ej.etapasData.forEach((s, i) => {
      const durMin = Math.floor((s.duracionReal || 0) / 60);
      const durSeg = (s.duracionReal || 0) % 60;
      lines.push(`Etapa ${i + 1}: ${s.nombre || '—'}  (duración: ${durMin} min ${durSeg}s)`);
      const insumos = s.insumosConfirmados || [];
      if (insumos.length) {
        lines.push('  Insumos usados:');
        insumos.forEach(ins =>
          lines.push(`    - ${ins.nombre}: ${ins.cantidadReal} ${ins.unidad} (planeado: ${ins.cantidadPlanificada} ${ins.unidad})`)
        );
      }
      const stageObs = normalizeObsList(s.observaciones);
      if (stageObs.length) {
        lines.push('  Observaciones de la etapa:');
        stageObs.forEach(o => lines.push(`    - ${o.text}`));
      }
    });
  } else {
    lines.push('Sin etapas registradas.');
  }

  // ── Envasado y rendimiento ──
  if (ev.frascos230 != null || ev.frascos180 != null) {
    const f230 = ev.frascos230 || 0, f180 = ev.frascos180 || 0, exc = ev.excedente || 0;
    const ml = f230 * 230 + f180 * 180 + exc;
    lines.push('', '── ENVASADO Y RENDIMIENTO (I-09) ───────────────────────');
    lines.push(`Frascos: ${f230}×230ml + ${f180}×180ml + ${exc}ml excedente = ${ml} ml total`);
    lines.push(`Total insumos usados: ${ev.totalInsumosG ?? '?'} g`);
    if (ev.rendimiento != null) lines.push(`Rendimiento: ${ev.rendimiento}%`);
  }

  // ── Costo de producción ──
  if (ev.costoProduccion != null) {
    lines.push('', '── COSTO DE PRODUCCIÓN ──────────────────────────────────');
    lines.push(`Costo total (precio de compra más reciente de cada insumo): ${fmtCOP(ev.costoProduccion)}`);
    if ((ev.costoIncompleto || []).length) {
      lines.push(`⚠️ Incompleto — sin compra registrada para: ${ev.costoIncompleto.join(', ')}`);
    }
  }

  // ── Fase 1 ──
  lines.push('', '── EVALUACIÓN TÉCNICA — FASE 1 (antes de envasar) ─────');
  if (ev.ph != null) {
    const phEstado = ev.ph <= 4.0 ? 'Óptimo' : ev.ph <= 4.4 ? 'Aceptable, no óptimo (margen hasta 4.4)' : 'Fuera de rango — requería corrección';
    lines.push(`pH medido: ${ev.ph} (${phEstado}; óptimo 4.0, límite 4.4)`);
  } else {
    lines.push('pH medido: no registrado');
  }
  ['D4', 'D1', 'D2', 'D5'].forEach(d => {
    if (ev.scores?.[d] != null) lines.push(`${EVAL_DIM_LABELS[d]}: ${ev.scores[d]}/5`);
  });
  const fase1Total = ['D1', 'D2', 'D4', 'D5'].reduce((s, d) => s + (ev.scores?.[d] || 0), 0);
  if (ev.scores) {
    const lvl1 = SCORE_LEVELS_FASE1.find(l => fase1Total >= l.min) || SCORE_LEVELS_FASE1[SCORE_LEVELS_FASE1.length - 1];
    lines.push(`Puntaje Fase 1: ${fase1Total}/20 (${lvl1.label})`);
  }

  // ── Fase 2 ──
  lines.push('', '── EVALUACIÓN TÉCNICA — FASE 2 (1h después, en frío) ──');
  if (ev.fase2) {
    ['D3', 'D6'].forEach(d => {
      if (ev.fase2.scores?.[d] != null) lines.push(`${EVAL_DIM_LABELS[d]}: ${ev.fase2.scores[d]}/5`);
    });
    const s = ev.fase2.sello || {};
    lines.push(`Sello y vacío (I-10): Tapa cóncava ${s.tapa ? '✓' : '✗'} | Pop audible ${s.pop ? '✓' : '✗'} | Color/olor sin alteración ${s.olor ? '✓' : '✗'}`);
  } else {
    lines.push('Pendiente — aún no evaluada.');
  }

  // ── Sinéresis ──
  lines.push('', '── EVALUACIÓN — SINÉRESIS (24h después) ────────────────');
  lines.push(ev.sineresis
    ? `Resultado: ${ev.sineresis === 'ok' ? 'Sin separación visible ✓' : 'Separación visible ✗ — emulsión inestable'}`
    : 'Pendiente — aún no evaluada.');

  // ── Puntaje total ──
  if (ev.scoreTotal != null) {
    lines.push('', '── PUNTAJE TÉCNICO TOTAL ────────────────────────────────');
    const maxScore = ev.fase2 ? 30 : 20;
    const levels = ev.fase2 ? SCORE_LEVELS : SCORE_LEVELS_FASE1;
    const lvl = levels.find(l => ev.scoreTotal >= l.min) || levels[levels.length - 1];
    lines.push(`${ev.scoreTotal}/${maxScore}${ev.fase2 ? '' : ' (solo Fase 1, Fase 2 pendiente)'} — ${lvl.label}`);
  }

  // ── Calificación general ──
  if (ev.calificacion) {
    lines.push('', '── CALIFICACIÓN GENERAL DEL LOTE ───────────────────────');
    lines.push(`${'★'.repeat(ev.calificacion)}${'☆'.repeat(5 - ev.calificacion)} (${ev.calificacion}/5)`);
  }

  // ── Observaciones de la evaluación ──
  lines.push('', '── OBSERVACIONES DE LA EVALUACIÓN ──────────────────────');
  const evalObs = normalizeObsList(ev.observaciones);
  if (evalObs.length) evalObs.forEach(o => lines.push(`- ${o.text}`));
  else lines.push('Sin observaciones registradas.');

  // ── Observaciones posteriores (seguimiento del lote) ──
  const followUpObs = normalizeObsList(ej.observations);
  if (followUpObs.length) {
    lines.push('', '── OBSERVACIONES DE SEGUIMIENTO POSTERIORES ────────────');
    followUpObs.forEach(o => lines.push(`- ${o.text}${o.createdAt ? ` (${new Date(o.createdAt).toLocaleString('es-CO')})` : ''}`));
  }

  // ── Conclusión ──
  lines.push('', '── CONCLUSIÓN ───────────────────────────────────────────');
  const problemas = [];
  if (ev.ph != null && ev.ph > 4.4) problemas.push(`pH ${ev.ph} fuera de rango (> 4.4)`);
  if (ev.sineresis === 'fail') problemas.push('sinéresis con separación visible');
  if (ev.fase2?.sello && (!ev.fase2.sello.tapa || !ev.fase2.sello.pop || !ev.fase2.sello.olor)) problemas.push('sello/vacío no conforme');
  if (problemas.length) {
    lines.push(`Lote con observaciones críticas: ${problemas.join('; ')}. Requiere revisión antes de despacho.`);
  } else if (ev.scoreTotal != null) {
    const maxScore = ev.fase2 ? 30 : 20;
    const levels = ev.fase2 ? SCORE_LEVELS : SCORE_LEVELS_FASE1;
    const lvl = levels.find(l => ev.scoreTotal >= l.min) || levels[levels.length - 1];
    lines.push(`Lote clasificado como "${lvl.label}" (${ev.scoreTotal}/${maxScore}), sin observaciones críticas registradas.`);
  } else {
    lines.push('Evaluación incompleta — sin puntaje técnico registrado todavía.');
  }

  lines.push('', sep, '');
  return lines.join('\n');
}

function downloadSingleEjecucionTxt(ej) {
  const text = ejecucionToText(ej);
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `lote-${ej.loteId || ej.id?.slice(0,8)}.txt`;
  a.click(); URL.revokeObjectURL(url);
}

function downloadEjecucionesTxt() {
  if (!ejecuciones?.length) return;
  const text = ejecuciones.map(ejecucionToText).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `ejecuciones-${new Date().toISOString().slice(0,10)}.txt`;
  a.click(); URL.revokeObjectURL(url);
}

document.getElementById('btnDownloadEjecuciones').addEventListener('click', downloadEjecucionesTxt);

// ── Auto-guardado de borrador de tarea ───────────────────────────────────────

['taskTitle', 'taskDesc', 'taskDue', 'taskArea', 'taskStatus'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input',  () => { if (!kanbanEditId) saveTaskDraft(); });
    el.addEventListener('change', () => { if (!kanbanEditId) saveTaskDraft(); });
  }
});
document.getElementById('subtasksList')?.addEventListener('input', () => {
  if (!kanbanEditId) saveTaskDraft();
});

// ── Informes ──────────────────────────────────────────────────────────────────

function getInformesRangeDates(range) {
  if (range === 'todo') return { start: null, end: null };
  const now = new Date();
  if (range === 'mes') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }
  // 'semana': lunes 00:00 → lunes siguiente
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const dow = (start.getDay() + 6) % 7; // lunes = 0
  start.setDate(start.getDate() - dow);
  const end = addDays(start, 7);
  return { start, end };
}

function computeInformesStats(range) {
  const { start, end } = getInformesRangeDates(range);
  const inRange = iso => {
    if (!iso) return false;
    if (!start) return true;
    const d = new Date(iso);
    return d >= start && d < end;
  };

  let investedMs = 0, pendingMs = 0;
  kanbanTasks.forEach(t => {
    const ms = (t.timeSessions || [])
      .filter(s => inRange(s.start))
      .reduce((sum, s) => sum + ((s.end ? new Date(s.end) : new Date()) - new Date(s.start)), 0);
    if (t.status === 'Realizado') investedMs += ms;
    else if (!TERMINAL_STATES.includes(t.status)) pendingMs += ms;
  });
  ejecuciones.forEach(ej => {
    if (inRange(ej.fechaFin || ej.fechaInicio)) investedMs += (+ej.duracionTotal || 0) * 1000;
  });

  return { investedMs, pendingMs };
}

async function renderInformes() {
  if (!kanbanTasks.length) await loadKanbanTasks().catch(() => {});
  if (!ejecuciones.length) await loadEjecucionesData().catch(() => {});

  document.querySelectorAll('#informesRangeSwitch .gantt-zoom-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.range === informesRange);
  });

  const { investedMs, pendingMs } = computeInformesStats(informesRange);
  document.getElementById('informesInvestedValue').textContent = fmtDuration(investedMs);
  document.getElementById('informesPendingValue').textContent  = fmtDuration(pendingMs);
}

document.querySelectorAll('#informesRangeSwitch .gantt-zoom-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    informesRange = btn.dataset.range;
    renderInformes();
  });
});

// ── Command palette (Ctrl+K) ─────────────────────────────────────────────────

const COMMAND_PALETTE_ITEMS = [
  { label: 'Inicio',                 action: () => navigateTo('home') },
  { label: 'Contenido',              action: () => navigateTo('contenido') },
  { label: 'Tareas · Kanban',        action: () => { navigateTo('tareas'); switchSubTab('kanban'); } },
  { label: 'Tareas · Lista',         action: () => { navigateTo('tareas'); switchSubTab('lista'); } },
  { label: 'Tareas · Gantt',         action: () => { navigateTo('tareas'); switchSubTab('gantt'); } },
  { label: 'Procesos · Recetas',     action: () => { navigateTo('procesos'); document.querySelector('[data-procesostab="recetas"]')?.click(); } },
  { label: 'Procesos · Ejecuciones', action: () => { navigateTo('procesos'); document.querySelector('[data-procesostab="ejecuciones"]')?.click(); } },
  { label: 'Informes',               action: () => navigateTo('informes') },
  { label: '+ Nueva tarea',          action: () => { navigateTo('tareas'); openTaskModal(null, null); } },
  { label: '+ Nueva receta',         action: () => { navigateTo('procesos'); document.getElementById('btnNewReceta')?.click(); } },
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
  commandPaletteFiltered = q
    ? COMMAND_PALETTE_ITEMS.filter(item => normalizeForSearch(item.label).includes(q))
    : COMMAND_PALETTE_ITEMS;
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
