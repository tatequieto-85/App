import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRowGestures } from '../../hooks/useRowGestures';
import { fmtDateShortEs, getDueStatus } from '../../utils/format';
import './StockTestigoCard.css';

const ESTADO_LABELS = { en_resguardo: 'En resguardo', revisado: 'Revisado', descartado: 'Descartado' };

function estadoColor(t) {
  if (t.estado !== 'en_resguardo') return t.estado === 'revisado' ? '#2E7D32' : '#6B7280';
  const dueStatus = getDueStatus(t.fechaRevision);
  if (dueStatus === 'vencido') return '#C0392B';
  if (dueStatus === 'hoy' || dueStatus === 'porVencer') return '#F59E0B';
  return '#2E7D32';
}

// Equivalente a una tarjeta de renderStockTestigoList() en ../../../stock.js.
// Los botones Revisado/Descartado/Eliminar (antes siempre visibles) ahora se
// revelan manteniendo presionada la tarjeta, igual que el resto de la app.
export default function StockTestigoCard({ testigo, actionsOpen, onOpenActionsChange, onMarcarRevisado, onMarcarDescartado, onDelete }) {
  const [busy, setBusy] = useState(false);
  const gestureProps = useRowGestures({ onLongPress: () => onOpenActionsChange(testigo.id) });
  const color = estadoColor(testigo);

  async function handleDelete() {
    if (!window.confirm('¿Eliminar este registro de producto testigo?')) return;
    setBusy(true);
    try {
      await onDelete(testigo.rowIndex);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stock-testigo-wrap">
      <div className="stock-testigo-card" {...gestureProps}>
        <div className="stock-testigo-main">
          <div className="stock-testigo-title">{testigo.recetaNombre} — Lote {testigo.loteId || '—'}</div>
          <div className="stock-testigo-meta">
            {testigo.cantidad} unidades · Apartado: {fmtDateShortEs(testigo.fechaApartado)} · Revisión: {fmtDateShortEs(testigo.fechaRevision)}
          </div>
          {testigo.ubicacion && <div className="stock-testigo-meta">{testigo.ubicacion}</div>}
          {testigo.observaciones && <div className="stock-testigo-obs">{testigo.observaciones}</div>}
        </div>
        <span className="status-pill" style={{ background: `${color}22`, color }}>
          {ESTADO_LABELS[testigo.estado] || testigo.estado}
        </span>
      </div>
      <AnimatePresence initial={false}>
        {actionsOpen && (
          <motion.div
            className="row-actions-bar"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}
          >
            {testigo.estado === 'en_resguardo' && (
              <button type="button" disabled={busy} onClick={() => onMarcarRevisado(testigo)}>Revisado</button>
            )}
            {testigo.estado === 'en_resguardo' && (
              <button type="button" disabled={busy} onClick={() => onMarcarDescartado(testigo)}>Descartado</button>
            )}
            <button type="button" className="danger" disabled={busy} onClick={handleDelete}>Eliminar</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
