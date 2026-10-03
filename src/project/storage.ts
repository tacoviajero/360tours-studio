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

export interface ProjectRecoveryResult {
  project: TourProject | null;
  warning?: string;
}

export class ProjectStorageError extends Error {
  constructor(
    message: string,
    readonly code: "corrupt" | "write-failed"
  ) {
    super(message);
    this.name = "ProjectStorageError";
  }
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

    return parseProject(rawProject);
  }

  async loadLast(): Promise<TourProject | null> {
    return (await this.recoverLast()).project;
  }

  async recoverLast(): Promise<ProjectRecoveryResult> {
    const projectId = localStorage.getItem(this.lastProjectKey);
    if (!projectId) {
      return { project: null };
    }

    try {
      return { project: await this.load(projectId) };
    } catch (error) {
      const snapshot = await this.loadNewestValidSnapshot(projectId);
      if (snapshot) {
        let warning = `El proyecto guardado estaba danado. Se recupero el snapshot mas reciente de "${snapshot.title}".`;
        try {
          await this.save(snapshot);
        } catch (saveError) {
          warning += ` ${saveError instanceof Error ? saveError.message : "No se pudo guardar la recuperacion."}`;
        }
        return {
          project: snapshot,
          warning
        };
      }

      for (const summary of await this.list()) {
        if (summary.id === projectId) {
          continue;
        }
        try {
          const project = await this.load(summary.id);
          try {
            localStorage.setItem(this.lastProjectKey, project.id);
          } catch {
            // The recovered project can still be used in memory when storage is read-only or full.
          }
          return {
            project,
            warning: `El ultimo proyecto no pudo abrirse. Se recupero "${project.title}".`
          };
        } catch {
          // Continue until a valid local project is found.
        }
      }

      localStorage.removeItem(this.lastProjectKey);
      return {
        project: null,
        warning: error instanceof Error ? error.message : "El ultimo proyecto local estaba danado."
      };
    }
  }

  async list(): Promise<ProjectSummary[]> {
    const rawIndex = localStorage.getItem(this.indexKey);
    if (!rawIndex) {
      return [];
    }

    return parseArray<ProjectSummary>(rawIndex)
      .filter(isProjectSummary)
      .filter((summary) => {
        const rawProject = localStorage.getItem(`${this.prefix}${summary.id}`) ?? localStorage.getItem(`${this.legacyPrefix}${summary.id}`);
        return rawProject ? canParseProject(rawProject) : false;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listSnapshots(projectId: string): Promise<ProjectSnapshotSummary[]> {
    const rawIndex = localStorage.getItem(this.snapshotIndexKey(projectId));
    if (!rawIndex) {
      return [];
    }

    return parseArray<ProjectSnapshotSummary>(rawIndex).filter(isSnapshotSummary).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async loadSnapshot(projectId: string, snapshotId: string): Promise<TourProject> {
    const rawProject = localStorage.getItem(this.snapshotKey(projectId, snapshotId));
    if (!rawProject) {
      throw new Error("Snapshot no encontrado.");
    }

    return parseProject(rawProject);
  }

  async save(project: TourProject): Promise<void> {
    try {
      localStorage.setItem(`${this.prefix}${project.id}`, JSON.stringify(project, null, 2));
      localStorage.setItem(this.lastProjectKey, project.id);
      this.updateIndex(project);
    } catch (error) {
      throw createWriteError(error);
    }
  }

  async remove(projectId: string): Promise<void> {
    const snapshots = await this.listSnapshots(projectId);
    localStorage.removeItem(`${this.prefix}${projectId}`);
    localStorage.removeItem(`${this.legacyPrefix}${projectId}`);
    localStorage.removeItem(this.snapshotIndexKey(projectId));

    for (const snapshot of snapshots) {
      localStorage.removeItem(this.snapshotKey(projectId, snapshot.id));
    }

    const summaries = parseArray<ProjectSummary>(localStorage.getItem(this.indexKey) ?? "[]").filter(isProjectSummary);
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
    const id = createdAt.replace(/[-:.Z]/g, "");
    const summary: ProjectSnapshotSummary = {
      id,
      projectId: project.id,
      title: project.title,
      createdAt,
      sceneCount: project.scenes.length
    };

    try {
      localStorage.setItem(this.snapshotKey(project.id, id), JSON.stringify(project, null, 2));
      this.updateSnapshotIndex(summary);
    } catch (error) {
      throw createWriteError(error);
    }
    return summary;
  }

  private updateIndex(project: TourProject): void {
    const summaries = parseArray<ProjectSummary>(localStorage.getItem(this.indexKey) ?? "[]").filter(isProjectSummary);
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
    const summaries = parseArray<ProjectSnapshotSummary>(localStorage.getItem(key) ?? "[]").filter(isSnapshotSummary);
    const nextIndex = [summary, ...summaries.filter((item) => item.id !== summary.id)].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(nextIndex));
  }

  private snapshotIndexKey(projectId: string): string {
    return `${this.prefix}${projectId}:history:index`;
  }

  private snapshotKey(projectId: string, snapshotId: string): string {
    return `${this.prefix}${projectId}:history:${snapshotId}`;
  }

  private async loadNewestValidSnapshot(projectId: string): Promise<TourProject | null> {
    for (const summary of await this.listSnapshots(projectId)) {
      try {
        return await this.loadSnapshot(projectId, summary.id);
      } catch {
        // Keep looking for an older valid recovery point.
      }
    }
    return null;
  }
}

function parseProject(rawProject: string): TourProject {
  try {
    const project: unknown = JSON.parse(rawProject);
    if (!isTourProject(project)) {
      throw new Error("Estructura de proyecto invalida.");
    }
    return project;
  } catch {
    throw new ProjectStorageError("El proyecto local esta danado y no se puede leer.", "corrupt");
  }
}

function isTourProject(value: unknown): value is TourProject {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === 1 &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    (value.startScene === null || typeof value.startScene === "string") &&
    isRecord(value.settings) &&
    Array.isArray(value.scenes) &&
    value.scenes.every(
      (scene) =>
        isRecord(scene) &&
        typeof scene.id === "string" &&
        typeof scene.name === "string" &&
        typeof scene.panorama === "string" &&
        isRecord(scene.initialView) &&
        typeof scene.initialView.yaw === "number" &&
        typeof scene.initialView.pitch === "number" &&
        typeof scene.initialView.fov === "number" &&
        Array.isArray(scene.hotspots)
    ) &&
    Array.isArray(value.floorplans) &&
    value.floorplans.every(
      (floorplan) =>
        isRecord(floorplan) &&
        typeof floorplan.id === "string" &&
        typeof floorplan.name === "string" &&
        typeof floorplan.image === "string" &&
        Array.isArray(floorplan.markers)
    ) &&
    Array.isArray(value.gallery) &&
    value.gallery.every((item) => isRecord(item) && typeof item.id === "string" && typeof item.image === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function canParseProject(rawProject: string): boolean {
  try {
    parseProject(rawProject);
    return true;
  } catch {
    return false;
  }
}

function parseArray<T>(rawValue: string): T[] {
  try {
    const value = JSON.parse(rawValue);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

function isProjectSummary(value: ProjectSummary): boolean {
  return Boolean(value && typeof value.id === "string" && typeof value.title === "string" && typeof value.updatedAt === "string");
}

function isSnapshotSummary(value: ProjectSnapshotSummary): boolean {
  return Boolean(value && typeof value.id === "string" && typeof value.projectId === "string" && typeof value.createdAt === "string");
}

function createWriteError(error: unknown): ProjectStorageError {
  const quotaExceeded = error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
  return new ProjectStorageError(
    quotaExceeded
      ? "No hay espacio local suficiente. Los cambios siguen abiertos, pero no quedaron guardados."
      : "No se pudo guardar localmente. Los cambios siguen abiertos; revisa los permisos o el almacenamiento del navegador.",
    "write-failed"
  );
}
