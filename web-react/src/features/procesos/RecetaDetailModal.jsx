import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { fmtCOP } from '../../utils/format';
import {
  calcularPorcentajes, pesoEnGramos, esUnidadDePeso, fmtPesoGramos,
  normalizeIngredienteMaestro, computeCostoReceta
} from '../../services/recetasApi';
import EjecucionProduccionBox from './EjecucionProduccionBox';
import './RecetaDetailModal.css';

// Resumen de solo lectura — un toque en la tarjeta de receta abre esto
// (ver RecetaCard). Ejecutar un lote todavía no está migrado (ver memoria
// del piloto), así que acá no hay nada más que ver/editar.
function EtapaDetail({ etapa, index }) {
  const instrucciones = etapa.instrucciones || [];
  let stepNum = 0;
  return (
    <div className="receta-detail-etapa">
      <div className="receta-detail-etapa-header">Etapa {index + 1}: {etapa.nombre}</div>
      {instrucciones.length ? (
        <div className="receta-detail-instrucciones">
          {instrucciones.map((instr, i) => {
            const tipo = instr.tipo || 'paso';
            const num = tipo === 'viñeta' ? '•' : `${++stepNum}.`;
            return <div key={i} className="receta-detail-instruccion-row"><span className="receta-detail-instruccion-num">{num}</span> {instr.text}</div>;
          })}
        </div>
      ) : <p className="empty-state" style={{ padding: '4px 0' }}>Sin instrucciones.</p>}
    </div>
  );
}

// Peso: muestra comprado → receta cuando difieren (p. ej. cebolla cruda vs.
// caramelizada); si son iguales (caso más común, sin merma de proceso) no
// hace falta mostrar las dos, alcanza con una. Unidad: una sola cantidad,
// no hay noción de "comprado vs. receta" para algo que se cuenta.
function IngRow({ ing, mostrarPct }) {
  const cantidadTxt = ing.cantidadComprada !== ing.cantidadReceta
    ? `${ing.cantidadComprada} → ${ing.cantidadReceta} ${ing.unidad}`
    : `${ing.cantidadReceta} ${ing.unidad}`;
  return (
    <div className="receta-detail-ing-row">
      <span className="receta-detail-ing-nombre">{ing.nombre}</span>
      <span className="receta-detail-ing-cantidad">{cantidadTxt}</span>
      {mostrarPct && ing.porcentaje != null && <span className="receta-detail-ing-pct">{ing.porcentaje.toFixed(1)}%</span>}
    </div>
  );
}

