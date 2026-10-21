import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../../services/comprasApi';
import { applyStockDelta } from '../../services/ingredientesApi';
import * as contabilidadApi from '../../services/contabilidadApi';

// Toda la lógica de negocio de Compras vive acá — combina el catálogo de
// ingredientes (que ya trae useIngredientes) con las compras registradas.
// `reloadIngredientes`: registrar/editar/borrar una compra suma/resta del
// stock corriente del ingrediente (a pedido explícito del usuario) — hace
// falta releer el catálogo después para que la columna "Disponible" de la
// tabla se actualice.
export function useCompras(ingredientes, reloadIngredientes) {
  const [compras, setCompras] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const list = await api.fetchCompras();
    setCompras(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([api.ensureComprasSheet(), contabilidadApi.ensureContabilidadSheets()]);
        if (cancelled) return;
        const [, cajasList] = await Promise.all([reload(), contabilidadApi.fetchCajas()]);
        if (!cancelled) setCajas(cajasList);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  // Una fila por ingrediente del catálogo, con su última compra y precio
  // unitario ya resueltos — es lo que consume ComprasPage/CompraRow.
  const rows = useMemo(() => {
    return [...ingredientes]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(ing => {
        const last = api.getLatestCompra(compras, ing.nombre);
        const unitPrice = last && last.cantidad ? last.precioTotal / last.cantidad : null;
        return { ingrediente: ing, last, unitPrice };
      });
  }, [ingredientes, compras]);

  const historialFor = useCallback(
    nombre => api.comprasForIngrediente(compras, nombre).slice().sort((a, b) => {
      const da = a.fecha || a.creadoEn || '', db = b.fecha || b.creadoEn || '';
      return da < db ? 1 : da > db ? -1 : 0;
    }),
    [compras]
  );

  // cajaId: de qué caja de Contabilidad salió la plata de ESTA compra —
  // a pedido explícito del usuario ("no me pide la caja a descontar"), ya
  // no es una caja fija configurada una sola vez, se elige cada vez (ver
  // CompraModal.jsx). Nunca debe tumbar el registro de la compra en sí si
  // Contabilidad falla por lo que sea.
  const saveCompra = useCallback(async (data, editRecord) => {
    const oldCantidad = editRecord ? editRecord.cantidad : 0;
    if (editRecord) {
      await api.updateCompra({ ...editRecord, ...data });
      try {
        await contabilidadApi.removeMovimientoAuto(editRecord.id);
        await contabilidadApi.registrarMovimientoCompra(data.cajaId, {
          tipo: 'egreso', monto: data.precioTotal, concepto: `Compra: ${data.ingrediente}`,
          fecha: data.fecha, origenRefId: editRecord.id
        });
      } catch { /* Contabilidad es opcional — no bloquea el guardado de la compra */ }
    } else {
      const id = crypto.randomUUID();
      await api.appendCompra({ ...data, id });
      // Recién agregada, con rowIndex reales — necesario para saber cuáles
      // son las más viejas y borrarlas (ver comprasApi.pruneOldCompras).
      const fresh = await api.fetchCompras();
      await api.pruneOldCompras(fresh, data.ingrediente);
      try {
        await contabilidadApi.registrarMovimientoCompra(data.cajaId, {
          tipo: 'egreso', monto: data.precioTotal, concepto: `Compra: ${data.ingrediente}`,
          fecha: data.fecha, origenRefId: id
        });
      } catch { /* Contabilidad es opcional — no bloquea el registro de la compra */ }
    }
    await applyStockDelta(ingredientes, data.ingrediente, data.cantidad - oldCantidad);
    await reload();
    await reloadIngredientes?.();
  }, [reload, ingredientes, reloadIngredientes]);

  const removeCompra = useCallback(async rowIndex => {
    const compra = compras.find(c => c.rowIndex === rowIndex);
    await api.deleteCompraRow(rowIndex);
    if (compra) {
      await applyStockDelta(ingredientes, compra.ingrediente, -compra.cantidad);
      try {
        await contabilidadApi.removeMovimientoAuto(compra.id);
      } catch { /* Contabilidad es opcional — no bloquea el borrado de la compra */ }
    }
    await reload();
    await reloadIngredientes?.();
  }, [reload, compras, ingredientes, reloadIngredientes]);

  return { compras, cajas, rows, loading, error, historialFor, saveCompra, removeCompra, reload };
}
