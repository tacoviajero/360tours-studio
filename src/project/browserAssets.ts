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
