import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../../components/icons/Icon';
import { fmtDateTime, fmtSeconds } from '../../utils/format';
import './IdeaCard.css';

// Tarjeta vertical de una idea guardada — portado de ideaMktCardHTML() en
// ../../../ideas-marketing.js. Igual que StoryCard, sin onTap (ya muestra
// todo), Editar/Borrar detrás de mantener presionada.
export default function IdeaCard({ idea, actionsOpen, onLongPress, onEdit, onDelete, onPlayAudio, playingFileId }) {
  const [busyDelete, setBusyDelete] = useState(false);

  const photos = idea.photoThumbUrls.slice(0, 4);
  const extraPhotos = idea.photoFileIds.length > 4 ? idea.photoFileIds.length - 4 : 0;

  let pressTimer = null;
  function startPress(e) {
    if (e.target.closest('button')) return;
    pressTimer = setTimeout(onLongPress, 550);
  }
  function cancelPress() { clearTimeout(pressTimer); }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta idea y sus archivos de Drive?')) return;
    setBusyDelete(true);
    try { await onDelete(idea); } catch (err) { alert('Error: ' + err.message); setBusyDelete(false); }
  }

  return (
    <div className="idea-mkt-card-wrap">
      <div
        className="idea-mkt-card"
        onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
        onTouchStart={startPress} onTouchMove={cancelPress} onTouchEnd={cancelPress}
      >
        {idea.categoria && <span className="idea-mkt-categoria">{idea.categoria}</span>}
        <div className="idea-mkt-desc">{idea.descripcion}</div>

        {!!photos.length && (
          <div className="idea-mkt-photos">
            {photos.map((u, i) => <img key={i} src={u} alt="" loading="lazy" onError={e => { e.target.style.display = 'none'; }} />)}
            {!!extraPhotos && <span className="thumb-count">+{extraPhotos}</span>}
          </div>
        )}

        {!!idea.audioFileIds.length && (
          <div className="idea-mkt-audios">
            {idea.audioFileIds.map((fid, i) => (
              <button
                key={fid} type="button" className="audio-chip"
                disabled={playingFileId === fid}
                onClick={() => onPlayAudio(fid)}
              >
                <Icon name={playingFileId === fid ? 'spinner' : 'mic'} size={13} />
                {fmtSeconds(idea.audioDurations[i] || 0)}
              </button>
            ))}
          </div>
        )}

        <div className="story-date">{fmtDateTime(idea.createdAt)}</div>
      </div>
      <AnimatePresence initial={false}>
        {actionsOpen && (
          <motion.div
            className="row-actions-bar"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}
          >
            <button type="button" onClick={() => onEdit(idea)}>Editar</button>
            <button type="button" className="danger" disabled={busyDelete} onClick={handleDelete}>Borrar</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
