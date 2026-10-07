import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '../../components/layout/PageHeader';
import Tabs from '../../components/ui/Tabs';
import SearchBar from '../../components/ui/SearchBar';
import FabButton from '../../components/ui/FabButton';
import Icon from '../../components/icons/Icon';
import EmptyState from '../../components/ui/EmptyState';
import { useStories } from './useStories';
import { useIdeasMarketing } from './useIdeasMarketing';
import { streamDriveFile } from '../../services/googleAuth';
import { isToday } from '../../services/storiesApi';
import { requestAppBadgePermission } from '../../utils/appBadge';
import StoryCard from './StoryCard';
import StoryModal from './StoryModal';
import StoryEditModal from './StoryEditModal';
import IdeaCard from './IdeaCard';
import IdeaModal from './IdeaModal';
import IdeaEditModal from './IdeaEditModal';
import './ContenidoPage.css';

const TABS = [{ id: 'historias', label: 'Historias' }, { id: 'ideas', label: 'Ideas de marketing' }];

// Contenido — historias de Instagram programadas + banco de ideas de
// marketing (vive dentro de esta misma vista, como submenú vía Tabs — ver
// CLAUDE.md). Portado de ../../../contenido.js e ../../../ideas-marketing.js,
// sin el modal de Configuración/WhatsApp (alcance acordado con el usuario:
// ese recordatorio lo sigue mandando Google Apps Script server-side sin
// importar esta UI).
export default function ContenidoPage({ onBack }) {
  const { stories, loading: loadingStories, error: errorStories, createStory, editStory, removeStory } = useStories();
  const { ideas, loading: loadingIdeas, error: errorIdeas, createIdea, editIdea, removeIdea } = useIdeasMarketing();

  const [tab, setTab] = useState('historias');
  const [search, setSearch] = useState('');

  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState(null);
  const [storyActionsFor, setStoryActionsFor] = useState(null);

  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState(null);
  const [ideaActionsFor, setIdeaActionsFor] = useState(null);
  const [playingFileId, setPlayingFileId] = useState(null);

  const [badgeMsg, setBadgeMsg] = useState('');
  const supportsBadge = typeof navigator !== 'undefined' && 'setAppBadge' in navigator;

  useEffect(() => {
    function onDocClick(e) {
      if (!e.target.closest('.story-card-wrap')) setStoryActionsFor(null);
      if (!e.target.closest('.idea-mkt-card-wrap')) setIdeaActionsFor(null);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const q = search.trim().toLowerCase();
  const filteredStories = useMemo(
    () => q ? stories.filter(s => s.title.toLowerCase().includes(q) || s.actions.toLowerCase().includes(q)) : stories,
    [stories, q]
  );
  const filteredIdeas = useMemo(
    () => q ? ideas.filter(i => i.descripcion.toLowerCase().includes(q) || i.categoria.toLowerCase().includes(q)) : ideas,
    [ideas, q]
  );

  const todayStories = useMemo(() => stories.filter(s => isToday(s.scheduledAt)), [stories]);

  async function handlePlayAudio(fileId) {
    setPlayingFileId(fileId);
    try {
      const url = await streamDriveFile(fileId);
      const player = document.getElementById('ideaMktPlayer');
      player.src = url;
      await player.play();
    } catch (err) {
      alert('Error al reproducir: ' + err.message);
    } finally {
      setPlayingFileId(null);
    }
  }

  async function handleActivarBadge() {
    const { msg } = await requestAppBadgePermission();
    setBadgeMsg(msg);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <PageHeader title="Contenido" onBack={onBack} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'historias' ? (
        <>
          {!!stories.length && (
            <div className="contenido-tab-head">
              <SearchBar value={search} onChange={setSearch} placeholder="Buscar por título o acciones…" />
              <span className="badge">{stories.length} pendiente{stories.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {!!todayStories.length && (
            <div className="today-alert">
              {todayStories.length === 1 ? 'Tienes 1 historia para publicar HOY' : `Tienes ${todayStories.length} historias para publicar HOY`}
            </div>
          )}

          {loadingStories && <div className="loading-state">Cargando…</div>}
          {errorStories && <EmptyState>No se pudo cargar: {errorStories}</EmptyState>}

          {!loadingStories && !errorStories && (
            !stories.length ? (
              <EmptyState>Aún no hay historias programadas</EmptyState>
            ) : !filteredStories.length ? (
              <EmptyState>Ninguna historia coincide con "{search.trim()}".</EmptyState>
            ) : (
              <div className="stories-list">
                {filteredStories.map(s => (
                  <StoryCard
                    key={s.id} story={s}
                    actionsOpen={storyActionsFor === s.id}
                    onLongPress={() => setStoryActionsFor(s.id)}
                    onEdit={st => { setStoryActionsFor(null); setEditingStory(st); }}
                    onPublish={removeStory}
                    onDelete={removeStory}
                  />
                ))}
              </div>
            )
          )}

          {supportsBadge && (
            <div className="contenido-badge-opt">
              <button type="button" className="btn-link-subtle" onClick={handleActivarBadge}>
                Activar contador en el ícono
              </button>
              {badgeMsg && <span className="contenido-badge-msg">{badgeMsg}</span>}
            </div>
          )}

          <FabButton onClick={() => setStoryModalOpen(true)}>
            <Icon name="plus" size={16} /> Nueva historia
          </FabButton>
        </>
      ) : (
        <>
          {!!ideas.length && <SearchBar value={search} onChange={setSearch} placeholder="Buscar por descripción o categoría…" />}

          {loadingIdeas && <div className="loading-state">Cargando…</div>}
          {errorIdeas && <EmptyState>No se pudo cargar: {errorIdeas}</EmptyState>}

          {!loadingIdeas && !errorIdeas && (
            !ideas.length ? (
              <EmptyState>Aún no hay ideas guardadas</EmptyState>
            ) : !filteredIdeas.length ? (
              <EmptyState>Ninguna idea coincide con "{search.trim()}".</EmptyState>
            ) : (
              <div className="ideas-mkt-list">
                {filteredIdeas.map(i => (
                  <IdeaCard
                    key={i.id} idea={i}
                    actionsOpen={ideaActionsFor === i.id}
                    onLongPress={() => setIdeaActionsFor(i.id)}
                    onEdit={it => { setIdeaActionsFor(null); setEditingIdea(it); }}
                    onDelete={removeIdea}
                    onPlayAudio={handlePlayAudio}
                    playingFileId={playingFileId}
                  />
                ))}
              </div>
            )
          )}

          <audio id="ideaMktPlayer" hidden />

          <FabButton onClick={() => setIdeaModalOpen(true)}>
            <Icon name="plus" size={16} /> Nueva idea
          </FabButton>
        </>
      )}

      <StoryModal open={storyModalOpen} onClose={() => setStoryModalOpen(false)} onSave={createStory} />
      <StoryEditModal open={!!editingStory} onClose={() => setEditingStory(null)} story={editingStory} onSave={editStory} />

      <IdeaModal open={ideaModalOpen} onClose={() => setIdeaModalOpen(false)} onSave={createIdea} />
      <IdeaEditModal open={!!editingIdea} onClose={() => setEditingIdea(null)} idea={editingIdea} onSave={editIdea} />
    </motion.div>
  );
}
