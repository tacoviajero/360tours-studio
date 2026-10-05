import type { TourProject } from "../domain/tour";
import { getOriginalPanoramaPath, getPanoramaAssets, getPanoramaTilePath } from "../domain/panoramaAssets";
import { validateProject } from "../domain/validation";
import { createPublishManifest } from "./sftpPublisher";
import photoSphereViewerSource from "../../node_modules/@photo-sphere-viewer/core/index.module.js?raw";
import photoSphereViewerCss from "../../node_modules/@photo-sphere-viewer/core/index.css?raw";
import photoSphereTilesSource from "../../node_modules/@photo-sphere-viewer/equirectangular-tiles-adapter/index.module.js?raw";
import threeSource from "../../node_modules/three/build/three.module.js?raw";
import threeCoreSource from "../../node_modules/three/build/three.core.js?raw";
import photoSphereViewerLicense from "../../node_modules/@photo-sphere-viewer/core/LICENSE?raw";
import threeLicense from "../../node_modules/three/LICENSE?raw";
import { calculateSha256 } from "../importers/imageProcessing";

export interface StaticTourFile {
  path: string;
  content: string | Blob;
  mimeType: string;
}

export interface ExportResult {
  ok: boolean;
  messages: string[];
  files: StaticTourFile[];
}

export type AssetResolver = (project: TourProject, assetPath: string) => Promise<Blob | null>;

export async function exportStaticTour(project: TourProject, resolveAsset?: AssetResolver): Promise<ExportResult> {
  const errors = validateProject(project).filter((issue) => issue.severity === "error");

  if (errors.length > 0) {
    return {
      ok: false,
      messages: errors.map((issue) => issue.message),
      files: []
    };
  }

  const files: StaticTourFile[] = [];
  const integrityErrors: string[] = [];
  const publishedProject: TourProject = {
    ...project,
    scenes: await Promise.all(
      project.scenes.map(async (scene) => {
        const panoramaAssets = getPanoramaAssets(scene);
        const originalPath = getOriginalPanoramaPath(scene) ?? scene.panorama;
        const asset = await resolveAsset?.(project, originalPath);
        const previewAsset = panoramaAssets.preview ? await resolveAsset?.(project, panoramaAssets.preview.path) : null;
        const thumbnailAsset = scene.thumbnail ? await resolveAsset?.(project, scene.thumbnail) : null;
        if (thumbnailAsset && scene.thumbnail) {
          files.push({ path: scene.thumbnail, content: thumbnailAsset, mimeType: thumbnailAsset.type || "image/jpeg" });
        }

        if (!asset) {
          return scene;
        }

        if (panoramaAssets.original?.sha256 && (await calculateSha256(asset)) !== panoramaAssets.original.sha256) {
          integrityErrors.push(`El panorama original de ${scene.name} no coincide con el archivo importado.`);
          return scene;
        }

        const extension = mimeToExtension(asset.type);
        const path = `panoramas/${scene.id}.${extension}`;
        files.push({ path, content: asset, mimeType: asset.type || "image/jpeg" });
        const publishedAssets = structuredClone(panoramaAssets);
        if (publishedAssets.original) publishedAssets.original.path = path;
        if (previewAsset && publishedAssets.preview) {
          const previewPath = `previews/${scene.id}.jpg`;
          publishedAssets.preview.path = previewPath;
          files.push({ path: previewPath, content: previewAsset, mimeType: previewAsset.type || "image/jpeg" });
        }
        if (publishedAssets.tiles) {
          for (let row = 0; row < publishedAssets.tiles.rows; row += 1) {
            for (let col = 0; col < publishedAssets.tiles.cols; col += 1) {
              const sourcePath = getPanoramaTilePath(panoramaAssets.tiles!, col, row);
              const tileAsset = await resolveAsset?.(project, sourcePath);
              if (tileAsset) files.push({ path: sourcePath, content: tileAsset, mimeType: tileAsset.type || "image/jpeg" });
            }
          }
        }
        return {
          ...scene,
          panorama: path,
          metadata: { ...scene.metadata, panoramaAssets: publishedAssets }
        };
      })
    ),
    floorplans: await Promise.all(
      project.floorplans.map(async (floorplan) => {
        const asset = await resolveAsset?.(project, floorplan.image);
        if (asset) {
          files.push({ path: floorplan.image, content: asset, mimeType: asset.type || "image/jpeg" });
        }
        return floorplan;
      })
    ),
    gallery: await Promise.all(
      project.gallery.map(async (item) => {
        const asset = await resolveAsset?.(project, item.image);
        if (asset) {
          files.push({ path: item.image, content: asset, mimeType: asset.type || "image/jpeg" });
        }
        return item;
      })
    )
  };

  if (integrityErrors.length > 0) {
    return { ok: false, messages: integrityErrors, files: [] };
  }

  const localSupportFiles: StaticTourFile[] = [
    { path: "ABRIR_TOUR.cmd", content: localLauncherCmd, mimeType: "text/plain" },
    { path: "servidor-local.ps1", content: localServerPowerShell, mimeType: "text/plain" },
    { path: "LEEME.txt", content: localReadme, mimeType: "text/plain" },
    { path: "vendor/three.module.js", content: threeSource, mimeType: "text/javascript" },
    { path: "vendor/three.core.js", content: threeCoreSource, mimeType: "text/javascript" },
    { path: "vendor/photo-sphere-viewer.module.js", content: photoSphereViewerSource, mimeType: "text/javascript" },
    { path: "vendor/equirectangular-tiles-adapter.module.js", content: photoSphereTilesSource, mimeType: "text/javascript" },
    { path: "vendor/photo-sphere-viewer.css", content: photoSphereViewerCss, mimeType: "text/css" },
    { path: "vendor/LICENSE-photo-sphere-viewer.txt", content: photoSphereViewerLicense, mimeType: "text/plain" },
    { path: "vendor/LICENSE-three.txt", content: threeLicense, mimeType: "text/plain" }
  ];
  const manifest = createPublishManifest(publishedProject, [
    "index.html",
    "tour.json",
    "viewer.css",
    "viewer.js",
    ...localSupportFiles.map((file) => file.path),
    ...files.map((file) => file.path)
  ]);

  files.unshift(
    { path: "index.html", content: renderIndexHtml(project.title), mimeType: "text/html" },
    { path: "tour.json", content: JSON.stringify(publishedProject, null, 2), mimeType: "application/json" },
    { path: "deploy-manifest.json", content: JSON.stringify(manifest, null, 2), mimeType: "application/json" },
    { path: "viewer.css", content: viewerCss, mimeType: "text/css" },
    { path: "viewer.js", content: viewerJs, mimeType: "text/javascript" },
    ...localSupportFiles
  );

  return {
    ok: true,
    messages: [`Export listo: ${files.length} archivos para ${project.title}.`],
    files
  };
}

