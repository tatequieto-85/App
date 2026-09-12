import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../icons/Icon';
import { useTapHold } from '../../hooks/useTapHold';
import './Widget.css';

// Tarjeta de resumen de un módulo en la pantalla principal — cada módulo
// migrado trae la suya (ver ComprasWidget/StockWidget), pero solo aparece si
// el usuario la agregó desde Home (ver useHomeWidgets). Máximo 25% del alto
// de pantalla; span: cuántas de las 3 columnas del grid ocupa (1, 2 o 3),
// definido junto con el usuario al migrar ese módulo — ver widgetRegistry.js.
// Un toque dispara la acción principal (onTap); mantener presionado revela
// "Quitar de Home" (onRequestRemove abre la barra, onConfirmRemove borra) —
// al revés que una fila de lista, donde la acción es doble clic y el
// long-press abre editar/eliminar.
export default function Widget({ icon, title, span = 1, onTap, onRequestRemove, onConfirmRemove, removing, children }) {
  const gestureProps = useTapHold({ onTap, onLongPress: onRequestRemove });

  return (
    <div className={`widget widget--span${span}`}>
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
