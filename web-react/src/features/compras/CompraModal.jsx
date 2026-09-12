import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import ThousandsField from '../../components/ui/ThousandsField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { formatThousandsValue, parseThousandsInput, toISODate } from '../../utils/format';
import './CompraModal.css';

// Equivalente a openCompraModal()/btnSaveCompra en ../../../compras.js, con
// el ingrediente siempre precargado e inmodificable (siempre se abre desde
// una fila puntual, sea para registrar una compra nueva o para editar la
// última). editRecord: null = registrar compra nueva; si no, edita esa fila.
export default function CompraModal({ open, onClose, ingrediente, editRecord, onSave }) {
  const [cantidad, setCantidad] = useState('');
  const [precioTotal, setPrecioTotal] = useState('');
  const [fecha, setFecha] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  // "Sin guardar" se compara contra los valores con los que se abrió el
  // modal, no contra "vacío" — si no, editar una compra ya cargada se
  // consideraría sucio desde el primer instante y el guard molestaría
  // siempre, incluso sin tocar nada.
  const initialRef = useRef({ cantidad: '', precioTotal: '', fecha: '' });

  useEffect(() => {
    if (!open) return;
    const c = editRecord ? formatThousandsValue(editRecord.cantidad) : '';
    const p = editRecord ? formatThousandsValue(editRecord.precioTotal) : '';
    const f = editRecord ? editRecord.fecha : toISODate(new Date());
    setCantidad(c);
    setPrecioTotal(p);
    setFecha(f);
    initialRef.current = { cantidad: c, precioTotal: p, fecha: f };
  }, [open, editRecord]);

  const isDirty = () =>
    cantidad !== initialRef.current.cantidad ||
    precioTotal !== initialRef.current.precioTotal ||
    fecha !== initialRef.current.fecha;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const qty   = parseThousandsInput(cantidad);
    const price = parseThousandsInput(precioTotal);
    if (!qty || qty <= 0) return showFeedback('La cantidad debe ser mayor a 0.', 'err');
    if (!price || price <= 0) return showFeedback('El precio total debe ser mayor a 0.', 'err');
    if (!fecha) return showFeedback('Indica la fecha de compra.', 'err');

    setBusy(true);
    try {
      await onSave({ ingrediente: ingrediente.nombre, cantidad: qty, precioTotal: price, fecha }, editRecord);
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      showBack
      title={editRecord ? 'Editar compra' : 'Registrar compra'}
      headerRight={
        <input
          type="date" className="compra-fecha-subtle" value={fecha}
          onChange={e => setFecha(e.target.value)} disabled={busy}
          aria-label="Fecha de compra"
        />
      }
    >
      <form onSubmit={handleSubmit}>
        <TextField label="Ingrediente" value={ingrediente?.nombre || ''} disabled />
        <div className="field-row">
          <ThousandsField
            label={`Cantidad${ingrediente?.unidad ? ` (${ingrediente.unidad})` : ''}`}
            placeholder="0"
            value={cantidad}
            onChange={setCantidad}
            disabled={busy}
          />
          <ThousandsField
            label="Precio total"
            placeholder="0"
            value={precioTotal}
            onChange={setPrecioTotal}
            disabled={busy}
          />
        </div>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : (editRecord ? 'Guardar cambios' : 'Guardar compra')}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
