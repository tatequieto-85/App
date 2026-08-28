import { sheetsReq } from './auth.js';
import { esc, setFb, fmtDate, confirmCloseIfDirty, safeLoad } from './utils.js';

// ── State ─────────────────────────────────────────────────────────────────────
// Exportado para que tareas.js pueda armar el picker "@" de menciones en
// observaciones sin duplicar una carga propia de contactos.
export let contactos    = [];
let relaciones         = [];
let contactosSheetId   = null;
let relacionesSheetId  = null;
let detailContactoId   = null; // contacto que muestra #contactoDetailOverlay

// ── DOM refs ──────────────────────────────────────────────────────────────────
const contactosList = document.getElementById('contactosList');
const btnNewContacto = document.getElementById('btnNewContacto');

const contactoOverlay        = document.getElementById('contactoOverlay');
const btnCloseContacto       = document.getElementById('btnCloseContacto');
const contactoNombre         = document.getElementById('contactoNombre');
const contactoCumpleanos     = document.getElementById('contactoCumpleanos');
const contactoEdadIngreso    = document.getElementById('contactoEdadIngreso');
const contactoEmpresa        = document.getElementById('contactoEmpresa');
const contactoPosicion       = document.getElementById('contactoPosicion');
const contactoTelefono       = document.getElementById('contactoTelefono');
const contactoObservaciones  = document.getElementById('contactoObservaciones');
const btnSaveContacto        = document.getElementById('btnSaveContacto');
const contactoFeedback       = document.getElementById('contactoFeedback');

const contactoDetailOverlay       = document.getElementById('contactoDetailOverlay');
const btnCloseContactoDetail      = document.getElementById('btnCloseContactoDetail');
const contactoDetailTitle         = document.getElementById('contactoDetailTitle');
const contactoDetailNombre        = document.getElementById('contactoDetailNombre');
const contactoDetailCumpleanos    = document.getElementById('contactoDetailCumpleanos');
const contactoDetailEdadIngreso   = document.getElementById('contactoDetailEdadIngreso');
const contactoDetailEdadActual    = document.getElementById('contactoDetailEdadActual');
const contactoDetailEmpresa       = document.getElementById('contactoDetailEmpresa');
const contactoDetailPosicion      = document.getElementById('contactoDetailPosicion');
const contactoDetailTelefono      = document.getElementById('contactoDetailTelefono');
const contactoDetailObservaciones = document.getElementById('contactoDetailObservaciones');
const btnSaveContactoDetail       = document.getElementById('btnSaveContactoDetail');
const contactoDetailFeedback      = document.getElementById('contactoDetailFeedback');
const contactoRelacionesList      = document.getElementById('contactoRelacionesList');
const contactoRelacionSelect      = document.getElementById('contactoRelacionSelect');
const contactoRelacionCategoria   = document.getElementById('contactoRelacionCategoria');
const contactoRelacionCategoriaList = document.getElementById('contactoRelacionCategoriaList');
const btnAddRelacion              = document.getElementById('btnAddRelacion');

const DEFAULT_CATEGORIAS = ['Amigos', 'Trabajo', 'Familia'];

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

  const cd = await sheetsReq('/values/Contactos!A1').catch(() => ({}));
  if (!cd.values || !cd.values.length) {
    await sheetsReq('/values/Contactos!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Nombre', 'Cumpleanos', 'EdadIngreso', 'FechaIngreso', 'Observaciones', 'CreadoEn', 'Empresa', 'Posicion', 'Telefono']] })
    });
  } else if (cd.values[0].length < 10) {
    // Base ya existente creada antes de agregar Empresa/Posicion/Telefono —
    // las columnas nuevas siempre van al final, se parchea el header si falta.
    await sheetsReq('/values/Contactos!H1:J1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [['Empresa', 'Posicion', 'Telefono']] })
    });
  }

  const rd = await sheetsReq('/values/ContactosRelaciones!A1').catch(() => ({}));
  if (!rd.values) {
    await sheetsReq('/values/ContactosRelaciones!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'ContactoAId', 'ContactoBId', 'Categoria', 'CreadoEn']] })
    });
  }
}

