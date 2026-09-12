import Icon from '../icons/Icon';
import './AppCard.css';

// Tarjeta de módulo del home — mismo patrón que .app-card de la app vanilla:
// caja blanca, ícono de color adentro, nombre debajo de la caja (afuera del
// ícono). `color` es una de las variantes de .app-card-icon--* (ver
// moduleRegistry.js).
export default function AppCard({ icon, label, color, onClick }) {
  return (
    <button type="button" className="app-card" onClick={onClick}>
      <span className={`app-card-icon app-card-icon--${color}`}>
        <Icon name={icon} size={24} className="app-card-icon-glyph" />
      </span>
      <span className="app-card-label">{label}</span>
    </button>
  );
}
