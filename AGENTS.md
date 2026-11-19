# Instrucciones para agentes

Este archivo aplica a todo el repositorio de 360Tours Studio.

## Identidad y alcance

- Confirma primero el repositorio local con `git rev-parse --show-toplevel` y `git remote -v`.
- El repositorio esperado es `https://github.com/tacoviajero/360tours-studio.git`.
- El producto es una aplicacion local-first de escritorio para Windows. La web local es el entorno de desarrollo; no implica una version movil del editor.
- No conviertas el proyecto en SaaS ni agregues backend publico, base de datos remota, WordPress o infraestructura cloud sin una solicitud explicita.
- Conserva la separacion existente entre importar, modelar, editar, renderizar y exportar/publicar.

## Fuentes de verdad

- La politica global obligatoria es `https://github.com/tacoviajero/engineering-standards/blob/main/policies/effort-validation.md`. Este archivo la aplica al proyecto y no puede debilitarla.
- Usa el codigo y las pruebas actuales como autoridad sobre lo implementado.
- Consulta `PROJECT.md` para el estado tecnico vigente.
- Consulta `docs/validation.md` para elegir la validacion proporcional.
- `PLAN_MAESTRO.md` y `progress.html` describen alcance y avance.
- `docs/ARCHITECTURE.md` y `docs/DECISIONS.md` contienen decisiones iniciales.
- `docs/SESSION_STATUS.md`, `docs/READY_TO_START.md` y partes de `docs/DEVELOPMENT.md` son historicos; verifica sus afirmaciones contra el codigo antes de repetirlas.
- Separa siempre funciones implementadas, funciones en desarrollo y funciones planeadas.

## Forma de trabajo

- Antes de actuar, identifica de forma breve el comportamiento afectado, su riesgo (nivel 1, 2 o 3), la comprobacion minima necesaria y la condicion de cierre. En tareas triviales basta una nota corta.
- Lee los modulos afectados y sus pruebas antes de editar.
- Mantiene los cambios dentro del alcance pedido. Preserva decisiones aprobadas fuera de ese alcance.
- Una solicitud de explicacion, opinion o plan no autoriza cambios de codigo.
- Respeta cambios existentes del usuario y trabaja con un arbol sucio sin revertir archivos ajenos.
- Usa `apply_patch` para ediciones manuales.
- Usa PowerShell y comandos compatibles con Windows. Para buscar texto usa `Select-String`; para inventariar archivos usa `Get-ChildItem`.
- No uses redireccion `>` para escribir archivos de codigo o configuracion.
- Mantiene TypeScript estricto, modulos ES y el estilo existente de dos espacios.
- Prefiere reglas puras en `src/domain/` y adaptadores en sus carpetas actuales antes de agregar logica transversal a `src/app/app.ts`.
- No agregues abstracciones, rutas, formatos o capas arquitectonicas sin una necesidad demostrada.
- Si una comprobacion falla, confirma primero si el fallo esta relacionado con el cambio. Corrige de forma focalizada y repite solo la evidencia invalidada.
- Detente y presenta el diagnostico despues de dos intentos fallidos sobre el mismo problema.
- Registra y reporta problemas ajenos al alcance; no los corrijas automaticamente.
- Solicita autorizacion antes de introducir una refactorizacion amplia, una dependencia importante o un cambio arquitectonico que exceda la tarea aprobada.

## Interfaz y experiencia

- El visor 360 es el protagonista de la pantalla; evita aumentar paneles, texto o controles sin necesidad operativa.
- El editor se disena para escritorio con el minimo Tauri de 1100 x 720. No dediques trabajo a responsive movil salvo solicitud expresa.
- Conserva la escala tipografica, iconos Lucide y controles compactos existentes.
- Usa tooltips y nombres accesibles para controles basados solo en iconos.
- Los valores automaticos son provisionales. Una decision manual equivalente del usuario debe reemplazarlos, no coexistir como duplicado.
- Traduce referencias visuales a posiciones, dimensiones y proporciones comprobables.

