import type { TourProject, ValidationIssue } from "./tour";
import { getOriginalPanoramaPath } from "./panoramaAssets";
import { collectAssetPaths, type ProjectAssetResolver } from "../project/projectRepository";

export async function validateProjectAssets(project: TourProject, resolveAsset: ProjectAssetResolver): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  for (const scene of project.scenes) {
    if (!/^(https?:|data:|blob:)/.test(scene.panorama) && !getOriginalPanoramaPath(scene)) {
      issues.push({
        severity: "error",
        code: "asset.originalMissing",
        message: `Falta el panorama original de ${scene.name}. Usa Recuperar originales antes de exportar.`
      });
    }
  }

  for (const assetPath of collectAssetPaths(project)) {
    const asset = await resolveAsset(project, assetPath);
    if (!asset) {
      issues.push({
        severity: "error",
        code: "asset.missing",
        message: `Falta el archivo local usado por el tour: ${assetPath}.`
      });
    }
  }

  return issues;
}
