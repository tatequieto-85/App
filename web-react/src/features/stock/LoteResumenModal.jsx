import Modal from '../../components/ui/Modal';
import { fmtCOP, fmtDayMonthYearShort } from '../../utils/format';
import { getFechaVencimientoLote } from '../../services/stockApi';
import './LoteResumenModal.css';

// Se abre al tocar una fila de Trazabilidad — a pedido explícito del
// usuario: fecha, precio de cada frasco y precio total del lote. El
// precio por frasco es uno solo (no distinto por tamaño): sale del mismo
// costo total del lote, repartido entre TODOS los frascos obtenidos —
// no hay una base real para costear distinto un frasco de 230 ml que uno
// de 130 ml de la misma tanda.
export default function LoteResumenModal({ open, onClose, row }) {
  if (!row) return null;
  const { ejecucion: ej, resumen, costoLote } = row;
  const ev = ej.evaluacion || {};
  const frascos230 = ev.frascos230 || 0;
  const frascos130 = ev.frascos130 || 0;
  const totalFrascos = resumen?.producido || 0;
  const precioPorFrasco = totalFrascos > 0 ? costoLote / totalFrascos : 0;

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
          <span className="lote-resumen-label">Precio por frasco</span>
          <span className="lote-resumen-valor">{fmtCOP(precioPorFrasco)}</span>
        </div>
        <div className="lote-resumen-item">
          <span className="lote-resumen-label">Precio total del lote</span>
          <span className="lote-resumen-valor lote-resumen-valor--total">{fmtCOP(costoLote)}</span>
        </div>
      </div>
    </Modal>
  );
}
