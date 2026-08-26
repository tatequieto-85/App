import { sheetsReq } from './auth.js';
import { esc, setFb, setFieldError, clearFieldErrors, confirmCloseIfDirty, safeParseJSON, fmtDate, fmtDateShortEs, fmtCOP, parseISODate, toISODate, addDays, ICON_EDIT, ICON_TRASH, initCardMenus } from './utils.js';
import { wasAccidentalTouch } from './input-guard.js';
import { openCalendarPopover } from './tareas.js';
import { ejecuciones, getStockProducido } from './procesos.js';
import { stockTestigos } from './stock.js';

export let ferias        = [];
let feriasSheetId        = null;
let feriaEditId          = null;
let feriaCounterId       = null;
let feriaCounterFecha    = null; // día fijo del contador (siempre "hoy", ver getFeriaDefaultDay)
let feriaCounterSaveTimer = null;
let feriaStockPendingId  = null;
let feriaResumenId       = null;
let lastTapTime          = {}; // para detección de doble-toque en móvil

// ── Ferias: Sheets init + CRUD ──────────────────────────────────────────────────

// Nota: las columnas A–L mantienen el orden original de este módulo
// (antes de agregar horario/stock/ventas) para no desalinear filas ya
// guardadas. Los campos nuevos siempre se agregan al final (M–R, luego S–U).
// ConteoPersonas (K) queda congelada como respaldo histórico de ferias
// anteriores al conteo por rango etario — ver feriaConteoTotal().
export async function initFeriasSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasF = tabs.find(s => s.properties.title === 'Ferias');

  if (hasF) {
    feriasSheetId = hasF.properties.sheetId;
    const headerData = await sheetsReq('/values/Ferias!A1:V1').catch(() => ({}));
    const headerRow  = (headerData.values || [])[0] || [];
    if (headerRow.length < 18) {
      await sheetsReq('/values/Ferias!M1:R1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [[
          'HoraInicio','HoraFin','PlanStock','Ventas','ObservacionesDiarias','ConteoProductos'
        ]] })
      });
    }
    if (headerRow.length < 21) {
      await sheetsReq('/values/Ferias!S1:U1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [[ 'ConteoMenores30', 'ConteoEntre30y55', 'ConteoMayores55' ]] })
      });
    }
    if (headerRow.length < 22) {
      await sheetsReq('/values/Ferias!V1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [[ 'Cerrada' ]] })
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
        'HoraInicio','HoraFin','PlanStock','Ventas','ObservacionesDiarias','ConteoProductos',
        'ConteoMenores30','ConteoEntre30y55','ConteoMayores55','Cerrada'
      ]] })
    });
  }
  await loadFerias();
}

export async function loadFerias() {
  const data = await sheetsReq('/values/Ferias!A:V');
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
    conteoPersonas:       parseInt(r[10]) || 0, // respaldo histórico, ver feriaConteoTotal()
    creadoEn:             r[11] || '',
    horaInicio:           r[12] || '',
    horaFin:              r[13] || '',
    planStock:            safeParseJSON(r[14], {}),
    ventas:               safeParseJSON(r[15], []),
    observacionesDiarias: safeParseJSON(r[16], []),
    conteoProductos:      safeParseJSON(r[17], {}),
    conteoMenores30:      parseInt(r[18]) || 0,
    conteoEntre30y55:     parseInt(r[19]) || 0,
    conteoMayores55:      parseInt(r[20]) || 0,
    cerrada:              r[21] === 'TRUE',
    rowIndex:             i + 2
  }));
}

// Antes de esta función el conteo era un solo total sin rango etario; las
// ferias anteriores a este cambio solo tienen ese dato en ConteoPersonas.
export function feriaConteoTotal(f) {
  const porRango = (f.conteoMenores30 || 0) + (f.conteoEntre30y55 || 0) + (f.conteoMayores55 || 0);
  return porRango || (f.conteoPersonas || 0);
}

function feriaRowValues(f) {
  return [
    f.id, f.empresa, f.fechaInicio, f.fechaFin, f.precio, f.fechaImportante, f.lugar,
    f.observaciones || '', f.alineacion || 0, f.estado || 'disponible', f.conteoPersonas || 0,
    f.creadoEn || new Date().toISOString(),
    f.horaInicio || '', f.horaFin || '', JSON.stringify(f.planStock || {}), JSON.stringify(f.ventas || []),
    JSON.stringify(f.observacionesDiarias || []), JSON.stringify(f.conteoProductos || {}),
    f.conteoMenores30 || 0, f.conteoEntre30y55 || 0, f.conteoMayores55 || 0,
    f.cerrada ? 'TRUE' : 'FALSE'
  ];
}

