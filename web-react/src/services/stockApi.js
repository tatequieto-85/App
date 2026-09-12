// Portado de ../../stock.js — mismas hojas "StockTestigo" y "StockMovimientos".
import { sheetsReq } from './googleAuth';
import { getStockProducido } from './ejecucionesApi';
import { getStockComprometidoLote, getStockVendidoLote } from './feriasApi';

let stockTestigosSheetId = null;
let stockMovimientosSheetId = null;

export async function ensureStockSheets() {
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
      if (r.addSheet?.properties?.title === 'StockTestigo')     stockTestigosSheetId    = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'StockMovimientos') stockMovimientosSheetId = r.addSheet.properties.sheetId;
    });
  }
  if (hasT) stockTestigosSheetId    = hasT.properties.sheetId;
  if (hasM) stockMovimientosSheetId = hasM.properties.sheetId;

  const td = await sheetsReq('/values/StockTestigo!A1').catch(() => ({}));
  if (!td.values) {
    await sheetsReq('/values/StockTestigo!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [[
        'ID', 'EjecucionId', 'RecetaId', 'RecetaNombre', 'LoteId', 'Cantidad', 'FechaApartado',
        'FechaRevision', 'Ubicacion', 'Estado', 'Observaciones', 'CreadoEn'
      ]] })
    });
  }
  const md = await sheetsReq('/values/StockMovimientos!A1:I1').catch(() => ({}));
  if (!md.values) {
    await sheetsReq('/values/StockMovimientos!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'RecetaId', 'RecetaNombre', 'Tipo', 'Cantidad', 'Motivo', 'Fecha', 'CreadoEn', 'EjecucionId']] })
    });
  }
}

export async function fetchStockTestigos() {
  const data = await sheetsReq('/values/StockTestigo!A:L');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:            r[0]  || '',
    ejecucionId:   r[1]  || '',
    recetaId:      r[2]  || '',
    recetaNombre:  r[3]  || '',
    loteId:        r[4]  || '',
    cantidad:      parseInt(r[5]) || 0,
    fechaApartado: r[6]  || '',
    fechaRevision: r[7]  || '',
    ubicacion:     r[8]  || '',
    estado:        r[9]  || 'en_resguardo',
    observaciones: r[10] || '',
    creadoEn:      r[11] || '',
    rowIndex:      i + 2
  }));
}

function stockTestigoRowValues(t) {
  return [
    t.id, t.ejecucionId, t.recetaId, t.recetaNombre, t.loteId, t.cantidad, t.fechaApartado,
    t.fechaRevision, t.ubicacion || '', t.estado || 'en_resguardo', t.observaciones || '',
    t.creadoEn || new Date().toISOString()
  ];
}

export async function appendStockTestigo(t) {
  await sheetsReq('/values/StockTestigo!A:L:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [stockTestigoRowValues(t)] })
  });
}

export async function updateStockTestigo(t) {
  await sheetsReq(`/values/StockTestigo!A${t.rowIndex}:L${t.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [stockTestigoRowValues(t)] })
  });
}

export async function deleteStockTestigoRow(rowIndex) {
  if (!stockTestigosSheetId) await ensureStockSheets();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: stockTestigosSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

export async function fetchStockMovimientos() {
  const data = await sheetsReq('/values/StockMovimientos!A:I');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:           r[0] || '',
    recetaId:     r[1] || '',
    recetaNombre: r[2] || '',
    tipo:         r[3] || 'salida',
    cantidad:     parseInt(r[4]) || 0,
    motivo:       r[5] || '',
    fecha:        r[6] || '',
    creadoEn:     r[7] || '',
    ejecucionId:  r[8] || '',
    rowIndex:     i + 2
  }));
}

// El lote (ejecucionId) se asigna solo, sin preguntarle al usuario — ver
// getLoteParaAjuste más abajo.
export async function appendStockMovimiento(m) {
  await sheetsReq('/values/StockMovimientos!A:I:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), m.recetaId, m.recetaNombre, m.tipo, m.cantidad, m.motivo, m.fecha,
      new Date().toISOString(), m.ejecucionId || ''
    ]] })
  });
}

export async function deleteStockMovimientoRow(rowIndex) {
  if (!stockMovimientosSheetId) await ensureStockSheets();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: stockMovimientosSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

// ── Cálculo de inventario (siempre derivado, nunca editable a mano) ─────────

function getStockVendidoGeneral(ferias, recetaId) {
  return ferias.reduce((sum, f) =>
    sum + (f.ventas || []).filter(v => v.recetaId === recetaId).reduce((s, v) => s + v.cantidad, 0)
  , 0);
}

function getStockAjustesNetos(stockMovimientos, recetaId) {
  return stockMovimientos
    .filter(m => m.recetaId === recetaId)
    .reduce((sum, m) => sum + (m.tipo === 'entrada' ? m.cantidad : -m.cantidad), 0);
}

// Disponible = todo lo producido, menos lo vendido, más/menos los ajustes
// manuales.
export function getStockDisponibleGeneral({ ejecuciones, ferias, stockMovimientos }, recetaId) {
  return getStockProducido(ejecuciones, recetaId)
    - getStockVendidoGeneral(ferias, recetaId)
    + getStockAjustesNetos(stockMovimientos, recetaId);
}

function getStockAjustesNetosLote(stockMovimientos, ejecucionId) {
  return stockMovimientos
    .filter(m => m.ejecucionId === ejecucionId)
    .reduce((sum, m) => sum + (m.tipo === 'entrada' ? m.cantidad : -m.cantidad), 0);
}

export function getLoteResumen({ ejecuciones, ferias, stockMovimientos, stockTestigos }, ejecucionId) {
  const ej = ejecuciones.find(e => e.id === ejecucionId);
  if (!ej) return null;
  const ev          = ej.evaluacion || {};
  const producido   = (ev.frascos230 || 0) + (ev.frascos180 || 0);
  const testigo     = stockTestigos
    .filter(t => t.ejecucionId === ejecucionId)
    .reduce((sum, t) => sum + (t.cantidad || 0), 0);
  const comprometido = getStockComprometidoLote(ferias, ejecucionId);
  const vendido       = getStockVendidoLote(ferias, ejecucionId);
  const ajustes        = getStockAjustesNetosLote(stockMovimientos, ejecucionId);
  return {
    producido, testigo, comprometido, vendido, ajustes,
    disponible: producido - testigo + ajustes - comprometido
  };
}

// El ajuste manual se guarda por receta, pero el plan de stock de Ferias
// elige cuánto llevar lote por lote — sin un lote asignado, un ajuste nunca
// se vería reflejado ahí. Se atribuye solo, sin preguntarle al usuario, al
// lote más reciente con producción registrada de esa receta.
export function getLoteParaAjuste(ejecuciones, recetaId) {
  const lotes = ejecuciones
    .filter(ej => ej.recetaId === recetaId && (ej.evaluacion?.frascos230 || ej.evaluacion?.frascos180))
    .sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));
  return lotes[0]?.id || '';
}
