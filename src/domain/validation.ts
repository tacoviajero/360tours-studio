import type { SceneHotspot, TourProject, ValidationIssue } from "./tour";

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

  for (const scene of project.scenes) {
    if (!scene.panorama) {
      issues.push({
        severity: "error",
        code: "scene.panoramaMissing",
        message: `${scene.name} no tiene panorama asignado.`
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

  return issues;
}

export function isReadyToPublish(project: TourProject): boolean {
  return validateProject(project).every((issue) => issue.severity !== "error");
}

