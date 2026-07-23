import { sheetsReq, uploadToDrive, deleteDriveFile, thumbUrl } from './auth.js';
import {
  esc, setFb, setFieldError, clearFieldErrors, confirmCloseIfDirty, safeParseJSON,
  fmtDate, fmtDateShortEs, fmtDuration, fmtSeconds, parseISODate, toISODate, addDays, diffDays,
  ICON_EDIT, ICON_TRASH
} from './utils.js';
import { pushUndo } from './undo.js';
import { wasAccidentalTouch } from './input-guard.js';
import { navigateTo } from './main.js';

// ── State ─────────────────────────────────────────────────────────────────────
export let kanbanTasks  = [];
let kanbanColumns       = [];
let kanbanAreas         = [];
let kanbanTasksSheetId  = null;
let kanbanEditId        = null;
let taskAutosaveTimer   = null;
let kanbanActiveFilters = {};
let listaActiveFilters  = {};
let draggedId           = null;
let showTerminal        = false;
let taskDetailId        = null;
let draggedColName      = null;
let lastTapTime         = {}; // para detección de doble-toque en móvil

let ganttProjects         = [];
let ganttProjectsSheetId  = null;
let ganttProjectsLoaded   = false;
let currentGanttProjectId = null;
let ganttZoom              = 'week'; // 'day' | 'week' | 'month'
let ganttCollapsedAreas    = new Set();

let currentSubTab = 'kanban';

let calendarMonth = (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

export const TERMINAL_STATES = ['Realizado', 'Cancelado', 'Postpuesto'];
const DEFAULT_COLUMNS = [
  { name: 'Pendiente',   color: '#6B5050', terminal: false },
  { name: 'En proceso',  color: '#714B67', terminal: false },
  { name: 'En revisión', color: '#7A9C3E', terminal: false },
  { name: 'Realizado',   color: '#2E7D32', terminal: true  },
  { name: 'Cancelado',   color: '#C62828', terminal: true  },
  { name: 'Postpuesto',  color: '#546E7A', terminal: true  },
];
const DEFAULT_AREAS = ['Marketing', 'Ventas', 'Producción', 'Administración'];

// Paleta crema/pastel para diferenciar áreas (Gantt) sin romper el look de la app.
const AREA_PASTEL_PALETTE = [
  { bg: '#F5E8D3', text: '#7A6A45' }, // crema
  { bg: '#F0DCC9', text: '#7A5A3E' }, // durazno
  { bg: '#E9D8E3', text: '#71495F' }, // malva pastel (eco del brand)
  { bg: '#DCE6D6', text: '#4E6B45' }, // salvia
  { bg: '#D8E1EA', text: '#3E5B75' }, // azul grisáceo
  { bg: '#E7E1CE', text: '#6B6440' }, // oliva claro
  { bg: '#F1DEDA', text: '#8A4F47' }, // coral pastel
  { bg: '#DDE8E3', text: '#3E7264' }, // menta
];

function getAreaColor(area) {
  const key = area || 'Sin área';
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AREA_PASTEL_PALETTE[Math.abs(hash) % AREA_PASTEL_PALETTE.length];
}

// ── Navigation (sub-tabs propios de Tareas) ──────────────────────────────────

export function renderCurrentSubTab() {
  if (currentSubTab === 'kanban') renderKanban();
  else if (currentSubTab === 'gantt') renderGanttChart();
  else if (currentSubTab === 'calendario') renderCalendar();
  else renderKanbanList();
}

export async function switchSubTab(subtab) {
  currentSubTab = subtab;

  document.querySelectorAll('.sub-tab-btn').forEach(b => {
    if (b.dataset.subtab) b.classList.toggle('active', b.dataset.subtab === subtab);
  });
  document.getElementById('subTabKanban').style.display     = subtab === 'kanban'     ? '' : 'none';
  document.getElementById('subTabLista').style.display      = subtab === 'lista'      ? '' : 'none';
  document.getElementById('subTabGantt').style.display      = subtab === 'gantt'      ? '' : 'none';
  document.getElementById('subTabCalendario').style.display = subtab === 'calendario' ? '' : 'none';
  document.getElementById('kanbanToolbar').style.display    = subtab === 'kanban'     ? '' : 'none';
  document.getElementById('ganttToolbar').style.display     = subtab === 'gantt'      ? '' : 'none';
  document.getElementById('calendarToolbar').style.display  = subtab === 'calendario' ? '' : 'none';
  document.getElementById('btnManageBoard').style.display   = (subtab === 'gantt' || subtab === 'calendario') ? 'none' : '';

  await loadKanbanConfig();
  await loadKanbanTasks();
  populateAreaSelects();
  populateStatusSelects();
  if (subtab === 'gantt' && !ganttProjectsLoaded) await loadGanttProjects();
  populateProjectSelects();

  if (subtab === 'kanban') renderKanban();
  else if (subtab === 'gantt') renderGanttChart();
  else if (subtab === 'calendario') renderCalendar();
  else renderKanbanList();
}

// ── Borrador de nueva tarea (persistencia ante cierre accidental) ─────────────

function saveTaskDraft() {
  if (kanbanEditId) return;
  const draft = {
    area:     document.getElementById('taskArea')?.value    || '',
    title:    document.getElementById('taskTitle')?.value   || '',
    desc:     document.getElementById('taskDesc')?.value    || '',
    due:      document.getElementById('taskDue')?.value     || '',
    status:   document.getElementById('taskStatus')?.value  || '',
    priority: document.getElementById('taskPriority')?.value || '',
    project:  document.getElementById('taskProject')?.value || '',
    start:    document.getElementById('taskStart')?.value    || '',
    subtasks: collectSubtasks()
  };
  if (draft.title || draft.desc || draft.subtasks.length) {
    localStorage.setItem('ss_draftTask', JSON.stringify(draft));
  }
}

function loadTaskDraft() {
  return safeParseJSON(localStorage.getItem('ss_draftTask'), null);
}

function clearTaskDraft() {
  localStorage.removeItem('ss_draftTask');
}

// ── Autoguardado silencioso del modal de tarea ────────────────────────────────

function startTaskAutosave() {
  stopTaskAutosave();
  taskAutosaveTimer = setInterval(performTaskAutosave, 25000);
}

function stopTaskAutosave() {
  if (taskAutosaveTimer) { clearInterval(taskAutosaveTimer); taskAutosaveTimer = null; }
}

async function performTaskAutosave() {
  if (!document.getElementById('taskOverlay')?.classList.contains('open')) { stopTaskAutosave(); return; }
  const title = document.getElementById('taskTitle')?.value.trim();
  if (!title) return; // nada útil que guardar todavía

  const area      = document.getElementById('taskArea').value;
  const desc      = document.getElementById('taskDesc').value.trim();
  const due       = document.getElementById('taskDue').value;
  const status    = document.getElementById('taskStatus').value;
  const priority  = document.getElementById('taskPriority').value;
  const projectId = document.getElementById('taskProject').value;
  const startDate = document.getElementById('taskStart').value;
  const subtasks  = collectSubtasks();

  try {
    if (kanbanEditId) {
      const task = kanbanTasks.find(t => t.id === kanbanEditId);
      if (!task) return;
      const next = {
        area, title, desc, dueDate: due, status, subtasks, priority,
        projectId, startDate: projectId ? startDate : ''
      };
      const prevComparable = JSON.stringify({
        area: task.area, title: task.title, desc: task.desc, dueDate: task.dueDate,
        status: task.status, subtasks: task.subtasks, priority: task.priority,
        projectId: task.projectId, startDate: task.startDate
      });
      if (JSON.stringify(next) === prevComparable) return; // sin cambios
      Object.assign(task, next);
      await updateKanbanTask(task);
    } else {
      if (!due) return; // esperar a que haya fecha límite antes de crear la fila
      const now = new Date().toISOString();
      const newId = crypto.randomUUID();
      await appendKanbanTask({
        id: newId, area, title, desc, dueDate: due, status, createdAt: now, updatedAt: now,
        subtasks, observations: [], priority, projectId, startDate: projectId ? startDate : '',
        dependsOn: [], timeSessions: []
      });
      await loadKanbanTasks();
      kanbanEditId = newId;
      clearTaskDraft();
    }
  } catch (e) { /* fallo silencioso: se reintenta en el próximo ciclo */ }
}

function fmtDueShort(dateStr) {
  if (!dateStr) return '';
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff < 0)  return `⚠️ vencida`;
  if (diff === 0) return `🔴 hoy`;
  if (diff === 1) return `🟡 mañana`;
  return `📅 ${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' })}`;
}

// fmtSeconds vive en utils.js (importado arriba)
// setDefaultDateTime (formulario de Contenido) vive en contenido.js
// El refresco periódico de sesión (visibilitychange/setInterval) vive en main.js

// ── Kanban Sheet Init ─────────────────────────────────────────────────────────

export async function initKanbanSheets() {
  const info = await sheetsReq('');
  const tabs  = info.sheets || [];
  const hasTasks = tabs.find(s => s.properties.title === 'KanbanTasks');
  const hasConf  = tabs.find(s => s.properties.title === 'KanbanConfig');
  const hasGantt = tabs.find(s => s.properties.title === 'GanttProjects');

  if (hasTasks) kanbanTasksSheetId    = hasTasks.properties.sheetId;
  if (hasGantt) ganttProjectsSheetId  = hasGantt.properties.sheetId;

  const reqs = [];
  if (!hasTasks) reqs.push({ addSheet: { properties: { title: 'KanbanTasks'  } } });
  if (!hasConf)  reqs.push({ addSheet: { properties: { title: 'KanbanConfig' } } });
  if (!hasGantt) reqs.push({ addSheet: { properties: { title: 'GanttProjects' } } });

  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST', body: JSON.stringify({ requests: reqs })
    });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'KanbanTasks')
        kanbanTasksSheetId = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'GanttProjects')
        ganttProjectsSheetId = r.addSheet.properties.sheetId;
    });
  }

  const td = await sheetsReq('/values/KanbanTasks!A1:P1').catch(() => ({}));
  if (!td.values || (td.values[0] || []).length < 16) {
    await sheetsReq('/values/KanbanTasks!A1:P1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['ID','Area','Title','Description','DueDate','Status','CreatedAt','UpdatedAt','Subtasks','Observations','Priority','StartDate','ProjectId','DependsOn','TimeSessions','SortOrder']] })
    });
  }

  const gd = await sheetsReq('/values/GanttProjects!A1').catch(() => ({}));
  if (!gd.values) {
    await sheetsReq('/values/GanttProjects!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID','Name','Color','CreatedAt']] })
    });
  }

  const kd = await sheetsReq('/values/KanbanConfig!A1').catch(() => ({}));
  if (!kd.values) {
    await sheetsReq('/values/KanbanConfig!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [
        ['columns', JSON.stringify(DEFAULT_COLUMNS)],
        ['areas',   JSON.stringify(DEFAULT_AREAS)]
      ]})
    });
    kanbanColumns = DEFAULT_COLUMNS;
    kanbanAreas   = DEFAULT_AREAS;
  } else {
    await loadKanbanConfig();
  }
}

// ── Kanban Config ─────────────────────────────────────────────────────────────

export async function loadKanbanConfig() {
  const data = await sheetsReq('/values/KanbanConfig!A:B');
  const cfg  = {};
  (data.values || []).forEach(r => { if (r[0]) cfg[r[0]] = r[1] || ''; });
  try { kanbanColumns = JSON.parse(cfg.columns) || DEFAULT_COLUMNS; } catch { kanbanColumns = DEFAULT_COLUMNS; }
  try { kanbanAreas   = JSON.parse(cfg.areas)   || DEFAULT_AREAS;   } catch { kanbanAreas   = DEFAULT_AREAS;   }
}

async function saveKanbanConfig() {
  await sheetsReq('/values/KanbanConfig!A1:B2?valueInputOption=RAW', {
    method: 'PUT',
    body: JSON.stringify({ values: [
      ['columns', JSON.stringify(kanbanColumns)],
      ['areas',   JSON.stringify(kanbanAreas)]
    ]})
  });
}

// ── Kanban Tasks CRUD ─────────────────────────────────────────────────────────

export async function loadKanbanTasks() {
  const data = await sheetsReq('/values/KanbanTasks!A:P');
  const rows = (data.values || []).slice(1);
  kanbanTasks = rows
    .filter(r => r[0])
    .map((r, i) => ({
      id:           r[0] || '',
      area:         r[1] || '',
      title:        r[2] || '',
      desc:         r[3] || '',
      dueDate:      r[4] || '',
      status:       r[5] || '',
      createdAt:    r[6] || '',
      updatedAt:    r[7] || '',
      subtasks:     safeParseJSON(r[8], []),
      observations: safeParseJSON(r[9], []),
      priority:     r[10] || '',
      startDate:    r[11] || '',
      projectId:    r[12] || '',
      dependsOn:    safeParseJSON(r[13], []),
      timeSessions: safeParseJSON(r[14], []),
      sortOrder:    r[15] !== undefined && r[15] !== '' ? +r[15] : null,
      rowIndex:     i + 2
    }));
  updateDueBadgeCounts();
}

