import Icon from '../icons/Icon';

// Encabezado estándar de cualquier pantalla de módulo: flecha de volver un
// paso + título, arriba a la izquierda. Hoy (con un solo módulo migrado)
// "volver" significa cerrar sesión — es el único paso anterior que existe en
// el piloto. Cuando haya más módulos, onBack pasará a volver a la pantalla
// (o base de datos) de la que vino el usuario.
export default function PageHeader({ title, onBack }) {
  return (
    <div className="page-header">
      {onBack && (
        <button type="button" className="back-button" onClick={onBack} aria-label="Volver">
          <Icon name="arrowLeft" size={18} />
        </button>
      )}
      <h1 className="section-title">{title}</h1>
    </div>
  );
}
