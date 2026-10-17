import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../../services/comprasApi';
import { applyStockDelta } from '../../services/ingredientesApi';

// Toda la lógica de negocio de Compras vive acá — combina el catálogo de
// ingredientes (que ya trae useIngredientes) con las compras registradas.
// `reloadIngredientes`: registrar/editar/borrar una compra suma/resta del
// stock corriente del ingrediente (a pedido explícito del usuario) — hace
// falta releer el catálogo después para que la columna "Disponible" de la
// tabla se actualice.
export function useCompras(ingredientes, reloadIngredientes) {
  const [compras, setCompras] = useState([]);
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
        await api.ensureComprasSheet();
        if (!cancelled) await reload();
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

  const saveCompra = useCallback(async (data, editRecord) => {
    const oldCantidad = editRecord ? editRecord.cantidad : 0;
    if (editRecord) {
      await api.updateCompra({ ...editRecord, ...data });
    } else {
      await api.appendCompra(data);
      // Recién agregada, con rowIndex reales — necesario para saber cuáles
      // son las más viejas y borrarlas (ver comprasApi.pruneOldCompras).
      const fresh = await api.fetchCompras();
      await api.pruneOldCompras(fresh, data.ingrediente);
    }
    await applyStockDelta(ingredientes, data.ingrediente, data.cantidad - oldCantidad);
    await reload();
    await reloadIngredientes?.();
  }, [reload, ingredientes, reloadIngredientes]);

  const removeCompra = useCallback(async rowIndex => {
    const compra = compras.find(c => c.rowIndex === rowIndex);
    await api.deleteCompraRow(rowIndex);
    if (compra) await applyStockDelta(ingredientes, compra.ingrediente, -compra.cantidad);
    await reload();
    await reloadIngredientes?.();
  }, [reload, compras, ingredientes, reloadIngredientes]);

  return { compras, rows, loading, error, historialFor, saveCompra, removeCompra };
}
