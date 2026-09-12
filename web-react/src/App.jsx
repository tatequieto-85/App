import { useState } from 'react';
import { motion } from 'framer-motion';
import Button from './components/ui/Button';
import Card from './components/ui/Card';
import { useAuth } from './hooks/useAuth';
import ComprasPage from './features/compras/ComprasPage';

// Ingredientes y Compras son una sola pantalla ahora (ver ComprasPage) — sin
// nav entre módulos todavía porque no hay un segundo módulo migrado. Vuelve
// cuando se migre el próximo (ver ./components/layout/NavBar.jsx).
export default function App() {
  const { checked, signedIn, signIn, signOut } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');

  if (!checked) return null;

  if (!signedIn) {
    return (
      <div className="app-shell" style={{ justifyContent: 'center', minHeight: '100vh' }}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <h1 className="section-title" style={{ marginBottom: 8 }}>TateApp — piloto React</h1>
            <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 16 }}>
              Conectate con la misma cuenta de Google que usás en la PWA para ver
              Ingredientes y Compras migrados.
            </p>
            <Button
              variant="primary"
              disabled={signingIn}
              onClick={async () => {
                setSigningIn(true);
                setAuthError('');
                try { await signIn(); } catch (e) { setAuthError(e.message); }
                setSigningIn(false);
              }}
            >
              {signingIn ? 'Conectando…' : 'Conectar con Google'}
            </Button>
            {authError && <div className="feedback err">{authError}</div>}
          </Card>
        </motion.div>
      </div>
    );
  }

  return <ComprasPage onBack={signOut} />;
}
