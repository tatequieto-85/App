import { sheetsReq } from './auth.js';
import { esc, setFb, fmtDate, fmtDateShortEs, toISODate, addDays, ICON_TRASH } from './utils.js';
import { openCalendarPopover, getDueStatus } from './tareas.js';
import { ejecuciones, recetas, getStockProducido } from './procesos.js';
import { ferias, getStockComprometido, getStockComprometidoLote, getStockVendidoLote } from './ferias.js';

export let stockTestigos        = [];
let stockMovimientos            = [];
let stockTestigosSheetId        = null;
let stockMovimientosSheetId     = null;
let currentStockTab             = 'resumen';
let stockTestigoLoteId          = null;

// ── Stock: Sheets init + CRUD ────────────────────────────────────────────────

export async function initStockSheets() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasT = tabs.find(s => s.properties.title === 'StockTestigo');
  const hasM = tabs.find(s => s.properties.title === 'StockMovimientos');

  const reqs = [];
  if (!hasT) reqs.push({ addSheet: { properties: { title: 'StockTestigo' } } });
  if (!hasM) reqs.push({ addSheet: { properties: { title: 'StockMovimientos' } } });

  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: reqs }) });
    (res.replies || []).forEach(r => {
      if (r.addSheet?.properties?.title === 'StockTestigo')      stockTestigosSheetId     = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'StockMovimientos')  stockMovimientosSheetId  = r.addSheet.properties.sheetId;
    });
  }
  if (hasT) stockTestigosSheetId    = hasT.properties.sheetId;
  if (hasM) stockMovimientosSheetId = hasM.properties.sheetId;

  const td = await sheetsReq('/values/StockTestigo!A1').catch(() => ({}));
  if (!td.values) {
    await sheetsReq('/values/StockTestigo!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [[
        'ID','EjecucionId','RecetaId','RecetaNombre','LoteId','Cantidad','FechaApartado',
        'FechaRevision','Ubicacion','Estado','Observaciones','CreadoEn'
      ]] })
    });
  }
  const md = await sheetsReq('/values/StockMovimientos!A1').catch(() => ({}));
  if (!md.values) {
    await sheetsReq('/values/StockMovimientos!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID','RecetaId','RecetaNombre','Tipo','Cantidad','Motivo','Fecha','CreadoEn']] })
    });
  }

  await loadStockTestigos();
  await loadStockMovimientos();
}

export async function loadStockTestigos() {
  const data = await sheetsReq('/values/StockTestigo!A:L');
  const rows = (data.values || []).slice(1);
  stockTestigos = rows.filter(r => r[0]).map((r, i) => ({
    id:             r[0]  || '',
    ejecucionId:    r[1]  || '',
    recetaId:       r[2]  || '',
    recetaNombre:   r[3]  || '',
    loteId:         r[4]  || '',
    cantidad:       parseInt(r[5]) || 0,
    fechaApartado:  r[6]  || '',
    fechaRevision:  r[7]  || '',
    ubicacion:      r[8]  || '',
    estado:         r[9]  || 'en_resguardo',
    observaciones:  r[10] || '',
    creadoEn:       r[11] || '',
    rowIndex:       i + 2
  }));
}

function stockTestigoRowValues(t) {
  return [
    t.id, t.ejecucionId, t.recetaId, t.recetaNombre, t.loteId, t.cantidad, t.fechaApartado,
    t.fechaRevision, t.ubicacion || '', t.estado || 'en_resguardo', t.observaciones || '',
    t.creadoEn || new Date().toISOString()
  ];
}

async function appendStockTestigo(t) {
  await sheetsReq('/values/StockTestigo!A:L:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [stockTestigoRowValues(t)] })
  });
}