function renderIndexHtml(title: string): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="./vendor/photo-sphere-viewer.css" />
    <link rel="stylesheet" href="./viewer.css" />
    <script type="importmap">
      {
        "imports": {
          "three": "./vendor/three.module.js",
          "@photo-sphere-viewer/core": "./vendor/photo-sphere-viewer.module.js",
          "@photo-sphere-viewer/equirectangular-tiles-adapter": "./vendor/equirectangular-tiles-adapter.module.js"
        }
      }
    </script>
  </head>
  <body>
    <div id="tour"></div>
    <script type="module" src="./viewer.js"></script>
  </body>
</html>
`;
}

const viewerCss = `:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #08080a;
  color: #f7f2ea;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  overflow: hidden;
}

#tour,
.tour-viewer {
  width: 100vw;
  height: 100vh;
}

.viewer-canvas {
  position: absolute;
  inset: 0;
  background: #050507;
}

.viewer-canvas > .psv-container {
  width: 100%;
  height: 100%;
}

.viewer-canvas canvas {
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
}

.viewer-canvas canvas:active {
  cursor: grabbing;
}

.local-open-help {
  display: grid;
  place-content: center;
  gap: 12px;
  width: min(620px, calc(100vw - 40px));
  min-height: 100vh;
  margin: 0 auto;
  text-align: center;
}

.local-open-help h1,
.local-open-help p {
  margin: 0;
}

.local-open-help p {
  color: #d8d0c7;
  line-height: 1.55;
}

.viewer-hotspot-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.viewer-hotspot-layer .hotspot {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: auto;
}

.tour-menu {
  position: fixed;
  left: 18px;
  top: 18px;
  z-index: 10;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 8px;
  width: min(260px, calc(100vw - 36px));
  max-height: calc(100vh - 36px);
  padding: 12px;
  border: 1px solid rgba(247, 242, 234, 0.16);
  border-radius: 8px;
  background: rgba(15, 15, 18, 0.86);
  backdrop-filter: blur(12px);
}

.scene-menu-list {
  display: grid;
  gap: 8px;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}

.tour-menu h1 {
  margin: 0 0 4px;
  font-size: 1rem;
}

.tour-menu button,
.hotspot,
.fullscreen-button {
  border: 1px solid rgba(247, 242, 234, 0.18);
  border-radius: 8px;
  background: #24232a;
  color: #f7f2ea;
  font: inherit;
  cursor: pointer;
}

.tour-menu button {
  min-height: 36px;
  padding: 0 10px;
  text-align: left;
}

.tour-menu button.is-active {
  background: #f7f2ea;
  color: #101014;
}

