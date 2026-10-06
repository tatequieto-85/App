import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { parseThousandsInput, formatThousandsValue } from '../../utils/format';
import { normalizeIngredienteMaestro } from '../../services/recetasApi';
import EtapaEditor from './EtapaEditor';
import RecetaIngredientesTable from './RecetaIngredientesTable';
import './RecetaModal.css';

// Crear/editar receta — equivalente a openRecetaModal()/btnSaveReceta en
// ../../../procesos.js. Siempre se crea dentro de un grupo (ver
// ProcesosPage), igual que una feria siempre se crea dentro de un canal.
// ingredientes/onAddNewIngrediente: catálogo compartido (ver
// features/ingredientes/useIngredientes.js) para el autocomplete de cada
// fila de ingrediente.
//
// Producción = una sola etapa fija llamada "Ejecución", a pedido explícito
// del usuario — ya no hay nombre de etapa ni "+ Agregar etapa" (ver
// EtapaEditor.jsx); acá solo se maneja la lista plana de instrucciones.
export default function RecetaModal({ open, onClose, editingReceta, ingredientes, compras, onAddNewIngrediente, onSave }) {
  const [nombre, setNombre] = useState('');
  const [instrucciones, setInstrucciones] = useState([]);
  const [ingFilas, setIngFilas] = useState([]);
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ nombre: '' });

  useEffect(() => {
    if (!open) return;
    const n = editingReceta ? editingReceta.nombre : '';
    setNombre(n);
    // Recetas de antes de este cambio podían tener varias etapas con
    // nombre propio — al editarlas, sus instrucciones se juntan todas acá
    // (sin perder ninguna), ya que ahora solo existe una "Ejecución".
    setInstrucciones(
      editingReceta
        ? (editingReceta.etapas || []).filter(e => !e.fija).flatMap(e => e.instrucciones || [])
        : []
    );
    setIngFilas(
      editingReceta
        ? (editingReceta.ingredientesMaestros || []).map(normalizeIngredienteMaestro).map(im => ({
            nombre: im.nombre,
            compradoDraft: formatThousandsValue(im.cantidadComprada),
            recetaDraft: formatThousandsValue(im.cantidadReceta)
          }))
        : []
    );
    initialRef.current = { nombre: n };
  }, [open, editingReceta]);

  const isDirty = () => nombre.trim() !== initialRef.current.nombre || instrucciones.length > 0 || ingFilas.some(f => f.nombre.trim());
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    if (!nombreTrim) return showFeedback('El nombre de la receta es obligatorio.', 'err');

    const instruccionesLimpias = instrucciones.filter(i => i.text.trim());
    const middleEtapas = [{ id: crypto.randomUUID(), nombre: 'Ejecución', instrucciones: instruccionesLimpias, insumos: [], fija: false }];

    const ingredientesMaestros = ingFilas
      .filter(f => f.nombre.trim())
      .map(f => ({
        nombre: f.nombre.trim(),
        cantidadComprada: parseThousandsInput(f.compradoDraft) || 0,
        cantidadReceta: parseThousandsInput(f.recetaDraft) || 0,
        unidad: ingredientes.find(i => i.nombre.toLowerCase() === f.nombre.trim().toLowerCase())?.unidad || ''
      }));
    if (ingredientesMaestros.some(im => im.cantidadComprada < 0 || im.cantidadReceta < 0)) {
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
          ingredientes={ingredientes} compras={compras} onAddNew={onAddNewIngrediente} disabled={busy}
        />

        <EtapaEditor instrucciones={instrucciones} onChange={setInstrucciones} disabled={busy} />

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar receta'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
