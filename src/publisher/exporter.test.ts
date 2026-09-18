import { describe, expect, it } from "vitest";
import type { TourProject } from "../domain/tour";
import { exportStaticTour } from "./exporter";

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
    const assets = new Map([
      ["panoramas/entrada.jpg", new Blob(["entrada"], { type: "image/jpeg" })],
      ["thumbnails/entrada.jpg", new Blob(["thumb"], { type: "image/jpeg" })],
      ["panoramas/sala.jpg", new Blob(["sala"], { type: "image/jpeg" })],
      ["floorplans/planta-baja.png", new Blob(["floor-a"], { type: "image/png" })],
      ["floorplans/planta-alta.png", new Blob(["floor-b"], { type: "image/png" })],
      ["gallery/fachada.jpg", new Blob(["gallery"], { type: "image/jpeg" })]
    ]);

    const result = await exportStaticTour(createProject(), async (_project, assetPath) => assets.get(assetPath) ?? null);
    const files = new Map(result.files.map((file) => [file.path, file]));
    const tourJson = JSON.parse(String(files.get("tour.json")?.content)) as TourProject;
    const viewerJs = String(files.get("viewer.js")?.content);

    expect(result.ok).toBe(true);
    expect(files.has("index.html")).toBe(true);
    expect(files.has("viewer.css")).toBe(true);
    expect(files.has("viewer.js")).toBe(true);
    expect(files.has("panoramas/entrada.jpg")).toBe(true);
    expect(files.has("thumbnails/entrada.jpg")).toBe(true);
    expect(files.has("panoramas/sala.jpg")).toBe(true);
    expect(files.has("floorplans/planta-baja.png")).toBe(true);
    expect(files.has("floorplans/planta-alta.png")).toBe(true);
    expect(files.has("gallery/fachada.jpg")).toBe(true);
    expect(tourJson.floorplans).toHaveLength(2);
    expect(viewerJs).toContain("floorplan-switcher");
    expect(viewerJs).toContain("data-floorplan-id");
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
