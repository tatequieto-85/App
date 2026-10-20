import { useEffect, useState } from 'react';
import * as recetasApi from '../../services/recetasApi';
import * as comprasApi from '../../services/comprasApi';

// Datos de solo lectura para la Calculadora — lee Recetas (Procesos) y
// Compras directo, mismo patrón que Stock lee Procesos/Ferias sin tener
// que migrar esos módulos enteros a esta pantalla.
export function useCalculadora() {
  const [recetas, setRecetas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([recetasApi.ensureRecetasSheets(), comprasApi.ensureComprasSheet()]);
        const [r, c] = await Promise.all([recetasApi.fetchRecetas(), comprasApi.fetchCompras()]);
        if (cancelled) return;
        setRecetas(r);
        setCompras(c);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { recetas, compras, loading, error };
}
