// Módulo Contabilidad — "Cajas" (ingresos/egresos manuales + automáticos) y
// el resumen de ventas por canal se arma leyendo Ferias/CanalesVenta
// directo (ver useContabilidad.js), sin hoja propia para eso. Dos hojas
// nuevas: "ContabilidadCajas" (el catálogo de cajas) y
// "ContabilidadMovimientos" (cada ingreso/egreso, manual o automático).
//
// Por qué los movimientos "automáticos" se generan como una fila más en
// ContabilidadMovimientos al momento de la venta/compra, en vez de sumar
// Ventas/Compras en vivo cada vez que se abre Contabilidad: Compras solo
// guarda las últimas 10 compras por ingrediente (ver pruneOldCompras en
// comprasApi.js) — sumar "lo que hay ahora" en Compras subestimaría el
// egreso real a medida que se podan compras viejas. Generar la fila una
// sola vez, cuando pasa la compra/venta, evita ese problema (igual que el
// stock corriente de Ingredientes). Dos mecanismos distintos conviven:
// - Compras: una caja con fuenteAutomatica='compras' recibe TODO el
//   egreso (registrarMovimientoAuto/removeMovimientoAuto).
// - Ventas: el usuario reparte el ingreso entre cajas a mano al cerrar la
//   feria (registrarMovimientosVenta/removeMovimientosVenta) — no hay una
//   sola "caja de ventas", porque una venta puede cobrarse parte en
//   efectivo y parte en otro medio.
import { sheetsReq } from './googleAuth';

let cajasSheetId = null;
let movimientosSheetId = null;

// "ventas" ya no es una fuente automática de una sola caja — al cerrar una
// feria el usuario reparte el total entre TODAS las cajas que existan
// (efectivo, Nequi, etc., ver FeriaCierreModal.jsx), así que cada caja
// recibe su ingreso directo sin tener que elegirla acá. "compras" sigue
// igual: una sola caja opcional para el egreso automático.
export const FUENTE_AUTOMATICA_OPCIONES = [
  { value: 'ninguna', label: 'Ninguna (manual)' },
  { value: 'compras', label: 'Automático — egresos de Compras' }
];

export async function ensureContabilidadSheets() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasC = tabs.find(s => s.properties.title === 'ContabilidadCajas');
  const hasM = tabs.find(s => s.properties.title === 'ContabilidadMovimientos');

  const reqs = [];
  if (!hasC) reqs.push({ addSheet: { properties: { title: 'ContabilidadCajas' } } });
  if (!hasM) reqs.push({ addSheet: { properties: { title: 'ContabilidadMovimientos' } } });

  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: reqs }) });
    (res.replies || []).forEach(r => {
      if (r.addSheet?.properties?.title === 'ContabilidadCajas') cajasSheetId = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'ContabilidadMovimientos') movimientosSheetId = r.addSheet.properties.sheetId;
    });
  }
  if (hasC) cajasSheetId = hasC.properties.sheetId;
  if (hasM) movimientosSheetId = hasM.properties.sheetId;

  // Bug real reportado por el usuario ("me creas cajas en blanco", con
  // Nombre="Nombre" y $0): esta lectura usaba .catch(() => ({})) y, si
  // fallaba por cualquier motivo transitorio (hipo de red, token vencido a
  // mitad de pedido), se trataba como "la hoja está vacía" y agregaba el
  // encabezado con :append — que NO sobreescribe la fila 1, agrega una
  // fila nueva al final como si fuera una caja real (fetchCajas() la
  // tomaba como válida porque la columna ID no venía vacía: decía
  // literalmente "ID"). Mismo bug ya encontrado y corregido en
  // stockApi.js ("por qué me crea productos testigo de la nada") — ahora
  // escribe siempre con PUT a la fila fija 1 y limpia las filas fantasma
  // que el bug ya haya creado.
  const CAJA_HEADER = ['ID', 'Nombre', 'FuenteAutomatica', 'CreadoEn'];
  const cd = await sheetsReq('/values/ContabilidadCajas!A1:D1').catch(() => ({}));
  if (!((cd.values || [])[0] || []).length) {
    await sheetsReq('/values/ContabilidadCajas!A1:D1?valueInputOption=RAW', {
      method: 'PUT', body: JSON.stringify({ values: [CAJA_HEADER] })
    });
  }
  const MOVIMIENTO_HEADER = ['ID', 'CajaId', 'Tipo', 'Monto', 'Concepto', 'Fecha', 'CreadoEn', 'Origen', 'OrigenRefId'];
  const md = await sheetsReq('/values/ContabilidadMovimientos!A1:I1').catch(() => ({}));
  if (!((md.values || [])[0] || []).length) {
    await sheetsReq('/values/ContabilidadMovimientos!A1:I1?valueInputOption=RAW', {
      method: 'PUT', body: JSON.stringify({ values: [MOVIMIENTO_HEADER] })
    });
  }

  await limpiarFilasFantasma('ContabilidadCajas', cajasSheetId, CAJA_HEADER, 'A:D');
  await limpiarFilasFantasma('ContabilidadMovimientos', movimientosSheetId, MOVIMIENTO_HEADER, 'A:I');
}

// Borra de a UNA fila fantasma por vez, releyendo justo antes de cada
// borrado — mismo criterio que stockApi.js (ver ahí el porqué: así se
// mantiene seguro incluso si esto llegara a correr dos veces casi en
// paralelo). Se identifica por matchear TODAS las columnas exacto contra
// el encabezado real, para no borrar por error una fila legítima.
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

