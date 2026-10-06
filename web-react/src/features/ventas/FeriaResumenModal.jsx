import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Icon from '../../components/icons/Icon';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick';
import { feriaToText } from '../../services/feriasApi';
import { fmtCOP, fmtDateShortEs, fmtDayMonthSlash } from '../../utils/format';
import './FeriaResumenModal.css';

// Se muestra en vez del conteo una vez que la feria ya pasó por calendario
// (o se cerró a mano con "Terminar feria") — equivalente a openFeriaResumen()
// en ../../../ferias.js. Sobrantes = llevados - vendidos - muestras, nunca
// se pregunta a mano.
function ConteoProductos({ feria, ejecuciones }) {
  const plan = feria.planStock || {};
  const ids = Object.keys(plan).filter(id => plan[id] > 0);
  if (!ids.length) return <p className="empty-state" style={{ padding: '8px 0' }}>No hay stock planeado para esta feria.</p>;

  let hayNegativos = false;
  const filas = ids.map(id => {
    const ej = ejecuciones.find(e => e.id === id);
    const label = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
    const llevados = plan[id];
    const vendidos = (feria.ventas || []).filter(v => v.ejecucionId === id).reduce((s, v) => s + v.cantidad, 0);
    const muestras = (feria.muestras || []).filter(m => m.ejecucionId === id).reduce((s, m) => s + m.cantidad, 0);
    const sobrantes = llevados - vendidos - muestras;
    if (sobrantes < 0) hayNegativos = true;
    return { id, label, llevados, vendidos, muestras, sobrantes };
  });

  return (
    <>
      <table className="tasks-table">
        <thead><tr><th>Lote</th><th>Llevados</th><th>Vendidos</th><th>Muestras</th><th>Sobrantes</th></tr></thead>
        <tbody>
          {filas.map(f => (
            <tr key={f.id}>
              <td>{f.label}</td><td>{f.llevados}</td><td>{f.vendidos}</td><td>{f.muestras}</td><td>{f.sobrantes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hayNegativos && (
        <div className="feria-resumen-warn"><Icon name="alertTriangle" size={13} /> Hay lotes con más vendido + regalado que lo llevado — revisa el registro de ventas/muestras.</div>
      )}
    </>
  );
}

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

export default function FeriaResumenModal({ open, onClose, feria, ejecuciones, contactos, onRemoveSalida }) {
  if (!feria) return null;
  const contactoNombre = contactos?.find(c => c.id === feria.contactoId)?.nombre || '';

  return (
    <Modal open={open} onClose={onClose} showBack title={feria.empresa}>
      <div className="feria-resumen-content">{feriaToText(feria, ejecuciones, fmtCOP, fmtDateShortEs, contactoNombre)}</div>

      <div className="feria-section">
        <h4 className="feria-section-title">Conteo de productos</h4>
        <ConteoProductos feria={feria} ejecuciones={ejecuciones} />
      </div>

      <SalidasLista
        titulo="Ventas registradas"
        items={feria.ventas || []}
        onRemove={i => onRemoveSalida(feria.id, 'ventas', i)}
      />
      <SalidasLista
        titulo="Muestras registradas"
        items={feria.muestras || []}
        onRemove={i => onRemoveSalida(feria.id, 'muestras', i)}
      />

      <Button variant="primary" onClick={() => downloadFeriaTxt(feria, ejecuciones, contactoNombre)}>Descargar resumen</Button>
    </Modal>
  );
}
