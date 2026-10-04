import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { chromium } from "@playwright/test";

const port = 4300 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const progressPercent = await readProgressPercent();
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

let finished = false;
let exitCode = 0;

try {
  await waitForServer(baseUrl, 120_000);
  await runChecks();
  finished = true;
  console.log("E2E checks passed: guided flow, hotspot drag, editable backup, local recovery, export, and progress dashboard.");
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  await killProcessTree(preview.pid);
  preview.stdout.destroy();
  preview.stderr.destroy();
  if (!finished) {
    exitCode = 1;
  }
}

process.exit(exitCode);

async function runChecks() {
  const browser = await chromium.launch({ channel: "msedge" });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/`);
  await page.getByRole("heading", { name: "360Tours Studio" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Nuevo tour" }).click();
    await page.locator("#panorama-import").setInputFiles({
      name: "entrada-real.jpg",
      mimeType: "image/jpeg",
      buffer: createPngFixture(1024, 512)
    });
    await page.getByLabel("Proyecto").getByRole("button", { name: /1\. Entrada Real/ }).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").locator(".scene-item img").first().waitFor({ state: "visible" });
    await assertEditorCanvasHasPixels(page);
    await page.getByLabel("Progreso para crear el tour").getByText("2 de 4", { exact: true }).first().waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Confirmar escena actual" }).click();
    await page.getByLabel("Progreso para crear el tour").getByText("4 de 4", { exact: true }).first().waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Guardar snapshot" }).click();
    await page.getByRole("button", { name: "Snapshot guardado" }).waitFor({ state: "visible" });
    await page.evaluate(() => {
      const projectId = localStorage.getItem("360tours-project:last");
      if (!projectId) throw new Error("No last project to corrupt for recovery check.");
      localStorage.setItem(`360tours-project:${projectId}`, "{broken-json");
    });
    await page.reload();
    await page.getByText(/Se recupero el snapshot mas reciente/).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: /1\. Entrada Real/ }).waitFor({ state: "visible" });
    await assertEditorCanvasHasPixels(page);
    await page.evaluate(() => {
      const originalSetItem = Storage.prototype.setItem;
      window.__failLocalWrites = true;
      Storage.prototype.setItem = function (key, value) {
        if (window.__failLocalWrites && key.startsWith("360tours-project:")) {
          throw new DOMException("Storage full", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };
    });
    await page.locator("[data-field='project-title']").fill("Cambio sin guardar");
    await page.getByText(/No hay espacio local suficiente/).waitFor({ state: "visible" });
    await page.evaluate(() => {
      window.__failLocalWrites = false;
    });
    await page.locator("[data-field='project-title']").fill("Nuevo tour 360");
    await page.getByText("Guardado local.", { exact: true }).waitFor({ state: "visible" });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar tour" }).click();
    const download = await downloadPromise;
    if (download.suggestedFilename() !== "nuevo-tour.zip") {
      throw new Error(`Unexpected export filename: ${download.suggestedFilename()}`);
    }
    const archive = await readZipEntries(await download.path());
    assertZipEntries(archive, ["index.html", "tour.json", "deploy-manifest.json", "viewer.css", "viewer.js", "panoramas/entrada-real.jpg"]);
    const tour = JSON.parse(new TextDecoder().decode(archive.get("tour.json")));
    if (tour.scenes.length !== 1 || tour.scenes[0].name !== "Entrada Real") {
      throw new Error("Exported tour.json does not contain the imported scene.");
    }
    await verifyExportedViewer(context, archive);
    await page.getByText("ZIP descargado.").waitFor({ state: "visible" });
    const backupDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar respaldo" }).click();
    const backupDownload = await backupDownloadPromise;
    if (backupDownload.suggestedFilename() !== "nuevo-tour-respaldo.zip") {
      throw new Error(`Unexpected backup filename: ${backupDownload.suggestedFilename()}`);
    }
    const backup = await readZipEntries(await backupDownload.path());
    assertZipEntries(backup, ["project.json", "README.txt", "panoramas/entrada-real.jpg", "thumbnails/entrada-real.jpg"]);
    if (![...backup.keys()].some((path) => path.startsWith(".history/") && path.endsWith(".json"))) {
      throw new Error("Editable backup does not include snapshot history.");
    }

    await page.locator("#panorama-import").setInputFiles({
      name: "pasillo.jpg",
      mimeType: "image/jpeg",
      buffer: createPngFixture(1024, 512)
    });
    await page.getByLabel("Proyecto").getByRole("button", { name: /2\. Pasillo/ }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Preparar rapido" }).click();
    await page.getByRole("button", { name: "Mover al centro visible" }).first().click();
    const draggableHotspot = page.locator(".tour-hotspot-layer .hotspot--scene").first();
    await draggableHotspot.waitFor({ state: "visible" });
    const hotspotBefore = await readStoredHotspotPosition(page, "entrada-real");
    const hotspotBox = await draggableHotspot.boundingBox();
    if (!hotspotBox) throw new Error("The navigation hotspot has no visible bounds.");
    await page.mouse.move(hotspotBox.x + hotspotBox.width / 2, hotspotBox.y + hotspotBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(hotspotBox.x + hotspotBox.width / 2 + 48, hotspotBox.y + hotspotBox.height / 2 + 24, { steps: 5 });
    await page.mouse.up();
    await page.waitForFunction(
      ({ yaw, pitch }) => {
        const projectId = localStorage.getItem("360tours-project:last");
        const project = projectId ? JSON.parse(localStorage.getItem(`360tours-project:${projectId}`) ?? "null") : null;
        const hotspot = project?.scenes.find((scene) => scene.id === "entrada-real")?.hotspots.find((item) => item.type === "scene");
        return hotspot && (hotspot.yaw !== yaw || hotspot.pitch !== pitch);
      },
      hotspotBefore
    );

    await page.getByRole("button", { name: "Cargar demo tecnico" }).click();
    await page.getByLabel("Preview del tour").locator(".tour-canvas").waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: /1\. Entrada/ }).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: "2. Sala" }).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: "3. Cocina" }).waitFor({ state: "visible" });
    await page.getByLabel("Propiedades").getByRole("list").getByText("Aun no hay plano de planta.").waitFor({ state: "visible" });
    await page.getByLabel("Propiedades").getByRole("list").getByText("Aun no hay fotos de galeria.").waitFor({ state: "visible" });
    page.once("dialog", (dialog) => dialog.accept());
    const demoRecentItem = page.getByLabel("Proyecto").locator(".recent-item").filter({ hasText: "Demo 360Tours Studio" });
    await demoRecentItem.getByRole("button", { name: "Eliminar" }).click();
    await demoRecentItem.waitFor({ state: "detached" });

    await page.goto(`${baseUrl}/progress.html`);
    await page.getByRole("heading", { name: "Avance de 360Tours Studio" }).waitFor({ state: "visible" });
    await page.getByLabel("Avance general").getByText(`${progressPercent}%`).waitFor({ state: "visible" });
    await page.getByRole("heading", { name: "Plano de planta" }).waitFor({ state: "visible" });
    await page.getByRole("heading", { name: "Criterios de exito" }).waitFor({ state: "visible" });
  } finally {
    await browser.close();
  }
}

async function readStoredHotspotPosition(page, sceneId) {
  return page.evaluate((targetSceneId) => {
    const projectId = localStorage.getItem("360tours-project:last");
    const project = projectId ? JSON.parse(localStorage.getItem(`360tours-project:${projectId}`) ?? "null") : null;
    const hotspot = project?.scenes.find((scene) => scene.id === targetSceneId)?.hotspots.find((item) => item.type === "scene");
    if (!hotspot) throw new Error(`No scene hotspot found in ${targetSceneId}.`);
    return { yaw: hotspot.yaw, pitch: hotspot.pitch };
  }, sceneId);
}

async function readProgressPercent() {
  const source = await readFile(new URL("../src/progress/progress.ts", import.meta.url), "utf8");
  const values = Array.from(source.matchAll(/percent: (\d+)/g), (match) => Number(match[1]));
  if (values.length === 0) {
    throw new Error("No se pudo calcular el avance del tablero.");
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

async function assertEditorCanvasHasPixels(page) {
  await page.locator(".tour-canvas").waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  const sample = await page.evaluate(() => {
    const canvas = document.querySelector(".tour-canvas");
    if (!canvas) {
      return { hasCanvas: false, nonBlack: 0 };
    }

    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 48;
    sampleCanvas.height = 48;
    const context = sampleCanvas.getContext("2d");
    context.drawImage(canvas, 0, 0, 48, 48);
    const data = context.getImageData(0, 0, 48, 48).data;
    let nonBlack = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] + data[index + 1] + data[index + 2] > 15) {
        nonBlack += 1;
      }
    }
    return { hasCanvas: true, nonBlack };
  });

  if (!sample.hasCanvas || sample.nonBlack < 100) {
    throw new Error("Editor canvas did not render visible panorama pixels.");
  }
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

async function verifyExportedViewer(context, archive) {
  const viewerPage = await context.newPage();
  await viewerPage.route("http://export.local/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/+/, "") || "index.html";
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
  await viewerPage.goto("http://export.local/index.html");
  await viewerPage.getByRole("heading", { name: "Nuevo tour 360" }).waitFor({ state: "visible" });
  await viewerPage.getByRole("button", { name: "Entrada Real" }).waitFor({ state: "visible" });
  await viewerPage.locator(".viewer-canvas canvas").first().waitFor({ state: "visible" });
  await viewerPage.close();
}

async function readZipEntries(path) {
  if (!path) {
    throw new Error("Download did not provide a file path.");
  }

  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(path);
  const entries = new Map();
  let offset = 0;

  while (offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const compressionMethod = bytes.readUInt16LE(offset + 8);
    if (compressionMethod !== 0) {
      throw new Error("E2E zip reader only supports stored files.");
    }

    const compressedSize = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = bytes.subarray(nameStart, nameStart + nameLength).toString("utf8");
    entries.set(name, bytes.subarray(contentStart, contentStart + compressedSize));
    offset = contentStart + compressedSize;
  }

  return entries;
}

function assertZipEntries(entries, expectedPaths) {
  for (const path of expectedPaths) {
    if (!entries.has(path)) {
      throw new Error(`Missing exported file in ZIP: ${path}`);
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

function createPngFixture(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const raw = Buffer.alloc((width * 3 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 3;
      raw[offset] = Math.round((x / width) * 255);
      raw[offset + 1] = Math.round((y / height) * 190);
      raw[offset + 2] = 120;
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
