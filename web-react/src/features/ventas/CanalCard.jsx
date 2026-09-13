import { useState } from 'react';
import Icon from '../../components/icons/Icon';
import { useRowGestures } from '../../hooks/useRowGestures';
import { CANAL_ICON_OPTIONS, CANAL_COLOR_OPTIONS } from './canalIconOptions';
import '../../components/ui/AppCard.css';
import './CanalCard.css';

// Mismo estilo que las tarjetas de Módulos de Home (caja blanca, ícono de
// línea de color, nombre debajo del ícono dentro de la caja) — a pedido
// explícito del usuario, que no quería emojis ni un estilo distinto al de
// los módulos. Reusa las clases .app-card* de AppCard.css directamente para
// no duplicar el estilo en dos lugares.
// Mantener presionada muestra el panel Editar/Borrar sobre la tarjeta;
// doble clic/doble toque entra al canal.
export default function CanalCard({ canal, onEnter, onEdit, onDelete }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const gestureProps = useRowGestures({
    onDoubleClick: () => onEnter(canal.id),
    onLongPress: () => setActionsOpen(true)
  });

  // Los canales existentes de antes de este cambio guardaban un emoji y un
  // color libre en hex — si lo que hay guardado ya no matchea ninguna
  // opción válida, se cae a un ícono/color por defecto en vez de romper.
  const icon = CANAL_ICON_OPTIONS.includes(canal.icono) ? canal.icono : 'store';
  const color = CANAL_COLOR_OPTIONS.includes(canal.color) ? canal.color : 'rose';

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar el canal "${canal.nombre}"?`)) return;
    setBusy(true);
    try {
      await onDelete(canal.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="canal-venta-card-wrap">
      <div className="app-card" {...gestureProps}>
        <span className={`app-card-icon app-card-icon--${color}`}>
          <Icon name={icon} size={24} className="app-card-icon-glyph" />
        </span>
        <span className="app-card-label">{canal.nombre}</span>
      </div>
      {actionsOpen && (
        <div className="row-actions-bar canal-venta-card-actions">
          <button type="button" onClick={() => { setActionsOpen(false); onEdit(canal); }}>Editar</button>
          <button type="button" className="danger" disabled={busy} onClick={handleDelete}>Borrar</button>
        </div>
      )}
    </div>
  );
}
