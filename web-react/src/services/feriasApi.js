// Lectura de "Ferias" — igual que recetasApi.js/ejecucionesApi.js, solo lo
// que Stock necesita (cuánto se comprometió/vendió de cada lote) hasta que
// se migre el módulo Ventas/Ferias completo. Portado de loadFerias() y los
// getStock*Lote() en ../../ferias.js.
import { sheetsReq } from './googleAuth';

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export async function fetchFerias() {
  const data = await sheetsReq('/values/Ferias!A:X');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:         r[0]  || '',
    planStock:  safeParseJSON(r[14], {}),
    ventas:     safeParseJSON(r[15], []),
    rowIndex:   i + 2
  }));
}

export function getStockComprometidoLote(ferias, ejecucionId) {
  return ferias.reduce((sum, f) => sum + ((f.planStock || {})[ejecucionId] || 0), 0);
}

export function getStockVendidoLote(ferias, ejecucionId) {
  return ferias.reduce((sum, f) =>
    sum + (f.ventas || []).filter(v => v.ejecucionId === ejecucionId).reduce((s, v) => s + v.cantidad, 0)
  , 0);
}
