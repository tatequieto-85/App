import { useState } from 'react';
import { motion } from 'framer-motion';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { useIngredientes } from '../ingredientes/useIngredientes';
import { useCompras } from './useCompras';
import CompraRow from './CompraRow';
import CompraModal from './CompraModal';
import HistorialModal from './HistorialModal';
import InsumoModal from './InsumoModal';
import './CompraRow.css';

// Equivalente a la vista de Compras en ../../../compras.js — combina el
// catálogo de useIngredientes (mismo hook que ya usa IngredientesPage) con
// useCompras para las filas ingrediente+última compra+precio unitario.
export default function ComprasPage() {
  const { ingredientes, loading: loadingIng, tryAddIngrediente, addIngrediente } = useIngredientes();
  const { rows, loading: loadingCompras, error, historialFor, saveCompra, removeCompra } = useCompras(ingredientes);

  const [openActionsFor, setOpenActionsFor] = useState(null);
  const [compraModal, setCompraModal] = useState(null); // { editRecord } | { prefillNombre } | null
  const [historialNombre, setHistorialNombre] = useState(null);
  const [insumoOpen, setInsumoOpen] = useState(false);

  const loading = loadingIng || loadingCompras;
  const historialRow = historialNombre ? rows.find(r => r.ingrediente.nombre === historialNombre) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <div className="section-header">
        <h1 className="section-title">Compras</h1>
        <Button variant="outline" onClick={() => setInsumoOpen(true)}>Nuevo insumo</Button>
      </div>

      <Card>
        {loading && <div className="loading-state">Cargando…</div>}
        {error && <EmptyState>No se pudo cargar: {error}</EmptyState>}
        {!loading && !error && !rows.length && (
          <EmptyState>No hay ingredientes registrados todavía. Agrégalos con "Nuevo insumo".</EmptyState>
        )}
        {!loading && !error && !!rows.length && (
          <table className="compra-table">
            <thead>
              <tr><th>Ingrediente</th><th>Última compra</th><th>Precio unitario</th><th /></tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <CompraRow
                  key={row.ingrediente.rowIndex}
                  row={row}
                  actionsOpen={openActionsFor === row.ingrediente.nombre}
                  onOpenActionsChange={setOpenActionsFor}
                  onEdit={editRecord => { setOpenActionsFor(null); setCompraModal({ editRecord }); }}
                  onHistorial={nombre => { setOpenActionsFor(null); setHistorialNombre(nombre); }}
                  onDelete={removeCompra}
                  onRegister={nombre => setCompraModal({ prefillNombre: nombre })}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <CompraModal
        open={!!compraModal}
        onClose={() => setCompraModal(null)}
        ingredientes={ingredientes}
        editRecord={compraModal?.editRecord || null}
        prefillNombre={compraModal?.prefillNombre || ''}
        onSave={saveCompra}
        onAddIngrediente={tryAddIngrediente}
      />

      <HistorialModal
        open={!!historialNombre}
        onClose={() => setHistorialNombre(null)}
        nombre={historialNombre}
        unidad={historialRow?.ingrediente.unidad}
        list={historialNombre ? historialFor(historialNombre) : []}
        onDelete={removeCompra}
      />

      <InsumoModal
        open={insumoOpen}
        onClose={() => setInsumoOpen(false)}
        onSave={(nombre, unidad) => addIngrediente(nombre, unidad)}
      />
    </motion.div>
  );
}
