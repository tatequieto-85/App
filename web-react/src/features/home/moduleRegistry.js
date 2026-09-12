// Catálogo de módulos migrados para el grid de Home — cada módulo suma su
// entrada acá al migrarse. A diferencia de widgetRegistry.js, todos
// aparecen siempre (no es opt-in); lo único que el usuario elige es el
// orden (arrastrando, ver useOrderedIds.js).
export const MODULE_REGISTRY = [
  { id: 'compras', label: 'Insumos', icon: 'cart', screen: 'compras' },
  { id: 'stock', label: 'Stock', icon: 'box', screen: 'stock' }
];
