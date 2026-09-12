import { motion } from 'framer-motion';
import AppCard from '../../components/ui/AppCard';
import ComprasWidget from '../compras/ComprasWidget';
import StockWidget from '../stock/StockWidget';
import './HomePage.css';

// Pantalla principal: arriba, un resumen ("widget") de cada módulo migrado;
// abajo, el grid con todos los módulos, como el home de tarjetas de
// ../../../main.js. Es adonde apunta la flecha de "volver" de cualquier
// pantalla (ver PageHeader) — cerrar sesión ahora vive acá, no en esa flecha.
export default function HomePage({ onNavigate, onSignOut }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <div className="home-header">
        <div>
          <h1 className="home-title">TateApp</h1>
          <p className="home-sub">Piloto React</p>
        </div>
        <button type="button" className="btn btn--link home-signout" onClick={onSignOut}>Cerrar sesión</button>
      </div>

      <section>
        <h2 className="home-section-title">Widgets</h2>
        <div className="widgets-stack">
          <ComprasWidget onClick={() => onNavigate('compras')} />
          <StockWidget onClick={() => onNavigate('stock')} />
        </div>
      </section>

      <section>
        <h2 className="home-section-title">Módulos</h2>
        <div className="home-grid">
          <AppCard icon="cart" label="Ingredientes y compras" onClick={() => onNavigate('compras')} />
          <AppCard icon="box" label="Stock" onClick={() => onNavigate('stock')} />
        </div>
      </section>
    </motion.div>
  );
}
