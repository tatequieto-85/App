import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../../components/ui/EmptyState';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import PageHeader from '../../components/layout/PageHeader';
import { useProcesos } from './useProcesos';
import { useIngredientes } from '../ingredientes/useIngredientes';
import RecetaGroupCard from './RecetaGroupCard';
import RecetaGroupModal from './RecetaGroupModal';
import RecetaCard from './RecetaCard';
import RecetaModal from './RecetaModal';
import RecetaDetailModal from './RecetaDetailModal';
import './RecetaGroupCard.css';
import './RecetaCard.css';
import './ProcesosPage.css';

// Todos los grupos y sus recetas en una sola pestaña — a pedido explícito
// del usuario: antes "entrar" a un grupo llevaba a otra pantalla con solo
// sus recetas; ahora cada grupo es una sección (encabezado + sus recetas)
// dentro de esta misma lista, separadas por una línea sutil. El cronómetro
// por etapa y el resto de la evaluación final de un lote todavía no se
// migran, ver memoria del piloto. "Empezar producción" sí existe: crea el
// lote (RecetasEjecuciones) y hace aparecer, dentro del mismo detalle, el
// cuadro de pH + ingredientes usados + observaciones.
export default function ProcesosPage({ onBack }) {
  const pr = useProcesos();
  const { ingredientes, tryAddIngrediente } = useIngredientes();
  const [groupModal, setGroupModal] = useState(null); // { editing } | null
  const [recetaModal, setRecetaModal] = useState(null); // { editing, groupId } | null
  const [detailId, setDetailId] = useState(null);

  const recetasPorGrupo = useMemo(() => {
    const map = new Map();
    for (const b of pr.recetaBlocks) map.set(b.id, []);
    for (const r of pr.recetas) {
      if (map.has(r.blockId)) map.get(r.blockId).push(r);
    }
    return map;
  }, [pr.recetaBlocks, pr.recetas]);

  const detailReceta = detailId ? pr.recetas.find(r => r.id === detailId) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <PageHeader title="Procesos" onBack={onBack} />

      <div>
        {pr.loading && <div className="loading-state">Cargando…</div>}
        {pr.error && <EmptyState>No se pudo cargar: {pr.error}</EmptyState>}

        {!pr.loading && !pr.error && (
          !pr.recetaBlocks.length ? (
            <EmptyState>Agrega el primer grupo de recetas con el botón de abajo.</EmptyState>
          ) : (
            <div className="receta-groups-sections">
              {pr.recetaBlocks.map(group => {
                const recetasGrupo = recetasPorGrupo.get(group.id) || [];
                return (
                  <section key={group.id} className="receta-group-section">
                    <RecetaGroupCard
                      group={group}
                      onEdit={g => setGroupModal({ editing: g })}
                      onDelete={pr.deleteRecetaGroup}
                      onAddReceta={groupId => setRecetaModal({ editing: null, groupId })}
                    />
                    {recetasGrupo.length ? (
                      <div className="receta-cards-grid">
                        {recetasGrupo.map(r => (
                          <RecetaCard
                            key={r.id} receta={r}
                            onAbrir={setDetailId}
                            onEdit={rr => setRecetaModal({ editing: rr, groupId: group.id })}
                            onDelete={pr.deleteReceta}
                            onDuplicate={pr.duplicateReceta}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state" style={{ padding: '4px 0 8px' }}>Sin recetas en este grupo todavía.</p>
                    )}
                  </section>
                );
              })}
            </div>
          )
        )}
      </div>

      <FabButton onClick={() => setGroupModal({ editing: null })}>
        <Icon name="plus" size={16} /> Nuevo grupo
      </FabButton>

      <RecetaGroupModal
        open={!!groupModal}
        onClose={() => setGroupModal(null)}
        editingGroup={groupModal?.editing || null}
        onSave={pr.saveRecetaGroup}
      />

      <RecetaModal
        open={!!recetaModal}
        onClose={() => setRecetaModal(null)}
        editingReceta={recetaModal?.editing || null}
        ingredientes={ingredientes}
        compras={pr.compras}
        onAddNewIngrediente={tryAddIngrediente}
        onSave={(datos, editingId) => pr.saveReceta(datos, editingId, recetaModal?.groupId)}
      />

      <RecetaDetailModal
        open={!!detailId}
        onClose={() => setDetailId(null)}
        receta={detailReceta}
        compras={pr.compras}
        ingredientes={ingredientes}
        onAddNewIngrediente={tryAddIngrediente}
        onEmpezarProduccion={pr.empezarProduccion}
        onAddObservacion={pr.addObservacionEjecucion}
        onAddInsumo={pr.addInsumoEjecucion}
        onRemoveInsumo={pr.removeInsumoEjecucion}
        onChangePH={pr.updatePHEjecucion}
        onChangeFrascos={pr.updateFrascosEjecucion}
        onGuardarEjecucion={pr.finalizarEjecucion}
        onEscalarReceta={pr.escalarReceta}
      />
    </motion.div>
  );
}
