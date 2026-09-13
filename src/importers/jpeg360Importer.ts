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
    const seenNames = new Set<string>();

    for (const candidate of files) {
      if (!this.canImport(candidate.file)) {
        issues.push({
          severity: "error",
          message: `${candidate.file.name} no es un JPG compatible.`
        });
        continue;
      }

      const normalizedName = candidate.file.name.toLowerCase();
      if (seenNames.has(normalizedName)) {
        issues.push({
          severity: "warning",
          message: `${candidate.file.name} esta duplicado en esta importacion.`
        });
        continue;
      }
      seenNames.add(normalizedName);

      const dimensions = await readImageDimensions(candidate.file);
      if (!dimensions) {
        issues.push({
          severity: "error",
          message: `${candidate.file.name} no se pudo leer como imagen valida.`
        });
        continue;
      }

      const aspectRatio = dimensions.width / dimensions.height;
      if (Math.abs(aspectRatio - 2) > 0.12) {
        issues.push({
          severity: "warning",
          message: `${candidate.file.name} no parece una foto 360 completa.`
        });
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

async function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    if ("createImageBitmap" in window) {
      const image = await createImageBitmap(file);
      const dimensions = { width: image.width, height: image.height };
      image.close();
      return dimensions;
    }

    return await readImageElementDimensions(file);
  } catch {
    return null;
  }
}

function readImageElementDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.addEventListener("load", () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagen invalida."));
    });

    image.src = url;
  });
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
