import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Card from '../../components/ui/Card';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/layout/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import { useIngredientes } from '../ingredientes/useIngredientes';
import { useCompras } from './useCompras';
import CompraRow from './CompraRow';
import CompraModal from './CompraModal';
import InsumoModal from './InsumoModal';
import './CompraRow.css';

// Ingredientes y Compras fusionados en una sola pantalla: no hay un catálogo
// de ingredientes aparte (era una lista duplicada de lo que ya muestra esta
// tabla) — "agregar ingrediente" vive en el botón flotante del pie de
// pantalla y abre InsumoModal (alta rápida nombre+unidad).
export default function ComprasPage({ onBack }) {
  const { ingredientes, loading: loadingIng, addIngrediente } = useIngredientes();
  const { rows, loading: loadingCompras, error, saveCompra, removeCompra } = useCompras(ingredientes);

  const [openActionsFor, setOpenActionsFor] = useState(null);
  const [compraModal, setCompraModal] = useState(null); // { ingrediente, editRecord } | null
  const [insumoOpen, setInsumoOpen] = useState(false);
  const [search, setSearch] = useState('');

  const loading = loadingIng || loadingCompras;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.ingrediente.nombre.toLowerCase().includes(q));
  }, [rows, search]);

  // Tocar afuera de una fila/barra abierta la cierra — mismo comportamiento
  // que el listener global de renderComprasList() en ../../../compras.js.
  useEffect(() => {
    function handleDocClick(e) {
      if (!e.target.closest('.compra-row, .compra-row-actions')) setOpenActionsFor(null);
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <PageHeader title="Insumos" onBack={onBack} />

      <SearchBar value={search} onChange={setSearch} placeholder="Buscar ingrediente…" />

      <Card>
        {loading && <div className="loading-state">Cargando…</div>}
        {error && <EmptyState>No se pudo cargar: {error}</EmptyState>}
        {!loading && !error && !rows.length && (
          <EmptyState>No hay ingredientes registrados todavía. Agregá el primero con el botón "+".</EmptyState>
        )}
        {!loading && !error && !!rows.length && !filteredRows.length && (
          <EmptyState>Ningún ingrediente coincide con "{search.trim()}".</EmptyState>
        )}
        {!loading && !error && !!filteredRows.length && (
          <table className="compra-table">
            <thead>
              <tr><th>Ingrediente</th><th>Última compra</th><th>Precio unitario</th></tr>
            </thead>
            <tbody>
              {filteredRows.map(row => (
                <CompraRow
                  key={row.ingrediente.rowIndex}
                  row={row}
                  actionsOpen={openActionsFor === row.ingrediente.nombre}
                  onOpenActionsChange={setOpenActionsFor}
                  onEdit={r => { setOpenActionsFor(null); setCompraModal({ ingrediente: r.ingrediente, editRecord: r.last, lastUnitPrice: r.unitPrice }); }}
                  onRegister={r => setCompraModal({ ingrediente: r.ingrediente, editRecord: null, lastUnitPrice: r.unitPrice })}
                  onDelete={removeCompra}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <CompraModal
        open={!!compraModal}
        onClose={() => setCompraModal(null)}
        ingrediente={compraModal?.ingrediente}
        editRecord={compraModal?.editRecord || null}
        lastUnitPrice={compraModal?.lastUnitPrice ?? null}
        onSave={saveCompra}
      />

      <InsumoModal
        open={insumoOpen}
        onClose={() => setInsumoOpen(false)}
        onSave={(nombre, unidad) => addIngrediente(nombre, unidad)}
      />

      <FabButton onClick={() => setInsumoOpen(true)}>
        <Icon name="plus" size={16} /> Agregar ingrediente
      </FabButton>
    </motion.div>
  );
}
