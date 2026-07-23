import { sheetsReq } from './auth.js';
import { esc, setFb, setFieldError, clearFieldErrors, safeParseJSON, fmtDate, fmtDateShortEs, fmtCOP, parseISODate, toISODate, addDays, ICON_EDIT, ICON_TRASH } from './utils.js';
import { wasAccidentalTouch } from './input-guard.js';
import { openCalendarPopover } from './tareas.js';
import { ejecuciones, getStockProducido } from './procesos.js';
import { stockTestigos } from './stock.js';

export let ferias        = [];
let feriasSheetId        = null;
let feriaEditId          = null;
let feriaAlineacion      = 0;
let feriaCounterId       = null;
let feriaCounterSaveTimer = null;
let feriaStockPendingId  = null;
let currentFeriasTab     = 'disponibles';
let lastTapTime          = {}; // para detección de doble-toque en móvil

// ── Ferias: Sheets init + CRUD ──────────────────────────────────────────────────

// Nota: las columnas A–L mantienen el orden original de este módulo
// (antes de agregar horario/stock/ventas) para no desalinear filas ya
// guardadas. Los campos nuevos siempre se agregan al final (M–R).
export async function initFeriasSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasF = tabs.find(s => s.properties.title === 'Ferias');

  if (hasF) {
    feriasSheetId = hasF.properties.sheetId;
    const headerData = await sheetsReq('/values/Ferias!A1:R1').catch(() => ({}));
    const headerRow  = (headerData.values || [])[0] || [];
    if (headerRow.length < 18) {
      await sheetsReq('/values/Ferias!M1:R1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [[
          'HoraInicio','HoraFin','PlanStock','Ventas','ObservacionesDiarias','ConteoProductos'
        ]] })
      });
    }
  } else {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Ferias' } } }] })
    });
    const added = res.replies?.[0]?.addSheet?.properties;
    if (added) feriasSheetId = added.sheetId;
    await sheetsReq('/values/Ferias!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [[
        'ID','Empresa','FechaInicio','FechaFin','Precio','FechaImportante','Lugar',
        'Observaciones','Alineacion','Estado','ConteoPersonas','CreadoEn',
        'HoraInicio','HoraFin','PlanStock','Ventas','ObservacionesDiarias','ConteoProductos'
      ]] })
    });
  }
  await loadFerias();
}

export async function loadFerias() {
  const data = await sheetsReq('/values/Ferias!A:R');
  const rows = (data.values || []).slice(1);
  ferias = rows.filter(r => r[0]).map((r, i) => ({
    id:                   r[0]  || '',
    empresa:              r[1]  || '',
    fechaInicio:          r[2]  || '',
    fechaFin:             r[3]  || '',
    precio:               parseFloat(r[4]) || 0,
    fechaImportante:      r[5]  || '',
    lugar:                r[6]  || '',
    observaciones:        r[7]  || '',
    alineacion:           parseInt(r[8]) || 0,
    estado:               r[9]  || 'disponible',
    conteoPersonas:       parseInt(r[10]) || 0,
    creadoEn:             r[11] || '',
    horaInicio:           r[12] || '',
    horaFin:              r[13] || '',
    planStock:            safeParseJSON(r[14], {}),
    ventas:               safeParseJSON(r[15], []),
    observacionesDiarias: safeParseJSON(r[16], []),
    conteoProductos:      safeParseJSON(r[17], {}),
    rowIndex:             i + 2
  }));
}

function feriaRowValues(f) {
  return [
    f.id, f.empresa, f.fechaInicio, f.fechaFin, f.precio, f.fechaImportante, f.lugar,
    f.observaciones || '', f.alineacion || 0, f.estado || 'disponible', f.conteoPersonas || 0,
    f.creadoEn || new Date().toISOString(),
    f.horaInicio || '', f.horaFin || '', JSON.stringify(f.planStock || {}), JSON.stringify(f.ventas || []),
    JSON.stringify(f.observacionesDiarias || []), JSON.stringify(f.conteoProductos || {})
  ];
}

async function appendFeria(f) {
  await sheetsReq('/values/Ferias!A:R:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [feriaRowValues(f)] })
  });
}

