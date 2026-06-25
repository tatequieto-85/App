// ═══════════════════════════════════════════════════════════════════════════
//  Story Scheduler — Google Apps Script
//  Pega este código en: tu Google Sheet → Extensiones → Apps Script
//  Luego crea un trigger de tiempo cada 1 minuto (ver instrucciones abajo).
// ═══════════════════════════════════════════════════════════════════════════

// Cambia este valor por el ID de tu Google Sheet
// (está en la URL del Sheet, entre /d/ y /edit)
const SPREADSHEET_ID = '1kAEaWY1B7bpKbLRbW0sZFITTLYpK_amvTfXPde4AbNE';

// ── Función principal (la que se ejecuta cada minuto) ──────────────────────

function checkAndSendReminders() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Leer configuración (pestaña Config)
  let phone  = '';
  let apikey = '';
  try {
    const configSheet = ss.getSheetByName('Config');
    if (configSheet) {
      configSheet.getDataRange().getValues().forEach(r => {
        if (r[0] === 'phone')  phone  = String(r[1] || '');
        if (r[0] === 'apikey') apikey = String(r[1] || '');
      });
    }
  } catch (e) {
    console.error('Error leyendo Config:', e.message);
  }

  if (!apikey) {
    console.log('Sin API key de CallMeBot. Configura en la app → ⚙️');
    return;
  }
  if (!phone) {
    console.log('Sin número de WhatsApp configurado.');
    return;
  }

  // Leer historias (pestaña Stories)
  const storiesSheet = ss.getSheetByName('Stories');
  if (!storiesSheet) return;

  const rows = storiesSheet.getDataRange().getValues();
  const now  = new Date();

  // Columnas (0-indexed): ID=0, Title=1, Actions=2, ScheduledAt=3,
  //   DriveFileId=4, OrigName=5, MimeType=6, ThumbUrl=7, Sent=8, SentAt=9

  for (let i = 1; i < rows.length; i++) {          // saltar fila de cabeceras
    const row         = rows[i];
    const id          = row[0];
    const title       = String(row[1] || '').trim();
    const actions     = String(row[2] || '').trim();
    const driveFileId = String(row[4] || '').trim();
    const sent        = row[8];

    if (!id || sent === 'TRUE' || sent === true) continue;

    let scheduledAt;
    try { scheduledAt = new Date(row[3]); }
    catch { continue; }
    if (isNaN(scheduledAt) || scheduledAt > now) continue;

    // Formatear fecha en español Colombia
    const fechaHora = Utilities.formatDate(
      scheduledAt,
      'America/Bogota',
      "EEEE d 'de' MMMM 'a las' hh:mm a"
    );

    let msg = `📱 *Historia lista para publicar!*\n\n📋 *${title}*\n⏰ ${fechaHora}`;
    if (actions) msg += `\n\n✅ *Acciones en Instagram:*\n${actions}`;
    if (driveFileId) msg += `\n\n📂 Ver archivo:\nhttps://drive.google.com/file/d/${driveFileId}/view`;
    msg += '\n\n_Abre Instagram y publica tu historia_ 🚀';

    try {
      const url = 'https://api.callmebot.com/whatsapp.php'
        + '?phone=' + encodeURIComponent(phone)
        + '&text='  + encodeURIComponent(msg)
        + '&apikey=' + encodeURIComponent(apikey);

      const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      console.log(`WhatsApp enviado para "${title}" → ${resp.getResponseCode()}`);

      // Marcar como enviada en el sheet
      storiesSheet.getRange(i + 1, 9).setValue('TRUE');
      storiesSheet.getRange(i + 1, 10).setValue(new Date().toISOString());

    } catch (e) {
      console.error(`Error enviando WhatsApp para "${title}": ${e.message}`);
    }
  }
}

// ── Cómo crear el trigger de 1 minuto ─────────────────────────────────────
//
//  1. En Apps Script, menú izquierdo → ícono de reloj (Triggers / Activadores)
//  2. Clic en "Añadir activador" (botón azul, abajo a la derecha)
//  3. Configura:
//       · Función a ejecutar: checkAndSendReminders
//       · Tipo de evento: basado en tiempo
//       · Tipo de tiempo: temporizador por minutos
//       · Intervalo: cada minuto
//  4. Guardar → autoriza los permisos cuando se pida
//
//  Desde ese momento Google ejecuta checkAndSendReminders() cada minuto,
//  aunque tu PC esté apagada.
//
// ── Función de prueba manual ───────────────────────────────────────────────

function testManual() {
  checkAndSendReminders();
}
