// Lectura de "RecetasEjecuciones" (lotes producidos) — igual que
// recetasApi.js, solo lectura hasta que se migre Procesos. Portado de
// loadEjecucionesData()/getStockProducido() en ../../procesos.js.
import { sheetsReq } from './googleAuth';

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export async function fetchEjecuciones() {
  const data = await sheetsReq('/values/RecetasEjecuciones!A:K');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:            r[0]  || '',
    recetaId:      r[1]  || '',
    nombreReceta:  r[2]  || '',
    loteId:        r[3]  || '',
    fechaInicio:   r[4]  || '',
    fechaFin:      r[5]  || '',
    estado:        r[6]  || '',
    duracionTotal: r[7]  || '',
    etapasData:    safeParseJSON(r[8], []),
    evaluacion:    safeParseJSON(r[9], {}),
    creadoEn:      r[10] || '',
    rowIndex:      i + 2
  }));
}

// Suma de frascos producidos para una receta — la usan tanto Ferias como
// Stock para calcular disponibilidad.
export function getStockProducido(ejecuciones, recetaId) {
  return ejecuciones
    .filter(ej => ej.recetaId === recetaId)
    .reduce((sum, ej) => {
      const ev = ej.evaluacion || {};
      return sum + (ev.frascos230 || 0) + (ev.frascos180 || 0);
    }, 0);
}
