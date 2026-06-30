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
let draggedId          = null;
let showTerminal       = false;

// Navigation state
let currentView   = 'home';
let currentSubTab = 'kanban';
let deferredInstallPrompt = null;

// Procesos / Recetas state
let recetas              = [];
let ejecuciones          = [];
let recetasSheetId       = null;
let ejecucionesSheetId   = null;
let currentProcesosTab   = 'recetas';
let editRecetaId         = null;
let executionState       = null;
let evaluacionPendiente  = null;
let evalRating           = 0;
let evalScores           = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0 };
let evaluacionTotalInsumosG = 0;
let taskDetailId         = null;
let ejecucionDetailId    = null;
let lastTapTime          = {};   // for double-tap detection on mobile
let draggedColName       = null; // for kanban column drag-reorder
let recetaDetailId       = null; // for recipe detail view

const TERMINAL_STATES = ['Realizado', 'Cancelado', 'Postpuesto'];
const DEFAULT_COLUMNS = [
  { name: 'Pendiente',   color: '#6B5050', terminal: false },
  { name: 'En proceso',  color: '#F05B22', terminal: false },
  { name: 'En revisión', color: '#7A9C3E', terminal: false },
  { name: 'Realizado',   color: '#2E7D32', terminal: true  },
  { name: 'Cancelado',   color: '#C62828', terminal: true  },
  { name: 'Postpuesto',  color: '#546E7A', terminal: true  },
];
const DEFAULT_AREAS = ['Marketing', 'Ventas', 'Producción', 'Administración'];

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
const userInfoEl    = document.getElementById('userInfo');

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

  // Back button: hidden on home, visible in modules
  document.getElementById('btnBack').style.display = view === 'home' ? 'none' : '';

  // Sidebar active state
  document.querySelectorAll('.sidebar-item[data-nav]').forEach(item => {
    item.classList.toggle('active', item.dataset.nav === view);
  });

  // Load data for the selected view
  if (view === 'tareas') {
    document.getElementById('kanbanBoard').innerHTML =
      '<div class="loading-state" style="padding:48px 0">Cargando…</div>';
    loadKanbanConfig().then(() => loadKanbanTasks()).then(() => {
      populateAreaSelects();
      populateStatusSelects();
      if (currentSubTab === 'kanban') renderKanban();
      else renderKanbanList();
    });
  }
  if (view === 'procesos') {
    loadProcesos();
  }

  window.scrollTo(0, 0);
}

async function switchSubTab(subtab) {
  currentSubTab = subtab;

  document.querySelectorAll('.sub-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.subtab === subtab);
  });
  document.getElementById('subTabKanban').style.display  = subtab === 'kanban' ? '' : 'none';
  document.getElementById('subTabLista').style.display   = subtab === 'lista'  ? '' : 'none';
  document.getElementById('kanbanToolbar').style.display = subtab === 'kanban' ? '' : 'none';

  await loadKanbanConfig();
  await loadKanbanTasks();
  populateAreaSelects();
  populateStatusSelects();
  if (subtab === 'kanban') renderKanban();
  else renderKanbanList();
}

// ── PWA install prompt ────────────────────────────────────────────────────────

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('installBanner').style.display = '';
  document.getElementById('sidebarInstall').style.display = '';
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  document.getElementById('installBanner').style.display = 'none';
  document.getElementById('sidebarInstall').style.display = 'none';
});

async function triggerInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    deferredInstallPrompt = null;
    document.getElementById('installBanner').style.display = 'none';
    document.getElementById('sidebarInstall').style.display = 'none';
  }
}

document.getElementById('btnInstall').addEventListener('click', triggerInstall);
document.getElementById('sidebarInstall').addEventListener('click', triggerInstall);

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
  btnSettings.style.display     = 'none';
  btnSignOut.style.display      = 'none';
  userInfoEl.textContent        = '';
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
  btnSettings.style.display     = '';
  btnSignOut.style.display      = '';

  try {
    const u = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then(r => r.json());
    userInfoEl.textContent = u.name || u.email || '';
    localStorage.setItem(USER_KEY, JSON.stringify({ name: u.name, email: u.email }));
    const firstName = (u.name || '').split(' ')[0];
    if (firstName) document.getElementById('homeGreeting').textContent = `Hola, ${firstName}`;
  } catch {
    const saved = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    const firstName = (saved.name || '').split(' ')[0];
    if (firstName) document.getElementById('homeGreeting').textContent = `Hola, ${firstName}`;
  }

  await initSheet();
  await initKanbanSheets();
  await initRecetasSheets();
  setDefaultDateTime();
  await loadStories();

  navigateTo('home');
  startNotificationScheduler();
  registerPeriodicSync();
}

// ── WhatsApp notification scheduler ──────────────────────────────────────────

function startNotificationScheduler() {
  checkAndSendNotification();
  setInterval(checkAndSendNotification, 60000);
}