.fullscreen-button {
  position: fixed;
  right: 18px;
  top: 18px;
  z-index: 10;
  min-height: 38px;
  padding: 0 12px;
}

.menu-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding-top: 4px;
}

.hotspot {
  min-height: 40px;
  padding: 0 12px;
  border: 2px solid #f7f2ea;
  border-radius: 999px;
  background: #c74d2c;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.34);
  font-size: 0.84rem;
  font-weight: 700;
  white-space: nowrap;
}

.hotspot--info {
  background: #226c67;
}

.media-panel {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 12;
  width: min(420px, calc(100vw - 36px));
}

.panel-card {
  display: grid;
  gap: 12px;
  max-height: min(560px, calc(100vh - 96px));
  overflow: auto;
  padding: 14px;
  border: 1px solid rgba(247, 242, 234, 0.16);
  border-radius: 8px;
  background: rgba(15, 15, 18, 0.9);
  backdrop-filter: blur(12px);
}

.panel-card h2,
.panel-card p,
.panel-card figure {
  margin: 0;
}

.panel-card p {
  color: #d8d0c7;
  line-height: 1.5;
}

.panel-card > button {
  justify-self: end;
  min-height: 32px;
  padding: 0 10px;
}

.floorplan-wrap {
  position: relative;
}

.floorplan-switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.floorplan-switcher button {
  min-height: 32px;
  padding: 0 10px;
}

.floorplan-switcher button.is-active {
  border-color: rgba(239, 112, 72, 0.85);
  background: rgba(199, 77, 44, 0.24);
}

.floorplan-wrap img,
.gallery-grid img,
.panel-card > img {
  display: block;
  width: 100%;
  border-radius: 8px;
}

.floorplan-marker {
  position: absolute;
  width: 18px;
  height: 18px;
  min-height: 0;
  padding: 0;
  border: 2px solid #f7f2ea;
  border-radius: 999px;
  background: #c74d2c;
  transform: translate(-50%, -50%);
}

.floorplan-marker.is-active {
  background: #74d680;
}

.gallery-grid {
  display: grid;
  gap: 12px;
}

.gallery-grid figcaption {
  margin-top: 6px;
  color: #d8d0c7;
  font-size: 0.86rem;
}

.media-frame {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 0;
  border-radius: 8px;
  background: #050507;
}

@media (max-width: 680px) {
  .tour-menu {
    bottom: 14px;
    top: auto;
    max-height: 42vh;
  }

  .media-panel {
    left: 14px;
    right: 14px;
    bottom: calc(42vh + 28px);
    width: auto;
  }
}
`;

const viewerJs = `import { Viewer } from "@photo-sphere-viewer/core";
import { EquirectangularTilesAdapter } from "@photo-sphere-viewer/equirectangular-tiles-adapter";

