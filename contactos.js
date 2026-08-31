import { sheetsReq } from './auth.js';
import { esc, setFb, fmtDate, confirmCloseIfDirty, safeLoad } from './utils.js';
import { wasAccidentalTouch } from './input-guard.js';

// ── State ─────────────────────────────────────────────────────────────────────
// Exportado para que tareas.js pueda armar el picker "@" de menciones en
// observaciones sin duplicar una carga propia de contactos.
export let contactos    = [];
let relaciones         = [];
let contactosSheetId   = null;
let relacionesSheetId  = null;
let detailContactoId   = null; // contacto que muestra #contactoDetailOverlay
let editingContactoId  = null; // null = #contactoOverlay está en modo "crear"
let contactoSearchQuery = '';
let lastTapTime         = {}; // para detección de doble-toque en móvil

// ── DOM refs ──────────────────────────────────────────────────────────────────
const contactosList = document.getElementById('contactosList');
const contactoSearchInput = document.getElementById('contactoSearchInput');
const btnNewContacto = document.getElementById('btnNewContacto');

const contactoOverlay        = document.getElementById('contactoOverlay');
const contactoModalTitle     = document.getElementById('contactoModalTitle');
const btnCloseContacto       = document.getElementById('btnCloseContacto');
const contactoNombre         = document.getElementById('contactoNombre');
const contactoCumpleanos     = document.getElementById('contactoCumpleanos');
const contactoEdadIngreso    = document.getElementById('contactoEdadIngreso');
const contactoEmpresa        = document.getElementById('contactoEmpresa');
const contactoPosicion       = document.getElementById('contactoPosicion');
const contactoTelefono       = document.getElementById('contactoTelefono');
const contactoCiudad         = document.getElementById('contactoCiudad');
const contactoEmpresaList    = document.getElementById('contactoEmpresaList');
const contactoCiudadList     = document.getElementById('contactoCiudadList');
const btnSaveContacto        = document.getElementById('btnSaveContacto');
const contactoFeedback       = document.getElementById('contactoFeedback');

const contactoDetailOverlay       = document.getElementById('contactoDetailOverlay');
const btnCloseContactoDetail      = document.getElementById('btnCloseContactoDetail');
const contactoDetailTitle         = document.getElementById('contactoDetailTitle');
const contactoDetailCumpleanosRow = document.getElementById('contactoDetailCumpleanosRow');
const contactoDetailCumpleanosView = document.getElementById('contactoDetailCumpleanosView');
const contactoDetailEdadRow       = document.getElementById('contactoDetailEdadRow');
const contactoDetailEdadView      = document.getElementById('contactoDetailEdadView');
const contactoDetailEmpresaRow    = document.getElementById('contactoDetailEmpresaRow');
const contactoDetailEmpresaView   = document.getElementById('contactoDetailEmpresaView');
const contactoDetailTelefonoRow   = document.getElementById('contactoDetailTelefonoRow');
const contactoDetailTelefonoView  = document.getElementById('contactoDetailTelefonoView');
const contactoDetailCiudadRow     = document.getElementById('contactoDetailCiudadRow');
const contactoDetailCiudadView    = document.getElementById('contactoDetailCiudadView');
const contactoDetailFeedback      = document.getElementById('contactoDetailFeedback');
const contactoRelacionesList      = document.getElementById('contactoRelacionesList');
const contactoRelacionSelect      = document.getElementById('contactoRelacionSelect');
const contactoRelacionTipo        = document.getElementById('contactoRelacionTipo');
const contactoRelacionCategoria   = document.getElementById('contactoRelacionCategoria');
const contactoRelacionCategoriaList = document.getElementById('contactoRelacionCategoriaList');
const btnAddRelacion              = document.getElementById('btnAddRelacion');
const contactoObsList             = document.getElementById('contactoObsList');
const contactoObsInput            = document.getElementById('contactoObsInput');
const btnAddContactoObs           = document.getElementById('btnAddContactoObs');

