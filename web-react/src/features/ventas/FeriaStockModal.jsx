import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Feedback from '../../components/ui/Feedback';
import EmptyState from '../../components/ui/EmptyState';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { getStockDisponibleLote } from '../../services/feriasApi';
import { getProduccionPorMedidaLote } from '../../services/ejecucionesApi';
import './FeriaStockModal.css';

// Equivalente a openFeriaStockModal() en ../../../ferias.js — se abre en
// vez del conteo cuando la feria todavía no llegó a sus fechas: acá lo que
// hace falta es planificar cuánto stock llevar por lote, total para toda la
// feria (ya no por día).
export default function FeriaStockModal({ open, onClose, feria, ejecuciones, ctx, onSave }) {
  const [cantidades, setCantidades] = useState({});
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({});

  useEffect(() => {
    if (!open || !feria) return;
    const plan = { ...(feria.planStock || {}) };
    setCantidades(plan);
    initialRef.current = plan;
  }, [open, feria]);

  // Gap encontrado en la auditoría de confirmaciones: a diferencia de sus
  // hermanos (FeriaSalidaModal/FeriaObsModal/FeriaCierreModal/FeriaModal),
  // este modal no tenía useDirtyGuard — las cantidades planeadas se podían
  // perder sin avisar al cerrar. useDirtyGuard (como todo hook) tiene que
  // llamarse SIEMPRE, antes de cualquier return condicional — bug real
  // encontrado ("doble clic en una feria deja la página en blanco"):
  // ponerlo después de `if (!feria) return null;` lo saltea en el primer
  // render (feria null, modal cerrado) y lo ejecuta en el siguiente (feria
  // ya resuelta), lo que React trata como "Rendered more hooks than
  // during the previous render" y tira abajo toda la pantalla sin
  // Error Boundary que lo atrape.
  const isDirty = () => JSON.stringify(cantidades) !== JSON.stringify(initialRef.current);
  const close = useDirtyGuard(isDirty, onClose);

  if (!feria) return null;

  // Solo lotes YA terminados ("Guardar ejecución") — un lote todavía en
  // curso no tiene producción confirmada, así que no se puede planear para
  // una feria (bug real reportado por el usuario: "en la ejecución si aún
  // no pongo terminado me suma como si fuera terminado").
  const lotes = ejecuciones.filter(ej => getProduccionPorMedidaLote(ej).length);

  // Bug real reportado por el usuario ("me dice que no hay stock
  // suficiente, pero sí hay"): `cantidades` arranca precargado con TODO
  // `feria.planStock` (línea de arriba), que puede traer entradas de
  // lotes que ya no están en la lista visible (una ejecución editada o
  // borrada desde que se guardó el plan por última vez). Antes se
  // validaban TODAS las claves de `cantidades`, así que esas entradas
  // obsoletas (con "disponible 0" porque esa ejecución ya no existe)
  // bloqueaban el guardado entero aunque los lotes visibles tuvieran
  // stock de sobra. Ahora solo se guarda/valida lo que corresponde a un
  // lote ACTUALMENTE visible — cualquier entrada obsoleta se descarta
  // sola al guardar, en vez de perseguir para siempre.
  async function handleSave() {
    const newPlan = {};
    lotes.forEach(ej => {
      const qty = parseInt(cantidades[ej.id]) || 0;
      if (qty > 0) newPlan[ej.id] = qty;
    });
    if (!window.confirm('¿Confirmás guardar este plan de stock?')) return;
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
    <Modal open={open} onClose={close} showBack title={`Plan de stock — ${feria.empresa}`}>
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
