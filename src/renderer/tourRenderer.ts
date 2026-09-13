import type { TourProject, ViewState } from "../domain/tour";

export interface TourRenderer {
  mount(container: HTMLElement, project: TourProject): void;
  goToScene(sceneId: string): void;
  getCurrentViewState(): ViewState | null;
  screenToCoordinates(x: number, y: number): Pick<ViewState, "yaw" | "pitch"> | null;
  destroy(): void;
}
