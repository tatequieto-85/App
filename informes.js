import { addDays, fmtDuration } from './utils.js';
import { kanbanTasks, TERMINAL_STATES, loadKanbanTasks } from './tareas.js';
import { ejecuciones, loadEjecucionesData } from './procesos.js';

let informesRange = 'semana'; // 'semana' | 'mes' | 'todo'

function getInformesRangeDates(range) {
  if (range === 'todo') return { start: null, end: null };
  const now = new Date();
  if (range === 'mes') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }
  // 'semana': lunes 00:00 → lunes siguiente
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const dow = (start.getDay() + 6) % 7; // lunes = 0
  start.setDate(start.getDate() - dow);
  const end = addDays(start, 7);
  return { start, end };
}

function computeInformesStats(range) {
  const { start, end } = getInformesRangeDates(range);
  const inRange = iso => {
    if (!iso) return false;
    if (!start) return true;
    const d = new Date(iso);
    return d >= start && d < end;
  };

  let investedMs = 0, pendingMs = 0;
  kanbanTasks.forEach(t => {
    const ms = (t.timeSessions || [])
      .filter(s => inRange(s.start))
      .reduce((sum, s) => sum + ((s.end ? new Date(s.end) : new Date()) - new Date(s.start)), 0);
    if (t.status === 'Realizado') investedMs += ms;
    else if (!TERMINAL_STATES.includes(t.status)) pendingMs += ms;
  });
  ejecuciones.forEach(ej => {
    if (inRange(ej.fechaFin || ej.fechaInicio)) investedMs += (+ej.duracionTotal || 0) * 1000;
  });

  return { investedMs, pendingMs };
}

export async function renderInformes() {
  if (!kanbanTasks.length) await loadKanbanTasks().catch(() => {});
  if (!ejecuciones.length) await loadEjecucionesData().catch(() => {});

  document.querySelectorAll('#informesRangeSwitch .gantt-zoom-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.range === informesRange);
  });

  const { investedMs, pendingMs } = computeInformesStats(informesRange);
  document.getElementById('informesInvestedValue').textContent = fmtDuration(investedMs);
  document.getElementById('informesPendingValue').textContent  = fmtDuration(pendingMs);
}

document.querySelectorAll('#informesRangeSwitch .gantt-zoom-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    informesRange = btn.dataset.range;
    renderInformes();
  });
});
