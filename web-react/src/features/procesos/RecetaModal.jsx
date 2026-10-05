import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { parseThousandsInput, formatThousandsValue } from '../../utils/format';
import EtapaEditor from './EtapaEditor';
import RecetaIngredientesTable from './RecetaIngredientesTable';
import './RecetaModal.css';

// Crear/editar receta — equivalente a openRecetaModal()/btnSaveReceta en
// ../../../procesos.js. Siempre se crea dentro de un grupo (ver
// ProcesosPage), igual que una feria siempre se crea dentro de un canal.
// ingredientes/onAddNewIngrediente: catálogo compartido (ver
// features/ingredientes/useIngredientes.js) para el autocomplete de cada
// fila de ingrediente.
export default function RecetaModal({ open, onClose, editingReceta, ingredientes, onAddNewIngrediente, onSave }) {
  const [nombre, setNombre] = useState('');
  const [etapas, setEtapas] = useState([]);
  const [ingFilas, setIngFilas] = useState([]);
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ nombre: '' });

  useEffect(() => {
    if (!open) return;
    const n = editingReceta ? editingReceta.nombre : '';
    setNombre(n);
    setEtapas(
      editingReceta
        ? (editingReceta.etapas || []).filter(e => !e.fija).map(e => ({ id: e.id || crypto.randomUUID(), nombre: e.nombre, instrucciones: e.instrucciones || [] }))
        : []
    );
    setIngFilas(
      editingReceta
        ? (editingReceta.ingredientesMaestros || []).map(im => ({ nombre: im.nombre, cantidadDraft: formatThousandsValue(im.cantidadTotal) }))
        : []
    );
    initialRef.current = { nombre: n };
  }, [open, editingReceta]);

  const isDirty = () => nombre.trim() !== initialRef.current.nombre || etapas.length > 0 || ingFilas.some(f => f.nombre.trim());
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    if (!nombreTrim) return showFeedback('El nombre de la receta es obligatorio.', 'err');

    const middleEtapas = etapas
      .map(et => ({ ...et, nombre: et.nombre.trim(), instrucciones: (et.instrucciones || []).filter(i => i.text.trim()) }))
      .filter(et => et.nombre);
    if (!middleEtapas.length) return showFeedback('Agrega al menos una etapa.', 'err');

    const ingredientesMaestros = ingFilas
      .filter(f => f.nombre.trim())
      .map(f => ({
        nombre: f.nombre.trim(),
        cantidadTotal: parseThousandsInput(f.cantidadDraft) || 0,
        unidad: ingredientes.find(i => i.nombre.toLowerCase() === f.nombre.trim().toLowerCase())?.unidad || ''
      }));
    if (ingredientesMaestros.some(im => im.cantidadTotal < 0)) {
      return showFeedback('Las cantidades de ingredientes no pueden ser negativas.', 'err');
    }

    setBusy(true);
    try {
      await onSave({ nombre: nombreTrim, middleEtapas, ingredientesMaestros }, editingReceta?.id || null);
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={editingReceta ? 'Editar receta' : 'Nueva receta'}>
      <form onSubmit={handleSubmit}>
        <TextField label="Nombre de la receta" placeholder="Ej: Habanero clásico" value={nombre} onChange={e => setNombre(e.target.value)} disabled={busy} autoFocus />

        <label className="field-label receta-modal-section-label">Ingredientes</label>
        <RecetaIngredientesTable
          filas={ingFilas} onChange={setIngFilas}
          ingredientes={ingredientes} onAddNew={onAddNewIngrediente} disabled={busy}
        />

        <label className="field-label receta-modal-section-label">Etapas</label>
        <EtapaEditor etapas={etapas} onChange={setEtapas} disabled={busy} />

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar receta'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
