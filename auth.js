// ── Auth (Google Sign-In + WebAuthn) y helpers de la API de Sheets ───────────
// Módulo "headless": no toca pantallas ni DOM de la app — main.js orquesta
// las transiciones de pantalla llamando a las funciones que expone aquí.

import { activeSheetId } from './db-state.js';

const CRED_KEY    = 'ss_credId';
const USER_KEY    = 'ss_userInfo';
const TOKEN_KEY   = 'ss_token';
const EXPIRY_KEY  = 'ss_tokenExpiry';
const REFRESH_KEY = 'ss_refreshToken';

export let accessToken = null;
export let tokenExpiry = null;
let tokenClient = null; // flujo implícito (fallback si no hay TOKEN_PROXY_URL configurado)
let codeClient  = null; // flujo authorization-code + refresh_token (sesiones largas)

// Con TOKEN_PROXY_URL configurado, la renovación de sesión pasa por el Apps
// Script del usuario (que guarda el Client Secret) en vez de depender de la
// cookie de sesión de Google en el navegador — eso es lo que falla en PWAs
// instaladas en iPhone (Safari aísla esas cookies) y obligaba a reingresar
// cada ~1 hora, que es la vida máxima de un access_token normal de Google.
const useRefreshFlow = () => !!(CONFIG.TOKEN_PROXY_URL && CONFIG.TOKEN_PROXY_URL.trim());

// ── WebAuthn / Biometric ──────────────────────────────────────────────────────

export function webAuthnAvailable() {
  return !!(window.PublicKeyCredential && navigator.credentials?.create);
}

export async function registerBiometric() {
  if (!webAuthnAvailable()) return false;
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge:  crypto.getRandomValues(new Uint8Array(32)),
      rp:         { name: 'Story Scheduler TateQuieto', id: window.location.hostname },
      user:       { id: crypto.getRandomValues(new Uint8Array(16)), name: 'user', displayName: 'TateQuieto' },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
      authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000
    }});
    localStorage.setItem(CRED_KEY, btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
    return true;
  } catch (e) {
    console.log('Biometric registration skipped:', e.message);
    return false;
  }
}

export async function verifyBiometric() {
  const stored = localStorage.getItem(CRED_KEY);
  if (!stored || !webAuthnAvailable()) return false;
  try {
    const credId = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    const result = await navigator.credentials.get({ publicKey: {
      challenge:        crypto.getRandomValues(new Uint8Array(32)),
      rpId:             window.location.hostname,
      userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: credId }],
      timeout:          60000
    }});
    return !!result;
  } catch (e) {
    console.log('Biometric failed:', e.message);
    return false;
  }
}

function saveToken(token, expiresIn) {
  accessToken = token;
  tokenExpiry = Date.now() + expiresIn * 1000;
  localStorage.setItem(TOKEN_KEY,  token);
  localStorage.setItem(EXPIRY_KEY, tokenExpiry.toString());
}

function saveRefreshToken(rt) {
  if (rt) localStorage.setItem(REFRESH_KEY, rt);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

// Pide un access_token nuevo al proxy de Apps Script usando el refresh_token
// guardado. Es una llamada HTTPS directa (sin iframe ni cookies de Google),
// así que funciona igual en una PWA instalada en iPhone que en el navegador.
async function tryRefreshViaProxy() {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const resp = await fetch(`${CONFIG.TOKEN_PROXY_URL}?action=refresh&refresh_token=${encodeURIComponent(rt)}`)
      .then(r => r.json());
    if (resp.error || !resp.access_token) return false;
    saveToken(resp.access_token, resp.expires_in || 3600);
    return true;
  } catch {
    return false;
  }
}

async function exchangeCodeForTokens(code) {
  try {
    const resp = await fetch(`${CONFIG.TOKEN_PROXY_URL}?action=exchange&code=${encodeURIComponent(code)}`)
      .then(r => r.json());
    if (resp.error || !resp.access_token) { console.error('Token exchange error:', resp.error); return false; }
    saveToken(resp.access_token, resp.expires_in || 3600);
    saveRefreshToken(resp.refresh_token);
    return true;
  } catch (e) {
    console.error('Token exchange failed:', e.message);
    return false;
  }
}

export function loadSavedToken() {
  const token  = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0');
  if (token && Date.now() < expiry - 5 * 60 * 1000) {
    accessToken = token;
    tokenExpiry = expiry;
    return true;
  }
  return false;
}