// "Trabajo" ya no es una categoría más de relación/parentesco — es su
// propio tipo de vínculo (ver contactoRelacionTipo), con predictivo de
// empresas ya inscritas en vez de categorías libres.
const DEFAULT_CATEGORIAS = ['Amigos', 'Familia'];

// ── Sheets: Contactos + ContactosRelaciones ───────────────────────────────────

export async function initContactosSheets() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasC = tabs.find(s => s.properties.title === 'Contactos');
  const hasR = tabs.find(s => s.properties.title === 'ContactosRelaciones');

  if (hasC) contactosSheetId  = hasC.properties.sheetId;
  if (hasR) relacionesSheetId = hasR.properties.sheetId;

  const reqs = [];
  if (!hasC) reqs.push({ addSheet: { properties: { title: 'Contactos' } } });
  if (!hasR) reqs.push({ addSheet: { properties: { title: 'ContactosRelaciones' } } });

  if (reqs.length) {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST', body: JSON.stringify({ requests: reqs })
    });
    res.replies?.forEach(r => {
      if (r.addSheet?.properties?.title === 'Contactos')          contactosSheetId  = r.addSheet.properties.sheetId;
      if (r.addSheet?.properties?.title === 'ContactosRelaciones') relacionesSheetId = r.addSheet.properties.sheetId;
    });
  }

  const cd = await sheetsReq('/values/Contactos!A1:K1').catch(() => ({}));
  if (!cd.values) {
    await sheetsReq('/values/Contactos!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Nombre', 'Cumpleanos', 'EdadIngreso', 'FechaIngreso', 'Observaciones', 'CreadoEn', 'Empresa', 'Posicion', 'Telefono', 'Ciudad']] })
    });
  } else {
    // Bases ya existentes, creadas antes de agregar estas columnas — las
    // columnas nuevas siempre van al final, se parchea el header si falta.
    const header = cd.values[0] || [];
    if (header.length < 10) {
      await sheetsReq('/values/Contactos!H1:J1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [['Empresa', 'Posicion', 'Telefono']] })
      });
    }
    if (header.length < 11) {
      await sheetsReq('/values/Contactos!K1?valueInputOption=RAW', {
        method: 'PUT',
        body: JSON.stringify({ values: [['Ciudad']] })
      });
    }
  }

  const rd = await sheetsReq('/values/ContactosRelaciones!A1:F1').catch(() => ({}));
  if (!rd.values) {
    await sheetsReq('/values/ContactosRelaciones!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'ContactoAId', 'ContactoBId', 'Categoria', 'CreadoEn', 'Tipo']] })
    });
  } else if ((rd.values[0] || []).length < 6) {
    // Bases ya existentes, de antes de separar "Trabajo" en su propio tipo.
    await sheetsReq('/values/ContactosRelaciones!F1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['Tipo']] })
    });
  }
}

export async function loadContactos() {
  await safeLoad(async () => {
    const [cData, rData] = await Promise.all([
      sheetsReq('/values/Contactos!A:K'),
      sheetsReq('/values/ContactosRelaciones!A:F')
    ]);

    contactos = (cData.values || []).slice(1).filter(r => r[0]).map((r, i) => ({
      id:            r[0] || '',
      nombre:        r[1] || '',
      cumpleanos:    r[2] || '',
      edadIngreso:   r[3] !== undefined && r[3] !== '' ? +r[3] : null,
      fechaIngreso:  r[4] || '',
      observaciones: parseObservaciones(r[5]),
      creadoEn:      r[6] || '',
      empresa:       r[7] || '',
      posicion:      r[8] || '',
      telefono:      r[9] || '',
      ciudad:        r[10] || '',
      rowIndex:      i + 2
    })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    relaciones = (rData.values || []).slice(1).filter(r => r[0]).map((r, i) => ({
      id:           r[0] || '',
      contactoAId:  r[1] || '',
      contactoBId:  r[2] || '',
      categoria:    r[3] || '',
      creadoEn:     r[4] || '',
      // Vínculos guardados antes de separar "Trabajo" no tienen tipo — se
      // tratan como relación/parentesco, que es lo que eran hasta ahora.
      tipo:         r[5] || 'relacion',
      rowIndex:     i + 2
    }));

    renderContactosList();
  }, contactosList);
}

async function appendContacto(c) {
  await sheetsReq('/values/Contactos!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), c.nombre, c.cumpleanos, c.edadIngreso ?? '', new Date().toISOString(),
      '[]', new Date().toISOString(), c.empresa || '', c.posicion || '', c.telefono || '', c.ciudad || ''
    ]] })
  });
}

