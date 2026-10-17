import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import ThousandsField from '../../components/ui/ThousandsField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { formatThousandsValue, parseThousandsInput } from '../../utils/format';

// Crear/editar un combo del catálogo ("Armar combos" — a pedido explícito
// del usuario). Un combo con unidades=1 sirve como precio unitario normal,
// no hace falta un concepto aparte. editingCombo null = crear.
export default function ComboModal({ open, onClose, editingCombo, onSave }) {
  const [nombre, setNombre] = useState('');
  const [unidades, setUnidades] = useState('1');
  const [precio, setPrecio] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ nombre: '', unidades: '1', precio: '' });

  useEffect(() => {
    if (!open) return;
    const n = editingCombo ? editingCombo.nombre : '';
    const u = editingCombo ? String(editingCombo.unidades) : '1';
    const p = editingCombo ? formatThousandsValue(editingCombo.precio) : '';
    setNombre(n);
    setUnidades(u);
    setPrecio(p);
    initialRef.current = { nombre: n, unidades: u, precio: p };
  }, [open, editingCombo]);

  const isDirty = () =>
    nombre.trim() !== initialRef.current.nombre ||
    unidades !== initialRef.current.unidades ||
    precio !== initialRef.current.precio;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    const unidadesNum = parseInt(unidades, 10);
    const precioNum = parseThousandsInput(precio);
    if (!nombreTrim) return showFeedback('Ponele un nombre al combo.', 'err');
    if (!unidadesNum || unidadesNum <= 0) return showFeedback('Las unidades deben ser mayor a 0.', 'err');
    if (!precioNum || precioNum <= 0) return showFeedback('El precio debe ser mayor a 0.', 'err');

    setBusy(true);
    try {
      await onSave({ nombre: nombreTrim, unidades: unidadesNum, precio: precioNum }, editingCombo?.id || null);
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={editingCombo ? 'Editar combo' : 'Nuevo combo'}>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Nombre" placeholder="Ej: Combo x3"
          value={nombre} onChange={e => setNombre(e.target.value)}
          disabled={busy} autoFocus
        />
        <div className="field-row">
          <TextField
            label="Unidades" type="number" min="1" step="1" placeholder="1"
            value={unidades} onChange={e => setUnidades(e.target.value)}
            disabled={busy}
          />
          <ThousandsField
            label="Precio total del combo" placeholder="0"
            value={precio} onChange={setPrecio}
            disabled={busy}
          />
        </div>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : (editingCombo ? 'Guardar cambios' : 'Crear combo')}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
