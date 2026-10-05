import Modal from '../../components/ui/Modal';
import { calcularPorcentajes, pesoEnGramos, esUnidadDePeso, fmtPesoGramos } from '../../services/recetasApi';
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

function IngRow({ ing }) {
  return (
    <div className="receta-detail-ing-row">
      <span className="receta-detail-ing-nombre">{ing.nombre}</span>
      <span className="receta-detail-ing-cantidad">{ing.cantidadTotal} {ing.unidad}</span>
      {ing.porcentaje != null && <span className="receta-detail-ing-pct">{ing.porcentaje.toFixed(1)}%</span>}
    </div>
  );
}

export default function RecetaDetailModal({ open, onClose, receta }) {
  if (!receta) return null;
  const maestros = receta.ingredientesMaestros || [];
  // Separados igual que en el editor (ver RecetaIngredientesTable.jsx): por
  // peso/volumen (con % del total) vs. por unidad (no entra al total).
  const porPeso = calcularPorcentajes(maestros.filter(m => esUnidadDePeso(m.unidad)));
  const porUnidad = maestros.filter(m => !esUnidadDePeso(m.unidad));
  const pesoTotal = porPeso.reduce((sum, m) => sum + (pesoEnGramos(m.cantidadTotal, m.unidad) || 0), 0);
  const middleEtapas = (receta.etapas || []).filter(e => !e.fija);

  return (
    <Modal open={open} onClose={onClose} showBack title={receta.nombre}>
      {!!maestros.length && (
        <div className="receta-detail-section">
          <h4 className="receta-detail-section-title">Ingredientes</h4>
          {pesoTotal > 0 && (
            <p className="receta-detail-peso-total">Peso total de la receta: <strong>{fmtPesoGramos(pesoTotal)}</strong></p>
          )}
          {porPeso.map((ing, i) => <IngRow key={`p${i}`} ing={ing} />)}
          {!!porUnidad.length && (
            <>
              <p className="receta-detail-subtitle">Por unidad</p>
              {porUnidad.map((ing, i) => <IngRow key={`u${i}`} ing={ing} />)}
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
