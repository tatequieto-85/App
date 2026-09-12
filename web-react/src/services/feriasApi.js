// Portado de ../../ferias.js — hoja "Ferias" (canales de venta en
// canalesVentaApi.js). Antes este archivo solo tenía lectura mínima para
// Stock (fetchFerias/getStock*Lote básicos); ahora tiene el CRUD completo
// para el módulo Ventas — los dos usos conviven porque Stock solo lee
// `planStock`/`ventas`/`id`, campos que siguen ahí igual que antes.
import { sheetsReq } from './googleAuth';
import { parseISODate, toISODate, addDays } from '../utils/format';

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

let feriasSheetId = null;

// Nota: las columnas A–L mantienen el orden original del módulo vanilla
// (antes de agregar horario/stock/ventas) para no desalinear filas ya
// guardadas — los campos nuevos siempre se agregan al final.
export async function ensureFeriasSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasF = tabs.find(s => s.properties.title === 'Ferias');

  if (hasF) {
    feriasSheetId = hasF.properties.sheetId;
    const headerData = await sheetsReq('/values/Ferias!A1:X1').catch(() => ({}));
    const headerRow = (headerData.values || [])[0] || [];
    if (headerRow.length < 18) {
      await sheetsReq('/values/Ferias!M1:R1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [[
          'HoraInicio', 'HoraFin', 'PlanStock', 'Ventas', 'ObservacionesDiarias', 'ConteoProductos'
        ]] })
      });
    }
    if (headerRow.length < 21) {
      await sheetsReq('/values/Ferias!S1:U1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [['ConteoMenores30', 'ConteoEntre30y55', 'ConteoMayores55']] })
      });
    }
    if (headerRow.length < 22) {
      await sheetsReq('/values/Ferias!V1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [['Cerrada']] })
      });
    }
    if (headerRow.length < 23) {
      await sheetsReq('/values/Ferias!W1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [['Muestras']] })
      });
    }
    if (headerRow.length < 24) {
      await sheetsReq('/values/Ferias!X1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [['CanalId']] })
      });
    }
  } else {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Ferias' } } }] })
    });
    const added = res.replies?.[0]?.addSheet?.properties;
    if (added) feriasSheetId = added.sheetId;
    await sheetsReq('/values/Ferias!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [[
        'ID', 'Empresa', 'FechaInicio', 'FechaFin', 'Precio', 'FechaImportante', 'Lugar',
        'Observaciones', 'Alineacion', 'Estado', 'ConteoPersonas', 'CreadoEn',
        'HoraInicio', 'HoraFin', 'PlanStock', 'Ventas', 'ObservacionesDiarias', 'ConteoProductos',
        'ConteoMenores30', 'ConteoEntre30y55', 'ConteoMayores55', 'Cerrada', 'Muestras', 'CanalId'
      ]] })
    });
  }
}

export async function fetchFerias() {
  const data = await sheetsReq('/values/Ferias!A:X');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:                   r[0]  || '',
    empresa:              r[1]  || '',
    fechaInicio:          r[2]  || '',
    fechaFin:             r[3]  || '',
    precio:               parseFloat(r[4]) || 0,
    fechaImportante:      r[5]  || '',
    lugar:                r[6]  || '',
    observaciones:        r[7]  || '',
    alineacion:           parseInt(r[8]) || 0,
    estado:               r[9]  || 'disponible',
    conteoPersonas:       parseInt(r[10]) || 0, // respaldo histórico, ver feriaConteoTotal()
    creadoEn:             r[11] || '',
    horaInicio:           r[12] || '',
    horaFin:              r[13] || '',
    planStock:            safeParseJSON(r[14], {}),
    ventas:               safeParseJSON(r[15], []),
    observacionesDiarias: safeParseJSON(r[16], []),
    conteoProductos:      safeParseJSON(r[17], null),
    conteoMenores30:      parseInt(r[18]) || 0,
    conteoEntre30y55:     parseInt(r[19]) || 0,
    conteoMayores55:      parseInt(r[20]) || 0,
    cerrada:              r[21] === 'TRUE',
    muestras:             safeParseJSON(r[22], []),
    canalId:              r[23] || '',
    rowIndex:             i + 2
  }));
}

