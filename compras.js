import { sheetsReq } from './auth.js';
import { esc, setFb, setFieldError, clearFieldErrors, fmtDate, fmtDateShortEs, fmtCOP, toISODate, liveValidate } from './utils.js';
import { ingredientes, findIngredienteDuplicate, getIngredienteUnidad, normalizeIngName, attachIngredienteAutocomplete } from './ingredientes.js';
import { openCalendarPopover } from './tareas.js';

let compras             = [];
let comprasSheetId      = null;
let comprasHistorialIng = null;

liveValidate('compraIngrediente', v => v.trim() ? '' : 'Indica el ingrediente.');
liveValidate('compraCantidad', v => (parseFloat(v) > 0) ? '' : 'Debe ser mayor a 0.');
liveValidate('compraPrecioTotal', v => (parseFloat(v) > 0) ? '' : 'Debe ser mayor a 0.');

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
      <tr>
        <td>${esc(ing.nombre)}</td>
        <td>${esc(ing.unidad || '—')}</td>
        <td>${unitPrice != null ? `${fmtCOP(unitPrice)} / ${esc(ing.unidad || 'u')}` : 'Sin compras'}</td>
        <td>${last ? (fmtDateShortEs(last.fecha) || fmtDate(last.creadoEn)) : '—'}</td>
        <td style="white-space:nowrap">
          <button class="task-action-btn" data-add-compra="${esc(ing.nombre)}" title="Registrar compra">🛒</button>
          ${last ? `<button class="task-action-btn" data-historial="${esc(ing.nombre)}" title="Ver historial">📜</button>` : ''}
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="tasks-table">
      <thead><tr><th>Ingrediente</th><th>Unidad</th><th>Último precio</th><th>Última compra</th><th></th></tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
  `;

  container.querySelectorAll('[data-add-compra]').forEach(btn => {
    btn.addEventListener('click', () => openCompraModal(btn.dataset.addCompra));
  });
  container.querySelectorAll('[data-historial]').forEach(btn => {
    btn.addEventListener('click', () => openCompraHistorial(btn.dataset.historial));
  });
}

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

function openCompraModal(nombrePrefill) {
  document.getElementById('compraFeedback').textContent = '';
  clearFieldErrors('compraIngrediente', 'compraCantidad', 'compraPrecioTotal');
  const ingInput = document.getElementById('compraIngrediente');
  ingInput.value    = nombrePrefill || '';
  ingInput.disabled = !!nombrePrefill;
  document.getElementById('compraCantidad').value    = '';
  document.getElementById('compraPrecioTotal').value = '';
  document.getElementById('compraFecha').value = toISODate(new Date());
  updateCompraFechaTrigger();
  updateCompraUnidadHint();
  document.getElementById('compraOverlay').classList.add('open');
  if (!nombrePrefill) setTimeout(() => ingInput.focus(), 100);
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
document.getElementById('btnNewCompra').addEventListener('click', () => openCompraModal(null));

document.getElementById('btnSaveCompra').addEventListener('click', async () => {
  const ingInput     = document.getElementById('compraIngrediente');
  const nombre       = ingInput.value.trim();
  const cantidad     = parseFloat(document.getElementById('compraCantidad').value);
  const precioTotal  = parseFloat(document.getElementById('compraPrecioTotal').value);
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
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await appendCompra({ ingrediente: dup.nombre, cantidad, precioTotal, fecha });
    await loadCompras();
    renderComprasList();
    closeCompraModal();
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar compra';
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

