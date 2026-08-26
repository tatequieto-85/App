# Worker de sesión (reemplaza al proxy de Apps Script)

Backend mínimo en Cloudflare Workers: mantiene la sesión de Google renovada sin
pedirle nada al usuario, sin depender de que el navegador conserve cookies de
Google (eso es justo lo que falla en la PWA instalada en iPhone/Android). El
`refresh_token` de Google vive únicamente acá (Cloudflare KV) — nunca llega al
navegador. Ver `../auth.js` para el lado del frontend.

## Requisitos

- Cuenta de Cloudflare (gratis alcanza).
- Node y `npx` instalados (para correr `wrangler` sin instalarlo global).
- El **Client Secret** OAuth de este proyecto en Google Cloud Console
  (Credenciales → el mismo Client ID que ya está en `config.js`).

## Deploy paso a paso

Desde esta carpeta (`worker/`):

```bash
# 1. Login a Cloudflare (abre el navegador)
npx wrangler login

# 2. Crear el namespace de KV donde se guardan los refresh_token.
#    OJO: si tu cuenta de Cloudflare ya tiene otro proyecto (ver Finanzas
#    Hogar) usando el nombre "REFRESH_TOKENS", elegí un nombre distinto para
#    este — dos apps compartiendo el mismo namespace pisarían el
#    refresh_token de la otra si algún usuario usa el mismo email en ambas.
#    Ya se creó como TATEAPP_REFRESH_TOKENS (id ya cargado en wrangler.toml).
npx wrangler kv namespace create TATEAPP_REFRESH_TOKENS
# Copiar el "id" que devuelve y pegarlo en wrangler.toml, en kv_namespaces
# (el "binding" se deja como REFRESH_TOKENS, es solo el nombre que usa el
# código en worker/src/index.js — no hace falta que coincida con el título).

# 3. Cargar los secretos (no van en el repo, quedan cifrados en Cloudflare)
npx wrangler secret put GOOGLE_CLIENT_SECRET
# (pegar el Client Secret de Google Cloud Console cuando lo pida)

npx wrangler secret put JWT_SECRET
# (pegar cualquier cadena larga y random — ej: `openssl rand -hex 32`)

# 4. Revisar wrangler.toml: GOOGLE_CLIENT_ID, ALLOWED_ORIGIN y REDIRECT_URI
#    ya están completados con los valores de este proyecto; ajustar solo si
#    cambian. REDIRECT_URI tiene que estar además cargado, byte a byte igual,
#    como "URI de redireccionamiento autorizada" del Client ID en Google
#    Cloud Console (Credenciales → tu OAuth Client → esa sección) — si no,
#    Google rechaza el login con redirect_uri_mismatch.

# 5. Deploy
npx wrangler deploy
```

El comando final imprime la URL pública (algo como
`https://tateapp-token.<tu-cuenta>.workers.dev`). Esa URL va en
`../config.js`, en `WORKER_URL`.

## Probar en local antes de deploy (opcional)

```bash
npx wrangler dev
```

Sirve el Worker en `http://localhost:8787`. Para probarlo de verdad hace falta
un authorization code real de Google (no se puede simular a mano), así que en
la práctica es más simple ir directo a `wrangler deploy` y probar contra la
app real apuntando `WORKER_URL` al Worker recién desplegado.

## Actualizar el Worker ya desplegado

Cualquier cambio a `src/index.js` (como el endpoint `/calendar.ics` que arma
el feed de calendario de Tareas) necesita un `npx wrangler deploy` nuevo
desde esta carpeta para que quede en línea — a diferencia del frontend
(GitHub Pages), esto no se actualiza solo con el push a `main`.

## Qué NO hace este Worker

- No revoca el `refresh_token` al hacer "Cerrar sesión" en la app (mismo
  riesgo aceptado que ya existía con el proxy de Apps Script — ver el
  comentario en `signOut()` de `auth.js`). Si hace falta revocar el acceso de
  un dispositivo específico de verdad, hay que borrar la entrada
  correspondiente del namespace KV a mano (`wrangler kv key delete`).
- No tiene nada que ver con los recordatorios de WhatsApp
  (`notificacion-apps-script.gs`) — ese script de Apps Script sigue
  funcionando igual, es independiente de esto.
