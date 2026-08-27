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

// ── Canales de venta (Ferias es uno más) ──────────────────────────────────────
let canales              = [];
let canalesSheetId       = null;
let currentCanalId       = null; // null = galería de canales; string = dentro de un canal
let creatingNewCanal     = false;
let draggedCanalId       = null;

const CANAL_HUES = [355, 25, 45, 95, 165, 200, 230, 280];

// Convierte "#RRGGBB" (o "#RGB") a rgba(...) con la opacidad dada — mismo
// helper que usa Procesos para el color pastel de las tarjetas de grupo.
function hexToRgba(hex, alpha) {
  const h    = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return null;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

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
    const headerData = await sheetsReq('/values/Ferias!A1:X1').catch(() => ({}));
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
    if (headerRow.length < 23) {
      await sheetsReq('/values/Ferias!W1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [[ 'Muestras' ]] })
      });
    }
    if (headerRow.length < 24) {
      await sheetsReq('/values/Ferias!X1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [[ 'CanalId' ]] })
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
        'ConteoMenores30','ConteoEntre30y55','ConteoMayores55','Cerrada','Muestras','CanalId'
      ]] })
    });
  }

  await initCanalesVentaSheet();
  await loadCanales();

  // El canal "Ferias" se crea una sola vez (la primera vez que corre este
  // código sobre una base ya existente) — ahí van a parar las ferias que
  // ya estaban cargadas antes de que existieran los canales (ver backfill
  // de CanalId más abajo).
  let feriaCanal = canales.find(c => c.nombre === 'Ferias');
  if (!feriaCanal) {
    await appendCanal({ id: crypto.randomUUID(), nombre: 'Ferias', color: '#714B67', icono: '🎪', creadoEn: new Date().toISOString() });
    await loadCanales();
    feriaCanal = canales.find(c => c.nombre === 'Ferias');
  }

  await loadFerias();
  // Idempotente: solo toca las filas que todavía no tienen CanalId — una
  // vez migradas, las siguientes cargas de la app no vuelven a escribirlas.
  const sinCanal = ferias.filter(f => !f.canalId);
  for (const f of sinCanal) {
    f.canalId = feriaCanal.id;
    await updateFeria(f);
  }
}

// ── Canales de venta: Sheets init + CRUD ──────────────────────────────────────
// Mismo layout/patrón que RecetaBlocks en procesos.js.

async function initCanalesVentaSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasC = tabs.find(s => s.properties.title === 'CanalesVenta');
  if (hasC) {
    canalesSheetId = hasC.properties.sheetId;
    return;
  }
  const res = await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'CanalesVenta' } } }] })
  });
  const added = res.replies?.[0]?.addSheet?.properties;
  if (added) canalesSheetId = added.sheetId;
  await sheetsReq('/values/CanalesVenta!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [['ID','Nombre','CreadoEn','SortOrder','Color','Icono']] })
  });
}

export async function loadCanales() {
  const data = await sheetsReq('/values/CanalesVenta!A:F');
  const rows = (data.values || []).slice(1);
  canales = rows.filter(r => r[0]).map((r, i) => ({
    id:        r[0] || '',
    nombre:    r[1] || '',
    creadoEn:  r[2] || '',
    sortOrder: r[3] !== undefined && r[3] !== '' ? +r[3] : i,
    color:     r[4] || '',
    icono:     r[5] || '',
    rowIndex:  i + 2
  }));
  canales.sort((a, b) => a.sortOrder - b.sortOrder);
}

async function appendCanal(canal) {
  const sortOrder = canales.length;
  await sheetsReq('/values/CanalesVenta!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[canal.id, canal.nombre, canal.creadoEn, sortOrder, canal.color || '', canal.icono || '']] })
  });
}

