import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import ThousandsField from '../../components/ui/ThousandsField';
import EmptyState from '../../components/ui/EmptyState';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { getFeriaDateList } from '../../services/feriasApi';
import { fmtCOP, fmtDateShortEs, formatThousandsValue, parseThousandsInput } from '../../utils/format';
import './FeriaStockModal.css';
import './FeriaCierreModal.css';

// Reemplaza el registro venta-por-venta durante la feria — a pedido
// explícito del usuario ("no quiero registrar las ventas una a una"). Al
// terminar la feria se carga todo junto, pero DÍA POR DÍA ("quiero que
// registrar las ventas se hagan al día cuando cierre la feria") — por cada
// día de la feria, cuántas unidades de cada lote se vendieron ESE día +
// cuánto se recibió ESE día en CADA caja (efectivo, Nequi, etc. — "indicar
// cuánto recibió en efectivo y cuánto en las otras cajas"). El tope por
// lote es compartido entre todos los días (no se puede vender en total más
// de lo que se llevó, descontando lo que ya salió como muestra). El
// promedio por unidad no se pide — sale solo de dividir el total
// acumulado entre las unidades vendidas.
export default function FeriaCierreModal({ open, onClose, feria, ejecuciones, cajas, onSave }) {
  const [porDia, setPorDia] = useState({}); // { fecha: { cantidades: {id:qty}, montos: {cajaId: string} } }
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();

  const dias = feria ? getFeriaDateList(feria) : [];

  useEffect(() => {
    if (!open || !feria) return;
    // Si la feria ya se había cerrado antes (reabrir y volver a cerrar), se
    // precarga lo que ya había en vez de arrancar de cero.
    const inicial = {};
    dias.forEach(fecha => { inicial[fecha] = { cantidades: {}, montos: {} }; });
    (feria.ventas || []).forEach(v => {
      if (!inicial[v.fecha]) inicial[v.fecha] = { cantidades: {}, montos: {} };
      inicial[v.fecha].cantidades[v.ejecucionId] = (inicial[v.fecha].cantidades[v.ejecucionId] || 0) + v.cantidad;
    });
    (feria.ventasDiarias || []).forEach(vd => {
      if (!inicial[vd.fecha]) inicial[vd.fecha] = { cantidades: {}, montos: {} };
      Object.entries(vd.porCaja || {}).forEach(([cajaId, monto]) => {
        inicial[vd.fecha].montos[cajaId] = formatThousandsValue(monto);
      });
    });
    setPorDia(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, feria?.id]);

  const isDirty = () => Object.values(porDia).some(d =>
    Object.values(d.montos || {}).some(v => !!v) || Object.values(d.cantidades || {}).some(v => v > 0)
  );
  const close = useDirtyGuard(isDirty, onClose);

  if (!feria) return null;

  const plan = feria.planStock || {};
  const lotes = Object.keys(plan).filter(id => plan[id] > 0);

  // Cuánto de cada lote ya salió como muestra (gratis) — sale del mismo
  // stock llevado, así que también hay que descontarlo del tope de
  // unidades VENDIDAS. Bug real reportado por el usuario: el tope dejaba
  // marcar como vendido hasta lo llevado entero, ignorando las muestras ya
  // entregadas (podía quedar "vendidos + muestras" por encima de lo
  // llevado).
  function muestrasDelLote(loteId) {
    return (feria.muestras || []).filter(m => m.ejecucionId === loteId).reduce((s, m) => s + (m.cantidad || 0), 0);
  }

  // Total ya asignado a un lote en TODOS los días salvo el que se pasa —
  // el tope de cada stepper tiene que descontar lo que ya se cargó en los
  // demás días, porque el stock llevado es uno solo para toda la feria.
  function asignadoEnOtrosDias(loteId, fechaActual) {
    return Object.entries(porDia).reduce((sum, [fecha, d]) => {
      if (fecha === fechaActual) return sum;
      return sum + (d.cantidades?.[loteId] || 0);
    }, 0);
  }

  function adjust(fecha, loteId, max, delta) {
    setPorDia(p => {
      const dia = p[fecha] || { cantidades: {}, montos: {} };
      const actual = dia.cantidades[loteId] || 0;
      const nuevo = Math.max(0, Math.min(max, actual + delta));
      return { ...p, [fecha]: { ...dia, cantidades: { ...dia.cantidades, [loteId]: nuevo } } };
    });
  }

  function setMontoCaja(fecha, cajaId, value) {
    setPorDia(p => {
      const dia = p[fecha] || { cantidades: {}, montos: {} };
      return { ...p, [fecha]: { ...dia, montos: { ...dia.montos, [cajaId]: value } } };
    });
  }

  const totalUnidades = Object.values(porDia).reduce(
    (s, d) => s + Object.values(d.cantidades || {}).reduce((s2, v) => s2 + (v || 0), 0), 0
  );
  const totalRecibido = Object.values(porDia).reduce(
    (s, d) => s + Object.values(d.montos || {}).reduce((s2, v) => s2 + (parseThousandsInput(v) || 0), 0), 0
  );
  const promedio = totalUnidades > 0 ? totalRecibido / totalUnidades : 0;

  async function handleSave() {
    if (!totalUnidades) return showFeedback('Cargá al menos una unidad vendida.', 'err');
    if (!totalRecibido) return showFeedback('Cargá cuánto recibiste en al menos una caja.', 'err');
    if (!window.confirm('¿Confirmás terminar la feria con estas ventas? No se puede deshacer fácilmente.')) return;
    const ventasPorDia = {};
    Object.entries(porDia).forEach(([fecha, d]) => {
      const porCaja = {};
      Object.entries(d.montos || {}).forEach(([cajaId, v]) => {
        const num = parseThousandsInput(v) || 0;
        if (num > 0) porCaja[cajaId] = num;
      });
      ventasPorDia[fecha] = { cantidades: d.cantidades || {}, porCaja };
    });
    setBusy(true);
    try {
      await onSave(feria.id, ventasPorDia);
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title="Terminar feria">
      {!(cajas || []).length ? (
        <EmptyState>Creá al menos una caja en Contabilidad (Efectivo, Nequi…) antes de cerrar una feria.</EmptyState>
      ) : !lotes.length ? (
        <EmptyState>No hay stock planeado para esta feria.</EmptyState>
      ) : !dias.length ? (
        <EmptyState>Esta feria no tiene fechas válidas.</EmptyState>
      ) : (
        dias.map(fecha => {
          const dia = porDia[fecha] || { cantidades: {}, montos: {} };
          return (
            <section key={fecha} className="cierre-dia-section">
              <h4 className="feria-section-title">{fmtDateShortEs(fecha)}</h4>
              <div className="feria-stock-list">
                {lotes.map(id => {
                  const ej = ejecuciones.find(x => x.id === id);
                  const nombre = ej ? ej.nombreReceta : id;
                  const lote = ej ? (ej.loteId || id.slice(0, 8)) : '';
                  const val = dia.cantidades[id] || 0;
                  const muestras = muestrasDelLote(id);
                  const max = Math.max(0, plan[id] - muestras - asignadoEnOtrosDias(id, fecha));
                  return (
                    <div key={id} className="feria-stock-item">
                      <div className="feria-stock-sabor">{nombre}</div>
                      <div className="feria-stock-lote">
                        {lote} · Llevados {plan[id]}{muestras > 0 ? ` · Muestras ${muestras}` : ''}
                      </div>
                      <div className="feria-venta-stepper">
                        <button type="button" className="feria-venta-stepper-btn" disabled={busy || val <= 0} onClick={() => adjust(fecha, id, max, -1)}>−</button>
                        <span className="feria-venta-stepper-value">{val}</span>
                        <button type="button" className="feria-venta-stepper-btn" disabled={busy || val >= max} onClick={() => adjust(fecha, id, max, 1)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="cierre-cajas-row">
                {cajas.map(caja => (
                  <ThousandsField
                    key={caja.id}
                    label={caja.nombre} placeholder="0"
                    value={dia.montos[caja.id] || ''} onChange={v => setMontoCaja(fecha, caja.id, v)} disabled={busy}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      <p className="modal-contexto">
        {totalUnidades} unidad{totalUnidades === 1 ? '' : 'es'} vendida{totalUnidades === 1 ? '' : 's'} en total
        {totalUnidades > 0 && totalRecibido > 0 ? ` · Total ${fmtCOP(totalRecibido)} · Promedio por unidad: ${fmtCOP(promedio)}` : ''}
      </p>

      <Button variant="primary" disabled={busy} onClick={handleSave} style={{ marginTop: 16 }}>
        {busy ? 'Guardando…' : 'Terminar feria'}
      </Button>
      <Feedback message={feedback.message} type={feedback.type} />
    </Modal>
  );
}
