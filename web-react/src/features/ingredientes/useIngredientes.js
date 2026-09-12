import { useCallback, useEffect, useState } from 'react';
import * as api from '../../services/ingredientesApi';

// Toda la lógica de negocio del módulo Ingredientes vive acá — IngredientesPage
// y el resto de componentes de la carpeta solo presentan lo que este hook expone.
export function useIngredientes() {
  const [ingredientes, setIngredientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const list = await api.fetchIngredientes();
    setIngredientes(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await api.ensureIngredientesSheet();
        if (!cancelled) await reload();
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const findDuplicate = useCallback(
    nombre => api.findDuplicate(ingredientes, nombre),
    [ingredientes]
  );

  const addIngrediente = useCallback(async (nombre, unidad) => {
    const trimmed = nombre.trim();
    const dup = findDuplicate(trimmed);
    if (dup) throw new Error(`Ya existe "${dup.nombre}" (similar a "${trimmed}").`);
    await api.appendIngrediente(trimmed, unidad.trim());
    await reload();
  }, [findDuplicate, reload]);

  const updateUnidad = useCallback(async (ing, unidad) => {
    await api.updateIngrediente({ ...ing, unidad });
    await reload();
  }, [reload]);

  const removeIngrediente = useCallback(async rowIndex => {
    await api.deleteIngredienteRow(rowIndex);
    await reload();
  }, [reload]);

  // Usado por el autocomplete: agrega solo si no existe todavía, y devuelve
  // el nombre "canónico" (el existente si ya había uno similar).
  const tryAddIngrediente = useCallback(async (nombre, unidad) => {
    const trimmed = nombre.trim();
    if (!trimmed) return null;
    const dup = findDuplicate(trimmed);
    if (dup) return dup.nombre;
    await api.appendIngrediente(trimmed, unidad);
    await reload();
    return trimmed;
  }, [findDuplicate, reload]);

  return {
    ingredientes, loading, error,
    findDuplicate, addIngrediente, updateUnidad, removeIngrediente, tryAddIngrediente
  };
}