async function appendKanbanTask(task) {
  await sheetsReq('/values/KanbanTasks!A:P:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      task.id, task.area, task.title, task.desc,
      task.dueDate, task.status, task.createdAt, task.updatedAt,
      JSON.stringify(task.subtasks || []),
      JSON.stringify(task.observations || []),
      task.priority || '',
      task.startDate || '',
      task.projectId || '',
      JSON.stringify(task.dependsOn || []),
      JSON.stringify(task.timeSessions || []),
      task.sortOrder ?? ''
    ]]})
  });
}

async function updateKanbanTask(task) {
  await sheetsReq(`/values/KanbanTasks!A${task.rowIndex}:P${task.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      task.id, task.area, task.title, task.desc,
      task.dueDate, task.status, task.createdAt, new Date().toISOString(),
      JSON.stringify(task.subtasks || []),
      JSON.stringify(task.observations || []),
      task.priority || '',
      task.startDate || '',
      task.projectId || '',
      JSON.stringify(task.dependsOn || []),
      JSON.stringify(task.timeSessions || []),
      task.sortOrder ?? ''
    ]]})
  });
}

async function deleteKanbanTaskRow(rowIndex) {
  if (!kanbanTasksSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'KanbanTasks');
    if (tab) kanbanTasksSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{
      deleteDimension: {
        range: {
          sheetId:    kanbanTasksSheetId,
          dimension:  'ROWS',
          startIndex: rowIndex - 1,
          endIndex:   rowIndex
        }
      }
    }]})
  });
}

async function deleteTaskWithUndo(taskId, rowIndex) {
  const task = kanbanTasks.find(t => t.id === taskId);
  const snapshot = task ? JSON.parse(JSON.stringify(task)) : null;
  await deleteKanbanTaskRow(rowIndex);
  await loadKanbanTasks();
  if (snapshot) {
    pushUndo(async () => {
      await appendKanbanTask(snapshot);
      await loadKanbanTasks();
      renderCurrentSubTab();
    });
  }
}

// ── Gantt Projects CRUD ─────────────────────────────────────────────────────────

async function loadGanttProjects() {
  const data = await sheetsReq('/values/GanttProjects!A:D');
  const rows = (data.values || []).slice(1);
  ganttProjects = rows
    .filter(r => r[0])
    .map((r, i) => ({
      id:        r[0] || '',
      name:      r[1] || '',
      color:     r[2] || '#714B67',
      createdAt: r[3] || '',
      rowIndex:  i + 2
    }));
  ganttProjectsLoaded = true;
  if (currentGanttProjectId && !ganttProjects.find(p => p.id === currentGanttProjectId))
    currentGanttProjectId = null;
  if (!currentGanttProjectId && ganttProjects.length) currentGanttProjectId = ganttProjects[0].id;
}

async function appendGanttProject(project) {
  await sheetsReq('/values/GanttProjects!A:D:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[project.id, project.name, project.color, project.createdAt]] })
  });
}

async function updateGanttProject(project) {
  await sheetsReq(`/values/GanttProjects!A${project.rowIndex}:D${project.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[project.id, project.name, project.color, project.createdAt]] })
  });
}

async function deleteGanttProjectRow(rowIndex) {
  if (!ganttProjectsSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'GanttProjects');
    if (tab) ganttProjectsSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{
      deleteDimension: {
        range: {
          sheetId:    ganttProjectsSheetId,
          dimension:  'ROWS',
          startIndex: rowIndex - 1,
          endIndex:   rowIndex
        }
      }
    }]})
  });
}

async function deleteGanttProject(projectId) {
  const project = ganttProjects.find(p => p.id === projectId);
  if (!project) return;
  const affected = kanbanTasks.filter(t => t.projectId === projectId);
  await deleteGanttProjectRow(project.rowIndex);
  for (const t of affected) {
    t.projectId = ''; t.startDate = '';
    await updateKanbanTask(t);
  }
  await loadGanttProjects();
}

// ── Kanban Render ─────────────────────────────────────────────────────────────

function fmtDue(dateStr) {
  if (!dateStr) return { text: '', cls: '' };
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((d - today) / 86400000);
  const label = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' });
  if (diff < 0)  return { text: `⚠️ ${label}`, cls: 'overdue' };
  if (diff === 0) return { text: `🔴 HOY`,      cls: 'today'  };
  if (diff === 1) return { text: `🟡 Mañana`,   cls: ''       };
  return { text: `📅 ${label}`, cls: '' };
}

export function getDueStatus(dateStr) {
  if (!dateStr) return '';
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff < 0) return 'vencido';
  if (diff === 0) return 'hoy';
  if (diff <= 3) return 'porVencer';
  return 'normal';
}

// ── Header due-date badges (Hoy / Atrasado / A futuro) ────────────────────────

function getDueCategory(dateStr) {
  if (!dateStr) return null;
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff < 0)  return 'atrasado';
  if (diff === 0) return 'hoy';
  return 'futuro';
}

function getTasksByDueCategory(cat) {
  return kanbanTasks
    .filter(t => !TERMINAL_STATES.includes(t.status) && getDueCategory(t.dueDate) === cat)
    .sort((a, b) => (a.dueDate || '') < (b.dueDate || '') ? -1 : 1);
}

function updateDueBadgeCounts() {
  const hoyEl      = document.getElementById('dueCountHoy');
  const atrasadoEl = document.getElementById('dueCountAtrasado');
  const futuroEl   = document.getElementById('dueCountFuturo');
  if (!hoyEl || !atrasadoEl || !futuroEl) return;
  hoyEl.textContent      = getTasksByDueCategory('hoy').length;
  atrasadoEl.textContent = getTasksByDueCategory('atrasado').length;
  futuroEl.textContent   = getTasksByDueCategory('futuro').length;
}

const DUE_CATEGORY_LABELS = { hoy: 'Tareas para hoy', atrasado: 'Tareas atrasadas', futuro: 'Tareas a futuro' };

function renderDueBadgeDropdown(cat) {
  const tasks = getTasksByDueCategory(cat);
  document.getElementById('dueBadgeDropdownTitle').textContent = `${DUE_CATEGORY_LABELS[cat]} (${tasks.length})`;
  const list = document.getElementById('dueBadgeDropdownList');
  if (!tasks.length) {
    list.innerHTML = '<div class="due-badge-dropdown-empty">No hay tareas.</div>';
    return;
  }
  list.innerHTML = tasks.map(t => `
    <div class="due-badge-dropdown-item" data-task="${esc(t.id)}">
      <span class="due-badge-item-title">${esc(t.title)}</span>
      <span class="due-badge-item-meta">${esc(t.area)} · ${fmtDueShort(t.dueDate)}</span>
    </div>
  `).join('');
  list.querySelectorAll('[data-task]').forEach(el => {
    el.addEventListener('click', () => {
      closeDueBadgeDropdown();
      navigateTo('tareas');
      openTaskDetail(el.dataset.task);
    });
  });
}

export function openDueBadgeDropdown(cat) {
  renderDueBadgeDropdown(cat);
  document.querySelectorAll('.due-badge').forEach(b => b.classList.toggle('active', b.dataset.dueCat === cat));
  document.getElementById('dueBadgeDropdown').style.display = '';
}

export function closeDueBadgeDropdown() {
  document.getElementById('dueBadgeDropdown').style.display = 'none';
  document.querySelectorAll('.due-badge').forEach(b => b.classList.remove('active'));
}

const PRIORITY_LABELS = { alta: '🔴 Alta', media: '🟡 Media', baja: '🟢 Baja' };

function getTrafficLight(dateStr) {
  if (!dateStr) return null;
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff < 0)  return { cls: 'traffic-red',    tip: `Vencida hace ${Math.abs(diff)} día${Math.abs(diff) !== 1 ? 's' : ''}` };
  if (diff === 0) return { cls: 'traffic-orange', tip: 'Vence HOY' };
  if (diff <= 2)  return { cls: 'traffic-yellow', tip: `${diff} día${diff !== 1 ? 's' : ''} restante${diff !== 1 ? 's' : ''}` };
  if (diff <= 7)  return { cls: 'traffic-green',  tip: `${diff} días restantes` };
  return { cls: 'traffic-gray', tip: `${diff} días restantes` };
}

export function renderKanban() {
  const board      = document.getElementById('kanbanBoard');
  if (!board) return;
  updateFilterButtonLabel('kanbanFilterBtn', kanbanActiveFilters);
  const areaFilter     = kanbanActiveFilters.area     || '';
  const priorityFilter = kanbanActiveFilters.priority || '';
  const dueFilter      = kanbanActiveFilters.due      || '';

  let tasks = kanbanTasks;
  if (areaFilter)     tasks = tasks.filter(t => t.area === areaFilter);
  if (priorityFilter) tasks = tasks.filter(t => t.priority === priorityFilter);
  if (dueFilter)      tasks = tasks.filter(t => getDueStatus(t.dueDate) === dueFilter);
  const visibleCols = kanbanColumns.filter(c => !c.terminal || showTerminal);

  board.innerHTML = '';

  visibleCols.forEach(col => {
    const colTasks = tasks.filter(t => t.status === col.name);
    const colEl    = document.createElement('div');
    colEl.className = 'kanban-col' + (col.terminal ? ' terminal' : '');

    colEl.innerHTML = `
      <div class="kanban-col-header" draggable="true" title="Arrastra para reordenar columna">
        <span class="kanban-col-dot" style="background:${esc(col.color)}"></span>
        <span class="kanban-col-title">${esc(col.name)}</span>
        <span class="kanban-col-count">${colTasks.length}</span>
        ${col.terminal ? '' : `<button class="kanban-add-card-icon" data-col="${esc(col.name)}" title="Agregar tarea" draggable="false">+</button>`}
        <span class="col-drag-handle" title="Mover columna">⠿</span>
      </div>
      <div class="kanban-col-body" data-col="${esc(col.name)}"></div>
    `;

    // ── Column drag-to-reorder ────────────────────────────────────────────
    const colHeader = colEl.querySelector('.kanban-col-header');
    colHeader.addEventListener('dragstart', e => {
      draggedColName = col.name;
      colEl.classList.add('col-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation();
    });
    colHeader.addEventListener('dragend', () => {
      colEl.classList.remove('col-dragging');
      document.querySelectorAll('.kanban-col.col-drag-over').forEach(c => c.classList.remove('col-drag-over'));
      draggedColName = null;
    });
    colEl.addEventListener('dragover', e => {
      if (!draggedColName || draggedColName === col.name) return;
      e.preventDefault();
      colEl.classList.add('col-drag-over');
    });
    colEl.addEventListener('dragleave', e => {
      if (!colEl.contains(e.relatedTarget)) colEl.classList.remove('col-drag-over');
    });
    colEl.addEventListener('drop', async e => {
      colEl.classList.remove('col-drag-over');
      if (!draggedColName || draggedColName === col.name) return;
      e.preventDefault(); e.stopPropagation();
      const fromIdx = kanbanColumns.findIndex(c => c.name === draggedColName);
      const toIdx   = kanbanColumns.findIndex(c => c.name === col.name);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = kanbanColumns.splice(fromIdx, 1);
      kanbanColumns.splice(toIdx, 0, moved);
      renderKanban();
      try { await saveKanbanConfig(); } catch {}
    });

    const colBody = colEl.querySelector('.kanban-col-body');

    colTasks.forEach(task => {
      const due = fmtDue(task.dueDate);
      const tl  = getTrafficLight(task.dueDate);
      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.setAttribute('draggable', 'true');
      card.dataset.id  = task.id;

      const subtasksBullets = (task.subtasks || []).map(s => {
        const sdue = s.dueDate ? `<span class="subtask-bullet-date">${fmtDueShort(s.dueDate)}</span>` : '';
        return `<div class="subtask-bullet${s.done ? ' done' : ''}">• ${esc(s.text)}${sdue}</div>`;
      }).join('');

      card.innerHTML = `
        <div class="kanban-card-area">${esc(task.area)}${task.priority ? `<span class="kanban-card-priority kanban-priority-${esc(task.priority)}">${PRIORITY_LABELS[task.priority] || ''}</span>` : ''}</div>
        <div class="kanban-card-title">${esc(task.title)}</div>
        ${task.desc ? `<div class="kanban-card-desc">${esc(task.desc)}</div>` : ''}
        ${subtasksBullets ? `<div class="kanban-card-subtasks">${subtasksBullets}</div>` : ''}
        ${due.text   ? `<div class="kanban-card-due ${due.cls}">${due.text}</div>` : ''}
        <div class="kanban-card-footer">
          <span class="kanban-card-hint">doble clic = ver detalle</span>
          <div style="display:flex;gap:4px">
            <button data-edit="${task.id}" title="Editar">${ICON_EDIT}</button>
            <button data-del="${task.id}" data-row="${task.rowIndex}" title="Eliminar">${ICON_TRASH}</button>
          </div>
        </div>
        ${tl ? `<div class="kanban-traffic-bar ${tl.cls}" title="${tl.tip}"></div>` : ''}
      `;

      card.addEventListener('dblclick', (e) => {
        if (e.target.closest('button')) return;
        openTaskDetail(task.id);
      });

      card.addEventListener('touchend', (e) => {
        if (e.target.closest('button') || wasAccidentalTouch()) return;
        const now = Date.now();
        const last = lastTapTime[task.id] || 0;
        lastTapTime[task.id] = now;
        if (now - last < 350) openTaskDetail(task.id);
      });

      card.addEventListener('dragstart', e => {
        if (draggedColName) { e.preventDefault(); return; }
        draggedId = task.id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        draggedId = null;
      });

      colBody.appendChild(card);
    });

    colEl.addEventListener('dragover', e => {
      if (draggedColName || !draggedId) return; // column drag takes priority
      e.preventDefault();
    });
    colEl.addEventListener('drop', async e => {
      if (!draggedId) return;
      e.preventDefault();
      const newStatus = col.name;
      const task = kanbanTasks.find(t => t.id === draggedId);
      if (!task || task.status === newStatus) return;
      if (TERMINAL_STATES.includes(newStatus)) {
        if (!confirm(`¿Finalizar la tarea como "${newStatus}"?`)) return;
      }
      const prevStatus = task.status;
      task.status = newStatus;
      if (TERMINAL_STATES.includes(newStatus)) stopTaskTimer(task);
      renderKanban();
      try {
        await updateKanbanTask(task);
        pushUndo(async () => {
          const t = kanbanTasks.find(x => x.id === task.id);
          if (!t) return;
          t.status = prevStatus;
          await updateKanbanTask(t);
          renderCurrentSubTab();
        });
      }
      catch (err) { alert('Error al guardar: ' + err.message); await loadKanbanTasks(); renderKanban(); }
    });

    board.appendChild(colEl);
  });

  const termCount = kanbanTasks.filter(t => TERMINAL_STATES.includes(t.status)).length;
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'kanban-toggle-terminal';
  toggleBtn.textContent = showTerminal
    ? '⬆️ Ocultar finalizadas'
    : `⬇️ Finalizadas (${termCount})`;
  toggleBtn.addEventListener('click', () => { showTerminal = !showTerminal; renderKanban(); });
  board.appendChild(toggleBtn);

  board.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openTaskModal(null, btn.dataset.edit));
  });
  board.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta tarea?')) return;
      btn.disabled = true;
      try {
        await deleteTaskWithUndo(btn.dataset.del, +btn.dataset.row);
        renderKanban();
      } catch (e) { alert('Error: ' + e.message); btn.disabled = false; }
    });
  });
  board.querySelectorAll('.kanban-add-card-icon').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openTaskModal(btn.dataset.col, null); });
  });
}

