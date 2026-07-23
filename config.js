// ── COMPLETA ESTOS DOS DATOS ANTES DE PUBLICAR ─────────────────────────────
// Instrucciones completas en el README o sigue los pasos que te dio Claude.

const CONFIG = {

  // Paso 1: console.cloud.google.com → Credenciales → tu OAuth 2.0 Client ID
  CLIENT_ID: '633677226751-t83hr59m0itju3j44s7l357r5l4tgsm7.apps.googleusercontent.com',

  // Paso 2: ID de tu Google Sheet (está en la URL del sheet, entre /d/ y /edit)
  // URL ejemplo: https://docs.google.com/spreadsheets/d/ESTE_PARTE/edit
  SHEET_ID: '1kAEaWY1B7bpKbLRbW0sZFITTLYpK_amvTfXPde4AbNE',

  // No cambiar esto
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',

  // Paso 3 (opcional, evita que te pida entrar cada ~1 hora): URL del Web App
  // de Apps Script que renueva el token sin depender de cookies del navegador.
  // Déjalo vacío ('') si todavía no lo configuraste — la app sigue funcionando
  // igual que antes, solo sin este beneficio.
  TOKEN_PROXY_URL: ''

};
