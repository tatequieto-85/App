// ── Undo (Ctrl+Z) ─────────────────────────────────────────────────────────────

let undoStack = [];

export function pushUndo(undoFn) {
  undoStack.push(undoFn);
  if (undoStack.length > 20) undoStack.shift();
}

export async function undoLastAction() {
  const fn = undoStack.pop();
  if (!fn) return;
  try { await fn(); } catch (e) { console.error('Error al deshacer:', e); }
}

document.addEventListener('keydown', e => {
  const tag        = (e.target.tagName || '').toLowerCase();
  const isEditable = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    if (isEditable) return; // dejar el undo nativo de texto en campos editables
    e.preventDefault();
    undoLastAction();
  }
});
