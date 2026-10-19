import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import ThousandsField from '../../components/ui/ThousandsField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { toISODate, formatThousandsValue, parseThousandsInput } from '../../utils/format';
import { ESTADO_OPCIONES } from '../../services/feriasApi';
import './FeriaModal.css';

// Equivalente a openFeriaModal()/btnSaveFeria en ../../../ferias.js.
// editingFeria null = crear (requiere estar dentro de un canal, ver
// VentasPage). "Reabrir" solo aparece si se cerró a mano con "Terminar
// feria" — si simplemente ya pasó por calendario no hay nada que reabrir.
// contactos: lista de Contactos (ver features/contactos/useContactos.js) —
// vincular uno es obligatorio al crear, y "Empresa organizadora" ya no se
// tipea a mano: sale sola de la empresa de ese contacto (o su nombre, si no
// tiene empresa cargada) — a pedido del usuario.
export default function FeriaModal({ open, onClose, editingFeria, contactos, onSave, onReabrir }) {
  const today = toISODate(new Date());
  const [fechaInicio, setFechaInicio] = useState(today);
  const [fechaFin, setFechaFin] = useState(today);
  const [precio, setPrecio] = useState('');
  const [lugar, setLugar] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [estado, setEstado] = useState('participar');
  // Texto predictivo (datalist), no un <select> — el usuario escribe el
  // nombre del contacto y se resuelve contra `contactos` al guardar.
  const [contactoNombre, setContactoNombre] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ contactoNombre: '', lugar: '', observaciones: '' });

  useEffect(() => {
    if (!open) return;
    const cn = editingFeria ? (contactos?.find(c => c.id === editingFeria.contactoId)?.nombre || '') : '';
    const l = editingFeria ? editingFeria.lugar || '' : '';
    const o = editingFeria ? editingFeria.observaciones || '' : '';
    setContactoNombre(cn);
    setFechaInicio(editingFeria ? editingFeria.fechaInicio || today : today);
    setFechaFin(editingFeria ? editingFeria.fechaFin || today : today);
    setPrecio(editingFeria ? formatThousandsValue(editingFeria.precio) : '');
    setLugar(l);
    setObservaciones(o);
    setEstado(editingFeria?.estado === 'publicado' ? 'publicado' : 'participar');
    initialRef.current = { contactoNombre: cn, lugar: l, observaciones: o };
  }, [open, editingFeria, contactos]);

  const isDirty = () =>
    contactoNombre.trim() !== initialRef.current.contactoNombre ||
    lugar.trim() !== initialRef.current.lugar ||
    observaciones.trim() !== initialRef.current.observaciones;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fechaInicio || !fechaFin) return showFeedback('Las fechas de la feria son obligatorias.', 'err');
    if (fechaInicio > fechaFin) return showFeedback('La fecha de inicio no puede ser posterior a la de fin.', 'err');
    const contacto = contactos?.find(c => c.nombre.toLowerCase() === contactoNombre.trim().toLowerCase());
    if (!contacto) return showFeedback('Elegí un contacto de la lista (escribí su nombre y tocá la sugerencia).', 'err');

    setBusy(true);
    try {
      await onSave({
        empresa: contacto.empresa || contacto.nombre,
        fechaInicio, fechaFin,
        precio: parseThousandsInput(precio) || 0,
        lugar: lugar.trim(), observaciones: observaciones.trim(),
        estado, contactoId: contacto.id
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
        <div className="field-row">
          <TextField
            label="Contacto" list="feriaContactoList" placeholder="Escribí el nombre…"
            value={contactoNombre} onChange={e => setContactoNombre(e.target.value)} disabled={busy} autoFocus
          />
          <Select
            label="Estado" value={estado} onChange={e => setEstado(e.target.value)} disabled={busy}
            options={ESTADO_OPCIONES}
          />
        </div>
        <datalist id="feriaContactoList">{(contactos || []).map(c => <option key={c.id} value={c.nombre} />)}</datalist>
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
