import { useEffect, useState } from 'react';
import * as recetasApi from '../../services/recetasApi';
import * as comprasApi from '../../services/comprasApi';
import * as ingredientesApi from '../../services/ingredientesApi';
import * as ejecucionesApi from '../../services/ejecucionesApi';
import * as feriasApi from '../../services/feriasApi';
import * as stockApi from '../../services/stockApi';

// Datos de solo lectura para la Calculadora — lee Recetas (Procesos),
// Compras, Ingredientes, Ejecuciones/Ferias/StockMovimientos (Stock)
// directo, mismo patrón que Stock lee Procesos/Ferias sin tener que
// migrar esos módulos enteros a esta pantalla. Ingredientes hace falta
// para el stock corriente de insumos ("Falta comprar"); Ejecuciones/
// Ferias/StockMovimientos para el stock del PRODUCTO ya hecho (ver
// getStockDisponibleGeneral en CalculadoraPage.jsx — si ya hay frascos
// de ese sabor sin vender, no hace falta producir esa cantidad de nuevo),
// ambos a pedido explícito del usuario.
export function useCalculadora() {
  const [recetas, setRecetas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [ejecuciones, setEjecuciones] = useState([]);
  const [ferias, setFerias] = useState([]);
  const [stockMovimientos, setStockMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([
          recetasApi.ensureRecetasSheets(), comprasApi.ensureComprasSheet(), ingredientesApi.ensureIngredientesSheet(),
          ejecucionesApi.ensureEjecucionesSheet(), feriasApi.ensureFeriasSheet(), stockApi.ensureStockSheets()
        ]);
        const [r, c, i, ej, f, sm] = await Promise.all([
          recetasApi.fetchRecetas(), comprasApi.fetchCompras(), ingredientesApi.fetchIngredientes(),
          ejecucionesApi.fetchEjecuciones(), feriasApi.fetchFerias(), stockApi.fetchStockMovimientos()
        ]);
        if (cancelled) return;
        setRecetas(r);
        setCompras(c);
        setIngredientes(i);
        setEjecuciones(ej);
        setFerias(f);
        setStockMovimientos(sm);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { recetas, compras, ingredientes, ejecuciones, ferias, stockMovimientos, loading, error };
}
