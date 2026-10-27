import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';

// Equivalente a btnNewInsumo/btnSaveInsumo en ../../../compras.js: alta rápida
// de un ingrediente (nombre + unidad) sin registrar todavía una compra.
// Categoría y Mínimo son opcionales — a pedido explícito del usuario, para
// que un insumo de materia prima (envases, etiquetas, tapas) use la misma
// tabla de Insumos en vez de una sección aparte (ver migrateMateriaPrima()
// en ingredientesApi.js para lo que ya estaba guardado ahí).
export default function InsumoModal({ open, onClose, onSave, initialNombre = '', categorias = [], editing = null }) {
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState('');
  const [categoria, setCategoria] = useState('');
  const [minimo, setMinimo] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNombre(editing.nombre || '');
      setUnidad(editing.unidad || '');
      setCategoria(editing.categoria || '');
      setMinimo(editing.minimo != null ? String(editing.minimo) : '');
    } else {
      setNombre(initialNombre); setUnidad(''); setCategoria(''); setMinimo('');
    }
  }, [open, initialNombre, editing]);

  const close = useDirtyGuard(() => !!(nombre.trim() || unidad.trim() || categoria.trim() || minimo), onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nombre.trim()) return showFeedback('Indica el nombre.', 'err');
    if (!unidad.trim()) return showFeedback('Indica la unidad de medida.', 'err');
    const nombreCambio = editing && editing.nombre !== nombre.trim();
    const mensaje = nombreCambio
      ? '¿Confirmás renombrar este insumo? Se actualiza en cascada en Compras y Recetas.'
      : editing ? '¿Confirmás guardar los cambios de este insumo?' : '¿Confirmás guardar este insumo?';
    if (!window.confirm(mensaje)) return;
    setBusy(true);
    try {
      // onSave decide qué pasa después de guardar — cerrar este modal
      // (caso simple) o encadenar a otro paso (ver ComprasWidget.jsx, que
      // sigue a CompraModal sin pasar por acá otra vez).
      await onSave(nombre.trim(), unidad.trim(), categoria.trim(), minimo === '' ? null : +minimo);
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack={!!editing} title={editing ? 'Editar insumo' : 'Nuevo insumo'}>
      <form onSubmit={handleSubmit}>
        <TextField label="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} disabled={busy} />
        <TextField label="Unidad" placeholder="g, kg, L, unidades…" value={unidad} onChange={e => setUnidad(e.target.value)} disabled={busy} />

        <TextField label="Categoría (opcional)" list="insumoCategoriaList" placeholder="Ej: Envases" value={categoria} onChange={e => setCategoria(e.target.value)} disabled={busy} />
        {!!categorias.length && (
          <datalist id="insumoCategoriaList">
            {categorias.map(c => <option key={c} value={c} />)}
          </datalist>
        )}

        <TextField label="Mínimo (opcional)" type="number" step="any" placeholder="Avisa cuando baje de acá" value={minimo} onChange={e => setMinimo(e.target.value)} disabled={busy} />

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar insumo'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
