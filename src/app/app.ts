import { demoProject } from "../domain/demoProject";
import type { TourProject } from "../domain/tour";
import { validateProject } from "../domain/validation";
import { MarzipanoTourRenderer } from "../renderer/marzipanoRenderer";
import { BrowserProjectStorage } from "../project/storage";

export class HomeToursStudioApp {
  private project: TourProject = demoProject;
  private storage = new BrowserProjectStorage();
  private renderer: MarzipanoTourRenderer | null = null;
  private activeSceneId = demoProject.startScene ?? demoProject.scenes[0]?.id ?? "";

  mount(root: HTMLElement): void {
    root.innerHTML = this.renderShell();
    this.bindActions(root);
    this.renderSceneList(root);
    this.renderValidation(root);
    this.mountPreview(root);
  }

  private renderShell(): string {
    return `
      <main class="studio-shell">
        <aside class="project-panel" aria-label="Proyectos">
          <div>
            <p class="eyebrow">Local-first</p>
            <h1>HomeTours Studio</h1>
            <p class="muted">Produccion de recorridos 360 para TacoViajero.</p>
          </div>
          <button class="primary-action" data-action="snapshot">Guardar snapshot</button>
          <section>
            <h2>Escenas</h2>
            <div class="scene-list" data-scene-list></div>
          </section>
        </aside>

        <section class="viewer-panel" aria-label="Preview del tour">
          <header class="topbar">
            <div>
              <p class="eyebrow">Proyecto demo</p>
              <h2>${this.project.title}</h2>
            </div>
            <div class="topbar-actions">
              <button data-action="set-start">Usar como inicio</button>
              <button data-action="export">Exportar</button>
              <button data-action="publish">Publicar</button>
            </div>
          </header>
          <div class="viewer-surface" data-viewer></div>
        </section>

        <aside class="properties-panel" aria-label="Estado del proyecto">
          <section>
            <h2>Validacion</h2>
            <div data-validation></div>
          </section>
          <section>
            <h2>Prioridad del hito</h2>
            <ol class="milestone-list">
              <li>JSON genera tour navegable</li>
              <li>Editor modifica datos</li>
              <li>Preview comparte renderer</li>
              <li>Export estatico</li>
              <li>Publicacion segura</li>
            </ol>
          </section>
        </aside>
      </main>
    `;
  }

  private bindActions(root: HTMLElement): void {
    root.addEventListener("click", async (event) => {
      const target = event.target as HTMLElement;
      const action = target.dataset.action;

      if (action === "snapshot") {
        await this.storage.snapshot(this.project);
        target.textContent = "Snapshot guardado";
        setTimeout(() => {
          target.textContent = "Guardar snapshot";
        }, 1400);
      }

      if (action === "set-start") {
        this.project = { ...this.project, startScene: this.activeSceneId };
        await this.storage.save(this.project);
        this.renderValidation(root);
      }

      if (action === "export") {
        window.alert("Exportador estatico preparado como modulo. Siguiente paso: conectarlo al filesystem local.");
      }

      if (action === "publish") {
        window.alert("Publicacion SFTP pendiente hasta completar exportacion y credenciales seguras.");
      }

      if (target.dataset.sceneId) {
        this.renderer?.goToScene(target.dataset.sceneId);
      }
    });
  }

  private mountPreview(root: HTMLElement): void {
    const viewerElement = root.querySelector<HTMLElement>("[data-viewer]");
    if (!viewerElement) {
      return;
    }

    this.renderer = new MarzipanoTourRenderer((sceneId) => {
      this.activeSceneId = sceneId;
      this.renderSceneList(root);
    });
    this.renderer.mount(viewerElement, this.project);
  }

  private renderSceneList(root: HTMLElement): void {
    const sceneList = root.querySelector<HTMLElement>("[data-scene-list]");
    if (!sceneList) {
      return;
    }

    sceneList.innerHTML = this.project.scenes
      .map((scene) => {
        const isActive = scene.id === this.activeSceneId;
        const isStart = scene.id === this.project.startScene;
        return `
          <button class="scene-item${isActive ? " is-active" : ""}" data-scene-id="${scene.id}">
            <span>${scene.name}</span>
            ${isStart ? "<strong>Inicio</strong>" : ""}
          </button>
        `;
      })
      .join("");
  }

  private renderValidation(root: HTMLElement): void {
    const validation = root.querySelector<HTMLElement>("[data-validation]");
    if (!validation) {
      return;
    }

    const issues = validateProject(this.project);

    if (issues.length === 0) {
      validation.innerHTML = `<p class="status-ok">Ready to publish</p>`;
      return;
    }

    validation.innerHTML = `
      <ul class="issue-list">
        ${issues.map((issue) => `<li class="issue issue--${issue.severity}">${issue.message}</li>`).join("")}
      </ul>
    `;
  }
}

