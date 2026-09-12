import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRecetas } from '../../services/recetasApi';
import { fetchEjecuciones } from '../../services/ejecucionesApi';
import { fetchFerias } from '../../services/feriasApi';
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
        const [r, e, f] = await Promise.all([fetchRecetas(), fetchEjecuciones(), fetchFerias()]);
        if (cancelled) return;
        setRecetas(r);
        setEjecuciones(e);
        setFerias(f);
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

  // Resumen: una fila por receta con su disponible actual.
  const resumenRows = useMemo(() => {
    return [...recetas]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(r => ({ receta: r, disponible: stockApi.getStockDisponibleGeneral(ctx, r.id) }));
  }, [recetas, ejecuciones, ferias, stockMovimientos]);

  // Trazabilidad: un lote (ejecución con producción envasada) por fila.
  const trazabilidadRows = useMemo(() => {
    const lotes = ejecuciones
      .filter(ej => ej.evaluacion?.frascos230 || ej.evaluacion?.frascos180)
      .slice()
      .sort((a, b) => (b.fechaFin || '') < (a.fechaFin || '') ? -1 : 1);
    return lotes.map(ej => ({ ejecucion: ej, resumen: stockApi.getLoteResumen(ctx, ej.id) }));
  }, [ejecuciones, ferias, stockMovimientos, stockTestigos]);

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
    resumenRows, trazabilidadRows, lotesConStock, testigoRows,
    saveAjuste, apartarTestigo, updateTestigoEstado, deleteTestigo
  };
}