// El rango B:J incluye la columna F (observaciones) — se manda el valor
// que ya esté cacheado en memoria sin tocarlo (este modal no edita
// observaciones, eso vive en el detalle) para no pisarlas.
async function updateContacto(c) {
  await sheetsReq(`/values/Contactos!B${c.rowIndex}:K${c.rowIndex}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      c.nombre, c.cumpleanos, c.edadIngreso ?? '', c.fechaIngreso, JSON.stringify(c.observaciones || []),
      c.creadoEn, c.empresa || '', c.posicion || '', c.telefono || '', c.ciudad || ''
    ]] })
  });
}

// Datos viejos (de antes de este cambio) tenían Observaciones como texto
// plano, no un JSON de lista — se migran solas al leer: un string no-JSON
// se envuelve como una única observación sin fecha conocida.
function parseObservaciones(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [{ text: raw, createdAt: '' }];
}

async function deleteContactoRow(rowIndex) {
  if (contactosSheetId === null) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'Contactos');
    if (tab) contactosSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{
      deleteDimension: { range: { sheetId: contactosSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } }
    }] })
  });
}

async function deleteRelacionRow(rowIndex) {
  if (relacionesSheetId === null) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'ContactosRelaciones');
    if (tab) relacionesSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{
      deleteDimension: { range: { sheetId: relacionesSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } }
    }] })
  });
}

// Borrar un contacto también borra sus vínculos (en ambas direcciones) para
// no dejar relaciones huérfanas apuntando a un contacto que ya no existe.
async function deleteContacto(c) {
  const related = relaciones.filter(r => r.contactoAId === c.id || r.contactoBId === c.id);
  // Se borran de mayor a menor rowIndex: borrar una fila corre hacia arriba
  // el índice de las que quedan debajo, y ya tenemos todos los rowIndex
  // calculados de antemano.
  related.sort((a, b) => b.rowIndex - a.rowIndex);
  for (const r of related) await deleteRelacionRow(r.rowIndex);
  await deleteContactoRow(c.rowIndex);
}

async function appendRelacion(contactoAId, contactoBId, categoria, tipo) {
  await sheetsReq('/values/ContactosRelaciones!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[crypto.randomUUID(), contactoAId, contactoBId, categoria, new Date().toISOString(), tipo]] })
  });
}

// Agrega una observación al historial del contacto — mismo shape que las
// observaciones de Tareas ({text, createdAt}), sin adjuntos. La usa tanto
// el botón "Agregar" del detalle de contacto como tareas.js cuando se
// etiqueta un contacto con "@" en una observación de tarea.
export async function appendObservacionAContacto(contactoId, text) {
  const c = contactos.find(x => x.id === contactoId);
  if (!c) return;
  c.observaciones = c.observaciones || [];
  c.observaciones.push({ text, createdAt: new Date().toISOString() });
  await sheetsReq(`/values/Contactos!F${c.rowIndex}:F${c.rowIndex}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[JSON.stringify(c.observaciones)]] })
  });
}

// ── Edad calculada (nunca se guarda — se recalcula cada vez que se muestra) ──

function edadActual(c) {
  if (c.edadIngreso === null || c.edadIngreso === undefined || !c.fechaIngreso) return c.edadIngreso;
  const start = new Date(c.fechaIngreso);
  const now   = new Date();
  let years   = now.getFullYear() - start.getFullYear();
  const pasoAniversario = now.getMonth() > start.getMonth()
    || (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate());
  if (!pasoAniversario) years--;
  return c.edadIngreso + Math.max(0, years);
}

