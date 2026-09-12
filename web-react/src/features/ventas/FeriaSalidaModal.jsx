import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { getFeriaSalidaTotal } from '../../services/feriasApi';
import './FeriaStockModal.css';

// Compartido por "Registrar venta" y "Registrar muestra" (arrField: 'ventas'
// o 'muestras') — misma grilla que el plan de stock (sabor / lote-disponible
// / cantidad con contador +/-), ver renderFeriaSalidaRows() en
// ../../../ferias.js. Los contadores siempre arrancan en 0 al abrir: cada
// venta/muestra se registra desde cero, sin arrastrar lo de una apertura
// anterior que se cerró sin guardar.
export default function FeriaSalidaModal({ open, onClose, feria, ejecuciones, arrField, title, fecha, onSave }) {
  const [cantidades, setCantidades] = useState({});
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open) return;
    setCantidades({});
  }, [open]);

  const isDirty = () => Object.values(cantidades).some(v => (v || 0) > 0);
  const close = useDirtyGuard(isDirty, onClose);

  if (!feria) return null;

  const plan = feria.planStock || {};
  const salidaTotal = getFeriaSalidaTotal(feria);
  const filas = Object.keys(plan)
    .map(id => ({ id, disponible: (plan[id] || 0) - (salidaTotal[id] || 0) }))
    .filter(row => row.disponible > 0);

  function adjust(id, max, delta) {
    setCantidades(c => ({ ...c, [id]: Math.max(0, Math.min(max, (c[id] || 0) + delta)) }));
  }

  async function handleSave() {
    const items = Object.entries(cantidades)
      .filter(([, cantidad]) => cantidad > 0)
      .map(([ejecucionId, cantidad]) => ({ ejecucionId, cantidad }));
    if (!items.length) return showFeedback('Ingresa al menos una cantidad.', 'err');
    setBusy(true);
    try {
      await onSave(feria.id, arrField, items, fecha);
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={title}>
      {!filas.length ? (
        <div className="obs-empty">No hay lotes con stock disponible.</div>
      ) : (
        <div className="feria-stock-list">
          {filas.map(row => {
            const ej = ejecuciones.find(x => x.id === row.id);
            const nombre = ej ? ej.nombreReceta : row.id;
            const lote = ej ? (ej.loteId || row.id.slice(0, 8)) : '';
            const val = cantidades[row.id] || 0;
            return (
              <div key={row.id} className="feria-stock-item">
                <div className="feria-stock-sabor">{nombre}</div>
                <div className="feria-stock-lote">{lote} · Disp. {row.disponible}</div>
                <div className="feria-venta-stepper">
                  <button type="button" className="feria-venta-stepper-btn" disabled={busy || val <= 0} onClick={() => adjust(row.id, row.disponible, -1)}>−</button>
                  <span className="feria-venta-stepper-value">{val}</span>
                  <button type="button" className="feria-venta-stepper-btn" disabled={busy || val >= row.disponible} onClick={() => adjust(row.id, row.disponible, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Button variant="primary" disabled={busy} onClick={handleSave} style={{ marginTop: 16 }}>
        {busy ? 'Guardando…' : 'Guardar'}
      </Button>
      <Feedback message={feedback.message} type={feedback.type} />
    </Modal>
  );
}
