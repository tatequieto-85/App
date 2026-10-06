// Portado de ../../qr.js — misma hoja "QR" (ID, Nombre, Link, Imagen,
// CreadoEn). La imagen se guarda como data URL directo en la celda, igual
// que la app vanilla — no sube nada a Drive.
import { sheetsReq } from './googleAuth';

let qrSheetId = null;

export async function ensureQRSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasQ = tabs.find(s => s.properties.title === 'QR');
  if (hasQ) { qrSheetId = hasQ.properties.sheetId; return; }

  const res = await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'QR' } } }] })
  });
  const added = res.replies?.[0]?.addSheet?.properties;
  if (added) qrSheetId = added.sheetId;
  await sheetsReq('/values/QR!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [['ID', 'Nombre', 'Link', 'Imagen', 'CreadoEn']] })
  });
}

export async function fetchQRs() {
  const data = await sheetsReq('/values/QR!A:E');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:       r[0] || '',
    nombre:   r[1] || '',
    link:     r[2] || '',
    imagen:   r[3] || '',
    creadoEn: r[4] || '',
    rowIndex: i + 2
  }));
}

export async function appendQR(q) {
  await sheetsReq('/values/QR!A:E:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), q.nombre, q.link, q.imagen, new Date().toISOString()
    ]] })
  });
}

export async function deleteQRRow(rowIndex) {
  if (!qrSheetId) await ensureQRSheet();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: qrSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

// Antepone https:// si el usuario no escribió ningún esquema — mismo
// criterio que la app vanilla.
export function normalizeQRLink(raw) {
  const v = (raw || '').trim();
  if (!v) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v;
  return `https://${v}`;
}

// `qrcode-generator` (vendor/qrcodeGenerator.js, mismo archivo que carga la
// app vanilla) — type 0 = detecta el tamaño solo según el largo del link.
export async function generateQRDataURL(link) {
  const { default: qrcode } = await import('../vendor/qrcodeGenerator');
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  return qr.createDataURL(6, 16);
}
