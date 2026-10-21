import EmptyState from '../../components/ui/EmptyState';
import './VentasResumen.css';

// Reemplaza el cuadro plano "Resumen de ventas por día" (fecha/canal/
// producto/cantidad) — a pedido explícito del usuario. Vive en la galería
// de canales (pantalla principal de Ventas), no dentro de un canal
// puntual. Dos agrupaciones, en este orden (pedido explícito): primero el
// % de venta de cada receta sobre el total general, después las unidades
// vendidas por canal y receta (ver resumenVentasPorReceta/
// resumenVentasPorCanal en useVentas.js).
export default function VentasResumen({ porReceta, porCanal }) {
  if (!porReceta.length) return <EmptyState>Todavía no hay ventas registradas.</EmptyState>;

  return (
    <div className="ventas-resumen">
      <p className="subsection-title">% de venta por receta</p>
      <table className="tasks-table">
        <thead><tr><th>Receta</th><th>Unidades</th><th>%</th></tr></thead>
        <tbody>
          {porReceta.map(r => (
            <tr key={r.recetaNombre}>
              <td>{r.recetaNombre}</td>
              <td>{r.cantidad}</td>
              <td>{r.pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="subsection-title ventas-resumen-canal-title">Ventas por canal</p>
      {porCanal.map(c => (
        <div key={c.canalNombre} className="ventas-resumen-canal-block">
          <h4 className="ventas-resumen-canal-nombre">{c.canalNombre} — {c.total} unidades</h4>
          <table className="tasks-table">
            <thead><tr><th>Receta</th><th>Unidades</th></tr></thead>
            <tbody>
              {c.recetas.map(r => (
                <tr key={r.recetaNombre}>
                  <td>{r.recetaNombre}</td>
                  <td>{r.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
