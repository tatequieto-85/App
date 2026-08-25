// ── Bases de datos: estado de la base activa ─────────────────────────────────
// Separado de bases.js para que auth.js (importado por todos los módulos de
// feature) pueda leer activeSheetId sin depender de bases.js, que a su vez
// importa la función init*Sheet de cada módulo de feature — eso crearía un
// ciclo sistémico que atraviesa toda la app.

export let activeSheetId    = CONFIG.SHEET_ID; // fallback hasta que se conecte una base
export let activeBaseId     = null;
export let activeBaseNombre = null;
export let activeBaseModulos = [];

// Se incrementa cada vez que cambia la base activa. Los módulos que cachean
// datos en memoria para no reconsultar Sheets en cada cambio de pestaña
// (ver switchSubTab en tareas.js) comparan contra esto para invalidar su
// cache al cambiar de base — sin esto, cambiar de base y volver a un módulo
// ya visitado mostraría datos de la base anterior.
export let dbEpoch = 0;

export function setActiveBase(base) {
  activeSheetId     = base.sheetId;
  activeBaseId      = base.id;
  activeBaseNombre  = base.nombre;
  activeBaseModulos = base.modulos;
  dbEpoch++;
}
