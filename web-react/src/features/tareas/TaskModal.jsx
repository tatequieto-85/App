import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Textarea from '../../components/ui/Textarea';
import Select from '../../components/ui/Select';
import Icon from '../../components/icons/Icon';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { toISODate } from '../../utils/format';
import './TaskModal.css';

const PRIORITY_OPTIONS = [
  { value: '', label: 'Elegir…' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' }
];

// Crear/editar tarea — primera pasada acordada con el usuario: sin
// proyecto Gantt/fecha de inicio/dependencias (esos campos se preservan
// tal cual al editar una tarea que ya los tenga, ver useTareas.js —
// simplemente no aparecen acá) y sin el autoguardado de borrador de la
// app vanilla (mismo criterio de "guardar al confirmar" que el resto de
// los modales ya migrados).
export default function TaskModal({ open, onClose, editingTask, columns, areas, defaultStatus, onSave }) {
  const [area, setArea] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ title: '', desc: '' });

  useEffect(() => {
    if (!open) return;
    const firstNonTerm = columns.find(c => !c.terminal)?.name || '';
    if (editingTask) {
      setArea(editingTask.area);
      setTitle(editingTask.title);
      setDesc(editingTask.desc);
      setDue(editingTask.dueDate);
      setStatus(editingTask.status);
      setPriority(editingTask.priority || '');
      setSubtasks((editingTask.subtasks || []).map(s => ({ ...s })));
      initialRef.current = { title: editingTask.title, desc: editingTask.desc };
    } else {
      setArea(areas[0] || '');
      setTitle('');
      setDesc('');
      setDue(toISODate(new Date()));
      setStatus(defaultStatus || firstNonTerm);
      setPriority('alta');
      setSubtasks([]);
      initialRef.current = { title: '', desc: '' };
    }
  }, [open, editingTask, columns, areas, defaultStatus]);

  // La fecha límite se calcula sola (la más lejana entre las sub-tareas
  // con fecha) y el campo queda bloqueado — mismo comportamiento que
  // recalcTaskDueFromSubtasks() en la app vanilla.
  const fechasSubtareas = subtasks.map(s => s.dueDate).filter(Boolean);
  const dueCalculada = fechasSubtareas.length ? fechasSubtareas.reduce((max, d) => d > max ? d : max) : null;
  const dueEfectiva = dueCalculada || due;
  const dueBloqueada = !!dueCalculada;

  const isDirty = () => title.trim() !== initialRef.current.title || desc.trim() !== initialRef.current.desc;
  const close = useDirtyGuard(isDirty, onClose);

  function actualizarSubtask(idx, patch) {
    setSubtasks(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }
  function quitarSubtask(idx) {
    setSubtasks(prev => prev.filter((_, i) => i !== idx));
  }
  function agregarSubtask() {
    setSubtasks(prev => [...prev, { text: '', dueDate: '', done: false }]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const tituloTrim = title.trim();
    if (!tituloTrim) return showFeedback('El título es obligatorio.', 'err');
    if (!dueEfectiva) return showFeedback('La fecha límite es obligatoria.', 'err');
    if (!priority) return showFeedback('La prioridad es obligatoria.', 'err');

    const subtasksLimpias = subtasks.map(s => ({ text: s.text.trim(), dueDate: s.dueDate || '', done: !!s.done })).filter(s => s.text);

    setBusy(true);
    try {
      await onSave({
        area, title: tituloTrim, desc: desc.trim(), dueDate: dueEfectiva, status, priority,
        subtasks: subtasksLimpias
      }, editingTask?.id || null);
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title={editingTask ? 'Editar tarea' : 'Nueva tarea'}>
      <form onSubmit={handleSubmit}>
        <div className="field-row">
          <Select label="Área" value={area} onChange={e => setArea(e.target.value)} disabled={busy}
            options={areas.map(a => ({ value: a, label: a }))} />
          <Select label="Estado" value={status} onChange={e => setStatus(e.target.value)} disabled={busy}
            options={columns.map(c => ({ value: c.name, label: c.name }))} />
        </div>
        <TextField label="Título" placeholder="Ej: Diseñar banner" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} autoFocus />
        <Textarea label="Descripción" value={desc} onChange={e => setDesc(e.target.value)} disabled={busy} />
        <div className="field-row">
          <TextField
            label="Fecha límite" type="date" value={dueEfectiva}
            onChange={e => setDue(e.target.value)} disabled={busy || dueBloqueada}
            title={dueBloqueada ? 'Se calcula sola: la fecha más lejana entre las sub-tareas.' : ''}
          />
          <Select label="Prioridad" value={priority} onChange={e => setPriority(e.target.value)} disabled={busy} options={PRIORITY_OPTIONS} />
        </div>

        <div className="field">
          <label className="field-label">Sub-tareas</label>
          <div className="task-subtasks-editor">
            {subtasks.map((s, i) => (
              <div key={i} className="task-subtask-row">
                <input
                  type="text" className="field-input" placeholder="Descripción…"
                  value={s.text} onChange={e => actualizarSubtask(i, { text: e.target.value })} disabled={busy}
                />
                <input
                  type="date" className="field-input task-subtask-date"
                  value={s.dueDate || ''} onChange={e => actualizarSubtask(i, { dueDate: e.target.value })} disabled={busy}
                />
                <button type="button" className="task-subtask-remove" onClick={() => quitarSubtask(i)} disabled={busy} aria-label="Quitar">
                  <Icon name="close" size={13} />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" disabled={busy} onClick={agregarSubtask}>+ Agregar sub-tarea</Button>
          </div>
        </div>

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar tarea'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
