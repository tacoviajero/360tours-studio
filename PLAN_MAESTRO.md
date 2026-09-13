# 360Tours Studio - Plan maestro del proyecto

## Objetivo del proyecto

Construir una aplicacion local para Windows llamada **360Tours Studio** que permita convertir fotografias panoramicas 360 en recorridos virtuales navegables y publicarlos directamente en TacoViajero.

La aplicacion debe estar pensada para uso personal, local y sin depender de un servidor publico para funcionar.

Flujo esperado:

```text
Fotos 360
↓
360Tours Studio
↓
Crear escenas
↓
Conectar escenas con hotspots
↓
Añadir informacion, plano y galeria
↓
Previsualizar
↓
Validar
↓
Publicar
↓
https://tacoviajero.com/tours/[slug]/
```

La aplicacion no debe depender del sitio comercial de 360Tours.

El sitio comercial vive en:

<https://tacoviajero.com/es/hometours360/>

Los recorridos publicados viven de forma independiente en:

<https://tacoviajero.com/tours/[slug]/>

360Tours Studio es una herramienta de produccion.

---

## 1. Principios de arquitectura

Mantener siempre separadas estas cuatro responsabilidades:

```text
IMPORTAR
↓
MODELAR
↓
EDITAR
↓
PUBLICAR
```

Tambien separar estos componentes:

```text
Editor
≠
Formato del proyecto
≠
Renderer del tour
≠
Publicador
```

El editor nunca debe contener logica inseparable del tour publicado.

El tour publicado debe seguir funcionando aunque 360Tours Studio deje de existir o sea reemplazado por otra aplicacion.

No construir una arquitectura SaaS.

No añadir funciones multiusuario.

No depender de WordPress.

No depender de una base de datos remota.

No introducir infraestructura cloud si no resuelve una necesidad concreta.

---

## 2. Tipo de aplicacion

360Tours Studio debe ser una web app local-first.

Durante desarrollo podra ejecutarse en:

```text
http://localhost:<puerto>
```

La version final debe poder empaquetarse como aplicacion de escritorio para Windows.

Se recomienda evaluar Tauri como contenedor de escritorio.

No usar Electron salvo que exista una razon tecnica clara.

El objetivo final es que el usuario pueda abrir 360Tours Studio desde Windows como cualquier otra aplicacion y trabajar sin conexion a internet.

Internet solo debe ser necesario para publicar tours.

---

## 3. Plataforma objetivo

Plataforma inicial:

- Windows

La logica interna debe mantenerse lo bastante desacoplada como para que una futura version en macOS o Linux no requiera reescribir el nucleo.

Pero no invertir tiempo ahora en soporte multiplataforma.

---

## 4. Stack tecnico recomendado

El stack exacto puede decidirse al iniciar el desarrollo, pero debe mantenerse ligero.

Base recomendada:

- Frontend: TypeScript
- UI: framework ligero o TypeScript puro
- Renderer 360: Marzipano
- Runtime local: Tauri
- Persistencia: filesystem + JSON
- Procesamiento auxiliar: local
- Publicacion: SFTP
- Tour publicado: HTML + CSS + JavaScript + JSON + assets estaticos

No añadir por defecto:

- PostgreSQL
- MySQL
- Firebase
- Supabase
- backend Node publico
- Docker obligatorio
- WordPress
- cloud storage
- auth service

Solo incorporar una dependencia si resuelve una necesidad real.

---

## 5. Flujo real de uso

El flujo final esperado debe ser:

1. Fotografiar una propiedad con Insta360 X5.
2. Copiar las fotografias 360 al equipo.
3. Abrir 360Tours Studio.
4. Crear un nuevo proyecto.
5. Arrastrar las fotografias.
6. Studio crea automaticamente las escenas.
7. Renombrar y ordenar escenas.
8. Abrir una escena.
9. Girar la vista hasta una puerta o zona de paso.
10. Crear hotspot de navegacion.
11. Seleccionar la escena destino.
12. Repetir el proceso.
13. Añadir puntos de informacion.
14. Añadir plano.
15. Añadir galeria.
16. Definir escena inicial.
17. Previsualizar.
18. Validar.
19. Publicar.
20. Obtener URL final.

