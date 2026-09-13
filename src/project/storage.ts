import type { TourProject } from "../domain/tour";

export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ProjectSnapshotSummary {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  sceneCount: number;
}

export interface ProjectStorage {
  load(projectId: string): Promise<TourProject>;
  loadLast(): Promise<TourProject | null>;
  list(): Promise<ProjectSummary[]>;
  listSnapshots(projectId: string): Promise<ProjectSnapshotSummary[]>;
  loadSnapshot(projectId: string, snapshotId: string): Promise<TourProject>;
  remove(projectId: string): Promise<void>;
  save(project: TourProject): Promise<void>;
  snapshot(project: TourProject): Promise<ProjectSnapshotSummary>;
}

export class BrowserProjectStorage implements ProjectStorage {
  private readonly prefix = "360tours-project:";
  private readonly legacyPrefix = "hometours-project:";
  private readonly lastProjectKey = "360tours-project:last";
  private readonly indexKey = "360tours-project:index";

  async load(projectId: string): Promise<TourProject> {
    const rawProject = localStorage.getItem(`${this.prefix}${projectId}`) ?? localStorage.getItem(`${this.legacyPrefix}${projectId}`);
    if (!rawProject) {
      throw new Error("Proyecto no encontrado.");
    }

    return JSON.parse(rawProject) as TourProject;
  }

  async loadLast(): Promise<TourProject | null> {
    const projectId = localStorage.getItem(this.lastProjectKey);
    if (!projectId) {
      return null;
    }

    try {
      return await this.load(projectId);
    } catch {
      return null;
    }
  }

  async list(): Promise<ProjectSummary[]> {
    const rawIndex = localStorage.getItem(this.indexKey);
    if (!rawIndex) {
      return [];
    }

    return (JSON.parse(rawIndex) as ProjectSummary[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listSnapshots(projectId: string): Promise<ProjectSnapshotSummary[]> {
    const rawIndex = localStorage.getItem(this.snapshotIndexKey(projectId));
    if (!rawIndex) {
      return [];
    }

    return (JSON.parse(rawIndex) as ProjectSnapshotSummary[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async loadSnapshot(projectId: string, snapshotId: string): Promise<TourProject> {
    const rawProject = localStorage.getItem(this.snapshotKey(projectId, snapshotId));
    if (!rawProject) {
      throw new Error("Snapshot no encontrado.");
    }

    return JSON.parse(rawProject) as TourProject;
  }

  async save(project: TourProject): Promise<void> {
    localStorage.setItem(`${this.prefix}${project.id}`, JSON.stringify(project, null, 2));
    localStorage.setItem(this.lastProjectKey, project.id);
    this.updateIndex(project);
  }

  async remove(projectId: string): Promise<void> {
    const snapshots = await this.listSnapshots(projectId);
    localStorage.removeItem(`${this.prefix}${projectId}`);
    localStorage.removeItem(`${this.legacyPrefix}${projectId}`);
    localStorage.removeItem(this.snapshotIndexKey(projectId));

    for (const snapshot of snapshots) {
      localStorage.removeItem(this.snapshotKey(projectId, snapshot.id));
    }

    const summaries = JSON.parse(localStorage.getItem(this.indexKey) ?? "[]") as ProjectSummary[];
    const nextIndex = summaries.filter((summary) => summary.id !== projectId);
    localStorage.setItem(this.indexKey, JSON.stringify(nextIndex));

    if (localStorage.getItem(this.lastProjectKey) === projectId) {
      const nextProject = nextIndex.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (nextProject) {
        localStorage.setItem(this.lastProjectKey, nextProject.id);
      } else {
        localStorage.removeItem(this.lastProjectKey);
      }
    }
  }

  async snapshot(project: TourProject): Promise<ProjectSnapshotSummary> {
    const createdAt = new Date().toISOString();
    const id = createdAt.replace(/[-:.]/g, "").slice(0, 15);
    const summary: ProjectSnapshotSummary = {
      id,
      projectId: project.id,
      title: project.title,
      createdAt,
      sceneCount: project.scenes.length
    };

    localStorage.setItem(this.snapshotKey(project.id, id), JSON.stringify(project, null, 2));
    this.updateSnapshotIndex(summary);
    return summary;
  }

  private updateIndex(project: TourProject): void {
    const summaries = JSON.parse(localStorage.getItem(this.indexKey) ?? "[]") as ProjectSummary[];
    const nextSummary = {
      id: project.id,
      title: project.title,
      updatedAt: new Date().toISOString()
    };
    const nextIndex = [nextSummary, ...summaries.filter((summary) => summary.id !== project.id)];
    localStorage.setItem(this.indexKey, JSON.stringify(nextIndex));
  }

  private updateSnapshotIndex(summary: ProjectSnapshotSummary): void {
    const key = this.snapshotIndexKey(summary.projectId);
    const summaries = JSON.parse(localStorage.getItem(key) ?? "[]") as ProjectSnapshotSummary[];
    const nextIndex = [summary, ...summaries.filter((item) => item.id !== summary.id)].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(nextIndex));
  }

  private snapshotIndexKey(projectId: string): string {
    return `${this.prefix}${projectId}:history:index`;
  }

  private snapshotKey(projectId: string, snapshotId: string): string {
    return `${this.prefix}${projectId}:history:${snapshotId}`;
  }
}
