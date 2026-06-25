// ── State ─────────────────────────────────────────────────────────────────────
let accessToken    = null;
let tokenExpiry    = null;
let tokenClient    = null;
let selectedFile   = null;
let storiesSheetId = null;   // numeric sheetId for the Stories tab (used for row deletion)

// ── DOM refs ──────────────────────────────────────────────────────────────────
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

const settingsOverlay  = document.getElementById('settingsOverlay');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const settingsPhone    = document.getElementById('settingsPhone');
const settingsApikey   = document.getElementById('settingsApikey');
const btnSaveSettings  = document.getElementById('btnSaveSettings');
const settingsFeedback = document.getElementById('settingsFeedback');

// ── Google Auth ───────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  const poll = setInterval(() => {
    if (window.google?.accounts?.oauth2) { clearInterval(poll); initAuth(); }
  }, 100);
});

function initAuth() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: async (resp) => {
      if (resp.error) return console.error('Auth error:', resp.error);
      accessToken  = resp.access_token;
      tokenExpiry  = Date.now() + resp.expires_in * 1000;
      await onAuthSuccess();
    }
  });
}

btnSignIn.addEventListener('click', () => tokenClient.requestAccessToken({ prompt: 'consent' }));

btnSignOut.addEventListener('click', () => {
  google.accounts.oauth2.revoke(accessToken, () => {
    accessToken = null;
    screenApp.style.display   = 'none';
    screenSignIn.style.display = '';
    btnSettings.style.display  = 'none';
    btnSignOut.style.display   = 'none';
    userInfoEl.textContent     = '';
  });
});

async function ensureToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) return;
  await new Promise((resolve, reject) => {
    const saved = tokenClient.callback;
    tokenClient.callback = (resp) => {
      tokenClient.callback = saved;
      if (resp.error) { reject(new Error(resp.error)); return; }
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + resp.expires_in * 1000;
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

async function onAuthSuccess() {
  screenSignIn.style.display = 'none';
  screenApp.style.display    = '';
  btnSettings.style.display  = '';
  btnSignOut.style.display   = '';

  try {
    const u = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then(r => r.json());
    userInfoEl.textContent = u.name || u.email || '';
  } catch {}

  await initSheet();
  setDefaultDateTime();
  await loadStories();
}

// ── Sheets API helpers ────────────────────────────────────────────────────────

const SHEETS_BASE = () => `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}`;

async function sheetsReq(path, opts = {}) {
  await ensureToken();
  const url      = path.startsWith('http') ? path : `${SHEETS_BASE()}${path}`;
  const isGet    = !opts.method || opts.method === 'GET';
  const headers  = {
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

// Initialise the spreadsheet: create "Stories" and "Config" tabs if missing, add headers.
async function initSheet() {
  const info   = await sheetsReq('');
  const tabs   = info.sheets || [];
  const hasS   = tabs.find(s => s.properties.title === 'Stories');
  const hasC   = tabs.find(s => s.properties.title === 'Config');

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

  // Stories headers
  const sd = await sheetsReq('/values/Stories!A1').catch(() => ({}));
  if (!sd.values) {
    await sheetsReq('/values/Stories!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID','Title','Actions','ScheduledAt','DriveFileId','OriginalName','MimeType','ThumbUrl','Sent','SentAt','CreatedAt']] })
    });
  }

  // Config rows (phone + apikey)
  const cd = await sheetsReq('/values/Config!A1').catch(() => ({}));
  if (!cd.values) {
    await sheetsReq('/values/Config!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['phone','3122132279'],['apikey','']] })
    });
  }
}

// ── Stories CRUD ──────────────────────────────────────────────────────────────

async function loadStories() {
  try {
    const data   = await sheetsReq('/values/Stories!A:K');
    const rows   = (data.values || []).slice(1);   // skip header

    const stories = rows
      .filter(r => r[0])
      .map((r, i) => ({
        id:          r[0]  || '',
        title:       r[1]  || '',
        actions:     r[2]  || '',
        scheduledAt: r[3]  || '',
        driveFileId: r[4]  || '',
        origName:    r[5]  || '',
        mimeType:    r[6]  || '',
        thumbUrl:    r[7]  || '',
        sent:        r[8] === 'TRUE',
        sentAt:      r[9]  || '',
        createdAt:   r[10] || '',
        rowIndex:    i + 2   // 1-based + header row
      }))
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
  // Resolve numeric sheetId if we somehow don't have it
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
          startIndex: rowIndex - 1,   // 0-indexed, inclusive
          endIndex:   rowIndex        // 0-indexed, exclusive
        }
      }
    }]})
  });
}

// ── Config (phone + apikey stored in Config sheet) ────────────────────────────

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

// ── Google Drive upload (resumable) ───────────────────────────────────────────

async function uploadToDrive(file, onProgress) {
  await ensureToken();

  // Initiate resumable session
  const initResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      Authorization:            `Bearer ${accessToken}`,
      'Content-Type':           'application/json',
      'X-Upload-Content-Type':  file.type,
      'X-Upload-Content-Length': String(file.size)
    },
    body: JSON.stringify({ name: file.name, mimeType: file.type })
  });
  if (!initResp.ok) throw new Error('No se pudo iniciar la subida a Drive');
  const uploadUrl = initResp.headers.get('Location');

  // Upload with progress via XHR
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

  // Make publicly readable so thumbnails render in <img> tags
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  });

  return fileData;
}

