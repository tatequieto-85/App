import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../../components/ui/EmptyState';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import PageHeader from '../../components/layout/PageHeader';
import SortableGrid from '../../components/ui/SortableGrid';
import { useVentas } from './useVentas';
import { useContactos } from '../contactos/useContactos';
import {
  feriaEstaEnCurso, feriaEsFutura, estadoEfectivo
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
  // Vincular un contacto a una feria es obligatorio (ver FeriaModal) — se
  // lee Contactos acá, como ya hacía Stock con Procesos/Ferias, para no
  // necesitar migrar ese módulo entero solo para esta lista.
  const { contactos } = useContactos();
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
  // Tres bloques por estado (ver regla — el usuario los pidió en este
  // orden), no dos como antes (activas/terminadas). "Participar" y
  // "Publicado" ordenados por fecha más próxima primero; "Terminado" al
  // revés, la más reciente arriba — es lo más útil para revisar qué pasó.
  const porParticipar = useMemo(
    () => feriasCanal.filter(f => estadoEfectivo(f) === 'participar').slice().sort((a, b) => (a.fechaInicio || '9999').localeCompare(b.fechaInicio || '9999')),
    [feriasCanal]
  );
  const publicados = useMemo(
    () => feriasCanal.filter(f => estadoEfectivo(f) === 'publicado').slice().sort((a, b) => (a.fechaInicio || '9999').localeCompare(b.fechaInicio || '9999')),
    [feriasCanal]
  );
  const terminados = useMemo(
    () => feriasCanal.filter(f => estadoEfectivo(f) === 'terminado').slice().sort((a, b) => (b.fechaFin || '').localeCompare(a.fechaFin || '')),
    [feriasCanal]
  );

  const openFeria = openFeriaId ? vt.ferias.find(f => f.id === openFeriaId) : null;
  const contactoNombre = feria => contactos.find(c => c.id === feria.contactoId)?.nombre || '';

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
              {!!porParticipar.length && (
                <>
                  <div className="feria-list-divider"><span>Participar</span></div>
                  <div className="feria-blocks-grid">
                    {porParticipar.map((f, i) => (
                      <FeriaBlock
                        key={f.id} feria={f} esProxima={i === 0} contactoNombre={contactoNombre(f)}
                        onAbrir={handleAbrirFeria}
                        onEdit={ff => setFeriaModal({ editing: ff })}
                        onDelete={vt.deleteFeria}
                      />
                    ))}
                  </div>
                </>
              )}
              {!!publicados.length && (
                <>
                  <div className="feria-list-divider"><span>Publicados</span></div>
                  <div className="feria-blocks-grid">
                    {publicados.map((f, i) => (
                      <FeriaBlock
                        key={f.id} feria={f} esProxima={i === 0} contactoNombre={contactoNombre(f)}
                        onAbrir={handleAbrirFeria}
                        onEdit={ff => setFeriaModal({ editing: ff })}
                        onDelete={vt.deleteFeria}
                      />
                    ))}
                  </div>
                </>
              )}
              {!!terminados.length && (
                <>
                  <div className="feria-list-divider"><span>Terminados</span></div>
                  <div className="feria-blocks-grid">
                    {terminados.map(f => (
                      <FeriaBlock
                        key={f.id} feria={f} esProxima={false} contactoNombre={contactoNombre(f)}
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
        contactos={contactos}
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
        contactos={contactos}
      />
    </motion.div>
  );
}
