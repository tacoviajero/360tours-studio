# 360Tours Studio

Aplicacion local-first para Windows orientada a convertir fotografias 360 en recorridos virtuales estaticos y publicarlos en TacoViajero.

Este repositorio no es el sitio comercial de 360Tours. Es la herramienta de produccion local.

## Objetivo

El flujo principal del producto es:

```text
Fotos 360
↓
Studio
↓
Editar escenas y hotspots
↓
Preview
↓
Exportar
↓
Publicar
```

Los recorridos publicados deben vivir como sitios estaticos autonomos en:

```text
https://tacoviajero.com/tours/[slug]/
```

## Documentos clave

- [PLAN_MAESTRO.md](./PLAN_MAESTRO.md): plan completo del proyecto.
- [progress.html](./progress.html): tablero visual de avance de los 50 puntos del plan.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): separacion tecnica inicial.
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md): comandos locales.
- [docs/MANUAL_TESTING.md](./docs/MANUAL_TESTING.md): como levantar el servidor y probar fotos reales sin abrir ChatGPT.
- [docs/READY_TO_START.md](./docs/READY_TO_START.md): estado exacto para comenzar desarrollo.

## Stack inicial

- TypeScript
- Vite
- Marzipano
- pnpm
- Git
- Filesystem + JSON como direccion de persistencia
- Tauri para empaquetado Windows

## Comandos

Instalar dependencias:

```powershell
pnpm install
```

Ejecutar desarrollo local:

```powershell
pnpm dev
```

Ejecutar como app de escritorio Tauri:

```powershell
pnpm tauri:dev
```

Verificar tipos:

```powershell
pnpm typecheck
```

Ejecutar pruebas automaticas:

```powershell
pnpm test
```

Ejecutar pruebas E2E con Edge:

```powershell
pnpm test:e2e
```

La prueba E2E importa una imagen 360 de prueba, descarga el ZIP exportado, inspecciona sus archivos y abre el viewer exportado desde memoria.

Generar build:

```powershell
pnpm build
```

Generar instaladores Windows:

```powershell
cmd.exe /d /s /c 'call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" && set "PATH=%USERPROFILE%\.cargo\bin;%PATH%" && "node_modules\.bin\tauri.cmd" build --bundles nsis'
```

## Salidas locales

- **Guardar carpeta** crea una copia editable del proyecto con `project.json`, assets y `.history/`.
- **Exportar tour** descarga un ZIP con el sitio estatico autonomo que se puede subir a `/tours/[slug]/`.

## Escritorio Windows

La base Tauri ya esta configurada en `src-tauri/` y compila con Rust/Cargo 1.98.1 y Visual Studio Build Tools 2022. El nombre publico de la app es `360Tours Studio`; el crate interno se llama `tours360-studio` porque Cargo no permite nombres de paquete que empiecen con numero.

El ejecutable y el instalador NSIS se regeneraron correctamente despues de conectar la lectura nativa de carpeta. El bundle MSI queda pendiente de revisar porque WiX `light.exe` fallo durante el empaquetado.

Salidas generadas:

- `src-tauri/target/release/tours360-studio.exe`
- `src-tauri/target/release/bundle/nsis/360Tours Studio_0.1.0_x64-setup.exe`

## Regla principal

No construir SaaS. No depender de WordPress. No introducir base de datos remota, backend publico ni infraestructura cloud por defecto.

La app debe hacer una sola cosa muy bien: recibir fotos 360, convertirlas en un tour profesional y publicarlo de forma segura con el minimo trabajo manual posible.
