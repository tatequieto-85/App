// Portado de updateAppIconBadge()/requestAppBadgePermission() en
// ../../../tareas.js — Badging API del ícono de la PWA instalada (soportada
// en iOS 16.4+ y Chrome/Android; en navegadores sin soporte no hace nada).
// Compartido entre Tareas y Contenido, que son los dos módulos que suman al
// mismo contador (tareas hoy/atrasadas + historias hoy/vencidas) — igual que
// en la app vanilla, el número que queda puesto es el del último módulo que
// lo actualizó (no una unión en vivo de ambos, ver nota en useStories.js).
export function updateAppIconBadge(count) {
  if (!('setAppBadge' in navigator)) return;
  if (count > 0) navigator.setAppBadge(count).catch(() => {});
  else navigator.clearAppBadge().catch(() => {});
}

// En iOS, el badge del ícono no aparece hasta que el usuario concede permiso
// de notificaciones — el pedido tiene que salir de un toque directo (si se
// dispara solo, p. ej. al cargar la app, Safari lo bloquea sin mostrar nada).
export async function requestAppBadgePermission() {
  if (!('Notification' in window) || !('setAppBadge' in navigator)) {
    return { ok: false, msg: 'Tu navegador no soporta el contador en el ícono.' };
  }
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!isStandalone) {
    return { ok: false, msg: 'Abre la app desde el ícono de tu pantalla de inicio (no desde el navegador) y vuelve a intentar.' };
  }
  if (Notification.permission === 'denied') {
    return { ok: false, msg: 'Las notificaciones están bloqueadas para esta app — actívalas en Ajustes del sistema > Notificaciones.' };
  }
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') {
    return { ok: false, msg: 'No se activó el contador — permiso denegado.' };
  }
  return { ok: true, msg: 'Contador activado en el ícono.' };
}
