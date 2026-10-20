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

  const addIngrediente = useCallback(async (nombre, unidad, categoria = '', minimo = null) => {
    const trimmed = nombre.trim();
    const dup = findDuplicate(trimmed);
    if (dup) throw new Error(`Ya existe "${dup.nombre}" (similar a "${trimmed}").`);
    await api.appendIngrediente(trimmed, unidad.trim(), categoria, minimo);
    await reload();
  }, [findDuplicate, reload]);

  const updateUnidad = useCallback(async (ing, unidad) => {
    await api.updateIngrediente({ ...ing, unidad });
    await reload();
  }, [reload]);

  // Corrige el nombre/unidad/categoría/mínimo de un insumo ya existente —
  // a pedido explícito del usuario, para arreglar un nombre mal tipeado
  // sin tener que borrar y recrear el ingrediente (lo que perdería el
  // stock corriente y el historial de compras). Devuelve el nombre final
  // guardado para que quien llama decida si hace falta la migración en
  // cascada de Compras/Recetas (ver ComprasPage.jsx).
  const updateIngredienteInfo = useCallback(async (ing, { nombre, unidad, categoria, minimo }) => {
    const trimmed = nombre.trim();
    if (!trimmed) throw new Error('Indicá el nombre.');
    if (!unidad.trim()) throw new Error('Indicá la unidad de medida.');
    const dup = findDuplicate(trimmed);
    if (dup && dup.rowIndex !== ing.rowIndex) throw new Error(`Ya existe "${dup.nombre}" (similar a "${trimmed}").`);
    await api.updateIngrediente({
      ...ing, nombre: trimmed, unidad: unidad.trim(), categoria: (categoria || '').trim(),
      minimo: minimo === '' || minimo == null ? null : +minimo
    });
    await reload();
    return trimmed;
  }, [findDuplicate, reload]);

  // Corrección manual del stock — a pedido explícito del usuario ("cómo
  // puedo descontar del inventario manualmente"): hasta ahora solo se
  // movía solo con compras/ejecuciones (ver AjustarStockModal.jsx).
  const ajustarStock = useCallback(async (ing, delta) => {
    await api.applyStockDelta(ingredientes, ing.nombre, delta);
    await reload();
  }, [ingredientes, reload]);

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
    ingredientes, loading, error, reload,
    findDuplicate, addIngrediente, updateUnidad, updateIngredienteInfo, ajustarStock, removeIngrediente, tryAddIngrediente
  };
}
