import { useState } from 'react';
import Icon from '../../components/icons/Icon';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick';
import { RECETA_GROUP_ICON_OPTIONS, RECETA_GROUP_COLOR_OPTIONS } from './recetaGroupIconOptions';
import '../../components/ui/AppCard.css';
import './RecetaGroupCard.css';

// Mismo estilo que las tarjetas de Módulos de Home y de canal de venta en
// Ventas (ver regla 15 de convenciones de UI) — reusa .app-card tal cual.
// Mantener presionado muestra Editar/Borrar; un toque entra al grupo.
export default function RecetaGroupCard({ group, onEnter, onEdit, onDelete }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useCloseOnOutsideClick(actionsOpen, () => setActionsOpen(false));
  const gestureProps = useRowGestures({
    onTap: () => onEnter(group.id),
    onLongPress: () => setActionsOpen(true)
  });

  const icon = RECETA_GROUP_ICON_OPTIONS.includes(group.icono) ? group.icono : 'beaker';
  const color = RECETA_GROUP_COLOR_OPTIONS.includes(group.color) ? group.color : 'green';

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar el grupo "${group.nombre}"? Las recetas no se borran, quedan sin grupo.`)) return;
    setBusy(true);
    try {
      await onDelete(group.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrapRef} className="receta-group-card-wrap">
      <div className="app-card" {...gestureProps}>
        <span className={`app-card-icon app-card-icon--${color}`}>
          <Icon name={icon} size={24} className="app-card-icon-glyph" />
        </span>
        <span className="app-card-label">{group.nombre}</span>
      </div>
      {actionsOpen && (
        <div className="row-actions-bar receta-group-card-actions">
          <button type="button" onClick={() => { setActionsOpen(false); onEdit(group); }}>Editar</button>
          <button type="button" className="danger" disabled={busy} onClick={handleDelete}>Borrar</button>
        </div>
      )}
    </div>
  );
}
