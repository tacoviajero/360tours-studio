# Decisiones iniciales

## ADR-001: App local-first

360Tours Studio se construye primero como web app local-first. Durante desarrollo corre en localhost. El empaquetado Windows se resolvera despues con Tauri cuando Rust/Cargo este disponible.

## ADR-002: Tours publicados estaticos

El tour publicado sera HTML, CSS, JavaScript, JSON y assets estaticos. No debe depender del editor, WordPress ni una base de datos.

## ADR-003: Modelo versionado desde el inicio

Todo proyecto incluye `schemaVersion`. La version inicial es `1`.

## ADR-004: Visor canvas como renderer actual

El motor 360 actual es un visor canvas propio. El renderer queda aislado en `src/renderer/` para poder reutilizarlo en preview y produccion, y para poder cambiar a tiles/multiresolucion despues sin rehacer el editor.

## ADR-005: pnpm como gestor de paquetes

Se usa pnpm porque esta disponible en la laptop. npm no esta disponible actualmente en el PATH.

## ADR-006: No integrar Insta360 SDK en V1

V1 acepta JPG/JPEG 360 ya procesados. El soporte futuro para INSP debe entrar como adaptador independiente.

## ADR-007: Git obligatorio

El proyecto debe mantenerse bajo control de versiones desde el principio. Cada hito funcional debe cerrarse con commit.
