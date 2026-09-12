import Icon from '../icons/Icon';
import './SearchBar.css';

// Barra de búsqueda genérica — filtra en el cliente lo que sea que el
// llamador le pase (acá, la lista de ingredientes de Compras). Reutilizable
// por cualquier otro módulo con una lista larga (Contactos, Tareas, etc.).
export default function SearchBar({ value, onChange, placeholder = 'Buscar…' }) {
  return (
    <div className="search-bar">
      <Icon name="search" size={16} className="search-bar-icon" />
      <input
        type="text"
        className="search-bar-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button type="button" className="search-bar-clear" onClick={() => onChange('')} aria-label="Limpiar búsqueda">
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
