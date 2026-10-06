import { useCallback, useEffect, useMemo, useState } from 'react';
import * as tareasApi from '../../services/tareasApi';

export function useTareas() {
  const [columns, setColumns] = useState([]);
  const [areas, setAreas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reloadTasks = useCallback(async () => {
    const list = await tareasApi.fetchKanbanTasks();
    setTasks(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await tareasApi.ensureKanbanSheets();
        const [cfg, list] = await Promise.all([tareasApi.fetchKanbanConfig(), tareasApi.fetchKanbanTasks()]);
        if (cancelled) return;
        setColumns(cfg.columns);
        setAreas(cfg.areas);
        setTasks(list);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const tareasPorDueCategory = useMemo(() => {
    const porCat = { hoy: [], atrasado: [], futuro: [] };
    tasks.forEach(t => {
      if (tareasApi.TERMINAL_STATES.includes(t.status)) return;
      const cat = tareasApi.getDueCategory(t.dueDate);
      if (cat) porCat[cat].push(t);
    });
    Object.values(porCat).forEach(list => list.sort((a, b) => (a.dueDate || '') < (b.dueDate || '') ? -1 : 1));
    return porCat;
  }, [tasks]);

  // Realizado/Cancelado no se guardan como un estado más — la tarea se
  // archiva (sale de KanbanTasks, queda en TareasHistorial) y desaparece
  // de la lista activa, a pedido explícito del usuario.
  const archivar = useCallback(async task => {
    await tareasApi.appendTareaHistorial(task);
    await tareasApi.deleteKanbanTaskRow(task.rowIndex);
  }, []);

  // Crea o actualiza — `editId` null = crear. `datos` ya viene con los
  // campos del formulario (ver TaskModal.jsx); los de Gantt (projectId,
  // startDate, dependsOn, timeSessions) se preservan del original al
  // editar, no se tocan en esta primera pasada.
  const saveTask = useCallback(async (datos, editId) => {
    if (editId) {
      const task = tasks.find(t => t.id === editId);
      if (!task) return;
      const updated = { ...task, ...datos };
      if (tareasApi.ARCHIVABLE_STATES.includes(updated.status)) await archivar(updated);
      else await tareasApi.updateKanbanTask(updated);
    } else {
      const now = new Date().toISOString();
      const nueva = {
        id: crypto.randomUUID(), createdAt: now, updatedAt: now,
        observations: [], dependsOn: [], timeSessions: [], sortOrder: null,
        ...datos
      };
      if (tareasApi.ARCHIVABLE_STATES.includes(nueva.status)) {
        // Nunca llegó a existir en KanbanTasks — no hay fila que borrar,
        // solo queda el registro en el historial directo.
        await tareasApi.appendTareaHistorial(nueva);
      } else {
        await tareasApi.appendKanbanTask(nueva);
      }
    }
    await reloadTasks();
  }, [tasks, archivar, reloadTasks]);

  const deleteTask = useCallback(async (rowIndex) => {
    await tareasApi.deleteKanbanTaskRow(rowIndex);
    await reloadTasks();
  }, [reloadTasks]);

  const changeStatus = useCallback(async (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;
    const updated = { ...task, status: newStatus };
    if (tareasApi.ARCHIVABLE_STATES.includes(newStatus)) await archivar(updated);
    else await tareasApi.updateKanbanTask(updated);
    await reloadTasks();
  }, [tasks, archivar, reloadTasks]);

  const toggleSubtask = useCallback(async (taskId, idx) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const subtasks = (task.subtasks || []).map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    await tareasApi.updateKanbanTask({ ...task, subtasks });
    await reloadTasks();
  }, [tasks, reloadTasks]);

  const addSubtask = useCallback(async (taskId, subtask) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const subtasks = [...(task.subtasks || []), subtask];
    await tareasApi.updateKanbanTask({ ...task, subtasks });
    await reloadTasks();
  }, [tasks, reloadTasks]);

  const addObservacion = useCallback(async (taskId, text) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const observations = [...(task.observations || []), { text, createdAt: new Date().toISOString() }];
    await tareasApi.updateKanbanTask({ ...task, observations });
    await reloadTasks();
  }, [tasks, reloadTasks]);

  return {
    loading, error, columns, areas, tasks, tareasPorDueCategory,
    saveTask, deleteTask, changeStatus, toggleSubtask, addSubtask, addObservacion
  };
}
