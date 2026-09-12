import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from './components/ui/Button';
import Card from './components/ui/Card';
import NavBar from './components/layout/NavBar';
import { useAuth } from './hooks/useAuth';
import IngredientesPage from './features/ingredientes/IngredientesPage';
import ComprasPage from './features/compras/ComprasPage';

const PAGES = { ingredientes: IngredientesPage, compras: ComprasPage };

export default function App() {
  const { checked, signedIn, signIn } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');
  const [page, setPage] = useState('ingredientes');

  if (!checked) return null;

  if (!signedIn) {
    return (
      <div className="app-shell" style={{ justifyContent: 'center', minHeight: '100vh' }}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <h1 className="section-title" style={{ marginBottom: 8 }}>TateApp — piloto React</h1>
            <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 16 }}>
              Conectate con la misma cuenta de Google que usás en la PWA para ver
              los módulos de Ingredientes y Compras migrados.
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

  const Page = PAGES[page];
  return (
    <>
      <NavBar page={page} onChange={setPage} />
      <AnimatePresence mode="wait">
        <Page key={page} />
      </AnimatePresence>
    </>
  );
}