export async function loadContactos() {
  await safeLoad(async () => {
    const [cData, rData] = await Promise.all([
      sheetsReq('/values/Contactos!A:J'),
      sheetsReq('/values/ContactosRelaciones!A:E')
    ]);

    contactos = (cData.values || []).slice(1).filter(r => r[0]).map((r, i) => ({
      id:            r[0] || '',
      nombre:        r[1] || '',
      cumpleanos:    r[2] || '',
      edadIngreso:   r[3] !== undefined && r[3] !== '' ? +r[3] : null,
      fechaIngreso:  r[4] || '',
      observaciones: r[5] || '',
      creadoEn:      r[6] || '',
      empresa:       r[7] || '',
      posicion:      r[8] || '',
      telefono:      r[9] || '',
      rowIndex:      i + 2
    })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    relaciones = (rData.values || []).slice(1).filter(r => r[0]).map((r, i) => ({
      id:           r[0] || '',
      contactoAId:  r[1] || '',
      contactoBId:  r[2] || '',
      categoria:    r[3] || '',
      creadoEn:     r[4] || '',
      rowIndex:     i + 2
    }));

    renderContactosList();
  }, contactosList);
}

async function appendContacto(c) {
  await sheetsReq('/values/Contactos!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), c.nombre, c.cumpleanos, c.edadIngreso ?? '', new Date().toISOString(),
      c.observaciones, new Date().toISOString(), c.empresa || '', c.posicion || '', c.telefono || ''
    ]] })
  });
}

async function updateContacto(c) {
  await sheetsReq(`/values/Contactos!B${c.rowIndex}:J${c.rowIndex}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      c.nombre, c.cumpleanos, c.edadIngreso ?? '', c.fechaIngreso, c.observaciones,
      c.creadoEn, c.empresa || '', c.posicion || '', c.telefono || ''
    ]] })
  });
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

async function appendRelacion(contactoAId, contactoBId, categoria) {
  await sheetsReq('/values/ContactosRelaciones!A:E:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[crypto.randomUUID(), contactoAId, contactoBId, categoria, new Date().toISOString()]] })
  });
}

// Usado por tareas.js cuando se etiqueta un contacto con "@" en una
// observación de tarea — se agrega como una línea más al campo de
// observaciones (texto libre) del contacto, no se rediseña Contactos para
// tener una lista estructurada como la de Tareas (con adjuntos, etc.).
export async function appendObservacionAContacto(contactoId, entryText) {
  const c = contactos.find(x => x.id === contactoId);
  if (!c) return;
  const nuevas = c.observaciones ? `${c.observaciones}\n\n${entryText}` : entryText;
  await sheetsReq(`/values/Contactos!F${c.rowIndex}:F${c.rowIndex}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[nuevas]] })
  });
  c.observaciones = nuevas;
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

