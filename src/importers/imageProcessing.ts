export async function createImageThumbnail(file: File, maxWidth = 640, quality = 0.78): Promise<Blob> {
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
    throw new Error("No se pudo crear el canvas de thumbnail.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const thumbnail = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!thumbnail) {
    throw new Error("No se pudo generar el thumbnail.");
  }

  return thumbnail;
}
