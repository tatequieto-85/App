// Portado de ../../utils.js — helpers de formato puros, sin DOM.

// Algunos campos (p. ej. fechaVencimiento de una evaluación, o CreadoEn)
// vienen como timestamp completo ("2026-09-03T05:00:00.000Z"), no como
// "YYYY-MM-DD" — pegarle igual "T00:00:00" al final rompía el parseo. Si el
// string ya trae una "T", se usa tal cual; si no, se le agrega la hora fija
// (mediodía local, sin desfasar de día por huso horario).
export function parseISODate(s) {
  if (!s) return new Date(NaN);
  return new Date(s.includes('T') ? s : s + 'T00:00:00');
}

export function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

export function fmtDateShortEs(iso) {
  if (!iso) return '';
  return parseISODate(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
}

export function fmtDayMonthSlash(iso) {
  if (!iso) return '';
  const d = parseISODate(iso);
  // Si el valor guardado no es un "YYYY-MM-DD" limpio (formato viejo,
  // fecha con hora, etc.), mejor mostrar el dato crudo que "NaN/NaN".
  if (isNaN(d.getTime())) return String(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// DD/MM/AA — usado en Trazabilidad de Stock (fmtDayMonthSlash, sin año, se
// sigue usando en otros lados como el "Última compra" de Insumos).
export function fmtDayMonthYearShort(iso) {
  if (!iso) return '';
  const d = parseISODate(iso);
  if (isNaN(d.getTime())) return String(iso);
  const yy = String(d.getFullYear()).slice(-2);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${yy}`;
}

export function fmtCOP(n) {
  return (n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

// Portado de getDueStatus() en ../../tareas.js — usado por Stock para el
// color del producto testigo según qué tan cerca está su fecha de revisión.
export function getDueStatus(dateStr) {
  if (!dateStr) return '';
  const d     = parseISODate(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff < 0) return 'vencido';
  if (diff === 0) return 'hoy';
  if (diff <= 3) return 'porVencer';
  return 'normal';
}

// Convierte "1.234,5" (formato es-CO que ve el usuario) al número real.
export function parseThousandsInput(value) {
  if (!value) return NaN;
  return parseFloat(String(value).replace(/\./g, '').replace(',', '.'));
}

export function formatThousandsValue(n) {
  if (n === '' || n === null || n === undefined || isNaN(n)) return '';
  return Number(n).toLocaleString('es-CO', { maximumFractionDigits: 6 });
}

// Reformatea en vivo lo que el usuario escribe mientras tipea (separador de
// miles con punto, decimales con coma) — misma lógica que attachThousandsInput.
export function reformatThousandsDraft(raw) {
  let cleaned = raw.replace(/[^\d,]/g, '');
  const firstComma = cleaned.indexOf(',');
  if (firstComma !== -1) cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, '');
  const [intPart, decPart] = cleaned.split(',');
  const intFormatted = intPart ? parseInt(intPart, 10).toLocaleString('es-CO') : '';
  return decPart !== undefined ? `${intFormatted},${decPart}` : intFormatted;
}