// ── Lista Render ──────────────────────────────────────────────────────────────

export function renderKanbanList() {
  const container    = document.getElementById('tasksList');
  if (!container) return;
  updateFilterButtonLabel('listaFilterBtn', listaActiveFilters);
  const areaFilter     = listaActiveFilters.area     || '';
  const statusFilter   = listaActiveFilters.status   || '';
  const priorityFilter = listaActiveFilters.priority || '';
  const dueFilter      = listaActiveFilters.due      || '';

  let tasks = [...kanbanTasks];
  if (areaFilter)     tasks = tasks.filter(t => t.area     === areaFilter);
  if (statusFilter)   tasks = tasks.filter(t => t.status   === statusFilter);
  if (priorityFilter) tasks = tasks.filter(t => t.priority === priorityFilter);
  if (dueFilter)      tasks = tasks.filter(t => getDueStatus(t.dueDate) === dueFilter);
  tasks.sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1);

  if (!tasks.length) {
    container.innerHTML = '<div class="empty-state">No hay tareas con estos filtros.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'tasks-table';
  table.innerHTML = `<thead><tr>
    <th>Área</th><th>Tarea</th><th>Estado</th><th>Prioridad</th><th>Fecha límite</th><th>Tiempo</th><th></th>
  </tr></thead><tbody></tbody>`;

  const tbody = table.querySelector('tbody');
  tasks.forEach(task => {
    const col   = kanbanColumns.find(c => c.name === task.status);
    const color = col ? col.color : '#999';
    const due   = fmtDue(task.dueDate);
    const stCount = (task.subtasks || []).length;
    const tr    = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.innerHTML = `
      <td><span style="font-size:12px;color:var(--text-sub)">${esc(task.area)}</span></td>
      <td>
        <strong style="font-size:13px;color:var(--vinotinto);display:block">${esc(task.title)}</strong>
        ${task.desc ? `<span style="font-size:11px;color:var(--text-sub)">${esc(task.desc)}</span>` : ''}
        ${stCount ? `<span style="font-size:11px;color:var(--text-sub)">📋 ${stCount} sub-tarea${stCount !== 1 ? 's' : ''}</span>` : ''}
      </td>
      <td><span class="status-pill" style="background:${color}22;color:${color}">${esc(task.status)}</span></td>
      <td>${task.priority ? `<span class="kanban-card-priority kanban-priority-${esc(task.priority)}">${PRIORITY_LABELS[task.priority] || ''}</span>` : ''}</td>
      <td><span class="kanban-card-due ${due.cls}" style="font-size:12px">${due.text}</span></td>
      <td><span style="font-size:12px;color:var(--text-sub)">${(task.timeSessions || []).length ? fmtDuration(getTaskTotalMs(task)) : '—'}</span></td>
      <td style="white-space:nowrap">
        <button class="task-action-btn" data-view="${task.id}" title="Ver detalle">👁</button>
        <button class="task-action-btn" data-edit="${task.id}" title="Editar">${ICON_EDIT}</button>
        <button class="task-action-btn" data-del="${task.id}" data-row="${task.rowIndex}" title="Eliminar">${ICON_TRASH}</button>
      </td>
    `;
    tr.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      openTaskDetail(task.id);
    });
    tbody.appendChild(tr);
  });

  container.innerHTML = '';
  container.appendChild(table);

  container.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => openTaskDetail(btn.dataset.view));
  });
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openTaskModal(null, btn.dataset.edit));
  });
  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta tarea?')) return;
      btn.disabled = true;
      try {
        await deleteTaskWithUndo(btn.dataset.del, +btn.dataset.row);
        renderKanbanList();
      } catch (e) { alert('Error: ' + e.message); btn.disabled = false; }
    });
  });
}

// ── Calendario Render ────────────────────────────────────────────────────────

export function renderCalendar() {
  const wrap = document.getElementById('calendarWrap');
  if (!wrap) return;

  const year  = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const monthLabelEl = document.getElementById('calendarMonthLabel');
  if (monthLabelEl) {
    const label = calendarMonth.toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
    monthLabelEl.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  }

  const firstOfMonth = new Date(year, month, 1);
  const startOffset  = (firstOfMonth.getDay() + 6) % 7; // lunes = 0
  const gridStart    = new Date(year, month, 1 - startOffset);
  const daysInGrid   = 42; // 6 semanas
  const todayISO     = toISODate(new Date());

  const tasksByDate = {};
  kanbanTasks.forEach(t => {
    if (!t.dueDate) return;
    (tasksByDate[t.dueDate] ||= []).push(t);
  });

  const weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const headerHTML = weekdayLabels.map(d => `<div class="calendar-weekday">${d}</div>`).join('');

  let cellsHTML = '';
  for (let i = 0; i < daysInGrid; i++) {
    const d = addDays(gridStart, i);
    const iso = toISODate(d);
    const inMonth = d.getMonth() === month;
    const dayTasks = (tasksByDate[iso] || []).slice().sort((a, b) => (a.title || '') < (b.title || '') ? -1 : 1);
    const chips = dayTasks.map(t => {
      const app = ganttBarAppearance(t);
      const c   = getAreaColor(t.area);
      return `<div class="calendar-chip ${app.cls}" data-task="${esc(t.id)}" style="background:${c.bg};color:${c.text}" title="${esc(t.area)} · ${esc(t.title)}">${esc(t.title)}</div>`;
    }).join('');
    cellsHTML += `
      <div class="calendar-cell${inMonth ? '' : ' calendar-cell--out'}${iso === todayISO ? ' calendar-cell--today' : ''}">
        <div class="calendar-cell-date">${d.getDate()}</div>
        <div class="calendar-cell-chips">${chips}</div>
      </div>`;
  }

  wrap.innerHTML = `
    <div class="calendar-grid">
      <div class="calendar-header-row">${headerHTML}</div>
      <div class="calendar-body">${cellsHTML}</div>
    </div>
  `;

  wrap.querySelectorAll('[data-task]').forEach(el => {
    el.addEventListener('click', () => openTaskDetail(el.dataset.task));
  });
}

// ── Gantt render engine ───────────────────────────────────────────────────────

const GANTT_UNIT_WIDTH = { day: 60, week: 22, month: 6 };

// parseISODate/toISODate/addDays/diffDays viven en utils.js (importados arriba)

// ── Dependencias entre tareas ─────────────────────────────────────────────────

function getTransitiveDependents(taskId, tasks) {
  const result = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    tasks.forEach(t => {
      if (!result.has(t.id) && (t.dependsOn || []).some(id => id === taskId || result.has(id))) {
        result.add(t.id);
        changed = true;
      }
    });
  }
  return result;
}

function cascadeDependencyShift(changedTask, projectTasks, visited = new Set()) {
  if (visited.has(changedTask.id)) return [];
  visited.add(changedTask.id);
  const changedEnd = parseISODate(changedTask.dueDate);
  const moved = [];
  projectTasks
    .filter(t => (t.dependsOn || []).includes(changedTask.id))
    .forEach(dep => {
      const depStart = parseISODate(dep.startDate || dep.dueDate);
      if (depStart < changedEnd) {
        const dur = diffDays(parseISODate(dep.startDate || dep.dueDate), parseISODate(dep.dueDate || dep.startDate));
        dep.startDate = toISODate(changedEnd);
        dep.dueDate   = toISODate(addDays(changedEnd, dur));
        moved.push(dep, ...cascadeDependencyShift(dep, projectTasks, visited));
      }
    });
  return moved;
}

async function applyCascade(changedTask) {
  const projectTasks = kanbanTasks.filter(t => t.projectId === changedTask.projectId);
  const moved = cascadeDependencyShift(changedTask, projectTasks);
  for (const t of moved) await updateKanbanTask(t);
  return moved;
}

// ── Cronómetro por tarea ──────────────────────────────────────────────────────

let taskTimerInterval = null;

function isTimerRunning(task) {
  const sessions = task.timeSessions || [];
  const last = sessions[sessions.length - 1];
  return !!last && !last.end;
}

function getTaskTotalMs(task) {
  return (task.timeSessions || []).reduce((sum, s) =>
    sum + ((s.end ? new Date(s.end) : new Date()) - new Date(s.start)), 0);
}

// fmtDuration vive en utils.js (importado arriba)

function getInProgressColumnName() {
  const named = kanbanColumns.find(c => !c.terminal && c.name.trim().toLowerCase() === 'en proceso');
  if (named) return named.name;
  const nonTerm = kanbanColumns.filter(c => !c.terminal);
  return (nonTerm[1] || nonTerm[0])?.name || null;
}

function stopTaskTimer(task) {
  const sessions = task.timeSessions || [];
  const last = sessions[sessions.length - 1];
  if (last && !last.end) last.end = new Date().toISOString();
}

function startTaskTimerClock(task) {
  stopTaskTimerClock();
  const el = document.getElementById('taskTimerTotal');
  if (!el) return;
  const update = () => { el.textContent = fmtDuration(getTaskTotalMs(task)); };
  update();
  taskTimerInterval = setInterval(update, 1000);
}

function stopTaskTimerClock() {
  if (taskTimerInterval) { clearInterval(taskTimerInterval); taskTimerInterval = null; }
}

function ganttBarAppearance(task) {
  if (task.status === 'Realizado') return { cls: 'status-done', color: '#2E7D32', icon: '✓ ' };
  if (TERMINAL_STATES.includes(task.status)) return { cls: 'status-dimmed', color: '#546E7A', icon: '' };
  const col = kanbanColumns.find(c => c.name === task.status);
  return { cls: '', color: col ? col.color : '#999', icon: '' };
}

