// Portado de ../../ingredientes.js (funciones de Sheet CRUD + normalización).
// Mismo layout de columnas (ID, Nombre, CreadoEn, Unidad) en la hoja
// "Ingredientes", más "Stock" (columna E) — a pedido explícito del usuario:
// una ejecución de receta descuenta el stock de cada ingrediente que usó,
// una compra lo suma. Es un saldo corriente (no una suma histórica de
// Compras, que se podan a las últimas 10 por ingrediente — ver
// comprasApi.pruneOldCompras — así que no sirven como ledger completo):
// se ajusta por delta en cada escritura (useCompras.js/useProcesos.js), no
// se recalcula desde cero.
import { sheetsReq } from './googleAuth';

let ingredientesSheetId = null;

export async function ensureIngredientesSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasI = tabs.find(s => s.properties.title === 'Ingredientes');

  if (hasI) {
    ingredientesSheetId = hasI.properties.sheetId;
  } else {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Ingredientes' } } }] })
    });
    const added = res.replies?.[0]?.addSheet?.properties;
    if (added) ingredientesSheetId = added.sheetId;
    await sheetsReq('/values/Ingredientes!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Nombre', 'CreadoEn', 'Unidad', 'Stock']] })
    });
    return;
  }

  const hd = await sheetsReq('/values/Ingredientes!A1:E1').catch(() => ({}));
  if (((hd.values || [])[0] || []).length < 5) {
    await sheetsReq('/values/Ingredientes!E1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['Stock']] })
    });
  }
}

export async function fetchIngredientes() {
  const data = await sheetsReq('/values/Ingredientes!A:E');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:       r[0] || '',
    nombre:   r[1] || '',
    creadoEn: r[2] || '',
    unidad:   r[3] || '',
    stock:    parseFloat(r[4]) || 0,
    rowIndex: i + 2
  }));
}

export async function appendIngrediente(nombre, unidad) {
  await sheetsReq('/values/Ingredientes!A:E:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[crypto.randomUUID(), nombre, new Date().toISOString(), unidad || '', 0]] })
  });
}

export async function updateIngrediente(ing) {
  await sheetsReq(`/values/Ingredientes!A${ing.rowIndex}:E${ing.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[ing.id, ing.nombre, ing.creadoEn, ing.unidad || '', ing.stock || 0]] })
  });
}

export async function deleteIngredienteRow(rowIndex) {
  if (!ingredientesSheetId) await ensureIngredientesSheet();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: ingredientesSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

export function normalizeIngName(name) {
  return (name || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/s$/, '');
}

export function findDuplicate(list, nombre) {
  const norm = normalizeIngName(nombre);
  return list.find(ing => normalizeIngName(ing.nombre) === norm) || null;
}

// ── Stock corriente ──────────────────────────────────────────────────────────
// Ajuste por delta, nunca recalculado desde cero (ver comentario arriba).
// Si el ingrediente ya no existe en el catálogo (se borró), no hay nada
// que ajustar — se ignora en silencio, igual que "incompleto" en los
// cálculos de costo cuando falta un precio.

export async function applyStockDelta(ingredientes, nombre, delta) {
  if (!delta) return;
  const ing = findDuplicate(ingredientes, nombre);
  if (!ing) return;
  await updateIngrediente({ ...ing, stock: (ing.stock || 0) + delta });
}

function sumCantidadByName(list) {
  const map = new Map();
  (list || []).forEach(item => {
    const key = normalizeIngName(item.nombre);
    if (!key) return;
    const cantidad = Number(item.cantidadComprada ?? item.cantidad) || 0;
    map.set(key, (map.get(key) || 0) + cantidad);
  });
  return map;
}

// Descuenta lo CONSUMIDO en una ejecución — comparado contra lo que esa
// misma ejecución ya había descontado antes (prevList), para que editar
// una ejecución ya guardada ajuste solo la diferencia en vez de
// descontar dos veces. prevList=[] en el primer guardado (todo es delta).
export async function applyStockDeltas(ingredientes, prevList, newList) {
  const prevMap = sumCantidadByName(prevList);
  const newMap = sumCantidadByName(newList);
  const keys = new Set([...prevMap.keys(), ...newMap.keys()]);
  for (const key of keys) {
    const consumoDelta = (newMap.get(key) || 0) - (prevMap.get(key) || 0);
    if (!consumoDelta) continue;
    const ing = ingredientes.find(i => normalizeIngName(i.nombre) === key);
    if (!ing) continue;
    await updateIngrediente({ ...ing, stock: (ing.stock || 0) - consumoDelta });
  }
}
