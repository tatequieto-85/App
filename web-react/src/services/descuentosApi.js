// Catálogo de descuentos de venta — a pedido explícito del usuario, mismo
// patrón que combosApi.js (catálogo global, cada feria elige cuáles puede
// aplicar vía `descuentoIds`, ver feriasApi.js). tipo: 'porcentaje' (0-100)
// o 'monto' (pesos fijos) — se aplica sobre el TOTAL de esa venta-combo, no
// por unidad, ver registrarVentaCombo en useVentas.js. Hoja propia
// "VentaDescuentos".
import { sheetsReq } from './googleAuth';

let descuentosSheetId = null;

export async function ensureDescuentosSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasD = tabs.find(s => s.properties.title === 'VentaDescuentos');

  if (hasD) {
    descuentosSheetId = hasD.properties.sheetId;
    return;
  }
  const res = await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'VentaDescuentos' } } }] })
  });
  const added = res.replies?.[0]?.addSheet?.properties;
  if (added) descuentosSheetId = added.sheetId;
  await sheetsReq('/values/VentaDescuentos!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [['ID', 'Nombre', 'Tipo', 'Valor', 'CreadoEn']] })
  });
}

export async function fetchDescuentos() {
  const data = await sheetsReq('/values/VentaDescuentos!A:E');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id:        r[0] || '',
    nombre:    r[1] || '',
    tipo:      r[2] === 'monto' ? 'monto' : 'porcentaje',
    valor:     parseFloat(r[3]) || 0,
    creadoEn:  r[4] || '',
    rowIndex:  i + 2
  })).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function descuentoRowValues(d) {
  return [d.id, d.nombre, d.tipo === 'monto' ? 'monto' : 'porcentaje', d.valor, d.creadoEn || new Date().toISOString()];
}

export async function appendDescuento(d) {
  await sheetsReq('/values/VentaDescuentos!A:E:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [descuentoRowValues(d)] })
  });
}

export async function updateDescuento(d) {
  await sheetsReq(`/values/VentaDescuentos!A${d.rowIndex}:E${d.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [descuentoRowValues(d)] })
  });
}

export async function deleteDescuentoRow(rowIndex) {
  if (!descuentosSheetId) await ensureDescuentosSheet();
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: descuentosSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    } }] })
  });
}

// Monto a restar del subtotal (precio del combo * cantidad vendida) — nunca
// negativo ni mayor al subtotal, para que un monto fijo mal cargado no deje
// la venta en números rojos.
export function calcularDescuento(descuento, subtotal) {
  if (!descuento) return 0;
  const bruto = descuento.tipo === 'monto' ? descuento.valor : subtotal * (descuento.valor / 100);
  return Math.max(0, Math.min(subtotal, bruto));
}
