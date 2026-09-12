import Widget from '../../components/ui/Widget';
import { useStock } from './useStock';

// Resumen de Stock para la pantalla principal.
export default function StockWidget({ onClick }) {
  const { loading, resumenRows } = useStock();
  const negativos = resumenRows.filter(r => r.disponible < 0).length;

  return (
    <Widget icon="box" title="Stock" onClick={onClick}>
      {loading ? (
        <p className="widget-line widget-line--sub">Cargando…</p>
      ) : (
        <>
          <p className="widget-line"><strong>{resumenRows.length}</strong> productos con inventario</p>
          <p className={`widget-line widget-line--sub${negativos ? ' widget-line--alert' : ''}`}>
            {negativos ? `${negativos} con disponible negativo` : 'Todos con disponible en orden'}
          </p>
        </>
      )}
    </Widget>
  );
}
