import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Textarea from '../../components/ui/Textarea';
import Feedback from '../../components/ui/Feedback';
import Dropzone from './Dropzone';
import EmojiPicker from './EmojiPicker';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';

// Programar una historia nueva — portado del formulario (no modal) de
// ../../../contenido.js, movido a un modal con FAB como el resto de los
// módulos migrados (regla 2). Editar es otro componente más liviano
// (StoryEditModal) sin la dropzone — misma separación que ya tenía la app
// vanilla (ahí tampoco se puede cambiar el archivo de una historia ya
// creada).
function defaultScheduledAt() {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function StoryModal({ open, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [actions, setActions] = useState('');
  const [scheduled, setScheduled] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { current, total, pct } | null
  const [feedback, showFeedback] = useFeedback();
  const actionsRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTitle(''); setActions(''); setFiles([]);
    setScheduled(defaultScheduledAt());
    setProgress(null);
  }, [open]);

  const isDirty = () => !!(title.trim() || actions.trim() || files.length);
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const tituloTrim = title.trim();
    if (!tituloTrim) return showFeedback('El título es obligatorio.', 'err');
    if (!scheduled) return showFeedback('La fecha es obligatoria.', 'err');

    setBusy(true);
    try {
      if (files.length) setProgress({ current: 0, total: files.length, pct: 0 });
      await onSave({
        title: tituloTrim, actions: actions.trim(),
        scheduledAt: new Date(scheduled).toISOString(),
        files
      }, (i, n, pct) => setProgress({ current: i, total: n, pct: Math.round(((i + pct / 100) / n) * 100) }));
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Nueva historia">
      <form onSubmit={handleSubmit}>
        <TextField label="Título" placeholder="Ej: Promo fin de semana" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} autoFocus />

        <div className="field-label-emoji-row">
          <label className="field-label" htmlFor="storyActions" style={{ margin: 0 }}>Acciones</label>
          <EmojiPicker textareaRef={actionsRef} value={actions} onChange={setActions} />
        </div>
        <Textarea id="storyActions" ref={actionsRef} placeholder="Ej: Encuesta, link en bio, mencionar a @..." rows={3} value={actions} onChange={e => setActions(e.target.value)} disabled={busy} />

        <TextField label="Fecha y hora programada" type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} disabled={busy} />

        <label className="field-label">Foto o video</label>
        <Dropzone files={files} onChange={setFiles} accept="image/*,video/*" disabled={busy} />

        {progress && (
          <div className="upload-progress">
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress.pct}%` }} /></div>
            <div className="progress-text">Subiendo archivo {progress.current + 1} de {progress.total}…</div>
          </div>
        )}

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Programar historia'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
