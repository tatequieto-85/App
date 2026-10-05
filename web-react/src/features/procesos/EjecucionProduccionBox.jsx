import { useState } from 'react';
import TextField from '../../components/ui/TextField';
import Button from '../../components/ui/Button';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import EjecucionInsumosSection from './EjecucionInsumosSection';
import EjecucionObsSection from './EjecucionObsSection';
import { fmtDateShortEs } from '../../utils/format';
import './EjecucionProduccionBox.css';

// Un solo cuadro, debajo de Etapas, apenas se toca "Empezar producción" (ver
// RecetaDetailModal.jsx) — a pedido explícito del usuario: no es una
// ventana aparte. Junta pH (obligatorio), frascos producidos, ingredientes
// usados (con su peso) y observaciones — campos/filas agregados a voluntad —
// y un botón final "Guardar ejecución" que cierra el lote (requiere pH
// cargado, ver finalizarEjecucion en useProcesos.js).
export default function EjecucionProduccionBox({
  ejecucion, ingredientes, onAddNewIngrediente,
  onAddObservacion, onAddInsumo, onRemoveInsumo, onChangePH, onChangeFrascos, onGuardarEjecucion
}) {
  const [phDraft, setPhDraft] = useState(ejecucion.evaluacion?.ph != null ? String(ejecucion.evaluacion.ph) : '');
  const [phTouched, setPhTouched] = useState(false);
  const [frascosDraft, setFrascosDraft] = useState(ejecucion.evaluacion?.frascosProducidos != null ? String(ejecucion.evaluacion.frascosProducidos) : '');
  const [guardando, setGuardando] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  async function handlePhBlur() {
    setPhTouched(true);
    const n = parseFloat(phDraft.replace(',', '.'));
    if (!isNaN(n)) await onChangePH(ejecucion, n);
  }

  async function handleFrascosBlur() {
    const n = parseInt(frascosDraft, 10);
    if (!isNaN(n)) await onChangeFrascos(ejecucion, n);
  }

  const phVacio = phTouched && !phDraft.trim();
  const yaGuardada = ejecucion.estado === 'Completada';

  async function handleGuardarEjecucion() {
    setPhTouched(true);
    if (!phDraft.trim()) return showFeedback('El pH es obligatorio para guardar la ejecución.', 'err');
    setGuardando(true);
    try {
      await onGuardarEjecucion(ejecucion);
      showFeedback('Ejecución guardada.', 'ok');
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="receta-detail-section ejecucion-produccion-box">
      <h4 className="receta-detail-section-title">Producción — Lote {ejecucion.loteId}</h4>
      <p className="modal-contexto">{ejecucion.nombreReceta} — iniciado {fmtDateShortEs(ejecucion.fechaInicio)}</p>

      <div className="field-row">
        <TextField
          label="pH (obligatorio)" placeholder="Ej: 3.8" inputMode="decimal"
          value={phDraft} onChange={e => setPhDraft(e.target.value)}
          onBlur={handlePhBlur}
          error={phVacio ? 'El pH es obligatorio.' : ''}
        />
        <TextField
          label="Frascos producidos" placeholder="0" inputMode="numeric"
          value={frascosDraft} onChange={e => setFrascosDraft(e.target.value)}
          onBlur={handleFrascosBlur}
        />
      </div>

      <p className="ejecucion-produccion-subtitle">Ingredientes usados</p>
      <EjecucionInsumosSection
        ejecucion={ejecucion} ingredientes={ingredientes} onAddNewIngrediente={onAddNewIngrediente}
        onAddInsumo={onAddInsumo} onRemoveInsumo={onRemoveInsumo}
      />

      <p className="ejecucion-produccion-subtitle">Observaciones</p>
      <EjecucionObsSection ejecucion={ejecucion} onAddObservacion={onAddObservacion} />

      <Button type="button" variant="primary" disabled={guardando} onClick={handleGuardarEjecucion} className="ejecucion-produccion-guardar-btn">
        {guardando ? 'Guardando…' : yaGuardada ? 'Guardar cambios' : 'Guardar ejecución'}
      </Button>
      <Feedback message={feedback.message} type={feedback.type} />
    </div>
  );
}