function fmtCumpleanos(mmdd) {
  if (!mmdd) return '';
  const [mes, dia] = mmdd.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${+dia} ${meses[+mes - 1] || ''}`;
}

// Solo categorías de vínculos tipo "relación" — las de "trabajo" son
// nombres de empresa, no deberían mezclarse en este predictivo.
function todasLasCategorias() {
  const usadas = [...new Set(relaciones.filter(r => r.tipo !== 'trabajo').map(r => r.categoria).filter(Boolean))];
  return [...new Set([...DEFAULT_CATEGORIAS, ...usadas])];
}

function relacionesDe(contactoId) {
  return relaciones
    .filter(r => r.contactoAId === contactoId || r.contactoBId === contactoId)
    .map(r => {
      const otroId = r.contactoAId === contactoId ? r.contactoBId : r.contactoAId;
      const otro   = contactos.find(c => c.id === otroId);
      return { ...r, otro };
    })
    .filter(r => r.otro);
}

// ── Lista principal ───────────────────────────────────────────────────────────

// Tarjeta cuadrada (1x1) — compacta a propósito, no entra todo: nombre,
// empresa/posición, y un renglón chico de badges. El resto (teléfono,
// cumpleaños, observaciones completas) se ve en el detalle (doble clic).
function contactoCardHTML(c) {
  const edad = edadActual(c);
  const nRelaciones = relacionesDe(c.id).length;
  const obs = c.observaciones || [];
  const puesto = [c.posicion, c.empresa].filter(Boolean).join(' en ');
  const badges = [];
  if (edad !== null && edad !== undefined) badges.push(`${edad} años`);
  if (c.ciudad) badges.push(`📍${c.ciudad}`);
  if (nRelaciones) badges.push(`🔗${nRelaciones}`);
  if (obs.length) badges.push(`📝${obs.length}`);

  return `
    <div class="contacto-card" data-contacto-id="${esc(c.id)}" data-row="${c.rowIndex}">
      <div class="contacto-card-name">${esc(c.nombre)}</div>
      ${puesto ? `<div class="contacto-card-meta">${esc(puesto)}</div>` : ''}
      ${badges.length ? `<div class="contacto-card-badges">${esc(badges.join(' · '))}</div>` : ''}
      <div class="contacto-card-actions">
        <button type="button" data-edit-contacto="${esc(c.id)}">Editar</button>
        <button type="button" data-del-contacto="${esc(c.id)}">Borrar</button>
      </div>
    </div>`;
}

// Busca la palabra escrita en nombre, empresa, posición y teléfono —
// cualquier campo que matchee alcanza.
function contactoMatchesSearch(c, query) {
  if (!query) return true;
  const campos = [c.nombre, c.empresa, c.posicion, c.telefono];
  return campos.some(campo => (campo || '').toLowerCase().includes(query));
}

export function renderContactosList() {
  const query = contactoSearchQuery.trim().toLowerCase();
  const visibles = contactos.filter(c => contactoMatchesSearch(c, query));

  if (!contactos.length) {
    contactosList.innerHTML = '<div class="empty-state">Aún no hay contactos guardados</div>';
    return;
  }
  if (!visibles.length) {
    contactosList.innerHTML = '<div class="empty-state">Ningún contacto coincide con la búsqueda</div>';
    return;
  }
  contactosList.innerHTML = `<div class="contactos-grid">${visibles.map(contactoCardHTML).join('')}</div>`;
  wireContactoCards();
}

contactoSearchInput.addEventListener('input', () => {
  contactoSearchQuery = contactoSearchInput.value;
  renderContactosList();
});

// Editar/Borrar solo aparecen manteniendo la tarjeta presionada — mismo
// patrón (550ms, cancela con movimiento) que el resto de la app. Doble
// clic/doble toque abre el detalle; "Editar" del panel también.
function wireContactoCards() {
  contactosList.querySelectorAll('.contacto-card').forEach(card => {
    const id = card.dataset.contactoId;
    let pressTimer  = null;
    let longPressed = false;
    const openCardActions = () => {
      contactosList.querySelectorAll('.contacto-card-actions.open').forEach(a => a.classList.remove('open'));
      card.querySelector('.contacto-card-actions')?.classList.add('open');
    };
    const startPress = e => {
      if (e.target.closest('button')) return;
      longPressed = false;
      pressTimer = setTimeout(() => { longPressed = true; openCardActions(); }, 550);
    };
    const cancelPress = () => clearTimeout(pressTimer);
    card.addEventListener('mousedown', startPress);
    card.addEventListener('mouseup', cancelPress);
    card.addEventListener('mouseleave', cancelPress);
    card.addEventListener('touchstart', startPress, { passive: true });
    card.addEventListener('touchmove', cancelPress, { passive: true });
    card.addEventListener('click', () => { if (longPressed) longPressed = false; });

    card.addEventListener('dblclick', e => {
      if (longPressed || e.target.closest('button')) return;
      openContactoDetail(id);
    });
    card.addEventListener('touchend', e => {
      cancelPress();
      if (longPressed) { longPressed = false; return; }
      if (e.target.closest('button') || wasAccidentalTouch()) return;
      const now = Date.now();
      const last = lastTapTime[id] || 0;
      lastTapTime[id] = now;
      if (now - last < 350) openContactoDetail(id);
    });
  });

  contactosList.querySelectorAll('[data-edit-contacto]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const c = contactos.find(x => x.id === btn.dataset.editContacto);
      if (c) openEditContactoModal(c);
    });
  });
  contactosList.querySelectorAll('[data-del-contacto]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const c = contactos.find(x => x.id === btn.dataset.delContacto);
      if (!c) return;
      if (!confirm(`¿Eliminar a "${c.nombre}"? También se borran sus relaciones con otros contactos.`)) return;
      btn.disabled = true;
      try { await deleteContacto(c); await loadContactos(); }
      catch (err) { alert('Error: ' + err.message); btn.disabled = false; }
    });
  });
}

document.addEventListener('click', () => {
  document.querySelectorAll('#contactosList .contacto-card-actions.open').forEach(a => a.classList.remove('open'));
});

// ── Modal: nuevo/editar contacto ──────────────────────────────────────────────
// Mismo patrón que los grupos de recetas/canales de venta: un solo modal,
// editingContactoId null = crear. Solo edita los datos — observaciones y
// relaciones viven en el detalle (ver openContactoDetail).

// Texto predictivo de Empresa/Ciudad — sugiere lo que ya se cargó en otros
// contactos (datalist nativo), sin bloquear escribir algo nuevo.
function populateContactoDatalists() {
  const empresas = [...new Set(contactos.map(c => c.empresa).filter(Boolean))].sort();
  const ciudades = [...new Set(contactos.map(c => c.ciudad).filter(Boolean))].sort();
  contactoEmpresaList.innerHTML = empresas.map(v => `<option value="${esc(v)}"></option>`).join('');
  contactoCiudadList.innerHTML  = ciudades.map(v => `<option value="${esc(v)}"></option>`).join('');
}

function openContactoModal() {
  editingContactoId = null;
  contactoModalTitle.textContent = 'Nuevo contacto';
  btnSaveContacto.textContent = 'Guardar contacto';
  contactoNombre.value = '';
  contactoCumpleanos.value = '';
  contactoEdadIngreso.value = '';
  contactoEmpresa.value = '';
  contactoPosicion.value = '';
  contactoTelefono.value = '';
  contactoCiudad.value = '';
  setFb(contactoFeedback, '', '');
  populateContactoDatalists();
  contactoOverlay.classList.add('open');
  setTimeout(() => contactoNombre.focus(), 100);
}
btnNewContacto.addEventListener('click', openContactoModal);

function openEditContactoModal(c) {
  editingContactoId = c.id;
  contactoModalTitle.textContent = 'Editar contacto';
  btnSaveContacto.textContent = 'Guardar cambios';
  contactoNombre.value = c.nombre;
  contactoCumpleanos.value = c.cumpleanos ? `2000-${c.cumpleanos}` : '';
  contactoEdadIngreso.value = c.edadIngreso ?? '';
  contactoEmpresa.value = c.empresa;
  contactoPosicion.value = c.posicion;
  contactoTelefono.value = c.telefono;
  contactoCiudad.value = c.ciudad;
  setFb(contactoFeedback, '', '');
  populateContactoDatalists();
  contactoOverlay.classList.add('open');
  setTimeout(() => contactoNombre.focus(), 100);
}

function isContactoFormDirty() {
  return !!contactoNombre.value.trim() || !!contactoCumpleanos.value
    || !!contactoEdadIngreso.value.trim() || !!contactoEmpresa.value.trim()
    || !!contactoPosicion.value.trim() || !!contactoTelefono.value.trim()
    || !!contactoCiudad.value.trim();
}
function closeContactoModal() {
  confirmCloseIfDirty('contactoOverlay', isContactoFormDirty);
}
btnCloseContacto.addEventListener('click', closeContactoModal);
contactoOverlay.addEventListener('click', e => { if (e.target === contactoOverlay) closeContactoModal(); });

btnSaveContacto.addEventListener('click', async () => {
  const nombre = contactoNombre.value.trim();
  if (!nombre) return setFb(contactoFeedback, 'El nombre es obligatorio.', 'err');

  const datos = {
    nombre,
    cumpleanos:  contactoCumpleanos.value ? contactoCumpleanos.value.slice(5) : '',
    edadIngreso: contactoEdadIngreso.value.trim() ? +contactoEdadIngreso.value : null,
    empresa:     contactoEmpresa.value.trim(),
    posicion:    contactoPosicion.value.trim(),
    telefono:    contactoTelefono.value.trim(),
    ciudad:      contactoCiudad.value.trim()
  };

  btnSaveContacto.disabled = true;
  try {
    if (editingContactoId) {
      const existente = contactos.find(x => x.id === editingContactoId);
      if (existente) await updateContacto({ ...existente, ...datos });
    } else {
      await appendContacto(datos);
    }
    contactoOverlay.classList.remove('open');
    await loadContactos();
  } catch (e) {
    setFb(contactoFeedback, 'Error: ' + e.message, 'err');
  } finally {
    btnSaveContacto.disabled = false;
  }
});

// ── Detalle de contacto (editar + relaciones) ─────────────────────────────────

function renderRelacionesList() {
  const contacto = contactos.find(c => c.id === detailContactoId);
  if (!contacto) return;
  const rels = relacionesDe(contacto.id);

  contactoRelacionesList.innerHTML = rels.length
    ? rels.map(r => `
        <div class="contacto-relacion-item">
          <span class="audio-chip">${r.tipo === 'trabajo' ? '💼 ' : ''}${esc(r.categoria)}</span>
          <span class="contacto-relacion-nombre">${esc(r.otro.nombre)}</span>
        </div>`).join('')
    : '<div class="empty-state" style="padding:12px 0">Sin relaciones todavía</div>';

  // Los vínculos existentes son de solo lectura acá — no hay forma de
  // quitarlos desde el detalle, solo de agregar uno nuevo.

  // Selector de "con quién vincular" — todos los contactos menos el actual.
  contactoRelacionSelect.innerHTML = contactos
    .filter(c => c.id !== contacto.id)
    .map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`)
    .join('') || '<option value="" disabled>No hay otros contactos todavía</option>';

  refreshRelacionCategoriaOptions();
}

