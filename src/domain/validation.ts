import type { MediaHotspot, SceneHotspot, TourProject, ValidationIssue } from "./tour";

export function validateProject(project: TourProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sceneIds = new Set(project.scenes.map((scene) => scene.id));

  if (project.schemaVersion !== 1) {
    issues.push({
      severity: "error",
      code: "schema.unsupported",
      message: "El proyecto usa una version de formato no soportada."
    });
  }

  if (!project.startScene) {
    issues.push({
      severity: "error",
      code: "startScene.missing",
      message: "Falta elegir la escena inicial."
    });
  } else if (!sceneIds.has(project.startScene)) {
    issues.push({
      severity: "error",
      code: "startScene.invalid",
      message: "La escena inicial ya no existe."
    });
  }

  const slug = project.publish?.slug;
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    issues.push({
      severity: "error",
      code: "publish.slugInvalid",
      message: "El slug publico solo debe usar letras, numeros y guiones."
    });
  }

  for (const scene of project.scenes) {
    if (!scene.panorama) {
      issues.push({
        severity: "error",
        code: "scene.panoramaMissing",
        message: `${scene.name} no tiene panorama asignado.`
      });
    }

    if (project.scenes.length > 1 && !scene.hotspots.some((hotspot) => hotspot.type === "scene")) {
      issues.push({
        severity: "warning",
        code: "scene.noExit",
        message: `${scene.name} no tiene conexiones hacia otras escenas.`
      });
    }

    for (const hotspot of scene.hotspots) {
      if (hotspot.type === "scene") {
        const sceneHotspot = hotspot as SceneHotspot;
        if (!sceneIds.has(sceneHotspot.targetScene)) {
          issues.push({
            severity: "error",
            code: "hotspot.targetMissing",
            message: `${scene.name} apunta a una escena que ya no existe.`
          });
        }
      }

      if (hotspot.type === "image" || hotspot.type === "video" || hotspot.type === "link") {
        const mediaHotspot = hotspot as MediaHotspot;
        if (!mediaHotspot.url || mediaHotspot.url === "https://") {
          issues.push({
            severity: "warning",
            code: "hotspot.urlMissing",
            message: `${scene.name} tiene un hotspot ${hotspot.type} sin URL final.`
          });
        } else if (!isSafeExternalUrl(mediaHotspot.url)) {
          issues.push({
            severity: "warning",
            code: "hotspot.urlInvalid",
            message: `${scene.name} tiene una URL de hotspot que debe iniciar con http o https.`
          });
        }
      }
    }
  }

  for (const floorplan of project.floorplans) {
    for (const marker of floorplan.markers) {
      if (!sceneIds.has(marker.sceneId)) {
        issues.push({
          severity: "error",
          code: "floorplan.sceneMissing",
          message: `${floorplan.name} tiene un marcador hacia una escena eliminada.`
        });
      }
    }
  }

  if (project.startScene && sceneIds.has(project.startScene)) {
    const reachableScenes = findReachableScenes(project, project.startScene);
    for (const scene of project.scenes) {
      if (!reachableScenes.has(scene.id)) {
        issues.push({
          severity: "warning",
          code: "scene.unreachable",
          message: `${scene.name} no es accesible desde la escena inicial.`
        });
      }
    }
  }

  if (project.scenes.length > 0 && project.floorplans.length === 0) {
    issues.push({
      severity: "warning",
      code: "floorplan.missing",
      message: "Aun no hay plano de planta."
    });
  }

  if (project.scenes.length > 0 && project.gallery.length === 0) {
    issues.push({
      severity: "warning",
      code: "gallery.missing",
      message: "Aun no hay fotos de galeria."
    });
  }

  return issues;
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isReadyToPublish(project: TourProject): boolean {
  return validateProject(project).every((issue) => issue.severity !== "error");
}

function findReachableScenes(project: TourProject, startSceneId: string): Set<string> {
  const visited = new Set<string>();
  const pending = [startSceneId];

  while (pending.length > 0) {
    const sceneId = pending.shift();
    if (!sceneId || visited.has(sceneId)) {
      continue;
    }

    visited.add(sceneId);
    const scene = project.scenes.find((item) => item.id === sceneId);
    if (!scene) {
      continue;
    }

    for (const hotspot of scene.hotspots) {
      if (hotspot.type === "scene" && !visited.has(hotspot.targetScene)) {
        pending.push(hotspot.targetScene);
      }
    }
  }

  return visited;
}
