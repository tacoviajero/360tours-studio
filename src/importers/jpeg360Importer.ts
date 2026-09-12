import type { ImportCandidate, ImportResult, PanoramaImporter } from "./importer";

const JPEG_MIME_TYPES = new Set(["image/jpeg", "image/jpg"]);

export class JPEG360Importer implements PanoramaImporter {
  readonly id = "jpeg-360";
  readonly displayName = "Fotos 360 JPG";

  canImport(file: File): boolean {
    const extension = file.name.toLowerCase().split(".").pop();
    return JPEG_MIME_TYPES.has(file.type) || extension === "jpg" || extension === "jpeg";
  }

  async import(files: ImportCandidate[]): Promise<ImportResult> {
    const issues: ImportResult["issues"] = [];
    const scenes = [];

    for (const candidate of files) {
      if (!this.canImport(candidate.file)) {
        issues.push({
          severity: "error",
          message: `${candidate.file.name} no es un JPG compatible.`
        });
        continue;
      }

      const id = toSceneId(candidate.file.name);
      scenes.push({
        id,
        name: toSceneName(candidate.file.name),
        panorama: `panoramas/${candidate.file.name}`,
        thumbnail: `thumbnails/${id}.jpg`,
        initialView: { yaw: 0, pitch: 0, fov: 1.4 },
        hotspots: []
      });
    }

    return { scenes, issues };
  }
}

function toSceneId(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^$/, "escena");
}

function toSceneName(filename: string): string {
  const baseName = filename.replace(/\.[^.]+$/, "").replace(/^img[-_\s]?\d+[-_\s]?/i, "");
  const words = baseName
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

  return words.length > 0 ? words.join(" ") : "Escena nueva";
}

