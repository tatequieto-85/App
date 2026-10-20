import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRowGestures } from '../../hooks/useRowGestures';
import { fmtCOP } from '../../utils/format';
import './CajaCard.css';

// "ventas" ya no es una fuente automática (ver FUENTE_AUTOMATICA_OPCIONES
// en contabilidadApi.js) — el ingreso de cada venta se reparte directo
// entre las cajas al cerrar la feria, no hace falta elegir una caja fija.
const FUENTE_LABEL = { compras: 'Automático — Compras' };

// Tarjeta de una caja — "allí me va a mostrar el estado de mis cajas
// Ingreso/Egreso" (pedido explícito del usuario): saldo grande, verde si es
// positivo y rojo si quedó en rojo. Ya no abre un detalle propio al
// tocarla (se sacó esa ventana a pedido del usuario — los movimientos se
// ven todos juntos en el resumen de abajo, ver ContabilidadPage.jsx);
// mantener presionada sigue revelando Editar/Eliminar, mismo patrón que
// el resto de la app.
export default function CajaCard({ caja, saldo, actionsOpen, onOpenActionsChange, onEdit, onDelete }) {
  const [busy, setBusy] = useState(false);
  const gestureProps = useRowGestures({
    onLongPress: () => onOpenActionsChange(caja.id)
  });

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar la caja "${caja.nombre}"? También se borran sus movimientos.`)) return;
    setBusy(true);
    try {
      await onDelete(caja.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="caja-card-wrap">
      <div className="caja-card" {...gestureProps}>
        <div className="caja-card-main">
          <div className="caja-card-title">{caja.nombre}</div>
          {FUENTE_LABEL[caja.fuenteAutomatica] && (
            <div className="caja-card-meta">{FUENTE_LABEL[caja.fuenteAutomatica]}</div>
          )}
        </div>
        <span className={`caja-card-saldo ${saldo < 0 ? 'caja-card-saldo--neg' : 'caja-card-saldo--pos'}`}>
          {fmtCOP(saldo)}
        </span>
      </div>
      <AnimatePresence initial={false}>
        {actionsOpen && (
          <motion.div
            className="row-actions-bar"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}
          >
            <button type="button" onClick={() => { onOpenActionsChange(null); onEdit(caja); }}>Editar</button>
            <button type="button" className="danger" disabled={busy} onClick={handleDelete}>Eliminar</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
