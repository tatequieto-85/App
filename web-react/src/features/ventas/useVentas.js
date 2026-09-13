import { useCallback, useEffect, useState } from 'react';
import * as canalesApi from '../../services/canalesVentaApi';
import * as feriasApi from '../../services/feriasApi';
import { fetchEjecuciones } from '../../services/ejecucionesApi';
import * as stockApi from '../../services/stockApi';

// Toda la lógica de negocio de Ventas/Ferias vive acá. Lee, además de sus
// propias hojas (CanalesVenta/Ferias), las de Procesos (RecetasEjecuciones)
// y Stock (StockTestigo/StockMovimientos) para calcular disponibilidad de
// cada lote — esos módulos todavía no tienen su UI en React, pero sus datos
// ya existen en el mismo Sheet real. Ver services/ejecucionesApi.js, stockApi.js.
export function useVentas() {
  const [canales, setCanales] = useState([]);
  const [ferias, setFerias] = useState([]);
  const [ejecuciones, setEjecuciones] = useState([]);
  const [stockTestigos, setStockTestigos] = useState([]);
  const [stockMovimientos, setStockMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reloadFerias = useCallback(async () => {
    const f = await feriasApi.fetchFerias();
    setFerias(f);
    return f;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([canalesApi.ensureCanalesVentaSheet(), feriasApi.ensureFeriasSheet(), stockApi.ensureStockSheets()]);
        const [c, f, ej, testigos, movimientos] = await Promise.all([
          canalesApi.fetchCanales(), feriasApi.fetchFerias(), fetchEjecuciones(),
          stockApi.fetchStockTestigos(), stockApi.fetchStockMovimientos()
        ]);
        if (cancelled) return;
        // El canal "Ferias" existe siempre — ahí van a parar las ferias
        // cargadas antes de que existieran los canales. Se arma el objeto
        // local en vez de volver a leerlo del Sheet recién escrito — la API
        // de Sheets no garantiza que un append se vea de inmediato en la
        // siguiente lectura, y esa condición de carrera dejaba `feriaCanal`
        // undefined (y el módulo entero sin cargar) si la relectura llegaba
        // antes de que el append quedara visible.
        let feriaCanal = c.find(x => x.nombre === 'Ferias');
        if (!feriaCanal) {
          feriaCanal = { id: crypto.randomUUID(), nombre: 'Ferias', color: 'rose', icono: 'flag', creadoEn: new Date().toISOString(), sortOrder: c.length };
          await canalesApi.appendCanal(feriaCanal, c.length);
          setCanales([...c, feriaCanal]);
        } else {
          setCanales(c);
        }
        // Idempotente: solo toca las filas sin CanalId (backfill de ferias
        // viejas). `x` es la misma referencia que ya vive en `f`, así que
        // mutarla alcanza — no hace falta releer el Sheet para reflejarlo.
        if (feriaCanal) {
          f.filter(x => !x.canalId).forEach(x => { x.canalId = feriaCanal.id; feriasApi.updateFeria(x).catch(() => {}); });
        }
        setFerias(f);
        setEjecuciones(ej);
        setStockTestigos(testigos);
        setStockMovimientos(movimientos);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ctx = { ejecuciones, ferias, stockMovimientos, stockTestigos };

  // ── Canales ────────────────────────────────────────────────────────────

  const saveCanal = useCallback(async ({ nombre, color, icono }, editingId) => {
    const dup = canales.find(c => c.id !== editingId && c.nombre.toLowerCase() === nombre.toLowerCase());
    if (dup) throw new Error('Ya existe un canal con ese nombre.');
    if (editingId) {
      const canal = canales.find(c => c.id === editingId);
      await canalesApi.updateCanal({ ...canal, nombre, color, icono });
    } else {
      await canalesApi.appendCanal({ id: crypto.randomUUID(), nombre, color, icono, creadoEn: new Date().toISOString() }, canales.length);
    }
    setCanales(await canalesApi.fetchCanales());
  }, [canales]);

  // A diferencia de los grupos de recetas, acá no hay un "sin canal" al que
  // reasignar — si el canal tiene ferias cargadas, no se borra.
  const deleteCanal = useCallback(async canalId => {
    if (ferias.some(f => f.canalId === canalId)) {
      throw new Error('Este canal tiene registros cargados — no se puede eliminar.');
    }
    const canal = canales.find(c => c.id === canalId);
    if (!canal) return;
    await canalesApi.deleteCanalRow(canal.rowIndex);
    setCanales(await canalesApi.fetchCanales());
  }, [canales, ferias]);

  const reorderCanales = useCallback(async orderedIds => {
    const reordered = orderedIds.map((id, i) => ({ ...canales.find(c => c.id === id), sortOrder: i }));
    setCanales(reordered);
    try {
      await Promise.all(reordered.map(canalesApi.updateCanal));
    } catch (err) {
      setCanales(await canalesApi.fetchCanales());
      throw err;
    }
  }, [canales]);

  // ── Ferias ─────────────────────────────────────────────────────────────

  const saveFeria = useCallback(async (datos, editingId, canalId) => {
    if (editingId) {
      const f = ferias.find(x => x.id === editingId);
      if (f) await feriasApi.updateFeria({ ...f, ...datos });
    } else {
      await feriasApi.appendFeria({
        id: crypto.randomUUID(), horaInicio: '', horaFin: '', fechaImportante: '', alineacion: 0,
        estado: 'confirmada', conteoPersonas: 0, planStock: {}, ventas: [], observacionesDiarias: [],
        conteoProductos: null, conteoMenores30: 0, conteoEntre30y55: 0, conteoMayores55: 0,
        cerrada: false, muestras: [], canalId: canalId || '', ...datos
      });
    }
    await reloadFerias();
  }, [ferias, reloadFerias]);

  const deleteFeria = useCallback(async feria => {
    await feriasApi.deleteFeriaRow(feria.rowIndex);
    await reloadFerias();
  }, [reloadFerias]);

  const reabrirFeria = useCallback(async feriaId => {
    const f = ferias.find(x => x.id === feriaId);
    if (!f) return;
    await feriasApi.updateFeria({ ...f, cerrada: false });
    await reloadFerias();
  }, [ferias, reloadFerias]);

  const terminarFeria = useCallback(async feriaId => {
    const f = ferias.find(x => x.id === feriaId);
    if (!f) return;
    await feriasApi.updateFeria({ ...f, cerrada: true });
    await reloadFerias();
  }, [ferias, reloadFerias]);

  const saveStockPlan = useCallback(async (feriaId, planStock) => {
    const f = ferias.find(x => x.id === feriaId);
    if (!f) return;
    const excesos = [];
    Object.entries(planStock).forEach(([ejecucionId, total]) => {
      const disponible = feriasApi.getStockDisponibleLote(ctx, ejecucionId, feriaId);
      if (total > disponible) {
        const ej = ejecuciones.find(e => e.id === ejecucionId);
        excesos.push(`${ej?.nombreReceta || ejecucionId} — Lote ${ej?.loteId || ejecucionId} (pediste ${total}, disponible ${disponible})`);
      }
    });
    if (excesos.length) throw new Error(`No hay stock suficiente: ${excesos.join('; ')}.`);
    await feriasApi.updateFeria({ ...f, planStock });
    await reloadFerias();
  }, [ferias, ejecuciones, stockTestigos, stockMovimientos, reloadFerias]);

  // arrField: 'ventas' o 'muestras'. items: [{ ejecucionId, cantidad }].
  const registrarSalida = useCallback(async (feriaId, arrField, items, fecha) => {
    const f = ferias.find(x => x.id === feriaId);
    if (!f) return;
    const plan = f.planStock || {};
    const salidaTotal = feriasApi.getFeriaSalidaTotal(f);
    const excesos = [];
    const nuevas = [];
    items.forEach(({ ejecucionId, cantidad }) => {
      if (cantidad <= 0) return;
      const ej = ejecuciones.find(x => x.id === ejecucionId);
      const disponible = (plan[ejecucionId] || 0) - (salidaTotal[ejecucionId] || 0);
      if (cantidad > disponible) {
        excesos.push(`${ej?.nombreReceta || ejecucionId} (pediste ${cantidad}, disponible ${disponible})`);
        return;
      }
      nuevas.push({
        fecha, ejecucionId, loteId: ej?.loteId || '', recetaId: ej?.recetaId || '',
        recetaNombre: ej?.nombreReceta || '', cantidad, createdAt: new Date().toISOString()
      });
    });
    if (excesos.length) throw new Error(`No hay stock suficiente: ${excesos.join('; ')}.`);
    if (!nuevas.length) throw new Error('Ingresa al menos una cantidad.');
    await feriasApi.updateFeria({ ...f, [arrField]: [...(f[arrField] || []), ...nuevas] });
    await reloadFerias();
  }, [ferias, ejecuciones, reloadFerias]);

  const addObservacionDiaria = useCallback(async (feriaId, fecha, text) => {
    const f = ferias.find(x => x.id === feriaId);
    if (!f) return;
    const observacionesDiarias = [...(f.observacionesDiarias || []), { fecha, text, createdAt: new Date().toISOString() }];
    await feriasApi.updateFeria({ ...f, observacionesDiarias });
    await reloadFerias();
  }, [ferias, reloadFerias]);

  // Vuelca la tanda del contador (una sesión de +/- por rango etario) al
  // total guardado — ver FeriaCounterModal, que la acumula en localStorage
  // mientras está abierto y llama a esto recién al cerrar.
  const commitConteoSession = useCallback(async (feriaId, session) => {
    const f = ferias.find(x => x.id === feriaId);
    if (!f) return;
    const totalSession = (session.menores30 || 0) + (session.entre30y55 || 0) + (session.mayores55 || 0);
    if (totalSession <= 0) return;
    await feriasApi.updateFeria({
      ...f,
      conteoMenores30: (f.conteoMenores30 || 0) + (session.menores30 || 0),
      conteoEntre30y55: (f.conteoEntre30y55 || 0) + (session.entre30y55 || 0),
      conteoMayores55: (f.conteoMayores55 || 0) + (session.mayores55 || 0)
    });
    await reloadFerias();
  }, [ferias, reloadFerias]);

  return {
    canales, ferias, ejecuciones, stockTestigos, stockMovimientos, ctx, loading, error,
    saveCanal, deleteCanal, reorderCanales,
    saveFeria, deleteFeria, reabrirFeria, terminarFeria,
    saveStockPlan, registrarSalida, addObservacionDiaria, commitConteoSession
  };
}
