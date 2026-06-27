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
  if (info.name) bioSubtitle.textContent = `Hola, ${info.name.split(' ')[0]} 👋`;
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
  } catch {}

  await initSheet();
  await initKanbanSheets();
  setDefaultDateTime();
  await loadStories();
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

// ── Render ────────────────────────────────────────────────────────────────────

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
  const data = await sheetsReq('/values/KanbanTasks!A:H');
  const rows = (data.values || []).slice(1);
  kanbanTasks = rows
    .filter(r => r[0])
    .map((r, i) => ({
      id:        r[0] || '',
      area:      r[1] || '',
      title:     r[2] || '',
      desc:      r[3] || '',
      dueDate:   r[4] || '',
      status:    r[5] || '',
      createdAt: r[6] || '',
      updatedAt: r[7] || '',
      rowIndex:  i + 2
    }));
}

async function appendKanbanTask(task) {
  await sheetsReq('/values/KanbanTasks!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      task.id, task.area, task.title, task.desc,
      task.dueDate, task.status, task.createdAt, task.updatedAt
    ]]})
  });
}

async function updateKanbanTask(task) {
  await sheetsReq(`/values/KanbanTasks!A${task.rowIndex}:H${task.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      task.id, task.area, task.title, task.desc,
      task.dueDate, task.status, task.createdAt, new Date().toISOString()
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
      <div class="kanban-col-header">
        <span class="kanban-col-dot" style="background:${esc(col.color)}"></span>
        <span class="kanban-col-title">${esc(col.name)}</span>
        <span class="kanban-col-count">${colTasks.length}</span>
      </div>
      <div class="kanban-col-body" data-col="${esc(col.name)}"></div>
      ${col.terminal ? '' : `<div class="kanban-col-footer"><button class="kanban-add-card" data-col="${esc(col.name)}">+ Agregar</button></div>`}
    `;

    const colBody = colEl.querySelector('.kanban-col-body');

    colTasks.forEach(task => {
      const due  = fmtDue(task.dueDate);
      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.setAttribute('draggable', 'true');
      card.dataset.id  = task.id;

      card.innerHTML = `
        <div class="kanban-card-area">${esc(task.area)}</div>
        <div class="kanban-card-title">${esc(task.title)}</div>
        ${task.desc ? `<div class="kanban-card-desc">${esc(task.desc)}</div>` : ''}
        ${due.text   ? `<div class="kanban-card-due ${due.cls}">${due.text}</div>` : ''}
        <div class="kanban-card-footer">
          <button data-edit="${task.id}" title="Editar">✏️</button>
          <button data-del="${task.id}" data-row="${task.rowIndex}" title="Eliminar">🗑</button>
        </div>
      `;

      card.addEventListener('dragstart', e => {
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
    const tr    = document.createElement('tr');
    tr.innerHTML = `
      <td><span style="font-size:12px;color:var(--text-sub)">${esc(task.area)}</span></td>
      <td>
        <strong style="font-size:13px;color:var(--vinotinto);display:block">${esc(task.title)}</strong>
        ${task.desc ? `<span style="font-size:11px;color:var(--text-sub)">${esc(task.desc)}</span>` : ''}
      </td>
      <td><span class="status-pill" style="background:${color}22;color:${color}">${esc(task.status)}</span></td>
      <td><span class="kanban-card-due ${due.cls}" style="font-size:12px">${due.text}</span></td>
      <td style="white-space:nowrap">
        <button class="task-action-btn" data-edit="${task.id}" title="Editar">✏️</button>
        <button class="task-action-btn" data-del="${task.id}" data-row="${task.rowIndex}" title="Eliminar">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  container.innerHTML = '';
  container.appendChild(table);

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
  } else {
    document.getElementById('taskModalTitle').textContent = 'Nueva tarea';
    document.getElementById('taskArea').value   = kanbanAreas[0] || '';
    document.getElementById('taskTitle').value  = '';
    document.getElementById('taskDesc').value   = '';
    document.getElementById('taskDue').value    = '';
    const firstNonTerm = kanbanColumns.find(c => !c.terminal);
    document.getElementById('taskStatus').value = defaultStatus || firstNonTerm?.name || '';
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
  const area   = document.getElementById('taskArea').value;
  const title  = document.getElementById('taskTitle').value.trim();
  const desc   = document.getElementById('taskDesc').value.trim();
  const due    = document.getElementById('taskDue').value;
  const status = document.getElementById('taskStatus').value;
  const fb     = document.getElementById('taskFeedback');

  if (!title) return setFb(fb, 'El título es obligatorio.', 'err');
  if (!due)   return setFb(fb, 'La fecha límite es obligatoria.', 'err');

  const btn = document.getElementById('btnSaveTask');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    if (kanbanEditId) {
      const task = kanbanTasks.find(t => t.id === kanbanEditId);
      if (task) {
        task.area = area; task.title = title; task.desc = desc;
        task.dueDate = due; task.status = status;
        await updateKanbanTask(task);
      }
    } else {
      const now = new Date().toISOString();
      await appendKanbanTask({
        id: crypto.randomUUID(), area, title, desc,
        dueDate: due, status, createdAt: now, updatedAt: now
      });
    }
    await loadKanbanTasks();
    document.getElementById('taskOverlay').classList.remove('open');

    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (activeTab === 'kanban') renderKanban();
    else if (activeTab === 'lista') renderKanbanList();
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

// ── Tab switching ─────────────────────────────────────────────────────────────

async function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('tabStories').style.display = tab === 'stories' ? '' : 'none';
  document.getElementById('tabKanban').style.display  = tab === 'kanban'  ? '' : 'none';
  document.getElementById('tabLista').style.display   = tab === 'lista'   ? '' : 'none';

  if (tab === 'kanban') {
    document.getElementById('kanbanBoard').innerHTML = '<div class="loading-state" style="padding:48px 0">Cargando…</div>';
    await loadKanbanConfig();
    await loadKanbanTasks();
    populateAreaSelects();
    populateStatusSelects();
    renderKanban();
  }
  if (tab === 'lista') {
    document.getElementById('tasksList').innerHTML = '<div class="loading-state">Cargando…</div>';
    await loadKanbanConfig();
    await loadKanbanTasks();
    populateAreaSelects();
    populateStatusSelects();
    renderKanbanList();
  }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('btnNewTask').addEventListener('click', () => openTaskModal(null, null));
document.getElementById('kanbanAreaFilter').addEventListener('change', renderKanban);
document.getElementById('listaAreaFilter').addEventListener('change', renderKanbanList);
document.getElementById('listaStatusFilter').addEventListener('change', renderKanbanList);
