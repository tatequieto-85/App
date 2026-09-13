import { useCallback, useRef } from 'react';

const LONG_PRESS_MS = 550;

// Gesto estándar de la app para filas de lista/tarjetas — mantener
// presionado abre la barra de acciones (editar/eliminar) de esa fila; un
// solo clic/toque dispara la acción principal (p. ej. abrir el detalle).
// Antes la acción principal necesitaba doble clic/toque; el usuario pidió
// pasar TODAS las acciones de doble clic a un solo clic, igual que ya
// funcionan los widgets de Home (ver useTapHold.js, mismo patrón) — el
// clic fantasma que el navegador dispara después de un scroll en móvil ya
// lo filtra utils/inputGuard.js a nivel global, así que no hace falta
// lógica extra acá para eso.
// onTap es opcional — una fila que solo necesita long-press (p. ej. una
// tarjeta de Producto testigo en Stock, sin acción de un toque) no lo pasa.
export function useRowGestures({ onLongPress, onTap, disabled }) {
  const timerRef = useRef(null);
  const longPressedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const start = useCallback(e => {
    if (disabled || e.target.closest('button')) return;
    longPressedRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      onLongPress?.();
    }, LONG_PRESS_MS);
  }, [disabled, onLongPress, clearTimer]);

  // El click que sigue naturalmente a soltar un mousedown/touchend también
  // dispararía onTap si no se filtra acá — por eso se suprime cuando el
  // long-press ya se activó.
  const handleClick = useCallback(e => {
    clearTimer();
    if (longPressedRef.current) { longPressedRef.current = false; return; }
    if (disabled || !onTap || e.target.closest('button')) return;
    onTap();
  }, [clearTimer, disabled, onTap]);

  return {
    onMouseDown: start,
    onMouseUp: clearTimer,
    onMouseLeave: clearTimer,
    onTouchStart: start,
    onTouchMove: clearTimer,
    onTouchEnd: clearTimer,
    onClick: handleClick
  };
}
