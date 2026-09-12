import { useCallback, useRef, useState } from 'react';

// Equivalente a setFb() en ../../../utils.js: mensaje "ok"/"err" junto a un
// formulario, que se autolimpia a los 4.5s cuando es "ok".
export function useFeedback() {
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const timeoutRef = useRef(null);

  const show = useCallback((message, type) => {
    clearTimeout(timeoutRef.current);
    setFeedback({ message, type });
    if (type === 'ok') {
      timeoutRef.current = setTimeout(() => setFeedback({ message: '', type: '' }), 4500);
    }
  }, []);

  return [feedback, show];
}
