# Arquitectura inicial

HomeTours Studio se desarrolla como una app local-first con cuatro responsabilidades separadas:

1. Importar fotografias 360.
2. Modelar proyectos versionados.
3. Editar datos del tour.
4. Exportar y publicar tours estaticos.

## Limites principales

- El editor modifica `project.json`.
- El preview usa el mismo renderer que el tour publicado.
- El renderer interpreta `tour.json` y assets estaticos.
- El publicador sube una carpeta exportada, nunca el proyecto editable completo.
- Los originales importados se conservan siempre en `source/`.

## Estructura de codigo

```text
src/
├── app/          UI de Studio
├── domain/       modelo versionado, validadores y reglas puras
├── importers/    adaptadores de entrada
├── project/      persistencia local del proyecto
├── renderer/     renderer del tour, independiente del editor
├── publisher/    exportacion y publicacion
└── styles/       estilos globales
```

## Decision inicial de stack

- TypeScript como lenguaje base.
- Vite para desarrollo local ligero.
- Marzipano como renderer 360 inicial.
- Filesystem + JSON como persistencia.
- Tauri como objetivo de empaquetado Windows cuando Rust/Cargo este instalado.

No se incorpora base de datos, backend publico, WordPress ni servicio cloud.