async function checkAndSendNotification() {
  if (!accessToken) return;
  try {
    const opts  = { timeZone: 'America/Bogota' };
    const now   = new Date();
    const h     = parseInt(now.toLocaleString('en-CA', { ...opts, hour: '2-digit', hour12: false }));
    const m     = parseInt(now.toLocaleString('en-CA', { ...opts, minute: '2-digit' }));
    const today = now.toLocaleDateString('en-CA', opts);

    if (!((h === 9 && m === 0) || (h === 16 && m === 0))) return;

    const key = `ss_notif_${today}_${h}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');

    await sendDailyReminder(h);
  } catch (e) {
    console.warn('checkAndSendNotification:', e);
  }
}

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

    // Cache config for service worker periodic sync
    try {
      const cache = await caches.open('ss-config');
      await cache.put('whatsapp-config', new Response(JSON.stringify({ phone: cfg.phone, apikey: cfg.apikey }), {
        headers: { 'Content-Type': 'application/json' }
      }));
    } catch {}
  } catch (e) {
    console.warn('sendDailyReminder:', e);
  }
}

async function registerPeriodicSync() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg  = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return;
    const perm = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (perm.state !== 'granted') return;
    await reg.periodicSync.register('whatsapp-reminder', { minInterval: 4 * 60 * 60 * 1000 });
  } catch {}
}

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
      btn.textContent = '⏳';
      try {
        for (let i = 0; i < story.driveFileIds.length; i++) {
          await downloadDriveFile(story.driveFileIds[i], story.origNames[i]);
          if (i < story.driveFileIds.length - 1) await delay(400);
        }
      } catch (e) { alert(`Error al descargar: ${e.message}`); }
      finally { btn.disabled = false; btn.textContent = '⬇️'; }
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
    thumbContent = '🎬';
  } else if (s.driveFileIds.length) {
    thumbContent = '🖼';
  } else {
    thumbContent = '';
  }

  const actions = s.actions
    ? esc(s.actions)
    : '<em style="opacity:.55">Sin acciones especificadas</em>';

  const driveBtn = s.driveFileIds[0]
    ? `<button class="btn-sm" data-drive-id="${s.driveFileIds[0]}" title="Ver en Drive">📂</button>` : '';

  const dlBtn = s.driveFileIds.length
    ? `<button class="btn-sm btn-dl" data-download-row="${s.rowIndex}" title="Descargar archivo(s)">⬇️</button>` : '';

  const todayBadge = today ? '<span class="today-badge">HOY</span>' : '';

  return `
    <div class="story-card${today ? ' today' : ''}">
      <div class="story-thumb">${thumbContent}</div>
      <div class="story-body">
        <div class="story-title">${todayBadge}${esc(s.title)}</div>
        <div class="story-date">📅 ${fmtDate(s.scheduledAt)}</div>
        <div class="story-actions">${actions}</div>
        <div class="story-footer">
          <button class="btn-pub" data-publish-row="${s.rowIndex}">✅ Publicada</button>
          <div class="story-footer-icons">${driveBtn}${dlBtn}</div>
        </div>
      </div>
      <div class="story-actions-btn">
        <button class="story-delete" data-delete-row="${s.rowIndex}" title="Eliminar">🗑</button>
      </div>
    </div>`;
}

// ── Settings modal ────────────────────────────────────────────────────────────

btnSettings.addEventListener('click', async () => {
  try {
    const cfg = await loadConfig();
    settingsPhone.value  = cfg.phone  || '3122132279';
    settingsApikey.value = cfg.apikey || '';
  } catch {}
  settingsFeedback.className = 'feedback';
  settingsFeedback.textContent = '';
  settingsOverlay.classList.add('open');
});

btnCloseSettings.addEventListener('click', () => settingsOverlay.classList.remove('open'));
settingsOverlay.addEventListener('click', e => {
  if (e.target === settingsOverlay) settingsOverlay.classList.remove('open');
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

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
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

  if (hasTasks) kanbanTasksSheetId = hasTasks.properties.sheetId;

  const reqs = [];
  if (!hasTasks) reqs.push({ addSheet: { properties: { title: 'KanbanTasks'  } } });
  if (!hasConf)  reqs.push({ addSheet: { properties: { title: 'KanbanConfig' } } });

  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST', body: JSON.stringify({ requests: reqs })
    });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'KanbanTasks')
        kanbanTasksSheetId = r.addSheet.properties.sheetId;
    });
  }

  const td = await sheetsReq('/values/KanbanTasks!A1').catch(() => ({}));
  if (!td.values) {
    await sheetsReq('/values/KanbanTasks!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID','Area','Title','Description','DueDate','Status','CreatedAt','UpdatedAt']] })
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
  const data = await sheetsReq('/values/KanbanTasks!A:J');
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
      rowIndex:     i + 2
    }));
}

async function appendKanbanTask(task) {
  await sheetsReq('/values/KanbanTasks!A:J:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      task.id, task.area, task.title, task.desc,
      task.dueDate, task.status, task.createdAt, task.updatedAt,
      JSON.stringify(task.subtasks || []),
      JSON.stringify(task.observations || [])
    ]]})
  });
}

async function updateKanbanTask(task) {
  await sheetsReq(`/values/KanbanTasks!A${task.rowIndex}:J${task.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      task.id, task.area, task.title, task.desc,
      task.dueDate, task.status, task.createdAt, new Date().toISOString(),
      JSON.stringify(task.subtasks || []),
      JSON.stringify(task.observations || [])
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
  const areaFilter = document.getElementById('kanbanAreaFilter')?.value || '';

  const tasks = areaFilter ? kanbanTasks.filter(t => t.area === areaFilter) : kanbanTasks;
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
        <span class="col-drag-handle" title="Mover columna">⠿</span>
      </div>
      <div class="kanban-col-body" data-col="${esc(col.name)}"></div>
      ${col.terminal ? '' : `<div class="kanban-col-footer"><button class="kanban-add-card" data-col="${esc(col.name)}">+ Agregar</button></div>`}
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
        <div class="kanban-card-area">${esc(task.area)}</div>
        <div class="kanban-card-title">${esc(task.title)}</div>
        ${task.desc ? `<div class="kanban-card-desc">${esc(task.desc)}</div>` : ''}
        ${subtasksBullets ? `<div class="kanban-card-subtasks">${subtasksBullets}</div>` : ''}
        ${due.text   ? `<div class="kanban-card-due ${due.cls}">${due.text}</div>` : ''}
        <div class="kanban-card-footer">
          <span class="kanban-card-hint">doble clic = ver detalle</span>
          <div style="display:flex;gap:4px">
            <button data-edit="${task.id}" title="Editar">✏️</button>
            <button data-del="${task.id}" data-row="${task.rowIndex}" title="Eliminar">🗑</button>
          </div>
        </div>
        ${tl ? `<div class="kanban-traffic-bar ${tl.cls}" title="${tl.tip}"></div>` : ''}
      `;

      card.addEventListener('dblclick', (e) => {
        if (e.target.closest('button')) return;
        openTaskDetail(task.id);
      });

      card.addEventListener('touchend', (e) => {
        if (e.target.closest('button')) return;
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
        document.querySelectorAll('.kanban-col-body.drag-over').forEach(el => el.classList.remove('drag-over'));
        draggedId = null;
      });

      colBody.appendChild(card);
    });

    colBody.addEventListener('dragover', e => {
      if (draggedColName) return; // column drag takes priority
      e.preventDefault();
      colBody.classList.add('drag-over');
    });
    colBody.addEventListener('dragleave', e => {
      if (!colBody.contains(e.relatedTarget)) colBody.classList.remove('drag-over');
    });
    colBody.addEventListener('drop', async e => {
      e.preventDefault();
      colBody.classList.remove('drag-over');
      if (!draggedId) return;
      const newStatus = colBody.dataset.col;
      const task = kanbanTasks.find(t => t.id === draggedId);
      if (!task || task.status === newStatus) return;
      if (TERMINAL_STATES.includes(newStatus)) {
        if (!confirm(`¿Finalizar la tarea como "${newStatus}"?`)) return;
      }
      task.status = newStatus;
      renderKanban();
      try { await updateKanbanTask(task); }
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
        await deleteKanbanTaskRow(+btn.dataset.row);
        await loadKanbanTasks();
        renderKanban();
      } catch (e) { alert('Error: ' + e.message); btn.disabled = false; }
    });
  });
  board.querySelectorAll('.kanban-add-card').forEach(btn => {
    btn.addEventListener('click', () => openTaskModal(btn.dataset.col, null));
  });
}

// ── Lista Render ──────────────────────────────────────────────────────────────

function renderKanbanList() {
  const container    = document.getElementById('tasksList');
  if (!container) return;
  const areaFilter   = document.getElementById('listaAreaFilter')?.value   || '';
  const statusFilter = document.getElementById('listaStatusFilter')?.value || '';

  let tasks = [...kanbanTasks];
  if (areaFilter)   tasks = tasks.filter(t => t.area   === areaFilter);
  if (statusFilter) tasks = tasks.filter(t => t.status === statusFilter);
  tasks.sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1);

  if (!tasks.length) {
    container.innerHTML = '<div class="empty-state">No hay tareas con estos filtros.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'tasks-table';
  table.innerHTML = `<thead><tr>
    <th>Área</th><th>Tarea</th><th>Estado</th><th>Fecha límite</th><th></th>
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
      <td><span class="kanban-card-due ${due.cls}" style="font-size:12px">${due.text}</span></td>
      <td style="white-space:nowrap">
        <button class="task-action-btn" data-view="${task.id}" title="Ver detalle">👁</button>
        <button class="task-action-btn" data-edit="${task.id}" title="Editar">✏️</button>
        <button class="task-action-btn" data-del="${task.id}" data-row="${task.rowIndex}" title="Eliminar">🗑</button>
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
        await deleteKanbanTaskRow(+btn.dataset.row);
        await loadKanbanTasks();
        renderKanbanList();
      } catch (e) { alert('Error: ' + e.message); btn.disabled = false; }
    });
  });
}

