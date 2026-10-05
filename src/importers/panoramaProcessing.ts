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

export async function processPanorama(file: File, signal?: AbortSignal): Promise<ProcessedPanorama> {
  throwIfAborted(signal);
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    try {
      return await processWithWorker(file, signal);
    } catch {
      throwIfAborted(signal);
      // Older privacy-focused browsers can expose Worker APIs while blocking image decoding in workers.
    }
  }

  const sha256Promise = calculateSha256(file);
  const preview = await createOptimizedPanorama(file);
  throwIfAborted(signal);
  const tiles = await createPanoramaTiles(file, 0.96);
  throwIfAborted(signal);
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

function processWithWorker(file: File, signal?: AbortSignal): Promise<ProcessedPanorama> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./panoramaWorker.ts", import.meta.url), { type: "module" });
    const abort = () => {
      worker.terminate();
      reject(new DOMException("Importacion cancelada.", "AbortError"));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      reject(new Error("El procesamiento en segundo plano excedio el tiempo permitido."));
    }, 180_000);

    worker.addEventListener("message", (event) => {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      if (!event.data?.ok) {
        reject(new Error(event.data?.error ?? "No se pudo procesar el panorama."));
        return;
      }
      resolve({ ...event.data.result, usedWorker: true });
    });
    worker.addEventListener("error", (event) => {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
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

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Importacion cancelada.", "AbortError");
}
