import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import ThousandsField from '../../components/ui/ThousandsField';
import EmptyState from '../../components/ui/EmptyState';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { fmtCOP, formatThousandsValue, parseThousandsInput } from '../../utils/format';
import './FeriaStockModal.css';

// Reemplaza el registro venta-por-venta durante la feria — a pedido
// explícito del usuario ("no quiero registrar las ventas una a una"). Al
// terminar la feria se carga todo junto: cuántas unidades se vendieron de
// cada lote (hace falta saber de qué lote salió cada una, para el stock) y
// el total de dinero recibido en TODA la feria. El promedio por unidad no
// se pide — sale solo de dividir esos dos números.
export default function FeriaCierreModal({ open, onClose, feria, ejecuciones, onSave }) {
  const [cantidades, setCantidades] = useState({});
  const [totalRecibido, setTotalRecibido] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open || !feria) return;
    // Si la feria ya se había cerrado antes (reabrir y volver a cerrar), se
    // precarga lo que ya había en vez de arrancar de cero.
    const prev = {};
    (feria.ventas || []).forEach(v => { prev[v.ejecucionId] = (prev[v.ejecucionId] || 0) + v.cantidad; });
    setCantidades(prev);
    setTotalRecibido(feria.ventaTotalRecibido ? formatThousandsValue(feria.ventaTotalRecibido) : '');
  }, [open, feria]);

  const isDirty = () => Object.values(cantidades).some(v => (v || 0) > 0) || !!totalRecibido;
  const close = useDirtyGuard(isDirty, onClose);

  if (!feria) return null;

  const plan = feria.planStock || {};
  const lotes = Object.keys(plan).filter(id => plan[id] > 0);
  const totalUnidades = Object.values(cantidades).reduce((s, v) => s + (v || 0), 0);
  const totalNum = parseThousandsInput(totalRecibido) || 0;
  const promedio = totalUnidades > 0 ? totalNum / totalUnidades : 0;

  function adjust(id, max, delta) {
    setCantidades(c => ({ ...c, [id]: Math.max(0, Math.min(max, (c[id] || 0) + delta)) }));
  }

  async function handleSave() {
    if (!totalUnidades) return showFeedback('Cargá al menos una unidad vendida.', 'err');
    if (!totalNum || totalNum <= 0) return showFeedback('Cargá el total recibido.', 'err');
    setBusy(true);
    try {
      await onSave(feria.id, cantidades, totalNum);
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title="Terminar feria">
      {!lotes.length ? (
        <EmptyState>No hay stock planeado para esta feria.</EmptyState>
      ) : (
        <div className="feria-stock-list">
          {lotes.map(id => {
            const ej = ejecuciones.find(x => x.id === id);
            const nombre = ej ? ej.nombreReceta : id;
            const lote = ej ? (ej.loteId || id.slice(0, 8)) : '';
            const val = cantidades[id] || 0;
            const max = plan[id];
            return (
              <div key={id} className="feria-stock-item">
                <div className="feria-stock-sabor">{nombre}</div>
                <div className="feria-stock-lote">{lote} · Llevados {max}</div>
                <div className="feria-venta-stepper">
                  <button type="button" className="feria-venta-stepper-btn" disabled={busy || val <= 0} onClick={() => adjust(id, max, -1)}>−</button>
                  <span className="feria-venta-stepper-value">{val}</span>
                  <button type="button" className="feria-venta-stepper-btn" disabled={busy || val >= max} onClick={() => adjust(id, max, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ThousandsField
        label="Total recibido en toda la feria" placeholder="0"
        value={totalRecibido} onChange={setTotalRecibido} disabled={busy}
      />

      <p className="modal-contexto">
        {totalUnidades} unidad{totalUnidades === 1 ? '' : 'es'} vendida{totalUnidades === 1 ? '' : 's'}
        {totalUnidades > 0 && totalNum > 0 ? ` · Promedio por unidad: ${fmtCOP(promedio)}` : ''}
      </p>

      <Button variant="primary" disabled={busy} onClick={handleSave} style={{ marginTop: 16 }}>
        {busy ? 'Guardando…' : 'Terminar feria'}
      </Button>
      <Feedback message={feedback.message} type={feedback.type} />
    </Modal>
  );
}
