// Inventario de activos (herramientas/maquinaria/equipos de la empresa) —
// hoja propia "InventarioActivos", mismo patrón que StockTestigo en
// stockApi.js. "Inventario de materia prima" (envases/etiquetas/tapas) vivió
// acá como una sección separada, pero resultó duplicar lo que ya hacía la
// tabla de Insumos una vez que tuvo "Disponible" — se fusionó con el
// catálogo de Ingredientes (ver migrateMateriaPrima() en ingredientesApi.js,
// que migra cualquier fila que haya quedado en la hoja vieja).
import { sheetsReq } from './googleAuth';

export const ESTADOS_ACTIVO = ['Operativo', 'En mantenimiento', 'Fuera de servicio'];

let activosSheetId = null;

export async function ensureInventarioSheets() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasAct = tabs.find(s => s.properties.title === 'InventarioActivos');

  if (!hasAct) {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'InventarioActivos' } } }] })
    });
    (res.replies || []).forEach(r => {
      if (r.addSheet?.properties?.title === 'InventarioActivos') activosSheetId = r.addSheet.properties.sheetId;
    });
  } else {
    activosSheetId = hasAct.properties.sheetId;
  }

  // Bug real (ver stockApi.js): un fallo transitorio acá se disfrazaba de
  // "la hoja está vacía" y :append agregaba el encabezado como fila de
  // datos nueva. Siempre PUT a la fila fija 1.
  const actd = await sheetsReq('/values/InventarioActivos!A1:H1').catch(() => ({}));
  if (!((actd.values || [])[0] || []).length) {
    await sheetsReq('/values/InventarioActivos!A1:H1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [[
        'ID', 'Nombre', 'Categoria', 'Estado', 'Responsable', 'Observaciones', 'CreatedAt', 'UpdatedAt'
      ]] })
    });
  }
}

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
