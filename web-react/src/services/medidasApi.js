// Catálogo de medidas/tamaños de empaque (ej. "230 ml", "130 ml") — a pedido
// explícito del usuario. Cada medida vive atada a UNA receta puntual (no es
// un nombre abstracto reutilizable entre sabores — "cada medida debe
// guardar insumos de unidad con cantidad, asociarlo a una receta") y trae su
// propio grupo de insumos unitarios (frasco/etiqueta/tapa, distinto por
// sabor). `pesoMl` es cuánto de la mezcla entra en ese frasco, EN GRAMOS
// (a pedido explícito del usuario — el nombre del campo quedó como estaba
// para no tener que migrar la hoja, pero la etiqueta que ve el usuario y
// todo el cálculo de escalado tratan este número como gramos, mismo
// criterio 1 ml = 1 g que el resto de la app) — es la base para escalar
// insumos de peso en la Calculadora de Ventas y para el puente de
// compatibilidad con los campos legacy frascos230/frascos130 de Stock (ver
// EjecucionProduccionBox.jsx/useProcesos.js).
import { sheetsReq } from './googleAuth';

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

let medidasSheetId = null;

export async function ensureMedidasSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasM = tabs.find(s => s.properties.title === 'Medidas');

  if (hasM) {
    medidasSheetId = hasM.properties.sheetId;
  } else {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Medidas' } } }] })
    });
    const added = res.replies?.[0]?.addSheet?.properties;
    if (added) medidasSheetId = added.sheetId;
    await sheetsReq('/values/Medidas!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Nombre', 'PesoMl', 'CreadoEn', 'RecetaId', 'Insumos']] })
    });
    return;
  }

  // RecetaId/Insumos (E/F) — a qué receta pertenece esta medida y su grupo
  // de insumos unitarios, agregado a pedido explícito del usuario (antes
  // vivían anidados en receta.medidas, ese campo quedó sin usar).
  const hd = await sheetsReq('/values/Medidas!A1:F1').catch(() => ({}));
  const hdRow = (hd.values || [])[0] || [];
  if (hdRow.length < 6) {
    await sheetsReq('/values/Medidas!E1:F1?valueInputOption=RAW', {
      method: 'PUT', body: JSON.stringify({ values: [['RecetaId', 'Insumos']] })
    });
  }
}

export async function fetchMedidas() {
  const data = await sheetsReq('/values/Medidas!A:F');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id: r[0] || '',
    nombre: r[1] || '',
    pesoMl: parseFloat(r[2]) || 0,
    creadoEn: r[3] || '',
    recetaId: r[4] || '',
    insumos: safeParseJSON(r[5], []),
    rowIndex: i + 2
  }));
}

export async function appendMedida({ nombre, pesoMl, recetaId, insumos }) {
  const id = crypto.randomUUID();
  await sheetsReq('/values/Medidas!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      id, nombre, pesoMl || 0, new Date().toISOString(), recetaId || '', JSON.stringify(insumos || [])
    ]] })
  });
  return id;
}

export async function updateMedida(medida) {
  await sheetsReq(`/values/Medidas!A${medida.rowIndex}:F${medida.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      medida.id, medida.nombre, medida.pesoMl || 0, medida.creadoEn, medida.recetaId || '', JSON.stringify(medida.insumos || [])
    ]] })
  });
}

export async function deleteMedidaRow(rowIndex) {
  if (!medidasSheetId) await ensureMedidasSheet();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: medidasSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}
