import { fmtDateShortEs } from '../../utils/format';

// Equivalente a renderStockTrazabilidad() en ../../../stock.js — solo
// lectura, sin acciones por fila.
export default function StockTrazabilidadTable({ rows }) {
  return (
    <div className="table-scroll">
      <table className="tasks-table">
        <thead>
          <tr>
            <th>Lote</th><th>Receta</th><th>Fecha</th><th>Producido</th>
            <th>En ferias</th><th>Vendido</th><th>Testigo</th><th>Disponible</th><th>Vencimiento</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ejecucion: ej, resumen: r }) => (
            <tr key={ej.id}>
              <td>{ej.loteId || '—'}</td>
              <td>{ej.nombreReceta}</td>
              <td>{fmtDateShortEs(ej.fechaFin)}</td>
              <td>{r.producido}</td>
              <td>{r.comprometido}</td>
              <td>{r.vendido}</td>
              <td>{r.testigo}</td>
              <td className={`stock-disponible-cell${r.disponible < 0 ? ' stock-disponible-neg' : ''}`}>{r.disponible}</td>
              <td>{ej.evaluacion?.fechaVencimiento || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
