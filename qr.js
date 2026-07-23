import { sheetsReq } from './auth.js';
import { esc, setFb } from './utils.js';

let qrs       = [];
let qrSheetId = null;

// ── QR: Sheets init + CRUD ───────────────────────────────────────────────────

export async function initQRSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasQ = tabs.find(s => s.properties.title === 'QR');

  if (hasQ) {
    qrSheetId = hasQ.properties.sheetId;
  } else {
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
  await loadQRs();
}

export async function loadQRs() {
  const data = await sheetsReq('/values/QR!A:E');
  const rows = (data.values || []).slice(1);
  qrs = rows.filter(r => r[0]).map((r, i) => ({
    id:       r[0] || '',
    nombre:   r[1] || '',
    link:     r[2] || '',
    imagen:   r[3] || '',
    creadoEn: r[4] || '',
    rowIndex: i + 2
  }));
}

async function appendQR(q) {
  await sheetsReq('/values/QR!A:E:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), q.nombre, q.link, q.imagen, new Date().toISOString()
    ]]})
  });
}

async function deleteQRRow(rowIndex) {
  if (!qrSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'QR');
    if (tab) qrSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: qrSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
}

// ── QR: UI ────────────────────────────────────────────────────────────────────

function normalizeQRLink(raw) {
  const v = (raw || '').trim();
  if (!v) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function generateQRDataURL(link) {
  // `qrcode` es una librería global cargada por vendor-qrcode.js (script clásico).
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  return qr.createDataURL(6, 16);
}

export function renderQRList() {
  const el = document.getElementById('qrList');
  if (!qrs.length) {
    el.innerHTML = '<div class="empty-state">Todavía no has generado ningún código QR.</div>';
    return;
  }
  const sorted = qrs.slice().sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
  el.innerHTML = sorted.map(q => `
    <div class="qr-item">
      <img class="qr-item-img" src="${q.imagen}" alt="QR ${esc(q.nombre)}" />
      <div class="qr-item-info">
        <div class="qr-item-nombre">${esc(q.nombre)}</div>
        <a class="qr-item-link" href="${esc(q.link)}" target="_blank" rel="noopener">${esc(q.link)}</a>
      </div>
      <div class="qr-item-actions">
        <button class="btn-outline btn-sm" data-qr-download="${q.id}">Descargar</button>
        <button class="btn-outline btn-sm" data-qr-copy="${q.id}">Copiar link</button>
        <button class="btn-outline btn-sm" data-qr-delete="${q.rowIndex}">Eliminar</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('[data-qr-download]').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = qrs.find(x => x.id === btn.dataset.qrDownload);
      if (!q) return;
      const a = document.createElement('a');
      a.href = q.imagen;
      a.download = `qr-${(q.nombre || 'codigo').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.gif`;
      a.click();
    });
  });
  el.querySelectorAll('[data-qr-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = qrs.find(x => x.id === btn.dataset.qrCopy);
      if (!q) return;
      navigator.clipboard.writeText(q.link);
    });
  });
  el.querySelectorAll('[data-qr-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este código QR?')) return;
      await deleteQRRow(+btn.dataset.qrDelete);
      await loadQRs();
      renderQRList();
    });
  });
}

document.getElementById('btnGenerarQR').addEventListener('click', async () => {
  const fb     = document.getElementById('qrFormFeedback');
  const nombre = document.getElementById('qrNombre').value.trim();
  const link   = normalizeQRLink(document.getElementById('qrLink').value);

  if (!nombre) return setFb(fb, 'El nombre es obligatorio.', 'err');
  if (!link)   return setFb(fb, 'El link es obligatorio.', 'err');

  const btn = document.getElementById('btnGenerarQR');
  btn.disabled = true;
  try {
    const imagen = generateQRDataURL(link);
    const preview = document.getElementById('qrPreview');
    preview.style.display = '';
    preview.innerHTML = `<img src="${imagen}" alt="QR generado" />`;

    await appendQR({ nombre, link, imagen });
    await loadQRs();
    renderQRList();

    document.getElementById('qrNombre').value = '';
    document.getElementById('qrLink').value = '';
    setFb(fb, '✅ Código QR generado y guardado.', 'ok');
  } catch (e) {
    setFb(fb, `Error: ${e.message}`, 'err');
  } finally {
    btn.disabled = false;
  }
});
