import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRowGestures } from '../../hooks/useRowGestures';
import './ActivoCard.css';

const ESTADO_COLOR = { 'Operativo': '#2E7D32', 'En mantenimiento': '#B7791F', 'Fuera de servicio': '#C0392B' };

// Tarjeta de un activo/equipo de la empresa — mismo patrón que
// StockTestigoCard (Stock): mantener presionado revela Editar/Eliminar.
export default function ActivoCard({ activo, actionsOpen, onOpenActionsChange, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const gestureProps = useRowGestures({ onLongPress: () => onOpenActionsChange(activo.id) });
  const color = ESTADO_COLOR[activo.estado] || '#6B7280';

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar "${activo.nombre}" del inventario de activos?`)) return;
    setDeleting(true);
    try {
      await onDelete(activo.rowIndex);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="activo-card-wrap">
      <div className="activo-card" {...gestureProps}>
        <div className="activo-card-main">
          <div className="activo-card-title">{activo.nombre}{activo.categoria ? ` — ${activo.categoria}` : ''}</div>
          {activo.responsable && <div className="activo-card-meta">A cargo de {activo.responsable}</div>}
          {activo.observaciones && <div className="activo-card-obs">{activo.observaciones}</div>}
        </div>
        <span className="activo-status-pill" style={{ background: `${color}22`, color }}>{activo.estado}</span>
      </div>
      <AnimatePresence initial={false}>
        {actionsOpen && (
          <motion.div
            className="row-actions-bar"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}
          >
            <button type="button" onClick={() => onEdit(activo)}>Editar</button>
            <button type="button" className="danger" disabled={deleting} onClick={handleDelete}>Eliminar</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
