import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Feedback from '../../components/ui/Feedback';
import EmptyState from '../../components/ui/EmptyState';
import { useFeedback } from '../../hooks/useFeedback';
import { getStockDisponibleLote } from '../../services/feriasApi';
import './FeriaStockModal.css';

// Equivalente a openFeriaStockModal() en ../../../ferias.js — se abre en
// vez del conteo cuando la feria todavía no llegó a sus fechas: acá lo que
// hace falta es planificar cuánto stock llevar por lote, total para toda la
// feria (ya no por día).
export default function FeriaStockModal({ open, onClose, feria, ejecuciones, ctx, onSave }) {
  const [cantidades, setCantidades] = useState({});
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open || !feria) return;
    setCantidades({ ...(feria.planStock || {}) });
  }, [open, feria]);

  if (!feria) return null;

  const lotes = ejecuciones.filter(ej => (ej.evaluacion?.frascos230 || ej.evaluacion?.frascos180));

  async function handleSave() {
    const newPlan = {};
    Object.entries(cantidades).forEach(([id, val]) => {
      const qty = parseInt(val) || 0;
      if (qty > 0) newPlan[id] = qty;
    });
    setBusy(true);
    try {
      await onSave(feria.id, newPlan);
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} showBack title={`Plan de stock — ${feria.empresa}`}>
      {!lotes.length ? (
        <EmptyState>No hay lotes con producción registrada en Procesos → Ejecuciones.</EmptyState>
      ) : (
        <div className="feria-stock-list">
          {lotes.map(ej => {
            const disponible = getStockDisponibleLote(ctx, ej.id, feria.id);
            return (
              <div key={ej.id} className="feria-stock-item">
                <div className="feria-stock-sabor">{ej.nombreReceta}</div>
                <div className="feria-stock-lote">{ej.loteId || ej.id.slice(0, 8)} · Disp. {disponible}</div>
                <input
                  type="number" min="0" step="1" className="field-input feria-stock-input"
                  placeholder="Cantidad" disabled={busy}
                  value={cantidades[ej.id] ?? ''}
                  onChange={e => setCantidades(c => ({ ...c, [ej.id]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>
      )}
      <Button variant="primary" disabled={busy} onClick={handleSave} style={{ marginTop: 16 }}>
        {busy ? 'Guardando…' : 'Guardar plan'}
      </Button>
      <Feedback message={feedback.message} type={feedback.type} />
    </Modal>
  );
}