// ── Selects population ────────────────────────────────────────────────────────

function populateAreaSelects() {
  ['kanbanAreaFilter', 'listaAreaFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">Todas las áreas</option>` +
      kanbanAreas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
    if (cur) el.value = cur;
  });
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
  const listaEl = document.getElementById('listaStatusFilter');
  if (listaEl) {
    const cur = listaEl.value;
    listaEl.innerHTML = `<option value="">Todos los estados</option>` +
      kanbanColumns.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    if (cur) listaEl.value = cur;
  }
}

// ── Task modal ────────────────────────────────────────────────────────────────

function openTaskModal(defaultStatus, editId) {
  kanbanEditId = editId || null;
  const overlay = document.getElementById('taskOverlay');
  populateAreaSelects();
  populateStatusSelects();

  if (editId) {
    const task = kanbanTasks.find(t => t.id === editId);
    if (!task) return;
    document.getElementById('taskModalTitle').textContent = 'Editar tarea';
    document.getElementById('taskArea').value   = task.area;
    document.getElementById('taskTitle').value  = task.title;
    document.getElementById('taskDesc').value   = task.desc;
    document.getElementById('taskDue').value    = task.dueDate;
    document.getElementById('taskStatus').value = task.status;
    renderSubtasksList(task.subtasks || []);
  } else {
    document.getElementById('taskModalTitle').textContent = 'Nueva tarea';
    document.getElementById('taskArea').value   = kanbanAreas[0] || '';
    document.getElementById('taskTitle').value  = '';
    document.getElementById('taskDesc').value   = '';
    document.getElementById('taskDue').value    = '';
    const firstNonTerm = kanbanColumns.find(c => !c.terminal);
    document.getElementById('taskStatus').value = defaultStatus || firstNonTerm?.name || '';
    renderSubtasksList([]);
  }

  document.getElementById('taskFeedback').textContent = '';
  overlay.classList.add('open');
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

document.getElementById('btnCloseTask').addEventListener('click', () => {
  document.getElementById('taskOverlay').classList.remove('open');
});
document.getElementById('taskOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('taskOverlay'))
    document.getElementById('taskOverlay').classList.remove('open');
});

document.getElementById('btnSaveTask').addEventListener('click', async () => {
  const area     = document.getElementById('taskArea').value;
  const title    = document.getElementById('taskTitle').value.trim();
  const desc     = document.getElementById('taskDesc').value.trim();
  const due      = document.getElementById('taskDue').value;
  const status   = document.getElementById('taskStatus').value;
  const subtasks = collectSubtasks();
  const fb       = document.getElementById('taskFeedback');

  if (!title) return setFb(fb, 'El título es obligatorio.', 'err');
  if (!due)   return setFb(fb, 'La fecha límite es obligatoria.', 'err');

  const btn = document.getElementById('btnSaveTask');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    if (kanbanEditId) {
      const task = kanbanTasks.find(t => t.id === kanbanEditId);
      if (task) {
        task.area = area; task.title = title; task.desc = desc;
        task.dueDate = due; task.status = status; task.subtasks = subtasks;
        await updateKanbanTask(task);
      }
    } else {
      const now = new Date().toISOString();
      await appendKanbanTask({
        id: crypto.randomUUID(), area, title, desc,
        dueDate: due, status, createdAt: now, updatedAt: now,
        subtasks, observations: []
      });
    }
    await loadKanbanTasks();
    document.getElementById('taskOverlay').classList.remove('open');

    if (currentSubTab === 'kanban') renderKanban();
    else renderKanbanList();
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
document.getElementById('btnCloseBoard').addEventListener('click', () => {
  document.getElementById('boardOverlay').classList.remove('open');
});
document.getElementById('boardOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('boardOverlay'))
    document.getElementById('boardOverlay').classList.remove('open');
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

// ── Subtasks (viñetas) helpers ────────────────────────────────────────────────

function renderSubtasksList(items) {
  const container = document.getElementById('subtasksList');
  if (!container) return;
  container.innerHTML = '';
  items.forEach((item, idx) => {
    container.appendChild(buildSubtaskRow(item, idx));
  });
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
  row.querySelector('.subtask-remove').addEventListener('click', () => row.remove());
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

  const subtasksHTML = (task.subtasks || []).length
    ? `<div class="detail-subtasks">
        ${(task.subtasks).map(s => {
          const sd = s.dueDate ? `<span class="subtask-bullet-date">${fmtDueShort(s.dueDate)}</span>` : '';
          return `<div class="detail-subtask-item${s.done ? ' done' : ''}">
            <span class="detail-subtask-bullet">•</span>
            <span>${esc(s.text)}</span>${sd}
          </div>`;
        }).join('')}
      </div>`
    : '';

  document.getElementById('taskDetailModalTitle').textContent = task.title;
  document.getElementById('taskDetailContent').innerHTML = `
    <div class="detail-row"><span class="detail-label">Área</span><span class="detail-value">${esc(task.area)}</span></div>
    <div class="detail-row"><span class="detail-label">Estado</span><span class="status-pill" style="background:${color}22;color:${color}">${esc(task.status)}</span></div>
    <div class="detail-row"><span class="detail-label">Fecha límite</span><span class="kanban-card-due ${due.cls}">${due.text || '—'}</span></div>
    ${task.desc ? `<div class="detail-row detail-row--col"><span class="detail-label">Descripción</span><span class="detail-value">${esc(task.desc)}</span></div>` : ''}
    ${subtasksHTML ? `<div class="detail-row detail-row--col"><span class="detail-label">Sub-tareas</span>${subtasksHTML}</div>` : ''}
    <div class="detail-row detail-row--meta"><span class="detail-label">Creada</span><span class="detail-value">${fmtDate(task.createdAt)}</span></div>
    <div class="detail-row detail-row--meta"><span class="detail-label">Actualizada</span><span class="detail-value">${fmtDate(task.updatedAt)}</span></div>
  `;

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
  list.innerHTML = obs.map(o => `
    <div class="obs-item">
      <div class="obs-text">${esc(o.text)}</div>
      <div class="obs-date">${fmtDate(o.createdAt)}</div>
    </div>
  `).join('');
  list.scrollTop = list.scrollHeight;
}

document.getElementById('btnCloseTaskDetail').addEventListener('click', () => {
  document.getElementById('taskDetailOverlay').classList.remove('open');
});
document.getElementById('taskDetailOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('taskDetailOverlay'))
    document.getElementById('taskDetailOverlay').classList.remove('open');
});

document.getElementById('btnEditFromDetail').addEventListener('click', () => {
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
  } catch (e) {
    alert('Error al guardar: ' + e.message);
  } finally {
    btn.disabled = false;
  }
});

// ── Event listeners: navigation ───────────────────────────────────────────────

document.getElementById('btnBack').addEventListener('click', () => navigateTo('home'));

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => navigateTo(el.dataset.nav));
});

