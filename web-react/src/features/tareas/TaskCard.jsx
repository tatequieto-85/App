import { useState } from 'react';
import Icon from '../../components/icons/Icon';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick';
import { fmtDayMonthSlash } from '../../utils/format';
import { getDueStatus } from '../../services/tareasApi';
import './TaskCard.css';

const PRIORITY_LABELS = { alta: 'Alta', media: 'Media', baja: 'Baja' };

// Un toque abre el detalle (doble clic en la app vanilla — acá un solo
// toque, mismo criterio que el resto de la app React, ver regla 6 de
// convenciones de UI); mantener presionada revela Editar/Borrar (regla 5,
// igual patrón que ya usaba esta misma tarjeta en la app vanilla). Sin
// emojis (regla 17) — la urgencia de la fecha se ve por color, no por
// ícono/emoji.
export default function TaskCard({ task, onOpen, onEdit, onDelete }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useCloseOnOutsideClick(actionsOpen, () => setActionsOpen(false));
  const gestureProps = useRowGestures({
    onTap: () => onOpen(task.id),
    onLongPress: () => setActionsOpen(true)
  });

  const dueStatus = getDueStatus(task.dueDate);
  const dueLabel = !task.dueDate ? '' : dueStatus === 'vencido' ? 'Vencida' : dueStatus === 'hoy' ? 'Hoy' : fmtDayMonthSlash(task.dueDate);

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
    <div ref={wrapRef} className="task-card-wrap">
      <div className="task-card" {...gestureProps}>
        <div className={`task-card-urgencia task-card-urgencia--${dueStatus || 'normal'}`} />
        <div className="task-card-top">
          <span className="task-card-area">{task.area}</span>
          {task.priority && (
            <span className={`task-card-priority task-card-priority--${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
          )}
        </div>
        <div className="task-card-title">{task.title}</div>
        {task.desc && <div className="task-card-desc">{task.desc}</div>}
        {!!(task.subtasks || []).length && (
          <div className="task-card-subtasks">
            {task.subtasks.map((s, i) => (
              <div key={i} className={`task-card-subtask${s.done ? ' done' : ''}`}>• {s.text}</div>
            ))}
          </div>
        )}
        {dueLabel && <div className={`task-card-due task-card-due--${dueStatus}`}>{dueLabel}</div>}
      </div>
      {actionsOpen && (
        <div className="row-actions-bar task-card-actions-bar">
          <button type="button" onClick={() => { setActionsOpen(false); onEdit(task); }}>
            <Icon name="edit" size={13} /> Editar
          </button>
          <button type="button" className="danger" disabled={busy} onClick={handleDelete}>
            <Icon name="trash" size={13} /> Borrar
          </button>
        </div>
      )}
    </div>
  );
}
