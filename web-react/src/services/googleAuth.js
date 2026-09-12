// Portado de ../../auth.js — mismo backend (Google Sheets vía OAuth), mismo
// contrato de sheetsReq(). Simplificado al flujo implícito (popup) en vez del
// redirect+Cloudflare Worker de la app vanilla, para no requerir una redirect
// URI de localhost en Google Cloud Console durante el piloto — ver ../../.env.
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID;
const SHEET_ID  = import.meta.env.VITE_SHEET_ID;
const SCOPES    = import.meta.env.VITE_SCOPES;

const TOKEN_KEY  = 'ss_react_token';
const EXPIRY_KEY = 'ss_react_tokenExpiry';

let accessToken = null;
let tokenExpiry  = null;
let tokenClient  = null;

function saveToken(token, expiresIn) {
  accessToken = token;
  tokenExpiry = Date.now() + expiresIn * 1000;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, String(tokenExpiry));
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

export function signIn() {
  return new Promise((resolve, reject) => {
    const client = initTokenClient();
    client.callback = resp => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      saveToken(resp.access_token, resp.expires_in);
      resolve();
    };
    client.requestAccessToken({ prompt: loadSavedToken() ? '' : 'consent' });
  });
}

export function signOut() {
  if (accessToken) window.google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}

async function ensureToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) return;
  if (loadSavedToken()) return;
  await signIn();
}

const SHEETS_BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

export async function sheetsReq(path, opts = {}, retried) {
  await ensureToken();
  const url     = path.startsWith('http') ? path : `${SHEETS_BASE}${path}`;
  const isGet   = !opts.method || opts.method === 'GET';
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(isGet ? {} : { 'Content-Type': 'application/json' }),
    ...(opts.headers || {})
  };
  const resp = await fetch(url, { ...opts, headers });
  if (resp.status === 401 && !retried) {
    accessToken = null;
    return sheetsReq(path, opts, true);
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets error ${resp.status}`);
  }
  return resp.json();
}
