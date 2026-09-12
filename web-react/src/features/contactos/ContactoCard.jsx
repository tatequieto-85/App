import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRowGestures } from '../../hooks/useRowGestures';
import './ContactoCard.css';

// Tarjeta de contacto — compacta a propósito: nombre, empresa/posición, o
// (si no hay ninguna) el primer vínculo. El resto vive en el detalle
// (doble clic/toque). Mantener presionada revela Editar/Borrar.
export default function ContactoCard({ contacto, primerVinculo, actionsOpen, onOpenActionsChange, onOpenDetail, onEdit, onDelete }) {
  const [busy, setBusy] = useState(false);
  const gestureProps = useRowGestures({
    onDoubleClick: () => onOpenDetail(contacto.id),
    onLongPress: () => onOpenActionsChange(contacto.id)
  });

  let segundaLinea = '';
  if (contacto.empresa) segundaLinea = contacto.empresa;
  else if (!contacto.posicion && primerVinculo) segundaLinea = `${primerVinculo.categoria} de ${primerVinculo.otro.nombre}`;

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar a "${contacto.nombre}"? También se borran sus relaciones con otros contactos.`)) return;
    setBusy(true);
    try {
      await onDelete(contacto);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="contacto-card-wrap">
      <div className="contacto-card" {...gestureProps}>
        <div className="contacto-card-name">{contacto.nombre}</div>
        {segundaLinea && <div className="contacto-card-meta">{segundaLinea}</div>}
        {contacto.posicion && <div className="contacto-card-meta">{contacto.posicion}</div>}
      </div>
      <AnimatePresence initial={false}>
        {actionsOpen && (
          <motion.div
            className="row-actions-bar contacto-card-actions"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}
          >
            <button type="button" onClick={() => onEdit(contacto)}>Editar</button>
            <button type="button" className="danger" disabled={busy} onClick={handleDelete}>Borrar</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
