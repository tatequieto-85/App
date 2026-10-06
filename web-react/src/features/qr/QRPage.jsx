import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '../../components/layout/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import EmptyState from '../../components/ui/EmptyState';
import { useQR } from './useQR';
import QRCard from './QRCard';
import QRModal from './QRModal';
import './QRPage.css';

// Generar y guardar códigos QR — portado de ../../../qr.js. Cada código
// queda guardado con su imagen (data URL) en la hoja "QR", para volver a
// descargarlo o copiar su link después sin tener que regenerarlo.
export default function QRPage({ onBack }) {
  const { loading, error, rows, generarQR, deleteQR } = useQR();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () => q ? rows.filter(r => r.nombre.toLowerCase().includes(q) || r.link.toLowerCase().includes(q)) : rows,
    [rows, q]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <PageHeader title="QR" onBack={onBack} />
      {rows.length > 0 && <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre o link…" />}

      {loading && <div className="loading-state">Cargando…</div>}
      {error && <EmptyState>No se pudo cargar: {error}</EmptyState>}

      {!loading && !error && (
        !rows.length ? (
          <EmptyState>Todavía no generaste ningún código QR.</EmptyState>
        ) : !filtered.length ? (
          <EmptyState>Ningún código coincide con "{search.trim()}".</EmptyState>
        ) : (
          <div className="qr-list">
            {filtered.map(qrItem => (
              <QRCard key={qrItem.id} qr={qrItem} onDelete={deleteQR} />
            ))}
          </div>
        )
      )}

      <FabButton onClick={() => setModalOpen(true)}>
        <Icon name="plus" size={16} /> Generar QR
      </FabButton>

      <QRModal open={modalOpen} onClose={() => setModalOpen(false)} onGenerar={generarQR} />
    </motion.div>
  );
}
