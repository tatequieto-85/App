import { useRowGestures } from '../../hooks/useRowGestures';

function ResumenRow({ row, onLongPress }) {
  const gestureProps = useRowGestures({ onLongPress: () => onLongPress(row.receta) });
  return (
    <tr className="stock-resumen-row" {...gestureProps}>
      <td>{row.receta.nombre}</td>
      <td className={`stock-disponible-cell${row.disponible < 0 ? ' stock-disponible-neg' : ''}`}>
        {row.disponible}
      </td>
    </tr>
  );
}

// Equivalente a renderStockResumen() en ../../../stock.js. Mantener presionada
// una fila abre el ajuste manual de ese producto (no hay botones editar/
// eliminar acá: una sola acción, así que no hace falta la barra de dos
// botones — long-press abre el modal directo).
export default function StockResumenTable({ rows, onOpenAjuste }) {
  return (
    <>
      <table className="tasks-table">
        <thead><tr><th>Producto</th><th>Disponible</th></tr></thead>
        <tbody>
          {rows.map(row => (
            <ResumenRow key={row.receta.id} row={row} onLongPress={onOpenAjuste} />
          ))}
        </tbody>
      </table>
      <div className="ejecucion-hint">mantener presionada una fila = ajuste manual</div>
    </>
  );
}