async function updateStockTestigo(t) {
  await sheetsReq(`/values/StockTestigo!A${t.rowIndex}:L${t.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [stockTestigoRowValues(t)] })
  });
}

async function deleteStockTestigoRow(rowIndex) {
  if (!stockTestigosSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'StockTestigo');
    if (tab) stockTestigosSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: stockTestigosSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
}

export async function loadStockMovimientos() {
  const data = await sheetsReq('/values/StockMovimientos!A:H');
  const rows = (data.values || []).slice(1);
  stockMovimientos = rows.filter(r => r[0]).map((r, i) => ({
    id:           r[0] || '',
    recetaId:     r[1] || '',
    recetaNombre: r[2] || '',
    tipo:         r[3] || 'salida',
    cantidad:     parseInt(r[4]) || 0,
    motivo:       r[5] || '',
    fecha:        r[6] || '',
    creadoEn:     r[7] || '',
    rowIndex:     i + 2
  }));
}

async function appendStockMovimiento(m) {
  await sheetsReq('/values/StockMovimientos!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), m.recetaId, m.recetaNombre, m.tipo, m.cantidad, m.motivo, m.fecha,
      new Date().toISOString()
    ]]})
  });
}

async function deleteStockMovimientoRow(rowIndex) {
  if (!stockMovimientosSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'StockMovimientos');
    if (tab) stockMovimientosSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: stockMovimientosSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
}

// ── Stock: cálculo de inventario (siempre derivado, nunca editable a mano) ───

function getStockVendido(recetaId) {
  return ferias.reduce((sum, f) =>
    sum + (f.ventas || []).filter(v => v.recetaId === recetaId).reduce((s, v) => s + v.cantidad, 0)
  , 0);
}

function getStockTestigoTotal(recetaId) {
  return stockTestigos
    .filter(t => t.recetaId === recetaId)
    .reduce((sum, t) => sum + (t.cantidad || 0), 0);
}

function getStockAjustesNetos(recetaId) {
  return stockMovimientos
    .filter(m => m.recetaId === recetaId)
    .reduce((sum, m) => sum + (m.tipo === 'entrada' ? m.cantidad : -m.cantidad), 0);
}

function getStockDisponibleGeneral(recetaId) {
  return getStockProducido(recetaId)
    - getStockComprometido(recetaId, null)
    - getStockTestigoTotal(recetaId)
    + getStockAjustesNetos(recetaId);
}

function getStockResumen(recetaId) {
  return {
    producido:    getStockProducido(recetaId),
    comprometido: getStockComprometido(recetaId, null),
    vendido:      getStockVendido(recetaId),
    testigo:      getStockTestigoTotal(recetaId),
    ajustes:      getStockAjustesNetos(recetaId),
    disponible:   getStockDisponibleGeneral(recetaId)
  };
}

function getLoteResumen(ejecucionId) {
  const ej = ejecuciones.find(e => e.id === ejecucionId);
  if (!ej) return null;
  const ev          = ej.evaluacion || {};
  const producido   = (ev.frascos230 || 0) + (ev.frascos180 || 0);
  const testigo     = stockTestigos
    .filter(t => t.ejecucionId === ejecucionId)
    .reduce((sum, t) => sum + (t.cantidad || 0), 0);
  const comprometido = getStockComprometidoLote(ejecucionId, null);
  const vendido       = getStockVendidoLote(ejecucionId);
  return {
    producido, testigo, comprometido, vendido,
    disponible: producido - testigo - comprometido
  };
}

// ── Stock: UI ─────────────────────────────────────────────────────────────────

document.querySelectorAll('[data-stocktab]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentStockTab = btn.dataset.stocktab;
    document.querySelectorAll('[data-stocktab]').forEach(b =>
      b.classList.toggle('active', b.dataset.stocktab === currentStockTab)
    );
    document.getElementById('subTabStockResumen').style.display      = currentStockTab === 'resumen'      ? '' : 'none';
    document.getElementById('subTabStockTrazabilidad').style.display = currentStockTab === 'trazabilidad' ? '' : 'none';
    document.getElementById('subTabStockTestigo').style.display      = currentStockTab === 'testigo'      ? '' : 'none';
    document.getElementById('btnNewStockAjuste').style.display  = currentStockTab === 'resumen' ? '' : 'none';
    document.getElementById('btnNewStockTestigo').style.display = currentStockTab === 'testigo' ? '' : 'none';
  });
});

export function renderStockResumen() {
  const container = document.getElementById('stockResumenList');
  if (!container) return;
  if (!recetas.length) {
    container.innerHTML = '<div class="empty-state">No hay recetas registradas en Procesos.</div>';
    return;
  }
  const rows = recetas.map(r => {
    const s = getStockResumen(r.id);
    return `
      <tr>
        <td>${esc(r.nombre)}</td>
        <td>${s.producido}</td>
        <td>${s.comprometido}</td>
        <td>${s.vendido}</td>
        <td>${s.testigo}</td>
        <td>${s.ajustes >= 0 ? '+' : ''}${s.ajustes}</td>
        <td class="stock-disponible-cell${s.disponible < 0 ? ' stock-disponible-neg' : ''}">${s.disponible}</td>
      </tr>`;
  }).join('');
  container.innerHTML = `
    <table class="tasks-table">
      <thead><tr><th>Receta</th><th>Producido</th><th>En ferias</th><th>Vendido</th><th>Testigo</th><th>Ajustes</th><th>Disponible</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function renderStockTrazabilidad() {
  const container = document.getElementById('stockTrazabilidadList');
  if (!container) return;
  const lotes = ejecuciones
    .filter(ej => (ej.evaluacion?.frascos230 || ej.evaluacion?.frascos180))
    .slice()
    .sort((a, b) => (b.fechaFin || '') < (a.fechaFin || '') ? -1 : 1);
  if (!lotes.length) {
    container.innerHTML = '<div class="empty-state">No hay lotes con producción envasada registrada.</div>';
    return;
  }
  const rows = lotes.map(ej => {
    const r = getLoteResumen(ej.id);
    const vencimiento = ej.evaluacion?.fechaVencimiento || '';
    return `
      <tr>
        <td>${esc(ej.loteId || '—')}</td>
        <td>${esc(ej.nombreReceta)}</td>
        <td>${fmtDate(ej.fechaFin)}</td>
        <td>${r.producido}</td>
        <td>${r.comprometido}</td>
        <td>${r.vendido}</td>
        <td>${r.testigo}</td>
        <td class="stock-disponible-cell${r.disponible < 0 ? ' stock-disponible-neg' : ''}">${r.disponible}</td>
        <td>${vencimiento ? esc(vencimiento) : '—'}</td>
      </tr>`;
  }).join('');
  container.innerHTML = `
    <table class="tasks-table">
      <thead><tr><th>Lote</th><th>Receta</th><th>Fecha</th><th>Producido</th><th>En ferias</th><th>Vendido</th><th>Testigo</th><th>Disponible</th><th>Vencimiento</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function renderStockTestigoList() {
  const container = document.getElementById('stockTestigoList');
  if (!container) return;
  if (!stockTestigos.length) {
    container.innerHTML = '<div class="empty-state">Aún no hay producto testigo apartado.</div>';
    return;
  }
  const estadoLabels = { en_resguardo: 'En resguardo', revisado: 'Revisado', descartado: 'Descartado' };
  const sorted = [...stockTestigos].sort((a, b) => (a.fechaRevision || '9999') < (b.fechaRevision || '9999') ? -1 : 1);
  container.innerHTML = sorted.map(t => {
    const dueStatus = getDueStatus(t.fechaRevision);
    const color = t.estado !== 'en_resguardo'
      ? (t.estado === 'revisado' ? '#2E7D32' : '#6B7280')
      : (dueStatus === 'vencido' ? '#C0392B' : (dueStatus === 'hoy' || dueStatus === 'porVencer') ? '#F59E0B' : '#2E7D32');
    return `
      <div class="stock-testigo-card">
        <div class="stock-testigo-main">
          <div class="stock-testigo-title">${esc(t.recetaNombre)} — Lote ${esc(t.loteId || '—')}</div>
          <div class="stock-testigo-meta">📦 ${t.cantidad} unidades &nbsp;·&nbsp; 📅 Apartado: ${esc(fmtDateShortEs(t.fechaApartado))} &nbsp;·&nbsp; 🔍 Revisión: ${esc(fmtDateShortEs(t.fechaRevision))}</div>
          ${t.ubicacion ? `<div class="stock-testigo-meta">📍 ${esc(t.ubicacion)}</div>` : ''}
          ${t.observaciones ? `<div class="feria-card-desc">${esc(t.observaciones)}</div>` : ''}
        </div>
        <div class="stock-testigo-actions">
          <span class="status-pill" style="background:${color}22;color:${color}">${estadoLabels[t.estado] || t.estado}</span>
          ${t.estado === 'en_resguardo' ? `
            <button class="task-action-btn" data-testigo-revisado="${esc(t.id)}" title="Marcar revisado">✓</button>
            <button class="task-action-btn" data-testigo-descartado="${esc(t.id)}" title="Marcar descartado">✕</button>
          ` : ''}
          <button class="task-action-btn" data-testigo-del="${esc(t.id)}" data-row="${t.rowIndex}" title="Eliminar registro">${ICON_TRASH}</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-testigo-revisado]').forEach(btn => {
    btn.addEventListener('click', () => updateStockTestigoEstado(btn.dataset.testigoRevisado, 'revisado'));
  });
  container.querySelectorAll('[data-testigo-descartado]').forEach(btn => {
    btn.addEventListener('click', () => updateStockTestigoEstado(btn.dataset.testigoDescartado, 'descartado'));
  });
  container.querySelectorAll('[data-testigo-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este registro de producto testigo?')) return;
      btn.disabled = true;
      try {
        await deleteStockTestigoRow(+btn.dataset.row);
        await loadStockTestigos();
        renderStockTestigoList();
        renderStockResumen();
        renderStockTrazabilidad();
      } catch (e) { alert('Error: ' + e.message); btn.disabled = false; }
    });
  });
}

