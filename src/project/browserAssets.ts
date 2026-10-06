export interface StoredProjectAsset {
  projectId: string;
  sceneId: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  versionId?: string;
}

export interface StoredGenericAsset {
  projectId: string;
  path: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  versionId?: string;
}

export interface SnapshotAssetManifest {
  projectId: string;
  snapshotId: string;
  path: string;
  source: "scene" | "project" | "marker";
  sceneId?: string;
  fileName: string;
  mimeType: string;
  versionId: string;
}

export interface SnapshotAssetArchive {
  manifests: SnapshotAssetManifest[];
  versions: Array<{ versionId: string; blob: Blob }>;
}

interface StoredAssetVersion {
  versionId: string;
  blob: Blob;
}

export interface SceneAssetWrite {
  path: string;
  file: File;
}

export class BrowserProjectAssets {
  private readonly databaseName = "360tours-studio-assets";
  private readonly sceneStoreName = "scene-assets";
  private readonly assetStoreName = "project-assets";
  private readonly snapshotStoreName = "snapshot-assets";
  private readonly versionStoreName = "asset-versions";
  private readonly version = 3;

  async saveScenePanorama(projectId: string, sceneId: string, file: File): Promise<void> {
    const database = await this.openDatabase();
    await requestToPromise(
      database
        .transaction(this.sceneStoreName, "readwrite")
        .objectStore(this.sceneStoreName)
        .put({
          projectId,
          sceneId,
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
          blob: file
        } satisfies StoredProjectAsset)
    );
    database.close();
  }

  async loadScenePanorama(projectId: string, sceneId: string): Promise<StoredProjectAsset | null> {
    const database = await this.openDatabase();
    const asset = await requestToPromise<StoredProjectAsset | undefined>(
      database.transaction(this.sceneStoreName, "readonly").objectStore(this.sceneStoreName).get([projectId, sceneId])
    );
    database.close();
    return asset ?? null;
  }

  async saveProjectAsset(projectId: string, path: string, file: File): Promise<void> {
    const database = await this.openDatabase();
    await requestToPromise(
      database
        .transaction(this.assetStoreName, "readwrite")
        .objectStore(this.assetStoreName)
        .put({
          projectId,
          path,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          blob: file
        } satisfies StoredGenericAsset)
    );
    database.close();
  }

  async loadProjectAsset(projectId: string, path: string): Promise<StoredGenericAsset | null> {
    const database = await this.openDatabase();
    const asset = await requestToPromise<StoredGenericAsset | undefined>(
      database.transaction(this.assetStoreName, "readonly").objectStore(this.assetStoreName).get([projectId, path])
    );
    database.close();
    return asset ?? null;
  }

  async saveSnapshotAssets(projectId: string, snapshotId: string): Promise<void> {
    const database = await this.openDatabase();
    const sceneAssets = (
      await requestToPromise<StoredProjectAsset[]>(
        database.transaction(this.sceneStoreName, "readonly").objectStore(this.sceneStoreName).getAll()
      )
    ).filter((asset) => asset.projectId === projectId);
    const projectAssets = (
      await requestToPromise<StoredGenericAsset[]>(
        database.transaction(this.assetStoreName, "readonly").objectStore(this.assetStoreName).getAll()
      )
    ).filter((asset) => asset.projectId === projectId);

    const transaction = database.transaction(
      [this.sceneStoreName, this.assetStoreName, this.snapshotStoreName, this.versionStoreName],
      "readwrite"
    );
    const sceneStore = transaction.objectStore(this.sceneStoreName);
    const assetStore = transaction.objectStore(this.assetStoreName);
    const snapshotStore = transaction.objectStore(this.snapshotStoreName);
    const versionStore = transaction.objectStore(this.versionStoreName);

    if (sceneAssets.length === 0 && projectAssets.length === 0) {
      const versionId = createAssetVersionId();
      versionStore.put({ versionId, blob: new Blob([]) } satisfies StoredAssetVersion);
      snapshotStore.put({
        projectId,
        snapshotId,
        path: "@empty",
        source: "marker",
        fileName: "",
        mimeType: "application/octet-stream",
        versionId
      } satisfies SnapshotAssetManifest);
    }

    for (const asset of sceneAssets) {
      const versionId = asset.versionId ?? createAssetVersionId();
      if (!asset.versionId) sceneStore.put({ ...asset, versionId });
      versionStore.put({ versionId, blob: asset.blob } satisfies StoredAssetVersion);
      snapshotStore.put({
        projectId,
        snapshotId,
        path: sceneSnapshotPath(asset.sceneId),
        source: "scene",
        sceneId: asset.sceneId,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        versionId
      } satisfies SnapshotAssetManifest);
    }

    for (const asset of projectAssets) {
      const versionId = asset.versionId ?? createAssetVersionId();
      if (!asset.versionId) assetStore.put({ ...asset, versionId });
      versionStore.put({ versionId, blob: asset.blob } satisfies StoredAssetVersion);
      snapshotStore.put({
        projectId,
        snapshotId,
        path: asset.path,
        source: "project",
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        versionId
      } satisfies SnapshotAssetManifest);
    }

    await transactionToPromise(transaction);
    database.close();
  }