async function updateCanal(canal) {
  await sheetsReq(`/values/CanalesVenta!A${canal.rowIndex}:F${canal.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[canal.id, canal.nombre, canal.creadoEn, canal.sortOrder ?? 0, canal.color || '', canal.icono || '']] })
  });
}

async function deleteCanalRow(rowIndex) {
  if (!canalesSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'CanalesVenta');
    if (tab) canalesSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: canalesSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
}

// A diferencia de los grupos de recetas, acá no hay un "sin canal" al que
// reasignar — si el canal tiene ferias/ventas cargadas, no se borra.
async function deleteCanal(canalId) {
  const canal = canales.find(c => c.id === canalId);
  if (!canal) return;
  if (ferias.some(f => f.canalId === canalId)) {
    throw new Error(`Este canal tiene registros cargados — no se puede eliminar.`);
  }
  await deleteCanalRow(canal.rowIndex);
  await loadCanales();
}

export async function loadFerias() {
  const data = await sheetsReq('/values/Ferias!A:X');
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
    muestras:             safeParseJSON(r[22], []),
    canalId:              r[23] || '',
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

// Ventas + muestras ya entregadas, por lote — ambas salen del mismo stock
// físico llevado, así que la disponibilidad para registrar cualquiera de
// las dos tiene que descontar las dos juntas (si no, se podría "vender"
// stock que ya se regaló como muestra, o al revés).
function getFeriaSalidaTotal(f) {
  const total = {};
  (f.ventas || []).forEach(v => { total[v.ejecucionId] = (total[v.ejecucionId] || 0) + v.cantidad; });
  (f.muestras || []).forEach(m => { total[m.ejecucionId] = (total[m.ejecucionId] || 0) + m.cantidad; });
  return total;
}

function feriaRowValues(f) {
  return [
    f.id, f.empresa, f.fechaInicio, f.fechaFin, f.precio, f.fechaImportante, f.lugar,
    f.observaciones || '', f.alineacion || 0, f.estado || 'disponible', f.conteoPersonas || 0,
    f.creadoEn || new Date().toISOString(),
    f.horaInicio || '', f.horaFin || '', JSON.stringify(f.planStock || {}), JSON.stringify(f.ventas || []),
    JSON.stringify(f.observacionesDiarias || []), JSON.stringify(f.conteoProductos || {}),
    f.conteoMenores30 || 0, f.conteoEntre30y55 || 0, f.conteoMayores55 || 0,
    f.cerrada ? 'TRUE' : 'FALSE', JSON.stringify(f.muestras || []), f.canalId || ''
  ];
}

async function appendFeria(f) {
  await sheetsReq('/values/Ferias!A:X:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [feriaRowValues(f)] })
  });
}

async function updateFeria(f) {
  await sheetsReq(`/values/Ferias!A${f.rowIndex}:X${f.rowIndex}?valueInputOption=RAW`, {
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

// Punto de entrada de #feriasList: galería de canales si no se entró a
// ninguno, o la lista de ferias de ese canal (filtrada) si sí.
export function renderFerias() {
  const container = document.getElementById('feriasList');
  if (!container) return;
  const titleEl  = document.getElementById('feriasSectionTitle');
  const btnCanal = document.getElementById('btnNewCanal');
  const btnFeria = document.getElementById('btnNewFeria');

  if (currentCanalId == null) {
    if (titleEl)  titleEl.textContent = 'Canales de venta';
    if (btnCanal) btnCanal.style.display = '';
    if (btnFeria) btnFeria.style.display = 'none';
    renderCanalesGallery(container);
    return;
  }

  const canal = canales.find(c => c.id === currentCanalId);
  if (!canal) { currentCanalId = null; renderFerias(); return; }
  if (titleEl)  titleEl.textContent = canal.nombre;
  if (btnCanal) btnCanal.style.display = 'none';
  if (btnFeria) btnFeria.style.display = '';
  renderFeriaListForCanal(container, currentCanalId);
}

function renderFeriaListForCanal(container, canalId) {
  const feriasCanal = ferias.filter(f => f.canalId === canalId);
  if (!feriasCanal.length) {
    container.innerHTML = '<div class="empty-state">No hay ferias en este canal. Agrega la primera con "+ Nueva feria".</div>';
    return;
  }
  // Las ferias terminadas (o cerradas a mano) se hunden al final, separadas
  // por una línea divisoria, sin reordenar entre sí las que quedan arriba.
  const activas    = feriasCanal.filter(f => !feriaHaTerminado(f));
  const terminadas = feriasCanal.filter(feriaHaTerminado);
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

// ── Canales de venta: galería (pantalla principal de Ventas) ─────────────────
// Mismo patrón visual y de interacción que la galería de grupos de recetas
// en Procesos: tarjetas 4:5, long-press = Editar/Borrar, doble clic/doble
// toque = entrar, crear/editar in-place con ícono+nombre+color.

function canalColorStyle(canal, idx) {
  const customBg = canal.color ? hexToRgba(canal.color, .14) : null;
  const hue = !customBg ? CANAL_HUES[idx % CANAL_HUES.length] : null;
  const bg  = customBg || (hue != null ? `hsl(${hue} 70% 55% / .12)` : null);
  const borderColor = canal.color ? `${canal.color}55` : (hue != null ? `hsl(${hue} 70% 45% / .35)` : 'var(--border)');
  return { bg, borderColor };
}

function renderCanalesGallery(container) {
  if (!canales.length && !creatingNewCanal) {
    container.innerHTML = '<div class="empty-state">No hay canales de venta. Agrega el primero con "+ Nuevo canal".</div>';
    return;
  }

  const cardsHTML = canales.map((canal, idx) => {
    const { bg, borderColor } = canalColorStyle(canal, idx);
    return `
      <div class="canal-venta-card" data-canal-id="${esc(canal.id)}" draggable="true" style="${bg ? `background:${bg};` : ''}border-color:${borderColor}">
        <div class="canal-venta-card-icon">${esc(canal.icono || '🏪')}</div>
        <div class="canal-venta-card-name">${esc(canal.nombre)}</div>
        <div class="canal-venta-card-actions">
          <button type="button" data-edit-canal="${esc(canal.id)}">Editar</button>
          <button type="button" data-del-canal="${esc(canal.id)}">Borrar</button>
        </div>
      </div>`;
  }).join('');

  const newFormHTML = creatingNewCanal ? `
    <div class="canal-venta-card canal-venta-card--form" data-new-canal-form>
      <div class="receta-group-new-row">
        <input type="text" class="receta-group-new-icon" placeholder="🏪" maxlength="4" />
        <input type="text" class="receta-group-new-name" placeholder="Nombre del canal…" maxlength="40" />
      </div>
      <input type="color" class="receta-group-new-color" value="#714B67" />
      <div class="receta-group-new-actions">
        <button type="button" class="btn-primary" data-confirm-new-canal>Crear</button>
        <button type="button" class="btn-outline" data-cancel-new-canal>Cancelar</button>
      </div>
      <div class="feedback" data-new-canal-feedback></div>
    </div>` : '';

  container.innerHTML = `<div class="canales-venta-grid">${newFormHTML}${cardsHTML}</div>`;

  if (creatingNewCanal) {
    const formEl    = container.querySelector('[data-new-canal-form]');
    const nameInput = formEl.querySelector('.receta-group-new-name');
    nameInput.focus();
    formEl.querySelector('[data-cancel-new-canal]').addEventListener('click', () => {
      creatingNewCanal = false;
      renderFerias();
    });
    const confirmNewCanal = async () => {
      const nombre = nameInput.value.trim();
      const icono  = formEl.querySelector('.receta-group-new-icon').value.trim();
      const color  = formEl.querySelector('.receta-group-new-color').value;
      const fb     = formEl.querySelector('[data-new-canal-feedback]');
      if (!nombre) return setFb(fb, 'Ponele un nombre al canal.', 'err');
      if (canales.find(c => c.nombre.toLowerCase() === nombre.toLowerCase()))
        return setFb(fb, 'Ya existe un canal con ese nombre.', 'err');
      const btn = formEl.querySelector('[data-confirm-new-canal]');
      btn.disabled = true;
      try {
        await appendCanal({ id: crypto.randomUUID(), nombre, color, icono, creadoEn: new Date().toISOString() });
        await loadCanales();
        creatingNewCanal = false;
        renderFerias();
      } catch (e) { setFb(fb, 'Error: ' + e.message, 'err'); btn.disabled = false; }
    };
    formEl.querySelector('[data-confirm-new-canal]').addEventListener('click', confirmNewCanal);
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); confirmNewCanal(); }
      if (e.key === 'Escape') { e.preventDefault(); creatingNewCanal = false; renderFerias(); }
    });
  }

  container.querySelectorAll('[data-del-canal]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const canal = canales.find(c => c.id === btn.dataset.delCanal);
      if (!canal) return;
      if (!confirm(`¿Eliminar el canal "${canal.nombre}"?`)) return;
      btn.disabled = true;
      try {
        await deleteCanal(canal.id);
        renderFerias();
      } catch (err) { alert(err.message); btn.disabled = false; }
    });
  });

  container.querySelectorAll('[data-edit-canal]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const canal = canales.find(c => c.id === btn.dataset.editCanal);
      if (!canal) return;
      const card = btn.closest('.canal-venta-card');
      card.outerHTML = `
        <div class="canal-venta-card canal-venta-card--form" data-editing-canal="${esc(canal.id)}">
          <div class="receta-group-new-row">
            <input type="text" class="receta-group-new-icon" value="${esc(canal.icono || '')}" placeholder="🏪" maxlength="4" />
            <input type="text" class="receta-group-new-name" value="${esc(canal.nombre)}" placeholder="Nombre del canal…" maxlength="40" />
          </div>
          <input type="color" class="receta-group-new-color" value="${esc(canal.color || '#714B67')}" />
          <div class="receta-group-new-actions">
            <button type="button" class="btn-primary" data-confirm-edit-canal>Guardar</button>
            <button type="button" class="btn-outline" data-cancel-edit-canal>Cancelar</button>
          </div>
          <div class="feedback" data-edit-canal-feedback></div>
        </div>`;
      const formEl    = container.querySelector(`[data-editing-canal="${CSS.escape(canal.id)}"]`);
      const nameInput = formEl.querySelector('.receta-group-new-name');
      nameInput.focus();
      formEl.querySelector('[data-cancel-edit-canal]').addEventListener('click', () => renderFerias());
      const confirmEdit = async () => {
        const nombre = nameInput.value.trim();
        const icono  = formEl.querySelector('.receta-group-new-icon').value.trim();
        const color  = formEl.querySelector('.receta-group-new-color').value;
        const fb     = formEl.querySelector('[data-edit-canal-feedback]');
        if (!nombre) return setFb(fb, 'Ponele un nombre al canal.', 'err');
        const dup = canales.find(c => c.id !== canal.id && c.nombre.toLowerCase() === nombre.toLowerCase());
        if (dup) return setFb(fb, 'Ya existe un canal con ese nombre.', 'err');
        const saveBtn = formEl.querySelector('[data-confirm-edit-canal]');
        saveBtn.disabled = true;
        try {
          await updateCanal({ ...canal, nombre, color, icono });
          await loadCanales();
          renderFerias();
        } catch (err) { setFb(fb, 'Error: ' + err.message, 'err'); saveBtn.disabled = false; }
      };
      formEl.querySelector('[data-confirm-edit-canal]').addEventListener('click', confirmEdit);
      nameInput.addEventListener('keydown', e2 => {
        if (e2.key === 'Enter')  { e2.preventDefault(); confirmEdit(); }
        if (e2.key === 'Escape') { e2.preventDefault(); renderFerias(); }
      });
    });
  });

  wireCanalCardPress(container);

  // Reordenar canales arrastrando las tarjetas — mismo criterio que los
  // grupos de recetas (sortOrder guardado en CanalesVenta).
  container.querySelectorAll('.canal-venta-card[draggable="true"]').forEach(card => {
    const canalId = card.dataset.canalId;
    card.addEventListener('dragstart', e => {
      draggedCanalId = canalId;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      container.querySelectorAll('.canal-venta-card.block-drag-over').forEach(el => el.classList.remove('block-drag-over'));
      draggedCanalId = null;
    });
    card.addEventListener('dragover', e => {
      if (!draggedCanalId || draggedCanalId === canalId) return;
      e.preventDefault();
      card.classList.add('block-drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('block-drag-over'));
    card.addEventListener('drop', async e => {
      if (!draggedCanalId || draggedCanalId === canalId) return;
      e.preventDefault();
      card.classList.remove('block-drag-over');
      const fromIdx = canales.findIndex(c => c.id === draggedCanalId);
      const toIdx   = canales.findIndex(c => c.id === canalId);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = canales.splice(fromIdx, 1);
      canales.splice(toIdx, 0, moved);
      canales.forEach((c, i) => { c.sortOrder = i; });
      renderFerias();
      try { await Promise.all(canales.map(updateCanal)); }
      catch (err) { alert('Error al guardar el orden: ' + err.message); await loadCanales(); renderFerias(); }
    });
  });
}

// Mantener presionada una tarjeta de canal muestra el panel Editar/Borrar
// montado sobre ella; doble clic/doble toque entra al canal. Un clic
// normal no hace nada (mismo criterio que los grupos de recetas).
function wireCanalCardPress(container) {
  container.querySelectorAll('.canal-venta-card[data-canal-id]').forEach(card => {
    const canalId = card.dataset.canalId;
    let pressTimer  = null;
    let longPressed = false;

    const openCardActions = () => {
      container.querySelectorAll('.canal-venta-card-actions.open').forEach(a => a.classList.remove('open'));
      card.querySelector('.canal-venta-card-actions')?.classList.add('open');
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

    const enterCanal = () => {
      currentCanalId = canalId;
      // Sin botón "Volver" en pantalla — se sale del canal con el gesto
      // nativo de deslizar desde el borde (o el botón atrás), que necesita
      // esta entrada de historial para tener a dónde volver (ver popstate).
      history.pushState({ view: 'ferias', canalDrill: true }, '', location.hash || '#ferias');
      renderFerias();
    };

    card.addEventListener('click', e => { if (longPressed) longPressed = false; });
    card.addEventListener('dblclick', e => {
      if (longPressed || e.target.closest('button')) return;
      enterCanal();
    });
    card.addEventListener('touchend', e => {
      if (longPressed) { longPressed = false; return; }
      if (e.target.closest('button') || wasAccidentalTouch()) return;
      const now = Date.now();
      const last = lastTapTime['canal_' + canalId] || 0;
      lastTapTime['canal_' + canalId] = now;
      if (now - last < 350) enterCanal();
    });
  });
}

// Clic afuera cierra el panel Editar/Borrar abierto — registrado una sola
// vez a nivel de módulo (si fuera dentro de wireCanalCardPress quedaría un
// listener nuevo apilado en cada re-render de la galería).
document.addEventListener('click', () => {
  document.querySelectorAll('.canal-venta-card-actions.open').forEach(a => a.classList.remove('open'));
});

// Sin botón "Volver" en pantalla: salir de un canal depende del gesto
// nativo de deslizar/atrás del navegador, que dispara esto.
window.addEventListener('popstate', () => {
  if (currentCanalId != null) {
    currentCanalId = null;
    renderFerias();
  }
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
document.getElementById('btnNewCanal').addEventListener('click', () => {
  creatingNewCanal = true;
  renderFerias();
});

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
  // Defensa contra el atajo "+ Nueva feria" de la paleta de comandos, que
  // puede llegar a este modal sin haber entrado antes a ningún canal.
  if (!feriaEditId && !currentCanalId) return setFb(fb, 'Entra a un canal de venta antes de crear una feria.', 'err');

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
        conteoMenores30: 0, conteoEntre30y55: 0, conteoMayores55: 0, cerrada: false, muestras: [],
        canalId: currentCanalId || ''
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
  renderFeriaVentaRows(f);
  renderFeriaMuestraRows(f);
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

// Una fila por lote planeado para la feria (planStock, ya no por día) que
// todavía tiene stock disponible (llevado - ya salido en ventas+muestras
// de toda la feria > 0). Mismo componente para "Registrar venta" y
// "Registrar muestra" — misma grilla que el plan de stock (sabor /
// lote-disponible / cantidad con contador +/-), cada uno con su propio
// botón "Guardar" que vuelca a f.ventas o f.muestras según corresponda.
function renderFeriaSalidaRows(f, rowsId, feedbackId) {
  const wrap = document.getElementById(rowsId);
  document.getElementById(feedbackId).textContent = '';
  const plan = f.planStock || {};
  const salidaTotal = getFeriaSalidaTotal(f);
  const filas = Object.keys(plan)
    .map(id => ({ id, disponible: (plan[id] || 0) - (salidaTotal[id] || 0) }))
    .filter(row => row.disponible > 0);

  if (!filas.length) {
    wrap.innerHTML = '<div class="obs-empty">No hay lotes con stock disponible.</div>';
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
        <div class="feria-venta-stepper" data-lote="${esc(row.id)}" data-max="${row.disponible}">
          <button type="button" class="feria-venta-stepper-btn" data-dir="-1" disabled>−</button>
          <span class="feria-venta-stepper-value">0</span>
          <button type="button" class="feria-venta-stepper-btn" data-dir="1">+</button>
        </div>
      </div>`;
  }).join('');
  wrap.innerHTML = `<div class="feria-stock-list">${itemsHTML}</div>`;

  wrap.querySelectorAll('.feria-venta-stepper-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const stepper = btn.closest('.feria-venta-stepper');
      const max     = parseInt(stepper.dataset.max) || 0;
      const valueEl = stepper.querySelector('.feria-venta-stepper-value');
      const nuevo   = Math.max(0, Math.min(max, (parseInt(valueEl.textContent) || 0) + parseInt(btn.dataset.dir)));
      valueEl.textContent = nuevo;
      stepper.querySelector('[data-dir="-1"]').disabled = nuevo <= 0;
      stepper.querySelector('[data-dir="1"]').disabled  = nuevo >= max;
    });
  });
}

