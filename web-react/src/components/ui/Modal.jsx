import { AnimatePresence, motion } from 'framer-motion';
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

export default function Modal({ open, onClose, title, children, maxWidth = 460 }) {
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
              <h2>{title}</h2>
              <button className="btn btn--icon" onClick={onClose} aria-label="Cerrar">✕</button>
            </div>
            <div className="modal-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
