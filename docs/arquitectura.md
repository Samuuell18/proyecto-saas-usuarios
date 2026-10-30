---
type: Arquitectura
title: Arquitectura del Sprint 1
description: Capas del backend y del frontend, fronteras exactas y endpoints.
timestamp: 2026-10-30
---

# Arquitectura

Resumen y motivos de cada tecnología en el [README](../README.md#arquitectura). Aquí solo la estructura y las fronteras.

## Visión general

El backend Express sirve el frontend (mismo origen, `express.static` en [api.js](../servidor/api.js)). El cliente solo habla con el servidor por la API.

## Backend (3 capas)

| Capa | Archivo | Responsabilidad |
|---|---|---|
| API | [servidor/api.js](../servidor/api.js) | Rutas HTTP, sesión, middlewares `exigirSesion` y `exigirAdmin`, traducción de errores a códigos HTTP. |
| Lógica | [servidor/logica.js](../servidor/logica.js) | Registro, login, confirmación, eliminar, listar, `oauthLogin`, `calcularEstado`. |
| Datos | [servidor/datos.js](../servidor/datos.js) | Único módulo que consulta la base de datos (colecciones `usuarios` y `confirmaciones`). |

Apoyo: [bd.js](../servidor/bd.js) (conexión; solo lo importa `datos.js`), [correo.js](../servidor/correo.js) (envío con Brevo) y [log.js](../servidor/log.js).

## Frontend (2 capas)

| Capa | Archivos |
|---|---|
| Presentación | [index.html](../cliente/index.html), [inicio.html](../cliente/inicio.html), [privacidad.html](../cliente/privacidad.html), [controlador.js](../cliente/controlador.js), [inicio.js](../cliente/inicio.js), [styles.css](../cliente/styles.css) |
| Comunicación | [rest.js](../cliente/rest.js): el único que hace `fetch` |

## Fronteras entre capas

- **Cliente → servidor:** `controlador.js` e `inicio.js` importan solo de `rest.js`; solo `rest.js` llama a `fetch`.
- **API → lógica:** `api.js` importa `logica.js` y `log.js`; no importa `datos.js`.
- **Lógica → datos:** `logica.js` importa `datos.js`; nunca toca la base de datos directamente.
- **Datos → BBDD:** solo `datos.js` importa `bd.js`.

Observaciones (no son errores del Sprint 1, pero conviene saberlas):

- La regla "un usuario normal solo elimina su propia cuenta" está en `api.js` (ruta `DELETE /api/usuarios/:email`), no en `logica.js`.
- El flujo OAuth (llamadas a GitHub y Google) vive en `api.js`, en la tabla `PROVEEDORES`.
- `logica.js` importa `correo.js` directamente; el servicio externo no se inyecta.
- Al pasar de memoria a Atlas ([PR #5](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/5)), `logica.js` también cambió: sus funciones pasaron a `async` y `activar` pasó a persistir con `datos.actualizarEstado`.

## Endpoints

| Método y ruta | Quién puede | Resultados |
|---|---|---|
| `POST /api/registro` | Público | 201 · 400 · 409 |
| `POST /api/login` | Público | 200 · 401 · 403 (cuenta pendiente) |
| `GET /api/confirmar?token=` | Público | Redirige a `/` |
| `POST /api/logout` | Cualquiera (cierra la sesión si existe) | 200 |
| `GET /api/yo` | Sesión | 200 · 401 |
| `GET /api/usuarios` | Administrador | 200 · 401 · 403 |
| `GET /api/usuarios/:email/activo` | Administrador | 200 · 401 · 403 |
| `DELETE /api/usuarios/:email` | Sesión: el administrador a cualquiera, el usuario solo a sí mismo | 200 · 401 · 403 · 404 |
| `GET /api/oauth/{github,google}` | Público | Redirección · 501 sin configurar · 404 (otro proveedor) |
| `GET /api/oauth/{github,google}/callback` | Público | Redirección · 400 · 403 · 501 · 404 |
| `POST /api/prueba/estado` | Público | 200 · 400 (prueba técnica, variante 6) |

## Modelo de datos

- `usuarios`: `email` (único), `hash`, `estado` (`pendiente`, `activo`, `eliminado`), `rol` (`usuario`, `admin`).
- `confirmaciones`: `email`, `token` de un solo uso, `creado`.

Variables de entorno: solo los nombres, en [.env.example](../.env.example).
