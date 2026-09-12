import { useState } from 'react';
import { useRowGestures } from '../../hooks/useRowGestures';
import { feriaConteoTotal, feriaTotalLlevados, feriaTotalVendidos, feriaHaTerminado } from '../../services/feriasApi';
import { parseISODate } from '../../utils/format';
import './FeriaBlock.css';

function fmtDayMonth(iso) {
  if (!iso) return '';
  const d = parseISODate(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Long-press revela Editar/Borrar; doble clic/toque dispara handleAbrirFeria
// (conteo si está en curso, plan de stock si es futura, resumen si terminó
// o se cerró a mano) — ver VentasPage.
export default function FeriaBlock({ feria, esProxima, onAbrir, onEdit, onDelete }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const gestureProps = useRowGestures({
    onDoubleClick: () => onAbrir(feria.id),
    onLongPress: () => setActionsOpen(true)
  });

  const terminada = feriaHaTerminado(feria);
  const fechas = (feria.fechaInicio && feria.fechaFin)
    ? `${fmtDayMonth(feria.fechaInicio)} a ${fmtDayMonth(feria.fechaFin)}`
    : '—';

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta feria?')) return;
    setBusy(true);
    try {
      await onDelete(feria);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="feria-block-wrap">
      <div
        className={`feria-block${terminada ? ' feria-block--terminada' : ''}${esProxima ? ' feria-block--proxima' : ''}`}
        {...gestureProps}
      >
        <div className="feria-block-row1">
          <div>
            <div className="feria-block-title">{feria.empresa}</div>
            <div className="feria-block-meta">📍 {feria.lugar || '—'}</div>
          </div>
          <div className="feria-block-fechas">{fechas}</div>
        </div>
        <div className="feria-block-stats">
          <span>📦 {feriaTotalLlevados(feria)}</span>
          <span>👥 {feriaConteoTotal(feria)}</span>
          <span>🛒 {feriaTotalVendidos(feria)}</span>
        </div>
      </div>
      {actionsOpen && (
        <div className="row-actions-bar">
          <button type="button" onClick={() => { setActionsOpen(false); onEdit(feria); }}>Editar</button>
          <button type="button" className="danger" disabled={busy} onClick={handleDelete}>Eliminar</button>
        </div>
      )}
    </div>
  );
}
