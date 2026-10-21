// Portado de ../../compras.js — mismo layout de columnas en la hoja "Compras"
// (ID, Ingrediente, Cantidad, PrecioTotal, Fecha, CreadoEn, CajaId).
import { sheetsReq } from './googleAuth';
import { normalizeIngName } from './ingredientesApi';

let comprasSheetId = null;

export async function ensureComprasSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasC = tabs.find(s => s.properties.title === 'Compras');

  if (hasC) {
    comprasSheetId = hasC.properties.sheetId;
  } else {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Compras' } } }] })
    });
    const added = res.replies?.[0]?.addSheet?.properties;
    if (added) comprasSheetId = added.sheetId;
    await sheetsReq('/values/Compras!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Ingrediente', 'Cantidad', 'PrecioTotal', 'Fecha', 'CreadoEn', 'CajaId']] })
    });
    return;
  }

  // CajaId (G) — de qué caja de Contabilidad salió la plata de esta
  // compra, a pedido explícito del usuario ("no me pide la caja a
  // descontar") — antes era una caja fija configurada una sola vez
  // (fuenteAutomatica='compras'), ahora se elige en cada compra (ver
  // CompraModal.jsx), igual que Ventas pregunta por caja al cerrar una feria.
  const hd = await sheetsReq('/values/Compras!A1:G1').catch(() => ({}));
  if (((hd.values || [])[0] || []).length < 7) {
    await sheetsReq('/values/Compras!G1?valueInputOption=RAW', {
      method: 'PUT', body: JSON.stringify({ values: [['CajaId']] })
    });
  }
}

export async function fetchCompras() {
  const data = await sheetsReq('/values/Compras!A:G');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:          r[0] || '',
    ingrediente: r[1] || '',
    cantidad:    parseFloat(r[2]) || 0,
    precioTotal: parseFloat(r[3]) || 0,
    fecha:       r[4] || '',
    creadoEn:    r[5] || '',
    cajaId:      r[6] || '',
    rowIndex:    i + 2
  }));
}

// id: generado por quien llama (useCompras.js) — así Contabilidad puede
// enlazar su movimiento automático a esta compra desde el mismo momento en
// que se crea, sin tener que releer la hoja para saber qué id le tocó.
export async function appendCompra(c) {
  await sheetsReq('/values/Compras!A:G:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      c.id || crypto.randomUUID(), c.ingrediente, c.cantidad, c.precioTotal, c.fecha, new Date().toISOString(), c.cajaId || ''
    ]] })
  });
}

export async function updateCompra(c) {
  await sheetsReq(`/values/Compras!A${c.rowIndex}:G${c.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[c.id, c.ingrediente, c.cantidad, c.precioTotal, c.fecha, c.creadoEn, c.cajaId || '']] })
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

// Al corregir el nombre de un insumo en el catálogo (ver InsumoModal.jsx,
// "Editar insumo"), las compras ya registradas con el nombre viejo quedan
// huérfanas — normalizeIngName ya no las matchea contra el ingrediente
// renombrado, y "Última compra"/"Precio unitario" se verían vacíos pese a
// tener historial. Esto las actualiza en bloque al nombre nuevo.
export async function renameIngredienteEnCompras(compras, nombreViejo, nombreNuevo) {
  const afectadas = comprasForIngrediente(compras, nombreViejo);
  for (const c of afectadas) {
    await updateCompra({ ...c, ingrediente: nombreNuevo });
  }
}

// Exportada: también la usa Procesos para el precio estimado de un lote a
// partir de la receta (ver computeCostoReceta en recetasApi.js).
export function getUnitPrice(compras, nombre) {
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
