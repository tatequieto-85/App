import { useCallback, useEffect, useState } from 'react';
import * as googleAuth from '../services/googleAuth';

// Separa el estado de sesión (¿hay token válido?) de la pantalla de login —
// equivalente reactivo a initAuth()/requestSignIn() en ../../../auth.js.
export function useAuth() {
  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(googleAuth.isSignedIn());
    setChecked(true);
  }, []);

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
