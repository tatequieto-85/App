import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/layout/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import { useIngredientes } from '../ingredientes/useIngredientes';
import { useCompras } from './useCompras';
import { useInventarioExtra } from './useInventarioExtra';
import { esUnidadDePeso, fetchRecetas, renameIngredienteEnRecetas } from '../../services/recetasApi';
import { renameIngredienteEnCompras } from '../../services/comprasApi';
import { normalizeIngName } from '../../services/ingredientesApi';
import CompraRow from './CompraRow';
import CompraModal from './CompraModal';
import InsumoModal from './InsumoModal';
import AjustarStockModal from './AjustarStockModal';
import ActivoCard from './ActivoCard';
import ActivoModal from './ActivoModal';
import './CompraRow.css';
import './ComprasPage.css';

// "Inventario" (antes "Insumos") — a pedido explícito del usuario, dos
// secciones separadas por una línea muy sutil (mismo patrón que los grupos
// de Procesos): Insumos (ingredientes+compras — incluye materia prima como
// envases/etiquetas/tapas, con Categoría/Mínimo opcionales, ver
// InsumoModal.jsx) e Inventario de activos (herramientas/maquinaria/
// equipos). Un único buscador arriba filtra ambas a la vez, mismo criterio
// que Stock. "Inventario de materia prima" existió como una sección propia
// aparte, pero resultó duplicar lo que ya hacía Insumos una vez que tuvo
// "Disponible" — el usuario lo notó y pidió fusionarla (ver
// migrateMateriaPrima() en ingredientesApi.js para los datos que ya
// hubiera en la hoja vieja).
export default function ComprasPage({ onBack }) {
  const { ingredientes, loading: loadingIng, addIngrediente, updateIngredienteInfo, ajustarStock, reload: reloadIngredientes } = useIngredientes();
  const { compras, cajas, rows, loading: loadingCompras, error, saveCompra, removeCompra, reload: reloadCompras } = useCompras(ingredientes, reloadIngredientes);
  const { activos, loading: loadingInv, error: errorInv, saveActivo, deleteActivo } = useInventarioExtra();

  const [openActionsFor, setOpenActionsFor] = useState(null);
  const [compraModal, setCompraModal] = useState(null); // { ingrediente, editRecord } | null
  const [insumoModal, setInsumoModal] = useState(null); // { editing } | null
  const [ajusteStockFor, setAjusteStockFor] = useState(null); // ingrediente | null
  const [search, setSearch] = useState('');

  const [actActionsFor, setActActionsFor] = useState(null);
  const [actModal, setActModal] = useState(null); // { editing } | null

  const loading = loadingIng || loadingCompras;

  const q = search.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!q) return rows;
    return rows.filter(r => r.ingrediente.nombre.toLowerCase().includes(q) || r.ingrediente.categoria?.toLowerCase().includes(q));
  }, [rows, q]);
  // Mismo criterio que agrupa los ingredientes de una receta en Procesos
  // (ver RecetaIngredientesTable.jsx) — por peso/volumen (g/kg/ml/L) vs por
  // unidad (conteo, p. ej. frascos/etiquetas), a pedido explícito del
  // usuario. Sin unidad cargada todavía, cae al grupo "por peso" por
  // defecto, mismo comportamiento que en Procesos.
  const rowsPorPeso = useMemo(() => filteredRows.filter(r => !r.ingrediente.unidad || esUnidadDePeso(r.ingrediente.unidad)), [filteredRows]);
  const rowsPorUnidad = useMemo(() => filteredRows.filter(r => r.ingrediente.unidad && !esUnidadDePeso(r.ingrediente.unidad)), [filteredRows]);
  const filteredActivos = useMemo(() => {
    if (!q) return activos;
    return activos.filter(a => a.nombre.toLowerCase().includes(q));
  }, [activos, q]);

  const ingCategorias = useMemo(() => [...new Set(ingredientes.map(i => i.categoria).filter(Boolean))], [ingredientes]);
  const actCategorias = useMemo(() => [...new Set(activos.map(a => a.categoria).filter(Boolean))], [activos]);

  // Corregir el nombre de un insumo (ver InsumoModal "Editar insumo") no
  // solo renombra el catálogo: si el nombre cambió de verdad, las compras
  // ya registradas y las recetas que ya usaban ese ingrediente quedarían
  // huérfanas (dejan de matchear por normalizeIngName) — se migran en el
  // mismo momento. La migración de Recetas es "mejor esfuerzo": si falla
  // (p. ej. la hoja de recetas no existe todavía) no bloquea el renombre
  // del insumo en sí, igual que el egreso automático de Contabilidad en
  // useCompras.js.
  async function handleSaveInsumo(nombre, unidad, categoria, minimo) {
    if (insumoModal?.editing) {
      const ing = insumoModal.editing;
      const nombreViejo = ing.nombre;
      const nombreNuevo = await updateIngredienteInfo(ing, { nombre, unidad, categoria, minimo });
      if (normalizeIngName(nombreViejo) !== normalizeIngName(nombreNuevo)) {
        await renameIngredienteEnCompras(compras, nombreViejo, nombreNuevo);
        await reloadCompras();
        try {
          const recetasActuales = await fetchRecetas();
          await renameIngredienteEnRecetas(recetasActuales, nombreViejo, nombreNuevo);
        } catch { /* Recetas es mejor esfuerzo — no bloquea el renombre del insumo */ }
      }
    } else {
      await addIngrediente(nombre, unidad, categoria, minimo);
    }
    setInsumoModal(null);
  }

  // Tocar afuera de una fila/barra abierta la cierra — mismo comportamiento
  // que el listener global de renderComprasList() en ../../../compras.js.
  useEffect(() => {
    function handleDocClick(e) {
      if (!e.target.closest('.compra-row, .compra-row-actions')) setOpenActionsFor(null);
      if (!e.target.closest('.activo-card-wrap')) setActActionsFor(null);
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
      <PageHeader title="Inventario" onBack={onBack} />

      <SearchBar value={search} onChange={setSearch} placeholder="Buscar en insumos o activos…" />

      <section className="inventario-section">
        <h2 className="subsection-title">Insumos</h2>
        <Card>
          {loading && <div className="loading-state">Cargando…</div>}
          {error && <EmptyState>No se pudo cargar: {error}</EmptyState>}
          {!loading && !error && !rows.length && (
            <EmptyState>No hay ingredientes registrados todavía. Agregá el primero con el botón "+".</EmptyState>
          )}
          {!loading && !error && !!rows.length && !filteredRows.length && (
            <EmptyState>Ningún ingrediente coincide con "{search.trim()}".</EmptyState>
          )}
          {!loading && !error && !!rowsPorPeso.length && (
            <>
              {!!rowsPorUnidad.length && <h5 className="inventario-group-title">Por peso / volumen</h5>}
              <table className="compra-table">
                <thead>
                  <tr><th>Ingrediente</th><th>Precio unitario</th><th>Disponible</th></tr>
                </thead>
                <tbody>
                  {rowsPorPeso.map(row => (
                    <CompraRow
                      key={row.ingrediente.rowIndex}
                      row={row}
                      actionsOpen={openActionsFor === row.ingrediente.nombre}
                      onOpenActionsChange={setOpenActionsFor}
                      onEdit={r => { setOpenActionsFor(null); setCompraModal({ ingrediente: r.ingrediente, editRecord: r.last, lastUnitPrice: r.unitPrice }); }}
                      onEditInsumo={ing => { setOpenActionsFor(null); setInsumoModal({ editing: ing }); }}
                      onAjustarStock={ing => { setOpenActionsFor(null); setAjusteStockFor(ing); }}
                      onRegister={r => setCompraModal({ ingrediente: r.ingrediente, editRecord: null, lastUnitPrice: r.unitPrice })}
                      onDelete={removeCompra}
                    />
                  ))}
                </tbody>
              </table>
            </>
          )}
          {!!rowsPorUnidad.length && (
            <>
              <h5 className="inventario-group-title">Por unidad</h5>
              <table className="compra-table">
                <thead>
                  <tr><th>Ingrediente</th><th>Precio unitario</th><th>Disponible</th></tr>
                </thead>
                <tbody>
                  {rowsPorUnidad.map(row => (
                    <CompraRow
                      key={row.ingrediente.rowIndex}
                      row={row}
                      actionsOpen={openActionsFor === row.ingrediente.nombre}
                      onOpenActionsChange={setOpenActionsFor}
                      onEdit={r => { setOpenActionsFor(null); setCompraModal({ ingrediente: r.ingrediente, editRecord: r.last, lastUnitPrice: r.unitPrice }); }}
                      onEditInsumo={ing => { setOpenActionsFor(null); setInsumoModal({ editing: ing }); }}
                      onAjustarStock={ing => { setOpenActionsFor(null); setAjusteStockFor(ing); }}
                      onRegister={r => setCompraModal({ ingrediente: r.ingrediente, editRecord: null, lastUnitPrice: r.unitPrice })}
                      onDelete={removeCompra}
                    />
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>
      </section>

      <section className="inventario-section">
        <div className="inventario-section-head">
          <h2 className="subsection-title">Inventario de activos</h2>
          <Button type="button" variant="outline" onClick={() => setActModal({ editing: null })}>
            <Icon name="plus" size={13} /> Activo
          </Button>
        </div>
        {loadingInv && <Card><div className="loading-state">Cargando…</div></Card>}
        {errorInv && <Card><EmptyState>No se pudo cargar: {errorInv}</EmptyState></Card>}
        {!loadingInv && !errorInv && !activos.length && (
          <Card><EmptyState>Aún no hay activos registrados (herramientas, maquinaria, equipos…).</EmptyState></Card>
        )}
        {!loadingInv && !errorInv && !!activos.length && !filteredActivos.length && (
          <Card><EmptyState>Nada coincide con "{search.trim()}".</EmptyState></Card>
        )}
        {!loadingInv && !errorInv && filteredActivos.map(activo => (
          <ActivoCard
            key={activo.id} activo={activo}
            actionsOpen={actActionsFor === activo.id}
            onOpenActionsChange={setActActionsFor}
            onEdit={a => { setActActionsFor(null); setActModal({ editing: a }); }}
            onDelete={deleteActivo}
          />
        ))}
      </section>

      <CompraModal
        open={!!compraModal}
        onClose={() => setCompraModal(null)}
        ingrediente={compraModal?.ingrediente}
        editRecord={compraModal?.editRecord || null}
        lastUnitPrice={compraModal?.lastUnitPrice ?? null}
        cajas={cajas}
        onSave={saveCompra}
      />

      <InsumoModal
        open={!!insumoModal}
        onClose={() => setInsumoModal(null)}
        editing={insumoModal?.editing || null}
        categorias={ingCategorias}
        onSave={handleSaveInsumo}
      />

      <AjustarStockModal
        open={!!ajusteStockFor}
        onClose={() => setAjusteStockFor(null)}
        ingrediente={ajusteStockFor}
        onSave={ajustarStock}
      />

      <ActivoModal
        open={!!actModal}
        onClose={() => setActModal(null)}
        editing={actModal?.editing || null}
        categorias={actCategorias}
        onSave={saveActivo}
      />

      <FabButton onClick={() => setInsumoModal({ editing: null })}>
        <Icon name="plus" size={16} /> Agregar ingrediente
      </FabButton>
    </motion.div>
  );
}
