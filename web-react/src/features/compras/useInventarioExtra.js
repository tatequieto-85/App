import { useCallback, useEffect, useState } from 'react';
import * as inventarioApi from '../../services/inventarioApi';

// Inventario de materia prima + inventario de activos — las dos secciones
// nuevas de la pantalla de Inventario (antes "Insumos"), ver ComprasPage.jsx.
export function useInventarioExtra() {
  const [materiaPrima, setMateriaPrima] = useState([]);
  const [activos, setActivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const [mp, act] = await Promise.all([inventarioApi.fetchMateriaPrima(), inventarioApi.fetchActivos()]);
    setMateriaPrima(mp);
    setActivos(act);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await inventarioApi.ensureInventarioSheets();
        const [mp, act] = await Promise.all([inventarioApi.fetchMateriaPrima(), inventarioApi.fetchActivos()]);
        if (cancelled) return;
        setMateriaPrima(mp);
        setActivos(act);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveMateriaPrima = useCallback(async datos => {
    if (datos.rowIndex) await inventarioApi.updateMateriaPrima(datos);
    else await inventarioApi.appendMateriaPrima({ ...datos, id: crypto.randomUUID() });
    await reload();
  }, [reload]);

  const deleteMateriaPrima = useCallback(async rowIndex => {
    await inventarioApi.deleteMateriaPrimaRow(rowIndex);
    await reload();
  }, [reload]);

  const saveActivo = useCallback(async datos => {
    if (datos.rowIndex) await inventarioApi.updateActivo(datos);
    else await inventarioApi.appendActivo({ ...datos, id: crypto.randomUUID() });
    await reload();
  }, [reload]);

  const deleteActivo = useCallback(async rowIndex => {
    await inventarioApi.deleteActivoRow(rowIndex);
    await reload();
  }, [reload]);

  return {
    materiaPrima, activos, loading, error,
    saveMateriaPrima, deleteMateriaPrima, saveActivo, deleteActivo
  };
}
