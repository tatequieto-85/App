import { sheetsReq, sheetsReqFor } from './auth.js';
import { esc, setFb, setFieldError, ICON_FOLDER, ICON_EDIT, ICON_TRASH } from './utils.js';
import { setActiveBase, activeBaseModulos } from './db-state.js';
import { navigateTo } from './main.js';
import { initSheet, setDefaultDateTime, loadStories } from './contenido.js';
import { initKanbanSheets, loadKanbanTasks } from './tareas.js';
import { initRecetasSheets, checkPendingEvalNotifications } from './procesos.js';
import { initIngredientesSheet } from './ingredientes.js';
import { initComprasSheet } from './compras.js';
import { initFeriasSheet } from './ferias.js';
import { initStockSheets } from './stock.js';
import { initQRSheet } from './qr.js';
import { initIdeasSheet } from './ideas.js';

const screenApp      = document.getElementById('screenApp');
const screenDbPicker = document.getElementById('screenDbPicker');

export let bases      = [];
let basesSheetId       = null;
const ALL_MODULE_KEYS  = ['contenido', 'tareas', 'procesos', 'compras', 'ferias', 'stock', 'informes', 'qr', 'ideas'];
const ACTIVE_BASE_KEY  = 'ss_activeBase';

// ── Bases de datos: registro central (siempre vive en CONFIG.SHEET_ID) ──────────

export async function initBasesSheet() {
  const info = await sheetsReqFor(CONFIG.SHEET_ID, '');
  const tabs = info.sheets || [];
  const hasB = tabs.find(s => s.properties.title === 'Bases');

  if (hasB) {
    basesSheetId = hasB.properties.sheetId;
  } else {
    const res = await sheetsReqFor(CONFIG.SHEET_ID, ':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Bases' } } }] })
    });
    const added = res.replies?.[0]?.addSheet?.properties;
    if (added) basesSheetId = added.sheetId;
    await sheetsReqFor(CONFIG.SHEET_ID, '/values/Bases!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [
        ['ID', 'Nombre', 'SheetID', 'Modulos', 'CreadoEn'],
        [crypto.randomUUID(), 'Tatequieto', CONFIG.SHEET_ID, ALL_MODULE_KEYS.join(','), new Date().toISOString()]
      ] })
    });
  }
  await loadBases();
}

async function loadBases() {
  const data = await sheetsReqFor(CONFIG.SHEET_ID, '/values/Bases!A:E');
  const rows = (data.values || []).slice(1);
  bases = rows.filter(r => r[0]).map((r, i) => ({
    id:       r[0] || '',
    nombre:   r[1] || '',
    sheetId:  r[2] || '',
    modulos:  (r[3] || '').split(',').filter(Boolean),
    creadoEn: r[4] || '',
    rowIndex: i + 2
  }));
}

async function appendBase({ nombre, sheetId, modulos }) {
  await sheetsReqFor(CONFIG.SHEET_ID, '/values/Bases!A:E:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), nombre, sheetId, modulos.join(','), new Date().toISOString()
    ]] })
  });
  await loadBases();
}