  async hasSnapshotAssets(projectId: string, snapshotId: string): Promise<boolean> {
    const database = await this.openDatabase();
    const manifests = await requestToPromise<SnapshotAssetManifest[]>(
      database.transaction(this.snapshotStoreName, "readonly").objectStore(this.snapshotStoreName).getAll()
    );
    database.close();
    return manifests.some((item) => item.projectId === projectId && item.snapshotId === snapshotId);
  }

  async restoreSnapshotAssets(projectId: string, snapshotId: string): Promise<void> {
    const database = await this.openDatabase();
    const manifests = (
      await requestToPromise<SnapshotAssetManifest[]>(
        database.transaction(this.snapshotStoreName, "readonly").objectStore(this.snapshotStoreName).getAll()
      )
    ).filter((item) => item.projectId === projectId && item.snapshotId === snapshotId);
    if (manifests.length === 0) {
      database.close();
      throw new Error("Este punto de recuperacion no contiene sus archivos de imagen.");
    }

    const versions = new Map(
      (await requestToPromise<StoredAssetVersion[]>(
        database.transaction(this.versionStoreName, "readonly").objectStore(this.versionStoreName).getAll()
      )).map((item) => [item.versionId, item])
    );
    if (manifests.some((item) => !versions.has(item.versionId))) {
      database.close();
      throw new Error("El punto de recuperacion esta incompleto y no se puede restaurar.");
    }

    const currentScenes = (
      await requestToPromise<StoredProjectAsset[]>(
        database.transaction(this.sceneStoreName, "readonly").objectStore(this.sceneStoreName).getAll()
      )
    ).filter((item) => item.projectId === projectId);
    const currentAssets = (
      await requestToPromise<StoredGenericAsset[]>(
        database.transaction(this.assetStoreName, "readonly").objectStore(this.assetStoreName).getAll()
      )
    ).filter((item) => item.projectId === projectId);
    const transaction = database.transaction([this.sceneStoreName, this.assetStoreName], "readwrite");
    const sceneStore = transaction.objectStore(this.sceneStoreName);
    const assetStore = transaction.objectStore(this.assetStoreName);
    for (const item of currentScenes) sceneStore.delete([item.projectId, item.sceneId]);
    for (const item of currentAssets) assetStore.delete([item.projectId, item.path]);

    for (const manifest of manifests) {
      const blob = versions.get(manifest.versionId)!.blob;
      if (manifest.source === "scene" && manifest.sceneId) {
        sceneStore.put({
          projectId,
          sceneId: manifest.sceneId,
          fileName: manifest.fileName,
          mimeType: manifest.mimeType,
          blob,
          versionId: manifest.versionId
        } satisfies StoredProjectAsset);
      } else if (manifest.source === "project") {
        assetStore.put({
          projectId,
          path: manifest.path,
          fileName: manifest.fileName,
          mimeType: manifest.mimeType,
          blob,
          versionId: manifest.versionId
        } satisfies StoredGenericAsset);
      }
    }
    await transactionToPromise(transaction);
    database.close();
  }

