import { CURRENT_SCHEMA_VERSION, type Floorplan, type GalleryItem, type Hotspot, type Scene, type TourProject, type ValidationIssue } from "../domain/tour";
import { validateProjectAssets } from "../domain/assetValidation";
import { createDemoPanoramaFile, demoProject } from "../domain/demoProject";
import { getOriginalPanoramaPath, getPanoramaAssets, setPanoramaAssets } from "../domain/panoramaAssets";
import { validateProject } from "../domain/validation";
import { JPEG360Importer } from "../importers/jpeg360Importer";
import { isTauriRuntime, loadProjectFolderNative, saveProjectFolderNative } from "../platform/desktopBridge";
import { BrowserProjectAssets } from "../project/browserAssets";
import { buildProjectFolder, loadProjectFolder } from "../project/projectRepository";
import { BrowserProjectStorage, type ProjectSnapshotSummary, type ProjectSummary } from "../project/storage";
import { exportStaticTour } from "../publisher/exporter";
import { publishTour } from "../publisher/sftpPublisher";
import { createZipArchive } from "../publisher/zipArchive";
import { CanvasTourRenderer } from "../renderer/canvasTourRenderer";
import { detectBrowserCompatibility } from "./browserCompatibility";
import { formatBytes, planImportCapacity } from "../importers/importPlanning";
import { processPanorama } from "../importers/panoramaProcessing";
import type { FinalTourPreview } from "../preview/finalTourPreview";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Download,
  Ellipsis,
  House,
  Image as ImageIcon,
  Info,
  Link as LinkIcon,
  LocateFixed,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  Route,
  ScanEye,
  Trash,
  Undo2,
  Video,
  createElement,
  type IconNode
} from "lucide";

interface ActiveImportSession {
  projectId: string;
  startedAt: string;
  sceneIds: string[];
  fileNames: string[];
  completedSceneIds: string[];
}

export class Tours360StudioApp {
  private project: TourProject = createEmptyProject();

  private storage = new BrowserProjectStorage();
  private assets = new BrowserProjectAssets();
  private importer = new JPEG360Importer();
  private renderer: CanvasTourRenderer | null = null;
  private activeSceneId = "";
  private activeFloorplanId = "";
  private sceneThumbnailUrls: string[] = [];
  private mediaPreviewUrls: string[] = [];
  private galleryPreviewUrls: string[] = [];
  private placementMode: "scene" | "info" | "image" | "video" | "link" | "floorplan" | null = null;
  private recentProjects: ProjectSummary[] = [];
  private snapshots: ProjectSnapshotSummary[] = [];
  private assetIssues: ValidationIssue[] = [];
  private leftPanelCollapsed = false;
  private rightPanelCollapsed = false;
  private sceneFilter = "";
  private selectedHotspotId = "";
  private undoStack: TourProject[] = [];
  private redoStack: TourProject[] = [];
  private readonly importSessionKey = "360tours-import:active";
  private importController: AbortController | null = null;
  private finalPreview: FinalTourPreview | null = null;

  mount(root: HTMLElement): void {
    const compactView = window.matchMedia("(max-width: 980px)");
    if (compactView.matches) {
      this.leftPanelCollapsed = true;
      this.rightPanelCollapsed = true;
    }
    root.innerHTML = this.renderShell();
    this.bindActions(root);
    compactView.addEventListener("change", (event) => {
      this.leftPanelCollapsed = event.matches;
      this.rightPanelCollapsed = event.matches;
      this.syncShellLayout(root);
    });
    void this.initialize(root);
  }

  private renderShell(): string {
    return `
      <main class="studio-shell">
        <div class="compatibility-banner" data-compatibility-banner role="status"></div>
        <header class="topbar">
          <h1 class="app-brand">360Tours Studio</h1>
          <div class="workspace-context">
            <div class="workspace-title-line">
              <strong data-workspace-project>${escapeHtml(this.project.title)}</strong>
              <small class="persistence-status" data-persistence-status role="status" aria-live="polite"></small>
            </div>
            <span data-workspace-scene>Sin escenas</span>
          </div>
          <div class="topbar-navigation" role="group" aria-label="Paneles del editor">
            <span class="toolbar-tip" data-tooltip="Mostrar u ocultar escenas">
              <button class="toolbar-icon" data-action="toggle-left-panel" aria-label="Mostrar u ocultar escenas" title="Mostrar u ocultar escenas">
                <span class="panel-icon panel-icon--open">${renderIcon(PanelLeftClose)}</span>
                <span class="panel-icon panel-icon--closed">${renderIcon(PanelLeftOpen)}</span>
              </button>
            </span>
            <span class="toolbar-tip" data-tooltip="Mostrar u ocultar herramientas">
              <button class="toolbar-icon" data-action="toggle-right-panel" aria-label="Mostrar u ocultar herramientas" title="Mostrar u ocultar herramientas">
                <span class="panel-icon panel-icon--open">${renderIcon(PanelRightClose)}</span>
                <span class="panel-icon panel-icon--closed">${renderIcon(PanelRightOpen)}</span>
              </button>
            </span>
          </div>
          <div class="topbar-actions" role="group" aria-label="Acciones del tour">
            <span class="toolbar-tip" data-tooltip="Deshacer el ultimo cambio">
              <button class="toolbar-icon" data-action="undo" aria-label="Deshacer" title="Deshacer el ultimo cambio" disabled>${renderIcon(Undo2)}</button>
            </span>
            <span class="toolbar-tip" data-tooltip="Rehacer el ultimo cambio">
              <button class="toolbar-icon" data-action="redo" aria-label="Rehacer" title="Rehacer el ultimo cambio" disabled>${renderIcon(Redo2)}</button>
            </span>
            <span class="toolbar-divider" aria-hidden="true"></span>
            <span class="toolbar-tip" data-tooltip="Abrir la vista final del tour">
              <button class="toolbar-icon" data-action="final-preview" aria-label="Vista final" title="Abrir la vista final del tour">${renderIcon(ScanEye)}</button>
            </span>
            <span class="toolbar-tip" data-tooltip="Exportar el tour como archivo ZIP">
              <button class="toolbar-icon toolbar-icon--primary" data-action="export" aria-label="Exportar tour" title="Exportar el tour como archivo ZIP">${renderIcon(Download)}</button>
            </span>
            <details class="action-menu">
              <summary class="toolbar-icon" aria-haspopup="menu" aria-label="Acciones" title="Mas acciones del proyecto" data-tooltip="Mas acciones del proyecto">${renderIcon(Ellipsis)}</summary>
              <div class="action-menu-panel">
                <details class="project-settings">
                  <summary title="Editar la direccion web del proyecto">Proyecto</summary>
                  <div>
                    <label class="slug-field">
                      <span>Direccion web</span>
                      <input value="${escapeHtml(this.project.publish?.slug ?? this.project.id)}" data-field="publish-slug" />
                    </label>
                  </div>
                </details>
                <button data-action="quick-tour" data-tooltip="Conectar las escenas en el orden actual" data-tooltip-side="left">Preparar recorrido</button>
                <a class="button-link" href="/progress.html" data-tooltip="Abrir el tablero del plan maestro" data-tooltip-side="left">Ver avance</a>
                <button data-action="snapshot" data-tooltip="Guardar un punto de recuperacion del proyecto" data-tooltip-side="left">Guardar snapshot</button>
                <button data-action="download-backup" data-tooltip="Descargar una copia completa para recuperar el proyecto" data-tooltip-side="left">Descargar respaldo</button>
                <button data-action="duplicate-project" data-tooltip="Crear una copia independiente del proyecto actual" data-tooltip-side="left">Duplicar proyecto</button>
                <button data-action="save-project-folder" data-tooltip="Guardar el proyecto editable en una carpeta local" data-tooltip-side="left">Guardar carpeta</button>
                <button data-action="publish" data-tooltip="Preparar la publicacion web configurada" data-tooltip-side="left">Publicar</button>
              </div>
            </details>
          </div>
        </header>
        <aside class="project-panel" aria-label="Proyecto">
          <div class="mobile-panel-header">
            <strong>Proyecto y escenas</strong>
            <button data-action="toggle-left-panel" aria-label="Cerrar panel de escenas">Cerrar</button>
          </div>
          <section class="project-title-editor" aria-label="Tour actual">
            <label>
              <span>Nombre del tour</span>
              <input value="${escapeHtml(this.project.title)}" placeholder="Tour sin nombre" data-field="project-title" />
            </label>
          </section>
          <section class="import-zone" data-drop-zone>
            <input id="panorama-import" class="visually-hidden" type="file" accept=".jpg,.jpeg,image/jpeg,image/jpg" multiple tabindex="-1" data-action="import-files" />
            <label class="import-label" for="panorama-import" role="button" tabindex="0" data-file-trigger="panorama-import">
              <span>Importar panoramas JPG</span>
              <small>Arrastra fotos 360 o selecciona archivos</small>
            </label>
            <div class="import-status" data-import-status></div>
          </section>

            <details class="panel-menu" open>
              <summary>Proyecto y recuperacion</summary>
              <div class="project-actions">
              <button class="primary-action" data-action="new-project">Nuevo tour</button>
              <button data-action="open-project-folder">Abrir carpeta</button>
              <input id="originals-recovery" class="visually-hidden" type="file" accept=".jpg,.jpeg,image/jpeg,image/jpg" multiple tabindex="-1" aria-label="Seleccionar panoramas originales" data-action="recover-originals" />
              <button data-action="choose-originals">Recuperar originales</button>
              <button data-action="load-demo">Cargar demo tecnico</button>
              </div>
            </details>

          <section>
            <div class="section-heading">
              <h2>Recientes</h2>
              <span data-project-count>0</span>
            </div>
            <div class="recent-list" data-recent-list></div>
          </section>

          <section>
            <div class="section-heading">
              <h2>Escenas</h2>
              <span data-scene-count>0</span>
            </div>
            <label class="scene-search">
              <span>Buscar escena</span>
              <input value="${escapeHtml(this.sceneFilter)}" placeholder="Nombre o numero" data-field="scene-filter" />
            </label>
            <div class="scene-list" data-scene-list></div>
          </section>
        </aside>

        <section class="viewer-panel" aria-label="Preview del tour">
          <div class="viewer-surface" data-viewer>
            <div class="empty-viewer">
              <strong>Importa tus panoramas para comenzar.</strong>
              <span>El preview 360 aparecera aqui al seleccionar una escena.</span>
            </div>
          </div>
        </section>

        <aside class="properties-panel" aria-label="Propiedades">
          <div class="mobile-panel-header">
            <strong>Herramientas de escena</strong>
            <button data-action="toggle-right-panel" aria-label="Cerrar herramientas">Cerrar</button>
          </div>
          <details class="property-section" open>
            <summary><h2>Siguiente paso</h2></summary>
            <div data-next-steps></div>
          </details>
          <details class="property-section" open>
            <summary><h2>Escena activa</h2></summary>
            <div data-scene-properties></div>
          </details>
          <details class="property-section">
            <summary><h2>Recorrido</h2></summary>
            <div data-route-map></div>
          </details>
          <details class="property-section">
            <summary><h2>Plano</h2></summary>
            <div data-floorplan-panel></div>
          </details>
          <details class="property-section">
            <summary><h2>Galeria</h2></summary>
            <div data-gallery-panel></div>
          </details>
          <details class="property-section">
            <summary><h2>Validacion</h2></summary>
            <div data-validation></div>
          </details>
          <details class="property-section">
            <summary><h2>Historial</h2></summary>
            <div data-snapshot-list>
              <p class="muted">Guarda snapshots antes de cambios importantes.</p>
            </div>
          </details>
          <details class="property-section">
            <summary><h2>Exportacion</h2></summary>
            <div data-export-status>
              <p class="muted">El paquete estatico se generara desde el modelo guardado.</p>
            </div>
          </details>
          <details class="property-section">
            <summary><h2>Publicacion</h2></summary>
            <div class="publish-target" data-publish-status>
              <span>Destino</span>
              <strong data-publish-url>${escapeHtml(this.getPublishUrl())}</strong>
            </div>
          </details>
        </aside>
      </main>
      <div class="final-preview-host" data-final-preview-host hidden></div>
    `;
  }

  private async initialize(root: HTMLElement): Promise<void> {
    this.renderBrowserCompatibility(root);
    const recovery = await this.storage.recoverLast();
    const savedProject = recovery.project;
    this.recentProjects = await this.storage.list();
    if (savedProject) {
      this.project = savedProject;
      this.activeSceneId = savedProject.startScene ?? savedProject.scenes[0]?.id ?? "";
      this.activeFloorplanId = savedProject.floorplans[0]?.id ?? "";
      this.syncTitleField(root);
    }
    this.snapshots = await this.storage.listSnapshots(this.project.id);
    const interruptedImport = await this.recoverInterruptedImport();

    this.syncShellLayout(root);
    await this.renderWorkspace(root, true);
    const initialMessage = interruptedImport ?? recovery.warning ?? (savedProject ? "Proyecto local recuperado y listo." : "Listo para crear un tour local.");
    this.renderPersistenceStatus(root, initialMessage, Boolean(interruptedImport || recovery.warning));
  }

  private syncShellLayout(root: HTMLElement): void {
    const shell = root.querySelector<HTMLElement>(".studio-shell");
    if (!shell) {
      return;
    }

    shell.classList.toggle("is-left-collapsed", this.leftPanelCollapsed);
    shell.classList.toggle("is-right-collapsed", this.rightPanelCollapsed);
    const compactView = window.matchMedia("(max-width: 980px)").matches;
    shell.classList.toggle("is-mobile-left-open", compactView && !this.leftPanelCollapsed);
    shell.classList.toggle("is-mobile-right-open", compactView && !this.rightPanelCollapsed);
    root.querySelectorAll<HTMLElement>("[data-action='toggle-left-panel']").forEach((control) => {
      control.setAttribute("aria-expanded", String(!this.leftPanelCollapsed));
    });
    root.querySelectorAll<HTMLElement>("[data-action='toggle-right-panel']").forEach((control) => {
      control.setAttribute("aria-expanded", String(!this.rightPanelCollapsed));
    });
  }

  private renderBrowserCompatibility(root: HTMLElement): void {
    const banner = root.querySelector<HTMLElement>("[data-compatibility-banner]");
    if (!banner) return;
    const compatibility = detectBrowserCompatibility();
    banner.textContent = compatibility.message;
    banner.dataset.level = compatibility.level;
    banner.hidden = compatibility.level === "supported";
  }

  private pushUndoCheckpoint(): void {
    this.undoStack.push(cloneProject(this.project));
    if (this.undoStack.length > 40) this.undoStack.shift();
    this.redoStack = [];
  }

