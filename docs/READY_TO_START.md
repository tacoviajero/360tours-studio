# Ready to start

Este documento deja claro el estado del proyecto para continuar el desarrollo en otro chat sin perder contexto.

## Estado actual

- El plan maestro fue analizado y guardado en `PLAN_MAESTRO.md`.
- El repositorio Git fue inicializado.
- Existe un commit inicial: `c9df468 Inicializar 360Tours Studio`.
- La app base compila con TypeScript y Vite.
- El renderer actual usa canvas y esta separado del editor.
- El modelo de datos ya incluye `schemaVersion`.
- Existe un validador base del proyecto.
- Existe un importador modular `JPEG360Importer`.
- Existen fronteras iniciales para exportacion y publicacion.
- Las carpetas locales `projects/`, `exports/` y `config/` estan creadas con `.gitkeep`.
- `node_modules/`, `.pnpm-store/`, `dist/`, proyectos locales, exports y config local estan ignorados por Git.

## Verificaciones ya realizadas

```powershell
pnpm typecheck
pnpm build
Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing
```

Resultados:

- Typecheck: correcto.
- Build: correcto.
- Servidor local Vite: respondio `200 OK`.

## Runtime detectado en la laptop

- Node.js: disponible.
- pnpm: disponible.
- Git: disponible.
- npm: no disponible en el PATH actual.
- Rust/Cargo: no disponible en el PATH actual.

Conclusion:

- El desarrollo web local ya puede comenzar.
- Tauri debe esperar hasta instalar Rust/Cargo.
- No bloquear la Fase A por empaquetado de escritorio.

## Arquitectura que debe respetarse

Mantener separadas estas responsabilidades:

```text
IMPORTAR
↓
MODELAR
↓
EDITAR
↓
PUBLICAR
```

Mantener separados estos componentes:

```text
Editor
≠
Formato del proyecto
≠
Renderer del tour
≠
Publicador
```

El renderer publicado debe poder vivir sin 360Tours Studio.

## Fase siguiente

La siguiente sesion de desarrollo debe empezar por la Fase A:

1. Formalizar `tour.json` como salida del modelo.
2. Crear un renderer estatico que reciba `tour.json` + assets.
3. Usar 3 panoramas de prueba.
4. Probar hotspots manuales entre escenas.
5. Exportar una carpeta autocontenida con `index.html`, `tour.json`, `viewer.js`, `viewer.css` y assets.

Criterio de exito:

```text
Un JSON genera un tour navegable.
```

No empezar por una UI compleja.

## Prompt recomendado para el siguiente chat

```text
Vamos a continuar el desarrollo de 360Tours Studio desde el estado actual. Lee PLAN_MAESTRO.md, README.md, docs/ARCHITECTURE.md y docs/SESSION_STATUS.md. Respeta la separacion Importar / Modelar / Editar / Publicar. El objetivo inmediato es que 3 panoramas reales generen un tour navegable con visor canvas, conexiones claras y exportacion estatica autocontenida.
```

## Decisiones tomadas

- Usar pnpm porque esta disponible en la laptop.
- No usar Electron.
- Tauri sera evaluado despues, cuando exista Rust/Cargo.
- No usar backend publico.
- No usar base de datos.
- No usar WordPress para tours publicados.
- No guardar credenciales en texto plano.
- Mantener publicacion SFTP como modulo separado.

## Pendientes antes de publicar tours reales

- Definir credenciales SFTP dedicadas.
- Crear cuenta de hosting limitada a `/tours/`.
- Implementar exportador estatico real.
- Implementar deploy temporal y swap.
- Implementar rollback.
- Implementar almacenamiento seguro de credenciales en Windows.
