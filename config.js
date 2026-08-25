// ── COMPLETA ESTOS DOS DATOS ANTES DE PUBLICAR ─────────────────────────────
// Instrucciones completas en el README o sigue los pasos que te dio Claude.

const CONFIG = {

  // Paso 1: console.cloud.google.com → Credenciales → tu OAuth 2.0 Client ID
  CLIENT_ID: '633677226751-7nutb18pa7sbp2e5n0l01iophh43qf32.apps.googleusercontent.com',

  // Paso 2: ID de tu Google Sheet (está en la URL del sheet, entre /d/ y /edit)
  // URL ejemplo: https://docs.google.com/spreadsheets/d/ESTE_PARTE/edit
  SHEET_ID: '1kAEaWY1B7bpKbLRbW0sZFITTLYpK_amvTfXPde4AbNE',

  // No cambiar esto — email/profile hacen falta para que
  // oauth2.googleapis.com/userinfo identifique al usuario (lo usan el Worker,
  // para la clave de KV, y main.js para el saludo). Sin ellos ese endpoint
  // responde "Invalid Credentials" aunque el access_token sea válido.
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',

  // Paso 3 (opcional, evita que te pida entrar cada ~1 hora): URL del
  // Cloudflare Worker que renueva el token sin depender de cookies del
  // navegador (ver worker/README.md para desplegarlo). Déjalo vacío ('') si
  // todavía no lo configuraste — la app sigue funcionando igual que antes,
  // solo sin este beneficio.
  WORKER_URL: 'https://tateapp-token.byco85.workers.dev'

};