  async exportSnapshotAssets(projectId: string, snapshotIds: string[]): Promise<SnapshotAssetArchive> {
    const database = await this.openDatabase();
    const snapshotIdSet = new Set(snapshotIds);
    const manifests = (
      await requestToPromise<SnapshotAssetManifest[]>(
        database.transaction(this.snapshotStoreName, "readonly").objectStore(this.snapshotStoreName).getAll()
      )
    ).filter((item) => item.projectId === projectId && snapshotIdSet.has(item.snapshotId));
    const versionIds = new Set(manifests.map((item) => item.versionId));
    const versions = (
      await requestToPromise<StoredAssetVersion[]>(
        database.transaction(this.versionStoreName, "readonly").objectStore(this.versionStoreName).getAll()
      )
    ).filter((item) => versionIds.has(item.versionId));
    database.close();
    return { manifests, versions };
  }

  async importSnapshotAssets(archive: SnapshotAssetArchive): Promise<void> {
    if (archive.manifests.length === 0) return;
    const database = await this.openDatabase();
    const transaction = database.transaction([this.snapshotStoreName, this.versionStoreName], "readwrite");
    const snapshotStore = transaction.objectStore(this.snapshotStoreName);
    const versionStore = transaction.objectStore(this.versionStoreName);
    for (const version of archive.versions) versionStore.put(version);
    for (const manifest of archive.manifests) snapshotStore.put(manifest);
    await transactionToPromise(transaction);
    database.close();
  }

  async removeSnapshotAssets(projectId: string, snapshotId: string): Promise<void> {
    const database = await this.openDatabase();
    const manifests = await requestToPromise<SnapshotAssetManifest[]>(
      database.transaction(this.snapshotStoreName, "readonly").objectStore(this.snapshotStoreName).getAll()
    );
    const removed = manifests.filter((item) => item.projectId === projectId && item.snapshotId === snapshotId);
    const retainedVersionIds = new Set(
      manifests.filter((item) => item.projectId !== projectId || item.snapshotId !== snapshotId).map((item) => item.versionId)
    );
    const transaction = database.transaction([this.snapshotStoreName, this.versionStoreName], "readwrite");
    for (const item of removed) transaction.objectStore(this.snapshotStoreName).delete([item.projectId, item.snapshotId, item.path]);
    for (const versionId of new Set(removed.map((item) => item.versionId))) {
      if (!retainedVersionIds.has(versionId)) transaction.objectStore(this.versionStoreName).delete(versionId);
    }
    await transactionToPromise(transaction);
    database.close();
  }

  async replaceSceneAssets(projectId: string, sceneId: string, panorama: File, assets: SceneAssetWrite[]): Promise<void> {
    const database = await this.openDatabase();
    const existingAssets = (
      await requestToPromise<StoredGenericAsset[]>(
        database.transaction(this.assetStoreName, "readonly").objectStore(this.assetStoreName).getAll()
      )
    ).filter((asset) => asset.projectId === projectId && isSceneAssetPath(asset.path, sceneId));
    const transaction = database.transaction([this.sceneStoreName, this.assetStoreName], "readwrite");
    const sceneStore = transaction.objectStore(this.sceneStoreName);
    const assetStore = transaction.objectStore(this.assetStoreName);

    sceneStore.put({
      projectId,
      sceneId,
      fileName: panorama.name,
      mimeType: panorama.type || "image/jpeg",
      blob: panorama
    } satisfies StoredProjectAsset);
    for (const asset of existingAssets) assetStore.delete([asset.projectId, asset.path]);
    for (const asset of assets) {
      assetStore.put({
        projectId,
        path: asset.path,
        fileName: asset.file.name,
        mimeType: asset.file.type || "application/octet-stream",
        blob: asset.file
      } satisfies StoredGenericAsset);
    }

    await transactionToPromise(transaction);
    database.close();
  }

