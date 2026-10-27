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
  // MedidaId/MedidaNombre (J/K) — a qué ITEM puntual (medida real del
  // catálogo, o bucket legacy 230/130/180/otros) afecta este ajuste, vacío
  // para los ajustes viejos a nivel de receta completa — a pedido explícito
  // del usuario, mismo criterio de migración que RecetaId/Insumos en
  // medidasApi.js (agregar columnas al final, nunca reordenar).
  const mdExt = await sheetsReq('/values/StockMovimientos!J1:K1').catch(() => ({}));
  if (!(mdExt.values || [])[0]?.length) {
    await sheetsReq('/values/StockMovimientos!J1:K1?valueInputOption=RAW', {
      method: 'PUT', body: JSON.stringify({ values: [['MedidaId', 'MedidaNombre']] })
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
  const data = await sheetsReq('/values/StockMovimientos!A:K');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:           r[0]  || '',
    recetaId:     r[1]  || '',
    recetaNombre: r[2]  || '',
    tipo:         r[3]  || 'salida',
    cantidad:     parseInt(r[4]) || 0,
    motivo:       r[5]  || '',
    fecha:        r[6]  || '',
    creadoEn:     r[7]  || '',
    ejecucionId:  r[8]  || '',
    medidaId:     r[9]  || '',
    medidaNombre: r[10] || '',
    rowIndex:     i + 2
  }));
}