async function updateBaseRow(base, { nombre, modulos }) {
  await sheetsReqFor(CONFIG.SHEET_ID, `/values/Bases!B${base.rowIndex}:D${base.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[ nombre, base.sheetId, modulos.join(',') ]] })
  });
  await loadBases();
}

async function deleteBaseRow(rowIndex) {
  if (!basesSheetId) {
    const info = await sheetsReqFor(CONFIG.SHEET_ID, '');
    const tab  = info.sheets.find(s => s.properties.title === 'Bases');
    if (tab) basesSheetId = tab.properties.sheetId;
  }
  await sheetsReqFor(CONFIG.SHEET_ID, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: basesSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
  await loadBases();
}

// Crea todas las pestañas de los 8 módulos en la base de datos actualmente
// activa (activeSheetId). Las funciones init*Sheet ya son idempotentes:
// sólo crean lo que falta, así que es seguro re-ejecutarlas en cada conexión.
async function provisionAllTabs() {
  await initSheet();
  await initKanbanSheets();
  await loadKanbanTasks();
  await initRecetasSheets();
  await initIngredientesSheet();
  await initComprasSheet();
  await initFeriasSheet();
  await initStockSheets();
  await initQRSheet();
  await initIdeasSheet();
}

// Conecta la app a una base de datos ya registrada: la deja activa, asegura
// que sus pestañas existan y refresca la vista según sus módulos habilitados.
export async function connectToDatabase(base) {
  setActiveBase(base);
  localStorage.setItem(ACTIVE_BASE_KEY, JSON.stringify(base));

  await provisionAllTabs();
  setDefaultDateTime();
  await loadStories();

  screenDbPicker.style.display = 'none';
  screenApp.style.display = '';
  applyModuleVisibility();
  navigateTo('home');
  checkPendingEvalNotifications();
}

// Crea un Google Sheet nuevo desde cero, le arma toda la estructura de
// pestañas y la registra en "Bases" antes de conectarse a ella.
async function createNewDatabase({ nombre, modulos }) {
  const created = await sheetsReq('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({ properties: { title: nombre } })
  });
  const sheetId = created.spreadsheetId;
  if (!sheetId) throw new Error('Google Sheets no devolvió un ID de hoja al crearla.');

  await appendBase({ nombre, sheetId, modulos });
  const base = bases.find(b => b.sheetId === sheetId);
  await connectToDatabase(base); // ya arma las pestañas y activa la base — no lo dupliques aquí
}

function applyModuleVisibility() {
  document.querySelectorAll('.app-card[data-nav]').forEach(card => {
    card.style.display = activeBaseModulos.includes(card.dataset.nav) ? '' : 'none';
  });
}

// ── Bases de datos: UI (selector + modal crear/editar) ───────────────────────

const MODULE_LABELS = {
  contenido: 'Contenido', tareas: 'Tareas', procesos: 'Procesos', compras: 'Compras',
  ferias: 'Ferias', stock: 'Stock', informes: 'Informes', qr: 'QR', ideas: 'Ideas'
};

export function showDbPicker() {
  renderDbPickerList();
  screenApp.style.display = 'none';
  screenDbPicker.style.display = '';
}

function renderDbPickerList() {
  const el = document.getElementById('dbPickerList');
  if (!bases.length) {
    el.innerHTML = '<div class="empty-state">No hay bases de datos registradas.</div>';
    return;
  }
  const saved = JSON.parse(localStorage.getItem(ACTIVE_BASE_KEY) || 'null');
  const sorted = bases.slice().sort((a, b) => (a.creadoEn || '').localeCompare(b.creadoEn || ''));
  el.innerHTML = sorted.map(b => `
    <div class="db-picker-item">
      <div class="db-picker-info">
        <div class="db-picker-nombre">${esc(b.nombre)}${saved && saved.sheetId === b.sheetId ? ' <span class="db-last-tag">última usada</span>' : ''}</div>
        <div class="db-picker-modulos">${b.modulos.map(m => `<span class="db-module-tag">${esc(MODULE_LABELS[m] || m)}</span>`).join('')}</div>
      </div>
      <div class="db-picker-actions">
        <a class="btn-icon" href="https://docs.google.com/spreadsheets/d/${encodeURIComponent(b.sheetId)}/edit" target="_blank" rel="noopener" title="Abrir en Google Sheets">${ICON_FOLDER}</a>
        <button class="btn-icon" data-base-edit="${b.id}" title="Editar">${ICON_EDIT}</button>
        <button class="btn-icon" data-base-delete="${b.id}" title="Eliminar">${ICON_TRASH}</button>
        <button class="db-picker-connect" data-base-connect="${b.id}">Conectar</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('[data-base-connect]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const base = bases.find(x => x.id === btn.dataset.baseConnect);
      if (!base) return;
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = 'Conectando…';
      try {
        await connectToDatabase(base);
      } catch (e) {
        alert(`Error al conectar: ${e.message}`);
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });
  el.querySelectorAll('[data-base-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const base = bases.find(x => x.id === btn.dataset.baseEdit);
      if (base) openBaseModal(base);
    });
  });
  el.querySelectorAll('[data-base-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (bases.length <= 1) { alert('No puedes eliminar la única base de datos registrada.'); return; }
      if (!confirm('¿Quitar esta base de datos de la lista? Esto NO borra la hoja de Google, solo la desvincula de TATEAPP.')) return;
      const base = bases.find(x => x.id === btn.dataset.baseDelete);
      if (!base) return;
      await deleteBaseRow(base.rowIndex);
      renderDbPickerList();
    });
  });
}

let editingBaseId = null;

function openBaseModal(base) {
  editingBaseId = base ? base.id : null;
  document.getElementById('baseModalTitle').textContent = base ? 'Editar base de datos' : 'Nueva base de datos';
  document.getElementById('btnSaveBase').textContent = base ? 'Guardar cambios' : 'Crear base de datos';
  document.getElementById('baseNombre').value = base ? base.nombre : '';
  document.getElementById('baseFeedback').textContent = '';
  setFieldError('baseNombre', '');
  document.getElementById('baseModulosErr').textContent = '';
  document.querySelectorAll('#baseModulesGrid input[type=checkbox]').forEach(cb => {
    cb.checked = base ? base.modulos.includes(cb.value) : true;
  });
  document.getElementById('baseOverlay').classList.add('open');
  setTimeout(() => document.getElementById('baseNombre').focus(), 100);
}

function closeBaseModal() {
  document.getElementById('baseOverlay').classList.remove('open');
  editingBaseId = null;
}
document.getElementById('btnCloseBase').addEventListener('click', closeBaseModal);
document.getElementById('baseOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('baseOverlay')) closeBaseModal();
});
document.getElementById('btnNewBase').addEventListener('click', () => openBaseModal(null));

document.getElementById('btnSaveBase').addEventListener('click', async () => {
  const fb      = document.getElementById('baseFeedback');
  const nombre  = document.getElementById('baseNombre').value.trim();
  const modulos = Array.from(document.querySelectorAll('#baseModulesGrid input[type=checkbox]:checked')).map(cb => cb.value);

  setFieldError('baseNombre', '');
  document.getElementById('baseModulosErr').textContent = '';
  if (!nombre) return setFieldError('baseNombre', 'El nombre es obligatorio.');
  if (!modulos.length) { document.getElementById('baseModulosErr').textContent = 'Marca al menos un módulo.'; return; }

  const btn = document.getElementById('btnSaveBase');
  const original = btn.textContent;
  btn.disabled = true;
  try {
    if (editingBaseId) {
      const base = bases.find(b => b.id === editingBaseId);
      btn.textContent = 'Guardando…';
      await updateBaseRow(base, { nombre, modulos });
      closeBaseModal();
      renderDbPickerList();
    } else {
      btn.textContent = 'Creando…';
      await createNewDatabase({ nombre, modulos });
      closeBaseModal();
    }
  } catch (e) {
    setFb(fb, `Error: ${e.message}`, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('btnSwitchDb').addEventListener('click', () => {
  document.getElementById('userMenuDropdown').style.display = 'none';
  showDbPicker();
});