async function updateStockTestigoEstado(id, estado) {
  const t = stockTestigos.find(x => x.id === id);
  if (!t) return;
  t.estado = estado;
  try {
    await updateStockTestigo(t);
    renderStockTestigoList();
  } catch (e) { alert('Error: ' + e.message); }
}

// ── Stock: Ajuste manual ──────────────────────────────────────────────────────

function openStockAjusteModal() {
  document.getElementById('stockAjusteFeedback').textContent = '';
  document.getElementById('stockAjusteReceta').innerHTML =
    recetas.map(r => `<option value="${esc(r.id)}">${esc(r.nombre)}</option>`).join('');
  document.getElementById('stockAjusteTipo').value = 'salida';
  document.getElementById('stockAjusteCantidad').value = '';
  document.getElementById('stockAjusteMotivo').value = 'Frasco promocional';
  document.getElementById('stockAjusteMotivoOtro').value = '';
  document.getElementById('stockAjusteMotivoOtro').style.display = 'none';
  document.getElementById('stockAjusteOverlay').classList.add('open');
}
document.getElementById('btnNewStockAjuste').addEventListener('click', openStockAjusteModal);
document.getElementById('btnCloseStockAjuste').addEventListener('click', () => {
  document.getElementById('stockAjusteOverlay').classList.remove('open');
});
document.getElementById('stockAjusteOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('stockAjusteOverlay')) document.getElementById('stockAjusteOverlay').classList.remove('open');
});
document.getElementById('stockAjusteMotivo').addEventListener('change', e => {
  document.getElementById('stockAjusteMotivoOtro').style.display = e.target.value === 'otro' ? '' : 'none';
});

