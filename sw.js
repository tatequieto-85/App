const CACHE = 'ss-v2';
const ASSETS = ['./', './index.html', './style.css', './app.js', './config.js', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== 'ss-config').map(k => caches.delete(k)))
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

// ── Periodic background sync: WhatsApp reminders ─────────────────────────────

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'whatsapp-reminder') {
    event.waitUntil(sendPeriodicReminder());
  }
});

async function sendPeriodicReminder() {
  try {
    const cache = await caches.open('ss-config');
    const resp  = await cache.match('whatsapp-config');
    if (!resp) return;
    const { phone, apikey } = await resp.json();
    if (!phone || !apikey) return;

    // Get Colombia time (UTC-5)
    const now  = new Date();
    const opts = { timeZone: 'America/Bogota' };
    const h    = parseInt(new Intl.DateTimeFormat('en-CA', { ...opts, hour: '2-digit', hour12: false }).format(now));
    const m    = parseInt(new Intl.DateTimeFormat('en-CA', { ...opts, minute: '2-digit' }).format(now));
    const today = new Intl.DateTimeFormat('en-CA', opts).format(now);

    if (!((h === 9 && m < 5) || (h === 16 && m < 5))) return;

    const sentKey = `sw-notif-${today}-${h}`;
    const sentResp = await cache.match(sentKey);
    if (sentResp) return;
    await cache.put(sentKey, new Response('1'));

    const emoji  = h === 9 ? '🌅' : '🌆';
    const saludo = h === 9 ? 'Buenos días' : 'Buenas tardes';
    const msg    = `${emoji} TateQuieto — ${saludo}! Revisa tus historias de Instagram programadas para hoy.`;

    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(msg)}&apikey=${encodeURIComponent(apikey)}`);
  } catch (e) {
    console.warn('SW periodic reminder failed:', e);
  }
}
