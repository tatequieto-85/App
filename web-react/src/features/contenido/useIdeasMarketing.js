import { useCallback, useEffect, useState } from 'react';
import * as ideasApi from '../../services/ideasMarketingApi';

export function useIdeasMarketing() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const list = await ideasApi.fetchIdeasMarketing();
    setIdeas(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await ideasApi.ensureIdeasMarketingSheet();
        const list = await ideasApi.fetchIdeasMarketing();
        if (cancelled) return;
        setIdeas(list);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const createIdea = useCallback(async ({ descripcion, categoria, photos, audioClips }, onProgress) => {
    const total = photos.length + audioClips.length;
    let done = 0;
    const progress = (i, n, pct) => onProgress?.(Math.round(((done + pct / 100) / total) * 100));

    const fotos = photos.length ? await ideasApi.uploadIdeaPhotos(photos, 0, total, progress) : null;
    done = photos.length;
    const audios = audioClips.length ? await ideasApi.uploadIdeaAudioClips(audioClips, done, total, progress) : null;

    await ideasApi.appendIdeaMarketing({
      id: crypto.randomUUID(), descripcion, categoria,
      photoFileIds:   fotos?.photoFileIds   || [],
      photoNames:     fotos?.photoNames     || [],
      photoMimeTypes: fotos?.photoMimeTypes || [],
      photoThumbUrls: fotos?.photoThumbUrls || [],
      audioFileIds:   audios?.audioFileIds   || [],
      audioNames:     audios?.audioNames     || [],
      audioMimeTypes: audios?.audioMimeTypes || [],
      audioDurations: audios?.audioDurations || [],
      createdAt: new Date().toISOString()
    });
    await reload();
  }, [reload]);

  const editIdea = useCallback(async (rowIndex, descripcion) => {
    await ideasApi.updateIdeaMarketingDescripcion(rowIndex, descripcion);
    await reload();
  }, [reload]);

  const removeIdea = useCallback(async idea => {
    await ideasApi.deleteIdeaMarketing(idea);
    await reload();
  }, [reload]);

  return { ideas, loading, error, createIdea, editIdea, removeIdea };
}
