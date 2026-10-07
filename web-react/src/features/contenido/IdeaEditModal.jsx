import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Textarea from '../../components/ui/Textarea';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';

// Editar una idea ya guardada — solo la descripción, igual que
// editIdeaMktOverlay en ../../../ideas-marketing.js (fotos/audios/categoría
// no se pueden cambiar desde acá).
export default function IdeaEditModal({ open, onClose, idea, onSave }) {
  const [descripcion, setDescripcion] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef('');

  useEffect(() => {
    if (!open || !idea) return;
    setDescripcion(idea.descripcion);
    initialRef.current = idea.descripcion;
  }, [open, idea]);

  const isDirty = () => descripcion !== initialRef.current;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const descTrim = descripcion.trim();
    if (!descTrim) return showFeedback('La descripción es obligatoria.', 'err');

    setBusy(true);
    try {
      await onSave(idea.rowIndex, descTrim);
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  if (!idea) return null;

  return (
    <Modal open={open} onClose={close} title="Editar idea">
      <form onSubmit={handleSubmit}>
        <Textarea label="Descripción" rows={5} value={descripcion} onChange={e => setDescripcion(e.target.value)} disabled={busy} autoFocus />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
