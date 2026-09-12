// Portado de initCanalesVentaSheet()/loadCanales()/appendCanal()/updateCanal()/
// deleteCanalRow() en ../../ferias.js — hoja "CanalesVenta". Mismo
// patrón/layout que RecetaBlocks en procesos.js (grupos con sortOrder).
import { sheetsReq } from './googleAuth';

let canalesSheetId = null;

export async function ensureCanalesVentaSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasC = tabs.find(s => s.properties.title === 'CanalesVenta');
  if (hasC) {
    canalesSheetId = hasC.properties.sheetId;
    return;
  }
  const res = await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'CanalesVenta' } } }] })
  });
  const added = res.replies?.[0]?.addSheet?.properties;
  if (added) canalesSheetId = added.sheetId;
  await sheetsReq('/values/CanalesVenta!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [['ID', 'Nombre', 'CreadoEn', 'SortOrder', 'Color', 'Icono']] })
  });
}

export async function fetchCanales() {
  const data = await sheetsReq('/values/CanalesVenta!A:F');
  const rows = (data.values || []).slice(1);
  const canales = rows.filter(r => r[0]).map((r, i) => ({
    id:        r[0] || '',
    nombre:    r[1] || '',
    creadoEn:  r[2] || '',
    sortOrder: r[3] !== undefined && r[3] !== '' ? +r[3] : i,
    color:     r[4] || '',
    icono:     r[5] || '',
    rowIndex:  i + 2
  }));
  canales.sort((a, b) => a.sortOrder - b.sortOrder);
  return canales;
}

export async function appendCanal(canal, sortOrder) {
  await sheetsReq('/values/CanalesVenta!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[canal.id, canal.nombre, canal.creadoEn, sortOrder, canal.color || '', canal.icono || '']] })
  });
}

export async function updateCanal(canal) {
  await sheetsReq(`/values/CanalesVenta!A${canal.rowIndex}:F${canal.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[canal.id, canal.nombre, canal.creadoEn, canal.sortOrder ?? 0, canal.color || '', canal.icono || '']] })
  });
}

export async function deleteCanalRow(rowIndex) {
  if (!canalesSheetId) await ensureCanalesVentaSheet();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: canalesSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}
