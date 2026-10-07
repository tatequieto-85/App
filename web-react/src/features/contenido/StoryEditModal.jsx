import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Textarea from '../../components/ui/Textarea';
import Feedback from '../../components/ui/Feedback';
import EmojiPicker from './EmojiPicker';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';

// Editar una historia ya programada — solo título/acciones/fecha, igual
// que editStoryOverlay en ../../../contenido.js (los archivos ya subidos no
// se pueden cambiar desde acá).
export default function StoryEditModal({ open, onClose, story, onSave }) {
  const [title, setTitle] = useState('');
  const [actions, setActions] = useState('');
  const [scheduled, setScheduled] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ title: '', actions: '', scheduled: '' });
  const actionsRef = useRef(null);

  useEffect(() => {
    if (!open || !story) return;
    const d = new Date(story.scheduledAt);
    const sched = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setTitle(story.title); setActions(story.actions); setScheduled(sched);
    initialRef.current = { title: story.title, actions: story.actions, scheduled: sched };
  }, [open, story]);

  const isDirty = () => title !== initialRef.current.title || actions !== initialRef.current.actions || scheduled !== initialRef.current.scheduled;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const tituloTrim = title.trim();
    if (!tituloTrim) return showFeedback('El título es obligatorio.', 'err');
    if (!scheduled) return showFeedback('La fecha es obligatoria.', 'err');

    setBusy(true);
    try {
      await onSave(story.rowIndex, { title: tituloTrim, actions: actions.trim(), scheduledAt: new Date(scheduled).toISOString() });
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  if (!story) return null;

  return (
    <Modal open={open} onClose={close} title="Editar historia">
      <form onSubmit={handleSubmit}>
        <TextField label="Título" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} autoFocus />

        <div className="field-label-emoji-row">
          <label className="field-label" htmlFor="storyEditActions" style={{ margin: 0 }}>Acciones</label>
          <EmojiPicker textareaRef={actionsRef} value={actions} onChange={setActions} />
        </div>
        <Textarea id="storyEditActions" ref={actionsRef} rows={3} value={actions} onChange={e => setActions(e.target.value)} disabled={busy} />

        <TextField label="Fecha y hora programada" type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} disabled={busy} />

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
