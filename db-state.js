// ── Bases de datos: estado de la base activa ─────────────────────────────────
// Separado de bases.js para que auth.js (importado por todos los módulos de
// feature) pueda leer activeSheetId sin depender de bases.js, que a su vez
// importa la función init*Sheet de cada módulo de feature — eso crearía un
// ciclo sistémico que atraviesa toda la app.

export let activeSheetId    = CONFIG.SHEET_ID; // fallback hasta que se conecte una base
export let activeBaseId     = null;
export let activeBaseNombre = null;
export let activeBaseModulos = [];

export function setActiveBase(base) {
  activeSheetId     = base.sheetId;
  activeBaseId      = base.id;
  activeBaseNombre  = base.nombre;
  activeBaseModulos = base.modulos;
}
