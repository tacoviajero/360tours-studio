# Estado de sesion - 4 octubre 2026

Este archivo resume el estado actual para retomar 360Tours Studio sin depender del historial del chat.

## Estado general

- Producto: `360Tours Studio`.
- Avance visual: `progress.html` muestra 76% global del plan maestro.
- App web: compila con Vite/TypeScript.
- App Windows: Tauri compila ejecutable y genera instalador NSIS.
- Persistencia: local-first con autosave, proyectos recientes, snapshots, carpeta editable y assets en IndexedDB.
- Recuperacion: si el proyecto actual queda corrupto, intenta restaurar el snapshot valido mas reciente y repara la copia principal.

## Funciones listas

- Crear proyecto nuevo.
- Importar panoramas JPG/JPEG con drag and drop.
- Procesar importaciones por cola con progreso visible para reducir picos de memoria.
- Mantener visibles los avisos/errores de importacion aunque parte del lote haya sido valido.
- Avisar dimensiones exactas cuando un JPG no parece panorama 360 completo 2:1.
- Generar thumbnails de escenas al importar.
- Optimizar panoramas importados a 2048px de ancho para preview/export inicial.
- Guardar metadata de optimizacion por escena: dimensiones, bytes, calidad y si hubo resize.
- Preview 360 con visor canvas interactivo.
- Renderer del editor y viewer exportado con cache de pixeles por escena para reducir trabajo al mover la vista.
- Editor con carga bajo demanda, precarga de escenas cercanas y cache LRU limitada a 4 panoramas.
- Mensaje visible mientras una escena carga y error explicito si el panorama no puede abrirse.
- Paneles laterales colapsables para dar mas espacio al panorama.
- Guia de siguiente paso dentro del editor segun el estado real del tour.
- Flujo guiado con 4 etapas medibles: importar, conectar, revisar escenas y exportar.
- Confirmacion individual de vista inicial y conteo de escenas revisadas.
- Panel de exportacion orientado a prueba local completa antes de instalacion o publicacion.
- Renombrar, ordenar, eliminar escenas y definir escena inicial.
- Buscar escenas por nombre, numero o id para manejar tours grandes sin depender solo del scroll.
- Conectar automaticamente importaciones multiples como recorrido lineal.
- Preparar rapido un tour lineal fijando inicio y reparando conexiones anterior/siguiente.
- Ver el recorrido como lista visual de escenas conectadas.
- Auditar escenas con resumen de total, conexiones, optimizadas, estado de conexion y peso optimizado.
- Guardar vista inicial de escena.
- Crear hotspots de navegacion, informacion, imagen, video y link.
- Arrastrar hotspots directamente sobre el panorama y guardar su posicion sin activar el enlace.
- Importar multiples planos de planta, renombrarlos, eliminarlos y ubicar marcadores.
- Importar galeria, editar captions, ordenar y eliminar fotos.
- Guardar snapshots y restaurarlos.
- Mostrar estado de guardado y errores de cuota/permisos sin descartar los cambios abiertos.
- Bloquear operaciones destructivas cuando no puede crearse su snapshot preventivo.
- Descargar respaldo ZIP editable con `project.json`, assets, miniaturas e historial.
- Ignorar indices locales corruptos y ocultar proyectos imposibles de leer sin borrar sus datos.
- Duplicar proyectos con assets.
- Eliminar proyectos recientes con confirmacion y limpieza local de historial/assets.
- Guardar carpeta editable con `project.json`, assets y `.history/`.
- Abrir carpeta editable en navegador compatible.
- Recuperar copia local guardada del proyecto actual desde Tauri.
- Exportar ZIP estatico autocontenido.
- Incluir `deploy-manifest.json` dentro del ZIP exportado para publicar con lista exacta de archivos.
- Incluir metadata de panoramas dentro de `deploy-manifest.json`.
- Viewer exportado con visor canvas, escenas, hotspots, planos, galeria y fullscreen.
- Menu del viewer exportado scrollable para tours grandes.
- Viewer exportado con carga bajo demanda de panoramas y precarga ligera de escenas cercanas/conectadas.
- Preflight de publicacion con plan de rutas y checklist seguro de despliegue.
- Validacion de schema, escena inicial, hotspots, URLs, slug, accesibilidad, plano, galeria y assets locales faltantes.
- Bloqueo de exportar/publicar cuando faltan assets locales.

## Verificaciones realizadas

```powershell
pnpm test
pnpm build
pnpm test:e2e
pnpm test:real
pnpm test:large
pnpm test:diagnostics
pnpm test:local
```

Resultados:

- Unitarias: 7 archivos, 16 pruebas pasan.
- Build web: correcto.
- E2E con Edge: correcto; cubre flujo guiado, confirmacion de escena, arrastre de hotspot, respaldo editable, recuperacion, almacenamiento lleno, export ZIP, viewer y tablero.
- Smoke test con las 3 fotos reales de la van: correcto en editor y en tour exportado desde ZIP.
- Prueba automatizada `pnpm test:real`: correcto; importa las 3 fotos reales, recarga autosave, verifica conexiones lineales, valida metadata de optimizacion, exporta ZIP y abre el viewer exportado.
- Prueba automatizada `pnpm test:large`: correcto; importa 50 escenas sinteticas, verifica busqueda y navegacion hasta la escena 050, limita a 4 panoramas la cache del editor, recarga autosave, prepara ruta lineal, exporta ZIP y confirma que el viewer no carga la escena 050 hasta seleccionarla.
- Renderer verificado despues del cache de pixeles con `pnpm test:real` y `pnpm test:large`.
- Prueba automatizada `pnpm test:diagnostics`: correcto; mezcla archivos validos, duplicado, imagen no 2:1 e invalido y conserva avisos visibles.
- Prueba automatizada `pnpm test:local`: correcto; ejecuta build, unitarias, flujo basico en navegador, 3 fotos reales, 50 escenas, diagnosticos y viewer exportado.
- Build Windows NSIS actualizado: correcto.

## Escritorio Windows

Ejecutable actualizado:

```text
src-tauri/target/release/tours360-studio.exe
```

Instalador NSIS actualizado:

```text
src-tauri/target/release/bundle/nsis/360Tours Studio_0.1.0_x64-setup.exe
```

Comando que funciono para generar NSIS:

```powershell
cmd.exe /d /s /c 'call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" && set "PATH=%USERPROFILE%\.cargo\bin;%PATH%" && "node_modules\.bin\tauri.cmd" build --bundles nsis'
```

Pendiente: el bundle MSI fallo en WiX `light.exe`; el instalador `.exe` NSIS si quedo listo.

## Como se esta guardando el avance

- Codigo fuente en el workspace local.
- `progress.html` y `src/progress/progress.ts` como tablero visual de los 50 puntos.
- `docs/SESSION_STATUS.md` como resumen operativo de cierre.
- `README.md` con comandos y estado de escritorio.
- Git guarda los avances recientes en commits, incluyendo:
  - `f4b7e11 Implementar visor canvas 360 interactivo`
  - `8b2f3dc Usar visor canvas en tour exportado`
  - `8dcc7c1 Cerrar flujo real de tour lineal`

## Siguientes pasos recomendados

1. Ejecutar una prueba manual de aceptacion con las tres fotos reales usando solo la interfaz.
2. Probar recarga o cierre durante una importacion activa y limpiar assets parciales.
3. Agregar seleccion visual y deshacer para movimientos de hotspots.
4. Medir memoria del navegador; agregar workers o multiresolucion solo si los resultados lo justifican.
5. Mantener instalacion y publicacion fuera del siguiente tramo hasta que el flujo local quede aprobado.
