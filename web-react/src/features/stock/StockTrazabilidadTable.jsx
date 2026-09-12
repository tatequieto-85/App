import { fmtDayMonthSlash } from '../../utils/format';

// Equivalente a renderStockTrazabilidad() en ../../../stock.js — solo
// lectura, sin acciones por fila. Sin las columnas Vendido/Testigo/
// Disponible (a pedido del usuario, para que la fila no supere el 100% del
// ancho de pantalla) — esos números ya se ven en Resumen y en cada tarjeta
// de Producto testigo, arriba en esta misma vista. Fechas cortas (DD/MM) y
// tabla en variante compacta para que las 6 columnas que quedan entren sin
// scroll horizontal en una pantalla de celular.
export default function StockTrazabilidadTable({ rows }) {
  return (
    <div className="table-scroll">
      <table className="tasks-table tasks-table--compact">
        <thead>
          <tr>
            <th>Lote</th><th>Receta</th><th>Fecha</th><th>Prod.</th>
            <th>Ferias</th><th>Venc.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ejecucion: ej, resumen: r }) => (
            <tr key={ej.id}>
              <td>{ej.loteId || '—'}</td>
              <td>{ej.nombreReceta}</td>
              <td>{fmtDayMonthSlash(ej.fechaFin)}</td>
              <td>{r.producido}</td>
              <td>{r.comprometido}</td>
              <td>{fmtDayMonthSlash(ej.evaluacion?.fechaVencimiento) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
