import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Igual que SortableGrid.jsx pero para filas de <table> en vez de tarjetas
// en una grilla CSS — usa verticalListSortingStrategy (una sola columna) y
// no envuelve cada fila en un <div> propio (el consumidor arma su propio
// <tr> y se engancha con useSortableRow(id), ver más abajo). Mismo
// criterio de activación que SortableGrid (mantener presionado, no
// cualquier movimiento del dedo) — ver ese archivo para el porqué.
export function SortableRows({ ids, onReorder, children }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }));

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

// Lo usa cada fila (p. ej. CompraRow en Inventario) para engancharse al
// arrastre. `dragHandleProps` va SOLO en un ícono/agarradera aparte
// dentro de la fila, nunca en la fila entera — la fila ya tiene su propio
// toque (acción principal) y mantener presionado (revela Editar/Borrar),
// y mezclar un tercer gesto de arrastre en la misma zona los pisaría.
export function useSortableRow(id) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 'auto'
  };
  return { setNodeRef, style, dragHandleProps: { ...attributes, ...listeners }, isDragging };
}
