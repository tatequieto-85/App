import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Select from '../../components/ui/Select';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { FUENTE_AUTOMATICA_OPCIONES } from '../../services/contabilidadApi';

// Crear/editar una caja — a pedido explícito del usuario: "varias cajas,
// las creás vos". Una caja puede alimentarse sola de Ventas (ingreso al
// cerrar una feria) o Compras (egreso al registrar una compra), o quedar
// en manual — como mucho una caja por fuente automática (ver saveCaja en
// useContabilidad.js). editingCaja null = crear.
export default function CajaModal({ open, onClose, editingCaja, onSave }) {
  const [nombre, setNombre] = useState('');
  const [fuenteAutomatica, setFuenteAutomatica] = useState('ninguna');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ nombre: '', fuenteAutomatica: 'ninguna' });

  useEffect(() => {
    if (!open) return;
    const n = editingCaja ? editingCaja.nombre : '';
    const fa = editingCaja ? editingCaja.fuenteAutomatica : 'ninguna';
    setNombre(n);
    setFuenteAutomatica(fa);
    initialRef.current = { nombre: n, fuenteAutomatica: fa };
  }, [open, editingCaja]);

  const isDirty = () =>
    nombre.trim() !== initialRef.current.nombre ||
    fuenteAutomatica !== initialRef.current.fuenteAutomatica;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    if (!nombreTrim) return showFeedback('Ponele un nombre a la caja.', 'err');
    if (!window.confirm(editingCaja ? '¿Confirmás guardar los cambios de esta caja?' : '¿Confirmás crear esta caja?')) return;

    setBusy(true);
    try {
      await onSave({ nombre: nombreTrim, fuenteAutomatica }, editingCaja?.id || null);
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={editingCaja ? 'Editar caja' : 'Nueva caja'}>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Nombre" placeholder="Ej: Caja principal"
          value={nombre} onChange={e => setNombre(e.target.value)}
          disabled={busy} autoFocus
        />
        <Select
          label="Fuente automática" value={fuenteAutomatica}
          onChange={e => setFuenteAutomatica(e.target.value)}
          disabled={busy}
          options={FUENTE_AUTOMATICA_OPCIONES}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : (editingCaja ? 'Guardar cambios' : 'Crear caja')}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
