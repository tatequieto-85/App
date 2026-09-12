import { useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import TextField from '../../components/ui/TextField';
import Button from '../../components/ui/Button';
import { normalizeIngName } from '../../services/ingredientesApi';
import './AgregarCompraModal.css';

// Primer paso del widget "Agregar compra": buscar el insumo con texto
// predictivo. Si existe, se elige y sigue directo a CompraModal (registrar
// la compra). Si no está, advierte y ofrece abrir el formulario completo de
// insumo nuevo — a diferencia de IngredienteAutocomplete (que resuelve el
// alta rápida inline con solo la unidad), acá el usuario pidió el formulario
// completo, no un atajo inline.
export default function AgregarCompraModal({ open, onClose, ingredientes, onPick, onCreateNew }) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ingredientes.filter(i => i.nombre.toLowerCase().includes(q));
  }, [ingredientes, query]);

  const exactMatch = useMemo(
    () => ingredientes.some(i => normalizeIngName(i.nombre) === normalizeIngName(query)),
    [ingredientes, query]
  );

  function handleClose() {
    setQuery('');
    onClose();
  }

  function pick(ing) {
    setQuery('');
    onPick(ing);
  }

  function createNew() {
    const nombre = query.trim();
    setQuery('');
    onCreateNew(nombre);
  }

  return (
    <Modal open={open} onClose={handleClose} title="Agregar compra">
      <TextField
        label="Insumo" placeholder="Empezá a escribir…" autoFocus
        value={query} onChange={e => setQuery(e.target.value)}
      />

      {matches.length > 0 && (
        <div className="agregar-compra-matches">
          {matches.map(ing => (
            <button key={ing.rowIndex} type="button" className="agregar-compra-match" onClick={() => pick(ing)}>
              {ing.nombre}
            </button>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && !exactMatch && (
        <div className="agregar-compra-warning">
          <p>No encontramos "{query.trim()}" en el catálogo.</p>
          <Button variant="outline" onClick={createNew}>Crear insumo nuevo</Button>
        </div>
      )}
    </Modal>
  );
}
