import { useCallback, useEffect, useState } from 'react';
import * as inventarioApi from '../../services/inventarioApi';

// Inventario de activos — la sección "Inventario de materia prima" que
// vivía acá se fusionó con Insumos (ver migrateMateriaPrima() en
// ingredientesApi.js), así que este hook quedó solo para activos.
export function useInventarioExtra() {
  const [activos, setActivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setActivos(await inventarioApi.fetchActivos());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await inventarioApi.ensureInventarioSheets();
        const act = await inventarioApi.fetchActivos();
        if (cancelled) return;
        setActivos(act);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveActivo = useCallback(async datos => {
    if (datos.rowIndex) await inventarioApi.updateActivo(datos);
    else await inventarioApi.appendActivo({ ...datos, id: crypto.randomUUID() });
    await reload();
  }, [reload]);

  const deleteActivo = useCallback(async rowIndex => {
    await inventarioApi.deleteActivoRow(rowIndex);
    await reload();
  }, [reload]);

  return { activos, loading, error, saveActivo, deleteActivo };
}
