const CACHE = 'ss-v49';
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
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
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
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