export function renderGanttChart() {
  const projectsBar = document.getElementById('ganttProjectsBar');
  const wrap        = document.getElementById('ganttWrap');
  if (!projectsBar || !wrap) return;

  if (!ganttProjects.length) {
    projectsBar.innerHTML = '';
    wrap.innerHTML = `<div class="empty-state">Aún no hay proyectos Gantt.<br/><button class="btn-primary" id="ganttEmptyAddProject" style="margin-top:12px">+ Nuevo proyecto</button></div>`;
    document.getElementById('ganttEmptyAddProject')?.addEventListener('click', () => document.getElementById('btnManageGanttProjects').click());
    return;
  }
  if (!currentGanttProjectId || !ganttProjects.find(p => p.id === currentGanttProjectId))
    currentGanttProjectId = ganttProjects[0].id;

  projectsBar.innerHTML = ganttProjects.map(p => `
    <button type="button" class="gantt-project-chip${p.id === currentGanttProjectId ? ' active' : ''}" data-project="${esc(p.id)}">
      <span class="gantt-project-chip-dot" style="background:${esc(p.color)}"></span>${esc(p.name)}
    </button>
  `).join('') + `<button type="button" class="gantt-project-chip gantt-project-chip-add" id="ganttAddProjectChip">+ Proyecto</button>`;

  projectsBar.querySelectorAll('[data-project]').forEach(btn => {
    btn.addEventListener('click', () => { currentGanttProjectId = btn.dataset.project; renderGanttChart(); });
  });
  document.getElementById('ganttAddProjectChip').addEventListener('click', () => document.getElementById('btnManageGanttProjects').click());

  const tasks = kanbanTasks
    .filter(t => t.projectId === currentGanttProjectId)
    .slice()
    .sort((a, b) => {
      const hasA = a.sortOrder !== null && a.sortOrder !== undefined;
      const hasB = b.sortOrder !== null && b.sortOrder !== undefined;
      if (hasA && hasB) return a.sortOrder - b.sortOrder;
      if (hasA) return -1;
      if (hasB) return 1;
      return (a.startDate || '9999') < (b.startDate || '9999') ? -1 : 1;
    });

  if (!tasks.length) {
    wrap.innerHTML = `<div class="empty-state">Este proyecto aún no tiene tareas.<br/><button class="btn-primary" id="ganttEmptyAddTask" style="margin-top:12px">+ Nueva tarea</button></div>`;
    document.getElementById('ganttEmptyAddTask')?.addEventListener('click', () => openTaskModal(null, null, currentGanttProjectId));
    return;
  }

  const unitWidth = GANTT_UNIT_WIDTH[ganttZoom] || GANTT_UNIT_WIDTH.week;
  const todayD    = new Date(); todayD.setHours(0, 0, 0, 0);

  let minDate = tasks.reduce((m, t) => { const d = parseISODate(t.startDate || t.dueDate); return !m || d < m ? d : m; }, null);
  let maxDate = tasks.reduce((m, t) => { const d = parseISODate(t.dueDate || t.startDate); return !m || d > m ? d : m; }, null);
  if (todayD < minDate) minDate = todayD;
  if (todayD > maxDate) maxDate = todayD;

  const pad = ganttZoom === 'month' ? 30 : ganttZoom === 'week' ? 7 : 3;
  minDate = addDays(minDate, -pad);
  maxDate = addDays(maxDate, pad);
  const totalDays     = diffDays(minDate, maxDate) + 1;
  const timelineWidth = totalDays * unitWidth;

  let headerHTML = '';
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(minDate, i);
    if (ganttZoom === 'day') {
      headerHTML += `<div class="gantt-header-cell" style="width:${unitWidth}px">${d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', timeZone: 'America/Bogota' })}</div>`;
    } else if (ganttZoom === 'week') {
      const isStart = d.getDay() === 1;
      headerHTML += `<div class="gantt-header-cell gantt-header-cell--thin${isStart ? ' gantt-mark-start' : ''}" style="width:${unitWidth}px">${isStart ? d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' }) : ''}</div>`;
    } else {
      const isStart = d.getDate() === 1;
      headerHTML += `<div class="gantt-header-cell gantt-header-cell--thin${isStart ? ' gantt-mark-start' : ''}" style="width:${unitWidth}px">${isStart ? d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit', timeZone: 'America/Bogota' }) : ''}</div>`;
    }
  }

  const todayOffset = diffDays(minDate, todayD);
  const todayLine = (todayOffset >= 0 && todayOffset < totalDays)
    ? `<div class="gantt-today-line" style="left:${todayOffset * unitWidth}px"></div>` : '';

  // ── Agrupar tareas por área ────────────────────────────────────────────────
  const GROUP_ROW_H = 32, TASK_ROW_H = 40;
  const areaOrder = [];
  kanbanAreas.forEach(a => { if (tasks.some(t => t.area === a)) areaOrder.push(a); });
  tasks.forEach(t => { if (t.area && !areaOrder.includes(t.area)) areaOrder.push(t.area); });
  if (tasks.some(t => !t.area)) areaOrder.push('');

  const displayItems = [];
  areaOrder.forEach(area => {
    const groupTasks = tasks.filter(t => (t.area || '') === area);
    if (!groupTasks.length) return;
    const areaKey = area || 'Sin área';
    displayItems.push({ type: 'group', area, areaKey, count: groupTasks.length, collapsed: ganttCollapsedAreas.has(areaKey) });
    if (!ganttCollapsedAreas.has(areaKey)) groupTasks.forEach(t => displayItems.push({ type: 'task', task: t }));
  });

  let curY = 0;
  const barGeom = {};
  displayItems.forEach(item => {
    if (item.type === 'group') { curY += GROUP_ROW_H; return; }
    const t = item.task;
    const s = parseISODate(t.startDate || t.dueDate);
    const e = parseISODate(t.dueDate || t.startDate);
    const left  = diffDays(minDate, s) * unitWidth;
    const width = Math.max(unitWidth * 0.6, (diffDays(s, e) + 1) * unitWidth - 2);
    barGeom[t.id] = { left, width, y: curY };
    curY += TASK_ROW_H;
  });
  const totalRowsHeight = curY;

  const sidebarHTML = displayItems.map(item => {
    if (item.type === 'group') {
      const c = getAreaColor(item.areaKey);
      return `
        <div class="gantt-group-row" data-area-toggle="${esc(item.areaKey)}" style="background:${c.bg};color:${c.text}">
          <span class="gantt-group-chevron">${item.collapsed ? '▸' : '▾'}</span>
          <span class="gantt-group-name">${esc(item.areaKey)}</span>
          <span class="gantt-group-count">${item.count}</span>
        </div>`;
    }
    const t = item.task;
    return `<div class="gantt-row-label" draggable="true" data-task="${esc(t.id)}" title="Arrastra para reordenar · ${esc(t.title)}">${esc(t.title)}</div>`;
  }).join('');

  const rowsHTML = displayItems.map(item => {
    if (item.type === 'group') {
      const c = getAreaColor(item.areaKey);
      return `<div class="gantt-group-band" style="background:${c.bg}"></div>`;
    }
    const t   = item.task;
    const geom = barGeom[t.id];
    const app = ganttBarAppearance(t);
    return `
      <div class="gantt-row">
        <div class="gantt-bar ${app.cls}" data-task="${esc(t.id)}" style="left:${geom.left}px;width:${geom.width}px;background:${app.color}">
          <div class="gantt-bar-handle gantt-bar-handle--left" data-handle="start"></div>
          <span class="gantt-bar-label">${app.icon}${esc(t.title)}</span>
          <button type="button" class="gantt-bar-done" data-done="${esc(t.id)}" title="Marcar como Realizado">✓</button>
          <div class="gantt-bar-handle gantt-bar-handle--right" data-handle="end"></div>
          <div class="gantt-bar-connect" title="Arrastra para conectar con otra tarea"></div>
        </div>
      </div>`;
  }).join('');

  let depsPaths = '';
  tasks.forEach(t => {
    (t.dependsOn || []).forEach(predId => {
      const pred = barGeom[predId];
      const dep  = barGeom[t.id];
      if (!pred || !dep) return;
      const x1 = pred.left + pred.width, y1 = pred.y + 20;
      const x2 = dep.left,               y2 = dep.y + 20;
      const midX = x1 + Math.max(10, (x2 - x1) / 2);
      depsPaths += `<path d="M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}" class="gantt-dep-path" marker-end="url(#ganttArrow)"/>`;
    });
  });
  const depsSvg = depsPaths
    ? `<svg class="gantt-deps-svg" width="${timelineWidth}" height="${totalRowsHeight}">
        <defs><marker id="ganttArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" class="gantt-dep-arrowhead"/>
        </marker></defs>
        ${depsPaths}
      </svg>`
    : '';

  wrap.innerHTML = `
    <div class="gantt-grid">
      <div class="gantt-sidebar">
        <div class="gantt-sidebar-header"></div>
        ${sidebarHTML}
      </div>
      <div class="gantt-timeline" id="ganttTimelineScroll">
        <div class="gantt-timeline-inner" style="width:${timelineWidth}px">
          <div class="gantt-header-row">${headerHTML}</div>
          <div class="gantt-bars" style="width:${timelineWidth}px">
            ${depsSvg}
            ${todayLine}
            ${rowsHTML}
          </div>
        </div>
      </div>
    </div>
  `;

  wireGanttBarInteractions(tasks, unitWidth);
  wireGanttRowReorder(tasks);

  document.querySelectorAll('[data-area-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.areaToggle;
      if (ganttCollapsedAreas.has(key)) ganttCollapsedAreas.delete(key);
      else ganttCollapsedAreas.add(key);
      renderGanttChart();
    });
  });

  const scrollEl = document.getElementById('ganttTimelineScroll');
  if (scrollEl) scrollEl.scrollLeft = Math.max(0, todayOffset * unitWidth - 200);
}

