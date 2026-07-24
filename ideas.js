// ── Ideas: tablero tipo Kanban, una columna por área (las mismas de Tareas), ─
// con 3 sub-categorías de alineación con TateQuieto dentro de cada columna.

import { sheetsReq } from './auth.js';
import { esc, setFb, confirmCloseIfDirty } from './utils.js';
import { kanbanAreas, getAreaColor } from './tareas.js';

export let ideas = [];
let ideasSheetId = null;
let editIdeaId   = null;

const ALINEACION_OPTIONS = ['Poco', 'Moderado', 'Afín'];
const ALINEACION_DEFAULT = 'Moderado';

// ── Ideas: Sheet CRUD ─────────────────────────────────────────────────────────

export async function initIdeasSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasI = tabs.find(s => s.properties.title === 'Ideas');

  if (hasI) {
    ideasSheetId = hasI.properties.sheetId;
  } else {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Ideas' } } }] })
    });
    const added = res.replies?.[0]?.addSheet?.properties;
    if (added) ideasSheetId = added.sheetId;
    await sheetsReq('/values/Ideas!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Titulo', 'Descripcion', 'Area', 'CreadoEn', 'Proposito', 'Alineacion']] })
    });
  }
  await loadIdeas();
}

export async function loadIdeas() {
  const data = await sheetsReq('/values/Ideas!A:G');
  const rows = (data.values || []).slice(1);
  ideas = rows.filter(r => r[0]).map((r, i) => ({
    id:          r[0] || '',
    titulo:      r[1] || '',
    descripcion: r[2] || '',
    area:        r[3] || '',
    creadoEn:    r[4] || '',
    proposito:   r[5] || '',
    alineacion:  r[6] || ALINEACION_DEFAULT,
    rowIndex:    i + 2
  }));
}

async function appendIdea(idea) {
  await sheetsReq('/values/Ideas!A:G:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), idea.titulo, idea.descripcion, idea.area, new Date().toISOString(), idea.proposito, idea.alineacion
    ]] })
  });
}

