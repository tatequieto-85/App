import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Icon from '../../components/icons/Icon';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { fmtDateShortEs } from '../../utils/format';
import './EjecucionObsSection.css';

// Lista + alta de observaciones del lote en curso — una subsección más
// dentro del cuadro de producción (ver EjecucionProduccionBox.jsx). Mismo
// patrón que los ingredientes adicionales: el alta se abre en una ventana
// propia detrás de un botón sutil de "+", en vez de un formulario siempre
// visible.
export default function EjecucionObsSection({ ejecucion, onAddObservacion }) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  const obs = ejecucion.observations || [];

  function abrir() {
    setTexto('');
    setOpen(true);
  }

  async function handleAdd(e) {
    e.preventDefault();
    const text = texto.trim();
    if (!text) return;
    setBusy(true);
    try {
      await onAddObservacion(ejecucion, text);
      setOpen(false);
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

      <button type="button" className="ejecucion-add-trigger" onClick={abrir}>
        <span className="icon-plus-circle"><Icon name="plus" size={12} /></span>
        Agregar observación
      </button>

      <Modal open={open} onClose={() => setOpen(false)} showBack title="Nueva observación">
        <form onSubmit={handleAdd} className="ejecucion-obs-form">
          <TextField placeholder="Agregar observación…" value={texto} onChange={e => setTexto(e.target.value)} disabled={busy} />
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Guardando…' : 'Agregar'}</Button>
        </form>
        <Feedback message={feedback.message} type={feedback.type} />
      </Modal>
    </div>
  );
}