Ejemplo:

<https://tacoviajero.com/tours/casa-antigua/>

No debe ser necesario editar codigo, JSON ni usar FTP manualmente.

---

## 6. Formato de entrada

### V1

Aceptar fotografias panoramicas equirectangulares:

- JPG
- JPEG

Relacion esperada aproximada:

- 2:1

La Insta360 X5 puede generar fotografias 360 ya procesadas, por lo que este debe ser el flujo preferido inicialmente.

La interfaz no debe obligar al usuario a conocer terminos como:

- equirectangular
- stitching
- projection
- yaw
- pitch

La UI debe limitarse a algo como:

```text
Arrastra aqui tus fotos 360
```

### Importador

Debe validar:

- tipo de archivo
- dimensiones
- relacion aproximada 2:1
- archivo corrupto
- duplicados
- metadatos disponibles
- orientacion basica
- resolucion

No modificar nunca el archivo original.

---

## 7. Soporte futuro para archivos nativos de Insta360

No integrar el SDK de Insta360 en la V1.

Diseñar desde el principio un sistema modular de importadores:

```text
Importer
├── JPEG360Importer
└── Insta360Importer
```

En una version futura se podra evaluar:

```text
INSP
↓
Insta360 Media SDK
↓
stitching
↓
JPG panorama
↓
Studio
```

La integracion con Insta360 debe implementarse como adaptador independiente.

Nunca acoplarla al editor principal.

---

## 8. Estructura local de proyectos

Cada proyecto debe vivir como una carpeta normal.

Ejemplo:

```text
360ToursStudio/
├── projects/
│   ├── casa-antigua/
│   │   ├── project.json
│   │   ├── source/
│   │   ├── panoramas/
│   │   ├── thumbnails/
│   │   ├── gallery/
│   │   ├── floorplans/
│   │   └── .history/
│   │
│   └── demo-van/
│
├── exports/
└── config/
```

### `source/`

Contiene los archivos originales importados. Nunca se modifican.

### `panoramas/`

Contiene las versiones que utiliza el tour.

### `thumbnails/`

Miniaturas generadas para la UI.

### `gallery/`

Fotografias convencionales.

### `floorplans/`

Planos de planta.

### `.history/`

Snapshots de versiones anteriores del proyecto.

---

## 9. Modelo de datos

El proyecto debe tener un formato versionado desde la primera version.

Ejemplo:

```json
{
  "schemaVersion": 1,
  "id": "casa-antigua",
  "title": "Casa Antigua",
  "startScene": "sala",
  "scenes": [],
  "floorplans": [],
  "gallery": [],
  "settings": {}
}
```

Siempre incluir `schemaVersion`.

Esto permitira migrar proyectos antiguos en futuras versiones de Studio.

---

## 10. Modelo de escena

Cada escena debe poder almacenar:

- id
- name
- panorama
- thumbnail
- initialView
- hotspots
- floorplanReference
- metadata

Ejemplo conceptual:

```json
{
  "id": "sala",
  "name": "Sala",
  "panorama": "panoramas/sala.jpg",
  "initialView": {
    "yaw": 1.2,
    "pitch": 0.05,
    "fov": 1.4
  },
  "hotspots": []
}
```

---

## 11. Hotspots

El sistema debe estar diseñado para soportar varios tipos.

### Navegacion

Sirve para pasar de una escena a otra.

```json
{
  "type": "scene",
  "yaw": 1.382,
  "pitch": -0.12,
  "targetScene": "cocina"
}
```

### Informacion

```json
{
  "type": "info",
  "yaw": -0.82,
  "pitch": 0.05,
  "title": "Chimenea",
  "text": "Informacion adicional"
}
```

Tipos preparados desde el modelo:

- scene
- info
- image
- video
- link

No todos necesitan UI avanzada en la primera version, pero el modelo debe permitirlos desde el inicio.

---

## 12. Gestor de proyectos

Pantalla inicial:

```text
360Tours Studio

[ + Nuevo tour ]

Recientes
────────────────────
Casa Antigua       Editar
Demo Van           Editar
Hotel Atitlan      Editar
```

