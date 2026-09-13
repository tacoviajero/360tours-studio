import { type ProjectFolderFile } from "../project/projectRepository";

interface TauriCore {
  invoke<T>(command: string, payload?: Record<string, unknown>): Promise<T>;
}

interface TauriWindow extends Window {
  __TAURI_INTERNALS__?: unknown;
}

interface NativeProjectFile {
  path: string;
  content: number[];
}

export interface NativeLoadedProjectFile {
  path: string;
  content: Uint8Array;
}

export function isTauriRuntime(): boolean {
  return Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

export async function saveProjectFolderNative(projectId: string, files: ProjectFolderFile[]): Promise<string> {
  const { invoke } = (await import("@tauri-apps/api/core")) as TauriCore;
  const payloadFiles: NativeProjectFile[] = [];

  for (const file of files) {
    payloadFiles.push({
      path: file.path,
      content: await contentToBytes(file.content)
    });
  }

  return invoke<string>("save_project_folder", {
    projectId,
    files: payloadFiles
  });
}

export async function loadProjectFolderNative(projectId: string): Promise<NativeLoadedProjectFile[]> {
  const { invoke } = (await import("@tauri-apps/api/core")) as TauriCore;
  const files = await invoke<NativeProjectFile[]>("load_project_folder", { projectId });
  return files.map((file) => ({
    path: file.path,
    content: new Uint8Array(file.content)
  }));
}

async function contentToBytes(content: string | Blob): Promise<number[]> {
  const bytes =
    typeof content === "string"
      ? new TextEncoder().encode(content)
      : new Uint8Array(await content.arrayBuffer());

  return Array.from(bytes);
}
