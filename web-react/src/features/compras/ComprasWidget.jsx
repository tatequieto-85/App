import Widget from '../../components/ui/Widget';
import { useIngredientes } from '../ingredientes/useIngredientes';
import { useCompras } from './useCompras';

// Resumen de Ingredientes y compras para la pantalla principal.
export default function ComprasWidget({ onClick }) {
  const { ingredientes, loading: loadingIng } = useIngredientes();
  const { rows, loading: loadingCompras } = useCompras(ingredientes);
  const loading = loadingIng || loadingCompras;
  const sinCompras = rows.filter(r => !r.last).length;

  return (
    <Widget icon="cart" title="Ingredientes y compras" onClick={onClick}>
      {loading ? (
        <p className="widget-line widget-line--sub">Cargando…</p>
      ) : (
        <>
          <p className="widget-line"><strong>{rows.length}</strong> ingredientes registrados</p>
          <p className="widget-line widget-line--sub">
            {sinCompras ? `${sinCompras} sin compras registradas` : 'Todos con compras registradas'}
          </p>
        </>
      )}
    </Widget>
  );
}
