export const CURRENT_SCHEMA_VERSION = 1;

export type HotspotType = "scene" | "info" | "image" | "video" | "link";

export interface ViewState {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface BaseHotspot {
  id: string;
  type: HotspotType;
  yaw: number;
  pitch: number;
  label?: string;
}

export interface SceneHotspot extends BaseHotspot {
  type: "scene";
  targetScene: string;
}

export interface InfoHotspot extends BaseHotspot {
  type: "info";
  title: string;
  text: string;
}

export interface MediaHotspot extends BaseHotspot {
  type: "image" | "video" | "link";
  title?: string;
  url: string;
}

export type Hotspot = SceneHotspot | InfoHotspot | MediaHotspot;

export interface Scene {
  id: string;
  name: string;
  panorama: string;
  thumbnail?: string;
  initialView: ViewState;
  hotspots: Hotspot[];
  floorplanReference?: string;
  metadata?: Record<string, unknown>;
}

export interface FloorplanMarker {
  id: string;
  sceneId: string;
  x: number;
  y: number;
}

export interface Floorplan {
  id: string;
  name: string;
  image: string;
  markers: FloorplanMarker[];
}

export interface GalleryItem {
  id: string;
  image: string;
  caption?: string;
}

export interface PublishState {
  slug?: string;
  url?: string;
  lastPublishedAt?: string;
}

export interface TourProject {
  schemaVersion: 1;
  id: string;
  title: string;
  startScene: string | null;
  scenes: Scene[];
  floorplans: Floorplan[];
  gallery: GalleryItem[];
  settings: Record<string, unknown>;
  publish?: PublishState;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

