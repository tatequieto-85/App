import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import AppCard from '../../components/ui/AppCard';
import SortableGrid from '../../components/ui/SortableGrid';
import VersionBadge from '../../components/ui/VersionBadge';
import { useHomeWidgets } from '../../hooks/useHomeWidgets';
import { useOrderedIds } from '../../hooks/useOrderedIds';
import { useLongPressEmpty } from '../../hooks/useLongPressEmpty';
import { WIDGET_REGISTRY } from './widgetRegistry';
import { MODULE_REGISTRY } from './moduleRegistry';
import WidgetPicker from './WidgetPicker';
import '../../components/ui/Widget.css';
import './HomePage.css';

// Pantalla principal: arriba, los widgets que el usuario eligió agregar
// (nunca automático al migrar un módulo — ver useHomeWidgets.js); abajo, el
// grid con todos los módulos migrados, como el home de tarjetas de
// ../../../main.js. Ambos grids se pueden arrastrar para reordenar (ver
// components/ui/SortableGrid.jsx). Es adonde apunta la flecha de "volver" de
// cualquier pantalla (ver PageHeader). Sin título ni botón de cerrar sesión
// (a pedido del usuario, para no gastar espacio) — solo queda la versión.
export default function HomePage({ onNavigate }) {
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

  // Mantener presionado un espacio vacío del contenedor de widgets (no un
  // widget ya puesto) abre el selector para agregar uno — reemplaza al
  // tile "+" explícito.
  const emptySpaceProps = useLongPressEmpty({ onLongPress: () => setPickerOpen(true) });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: .18 }}
      className="app-shell"
    >
      <div className="home-header">
        <VersionBadge />
      </div>

      <div className="widgets-section" {...emptySpaceProps}>
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
        />
      </div>

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

      <WidgetPicker open={pickerOpen} onClose={() => setPickerOpen(false)} available={available} onPick={addWidget} />
    </motion.div>
  );
}
