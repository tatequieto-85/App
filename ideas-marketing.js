import { sheetsReq, uploadToDrive, deleteDriveFile, thumbUrl, streamDriveFile } from './auth.js';
import {
  esc, setFb, fmtDate, delay, confirmCloseIfDirty, safeLoad, safeParseJSON, fmtSeconds,
  ICON_CALENDAR, ICON_MIC, ICON_SPINNER
} from './utils.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const ideasMarketingList = document.getElementById('ideasMarketingList');
const btnNewIdeaMarketing = document.getElementById('btnNewIdeaMarketing');

const ideaMktOverlay        = document.getElementById('ideaMktOverlay');
const btnCloseIdeaMkt       = document.getElementById('btnCloseIdeaMkt');
const ideaMktDescripcion    = document.getElementById('ideaMktDescripcion');
const ideaMktCategoria      = document.getElementById('ideaMktCategoria');
const ideaMktPhotoInput     = document.getElementById('ideaMktPhotoInput');
const btnAddIdeaMktPhoto    = document.getElementById('btnAddIdeaMktPhoto');
const ideaMktPhotoPreview   = document.getElementById('ideaMktPhotoPreview');
const btnRecordIdeaMktAudio = document.getElementById('btnRecordIdeaMktAudio');
const ideaMktRecordTimer    = document.getElementById('ideaMktRecordTimer');
const ideaMktAudioList      = document.getElementById('ideaMktAudioList');
const ideaMktUploadProgress = document.getElementById('ideaMktUploadProgress');
const ideaMktProgressFill   = document.getElementById('ideaMktProgressFill');
const ideaMktProgressText   = document.getElementById('ideaMktProgressText');
const btnSaveIdeaMkt        = document.getElementById('btnSaveIdeaMkt');
const ideaMktFeedback       = document.getElementById('ideaMktFeedback');

const editIdeaMktOverlay     = document.getElementById('editIdeaMktOverlay');
const btnCloseEditIdeaMkt    = document.getElementById('btnCloseEditIdeaMkt');
const editIdeaMktDescripcion = document.getElementById('editIdeaMktDescripcion');
const btnSaveEditIdeaMkt     = document.getElementById('btnSaveEditIdeaMkt');
const editIdeaMktFeedback    = document.getElementById('editIdeaMktFeedback');

const ideaMktPlayer = document.getElementById('ideaMktPlayer');

let ideasMkt        = [];
let ideasMktSheetId = null;
let editingIdeaMktRow = null;
let currentAudioObjectUrl = null;

// ── Sheet: IdeasMarketing ─────────────────────────────────────────────────────

export async function initIdeasMarketingSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const has  = tabs.find(s => s.properties.title === 'IdeasMarketing');
  if (has) ideasMktSheetId = has.properties.sheetId;

  if (!has) {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'IdeasMarketing' } } }] })
    });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'IdeasMarketing') ideasMktSheetId = r.addSheet.properties.sheetId;
    });
  }

  const sd = await sheetsReq('/values/IdeasMarketing!A1:L1').catch(() => ({}));
  if (!sd.values) {
    await sheetsReq('/values/IdeasMarketing!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [[
        'ID', 'Descripcion', 'PhotoFileIds', 'PhotoNames', 'PhotoMimeTypes', 'PhotoThumbUrls',
        'AudioFileIds', 'AudioNames', 'AudioMimeTypes', 'AudioDurations', 'CreatedAt', 'Categoria'
      ]] })
    });
  } else if ((sd.values[0] || []).length < 12) {
    // Base ya existente creada antes de agregar Categoria — la columna
    // nueva va al final, se parchea el header si falta.
    await sheetsReq('/values/IdeasMarketing!L1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['Categoria']] })
    });
  }
}

