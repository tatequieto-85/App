import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../../components/icons/Icon';
import { fmtCOP, fmtDayMonthSlash } from '../../utils/format';
import './CompraRow.css';

// Equivalente a una fila de renderComprasList() en ../../../compras.js.
// La app vanilla abre esta barra con press-and-hold (gesto táctil) y
// registra una compra nueva con doble clic/doble toque en la fila; acá se
// simplificó a un clic para abrir la barra de acciones y un botón explícito
// "+" para registrar, más accesible que gestos ocultos y sin depender del
// detector de long-press/doble-toque de input-guard.js.
export default function CompraRow({ row, onOpenActionsChange, actionsOpen, onEdit, onHistorial, onDelete, onRegister }) {
  const { ingrediente: ing, last, unitPrice } = row;
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!last) return;
    if (!window.confirm('¿Eliminar la última compra registrada de este ingrediente?')) return;
    setDeleting(true);
    try {
      await onDelete(last.rowIndex);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <tr className="compra-row" onClick={() => onOpenActionsChange(actionsOpen ? null : ing.nombre)}>
        <td>{ing.nombre}</td>
        <td>{last ? fmtDayMonthSlash(last.fecha) : '—'}</td>
        <td>{unitPrice != null ? `${fmtCOP(unitPrice)} / ${ing.unidad || 'u'}` : 'Sin compras'}</td>
        <td className="compra-row-add">
          <button
            type="button" className="btn btn--icon"
            onClick={e => { e.stopPropagation(); onRegister(ing.nombre); }}
            aria-label={`Registrar compra de ${ing.nombre}`}
          >
            <Icon name="plus" size={16} />
          </button>
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {actionsOpen && (
          <motion.tr
            className="compra-row-actions"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}
          >
            <td colSpan={4}>
              <div className="compra-row-actions-bar">
                <button type="button" disabled={!last} onClick={() => onEdit(last)}>
                  <Icon name="check" size={13} /> Editar
                </button>
                <button type="button" onClick={() => onHistorial(ing.nombre)}>
                  Historial
                </button>
                <button type="button" data-del-compra disabled={!last || deleting} onClick={handleDelete}>
                  <Icon name="trash" size={13} /> Eliminar
                </button>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}
