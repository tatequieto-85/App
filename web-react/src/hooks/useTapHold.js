import { useCallback, useRef } from 'react';

const LONG_PRESS_MS = 550;

// Gesto de una tarjeta accionable (p. ej. un widget de Home): un solo toque
// dispara la acción principal; mantener presionado dispara otra cosa (acá,
// "quitar de Home") — a diferencia de useRowGestures.js (pensado para filas
// de lista, donde la acción principal es un doble clic/toque, no uno solo).
export function useTapHold({ onTap, onLongPress, disabled }) {
  const timerRef = useRef(null);
  const longPressedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const start = useCallback(() => {
    if (disabled || !onLongPress) return;
    longPressedRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }, [disabled, onLongPress, clearTimer]);

  // El click que sigue naturalmente a soltar un mousedown/touchend también
  // dispararía onTap si no se filtra acá — por eso se suprime cuando el
  // long-press ya se activó.
  const handleClick = useCallback(() => {
    clearTimer();
    if (longPressedRef.current) { longPressedRef.current = false; return; }
    if (disabled) return;
    onTap?.();
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
