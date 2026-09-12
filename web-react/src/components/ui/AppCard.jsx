import Icon from '../icons/Icon';
import './AppCard.css';

// Tarjeta de módulo del home — mismo patrón que .app-card en style.css
// (icono + nombre, grid que se acomoda solo en pantallas angostas).
export default function AppCard({ icon, label, sub, onClick }) {
  return (
    <button type="button" className="app-card" onClick={onClick}>
      <span className="app-card-icon"><Icon name={icon} size={26} /></span>
      <span className="app-card-label">{label}</span>
      {sub && <span className="app-card-sub">{sub}</span>}
    </button>
  );
}
