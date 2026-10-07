import { describe, expect, it } from "vitest";
import type { Scene, TourProject } from "./tour";
import { findDirectionalHotspot, resolveArrivalYaw } from "./spatialNavigation";

const scene: Scene = {
  id: "centro",
  name: "Centro",
  panorama: "centro.jpg",
  initialView: { yaw: 0, pitch: 0, fov: 1.2 },
  hotspots: [
    { id: "frente", type: "scene", yaw: 0.2, pitch: 0, targetScene: "frente", label: "Frente" },
    { id: "atras", type: "scene", yaw: 3, pitch: 0, targetScene: "atras", label: "Atras" },
    { id: "lado", type: "scene", yaw: 1.5, pitch: 0, targetScene: "lado", label: "Lado" },
  ],
};

const project: TourProject = {
  schemaVersion: 1,
  id: "spatial-test",
  title: "Spatial test",
  startScene: "centro",
  settings: {},
  publish: { slug: "spatial-test" },
  floorplans: [],
  gallery: [],
  scenes: [
    scene,
    {
      id: "frente",
      name: "Frente",
      panorama: "frente.jpg",
      initialView: { yaw: 1, pitch: 0, fov: 1.2 },
      hotspots: [
        { id: "regreso", type: "scene", yaw: -0.5, pitch: 0, targetScene: "centro", label: "Regresar" },
      ],
    },
  ],
};

describe("spatial navigation", () => {
  it("uses the connection nearest to the viewing direction", () => {
    expect(findDirectionalHotspot(scene, 0, "forward")?.id).toBe("frente");
    expect(findDirectionalHotspot(scene, 0, "backward")?.id).toBe("atras");
  });

  it("uses the nearest available route even when it is outside the current view", () => {
    expect(findDirectionalHotspot({ ...scene, hotspots: [scene.hotspots[2]] }, 0, "forward")?.id).toBe("lado");
  });

  it("faces away from the reciprocal connection on arrival", () => {
    const forward = scene.hotspots[0];
    if (forward.type !== "scene") throw new Error("Expected a scene hotspot.");
    expect(resolveArrivalYaw(project, scene.id, forward)).toBeCloseTo(Math.PI - 0.5);
  });

  it("honors an explicit destination orientation", () => {
    const forward = scene.hotspots[0];
    if (forward.type !== "scene") throw new Error("Expected a scene hotspot.");
    expect(resolveArrivalYaw(project, scene.id, { ...forward, targetYaw: -1.25 })).toBeCloseTo(-1.25);
  });
});
