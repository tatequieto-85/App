import { useState } from 'react';
import { useRowGestures } from '../../hooks/useRowGestures';
import './CanalCard.css';

const CANAL_HUES = [355, 25, 45, 95, 165, 200, 230, 280];

// Convierte "#RRGGBB" (o "#RGB") a rgba(...) con la opacidad dada — mismo
// helper que usa el módulo vanilla para el color pastel de la tarjeta.
function hexToRgba(hex, alpha) {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return null;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function canalColorStyle(canal, idx) {
  const customBg = canal.color ? hexToRgba(canal.color, .14) : null;
  const hue = !customBg ? CANAL_HUES[idx % CANAL_HUES.length] : null;
  const bg = customBg || (hue != null ? `hsl(${hue} 70% 55% / .12)` : null);
  const borderColor = canal.color ? `${canal.color}55` : (hue != null ? `hsl(${hue} 70% 45% / .35)` : 'var(--border)');
  return { background: bg || undefined, borderColor };
}

// Mantener presionada muestra el panel Editar/Borrar montado sobre la
// tarjeta; doble clic/doble toque entra al canal. Un toque normal no hace
// nada (mismo criterio que los grupos de recetas de Procesos).
export default function CanalCard({ canal, idx, onEnter, onEdit, onDelete }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const gestureProps = useRowGestures({
    onDoubleClick: () => onEnter(canal.id),
    onLongPress: () => setActionsOpen(true)
  });

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar el canal "${canal.nombre}"?`)) return;
    setBusy(true);
    try {
      await onDelete(canal.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="canal-venta-card-wrap">
      <div className="canal-venta-card" style={canalColorStyle(canal, idx)} {...gestureProps}>
        <div className="canal-venta-card-icon">{canal.icono || '🏪'}</div>
        <div className="canal-venta-card-name">{canal.nombre}</div>
      </div>
      {actionsOpen && (
        <div className="row-actions-bar canal-venta-card-actions">
          <button type="button" onClick={() => { setActionsOpen(false); onEdit(canal); }}>Editar</button>
          <button type="button" className="danger" disabled={busy} onClick={handleDelete}>Borrar</button>
        </div>
      )}
    </div>
  );
}
