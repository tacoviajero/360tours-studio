export async function createImageThumbnail(file: File, maxWidth = 640, quality = 0.78): Promise<Blob> {
  return createResizedJpeg(file, maxWidth, quality);
}

export async function createPreviewPanorama(file: File, maxWidth = 2048, quality = 0.9): Promise<Blob> {
  return createResizedJpeg(file, maxWidth, quality);
}

async function createResizedJpeg(file: File, maxWidth: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
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

  const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!image) {
    throw new Error("No se pudo generar la imagen optimizada.");
  }

  return image;
}
