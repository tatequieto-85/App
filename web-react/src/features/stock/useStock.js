import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRecetas, computeCostoReceta, computePesoTotal } from '../../services/recetasApi';
import { fetchEjecuciones } from '../../services/ejecucionesApi';
import { fetchFerias } from '../../services/feriasApi';
import { fetchCompras, getUnitPrice } from '../../services/comprasApi';
import { ensureIngredientesSheet, fetchIngredientes } from '../../services/ingredientesApi';
import { ensureMedidasSheet, fetchMedidas } from '../../services/medidasApi';
import * as stockApi from '../../services/stockApi';

// Costo de un lote: preferir el congelado al cerrarlo (evaluacion.
// costoTotal, ver finalizarEjecucion en useProcesos.js) — sobrevive
// aunque la receta se borre después. Si el lote es viejo (cerrado antes
// de que esto existiera) o todavía no se cerró, se recalcula en vivo.
function getCostoLote(ej, recetas, compras) {
  const ev = ej.evaluacion || {};
  if (ev.costoTotal != null) return ev.costoTotal;
  const receta = recetas.find(r => r.id === ej.recetaId);
  const maestros = [...(receta?.ingredientesMaestros || []), ...(ej.insumos || [])];
  return computeCostoReceta(compras, maestros).total;
}

// Peso total (g) de un lote: mismo criterio que getCostoLote — preferir
// el congelado al cerrarlo (evaluacion.pesoTotalReceta), recalcular en
// vivo si es un lote viejo o todavía no se cerró.
function getPesoTotalLote(ej, recetas) {
  const ev = ej.evaluacion || {};
  if (ev.pesoTotalReceta != null) return ev.pesoTotalReceta;
  const receta = recetas.find(r => r.id === ej.recetaId);
  const maestros = [...(receta?.ingredientesMaestros || []), ...(ej.insumos || [])];
  return computePesoTotal(maestros);
}

