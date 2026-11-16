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
| Lógica | [servidor/logica.js](../servidor/logica.js) | Registro, login, confirmación, eliminar, listar, `oauthLogin`, `calcularEstado`, regla de propiedad `comprobarAcceso`, reglas de ejercicios (`listarEjercicios`, `crearEjercicio`) de rutinas (`normalizarLineaRutina`, `crearRutina`, `actualizarRutina`…) y de entrenos (`seriesDesdeRutina`, `normalizarSerie`, `iniciarEntreno`, `terminarEntreno`…). |
| Datos | [servidor/datos.js](../servidor/datos.js) | Único módulo que consulta la base de datos (colecciones `usuarios` y `confirmaciones`) y crea el almacén de sesiones (`sesiones`, con `connect-mongo`). |

Apoyo: [bd.js](../servidor/bd.js) (conexión; solo lo importa `datos.js`), [catalogo-ejercicios.js](../servidor/catalogo-ejercicios.js) (datos: grupos musculares y ejercicios base; solo lo importa `datos.js`), [correo.js](../servidor/correo.js) (envío con Brevo) y [log.js](../servidor/log.js).

## Frontend (2 capas)

| Capa | Archivos |
|---|---|
| Presentación | [index.html](../cliente/index.html), [inicio.html](../cliente/inicio.html), [privacidad.html](../cliente/privacidad.html), [controlador.js](../cliente/controlador.js), [inicio.js](../cliente/inicio.js), [ejercicios.html](../cliente/ejercicios.html), [ejercicios.js](../cliente/ejercicios.js), [rutinas.html](../cliente/rutinas.html), [rutinas.js](../cliente/rutinas.js), [entreno.html](../cliente/entreno.html), [entreno.js](../cliente/entreno.js), [temporizador.js](../cliente/temporizador.js) (cuentas del descanso, puras), [busqueda.js](../cliente/busqueda.js) (buscar ejercicios, compartido), [styles.css](../cliente/styles.css) |
| Comunicación | [rest.js](../cliente/rest.js): el único que hace `fetch` |

## Fronteras entre capas

- **Cliente → servidor:** `controlador.js` e `inicio.js` importan solo de `rest.js`; solo `rest.js` llama a `fetch`.
- **API → lógica:** `api.js` importa `logica.js` y `log.js`; no importa `datos.js`.
- **Lógica → datos:** `logica.js` importa `datos.js`; nunca toca la base de datos directamente.
- **Datos → BBDD:** solo `datos.js` importa `bd.js`.

Observaciones (no son errores del Sprint 1, pero conviene saberlas):

- El almacén de sesiones (Sprint 2, T-27) lo crea `datos.js`; `logica.js` solo lo reexporta para que `api.js` siga sin importar `datos.js` ni `bd.js`.
- La regla "un usuario normal solo elimina su propia cuenta" está en `api.js` (ruta `DELETE /api/usuarios/:email`), no en `logica.js`.
- El flujo OAuth (llamadas a GitHub y Google) vive en `api.js`, en la tabla `PROVEEDORES`.
- `logica.js` importa `correo.js` directamente; el servicio externo no se inyecta.
- Al pasar de memoria a Atlas ([PR #5](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/5)), `logica.js` también cambió: sus funciones pasaron a `async` y `activar` pasó a persistir con `datos.actualizarEstado`.

## Endpoints

| Método y ruta | Quién puede | Resultados |
|---|---|---|
| `POST /api/registro` | Público | 201 · 400 · 409 |
| `POST /api/login` | Público | 200 · 401 · 403 (cuenta pendiente) |
| `GET /api/confirmar?token=` | Público | Redirige a `/?confirmado=1`, `/?error=token` o `/?error=caducado` |
| `POST /api/reenviar` | Público | 200 siempre (no revela si el email tiene cuenta) |
| `GET /api/ejercicios` | Sesión | 200 (base + propios del usuario) · 401 |
| `GET /api/ejercicios/grupos` | Sesión | 200 (13 grupos musculares) · 401 |
| `POST /api/ejercicios` | Sesión (el dueño sale de la sesión) | 201 · 400 · 401 · 409 |
| `GET /api/rutinas` | Sesión | 200 (resumen de las rutinas del usuario) · 401 |
| `POST /api/rutinas` | Sesión | 201 · 400 · 401 · 409 |
| `GET /api/rutinas/:id` | Sesión, solo el dueño (`comprobarAcceso`) | 200 · 401 · 404 |
| `PUT /api/rutinas/:id` | Sesión, solo el dueño | 200 · 400 · 401 · 404 · 409 |
| `DELETE /api/rutinas/:id` | Sesión, solo el dueño | 200 · 401 · 404 |
| `GET /api/entrenos/actual` | Sesión | 200 (el entreno en curso del usuario, o `null`) · 401 |
| `POST /api/entrenos` | Sesión (`rutinaId` propio u omitido = libre) | 201 · 401 · 404 · 409 (ya hay uno en curso) |
| `POST /api/entrenos/actual/series` | Sesión | 201 · 400 · 401 · 404 |
| `PUT /api/entrenos/actual/series/:serieId` | Sesión | 200 · 400 · 401 · 404 |
| `DELETE /api/entrenos/actual/series/:serieId` | Sesión | 200 · 401 · 404 |
| `POST /api/entrenos/actual/terminar` | Sesión | 200 · 400 (ninguna serie hecha) · 401 · 404 |
| `DELETE /api/entrenos/actual` | Sesión | 200 · 401 · 404 |
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
- `confirmaciones`: `email`, `token` de un solo uso, `creado` (el token caduca 24 h después).
- `sesiones`: la gestiona `connect-mongo` (identificador de sesión, datos y fecha de caducidad; se borran solas a los 14 días).

Fitness Hub (Sprint 2, PBI-10). `dueno` es el email del usuario; el peso siempre en kg. Detalle comentado en [datos.js](../servidor/datos.js) y motivos en D-16.

- `ejercicios`: `nombre`, `grupo`, `dueno` (`null` = ejercicio base, visible para todos), `creado`. Índice único `{dueno, nombre}` sin distinguir mayúsculas.
- `rutinas`: `dueno`, `nombre` (único por usuario), `ejercicios: [{ ejercicioId, series, repeticiones: { min, max }, descansoSeg }]` (el objetivo; incrustado y en orden), `creada`, `actualizada`. Índice único `{dueno, nombre}` sin distinguir mayúsculas (D-19).
- `entrenos`: `dueno`, `rutinaId` (`null` = entreno libre), `rutinaNombre` (copia), `inicio`, `fin` (`null` = en curso), `series: [{ id, ejercicioId, nombre, pesoKg, repeticiones, hecha, objetivo: { min, max } | null, descansoSeg }]` (incrustado; `nombre`, `objetivo` y `descansoSeg` son copias). Índice `{dueno, inicio}` descendente e índice único parcial `{dueno}` para los que tienen `fin: null` (un solo entreno en curso, D-20).

Los índices se crean una sola vez por base en [bd.js](../servidor/bd.js) (`crearIndices`). Acceso a estos recursos: regla `comprobarAcceso` de `logica.js` (D-17).

Variables de entorno: solo los nombres, en [.env.example](../.env.example).