// Botón al final de Etapas, a pedido del usuario: arranca un lote
// (RecetasEjecuciones) para esta receta y, en vez de abrir una ventana
// aparte, hace aparecer UN CUADRO debajo de Etapas, en este mismo detalle
// (ver EjecucionProduccionBox: pH obligatorio + ingredientes usados +
// observaciones). El cronómetro por etapa y el resto de la evaluación
// final todavía no están migrados — esto es solo el punto de partida del
// lote. ingredientes/onAddNewIngrediente: catálogo compartido, para poder
// cargar los ingredientes usados dentro del cuadro.
export default function RecetaDetailModal({
  open, onClose, receta, compras, ingredientes, onAddNewIngrediente,
  onEmpezarProduccion, onAddObservacion, onAddInsumo, onRemoveInsumo, onChangePH, onChangeFrascos, onGuardarEjecucion
}) {
  const [busy, setBusy] = useState(false);
  const [ejecucion, setEjecucion] = useState(null);

  // Cada vez que se abre (o cambia de receta) arranca sin lote activo —
  // "Empezar producción" crea uno nuevo recién en ese momento.
  useEffect(() => {
    if (!open) return;
    setEjecucion(null);
  }, [open, receta?.id]);

  if (!receta) return null;

  async function handleEmpezarProduccion() {
    setBusy(true);
    try {
      const nueva = await onEmpezarProduccion(receta);
      setEjecucion(nueva);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddObservacion(ej, text) {
    setEjecucion(await onAddObservacion(ej, text));
  }
  async function handleAddInsumo(ej, insumo) {
    setEjecucion(await onAddInsumo(ej, insumo));
  }
  async function handleRemoveInsumo(ej, idx) {
    setEjecucion(await onRemoveInsumo(ej, idx));
  }
  async function handleChangePH(ej, ph) {
    setEjecucion(await onChangePH(ej, ph));
  }
  async function handleChangeFrascos(ej, frascos) {
    setEjecucion(await onChangeFrascos(ej, frascos));
  }
  async function handleGuardarEjecucion(ej) {
    setEjecucion(await onGuardarEjecucion(ej));
  }

  const maestros = (receta.ingredientesMaestros || []).map(normalizeIngredienteMaestro);
  // Separados igual que en el editor (ver RecetaIngredientesTable.jsx): por
  // peso/volumen (con % del total, sobre el peso PARA RECETA) vs. por
  // unidad (no entra al peso total, pero sí al precio — ver
  // computeCostoReceta, usa cantidadComprada de TODOS los ingredientes).
  const porPeso = calcularPorcentajes(maestros.filter(m => esUnidadDePeso(m.unidad)));
  const porUnidad = maestros.filter(m => !esUnidadDePeso(m.unidad));
  const pesoTotal = porPeso.reduce((sum, m) => sum + (pesoEnGramos(m.cantidadReceta, m.unidad) || 0), 0);
  const { total: costoTotal, incompleto } = computeCostoReceta(compras, maestros);
  const middleEtapas = (receta.etapas || []).filter(e => !e.fija);

  return (
    <Modal open={open} onClose={onClose} showBack title={receta.nombre}>
      {!!maestros.length && (
        <div className="receta-detail-section">
          <h4 className="receta-detail-section-title">Ingredientes</h4>
          {(pesoTotal > 0 || costoTotal > 0) && (
            <div className="receta-detail-totales">
              {pesoTotal > 0 && (
                <p className="receta-detail-peso-total">Peso total de la receta: <strong>{fmtPesoGramos(pesoTotal)}</strong></p>
              )}
              <p className="receta-detail-peso-total">Precio total del lote: <strong>{fmtCOP(costoTotal)}</strong></p>
              {!!incompleto.length && (
                <p className="receta-detail-costo-incompleto">Incompleto: sin precio registrado de {incompleto.join(', ')}.</p>
              )}
            </div>
          )}
          {porPeso.map((ing, i) => <IngRow key={`p${i}`} ing={ing} mostrarPct />)}
          {!!porUnidad.length && (
            <>
              <p className="receta-detail-subtitle">Por unidad</p>
              {porUnidad.map((ing, i) => <IngRow key={`u${i}`} ing={ing} mostrarPct={false} />)}
            </>
          )}
        </div>
      )}

      <div className="receta-detail-section">
        <h4 className="receta-detail-section-title">Etapas</h4>
        {middleEtapas.length
          ? middleEtapas.map((et, i) => <EtapaDetail key={et.id || i} etapa={et} index={i} />)
          : <p className="empty-state" style={{ padding: '4px 0' }}>Esta receta no tiene etapas.</p>}
      </div>

      {ejecucion ? (
        <EjecucionProduccionBox
          ejecucion={ejecucion} ingredientes={ingredientes} onAddNewIngrediente={onAddNewIngrediente}
          onAddObservacion={handleAddObservacion}
          onAddInsumo={handleAddInsumo} onRemoveInsumo={handleRemoveInsumo}
          onChangePH={handleChangePH} onChangeFrascos={handleChangeFrascos}
          onGuardarEjecucion={handleGuardarEjecucion}
        />
      ) : (
        <Button type="button" variant="primary" disabled={busy} onClick={handleEmpezarProduccion}>
          {busy ? 'Empezando…' : 'Empezar producción'}
        </Button>
      )}
    </Modal>
  );
}