async function appendFeria(f) {
  await sheetsReq('/values/Ferias!A:V:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [feriaRowValues(f)] })
  });
}

async function updateFeria(f) {
  await sheetsReq(`/values/Ferias!A${f.rowIndex}:V${f.rowIndex}?valueInputOption=RAW`, {
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
    .filter(f => f.id !== excludeFeriaId)
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

// Si hoy cae dentro del rango de fechas de alguna feria, la primera vista
// al entrar al módulo debe ser el conteo de personas, no la lista.
export function openTodaysFeriaCounterIfAny() {
  const activa = ferias.find(feriaEstaEnCurso);
  if (activa) openFeriaCounter(activa.id);
}

// "En curso" = hoy cae en sus fechas Y no se cerró a mano con "Terminar
// feria" (botón dentro del contador) — ver respuesta guardada sobre el
// cierre manual. Fuera de esto (todavía no empieza, ya pasó por calendario,
// o se cerró a mano) se muestra el resumen en vez del contador.
function feriaEstaEnCurso(f) {
  return getFeriaDateList(f).includes(toISODate(new Date())) && !f.cerrada;
}

// Punto de entrada único del botón "Registrar conteo"/"Ver resumen" y del
// doble clic/toque sobre la tarjeta: fuera de las fechas de la feria no tiene
// sentido dejar cargar el conteo del día (no hay "hoy" válido que registrar).
function handleAbrirFeria(feriaId) {
  const f = ferias.find(x => x.id === feriaId);
  if (!f) return;
  if (feriaEstaEnCurso(f)) openFeriaCounter(feriaId);
  else openFeriaResumen(feriaId);
}

// ── Ferias: UI ─────────────────────────────────────────────────────────────────

function feriaBlockHTML(f) {
  const fechas = (f.fechaInicio && f.fechaFin) ? `${fmtDateShortEs(f.fechaInicio)} → ${fmtDateShortEs(f.fechaFin)}` : '—';
  return `
    <div class="feria-block" data-id="${esc(f.id)}">
      <div class="feria-block-title">${esc(f.empresa)}</div>
      <div class="feria-block-meta">📅 ${fechas}</div>
      <div class="feria-block-meta">📍 ${esc(f.lugar || '—')}</div>
      <div class="feria-block-counter">👥 ${feriaConteoTotal(f)}</div>
      <div class="card-menu">
        <div class="card-menu-list">
          <button type="button" data-edit-feria="${esc(f.id)}">${ICON_EDIT} Editar</button>
          <button type="button" data-del-feria="${esc(f.id)}" data-row="${f.rowIndex}">${ICON_TRASH} Eliminar</button>
        </div>
      </div>
    </div>`;
}

function wireFeriaCardActions(container) {
  initCardMenus(container);
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
        renderFerias();
      } catch (err) { alert('Error: ' + err.message); btn.disabled = false; }
    });
  });
}

