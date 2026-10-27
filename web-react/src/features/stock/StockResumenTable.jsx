import { useState } from 'react';
import { useRowGestures } from '../../hooks/useRowGestures';

function ResumenRow({ row, expanded, onToggle, onLongPress }) {
  const gestureProps = useRowGestures({ onTap: onToggle, onLongPress: () => onLongPress(row.receta) });
  return (
    <>
      <tr className="stock-resumen-row" {...gestureProps}>
        <td>{row.receta.nombre}</td>
        <td className={`stock-disponible-cell${row.disponible < 0 ? ' stock-disponible-neg' : ''}`}>
          {row.disponible}
        </td>
      </tr>
      {expanded && !!row.porMedida.length && (
        <tr className="stock-resumen-row-detalle">
          <td colSpan={2}>
            {row.porMedida.map((m, i) => (
              <div key={i} className="stock-resumen-medida-row">
                <span>{row.receta.nombre} — {m.nombre}</span>
                <strong>{m.disponible}</strong>
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

// Equivalente a renderStockResumen() en ../../../stock.js. Mantener presionada
// una fila abre el ajuste manual de ese producto (no hay botones editar/
// eliminar acá: una sola acción, así que no hace falta la barra de dos
// botones — long-press abre el modal directo). Un toque simple expande/
// colapsa el desglose por MEDIDA debajo — a pedido explícito del usuario
// ("en stock no me distingue entre las recetas... no me da el stock por
// receta/medida"; "deberia salir receta + medida = ... = 8") — `row.porMedida`
// ya viene resuelto desde useStock.js (ver getStockPorMedida en stockApi.js).
export default function StockResumenTable({ rows, onOpenAjuste }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <>
      <table className="tasks-table">
        <thead><tr><th>Producto</th><th>Disponible</th></tr></thead>
        <tbody>
          {rows.map(row => (
            <ResumenRow
              key={row.receta.id} row={row}
              expanded={expandedId === row.receta.id}
              onToggle={() => setExpandedId(id => id === row.receta.id ? null : row.receta.id)}
              onLongPress={onOpenAjuste}
            />
          ))}
        </tbody>
      </table>
      <div className="ejecucion-hint">tocar una fila = ver por medida · mantener presionada = ajuste manual</div>
    </>
  );
}
