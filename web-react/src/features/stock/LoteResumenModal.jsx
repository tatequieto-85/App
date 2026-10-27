import Modal from '../../components/ui/Modal';
import { fmtCOP, fmtDayMonthYearShort } from '../../utils/format';
import { fmtPesoGramos } from '../../services/recetasApi';
import { getFechaVencimientoLote } from '../../services/stockApi';
import './LoteResumenModal.css';

// Se abre al tocar una fila de Trazabilidad — a pedido explícito del
// usuario: fecha, precio de CADA MEDIDA (distinto según su tamaño — un
// frasco de 230 g cuesta más que uno de 130 g de la misma tanda, 1 ml ≈
// 1 g) y precio total del lote. `row.items` ya viene resuelto desde
// useStock.js (ver getProduccionPorMedidaLote/getPrecioPorMedida en
// stockApi.js — generalizado a N medidas, antes fijo a 230/130): el
// costo del lote se reparte sobre lo EFECTIVAMENTE envasado, no sobre el
// peso total planeado de la receta — la merma (lo que se perdió en el
// proceso, nunca llegó a un frasco) se muestra aparte, informativa.
export default function LoteResumenModal({ open, onClose, row }) {
  if (!row) return null;
  const { ejecucion: ej, costoLote, pesoTotalLote, items, merma } = row;

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
        {items.map((i, idx) => (
          <div key={idx} className="lote-resumen-item">
            <span className="lote-resumen-label">{i.nombre}</span>
            <span className="lote-resumen-valor">{i.cantidad} · {fmtCOP(i.precioUnidad)} c/u</span>
          </div>
        ))}
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
