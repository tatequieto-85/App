// Catálogo de medidas/tamaños de empaque (ej. "230 ml", "130 ml") — a pedido
// explícito del usuario: liviano y reutilizable (solo nombre + peso en ml),
// los insumos unitarios exactos de cada combinación receta+medida (porque la
// etiqueta cambia según el sabor) viven en `receta.medidas`, no acá (ver
// recetasApi.js). PesoMl es la base para escalar insumos de peso en la
// Calculadora de Ventas y para el puente de compatibilidad con los campos
// legacy frascos230/frascos130 de Stock (ver EjecucionProduccionBox.jsx/
// useProcesos.js) — mismo criterio 1 ml = 1 g que el resto de la app.
import { sheetsReq } from './googleAuth';

let medidasSheetId = null;

export async function ensureMedidasSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasM = tabs.find(s => s.properties.title === 'Medidas');

  if (hasM) {
    medidasSheetId = hasM.properties.sheetId;
    return;
  }
  const res = await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Medidas' } } }] })
  });
  const added = res.replies?.[0]?.addSheet?.properties;
  if (added) medidasSheetId = added.sheetId;
  await sheetsReq('/values/Medidas!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [['ID', 'Nombre', 'PesoMl', 'CreadoEn']] })
  });
}

export async function fetchMedidas() {
  const data = await sheetsReq('/values/Medidas!A:D');
  const rows = (data.values || []).slice(1);
  return rows.filter(r => r[0]).map((r, i) => ({
    id: r[0] || '',
    nombre: r[1] || '',
    pesoMl: parseFloat(r[2]) || 0,
    creadoEn: r[3] || '',
    rowIndex: i + 2
  }));
}

export async function appendMedida(nombre, pesoMl) {
  const id = crypto.randomUUID();
  await sheetsReq('/values/Medidas!A:D:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[id, nombre, pesoMl || 0, new Date().toISOString()]] })
  });
  return id;
}
