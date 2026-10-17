import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../../components/icons/Icon';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick';
import { fmtCOP } from '../../utils/format';

// Fila del catálogo de descuentos ("Armar combos" → Descuentos) — mismo
// gesto que ComboRow: mantener presionado abre Editar/Borrar, sin acción de
// un solo toque.
export default function DescuentoRow({ descuento, actionsOpen, onOpenActionsChange, onEdit, onDelete }) {
  const [busy, setBusy] = useState(false);
  const wrapRef = useCloseOnOutsideClick(actionsOpen, () => onOpenActionsChange(null));
  const gestureProps = useRowGestures({
    onLongPress: () => onOpenActionsChange(descuento.id)
  });

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar el descuento "${descuento.nombre}"?`)) return;
    setBusy(true);
    try {
      await onDelete(descuento.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr ref={wrapRef} className="combo-row" {...gestureProps}>
        <td>{descuento.nombre}</td>
        <td>{descuento.tipo === 'monto' ? 'Monto fijo' : 'Porcentaje'}</td>
        <td>{descuento.tipo === 'monto' ? fmtCOP(descuento.valor) : `${descuento.valor}%`}</td>
      </tr>
      <AnimatePresence initial={false}>
        {actionsOpen && (
          <motion.tr
            className="combo-row-actions"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}
          >
            <td colSpan={3}>
              <div className="row-actions-bar">
                <button type="button" onClick={() => { onOpenActionsChange(null); onEdit(descuento); }}>
                  <Icon name="edit" size={13} /> Editar
                </button>
                <button type="button" className="danger" disabled={busy} onClick={handleDelete}>
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