// El lote (ejecucionId) se asigna solo, sin preguntarle al usuario — ver
// getLoteParaAjuste más abajo. medidaId/medidaNombre: a qué ITEM puntual
// afecta el ajuste (vacío si es un ajuste a nivel de receta completa, para
// recetas sin medidas configuradas).
export async function appendStockMovimiento(m) {
  await sheetsReq('/values/StockMovimientos!A:K:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), m.recetaId, m.recetaNombre, m.tipo, m.cantidad, m.motivo, m.fecha,
      new Date().toISOString(), m.ejecucionId || '', m.medidaId || '', m.medidaNombre || ''
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

// Ajustes manuales de UN item puntual (medida real o bucket legacy) — a
// pedido explícito del usuario ("quiero que cada medida sea un item que se
// pueda ajustar manualmente en stock"). A diferencia del vendido/muestras
// (que Ventas solo registra por LOTE y hay que repartir proporcionalmente,
// ver getStockPorMedida), un ajuste manual SIEMPRE se guarda ya apuntando a
// una medida puntual — así que acá no hace falta ningún reparto, es exacto.
function getStockAjustesNetosMedida(stockMovimientos, medidaId) {
  return stockMovimientos
    .filter(m => m.medidaId === medidaId)
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

// Desglose de UN lote por medida — a pedido explícito del usuario, que
// produciendo de verdad encontró el bug: Trazabilidad/LoteResumenModal
// solo tenían columnas fijas para "230"/"130", así que cualquier medida
// de otro peso (ej. "105 g") quedaba invisible, aunque SÍ sumaba al
// Disponible general (vía evaluacion.frascosProducidos, el balde de
// compatibilidad — ver EjecucionProduccionBox.jsx/useProcesos.js). Esto
// reemplaza esas columnas fijas por un desglose dinámico, con UN SOLO
// camino tanto para lotes nuevos (evaluacion.produccionPorMedida) como
// para lotes viejos (frascos230/180/130/frascosProducidos, sintetizados
// acá a la misma forma) — así el resto del código (tabla, pricing) no
// necesita dos ramas distintas.
// `medidaId` identifica el ITEM al que pertenece cada cantidad — el id real
// del catálogo (Medidas) para lotes nuevos, o una clave sintética estable
// ("legacy-230"/"legacy-130"/"legacy-180"/"legacy-otros") para lotes viejos
// sin medida configurada, para poder agrupar/ajustar cada tamaño por
// separado igual que a una medida real (ver getStockPorMedida).
export function getProduccionPorMedidaLote(ejecucion) {
  const ev = ejecucion.evaluacion || {};
  if (ev.produccionPorMedida?.length) {
    return ev.produccionPorMedida
      .filter(p => p.cantidad > 0)
      .map(p => ({ medidaId: p.medidaId, nombre: p.nombre || 'Medida', pesoMl: p.pesoMl || 0, cantidad: p.cantidad }));
  }
  const items = [];
  if (ev.frascos230) items.push({ medidaId: 'legacy-230', nombre: '230 ml', pesoMl: 230, cantidad: ev.frascos230 });
  if (ev.frascos130) items.push({ medidaId: 'legacy-130', nombre: '130 ml', pesoMl: 130, cantidad: ev.frascos130 });
  if (ev.frascos180) items.push({ medidaId: 'legacy-180', nombre: '180 ml', pesoMl: 180, cantidad: ev.frascos180 });
  if (ev.frascosProducidos) items.push({ medidaId: 'legacy-otros', nombre: 'Otros', pesoMl: 0, cantidad: ev.frascosProducidos });
  return items;
}

// 1 ml ≈ 1 g (misma convención que el resto de la app, ver
// UNIDAD_A_GRAMOS en recetasApi.js) — un frasco de 230 ml equivale a 230
// g de producto. Precio por frasco, a pedido explícito del usuario: el
// costo del lote se divide por lo EFECTIVAMENTE ENVASADO (suma de
// pesoMl × cantidad de cada medida con peso conocido), no por el peso
// total planeado de la receta — así la merma (peso total - lo envasado,
// p. ej. evaporación o residuo que no llegó a ningún frasco) queda
// absorbida en el precio de lo que sí se envasó, en vez de perderse
// contable. Generalizado a N medidas (antes hardcodeado a 230/130 — ver
// getPrecioFrascosLote, reemplazada por esta). Corrige un bug gemelo de
// paso: antes, una medida SIN peso conocido (`pesoMl` 0) junto con otras
// SÍ conocidas quedaba sin precio del todo — acá siempre recibe un
// precio razonable (parejo entre todas las unidades del lote) si no se
// le conoce el peso.
export function getPrecioPorMedida(costoLote, pesoTotalLote, items) {
  const totalUnidades = items.reduce((s, i) => s + (i.cantidad || 0), 0);
  const pesoEnvasado = items.filter(i => i.pesoMl > 0).reduce((s, i) => s + i.pesoMl * i.cantidad, 0);
  const precioPorGramo = pesoEnvasado > 0 ? costoLote / pesoEnvasado : 0;
  const precioParejo = totalUnidades > 0 ? costoLote / totalUnidades : 0;
  return {
    items: items.map(i => ({
      ...i,
      precioUnidad: i.pesoMl > 0 && pesoEnvasado > 0 ? precioPorGramo * i.pesoMl : precioParejo
    })),
    merma: pesoTotalLote != null ? pesoTotalLote - pesoEnvasado : null
  };
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

// Desglose de Stock por receta+medida — cada medida es su propio ITEM
// ajustable, a pedido explícito del usuario ("la receta esta anexa a
// medida y stock deberia estar anexa a medida... quiero que cada medida
// sea un item que se pueda ajustar manualmente en stock"), no un desglose
// de solo lectura debajo de la receta. Se arranca sembrando TODAS las
// medidas del catálogo de esta receta (medidasCatalogo, ver medidasApi.js)
// aunque todavía no se haya producido nada de alguna — así son ajustables
// desde el día uno. Producido: se suma getProduccionPorMedidaLote de cada
// lote de esta receta por medidaId (lotes viejos sin medida configurada
// caen en buckets legacy sintéticos — "230 ml"/"130 ml"/etc. — que también
// quedan como su propio item ajustable). Vendido/muestras: Ventas los
// registra por LOTE, no por medida puntual dentro del lote — no hay forma
// de saber cuál tamaño exacto se vendió — así que se reparten en
// proporción a lo que cada medida aportó a ESE lote. Ajustes manuales: a
// diferencia de vendido/muestras, SÍ se guardan ya apuntando a una medida
// puntual (ver getStockAjustesNetosMedida) — por eso entran EXACTOS, sin
// repartir.
export function getStockPorMedida({ ejecuciones, ferias, stockMovimientos }, recetaId, medidasCatalogo = []) {
  const grupos = new Map(); // medidaId -> { medidaId, nombre, pesoMl, producido, disponible }

  function ensure(medidaId, nombre, pesoMl) {
    let g = grupos.get(medidaId);
    if (!g) { g = { medidaId, nombre, pesoMl, producido: 0, disponible: 0 }; grupos.set(medidaId, g); }
    return g;
  }

  medidasCatalogo.filter(m => m.recetaId === recetaId).forEach(m => {
    ensure(m.id, m.nombre, m.pesoMl);
  });

  ejecuciones.filter(ej => ej.recetaId === recetaId).forEach(ej => {
    const items = getProduccionPorMedidaLote(ej);
    const producidoLote = items.reduce((s, i) => s + i.cantidad, 0);
    if (!producidoLote) return;
    const vendido = getStockVendidoLote(ferias, ej.id);
    const muestras = getStockMuestrasLote(ferias, ej.id);
    const disponibleLoteSinAjuste = producidoLote - vendido - muestras;
    items.forEach(i => {
      const g = ensure(i.medidaId, i.nombre, i.pesoMl);
      const ratio = i.cantidad / producidoLote;
      g.producido += i.cantidad;
      g.disponible += disponibleLoteSinAjuste * ratio;
    });
  });

  grupos.forEach(g => { g.disponible += getStockAjustesNetosMedida(stockMovimientos, g.medidaId); });

  return [...grupos.values()]
    .map(g => ({ ...g, disponible: Math.round(g.disponible) }))
    .sort((a, b) => b.producido - a.producido);
}
