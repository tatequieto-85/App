// ── Ideas: banco de ideas agrupadas por área (las mismas áreas de Tareas) ────

import { sheetsReq } from './auth.js';
import { esc, setFb, confirmCloseIfDirty } from './utils.js';
import { kanbanAreas, getAreaColor } from './tareas.js';

export let ideas = [];
let ideasSheetId = null;
let editIdeaId   = null;

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
      body: JSON.stringify({ values: [['ID', 'Titulo', 'Descripcion', 'Area', 'CreadoEn']] })
    });
  }
  await loadIdeas();
}

export async function loadIdeas() {
  const data = await sheetsReq('/values/Ideas!A:E');
  const rows = (data.values || []).slice(1);
  ideas = rows.filter(r => r[0]).map((r, i) => ({
    id:          r[0] || '',
    titulo:      r[1] || '',
    descripcion: r[2] || '',
    area:        r[3] || '',
    creadoEn:    r[4] || '',
    rowIndex:    i + 2
  }));
}

async function appendIdea(idea) {
  await sheetsReq('/values/Ideas!A:E:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), idea.titulo, idea.descripcion, idea.area, new Date().toISOString()
    ]] })
  });
}

async function updateIdeaRow(idea) {
  await sheetsReq(`/values/Ideas!A${idea.rowIndex}:E${idea.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      idea.id, idea.titulo, idea.descripcion, idea.area, idea.creadoEn
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

// ── Ideas: UI — lista agrupada por área ───────────────────────────────────────

function ideaCardHTML(idea) {
  return `
    <div class="idea-card" data-edit-idea="${esc(idea.id)}">
      <div class="idea-card-body">
        <div class="idea-card-title">${esc(idea.titulo)}</div>
        ${idea.descripcion ? `<div class="idea-card-desc">${esc(idea.descripcion)}</div>` : ''}
      </div>
      <button class="idea-card-del" data-del-idea="${idea.rowIndex}" title="Eliminar">✕</button>
    </div>
  `;
}

export function renderIdeasList() {
  const container = document.getElementById('ideasList');
  if (!container) return;

  if (!ideas.length) {
    container.innerHTML = '<div class="empty-state">Aún no hay ideas. Agrega la primera con "+ Nueva idea".</div>';
    return;
  }

  // Mismo orden que el agrupado por área en el Gantt de Tareas: primero las
  // áreas conocidas (en su orden de configuración), luego áreas huérfanas
  // (borradas de Tareas pero aún referenciadas), y al final "Sin área".
  const areaOrder = [];
  kanbanAreas.forEach(a => { if (ideas.some(i => i.area === a)) areaOrder.push(a); });
  ideas.forEach(i => { if (i.area && !areaOrder.includes(i.area)) areaOrder.push(i.area); });
  if (ideas.some(i => !i.area)) areaOrder.push('');

  container.innerHTML = areaOrder.map(area => {
    const items = ideas.filter(i => (i.area || '') === area);
    if (!items.length) return '';
    const areaKey = area || 'Sin área';
    const c = area ? getAreaColor(area) : { bg: 'var(--gray-200)', text: 'var(--text-sub)' };
    return `
      <div class="idea-group-section">
        <div class="idea-group-header" style="background:${c.bg};color:${c.text}">
          <span class="idea-group-name">${esc(areaKey)}</span>
          <span class="idea-group-count">${items.length}</span>
        </div>
        <div class="idea-group-body">${items.map(ideaCardHTML).join('')}</div>
      </div>
    `;
  }).join('');

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

export function openIdeaModal(editId) {
  editIdeaId = editId || null;
  document.getElementById('ideaFeedback').textContent = '';
  populateIdeaAreaSelect();

  if (editId) {
    const idea = ideas.find(i => i.id === editId);
    if (!idea) return;
    document.getElementById('ideaModalTitle').textContent = 'Editar idea';
    document.getElementById('ideaTitulo').value      = idea.titulo;
    document.getElementById('ideaDescripcion').value = idea.descripcion;
    document.getElementById('ideaArea').value         = idea.area || kanbanAreas[0] || '';
  } else {
    document.getElementById('ideaModalTitle').textContent = 'Nueva idea';
    document.getElementById('ideaTitulo').value      = '';
    document.getElementById('ideaDescripcion').value = '';
    document.getElementById('ideaArea').value         = kanbanAreas[0] || '';
  }

  document.getElementById('ideaOverlay').classList.add('open');
  setTimeout(() => document.getElementById('ideaTitulo').focus(), 100);
}

function isIdeaFormDirty() {
  return !!document.getElementById('ideaTitulo')?.value.trim()
    || !!document.getElementById('ideaDescripcion')?.value.trim();
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
  const area         = document.getElementById('ideaArea').value;
  const fb           = document.getElementById('ideaFeedback');
  if (!titulo) return setFb(fb, 'El título es obligatorio.', 'err');

  const btn = document.getElementById('btnSaveIdea');
  btn.disabled = true;
  try {
    if (editIdeaId) {
      const idea = ideas.find(i => i.id === editIdeaId);
      if (idea) await updateIdeaRow({ ...idea, titulo, descripcion, area });
    } else {
      await appendIdea({ titulo, descripcion, area });
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
