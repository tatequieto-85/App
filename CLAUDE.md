# TATEAPP — mapa de módulos

PWA sin build step para producción de salsas (TateQuieto). Frontend en JS vanilla con módulos ES nativos (`<script type="module">`), sin bundler. Backend: Google Sheets (datos) + Google Drive (archivos) vía OAuth con Google Identity Services.

Cuando el usuario pida un cambio en un módulo específico, ir directo al archivo de esa fila — no hace falta leer los demás.

## Módulos de negocio (uno por tarjeta del home)

| Módulo (como lo nombra el usuario) | Archivo         | Qué contiene |
|---|---|---|
| Contenido (historias de Instagram) | `contenido.js`  | Stories CRUD, dropzone de archivos, modal de Configuración/WhatsApp, emoji picker |
| Contenido → Ideas de marketing | `ideas-marketing.js` | Banco de ideas con fotos + notas de voz grabadas en el navegador (MediaRecorder) + descripción; vive dentro de la vista de Contenido, sheet propia `IdeasMarketing` — no confundir con el módulo `ideas.js` (banco de ideas por área, sin fotos/audio) |
| Tareas (Kanban / Gantt / Lista) | `tareas.js` | El módulo más grande. Kanban, Gantt, Lista, modal de tarea, cronómetro por tarea, filtros, detalle de tarea, suscripción a Google Calendar/Calendario de iOS (feed vía Worker) |
| Procesos (recetas + ejecución de lotes) | `procesos.js` | Recetas, bloques de recetas, ejecución paso a paso con cronómetro, evaluación de lote (una sola fase: pH, envasado/rendimiento, calificación) |
| Compras (precios de ingredientes) | `compras.js`    | Registro de compras, historial de precios, costo de producción |
| Ingredientes (catálogo compartido) | `ingredientes.js` | CRUD de ingredientes, autocomplete — lo usan Compras y Procesos |
| Ventas (canales de venta) | `ferias.js`     | Galería de canales de venta (ferias, Mercado Libre, etc. — tarjetas 4:5 configurables, mismo patrón que los grupos de recetas de Procesos); dentro de cada canal, ferias/eventos con plan de stock, conteo de personas, ventas, muestras, resumen |
| Stock (inventario) | `stock.js`      | Resumen de inventario, trazabilidad, ajustes manuales, producto testigo |
| Informes | `informes.js`   | Horas invertidas/pendientes (cruza datos de Tareas y Procesos) |
| QR | `qr.js`         | Generar y guardar códigos QR |
| Ideas (banco de ideas por área) | `ideas.js`      | Ideas agrupadas por área — reutiliza las mismas áreas que administra Tareas (`kanbanAreas`/`getAreaColor`, importadas de `tareas.js`) |
| Bases de datos (multi-empresa) | `bases.js`      | Selector/creación/edición de bases de datos (cada una un Google Sheet distinto) |

## Capa base compartida (tocar solo si el cambio es transversal)

| Archivo | Qué contiene |
|---|---|
| `main.js` | Punto de entrada. `navigateTo`, paleta de comandos (Ctrl+K), pantallas de login, prompt de instalación PWA, arranque de la app |
| `auth.js` | Login con Google, biometría (WebAuthn), `sheetsReq`/`sheetsReqFor` (todas las llamadas a Sheets pasan por aquí), subida/borrado de archivos a Drive |
| `db-state.js` | Cuál base de datos (Sheet) está activa ahora mismo |
| `utils.js` | Helpers usados por todos: `esc`, `setFb`, formateo de fechas/moneda, íconos SVG |
| `input-guard.js` | Sistema anti-clics accidentales al hacer scroll en móvil |
| `undo.js` | Ctrl+Z global |

## Notas

- No hay build step: cada archivo es un `<script type="module">` real, cargado directo por el navegador. Para probar cambios en local hace falta un servidor (`file://` no funciona con módulos ES).
- `sw.js` (service worker) cachea todos los archivos de arriba — **subir el número de `CACHE` cada vez que se edite cualquier `.js`/`.html`/`.css`**, si no la PWA sirve versiones viejas.
- Antes de julio 2026 todo esto vivía en un solo `app.js` de 8760 líneas; se dividió por módulo para no tener que leer todo el archivo para tocar una sola parte.
