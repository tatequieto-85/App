import './NavBar.css';

// Nav mínima del piloto — reemplaza temporalmente al home de tarjetas de
// ../../../main.js (navigateTo) mientras solo hay dos módulos migrados.
export default function NavBar({ page, onChange }) {
  return (
    <nav className="pilot-nav">
      <button className={page === 'ingredientes' ? 'active' : ''} onClick={() => onChange('ingredientes')}>
        Ingredientes
      </button>
      <button className={page === 'compras' ? 'active' : ''} onClick={() => onChange('compras')}>
        Compras
      </button>
    </nav>
  );
}