## Datos y archivos multimedia

- No muevas, renombres, sobrescribas, recomprimas ni elimines fotografias originales sin autorizacion expresa.
- Los panoramas reales son datos locales. No los agregues a Git ni los copies al repositorio.
- `assets/images_test/`, `assets/Photos-1-001/`, `projects/`, `exports/`, `dist/`, `test-results/` y `src-tauri/target/` son salidas o datos locales ignorados.
- Distingue datos reales, fixtures sinteticos, demo generada y recursos pendientes de integracion.
- La importacion debe preservar el JPG original byte por byte. Preview, thumbnail y mosaicos son derivados separados.
- Cualquier cambio en rutas o manifiestos de assets debe conservar compatibilidad con proyectos, respaldos, snapshots y ZIP exportados.

## Seguridad

- Nunca escribas credenciales, hosts privados, claves o tokens en codigo, documentos, fixtures o commits.
- `.env`, claves y certificados permanecen fuera de Git.
- La publicacion SFTP real no esta implementada. No simules exito ni agregues credenciales de prueba como si fueran reales.
- Conserva las validaciones de rutas de Tauri y evita permitir traversal o escritura fuera de la carpeta del proyecto.
- Operaciones destructivas sobre proyectos, escenas, snapshots o assets requieren confirmacion y una ruta de recuperacion coherente con el comportamiento existente.

## Dependencias

- Usa `pnpm`, fijado en `package.json` como `pnpm@11.19.0`.
- No instales, elimines ni actualices dependencias sin autorizacion explicita.
- Si una dependencia cambia, actualiza `package.json` y `pnpm-lock.yaml` en la misma tarea y explica el motivo.
- Reutiliza Photo Sphere Viewer, Three.js, Tauri, Lucide, Vitest y Playwright ya presentes.

## Validacion

- Clasifica el riesgo conforme a la politica global: nivel 1 para cambios aislados y no criticos; nivel 2 para comportamiento, interfaces, persistencia o integraciones; nivel 3 para seguridad, datos destructivos, concurrencia, arquitectura compartida o funciones criticas.
- Elige la comprobacion minima que cubra ese riesgo; consulta `docs/validation.md`.
- Ejecuta primero la prueba mas especifica capaz de detectar el fallo relevante y amplia solo por una razon tecnica concreta.
- No repitas suites, builds ni comprobaciones sobre el mismo estado. Reutiliza evidencia verificable cuando codigo, dependencias y entorno relevante no hayan cambiado.
- Cambios puros de dominio: prueba unitaria focalizada.
- Cambios TypeScript compartidos: `pnpm typecheck` y pruebas focalizadas.
- Cambios de UI o exportacion: build y el flujo E2E relacionado.
- Cambios al pipeline de panoramas: pruebas focalizadas y, cuando corresponda, `test:real`.
- Cambios de rendimiento o carga diferida: `test:large`.
- Reserva `pnpm test:local` para cambios amplios, integraciones entre subsistemas o cierres de hito.
- No declares una prueba manual, fotos reales, instalador o publicacion como verificados si no se ejecutaron en la tarea actual; cita evidencia previa como historica.
- Termina cuando se cumplan los criterios de aceptacion, pase la evidencia necesaria, no queden fallos relacionados que bloqueen la tarea y se documenten las limitaciones. No abras trabajo adicional despues de alcanzar esas condiciones.

## Git y entregas

- No hagas commit, push, rebase, reset ni cambies de rama salvo solicitud explicita.
- No incluyas `.codex/`, `.impeccable/`, multimedia real ni artefactos generados.
- Antes de entregar, informa archivos modificados, validaciones ejecutadas y aspectos no verificados.
- Informa bloqueos y decisiones que cambien materialmente alcance, riesgo, costo o comportamiento.