Funciones:

- Crear
- Abrir
- Renombrar
- Duplicar
- Archivar
- Eliminar

Eliminar debe requerir confirmacion fuerte o usar una papelera.

Nunca borrar inmediatamente sin posibilidad de recuperacion.

---

## 13. Importacion de panoramas

Flujo:

```text
Nuevo proyecto
↓
Arrastrar fotografias
↓
Validar
↓
Copiar originales a source/
↓
Crear panoramas/
↓
Crear thumbnails/
↓
Crear escenas
```

Cada archivo debe convertirse automaticamente en una escena.

El nombre inicial puede derivarse del nombre del archivo.

Ejemplo:

```text
IMG_001_SALA.jpg
→
Sala
```

Si el nombre no es util, usar un nombre temporal.

---

## 14. Editor principal

Diseño conceptual:

```text
┌─────────────────────────────────────────────┐
│ Casa Antigua                 Preview Publish│
├───────────┬───────────────────────┬─────────┤
│ Scenes    │                       │ Properties
│           │      PANORAMA         │ Hotspot
│ Entrada   │                       │
│ Sala      │                       │
│ Cocina    │                       │
│ Recamara  │                       │
└───────────┴───────────────────────┴─────────┘
```

No convertir la interfaz en un dashboard recargado.

Priorizar:

- panorama
- escenas
- hotspots
- propiedades
- preview
- publicacion

---

## 15. Gestion de escenas

Permitir:

- Añadir
- Eliminar
- Renombrar
- Reordenar
- Elegir escena inicial
- Cambiar panorama
- Duplicar configuracion

La escena inicial debe poder seleccionarse claramente.

---

## 16. Vista inicial de escena

El usuario debe poder:

```text
abrir escena
↓
girar panorama
↓
ajustar zoom
↓
Set as initial view
```

Guardar:

- yaw
- pitch
- fov

La orientacion inicial del tour debe coincidir exactamente con lo visto en Studio.

---

## 17. Editor visual de hotspots

Para conectar habitaciones:

```text
+ Conectar escena
```

Flujo:

```text
seleccionar herramienta
↓
clic sobre puerta/pasillo
↓
seleccionar escena destino
↓
guardar
```

Debe poder:

- mover hotspot
- editar
- cambiar destino
- eliminar

La colocacion debe ser visual.

El usuario nunca debe introducir manualmente yaw o pitch.

---

## 18. Puntos de informacion

Herramienta:

```text
+ Informacion
```

Flujo:

```text
clic sobre objeto
↓
Titulo
↓
Texto
↓
guardar
```

Preparar soporte futuro para:

- imagen
- video
- link

---

## 19. Plano de planta

Incluir desde la primera version funcional.

Flujo:

```text
Añadir plano
↓
seleccionar PNG/JPG
↓
abrir editor de plano
↓
colocar marcador
↓
vincular marcador con escena
```

El visitante debe poder hacer clic en un marcador del plano y cambiar de escena.

Al cambiar de escena, el plano debe indicar la ubicacion actual.

Soportar multiples plantas:

- Planta baja
- Primer piso
- Segundo piso

---

## 20. Galeria

Permitir añadir fotografias convencionales.

Funciones:

- importar
- ordenar
- eliminar
- caption opcional

La galeria debe estar disponible dentro del tour publicado.

No mezclar fotografias convencionales con escenas 360.

---

## 21. Menu de escenas

El tour publicado debe tener una navegacion alternativa a los hotspots.

Ejemplo:

```text
☰ Recorrido

Exterior
Entrada
Sala
Cocina
Recamara 1
Recamara 2
Baño
```

En movil debe funcionar como drawer.

Nunca depender exclusivamente de los hotspots.

---

## 22. Fullscreen

El tour debe soportar:

- inline
- fullscreen

El cambio a fullscreen no debe recargar la pagina.

Debe funcionar correctamente en movil y desktop dentro de las limitaciones del navegador.

---

## 23. Preview

El preview debe utilizar exactamente el mismo renderer que produccion.

Arquitectura:

```text
project.json
      │
      ├── Studio Preview
      └── Published Viewer
```

