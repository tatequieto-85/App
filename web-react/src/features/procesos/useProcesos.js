import { useCallback, useEffect, useState } from 'react';
import * as recetasApi from '../../services/recetasApi';
import { fetchCompras } from '../../services/comprasApi';
import * as ejecucionesApi from '../../services/ejecucionesApi';
import * as medidasApi from '../../services/medidasApi';
import { applyStockDeltas } from '../../services/ingredientesApi';
import { todayISOBogota } from '../../utils/format';

// Toda la lógica de negocio de Procesos (solo Recetas por ahora — ver
// memoria del piloto sobre el alcance de esta primera pasada) vive acá,
// mismo patrón que useVentas.js: grupos (RecetaBlocks) + recetas
// (RecetasPlantillas), ambos CRUD completo. También lee Compras (solo
// lectura, módulo ya migrado) para estimar el precio total de un lote a
// partir de su receta — ver computeCostoReceta en recetasApi.js.
// `ingredientes`/`reloadIngredientes`: a pedido explícito del usuario,
// guardar una ejecución descuenta del stock corriente de cada ingrediente
// lo que esa ejecución consumió — ver finalizarEjecucion.
export function useProcesos(ingredientes, reloadIngredientes) {
  const [recetaBlocks, setRecetaBlocks] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [medidas, setMedidas] = useState([]);
  const [medidaBlocks, setMedidaBlocks] = useState([]);
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
        await Promise.all([
          recetasApi.ensureRecetasSheets(), ejecucionesApi.ensureEjecucionesSheet(), medidasApi.ensureMedidasSheet()
        ]);
        const [blocks, recs, comprs, meds, medBlocks] = await Promise.all([
          recetasApi.fetchRecetaBlocks(), recetasApi.fetchRecetas(), fetchCompras(), medidasApi.fetchMedidas(), medidasApi.fetchMedidaBlocks()
        ]);
        if (cancelled) return;
        setRecetaBlocks(blocks);
        setRecetas(recs);
        setCompras(comprs);
        setMedidas(meds);
        setMedidaBlocks(medBlocks);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Catálogo de medidas (ver medidasApi.js) — cada medida queda atada a UNA
  // receta puntual, con su propio grupo de insumos unitarios (frasco/
  // etiqueta/tapa) y cuánto de la mezcla entra en ese frasco (gramos) — a
  // pedido explícito del usuario ("cada medida debe guardar insumos de
  // unidad con cantidad, asociarlo a una receta, e indicar en grs cuánto le
  // cabe"). `datos`: { nombre, pesoMl, recetaId, insumos }.
  const createMedida = useCallback(async datos => {
    const id = await medidasApi.appendMedida(datos);
    const lista = await medidasApi.fetchMedidas();
    setMedidas(lista);
    return lista.find(m => m.id === id) || { id, ...datos };
  }, []);

  // Editar una medida del catálogo — a pedido explícito del usuario
  // ("ventana en Procesos... se va a poder crear, editar o ver catálogo de
  // medidas"). No hace falta ninguna cascada: la medida ya ES la
  // asociación con su receta (no una foto anidada ahí), así que editarla
  // acá alcanza. Las ejecuciones ya cerradas no se tocan (evaluacion.
  // produccionPorMedida queda "congelado", mismo criterio que costoTotal/
  // pesoTotalReceta en finalizarEjecucion).
  const editMedida = useCallback(async (medidaId, datos) => {
    const medida = medidas.find(m => m.id === medidaId);
    if (!medida) return;
    await medidasApi.updateMedida({ ...medida, ...datos });
    const lista = await medidasApi.fetchMedidas();
    setMedidas(lista);
  }, [medidas]);

  // ── Grupos de medidas (MedidaBlocks) ─────────────────────────────────────
  // A diferencia de los grupos de recetas, agrupar una medida es opcional —
  // a pedido explícito del usuario ("que se deje agrupar acorde a lo que el
  // usuario quiera"). Mismo criterio de CRUD que saveRecetaGroup/
  // deleteRecetaGroup/reorderRecetaGroups más abajo, pero sobre medidasApi.js.

  const saveMedidaGroup = useCallback(async ({ nombre, color, icono }, editingId) => {
    const dup = medidaBlocks.find(b => b.id !== editingId && b.nombre.toLowerCase() === nombre.toLowerCase());
    if (dup) throw new Error('Ya existe un grupo con ese nombre.');
    if (editingId) {
      const block = medidaBlocks.find(b => b.id === editingId);
      await medidasApi.updateMedidaBlock({ ...block, nombre, color, icono });
    } else {
      await medidasApi.appendMedidaBlock(
        { id: crypto.randomUUID(), nombre, color, icono, creadoEn: new Date().toISOString() },
        medidaBlocks.length
      );
    }
    setMedidaBlocks(await medidasApi.fetchMedidaBlocks());
  }, [medidaBlocks]);

  // Las medidas del grupo NO se borran — quedan sin grupo (mismo criterio
  // que deleteRecetaGroup).
  const deleteMedidaGroup = useCallback(async blockId => {
    const block = medidaBlocks.find(b => b.id === blockId);
    if (!block) return;
    const afectadas = medidas.filter(m => m.blockId === blockId);
    await medidasApi.deleteMedidaBlockRow(block.rowIndex);
    for (const m of afectadas) await medidasApi.updateMedida({ ...m, blockId: '' });
    setMedidaBlocks(await medidasApi.fetchMedidaBlocks());
    if (afectadas.length) setMedidas(await medidasApi.fetchMedidas());
  }, [medidaBlocks, medidas]);

  const reorderMedidaGroups = useCallback(async orderedIds => {
    const reordered = orderedIds.map((id, i) => ({ ...medidaBlocks.find(b => b.id === id), sortOrder: i }));
    setMedidaBlocks(reordered);
    try {
      await Promise.all(reordered.map(medidasApi.updateMedidaBlock));
    } catch (err) {
      setMedidaBlocks(await medidasApi.fetchMedidaBlocks());
      throw err;
    }
  }, [medidaBlocks]);

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
  // Las medidas ya no viajan acá — viven aparte en el catálogo, atadas por
  // recetaId (ver medidas más arriba).
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

  // Borrar una receta borra también SUS medidas (ya no tiene sentido que
  // una medida sobreviva sin la receta a la que está atada — a diferencia
  // de Ingredientes, que sí se reusan entre recetas).
  const deleteReceta = useCallback(async receta => {
    const propias = medidas.filter(m => m.recetaId === receta.id).slice().sort((a, b) => b.rowIndex - a.rowIndex);
    for (const m of propias) await medidasApi.deleteMedidaRow(m.rowIndex);
    await recetasApi.deleteRecetaRow(receta.rowIndex);
    if (propias.length) setMedidas(await medidasApi.fetchMedidas());
    await reloadRecetas();
  }, [medidas, reloadRecetas]);

  // Copia completa (etapas + ingredientes + medidas con sus insumos) en el
  // mismo grupo, con "(copia)" en el nombre para distinguirla — a pedido
  // del usuario, revelado con mantener presionado junto a Editar/Eliminar.
  // Las etapas se duplican con ids nuevos (sin pisar los de la receta
  // original); las medidas se recrean en el catálogo atadas al id NUEVO
  // (no tiene sentido que la copia comparta medida con el original, cada
  // una necesita poder editarse sin afectar a la otra).
  const duplicateReceta = useCallback(async receta => {
    const nuevoId = crypto.randomUUID();
    await recetasApi.appendReceta({
      id: nuevoId,
      nombre: `${receta.nombre} (copia)`,
      descripcion: receta.descripcion || '',
      etapas: (receta.etapas || []).map(et => ({ ...et, id: crypto.randomUUID() })),
      ingredientesMaestros: receta.ingredientesMaestros || [],
      blockId: receta.blockId || '',
      nivelPicante: receta.nivelPicante || '',
      creadoEn: new Date().toISOString()
    });
    const medidasReceta = medidas.filter(m => m.recetaId === receta.id);
    for (const m of medidasReceta) {
      await medidasApi.appendMedida({ nombre: m.nombre, pesoMl: m.pesoMl, recetaId: nuevoId, insumos: m.insumos });
    }
    if (medidasReceta.length) setMedidas(await medidasApi.fetchMedidas());
    await reloadRecetas();
  }, [medidas, reloadRecetas]);

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

  // Se sale de la receta con una ejecución todavía "En progreso" (nunca se
  // tocó "Guardar ejecución") y el usuario confirmó que prefiere
  // descartarla en vez de seguir completándola — a pedido explícito del
  // usuario ("si decide dejarla no registrarla en sheet"). Borra la fila
  // entera; una ejecución ya "Completada" nunca llega acá (ver
  // RecetaDetailModal.jsx, que solo pide confirmación mientras sigue en
  // curso).
  const descartarEjecucion = useCallback(async ejecucion => {
    await ejecucionesApi.deleteEjecucionRow(ejecucion.rowIndex);
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

  // Equivalente a updateFrascosEjecucion, pero para recetas con medidas
  // configuradas en su catálogo (ver pestaña "Medidas" en ProcesosPage.jsx/
  // MedidaModal.jsx) en vez de los dos tamaños fijos 230/130 — a pedido
  // explícito del usuario: "salgan todas las medidas atadas a esa receta y
  // uno escoja cuántas salieron de cada una". Vive en evaluacion.
  // produccionPorMedida (upsert por medidaId — el id de la medida en el
  // catálogo). Puente de compatibilidad: Stock (stockApi.js) sigue leyendo
  // evaluacion.frascos230/frascos130/frascosProducidos tal cual — en vez
  // de reescribir ese código ya varias veces debuggeado para N medidas
  // arbitrarias, se recalculan esos mismos campos legacy a partir de
  // produccionPorMedida en cada guardado: una medida de 230/130 g
  // alimenta su campo dedicado (precio por frasco exacto en Stock);
  // cualquier otro tamaño cae en frascosProducidos (el mismo balde
  // genérico que ya usa hoy el dato "sin tamaño conocido" — precio
  // promedio ahí, pero el descuento de insumos siempre es exacto sin
  // importar el tamaño, ver EjecucionProduccionBox.jsx).
  const updateProduccionMedidaEjecucion = useCallback(async (ejecucion, medidaId, cantidad, medidasReceta) => {
    const prevLista = ejecucion.evaluacion?.produccionPorMedida || [];
    const medidaInfo = (medidasReceta || []).find(m => m.id === medidaId);
    const nuevaLista = [
      ...prevLista.filter(p => p.medidaId !== medidaId),
      { medidaId, nombre: medidaInfo?.nombre || '', pesoMl: medidaInfo?.pesoMl || 0, cantidad }
    ];
    let frascos230 = 0, frascos130 = 0, frascosProducidos = 0;
    nuevaLista.forEach(p => {
      if (p.pesoMl === 230) frascos230 += p.cantidad || 0;
      else if (p.pesoMl === 130) frascos130 += p.cantidad || 0;
      else frascosProducidos += p.cantidad || 0;
    });
    const updated = {
      ...ejecucion,
      evaluacion: { ...(ejecucion.evaluacion || {}), produccionPorMedida: nuevaLista, frascos230, frascos130, frascosProducidos }
    };
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
  //
  // `ingredientesConsumidos`: igual criterio de congelado — la lista real
  // de ingredientes de ESTA ejecución (receta + insumos agregados) al
  // momento de guardar, a pedido explícito del usuario ("que descuente los
  // ingredientes que se necesitaron"). Se descuenta por DELTA contra lo
  // que esta misma ejecución ya había descontado antes (lo que había
  // congelado previamente en evaluacion.ingredientesConsumidos) — así
  // "Guardar cambios" sobre una ejecución ya completada (p. ej. agregar un
  // insumo más) ajusta solo la diferencia en vez de descontar dos veces.
  const finalizarEjecucion = useCallback(async (ejecucion, costoTotal, pesoTotalReceta, ingredientesConsumidos) => {
    if (ingredientesConsumidos) {
      const prevConsumo = ejecucion.evaluacion?.ingredientesConsumidos || [];
      await applyStockDeltas(ingredientes, prevConsumo, ingredientesConsumidos);
      await reloadIngredientes?.();
    }
    const updated = {
      ...ejecucion, estado: 'Completada', fechaFin: todayISOBogota(),
      evaluacion: {
        ...(ejecucion.evaluacion || {}),
        ...(costoTotal != null ? { costoTotal } : {}),
        ...(pesoTotalReceta != null ? { pesoTotalReceta } : {}),
        ...(ingredientesConsumidos != null ? { ingredientesConsumidos } : {})
      }
    };
    await ejecucionesApi.updateEjecucion(updated);
    return updated;
  }, [ingredientes, reloadIngredientes]);

  return {
    recetaBlocks, recetas, compras, medidas, medidaBlocks, loading, error,
    saveRecetaGroup, deleteRecetaGroup, reorderRecetaGroups, createMedida, editMedida,
    saveMedidaGroup, deleteMedidaGroup, reorderMedidaGroups,
    saveReceta, deleteReceta, duplicateReceta, escalarReceta,
    empezarProduccion, descartarEjecucion, addObservacionEjecucion,
    addInsumoEjecucion, removeInsumoEjecucion, updatePHEjecucion, updateFrascosEjecucion,
    updateProduccionMedidaEjecucion,
    finalizarEjecucion
  };
}
