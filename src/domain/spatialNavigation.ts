import type { Scene, SceneHotspot, TourProject } from "./tour";

const FULL_TURN = Math.PI * 2;

export function normalizeYaw(yaw: number): number {
  return ((yaw + Math.PI) % FULL_TURN + FULL_TURN) % FULL_TURN - Math.PI;
}

export function angularDistance(first: number, second: number): number {
  return Math.abs(normalizeYaw(first - second));
}

export function findDirectionalHotspot(
  scene: Scene,
  currentYaw: number,
  direction: "forward" | "backward",
): SceneHotspot | undefined {
  const targetYaw = normalizeYaw(currentYaw + (direction === "backward" ? Math.PI : 0));
  const candidates = scene.hotspots
    .filter((hotspot): hotspot is SceneHotspot => hotspot.type === "scene")
    .map((hotspot) => ({ hotspot, distance: angularDistance(hotspot.yaw, targetYaw) }))
    .sort((first, second) => first.distance - second.distance);

  return candidates[0]?.hotspot;
}

export function resolveArrivalYaw(
  project: TourProject,
  sourceSceneId: string,
  hotspot: SceneHotspot,
): number | undefined {
  if (typeof hotspot.targetYaw === "number") {
    return normalizeYaw(hotspot.targetYaw);
  }

  const destination = project.scenes.find((scene) => scene.id === hotspot.targetScene);
  if (!destination) {
    return undefined;
  }

  const returnHotspot = destination.hotspots.find(
    (candidate): candidate is SceneHotspot =>
      candidate.type === "scene" && candidate.targetScene === sourceSceneId,
  );

  return returnHotspot
    ? normalizeYaw(returnHotspot.yaw + Math.PI)
    : destination.initialView.yaw;
}
