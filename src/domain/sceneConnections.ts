import type { Hotspot, Scene, SceneHotspot, TourProject } from "./tour";

export interface ConnectionCleanupResult {
  project: TourProject;
  removedCount: number;
}

export function normalizeProjectSceneConnections(project: TourProject): ConnectionCleanupResult {
  let removedCount = 0;
  const scenes = project.scenes.map((scene) => {
    const normalized = normalizeSceneConnections(scene.hotspots);
    removedCount += normalized.removedCount;
    return normalized.removedCount > 0 ? { ...scene, hotspots: normalized.hotspots } : scene;
  });

  return {
    project: removedCount > 0 ? { ...project, scenes } : project,
    removedCount
  };
}

export function replaceSceneConnection(hotspots: Hotspot[], connection: SceneHotspot): Hotspot[] {
  return [
    ...hotspots.filter((hotspot) => hotspot.type !== "scene" || hotspot.targetScene !== connection.targetScene),
    connection
  ];
}

export function normalizeSceneConnections(hotspots: Hotspot[]): { hotspots: Hotspot[]; removedCount: number } {
  const result: Hotspot[] = [];
  const connectionIndexes = new Map<string, number>();
  let removedCount = 0;

  for (const hotspot of hotspots) {
    if (hotspot.type !== "scene") {
      result.push(hotspot);
      continue;
    }

    const existingIndex = connectionIndexes.get(hotspot.targetScene);
    if (existingIndex === undefined) {
      connectionIndexes.set(hotspot.targetScene, result.length);
      result.push(hotspot);
      continue;
    }

    const existing = result[existingIndex] as SceneHotspot;
    if (shouldReplaceConnection(existing, hotspot)) result[existingIndex] = hotspot;
    removedCount += 1;
  }

  return { hotspots: result, removedCount };
}

function shouldReplaceConnection(existing: SceneHotspot, candidate: SceneHotspot): boolean {
  const existingIsAutomatic = isAutomaticConnection(existing);
  const candidateIsAutomatic = isAutomaticConnection(candidate);
  if (existingIsAutomatic !== candidateIsAutomatic) return existingIsAutomatic;
  return !candidateIsAutomatic;
}

function isAutomaticConnection(connection: SceneHotspot): boolean {
  return /^auto-(?:prev|next)-/.test(connection.id);
}