document.querySelectorAll('.sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchSubTab(btn.dataset.subtab));
});

document.getElementById('btnNewTask').addEventListener('click', () => openTaskModal(null, null));
document.getElementById('kanbanAreaFilter').addEventListener('change', renderKanban);
document.getElementById('listaAreaFilter').addEventListener('change', renderKanbanList);
document.getElementById('listaStatusFilter').addEventListener('change', renderKanbanList);

// ── Procesos: Sheets init ─────────────────────────────────────────────────────

async function initRecetasSheets() {
  const info = await sheetsReq('');
  const tabs  = info.sheets || [];
  const hasR  = tabs.find(s => s.properties.title === 'RecetasPlantillas');
  const hasE  = tabs.find(s => s.properties.title === 'RecetasEjecuciones');

  if (hasR) recetasSheetId     = hasR.properties.sheetId;
  if (hasE) ejecucionesSheetId = hasE.properties.sheetId;

  const reqs = [];
  if (!hasR) reqs.push({ addSheet: { properties: { title: 'RecetasPlantillas'  } } });
  if (!hasE) reqs.push({ addSheet: { properties: { title: 'RecetasEjecuciones' } } });

  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST', body: JSON.stringify({ requests: reqs })
    });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'RecetasPlantillas')
        recetasSheetId = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'RecetasEjecuciones')
        ejecucionesSheetId = r.addSheet.properties.sheetId;
    });
  }

  const rd = await sheetsReq('/values/RecetasPlantillas!A1').catch(() => ({}));
  if (!rd.values) {
    await sheetsReq('/values/RecetasPlantillas!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID','Nombre','Descripcion','Etapas','CreadoEn']] })
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
  const data = await sheetsReq('/values/RecetasPlantillas!A:E');
  const rows = (data.values || []).slice(1);
  recetas = rows.filter(r => r[0]).map((r, i) => ({
    id:          r[0] || '',
    nombre:      r[1] || '',
    descripcion: r[2] || '',
    etapas:      safeParseJSON(r[3], []),
    creadoEn:    r[4] || '',
    rowIndex:    i + 2
  }));
}

async function appendReceta(rec) {
  await sheetsReq('/values/RecetasPlantillas!A:E:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      rec.id, rec.nombre, rec.descripcion, JSON.stringify(rec.etapas), rec.creadoEn
    ]]})
  });
}

async function updateReceta(rec) {
  await sheetsReq(`/values/RecetasPlantillas!A${rec.rowIndex}:E${rec.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      rec.id, rec.nombre, rec.descripcion, JSON.stringify(rec.etapas), rec.creadoEn
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
    await loadEjecucionesData();
    renderRecetasList();
    renderEjecucionesList();
  } catch (e) {
    console.error('loadProcesos:', e);
  }
}

function renderRecetasList() {
  const container = document.getElementById('recetasList');
  if (!container) return;

  if (!recetas.length) {
    container.innerHTML = '<div class="empty-state">No hay recetas. Crea la primera con "+ Nueva receta".</div>';
    return;
  }

  container.innerHTML = recetas.map(r => `
    <div class="receta-card" data-id="${esc(r.id)}" title="Doble clic para ver detalle">
      <div class="receta-card-body">
        <div class="receta-card-title">${esc(r.nombre)}</div>
        ${r.descripcion ? `<div class="receta-card-desc">${esc(r.descripcion)}</div>` : ''}
        <div class="receta-card-meta">🥄 ${r.etapas.length} etapa${r.etapas.length !== 1 ? 's' : ''} &nbsp;·&nbsp; doble clic = ver pasos</div>
      </div>
      <div class="receta-card-actions">
        <button class="btn-ejecutar" data-ejecutar="${esc(r.id)}">▶ Ejecutar</button>
        <button class="btn-outline btn-sm" data-edit-receta="${esc(r.id)}">✏️</button>
        <button class="btn-outline btn-sm" data-del-receta="${esc(r.id)}" data-row="${r.rowIndex}">🗑</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.receta-card[data-id]').forEach(card => {
    card.addEventListener('dblclick', e => {
      if (e.target.closest('button')) return;
      openRecetaDetail(card.dataset.id);
    });
    card.addEventListener('touchend', e => {
      if (e.target.closest('button')) return;
      const now = Date.now();
      const last = lastTapTime['rec_' + card.dataset.id] || 0;
      lastTapTime['rec_' + card.dataset.id] = now;
      if (now - last < 350) openRecetaDetail(card.dataset.id);
    });
  });
  container.querySelectorAll('[data-ejecutar]').forEach(btn => {
    btn.addEventListener('click', () => startExecution(btn.dataset.ejecutar));
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
        ${ev.observaciones ? `<div class="ejecucion-obs">${esc(ev.observaciones)}</div>` : ''}
        <div class="ejecucion-hint">doble clic = ver detalle</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-ej-id]').forEach(card => {
    const ejId = card.dataset.ejId;
    card.addEventListener('dblclick', () => openEjecucionDetail(ejId));
    card.addEventListener('touchend', () => {
      const now  = Date.now();
      const last = lastTapTime['ej_' + ejId] || 0;
      lastTapTime['ej_' + ejId] = now;
      if (now - last < 350) openEjecucionDetail(ejId);
    });
  });
}

