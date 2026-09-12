import Icon from '../icons/Icon';
import './AppCard.css';

// Tarjeta de módulo del home — sin caja blanca (ver AppCard.css): la caja
// morada es el ícono, más grande, y el nombre va justo debajo con poco
// espacio, para que se lea pegado a la caja sin quedar adentro.
export default function AppCard({ icon, label, onClick }) {
  return (
    <button type="button" className="app-card" onClick={onClick}>
      <span className="app-card-icon-box">
        <Icon name={icon} size={40} />
      </span>
      <span className="app-card-label">{label}</span>
    </button>
  );
}
