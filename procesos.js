import { sheetsReq } from './auth.js';
import {
  esc, setFb, setFieldError, clearFieldErrors, confirmCloseIfDirty, safeParseJSON,
  fmtDate, fmtDateShortEs, fmtDuration, fmtCOP, parseISODate, toISODate, addDays, diffDays,
  normalizeObsList, ICON_COPY, ICON_EDIT, ICON_TRASH, ICON_DOWNLOAD, ICON_CHECK
} from './utils.js';
import { wasAccidentalTouch } from './input-guard.js';
import { loadConfig } from './contenido.js';
import { computeCostoProduccion } from './compras.js';
import { ingredientes, normalizeIngName, getIngredienteUnidad } from './ingredientes.js';

// ── State ─────────────────────────────────────────────────────────────────────
export let recetas       = [];
export let ejecuciones   = [];
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
let ejecucionDetailId    = null;
let draggedInstrRow      = null; // for instruction row drag-reorder
let draggedInstrList     = null;
let recetaDetailId       = null; // for recipe detail view
let evalClockInterval    = null; // clock in evaluation modal
let fase2EvalEjId        = null; // ejecucion being evaluated (fase2)
let sineresisEvalEjId    = null; // ejecucion being evaluated (sineresis)
let fase2Scores          = { D3: 0, D6: 0 };
let lastTapTime          = {}; // para detección de doble-toque en móvil

const RECETA_BLOCK_HUES = [355, 25, 45, 95, 165, 200, 230, 280];

