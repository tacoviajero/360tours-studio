# PROMPT DE IMPLEMENTACIÓN TÉCNICA: Mejoras en 360Tours Studio

> **Instrucciones para el Agente:**  
> Eres un desarrollador Senior especializado en TypeScript, Rust (Tauri), WebGL y arquitectura local-first.  
> Tu objetivo es implementar un conjunto de mejoras de navegación, automatización y visualización en el proyecto **360Tours Studio** siguiendo las especificaciones técnicas detalladas a continuación.  
> Respeta las reglas fundamentales del proyecto: **cero dependencias cloud (No-SaaS), funcionamiento 100% offline, datos en `project.json` y paridad absoluta entre el editor y el minisitio exportado.**

---

## CONTEXTO Y STACK TÉCNICO

* **Entorno:** Aplicación de escritorio Tauri 2 (Rust) + Frontend en Vite + TypeScript + pnpm.
* **Renderizado 360:** Photo Sphere Viewer / Three.js / Canvas WebGL.
* **Persistencia:** Archivos locales `project.json`, assets en carpetas locales y exportación a ZIP estático autónomo.
* **Comandos de validación:** `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

---

## REQUERIMIENTOS A IMPLEMENTAR

```
                                  MAPA DE MEJORAS
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ 1. Auto-enlace en Lote   → Conexión lineal automática (Ida y Vuelta)       │
  │ 2. Continuidad de Rumbo  → North Offset y cálculo de Target Yaw             │
  │ 3. Navegación StreetView → Teclas W/S/Flechas y Clic Direccional            │
  │ 4. Paridad de Hotspots   → Exportar etiquetas naranjas idénticas a la web   │
  │ 5. Minimapa / Plano      → Soporte para plano 2D / escaneo LiDAR con Three  │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

### TAREA 1: Auto-enlace Secuencial en Lote (Batch Sequential Linker)

**Problema:** Conectar manualmente decenas de fotos tomadas en línea recta (pasillos, calles) requiere crear hotspots uno por uno repetitivamente.

**Especificación Técnica:**
1. **Interfaz:** Añadir un botón en la barra de herramientas de escenas: `"Auto-conectar Secuencia"`.
2. **Lógica de Conexión:**
   * Tomar la lista de escenas en el orden en que fueron importadas (`01`, `02`, `03`... o por timestamp).
   * Para cada par de escenas consecutivas (`Escena[i]` y `Escena[i+1]`):
     * **Hotspot de Avance:** Crear un hotspot de tipo `navigation` en `Escena[i]` que apunte a `Escena[i+1]` con posición por defecto: `yaw: 0`, `pitch: 0`. Etiqueta: *"Ir a [Nombre Escena i+1]"*.
     * **Hotspot de Retorno (Bidireccional):** Crear un hotspot en `Escena[i+1]` que apunte a `Escena[i]` con posición opuesta: `yaw: 180` ($\pi\text{ rad}$), `pitch: 0`. Etiqueta: *"Ir a [Nombre Escena i]"*.
3. **Persistencia:** Guardar la estructura en `project.json` dentro del array `hotspots` de cada escena respectiva, permitiendo Deshacer/Rehacer (`Ctrl+Z` / `Ctrl+Y`).

---

### TAREA 2: Continuidad de Orientación (North Offset / Target Yaw)

**Problema:** Al saltar de una escena a otra, la cámara a menudo aterriza mirando en un ángulo arbitrario, desorientando al usuario.

**Especificación Técnica:**
1. **Ampliación del Schema (`project.json`):**
   * Añadir un campo opcional a cada escena: `northOffset?: number` (en grados $0^\circ$ a $360^\circ$ o radianes, representando la desviación del frente respecto al Norte o eje de referencia).
   * Añadir en cada hotspot de navegación: `targetYaw?: number` (ángulo inicial deseado al aterrizar en la nueva escena).
2. **Editor de Calibración:**
   * En el panel de propiedades de la escena activa, permitir definir o ajustar el "Norte / Frente de referencia" (mediante un control numérico o botón *"Fijar orientación actual como frente"*).
3. **Cálculo de Transición en el Viewer:**
   * Al hacer clic en un hotspot con rumbo calibrado:
     $$\text{Target Yaw} = (\text{Current Yaw} + (\text{EscenaDestino.northOffset} - \text{EscenaOrigen.northOffset})) \pmod{360^\circ}$$
   * Si no hay offset configurado, orientar la cámara hacia el `targetYaw` especificado en el hotspot para mantener la sensación de avanzar en línea recta.

---

### TAREA 3: Navegación Estilo Street View (Teclado y Clic Direccional)

**Problema:** Las flechas solo rotan la cámara. No hay forma de "caminar" o avanzar haciendo clic en el piso o con el teclado.