function thumbUrl(fileId, mimeType) {
  if (!fileId) return '';
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;
}

// ── Dropzone ──────────────────────────────────────────────────────────────────

dropzone.addEventListener('click', e => {
  if (!e.target.closest('#uploadProgress')) fileInput.click();
});
dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault(); dropzone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

function setFile(file) {
  selectedFile = file;
  previewEl.innerHTML = '';
  dropzoneInner.style.display = 'none';

  if (file.type.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    previewEl.appendChild(img);
  } else if (file.type.startsWith('video/')) {
    const vid = document.createElement('video');
    vid.src = URL.createObjectURL(file);
    vid.controls = true; vid.muted = true;
    previewEl.appendChild(vid);
  }
  const nm = document.createElement('div');
  nm.className = 'file-name'; nm.textContent = file.name;
  previewEl.appendChild(nm);
}

function resetFile() {
  selectedFile = null;
  previewEl.innerHTML = '';
  fileInput.value = '';
  dropzoneInner.style.display = '';
}

// ── Add story ─────────────────────────────────────────────────────────────────

btnAdd.addEventListener('click', async () => {
  const title    = fTitle.value.trim();
  const actions  = fActions.value.trim();
  const sched    = fSchedule.value;

  if (!title) return setFb(formFeedback, 'El título es obligatorio.', 'err');
  if (!sched) return setFb(formFeedback, 'La fecha es obligatoria.',  'err');

  btnAdd.disabled = true; btnAdd.textContent = 'Guardando…';

  try {
    let fileId = '', mimeType = '', origName = '', thumb = '';

    if (selectedFile) {
      uploadProg.style.display = '';
      progressFill.style.width = '0%';
      progressText.textContent = 'Subiendo a Google Drive…';

      const fd = await uploadToDrive(selectedFile, pct => {
        progressFill.style.width = `${pct}%`;
        progressText.textContent = `Subiendo… ${pct}%`;
      });

      fileId   = fd.id;
      mimeType = selectedFile.type;
      origName = selectedFile.name;
      thumb    = thumbUrl(fileId, mimeType);

      progressFill.style.width = '100%';
      progressText.textContent = '✅ Guardado en Drive';
      await delay(1000);
      uploadProg.style.display = 'none';
    }

    await appendStory({
      id:          crypto.randomUUID(),
      title, actions,
      scheduledAt: new Date(sched).toISOString(),
      driveFileId: fileId, origName, mimeType, thumbUrl: thumb,
      createdAt:   new Date().toISOString()
    });

    setFb(formFeedback, '✅ Historia programada correctamente.', 'ok');
    fTitle.value = ''; fActions.value = ''; resetFile();
    await loadStories();
  } catch (e) {
    console.error(e);
    setFb(formFeedback, `Error: ${e.message}`, 'err');
  } finally {
    btnAdd.disabled = false; btnAdd.textContent = 'Programar historia';
    uploadProg.style.display = 'none';
  }
});

// ── Render ────────────────────────────────────────────────────────────────────

function renderStories(stories) {
  const pending = stories.filter(s => !s.sent).length;
  pendingBadge.textContent = `${pending} pendiente${pending !== 1 ? 's' : ''}`;

  if (!stories.length) {
    storiesList.innerHTML = '<div class="empty-state">Aún no hay historias programadas</div>';
    return;
  }

  storiesList.innerHTML = stories.map(storyCardHTML).join('');

  storiesList.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta historia?')) return;
      try { await deleteRow(+btn.dataset.delete); await loadStories(); }
      catch (e) { alert(`Error al eliminar: ${e.message}`); }
    });
  });

  storiesList.querySelectorAll('[data-drive]').forEach(btn => {
    btn.addEventListener('click', () =>
      window.open(`https://drive.google.com/file/d/${btn.dataset.drive}/view`, '_blank')
    );
  });
}

function storyCardHTML(s) {
  const thumb = s.thumbUrl
    ? `<img src="${s.thumbUrl}" alt="" loading="lazy" onerror="this.outerHTML='<span style=font-size:28px>🖼</span>'">`
    : (s.mimeType?.startsWith('video/') ? '🎬' : '🖼');

  const actions = s.actions
    ? esc(s.actions)
    : '<em style="opacity:.55">Sin acciones especificadas</em>';

  const driveBtn = s.driveFileId
    ? `<button class="btn-drive" data-drive="${s.driveFileId}" title="Ver en Drive">📂</button>` : '';

  return `
    <div class="story-card ${s.sent ? 'sent' : ''}">
      <div class="story-thumb">${thumb}</div>
      <div class="story-body">
        <div class="story-title">${esc(s.title)}</div>
        <div class="story-date">📅 ${fmtDate(s.scheduledAt)}</div>
        <div class="story-actions">${actions}</div>
        <div class="story-footer">
          <span class="story-status ${s.sent ? 'done' : 'pending'}">${s.sent ? '✅ Enviada' : '⏳ Pendiente'}</span>
          ${driveBtn}
        </div>
      </div>
      <div class="story-actions-btn">
        <button class="story-delete" data-delete="${s.rowIndex}" title="Eliminar">🗑</button>
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

// Auto-refresh cada 60 s
setInterval(() => { if (accessToken) loadStories(); }, 60000);
