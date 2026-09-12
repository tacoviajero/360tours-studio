# HomeTours Studio

Aplicacion local-first para Windows orientada a convertir fotografias 360 en recorridos virtuales estaticos y publicarlos en TacoViajero.

Este repositorio no es el sitio comercial de HomeTours360. Es la herramienta de produccion local.

## Objetivo

El flujo principal del producto es:

```text
Fotos 360
↓
Studio
↓
Editar escenas y hotspots
↓
Preview
↓
Exportar
↓
Publicar
```

Los recorridos publicados deben vivir como sitios estaticos autonomos en:

```text
https://tacoviajero.com/tours/[slug]/
```

## Documentos clave

- [PLAN_MAESTRO.md](./PLAN_MAESTRO.md): plan completo del proyecto.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): separacion tecnica inicial.
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md): comandos locales.
- [docs/READY_TO_START.md](./docs/READY_TO_START.md): estado exacto para comenzar desarrollo.

## Stack inicial

- TypeScript
- Vite
- Marzipano
- pnpm
- Git
- Filesystem + JSON como direccion de persistencia
- Tauri como objetivo futuro de empaquetado Windows

## Comandos

Instalar dependencias:

```powershell
pnpm install
```

Ejecutar desarrollo local:

```powershell
pnpm dev
```

Verificar tipos:

```powershell
pnpm typecheck
```

Generar build:

```powershell
pnpm build
```

## Regla principal

No construir SaaS. No depender de WordPress. No introducir base de datos remota, backend publico ni infraestructura cloud por defecto.

La app debe hacer una sola cosa muy bien: recibir fotos 360, convertirlas en un tour profesional y publicarlo de forma segura con el minimo trabajo manual posible.

