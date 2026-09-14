import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRowGestures } from '../../hooks/useRowGestures';
import Icon from '../../components/icons/Icon';
import { waLink } from '../../services/contactosApi';
import './ContactoCard.css';

// Tarjeta de contacto — compacta a propósito: nombre, empresa/posición, o
// (si no hay ninguna) el primer vínculo. El resto vive en el detalle (un
// toque). Mantener presionada revela Editar/Borrar. Sin teléfono cargado,
// la caja se ve en un gris apenas distinto para poder detectarlos de un
// vistazo en la grilla — a pedido explícito del usuario.
export default function ContactoCard({ contacto, primerVinculo, actionsOpen, onOpenActionsChange, onOpenDetail, onEdit, onDelete }) {
  const [busy, setBusy] = useState(false);
  const gestureProps = useRowGestures({
    onTap: () => onOpenDetail(contacto.id),
    onLongPress: () => onOpenActionsChange(contacto.id)
  });

  let segundaLinea = '';
  if (contacto.empresa) segundaLinea = contacto.empresa;
  else if (!contacto.posicion && primerVinculo) segundaLinea = `${primerVinculo.categoria} de ${primerVinculo.otro.nombre}`;

  const wa = waLink(contacto.telefono);

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
    <div className={`contacto-card-wrap${wa ? '' : ' contacto-card-wrap--sin-telefono'}`}>
      <div className="contacto-card" {...gestureProps}>
        <div className="contacto-card-name">{contacto.nombre}</div>
        {segundaLinea && <div className="contacto-card-meta">{segundaLinea}</div>}
        {contacto.posicion && <div className="contacto-card-meta">{contacto.posicion}</div>}
      </div>
      {wa && (
        <a
          className="contacto-card-whatsapp"
          href={wa} target="_blank" rel="noopener noreferrer"
          aria-label={`Escribir a ${contacto.nombre} por WhatsApp`}
          onClick={e => e.stopPropagation()}
        >
          <Icon name="whatsapp" size={15} />
        </a>
      )}
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
