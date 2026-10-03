import "../styles/progress.css";

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

const lastUpdated = "18 septiembre 2026";
const recentChanges = [
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
  { id: 5, title: "Flujo real de uso", phase: "Editor", percent: 86, status: "progress", evidence: "Crear, importar 3 JPG reales, conectar linealmente, previsualizar, guardar carpeta, abrir carpeta, exportar y validar con pnpm test:local ya existe.", next: "Cerrar pruebas con 30-50 fotos reales y luego publicacion real." },
  { id: 6, title: "Formato de entrada V1", phase: "Base", percent: 82, status: "progress", evidence: "Importador acepta JPG/JPEG 2:1, ya se probo con panoramas reales 8000x4000 y avisa dimensiones cuando una imagen no parece 360.", next: "Mejorar recuperacion de archivos corruptos y documentar limites de resolucion." },
  { id: 7, title: "Soporte futuro Insta360", phase: "Base", percent: 30, status: "progress", evidence: "Arquitectura de importadores ya permite adaptadores.", next: "Crear stub formal Insta360Importer cuando toque V2." },
  { id: 8, title: "Estructura local de proyectos", phase: "Pipeline", percent: 75, status: "progress", evidence: "La app ya guarda y abre carpetas editables con project.json, assets y .history/; Tauri puede guardar y recuperar la copia local del proyecto actual.", next: "Agregar selector nativo de carpeta externa en Windows." },
  { id: 9, title: "Modelo de datos", phase: "Base", percent: 90, status: "done", evidence: "TourProject versionado con schemaVersion 1.", next: "Agregar migraciones al cambiar schema." },
  { id: 10, title: "Modelo de escena", phase: "Base", percent: 85, status: "done", evidence: "Escenas con id, nombre, panorama, vista inicial, hotspots y metadata.", next: "Soportar cambio de panorama por escena." },
  { id: 11, title: "Hotspots", phase: "Editor", percent: 92, status: "done", evidence: "Modelo y UI cubren scene, info, image, video y link con validacion basica de URL.", next: "Pulir iconos/estilos por tipo y arrastre directo." },
  { id: 12, title: "Gestor de proyectos", phase: "Editor", percent: 72, status: "progress", evidence: "Nuevo, abrir carpeta, recientes, demo, duplicar, autosave y eliminar proyecto local con limpieza de historial/assets funcionando.", next: "Agregar archivar y busqueda." },
  { id: 13, title: "Importacion de panoramas", phase: "Editor", percent: 92, status: "done", evidence: "Drag and drop procesa por cola, crea escenas, guarda panoramas optimizados con metadata, genera thumbnails y conecta lotes en linea.", next: "Preservar source/ original en una fase posterior." },
  { id: 14, title: "Editor principal", phase: "Editor", percent: 88, status: "progress", evidence: "Layout con paneles colapsables, viewer canvas, guia de siguiente paso y panel de prueba local listo.", next: "Pulir herramientas avanzadas." },
  { id: 15, title: "Gestion de escenas", phase: "Editor", percent: 88, status: "progress", evidence: "Renombrar, reordenar, eliminar, escena inicial, navegacion anterior/siguiente, conexion lineal automatica, resumen y busqueda para tours grandes ya existen.", next: "Duplicar configuracion y cambiar panorama." },
  { id: 16, title: "Vista inicial de escena", phase: "Editor", percent: 82, status: "progress", evidence: "Guardar vista actual toma yaw, pitch y fov desde el visor canvas.", next: "Probar consistencia exacta en tour exportado." },
  { id: 17, title: "Editor visual de hotspots", phase: "Editor", percent: 80, status: "progress", evidence: "Click sobre panorama coloca hotspots, permite moverlos al centro visible y el panel Recorrido muestra/repara conexiones lineales.", next: "Arrastre directo sobre el panorama." },
  { id: 18, title: "Puntos de informacion", phase: "Producto", percent: 86, status: "done", evidence: "Info, imagen, video y link se crean, editan, validan y exportan; info/media abren panel en el tour publicado.", next: "Detectar formatos embebibles de video con mensajes mas claros." },
  { id: 19, title: "Plano de planta", phase: "Producto", percent: 86, status: "done", evidence: "Importa multiples plantas, cambia la planta activa, renombra, elimina y ubica marcadores por escena; el export tambien permite alternar plantas.", next: "Agregar arrastre directo de marcadores y miniaturas de plano." },
  { id: 20, title: "Galeria", phase: "Producto", percent: 74, status: "progress", evidence: "Importar, previsualizar miniaturas, editar caption, eliminar y ordenar fotos ya funciona.", next: "Agregar reordenamiento por arrastre y vista ampliada." },
  { id: 21, title: "Menu de escenas", phase: "Producto", percent: 82, status: "progress", evidence: "Viewer exportado incluye menu de escenas scrollable y compatible con carga bajo demanda.", next: "Convertirlo en drawer movil mas fino." },
  { id: 22, title: "Fullscreen", phase: "Producto", percent: 82, status: "done", evidence: "Tour exportado tiene boton fullscreen sin recarga.", next: "QA en navegadores moviles reales." },
  { id: 23, title: "Preview", phase: "Producto", percent: 90, status: "done", evidence: "Preview del editor renderiza panoramas reales con canvas, navegacion, hotspots y controles anterior/siguiente.", next: "QA con mas camaras y navegadores." },
  { id: 24, title: "Renderer", phase: "Producto", percent: 92, status: "done", evidence: "Renderer canvas independiente con navegacion, hotspots, coordenadas, zoom, drag y cache de pixeles; el export tambien usa canvas.", next: "Renombrar el modulo legado y ampliar pruebas visuales." },
  { id: 25, title: "Guardado", phase: "Robustez", percent: 94, status: "done", evidence: "Autosave local, indicador visible, errores de cuota recuperables, guardar/abrir carpeta y puente de escritura nativa implementados.", next: "Probar guardado nativo solo cuando vuelva a priorizarse la app instalada." },
  { id: 26, title: "Historial", phase: "Robustez", percent: 87, status: "progress", evidence: "Snapshots manuales y preventivos, restauracion UI y recuperacion automatica del ultimo proyecto danado desde el snapshot valido mas reciente.", next: "Restaurar snapshots desde carpetas reales con fechas originales." },
  { id: 27, title: "Validacion continua", phase: "Robustez", percent: 92, status: "done", evidence: "Valida escena inicial, hotspots, URLs, slug, plano, galeria, accesibilidad y assets locales faltantes con pruebas automatizadas.", next: "Mantener reglas al crecer el schema." },
  { id: 28, title: "Validador antes de publicar", phase: "Publicacion", percent: 65, status: "progress", evidence: "Preflight bloquea errores criticos, assets faltantes y el ZIP incluye manifiesto de despliegue.", next: "Validar conflictos remotos cuando exista SFTP real." },
  { id: 29, title: "Optimizacion de imagenes", phase: "Pipeline", percent: 80, status: "progress", evidence: "La importacion genera thumbnails y panoramas 2048px; editor y viewer exportado cargan panoramas bajo demanda.", next: "Crear tiles o multiresolucion solo si las mediciones con tours pesados lo justifican." },
  { id: 30, title: "Exportacion", phase: "Pipeline", percent: 99, status: "done", evidence: "Export estatico autocontenido, ZIP descargable, viewer canvas, deploy-manifest y prueba con 3 fotos reales ya existen.", next: "Agregar firma de paquete y validacion de archivos grandes." },
  { id: 31, title: "Publicacion directa", phase: "Publicacion", percent: 42, status: "progress", evidence: "Existe preflight, plan de rutas, manifest de archivos y checklist visible para publicacion.", next: "Implementar subida SFTP real cuando existan credenciales." },
  { id: 32, title: "Publicacion segura", phase: "Publicacion", percent: 45, status: "progress", evidence: "Plan usa temporal, verificacion, respaldo, activacion y verificacion publica, cubierto por pruebas.", next: "Hacer swap atomico real en servidor." },
  { id: 33, title: "Cuenta SFTP dedicada", phase: "Publicacion", percent: 15, status: "pending", evidence: "Documentado como requisito.", next: "Configurar cuenta real limitada a /tours/." },
  { id: 34, title: "Credenciales", phase: "Publicacion", percent: 10, status: "pending", evidence: "No se guardan credenciales en texto plano.", next: "Integrar almacen seguro de Windows via Tauri." },
  { id: 35, title: "Actualizacion de tours existentes", phase: "Publicacion", percent: 22, status: "pending", evidence: "PublishState existe en el modelo.", next: "Mostrar ultima publicacion y modo actualizar." },
  { id: 36, title: "Versiones publicadas y rollback", phase: "Publicacion", percent: 20, status: "pending", evidence: "Rutas de rollback ya se calculan.", next: "Subir versiones y restaurar una anterior." },
  { id: 37, title: "Experiencia de publicacion", phase: "Publicacion", percent: 52, status: "progress", evidence: "Panel de publicacion muestra URL destino, preflight, rutas seguras y pasos del despliegue.", next: "Mostrar exito real, abrir tour y copiar URL tras SFTP." },
  { id: 38, title: "Manejo de errores", phase: "Robustez", percent: 78, status: "progress", evidence: "Importacion conserva diagnosticos, assets faltantes bloquean exportacion y los fallos de cuota/escritura muestran que los cambios siguen abiertos pero no guardados.", next: "Cubrir permisos de carpeta y, mas adelante, errores SFTP." },
  { id: 39, title: "Recuperacion ante fallos", phase: "Robustez", percent: 86, status: "progress", evidence: "La app detecta JSON local corrupto, recupera el snapshot valido mas reciente, repara el proyecto principal y evita operaciones destructivas si no puede crear respaldo.", next: "Agregar copia de emergencia descargable y probar cierres durante importacion." },
  { id: 40, title: "Rendimiento", phase: "Robustez", percent: 86, status: "progress", evidence: "El editor conserva un maximo de 4 panoramas con cache LRU, precarga escenas cercanas e ignora navegacion obsoleta; la prueba automatizada salta hasta la escena 50 sin exceder el limite.", next: "Medir memoria real y mover procesamiento pesado a workers si hace falta." },
  { id: 41, title: "Accesibilidad del editor", phase: "Producto", percent: 55, status: "progress", evidence: "Labels, botones claros, contraste y focus basicos.", next: "Auditar teclado completo y tooltips." },
  { id: 42, title: "UX general", phase: "Producto", percent: 85, status: "progress", evidence: "La UI evita terminos tecnicos, permite colapsar paneles, muestra siguiente paso, recorrido visual, modo rapido, auditoria compacta y busqueda de escenas.", next: "Pulir microcopy y estados de error." },
  { id: 43, title: "MVP robusto", phase: "Robustez", percent: 94, status: "progress", evidence: "pnpm test:local valida build, navegador, recuperacion local, 3 JPG reales, 50 escenas sinteticas, autosave, export, caches acotadas y diagnosticos.", next: "Cerrar la edicion visual y una prueba manual completa antes de pensar en instalacion o publicacion." },
  { id: 44, title: "Fuera de alcance respetado", phase: "Base", percent: 100, status: "done", evidence: "No se agrego SaaS, usuarios, CRM, pagos ni infraestructura cloud.", next: "Seguir evitando expansion innecesaria." },
  { id: 45, title: "Extensiones futuras", phase: "Base", percent: 35, status: "progress", evidence: "Modelo deja espacio para media, branding y metadatos.", next: "Documentar extension points concretos." },
  { id: 46, title: "Estrategia de desarrollo", phase: "Base", percent: 70, status: "progress", evidence: "Fases A-C parcialmente cubiertas; D/E iniciadas.", next: "Registrar avance por fase en este tablero." },
  { id: 47, title: "Primer hito obligatorio", phase: "Pipeline", percent: 100, status: "done", evidence: "pnpm test:local confirma que tres JPG reales y un tour de 50 escenas importan, recargan autosave, conectan, renderizan, filtran y exportan ZIP con lazy-load.", next: "Usar el hito como base para 30-50 fotos reales." },
  { id: 48, title: "Orden de prioridades", phase: "Base", percent: 85, status: "done", evidence: "Se priorizo integridad: autosave, historial y validacion.", next: "Mantener seguridad antes de funciones decorativas." },
  { id: 49, title: "Criterios de exito", phase: "Robustez", percent: 97, status: "progress", evidence: "Cumple editor, autosave, guardar/abrir carpeta logico, importacion real, export ZIP, viewer exportado, bloqueo por assets faltantes y prueba local completa.", next: "Publicar a servidor y probar app instalada solo cuando el navegador local este cerrado." },
  { id: 50, title: "Resultado final esperado", phase: "Base", percent: 88, status: "progress", evidence: "Ya existe base para fotos reales, Studio, editar, preview 360, recorrido rapido, planos, galeria, guardar/abrir carpeta, exportar y empaquetar en Windows.", next: "Completar publicacion real y optimizacion avanzada." }
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
