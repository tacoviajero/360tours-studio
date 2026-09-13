import type { StaticTourFile } from "./exporter";

interface ZipEntry {
  path: string;
  content: Uint8Array;
  crc: number;
  offset: number;
}

const encoder = new TextEncoder();

export async function createZipArchive(files: StaticTourFile[]): Promise<Blob> {
  const entries: ZipEntry[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const path = normalizeZipPath(file.path);
    const content = await readFileContent(file.content);
    const entry: ZipEntry = {
      path,
      content,
      crc: crc32(content),
      offset
    };
    const localHeader = createLocalHeader(entry);
    chunks.push(localHeader, content);
    offset += localHeader.byteLength + content.byteLength;
    entries.push(entry);
  }

  const centralDirectoryOffset = offset;
  for (const entry of entries) {
    const centralHeader = createCentralDirectoryHeader(entry);
    chunks.push(centralHeader);
    offset += centralHeader.byteLength;
  }

  chunks.push(createEndOfCentralDirectory(entries.length, offset - centralDirectoryOffset, centralDirectoryOffset));
  return new Blob(chunks.map((chunk) => copyToArrayBuffer(chunk)), { type: "application/zip" });
}

async function readFileContent(content: string | Blob): Promise<Uint8Array> {
  if (content instanceof Blob) {
    return new Uint8Array(await content.arrayBuffer());
  }

  return encoder.encode(content);
}

function createLocalHeader(entry: ZipEntry): Uint8Array {
  const path = encoder.encode(entry.path);
  const header = new Uint8Array(30 + path.byteLength);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, entry.crc, true);
  view.setUint32(18, entry.content.byteLength, true);
  view.setUint32(22, entry.content.byteLength, true);
  view.setUint16(26, path.byteLength, true);
  header.set(path, 30);
  return header;
}

function createCentralDirectoryHeader(entry: ZipEntry): Uint8Array {
  const path = encoder.encode(entry.path);
  const header = new Uint8Array(46 + path.byteLength);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, entry.crc, true);
  view.setUint32(20, entry.content.byteLength, true);
  view.setUint32(24, entry.content.byteLength, true);
  view.setUint16(28, path.byteLength, true);
  view.setUint32(42, entry.offset, true);
  header.set(path, 46);
  return header;
}

function createEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number): Uint8Array {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  return header;
}

function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
