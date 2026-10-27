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

// Descartar un lote que se dejó "En progreso" sin llegar a "Guardar
// ejecución" — a pedido explícito del usuario ("si decide dejarla no
// registrarla en sheet"): salir de la receta mientras hay una ejecución
// en curso pide confirmación (ver RecetaDetailModal.jsx) y, si se
// confirma, borra la fila entera en vez de dejarla abandonada a medio
// cargar — mismo motivo que los lotes vacíos de prueba que el usuario
// tuvo que limpiar a mano antes de que existiera esto.
export async function deleteEjecucionRow(rowIndex) {
  if (!ejecucionesSheetId) await ensureEjecucionesSheet();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: ejecucionesSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
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

// Desglose de UN lote por medida — la usan tanto Ferias (feriasApi.js) como
// Stock (stockApi.js) para calcular disponibilidad; vive acá (sin depender
// de ninguno de esos dos módulos) justamente para que ambos la puedan
// importar sin crear una dependencia circular (stockApi.js ya importa de
// feriasApi.js). `medidaId` es el id real del catálogo (Medidas) para lotes
// nuevos, o una clave sintética estable ("legacy-230"/"legacy-130"/
// "legacy-180"/"legacy-otros") para lotes viejos sin medida configurada.
// Solo cuenta lotes con `estado === 'Completada'` ("Guardar ejecución") —
// bug real reportado por el usuario: "en la ejecución si aún no pongo
// terminado me suma como si fuera terminado". Mientras el lote sigue en
// curso, "Empezar producción" ya guarda las cantidades ingresadas en
// evaluacion.produccionPorMedida/frascos230 en cada cambio (para no perder
// lo escrito si se cierra la app a mitad de carga), pero eso NO significa
// que el lote ya esté listo — ni Stock ni Ventas deben sumarlo hasta que
// se confirme con "Guardar ejecución".
export function getProduccionPorMedidaLote(ejecucion) {
  if (ejecucion.estado !== 'Completada') return [];
  const ev = ejecucion.evaluacion || {};
  if (ev.produccionPorMedida?.length) {
    return ev.produccionPorMedida
      .filter(p => p.cantidad > 0)
      .map(p => ({ medidaId: p.medidaId, nombre: p.nombre || 'Medida', pesoMl: p.pesoMl || 0, cantidad: p.cantidad }));
  }
  const items = [];
  if (ev.frascos230) items.push({ medidaId: 'legacy-230', nombre: '230 ml', pesoMl: 230, cantidad: ev.frascos230 });
  if (ev.frascos130) items.push({ medidaId: 'legacy-130', nombre: '130 ml', pesoMl: 130, cantidad: ev.frascos130 });
  if (ev.frascos180) items.push({ medidaId: 'legacy-180', nombre: '180 ml', pesoMl: 180, cantidad: ev.frascos180 });
  if (ev.frascosProducidos) items.push({ medidaId: 'legacy-otros', nombre: 'Otros', pesoMl: 0, cantidad: ev.frascosProducidos });
  return items;
}

// Suma de frascos producidos para una receta — la usan tanto Ferias como
// Stock para calcular disponibilidad.
export function getStockProducido(ejecuciones, recetaId) {
  return ejecuciones
    .filter(ej => ej.recetaId === recetaId)
    .reduce((sum, ej) => sum + getProduccionPorMedidaLote(ej).reduce((s, i) => s + i.cantidad, 0), 0);
}