(async function () {
  const root = document.getElementById("tour");
  if (window.location.protocol === "file:") {
    root.innerHTML = '<main class="local-open-help"><h1>Este tour necesita un servidor local</h1><p>No abras index.html directamente. Regresa a la carpeta del tour y ejecuta <strong>ABRIR_TOUR.cmd</strong>.</p></main>';
    return;
  }
  const compatibilityCanvas = document.createElement("canvas");
  if (!(compatibilityCanvas.getContext("webgl2") || compatibilityCanvas.getContext("webgl"))) {
    root.innerHTML = '<main class="local-open-help"><h1>WebGL no esta disponible</h1><p>Activa la aceleracion grafica o abre este tour en Chrome o Edge actualizado.</p></main>';
    return;
  }
  const response = await fetch("./tour.json");
  const project = await response.json();

  root.className = "tour-viewer";
  root.innerHTML = '<div class="viewer-canvas" data-viewer></div><nav class="tour-menu" aria-label="Escenas"></nav><aside class="media-panel" data-media-panel></aside><button class="fullscreen-button" type="button">Pantalla completa</button>';

  const viewerElement = root.querySelector("[data-viewer]");
  const menu = root.querySelector(".tour-menu");
  const mediaPanel = root.querySelector("[data-media-panel]");
  const fullscreen = root.querySelector(".fullscreen-button");
  const viewer = new WebGlTourViewer(viewerElement, project, goToScene, (sceneId, panel, data) => renderMediaPanel(sceneId, panel, data));
  await viewer.ready;

  function renderMenu(activeSceneId) {
    menu.innerHTML = "<h1>" + escapeHtml(project.title) + "</h1><div class='scene-menu-list'>" + project.scenes.map((scene) => {
      const className = scene.id === activeSceneId ? ' class="is-active"' : "";
      return '<button type="button"' + className + ' data-scene-id="' + escapeHtml(scene.id) + '">' + escapeHtml(scene.name) + "</button>";
    }).join("") + '</div><div class="menu-actions"><button type="button" data-panel="floorplan">Plano</button><button type="button" data-panel="gallery">Galeria</button></div>';
    menu.querySelector("[data-scene-id].is-active")?.scrollIntoView({ block: "nearest" });
    renderMediaPanel(activeSceneId, "");
  }

  async function goToScene(sceneId) {
    if (!(await viewer.goToScene(sceneId))) return;
    renderMenu(sceneId);
  }

  menu.addEventListener("click", (event) => {
    const target = event.target.closest("[data-scene-id]");
    if (target) goToScene(target.dataset.sceneId);

    const panelTarget = event.target.closest("[data-panel]");
    if (panelTarget) renderMediaPanel(getActiveSceneId(), panelTarget.dataset.panel);
  });

  mediaPanel.addEventListener("click", (event) => {
    const marker = event.target.closest("[data-marker-scene]");
    if (marker) goToScene(marker.dataset.markerScene);

    const floorplan = event.target.closest("[data-floorplan-id]");
    if (floorplan) renderMediaPanel(getActiveSceneId(), "floorplan", { floorplanId: floorplan.dataset.floorplanId });

    const close = event.target.closest("[data-close-panel]");
    if (close) renderMediaPanel(getActiveSceneId(), "");
  });

  fullscreen.addEventListener("click", async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await root.requestFullscreen();
  });

  await goToScene(project.startScene || project.scenes[0]?.id);

  function getActiveSceneId() {
    const activeButton = menu.querySelector("[data-scene-id].is-active");
    return activeButton ? activeButton.dataset.sceneId : project.startScene || project.scenes[0]?.id;
  }

  function renderMediaPanel(activeSceneId, panel, panelData = {}) {
    if (!panel) {
      mediaPanel.innerHTML = "";
      return;
    }

    if (panel === "info") {
      mediaPanel.innerHTML = '<div class="panel-card"><button type="button" data-close-panel>Cerrar</button><h2>' + escapeHtml(panelData.title || panelData.label || "Informacion") + '</h2><p>' + escapeHtml(panelData.text || "") + '</p></div>';
      return;
    }

    if (panel === "image") {
      mediaPanel.innerHTML = '<div class="panel-card"><button type="button" data-close-panel>Cerrar</button><h2>' + escapeHtml(panelData.title || panelData.label || "Imagen") + '</h2><img src="' + escapeHtml(panelData.url || "") + '" alt="' + escapeHtml(panelData.title || panelData.label || "Imagen") + '" /></div>';
      return;
    }

    if (panel === "video") {
      mediaPanel.innerHTML = '<div class="panel-card"><button type="button" data-close-panel>Cerrar</button><h2>' + escapeHtml(panelData.title || panelData.label || "Video") + '</h2><iframe class="media-frame" src="' + escapeHtml(panelData.url || "") + '" allowfullscreen loading="lazy"></iframe></div>';
      return;
    }

    if (panel === "floorplan") {
      if (!project.floorplans.length) {
        mediaPanel.innerHTML = '<div class="panel-card"><button type="button" data-close-panel>Cerrar</button><p>No hay plano disponible.</p></div>';
        return;
      }

      const sceneFloorplan = project.floorplans.find((item) => item.markers.some((marker) => marker.sceneId === activeSceneId));
      const selectedFloorplan = project.floorplans.find((item) => item.id === panelData.floorplanId) || sceneFloorplan || project.floorplans[0];
      const switcher = project.floorplans.length > 1
        ? '<div class="floorplan-switcher">' + project.floorplans.map((item) => '<button type="button" class="' + (item.id === selectedFloorplan.id ? 'is-active' : '') + '" data-floorplan-id="' + escapeHtml(item.id) + '">' + escapeHtml(item.name) + '</button>').join("") + '</div>'
        : "";
      mediaPanel.innerHTML = '<div class="panel-card"><button type="button" data-close-panel>Cerrar</button><h2>' + escapeHtml(selectedFloorplan.name) + '</h2>' + switcher + '<div class="floorplan-wrap"><img src="' + escapeHtml(selectedFloorplan.image) + '" alt="' + escapeHtml(selectedFloorplan.name) + '" />' + selectedFloorplan.markers.map((marker) => '<button type="button" class="floorplan-marker' + (marker.sceneId === activeSceneId ? ' is-active' : '') + '" style="left:' + marker.x + '%;top:' + marker.y + '%" data-marker-scene="' + escapeHtml(marker.sceneId) + '"></button>').join("") + '</div></div>';
      return;
    }

    if (panel === "gallery") {
      if (!project.gallery.length) {
        mediaPanel.innerHTML = '<div class="panel-card"><button type="button" data-close-panel>Cerrar</button><p>No hay galeria disponible.</p></div>';
        return;
      }

      mediaPanel.innerHTML = '<div class="panel-card"><button type="button" data-close-panel>Cerrar</button><h2>Galeria</h2><div class="gallery-grid">' + project.gallery.map((item) => '<figure><img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.caption || "Foto de galeria") + '" />' + (item.caption ? '<figcaption>' + escapeHtml(item.caption) + '</figcaption>' : '') + '</figure>').join("") + '</div></div>';
    }
  }
})().catch((error) => {
  const root = document.getElementById("tour");
  if (root) root.innerHTML = '<main class="local-open-help"><h1>No se pudo abrir el tour</h1><p>Prueba Chrome o Edge con aceleracion grafica activa. Detalle: ' + escapeHtml(error instanceof Error ? error.message : String(error)) + '</p></main>';
  console.error(error);
});

