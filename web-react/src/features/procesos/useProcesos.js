import { useCallback, useEffect, useState } from 'react';
import * as recetasApi from '../../services/recetasApi';
import { fetchCompras } from '../../services/comprasApi';
import * as ejecucionesApi from '../../services/ejecucionesApi';
import { todayISOBogota } from '../../utils/format';

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
        await Promise.all([recetasApi.ensureRecetasSheets(), ejecucionesApi.ensureEjecucionesSheet()]);
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

  // Copia completa (etapas + ingredientes) en el mismo grupo, con "(copia)"
  // en el nombre para distinguirla — a pedido del usuario, revelado con
  // mantener presionado junto a Editar/Eliminar. Las etapas se duplican con
  // ids nuevos (sin pisar los de la receta original).
  const duplicateReceta = useCallback(async receta => {
    await recetasApi.appendReceta({
      id: crypto.randomUUID(),
      nombre: `${receta.nombre} (copia)`,
      descripcion: receta.descripcion || '',
      etapas: (receta.etapas || []).map(et => ({ ...et, id: crypto.randomUUID() })),
      ingredientesMaestros: receta.ingredientesMaestros || [],
      blockId: receta.blockId || '',
      nivelPicante: receta.nivelPicante || '',
      creadoEn: new Date().toISOString()
    });
    await reloadRecetas();
  }, [reloadRecetas]);

  // Escalar receta: a pedido explícito del usuario, desde el detalle se
  // puede elegir UN ingrediente de la receta y la cantidad que se va a
  // comprar de ese ingrediente — el resto de los ingredientes (de
  // peso/volumen, ver esUnidadDePeso) se reescalan por el mismo factor
  // para mantener exactamente los mismos porcentajes (ver cálculo en
  // RecetaEscalarSection.jsx, acá solo persiste el resultado ya calculado).
  const escalarReceta = useCallback(async (receta, ingredientesMaestros) => {
    await recetasApi.updateReceta({ ...receta, ingredientesMaestros });
    await reloadRecetas();
  }, [reloadRecetas]);

  // ── Producción (arranque mínimo de un lote) ───────────────────────────
  // A pedido del usuario: "Empezar producción" en el detalle de una receta
  // crea un lote (RecetasEjecuciones) y hace aparecer, debajo de Etapas (en
  // el mismo detalle, no una ventana aparte), un cuadro con pH obligatorio,
  // ingredientes usados (con su peso) y observaciones — todo agregado a
  // voluntad del usuario. El cronómetro por etapa y el resto de la
  // evaluación final todavía NO se migran — ver memoria del piloto — esto
  // es solo el punto de partida del lote.

  const empezarProduccion = useCallback(async receta => {
    const nuevaEjecucion = {
      id: crypto.randomUUID(),
      recetaId: receta.id,
      nombreReceta: receta.nombre,
      loteId: ejecucionesApi.generateLoteId(receta.nombre),
      fechaInicio: todayISOBogota(),
      fechaFin: '',
      estado: 'En progreso',
      duracionTotal: '',
      etapasData: [],
      evaluacion: {},
      creadoEn: new Date().toISOString(),
      observations: [],
      insumos: []
    };
    await ejecucionesApi.appendEjecucion(nuevaEjecucion);
    const lista = await ejecucionesApi.fetchEjecuciones();
    return lista.find(e => e.id === nuevaEjecucion.id) || nuevaEjecucion;
  }, []);

  const addObservacionEjecucion = useCallback(async (ejecucion, text) => {
    const updated = {
      ...ejecucion,
      observations: [...(ejecucion.observations || []), { text, createdAt: new Date().toISOString() }]
    };
    await ejecucionesApi.updateEjecucion(updated);
    return updated;
  }, []);

  // insumo: { nombre, cantidadComprada, cantidadReceta, unidad } — lo que
  // realmente se usó en este lote (puede diferir de lo planeado en la
  // receta), con las mismas dos cantidades (comprado/para receta) que ya
  // tiene cada ingrediente al planificar — a pedido del usuario.
  const addInsumoEjecucion = useCallback(async (ejecucion, insumo) => {
    const updated = { ...ejecucion, insumos: [...(ejecucion.insumos || []), insumo] };
    await ejecucionesApi.updateEjecucion(updated);
    return updated;
  }, []);

  const removeInsumoEjecucion = useCallback(async (ejecucion, idx) => {
    const updated = { ...ejecucion, insumos: (ejecucion.insumos || []).filter((_, i) => i !== idx) };
    await ejecucionesApi.updateEjecucion(updated);
    return updated;
  }, []);

  // pH — campo obligatorio del lote, a pedido explícito del usuario. Vive
  // en evaluacion.ph (mismo campo que ya usa/usaba la app vanilla para la
  // evaluación de un lote, ver generateEjecucionAnalysis en procesos.js).
  const updatePHEjecucion = useCallback(async (ejecucion, ph) => {
    const updated = { ...ejecucion, evaluacion: { ...(ejecucion.evaluacion || {}), ph } };
    await ejecucionesApi.updateEjecucion(updated);
    return updated;
  }, []);

  // Frascos producidos, desglosados por tamaño (230 ml / 130 ml), a pedido
  // explícito del usuario — viven en evaluacion.frascos230/evaluacion.
  // frascos130; getStockProducido (ejecucionesApi.js) ya los suma para que
  // Stock/Ventas vean el producto terminado de este lote. `campo`:
  // 'frascos230' | 'frascos130'.
  const updateFrascosEjecucion = useCallback(async (ejecucion, campo, cantidad) => {
    const updated = { ...ejecucion, evaluacion: { ...(ejecucion.evaluacion || {}), [campo]: cantidad } };
    await ejecucionesApi.updateEjecucion(updated);
    return updated;
  }, []);

  // "Guardar ejecución" — cierra el lote: fecha de fin = hoy, estado
  // "Completada" (mismo string que ya esperaba la app vanilla para
  // pintarlo en verde, ver estado-ok en procesos.js). El pH ya es
  // obligatorio para poder guardar (se valida en el botón, ver
  // EjecucionProduccionBox.jsx) — acá solo persiste. `costoTotal` y
  // `pesoTotalReceta`: ya calculados en EjecucionProduccionBox (receta +
  // insumos agregados), se guardan congelados en evaluacion — bug real
  // reportado por el usuario: el precio/peso se recalculaba leyendo la
  // receta en vivo, y si esa receta cambiaba o se borraba después (pasa
  // seguido, ver resumenRows huérfanas en useStock.js) el costo/peso
  // original se volvía imposible de reconstruir. Con los valores
  // congelados al cerrar, sobreviven aunque la receta cambie o desaparezca
  // — pesoTotalReceta es la base para calcular la merma y el precio por
  // frasco según su tamaño en Stock (ver getPrecioFrascosLote en
  // stockApi.js).
  const finalizarEjecucion = useCallback(async (ejecucion, costoTotal, pesoTotalReceta) => {
    const updated = {
      ...ejecucion, estado: 'Completada', fechaFin: todayISOBogota(),
      evaluacion: {
        ...(ejecucion.evaluacion || {}),
        ...(costoTotal != null ? { costoTotal } : {}),
        ...(pesoTotalReceta != null ? { pesoTotalReceta } : {})
      }
    };
    await ejecucionesApi.updateEjecucion(updated);
    return updated;
  }, []);

  return {
    recetaBlocks, recetas, compras, loading, error,
    saveRecetaGroup, deleteRecetaGroup, reorderRecetaGroups,
    saveReceta, deleteReceta, duplicateReceta, escalarReceta,
    empezarProduccion, addObservacionEjecucion,
    addInsumoEjecucion, removeInsumoEjecucion, updatePHEjecucion, updateFrascosEjecucion,
    finalizarEjecucion
  };
}
