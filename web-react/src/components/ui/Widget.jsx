import Icon from '../icons/Icon';
import './Widget.css';

// Resumen compacto de un módulo en la pantalla principal — cada módulo
// migrado trae el suyo (ver ComprasWidget/StockWidget). Máximo 25% del alto
// de pantalla (regla del usuario), con el contenido propio recortado si no
// entra, nunca estirando el widget más allá de ese límite.
export default function Widget({ icon, title, onClick, children }) {
  return (
    <button type="button" className="widget" onClick={onClick}>
      <div className="widget-header">
        {icon && <span className="widget-icon"><Icon name={icon} size={16} /></span>}
        <span className="widget-title">{title}</span>
      </div>
      <div className="widget-body">{children}</div>
    </button>
  );
}