class WebGlTourViewer {
  constructor(container, project, onSceneLink, onMediaPanel) {
    this.container = container;
    this.project = project;
    this.onSceneLink = onSceneLink;
    this.onMediaPanel = onMediaPanel;
    this.currentSceneId = project.startScene || project.scenes[0]?.id || "";
    this.hotspotLayer = document.createElement("div");
    this.hotspotLayer.className = "viewer-hotspot-layer";
    this.container.append(this.hotspotLayer);
    const initialScene = this.getScene(this.currentSceneId);
    const usesTiles = Boolean(initialScene?.metadata?.panoramaAssets?.tiles);
    this.viewer = new Viewer({
      container,
      adapter: usesTiles ? EquirectangularTilesAdapter : undefined,
      panorama: this.getPanorama(initialScene),
      navbar: false,
      mousewheelCtrlKey: false,
      touchmoveTwoFingers: false,
      rendererParameters: { antialias: true, preserveDrawingBuffer: true },
      defaultYaw: initialScene?.initialView?.yaw || 0,
      defaultPitch: initialScene?.initialView?.pitch || 0,
      defaultZoomLvl: this.fovToZoom(initialScene?.initialView?.fov || 1.2)
    });
    this.ready = new Promise((resolve) => {
      this.viewer.addEventListener("ready", () => {
        this.renderHotspots(initialScene?.hotspots || []);
        resolve();
      }, { once: true });
    });
    this.viewer.addEventListener("render", () => this.positionHotspots());
  }

  async goToScene(sceneId) {
    const scene = this.getScene(sceneId);
    if (!scene) return false;
    if (sceneId !== this.currentSceneId) {
      await this.viewer.setPanorama(this.getPanorama(scene), {
        position: { yaw: scene.initialView?.yaw || 0, pitch: scene.initialView?.pitch || 0 },
        zoom: this.fovToZoom(scene.initialView?.fov || 1.2),
        transition: false
      });
      this.currentSceneId = sceneId;
    }
    this.renderHotspots(scene.hotspots || []);
    this.positionHotspots();
    return true;
  }

  getScene(sceneId) {
    return this.project.scenes.find((scene) => scene.id === sceneId);
  }

  getPanorama(scene) {
    if (!scene) return "";
    const assets = scene.metadata?.panoramaAssets;
    const tiles = assets?.tiles;
    if (!tiles) return scene.panorama;
    return {
      width: tiles.width,
      cols: tiles.cols,
      rows: tiles.rows,
      baseUrl: assets.preview?.path || scene.panorama,
      tileUrl: (col, row) => tiles.pathTemplate.replace("{col}", String(col)).replace("{row}", String(row))
    };
  }

  fovToZoom(fov) {
    return Math.max(0, Math.min(100, 100 - ((fov - 0.55) / 1) * 100));
  }

  renderHotspots(hotspots) {
    this.hotspotLayer.innerHTML = "";
    for (const hotspot of hotspots) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "hotspot hotspot--" + hotspot.type;
      element.dataset.yaw = String(hotspot.yaw);
      element.dataset.pitch = String(hotspot.pitch);
      element.textContent = hotspot.label || (hotspot.type === "scene" ? "Ir" : hotspot.type === "info" ? "Info" : "Abrir");
      element.addEventListener("click", () => {
        if (hotspot.type === "scene") this.onSceneLink(hotspot.targetScene);
        else if (hotspot.type === "link") window.open(hotspot.url, "_blank", "noopener");
        else this.onMediaPanel(this.currentSceneId, hotspot.type, hotspot);
      });
      this.hotspotLayer.append(element);
    }
    this.positionHotspots();
  }

  positionHotspots() {
    const bounds = this.container.getBoundingClientRect();
    for (const element of this.hotspotLayer.querySelectorAll(".hotspot")) {
      const point = this.viewer.dataHelper.sphericalCoordsToViewerCoords({
        yaw: Number(element.dataset.yaw),
        pitch: Number(element.dataset.pitch)
      });
      const visible = point.x >= -120 && point.x <= bounds.width + 120 && point.y >= -80 && point.y <= bounds.height + 80;
      element.style.display = visible ? "" : "none";
      element.style.left = point.x + "px";
      element.style.top = point.y + "px";
    }
  }
}

