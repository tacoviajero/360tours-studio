import { describe, expect, it } from "vitest";
import type { TourProject } from "../domain/tour";
import { buildProjectFolder, collectAssetPaths, loadProjectFolder } from "./projectRepository";

const project: TourProject = {
  schemaVersion: 1,
  id: "tour-folder-test",
  title: "Tour Folder Test",
  startScene: "entrada",
  settings: {},
  publish: { slug: "tour-folder-test" },
  floorplans: [
    {
      id: "planta-baja",
      name: "Planta baja",
      image: "floorplans/planta-baja.png",
      markers: [{ id: "marker-entrada", sceneId: "entrada", x: 22, y: 44 }]
    },
    {
      id: "planta-alta",
      name: "Planta alta",
      image: "floorplans/planta-alta.png",
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

describe("projectRepository", () => {
  it("collects every local asset path and ignores remote URLs", () => {
    const paths = collectAssetPaths({
      ...project,
      scenes: [{ ...project.scenes[0], panorama: "https://example.com/remote.jpg" }]
    });

    expect(paths).toEqual([
      "thumbnails/entrada.jpg",
      "floorplans/planta-baja.png",
      "floorplans/planta-alta.png",
      "gallery/fachada.jpg"
    ]);
  });

  it("builds and loads an editable project folder with assets and history", async () => {
    const assets = new Map([
      ["panoramas/entrada.jpg", new Blob(["panorama"], { type: "image/jpeg" })],
      ["thumbnails/entrada.jpg", new Blob(["thumb"], { type: "image/jpeg" })],
      ["floorplans/planta-baja.png", new Blob(["floor-a"], { type: "image/png" })],
      ["floorplans/planta-alta.png", new Blob(["floor-b"], { type: "image/png" })],
      ["gallery/fachada.jpg", new Blob(["gallery"], { type: "image/jpeg" })]
    ]);

    const files = await buildProjectFolder(
      project,
      async (_project, assetPath) => assets.get(assetPath) ?? null,
      [{ id: "snap-1", projectId: project.id, title: "Snapshot", createdAt: "2026-09-12T00:00:00.000Z", sceneCount: 1 }],
      async () => project
    );
    const fileMap = new Map(files.map((file) => [file.path, file]));

    const loaded = await loadProjectFolder(
      async (path) => {
        const file = fileMap.get(path);
        if (!file) {
          return null;
        }

        const content = file.content instanceof Blob ? file.content : new Blob([file.content], { type: file.mimeType });
        return new File([content], path.split("/").pop() ?? path, { type: file.mimeType });
      },
      async (path) => files.filter((file) => file.path.startsWith(`${path}/`)).map((file) => file.path)
    );

    expect(fileMap.has("project.json")).toBe(true);
    expect(fileMap.has("README.txt")).toBe(true);
    expect(fileMap.has(".history/snap-1.json")).toBe(true);
    expect(loaded.project.title).toBe(project.title);
    expect(loaded.assetFiles.map((file) => file.path).sort()).toEqual(Array.from(assets.keys()).sort());
    expect(loaded.snapshots).toHaveLength(1);
  });
});