  async copySceneAssets(projectId: string, sourceSceneId: string, targetSceneId: string): Promise<void> {
    const database = await this.openDatabase();
    const sourcePanorama = await requestToPromise<StoredProjectAsset | undefined>(
      database.transaction(this.sceneStoreName, "readonly").objectStore(this.sceneStoreName).get([projectId, sourceSceneId])
    );
    const sourceAssets = (
      await requestToPromise<StoredGenericAsset[]>(
        database.transaction(this.assetStoreName, "readonly").objectStore(this.assetStoreName).getAll()
      )
    ).filter((asset) => asset.projectId === projectId && isSceneAssetPath(asset.path, sourceSceneId));

    if (!sourcePanorama || sourceAssets.length === 0) {
      database.close();
      throw new Error("No se encontraron todos los archivos de la escena original.");
    }

    const transaction = database.transaction([this.sceneStoreName, this.assetStoreName], "readwrite");
    transaction.objectStore(this.sceneStoreName).put({
      ...sourcePanorama,
      sceneId: targetSceneId,
      fileName: replaceSceneIdInPath(sourcePanorama.fileName, sourceSceneId, targetSceneId)
    } satisfies StoredProjectAsset);
    const assetStore = transaction.objectStore(this.assetStoreName);
    for (const asset of sourceAssets) {
      const path = replaceSceneIdInPath(asset.path, sourceSceneId, targetSceneId);
      assetStore.put({
        ...asset,
        path,
        fileName: path.split("/").pop() ?? asset.fileName
      } satisfies StoredGenericAsset);
    }

    await transactionToPromise(transaction);
    database.close();
  }

  async copyProjectAssets(sourceProjectId: string, targetProjectId: string): Promise<void> {
    const database = await this.openDatabase();
    const sceneAssets = (
      await requestToPromise<StoredProjectAsset[]>(
        database.transaction(this.sceneStoreName, "readonly").objectStore(this.sceneStoreName).getAll()
      )
    ).filter((asset) => asset.projectId === sourceProjectId);
    const projectAssets = (
      await requestToPromise<StoredGenericAsset[]>(
        database.transaction(this.assetStoreName, "readonly").objectStore(this.assetStoreName).getAll()
      )
    ).filter((asset) => asset.projectId === sourceProjectId);

    const transaction = database.transaction([this.sceneStoreName, this.assetStoreName], "readwrite");
    const sceneStore = transaction.objectStore(this.sceneStoreName);
    const assetStore = transaction.objectStore(this.assetStoreName);

    for (const asset of sceneAssets) {
      sceneStore.put({ ...asset, projectId: targetProjectId });
    }

    for (const asset of projectAssets) {
      assetStore.put({ ...asset, projectId: targetProjectId });
    }

    await transactionToPromise(transaction);
    database.close();
  }

