import Button from '../../components/ui/Button';
import Icon from '../../components/icons/Icon';
import EmptyState from '../../components/ui/EmptyState';
import RecetaGroupCard from './RecetaGroupCard';
import './MedidasCatalogSection.css';

function MedidaRow({ m, receta, onEdit }) {
  return (
    <div className="medidas-catalogo-row" onClick={() => onEdit(m)}>
      <div className="medidas-catalogo-row-top">
        <span className="medidas-catalogo-nombre">{m.nombre}</span>
        <span className="medidas-catalogo-receta">{receta?.nombre || '(receta eliminada)'}</span>
      </div>
      <span className="medidas-catalogo-peso">
        {m.pesoMl ? `${m.pesoMl} g de mezcla por frasco` : 'sin peso definido'}
        {!!(m.insumos || []).length && ` · ${m.insumos.length} insumo${m.insumos.length === 1 ? '' : 's'}`}
      </span>
    </div>
  );
}

// Catálogo de medidas (tamaños de empaque) — pestaña propia en Procesos, a
// pedido explícito del usuario. Cada medida está atada a UNA receta
// puntual, con su propio grupo de insumos unitarios — "cada medida debe
// guardar insumos de unidad con cantidad, asociarlo a una receta, e
// indicar en gramos cuánto le cabe". Un toque en una fila abre la edición
// (ver MedidaModal.jsx); crear una medida nueva es el FAB de la pestaña
// (ver ProcesosPage.jsx). No hay acción de borrar todavía — no la pidió el
// usuario ("crear, editar o ver catálogo").
//
// Agrupar medidas (MedidaBlocks) es OPCIONAL, a diferencia de los grupos de
// recetas — a pedido explícito del usuario ("que se deje agrupar acorde a
// lo que el usuario quiera"): una medida sin grupo sigue siendo válida, así
// que las que no están en ningún grupo van en una sección final "Sin
// grupo" en vez de desaparecer. El botón chico "+ Grupo" (mismo patrón que
// "Nueva caja" en Contabilidad) crea grupos nuevos sin pasar por el FAB
// principal, que sigue siendo "Nueva medida" (sin grupo por defecto, se le
// puede asignar uno desde el propio editor — ver MedidaModal.jsx).
export default function MedidasCatalogSection({ medidas, medidaBlocks, recetas, onEdit, onAddToGroup, onEditGroup, onDeleteGroup, onNewGroup }) {
  const sinGrupo = medidas.filter(m => !m.blockId || !medidaBlocks.some(b => b.id === m.blockId));

  if (!medidas.length && !medidaBlocks.length) {
    return <EmptyState>Todavía no hay medidas creadas. Usá el botón de abajo para crear la primera.</EmptyState>;
  }

  return (
    <div>
      <div className="medidas-grupos-head">
        <h2 className="subsection-title">Grupos</h2>
        <Button type="button" variant="outline" onClick={onNewGroup}>
          <Icon name="plus" size={13} /> Grupo
        </Button>
      </div>

      {medidaBlocks.map(group => {
        const medidasGrupo = medidas.filter(m => m.blockId === group.id);
        return (
          <section key={group.id} className="receta-group-section">
            <RecetaGroupCard
              group={group} addLabel="Medida"
              onEdit={onEditGroup}
              onDelete={onDeleteGroup}
              onAdd={onAddToGroup}
            />
            {medidasGrupo.length ? (
              <div className="medidas-catalogo-list">
                {medidasGrupo.map(m => (
                  <MedidaRow key={m.id} m={m} receta={recetas.find(r => r.id === m.recetaId)} onEdit={onEdit} />
                ))}
              </div>
            ) : (
              <p className="empty-state" style={{ padding: '4px 0 8px' }}>Sin medidas en este grupo todavía.</p>
            )}
          </section>
        );
      })}

      {!!sinGrupo.length && (
        <section className="receta-group-section">
          {!!medidaBlocks.length && <p className="medidas-sin-grupo-label">Sin grupo</p>}
          <div className="medidas-catalogo-list">
            {sinGrupo.map(m => (
              <MedidaRow key={m.id} m={m} receta={recetas.find(r => r.id === m.recetaId)} onEdit={onEdit} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
