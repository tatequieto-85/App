// Portado de ../../compras.js — mismo layout de columnas en la hoja "Compras"
// (ID, Ingrediente, Cantidad, PrecioTotal, Fecha, CreadoEn).
import { sheetsReq } from './googleAuth';
import { normalizeIngName } from './ingredientesApi';

let comprasSheetId = null;

export async function ensureComprasSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasC = tabs.find(s => s.properties.title === 'Compras');

  if (hasC) {
    comprasSheetId = hasC.properties.sheetId;
    return;
  }
  const res = await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Compras' } } }] })
  });
  const added = res.replies?.[0]?.addSheet?.properties;
  if (added) comprasSheetId = added.sheetId;
  await sheetsReq('/values/Compras!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [['ID', 'Ingrediente', 'Cantidad', 'PrecioTotal', 'Fecha', 'CreadoEn']] })
  });
}

export async function fetchCompras() {
  const data = await sheetsReq('/values/Compras!A:F');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:          r[0] || '',
    ingrediente: r[1] || '',
    cantidad:    parseFloat(r[2]) || 0,
    precioTotal: parseFloat(r[3]) || 0,
    fecha:       r[4] || '',
    creadoEn:    r[5] || '',
    rowIndex:    i + 2
  }));
}

export async function appendCompra(c) {
  await sheetsReq('/values/Compras!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), c.ingrediente, c.cantidad, c.precioTotal, c.fecha, new Date().toISOString()
    ]] })
  });
}

export async function updateCompra(c) {
  await sheetsReq(`/values/Compras!A${c.rowIndex}:F${c.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[c.id, c.ingrediente, c.cantidad, c.precioTotal, c.fecha, c.creadoEn]] })
  });
}

export async function deleteCompraRow(rowIndex) {
  if (!comprasSheetId) await ensureComprasSheet();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: comprasSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

export function comprasForIngrediente(compras, nombre) {
  const key = normalizeIngName(nombre);
  return compras.filter(c => normalizeIngName(c.ingrediente) === key);
}

// Más reciente primero (por fecha de compra y, a igualdad, por cuándo se cargó).
function byRecency(a, b) {
  const da = a.fecha || a.creadoEn || '';
  const db = b.fecha || b.creadoEn || '';
  if (da !== db) return da < db ? 1 : -1;
  return (a.creadoEn || '') < (b.creadoEn || '') ? 1 : -1;
}

export function getLatestCompra(compras, nombre) {
  const list = comprasForIngrediente(compras, nombre);
  if (!list.length) return null;
  return list.slice().sort(byRecency)[0];
}

export const MAX_COMPRAS_POR_INGREDIENTE = 10;

// Se llama después de registrar una compra nueva: borra las compras más
// viejas de ese ingrediente que sobren por encima de las últimas
// MAX_COMPRAS_POR_INGREDIENTE — a pedido del usuario, para no acumular
// historial indefinidamente. `compras` debe venir recién leído de la hoja
// (con los rowIndex vigentes, incluida la fila que se acaba de agregar).
export async function pruneOldCompras(compras, nombre, keep = MAX_COMPRAS_POR_INGREDIENTE) {
  const excedente = comprasForIngrediente(compras, nombre).sort(byRecency).slice(keep);
  if (!excedente.length) return;
  // De mayor a menor rowIndex: borrar una fila no debe invalidar el índice
  // de las que todavía faltan borrar.
  const porBorrar = excedente.slice().sort((a, b) => b.rowIndex - a.rowIndex);
  for (const c of porBorrar) {
    await deleteCompraRow(c.rowIndex);
  }
}

function getUnitPrice(compras, nombre) {
  const last = getLatestCompra(compras, nombre);
  if (!last || !last.cantidad) return null;
  return last.precioTotal / last.cantidad;
}

// Usado por Procesos (evaluación de costo de un lote) — se porta acá porque
// el precio unitario sale de Compras, igual que en la app vanilla.
export function computeCostoProduccion(compras, etapasData) {
  let total = 0;
  const incompleto = [];
  (etapasData || []).forEach(stage => {
    (stage.insumosConfirmados || []).forEach(ins => {
      const qty = parseFloat(ins.cantidadReal) || 0;
      if (!qty) return;
      const price = getUnitPrice(compras, ins.nombre);
      if (price == null) {
        if (!incompleto.includes(ins.nombre)) incompleto.push(ins.nombre);
        return;
      }
      total += qty * price;
    });
  });
  return { total, incompleto };
}
