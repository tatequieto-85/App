// Portado de procesos.js (solo la parte de Recetas — grupos, receta en sí,
// nivel de picante, % de ingredientes). Ejecuciones de lote (cronómetro +
// evaluación) todavía no se migran, ver memoria del piloto. Mismo Sheet
// real que ya usa la app vanilla — hojas "RecetasPlantillas" y "RecetaBlocks".
import { sheetsReq } from './googleAuth';
import { hexToRgba } from '../utils/format';

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

let recetasSheetId = null;
let recetaBlocksSheetId = null;

// ── Sheets init (idempotente) ───────────────────────────────────────────────

export async function ensureRecetasSheets() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasR = tabs.find(s => s.properties.title === 'RecetasPlantillas');
  const hasB = tabs.find(s => s.properties.title === 'RecetaBlocks');

  if (hasR) recetasSheetId = hasR.properties.sheetId;
  if (hasB) recetaBlocksSheetId = hasB.properties.sheetId;

  const reqs = [];
  if (!hasR) reqs.push({ addSheet: { properties: { title: 'RecetasPlantillas' } } });
  if (!hasB) reqs.push({ addSheet: { properties: { title: 'RecetaBlocks' } } });
  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: reqs }) });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'RecetasPlantillas') recetasSheetId = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'RecetaBlocks') recetaBlocksSheetId = r.addSheet.properties.sheetId;
    });
  }

  const rd = await sheetsReq('/values/RecetasPlantillas!A1:H1').catch(() => ({}));
  const rdRow = (rd.values || [])[0] || [];
  if (rdRow.length < 7) {
    await sheetsReq('/values/RecetasPlantillas!A1:H1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['ID', 'Nombre', 'Descripcion', 'Etapas', 'CreadoEn', 'IngredientesMaestros', 'BlockId', 'NivelPicante']] })
    });
  } else if (rdRow.length < 8) {
    await sheetsReq('/values/RecetasPlantillas!H1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['NivelPicante']] })
    });
  }

  const bd = await sheetsReq('/values/RecetaBlocks!A1:F1').catch(() => ({}));
  if (!bd.values) {
    await sheetsReq('/values/RecetaBlocks!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Nombre', 'CreadoEn', 'SortOrder', 'Color', 'Icono']] })
    });
  } else if ((bd.values[0] || []).length < 6) {
    await sheetsReq('/values/RecetaBlocks!F1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['Icono']] })
    });
  }
}

// ── Recetas: CRUD ────────────────────────────────────────────────────────────

export async function fetchRecetas() {
  const data = await sheetsReq('/values/RecetasPlantillas!A:H');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id: r[0] || '',
    nombre: r[1] || '',
    descripcion: r[2] || '',
    etapas: safeParseJSON(r[3], []),
    creadoEn: r[4] || '',
    ingredientesMaestros: safeParseJSON(r[5], []),
    blockId: r[6] || '',
    nivelPicante: r[7] || '',
    rowIndex: i + 2
  }));
}

export async function appendReceta(rec) {
  await sheetsReq('/values/RecetasPlantillas!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      rec.id, rec.nombre, rec.descripcion || '', JSON.stringify(rec.etapas || []), rec.creadoEn,
      JSON.stringify(rec.ingredientesMaestros || []), rec.blockId || '', rec.nivelPicante || ''
    ]] })
  });
}

export async function updateReceta(rec) {
  await sheetsReq(`/values/RecetasPlantillas!A${rec.rowIndex}:H${rec.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      rec.id, rec.nombre, rec.descripcion || '', JSON.stringify(rec.etapas || []), rec.creadoEn,
      JSON.stringify(rec.ingredientesMaestros || []), rec.blockId || '', rec.nivelPicante || ''
    ]] })
  });
}

export async function deleteRecetaRow(rowIndex) {
  if (!recetasSheetId) await ensureRecetasSheets();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: recetasSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

// ── Grupos (RecetaBlocks): CRUD ──────────────────────────────────────────────

export async function fetchRecetaBlocks() {
  const data = await sheetsReq('/values/RecetaBlocks!A:F');
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

export async function appendRecetaBlock(block, sortOrder) {
  await sheetsReq('/values/RecetaBlocks!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[block.id, block.nombre, block.creadoEn, sortOrder, block.color || '', block.icono || '']] })
  });
}

export async function updateRecetaBlock(block) {
  await sheetsReq(`/values/RecetaBlocks!A${block.rowIndex}:F${block.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[block.id, block.nombre, block.creadoEn, block.sortOrder ?? 0, block.color || '', block.icono || '']] })
  });
}

