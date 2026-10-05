import { useState } from 'react';
import { useRowGestures } from '../../hooks/useRowGestures';
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick';
import { nivelPicanteStyle } from '../../services/recetasApi';
import './RecetaCard.css';

// Un toque abre el detalle de solo lectura (ingredientes + etapas);
// mantener presionada revela Duplicar (arriba) y Editar/Borrar (abajo) —
// mismo patrón de ancla dentro del recuadro que FeriaBlock en Ventas, con
// una fila extra a pedido del usuario. El color no se elige a mano: sale
// del nivel de picante detectado a partir de los ingredientes (ver
// detectNivelPicante en recetasApi.js).
export default function RecetaCard({ receta, onAbrir, onEdit, onDelete, onDuplicate }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useCloseOnOutsideClick(actionsOpen, () => setActionsOpen(false));
  const gestureProps = useRowGestures({
    onTap: () => onAbrir(receta.id),
    onLongPress: () => setActionsOpen(true)
  });

  const { bg, borderColor, label, color } = nivelPicanteStyle(receta.nivelPicante);
  const numEtapas = (receta.etapas || []).filter(e => !e.fija).length;

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta receta?')) return;
    setBusy(true);
    try {
      await onDelete(receta);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    setBusy(true);
    try {
      await onDuplicate(receta);
      setActionsOpen(false);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrapRef} className="receta-card-wrap" style={{ borderColor }}>
      <div className="receta-card" style={{ background: bg || undefined }} {...gestureProps}>
        <div className="receta-card-title">{receta.nombre}</div>
        <div className="receta-card-meta">
          <span className="receta-card-nivel" style={{ color }}>{label}</span>
          <span> · {numEtapas} etapa{numEtapas !== 1 ? 's' : ''}</span>
        </div>
      </div>
      {actionsOpen && (
        <div className="receta-card-actions">
          <button type="button" className="receta-card-duplicate-btn" disabled={busy} onClick={handleDuplicate}>Duplicar</button>
          <div className="row-actions-bar">
            <button type="button" onClick={() => { setActionsOpen(false); onEdit(receta); }}>Editar</button>
            <button type="button" className="danger" disabled={busy} onClick={handleDelete}>Eliminar</button>
          </div>
        </div>
      )}
    </div>
  );
}