function wireGanttRowReorder(tasks) {
  let draggedGanttTaskId = null;

  document.querySelectorAll('.gantt-row-label').forEach(label => {
    label.addEventListener('dragstart', e => {
      draggedGanttTaskId = label.dataset.task;
      label.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    label.addEventListener('dragend', () => {
      label.classList.remove('dragging');
      document.querySelectorAll('.gantt-row-label.drag-over-top, .gantt-row-label.drag-over-bottom')
        .forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
      draggedGanttTaskId = null;
    });
    label.addEventListener('dragover', e => {
      if (!draggedGanttTaskId || draggedGanttTaskId === label.dataset.task) return;
      e.preventDefault();
      const rect = label.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      label.classList.toggle('drag-over-top', before);
      label.classList.toggle('drag-over-bottom', !before);
    });
    label.addEventListener('dragleave', () => {
      label.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    label.addEventListener('drop', async e => {
      if (!draggedGanttTaskId || draggedGanttTaskId === label.dataset.task) return;
      e.preventDefault();
      const before = label.classList.contains('drag-over-top');
      label.classList.remove('drag-over-top', 'drag-over-bottom');

      const fromIdx = tasks.findIndex(t => t.id === draggedGanttTaskId);
      let toIdx     = tasks.findIndex(t => t.id === label.dataset.task);
      if (fromIdx === -1 || toIdx === -1) return;

      const reordered = tasks.slice();
      const [moved] = reordered.splice(fromIdx, 1);
      toIdx = reordered.findIndex(t => t.id === label.dataset.task);
      reordered.splice(before ? toIdx : toIdx + 1, 0, moved);

      reordered.forEach((t, i) => { t.sortOrder = i; });
      renderGanttChart();
      try {
        for (const t of reordered) await updateKanbanTask(t);
      } catch (err) {
        alert('Error al guardar el orden: ' + err.message);
        await loadKanbanTasks();
        renderGanttChart();
      }
    });
  });
}

function wireGanttBarInteractions(tasks, unitWidth) {
  document.querySelectorAll('.gantt-bar').forEach(barEl => {
    const task = tasks.find(t => t.id === barEl.dataset.task);
    if (!task) return;

    barEl.querySelectorAll('.gantt-bar-handle').forEach(handle => {
      handle.addEventListener('pointerdown', e => {
        e.stopPropagation();
        startGanttDrag(e, task, handle.dataset.handle, barEl, unitWidth);
      });
    });
    barEl.addEventListener('pointerdown', e => {
      if (e.target.closest('.gantt-bar-handle') || e.target.closest('.gantt-bar-done') || e.target.closest('.gantt-bar-connect')) return;
      startGanttDrag(e, task, 'move', barEl, unitWidth);
    });
    barEl.addEventListener('dblclick', e => {
      if (e.target.closest('.gantt-bar-done') || e.target.closest('.gantt-bar-handle') || e.target.closest('.gantt-bar-connect')) return;
      openTaskDetail(task.id);
    });
    barEl.querySelector('.gantt-bar-connect')?.addEventListener('pointerdown', e => {
      e.stopPropagation();
      startDependencyConnect(e, task, barEl, tasks);
    });
    barEl.querySelector('.gantt-bar-done')?.addEventListener('click', async e => {
      e.stopPropagation();
      if (task.status === 'Realizado') return;
      if (!confirm(`¿Finalizar la tarea como "Realizado"?`)) return;
      const prevStatus = task.status;
      task.status = 'Realizado';
      stopTaskTimer(task);
      try {
        await updateKanbanTask(task);
        renderGanttChart();
        if (currentSubTab === 'kanban') renderKanban();
        pushUndo(async () => {
          const t = kanbanTasks.find(x => x.id === task.id);
          if (!t) return;
          t.status = prevStatus;
          await updateKanbanTask(t);
          renderCurrentSubTab();
        });
      } catch (err) { alert('Error al guardar: ' + err.message); await loadKanbanTasks(); renderGanttChart(); }
    });
  });
}

function startGanttDrag(e, task, mode, barEl, unitWidth) {
  e.preventDefault();
  const startX    = e.clientX;
  const origStart = parseISODate(task.startDate || task.dueDate);
  const origEnd   = parseISODate(task.dueDate || task.startDate);
  const origLeft  = parseFloat(barEl.style.left);
  const origWidth = parseFloat(barEl.style.width);
  barEl.setPointerCapture(e.pointerId);
  barEl.classList.add('dragging');
  let deltaDays = 0;

  function onMove(ev) {
    deltaDays = Math.round((ev.clientX - startX) / unitWidth);
    if (mode === 'move') {
      barEl.style.left = (origLeft + deltaDays * unitWidth) + 'px';
    } else if (mode === 'start') {
      let newLeft  = origLeft + deltaDays * unitWidth;
      let newWidth = origWidth - deltaDays * unitWidth;
      if (newWidth < unitWidth * 0.6) { newWidth = unitWidth * 0.6; newLeft = origLeft + origWidth - newWidth; }
      barEl.style.left  = newLeft + 'px';
      barEl.style.width = newWidth + 'px';
    } else if (mode === 'end') {
      barEl.style.width = Math.max(unitWidth * 0.6, origWidth + deltaDays * unitWidth) + 'px';
    }
  }

  async function onUp(ev) {
    barEl.releasePointerCapture(ev.pointerId);
    barEl.classList.remove('dragging');
    barEl.removeEventListener('pointermove', onMove);
    barEl.removeEventListener('pointerup', onUp);
    barEl.removeEventListener('pointercancel', onUp);
    if (!deltaDays) return;

    let newStart = origStart, newEnd = origEnd;
    if (mode === 'move')  { newStart = addDays(origStart, deltaDays); newEnd = addDays(origEnd, deltaDays); }
    if (mode === 'start') { newStart = addDays(origStart, deltaDays); if (newStart > origEnd) newStart = origEnd; }
    if (mode === 'end')   { newEnd = addDays(origEnd, deltaDays); if (newEnd < origStart) newEnd = origStart; }

    const projectTasksBefore = kanbanTasks
      .filter(t => t.projectId === task.projectId)
      .map(t => ({ id: t.id, startDate: t.startDate, dueDate: t.dueDate }));

    task.startDate = toISODate(newStart);
    task.dueDate    = toISODate(newEnd);
    try {
      await updateKanbanTask(task);
      await applyCascade(task);
      renderGanttChart();
      pushUndo(async () => {
        for (const snap of projectTasksBefore) {
          const t = kanbanTasks.find(x => x.id === snap.id);
          if (!t || (t.startDate === snap.startDate && t.dueDate === snap.dueDate)) continue;
          t.startDate = snap.startDate; t.dueDate = snap.dueDate;
          await updateKanbanTask(t);
        }
        renderCurrentSubTab();
      });
    } catch (err) {
      alert('Error al guardar: ' + err.message);
      await loadKanbanTasks();
      renderGanttChart();
    }
  }

  barEl.addEventListener('pointermove', onMove);
  barEl.addEventListener('pointerup', onUp);
  barEl.addEventListener('pointercancel', onUp);
}

function startDependencyConnect(e, sourceTask, sourceBarEl, tasks) {
  e.preventDefault();
  const barsContainer = sourceBarEl.closest('.gantt-bars');
  if (!barsContainer) return;

  const containerRect = barsContainer.getBoundingClientRect();
  const barRect        = sourceBarEl.getBoundingClientRect();
  const startX = barRect.right - containerRect.left;
  const startY = barRect.top + barRect.height / 2 - containerRect.top;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'gantt-connect-preview');
  svg.setAttribute('width', containerRect.width);
  svg.setAttribute('height', containerRect.height);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', startX); line.setAttribute('y1', startY);
  line.setAttribute('x2', startX); line.setAttribute('y2', startY);
  svg.appendChild(line);
  barsContainer.appendChild(svg);

  const handle = e.target;
  handle.setPointerCapture(e.pointerId);
  let hoveredBar = null;

  function onMove(ev) {
    const x = ev.clientX - containerRect.left;
    const y = ev.clientY - containerRect.top;
    line.setAttribute('x2', x);
    line.setAttribute('y2', y);

    const barUnder = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.gantt-bar');
    const valid = barUnder && barUnder !== sourceBarEl ? barUnder : null;
    if (valid !== hoveredBar) {
      hoveredBar?.classList.remove('connect-target');
      hoveredBar = valid;
      hoveredBar?.classList.add('connect-target');
    }
  }

  async function onUp(ev) {
    handle.releasePointerCapture(ev.pointerId);
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onUp);
    hoveredBar?.classList.remove('connect-target');
    svg.remove();

    const targetBarEl = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.gantt-bar');
    if (!targetBarEl || targetBarEl === sourceBarEl) return;
    const targetTask = tasks.find(t => t.id === targetBarEl.dataset.task);
    if (!targetTask || (targetTask.dependsOn || []).includes(sourceTask.id)) return;

    const projectTasks = kanbanTasks.filter(t => t.projectId === sourceTask.projectId);
    if (getTransitiveDependents(targetTask.id, projectTasks).has(sourceTask.id)) {
      alert('No se puede conectar: crearía una dependencia circular.');
      return;
    }

    targetTask.dependsOn = [...new Set([...(targetTask.dependsOn || []), sourceTask.id])];
    try {
      await updateKanbanTask(targetTask);
      await applyCascade(sourceTask);
      renderGanttChart();
    } catch (err) {
      alert('Error al guardar: ' + err.message);
      await loadKanbanTasks();
      renderGanttChart();
    }
  }

  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onUp);
}

// ── Selects population ────────────────────────────────────────────────────────

export function populateAreaSelects() {
  const taskAreaEl = document.getElementById('taskArea');
  if (taskAreaEl) {
    const cur = taskAreaEl.value;
    taskAreaEl.innerHTML = kanbanAreas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
    if (cur) taskAreaEl.value = cur;
  }
}

export function populateStatusSelects() {
  const taskStatusEl = document.getElementById('taskStatus');
  if (taskStatusEl) {
    const cur = taskStatusEl.value;
    taskStatusEl.innerHTML = kanbanColumns.map(c =>
      `<option value="${esc(c.name)}">${esc(c.name)}${c.terminal ? ' ✓' : ''}</option>`
    ).join('');
    if (cur) taskStatusEl.value = cur;
  }
}

function populateProjectSelects() {
  const taskProjectEl = document.getElementById('taskProject');
  if (taskProjectEl) {
    const cur = taskProjectEl.value;
    taskProjectEl.innerHTML = `<option value="">Ninguno</option>` +
      ganttProjects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    if (cur) taskProjectEl.value = cur;
  }
}

// ── Filtros personalizados (Kanban / Lista) ───────────────────────────────────

const FILTER_FIELDS = {
  area: {
    label: 'Área',
    getOptions: () => kanbanAreas.map(a => ({ value: a, label: a }))
  },
  status: {
    label: 'Estado',
    getOptions: () => kanbanColumns.map(c => ({ value: c.name, label: c.name }))
  },
  priority: {
    label: 'Prioridad',
    getOptions: () => ([
      { value: 'alta',  label: '🔴 Alta' },
      { value: 'media', label: '🟡 Media' },
      { value: 'baja',  label: '🟢 Baja' }
    ])
  },
  due: {
    label: 'Fecha límite',
    getOptions: () => ([
      { value: 'vencido',   label: '⚠️ Vencidos' },
      { value: 'hoy',       label: '🔴 Hoy' },
      { value: 'porVencer', label: '🟡 Por vencer' }
    ])
  }
};

function loadSavedFilters(scope) {
  return safeParseJSON(localStorage.getItem(`ss_savedFilters_${scope}`), []);
}
function persistSavedFilters(scope, list) {
  localStorage.setItem(`ss_savedFilters_${scope}`, JSON.stringify(list));
}

function updateFilterButtonLabel(btnId, activeFilters) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const count = Object.values(activeFilters).filter(Boolean).length;
  btn.textContent = count ? `Filtros (${count})` : 'Filtros';
  btn.classList.toggle('filter-btn--active', count > 0);
}

function closeFilterPanel() {
  document.querySelectorAll('.filter-panel').forEach(p => p.remove());
  if (window._filterPanelCleanup) { window._filterPanelCleanup(); window._filterPanelCleanup = null; }
}

function openFilterPanel(anchorEl, { scope, fieldKeys, activeFilters, onApply }) {
  closeFilterPanel();

  const pop = document.createElement('div');
  pop.className = 'filter-panel';
  document.body.appendChild(pop);

  function render() {
    const usedKeys      = fieldKeys.filter(k => activeFilters[k]);
    const availableKeys = fieldKeys.filter(k => !activeFilters[k]);

    const rowsHTML = usedKeys.map(key => {
      const def  = FILTER_FIELDS[key];
      const opts = def.getOptions();
      const optsHTML = opts.map(o =>
        `<option value="${esc(o.value)}" ${o.value === activeFilters[key] ? 'selected' : ''}>${esc(o.label)}</option>`
      ).join('');
      return `
        <div class="filter-row">
          <span class="filter-row-label">${esc(def.label)}</span>
          <select class="field-select filter-row-select" data-key="${key}">${optsHTML}</select>
          <button type="button" class="filter-row-remove" data-key="${key}" title="Quitar">✕</button>
        </div>`;
    }).join('');

    const addHTML = availableKeys.length ? `
      <select class="field-select" id="filterAddSelect">
        <option value="">+ Agregar filtro…</option>
        ${availableKeys.map(k => `<option value="${k}">${esc(FILTER_FIELDS[k].label)}</option>`).join('')}
      </select>` : '';

    const saved = loadSavedFilters(scope);
    const savedHTML = saved.length ? `
      <div class="filter-panel-subtitle">Filtros guardados</div>
      <div class="filter-saved-list">
        ${saved.map((s, i) => `
          <div class="filter-saved-chip" data-idx="${i}">
            <span class="filter-saved-name">${esc(s.name)}</span>
            <button type="button" class="filter-saved-del" data-idx="${i}" title="Eliminar">✕</button>
          </div>`).join('')}
      </div>` : '';

    const saveRowHTML = usedKeys.length ? `
      <div class="filter-save-row">
        <input type="text" class="field-input" id="filterSaveName" placeholder="Nombre del filtro…" />
        <button type="button" class="btn-outline btn-sm" id="filterSaveBtn">Guardar</button>
      </div>` : '';

    pop.innerHTML = `
      <div class="filter-panel-header">
        <span>Filtros</span>
        ${usedKeys.length ? `<button type="button" class="filter-clear-btn" id="filterClearBtn">Limpiar</button>` : ''}
      </div>
      <div class="filter-rows">${rowsHTML || '<div class="filter-empty">Sin filtros activos.</div>'}</div>
      ${addHTML}
      ${savedHTML}
      ${saveRowHTML}
    `;

    pop.querySelectorAll('.filter-row-select').forEach(sel => {
      sel.addEventListener('change', () => {
        activeFilters[sel.dataset.key] = sel.value;
        onApply(); render();
      });
    });
    pop.querySelectorAll('.filter-row-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        delete activeFilters[btn.dataset.key];
        onApply(); render();
      });
    });
    pop.querySelector('#filterAddSelect')?.addEventListener('change', function() {
      const key = this.value;
      if (!key) return;
      const firstOpt = FILTER_FIELDS[key].getOptions()[0];
      activeFilters[key] = firstOpt ? firstOpt.value : '';
      onApply(); render();
    });
    pop.querySelector('#filterClearBtn')?.addEventListener('click', () => {
      fieldKeys.forEach(k => delete activeFilters[k]);
      onApply(); render();
    });
    pop.querySelector('#filterSaveBtn')?.addEventListener('click', () => {
      const nameInput = pop.querySelector('#filterSaveName');
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      const list = loadSavedFilters(scope);
      list.push({ name, filters: { ...activeFilters } });
      persistSavedFilters(scope, list);
      render();
    });
    pop.querySelectorAll('.filter-saved-chip').forEach(chip => {
      chip.addEventListener('click', e => {
        if (e.target.closest('.filter-saved-del')) return;
        const preset = loadSavedFilters(scope)[+chip.dataset.idx];
        if (!preset) return;
        fieldKeys.forEach(k => delete activeFilters[k]);
        Object.assign(activeFilters, preset.filters);
        onApply(); render();
      });
    });
    pop.querySelectorAll('.filter-saved-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const list = loadSavedFilters(scope);
        list.splice(+btn.dataset.idx, 1);
        persistSavedFilters(scope, list);
        render();
      });
    });
  }

  render();

  const rect = anchorEl.getBoundingClientRect();
  pop.style.top  = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 420)) + 'px';
  pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 300)) + 'px';

  function onDocClick(e) {
    if (!pop.contains(e.target) && e.target !== anchorEl) closeFilterPanel();
  }
  function onKeydown(e) { if (e.key === 'Escape') closeFilterPanel(); }
  setTimeout(() => {
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeydown);
  }, 0);

  window._filterPanelCleanup = () => {
    document.removeEventListener('mousedown', onDocClick);
    document.removeEventListener('keydown', onKeydown);
  };
}

function toggleTaskStartVisibility() {
  const hasProject = !!document.getElementById('taskProject').value;
  document.getElementById('taskStartWrap').style.display = hasProject ? '' : 'none';
  updateTaskDatesTrigger();
}

// fmtDateShortEs vive en utils.js (importado arriba)

