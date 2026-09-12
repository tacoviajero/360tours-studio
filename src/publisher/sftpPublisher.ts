import type { TourProject } from "../domain/tour";
import { isReadyToPublish } from "../domain/validation";

export interface PublishResult {
  ok: boolean;
  url?: string;
  message: string;
}

export async function publishTour(project: TourProject): Promise<PublishResult> {
  if (!isReadyToPublish(project)) {
    return {
      ok: false,
      message: "El tour tiene errores criticos y no puede publicarse."
    };
  }

  return {
    ok: false,
    message: "Publicacion SFTP pendiente de implementar despues del exportador estatico."
  };
}

