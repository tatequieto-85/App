// Portado de ../../ingredientes.js (funciones de Sheet CRUD + normalización).
// Columnas en la hoja "Ingredientes": ID, Nombre, CreadoEn, Unidad, Stock,
// Categoria, Minimo. "Stock" (E) — a pedido explícito del usuario: una
// ejecución de receta descuenta el stock de cada ingrediente que usó, una
// compra lo suma. Es un saldo corriente (no una suma histórica de Compras,
// que se podan a las últimas 10 por ingrediente — ver
// comprasApi.pruneOldCompras — así que no sirven como ledger completo): se
// ajusta por delta en cada escritura (useCompras.js/useProcesos.js), no se
// recalcula desde cero. "Categoria"/"Minimo" (F/G) — también a pedido
// explícito: la sección separada "Inventario de materia prima" (envases/
// etiquetas/tapas) resultó duplicar lo que ya hacía esta misma tabla una
// vez que tuvo "Disponible" — se fusionó acá, ver migrateMateriaPrima().
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
      body: JSON.stringify({ values: [['ID', 'Nombre', 'CreadoEn', 'Unidad', 'Stock', 'Categoria', 'Minimo']] })
    });
    return;
  }

  const hd = await sheetsReq('/values/Ingredientes!A1:G1').catch(() => ({}));
  const headerLen = ((hd.values || [])[0] || []).length;
  if (headerLen < 5) {
    await sheetsReq('/values/Ingredientes!E1?valueInputOption=RAW', {
      method: 'PUT', body: JSON.stringify({ values: [['Stock']] })
    });
  }
  if (headerLen < 7) {
    await sheetsReq('/values/Ingredientes!F1:G1?valueInputOption=RAW', {
      method: 'PUT', body: JSON.stringify({ values: [['Categoria', 'Minimo']] })
    });
  }
  await migrateMateriaPrima();
}

export async function fetchIngredientes() {
  const data = await sheetsReq('/values/Ingredientes!A:G');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:        r[0] || '',
    nombre:    r[1] || '',
    creadoEn:  r[2] || '',
    unidad:    r[3] || '',
    stock:     parseFloat(r[4]) || 0,
    categoria: r[5] || '',
    minimo:    r[6] !== undefined && r[6] !== '' ? parseFloat(r[6]) : null,
    rowIndex:  i + 2
  }));
}

export async function appendIngrediente(nombre, unidad, categoria = '', minimo = null) {
  await sheetsReq('/values/Ingredientes!A:G:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), nombre, new Date().toISOString(), unidad || '', 0,
      categoria || '', minimo === null ? '' : minimo
    ]] })
  });
}

export async function updateIngrediente(ing) {
  await sheetsReq(`/values/Ingredientes!A${ing.rowIndex}:G${ing.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      ing.id, ing.nombre, ing.creadoEn, ing.unidad || '', ing.stock || 0,
      ing.categoria || '', ing.minimo === null || ing.minimo === undefined ? '' : ing.minimo
    ]] })
  });
}

// Migración única (idempotente): la vieja sección "Inventario de materia
// prima" (hoja InventarioMateriaPrima) se fusionó con Insumos — cada fila
// que todavía quede ahí se convierte en un ingrediente más (su "Cantidad"
// pasa a ser el Stock inicial) y se borra de la hoja vieja, para no
// duplicar ni perder nada. Se llama en cada ensureIngredientesSheet(); si
// la hoja no existe o ya está vacía, no hace nada.
async function migrateMateriaPrima() {
  const info = await sheetsReq('');
  const tab = (info.sheets || []).find(s => s.properties.title === 'InventarioMateriaPrima');
  if (!tab) return;

  const data = await sheetsReq('/values/InventarioMateriaPrima!A:I').catch(() => ({}));
  const rows = (data.values || []).slice(1).filter(r => r[0]);
  if (!rows.length) return;

  // Si ya existe un ingrediente con el mismo nombre (normalizado — ignora
  // tildes/espacios/plural, ver normalizeIngName), se fusiona SUMANDO el
  // stock en vez de crear un duplicado — mismo criterio que ya usa
  // findDuplicate() en el alta rápida de un ingrediente nuevo.
  let actuales = await fetchIngredientes();
  for (const r of rows) {
    const [, nombre, categoria, cantidad, unidad, minimo] = r;
    const cantidadNum = parseFloat(cantidad) || 0;
    const minimoNum = minimo !== undefined && minimo !== '' ? parseFloat(minimo) : null;
    const existente = findDuplicate(actuales, nombre || '');

    if (existente) {
      await updateIngrediente({
        ...existente,
        stock: (existente.stock || 0) + cantidadNum,
        categoria: existente.categoria || categoria || '',
        minimo: existente.minimo ?? minimoNum
      });
    } else {
      await sheetsReq('/values/Ingredientes!A:G:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
        method: 'POST',
        body: JSON.stringify({ values: [[
          crypto.randomUUID(), nombre || '', new Date().toISOString(), unidad || '',
          cantidadNum, categoria || '', minimoNum === null ? '' : minimoNum
        ]] })
      });
      // Re-leer para que el próximo ítem de este mismo lote vea el que se
      // acaba de crear (por si hay dos filas de materia prima con nombres
      // que matchean entre sí, caso raro pero posible).
      actuales = await fetchIngredientes();
    }
  }

  // De abajo hacia arriba, mismo motivo que el resto de las migraciones de
  // esta app (TareasHistorial, cascade de Contactos): borrar una fila
  // corre hacia arriba el índice de las que quedan.
  const rowIndexes = rows.map((_, i) => i + 2).sort((a, b) => b - a);
  for (const rowIndex of rowIndexes) {
    await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{
        deleteDimension: { range: { sheetId: tab.properties.sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } }
      }] })
    });
  }
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