// Predictivo del campo "categoría" del vínculo: si el tipo es "trabajo"
// sugiere empresas ya inscritas en algún contacto (mismas que el campo
// Empresa del formulario); si es "relación" sugiere categorías ya usadas.
function refreshRelacionCategoriaOptions() {
  const opciones = contactoRelacionTipo.value === 'trabajo'
    ? [...new Set(contactos.map(c => c.empresa).filter(Boolean))].sort()
    : todasLasCategorias();
  contactoRelacionCategoriaList.innerHTML = opciones.map(v => `<option value="${esc(v)}"></option>`).join('');
  contactoRelacionCategoria.placeholder = contactoRelacionTipo.value === 'trabajo'
    ? 'Empresa (ej: Acme)' : 'Categoría (ej: Amigos)';
}
contactoRelacionTipo.addEventListener('change', refreshRelacionCategoriaOptions);

function renderContactoObs(contacto) {
  const obs = contacto.observaciones || [];
  contactoObsList.innerHTML = obs.length
    ? obs.map(o => `
        <div class="obs-item">
          <div class="obs-text">${esc(o.text)}</div>
          <div class="obs-date">${o.createdAt ? fmtDate(o.createdAt) : ''}</div>
        </div>`).join('')
    : '<div class="obs-empty">Aún sin observaciones</div>';
  contactoObsList.scrollTop = contactoObsList.scrollHeight;
}

