import "../styles/progress.css";
import { ArrowLeft, createElement } from "lucide";

type Status = "done" | "progress" | "pending";

interface PlanPoint {
  id: number;
  title: string;
  phase: "Base" | "Editor" | "Producto" | "Pipeline" | "Publicacion" | "Robustez";
  percent: number;
  status: Status;
  evidence: string;
  next: string;
}

  const lastUpdated = "6 octubre 2026";
  const recentChanges = [
    "El tablero de avances ahora incluye un acceso directo para volver al editor de 360Tours Studio.",
    "El nombre del tour se edita directamente al inicio de la barra de escenas y se sincroniza con el Header y Recientes tras guardarse.",
    "La marca del Header tiene mayor presencia y el navegador inferior usa un control segmentado uniforme con flechas, nombre de escena y tipografia armonizada.",
    "La marca 360Tours Studio ocupa completa la celda izquierda del Header; el nombre del tour y su estado comparten una linea separados por un guion.",
    "360Tours Studio ahora vive en un Header que cruza todo el editor; las tres columnas comienzan debajo de una sola barra global.",
    "La barra de escenas ya no repite marca ni descripcion y sus listas, estadisticas y botones ajustan texto sin desbordarse.",
    "La barra de herramientas hereda una escala tipografica comun; Plano, Galeria, Validacion, Historial y Publicacion ya no usan tamanos aislados.",
    "La barra central ahora usa solo iconos convencionales con tooltips claros para paneles, deshacer, rehacer, vista final, exportacion y mas acciones.",
    "El sistema tipografico redujo tamanos y pesos; Recorrido ahora es una lista compacta sin tarjetas pesadas ni negritas innecesarias.",
    "El editor de escritorio fija columnas compactas de 224 y 274 px; a 1366x768 el visor 360 conserva la mayor parte de la pantalla.",
    "Escena activa usa nombre en linea, orden por iconos, acciones ligeras y eliminacion dentro del menu contextual.",
    "Puntos interactivos se crean desde un solo menu Anadir y cada punto expande sus campos solo cuando se edita.",
    "La cabecera del editor ahora separa contexto, paneles y salida; Proyecto, historial y tareas secundarias viven en un solo menu Acciones.",
    "Vista final ahora elige automaticamente entre panoramas simples y mosaicos; tambien abre proyectos antiguos sin mostrar el error de adaptador.",
    "La barra superior es mas compacta: nombre y direccion web pasaron a Proyecto, y Recorrido, Validacion y Exportacion inician plegados.",
    "Hotspots, slug y mosaicos WebGL ahora se presentan como Puntos interactivos, Direccion web e Imagenes optimizadas.",
    "La prueba E2E usa 1366x768 como minimo oficial y cubre Vista final con y sin mosaicos y retroalimentacion visible al descargar el ZIP.",
    "El editor ya permite orientar el panorama con flechas, ajustar zoom con mas/menos y restablecer la vista con Inicio.",
    "La auditoria E2E recorre por teclado carga de demo, escenas, panorama, Acciones y Vista final; tambien rechaza controles sin nombre accesible.",
    "Los selectores de archivo ocultos salieron del orden de tabulacion y sus etiquetas visibles se activan con Enter o Espacio.",
    "La demo tecnica ahora genera y almacena tres panoramas locales; Vista final ya no depende de marzipano.net ni de permisos CORS.",
    "La Vista final WebGL ahora atrapa el foco dentro del dialogo, lo devuelve al cerrar y conserva navegacion por flechas y Escape.",
    "Cada ZIP exportado incluye ABRIR_TOUR.cmd, un servidor local PowerShell e instrucciones; abrir index.html como file:// ya muestra ayuda en vez de una pantalla negra.",
    "La prueba con los 3 JPG reales ahora valida detalle visual horizontal/vertical y variedad de color; ya no acepta un canvas negro o con salida degenerada.",
    "El servidor local deja de vigilar las carpetas de fotos 8K para evitar cierres EBUSY de Vite en Windows.",
  "Se agrego pnpm test:local para validar build, browser, 3 fotos reales, 50 escenas, diagnosticos y viewer exportado sin instalar la app.",
  "El panel Exportacion ahora muestra el flujo local recomendado antes de pensar en instalacion o publicacion.",
  "El viewer exportado ahora carga panoramas bajo demanda y precarga solo escenas cercanas/conectadas.",
  "El renderer del editor y del viewer exportado cachea pixeles por escena para no releer la imagen en cada movimiento.",
  "test:large ahora verifica que un tour de 50 escenas no cargue la escena 050 hasta seleccionarla.",
  "La lista de escenas ahora tiene busqueda por nombre/numero/id, verificada dentro de la prueba de 50 escenas.",
  "La importacion ahora avisa dimensiones exactas cuando una imagen JPG no parece panoramica 360 2:1.",
  "La lista de escenas ahora muestra resumen de escenas, conexiones y panoramas optimizados.",
  "Cada escena muestra estado de conexion, peso optimizado y reduccion aproximada para auditar tours grandes.",
  "La importacion ahora conserva avisos visibles aunque parte del lote haya importado correctamente.",
  "Se agrego test:diagnostics para lote mixto con archivos validos, duplicado e invalido.",
  "Se agrego prueba automatizada test:large con 50 escenas: importacion, autosave, ruta rapida, export y viewer.",
  "La importacion ahora procesa panoramas por cola con progreso visible para evitar picos de memoria.",
  "El menu del viewer exportado ahora es scrollable y funciona con 50 escenas.",
  "La importacion guarda metadata de optimizacion por panorama: tamano original, tamano exportado, bytes y calidad.",
  "El deploy-manifest ahora incluye metadata de panoramas para auditar archivos grandes.",
  "Publicacion ahora tiene checklist seguro: temporal, verificacion, respaldo, activacion y verificacion publica.",
  "El manifiesto de despliegue ahora sale del modulo de publicacion y queda cubierto por pruebas unitarias.",
  "Se agrego prueba automatizada con las 3 fotos reales de la van: importacion, autosave, recorrido lineal, export y viewer.",
  "El editor ahora tiene modo Preparar rapido para fijar inicio y rehacer un recorrido lineal.",
  "El panel Recorrido muestra las escenas en orden y permite reparar conexiones lineales.",
  "El ZIP exportado incluye deploy-manifest.json con slug, ruta publica y lista de archivos para publicacion.",
  "Se genero de nuevo el instalador Windows NSIS con el estado actual de la app.",
  "El editor ya renderiza panoramas reales 8000x4000 con visor canvas 360 interactivo.",
  "La importacion de varias fotos crea un recorrido lineal automaticamente con conexiones anterior/siguiente.",
  "El tour exportado ya usa el mismo visor canvas, probado desde ZIP con las 3 fotos reales de la van."
];

