import { fmtDayMonthYearShort } from '../../utils/format';
import { getFechaVencimientoLote } from '../../services/stockApi';

// Equivalente a renderStockTrazabilidad() en ../../../stock.js. Frascos
// discriminados por tamaño (230 ml / 130 ml, a pedido explícito del
// usuario) en vez de un solo total — sale directo del registro de
// producción de cada lote. Un toque en la fila abre el resumen del lote
// (ver LoteResumenModal.jsx). Vencimiento en DD/MM/AA — calculado solo
// (6 meses desde que se cerró el lote), no un dato a mano.
export default function StockTrazabilidadTable({ rows, onOpenLote }) {
  return (
    <div className="table-scroll">
      <table className="tasks-table tasks-table--compact">
        <thead>
          <tr>
            <th>Lote</th><th>Receta</th><th>230</th><th>130</th><th>Venc.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const { ejecucion: ej } = row;
            return (
              <tr key={ej.id} className="stock-trazabilidad-row" onClick={() => onOpenLote(row)}>
                <td>{ej.loteId || '—'}</td>
                <td>{ej.nombreReceta}</td>
                <td>{ej.evaluacion?.frascos230 || 0}</td>
                <td>{ej.evaluacion?.frascos130 || 0}</td>
                <td>{fmtDayMonthYearShort(getFechaVencimientoLote(ej)) || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
