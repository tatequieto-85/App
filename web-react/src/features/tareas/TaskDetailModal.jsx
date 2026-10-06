import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Select from '../../components/ui/Select';
import Icon from '../../components/icons/Icon';
import { fmtDayMonthSlash, fmtDateTime, toISODate } from '../../utils/format';
import { getDueStatus } from '../../services/tareasApi';
import './TaskDetailModal.css';

const PRIORITY_LABELS = { alta: 'Alta', media: 'Media', baja: 'Baja' };

// Solo lectura + unas pocas acciones puntuales (cambiar estado, tildar
// sub-tareas, agregar una sub-tarea u observación) — sin cronómetro, sin
// mención @contacto ni adjuntos en observaciones (quedan para una vuelta
// siguiente, ver tareasApi.js). "Editar" abre TaskModal para el resto de
// los campos.
export default function TaskDetailModal({ open, onClose, task, columns, onChangeStatus, onToggleSubtask, onAddSubtask, onAddObservacion, onEdit }) {
  const [subText, setSubText] = useState('');
  const [subStart, setSubStart] = useState('');
  const [subEnd, setSubEnd] = useState('');
  const [obsText, setObsText] = useState('');
  const [busyStatus, setBusyStatus] = useState(false);
  const [busySubtask, setBusySubtask] = useState(false);
  const [busyObs, setBusyObs] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = toISODate(new Date());
    setSubText(''); setSubStart(today); setSubEnd(today);
    setObsText('');
  }, [open, task?.id]);

  if (!task) return null;

  const dueStatus = getDueStatus(task.dueDate);
  const dueLabel = !task.dueDate ? '—' : dueStatus === 'vencido' ? `Vencida (${fmtDayMonthSlash(task.dueDate)})` : fmtDayMonthSlash(task.dueDate);

  async function handleChangeStatus(e) {
    const nuevo = e.target.value;
    if (nuevo === task.status) return;
    setBusyStatus(true);
    try {
      await onChangeStatus(task.id, nuevo);
    } catch (err) {
      alert('Error al cambiar estado: ' + err.message);
    } finally {
      setBusyStatus(false);
    }
  }

  async function handleToggleSubtask(idx) {
    setBusySubtask(true);
    try {
      await onToggleSubtask(task.id, idx);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusySubtask(false);
    }
  }

  async function handleAddSubtask() {
    const text = subText.trim();
    if (!text) return;
    setBusySubtask(true);
    try {
      await onAddSubtask(task.id, { text, startDate: subStart, dueDate: subEnd, done: false });
      const today = toISODate(new Date());
      setSubText(''); setSubStart(today); setSubEnd(today);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusySubtask(false);
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
      {task.desc && (
        <div className="task-detail-row task-detail-row--col"><span className="task-detail-label">Descripción</span><span className="task-detail-value">{task.desc}</span></div>
      )}

      <div className="task-detail-row task-detail-row--col">
        <span className="task-detail-label">Sub-tareas</span>
        <div className="task-detail-subtasks">
          {(task.subtasks || []).length ? task.subtasks.map((s, i) => {
            const range = s.startDate && s.dueDate && s.startDate !== s.dueDate
              ? `${fmtDayMonthSlash(s.startDate)} → ${fmtDayMonthSlash(s.dueDate)}`
              : (s.dueDate ? fmtDayMonthSlash(s.dueDate) : '');
            return (
              <div key={i} className={`task-detail-subtask${s.done ? ' done' : ''}`}>
                <button type="button" className="task-detail-subtask-check" disabled={busySubtask} onClick={() => handleToggleSubtask(i)} aria-label={s.done ? 'Marcar pendiente' : 'Marcar realizada'}>
                  {s.done && <Icon name="check" size={11} />}
                </button>
                <span className="task-detail-subtask-text">{s.text}</span>
                {range && <span className="task-detail-subtask-date">{range}</span>}
              </div>
            );
          }) : <p className="empty-state" style={{ padding: '4px 0' }}>Sin sub-tareas aún.</p>}
        </div>
        <div className="task-detail-subtask-add">
          <input type="text" className="field-input" placeholder="Nueva sub-tarea…" value={subText} onChange={e => setSubText(e.target.value)} disabled={busySubtask} />
          <div className="task-detail-subtask-add-dates">
            <input type="date" className="field-input" value={subStart} onChange={e => setSubStart(e.target.value)} disabled={busySubtask} title="Fecha de inicio" />
            <input type="date" className="field-input" value={subEnd} onChange={e => setSubEnd(e.target.value)} disabled={busySubtask} title="Fecha de fin" />
          </div>
          <Button type="button" variant="outline" disabled={busySubtask} onClick={handleAddSubtask}>+ Agregar sub-tarea</Button>
        </div>
      </div>

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
