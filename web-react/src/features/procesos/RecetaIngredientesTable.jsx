import Button from '../../components/ui/Button';
import Icon from '../../components/icons/Icon';
import ThousandsField from '../../components/ui/ThousandsField';
import IngredienteAutocomplete from '../ingredientes/IngredienteAutocomplete';
import { parseThousandsInput } from '../../utils/format';
import { calcularPorcentajes, pesoEnGramos, esUnidadDePeso, fmtPesoGramos } from '../../services/recetasApi';
import './RecetaIngredientesTable.css';

function getUnidad(ingredientes, nombre) {
  const found = ingredientes.find(i => i.nombre.toLowerCase() === (nombre || '').trim().toLowerCase());
  return found?.unidad || '';
}

function IngRow({ fila, idx, unidad, pct, mostrarPct, onUpdate, onRemove, ingredientes, onAddNew, disabled }) {
  return (
    <div className="receta-ing-row">
      <div className="receta-ing-row-top">
        <IngredienteAutocomplete
          label="Ingrediente" placeholder="Nombre…"
          value={fila.nombre}
          onChange={v => onUpdate(idx, { nombre: v })}
          ingredientes={ingredientes}
          onAddNew={onAddNew}
        />
        <button type="button" className="receta-ing-row-del" disabled={disabled} onClick={() => onRemove(idx)} aria-label="Quitar ingrediente">
          <Icon name="trash" size={15} />
        </button>
      </div>
      <div className="receta-ing-row-bottom">
        <ThousandsField
          label={`Cantidad${unidad ? ` (${unidad})` : ''}`} placeholder="0"
          value={fila.cantidadDraft} onChange={v => onUpdate(idx, { cantidadDraft: v })}
          disabled={disabled}
        />
        {mostrarPct && (
          <div className="receta-ing-pct">
            <span className="receta-ing-pct-value">{pct != null ? `${pct.toFixed(1)}%` : '—'}</span>
            <span className="receta-ing-pct-label">del total</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Filas de ingredientes agregadas/quitadas a voluntad del usuario (a pedido
// explícito, en vez del checklist fijo sobre todo el catálogo que usaba la
// app vanilla). Se separan en dos grupos, también a pedido explícito: los
// medidos por peso/volumen (g/kg/ml/L, calculan % en vivo respecto al peso
// total de la receta — 1 ml = 1 g) y los medidos "por unidad" (conteo,
// p. ej. "unidades" — no entran al total ni tienen %, es otra magnitud).
// Una fila sin ingrediente elegido todavía cae en el grupo "por peso" por
// defecto (es el caso más común) hasta que se elige uno con otra unidad.
export default function RecetaIngredientesTable({ filas, onChange, ingredientes, onAddNew, disabled }) {
  const filasConUnidad = filas.map((f, i) => ({ ...f, unidad: getUnidad(ingredientes, f.nombre), idx: i }));
  const porPeso = filasConUnidad.filter(f => !f.unidad || esUnidadDePeso(f.unidad));
  const porUnidad = filasConUnidad.filter(f => f.unidad && !esUnidadDePeso(f.unidad));

  const conPorcentajes = calcularPorcentajes(
    porPeso.map(f => ({ ...f, cantidadTotal: parseThousandsInput(f.cantidadDraft) }))
  );
  const pesoTotal = porPeso.reduce(
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
      {pesoTotal > 0 && (
        <div className="receta-ing-total-banner">
          Peso total de la receta <strong>{fmtPesoGramos(pesoTotal)}</strong>
        </div>
      )}

      <div className="receta-ing-group">
        {!!porUnidad.length && <h5 className="receta-ing-group-title">Por peso / volumen</h5>}
        {porPeso.length
          ? porPeso.map(f => (
              <IngRow
                key={f.idx} fila={f} idx={f.idx} unidad={f.unidad} mostrarPct
                pct={conPorcentajes.find(c => c.idx === f.idx)?.porcentaje}
                onUpdate={updateRow} onRemove={removeRow}
                ingredientes={ingredientes} onAddNew={onAddNew} disabled={disabled}
              />
            ))
          : !porUnidad.length && <p className="receta-ing-group-empty">Sin ingredientes todavía.</p>}
      </div>

      {!!porUnidad.length && (
        <div className="receta-ing-group">
          <h5 className="receta-ing-group-title">Por unidad</h5>
          {porUnidad.map(f => (
            <IngRow
              key={f.idx} fila={f} idx={f.idx} unidad={f.unidad} mostrarPct={false}
              onUpdate={updateRow} onRemove={removeRow}
              ingredientes={ingredientes} onAddNew={onAddNew} disabled={disabled}
            />
          ))}
        </div>
      )}

      <Button type="button" variant="outline" disabled={disabled} onClick={addRow}>+ Agregar ingrediente</Button>
    </div>
  );
}
