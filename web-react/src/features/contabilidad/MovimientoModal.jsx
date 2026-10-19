import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import ThousandsField from '../../components/ui/ThousandsField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { toISODate, parseThousandsInput } from '../../utils/format';
import './MovimientoModal.css';

// Movimiento manual de una caja (los automáticos los genera Ventas/Compras
// solos, ver contabilidadApi.js) — ingreso o egreso, monto, concepto y
// fecha. Tipo como cápsulas, no desplegable: son solo dos opciones, se
// eligen de un vistazo (mismo criterio que el selector de descuento que
// pidió el usuario en Ventas).
export default function MovimientoModal({ open, onClose, caja, onSave }) {
  const [tipo, setTipo] = useState('ingreso');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [fecha, setFecha] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open) return;
    setTipo('ingreso');
    setMonto('');
    setConcepto('');
    setFecha(toISODate(new Date()));
  }, [open]);

  const isDirty = () => !!monto || !!concepto.trim();
  const close = useDirtyGuard(isDirty, onClose);

  if (!caja) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    const montoNum = parseThousandsInput(monto);
    if (!montoNum || montoNum <= 0) return showFeedback('El monto debe ser mayor a 0.', 'err');
    if (!fecha) return showFeedback('Indicá la fecha.', 'err');

    setBusy(true);
    try {
      await onSave(caja.id, { tipo, monto: montoNum, concepto: concepto.trim(), fecha });
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={`Movimiento — ${caja.nombre}`}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label">Tipo</label>
          <div className="movimiento-tipo-picker">
            <button
              type="button" disabled={busy}
              className={`movimiento-tipo-pill${tipo === 'ingreso' ? ' is-selected is-ingreso' : ''}`}
              onClick={() => setTipo('ingreso')}
            >
              Ingreso
            </button>
            <button
              type="button" disabled={busy}
              className={`movimiento-tipo-pill${tipo === 'egreso' ? ' is-selected is-egreso' : ''}`}
              onClick={() => setTipo('egreso')}
            >
              Egreso
            </button>
          </div>
        </div>

        <div className="field-row">
          <ThousandsField label="Monto" placeholder="0" value={monto} onChange={setMonto} disabled={busy} />
          <TextField label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} disabled={busy} />
        </div>
        <TextField label="Concepto" placeholder="Ej: Pago de arriendo" value={concepto} onChange={e => setConcepto(e.target.value)} disabled={busy} />

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar movimiento'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
