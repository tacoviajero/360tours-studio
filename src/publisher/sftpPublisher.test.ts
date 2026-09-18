import { describe, expect, it } from "vitest";
import type { TourProject } from "../domain/tour";
import { createPublishManifest, createPublishPlan, publishTour } from "./sftpPublisher";

const project: TourProject = {
  schemaVersion: 1,
  id: "tour-publicacion",
  title: "Tour Publicacion",
  startScene: "entrada",
  settings: {},
  publish: { slug: "van-demo" },
  floorplans: [],
  gallery: [],
  scenes: [
    {
      id: "entrada",
      name: "Entrada",
      panorama: "panoramas/entrada.jpg",
      initialView: { yaw: 0, pitch: 0, fov: 1.2 },
      hotspots: []
    }
  ]
};

describe("sftpPublisher", () => {
  it("creates a safe temporary deploy plan with rollback paths", () => {
    const plan = createPublishPlan(
      project,
      {
        basePath: "/public_html/tours/",
        publicBaseUrl: "https://tacoviajero.com/tours/"
      },
      new Date("2026-09-18T12:34:56.000Z")
    );

    expect(plan).toMatchObject({
      slug: "van-demo",
      releaseId: "20260918123456",
      finalPath: "/public_html/tours/van-demo",
      temporaryPath: "/public_html/tours/.deploy/van-demo-20260918123456",
      rollbackPath: "/public_html/tours/.versions/van-demo/20260918123456",
      url: "https://tacoviajero.com/tours/van-demo/"
    });
    expect(plan.steps.map((step) => step.id)).toEqual([
      "upload-temporary",
      "verify-temporary",
      "backup-current",
      "activate-release",
      "verify-public"
    ]);
  });

  it("creates a manifest matching the deploy plan", () => {
    const plan = createPublishPlan(project, undefined, new Date("2026-09-18T12:34:56.000Z"));
    const manifest = createPublishManifest(project, ["viewer.js", "index.html", "tour.json"], plan);

    expect(manifest).toMatchObject({
      app: "360Tours Studio",
      slug: "van-demo",
      releaseId: "20260918123456",
      fileCount: 3,
      files: ["index.html", "tour.json", "viewer.js"],
      panoramas: [
        {
          id: "entrada",
          name: "Entrada",
          panorama: "panoramas/entrada.jpg"
        }
      ]
    });
  });

  it("does not publish until credentials are configured", async () => {
    const result = await publishTour(project);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("falta configurar cuenta SFTP");
    expect(result.plan?.steps).toHaveLength(5);
  });
});
