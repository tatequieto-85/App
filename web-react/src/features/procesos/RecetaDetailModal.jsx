import Modal from '../../components/ui/Modal';
import { calcularPorcentajes, pesoEnGramos, esUnidadDePeso, fmtPesoGramos, normalizeIngredienteMaestro } from '../../services/recetasApi';
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

export default function RecetaDetailModal({ open, onClose, receta }) {
  if (!receta) return null;
  const maestros = (receta.ingredientesMaestros || []).map(normalizeIngredienteMaestro);
  // Separados igual que en el editor (ver RecetaIngredientesTable.jsx): por
  // peso/volumen (con % del total, sobre el peso PARA RECETA) vs. por
  // unidad (no entra al total, el costo del lote igual los tiene en
  // cuenta — eso vive en Ejecuciones, todavía sin migrar).
  const porPeso = calcularPorcentajes(maestros.filter(m => esUnidadDePeso(m.unidad)));
  const porUnidad = maestros.filter(m => !esUnidadDePeso(m.unidad));
  const pesoTotal = porPeso.reduce((sum, m) => sum + (pesoEnGramos(m.cantidadReceta, m.unidad) || 0), 0);
  const middleEtapas = (receta.etapas || []).filter(e => !e.fija);

  return (
    <Modal open={open} onClose={onClose} showBack title={receta.nombre}>
      {!!maestros.length && (
        <div className="receta-detail-section">
          <h4 className="receta-detail-section-title">Ingredientes</h4>
          {pesoTotal > 0 && (
            <p className="receta-detail-peso-total">Peso total de la receta: <strong>{fmtPesoGramos(pesoTotal)}</strong></p>
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
    </Modal>
  );
}
