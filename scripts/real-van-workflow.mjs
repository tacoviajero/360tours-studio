import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
    await page.locator(".properties-panel .property-section > summary").filter({ hasText: /^Recorrido/ }).click();
    await page.getByLabel("Propiedades").getByText("Recorrido lineal completo", { exact: true }).waitFor({ state: "visible" });
    await page.locator(".action-menu > summary").click();
    await page.locator(".action-menu").getByRole("button", { name: "Preparar recorrido" }).click();
    await page.getByText("Tour rapido preparado: inicio y recorrido lineal listos.").waitFor({ state: "visible" });
    await page.getByLabel("Propiedades").getByRole("heading", { name: "Recorrido" }).waitFor({ state: "visible" });
    await page.getByLabel("Propiedades").getByText("Linea completa").first().waitFor({ state: "visible" });
    await assertCanvasHasPanoramaDetail(page, ".tour-canvas", "editor");
    await page.getByRole("button", { name: "Vista final" }).click();
    await page.getByRole("dialog", { name: "Vista final del tour" }).waitFor({ state: "visible" });
    await assertCanvasHasPanoramaDetail(page, ".final-preview-viewer canvas", "vista final WebGL");
    await page.keyboard.press("ArrowRight");
    await page.locator("[data-preview-scene].is-active").filter({ hasText: "20260917 094704 585" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Cerrar" }).click();

    await page.reload();
    await page.getByLabel("Proyecto").getByRole("button", { name: /1\. 20260917 094621 759/ }).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: /3\. 20260917 095036 680/ }).waitFor({ state: "visible" });
    await assertCanvasHasPanoramaDetail(page, ".tour-canvas", "editor despues de recargar");

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
      "vendor/three.module.js",
      "vendor/three.core.js",
      "vendor/photo-sphere-viewer.module.js",
      "vendor/equirectangular-tiles-adapter.module.js",
      "vendor/photo-sphere-viewer.css",
      "ABRIR_TOUR.cmd",
      "servidor-local.ps1",
      "LEEME.txt",
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
      if (scene.metadata?.panoramaAssets?.original?.width !== 8000 || scene.metadata?.panoramaAssets?.original?.height !== 4000) {
        throw new Error(`La escena no conserva metadata 8000x4000 del original: ${JSON.stringify(scene.metadata?.panoramaAssets)}`);
      }
      if (scene.metadata?.panoramaAssets?.tiles?.cols !== 8 || scene.metadata?.panoramaAssets?.tiles?.rows !== 4) {
        throw new Error(`La escena no genero la cuadricula 8x4 esperada: ${JSON.stringify(scene.metadata?.panoramaAssets?.tiles)}`);
      }
      if (scene.metadata?.processingMode !== "worker") {
        throw new Error(`La escena no se proceso en Web Worker: ${JSON.stringify(scene.metadata)}`);
      }
    }

    for (let index = 0; index < realPhotoPaths.length; index += 1) {
      const scene = tour.scenes[index];
      const exported = archive.get(scene.panorama);
      const original = await readFile(realPhotoPaths[index]);
      if (!exported || !Buffer.from(exported).equals(original)) {
        throw new Error(`El panorama exportado ${scene.panorama} no es identico al JPG original.`);
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
    await verifyWindowsLocalServer(archive);
    await verifyOriginalRecovery(page);
  } finally {
    await browser.close();
  }
}

async function verifyOriginalRecovery(page) {
  await page.evaluate(() => {
    const projectId = localStorage.getItem("360tours-project:last");
    const key = projectId ? `360tours-project:${projectId}` : "";
    const raw = key ? localStorage.getItem(key) : null;
    if (!raw) throw new Error("No se encontro el proyecto para probar recuperacion.");
    const project = JSON.parse(raw);
    for (const scene of project.scenes) {
      if (scene.metadata) delete scene.metadata.panoramaAssets;
    }
    localStorage.setItem(key, JSON.stringify(project));
  });
  await page.reload();
  const validationSummary = page
    .locator(".properties-panel .property-section > summary")
    .filter({ hasText: /^Validacion/ });
  const validationOpen = await validationSummary.evaluate((summary) => summary.parentElement?.open ?? false);
  if (!validationOpen) {
    await validationSummary.click();
  }
  await page.getByText(/Falta el panorama original de/).first().waitFor({ state: "visible" });
  await page.locator("#originals-recovery").setInputFiles(realPhotoPaths);
  await page.getByText("3 de 3 originales recuperados.", { exact: false }).waitFor({ state: "visible", timeout: 120_000 });
  await page.getByText(/Falta el panorama original de/).waitFor({ state: "hidden" });
}