export async function fetchCajas() {
  const data = await sheetsReq('/values/ContabilidadCajas!A:D');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:               r[0] || '',
    nombre:           r[1] || '',
    fuenteAutomatica: r[2] || 'ninguna',
    creadoEn:         r[3] || '',
    rowIndex:         i + 2
  }));
}

export async function appendCaja(caja) {
  await sheetsReq('/values/ContabilidadCajas!A:D:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[caja.id, caja.nombre, caja.fuenteAutomatica || 'ninguna', caja.creadoEn || new Date().toISOString()]] })
  });
}

export async function updateCaja(caja) {
  await sheetsReq(`/values/ContabilidadCajas!A${caja.rowIndex}:D${caja.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[caja.id, caja.nombre, caja.fuenteAutomatica || 'ninguna', caja.creadoEn]] })
  });
}

export async function deleteCajaRow(rowIndex) {
  if (!cajasSheetId) await ensureContabilidadSheets();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: cajasSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

export async function fetchMovimientos() {
  const data = await sheetsReq('/values/ContabilidadMovimientos!A:I');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:          r[0] || '',
    cajaId:      r[1] || '',
    tipo:        r[2] === 'egreso' ? 'egreso' : 'ingreso',
    monto:       parseFloat(r[3]) || 0,
    concepto:    r[4] || '',
    fecha:       r[5] || '',
    creadoEn:    r[6] || '',
    origen:      r[7] === 'auto' ? 'auto' : 'manual',
    origenRefId: r[8] || '',
    rowIndex:    i + 2
  }));
}

export async function appendMovimiento(mov) {
  await sheetsReq('/values/ContabilidadMovimientos!A:I:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      mov.id, mov.cajaId, mov.tipo, mov.monto, mov.concepto || '', mov.fecha,
      mov.creadoEn || new Date().toISOString(), mov.origen || 'manual', mov.origenRefId || ''
    ]] })
  });
}

export async function deleteMovimientoRow(rowIndex) {
  if (!movimientosSheetId) await ensureContabilidadSheets();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: movimientosSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

export function cajaSaldo(movimientos, cajaId) {
  return movimientos
    .filter(m => m.cajaId === cajaId)
    .reduce((s, m) => s + (m.tipo === 'egreso' ? -m.monto : m.monto), 0);
}

// Llamado desde useVentas.js (al registrar/borrar una venta-combo) y
// useCompras.js (al registrar/borrar una compra) — si existe una caja
// configurada con esa fuente automática, genera (o borra) su movimiento
// correspondiente. Si no hay ninguna caja así configurada, no hace nada
// (no es un error: Contabilidad es opcional). Fallos acá nunca deben
// interrumpir el flujo de Ventas/Compras que la llama — quien invoque esto
// debe envolverlo en try/catch y tragarse el error.
export async function registrarMovimientoAuto(fuente, { tipo, monto, concepto, fecha, origenRefId }) {
  if (!monto || monto <= 0) return;
  const cajas = await fetchCajas();
  const caja = cajas.find(c => c.fuenteAutomatica === fuente);
  if (!caja) return;
  await appendMovimiento({
    id: crypto.randomUUID(), cajaId: caja.id, tipo, monto, concepto, fecha,
    origen: 'auto', origenRefId
  });
}

export async function removeMovimientoAuto(origenRefId) {
  if (!origenRefId) return;
  const movimientos = await fetchMovimientos();
  const mov = movimientos.find(m => m.origenRefId === origenRefId);
  if (mov) await deleteMovimientoRow(mov.rowIndex);
}

// Llamado desde useCompras.js — a diferencia de registrarMovimientoAuto
// (una sola caja fija configurada de antemano con fuenteAutomatica=
// 'compras'), acá la caja se elige en cada compra (ver CompraModal.jsx,
// a pedido explícito del usuario: "no me pide la caja a descontar").
// removeMovimientoAuto sigue sirviendo para borrarlo (busca por
// origenRefId sin importar la caja).
export async function registrarMovimientoCompra(cajaId, { tipo, monto, concepto, fecha, origenRefId }) {
  if (!cajaId || !monto || monto <= 0) return;
  await appendMovimiento({
    id: crypto.randomUUID(), cajaId, tipo, monto, concepto, fecha,
    origen: 'auto', origenRefId
  });
}

// Llamado desde useVentas.js al cerrar una feria — a diferencia de
// registrarMovimientoAuto (una caja fija por fuente), acá el ingreso se
// reparte directo entre las cajas que el usuario cargó a mano en el
// cierre (efectivo, Nequi, etc.), una fila por caja. origenRefId lleva el
// id de la caja pegado (`${feriaId}:${cajaId}`) para poder limpiar solo
// las de esta feria si se reabre y se vuelve a cerrar con otro reparto.
export async function registrarMovimientosVenta(feriaId, porCaja, { concepto, fecha }) {
  const entradas = Object.entries(porCaja).filter(([, monto]) => monto > 0);
  if (!entradas.length) return;
  for (const [cajaId, monto] of entradas) {
    await appendMovimiento({
      id: crypto.randomUUID(), cajaId, tipo: 'ingreso', monto, concepto, fecha,
      origen: 'auto', origenRefId: `${feriaId}:${cajaId}`
    });
  }
}

export async function removeMovimientosVenta(feriaId) {
  const movimientos = await fetchMovimientos();
  const viejos = movimientos.filter(m => (m.origenRefId || '').startsWith(`${feriaId}:`));
  // De mayor a menor rowIndex, para que borrar uno no invalide el índice
  // de los que todavía faltan borrar.
  viejos.sort((a, b) => b.rowIndex - a.rowIndex);
  for (const m of viejos) await deleteMovimientoRow(m.rowIndex);
}
