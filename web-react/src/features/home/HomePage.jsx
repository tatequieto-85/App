import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import AppCard from '../../components/ui/AppCard';
import Icon from '../../components/icons/Icon';
import SortableGrid from '../../components/ui/SortableGrid';
import { useHomeWidgets } from '../../hooks/useHomeWidgets';
import { useOrderedIds } from '../../hooks/useOrderedIds';
import { WIDGET_REGISTRY } from './widgetRegistry';
import { MODULE_REGISTRY } from './moduleRegistry';
import WidgetPicker from './WidgetPicker';
import '../../components/ui/Widget.css';

// Pantalla principal: arriba, los widgets que el usuario eligió agregar
// (nunca automático al migrar un módulo — ver useHomeWidgets.js); abajo, el
// grid con todos los módulos migrados, como el home de tarjetas de
// ../../../main.js. Ambos grids se pueden arrastrar para reordenar (ver
// components/ui/SortableGrid.jsx). Es adonde apunta la flecha de "volver" de
// cualquier pantalla (ver PageHeader) — cerrar sesión vive acá.
export default function HomePage({ onNavigate, onSignOut }) {
  const { registeredIds, addWidget, removeWidget, reorderWidgets } = useHomeWidgets();
  const [moduleOrder, reorderModules] = useOrderedIds('ss_home_modules', MODULE_REGISTRY.map(m => m.id));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    function handleDocClick(e) {
      if (!e.target.closest('.widget')) setRemovingId(null);
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

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
        <h2 className="subsection-title">Widgets</h2>
        <SortableGrid
          className="widgets-grid"
          ids={registeredIds}
          onReorder={reorderWidgets}
          getSpan={id => WIDGET_REGISTRY.find(w => w.id === id)?.span || 1}
          renderItem={id => {
            const w = WIDGET_REGISTRY.find(x => x.id === id);
            if (!w) return null;
            return (
              <w.Component
                onNavigate={onNavigate}
                removing={removingId === id}
                onRequestRemove={() => setRemovingId(id)}
                onConfirmRemove={() => { removeWidget(id); setRemovingId(null); }}
              />
            );
          }}
          trailing={
            <button type="button" className="widget-add" onClick={() => setPickerOpen(true)}>
              <Icon name="plus" size={18} />
              <span className="widget-add-label">Agregar</span>
            </button>
          }
        />
      </section>

      <section>
        <h2 className="subsection-title">Módulos</h2>
        <SortableGrid
          className="home-grid"
          ids={moduleOrder}
          onReorder={reorderModules}
          renderItem={id => {
            const m = MODULE_REGISTRY.find(x => x.id === id);
            if (!m) return null;
            return <AppCard icon={m.icon} label={m.label} onClick={() => onNavigate(m.screen)} />;
          }}
        />
      </section>

      <WidgetPicker open={pickerOpen} onClose={() => setPickerOpen(false)} available={available} onPick={addWidget} />
    </motion.div>
  );
}