const points: PlanPoint[] = [
  { id: 1, title: "Principios de arquitectura", phase: "Base", percent: 90, status: "done", evidence: "Separacion Importar, Modelar, Editar y Publicar ya existe en modulos.", next: "Mantener la separacion al agregar Tauri y SFTP real." },
  { id: 2, title: "Tipo de aplicacion", phase: "Base", percent: 92, status: "done", evidence: "Web app local-first, shell Tauri, ejecutable Windows e instaladores MSI/NSIS ya compilan.", next: "Pulir instalacion final e iconografia." },
  { id: 3, title: "Plataforma objetivo", phase: "Base", percent: 78, status: "progress", evidence: "Configuracion Tauri define ventana Windows, carpeta local de datos, build x64 generado y lectura/escritura nativa conectada al editor.", next: "Abrir el binario instalado y probar guardado nativo con datos reales." },
  { id: 4, title: "Stack tecnico recomendado", phase: "Base", percent: 92, status: "done", evidence: "TypeScript, Vite, canvas renderer, pnpm, Tauri CLI/API y export estatico implementados.", next: "Agregar SFTP sin inflar dependencias." },
  { id: 5, title: "Flujo real de uso", phase: "Editor", percent: 92, status: "progress", evidence: "El editor guia importar, conectar, revisar cada escena y exportar con un medidor de 4 etapas; pnpm test:local valida el recorrido completo.", next: "Realizar una prueba manual de aceptacion sin instrucciones externas." },
  { id: 6, title: "Formato de entrada V1", phase: "Base", percent: 100, status: "done", evidence: "Importador acepta JPG/JPEG 2:1, conserva el archivo original byte por byte y se probo con panoramas reales 8000x4000.", next: "Mantener pruebas con otros modelos de camara." },
  { id: 7, title: "Soporte futuro Insta360", phase: "Base", percent: 30, status: "progress", evidence: "Arquitectura de importadores ya permite adaptadores.", next: "Crear stub formal Insta360Importer cuando toque V2." },
  { id: 8, title: "Estructura local de proyectos", phase: "Pipeline", percent: 75, status: "progress", evidence: "La app ya guarda y abre carpetas editables con project.json, assets y .history/; Tauri puede guardar y recuperar la copia local del proyecto actual.", next: "Agregar selector nativo de carpeta externa en Windows." },
  { id: 9, title: "Modelo de datos", phase: "Base", percent: 90, status: "done", evidence: "TourProject versionado con schemaVersion 1.", next: "Agregar migraciones al cambiar schema." },
  { id: 10, title: "Modelo de escena", phase: "Base", percent: 85, status: "done", evidence: "Escenas con id, nombre, panorama, vista inicial, hotspots y metadata.", next: "Soportar cambio de panorama por escena." },
  { id: 11, title: "Hotspots", phase: "Editor", percent: 92, status: "done", evidence: "Modelo y UI cubren scene, info, image, video y link con validacion basica de URL.", next: "Pulir iconos/estilos por tipo y arrastre directo." },
  { id: 12, title: "Gestor de proyectos", phase: "Editor", percent: 76, status: "progress", evidence: "Nuevo, abrir carpeta, recientes, demo local sin red, duplicar, autosave y eliminar proyecto con limpieza de historial/assets funcionando.", next: "Agregar archivar y busqueda." },
  { id: 13, title: "Importacion de panoramas", phase: "Editor", percent: 100, status: "done", evidence: "La cola crea por escena un original intacto, preview 2048px, thumbnail, mosaicos 360, SHA-256 y conexiones lineales; los fallos parciales se limpian y se informan.", next: "Mantener compatibilidad al ampliar formatos de entrada." },
  { id: 14, title: "Editor principal", phase: "Editor", percent: 99, status: "done", evidence: "Layout de escritorio probado desde 1366x768, Header global de lado a lado, columnas de 224/274 px, visor dominante e iconos con tooltips.", next: "Recoger observaciones de una sesion real con 30 a 50 escenas." },
  { id: 15, title: "Gestion de escenas", phase: "Editor", percent: 88, status: "progress", evidence: "Renombrar, reordenar, eliminar, escena inicial, navegacion anterior/siguiente, conexion lineal automatica, resumen y busqueda para tours grandes ya existen.", next: "Duplicar configuracion y cambiar panorama." },
  { id: 16, title: "Vista inicial de escena", phase: "Editor", percent: 82, status: "progress", evidence: "Guardar vista actual toma yaw, pitch y fov desde el visor canvas.", next: "Probar consistencia exacta en tour exportado." },
  { id: 17, title: "Editor visual de hotspots", phase: "Editor", percent: 98, status: "done", evidence: "Los hotspots se colocan, seleccionan y arrastran visualmente; deshacer y rehacer restauran movimientos, altas y eliminaciones.", next: "Evaluar ajuste fino de coordenadas tras la prueba manual." },
  { id: 18, title: "Puntos de informacion", phase: "Producto", percent: 86, status: "done", evidence: "Info, imagen, video y link se crean, editan, validan y exportan; info/media abren panel en el tour publicado.", next: "Detectar formatos embebibles de video con mensajes mas claros." },
  { id: 19, title: "Plano de planta", phase: "Producto", percent: 86, status: "done", evidence: "Importa multiples plantas, cambia la planta activa, renombra, elimina y ubica marcadores por escena; el export tambien permite alternar plantas.", next: "Agregar arrastre directo de marcadores y miniaturas de plano." },
  { id: 20, title: "Galeria", phase: "Producto", percent: 74, status: "progress", evidence: "Importar, previsualizar miniaturas, editar caption, eliminar y ordenar fotos ya funciona.", next: "Agregar reordenamiento por arrastre y vista ampliada." },
  { id: 21, title: "Menu de escenas", phase: "Producto", percent: 98, status: "done", evidence: "Studio y viewer final incluyen listas scrollables; la columna de escenas ocupa 224 px y conserva busqueda, resumen y miniaturas.", next: "Validar la exploracion manual de un recorrido real con 30 a 50 escenas." },
  { id: 22, title: "Fullscreen", phase: "Producto", percent: 92, status: "done", evidence: "Studio y tour exportado abren el visor WebGL en pantalla completa sin recarga.", next: "QA en Chrome y Edge de escritorio." },
  { id: 23, title: "Preview", phase: "Producto", percent: 100, status: "done", evidence: "El editor usa previews ligeros y Vista final elige mosaicos o panorama normal segun los assets disponibles, con navegacion, puntos interactivos y teclado.", next: "QA con mas camaras y navegadores." },
  { id: 24, title: "Renderer", phase: "Producto", percent: 100, status: "done", evidence: "El tour final usa Photo Sphere Viewer sobre WebGL y mosaicos de alta resolucion generados desde el original; la comprobacion visual pasa con los 3 JPG reales.", next: "Mantener las pruebas visuales al evolucionar el viewer." },
  { id: 25, title: "Guardado", phase: "Robustez", percent: 94, status: "done", evidence: "Autosave local, indicador visible, errores de cuota recuperables, guardar/abrir carpeta y puente de escritura nativa implementados.", next: "Probar guardado nativo solo cuando vuelva a priorizarse la app instalada." },
  { id: 26, title: "Historial", phase: "Robustez", percent: 90, status: "progress", evidence: "Snapshots manuales y preventivos, restauracion UI, recuperacion automatica y respaldo ZIP editable con historial incluido.", next: "Restaurar snapshots importados conservando sus fechas originales." },
  { id: 27, title: "Validacion continua", phase: "Robustez", percent: 92, status: "done", evidence: "Valida escena inicial, hotspots, URLs, slug, plano, galeria, accesibilidad y assets locales faltantes con pruebas automatizadas.", next: "Mantener reglas al crecer el schema." },
  { id: 28, title: "Validador antes de publicar", phase: "Publicacion", percent: 78, status: "progress", evidence: "Preflight bloquea errores y assets faltantes; muestra originales, mosaicos, resolucion minima, peso estimado del ZIP y calidad por escena.", next: "Validar conflictos remotos cuando exista SFTP real." },
  { id: 29, title: "Optimizacion de imagenes", phase: "Pipeline", percent: 100, status: "done", evidence: "Cada escena separa original intacto, preview 2048px, thumbnail y mosaicos de hasta 1024px; editor y viewer cargan solo lo necesario.", next: "Medir tamano de paquetes con recorridos reales de 30 a 50 fotos." },
  { id: 30, title: "Exportacion", phase: "Pipeline", percent: 100, status: "done", evidence: "El ZIP incluye cada JPG original sin recomprimir, preview, mosaicos, viewer WebGL autocontenido, manifiesto y apertura local guiada.", next: "Mantener compatibilidad del paquete al evolucionar el viewer." },
  { id: 31, title: "Publicacion directa", phase: "Publicacion", percent: 42, status: "progress", evidence: "Existe preflight, plan de rutas, manifest de archivos y checklist visible para publicacion.", next: "Implementar subida SFTP real cuando existan credenciales." },
  { id: 32, title: "Publicacion segura", phase: "Publicacion", percent: 45, status: "progress", evidence: "Plan usa temporal, verificacion, respaldo, activacion y verificacion publica, cubierto por pruebas.", next: "Hacer swap atomico real en servidor." },
  { id: 33, title: "Cuenta SFTP dedicada", phase: "Publicacion", percent: 15, status: "pending", evidence: "Documentado como requisito.", next: "Configurar cuenta real limitada a /tours/." },
  { id: 34, title: "Credenciales", phase: "Publicacion", percent: 10, status: "pending", evidence: "No se guardan credenciales en texto plano.", next: "Integrar almacen seguro de Windows via Tauri." },
  { id: 35, title: "Actualizacion de tours existentes", phase: "Publicacion", percent: 22, status: "pending", evidence: "PublishState existe en el modelo.", next: "Mostrar ultima publicacion y modo actualizar." },
  { id: 36, title: "Versiones publicadas y rollback", phase: "Publicacion", percent: 20, status: "pending", evidence: "Rutas de rollback ya se calculan.", next: "Subir versiones y restaurar una anterior." },
  { id: 37, title: "Experiencia de publicacion", phase: "Publicacion", percent: 52, status: "progress", evidence: "Panel de publicacion muestra URL destino, preflight, rutas seguras y pasos del despliegue.", next: "Mostrar exito real, abrir tour y copiar URL tras SFTP." },
  { id: 38, title: "Manejo de errores", phase: "Robustez", percent: 99, status: "done", evidence: "Importacion y visor final muestran progreso y recuperacion; el visor oculta errores internos de la libreria, permite reintentar o volver al editor y soporta assets antiguos.", next: "Cubrir mas adelante errores SFTP cuando exista publicacion real." },
  { id: 39, title: "Recuperacion ante fallos", phase: "Robustez", percent: 96, status: "done", evidence: "Recupera snapshots y originales; un diario detecta importaciones interrumpidas al recargar, limpia assets parciales y pide reanudar el lote.", next: "Verificar cierre forzado en otros navegadores." },
  { id: 40, title: "Rendimiento", phase: "Robustez", percent: 100, status: "done", evidence: "Un Web Worker decodifica cada 8K una sola vez; el editor limita cache a 4 previews y el viewer carga mosaicos bajo demanda. Pasan 3 fotos 8K y 50 escenas.", next: "Medir tiempos con un lote real de 30 a 50 originales." },
  { id: 41, title: "Accesibilidad del editor", phase: "Producto", percent: 95, status: "done", evidence: "La prueba recorre por teclado demo, escenas, panorama, menus y Vista final; iconos tienen nombres accesibles, tooltips, foco, Escape y retorno de foco.", next: "Hacer una revision posterior con lector de pantalla real." },
  { id: 42, title: "UX general", phase: "Producto", percent: 100, status: "done", evidence: "Header global, visor prioritario, paneles compactos y una escala tipografica heredada por todos los submenus reducen ruido y disparidades.", next: "Recoger observaciones durante la creacion de un tour grande real." },
  { id: 43, title: "MVP robusto", phase: "Robustez", percent: 98, status: "progress", evidence: "La bateria valida flujo guiado, respaldos, recuperacion de originales, integridad SHA-256, 3 JPG reales 8K, 50 escenas y export WebGL.", next: "Completar una prueba manual de aceptacion del nuevo ZIP." },
  { id: 44, title: "Fuera de alcance respetado", phase: "Base", percent: 100, status: "done", evidence: "No se agrego SaaS, usuarios, CRM, pagos ni infraestructura cloud.", next: "Seguir evitando expansion innecesaria." },
  { id: 45, title: "Extensiones futuras", phase: "Base", percent: 35, status: "progress", evidence: "Modelo deja espacio para media, branding y metadatos.", next: "Documentar extension points concretos." },
  { id: 46, title: "Estrategia de desarrollo", phase: "Base", percent: 70, status: "progress", evidence: "Fases A-C parcialmente cubiertas; D/E iniciadas.", next: "Registrar avance por fase en este tablero." },
  { id: 47, title: "Primer hito obligatorio", phase: "Pipeline", percent: 100, status: "done", evidence: "Tres JPG reales 8000x4000 se conservan byte por byte, renderizan, conectan y exportan; el flujo de 50 escenas verifica carga diferida.", next: "Usar el hito como base para un lote real de 30 a 50 fotos." },
  { id: 48, title: "Orden de prioridades", phase: "Base", percent: 85, status: "done", evidence: "Se priorizo integridad: autosave, historial y validacion.", next: "Mantener seguridad antes de funciones decorativas." },
  { id: 49, title: "Criterios de exito", phase: "Robustez", percent: 99, status: "progress", evidence: "Cumple editor guiado, autosave, respaldo editable, originales recuperables, conexiones, revision, export ZIP WebGL y pruebas local, real y de 50 escenas.", next: "Aprobar manualmente la calidad y usabilidad del tour exportado." },
  { id: 50, title: "Resultado final esperado", phase: "Base", percent: 92, status: "progress", evidence: "Studio ya recibe fotos reales, edita el tour y exporta un minisitio WebGL con originales, mosaicos, escenas, hotspots, planos y galeria.", next: "Cerrar la aceptacion manual antes de retomar instalacion o publicacion." }
];

