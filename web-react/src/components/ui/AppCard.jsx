import Icon from '../icons/Icon';
import './AppCard.css';

// Tarjeta de módulo del home — a pedido del usuario, sin caja blanca
// contenedora: el ícono de color ocupa todo el cuadrado (mismo tamaño que
// el espacio del grid) y el nombre va como texto claro adentro, no debajo
// (si fuera debajo, la tarjeta ya no mediría lo mismo que un widget).
export default function AppCard({ icon, label, onClick }) {
  return (
    <button type="button" className="app-card" onClick={onClick}>
      <Icon name={icon} size={28} />
      <span className="app-card-label">{label}</span>
    </button>
  );
}
