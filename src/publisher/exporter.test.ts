import { describe, expect, it } from "vitest";
import type { TourProject } from "../domain/tour";
import { exportStaticTour } from "./exporter";
import { calculateSha256 } from "../importers/imageProcessing";

function createProject(): TourProject {
  return {
    schemaVersion: 1,
    id: "tour-export-test",
    title: "Tour Export Test",
    startScene: "entrada",
    settings: {},
    publish: { slug: "tour-export-test" },
    floorplans: [
      {
        id: "planta-baja",
        name: "Planta baja",
        image: "floorplans/planta-baja.png",
        markers: [{ id: "marker-entrada", sceneId: "entrada", x: 20, y: 50 }]
      },
      {
        id: "planta-alta",
        name: "Planta alta",
        image: "floorplans/planta-alta.png",
        markers: [{ id: "marker-sala", sceneId: "sala", x: 60, y: 35 }]
      }
    ],
    gallery: [{ id: "gallery-1", image: "gallery/fachada.jpg", caption: "Fachada" }],
    scenes: [
      {
        id: "entrada",
        name: "Entrada",
        panorama: "panoramas/entrada.jpg",
        thumbnail: "thumbnails/entrada.jpg",
        initialView: { yaw: 0, pitch: 0, fov: 1.4 },
        hotspots: [{ id: "entrada-sala", type: "scene", yaw: 0.4, pitch: 0, targetScene: "sala", label: "Sala" }]
      },
      {
        id: "sala",
        name: "Sala",
        panorama: "panoramas/sala.jpg",
        initialView: { yaw: 0, pitch: 0, fov: 1.4 },
        hotspots: [{ id: "sala-entrada", type: "scene", yaw: -0.4, pitch: 0, targetScene: "entrada", label: "Entrada" }]
      }
    ]
  };
}

