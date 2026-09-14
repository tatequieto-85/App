import { useEffect, useRef } from 'react';

// Cierra un panel propio de la tarjeta (la barra de Editar/Eliminar que
// abre useRowGestures con mantener presionado) al tocar/clicar afuera —
// bug real reportado por el usuario: quedaba abierta para siempre si no
// se tocaba explícitamente Editar/Eliminar. Ver también el patrón
// equivalente pero con estado en el padre en ContactosPage.jsx.
export function useCloseOnOutsideClick(active, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return;
    function handleDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [active, onClose]);
  return ref;
}
