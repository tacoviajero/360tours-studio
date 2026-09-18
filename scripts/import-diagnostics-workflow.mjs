import { spawn } from "node:child_process";
import { deflateSync } from "node:zlib";
import { chromium } from "@playwright/test";

const port = 7300 + Math.floor(Math.random() * 1000);
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
  await runDiagnosticsWorkflow();
  console.log("Import diagnostics workflow passed: mixed valid, duplicate, and invalid files keep visible warnings.");
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  await killProcessTree(preview.pid);
  preview.stdout.destroy();
  preview.stderr.destroy();
}

process.exit(exitCode);

async function runDiagnosticsWorkflow() {
  const browser = await chromium.launch({ channel: "msedge" });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/`);
    await page.getByRole("heading", { name: "360Tours Studio" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Nuevo tour" }).click();
    await page.locator("#panorama-import").setInputFiles([
      {
        name: "van-001.jpg",
        mimeType: "image/jpeg",
        buffer: createPngFixture(1024, 512, 1)
      },
      {
        name: "van-002.jpg",
        mimeType: "image/jpeg",
        buffer: createPngFixture(1024, 512, 2)
      },
      {
        name: "van-002.jpg",
        mimeType: "image/jpeg",
        buffer: createPngFixture(1024, 512, 3)
      },
      {
        name: "not-a-panorama.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not an image")
      }
    ]);

    await page.getByText("2 escenas importadas. Se conectaron en linea automaticamente.").waitFor({ state: "visible" });
    const summary = page.getByLabel("Resumen de importacion");
    await summary.getByText("4 archivos", { exact: true }).waitFor({ state: "visible" });
    await summary.getByText("2 escenas", { exact: true }).waitFor({ state: "visible" });
    await summary.getByText("1 avisos", { exact: true }).waitFor({ state: "visible" });
    await summary.getByText("1 errores", { exact: true }).waitFor({ state: "visible" });
    await page.getByText("van-002.jpg esta duplicado en esta importacion.").waitFor({ state: "visible" });
    await page.getByText("not-a-panorama.txt no es un JPG compatible.").waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: /1\. Van 001/ }).waitFor({ state: "visible" });
    await page.getByLabel("Proyecto").getByRole("button", { name: /2\. Van 002/ }).waitFor({ state: "visible" });
  } finally {
    await browser.close();
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

function createPngFixture(width, height, seed) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const raw = Buffer.alloc((width * 3 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 3;
      raw[offset] = (x + seed * 23) % 256;
      raw[offset + 1] = (y * 2 + seed * 19) % 256;
      raw[offset + 2] = (90 + seed * 7) % 256;
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
