import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRecetas, computeCostoReceta } from '../../services/recetasApi';
import { fetchEjecuciones } from '../../services/ejecucionesApi';
import { fetchFerias } from '../../services/feriasApi';
import { fetchCompras } from '../../services/comprasApi';
import * as stockApi from '../../services/stockApi';

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

  // Trazabilidad: un lote (ejecución con producción envasada) por fila.
  const trazabilidadRows = useMemo(() => {
    const lotes = ejecuciones
      .filter(ej => ej.evaluacion?.frascos230 || ej.evaluacion?.frascos180 || ej.evaluacion?.frascos130 || ej.evaluacion?.frascosProducidos)
      .slice()
      .sort((a, b) => (b.fechaFin || '') < (a.fechaFin || '') ? -1 : 1);
    return lotes.map(ej => ({ ejecucion: ej, resumen: stockApi.getLoteResumen(ctx, ej.id) }));
  }, [ejecuciones, ferias, stockMovimientos, stockTestigos]);

  // Valor total del stock + desglose 230/130 ml — a pedido explícito del
  // usuario, para el widget de Home. Por cada lote con disponible > 0: el
  // costo de ESE lote (receta + insumos agregados en producción, mismo
  // cálculo que "Precio total del lote" en Procesos) se divide entre los
  // frascos que salieron, dando un costo por frasco; multiplicado por el
  // disponible de ese lote y sumado entre todos los lotes da el valor
  // total. Las ventas/ajustes no distinguen tamaño de frasco (una sola
  // cantidad por lote) — el disponible se reparte entre 230/130 en la
  // misma proporción en que se produjeron (campo registrado al ejecutar
  // la receta), a pedido explícito del usuario.
  const resumenStockTotal = useMemo(() => {
    let valor = 0;
    let disponible230 = 0;
    let disponible130 = 0;
    ejecuciones.forEach(ej => {
      const resumen = stockApi.getLoteResumen(ctx, ej.id);
      if (!resumen || resumen.disponible <= 0 || resumen.producido <= 0) return;
      const ev = ej.evaluacion || {};
      const ratio = resumen.disponible / resumen.producido;
      disponible230 += (ev.frascos230 || 0) * ratio;
      disponible130 += (ev.frascos130 || 0) * ratio;

      // Preferir el costo congelado al cerrar el lote (evaluacion.
      // costoTotal) — sobrevive aunque la receta se borre después. Si el
      // lote es viejo (cerrado antes de que esto existiera) o todavía no
      // se cerró, se recalcula en vivo como antes.
      let costoLote = ev.costoTotal;
      if (costoLote == null) {
        const receta = recetas.find(r => r.id === ej.recetaId);
        const maestros = [...(receta?.ingredientesMaestros || []), ...(ej.insumos || [])];
        costoLote = computeCostoReceta(compras, maestros).total;
      }
      valor += (costoLote / resumen.producido) * resumen.disponible;
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
