import { useState } from 'react';
import Button from '../../components/ui/Button';
import Icon from '../../components/icons/Icon';
import ThousandsField from '../../components/ui/ThousandsField';
import IngredienteAutocomplete from '../ingredientes/IngredienteAutocomplete';
import { parseThousandsInput, fmtCOP } from '../../utils/format';
import { calcularPorcentajes, pesoEnGramos, fmtPesoGramos, computeCostoReceta } from '../../services/recetasApi';
import { normalizeIngName } from '../../services/ingredientesApi';
import './RecetaIngredientesTable.css';

// Bug real encontrado: comparaba nombres con un simple .trim().toLowerCase()
// que además solo recortaba el lado de la receta (no el del catálogo) — un
// ingrediente con un espacio de más, o nombrado en plural en un lado y
// singular en el otro (p. ej. "Frascos" en el catálogo vs "Frasco" en la
// receta), nunca matcheaba: `unidad` quedaba '' y la fila caía siempre al
// grupo "Por peso/volumen" por defecto, sin avisar nada. Ahora usa
// normalizeIngName() (ya existía para detectar duplicados al crear un
// ingrediente nuevo, ver ingredientesApi.js) — mismo criterio en los dos
// lugares que necesitan decidir "es el mismo ingrediente".
function getUnidad(ingredientes, nombre) {
  const norm = normalizeIngName(nombre);
  const found = ingredientes.find(i => normalizeIngName(i.nombre) === norm);
  return found?.unidad || '';
}

function DeleteBtn({ idx, onRemove, disabled }) {
  return (
    <button
      type="button" className="receta-ing-row-del" disabled={disabled}
      onClick={e => { e.stopPropagation(); onRemove(idx); }}
      aria-label="Quitar ingrediente"
    >
      <Icon name="trash" size={15} />
    </button>
  );
}

// Fila COLAPSADA ("bloqueada") — a pedido del usuario: mientras se va
// agregando un ingrediente nuevo, el anterior se compacta a una sola línea
// sin los títulos de los campos (ni "Ingrediente", ni "Peso comprado", ni
// "Peso para receta"), con comprado y receta en la MISMA fila. Un toque la
// vuelve a activar (y colapsa la que estuviera activa).
function IngRowCollapsed({ fila, idx, unidad, pct, onActivate, onRemove, disabled }) {
  const cantidadesTxt = `${fila.compradoDraft || 0} → ${fila.recetaDraft || 0} ${unidad}`;
  return (
    <div className="receta-ing-row receta-ing-row--collapsed" onClick={() => onActivate(idx)}>
      <span className="receta-ing-row-collapsed-nombre">{fila.nombre || '(sin nombre)'}</span>
      <span className="receta-ing-row-collapsed-cantidades">{cantidadesTxt}</span>
      {pct != null && <span className="receta-ing-row-collapsed-pct">{pct.toFixed(2)}%</span>}
      <DeleteBtn idx={idx} onRemove={onRemove} disabled={disabled} />
    </div>
  );
}

// Fila ACTIVA de un ingrediente "por peso/volumen" — dos cantidades, a
// pedido explícito del usuario: lo que se COMPRA antes de procesar (p. ej.
// 200 g de cebolla cruda — la base del costo de producción) y lo que
// efectivamente entra a la RECETA después de procesar (p. ej. 100 g ya
// caramelizada — la base del % y el peso total de la receta).
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
        <DeleteBtn idx={idx} onRemove={onRemove} disabled={disabled} />
      </div>
      <div className="field-row">
        <ThousandsField
          label={`Peso comprado${unidad ? ` (${unidad})` : ''}`} placeholder="0"
          value={fila.compradoDraft}
          onChange={v => onUpdate(idx, {
            compradoDraft: v,
            // "Peso para receta" sigue a "Peso comprado" por defecto — a
            // pedido del usuario, el caso más común es sin merma de
            // proceso. Se deja de sincronizar en cuanto el usuario toca el
            // campo de receta a mano y lo deja distinto del comprado.
            ...(fila.recetaDraft === '' || fila.recetaDraft === fila.compradoDraft ? { recetaDraft: v } : {})
          })}
          disabled={disabled}
        />
        <ThousandsField
          label={`Peso para receta${unidad ? ` (${unidad})` : ''}`} placeholder="0"
          value={fila.recetaDraft} onChange={v => onUpdate(idx, { recetaDraft: v })}
          disabled={disabled}
        />
      </div>
      <div className="receta-ing-row-pct-line">
        <span className="receta-ing-pct-value">{pct != null ? `${pct.toFixed(2)}%` : '—'}</span>
        <span className="receta-ing-pct-label">del peso de la receta</span>
      </div>
    </div>
  );
}

