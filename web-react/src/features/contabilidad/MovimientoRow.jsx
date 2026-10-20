import { useState } from 'react';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick';
import { fmtCOP, fmtDayMonthSlash } from '../../utils/format';
import './MovimientoRow.css';

// Fila de un movimiento — los automáticos (generados solos al cerrar una
// feria o registrar una compra, ver contabilidadApi.js) no se pueden borrar
// desde acá: si hace falta sacarlos, se borra o edita la venta/compra que
// los generó, para que la caja nunca quede desincronizada de la fuente
// real. Solo los manuales tienen mantener-presionado para borrar.
// cajaNombre (opcional): para el resumen global de todas las cajas (ver
// ContabilidadPage.jsx) — adentro del detalle de UNA caja no hace falta,
// ya se sabe cuál es.
export default function MovimientoRow({ item, cajaNombre, onDelete }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const esManual = item.origen === 'manual';
  const wrapRef = useCloseOnOutsideClick(actionsOpen, () => setActionsOpen(false));
  const gestureProps = useRowGestures({ onLongPress: esManual ? () => setActionsOpen(true) : undefined });

  async function handleDelete() {
    if (!window.confirm(`¿Borrar este movimiento (${fmtCOP(item.monto)})?`)) return;
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
      {esManual && actionsOpen && (
        <div className="row-actions-bar movimiento-row-actions">
          <button type="button" className="danger" disabled={busy} onClick={handleDelete}>{busy ? 'Borrando…' : 'Borrar'}</button>
        </div>
      )}
    </div>
  );
}