  private clearUndoHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  private async undo(root: HTMLElement): Promise<void> {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(cloneProject(this.project));
    this.project = previous;
    this.activeSceneId = this.project.scenes.some((scene) => scene.id === this.activeSceneId)
      ? this.activeSceneId
      : this.project.startScene ?? this.project.scenes[0]?.id ?? "";
    this.selectedHotspotId = "";
    await this.persistAndRender(root, true);
    this.renderPersistenceStatus(root, "Cambio deshecho.");
  }

  private async redo(root: HTMLElement): Promise<void> {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(cloneProject(this.project));
    this.project = next;
    this.activeSceneId = this.project.scenes.some((scene) => scene.id === this.activeSceneId)
      ? this.activeSceneId
      : this.project.startScene ?? this.project.scenes[0]?.id ?? "";
    this.selectedHotspotId = "";
    await this.persistAndRender(root, true);
    this.renderPersistenceStatus(root, "Cambio rehecho.");
  }

  private updateUndoControls(root: HTMLElement): void {
    const undo = root.querySelector<HTMLButtonElement>("[data-action='undo']");
    const redo = root.querySelector<HTMLButtonElement>("[data-action='redo']");
    if (undo) undo.disabled = this.undoStack.length === 0;
    if (redo) redo.disabled = this.redoStack.length === 0;
  }

  private selectHotspot(root: HTMLElement, hotspotId: string): void {
    this.selectedHotspotId = hotspotId;
    this.renderer?.setSelectedHotspot(hotspotId);
    this.renderSceneProperties(root);
  }

  private bindActions(root: HTMLElement): void {
    root.addEventListener("click", async (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action], [data-scene-id], [data-project-id]");
      if (!target) {
        return;
      }
      const parentActionMenu = target.closest<HTMLDetailsElement>(".action-menu");
      if (parentActionMenu && target.dataset.action) {
        parentActionMenu.open = false;
      }
      const parentHotspotMenu = target.closest<HTMLDetailsElement>(".add-hotspot-menu");
      if (parentHotspotMenu && target.dataset.action?.startsWith("add-")) {
        parentHotspotMenu.open = false;
      }

      const action = target.dataset.action;

      if (target.dataset.sceneId) {
        this.activeSceneId = target.dataset.sceneId;
        this.selectedHotspotId = "";
        this.renderer?.goToScene(this.activeSceneId);
        await this.renderPreviewFallback(root);
        this.renderWorkspace(root, false);
      }

      if (action === "select-floorplan" && target.dataset.floorplanId) {
        this.activeFloorplanId = target.dataset.floorplanId;
        await this.renderFloorplanPanel(root);
      }

      if (action === "previous-scene") {
        await this.navigateRelativeScene(root, -1);
        return;
      }

      if (action === "next-scene") {
        await this.navigateRelativeScene(root, 1);
        return;
      }

      if (action === "repair-linear-route") {
        await this.repairLinearRoute(root, target);
        return;
      }

      if (action === "quick-tour") {
        await this.prepareQuickTour(root, target);
        return;
      }

      if (action === "final-preview") {
        await this.openFinalPreview(root, target);
        return;
      }

      if (action === "undo") {
        await this.undo(root);
        return;
      }

      if (action === "redo") {
        await this.redo(root);
        return;
      }

      if (action === "select-hotspot" && target.dataset.hotspotId) {
        this.selectHotspot(root, target.dataset.hotspotId);
        return;
      }

      if (action === "cancel-import") {
        this.importController?.abort();
        return;
      }

      if (action === "toggle-left-panel") {
        const compactView = window.matchMedia("(max-width: 980px)").matches;
        const shell = root.querySelector<HTMLElement>(".studio-shell");
        this.leftPanelCollapsed = compactView ? shell?.classList.contains("is-mobile-left-open") ?? true : !this.leftPanelCollapsed;
        if (!this.leftPanelCollapsed && compactView) {
          this.rightPanelCollapsed = true;
        }
        this.syncShellLayout(root);
        return;
      }

      if (action === "toggle-right-panel") {
        const compactView = window.matchMedia("(max-width: 980px)").matches;
        const shell = root.querySelector<HTMLElement>(".studio-shell");
        this.rightPanelCollapsed = compactView ? shell?.classList.contains("is-mobile-right-open") ?? true : !this.rightPanelCollapsed;
        if (!this.rightPanelCollapsed && compactView) {
          this.leftPanelCollapsed = true;
        }
        this.syncShellLayout(root);
        return;
      }

      if (action === "snapshot") {
        if (await this.saveSnapshot(root)) {
          this.flashButton(target, "Snapshot guardado");
        }
      }

      if (action === "duplicate-project") {
        await this.duplicateProject(root, target);
      }

      if (action === "download-backup") {
        await this.downloadProjectBackup(root, target);
      }

      if (action === "save-project-folder") {
        await this.saveProjectFolder(root, target);
      }

      if (action === "open-project-folder") {
        await this.openProjectFolder(root, target);
      }

      if (action === "choose-originals") {
        root.querySelector<HTMLInputElement>("#originals-recovery")?.click();
      }

      if (action === "restore-snapshot" && target.dataset.snapshotId) {
        await this.restoreSnapshot(root, target.dataset.snapshotId);
      }

      if (action === "new-project") {
        this.project = createEmptyProject();
        this.activeSceneId = "";
        this.activeFloorplanId = "";
        this.sceneFilter = "";
        this.selectedHotspotId = "";
        this.clearUndoHistory();
        this.syncTitleField(root);
        await this.persistAndRender(root, true);
      }

      if (action === "load-demo") {
        this.project = cloneProject({
          ...demoProject,
          title: "Demo 360Tours Studio",
          publish: { slug: "demo-360tours-studio" }
        });
        this.activeSceneId = this.project.startScene ?? this.project.scenes[0]?.id ?? "";
        this.activeFloorplanId = this.project.floorplans[0]?.id ?? "";
        this.sceneFilter = "";
        this.selectedHotspotId = "";
        this.clearUndoHistory();
        this.syncTitleField(root);
        this.renderImportStatus(root, "Preparando demo local...");
        for (const scene of this.project.scenes) {
          const sourceFile = await createDemoPanoramaFile(scene.id as "entrada" | "sala" | "cocina");
          await this.storePanoramaAssets(scene, sourceFile);
        }
        await this.persistAndRender(root, true);
        this.renderImportStatus(root, "Demo local lista. No necesita conexion a internet.");
      }

      if (action === "delete-project" && target.dataset.projectId) {
        await this.deleteProject(root, target.dataset.projectId);
        return;
      }

      if (target.dataset.projectId) {
        try {
          const project = await this.storage.load(target.dataset.projectId);
          this.project = project;
          this.activeSceneId = project.startScene ?? project.scenes[0]?.id ?? "";
          this.activeFloorplanId = project.floorplans[0]?.id ?? "";
          this.sceneFilter = "";
          this.selectedHotspotId = "";
          this.clearUndoHistory();
          this.syncTitleField(root);
          await this.renderWorkspace(root, true);
          this.renderPersistenceStatus(root, "Proyecto local abierto.");
        } catch (error) {
          this.renderPersistenceStatus(root, getErrorMessage(error), true);
        }
      }

      if (action === "set-start") {
        this.project = { ...this.project, startScene: this.activeSceneId };
        await this.persistAndRender(root, false);
      }

      if (action === "save-view") {
        await this.saveCurrentView(root, target);
      }

      if (action === "move-scene-up") {
        await this.moveActiveScene(root, -1);
      }

      if (action === "move-scene-down") {
        await this.moveActiveScene(root, 1);
      }

      if (action === "delete-scene") {
        await this.deleteActiveScene(root);
      }

      if (action === "move-hotspot-here" && target.dataset.hotspotId) {
        await this.moveHotspotToCurrentView(root, target.dataset.hotspotId, target);
      }

      if (action === "delete-hotspot" && target.dataset.hotspotId) {
        await this.deleteHotspot(root, target.dataset.hotspotId);
      }

      if (action === "delete-floorplan-marker" && target.dataset.markerId) {
        await this.deleteFloorplanMarker(root, target.dataset.markerId);
      }

      if (action === "delete-floorplan" && target.dataset.floorplanId) {
        await this.deleteFloorplan(root, target.dataset.floorplanId);
      }

      if (action === "delete-gallery-item" && target.dataset.galleryId) {
        await this.deleteGalleryItem(root, target.dataset.galleryId);
      }

      if (action === "move-gallery-item-up" && target.dataset.galleryId) {
        await this.moveGalleryItem(root, target.dataset.galleryId, -1);
      }

      if (action === "move-gallery-item-down" && target.dataset.galleryId) {
        await this.moveGalleryItem(root, target.dataset.galleryId, 1);
      }

      if (action === "add-floorplan-marker") {
        this.placementMode = "floorplan";
        this.renderFloorplanHint(root, "Haz clic en el plano para ubicar la escena activa.");
      }

      if (action === "add-scene-link") {
        this.placementMode = "scene";
        this.renderPlacementHint(root, "Haz clic en una puerta o pasillo dentro del panorama.");
      }

      if (action === "add-info") {
        this.placementMode = "info";
        this.renderPlacementHint(root, "Haz clic sobre el detalle que quieres explicar.");
      }

      if (action === "add-image") {
        this.placementMode = "image";
        this.renderPlacementHint(root, "Haz clic donde quieres colocar la imagen externa.");
      }

      if (action === "add-video") {
        this.placementMode = "video";
        this.renderPlacementHint(root, "Haz clic donde quieres colocar el video externo.");
      }

      if (action === "add-link") {
        this.placementMode = "link";
        this.renderPlacementHint(root, "Haz clic donde quieres colocar el enlace.");
      }

      if (action === "export") {
        await this.downloadStaticTour(root, target);
      }

      if (action === "publish") {
        await this.runPublishPreflight(root, target);
      }
    });

    root.addEventListener("click", async (event) => {
      if (this.placementMode !== "floorplan") {
        return;
      }

      const stage = (event.target as HTMLElement).closest<HTMLElement>("[data-floorplan-stage]");
      if (!stage) {
        return;
      }

      const bounds = stage.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
      const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
      await this.addFloorplanMarker(root, x, y);
      this.placementMode = null;
      this.renderFloorplanHint(root, "");
    });

    root.addEventListener("input", async (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

      if (target.dataset.field === "project-title") {
        this.project = { ...this.project, title: target.value };
        this.renderWorkspaceContext(root);
        if (await this.saveProject(root)) {
          this.recentProjects = await this.storage.list();
          this.renderRecentProjects(root);
        }
      }

      if (target.dataset.field === "publish-slug") {
        const slug = toSlug(target.value);
        this.project = {
          ...this.project,
          publish: {
            ...this.project.publish,
            slug
          }
        };
        target.value = slug;
        await this.saveProject(root);
        this.syncPublishUrl(root);
        this.renderValidation(root);
      }

      if (target.dataset.field === "scene-filter") {
        this.sceneFilter = target.value;
        await this.renderSceneList(root);
      }

      if (target.dataset.field === "scene-name") {
        await this.renameActiveScene(root, target.value);
      }

      if (target.dataset.hotspotId && target.dataset.hotspotField) {
        await this.updateHotspot(root, target.dataset.hotspotId, target.dataset.hotspotField, target.value);
      }

      if (target.dataset.galleryId && target.dataset.galleryField === "caption") {
        await this.updateGalleryCaption(root, target.dataset.galleryId, target.value);
      }

      if (target.dataset.floorplanId && target.dataset.floorplanField === "name") {
        await this.renameFloorplan(root, target.dataset.floorplanId, target.value);
      }
    });

    root.addEventListener("change", async (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement;

        if (target.dataset.action === "import-files" && target instanceof HTMLInputElement) {
          await this.importFiles(root, Array.from(target.files ?? []));
          target.value = "";
        }

        if (target.dataset.action === "recover-originals" && target instanceof HTMLInputElement) {
          await this.recoverOriginalPanoramas(root, Array.from(target.files ?? []));
          target.value = "";
        }

      if (target.dataset.action === "import-floorplan" && target instanceof HTMLInputElement) {
        await this.importFloorplan(root, target.files?.[0] ?? null);
        target.value = "";
      }

      if (target.dataset.action === "import-gallery" && target instanceof HTMLInputElement) {
        await this.importGallery(root, Array.from(target.files ?? []));
        target.value = "";
      }

      if (target.dataset.hotspotId && target.dataset.hotspotField) {
        await this.updateHotspot(root, target.dataset.hotspotId, target.dataset.hotspotField, target.value);
      }
    });

