import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../../components/ui/EmptyState';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import PageHeader from '../../components/layout/PageHeader';
import SortableGrid from '../../components/ui/SortableGrid';
import { useProcesos } from './useProcesos';
import { useIngredientes } from '../ingredientes/useIngredientes';
import RecetaGroupCard from './RecetaGroupCard';
import RecetaGroupModal from './RecetaGroupModal';
import RecetaCard from './RecetaCard';
import RecetaModal from './RecetaModal';
import RecetaDetailModal from './RecetaDetailModal';
import './RecetaGroupCard.css';
import './RecetaCard.css';

// Solo Recetas por ahora (grupos + crear/editar) — Ejecuciones de lote
// (cronómetro + evaluación) todavía no se migra, ver memoria del piloto.
export default function ProcesosPage({ onBack }) {
  const pr = useProcesos();
  const { ingredientes, tryAddIngrediente } = useIngredientes();
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const [groupModal, setGroupModal] = useState(null); // { editing } | null
  const [recetaModal, setRecetaModal] = useState(null); // { editing } | null
  const [detailId, setDetailId] = useState(null);

  const group = currentGroupId ? pr.recetaBlocks.find(b => b.id === currentGroupId) : null;
  const groupIds = useMemo(() => pr.recetaBlocks.map(b => b.id), [pr.recetaBlocks]);
  const recetasGrupo = useMemo(
    () => pr.recetas.filter(r => r.blockId === currentGroupId),
    [pr.recetas, currentGroupId]
  );
  const detailReceta = detailId ? pr.recetas.find(r => r.id === detailId) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <PageHeader title={group ? group.nombre : 'Procesos'} onBack={group ? () => setCurrentGroupId(null) : onBack} />

      <div>
        {pr.loading && <div className="loading-state">Cargando…</div>}
        {pr.error && <EmptyState>No se pudo cargar: {pr.error}</EmptyState>}

        {!pr.loading && !pr.error && !group && (
          !pr.recetaBlocks.length ? (
            <EmptyState>Agrega el primer grupo de recetas con el botón de abajo.</EmptyState>
          ) : (
            <SortableGrid
              ids={groupIds}
              onReorder={pr.reorderRecetaGroups}
              className="receta-groups-grid"
              renderItem={id => (
                <RecetaGroupCard
                  group={pr.recetaBlocks.find(b => b.id === id)}
                  onEnter={setCurrentGroupId}
                  onEdit={g => setGroupModal({ editing: g })}
                  onDelete={pr.deleteRecetaGroup}
                />
              )}
            />
          )
        )}

        {!pr.loading && !pr.error && group && (
          !recetasGrupo.length ? (
            <EmptyState>No hay recetas en este grupo. Agrega la primera con "Nueva receta".</EmptyState>
          ) : (
            <div className="receta-cards-grid">
              {recetasGrupo.map(r => (
                <RecetaCard
                  key={r.id} receta={r}
                  onAbrir={setDetailId}
                  onEdit={rr => setRecetaModal({ editing: rr })}
                  onDelete={pr.deleteReceta}
                  onDuplicate={pr.duplicateReceta}
                />
              ))}
            </div>
          )
        )}
      </div>

      {group ? (
        <FabButton onClick={() => setRecetaModal({ editing: null })}>
          <Icon name="plus" size={16} /> Nueva receta
        </FabButton>
      ) : (
        <FabButton onClick={() => setGroupModal({ editing: null })}>
          <Icon name="plus" size={16} /> Nuevo grupo
        </FabButton>
      )}

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
        onSave={(datos, editingId) => pr.saveReceta(datos, editingId, currentGroupId)}
      />

      <RecetaDetailModal
        open={!!detailId}
        onClose={() => setDetailId(null)}
        receta={detailReceta}
        compras={pr.compras}
      />
    </motion.div>
  );
}
