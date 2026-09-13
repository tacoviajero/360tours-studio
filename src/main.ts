import { Tours360StudioApp } from "./app/app";
import "./styles/main.css";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("No se encontro el contenedor principal.");
}

new Tours360StudioApp().mount(root);
