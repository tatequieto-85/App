import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Select from '../../components/ui/Select';
import ThousandsField from '../../components/ui/ThousandsField';
import Icon from '../../components/icons/Icon';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { parseThousandsInput, formatThousandsValue } from '../../utils/format';
import IngredienteAutocomplete from '../ingredientes/IngredienteAutocomplete';
import './MedidaModal.css';

// Crear o editar una medida del catálogo (tamaño de empaque, ej. "230 ml")
// — a pedido explícito del usuario: "una ventana en Procesos (como un tab)
// y ahí se va a poder crear, editar o ver catálogo de medidas", después
// extendido ("cada medida debe guardar insumos de unidad con cantidad,
// asociarlo a una receta, e indicar en grs cuánto le cabe"): cada medida
// queda atada a UNA receta puntual (no es un nombre abstracto reutilizable
// entre sabores — la etiqueta/frasco de cada medida es propio de ESA
// receta) con su propio grupo de insumos unitarios, todo configurado
// desde acá mismo. `pesoMl` es cuánto de la mezcla entra en ESE frasco, EN
// GRAMOS — es la misma base que ya usa RecetaEscalarSection.jsx para
// sugerir cuántos frascos rinde un lote (1 ml ≈ 1 g). editingMedida null =
// crear. Editar una medida ya atada a una ejecución no toca esa ejecución
// (evaluacion.produccionPorMedida queda "congelado", mismo criterio que
// costoTotal/pesoTotalReceta en finalizarEjecucion).
export default function MedidaModal({ open, onClose, editingMedida, recetas, ingredientes, onAddNewIngrediente, onSave }) {
  const [nombre, setNombre] = useState('');
  const [pesoMl, setPesoMl] = useState('');
  const [recetaId, setRecetaId] = useState('');
  const [insumos, setInsumos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ nombre: '' });

  useEffect(() => {
    if (!open) return;
    const n = editingMedida ? editingMedida.nombre : '';
    setNombre(n);
    setPesoMl(editingMedida?.pesoMl ? String(editingMedida.pesoMl) : '');
    setRecetaId(editingMedida?.recetaId || '');
    setInsumos(editingMedida?.insumos ? editingMedida.insumos.map(ins => ({ ...ins })) : []);
    initialRef.current = { nombre: n };
  }, [open, editingMedida]);

  const isDirty = () => nombre.trim() !== initialRef.current.nombre;
  const close = useDirtyGuard(isDirty, onClose);

  function addInsumoRow() {
    setInsumos(prev => [...prev, { nombre: '', unidad: '', cantidad: 1 }]);
  }
  function updateInsumoRow(idx, patch) {
    setInsumos(prev => prev.map((ins, i) => i === idx ? { ...ins, ...patch } : ins));
  }
  function removeInsumoRow(idx) {
    setInsumos(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    if (!nombreTrim) return showFeedback('Ponele un nombre a la medida.', 'err');
    if (!recetaId) return showFeedback('Indica a qué receta pertenece esta medida.', 'err');
    const pesoNum = parseFloat(pesoMl.replace(',', '.')) || 0;
    const insumosLimpios = insumos.filter(ins => ins.nombre.trim());

    setBusy(true);
    try {
      await onSave({ nombre: nombreTrim, pesoMl: pesoNum, recetaId, insumos: insumosLimpios }, editingMedida?.id || null);
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={editingMedida ? 'Editar medida' : 'Nueva medida'}>
      <form onSubmit={handleSubmit}>
        <TextField label="Nombre" placeholder="Ej: 230 ml" value={nombre} onChange={e => setNombre(e.target.value)} disabled={busy} autoFocus />

        <Select
          label="Receta" value={recetaId} onChange={e => setRecetaId(e.target.value)} disabled={busy}
          options={[{ value: '', label: 'Elegir…' }, ...(recetas || []).map(r => ({ value: r.id, label: r.nombre }))]}
        />

        <TextField
          label="¿Cuánto de la mezcla entra en este frasco? (g)" type="number" min="0" placeholder="230"
          value={pesoMl} onChange={e => setPesoMl(e.target.value)} disabled={busy}
        />

        <label className="field-label receta-modal-section-label">Insumos de esta medida</label>
        {insumos.map((ins, idx) => (
          <div key={idx} className="medida-modal-insumo-row">
            <IngredienteAutocomplete
              label="Insumo" placeholder="Nombre…"
              value={ins.nombre}
              onChange={v => {
                const unidad = (ingredientes || []).find(i => i.nombre === v)?.unidad || '';
                updateInsumoRow(idx, { nombre: v, unidad });
              }}
              ingredientes={ingredientes}
              onAddNew={onAddNewIngrediente}
            />
            <ThousandsField
              label="Cantidad por unidad" placeholder="1"
              value={formatThousandsValue(ins.cantidad)}
              onChange={v => updateInsumoRow(idx, { cantidad: parseThousandsInput(v) || 0 })}
              disabled={busy}
            />
            <button
              type="button" className="receta-ing-row-del" disabled={busy}
              onClick={() => removeInsumoRow(idx)} aria-label="Quitar insumo"
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        <Button type="button" variant="outline" disabled={busy} onClick={addInsumoRow}>
          + Agregar insumo
        </Button>

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : (editingMedida ? 'Guardar cambios' : 'Crear medida')}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
