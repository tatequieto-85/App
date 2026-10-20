import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick';
import { feriaToText, feriaTotalVendidoDinero, feriaPromedioUnidad, getFeriaDefaultDay } from '../../services/feriasApi';
import { fmtCOP, fmtDateShortEs, fmtDayMonthSlash } from '../../utils/format';
import FeriaObsModal from './FeriaObsModal';
import './FeriaResumenModal.css';

// Fila de una venta/muestra YA registrada — mantener presionada revela
// Borrar, a pedido explícito del usuario (antes no había forma de sacar
// una mal cargada, solo de agregar). Mismo patrón long-press que el resto
// de la app (ver regla 5 de convenciones de UI).
function SalidaRow({ item, onDelete }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useCloseOnOutsideClick(actionsOpen, () => setActionsOpen(false));
  const gestureProps = useRowGestures({ onLongPress: () => setActionsOpen(true) });

  async function handleDelete() {
    if (!window.confirm(`¿Borrar esta ${item.cantidad} unidad(es) de ${item.recetaNombre} del ${fmtDayMonthSlash(item.fecha)}?`)) return;
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusy(false);
      setActionsOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="feria-salida-row-wrap">
      <div className="feria-salida-row" {...gestureProps}>
        <span className="feria-salida-row-fecha">{fmtDayMonthSlash(item.fecha)}</span>
        <span className="feria-salida-row-nombre">{item.recetaNombre}</span>
        <span className="feria-salida-row-cantidad">{item.cantidad}</span>
      </div>
      {actionsOpen && (
        <div className="row-actions-bar feria-salida-row-actions">
          <button type="button" className="danger" disabled={busy} onClick={handleDelete}>{busy ? 'Borrando…' : 'Borrar'}</button>
        </div>
      )}
    </div>
  );
}

function SalidasLista({ titulo, items, onRemove }) {
  if (!items.length) return null;
  return (
    <div className="feria-section">
      <h4 className="feria-section-title">{titulo}</h4>
      <div className="feria-salidas-lista">
        {items.map((item, i) => (
          <SalidaRow key={i} item={item} onDelete={() => onRemove(i)} />
        ))}
      </div>
    </div>
  );
}

// Total vendido POR RECETA (sumando todas las unidades vendidas de ese
// sabor en toda la feria) — a pedido explícito del usuario, en vez de la
// tabla anterior desglosada por día.
function totalesPorReceta(ventas) {
  const map = new Map();
  (ventas || []).forEach(v => {
    const key = v.recetaId || v.recetaNombre;
    const prev = map.get(key);
    if (prev) prev.cantidad += v.cantidad;
    else map.set(key, { nombre: v.recetaNombre || 'Sin receta', cantidad: v.cantidad });
  });
  return [...map.values()].sort((a, b) => b.cantidad - a.cantidad);
}

function downloadFeriaTxt(feria, ejecuciones, contactoNombre) {
  const text = feriaToText(feria, ejecuciones, fmtCOP, fmtDateShortEs, contactoNombre);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `feria-${(feria.empresa || 'feria').replace(/[^a-z0-9]+/gi, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FeriaResumenModal({ open, onClose, feria, ejecuciones, contactos, onRemoveSalida, onAddObservacionDiaria }) {
  const [obsOpen, setObsOpen] = useState(false);
  if (!feria) return null;
  const contactoNombre = contactos?.find(c => c.id === feria.contactoId)?.nombre || '';
  const porReceta = totalesPorReceta(feria.ventas);

  return (
    <Modal open={open} onClose={onClose} showBack title={feria.empresa}>
      <div className="feria-resumen-content">{feriaToText(feria, ejecuciones, fmtCOP, fmtDateShortEs, contactoNombre)}</div>

      {!!porReceta.length && (
        <div className="feria-section">
          <h4 className="feria-section-title">
            Total vendido — {fmtCOP(feriaTotalVendidoDinero(feria))}
          </h4>
          <table className="tasks-table">
            <thead><tr><th>Receta</th><th>Unidades vendidas</th></tr></thead>
            <tbody>
              {porReceta.map(r => (
                <tr key={r.nombre}>
                  <td>{r.nombre}</td>
                  <td>{r.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="feria-resumen-promedio">Promedio por unidad: {fmtCOP(feriaPromedioUnidad(feria))}</p>
        </div>
      )}

      <SalidasLista
        titulo="Unidades vendidas por lote"
        items={feria.ventas || []}
        onRemove={i => onRemoveSalida(feria.id, 'ventas', i)}
      />
      <SalidasLista
        titulo="Muestras registradas"
        items={feria.muestras || []}
        onRemove={i => onRemoveSalida(feria.id, 'muestras', i)}
      />

      <Button type="button" variant="outline" onClick={() => setObsOpen(true)}>Agregar observación</Button>
      <Button variant="primary" onClick={() => downloadFeriaTxt(feria, ejecuciones, contactoNombre)}>Descargar resumen</Button>

      <FeriaObsModal
        open={obsOpen}
        onClose={() => setObsOpen(false)}
        feriaId={feria.id}
        fecha={getFeriaDefaultDay(feria)}
        onSave={onAddObservacionDiaria}
      />
    </Modal>
  );
}
