import { describe, expect, it } from "vitest";
import { processPanorama } from "./panoramaProcessing";

describe("processPanorama", () => {
  it("stops before decoding when an import was cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(processPanorama(new File(["jpeg"], "scene.jpg", { type: "image/jpeg" }), controller.signal)).rejects.toMatchObject({
      name: "AbortError"
    });
  });
});
