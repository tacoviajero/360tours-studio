import type { Hotspot, Scene, TourProject, ViewState } from "../domain/tour";
import type { TourRenderer } from "./tourRenderer";

interface RenderedScene {
  data: Scene;
  image: HTMLImageElement;
}

const MIN_FOV = 0.55;
const MAX_FOV = 1.55;
const MAX_RENDER_WIDTH = 1100;

export class MarzipanoTourRenderer implements TourRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private hotspotLayer: HTMLDivElement | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private scenes = new Map<string, RenderedScene>();
  private currentSceneId = "";
  private view: ViewState = { yaw: 0, pitch: 0, fov: 1.2 };
  private isDragging = false;
  private lastPointer: { x: number; y: number } | null = null;
  private renderHandle = 0;
  private onSceneChange: (sceneId: string) => void;

  constructor(onSceneChange: (sceneId: string) => void = () => undefined) {
    this.onSceneChange = onSceneChange;
  }

  mount(container: HTMLElement, project: TourProject): void {
    this.destroy();
    this.container = container;
    container.innerHTML = "";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "tour-canvas";
    this.context = this.canvas.getContext("2d", { alpha: false });
    this.hotspotLayer = document.createElement("div");
    this.hotspotLayer.className = "tour-hotspot-layer";
    container.append(this.canvas, this.hotspotLayer);

    this.bindCanvasEvents();
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(container);
    this.resizeCanvas();

    void this.loadScenes(project).then(() => {
      this.goToScene(project.startScene ?? project.scenes[0]?.id ?? "");
    });
  }

  goToScene(sceneId: string): void {
    const renderedScene = this.scenes.get(sceneId);
    if (!renderedScene) {
      return;
    }

    this.currentSceneId = sceneId;
    this.view = clampView(renderedScene.data.initialView);
    this.renderHotspots(renderedScene.data.hotspots);
    this.requestRender();
    this.onSceneChange(sceneId);
  }

  getCurrentViewState(): ViewState | null {
    if (!this.currentSceneId) {
      return null;
    }

    return {
      yaw: roundViewNumber(this.view.yaw),
      pitch: roundViewNumber(this.view.pitch),
      fov: roundViewNumber(this.view.fov)
    };
  }

  screenToCoordinates(x: number, y: number): Pick<ViewState, "yaw" | "pitch"> | null {
    if (!this.canvas) {
      return null;
    }

    const bounds = this.canvas.getBoundingClientRect();
    const coordinates = this.projectScreenToSphere(x - bounds.left, y - bounds.top, bounds.width, bounds.height);
    return {
      yaw: roundViewNumber(coordinates.yaw),
      pitch: roundViewNumber(coordinates.pitch)
    };
  }

  destroy(): void {
    if (this.renderHandle) {
      cancelAnimationFrame(this.renderHandle);
      this.renderHandle = 0;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.scenes.clear();
    this.currentSceneId = "";
    this.container = null;
    this.context = null;
    this.hotspotLayer = null;
    this.canvas?.remove();
    this.canvas = null;
  }

  private async loadScenes(project: TourProject): Promise<void> {
    const loadedScenes = await Promise.all(
      project.scenes.map(async (scene) => {
        const image = await loadImage(scene.panorama);
        return { scene, image };
      })
    );

    for (const item of loadedScenes) {
      this.scenes.set(item.scene.id, { data: item.scene, image: item.image });
    }
  }

  private bindCanvasEvents(): void {
    if (!this.canvas) {
      return;
    }

    this.canvas.addEventListener("pointerdown", (event) => {
      this.isDragging = true;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.canvas?.setPointerCapture(event.pointerId);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.isDragging || !this.lastPointer || !this.canvas) {
        return;
      }

      const bounds = this.canvas.getBoundingClientRect();
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.view = clampView({
        ...this.view,
        yaw: this.view.yaw - dx * (this.view.fov / Math.max(1, bounds.height)),
        pitch: this.view.pitch + dy * (this.view.fov / Math.max(1, bounds.height))
      });
      this.requestRender();
    });

    this.canvas.addEventListener("pointerup", (event) => {
      this.isDragging = false;
      this.lastPointer = null;
      this.canvas?.releasePointerCapture(event.pointerId);
    });

    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const nextFov = this.view.fov + Math.sign(event.deltaY) * 0.08;
      this.view = clampView({ ...this.view, fov: nextFov });
      this.requestRender();
    });
  }

  private resizeCanvas(): void {
    if (!this.container || !this.canvas) {
      return;
    }

    const bounds = this.container.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, MAX_RENDER_WIDTH / Math.max(1, bounds.width));
    this.canvas.width = Math.max(1, Math.round(bounds.width * scale));
    this.canvas.height = Math.max(1, Math.round(bounds.height * scale));
    this.requestRender();
  }

  private requestRender(): void {
    if (this.renderHandle) {
      return;
    }

    this.renderHandle = requestAnimationFrame(() => {
      this.renderHandle = 0;
      this.render();
    });
  }

  private render(): void {
    const scene = this.currentSceneId ? this.scenes.get(this.currentSceneId) : null;
    if (!scene || !this.canvas || !this.context) {
      return;
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    const buffer = this.context.createImageData(width, height);
    const data = buffer.data;
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = scene.image.naturalWidth;
    sourceCanvas.height = scene.image.naturalHeight;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) {
      return;
    }

    sourceContext.drawImage(scene.image, 0, 0);
    const source = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
    const aspect = width / Math.max(1, height);
    const verticalFov = this.view.fov;
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
    const tanHalfH = Math.tan(horizontalFov / 2);
    const tanHalfV = Math.tan(verticalFov / 2);

    for (let y = 0; y < height; y += 1) {
      const normalizedY = 1 - (2 * (y + 0.5)) / height;
      for (let x = 0; x < width; x += 1) {
        const normalizedX = (2 * (x + 0.5)) / width - 1;
        const direction = rotateDirection(normalizedX * tanHalfH, normalizedY * tanHalfV, -1, this.view.yaw, this.view.pitch);
        const yaw = Math.atan2(direction.x, -direction.z);
        const pitch = Math.asin(clamp(direction.y, -1, 1));
        const sourceX = positiveModulo(yaw / (2 * Math.PI) + 0.5, 1) * sourceCanvas.width;
        const sourceY = clamp(0.5 - pitch / Math.PI, 0, 0.999999) * sourceCanvas.height;
        const sx = Math.floor(sourceX) % sourceCanvas.width;
        const sy = Math.floor(sourceY);
        const sourceIndex = (sy * sourceCanvas.width + sx) * 4;
        const targetIndex = (y * width + x) * 4;
        data[targetIndex] = source[sourceIndex];
        data[targetIndex + 1] = source[sourceIndex + 1];
        data[targetIndex + 2] = source[sourceIndex + 2];
        data[targetIndex + 3] = 255;
      }
    }

    this.context.putImageData(buffer, 0, 0);
    this.positionHotspots();
  }

  private renderHotspots(hotspots: Hotspot[]): void {
    if (!this.hotspotLayer) {
      return;
    }

    this.hotspotLayer.innerHTML = "";
    for (const hotspot of hotspots) {
      const element = document.createElement("button");
      element.className = `hotspot hotspot--${hotspot.type}`;
      element.type = "button";
      element.dataset.yaw = String(hotspot.yaw);
      element.dataset.pitch = String(hotspot.pitch);
      element.title = hotspot.label ?? hotspot.type;

      if (hotspot.type === "scene") {
        element.textContent = hotspot.label ?? "Ir";
        element.addEventListener("click", () => this.goToScene(hotspot.targetScene));
      } else if (hotspot.type === "info") {
        element.textContent = "Info";
        element.addEventListener("click", () => window.alert(`${hotspot.title}\n\n${hotspot.text}`));
      } else {
        element.textContent = hotspot.title ?? "Abrir";
        element.addEventListener("click", () => window.open(hotspot.url, "_blank", "noopener"));
      }

      this.hotspotLayer.append(element);
    }

    this.positionHotspots();
  }

  private positionHotspots(): void {
    if (!this.hotspotLayer || !this.canvas) {
      return;
    }

    const bounds = this.canvas.getBoundingClientRect();
    for (const element of this.hotspotLayer.querySelectorAll<HTMLElement>(".hotspot")) {
      const yaw = Number(element.dataset.yaw);
      const pitch = Number(element.dataset.pitch);
      const position = this.projectSphereToScreen(yaw, pitch, bounds.width, bounds.height);
      if (!position) {
        element.style.display = "none";
        continue;
      }

      element.style.display = "";
      element.style.left = `${position.x}px`;
      element.style.top = `${position.y}px`;
    }
  }

  private projectScreenToSphere(x: number, y: number, width: number, height: number): { yaw: number; pitch: number } {
    const aspect = width / Math.max(1, height);
    const horizontalFov = 2 * Math.atan(Math.tan(this.view.fov / 2) * aspect);
    const normalizedX = (2 * x) / width - 1;
    const normalizedY = 1 - (2 * y) / height;
    const direction = rotateDirection(
      normalizedX * Math.tan(horizontalFov / 2),
      normalizedY * Math.tan(this.view.fov / 2),
      -1,
      this.view.yaw,
      this.view.pitch
    );

    return {
      yaw: Math.atan2(direction.x, -direction.z),
      pitch: Math.asin(clamp(direction.y, -1, 1))
    };
  }

  private projectSphereToScreen(yaw: number, pitch: number, width: number, height: number): { x: number; y: number } | null {
    const direction = sphereToDirection(yaw, pitch);
    const cameraDirection = rotateDirection(direction.x, direction.y, direction.z, -this.view.yaw, -this.view.pitch);
    if (cameraDirection.z >= -0.05) {
      return null;
    }

    const aspect = width / Math.max(1, height);
    const horizontalFov = 2 * Math.atan(Math.tan(this.view.fov / 2) * aspect);
    const x = (cameraDirection.x / -cameraDirection.z / Math.tan(horizontalFov / 2) + 1) * 0.5 * width;
    const y = (1 - cameraDirection.y / -cameraDirection.z / Math.tan(this.view.fov / 2)) * 0.5 * height;

    if (x < -120 || x > width + 120 || y < -80 || y > height + 80) {
      return null;
    }

    return { x, y };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/.test(src)) {
      image.crossOrigin = "anonymous";
    }
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error(`No se pudo cargar ${src}.`)));
    image.src = src;
  });
}

function rotateDirection(x: number, y: number, z: number, yaw: number, pitch: number): { x: number; y: number; z: number } {
  const length = Math.hypot(x, y, z) || 1;
  x /= length;
  y /= length;
  z /= length;

  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const py = y * cosPitch - z * sinPitch;
  const pz = y * sinPitch + z * cosPitch;

  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  return {
    x: x * cosYaw - pz * sinYaw,
    y: py,
    z: x * sinYaw + pz * cosYaw
  };
}

function sphereToDirection(yaw: number, pitch: number): { x: number; y: number; z: number } {
  return {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch)
  };
}

function clampView(view: ViewState): ViewState {
  return {
    yaw: view.yaw,
    pitch: clamp(view.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01),
    fov: clamp(view.fov, MIN_FOV, MAX_FOV)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function roundViewNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}