async function updateIdeaRow(idea) {
  await sheetsReq(`/values/Ideas!A${idea.rowIndex}:G${idea.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      idea.id, idea.titulo, idea.descripcion, idea.area, idea.creadoEn, idea.proposito, idea.alineacion
    ]] })
  });
}

async function deleteIdeaRow(rowIndex) {
  if (!ideasSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'Ideas');
    if (tab) ideasSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: ideasSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
}

// ── Ideas: UI — tablero Kanban (columnas = áreas, sub-grupos = alineación) ────

function ideaCardHTML(idea) {
  return `
    <div class="idea-kanban-card" data-edit-idea="${esc(idea.id)}">
      <div class="idea-kanban-card-title">${esc(idea.titulo)}</div>
      ${idea.descripcion ? `<div class="idea-kanban-card-desc">${esc(idea.descripcion)}</div>` : ''}
      <div class="idea-kanban-card-footer">
        <button class="idea-kanban-card-del" data-del-idea="${idea.rowIndex}" title="Eliminar">✕</button>
      </div>
    </div>
  `;
}

function columnHTML(areaKey, area, items) {
  const c = area ? getAreaColor(area) : { bg: 'var(--gray-200)', text: 'var(--text-sub)' };
  const groupsHTML = ALINEACION_OPTIONS.map(al => {
    const groupItems = items.filter(i => (i.alineacion || ALINEACION_DEFAULT) === al);
    return `
      <div class="idea-align-group">
        <div class="idea-align-label">${esc(al)}</div>
        <div class="idea-align-cards">
          ${groupItems.length ? groupItems.map(ideaCardHTML).join('') : '<div class="idea-align-empty">Sin ideas</div>'}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="kanban-col idea-kanban-col">
      <div class="kanban-col-header" style="background:${c.bg};color:${c.text}">
        <span class="kanban-col-title">${esc(areaKey)}</span>
        <span class="kanban-col-count">${items.length}</span>
      </div>
      <div class="kanban-col-body">${groupsHTML}</div>
    </div>
  `;
}

export function renderIdeasList() {
  const container = document.getElementById('ideasList');
  if (!container) return;

  // Una columna por cada área configurada en Tareas (aunque no tenga ideas
  // todavía, igual que un tablero Kanban normal), más las áreas huérfanas
  // (borradas de Tareas pero aún referenciadas) y "Sin área" al final.
  const areaOrder = [...kanbanAreas];
  ideas.forEach(i => { if (i.area && !areaOrder.includes(i.area)) areaOrder.push(i.area); });
  const hasSinArea = ideas.some(i => !i.area);

  let html = areaOrder.map(area => columnHTML(area, area, ideas.filter(i => i.area === area))).join('');
  if (hasSinArea) html += columnHTML('Sin área', '', ideas.filter(i => !i.area));

  container.innerHTML = html || '<div class="empty-state">Aún no hay áreas configuradas en Tareas.</div>';

  container.querySelectorAll('[data-edit-idea]').forEach(card => {
    card.addEventListener('click', () => openIdeaModal(card.dataset.editIdea));
  });
  container.querySelectorAll('[data-del-idea]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('¿Eliminar esta idea?')) return;
      btn.disabled = true;
      try {
        await deleteIdeaRow(+btn.dataset.delIdea);
        await loadIdeas();
        renderIdeasList();
      } catch (err) {
        alert('Error: ' + err.message);
        btn.disabled = false;
      }
    });
  });
}

// ── Ideas: modal (crear / editar) ─────────────────────────────────────────────

function populateIdeaAreaSelect() {
  const sel = document.getElementById('ideaArea');
  if (!sel) return;
  sel.innerHTML = kanbanAreas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
}

function populateIdeaAlineacionSelect() {
  const sel = document.getElementById('ideaAlineacion');
  if (!sel) return;
  sel.innerHTML = ALINEACION_OPTIONS.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
}

export function openIdeaModal(editId) {
  editIdeaId = editId || null;
  document.getElementById('ideaFeedback').textContent = '';
  populateIdeaAreaSelect();
  populateIdeaAlineacionSelect();

  if (editId) {
    const idea = ideas.find(i => i.id === editId);
    if (!idea) return;
    document.getElementById('ideaModalTitle').textContent = 'Editar idea';
    document.getElementById('ideaTitulo').value      = idea.titulo;
    document.getElementById('ideaDescripcion').value = idea.descripcion;
    document.getElementById('ideaProposito').value   = idea.proposito;
    document.getElementById('ideaArea').value         = idea.area || kanbanAreas[0] || '';
    document.getElementById('ideaAlineacion').value   = idea.alineacion || ALINEACION_DEFAULT;
  } else {
    document.getElementById('ideaModalTitle').textContent = 'Nueva idea';
    document.getElementById('ideaTitulo').value      = '';
    document.getElementById('ideaDescripcion').value = '';
    document.getElementById('ideaProposito').value   = '';
    document.getElementById('ideaArea').value         = kanbanAreas[0] || '';
    document.getElementById('ideaAlineacion').value   = ALINEACION_DEFAULT;
  }

  document.getElementById('ideaOverlay').classList.add('open');
  setTimeout(() => document.getElementById('ideaTitulo').focus(), 100);
}

function isIdeaFormDirty() {
  return !!document.getElementById('ideaTitulo')?.value.trim()
    || !!document.getElementById('ideaDescripcion')?.value.trim()
    || !!document.getElementById('ideaProposito')?.value.trim();
}

function closeIdeaModal() {
  confirmCloseIfDirty('ideaOverlay', isIdeaFormDirty);
}

document.getElementById('btnCloseIdea').addEventListener('click', closeIdeaModal);
document.getElementById('ideaOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('ideaOverlay')) closeIdeaModal();
});
document.getElementById('btnNewIdea').addEventListener('click', () => openIdeaModal(null));

document.getElementById('btnSaveIdea').addEventListener('click', async () => {
  const titulo      = document.getElementById('ideaTitulo').value.trim();
  const descripcion = document.getElementById('ideaDescripcion').value.trim();
  const proposito    = document.getElementById('ideaProposito').value.trim();
  const area         = document.getElementById('ideaArea').value;
  const alineacion   = document.getElementById('ideaAlineacion').value;
  const fb           = document.getElementById('ideaFeedback');
  if (!titulo) return setFb(fb, 'El título es obligatorio.', 'err');

  const btn = document.getElementById('btnSaveIdea');
  btn.disabled = true;
  try {
    if (editIdeaId) {
      const idea = ideas.find(i => i.id === editIdeaId);
      if (idea) await updateIdeaRow({ ...idea, titulo, descripcion, proposito, area, alineacion });
    } else {
      await appendIdea({ titulo, descripcion, proposito, area, alineacion });
    }
    await loadIdeas();
    renderIdeasList();
    document.getElementById('ideaOverlay').classList.remove('open');
    setFb(fb, '✅ Idea guardada.', 'ok');
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
  }
});
