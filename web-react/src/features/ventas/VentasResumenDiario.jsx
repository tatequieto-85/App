import EmptyState from '../../components/ui/EmptyState';
import { fmtDayMonthSlash } from '../../utils/format';
import './VentasResumenDiario.css';

// Cuadro con lo vendido día por día, cruzando TODOS los canales (a
// diferencia de la lista de ferias, que ya está filtrada a uno solo) — a
// pedido del usuario: "qué se vendió, por qué canal se vendió, qué días".
// Vive en la galería de canales (pantalla principal de Ventas), no dentro
// de un canal puntual.
export default function VentasResumenDiario({ filas }) {
  return (
    <div className="ventas-resumen">
      <p className="subsection-title">Resumen de ventas por día</p>
      {!filas.length ? (
        <EmptyState>Todavía no hay ventas registradas.</EmptyState>
      ) : (
        <div className="table-scroll">
          <table className="tasks-table">
            <thead>
              <tr><th>Fecha</th><th>Canal</th><th>Producto</th><th>Cant.</th></tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i}>
                  <td>{fmtDayMonthSlash(f.fecha)}</td>
                  <td>{f.canalNombre}</td>
                  <td>{f.recetaNombre}</td>
                  <td>{f.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
