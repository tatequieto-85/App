import { useCallback } from 'react';

// Equivalente a confirmCloseIfDirty() en ../../../utils.js: pide confirmación
// antes de cerrar si isDirtyFn() devuelve true.
export function useDirtyGuard(isDirtyFn, onClose) {
  return useCallback(() => {
    if (isDirtyFn() && !window.confirm('¿Salir sin guardar? Se perderán los cambios.')) return;
    onClose();
  }, [isDirtyFn, onClose]);
}
