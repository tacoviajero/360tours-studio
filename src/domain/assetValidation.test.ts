import { describe, expect, it } from "vitest";
import type { TourProject } from "./tour";
import { validateProjectAssets } from "./assetValidation";

const project: TourProject = {
  schemaVersion: 1,
  id: "asset-test",
  title: "Asset Test",
  startScene: "entrada",
  settings: {},
  publish: { slug: "asset-test" },
  floorplans: [
    {
      id: "planta-baja",
      name: "Planta baja",
      image: "floorplans/planta-baja.png",
      markers: []
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
      hotspots: []
    }
  ]
};

describe("validateProjectAssets", () => {
  it("reports every missing local asset used by the project", async () => {
    const availableAssets = new Set(["panoramas/entrada.jpg", "thumbnails/entrada.jpg", "gallery/fachada.jpg"]);
    const issues = await validateProjectAssets(project, async (_project, assetPath) =>
      availableAssets.has(assetPath) ? new Blob(["asset"]) : null
    );

    expect(issues).toEqual([
      {
        severity: "error",
        code: "asset.missing",
        message: "Falta el archivo local usado por el tour: floorplans/planta-baja.png."
      }
    ]);
  });

  it("ignores remote assets because they are resolved by the browser", async () => {
    const remoteProject: TourProject = {
      ...project,
      floorplans: [],
      gallery: [],
      scenes: [{ ...project.scenes[0], panorama: "https://example.com/panorama.jpg", thumbnail: undefined }]
    };
    const issues = await validateProjectAssets(remoteProject, async () => null);

    expect(issues).toEqual([]);
  });
});
