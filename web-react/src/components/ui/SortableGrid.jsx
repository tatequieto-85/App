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
    <div ref={setNodeRef} style={style} className="sortable-item" data-span={span} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

// Grid arrastrable genérica — la usan tanto los widgets como el grid de
// módulos de Home, a pedido del usuario ("se deben dejar arrastrar y
// posicionar donde el usuario quiera"). Subir `distance` de 8 a 24px
// (primer intento, bug real reportado: "muy sensible, con toques
// involuntarios se desorganiza") no alcanzó — el usuario pidió
// explícitamente que el arrastre arranque recién al MANTENER presionado
// ("quiero que para que se pueda mover un módulo de posición, que primero
// lo mantenga oprimido"), no con cualquier movimiento del dedo por chico
// que sea el umbral. Por eso ahora usa `delay` (200ms quieto) en vez de
// `distance`: si el dedo se mueve más de `tolerance` px ANTES de que pase
// el delay, se cancela el arrastre (es un toque o un scroll, no una
// espera). El long-press para "Quitar" de Widget.jsx sigue sin pisarse:
// su propio temporizador (550ms, ver useTapHold.js) es más largo que
// este, así que si el usuario sigue quieto pasado el delay del arrastre
// ya está "agarrando" el ítem para moverlo, y si en cambio se mueve de
// verdad para arrastrarlo, ese movimiento cancela el temporizador de
// Widget igual que cancelaría cualquier otro intento de long-press.
export default function SortableGrid({ ids, onReorder, renderItem, getSpan, className, trailing }) {
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
