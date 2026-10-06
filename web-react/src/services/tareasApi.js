// Portado de ../../tareas.js — primera pasada, a propósito acotada
// (acordado con el usuario): lista de tareas (no Kanban, a pedido
// explícito) + modal de tarea + detalle. Quedan pendientes para una
// vuelta siguiente, ninguno tocado acá: Gantt (y sus campos
// projectId/startDate/dependsOn — se leen/preservan tal cual al editar,
// nunca se pisan), cronómetro por tarea, una pantalla para VER el
// historial archivado (el archivado en sí SÍ está acá, ver
// ARCHIVABLE_STATES/appendTareaHistorial — a pedido explícito del
// usuario: "donde cuando se realiza se elimina la tarea"), filtros
// personalizados, gestión de tablero/áreas, mención @contacto y adjuntos
// en observaciones, y suscripción a Google/iOS Calendar.
import { sheetsReq } from './googleAuth';

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export const TERMINAL_STATES = ['Realizado', 'Cancelado', 'Postpuesto'];
// Un estado terminal NO siempre se archiva: "Postpuesto" se queda a la
// vista (sigue siendo una tarea activa, solo pospuesta) — mismo criterio
// que ../../tareas.js. Al llegar a Realizado/Cancelado, la tarea se saca
// de KanbanTasks y se guarda en TareasHistorial (nunca se borra sin
// dejar rastro).
export const ARCHIVABLE_STATES = ['Realizado', 'Cancelado'];

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
let tareasHistorialSheetId = null;

// Tres hojas: las dos del tablero/lista + TareasHistorial (donde quedan
// archivadas las tareas Realizado/Cancelado). GanttProjects (y su CRUD)
// queda para cuando se migre Gantt.
export async function ensureKanbanSheets() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasTasks = tabs.find(s => s.properties.title === 'KanbanTasks');
  const hasConf  = tabs.find(s => s.properties.title === 'KanbanConfig');
  const hasHist  = tabs.find(s => s.properties.title === 'TareasHistorial');
  if (hasTasks) kanbanTasksSheetId = hasTasks.properties.sheetId;
  if (hasHist)  tareasHistorialSheetId = hasHist.properties.sheetId;

  const reqs = [];
  if (!hasTasks) reqs.push({ addSheet: { properties: { title: 'KanbanTasks' } } });
  if (!hasConf)  reqs.push({ addSheet: { properties: { title: 'KanbanConfig' } } });
  if (!hasHist)  reqs.push({ addSheet: { properties: { title: 'TareasHistorial' } } });
  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: reqs }) });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'KanbanTasks') kanbanTasksSheetId = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'TareasHistorial') tareasHistorialSheetId = r.addSheet.properties.sheetId;
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

  const hd = await sheetsReq('/values/TareasHistorial!A1').catch(() => ({}));
  if (!hd.values) {
    await sheetsReq('/values/TareasHistorial!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [[
        'ID', 'NombrePersonalizado', 'Area', 'Title', 'Status', 'DueDate', 'StartDate',
        'Observations', 'TimeSessions', 'Subtasks', 'CreatedAt', 'CompletadoEn'
      ]] })
    });
  }
}

// Archiva una tarea (Realizado/Cancelado) — sale de KanbanTasks para
// siempre y queda en TareasHistorial, a pedido explícito del usuario
// ("donde cuando se realiza se elimina la tarea"). Sin pantalla propia
// para VER el historial todavía (queda para una vuelta siguiente) — esto
// solo evita que el dato se pierda del todo.
export async function appendTareaHistorial(t) {
  if (!tareasHistorialSheetId) await ensureKanbanSheets();
  await sheetsReq('/values/TareasHistorial!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      t.id, '', t.area, t.title, t.status, t.dueDate, t.startDate || '',
      JSON.stringify(t.observations || []), JSON.stringify(t.timeSessions || []), JSON.stringify(t.subtasks || []),
      t.createdAt, new Date().toISOString()
    ]] })
  });
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