class CanvasTourViewer {
  constructor(container, project, onSceneLink, onMediaPanel) {
    this.container = container;
    this.project = project;
    this.onSceneLink = onSceneLink;
    this.onMediaPanel = onMediaPanel;
    this.scenes = new Map();
    this.currentSceneId = "";
    this.failedSceneId = "";
    this.view = { yaw: 0, pitch: 0, fov: 1.2 };
    this.isDragging = false;
    this.lastPointer = null;
    this.renderHandle = 0;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "export-tour-canvas";
    this.context = this.canvas.getContext("2d", { alpha: false });
    this.hotspotLayer = document.createElement("div");
    this.hotspotLayer.className = "viewer-hotspot-layer";
    this.container.append(this.canvas, this.hotspotLayer);
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.ready = this.indexScenes();
  }

  async indexScenes() {
    for (const scene of this.project.scenes) {
      this.scenes.set(scene.id, { data: scene, image: null, loading: null });
    }
  }

  goToScene(sceneId) {
    const scene = this.scenes.get(sceneId);
    if (!scene) return false;
    this.currentSceneId = sceneId;
    this.failedSceneId = "";
    this.view = clampView(scene.data.initialView || { yaw: 0, pitch: 0, fov: 1.2 });
    this.renderHotspots(scene.data.hotspots || []);
    this.requestRender();
    this.ensureSceneImage(sceneId)
      .then(() => {
        if (this.currentSceneId === sceneId) this.requestRender();
        this.preloadRelatedScenes(sceneId);
      })
      .catch(() => {
        this.failedSceneId = sceneId;
        if (this.currentSceneId === sceneId) this.requestRender();
      });
    return true;
  }

  ensureSceneImage(sceneId) {
    const scene = this.scenes.get(sceneId);
    if (!scene) return Promise.reject(new Error("Escena no encontrada."));
    if (scene.image) return Promise.resolve(scene.image);
    if (scene.loading) return scene.loading;

    scene.loading = loadImage(scene.data.panorama).then((image) => {
      scene.image = image;
      scene.source = null;
      scene.loading = null;
      return image;
    });
    return scene.loading;
  }

