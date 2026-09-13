# Estado de sesion - 12 septiembre 2026

Este archivo resume el estado actual para retomar 360Tours Studio sin depender del historial del chat.

## Estado general

- Producto: `360Tours Studio`.
- Avance visual: `progress.html` muestra 67% global del plan maestro.
- App web: compila con Vite/TypeScript.
- App Windows: Tauri compila ejecutable y genera instalador NSIS.
- Persistencia: local-first con autosave, proyectos recientes, snapshots, carpeta editable y assets en IndexedDB.

## Funciones listas

- Crear proyecto nuevo.
- Importar panoramas JPG/JPEG con drag and drop.
- Generar thumbnails de escenas al importar.
- Preview 360 con Marzipano.
- Renombrar, ordenar, eliminar escenas y definir escena inicial.
- Guardar vista inicial de escena.
- Crear hotspots de navegacion, informacion, imagen, video y link.
- Importar multiples planos de planta, renombrarlos, eliminarlos y ubicar marcadores.
- Importar galeria, editar captions, ordenar y eliminar fotos.
- Guardar snapshots y restaurarlos.
- Duplicar proyectos con assets.
- Eliminar proyectos recientes con confirmacion y limpieza local de historial/assets.
- Guardar carpeta editable con `project.json`, assets y `.history/`.
- Abrir carpeta editable en navegador compatible.
- Recuperar copia local guardada del proyecto actual desde Tauri.
- Exportar ZIP estatico autocontenido.
- Viewer exportado con escenas, hotspots, planos, galeria y fullscreen.
- Preflight de publicacion con plan de rutas.
- Validacion de schema, escena inicial, hotspots, URLs, slug, accesibilidad, plano, galeria y assets locales faltantes.
- Bloqueo de exportar/publicar cuando faltan assets locales.

## Verificaciones realizadas

```powershell
pnpm test
pnpm build
pnpm test:e2e
```

Resultados:

- Unitarias: 6 archivos, 11 pruebas pasan.
- Build web: correcto.
- E2E con Edge: correcto; cubre app shell, importacion, thumbnail visible, export ZIP, viewer exportado, demo, eliminacion de proyecto reciente y tablero de progreso.

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
- Git todavia no tiene un commit nuevo con este bloque de trabajo.

## Siguientes pasos recomendados

1. Hacer commit del estado actual.
2. Probar la app instalada con 3 JPG reales.
3. Mejorar selector nativo de carpeta externa en Tauri.
4. Implementar publicacion SFTP real.
5. Resolver MSI/WiX solo si se necesita instalador `.msi`; por ahora NSIS `.exe` es suficiente para probar.
