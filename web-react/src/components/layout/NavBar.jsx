import './NavBar.css';

// Nav mínima del piloto — reemplaza temporalmente al home de tarjetas de
// ../../../main.js (navigateTo) mientras se migran los módulos uno por uno.
export default function NavBar({ page, onChange }) {
  return (
    <nav className="pilot-nav">
      <button className={page === 'compras' ? 'active' : ''} onClick={() => onChange('compras')}>
        Ingredientes y compras
      </button>
      <button className={page === 'stock' ? 'active' : ''} onClick={() => onChange('stock')}>
        Stock
      </button>
    </nav>
  );
}
