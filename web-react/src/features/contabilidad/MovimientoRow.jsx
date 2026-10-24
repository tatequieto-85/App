import { useState } from 'react';
import Icon from '../../components/icons/Icon';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick';
import { fmtCOP, fmtDayMonthSlash } from '../../utils/format';
import './MovimientoRow.css';

// Fila de un movimiento. De los manuales, mantener presionado revela
// Editar y Borrar — a pedido explícito del usuario — salvo que sea la
// mitad de una transferencia (comparte `origenRefId` con otra fila), que
// solo se puede borrar entera (ver MovimientoModal.jsx). Los automáticos
// que vienen de una compra TAMBIÉN tienen Editar/Borrar — a pedido
// explícito del usuario — pero en vez de un formulario propio acá,
// "Editar" abre la compra que lo generó y "Borrar" borra esa compra
// entera (ver `esCompraAuto`/handleEditarMovimiento/
// handleBorrarMovimiento en ContabilidadPage.jsx, que decide a cuál de
// los dos casos corresponde cada click y arma `onEdit`/`onDelete` ya
// resueltos — acá no hace falta distinguirlos). El resto de los
// automáticos (ventas) siguen sin poder tocarse desde acá: para
// corregirlos hay que editar/borrar la feria que los generó, para que la
// caja nunca quede desincronizada de la fuente real. cajaNombre
// (opcional): para el resumen global de todas las cajas (ver
// ContabilidadPage.jsx) — adentro del detalle de UNA caja no hace falta,
// ya se sabe cuál es.
export default function MovimientoRow({ item, cajaNombre, esCompraAuto, onEdit, onDelete }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const esManual = item.origen === 'manual';
  const esTransferencia = esManual && !!item.origenRefId;
  const accionable = esManual || esCompraAuto;
  const wrapRef = useCloseOnOutsideClick(actionsOpen, () => setActionsOpen(false));
  const gestureProps = useRowGestures({ onLongPress: accionable ? () => setActionsOpen(true) : undefined });

  async function handleDelete() {
    const pregunta = esCompraAuto
      ? `Esto borra la compra que generó este movimiento (${fmtCOP(item.monto)}). ¿Seguro?`
      : `¿Borrar este movimiento (${fmtCOP(item.monto)})?`;
    if (!window.confirm(pregunta)) return;
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusy(false);
      setActionsOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="movimiento-row-wrap">
      <div className="movimiento-row" {...gestureProps}>
        <span className="movimiento-row-fecha">{fmtDayMonthSlash(item.fecha)}</span>
        <span className="movimiento-row-concepto">
          {item.concepto || (item.tipo === 'egreso' ? 'Egreso' : 'Ingreso')}
          {!esManual && ' (auto)'}
          {cajaNombre && ` — ${cajaNombre}`}
        </span>
        <span className="movimiento-row-monto" style={{ color: item.tipo === 'egreso' ? 'var(--danger)' : '#2E7D32' }}>
          {item.tipo === 'egreso' ? '−' : '+'}{fmtCOP(item.monto)}
        </span>
      </div>
      {accionable && actionsOpen && (
        <div className="row-actions-bar movimiento-row-actions">
          {!esTransferencia && (
            <button type="button" disabled={busy} onClick={() => { setActionsOpen(false); onEdit(item); }}>
              <Icon name="edit" size={13} /> Editar
            </button>
          )}
          <button type="button" className="danger" disabled={busy} onClick={handleDelete}>
            <Icon name="trash" size={13} /> {busy ? 'Borrando…' : 'Borrar'}
          </button>
        </div>
      )}
    </div>
  );
}
