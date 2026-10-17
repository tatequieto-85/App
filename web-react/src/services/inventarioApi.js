// Inventario de materia prima (envases, etiquetas, tapas, tarros — insumos
// que NO son ingredientes de receta, esos ya los maneja compras/ingredientes)
// e Inventario de activos (herramientas/maquinaria/equipos de la empresa).
// Dos hojas propias, "InventarioMateriaPrima" e "InventarioActivos" — mismo
// patrón que StockTestigo en stockApi.js.
import { sheetsReq } from './googleAuth';

export const ESTADOS_ACTIVO = ['Operativo', 'En mantenimiento', 'Fuera de servicio'];

let materiaPrimaSheetId = null;
let activosSheetId = null;

export async function ensureInventarioSheets() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasMP = tabs.find(s => s.properties.title === 'InventarioMateriaPrima');
  const hasAct = tabs.find(s => s.properties.title === 'InventarioActivos');

  const reqs = [];
  if (!hasMP) reqs.push({ addSheet: { properties: { title: 'InventarioMateriaPrima' } } });
  if (!hasAct) reqs.push({ addSheet: { properties: { title: 'InventarioActivos' } } });

  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: reqs }) });
    (res.replies || []).forEach(r => {
      if (r.addSheet?.properties?.title === 'InventarioMateriaPrima') materiaPrimaSheetId = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'InventarioActivos') activosSheetId = r.addSheet.properties.sheetId;
    });
  }
  if (hasMP) materiaPrimaSheetId = hasMP.properties.sheetId;
  if (hasAct) activosSheetId = hasAct.properties.sheetId;

  const mpd = await sheetsReq('/values/InventarioMateriaPrima!A1').catch(() => ({}));
  if (!mpd.values) {
    await sheetsReq('/values/InventarioMateriaPrima!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [[
        'ID', 'Nombre', 'Categoria', 'Cantidad', 'Unidad', 'Minimo', 'Observaciones', 'CreatedAt', 'UpdatedAt'
      ]] })
    });
  }

  const actd = await sheetsReq('/values/InventarioActivos!A1').catch(() => ({}));
  if (!actd.values) {
    await sheetsReq('/values/InventarioActivos!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [[
        'ID', 'Nombre', 'Categoria', 'Estado', 'Responsable', 'Observaciones', 'CreatedAt', 'UpdatedAt'
      ]] })
    });
  }
}

// ── Materia prima ────────────────────────────────────────────────────────────

export async function fetchMateriaPrima() {
  const data = await sheetsReq('/values/InventarioMateriaPrima!A:I');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:            r[0] || '',
    nombre:        r[1] || '',
    categoria:     r[2] || '',
    cantidad:      parseFloat(r[3]) || 0,
    unidad:        r[4] || '',
    minimo:        r[5] !== undefined && r[5] !== '' ? parseFloat(r[5]) : null,
    observaciones: r[6] || '',
    createdAt:     r[7] || '',
    updatedAt:     r[8] || '',
    rowIndex:      i + 2
  })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function materiaPrimaRowValues(m) {
  return [
    m.id, m.nombre, m.categoria || '', m.cantidad, m.unidad || '',
    m.minimo === null || m.minimo === undefined ? '' : m.minimo,
    m.observaciones || '', m.createdAt || new Date().toISOString(), new Date().toISOString()
  ];
}

export async function appendMateriaPrima(m) {
  await sheetsReq('/values/InventarioMateriaPrima!A:I:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [materiaPrimaRowValues(m)] })
  });
}

export async function updateMateriaPrima(m) {
  await sheetsReq(`/values/InventarioMateriaPrima!A${m.rowIndex}:I${m.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [materiaPrimaRowValues(m)] })
  });
}

export async function deleteMateriaPrimaRow(rowIndex) {
  if (!materiaPrimaSheetId) await ensureInventarioSheets();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: materiaPrimaSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

// ── Activos ───────────────────────────────────────────────────────────────────

export async function fetchActivos() {
  const data = await sheetsReq('/values/InventarioActivos!A:H');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:            r[0] || '',
    nombre:        r[1] || '',
    categoria:     r[2] || '',
    estado:        r[3] || ESTADOS_ACTIVO[0],
    responsable:   r[4] || '',
    observaciones: r[5] || '',
    createdAt:     r[6] || '',
    updatedAt:     r[7] || '',
    rowIndex:      i + 2
  })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function activoRowValues(a) {
  return [
    a.id, a.nombre, a.categoria || '', a.estado || ESTADOS_ACTIVO[0], a.responsable || '',
    a.observaciones || '', a.createdAt || new Date().toISOString(), new Date().toISOString()
  ];
}

export async function appendActivo(a) {
  await sheetsReq('/values/InventarioActivos!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [activoRowValues(a)] })
  });
}

export async function updateActivo(a) {
  await sheetsReq(`/values/InventarioActivos!A${a.rowIndex}:H${a.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [activoRowValues(a)] })
  });
}

export async function deleteActivoRow(rowIndex) {
  if (!activosSheetId) await ensureInventarioSheets();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: activosSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}