// ── Procesos: Recipe detail view ──────────────────────────────────────────────

function openRecetaDetail(recetaId) {
  const rec = recetas.find(r => r.id === recetaId);
  if (!rec) return;
  recetaDetailId = recetaId;

  document.getElementById('recetaDetailTitle').textContent = rec.nombre;

  const etapasHTML = rec.etapas.map((et, i) => {
    const instrArr = parseInstrucciones(et.instrucciones);
    let stepNum = 0;
    const instrHTML = instrArr.map(item => {
      const text = item.text || item;
      const tipo = item.tipo || 'paso';
      if (tipo === 'viñeta') {
        return `<div class="exec-instruccion-row"><span class="exec-instruccion-num">•</span> ${esc(text)}</div>`;
      }
      stepNum++;
      return `<div class="exec-instruccion-row"><span class="exec-instruccion-num">${stepNum}.</span> ${esc(text)}</div>`;
    }).join('');

    const insumosHTML = (et.insumos || []).filter(ins => ins.nombre).map(ins =>
      `<div class="detail-insumo-row">• ${esc(ins.nombre)}: <strong>${ins.cantidad} ${esc(ins.unidad)}</strong></div>`
    ).join('');

    return `
      <div class="receta-detail-etapa">
        <div class="receta-detail-etapa-header">
          <span class="etapa-num">Etapa ${i + 1}</span>
          <span class="receta-detail-etapa-nombre">${esc(et.nombre)}</span>
          ${et.tiempoEstimado ? `<span class="receta-detail-etapa-tiempo">⏱ ${et.tiempoEstimado} min</span>` : ''}
        </div>
        ${instrHTML ? `<div class="exec-instrucciones">${instrHTML}</div>` : ''}
        ${insumosHTML ? `<div class="receta-detail-insumos"><div class="receta-detail-insumos-title">Insumos:</div>${insumosHTML}</div>` : ''}
      </div>
    `;
  }).join('');

  document.getElementById('recetaDetailBody').innerHTML = `
    ${rec.descripcion ? `<div class="info-box">${esc(rec.descripcion)}</div>` : ''}
    <div class="receta-detail-etapas">${etapasHTML || '<div class="empty-state">Esta receta no tiene etapas.</div>'}</div>
  `;

  document.getElementById('btnEditFromRecetaDetail').onclick = () => {
    document.getElementById('recetaDetailOverlay').classList.remove('open');
    openRecetaModal(recetaId);
  };
  document.getElementById('recetaDetailOverlay').classList.add('open');
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
    html += `<div class="analysis-row">
      <span class="analysis-label">pH medido</span>
      <span class="analysis-value" style="color:${ev.ph <= 4.0 ? '#10B981' : '#EF4444'}">${ev.ph} ${ev.ph <= 4.0 ? '✓ Seguro' : '✗ Revisar'}</span>
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
          return `<div class="detail-etapa-item">
            <div class="detail-etapa-nombre">Etapa ${i + 1}: ${esc(et.nombre)}</div>
            <div class="detail-etapa-dur">⏱ ${durEt}</div>
            ${insHTML}
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
    ${ev.observaciones ? `<div class="detail-row detail-row--col"><span class="detail-label">Evaluación</span><span class="detail-value">${esc(ev.observaciones)}</span></div>` : ''}
    ${etapasHTML ? `<div class="detail-row detail-row--col"><span class="detail-label">Etapas</span>${etapasHTML}</div>` : ''}
    ${analysisHTML}
    <div style="margin-top:12px">
      <button class="btn-outline" id="btnDownloadEjecucionTxt" style="width:100%">⬇️ Descargar TXT de esta ejecución</button>
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
  });
});

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
    renderEtapasList(rec.etapas);
  } else {
    document.getElementById('recetaModalTitle').textContent = 'Nueva receta';
    document.getElementById('recetaNombre').value = '';
    document.getElementById('recetaDesc').value   = '';
    renderEtapasList([]);
  }

  overlay.classList.add('open');
  setTimeout(() => document.getElementById('recetaNombre').focus(), 100);
}

function renderEtapasList(etapas) {
  const container = document.getElementById('etapasList');
  container.innerHTML = '';
  etapas.forEach((et, idx) => addEtapaToList(et, idx));
}

