import { useRowGestures } from '../../hooks/useRowGestures';

function ResumenRow({ row, onLongPress }) {
  const gestureProps = useRowGestures({ onLongPress: () => onLongPress(row.receta) });
  // El desglose por medida va siempre visible debajo del total de la receta
  // — no detrás de un toque — a pedido explícito del usuario, que después
  // de que el desglose quedara escondido tras un tap lo siguió reportando
  // como "stock aun me dice solo maracuya tranqui 26" (no lo notaba/no le
  // servía escondido): "la receta esta anexa a medida y stock deberia estar
  // anexa a medida" — cada medida es de UNA sola receta (ver medidasApi.js),
  // así que mostrar siempre receta+medida es lo que corresponde, igual que
  // ya hace Trazabilidad. Si solo hay un grupo (p. ej. receta sin medidas
  // configuradas, todo cae en "Sin medida asignada") no se repite la misma
  // cifra dos veces.
  const mostrarDesglose = row.porMedida.length > 1;
  return (
    <>
      <tr className="stock-resumen-row" {...gestureProps}>
        <td>{row.receta.nombre}</td>
        <td className={`stock-disponible-cell${row.disponible < 0 ? ' stock-disponible-neg' : ''}`}>
          {row.disponible}
        </td>
      </tr>
      {mostrarDesglose && (
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
// botones — long-press abre el modal directo). El desglose por MEDIDA va
// siempre visible debajo de cada receta con más de una medida — a pedido
// explícito del usuario — `row.porMedida` ya viene resuelto desde
// useStock.js (ver getStockPorMedida en stockApi.js).
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
