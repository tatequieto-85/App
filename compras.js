import { sheetsReq } from './auth.js';
import {
  esc, setFb, setFieldError, clearFieldErrors, fmtDate, fmtDateShortEs, fmtCOP, toISODate, parseISODate, liveValidate,
  attachThousandsInput, parseThousandsInput, formatThousandsValue, ICON_EDIT, ICON_TRASH
} from './utils.js';
import {
  ingredientes, findIngredienteDuplicate, getIngredienteUnidad, normalizeIngName, attachIngredienteAutocomplete,
  appendIngrediente, loadIngredientes
} from './ingredientes.js';
import { openCalendarPopover } from './tareas.js';
import { wasAccidentalTouch } from './input-guard.js';

let compras             = [];
let comprasSheetId      = null;
let comprasHistorialIng = null;
let compraEditRecord  = null; // null = registrando compra nueva; si no, se está editando esa fila
let lastTapTime         = {}; // para detección de doble-toque en móvil

liveValidate('compraIngrediente', v => v.trim() ? '' : 'Indica el ingrediente.');
liveValidate('compraCantidad', v => (parseThousandsInput(v) > 0) ? '' : 'Debe ser mayor a 0.');
liveValidate('compraPrecioTotal', v => (parseThousandsInput(v) > 0) ? '' : 'Debe ser mayor a 0.');
attachThousandsInput(document.getElementById('compraCantidad'));
attachThousandsInput(document.getElementById('compraPrecioTotal'));

// ── Compras: Sheets init + CRUD ────────────────────────────────────────────────

export async function initComprasSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasC = tabs.find(s => s.properties.title === 'Compras');

  if (hasC) {
    comprasSheetId = hasC.properties.sheetId;
  } else {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Compras' } } }] })
    });
    const added = res.replies?.[0]?.addSheet?.properties;
    if (added) comprasSheetId = added.sheetId;
    await sheetsReq('/values/Compras!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Ingrediente', 'Cantidad', 'PrecioTotal', 'Fecha', 'CreadoEn']] })
    });
  }
  await loadCompras();
}

export async function loadCompras() {
  const data = await sheetsReq('/values/Compras!A:F');
  const rows = (data.values || []).slice(1);
  compras = rows.filter(r => r[0]).map((r, i) => ({
    id:          r[0] || '',
    ingrediente: r[1] || '',
    cantidad:    parseFloat(r[2]) || 0,
    precioTotal: parseFloat(r[3]) || 0,
    fecha:       r[4] || '',
    creadoEn:    r[5] || '',
    rowIndex:    i + 2
  }));
}

async function appendCompra(c) {
  await sheetsReq('/values/Compras!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[
      crypto.randomUUID(), c.ingrediente, c.cantidad, c.precioTotal, c.fecha, new Date().toISOString()
    ]]})
  });
}

