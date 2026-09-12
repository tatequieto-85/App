import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './SortableGrid.css';

function SortableItem({ id, span, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 'auto',
    gridColumn: span > 1 ? `span ${span}` : undefined
  };
  return (
    <div ref={setNodeRef} style={style} className="sortable-item" {...attributes} {...listeners}>
      {children}
    </div>
  );
}

// Grid arrastrable genérica — la usan tanto los widgets como el grid de
// módulos de Home, a pedido del usuario ("se deben dejar arrastrar y
// posicionar donde el usuario quiera"). `distance: 8` como umbral de arrastre
// (no delay) es lo que permite que conviva con mantener presionado sin
// arrastrar (long-press para "Quitar", ver Widget.jsx) y con el doble
// clic/toque de la acción principal — si no hay movimiento, no es un
// arrastre y esos otros gestos siguen actuando normal.
export default function SortableGrid({ ids, onReorder, renderItem, getSpan, className, trailing }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className}>
          {ids.map(id => (
            <SortableItem key={id} id={id} span={getSpan ? getSpan(id) : 1}>
              {renderItem(id)}
            </SortableItem>
          ))}
          {trailing}
        </div>
      </SortableContext>
    </DndContext>
  );
}
