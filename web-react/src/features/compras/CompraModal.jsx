import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import ThousandsField from '../../components/ui/ThousandsField';
import Feedback from '../../components/ui/Feedback';
import IngredienteAutocomplete from '../ingredientes/IngredienteAutocomplete';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { findDuplicate } from '../../services/ingredientesApi';
import { formatThousandsValue, parseThousandsInput, toISODate } from '../../utils/format';

// Equivalente a openCompraModal()/btnSaveCompra en ../../../compras.js.
// editRecord: null = registrar compra nueva; si no, edita esa fila puntual.
export default function CompraModal({
  open, onClose, ingredientes, editRecord, prefillNombre, onSave, onAddIngrediente
}) {
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [precioTotal, setPrecioTotal] = useState('');
  const [fecha, setFecha] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open) return;
    setNombre(editRecord ? editRecord.ingrediente : (prefillNombre || ''));
    setCantidad(editRecord ? formatThousandsValue(editRecord.cantidad) : '');
    setPrecioTotal(editRecord ? formatThousandsValue(editRecord.precioTotal) : '');
    setFecha(editRecord ? editRecord.fecha : toISODate(new Date()));
  }, [open, editRecord, prefillNombre]);

  const isDirty = () => !!(nombre.trim() || cantidad.trim() || precioTotal.trim());
  const close = useDirtyGuard(isDirty, onClose);
  const nombreLocked = !!(editRecord || prefillNombre);

  async function handleSubmit(e) {
    e.preventDefault();
    const dup = findDuplicate(ingredientes, nombre.trim());
    if (!dup) return showFeedback('El ingrediente debe estar en el catálogo — elígelo de las sugerencias.', 'err');
    const qty   = parseThousandsInput(cantidad);
    const price = parseThousandsInput(precioTotal);
    if (!qty || qty <= 0) return showFeedback('La cantidad debe ser mayor a 0.', 'err');
    if (!price || price <= 0) return showFeedback('El precio total debe ser mayor a 0.', 'err');
    if (!fecha) return showFeedback('Indica la fecha de compra.', 'err');

    setBusy(true);
    try {
      await onSave({ ingrediente: dup.nombre, cantidad: qty, precioTotal: price, fecha }, editRecord);
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  const unidad = findDuplicate(ingredientes, nombre)?.unidad;

  return (
    <Modal open={open} onClose={close} title={editRecord ? 'Editar compra' : 'Registrar compra'}>
      <form onSubmit={handleSubmit}>
        {nombreLocked ? (
          <TextField label="Ingrediente" value={nombre} disabled />
        ) : (
          <IngredienteAutocomplete
            value={nombre}
            onChange={setNombre}
            ingredientes={ingredientes}
            onAddNew={onAddIngrediente}
          />
        )}
        <div className="field-row">
          <ThousandsField
            label={`Cantidad${unidad ? ` (${unidad})` : ''}`}
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
        <TextField
          label="Fecha" type="date" value={fecha}
          onChange={e => setFecha(e.target.value)} disabled={busy}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : (editRecord ? 'Guardar cambios' : 'Guardar compra')}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
