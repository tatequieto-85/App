import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Icon from '../../components/icons/Icon';
import EmptyState from '../../components/ui/EmptyState';
import { fmtCOP, fmtDateShortEs } from '../../utils/format';
import './HistorialModal.css';

// Equivalente a openCompraHistorial()/renderCompraHistorialList() en ../../../compras.js.
export default function HistorialModal({ open, onClose, nombre, unidad, list, onDelete }) {
  const [busyRow, setBusyRow] = useState(null);

  async function handleDelete(rowIndex) {
    if (!window.confirm('¿Eliminar esta compra?')) return;
    setBusyRow(rowIndex);
    try {
      await onDelete(rowIndex);
    } finally {
      setBusyRow(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Historial de compras — ${nombre || ''}`}>
      {!list.length && <EmptyState>Sin compras registradas.</EmptyState>}
      <AnimatePresence initial={false}>
        {list.map(c => (
          <motion.div
            key={c.rowIndex}
            className="historial-item"
            layout
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: .16 }}
          >
            <span className="historial-item-text">
              {fmtDateShortEs(c.fecha) || '—'} — {c.cantidad} {unidad || 'u'} por {fmtCOP(c.precioTotal)}
              <span className="historial-item-tag">
                {fmtCOP(c.cantidad ? c.precioTotal / c.cantidad : 0)}/{unidad || 'u'}
              </span>
            </span>
            <Button variant="sm" disabled={busyRow === c.rowIndex} onClick={() => handleDelete(c.rowIndex)} aria-label="Eliminar">
              <Icon name="trash" size={14} />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </Modal>
  );
}
