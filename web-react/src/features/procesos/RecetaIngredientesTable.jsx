import Button from '../../components/ui/Button';
import Icon from '../../components/icons/Icon';
import ThousandsField from '../../components/ui/ThousandsField';
import IngredienteAutocomplete from '../ingredientes/IngredienteAutocomplete';
import { parseThousandsInput, fmtCOP } from '../../utils/format';
import { calcularPorcentajes, pesoEnGramos, esUnidadDePeso, fmtPesoGramos, computeCostoReceta } from '../../services/recetasApi';
import './RecetaIngredientesTable.css';

function getUnidad(ingredientes, nombre) {
  const found = ingredientes.find(i => i.nombre.toLowerCase() === (nombre || '').trim().toLowerCase());
  return found?.unidad || '';
}

// Fila de un ingrediente "por peso/volumen" — dos cantidades, a pedido
// explícito del usuario: lo que se COMPRA antes de procesar (p. ej. 200 g
// de cebolla cruda — la base del costo de producción, cuando se migre
// Ejecuciones) y lo que efectivamente entra a la RECETA después de
// procesar (p. ej. 100 g ya caramelizada — la base del % y el peso total
// de la receta, ver RecetaModal.jsx).
function IngRowPeso({ fila, idx, unidad, pct, onUpdate, onRemove, ingredientes, onAddNew, disabled }) {
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
      <div className="field-row">
        <ThousandsField
          label={`Peso comprado${unidad ? ` (${unidad})` : ''}`} placeholder="0"
          value={fila.compradoDraft} onChange={v => onUpdate(idx, { compradoDraft: v })}
          disabled={disabled}
        />
        <ThousandsField
          label={`Peso para receta${unidad ? ` (${unidad})` : ''}`} placeholder="0"
          value={fila.recetaDraft} onChange={v => onUpdate(idx, { recetaDraft: v })}
          disabled={disabled}
        />
      </div>
      <div className="receta-ing-row-pct-line">
        <span className="receta-ing-pct-value">{pct != null ? `${pct.toFixed(1)}%` : '—'}</span>
        <span className="receta-ing-pct-label">del peso de la receta</span>
      </div>
    </div>
  );
}

// Fila "por unidad" (conteo, p. ej. "unidades") — una sola cantidad, no hay
// distinción comprado/receta porque no se procesa (no hay merma de peso).
function IngRowUnidad({ fila, idx, unidad, onUpdate, onRemove, ingredientes, onAddNew, disabled }) {
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
      <ThousandsField
        label={`Cantidad${unidad ? ` (${unidad})` : ''}`} placeholder="0"
        value={fila.recetaDraft}
        onChange={v => onUpdate(idx, { recetaDraft: v, compradoDraft: v })}
        disabled={disabled}
      />
    </div>
  );
}

// Filas de ingredientes agregadas/quitadas a voluntad del usuario (a pedido
// explícito, en vez del checklist fijo sobre todo el catálogo que usaba la
// app vanilla). Se separan en dos grupos, también a pedido explícito: los
// medidos por peso/volumen (g/kg/ml/L, con comprado/receta y % en vivo —
// 1 ml = 1 g) y los medidos "por unidad" (conteo, no entra al total ni
// tiene %, es otra magnitud).
export default function RecetaIngredientesTable({ filas, onChange, ingredientes, compras, onAddNew, disabled }) {
  const filasConUnidad = filas.map((f, i) => ({ ...f, unidad: getUnidad(ingredientes, f.nombre), idx: i }));
  const porPeso = filasConUnidad.filter(f => !f.unidad || esUnidadDePeso(f.unidad));
  const porUnidad = filasConUnidad.filter(f => f.unidad && !esUnidadDePeso(f.unidad));

  const conPorcentajes = calcularPorcentajes(
    porPeso.map(f => ({ ...f, cantidadReceta: parseThousandsInput(f.recetaDraft) }))
  );
  const pesoTotal = porPeso.reduce(
    (sum, f) => sum + (pesoEnGramos(parseThousandsInput(f.recetaDraft), f.unidad) || 0), 0
  );

  // Precio total estimado del lote — junto al peso, a pedido del usuario.
  // Usa el peso/cantidad COMPRADA de TODOS los ingredientes (de peso Y por
  // unidad, el usuario aclaró que el costo también tiene en cuenta estos
  // últimos) × su precio unitario más reciente en Compras.
  const { total: costoTotal, incompleto } = computeCostoReceta(
    compras,
    filasConUnidad
      .filter(f => f.nombre.trim())
      .map(f => ({ nombre: f.nombre, unidad: f.unidad, cantidadComprada: parseThousandsInput(f.compradoDraft) }))
  );

  function addRow() {
    onChange([...filas, { nombre: '', compradoDraft: '', recetaDraft: '' }]);
  }
  function updateRow(idx, patch) {
    onChange(filas.map((f, i) => i === idx ? { ...f, ...patch } : f));
  }
  function removeRow(idx) {
    onChange(filas.filter((_, i) => i !== idx));
  }

  return (
    <div className="receta-ing-table">
      {(pesoTotal > 0 || costoTotal > 0) && (
        <div className="receta-ing-total-banner">
          {pesoTotal > 0 && (
            <div className="receta-ing-total-row">
              <span>Peso total de la receta</span>
              <strong>{fmtPesoGramos(pesoTotal)}</strong>
            </div>
          )}
          <div className="receta-ing-total-row">
            <span>Precio total del lote</span>
            <strong>{fmtCOP(costoTotal)}</strong>
          </div>
          {!!incompleto.length && (
            <p className="receta-ing-total-incompleto">Incompleto: sin precio registrado de {incompleto.join(', ')}.</p>
          )}
        </div>
      )}

      <div className="receta-ing-group">
        {!!porUnidad.length && <h5 className="receta-ing-group-title">Por peso / volumen</h5>}
        {porPeso.length
          ? porPeso.map(f => (
              <IngRowPeso
                key={f.idx} fila={f} idx={f.idx} unidad={f.unidad}
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
            <IngRowUnidad
              key={f.idx} fila={f} idx={f.idx} unidad={f.unidad}
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
