// ── Worker de sesión: reemplaza al proxy de Apps Script ──────────────────────
// Tres tareas (mismo criterio que el Worker de referencia descrito en
// ARQUITECTURA.txt sección 4):
//   /oauth/callback  → intercambia un authorization code de Google por tokens,
//                      guarda el refresh_token en KV (nunca llega al navegador)
//                      y devuelve un sessionToken (JWT) para pedir tokens luego.
//   /token           → dado un sessionToken válido, usa el refresh_token
//                      guardado para conseguir un access_token nuevo.
//   /calendar.ics    → feed de calendario (RFC 5545) con las tareas que
//                      tienen fecha, para suscribirse desde Google Calendar
//                      ("Agregar por URL"). Ver handleCalendar más abajo.
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
      // Debe ser byte a byte el mismo redirect_uri que mandó el frontend al
      // pedir el code (ux_mode:'redirect' en auth.js) — Google lo exige.
      redirect_uri: env.REDIRECT_URI,
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

// ── Calendario (ICS) ──────────────────────────────────────────────────────────
// Google Calendar (y cualquier app de calendario) piden esta URL solos, en
// segundo plano, sin que el usuario esté ahí para loguearse — por eso el
// sessionToken viaja en la URL en vez de pedirse interactivo como en /token.
// Es el mismo secreto que ya usa /token para renovar el access_token, así que
// esta URL da el mismo nivel de acceso: hay que tratarla como una contraseña
// (no compartirla) — se lo avisa el frontend al mostrar el link.

function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function icsDate(iso) {
  return (iso || '').replace(/-/g, '');
}

// Fecha+hora completa en formato ICS (YYYYMMDDTHHMMSSZ) — a diferencia de
// icsDate() (solo el día, para eventos de día completo como las tareas),
// esto es para eventos con horario exacto (historias: ScheduledAt ya viene
// como datetime ISO completo). También sirve para DTSTAMP.
function icsDateTime(iso) {
  return (iso || '').replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function addDaysToISO(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMinutesToISO(iso, minutes) {
  const d = new Date(iso);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString();
}

// Duplica DEFAULT_COLUMNS de tareas.js (el Worker no puede importar del
// frontend) — si el usuario personaliza los nombres de columna terminal en
// Gestionar tablero, esto queda desactualizado; solo afecta el ✓ cosmético
// del título, no si la tarea aparece o no en el calendario.
const TERMINAL_STATES = ['Realizado', 'Cancelado', 'Postpuesto'];

// Arma solo los VEVENT (sin envoltorio VCALENDAR) — handleCalendar combina
// esto con storiesToEvents() en un único feed.
function tasksToEvents(rows) {
  const now = icsDateTime(new Date().toISOString());
  const lines = [];
  rows.slice(1).forEach(r => {
    const id = r[0];
    if (!id) return;
    const title    = r[2] || '(sin título)';
    const desc     = r[3] || '';
    const dueDate  = r[4] || '';
    const status   = r[5] || '';
    const area     = r[1] || '';
    const startDate = r[11] || '';
    if (!dueDate) return; // sin fecha no hay nada que poner en el calendario

    const dtStart = startDate && startDate < dueDate ? startDate : dueDate;
    const dtEnd    = addDaysToISO(dueDate, 1); // DTEND es exclusivo en eventos de día completo
    const summary  = TERMINAL_STATES.includes(status) ? `✓ ${title}` : title;
    const descLines = [`Área: ${area || '—'}`, `Estado: ${status || '—'}`];
    if (desc) descLines.push('', desc);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${id}@tateapp`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${icsDate(dtStart)}`,
      `DTEND;VALUE=DATE:${icsDate(dtEnd)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(descLines.join('\n'))}`
    );
    lines.push('END:VEVENT');
  });
  return lines;
}

// Historias de Instagram (Contenido) — a diferencia de las tareas, tienen
// hora exacta de publicación (ScheduledAt es un datetime ISO completo), así
// que el evento cae a esa hora en vez de ser de día completo. UID lleva un
// sufijo "-story" para no colisionar con el UID de una tarea.
function storiesToEvents(rows) {
  const now = icsDateTime(new Date().toISOString());
  const lines = [];
  rows.slice(1).forEach(r => {
    const id          = r[0];
    const scheduledAt = r[3] || '';
    if (!id || !scheduledAt) return;

    const title  = r[1] || '(sin título)';
    const actions = r[2] || '';
    const dtStart = icsDateTime(scheduledAt);
    const dtEnd   = icsDateTime(addMinutesToISO(scheduledAt, 30));

    lines.push(
      'BEGIN:VEVENT',
      `UID:${id}-story@tateapp`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${icsEscape('📸 ' + title)}`,
      `DESCRIPTION:${icsEscape(actions)}`
    );
    lines.push('END:VEVENT');
  });
  return lines;
}

function buildICS(eventLines) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TATEAPP//Tareas//ES',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:TATEAPP — Tareas', 'X-PUBLISHED-TTL:PT1H',
    ...eventLines,
    'END:VCALENDAR'
  ];
  // RFC 5545 pide plegar líneas largas por octeto, pero eso puede cortar un
  // carácter UTF-8 (tildes, ñ, emoji) a la mitad; Google Calendar acepta
  // líneas largas sin plegar sin problema, así que se deja así.
  return lines.join('\r\n');
}

async function handleCalendar(url, env) {
  const sessionToken = url.searchParams.get('session');
  const sheetId       = url.searchParams.get('sheet');
  if (!sheetId) return new Response('missing_sheet', { status: 400 });

  const payload = await verifySessionToken(sessionToken, env.JWT_SECRET);
  if (!payload) return new Response('invalid_session', { status: 401 });

  const refreshToken = await env.REFRESH_TOKENS.get(payload.sub);
  if (!refreshToken) return new Response('no_refresh_token', { status: 401 });

  const tokens = await refreshWithGoogle(refreshToken, env);
  if (tokens.error || !tokens.access_token) return new Response('refresh_failed', { status: 401 });

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values`;
  const authHeaders = { Authorization: `Bearer ${tokens.access_token}` };

  const tasksResp = await fetch(`${base}/KanbanTasks!A:P`, { headers: authHeaders });
  if (!tasksResp.ok) return new Response('sheets_error', { status: 502 });
  const tasksData = await tasksResp.json();

  // Stories es opcional: si la pestaña todavía no existe en una base vieja
  // (no debería pasar, pero por las dudas) el feed sigue funcionando solo
  // con tareas en vez de romperse entero.
  let storiesRows = [];
  const storiesResp = await fetch(`${base}/Stories!A:K`, { headers: authHeaders });
  if (storiesResp.ok) {
    const storiesData = await storiesResp.json();
    storiesRows = storiesData.values || [];
  }

  const eventLines = [
    ...tasksToEvents(tasksData.values || []),
    ...storiesToEvents(storiesRows)
  ];

  return new Response(buildICS(eventLines), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="tateapp-tareas.ics"',
      'Cache-Control': 'public, max-age=1800'
    }
  });
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors   = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    let resp;
    if (url.pathname === '/oauth/callback')    resp = await handleOAuthCallback(url, env);
    else if (url.pathname === '/token')        resp = await handleToken(url, env);
    else if (url.pathname === '/calendar.ics') resp = await handleCalendar(url, env);
    else                                        resp = jsonResponse({ error: 'not_found' }, 404);

    Object.entries(cors).forEach(([k, v]) => resp.headers.set(k, v));
    return resp;
  }
};