document.getElementById('btnSaveStockAjuste').addEventListener('click', async () => {
  const recetaId    = document.getElementById('stockAjusteReceta').value;
  const tipo        = document.getElementById('stockAjusteTipo').value;
  const cantidad    = parseInt(document.getElementById('stockAjusteCantidad').value) || 0;
  const motivoSel   = document.getElementById('stockAjusteMotivo').value;
  const motivo      = motivoSel === 'otro'
    ? document.getElementById('stockAjusteMotivoOtro').value.trim()
    : motivoSel;
  const fb       = document.getElementById('stockAjusteFeedback');
  if (!recetaId) return setFb(fb, 'Selecciona una receta.', 'err');
  if (cantidad <= 0) return setFb(fb, 'La cantidad debe ser mayor a 0.', 'err');
  if (!motivo) return setFb(fb, 'Indica el motivo del ajuste.', 'err');

  const receta = recetas.find(r => r.id === recetaId);
  const btn = document.getElementById('btnSaveStockAjuste');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await appendStockMovimiento({ recetaId, recetaNombre: receta?.nombre || '', tipo, cantidad, motivo, fecha: toISODate(new Date()) });
    await loadStockMovimientos();
    renderStockResumen();
    document.getElementById('stockAjusteOverlay').classList.remove('open');
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar ajuste';
  }
});

// ── Stock: Apartar producto testigo ──────────────────────────────────────────

function updateStockTestigoFechaTriggers() {
  const apartado = document.getElementById('stockTestigoFechaApartado').value;
  const revision  = document.getElementById('stockTestigoFechaRevision').value;
  document.getElementById('stockTestigoFechaApartadoTrigger').textContent = apartado ? fmtDateShortEs(apartado) : 'Elegir fecha…';
  document.getElementById('stockTestigoFechaRevisionTrigger').textContent = revision ? fmtDateShortEs(revision) : 'Elegir fecha…';
}

