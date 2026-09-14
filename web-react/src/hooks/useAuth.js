import { useCallback, useEffect, useState } from 'react';
import * as googleAuth from '../services/googleAuth';

const REFRESH_CHECK_MS = 5 * 60 * 1000;

// Separa el estado de sesión (¿hay token válido?) de la pantalla de login —
// equivalente reactivo a initAuth()/requestSignIn() en ../../../auth.js.
export function useAuth() {
  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    (async () => {
      if (googleAuth.isSignedIn()) {
        setSignedIn(true);
      } else if (googleAuth.hasSignedInBefore()) {
        // El token guardado venció, pero ya había dado permiso antes — se
        // intenta renovar solo (sin el popup de consentimiento completo)
        // antes de mandarlo a la pantalla de "Conectar con Google". Esto es
        // lo que antes obligaba a loguearse de nuevo cada vez que pasaba
        // más de ~1h entre usos.
        try {
          await googleAuth.signIn({ silent: true });
          setSignedIn(true);
        } catch {
          setSignedIn(false);
        }
      }
      setChecked(true);
    })();
  }, []);

  // Mientras la sesión sigue abierta, renueva el token ANTES de que venza
  // en vez de esperar a que una request falle — así, si se usa la app de
  // corrido por más de una hora, nunca se llega a notar el vencimiento.
  useEffect(() => {
    if (!signedIn) return;
    const interval = setInterval(() => { googleAuth.refreshIfNeeded(); }, REFRESH_CHECK_MS);
    return () => clearInterval(interval);
  }, [signedIn]);

  const signIn = useCallback(async () => {
    await googleAuth.signIn();
    setSignedIn(true);
  }, []);

  const signOut = useCallback(() => {
    googleAuth.signOut();
    setSignedIn(false);
  }, []);

  return { checked, signedIn, signIn, signOut };
}
