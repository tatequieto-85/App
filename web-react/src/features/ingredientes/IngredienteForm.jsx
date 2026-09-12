import { useState } from 'react';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';

export default function IngredienteForm({ onAdd }) {
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nombre.trim()) return showFeedback('Escribe el nombre del ingrediente.', 'err');
    if (!unidad.trim()) return showFeedback('Indica la unidad de medida (g, kg, L…).', 'err');
    setBusy(true);
    try {
      await onAdd(nombre, unidad);
      showFeedback(`✅ "${nombre.trim()}" agregado.`, 'ok');
      setNombre('');
      setUnidad('');
    } catch (e) {
      showFeedback(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field-row">
        <TextField
          label="Nombre" placeholder="Ej: Ají amarillo" value={nombre}
          onChange={e => setNombre(e.target.value)} disabled={busy}
        />
        <TextField
          label="Unidad" placeholder="g, kg, L, unidades…" value={unidad}
          onChange={e => setUnidad(e.target.value)} disabled={busy}
        />
      </div>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? 'Agregando…' : 'Agregar ingrediente'}
      </Button>
      <Feedback message={feedback.message} type={feedback.type} />
    </form>
  );
}
