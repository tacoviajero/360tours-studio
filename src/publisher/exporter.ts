import marzipanoSource from "marzipano/dist/marzipano.js?raw";
import type { TourProject } from "../domain/tour";
import { validateProject } from "../domain/validation";

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
  const publishedProject: TourProject = {
    ...project,
    scenes: await Promise.all(
      project.scenes.map(async (scene) => {
        const asset = await resolveAsset?.(project, scene.panorama);
        const thumbnailAsset = scene.thumbnail ? await resolveAsset?.(project, scene.thumbnail) : null;
        if (thumbnailAsset && scene.thumbnail) {
          files.push({ path: scene.thumbnail, content: thumbnailAsset, mimeType: thumbnailAsset.type || "image/jpeg" });
        }

        if (!asset) {
          return scene;
        }

        const extension = mimeToExtension(asset.type);
        const path = `panoramas/${scene.id}.${extension}`;
        files.push({ path, content: asset, mimeType: asset.type || "image/jpeg" });
        return { ...scene, panorama: path };
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

  files.unshift(
    { path: "index.html", content: renderIndexHtml(project.title), mimeType: "text/html" },
    { path: "tour.json", content: JSON.stringify(publishedProject, null, 2), mimeType: "application/json" },
    { path: "viewer.css", content: viewerCss, mimeType: "text/css" },
    { path: "viewer.js", content: viewerJs, mimeType: "text/javascript" },
    { path: "vendor/marzipano.js", content: marzipanoSource, mimeType: "text/javascript" }
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
    <link rel="stylesheet" href="./viewer.css" />
  </head>
  <body>
    <div id="tour"></div>
    <script src="./vendor/marzipano.js"></script>
    <script src="./viewer.js"></script>
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

.tour-menu {
  position: fixed;
  left: 18px;
  top: 18px;
  z-index: 10;
  display: grid;
  gap: 8px;
  width: min(260px, calc(100vw - 36px));
  padding: 12px;
  border: 1px solid rgba(247, 242, 234, 0.16);
  border-radius: 8px;
  background: rgba(15, 15, 18, 0.86);
  backdrop-filter: blur(12px);
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
    overflow: auto;
  }

  .media-panel {
    left: 14px;
    right: 14px;
    bottom: calc(42vh + 28px);
    width: auto;
  }
}
`;

const viewerJs = `(async function () {
  const root = document.getElementById("tour");
  const response = await fetch("./tour.json");
  const project = await response.json();

  root.className = "tour-viewer";
  root.innerHTML = '<div class="viewer-canvas" data-viewer></div><nav class="tour-menu" aria-label="Escenas"></nav><aside class="media-panel" data-media-panel></aside><button class="fullscreen-button" type="button">Pantalla completa</button>';

  const viewerElement = root.querySelector("[data-viewer]");
  const menu = root.querySelector(".tour-menu");
  const mediaPanel = root.querySelector("[data-media-panel]");
  const fullscreen = root.querySelector(".fullscreen-button");
  const viewer = new Marzipano.Viewer(viewerElement);
  const scenes = new Map();

  for (const sceneData of project.scenes) {
    const source = Marzipano.ImageUrlSource.fromString(sceneData.panorama);
    const geometry = new Marzipano.EquirectGeometry([{ width: 2048 }]);
    const limiter = Marzipano.RectilinearView.limit.traditional(2048, Math.PI / 2);
    const view = new Marzipano.RectilinearView(sceneData.initialView, limiter);
    const scene = viewer.createScene({ source, geometry, view, pinFirstLevel: true });
    scenes.set(sceneData.id, { data: sceneData, scene });

    for (const hotspot of sceneData.hotspots) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "hotspot hotspot--" + hotspot.type;

      if (hotspot.type === "scene") {
        element.textContent = hotspot.label || "Ir";
        element.addEventListener("click", () => goToScene(hotspot.targetScene));
      } else if (hotspot.type === "info") {
        element.textContent = hotspot.label || "Info";
        element.addEventListener("click", () => renderMediaPanel(getActiveSceneId(), "info", hotspot));
      } else if (hotspot.type === "image" || hotspot.type === "video") {
        element.textContent = hotspot.title || hotspot.label || "Abrir";
        element.addEventListener("click", () => renderMediaPanel(getActiveSceneId(), hotspot.type, hotspot));
      } else {
        element.textContent = hotspot.title || hotspot.label || "Abrir";
        element.addEventListener("click", () => window.open(hotspot.url, "_blank", "noopener"));
      }

      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    }
  }

  function renderMenu(activeSceneId) {
    menu.innerHTML = "<h1>" + escapeHtml(project.title) + "</h1>" + project.scenes.map((scene) => {
      const className = scene.id === activeSceneId ? ' class="is-active"' : "";
      return '<button type="button"' + className + ' data-scene-id="' + escapeHtml(scene.id) + '">' + escapeHtml(scene.name) + "</button>";
    }).join("") + '<div class="menu-actions"><button type="button" data-panel="floorplan">Plano</button><button type="button" data-panel="gallery">Galeria</button></div>';
    renderMediaPanel(activeSceneId, "");
  }

  function goToScene(sceneId) {
    const entry = scenes.get(sceneId);
    if (!entry) return;
    entry.scene.switchTo({ transitionDuration: 350 });
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

  goToScene(project.startScene || project.scenes[0]?.id);

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
})();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
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