// Suma de frascos producidos para una receta — la usan tanto Ferias como
// Stock para calcular disponibilidad, por eso vive aquí (dueño de `ejecuciones`)
// y no en el módulo donde se llama.
export function getStockProducido(recetaId) {
  return ejecuciones
    .filter(ej => ej.recetaId === recetaId)
    .reduce((sum, ej) => {
      const ev = ej.evaluacion || {};
      return sum + (ev.frascos230 || 0) + (ev.frascos180 || 0);
    }, 0);
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

export function checkPendingEvalNotifications() {
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

// ── Procesos: Sheets init ─────────────────────────────────────────────────────

export async function initRecetasSheets() {
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

export async function loadRecetasData() {
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

export async function loadEjecucionesData() {
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

export async function loadProcesos() {
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

    container.innerHTML = sections.map((sec, idx) => {
      const toggleKey  = sec.id || '__sinbloque__';
      const collapsed  = collapsedRecetaBlocks.has(toggleKey);
      const draggable  = !!sec.id;
      // Colores muy pasteles (10% de relleno) para separar visualmente cada
      // bloque; "Sin bloque" queda neutro por no ser un grupo real.
      const hue = sec.id ? RECETA_BLOCK_HUES[idx % RECETA_BLOCK_HUES.length] : null;
      const bgStyle = hue != null ? ` style="background:hsl(${hue} 70% 55% / .1)"` : '';
      return `
      <div class="receta-block-section"${bgStyle}>
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
      btn.disabled = true;
      try {
        await deleteRecetaBlock(block.id);
        renderRecetaBlocksList();
        renderRecetasList();
        setFb(fb, `✅ Bloque eliminado.`, 'ok');
      } catch (e) { setFb(fb, 'Error: ' + e.message, 'err'); btn.disabled = false; }
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
    lines.push(`ETAPA ${i + 1}: ${et.nombre}`);

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

  // Stage breakdown
  if (etapas.length > 0) {
    html += '<div class="analysis-subtitle">Tiempo por etapa</div>';
    etapas.forEach((et, i) => {
      const realMin = Math.round(et.duracionReal / 60);
      html += `<div class="analysis-stage-row">
        <span class="analysis-stage-name">Etapa ${i+1}: ${esc(et.nombre)}</span>
        <span>${realMin} min</span>
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
      <span class="etapa-num">${esc(etapa.nombre || 'Nueva etapa')}</span>
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
    </div>
  `;

  // Populate instruction rows
  const instrList = item.querySelector('.instrucciones-list');
  instrArr.forEach(instr => instrList.appendChild(buildInstruccionRow(instr.text, instr.tipo, instr.alarmMin)));

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

  // Mantiene el encabezado sincronizado con el nombre mientras se escribe.
  const nombreInput = item.querySelector('.etapa-nombre');
  const numLabel    = item.querySelector('.etapa-num');
  nombreInput.addEventListener('input', () => {
    numLabel.textContent = nombreInput.value.trim() || 'Nueva etapa';
  });

  const delBtn = item.querySelector('.etapa-del');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      if (!confirm('¿Eliminar esta etapa? Se perderán sus instrucciones.')) return;
      item.remove();
    });
  }
  item.querySelector('.btn-add-instruccion').addEventListener('click', () => {
    instrList.appendChild(buildInstruccionRow('', 'paso'));
    instrList.lastElementChild.querySelector('.instruccion-text').focus();
  });

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
  row.querySelector('.subtask-remove').addEventListener('click', () => {
    if (!confirm('¿Quitar este paso de la etapa?')) return;
    row.remove();
  });

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

function collectEtapas() {
  return Array.from(document.querySelectorAll('#etapasList .etapa-item')).map(item => {
    const instrucciones = Array.from(item.querySelectorAll('.instruccion-row'))
      .map(row => ({
        text: row.querySelector('.instruccion-text').value.trim(),
        tipo: row.querySelector('.instruccion-tipo-btn')?.dataset.tipo || 'paso',
        alarmMin: parseInt(row.querySelector('.instruccion-alarm')?.value) || 0
      }))
      .filter(i => i.text);
    return {
      id:            crypto.randomUUID(),
      nombre:        item.querySelector('.etapa-nombre').value.trim(),
      instrucciones,
      insumos:       [],
      fija:          false
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

  document.getElementById('ejecutarOverlay').classList.add('open');
  renderExecutionStep();
}

function goBackStage() {
  if (!executionState || executionState.currentStageIndex === 0) return;
  if (executionState.timerInterval) clearInterval(executionState.timerInterval);
  // No se descarta lo ya registrado de la etapa: al volver a avanzar,
  // advanceStage() actualiza el mismo registro en vez de duplicarlo.
  executionState.currentStageIndex--;
  renderExecutionStep();
}

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
  // Si ya se había avanzado por esta etapa antes (venimos de "Regresar"),
  // el cronómetro sigue contando desde el tiempo ya acumulado, no desde cero.
  const prevDuracion = executionState.stagesData[currentStageIndex]?.duracionReal || 0;
  executionState.stageStartTime = Date.now() - prevDuracion * 1000;

  document.getElementById('ejecutarTitle').textContent =
    `ETAPA: ${etapa.nombre} - RECETA: ${receta.nombre}`;

  const body = document.getElementById('ejecutarBody');
  body.innerHTML = `
    <div class="exec-progress">
      <div class="exec-progress-bar" style="width:${((currentStageIndex + 1) / total * 100).toFixed(0)}%"></div>
    </div>
    <div class="exec-step-nav">
      <div class="exec-step-label">Etapa ${currentStageIndex + 1} de ${total}</div>
      <div class="exec-timer" id="execTimer">00:00</div>
    </div>
    <h3 class="exec-stage-name">${esc(etapa.nombre)}</h3>
    ${buildInstruccionesHTML(etapa.instrucciones, true)}

    <div class="exec-obs-section">
      <h4 class="exec-insumos-title">Observaciones de esta etapa</h4>
      <div id="execStageObsList" class="obs-list"></div>
      <div class="obs-input-wrap">
        <textarea class="field-textarea obs-textarea exec-obs-textarea" id="execStageObsInput" rows="3" placeholder="Escribe una observación…" autocapitalize="sentences" autocorrect="on" enterkeyhint="done"></textarea>
        <button type="button" class="btn-outline obs-btn exec-obs-btn" id="btnAddExecStageObs">Agregar</button>
      </div>
    </div>

    <div class="exec-nav-footer">
      ${currentStageIndex > 0 ? `<button type="button" class="btn-back-stage" id="btnBackStage">← Regresar</button>` : '<span></span>'}
      <button class="btn-primary exec-next-btn" id="btnNextStage">
        ${isLast
          ? ICON_CHECK + 'Finalizar receta'
          : 'Etapa siguiente <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-left:4px"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'}
      </button>
    </div>
  `;
  body.scrollTop = 0;
  window.scrollTo(0, 0);

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

  // Ya no se pide confirmar cantidad real por etapa: se registra lo
  // planeado como usado (ver también finishExecution para el caso de
  // ingredientes maestros, que se totalizan una sola vez al terminar).
  const insumosConfirmados = (etapa.insumos || []).map(ins => ({
    nombre:              ins.nombre,
    cantidadPlanificada: ins.cantidad,
    cantidadReal:        ins.cantidad,
    unidad:              ins.unidad
  }));

  // Se asigna por índice (no push) para no duplicar el registro si esta
  // etapa ya se había completado antes y el usuario volvió con "Regresar".
  executionState.stagesData[currentStageIndex] = {
    nombre:              etapa.nombre,
    duracionReal:        duracion,
    insumosConfirmados,
    observaciones:       (executionState.stageObsDraft || {})[currentStageIndex] || []
  };

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

  // Recetas con ingredientes maestros (total por receta, no por etapa):
  // se registran una sola vez, en la última etapa, para no duplicar el total.
  const maestros = receta.ingredientesMaestros || [];
  if (maestros.length && stagesData.length) {
    stagesData[stagesData.length - 1].insumosConfirmados = maestros.map(ing => ({
      nombre:              ing.nombre,
      cantidadPlanificada: ing.cantidadTotal,
      cantidadReal:        ing.cantidadTotal,
      unidad:              ing.unidad
    }));
  }

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

  document.getElementById('evaluacionOverlay').classList.add('open');
  startEvalClock();
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

