import { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";
import { EquirectangularTilesAdapter } from "@photo-sphere-viewer/equirectangular-tiles-adapter";
import type { Hotspot, Scene, TourProject } from "../domain/tour";
import { getPanoramaAssets, getPanoramaTilePath } from "../domain/panoramaAssets";

export type PreviewAssetResolver = (path: string) => Promise<Blob | null>;

const MIN_FOV = 0.55;
const MAX_FOV = 1.55;
const RADIANS_TO_DEGREES = 180 / Math.PI;

export class FinalTourPreview {
  private viewer: Viewer | null = null;
  private currentSceneId = "";
  private readonly objectUrls = new Map<string, string>();
  private readonly hotspotLayer: HTMLDivElement;
  private readonly sceneList: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly dialog: HTMLElement;
  private readonly previouslyFocused: HTMLElement | null;
  private readonly useTiledPanoramas: boolean;
  private keyHandler: (event: KeyboardEvent) => void;

  constructor(
    private readonly host: HTMLElement,
    private readonly project: TourProject,
    private readonly resolveAsset: PreviewAssetResolver,
    private readonly onClose: () => void
  ) {
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.currentSceneId = project.startScene ?? project.scenes[0]?.id ?? "";
    this.useTiledPanoramas = project.scenes.length > 0 && project.scenes.every(hasUsableTiles);
    this.host.innerHTML = `
      <section class="final-preview" role="dialog" aria-modal="true" aria-label="Vista final del tour">
        <header>
          <div><span>Vista final WebGL</span><strong>${escapeHtml(project.title)}</strong></div>
          <div>
            <button type="button" data-preview-action="fullscreen">Pantalla completa</button>
            <button type="button" data-preview-action="close">Cerrar</button>
          </div>
        </header>
        <div class="final-preview-body">
          <nav aria-label="Escenas del tour"><div data-preview-scenes></div></nav>
          <div class="final-preview-viewer" data-final-viewer>
            <div class="final-preview-status" data-preview-status>Cargando vista final...</div>
          </div>
        </div>
      </section>
    `;
    this.sceneList = this.requiredElement("[data-preview-scenes]");
    this.status = this.requiredElement("[data-preview-status]");
    this.dialog = this.requiredElement(".final-preview");
    const viewerElement = this.requiredElement("[data-final-viewer]");
    this.hotspotLayer = document.createElement("div");
    this.hotspotLayer.className = "final-preview-hotspots";
    viewerElement.append(this.hotspotLayer);

    this.host.querySelector("[data-preview-action='close']")?.addEventListener("click", () => this.close());
    this.host.querySelector("[data-preview-action='fullscreen']")?.addEventListener("click", () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void this.host.querySelector<HTMLElement>(".final-preview")?.requestFullscreen();
    });
    this.sceneList.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-preview-scene]");
      if (button?.dataset.previewScene) void this.goToScene(button.dataset.previewScene);
    });
    this.keyHandler = (event) => {
      if (event.key === "Escape") this.close();
      if (event.key === "ArrowLeft") void this.navigate(-1);
      if (event.key === "ArrowRight") void this.navigate(1);
      if (event.key === "Tab") this.trapFocus(event);
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  async open(): Promise<void> {
    this.renderSceneMenu();
    this.host.querySelector<HTMLButtonElement>("[data-preview-action='close']")?.focus();
    const scene = this.getScene(this.currentSceneId);
    if (!scene) throw new Error("El tour no contiene una escena para previsualizar.");
    const panorama = await this.preparePanorama(scene);
    const viewerElement = this.requiredElement("[data-final-viewer]");
    const viewerOptions = {
      container: viewerElement,
      panorama,
      navbar: ["zoom", "move", "fullscreen"],
      mousewheelCtrlKey: false,
      touchmoveTwoFingers: false,
      rendererParameters: { antialias: true, preserveDrawingBuffer: true },
      minFov: MIN_FOV * RADIANS_TO_DEGREES,
      maxFov: MAX_FOV * RADIANS_TO_DEGREES,
      defaultYaw: scene.initialView.yaw,
      defaultPitch: scene.initialView.pitch,
      defaultZoomLvl: fovToZoom(scene.initialView.fov)
    };
    this.viewer = this.useTiledPanoramas
      ? new Viewer({ ...viewerOptions, adapter: EquirectangularTilesAdapter })
      : new Viewer(viewerOptions);
    this.viewer.addEventListener("ready", () => {
      this.status.hidden = true;
      this.renderHotspots(scene.hotspots);
    }, { once: true });
    this.viewer.addEventListener("load-progress", (event) => {
      this.status.hidden = false;
      this.status.textContent = `Cargando vista final... ${Math.round(event.progress)}%`;
    });
    this.viewer.addEventListener("panorama-error", (event) => {
      console.error("No se pudo cargar el panorama de la vista final.", event.error);
      this.showSceneError(this.currentSceneId);
    });
    this.viewer.addEventListener("render", () => this.positionHotspots());
  }

  private async goToScene(sceneId: string): Promise<void> {
    const scene = this.getScene(sceneId);
    if (!scene || !this.viewer) return;
    this.status.hidden = false;
    this.status.innerHTML = `Cargando ${escapeHtml(scene.name)}...`;
    try {
      const panorama = await this.preparePanorama(scene);
      await this.viewer.setPanorama(panorama, {
        position: { yaw: scene.initialView.yaw, pitch: scene.initialView.pitch },
        zoom: fovToZoom(scene.initialView.fov),
        transition: false
      });
      this.currentSceneId = scene.id;
      this.renderSceneMenu();
      this.renderHotspots(scene.hotspots);
      this.status.hidden = true;
    } catch (error) {
      console.error("No se pudo cambiar la escena de la vista final.", error);
      this.showSceneError(sceneId);
    }
  }

  private async navigate(direction: -1 | 1): Promise<void> {
    const index = this.project.scenes.findIndex((scene) => scene.id === this.currentSceneId);
    const next = this.project.scenes[index + direction];
    if (next) await this.goToScene(next.id);
  }

  private async preparePanorama(scene: Scene): Promise<unknown> {
    const assets = getPanoramaAssets(scene);
    if (!this.useTiledPanoramas || !assets.tiles) {
      return this.resolveObjectUrl(assets.original?.path ?? assets.preview?.path ?? scene.panorama);
    }
    const baseUrl = await this.resolveObjectUrl(assets.preview?.path ?? scene.panorama);
    const tileUrls = new Map<string, string>();
    for (let row = 0; row < assets.tiles.rows; row += 1) {
      for (let col = 0; col < assets.tiles.cols; col += 1) {
        const path = getPanoramaTilePath(assets.tiles, col, row);
        tileUrls.set(`${col}:${row}`, await this.resolveObjectUrl(path));
      }
    }
    return {
      width: assets.tiles.width,
      cols: assets.tiles.cols,
      rows: assets.tiles.rows,
      baseUrl,
      tileUrl: (col: number, row: number) => tileUrls.get(`${col}:${row}`) ?? null
    };
  }

  private showSceneError(sceneId: string): void {
    const scene = this.getScene(sceneId);
    this.status.hidden = false;
    this.status.innerHTML = `
      <strong>No pudimos mostrar ${escapeHtml(scene?.name ?? "esta escena")}.</strong>
      <span>Revisa sus archivos en el editor o intenta cargarla de nuevo.</span>
      <div class="final-preview-error-actions">
        <button type="button" data-preview-retry>Reintentar</button>
        <button type="button" data-preview-back>Volver al editor</button>
      </div>
    `;
    this.status.querySelector("[data-preview-retry]")?.addEventListener("click", () => void this.goToScene(sceneId));
    this.status.querySelector("[data-preview-back]")?.addEventListener("click", () => this.close());
  }

  private async resolveObjectUrl(path: string): Promise<string> {
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    const cached = this.objectUrls.get(path);
    if (cached) return cached;
    const asset = await this.resolveAsset(path);
    if (!asset) throw new Error(`Falta el recurso ${path}.`);
    const url = URL.createObjectURL(asset);
    this.objectUrls.set(path, url);
    return url;
  }

  private renderSceneMenu(): void {
    this.sceneList.innerHTML = this.project.scenes
      .map((scene, index) => `<button type="button" data-preview-scene="${escapeHtml(scene.id)}" class="${scene.id === this.currentSceneId ? "is-active" : ""}"><span>${index + 1}</span>${escapeHtml(scene.name)}</button>`)
      .join("");
    this.sceneList.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
  }

  private renderHotspots(hotspots: Hotspot[]): void {
    this.hotspotLayer.innerHTML = "";
    for (const hotspot of hotspots) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `hotspot hotspot--${hotspot.type}`;
      button.dataset.yaw = String(hotspot.yaw);
      button.dataset.pitch = String(hotspot.pitch);
      button.textContent = hotspot.label ?? (hotspot.type === "scene" ? "Ir" : hotspot.type === "info" ? "Info" : "Abrir");
      button.addEventListener("click", () => {
        if (hotspot.type === "scene") void this.goToScene(hotspot.targetScene);
        else if (hotspot.type === "info") window.alert(`${hotspot.title}\n\n${hotspot.text}`);
        else window.open(hotspot.url, "_blank", "noopener");
      });
      this.hotspotLayer.append(button);
    }
    this.positionHotspots();
  }

  private positionHotspots(): void {
    if (!this.viewer) return;
    const bounds = this.hotspotLayer.getBoundingClientRect();
    for (const element of this.hotspotLayer.querySelectorAll<HTMLElement>(".hotspot")) {
      const point = this.viewer.dataHelper.sphericalCoordsToViewerCoords({
        yaw: Number(element.dataset.yaw),
        pitch: Number(element.dataset.pitch)
      });
      const visible = point.x >= -120 && point.x <= bounds.width + 120 && point.y >= -80 && point.y <= bounds.height + 80;
      element.hidden = !visible;
      element.style.left = `${point.x}px`;
      element.style.top = `${point.y}px`;
    }
  }

  close(): void {
    window.removeEventListener("keydown", this.keyHandler);
    this.viewer?.destroy();
    this.viewer = null;
    for (const url of this.objectUrls.values()) URL.revokeObjectURL(url);
    this.objectUrls.clear();
    this.host.innerHTML = "";
    this.host.hidden = true;
    this.previouslyFocused?.focus();
    this.onClose();
  }

  private trapFocus(event: KeyboardEvent): void {
    const focusable = [...this.dialog.querySelectorAll<HTMLElement>("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")]
      .filter((element) => !element.hidden && element.getClientRects().length > 0);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private getScene(sceneId: string): Scene | undefined {
    return this.project.scenes.find((scene) => scene.id === sceneId);
  }

  private requiredElement<T extends HTMLElement>(selector: string): T {
    const element = this.host.querySelector<T>(selector);
    if (!element) throw new Error(`No se encontro ${selector}.`);
    return element;
  }
}

function fovToZoom(fov: number): number {
  return Math.max(0, Math.min(100, 100 - ((fov - MIN_FOV) / (MAX_FOV - MIN_FOV)) * 100));
}

function hasUsableTiles(scene: Scene): boolean {
  const tiles = getPanoramaAssets(scene).tiles;
  return Boolean(
    tiles &&
    tiles.width > 0 &&
    tiles.height > 0 &&
    tiles.cols > 0 &&
    tiles.rows > 0 &&
    Number.isInteger(tiles.cols) &&
    Number.isInteger(tiles.rows) &&
    (tiles.cols & (tiles.cols - 1)) === 0 &&
    (tiles.rows & (tiles.rows - 1)) === 0 &&
    tiles.pathTemplate.includes("{col}") &&
    tiles.pathTemplate.includes("{row}")
  );
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
