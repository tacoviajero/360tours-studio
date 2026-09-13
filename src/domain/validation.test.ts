import { describe, expect, it } from "vitest";
import type { TourProject } from "./tour";
import { validateProject } from "./validation";

function createProject(): TourProject {
  return {
    schemaVersion: 1,
    id: "tour-test",
    title: "Tour Test",
    startScene: "entrada",
    settings: {},
    publish: { slug: "tour-test" },
    floorplans: [
      {
        id: "planta-baja",
        name: "Planta baja",
        image: "floorplans/planta-baja.png",
        markers: [{ id: "marker-entrada", sceneId: "entrada", x: 25, y: 40 }]
      }
    ],
    gallery: [{ id: "gallery-1", image: "gallery/fachada.jpg", caption: "Fachada" }],
    scenes: [
      {
        id: "entrada",
        name: "Entrada",
        panorama: "panoramas/entrada.jpg",
        initialView: { yaw: 0, pitch: 0, fov: 1.4 },
        hotspots: [{ id: "entrada-sala", type: "scene", yaw: 0.5, pitch: 0, targetScene: "sala", label: "Sala" }]
      },
      {
        id: "sala",
        name: "Sala",
        panorama: "panoramas/sala.jpg",
        initialView: { yaw: 0, pitch: 0, fov: 1.4 },
        hotspots: [{ id: "sala-entrada", type: "scene", yaw: -0.5, pitch: 0, targetScene: "entrada", label: "Entrada" }]
      }
    ]
  };
}

describe("validateProject", () => {
  it("accepts a connected project with floorplan and gallery without errors", () => {
    const issues = validateProject(createProject());

    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("flags broken scene references and invalid publish slugs", () => {
    const project = createProject();
    project.publish = { slug: "Tour Malo!" };
    project.scenes[0].hotspots = [
      { id: "broken-link", type: "scene", yaw: 0, pitch: 0, targetScene: "terraza", label: "Terraza" }
    ];
    project.floorplans[0].markers = [{ id: "broken-marker", sceneId: "terraza", x: 10, y: 10 }];

    const codes = validateProject(project).map((issue) => issue.code);

    expect(codes).toContain("publish.slugInvalid");
    expect(codes).toContain("hotspot.targetMissing");
    expect(codes).toContain("floorplan.sceneMissing");
  });
});
