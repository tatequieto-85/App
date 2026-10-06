import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Select from '../../components/ui/Select';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { toISODate } from '../../utils/format';
import { ARCHIVABLE_STATES } from '../../services/tareasApi';

const PRIORITY_OPTIONS = [
  { value: '', label: 'Elegir…' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' }
];

// Crear/editar tarea — primera pasada acordada con el usuario: sin
// proyecto Gantt/fecha de inicio/dependencias (esos campos se preservan
// tal cual al editar una tarea que ya los tenga, ver useTareas.js —
// simplemente no aparecen acá), sin sub-tareas, y sin el autoguardado de
// borrador de la app vanilla (mismo criterio de "guardar al confirmar"
// que el resto de los modales ya migrados). Un solo campo de texto, a
// pedido explícito del usuario ("no quiero que tenga título sino
// solamente descripción") — se sigue guardando en `title` (el campo que
// ya usan la lista/el detalle para identificar la tarea), el viejo
// `desc` separado no se vuelve a mostrar ni a tocar.
export default function TaskModal({ open, onClose, editingTask, columns, areas, defaultStatus, onSave }) {
  const [area, setArea] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ title: '' });

  useEffect(() => {
    if (!open) return;
    const firstNonTerm = columns.find(c => !c.terminal)?.name || '';
    if (editingTask) {
      setArea(editingTask.area);
      setTitle(editingTask.title);
      setDue(editingTask.dueDate);
      setStatus(editingTask.status);
      setPriority(editingTask.priority || '');
      initialRef.current = { title: editingTask.title };
    } else {
      setArea(areas[0] || '');
      setTitle('');
      setDue(toISODate(new Date()));
      setStatus(defaultStatus || firstNonTerm);
      setPriority('alta');
      initialRef.current = { title: '' };
    }
  }, [open, editingTask, columns, areas, defaultStatus]);

  const isDirty = () => title.trim() !== initialRef.current.title;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const tituloTrim = title.trim();
    if (!tituloTrim) return showFeedback('La descripción es obligatoria.', 'err');
    if (!due) return showFeedback('La fecha límite es obligatoria.', 'err');
    if (!priority) return showFeedback('La prioridad es obligatoria.', 'err');
    // Igual que en TaskDetailModal: guardar en un estado archivable
    // (Finalizada) saca la tarea de la lista para siempre, se pide
    // confirmación antes, a pedido explícito del usuario.
    if (ARCHIVABLE_STATES.includes(status) && !window.confirm('Al finalizar, la tarea se archiva y desaparece de la lista. ¿Continuar?')) return;

    setBusy(true);
    try {
      await onSave({ area, title: tituloTrim, dueDate: due, status, priority }, editingTask?.id || null);
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
        <TextField label="Descripción" placeholder="Ej: Diseñar banner del evento" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} autoFocus />
        <div className="field-row">
          <TextField label="Fecha límite" type="date" value={due} onChange={e => setDue(e.target.value)} disabled={busy} />
          <Select label="Prioridad" value={priority} onChange={e => setPriority(e.target.value)} disabled={busy} options={PRIORITY_OPTIONS} />
        </div>

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar tarea'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
