import { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '../../components/ui/Button';
import Icon from '../../components/icons/Icon';
import './IngredienteRow.css';

export default function IngredienteRow({ ingrediente, onUpdateUnidad, onDelete }) {
  const [unidad, setUnidad] = useState(ingrediente.unidad);
  const [busy, setBusy] = useState(false);

  async function commitUnidad() {
    const trimmed = unidad.trim();
    if (trimmed === ingrediente.unidad) return;
    setBusy(true);
    try {
      await onUpdateUnidad(ingrediente, trimmed);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar "${ingrediente.nombre}"?`)) return;
    setBusy(true);
    await onDelete(ingrediente.rowIndex);
  }

  return (
    <motion.div
      className="ing-row"
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: .18 }}
    >
      <span className="ing-row-name">{ingrediente.nombre}</span>
      <input
        className="field-input ing-row-unidad"
        type="text"
        value={unidad}
        placeholder="Unidad"
        disabled={busy}
        onChange={e => setUnidad(e.target.value)}
        onBlur={commitUnidad}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      <Button variant="sm" disabled={busy} onClick={handleDelete} aria-label="Eliminar">
        <Icon name="trash" size={14} />
      </Button>
    </motion.div>
  );
}
