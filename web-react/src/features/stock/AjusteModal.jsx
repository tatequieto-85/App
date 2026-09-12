import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Select from '../../components/ui/Select';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';

const MOTIVOS = [
  { value: 'Frasco promocional',   label: 'Frasco promocional' },
  { value: 'Unidad dañada',        label: 'Unidad dañada' },
  { value: 'Donación',             label: 'Donación' },
  { value: 'Corrección de conteo', label: 'Corrección de conteo' },
  { value: 'otro',                 label: 'Otro…' }
];

// Equivalente a openStockAjusteModal()/btnSaveStockAjuste en ../../../stock.js.
// Se abre siempre desde el long-press de una fila de Resumen — la receta
// viene fija (no es un <select> editable como en la app vanilla, para
// seguir el mismo patrón que CompraModal: el dato de contexto no va dentro
// de un campo de formulario).
export default function AjusteModal({ open, onClose, receta, onSave }) {
  const [tipo, setTipo] = useState('salida');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('Frasco promocional');
  const [motivoOtro, setMotivoOtro] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open) return;
    setTipo('salida');
    setCantidad('');
    setMotivo('Frasco promocional');
    setMotivoOtro('');
  }, [open]);

  const isDirty = () => !!cantidad.trim();
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const qty = parseInt(cantidad, 10) || 0;
    const motivoFinal = motivo === 'otro' ? motivoOtro.trim() : motivo;
    if (qty <= 0) return showFeedback('La cantidad debe ser mayor a 0.', 'err');
    if (!motivoFinal) return showFeedback('Indica el motivo del ajuste.', 'err');

    setBusy(true);
    try {
      await onSave({ recetaId: receta.id, recetaNombre: receta.nombre, tipo, cantidad: qty, motivo: motivoFinal });
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title="Ajuste manual">
      <form onSubmit={handleSubmit}>
        <p className="modal-contexto">{receta?.nombre}</p>

        <Select
          label="Tipo de movimiento"
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          disabled={busy}
          options={[
            { value: 'salida', label: 'Salida (resta del disponible)' },
            { value: 'entrada', label: 'Entrada (suma al disponible)' }
          ]}
        />
        <TextField
          label="Cantidad" type="number" min="1" step="1" inputMode="numeric" placeholder="Unidades"
          value={cantidad} onChange={e => setCantidad(e.target.value)} disabled={busy}
        />
        <Select
          label="Motivo"
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          disabled={busy}
          options={MOTIVOS}
        />
        {motivo === 'otro' && (
          <TextField
            placeholder="Especifica el motivo" style={{ marginTop: 8 }}
            value={motivoOtro} onChange={e => setMotivoOtro(e.target.value)} disabled={busy}
          />
        )}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar ajuste'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
