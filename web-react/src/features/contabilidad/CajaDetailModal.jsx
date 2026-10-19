import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import MovimientoRow from './MovimientoRow';
import MovimientoModal from './MovimientoModal';
import { fmtCOP } from '../../utils/format';
import './CajaDetailModal.css';

// Detalle de una caja: saldo total arriba, lista de movimientos (más
// reciente primero) abajo, con un botón para cargar uno manual nuevo.
export default function CajaDetailModal({ open, onClose, caja, movimientos, saldo, onAddMovimiento, onRemoveMovimiento }) {
  const [movModalOpen, setMovModalOpen] = useState(false);
  if (!caja) return null;

  const propios = movimientos
    .filter(m => m.cajaId === caja.id)
    .slice()
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creadoEn || '').localeCompare(a.creadoEn || ''));

  return (
    <Modal open={open} onClose={onClose} showBack title={caja.nombre}>
      <div className={`caja-detail-saldo ${saldo < 0 ? 'caja-detail-saldo--neg' : 'caja-detail-saldo--pos'}`}>
        {fmtCOP(saldo)}
      </div>

      <Button type="button" variant="outline" onClick={() => setMovModalOpen(true)} style={{ marginBottom: 12 }}>
        Nuevo movimiento
      </Button>

      {!propios.length ? (
        <EmptyState>Sin movimientos todavía.</EmptyState>
      ) : (
        <div className="caja-movimientos-lista">
          {propios.map(m => (
            <MovimientoRow key={m.id} item={m} onDelete={() => onRemoveMovimiento(m.id)} />
          ))}
        </div>
      )}

      <MovimientoModal
        open={movModalOpen}
        onClose={() => setMovModalOpen(false)}
        caja={caja}
        onSave={onAddMovimiento}
      />
    </Modal>
  );
}
