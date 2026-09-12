import type { Scene } from "../domain/tour";

export interface ImportCandidate {
  file: File;
  checksum?: string;
}

export interface ImportIssue {
  severity: "error" | "warning";
  message: string;
}

export interface ImportResult {
  scenes: Scene[];
  issues: ImportIssue[];
}

export interface PanoramaImporter {
  readonly id: string;
  readonly displayName: string;
  canImport(file: File): boolean;
  import(files: ImportCandidate[]): Promise<ImportResult>;
}

