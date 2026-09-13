import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, "index.html"),
        progress: resolve(__dirname, "progress.html")
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  },
  preview: {
    host: "127.0.0.1",
    port: 4173
  }
});
