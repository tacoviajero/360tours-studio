import { describe, expect, it } from "vitest";
import type { Hotspot, TourProject } from "./tour";
import { normalizeProjectSceneConnections, normalizeSceneConnections, replaceSceneConnection } from "./sceneConnections";

const automatic: Hotspot = {
  id: "auto-next-cocina",
  type: "scene",
  yaw: 1.57,
  pitch: 0,
  targetScene: "cocina",
  label: "Ir a Cocina"
};

const manual: Hotspot = {
  id: "link-123",
  type: "scene",
  yaw: -0.45,
  pitch: 0.08,
  targetScene: "cocina",
  label: "Puerta a Cocina"
};

describe("scene connections", () => {
  it("prefers a manual connection over an automatic placeholder", () => {
    const normalized = normalizeSceneConnections([automatic, manual]);

    expect(normalized.removedCount).toBe(1);
    expect(normalized.hotspots).toEqual([manual]);
  });

  it("keeps the newest manual connection for the same destination", () => {
    const latest = { ...manual, id: "link-456", yaw: 0.75 };
    const normalized = normalizeSceneConnections([manual, latest]);

    expect(normalized.hotspots).toEqual([latest]);
  });

  it("replaces every previous connection to the selected destination", () => {
    const info: Hotspot = { id: "info-1", type: "info", yaw: 0, pitch: 0, title: "Nota", text: "Texto" };

    expect(replaceSceneConnection([automatic, info], manual)).toEqual([info, manual]);
  });

  it("cleans every scene without changing unrelated points", () => {
    const project: TourProject = {
      schemaVersion: 1,
      id: "tour",
      title: "Tour",
      startScene: "sala",
      settings: {},
      floorplans: [],
      gallery: [],
      scenes: [
        {
          id: "sala",
          name: "Sala",
          panorama: "sala.jpg",
          initialView: { yaw: 0, pitch: 0, fov: 1.2 },
          hotspots: [automatic, manual]
        }
      ]
    };

    const normalized = normalizeProjectSceneConnections(project);

    expect(normalized.removedCount).toBe(1);
    expect(normalized.project.scenes[0].hotspots).toEqual([manual]);
  });
});
