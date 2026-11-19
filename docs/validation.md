# Estrategia de validacion

Esta guia aplica al proyecto la politica global obligatoria de `https://github.com/tacoviajero/engineering-standards/blob/main/policies/effort-validation.md`. El objetivo es obtener evidencia suficiente para el riesgo introducido con el minimo esfuerzo necesario y sin repetir toda la bateria para cada edicion.

## Principios

1. Empieza por la prueba mas cercana al codigo modificado.
2. Amplia la cobertura solo cuando el cambio cruza limites entre dominio, UI, persistencia, multimedia o exportacion.
3. Reutiliza evidencia vigente cuando el codigo cubierto no cambio.
4. Distingue fixtures sinteticos, demo generada y panoramas reales.
5. Una prueba automatizada no sustituye la inspeccion visual cuando el criterio es calidad, encuadre u orientacion espacial.
6. Declara lo ejecutado y lo que quedo sin verificar.

## Plan minimo y clasificacion del riesgo

Antes de modificar, registra brevemente:

- comportamiento o componente afectado;
- nivel de riesgo;
- comprobacion minima necesaria;
- condicion concreta de cierre.

| Riesgo | Aplicacion en 360Tours Studio | Validacion esperada |
| --- | --- | --- |
| Nivel 1 — bajo | Documentacion, texto, CSS localizado, configuracion no critica o logica aislada | Revision directa y la comprobacion focalizada correspondiente; sin suite completa por defecto |
| Nivel 2 — moderado | Flujos del editor, contratos TypeScript, persistencia, importacion, viewer, exportacion o interacciones existentes | Pruebas especificas del componente y de las integraciones directamente afectadas |
| Nivel 3 — alto | Escritura destructiva, recuperacion de proyectos, rutas nativas, credenciales/publicacion, cambios de schema incompatibles o arquitectura compartida | Riesgos explicitos, integracion y regresion relevantes; validacion completa solo cuando el impacto o la integracion la justifiquen |

El numero de archivos o lineas no determina por si solo el riesgo. Un cambio pequeno en recuperacion, rutas o credenciales puede ser de nivel 3.

## Requisitos del entorno

- Node.js y `pnpm` disponibles.
- Dependencias ya instaladas para ejecutar pruebas; no reinstalarlas como parte de una validacion ordinaria.
- Edge instalado para los scripts Playwright, que usan `chromium.launch({ channel: "msedge" })`.
- El build `dist/` actualizado antes de ejecutar directamente los flujos que levantan `vite preview`.
- `pnpm test:real` requiere tres JPG concretos fuera del repositorio. El script falla de forma explicita si no existen.

## Rutas de comprobacion

Estas rutas no son niveles de riesgo. Se seleccionan despues de clasificar el cambio y pueden combinarse cuando exista una dependencia tecnica directa.

### Documentacion o texto sin comportamiento

- Revisa enlaces, rutas, comandos y coherencia con `package.json` y el codigo.
- No requiere build ni pruebas automaticas.

### Regla pura o modulo aislado

Ejecuta la prueba focalizada:

```powershell
pnpm exec vitest run src/domain/sceneConnections.test.ts
```

Sustituye la ruta por la prueba del modulo afectado. Usa `pnpm test` cuando el cambio toque varias reglas de dominio relacionadas.

### TypeScript compartido, persistencia o repositorio de proyecto

```powershell
pnpm typecheck
pnpm test
```

Agrega una prueba focalizada de almacenamiento o repositorio cuando cambien snapshots, indices, carpetas, manifiestos o rutas de assets.

### Interfaz del editor o flujo de usuario

```powershell
pnpm build
pnpm test:e2e
```

El E2E comprueba el flujo guiado, navegacion, conexiones, recuperacion, exportacion, viewer y tablero. Para cambios visuales, agrega una inspeccion manual en la resolucion de escritorio soportada; el E2E por si solo no certifica jerarquia, encuadre ni claridad.

### Importacion y procesamiento multimedia

Para diagnosticos de archivos y mensajes:

```powershell
pnpm build
pnpm test:diagnostics
```

Para cambios en originales, preview, mosaicos, Web Worker, hashes o calidad del canvas:

```powershell
pnpm build
pnpm test:real
```

`test:real` usa tres panoramas 8000 x 4000 locales, verifica que los originales exportados sean identicos byte por byte, valida mosaicos 8 x 4 y abre el viewer. No copies esas fotos al repositorio.

### Escalabilidad, cache y carga diferida

```powershell
pnpm build
pnpm test:large
```

Este flujo importa 50 escenas sinteticas, verifica busqueda, autosave, conexiones lineales, limite de cache, exportacion y carga bajo demanda. No demuestra rendimiento con 50 JPG reales 8K.

### Exportador o minisitio

Empieza por:

