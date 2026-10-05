import { useState } from 'react';
import TextField from '../../components/ui/TextField';
import EjecucionInsumosSection from './EjecucionInsumosSection';
import EjecucionObsSection from './EjecucionObsSection';
import { fmtDateShortEs } from '../../utils/format';
import './EjecucionProduccionBox.css';

// Un solo cuadro, debajo de Etapas, apenas se toca "Empezar producción" (ver
// RecetaDetailModal.jsx) — a pedido explícito del usuario: no es una
// ventana aparte. Junta pH (obligatorio), ingredientes usados (con su
// peso) y observaciones — las tres, filas/campos agregados a voluntad.
export default function EjecucionProduccionBox({
  ejecucion, ingredientes, onAddNewIngrediente,
  onAddObservacion, onAddInsumo, onRemoveInsumo, onChangePH
}) {
  const [phDraft, setPhDraft] = useState(ejecucion.evaluacion?.ph != null ? String(ejecucion.evaluacion.ph) : '');
  const [phTouched, setPhTouched] = useState(false);

  async function handlePhBlur() {
    setPhTouched(true);
    const n = parseFloat(phDraft.replace(',', '.'));
    if (!isNaN(n)) await onChangePH(ejecucion, n);
  }

  const phVacio = phTouched && !phDraft.trim();

  return (
    <div className="receta-detail-section ejecucion-produccion-box">
      <h4 className="receta-detail-section-title">Producción — Lote {ejecucion.loteId}</h4>
      <p className="modal-contexto">{ejecucion.nombreReceta} — iniciado {fmtDateShortEs(ejecucion.fechaInicio)}</p>

      <TextField
        label="pH (obligatorio)" placeholder="Ej: 3.8" inputMode="decimal"
        value={phDraft} onChange={e => setPhDraft(e.target.value)}
        onBlur={handlePhBlur}
        error={phVacio ? 'El pH es obligatorio.' : ''}
      />

      <p className="ejecucion-produccion-subtitle">Ingredientes usados</p>
      <EjecucionInsumosSection
        ejecucion={ejecucion} ingredientes={ingredientes} onAddNewIngrediente={onAddNewIngrediente}
        onAddInsumo={onAddInsumo} onRemoveInsumo={onRemoveInsumo}
      />

      <p className="ejecucion-produccion-subtitle">Observaciones</p>
      <EjecucionObsSection ejecucion={ejecucion} onAddObservacion={onAddObservacion} />
    </div>
  );
}
