import { useCallback, useEffect, useState } from 'react';
import * as storiesApi from '../../services/storiesApi';
import * as tareasApi from '../../services/tareasApi';
import { updateAppIconBadge } from '../../utils/appBadge';

// Badge combinado (tareas hoy/atrasadas + historias hoy/vencidas): mismo
// criterio pragmático que ya usaba la app vanilla (ver comentario en
// contenido.js/tareas.js) — el número que queda puesto en el ícono es el
// del ÚLTIMO módulo que se cargó, no una unión en vivo de los dos (acá cada
// pantalla de React se monta por separado, a diferencia de la app vanilla
// donde ambos scripts corren siempre juntos). Por eso esta pantalla suma
// sus propias historias AL de tareas (leído sin pintar nada de Tareas),
// igual que hacía contenido.js al llamar getTasksDueBadgeCount().
async function updateCombinedBadge(stories) {
  try {
    const tasks = await tareasApi.fetchKanbanTasks();
    const tasksDue = tasks.filter(t =>
      !tareasApi.TERMINAL_STATES.includes(t.status) &&
      ['hoy', 'atrasado'].includes(tareasApi.getDueCategory(t.dueDate))
    ).length;
    updateAppIconBadge(tasksDue + storiesApi.getStoriesDueBadgeCount(stories));
  } catch {
    // El badge es un extra cosmético — si falla (sin red, etc.) no debe
    // tirar abajo la carga de historias en sí.
  }
}

export function useStories() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const list = await storiesApi.fetchStories();
    setStories(list);
    updateCombinedBadge(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await storiesApi.ensureStoriesSheet();
        const list = await storiesApi.fetchStories();
        if (cancelled) return;
        setStories(list);
        updateCombinedBadge(list);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const createStory = useCallback(async ({ title, actions, scheduledAt, files }, onProgress) => {
    let uploaded = { driveFileIds: [], origNames: [], mimeTypes: [], thumbUrls: [] };
    if (files?.length) uploaded = await storiesApi.uploadStoryFiles(files, onProgress);
    await storiesApi.appendStory({
      id: crypto.randomUUID(), title, actions, scheduledAt,
      ...uploaded, createdAt: new Date().toISOString()
    });
    await reload();
  }, [reload]);

  const editStory = useCallback(async (rowIndex, fields) => {
    await storiesApi.updateStoryFields(rowIndex, fields);
    await reload();
  }, [reload]);

  const removeStory = useCallback(async story => {
    await storiesApi.deleteStory(story);
    await reload();
  }, [reload]);

  return { stories, loading, error, createStory, editStory, removeStory };
}