export async function deleteRecetaBlockRow(rowIndex) {
  if (!recetaBlocksSheetId) await ensureRecetasSheets();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: recetaBlocksSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

// ── Nivel de picante (fijo por receta, detectado solo — nunca se elige a
// mano) — portado 1:1 de procesos.js. De más suave a más fuerte. ───────────

export const NIVEL_PICANTE_ORDEN = ['tranqui', 'cayena', 'habanero', 'ghost', 'carolina reaper'];
export const NIVEL_PICANTE_INFO = {
  tranqui: { label: 'Tranqui', color: '#7B4B28' },
  cayena: { label: 'Cayena', color: '#2E7D32' },
  habanero: { label: 'Habanero', color: '#F97316' },
  ghost: { label: 'Ghost', color: '#7B1E3A' },
  'carolina reaper': { label: 'Carolina Reaper', color: '#3B0A0A' }
};

function normalizeParaPicante(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Recorre los ingredientes de la receta de más picante a menos y devuelve
// el primero que encuentre mencionado en algún nombre de ingrediente.
export function detectNivelPicante(ingredientesMaestros) {
  const nombres = (ingredientesMaestros || []).map(ing => normalizeParaPicante(ing.nombre));
  for (let i = NIVEL_PICANTE_ORDEN.length - 1; i >= 1; i--) {
    const nivel = NIVEL_PICANTE_ORDEN[i];
    if (nombres.some(n => n.includes(nivel))) return nivel;
  }
  return 'tranqui';
}

export function nivelPicanteStyle(nivel) {
  const info = NIVEL_PICANTE_INFO[nivel] || NIVEL_PICANTE_INFO.tranqui;
  return { bg: hexToRgba(info.color, .14), borderColor: `${info.color}55`, label: info.label, color: info.color };
}

// ── Etapas fijas (Limpieza inicial/final) ────────────────────────────────────
// Toda receta las lleva, auto-agregadas e invisibles en el editor — para
// que una ejecución de lote (todavía no migrada) encuentre los mismos pasos
// de limpieza al principio y al final, igual que en la app vanilla.

export const LIMPIEZA_ETAPA = {
  nombre: 'Limpieza',
  instrucciones: [
    { text: 'Limpieza de barril', tipo: 'viñeta' },
    { text: 'Limpieza de pisos', tipo: 'viñeta' },
    { text: 'Limpieza de zona', tipo: 'viñeta' }
  ],
  insumos: [],
  fija: true
};

export function buildEtapasFull(middleEtapas) {
  return [
    { ...LIMPIEZA_ETAPA, id: crypto.randomUUID() },
    ...middleEtapas,
    { ...LIMPIEZA_ETAPA, id: crypto.randomUUID() }
  ];
}

// ── % de cada ingrediente respecto al peso total de la receta ───────────────
// A pedido del usuario: 1 ml equivale a 1 g (densidad ~agua) para poder
// sumar ingredientes en distintas unidades a un solo total. Unidades no
// convertibles a peso (p. ej. "unidades") quedan afuera del total y
// muestran "—" en vez de un porcentaje.

const UNIDAD_A_GRAMOS = {
  g: 1, gr: 1, gramo: 1, gramos: 1,
  kg: 1000, kilo: 1000, kilos: 1000, kilogramo: 1000, kilogramos: 1000,
  ml: 1, mililitro: 1, mililitros: 1,
  l: 1000, lt: 1000, litro: 1000, litros: 1000
};

export function pesoEnGramos(cantidad, unidad) {
  const factor = UNIDAD_A_GRAMOS[(unidad || '').trim().toLowerCase()];
  if (factor == null) return null;
  return (Number(cantidad) || 0) * factor;
}

// true si la unidad es de peso/volumen (entra al total y al % de la
// receta); false para "unidades" u otra unidad de conteo — esas se
// separan del todo, a pedido del usuario ("todo lo que sea unidad se
// separe de lo que son otras medidas de peso").
export function esUnidadDePeso(unidad) {
  return UNIDAD_A_GRAMOS[(unidad || '').trim().toLowerCase()] != null;
}

// Formato legible del peso total: en kg con hasta 2 decimales si llega a
// 1000 g, si no en gramos enteros.
export function fmtPesoGramos(g) {
  if (g >= 1000) return `${(g / 1000).toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;
  return `${Math.round(g).toLocaleString('es-CO')} g`;
}

// filas: [{ nombre, cantidadTotal, unidad }] → misma lista con `.porcentaje`
// agregado (0-100, o null si su unidad no es convertible a peso).
export function calcularPorcentajes(filas) {
  const pesos = filas.map(f => pesoEnGramos(f.cantidadTotal, f.unidad));
  const total = pesos.reduce((s, p) => s + (p || 0), 0);
  return filas.map((f, i) => ({
    ...f,
    porcentaje: pesos[i] != null && total > 0 ? (pesos[i] / total) * 100 : null
  }));
}
