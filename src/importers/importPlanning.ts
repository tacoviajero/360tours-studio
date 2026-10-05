export interface ImportCapacity {
  sourceBytes: number;
  estimatedBytes: number;
  availableBytes: number | null;
  allowed: boolean;
  warning: string | null;
}

const STORAGE_MULTIPLIER = 2.4;
const STORAGE_RESERVE_BYTES = 256 * 1024 * 1024;

export async function planImportCapacity(files: File[]): Promise<ImportCapacity> {
  const sourceBytes = files.reduce((total, file) => total + file.size, 0);
  const estimatedBytes = Math.ceil(sourceBytes * STORAGE_MULTIPLIER);
  const estimate = await navigator.storage?.estimate?.();
  const availableBytes = estimate?.quota == null ? null : Math.max(0, estimate.quota - (estimate.usage ?? 0));
  const allowed = availableBytes == null || estimatedBytes + STORAGE_RESERVE_BYTES <= availableBytes;
  const warning = !allowed
    ? `El lote necesita aproximadamente ${formatBytes(estimatedBytes)}, pero el navegador solo reporta ${formatBytes(availableBytes)} libres.`
    : availableBytes != null && estimatedBytes > availableBytes * 0.55
      ? `El lote usara cerca de ${formatBytes(estimatedBytes)} de ${formatBytes(availableBytes)} disponibles.`
      : null;

  return { sourceBytes, estimatedBytes, availableBytes, allowed, warning };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