const root = document.querySelector<HTMLElement>("#progress-app");

if (!root) {
  throw new Error("No se encontro el contenedor de avance.");
}

const appRoot = root;
const phases = Array.from(new Set(points.map((point) => point.phase)));
const overall = Math.round(points.reduce((total, point) => total + point.percent, 0) / points.length);
const done = points.filter((point) => point.status === "done").length;
const inProgress = points.filter((point) => point.status === "progress").length;
const pending = points.filter((point) => point.status === "pending").length;
let activeFilter = "all";

appRoot.innerHTML = `
  <main class="progress-shell">
    <header class="hero">
      <div>
        <a class="studio-return" href="/">
          ${createElement(ArrowLeft, { width: 16, height: 16, "stroke-width": 1.8, "aria-hidden": "true" }).outerHTML}
          <span>Volver a 360Tours Studio</span>
        </a>
        <p class="eyebrow">Plan maestro</p>
        <h1>Avance de 360Tours Studio</h1>
        <p>Seguimiento honesto de los 50 puntos: lo verde esta usable, lo amarillo esta iniciado, lo rojo todavia falta cerrarlo.</p>
        <p class="updated-at">Ultima actualizacion: ${lastUpdated}</p>
      </div>
      <section class="score-card" aria-label="Avance general">
        <div class="score-ring" style="--score:${overall}">
          <strong>${overall}%</strong>
          <span>global</span>
        </div>
        <div class="score-stats">
          <span><b>${done}</b> hechos</span>
          <span><b>${inProgress}</b> en progreso</span>
          <span><b>${pending}</b> pendientes</span>
        </div>
      </section>
    </header>

    <section class="phase-grid" aria-label="Avance por fase">
      ${phases.map(renderPhaseCard).join("")}
    </section>

    <section class="recent-changes" aria-label="Cambios recientes">
      <div>
        <p class="eyebrow">Cambios recientes</p>
        <h2>Lo ultimo que se movio</h2>
      </div>
      <ul>
        ${recentChanges.map((change) => `<li>${escapeHtml(change)}</li>`).join("")}
      </ul>
    </section>

    <section class="toolbar" aria-label="Filtros de avance">
      <div class="legend">
        <span><i class="light light--done"></i> Hecho</span>
        <span><i class="light light--progress"></i> En progreso</span>
        <span><i class="light light--pending"></i> Pendiente</span>
      </div>
      <div class="filters" data-filters>
        <button class="is-active" type="button" data-filter="all">Todo</button>
        <button type="button" data-filter="done">Hecho</button>
        <button type="button" data-filter="progress">En progreso</button>
        <button type="button" data-filter="pending">Pendiente</button>
        ${phases.map((phase) => `<button type="button" data-filter="${phase}">${phase}</button>`).join("")}
      </div>
    </section>

    <section class="point-list" data-point-list aria-label="Puntos del plan"></section>
  </main>
`;

