import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Card from '../../components/ui/Card';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/layout/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import Tabs from '../../components/ui/Tabs';
import { useStock } from './useStock';
import StockResumenTable from './StockResumenTable';
import StockTrazabilidadTable from './StockTrazabilidadTable';
import StockTestigoCard from './StockTestigoCard';
import AjusteModal from './AjusteModal';
import TestigoModal from './TestigoModal';
import './StockPage.css';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'trazabilidad', label: 'Trazabilidad' },
  { id: 'testigo', label: 'Producto testigo' }
];

export default function StockPage({ onBack }) {
  const {
    loading, error, resumenRows, trazabilidadRows, lotesConStock, testigoRows,
    saveAjuste, apartarTestigo, updateTestigoEstado, deleteTestigo
  } = useStock();

  const [tab, setTab] = useState('resumen');
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
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <SearchBar
        value={search} onChange={setSearch}
        placeholder={tab === 'testigo' ? 'Buscar por receta o lote…' : 'Buscar producto…'}
      />

      <Card>
        {loading && <div className="loading-state">Cargando…</div>}
        {error && <EmptyState>No se pudo cargar: {error}</EmptyState>}

        {!loading && !error && tab === 'resumen' && (
          resumenRows.length
            ? (filteredResumen.length
                ? <StockResumenTable rows={filteredResumen} onOpenAjuste={setAjusteReceta} />
                : <EmptyState>Ningún producto coincide con "{search.trim()}".</EmptyState>)
            : <EmptyState>No hay recetas registradas en Procesos.</EmptyState>
        )}

        {!loading && !error && tab === 'trazabilidad' && (
          trazabilidadRows.length
            ? (filteredTrazabilidad.length
                ? <StockTrazabilidadTable rows={filteredTrazabilidad} />
                : <EmptyState>Ningún lote coincide con "{search.trim()}".</EmptyState>)
            : <EmptyState>No hay lotes con producción envasada registrada.</EmptyState>
        )}

        {!loading && !error && tab === 'testigo' && (
          testigoRows.length
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
            : <EmptyState>Aún no hay producto testigo apartado.</EmptyState>
        )}
      </Card>

      <AjusteModal open={!!ajusteReceta} onClose={() => setAjusteReceta(null)} receta={ajusteReceta} onSave={saveAjuste} />
      <TestigoModal open={testigoOpen} onClose={() => setTestigoOpen(false)} lotesConStock={lotesConStock} onSave={apartarTestigo} />

      {tab === 'testigo' && (
        <FabButton onClick={() => setTestigoOpen(true)}>
          <Icon name="plus" size={16} /> Apartar testigo
        </FabButton>
      )}
    </motion.div>
  );
}
