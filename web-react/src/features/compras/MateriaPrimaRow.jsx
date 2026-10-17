import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRowGestures } from '../../hooks/useRowGestures';
import './MateriaPrimaRow.css';

// Fila de un insumo de materia prima (envases, etiquetas, tapas, tarros —
// lo que NO es ingrediente de receta, eso ya lo maneja la tabla de arriba).
// Mismo patrón que CompraRow: mantener presionado revela Editar/Eliminar,
// sin acción de un toque (no hay nada que "registrar" acá, a diferencia de
// una compra — editar la cantidad disponible es la única acción).
export default function MateriaPrimaRow({ item, actionsOpen, onOpenActionsChange, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const gestureProps = useRowGestures({ onLongPress: () => onOpenActionsChange(item.id) });

  const bajoMinimo = item.minimo !== null && item.cantidad < item.minimo;

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar "${item.nombre}" del inventario de materia prima?`)) return;
    setDeleting(true);
    try {
      await onDelete(item.rowIndex);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <tr className="mp-row" {...gestureProps}>
        <td>
          {item.nombre}
          {item.categoria && <span className="mp-row-categoria">{item.categoria}</span>}
        </td>
        <td>{item.cantidad} {item.unidad}</td>
        <td>
          {item.minimo !== null
            ? <span className={bajoMinimo ? 'mp-row-minimo mp-row-minimo--bajo' : 'mp-row-minimo'}>{item.minimo} {item.unidad}{bajoMinimo ? ' · repón' : ''}</span>
            : '—'}
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {actionsOpen && (
          <motion.tr
            className="mp-row-actions"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}
          >
            <td colSpan={3}>
              <div className="row-actions-bar">
                <button type="button" onClick={() => onEdit(item)}>Editar</button>
                <button type="button" className="danger" disabled={deleting} onClick={handleDelete}>Eliminar</button>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}
