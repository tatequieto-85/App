import { useState } from 'react';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { fmtDateShortEs } from '../../utils/format';
import './EjecucionObsSection.css';

// Lista + alta de observaciones del lote en curso — una subsección más
// dentro del cuadro de producción (ver EjecucionProduccionBox.jsx). Filas
// agregadas a voluntad, mismo patrón que las observaciones de Contactos.
export default function EjecucionObsSection({ ejecucion, onAddObservacion }) {
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

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
    <div className="ejecucion-obs-section">
      <div className="ejecucion-obs-list">
        {obs.length ? obs.map((o, i) => (
          <div key={i} className="ejecucion-obs-item">
            <div className="ejecucion-obs-text">{o.text}</div>
            <div className="ejecucion-obs-date">{o.createdAt ? fmtDateShortEs(o.createdAt) : ''}</div>
          </div>
        )) : <div className="empty-state" style={{ padding: '8px 0' }}>Aún sin observaciones</div>}
      </div>
      <form onSubmit={handleAdd} className="ejecucion-obs-form">
        <TextField placeholder="Agregar observación…" value={texto} onChange={e => setTexto(e.target.value)} disabled={busy} />
        <Button type="submit" variant="outline" disabled={busy}>{busy ? 'Guardando…' : 'Agregar'}</Button>
      </form>
      <Feedback message={feedback.message} type={feedback.type} />
    </div>
  );
}
