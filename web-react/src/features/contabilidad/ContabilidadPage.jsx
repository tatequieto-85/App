import { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import PageHeader from '../../components/layout/PageHeader';
import { useContabilidad } from './useContabilidad';
import { useIngredientes } from '../ingredientes/useIngredientes';
import { useCompras } from '../compras/useCompras';
import { getUnitPrice } from '../../services/comprasApi';
import CajaCard from './CajaCard';
import CajaModal from './CajaModal';
import MovimientoModal from './MovimientoModal';
import MovimientoRow from './MovimientoRow';
import CompraModal from '../compras/CompraModal';
import './ContabilidadPage.css';

// "Cajas" (estado ingreso/egreso de cada una, creadas a mano). El
// "Resumen de ventas por canal" que vivía acá en una segunda pestaña se
// sacó a pedido explícito del usuario — esa agrupación pasó a vivir en
// Ventas mismo. Las cajas ya no abren un detalle propio al tocarlas (se
// sacó esa ventana a pedido del usuario) — crear una es una acción
// secundaria (botón chico junto al título), y la acción principal (el
// FAB) pasa a ser cargar un movimiento nuevo, que ahora puede ser
// ingreso, egreso o transferencia entre cajas (ver MovimientoModal.jsx).
// Todo lo que pasó se ve junto en el resumen de movimientos de abajo.
export default function ContabilidadPage({ onBack }) {
  const ct = useContabilidad();
  // Un movimiento AUTOMÁTICO de compra no se edita/borra como un
  // movimiento cualquiera (eso desincronizaría la caja de la compra real)
  // — "Editar" abre la compra que lo generó (mismo formulario que
  // Inventario) y "Borrar" borra esa compra entera, para que el
  // movimiento se actualice/desaparezca solo como efecto de eso. A
  // pedido explícito del usuario. Para esto hace falta la misma lógica
  // de Compras acá (saveCompra ya resincroniza el movimiento al guardar,
  // ver useCompras.js).
  const { ingredientes, reload: reloadIngredientes } = useIngredientes();
  const comprasHook = useCompras(ingredientes, reloadIngredientes);
  const [cajaModal, setCajaModal] = useState(null); // { editing } | null
  const [cajaActionsFor, setCajaActionsFor] = useState(null);
  const [movimientoModal, setMovimientoModal] = useState(null); // { editing } | null
  const [compraModal, setCompraModal] = useState(null); // { ingrediente, editRecord } | null

  const nombreCaja = cajaId => ct.cajas.find(c => c.id === cajaId)?.nombre || 'Caja borrada';

  function compraDeMovimiento(item) {
    if (item.origen !== 'auto' || !item.origenRefId) return null;
    return comprasHook.compras.find(c => c.id === item.origenRefId) || null;
  }

  async function handleEditarMovimiento(item) {
    const compra = compraDeMovimiento(item);
    if (compra) {
      const ingrediente = ingredientes.find(i => i.nombre === compra.ingrediente);
      setCompraModal({
        ingrediente, editRecord: compra,
        lastUnitPrice: getUnitPrice(comprasHook.compras, compra.ingrediente)
      });
    } else {
      setMovimientoModal({ editing: item });
    }
  }

  async function handleBorrarMovimiento(item) {
    const compra = compraDeMovimiento(item);
    if (compra) {
      await comprasHook.removeCompra(compra.rowIndex);
      await ct.reload();
    } else {
      await ct.removeMovimiento(item.id);
    }
  }

  async function handleSaveCompra(data, editRecord) {
    await comprasHook.saveCompra(data, editRecord);
    await ct.reload();
  }

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

      {ct.loading && <div className="loading-state">Cargando…</div>}
      {ct.error && <EmptyState>No se pudo cargar: {ct.error}</EmptyState>}

      {!ct.loading && !ct.error && (
        <>
          <div className="cajas-section-head">
            <h2 className="subsection-title">Cajas</h2>
            <Button type="button" variant="outline" onClick={() => setCajaModal({ editing: null })}>
              <Icon name="plus" size={13} /> Nueva caja
            </Button>
          </div>

          {!ct.cajas.length ? (
            <EmptyState>Agregá tu primera caja con el botón de arriba.</EmptyState>
          ) : (
            <div className="cajas-list">
              {ct.cajas.map(caja => (
                <CajaCard
                  key={caja.id}
                  caja={caja}
                  saldo={ct.saldoCaja(caja.id)}
                  actionsOpen={cajaActionsFor === caja.id}
                  onOpenActionsChange={setCajaActionsFor}
                  onEdit={c => setCajaModal({ editing: c })}
                  onDelete={ct.deleteCaja}
                />
              ))}
            </div>
          )}

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
                    esCompraAuto={!!compraDeMovimiento(m)}
                    onEdit={handleEditarMovimiento}
                    onDelete={() => handleBorrarMovimiento(m)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!ct.loading && !ct.error && !!ct.cajas.length && (
        <FabButton onClick={() => setMovimientoModal({ editing: null })}>
          <Icon name="plus" size={16} /> Nuevo movimiento
        </FabButton>
      )}

      <CajaModal
        open={!!cajaModal}
        onClose={() => setCajaModal(null)}
        editingCaja={cajaModal?.editing || null}
        onSave={ct.saveCaja}
      />

      <MovimientoModal
        open={!!movimientoModal}
        onClose={() => setMovimientoModal(null)}
        cajas={ct.cajas}
        editing={movimientoModal?.editing || null}
        onSaveMovimiento={ct.addMovimiento}
        onSaveTransferencia={ct.addTransferencia}
        onSaveEdit={ct.editMovimiento}
      />

      <CompraModal
        open={!!compraModal}
        onClose={() => setCompraModal(null)}
        ingrediente={compraModal?.ingrediente}
        editRecord={compraModal?.editRecord || null}
        lastUnitPrice={compraModal?.lastUnitPrice ?? null}
        cajas={ct.cajas}
        onSave={handleSaveCompra}
      />
    </motion.div>
  );
}