No construir un preview diferente.

Evitar inconsistencias entre lo que se ve en Studio y lo que se publica.

---

## 24. Renderer

Usar Marzipano como motor inicial.

El renderer debe ser independiente del editor.

Debe recibir:

```text
tour.json
+
assets
```

Y construir:

- panoramas
- hotspots
- menu
- plano
- galeria
- fullscreen

El editor solo modifica datos.

El renderer interpreta esos datos.

---

## 25. Guardado

Implementar autosave local.

Guardar cambios importantes automaticamente en:

```text
project.json
```

No escribir en disco por cada pequeño movimiento continuo si eso afecta rendimiento.

Usar checkpoints razonables.

---

## 26. Historial

Crear snapshots automaticos:

```text
.history/
├── 2026-09-11T220500.json
├── 2026-09-11T221200.json
└── ...
```

El objetivo es recuperar proyectos dañados o cambios accidentales.

No necesita ser un sistema Git completo.

---

## 27. Validacion continua

Studio debe detectar problemas mientras se trabaja.

Ejemplos:

- Cocina no tiene ninguna salida
- Recamara 2 no es accesible
- Plano apunta a escena eliminada
- Falta escena inicial
- Archivo panorama no existe

Mostrar un estado general del proyecto:

```text
Casa Antigua

✓ 12 panoramas
✓ Escena inicial
✓ 18 conexiones
✓ Plano
✓ Galeria
✓ Validacion

Ready to publish
```

---

## 28. Validador antes de publicar

Antes de publicar, comprobar:

- todos los archivos existen
- escena inicial valida
- hotspots validos
- destinos existentes
- slugs validos
- nombres no conflictivos
- assets generados
- planos consistentes
- galeria valida
- renderer funcional
- index.html generado

No publicar si existe un error critico.

---

## 29. Optimizacion de imagenes

No servir directamente los originales de 72 MP si eso perjudica rendimiento.

El pipeline de build debe generar assets adecuados para web.

Considerar:

- multiresolution
- tiles
- niveles de zoom
- thumbnails
- JPEG optimizado

Conservar siempre el archivo original.

El usuario no debe tener que optimizar manualmente cada fotografia.

---

## 30. Exportacion

Aunque exista publicacion automatica, mantener siempre una funcion:

```text
Export tour
```

Debe generar una carpeta autocontenida.

Ejemplo:

```text
casa-antigua/
├── index.html
├── tour.json
├── viewer.js
├── viewer.css
├── panoramas/
├── gallery/
└── floorplans/
```

El resultado debe poder alojarse en cualquier servidor web estatico.

Esto evita dependencia de TacoViajero.

---

## 31. Publicacion directa

Boton:

```text
Publicar
```

Flujo:

```text
validar
↓
build
↓
optimizar assets
↓
subir por SFTP
↓
verificar
↓
activar version
↓
devolver URL
```

Ejemplo:

```text
Slug:
casa-antigua

URL:
https://tacoviajero.com/tours/casa-antigua/
```

---

## 32. Publicacion segura

No subir directamente encima de la version existente.

Usar deploy temporal.

Ejemplo:

```text
/tours/.deploy/casa-antigua-XYZ/
```

Despues:

```text
validar subida
↓
swap
↓
produccion
```

Evitar dejar tours parcialmente publicados si se corta internet.

---

## 33. Cuenta SFTP dedicada

Crear una cuenta exclusiva para 360Tours Studio.

Ejemplo:

```text
360tours-publisher
```

Debe tener acceso unicamente a:

```text
/tours/
```

Nunca otorgar acceso completo a:

```text
/public_html/
```

La aplicacion no debe almacenar credenciales del hosting principal.

---

## 34. Credenciales

En Windows, guardar credenciales usando el almacen seguro del sistema.

No guardar:

- usuario
- password
- private key

en texto plano dentro de:

```text
config.json
```

---

## 35. Actualizacion de tours existentes

Studio debe saber si un proyecto ya fue publicado.

Mostrar:

```text
Publicado
Ultima publicacion: [fecha]
URL: [url]
```

Boton:

```text
Actualizar publicacion
```

