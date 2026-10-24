import { useState } from 'react';
import TextField from '../../components/ui/TextField';
import Button from '../../components/ui/Button';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import EjecucionInsumosSection from './EjecucionInsumosSection';
import EjecucionObsSection from './EjecucionObsSection';
import { fmtDayMonthYearShort, fmtCOP } from '../../utils/format';
import { computeCostoReceta, computePesoTotal } from '../../services/recetasApi';
import './EjecucionProduccionBox.css';

// Un solo cuadro, debajo de Etapas, apenas se toca "Empezar producción" (ver
// RecetaDetailModal.jsx) — a pedido explícito del usuario: no es una
// ventana aparte. Junta pH (obligatorio) + frascos producidos (misma fila
// que el pH), ingredientes usados (con su peso) y observaciones — campos/
// filas agregados a voluntad — y un botón final "Guardar ejecución" que
// cierra el lote (requiere pH cargado, ver finalizarEjecucion en
// useProcesos.js). `recetaMedidas` (del catálogo de Medidas, filtradas por
// recetaId — ver ProcesosPage.jsx): si la receta tiene medidas
// configuradas, se pregunta cuánto salió de CADA UNA (en vez de los dos
// campos fijos "Frasco 230 ml"/"Frasco 130 ml" de antes) — a pedido
// explícito del usuario: "salgan todas las medidas atadas a esa receta y
// uno escoja cuántas salieron de cada una". Una receta vieja sin medidas
// configuradas sigue viendo el par fijo de siempre, sin ningún cambio de
// comportamiento.
export default function EjecucionProduccionBox({
  ejecucion, ingredientes, onAddNewIngrediente, recetaIngredientes, recetaMedidas, compras,
  onAddObservacion, onAddInsumo, onRemoveInsumo, onChangePH, onChangeFrascos, onChangeProduccionMedida, onGuardarEjecucion, onClose
}) {
  const [phDraft, setPhDraft] = useState(ejecucion.evaluacion?.ph != null ? String(ejecucion.evaluacion.ph) : '');
  const [phTouched, setPhTouched] = useState(false);
  const [frascos230Draft, setFrascos230Draft] = useState(ejecucion.evaluacion?.frascos230 != null ? String(ejecucion.evaluacion.frascos230) : '');
  const [frascos130Draft, setFrascos130Draft] = useState(ejecucion.evaluacion?.frascos130 != null ? String(ejecucion.evaluacion.frascos130) : '');
  const produccionPorMedida = ejecucion.evaluacion?.produccionPorMedida || [];
  const [medidaDrafts, setMedidaDrafts] = useState(() => {
    const init = {};
    produccionPorMedida.forEach(p => { init[p.medidaId] = String(p.cantidad); });
    return init;
  });
  const [guardando, setGuardando] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  const usaMedidas = !!(recetaMedidas || []).length;

  async function handlePhBlur() {
    setPhTouched(true);
    const n = parseFloat(phDraft.replace(',', '.'));
    if (!isNaN(n)) await onChangePH(ejecucion, n);
  }

  async function handleFrascos230Blur() {
    const n = parseInt(frascos230Draft, 10);
    if (!isNaN(n)) await onChangeFrascos(ejecucion, 'frascos230', n);
  }

  async function handleFrascos130Blur() {
    const n = parseInt(frascos130Draft, 10);
    if (!isNaN(n)) await onChangeFrascos(ejecucion, 'frascos130', n);
  }

  async function handleMedidaBlur(medidaId) {
    const n = parseInt(medidaDrafts[medidaId], 10);
    if (!isNaN(n)) await onChangeProduccionMedida(ejecucion, medidaId, n, recetaMedidas);
  }

  const phVacio = phTouched && !phDraft.trim();
  const yaGuardada = ejecucion.estado === 'Completada';

  // Insumos unitarios de las medidas efectivamente producidas en ESTE lote
  // — el grupo de insumos de cada medida (frasco/etiqueta/tapa) multiplicado
  // por la cantidad ingresada para esa medida, a pedido explícito del
  // usuario ("al poner la cantidad de cada tamaño me descuente el grupo de
  // insumos multiplicado por los que salieron").
  const medidaInsumosExpandidos = usaMedidas
    ? (recetaMedidas || []).flatMap(medida => {
        const cantidad = parseInt(medidaDrafts[medida.id], 10) || 0;
        if (!cantidad) return [];
        return (medida.insumos || []).filter(ins => ins.nombre).map(ins => ({
          nombre: ins.nombre, unidad: ins.unidad,
          cantidadComprada: (ins.cantidad || 0) * cantidad,
          cantidadReceta: (ins.cantidad || 0) * cantidad
        }));
      })
    : [];

  // Precio total del lote, en vivo — a pedido explícito del usuario: si se
  // agregan ingredientes acá (no planeados en la receta), el precio del
  // lote tiene que sumarlos también, no solo los de la receta original.
  const todosLosInsumos = [...(recetaIngredientes || []), ...(ejecucion.insumos || []), ...medidaInsumosExpandidos];
  const { total: costoLote, incompleto: costoIncompleto } = computeCostoReceta(compras, todosLosInsumos);
  // Peso total del lote (g) — se congela junto con el costo al guardar la
  // ejecución, base para calcular la merma y el precio por frasco según
  // su tamaño en Stock (ver getPrecioFrascosLote en stockApi.js).
  const pesoTotalLote = computePesoTotal(todosLosInsumos);

  // Al guardar con éxito, se muestra el mensaje un instante y se cierra
  // solo — antes se quedaba en la misma ventana sin indicar que había
  // terminado, y el usuario lo reportó como que "no pasaba nada".
  async function handleGuardarEjecucion() {
    setPhTouched(true);
    if (!phDraft.trim()) return showFeedback('El pH es obligatorio para guardar la ejecución.', 'err');
    setGuardando(true);
    try {
      await onGuardarEjecucion(ejecucion, costoLote, pesoTotalLote, todosLosInsumos);
      showFeedback('Ejecución guardada.', 'ok');
      setTimeout(onClose, 900);
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
      setGuardando(false);
    }
  }

  return (
    <div className="receta-detail-section ejecucion-produccion-box">
      <div className="ejecucion-produccion-header">
        <div className="ejecucion-produccion-header-left">
          <strong>{ejecucion.nombreReceta}</strong>
          <span className="ejecucion-produccion-fecha">{fmtDayMonthYearShort(ejecucion.fechaInicio)}</span>
        </div>
        <div className="ejecucion-produccion-header-right">#{ejecucion.loteId}</div>
      </div>

      {costoLote > 0 && (
        <div className="ejecucion-produccion-costo">
          <span>Precio total del lote</span>
          <strong>{fmtCOP(costoLote)}</strong>
          {!!costoIncompleto.length && (
            <p className="ejecucion-produccion-costo-incompleto">Incompleto: sin precio registrado de {costoIncompleto.join(', ')}.</p>
          )}
        </div>
      )}

      <div className="field-row">
        <TextField
          label="pH (obligatorio)" placeholder="Ej: 3.8" inputMode="decimal"
          value={phDraft} onChange={e => setPhDraft(e.target.value)}
          onBlur={handlePhBlur}
          error={phVacio ? 'El pH es obligatorio.' : ''}
        />
        {!usaMedidas && (
          <>
            <TextField
              label="Frasco 230 ml" placeholder="0" inputMode="numeric"
              value={frascos230Draft} onChange={e => setFrascos230Draft(e.target.value)}
              onBlur={handleFrascos230Blur}
            />
            <TextField
              label="Frasco 130 ml" placeholder="0" inputMode="numeric"
              value={frascos130Draft} onChange={e => setFrascos130Draft(e.target.value)}
              onBlur={handleFrascos130Blur}
            />
          </>
        )}
        {usaMedidas && recetaMedidas.map(medida => (
          <TextField
            key={medida.id}
            label={`Cantidad — ${medida.nombre}`} placeholder="0" inputMode="numeric"
            value={medidaDrafts[medida.id] ?? ''}
            onChange={e => setMedidaDrafts(prev => ({ ...prev, [medida.id]: e.target.value }))}
            onBlur={() => handleMedidaBlur(medida.id)}
          />
        ))}
      </div>

      <p className="ejecucion-produccion-subtitle">Ingredientes adicionales</p>
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
