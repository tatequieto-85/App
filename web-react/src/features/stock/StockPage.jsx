import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Card from '../../components/ui/Card';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/layout/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import { useStock } from './useStock';
import StockResumenTable from './StockResumenTable';
import StockTrazabilidadTable from './StockTrazabilidadTable';
import StockTestigoCard from './StockTestigoCard';
import AjusteModal from './AjusteModal';
import TestigoModal from './TestigoModal';
import './StockPage.css';

// Una sola vista (ya no hay pestañas): Resumen, después Producto testigo,
// después Trazabilidad — en ese orden, con un único buscador arriba que
// filtra las tres secciones a la vez.
export default function StockPage({ onBack }) {
  const {
    loading, error, resumenRows, trazabilidadRows, lotesConStock, testigoRows,
    saveAjuste, apartarTestigo, updateTestigoEstado, deleteTestigo
  } = useStock();

  const [search, setSearch] = useState('');
  const [ajusteReceta, setAjusteReceta] = useState(null);
  const [testigoOpen, setTestigoOpen] = useState(false);
  const [openTestigoActionsFor, setOpenTestigoActionsFor] = useState(null);

  useEffect(() => {
    function handleDocClick(e) {
      if (!e.target.closest('.stock-testigo-wrap')) setOpenTestigoActionsFor(null);
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  const q = search.trim().toLowerCase();
  const filteredResumen = useMemo(
    () => q ? resumenRows.filter(r => r.receta.nombre.toLowerCase().includes(q)) : resumenRows,
    [resumenRows, q]
  );
  const filteredTrazabilidad = useMemo(
    () => q ? trazabilidadRows.filter(r => r.ejecucion.nombreReceta.toLowerCase().includes(q) || (r.ejecucion.loteId || '').toLowerCase().includes(q)) : trazabilidadRows,
    [trazabilidadRows, q]
  );
  const filteredTestigo = useMemo(
    () => q ? testigoRows.filter(t => t.recetaNombre.toLowerCase().includes(q) || (t.loteId || '').toLowerCase().includes(q)) : testigoRows,
    [testigoRows, q]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <PageHeader title="Stock" onBack={onBack} />
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar producto, receta o lote…" />

      {loading && <Card><div className="loading-state">Cargando…</div></Card>}
      {error && <Card><EmptyState>No se pudo cargar: {error}</EmptyState></Card>}

      {!loading && !error && (
        <>
          <section>
            <h2 className="subsection-title">Resumen</h2>
            <Card>
              {resumenRows.length
                ? (filteredResumen.length
                    ? <StockResumenTable rows={filteredResumen} onOpenAjuste={setAjusteReceta} />
                    : <EmptyState>Ningún producto coincide con "{search.trim()}".</EmptyState>)
                : <EmptyState>No hay recetas registradas en Procesos.</EmptyState>}
            </Card>
          </section>

          <section>
            <h2 className="subsection-title">Producto testigo</h2>
            <Card>
              {testigoRows.length
                ? (filteredTestigo.length
                    ? filteredTestigo.map(t => (
                        <StockTestigoCard
                          key={t.id}
                          testigo={t}
                          actionsOpen={openTestigoActionsFor === t.id}
                          onOpenActionsChange={setOpenTestigoActionsFor}
                          onMarcarRevisado={x => updateTestigoEstado(x, 'revisado')}
                          onMarcarDescartado={x => updateTestigoEstado(x, 'descartado')}
                          onDelete={deleteTestigo}
                        />
                      ))
                    : <EmptyState>Ningún registro coincide con "{search.trim()}".</EmptyState>)
                : <EmptyState>Aún no hay producto testigo apartado.</EmptyState>}
            </Card>
          </section>

          <section>
            <h2 className="subsection-title">Trazabilidad</h2>
            <Card>
              {trazabilidadRows.length
                ? (filteredTrazabilidad.length
                    ? <StockTrazabilidadTable rows={filteredTrazabilidad} />
                    : <EmptyState>Ningún lote coincide con "{search.trim()}".</EmptyState>)
                : <EmptyState>No hay lotes con producción envasada registrada.</EmptyState>}
            </Card>
          </section>
        </>
      )}

      <AjusteModal open={!!ajusteReceta} onClose={() => setAjusteReceta(null)} receta={ajusteReceta} onSave={saveAjuste} />
      <TestigoModal open={testigoOpen} onClose={() => setTestigoOpen(false)} lotesConStock={lotesConStock} onSave={apartarTestigo} />

      <FabButton onClick={() => setTestigoOpen(true)}>
        <Icon name="plus" size={16} /> Apartar testigo
      </FabButton>
    </motion.div>
  );
}
