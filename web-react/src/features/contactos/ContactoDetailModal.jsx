import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { edadActual, fmtCumpleanos } from '../../services/contactosApi';
import { fmtDateShortEs } from '../../utils/format';
import './ContactoDetailModal.css';

// Resumen de solo lectura (doble clic/toque en la tarjeta abre esto) — los
// datos y vínculos se editan desde "Editar" (ver ContactoModal), acá solo
// se agregan observaciones al historial.
export default function ContactoDetailModal({ open, onClose, contacto, vinculos, onAddObservacion }) {
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  if (!contacto) return null;

  const edad = edadActual(contacto);
  const titulo = edad != null ? `${contacto.nombre}, ${edad} años` : contacto.nombre;
  const empresaLinea = [contacto.empresa, contacto.posicion].filter(Boolean).join('. ');
  const ubicacionLinea = [contacto.ciudad, contacto.telefono].filter(Boolean).join(', ');
  const obs = contacto.observaciones || [];

  async function handleAdd(e) {
    e.preventDefault();
    const text = texto.trim();
    if (!text) return;
    setBusy(true);
    try {
      await onAddObservacion(contacto, text);
      setTexto('');
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} showBack title={titulo}>
      {contacto.cumpleanos && (
        <div className="contacto-detail-row">
          <span className="contacto-detail-label">Cumpleaños</span>
          <span>{fmtCumpleanos(contacto.cumpleanos)}</span>
        </div>
      )}
      {empresaLinea && (
        <div className="contacto-detail-row">
          <span className="contacto-detail-label">Empresa</span>
          <span>{empresaLinea}</span>
        </div>
      )}
      {!!vinculos.length && (
        <div className="contacto-detail-row">
          <span className="contacto-detail-label">Vínculos</span>
          <div>
            {vinculos.map(v => (
              <div key={v.rowIndex}>{v.tipo === 'trabajo' ? '💼 ' : ''}{v.categoria} de {v.otro.nombre}</div>
            ))}
          </div>
        </div>
      )}
      {ubicacionLinea && (
        <div className="contacto-detail-row">
          <span className="contacto-detail-label">Ubicación</span>
          <span>{ubicacionLinea}</span>
        </div>
      )}

      <div className="contacto-obs-section">
        <p className="modal-contexto">Observaciones</p>
        <div className="contacto-obs-list">
          {obs.length ? obs.map((o, i) => (
            <div key={i} className="contacto-obs-item">
              <div className="contacto-obs-text">{o.text}</div>
              <div className="contacto-obs-date">{o.createdAt ? fmtDateShortEs(o.createdAt) : ''}</div>
            </div>
          )) : <div className="empty-state" style={{ padding: '8px 0' }}>Aún sin observaciones</div>}
        </div>
        <form onSubmit={handleAdd} className="contacto-obs-form">
          <TextField placeholder="Agregar observación…" value={texto} onChange={e => setTexto(e.target.value)} disabled={busy} />
          <Button type="submit" variant="outline" disabled={busy}>{busy ? 'Guardando…' : 'Agregar'}</Button>
        </form>
        <Feedback message={feedback.message} type={feedback.type} />
      </div>
    </Modal>
  );
}
