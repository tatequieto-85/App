import { useState } from 'react';
import Icon from '../../components/icons/Icon';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick';
import './QRCard.css';

function descargarQR(q) {
  const a = document.createElement('a');
  a.href = q.imagen;
  a.download = `qr-${(q.nombre || 'codigo').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.gif`;
  a.click();
}

// Descargar/Copiar link son acciones sutiles siempre visibles (no
// destructivas, mismo criterio que el botón de WhatsApp en ContactoCard)
// — mantener presionada la tarjeta revela Eliminar (regla 5 de
// convenciones de UI, la única acción destructiva acá).
export default function QRCard({ qr, onDelete }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const wrapRef = useCloseOnOutsideClick(actionsOpen, () => setActionsOpen(false));
  const gestureProps = useRowGestures({ onLongPress: () => setActionsOpen(true) });

  async function handleCopiar(e) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(qr.link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* clipboard no disponible */ }
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar este código QR?')) return;
    setBusy(true);
    try {
      await onDelete(qr.rowIndex);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrapRef} className="qr-card-wrap">
      <div className="qr-card" {...gestureProps}>
        <img className="qr-card-img" src={qr.imagen} alt={`QR ${qr.nombre}`} />
        <div className="qr-card-info">
          <div className="qr-card-nombre">{qr.nombre}</div>
          <a
            className="qr-card-link" href={qr.link} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
          >
            {qr.link}
          </a>
        </div>
        <div className="qr-card-botones">
          <button type="button" className="qr-card-boton-sutil" onClick={e => { e.stopPropagation(); descargarQR(qr); }} aria-label="Descargar">
            <Icon name="download" size={15} />
          </button>
          <button type="button" className="qr-card-boton-sutil" onClick={handleCopiar} aria-label="Copiar link">
            <Icon name={copiado ? 'check' : 'link'} size={15} />
          </button>
        </div>
      </div>
      {actionsOpen && (
        <div className="row-actions-bar qr-card-eliminar-bar">
          <button type="button" className="danger" disabled={busy} onClick={handleDelete}>Eliminar</button>
        </div>
      )}
    </div>
  );
}
