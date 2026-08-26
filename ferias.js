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
    conteoProductos:      safeParseJSON(r[17], null),
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

// Tolera ferias guardadas antes del cambio a plan sin desglose por día,
// cuyo planStock quedó como {fecha: {loteId: qty}} en vez de {loteId: qty}.
function feriaTotalLlevados(f) {
  return Object.values(f.planStock || {}).reduce((sum, val) => {
    if (val && typeof val === 'object') return sum + Object.values(val).reduce((s, q) => s + (q || 0), 0);
    return sum + (val || 0);
  }, 0);
}

function feriaTotalVendidos(f) {
  return (f.ventas || []).reduce((sum, v) => sum + (v.cantidad || 0), 0);
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
    .reduce((sum, f) => sum + ((f.planStock || {})[ejecucionId] || 0), 0);
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

// Todavía no llegó la fecha de inicio: acá lo que hace falta es planificar
// cuánto stock llevar por día, no un conteo (no hay "hoy" válido dentro de
// la feria todavía).
function feriaEsFutura(f) {
  return !!f.fechaInicio && toISODate(new Date()) < f.fechaInicio;
}

// Solo por calendario (ya pasó la fecha de fin) — a propósito no mira
// f.cerrada: una feria cerrada a mano mientras sigue en fechas (cierre
// manual anticipado) no debería bajar al grupo de terminadas ni pintarse
// gris, aunque el doble clic ya le muestre el resumen en vez del contador.
function feriaHaTerminado(f) {
  return !!f.fechaFin && toISODate(new Date()) > f.fechaFin;
}

// Punto de entrada único del botón "Registrar conteo"/"Ver resumen" y del
// doble clic/toque sobre la tarjeta: en fechas de feria abre el conteo,
// antes de esas fechas pregunta el plan de stock (total por lote), y ya
// pasada (o cerrada a mano) muestra el resumen.
function handleAbrirFeria(feriaId) {
  const f = ferias.find(x => x.id === feriaId);
  if (!f) return;
  if (feriaEstaEnCurso(f)) openFeriaCounter(feriaId);
  else if (feriaEsFutura(f)) openFeriaStockModal(feriaId);
  else openFeriaResumen(feriaId);
}

// ── Ferias: UI ─────────────────────────────────────────────────────────────────

function fmtDayMonth(iso) {
  if (!iso) return '';
  const d = parseISODate(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function feriaBlockHTML(f) {
  const fechas = (f.fechaInicio && f.fechaFin) ? `${fmtDayMonth(f.fechaInicio)} a ${fmtDayMonth(f.fechaFin)}` : '—';
  const terminada = feriaHaTerminado(f);
  return `
    <div class="feria-block${terminada ? ' feria-block--terminada' : ''}" data-id="${esc(f.id)}">
      <div class="feria-block-row1">
        <div class="feria-block-orglugar">
          <div class="feria-block-title">${esc(f.empresa)}</div>
          <div class="feria-block-meta">📍 ${esc(f.lugar || '—')}</div>
        </div>
        <div class="feria-block-fechas">${fechas}</div>
      </div>
      <div class="feria-block-stats">
        <span class="feria-block-stat-llevados">📦 ${feriaTotalLlevados(f)}</span>
        <span class="feria-block-stat-contados">👥 ${feriaConteoTotal(f)}</span>
        <span class="feria-block-stat-comprados">🛒 ${feriaTotalVendidos(f)}</span>
      </div>
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
  // Las ferias terminadas (o cerradas a mano) se hunden al final, separadas
  // por una línea divisoria, sin reordenar entre sí las que quedan arriba.
  const activas    = ferias.filter(f => !feriaHaTerminado(f));
  const terminadas = ferias.filter(feriaHaTerminado);
  const dividerHTML = terminadas.length
    ? '<div class="feria-list-divider"><span>Ferias terminadas</span></div>'
    : '';
  container.innerHTML = `
    <div class="feria-blocks-grid">${activas.map(feriaBlockHTML).join('')}</div>
    ${dividerHTML}
    <div class="feria-blocks-grid">${terminadas.map(feriaBlockHTML).join('')}</div>`;
  wireFeriaCardActions(container);
  container.querySelectorAll('.feria-block').forEach(block => {
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
    // Solo cuando se cerró a mano ("Terminar feria"): si simplemente ya
    // pasó por calendario, no hay nada que "reabrir".
    document.getElementById('feriaReabrirWrap').style.display = f.cerrada ? '' : 'none';
  } else {
    document.getElementById('feriaModalTitle').textContent    = 'Nueva feria';
    document.getElementById('feriaEmpresa').value             = '';
    document.getElementById('feriaFechaInicio').value         = today;
    document.getElementById('feriaFechaFin').value            = today;
    document.getElementById('feriaPrecio').value               = '';
    document.getElementById('feriaLugar').value                = '';
    document.getElementById('feriaObservaciones').value        = '';
    document.getElementById('feriaReabrirWrap').style.display = 'none';
  }
  updateFeriaFechasTrigger();
  document.getElementById('feriaOverlay').classList.add('open');
  setTimeout(() => document.getElementById('feriaEmpresa').focus(), 100);
}
document.getElementById('btnFeriaReabrir').addEventListener('click', async () => {
  const f = ferias.find(x => x.id === feriaEditId);
  if (!f) return;
  const btn = document.getElementById('btnFeriaReabrir');
  btn.disabled = true;
  try {
    f.cerrada = false;
    await updateFeria(f);
    document.getElementById('feriaReabrirWrap').style.display = 'none';
    renderFerias();
  } catch (e) {
    f.cerrada = true;
    alert('Error al reabrir la feria: ' + e.message);
  } finally {
    btn.disabled = false;
  }
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
        planStock: {}, ventas: [], observacionesDiarias: [], conteoProductos: null,
        conteoMenores30: 0, conteoEntre30y55: 0, conteoMayores55: 0, cerrada: false
      });
    }
    await loadFerias();
    renderFerias();
    // Cierre directo (no confirmCloseIfDirty): ya se guardó, así que
    // "¿Salir sin guardar?" no corresponde acá — el formulario sigue con
    // texto cargado y esa función solo mira si hay contenido, no si está
    // guardado.
    document.getElementById('feriaOverlay').classList.remove('open');
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
  const wrap  = document.getElementById('feriaStockTableWrap');
  const lotes = ejecuciones.filter(ej => (ej.evaluacion?.frascos230 || ej.evaluacion?.frascos180));

  if (!lotes.length) {
    wrap.innerHTML = '<div class="empty-state">No hay lotes con producción registrada en Procesos → Ejecuciones.</div>';
  } else {
    const itemsHTML = lotes.map(ej => {
      const disponible = getStockDisponibleLote(ej.id, feriaId);
      const val = f.planStock[ej.id] || '';
      return `
        <div class="feria-stock-item">
          <div class="feria-stock-sabor">${esc(ej.nombreReceta)}</div>
          <div class="feria-stock-lote">${esc(ej.loteId || ej.id.slice(0, 8))} · Disp. ${disponible}</div>
          <input type="number" min="0" step="1" class="field-input feria-stock-input" data-lote="${esc(ej.id)}" value="${val}" placeholder="Cantidad" />
        </div>`;
    }).join('');
    wrap.innerHTML = `<div class="feria-stock-list">${itemsHTML}</div>`;
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
  document.querySelectorAll('.feria-stock-input').forEach(inp => {
    const ejecucionId = inp.dataset.lote;
    const qty         = parseInt(inp.value) || 0;
    if (qty <= 0) return;
    newPlan[ejecucionId] = qty;
  });

  const excesos = [];
  Object.entries(newPlan).forEach(([ejecucionId, total]) => {
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
  const blockCounterEl = document.querySelector(`.feria-block[data-id="${CSS.escape(f.id)}"] .feria-block-stat-contados`);
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

// Una fila por lote planeado para la feria (planStock, ya no por día) que
// todavía tiene stock disponible (llevado - ya vendido en toda la feria > 0).
// Mismo estilo de grilla que el plan de stock: sabor / lote-disponible /
// cantidad unificada, con un único botón "Guardar" al final (ver
// btnSaveFeriaVenta) en vez de un botón "Agregar" por fila.
function renderFeriaVentaRows(f, fecha) {
  const wrap = document.getElementById('feriaVentaRows');
  document.getElementById('feriaVentaFeedback').textContent = '';
  const plan = f.planStock || {};
  const vendidoTotal = {};
  (f.ventas || []).forEach(v => {
    vendidoTotal[v.ejecucionId] = (vendidoTotal[v.ejecucionId] || 0) + v.cantidad;
  });
  const filas = Object.keys(plan)
    .map(id => ({ id, disponible: (plan[id] || 0) - (vendidoTotal[id] || 0) }))
    .filter(row => row.disponible > 0);

  if (!filas.length) {
    wrap.innerHTML = '<div class="obs-empty">No hay lotes con stock disponible para vender.</div>';
    return;
  }

  const itemsHTML = filas.map(row => {
    const ej     = ejecuciones.find(x => x.id === row.id);
    const nombre = ej ? esc(ej.nombreReceta) : esc(row.id);
    const lote   = ej ? esc(ej.loteId || row.id.slice(0, 8)) : '';
    return `
      <div class="feria-stock-item">
        <div class="feria-stock-sabor">${nombre}</div>
        <div class="feria-stock-lote">${lote} · Disp. ${row.disponible}</div>
        <input type="number" min="0" max="${row.disponible}" step="1" class="field-input feria-stock-input" data-lote="${esc(row.id)}" placeholder="Cantidad" />
      </div>`;
  }).join('');
  wrap.innerHTML = `<div class="feria-stock-list">${itemsHTML}</div>`;
}

document.getElementById('btnSaveFeriaVenta').addEventListener('click', async () => {
  const f  = ferias.find(x => x.id === feriaCounterId);
  const fb = document.getElementById('feriaVentaFeedback');
  if (!f) return;
  const fecha = feriaCounterFecha;

  const plan = f.planStock || {};
  const vendidoTotal = {};
  (f.ventas || []).forEach(v => { vendidoTotal[v.ejecucionId] = (vendidoTotal[v.ejecucionId] || 0) + v.cantidad; });

  const nuevas  = [];
  const excesos = [];
  document.querySelectorAll('#feriaVentaRows .feria-stock-input').forEach(inp => {
    const loteId   = inp.dataset.lote;
    const cantidad = parseInt(inp.value) || 0;
    if (cantidad <= 0) return;
    const ej = ejecuciones.find(x => x.id === loteId);
    const disponible = (plan[loteId] || 0) - (vendidoTotal[loteId] || 0);
    if (cantidad > disponible) {
      excesos.push(`${ej?.nombreReceta || loteId} (pediste ${cantidad}, disponible ${disponible})`);
      return;
    }
    nuevas.push({
      fecha, ejecucionId: loteId, loteId: ej?.loteId || '', recetaId: ej?.recetaId || '',
      recetaNombre: ej?.nombreReceta || '', cantidad, createdAt: new Date().toISOString()
    });
  });

  if (excesos.length) return setFb(fb, `No hay stock suficiente: ${excesos.join('; ')}.`, 'err');
  if (!nuevas.length) return setFb(fb, 'Ingresa al menos una cantidad.', 'err');

  const btn = document.getElementById('btnSaveFeriaVenta');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    f.ventas = [...(f.ventas || []), ...nuevas];
    await updateFeria(f);
    const compradosEl = document.querySelector(`.feria-block[data-id="${CSS.escape(f.id)}"] .feria-block-stat-comprados`);
    if (compradosEl) compradosEl.textContent = `🛒 ${feriaTotalVendidos(f)}`;
    renderFeriaCounterDay();
    document.getElementById('feriaVentaOverlay').classList.remove('open');
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
});

function isFeriaVentaFormDirty() {
  return Array.from(document.querySelectorAll('#feriaVentaRows .feria-stock-input')).some(input => input.value.trim());
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
// Ya no es por día: el plan de stock es un total por lote para toda la
// feria, así que el conteo de productos también se hace una sola vez.
function renderFeriaConteoProductos(f, wrap) {
  const plan = f.planStock || {};
  const ids  = Object.keys(plan).filter(id => plan[id] > 0);

  if (!ids.length) {
    wrap.innerHTML = '<p class="mgmt-note">No hay stock planeado para esta feria.</p>';
    return;
  }

  const existing = f.conteoProductos;
  const rowsHTML = ids.map(id => {
    const ej         = ejecuciones.find(e => e.id === id);
    const label      = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
    const llevados   = plan[id];
    const vendidos   = (f.ventas || []).filter(v => v.ejecucionId === id).reduce((s, v) => s + v.cantidad, 0);
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

  if (existing?.detalle) renderConteoProductosResult(f, wrap);

  wrap.querySelector('[data-conteo-save]').addEventListener('click', async () => {
    const detalle = {};
    ids.forEach(id => {
      const llevados = plan[id];
      const vendidos = (f.ventas || []).filter(v => v.ejecucionId === id).reduce((s, v) => s + v.cantidad, 0);
      const input     = wrap.querySelector(`.feria-sobrante-input[data-lote="${CSS.escape(id)}"]`);
      const sobrantes  = parseInt(input.value) || 0;
      detalle[id] = { llevados, vendidos, sobrantes, descuadre: llevados - vendidos - sobrantes };
    });
    f.conteoProductos = { detalle, revisadoEn: new Date().toISOString() };
    try {
      await updateFeria(f);
      renderConteoProductosResult(f, wrap);
    } catch (e) { alert('Error al guardar: ' + e.message); }
  });
}

function renderConteoProductosResult(f, wrap) {
  const resultEl = wrap.querySelector('[data-conteo-result]');
  const conteo   = f.conteoProductos;
  if (!resultEl || !conteo?.detalle) return;
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

  const plan = f.planStock || {};
  const idsPlan = Object.keys(plan);
  lines.push('', 'Stock llevado a la feria (total):');
  if (idsPlan.length) {
    idsPlan.forEach(id => {
      const ej = ejecuciones.find(e => e.id === id);
      const label = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
      lines.push(`  - ${label}: ${plan[id]} unidades`);
    });
  } else {
    lines.push('  Sin stock planeado.');
  }
  if (f.conteoProductos?.detalle) {
    lines.push('', 'Conteo de productos:');
    Object.entries(f.conteoProductos.detalle).forEach(([id, d]) => {
      const ej = ejecuciones.find(e => e.id === id);
      const label = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
      lines.push(`  - ${label}: llevados ${d.llevados}, vendidos ${d.vendidos}, sobrantes ${d.sobrantes}${d.descuadre !== 0 ? ` ⚠️ descuadre ${d.descuadre}` : ''}`);
    });
  }

  getFeriaDateList(f).forEach(fecha => {
    lines.push('', `── DÍA ${fecha} ─────────────────────────────────────────`);
    const ventasDia = (f.ventas || []).filter(v => v.fecha === fecha);
    if (ventasDia.length) {
      lines.push('Ventas:');
      ventasDia.forEach(v => lines.push(`  - ${v.recetaNombre}${v.loteId ? ` — Lote ${v.loteId}` : ''}: ${v.cantidad}`));
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
  conteoWrap.innerHTML = `
    <div class="feria-section">
      <h4 class="feria-section-title">Conteo de productos</h4>
      <div data-conteo-productos></div>
    </div>`;
  renderFeriaConteoProductos(f, conteoWrap.querySelector('[data-conteo-productos]'));

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

