import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import './CanalModal.css';

const DEFAULT_COLOR = '#714B67';

// Crear o editar un canal de venta abre el mismo modal (antes, editar era
// un mini-formulario in-place que reemplazaba la tarjeta en la grilla — se
// unificó porque "no es limpia", igual que crear). editingCanal null = crear.
export default function CanalModal({ open, onClose, editingCanal, onSave }) {
  const [nombre, setNombre] = useState('');
  const [icono, setIcono] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ nombre: '' });

  useEffect(() => {
    if (!open) return;
    const n = editingCanal ? editingCanal.nombre : '';
    setNombre(n);
    setIcono(editingCanal ? editingCanal.icono || '' : '');
    setColor(editingCanal ? editingCanal.color || DEFAULT_COLOR : DEFAULT_COLOR);
    initialRef.current = { nombre: n };
  }, [open, editingCanal]);

  const isDirty = () => nombre.trim() !== initialRef.current.nombre;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    if (!nombreTrim) return showFeedback('Ponele un nombre al canal.', 'err');
    setBusy(true);
    try {
      await onSave({ nombre: nombreTrim, icono: icono.trim(), color }, editingCanal?.id || null);
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={editingCanal ? 'Editar canal de venta' : 'Nuevo canal de venta'}>
      <form onSubmit={handleSubmit}>
        <div className="field-row">
          <TextField label="Ícono (un emoji)" placeholder="🏪" maxLength={4} value={icono} onChange={e => setIcono(e.target.value)} disabled={busy} />
          <div className="field">
            <label className="field-label">Color</label>
            <input type="color" className="canal-color-input" value={color} onChange={e => setColor(e.target.value)} disabled={busy} />
          </div>
        </div>
        <TextField label="Nombre" placeholder="Ej: Mercado Libre" value={nombre} onChange={e => setNombre(e.target.value)} disabled={busy} autoFocus />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : (editingCanal ? 'Guardar' : 'Crear')}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
