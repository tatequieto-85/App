import { useCallback, useEffect, useState } from 'react';

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

function sameIds(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

// Orden persistido (localStorage) de un conjunto de ids — todos los
// `allIds` siempre están, solo cambia el orden. Lo usa el grid de
// Módulos/Widgets de Home (lista fija por sesión) y la tabla de Insumos
// en Inventario (a pedido explícito del usuario, "organizar los insumos
// a voluntad") — a diferencia de Home, el catálogo de Insumos cambia en
// vivo (se agrega/borra un ingrediente sin recargar la página), así que
// además del cálculo inicial esto resincroniza cuando `allIds` cambia
// después del primer render: conserva el orden ya guardado para los que
// siguen existiendo, agrega los nuevos al final, saca los que ya no están.
export function useOrderedIds(storageKey, allIds) {
  const [order, setOrder] = useState(() => {
    const saved = load(storageKey, []);
    const validSaved = saved.filter(id => allIds.includes(id));
    const missing = allIds.filter(id => !validSaved.includes(id));
    return [...validSaved, ...missing];
  });
  useEffect(() => {
    if (!allIds.length) return;
    setOrder(current => {
      // Si `allIds` todavía estaba vacío en el primer render (datos que
      // cargan async, a diferencia de la lista estática de Home) el
      // useState de arriba calculó order=[] porque no tenía nada contra
      // qué mezclar el guardado. Bug real encontrado probando esto: un
      // `useRef` para recordar "ya sincronicé una vez" no sirve acá —
      // React StrictMode corre este efecto dos veces seguidas en
      // desarrollo, y la mutación del ref persistía entre esas dos
      // corridas aunque la actualización de estado de la primera no
      // llegara a aplicarse, dejando la segunda corrida (la que sí
      // cuenta) creyendo que ya había sincronizado cuando en realidad
      // partía de `current=[]` igual que la primera. En vez de un flag
      // con memoria propia, derivar todo de `current` en cada corrida (sin
      // importar cuántas veces se repita, da el mismo resultado): si
      // `current` ya comparte algún id con `allIds`, ya hubo una
      // sincronización real antes y se parte de ahí (conserva arrastres
      // de esta sesión); si no, se vuelve a leer lo guardado.
      const yaSincronizado = current.some(id => allIds.includes(id));
      const base = yaSincronizado ? current : load(storageKey, []);
      const stillValid = base.filter(id => allIds.includes(id));
      const missing = allIds.filter(id => !stillValid.includes(id));
      const next = [...stillValid, ...missing];
      return sameIds(next, current) ? current : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allIds.join('\u0000')]);

  const reorder = useCallback(next => {
    setOrder(next);
    save(storageKey, next);
  }, [storageKey]);

  return [order, reorder];
}
