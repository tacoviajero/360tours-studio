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
  finalPath: string;
  temporaryPath: string;
  rollbackPath: string;
  url: string;
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

export function createPublishPlan(project: TourProject, config: PublishConfig = defaultPublishConfig): PublishPlan {
  const slug = project.publish?.slug || project.id;
  const releaseId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const basePath = trimTrailingSlash(config.basePath);
  const publicBaseUrl = trimTrailingSlash(config.publicBaseUrl);

  return {
    slug,
    finalPath: `${basePath}/${slug}`,
    temporaryPath: `${basePath}/.deploy/${slug}-${releaseId}`,
    rollbackPath: `${basePath}/.versions/${slug}/${releaseId}`,
    url: `${publicBaseUrl}/${slug}/`
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
