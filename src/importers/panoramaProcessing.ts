import { calculateSha256, createImageThumbnail, createOptimizedPanorama, createPanoramaTiles } from "./imageProcessing";

export interface ProcessedPanorama {
  sourceWidth: number;
  sourceHeight: number;
  sourceBytes: number;
  sha256: string;
  preview: { blob: Blob; width: number; height: number; bytes: number; quality: number; resized: boolean };
  thumbnail: Blob | null;
  tiles: Awaited<ReturnType<typeof createPanoramaTiles>>;
  usedWorker: boolean;
}

export async function processPanorama(file: File): Promise<ProcessedPanorama> {
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    try {
      return await processWithWorker(file);
    } catch {
      // Older privacy-focused browsers can expose Worker APIs while blocking image decoding in workers.
    }
  }

  const sha256Promise = calculateSha256(file);
  const preview = await createOptimizedPanorama(file);
  const tiles = await createPanoramaTiles(file, 0.96);
  let thumbnail: Blob | null = null;
  try {
    thumbnail = await createImageThumbnail(file);
  } catch {
    thumbnail = null;
  }

  return {
    sourceWidth: preview.sourceWidth,
    sourceHeight: preview.sourceHeight,
    sourceBytes: preview.sourceBytes,
    sha256: await sha256Promise,
    preview: {
      blob: preview.blob,
      width: preview.outputWidth,
      height: preview.outputHeight,
      bytes: preview.outputBytes,
      quality: preview.quality,
      resized: preview.resized
    },
    thumbnail,
    tiles,
    usedWorker: false
  };
}

function processWithWorker(file: File): Promise<ProcessedPanorama> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./panoramaWorker.ts", import.meta.url), { type: "module" });
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("El procesamiento en segundo plano excedio el tiempo permitido."));
    }, 180_000);

    worker.addEventListener("message", (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      if (!event.data?.ok) {
        reject(new Error(event.data?.error ?? "No se pudo procesar el panorama."));
        return;
      }
      resolve({ ...event.data.result, usedWorker: true });
    });
    worker.addEventListener("error", (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message || "Fallo el procesamiento en segundo plano."));
    });
    worker.postMessage({
      file,
      previewWidth: 2048,
      previewQuality: 0.9,
      thumbnailWidth: 640,
      thumbnailQuality: 0.78,
      tileQuality: 0.96
    });
  });
}
