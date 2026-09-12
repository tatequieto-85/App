import Widget from '../../components/ui/Widget';
import { useStock } from './useStock';

// Widget de datos (1/3, angosto): suma del disponible de todos los
// productos. Un toque lleva a la pantalla de Stock.
export default function StockWidget({ onNavigate, removing, onRequestRemove, onConfirmRemove }) {
  const { loading, resumenRows } = useStock();
  const total = resumenRows.reduce((sum, r) => sum + r.disponible, 0);

  return (
    <Widget
      icon="box" title="Stock"
      onTap={() => onNavigate('stock')}
      removing={removing} onRequestRemove={onRequestRemove} onConfirmRemove={onConfirmRemove}
    >
      {loading ? (
        <p className="widget-line widget-line--sub">Cargando…</p>
      ) : (
        <>
          <div className={`widget-kpi${total < 0 ? ' widget-line--alert' : ''}`}>{total}</div>
          <div className="widget-kpi-label">Disponible total</div>
        </>
      )}
    </Widget>
  );
}
