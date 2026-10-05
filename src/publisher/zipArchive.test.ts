import { describe, expect, it } from "vitest";
import { createZipArchive } from "./zipArchive";

describe("createZipArchive", () => {
  it("creates a readable zip with central directory entries", async () => {
    const progress: string[] = [];
    const archive = await createZipArchive(
      [
        { path: "index.html", content: "<h1>Tour</h1>", mimeType: "text/html" },
        { path: "assets/image.jpg", content: new Blob(["image"], { type: "image/jpeg" }), mimeType: "image/jpeg" }
      ],
      (_completed, _total, path) => progress.push(path)
    );
    const bytes = new Uint8Array(await archive.arrayBuffer());
    const text = new TextDecoder().decode(bytes);

    expect(archive.type).toBe("application/zip");
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(text).toContain("index.html");
    expect(text).toContain("assets/image.jpg");
    expect(progress).toEqual(["index.html", "assets/image.jpg"]);
  });
});
