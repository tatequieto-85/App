// Lectura de "RecetasPlantillas" — Procesos todavía no está migrado a React,
// pero Stock necesita saber qué recetas existen (mismo Sheet real que ya usa
// la app vanilla). Solo lectura: portado de loadRecetasData() en
// ../../procesos.js, sin ningún CRUD (eso lo trae la migración de Procesos).
import { sheetsReq } from './googleAuth';

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export async function fetchRecetas() {
  const data = await sheetsReq('/values/RecetasPlantillas!A:H');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:                   r[0] || '',
    nombre:               r[1] || '',
    descripcion:          r[2] || '',
    etapas:               safeParseJSON(r[3], []),
    creadoEn:             r[4] || '',
    ingredientesMaestros: safeParseJSON(r[5], []),
    blockId:              r[6] || '',
    nivelPicante:         r[7] || '',
    rowIndex:             i + 2
  }));
}
