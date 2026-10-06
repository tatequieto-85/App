import Widget from '../../components/ui/Widget';
import { useStock } from './useStock';
import { fmtCOP } from '../../utils/format';
import './StockWidget.css';

// Widget de datos (1/3, cuadrado) — a pedido explícito del usuario:
// segunda fila, dos columnas con la cantidad de frascos disponibles por
// tamaño (230 ml / 130 ml, sin título, solo el número — sale del
// registro de producción de cada lote); tercera fila, el valor total del
// stock actual (costo por lote / frascos obtenidos, ver resumenStockTotal
// en useStock.js). Un toque lleva a la pantalla de Stock.
export default function StockWidget({ onNavigate, removing, onRequestRemove, onConfirmRemove }) {
  const { loading, resumenStockTotal } = useStock();

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
          <div className="stock-widget-frascos">
            <div className="stock-widget-frasco-num">{resumenStockTotal.disponible230}</div>
            <div className="stock-widget-frasco-num">{resumenStockTotal.disponible130}</div>
          </div>
          <div className="stock-widget-valor">{fmtCOP(resumenStockTotal.valor)}</div>
        </>
      )}
    </Widget>
  );
}
