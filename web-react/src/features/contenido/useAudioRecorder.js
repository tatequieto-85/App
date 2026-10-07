import { useCallback, useEffect, useRef, useState } from 'react';

// Safari/iOS solo soporta audio/mp4 (no audio/webm) — se prueba una lista
// de candidatos con isTypeSupported() en vez de hardcodear un mimeType.
const AUDIO_MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
function pickAudioMimeType() {
  return AUDIO_MIME_CANDIDATES.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

// Grabación de notas de voz para Ideas de marketing — portado de
// startIdeaAudioRecording()/stopIdeaAudioRecording() en
// ../../../ideas-marketing.js. clips: { blob, mimeType, durationSec,
// objectUrl }[], en memoria hasta que el modal los sube a Drive al guardar.
export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clips, setClips] = useState([]);
  const [error, setError] = useState('');

  const streamRef    = useRef(null);
  const recorderRef  = useRef(null);
  const chunksRef     = useRef([]);
  const startTimeRef  = useRef(0);
  const timerRef      = useRef(null);

  const start = useCallback(async () => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError(
        e.name === 'NotAllowedError' ? 'Permiso de micrófono denegado.' :
        e.name === 'NotFoundError'   ? 'No se encontró un micrófono.' :
        `No se pudo acceder al micrófono: ${e.message}`
      );
      return;
    }
    setError('');
    streamRef.current = stream;
    const mimeType = pickAudioMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const durationSec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
      setClips(prev => [...prev, { blob, mimeType: blob.type, durationSec, objectUrl: URL.createObjectURL(blob) }]);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };

    recorder.start();
    startTimeRef.current = Date.now();
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 250);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const toggle = useCallback(() => {
    if (recorderRef.current?.state === 'recording') stop(); else start();
  }, [start, stop]);

  const discardAt = useCallback(idx => {
    setClips(prev => {
      prev[idx]?.objectUrl && URL.revokeObjectURL(prev[idx].objectUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const clearAll = useCallback(() => {
    setClips(prev => { prev.forEach(c => c.objectUrl && URL.revokeObjectURL(c.objectUrl)); return []; });
  }, []);

  // Si el componente se desmonta a mitad de una grabación (modal cerrado
  // de otra forma), liberar el micrófono igual.
  useEffect(() => () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  return { recording, elapsed, clips, error, toggle, stop, discardAt, clearAll };
}
