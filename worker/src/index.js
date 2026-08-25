// ── Worker de sesión: reemplaza al proxy de Apps Script ──────────────────────
// Dos tareas, nada más (mismo criterio que el Worker de referencia descrito en
// ARQUITECTURA.txt sección 4):
//   /oauth/callback  → intercambia un authorization code de Google por tokens,
//                      guarda el refresh_token en KV (nunca llega al navegador)
//                      y devuelve un sessionToken (JWT) para pedir tokens luego.
//   /token           → dado un sessionToken válido, usa el refresh_token
//                      guardado para conseguir un access_token nuevo.
//
// Sin dependencias npm — todo con Web Crypto (mismo criterio que
// "web-push-browser" citado en la sección 13 del documento de referencia: el
// runtime de Workers no tiene el módulo `crypto` de Node).

const GOOGLE_TOKEN_URL    = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const SESSION_TTL_SECONDS = 180 * 24 * 60 * 60; // ~180 días, como Finanzas Hogar

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function corsHeaders(origin, allowedOrigin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
  if (origin && origin === allowedOrigin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

// ── JWT (HMAC-SHA256) ─────────────────────────────────────────────────────────

function base64url(bytesOrStr) {
  const str = typeof bytesOrStr === 'string' ? bytesOrStr : String.fromCharCode(...new Uint8Array(bytesOrStr));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecodeToString(str) {
  str = str.replace(/-/g, '+').replace(/\//g, '_');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

async function signSessionToken(payload, secret) {
  const key    = await importHmacKey(secret);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = base64url(JSON.stringify(payload));
  const data   = `${header}.${body}`;
  const sig    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${base64url(sig)}`;
}

async function verifySessionToken(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  try {
    const key      = await importHmacKey(secret);
    const sigBytes = Uint8Array.from(base64urlDecodeToString(sig), c => c.charCodeAt(0));
    const valid    = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(base64urlDecodeToString(body));
    if (!payload.sub || (payload.exp && Date.now() / 1000 > payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

async function exchangeCodeWithGoogle(code, env) {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      // Google Identity Services con ux_mode:'popup' (auth.js) no usa un
      // redirect real — 'postmessage' es el valor exacto que Google espera acá.
      redirect_uri: 'postmessage',
      grant_type: 'authorization_code'
    })
  });
  return resp.json();
}

async function refreshWithGoogle(refreshToken, env) {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });
  return resp.json();
}

// Identifica al usuario (para la clave de KV). Necesita que el access_token
// tenga scope de identidad (userinfo.email/profile en CONFIG.SCOPES) — sin
// eso este endpoint responde "invalid_request / Invalid Credentials" aunque
// el token sea válido para Sheets/Drive.
async function fetchUserKey(accessToken) {
  try {
    const resp = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) return null;
    const info = await resp.json();
    return info.email || info.sub || null;
  } catch {
    return null;
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleOAuthCallback(url, env) {
  const code = url.searchParams.get('code');
  if (!code) return jsonResponse({ error: 'missing_code' }, 400);

  const tokens = await exchangeCodeWithGoogle(code, env);
  if (tokens.error || !tokens.access_token) {
    return jsonResponse({ error: tokens.error || 'exchange_failed' }, 400);
  }
  if (!tokens.refresh_token) {
    // Pasa si el usuario ya había dado consentimiento antes y Google no
    // reemite refresh_token — auth.js pide prompt:'consent' precisamente
    // para minimizar este caso, pero puede pasar igual.
    return jsonResponse({ error: 'no_refresh_token' }, 400);
  }

  const userKey = await fetchUserKey(tokens.access_token);
  if (!userKey) return jsonResponse({ error: 'no_user_key' }, 400);

  await env.REFRESH_TOKENS.put(userKey, tokens.refresh_token);

  const sessionToken = await signSessionToken(
    { sub: userKey, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS },
    env.JWT_SECRET
  );

  return jsonResponse({ access_token: tokens.access_token, expires_in: tokens.expires_in, sessionToken });
}

async function handleToken(url, env) {
  const sessionToken = url.searchParams.get('session');
  const payload = await verifySessionToken(sessionToken, env.JWT_SECRET);
  if (!payload) return jsonResponse({ error: 'invalid_session' }, 401);

  const refreshToken = await env.REFRESH_TOKENS.get(payload.sub);
  if (!refreshToken) return jsonResponse({ error: 'no_refresh_token' }, 401);

  const tokens = await refreshWithGoogle(refreshToken, env);
  if (tokens.error || !tokens.access_token) {
    return jsonResponse({ error: tokens.error || 'refresh_failed' }, 401);
  }

  return jsonResponse({ access_token: tokens.access_token, expires_in: tokens.expires_in });
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors   = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    let resp;
    if (url.pathname === '/oauth/callback') resp = await handleOAuthCallback(url, env);
    else if (url.pathname === '/token')     resp = await handleToken(url, env);
    else                                     resp = jsonResponse({ error: 'not_found' }, 404);

    Object.entries(cors).forEach(([k, v]) => resp.headers.set(k, v));
    return resp;
  }
};
