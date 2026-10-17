import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import TextField from '../../components/ui/TextField';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { getFeriaSalidaTotal } from '../../services/feriasApi';
import { calcularDescuento } from '../../services/descuentosApi';
import { fmtCOP } from '../../utils/format';
import './FeriaStockModal.css';

// "Registrar venta" ahora pide elegir un combo (ver catálogo en "Armar
// combos") y cuántos se vendieron — a pedido explícito del usuario: antes
// registraba solo cantidad por lote, sin precio. El combo fija precio y
// unidades totales; acá solo falta decir DE QUÉ lote(s) salen esas
// unidades (puede ser un solo sabor o repartido entre varios). "Registrar
// muestra" sigue en FeriaSalidaModal, sin cambios — las muestras no llevan
// precio.
export default function ComboVentaModal({ open, onClose, feria, ejecuciones, combos, descuentos, fecha, onSave }) {
  const combosFeria = useMemo(
    () => (combos || []).filter(c => (feria?.comboIds || []).includes(c.id)),
    [combos, feria]
  );
  const descuentosFeria = useMemo(
    () => (descuentos || []).filter(d => (feria?.descuentoIds || []).includes(d.id)),
    [descuentos, feria]
  );
  const [comboId, setComboId] = useState('');
  const [cantidadCombos, setCantidadCombos] = useState('1');
  const [descuentoId, setDescuentoId] = useState('');
  const [distribucion, setDistribucion] = useState({}); // { ejecucionId: cantidad }
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  useEffect(() => {
    if (!open) return;
    setComboId(combosFeria[0]?.id || '');
    setCantidadCombos('1');
    setDescuentoId('');
    setDistribucion({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isDirty = () => Object.values(distribucion).some(v => (v || 0) > 0);
  const close = useDirtyGuard(isDirty, onClose);

  if (!feria) return null;

  const combo = combosFeria.find(c => c.id === comboId);
  const cantNum = parseInt(cantidadCombos, 10) || 0;
  const totalEsperado = combo ? combo.unidades * cantNum : 0;
  const totalDistribuido = Object.values(distribucion).reduce((s, v) => s + (v || 0), 0);
  const subtotal = combo ? combo.precio * cantNum : 0;
  const descuentoSel = descuentoId ? descuentosFeria.find(d => d.id === descuentoId) : null;
  const descuentoMonto = calcularDescuento(descuentoSel, subtotal);
  const totalConDescuento = subtotal - descuentoMonto;

  const plan = feria.planStock || {};
  const salidaTotal = getFeriaSalidaTotal(feria);
  const filas = Object.keys(plan)
    .map(id => ({ id, disponible: (plan[id] || 0) - (salidaTotal[id] || 0) }))
    .filter(row => row.disponible > 0);

  function adjust(id, max, delta) {
    setDistribucion(d => ({ ...d, [id]: Math.max(0, Math.min(max, (d[id] || 0) + delta)) }));
  }

  async function handleSave() {
    if (!combo) return showFeedback('Elegí un combo.', 'err');
    if (!cantNum || cantNum <= 0) return showFeedback('La cantidad de combos debe ser mayor a 0.', 'err');
    if (totalDistribuido !== totalEsperado) {
      return showFeedback(`Te faltan distribuir ${totalEsperado - totalDistribuido} unidades.`, 'err');
    }
    const items = Object.entries(distribucion)
      .filter(([, cantidad]) => cantidad > 0)
      .map(([ejecucionId, cantidad]) => ({ ejecucionId, cantidad }));
    setBusy(true);
    try {
      await onSave(feria.id, combo.id, cantNum, items, fecha, descuentoId || null);
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title="Registrar venta">
      {!combosFeria.length ? (
        <div className="obs-empty">Esta feria no tiene combos habilitados — agregalos editando la feria.</div>
      ) : (
        <>
          <div className="field-row">
            <Select
              label="Combo" value={comboId}
              onChange={e => { setComboId(e.target.value); setDistribucion({}); }}
              disabled={busy}
              options={combosFeria.map(c => ({ value: c.id, label: `${c.nombre} — ${fmtCOP(c.precio)} (${c.unidades}u)` }))}
            />
            <TextField
              label="Cantidad vendida" type="number" min="1" step="1"
              value={cantidadCombos}
              onChange={e => { setCantidadCombos(e.target.value); setDistribucion({}); }}
              disabled={busy}
            />
          </div>

          {!!descuentosFeria.length && (
            <Select
              label="Descuento (opcional)" value={descuentoId}
              onChange={e => setDescuentoId(e.target.value)}
              disabled={busy}
              options={[
                { value: '', label: 'Ninguno' },
                ...descuentosFeria.map(d => ({ value: d.id, label: `${d.nombre} (${d.tipo === 'monto' ? fmtCOP(d.valor) : `${d.valor}%`})` }))
              ]}
            />
          )}

          {combo && (
            <p className="modal-contexto">
              {descuentoMonto > 0
                ? `Subtotal: ${fmtCOP(subtotal)} · Descuento: −${fmtCOP(descuentoMonto)} · Total: ${fmtCOP(totalConDescuento)}`
                : `Total: ${fmtCOP(subtotal)}`}
              {' · '}Distribuido {totalDistribuido} / {totalEsperado} unidades
            </p>
          )}

          {!filas.length ? (
            <div className="obs-empty">No hay lotes con stock disponible.</div>
          ) : (
            <div className="feria-stock-list">
              {filas.map(row => {
                const ej = ejecuciones.find(x => x.id === row.id);
                const nombre = ej ? ej.nombreReceta : row.id;
                const lote = ej ? (ej.loteId || row.id.slice(0, 8)) : '';
                const val = distribucion[row.id] || 0;
                const restante = totalEsperado - totalDistribuido;
                const max = Math.min(row.disponible, val + Math.max(0, restante));
                return (
                  <div key={row.id} className="feria-stock-item">
                    <div className="feria-stock-sabor">{nombre}</div>
                    <div className="feria-stock-lote">{lote} · Disp. {row.disponible}</div>
                    <div className="feria-venta-stepper">
                      <button type="button" className="feria-venta-stepper-btn" disabled={busy || val <= 0} onClick={() => adjust(row.id, max, -1)}>−</button>
                      <span className="feria-venta-stepper-value">{val}</span>
                      <button type="button" className="feria-venta-stepper-btn" disabled={busy || val >= max} onClick={() => adjust(row.id, max, 1)}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Button variant="primary" disabled={busy || !combo || totalDistribuido !== totalEsperado} onClick={handleSave} style={{ marginTop: 16 }}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      )}
      <Feedback message={feedback.message} type={feedback.type} />
    </Modal>
  );
}
