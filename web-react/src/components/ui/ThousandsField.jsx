import { useRef } from 'react';
import TextField from './TextField';
import { reformatThousandsDraft } from '../../utils/format';

// Input numérico con separador de miles en vivo (es-CO: punto de miles, coma
// decimal) — equivalente a attachThousandsInput() en ../../../utils.js, como
// componente controlado reutilizable (Compras lo usa para Cantidad/Precio;
// cualquier módulo con montos de dinero o cantidades puede reusarlo).
export default function ThousandsField({ value, onChange, ...rest }) {
  const inputRef = useRef(null);

  function handleChange(e) {
    const el = e.target;
    const cursorFromEnd = el.value.length - el.selectionStart;
    const formatted = reformatThousandsDraft(el.value);
    onChange(formatted);
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      const pos = Math.max(0, formatted.length - cursorFromEnd);
      inputRef.current.setSelectionRange(pos, pos);
    });
  }

  return (
    <TextField
      ref={inputRef}
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      {...rest}
    />
  );
}