Antes de reemplazar una version publicada, conservar rollback.

---

## 36. Versiones publicadas y rollback

Mantener la capacidad de volver a una version anterior.

Puede implementarse:

- localmente
- mediante carpetas de versiones en el servidor

Ejemplo conceptual:

```text
/tours/.versions/casa-antigua/
```

El mecanismo exacto debe elegirse buscando simplicidad y seguridad.

---

## 37. Experiencia de publicacion

Despues de publicar correctamente, mostrar:

```text
Publicado correctamente

https://tacoviajero.com/tours/casa-antigua/

[ Abrir tour ]
[ Copiar URL ]
```

No mostrar logs tecnicos salvo que haya un error.

---

## 38. Manejo de errores

Cubrir al menos:

- archivo corrupto
- formato invalido
- duplicado
- disco lleno
- permisos insuficientes
- proyecto incompleto
- hotspot roto
- escena eliminada
- conexion caida
- SFTP inaccesible
- credenciales invalidas
- deploy incompleto
- fallo de build
- slug ya existente

Los errores deben explicar que ocurrio y que puede hacer el usuario.

---

## 39. Recuperacion ante fallos

Nunca perder un proyecto por:

- cierre inesperado
- crash
- apagado
- error de publicacion

Autosave + historial deben permitir recuperacion.

---

## 40. Rendimiento

La aplicacion debe poder manejar proyectos con multiples panoramas de alta resolucion sin bloquear innecesariamente la UI.

Considerar:

- lazy loading
- workers
- procesamiento en background local
- thumbnails
- carga progresiva

No cargar todas las imagenes a resolucion completa simultaneamente.

---

## 41. Accesibilidad del editor

Aunque sea una herramienta personal, mantener:

- botones claros
- labels
- contraste suficiente
- focus states
- atajos razonables
- tooltips donde aporten valor

No depender exclusivamente de iconos ambiguos.

---

## 42. UX general

La aplicacion debe poder usarse sin conocimientos tecnicos.

La interfaz no debe mostrar terminos como:

- yaw
- pitch
- projection
- WebGL
- equirectangular
- SFTP path
- schema

salvo en una seccion avanzada de diagnostico.

---

## 43. Alcance funcional del MVP robusto

La primera version utilizable debe incluir:

- gestor de proyectos
- importacion de JPG 360
- escenas
- renombrado
- orden
- escena inicial
- orientacion inicial
- hotspots de navegacion
- info points
- menu de escenas
- fullscreen
- plano
- varios pisos
- galeria
- preview
- autosave
- historial
- validacion
- optimizacion
- exportacion
- publicacion directa
- actualizacion
- rollback basico

---

## 44. Funciones fuera de alcance por ahora

No construir todavia:

- clientes
- usuarios
- login
- roles
- equipos
- edicion colaborativa
- cloud editor
- SaaS
- facturacion
- suscripciones
- pagos
- CRM
- analytics avanzados
- IA para detectar habitaciones
- IA para colocar hotspots
- modelo 3D tipo Matterport
- mobile editor
- control directo de camara
- sincronizacion automatica cloud

---

## 45. Posibles extensiones futuras

La arquitectura debe permitir añadir sin reescribir el nucleo:

- logos por cliente
- branding
- plantillas
- videos
- audio
- deep links por escena
- analytics
- QR
- auto-tour
- comparacion before/after
- medidas
- hotspots avanzados
- formularios dentro del tour
- capas
- mapas
- categorias
- duplicacion de propiedades
- biblioteca de assets

---

## 46. Estrategia de desarrollo

Desarrollar por fases.

### Fase A - Nucleo tecnico

Construir:

- project schema
- filesystem
- renderer Marzipano
- tour.json
- 3 panoramas
- hotspots manuales

Criterio de exito:

- Un JSON genera un tour navegable.

No empezar por una UI compleja.

### Fase B - Editor basico

Construir:

- project manager
- importacion
- scene list
- panorama viewer
- hotspot editor
- autosave

Criterio de exito:

- Crear un recorrido completo sin tocar codigo.

### Fase C - Funcionalidad de producto

Añadir:

