import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Select from '../../components/ui/Select';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { ESTADOS_ACTIVO } from '../../services/inventarioApi';

const ESTADO_OPTIONS = ESTADOS_ACTIVO.map(e => ({ value: e, label: e }));

// Alta/edición de un activo/equipo de la empresa.
export default function ActivoModal({ open, onClose, editing, categorias, onSave }) {
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [estado, setEstado] = useState(ESTADOS_ACTIVO[0]);
  const [responsable, setResponsable] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNombre(editing.nombre); setCategoria(editing.categoria);
      setEstado(editing.estado); setResponsable(editing.responsable);
      setObservaciones(editing.observaciones);
    } else {
      setNombre(''); setCategoria(''); setEstado(ESTADOS_ACTIVO[0]); setResponsable(''); setObservaciones('');
    }
  }, [open, editing]);

  const isDirty = () => !!(nombre.trim() || categoria.trim() || responsable.trim() || observaciones.trim());
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    if (!nombreTrim) return showFeedback('El nombre es obligatorio.', 'err');

    setBusy(true);
    try {
      await onSave({
        id: editing?.id, rowIndex: editing?.rowIndex, createdAt: editing?.createdAt,
        nombre: nombreTrim, categoria: categoria.trim(), estado, responsable: responsable.trim(),
        observaciones: observaciones.trim()
      });
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title={editing ? 'Editar activo' : 'Nuevo activo'}>
      <form onSubmit={handleSubmit}>
        <TextField label="Nombre" placeholder="Ej: Licuadora industrial" value={nombre} onChange={e => setNombre(e.target.value)} disabled={busy} autoFocus />

        <TextField label="Categoría" list="activoCategoriaList" placeholder="Ej: Maquinaria" value={categoria} onChange={e => setCategoria(e.target.value)} disabled={busy} />
        <datalist id="activoCategoriaList">
          {categorias.map(c => <option key={c} value={c} />)}
        </datalist>

        <div className="field-row">
          <Select label="Estado" value={estado} onChange={e => setEstado(e.target.value)} disabled={busy} options={ESTADO_OPTIONS} />
          <TextField label="A cargo de" placeholder="Responsable" value={responsable} onChange={e => setResponsable(e.target.value)} disabled={busy} />
        </div>

        <TextField label="Observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} disabled={busy} />

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
