import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Select from '../../components/ui/Select';
import ThousandsField from '../../components/ui/ThousandsField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { toISODate, parseThousandsInput } from '../../utils/format';
import './MovimientoModal.css';

// Movimiento manual — ya no está atado a una caja puntual (antes se abría
// desde adentro de una, ver CajaDetailModal, que se sacó a pedido del
// usuario): acá se elige de cuál/es cajas, entre las que ya existan.
// Ingreso/Egreso van a una sola caja; Transferencia mueve plata de una
// caja propia a otra (genera un egreso en origen + un ingreso en destino,
// ver addTransferencia en useContabilidad.js) — tercer tipo que pidió el
// usuario explícitamente. Tipo como cápsulas, no desplegable: pocas
// opciones, se eligen de un vistazo. `editing`: el movimiento a editar
// (null = crear uno nuevo) — a pedido explícito del usuario ("que salga
// editar y borrar"); solo ingreso/egreso simples se pueden editar, nunca
// una transferencia (cambiaría solo un lado y la desbalancearía — ver
// MovimientoRow.jsx, que ya filtra eso antes de abrir esto en modo editar).
export default function MovimientoModal({ open, onClose, cajas, editing, onSaveMovimiento, onSaveTransferencia, onSaveEdit }) {
  const [tipo, setTipo] = useState('ingreso');
  const [cajaId, setCajaId] = useState('');
  const [cajaDestinoId, setCajaDestinoId] = useState('');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [fecha, setFecha] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTipo(editing.tipo);
      setCajaId(editing.cajaId);
      setMonto(String(editing.monto));
      setConcepto(editing.concepto || '');
      setFecha(editing.fecha || toISODate(new Date()));
    } else {
      setTipo('ingreso');
      setCajaId(cajas?.[0]?.id || '');
      setCajaDestinoId(cajas?.[1]?.id || cajas?.[0]?.id || '');
      setMonto('');
      setConcepto('');
      setFecha(toISODate(new Date()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const isDirty = () => !!monto || !!concepto.trim();
  const close = useDirtyGuard(isDirty, onClose);

  if (!(cajas || []).length) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    const montoNum = parseThousandsInput(monto);
    if (!montoNum || montoNum <= 0) return showFeedback('El monto debe ser mayor a 0.', 'err');
    if (!fecha) return showFeedback('Indicá la fecha.', 'err');
    if (!editing && tipo === 'transferencia' && cajaId === cajaDestinoId) {
      return showFeedback('Elegí dos cajas distintas para la transferencia.', 'err');
    }

    setBusy(true);
    try {
      if (editing) {
        await onSaveEdit(editing.id, { cajaId, tipo, monto: montoNum, concepto: concepto.trim(), fecha });
      } else if (tipo === 'transferencia') {
        await onSaveTransferencia(cajaId, cajaDestinoId, montoNum, concepto.trim(), fecha);
      } else {
        await onSaveMovimiento(cajaId, { tipo, monto: montoNum, concepto: concepto.trim(), fecha });
      }
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  const opcionesCaja = cajas.map(c => ({ value: c.id, label: c.nombre }));

  return (
    <Modal open={open} onClose={close} showBack title={editing ? 'Editar movimiento' : 'Nuevo movimiento'}>
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
            {!editing && (
              <button
                type="button" disabled={busy || cajas.length < 2}
                className={`movimiento-tipo-pill${tipo === 'transferencia' ? ' is-selected is-transferencia' : ''}`}
                onClick={() => setTipo('transferencia')}
              >
                Transferencia
              </button>
            )}
          </div>
        </div>

        {tipo === 'transferencia' ? (
          <div className="field-row">
            <Select label="Desde" value={cajaId} onChange={e => setCajaId(e.target.value)} disabled={busy} options={opcionesCaja} />
            <Select label="Hacia" value={cajaDestinoId} onChange={e => setCajaDestinoId(e.target.value)} disabled={busy} options={opcionesCaja} />
          </div>
        ) : (
          <Select label="Caja" value={cajaId} onChange={e => setCajaId(e.target.value)} disabled={busy} options={opcionesCaja} />
        )}

        <div className="field-row">
          <ThousandsField label="Monto" placeholder="0" value={monto} onChange={setMonto} disabled={busy} />
          <TextField label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} disabled={busy} />
        </div>
        <TextField
          label={`Concepto${tipo === 'transferencia' ? ' (opcional)' : ''}`}
          placeholder={tipo === 'transferencia' ? 'Se arma solo si lo dejás vacío' : 'Ej: Pago de arriendo'}
          value={concepto} onChange={e => setConcepto(e.target.value)} disabled={busy}
        />

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar movimiento'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
