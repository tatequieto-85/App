const CACHE = 'ss-v105';
const ASSETS = [
  './', './index.html', './style.css', './config.js', './vendor-qrcode.js',
  './utils.js', './input-guard.js', './db-state.js', './undo.js', './auth.js',
  './ingredientes.js', './qr.js', './ideas.js', './contenido.js', './tareas.js', './compras.js',
  './procesos.js', './ferias.js', './stock.js', './informes.js', './bases.js', './main.js',
  './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png'
];

// El recordatorio diario de WhatsApp (9am/4pm) lo envía notificacion-apps-script.gs
// desde Google Apps Script (trigger de tiempo server-side), no este service worker.

self.addEventListener('install', e => {
  // fetch con {cache:'reload'} en vez de c.addAll(ASSETS): addAll hace fetches
  // normales que respetan el Cache-Control del servidor (GitHub Pages manda
  // max-age=600) — si el archivo ya estaba en la caché HTTP del celular de
  // los últimos 10 minutos, la versión nueva del SW terminaba guardando bytes
  // viejos igual, aunque el nombre de CACHE ya fuera el correcto.
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(ASSETS.map(url =>
        fetch(url, { cache: 'reload' }).then(res => c.put(url, res)).catch(() => {})
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Todo lo cross-origin (Sheets, Drive, el Worker de sesión en auth.js, etc.)
  // queda sin manejar acá a propósito: nunca se cachea, siempre va directo a
  // la red. NO sacar este chequeo — sin él, la primera respuesta del Worker
  // de sesión (un access_token) quedaría cacheada para siempre y ningún
  // intento de renovación posterior volvería a tocar la red de verdad.
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
