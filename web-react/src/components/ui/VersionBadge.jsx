import { useState } from 'react';
import { useRowGestures } from '../../hooks/useRowGestures';
import { APP_VERSION } from '../../version';
import './VersionBadge.css';

// Mantener presionada fuerza a buscar una actualización: recarga la página
// con un parámetro nuevo en la URL para evitar la caché de 10 minutos de
// GitHub Pages (mismo truco que veníamos pidiéndole al usuario a mano con
// "?v=N"), en vez de un simple location.reload() que podría servir la
// versión cacheada de todos modos.
export default function VersionBadge() {
  const [checking, setChecking] = useState(false);
  const gestureProps = useRowGestures({
    onLongPress: () => {
      setChecking(true);
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('t', Date.now().toString());
        window.location.href = url.toString();
      }, 350);
    }
  });

  return (
    <span className="version-badge" {...gestureProps}>
      {checking ? 'Buscando…' : `v${APP_VERSION}`}
    </span>
  );
}