  async removeProjectAssets(projectId: string): Promise<void> {
    const database = await this.openDatabase();
    const sceneAssets = (
      await requestToPromise<StoredProjectAsset[]>(
        database.transaction(this.sceneStoreName, "readonly").objectStore(this.sceneStoreName).getAll()
      )
    ).filter((asset) => asset.projectId === projectId);
    const projectAssets = (
      await requestToPromise<StoredGenericAsset[]>(
        database.transaction(this.assetStoreName, "readonly").objectStore(this.assetStoreName).getAll()
      )
    ).filter((asset) => asset.projectId === projectId);
    const snapshotAssets = (
      await requestToPromise<SnapshotAssetManifest[]>(
        database.transaction(this.snapshotStoreName, "readonly").objectStore(this.snapshotStoreName).getAll()
      )
    ).filter((asset) => asset.projectId === projectId);
    const allSnapshotAssets = await requestToPromise<SnapshotAssetManifest[]>(
      database.transaction(this.snapshotStoreName, "readonly").objectStore(this.snapshotStoreName).getAll()
    );
    const retainedVersionIds = new Set(allSnapshotAssets.filter((asset) => asset.projectId !== projectId).map((asset) => asset.versionId));

    const transaction = database.transaction(
      [this.sceneStoreName, this.assetStoreName, this.snapshotStoreName, this.versionStoreName],
      "readwrite"
    );
    const sceneStore = transaction.objectStore(this.sceneStoreName);
    const assetStore = transaction.objectStore(this.assetStoreName);

    for (const asset of sceneAssets) {
      sceneStore.delete([asset.projectId, asset.sceneId]);
    }

    for (const asset of projectAssets) {
      assetStore.delete([asset.projectId, asset.path]);
    }

    for (const asset of snapshotAssets) {
      transaction.objectStore(this.snapshotStoreName).delete([asset.projectId, asset.snapshotId, asset.path]);
      if (!retainedVersionIds.has(asset.versionId)) transaction.objectStore(this.versionStoreName).delete(asset.versionId);
    }

    await transactionToPromise(transaction);
    database.close();
  }

  async removeSceneAssets(projectId: string, sceneId: string): Promise<void> {
    const database = await this.openDatabase();
    const projectAssets = (
      await requestToPromise<StoredGenericAsset[]>(
        database.transaction(this.assetStoreName, "readonly").objectStore(this.assetStoreName).getAll()
      )
    ).filter(
      (asset) =>
        asset.projectId === projectId &&
        (asset.path.startsWith(`tiles/${sceneId}/`) || asset.path.endsWith(`/${sceneId}.jpg`) || asset.path.endsWith(`/${sceneId}.jpeg`))
    );
    const transaction = database.transaction([this.sceneStoreName, this.assetStoreName], "readwrite");
    transaction.objectStore(this.sceneStoreName).delete([projectId, sceneId]);
    const assetStore = transaction.objectStore(this.assetStoreName);
    for (const asset of projectAssets) assetStore.delete([asset.projectId, asset.path]);
    await transactionToPromise(transaction);
    database.close();
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, this.version);

      request.addEventListener("upgradeneeded", () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.sceneStoreName)) {
          database.createObjectStore(this.sceneStoreName, { keyPath: ["projectId", "sceneId"] });
        }
        if (!database.objectStoreNames.contains(this.assetStoreName)) {
          database.createObjectStore(this.assetStoreName, { keyPath: ["projectId", "path"] });
        }
        if (!database.objectStoreNames.contains(this.snapshotStoreName)) {
          database.createObjectStore(this.snapshotStoreName, { keyPath: ["projectId", "snapshotId", "path"] });
        }
        if (!database.objectStoreNames.contains(this.versionStoreName)) {
          database.createObjectStore(this.versionStoreName, { keyPath: "versionId" });
        }
      });

      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error ?? new Error("No se pudo abrir IndexedDB.")));
    });
  }
}

function createAssetVersionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sceneSnapshotPath(sceneId: string): string {
  return `@scene/${sceneId}`;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error("No se pudo completar la operacion local.")));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("No se pudo copiar los assets locales.")));
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("No se pudo copiar los assets locales.")));
  });
}

function isSceneAssetPath(path: string, sceneId: string): boolean {
  return (
    path === `previews/${sceneId}.jpg` ||
    path === `source/panoramas/${sceneId}.jpg` ||
    path === `thumbnails/${sceneId}.jpg` ||
    path.startsWith(`tiles/${sceneId}/`)
  );
}

function replaceSceneIdInPath(path: string, sourceSceneId: string, targetSceneId: string): string {
  if (path.startsWith(`tiles/${sourceSceneId}/`)) {
    return `tiles/${targetSceneId}/${path.slice(`tiles/${sourceSceneId}/`.length)}`;
  }
  return path.replace(`/${sourceSceneId}.jpg`, `/${targetSceneId}.jpg`);
}
