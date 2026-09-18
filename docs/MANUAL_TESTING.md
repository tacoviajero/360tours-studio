# Pruebas manuales de 360Tours Studio

Esta guia sirve para levantar la app y probar tus fotos 360 sin abrir ChatGPT.

## 1. Abrir PowerShell

Abre **Windows PowerShell**.

## 2. Entrar a la carpeta del proyecto

Ejecuta:

```powershell
cd "C:\Users\KLozk\Documents\TacoViajero\Code\360Tours Studio"
```

## 3. Levantar el servidor local

Ejecuta:

```powershell
pnpm dev
```

Cuando este listo, PowerShell debe mostrar algo parecido a:

```text
VITE ready
Local: http://127.0.0.1:5173/
```

Deja esa ventana de PowerShell abierta mientras haces pruebas. Si la cierras, la URL deja de funcionar.

## 4. Abrir la app

En el navegador abre:

```text
http://127.0.0.1:5173/
```

El tablero de avance esta en:

```text
http://127.0.0.1:5173/progress.html
```

## 5. Probar con 3 fotos 360

Flujo recomendado para la primera prueba real:

1. Entra a `http://127.0.0.1:5173/`.
2. Haz clic en **Nuevo tour**.
3. Arrastra o importa tus 3 fotos JPG/JPEG.
4. Renombra las escenas en orden, por ejemplo:
   - `Entrada`
   - `Pasillo`
   - `Fondo`
5. Abre cada escena y guarda su vista inicial.
6. Crea hotspots de navegacion:
   - `Entrada` -> `Pasillo`
   - `Pasillo` -> `Entrada`
   - `Pasillo` -> `Fondo`
   - `Fondo` -> `Pasillo`
7. Usa **Guardar carpeta** para guardar una copia editable.
8. Usa **Exportar tour** para descargar el ZIP estatico.
9. Revisa que el ZIP se descargue sin errores.

## 6. Si la URL no abre

Si `http://127.0.0.1:5173/` no abre, casi siempre significa que el servidor no esta corriendo.

Vuelve a PowerShell y revisa:

- Si `pnpm dev` sigue ejecutandose, no cierres esa ventana.
- Si PowerShell ya volvio al prompt, ejecuta otra vez:

```powershell
pnpm dev
```

## 7. Diferencia con XAMPP

360Tours Studio **no vive en XAMPP**.

XAMPP se usa para proyectos PHP en rutas tipo:

```text
http://localhost/nombre-proyecto/
```

360Tours Studio usa Vite durante desarrollo, por eso vive en:

```text
http://127.0.0.1:5173/
```

## 8. App instalada de Windows

Tambien existe un instalador Windows generado en:

```text
src-tauri\target\release\bundle\nsis\360Tours Studio_0.1.0_x64-setup.exe
```

Para la prueba inicial con fotos reales, usa primero la version web local con `pnpm dev`. Es mas facil de observar y corregir durante desarrollo.
