// Catálogo de módulos migrados para el grid de Home — cada módulo suma su
// entrada acá al migrarse. A diferencia de widgetRegistry.js, todos
// aparecen siempre (no es opt-in); lo único que el usuario elige es el
// orden (arrastrando, ver useOrderedIds.js). `color` es la misma paleta de
// .app-card-icon--* que ya usa la app vanilla en su home (ver index.html) —
// se reutilizan los mismos colores por módulo para que sea reconocible.
export const MODULE_REGISTRY = [
  { id: 'compras', label: 'Insumos', icon: 'cart', color: 'amber', screen: 'compras' },
  { id: 'stock', label: 'Stock', icon: 'box', color: 'slate', screen: 'stock' }
];
