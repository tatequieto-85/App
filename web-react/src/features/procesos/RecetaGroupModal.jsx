import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Icon from '../../components/icons/Icon';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { RECETA_GROUP_ICON_OPTIONS, RECETA_GROUP_COLOR_OPTIONS } from './recetaGroupIconOptions';
import '../../components/ui/AppCard.css';
import './RecetaGroupModal.css';

const DEFAULT_ICON = RECETA_GROUP_ICON_OPTIONS[0];
const DEFAULT_COLOR = 'green';

// Crear o editar un grupo de recetas — mismo patrón que CanalModal.jsx en
// Ventas (un solo modal para ambos casos). editingGroup null = crear.
export default function RecetaGroupModal({ open, onClose, editingGroup, onSave }) {
  const [nombre, setNombre] = useState('');
  const [icono, setIcono] = useState(DEFAULT_ICON);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ nombre: '' });

  useEffect(() => {
    if (!open) return;
    const n = editingGroup ? editingGroup.nombre : '';
    setNombre(n);
    setIcono(editingGroup && RECETA_GROUP_ICON_OPTIONS.includes(editingGroup.icono) ? editingGroup.icono : DEFAULT_ICON);
    setColor(editingGroup && RECETA_GROUP_COLOR_OPTIONS.includes(editingGroup.color) ? editingGroup.color : DEFAULT_COLOR);
    initialRef.current = { nombre: n };
  }, [open, editingGroup]);

  const isDirty = () => nombre.trim() !== initialRef.current.nombre;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    if (!nombreTrim) return showFeedback('Ponele un nombre al grupo.', 'err');
    setBusy(true);
    try {
      await onSave({ nombre: nombreTrim, icono, color }, editingGroup?.id || null);
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={editingGroup ? 'Editar grupo' : 'Nuevo grupo de recetas'}>
      <form onSubmit={handleSubmit}>
        <TextField label="Nombre" placeholder="Ej: Salsas picantes" value={nombre} onChange={e => setNombre(e.target.value)} disabled={busy} autoFocus />

        <div className="field">
          <label className="field-label">Color</label>
          <div className="recetagroup-color-picker">
            {RECETA_GROUP_COLOR_OPTIONS.map(c => (
              <button
                key={c} type="button" disabled={busy}
                className={`recetagroup-color-swatch app-card-icon--${c}${color === c ? ' is-selected' : ''}`}
                onClick={() => setColor(c)} aria-label={c}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label">Ícono</label>
          <div className="recetagroup-icon-picker">
            {RECETA_GROUP_ICON_OPTIONS.map(i => (
              <button
                key={i} type="button" disabled={busy}
                className={`recetagroup-icon-option app-card-icon--${color}${icono === i ? ' is-selected' : ''}`}
                onClick={() => setIcono(i)} aria-label={i}
              >
                <Icon name={i} size={20} />
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : (editingGroup ? 'Guardar' : 'Crear')}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