function addEtapaToList(etapa, idx) {
  const container = document.getElementById('etapasList');
  const num = idx !== undefined ? idx : container.querySelectorAll('.etapa-item').length;
  const instrArr = parseInstrucciones(etapa.instrucciones);
  const isEditing = !!editRecetaId;

  const item = document.createElement('div');
  item.className = 'etapa-item';

  item.innerHTML = `
    <div class="etapa-header">
      <span class="etapa-num">Etapa ${num + 1}</span>
      <button class="etapa-collapse-btn" title="Colapsar/Expandir etapa">▼</button>
      <button class="etapa-del" title="Eliminar etapa">✕</button>
    </div>
    <div class="etapa-body">
      <label class="field-label">Nombre de la etapa *</label>
      <input class="field-input etapa-nombre" type="text" value="${esc(etapa.nombre || '')}" placeholder="Ej: Lavado de materia prima" />
      <label class="field-label">Instrucciones <span class="field-label-hint">· # = paso numerado &nbsp;•  = viñeta</span></label>
      <div class="instrucciones-list"></div>
      <button class="btn-outline btn-sm btn-add-instruccion" style="margin-top:4px;margin-bottom:14px">+ Agregar instrucción</button>
      <label class="field-label">Tiempo estimado (minutos)</label>
      <input class="field-input etapa-tiempo" type="number" min="1" value="${etapa.tiempoEstimado || ''}" placeholder="15" style="width:120px" />
      <label class="field-label">Insumos / ingredientes</label>
      <div class="insumos-list"></div>
      <button class="btn-outline btn-sm btn-add-insumo" style="margin-top:4px">+ Agregar insumo</button>
    </div>
  `;

  // Populate instruction rows
  const instrList = item.querySelector('.instrucciones-list');
  instrArr.forEach(item => instrList.appendChild(buildInstruccionRow(item.text, item.tipo)));

  // Populate insumo rows
  const insList = item.querySelector('.insumos-list');
  (etapa.insumos || []).forEach((ins, iIdx) => insList.appendChild(buildInsumoRow(ins, iIdx)));

  // Collapse/expand toggle
  const collapseBtn = item.querySelector('.etapa-collapse-btn');
  const etapaBody   = item.querySelector('.etapa-body');

  // When editing an existing recipe, collapse stages except the first one
  if (isEditing && idx !== undefined && idx > 0) {
    etapaBody.style.display = 'none';
    collapseBtn.textContent = '▶';
  }

  collapseBtn.addEventListener('click', () => {
    if (!etapaBody) return;
    const collapsed = etapaBody.style.display === 'none';
    etapaBody.style.display = collapsed ? '' : 'none';
    collapseBtn.textContent  = collapsed ? '▼' : '▶';
  });

  item.querySelector('.etapa-del').addEventListener('click', () => {
    item.remove();
    renumberEtapas();
  });
  item.querySelector('.btn-add-instruccion').addEventListener('click', () => {
    instrList.appendChild(buildInstruccionRow('', 'paso'));
    instrList.lastElementChild.querySelector('.instruccion-text').focus();
  });
  item.querySelector('.btn-add-insumo').addEventListener('click', () => {
    insList.appendChild(buildInsumoRow({}, insList.children.length));
  });

  container.appendChild(item);
}

function parseInstrucciones(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map(item => typeof item === 'string' ? { text: item, tipo: 'paso' } : item);
  }
  return val.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text, tipo: 'paso' }));
}

function buildInstruccionesHTML(instrucciones) {
  const arr = parseInstrucciones(instrucciones);
  if (!arr.length) return '';
  let stepNum = 0;
  return `<div class="exec-instrucciones">
    ${arr.map(item => {
      const text = item.text || item;
      const tipo = item.tipo || 'paso';
      if (tipo === 'viñeta') {
        return `<div class="exec-instruccion-row"><span class="exec-instruccion-num">•</span> ${esc(text)}</div>`;
      }
      stepNum++;
      return `<div class="exec-instruccion-row"><span class="exec-instruccion-num">${stepNum}.</span> ${esc(text)}</div>`;
    }).join('')}
  </div>`;
}

