// Portado de ../../../contenido.js — CRUD de historias de Instagram
// programadas (Stories), sin el modal de Configuración/WhatsApp ni el envío
// de recordatorios (ese recordatorio lo sigue mandando Google Apps Script
// server-side sin importar esta UI — ver notificacion-apps-script.gs).
import { sheetsReq, uploadToDrive, deleteDriveFile, thumbUrl } from './googleAuth';
import { todayISOBogota } from '../utils/format';

let storiesSheetId = null;

function parseArr(val) {
  if (!val) return [];
  try {
    const a = JSON.parse(val);
    return Array.isArray(a) ? a : [val];
  } catch {
    return val ? [val] : [];
  }
}

export async function ensureStoriesSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasS = tabs.find(s => s.properties.title === 'Stories');
  if (hasS) storiesSheetId = hasS.properties.sheetId;

  if (!hasS) {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Stories' } } }] })
    });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'Stories') storiesSheetId = r.addSheet.properties.sheetId;
    });
  }

  const sd = await sheetsReq('/values/Stories!A1').catch(() => ({}));
  if (!sd.values) {
    await sheetsReq('/values/Stories!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Title', 'Actions', 'ScheduledAt', 'DriveFileId', 'OriginalName', 'MimeType', 'ThumbUrl', 'Sent', 'SentAt', 'CreatedAt']] })
    });
  }
}

export async function fetchStories() {
  const data = await sheetsReq('/values/Stories!A:K');
  const rows = (data.values || []).slice(1);

  return rows
    .filter(r => r[0])
    .map((r, i) => ({
      id:           r[0]  || '',
      title:        r[1]  || '',
      actions:      r[2]  || '',
      scheduledAt:  r[3]  || '',
      driveFileIds: parseArr(r[4]),
      origNames:    parseArr(r[5]),
      mimeTypes:    parseArr(r[6]),
      thumbUrls:    parseArr(r[7]),
      sent:         r[8] === 'TRUE',
      sentAt:       r[9]  || '',
      createdAt:    r[10] || '',
      rowIndex:     i + 2
    }))
    .filter(s => !s.sent)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
}

export async function appendStory(story) {
  await sheetsReq('/values/Stories!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      story.id, story.title, story.actions, story.scheduledAt,
      JSON.stringify(story.driveFileIds), JSON.stringify(story.origNames),
      JSON.stringify(story.mimeTypes), JSON.stringify(story.thumbUrls),
      'FALSE', '', story.createdAt
    ]] })
  });
}

export async function updateStoryFields(rowIndex, { title, actions, scheduledAt }) {
  await sheetsReq(`/values/Stories!B${rowIndex}:D${rowIndex}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[title, actions, scheduledAt]] })
  });
}

async function deleteRow(rowIndex) {
  if (storiesSheetId === null) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'Stories');
    if (tab) storiesSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{
      deleteDimension: { range: { sheetId: storiesSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } }
    }] })
  });
}

// Publicar/eliminar son la misma operación (igual que en la app vanilla):
// la fila se borra y sus archivos de Drive también — "Publicada" no deja
// registro aparte, solo saca la historia de la lista de pendientes.
export async function deleteStory(story) {
  for (const fid of (story.driveFileIds || [])) await deleteDriveFile(fid);
  await deleteRow(story.rowIndex);
}

export async function uploadStoryFiles(files, onProgress) {
  const driveFileIds = [], origNames = [], mimeTypes = [], thumbUrls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fd = await uploadToDrive(file, pct => onProgress?.(i, files.length, pct));
    driveFileIds.push(fd.id);
    origNames.push(file.name);
    mimeTypes.push(file.type);
    thumbUrls.push(thumbUrl(fd.id));
  }
  return { driveFileIds, origNames, mimeTypes, thumbUrls };
}

// ── Fecha: hoy / vencida (zona horaria real del negocio, Bogotá) ───────────

export function isToday(isoDate) {
  if (!isoDate) return false;
  const toDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  return toDay(isoDate) === todayISOBogota();
}

export function isOverdue(isoDate) {
  if (!isoDate) return false;
  const toDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  return toDay(isoDate) < todayISOBogota();
}

// Cuántas historias cuentan para el badge del ícono (hoy o ya vencidas sin
// publicar) — publicar borra la fila, así que todo lo cargado está, por
// definición, sin publicar.
export function getStoriesDueBadgeCount(stories) {
  return stories.filter(s => isToday(s.scheduledAt) || isOverdue(s.scheduledAt)).length;
}
