import { useEffect, useRef } from 'react';

// Gesto estándar de iPhone: deslizar desde el borde izquierdo de la
// pantalla hacia la derecha vuelve atrás — a pedido explícito del
// usuario, toda ventana con flecha de volver (Modal showBack, PageHeader
// onBack) tiene que responder también a este gesto, no solo al toque en
// la flecha.
const EDGE_WIDTH = 24;   // px desde el borde izquierdo donde puede arrancar el gesto
const THRESHOLD = 80;    // px de desplazamiento horizontal para disparar "volver"
const MAX_VERTICAL = 60; // px de desplazamiento vertical tolerado (si se supera, es scroll, no el gesto)

// Varias ventanas pueden estar montadas a la vez (modales anidados, ver
// RecetaDetailModal → EjecucionInsumosSection) — el gesto tiene que
// responder solo a la de más arriba (la última montada), nunca a todas a
// la vez. `stack` guarda, en orden de montaje, las instancias activas.
let stack = [];

export function useSwipeBack(active, onBack) {
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = Symbol('swipeback');
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return undefined;
    const id = idRef.current;
    stack.push(id);
    return () => { stack = stack.filter(x => x !== id); };
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const id = idRef.current;
    let tracking = false;
    let startX = 0;
    let startY = 0;

    function onTouchStart(e) {
      if (stack[stack.length - 1] !== id) { tracking = false; return; }
      const t = e.touches[0];
      tracking = t.clientX <= EDGE_WIDTH;
      startX = t.clientX;
      startY = t.clientY;
    }
    function onTouchMove(e) {
      if (!tracking) return;
      const t = e.touches[0];
      if (Math.abs(t.clientY - startY) > MAX_VERTICAL) tracking = false;
    }
    function onTouchEnd(e) {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dx > THRESHOLD && dy < MAX_VERTICAL) onBackRef.current?.();
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [active]);
}
