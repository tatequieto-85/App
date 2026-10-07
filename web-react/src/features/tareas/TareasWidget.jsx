import Widget from '../../components/ui/Widget';
import { useTareas } from './useTareas';

// Widget 1x1 — a pedido explícito del usuario: solo el número de tareas
// para HOY (no las atrasadas — esas se ven agrupadas aparte al entrar al
// módulo). Un toque entra a Tareas, donde la lista ya está agrupada en
// Hoy/Atrasadas/Siguientes, en ese orden (ver TaskList.jsx).
export default function TareasWidget({ onNavigate, removing, onRequestRemove, onConfirmRemove }) {
  const { loading, tareasPorDueCategory } = useTareas();

  return (
    <Widget
      icon="checkSquare" title="Tareas"
      onTap={() => onNavigate('tareas')}
      removing={removing} onRequestRemove={onRequestRemove} onConfirmRemove={onConfirmRemove}
    >
      {loading ? (
        <p className="widget-line widget-line--sub">Cargando…</p>
      ) : (
        <div className="widget-kpi">{tareasPorDueCategory.hoy.length}</div>
      )}
    </Widget>
  );
}