```powershell
pnpm exec vitest run src/publisher/exporter.test.ts src/publisher/zipArchive.test.ts
```

Ejecuta despues `pnpm build` y `pnpm test:e2e` si cambiaron archivos generados, rutas, import maps, viewer o apertura local. Usa `test:real` cuando el cambio pueda afectar originales o mosaicos.

### Publicacion

Las pruebas actuales cubren el plan y manifiesto, no una conexion SFTP:

```powershell
pnpm exec vitest run src/publisher/sftpPublisher.test.ts
```

No declares subida, rollback ni verificacion remota como probados. Esas operaciones siguen planeadas.

### Integracion amplia o cierre de hito

```powershell
pnpm test:local
```

Este comando ejecuta build, unitarias, E2E, tres fotos reales, 50 escenas y diagnosticos. Resérvalo para cambios amplios, modificaciones que atraviesen varios subsistemas, preparacion de una entrega o regresiones dificiles de aislar.

## Matriz por tipo de cambio

| Cambio | Minimo | Ampliar cuando |
| --- | --- | --- |
| Documentacion | Revision de rutas y hechos | Cambia comandos operativos |
| Modelo o validacion | Unitarias focalizadas | Cambia schema, exportacion o persistencia |
| Conexiones y navegacion | Unitarias espaciales/conexiones | Cambia editor o viewer: E2E |
| Persistencia/snapshots | Unitarias de storage/repository | Cambia recuperacion completa: E2E |
| UI/CSS | Build + inspeccion localizada | Cambia flujo: E2E |
| Importador | Unitarias/diagnosticos | Cambia pixeles o assets: real |
| Renderer/editor | Build + E2E | Cambia calidad visual: real + manual |
| Exportador/ZIP | Unitarias de publisher + E2E | Cambia multimedia: real |
| Cache/carga diferida | Large | Cambia procesamiento 8K: real |
| Tauri/Rust | Build focalizado de Tauri | Instalador o filesystem: prueba manual Windows |

## Comprobaciones manuales de recorridos virtuales

Cuando cambien visualizacion o interacciones, revisa al menos:

1. El panorama no esta negro, plano, invertido ni deformado.
2. Arrastre, flechas, zoom y restablecimiento mantienen una vista estable.
3. Las conexiones aparecen una sola vez, en la posicion definida y con el destino correcto.
4. La llegada a otra escena conserva una orientacion comprensible.
5. Informacion, imagen, video y enlace se distinguen de conexiones de recorrido.
6. La vista final y el ZIP muestran el mismo proyecto y los mismos hotspots.
7. Fullscreen, indice de escenas, planos y galeria no tapan controles esenciales.
8. Carga, error, recursos faltantes y reintento son visibles.
9. El ZIP extraido abre mediante `ABRIR_TOUR.cmd`; `file://` muestra la instruccion esperada.

Para una aceptacion real, usa `docs/MANUAL_TESTING.md` como guia operativa y registra navegador, resolucion, cantidad de escenas, origen de las fotos y resultado.

## Multimedia y evidencia

- Usa fixtures sinteticos para estructura, errores y escala.
- Usa la demo local para un smoke test sin red.
- Usa fotos reales solo cuando el cambio dependa de detalle, costuras, color, resolucion, memoria o peso.
- No derives una conclusion sobre 30 a 50 panoramas 8K desde el flujo sintetico de 50 escenas.
- No conserves capturas, ZIP o panoramas reales en Git.

## Fallos, reintentos y evidencia previa

- Ante un fallo, determina primero si fue causado por el cambio actual.
- Corrige solo la causa relacionada y repite unicamente las comprobaciones invalidadas.
- Despues de dos intentos fallidos sobre el mismo problema, detente y entrega el diagnostico.
- Reporta fallos ajenos al alcance sin convertirlos automaticamente en trabajo adicional.
- Reutiliza evidencia previa solo si corresponde al mismo codigo y dependencias relevantes, el entorno sigue siendo equivalente, el resultado es verificable y ninguna regla exige repetirla.
- Una afirmacion de otra sesion sin comando, resultado o artefacto verificable no basta como evidencia.
- No repitas builds ni suites sobre un estado que no cambio.

## Condicion de cierre

Una tarea queda validada cuando:

- la comprobacion focalizada cubre el comportamiento cambiado;
- las dependencias directas relevantes no muestran regresion;
- la inspeccion visual se realizo si el criterio era visual;
- se documentaron entorno, comandos y resultado;
- los aspectos no ejecutados quedaron identificados sin presentarlos como aprobados.

Deten el trabajo tambien cuando una decision funcional no este autorizada, se alcance el limite de dos intentos, el alcance crezca de forma sustancial o una comprobacion necesaria requiera una decision del propietario. Una vez cumplida la condicion de cierre, no busques problemas adicionales.
