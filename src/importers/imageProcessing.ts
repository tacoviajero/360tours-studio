export interface ImageOptimizationResult {
  blob: Blob;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  sourceBytes: number;
  outputBytes: number;
  maxWidth: number;
  quality: number;
  resized: boolean;
}

export interface PanoramaTile {
  col: number;
  row: number;
  blob: Blob;
}

export interface PanoramaTileResult {
  width: number;
  height: number;
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  tiles: PanoramaTile[];
}

export async function createImageThumbnail(file: File, maxWidth = 640, quality = 0.78): Promise<Blob> {
  return (await createOptimizedJpeg(file, maxWidth, quality)).blob;
}

export async function createPreviewPanorama(file: File, maxWidth = 2048, quality = 0.9): Promise<Blob> {
  return (await createOptimizedJpeg(file, maxWidth, quality)).blob;
}

export async function createOptimizedPanorama(file: File, maxWidth = 2048, quality = 0.9): Promise<ImageOptimizationResult> {
  return createOptimizedJpeg(file, maxWidth, quality);
}

export async function calculateSha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createPanoramaTiles(file: File, quality = 0.96): Promise<PanoramaTileResult> {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  const cols = selectTileColumns(width);
  const rows = cols / 2;
  const tileWidth = Math.ceil(width / cols);
  const tileHeight = Math.ceil(height / rows);
  const canvas = document.createElement("canvas");
  canvas.width = tileWidth;
  canvas.height = tileHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("No se pudo crear el canvas de mosaicos.");
  }

  const tiles: PanoramaTile[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const sourceX = col * tileWidth;
      const sourceY = row * tileHeight;
      const sourceWidth = Math.min(tileWidth, width - sourceX);
      const sourceHeight = Math.min(tileHeight, height - sourceY);
      context.fillStyle = "#000";
      context.fillRect(0, 0, tileWidth, tileHeight);
      context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, tileWidth, tileHeight);
      const blob = await canvasToJpeg(canvas, quality);
      tiles.push({ col, row, blob });
    }
  }
  bitmap.close();

  return { width, height, cols, rows, tileWidth, tileHeight, tiles };
}

async function createOptimizedJpeg(file: File, maxWidth: number, quality: number): Promise<ImageOptimizationResult> {
  const bitmap = await createImageBitmap(file);
  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("No se pudo crear el canvas de imagen.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const image = await canvasToJpeg(canvas, quality);

  return {
    blob: image,
    sourceWidth,
    sourceHeight,
    outputWidth: width,
    outputHeight: height,
    sourceBytes: file.size,
    outputBytes: image.size,
    maxWidth,
    quality,
    resized: width !== sourceWidth || height !== sourceHeight
  };
}

function selectTileColumns(width: number): number {
  for (const cols of [4, 8, 16, 32, 64]) {
    if (Math.ceil(width / cols) <= 1024) return cols;
  }
  return 64;
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!image) throw new Error("No se pudo generar la imagen JPEG.");
  return image;
}