async function assertCanvasHasPanoramaDetail(page, selector, label) {
  await page.locator(selector).first().waitFor({ state: "visible" });
  await page.waitForTimeout(700);
  const sample = await page.evaluate((selector) => {
    const canvas = document.querySelector(selector);
    if (!canvas) {
      return { hasCanvas: false, nonBlack: 0, avg: 0, colors: 0, horizontalDetail: 0, verticalDetail: 0 };
    }

    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 48;
    sampleCanvas.height = 48;
    const context = sampleCanvas.getContext("2d");
    context.drawImage(canvas, 0, 0, 48, 48);
    const data = context.getImageData(0, 0, 48, 48).data;
    let nonBlack = 0;
    let total = 0;
    let horizontalDetail = 0;
    let verticalDetail = 0;
    const colors = new Set();
    for (let index = 0; index < data.length; index += 4) {
      const value = data[index] + data[index + 1] + data[index + 2];
      total += value;
      if (value > 15) {
        nonBlack += 1;
      }
      colors.add(`${data[index] >> 4}:${data[index + 1] >> 4}:${data[index + 2] >> 4}`);

      const pixel = index / 4;
      const x = pixel % 48;
      const y = Math.floor(pixel / 48);
      if (x > 0) {
        horizontalDetail += colorDifference(data, index, index - 4);
      }
      if (y > 0) {
        verticalDetail += colorDifference(data, index, index - 48 * 4);
      }
    }
    return {
      hasCanvas: true,
      nonBlack,
      avg: total / (data.length / 4),
      colors: colors.size,
      horizontalDetail: horizontalDetail / (48 * 47),
      verticalDetail: verticalDetail / (48 * 47)
    };

    function colorDifference(pixels, left, right) {
      return (
        Math.abs(pixels[left] - pixels[right]) +
        Math.abs(pixels[left + 1] - pixels[right + 1]) +
        Math.abs(pixels[left + 2] - pixels[right + 2])
      );
    }
  }, selector);

  const invalid =
    !sample.hasCanvas ||
    sample.nonBlack < 1800 ||
    sample.avg < 45 ||
    sample.colors < 80 ||
    sample.horizontalDetail < 4 ||
    sample.verticalDetail < 4;
  if (invalid) {
    await mkdir("test-results", { recursive: true });
    await page.screenshot({ path: `test-results/real-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png` });
    throw new Error(`El canvas ${label} no parece un panorama reconocible: ${JSON.stringify(sample)}.`);
  }
}

async function verifyExportedViewer(context, archive) {
  const viewerPage = await context.newPage();
  const browserErrors = [];
  viewerPage.on("pageerror", (error) => browserErrors.push(error.message));
  viewerPage.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  viewerPage.on("response", (response) => {
    if (response.status() >= 400) browserErrors.push(`${response.status()} ${response.url()}`);
  });
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
  try {
    await viewerPage.getByRole("heading", { name: "Nuevo tour 360" }).waitFor({ state: "visible" });
  } catch (error) {
    await viewerPage.screenshot({ path: "test-results/real-export-viewer-failure.png" });
    throw new Error(`${error instanceof Error ? error.message : String(error)} Browser: ${browserErrors.join(" | ")}`);
  }
  await viewerPage.getByRole("button", { name: /20260917 094621 759/ }).waitFor({ state: "visible" });
  await viewerPage.getByRole("button", { name: /20260917 095036 680/ }).waitFor({ state: "visible" });
  await assertCanvasHasPanoramaDetail(viewerPage, ".viewer-canvas canvas", "exportado");
  await viewerPage.getByRole("button", { name: /20260917 094704 585/ }).click();
  await viewerPage.getByRole("button", { name: /20260917 094704 585/ }).waitFor({ state: "visible" });
  await viewerPage.close();
}

async function verifyWindowsLocalServer(archive) {
  if (process.platform !== "win32") return;

  const target = resolve("test-results", `real-export-local-${Date.now()}`);
  for (const [path, content] of archive) {
    const outputPath = join(target, ...path.split("/"));
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
  }

  const port = 8800 + Math.floor(Math.random() * 100);
  const server = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(target, "servidor-local.ps1")],
    {
      cwd: target,
      env: { ...process.env, TOUR_NO_BROWSER: "1", TOUR_PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const localUrl = `http://127.0.0.1:${port}`;
    await waitForServer(localUrl, 15_000);
    const [indexResponse, tourResponse] = await Promise.all([fetch(`${localUrl}/index.html`), fetch(`${localUrl}/tour.json`)]);
    if (!indexResponse.ok || !tourResponse.ok) {
      throw new Error(`El servidor local respondio index=${indexResponse.status}, tour=${tourResponse.status}.`);
    }
    const tour = await tourResponse.json();
    if (tour.scenes?.length !== 3) {
      throw new Error("El servidor local no entrego las tres escenas del tour real.");
    }
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)} ${stderr}`.trim());
  } finally {
    await killProcessTree(server.pid);
    if (server.exitCode === null) {
      await Promise.race([new Promise((resolveExit) => server.once("exit", resolveExit)), sleep(3_000)]);
    }
    try {
      await rm(target, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    } catch (error) {
      if (error?.code !== "EBUSY") throw error;
    }
  }
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
