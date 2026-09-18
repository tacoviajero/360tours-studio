import Marzipano from "marzipano";
import type { Hotspot, Scene, TourProject, ViewState } from "../domain/tour";
import type { TourRenderer } from "./tourRenderer";

interface RenderedScene {
  data: Scene;
  scene: any;
  view: any;
}

export class MarzipanoTourRenderer implements TourRenderer {
  private viewer: any | null = null;
  private scenes = new Map<string, RenderedScene>();
  private project: TourProject | null = null;
  private container: HTMLElement | null = null;
  private currentSceneId: string | null = null;
  private onSceneChange: (sceneId: string) => void;

  constructor(onSceneChange: (sceneId: string) => void = () => undefined) {
    this.onSceneChange = onSceneChange;
  }

  mount(container: HTMLElement, project: TourProject): void {
    this.destroy();
    this.project = project;
    this.container = container;
    this.viewer = new Marzipano.Viewer(container);

    for (const scene of project.scenes) {
      const source = Marzipano.ImageUrlSource.fromString(scene.panorama);
      const geometry = new Marzipano.EquirectGeometry([{ width: 2048 }]);
      const limiter = Marzipano.RectilinearView.limit.traditional(2048, Math.PI / 2);
      const view = new Marzipano.RectilinearView(scene.initialView, limiter);
      const renderedScene = this.viewer.createScene({ source, geometry, view, pinFirstLevel: true });

      this.scenes.set(scene.id, { data: scene, scene: renderedScene, view });
      this.createHotspots(renderedScene, scene.hotspots);
    }

    this.goToScene(project.startScene ?? project.scenes[0]?.id ?? "");
  }

  goToScene(sceneId: string): void {
    const renderedScene = this.scenes.get(sceneId);
    if (!renderedScene) {
      return;
    }

    renderedScene.scene.switchTo({ transitionDuration: 350 });
    this.currentSceneId = sceneId;
    this.onSceneChange(sceneId);
  }

  getCurrentViewState(): ViewState | null {
    const currentScene = this.currentSceneId ? this.scenes.get(this.currentSceneId) : null;
    if (!currentScene) {
      return null;
    }

    const parameters = currentScene.view.parameters();
    return {
      yaw: roundViewNumber(parameters.yaw),
      pitch: roundViewNumber(parameters.pitch),
      fov: roundViewNumber(parameters.fov)
    };
  }

  screenToCoordinates(x: number, y: number): Pick<ViewState, "yaw" | "pitch"> | null {
    const currentScene = this.currentSceneId ? this.scenes.get(this.currentSceneId) : null;
    if (!currentScene || !this.container) {
      return null;
    }

    const bounds = this.container.getBoundingClientRect();
    const coordinates = currentScene.view.screenToCoordinates({
      x: x - bounds.left,
      y: y - bounds.top
    });

    return {
      yaw: roundViewNumber(coordinates.yaw),
      pitch: roundViewNumber(coordinates.pitch)
    };
  }

  destroy(): void {
    this.scenes.clear();
    this.project = null;
    this.container = null;
    this.currentSceneId = null;
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
  }

  private createHotspots(renderedScene: any, hotspots: Hotspot[]): void {
    for (const hotspot of hotspots) {
      const element = document.createElement("button");
      element.className = `hotspot hotspot--${hotspot.type}`;
      element.type = "button";
      element.title = hotspot.label ?? hotspot.type;

      if (hotspot.type === "scene") {
        element.textContent = hotspot.label ?? "Ir";
        element.addEventListener("click", () => this.goToScene(hotspot.targetScene));
      }

      if (hotspot.type === "info") {
        element.textContent = "Info";
        element.addEventListener("click", () => {
          window.alert(`${hotspot.title}\n\n${hotspot.text}`);
        });
      }

      if (hotspot.type === "image" || hotspot.type === "video" || hotspot.type === "link") {
        element.textContent = hotspot.title ?? "Abrir";
        element.addEventListener("click", () => window.open(hotspot.url, "_blank", "noopener"));
      }

      renderedScene.hotspotContainer().createHotspot(element, {
        yaw: hotspot.yaw,
        pitch: hotspot.pitch
      });
    }
  }
}

function roundViewNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}