function renderFeriaVentaRows(f)   { renderFeriaSalidaRows(f, 'feriaVentaRows', 'feriaVentaFeedback'); }
function renderFeriaMuestraRows(f) { renderFeriaSalidaRows(f, 'feriaMuestraRows', 'feriaMuestraFeedback'); }

// arrField: 'ventas' o 'muestras' — a cuál de los dos arreglos se agregan
// las cantidades cargadas en rowsId.
function wireFeriaSalidaSave(btnId, rowsId, feedbackId, overlayId, arrField) {
  document.getElementById(btnId).addEventListener('click', async () => {
    const f  = ferias.find(x => x.id === feriaCounterId);
    const fb = document.getElementById(feedbackId);
    if (!f) return;
    const fecha = feriaCounterFecha;

    const plan = f.planStock || {};
    const salidaTotal = getFeriaSalidaTotal(f);

    const nuevas  = [];
    const excesos = [];
    document.querySelectorAll(`#${rowsId} .feria-venta-stepper`).forEach(stepper => {
      const loteId   = stepper.dataset.lote;
      const cantidad = parseInt(stepper.querySelector('.feria-venta-stepper-value').textContent) || 0;
      if (cantidad <= 0) return;
      const ej = ejecuciones.find(x => x.id === loteId);
      const disponible = (plan[loteId] || 0) - (salidaTotal[loteId] || 0);
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

    const btn = document.getElementById(btnId);
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      f[arrField] = [...(f[arrField] || []), ...nuevas];
      await updateFeria(f);
      if (arrField === 'ventas') {
        const compradosEl = document.querySelector(`.feria-block[data-id="${CSS.escape(f.id)}"] .feria-block-stat-comprados`);
        if (compradosEl) compradosEl.textContent = `🛒 ${feriaTotalVendidos(f)}`;
      }
      renderFeriaCounterDay();
      document.getElementById(overlayId).classList.remove('open');
    } catch (e) {
      setFb(fb, 'Error: ' + e.message, 'err');
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  });
}
wireFeriaSalidaSave('btnSaveFeriaVenta', 'feriaVentaRows', 'feriaVentaFeedback', 'feriaVentaOverlay', 'ventas');
wireFeriaSalidaSave('btnSaveFeriaMuestra', 'feriaMuestraRows', 'feriaMuestraFeedback', 'feriaMuestraOverlay', 'muestras');

function wireFeriaSalidaModal(openBtnId, closeBtnId, overlayId, rowsId) {
  const isDirty = () => Array.from(document.querySelectorAll(`#${rowsId} .feria-venta-stepper-value`)).some(v => (parseInt(v.textContent) || 0) > 0);
  const closeModal = () => confirmCloseIfDirty(overlayId, isDirty);
  document.getElementById(openBtnId).addEventListener('click', () => {
    // Contadores siempre en 0 al abrir: cada venta/muestra se registra
    // desde cero, sin arrastrar lo que haya quedado de una apertura
    // anterior que se cerró sin guardar.
    renderFeriaCounterDay();
    document.getElementById(overlayId).classList.add('open');
  });
  document.getElementById(closeBtnId).addEventListener('click', closeModal);
  document.getElementById(overlayId).addEventListener('click', e => {
    if (e.target === document.getElementById(overlayId)) closeModal();
  });
}
wireFeriaSalidaModal('btnOpenFeriaVenta', 'btnCloseFeriaVenta', 'feriaVentaOverlay', 'feriaVentaRows');
wireFeriaSalidaModal('btnOpenFeriaMuestra', 'btnCloseFeriaMuestra', 'feriaMuestraOverlay', 'feriaMuestraRows');

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
// Sobrantes ya no se pregunta a mano: sale de llevados - vendidos - muestras,
// que es toda la salida de stock que la app ya registra. Si da negativo (se
// vendió/regaló más de lo que se llevó) algo quedó mal registrado — se avisa.
function renderFeriaConteoProductos(f, wrap) {
  const plan = f.planStock || {};
  const ids  = Object.keys(plan).filter(id => plan[id] > 0);

  if (!ids.length) {
    wrap.innerHTML = '<p class="mgmt-note">No hay stock planeado para esta feria.</p>';
    return;
  }

  let hayNegativos = false;
  const rowsHTML = ids.map(id => {
    const ej       = ejecuciones.find(e => e.id === id);
    const label    = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
    const llevados = plan[id];
    const vendidos = (f.ventas   || []).filter(v => v.ejecucionId === id).reduce((s, v) => s + v.cantidad, 0);
    const muestras = (f.muestras || []).filter(m => m.ejecucionId === id).reduce((s, m) => s + m.cantidad, 0);
    const sobrantes = llevados - vendidos - muestras;
    if (sobrantes < 0) hayNegativos = true;
    return `
      <tr>
        <td>${esc(label)}</td>
        <td>${llevados}</td>
        <td>${vendidos}</td>
        <td>${muestras}</td>
        <td>${sobrantes}</td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table class="tasks-table">
      <thead><tr><th>Lote</th><th>Llevados</th><th>Vendidos</th><th>Muestras</th><th>Sobrantes</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
    ${hayNegativos ? '<div class="eval-insumos-total eval-costo-warn" style="margin-top:8px">⚠️ Hay lotes con más vendido + regalado que lo llevado — revisa el registro de ventas/muestras.</div>' : ''}
  `;
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
  if (idsPlan.length) {
    lines.push('', 'Conteo de productos (llevados - vendidos - muestras):');
    idsPlan.forEach(id => {
      const ej = ejecuciones.find(e => e.id === id);
      const label = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
      const llevados = plan[id];
      const vendidos = (f.ventas   || []).filter(v => v.ejecucionId === id).reduce((s, v) => s + v.cantidad, 0);
      const muestras = (f.muestras || []).filter(m => m.ejecucionId === id).reduce((s, m) => s + m.cantidad, 0);
      const sobrantes = llevados - vendidos - muestras;
      lines.push(`  - ${label}: llevados ${llevados}, vendidos ${vendidos}, muestras ${muestras}, sobrantes ${sobrantes}${sobrantes < 0 ? ' ⚠️' : ''}`);
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

