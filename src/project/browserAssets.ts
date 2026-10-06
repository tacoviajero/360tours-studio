export interface StoredProjectAsset {
  projectId: string;
  sceneId: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
}

export interface StoredGenericAsset {
  projectId: string;
  path: string;
  fileName: string;
  mimeType: string;
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
  private readonly version = 2;

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

    const transaction = database.transaction([this.sceneStoreName, this.assetStoreName], "readwrite");
    const sceneStore = transaction.objectStore(this.sceneStoreName);
    const assetStore = transaction.objectStore(this.assetStoreName);

    for (const asset of sceneAssets) {
      sceneStore.delete([asset.projectId, asset.sceneId]);
    }

    for (const asset of projectAssets) {
      assetStore.delete([asset.projectId, asset.path]);
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
      });

      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error ?? new Error("No se pudo abrir IndexedDB.")));
    });
  }
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