renderFilteredPoints();

appRoot.querySelector("[data-filters]")?.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-filter]");
  if (!button) {
    return;
  }

  activeFilter = button.dataset.filter ?? "all";
  for (const filterButton of appRoot.querySelectorAll("[data-filter]")) {
    filterButton.classList.toggle("is-active", filterButton === button);
  }
  renderFilteredPoints();
});

function renderPhaseCard(phase: PlanPoint["phase"]): string {
  const phasePoints = points.filter((point) => point.phase === phase);
  const percent = Math.round(phasePoints.reduce((total, point) => total + point.percent, 0) / phasePoints.length);
  return `
    <article class="phase-card">
      <div>
        <span>${phase}</span>
        <strong>${percent}%</strong>
      </div>
      <meter min="0" max="100" value="${percent}">${percent}%</meter>
      <small>${phasePoints.length} puntos</small>
    </article>
  `;
}

function renderPoint(point: PlanPoint): string {
  return `
    <article class="plan-point plan-point--${point.status}">
      <div class="point-head">
        <span class="number">${point.id}</span>
        <i class="light light--${point.status}" aria-hidden="true"></i>
        <div>
          <h2>${escapeHtml(point.title)}</h2>
          <small>${point.phase}</small>
        </div>
        <strong>${point.percent}%</strong>
      </div>
      <meter min="0" max="100" value="${point.percent}">${point.percent}%</meter>
      <p><b>Hecho:</b> ${escapeHtml(point.evidence)}</p>
      <p><b>Siguiente:</b> ${escapeHtml(point.next)}</p>
    </article>
  `;
}

function renderFilteredPoints(): void {
  const list = appRoot.querySelector<HTMLElement>("[data-point-list]");
  if (!list) {
    return;
  }

  const filteredPoints = points.filter((point) => {
    if (activeFilter === "all") {
      return true;
    }

    return point.status === activeFilter || point.phase === activeFilter;
  });

  list.innerHTML = filteredPoints.map(renderPoint).join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
