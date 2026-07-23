import { sheetsReq, uploadToDrive, deleteDriveFile, downloadDriveFile, thumbUrl } from './auth.js';
import { esc, setFb, fmtDate, delay, confirmCloseIfDirty, ICON_FILM, ICON_IMAGE, ICON_FOLDER, ICON_DOWNLOAD, ICON_CHECK, ICON_CALENDAR, ICON_TRASH, ICON_SPINNER } from './utils.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const dropzone      = document.getElementById('dropzone');
const dropzoneInner = document.getElementById('dropzoneInner');
const fileInput     = document.getElementById('fileInput');
const previewEl     = document.getElementById('dropzonePreview');
const uploadProg    = document.getElementById('uploadProgress');
const progressFill  = document.getElementById('progressFill');
const progressText  = document.getElementById('progressText');

const fTitle       = document.getElementById('fTitle');
const fActions     = document.getElementById('fActions');
const fSchedule    = document.getElementById('fSchedule');
const btnAdd       = document.getElementById('btnAddStory');
const formFeedback = document.getElementById('formFeedback');
const storiesList   = document.getElementById('storiesList');
const pendingBadge  = document.getElementById('pendingBadge');
const todayAlert    = document.getElementById('todayAlert');

const btnSettings      = document.getElementById('btnSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const settingsPhone    = document.getElementById('settingsPhone');
const settingsApikey   = document.getElementById('settingsApikey');
const settingsOverlay  = document.getElementById('settingsOverlay');
const btnSaveSettings  = document.getElementById('btnSaveSettings');
const settingsFeedback = document.getElementById('settingsFeedback');

let selectedFiles  = [];
let storiesSheetId = null;

export async function initSheet() {
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

export async function loadStories() {
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

export async function loadConfig() {
  const data = await sheetsReq('/values/Config!A:B');
  const cfg  = {};
  (data.values || []).forEach(r => { if (r[0]) cfg[r[0]] = r[1] || ''; });
  return cfg;
}

export async function saveConfig(phone, apikey) {
  await sheetsReq('/values/Config!A1:B2?valueInputOption=RAW', {
    method: 'PUT',
    body: JSON.stringify({ values: [['phone', phone], ['apikey', apikey]] })
  });
}

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

export function setDefaultDateTime() {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  fSchedule.value = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

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