function todasLasCategorias() {
  const usadas = [...new Set(relaciones.map(r => r.categoria).filter(Boolean))];
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

function contactoCardHTML(c) {
  const edad = edadActual(c);
  const nRelaciones = relacionesDe(c.id).length;
  const metaParts = [];
  if (edad !== null && edad !== undefined) metaParts.push(`${edad} años`);
  if (c.cumpleanos) metaParts.push(`🎂 ${fmtCumpleanos(c.cumpleanos)}`);
  if (nRelaciones) metaParts.push(`🔗 ${nRelaciones} relación${nRelaciones !== 1 ? 'es' : ''}`);
  const puesto = [c.posicion, c.empresa].filter(Boolean).join(' en ');

  return `
    <div class="story-card contacto-card" data-contacto-id="${esc(c.id)}" data-row="${c.rowIndex}">
      <div class="story-body">
        <div class="story-title" style="padding-right:0">${esc(c.nombre)}</div>
        ${puesto ? `<div class="story-date" style="color:var(--text-sub)">${esc(puesto)}</div>` : ''}
        ${metaParts.length ? `<div class="story-date">${esc(metaParts.join(' · '))}</div>` : ''}
        ${c.telefono ? `<div class="story-date">📞 ${esc(c.telefono)}</div>` : ''}
        ${c.observaciones ? `<div class="story-actions">${esc(c.observaciones)}</div>` : ''}
      </div>
      <div class="idea-mkt-footer">
        <span class="kanban-card-hint">mantén presionado</span>
        <div class="kanban-card-actions">
          <button type="button" data-edit-contacto="${esc(c.id)}">Editar</button>
          <button type="button" data-del-contacto="${esc(c.id)}">Borrar</button>
        </div>
      </div>
    </div>`;
}

export function renderContactosList() {
  if (!contactos.length) {
    contactosList.innerHTML = '<div class="empty-state">Aún no hay contactos guardados</div>';
    return;
  }
  contactosList.innerHTML = contactos.map(contactoCardHTML).join('');
  wireContactoCards();
}

// Editar/Borrar solo aparecen manteniendo la tarjeta presionada — mismo
// patrón (550ms, cancela con movimiento) que el resto de la app. Doble
// clic/doble toque abre el detalle; "Editar" del panel también.
function wireContactoCards() {
  contactosList.querySelectorAll('.contacto-card').forEach(card => {
    const id = card.dataset.contactoId;
    let pressTimer  = null;
    let longPressed = false;
    const openCardActions = () => {
      contactosList.querySelectorAll('.kanban-card-actions.open').forEach(a => a.classList.remove('open'));
      card.querySelector('.kanban-card-actions')?.classList.add('open');
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
      if (e.target.closest('button')) return;
    });
  });

  contactosList.querySelectorAll('[data-edit-contacto]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openContactoDetail(btn.dataset.editContacto); });
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
  document.querySelectorAll('#contactosList .kanban-card-actions.open').forEach(a => a.classList.remove('open'));
});

// ── Modal: nuevo contacto ──────────────────────────────────────────────────────

function openContactoModal() {
  contactoNombre.value = '';
  contactoCumpleanos.value = '';
  contactoEdadIngreso.value = '';
  contactoEmpresa.value = '';
  contactoPosicion.value = '';
  contactoTelefono.value = '';
  contactoObservaciones.value = '';
  setFb(contactoFeedback, '', '');
  contactoOverlay.classList.add('open');
  setTimeout(() => contactoNombre.focus(), 100);
}
btnNewContacto.addEventListener('click', openContactoModal);

function isContactoFormDirty() {
  return !!contactoNombre.value.trim() || !!contactoCumpleanos.value
    || !!contactoEdadIngreso.value.trim() || !!contactoEmpresa.value.trim()
    || !!contactoPosicion.value.trim() || !!contactoTelefono.value.trim()
    || !!contactoObservaciones.value.trim();
}
function closeContactoModal() {
  confirmCloseIfDirty('contactoOverlay', isContactoFormDirty);
}
btnCloseContacto.addEventListener('click', closeContactoModal);
contactoOverlay.addEventListener('click', e => { if (e.target === contactoOverlay) closeContactoModal(); });

