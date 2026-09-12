import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Textarea from '../../components/ui/Textarea';
import ThousandsField from '../../components/ui/ThousandsField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { toISODate, formatThousandsValue, parseThousandsInput } from '../../utils/format';
import './FeriaModal.css';

// Equivalente a openFeriaModal()/btnSaveFeria en ../../../ferias.js.
// editingFeria null = crear (requiere estar dentro de un canal, ver
// VentasPage). "Reabrir" solo aparece si se cerró a mano con "Terminar
// feria" — si simplemente ya pasó por calendario no hay nada que reabrir.
export default function FeriaModal({ open, onClose, editingFeria, onSave, onReabrir }) {
  const today = toISODate(new Date());
  const [empresa, setEmpresa] = useState('');
  const [fechaInicio, setFechaInicio] = useState(today);
  const [fechaFin, setFechaFin] = useState(today);
  const [precio, setPrecio] = useState('');
  const [lugar, setLugar] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ empresa: '', lugar: '', observaciones: '' });

  useEffect(() => {
    if (!open) return;
    const e = editingFeria ? editingFeria.empresa : '';
    const l = editingFeria ? editingFeria.lugar || '' : '';
    const o = editingFeria ? editingFeria.observaciones || '' : '';
    setEmpresa(e);
    setFechaInicio(editingFeria ? editingFeria.fechaInicio || today : today);
    setFechaFin(editingFeria ? editingFeria.fechaFin || today : today);
    setPrecio(editingFeria ? formatThousandsValue(editingFeria.precio) : '');
    setLugar(l);
    setObservaciones(o);
    initialRef.current = { empresa: e, lugar: l, observaciones: o };
  }, [open, editingFeria]);

  const isDirty = () =>
    empresa.trim() !== initialRef.current.empresa ||
    lugar.trim() !== initialRef.current.lugar ||
    observaciones.trim() !== initialRef.current.observaciones;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const empresaTrim = empresa.trim();
    if (!empresaTrim) return showFeedback('La empresa organizadora es obligatoria.', 'err');
    if (!fechaInicio || !fechaFin) return showFeedback('Las fechas de la feria son obligatorias.', 'err');
    if (fechaInicio > fechaFin) return showFeedback('La fecha de inicio no puede ser posterior a la de fin.', 'err');

    setBusy(true);
    try {
      await onSave({
        empresa: empresaTrim, fechaInicio, fechaFin,
        precio: parseThousandsInput(precio) || 0,
        lugar: lugar.trim(), observaciones: observaciones.trim()
      }, editingFeria?.id || null);
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={editingFeria ? 'Editar feria' : 'Nueva feria'}>
      <form onSubmit={handleSubmit}>
        <TextField label="Empresa organizadora" value={empresa} onChange={e => setEmpresa(e.target.value)} disabled={busy} autoFocus />
        <div className="field-row">
          <TextField label="Fecha de inicio" type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} disabled={busy} />
          <TextField label="Fecha de fin" type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} disabled={busy} />
        </div>
        <div className="field-row">
          <ThousandsField label="Precio de participación" placeholder="0" value={precio} onChange={setPrecio} disabled={busy} />
          <TextField label="Lugar" value={lugar} onChange={e => setLugar(e.target.value)} disabled={busy} />
        </div>
        <Textarea label="Observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} disabled={busy} />

        {editingFeria?.cerrada && (
          <div className="feria-reabrir-wrap">
            <Button type="button" variant="outline" disabled={busy} onClick={async () => {
              setBusy(true);
              try { await onReabrir(editingFeria.id); onClose(); }
              catch (err) { showFeedback('Error al reabrir: ' + err.message, 'err'); }
              finally { setBusy(false); }
            }}>
              Reabrir feria
            </Button>
          </div>
        )}

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar feria'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