describe("exportStaticTour", () => {
  it("exports viewer files, assets, and multi-floor viewer controls", async () => {
    const progress: string[] = [];
    const assets = new Map([
      ["panoramas/entrada.jpg", new Blob(["entrada"], { type: "image/jpeg" })],
      ["thumbnails/entrada.jpg", new Blob(["thumb"], { type: "image/jpeg" })],
      ["panoramas/sala.jpg", new Blob(["sala"], { type: "image/jpeg" })],
      ["floorplans/planta-baja.png", new Blob(["floor-a"], { type: "image/png" })],
      ["floorplans/planta-alta.png", new Blob(["floor-b"], { type: "image/png" })],
      ["gallery/fachada.jpg", new Blob(["gallery"], { type: "image/jpeg" })]
    ]);

    const result = await exportStaticTour(
      createProject(),
      async (_project, assetPath) => assets.get(assetPath) ?? null,
      (_completed, _total, label) => progress.push(label)
    );
    const files = new Map(result.files.map((file) => [file.path, file]));
    const tourJson = JSON.parse(String(files.get("tour.json")?.content)) as TourProject;
    const viewerJs = String(files.get("viewer.js")?.content);

    expect(result.ok).toBe(true);
    expect(files.has("index.html")).toBe(true);
    expect(files.has("deploy-manifest.json")).toBe(true);
    expect(files.has("viewer.css")).toBe(true);
    expect(files.has("viewer.js")).toBe(true);
    expect(files.has("vendor/three.module.js")).toBe(true);
    expect(files.has("vendor/three.core.js")).toBe(true);
    expect(files.has("vendor/photo-sphere-viewer.module.js")).toBe(true);
    expect(files.has("vendor/equirectangular-tiles-adapter.module.js")).toBe(true);
    expect(files.has("vendor/photo-sphere-viewer.css")).toBe(true);
    expect(files.has("ABRIR_TOUR.cmd")).toBe(true);
    expect(files.has("servidor-local.ps1")).toBe(true);
    expect(files.has("LEEME.txt")).toBe(true);
    expect(files.has("panoramas/entrada.jpg")).toBe(true);
    expect(files.has("thumbnails/entrada.jpg")).toBe(true);
    expect(files.has("panoramas/sala.jpg")).toBe(true);
    expect(files.has("floorplans/planta-baja.png")).toBe(true);
    expect(files.has("floorplans/planta-alta.png")).toBe(true);
    expect(files.has("gallery/fachada.jpg")).toBe(true);
    expect(tourJson.floorplans).toHaveLength(2);
    expect(JSON.parse(String(files.get("deploy-manifest.json")?.content))).toMatchObject({
      app: "360Tours Studio",
      slug: "tour-export-test",
      url: "https://tacoviajero.com/tours/tour-export-test/",
      finalPath: "/tours/tour-export-test",
      temporaryPath: expect.stringContaining("/tours/.deploy/tour-export-test-"),
      rollbackPath: expect.stringContaining("/tours/.versions/tour-export-test/"),
      fileCount: expect.any(Number),
      steps: expect.any(Array)
    });
    expect(viewerJs).toContain("floorplan-switcher");
    expect(viewerJs).toContain("data-floorplan-id");
    expect(viewerJs).toContain("EquirectangularTilesAdapter");
    expect(viewerJs).toContain("WebGlTourViewer");
    expect(viewerJs).toContain('event.key === "ArrowRight"');
    expect(viewerJs).toContain("viewer-loading");
    expect(viewerJs).toContain("Reintentar");
    expect(viewerJs).toContain('window.location.protocol === "file:"');
    expect(viewerJs).toContain("ABRIR_TOUR.cmd");
    expect(String(files.get("servidor-local.ps1")?.content)).toContain("System.Net.Sockets.TcpListener");
    expect(String(files.get("servidor-local.ps1")?.content)).toContain("Google\\Chrome\\Application\\chrome.exe");
    expect(progress.at(-1)).toBe("Sala lista");
  });

  it("exports the byte-identical original instead of the editor preview", async () => {
    const original = new Blob(["original-8k-data"], { type: "image/jpeg" });
    const preview = new Blob(["small-preview"], { type: "image/jpeg" });
    const project = createProject();
    project.scenes = [
      {
        ...project.scenes[0],
        panorama: "previews/entrada.jpg",
        thumbnail: undefined,
        hotspots: [],
        metadata: {
          panoramaAssets: {
            original: {
              path: "source/panoramas/entrada.jpg",
              width: 8000,
              height: 4000,
              bytes: original.size,
              sha256: await calculateSha256(original)
            },
            preview: { path: "previews/entrada.jpg", width: 2048, height: 1024, bytes: preview.size }
          }
        }
      }
    ];
    project.startScene = "entrada";
    project.floorplans = [];
    project.gallery = [];
    const assets = new Map([
      ["source/panoramas/entrada.jpg", original],
      ["previews/entrada.jpg", preview]
    ]);

    const result = await exportStaticTour(project, async (_project, assetPath) => assets.get(assetPath) ?? null);
    const files = new Map(result.files.map((file) => [file.path, file]));
    const exported = files.get("panoramas/entrada.jpg")?.content as Blob;
    const exportedProject = JSON.parse(String(files.get("tour.json")?.content)) as TourProject;

    expect(result.ok).toBe(true);
    expect(await exported.text()).toBe("original-8k-data");
    expect(await calculateSha256(exported)).toBe(await calculateSha256(original));
    expect(exportedProject.scenes[0].panorama).toBe("panoramas/entrada.jpg");
    expect(exportedProject.scenes[0].metadata?.panoramaAssets).toMatchObject({
      original: { width: 8000, height: 4000, bytes: original.size }
    });
  });

  it("blocks export when the project has validation errors", async () => {
    const project = createProject();
    project.startScene = "missing-scene";

    const result = await exportStaticTour(project);

    expect(result.ok).toBe(false);
    expect(result.files).toEqual([]);
    expect(result.messages.join(" ")).toContain("escena inicial");
  });
});
