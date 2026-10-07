import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../../components/icons/Icon';
import { downloadDriveFile } from '../../services/googleAuth';
import { isToday } from '../../services/storiesApi';
import { fmtDateTime } from '../../utils/format';
import './StoryCard.css';

// Fila de historia programada — portado de storyCardHTML() en
// ../../../contenido.js. Sin onTap: la tarjeta ya muestra todo lo
// relevante de un vistazo (no hay un "detalle" aparte que abrir), "Publicar"
// y los accesos a Drive/Descargar quedan siempre visibles en el pie (no son
// destructivos), Editar/Borrar se revelan manteniendo presionada la
// tarjeta (regla 5).
export default function StoryCard({ story, actionsOpen, onLongPress, onEdit, onPublish, onDelete }) {
  const [busyPublish, setBusyPublish] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyDownload, setBusyDownload] = useState(false);

  const today = isToday(story.scheduledAt);
  const firstThumb = story.thumbUrls[0];
  const extraCount = story.driveFileIds.length > 1 ? story.driveFileIds.length : 0;
  const isVideo = story.mimeTypes[0]?.startsWith('video/');

  let pressTimer = null;
  function startPress(e) {
    if (e.target.closest('button')) return;
    pressTimer = setTimeout(onLongPress, 550);
  }
  function cancelPress() { clearTimeout(pressTimer); }

  async function handlePublish() {
    if (!window.confirm('¿Marcar como publicada? Esto eliminará la historia y sus archivos de Drive.')) return;
    setBusyPublish(true);
    try { await onPublish(story); } catch (err) { alert('Error: ' + err.message); setBusyPublish(false); }
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta historia y sus archivos de Drive?')) return;
    setBusyDelete(true);
    try { await onDelete(story); } catch (err) { alert('Error al eliminar: ' + err.message); setBusyDelete(false); }
  }

  async function handleDownload() {
    setBusyDownload(true);
    try {
      for (let i = 0; i < story.driveFileIds.length; i++) {
        await downloadDriveFile(story.driveFileIds[i], story.origNames[i]);
      }
    } catch (err) {
      alert('Error al descargar: ' + err.message);
    } finally {
      setBusyDownload(false);
    }
  }

  return (
    <div className="story-card-wrap">
      <div
        className={`story-card${today ? ' today' : ''}`}
        onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
        onTouchStart={startPress} onTouchMove={cancelPress} onTouchEnd={cancelPress}
      >
        <div className="story-thumb">
          {firstThumb ? (
            <img src={firstThumb} alt="" loading="lazy" onError={e => { e.target.style.display = 'none'; }} />
          ) : isVideo ? (
            <Icon name="film" size={26} />
          ) : story.driveFileIds.length ? (
            <Icon name="image" size={26} />
          ) : null}
          {!!extraCount && <span className="thumb-count">{extraCount}</span>}
        </div>
        <div className="story-body">
          <div className="story-title">
            {today && <span className="today-badge">HOY</span>}
            {story.title}
          </div>
          <div className="story-date"><Icon name="calendar" size={12} /> {fmtDateTime(story.scheduledAt)}</div>
          <div className="story-actions">
            {story.actions || <em style={{ opacity: .55 }}>Sin acciones especificadas</em>}
          </div>
          <div className="story-footer">
            <button type="button" className="btn-pub" disabled={busyPublish} onClick={handlePublish}>
              <Icon name="check" size={13} /> Publicada
            </button>
            <div className="story-footer-icons">
              {!!story.driveFileIds[0] && (
                <button
                  type="button" className="btn-sm" title="Ver en Drive"
                  onClick={() => window.open(`https://drive.google.com/file/d/${story.driveFileIds[0]}/view`, '_blank')}
                >
                  <Icon name="folder" size={14} />
                </button>
              )}
              {!!story.driveFileIds.length && (
                <button type="button" className="btn-sm btn-dl" title="Descargar archivo(s)" disabled={busyDownload} onClick={handleDownload}>
                  <Icon name={busyDownload ? 'spinner' : 'download'} size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {actionsOpen && (
          <motion.div
            className="row-actions-bar"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}
          >
            <button type="button" onClick={() => onEdit(story)}>Editar</button>
            <button type="button" className="danger" disabled={busyDelete} onClick={handleDelete}>Borrar</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
