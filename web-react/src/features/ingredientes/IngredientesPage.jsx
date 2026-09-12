import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { useIngredientes } from './useIngredientes';
import IngredienteForm from './IngredienteForm';
import IngredienteRow from './IngredienteRow';
import IngredienteAutocomplete from './IngredienteAutocomplete';

// Página del módulo Ingredientes — equivalente a openIngredientesModal() +
// renderIngredientesList() en ../../../ingredientes.js, pero como vista de
// página (no modal) para que el piloto se pueda ver sin depender del resto
// de la navegación de la app todavía sin migrar. Un modal real (como el que
// usarán Compras/Procesos) usaría ../../hooks/useDirtyGuard.js para el aviso
// de "salir sin guardar", como hacía confirmCloseIfDirty() en utils.js.
export default function IngredientesPage() {
  const {
    ingredientes, loading, error,
    addIngrediente, updateUnidad, removeIngrediente, tryAddIngrediente
  } = useIngredientes();

  const [demoValue, setDemoValue] = useState('');

  const sorted = [...ingredientes].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <div className="section-header">
        <h1 className="section-title">Ingredientes</h1>
      </div>

      <Card>
        <IngredienteForm onAdd={addIngrediente} />
      </Card>

      <Card>
        <div className="section-header">
          <h2 className="section-title" style={{ fontSize: 14 }}>Catálogo</h2>
        </div>
        {loading && <div className="loading-state">Cargando…</div>}
        {error && <EmptyState>No se pudo cargar: {error}</EmptyState>}
        {!loading && !error && !sorted.length && (
          <EmptyState>No hay ingredientes registrados. Agrega el primero.</EmptyState>
        )}
        {!loading && !error && !!sorted.length && (
          <AnimatePresence initial={false}>
            {sorted.map(ing => (
              <IngredienteRow
                key={ing.rowIndex}
                ingrediente={ing}
                onUpdateUnidad={(ing2, unidad) => updateUnidad(ing2, unidad)}
                onDelete={removeIngrediente}
              />
            ))}
          </AnimatePresence>
        )}
      </Card>

      <Card>
        <div className="section-header">
          <h2 className="section-title" style={{ fontSize: 14 }}>
            Autocomplete (uso desde Compras/Procesos)
          </h2>
        </div>
        <IngredienteAutocomplete
          value={demoValue}
          onChange={setDemoValue}
          ingredientes={ingredientes}
          onAddNew={tryAddIngrediente}
          placeholder="Empieza a escribir un ingrediente…"
        />
      </Card>
    </motion.div>
  );
}
