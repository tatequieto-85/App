import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Select from '../../components/ui/Select';
import { fmtDayMonthSlash, fmtDateTime } from '../../utils/format';
import { getDueStatus, ARCHIVABLE_STATES } from '../../services/tareasApi';
import './TaskDetailModal.css';

const PRIORITY_LABELS = { alta: 'Alta', media: 'Media', baja: 'Baja' };

// Solo lectura + unas pocas acciones puntuales (cambiar estado, agregar
// una observación) — sin cronómetro, sin sub-tareas (sacadas de la
// interfaz a pedido del usuario), sin mención @contacto ni adjuntos en
// observaciones (quedan para una vuelta siguiente, ver tareasApi.js).
// "Editar" abre TaskModal para el resto de los campos.
export default function TaskDetailModal({ open, onClose, task, columns, onChangeStatus, onAddObservacion, onEdit }) {
  const [obsText, setObsText] = useState('');
  const [busyStatus, setBusyStatus] = useState(false);
  const [busyObs, setBusyObs] = useState(false);

  if (!task) return null;

  const dueStatus = getDueStatus(task.dueDate);
  const dueLabel = !task.dueDate ? '—' : dueStatus === 'vencido' ? `Vencida (${fmtDayMonthSlash(task.dueDate)})` : fmtDayMonthSlash(task.dueDate);

  async function handleChangeStatus(e) {
    const nuevo = e.target.value;
    if (nuevo === task.status) return;
    // Al pasar a un estado archivable (Finalizada) la tarea sale de la
    // lista para siempre (ver useTareas.js) — se pide confirmación antes,
    // a pedido explícito del usuario.
    if (ARCHIVABLE_STATES.includes(nuevo) && !window.confirm('Al finalizar, la tarea se archiva y desaparece de la lista. ¿Continuar?')) {
      e.target.value = task.status;
      return;
    }
    setBusyStatus(true);
    try {
      await onChangeStatus(task.id, nuevo);
    } catch (err) {
      alert('Error al cambiar estado: ' + err.message);
    } finally {
      setBusyStatus(false);
    }
  }

  async function handleAddObs(e) {
    e.preventDefault();
    const text = obsText.trim();
    if (!text) return;
    setBusyObs(true);
    try {
      await onAddObservacion(task.id, text);
      setObsText('');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusyObs(false);
    }
  }

  const obs = task.observations || [];

  return (
    <Modal open={open} onClose={onClose} showBack title={task.title}>
      <div className="task-detail-row"><span className="task-detail-label">Área</span><span className="task-detail-value">{task.area}</span></div>

      <div className="task-detail-row">
        <span className="task-detail-label">Estado</span>
        <Select value={task.status} onChange={handleChangeStatus} disabled={busyStatus} options={columns.map(c => ({ value: c.name, label: c.name }))} />
      </div>

      <div className="task-detail-row">
        <span className="task-detail-label">Fecha límite</span>
        <span className={`task-detail-due task-detail-due--${dueStatus}`}>{dueLabel}</span>
      </div>

      {task.priority && (
        <div className="task-detail-row"><span className="task-detail-label">Prioridad</span><span className="task-detail-value">{PRIORITY_LABELS[task.priority]}</span></div>
      )}

      <div className="task-detail-row task-detail-row--meta"><span className="task-detail-label">Creada</span><span className="task-detail-value">{fmtDateTime(task.createdAt)}</span></div>
      <div className="task-detail-row task-detail-row--meta"><span className="task-detail-label">Actualizada</span><span className="task-detail-value">{fmtDateTime(task.updatedAt)}</span></div>

      <p className="task-detail-subtitle">Observaciones</p>
      <div className="task-detail-obs-list">
        {obs.length ? obs.map((o, i) => (
          <div key={i} className="task-detail-obs-item">
            <div className="task-detail-obs-text">{o.text}</div>
            <div className="task-detail-obs-date">{fmtDateTime(o.createdAt)}</div>
          </div>
        )) : <div className="empty-state" style={{ padding: '8px 0' }}>Aún sin observaciones</div>}
      </div>
      <form onSubmit={handleAddObs} className="task-detail-obs-form">
        <TextField placeholder="Agregar observación…" value={obsText} onChange={e => setObsText(e.target.value)} disabled={busyObs} />
        <Button type="submit" variant="outline" disabled={busyObs}>{busyObs ? 'Guardando…' : 'Agregar'}</Button>
      </form>

      <Button type="button" variant="primary" className="task-detail-edit-btn" onClick={() => onEdit(task)}>
        Editar tarea
      </Button>
    </Modal>
  );
}
