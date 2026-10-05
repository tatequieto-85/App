// "RecetasEjecuciones" (lotes producidos) — portado de
// loadEjecucionesData()/getStockProducido()/appendEjecucion()/
// updateEjecucion() en ../../procesos.js. El CRUD completo (cronómetro por
// etapa, confirmar insumos, evaluación pH/rendimiento/calificación)
// todavía no se migra — ver memoria del piloto. Lo que SÍ existe acá es el
// arranque mínimo de un lote ("Empezar producción" en RecetaDetailModal) y
// sus observaciones, a pedido explícito del usuario.
import { sheetsReq } from './googleAuth';
import { todayISOBogota } from '../utils/format';

let ejecucionesSheetId = null;

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export async function ensureEjecucionesSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasE = tabs.find(s => s.properties.title === 'RecetasEjecuciones');
  if (hasE) {
    ejecucionesSheetId = hasE.properties.sheetId;
  } else {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'RecetasEjecuciones' } } }] })
    });
    const added = res.replies?.[0]?.addSheet?.properties;
    if (added) ejecucionesSheetId = added.sheetId;
  }

  const ed = await sheetsReq('/values/RecetasEjecuciones!A1:M1').catch(() => ({}));
  const row = (ed.values || [])[0] || [];
  if (row.length < 11) {
    await sheetsReq('/values/RecetasEjecuciones!A1:M1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [[
        'ID', 'RecetaID', 'NombreReceta', 'LoteID', 'FechaInicio', 'FechaFin',
        'Estado', 'DuracionTotal', 'EtapasData', 'Evaluacion', 'CreadoEn', 'Observations', 'Insumos'
      ]] })
    });
  } else if (row.length < 12) {
    await sheetsReq('/values/RecetasEjecuciones!L1:M1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['Observations', 'Insumos']] })
    });
  } else if (row.length < 13) {
    await sheetsReq('/values/RecetasEjecuciones!M1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['Insumos']] })
    });
  }
}

export async function fetchEjecuciones() {
  const data = await sheetsReq('/values/RecetasEjecuciones!A:M');
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
    observations:  safeParseJSON(r[11], []),
    insumos:       safeParseJSON(r[12], []),
    rowIndex:      i + 2
  }));
}

function ejecucionRowValues(ej) {
  return [
    ej.id, ej.recetaId, ej.nombreReceta, ej.loteId, ej.fechaInicio, ej.fechaFin || '',
    ej.estado || '', ej.duracionTotal || '', JSON.stringify(ej.etapasData || []),
    JSON.stringify(ej.evaluacion || {}), ej.creadoEn, JSON.stringify(ej.observations || []),
    JSON.stringify(ej.insumos || [])
  ];
}

export async function appendEjecucion(ej) {
  await sheetsReq('/values/RecetasEjecuciones!A:M:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [ejecucionRowValues(ej)] })
  });
}

export async function updateEjecucion(ej) {
  await sheetsReq(`/values/RecetasEjecuciones!A${ej.rowIndex}:M${ej.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [ejecucionRowValues(ej)] })
  });
}

// Portado de generateLotId() en ../../procesos.js — mismo formato que ya
// reconoce la app vanilla (y lee Stock/Ventas): TQ-{3 letras}-{YYYYMMDD}-{HHMM}.
export function generateLoteId(nombreReceta) {
  const now = new Date();
  const abbr = (nombreReceta || 'LOT').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'LOT';
  const date = todayISOBogota().replace(/-/g, '');
  const time = now.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '');
  return `TQ-${abbr}-${date}-${time}`;
}

// Suma de frascos producidos para una receta — la usan tanto Ferias como
// Stock para calcular disponibilidad. `frascos230`/`frascos180` es el
// desglose por tamaño que ya usaba la evaluación completa de la app
// vanilla (todavía sin migrar); `frascosProducidos` es el campo simple
// (sin desglose por tamaño) que se carga desde el cuadro de producción en
// React — se suman los tres para no perder ninguno según de dónde venga
// el dato.
export function getStockProducido(ejecuciones, recetaId) {
  return ejecuciones
    .filter(ej => ej.recetaId === recetaId)
    .reduce((sum, ej) => {
      const ev = ej.evaluacion || {};
      return sum + (ev.frascos230 || 0) + (ev.frascos180 || 0) + (ev.frascosProducidos || 0);
    }, 0);
}
