import { useCallback, useState } from 'react';

const STORAGE_KEY = 'ss_home_widgets';

function loadRegistered() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(ids) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* localStorage no disponible */ }
}

// Qué widgets están registrados en Home — a pedido del usuario, solo se
// muestran los que él mismo agregó (nunca automático por migrar un módulo).
// Persistido en localStorage: es una preferencia de este navegador/celular,
// no un dato de negocio que tenga que vivir en la Sheet.
export function useHomeWidgets() {
  const [registeredIds, setRegisteredIds] = useState(loadRegistered);

  const addWidget = useCallback(id => {
    setRegisteredIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      save(next);
      return next;
    });
  }, []);

  const removeWidget = useCallback(id => {
    setRegisteredIds(prev => {
      const next = prev.filter(x => x !== id);
      save(next);
      return next;
    });
  }, []);

  return { registeredIds, addWidget, removeWidget };
}