// Ideas de marketing absorbió al viejo módulo Ideas (banco de ideas por
// área, con propósito/alineación) — se llama una sola vez por conexión a
// una base (provisionAllTabs en bases.js). Lee la pestaña Ideas directo
// por sheetsReq, sin depender de ideas.js (que se borró): el área,
// propósito y alineación no tienen columna equivalente acá, así que se
// anexan como texto extra a la descripción en vez de perderse. Al
// terminar, vacía las filas migradas (no borra la pestaña entera) para
// que la próxima conexión no las vuelva a migrar.
export async function migrateOldIdeasToMarketing() {
  const data = await sheetsReq('/values/Ideas!A:H').catch(() => ({}));
  const rows = (data.values || []).slice(1).filter(r => r[0]);
  if (!rows.length) return;

  for (const r of rows) {
    const descripcion = r[2] || '';
    const area        = r[3] || '';
    const proposito    = r[5] || '';
    const alineacion   = r[6] || '';
    const archivo      = safeParseJSON(r[7], null);

    const extra = [];
    if (area)       extra.push(`Área: ${area}`);
    if (proposito)   extra.push(`Propósito: ${proposito}`);
    if (alineacion)  extra.push(`Alineación: ${alineacion}`);
    const descripcionFinal = extra.length ? `${descripcion}\n\n${extra.join('\n')}` : descripcion;

    const photoFileIds = [], photoNames = [], photoMimeTypes = [], photoThumbUrls = [];
    if (archivo && archivo.fileId) {
      photoFileIds.push(archivo.fileId);
      photoNames.push(archivo.name || '');
      photoMimeTypes.push(archivo.mimeType || '');
      photoThumbUrls.push(thumbUrl(archivo.fileId));
    }

    await appendIdeaMarketing({
      id: crypto.randomUUID(),
      descripcion: descripcionFinal,
      photoFileIds, photoNames, photoMimeTypes, photoThumbUrls,
      audioFileIds: [], audioNames: [], audioMimeTypes: [], audioDurations: [],
      categoria: '',
      createdAt: r[4] || new Date().toISOString()
    });
  }

  // De abajo hacia arriba: borrar una fila corre hacia arriba el índice
  // de las que quedan, mismo motivo que el resto de las migraciones de
  // esta app (Historial de tareas, cascade de Contactos).
  const info = await sheetsReq('');
  const tab  = info.sheets.find(s => s.properties.title === 'Ideas');
  if (!tab) return;
  const ideasSheetId = tab.properties.sheetId;
  const rowIndexes = rows.map((_, i) => i + 2).sort((a, b) => b - a);
  for (const rowIndex of rowIndexes) {
    await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{
        deleteDimension: { range: { sheetId: ideasSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } }
      }] })
    });
  }
}

export async function loadIdeasMarketing() {
  await safeLoad(async () => {
    const data = await sheetsReq('/values/IdeasMarketing!A:L');
    const rows = (data.values || []).slice(1);

    ideasMkt = rows
      .filter(r => r[0])
      .map((r, i) => ({
        id:             r[0]  || '',
        descripcion:    r[1]  || '',
        photoFileIds:   safeParseJSON(r[2], []),
        photoNames:     safeParseJSON(r[3], []),
        photoMimeTypes: safeParseJSON(r[4], []),
        photoThumbUrls: safeParseJSON(r[5], []),
        audioFileIds:   safeParseJSON(r[6], []),
        audioNames:     safeParseJSON(r[7], []),
        audioMimeTypes: safeParseJSON(r[8], []),
        audioDurations: safeParseJSON(r[9], []),
        createdAt:      r[10] || '',
        categoria:      r[11] || '',
        rowIndex:       i + 2
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    renderIdeasMarketingList();
  }, ideasMarketingList);
}

async function appendIdeaMarketing(idea) {
  await sheetsReq('/values/IdeasMarketing!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      idea.id, idea.descripcion,
      JSON.stringify(idea.photoFileIds), JSON.stringify(idea.photoNames),
      JSON.stringify(idea.photoMimeTypes), JSON.stringify(idea.photoThumbUrls),
      JSON.stringify(idea.audioFileIds), JSON.stringify(idea.audioNames),
      JSON.stringify(idea.audioMimeTypes), JSON.stringify(idea.audioDurations),
      idea.createdAt, idea.categoria || ''
    ]] })
  });
}

