import { useCallback, useRef } from 'react';

const LONG_PRESS_MS = 550;

// Mantener presionado un espacio VACÍO de un contenedor (no un ítem hijo
// marcado con `childSelector`) dispara onLongPress — lo usa el panel de
// widgets de Home para agregar uno nuevo sin un botón "+" explícito. Un
// long-press que empieza sobre un hijo (un widget ya puesto) no cuenta acá:
// ese long-press lo maneja el propio widget (ver useRowGestures.js).
export function useLongPressEmpty({ onLongPress, childSelector = '.sortable-item', disabled }) {
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const start = useCallback(e => {
    if (disabled || e.target.closest(childSelector)) return;
    clearTimer();
    timerRef.current = setTimeout(() => { onLongPress(); }, LONG_PRESS_MS);
  }, [disabled, childSelector, onLongPress, clearTimer]);

  return {
    onMouseDown: start,
    onMouseUp: clearTimer,
    onMouseLeave: clearTimer,
    onTouchStart: start,
    onTouchMove: clearTimer,
    onTouchEnd: clearTimer
  };
}
