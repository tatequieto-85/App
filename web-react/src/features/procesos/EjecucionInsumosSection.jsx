import { useState } from 'react';
import Button from '../../components/ui/Button';
import Icon from '../../components/icons/Icon';
import ThousandsField from '../../components/ui/ThousandsField';
import IngredienteAutocomplete from '../ingredientes/IngredienteAutocomplete';
import { parseThousandsInput } from '../../utils/format';
import './EjecucionInsumosSection.css';

function getUnidad(ingredientes, nombre) {
  const found = ingredientes.find(i => i.nombre.toLowerCase() === (nombre || '').trim().toLowerCase());
  return found?.unidad || '';
}

// Ingredientes REALMENTE usados en este lote, con su peso — a pedido del
// usuario, dentro del mismo cuadro de producción (ver
// RecetaDetailModal.jsx). Puede diferir de lo planeado en la receta (ver
// RecetaIngredientesTable, que es la versión "planificación"); acá no hay
// distinción comprado/receta, es un solo peso: lo que se usó.
export default function EjecucionInsumosSection({ ejecucion, ingredientes, onAddNewIngrediente, onAddInsumo, onRemoveInsumo }) {
  const [nombre, setNombre] = useState('');
  const [cantidadDraft, setCantidadDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const insumos = ejecucion.insumos || [];
  const unidad = getUnidad(ingredientes, nombre);

  async function handleAdd(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    const cantidad = parseThousandsInput(cantidadDraft);
    if (!nombreTrim || !cantidad) return;
    setBusy(true);
    try {
      await onAddInsumo(ejecucion, { nombre: nombreTrim, cantidad, unidad: getUnidad(ingredientes, nombreTrim) });
      setNombre('');
      setCantidadDraft('');
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
        {insumos.length ? insumos.map((ins, i) => (
          <div key={i} className="ejecucion-insumo-row">
            <span className="ejecucion-insumo-nombre">{ins.nombre}</span>
            <span className="ejecucion-insumo-cantidad">{ins.cantidad} {ins.unidad}</span>
            <button type="button" className="receta-ing-row-del" disabled={busy} onClick={() => handleRemove(i)} aria-label="Quitar ingrediente">
              <Icon name="trash" size={14} />
            </button>
          </div>
        )) : <div className="empty-state" style={{ padding: '8px 0' }}>Aún sin ingredientes cargados</div>}
      </div>
      <form onSubmit={handleAdd} className="ejecucion-insumos-form">
        <IngredienteAutocomplete
          label="Ingrediente" placeholder="Nombre…"
          value={nombre} onChange={setNombre}
          ingredientes={ingredientes} onAddNew={onAddNewIngrediente}
        />
        <div className="ejecucion-insumos-form-bottom">
          <ThousandsField
            label={`Peso${unidad ? ` (${unidad})` : ''}`} placeholder="0"
            value={cantidadDraft} onChange={setCantidadDraft} disabled={busy}
          />
          <Button type="submit" variant="outline" disabled={busy}>{busy ? 'Guardando…' : 'Agregar'}</Button>
        </div>
      </form>
    </div>
  );
}