// Doble clic/doble toque en la tarjeta abre esto: un resumen de solo
// lectura (los datos se editan desde "Editar", ver openEditContactoModal)
// más el historial completo de observaciones con su fecha, y las
// relaciones con otros contactos.
export function openContactoDetail(id) {
  const contacto = contactos.find(c => c.id === id);
  if (!contacto) return;
  detailContactoId = id;

  contactoDetailTitle.textContent = contacto.nombre;

  contactoDetailCumpleanosView.textContent = contacto.cumpleanos ? fmtCumpleanos(contacto.cumpleanos) : '';
  contactoDetailCumpleanosRow.hidden = !contacto.cumpleanos;

  const edad = edadActual(contacto);
  const tieneEdad = edad !== null && edad !== undefined;
  contactoDetailEdadView.textContent = tieneEdad ? `${edad} años` : '';
  contactoDetailEdadRow.hidden = !tieneEdad;

  const puesto = [contacto.posicion, contacto.empresa].filter(Boolean).join(' en ');
  contactoDetailEmpresaView.textContent = puesto;
  contactoDetailEmpresaRow.hidden = !puesto;

  contactoDetailTelefonoView.textContent = contacto.telefono || '';
  contactoDetailTelefonoRow.hidden = !contacto.telefono;

  contactoDetailCiudadView.textContent = contacto.ciudad || '';
  contactoDetailCiudadRow.hidden = !contacto.ciudad;

  setFb(contactoDetailFeedback, '', '');
  contactoObsInput.value = '';
  contactoRelacionTipo.value = 'relacion';
  renderRelacionesList();
  renderContactoObs(contacto);
  contactoDetailOverlay.classList.add('open');
}

