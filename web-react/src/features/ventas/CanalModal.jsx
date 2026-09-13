import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import Icon from '../../components/icons/Icon';
import Feedback from '../../components/ui/Feedback';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { CANAL_ICON_OPTIONS, CANAL_COLOR_OPTIONS } from './canalIconOptions';
import '../../components/ui/AppCard.css';
import './CanalModal.css';

const DEFAULT_ICON = CANAL_ICON_OPTIONS[0];
const DEFAULT_COLOR = 'rose';

// Crear o editar un canal de venta abre el mismo modal (antes, editar era
// un mini-formulario in-place que reemplazaba la tarjeta en la grilla — se
// unificó porque "no es limpia", igual que crear). editingCanal null = crear.
// Ícono y color salen de un catálogo fijo (canalIconOptions.js) — el usuario
// pidió explícitamente no usar emojis y mantener el mismo estilo (caja
// blanca + ícono de línea de color) que las tarjetas de Módulos.
export default function CanalModal({ open, onClose, editingCanal, onSave }) {
  const [nombre, setNombre] = useState('');
  const [icono, setIcono] = useState(DEFAULT_ICON);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [busy, setBusy] = useState(false);
  const [feedback, showFeedback] = useFeedback();
  const initialRef = useRef({ nombre: '' });

  useEffect(() => {
    if (!open) return;
    const n = editingCanal ? editingCanal.nombre : '';
    setNombre(n);
    // Canales guardados antes de este catálogo tenían un emoji/hex libre —
    // si ya no matchea ninguna opción válida, se cae al valor por defecto.
    setIcono(editingCanal && CANAL_ICON_OPTIONS.includes(editingCanal.icono) ? editingCanal.icono : DEFAULT_ICON);
    setColor(editingCanal && CANAL_COLOR_OPTIONS.includes(editingCanal.color) ? editingCanal.color : DEFAULT_COLOR);
    initialRef.current = { nombre: n };
  }, [open, editingCanal]);

  const isDirty = () => nombre.trim() !== initialRef.current.nombre;
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const nombreTrim = nombre.trim();
    if (!nombreTrim) return showFeedback('Ponele un nombre al canal.', 'err');
    setBusy(true);
    try {
      await onSave({ nombre: nombreTrim, icono, color }, editingCanal?.id || null);
      onClose();
    } catch (err) {
      showFeedback(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} showBack title={editingCanal ? 'Editar canal de venta' : 'Nuevo canal de venta'}>
      <form onSubmit={handleSubmit}>
        <TextField label="Nombre" placeholder="Ej: Mercado Libre" value={nombre} onChange={e => setNombre(e.target.value)} disabled={busy} autoFocus />

        <div className="field">
          <label className="field-label">Color</label>
          <div className="canal-color-picker">
            {CANAL_COLOR_OPTIONS.map(c => (
              <button
                key={c} type="button" disabled={busy}
                className={`canal-color-swatch app-card-icon--${c}${color === c ? ' is-selected' : ''}`}
                onClick={() => setColor(c)} aria-label={c}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label">Ícono</label>
          <div className="canal-icon-picker">
            {CANAL_ICON_OPTIONS.map(i => (
              <button
                key={i} type="button" disabled={busy}
                className={`canal-icon-option app-card-icon--${color}${icono === i ? ' is-selected' : ''}`}
                onClick={() => setIcono(i)} aria-label={i}
              >
                <Icon name={i} size={20} />
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : (editingCanal ? 'Guardar' : 'Crear')}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
