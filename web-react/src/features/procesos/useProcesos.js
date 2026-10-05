import { useCallback, useEffect, useState } from 'react';
import * as recetasApi from '../../services/recetasApi';
import { fetchCompras } from '../../services/comprasApi';

// Toda la lógica de negocio de Procesos (solo Recetas por ahora — ver
// memoria del piloto sobre el alcance de esta primera pasada) vive acá,
// mismo patrón que useVentas.js: grupos (RecetaBlocks) + recetas
// (RecetasPlantillas), ambos CRUD completo. También lee Compras (solo
// lectura, módulo ya migrado) para estimar el precio total de un lote a
// partir de su receta — ver computeCostoReceta en recetasApi.js.
export function useProcesos() {
  const [recetaBlocks, setRecetaBlocks] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reloadRecetas = useCallback(async () => {
    const r = await recetasApi.fetchRecetas();
    setRecetas(r);
    return r;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await recetasApi.ensureRecetasSheets();
        const [blocks, recs, comprs] = await Promise.all([recetasApi.fetchRecetaBlocks(), recetasApi.fetchRecetas(), fetchCompras()]);
        if (cancelled) return;
        setRecetaBlocks(blocks);
        setRecetas(recs);
        setCompras(comprs);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Grupos ─────────────────────────────────────────────────────────────

  const saveRecetaGroup = useCallback(async ({ nombre, color, icono }, editingId) => {
    const dup = recetaBlocks.find(b => b.id !== editingId && b.nombre.toLowerCase() === nombre.toLowerCase());
    if (dup) throw new Error('Ya existe un grupo con ese nombre.');
    if (editingId) {
      const block = recetaBlocks.find(b => b.id === editingId);
      await recetasApi.updateRecetaBlock({ ...block, nombre, color, icono });
    } else {
      await recetasApi.appendRecetaBlock(
        { id: crypto.randomUUID(), nombre, color, icono, creadoEn: new Date().toISOString() },
        recetaBlocks.length
      );
    }
    setRecetaBlocks(await recetasApi.fetchRecetaBlocks());
  }, [recetaBlocks]);

  // Las recetas del grupo NO se borran — quedan sin grupo (mismo criterio
  // que deleteRecetaBlock en procesos.js).
  const deleteRecetaGroup = useCallback(async blockId => {
    const block = recetaBlocks.find(b => b.id === blockId);
    if (!block) return;
    const afectadas = recetas.filter(r => r.blockId === blockId);
    await recetasApi.deleteRecetaBlockRow(block.rowIndex);
    for (const r of afectadas) await recetasApi.updateReceta({ ...r, blockId: '' });
    setRecetaBlocks(await recetasApi.fetchRecetaBlocks());
    if (afectadas.length) await reloadRecetas();
  }, [recetaBlocks, recetas, reloadRecetas]);

  const reorderRecetaGroups = useCallback(async orderedIds => {
    const reordered = orderedIds.map((id, i) => ({ ...recetaBlocks.find(b => b.id === id), sortOrder: i }));
    setRecetaBlocks(reordered);
    try {
      await Promise.all(reordered.map(recetasApi.updateRecetaBlock));
    } catch (err) {
      setRecetaBlocks(await recetasApi.fetchRecetaBlocks());
      throw err;
    }
  }, [recetaBlocks]);

  // ── Recetas ────────────────────────────────────────────────────────────

  // datos: { nombre, middleEtapas, ingredientesMaestros }. El nivel de
  // picante nunca se elige a mano, se detecta solo (ver recetasApi.js).
  const saveReceta = useCallback(async ({ nombre, middleEtapas, ingredientesMaestros }, editingId, blockId) => {
    const etapas = recetasApi.buildEtapasFull(middleEtapas);
    const nivelPicante = recetasApi.detectNivelPicante(ingredientesMaestros);
    if (editingId) {
      const rec = recetas.find(r => r.id === editingId);
      if (rec) await recetasApi.updateReceta({ ...rec, nombre, etapas, ingredientesMaestros, nivelPicante });
    } else {
      await recetasApi.appendReceta({
        id: crypto.randomUUID(), nombre, descripcion: '', etapas, ingredientesMaestros,
        blockId: blockId || '', nivelPicante, creadoEn: new Date().toISOString()
      });
    }
    await reloadRecetas();
  }, [recetas, reloadRecetas]);

  const deleteReceta = useCallback(async receta => {
    await recetasApi.deleteRecetaRow(receta.rowIndex);
    await reloadRecetas();
  }, [reloadRecetas]);

  return {
    recetaBlocks, recetas, compras, loading, error,
    saveRecetaGroup, deleteRecetaGroup, reorderRecetaGroups,
    saveReceta, deleteReceta
  };
}