btnSaveContacto.addEventListener('click', async () => {
  const nombre = contactoNombre.value.trim();
  if (!nombre) return setFb(contactoFeedback, 'El nombre es obligatorio.', 'err');

  btnSaveContacto.disabled = true;
  try {
    await appendContacto({
      nombre,
      cumpleanos:    contactoCumpleanos.value ? contactoCumpleanos.value.slice(5) : '',
      edadIngreso:   contactoEdadIngreso.value.trim() ? +contactoEdadIngreso.value : null,
      empresa:       contactoEmpresa.value.trim(),
      posicion:      contactoPosicion.value.trim(),
      telefono:      contactoTelefono.value.trim(),
      observaciones: contactoObservaciones.value.trim()
    });
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
          <span class="audio-chip">${esc(r.categoria)}</span>
          <span class="contacto-relacion-nombre">${esc(r.otro.nombre)}</span>
          <button type="button" class="preview-remove" data-quitar-relacion="${r.rowIndex}" title="Quitar vínculo">✕</button>
        </div>`).join('')
    : '<div class="empty-state" style="padding:12px 0">Sin relaciones todavía</div>';

  contactoRelacionesList.querySelectorAll('[data-quitar-relacion]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await deleteRelacionRow(+btn.dataset.quitarRelacion);
        await loadContactos();
        openContactoDetail(detailContactoId);
      } catch (e) { alert('Error: ' + e.message); btn.disabled = false; }
    });
  });

  // Selector de "con quién vincular" — todos los contactos menos el actual.
  contactoRelacionSelect.innerHTML = contactos
    .filter(c => c.id !== contacto.id)
    .map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`)
    .join('') || '<option value="" disabled>No hay otros contactos todavía</option>';

  contactoRelacionCategoriaList.innerHTML = todasLasCategorias()
    .map(cat => `<option value="${esc(cat)}"></option>`).join('');
}

export function openContactoDetail(id) {
  const contacto = contactos.find(c => c.id === id);
  if (!contacto) return;
  detailContactoId = id;

  contactoDetailTitle.textContent = contacto.nombre;
  contactoDetailNombre.value = contacto.nombre;
  contactoDetailCumpleanos.value = contacto.cumpleanos ? `2000-${contacto.cumpleanos}` : '';
  contactoDetailEdadIngreso.value = contacto.edadIngreso ?? '';
  contactoDetailEmpresa.value = contacto.empresa;
  contactoDetailPosicion.value = contacto.posicion;
  contactoDetailTelefono.value = contacto.telefono;
  contactoDetailObservaciones.value = contacto.observaciones;

  const edad = edadActual(contacto);
  contactoDetailEdadActual.textContent = edad !== null && edad !== undefined
    ? `Edad actual calculada: ${edad} años (desde que se cargó el ${fmtDate(contacto.fechaIngreso)})`
    : '';

  setFb(contactoDetailFeedback, '', '');
  renderRelacionesList();
  contactoDetailOverlay.classList.add('open');
}

function closeContactoDetail() {
  contactoDetailOverlay.classList.remove('open');
}
btnCloseContactoDetail.addEventListener('click', closeContactoDetail);
contactoDetailOverlay.addEventListener('click', e => { if (e.target === contactoDetailOverlay) closeContactoDetail(); });

btnSaveContactoDetail.addEventListener('click', async () => {
  const contacto = contactos.find(c => c.id === detailContactoId);
  if (!contacto) return;
  const nombre = contactoDetailNombre.value.trim();
  if (!nombre) return setFb(contactoDetailFeedback, 'El nombre es obligatorio.', 'err');

  btnSaveContactoDetail.disabled = true;
  try {
    await updateContacto({
      ...contacto,
      nombre,
      cumpleanos:    contactoDetailCumpleanos.value ? contactoDetailCumpleanos.value.slice(5) : '',
      edadIngreso:   contactoDetailEdadIngreso.value.trim() ? +contactoDetailEdadIngreso.value : null,
      empresa:       contactoDetailEmpresa.value.trim(),
      posicion:      contactoDetailPosicion.value.trim(),
      telefono:      contactoDetailTelefono.value.trim(),
      observaciones: contactoDetailObservaciones.value.trim()
    });
    await loadContactos();
    openContactoDetail(detailContactoId);
    setFb(contactoDetailFeedback, '✅ Guardado.', 'ok');
  } catch (e) {
    setFb(contactoDetailFeedback, 'Error: ' + e.message, 'err');
  } finally {
    btnSaveContactoDetail.disabled = false;
  }
});

btnAddRelacion.addEventListener('click', async () => {
  const otroId = contactoRelacionSelect.value;
  const categoria = contactoRelacionCategoria.value.trim();
  if (!otroId) return setFb(contactoDetailFeedback, 'Elegí con quién vincularlo.', 'err');
  if (!categoria) return setFb(contactoDetailFeedback, 'Ponele una categoría al vínculo.', 'err');

  btnAddRelacion.disabled = true;
  try {
    await appendRelacion(detailContactoId, otroId, categoria);
    contactoRelacionCategoria.value = '';
    await loadContactos();
    openContactoDetail(detailContactoId);
  } catch (e) {
    setFb(contactoDetailFeedback, 'Error: ' + e.message, 'err');
  } finally {
    btnAddRelacion.disabled = false;
  }
});
