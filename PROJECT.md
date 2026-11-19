# 360Tours Studio

## Proposito

360Tours Studio es una herramienta local-first para Windows que convierte fotografias equirectangulares 360 en recorridos virtuales estaticos. El usuario importa panoramas, organiza escenas, coloca conexiones y contenido interactivo, revisa el resultado y exporta un minisitio autocontenido.

El repositorio corresponde a la herramienta de produccion. No es el sitio comercial ni un servicio SaaS.

Repositorio: `https://github.com/tacoviajero/360tours-studio.git`

## Flujo del producto

```text
JPG/JPEG 360
  -> importacion y derivados
  -> proyecto editable
  -> escenas, conexiones y contenido
  -> vista final
  -> ZIP estatico o carpeta editable
```

El destino web previsto para los tours es `https://tacoviajero.com/tours/[slug]/`, pero la subida remota todavia no forma parte del flujo implementado.

## Arquitectura actual

La aplicacion mantiene responsabilidades separadas:

| Area | Ubicacion | Responsabilidad |
| --- | --- | --- |
| Shell y editor | `src/app/` | Interfaz, coordinacion del flujo, escenas, hotspots, planos, galeria, historial y exportacion |
| Dominio | `src/domain/` | Modelo `TourProject`, validacion, assets, conexiones y navegacion espacial |
| Importacion | `src/importers/` | Validacion JPG, capacidad, procesamiento y Web Worker |
| Persistencia | `src/project/` | JSON local, IndexedDB, assets, snapshots, respaldos y carpetas editables |
| Renderer del editor | `src/renderer/` | Visor canvas 360, cache y capa de hotspots |
| Vista final | `src/preview/` | Preview WebGL dentro de Studio |
| Exportacion/publicacion | `src/publisher/` | ZIP, minisitio, manifiesto y plan de publicacion |
| Escritorio | `src-tauri/` y `src/platform/` | Shell Windows y lectura/escritura nativa de carpetas de proyecto |
| Tablero | `src/progress/` | Estado visual de los 50 puntos del plan maestro |

El modelo actual usa `schemaVersion: 1`. Un proyecto contiene escenas, vista inicial, hotspots, planos, galeria, configuracion y estado de publicacion.

## Tecnologias

- TypeScript y Vite.
- pnpm 11.19.0.
- Canvas 2D para el editor.
- Photo Sphere Viewer, adaptador de mosaicos y Three.js para vista final y tour exportado.
- Web Worker para procesar panoramas.
- IndexedDB para blobs y `localStorage` para indices y configuracion del proyecto en navegador.
- Tauri 2 con Rust para el shell Windows.
- Lucide para iconos.
- Vitest para pruebas unitarias y Playwright con Edge para flujos de navegador.

## Implementado

### Proyectos y persistencia

- Crear, abrir, duplicar y eliminar proyectos locales.
- Autosave, recientes y recuperacion del ultimo proyecto.
- Snapshots con configuracion y versiones deduplicadas de assets.
- Restauracion ante JSON corrupto mediante el snapshot valido mas reciente.
- Respaldo ZIP editable y carpeta de proyecto con `project.json`, assets e historial.
- Lectura y escritura de carpetas dentro del almacenamiento local de Tauri, con rutas sanitizadas.

### Importacion y multimedia

- Entrada V1 para JPG/JPEG 360 ya procesados; INSP no se acepta.
- Importacion multiple por cola, cancelacion y diagnosticos de archivos duplicados o no compatibles.
- Estimacion de espacio antes de importar y recuperacion de una importacion interrumpida.
- Conservacion del JPG original, SHA-256 y metadata de dimensiones/peso.
- Derivados separados: preview 2048 px, thumbnail y mosaicos de alta resolucion.
- Procesamiento mediante Web Worker.
- Recuperacion manual de originales para proyectos antiguos.

### Editor

- Lista, busqueda, renombrado, reordenamiento, duplicacion, reemplazo y eliminacion de escenas.
- Escena inicial y vista inicial con yaw, pitch y campo de vision.
- Conexiones de navegacion y puntos de informacion, imagen, video y enlace.
- Edicion y colocacion visual de hotspots, seleccion, arrastre, deshacer y rehacer.
- Una sola conexion por origen/destino; la posicion manual sustituye marcadores automaticos equivalentes.
- Preparacion y reparacion de un recorrido lineal sin competir con conexiones manuales.
- Planos multiples con marcadores y galeria con captions y orden.
- Validacion continua, siguiente paso guiado y preflight de exportacion.

### Visualizacion y exportacion

