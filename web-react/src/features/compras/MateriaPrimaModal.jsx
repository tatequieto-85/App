import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';

// Alta/edición de un ítem de materia prima (envases, etiquetas, tapas,
// tarros — no ingredientes de receta). Categoría es texto libre con
// predictivo (datalist), mismo patrón que Empresa/Ciudad en Contactos.
export default function MateriaPrimaModal({ open, onClose, editing, categorias, onSave }) {
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('');
  const [minimo, setMinimo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNombre(editing.nombre); setCategoria(editing.categoria);
      setCantidad(String(editing.cantidad)); setUnidad(editing.unidad);
      setMinimo(editing.minimo === null ? '' : String(editing.minimo));
      setObservaciones(editing.observaciones);
    } else {
      setNombre(''); setCategoria(''); setCantidad(''); setUnidad(''); setMinimo(''); setObservaciones('');
    }
  }, [open, editing]);

  const isDirty = () => !!(nombre.trim() || categoria.trim() || cantidad || unidad.trim() || minimo || observaciones.trim());
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    if (!nombreTrim) return showFeedback('El nombre es obligatorio.', 'err');
    if (cantidad === '' || isNaN(+cantidad)) return showFeedback('La cantidad es obligatoria.', 'err');

    setBusy(true);
    try {
      await onSave({
        id: editing?.id, rowIndex: editing?.rowIndex, createdAt: editing?.createdAt,
        nombre: nombreTrim, categoria: categoria.trim(), cantidad: +cantidad, unidad: unidad.trim(),
        minimo: minimo === '' ? null : +minimo, observaciones: observaciones.trim()
      });
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title={editing ? 'Editar materia prima' : 'Nueva materia prima'}>
      <form onSubmit={handleSubmit}>
        <TextField label="Nombre" placeholder="Ej: Frasco 230 ml" value={nombre} onChange={e => setNombre(e.target.value)} disabled={busy} autoFocus />

        <TextField label="Categoría" list="mpCategoriaList" placeholder="Ej: Envases" value={categoria} onChange={e => setCategoria(e.target.value)} disabled={busy} />
        <datalist id="mpCategoriaList">
          {categorias.map(c => <option key={c} value={c} />)}
        </datalist>

        <div className="field-row">
          <TextField label="Cantidad disponible" type="number" step="any" value={cantidad} onChange={e => setCantidad(e.target.value)} disabled={busy} />
          <TextField label="Unidad" placeholder="Ej: unidades" value={unidad} onChange={e => setUnidad(e.target.value)} disabled={busy} />
        </div>

        <TextField label="Mínimo (opcional)" type="number" step="any" placeholder="Avisa cuando baje de acá" value={minimo} onChange={e => setMinimo(e.target.value)} disabled={busy} />
        <TextField label="Observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} disabled={busy} />

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
