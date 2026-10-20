# TATEAPP — mapa de módulos

PWA de producción de salsas (TateQuieto), en React + Vite (`web-react/`). Backend: Google Sheets (datos) + Google Drive (archivos) vía OAuth con Google Identity Services + un Worker de Cloudflare propio (`worker/`) para sesión persistente (refresh_token fuera del navegador).

La app vanilla original (JS sin bundler, un script por módulo en la raíz del repo) se eliminó el 2026-10-06 una vez decidido seguir solo con el piloto de React — ver abajo qué módulos todavía no tienen equivalente en React.

Cuando el usuario pida un cambio en un módulo específico, ir directo a su carpeta en `web-react/src/features/` — no hace falta leer los demás.

## Cómo se despliega

Build de producción publicado en `home/` (raíz del repo) y servido por GitHub Pages en `https://tatequieto-85.github.io/App/home/`, sin workflow de Actions propio (Pages sirve la rama `main` directo). En cada cambio:
1. `cd web-react && MSYS_NO_PATHCONV=1 npx vite build --base=/App/home/` (el `MSYS_NO_PATHCONV=1` es necesario en Git Bash de Windows).
2. `rm -rf home/assets && cp -r web-react/dist/* home/` desde la raíz del repo.
3. Subir `APP_VERSION` en `web-react/src/version.js` junto con `"version"` en `web-react/package.json`.
4. `git add home/ web-react/` (nunca `git add -A` — hay archivos sueltos no relacionados, `.claude/`/`icon.png`, que no deben subirse).
5. Commit + push a `main`, esperar el deploy (~30s-2min) y confirmar con `curl` antes de avisarle al usuario.

## Módulos migrados (uno por tarjeta del home)

| Módulo (como lo nombra el usuario) | Carpeta en `web-react/src/features/` | Qué contiene |
|---|---|---|
| Inventario (antes "Insumos") | `compras/`, `ingredientes/` | Dos secciones separadas por línea sutil: **Insumos** (Ingredientes+Compras — incluye materia prima como envases/etiquetas/tapas con Categoría/Mínimo opcionales en el mismo catálogo, stock corriente que compras suma y ejecuciones descuentan; tabla Ingrediente/Precio unitario/Disponible, separada en "Por peso/volumen" y "Por unidad" — mismo criterio que Procesos; acción "Editar insumo" para corregir nombre/unidad/categoría/mínimo, que migra en cascada Compras y Recetas si el nombre cambia — ver `renameIngredienteEnCompras`/`renameIngredienteEnRecetas`; acción "Ajustar stock" para sumar/restar el stock a mano, sin pasar por una compra ni una ejecución, a pedido explícito del usuario), **Inventario de activos** (herramientas/maquinaria/equipos — estado/responsable) |
| Stock | `stock/` | Resumen de inventario, trazabilidad por lote (230/130 ml), producto testigo, widget de Home |
| Contactos | `contactos/` | Cumpleaños (día/mes, edad calculada en vivo), empresa/posición, teléfono/WhatsApp, vínculos muchos-a-muchos con categoría libre |
| Ventas | `ventas/` | Canales de venta (galería tipo Módulos) → ferias/eventos con plan de stock por lote, conteo de personas, muestras, resumen. Las ventas NO se registran una por una (rechazado explícito por el usuario) — al "Terminar feria" se cargan por DÍA (otro pedido explícito): por cada día de la feria, unidades vendidas por lote (tope compartido entre días y descontando muestras — no se puede superar lo llevado total) + cuánto se recibió ESE día en CADA caja de Contabilidad (efectivo, Nequi, etc. — tercer pedido explícito: "indicar cuánto recibió en efectivo y cuánto en las otras cajas"); el promedio por unidad sale de dividir el acumulado entre las unidades vendidas (nunca se guarda aparte, ver `feriaPromedioUnidad`/`feriaTotalVendidoDinero`/`ventaDiariaTotal` en `feriasApi.js`, que suman `ventasDiarias[].porCaja`). El resumen de una feria ya terminada (`FeriaResumenModal.jsx`) ya no muestra "Conteo de productos" (se sacó a pedido explícito) y sí deja seguir agregando observaciones ahí mismo (antes solo se podía mientras estaba en curso, desde el contador). Una 4ta tarjeta fija en la galería, "Calculadora" (`CalculadoraPage.jsx`), NO es un canal real (no vive en CanalesVenta) — a pedido explícito del usuario, deja elegir varias recetas con cuántas unidades finales de cada una se quieren producir y calcula el costo de insumos combinado (según el último precio de Compras), escalando cada receta por su `unidadesPorLote` (ver próxima fila, Procesos) — no guarda nada, es una calculadora de verdad; la tabla de costo por insumo también muestra el % de gasto de cada fila sobre el total y, restando el stock corriente de Ingredientes, un segundo total de "Falta comprar" en dinero; si ya hay unidades de ese sabor sin vender (stock de producto terminado, vía `getStockDisponibleGeneral`), lo aclara y calcula el costo solo de lo que falta producir; una receta ya elegida en una fila no vuelve a aparecer en el desplegable de las demás (todo a pedido explícito del usuario) |
| Procesos | `procesos/` | Grupos de recetas + recetas (ingredientes por peso/unidad, escalado, `unidadesPorLote` — cuántos frascos rinde un lote completo, a pedido explícito del usuario para la Calculadora de Ventas). Los ingredientes "por unidad" (frascos, etiquetas…) ya NO se tipean a mano — a pedido explícito ("si el lote rinde 5 serían 5 frascos, 5 etiquetas"), su cantidad es siempre igual a `unidadesPorLote` (campo deshabilitado en `RecetaIngredientesTable.jsx`, forzado también al guardar en `RecetaModal.jsx` por si cambia después). Ejecuciones (cronómetro por etapa, evaluación pH/envasado/costo) |
| Tareas | `tareas/` | Lista de tareas (no Kanban — rechazado explícito por el usuario), 3 estados fijos (Tarea nueva/En proceso/Finalizada), archivado real a `TareasHistorial` al finalizar |
| Contenido | `contenido/` | Historias de Instagram programadas (dropzone a Drive, emoji picker, publicar) + Ideas de marketing (fotos + notas de voz grabadas), una sola ventana con ambas secciones |
| QR | `qr/` | Generar y guardar códigos QR, vista de pantalla completa para escanear |
| Contabilidad | `contabilidad/` | "Cajas" (creadas a mano — efectivo, Nequi, etc. — con un botón chico "Nueva caja" junto al título, no un FAB; tocar una caja ya NO abre un detalle propio, esa ventana se sacó a pedido del usuario) con un "Resumen de movimientos" debajo de la lista (todas las cajas juntas, fecha + concepto + de qué caja, más reciente primero) + pestaña "Resumen por canal" (solo lectura, suma `feriaTotalVendidoDinero` de Ferias agrupado por canal). El FAB de esta pantalla es "Nuevo movimiento" (ingreso, egreso o transferencia entre cajas — tercer tipo a pedido explícito del usuario; una transferencia son 2 filas atadas por `origenRefId` que se borran siempre juntas, ver `addTransferencia`/`removeMovimiento` en `useContabilidad.js`). Dos mecanismos automáticos distintos: Compras sigue el patrón de "una caja con fuenteAutomatica='compras' recibe todo el egreso" (`registrarMovimientoAuto`/`removeMovimientoAuto`); Ventas ya NO tiene una "caja automática" fija — el ingreso de cada feria se reparte directo entre las cajas que el usuario eligió al cerrarla (`registrarMovimientosVenta`/`removeMovimientosVenta` en `contabilidadApi.js`) |

