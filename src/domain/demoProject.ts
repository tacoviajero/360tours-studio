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
      panorama: "https://www.marzipano.net/media/equirect/angra.jpg",
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
      panorama: "https://www.marzipano.net/media/equirect/cube.jpg",
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
      panorama: "https://www.marzipano.net/media/equirect/angra.jpg",
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

