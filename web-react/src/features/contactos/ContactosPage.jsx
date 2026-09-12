import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Card from '../../components/ui/Card';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/layout/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import { useContactos } from './useContactos';
import ContactoCard from './ContactoCard';
import ContactoModal from './ContactoModal';
import ContactoDetailModal from './ContactoDetailModal';
import './ContactoCard.css';

// Busca la palabra escrita en nombre, empresa, posición y teléfono —
// cualquier campo que matchee alcanza.
function matchesSearch(c, query) {
  if (!query) return true;
  return [c.nombre, c.empresa, c.posicion, c.telefono].some(campo => (campo || '').toLowerCase().includes(query));
}

export default function ContactosPage({ onBack }) {
  const {
    contactos, loading, error, empresas, ciudades, categorias,
    relacionesDe, saveContacto, deleteContacto, addRelacion, removeRelacion, addObservacion
  } = useContactos();

  const [search, setSearch] = useState('');
  const [openActionsFor, setOpenActionsFor] = useState(null);
  const [modalState, setModalState] = useState(null); // { editing: contacto | null } | null
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    function handleDocClick(e) {
      if (!e.target.closest('.contacto-card-wrap')) setOpenActionsFor(null);
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  const q = search.trim().toLowerCase();
  const visibles = useMemo(() => contactos.filter(c => matchesSearch(c, q)), [contactos, q]);

  const detailContacto = detailId ? contactos.find(c => c.id === detailId) : null;
  const editingContacto = modalState?.editing || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <PageHeader title="Contactos" onBack={onBack} />
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar contacto…" />

      <Card>
        {loading && <div className="loading-state">Cargando…</div>}
        {error && <EmptyState>No se pudo cargar: {error}</EmptyState>}
        {!loading && !error && !contactos.length && <EmptyState>Aún no hay contactos guardados</EmptyState>}
        {!loading && !error && !!contactos.length && !visibles.length && (
          <EmptyState>Ningún contacto coincide con "{search.trim()}".</EmptyState>
        )}
        {!loading && !error && !!visibles.length && (
          <div className="contactos-grid">
            {visibles.map(c => (
              <ContactoCard
                key={c.id}
                contacto={c}
                primerVinculo={relacionesDe(c.id)[0]}
                actionsOpen={openActionsFor === c.id}
                onOpenActionsChange={setOpenActionsFor}
                onOpenDetail={setDetailId}
                onEdit={c2 => { setOpenActionsFor(null); setModalState({ editing: c2 }); }}
                onDelete={deleteContacto}
              />
            ))}
          </div>
        )}
      </Card>

      <ContactoModal
        open={!!modalState}
        onClose={() => setModalState(null)}
        editingContacto={editingContacto}
        empresas={empresas}
        ciudades={ciudades}
        categorias={categorias}
        vinculos={editingContacto ? relacionesDe(editingContacto.id) : []}
        otrosContactos={editingContacto ? contactos.filter(c => c.id !== editingContacto.id) : []}
        onSave={saveContacto}
        onAddRelacion={addRelacion}
        onRemoveRelacion={removeRelacion}
      />

      <ContactoDetailModal
        open={!!detailContacto}
        onClose={() => setDetailId(null)}
        contacto={detailContacto}
        vinculos={detailContacto ? relacionesDe(detailContacto.id) : []}
        onAddObservacion={addObservacion}
      />

      <FabButton onClick={() => setModalState({ editing: null })}>
        <Icon name="plus" size={16} /> Nuevo contacto
      </FabButton>
    </motion.div>
  );
}
