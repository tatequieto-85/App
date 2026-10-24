import EmptyState from '../../components/ui/EmptyState';
import './MedidasCatalogSection.css';

// Catálogo de medidas (tamaños de empaque) — pestaña propia en Procesos, a
// pedido explícito del usuario. Cada medida está atada a UNA receta
// puntual, con su propio grupo de insumos unitarios — "cada medida debe
// guardar insumos de unidad con cantidad, asociarlo a una receta, e
// indicar en gramos cuánto le cabe". Un toque en una fila abre la edición
// (ver MedidaModal.jsx); crear una medida nueva es el FAB de la pestaña
// (ver ProcesosPage.jsx). No hay acción de borrar todavía — no la pidió el
// usuario ("crear, editar o ver catálogo").
export default function MedidasCatalogSection({ medidas, recetas, onEdit }) {
  if (!medidas.length) return <EmptyState>Todavía no hay medidas creadas. Usá el botón de abajo para crear la primera.</EmptyState>;
  return (
    <div className="medidas-catalogo-list">
      {medidas.map(m => {
        const receta = recetas.find(r => r.id === m.recetaId);
        return (
          <div key={m.id} className="medidas-catalogo-row" onClick={() => onEdit(m)}>
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
      })}
    </div>
  );
}
