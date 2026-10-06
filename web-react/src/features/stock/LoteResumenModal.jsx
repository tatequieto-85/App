import Modal from '../../components/ui/Modal';
import { fmtCOP, fmtDayMonthYearShort } from '../../utils/format';
import { fmtPesoGramos } from '../../services/recetasApi';
import { getFechaVencimientoLote } from '../../services/stockApi';
import './LoteResumenModal.css';

// Se abre al tocar una fila de Trazabilidad — a pedido explícito del
// usuario: fecha, precio de CADA FRASCO (distinto según su tamaño — un
// frasco de 230 ml cuesta más que uno de 130 ml de la misma tanda, 1 ml
// ≈ 1 g) y precio total del lote. precio230/precio130/merma ya vienen
// resueltos en trazabilidadRows (ver getPrecioFrascosLote en
// stockApi.js): el costo del lote se reparte sobre lo EFECTIVAMENTE
// envasado, no sobre el peso total planeado de la receta — la merma
// (lo que se perdió en el proceso, nunca llegó a un frasco) se muestra
// aparte, informativa.
export default function LoteResumenModal({ open, onClose, row }) {
  if (!row) return null;
  const { ejecucion: ej, costoLote, pesoTotalLote, precio230, precio130, merma } = row;
  const ev = ej.evaluacion || {};
  const frascos230 = ev.frascos230 || 0;
  const frascos130 = ev.frascos130 || 0;

  return (
    <Modal open={open} onClose={onClose} showBack title={ej.nombreReceta}>
      <p className="modal-contexto">Lote {ej.loteId || ej.id.slice(0, 8)}</p>

      <div className="lote-resumen-grid">
        <div className="lote-resumen-item">
          <span className="lote-resumen-label">Fecha</span>
          <span className="lote-resumen-valor">{fmtDayMonthYearShort(ej.fechaFin || ej.fechaInicio) || '—'}</span>
        </div>
        <div className="lote-resumen-item">
          <span className="lote-resumen-label">Vencimiento</span>
          <span className="lote-resumen-valor">{fmtDayMonthYearShort(getFechaVencimientoLote(ej)) || '—'}</span>
        </div>
        <div className="lote-resumen-item">
          <span className="lote-resumen-label">Frascos 230 ml</span>
          <span className="lote-resumen-valor">{frascos230}</span>
        </div>
        <div className="lote-resumen-item">
          <span className="lote-resumen-label">Frascos 130 ml</span>
          <span className="lote-resumen-valor">{frascos130}</span>
        </div>
        <div className="lote-resumen-item">
          <span className="lote-resumen-label">Precio frasco 230 ml</span>
          <span className="lote-resumen-valor">{fmtCOP(precio230)}</span>
        </div>
        <div className="lote-resumen-item">
          <span className="lote-resumen-label">Precio frasco 130 ml</span>
          <span className="lote-resumen-valor">{fmtCOP(precio130)}</span>
        </div>
        {pesoTotalLote > 0 && (
          <>
            <div className="lote-resumen-item">
              <span className="lote-resumen-label">Peso total de la receta</span>
              <span className="lote-resumen-valor">{fmtPesoGramos(pesoTotalLote)}</span>
            </div>
            <div className="lote-resumen-item">
              <span className="lote-resumen-label">Merma</span>
              <span className="lote-resumen-valor">{merma != null ? fmtPesoGramos(merma) : '—'}</span>
            </div>
          </>
        )}
        <div className="lote-resumen-item lote-resumen-item--full">
          <span className="lote-resumen-label">Precio total del lote</span>
          <span className="lote-resumen-valor lote-resumen-valor--total">{fmtCOP(costoLote)}</span>
        </div>
      </div>
    </Modal>
  );
}
