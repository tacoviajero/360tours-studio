import type { TourProject } from "../domain/tour";
import { collectPanoramaAssetPaths } from "../domain/panoramaAssets";
import type { ProjectSnapshotSummary } from "./storage";

export interface ProjectFolderFile {
  path: string;
  content: string | Blob;
  mimeType: string;
}

export interface LoadedProjectFolder {
  project: TourProject;
  assetFiles: Array<{
    path: string;
    file: File;
  }>;
  snapshots: Array<{
    id: string;
    project: TourProject;
  }>;
}

export type ProjectAssetResolver = (project: TourProject, assetPath: string) => Promise<Blob | null>;
export type ProjectSnapshotResolver = (projectId: string, snapshotId: string) => Promise<TourProject>;

export async function buildProjectFolder(
  project: TourProject,
  resolveAsset: ProjectAssetResolver,
  snapshots: ProjectSnapshotSummary[] = [],
  resolveSnapshot?: ProjectSnapshotResolver
): Promise<ProjectFolderFile[]> {
  const files: ProjectFolderFile[] = [
    {
      path: "project.json",
      content: JSON.stringify(project, null, 2),
      mimeType: "application/json"
    },
    {
      path: "README.txt",
      content: renderProjectReadme(project),
      mimeType: "text/plain"
    }
  ];

  const assetPaths = collectAssetPaths(project);
  for (const path of assetPaths) {
    const asset = await resolveAsset(project, path);
    if (asset) {
      files.push({
        path,
        content: asset,
        mimeType: asset.type || inferMimeType(path)
      });
    }
  }

  if (resolveSnapshot) {
    for (const snapshot of snapshots) {
      const snapshotProject = await resolveSnapshot(project.id, snapshot.id);
      files.push({
        path: `.history/${snapshot.id}.json`,
        content: JSON.stringify(snapshotProject, null, 2),
        mimeType: "application/json"
      });
    }
  }

  return files;
}

export async function loadProjectFolder(
  readFile: (path: string) => Promise<File | null>,
  listFiles?: (path: string) => Promise<string[]>
): Promise<LoadedProjectFolder> {
  const projectFile = await readFile("project.json");
  if (!projectFile) {
    throw new Error("La carpeta no contiene project.json.");
  }

  const project = JSON.parse(await projectFile.text()) as TourProject;
  assertProjectShape(project);
  const assetFiles: LoadedProjectFolder["assetFiles"] = [];

  for (const assetPath of collectAssetPaths(project)) {
    const file = await readFile(assetPath);
    if (file) {
      assetFiles.push({ path: assetPath, file });
    }
  }

  const snapshots: LoadedProjectFolder["snapshots"] = [];
  const historyFiles = listFiles ? await listFiles(".history") : [];
  for (const historyPath of historyFiles.filter((path) => path.endsWith(".json"))) {
    const snapshotFile = await readFile(historyPath);
    if (snapshotFile) {
      snapshots.push({
        id: historyPath.split("/").pop()?.replace(/\.json$/, "") ?? historyPath,
        project: parseSnapshot(await snapshotFile.text())
      });
    }
  }

  return { project, assetFiles, snapshots };
}

export function collectAssetPaths(project: TourProject): string[] {
  const paths = new Set<string>();

  for (const scene of project.scenes) {
    for (const path of collectPanoramaAssetPaths(scene)) paths.add(path);
  }

  for (const floorplan of project.floorplans) {
    paths.add(floorplan.image);
  }

  for (const galleryItem of project.gallery) {
    paths.add(galleryItem.image);
  }

  return Array.from(paths).filter((path) => !isRemoteOrObjectUrl(path));
}

function parseSnapshot(rawSnapshot: string): TourProject {
  const project = JSON.parse(rawSnapshot) as TourProject;
  assertProjectShape(project);
  return project;
}

function assertProjectShape(project: TourProject): void {
  if (
    !project ||
    project.schemaVersion !== 1 ||
    typeof project.id !== "string" ||
    typeof project.title !== "string" ||
    !Array.isArray(project.scenes) ||
    !Array.isArray(project.floorplans) ||
    !Array.isArray(project.gallery)
  ) {
    throw new Error("project.json no tiene el formato de 360Tours Studio.");
  }
}

function isRemoteOrObjectUrl(path: string): boolean {
  return /^(https?:|blob:|data:)/.test(path);
}

function inferMimeType(path: string): string {
  const extension = path.toLowerCase().split(".").pop();
  if (extension === "png") {
    return "image/png";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  if (extension === "json") {
    return "application/json";
  }

  return "image/jpeg";
}

function renderProjectReadme(project: TourProject): string {
  return `360Tours Studio Project

Project: ${project.title}
ID: ${project.id}
Scenes: ${project.scenes.length}

This folder is the editable project source for 360Tours Studio.
Keep project.json together with panoramas/, gallery/, floorplans/ and .history/.
`;
}
