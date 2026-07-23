import { sheetsReq } from './auth.js';
import { esc, setFb, confirmCloseIfDirty } from './utils.js';

export let ingredientes = [];
let ingredientesSheetId = null;

// ── Ingredientes: Sheet CRUD ──────────────────────────────────────────────────

export async function initIngredientesSheet() {
  const info = await sheetsReq('');
  const tabs = info.sheets || [];
  const hasI = tabs.find(s => s.properties.title === 'Ingredientes');

  if (hasI) {
    ingredientesSheetId = hasI.properties.sheetId;
  } else {
    const res = await sheetsReq(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Ingredientes' } } }] })
    });
    const added = res.replies?.[0]?.addSheet?.properties;
    if (added) ingredientesSheetId = added.sheetId;
    await sheetsReq('/values/Ingredientes!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      method: 'POST',
      body: JSON.stringify({ values: [['ID', 'Nombre', 'CreadoEn', 'Unidad']] })
    });
  }
  await loadIngredientes();
}

export async function loadIngredientes() {
  const data = await sheetsReq('/values/Ingredientes!A:D');
  const rows = (data.values || []).slice(1);
  ingredientes = rows.filter(r => r[0]).map((r, i) => ({
    id:       r[0] || '',
    nombre:   r[1] || '',
    creadoEn: r[2] || '',
    unidad:   r[3] || '',
    rowIndex: i + 2
  }));
}

export async function appendIngrediente(nombre, unidad) {
  await sheetsReq('/values/Ingredientes!A:D:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    body: JSON.stringify({ values: [[crypto.randomUUID(), nombre, new Date().toISOString(), unidad || '']] })
  });
}

