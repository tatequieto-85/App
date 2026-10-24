import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';

// Crear o editar una medida del catálogo (tamaño de empaque, ej. "230 ml")
// — a pedido explícito del usuario: "una ventana en Procesos (como un tab)
// y ahí se va a poder crear, editar o ver catálogo de medidas". `pesoMl`
// es cuánto de la mezcla (el producto en sí, antes de envasar) entra en
// ESE frasco — a pedido explícito ("se va a indicar cuánto de la mezcla
// se va a meter en el frasco definido"); es la misma base que ya usa
// RecetaEscalarSection.jsx para sugerir cuántos frascos rinde un lote
// (1 ml ≈ 1 g). editingMedida null = crear. Editar corrige el catálogo Y
// las recetas que ya tienen esta medida atada (ver editMedida en
// useProcesos.js) — las ejecuciones ya cerradas no se tocan, quedan con
// el nombre/peso que tenían al momento de producir.
export default function MedidaModal({ open, onClose, editingMedida, onSave }) {
  const [nombre, setNombre] = useState('');
  const [pesoMl, setPesoMl] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ nombre: '', pesoMl: '' });

  useEffect(() => {
    if (!open) return;
    const n = editingMedida ? editingMedida.nombre : '';
    const p = editingMedida?.pesoMl ? String(editingMedida.pesoMl) : '';
    setNombre(n);
    setPesoMl(p);
    initialRef.current = { nombre: n, pesoMl: p };
  }, [open, editingMedida]);

  const isDirty = () => nombre.trim() !== initialRef.current.nombre || pesoMl !== initialRef.current.pesoMl;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    if (!nombreTrim) return showFeedback('Ponele un nombre a la medida.', 'err');
    const pesoNum = parseFloat(pesoMl.replace(',', '.')) || 0;
    setBusy(true);
    try {
      await onSave({ nombre: nombreTrim, pesoMl: pesoNum }, editingMedida?.id || null);
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={editingMedida ? 'Editar medida' : 'Nueva medida'}>
      <form onSubmit={handleSubmit}>
        <TextField label="Nombre" placeholder="Ej: 230 ml" value={nombre} onChange={e => setNombre(e.target.value)} disabled={busy} autoFocus />
        <TextField
          label="¿Cuánto de la mezcla entra en este frasco? (ml)" type="number" min="0" placeholder="230"
          value={pesoMl} onChange={e => setPesoMl(e.target.value)} disabled={busy}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : (editingMedida ? 'Guardar cambios' : 'Crear medida')}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
