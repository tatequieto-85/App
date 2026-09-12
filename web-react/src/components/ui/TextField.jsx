import { forwardRef } from 'react';
import './TextField.css';

// Equivalente a .field-label + .field-input + .field-error en la app vanilla.
// forwardRef: lo necesita ThousandsField para controlar la posición del
// cursor mientras reformatea el valor en vivo.
const TextField = forwardRef(function TextField({ label, error, id, className = '', ...rest }, ref) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <input
        ref={ref}
        id={id}
        className={`field-input${error ? ' field-input--invalid' : ''}`}
        {...rest}
      />
      <span className="field-error">{error || ''}</span>
    </div>
  );
});

export default TextField;
