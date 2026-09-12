import type { TourProject } from "../domain/tour";
import { validateProject } from "../domain/validation";

export interface ExportResult {
  ok: boolean;
  messages: string[];
}

export async function exportStaticTour(project: TourProject): Promise<ExportResult> {
  const errors = validateProject(project).filter((issue) => issue.severity === "error");

  if (errors.length > 0) {
    return {
      ok: false,
      messages: errors.map((issue) => issue.message)
    };
  }

  return {
    ok: true,
    messages: ["Exportacion estatica pendiente de implementar con filesystem/Tauri."]
  };
}

