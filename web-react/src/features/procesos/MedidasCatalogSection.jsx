import EmptyState from '../../components/ui/EmptyState';
import './MedidasCatalogSection.css';

// Catálogo de medidas (tamaños de empaque) — pestaña propia en Procesos, a
// pedido explícito del usuario. Un toque en una fila abre la edición (ver
// MedidaModal.jsx); crear una medida nueva es el FAB de la pestaña (ver
// ProcesosPage.jsx). No hay acción de borrar todavía — no la pidió el
// usuario ("crear, editar o ver catálogo").
export default function MedidasCatalogSection({ medidas, onEdit }) {
  if (!medidas.length) return <EmptyState>Todavía no hay medidas creadas. Usá el botón de abajo para crear la primera.</EmptyState>;
  return (
    <div className="medidas-catalogo-list">
      {medidas.map(m => (
        <div key={m.id} className="medidas-catalogo-row" onClick={() => onEdit(m)}>
          <span className="medidas-catalogo-nombre">{m.nombre}</span>
          <span className="medidas-catalogo-peso">{m.pesoMl ? `${m.pesoMl} ml de mezcla por frasco` : 'sin peso definido'}</span>
        </div>
      ))}
    </div>
  );
}
