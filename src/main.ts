import { HomeToursStudioApp } from "./app/app";
import "./styles/main.css";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("No se encontro el contenedor principal.");
}

new HomeToursStudioApp().mount(root);

