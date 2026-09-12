import Marzipano from "marzipano";
import type { Hotspot, Scene, TourProject } from "../domain/tour";
import type { TourRenderer } from "./tourRenderer";

interface RenderedScene {
  data: Scene;
  scene: any;
}

export class MarzipanoTourRenderer implements TourRenderer {
  private viewer: any | null = null;
  private scenes = new Map<string, RenderedScene>();
  private project: TourProject | null = null;
  private onSceneChange: (sceneId: string) => void;

  constructor(onSceneChange: (sceneId: string) => void = () => undefined) {
    this.onSceneChange = onSceneChange;
  }

  mount(container: HTMLElement, project: TourProject): void {
    this.destroy();
    this.project = project;
    this.viewer = new Marzipano.Viewer(container);

    for (const scene of project.scenes) {
      const view = new Marzipano.RectilinearView(scene.initialView);
      const source = Marzipano.ImageUrlSource.fromString(scene.panorama);
      const geometry = new Marzipano.EquirectGeometry([{ width: 4096 }]);
      const limiter = Marzipano.RectilinearView.limit.traditional(4096, Math.PI / 2);
      const renderedScene = this.viewer.createScene({ source, geometry, view, limiter });

      this.scenes.set(scene.id, { data: scene, scene: renderedScene });
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
    this.onSceneChange(sceneId);
  }

  destroy(): void {
    this.scenes.clear();
    this.project = null;
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

