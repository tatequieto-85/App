import ComprasWidget from '../compras/ComprasWidget';
import StockWidget from '../stock/StockWidget';
import ContactosWidget from '../contactos/ContactosWidget';
import VentasWidget from '../ventas/VentasWidget';

// Catálogo de widgets disponibles para agregar a Home. Cada módulo migrado
// suma su entrada acá — `span` (1, 2 o 3 de las 3 columnas del grid) y qué
// hace/muestra cada uno se definen junto con el usuario al migrar ese
// módulo (ver memoria del piloto), no se deciden solos.
export const WIDGET_REGISTRY = [
  { id: 'compras', label: 'Insumos', icon: 'cart', span: 1, Component: ComprasWidget },
  { id: 'stock', label: 'Stock', icon: 'box', span: 1, Component: StockWidget },
  { id: 'contactos', label: 'Contactos', icon: 'user', span: 1, Component: ContactosWidget },
  { id: 'ventas', label: 'Ventas', icon: 'flag', span: 1, Component: VentasWidget }
];
