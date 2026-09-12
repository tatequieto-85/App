import './Tabs.css';

// Sub-pestañas genéricas dentro de un módulo (p. ej. Resumen/Trazabilidad/
// Producto testigo en Stock) — mismo patrón visual que .sub-tab-btn en la
// app vanilla. tabs: [{ id, label }].
export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs-bar">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          className={`tabs-btn${active === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
