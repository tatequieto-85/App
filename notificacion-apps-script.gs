/**
 * TateQuieto — Notificaciones WhatsApp automáticas
 *
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Abre tu Google Sheet: https://docs.google.com/spreadsheets/d/1kAEaWY1B7bpKbLRbW0sZFITTLYpK_amvTfXPde4AbNE/edit
 * 2. Menú superior → Extensiones → Apps Script
 * 3. Borra todo el contenido que aparezca y pega este archivo completo
 * 4. Haz clic en 💾 Guardar (Ctrl+S)
 * 5. Luego instala los triggers con el menú: Ejecutar → configurarTriggers
 *    (te pedirá permiso la primera vez — acéptalo)
 * 6. ¡Listo! Recibirás WhatsApp a las 9 AM y 4 PM todos los días,
 *    sin importar si la app está abierta o no.
 */

const SHEET_ID  = '1kAEaWY1B7bpKbLRbW0sZFITTLYpK_amvTfXPde4AbNE';
const TIME_ZONE = 'America/Bogota';

// ── Función principal ──────────────────────────────────────────────────────────

function sendWhatsAppReminder(hour) {
  // 1. Leer configuración (teléfono y API key) desde la hoja Config
  const ss          = SpreadsheetApp.openById(SHEET_ID);
  const configSheet = ss.getSheetByName('Config');
  if (!configSheet) return;

  // getValues() devuelve el número crudo; lo convertimos sin formateo de miles
  const configRows = configSheet.getDataRange().getValues();
  const config = {};
  configRows.forEach(row => {
    if (!row[0]) return;
    let val = row[1];
    if (typeof val === 'number') {
      val = Math.round(val).toString(); // evita comas y decimales
    } else {
      val = String(val || '').trim();
    }
    config[String(row[0]).trim()] = val;
  });

  Logger.log(`phone="${config.phone}" apikey="${config.apikey}"`);

  if (!config.phone || !config.apikey) {
    Logger.log('Faltan phone o apikey en la hoja Config');
    return;
  }

  // 2. Evitar envío duplicado en el mismo día y hora
  const today   = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  const sentKey = `notif_${today}_${hour}`;
  const props   = PropertiesService.getScriptProperties();
  if (props.getProperty(sentKey)) {
    Logger.log(`Ya se envió la notificación de las ${hour}:00 hoy (${today})`);
    return;
  }

  // 3. Leer historias programadas para hoy
  const storiesSheet = ss.getSheetByName('Stories');
  let todayStories = [];
  if (storiesSheet) {
    const rows = storiesSheet.getDataRange().getValues().slice(1);
    todayStories = rows.filter(r => {
      if (!r[0] || r[8] === 'TRUE' || !r[3]) return false;
      try {
        const schedDate = Utilities.formatDate(new Date(r[3]), TIME_ZONE, 'yyyy-MM-dd');
        return schedDate === today;
      } catch(e) { return false; }
    }).map(r => ({ title: String(r[1] || '') }));
  }

  // 4. Leer tareas con fecha límite hoy (no terminales)
  const TERMINAL = ['Realizado', 'Cancelado', 'Postpuesto'];
  const tasksSheet = ss.getSheetByName('KanbanTasks');
  let todayTasks = [];
  if (tasksSheet) {
    const rows = tasksSheet.getDataRange().getValues().slice(1);
    todayTasks = rows.filter(r => {
      if (!r[0] || !r[2] || !r[4]) return false;              // ID, Título, Fecha
      if (TERMINAL.indexOf(String(r[5])) !== -1) return false; // omitir terminales
      try {
        return Utilities.formatDate(new Date(r[4] + 'T00:00:00'), TIME_ZONE, 'yyyy-MM-dd') === today;
      } catch(e) { return false; }
    }).map(r => ({ title: String(r[2] || ''), area: String(r[1] || ''), status: String(r[5] || '') }));
  }

  // 5. Construir mensaje
  const emoji  = hour === 9 ? '🌅' : '🌆';
  const saludo = hour === 9 ? 'Buenos días' : 'Buenas tardes';
  let msg = `${emoji} *TateQuieto* — ${saludo}!\n`;

  if (todayStories.length > 0) {
    const n = todayStories.length;
    msg += `\n📣 *Historias para hoy (${n}):*\n`;
    todayStories.forEach(s => { msg += `• ${s.title}\n`; });
  } else {
    msg += '\n📣 *Historias:* ninguna para hoy.\n';
  }

  if (todayTasks.length > 0) {
    const n = todayTasks.length;
    msg += `\n📋 *Tareas con vencimiento hoy (${n}):*\n`;
    todayTasks.forEach(t => { msg += `• ${t.title}${t.area ? ' (' + t.area + ')' : ''}\n`; });
  } else {
    msg += '\n📋 *Tareas:* ninguna vence hoy.\n';
  }

  // 5. Enviar por WhatsApp via CallMeBot
  const url = 'https://api.callmebot.com/whatsapp.php'
    + '?phone='  + config.phone
    + '&text='   + encodeURIComponent(msg)
    + '&apikey=' + config.apikey;

  Logger.log('URL: ' + url);

  try {
    const resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
    Logger.log(`CallMeBot respuesta (${resp.getResponseCode()}): ${resp.getContentText().substring(0, 200)}`);
  } catch(e) {
    Logger.log('Error al llamar CallMeBot: ' + e.message);
    return; // No marcar como enviado si falló la llamada
  }

  // 6. Marcar como enviado
  props.setProperty(sentKey, '1');

  // 7. Limpiar claves viejas (más de 3 días) para no acumular
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 3);
  const cutoffStr = Utilities.formatDate(cutoff, TIME_ZONE, 'yyyy-MM-dd');
  props.getKeys().forEach(key => {
    if (key.startsWith('notif_')) {
      const keyDate = key.split('_')[1];
      if (keyDate && keyDate < cutoffStr) props.deleteProperty(key);
    }
  });

  Logger.log(`✅ WhatsApp enviado a las ${hour}:00 — ${todayStories.length} historia(s) hoy`);
}

