import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../icons/Icon';
import './Modal.css';

const overlayVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 }
};

// Mismo timing/curva que @keyframes modal-in en ../../../../style.css, para
// que un modal de React y uno de la app vanilla se sientan iguales.
const modalVariants = {
  hidden:  { opacity: 0, scale: .94, y: 12 },
  visible: { opacity: 1, scale: 1,   y: 0, transition: { duration: .22, ease: [.22, .68, 0, 1.2] } }
};

// Regla de toda la app: una única forma de cerrar/volver — la flecha arriba a
// la izquierda — en vez de una "✕" (o ambas). headerRight es para contenido
// puntual de un modal específico (p. ej. la fecha sutil de CompraModal), no
// para otra acción de cierre.
export default function Modal({ open, onClose, title, headerRight, children, maxWidth = 460 }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial="hidden" animate="visible" exit="hidden" variants={overlayVariants}
          transition={{ duration: .2 }}
          onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
        >
          <motion.div className="modal" style={{ maxWidth }} variants={modalVariants}>
            <div className="modal-header">
              <button type="button" className="modal-back" onClick={onClose} aria-label="Volver">
                <Icon name="arrowLeft" size={18} />
              </button>
              <h2 className="modal-title">{title}</h2>
              {headerRight && <div className="modal-header-right">{headerRight}</div>}
            </div>
            <div className="modal-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