function updateTaskDatesTrigger() {
  const trigger = document.getElementById('taskDatesTrigger');
  const label   = document.getElementById('taskDatesLabel');
  if (!trigger || !label) return;
  const hasProject = !!document.getElementById('taskProject').value;
  const due   = document.getElementById('taskDue').value;
  const start = document.getElementById('taskStart').value;
  if (hasProject) {
    label.textContent   = 'Fechas de la tarea (inicio y fin) *';
    trigger.textContent = (start && due) ? `${fmtDateShortEs(start)} → ${fmtDateShortEs(due)}` : 'Elegir fechas…';
  } else {
    label.textContent   = 'Fecha límite de la tarea *';
    trigger.textContent = due ? fmtDateShortEs(due) : 'Elegir fecha…';
  }
}

document.getElementById('taskDatesTrigger').addEventListener('click', () => {
  const dueInput = document.getElementById('taskDue');
  if (dueInput.disabled) return;
  const hasProject  = !!document.getElementById('taskProject').value;
  const startInput  = document.getElementById('taskStart');
  const today       = toISODate(new Date());
  openCalendarPopover(document.getElementById('taskDatesTrigger'), {
    mode:  hasProject ? 'range' : 'single',
    start: startInput.value || today,
    end:   dueInput.value || today,
    onApply: (start, end) => {
      if (hasProject) startInput.value = start;
      dueInput.value = end;
      updateTaskDatesTrigger();
      if (!kanbanEditId) saveTaskDraft();
    }
  });
});

// ── Calendario de selección de fechas (popover) ───────────────────────────────

function closeCalendarPopover() {
  document.querySelectorAll('.cal-popover').forEach(p => p.remove());
  if (window._calPopoverCleanup) { window._calPopoverCleanup(); window._calPopoverCleanup = null; }
}

export function openCalendarPopover(anchorEl, { mode, start, end, onApply }) {
  closeCalendarPopover();

  const pop = document.createElement('div');
  pop.className = 'cal-popover';
  document.body.appendChild(pop);

  let selStart = start, selEnd = end;
  let rangeAnchor = null;
  let viewMonth = parseISODate(selEnd || selStart || toISODate(new Date()));
  viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);

  function render() {
    const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
    const monthLabel = viewMonth.toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
    const firstOfMonth = new Date(y, m, 1);
    const startOffset  = (firstOfMonth.getDay() + 6) % 7; // lunes = 0
    const gridStart    = new Date(y, m, 1 - startOffset);
    const todayISO     = toISODate(new Date());

    let daysHTML = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      const iso = toISODate(d);
      const inMonth  = d.getMonth() === m;
      const isSel    = mode === 'single' ? iso === selEnd : (iso === selStart || iso === selEnd);
      const inRange  = mode === 'range' && selStart && selEnd && iso > selStart && iso < selEnd;
      daysHTML += `<button type="button" class="cal-day${inMonth ? '' : ' cal-day--out'}${iso === todayISO ? ' cal-day--today' : ''}${isSel ? ' cal-day--selected' : ''}${inRange ? ' cal-day--in-range' : ''}" data-date="${iso}">${d.getDate()}</button>`;
    }

    const hint = mode === 'range' ? (rangeAnchor ? 'Elige la fecha final' : 'Elige la fecha de inicio') : '';

    pop.innerHTML = `
      <div class="cal-popover-header">
        <button type="button" class="cal-nav-btn" data-nav="-1">‹</button>
        <span class="cal-popover-title">${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</span>
        <button type="button" class="cal-nav-btn" data-nav="1">›</button>
      </div>
      <div class="cal-weekdays"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div>
      <div class="cal-days">${daysHTML}</div>
      ${hint ? `<div class="cal-popover-footer">${hint}</div>` : ''}
    `;

    pop.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + Number(btn.dataset.nav), 1);
        render();
      });
    });
    pop.querySelectorAll('.cal-day').forEach(btn => {
      btn.addEventListener('click', () => {
        const iso = btn.dataset.date;
        if (mode === 'single') {
          closeCalendarPopover();
          onApply(iso, iso);
          return;
        }
        if (!rangeAnchor) {
          rangeAnchor = iso;
          selStart = selEnd = iso;
          render();
        } else {
          const finalStart = iso < rangeAnchor ? iso : rangeAnchor;
          const finalEnd   = iso < rangeAnchor ? rangeAnchor : iso;
          closeCalendarPopover();
          onApply(finalStart, finalEnd);
        }
      });
    });
  }

  render();

  const rect = anchorEl.getBoundingClientRect();
  pop.style.top  = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 340)) + 'px';
  pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 280)) + 'px';

  function onDocClick(e) {
    if (!pop.contains(e.target) && e.target !== anchorEl) closeCalendarPopover();
  }
  function onKeydown(e) { if (e.key === 'Escape') closeCalendarPopover(); }
  setTimeout(() => {
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeydown);
  }, 0);

  window._calPopoverCleanup = () => {
    document.removeEventListener('mousedown', onDocClick);
    document.removeEventListener('keydown', onKeydown);
  };
}

function renderDependsChecklist(projectId, excludeTaskId, checkedIds) {
  const wrap      = document.getElementById('taskDependsWrap');
  const container = document.getElementById('taskDependsList');
  if (!wrap || !container) return;
  if (!projectId) { wrap.style.display = 'none'; container.innerHTML = ''; return; }
  wrap.style.display = '';

  const projectTasks = kanbanTasks.filter(t => t.projectId === projectId && t.id !== excludeTaskId);
  const blocked = excludeTaskId
    ? getTransitiveDependents(excludeTaskId, kanbanTasks.filter(t => t.projectId === projectId))
    : new Set();
  const eligible = projectTasks.filter(t => !blocked.has(t.id));

  if (!eligible.length) {
    container.innerHTML = '<div class="empty-state" style="padding:6px 0;font-size:12px">No hay otras tareas disponibles en este proyecto.</div>';
    return;
  }
  const checked = new Set(checkedIds || []);
  container.innerHTML = eligible.map(t => `
    <label class="task-depends-item">
      <input type="checkbox" value="${esc(t.id)}" ${checked.has(t.id) ? 'checked' : ''}/>
      <span>${esc(t.title)}</span>
    </label>
  `).join('');
}

function collectDependsOn() {
  return Array.from(document.querySelectorAll('#taskDependsList input[type=checkbox]:checked')).map(cb => cb.value);
}

// ── Task modal ────────────────────────────────────────────────────────────────

export async function openTaskModal(defaultStatus, editId, defaultProjectId) {
  kanbanEditId = editId || null;
  setFieldError('taskTitle', '');
  setFieldError('taskDue', '', 'taskDatesTrigger');
  const overlay = document.getElementById('taskOverlay');
  populateAreaSelects();
  populateStatusSelects();
  if (!ganttProjectsLoaded) await loadGanttProjects();
  populateProjectSelects();

  if (editId) {
    const task = kanbanTasks.find(t => t.id === editId);
    if (!task) return;
    document.getElementById('taskModalTitle').textContent = 'Editar tarea';
    document.getElementById('taskArea').value   = task.area;
    document.getElementById('taskTitle').value  = task.title;
    document.getElementById('taskDesc').value   = task.desc;
    document.getElementById('taskDue').value    = task.dueDate;
    document.getElementById('taskStatus').value = task.status;
    document.getElementById('taskPriority').value = task.priority || '';
    document.getElementById('taskProject').value  = task.projectId || '';
    document.getElementById('taskStart').value    = task.startDate || '';
    renderDependsChecklist(task.projectId || '', task.id, task.dependsOn || []);
    renderSubtasksList(task.subtasks || []);
  } else {
    document.getElementById('taskModalTitle').textContent = 'Nueva tarea';
    const draft = loadTaskDraft();
    if (draft && (draft.title || draft.desc || (draft.subtasks || []).length)) {
      document.getElementById('taskArea').value   = draft.area   || kanbanAreas[0] || '';
      document.getElementById('taskTitle').value  = draft.title  || '';
      document.getElementById('taskDesc').value   = draft.desc   || '';
      document.getElementById('taskDue').value    = draft.due    || toISODate(new Date());
      document.getElementById('taskStatus').value = draft.status || defaultStatus || kanbanColumns.find(c => !c.terminal)?.name || '';
      document.getElementById('taskPriority').value = draft.priority || '';
      document.getElementById('taskProject').value  = draft.project || defaultProjectId || '';
      document.getElementById('taskStart').value     = draft.start   || toISODate(new Date());
      renderDependsChecklist(draft.project || defaultProjectId || '', null, []);
      renderSubtasksList(draft.subtasks || []);
      const fb = document.getElementById('taskFeedback');
      fb.textContent = '↩ Borrador restaurado';
      fb.className   = 'feedback';
      fb.style.color = 'var(--brand)';
    } else {
      document.getElementById('taskArea').value   = kanbanAreas[0] || '';
      document.getElementById('taskTitle').value  = '';
      document.getElementById('taskDesc').value   = '';
      document.getElementById('taskDue').value    = toISODate(new Date());
      const firstNonTerm = kanbanColumns.find(c => !c.terminal);
      document.getElementById('taskStatus').value = defaultStatus || firstNonTerm?.name || '';
      document.getElementById('taskPriority').value = 'alta';
      document.getElementById('taskProject').value  = defaultProjectId || '';
      document.getElementById('taskStart').value     = toISODate(new Date());
      renderDependsChecklist(defaultProjectId || '', null, []);
      renderSubtasksList([]);
      document.getElementById('taskFeedback').textContent = '';
      document.getElementById('taskFeedback').className   = 'feedback';
      document.getElementById('taskFeedback').style.color = '';
    }
  }

  toggleTaskStartVisibility();
  document.getElementById('taskFeedback').textContent = '';
  overlay.classList.add('open');
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
  startTaskAutosave();
}

document.getElementById('taskProject').addEventListener('change', function() {
  toggleTaskStartVisibility();
  renderDependsChecklist(this.value, kanbanEditId, []);
  if (!kanbanEditId) saveTaskDraft();
});

function isTaskFormDirty() {
  const title    = document.getElementById('taskTitle')?.value.trim();
  const desc     = document.getElementById('taskDesc')?.value.trim();
  const subtasks = collectSubtasks();
  return !!(title || desc || subtasks.length);
}

function closeTaskModal() {
  confirmCloseIfDirty('taskOverlay', isTaskFormDirty);
  if (!document.getElementById('taskOverlay').classList.contains('open')) stopTaskAutosave();
}

document.getElementById('btnCloseTask').addEventListener('click', closeTaskModal);
document.getElementById('taskOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('taskOverlay')) closeTaskModal();
});

document.getElementById('btnSaveTask').addEventListener('click', async () => {
  const area     = document.getElementById('taskArea').value;
  const title    = document.getElementById('taskTitle').value.trim();
  const desc     = document.getElementById('taskDesc').value.trim();
  const due      = document.getElementById('taskDue').value;
  const status   = document.getElementById('taskStatus').value;
  const priority = document.getElementById('taskPriority').value;
  const projectId = document.getElementById('taskProject').value;
  const startDate  = document.getElementById('taskStart').value;
  const dependsOn  = projectId ? collectDependsOn() : [];
  const subtasks = collectSubtasks();
  const fb       = document.getElementById('taskFeedback');

  clearFieldErrors('taskTitle', 'taskDue');
  if (!title)    { setFieldError('taskTitle', 'El título es obligatorio.'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (!due)      { setFieldError('taskDue', 'La fecha límite es obligatoria.', 'taskDatesTrigger'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (!priority) return setFb(fb, 'La prioridad es obligatoria.', 'err');
  if (projectId) {
    if (!area)      return setFb(fb, 'El área es obligatoria en tareas de un proyecto Gantt.', 'err');
    if (!startDate) return setFb(fb, 'La fecha de inicio es obligatoria en tareas de un proyecto Gantt.', 'err');
    if (startDate > due) return setFb(fb, 'La fecha de inicio no puede ser posterior a la fecha límite.', 'err');
  }

  const btn = document.getElementById('btnSaveTask');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    let savedId = kanbanEditId;
    let undoSaveFn = null;
    if (kanbanEditId) {
      const task = kanbanTasks.find(t => t.id === kanbanEditId);
      if (task) {
        const prevSnapshot = JSON.parse(JSON.stringify(task));
        task.area = area; task.title = title; task.desc = desc;
        task.dueDate = due; task.status = status; task.subtasks = subtasks;
        task.priority = priority; task.projectId = projectId; task.startDate = projectId ? startDate : '';
        task.dependsOn = dependsOn;
        if (TERMINAL_STATES.includes(status)) stopTaskTimer(task);
        await updateKanbanTask(task);
        undoSaveFn = async () => {
          const t = kanbanTasks.find(x => x.id === prevSnapshot.id);
          if (!t) return;
          Object.assign(t, prevSnapshot);
          await updateKanbanTask(t);
          renderCurrentSubTab();
        };
      }
    } else {
      const now = new Date().toISOString();
      savedId = crypto.randomUUID();
      await appendKanbanTask({
        id: savedId, area, title, desc,
        dueDate: due, status, createdAt: now, updatedAt: now,
        subtasks, observations: [], priority,
        projectId, startDate: projectId ? startDate : '',
        dependsOn, timeSessions: []
      });
      undoSaveFn = async () => {
        const t = kanbanTasks.find(x => x.id === savedId);
        if (!t) return;
        await deleteKanbanTaskRow(t.rowIndex);
        await loadKanbanTasks();
        renderCurrentSubTab();
      };
    }
    clearTaskDraft();
    await loadKanbanTasks();
    if (undoSaveFn) pushUndo(undoSaveFn);

    const savedTask = kanbanTasks.find(t => t.id === savedId);
    if (savedTask && savedTask.projectId) {
      const projectTasks = kanbanTasks.filter(t => t.projectId === savedTask.projectId);
      const moved = [];
      (savedTask.dependsOn || []).forEach(predId => {
        const pred = projectTasks.find(t => t.id === predId);
        if (pred) moved.push(...cascadeDependencyShift(pred, projectTasks));
      });
      if (moved.length) {
        for (const t of moved) await updateKanbanTask(t);
        await loadKanbanTasks();
      }
    }

    document.getElementById('taskOverlay').classList.remove('open');
    stopTaskAutosave();

    renderCurrentSubTab();
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar tarea';
  }
});

// ── Board management modal ────────────────────────────────────────────────────

function renderColsList() {
  const container = document.getElementById('colsList');
  container.innerHTML = kanbanColumns.map(col => `
    <div class="mgmt-item">
      <span class="mgmt-item-dot" style="background:${esc(col.color)}"></span>
      <span class="mgmt-item-name">${esc(col.name)}</span>
      ${col.terminal
        ? '<span class="mgmt-item-tag">Terminal</span>'
        : `<button class="mgmt-item-del" data-del-col="${esc(col.name)}">✕</button>`}
    </div>
  `).join('');

  container.querySelectorAll('[data-del-col]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.delCol;
      if (!confirm(`¿Eliminar el estado "${name}"?`)) return;
      kanbanColumns = kanbanColumns.filter(c => c.name !== name);
      try {
        await saveKanbanConfig();
        renderColsList();
        populateStatusSelects();
        setFb(document.getElementById('boardFeedback'), `✅ Estado eliminado.`, 'ok');
      } catch (e) { setFb(document.getElementById('boardFeedback'), 'Error: ' + e.message, 'err'); }
    });
  });
}

