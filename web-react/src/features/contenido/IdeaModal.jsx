import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Textarea from '../../components/ui/Textarea';
import Select from '../../components/ui/Select';
import Feedback from '../../components/ui/Feedback';
import Icon from '../../components/icons/Icon';
import Dropzone from './Dropzone';
import { useFeedback } from '../../hooks/useFeedback';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { useAudioRecorder } from './useAudioRecorder';
import { CATEGORIAS } from '../../services/ideasMarketingApi';
import { fmtSeconds } from '../../utils/format';
import './AudioRecorder.css';

const CATEGORIA_OPTIONS = [{ value: '', label: 'Elegí una…' }, ...CATEGORIAS.map(c => ({ value: c, label: c }))];

// Nueva idea de marketing — portado del formulario de
// ../../../ideas-marketing.js (fotos + notas de voz grabadas + descripción
// + categoría obligatoria).
export default function IdeaModal({ open, onClose, onSave }) {
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [feedback, showFeedback] = useFeedback();
  const recorder = useAudioRecorder();

  useEffect(() => {
    if (!open) return;
    setDescripcion(''); setCategoria(''); setPhotos([]); setProgress(null);
    recorder.clearAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isDirty = () => !!(descripcion.trim() || categoria || photos.length || recorder.clips.length);

  // Si el modal se cierra a mitad de una grabación, hay que parar primero
  // (libera el micrófono) — mismo criterio que closeIdeaMktModal() en la
  // app vanilla.
  function handleCloseAttempt() {
    if (recorder.recording) recorder.stop();
    close();
  }
  const close = useDirtyGuard(isDirty, onClose);

  async function handleSubmit(e) {
    e.preventDefault();
    const descTrim = descripcion.trim();
    if (!descTrim) return showFeedback('La descripción es obligatoria.', 'err');
    if (!categoria) return showFeedback('Elegí una categoría.', 'err');
    if (recorder.recording) recorder.stop();

    setBusy(true);
    try {
      const totalFiles = photos.length + recorder.clips.length;
      if (totalFiles) setProgress({ pct: 0 });
      await onSave(
        { descripcion: descTrim, categoria, photos, audioClips: recorder.clips },
        pct => setProgress({ pct })
      );
      onClose();
    } catch (err) {
      showFeedback('Error: ' + err.message, 'err');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Modal open={open} onClose={handleCloseAttempt} title="Nueva idea">
      <form onSubmit={handleSubmit}>
        <Textarea label="Descripción" placeholder="Describe la idea…" rows={4} value={descripcion} onChange={e => setDescripcion(e.target.value)} disabled={busy} autoFocus />
        <Select label="Categoría *" value={categoria} onChange={e => setCategoria(e.target.value)} disabled={busy} options={CATEGORIA_OPTIONS} />

        <label className="field-label">Fotos</label>
        <Dropzone files={photos} onChange={setPhotos} accept="image/*" capture="environment" variant="button" buttonLabel="Tomar/agregar foto" disabled={busy} />

        <label className="field-label">Notas de voz</label>
        <div className="audio-record-row">
          <button type="button" className={`btn-record${recorder.recording ? ' recording' : ''}`} disabled={busy} onClick={recorder.toggle}>
            <Icon name="mic" size={13} /> {recorder.recording ? 'Detener' : 'Grabar'}
          </button>
          {recorder.recording && <span className="audio-record-timer">{fmtSeconds(recorder.elapsed)}</span>}
        </div>
        {recorder.error && <div className="feedback err">{recorder.error}</div>}

        {!!recorder.clips.length && (
          <div className="audio-clip-list">
            {recorder.clips.map((clip, idx) => (
              <div className="audio-clip-item" key={clip.objectUrl}>
                <span className="audio-clip-duration"><Icon name="mic" size={13} />{fmtSeconds(clip.durationSec)}</span>
                <audio controls src={clip.objectUrl} />
                <button type="button" className="preview-remove" title="Quitar" disabled={busy} onClick={() => recorder.discardAt(idx)}>
                  <Icon name="close" size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {progress && (
          <div className="upload-progress">
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress.pct}%` }} /></div>
            <div className="progress-text">Subiendo archivos…</div>
          </div>
        )}

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar idea'}
        </Button>
        <Feedback message={feedback.message} type={feedback.type} />
      </form>
    </Modal>
  );
}
