import { forwardRef } from 'react';
import './Textarea.css';

// Equivalente a .field-label + .field-textarea en la app vanilla.
const Textarea = forwardRef(function Textarea({ label, id, className = '', ...rest }, ref) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <textarea ref={ref} id={id} className="field-textarea" {...rest} />
    </div>
  );
});

export default Textarea;