export async function updateIngrediente(ing) {
  await sheetsReq(`/values/Ingredientes!A${ing.rowIndex}:D${ing.rowIndex}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[ing.id, ing.nombre, ing.creadoEn, ing.unidad || '']] })
  });
}

export function getIngredienteUnidad(nombre) {
  const found = findIngredienteDuplicate(nombre);
  return found?.unidad || '';
}

export async function deleteIngredienteRow(rowIndex) {
  if (!ingredientesSheetId) {
    const info = await sheetsReq('');
    const tab  = info.sheets.find(s => s.properties.title === 'Ingredientes');
    if (tab) ingredientesSheetId = tab.properties.sheetId;
  }
  await sheetsReq(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: {
      range: { sheetId: ingredientesSheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
    }}]})
  });
}

// ── Ingredientes: Normalización y duplicados ──────────────────────────────────

export function normalizeIngName(name) {
  return (name || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/s$/, '');
}

export function findIngredienteDuplicate(nombre) {
  const norm = normalizeIngName(nombre);
  return ingredientes.find(ing => normalizeIngName(ing.nombre) === norm) || null;
}

export async function tryAddIngrediente(nombre, unidad) {
  const trimmed = nombre.trim();
  if (!trimmed) return null;
  const dup = findIngredienteDuplicate(trimmed);
  if (dup) return dup.nombre;
  try {
    await appendIngrediente(trimmed, unidad);
    await loadIngredientes();
    return trimmed;
  } catch (e) {
    console.warn('tryAddIngrediente:', e.message);
    return trimmed;
  }
}

// ── Ingredientes: Autocomplete ────────────────────────────────────────────────

export function attachIngredienteAutocomplete(input) {
  let dropdown = null;

  function removeDropdown() {
    if (dropdown) { dropdown.remove(); dropdown = null; }
  }

  function positionDropdown() {
    if (!dropdown) return;
    const rect = input.getBoundingClientRect();
    dropdown.style.top  = (rect.bottom + window.scrollY + 2) + 'px';
    dropdown.style.left = (rect.left + window.scrollX) + 'px';
    dropdown.style.width = Math.max(rect.width, 200) + 'px';
  }

  function showDropdown() {
    removeDropdown();
    const val = input.value.trim();
    if (!val) return;

    const lower = val.toLowerCase();
    const matches = ingredientes.filter(ing => ing.nombre.toLowerCase().includes(lower));
    const exactMatch = !!findIngredienteDuplicate(val);

    if (!matches.length && (exactMatch || val.length < 2)) return;

    dropdown = document.createElement('div');
    dropdown.className = 'ingrediente-autocomplete';

    matches.forEach(ing => {
      const opt = document.createElement('div');
      opt.className = 'autocomplete-option';
      opt.textContent = ing.nombre;
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = ing.nombre;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        removeDropdown();
      });
      dropdown.appendChild(opt);
    });

    if (!exactMatch && val.length >= 2) {
      const addOpt = document.createElement('div');
      addOpt.className = 'autocomplete-option autocomplete-add';
      addOpt.innerHTML = `+ Agregar "<strong>${esc(val)}</strong>"`;
      addOpt.addEventListener('mousedown', async e => {
        e.preventDefault();
        const unidad = prompt(`¿Unidad de medida para "${val}"? (g, kg, L, unidades…)`, '') || '';
        const result = await tryAddIngrediente(val, unidad.trim());
        if (result) input.value = result;
        removeDropdown();
      });
      dropdown.appendChild(addOpt);
    }

    document.body.appendChild(dropdown);
    positionDropdown();
  }

  input.addEventListener('input', showDropdown);
  input.addEventListener('focus', showDropdown);
  input.addEventListener('blur', () => setTimeout(removeDropdown, 180));
  window.addEventListener('scroll', removeDropdown, { passive: true, capture: true });
}

// ── Ingredientes: Modal ───────────────────────────────────────────────────────

export function openIngredientesModal(firstTime) {
  document.getElementById('ingredientesModalTitle').textContent =
    firstTime ? 'Configurar ingredientes' : 'Gestionar ingredientes';
  document.getElementById('ingredientesFeedback').textContent = '';
  document.getElementById('nuevoIngrediente').value = '';
  renderIngredientesList();
  document.getElementById('ingredientesOverlay').classList.add('open');
}

function renderIngredientesList() {
  const container = document.getElementById('ingredientesList');
  if (!ingredientes.length) {
    container.innerHTML = '<div class="empty-state">No hay ingredientes registrados. Agrega el primero.</div>';
    return;
  }
  const sorted = [...ingredientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  container.innerHTML = sorted.map(ing => `
    <div class="mgmt-item">
      <span class="mgmt-item-name">${esc(ing.nombre)}</span>
      <input class="field-input mgmt-item-unidad" type="text" value="${esc(ing.unidad || '')}" placeholder="Unidad" data-row="${ing.rowIndex}" />
      <button class="mgmt-item-del" data-del-ing="${ing.rowIndex}">✕</button>
    </div>
  `).join('');
  container.querySelectorAll('.mgmt-item-unidad').forEach(inp => {
    inp.addEventListener('change', async () => {
      const ing = ingredientes.find(i => i.rowIndex === +inp.dataset.row);
      if (!ing) return;
      inp.disabled = true;
      try {
        await updateIngrediente({ ...ing, unidad: inp.value.trim() });
        await loadIngredientes();
        setFb(document.getElementById('ingredientesFeedback'), '✅ Unidad actualizada.', 'ok');
      } catch (e) {
        setFb(document.getElementById('ingredientesFeedback'), 'Error: ' + e.message, 'err');
      } finally {
        inp.disabled = false;
      }
    });
  });
  container.querySelectorAll('[data-del-ing]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = +btn.dataset.delIng;
      const ing = ingredientes.find(i => i.rowIndex === row);
      if (!confirm(`¿Eliminar "${ing?.nombre}"?`)) return;
      btn.disabled = true;
      try {
        await deleteIngredienteRow(row);
        await loadIngredientes();
        renderIngredientesList();
        setFb(document.getElementById('ingredientesFeedback'), '✅ Ingrediente eliminado.', 'ok');
      } catch (e) {
        setFb(document.getElementById('ingredientesFeedback'), 'Error: ' + e.message, 'err');
        btn.disabled = false;
      }
    });
  });
}

function isIngredientesFormDirty() {
  return !!document.getElementById('nuevoIngrediente')?.value.trim();
}

function closeIngredientesModal() {
  confirmCloseIfDirty('ingredientesOverlay', isIngredientesFormDirty);
}

document.getElementById('btnCloseIngredientes').addEventListener('click', closeIngredientesModal);
document.getElementById('ingredientesOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('ingredientesOverlay')) closeIngredientesModal();
});

document.getElementById('btnManageIngredientes').addEventListener('click', () => openIngredientesModal(false));

document.getElementById('btnAddIngrediente').addEventListener('click', async () => {
  const input       = document.getElementById('nuevoIngrediente');
  const unidadInput = document.getElementById('nuevoIngredienteUnidad');
  const nombre      = input.value.trim();
  const unidad      = unidadInput.value.trim();
  const fb = document.getElementById('ingredientesFeedback');
  if (!nombre) return setFb(fb, 'Escribe el nombre del ingrediente.', 'err');
  if (!unidad) return setFb(fb, 'Indica la unidad de medida (g, kg, L…).', 'err');

  const dup = findIngredienteDuplicate(nombre);
  if (dup) return setFb(fb, `Ya existe "${dup.nombre}" (similar a "${nombre}").`, 'err');

  const btn = document.getElementById('btnAddIngrediente');
  btn.disabled = true;
  try {
    await appendIngrediente(nombre, unidad);
    await loadIngredientes();
    renderIngredientesList();
    input.value = '';
    unidadInput.value = '';
    setFb(fb, `✅ "${nombre}" agregado.`, 'ok');
  } catch (e) {
    setFb(fb, 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('nuevoIngrediente').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnAddIngrediente').click();
});
