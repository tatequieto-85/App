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

// Bug real encontrado probando esto en Contabilidad (mismo patrón acá):
// con varios widgets de Home montados juntos (p. ej. Stock + Ventas),
// cada uno llama a ensureStockSheets() por su cuenta al mismo tiempo —
// dos corridas de limpiarFilasFantasma() en paralelo contra la MISMA hoja
// se pisan entre sí y pueden borrar filas que no son fantasma. Esta
// promesa compartida hace que, si ya hay una corrida en curso, cualquier
// otro llamado simplemente espere ESA MISMA, en vez de arrancar una
// paralela.
let ensurePromise = null;

export async function ensureStockSheets() {
  if (ensurePromise) return ensurePromise;
  ensurePromise = ensureStockSheetsInner();
  try {
    await ensurePromise;
  } finally {
    ensurePromise = null;
  }
}

async function ensureStockSheetsInner() {
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

  // Bug real reportado por el usuario ("por qué me crea productos testigo
  // de la nada"): esta lectura usaba .catch(() => ({})) y, si fallaba por
  // CUALQUIER motivo transitorio (hipo de red, token vencido a mitad de
  // pedido — esto corre en CADA carga de Stock/Ventas/Calculadora), se
  // trataba como "la hoja está vacía" y agregaba el encabezado con
  // :append — que NO sobreescribe la fila 1, agrega una fila nueva al
  // final como si fuera un registro real. fetchStockTestigos() la tomaba
  // como válida porque la columna ID no venía vacía (literalmente decía
  // "ID"), y se mostraba como una tarjeta más con "RecetaNombre — Lote
  // LoteId" / fechas "Invalid Date" (son los nombres de columna, no
  // datos). Ahora escribe siempre con PUT a la fila fija 1, igual que el
  // resto de los ensure*Sheet() — reintentar de más nunca duplica nada.
  const TESTIGO_HEADER = [
    'ID', 'EjecucionId', 'RecetaId', 'RecetaNombre', 'LoteId', 'Cantidad',
    'FechaApartado', 'FechaRevision', 'Ubicacion', 'Estado', 'Observaciones', 'CreadoEn'
  ];
  const td = await sheetsReq('/values/StockTestigo!A1:L1').catch(() => ({}));
  if (!(td.values || [])[0]?.length) {
    await sheetsReq('/values/StockTestigo!A1:L1?valueInputOption=RAW', {
      method: 'PUT', body: JSON.stringify({ values: [TESTIGO_HEADER] })
    });
  }
  const MOVIMIENTO_HEADER = ['ID', 'RecetaId', 'RecetaNombre', 'Tipo', 'Cantidad', 'Motivo', 'Fecha', 'CreadoEn', 'EjecucionId'];
  const md = await sheetsReq('/values/StockMovimientos!A1:I1').catch(() => ({}));
  if (!(md.values || [])[0]?.length) {
    await sheetsReq('/values/StockMovimientos!A1:I1?valueInputOption=RAW', {
      method: 'PUT', body: JSON.stringify({ values: [MOVIMIENTO_HEADER] })
    });
  }

  // Limpia las filas "fantasma" que el bug de arriba ya haya creado antes
  // de este fix — el encabezado reinsertado como si fuera un registro
  // real, en cualquier fila después de la 1. Se identifica por matchear
  // las 12/9 columnas EXACTO contra el encabezado real (no por una sola
  // columna, para no borrar por error un registro legítimo). Idempotente:
  // no encuentra nada para borrar en las corridas siguientes.
  await limpiarFilasFantasma('StockTestigo', stockTestigosSheetId, TESTIGO_HEADER, 'A:L');
  await limpiarFilasFantasma('StockMovimientos', stockMovimientosSheetId, MOVIMIENTO_HEADER, 'A:I');
}

// Borra de a UNA fila fantasma por vez, releyendo justo antes de cada
// borrado (en vez de calcular todos los índices de una foto vieja y
// borrarlos todos juntos) — si esta función llegara a correr dos veces
// en paralelo (p. ej. dos pantallas que abren Stock casi al mismo tiempo),
// cada borrado se valida contra el estado más reciente en vez de un
// índice que ya pudo haberse corrido por un borrado anterior.
async function limpiarFilasFantasma(sheetName, sheetId, header, range) {
  if (!sheetId) return;
  for (let intentos = 0; intentos < 20; intentos++) {
    const data = await sheetsReq(`/values/${sheetName}!${range}`).catch(() => ({}));
    const rows = data.values || [];
    const idx = rows.findIndex((r, i) => i > 0 && header.every((h, j) => ((r || [])[j] || '') === h));
    if (idx === -1) return;
    await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ deleteDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 }
      } }] })
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

// Bug real reportado por el usuario ("en Stock no me descuenta las
// muestras"): el Resumen solo restaba lo VENDIDO, nunca lo entregado como
// muestra — una muestra sale del mismo stock físico que una venta, así que
// también tiene que bajar el disponible.
function getStockMuestrasGeneral(ferias, recetaId) {
  return ferias.reduce((sum, f) =>
    sum + (f.muestras || []).filter(m => m.recetaId === recetaId).reduce((s, m) => s + m.cantidad, 0)
  , 0);
}

function getStockAjustesNetos(stockMovimientos, recetaId) {
  return stockMovimientos
    .filter(m => m.recetaId === recetaId)
    .reduce((sum, m) => sum + (m.tipo === 'entrada' ? m.cantidad : -m.cantidad), 0);
}

// Disponible = todo lo producido, menos lo vendido y lo entregado como
// muestra, más/menos los ajustes manuales.
export function getStockDisponibleGeneral({ ejecuciones, ferias, stockMovimientos }, recetaId) {
  return getStockProducido(ejecuciones, recetaId)
    - getStockVendidoGeneral(ferias, recetaId)
    - getStockMuestrasGeneral(ferias, recetaId)
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
function getStockMuestrasLote(ferias, ejecucionId) {
  return ferias.reduce((sum, f) =>
    sum + (f.muestras || []).filter(m => m.ejecucionId === ejecucionId).reduce((s, m) => s + m.cantidad, 0)
  , 0);
}

export function getStockDisponibleLoteReal({ ejecuciones, ferias, stockMovimientos }, ejecucionId) {
  const ej = ejecuciones.find(e => e.id === ejecucionId);
  if (!ej) return 0;
  const ev = ej.evaluacion || {};
  const producido = (ev.frascos230 || 0) + (ev.frascos180 || 0) + (ev.frascos130 || 0) + (ev.frascosProducidos || 0);
  const vendido = getStockVendidoLote(ferias, ejecucionId);
  const muestras = getStockMuestrasLote(ferias, ejecucionId);
  const ajustes = getStockAjustesNetosLote(stockMovimientos, ejecucionId);
  return producido - vendido - muestras + ajustes;
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
