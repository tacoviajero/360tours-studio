import type { Scene } from "./tour";

export interface PanoramaFileMetadata {
  path: string;
  width: number;
  height: number;
  bytes: number;
  sha256?: string;
}

export interface PanoramaTileSetMetadata {
  width: number;
  height: number;
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  pathTemplate: string;
}

export interface PanoramaAssetsMetadata {
  original?: PanoramaFileMetadata;
  preview?: PanoramaFileMetadata;
  tiles?: PanoramaTileSetMetadata;
}

export function getPanoramaAssets(scene: Scene): PanoramaAssetsMetadata {
  const value = scene.metadata?.panoramaAssets;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as PanoramaAssetsMetadata;
}

export function setPanoramaAssets(scene: Scene, assets: PanoramaAssetsMetadata): void {
  scene.metadata = {
    ...scene.metadata,
    panoramaAssets: assets
  };
}

export function getOriginalPanoramaPath(scene: Scene): string | null {
  return getPanoramaAssets(scene).original?.path ?? null;
}

export function getPanoramaTilePath(tileSet: PanoramaTileSetMetadata, col: number, row: number): string {
  return tileSet.pathTemplate.replace("{col}", String(col)).replace("{row}", String(row));
}

export function collectPanoramaAssetPaths(scene: Scene): string[] {
  const assets = getPanoramaAssets(scene);
  const paths = [scene.panorama, scene.thumbnail, assets.original?.path, assets.preview?.path].filter(
    (path): path is string => Boolean(path)
  );
  if (assets.tiles) {
    for (let row = 0; row < assets.tiles.rows; row += 1) {
      for (let col = 0; col < assets.tiles.cols; col += 1) {
        paths.push(getPanoramaTilePath(assets.tiles, col, row));
      }
    }
  }
  return Array.from(new Set(paths));
}
