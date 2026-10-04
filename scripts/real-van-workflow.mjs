import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { chromium } from "@playwright/test";

const realPhotoPaths = [
  "C:\\Users\\KLozk\\Documents\\TacoViajero\\Imagenes\\360Tours\\001 - Van 0.9\\Photos-1-001\\20260917_094621_759.jpg",
  "C:\\Users\\KLozk\\Documents\\TacoViajero\\Imagenes\\360Tours\\001 - Van 0.9\\Photos-1-001\\20260917_094704_585.jpg",
  "C:\\Users\\KLozk\\Documents\\TacoViajero\\Imagenes\\360Tours\\001 - Van 0.9\\Photos-1-001\\20260917_095036_680.jpg"
];

for (const photoPath of realPhotoPaths) {
  if (!existsSync(photoPath)) {
    throw new Error(`No existe la foto real requerida: ${photoPath}`);
  }
}

const port = 5300 + Math.floor(Math.random() * 1000);
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
  await runRealWorkflow();
  console.log("Real van workflow passed: import, autosave reload, linear links, export, exported viewer.");
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  await killProcessTree(preview.pid);
  preview.stdout.destroy();
  preview.stderr.destroy();
}

process.exit(exitCode);

async function runRealWorkflow() {
  const browser = await chromium.launch({ channel: "msedge" });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/`);
    await page.getByRole("heading", { name: "360Tours Studio" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Nuevo tour" }).click();
    await page.locator("#panorama-import").setInputFiles(realPhotoPaths);

    await page.getByLabel("Proyecto").getByRole("button", { name: /1\. 20260917 094621 759/ }).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: /2\. 20260917 094704 585/ }).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: /3\. 20260917 095036 680/ }).waitFor({ state: "visible" });
    await page.getByText("3 panoramas cargados.").waitFor({ state: "visible" });
    await page.getByLabel("Propiedades").getByText("Recorrido lineal completo", { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Preparar rapido" }).click();
    await page.getByText("Tour rapido preparado: inicio y recorrido lineal listos.").waitFor({ state: "visible" });
    await page.getByLabel("Propiedades").getByRole("heading", { name: "Recorrido" }).waitFor({ state: "visible" });
    await page.getByLabel("Propiedades").getByText("Linea completa").first().waitFor({ state: "visible" });
    await assertCanvasHasVisiblePixels(page, ".tour-canvas", "editor");

    await page.reload();
    await page.getByLabel("Proyecto").getByRole("button", { name: /1\. 20260917 094621 759/ }).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: /3\. 20260917 095036 680/ }).waitFor({ state: "visible" });
    await assertCanvasHasVisiblePixels(page, ".tour-canvas", "editor despues de recargar");

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
      "panoramas/20260917-094621-759.jpg",
      "panoramas/20260917-094704-585.jpg",
      "panoramas/20260917-095036-680.jpg"
    ]);

    const tour = JSON.parse(new TextDecoder().decode(archive.get("tour.json")));
    if (tour.scenes.length !== 3) {
      throw new Error(`Se esperaban 3 escenas en tour.json y llegaron ${tour.scenes.length}.`);
    }
    for (const scene of tour.scenes) {
      if (scene.metadata?.optimizedSize !== "2048x1024" || scene.metadata?.optimization?.resized !== true) {
        throw new Error(`La escena no trae metadata de optimizacion esperada: ${JSON.stringify(scene.metadata)}`);
      }
    }

    const manifest = JSON.parse(new TextDecoder().decode(archive.get("deploy-manifest.json")));
    if (!Array.isArray(manifest.panoramas) || manifest.panoramas.length !== 3) {
      throw new Error("El deploy-manifest no incluye metadata de los 3 panoramas.");
    }

    const sceneLinks = tour.scenes.flatMap((scene) => scene.hotspots.filter((hotspot) => hotspot.type === "scene"));
    if (sceneLinks.length < 4) {
      throw new Error(`El recorrido lineal necesita al menos 4 conexiones anterior/siguiente; llegaron ${sceneLinks.length}.`);
    }

    await verifyExportedViewer(context, archive);
  } finally {
    await browser.close();
  }
}

async function assertCanvasHasVisiblePixels(page, selector, label) {
  await page.locator(selector).first().waitFor({ state: "visible" });
  await page.waitForTimeout(700);
  const sample = await page.evaluate((selector) => {
    const canvas = document.querySelector(selector);
    if (!canvas) {
      return { hasCanvas: false, nonBlack: 0, avg: 0 };
    }

    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 48;
    sampleCanvas.height = 48;
    const context = sampleCanvas.getContext("2d");
    context.drawImage(canvas, 0, 0, 48, 48);
    const data = context.getImageData(0, 0, 48, 48).data;
    let nonBlack = 0;
    let total = 0;
    for (let index = 0; index < data.length; index += 4) {
      const value = data[index] + data[index + 1] + data[index + 2];
      total += value;
      if (value > 15) {
        nonBlack += 1;
      }
    }
    return { hasCanvas: true, nonBlack, avg: total / (data.length / 4) };
  }, selector);

  if (!sample.hasCanvas || sample.nonBlack < 500 || sample.avg < 20) {
    throw new Error(`El canvas ${label} no renderizo pixeles visibles suficientes: ${JSON.stringify(sample)}.`);
  }
}

async function verifyExportedViewer(context, archive) {
  const viewerPage = await context.newPage();
  await viewerPage.route("http://real-van-export.local/**", async (route) => {
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

  await viewerPage.goto("http://real-van-export.local/index.html");
  await viewerPage.getByRole("heading", { name: "Nuevo tour 360" }).waitFor({ state: "visible" });
  await viewerPage.getByRole("button", { name: /20260917 094621 759/ }).waitFor({ state: "visible" });
  await viewerPage.getByRole("button", { name: /20260917 095036 680/ }).waitFor({ state: "visible" });
  await assertCanvasHasVisiblePixels(viewerPage, ".viewer-canvas canvas", "exportado");
  await viewerPage.getByRole("button", { name: /20260917 094704 585/ }).click();
  await viewerPage.getByRole("button", { name: /20260917 094704 585/ }).waitFor({ state: "visible" });
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
    entries.set(name, compressionMethod === 8 ? deflateSafeInflate(compressed) : compressed);
    offset = contentStart + compressedSize;
  }

  return entries;
}

function deflateSafeInflate(content) {
  return inflateRawSync(content);
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
