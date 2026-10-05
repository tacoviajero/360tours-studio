import { describe, expect, it } from "vitest";
import { formatBytes, planImportCapacity } from "./importPlanning";

describe("import planning", () => {
  it("estimates originals plus previews and high resolution tiles", async () => {
    const files = [{ size: 10_000_000 }, { size: 5_000_000 }] as File[];
    const plan = await planImportCapacity(files);

    expect(plan.sourceBytes).toBe(15_000_000);
    expect(plan.estimatedBytes).toBe(36_000_000);
    expect(plan.allowed).toBe(true);
  });

  it("formats capacity figures for the interface", () => {
    expect(formatBytes(1_500_000)).toBe("1.4 MB");
    expect(formatBytes(2 * 1024 ** 3)).toBe("2.00 GB");
  });
});
