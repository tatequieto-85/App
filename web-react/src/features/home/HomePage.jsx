import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import AppCard from '../../components/ui/AppCard';
import Icon from '../../components/icons/Icon';
import '../../components/ui/Widget.css';
import { useHomeWidgets } from '../../hooks/useHomeWidgets';
import { WIDGET_REGISTRY } from './widgetRegistry';
import WidgetPicker from './WidgetPicker';
import './HomePage.css';

// Pantalla principal: arriba, los widgets que el usuario eligió agregar
// (nunca automático al migrar un módulo — ver useHomeWidgets.js); abajo, el
// grid con todos los módulos migrados, como el home de tarjetas de
// ../../../main.js. Es adonde apunta la flecha de "volver" de cualquier
// pantalla (ver PageHeader) — cerrar sesión vive acá, no en esa flecha.
export default function HomePage({ onNavigate, onSignOut }) {
  const { registeredIds, addWidget, removeWidget } = useHomeWidgets();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    function handleDocClick(e) {
      if (!e.target.closest('.widget')) setRemovingId(null);
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  const registered = registeredIds
    .map(id => WIDGET_REGISTRY.find(w => w.id === id))
    .filter(Boolean);
  const available = WIDGET_REGISTRY.filter(w => !registeredIds.includes(w.id));

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
        <div className="widgets-grid">
          {registered.map(w => (
            <w.Component
              key={w.id}
              onNavigate={onNavigate}
              removing={removingId === w.id}
              onRequestRemove={() => setRemovingId(w.id)}
              onConfirmRemove={() => { removeWidget(w.id); setRemovingId(null); }}
            />
          ))}
          <button type="button" className="widget-add" onClick={() => setPickerOpen(true)}>
            <Icon name="plus" size={18} />
            <span className="widget-add-label">Agregar</span>
          </button>
        </div>
      </section>

      <section>
        <h2 className="home-section-title">Módulos</h2>
        <div className="home-grid">
          <AppCard icon="cart" label="Insumos" onClick={() => onNavigate('compras')} />
          <AppCard icon="box" label="Stock" onClick={() => onNavigate('stock')} />
        </div>
      </section>

      <WidgetPicker open={pickerOpen} onClose={() => setPickerOpen(false)} available={available} onPick={addWidget} />
    </motion.div>
  );
}
