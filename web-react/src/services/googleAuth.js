// Portado de ../../auth.js — mismo backend (Google Sheets vía OAuth), mismo
// contrato de sheetsReq(). Simplificado al flujo implícito (popup) en vez del
// redirect+Cloudflare Worker de la app vanilla, para no requerir una redirect
// URI de localhost en Google Cloud Console durante el piloto — ver ../../.env.
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID;
const SHEET_ID  = import.meta.env.VITE_SHEET_ID;
const SCOPES    = import.meta.env.VITE_SCOPES;

const TOKEN_KEY          = 'ss_react_token';
const EXPIRY_KEY         = 'ss_react_tokenExpiry';
// A diferencia de TOKEN_KEY/EXPIRY_KEY (que quedan viejos apenas el token
// vence), esta marca queda para siempre una vez que el usuario dio permiso
// la primera vez — sirve para distinguir "nunca inició sesión" (hace falta
// la pantalla de consentimiento completa) de "la sesión venció, pero ya
// había dado permiso antes" (alcanza con un `prompt:''` silencioso, sin
// mostrarle nada). Antes esas dos situaciones se trataban igual y el
// usuario tenía que volver a aceptar el permiso cada vez que pasaba más de
// ~1h sin usar la app — ver ensureToken()/signIn().
const EVER_SIGNED_IN_KEY = 'ss_react_everSignedIn';

let accessToken = null;
let tokenExpiry  = null;
let tokenClient  = null;

function saveToken(token, expiresIn) {
  accessToken = token;
  tokenExpiry = Date.now() + expiresIn * 1000;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, String(tokenExpiry));
  localStorage.setItem(EVER_SIGNED_IN_KEY, '1');
}

export function hasSignedInBefore() {
  return localStorage.getItem(EVER_SIGNED_IN_KEY) === '1';
}

function loadSavedToken() {
  const token  = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0', 10);
  if (token && Date.now() < expiry - 5 * 60 * 1000) {
    accessToken = token;
    tokenExpiry = expiry;
    return true;
  }
  return false;
}

function initTokenClient() {
  if (tokenClient) return tokenClient;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: () => {} // se reemplaza por llamada, ver ensureToken/signIn
  });
  return tokenClient;
}

export function isSignedIn() {
  return loadSavedToken();
}

// `silent`: fuerza prompt:'' aunque nunca se haya guardado la marca de
// "ya dio permiso" (la usa refreshIfNeeded() para reintentar en segundo
// plano sin arriesgarse a disparar el diálogo completo de consentimiento).
export function signIn({ silent } = {}) {
  return new Promise((resolve, reject) => {
    const client = initTokenClient();
    client.callback = resp => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      saveToken(resp.access_token, resp.expires_in);
      resolve();
    };
    const puedeSerSilencioso = silent || loadSavedToken() || hasSignedInBefore();
    client.requestAccessToken({ prompt: puedeSerSilencioso ? '' : 'consent' });
  });
}

export function signOut() {
  if (accessToken) window.google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(EVER_SIGNED_IN_KEY);
}

async function ensureToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) return;
  if (loadSavedToken()) return;
  await signIn();
}

// Renueva el token ANTES de que venza, mientras la pestaña sigue abierta —
// ver useAuth.js, que llama a esto cada pocos minutos. Como ya dio permiso
// antes, esto se resuelve solo (prompt:'' ) sin mostrarle nada al usuario
// en la gran mayoría de los casos; si el navegador bloquea el renovado
// silencioso (cookies de terceros restringidas, etc.) esto simplemente
// falla en silencio y el próximo pedido real lo va a pedir de nuevo por el
// camino normal de ensureToken().
export async function refreshIfNeeded() {
  if (accessToken && Date.now() < tokenExpiry - 5 * 60 * 1000) return;
  if (!hasSignedInBefore()) return;
  await signIn({ silent: true }).catch(() => {});
}

const SHEETS_BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

// ── Caché en memoria + reintento ante fallos transitorios ───────────────────
// Antes, CADA pantalla releía todo desde cero al montarse (incluidos los
// chequeos de "¿existe esta hoja?" que en la práctica nunca cambian después
// de la primera vez) — eso hacía que abrir un módulo, volver, y abrirlo de
// nuevo tardara lo mismo que la primera vez, y que Ventas en particular
// (que además lee datos de Procesos y Stock) dispare 8-10 pedidos por
// visita. Un solo fallo transitorio (un hipo de red, o pegarle al límite de
// pedidos de Google si se navega rápido entre pantallas) tiraba abajo toda
// la carga sin reintentar. Ambos problemas se resuelven acá, en el único
// punto por el que pasan todos los pedidos — así cualquier módulo nuevo lo
// hereda gratis, sin tocar cada hook.
//
// Caché: solo GET, por URL completa, con un TTL corto — bastante para que
// navegar entre pantallas sin guardar nada se sienta instantáneo, sin
// arriesgarse a mostrar datos viejos por mucho tiempo. Cualquier escritura
// (POST/PUT, incluido un batchUpdate) invalida TODA la caché — más simple y
// seguro que invalidar por rango, y el volumen de pedidos de esta app es
// chico como para que importe la pérdida de precisión.
const CACHE_TTL_MS = 60000;
const cache    = new Map(); // url -> { data, time }
const inFlight = new Map(); // url -> Promise (dedup de pedidos GET simultáneos a la misma URL)

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Reintenta un error de red (fetch ni siquiera llegó a responder) o una
// respuesta 429 (límite de pedidos)/5xx (error del lado de Google) — nunca
// un 4xx de este lado (400/403/404), que va a fallar igual la próxima vez.
async function fetchWithRetry(url, opts, attempt = 0) {
  const MAX_RETRIES = 2;
  let resp;
  try {
    resp = await fetch(url, opts);
  } catch (networkErr) {
    if (attempt >= MAX_RETRIES) throw networkErr;
    await sleep(400 * 3 ** attempt);
    return fetchWithRetry(url, opts, attempt + 1);
  }
  if ((resp.status === 429 || resp.status >= 500) && attempt < MAX_RETRIES) {
    await sleep(400 * 3 ** attempt);
    return fetchWithRetry(url, opts, attempt + 1);
  }
  return resp;
}

export async function sheetsReq(path, opts = {}, retried) {
  await ensureToken();
  const url   = path.startsWith('http') ? path : `${SHEETS_BASE}${path}`;
  const isGet = !opts.method || opts.method === 'GET';

  if (isGet) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.data;
    if (inFlight.has(url)) return inFlight.get(url);
  }

  const promise = performRequest(url, opts, retried, isGet);
  if (isGet) {
    inFlight.set(url, promise);
    promise.finally(() => inFlight.delete(url));
  }
  return promise;
}

async function performRequest(url, opts, retried, isGet) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(isGet ? {} : { 'Content-Type': 'application/json' }),
    ...(opts.headers || {})
  };
  const resp = await fetchWithRetry(url, { ...opts, headers });
  if (resp.status === 401 && !retried) {
    accessToken = null;
    return sheetsReq(url, opts, true);
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets error ${resp.status}`);
  }
  const data = await resp.json();
  if (isGet) cache.set(url, { data, time: Date.now() });
  else cache.clear();
  return data;
}
