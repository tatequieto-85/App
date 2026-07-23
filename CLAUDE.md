# TATEAPP — mapa de módulos

PWA sin build step para producción de salsas (TateQuieto). Frontend en JS vanilla con módulos ES nativos (`<script type="module">`), sin bundler. Backend: Google Sheets (datos) + Google Drive (archivos) vía OAuth con Google Identity Services.

Cuando el usuario pida un cambio en un módulo específico, ir directo al archivo de esa fila — no hace falta leer los demás.

## Módulos de negocio (uno por tarjeta del home)

| Módulo (como lo nombra el usuario) | Archivo         | Qué contiene |
|---|---|---|
| Contenido (historias de Instagram) | `contenido.js`  | Stories CRUD, dropzone de archivos, modal de Configuración/WhatsApp, emoji picker |
| Tareas (Kanban / Gantt / Lista / Calendario) | `tareas.js` | El módulo más grande. Kanban, Gantt, Lista, Calendario, modal de tarea, cronómetro por tarea, filtros, detalle de tarea |
| Procesos (recetas + ejecución de lotes) | `procesos.js` | Recetas, bloques de recetas, ejecución paso a paso con cronómetro, evaluación de lote (Fase 1/2/Sinéresis), notificaciones de WhatsApp por evaluación |
| Compras (precios de ingredientes) | `compras.js`    | Registro de compras, historial de precios, costo de producción |
| Ingredientes (catálogo compartido) | `ingredientes.js` | CRUD de ingredientes, autocomplete — lo usan Compras y Procesos |
| Ferias (participación en mercados) | `ferias.js`     | Ferias disponibles/confirmadas, plan de stock por día y lote, conteo de personas/ventas |
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
