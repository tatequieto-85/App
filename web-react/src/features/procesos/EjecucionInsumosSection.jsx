import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Icon from '../../components/icons/Icon';
import ThousandsField from '../../components/ui/ThousandsField';
import IngredienteAutocomplete from '../ingredientes/IngredienteAutocomplete';
import { parseThousandsInput } from '../../utils/format';
import { esUnidadDePeso } from '../../services/recetasApi';
import './EjecucionInsumosSection.css';

function getUnidad(ingredientes, nombre) {
  const found = ingredientes.find(i => i.nombre.toLowerCase() === (nombre || '').trim().toLowerCase());
  return found?.unidad || '';
}

// Ingredientes REALMENTE usados en este lote — a pedido del usuario, dentro
// del mismo cuadro de producción (ver RecetaDetailModal.jsx). Mismo criterio
// que al planificar la receta (RecetaIngredientesTable): un ingrediente por
// peso/volumen lleva DOS pesos (comprado antes de procesar y el que
// efectivamente entró a la receta — pueden diferir, p. ej. cebolla
// caramelizada); uno "por unidad" (conteo) lleva una sola cantidad, no hay
// noción de merma de proceso para algo que se cuenta. El alta ya no es un
// formulario siempre visible — a pedido explícito del usuario, se abre en
// una ventana propia detrás de un botón sutil de "+".
export default function EjecucionInsumosSection({ ejecucion, ingredientes, onAddNewIngrediente, onAddInsumo, onRemoveInsumo }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [compradoDraft, setCompradoDraft] = useState('');
  const [recetaDraft, setRecetaDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const insumos = ejecucion.insumos || [];
  const unidad = getUnidad(ingredientes, nombre);
  const esPeso = !unidad || esUnidadDePeso(unidad);

  function abrir() {
    setNombre('');
    setCompradoDraft('');
    setRecetaDraft('');
    setOpen(true);
  }

  async function handleAdd(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    const unidadIng = getUnidad(ingredientes, nombreTrim);
    const comprada = parseThousandsInput(compradoDraft) || 0;
    const receta = esUnidadDePeso(unidadIng) ? (parseThousandsInput(recetaDraft) || 0) : comprada;
    if (!nombreTrim || !comprada) return;
    setBusy(true);
    try {
      await onAddInsumo(ejecucion, { nombre: nombreTrim, cantidadComprada: comprada, cantidadReceta: receta, unidad: unidadIng });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(idx) {
    setBusy(true);
    try {
      await onRemoveInsumo(ejecucion, idx);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ejecucion-insumos-section">
      <div className="ejecucion-insumos-list">
        {insumos.length ? insumos.map((ins, i) => {
          const cantidadTxt = ins.cantidadComprada !== ins.cantidadReceta
            ? `${ins.cantidadComprada} → ${ins.cantidadReceta} ${ins.unidad}`
            : `${ins.cantidadReceta} ${ins.unidad}`;
          return (
            <div key={i} className="ejecucion-insumo-row">
              <span className="ejecucion-insumo-nombre">{ins.nombre}</span>
              <span className="ejecucion-insumo-cantidad">{cantidadTxt}</span>
              <button type="button" className="receta-ing-row-del" disabled={busy} onClick={() => handleRemove(i)} aria-label="Quitar ingrediente">
                <Icon name="trash" size={14} />
              </button>
            </div>
          );
        }) : <div className="empty-state" style={{ padding: '8px 0' }}>Aún sin ingredientes cargados</div>}
      </div>

      <button type="button" className="ejecucion-add-trigger" onClick={abrir}>
        <span className="icon-plus-circle"><Icon name="plus" size={12} /></span>
        Agregar ingrediente
      </button>

      <Modal open={open} onClose={() => setOpen(false)} showBack title="Nuevo ingrediente">
        <form onSubmit={handleAdd} className="ejecucion-insumos-form">
          <IngredienteAutocomplete
            label="Ingrediente" placeholder="Nombre…"
            value={nombre} onChange={setNombre}
            ingredientes={ingredientes} onAddNew={onAddNewIngrediente}
          />
          {esPeso ? (
            <div className="field-row">
              <ThousandsField
                label={`Peso comprado${unidad ? ` (${unidad})` : ''}`} placeholder="0"
                value={compradoDraft}
                onChange={v => {
                  setCompradoDraft(v);
                  // "Peso para receta" sigue a "Peso comprado" por defecto,
                  // mismo criterio que al planificar la receta — se deja de
                  // sincronizar en cuanto se toca el campo de receta a mano.
                  if (recetaDraft === '' || recetaDraft === compradoDraft) setRecetaDraft(v);
                }}
                disabled={busy}
              />
              <ThousandsField
                label={`Peso para receta${unidad ? ` (${unidad})` : ''}`} placeholder="0"
                value={recetaDraft} onChange={setRecetaDraft} disabled={busy}
              />
            </div>
          ) : (
            <ThousandsField
              label={`Cantidad${unidad ? ` (${unidad})` : ''}`} placeholder="0"
              value={compradoDraft} onChange={setCompradoDraft} disabled={busy}
            />
          )}
          <Button type="submit" variant="primary" disabled={busy} className="ejecucion-insumos-add-btn">
            {busy ? 'Guardando…' : 'Agregar'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
