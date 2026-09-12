import type { TourProject } from "../domain/tour";

export interface ProjectStorage {
  load(projectId: string): Promise<TourProject>;
  save(project: TourProject): Promise<void>;
  snapshot(project: TourProject): Promise<void>;
}

export class BrowserProjectStorage implements ProjectStorage {
  private readonly prefix = "hometours-project:";

  async load(projectId: string): Promise<TourProject> {
    const rawProject = localStorage.getItem(`${this.prefix}${projectId}`);
    if (!rawProject) {
      throw new Error("Proyecto no encontrado.");
    }

    return JSON.parse(rawProject) as TourProject;
  }

  async save(project: TourProject): Promise<void> {
    localStorage.setItem(`${this.prefix}${project.id}`, JSON.stringify(project, null, 2));
  }

  async snapshot(project: TourProject): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
    localStorage.setItem(`${this.prefix}${project.id}:history:${timestamp}`, JSON.stringify(project, null, 2));
  }
}