// Estas dos son las que los triggers llaman:
function sendMorningReminder()   { sendWhatsAppReminder(9);  }
function sendAfternoonReminder() { sendWhatsAppReminder(16); }

// ── Proxy de tokens OAuth (sesiones largas sin repetir el login) ────────────
// Intercambia el "code" de Google por tokens y renueva el access_token con
// el refresh_token, sin exponer nunca el Client Secret al navegador.
//
// INSTALACIÓN (una sola vez):
// 1. Google Cloud Console → APIs y servicios → Credenciales → abre el
//    OAuth Client ID de la app → copia "Client secret".
// 2. En este proyecto de Apps Script: ⚙️ Configuración del proyecto →
//    Propiedades del script → Agregar propiedad → nombre CLIENT_SECRET,
//    valor el secreto que copiaste.
// 3. Implementar → Nueva implementación → tipo "Aplicación web" →
//    Ejecutar como: Yo → Quién tiene acceso: Cualquier usuario → Implementar.
// 4. Copia la URL que te da y pégala en config.js como TOKEN_PROXY_URL.

const OAUTH_CLIENT_ID = '633677226751-t83hr59m0itju3j44s7l357r5l4tgsm7.apps.googleusercontent.com';

function doGet(e) {
  const action = e.parameter.action;
  const secret = PropertiesService.getScriptProperties().getProperty('CLIENT_SECRET');
  if (!secret) return jsonOut({ error: 'CLIENT_SECRET no configurado en Propiedades del script' });

  try {
    if (action === 'exchange') return jsonOut(exchangeCode(e.parameter.code, secret));
    if (action === 'refresh')  return jsonOut(refreshAccessToken(e.parameter.refresh_token, secret));
    return jsonOut({ error: 'acción desconocida' });
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

function exchangeCode(code, secret) {
  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      code: code,
      client_id: OAUTH_CLIENT_ID,
      client_secret: secret,
      redirect_uri: 'postmessage', // requerido por el flujo popup de Google Identity Services
      grant_type: 'authorization_code'
    },
    muteHttpExceptions: true
  });
  return JSON.parse(resp.getContentText());
}

function refreshAccessToken(refreshToken, secret) {
  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      refresh_token: refreshToken,
      client_id: OAUTH_CLIENT_ID,
      client_secret: secret,
      grant_type: 'refresh_token'
    },
    muteHttpExceptions: true
  });
  return JSON.parse(resp.getContentText());
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ── Configurar los triggers automáticos ───────────────────────────────────────
// Ejecuta esta función UNA SOLA VEZ desde el menú Ejecutar → configurarTriggers

function configurarTriggers() {
  // Borrar triggers anteriores para evitar duplicados
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Trigger de las 9 AM (hora Colombia)
  ScriptApp.newTrigger('sendMorningReminder')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .inTimezone(TIME_ZONE)
    .create();

  // Trigger de las 4 PM (hora Colombia)
  ScriptApp.newTrigger('sendAfternoonReminder')
    .timeBased()
    .atHour(16)
    .everyDays(1)
    .inTimezone(TIME_ZONE)
    .create();

  Logger.log('✅ Triggers configurados: 9:00 AM y 4:00 PM hora Colombia todos los días');
  Logger.log('Desde ahora recibirás WhatsApp aunque la app esté cerrada.');
}

// ── Función de prueba manual ───────────────────────────────────────────────────
// Ejecuta esta para verificar que el envío funciona antes de instalar los triggers

function probarEnvioAhora() {
  const hour = parseInt(Utilities.formatDate(new Date(), TIME_ZONE, 'HH'));

  // Forzar envío aunque ya se haya enviado hoy (borrar la marca)
  const today   = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  const sentKey = `notif_${today}_${hour}`;
  PropertiesService.getScriptProperties().deleteProperty(sentKey);

  sendWhatsAppReminder(hour);
  Logger.log('Mensaje de prueba enviado. Revisa WhatsApp en unos segundos.');
}
