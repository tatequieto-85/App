// Portado de ../../tareas.js — primera pasada, a propósito acotada
// (acordado con el usuario): Kanban + modal de tarea + detalle. Quedan
// pendientes para una vuelta siguiente, ninguno tocado acá: Lista, Gantt
// (y sus campos projectId/startDate/dependsOn — se leen/preservan tal
// cual al editar, nunca se pisan), cronómetro por tarea, Historial
// (archivado automático de tareas Realizado/Cancelado — acá se quedan
// como cualquier otra columna), filtros personalizados, gestión de
// tablero/áreas, mención @contacto y adjuntos en observaciones, y
// suscripción a Google/iOS Calendar.
import { sheetsReq } from './googleAuth';

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export const TERMINAL_STATES = ['Realizado', 'Cancelado', 'Postpuesto'];

export const DEFAULT_COLUMNS = [
  { name: 'Pendiente',   color: '#6B5050', terminal: false },
  { name: 'En proceso',  color: '#714B67', terminal: false },
  { name: 'En revisión', color: '#7A9C3E', terminal: false },
  { name: 'Realizado',   color: '#2E7D32', terminal: true },
  { name: 'Cancelado',   color: '#C62828', terminal: true },
  { name: 'Postpuesto',  color: '#546E7A', terminal: true }
];
export const DEFAULT_AREAS = ['Marketing', 'Ventas', 'Producción', 'Administración'];

let kanbanTasksSheetId = null;

// Solo las dos hojas que necesita este alcance — GanttProjects (y su CRUD)
// queda para cuando se migre Gantt.
export async function ensureKanbanSheets() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasTasks = tabs.find(s => s.properties.title === 'KanbanTasks');
  const hasConf  = tabs.find(s => s.properties.title === 'KanbanConfig');
  if (hasTasks) kanbanTasksSheetId = hasTasks.properties.sheetId;

  const reqs = [];
  if (!hasTasks) reqs.push({ addSheet: { properties: { title: 'KanbanTasks' } } });
  if (!hasConf)  reqs.push({ addSheet: { properties: { title: 'KanbanConfig' } } });
  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: reqs }) });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'KanbanTasks') kanbanTasksSheetId = r.addSheet.properties.sheetId;
    });
  }

  const td = await sheetsReq('/values/KanbanTasks!A1:P1').catch(() => ({}));
  if (!td.values || (td.values[0] || []).length < 16) {
    await sheetsReq('/values/KanbanTasks!A1:P1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [[
        'ID', 'Area', 'Title', 'Description', 'DueDate', 'Status', 'CreatedAt', 'UpdatedAt',
        'Subtasks', 'Observations', 'Priority', 'StartDate', 'ProjectId', 'DependsOn', 'TimeSessions', 'SortOrder'
      ]] })
    });
  }

  const kd = await sheetsReq('/values/KanbanConfig!A1').catch(() => ({}));
  if (!kd.values) {
    await sheetsReq('/values/KanbanConfig!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [
        ['columns', JSON.stringify(DEFAULT_COLUMNS)],
        ['areas', JSON.stringify(DEFAULT_AREAS)]
      ] })
    });
  }
}

export async function fetchKanbanConfig() {
  const data = await sheetsReq('/values/KanbanConfig!A:B');
  const cfg = {};
  (data.values || []).forEach(r => { if (r[0]) cfg[r[0]] = r[1] || ''; });
  let columns, areas;
  try { columns = JSON.parse(cfg.columns) || DEFAULT_COLUMNS; } catch { columns = DEFAULT_COLUMNS; }
  try { areas = JSON.parse(cfg.areas) || DEFAULT_AREAS; } catch { areas = DEFAULT_AREAS; }
  return { columns, areas };
}

export async function fetchKanbanTasks() {
  const data = await sheetsReq('/values/KanbanTasks!A:P');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
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
    // Campos de Gantt (deferred) — se leen y se preservan tal cual, nunca
    // se editan desde esta primera pasada.
    startDate:    r[11] || '',
    projectId:    r[12] || '',
    dependsOn:    safeParseJSON(r[13], []),
    timeSessions: safeParseJSON(r[14], []),
    sortOrder:    r[15] !== undefined && r[15] !== '' ? +r[15] : null,
    rowIndex:     i + 2
  }));
}

function taskRowValues(t) {
  return [
    t.id, t.area, t.title, t.desc, t.dueDate, t.status, t.createdAt, t.updatedAt || new Date().toISOString(),
    JSON.stringify(t.subtasks || []), JSON.stringify(t.observations || []), t.priority || '',
    t.startDate || '', t.projectId || '', JSON.stringify(t.dependsOn || []),
    JSON.stringify(t.timeSessions || []), t.sortOrder ?? ''
  ];
}

export async function appendKanbanTask(task) {
  await sheetsReq('/values/KanbanTasks!A:P:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [taskRowValues(task)] })
  });
}

export async function updateKanbanTask(task) {
  await sheetsReq(`/values/KanbanTasks!A${task.rowIndex}:P${task.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [taskRowValues({ ...task, updatedAt: new Date().toISOString() })] })
  });
}

export async function deleteKanbanTaskRow(rowIndex) {
  if (!kanbanTasksSheetId) await ensureKanbanSheets();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: kanbanTasksSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

// ── Fecha límite: categoría para el semáforo/badges ─────────────────────────

export function getDueStatus(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return 'vencido';
  if (diff === 0) return 'hoy';
  if (diff <= 3) return 'porVencer';
  return 'normal';
}

export function getDueCategory(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0) return 'atrasado';
  if (diff === 0) return 'hoy';
  return 'futuro';
}
