import { beforeEach, describe, expect, it } from "vitest";
import type { TourProject } from "../domain/tour";
import { BrowserProjectStorage } from "./storage";

const project: TourProject = {
  schemaVersion: 1,
  id: "storage-test",
  title: "Storage Test",
  startScene: null,
  settings: {},
  publish: { slug: "storage-test" },
  floorplans: [],
  gallery: [],
  scenes: []
};

describe("BrowserProjectStorage", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new MemoryLocalStorage()
    });
  });

  it("removes a project, its recent entry, last pointer and snapshots", async () => {
    const storage = new BrowserProjectStorage();
    await storage.save(project);
    const snapshot = await storage.snapshot(project);

    await storage.remove(project.id);

    await expect(storage.load(project.id)).rejects.toThrow("Proyecto no encontrado.");
    await expect(storage.loadSnapshot(project.id, snapshot.id)).rejects.toThrow("Snapshot no encontrado.");
    await expect(storage.loadLast()).resolves.toBeNull();
    await expect(storage.list()).resolves.toEqual([]);
    await expect(storage.listSnapshots(project.id)).resolves.toEqual([]);
  });

  it("points the last project to the newest remaining project after deleting the active one", async () => {
    const storage = new BrowserProjectStorage();
    const olderProject = { ...project, id: "older-project", title: "Older Project" };
    const newerProject = { ...project, id: "newer-project", title: "Newer Project" };
    await storage.save(olderProject);
    await storage.save(newerProject);

    await storage.remove(newerProject.id);

    await expect(storage.loadLast()).resolves.toMatchObject({ id: olderProject.id });
    await expect(storage.list()).resolves.toEqual([
      expect.objectContaining({ id: olderProject.id, title: olderProject.title })
    ]);
  });

  it("recovers a corrupt current project from its newest valid snapshot", async () => {
    const storage = new BrowserProjectStorage();
    await storage.save(project);
    await storage.snapshot({ ...project, title: "Recovered Project" });
    localStorage.setItem("360tours-project:storage-test", "{broken-json");

    const recovery = await storage.recoverLast();

    expect(recovery.project?.title).toBe("Recovered Project");
    expect(recovery.warning).toContain("snapshot");
    expect(recovery.snapshotId).toBeTruthy();
  });

  it("preserves imported snapshot identity, date and asset state", async () => {
    const storage = new BrowserProjectStorage();
    const summary = await storage.snapshot(project, {
      id: "imported-snapshot",
      createdAt: "2026-09-12T00:00:00.000Z",
      assetState: "complete"
    });

    expect(summary).toMatchObject({
      id: "imported-snapshot",
      createdAt: "2026-09-12T00:00:00.000Z",
      assetState: "complete"
    });
    await expect(storage.listSnapshots(project.id)).resolves.toEqual([summary]);
  });

  it("removes one snapshot without touching the project", async () => {
    const storage = new BrowserProjectStorage();
    await storage.save(project);
    const snapshot = await storage.snapshot(project);

    await storage.removeSnapshot(project.id, snapshot.id);

    await expect(storage.load(project.id)).resolves.toMatchObject({ id: project.id });
    await expect(storage.loadSnapshot(project.id, snapshot.id)).rejects.toThrow("Snapshot no encontrado.");
  });

  it("ignores corrupt indexes and reports storage write failures", async () => {
    const storage = new BrowserProjectStorage();
    localStorage.setItem("360tours-project:index", "not-json");
    await expect(storage.list()).resolves.toEqual([]);

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new FailingLocalStorage()
    });
    await expect(storage.save(project)).rejects.toThrow("Los cambios siguen abiertos");
  });
});

class MemoryLocalStorage {
  protected values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class FailingLocalStorage extends MemoryLocalStorage {
  override setItem(): void {
    throw new DOMException("Storage full", "QuotaExceededError");
  }
}
