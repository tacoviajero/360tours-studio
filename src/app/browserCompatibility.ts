export interface BrowserCompatibility {
  supported: boolean;
  level: "supported" | "warning" | "blocked";
  message: string;
}

export function detectBrowserCompatibility(): BrowserCompatibility {
  const missing: string[] = [];
  if (!window.indexedDB) missing.push("almacenamiento local");
  if (typeof createImageBitmap !== "function") missing.push("decodificacion de imagenes");
  if (!window.crypto?.subtle) missing.push("verificacion de archivos");

  const canvas = document.createElement("canvas");
  const hasWebGl = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  if (!hasWebGl) missing.push("WebGL");

  if (missing.length > 0) {
    return {
      supported: false,
      level: "blocked",
      message: `Este navegador no ofrece ${missing.join(", ")}. Usa Chrome o Edge con aceleracion grafica activa.`
    };
  }

  const chromium = /Chrome|Chromium|Edg\//.test(navigator.userAgent);
  if (!chromium) {
    return {
      supported: true,
      level: "warning",
      message: "Modo de compatibilidad. Para importar fotos 8K y revisar el tour final se recomienda Chrome o Edge."
    };
  }

  return { supported: true, level: "supported", message: "Navegador compatible: almacenamiento, procesamiento y WebGL disponibles." };
}
