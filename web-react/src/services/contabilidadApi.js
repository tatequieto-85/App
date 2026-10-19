// Módulo Contabilidad — "Cajas" (ingresos/egresos manuales + automáticos) y
// el resumen de ventas por canal se arma leyendo Ferias/CanalesVenta
// directo (ver useContabilidad.js), sin hoja propia para eso. Dos hojas
// nuevas: "ContabilidadCajas" (el catálogo de cajas) y
// "ContabilidadMovimientos" (cada ingreso/egreso, manual o automático).
//
// Por qué los movimientos "automáticos" (fuenteAutomatica='ventas'|'compras'
// en una caja) se generan como una fila más en ContabilidadMovimientos al
// momento de la venta/compra, en vez de sumar Ventas/Compras en vivo cada
// vez que se abre Contabilidad: Compras solo guarda las últimas 10 compras
// por ingrediente (ver pruneOldCompras en comprasApi.js) — sumar "lo que
// hay ahora" en Compras subestimaría el egreso real a medida que se podan
// compras viejas. Generar la fila una sola vez, cuando pasa la compra/venta,
// evita ese problema (igual que el stock corriente de Ingredientes).
import { sheetsReq } from './googleAuth';

let cajasSheetId = null;
let movimientosSheetId = null;

export const FUENTE_AUTOMATICA_OPCIONES = [
  { value: 'ninguna', label: 'Ninguna (manual)' },
  { value: 'ventas', label: 'Automático — ingresos de Ventas' },
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

  const cd = await sheetsReq('/values/ContabilidadCajas!A1').catch(() => ({}));
  if (!cd.values) {
    await sheetsReq('/values/ContabilidadCajas!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Nombre', 'FuenteAutomatica', 'CreadoEn']] })
    });
  }
  const md = await sheetsReq('/values/ContabilidadMovimientos!A1').catch(() => ({}));
  if (!md.values) {
    await sheetsReq('/values/ContabilidadMovimientos!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'CajaId', 'Tipo', 'Monto', 'Concepto', 'Fecha', 'CreadoEn', 'Origen', 'OrigenRefId']] })
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
