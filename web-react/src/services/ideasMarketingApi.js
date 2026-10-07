// Portado de ../../../ideas-marketing.js — banco de ideas de marketing con
// fotos + notas de voz grabadas en el navegador + descripción + categoría
// obligatoria. No incluye migrateOldIdeasToMarketing() (migración única
// desde el viejo módulo "Ideas" independiente, ya ejecutada hace tiempo por
// la app vanilla en cada conexión a una base — para cuando se use esta
// pantalla, cualquier dato viejo ya está migrado a IdeasMarketing).
import { sheetsReq, uploadToDrive, deleteDriveFile, thumbUrl } from './googleAuth';

export const CATEGORIAS = ['Campo', 'Oficina', 'Tercero', 'Personal'];

let ideasMktSheetId = null;

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export async function ensureIdeasMarketingSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const has  = tabs.find(s => s.properties.title === 'IdeasMarketing');
  if (has) ideasMktSheetId = has.properties.sheetId;

  if (!has) {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'IdeasMarketing' } } }] })
    });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'IdeasMarketing') ideasMktSheetId = r.addSheet.properties.sheetId;
    });
  }

  const sd = await sheetsReq('/values/IdeasMarketing!A1:L1').catch(() => ({}));
  if (!sd.values) {
    await sheetsReq('/values/IdeasMarketing!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [[
        'ID', 'Descripcion', 'PhotoFileIds', 'PhotoNames', 'PhotoMimeTypes', 'PhotoThumbUrls',
        'AudioFileIds', 'AudioNames', 'AudioMimeTypes', 'AudioDurations', 'CreatedAt', 'Categoria'
      ]] })
    });
  } else if ((sd.values[0] || []).length < 12) {
    await sheetsReq('/values/IdeasMarketing!L1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['Categoria']] })
    });
  }
}

export async function fetchIdeasMarketing() {
  const data = await sheetsReq('/values/IdeasMarketing!A:L');
  const rows = (data.values || []).slice(1);

  return rows
    .filter(r => r[0])
    .map((r, i) => ({
      id:             r[0]  || '',
      descripcion:    r[1]  || '',
      photoFileIds:   safeParseJSON(r[2], []),
      photoNames:     safeParseJSON(r[3], []),
      photoMimeTypes: safeParseJSON(r[4], []),
      photoThumbUrls: safeParseJSON(r[5], []),
      audioFileIds:   safeParseJSON(r[6], []),
      audioNames:     safeParseJSON(r[7], []),
      audioMimeTypes: safeParseJSON(r[8], []),
      audioDurations: safeParseJSON(r[9], []),
      createdAt:      r[10] || '',
      categoria:      r[11] || '',
      rowIndex:       i + 2
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function appendIdeaMarketing(idea) {
  await sheetsReq('/values/IdeasMarketing!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      idea.id, idea.descripcion,
      JSON.stringify(idea.photoFileIds), JSON.stringify(idea.photoNames),
      JSON.stringify(idea.photoMimeTypes), JSON.stringify(idea.photoThumbUrls),
      JSON.stringify(idea.audioFileIds), JSON.stringify(idea.audioNames),
      JSON.stringify(idea.audioMimeTypes), JSON.stringify(idea.audioDurations),
      idea.createdAt, idea.categoria || ''
    ]] })
  });
}

export async function updateIdeaMarketingDescripcion(rowIndex, descripcion) {
  await sheetsReq(`/values/IdeasMarketing!B${rowIndex}:B${rowIndex}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[descripcion]] })
  });
}

async function deleteRow(rowIndex) {
  if (ideasMktSheetId === null) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'IdeasMarketing');
    if (tab) ideasMktSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{
      deleteDimension: { range: { sheetId: ideasMktSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } }
    }] })
  });
}

export async function deleteIdeaMarketing(idea) {
  for (const fid of [...(idea.photoFileIds || []), ...(idea.audioFileIds || [])]) await deleteDriveFile(fid);
  await deleteRow(idea.rowIndex);
}

export async function uploadIdeaPhotos(files, startDone, totalFiles, onProgress) {
  const photoFileIds = [], photoNames = [], photoMimeTypes = [], photoThumbUrls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fd = await uploadToDrive(file, pct => onProgress?.(startDone + i, totalFiles, pct));
    photoFileIds.push(fd.id); photoNames.push(file.name);
    photoMimeTypes.push(file.type); photoThumbUrls.push(thumbUrl(fd.id));
  }
  return { photoFileIds, photoNames, photoMimeTypes, photoThumbUrls };
}

function extFromAudioMime(m) {
  if (m.startsWith('audio/mp4')) return 'm4a';
  if (m.startsWith('audio/ogg')) return 'ogg';
  return 'webm';
}

export async function uploadIdeaAudioClips(clips, startDone, totalFiles, onProgress) {
  const audioFileIds = [], audioNames = [], audioMimeTypes = [], audioDurations = [];
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const file = new File(
      [clip.blob], `idea-audio-${Date.now()}-${i}.${extFromAudioMime(clip.mimeType)}`,
      { type: clip.mimeType }
    );
    const fd = await uploadToDrive(file, pct => onProgress?.(startDone + i, totalFiles, pct));
    audioFileIds.push(fd.id); audioNames.push(file.name);
    audioMimeTypes.push(file.type); audioDurations.push(clip.durationSec);
  }
  return { audioFileIds, audioNames, audioMimeTypes, audioDurations };
}
