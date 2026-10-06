import { AnimatePresence, motion } from 'framer-motion';
import './QRAmpliado.css';

// Pantalla completa a pedido explícito del usuario, para poder escanear el
// código desde otro celular — fondo blanco (contraste parejo alrededor del
// QR, clave para que escanee bien) en vez del chrome normal de Modal. Se
// cierra tocando en cualquier parte de la pantalla.
export default function QRAmpliado({ open, onClose, qr }) {
  if (!qr) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="qr-ampliado-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}
          onClick={onClose}
        >
          <motion.img
            src={qr.imagen} alt={`QR ${qr.nombre}`} className="qr-ampliado-img"
            initial={{ scale: .92 }} animate={{ scale: 1 }} exit={{ scale: .92 }}
            transition={{ duration: .18, ease: [.22, .68, 0, 1.2] }}
          />
          <div className="qr-ampliado-nombre">{qr.nombre}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