## Capa base compartida (tocar solo si el cambio es transversal)

| Archivo | Qué contiene |
|---|---|
| `web-react/src/App.jsx` | Enrutado entre Home y cada módulo (`PAGES`), pantalla de login |
| `web-react/src/services/googleAuth.js` | Login con Google (authorization-code + Worker en producción, implícito en local), `sheetsReq` (todas las llamadas a Sheets pasan por acá, con caché + reintento), subida/borrado/descarga de archivos a Drive |
| `web-react/src/features/home/` | Home: grid de widgets (opt-in) + grid de módulos, `moduleRegistry.js`/`widgetRegistry.js` |
| `web-react/src/components/ui/` | Design system compartido: `Modal`, `TextField`, `Select`, `FabButton`, `SearchBar`, `Tabs`, `AppCard`, `SortableGrid`, etc. |
| `web-react/src/hooks/` | `useRowGestures` (long-press/tap), `useDirtyGuard`, `useCloseOnOutsideClick`, `useSwipeBack`, etc. |
| `worker/` | Cloudflare Worker — guarda el refresh_token en KV y lo renueva sin depender de cookies de Google (necesario para que la PWA instalada en iPhone no pida reingresar) |

## Pendiente de migrar (sin equivalente en React todavía)

- **Informes** y **Bases de datos** (selector/creación de bases, multi-empresa): no tienen ninguna implementación ahora mismo — la vainilla que los tenía ya se borró.
- **Tareas**: Gantt, cronómetro por tarea, pantalla para ver el Historial archivado, filtros personalizados, gestión de tablero/áreas, suscripción a Google/iOS Calendar.
- El recordatorio automático de WhatsApp para historias de Contenido sigue viviendo en `notificacion-apps-script.gs` (Google Apps Script, server-side, no es parte de ningún frontend) — no se tocó.

## Notas

- `web-react/` es un proyecto Vite normal (`npm run dev`/`npm run build`), con build step — ya no aplica la restricción de "sin bundler" de la vainilla.
- Ver memoria del asistente (`react_migration_pilot.md`) para el historial detallado de cada módulo migrado, bugs reales encontrados y decisiones de UI.