async function updateFeria(f) {
  await sheetsReq(`/values/Ferias!A${f.rowIndex}:R${f.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [feriaRowValues(f)] })
  });
}

async function deleteFeriaRow(rowIndex) {
  if (!feriasSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'Ferias');
    if (tab) feriasSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: feriasSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
}

// ── Ferias: Control de stock ─────────────────────────────────────────────────
// (getStockProducido vive en procesos.js, dueño de `ejecuciones`)

export function getStockComprometidoLote(ejecucionId, excludeFeriaId) {
  return ferias
    .filter(f => f.estado === 'confirmada' && f.id !== excludeFeriaId)
    .reduce((sum, f) => {
      let total = 0;
      Object.values(f.planStock || {}).forEach(porLote => { total += (porLote[ejecucionId] || 0); });
      return sum + total;
    }, 0);
}

export function getStockVendidoLote(ejecucionId) {
  return ferias.reduce((sum, f) =>
    sum + (f.ventas || []).filter(v => v.ejecucionId === ejecucionId).reduce((s, v) => s + v.cantidad, 0)
  , 0);
}

function getStockDisponibleLote(ejecucionId, excludeFeriaId) {
  const ej = ejecuciones.find(e => e.id === ejecucionId);
  if (!ej) return 0;
  const ev = ej.evaluacion || {};
  const producido = (ev.frascos230 || 0) + (ev.frascos180 || 0);
  const testigo = stockTestigos
    .filter(t => t.ejecucionId === ejecucionId)
    .reduce((sum, t) => sum + (t.cantidad || 0), 0);
  return producido - testigo - getStockComprometidoLote(ejecucionId, excludeFeriaId);
}

export function getStockComprometido(recetaId, excludeFeriaId) {
  return ejecuciones
    .filter(ej => ej.recetaId === recetaId)
    .reduce((sum, ej) => sum + getStockComprometidoLote(ej.id, excludeFeriaId), 0);
}

function getFeriaDateList(f) {
  if (!f.fechaInicio || !f.fechaFin) return [];
  const dates = [];
  let d = parseISODate(f.fechaInicio);
  const end = parseISODate(f.fechaFin);
  while (d <= end) { dates.push(toISODate(d)); d = addDays(d, 1); }
  return dates;
}

// ── Ferias: UI ─────────────────────────────────────────────────────────────────

document.querySelectorAll('[data-feriastab]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentFeriasTab = btn.dataset.feriastab;
    document.querySelectorAll('[data-feriastab]').forEach(b =>
      b.classList.toggle('active', b.dataset.feriastab === currentFeriasTab)
    );
    document.getElementById('subTabFeriasDisponibles').style.display = currentFeriasTab === 'disponibles' ? '' : 'none';
    document.getElementById('subTabFeriasConfirmadas').style.display = currentFeriasTab === 'confirmadas' ? '' : 'none';
  });
});

function feriaCardHTML(f) {
  const fechas    = (f.fechaInicio && f.fechaFin) ? `${fmtDateShortEs(f.fechaInicio)} → ${fmtDateShortEs(f.fechaFin)}` : '—';
  const alineacion = Math.max(0, Math.min(5, f.alineacion || 0));
  const stars      = '★'.repeat(alineacion) + '☆'.repeat(5 - alineacion);
  return `
    <div class="feria-card" data-id="${esc(f.id)}">
      <div class="feria-card-body">
        <div class="feria-card-title">${esc(f.empresa)}</div>
        <div class="feria-card-meta">📅 ${fechas} &nbsp;·&nbsp; ⏰ ${esc(f.horaInicio || '—')}–${esc(f.horaFin || '—')} &nbsp;·&nbsp; 📍 ${esc(f.lugar || '—')} &nbsp;·&nbsp; ${fmtCOP(f.precio)}</div>
        ${f.fechaImportante ? `<div class="feria-card-desc">🎯 ${esc(f.fechaImportante)}</div>` : ''}
        ${f.observaciones ? `<div class="feria-card-desc">${esc(f.observaciones)}</div>` : ''}
        <div class="feria-card-stars" title="Alineación con TateQuieto">${stars}</div>
      </div>
      <div class="receta-card-actions">
        <button class="feria-confirm-btn" data-confirmar="${esc(f.id)}">✓ Confirmar participación</button>
        <button class="task-action-btn" data-edit-feria="${esc(f.id)}" title="Editar">${ICON_EDIT}</button>
        <button class="task-action-btn" data-del-feria="${esc(f.id)}" data-row="${f.rowIndex}" title="Eliminar">${ICON_TRASH}</button>
      </div>
    </div>`;
}

function feriaBlockHTML(f) {
  const fechas = (f.fechaInicio && f.fechaFin) ? `${fmtDateShortEs(f.fechaInicio)} → ${fmtDateShortEs(f.fechaFin)}` : '—';
  return `
    <div class="feria-block" data-id="${esc(f.id)}" title="Doble clic para registrar conteo">
      <div class="feria-block-title">${esc(f.empresa)}</div>
      <div class="feria-block-meta">📅 ${fechas}</div>
      <div class="feria-block-meta">📍 ${esc(f.lugar || '—')}</div>
      <div class="feria-block-counter">👥 ${f.conteoPersonas || 0}</div>
      <div class="feria-block-actions">
        <button class="task-action-btn" data-plan-stock-feria="${esc(f.id)}" title="Plan de stock por día">📦</button>
        <button class="task-action-btn" data-edit-feria="${esc(f.id)}" title="Editar">${ICON_EDIT}</button>
        <button class="task-action-btn" data-volver-feria="${esc(f.id)}" title="Volver a disponibles">↩</button>
        <button class="task-action-btn" data-del-feria="${esc(f.id)}" data-row="${f.rowIndex}" title="Eliminar">${ICON_TRASH}</button>
      </div>
    </div>`;
}

function wireFeriaCardActions(container) {
  container.querySelectorAll('[data-edit-feria]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openFeriaModal(btn.dataset.editFeria); });
  });
  container.querySelectorAll('[data-del-feria]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('¿Eliminar esta feria?')) return;
      btn.disabled = true;
      try {
        await deleteFeriaRow(+btn.dataset.row);
        await loadFerias();
        renderFeriasDisponibles();
        renderFeriasConfirmadas();
      } catch (err) { alert('Error: ' + err.message); btn.disabled = false; }
    });
  });
}

export function renderFeriasDisponibles() {
  const container = document.getElementById('feriasDisponiblesList');
  if (!container) return;
  const list = ferias.filter(f => f.estado !== 'confirmada');
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">No hay ferias disponibles. Agrega la primera con "+ Nueva feria".</div>';
    return;
  }
  container.innerHTML = list.map(feriaCardHTML).join('');
  wireFeriaCardActions(container);
  container.querySelectorAll('[data-confirmar]').forEach(btn => {
    btn.addEventListener('click', () => openFeriaStockModal(btn.dataset.confirmar));
  });
}

export function renderFeriasConfirmadas() {
  const container = document.getElementById('feriasConfirmadasList');
  if (!container) return;
  const list = ferias.filter(f => f.estado === 'confirmada');
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">Aún no hay ferias confirmadas.</div>';
    return;
  }
  container.innerHTML = `<div class="feria-blocks-grid">${list.map(feriaBlockHTML).join('')}</div>`;
  wireFeriaCardActions(container);
  container.querySelectorAll('[data-plan-stock-feria]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openFeriaStockModal(btn.dataset.planStockFeria); });
  });
  container.querySelectorAll('.feria-block').forEach(block => {
    block.addEventListener('dblclick', e => {
      if (e.target.closest('button')) return;
      openFeriaCounter(block.dataset.id);
    });
    block.addEventListener('touchend', e => {
      if (e.target.closest('button') || wasAccidentalTouch()) return;
      const now  = Date.now();
      const last = lastTapTime['feria_' + block.dataset.id] || 0;
      lastTapTime['feria_' + block.dataset.id] = now;
      if (now - last < 350) openFeriaCounter(block.dataset.id);
    });
  });
  container.querySelectorAll('[data-volver-feria]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const f = ferias.find(x => x.id === btn.dataset.volverFeria);
      if (!f) return;
      btn.disabled = true;
      try {
        f.estado = 'disponible';
        await updateFeria(f);
        renderFeriasDisponibles();
        renderFeriasConfirmadas();
      } catch (e2) { alert('Error: ' + e2.message); btn.disabled = false; }
    });
  });
}

function setFeriaStars(val) {
  feriaAlineacion = Math.max(0, Math.min(5, val || 0));
  document.querySelectorAll('#feriaStarsWrap .star-btn').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.val <= val);
  });
}
document.querySelectorAll('#feriaStarsWrap .star-btn').forEach(btn => {
  btn.addEventListener('click', () => setFeriaStars(+btn.dataset.val));
});

function updateFeriaFechasTrigger() {
  const trigger = document.getElementById('feriaFechasTrigger');
  const ini = document.getElementById('feriaFechaInicio').value;
  const fin = document.getElementById('feriaFechaFin').value;
  trigger.textContent = (ini && fin) ? `${fmtDateShortEs(ini)} → ${fmtDateShortEs(fin)}` : 'Elegir fechas…';
}
document.getElementById('feriaFechasTrigger').addEventListener('click', () => {
  const iniInput = document.getElementById('feriaFechaInicio');
  const finInput = document.getElementById('feriaFechaFin');
  const today = toISODate(new Date());
  openCalendarPopover(document.getElementById('feriaFechasTrigger'), {
    mode:  'range',
    start: iniInput.value || today,
    end:   finInput.value || today,
    onApply: (start, end) => {
      iniInput.value = start;
      finInput.value = end;
      updateFeriaFechasTrigger();
    }
  });
});

function openFeriaModal(editId) {
  feriaEditId = editId || null;
  document.getElementById('feriaFeedback').textContent = '';
  clearFieldErrors('feriaEmpresa');
  setFieldError('feriaFechas', '', 'feriaFechasTrigger');
  setFieldError('feriaHora', '');
  const today = toISODate(new Date());
  if (editId) {
    const f = ferias.find(x => x.id === editId);
    if (!f) return;
    document.getElementById('feriaModalTitle').textContent    = 'Editar feria';
    document.getElementById('feriaEmpresa').value             = f.empresa;
    document.getElementById('feriaFechaInicio').value         = f.fechaInicio || today;
    document.getElementById('feriaFechaFin').value            = f.fechaFin || today;
    document.getElementById('feriaHoraInicio').value           = f.horaInicio || '09:00';
    document.getElementById('feriaHoraFin').value              = f.horaFin || '18:00';
    document.getElementById('feriaPrecio').value               = f.precio || '';
    document.getElementById('feriaLugar').value                = f.lugar || '';
    document.getElementById('feriaFechaImportante').value      = f.fechaImportante || '';
    document.getElementById('feriaObservaciones').value        = f.observaciones || '';
    setFeriaStars(f.alineacion || 0);
  } else {
    document.getElementById('feriaModalTitle').textContent    = 'Nueva feria';
    document.getElementById('feriaEmpresa').value             = '';
    document.getElementById('feriaFechaInicio').value         = today;
    document.getElementById('feriaFechaFin').value            = today;
    document.getElementById('feriaHoraInicio').value           = '09:00';
    document.getElementById('feriaHoraFin').value              = '18:00';
    document.getElementById('feriaPrecio').value               = '';
    document.getElementById('feriaLugar').value                = '';
    document.getElementById('feriaFechaImportante').value      = '';
    document.getElementById('feriaObservaciones').value        = '';
    setFeriaStars(0);
  }
  updateFeriaFechasTrigger();
  document.getElementById('feriaOverlay').classList.add('open');
  setTimeout(() => document.getElementById('feriaEmpresa').focus(), 100);
}

function closeFeriaModal() {
  document.getElementById('feriaOverlay').classList.remove('open');
}
document.getElementById('btnCloseFeria').addEventListener('click', closeFeriaModal);
document.getElementById('feriaOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('feriaOverlay')) closeFeriaModal();
});
document.getElementById('btnNewFeria').addEventListener('click', () => openFeriaModal(null));

document.getElementById('btnSaveFeria').addEventListener('click', async () => {
  const empresa         = document.getElementById('feriaEmpresa').value.trim();
  const fechaInicio     = document.getElementById('feriaFechaInicio').value;
  const fechaFin        = document.getElementById('feriaFechaFin').value;
  const horaInicio      = document.getElementById('feriaHoraInicio').value;
  const horaFin         = document.getElementById('feriaHoraFin').value;
  const precio          = parseFloat(document.getElementById('feriaPrecio').value) || 0;
  const lugar           = document.getElementById('feriaLugar').value.trim();
  const fechaImportante = document.getElementById('feriaFechaImportante').value.trim();
  const observaciones   = document.getElementById('feriaObservaciones').value.trim();
  const fb              = document.getElementById('feriaFeedback');

  clearFieldErrors('feriaEmpresa', 'feriaFechas', 'feriaHora');
  if (!empresa) { setFieldError('feriaEmpresa', 'La empresa organizadora es obligatoria.'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (!fechaInicio || !fechaFin) { setFieldError('feriaFechas', 'Las fechas de la feria son obligatorias.', 'feriaFechasTrigger'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (fechaInicio > fechaFin) { setFieldError('feriaFechas', 'La fecha de inicio no puede ser posterior a la de fin.', 'feriaFechasTrigger'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (!horaInicio || !horaFin) { setFieldError('feriaHora', 'El horario diario de la feria es obligatorio.'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (horaInicio >= horaFin) { setFieldError('feriaHora', 'La hora de inicio debe ser anterior a la hora de fin.'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }

  const btn = document.getElementById('btnSaveFeria');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    if (feriaEditId) {
      const f = ferias.find(x => x.id === feriaEditId);
      if (f) {
        Object.assign(f, { empresa, fechaInicio, fechaFin, horaInicio, horaFin, precio, lugar, fechaImportante, observaciones, alineacion: feriaAlineacion });
        await updateFeria(f);
      }
    } else {
      await appendFeria({
        id: crypto.randomUUID(), empresa, fechaInicio, fechaFin, horaInicio, horaFin, precio, lugar, fechaImportante,
        observaciones, alineacion: feriaAlineacion, estado: 'disponible', conteoPersonas: 0,
        planStock: {}, ventas: [], observacionesDiarias: [], conteoProductos: {}
      });
    }
    await loadFerias();
    renderFeriasDisponibles();
    renderFeriasConfirmadas();
    closeFeriaModal();
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar feria';
  }
});

// ── Ferias: horarios y plan de stock ──────────────────────────────────────────

function getFeriaDefaultDay(f) {
  const dias = getFeriaDateList(f);
  if (!dias.length) return null;
  const today = toISODate(new Date());
  if (dias.includes(today)) return today;
  return today < dias[0] ? dias[0] : dias[dias.length - 1];
}

function feriaHorarioTerminado(f, fecha) {
  if (!f.horaFin) return false;
  return new Date() > new Date(`${fecha}T${f.horaFin}:00`);
}

function feriaTerminadaCompleta(f) {
  const dias = getFeriaDateList(f);
  if (!dias.length) return false;
  return feriaHorarioTerminado(f, dias[dias.length - 1]);
}

function openFeriaStockModal(feriaId) {
  const f = ferias.find(x => x.id === feriaId);
  if (!f) return;
  feriaStockPendingId = feriaId;
  document.getElementById('feriaStockFeedback').textContent = '';
  document.getElementById('btnSaveFeriaStock').textContent = f.estado === 'confirmada' ? 'Guardar plan' : 'Confirmar participación';
  const dias  = getFeriaDateList(f);
  const wrap  = document.getElementById('feriaStockTableWrap');
  const lotes = ejecuciones.filter(ej => (ej.evaluacion?.frascos230 || ej.evaluacion?.frascos180));

  if (!lotes.length) {
    wrap.innerHTML = '<div class="empty-state">No hay lotes con producción registrada en Procesos → Ejecuciones.</div>';
  } else {
    const headerCells = dias.map(d => `<th>${esc(fmtDateShortEs(d))}</th>`).join('');
    const rowsHTML = lotes.map(ej => {
      const disponible = getStockDisponibleLote(ej.id, feriaId);
      const cells = dias.map(d => {
        const val = (f.planStock[d] && f.planStock[d][ej.id]) || '';
        return `<td><input type="number" min="0" step="1" class="field-input feria-stock-input" data-lote="${esc(ej.id)}" data-fecha="${d}" value="${val}" style="width:64px" /></td>`;
      }).join('');
      return `
        <tr>
          <td class="feria-stock-receta">${esc(ej.nombreReceta)} — Lote ${esc(ej.loteId || ej.id.slice(0, 8))}<div class="feria-stock-disponible">Disponible: ${disponible}</div></td>
          ${cells}
        </tr>`;
    }).join('');
    wrap.innerHTML = `
      <div style="overflow-x:auto">
        <table class="tasks-table feria-stock-table">
          <thead><tr><th>Lote</th>${headerCells}</tr></thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>`;
  }

  document.getElementById('feriaStockOverlay').classList.add('open');
}

function closeFeriaStockModal() {
  document.getElementById('feriaStockOverlay').classList.remove('open');
  feriaStockPendingId = null;
}
document.getElementById('btnCloseFeriaStock').addEventListener('click', closeFeriaStockModal);
document.getElementById('feriaStockOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('feriaStockOverlay')) closeFeriaStockModal();
});

document.getElementById('btnSaveFeriaStock').addEventListener('click', async () => {
  const f  = ferias.find(x => x.id === feriaStockPendingId);
  const fb = document.getElementById('feriaStockFeedback');
  if (!f) return;

  const newPlan = {};
  const totals  = {};
  document.querySelectorAll('.feria-stock-input').forEach(inp => {
    const ejecucionId = inp.dataset.lote;
    const fecha       = inp.dataset.fecha;
    const qty         = parseInt(inp.value) || 0;
    if (qty <= 0) return;
    newPlan[fecha] = newPlan[fecha] || {};
    newPlan[fecha][ejecucionId] = qty;
    totals[ejecucionId] = (totals[ejecucionId] || 0) + qty;
  });

  const excesos = [];
  Object.entries(totals).forEach(([ejecucionId, total]) => {
    const disponible = getStockDisponibleLote(ejecucionId, f.id);
    if (total > disponible) {
      const ej = ejecuciones.find(e => e.id === ejecucionId);
      excesos.push(`${ej?.nombreReceta || ejecucionId} — Lote ${ej?.loteId || ejecucionId} (pediste ${total}, disponible ${disponible})`);
    }
  });
  if (excesos.length) return setFb(fb, `No hay stock suficiente: ${excesos.join('; ')}.`, 'err');

  const btn      = document.getElementById('btnSaveFeriaStock');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    f.planStock = newPlan;
    f.estado    = 'confirmada';
    await updateFeria(f);
    await loadFerias();
    renderFeriasDisponibles();
    renderFeriasConfirmadas();
    closeFeriaStockModal();
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = original;
  }
});

// ── Ferias: Conteo de personas, ventas, observaciones y stock del día ────────

function openFeriaCounter(feriaId) {
  const f = ferias.find(x => x.id === feriaId);
  if (!f) return;
  feriaCounterId = feriaId;
  document.getElementById('feriaCounterTitle').textContent = f.empresa;

  const dias = getFeriaDateList(f);
  const defaultDay = getFeriaDefaultDay(f);
  document.getElementById('feriaCounterDaySelect').innerHTML = dias
    .map(d => `<option value="${d}" ${d === defaultDay ? 'selected' : ''}>${esc(fmtDateShortEs(d))}</option>`)
    .join('');

  document.getElementById('feriaCounterValue').textContent = f.conteoPersonas || 0;

  renderFeriaCounterDay();
  document.getElementById('feriaCounterOverlay').classList.add('open');
}

document.getElementById('feriaCounterDaySelect').addEventListener('change', renderFeriaCounterDay);

function renderFeriaCounterDay() {
  const f = ferias.find(x => x.id === feriaCounterId);
  if (!f) return;
  const fecha = document.getElementById('feriaCounterDaySelect').value;
  renderFeriaVentaLoteOptions(f, fecha);
  renderFeriaVentasList(f, fecha);
  renderFeriaObsDiariasList(f, fecha);
  renderFeriaConteoProductos(f, fecha);
  document.getElementById('feriaDownloadWrap').style.display = feriaTerminadaCompleta(f) ? '' : 'none';
}

function scheduleFeriaCounterSave() {
  clearTimeout(feriaCounterSaveTimer);
  feriaCounterSaveTimer = setTimeout(async () => {
    const f = ferias.find(x => x.id === feriaCounterId);
    if (!f) return;
    try { await updateFeria(f); }
    catch (e) { console.warn('Error guardando conteo:', e.message); }
  }, 700);
}

function adjustFeriaCounter(delta) {
  const f = ferias.find(x => x.id === feriaCounterId);
  if (!f) return;
  f.conteoPersonas = Math.max(0, (f.conteoPersonas || 0) + delta);
  document.getElementById('feriaCounterValue').textContent = f.conteoPersonas;
  const blockCounterEl = document.querySelector(`.feria-block[data-id="${CSS.escape(feriaCounterId)}"] .feria-block-counter`);
  if (blockCounterEl) blockCounterEl.textContent = `👥 ${f.conteoPersonas}`;
  scheduleFeriaCounterSave();
}

document.getElementById('btnFeriaCounterPlus').addEventListener('click', () => adjustFeriaCounter(1));
document.getElementById('btnFeriaCounterMinus').addEventListener('click', () => adjustFeriaCounter(-1));
document.getElementById('btnFeriaCounterReset').addEventListener('click', () => {
  if (!confirm('¿Reiniciar el conteo a 0?')) return;
  const f = ferias.find(x => x.id === feriaCounterId);
  if (!f) return;
  f.conteoPersonas = 0;
  document.getElementById('feriaCounterValue').textContent = 0;
  const blockCounterEl = document.querySelector(`.feria-block[data-id="${CSS.escape(feriaCounterId)}"] .feria-block-counter`);
  if (blockCounterEl) blockCounterEl.textContent = '👥 0';
  scheduleFeriaCounterSave();
});

function renderFeriaVentaLoteOptions(f, fecha) {
  const sel     = document.getElementById('feriaVentaLote');
  const planHoy = f.planStock[fecha] || {};
  const ids     = Object.keys(planHoy).filter(id => planHoy[id] > 0);
  if (!ids.length) {
    sel.innerHTML = '<option value="">Sin stock planeado hoy</option>';
    sel.disabled  = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = ids.map(id => {
    const ej = ejecuciones.find(x => x.id === id);
    const label = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
    return `<option value="${esc(id)}">${esc(label)} (llevados: ${planHoy[id]})</option>`;
  }).join('');
}

function renderFeriaVentasList(f, fecha) {
  const list = document.getElementById('feriaVentasList');
  f.ventas = f.ventas || [];
  const ventasHoy = f.ventas.filter(v => v.fecha === fecha);
  if (!ventasHoy.length) {
    list.innerHTML = '<div class="obs-empty">Aún sin ventas registradas hoy</div>';
    return;
  }
  list.innerHTML = ventasHoy.map(v => {
    const globalIdx = f.ventas.indexOf(v);
    return `
      <div class="obs-item">
        <div class="obs-text">${esc(v.recetaNombre)}${v.loteId ? ` — Lote ${esc(v.loteId)}` : ''} × ${v.cantidad}</div>
        <div class="obs-date">${fmtDate(v.createdAt)} <button class="mgmt-item-del" data-del-venta="${globalIdx}" style="float:right">✕</button></div>
      </div>`;
  }).join('');
  list.querySelectorAll('[data-del-venta]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = +btn.dataset.delVenta;
      f.ventas.splice(idx, 1);
      renderFeriaCounterDay();
      try { await updateFeria(f); } catch (e) { console.warn('Error al eliminar venta:', e.message); }
    });
  });
}

document.getElementById('btnAddFeriaVenta').addEventListener('click', async () => {
  const f = ferias.find(x => x.id === feriaCounterId);
  if (!f) return;
  const fecha       = document.getElementById('feriaCounterDaySelect').value;
  const ejecucionId = document.getElementById('feriaVentaLote').value;
  const cantidad    = parseInt(document.getElementById('feriaVentaCantidad').value) || 0;
  if (!ejecucionId || cantidad <= 0) return;
  const ej = ejecuciones.find(x => x.id === ejecucionId);
  f.ventas = f.ventas || [];
  f.ventas.push({
    fecha, ejecucionId, loteId: ej?.loteId || '', recetaId: ej?.recetaId || '',
    recetaNombre: ej?.nombreReceta || '', cantidad, createdAt: new Date().toISOString()
  });
  document.getElementById('feriaVentaCantidad').value = '';
  renderFeriaCounterDay();
  try { await updateFeria(f); } catch (e) { console.warn('Error guardando venta:', e.message); }
});

function renderFeriaObsDiariasList(f, fecha) {
  const list = document.getElementById('feriaObsDiariasList');
  f.observacionesDiarias = f.observacionesDiarias || [];
  const obsHoy = f.observacionesDiarias.filter(o => o.fecha === fecha);
  if (!obsHoy.length) {
    list.innerHTML = '<div class="obs-empty">Aún sin observaciones hoy</div>';
    return;
  }
  list.innerHTML = obsHoy.map(o => `
    <div class="obs-item">
      <div class="obs-text">${esc(o.text)}</div>
      <div class="obs-date">${fmtDate(o.createdAt)}</div>
    </div>`).join('');
  list.scrollTop = list.scrollHeight;
}

document.getElementById('btnAddFeriaObsDiaria').addEventListener('click', async () => {
  const f = ferias.find(x => x.id === feriaCounterId);
  if (!f) return;
  const fecha = document.getElementById('feriaCounterDaySelect').value;
  const input = document.getElementById('feriaObsDiariaInput');
  const text  = input.value.trim();
  if (!text) return;
  f.observacionesDiarias = f.observacionesDiarias || [];
  f.observacionesDiarias.push({ fecha, text, createdAt: new Date().toISOString() });
  input.value = '';
  renderFeriaCounterDay();
  try { await updateFeria(f); } catch (e) { console.warn('Error guardando observación:', e.message); }
});

function renderFeriaConteoProductos(f, fecha) {
  const wrap    = document.getElementById('feriaConteoProductosWrap');
  const planHoy = f.planStock[fecha] || {};
  const ids     = Object.keys(planHoy).filter(id => planHoy[id] > 0);

  if (!ids.length) {
    wrap.innerHTML = '<p class="mgmt-note">No hay stock planeado para este día.</p>';
    return;
  }
  if (!feriaHorarioTerminado(f, fecha)) {
    wrap.innerHTML = `<p class="mgmt-note">Disponible después de las ${esc(f.horaFin)} de este día.</p>`;
    return;
  }

  const existing = (f.conteoProductos || {})[fecha];
  const rowsHTML = ids.map(id => {
    const ej         = ejecuciones.find(e => e.id === id);
    const label      = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
    const llevados   = planHoy[id];
    const vendidos   = (f.ventas || []).filter(v => v.fecha === fecha && v.ejecucionId === id).reduce((s, v) => s + v.cantidad, 0);
    const sobrantesVal = existing?.detalle?.[id]?.sobrantes ?? '';
    return `
      <tr>
        <td>${esc(label)}</td>
        <td>${llevados}</td>
        <td>${vendidos}</td>
        <td><input type="number" min="0" step="1" class="field-input feria-sobrante-input" data-lote="${esc(id)}" value="${sobrantesVal}" style="width:64px" /></td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table class="tasks-table">
      <thead><tr><th>Lote</th><th>Llevados</th><th>Vendidos</th><th>Sobrantes</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
    <button class="btn-outline btn-sm" id="btnSaveConteoProductos" style="margin-top:8px">Guardar conteo de productos</button>
    <div id="feriaConteoProductosResult" style="margin-top:8px"></div>
  `;

  if (existing) renderConteoProductosResult(f, fecha);

  document.getElementById('btnSaveConteoProductos').addEventListener('click', async () => {
    const detalle = {};
    ids.forEach(id => {
      const llevados = planHoy[id];
      const vendidos = (f.ventas || []).filter(v => v.fecha === fecha && v.ejecucionId === id).reduce((s, v) => s + v.cantidad, 0);
      const input     = wrap.querySelector(`.feria-sobrante-input[data-lote="${CSS.escape(id)}"]`);
      const sobrantes  = parseInt(input.value) || 0;
      detalle[id] = { llevados, vendidos, sobrantes, descuadre: llevados - vendidos - sobrantes };
    });
    f.conteoProductos = f.conteoProductos || {};
    f.conteoProductos[fecha] = { detalle, revisadoEn: new Date().toISOString() };
    try {
      await updateFeria(f);
      renderConteoProductosResult(f, fecha);
    } catch (e) { alert('Error al guardar: ' + e.message); }
  });
}

function renderConteoProductosResult(f, fecha) {
  const resultEl = document.getElementById('feriaConteoProductosResult');
  const conteo   = (f.conteoProductos || {})[fecha];
  if (!resultEl || !conteo) return;
  const problemas = Object.entries(conteo.detalle)
    .filter(([, d]) => d.descuadre !== 0)
    .map(([id, d]) => {
      const ej = ejecuciones.find(e => e.id === id);
      const label = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
      return `${label}: descuadre de ${d.descuadre} unidad${Math.abs(d.descuadre) !== 1 ? 'es' : ''}`;
    });
  resultEl.innerHTML = problemas.length
    ? `<div class="eval-insumos-total eval-costo-warn">⚠️ ${problemas.join('; ')}</div>`
    : `<div class="eval-insumos-total">✅ Todo cuadra: ventas + sobrantes = llevados.</div>`;
}

function feriaToText(f) {
  const sep = '═══════════════════════════════════════';
  const lines = [];
  lines.push(sep, `FERIA: ${f.empresa}`, sep, '');
  lines.push(`Fechas: ${f.fechaInicio} a ${f.fechaFin}`);
  lines.push(`Horario diario: ${f.horaInicio} a ${f.horaFin}`);
  lines.push(`Lugar: ${f.lugar || '—'}`);
  lines.push(`Precio de participación: ${fmtCOP(f.precio)}`);
  lines.push(`Fecha importante cercana: ${f.fechaImportante || '—'}`);
  lines.push(`Alineación con TateQuieto: ${f.alineacion || 0}/5`);
  if (f.observaciones) lines.push(`Observaciones generales: ${f.observaciones}`);
  lines.push('', `Personas que probaron TateQuieto (total): ${f.conteoPersonas || 0}`);

  getFeriaDateList(f).forEach(fecha => {
    lines.push('', `── DÍA ${fecha} ─────────────────────────────────────────`);
    const plan = f.planStock[fecha] || {};
    const ids  = Object.keys(plan);
    if (ids.length) {
      lines.push('Stock llevado:');
      ids.forEach(id => {
        const ej = ejecuciones.find(e => e.id === id);
        const label = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
        lines.push(`  - ${label}: ${plan[id]} unidades`);
      });
    } else {
      lines.push('Sin stock planeado.');
    }
    const ventasDia = (f.ventas || []).filter(v => v.fecha === fecha);
    if (ventasDia.length) {
      lines.push('Ventas:');
      ventasDia.forEach(v => lines.push(`  - ${v.recetaNombre}${v.loteId ? ` — Lote ${v.loteId}` : ''}: ${v.cantidad}`));
    }
    const conteo = (f.conteoProductos || {})[fecha];
    if (conteo) {
      lines.push('Conteo de productos:');
      Object.entries(conteo.detalle).forEach(([id, d]) => {
        const ej = ejecuciones.find(e => e.id === id);
        const label = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
        lines.push(`  - ${label}: llevados ${d.llevados}, vendidos ${d.vendidos}, sobrantes ${d.sobrantes}${d.descuadre !== 0 ? ` ⚠️ descuadre ${d.descuadre}` : ''}`);
      });
    }
    const obsDia = (f.observacionesDiarias || []).filter(o => o.fecha === fecha);
    if (obsDia.length) {
      lines.push('Observaciones del día:');
      obsDia.forEach(o => lines.push(`  - ${o.text} (${fmtDate(o.createdAt)})`));
    }
  });

  lines.push('', sep, '');
  return lines.join('\n');
}

document.getElementById('btnDownloadFeria').addEventListener('click', () => {
  const f = ferias.find(x => x.id === feriaCounterId);
  if (!f) return;
  const text = feriaToText(f);
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `feria-${(f.empresa || 'feria').replace(/[^a-z0-9]+/gi, '-')}.txt`;
  a.click(); URL.revokeObjectURL(url);
});

function closeFeriaCounter() {
  clearTimeout(feriaCounterSaveTimer);
  const f = ferias.find(x => x.id === feriaCounterId);
  if (f) updateFeria(f).catch(e => console.warn('Error guardando conteo final:', e.message));
  document.getElementById('feriaCounterOverlay').classList.remove('open');
  feriaCounterId = null;
}
document.getElementById('btnCloseFeriaCounter').addEventListener('click', closeFeriaCounter);
document.getElementById('feriaCounterOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('feriaCounterOverlay')) closeFeriaCounter();
});