**Especificación Técnica:**
1. **Navegación por Teclado (`W` / `Flecha Arriba` y `S` / `Flecha Abajo`):**
   * Al presionar `W` o `ArrowUp`:
     * Obtener el `currentYaw` de la cámara.
     * Buscar entre todos los hotspots de navegación de la escena activa si existe alguno dentro de un cono de $\pm 45^\circ$ respecto a `currentYaw`.
     * Si existe, ejecutar la transición hacia esa escena.
   * Al presionar `S` o `ArrowDown`:
     * Buscar si existe un hotspot en dirección trasera ($(currentYaw + 180^\circ) \pm 45^\circ$) y activarlo.
   * `A` / `D` y `Flechas Izquierda / Derecha`: Mantener la rotación suave del panorama.
2. **Clic / Tap en el Espacio ("Click-to-Move"):**
   * Escuchar eventos de clic/doble clic o toque en el canvas 360.
   * Convertir las coordenadas de pantalla del clic en coordenadas esféricas (`yaw`, `pitch`).
   * Si el clic ocurre en un radio de proximidad angular ($\le 30^\circ$) de un hotspot de navegación, activar la transición a esa escena sin exigir precisión milimétrica sobre el icono.
3. **Compatibilidad:** Esta lógica debe funcionar idénticamente en:
   * El Preview interactivo de **Studio**.
   * El minisitio compilado en `dist/` (visor exportado).

---

### TAREA 4: Paridad Visual de Hotspots (Etiquetas Naranjas en el Viewer Exportado)

**Problema:** En el editor de Studio se ven etiquetas naranjas claras tipo píldora (*"Ir a Cocina"*, *"Ir a Entrada"*), pero en el minisitio exportado final o en móvil no se renderizan con el mismo estilo.

```
                  DISEÑO DE LA ETIQUETA VISUAL
       ┌─────────────────────────────────────────────────┐
       │   (➜)  Ir a Recamara 1                          │  ← Fondo naranja translúcido
       └─────────────────────────────────────────────────┘    Borde blanco / Sombra suave
```

**Especificación Técnica:**
1. **Exportación de Estilos CSS:**
   * Asegurar que las clases CSS de las etiquetas de hotspots (`.hotspot-pill`, `.hotspot-badge`, `.hotspot-nav-label`) estén incluidas en el bundle de exportación (`viewer/styles.css` o incrustadas en el ZIP).
2. **Renderizado en Photo Sphere Viewer / WebGL:**
   * Utilizar marcadores HTML overlay para que el texto sea legible y nítido independientemente de la resolución de la foto.
3. **Optimización Móvil (Touch UI):**
   * Asegurar que el área de toque (`hitbox`) de cada hotspot sea de al menos $44 \times 44\text{ px}$.
   * Añadir soporte táctil sin retardo (`touchstart` / `pointerdown`).

---

### TAREA 5: Soporte de Minimapa 2D (Planos LiDAR / Arquitectónicos)

**Problema:** El usuario puede escanear propiedades con el sensor LiDAR de su iPhone y obtener un plano 2D/3D (`plano.png` o `.glb`), pero el tour necesita un componente para visualizarlo.

**Especificación Técnica:**
1. **Configuración de Plano en `project.json`:**
   * Añadir estructura opcional en el proyecto:
     ```json
     "floorplan": {
       "image": "assets/floorplan.png",
       "markers": [
         { "sceneId": "scene-01", "x": 120, "y": 250, "label": "Entrada" },
         { "sceneId": "scene-02", "x": 200, "y": 250, "label": "Sala" }
       ]
     }
     ```
2. **Widget de Minimapa en el Viewer:**
   * Componente plegable/flotante en la esquina inferior del tour.
   * Muestra el plano 2D, resalta con un radar/pin la escena activa y la dirección de la mirada (`camera.yaw`).
   * Al hacer clic en un pin del plano, transicionar a esa escena 360.

---

## CRITERIOS DE ACEPTACIÓN Y VALIDACIÓN

1. **TypeScript & Tipos:** Ejecutar `pnpm typecheck` sin errores de compilación.
2. **Pruebas Unitarias & Integración:** Ejecutar `pnpm test` (Vitest) y asegurar que todas las pruebas existentes y nuevas (cálculo de ángulos de hotspots y auto-enlace) pasen al 100%.
3. **Pruebas E2E:** Ejecutar `pnpm test:e2e` y verificar que el ZIP exportado contenga los estilos visuales de los hotspots y que el viewer abra correctamente en navegador.
4. **Retrocompatibilidad:** Proyectos antiguos creados sin `northOffset` o `floorplan` deben abrir y exportarse sin errores.
