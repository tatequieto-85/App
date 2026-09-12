import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { toISODate, addDays } from '../../utils/format';

// Equivalente a openStockTestigoModal()/btnSaveStockTestigo en ../../../stock.js.
// A diferencia de AjusteModal, no viene de una fila puntual (se abre desde el
// botón flotante "+ Apartar testigo") — por eso sí necesita elegir el lote.
export default function TestigoModal({ open, onClose, lotesConStock, onSave }) {
  const [ejecucionId, setEjecucionId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [fechaApartado, setFechaApartado] = useState('');
  const [fechaRevision, setFechaRevision] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open) return;
    setEjecucionId(lotesConStock[0]?.ejecucion.id || '');
    setCantidad('');
    setFechaApartado(toISODate(new Date()));
    setFechaRevision(toISODate(addDays(new Date(), 180)));
    setUbicacion('');
    setObservaciones('');
  }, [open, lotesConStock]);

  const isDirty = () => !!(cantidad.trim() || ubicacion.trim() || observaciones.trim());
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const qty = parseInt(cantidad, 10) || 0;
    if (!ejecucionId) return showFeedback('Selecciona un lote.', 'err');
    if (qty <= 0) return showFeedback('La cantidad debe ser mayor a 0.', 'err');
    if (!fechaApartado || !fechaRevision) return showFeedback('Las fechas son obligatorias.', 'err');

    setBusy(true);
    try {
      await onSave({ ejecucionId, cantidad: qty, fechaApartado, fechaRevision, ubicacion: ubicacion.trim(), observaciones: observaciones.trim() });
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title="Apartar producto testigo">
      <form onSubmit={handleSubmit}>
        {lotesConStock.length ? (
          <Select
            label="Lote" value={ejecucionId} onChange={e => setEjecucionId(e.target.value)} disabled={busy}
            options={lotesConStock.map(({ ejecucion: ej, resumen }) => ({
              value: ej.id,
              label: `${ej.loteId || ej.id.slice(0, 8)} — ${ej.nombreReceta} (disponible: ${resumen.disponible})`
            }))}
          />
        ) : (
          <p className="modal-contexto">Sin lotes con producción.</p>
        )}
        <TextField
          label="Cantidad" type="number" min="1" step="1" inputMode="numeric" placeholder="Unidades"
          value={cantidad} onChange={e => setCantidad(e.target.value)} disabled={busy}
        />
        <div className="field-row">
          <TextField label="Fecha apartado" type="date" value={fechaApartado} onChange={e => setFechaApartado(e.target.value)} disabled={busy} />
          <TextField label="Fecha de revisión" type="date" value={fechaRevision} onChange={e => setFechaRevision(e.target.value)} disabled={busy} />
        </div>
        <TextField label="Ubicación" value={ubicacion} onChange={e => setUbicacion(e.target.value)} disabled={busy} />
        <Textarea label="Observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} disabled={busy} />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