function openStockTestigoModal() {
  document.getElementById('stockTestigoFeedback').textContent = '';
  const lotesConStock = ejecuciones.filter(ej => (getLoteResumen(ej.id)?.producido || 0) > 0);
  const sel = document.getElementById('stockTestigoLote');
  sel.innerHTML = lotesConStock.length
    ? lotesConStock.map(ej => {
        const r = getLoteResumen(ej.id);
        return `<option value="${esc(ej.id)}">${esc(ej.loteId || ej.id.slice(0, 8))} — ${esc(ej.nombreReceta)} (disponible: ${r.disponible})</option>`;
      }).join('')
    : '<option value="">Sin lotes con producción</option>';

  document.getElementById('stockTestigoCantidad').value = '';
  const today = toISODate(new Date());
  document.getElementById('stockTestigoFechaApartado').value = today;
  document.getElementById('stockTestigoFechaRevision').value = toISODate(addDays(new Date(), 180));
  updateStockTestigoFechaTriggers();
  document.getElementById('stockTestigoUbicacion').value = '';
  document.getElementById('stockTestigoObservaciones').value = '';
  document.getElementById('stockTestigoOverlay').classList.add('open');
}
document.getElementById('btnNewStockTestigo').addEventListener('click', openStockTestigoModal);
document.getElementById('btnCloseStockTestigo').addEventListener('click', () => {
  document.getElementById('stockTestigoOverlay').classList.remove('open');
});
document.getElementById('stockTestigoOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('stockTestigoOverlay')) document.getElementById('stockTestigoOverlay').classList.remove('open');
});

document.getElementById('stockTestigoFechaApartadoTrigger').addEventListener('click', () => {
  const input = document.getElementById('stockTestigoFechaApartado');
  openCalendarPopover(document.getElementById('stockTestigoFechaApartadoTrigger'), {
    mode: 'single', start: input.value || toISODate(new Date()), end: input.value || toISODate(new Date()),
    onApply: (start, end) => { input.value = end; updateStockTestigoFechaTriggers(); }
  });
});
document.getElementById('stockTestigoFechaRevisionTrigger').addEventListener('click', () => {
  const input = document.getElementById('stockTestigoFechaRevision');
  openCalendarPopover(document.getElementById('stockTestigoFechaRevisionTrigger'), {
    mode: 'single', start: input.value || toISODate(new Date()), end: input.value || toISODate(new Date()),
    onApply: (start, end) => { input.value = end; updateStockTestigoFechaTriggers(); }
  });
});

document.getElementById('btnSaveStockTestigo').addEventListener('click', async () => {
  const ejecucionId    = document.getElementById('stockTestigoLote').value;
  const cantidad       = parseInt(document.getElementById('stockTestigoCantidad').value) || 0;
  const fechaApartado  = document.getElementById('stockTestigoFechaApartado').value;
  const fechaRevision  = document.getElementById('stockTestigoFechaRevision').value;
  const ubicacion      = document.getElementById('stockTestigoUbicacion').value.trim();
  const observaciones  = document.getElementById('stockTestigoObservaciones').value.trim();
  const fb             = document.getElementById('stockTestigoFeedback');

  if (!ejecucionId) return setFb(fb, 'Selecciona un lote.', 'err');
  if (cantidad <= 0) return setFb(fb, 'La cantidad debe ser mayor a 0.', 'err');
  if (!fechaApartado || !fechaRevision) return setFb(fb, 'Las fechas son obligatorias.', 'err');

  const ej = ejecuciones.find(x => x.id === ejecucionId);
  const loteResumen = getLoteResumen(ejecucionId);
  if (loteResumen && cantidad > loteResumen.disponible) {
    return setFb(fb, `Ese lote solo tiene ${loteResumen.disponible} unidades disponibles.`, 'err');
  }

  const btn = document.getElementById('btnSaveStockTestigo');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await appendStockTestigo({
      id: crypto.randomUUID(), ejecucionId, recetaId: ej.recetaId, recetaNombre: ej.nombreReceta,
      loteId: ej.loteId || '', cantidad, fechaApartado, fechaRevision, ubicacion,
      estado: 'en_resguardo', observaciones
    });
    await loadStockTestigos();
    renderStockTestigoList();
    renderStockResumen();
    renderStockTrazabilidad();
    document.getElementById('stockTestigoOverlay').classList.remove('open');
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
});