- Preview canvas interactivo en el editor.
- Vista final WebGL dentro de Studio con mosaicos, hotspots, indice de escenas, planos, galeria, fullscreen y teclado.
- Navegacion espacial por conexiones y orientacion de llegada mediante la conexion reciproca o `targetYaw`.
- Exportacion ZIP autocontenida con `index.html`, `tour.json`, viewer, vendors, assets y `deploy-manifest.json`.
- El ZIP conserva los JPG originales byte por byte y usa mosaicos para visualizacion.
- Iniciador Windows `ABRIR_TOUR.cmd`, servidor PowerShell local y guia `LEEME.txt`.
- Mensaje explicito cuando se intenta abrir el minisitio con `file://`.

### Calidad y escritorio

- Unitarias para dominio, persistencia, exportacion, ZIP y plan de publicacion.
- E2E del flujo principal, exportacion y viewer.
- Flujos automatizados con tres fotos reales 8000 x 4000, 50 escenas sinteticas y lotes de importacion mixtos.
- Configuracion Tauri y comandos nativos de carpeta.
- El historial del proyecto documenta un ejecutable y un instalador NSIS generados.

## En desarrollo o pendiente de aceptacion

- Aceptacion manual completa del flujo local y del ZIP con un tour real.
- Medicion con un lote real de 30 a 50 panoramas; la cobertura actual combina tres fotos reales y 50 escenas sinteticas.
- Confirmacion visual de orientacion de llegada en espacios reales.
- Prueba del binario instalado y del guardado nativo con datos reales.
- Revisión del bundle MSI; la documentacion historica registra un fallo de WiX `light.exe`.
- Mejoras del gestor de proyectos, como archivado y busqueda.
- Reordenamiento por arrastre y vista ampliada de galeria.
- Ajustes de accesibilidad con lector de pantalla real.

## Planeado, no implementado

- Subida SFTP real.
- Almacenamiento seguro de credenciales en Windows.
- Activacion remota, respaldo remoto, swap y rollback efectivos.
- Verificacion de la URL publica y actualizacion de tours ya publicados.
- Cuenta SFTP dedicada limitada a `/tours/`.
- Adaptador para archivos Insta360/INSP.

El modulo `src/publisher/sftpPublisher.ts` genera y valida un plan de despliegue, pero devuelve la publicacion como detenida incluso si recibe host y usuario. No existe transporte SFTP en el codigo actual.

## Decisiones tecnicas vigentes

- Local-first: el proyecto editable y sus assets permanecen en la computadora del usuario.
- Salida estatica: un tour publicado funciona sin Studio, backend o base de datos.
- Originales separados de derivados: calidad final y rendimiento del editor no comparten el mismo archivo.
- Dependencias existentes para reglas complejas: Photo Sphere Viewer y Three.js resuelven la visualizacion WebGL.
- Chrome y Edge son los navegadores de trabajo soportados; otros navegadores reciben diagnostico.
- El editor es una aplicacion de escritorio. Tauri establece un minimo de 1100 x 720.
- No se guardan credenciales en texto plano.
- Los valores automaticos son provisionales y ceden ante decisiones manuales equivalentes.

## Documentacion relacionada

- `README.md`: inicio rapido, comandos y salidas locales.
- `PLAN_MAESTRO.md`: alcance original de 50 puntos.
- `progress.html`: tablero visual calculado desde `src/progress/progress.ts`.
- `docs/ARCHITECTURE.md`: fronteras iniciales.
- `docs/DECISIONS.md`: decisiones iniciales.
- `docs/MANUAL_TESTING.md`: uso manual del servidor y flujo de tres fotos.
- `docs/validation.md`: estrategia vigente de pruebas.
- `docs/SESSION_STATUS.md`: evidencia historica de sesiones y verificaciones.

Los documentos `docs/READY_TO_START.md` y partes de `docs/DEVELOPMENT.md` describen una etapa inicial y contienen pendientes ya superados. Deben leerse como historia, no como estado actual.

## Contradicciones documentales conocidas

| Documento historico | Afirmacion que requiere cautela | Estado comprobado en el repositorio actual |
| --- | --- | --- |
| `docs/READY_TO_START.md` | Presenta exportacion y renderer estatico como trabajo pendiente | El exportador, minisitio y viewer existen en `src/publisher/` y tienen cobertura automatizada |
| `docs/DEVELOPMENT.md` | Registra Rust/Cargo como no instalados y Tauri como bloqueado | Existen configuracion Tauri, codigo Rust y evidencia historica de un instalador NSIS; la instalacion actual del equipo no se verifico durante esta normalizacion |
| `docs/SESSION_STATUS.md` y README | Contienen resultados y estados de builds de sesiones anteriores | Son evidencia historica; deben volver a validarse cuando cambien el codigo, las dependencias o el entorno relevante |

`PROJECT.md` describe el estado funcional vigente. Los documentos historicos conservan valor como bitacora, pero no deben usarse para afirmar que una capacidad esta actualmente verificada.
