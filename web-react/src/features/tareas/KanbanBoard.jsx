import { useState } from 'react';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Icon from '../../components/icons/Icon';
import TaskCard from './TaskCard';
import { TERMINAL_STATES } from '../../services/tareasApi';
import './KanbanBoard.css';

function KanbanColumn({ col, count, onAddCard, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.name });
  return (
    <div ref={setNodeRef} className={`kanban-col${col.terminal ? ' kanban-col--terminal' : ''}${isOver ? ' kanban-col--over' : ''}`}>
      <div className="kanban-col-header">
        <span className="kanban-col-dot" style={{ background: col.color }} />
        <span className="kanban-col-title">{col.name}</span>
        <span className="kanban-col-count">{count}</span>
        {!col.terminal && (
          <button type="button" className="kanban-add-card-icon" onClick={() => onAddCard(col.name)} aria-label="Agregar tarea">
            <Icon name="plus" size={14} />
          </button>
        )}
      </div>
      <div className="kanban-col-body">{children}</div>
    </div>
  );
}

// `touchAction:none` es necesario para que dnd-kit pueda capturar el
// arrastre por touch en vez de que el navegador lo interprete como scroll
// — mismo criterio que FeriaDraggable en ventas/FeriaEstadoDnd.jsx. El
// umbral de 8px de movimiento (ver sensors abajo) es lo que permite que
// esto conviva con el toque/mantener-presionado de TaskCard sin que un
// tap simple se confunda con un arrastre.
function DraggableCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 2 : 'auto',
    touchAction: 'none'
  };
  return <div ref={setNodeRef} style={style} {...attributes} {...listeners}>{children}</div>;
}

// Tablero por columnas — arrastrar una tarjeta a otra columna cambia su
// estado (equivalente al drag nativo de ../../../tareas.js, portado a
// dnd-kit por consistencia con el resto de la app y porque funciona mejor
// en touch). Las columnas terminales (Realizado/Cancelado/Postpuesto)
// quedan ocultas detrás de "Finalizadas (N)" — a diferencia de la app
// vanilla, acá NO se archivan solas a Historial al llegar a un estado
// terminal (ese archivado todavía no está migrado, primera pasada
// acordada con el usuario) — se quedan visibles ahí, como cualquier otra
// columna.
export default function KanbanBoard({ columns, tasks, onChangeStatus, onOpenDetail, onEdit, onDelete, onAddCard }) {
  const [showTerminal, setShowTerminal] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    onChangeStatus(active.id, over.id);
  }

  const visibleCols = columns.filter(c => !c.terminal || showTerminal);
  const termCount = tasks.filter(t => TERMINAL_STATES.includes(t.status)).length;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {visibleCols.map(col => {
          const colTasks = tasks.filter(t => t.status === col.name);
          return (
            <KanbanColumn key={col.name} col={col} count={colTasks.length} onAddCard={onAddCard}>
              {colTasks.map(task => (
                <DraggableCard key={task.id} id={task.id}>
                  <TaskCard task={task} onOpen={onOpenDetail} onEdit={onEdit} onDelete={onDelete} />
                </DraggableCard>
              ))}
            </KanbanColumn>
          );
        })}
      </div>
      {!!termCount && (
        <button type="button" className="kanban-toggle-terminal" onClick={() => setShowTerminal(v => !v)}>
          {showTerminal ? 'Ocultar finalizadas' : `Finalizadas (${termCount})`}
        </button>
      )}
    </DndContext>
  );
}
