import { forwardRef } from 'react';
import './Select.css';

// Equivalente a .field-label + .field-input (select) en la app vanilla.
// options: [{ value, label }].
const Select = forwardRef(function Select({ label, id, options, className = '', ...rest }, ref) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <select ref={ref} id={id} className="field-select" {...rest}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
});

export default Select;
