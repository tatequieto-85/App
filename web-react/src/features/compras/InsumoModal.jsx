import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';

// Equivalente a btnNewInsumo/btnSaveInsumo en ../../../compras.js: alta rápida
// de un ingrediente (nombre + unidad) sin registrar todavía una compra.
export default function InsumoModal({ open, onClose, onSave }) {
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (open) { setNombre(''); setUnidad(''); }
  }, [open]);

  const close = useDirtyGuard(() => !!(nombre.trim() || unidad.trim()), onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nombre.trim()) return showFeedback('Indica el nombre.', 'err');
    if (!unidad.trim()) return showFeedback('Indica la unidad de medida.', 'err');
    setBusy(true);
    try {
      await onSave(nombre.trim(), unidad.trim());
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Nuevo insumo">
      <form onSubmit={handleSubmit}>
        <TextField label="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} disabled={busy} />
        <TextField label="Unidad" placeholder="g, kg, L, unidades…" value={unidad} onChange={e => setUnidad(e.target.value)} disabled={busy} />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar insumo'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
