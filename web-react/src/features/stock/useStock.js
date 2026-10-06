import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRecetas, computeCostoReceta } from '../../services/recetasApi';
import { fetchEjecuciones } from '../../services/ejecucionesApi';
import { fetchFerias } from '../../services/feriasApi';
import { fetchCompras } from '../../services/comprasApi';
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
        await stockApi.ensureStockSheets();
        const [r, e, f, c] = await Promise.all([fetchRecetas(), fetchEjecuciones(), fetchFerias(), fetchCompras()]);
        if (cancelled) return;
        setRecetas(r);
        setEjecuciones(e);
        setFerias(f);
        setCompras(c);
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

  // Resumen: una fila por receta con su disponible actual. Bug real
  // reportado por el usuario: si una receta se borra en Procesos (no solo
  // se renombra), sus lotes/stock seguían existiendo y Ventas los seguía
  // ofreciendo para planificar — pero acá desaparecían del todo, porque
  // antes solo se recorrían las recetas ACTUALES. Se agregan filas
  // "huérfanas" por cada recetaId que aparece en ejecuciones/ajustes pero
  // ya no tiene receta viva, para que el disponible nunca quede invisible.
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

    const filasActuales = recetas.map(r => ({ receta: r, disponible: stockApi.getStockDisponibleGeneral(ctx, r.id) }));
    const filasOrfanas = [...nombresOrfanos].map(([id, nombre]) => ({
      receta: { id, nombre: `${nombre} (receta eliminada)` },
      disponible: stockApi.getStockDisponibleGeneral(ctx, id)
    })).filter(f => f.disponible !== 0);

    return [...filasActuales, ...filasOrfanas].sort((a, b) => a.receta.nombre.localeCompare(b.receta.nombre));
  }, [recetas, ejecuciones, ferias, stockMovimientos]);

  // Trazabilidad: un lote (ejecución con producción envasada) por fila —
  // con el costo del lote ya resuelto (ver getCostoLote), para el resumen
  // que se abre al tocar una fila (ver LoteResumenModal.jsx).
  const trazabilidadRows = useMemo(() => {
    const lotes = ejecuciones
      .filter(ej => ej.evaluacion?.frascos230 || ej.evaluacion?.frascos180 || ej.evaluacion?.frascos130 || ej.evaluacion?.frascosProducidos)
      .slice()
      .sort((a, b) => (b.fechaFin || '') < (a.fechaFin || '') ? -1 : 1);
    return lotes.map(ej => ({
      ejecucion: ej,
      resumen: stockApi.getLoteResumen(ctx, ej.id),
      costoLote: getCostoLote(ej, recetas, compras)
    }));
  }, [ejecuciones, ferias, stockMovimientos, stockTestigos, recetas, compras]);

  // Valor total del stock + desglose 230/130 ml — a pedido explícito del
  // usuario, para el widget de Home. Ojo: el "disponible" POR LOTE
  // (getLoteResumen, el que usa Trazabilidad/Ventas) resta lo
  // COMPROMETIDO en TODAS las ferias que alguna vez planearon ese lote
  // —incluidas las ya terminadas— y NO resta lo vendido; eso podía dejar
  // el disponible de cada lote en 0 aunque el Resumen (que resta lo
  // VENDIDO de verdad, ver getStockDisponibleGeneral) mostrara stock real
  // — bug real reportado por el usuario ("en Stock dice 10, en el widget
  // 0"). Acá se parte del disponible GENERAL por receta (el mismo que ya
  // confía el Resumen) y se reparte entre los lotes de esa receta,
  // proporcional a lo que produjo cada uno, para poder costear por lote y
  // por tamaño de frasco sin perder consistencia con el Resumen.
  const resumenStockTotal = useMemo(() => {
    let valor = 0;
    let disponible230 = 0;
    let disponible130 = 0;

    const lotesPorReceta = new Map();
    ejecuciones.forEach(ej => {
      const id = ej.recetaId || '';
      if (!lotesPorReceta.has(id)) lotesPorReceta.set(id, []);
      lotesPorReceta.get(id).push(ej);
    });

    lotesPorReceta.forEach((lotes, recetaId) => {
      const disponibleGeneral = stockApi.getStockDisponibleGeneral(ctx, recetaId);
      if (disponibleGeneral <= 0) return;
      const producidoTotal = lotes.reduce((s, ej) => s + (stockApi.getLoteResumen(ctx, ej.id)?.producido || 0), 0);
      if (producidoTotal <= 0) return;

      lotes.forEach(ej => {
        const producidoLote = stockApi.getLoteResumen(ctx, ej.id)?.producido || 0;
        if (producidoLote <= 0) return;
        const disponibleLote = disponibleGeneral * (producidoLote / producidoTotal);

        const ev = ej.evaluacion || {};
        const ratio = disponibleLote / producidoLote;
        disponible230 += (ev.frascos230 || 0) * ratio;
        disponible130 += (ev.frascos130 || 0) * ratio;

        const costoLote = getCostoLote(ej, recetas, compras);
        valor += (costoLote / producidoLote) * disponibleLote;
      });
    });

    return { valor, disponible230: Math.round(disponible230), disponible130: Math.round(disponible130) };
  }, [ejecuciones, ferias, stockMovimientos, stockTestigos, recetas, compras]);

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

  const saveAjuste = useCallback(async ({ recetaId, recetaNombre, tipo, cantidad, motivo }) => {
    const ejecucionId = stockApi.getLoteParaAjuste(ejecuciones, recetaId);
    await stockApi.appendStockMovimiento({ recetaId, recetaNombre, tipo, cantidad, motivo, fecha: new Date().toISOString().slice(0, 10), ejecucionId });
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
    resumenRows, resumenStockTotal, trazabilidadRows, lotesConStock, testigoRows,
    saveAjuste, apartarTestigo, updateTestigoEstado, deleteTestigo
  };
}
