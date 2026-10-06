// Portado de ../../stock.js — mismas hojas "StockTestigo" y "StockMovimientos".
import { sheetsReq } from './googleAuth';
import { getStockProducido } from './ejecucionesApi';
import { getStockComprometidoLote, getStockVendidoLote } from './feriasApi';
import { parseISODate, toISODate, addMonths } from '../utils/format';

// Vida útil fija de 6 meses desde que se cerró el lote (fechaFin — si
// todavía no se cerró, desde que arrancó la producción) — a pedido
// explícito del usuario: antes la columna "Venc." de Trazabilidad leía
// `evaluacion.fechaVencimiento`, un campo que nunca llegó a escribirse
// desde React (quedaba siempre en "—").
export function getFechaVencimientoLote(ejecucion) {
  const base = ejecucion.fechaFin || ejecucion.fechaInicio;
  if (!base) return '';
  const d = parseISODate(base);
  if (isNaN(d.getTime())) return '';
  return toISODate(addMonths(d, 6));
}

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
  const producido   = (ev.frascos230 || 0) + (ev.frascos180 || 0) + (ev.frascos130 || 0) + (ev.frascosProducidos || 0);
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

// Disponible REAL de un lote puntual, con el mismo criterio que
// getStockDisponibleGeneral (el que confía el Resumen: resta lo
// efectivamente VENDIDO, no lo "comprometido" en planes de ferias viejas
// — ver `disponible` de getLoteResumen arriba, pensado para Ventas/plan
// de stock, no para esto). Sumar esta función lote por lote de una misma
// receta da EXACTO lo mismo que getStockDisponibleGeneral de esa receta
// — a diferencia de repartir el disponible general proporcionalmente
// entre lotes (bug real reportado por el usuario: si un lote más barato
// de una receta ya se agotó y queda el más caro, repartir "promediaba"
// el costo y subestimaba el valor total del stock). Usado para costear
// el stock lote por lote (ver resumenStockTotal/trazabilidadRows en
// useStock.js).
export function getStockDisponibleLoteReal({ ejecuciones, ferias, stockMovimientos }, ejecucionId) {
  const ej = ejecuciones.find(e => e.id === ejecucionId);
  if (!ej) return 0;
  const ev = ej.evaluacion || {};
  const producido = (ev.frascos230 || 0) + (ev.frascos180 || 0) + (ev.frascos130 || 0) + (ev.frascosProducidos || 0);
  const vendido = getStockVendidoLote(ferias, ejecucionId);
  const ajustes = getStockAjustesNetosLote(stockMovimientos, ejecucionId);
  return producido - vendido + ajustes;
}

// 1 ml ≈ 1 g (misma convención que el resto de la app, ver
// UNIDAD_A_GRAMOS en recetasApi.js) — un frasco de 230 ml equivale a 230
// g de producto, uno de 130 ml a 130 g. Precio por frasco, a pedido
// explícito del usuario: el costo del lote se divide por lo
// EFECTIVAMENTE ENVASADO (frascos230*230 + frascos130*130), no por el
// peso total planeado de la receta — así la merma (peso total - lo
// envasado, p. ej. evaporación o residuo que no llegó a ningún frasco)
// queda absorbida en el precio de lo que sí se envasó, en vez de perderse
// contable: sumar (precio de cada frasco × su cantidad) da EXACTO el
// costo total del lote. Si el lote no tiene frascos de tamaño conocido
// (dato viejo, solo "frascosProducidos" genérico) no hay base para
// calcular por gramos — se reparte parejo entre todos los frascos.
export function getPrecioFrascosLote(costoLote, pesoTotalLote, frascos230, frascos130, otrosFrascos = 0) {
  const pesoEnvasado = (frascos230 || 0) * 230 + (frascos130 || 0) * 130;
  if (pesoEnvasado > 0) {
    const precioPorGramo = costoLote / pesoEnvasado;
    return {
      precio230: precioPorGramo * 230,
      precio130: precioPorGramo * 130,
      merma: pesoTotalLote != null ? pesoTotalLote - pesoEnvasado : null
    };
  }
  const totalFrascos = (frascos230 || 0) + (frascos130 || 0) + (otrosFrascos || 0);
  const precioParejo = totalFrascos > 0 ? costoLote / totalFrascos : 0;
  return { precio230: precioParejo, precio130: precioParejo, merma: null };
}

// El ajuste manual se guarda por receta, pero el plan de stock de Ferias
// elige cuánto llevar lote por lote — sin un lote asignado, un ajuste nunca
// se vería reflejado ahí. Se atribuye solo, sin preguntarle al usuario, al
// lote más reciente con producción registrada de esa receta.
export function getLoteParaAjuste(ejecuciones, recetaId) {
  const lotes = ejecuciones
    .filter(ej => ej.recetaId === recetaId && (ej.evaluacion?.frascos230 || ej.evaluacion?.frascos180 || ej.evaluacion?.frascos130 || ej.evaluacion?.frascosProducidos))
    .sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));
  return lotes[0]?.id || '';
}
