import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../icons/Icon';
import { useRowGestures } from '../../hooks/useRowGestures';
import './Widget.css';

// Tarjeta de resumen de un módulo en la pantalla principal — cada módulo
// migrado trae la suya (ver ComprasWidget/StockWidget), pero solo aparece si
// el usuario la agregó desde Home (ver useHomeWidgets). Máximo 25% del alto
// de pantalla; el ancho en columnas del grid de 3 lo controla el wrapper
// arrastrable (ver components/ui/SortableGrid.jsx), no este componente.
// Mismo gesto que una fila de lista: doble clic/toque dispara la acción
// principal (onTap), mantener presionado revela "Quitar de Home"
// (onRequestRemove abre la barra, onConfirmRemove borra) — ver
// hooks/useRowGestures.js.
export default function Widget({ icon, title, onTap, onRequestRemove, onConfirmRemove, removing, children }) {
  const gestureProps = useRowGestures({ onDoubleClick: onTap, onLongPress: onRequestRemove });

  return (
    <div className="widget">
      <div className="widget-tap" {...gestureProps}>
        <div className="widget-header">
          {icon && <span className="widget-icon"><Icon name={icon} size={16} /></span>}
          <span className="widget-title">{title}</span>
        </div>
        <div className="widget-body">{children}</div>
      </div>
      <AnimatePresence initial={false}>
        {removing && (
          <motion.div
            className="row-actions-bar widget-remove-bar"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}
          >
            <button type="button" className="danger" onClick={onConfirmRemove}>Quitar de Home</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