function closeContactoDetail() {
  contactoDetailOverlay.classList.remove('open');
}
btnCloseContactoDetail.addEventListener('click', closeContactoDetail);
contactoDetailOverlay.addEventListener('click', e => { if (e.target === contactoDetailOverlay) closeContactoDetail(); });

btnAddContactoObs.addEventListener('click', async () => {
  const text = contactoObsInput.value.trim();
  if (!text) return;
  const contacto = contactos.find(c => c.id === detailContactoId);
  if (!contacto) return;

  btnAddContactoObs.disabled = true;
  try {
    await appendObservacionAContacto(contacto.id, text);
    contactoObsInput.value = '';
    renderContactoObs(contacto);
    renderContactosList();
  } catch (e) {
    setFb(contactoDetailFeedback, 'Error: ' + e.message, 'err');
  } finally {
    btnAddContactoObs.disabled = false;
  }
});

btnAddRelacion.addEventListener('click', async () => {
  const otroId = contactoRelacionSelect.value;
  const categoria = contactoRelacionCategoria.value.trim();
  if (!otroId) return setFb(contactoDetailFeedback, 'Elegí con quién vincularlo.', 'err');
  if (!categoria) return setFb(contactoDetailFeedback, 'Ponele una categoría al vínculo.', 'err');

  btnAddRelacion.disabled = true;
  try {
    await appendRelacion(detailContactoId, otroId, categoria, contactoRelacionTipo.value);
    contactoRelacionCategoria.value = '';
    await loadContactos();
    openContactoDetail(detailContactoId);
  } catch (e) {
    setFb(contactoDetailFeedback, 'Error: ' + e.message, 'err');
  } finally {
    btnAddRelacion.disabled = false;
  }
});
