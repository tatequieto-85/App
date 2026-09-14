import { useCallback, useEffect, useMemo, useState } from 'react';
import * as canalesApi from '../../services/canalesVentaApi';
import * as feriasApi from '../../services/feriasApi';
import { fetchEjecuciones } from '../../services/ejecucionesApi';
import * as stockApi from '../../services/stockApi';

// El usuario ya no puede crear canales de venta a mano (ver regla — cada
// canal va a tener su propia configuración más adelante, no son genéricos)
// — estos son los únicos que existen, y se auto-crean solos la primera vez
// que hacen falta, igual que "Ferias" ya se auto-creaba antes de que
// "Retail" existiera.
const CANALES_POR_DEFECTO = [
  { nombre: 'Eventos', color: 'rose', icono: 'flag' },
  { nombre: 'Retail', color: 'blue', icono: 'store' },
  { nombre: 'Online', color: 'teal', icono: 'globe' }
];

// Un canal que ya existía con otro nombre pasa a llamarse el nuevo — antes
// de auto-crear los de arriba, para no terminar con nombres duplicados si
// el usuario ya había creado/usado el nombre viejo (a mano, o el "Ferias"
// que este módulo mismo auto-creaba antes de este cambio).
const RENOMBRES_CANAL = { 'Ferias': 'Eventos', 'Mercado Libre': 'Online' };

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
        // Los canales ya no los crea el usuario (ver CANALES_POR_DEFECTO) —
        // se arman/migran acá, localmente, en vez de volver a leerlos del
        // Sheet recién escrito: la API de Sheets no garantiza que un
        // append/update se vea de inmediato en la siguiente lectura, y esa
        // condición de carrera dejaba el canal buscado como undefined (y el
        // módulo entero sin cargar) si la relectura llegaba antes de que el
        // cambio quedara visible.
        let canalesActuales = c;
        for (const [viejo, nuevo] of Object.entries(RENOMBRES_CANAL)) {
          const existente = canalesActuales.find(x => x.nombre === viejo);
          if (existente && !canalesActuales.some(x => x.nombre === nuevo)) {
            const renombrado = { ...existente, nombre: nuevo };
            await canalesApi.updateCanal(renombrado);
            canalesActuales = canalesActuales.map(x => x.id === existente.id ? renombrado : x);
          }
        }
        for (const def of CANALES_POR_DEFECTO) {
          if (!canalesActuales.some(x => x.nombre === def.nombre)) {
            const nuevo = { id: crypto.randomUUID(), ...def, creadoEn: new Date().toISOString(), sortOrder: canalesActuales.length };
            await canalesApi.appendCanal(nuevo, canalesActuales.length);
            canalesActuales = [...canalesActuales, nuevo];
          }
        }
        setCanales(canalesActuales);
        // Ahí van a parar las ferias cargadas antes de que existieran los
        // canales (backfill idempotente: solo toca las filas sin CanalId).
        // `x` es la misma referencia que ya vive en `f`, así que mutarla
        // alcanza — no hace falta releer el Sheet para reflejarlo.
        const canalPorDefecto = canalesActuales.find(x => x.nombre === 'Eventos');
        if (canalPorDefecto) {
          f.filter(x => !x.canalId).forEach(x => { x.canalId = canalPorDefecto.id; feriasApi.updateFeria(x).catch(() => {}); });
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

  // Una fila por día/canal/producto — junta las ventas de TODAS las ferias
  // de TODOS los canales (a diferencia de la lista de ferias, que ya está
  // filtrada a un solo canal), para el cuadro de "Resumen de ventas por
  // día" en la galería de canales. Ferias sin canal (dato viejo, no debería
  // pasar tras el backfill) caen en "—".
  const resumenVentasPorDia = useMemo(() => {
    const porClave = new Map();
    ferias.forEach(f => {
      const canalNombre = canales.find(c => c.id === f.canalId)?.nombre || '—';
      (f.ventas || []).forEach(v => {
        const clave = `${v.fecha}|${f.canalId}|${v.recetaNombre}`;
        const fila = porClave.get(clave);
        if (fila) fila.cantidad += v.cantidad;
        else porClave.set(clave, { fecha: v.fecha, canalNombre, recetaNombre: v.recetaNombre, cantidad: v.cantidad });
      });
    });
    return [...porClave.values()].sort((a, b) =>
      b.fecha.localeCompare(a.fecha) || a.canalNombre.localeCompare(b.canalNombre) || a.recetaNombre.localeCompare(b.recetaNombre)
    );
  }, [ferias, canales]);

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

  // Arrastrar una feria de un bloque a otro (Participar/Publicado) para
  // cambiar su estado — las terminadas quedan afuera, ver VentasPage.
  const cambiarEstadoFeria = useCallback(async (feriaId, nuevoEstado) => {
    const f = ferias.find(x => x.id === feriaId);
    if (!f) return;
    await feriasApi.updateFeria({ ...f, estado: nuevoEstado });
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
    resumenVentasPorDia,
    saveCanal, deleteCanal, reorderCanales,
    saveFeria, deleteFeria, reabrirFeria, terminarFeria, cambiarEstadoFeria,
    saveStockPlan, registrarSalida, addObservacionDiaria, commitConteoSession
  };
}
