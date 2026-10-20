import { useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../../components/ui/EmptyState';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import PageHeader from '../../components/layout/PageHeader';
import Tabs from '../../components/ui/Tabs';
import { useContabilidad } from './useContabilidad';
import CajaCard from './CajaCard';
import CajaModal from './CajaModal';
import CajaDetailModal from './CajaDetailModal';
import MovimientoRow from './MovimientoRow';
import { fmtCOP } from '../../utils/format';
import './ContabilidadPage.css';

const TABS = [
  { id: 'cajas', label: 'Cajas' },
  { id: 'resumen', label: 'Resumen por canal' }
];

// Dos vistas tipo tarjeta, a pedido explícito del usuario: "Cajas" (estado
// ingreso/egreso de cada una, creadas a mano) y "Resumen de ventas por
// canal" (solo lectura, lee Ferias/CanalesVenta — ver useContabilidad.js).
export default function ContabilidadPage({ onBack }) {
  const ct = useContabilidad();
  const [tab, setTab] = useState('cajas');
  const [cajaModal, setCajaModal] = useState(null); // { editing } | null
  const [cajaActionsFor, setCajaActionsFor] = useState(null);
  const [detailCajaId, setDetailCajaId] = useState(null);

  const detailCaja = detailCajaId ? ct.cajas.find(c => c.id === detailCajaId) : null;
  const nombreCaja = cajaId => ct.cajas.find(c => c.id === cajaId)?.nombre || 'Caja borrada';

  // Todos los movimientos de todas las cajas juntos, más reciente primero
  // — a pedido explícito del usuario ("debajo de las cajas, el resumen de
  // los movimientos"), para ver de un vistazo qué pasó sin entrar caja por
  // caja. El concepto ya trae de dónde salió cada uno (venta de una feria,
  // egreso de una compra, o lo que haya escrito el usuario a mano).
  const movimientosOrdenados = ct.movimientos.slice().sort((a, b) =>
    (b.fecha || '').localeCompare(a.fecha || '') || (b.creadoEn || '').localeCompare(a.creadoEn || '')
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <PageHeader title="Contabilidad" onBack={onBack} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {ct.loading && <div className="loading-state">Cargando…</div>}
      {ct.error && <EmptyState>No se pudo cargar: {ct.error}</EmptyState>}

      {!ct.loading && !ct.error && tab === 'cajas' && (
        !ct.cajas.length ? (
          <EmptyState>Agregá tu primera caja con el botón de abajo.</EmptyState>
        ) : (
          <>
            <div className="cajas-list">
              {ct.cajas.map(caja => (
                <CajaCard
                  key={caja.id}
                  caja={caja}
                  saldo={ct.saldoCaja(caja.id)}
                  actionsOpen={cajaActionsFor === caja.id}
                  onOpenActionsChange={setCajaActionsFor}
                  onAbrir={setDetailCajaId}
                  onEdit={c => setCajaModal({ editing: c })}
                  onDelete={ct.deleteCaja}
                />
              ))}
            </div>

            <div className="movimientos-resumen-section">
              <h2 className="subsection-title">Resumen de movimientos</h2>
              {!movimientosOrdenados.length ? (
                <EmptyState>Todavía no hay movimientos.</EmptyState>
              ) : (
                <div className="movimientos-resumen-lista">
                  {movimientosOrdenados.map(m => (
                    <MovimientoRow
                      key={m.id}
                      item={m}
                      cajaNombre={nombreCaja(m.cajaId)}
                      onDelete={() => ct.removeMovimiento(m.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )
      )}

      {!ct.loading && !ct.error && tab === 'resumen' && (
        !ct.resumenPorCanal.length ? (
          <EmptyState>Todavía no hay canales de venta.</EmptyState>
        ) : (
          <table className="resumen-canal-table">
            <thead><tr><th>Canal</th><th>Total vendido</th></tr></thead>
            <tbody>
              {ct.resumenPorCanal.map(({ canal, total }) => (
                <tr key={canal.id}>
                  <td>{canal.nombre}</td>
                  <td>{fmtCOP(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'cajas' && (
        <FabButton onClick={() => setCajaModal({ editing: null })}>
          <Icon name="plus" size={16} /> Nueva caja
        </FabButton>
      )}

      <CajaModal
        open={!!cajaModal}
        onClose={() => setCajaModal(null)}
        editingCaja={cajaModal?.editing || null}
        onSave={ct.saveCaja}
      />

      <CajaDetailModal
        open={!!detailCaja}
        onClose={() => setDetailCajaId(null)}
        caja={detailCaja}
        movimientos={ct.movimientos}
        saldo={detailCaja ? ct.saldoCaja(detailCaja.id) : 0}
        onAddMovimiento={ct.addMovimiento}
        onRemoveMovimiento={ct.removeMovimiento}
      />
    </motion.div>
  );
}
