import type { TourProject } from "../domain/tour";
import { validateProject } from "../domain/validation";

export interface PublishConfig {
  host?: string;
  username?: string;
  basePath: string;
  publicBaseUrl: string;
}

export interface PublishPlan {
  slug: string;
  releaseId: string;
  finalPath: string;
  temporaryPath: string;
  rollbackPath: string;
  url: string;
  steps: PublishStep[];
}

export interface PublishStep {
  id: string;
  label: string;
  detail: string;
}

export interface PublishResult {
  ok: boolean;
  url?: string;
  message: string;
  plan?: PublishPlan;
}

const defaultPublishConfig: PublishConfig = {
  basePath: "/tours",
  publicBaseUrl: "https://tacoviajero.com/tours"
};

export async function publishTour(project: TourProject, config: PublishConfig = defaultPublishConfig): Promise<PublishResult> {
  const errors = validateProject(project).filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    return {
      ok: false,
      message: errors[0]?.message ?? "El tour tiene errores criticos y no puede publicarse."
    };
  }

  const plan = createPublishPlan(project, config);

  if (!config.host || !config.username) {
    return {
      ok: false,
      message: "Publicacion detenida: falta configurar cuenta SFTP dedicada.",
      plan
    };
  }

  return {
    ok: false,
    message: "Publicacion SFTP lista para conectar cuando exista almacenamiento seguro de credenciales.",
    plan
  };
}

export function createPublishPlan(project: TourProject, config: PublishConfig = defaultPublishConfig, now = new Date()): PublishPlan {
  const slug = project.publish?.slug || project.id;
  const releaseId = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const basePath = trimTrailingSlash(config.basePath);
  const publicBaseUrl = trimTrailingSlash(config.publicBaseUrl);
  const finalPath = `${basePath}/${slug}`;
  const temporaryPath = `${basePath}/.deploy/${slug}-${releaseId}`;
  const rollbackPath = `${basePath}/.versions/${slug}/${releaseId}`;

  return {
    slug,
    releaseId,
    finalPath,
    temporaryPath,
    rollbackPath,
    url: `${publicBaseUrl}/${slug}/`,
    steps: [
      {
        id: "upload-temporary",
        label: "Subir a temporal",
        detail: `Subir todos los archivos exportados a ${temporaryPath}.`
      },
      {
        id: "verify-temporary",
        label: "Verificar temporal",
        detail: "Comprobar tour.json, deploy-manifest.json, panoramas y viewer antes de activar."
      },
      {
        id: "backup-current",
        label: "Respaldar version actual",
        detail: `Mover la version publicada actual a ${rollbackPath} si existe.`
      },
      {
        id: "activate-release",
        label: "Activar version",
        detail: `Mover ${temporaryPath} a ${finalPath}.`
      },
      {
        id: "verify-public",
        label: "Verificar URL publica",
        detail: `Abrir ${publicBaseUrl}/${slug}/ y confirmar que carga el tour.`
      }
    ]
  };
}

export function createPublishManifest(project: TourProject, files: string[], plan = createPublishPlan(project)): Record<string, unknown> {
  return {
    app: "360Tours Studio",
    schemaVersion: project.schemaVersion,
    slug: plan.slug,
    releaseId: plan.releaseId,
    url: plan.url,
    finalPath: plan.finalPath,
    temporaryPath: plan.temporaryPath,
    rollbackPath: plan.rollbackPath,
    fileCount: files.length,
    files: [...files].sort(),
    panoramas: project.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      panorama: scene.panorama,
      sourceSize: scene.metadata?.sourceSize,
      optimizedSize: scene.metadata?.optimizedSize,
      sourceBytes: scene.metadata?.sourceBytes,
      optimizedBytes: scene.metadata?.optimizedBytes,
      optimization: scene.metadata?.optimization
    })),
    steps: plan.steps
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