// Toda la lógica de negocio de Stock vive acá. Lee, además de sus propias
// hojas (StockTestigo/StockMovimientos), las de Procesos (RecetasPlantillas/
// RecetasEjecuciones) y Ferias (Ferias) — esos módulos todavía no están
// migrados a React, pero sus datos ya existen en el mismo Sheet real
// (los carga la app vanilla), así que Stock los lee directo sin necesitar
// su UI. Ver services/recetasApi.js, ejecucionesApi.js, feriasApi.js.
export function useStock() {
  const [recetas, setRecetas] = useState([]);
  const [ejecuciones, setEjecuciones] = useState([]);
  const [ferias, setFerias] = useState([]);
  const [compras, setCompras] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [medidas, setMedidas] = useState([]);
  const [stockTestigos, setStockTestigos] = useState([]);
  const [stockMovimientos, setStockMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reloadStockData = useCallback(async () => {
    const [testigos, movimientos] = await Promise.all([
      stockApi.fetchStockTestigos(),
      stockApi.fetchStockMovimientos()
    ]);
    setStockTestigos(testigos);
    setStockMovimientos(movimientos);
    return { testigos, movimientos };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([stockApi.ensureStockSheets(), ensureIngredientesSheet(), ensureMedidasSheet()]);
        const [r, e, f, c, i, md] = await Promise.all([
          fetchRecetas(), fetchEjecuciones(), fetchFerias(), fetchCompras(), fetchIngredientes(), fetchMedidas()
        ]);
        if (cancelled) return;
        setRecetas(r);
        setEjecuciones(e);
        setFerias(f);
        setCompras(c);
        setIngredientes(i);
        setMedidas(md);
        await reloadStockData();
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadStockData]);

  const ctx = { ejecuciones, ferias, stockMovimientos, stockTestigos };

  // Resumen: una fila por ITEM — cada medida de una receta es su propio
  // producto ajustable, no un desglose de solo lectura debajo de la receta
  // (a pedido explícito del usuario: "la receta esta anexa a medida y
  // stock deberia estar anexa a medida... quiero que cada medida sea un
  // item que se pueda ajustar manualmente en stock"). Una receta sin
  // medidas configuradas en el catálogo sigue mostrando una sola fila
  // (mismo comportamiento de siempre). Bug real reportado por el usuario:
  // si una receta se borra en Procesos (no solo se renombra), sus lotes/
  // stock seguían existiendo y Ventas los seguía ofreciendo para
  // planificar — pero acá desaparecían del todo, porque antes solo se
  // recorrían las recetas ACTUALES. Se agregan filas "huérfanas" por cada
  // recetaId que aparece en ejecuciones/ajustes pero ya no tiene receta
  // viva, para que el disponible nunca quede invisible.
  function itemsDeReceta(recetaId, recetaNombre) {
    const porMedida = stockApi.getStockPorMedida(ctx, recetaId, medidas);
    if (porMedida.length) {
      return porMedida.map(m => ({
        id: `${recetaId}:${m.medidaId}`,
        recetaId, recetaNombre, medidaId: m.medidaId, medidaNombre: m.nombre,
        nombre: `${recetaNombre} — ${m.nombre}`,
        disponible: m.disponible
      }));
    }
    return [{
      id: recetaId, recetaId, recetaNombre, medidaId: '', medidaNombre: '',
      nombre: recetaNombre,
      disponible: stockApi.getStockDisponibleGeneral(ctx, recetaId)
    }];
  }

  const resumenRows = useMemo(() => {
    const idsConocidos = new Set(recetas.map(r => r.id));
    const nombresOrfanos = new Map();
    ejecuciones.forEach(ej => {
      if (ej.recetaId && !idsConocidos.has(ej.recetaId) && !nombresOrfanos.has(ej.recetaId)) {
        nombresOrfanos.set(ej.recetaId, ej.nombreReceta || '(receta eliminada)');
      }
    });
    stockMovimientos.forEach(m => {
      if (m.recetaId && !idsConocidos.has(m.recetaId) && !nombresOrfanos.has(m.recetaId)) {
        nombresOrfanos.set(m.recetaId, m.recetaNombre || '(receta eliminada)');
      }
    });

    const filasActuales = recetas.flatMap(r => itemsDeReceta(r.id, r.nombre));
    const filasOrfanas = [...nombresOrfanos]
      .filter(([id]) => stockApi.getStockDisponibleGeneral(ctx, id) !== 0)
      .flatMap(([id, nombre]) => itemsDeReceta(id, `${nombre} (receta eliminada)`));

    return [...filasActuales, ...filasOrfanas].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [recetas, ejecuciones, ferias, stockMovimientos, medidas]);

  // Trazabilidad: un lote (ejecución con producción envasada) por fila —
  // con el costo/peso del lote ya resueltos y el desglose por medida con
  // su precio (ver getProduccionPorMedidaLote/getPrecioPorMedida en
  // stockApi.js — generalizado a N medidas, antes fijo a 230/130 ml, bug
  // real reportado por el usuario: "en trazabilidad solo me contó la de
  // 230 y no la de 1" con una medida de otro tamaño), para el resumen que
  // se abre al tocar una fila (ver LoteResumenModal.jsx).
  const trazabilidadRows = useMemo(() => {
    const lotes = ejecuciones
      .filter(ej => stockApi.getProduccionPorMedidaLote(ej).length)
      .slice()
      .sort((a, b) => (b.fechaFin || '') < (a.fechaFin || '') ? -1 : 1);
    return lotes.map(ej => {
      const costoLote = getCostoLote(ej, recetas, compras);
      const pesoTotalLote = getPesoTotalLote(ej, recetas);
      const produccion = stockApi.getProduccionPorMedidaLote(ej);
      const { items, merma } = stockApi.getPrecioPorMedida(costoLote, pesoTotalLote, produccion);
      return { ejecucion: ej, resumen: stockApi.getLoteResumen(ctx, ej.id), costoLote, pesoTotalLote, items, merma };
    });
  }, [ejecuciones, ferias, stockMovimientos, stockTestigos, recetas, compras]);

  // Valor total del stock + desglose 230/130 ml — a pedido explícito del
  // usuario, para el widget de Home. El disponible de cada lote sale de
  // getStockDisponibleLoteReal (resta lo VENDIDO de ese lote puntual,
  // mismo criterio que el Resumen) — NO del `disponible` de
  // getLoteResumen (que resta lo "comprometido" en TODAS las ferias que
  // alguna vez lo planearon, útil para Ventas pero no para esto) NI de
  // repartir el disponible general de la receta proporcionalmente entre
  // sus lotes (bug real: si una receta tiene varios lotes y uno más
  // barato ya se agotó mientras queda el más caro, repartir "promediaba"
  // el costo y subestimaba el valor total). Cada lote se costea con SU
  // PROPIO costoLote — y, dentro de un mismo lote, cada frasco con SU
  // PROPIO precio según gramos (230 vs 130 ml, ver getPrecioPorMedida),
  // no un promedio plano por frasco — a pedido explícito del usuario.
  const resumenStockTotal = useMemo(() => {
    let valor = 0;
    let disponible230 = 0;
    let disponible130 = 0;

    ejecuciones.forEach(ej => {
      const disponibleLote = stockApi.getStockDisponibleLoteReal(ctx, ej.id);
      if (disponibleLote <= 0) return;
      const produccion = stockApi.getProduccionPorMedidaLote(ej);
      const producidoLote = produccion.reduce((s, i) => s + i.cantidad, 0);
      if (producidoLote <= 0) return;
      const ratio = disponibleLote / producidoLote;

      const costoLote = getCostoLote(ej, recetas, compras);
      const pesoTotalLote = getPesoTotalLote(ej, recetas);
      const { items } = stockApi.getPrecioPorMedida(costoLote, pesoTotalLote, produccion);
      // El widget de Home solo desglosa 230/130 (ver próxima fila) —
      // cualquier otra medida igual suma al valor total, con SU PROPIO
      // precio por gramo (ver getPrecioPorMedida en stockApi.js), no un
      // promedio plano por frasco — a pedido explícito del usuario.
      items.forEach(i => {
        const dispItem = i.cantidad * ratio;
        if (i.pesoMl === 230) disponible230 += dispItem;
        else if (i.pesoMl === 130) disponible130 += dispItem;
        valor += dispItem * i.precioUnidad;
      });
    });

    return { valor, disponible230: Math.round(disponible230), disponible130: Math.round(disponible130) };
  }, [ejecuciones, ferias, stockMovimientos, stockTestigos, recetas, compras]);

  // Valor total de los INSUMOS disponibles (materia prima — Inventario),
  // no del producto terminado — a pedido explícito del usuario, para el
  // widget de Home. Stock corriente de cada ingrediente (ver
  // ingredientesApi.js, lo suman las compras y lo descuentan las
  // ejecuciones) × su precio unitario más reciente en Compras; un
  // ingrediente sin ninguna compra registrada no se puede costear, no
  // suma (mismo criterio que computeCostoReceta).
  const valorInsumos = useMemo(() => {
    return ingredientes.reduce((sum, ing) => {
      const precio = getUnitPrice(compras, ing.nombre);
      if (precio == null || !ing.stock) return sum;
      return sum + ing.stock * precio;
    }, 0);
  }, [ingredientes, compras]);

  // Lotes con stock disponible — para el selector de "Apartar testigo".
  const lotesConStock = useMemo(() => {
    return ejecuciones
      .map(ej => ({ ejecucion: ej, resumen: stockApi.getLoteResumen(ctx, ej.id) }))
      .filter(x => (x.resumen?.producido || 0) > 0);
  }, [ejecuciones, ferias, stockMovimientos, stockTestigos]);

  // Producto testigo: por fecha de revisión más próxima primero.
  const testigoRows = useMemo(() => {
    return [...stockTestigos].sort((a, b) => (a.fechaRevision || '9999') < (b.fechaRevision || '9999') ? -1 : 1);
  }, [stockTestigos]);

  const saveAjuste = useCallback(async ({ recetaId, recetaNombre, medidaId, medidaNombre, tipo, cantidad, motivo }) => {
    const ejecucionId = stockApi.getLoteParaAjuste(ejecuciones, recetaId);
    await stockApi.appendStockMovimiento({
      recetaId, recetaNombre, medidaId, medidaNombre, tipo, cantidad, motivo,
      fecha: new Date().toISOString().slice(0, 10), ejecucionId
    });
    await reloadStockData();
  }, [ejecuciones, reloadStockData]);

  const apartarTestigo = useCallback(async data => {
    const ej = ejecuciones.find(x => x.id === data.ejecucionId);
    if (!ej) throw new Error('Lote no encontrado.');
    const resumen = stockApi.getLoteResumen(ctx, data.ejecucionId);
    if (resumen && data.cantidad > resumen.disponible) {
      throw new Error(`Ese lote solo tiene ${resumen.disponible} unidades disponibles.`);
    }
    await stockApi.appendStockTestigo({
      id: crypto.randomUUID(), ejecucionId: data.ejecucionId, recetaId: ej.recetaId, recetaNombre: ej.nombreReceta,
      loteId: ej.loteId || '', cantidad: data.cantidad, fechaApartado: data.fechaApartado, fechaRevision: data.fechaRevision,
      ubicacion: data.ubicacion, estado: 'en_resguardo', observaciones: data.observaciones
    });
    await reloadStockData();
  }, [ejecuciones, ferias, stockMovimientos, stockTestigos, reloadStockData]);

  const updateTestigoEstado = useCallback(async (testigo, estado) => {
    await stockApi.updateStockTestigo({ ...testigo, estado });
    await reloadStockData();
  }, [reloadStockData]);

  const deleteTestigo = useCallback(async rowIndex => {
    await stockApi.deleteStockTestigoRow(rowIndex);
    await reloadStockData();
  }, [reloadStockData]);

  return {
    loading, error,
    resumenRows, resumenStockTotal, valorInsumos, trazabilidadRows, lotesConStock, testigoRows,
    saveAjuste, apartarTestigo, updateTestigoEstado, deleteTestigo
  };
}