async function updateIdeaMarketingDescripcion(rowIndex, descripcion) {
  await sheetsReq(`/values/IdeasMarketing!B${rowIndex}:B${rowIndex}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[descripcion]] })
  });
}

async function deleteIdeaMarketingRow(rowIndex) {
  if (ideasMktSheetId === null) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'IdeasMarketing');
    if (tab) ideasMktSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{
      deleteDimension: {
        range: { sheetId: ideasMktSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
      }
    }] })
  });
}

async function deleteIdeaMarketing(idea) {
  for (const fid of [...(idea.photoFileIds || []), ...(idea.audioFileIds || [])]) {
    await deleteDriveFile(fid);
  }
  await deleteIdeaMarketingRow(idea.rowIndex);
}

// ── Fotos: staging ────────────────────────────────────────────────────────────

let ideaPhotos = [];

function addIdeaPhotos(files) {
  for (const f of files) ideaPhotos.push(f);
  renderIdeaPhotoPreview();
}
function removeIdeaPhotoAt(idx) {
  ideaPhotos.splice(idx, 1);
  renderIdeaPhotoPreview();
}
function clearIdeaPhotos() {
  ideaPhotos = [];
  ideaMktPhotoInput.value = '';
  renderIdeaPhotoPreview();
}
function renderIdeaPhotoPreview() {
  ideaMktPhotoPreview.innerHTML = '';
  ideaPhotos.forEach((file, idx) => {
    const item = document.createElement('div');
    item.className = 'preview-item';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    item.appendChild(img);

    const rm = document.createElement('button');
    rm.className = 'preview-remove';
    rm.textContent = '✕';
    rm.title = 'Quitar';
    rm.addEventListener('click', e => { e.stopPropagation(); removeIdeaPhotoAt(idx); });
    item.appendChild(rm);

    ideaMktPhotoPreview.appendChild(item);
  });
}

btnAddIdeaMktPhoto.addEventListener('click', () => ideaMktPhotoInput.click());
ideaMktPhotoInput.addEventListener('change', () => {
  if (ideaMktPhotoInput.files.length) addIdeaPhotos(Array.from(ideaMktPhotoInput.files));
  ideaMktPhotoInput.value = '';
});

// ── Audio: grabación desde cero (no existía código de cámara/audio previo) ────
// Safari/iOS solo soporta audio/mp4 (no audio/webm), por eso se prueba una
// lista de candidatos con isTypeSupported() en vez de hardcodear un mimeType.

const AUDIO_MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
function pickAudioMimeType() {
  return AUDIO_MIME_CANDIDATES.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

let mediaStream       = null;
let mediaRecorder     = null;
let audioChunks       = [];
let recordStartTime   = 0;
let recordTimerHandle = null;
let ideaAudioClips    = []; // staging: { blob, mimeType, durationSec, objectUrl }

async function startIdeaAudioRecording() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    const msg = e.name === 'NotAllowedError' ? 'Permiso de micrófono denegado.'
              : e.name === 'NotFoundError'   ? 'No se encontró un micrófono.'
              : `No se pudo acceder al micrófono: ${e.message}`;
    return setFb(ideaMktFeedback, msg, 'err');
  }
  setFb(ideaMktFeedback, '', '');
  mediaStream = stream;
  const mimeType = pickAudioMimeType();
  mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
  audioChunks = [];

  mediaRecorder.ondataavailable = e => { if (e.data.size) audioChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const durationSec = Math.max(1, Math.round((Date.now() - recordStartTime) / 1000));
    const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || mimeType || 'audio/webm' });
    ideaAudioClips.push({ blob, mimeType: blob.type, durationSec, objectUrl: URL.createObjectURL(blob) });
    mediaStream?.getTracks().forEach(t => t.stop());
    mediaStream = null;
    renderIdeaAudioClips();
  };

  mediaRecorder.start();
  recordStartTime = Date.now();
  btnRecordIdeaMktAudio.classList.add('recording');
  btnRecordIdeaMktAudio.textContent = '⏹️ Detener';
  ideaMktRecordTimer.textContent = '00:00';
  ideaMktRecordTimer.style.display = '';
  recordTimerHandle = setInterval(() => {
    ideaMktRecordTimer.textContent = fmtSeconds(Math.floor((Date.now() - recordStartTime) / 1000));
  }, 250);
}

function stopIdeaAudioRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  clearInterval(recordTimerHandle);
  btnRecordIdeaMktAudio.classList.remove('recording');
  btnRecordIdeaMktAudio.textContent = '🎙️ Grabar';
  ideaMktRecordTimer.style.display = 'none';
}

btnRecordIdeaMktAudio.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') stopIdeaAudioRecording();
  else startIdeaAudioRecording();
});

function discardIdeaAudioAt(idx) {
  const clip = ideaAudioClips[idx];
  if (clip?.objectUrl) URL.revokeObjectURL(clip.objectUrl);
  ideaAudioClips.splice(idx, 1);
  renderIdeaAudioClips();
}
function clearIdeaAudioClips() {
  ideaAudioClips.forEach(c => c.objectUrl && URL.revokeObjectURL(c.objectUrl));
  ideaAudioClips = [];
  renderIdeaAudioClips();
}
function renderIdeaAudioClips() {
  ideaMktAudioList.innerHTML = '';
  ideaAudioClips.forEach((clip, idx) => {
    const item = document.createElement('div');
    item.className = 'audio-clip-item';
    item.innerHTML = `
      <span class="audio-clip-duration">${ICON_MIC}${fmtSeconds(clip.durationSec)}</span>
      <audio controls src="${clip.objectUrl}"></audio>
    `;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'preview-remove';
    rm.textContent = '✕';
    rm.title = 'Quitar';
    rm.addEventListener('click', () => discardIdeaAudioAt(idx));
    item.appendChild(rm);
    ideaMktAudioList.appendChild(item);
  });
}

function extFromAudioMime(m) {
  if (m.startsWith('audio/mp4')) return 'm4a';
  if (m.startsWith('audio/ogg')) return 'ogg';
  return 'webm';
}

// ── Modal: nueva idea ─────────────────────────────────────────────────────────

function openIdeaMktModal() {
  ideaMktDescripcion.value = '';
  ideaMktCategoria.value = '';
  clearIdeaPhotos();
  clearIdeaAudioClips();
  setFb(ideaMktFeedback, '', '');
  ideaMktOverlay.classList.add('open');
  setTimeout(() => ideaMktDescripcion.focus(), 100);
}
btnNewIdeaMarketing.addEventListener('click', openIdeaMktModal);

function isIdeaMktFormDirty() {
  return ideaMktDescripcion.value.trim() !== '' || !!ideaMktCategoria.value
    || ideaPhotos.length > 0 || ideaAudioClips.length > 0;
}

// Si el modal se cierra mientras graba, hay que parar la grabación primero
// (libera el micrófono) — si no, el stream sigue activo con el modal cerrado.
function closeIdeaMktModal() {
  if (mediaRecorder && mediaRecorder.state === 'recording') stopIdeaAudioRecording();
  confirmCloseIfDirty('ideaMktOverlay', isIdeaMktFormDirty);
}
btnCloseIdeaMkt.addEventListener('click', closeIdeaMktModal);
ideaMktOverlay.addEventListener('click', e => { if (e.target === ideaMktOverlay) closeIdeaMktModal(); });

btnSaveIdeaMkt.addEventListener('click', async () => {
  const descripcion = ideaMktDescripcion.value.trim();
  const categoria = ideaMktCategoria.value;
  if (!descripcion) return setFb(ideaMktFeedback, 'La descripción es obligatoria.', 'err');
  if (!categoria) return setFb(ideaMktFeedback, 'Elegí una categoría.', 'err');
  if (mediaRecorder && mediaRecorder.state === 'recording') stopIdeaAudioRecording();

  btnSaveIdeaMkt.disabled = true;
  btnSaveIdeaMkt.textContent = 'Guardando…';

  try {
    const photoFileIds = [], photoNames = [], photoMimeTypes = [], photoThumbUrls = [];
    const audioFileIds = [], audioNames = [], audioMimeTypes = [], audioDurations = [];
    const totalFiles = ideaPhotos.length + ideaAudioClips.length;

    if (totalFiles) {
      ideaMktUploadProgress.style.display = '';
      ideaMktProgressFill.style.width = '0%';
      let done = 0;

      for (let i = 0; i < ideaPhotos.length; i++) {
        const file = ideaPhotos[i];
        ideaMktProgressText.textContent = `Subiendo foto ${i + 1} de ${ideaPhotos.length}…`;
        const fd = await uploadToDrive(file, pct => {
          ideaMktProgressFill.style.width = `${Math.round(((done + pct / 100) / totalFiles) * 100)}%`;
        });
        photoFileIds.push(fd.id); photoNames.push(file.name);
        photoMimeTypes.push(file.type); photoThumbUrls.push(thumbUrl(fd.id));
        done++;
      }

      for (let i = 0; i < ideaAudioClips.length; i++) {
        const clip = ideaAudioClips[i];
        const file = new File(
          [clip.blob], `idea-audio-${Date.now()}-${i}.${extFromAudioMime(clip.mimeType)}`,
          { type: clip.mimeType }
        );
        ideaMktProgressText.textContent = `Subiendo audio ${i + 1} de ${ideaAudioClips.length}…`;
        const fd = await uploadToDrive(file, pct => {
          ideaMktProgressFill.style.width = `${Math.round(((done + pct / 100) / totalFiles) * 100)}%`;
        });
        audioFileIds.push(fd.id); audioNames.push(file.name);
        audioMimeTypes.push(file.type); audioDurations.push(clip.durationSec);
        done++;
      }

      ideaMktProgressFill.style.width = '100%';
      ideaMktProgressText.textContent = '✅ Archivos guardados en Drive';
      await delay(1000);
      ideaMktUploadProgress.style.display = 'none';
    }

    await appendIdeaMarketing({
      id: crypto.randomUUID(),
      descripcion, categoria,
      photoFileIds, photoNames, photoMimeTypes, photoThumbUrls,
      audioFileIds, audioNames, audioMimeTypes, audioDurations,
      createdAt: new Date().toISOString()
    });

    // Cierre directo (no confirmCloseIfDirty) — ya se guardó, mismo criterio
    // que el modal de WhatsApp de contenido.js al guardar con éxito.
    ideaMktOverlay.classList.remove('open');
    await loadIdeasMarketing();
  } catch (e) {
    console.error(e);
    setFb(ideaMktFeedback, `Error: ${e.message}`, 'err');
  } finally {
    btnSaveIdeaMkt.disabled = false;
    btnSaveIdeaMkt.textContent = 'Guardar idea';
    ideaMktUploadProgress.style.display = 'none';
  }
});

// ── Modal: editar idea (solo descripción, igual que editar historia) ─────────

function openEditIdeaMktModal(idea) {
  editingIdeaMktRow = idea.rowIndex;
  editIdeaMktDescripcion.value = idea.descripcion;
  setFb(editIdeaMktFeedback, '', '');
  editIdeaMktOverlay.classList.add('open');
}
function closeEditIdeaMktModal() {
  editIdeaMktOverlay.classList.remove('open');
}
btnCloseEditIdeaMkt.addEventListener('click', closeEditIdeaMktModal);
editIdeaMktOverlay.addEventListener('click', e => { if (e.target === editIdeaMktOverlay) closeEditIdeaMktModal(); });

btnSaveEditIdeaMkt.addEventListener('click', async () => {
  const descripcion = editIdeaMktDescripcion.value.trim();
  if (!descripcion) return setFb(editIdeaMktFeedback, 'La descripción es obligatoria.', 'err');

  btnSaveEditIdeaMkt.disabled = true;
  try {
    await updateIdeaMarketingDescripcion(editingIdeaMktRow, descripcion);
    closeEditIdeaMktModal();
    await loadIdeasMarketing();
  } catch (e) {
    setFb(editIdeaMktFeedback, `Error: ${e.message}`, 'err');
  } finally {
    btnSaveEditIdeaMkt.disabled = false;
  }
});

// ── Lista de ideas guardadas ──────────────────────────────────────────────────

function ideaMktCardHTML(idea) {
  const photosHTML = idea.photoThumbUrls.slice(0, 4)
    .map(u => `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.style.display='none'">`)
    .join('');
  const extraPhotos = idea.photoFileIds.length > 4
    ? `<span class="thumb-count">+${idea.photoFileIds.length - 4}</span>` : '';

  const audioHTML = idea.audioFileIds.map((fid, i) => `
    <button type="button" class="audio-chip" data-play-audio="${esc(fid)}">${ICON_MIC}${fmtSeconds(idea.audioDurations[i] || 0)}</button>
  `).join('');

  return `
    <div class="story-card idea-mkt-card" data-idea-row="${idea.rowIndex}">
      <div class="story-body" style="padding:14px">
        ${idea.categoria ? `<span class="idea-mkt-categoria">${esc(idea.categoria)}</span>` : ''}
        <div class="story-actions" style="max-height:none;-webkit-line-clamp:6">${esc(idea.descripcion)}</div>
        ${photosHTML ? `<div class="idea-mkt-photos">${photosHTML}${extraPhotos}</div>` : ''}
        ${audioHTML  ? `<div class="idea-mkt-audios">${audioHTML}</div>` : ''}
        <div class="story-date">${ICON_CALENDAR}${fmtDate(idea.createdAt)}</div>
      </div>
      <div class="idea-mkt-footer">
        <span class="kanban-card-hint">mantén presionado</span>
        <div class="kanban-card-actions">
          <button type="button" data-edit-idea="${idea.rowIndex}">Editar</button>
          <button type="button" data-del="${idea.rowIndex}">Borrar</button>
        </div>
      </div>
    </div>`;
}

function renderIdeasMarketingList() {
  if (!ideasMkt.length) {
    ideasMarketingList.innerHTML = '<div class="empty-state">Aún no hay ideas guardadas</div>';
    return;
  }
  ideasMarketingList.innerHTML = ideasMkt.map(ideaMktCardHTML).join('');
  wireIdeaMktCards();
}

// Editar/Borrar solo aparecen manteniendo la tarjeta presionada — mismo
// patrón (550ms, cancela con movimiento) que las tarjetas del Kanban en
// tareas.js, reutilizando la misma clase .kanban-card-actions.
function wireIdeaMktCards() {
  ideasMarketingList.querySelectorAll('.idea-mkt-card').forEach(card => {
    let pressTimer  = null;
    let longPressed = false;
    const openCardActions = () => {
      ideasMarketingList.querySelectorAll('.kanban-card-actions.open').forEach(a => a.classList.remove('open'));
      card.querySelector('.kanban-card-actions')?.classList.add('open');
    };
    const startPress = e => {
      if (e.target.closest('button')) return;
      longPressed = false;
      pressTimer = setTimeout(() => { longPressed = true; openCardActions(); }, 550);
    };
    const cancelPress = () => clearTimeout(pressTimer);
    card.addEventListener('mousedown', startPress);
    card.addEventListener('mouseup', cancelPress);
    card.addEventListener('mouseleave', cancelPress);
    card.addEventListener('touchstart', startPress, { passive: true });
    card.addEventListener('touchmove', cancelPress, { passive: true });
    card.addEventListener('touchend', () => { cancelPress(); longPressed = false; });
    card.addEventListener('click', () => { if (longPressed) longPressed = false; });
  });

  ideasMarketingList.querySelectorAll('[data-edit-idea]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idea = ideasMkt.find(i => i.rowIndex === +btn.dataset.editIdea);
      if (idea) openEditIdeaMktModal(idea);
    });
  });

  ideasMarketingList.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const idea = ideasMkt.find(i => i.rowIndex === +btn.dataset.del);
      if (!idea) return;
      if (!confirm('¿Eliminar esta idea y sus archivos de Drive?')) return;
      btn.disabled = true;
      try { await deleteIdeaMarketing(idea); await loadIdeasMarketing(); }
      catch (err) { alert('Error: ' + err.message); btn.disabled = false; }
    });
  });

  ideasMarketingList.querySelectorAll('[data-play-audio]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const fid = btn.dataset.playAudio;
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = ICON_SPINNER;
      try {
        const url = await streamDriveFile(fid);
        if (currentAudioObjectUrl) URL.revokeObjectURL(currentAudioObjectUrl);
        currentAudioObjectUrl = url;
        ideaMktPlayer.src = url;
        await ideaMktPlayer.play();
      } catch (err) {
        alert('Error al reproducir: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    });
  });
}

// Clic afuera cierra el panel Editar/Borrar abierto — mismo criterio que
// tareas.js/procesos.js/ferias.js con sus propios paneles de tarjeta.
document.addEventListener('click', () => {
  document.querySelectorAll('#ideasMarketingList .kanban-card-actions.open').forEach(a => a.classList.remove('open'));
});