function renderAreasList() {
  const container = document.getElementById('areasList');
  container.innerHTML = kanbanAreas.map(area => `
    <div class="mgmt-item">
      <span class="mgmt-item-name">${esc(area)}</span>
      <button class="mgmt-item-del" data-del-area="${esc(area)}">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-del-area]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.delArea;
      if (!confirm(`¿Eliminar el área "${name}"?`)) return;
      kanbanAreas = kanbanAreas.filter(a => a !== name);
      try {
        await saveKanbanConfig();
        renderAreasList();
        populateAreaSelects();
        setFb(document.getElementById('boardFeedback'), `✅ Área eliminada.`, 'ok');
      } catch (e) { setFb(document.getElementById('boardFeedback'), 'Error: ' + e.message, 'err'); }
    });
  });
}

document.getElementById('btnManageBoard').addEventListener('click', () => {
  renderColsList();
  renderAreasList();
  document.getElementById('boardFeedback').textContent = '';
  document.getElementById('boardOverlay').classList.add('open');
});
function isBoardFormDirty() {
  const colName  = document.getElementById('newColName')?.value.trim();
  const areaName = document.getElementById('newAreaName')?.value.trim();
  return !!(colName || areaName);
}

function closeBoardModal() {
  confirmCloseIfDirty('boardOverlay', isBoardFormDirty);
}

document.getElementById('btnCloseBoard').addEventListener('click', closeBoardModal);
document.getElementById('boardOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('boardOverlay')) closeBoardModal();
});

document.getElementById('btnAddCol').addEventListener('click', async () => {
  const name  = document.getElementById('newColName').value.trim();
  const color = document.getElementById('newColColor').value;
  const fb    = document.getElementById('boardFeedback');
  if (!name) return setFb(fb, 'El nombre del estado es obligatorio.', 'err');
  if (kanbanColumns.find(c => c.name.toLowerCase() === name.toLowerCase()))
    return setFb(fb, 'Ya existe un estado con ese nombre.', 'err');

  kanbanColumns.push({ name, color, terminal: false });
  document.getElementById('newColName').value = '';
  try {
    await saveKanbanConfig();
    renderColsList();
    populateStatusSelects();
    setFb(fb, `✅ Estado "${name}" agregado.`, 'ok');
  } catch (e) { setFb(fb, 'Error: ' + e.message, 'err'); }
});

document.getElementById('btnAddArea').addEventListener('click', async () => {
  const name = document.getElementById('newAreaName').value.trim();
  const fb   = document.getElementById('boardFeedback');
  if (!name) return setFb(fb, 'El nombre del área es obligatorio.', 'err');
  if (kanbanAreas.includes(name)) return setFb(fb, 'Ya existe esa área.', 'err');

  kanbanAreas.push(name);
  document.getElementById('newAreaName').value = '';
  try {
    await saveKanbanConfig();
    renderAreasList();
    populateAreaSelects();
    setFb(fb, `✅ Área "${name}" agregada.`, 'ok');
  } catch (e) { setFb(fb, 'Error: ' + e.message, 'err'); }
});

// ── Gantt projects management modal ─────────────────────────────────────────

function renderGanttProjectsList() {
  const container = document.getElementById('ganttProjectsList');
  if (ganttProjects.length === 0) {
    container.innerHTML = '<div class="empty-state">Aún no hay proyectos.</div>';
    return;
  }
  container.innerHTML = ganttProjects.map(p => `
    <div class="mgmt-item">
      <span class="mgmt-item-dot" style="background:${esc(p.color)}"></span>
      <span class="mgmt-item-name">${esc(p.name)}</span>
      <button class="mgmt-item-del" data-del-project="${esc(p.id)}">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-del-project]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const project = ganttProjects.find(p => p.id === btn.dataset.delProject);
      if (!project) return;
      if (!confirm(`¿Eliminar el proyecto "${project.name}"? Las tareas no se borrarán, quedarán sin proyecto.`)) return;
      const fb = document.getElementById('ganttProjectFeedback');
      try {
        await deleteGanttProject(project.id);
        renderGanttProjectsList();
        populateProjectSelects();
        renderGanttChart();
        setFb(fb, `✅ Proyecto eliminado.`, 'ok');
      } catch (e) { setFb(fb, 'Error: ' + e.message, 'err'); }
    });
  });
}

document.getElementById('btnManageGanttProjects').addEventListener('click', () => {
  renderGanttProjectsList();
  document.getElementById('ganttProjectFeedback').textContent = '';
  document.getElementById('ganttProjectOverlay').classList.add('open');
});
function isGanttProjectFormDirty() {
  return !!document.getElementById('newGanttProjectName')?.value.trim();
}

function closeGanttProjectModal() {
  confirmCloseIfDirty('ganttProjectOverlay', isGanttProjectFormDirty);
}

document.getElementById('btnCloseGanttProjects').addEventListener('click', closeGanttProjectModal);
document.getElementById('ganttProjectOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('ganttProjectOverlay')) closeGanttProjectModal();
});

document.getElementById('btnAddGanttProject').addEventListener('click', async () => {
  const name  = document.getElementById('newGanttProjectName').value.trim();
  const color = document.getElementById('newGanttProjectColor').value;
  const fb    = document.getElementById('ganttProjectFeedback');
  if (!name) return setFb(fb, 'El nombre del proyecto es obligatorio.', 'err');
  if (ganttProjects.find(p => p.name.toLowerCase() === name.toLowerCase()))
    return setFb(fb, 'Ya existe un proyecto con ese nombre.', 'err');

  const project = { id: crypto.randomUUID(), name, color, createdAt: new Date().toISOString() };
  try {
    await appendGanttProject(project);
    await loadGanttProjects();
    if (!currentGanttProjectId) currentGanttProjectId = project.id;
    document.getElementById('newGanttProjectName').value = '';
    renderGanttProjectsList();
    populateProjectSelects();
    renderGanttChart();
    setFb(fb, `✅ Proyecto "${name}" agregado.`, 'ok');
  } catch (e) { setFb(fb, 'Error: ' + e.message, 'err'); }
});

// ── Subtasks (viñetas) helpers ────────────────────────────────────────────────

function renderSubtasksList(items) {
  const container = document.getElementById('subtasksList');
  if (!container) return;
  container.innerHTML = '';
  items.forEach((item, idx) => {
    container.appendChild(buildSubtaskRow(item, idx));
  });
  recalcTaskDueFromSubtasks();
}

function buildSubtaskRow(item, idx) {
  const row = document.createElement('div');
  row.className = 'subtask-item';
  row.dataset.idx = idx;
  row.innerHTML = `
    <span class="subtask-bullet-icon">•</span>
    <input class="subtask-text-input field-input" type="text" value="${esc(item.text || '')}" placeholder="Descripción de la sub-tarea…" />
    <input class="subtask-date-input field-input" type="date" value="${item.dueDate || ''}" title="Fecha límite de esta viñeta" />
    <button class="subtask-remove" title="Quitar">✕</button>
  `;
  row.querySelector('.subtask-remove').addEventListener('click', () => { row.remove(); recalcTaskDueFromSubtasks(); });
  row.querySelector('.subtask-date-input').addEventListener('input', recalcTaskDueFromSubtasks);
  return row;
}

function collectSubtasks() {
  const rows = document.querySelectorAll('#subtasksList .subtask-item');
  return Array.from(rows).map(row => ({
    text:    row.querySelector('.subtask-text-input').value.trim(),
    dueDate: row.querySelector('.subtask-date-input').value || '',
    done:    false
  })).filter(s => s.text);
}

function recalcTaskDueFromSubtasks() {
  const dueInput = document.getElementById('taskDue');
  if (!dueInput) return;
  const dates = Array.from(document.querySelectorAll('#subtasksList .subtask-date-input'))
    .map(el => el.value).filter(Boolean);
  const trigger = document.getElementById('taskDatesTrigger');
  if (dates.length) {
    dueInput.value = dates.reduce((max, d) => d > max ? d : max);
    dueInput.disabled = true;
    dueInput.title = 'Se calcula automáticamente: la fecha más lejana entre las sub-tareas.';
    if (trigger) { trigger.disabled = true; trigger.title = dueInput.title; }
  } else {
    dueInput.disabled = false;
    dueInput.title = '';
    if (trigger) { trigger.disabled = false; trigger.title = ''; }
  }
  updateTaskDatesTrigger();
}

document.getElementById('btnAddSubtask').addEventListener('click', () => {
  const container = document.getElementById('subtasksList');
  const idx = container.querySelectorAll('.subtask-item').length;
  container.appendChild(buildSubtaskRow({ text: '', dueDate: '' }, idx));
  container.lastElementChild.querySelector('.subtask-text-input').focus();
});

// ── Task detail view (read-only + observations) ───────────────────────────────

