// ── Iconos SVG reutilizables (line-icons, sin emojis) ────────────────────────
export const ICON_FILM     = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>';
export const ICON_IMAGE    = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
export const ICON_FOLDER   = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
export const ICON_DOWNLOAD = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
export const ICON_CHECK    = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 9.01"/></svg>';
export const ICON_CALENDAR = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
export const ICON_TRASH    = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
export const ICON_EDIT     = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>';
export const ICON_SPINNER  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="icon-spin"><path d="M21 12a9 9 0 11-9-9"/></svg>';
export const ICON_COPY     = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';

// ── Utils ─────────────────────────────────────────────────────────────────────

export function setFb(el, msg, type) {
  el.textContent = msg; el.className = `feedback ${type}`;
  if (type === 'ok') setTimeout(() => { el.textContent = ''; el.className = 'feedback'; }, 4500);
}

// ── Validación de campo en tiempo real (mensaje junto al campo, no solo al enviar) ──
export function setFieldError(fieldId, msg, visibleFieldId) {
  const input = document.getElementById(visibleFieldId || fieldId);
  const err = document.getElementById(fieldId + 'Err');
  if (input) input.classList.toggle('field-input--invalid', !!msg);
  if (err) err.textContent = msg || '';
}
export function clearFieldErrors(...fieldIds) {
  fieldIds.forEach(id => setFieldError(id, ''));
}
export function liveValidate(fieldId, validatorFn) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const run = () => setFieldError(fieldId, validatorFn(input.value) || '');
  input.addEventListener('blur', run);
  input.addEventListener('input', () => { if (input.classList.contains('field-input--invalid')) run(); });
}

export function confirmCloseIfDirty(overlayId, isDirtyFn) {
  if (isDirtyFn() && !confirm('¿Salir sin guardar? Se perderán los cambios.')) return;
  document.getElementById(overlayId).classList.remove('open');
}

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

export function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function normalizeObsList(obs) {
  if (!obs) return [];
  if (Array.isArray(obs)) return obs.map(o => typeof o === 'string' ? { text: o } : o).filter(o => o && o.text);
  if (typeof obs === 'string') return obs.trim() ? [{ text: obs.trim() }] : [];
  return [];
}

export function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export function fmtSeconds(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function parseISODate(s) { return new Date(s + 'T00:00:00'); }
export function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
export function diffDays(a, b) { return Math.round((b - a) / 86400000); }

export function fmtDuration(ms) {
  if (!ms || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function fmtDateShortEs(iso) {
  if (!iso) return '';
  return parseISODate(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
}

export function fmtCOP(n) {
  return (n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}
