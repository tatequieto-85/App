// ── Sistema anti-clics involuntarios (ignora taps fantasma tras un scroll) ────
// En móvil, si el usuario desliza/hace scroll y el dedo se levanta sobre un
// botón o tarjeta, el navegador dispara igual un "click" sintético. Aquí se
// detecta ese movimiento y se cancela ese click (y el "tap" de doble-toque).

const TOUCH_TAP_MOVE_THRESHOLD = 10; // px
let touchTapStartX  = 0;
let touchTapStartY  = 0;
let touchTapMoved   = false;
let suppressNextClick = false;

document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return;
  touchTapStartX = e.touches[0].clientX;
  touchTapStartY = e.touches[0].clientY;
  touchTapMoved  = false;
}, { passive: true, capture: true });

document.addEventListener('touchmove', e => {
  if (touchTapMoved || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - touchTapStartX;
  const dy = e.touches[0].clientY - touchTapStartY;
  if (Math.hypot(dx, dy) > TOUCH_TAP_MOVE_THRESHOLD) touchTapMoved = true;
}, { passive: true, capture: true });

document.addEventListener('touchend', () => {
  if (touchTapMoved) suppressNextClick = true;
}, { capture: true });

document.addEventListener('click', e => {
  if (!suppressNextClick) return;
  suppressNextClick = false;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}, { capture: true });

export function wasAccidentalTouch() {
  return touchTapMoved;
}
