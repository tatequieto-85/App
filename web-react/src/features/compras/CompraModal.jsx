import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import ThousandsField from '../../components/ui/ThousandsField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { fmtCOP, formatThousandsValue, parseThousandsInput, toISODate } from '../../utils/format';
import './CompraModal.css';

// Equivalente a openCompraModal()/btnSaveCompra en ../../../compras.js, con
// el ingrediente siempre precargado e inmodificable (siempre se abre desde
// una fila puntual, sea para registrar una compra nueva o para editar la
// última) — por eso no se muestra dentro de un campo de texto, es solo
// contexto. editRecord: null = registrar compra nueva; si no, edita esa fila.
// lastUnitPrice: precio unitario de la última compra registrada (o null).
export default function CompraModal({ open, onClose, ingrediente, editRecord, lastUnitPrice, onSave }) {
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

  // Precio unitario de la compra que se está cargando ahora mismo, no de la
  // anterior — se recalcula en vivo a medida que se escriben cantidad/precio.
  const unidad = ingrediente?.unidad || 'u';
  const enteredUnitPrice = useMemo(() => {
    const qty   = parseThousandsInput(cantidad);
    const price = parseThousandsInput(precioTotal);
    return qty > 0 && price > 0 ? price / qty : null;
  }, [cantidad, precioTotal]);

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
        <p className="modal-contexto">
          {ingrediente?.nombre}
          {' — '}
          {lastUnitPrice != null
            ? `Última compra (${fmtCOP(lastUnitPrice)}/${unidad})`
            : 'Sin compras previas'}
        </p>
        <div className="field-row">
          <ThousandsField
            label={`Cantidad (${unidad})`}
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
        <p className="compra-precio-unitario">
          Precio unitario de esta compra:{' '}
          {enteredUnitPrice != null ? `${fmtCOP(enteredUnitPrice)}/${unidad}` : '—'}
        </p>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : (editRecord ? 'Guardar cambios' : 'Guardar compra')}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
