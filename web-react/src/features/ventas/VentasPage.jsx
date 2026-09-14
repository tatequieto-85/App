import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../../components/ui/EmptyState';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import PageHeader from '../../components/layout/PageHeader';
import SortableGrid from '../../components/ui/SortableGrid';
import { useVentas } from './useVentas';
import {
  feriaEstaEnCurso, feriaEsFutura, feriaHaTerminado
} from '../../services/feriasApi';
import CanalCard from './CanalCard';
import CanalModal from './CanalModal';
import FeriaBlock from './FeriaBlock';
import FeriaModal from './FeriaModal';
import FeriaStockModal from './FeriaStockModal';
import FeriaCounterModal from './FeriaCounterModal';
import FeriaResumenModal from './FeriaResumenModal';
import VentasResumenDiario from './VentasResumenDiario';
import './VentasPage.css';

// Punto de entrada único de "abrir feria" (un toque en su tarjeta): en
// fechas de feria abre el conteo, antes de esas fechas
// pregunta el plan de stock (total por lote), y ya pasada (o cerrada a
// mano) muestra el resumen. Ver handleAbrirFeria() en ../../../ferias.js.
function pickView(feria) {
  if (feriaEstaEnCurso(feria)) return 'counter';
  if (feriaEsFutura(feria)) return 'stock';
  return 'resumen';
}

export default function VentasPage({ onBack }) {
  const vt = useVentas();
  const [currentCanalId, setCurrentCanalId] = useState(null);
  const [canalModal, setCanalModal] = useState(null); // { editing } | null
  const [feriaModal, setFeriaModal] = useState(null); // { editing } | null
  const [openFeriaId, setOpenFeriaId] = useState(null);
  const [openView, setOpenView] = useState(null); // 'counter' | 'stock' | 'resumen'

  const canal = currentCanalId ? vt.canales.find(c => c.id === currentCanalId) : null;
  const canalIds = useMemo(() => vt.canales.map(c => c.id), [vt.canales]);

  const feriasCanal = useMemo(
    () => vt.ferias.filter(f => f.canalId === currentCanalId),
    [vt.ferias, currentCanalId]
  );
  const activas = useMemo(
    () => feriasCanal.filter(f => !feriaHaTerminado(f)).slice().sort((a, b) => (a.fechaInicio || '9999').localeCompare(b.fechaInicio || '9999')),
    [feriasCanal]
  );
  const terminadas = useMemo(() => feriasCanal.filter(feriaHaTerminado), [feriasCanal]);

  const openFeria = openFeriaId ? vt.ferias.find(f => f.id === openFeriaId) : null;

  function handleAbrirFeria(feriaId) {
    const f = vt.ferias.find(x => x.id === feriaId);
    if (!f) return;
    setOpenFeriaId(feriaId);
    setOpenView(pickView(f));
  }

  function closeOpenFeria() {
    setOpenFeriaId(null);
    setOpenView(null);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <PageHeader title={canal ? canal.nombre : 'Ventas'} onBack={canal ? () => setCurrentCanalId(null) : onBack} />

      {/* Sin caja blanca contenedora, a pedido del usuario — el submenú de
          canales va directo sobre el fondo de la página, igual que el grid
          de Módulos en Home (que tampoco vive dentro de un <Card>). */}
      <div>
        {vt.loading && <div className="loading-state">Cargando…</div>}
        {vt.error && <EmptyState>No se pudo cargar: {vt.error}</EmptyState>}

        {!vt.loading && !vt.error && !canal && (
          !vt.canales.length ? (
            <EmptyState>Cargando los canales de venta…</EmptyState>
          ) : (
            <SortableGrid
              ids={canalIds}
              onReorder={vt.reorderCanales}
              className="canales-venta-grid"
              renderItem={id => (
                <CanalCard
                  canal={vt.canales.find(c => c.id === id)}
                  onEnter={setCurrentCanalId}
                  onEdit={c => setCanalModal({ editing: c })}
                  onDelete={vt.deleteCanal}
                />
              )}
            />
          )
        )}

        {!vt.loading && !vt.error && canal && (
          !feriasCanal.length ? (
            <EmptyState>No hay ferias en este canal. Agrega la primera con "Nueva feria".</EmptyState>
          ) : (
            <>
              <div className="feria-blocks-grid">
                {activas.map((f, i) => (
                  <FeriaBlock
                    key={f.id} feria={f} esProxima={i === 0}
                    onAbrir={handleAbrirFeria}
                    onEdit={ff => setFeriaModal({ editing: ff })}
                    onDelete={vt.deleteFeria}
                  />
                ))}
              </div>
              {!!terminadas.length && (
                <>
                  <div className="feria-list-divider"><span>Ferias terminadas</span></div>
                  <div className="feria-blocks-grid">
                    {terminadas.map(f => (
                      <FeriaBlock
                        key={f.id} feria={f} esProxima={false}
                        onAbrir={handleAbrirFeria}
                        onEdit={ff => setFeriaModal({ editing: ff })}
                        onDelete={vt.deleteFeria}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )
        )}
      </div>

      {/* Cruza ventas de TODOS los canales — no tiene sentido una vez
          adentro de uno solo, donde "por canal" deja de variar. Siempre
          debajo de las subcategorías (canales) creadas, a pedido del
          usuario — no arriba. */}
      {!canal && !vt.loading && !vt.error && <VentasResumenDiario filas={vt.resumenVentasPorDia} />}

      {/* Ya no se pueden crear canales a mano — son fijos (ver
          CANALES_POR_DEFECTO en useVentas.js), cada uno con su propia
          configuración. El FAB de acá solo sirve para agregar una feria
          dentro de un canal ya existente. */}
      {canal && (
        <FabButton onClick={() => setFeriaModal({ editing: null })}>
          <Icon name="plus" size={16} /> Nueva feria
        </FabButton>
      )}

      <CanalModal
        open={!!canalModal}
        onClose={() => setCanalModal(null)}
        editingCanal={canalModal?.editing || null}
        onSave={vt.saveCanal}
      />

      <FeriaModal
        open={!!feriaModal}
        onClose={() => setFeriaModal(null)}
        editingFeria={feriaModal?.editing || null}
        onSave={(datos, editingId) => vt.saveFeria(datos, editingId, currentCanalId)}
        onReabrir={vt.reabrirFeria}
      />

      <FeriaStockModal
        open={openView === 'stock'}
        onClose={closeOpenFeria}
        feria={openFeria}
        ejecuciones={vt.ejecuciones}
        ctx={vt.ctx}
        onSave={vt.saveStockPlan}
      />

      <FeriaCounterModal
        open={openView === 'counter'}
        onClose={closeOpenFeria}
        feria={openFeria}
        ejecuciones={vt.ejecuciones}
        onRegistrarSalida={vt.registrarSalida}
        onAddObservacionDiaria={vt.addObservacionDiaria}
        onTerminar={async feriaId => { await vt.terminarFeria(feriaId); setOpenView('resumen'); }}
        onCommitSession={vt.commitConteoSession}
      />

      <FeriaResumenModal
        open={openView === 'resumen'}
        onClose={closeOpenFeria}
        feria={openFeria}
        ejecuciones={vt.ejecuciones}
      />
    </motion.div>
  );
}