async function updateCompra(c) {
  await sheetsReq(`/values/Compras!A${c.rowIndex}:F${c.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[
      c.id, c.ingrediente, c.cantidad, c.precioTotal, c.fecha, c.creadoEn
    ]]})
  });
}

async function deleteCompraRow(rowIndex) {
  if (!comprasSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'Compras');
    if (tab) comprasSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: comprasSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
}

function comprasForIngrediente(nombre) {
  const key = normalizeIngName(nombre);
  return compras.filter(c => normalizeIngName(c.ingrediente) === key);
}

function getLatestCompra(nombre) {
  const list = comprasForIngrediente(nombre);
  if (!list.length) return null;
  return list.slice().sort((a, b) => {
    const da = a.fecha || a.creadoEn || '';
    const db = b.fecha || b.creadoEn || '';
    if (da !== db) return da < db ? 1 : -1;
    return (a.creadoEn || '') < (b.creadoEn || '') ? 1 : -1;
  })[0];
}

function getUnitPrice(nombre) {
  const last = getLatestCompra(nombre);
  if (!last || !last.cantidad) return null;
  return last.precioTotal / last.cantidad;
}

export function computeCostoProduccion(etapasData) {
  let total = 0;
  const incompleto = [];
  (etapasData || []).forEach(stage => {
    (stage.insumosConfirmados || []).forEach(ins => {
      const qty = parseFloat(ins.cantidadReal) || 0;
      if (!qty) return;
      const price = getUnitPrice(ins.nombre);
      if (price == null) {
        if (!incompleto.includes(ins.nombre)) incompleto.push(ins.nombre);
        return;
      }
      total += qty * price;
    });
  });
  return { total, incompleto };
}

// ── Compras: UI ────────────────────────────────────────────────────────────────

function fmtDayMonthSlash(iso) {
  if (!iso) return '';
  const d = parseISODate(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Doble clic/doble toque en la fila → registrar una compra nueva de ese
// ingrediente (mismo destino que antes el botón 🛒). Mantener presionada la
// fila → editar o eliminar la última compra registrada (solo si existe una).
export function renderComprasList() {
  const container = document.getElementById('comprasList');
  if (!container) return;
  if (!ingredientes.length) {
    container.innerHTML = '<div class="empty-state">No hay ingredientes registrados todavía. Agrégalos desde Procesos → Ingredientes.</div>';
    return;
  }
  const sorted = [...ingredientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const rowsHTML = sorted.map(ing => {
    const last      = getLatestCompra(ing.nombre);
    const unitPrice = last && last.cantidad ? last.precioTotal / last.cantidad : null;
    return `
      <tr class="compra-row" data-ing="${esc(ing.nombre)}">
        <td>${esc(ing.nombre)}</td>
        <td>${last ? fmtDayMonthSlash(last.fecha) : '—'}</td>
        <td>${unitPrice != null ? `${fmtCOP(unitPrice)} / ${esc(ing.unidad || 'u')}` : 'Sin compras'}</td>
      </tr>
      <tr class="compra-row-actions" data-ing="${esc(ing.nombre)}">
        <td colspan="3">
          <div class="compra-row-actions-bar">
            <button type="button" data-edit-compra="${esc(ing.nombre)}">${ICON_EDIT} Editar</button>
            <button type="button" data-del-compra="${esc(ing.nombre)}">${ICON_TRASH} Eliminar</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="tasks-table compra-table">
      <thead><tr><th>Ingrediente</th><th>Última compra</th><th>Precio unitario</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
  `;

  container.querySelectorAll('[data-edit-compra]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const last = getLatestCompra(btn.dataset.editCompra);
      if (last) openCompraModal(null, last);
    });
  });
  container.querySelectorAll('[data-del-compra]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const last = getLatestCompra(btn.dataset.delCompra);
      if (!last) return;
      if (!confirm('¿Eliminar la última compra registrada de este ingrediente?')) return;
      btn.disabled = true;
      try {
        await deleteCompraRow(last.rowIndex);
        await loadCompras();
        renderComprasList();
      } catch (e) { alert('Error: ' + e.message); btn.disabled = false; }
    });
  });

  container.querySelectorAll('.compra-row').forEach(row => {
    const nombre = row.dataset.ing;
    let pressTimer  = null;
    let longPressed = false;
    const openActions = () => {
      container.querySelectorAll('.compra-row-actions.open').forEach(r => r.classList.remove('open'));
      if (getLatestCompra(nombre)) row.nextElementSibling?.classList.add('open');
    };
    const startPress = e => {
      if (e.target.closest('button')) return;
      longPressed = false;
      pressTimer = setTimeout(() => { longPressed = true; openActions(); }, 550);
    };
    const cancelPress = () => clearTimeout(pressTimer);

    row.addEventListener('mousedown', startPress);
    row.addEventListener('mouseup', cancelPress);
    row.addEventListener('mouseleave', cancelPress);
    row.addEventListener('touchstart', startPress, { passive: true });
    row.addEventListener('touchmove', cancelPress, { passive: true });
    row.addEventListener('click', e => {
      if (longPressed) { e.stopPropagation(); longPressed = false; }
    });

    row.addEventListener('dblclick', e => {
      if (e.target.closest('button')) return;
      openCompraModal(nombre);
    });
    row.addEventListener('touchend', e => {
      cancelPress();
      if (longPressed) { longPressed = false; return; }
      if (e.target.closest('button') || wasAccidentalTouch()) return;
      const now  = Date.now();
      const last = lastTapTime['compra_' + nombre] || 0;
      lastTapTime['compra_' + nombre] = now;
      if (now - last < 350) openCompraModal(nombre);
    });
  });
}

// Clic afuera cierra la barra de editar/eliminar abierta — registrado una
// sola vez a nivel de módulo (si fuera dentro de renderComprasList quedaría
// un listener nuevo apilado en cada re-render).
document.addEventListener('click', () => {
  document.querySelectorAll('.compra-row-actions.open').forEach(r => r.classList.remove('open'));
});

function updateCompraUnidadHint() {
  const nombre = document.getElementById('compraIngrediente').value.trim();
  const unidad = getIngredienteUnidad(nombre);
  document.getElementById('compraUnidadHint').textContent = unidad ? `· en ${unidad}` : '';
}

function updateCompraFechaTrigger() {
  const trigger = document.getElementById('compraFechaTrigger');
  const val     = document.getElementById('compraFecha').value;
  trigger.textContent = val ? fmtDateShortEs(val) : 'Elegir fecha…';
}

// nombrePrefill: atajo "registrar compra nueva de este ingrediente" (🛒 /
// doble clic en la fila) — ingrediente fijo, cantidad/precio/fecha en blanco.
// editCompra: edita esa compra puntual (la última de la fila, ver botón
// Editar del press-and-hold) — todos los campos prellenados y el guardado
// actualiza esa fila en vez de agregar una nueva.
function openCompraModal(nombrePrefill, editCompra) {
  document.getElementById('compraFeedback').textContent = '';
  clearFieldErrors('compraIngrediente', 'compraCantidad', 'compraPrecioTotal');
  const ingInput = document.getElementById('compraIngrediente');
  const nombre = editCompra ? editCompra.ingrediente : (nombrePrefill || '');
  ingInput.value    = nombre;
  ingInput.disabled = !!nombre;
  document.getElementById('compraCantidad').value    = editCompra ? formatThousandsValue(editCompra.cantidad) : '';
  document.getElementById('compraPrecioTotal').value = editCompra ? formatThousandsValue(editCompra.precioTotal) : '';
  document.getElementById('compraFecha').value = editCompra ? editCompra.fecha : toISODate(new Date());
  updateCompraFechaTrigger();
  updateCompraUnidadHint();
  document.getElementById('compraModalTitle').textContent = editCompra ? 'Editar compra' : 'Registrar compra';
  document.getElementById('btnSaveCompra').textContent    = editCompra ? 'Guardar cambios' : 'Guardar compra';
  compraEditRecord = editCompra || null;
  document.getElementById('compraOverlay').classList.add('open');
  if (!nombre) setTimeout(() => ingInput.focus(), 100);
}

attachIngredienteAutocomplete(document.getElementById('compraIngrediente'));
document.getElementById('compraIngrediente').addEventListener('input', updateCompraUnidadHint);
document.getElementById('compraIngrediente').addEventListener('change', updateCompraUnidadHint);

document.getElementById('compraFechaTrigger').addEventListener('click', () => {
  const fechaInput = document.getElementById('compraFecha');
  openCalendarPopover(document.getElementById('compraFechaTrigger'), {
    mode:  'single',
    start: fechaInput.value || toISODate(new Date()),
    end:   fechaInput.value || toISODate(new Date()),
    onApply: (start, end) => {
      fechaInput.value = end;
      updateCompraFechaTrigger();
    }
  });
});

function closeCompraModal() {
  document.getElementById('compraOverlay').classList.remove('open');
}
document.getElementById('btnCloseCompra').addEventListener('click', closeCompraModal);
document.getElementById('compraOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('compraOverlay')) closeCompraModal();
});
document.getElementById('btnSaveCompra').addEventListener('click', async () => {
  const ingInput     = document.getElementById('compraIngrediente');
  const nombre       = ingInput.value.trim();
  const cantidad     = parseThousandsInput(document.getElementById('compraCantidad').value);
  const precioTotal  = parseThousandsInput(document.getElementById('compraPrecioTotal').value);
  const fecha        = document.getElementById('compraFecha').value;
  const fb           = document.getElementById('compraFeedback');

  clearFieldErrors('compraIngrediente', 'compraCantidad', 'compraPrecioTotal');
  if (!nombre) { setFieldError('compraIngrediente', 'Indica el ingrediente.'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  const dup = findIngredienteDuplicate(nombre);
  if (!dup) { setFieldError('compraIngrediente', 'No está en la lista. Elígelo de las sugerencias o usa "+ Agregar".'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (!cantidad || cantidad <= 0) { setFieldError('compraCantidad', 'Debe ser mayor a 0.'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (!precioTotal || precioTotal <= 0) { setFieldError('compraPrecioTotal', 'Debe ser mayor a 0.'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (!fecha) return setFb(fb, 'Indica la fecha de compra.', 'err');

  const btn = document.getElementById('btnSaveCompra');
  const originalLabel = compraEditRecord ? 'Guardar cambios' : 'Guardar compra';
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    if (compraEditRecord) {
      await updateCompra({ ...compraEditRecord, ingrediente: dup.nombre, cantidad, precioTotal, fecha });
    } else {
      await appendCompra({ ingrediente: dup.nombre, cantidad, precioTotal, fecha });
    }
    await loadCompras();
    renderComprasList();
    closeCompraModal();
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = originalLabel;
  }
});

function openCompraHistorial(nombre) {
  comprasHistorialIng = nombre;
  document.getElementById('compraHistorialTitle').textContent = `Historial de compras — ${nombre}`;
  renderCompraHistorialList();
  document.getElementById('compraHistorialOverlay').classList.add('open');
}

function renderCompraHistorialList() {
  const container = document.getElementById('compraHistorialList');
  const list = comprasForIngrediente(comprasHistorialIng).slice().sort((a, b) => {
    const da = a.fecha || a.creadoEn || '', db = b.fecha || b.creadoEn || '';
    return da < db ? 1 : da > db ? -1 : 0;
  });
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">Sin compras registradas.</div>';
    return;
  }
  const unidad = getIngredienteUnidad(comprasHistorialIng) || 'u';
  container.innerHTML = list.map(c => `
    <div class="mgmt-item">
      <span class="mgmt-item-name">
        ${esc(fmtDateShortEs(c.fecha) || '—')} — ${c.cantidad} ${esc(unidad)} por ${fmtCOP(c.precioTotal)}
        <span class="mgmt-item-tag">${fmtCOP(c.cantidad ? c.precioTotal / c.cantidad : 0)}/${esc(unidad)}</span>
      </span>
      <button class="mgmt-item-del" data-del-compra="${c.rowIndex}">✕</button>
    </div>
  `).join('');
  container.querySelectorAll('[data-del-compra]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta compra?')) return;
      btn.disabled = true;
      try {
        await deleteCompraRow(+btn.dataset.delCompra);
        await loadCompras();
        renderCompraHistorialList();
        renderComprasList();
      } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
      }
    });
  });
}

document.getElementById('btnCloseCompraHistorial').addEventListener('click', () => {
  document.getElementById('compraHistorialOverlay').classList.remove('open');
});
document.getElementById('compraHistorialOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('compraHistorialOverlay')) {
    document.getElementById('compraHistorialOverlay').classList.remove('open');
  }
});

// ── Registrar nuevo insumo (solo nombre + unidad, agrega al catálogo de
// ingredientes) — la compra en sí (cantidad/precio) se registra después con
// doble clic en la fila de ese ingrediente. ────────────────────────────────
function closeInsumoModal() {
  document.getElementById('insumoOverlay').classList.remove('open');
}
document.getElementById('btnNewInsumo').addEventListener('click', () => {
  document.getElementById('insumoFeedback').textContent = '';
  clearFieldErrors('insumoNombre', 'insumoUnidad');
  document.getElementById('insumoNombre').value = '';
  document.getElementById('insumoUnidad').value = '';
  document.getElementById('insumoOverlay').classList.add('open');
  setTimeout(() => document.getElementById('insumoNombre').focus(), 100);
});
document.getElementById('btnCloseInsumo').addEventListener('click', closeInsumoModal);
document.getElementById('insumoOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('insumoOverlay')) closeInsumoModal();
});

document.getElementById('btnSaveInsumo').addEventListener('click', async () => {
  const nombre = document.getElementById('insumoNombre').value.trim();
  const unidad = document.getElementById('insumoUnidad').value.trim();
  const fb     = document.getElementById('insumoFeedback');

  clearFieldErrors('insumoNombre', 'insumoUnidad');
  if (!nombre) { setFieldError('insumoNombre', 'Indica el nombre.'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (findIngredienteDuplicate(nombre)) { setFieldError('insumoNombre', 'Ya hay un ingrediente con ese nombre.'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }
  if (!unidad) { setFieldError('insumoUnidad', 'Indica la unidad de medida.'); return setFb(fb, 'Revisa los campos marcados en rojo.', 'err'); }

  const btn = document.getElementById('btnSaveInsumo');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await appendIngrediente(nombre, unidad);
    await loadIngredientes();
    renderComprasList();
    closeInsumoModal();
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar insumo';
  }
});

