import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Textarea from '../../components/ui/Textarea';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';

// Equivalente a btnAddFeriaObsDiaria en ../../../ferias.js: agrega y cierra,
// no es un visor del historial de observaciones de ese día.
export default function FeriaObsModal({ open, onClose, feriaId, fecha, onSave }) {
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setTexto(''); }, [open]);

  const isDirty = () => !!texto.trim();
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = texto.trim();
    if (!text) return;
    setBusy(true);
    try {
      await onSave(feriaId, fecha, text);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title="Observación del día">
      <form onSubmit={handleSubmit}>
        <Textarea placeholder="¿Qué pasó hoy?" value={texto} onChange={e => setTexto(e.target.value)} disabled={busy} autoFocus />
        <Button type="submit" variant="primary" disabled={busy} style={{ marginTop: 12 }}>
          {busy ? 'Guardando…' : 'Agregar'}
        </Button>
      </form>
    </Modal>
  );
}