    const dropZone = root.querySelector<HTMLElement>("[data-drop-zone]");
    dropZone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
    dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("is-dragging"));
    dropZone?.addEventListener("drop", async (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
      await this.importFiles(root, Array.from(event.dataTransfer?.files ?? []));
    });

    const viewer = root.querySelector<HTMLElement>("[data-viewer]");
    viewer?.addEventListener("click", async (event) => {
      if (!this.placementMode) {
        return;
      }

      event.preventDefault();
      const coordinates = this.renderer?.screenToCoordinates(event.clientX, event.clientY);
      if (!coordinates) {
        return;
      }

      if (this.placementMode === "scene") {
        await this.addNavigationHotspot(root, coordinates);
      }

      if (this.placementMode === "info") {
        await this.addInfoHotspot(root, coordinates);
      }

      if (this.placementMode === "image" || this.placementMode === "video" || this.placementMode === "link") {
        await this.addMediaHotspot(root, coordinates, this.placementMode);
      }

      this.placementMode = null;
      this.renderPlacementHint(root, "");
    });

    root.addEventListener("keydown", (event) => {
      const keyboardTarget = event.target instanceof HTMLElement ? event.target : null;
      const fileTrigger = keyboardTarget?.closest<HTMLElement>("[data-file-trigger]");
      if (fileTrigger && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        const input = document.getElementById(fileTrigger.dataset.fileTrigger ?? "");
        if (input instanceof HTMLInputElement) input.click();
        return;
      }
      if (event.key === "Escape") {
        const contextualMenu = root.querySelector<HTMLDetailsElement>(
          ".scene-overflow-menu[open], .add-hotspot-menu[open], .hotspot-overflow-menu[open]"
        );
        if (contextualMenu) {
          event.preventDefault();
          contextualMenu.open = false;
          contextualMenu.querySelector<HTMLElement>("summary")?.focus();
          return;
        }
        const projectSettings = root.querySelector<HTMLDetailsElement>(".project-settings[open]");
        if (projectSettings) {
          event.preventDefault();
          projectSettings.open = false;
          projectSettings.querySelector<HTMLElement>("summary")?.focus();
          return;
        }
        const actionMenu = root.querySelector<HTMLDetailsElement>(".action-menu[open]");
        if (actionMenu) {
          event.preventDefault();
          actionMenu.open = false;
          actionMenu.querySelector<HTMLElement>("summary")?.focus();
          return;
        }
        if (window.matchMedia("(max-width: 980px)").matches && (!this.leftPanelCollapsed || !this.rightPanelCollapsed)) {
          event.preventDefault();
          this.leftPanelCollapsed = true;
          this.rightPanelCollapsed = true;
          this.syncShellLayout(root);
        }
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        void (event.shiftKey ? this.redo(root) : this.undo(root));
      }
      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        void this.redo(root);
      }
    });
  }

  private async importFiles(root: HTMLElement, files: File[]): Promise<void> {
    if (files.length === 0) {
      this.renderImportIssues(root, [{ severity: "warning", message: "No se seleccionaron archivos." }]);
      return;
    }

    const capacity = await planImportCapacity(files);
    if (!capacity.allowed) {
      this.renderImportIssues(root, [{ severity: "error", message: `${capacity.warning} Libera espacio o divide el recorrido en lotes.` }]);
      return;
    }
    const capacityText = `Origen ${formatBytes(capacity.sourceBytes)}; almacenamiento estimado ${formatBytes(capacity.estimatedBytes)}.`;
    this.renderImportStatus(root, `Importando ${files.length} foto${files.length === 1 ? "" : "s"} 360... ${capacityText}`);

    let result;
    try {
      result = await this.importer.import(files.map((file) => ({ file })));
    } catch {
      this.renderImportIssues(root, [
        {
          severity: "error",
          message: "No se pudieron leer las imagenes. Confirma que sean JPG/JPEG exportados como panoramas 360."
        }
      ]);
      return;
    }

    if (result.scenes.length === 0) {
      this.renderImportIssues(root, [
        ...result.issues,
        {
          severity: "warning",
          message: "No se agrego ninguna escena. Usa fotos JPG/JPEG panoramicas ya procesadas, no archivos RAW/DNG/INSP."
        }
      ]);
      return;
    }

    const importedScenes = result.scenes.map((scene) => ({ ...scene }));

    const candidates = this.dedupeSceneIds(importedScenes);
    this.startImportSession(candidates, files);
    this.importController?.abort();
    this.importController = new AbortController();
    const importSignal = this.importController.signal;
    const newScenes: Scene[] = [];
    let cancelled = false;
    const importIssues = [
      ...result.issues,
      ...(capacity.warning ? [{ severity: "warning" as const, message: capacity.warning }] : [])
    ];
    for (const [index, scene] of candidates.entries()) {
      this.renderImportProgress(root, `Procesando ${index + 1} de ${candidates.length}: ${scene.name}`, index, candidates.length);
      try {
        await this.prepareImportedScene(scene, importedScenes[index], files, importSignal);
        newScenes.push(scene);
        this.markImportSceneCompleted(scene.id);
      } catch (error) {
        await this.assets.removeSceneAssets(this.project.id, scene.id);
        if (importSignal.aborted) {
          cancelled = true;
          break;
        }
        importIssues.push({
          severity: "error",
          message: `No se pudo conservar el original de ${scene.name}: ${getErrorMessage(error)}`
        });
      }
    }

    if (newScenes.length === 0) {
      this.clearImportSession();
      this.importController = null;
      this.renderImportStatus(root, cancelled ? "Importacion cancelada. No se agregaron escenas." : "No se importaron escenas porque no fue posible preservar sus originales.", importIssues, {
        files: files.length,
        imported: 0,
        warnings: importIssues.filter((issue) => issue.severity !== "error").length,
        errors: importIssues.filter((issue) => issue.severity === "error").length
      });
      return;
    }

    this.project = {
      ...this.project,
      scenes: this.autoConnectLinearScenes([...this.project.scenes, ...newScenes], newScenes),
      startScene: this.project.startScene ?? newScenes[0]?.id ?? null
    };
    this.activeSceneId = this.project.startScene ?? this.project.scenes[0]?.id ?? "";
    await this.persistAndRender(root, true);
    this.clearImportSession();
    this.importController = null;
    this.renderImportStatus(
      root,
      `${cancelled ? "Importacion cancelada. " : ""}${newScenes.length} escena${newScenes.length === 1 ? "" : "s"} importada${newScenes.length === 1 ? "" : "s"}. ${
        newScenes.length > 1 ? "Se conectaron en linea automaticamente." : ""
      }`,
      importIssues,
      {
        files: files.length,
        imported: newScenes.length,
        warnings: importIssues.filter((issue) => issue.severity !== "error").length,
        errors: importIssues.filter((issue) => issue.severity === "error").length
      }
    );
  }

  private async prepareImportedScene(scene: Scene, originalScene: Scene, files: File[], signal?: AbortSignal): Promise<void> {
    const sourceFile = files.find((file) => originalScene.panorama.endsWith(file.name));
    if (!sourceFile) return;
    await this.storePanoramaAssets(scene, sourceFile, signal);
  }

  private async storePanoramaAssets(scene: Scene, sourceFile: File, signal?: AbortSignal): Promise<void> {
    const previewPath = `previews/${scene.id}.jpg`;
    const originalPath = `source/panoramas/${scene.id}.jpg`;
    const tilePathTemplate = `tiles/${scene.id}/{col}-{row}.jpg`;
    scene.panorama = previewPath;

    const processed = await processPanorama(sourceFile, signal);
    const previewFile = new File([processed.preview.blob], `${scene.id}.jpg`, { type: "image/jpeg" });
    const originalFile = new File([sourceFile], sourceFile.name, { type: sourceFile.type || "image/jpeg" });

    scene.metadata = {
      ...scene.metadata,
      sourceFileName: sourceFile.name,
      sourceBytes: processed.sourceBytes,
      optimizedBytes: processed.preview.bytes,
      sourceSize: `${processed.sourceWidth}x${processed.sourceHeight}`,
      optimizedSize: `${processed.preview.width}x${processed.preview.height}`,
      processingMode: processed.usedWorker ? "worker" : "main-thread-fallback",
      optimization: {
        maxWidth: 2048,
        quality: processed.preview.quality,
        resized: processed.preview.resized
      }
    };
    setPanoramaAssets(scene, {
      original: {
        path: originalPath,
        width: processed.sourceWidth,
        height: processed.sourceHeight,
        bytes: sourceFile.size,
        sha256: processed.sha256
      },
      preview: {
        path: previewPath,
        width: processed.preview.width,
        height: processed.preview.height,
        bytes: processed.preview.bytes
      },
      tiles: {
        width: processed.tiles.width,
        height: processed.tiles.height,
        cols: processed.tiles.cols,
        rows: processed.tiles.rows,
        tileWidth: processed.tiles.tileWidth,
        tileHeight: processed.tiles.tileHeight,
        pathTemplate: tilePathTemplate
      }
    });

    await this.assets.saveScenePanorama(this.project.id, scene.id, previewFile);
    await this.assets.saveProjectAsset(this.project.id, previewPath, previewFile);
    await this.assets.saveProjectAsset(this.project.id, originalPath, originalFile);
    for (const tile of processed.tiles.tiles) {
      const path = tilePathTemplate.replace("{col}", String(tile.col)).replace("{row}", String(tile.row));
      await this.assets.saveProjectAsset(this.project.id, path, new File([tile.blob], `${tile.col}-${tile.row}.jpg`, { type: "image/jpeg" }));
    }

    if (processed.thumbnail) {
      scene.thumbnail = `thumbnails/${scene.id}.jpg`;
      await this.assets.saveProjectAsset(
        this.project.id,
        scene.thumbnail,
        new File([processed.thumbnail], `${scene.id}.jpg`, { type: "image/jpeg" })
      );
    } else {
      scene.thumbnail = undefined;
    }
  }

  private async recoverOriginalPanoramas(root: HTMLElement, files: File[]): Promise<void> {
    const status = root.querySelector<HTMLElement>("[data-import-status]");
    const pendingScenes = this.project.scenes.filter((scene) => !getOriginalPanoramaPath(scene));
    let recovered = 0;

    for (const scene of pendingScenes) {
      const expectedName = typeof scene.metadata?.sourceFileName === "string" ? scene.metadata.sourceFileName : "";
      const sourceFile = files.find((file) => file.name === expectedName) ?? files.find((file) => file.name.toLowerCase().includes(scene.id.toLowerCase()));
      if (!sourceFile) continue;
      status!.textContent = `Recuperando original ${recovered + 1} de ${pendingScenes.length}: ${scene.name}`;
      await this.storePanoramaAssets(scene, sourceFile);
      recovered += 1;
    }

    await this.persistAndRender(root, true);
    status!.innerHTML = `<p class="${recovered === pendingScenes.length ? "status-ok" : "issue issue--warning"}">${recovered} de ${pendingScenes.length} originales recuperados. ${
      recovered < pendingScenes.length ? "Selecciona los JPG faltantes para completar la calidad final." : "El proyecto ya puede exportarse en alta resolucion."
    }</p>`;
  }

  private startImportSession(scenes: Scene[], files: File[]): void {
    const session: ActiveImportSession = {
      projectId: this.project.id,
      startedAt: new Date().toISOString(),
      sceneIds: scenes.map((scene) => scene.id),
      fileNames: files.map((file) => file.name),
      completedSceneIds: []
    };
    try {
      localStorage.setItem(this.importSessionKey, JSON.stringify(session));
    } catch {
      // Import can continue even if the small recovery journal cannot be written.
    }
  }

  private markImportSceneCompleted(sceneId: string): void {
    const session = this.readImportSession();
    if (!session || session.completedSceneIds.includes(sceneId)) return;
    session.completedSceneIds.push(sceneId);
    try {
      localStorage.setItem(this.importSessionKey, JSON.stringify(session));
    } catch {
      // The asset writes still report their own quota errors.
    }
  }

  private clearImportSession(): void {
    localStorage.removeItem(this.importSessionKey);
  }

  private readImportSession(): ActiveImportSession | null {
    try {
      const value = JSON.parse(localStorage.getItem(this.importSessionKey) ?? "null") as ActiveImportSession | null;
      return value && Array.isArray(value.sceneIds) && typeof value.projectId === "string" ? value : null;
    } catch {
      return null;
    }
  }

  private async recoverInterruptedImport(): Promise<string | null> {
    const session = this.readImportSession();
    if (!session) return null;
    const savedSceneIds = new Set(session.projectId === this.project.id ? this.project.scenes.map((scene) => scene.id) : []);
    for (const sceneId of session.sceneIds) {
      if (!savedSceneIds.has(sceneId)) await this.assets.removeSceneAssets(session.projectId, sceneId);
    }
    this.clearImportSession();
    return `Se detecto una importacion interrumpida de ${session.fileNames.length} foto${session.fileNames.length === 1 ? "" : "s"}. Los archivos parciales se limpiaron; vuelve a seleccionar el lote.`;
  }

  private dedupeSceneIds(scenes: Scene[]): Scene[] {
    const usedIds = new Set(this.project.scenes.map((scene) => scene.id));

    return scenes.map((scene) => {
      let id = scene.id;
      let counter = 2;

      while (usedIds.has(id)) {
        id = `${scene.id}-${counter}`;
        counter += 1;
      }

      usedIds.add(id);
      return { ...scene, id };
    });
  }

  private autoConnectLinearScenes(allScenes: Scene[], importedScenes: Scene[]): Scene[] {
    if (importedScenes.length < 2) {
      return allScenes;
    }

    const importedIds = new Set(importedScenes.map((scene) => scene.id));
    return allScenes.map((scene) => {
      if (!importedIds.has(scene.id)) {
        return scene;
      }

      const index = importedScenes.findIndex((item) => item.id === scene.id);
      return {
        ...scene,
        hotspots: this.mergeLinearSceneLinks(scene, importedScenes[index - 1], importedScenes[index + 1])
      };
    });
  }

  private mergeLinearSceneLinks(scene: Scene, previousScene: Scene | undefined, nextScene: Scene | undefined): Scene["hotspots"] {
    const existingTargets = new Set(scene.hotspots.filter((hotspot) => hotspot.type === "scene").map((hotspot) => hotspot.targetScene));
    const hotspots = [...scene.hotspots];

    if (previousScene && !existingTargets.has(previousScene.id)) {
      hotspots.push(createLinearHotspot("prev", previousScene));
    }

    if (nextScene && !existingTargets.has(nextScene.id)) {
      hotspots.push(createLinearHotspot("next", nextScene));
    }

    return hotspots;
  }

  private replaceLinearSceneLinks(scene: Scene, previousScene: Scene | undefined, nextScene: Scene | undefined): Scene["hotspots"] {
    const hotspots: Scene["hotspots"] = scene.hotspots.filter((hotspot) => hotspot.type !== "scene");

    if (previousScene) {
      hotspots.push(createLinearHotspot("prev", previousScene));
    }

    if (nextScene) {
      hotspots.push(createLinearHotspot("next", nextScene));
    }

    return hotspots;
  }

  private async repairLinearRoute(root: HTMLElement, target: HTMLElement): Promise<void> {
    if (this.project.scenes.length < 2) {
      return;
    }

    if (!(await this.saveSnapshot(root))) return;
    this.project = {
      ...this.project,
      scenes: this.project.scenes.map((scene, index, scenes) => ({
        ...scene,
        hotspots: this.replaceLinearSceneLinks(scene, scenes[index - 1], scenes[index + 1])
      }))
    };
    await this.persistAndRender(root, true);
    this.flashButton(target, "Recorrido listo");
  }

  private async prepareQuickTour(root: HTMLElement, target: HTMLElement): Promise<void> {
    if (this.project.scenes.length === 0) {
      this.renderImportStatus(root, "Importa tus panoramas antes de preparar el tour.");
      return;
    }

    const startSceneId = this.project.scenes[0].id;
    if (!(await this.saveSnapshot(root))) return;
    this.project = {
      ...this.project,
      startScene: startSceneId,
      scenes: this.project.scenes.map((scene, index, scenes) => ({
        ...scene,
        hotspots: this.replaceLinearSceneLinks(scene, scenes[index - 1], scenes[index + 1])
      }))
    };
    this.activeSceneId = startSceneId;
    await this.persistAndRender(root, true);
    this.renderImportStatus(root, "Tour rapido preparado: inicio y recorrido lineal listos.");
    this.flashButton(target, "Listo");
  }

  private async persistAndRender(root: HTMLElement, remountPreview: boolean): Promise<void> {
    await this.saveProject(root);
    this.recentProjects = await this.storage.list();
    this.snapshots = await this.storage.listSnapshots(this.project.id);
    await this.renderWorkspace(root, remountPreview);
  }

  private async saveProject(root: HTMLElement): Promise<boolean> {
    try {
      await this.storage.save(this.project);
      this.renderPersistenceStatus(root, "Guardado local.");
      return true;
    } catch (error) {
      this.renderPersistenceStatus(root, getErrorMessage(error), true);
      return false;
    }
  }

  private async saveSnapshot(root: HTMLElement): Promise<boolean> {
    try {
      await this.storage.snapshot(this.project);
      this.snapshots = await this.storage.listSnapshots(this.project.id);
      this.renderSnapshots(root);
      this.renderPersistenceStatus(root, "Punto de recuperacion guardado.");
      return true;
    } catch (error) {
      this.renderPersistenceStatus(root, `No se creo el punto de recuperacion. ${getErrorMessage(error)}`, true);
      return false;
    }
  }

  private renderPersistenceStatus(root: HTMLElement, message: string, isError = false): void {
    const status = root.querySelector<HTMLElement>("[data-persistence-status]");
    if (!status) {
      return;
    }
    status.textContent = message ? `- ${message}` : "";
    status.classList.toggle("is-error", isError);
  }

  private async renderWorkspace(root: HTMLElement, remountPreview: boolean): Promise<void> {
    if (!this.activeSceneId) {
      this.activeSceneId = this.project.startScene ?? this.project.scenes[0]?.id ?? "";
    }
    this.ensureActiveFloorplan();
    this.renderWorkspaceContext(root);

    await this.renderSceneList(root);
    this.assetIssues = await this.validateAssets();
    this.renderRecentProjects(root);
    this.renderSceneProperties(root);
    this.renderNextSteps(root);
    this.renderRouteMap(root);
    await this.renderFloorplanPanel(root);
    await this.renderGalleryPanel(root);
    this.renderValidation(root);
    this.renderExportReadiness(root);
    this.renderSnapshots(root);
    this.updateUndoControls(root);

    if (remountPreview) {
      await this.mountPreview(root);
    } else {
      await this.renderPreviewFallback(root);
      this.renderer?.setSelectedHotspot(this.selectedHotspotId);
    }
  }

  private renderImportIssues(root: HTMLElement, issues: Array<{ severity: string; message: string }>): void {
    const status = root.querySelector<HTMLElement>("[data-import-status]");
    if (!status) {
      return;
    }

    if (issues.length === 0) {
      status.innerHTML = "";
      return;
    }

    status.innerHTML = `
      <ul class="issue-list">
        ${issues.map((issue) => `<li class="issue issue--${escapeHtml(issue.severity)}">${escapeHtml(issue.message)}</li>`).join("")}
      </ul>
    `;
  }

  private renderImportStatus(
    root: HTMLElement,
    message: string,
    issues: Array<{ severity: string; message: string }> = [],
    summary?: { files: number; imported: number; warnings: number; errors: number }
  ): void {
    const status = root.querySelector<HTMLElement>("[data-import-status]");
    if (status) {
      status.innerHTML = `
        <p class="status-ok">${escapeHtml(message)}</p>
        ${
          summary
            ? `<div class="import-summary" aria-label="Resumen de importacion">
                <span><b>${summary.files}</b> archivos</span>
                <span><b>${summary.imported}</b> escenas</span>
                <span><b>${summary.warnings}</b> avisos</span>
                <span><b>${summary.errors}</b> errores</span>
              </div>`
            : ""
        }
        ${
          issues.length
            ? `<ul class="issue-list import-issue-list">
                ${issues.map((issue) => `<li class="issue issue--${escapeHtml(issue.severity)}">${escapeHtml(issue.message)}</li>`).join("")}
              </ul>`
            : ""
        }
      `;
    }
  }

  private renderImportProgress(root: HTMLElement, message: string, value: number, max: number): void {
    const status = root.querySelector<HTMLElement>("[data-import-status]");
    if (!status) return;
    const percent = max > 0 ? Math.round((value / max) * 100) : 0;
    status.innerHTML = `
      <div class="operation-progress" role="status" aria-live="polite">
        <div><span>${escapeHtml(message)}</span><strong>${percent}%</strong></div>
        <progress max="${max}" value="${value}"></progress>
        <button type="button" data-action="cancel-import">Cancelar</button>
      </div>
    `;
  }

  private async mountPreview(root: HTMLElement): Promise<void> {
    const viewerElement = root.querySelector<HTMLElement>("[data-viewer]");
    if (!viewerElement) {
      return;
    }

    this.renderer?.destroy();
    viewerElement.innerHTML = "";

    if (this.project.scenes.length === 0) {
      viewerElement.innerHTML = `
        <div class="empty-viewer">
          <strong>Importa tus panoramas para comenzar.</strong>
          <span>El preview 360 aparecera aqui al seleccionar una escena.</span>
        </div>
      `;
      return;
    }

    this.renderer = new CanvasTourRenderer(
      (sceneId) => {
        this.activeSceneId = sceneId;
        void this.renderPreviewFallback(root);
        void this.renderWorkspace(root, false);
      },
      async (scene) => {
        const asset = await this.assets.loadScenePanorama(this.project.id, scene.id);
        if (!asset) {
          return { src: scene.panorama };
        }

        const src = URL.createObjectURL(asset.blob);
        return { src, release: () => URL.revokeObjectURL(src) };
      },
      4,
      (hotspotId, coordinates) => void this.moveHotspotFromCanvas(root, hotspotId, coordinates),
      (hotspotId) => this.selectHotspot(root, hotspotId)
    );
    this.renderer.mount(viewerElement, this.project);
    this.renderer.setSelectedHotspot(this.selectedHotspotId);
    await this.renderPreviewFallback(root);
  }

  private async renderPreviewFallback(root: HTMLElement): Promise<void> {
    const viewerElement = root.querySelector<HTMLElement>("[data-viewer]");
    if (!viewerElement || this.project.scenes.length === 0) {
      return;
    }

    const activeScene = this.project.scenes.find((scene) => scene.id === this.activeSceneId) ?? this.project.scenes[0];
    viewerElement.querySelector(".preview-fallback-image")?.remove();
    viewerElement.querySelector(".preview-fallback-badge")?.remove();

    const sceneIndex = this.project.scenes.findIndex((scene) => scene.id === activeScene.id);
    let controls = viewerElement.querySelector<HTMLElement>(".preview-fallback-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "preview-fallback-controls";
      viewerElement.append(controls);
    }
    controls.innerHTML = `
      <button data-action="previous-scene" aria-label="Escena anterior" title="Ir a la escena anterior" ${sceneIndex <= 0 ? "disabled" : ""}>${renderIcon(ChevronLeft)}<span>Anterior</span></button>
      <span class="preview-scene-name" title="${escapeHtml(activeScene.name)}">${escapeHtml(activeScene.name)}</span>
      <button data-action="next-scene" aria-label="Escena siguiente" title="Ir a la escena siguiente" ${sceneIndex >= this.project.scenes.length - 1 ? "disabled" : ""}><span>Siguiente</span>${renderIcon(ChevronRight)}</button>
    `;
  }

  private async navigateRelativeScene(root: HTMLElement, direction: -1 | 1): Promise<void> {
    const currentIndex = this.project.scenes.findIndex((scene) => scene.id === this.activeSceneId);
    const nextScene = this.project.scenes[currentIndex + direction];
    if (!nextScene) {
      return;
    }

    this.activeSceneId = nextScene.id;
    this.renderer?.goToScene(nextScene.id);
    await this.renderWorkspace(root, false);
  }

  private async renderSceneList(root: HTMLElement): Promise<void> {
    const sceneList = root.querySelector<HTMLElement>("[data-scene-list]");
    const sceneCount = root.querySelector<HTMLElement>("[data-scene-count]");
    if (!sceneList || !sceneCount) {
      return;
    }

    for (const url of this.sceneThumbnailUrls) {
      URL.revokeObjectURL(url);
    }
    this.sceneThumbnailUrls = [];
    sceneCount.textContent = String(this.project.scenes.length);

    if (this.project.scenes.length === 0) {
      sceneList.innerHTML = `<p class="empty-list">Aun no hay escenas.</p>`;
      return;
    }

    const normalizedFilter = normalizeSearchTerm(this.sceneFilter);
    const sceneEntries = this.project.scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene, index }) => {
        if (!normalizedFilter) {
          return true;
        }

        const searchable = normalizeSearchTerm(`${index + 1} ${scene.name} ${scene.id}`);
        return searchable.includes(normalizedFilter);
      });
    const routeLinks = this.project.scenes.reduce((total, scene) => total + scene.hotspots.filter((hotspot) => hotspot.type === "scene").length, 0);
    const optimizedScenes = this.project.scenes.filter((scene) => scene.metadata?.optimizedSize).length;
    const summary = `
      <div class="scene-list-summary" aria-label="Resumen de escenas">
        <span><b>${this.project.scenes.length}</b> escenas</span>
        <span><b>${routeLinks}</b> conexiones</span>
        <span><b>${optimizedScenes}</b> optimizadas</span>
      </div>
    `;
    const filterStatus = normalizedFilter
      ? `<p class="scene-filter-status">${sceneEntries.length} de ${this.project.scenes.length} escenas coinciden.</p>`
      : "";

    if (sceneEntries.length === 0) {
      sceneList.innerHTML = `${summary}${filterStatus}<p class="empty-list">No hay escenas que coincidan.</p>`;
      return;
    }

    sceneList.innerHTML = summary + filterStatus + (
      await Promise.all(
        sceneEntries.map(async ({ scene, index }) => {
          let thumbnailUrl = "";
          if (scene.thumbnail) {
            const asset = await this.assets.loadProjectAsset(this.project.id, scene.thumbnail);
            thumbnailUrl = asset ? URL.createObjectURL(asset.blob) : scene.thumbnail;
            if (asset) {
              this.sceneThumbnailUrls.push(thumbnailUrl);
            }
          }

        const isActive = scene.id === this.activeSceneId;
        const isStart = scene.id === this.project.startScene;
        const routeStatus = getSceneRouteStatus(this.project.scenes, scene, index);
        const optimizationLabel = getSceneOptimizationLabel(scene);
        return `
          <button class="scene-item${isActive ? " is-active" : ""}" data-scene-id="${escapeHtml(scene.id)}">
            ${thumbnailUrl ? `<img src="${escapeHtml(thumbnailUrl)}" alt="" />` : ""}
            <span class="scene-item-body">
              <span>${index + 1}. ${escapeHtml(scene.name)}</span>
              <small>${escapeHtml(routeStatus)} · ${escapeHtml(optimizationLabel)}</small>
            </span>
            ${isStart ? "<strong>Inicio</strong>" : ""}
          </button>
        `;
        })
      )
    ).join("");
  }

  private renderRecentProjects(root: HTMLElement): void {
    const list = root.querySelector<HTMLElement>("[data-recent-list]");
    const count = root.querySelector<HTMLElement>("[data-project-count]");
    if (!list || !count) {
      return;
    }

    count.textContent = String(this.recentProjects.length);

    if (this.recentProjects.length === 0) {
      list.innerHTML = `<p class="empty-list">Aun no hay proyectos guardados.</p>`;
      return;
    }

    list.innerHTML = this.recentProjects
      .map(
        (project) => `
          <article class="recent-item${project.id === this.project.id ? " is-active" : ""}">
            <button class="recent-open" data-project-id="${escapeHtml(project.id)}">
              <span>${escapeHtml(project.title)}</span>
              <small>${formatRelativeDate(project.updatedAt)}</small>
            </button>
            <button class="recent-delete danger-action" title="Eliminar proyecto" data-action="delete-project" data-project-id="${escapeHtml(project.id)}">Eliminar</button>
          </article>
        `
      )
      .join("");
  }

  private renderSceneProperties(root: HTMLElement): void {
    const panel = root.querySelector<HTMLElement>("[data-scene-properties]");
    if (!panel) {
      return;
    }

    const sceneIndex = this.project.scenes.findIndex((item) => item.id === this.activeSceneId);
    const scene = this.project.scenes[sceneIndex];
    if (!scene) {
      panel.innerHTML = `<p class="muted">Selecciona una escena para editarla.</p>`;
      return;
    }

    const targetOptions = this.project.scenes
      .filter((item) => item.id !== scene.id)
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
      .join("");
    const isStartScene = this.project.startScene === scene.id;

    panel.innerHTML = `
      <div class="scene-editor-card">
        <div class="scene-name-row">
          <label class="scene-name-field">
            <span class="visually-hidden">Nombre de la escena</span>
            <input value="${escapeHtml(scene.name)}" data-field="scene-name" aria-label="Nombre de la escena" />
          </label>
          <div class="scene-order-actions" role="group" aria-label="Orden de la escena">
            <button class="icon-button" data-action="move-scene-up" aria-label="Subir escena" title="Subir escena" ${sceneIndex <= 0 ? "disabled" : ""}>${renderIcon(ArrowUp)}</button>
            <button class="icon-button" data-action="move-scene-down" aria-label="Bajar escena" title="Bajar escena" ${sceneIndex >= this.project.scenes.length - 1 ? "disabled" : ""}>${renderIcon(ArrowDown)}</button>
          </div>
          <details class="scene-overflow-menu">
            <summary aria-label="Acciones de la escena" title="Acciones de la escena">${renderIcon(Ellipsis)}</summary>
            <div>
              <button class="danger-action" data-action="delete-scene">${renderIcon(Trash)}<span>Eliminar escena</span></button>
            </div>
          </details>
        </div>
        <div class="scene-quick-actions">
          ${
            isStartScene
              ? `<span class="scene-start-status">${renderIcon(House)} Escena inicial</span>`
              : `<button class="text-action" data-action="set-start">${renderIcon(House)}<span>Marcar como inicial</span></button>`
          }
          <button class="text-action" data-action="save-view">${renderIcon(Crosshair)}<span>Guardar orientacion</span></button>
        </div>
      </div>

      <div class="tool-group hotspot-tool-group">
        <div class="tool-group-heading">
          <div>
            <h3>Puntos interactivos</h3>
            <span>${scene.hotspots.length} punto${scene.hotspots.length === 1 ? "" : "s"}</span>
          </div>
          <details class="add-hotspot-menu">
            <summary>${renderIcon(Plus)}<span>Anadir</span></summary>
            <div>
              <label class="hotspot-target-field">
                <span>Destino de la conexion</span>
                <select data-field="hotspot-target" aria-label="Escena destino" ${targetOptions ? "" : "disabled"}>
                  ${targetOptions || "<option>No hay destino disponible</option>"}
                </select>
              </label>
              <button data-action="add-scene-link" ${targetOptions ? "" : "disabled"}>${renderIcon(Route)}<span>Conexion</span></button>
              <button data-action="add-info">${renderIcon(Info)}<span>Informacion</span></button>
              <button data-action="add-image">${renderIcon(ImageIcon)}<span>Imagen</span></button>
              <button data-action="add-video">${renderIcon(Video)}<span>Video</span></button>
              <button data-action="add-link">${renderIcon(LinkIcon)}<span>Enlace</span></button>
            </div>
          </details>
        </div>
        <p class="placement-hint" data-placement-hint></p>
        <div class="hotspot-editor-list">
          ${scene.hotspots.map((hotspot, index) => this.renderHotspotEditor(hotspot, index, scene.id)).join("") || `<p class="empty-list">Aun no hay puntos interactivos en esta escena.</p>`}
        </div>
      </div>
    `;
  }

  private renderHotspotEditor(hotspot: Hotspot, index: number, sceneId: string): string {
    const id = escapeHtml(hotspot.id);
    const selected = hotspot.id === this.selectedHotspotId;
    const expanded = selected || (!this.selectedHotspotId && index === 0);
    const typeLabel = getHotspotTypeLabel(hotspot);
    const title = hotspot.label?.trim() || typeLabel;
    const menu = `
      <details class="hotspot-overflow-menu">
        <summary aria-label="Acciones de ${escapeHtml(title)}" title="Acciones del punto">${renderIcon(Ellipsis)}</summary>
        <div>
          <button class="danger-action" data-action="delete-hotspot" data-hotspot-id="${id}">${renderIcon(Trash)}<span>Eliminar punto</span></button>
        </div>
      </details>
    `;
    const labelField = `
      <label>
        <span>Etiqueta</span>
        <input value="${escapeHtml(hotspot.label ?? "")}" data-hotspot-id="${id}" data-hotspot-field="label" />
      </label>
    `;

    if (hotspot.type === "scene") {
      const options = this.project.scenes
        .filter((scene) => scene.id !== sceneId)
        .map(
          (scene) =>
            `<option value="${escapeHtml(scene.id)}" ${scene.id === hotspot.targetScene ? "selected" : ""}>${escapeHtml(scene.name)}</option>`
        )
        .join("");

      return `
        <article class="hotspot-editor${selected ? " is-selected" : ""}${expanded ? " is-expanded" : ""}">
          <header>
            <button class="hotspot-editor-summary" data-action="select-hotspot" data-hotspot-id="${id}" aria-expanded="${expanded}">
              <span><strong>${index + 1}. ${escapeHtml(title)}</strong><small>${typeLabel}</small></span>
            </button>
            ${menu}
          </header>
          ${
            expanded
              ? `<div class="hotspot-editor-fields">
                  ${labelField}
                  <label>
                    <span>Destino</span>
                    <select data-hotspot-id="${id}" data-hotspot-field="targetScene">${options}</select>
                  </label>
                  <button class="text-action hotspot-position-action" data-action="move-hotspot-here" data-hotspot-id="${id}">${renderIcon(LocateFixed)}<span>Ubicar en la vista</span></button>
                </div>`
              : ""
          }
        </article>
      `;
    }

    if (hotspot.type === "info") {
      return `
        <article class="hotspot-editor${selected ? " is-selected" : ""}${expanded ? " is-expanded" : ""}">
          <header>
            <button class="hotspot-editor-summary" data-action="select-hotspot" data-hotspot-id="${id}" aria-expanded="${expanded}">
              <span><strong>${index + 1}. ${escapeHtml(title)}</strong><small>${typeLabel}</small></span>
            </button>
            ${menu}
          </header>
          ${
            expanded
              ? `<div class="hotspot-editor-fields">
                  ${labelField}
                  <label>
                    <span>Titulo</span>
                    <input value="${escapeHtml(hotspot.title)}" data-hotspot-id="${id}" data-hotspot-field="title" />
                  </label>
                  <label>
                    <span>Texto</span>
                    <textarea data-hotspot-id="${id}" data-hotspot-field="text">${escapeHtml(hotspot.text)}</textarea>
                  </label>
                  <button class="text-action hotspot-position-action" data-action="move-hotspot-here" data-hotspot-id="${id}">${renderIcon(LocateFixed)}<span>Ubicar en la vista</span></button>
                </div>`
              : ""
          }
        </article>
      `;
    }

    return `
      <article class="hotspot-editor${selected ? " is-selected" : ""}${expanded ? " is-expanded" : ""}">
        <header>
          <button class="hotspot-editor-summary" data-action="select-hotspot" data-hotspot-id="${id}" aria-expanded="${expanded}">
            <span><strong>${index + 1}. ${escapeHtml(title)}</strong><small>${typeLabel}</small></span>
          </button>
          ${menu}
        </header>
        ${
          expanded
            ? `<div class="hotspot-editor-fields">
                ${labelField}
                <label>
                  <span>Titulo</span>
                  <input value="${escapeHtml(hotspot.title ?? "")}" data-hotspot-id="${id}" data-hotspot-field="title" />
                </label>
                <label>
                  <span>URL</span>
                  <input value="${escapeHtml(hotspot.url)}" data-hotspot-id="${id}" data-hotspot-field="url" />
                </label>
                <button class="text-action hotspot-position-action" data-action="move-hotspot-here" data-hotspot-id="${id}">${renderIcon(LocateFixed)}<span>Ubicar en la vista</span></button>
              </div>`
            : ""
        }
      </article>
    `;
  }

  private renderNextSteps(root: HTMLElement): void {
    const panel = root.querySelector<HTMLElement>("[data-next-steps]");
    if (!panel) {
      return;
    }

    const issues = this.getProjectIssues();
    const errors = issues.filter((issue) => issue.severity === "error");
    const warnings = issues.filter((issue) => issue.severity === "warning");
    const routeComplete = isLinearRouteComplete(this.project.scenes);
    const activeScene = this.project.scenes.find((scene) => scene.id === this.activeSceneId);
    const reviewedScenes = this.project.scenes.filter((scene) => typeof scene.metadata?.reviewedAt === "string").length;
    const canExport = this.project.scenes.length > 0 && errors.length === 0;
    const steps = [
      {
        title: "Importar fotos 360",
        done: this.project.scenes.length > 0,
        detail:
          this.project.scenes.length > 0
            ? `${this.project.scenes.length} panorama${this.project.scenes.length === 1 ? "" : "s"} cargado${this.project.scenes.length === 1 ? "" : "s"}.`
            : "Arrastra los JPG equirectangulares al panel izquierdo."
      },
      {
        title: "Conectar recorrido",
        done: routeComplete,
        detail:
          this.project.scenes.length <= 1
            ? "Con una sola escena no hacen falta conexiones."
            : routeComplete
              ? "Todas las escenas tienen sus enlaces anterior y siguiente."
              : "Faltan conexiones; puedes preparar o reparar la linea automaticamente.",
        action: "quick-tour",
        actionLabel: "Preparar recorrido"
      },
      {
        title: "Revisar escenas",
        done: this.project.scenes.length > 0 && reviewedScenes === this.project.scenes.length,
        detail: activeScene
          ? `${reviewedScenes} de ${this.project.scenes.length} revisadas. Activa: ${activeScene.name}.`
          : "Selecciona una escena cuando exista el tour.",
        action: "save-view",
        actionLabel: "Confirmar escena actual"
      },
      {
        title: "Exportar tour",
        done: canExport && routeComplete && reviewedScenes === this.project.scenes.length,
        detail:
          canExport && routeComplete && reviewedScenes === this.project.scenes.length
            ? "El tour esta revisado y listo para generar su ZIP."
            : "Completa el recorrido y la revision; los errores criticos tambien bloquean la salida.",
        action: "export",
        actionLabel: "Exportar ZIP"
      }
    ];
    const nextStep = steps.find((step) => !step.done) ?? steps[steps.length - 1];
    const completedSteps = steps.filter((step) => step.done).length;

    panel.innerHTML = `
      <div class="workflow-progress" aria-label="Progreso para crear el tour">
        <span><strong>${completedSteps} de ${steps.length}</strong> etapas completas</span>
        <meter min="0" max="${steps.length}" value="${completedSteps}">${completedSteps} de ${steps.length}</meter>
      </div>
      <div class="next-step-card">
        <p class="eyebrow">Ahora</p>
        <strong>${escapeHtml(nextStep.title)}</strong>
        <span>${escapeHtml(nextStep.detail)}</span>
        ${
          nextStep.action
            ? `<button data-action="${escapeHtml(nextStep.action)}" ${this.project.scenes.length === 0 ? "disabled" : ""}>${escapeHtml(nextStep.actionLabel)}</button>`
            : ""
        }
      </div>
      <div class="next-step-list">
        ${steps
          .map(
            (step) => `
              <div class="next-step-item${step.done ? " is-done" : ""}">
                <i aria-hidden="true"></i>
                <div>
                  <strong>${escapeHtml(step.title)}</strong>
                  <span>${escapeHtml(step.detail)}</span>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
      ${
        warnings.length > 0
          ? `<p class="muted">${warnings.length} aviso${warnings.length === 1 ? "" : "s"} pendiente${warnings.length === 1 ? "" : "s"}; no bloquea exportar.</p>`
          : ""
      }
    `;
  }

  private renderRouteMap(root: HTMLElement): void {
    const panel = root.querySelector<HTMLElement>("[data-route-map]");
    if (!panel) {
      return;
    }

    if (this.project.scenes.length === 0) {
      panel.innerHTML = `<p class="muted">Importa panoramas para ver el recorrido.</p>`;
      return;
    }

    let completeScenes = 0;
    let routeWarnings = 0;
    const sceneIds = new Set(this.project.scenes.map((scene) => scene.id));
    const items = this.project.scenes
      .map((scene, index) => {
        const previous = this.project.scenes[index - 1];
        const next = this.project.scenes[index + 1];
        const sceneLinks = scene.hotspots.filter((hotspot) => hotspot.type === "scene");
        const hasPrevious = !previous || sceneLinks.some((hotspot) => hotspot.targetScene === previous.id);
        const hasNext = !next || sceneLinks.some((hotspot) => hotspot.targetScene === next.id);
        const isComplete = hasPrevious && hasNext;
        const targetCounts = new Map<string, number>();
        for (const hotspot of sceneLinks) {
          targetCounts.set(hotspot.targetScene, (targetCounts.get(hotspot.targetScene) ?? 0) + 1);
        }
        const duplicateCount = [...targetCounts.values()].filter((count) => count > 1).length;
        const brokenCount = sceneLinks.filter((hotspot) => !sceneIds.has(hotspot.targetScene)).length;
        const missing = [!hasPrevious ? "anterior" : "", !hasNext ? "siguiente" : ""].filter(Boolean);
        if (isComplete && duplicateCount === 0 && brokenCount === 0) completeScenes += 1;
        routeWarnings += duplicateCount + brokenCount + missing.length;
        const details = [
          missing.length ? `Falta ${missing.join(" y ")}` : "Linea completa",
          duplicateCount ? `${duplicateCount} destino duplicado${duplicateCount === 1 ? "" : "s"}` : "",
          brokenCount ? `${brokenCount} enlace${brokenCount === 1 ? "" : "s"} roto${brokenCount === 1 ? "" : "s"}` : ""
        ].filter(Boolean);

        return `
          <article class="route-step${scene.id === this.activeSceneId ? " is-active" : ""}${isComplete && duplicateCount === 0 && brokenCount === 0 ? " is-complete" : ""}">
            <button data-scene-id="${escapeHtml(scene.id)}">
              <span>${index + 1}</span>
              <strong>${escapeHtml(scene.name)}</strong>
            </button>
            <small>${escapeHtml(details.join(" · "))}</small>
          </article>
        `;
      })
      .join("");

    panel.innerHTML = `
      <div class="route-summary${routeWarnings ? " has-warnings" : ""}">
        <strong>${completeScenes} de ${this.project.scenes.length}</strong>
        <span>${routeWarnings ? `${routeWarnings} detalle${routeWarnings === 1 ? "" : "s"} por corregir` : "Recorrido lineal completo"}</span>
      </div>
      <div class="route-map">
        ${items}
      </div>
      <button class="route-repair-action text-action" data-action="repair-linear-route" ${this.project.scenes.length < 2 ? "disabled" : ""}>${renderIcon(Route)} Reparar recorrido lineal</button>
    `;
  }

  private async renderFloorplanPanel(root: HTMLElement): Promise<void> {
    const panel = root.querySelector<HTMLElement>("[data-floorplan-panel]");
    if (!panel) {
      return;
    }

    for (const url of this.mediaPreviewUrls) {
      URL.revokeObjectURL(url);
    }
    this.mediaPreviewUrls = [];

    const floorplan = this.getActiveFloorplan();
    const asset = floorplan ? await this.assets.loadProjectAsset(this.project.id, floorplan.image) : null;
    const imageUrl = asset ? URL.createObjectURL(asset.blob) : floorplan?.image;
    if (asset && imageUrl) {
      this.mediaPreviewUrls.push(imageUrl);
    }
    const markers =
      floorplan?.markers
        .map((marker) => {
          const scene = this.project.scenes.find((item) => item.id === marker.sceneId);
          return `
            <button class="floorplan-editor-marker${marker.sceneId === this.activeSceneId ? " is-active" : ""}" style="left:${marker.x}%;top:${marker.y}%;" title="${escapeHtml(scene?.name ?? "Escena")}"></button>
          `;
        })
        .join("") ?? "";
    const markerList =
      floorplan?.markers
        .map((marker) => {
          const scene = this.project.scenes.find((item) => item.id === marker.sceneId);
          return `
            <article class="marker-editor-item">
              <span>${escapeHtml(scene?.name ?? "Escena eliminada")}</span>
              <button class="danger-action" data-action="delete-floorplan-marker" data-marker-id="${escapeHtml(marker.id)}">Quitar</button>
            </article>
          `;
        })
        .join("") ?? "";
    const floorplanTabs = this.project.floorplans
      .map(
        (item, index) => `
          <button class="floorplan-tab${item.id === floorplan?.id ? " is-active" : ""}" type="button" data-action="select-floorplan" data-floorplan-id="${escapeHtml(item.id)}">
            <span>${escapeHtml(item.name || `Planta ${index + 1}`)}</span>
            <small>${item.markers.length}</small>
          </button>
        `
      )
      .join("");

    panel.innerHTML = `
      <div class="field-stack">
        <input id="floorplan-import" class="visually-hidden" type="file" accept="image/png,image/jpeg,image/jpg" tabindex="-1" data-action="import-floorplan" />
        <label class="compact-import" for="floorplan-import" role="button" tabindex="0" data-file-trigger="floorplan-import">
          <span>${floorplan ? "Agregar otra planta" : "Importar plano"}</span>
        </label>
        ${floorplanTabs ? `<div class="floorplan-tabs" aria-label="Plantas">${floorplanTabs}</div>` : ""}
        ${
          floorplan
            ? `<label>
                <span>Nombre de planta</span>
                <input value="${escapeHtml(floorplan.name)}" data-floorplan-id="${escapeHtml(floorplan.id)}" data-floorplan-field="name" />
              </label>
              <div class="floorplan-actions">
                <p class="metric">${floorplan.markers.length} marcador${floorplan.markers.length === 1 ? "" : "es"}</p>
                <button class="danger-action" data-action="delete-floorplan" data-floorplan-id="${escapeHtml(floorplan.id)}">Eliminar planta</button>
              </div>
              <div class="floorplan-editor" data-floorplan-stage>
                <img src="${escapeHtml(imageUrl ?? "")}" alt="${escapeHtml(floorplan.name)}" />
                ${markers}
              </div>
              <div class="marker-editor-list">
                ${markerList || `<p class="empty-list">Aun no hay marcadores.</p>`}
              </div>`
            : `<p class="muted">Agrega un plano PNG o JPG para ubicar las escenas.</p>`
        }
        <button data-action="add-floorplan-marker" ${floorplan && this.activeSceneId ? "" : "disabled"}>Colocar marcador</button>
        <p class="placement-hint" data-floorplan-hint></p>
      </div>
    `;
  }

  private async renderGalleryPanel(root: HTMLElement): Promise<void> {
    const panel = root.querySelector<HTMLElement>("[data-gallery-panel]");
    if (!panel) {
      return;
    }

    for (const url of this.galleryPreviewUrls) {
      URL.revokeObjectURL(url);
    }
    this.galleryPreviewUrls = [];

    const items = (
      await Promise.all(
        this.project.gallery.map(async (item, index) => {
          const asset = await this.assets.loadProjectAsset(this.project.id, item.image);
          const imageUrl = asset ? URL.createObjectURL(asset.blob) : item.image;
          if (asset) {
            this.galleryPreviewUrls.push(imageUrl);
          }

          return `
          <article class="gallery-editor-item">
            <header>
              <strong>${index + 1}. Foto</strong>
              <div class="mini-actions">
                <button data-action="move-gallery-item-up" data-gallery-id="${escapeHtml(item.id)}" ${index <= 0 ? "disabled" : ""}>Subir</button>
                <button data-action="move-gallery-item-down" data-gallery-id="${escapeHtml(item.id)}" ${index >= this.project.gallery.length - 1 ? "disabled" : ""}>Bajar</button>
                <button class="danger-action" data-action="delete-gallery-item" data-gallery-id="${escapeHtml(item.id)}">Eliminar</button>
              </div>
            </header>
            <img class="gallery-editor-thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.caption || "Foto de galeria")}" />
            <label>
              <span>Caption</span>
              <input value="${escapeHtml(item.caption ?? "")}" data-gallery-id="${escapeHtml(item.id)}" data-gallery-field="caption" />
            </label>
          </article>
        `
        })
      )
    ).join("");

    panel.innerHTML = `
      <div class="field-stack">
        <input id="gallery-import" class="visually-hidden" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" multiple tabindex="-1" data-action="import-gallery" />
        <label class="compact-import" for="gallery-import" role="button" tabindex="0" data-file-trigger="gallery-import">
          <span>Importar fotos</span>
        </label>
        <p class="metric">${this.project.gallery.length} foto${this.project.gallery.length === 1 ? "" : "s"} de galeria</p>
        <div class="gallery-editor-list">
          ${items || `<p class="empty-list">Aun no hay fotos de galeria.</p>`}
        </div>
      </div>
    `;
  }

  private renderValidation(root: HTMLElement): void {
    const validation = root.querySelector<HTMLElement>("[data-validation]");
    if (!validation) {
      return;
    }

    const issues = this.getProjectIssues();

    if (issues.length === 0) {
      validation.innerHTML = `<p class="status-ok">Listo para exportar</p>`;
      return;
    }

    validation.innerHTML = `
      <ul class="issue-list">
        ${issues.map((issue) => `<li class="issue issue--${issue.severity}">${escapeHtml(issue.message)}</li>`).join("")}
      </ul>
    `;
  }

  private renderExportReadiness(root: HTMLElement): void {
    const status = root.querySelector<HTMLElement>("[data-export-status]");
    if (!status) {
      return;
    }

    const issues = this.getProjectIssues();
    const errors = issues.filter((issue) => issue.severity === "error").length;
    const warnings = issues.length - errors;
    const connections = this.project.scenes.reduce(
      (total, scene) => total + scene.hotspots.filter((hotspot) => hotspot.type === "scene").length,
      0
    );
    const hasStartScene = Boolean(this.project.startScene && this.project.scenes.some((scene) => scene.id === this.project.startScene));
    const hasFloorplanMarkers = this.project.floorplans.some((floorplan) => floorplan.markers.length > 0);
    const sceneAssets = this.project.scenes.map((scene) => ({ scene, assets: getPanoramaAssets(scene) }));
    const originalCount = sceneAssets.filter(({ assets }) => Boolean(assets.original)).length;
    const tiledCount = sceneAssets.filter(({ assets }) => Boolean(assets.tiles)).length;
    const originalBytes = sceneAssets.reduce((total, { assets }) => total + (assets.original?.bytes ?? 0), 0);
    const estimatedZipBytes = Math.ceil(originalBytes * 2.4);
    const minimumWidth = Math.min(...sceneAssets.map(({ assets }) => assets.original?.width ?? Number.POSITIVE_INFINITY));
    const minimumHeight = Math.min(...sceneAssets.map(({ assets }) => assets.original?.height ?? Number.POSITIVE_INFINITY));
    const items = [
      { label: "Panoramas", value: this.project.scenes.length, ok: this.project.scenes.length > 0 },
      { label: "Originales", value: `${originalCount}/${this.project.scenes.length}`, ok: originalCount === this.project.scenes.length && originalCount > 0 },
      { label: "Imagenes optimizadas", value: `${tiledCount}/${this.project.scenes.length}`, ok: tiledCount === this.project.scenes.length && tiledCount > 0 },
      {
        label: "Resolucion minima",
        value: Number.isFinite(minimumWidth) ? `${minimumWidth}x${minimumHeight}` : "sin datos",
        ok: Number.isFinite(minimumWidth) && minimumWidth >= 4096
      },
      { label: "ZIP estimado", value: originalBytes ? formatBytes(estimatedZipBytes) : "sin datos", ok: originalBytes > 0 },
      { label: "Escena inicial", value: hasStartScene ? "lista" : "pendiente", ok: hasStartScene },
      { label: "Conexiones", value: connections, ok: connections > 0 || this.project.scenes.length <= 1 },
      {
        label: "Planos opcionales",
        value: this.project.floorplans.length
          ? `${this.project.floorplans.length} planta${this.project.floorplans.length === 1 ? "" : "s"}`
          : "pendiente",
        ok: hasFloorplanMarkers
      },
      { label: "Galeria opcional", value: this.project.gallery.length, ok: true },
      { label: "Validacion", value: errors ? `${errors} error${errors === 1 ? "" : "es"}` : warnings ? `${warnings} aviso${warnings === 1 ? "" : "s"}` : "sin errores", ok: errors === 0 }
    ];

    status.innerHTML = `
      <div class="readiness-list">
        ${items
          .map(
            (item) => `
              <div class="readiness-item${item.ok ? " is-ok" : ""}">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(String(item.value))}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      <details class="quality-details">
        <summary>Calidad por escena</summary>
        <div>
          ${sceneAssets
            .map(({ scene, assets }, index) => `<p><strong>${index + 1}. ${escapeHtml(scene.name)}</strong><span>${assets.original ? `${assets.original.width}x${assets.original.height} · ${formatBytes(assets.original.bytes)}` : "original pendiente"}</span></p>`)
            .join("") || `<p class="muted">No hay escenas.</p>`}
        </div>
      </details>
      <div class="local-test-card">
        <strong>${errors === 0 ? "Flujo local listo para probar" : "Falta corregir errores criticos"}</strong>
        <span>${
          errors === 0
            ? "La prueba automatizada completa para navegador/local es pnpm test:local."
            : "Cuando la validacion quede sin errores, corre pnpm test:local antes de perder tiempo en instalacion o publicacion."
        }</span>
      </div>
    `;
  }

  private renderSnapshots(root: HTMLElement): void {
    const list = root.querySelector<HTMLElement>("[data-snapshot-list]");
    if (!list) {
      return;
    }

    if (this.snapshots.length === 0) {
      list.innerHTML = `<p class="muted">Sin snapshots todavia.</p>`;
      return;
    }

    list.innerHTML = `
      <div class="snapshot-list">
        ${this.snapshots
          .map(
            (snapshot) => `
              <article class="snapshot-item">
                <div>
                  <strong>${escapeHtml(snapshot.title)}</strong>
                  <small>${formatRelativeDate(snapshot.createdAt)} · ${snapshot.sceneCount} escena${snapshot.sceneCount === 1 ? "" : "s"}</small>
                </div>
                <button data-action="restore-snapshot" data-snapshot-id="${escapeHtml(snapshot.id)}">Restaurar</button>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  private async restoreSnapshot(root: HTMLElement, snapshotId: string): Promise<void> {
    if (!window.confirm("Restaurar este snapshot y reemplazar el estado actual del tour?")) {
      return;
    }

    if (!(await this.saveSnapshot(root))) return;
    const snapshot = await this.storage.loadSnapshot(this.project.id, snapshotId);
    this.project = cloneProject(snapshot);
    this.activeSceneId = this.project.startScene ?? this.project.scenes[0]?.id ?? "";
    this.activeFloorplanId = this.project.floorplans[0]?.id ?? "";
    this.syncTitleField(root);
    await this.persistAndRender(root, true);
  }

  private async duplicateProject(root: HTMLElement, target: HTMLElement): Promise<void> {
    const sourceProject = this.project;
    const duplicate = cloneProject(sourceProject);
    duplicate.id = createProjectId("tour");
    duplicate.title = `${sourceProject.title} copia`;
    duplicate.publish = {
      ...sourceProject.publish,
      slug: toSlug(`${sourceProject.publish?.slug ?? sourceProject.id}-copia`)
    };

    await this.assets.copyProjectAssets(sourceProject.id, duplicate.id);
    this.project = duplicate;
    this.activeSceneId = duplicate.startScene ?? duplicate.scenes[0]?.id ?? "";
    this.activeFloorplanId = duplicate.floorplans[0]?.id ?? "";
    this.snapshots = [];
    this.syncTitleField(root);
    await this.persistAndRender(root, true);
    this.flashButton(target, "Duplicado");
  }

  private async saveProjectFolder(root: HTMLElement, target: HTMLElement): Promise<void> {
    const status = root.querySelector<HTMLElement>("[data-export-status]");
    if (!isTauriRuntime() && !supportsDirectoryExport()) {
      status!.innerHTML = `<p class="issue issue--warning">Tu navegador no permite guardar carpetas completas. En Tauri esto se guardara directo en disco.</p>`;
      return;
    }

    const files = await buildProjectFolder(
      this.project,
      async (project, assetPath) => this.resolveProjectAsset(project, assetPath),
      this.snapshots,
      async (projectId, snapshotId) => this.storage.loadSnapshot(projectId, snapshotId)
    );

    try {
      if (isTauriRuntime()) {
        const folderPath = await saveProjectFolderNative(this.project.id, files);
        status!.innerHTML = `<p class="status-ok">Carpeta de proyecto guardada en ${escapeHtml(folderPath)}.</p>`;
      } else {
        await writeFilesToDirectory(this.project.id, files);
        status!.innerHTML = `<p class="status-ok">Carpeta de proyecto guardada con ${files.length} archivos.</p>`;
      }
    } catch {
      status!.innerHTML = `<p class="issue issue--warning">Guardado de carpeta cancelado o sin permiso.</p>`;
      return;
    }

    this.flashButton(target, "Carpeta guardada");
  }

  private async downloadProjectBackup(root: HTMLElement, target: HTMLElement): Promise<void> {
    const status = root.querySelector<HTMLElement>("[data-export-status]");
    this.assetIssues = await this.validateAssets();
    const missingAssets = this.assetIssues.filter((issue) => issue.severity === "error");
    if (missingAssets.length > 0) {
      this.renderValidation(root);
      status!.innerHTML = `<ul class="issue-list">${missingAssets.map((issue) => `<li class="issue issue--error">${escapeHtml(issue.message)}</li>`).join("")}</ul>`;
      return;
    }

    try {
      const files = await buildProjectFolder(
        this.project,
        async (project, assetPath) => this.resolveProjectAsset(project, assetPath),
        this.snapshots,
        async (projectId, snapshotId) => this.storage.loadSnapshot(projectId, snapshotId)
      );
      const archive = await createZipArchive(files);
      this.downloadBlob(archive, `${this.getExportSlug()}-respaldo.zip`);
      status!.innerHTML = `<p class="status-ok">Respaldo editable descargado con ${files.length} archivos.</p>`;
      this.flashButton(target, "Respaldado");
    } catch (error) {
      status!.innerHTML = `<p class="issue issue--warning">No se pudo crear el respaldo: ${escapeHtml(getErrorMessage(error))}</p>`;
    }
  }

  private async openProjectFolder(root: HTMLElement, target: HTMLElement): Promise<void> {
    const status = root.querySelector<HTMLElement>("[data-import-status]");
    if (!isTauriRuntime() && !supportsDirectoryExport()) {
      status!.innerHTML = `<p class="issue issue--warning">Tu navegador no permite abrir carpetas. En Tauri esto se abrira con dialogo nativo.</p>`;
      return;
    }

    try {
      const loaded = isTauriRuntime() ? await this.loadNativeProjectFolder() : await this.loadBrowserProjectFolder();

      if (!(await this.saveSnapshot(root))) return;
      for (const asset of loaded.assetFiles) {
        await this.assets.saveProjectAsset(loaded.project.id, asset.path, asset.file);
        const scene = loaded.project.scenes.find((item) => item.panorama === asset.path);
        if (scene) {
          await this.assets.saveScenePanorama(loaded.project.id, scene.id, asset.file);
        }
      }

      this.project = loaded.project;
      this.activeSceneId = loaded.project.startScene ?? loaded.project.scenes[0]?.id ?? "";
      this.activeFloorplanId = loaded.project.floorplans[0]?.id ?? "";
      await this.saveProject(root);
      for (const snapshot of loaded.snapshots) {
        await this.storage.snapshot(snapshot.project);
      }
      this.recentProjects = await this.storage.list();
      this.snapshots = await this.storage.listSnapshots(this.project.id);
      this.syncTitleField(root);
      await this.renderWorkspace(root, true);
      status!.innerHTML = `<p class="status-ok">Proyecto abierto: ${escapeHtml(loaded.project.title)}.</p>`;
      this.flashButton(target, "Carpeta abierta");
    } catch {
      status!.innerHTML = `<p class="issue issue--warning">No se pudo abrir la carpeta de proyecto.</p>`;
    }
  }

  private async loadBrowserProjectFolder(): Promise<Awaited<ReturnType<typeof loadProjectFolder>>> {
    const directory = await pickDirectory();
    return loadProjectFolder(
      async (path) => readFileFromDirectory(directory, path),
      async (path) => listFilesInDirectory(directory, path)
    );
  }

  private async loadNativeProjectFolder(): Promise<Awaited<ReturnType<typeof loadProjectFolder>>> {
    const files = await loadProjectFolderNative(this.project.id);
    return loadProjectFolder(
      async (path) => {
        const file = files.find((item) => item.path === path);
        if (!file) {
          return null;
        }

        const content = new Uint8Array(file.content.byteLength);
        content.set(file.content);
        return new File([content.buffer], path.split("/").pop() ?? path, { type: inferMimeType(path) });
      },
      async (path) => files.filter((file) => file.path.startsWith(`${path}/`)).map((file) => file.path)
    );
  }

  private async deleteProject(root: HTMLElement, projectId: string): Promise<void> {
    const project = this.recentProjects.find((item) => item.id === projectId);
    const title = project?.title ?? "este proyecto";
    if (!window.confirm(`Eliminar "${title}" de 360Tours Studio? Esta accion quitara el proyecto local, historial y assets guardados.`)) {
      return;
    }

    await this.storage.remove(projectId);
    await this.assets.removeProjectAssets(projectId);
    this.recentProjects = await this.storage.list();

    if (this.project.id === projectId) {
      const nextProject = this.recentProjects[0] ? await this.storage.load(this.recentProjects[0].id) : createEmptyProject();
      this.project = nextProject;
      this.activeSceneId = nextProject.startScene ?? nextProject.scenes[0]?.id ?? "";
      this.activeFloorplanId = nextProject.floorplans[0]?.id ?? "";
      this.snapshots = nextProject.scenes.length > 0 ? await this.storage.listSnapshots(nextProject.id) : [];
      this.syncTitleField(root);
      await this.renderWorkspace(root, true);
      return;
    }

    this.renderRecentProjects(root);
  }

  private async renameActiveScene(root: HTMLElement, name: string): Promise<void> {
    this.project = {
      ...this.project,
      scenes: this.project.scenes.map((scene) => (scene.id === this.activeSceneId ? { ...scene, name } : scene))
    };
    await this.saveProject(root);
    await this.renderSceneList(root);
  }

  private async moveActiveScene(root: HTMLElement, direction: -1 | 1): Promise<void> {
    const currentIndex = this.project.scenes.findIndex((scene) => scene.id === this.activeSceneId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= this.project.scenes.length) {
      return;
    }

    const scenes = [...this.project.scenes];
    const [scene] = scenes.splice(currentIndex, 1);
    scenes.splice(nextIndex, 0, scene);
    this.project = { ...this.project, scenes };
    await this.persistAndRender(root, false);
  }

  private async deleteActiveScene(root: HTMLElement): Promise<void> {
    const scene = this.project.scenes.find((item) => item.id === this.activeSceneId);
    if (!scene || !window.confirm(`Eliminar "${scene.name}" del tour?`)) {
      return;
    }

    if (!(await this.saveSnapshot(root))) return;
    const scenes = this.project.scenes
      .filter((item) => item.id !== scene.id)
      .map((item) => ({
        ...item,
        hotspots: item.hotspots.filter((hotspot) => hotspot.type !== "scene" || hotspot.targetScene !== scene.id)
      }));
    const startScene = this.project.startScene === scene.id ? scenes[0]?.id ?? null : this.project.startScene;

    this.project = { ...this.project, scenes, startScene };
    this.activeSceneId = startScene ?? scenes[0]?.id ?? "";
    await this.persistAndRender(root, true);
  }

  private async importFloorplan(root: HTMLElement, file: File | null): Promise<void> {
    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    const id = `plano-${Date.now()}`;
    const path = `floorplans/${id}.${fileExtension(file)}`;
    await this.assets.saveProjectAsset(this.project.id, path, file);

    this.project = {
      ...this.project,
      floorplans: [
        ...this.project.floorplans,
        {
          id,
          name: file.name.replace(/\.[^.]+$/, "") || "Plano",
          image: path,
          markers: []
        }
      ]
    };
    this.activeFloorplanId = id;
    await this.persistAndRender(root, false);
  }

  private async importGallery(root: HTMLElement, files: File[]): Promise<void> {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      return;
    }

    const items: GalleryItem[] = [];
    for (const file of imageFiles) {
      const id = `galeria-${Date.now()}-${items.length + 1}`;
      const path = `gallery/${id}.${fileExtension(file)}`;
      await this.assets.saveProjectAsset(this.project.id, path, file);
      items.push({
        id,
        image: path,
        caption: file.name.replace(/\.[^.]+$/, "")
      });
    }

    this.project = {
      ...this.project,
      gallery: [...this.project.gallery, ...items]
    };
    await this.persistAndRender(root, false);
  }

  private async addFloorplanMarker(root: HTMLElement, x: number, y: number): Promise<void> {
    const floorplan = this.getActiveFloorplan();
    if (!floorplan || !this.activeSceneId) {
      return;
    }

    const activeScene = this.project.scenes.find((scene) => scene.id === this.activeSceneId);
    const markerExists = floorplan.markers.some((marker) => marker.sceneId === this.activeSceneId);
    const marker = {
      id: `marker-${Date.now()}`,
      sceneId: this.activeSceneId,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10
    };

    this.project = {
      ...this.project,
      floorplans: this.project.floorplans.map((item) =>
        item.id === floorplan.id
          ? {
              ...item,
              markers: markerExists
                ? item.markers.map((existing) => (existing.sceneId === this.activeSceneId ? marker : existing))
                : [...item.markers, marker]
            }
          : item
      )
    };
    await this.persistAndRender(root, false);
    this.renderFloorplanHint(root, activeScene ? `${activeScene.name} marcada en el plano.` : "");
  }

  private async deleteFloorplanMarker(root: HTMLElement, markerId: string): Promise<void> {
    if (!(await this.saveSnapshot(root))) return;
    this.project = {
      ...this.project,
      floorplans: this.project.floorplans.map((floorplan) => ({
        ...floorplan,
        markers: floorplan.markers.filter((marker) => marker.id !== markerId)
      }))
    };
    await this.persistAndRender(root, false);
  }

  private async renameFloorplan(root: HTMLElement, floorplanId: string, name: string): Promise<void> {
    this.project = {
      ...this.project,
      floorplans: this.project.floorplans.map((floorplan) =>
        floorplan.id === floorplanId ? { ...floorplan, name } : floorplan
      )
    };
    await this.saveProject(root);
    this.renderValidation(root);
    this.renderExportReadiness(root);
  }

  private async deleteFloorplan(root: HTMLElement, floorplanId: string): Promise<void> {
    const floorplan = this.project.floorplans.find((item) => item.id === floorplanId);
    if (!floorplan || !window.confirm(`Eliminar la planta "${floorplan.name}"?`)) {
      return;
    }

    if (!(await this.saveSnapshot(root))) return;
    this.project = {
      ...this.project,
      floorplans: this.project.floorplans.filter((item) => item.id !== floorplanId)
    };
    this.activeFloorplanId = this.project.floorplans[0]?.id ?? "";
    await this.persistAndRender(root, false);
  }

  private async updateGalleryCaption(root: HTMLElement, galleryId: string, caption: string): Promise<void> {
    this.project = {
      ...this.project,
      gallery: this.project.gallery.map((item) => (item.id === galleryId ? { ...item, caption } : item))
    };
    await this.saveProject(root);
    this.renderValidation(root);
  }

  private async deleteGalleryItem(root: HTMLElement, galleryId: string): Promise<void> {
    if (!(await this.saveSnapshot(root))) return;
    this.project = {
      ...this.project,
      gallery: this.project.gallery.filter((item) => item.id !== galleryId)
    };
    await this.persistAndRender(root, false);
  }

  private async moveGalleryItem(root: HTMLElement, galleryId: string, direction: -1 | 1): Promise<void> {
    const currentIndex = this.project.gallery.findIndex((item) => item.id === galleryId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= this.project.gallery.length) {
      return;
    }

    const gallery = [...this.project.gallery];
    const [item] = gallery.splice(currentIndex, 1);
    gallery.splice(nextIndex, 0, item);
    this.project = { ...this.project, gallery };
    await this.persistAndRender(root, false);
  }

  private async saveCurrentView(root: HTMLElement, target: HTMLElement): Promise<void> {
    const initialView = this.renderer?.getCurrentViewState();
    if (!initialView) {
      return;
    }

    this.project = {
      ...this.project,
      scenes: this.project.scenes.map((scene) =>
        scene.id === this.activeSceneId
          ? { ...scene, initialView, metadata: { ...scene.metadata, reviewedAt: new Date().toISOString() } }
          : scene
      )
    };
    await this.saveProject(root);
    this.flashButton(target, "Escena confirmada");
    await this.renderSceneList(root);
    this.renderNextSteps(root);
    this.renderValidation(root);
  }

  private async addNavigationHotspot(root: HTMLElement, coordinates: { yaw: number; pitch: number }): Promise<void> {
    const targetSelect = root.querySelector<HTMLSelectElement>("[data-field='hotspot-target']");
    const targetScene = targetSelect?.value;
    if (!targetScene) {
      return;
    }

    const targetName = this.project.scenes.find((scene) => scene.id === targetScene)?.name ?? "escena";
    await this.addHotspotToActiveScene(root, {
      id: `link-${Date.now()}`,
      type: "scene",
      yaw: coordinates.yaw,
      pitch: coordinates.pitch,
      targetScene,
      label: `Ir a ${targetName}`
    });
  }

  private async addInfoHotspot(root: HTMLElement, coordinates: { yaw: number; pitch: number }): Promise<void> {
    await this.addHotspotToActiveScene(root, {
      id: `info-${Date.now()}`,
      type: "info",
      yaw: coordinates.yaw,
      pitch: coordinates.pitch,
      title: "Detalle del espacio",
      text: "Agrega aqui notas comerciales o tecnicas de esta zona."
    });
  }

  private async addMediaHotspot(root: HTMLElement, coordinates: { yaw: number; pitch: number }, type: "image" | "video" | "link"): Promise<void> {
    const labels = {
      image: "Imagen",
      video: "Video",
      link: "Link"
    };

    await this.addHotspotToActiveScene(root, {
      id: `${type}-${Date.now()}`,
      type,
      yaw: coordinates.yaw,
      pitch: coordinates.pitch,
      title: labels[type],
      label: labels[type],
      url: "https://"
    });
  }

  private async addHotspotToActiveScene(root: HTMLElement, hotspot: Scene["hotspots"][number]): Promise<void> {
    this.pushUndoCheckpoint();
    this.selectedHotspotId = hotspot.id;
    this.project = {
      ...this.project,
      scenes: this.project.scenes.map((scene) =>
        scene.id === this.activeSceneId ? { ...scene, hotspots: [...scene.hotspots, hotspot] } : scene
      )
    };
    await this.persistAndRender(root, true);
  }

  private async updateHotspot(root: HTMLElement, hotspotId: string, field: string, value: string): Promise<void> {
    this.project = {
      ...this.project,
      scenes: this.project.scenes.map((scene) =>
        scene.id === this.activeSceneId
          ? {
              ...scene,
              hotspots: scene.hotspots.map((hotspot) => updateHotspotField(hotspot, hotspotId, field, value))
            }
          : scene
      )
    };
    await this.saveProject(root);

    if (field === "targetScene" || field === "url") {
      await this.renderWorkspace(root, true);
      return;
    }

    await this.renderSceneList(root);
    this.renderValidation(root);
  }

  private async moveHotspotToCurrentView(root: HTMLElement, hotspotId: string, target: HTMLElement): Promise<void> {
    const view = this.renderer?.getCurrentViewState();
    if (!view) {
      return;
    }

    this.pushUndoCheckpoint();
    this.selectedHotspotId = hotspotId;
    this.project = {
      ...this.project,
      scenes: this.project.scenes.map((scene) =>
        scene.id === this.activeSceneId
          ? {
              ...scene,
              hotspots: scene.hotspots.map((hotspot) =>
                hotspot.id === hotspotId ? { ...hotspot, yaw: view.yaw, pitch: view.pitch } : hotspot
              )
            }
          : scene
      )
    };
    await this.persistAndRender(root, true);
    this.flashButton(target, "Movido");
  }

  private async moveHotspotFromCanvas(
    root: HTMLElement,
    hotspotId: string,
    coordinates: { yaw: number; pitch: number }
  ): Promise<void> {
    this.pushUndoCheckpoint();
    this.selectedHotspotId = hotspotId;
    this.project = {
      ...this.project,
      scenes: this.project.scenes.map((scene) =>
        scene.id === this.activeSceneId
          ? {
              ...scene,
              hotspots: scene.hotspots.map((hotspot) =>
                hotspot.id === hotspotId ? { ...hotspot, yaw: coordinates.yaw, pitch: coordinates.pitch } : hotspot
              )
            }
          : scene
      )
    };
    await this.saveProject(root);
    this.renderSceneProperties(root);
    this.renderNextSteps(root);
    this.updateUndoControls(root);
  }

  private async deleteHotspot(root: HTMLElement, hotspotId: string): Promise<void> {
    if (!(await this.saveSnapshot(root))) return;
    this.pushUndoCheckpoint();
    if (this.selectedHotspotId === hotspotId) this.selectedHotspotId = "";
    this.project = {
      ...this.project,
      scenes: this.project.scenes.map((scene) =>
        scene.id === this.activeSceneId
          ? { ...scene, hotspots: scene.hotspots.filter((hotspot) => hotspot.id !== hotspotId) }
          : scene
      )
    };
    await this.persistAndRender(root, true);
  }

  private async openFinalPreview(root: HTMLElement, target: HTMLElement): Promise<void> {
    if (this.project.scenes.length === 0) {
      this.renderImportStatus(root, "Importa al menos un panorama antes de abrir la vista final.");
      return;
    }
    this.assetIssues = await this.validateAssets();
    const errors = this.assetIssues.filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
      this.renderValidation(root);
      this.renderExportReadiness(root);
      this.renderPersistenceStatus(root, "La vista final esta bloqueada por archivos faltantes.", true);
      return;
    }

    this.finalPreview?.close();
    const { FinalTourPreview } = await import("../preview/finalTourPreview");
    const host = root.querySelector<HTMLElement>("[data-final-preview-host]");
    if (!host) return;
    host.hidden = false;
    this.finalPreview = new FinalTourPreview(
      host,
      this.project,
      async (path) => this.resolveProjectAsset(this.project, path),
      () => {
        this.finalPreview = null;
        target.focus();
      }
    );
    try {
      await this.finalPreview.open();
      this.flashButton(target, "Vista abierta");
    } catch (error) {
      console.error("No se pudo preparar la vista final.", error);
      this.finalPreview = null;
      host.innerHTML = `<div class="final-preview-error" role="alert"><strong>No pudimos preparar la vista final.</strong><span>Revisa los archivos marcados en Validacion y vuelve a intentarlo.</span><button type="button" data-action="dismiss-preview-error">Volver al editor</button></div>`;
      host.querySelector("button")?.addEventListener("click", () => {
        host.hidden = true;
        host.innerHTML = "";
        target.focus();
      });
    }
  }

  private async downloadStaticTour(root: HTMLElement, target: HTMLElement): Promise<void> {
    const status = root.querySelector<HTMLElement>("[data-export-status]");
    const button = target as HTMLButtonElement;
    button.disabled = true;
    this.renderPersistenceStatus(root, "Preparando el ZIP del tour...");
    this.assetIssues = await this.validateAssets();
    const assetErrors = this.assetIssues.filter((issue) => issue.severity === "error");
    if (assetErrors.length > 0) {
      this.renderValidation(root);
      this.renderExportReadiness(root);
      status!.innerHTML = `<ul class="issue-list">${assetErrors.map((issue) => `<li class="issue issue--error">${escapeHtml(issue.message)}</li>`).join("")}</ul>`;
      this.renderPersistenceStatus(root, "No se pudo exportar: faltan archivos del tour.", true);
      button.disabled = false;
      return;
    }

    const result = await exportStaticTour(
      this.project,
      async (project, assetPath) => this.resolveProjectAsset(project, assetPath),
      (completed, total, label) => this.renderExportProgress(status!, label, completed, total, "Preparando escenas")
    );

    if (!result.ok) {
      status!.innerHTML = `<ul class="issue-list">${result.messages.map((message) => `<li class="issue issue--error">${escapeHtml(message)}</li>`).join("")}</ul>`;
      this.renderPersistenceStatus(root, "No se pudo exportar el tour.", true);
      button.disabled = false;
      return;
    }

    try {
      const archive = await createZipArchive(result.files, (completed, total, path) => {
        this.renderExportProgress(status!, path, completed, total, "Construyendo ZIP");
      });
      this.downloadBlob(archive, `${this.getExportSlug()}.zip`);
    } catch {
      status!.innerHTML = `<p class="issue issue--warning">No se pudo generar el ZIP del tour.</p>`;
      this.renderPersistenceStatus(root, "No se pudo generar el ZIP del tour.", true);
      button.disabled = false;
      return;
    }

    status!.innerHTML = `<p class="status-ok">${escapeHtml(result.messages[0])} ZIP descargado. Extraelo completo y ejecuta ABRIR_TOUR.cmd para revisarlo en Windows.</p>`;
    this.renderPersistenceStatus(root, "ZIP descargado.");
    button.disabled = false;
    this.flashButton(target, "Exportado");
  }

  private renderExportProgress(status: HTMLElement, label: string, completed: number, total: number, stage: string): void {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    status.innerHTML = `
      <div class="operation-progress" role="status" aria-live="polite">
        <div><span>${escapeHtml(stage)}: ${escapeHtml(label)}</span><strong>${percent}%</strong></div>
        <progress max="${Math.max(1, total)}" value="${completed}"></progress>
      </div>
    `;
  }

  private async resolveProjectAsset(project: TourProject, assetPath: string): Promise<Blob | null> {
    const asset = await this.assets.loadProjectAsset(project.id, assetPath);
    if (asset) {
      return asset.blob;
    }

    const scene = project.scenes.find((item) => item.panorama === assetPath || item.id === assetPath);
    if (!scene) {
      return null;
    }

    const panorama = await this.assets.loadScenePanorama(project.id, scene.id);
    return panorama?.blob ?? null;
  }

  private async runPublishPreflight(root: HTMLElement, target: HTMLElement): Promise<void> {
    const status = root.querySelector<HTMLElement>("[data-publish-status]");
    if (!status) {
      return;
    }

    this.assetIssues = await this.validateAssets();
    const assetErrors = this.assetIssues.filter((issue) => issue.severity === "error");
    if (assetErrors.length > 0) {
      this.renderValidation(root);
      this.renderExportReadiness(root);
      status.innerHTML = `
        <span>Destino</span>
        <strong data-publish-url>${escapeHtml(this.getPublishUrl())}</strong>
        <ul class="issue-list">${assetErrors.map((issue) => `<li class="issue issue--error">${escapeHtml(issue.message)}</li>`).join("")}</ul>
      `;
      return;
    }

    const result = await publishTour(this.project);

    const plan = result.plan;
    status.innerHTML = `
      <span>Destino</span>
      <strong data-publish-url>${escapeHtml(plan?.url.replace(/^https?:\/\//, "") ?? this.getPublishUrl())}</strong>
      <p class="${result.ok ? "status-ok" : "issue issue--warning"}">${escapeHtml(result.message)}</p>
      ${
        plan
          ? `<dl class="publish-plan">
              <div><dt>Temporal</dt><dd>${escapeHtml(plan.temporaryPath)}</dd></div>
              <div><dt>Final</dt><dd>${escapeHtml(plan.finalPath)}</dd></div>
              <div><dt>Rollback</dt><dd>${escapeHtml(plan.rollbackPath)}</dd></div>
            </dl>`
          : ""
      }
      ${
        plan?.steps
          ? `<ol class="publish-steps">
              ${plan.steps.map((step) => `<li><strong>${escapeHtml(step.label)}</strong><span>${escapeHtml(step.detail)}</span></li>`).join("")}
            </ol>`
          : ""
      }
    `;
    this.flashButton(target, result.ok ? "Publicado" : "Preflight listo");
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private flashButton(target: HTMLElement, text: string): void {
    const original = target.textContent ?? "";
    target.textContent = text;
    setTimeout(() => {
      target.textContent = original;
    }, 1400);
  }

  private syncTitleField(root: HTMLElement): void {
    root.querySelectorAll<HTMLInputElement>("[data-field='project-title']").forEach((field) => {
      field.value = this.project.title;
    });

    const slug = root.querySelector<HTMLInputElement>("[data-field='publish-slug']");
    if (slug) {
      slug.value = this.project.publish?.slug ?? this.project.id;
    }

    this.syncPublishUrl(root);
    this.renderWorkspaceContext(root);
  }

  private renderWorkspaceContext(root: HTMLElement): void {
    const project = root.querySelector<HTMLElement>("[data-workspace-project]");
    const scene = root.querySelector<HTMLElement>("[data-workspace-scene]");
    const activeScene = this.project.scenes.find((item) => item.id === this.activeSceneId);
    if (project) project.textContent = this.project.title || "Tour sin nombre";
    if (scene) scene.textContent = activeScene ? `Editando: ${activeScene.name}` : "Importa panoramas para comenzar";
  }

  private renderPlacementHint(root: HTMLElement, message: string): void {
    const hint = root.querySelector<HTMLElement>("[data-placement-hint]");
    if (hint) {
      hint.textContent = message;
    }
  }

  private renderFloorplanHint(root: HTMLElement, message: string): void {
    const hint = root.querySelector<HTMLElement>("[data-floorplan-hint]");
    if (hint) {
      hint.textContent = message;
    }
  }

  private getActiveFloorplan(): Floorplan | undefined {
    return this.project.floorplans.find((floorplan) => floorplan.id === this.activeFloorplanId) ?? this.project.floorplans[0];
  }

  private ensureActiveFloorplan(): void {
    if (!this.project.floorplans.some((floorplan) => floorplan.id === this.activeFloorplanId)) {
      this.activeFloorplanId = this.project.floorplans[0]?.id ?? "";
    }
  }

  private syncPublishUrl(root: HTMLElement): void {
    const target = root.querySelector<HTMLElement>("[data-publish-url]");
    if (target) {
      target.textContent = this.getPublishUrl();
    }
  }

  private getExportSlug(): string {
    return this.project.publish?.slug || this.project.id || "nuevo-tour";
  }

  private getPublishUrl(): string {
    return `tacoviajero.com/tours/${this.getExportSlug()}/`;
  }

  private getProjectIssues(): ValidationIssue[] {
    return [...validateProject(this.project), ...this.assetIssues];
  }

  private async validateAssets(): Promise<ValidationIssue[]> {
    return validateProjectAssets(this.project, async (project, assetPath) => this.resolveProjectAsset(project, assetPath));
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderIcon(icon: IconNode): string {
  return createElement(icon, {
    width: 16,
    height: 16,
    "stroke-width": 1.8,
    "aria-hidden": "true"
  }).outerHTML;
}

function getHotspotTypeLabel(hotspot: Hotspot): string {
  if (hotspot.type === "scene") return "Conexion";
  if (hotspot.type === "info") return "Informacion";
  if (hotspot.type === "image") return "Imagen";
  if (hotspot.type === "video") return "Video";
  return "Enlace";
}

function toSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "nuevo-tour"
  );
}

function cloneProject(project: TourProject): TourProject {
  return JSON.parse(JSON.stringify(project)) as TourProject;
}

function getSceneRouteStatus(scenes: Scene[], scene: Scene, index: number): string {
  const previous = scenes[index - 1];
  const next = scenes[index + 1];
  const sceneLinks = scene.hotspots.filter((hotspot) => hotspot.type === "scene");
  const hasPrevious = !previous || sceneLinks.some((hotspot) => hotspot.targetScene === previous.id);
  const hasNext = !next || sceneLinks.some((hotspot) => hotspot.targetScene === next.id);
  return hasPrevious && hasNext ? "conectada" : "revisar conexion";
}

function isLinearRouteComplete(scenes: Scene[]): boolean {
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  return (
    scenes.length > 0 &&
    scenes.every((scene, index) => {
      const links = scene.hotspots.filter((hotspot) => hotspot.type === "scene");
      const targets = links.map((hotspot) => hotspot.targetScene);
      return (
        getSceneRouteStatus(scenes, scene, index) === "conectada" &&
        targets.every((target) => sceneIds.has(target)) &&
        new Set(targets).size === targets.length
      );
    })
  );
}

function getSceneOptimizationLabel(scene: Scene): string {
  const sourceBytes = typeof scene.metadata?.sourceBytes === "number" ? scene.metadata.sourceBytes : null;
  const optimizedBytes = typeof scene.metadata?.optimizedBytes === "number" ? scene.metadata.optimizedBytes : null;
  const optimizedSize = typeof scene.metadata?.optimizedSize === "string" ? scene.metadata.optimizedSize : null;

  if (!sourceBytes || !optimizedBytes) {
    return optimizedSize ?? "sin datos de peso";
  }

  const reduction = Math.max(0, Math.round((1 - optimizedBytes / sourceBytes) * 100));
  return `${optimizedSize ?? "optimizada"} · ${formatBytes(optimizedBytes)} · -${reduction}%`;
}

function createLinearHotspot(direction: "prev" | "next", targetScene: Scene): Scene["hotspots"][number] {
  return {
    id: `auto-${direction}-${targetScene.id}`,
    type: "scene",
    yaw: direction === "prev" ? -1.57 : 1.57,
    pitch: 0,
    targetScene: targetScene.id,
    label: direction === "prev" ? `Volver a ${targetScene.name}` : `Ir a ${targetScene.name}`
  };
}

function updateHotspotField(hotspot: Hotspot, hotspotId: string, field: string, value: string): Hotspot {
  if (hotspot.id !== hotspotId) {
    return hotspot;
  }

  if (field === "label") {
    return { ...hotspot, label: value || undefined };
  }

  if (hotspot.type === "scene" && field === "targetScene") {
    return { ...hotspot, targetScene: value, label: hotspot.label || `Ir a ${value}` };
  }

  if (hotspot.type === "info" && field === "title") {
    return { ...hotspot, title: value };
  }

  if (hotspot.type === "info" && field === "text") {
    return { ...hotspot, text: value };
  }

  if ((hotspot.type === "image" || hotspot.type === "video" || hotspot.type === "link") && field === "url") {
    return { ...hotspot, url: value };
  }

  if ((hotspot.type === "image" || hotspot.type === "video" || hotspot.type === "link") && field === "title") {
    return { ...hotspot, title: value || undefined };
  }

  return hotspot;
}

function createEmptyProject(): TourProject {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: createProjectId("tour"),
    title: "Nuevo tour 360",
    startScene: null,
    settings: {},
    publish: { slug: "nuevo-tour" },
    floorplans: [],
    gallery: [],
    scenes: []
  };
}

