import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Arrastrar una feria del bloque "Participar" al de "Publicado" (o al
// revés) cambia su estado — las terminadas quedan afuera de esto (no se
// renderizan acá). `distance: 8` como umbral, mismo criterio que
// SortableGrid, para convivir con el toque/mantener-presionado de
// FeriaBlock sin que un simple tap dispare un "arrastre" accidental.
export function FeriaEstadoDndContext({ onCambiarEstado, children }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    if (over.id !== 'participar' && over.id !== 'publicado') return;
    onCambiarEstado(active.id, over.id);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  );
}

export function FeriaEstadoDropZone({ id, className, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className}${isOver ? ' feria-blocks-grid--over' : ''}`}>
      {children}
    </div>
  );
}

export function FeriaDraggable({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 2 : 'auto',
    touchAction: 'none'
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
