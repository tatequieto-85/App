import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import './QRModal.css';

// Alta rápida — genera el QR y lo guarda en el mismo paso (mismo criterio
// que btnGenerarQR en ../../../qr.js: no hay un paso separado de "vista
// previa, después guardar"). Modal simple (sin flecha de volver, ver
// regla 4 de convenciones de UI).
export default function QRModal({ open, onClose, onGenerar }) {
  const [nombre, setNombre] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open) return;
    setNombre('');
    setLink('');
  }, [open]);

  const isDirty = () => !!(nombre.trim() || link.trim());
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onGenerar({ nombre, link });
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Nuevo código QR">
      <form onSubmit={handleSubmit}>
        <TextField label="Nombre" placeholder="Ej: Carta del menú" value={nombre} onChange={e => setNombre(e.target.value)} disabled={busy} autoFocus />
        <TextField label="Link" placeholder="Ej: instagram.com/tatequieto" value={link} onChange={e => setLink(e.target.value)} disabled={busy} />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Generando…' : 'Generar y guardar'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