function createProjectId(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 17);
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${timestamp}-${random}`;
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "guardado";
  }

  return date.toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function fileExtension(file: File): string {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension && /^[a-z0-9]+$/.test(extension)) {
    return extension;
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function inferMimeType(path: string): string {
  const extension = path.toLowerCase().split(".").pop();
  if (extension === "json") {
    return "application/json";
  }

  if (extension === "png") {
    return "image/png";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  if (extension === "txt") {
    return "text/plain";
  }

  return "image/jpeg";
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<DirectoryHandle>;
}

interface DirectoryHandle {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
  values?(): AsyncIterable<DirectoryHandle | FileHandle>;
  kind?: "directory";
  name?: string;
}

interface FileHandle {
  kind?: "file";
  name?: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableFileStream>;
}

interface WritableFileStream {
  write(content: string | Blob): Promise<void>;
  close(): Promise<void>;
}

function supportsDirectoryExport(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

function normalizeSearchTerm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function pickDirectory(): Promise<DirectoryHandle> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error("Selector de carpeta no disponible.");
  }

  return picker();
}

async function readFileFromDirectory(root: DirectoryHandle, path: string): Promise<File | null> {
  const parts = path.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) {
    return null;
  }

  const directory = await resolveDirectory(root, parts);
  if (!directory) {
    return null;
  }

  try {
    const handle = await directory.getFileHandle(fileName);
    return handle.getFile();
  } catch {
    return null;
  }
}

async function listFilesInDirectory(root: DirectoryHandle, path: string): Promise<string[]> {
  const parts = path.split("/").filter(Boolean);
  const directory = await resolveDirectory(root, parts);
  if (!directory?.values) {
    return [];
  }

  const files: string[] = [];
  for await (const handle of directory.values()) {
    if (handle.kind === "file" && handle.name) {
      files.push([...parts, handle.name].join("/"));
    }
  }
  return files;
}

async function resolveDirectory(root: DirectoryHandle, parts: string[]): Promise<DirectoryHandle | null> {
  let directory = root;
  for (const part of parts) {
    try {
      directory = await directory.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }
  return directory;
}

async function writeFilesToDirectory(rootName: string, files: Array<{ path: string; content: string | Blob }>): Promise<void> {
  const selectedDirectory = await pickDirectory();
  const tourDirectory = await selectedDirectory.getDirectoryHandle(rootName, { create: true });

  for (const file of files) {
    const parts = file.path.split("/");
    const fileName = parts.pop();
    if (!fileName) {
      continue;
    }

    let directory = tourDirectory;
    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part, { create: true });
    }

    const handle = await directory.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file.content);
    await writable.close();
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrio un error local inesperado.";
}
