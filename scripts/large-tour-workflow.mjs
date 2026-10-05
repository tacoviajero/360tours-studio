import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { deflateSync, inflateRawSync } from "node:zlib";
import { chromium } from "@playwright/test";

const SCENE_COUNT = 50;
const port = 6300 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const preview =
  process.platform === "win32"
    ? spawn(process.env.ComSpec ?? "cmd.exe", [
        "/d",
        "/s",
        "/c",
        `node .\\node_modules\\vite\\bin\\vite.js preview --host 127.0.0.1 --port ${port} --strictPort`
      ], {
        stdio: ["ignore", "pipe", "pipe"]
      })
    : spawn("node", ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
        stdio: ["ignore", "pipe", "pipe"]
      });

preview.stdout.on("data", (chunk) => process.stdout.write(`[preview] ${chunk}`));
preview.stderr.on("data", (chunk) => process.stderr.write(`[preview] ${chunk}`));

let exitCode = 0;

try {
  await waitForServer(baseUrl, 120_000);
  await runLargeWorkflow();
  console.log(`Large tour workflow passed: ${SCENE_COUNT} scenes import, autosave, quick route, export, viewer.`);
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  await killProcessTree(preview.pid);
  preview.stdout.destroy();
  preview.stderr.destroy();
}

process.exit(exitCode);

async function runLargeWorkflow() {
  const browser = await chromium.launch({ channel: "msedge" });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const files = Array.from({ length: SCENE_COUNT }, (_item, index) => {
      const number = String(index + 1).padStart(3, "0");
      return {
        name: `van-${number}.jpg`,
        mimeType: "image/jpeg",
        buffer: createPngFixture(512, 256, index)
      };
    });

    await page.goto(`${baseUrl}/`);
    await page.getByRole("heading", { name: "360Tours Studio" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Nuevo tour" }).click();
    await page.locator("#panorama-import").setInputFiles(files);

    await page.getByText(`${SCENE_COUNT} panoramas cargados.`).waitFor({ state: "visible", timeout: 120_000 });
    await page.getByRole("button", { name: "Preparar rapido" }).click();
    await page.getByText("Tour rapido preparado: inicio y recorrido lineal listos.").waitFor({ state: "visible" });
    await page.getByLabel("Resumen de escenas").getByText(`${SCENE_COUNT} escenas`, { exact: true }).waitFor({ state: "visible" });
    await page.getByLabel("Resumen de escenas").getByText(`${(SCENE_COUNT - 1) * 2} conexiones`, { exact: true }).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: /1\. Van 001/ }).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: /50\. Van 050/ }).waitFor({ state: "visible" });
    await page.locator("[data-field='scene-filter']").fill("050");
    await page.getByText(`1 de ${SCENE_COUNT} escenas coinciden.`).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: /50\. Van 050/ }).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: /1\. Van 001/ }).waitFor({ state: "hidden" });
    await page.locator("[data-field='scene-filter']").fill("");

    await page.reload();
    await page.getByLabel("Proyecto").getByRole("button", { name: /50\. Van 050/ }).waitFor({ state: "visible" });
    await assertEditorCacheBounded(page);

    await page.locator("[data-field='scene-filter']").fill("050");
    await page.getByLabel("Proyecto").getByRole("button", { name: /50\. Van 050/ }).click();
    await page.locator("[data-viewer][data-renderer-cache-size]").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector("[data-viewer]")?.dataset.rendererSceneId?.includes("van-050"));
    await assertEditorCacheBounded(page);
    await page.locator("[data-field='scene-filter']").fill("");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar tour" }).click();
    const download = await downloadPromise;
    const archive = await readZipEntries(await download.path());
    assertZipEntries(archive, [
      "index.html",
      "tour.json",
      "deploy-manifest.json",
      "viewer.css",
      "viewer.js",
      "panoramas/van-001.jpg",
      "panoramas/van-050.jpg",
      "previews/van-001.jpg",
      "tiles/van-001/0-0.jpg",
      "tiles/van-050/0-0.jpg"
    ]);

    const tour = JSON.parse(new TextDecoder().decode(archive.get("tour.json")));
    if (tour.scenes.length !== SCENE_COUNT) {
      throw new Error(`Se esperaban ${SCENE_COUNT} escenas y llegaron ${tour.scenes.length}.`);
    }

    const sceneLinks = tour.scenes.flatMap((scene) => scene.hotspots.filter((hotspot) => hotspot.type === "scene"));
    const expectedLinearLinks = (SCENE_COUNT - 1) * 2;
    if (sceneLinks.length !== expectedLinearLinks) {
      throw new Error(`Se esperaban ${expectedLinearLinks} conexiones lineales y llegaron ${sceneLinks.length}.`);
    }

    const manifest = JSON.parse(new TextDecoder().decode(archive.get("deploy-manifest.json")));
    if (manifest.fileCount < SCENE_COUNT + 4 || manifest.panoramas?.length !== SCENE_COUNT) {
      throw new Error(`Manifest incompleto para tour grande: ${JSON.stringify({ fileCount: manifest.fileCount, panoramas: manifest.panoramas?.length })}`);
    }

    await verifyExportedViewer(context, archive);
  } finally {
    await browser.close();
  }
}