function openTaskDetail(taskId) {
  const task = kanbanTasks.find(t => t.id === taskId);
  if (!task) return;
  taskDetailId = taskId;

  const col   = kanbanColumns.find(c => c.name === task.status);
  const color = col ? col.color : '#999';
  const due   = fmtDue(task.dueDate);

  const subtasksHTML = (task.subtasks || []).map(s => {
    const range = s.startDate && s.dueDate && s.startDate !== s.dueDate
      ? `${fmtDueShort(s.startDate)} → ${fmtDueShort(s.dueDate)}`
      : (s.dueDate ? fmtDueShort(s.dueDate) : '');
    const sd = range ? `<span class="subtask-bullet-date">${range}</span>` : '';
    return `<div class="detail-subtask-item${s.done ? ' done' : ''}">
      <span class="detail-subtask-bullet">•</span>
      <span>${esc(s.text)}</span>${sd}
    </div>`;
  }).join('');

  const statusOptions = kanbanColumns.map(c =>
    `<option value="${esc(c.name)}" ${c.name === task.status ? 'selected' : ''}>${esc(c.name)}</option>`
  ).join('');

  document.getElementById('taskDetailModalTitle').textContent = task.title;
  document.getElementById('taskDetailContent').innerHTML = `
    <div class="detail-row"><span class="detail-label">Área</span><span class="detail-value">${esc(task.area)}</span></div>
    <div class="detail-row">
      <span class="detail-label">Estado</span>
      <select class="field-select" id="detailStatusSelect" style="font-size:13px;padding:5px 10px">
        ${statusOptions}
      </select>
      <span id="detailStatusSaving" style="font-size:11px;color:var(--text-sub);display:none">Guardando…</span>
    </div>
    <div class="detail-row"><span class="detail-label">Fecha límite</span><span class="kanban-card-due ${due.cls}">${due.text || '—'}</span></div>
    <div class="detail-row">
      <span class="detail-label">Tiempo dedicado</span>
      <span class="detail-timer-total" id="taskTimerTotal">${fmtDuration(getTaskTotalMs(task))}</span>
      <button class="btn-outline btn-sm" id="taskTimerBtn" type="button">${
        (task.timeSessions || []).length === 0 ? '▶ Iniciar tarea' : (isTimerRunning(task) ? '⏸ Pausar' : '▶ Retomar')
      }</button>
    </div>
    ${task.priority ? `<div class="detail-row"><span class="detail-label">Prioridad</span><span class="kanban-card-priority kanban-priority-${esc(task.priority)}">${PRIORITY_LABELS[task.priority] || ''}</span></div>` : ''}
    ${task.desc ? `<div class="detail-row detail-row--col"><span class="detail-label">Descripción</span><span class="detail-value">${esc(task.desc)}</span></div>` : ''}
    <div class="detail-row detail-row--col">
      <span class="detail-label">Sub-tareas</span>
      <div class="detail-subtasks">${subtasksHTML || '<div class="detail-subtask-empty">Sin sub-tareas aún.</div>'}</div>
      <div class="detail-subtask-add">
        <input type="text" id="detailSubtaskText" class="field-input" placeholder="Nueva sub-tarea…" />
        <div class="detail-subtask-add-dates">
          <input type="date" id="detailSubtaskStart" class="field-input" title="Fecha de inicio" />
          <input type="date" id="detailSubtaskEnd" class="field-input" title="Fecha de fin" />
        </div>
        <button class="btn-outline btn-sm" id="btnDetailAddSubtask" type="button">+ Agregar sub-tarea</button>
      </div>
    </div>
    <div class="detail-row detail-row--meta"><span class="detail-label">Creada</span><span class="detail-value">${fmtDate(task.createdAt)}</span></div>
    <div class="detail-row detail-row--meta"><span class="detail-label">Actualizada</span><span class="detail-value">${fmtDate(task.updatedAt)}</span></div>
  `;

  const detailStatusSel = document.getElementById('detailStatusSelect');
  if (detailStatusSel) {
    detailStatusSel.addEventListener('change', async function() {
      const newStatus = this.value;
      const t = kanbanTasks.find(x => x.id === taskDetailId);
      if (!t || t.status === newStatus) return;
      if (TERMINAL_STATES.includes(newStatus) && !confirm(`¿Finalizar la tarea como "${newStatus}"?`)) {
        this.value = t.status;
        return;
      }
      const prev = t.status;
      t.status   = newStatus;
      if (TERMINAL_STATES.includes(newStatus)) stopTaskTimer(t);
      const savingEl = document.getElementById('detailStatusSaving');
      if (savingEl) savingEl.style.display = '';
      try {
        await updateKanbanTask(t);
        openTaskDetail(taskDetailId);
        renderCurrentSubTab();
        pushUndo(async () => {
          const t2 = kanbanTasks.find(x => x.id === t.id);
          if (!t2) return;
          t2.status = prev;
          await updateKanbanTask(t2);
          if (taskDetailId === t2.id) openTaskDetail(taskDetailId);
          renderCurrentSubTab();
        });
      } catch (e) {
        t.status   = prev;
        this.value = prev;
        alert('Error al cambiar estado: ' + e.message);
      } finally {
        if (savingEl) savingEl.style.display = 'none';
      }
    });
  }

  const timerBtn = document.getElementById('taskTimerBtn');
  if (timerBtn) {
    timerBtn.addEventListener('click', async () => {
      const t = kanbanTasks.find(x => x.id === taskDetailId);
      if (!t) return;
      t.timeSessions = t.timeSessions || [];
      const neverStarted = t.timeSessions.length === 0;
      if (isTimerRunning(t)) {
        stopTaskTimer(t);
      } else {
        t.timeSessions.push({ start: new Date().toISOString(), end: null });
        if (neverStarted) {
          const firstNonTerm = kanbanColumns.find(c => !c.terminal);
          if (TERMINAL_STATES.includes(t.status) || t.status === firstNonTerm?.name) {
            const target = getInProgressColumnName();
            if (target) t.status = target;
          }
        }
      }
      timerBtn.disabled = true;
      try {
        await updateKanbanTask(t);
        openTaskDetail(taskDetailId);
        renderCurrentSubTab();
      } catch (e) {
        alert('Error al guardar: ' + e.message);
        await loadKanbanTasks();
        openTaskDetail(taskDetailId);
      }
    });
  }
  if (isTimerRunning(task)) startTaskTimerClock(task); else stopTaskTimerClock();

  const today = toISODate(new Date());
  document.getElementById('detailSubtaskStart').value = today;
  document.getElementById('detailSubtaskEnd').value   = today;
  document.getElementById('btnDetailAddSubtask').addEventListener('click', async () => {
    const text  = document.getElementById('detailSubtaskText').value.trim();
    const start = document.getElementById('detailSubtaskStart').value;
    const end   = document.getElementById('detailSubtaskEnd').value;
    if (!text) return;
    const t = kanbanTasks.find(x => x.id === taskDetailId);
    if (!t) return;
    const addBtn = document.getElementById('btnDetailAddSubtask');
    addBtn.disabled = true;
    try {
      t.subtasks = t.subtasks || [];
      t.subtasks.push({ text, startDate: start, dueDate: end, done: false });
      await updateKanbanTask(t);
      openTaskDetail(taskDetailId);
      renderCurrentSubTab();
      pushUndo(async () => {
        const t2 = kanbanTasks.find(x => x.id === t.id);
        if (!t2 || !(t2.subtasks || []).length) return;
        t2.subtasks.pop();
        await updateKanbanTask(t2);
        if (taskDetailId === t2.id) openTaskDetail(taskDetailId);
        renderCurrentSubTab();
      });
    } catch (e) {
      alert('Error al guardar: ' + e.message);
    } finally {
      addBtn.disabled = false;
    }
  });

  renderObservations(task);

  document.getElementById('obsInput').value = '';
  document.getElementById('taskDetailOverlay').classList.add('open');
}

function renderObservations(task) {
  const list = document.getElementById('observationsList');
  const obs  = task.observations || [];
  if (!obs.length) {
    list.innerHTML = '<div class="obs-empty">Aún sin observaciones</div>';
    return;
  }
  list.innerHTML = obs.map(o => {
    const attachmentsHTML = (o.attachments || []).map(a => {
      const isImage = (a.mimeType || '').startsWith('image/');
      const viewUrl = `https://drive.google.com/file/d/${a.fileId}/view`;
      return isImage
        ? `<a class="obs-attachment obs-attachment--img" href="${viewUrl}" target="_blank" rel="noopener"><img src="${thumbUrl(a.fileId)}" alt="${esc(a.name)}" /></a>`
        : `<a class="obs-attachment obs-attachment--file" href="${viewUrl}" target="_blank" rel="noopener">📄 ${esc(a.name)}</a>`;
    }).join('');
    return `
      <div class="obs-item">
        ${o.text ? `<div class="obs-text">${esc(o.text)}</div>` : ''}
        ${attachmentsHTML ? `<div class="obs-attachments">${attachmentsHTML}</div>` : ''}
        <div class="obs-date">${fmtDate(o.createdAt)}</div>
      </div>
    `;
  }).join('');
  list.scrollTop = list.scrollHeight;
}

document.getElementById('btnCloseTaskDetail').addEventListener('click', () => {
  stopTaskTimerClock();
  document.getElementById('taskDetailOverlay').classList.remove('open');
});
document.getElementById('taskDetailOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('taskDetailOverlay')) {
    stopTaskTimerClock();
    document.getElementById('taskDetailOverlay').classList.remove('open');
  }
});

document.getElementById('btnEditFromDetail').addEventListener('click', () => {
  stopTaskTimerClock();
  document.getElementById('taskDetailOverlay').classList.remove('open');
  openTaskModal(null, taskDetailId);
});

document.getElementById('btnAddObs').addEventListener('click', async () => {
  const text = document.getElementById('obsInput').value.trim();
  if (!text) return;
  const task = kanbanTasks.find(t => t.id === taskDetailId);
  if (!task) return;

  const btn = document.getElementById('btnAddObs');
  btn.disabled = true;
  try {
    task.observations = task.observations || [];
    task.observations.push({ text, createdAt: new Date().toISOString() });
    await updateKanbanTask(task);
    document.getElementById('obsInput').value = '';
    renderObservations(task);
    pushUndo(async () => {
      const t = kanbanTasks.find(x => x.id === task.id);
      if (!t || !(t.observations || []).length) return;
      t.observations.pop();
      await updateKanbanTask(t);
      if (taskDetailId === t.id) renderObservations(t);
    });
  } catch (e) {
    alert('Error al guardar: ' + e.message);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('btnAttachObs').addEventListener('click', () => {
  document.getElementById('obsFileInput').click();
});

document.getElementById('obsFileInput').addEventListener('change', async function() {
  const files = Array.from(this.files || []);
  this.value = '';
  if (!files.length) return;
  const task = kanbanTasks.find(t => t.id === taskDetailId);
  if (!task) return;

  const attachBtn = document.getElementById('btnAttachObs');
  attachBtn.disabled = true;
  const list = document.getElementById('observationsList');
  if (list.querySelector('.obs-empty')) list.innerHTML = '';
  const placeholder = document.createElement('div');
  placeholder.className = 'obs-item obs-item--uploading';
  placeholder.textContent = `Subiendo ${files.length} archivo(s)…`;
  list.appendChild(placeholder);
  list.scrollTop = list.scrollHeight;

  try {
    const attachments = [];
    for (const file of files) {
      const data = await uploadToDrive(file);
      attachments.push({ fileId: data.id, name: file.name, mimeType: file.type });
    }
    task.observations = task.observations || [];
    task.observations.push({ text: '', createdAt: new Date().toISOString(), attachments });
    await updateKanbanTask(task);
    renderObservations(task);
    pushUndo(async () => {
      const t = kanbanTasks.find(x => x.id === task.id);
      if (!t || !(t.observations || []).length) return;
      const removed = t.observations.pop();
      await updateKanbanTask(t);
      for (const a of (removed.attachments || [])) await deleteDriveFile(a.fileId);
      if (taskDetailId === t.id) renderObservations(t);
    });
  } catch (e) {
    placeholder.remove();
    alert('Error al subir archivo: ' + e.message);
  } finally {
    attachBtn.disabled = false;
  }
});

// ── Event listeners: navegación propia de Tareas ─────────────────────────────
// (headerLogoBtn y [data-nav], que son genéricos de toda la app, quedan en main.js)

document.querySelectorAll('.sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchSubTab(btn.dataset.subtab));
});

document.getElementById('btnNewTask').addEventListener('click', () =>
  openTaskModal(null, null, currentSubTab === 'gantt' ? currentGanttProjectId : null));

document.getElementById('kanbanFilterBtn').addEventListener('click', () => {
  openFilterPanel(document.getElementById('kanbanFilterBtn'), {
    scope: 'kanban',
    fieldKeys: ['area', 'priority', 'due'],
    activeFilters: kanbanActiveFilters,
    onApply: renderKanban
  });
});
document.getElementById('listaFilterBtn').addEventListener('click', () => {
  openFilterPanel(document.getElementById('listaFilterBtn'), {
    scope: 'lista',
    fieldKeys: ['area', 'status', 'priority', 'due'],
    activeFilters: listaActiveFilters,
    onApply: renderKanbanList
  });
});

document.querySelectorAll('#ganttZoomSwitch .gantt-zoom-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    ganttZoom = btn.dataset.zoom;
    document.querySelectorAll('#ganttZoomSwitch .gantt-zoom-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderGanttChart();
  });
});

document.getElementById('btnCalendarPrev').addEventListener('click', () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById('btnCalendarNext').addEventListener('click', () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  renderCalendar();
});
document.getElementById('btnCalendarToday').addEventListener('click', () => {
  calendarMonth = (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; })();
  renderCalendar();
});

// ── Auto-guardado de borrador de tarea ───────────────────────────────────────

['taskTitle', 'taskDesc', 'taskDue', 'taskArea', 'taskStatus'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input',  () => { if (!kanbanEditId) saveTaskDraft(); });
    el.addEventListener('change', () => { if (!kanbanEditId) saveTaskDraft(); });
  }
});
document.getElementById('subtasksList')?.addEventListener('input', () => {
  if (!kanbanEditId) saveTaskDraft();
});

// ── Entrada a la vista Tareas desde navigateTo() (main.js) ───────────────────
// Encapsula el reseteo a la pestaña Kanban para no exponer currentSubTab
// como binding reasignable fuera de este módulo.
export function enterTareasView() {
  currentSubTab = 'kanban';
  document.querySelectorAll('.sub-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.subtab === 'kanban');
  });
  document.getElementById('subTabKanban').style.display     = '';
  document.getElementById('subTabLista').style.display      = 'none';
  document.getElementById('subTabGantt').style.display      = 'none';
  document.getElementById('subTabCalendario').style.display = 'none';
  document.getElementById('kanbanToolbar').style.display    = '';
  document.getElementById('ganttToolbar').style.display     = 'none';
  document.getElementById('calendarToolbar').style.display  = 'none';
  document.getElementById('btnManageBoard').style.display   = '';

  document.getElementById('kanbanBoard').innerHTML =
    '<div class="loading-state" style="padding:48px 0">Cargando…</div>';
  loadKanbanConfig().then(() => loadKanbanTasks()).then(() => {
    populateAreaSelects();
    populateStatusSelects();
    renderKanban();
  });
}

