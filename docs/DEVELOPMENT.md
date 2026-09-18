# Desarrollo local

## Requisitos actuales

- Node.js
- pnpm
- Git

En este entorno ya se detectaron Node.js, pnpm y Git. Rust/Cargo no esta instalado, por lo que Tauri queda para la fase de empaquetado.

## Instalar dependencias

```powershell
pnpm install
```

## Ejecutar Studio

```powershell
pnpm dev
```

La app se abre durante desarrollo en:

```text
http://127.0.0.1:5173/
```

Para hacer pruebas manuales con fotos reales sin abrir ChatGPT, usa:

```text
docs/MANUAL_TESTING.md
```

## Verificar build

```powershell
pnpm build
```

## Primer hito tecnico

Antes de añadir funciones secundarias, demostrar:

```text
3 JPG 360
↓
crear escenas
↓
conectar hotspots
↓
guardar
↓
cerrar Studio
↓
reabrir
↓
preview
↓
exportar
↓
publicar
↓
abrir tour desde internet
```
