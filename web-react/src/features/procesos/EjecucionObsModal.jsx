import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { fmtDateShortEs } from '../../utils/format';
import './EjecucionObsModal.css';

// Se abre al tocar "Empezar producción" en el detalle de una receta (ver
// RecetaDetailModal) — el lote (ejecución) ya se creó en ese momento, acá
// solo se van agregando observaciones libremente mientras se produce.
// Mismo patrón que la sección de observaciones de Contactos
// (ContactoDetailModal), con filas agregadas a voluntad del usuario.
export default function EjecucionObsModal({ open, onClose, ejecucion, onAddObservacion }) {
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  if (!ejecucion) return null;
  const obs = ejecucion.observations || [];

  async function handleAdd(e) {
    e.preventDefault();
    const text = texto.trim();
    if (!text) return;
    setBusy(true);
    try {
      await onAddObservacion(ejecucion, text);
      setTexto('');
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} showBack title={`Lote ${ejecucion.loteId}`}>
      <p className="modal-contexto">{ejecucion.nombreReceta} — iniciado {fmtDateShortEs(ejecucion.fechaInicio)}</p>

      <div className="ejecucion-obs-section">
        <p className="modal-contexto">Observaciones</p>
        <div className="ejecucion-obs-list">
          {obs.length ? obs.map((o, i) => (
            <div key={i} className="ejecucion-obs-item">
              <div className="ejecucion-obs-text">{o.text}</div>
              <div className="ejecucion-obs-date">{o.createdAt ? fmtDateShortEs(o.createdAt) : ''}</div>
            </div>
          )) : <div className="empty-state" style={{ padding: '8px 0' }}>Aún sin observaciones</div>}
        </div>
        <form onSubmit={handleAdd} className="ejecucion-obs-form">
          <TextField placeholder="Agregar observación…" value={texto} onChange={e => setTexto(e.target.value)} disabled={busy} autoFocus />
          <Button type="submit" variant="outline" disabled={busy}>{busy ? 'Guardando…' : 'Agregar'}</Button>
        </form>
        <Feedback message={feedback.message} type={feedback.type} />
      </div>
    </Modal>
  );
}