export async function trySilentGoogleAuth() {
  if (useRefreshFlow()) return tryRefreshViaProxy();
  if (!tokenClient) return false;
  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve(false), 8000);
    const saved   = tokenClient.callback;
    tokenClient.callback = resp => {
      clearTimeout(timeout);
      tokenClient.callback = saved;
      if (resp.error || !resp.access_token) { resolve(false); return; }
      saveToken(resp.access_token, resp.expires_in);
      resolve(true);
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

// ── Google Auth ───────────────────────────────────────────────────────────────

// onSuccess: callback tras token válido (guardado, silencioso o interactivo).
// onNeedSignIn: callback cuando no hay sesión utilizable — main.js decide qué pantalla mostrar.
export async function initAuth(onSuccess, onNeedSignIn) {
  if (useRefreshFlow()) {
    codeClient = google.accounts.oauth2.initCodeClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      ux_mode: 'popup',
      access_type: 'offline',
      prompt: 'consent', // fuerza que Google entregue refresh_token también en re-logins
      callback: async (resp) => {
        if (resp.error || !resp.code) return console.error('Auth error:', resp.error);
        const ok = await exchangeCodeForTokens(resp.code);
        if (ok) await onSuccess();
      }
    });
  } else {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: async (resp) => {
        if (resp.error) return console.error('Auth error:', resp.error);
        saveToken(resp.access_token, resp.expires_in);
        await onSuccess();
      }
    });
  }

  if (loadSavedToken()) { await onSuccess(); return; }
  const silentOk = await trySilentGoogleAuth();
  if (silentOk) { await onSuccess(); return; }
  onNeedSignIn();
}

export function requestSignIn() {
  if (codeClient) codeClient.requestCode();
  else tokenClient.requestAccessToken({ prompt: '' });
}

export function signOut(onDone) {
  google.accounts.oauth2.revoke(accessToken, () => {
    accessToken = null;
    localStorage.removeItem(CRED_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    localStorage.removeItem(REFRESH_KEY);
    if (onDone) onDone();
  });
}

export async function ensureToken(force) {
  if (!force && accessToken && Date.now() < tokenExpiry - 60000) return;
  if (!force && loadSavedToken()) return;
  if (useRefreshFlow()) {
    const ok = await tryRefreshViaProxy();
    if (ok) return;
    throw new Error('No se pudo renovar la sesión');
  }
  await new Promise((resolve, reject) => {
    const saved = tokenClient.callback;
    tokenClient.callback = (resp) => {
      tokenClient.callback = saved;
      if (resp.error) { reject(new Error(resp.error)); return; }
      saveToken(resp.access_token, resp.expires_in);
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

// ── Sheets API helpers ────────────────────────────────────────────────────────

const SHEETS_BASE = () => `https://sheets.googleapis.com/v4/spreadsheets/${activeSheetId}`;

// Fuerza la solicitud contra un Sheet específico (usado por el registro de
// bases de datos, que siempre vive en CONFIG.SHEET_ID sin importar cuál
// base esté activa en cada momento).
export function sheetsReqFor(spreadsheetId, path, opts = {}) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  return sheetsReq(`${base}${path}`, opts);
}

export async function sheetsReq(path, opts = {}, retried) {
  await ensureToken(retried);
  const url     = path.startsWith('http') ? path : `${SHEETS_BASE()}${path}`;
  const isGet   = !opts.method || opts.method === 'GET';
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(isGet ? {} : { 'Content-Type': 'application/json' }),
    ...(opts.headers || {})
  };
  const resp = await fetch(url, { ...opts, headers });
  if (resp.status === 401 && !retried) {
    return sheetsReq(path, opts, true);
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets error ${resp.status}`);
  }
  return resp.json();
}

// ── Google Drive ──────────────────────────────────────────────────────────────
// Usado tanto por Contenido (adjuntos de historias) como por Tareas
// (adjuntos de observaciones) — vive aquí junto al resto de infraestructura
// de acceso a las APIs de Google en vez de duplicarse o cruzar imports entre
// esos dos módulos de feature.

export async function uploadToDrive(file, onProgress) {
  await ensureToken();

  const initResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      Authorization:             `Bearer ${accessToken}`,
      'Content-Type':            'application/json',
      'X-Upload-Content-Type':   file.type,
      'X-Upload-Content-Length': String(file.size)
    },
    body: JSON.stringify({ name: file.name, mimeType: file.type })
  });
  if (!initResp.ok) throw new Error('No se pudo iniciar la subida a Drive');
  const uploadUrl = initResp.headers.get('Location');

  const fileData = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(`Drive upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Error de conexión al subir'));
    xhr.send(file);
  });

  await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  });

  return fileData;
}

export function thumbUrl(fileId) {
  if (!fileId) return '';
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;
}

export async function deleteDriveFile(fileId) {
  if (!fileId) return;
  try {
    await ensureToken();
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  } catch (e) {
    console.warn('Drive delete failed:', fileId, e.message);
  }
}

export async function downloadDriveFile(fileId, origName) {
  await ensureToken();
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) throw new Error(`Error ${resp.status} al descargar`);
  const blob = await resp.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = origName || fileId;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