export function renderFerias() {
  const container = document.getElementById('feriasList');
  if (!container) return;
  if (!ferias.length) {
    container.innerHTML = '<div class="empty-state">No hay ferias. Agrega la primera con "+ Nueva feria".</div>';
    return;
  }
  container.innerHTML = `<div class="feria-blocks-grid">${ferias.map(feriaBlockHTML).join('')}</div>`;
  wireFeriaCardActions(container);
  container.querySelectorAll('.feria-block').forEach(block => {
    // Evita el menú nativo (Copiar/Buscar/Traducir) que el navegador
    // dispara al mantener presionado, que compite con nuestro propio menú.
    block.addEventListener('contextmenu', e => e.preventDefault());
    let pressTimer  = null;
    let longPressed = false;
    const openCardMenu = () => {
      const list = block.querySelector('.card-menu-list');
      document.querySelectorAll('.card-menu-list.open').forEach(m => m.classList.remove('open'));
      if (list) list.classList.add('open');
    };
    const startPress = e => {
      if (e.target.closest('button')) return;
      longPressed = false;
      pressTimer = setTimeout(() => { longPressed = true; openCardMenu(); }, 550);
    };
    const cancelPress = () => clearTimeout(pressTimer);

    // Mantener presionada la tarjeta (mouse o dedo) abre el mismo menú de
    // "···" (Editar/Eliminar) en vez de tener que acertarle al botón chico.
    block.addEventListener('mousedown', startPress);
    block.addEventListener('mouseup', cancelPress);
    block.addEventListener('mouseleave', cancelPress);
    block.addEventListener('touchstart', startPress, { passive: true });
    block.addEventListener('touchmove', cancelPress, { passive: true });
    // Al soltar tras un press-and-hold ya cumplido, el navegador dispara un
    // "click" normal (mismo lugar, sin movimiento) que llegaría a document y
    // cerraría el menú que se acaba de abrir (initCardMenus en utils.js lo
    // cierra ante cualquier clic afuera) — se corta acá antes de que llegue.
    block.addEventListener('click', e => {
      if (longPressed) { e.stopPropagation(); longPressed = false; }
    });

    block.addEventListener('dblclick', e => {
      if (e.target.closest('button')) return;
      handleAbrirFeria(block.dataset.id);
    });
    block.addEventListener('touchend', e => {
      cancelPress();
      if (longPressed) { longPressed = false; return; } // ya abrió el menú: no contar como toque
      if (e.target.closest('button') || wasAccidentalTouch()) return;
      const now  = Date.now();
      const last = lastTapTime['feria_' + block.dataset.id] || 0;
      lastTapTime['feria_' + block.dataset.id] = now;
      if (now - last < 350) handleAbrirFeria(block.dataset.id);
    });
  });
}

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
  const today = toISODate(new Date());
  document.getElementById('feriaStockLinkWrap').style.display = editId ? '' : 'none';
  if (editId) {
    const f = ferias.find(x => x.id === editId);
    if (!f) return;
    document.getElementById('feriaModalTitle').textContent    = 'Editar feria';
    document.getElementById('feriaEmpresa').value             = f.empresa;
    document.getElementById('feriaFechaInicio').value         = f.fechaInicio || today;
    document.getElementById('feriaFechaFin').value            = f.fechaFin || today;
    document.getElementById('feriaPrecio').value               = f.precio || '';
    document.getElementById('feriaLugar').value                = f.lugar || '';
    document.getElementById('feriaObservaciones').value        = f.observaciones || '';
  } else {
    document.getElementById('feriaModalTitle').textContent    = 'Nueva feria';
    document.getElementById('feriaEmpresa').value             = '';
    document.getElementById('feriaFechaInicio').value         = today;
    document.getElementById('feriaFechaFin').value            = today;
    document.getElementById('feriaPrecio').value               = '';
    document.getElementById('feriaLugar').value                = '';
    document.getElementById('feriaObservaciones').value        = '';
  }
  updateFeriaFechasTrigger();
  document.getElementById('feriaOverlay').classList.add('open');
  setTimeout(() => document.getElementById('feriaEmpresa').focus(), 100);
}
document.getElementById('btnFeriaStockFromEdit').addEventListener('click', () => {
  if (feriaEditId) openFeriaStockModal(feriaEditId);
});

function isFeriaFormDirty() {
  return !!document.getElementById('feriaEmpresa')?.value.trim()
    || !!document.getElementById('feriaLugar')?.value.trim()
    || !!document.getElementById('feriaObservaciones')?.value.trim();
}