// Filas de ingredientes de peso/volumen (g/kg/ml/L, con comprado/receta y %
// en vivo — 1 ml = 1 g) agregadas/quitadas a voluntad del usuario, en vez del
// checklist fijo sobre todo el catálogo que usaba la app vanilla. Los
// insumos "por unidad" (frasco/etiqueta/tapa) ya NO viven acá — a pedido
// explícito del usuario, cada tamaño de empaque (medida) tiene su propio
// grupo de insumos unitarios, configurado en RecetaMedidasSection.jsx. Una
// receta vieja que todavía tenga insumos "por unidad" en su lista (de antes
// de este cambio) sigue viendo esas filas acá mismo, con los mismos campos
// de peso — dato intacto, pero hay que migrarlos a una medida para que
// vuelvan a descontarse en producción (ver nota en el plan de esta
// migración). Solo UNA fila está "activa" (expandida, con los campos
// editables) a la vez — a pedido del usuario, para no saturar la pantalla
// con muchos ingredientes abiertos: agregar una fila nueva activa esa y
// colapsa la anterior; tocar una fila colapsada la reactiva. Al editar una
// receta ya guardada, todas arrancan colapsadas (mismo estilo, pedido
// explícito del usuario) — es estado de UI, no de datos, así que vive local
// acá y no en RecetaModal.
export default function RecetaIngredientesTable({ filas, onChange, ingredientes, compras, onAddNew, disabled }) {
  const [activeIdx, setActiveIdx] = useState(null);

  const filasConUnidad = filas.map((f, i) => ({ ...f, unidad: getUnidad(ingredientes, f.nombre), idx: i }));

  const conPorcentajes = calcularPorcentajes(
    filasConUnidad.map(f => ({ ...f, cantidadReceta: parseThousandsInput(f.recetaDraft) }))
  );
  const pesoTotal = filasConUnidad.reduce(
    (sum, f) => sum + (pesoEnGramos(parseThousandsInput(f.recetaDraft), f.unidad) || 0), 0
  );

  // Precio total estimado del lote — junto al peso, a pedido del usuario.
  // Usa el peso/cantidad COMPRADA × su precio unitario más reciente en
  // Compras.
  const { total: costoTotal, incompleto } = computeCostoReceta(
    compras,
    filasConUnidad
      .filter(f => f.nombre.trim())
      .map(f => ({ nombre: f.nombre, unidad: f.unidad, cantidadComprada: parseThousandsInput(f.compradoDraft) }))
  );

  function addRow() {
    onChange([...filas, { nombre: '', compradoDraft: '', recetaDraft: '' }]);
    setActiveIdx(filas.length);
  }
  function updateRow(idx, patch) {
    onChange(filas.map((f, i) => i === idx ? { ...f, ...patch } : f));
  }
  function removeRow(idx) {
    onChange(filas.filter((_, i) => i !== idx));
    setActiveIdx(null);
  }

  function renderFila(f) {
    const pct = conPorcentajes.find(c => c.idx === f.idx)?.porcentaje;
    if (f.idx !== activeIdx) {
      return (
        <IngRowCollapsed
          key={f.idx} fila={f} idx={f.idx} unidad={f.unidad} pct={pct}
          onActivate={setActiveIdx} onRemove={removeRow} disabled={disabled}
        />
      );
    }
    return (
      <IngRowPeso
        key={f.idx} fila={f} idx={f.idx} unidad={f.unidad} pct={pct}
        onUpdate={updateRow} onRemove={removeRow}
        ingredientes={ingredientes} onAddNew={onAddNew} disabled={disabled}
      />
    );
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
        {filasConUnidad.length
          ? filasConUnidad.map(f => renderFila(f))
          : <p className="receta-ing-group-empty">Sin ingredientes todavía.</p>}
      </div>

      <Button type="button" variant="outline" disabled={disabled} onClick={addRow}>+ Agregar ingrediente</Button>
    </div>
  );
}
