import { useRowGestures } from '../../hooks/useRowGestures';

function ResumenRow({ row, onLongPress }) {
  const gestureProps = useRowGestures({ onLongPress: () => onLongPress(row) });
  return (
    <tr className="stock-resumen-row" {...gestureProps}>
      <td>{row.nombre}</td>
      <td className={`stock-disponible-cell${row.disponible < 0 ? ' stock-disponible-neg' : ''}`}>
        {row.disponible}
      </td>
    </tr>
  );
}

// Equivalente a renderStockResumen() en ../../../stock.js. Cada medida de
// una receta es su propia fila/item, con su propio ajuste manual — no un
// desglose de solo lectura debajo de la receta — a pedido explícito del
// usuario ("la receta esta anexa a medida y stock deberia estar anexa a
// medida... quiero que cada medida sea un item que se pueda ajustar
// manualmente en stock"); una receta sin medidas configuradas sigue
// mostrando una sola fila, como siempre. Mantener presionada una fila abre
// el ajuste manual de ESE item puntual (no hay botones editar/eliminar
// acá: una sola acción, así que no hace falta la barra de dos botones —
// long-press abre el modal directo). `rows` ya viene resuelto desde
// useStock.js (ver itemsDeReceta/getStockPorMedida en stockApi.js).
export default function StockResumenTable({ rows, onOpenAjuste }) {
  return (
    <>
      <table className="tasks-table">
        <thead><tr><th>Producto</th><th>Disponible</th></tr></thead>
        <tbody>
          {rows.map(row => (
            <ResumenRow key={row.id} row={row} onLongPress={onOpenAjuste} />
          ))}
        </tbody>
      </table>
      <div className="ejecucion-hint">mantener presionada una fila = ajuste manual</div>
    </>
  );
}
