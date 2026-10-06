import Widget from '../../components/ui/Widget';
import { useStock } from './useStock';
import { fmtCOP } from '../../utils/format';

// Widget de datos (2/3, a pedido del usuario para que entre el valor en
// pesos + el desglose por tamaño de frasco): valor total del stock
// disponible (costo por lote / frascos obtenidos, ver resumenStockTotal
// en useStock.js) y cuánto de ese disponible es de 230 ml vs 130 ml. Un
// toque lleva a la pantalla de Stock.
export default function StockWidget({ onNavigate, removing, onRequestRemove, onConfirmRemove }) {
  const { loading, resumenRows, resumenStockTotal } = useStock();
  const disponibleTotal = resumenRows.reduce((sum, r) => sum + r.disponible, 0);

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
          <div className="widget-kpi">{fmtCOP(resumenStockTotal.valor)}</div>
          <div className="widget-kpi-label">Valor total del stock</div>
          <div className={`widget-line widget-line--sub${disponibleTotal < 0 ? ' widget-line--alert' : ''}`}>
            {disponibleTotal} disponibles · {resumenStockTotal.disponible230}×230ml · {resumenStockTotal.disponible130}×130ml
          </div>
        </>
      )}
    </Widget>
  );
}