  preloadRelatedScenes(sceneId) {
    const sceneIndex = this.project.scenes.findIndex((scene) => scene.id === sceneId);
    const relatedIds = new Set();
    const previous = this.project.scenes[sceneIndex - 1];
    const next = this.project.scenes[sceneIndex + 1];
    if (previous) relatedIds.add(previous.id);
    if (next) relatedIds.add(next.id);

    const current = this.scenes.get(sceneId)?.data;
    for (const hotspot of current?.hotspots || []) {
      if (hotspot.type === "scene" && hotspot.targetScene) relatedIds.add(hotspot.targetScene);
    }

    window.setTimeout(() => {
      for (const id of relatedIds) {
        this.ensureSceneImage(id).catch(() => undefined);
      }
    }, 80);
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) => {
      this.isDragging = true;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.isDragging || !this.lastPointer) return;
      const bounds = this.canvas.getBoundingClientRect();
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.view = clampView({
        ...this.view,
        yaw: this.view.yaw - dx * (this.view.fov / Math.max(1, bounds.height)),
        pitch: this.view.pitch + dy * (this.view.fov / Math.max(1, bounds.height))
      });
      this.requestRender();
    });
    this.canvas.addEventListener("pointerup", (event) => {
      this.isDragging = false;
      this.lastPointer = null;
      this.canvas.releasePointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.view = clampView({ ...this.view, fov: this.view.fov + Math.sign(event.deltaY) * 0.08 });
      this.requestRender();
    });
  }

  resize() {
    const bounds = this.container.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 1100 / Math.max(1, bounds.width));
    this.canvas.width = Math.max(1, Math.round(bounds.width * scale));
    this.canvas.height = Math.max(1, Math.round(bounds.height * scale));
    this.requestRender();
  }

  requestRender() {
    if (this.renderHandle) return;
    this.renderHandle = requestAnimationFrame(() => {
      this.renderHandle = 0;
      this.render();
    });
  }

  render() {
    const scene = this.scenes.get(this.currentSceneId);
    if (!scene || !this.context) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (!scene.image) {
      this.renderLoadingState(width, height, this.failedSceneId === this.currentSceneId);
      return;
    }

    const buffer = this.context.createImageData(width, height);
    const data = buffer.data;
    const source = getSceneSource(scene);
    if (!source) return;
    const aspect = width / Math.max(1, height);
    const verticalFov = this.view.fov;
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
    const tanHalfH = Math.tan(horizontalFov / 2);
    const tanHalfV = Math.tan(verticalFov / 2);

    for (let y = 0; y < height; y += 1) {
      const normalizedY = 1 - (2 * (y + 0.5)) / height;
      for (let x = 0; x < width; x += 1) {
        const normalizedX = (2 * (x + 0.5)) / width - 1;
        const direction = rotateDirection(normalizedX * tanHalfH, normalizedY * tanHalfV, -1, this.view.yaw, this.view.pitch);
        const yaw = Math.atan2(direction.x, -direction.z);
        const pitch = Math.asin(clamp(direction.y, -1, 1));
        const sourceX = positiveModulo(yaw / (2 * Math.PI) + 0.5, 1) * source.width;
        const sourceY = clamp(0.5 - pitch / Math.PI, 0, 0.999999) * source.height;
        const sx = Math.floor(sourceX) % source.width;
        const sy = Math.floor(sourceY);
        const sourceIndex = (sy * source.width + sx) * 4;
        const targetIndex = (y * width + x) * 4;
        data[targetIndex] = source.data[sourceIndex];
        data[targetIndex + 1] = source.data[sourceIndex + 1];
        data[targetIndex + 2] = source.data[sourceIndex + 2];
        data[targetIndex + 3] = 255;
      }
    }
    this.context.putImageData(buffer, 0, 0);
    this.positionHotspots();
  }

  renderLoadingState(width, height, failed) {
    this.context.fillStyle = "#050507";
    this.context.fillRect(0, 0, width, height);
    this.context.fillStyle = failed ? "#ffaaa2" : "#f5f0e8";
    this.context.font = Math.max(14, Math.round(width / 72)) + "px sans-serif";
    this.context.textAlign = "center";
    this.context.fillText(failed ? "No se pudo cargar esta escena." : "Cargando escena...", width / 2, height / 2);
  }

  renderHotspots(hotspots) {
    this.hotspotLayer.innerHTML = "";
    for (const hotspot of hotspots) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "hotspot hotspot--" + hotspot.type;
      element.dataset.yaw = String(hotspot.yaw);
      element.dataset.pitch = String(hotspot.pitch);
      if (hotspot.type === "scene") {
        element.textContent = hotspot.label || "Ir";
        element.addEventListener("click", () => this.onSceneLink(hotspot.targetScene));
      } else if (hotspot.type === "info") {
        element.textContent = hotspot.label || "Info";
        element.addEventListener("click", () => this.onMediaPanel(this.currentSceneId, "info", hotspot));
      } else if (hotspot.type === "image" || hotspot.type === "video") {
        element.textContent = hotspot.title || hotspot.label || "Abrir";
        element.addEventListener("click", () => this.onMediaPanel(this.currentSceneId, hotspot.type, hotspot));
      } else {
        element.textContent = hotspot.title || hotspot.label || "Abrir";
        element.addEventListener("click", () => window.open(hotspot.url, "_blank", "noopener"));
      }
      this.hotspotLayer.append(element);
    }
    this.positionHotspots();
  }

  positionHotspots() {
    const bounds = this.canvas.getBoundingClientRect();
    for (const element of this.hotspotLayer.querySelectorAll(".hotspot")) {
      const position = this.projectSphereToScreen(Number(element.dataset.yaw), Number(element.dataset.pitch), bounds.width, bounds.height);
      if (!position) {
        element.style.display = "none";
        continue;
      }
      element.style.display = "";
      element.style.left = position.x + "px";
      element.style.top = position.y + "px";
    }
  }

  projectSphereToScreen(yaw, pitch, width, height) {
    const direction = sphereToDirection(yaw, pitch);
    const cameraDirection = rotateDirection(direction.x, direction.y, direction.z, -this.view.yaw, -this.view.pitch);
    if (cameraDirection.z >= -0.05) return null;
    const aspect = width / Math.max(1, height);
    const horizontalFov = 2 * Math.atan(Math.tan(this.view.fov / 2) * aspect);
    const x = (cameraDirection.x / -cameraDirection.z / Math.tan(horizontalFov / 2) + 1) * 0.5 * width;
    const y = (1 - cameraDirection.y / -cameraDirection.z / Math.tan(this.view.fov / 2)) * 0.5 * height;
    if (x < -120 || x > width + 120 || y < -80 || y > height + 80) return null;
    return { x, y };
  }
}

