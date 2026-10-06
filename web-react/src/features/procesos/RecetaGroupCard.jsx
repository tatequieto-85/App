import { useState } from 'react';
import Icon from '../../components/icons/Icon';
import Button from '../../components/ui/Button';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick';
import { RECETA_GROUP_ICON_OPTIONS, RECETA_GROUP_COLOR_OPTIONS } from './recetaGroupIconOptions';
import '../../components/ui/AppCard.css';
import './RecetaGroupCard.css';

// Encabezado de un grupo dentro de la lista única de Procesos — a pedido
// explícito del usuario, las recetas ya no se ven en otra pantalla al
// "entrar" a un grupo: cada grupo es una sección (ver ProcesosPage.jsx) con
// este encabezado (ícono + nombre + botón "+ Receta") seguida de sus
// recetas, todo en la misma pestaña. Ya no hay "entrar", así que mantener
// presionado sigue revelando Editar/Borrar (mismo patrón de siempre, ver
// regla 5 de convenciones de UI) pero no hay acción de un solo toque.
export default function RecetaGroupCard({ group, onEdit, onDelete, onAddReceta }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useCloseOnOutsideClick(actionsOpen, () => setActionsOpen(false));
  const gestureProps = useRowGestures({ onLongPress: () => setActionsOpen(true) });

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
    <div ref={wrapRef} className="receta-group-header-wrap">
      <div className="receta-group-header" {...gestureProps}>
        <span className={`app-card-icon app-card-icon--${color} receta-group-header-icon`}>
          <Icon name={icon} size={18} className="app-card-icon-glyph" />
        </span>
        <span className="receta-group-header-label">{group.nombre}</span>
        <Button type="button" variant="outline" className="receta-group-header-add-btn" onClick={() => onAddReceta(group.id)}>
          <Icon name="plus" size={13} /> Receta
        </Button>
      </div>
      {actionsOpen && (
        <div className="row-actions-bar receta-group-header-actions">
          <button type="button" onClick={() => { setActionsOpen(false); onEdit(group); }}>Editar</button>
          <button type="button" className="danger" disabled={busy} onClick={handleDelete}>Borrar</button>
        </div>
      )}
    </div>
  );
}