function feriaRowValues(f) {
  return [
    f.id, f.empresa, f.fechaInicio, f.fechaFin, f.precio, f.fechaImportante, f.lugar,
    f.observaciones || '', f.alineacion || 0, f.estado || 'disponible', f.conteoPersonas || 0,
    f.creadoEn || new Date().toISOString(),
    f.horaInicio || '', f.horaFin || '', JSON.stringify(f.planStock || {}), JSON.stringify(f.ventas || []),
    JSON.stringify(f.observacionesDiarias || []), JSON.stringify(f.conteoProductos || {}),
    f.conteoMenores30 || 0, f.conteoEntre30y55 || 0, f.conteoMayores55 || 0,
    f.cerrada ? 'TRUE' : 'FALSE', JSON.stringify(f.muestras || []), f.canalId || ''
  ];
}

export async function appendFeria(f) {
  await sheetsReq('/values/Ferias!A:X:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [feriaRowValues(f)] })
  });
}

export async function updateFeria(f) {
  await sheetsReq(`/values/Ferias!A${f.rowIndex}:X${f.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [feriaRowValues(f)] })
  });
}

export async function deleteFeriaRow(rowIndex) {
  if (!feriasSheetId) await ensureFeriasSheet();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: feriasSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

// ── Cálculo puro (todo derivado, nada editable a mano) ──────────────────────

// Antes de sumar por rango etario el conteo era un solo total; las ferias
// anteriores a ese cambio solo tienen el dato en conteoPersonas.
export function feriaConteoTotal(f) {
  const porRango = (f.conteoMenores30 || 0) + (f.conteoEntre30y55 || 0) + (f.conteoMayores55 || 0);
  return porRango || (f.conteoPersonas || 0);
}

export function feriaTotalLlevados(f) {
  return Object.values(f.planStock || {}).reduce((sum, q) => sum + (q || 0), 0);
}

export function feriaTotalVendidos(f) {
  return (f.ventas || []).reduce((sum, v) => sum + (v.cantidad || 0), 0);
}

// Ventas + muestras ya entregadas, por lote — las dos salen del mismo stock
// físico llevado, así que la disponibilidad para registrar cualquiera de
// las dos tiene que descontar las dos juntas.
export function getFeriaSalidaTotal(f) {
  const total = {};
  (f.ventas || []).forEach(v => { total[v.ejecucionId] = (total[v.ejecucionId] || 0) + v.cantidad; });
  (f.muestras || []).forEach(m => { total[m.ejecucionId] = (total[m.ejecucionId] || 0) + m.cantidad; });
  return total;
}

export function getFeriaDateList(f) {
  if (!f.fechaInicio || !f.fechaFin) return [];
  const dates = [];
  let d = parseISODate(f.fechaInicio);
  const end = parseISODate(f.fechaFin);
  while (d <= end) { dates.push(toISODate(d)); d = addDays(d, 1); }
  return dates;
}

// "En curso" = hoy cae en sus fechas Y no se cerró a mano con "Terminar feria".
export function feriaEstaEnCurso(f) {
  return getFeriaDateList(f).includes(toISODate(new Date())) && !f.cerrada;
}

// Todavía no llegó la fecha de inicio: acá lo que hace falta es planificar
// cuánto stock llevar, no un conteo.
export function feriaEsFutura(f) {
  return !!f.fechaInicio && toISODate(new Date()) < f.fechaInicio;
}

// Solo por calendario (ya pasó la fecha de fin) — a propósito no mira
// f.cerrada: una feria cerrada a mano mientras sigue en fechas no debería
// bajar al grupo de terminadas ni pintarse gris.
export function feriaHaTerminado(f) {
  return !!f.fechaFin && toISODate(new Date()) > f.fechaFin;
}

export function getFeriaDefaultDay(f) {
  const dias = getFeriaDateList(f);
  if (!dias.length) return null;
  const today = toISODate(new Date());
  if (dias.includes(today)) return today;
  return today < dias[0] ? dias[0] : dias[dias.length - 1];
}

// ── Stock comprometido/vendido por lote, entre todas las ferias ────────────
// excludeFeriaId: al editar el plan de una feria puntual, no hay que
// descontar lo que esa misma feria ya tenía planeado/vendido (si no, el
// disponible mostrado sería menor al real apenas se reabre su propio plan).

export function getStockComprometidoLote(ferias, ejecucionId, excludeFeriaId = null) {
  return ferias
    .filter(f => f.id !== excludeFeriaId)
    .reduce((sum, f) => sum + ((f.planStock || {})[ejecucionId] || 0), 0);
}

export function getStockVendidoLote(ferias, ejecucionId, excludeFeriaId = null) {
  return ferias
    .filter(f => f.id !== excludeFeriaId)
    .reduce((sum, f) =>
      sum + (f.ventas || []).filter(v => v.ejecucionId === ejecucionId).reduce((s, v) => s + v.cantidad, 0)
    , 0);
}

function getStockAjustesNetosLote(stockMovimientos, ejecucionId) {
  return stockMovimientos
    .filter(m => m.ejecucionId === ejecucionId)
    .reduce((sum, m) => sum + (m.tipo === 'entrada' ? m.cantidad : -m.cantidad), 0);
}

// Disponible de un lote puntual para plan de stock/ventas/muestras de una
// feria — descuenta lo comprometido por TODAS las demás ferias (no la que
// se está editando), el producto testigo apartado y suma/resta los ajustes
// manuales de Stock.
export function getStockDisponibleLote({ ejecuciones, ferias, stockMovimientos, stockTestigos }, ejecucionId, excludeFeriaId) {
  const ej = ejecuciones.find(e => e.id === ejecucionId);
  if (!ej) return 0;
  const ev = ej.evaluacion || {};
  const producido = (ev.frascos230 || 0) + (ev.frascos180 || 0);
  const testigo = stockTestigos
    .filter(t => t.ejecucionId === ejecucionId)
    .reduce((sum, t) => sum + (t.cantidad || 0), 0);
  return producido - testigo
    + getStockAjustesNetosLote(stockMovimientos, ejecucionId)
    - getStockComprometidoLote(ferias, ejecucionId, excludeFeriaId);
}

// ── Texto de resumen (para "Descargar resumen") ─────────────────────────────

export function feriaToText(f, ejecuciones, fmtCOP, fmtDate) {
  const sep = '═══════════════════════════════════════';
  const lines = [];
  lines.push(sep, `FERIA: ${f.empresa}`, sep, '');
  lines.push(`Fechas: ${f.fechaInicio} a ${f.fechaFin}`);
  lines.push(`Lugar: ${f.lugar || '—'}`);
  lines.push(`Precio de participación: ${fmtCOP(f.precio)}`);
  if (f.observaciones) lines.push(`Observaciones generales: ${f.observaciones}`);
  lines.push('', `Personas que probaron TateQuieto (total): ${feriaConteoTotal(f)}`);
  lines.push(`  • Menores de 30: ${f.conteoMenores30 || 0}`);
  lines.push(`  • Entre 30 y 55: ${f.conteoEntre30y55 || 0}`);
  lines.push(`  • Mayores de 55: ${f.conteoMayores55 || 0}`);

  const plan = f.planStock || {};
  const idsPlan = Object.keys(plan);
  lines.push('', 'Stock llevado a la feria (total):');
  if (idsPlan.length) {
    idsPlan.forEach(id => {
      const ej = ejecuciones.find(e => e.id === id);
      const label = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
      lines.push(`  - ${label}: ${plan[id]} unidades`);
    });
  } else {
    lines.push('  Sin stock planeado.');
  }
  if (idsPlan.length) {
    lines.push('', 'Conteo de productos (llevados - vendidos - muestras):');
    idsPlan.forEach(id => {
      const ej = ejecuciones.find(e => e.id === id);
      const label = ej ? `${ej.nombreReceta} — Lote ${ej.loteId || id.slice(0, 8)}` : id;
      const llevados = plan[id];
      const vendidos = (f.ventas || []).filter(v => v.ejecucionId === id).reduce((s, v) => s + v.cantidad, 0);
      const muestras = (f.muestras || []).filter(m => m.ejecucionId === id).reduce((s, m) => s + m.cantidad, 0);
      const sobrantes = llevados - vendidos - muestras;
      lines.push(`  - ${label}: llevados ${llevados}, vendidos ${vendidos}, muestras ${muestras}, sobrantes ${sobrantes}${sobrantes < 0 ? ' ⚠️' : ''}`);
    });
  }

  getFeriaDateList(f).forEach(fecha => {
    lines.push('', `── DÍA ${fecha} ─────────────────────────────────────────`);
    const ventasDia = (f.ventas || []).filter(v => v.fecha === fecha);
    if (ventasDia.length) {
      lines.push('Ventas:');
      ventasDia.forEach(v => lines.push(`  - ${v.recetaNombre}${v.loteId ? ` — Lote ${v.loteId}` : ''}: ${v.cantidad}`));
    }
    const obsDia = (f.observacionesDiarias || []).filter(o => o.fecha === fecha);
    if (obsDia.length) {
      lines.push('Observaciones del día:');
      obsDia.forEach(o => lines.push(`  - ${o.text} (${fmtDate(o.createdAt)})`));
    }
  });

  lines.push('', sep, '');
  return lines.join('\n');
}
