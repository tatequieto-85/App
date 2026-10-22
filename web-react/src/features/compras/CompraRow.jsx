import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../../components/icons/Icon';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useSortableRow } from '../../components/ui/SortableTableRows';
import { fmtCOP } from '../../utils/format';
import './CompraRow.css';

// Equivalente a una fila de renderComprasList() en ../../../compras.js.
// Mantener presionado abre la barra de acciones (Editar/Eliminar) al pie de
// la fila; un toque registra una compra nueva de este ingrediente. Ver
// ../../hooks/useRowGestures.js para el detector del gesto. El orden de
// las filas es reordenable a mano (ver ComprasPage.jsx) — un ícono de
// agarradera aparte (no la fila entera) es lo que arrastra, para no pisar
// esos otros dos gestos que ya usan toda la fila.
export default function CompraRow({ row, actionsOpen, onOpenActionsChange, onEdit, onEditInsumo, onAjustarStock, onRegister, onDelete }) {
  const { ingrediente: ing, last, unitPrice } = row;
  const [deleting, setDeleting] = useState(false);
  const bajoMinimo = ing.minimo != null && ing.stock < ing.minimo;
  const { setNodeRef, style, dragHandleProps } = useSortableRow(ing.id);

  const gestureProps = useRowGestures({
    onLongPress: () => onOpenActionsChange(ing.nombre),
    onTap: () => onRegister(row)
  });

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
      <tr ref={setNodeRef} style={style} className="compra-row" {...gestureProps}>
        <td className="compra-row-handle-cell">
          <span className="compra-row-handle" {...dragHandleProps} onClick={e => e.stopPropagation()}>
            <Icon name="gripVertical" size={15} />
          </span>
        </td>
        <td>
          {ing.nombre}
          {ing.categoria && <span className="compra-row-categoria">{ing.categoria}</span>}
        </td>
        <td>{unitPrice != null ? `${fmtCOP(unitPrice)} / ${ing.unidad || 'u'}` : 'Sin compras'}</td>
        <td className={bajoMinimo || ing.stock < 0 ? 'compra-row-stock--negativo' : ''}>
          {ing.stock ?? 0} {ing.unidad}{bajoMinimo ? ' · repón' : ''}
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {actionsOpen && (
          <motion.tr
            className="compra-row-actions"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}
          >
            <td colSpan={4}>
              <div className="row-actions-bar">
                <button type="button" onClick={() => onEditInsumo(ing)}>
                  <Icon name="edit" size={13} /> Editar insumo
                </button>
                <button type="button" onClick={() => onAjustarStock(ing)}>
                  <Icon name="edit" size={13} /> Ajustar stock
                </button>
                <button type="button" disabled={!last} onClick={() => onEdit(row)}>
                  <Icon name="edit" size={13} /> Editar compra
                </button>
                <button type="button" className="danger" disabled={!last || deleting} onClick={handleDelete}>
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