function getSceneSource(scene) {
  if (scene.source) return scene.source;
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = scene.image.naturalWidth;
  sourceCanvas.height = scene.image.naturalHeight;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) return null;
  sourceContext.drawImage(scene.image, 0, 0);
  scene.source = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  return scene.source;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("No se pudo cargar " + src)));
    image.src = src;
  });
}

function rotateDirection(x, y, z, yaw, pitch) {
  const length = Math.hypot(x, y, z) || 1;
  x /= length; y /= length; z /= length;
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const py = y * cosPitch - z * sinPitch;
  const pz = y * sinPitch + z * cosPitch;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  return { x: x * cosYaw - pz * sinYaw, y: py, z: x * sinYaw + pz * cosYaw };
}

function sphereToDirection(yaw, pitch) {
  return { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
}

function clampView(view) {
  return {
    yaw: view.yaw || 0,
    pitch: clamp(view.pitch || 0, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01),
    fov: clamp(view.fov || 1.2, 0.55, 1.55)
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
`;

const localLauncherCmd = `@echo off\r
cd /d "%~dp0"\r
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-local.ps1"\r
if errorlevel 1 pause\r
`;

const localServerPowerShell = `$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$listener = $null
$port = $null
$ports = if ($env:TOUR_PORT) { @([int]$env:TOUR_PORT) } else { @(8765..8785) }

foreach ($candidate in $ports) {
  $candidateListener = $null
  try {
    $candidateListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidate)
    $candidateListener.Start()
    $listener = $candidateListener
    $port = $candidate
    break
  } catch {
    if ($null -ne $candidateListener) { $candidateListener.Stop() }
  }
}

if ($null -eq $listener) {
  Write-Host "No se encontro un puerto local disponible." -ForegroundColor Red
  exit 1
}

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".png" = "image/png"
  ".webp" = "image/webp"
  ".svg" = "image/svg+xml"
}

$url = "http://127.0.0.1:$port/"
Write-Host "360Tours Studio" -ForegroundColor Cyan
Write-Host "Tour disponible en $url"
Write-Host "Deja esta ventana abierta. Presiona Ctrl+C para cerrar el tour."
if ($env:TOUR_NO_BROWSER -ne "1") {
  $chromeCandidates = @(
    "$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe",
    "\${env:ProgramFiles(x86)}\\Google\\Chrome\\Application\\chrome.exe",
    "$env:LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe"
  )
  $chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($chrome) { Start-Process $chrome -ArgumentList $url } else { Start-Process $url }
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      while (-not [string]::IsNullOrEmpty($reader.ReadLine())) {}

      $requestTarget = if ($requestLine) { $requestLine.Split(" ")[1] } else { "/" }
      $requestUri = [System.Uri]::new("http://127.0.0.1$requestTarget")
      $relativePath = [System.Uri]::UnescapeDataString($requestUri.AbsolutePath.TrimStart("/"))
      if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = "index.html" }
      $candidatePath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath.Replace("/", "\\")))

      $status = "200 OK"
      $mimeType = "application/octet-stream"
      if (-not $candidatePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        $status = "403 Forbidden"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
        $mimeType = "text/plain; charset=utf-8"
      } else {
        if ([System.IO.Directory]::Exists($candidatePath)) { $candidatePath = Join-Path $candidatePath "index.html" }
        if (-not [System.IO.File]::Exists($candidatePath)) {
          $status = "404 Not Found"
          $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
          $mimeType = "text/plain; charset=utf-8"
        } else {
          $extension = [System.IO.Path]::GetExtension($candidatePath).ToLowerInvariant()
          if ($contentTypes.ContainsKey($extension)) { $mimeType = $contentTypes[$extension] }
          $bytes = [System.IO.File]::ReadAllBytes($candidatePath)
        }
      }

      $header = "HTTP/1.1 $status\`r\`nContent-Type: $mimeType\`r\`nContent-Length: $($bytes.Length)\`r\`nConnection: close\`r\`n\`r\`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($bytes, 0, $bytes.Length)
      $stream.Flush()
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
`;

const localReadme = `360Tours Studio - Como abrir este tour

Este paquete es un minisitio web. Los navegadores bloquean la carga de tour.json
y el procesamiento de panoramas cuando index.html se abre directamente como file://.

EN WINDOWS
1. Extrae todo el contenido del ZIP. No ejecutes archivos dentro del ZIP.
2. Haz doble clic en ABRIR_TOUR.cmd.
3. Se abrira el tour en tu navegador.
4. Deja abierta la ventana del servidor mientras revisas el tour.
5. Presiona Ctrl+C en esa ventana para detenerlo.

PARA PUBLICAR
Sube todos los archivos y carpetas del paquete al mismo directorio de un servidor web.
El archivo de entrada es index.html.
`;

function mimeToExtension(mimeType: string): string {
  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
