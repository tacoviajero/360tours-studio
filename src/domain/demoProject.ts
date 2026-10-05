import { CURRENT_SCHEMA_VERSION, type TourProject } from "./tour";

export const demoProject: TourProject = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: "casa-antigua",
  title: "Casa Antigua",
  startScene: "entrada",
  settings: {},
  floorplans: [],
  gallery: [],
  scenes: [
    {
      id: "entrada",
      name: "Entrada",
      panorama: "demo/entrada.jpg",
      initialView: { yaw: 0, pitch: 0, fov: 1.4 },
      hotspots: [
        {
          id: "entrada-sala",
          type: "scene",
          yaw: 0.9,
          pitch: -0.05,
          targetScene: "sala",
          label: "Ir a Sala"
        }
      ]
    },
    {
      id: "sala",
      name: "Sala",
      panorama: "demo/sala.jpg",
      initialView: { yaw: 0.2, pitch: 0, fov: 1.4 },
      hotspots: [
        {
          id: "sala-entrada",
          type: "scene",
          yaw: -1.4,
          pitch: -0.08,
          targetScene: "entrada",
          label: "Volver a Entrada"
        },
        {
          id: "sala-cocina",
          type: "scene",
          yaw: 1.2,
          pitch: -0.04,
          targetScene: "cocina",
          label: "Ir a Cocina"
        },
        {
          id: "sala-info",
          type: "info",
          yaw: 0.15,
          pitch: 0.02,
          title: "Punto de informacion",
          text: "Aqui se mostrara informacion adicional del espacio."
        }
      ]
    },
    {
      id: "cocina",
      name: "Cocina",
      panorama: "demo/cocina.jpg",
      initialView: { yaw: -0.4, pitch: 0, fov: 1.4 },
      hotspots: [
        {
          id: "cocina-sala",
          type: "scene",
          yaw: 2.2,
          pitch: -0.1,
          targetScene: "sala",
          label: "Volver a Sala"
        }
      ]
    }
  ]
};

const demoPalettes = {
  entrada: { wall: "#d5c0a6", accent: "#b9452d", floor: "#735345", label: "ENTRADA" },
  sala: { wall: "#b9c8b1", accent: "#2f6f68", floor: "#684b3d", label: "SALA" },
  cocina: { wall: "#d7d1ba", accent: "#d27a32", floor: "#59616a", label: "COCINA" }
} as const;

export async function createDemoPanoramaFile(sceneId: keyof typeof demoPalettes): Promise<File> {
  const palette = demoPalettes[sceneId];
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no pudo crear el panorama de demostracion.");

  const ceiling = context.createLinearGradient(0, 0, 0, 300);
  ceiling.addColorStop(0, "#26272b");
  ceiling.addColorStop(1, "#8d8174");
  context.fillStyle = ceiling;
  context.fillRect(0, 0, canvas.width, 300);
  context.fillStyle = palette.wall;
  context.fillRect(0, 300, canvas.width, 420);
  const floor = context.createLinearGradient(0, 700, 0, canvas.height);
  floor.addColorStop(0, palette.floor);
  floor.addColorStop(1, "#17171b");
  context.fillStyle = floor;
  context.fillRect(0, 700, canvas.width, 324);

  for (let index = 0; index < 16; index += 1) {
    const x = index * 128;
    context.fillStyle = index % 2 === 0 ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)";
    context.fillRect(x, 300, 128, 420);
    context.strokeStyle = "rgba(255,255,255,0.22)";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(1024 + (x - 1024) * 0.38, 300);
    context.stroke();
    context.strokeStyle = "rgba(255,255,255,0.12)";
    context.beginPath();
    context.moveTo(x, canvas.height);
    context.lineTo(1024 + (x - 1024) * 0.3, 700);
    context.stroke();
  }

  for (const offset of [256, 768, 1280, 1792]) {
    context.fillStyle = "rgba(20,22,26,0.72)";
    context.fillRect(offset - 92, 380, 184, 250);
    context.fillStyle = palette.accent;
    context.fillRect(offset - 78, 394, 156, 222);
    context.fillStyle = "rgba(255,255,255,0.82)";
    context.fillRect(offset - 54, 420, 108, 92);
  }

  context.fillStyle = "rgba(12,13,16,0.78)";
  context.fillRect(760, 438, 528, 144);
  context.strokeStyle = palette.accent;
  context.lineWidth = 8;
  context.strokeRect(760, 438, 528, 144);
  context.fillStyle = "#ffffff";
  context.font = "700 62px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(palette.label, 1024, 510);
  context.font = "28px Arial, sans-serif";
  context.fillStyle = "rgba(255,255,255,0.82)";
  context.fillText("DEMO LOCAL 360TOURS STUDIO", 1024, 555);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("No se pudo generar la demo local.")), "image/jpeg", 0.9);
  });
  return new File([blob], `${sceneId}-demo.jpg`, { type: "image/jpeg" });
}