function buildInstruccionRow(text, tipo = 'paso') {
  const row = document.createElement('div');
  row.className = 'instruccion-row';
  row.innerHTML = `
    <button class="instruccion-tipo-btn" data-tipo="${tipo}" type="button" title="${tipo === 'viñeta' ? 'Cambiar a paso numerado' : 'Cambiar a viñeta'}">${tipo === 'viñeta' ? '•' : '#'}</button>
    <input class="field-input instruccion-text" type="text" value="${esc(text || '')}" placeholder="Describir el paso…" style="flex:1" />
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
  return row;
}

function buildInsumoRow(ins, idx) {
  const row = document.createElement('div');
  row.className = 'insumo-row';
  row.innerHTML = `
    <input class="field-input insumo-nombre" type="text" value="${esc(ins.nombre || '')}" placeholder="Insumo" style="flex:2" />
    <input class="field-input insumo-cantidad" type="number" value="${ins.cantidad || ''}" placeholder="Cant." style="flex:1;min-width:70px" min="0" step="any" />
    <input class="field-input insumo-unidad" type="text" value="${esc(ins.unidad || '')}" placeholder="Unidad (g, L…)" style="flex:1;min-width:70px" />
    <button class="subtask-remove" title="Quitar">✕</button>
  `;
  row.querySelector('.subtask-remove').addEventListener('click', () => row.remove());
  return row;
}

function renumberEtapas() {
  document.querySelectorAll('#etapasList .etapa-item').forEach((item, i) => {
    const span = item.querySelector('.etapa-num');
    if (span) span.textContent = `Etapa ${i + 1}`;
  });
}

function collectEtapas() {
  return Array.from(document.querySelectorAll('#etapasList .etapa-item')).map(item => {
    const insumos = Array.from(item.querySelectorAll('.insumo-row')).map(row => ({
      nombre:   row.querySelector('.insumo-nombre').value.trim(),
      cantidad: parseFloat(row.querySelector('.insumo-cantidad').value) || 0,
      unidad:   row.querySelector('.insumo-unidad').value.trim()
    })).filter(ins => ins.nombre);
    const instrucciones = Array.from(item.querySelectorAll('.instruccion-row'))
      .map(row => ({
        text: row.querySelector('.instruccion-text').value.trim(),
        tipo: row.querySelector('.instruccion-tipo-btn')?.dataset.tipo || 'paso'
      }))
      .filter(i => i.text);
    return {
      id:             crypto.randomUUID(),
      nombre:         item.querySelector('.etapa-nombre').value.trim(),
      instrucciones,
      tiempoEstimado: parseInt(item.querySelector('.etapa-tiempo').value) || 0,
      insumos
    };
  }).filter(et => et.nombre);
}

document.getElementById('btnAddEtapa').addEventListener('click', () => {
  addEtapaToList({}, undefined);
});

document.getElementById('btnCloseReceta').addEventListener('click', () => {
  document.getElementById('recetaOverlay').classList.remove('open');
});
document.getElementById('recetaOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('recetaOverlay'))
    document.getElementById('recetaOverlay').classList.remove('open');
});

document.getElementById('btnSaveReceta').addEventListener('click', async () => {
  const nombre = document.getElementById('recetaNombre').value.trim();
  const desc   = document.getElementById('recetaDesc').value.trim();
  const etapas = collectEtapas();
  const fb     = document.getElementById('recetaFeedback');

  if (!nombre) return setFb(fb, 'El nombre de la receta es obligatorio.', 'err');
  if (!etapas.length) return setFb(fb, 'Agrega al menos una etapa.', 'err');

  const btn = document.getElementById('btnSaveReceta');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    if (editRecetaId) {
      const rec = recetas.find(r => r.id === editRecetaId);
      if (rec) {
        rec.nombre = nombre; rec.descripcion = desc; rec.etapas = etapas;
        await updateReceta(rec);
      }
    } else {
      await appendReceta({
        id: crypto.randomUUID(), nombre, descripcion: desc, etapas,
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

// ── Procesos: Lot utilities ───────────────────────────────────────────────────

function generateLotId(recipeName) {
  const now  = new Date();
  const abbr = (recipeName || 'LOT').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'LOT';
  const opts = { timeZone: 'America/Bogota' };
  const date = now.toLocaleDateString('en-CA', opts).replace(/-/g, '');
  const time = now.toLocaleTimeString('es-CO', { ...opts, hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '');
  return `TQ-${abbr}-${date}-${time}`;
}

const SCORE_LEVELS = [
  { min: 27, label: 'ÓPTIMO',         cls: 'level-opt' },
  { min: 21, label: 'CORRECTO',       cls: 'level-ok'  },
  { min: 15, label: 'ACEPTABLE',      cls: 'level-acc' },
  { min:  9, label: 'EN DESARROLLO',  cls: 'level-dev' },
  { min:  0, label: 'REFORMULAR',     cls: 'level-bad' },
];

function updateEvalScore() {
  const filled = Object.values(evalScores).filter(v => v > 0).length;
  const total  = Object.values(evalScores).reduce((a, b) => a + b, 0);
  const valEl  = document.getElementById('evalScoreValue');
  const lvlEl  = document.getElementById('evalScoreLevel');
  if (!valEl) return;
  valEl.textContent = filled > 0 ? `${total}/30` : '—/30';
  if (filled === 6) {
    const lvl = SCORE_LEVELS.find(l => total >= l.min) || SCORE_LEVELS[SCORE_LEVELS.length - 1];
    lvlEl.textContent = lvl.label;
    lvlEl.className   = `eval-score-level ${lvl.cls}`;
  } else {
    lvlEl.textContent = `${filled}/6 dimensiones evaluadas`;
    lvlEl.className   = 'eval-score-level';
  }
}

// ── Procesos: Recipe execution with stage timer ───────────────────────────────

function saveExecutionProgress() {
  if (!executionState) return;
  try {
    localStorage.setItem('ss_exec_progress', JSON.stringify({
      recetaId:          executionState.receta.id,
      currentStageIndex: executionState.currentStageIndex,
      stagesData:        executionState.stagesData,
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
        stagesData:        saved.stagesData
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
    stagesData: []
  };

  document.getElementById('ejecutarTitle').textContent = `Receta: ${receta.nombre}`;
  document.getElementById('ejecutarOverlay').classList.add('open');
  renderExecutionStep();
}

function renderExecutionStep() {
  if (!executionState) return;
  const { receta, currentStageIndex } = executionState;
  const etapa = receta.etapas[currentStageIndex];
  const total = receta.etapas.length;
  const isLast = currentStageIndex === total - 1;

  if (executionState.timerInterval) clearInterval(executionState.timerInterval);
  executionState.stageStartTime = Date.now();

  const body = document.getElementById('ejecutarBody');
  body.innerHTML = `
    <div class="exec-progress">
      <div class="exec-progress-bar" style="width:${((currentStageIndex + 1) / total * 100).toFixed(0)}%"></div>
    </div>
    <div class="exec-step-label">Etapa ${currentStageIndex + 1} de ${total}</div>
    <h3 class="exec-stage-name">${esc(etapa.nombre)}</h3>
    ${buildInstruccionesHTML(etapa.instrucciones)}
    ${etapa.tiempoEstimado ? `<div class="exec-time-hint">⏱ Tiempo estimado: ${etapa.tiempoEstimado} min</div>` : ''}

    <div class="exec-timer" id="execTimer">00:00</div>

    ${etapa.insumos && etapa.insumos.length ? `
      <div class="exec-insumos-section">
        <h4 class="exec-insumos-title">Confirmar insumos usados</h4>
        <p class="exec-insumos-note">Verifica o ajusta las cantidades reales antes de continuar.</p>
        <div class="exec-insumos-list">
          ${etapa.insumos.map((ins, i) => `
            <div class="exec-insumo-row">
              <span class="exec-insumo-nombre">${esc(ins.nombre)}</span>
              <span class="exec-insumo-planned">(planeado: ${ins.cantidad} ${esc(ins.unidad)})</span>
              <div style="display:flex;align-items:center;gap:6px">
                <input class="field-input exec-insumo-real" data-idx="${i}" type="number" value="${ins.cantidad}" min="0" step="any" style="width:90px" />
                <span>${esc(ins.unidad)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div style="margin-top:20px">
      <button class="btn-primary exec-next-btn" id="btnNextStage">
        ${isLast ? '✅ Finalizar receta' : '➡️ Siguiente etapa'}
      </button>
    </div>
  `;

  executionState.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - executionState.stageStartTime) / 1000);
    const timerEl = document.getElementById('execTimer');
    if (timerEl) timerEl.textContent = fmtSeconds(elapsed);
  }, 1000);

  document.getElementById('btnNextStage').addEventListener('click', () => advanceStage());
}

function advanceStage() {
  if (!executionState) return;
  const { receta, currentStageIndex } = executionState;
  const etapa = receta.etapas[currentStageIndex];

  clearInterval(executionState.timerInterval);
  const duracion = Math.floor((Date.now() - executionState.stageStartTime) / 1000);

  const insumosConfirmados = (etapa.insumos || []).map((ins, i) => {
    const realInput = document.querySelector(`.exec-insumo-real[data-idx="${i}"]`);
    return {
      nombre:              ins.nombre,
      cantidadPlanificada: ins.cantidad,
      cantidadReal:        realInput ? parseFloat(realInput.value) || 0 : ins.cantidad,
      unidad:              ins.unidad
    };
  });

  executionState.stagesData.push({
    nombre:              etapa.nombre,
    duracionReal:        duracion,
    insumosConfirmados
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
  document.getElementById('evalSelloTapa').checked = false;
  document.getElementById('evalSelloPop').checked  = false;
  document.getElementById('evalSelloOlor').checked = false;
  document.querySelectorAll('input[name="evalSineresis"]').forEach(r => r.checked = false);
  document.getElementById('evalScoreValue').textContent = '—/30';
  document.getElementById('evalScoreLevel').textContent  = '';
  document.getElementById('evalScoreLevel').className    = 'eval-score-level';
  document.getElementById('evalObs').value    = '';
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

  document.getElementById('evalFrascos230').value = '';
  document.getElementById('evalFrascos180').value = '';
  document.getElementById('evalExcedente').value = '';
  document.getElementById('evalFrascosTotal').textContent = '—';
  document.getElementById('evalRendimientoResult').textContent = '';
  document.getElementById('evalRendimientoResult').className = 'eval-rendimiento-result';

  document.getElementById('evaluacionOverlay').classList.add('open');
}

document.getElementById('btnCancelEjecutar').addEventListener('click', () => {
  if (!confirm('¿Cancelar la ejecución? Se perderán los datos de las etapas ya registradas.')) return;
  if (executionState?.timerInterval) clearInterval(executionState.timerInterval);
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

document.getElementById('btnCloseEvaluacion').addEventListener('click', () => {
  document.getElementById('evaluacionOverlay').classList.remove('open');
});

document.getElementById('btnSaveEvaluacion').addEventListener('click', async () => {
  const loteId = document.getElementById('evalLoteId').value.trim();
  const phVal  = parseFloat(document.getElementById('evalPH').value);
  const obs    = document.getElementById('evalObs').value.trim();
  const fb     = document.getElementById('evaluacionFeedback');

  if (!loteId) return setFb(fb, 'El número de lote es obligatorio.', 'err');
  if (isNaN(phVal)) return setFb(fb, 'El pH es obligatorio antes de envasar (I-01).', 'err');
  if (phVal > 4.0)  return setFb(fb, `⚠️ pH ${phVal.toFixed(2)} > 4.0 — agregar ácido cítrico 0.5 g y remedir. No se puede finalizar sin pH ≤ 4.0.`, 'err');
  if (!evaluacionPendiente) return;

  const scoreTotal = Object.values(evalScores).reduce((a, b) => a + b, 0);
  const sineresis  = document.querySelector('input[name="evalSineresis"]:checked')?.value || '';

  const btn = document.getElementById('btnSaveEvaluacion');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    evaluacionPendiente.loteId = loteId;
    evaluacionPendiente.evaluacion = {
      calificacion:  evalRating,
      observaciones: obs,
      ph:            phVal,
      scores:        { ...evalScores },
      scoreTotal,
      sello: {
        tapa: document.getElementById('evalSelloTapa').checked,
        pop:  document.getElementById('evalSelloPop').checked,
        olor: document.getElementById('evalSelloOlor').checked,
      },
      sineresis,
      fechaElaboracion:  document.getElementById('evalFechaElaboracion').value,
      fechaVencimiento:  document.getElementById('evalFechaVencimiento').value,
      frascos230:        parseInt(document.getElementById('evalFrascos230').value) || 0,
      frascos180:        parseInt(document.getElementById('evalFrascos180').value) || 0,
      excedente:         parseInt(document.getElementById('evalExcedente').value) || 0,
      totalInsumosG:     evaluacionTotalInsumosG,
      rendimiento:       (() => {
        const f230 = parseInt(document.getElementById('evalFrascos230').value) || 0;
        const f180 = parseInt(document.getElementById('evalFrascos180').value) || 0;
        const exc  = parseInt(document.getElementById('evalExcedente').value) || 0;
        const ml   = f230 * 230 + f180 * 180 + exc;
        return (ml > 0 && evaluacionTotalInsumosG > 0)
          ? Math.round(ml / evaluacionTotalInsumosG * 10000) / 100
          : null;
      })()
    };

    await appendEjecucion(evaluacionPendiente);
    clearExecutionProgress();
    await loadEjecucionesData();
    renderEjecucionesList();

    const lvl = SCORE_LEVELS.find(l => scoreTotal >= l.min);
    setFb(fb, `✅ Lote ${loteId} guardado. Puntaje técnico: ${scoreTotal}/30 — ${lvl?.label || ''}`, 'ok');
    setTimeout(() => document.getElementById('evaluacionOverlay').classList.remove('open'), 2500);
    evaluacionPendiente = null;
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar y finalizar lote';
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
      status.textContent = '✓ pH seguro';
      status.className   = 'eval-ph-status ok';
    } else {
      status.textContent = '✗ Ajustar — agregar ácido cítrico 0.5 g';
      status.className   = 'eval-ph-status err';
    }
  } else {
    status.textContent = '';
    status.className   = 'eval-ph-status';
  }
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

function ejecucionToText(ej) {
  const ev = ej.evaluacion || {};
  const lines = [
    `═══════════════════════════════════════`,
    `LOTE: ${ej.loteId || '—'}  |  ${ej.nombreReceta}`,
    `Fecha: ${new Date(ej.fechaFin || ej.creadoEn).toLocaleString('es-CO')}`,
    `Duración: ${Math.round((ej.duracionTotal || 0) / 60)} min`,
  ];
  if (ev.fechaElaboracion) lines.push(`Elaboración: ${ev.fechaElaboracion}  |  Vencimiento: ${ev.fechaVencimiento || '—'}`);
  if (ev.frascos230 != null || ev.frascos180 != null) {
    const f230 = ev.frascos230 || 0, f180 = ev.frascos180 || 0, exc = ev.excedente || 0;
    const ml = f230 * 230 + f180 * 180 + exc;
    lines.push(`Frascos: ${f230}×230ml + ${f180}×180ml + ${exc}ml excedente = ${ml} ml total`);
  }
  if (ev.rendimiento != null) {
    lines.push(`Rendimiento I-09: ${ev.rendimiento}% (${(ev.frascos230||0)*230+(ev.frascos180||0)*180+(ev.excedente||0)} ml de ${ev.totalInsumosG || '?'} g insumos)`);
  }
  if (ev.ph != null) lines.push(`pH: ${ev.ph}`);
  if (ev.sineresis) lines.push(`Sinéresis: ${ev.sineresis}`);
  if (ev.scoreTotal != null) lines.push(`Puntaje técnico: ${ev.scoreTotal}/30`);
  if (ev.observaciones) lines.push(`Observaciones: ${ev.observaciones}`);
  if (ej.etapasData?.length) {
    lines.push('', 'Etapas:');
    ej.etapasData.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.nombre || '—'}  ${Math.round(s.duracionReal / 60)} min`);
    });
  }
  lines.push('');
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
  if (!ejecucionesData?.length) return;
  const text = ejecucionesData.map(ejecucionToText).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `ejecuciones-${new Date().toISOString().slice(0,10)}.txt`;
  a.click(); URL.revokeObjectURL(url);
}

document.getElementById('btnDownloadEjecuciones').addEventListener('click', downloadEjecucionesTxt);

// ── Service Worker ────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW:', err));
}
