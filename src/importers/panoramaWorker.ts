interface PanoramaWorkerRequest {
  file: File;
  previewWidth: number;
  previewQuality: number;
  thumbnailWidth: number;
  thumbnailQuality: number;
  tileQuality: number;
}

interface PanoramaWorkerTile {
  col: number;
  row: number;
  blob: Blob;
}

const workerScope = self as unknown as Worker;

workerScope.addEventListener("message", async (event: MessageEvent<PanoramaWorkerRequest>) => {
  try {
    const result = await processPanorama(event.data);
    workerScope.postMessage({ ok: true, result });
  } catch (error) {
    workerScope.postMessage({ ok: false, error: error instanceof Error ? error.message : "No se pudo procesar el panorama." });
  }
});

async function processPanorama(request: PanoramaWorkerRequest) {
  const { file } = request;
  const bitmap = await createImageBitmap(file);
  try {
    const width = bitmap.width;
    const height = bitmap.height;
    const preview = await renderScaled(bitmap, request.previewWidth, request.previewQuality);
    const thumbnail = await renderScaled(bitmap, request.thumbnailWidth, request.thumbnailQuality);
    const cols = selectTileColumns(width);
    const rows = cols / 2;
    const tileWidth = Math.ceil(width / cols);
    const tileHeight = Math.ceil(height / rows);
    const canvas = new OffscreenCanvas(tileWidth, tileHeight);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no pudo preparar los mosaicos 360.");

    const tiles: PanoramaWorkerTile[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const sourceX = col * tileWidth;
        const sourceY = row * tileHeight;
        const sourceWidth = Math.min(tileWidth, width - sourceX);
        const sourceHeight = Math.min(tileHeight, height - sourceY);
        context.clearRect(0, 0, tileWidth, tileHeight);
        context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, tileWidth, tileHeight);
        tiles.push({ col, row, blob: await canvas.convertToBlob({ type: "image/jpeg", quality: request.tileQuality }) });
      }
    }

    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return {
      sourceWidth: width,
      sourceHeight: height,
      sourceBytes: file.size,
      sha256: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
      preview,
      thumbnail,
      tiles: { width, height, cols, rows, tileWidth, tileHeight, tiles }
    };
  } finally {
    bitmap.close();
  }
}

async function renderScaled(bitmap: ImageBitmap, maxWidth: number, quality: number) {
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no pudo preparar la vista previa.");
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return { blob, width, height, bytes: blob.size, quality, resized: width !== bitmap.width || height !== bitmap.height };
}

function selectTileColumns(width: number): number {
  return [4, 8, 16, 32, 64].find((cols) => Math.ceil(width / cols) <= 1024) ?? 64;
}
