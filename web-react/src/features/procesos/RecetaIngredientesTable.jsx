import Button from '../../components/ui/Button';
import Icon from '../../components/icons/Icon';
import ThousandsField from '../../components/ui/ThousandsField';
import IngredienteAutocomplete from '../ingredientes/IngredienteAutocomplete';
import { parseThousandsInput } from '../../utils/format';
import { calcularPorcentajes, pesoEnGramos } from '../../services/recetasApi';
import './RecetaIngredientesTable.css';

function getUnidad(ingredientes, nombre) {
  const found = ingredientes.find(i => i.nombre.toLowerCase() === (nombre || '').trim().toLowerCase());
  return found?.unidad || '';
}

// Filas de ingredientes agregadas/quitadas a voluntad del usuario (a pedido
// explícito, en vez del checklist fijo sobre todo el catálogo que usaba la
// app vanilla) — cada una calcula en vivo su % respecto al peso total de la
// receta (1 ml = 1 g, ver pesoEnGramos en recetasApi.js). `filas`:
// [{ nombre, cantidadDraft, unidad }] — cantidadDraft es el texto crudo de
// ThousandsField, se convierte a número recién al calcular/guardar.
export default function RecetaIngredientesTable({ filas, onChange, ingredientes, onAddNew, disabled }) {
  const filasConUnidad = filas.map(f => ({ ...f, unidad: getUnidad(ingredientes, f.nombre) }));
  const conPorcentajes = calcularPorcentajes(
    filasConUnidad.map(f => ({ ...f, cantidadTotal: parseThousandsInput(f.cantidadDraft) }))
  );
  const pesoTotal = filasConUnidad.reduce(
    (sum, f) => sum + (pesoEnGramos(parseThousandsInput(f.cantidadDraft), f.unidad) || 0), 0
  );

  function addRow() {
    onChange([...filas, { nombre: '', cantidadDraft: '' }]);
  }
  function updateRow(idx, patch) {
    onChange(filas.map((f, i) => i === idx ? { ...f, ...patch } : f));
  }
  function removeRow(idx) {
    onChange(filas.filter((_, i) => i !== idx));
  }

  return (
    <div className="receta-ing-table">
      {filas.map((fila, i) => {
        const unidad = filasConUnidad[i].unidad;
        const pct = conPorcentajes[i]?.porcentaje;
        return (
          <div key={i} className="receta-ing-row">
            <div className="receta-ing-row-top">
              <IngredienteAutocomplete
                label="Ingrediente" placeholder="Nombre…"
                value={fila.nombre}
                onChange={v => updateRow(i, { nombre: v })}
                ingredientes={ingredientes}
                onAddNew={onAddNew}
              />
              <button type="button" className="receta-ing-row-del" disabled={disabled} onClick={() => removeRow(i)} aria-label="Quitar ingrediente">
                <Icon name="trash" size={15} />
              </button>
            </div>
            <div className="receta-ing-row-bottom">
              <ThousandsField
                label={`Cantidad${unidad ? ` (${unidad})` : ''}`} placeholder="0"
                value={fila.cantidadDraft} onChange={v => updateRow(i, { cantidadDraft: v })}
                disabled={disabled}
              />
              <div className="receta-ing-pct">
                <span className="receta-ing-pct-value">{pct != null ? `${pct.toFixed(1)}%` : '—'}</span>
                <span className="receta-ing-pct-label">del total</span>
              </div>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" disabled={disabled} onClick={addRow}>+ Agregar ingrediente</Button>
      {pesoTotal > 0 && (
        <p className="receta-ing-total">Peso total (g/ml convertido a g): <strong>{pesoTotal.toLocaleString('es-CO')}</strong></p>
      )}
    </div>
  );
}
