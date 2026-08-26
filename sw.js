const CACHE = 'ss-v124';
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
  //
  // Sin .catch() acá a propósito: si UN solo archivo falla (hipo de red,
  // 404 por un ASSETS desactualizado, etc.), todo el install tiene que
  // fallar y quedarse con la versión vieja — que sigue andando — en vez de
  // "activarse" con esa versión nueva incompleta. Antes se ignoraba el
  // error de cada archivo por separado: la versión nueva quedaba con un
  // módulo faltante Y de paso borraba (en 'activate') la caché vieja que sí
  // lo tenía completo — la app quedaba rota sin forma de recuperarse sola
  // (típico síntoma: se traba en la pantalla de "Continuar con Google"
  // porque auth.js u otro módulo del que depende el arranque no cargó
  // bien). El navegador reintenta el install solo más adelante.
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(ASSETS.map(url =>
        fetch(url, { cache: 'reload' }).then(res => {
          if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
          return c.put(url, res);
        })
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
