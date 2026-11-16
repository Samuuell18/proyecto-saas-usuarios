---
type: Requisitos
title: Requisitos del Sprint 1
description: Estado de cada requisito de la especificación, con su evidencia.
timestamp: 2026-10-30
---

# Requisitos

Fuente: especificación del Sprint 1 (apartados 3 a 7). Estados: **hecho**, **parcial** o **pendiente**.
Pruebas: 92 en total (42 en [logica.test.js](../test/logica.test.js), 29 en [api.test.js](../test/api.test.js), 10 en [datos.test.js](../test/datos.test.js), 5 en [propiedad.test.js](../test/propiedad.test.js) y 6 en [variante6.test.js](../test/variante6.test.js)), todas en verde con `npm test` el 2026-11-16 (PBI-12 del [Sprint 2](sprint-2.md)).

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| ARQ-01 | Separación cliente-servidor y mismo origen | Hecho | `express.static` en [api.js](../servidor/api.js); el cliente solo usa `fetch` en [rest.js](../cliente/comunicacion/rest.js). |
| ARQ-02 | Capas del backend: API, lógica y datos | Hecho | `api.js` → `logica.js` → `datos.js`; ver [fronteras](arquitectura.md#fronteras-entre-capas). Observaciones allí. |
| ARQ-03 | Capas del frontend: presentación y comunicación | Hecho | Carpeta `cliente/presentacion/` → `cliente/comunicacion/rest.js` (único con `fetch`). Ver D-22. |
| RF-01 | Registro de usuario local | Hecho | `registrar` en [logica.js](../servidor/logica.js); la cuenta nace pendiente. Pruebas: "registro deja la cuenta en pendiente", "registro con email duplicado da error". |
| RF-02 | Confirmación de cuenta por correo | Hecho | `registrar` crea un token de un solo uso y [correo.js](../servidor/servicios/correo.js) lo envía con Brevo; `GET /api/confirmar` activa la cuenta. Pruebas: "confirmar con token válido activa la cuenta", "el token es de un solo uso". Desde el Sprint 2 (PBI-09) el enlace caduca a las 24 h (`tokenCaducado`, aviso `?error=caducado`) y se puede pedir otro con `POST /api/reenviar`. Pruebas: "confirmar con token caducado da error y la cuenta sigue pendiente", "reenviar a una cuenta pendiente cambia el token y el viejo deja de valer". Por verificar: el envío real en producción lo confirma el alumno (no deja rastro en el repo). Sin clave de Brevo, el enlace solo se deja en el log (desarrollo). |
| RF-03 | Inicio de sesión local | Hecho | `iniciarSesion` en `logica.js`; `POST /api/login`. Pruebas: "login con cuenta pendiente se rechaza", "login con password mal da error". |
| RF-04 | Inicio de sesión con OAuth | Hecho | GitHub y Google en `PROVEEDORES` ([api.js](../servidor/api.js)); `oauthLogin` en `logica.js`. Pruebas de la lógica y de los errores del flujo; el camino feliz con el proveedor real no está automatizado. |
| RF-05 | Cierre de sesión | Hecho | `POST /api/logout`. Prueba: "logout invalida la sesion". |
| RF-06 | Mantenimiento de la sesión entre recargas | Hecho | `express-session` con cookie; el cliente consulta `GET /api/yo` al cargar ([acceso.js](../cliente/presentacion/acceso.js)). Desde el Sprint 2 (PBI-09) la sesión se guarda en MongoDB con `connect-mongo` (colección `sesiones`) y sobrevive a un reinicio del servidor (comprobado a mano el 2026-11-09). Prueba: "la sesion se guarda en MongoDB y el logout la borra (T-27)". |
| RF-07 | Listar usuarios (administrador) | Hecho | `GET /api/usuarios` con `exigirAdmin`. Pruebas: "sin sesion, listar usuarios da 401", "usuario normal listando da 403", "admin listando ve email, rol y estado sin hashes". |
| RF-08 | Comprobar si un usuario está activo (administrador) | Hecho | `GET /api/usuarios/:email/activo`; `comprobarActivo`. Prueba: "comprobar activo: usuario 403, admin 200". |
| RF-09 | Eliminar usuario | Hecho | `DELETE /api/usuarios/:email` (borrado lógico). Pruebas: "usuario normal no puede eliminar a otro (403)", "admin puede eliminar a cualquiera", "usuario eliminado ya no entra". |
| RF-10 | Creación del primer administrador | Hecho | Variable `ADMIN_EMAIL`, aplicada en `registrar` y `oauthLogin`; justificación en el [README](../README.md#cómo-entrar-como-admin). Pruebas: "el email de ADMIN_EMAIL nace admin", "el resto de emails nacen usuario". |
| RNF-01 | Persistencia en una base de datos real | Hecho | MongoDB Atlas desde [datos.js](../servidor/datos/datos.js) y [bd.js](../servidor/datos/bd.js) ([PR #5](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/5), commit `e921385` "verificacion de persistencia"). Ver la observación sobre `logica.js` en [arquitectura](arquitectura.md#fronteras-entre-capas). |
| RNF-02 | Secretos fuera del código y .env.example | Hecho | [.env.example](../.env.example) solo tiene nombres y `.env` está en `.gitignore`. Desde el Sprint 2 (T-24) `api.js` no arranca sin `SESSION_SECRET`: ya no hay valor por defecto para firmar la sesión. El CI usa un valor solo para las pruebas. |
| RNF-03 | Hash seguro de contraseñas | Hecho | `bcryptjs` en `logica.js` (`bcrypt.hash` asíncrono). |
| RNF-04 | Rutas protegidas por sesión y rol | Hecho | `exigirSesion` y `exigirAdmin` en `api.js`. Pruebas de 401 y 403 en `api.test.js`. |
| RNF-05 | Despliegue en cloud con URL pública | Hecho | URL en el [README](../README.md#despliegue-y-entrega-sprint-1); respondió 200 el 2026-10-30 (Render, capa gratuita). |
| RNF-06 | Pruebas unitarias de la lógica (5 o más) | Hecho | 48 pruebas en `logica.test.js` (y 3 de las cuentas del temporizador en `temporizador.test.js`), con casos de error (email duplicado, cuenta pendiente, password mal). |
| RNF-07 | Manejo de errores con feedback al usuario | Hecho | `codigoError` en `api.js` traduce errores a códigos y mensajes; el cliente los muestra. |
| RNF-08 | Registro de actividad (log) | Hecho | [log.js](../servidor/servicios/log.js); eventos como `registro`, `login`, `eliminar`, `eliminar-denegado`, `oauth-login`. |
| PRO-01 | Flujo de trabajo GitHub Flow | Hecho | 15 pull requests hasta el PBI-11, todos fusionados, y ningún commit directo a `main` (`gh pr list`, `git log --first-parent`). Ver [desviaciones](sprint-1.md#retrospectiva). Las pruebas en local previas al PR no se pueden comprobar en el repo. |
| PRO-02 | Integración continua | Hecho | [ci.yml](../.github/workflows/ci.yml); 26 ejecuciones hasta el PBI-11, todas en verde (`gh run list`). Ver [procesos](procesos.md). |
| PRO-03 | Despliegue continuo | Hecho | Render conectado a `main`, descrito en el [README](../README.md#cicd); el alumno confirma que cada merge se despliega solo. No hay configuración de Render en el repo. |

## Requisitos del Sprint 2

Sin especificación del profesor: los define el alumno en el [plan del Sprint 2](sprint-2.md). Se añaden a medida que se cumplen.

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| RF-11 | Datos de Fitness Hub (ejercicios, rutinas, entrenos) | Hecho | Colecciones e índices (PBI-10, T-28) en [bd.js](../servidor/datos/bd.js) y [datos.js](../servidor/datos/datos.js). Pruebas en `datos.test.js`. Ejercicios (PBI-11), rutinas (PBI-12) y entrenos (PBI-13) hechos. |
| RNF-09 | Cada recurso es de su dueño | Hecho (regla) | `comprobarAcceso` en [logica.js](../servidor/logica.js): ajeno o inexistente → 404, ejercicio base solo lectura → 403 (`codigoError` en `api.js`). Pruebas en `propiedad.test.js`. Debe usarla cada ruta que lea o cambie un recurso concreto por id. Las rutas de ejercicios del PBI-11 no lo necesitan: listar filtra por dueño en `datos.js` y crear toma el dueño de la sesión (prueba "el dueño sale de la sesión aunque el cliente mande otro"). Las rutas de rutinas por id (PBI-12) sí la usan (prueba "rutinas: la de otro usuario da 404 al verla, editarla o borrarla"). Las de entrenos (PBI-13) no reciben id: trabajan siempre sobre el entreno en curso del usuario de la sesión; empezar desde una rutina ajena da 404. |
| RF-12 | Catálogo de ejercicios y ejercicios propios | Hecho | 179 ejercicios base en 69 familias y 13 grupos ([catalogo-ejercicios.js](../servidor/datos/catalogo-ejercicios.js)), cargados al arrancar; `GET`/`POST /api/ejercicios`; pantalla [ejercicios.html](../cliente/ejercicios.html) con buscador, filtro y variantes. Pruebas en `datos.test.js`, `logica.test.js` y `api.test.js`; pantalla probada a mano en tamaño móvil. |
| RF-13 | Rutinas: crear, ver, editar y borrar | Hecho | Lógica en `logica.js` (nombre único por usuario, de 1 a 30 ejercicios, series de 1 a 20, repeticiones fijas o en rango de 1 a 100, descanso de 0 a 600 s con 90 por defecto, ejercicios visibles para el usuario); rutas `/api/rutinas`; pantalla [rutinas.html](../cliente/rutinas.html) con buscador de ejercicios y orden. Pruebas en `logica.test.js`, `datos.test.js` y `api.test.js`; pantalla probada a mano en tamaño móvil. |
| RF-14 | Entreno en vivo (libre o desde una rutina) | Hecho | Lógica en `logica.js` (uno en curso por usuario, series copiadas de la rutina con su objetivo, peso de 0 a 1000 kg, repeticiones de 0 a 100, terminar guarda solo las series hechas, descartar); rutas `/api/entrenos` y `/api/entrenos/actual/…`; pantalla [entreno.html](../cliente/entreno.html) pensada para el móvil, que guarda cada cambio al momento y retoma el entreno en curso al recargar. Ver D-20. Pruebas en `logica.test.js`, `datos.test.js` y `api.test.js`; pantalla probada a mano en tamaño móvil. |
| RF-15 | Temporizador de descanso | Hecho | Al marcar una serie, ventana que propone su descanso (el de la rutina o 90 s, ajustable ±15) y bloquea la pantalla hasta empezarlo o saltarlo; cuenta atrás en [entreno.js](../cliente/presentacion/entreno.js) con botones −15/+15 y 60/90/120, saltar, aviso con sonido y vibración, y sigue contando tras recargar. Cuentas puras en [temporizador.js](../cliente/presentacion/temporizador.js) con pruebas en `temporizador.test.js`. Ver D-21. Probado a mano en tamaño móvil. Sin notificaciones con la app cerrada (más adelante). |
