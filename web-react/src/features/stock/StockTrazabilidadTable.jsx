import { fmtDayMonthYearShort } from '../../utils/format';
import { getFechaVencimientoLote } from '../../services/stockApi';

// Equivalente a renderStockTrazabilidad() en ../../../stock.js. Producido
// discriminado por MEDIDA (ya no columnas fijas "230"/"130" — bug real
// reportado por el usuario: una medida de otro tamaño, ej. "105 g",
// quedaba invisible ahí aunque sí sumara al Disponible general; "en
// trazabilidad solo me contó la de 230 y no la de 1") — `row.items` ya
// viene resuelto desde useStock.js (ver getProduccionPorMedidaLote en
// stockApi.js), una entrada por medida con su nombre y cantidad. Un
// toque en la fila abre el resumen del lote (ver LoteResumenModal.jsx).
// Vencimiento en DD/MM/AA — calculado solo (6 meses desde que se cerró
// el lote), no un dato a mano.
export default function StockTrazabilidadTable({ rows, onOpenLote }) {
  return (
    <div className="table-scroll">
      <table className="tasks-table tasks-table--compact">
        <thead>
          <tr>
            <th>Lote</th><th>Receta</th><th>Producido</th><th>Venc.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const { ejecucion: ej } = row;
            return (
              <tr key={ej.id} className="stock-trazabilidad-row" onClick={() => onOpenLote(row)}>
                <td>{ej.loteId || '—'}</td>
                <td>{ej.nombreReceta}</td>
                <td>{row.items.map(i => `${i.nombre}: ${i.cantidad}`).join(', ') || '—'}</td>
                <td>{fmtDayMonthYearShort(getFechaVencimientoLote(ej)) || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
