import { useCallback, useState } from 'react';

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, ids) {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* localStorage no disponible */ }
}

// Orden persistido (localStorage) de un conjunto fijo de ids — a diferencia
// de useHomeWidgets.js (que también decide cuáles se muestran), acá todos
// los `allIds` siempre están, solo cambia el orden. Lo usa el grid de
// Módulos de Home. Si `allIds` suma uno nuevo (se migró otro módulo), se
// agrega al final sin pisar el orden ya guardado.
export function useOrderedIds(storageKey, allIds) {
  const [order, setOrder] = useState(() => {
    const saved = load(storageKey, []);
    const validSaved = saved.filter(id => allIds.includes(id));
    const missing = allIds.filter(id => !validSaved.includes(id));
    return [...validSaved, ...missing];
  });

  const reorder = useCallback(next => {
    setOrder(next);
    save(storageKey, next);
  }, [storageKey]);

  return [order, reorder];
}
