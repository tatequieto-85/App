import './Card.css';

// variant "flat" = sin caja blanca (equivalente a .card--flat), para vistas
// donde el contenido ya trae sus propias tarjetas con borde.
export default function Card({ variant, className = '', children, ...rest }) {
  const flat = variant === 'flat';
  return (
    <div className={`card${flat ? ' card--flat' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}
