import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import TextField from '../../components/ui/TextField';
import { normalizeIngName } from '../../services/ingredientesApi';
import './IngredienteAutocomplete.css';

// Componente genérico y reutilizable, sin caller activo por ahora: Compras
// pasó a abrir CompraModal siempre con el ingrediente ya fijo (elegido desde
// la fila), así que ya no necesita elegir/crear un ingrediente por nombre acá.
// Queda listo para cuando se migre Procesos (mismo patrón que
// attachIngredienteAutocomplete en ../../../ingredientes.js) — solo depende
// de la lista que le pasen por props, no de ninguna página en particular.
export default function IngredienteAutocomplete({
  value, onChange, ingredientes, onAddNew, label = 'Ingrediente', placeholder
}) {
  const [open, setOpen] = useState(false);
  const [addingUnit, setAddingUnit] = useState(null); // nombre pendiente de unidad, o null
  const [unitDraft, setUnitDraft] = useState('');
  const blurTimeout = useRef(null);

  const matches = useMemo(() => {
    const val = value.trim().toLowerCase();
    if (!val) return [];
    return ingredientes.filter(ing => ing.nombre.toLowerCase().includes(val));
  }, [value, ingredientes]);

  const exactMatch = useMemo(
    () => ingredientes.some(ing => normalizeIngName(ing.nombre) === normalizeIngName(value)),
    [ingredientes, value]
  );

  const showDropdown = open && value.trim().length > 0 &&
    (matches.length > 0 || (!exactMatch && value.trim().length >= 2));

  function scheduleClose() {
    blurTimeout.current = setTimeout(() => { setOpen(false); setAddingUnit(null); }, 180);
  }
  function cancelClose() {
    clearTimeout(blurTimeout.current);
  }

  function pick(nombre) {
    onChange(nombre);
    setOpen(false);
  }

  async function confirmAdd() {
    const nombre = addingUnit;
    setAddingUnit(null);
    const result = await onAddNew(nombre, unitDraft.trim());
    if (result) onChange(result);
    setUnitDraft('');
    setOpen(false);
  }

  return (
    <div className="autocomplete-wrap" onMouseDown={cancelClose}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={scheduleClose}
      />
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            className="ingrediente-autocomplete"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: .12 }}
          >
            {addingUnit ? (
              <div className="autocomplete-add-form">
                <span className="autocomplete-add-label">Unidad para "{addingUnit}":</span>
                <input
                  autoFocus
                  className="autocomplete-add-input"
                  placeholder="g, kg, L, unidades…"
                  value={unitDraft}
                  onChange={e => setUnitDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); confirmAdd(); }
                    if (e.key === 'Escape') { e.preventDefault(); setAddingUnit(null); }
                  }}
                />
                <button type="button" className="autocomplete-add-confirm" onClick={confirmAdd}>
                  Agregar
                </button>
              </div>
            ) : (
              <>
                {matches.map(ing => (
                  <div
                    key={ing.rowIndex}
                    className="autocomplete-option"
                    onMouseDown={e => { e.preventDefault(); pick(ing.nombre); }}
                  >
                    {ing.nombre}
                  </div>
                ))}
                {!exactMatch && value.trim().length >= 2 && (
                  <div
                    className="autocomplete-option autocomplete-add"
                    onMouseDown={e => { e.preventDefault(); setAddingUnit(value.trim()); }}
                  >
                    + Agregar "<strong>{value.trim()}</strong>"
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