- info points
- scene menu
- fullscreen
- floorplan
- multiple floors
- gallery
- preview
- validator

Criterio de exito:

- Crear un tour 360 que pueda entregarse a un cliente.

### Fase D - Pipeline web

Añadir:

- optimizacion
- tiles
- build estatico
- exportacion reproducible

Criterio de exito:

- El tour exportado funciona correctamente en un servidor web.

### Fase E - Publicacion

Añadir:

- SFTP
- credenciales seguras
- deploy temporal
- verificacion
- activacion
- actualizacion
- rollback

Criterio de exito:

- Pulsar Publicar genera un tour accesible en TacoViajero.

### Fase F - Robustez

Probar:

- proyectos grandes
- archivos corruptos
- sesiones largas
- escenas eliminadas
- hotspots rotos
- caracteres especiales
- nombres duplicados
- internet interrumpido
- servidor caido
- disco lleno
- build fallido
- update fallido
- rollback

---

## 47. Primer hito obligatorio

Antes de trabajar en funcionalidades secundarias, demostrar el flujo completo:

```text
3 JPG 360
↓
crear escenas
↓
conectar hotspots
↓
guardar
↓
cerrar Studio
↓
reabrir
↓
preview
↓
exportar
↓
publicar
↓
abrir tour desde internet
```

Si este flujo no funciona de extremo a extremo, no avanzar a funciones decorativas.

---

## 48. Orden de prioridades

Prioridad 1:

- integridad de proyectos

Prioridad 2:

- editor usable

Prioridad 3:

- renderer estable

Prioridad 4:

- publicacion segura

Prioridad 5:

- performance

Prioridad 6:

- funciones adicionales

Nunca sacrificar integridad de datos o seguridad de publicacion por velocidad de implementacion.

---

## 49. Criterios de exito del proyecto

360Tours Studio estara listo para uso real cuando pueda:

- abrir en Windows
- crear proyecto
- importar fotos de la X5
- crear escenas automaticamente
- renombrarlas
- conectarlas visualmente
- añadir informacion
- añadir plano
- añadir galeria
- definir navegacion
- previsualizar
- cerrar
- reabrir sin perder informacion
- detectar errores
- optimizar imagenes
- exportar
- publicar con un boton
- actualizar un tour existente
- recuperarse de una publicacion fallida

---

## 50. Resultado final esperado

El uso habitual debe reducirse a:

```text
Fotos
↓
Studio
↓
Editar
↓
Preview
↓
Publicar
```

El producto publicado debe ser una aplicacion web estatica autonoma.

Ejemplo:

<https://tacoviajero.com/tours/casa-antigua/>

360Tours Studio debe ser una herramienta robusta, local, simple de usar y tecnicamente desacoplada.

No construir una plataforma generica antes de necesitarla.

No convertir el proyecto en SaaS.

No introducir dependencias sin una justificacion concreta.

No sobrearquitectar.

La aplicacion debe hacer una sola cosa extremadamente bien:

> Recibir fotografias 360, convertirlas en un recorrido virtual profesional y publicarlo de forma segura con el minimo trabajo manual posible.

---

## Lectura tecnica del plan

Este plan define 360Tours Studio como una herramienta local-first de produccion, no como un SaaS ni como una extension de WordPress. La decision central es separar el editor, el formato del proyecto, el renderer del tour y el publicador para que los tours exportados sean autonomos y sigan funcionando aunque Studio cambie o desaparezca.

La ruta de desarrollo correcta empieza por el nucleo: formato versionado, filesystem, renderer Marzipano y un tour generado desde JSON. Despues debe venir el editor basico, y solo cuando el flujo minimo funcione de extremo a extremo se deben añadir funcionalidades de producto, optimizacion y publicacion segura.

Las reglas que deben guiar el desarrollo son:

- preservar siempre los originales en `source/`
- guardar el estado en `project.json` con `schemaVersion`
- usar preview y produccion con el mismo renderer
- exportar tours estaticos autocontenidos
- publicar por SFTP con deploy temporal, verificacion, activacion y rollback
- ocultar complejidad tecnica al usuario final
- no añadir infraestructura ni dependencias sin necesidad concreta
