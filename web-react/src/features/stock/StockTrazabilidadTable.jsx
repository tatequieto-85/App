import { fmtDayMonthYearShort } from '../../utils/format';
import { getFechaVencimientoLote } from '../../services/stockApi';

// Equivalente a renderStockTrazabilidad() en ../../../stock.js — solo
// lectura, sin acciones por fila. Sin las columnas Fecha de elaboración/
// Ferias/Vendido/Testigo/Disponible (a pedido del usuario, para que la
// fila no supere el 100% del ancho de pantalla) — esos números ya se ven
// en Resumen y en cada tarjeta de Producto testigo, arriba en esta misma
// vista. Vencimiento en DD/MM/AA — calculado solo (6 meses desde que se
// cerró el lote), a pedido explícito del usuario, no un dato a mano.
export default function StockTrazabilidadTable({ rows }) {
  return (
    <div className="table-scroll">
      <table className="tasks-table tasks-table--compact">
        <thead>
          <tr>
            <th>Lote</th><th>Receta</th><th>Prod.</th><th>Venc.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ejecucion: ej, resumen: r }) => (
            <tr key={ej.id}>
              <td>{ej.loteId || '—'}</td>
              <td>{ej.nombreReceta}</td>
              <td>{r.producido}</td>
              <td>{fmtDayMonthYearShort(getFechaVencimientoLote(ej)) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
