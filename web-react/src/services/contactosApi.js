// Portado de ../../contactos.js — hojas "Contactos" y "ContactosRelaciones".
import { sheetsReq } from './googleAuth';

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// Datos viejos (de antes de guardar observaciones como lista) tenían
// Observaciones como texto plano — se migran solas al leer.
function parseObservaciones(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* no era JSON */ }
  return [{ text: raw, createdAt: '' }];
}

export async function ensureContactosSheets() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasC = tabs.find(s => s.properties.title === 'Contactos');
  const hasR = tabs.find(s => s.properties.title === 'ContactosRelaciones');

  const reqs = [];
  if (!hasC) reqs.push({ addSheet: { properties: { title: 'Contactos' } } });
  if (!hasR) reqs.push({ addSheet: { properties: { title: 'ContactosRelaciones' } } });
  if (reqs.length) {
    await sheetsReq(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: reqs }) });
  }

  const cd = await sheetsReq('/values/Contactos!A1:K1').catch(() => ({}));
  if (!cd.values) {
    await sheetsReq('/values/Contactos!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Nombre', 'Cumpleanos', 'EdadIngreso', 'FechaIngreso', 'Observaciones', 'CreadoEn', 'Empresa', 'Posicion', 'Telefono', 'Ciudad']] })
    });
  }

  const rd = await sheetsReq('/values/ContactosRelaciones!A1:F1').catch(() => ({}));
  if (!rd.values) {
    await sheetsReq('/values/ContactosRelaciones!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'ContactoAId', 'ContactoBId', 'Categoria', 'CreadoEn', 'Tipo']] })
    });
  }
}

export async function fetchContactos() {
  const data = await sheetsReq('/values/Contactos!A:K');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:            r[0] || '',
    nombre:        r[1] || '',
    cumpleanos:    r[2] || '',
    edadIngreso:   r[3] !== undefined && r[3] !== '' ? +r[3] : null,
    fechaIngreso:  r[4] || '',
    observaciones: parseObservaciones(r[5]),
    creadoEn:      r[6] || '',
    empresa:       r[7] || '',
    posicion:      r[8] || '',
    telefono:      r[9] || '',
    ciudad:        r[10] || '',
    rowIndex:      i + 2
  })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function fetchRelaciones() {
  const data = await sheetsReq('/values/ContactosRelaciones!A:F');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:          r[0] || '',
    contactoAId: r[1] || '',
    contactoBId: r[2] || '',
    categoria:   r[3] || '',
    creadoEn:    r[4] || '',
    // Vínculos guardados antes de separar "Trabajo" no tienen tipo.
    tipo:        r[5] || 'relacion',
    rowIndex:    i + 2
  }));
}

export async function appendContacto(c) {
  await sheetsReq('/values/Contactos!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), c.nombre, c.cumpleanos, c.edadIngreso ?? '', new Date().toISOString(),
      '[]', new Date().toISOString(), c.empresa || '', c.posicion || '', c.telefono || '', c.ciudad || ''
    ]] })
  });
}

export async function updateContacto(c) {
  await sheetsReq(`/values/Contactos!B${c.rowIndex}:K${c.rowIndex}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      c.nombre, c.cumpleanos, c.edadIngreso ?? '', c.fechaIngreso, JSON.stringify(c.observaciones || []),
      c.creadoEn, c.empresa || '', c.posicion || '', c.telefono || '', c.ciudad || ''
    ]] })
  });
}

let contactosSheetId = null;
export async function deleteContactoRow(rowIndex) {
  if (contactosSheetId === null) {
    const info = await sheetsReq('');
    const tab = info.sheets.find(s => s.properties.title === 'Contactos');
    if (tab) contactosSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{
      deleteDimension: { range: { sheetId: contactosSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } }
    }] })
  });
}

let relacionesSheetId = null;
export async function deleteRelacionRow(rowIndex) {
  if (relacionesSheetId === null) {
    const info = await sheetsReq('');
    const tab = info.sheets.find(s => s.properties.title === 'ContactosRelaciones');
    if (tab) relacionesSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{
      deleteDimension: { range: { sheetId: relacionesSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } }
    }] })
  });
}

export async function appendRelacion(contactoAId, contactoBId, categoria, tipo) {
  await sheetsReq('/values/ContactosRelaciones!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[crypto.randomUUID(), contactoAId, contactoBId, categoria, new Date().toISOString(), tipo]] })
  });
}

export async function appendObservacion(contacto, text) {
  const observaciones = [...(contacto.observaciones || []), { text, createdAt: new Date().toISOString() }];
  await sheetsReq(`/values/Contactos!F${contacto.rowIndex}:F${contacto.rowIndex}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[JSON.stringify(observaciones)]] })
  });
  return observaciones;
}

// ── Cálculo puro (edad nunca se guarda — se recalcula cada vez que se muestra) ──

export function edadActual(c) {
  if (c.edadIngreso === null || c.edadIngreso === undefined || !c.fechaIngreso) return c.edadIngreso;
  const start = new Date(c.fechaIngreso);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const pasoAniversario = now.getMonth() > start.getMonth()
    || (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate());
  if (!pasoAniversario) years--;
  return c.edadIngreso + Math.max(0, years);
}

export function fmtCumpleanos(mmdd) {
  if (!mmdd) return '';
  const [mes, dia] = mmdd.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${+dia} ${meses[+mes - 1] || ''}`;
}

const DEFAULT_CATEGORIAS = ['Amigos', 'Familia'];

// Solo categorías de vínculos tipo "relación" — las de "trabajo" son
// nombres de empresa, no deberían mezclarse en este predictivo.
export function categoriasDeRelacion(relaciones) {
  const usadas = [...new Set(relaciones.filter(r => r.tipo !== 'trabajo').map(r => r.categoria).filter(Boolean))];
  return [...new Set([...DEFAULT_CATEGORIAS, ...usadas])];
}

export function relacionesDe(contactos, relaciones, contactoId) {
  return relaciones
    .filter(r => r.contactoAId === contactoId || r.contactoBId === contactoId)
    .map(r => {
      const otroId = r.contactoAId === contactoId ? r.contactoBId : r.contactoAId;
      const otro = contactos.find(c => c.id === otroId);
      return { ...r, otro };
    })
    .filter(r => r.otro);
}
