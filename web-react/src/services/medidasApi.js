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
// EjecucionProduccionBox.jsx/useProcesos.js). `blockId`: grupo libre al que
// el usuario quiera agruparla (hoja "MedidaBlocks", mismo diseño que
// RecetaBlocks en recetasApi.js) — a pedido explícito del usuario ("que se
// deje agrupar acorde a lo que el usuario quiera"); opcional, una medida sin
// grupo sigue funcionando igual que siempre.
import { sheetsReq } from './googleAuth';

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

let medidasSheetId = null;
let medidaBlocksSheetId = null;

// Mismo motivo que ensureStockSheets()/ensureContabilidadSheets() (ver
// stockApi.js/contabilidadApi.js): React StrictMode (y, en producción, dos
// pestañas/dispositivos abriendo Procesos casi al mismo tiempo) puede
// disparar este efecto dos veces en paralelo — sin esta promesa compartida,
// las dos corridas verían "MedidaBlocks no existe todavía" y cada una
// agregaría su propio encabezado, dejando una fila fantasma con el
// encabezado repetido como si fuera un grupo real (bug real encontrado
// probando el agrupado de medidas recién agregado).
let ensurePromise = null;

export async function ensureMedidasSheet() {
  if (ensurePromise) return ensurePromise;
  ensurePromise = ensureMedidasSheetInner();
  try {
    await ensurePromise;
  } finally {
    ensurePromise = null;
  }
}

async function ensureMedidasSheetInner() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasM = tabs.find(s => s.properties.title === 'Medidas');
  const hasB = tabs.find(s => s.properties.title === 'MedidaBlocks');

  const reqs = [];
  if (!hasM) reqs.push({ addSheet: { properties: { title: 'Medidas' } } });
  if (!hasB) reqs.push({ addSheet: { properties: { title: 'MedidaBlocks' } } });
  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: reqs }) });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'Medidas') medidasSheetId = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'MedidaBlocks') medidaBlocksSheetId = r.addSheet.properties.sheetId;
    });
  }
  if (hasM) medidasSheetId = hasM.properties.sheetId;
  if (hasB) medidaBlocksSheetId = hasB.properties.sheetId;

  if (!hasM) {
    await sheetsReq('/values/Medidas!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Nombre', 'PesoMl', 'CreadoEn', 'RecetaId', 'Insumos', 'BlockId']] })
    });
  } else {
    // RecetaId/Insumos (E/F) — a qué receta pertenece esta medida y su grupo
    // de insumos unitarios, agregado a pedido explícito del usuario (antes
    // vivían anidados en receta.medidas, ese campo quedó sin usar).
    const hd = await sheetsReq('/values/Medidas!A1:G1').catch(() => ({}));
    const hdRow = (hd.values || [])[0] || [];
    if (hdRow.length < 6) {
      await sheetsReq('/values/Medidas!E1:F1?valueInputOption=RAW', {
        method: 'PUT', body: JSON.stringify({ values: [['RecetaId', 'Insumos']] })
      });
    }
    // BlockId (G) — grupo libre, agregado al final igual que el resto de
    // las migraciones de esta hoja, nunca reordenando columnas existentes.
    if (hdRow.length < 7) {
      await sheetsReq('/values/Medidas!G1?valueInputOption=RAW', {
        method: 'PUT', body: JSON.stringify({ values: [['BlockId']] })
      });
    }
  }

  if (!hasB) {
    await sheetsReq('/values/MedidaBlocks!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Nombre', 'CreadoEn', 'SortOrder', 'Color', 'Icono']] })
    });
  }
}

export async function fetchMedidas() {
  const data = await sheetsReq('/values/Medidas!A:G');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id: r[0] || '',
    nombre: r[1] || '',
    pesoMl: parseFloat(r[2]) || 0,
    creadoEn: r[3] || '',
    recetaId: r[4] || '',
    insumos: safeParseJSON(r[5], []),
    blockId: r[6] || '',
    rowIndex: i + 2
  }));
}

export async function appendMedida({ nombre, pesoMl, recetaId, insumos, blockId }) {
  const id = crypto.randomUUID();
  await sheetsReq('/values/Medidas!A:G:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      id, nombre, pesoMl || 0, new Date().toISOString(), recetaId || '', JSON.stringify(insumos || []), blockId || ''
    ]] })
  });
  return id;
}

export async function updateMedida(medida) {
  await sheetsReq(`/values/Medidas!A${medida.rowIndex}:G${medida.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      medida.id, medida.nombre, medida.pesoMl || 0, medida.creadoEn, medida.recetaId || '',
      JSON.stringify(medida.insumos || []), medida.blockId || ''
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

// ── Grupos (MedidaBlocks): CRUD — mismo diseño que RecetaBlocks en
// recetasApi.js, pero opcional: a diferencia de los grupos de recetas, una
// medida sin grupo sigue siendo válida y visible (ver "Sin grupo" en
// MedidasCatalogSection.jsx). ────────────────────────────────────────────────

export async function fetchMedidaBlocks() {
  const data = await sheetsReq('/values/MedidaBlocks!A:F');
  const rows = (data.values || []).slice(1);
  const blocks = rows.filter(r => r[0]).map((r, i) => ({
    id: r[0] || '',
    nombre: r[1] || '',
    creadoEn: r[2] || '',
    sortOrder: r[3] !== undefined && r[3] !== '' ? +r[3] : i,
    color: r[4] || '',
    icono: r[5] || '',
    rowIndex: i + 2
  }));
  blocks.sort((a, b) => a.sortOrder - b.sortOrder);
  return blocks;
}

export async function appendMedidaBlock(block, sortOrder) {
  await sheetsReq('/values/MedidaBlocks!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[block.id, block.nombre, block.creadoEn, sortOrder, block.color || '', block.icono || '']] })
  });
}

export async function updateMedidaBlock(block) {
  await sheetsReq(`/values/MedidaBlocks!A${block.rowIndex}:F${block.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[block.id, block.nombre, block.creadoEn, block.sortOrder ?? 0, block.color || '', block.icono || '']] })
  });
}

export async function deleteMedidaBlockRow(rowIndex) {
  if (!medidaBlocksSheetId) await ensureMedidasSheet();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: medidaBlocksSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}
