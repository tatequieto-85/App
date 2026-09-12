import { useCallback, useRef } from 'react';

const LONG_PRESS_MS = 550;
const DOUBLE_TAP_MS = 350;

// Gesto estándar de la app para filas de lista/tabla — mantener presionado
// abre la barra de acciones (editar/eliminar) de esa fila; doble clic o
// doble toque dispara la acción principal (p. ej. registrar). Antes esto
// vivía repetido a mano en cada módulo (ver renderComprasList() en
// ../../../compras.js); ahora es un hook único que cualquier lista reusa.
// Devuelve los handlers para pasarle directo al elemento de la fila.
export function useRowGestures({ onLongPress, onDoubleClick, disabled }) {
  const timerRef = useRef(null);
  const longPressedRef = useRef(false);
  const lastTapRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const start = useCallback(e => {
    if (disabled || e.target.closest('button')) return;
    longPressedRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }, [disabled, onLongPress, clearTimer]);

  const handleTouchEnd = useCallback(e => {
    clearTimer();
    if (longPressedRef.current) { longPressedRef.current = false; return; }
    if (disabled || e.target.closest('button')) return;
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      onDoubleClick();
    } else {
      lastTapRef.current = now;
    }
  }, [clearTimer, disabled, onDoubleClick]);

  const handleDoubleClick = useCallback(e => {
    if (disabled || e.target.closest('button')) return;
    onDoubleClick();
  }, [disabled, onDoubleClick]);

  return {
    onMouseDown: start,
    onMouseUp: clearTimer,
    onMouseLeave: clearTimer,
    onTouchStart: start,
    onTouchMove: clearTimer,
    onTouchEnd: handleTouchEnd,
    onDoubleClick: handleDoubleClick
  };
}
