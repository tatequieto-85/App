// Catálogo de combos de venta — a pedido explícito del usuario ("armar
// combos"): cada combo define cuántas unidades trae y a qué precio TOTAL
// se vende (un combo de 1 unidad sirve como "precio unitario" normal, no
// hace falta un concepto aparte). El catálogo es global (no por feria);
// cada feria elige cuáles de estos combos va a vender (ver
// `comboIds` en feriasApi.js). Hoja propia "VentaCombos".
import { sheetsReq } from './googleAuth';

let combosSheetId = null;

export async function ensureCombosSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasC = tabs.find(s => s.properties.title === 'VentaCombos');

  if (hasC) {
    combosSheetId = hasC.properties.sheetId;
    return;
  }
  const res = await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'VentaCombos' } } }] })
  });
  const added = res.replies?.[0]?.addSheet?.properties;
  if (added) combosSheetId = added.sheetId;
  await sheetsReq('/values/VentaCombos!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [['ID', 'Nombre', 'Unidades', 'Precio', 'CreadoEn']] })
  });
}

export async function fetchCombos() {
  const data = await sheetsReq('/values/VentaCombos!A:E');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:        r[0] || '',
    nombre:    r[1] || '',
    unidades:  parseInt(r[2]) || 1,
    precio:    parseFloat(r[3]) || 0,
    creadoEn:  r[4] || '',
    rowIndex:  i + 2
  })).sort((a, b) => a.unidades - b.unidades);
}

function comboRowValues(c) {
  return [c.id, c.nombre, c.unidades, c.precio, c.creadoEn || new Date().toISOString()];
}

export async function appendCombo(c) {
  await sheetsReq('/values/VentaCombos!A:E:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [comboRowValues(c)] })
  });
}

export async function updateCombo(c) {
  await sheetsReq(`/values/VentaCombos!A${c.rowIndex}:E${c.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [comboRowValues(c)] })
  });
}

export async function deleteComboRow(rowIndex) {
  if (!combosSheetId) await ensureCombosSheet();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: combosSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}
