import { useEffect, useState } from 'react';
import Icon from '../../components/icons/Icon';
import { useRowGestures } from '../../hooks/useRowGestures';
import { fmtDayMonthSlash } from '../../utils/format';
import { getDueStatus, TERMINAL_STATES } from '../../services/tareasApi';
import './TaskList.css';

const PRIORITY_LABELS = { alta: 'Alta', media: 'Media', baja: 'Baja' };

// Un toque abre el detalle, mantener presionada revela Editar/Borrar en
// una fila propia debajo (mismo patrón — y la misma idea de "fila de
// acciones" en vez de meterlo en la última columna — que ya usaba esta
// tabla en la app vanilla, ver renderKanbanList()). Realizado/Cancelado
// no aparecen acá: se archivan apenas llegan a ese estado (ver
// useTareas.js), nunca se ven en esta lista.
function TaskRow({ task, columns, actionsOpen, onOpenActions, onOpen, onEdit, onDelete }) {
  const [busy, setBusy] = useState(false);
  const gestureProps = useRowGestures({
    onTap: () => onOpen(task.id),
    onLongPress: () => onOpenActions(task.id)
  });

  const col = columns.find(c => c.name === task.status);
  const color = col?.color || '#999';
  const dueStatus = getDueStatus(task.dueDate);
  const dueLabel = !task.dueDate ? '—' : dueStatus === 'vencido' ? 'Vencida' : dueStatus === 'hoy' ? 'Hoy' : fmtDayMonthSlash(task.dueDate);
  const stCount = (task.subtasks || []).length;

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta tarea?')) return;
    setBusy(true);
    try {
      await onDelete(task);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr className="task-list-row" {...gestureProps}>
        <td>
          <span className="task-list-area">{task.area}</span>
          <strong className="task-list-title">{task.title}</strong>
          {!!stCount && <span className="task-list-subcount">{stCount} sub-tarea{stCount !== 1 ? 's' : ''}</span>}
        </td>
        <td><span className="task-list-status-pill" style={{ background: `${color}22`, color }}>{task.status}</span></td>
        <td><span className={`task-list-due task-list-due--${dueStatus}`}>{dueLabel}</span></td>
        <td>{task.priority && <span className={`task-list-priority task-list-priority--${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>}</td>
      </tr>
      {actionsOpen && (
        <tr className="tasks-row-actions-row">
          <td colSpan={4} style={{ padding: 0 }}>
            <div className="row-actions-bar">
              <button type="button" onClick={() => { onOpenActions(null); onEdit(task); }}>
                <Icon name="edit" size={13} /> Editar
              </button>
              <button type="button" className="danger" disabled={busy} onClick={handleDelete}>
                <Icon name="trash" size={13} /> Borrar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function TaskList({ columns, tasks, onOpenDetail, onEdit, onDelete }) {
  const [showTerminal, setShowTerminal] = useState(false);
  const [actionsOpenId, setActionsOpenId] = useState(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!e.target.closest('.task-list-row') && !e.target.closest('.tasks-row-actions-row')) setActionsOpenId(null);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const termCount = tasks.filter(t => TERMINAL_STATES.includes(t.status)).length;
  let visible = showTerminal ? tasks : tasks.filter(t => !TERMINAL_STATES.includes(t.status));
  visible = [...visible].sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1);

  return (
    <>
      {!!visible.length && (
        <div className="table-scroll">
          <table className="tasks-table">
            <thead><tr><th>Área / Tarea</th><th>Estado</th><th>Fecha límite</th><th>Prioridad</th></tr></thead>
            <tbody>
              {visible.map(task => (
                <TaskRow
                  key={task.id} task={task} columns={columns}
                  actionsOpen={actionsOpenId === task.id}
                  onOpenActions={setActionsOpenId}
                  onOpen={onOpenDetail} onEdit={onEdit} onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!termCount && (
        <button type="button" className="task-list-toggle-terminal" onClick={() => setShowTerminal(v => !v)}>
          {showTerminal ? 'Ocultar pospuestas' : `Pospuestas (${termCount})`}
        </button>
      )}
    </>
  );
}
