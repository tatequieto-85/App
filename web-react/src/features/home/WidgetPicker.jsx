import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/icons/Icon';
import './WidgetPicker.css';

// Modal simple de alta rápida (elegir un widget de la lista) — sin flecha de
// volver, se cierra tocando afuera, mismo criterio que InsumoModal.
export default function WidgetPicker({ open, onClose, available, onPick }) {
  return (
    <Modal open={open} onClose={onClose} title="Agregar widget">
      {available.length ? (
        available.map(w => (
          <button key={w.id} type="button" className="widget-picker-item" onClick={() => { onPick(w.id); onClose(); }}>
            <span className="widget-picker-icon"><Icon name={w.icon} size={16} /></span>
            {w.label}
          </button>
        ))
      ) : (
        <EmptyState>Ya agregaste todos los widgets disponibles.</EmptyState>
      )}
    </Modal>
  );
}
