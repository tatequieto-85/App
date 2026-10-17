import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../../components/icons/Icon';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick';
import { fmtCOP } from '../../utils/format';

// Fila del catálogo de combos ("Armar combos") — mantener presionado abre
// Editar/Borrar, mismo gesto que el resto de la app. No hay acción de un
// solo toque (no hay "entrar" a un combo, es solo catálogo).
export default function ComboRow({ combo, actionsOpen, onOpenActionsChange, onEdit, onDelete }) {
  const [busy, setBusy] = useState(false);
  const wrapRef = useCloseOnOutsideClick(actionsOpen, () => onOpenActionsChange(null));
  const gestureProps = useRowGestures({
    onLongPress: () => onOpenActionsChange(combo.id)
  });

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar el combo "${combo.nombre}"?`)) return;
    setBusy(true);
    try {
      await onDelete(combo.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr ref={wrapRef} className="combo-row" {...gestureProps}>
        <td>{combo.nombre}</td>
        <td>{combo.unidades}</td>
        <td>{fmtCOP(combo.precio)}</td>
      </tr>
      <AnimatePresence initial={false}>
        {actionsOpen && (
          <motion.tr
            className="combo-row-actions"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}
          >
            <td colSpan={3}>
              <div className="row-actions-bar">
                <button type="button" onClick={() => { onOpenActionsChange(null); onEdit(combo); }}>
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
