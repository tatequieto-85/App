// Portado de ../../ingredientes.js (funciones de Sheet CRUD + normalización).
// Mismo layout de columnas (ID, Nombre, CreadoEn, Unidad) en la hoja "Ingredientes".
import { sheetsReq } from './googleAuth';

let ingredientesSheetId = null;

export async function ensureIngredientesSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasI = tabs.find(s => s.properties.title === 'Ingredientes');

  if (hasI) {
    ingredientesSheetId = hasI.properties.sheetId;
    return;
  }
  const res = await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Ingredientes' } } }] })
  });
  const added = res.replies?.[0]?.addSheet?.properties;
  if (added) ingredientesSheetId = added.sheetId;
  await sheetsReq('/values/Ingredientes!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [['ID', 'Nombre', 'CreadoEn', 'Unidad']] })
  });
}

export async function fetchIngredientes() {
  const data = await sheetsReq('/values/Ingredientes!A:D');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:       r[0] || '',
    nombre:   r[1] || '',
    creadoEn: r[2] || '',
    unidad:   r[3] || '',
    rowIndex: i + 2
  }));
}

export async function appendIngrediente(nombre, unidad) {
  await sheetsReq('/values/Ingredientes!A:D:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[crypto.randomUUID(), nombre, new Date().toISOString(), unidad || '']] })
  });
}

export async function updateIngrediente(ing) {
  await sheetsReq(`/values/Ingredientes!A${ing.rowIndex}:D${ing.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[ing.id, ing.nombre, ing.creadoEn, ing.unidad || '']] })
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