async function assertEditorCacheBounded(page) {
  await page.waitForFunction(() => Number(document.querySelector("[data-viewer]")?.dataset.rendererCacheSize ?? 0) > 0);
  const cache = await page.locator("[data-viewer]").evaluate((element) => ({
    size: Number(element.dataset.rendererCacheSize),
    limit: Number(element.dataset.rendererCacheLimit)
  }));
  if (!cache.limit || cache.size > cache.limit) {
    throw new Error(`El editor excedio su cache de panoramas: ${JSON.stringify(cache)}`);
  }
}

async function verifyExportedViewer(context, archive) {
  const viewerPage = await context.newPage();
  const panoramaRequests = [];
  await viewerPage.route("http://large-tour-export.local/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/+/, "") || "index.html";
    if (path.startsWith("panoramas/") || path.startsWith("previews/") || path.startsWith("tiles/")) {
      panoramaRequests.push(path);
    }
    const content = archive.get(path);
    if (!content) {
      await route.fulfill({ status: 404, body: "Not found" });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: mimeTypeFor(path),
      body: Buffer.from(content)
    });
  });

  await viewerPage.goto("http://large-tour-export.local/index.html");
  await viewerPage.getByRole("button", { name: "Van 001" }).waitFor({ state: "visible" });
  await viewerPage.getByRole("button", { name: "Van 050" }).waitFor({ state: "visible" });
  await viewerPage.locator(".viewer-canvas canvas").first().waitFor({ state: "visible" });
  await viewerPage.waitForTimeout(400);
  if (!panoramaRequests.some((path) => path.includes("van-001"))) {
    throw new Error(`El viewer no cargo la escena inicial bajo demanda: ${panoramaRequests.join(", ")}`);
  }
  if (panoramaRequests.some((path) => path.includes("van-050"))) {
    throw new Error("El viewer cargo la escena 050 antes de seleccionarla; el tour grande no esta cargando bajo demanda.");
  }
  if (new Set(panoramaRequests).size > 12) {
    throw new Error(`El viewer pidio demasiados panoramas al inicio: ${panoramaRequests.join(", ")}`);
  }
  await viewerPage.getByRole("button", { name: "Van 050" }).click();
  await viewerPage.waitForFunction(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("van-050")));
  if (!panoramaRequests.some((path) => path.includes("van-050"))) {
    throw new Error("El viewer no cargo la escena 050 al seleccionarla.");
  }
  await viewerPage.getByRole("button", { name: "Van 050" }).waitFor({ state: "visible" });
  await viewerPage.close();
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await sleep(500);
    }
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killProcessTree(pid) {
  if (!pid) {
    return Promise.resolve();
  }

  if (process.platform !== "win32") {
    preview.kill("SIGTERM");
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2_000);
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    killer.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    killer.on("error", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function readZipEntries(path) {
  if (!path) {
    throw new Error("Download did not provide a file path.");
  }

  const bytes = await readFile(path);
  const entries = new Map();
  let offset = 0;

  while (offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const compressionMethod = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = bytes.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const compressed = bytes.subarray(contentStart, contentStart + compressedSize);
    entries.set(name, compressionMethod === 8 ? inflateRawSync(compressed) : compressed);
    offset = contentStart + compressedSize;
  }

  return entries;
}

function assertZipEntries(entries, expectedPaths) {
  for (const path of expectedPaths) {
    if (!entries.has(path)) {
      throw new Error(`Falta archivo exportado en ZIP: ${path}`);
    }
  }
}

function mimeTypeFor(path) {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".js")) return "text/javascript";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function createPngFixture(width, height, seed) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const raw = Buffer.alloc((width * 3 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 3;
      raw[offset] = (x + seed * 17) % 256;
      raw[offset + 1] = (y * 2 + seed * 11) % 256;
      raw[offset + 2] = (120 + seed * 5) % 256;
    }
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 2, 0, 0, 0])])),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  return Buffer.concat([u32(data.length), typeBuffer, data, u32(crc32(Buffer.concat([typeBuffer, data])))]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
