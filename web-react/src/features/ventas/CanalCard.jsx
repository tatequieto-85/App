import { useState } from 'react';
import Icon from '../../components/icons/Icon';
import { useRowGestures } from '../../hooks/useRowGestures';
import { CANAL_ICON_OPTIONS, CANAL_COLOR_OPTIONS } from './canalIconOptions';
import '../../components/ui/AppCard.css';
import './CanalCard.css';

// Todo submenú dentro de un módulo (a diferencia de los módulos de primer
// nivel en Home, que son caja cuadrada) va en ícono REDONDO con fondo
// blanco — mismo blanco que el fondo de las tarjetas de Módulos
// (var(--surface)), sin caja contenedora alrededor. A pedido explícito del
// usuario: sin emojis, y "quita la caja blanca... que el ícono redondo
// fondo blanco se vea encima". El color del ícono en sí reusa
// app-card-icon--* de AppCard.css (incluido acá) para no repetir la paleta.
// Mantener presionado muestra el panel Editar/Borrar; doble clic/doble
// toque entra al canal.
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
      <div className="canal-venta-tap" {...gestureProps}>
        <span className={`canal-venta-icon app-card-icon--${color}`}>
          <Icon name={icon} size={24} className="app-card-icon-glyph" />
        </span>
        <span className="canal-venta-name">{canal.nombre}</span>
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
