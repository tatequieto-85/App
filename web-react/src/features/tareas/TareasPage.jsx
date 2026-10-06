import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '../../components/layout/PageHeader';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import EmptyState from '../../components/ui/EmptyState';
import { useTareas } from './useTareas';
import TaskList from './TaskList';
import TaskModal from './TaskModal';
import TaskDetailModal from './TaskDetailModal';
import './TareasPage.css';

const DUE_LABELS = { hoy: 'Hoy', atrasado: 'Atrasadas', futuro: 'A futuro' };

// Primera pasada de Tareas (el módulo más grande de la app vanilla) —
// alcance acordado con el usuario: lista de tareas (sin Kanban, a pedido
// explícito) + modal de tarea + detalle. Realizado/Cancelado se archivan
// solas y desaparecen de la lista (también a pedido explícito, ver
// useTareas.js). Quedan pendientes para una vuelta siguiente: Gantt,
// cronómetro, filtros personalizados, una pantalla para ver el historial
// archivado, gestión de tablero/áreas/proyectos y suscripción a
// Google/iOS Calendar — ver tareasApi.js para el detalle completo de qué
// se dejó afuera y por qué.
export default function TareasPage({ onBack }) {
  const {
    loading, error, columns, areas, tasks, tareasPorDueCategory,
    saveTask, deleteTask, changeStatus, toggleSubtask, addSubtask, addObservacion
  } = useTareas();

  const [taskModal, setTaskModal] = useState(null); // { editing, defaultStatus } | null
  const [detailId, setDetailId] = useState(null);
  const [dueAbierto, setDueAbierto] = useState(null); // 'hoy' | 'atrasado' | 'futuro' | null

  useEffect(() => {
    function onDocClick(e) { if (!e.target.closest('.tareas-due-badges')) setDueAbierto(null); }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const detailTask = detailId ? tasks.find(t => t.id === detailId) : null;

  async function handleDelete(task) {
    await deleteTask(task.rowIndex);
  }

  function abrirDetalleDesdeBadge(taskId) {
    setDueAbierto(null);
    setDetailId(taskId);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <PageHeader title="Tareas" onBack={onBack} />

      {!loading && !error && !!tasks.length && (
        <div className="tareas-due-badges">
          {['hoy', 'atrasado', 'futuro'].map(cat => (
            <div key={cat} className="tareas-due-badge-wrap">
              <button
                type="button" className={`tareas-due-badge tareas-due-badge--${cat}${dueAbierto === cat ? ' active' : ''}`}
                onClick={() => setDueAbierto(v => v === cat ? null : cat)}
              >
                {DUE_LABELS[cat]} <strong>{tareasPorDueCategory[cat].length}</strong>
              </button>
              {dueAbierto === cat && (
                <div className="tareas-due-dropdown">
                  {tareasPorDueCategory[cat].length ? tareasPorDueCategory[cat].map(t => (
                    <button type="button" key={t.id} className="tareas-due-dropdown-item" onClick={() => abrirDetalleDesdeBadge(t.id)}>
                      <span className="tareas-due-dropdown-title">{t.title}</span>
                      <span className="tareas-due-dropdown-meta">{t.area}</span>
                    </button>
                  )) : <div className="tareas-due-dropdown-empty">Sin tareas.</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && <div className="loading-state">Cargando…</div>}
      {error && <EmptyState>No se pudo cargar: {error}</EmptyState>}

      {!loading && !error && (
        !tasks.length
          ? <EmptyState>Todavía no hay tareas. Agrega la primera con el botón de abajo.</EmptyState>
          : (
            <TaskList
              columns={columns} tasks={tasks}
              onOpenDetail={setDetailId}
              onEdit={task => setTaskModal({ editing: task })}
              onDelete={handleDelete}
            />
          )
      )}

      <FabButton onClick={() => setTaskModal({ editing: null })}>
        <Icon name="plus" size={16} /> Nueva tarea
      </FabButton>

      <TaskModal
        open={!!taskModal}
        onClose={() => setTaskModal(null)}
        editingTask={taskModal?.editing || null}
        defaultStatus={taskModal?.defaultStatus}
        columns={columns} areas={areas}
        onSave={saveTask}
      />

      <TaskDetailModal
        open={!!detailTask}
        onClose={() => setDetailId(null)}
        task={detailTask}
        columns={columns}
        onChangeStatus={changeStatus}
        onToggleSubtask={toggleSubtask}
        onAddSubtask={addSubtask}
        onAddObservacion={addObservacion}
        onEdit={task => { setDetailId(null); setTaskModal({ editing: task }); }}
      />
    </motion.div>
  );
}