function closeFeriaModal() {
  confirmCloseIfDirty('feriaOverlay', isFeriaFormDirty);
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
  const precio          = parseFloat(document.getElementById('feriaPrecio').value) || 0;
  const lugar           = document.getElementById('feriaLugar').value.trim();
  const observaciones   = document.getElementById('feriaObservaciones').value.trim();
  const fb              = document.getElementById('feriaFeedback');

  clearFieldErrors('feriaEmpresa', 'feriaFechas');
  if (!empresa) { setFieldError('feriaEmpresa', 'La empresa organizadora es obligatoria.'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (!fechaInicio || !fechaFin) { setFieldError('feriaFechas', 'Las fechas de la feria son obligatorias.', 'feriaFechasTrigger'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (fechaInicio > fechaFin) { setFieldError('feriaFechas', 'La fecha de inicio no puede ser posterior a la de fin.', 'feriaFechasTrigger'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }

  const btn = document.getElementById('btnSaveFeria');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    if (feriaEditId) {
      const f = ferias.find(x => x.id === feriaEditId);
      if (f) {
        Object.assign(f, { empresa, fechaInicio, fechaFin, precio, lugar, observaciones });
        await updateFeria(f);
      }
    } else {
      await appendFeria({
        id: crypto.randomUUID(), empresa, fechaInicio, fechaFin, horaInicio: '', horaFin: '', precio, lugar,
        fechaImportante: '', observaciones, alineacion: 0, estado: 'confirmada', conteoPersonas: 0,
        planStock: {}, ventas: [], observacionesDiarias: [], conteoProductos: {},
        conteoMenores30: 0, conteoEntre30y55: 0, conteoMayores55: 0, cerrada: false
      });
    }
    await loadFerias();
    renderFerias();
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

function openFeriaStockModal(feriaId) {
  const f = ferias.find(x => x.id === feriaId);
  if (!f) return;
  feriaStockPendingId = feriaId;
  document.getElementById('feriaStockFeedback').textContent = '';
  document.getElementById('btnSaveFeriaStock').textContent = 'Guardar plan';
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
    await updateFeria(f);
    await loadFerias();
    renderFerias();
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
  feriaCounterId    = feriaId;
  feriaCounterFecha = getFeriaDefaultDay(f);
  document.getElementById('feriaCounterTitle').textContent = f.empresa;
  document.getElementById('feriaCounterDateLabel').textContent = fmtDateShortEs(feriaCounterFecha);

  document.getElementById('feriaVentaOverlay').classList.remove('open');
  document.getElementById('feriaObsOverlay').classList.remove('open');

  renderFeriaCounterValues(f);
  renderFeriaCounterDay();
  document.getElementById('feriaCounterOverlay').classList.add('open');
}

function renderFeriaCounterValues(f) {
  document.getElementById('feriaCounterValueMenores30').textContent = f.conteoMenores30 || 0;
  document.getElementById('feriaCounterValueEntre30y55').textContent = f.conteoEntre30y55 || 0;
  document.getElementById('feriaCounterValueMayores55').textContent = f.conteoMayores55 || 0;
  document.getElementById('feriaCounterValueTotal').textContent   = feriaConteoTotal(f);
  const blockCounterEl = document.querySelector(`.feria-block[data-id="${CSS.escape(f.id)}"] .feria-block-counter`);
  if (blockCounterEl) blockCounterEl.textContent = `👥 ${feriaConteoTotal(f)}`;
}

function renderFeriaCounterDay() {
  const f = ferias.find(x => x.id === feriaCounterId);
  if (!f) return;
  renderFeriaVentaRows(f, feriaCounterFecha);
}

document.getElementById('btnTerminarFeria').addEventListener('click', async () => {
  const f = ferias.find(x => x.id === feriaCounterId);
  if (!f) return;
  if (!confirm('¿Terminar esta feria? Vas a poder ver el resumen y el conteo de productos, pero no seguir registrando el conteo del día.')) return;
  f.cerrada = true;
  try {
    await updateFeria(f);
    closeFeriaCounter();
    renderFerias();
    openFeriaResumen(f.id);
  } catch (e) {
    f.cerrada = false;
    alert('Error al terminar la feria: ' + e.message);
  }
});

function scheduleFeriaCounterSave() {
  clearTimeout(feriaCounterSaveTimer);
  feriaCounterSaveTimer = setTimeout(async () => {
    const f = ferias.find(x => x.id === feriaCounterId);
    if (!f) return;
    try { await updateFeria(f); }
    catch (e) { console.warn('Error guardando conteo:', e.message); }
  }, 700);
}

function adjustFeriaCounter(campo, delta) {
  const f = ferias.find(x => x.id === feriaCounterId);
  if (!f) return;
  f[campo] = Math.max(0, (f[campo] || 0) + delta);
  renderFeriaCounterValues(f);
  scheduleFeriaCounterSave();
}

document.getElementById('btnFeriaCounterPlusMenores30').addEventListener('click', () => adjustFeriaCounter('conteoMenores30', 1));
document.getElementById('btnFeriaCounterMinusMenores30').addEventListener('click', () => adjustFeriaCounter('conteoMenores30', -1));
document.getElementById('btnFeriaCounterPlusEntre30y55').addEventListener('click', () => adjustFeriaCounter('conteoEntre30y55', 1));
document.getElementById('btnFeriaCounterMinusEntre30y55').addEventListener('click', () => adjustFeriaCounter('conteoEntre30y55', -1));
document.getElementById('btnFeriaCounterPlusMayores55').addEventListener('click', () => adjustFeriaCounter('conteoMayores55', 1));
document.getElementById('btnFeriaCounterMinusMayores55').addEventListener('click', () => adjustFeriaCounter('conteoMayores55', -1));
document.getElementById('btnFeriaCounterReset').addEventListener('click', () => {
  if (!confirm('¿Reiniciar el conteo a 0?')) return;
  const f = ferias.find(x => x.id === feriaCounterId);
  if (!f) return;
  f.conteoMenores30 = 0;
  f.conteoEntre30y55 = 0;
  f.conteoMayores55 = 0;
  renderFeriaCounterValues(f);
  scheduleFeriaCounterSave();
});

// Una fila por lote que se llevó hoy a la feria (planStock del día) y que
// todavía tiene stock disponible (llevado - ya vendido hoy > 0).
function renderFeriaVentaRows(f, fecha) {
  const wrap    = document.getElementById('feriaVentaRows');
  const planHoy = f.planStock[fecha] || {};
  const vendidoHoy = {};
  (f.ventas || []).filter(v => v.fecha === fecha).forEach(v => {
    vendidoHoy[v.ejecucionId] = (vendidoHoy[v.ejecucionId] || 0) + v.cantidad;
  });
  const filas = Object.keys(planHoy)
    .map(id => ({ id, disponible: (planHoy[id] || 0) - (vendidoHoy[id] || 0) }))
    .filter(row => row.disponible > 0);

  if (!filas.length) {
    wrap.innerHTML = '<div class="obs-empty">No hay lotes con stock disponible para vender hoy.</div>';
    return;
  }

  wrap.innerHTML = filas.map(row => {
    const ej     = ejecuciones.find(x => x.id === row.id);
    const nombre = ej ? `${esc(ej.nombreReceta)} — Lote ${esc(ej.loteId || row.id.slice(0, 8))}` : esc(row.id);
    return `
      <div class="feria-venta-row">
        <div class="feria-venta-row-info">
          <span class="feria-venta-row-nombre">${nombre}</span>
          <span class="feria-venta-row-disp">Disponible: ${row.disponible}</span>
        </div>
        <input class="field-input feria-venta-row-qty" type="number" min="1" max="${row.disponible}" step="1" placeholder="Cant." data-lote="${esc(row.id)}" />
        <button class="btn-outline btn-sm feria-venta-row-add" data-lote="${esc(row.id)}">Agregar</button>
      </div>`;
  }).join('');

  wrap.querySelectorAll('.feria-venta-row-add').forEach(btn => {
    btn.addEventListener('click', async () => {
      const loteId  = btn.dataset.lote;
      const input   = wrap.querySelector(`.feria-venta-row-qty[data-lote="${CSS.escape(loteId)}"]`);
      const cantidad = parseInt(input.value) || 0;
      const fila    = filas.find(r => r.id === loteId);
      if (!fila || cantidad <= 0) return;
      if (cantidad > fila.disponible) { alert('La cantidad supera el stock disponible de este lote.'); return; }

      const f2 = ferias.find(x => x.id === feriaCounterId);
      if (!f2) return;
      const ej = ejecuciones.find(x => x.id === loteId);
      f2.ventas = f2.ventas || [];
      f2.ventas.push({
        fecha, ejecucionId: loteId, loteId: ej?.loteId || '', recetaId: ej?.recetaId || '',
        recetaNombre: ej?.nombreReceta || '', cantidad, createdAt: new Date().toISOString()
      });
      renderFeriaCounterDay();
      try { await updateFeria(f2); } catch (e) { console.warn('Error guardando venta:', e.message); }
    });
  });
}

function isFeriaVentaFormDirty() {
  return Array.from(document.querySelectorAll('.feria-venta-row-qty')).some(input => input.value.trim());
}

function closeFeriaVentaModal() {
  confirmCloseIfDirty('feriaVentaOverlay', isFeriaVentaFormDirty);
}
document.getElementById('btnOpenFeriaVenta').addEventListener('click', () => {
  document.getElementById('feriaVentaOverlay').classList.add('open');
});
document.getElementById('btnCloseFeriaVenta').addEventListener('click', closeFeriaVentaModal);
document.getElementById('feriaVentaOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('feriaVentaOverlay')) closeFeriaVentaModal();
});

function isFeriaObsFormDirty() {
  return !!document.getElementById('feriaObsDiariaInput')?.value.trim();
}

function closeFeriaObsModal() {
  confirmCloseIfDirty('feriaObsOverlay', isFeriaObsFormDirty);
}
document.getElementById('btnOpenFeriaObs').addEventListener('click', () => {
  document.getElementById('feriaObsOverlay').classList.add('open');
});
document.getElementById('btnCloseFeriaObs').addEventListener('click', closeFeriaObsModal);
document.getElementById('feriaObsOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('feriaObsOverlay')) closeFeriaObsModal();
});

document.getElementById('btnAddFeriaObsDiaria').addEventListener('click', async () => {
  const f = ferias.find(x => x.id === feriaCounterId);
  if (!f) return;
  const fecha = feriaCounterFecha;
  const input = document.getElementById('feriaObsDiariaInput');
  const text  = input.value.trim();
  if (!text) return;
  f.observacionesDiarias = f.observacionesDiarias || [];
  f.observacionesDiarias.push({ fecha, text, createdAt: new Date().toISOString() });
  input.value = '';
  renderFeriaCounterDay();
  closeFeriaObsModal();
  try { await updateFeria(f); } catch (e) { console.warn('Error guardando observación:', e.message); }
});

// wrap: contenedor propio de este día (la resumen muestra uno por cada día
// de la feria, ver openFeriaResumen) — ya no vive fijo en el HTML porque
// dejó de ser un solo día dentro del contador; ver respuesta guardada sobre
// el cierre manual de la feria.
function renderFeriaConteoProductos(f, fecha, wrap) {
  const planHoy = f.planStock[fecha] || {};
  const ids     = Object.keys(planHoy).filter(id => planHoy[id] > 0);

  if (!ids.length) {
    wrap.innerHTML = '<p class="mgmt-note">No hay stock planeado para este día.</p>';
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
    <button type="button" class="btn-outline btn-sm" data-conteo-save style="margin-top:8px">Guardar conteo de productos</button>
    <div data-conteo-result style="margin-top:8px"></div>
  `;

  if (existing) renderConteoProductosResult(f, fecha, wrap);

  wrap.querySelector('[data-conteo-save]').addEventListener('click', async () => {
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
      renderConteoProductosResult(f, fecha, wrap);
    } catch (e) { alert('Error al guardar: ' + e.message); }
  });
}

function renderConteoProductosResult(f, fecha, wrap) {
  const resultEl = wrap.querySelector('[data-conteo-result]');
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
  lines.push(`Lugar: ${f.lugar || '—'}`);
  lines.push(`Precio de participación: ${fmtCOP(f.precio)}`);
  if (f.observaciones) lines.push(`Observaciones generales: ${f.observaciones}`);
  lines.push('', `Personas que probaron TateQuieto (total): ${feriaConteoTotal(f)}`);
  lines.push(`  • Menores de 30: ${f.conteoMenores30 || 0}`);
  lines.push(`  • Entre 30 y 55: ${f.conteoEntre30y55 || 0}`);
  lines.push(`  • Mayores de 55: ${f.conteoMayores55 || 0}`);

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

function downloadFeriaTxt(f) {
  const text = feriaToText(f);
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `feria-${(f.empresa || 'feria').replace(/[^a-z0-9]+/gi, '-')}.txt`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Ferias: resumen (fuera de las fechas de la feria, en vez del conteo) ────────

function openFeriaResumen(feriaId) {
  const f = ferias.find(x => x.id === feriaId);
  if (!f) return;
  feriaResumenId = feriaId;
  document.getElementById('feriaResumenTitle').textContent   = f.empresa;
  document.getElementById('feriaResumenContent').textContent = feriaToText(f);

  const conteoWrap = document.getElementById('feriaResumenConteoWrap');
  const dias = getFeriaDateList(f);
  conteoWrap.innerHTML = dias.map(fecha => `
    <div class="feria-section">
      <h4 class="feria-section-title">Conteo de productos — ${fmtDateShortEs(fecha)}</h4>
      <div data-dia="${esc(fecha)}"></div>
    </div>`).join('');
  dias.forEach(fecha => {
    renderFeriaConteoProductos(f, fecha, conteoWrap.querySelector(`[data-dia="${CSS.escape(fecha)}"]`));
  });

  document.getElementById('feriaResumenOverlay').classList.add('open');
}

function closeFeriaResumen() {
  document.getElementById('feriaResumenOverlay').classList.remove('open');
  feriaResumenId = null;
}
document.getElementById('btnCloseFeriaResumen').addEventListener('click', closeFeriaResumen);
document.getElementById('feriaResumenOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('feriaResumenOverlay')) closeFeriaResumen();
});
document.getElementById('btnDownloadFeriaResumen').addEventListener('click', () => {
  const f = ferias.find(x => x.id === feriaResumenId);
  if (f) downloadFeriaTxt(f);
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

