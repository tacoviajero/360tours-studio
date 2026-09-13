import { spawn } from "node:child_process";
import { deflateSync } from "node:zlib";
import { chromium } from "@playwright/test";

const port = 4300 + Math.floor(Math.random() * 1000);
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

let finished = false;
let exitCode = 0;

try {
  await waitForServer(baseUrl, 120_000);
  await runChecks();
  finished = true;
  console.log("E2E checks passed: app shell, demo workflow, progress dashboard.");
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
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar tour" }).click();
    const download = await downloadPromise;
    if (download.suggestedFilename() !== "nuevo-tour.zip") {
      throw new Error(`Unexpected export filename: ${download.suggestedFilename()}`);
    }
    const archive = await readZipEntries(await download.path());
    assertZipEntries(archive, ["index.html", "tour.json", "viewer.css", "viewer.js", "vendor/marzipano.js", "panoramas/entrada-real.jpg"]);
    const tour = JSON.parse(new TextDecoder().decode(archive.get("tour.json")));
    if (tour.scenes.length !== 1 || tour.scenes[0].name !== "Entrada Real") {
      throw new Error("Exported tour.json does not contain the imported scene.");
    }
    await verifyExportedViewer(context, archive);
    await page.getByText("ZIP descargado.").waitFor({ state: "visible" });

    await page.getByRole("button", { name: "Cargar demo tecnico" }).click();
    await page.getByLabel("Preview del tour").getByRole("button", { name: "Ir a Sala" }).waitFor({ state: "visible" });
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
    await page.getByLabel("Avance general").getByText("67%").waitFor({ state: "visible" });
    await page.getByRole("heading", { name: "Plano de planta" }).waitFor({ state: "visible" });
    await page.getByRole("heading", { name: "Criterios de exito" }).waitFor({ state: "visible" });
  } finally {
    await browser.close();
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
