import { useEffect, useState } from 'react';
import * as recetasApi from '../../services/recetasApi';
import * as comprasApi from '../../services/comprasApi';
import * as ingredientesApi from '../../services/ingredientesApi';

// Datos de solo lectura para la Calculadora — lee Recetas (Procesos),
// Compras e Ingredientes directo, mismo patrón que Stock lee Procesos/
// Ferias sin tener que migrar esos módulos enteros a esta pantalla.
// Ingredientes hace falta para el stock corriente (ver "Falta comprar" en
// CalculadoraPage.jsx, a pedido explícito del usuario).
export function useCalculadora() {
  const [recetas, setRecetas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([
          recetasApi.ensureRecetasSheets(), comprasApi.ensureComprasSheet(), ingredientesApi.ensureIngredientesSheet()
        ]);
        const [r, c, i] = await Promise.all([
          recetasApi.fetchRecetas(), comprasApi.fetchCompras(), ingredientesApi.fetchIngredientes()
        ]);
        if (cancelled) return;
        setRecetas(r);
        setCompras(c);
        setIngredientes(i);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { recetas, compras, ingredientes, loading, error };
}
