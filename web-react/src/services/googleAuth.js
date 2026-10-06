// Portado de ../../auth.js — mismo backend (Google Sheets vía OAuth), mismo
// contrato de sheetsReq(). En producción usa el mismo flujo de sesión larga
// que la app vanilla (authorization-code + Cloudflare Worker propio que
// guarda el refresh_token y lo renueva sin depender de la cookie de sesión
// de Google — eso es lo que fallaba en Safari/PWA instalada en iPhone y
// obligaba a reingresar cada ~1h, bug real reportado por el usuario). En
// local (npm run dev) sigue el flujo implícito (popup) de antes, para no
// requerir una redirect URI de localhost en Google Cloud Console — ver
// ../../.env vs ../../.env.production, y worker/src/index.js
// (ALLOWED_REDIRECT_URIS: este piloto tiene su PROPIA redirect URI,
// registrada aparte de la de vanilla, mismo Client ID).
const CLIENT_ID    = import.meta.env.VITE_CLIENT_ID;
const SHEET_ID     = import.meta.env.VITE_SHEET_ID;
const SCOPES       = import.meta.env.VITE_SCOPES;
const WORKER_URL   = import.meta.env.VITE_WORKER_URL || '';
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || '';

const TOKEN_KEY          = 'ss_react_token';
const EXPIRY_KEY         = 'ss_react_tokenExpiry';
const SESSION_KEY        = 'ss_react_sessionToken';
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
let tokenClient  = null; // flujo implícito (fallback en local, sin Worker)
let codeClient   = null; // flujo authorization-code + refresh_token (producción)

const useRefreshFlow = () => !!(WORKER_URL && REDIRECT_URI);

function saveToken(token, expiresIn) {
  accessToken = token;
  tokenExpiry = Date.now() + expiresIn * 1000;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, String(tokenExpiry));
  localStorage.setItem(EVER_SIGNED_IN_KEY, '1');
}

function saveSessionToken(st) {
  if (st) localStorage.setItem(SESSION_KEY, st);
}

function getSessionToken() {
  return localStorage.getItem(SESSION_KEY);
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

// Pide un access_token nuevo al Worker usando el sessionToken guardado (el
// refresh_token real de Google vive únicamente en el Worker) — una llamada
// HTTPS directa, sin iframe ni cookies de Google, así que funciona igual en
// una PWA instalada en iPhone que en el navegador.
async function tryRefreshViaWorker() {
  const st = getSessionToken();
  if (!st) return false;
  try {
    const resp = await fetch(`${WORKER_URL}/token?session=${encodeURIComponent(st)}`).then(r => r.json());
    if (resp.error || !resp.access_token) return false;
    saveToken(resp.access_token, resp.expires_in || 3600);
    return true;
  } catch {
    return false;
  }
}

// Con ux_mode:'redirect', Google vuelve a REDIRECT_URI con ?code=... (o
// ?error=...) en vez de invocar un callback en memoria — hay que levantarlo
// de la URL al cargar la página y limpiarlo para no reprocesarlo en un
// refresh posterior.
function consumeCodeFromUrl() {
  const params = new URLSearchParams(location.search);
  if (!params.has('code') && !params.has('error')) return null;
  const code = params.get('code');
  ['code', 'scope', 'authuser', 'prompt', 'error'].forEach(k => params.delete(k));
  const clean = location.pathname + (params.toString() ? `?${params}` : '') + location.hash;
  history.replaceState({}, '', clean);
  return code;
}

async function exchangeCodeForTokens(code) {
  try {
    const resp = await fetch(
      `${WORKER_URL}/oauth/callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    ).then(r => r.json());
    if (resp.error || !resp.access_token) return false;
    saveToken(resp.access_token, resp.expires_in || 3600);
    saveSessionToken(resp.sessionToken);
    return true;
  } catch {
    return false;
  }
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

function initCodeClient() {
  if (codeClient) return codeClient;
  codeClient = window.google.accounts.oauth2.initCodeClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    ux_mode: 'redirect',
    redirect_uri: REDIRECT_URI,
    access_type: 'offline',
    prompt: 'consent' // fuerza que Google entregue refresh_token también en re-logins
  });
  return codeClient;
}

export function isSignedIn() {
  return loadSavedToken();
}

// Se llama UNA vez al arrancar (ver useAuth.js), antes de cualquier otra
// cosa — procesa un ?code=/?error= que vuelve de Google. No hace nada si
// esta build no usa el flujo de Worker (local) o si no hay nada que
// procesar en la URL.
export async function consumeRedirectIfAny() {
  if (!useRefreshFlow()) return false;
  const code = consumeCodeFromUrl();
  if (!code) return false;
  return exchangeCodeForTokens(code);
}

// `silent`: fuerza prompt:'' aunque nunca se haya guardado la marca de
// "ya dio permiso" (la usa refreshIfNeeded() para reintentar en segundo
// plano sin arriesgarse a disparar el diálogo completo de consentimiento).
export function signIn({ silent } = {}) {
  if (useRefreshFlow()) {
    if (silent) {
      return tryRefreshViaWorker().then(ok => { if (!ok) throw new Error('No se pudo renovar la sesión en segundo plano.'); });
    }
    // ux_mode:'redirect' navega la página entera a Google — nunca vuelve
    // a este punto del código (la app se recarga en REDIRECT_URI).
    initCodeClient().requestCode();
    return new Promise(() => {});
  }
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

// Nota: esto NO revoca el refresh_token guardado en el Worker (Cloudflare
// KV) — solo limpia el estado local de este dispositivo/navegador, mismo
// criterio que signOut() en ../../auth.js.
export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(EVER_SIGNED_IN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

async function ensureToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) return;
  if (loadSavedToken()) return;
  if (useRefreshFlow()) {
    const ok = await tryRefreshViaWorker();
    if (ok) return;
    throw new Error('No se pudo renovar la sesión.');
  }
  await signIn();
}

// Renueva el token ANTES de que venza, mientras la pestaña sigue abierta —
// ver useAuth.js, que llama a esto cada pocos minutos. Con el Worker esto
// es una llamada HTTPS directa (no depende de cookies de Google, a
// diferencia del `prompt:''` del flujo implícito) — si llega a fallar
// (Worker caído, KV sin el refresh_token) simplemente no hace nada y el
// próximo pedido real lo reintenta por el camino normal de ensureToken().
export async function refreshIfNeeded() {
  if (accessToken && Date.now() < tokenExpiry - 5 * 60 * 1000) return;
  if (useRefreshFlow()) { await tryRefreshViaWorker(); return; }
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
