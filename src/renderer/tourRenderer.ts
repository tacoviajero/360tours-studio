import type { TourProject } from "../domain/tour";

export interface TourRenderer {
  mount(container: HTMLElement, project: TourProject): void;
  goToScene(sceneId: string): void;
  destroy(): void;
}

