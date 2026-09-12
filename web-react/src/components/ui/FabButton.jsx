import './FabButton.css';

// Botón de acción primaria fijo al pie de la pantalla — mismo patrón que
// .btn-fab en ../../../../style.css (ya usado en otros módulos de la app
// vanilla, p. ej. "+ Agregar" en Tareas).
export default function FabButton({ children, ...rest }) {
  return (
    <button type="button" className="btn-fab" {...rest}>
      {children}
    </button>
  );
}
