---
type: Requisitos
title: Requisitos del Sprint 1
description: Estado de cada requisito de la especificación, con su evidencia.
timestamp: 2026-10-30
---

# Requisitos

Fuente: especificación del Sprint 1 (apartados 3 a 7). Estados: **hecho**, **parcial** o **pendiente**.
Pruebas: 50 en total (26 en [logica.test.js](../test/logica.test.js), 18 en [api.test.js](../test/api.test.js) y 6 en [variante6.test.js](../test/variante6.test.js)), todas en verde con `npm test` el 2026-10-30.

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| ARQ-01 | Separación cliente-servidor y mismo origen | Hecho | `express.static` en [api.js](../servidor/api.js); el cliente solo usa `fetch` en [rest.js](../cliente/rest.js). |
| ARQ-02 | Capas del backend: API, lógica y datos | Hecho | `api.js` → `logica.js` → `datos.js`; ver [fronteras](arquitectura.md#fronteras-entre-capas). Observaciones allí. |
| ARQ-03 | Capas del frontend: presentación y comunicación | Hecho | `controlador.js` e `inicio.js` → `rest.js`. |
| RF-01 | Registro de usuario local | Hecho | `registrar` en [logica.js](../servidor/logica.js); la cuenta nace pendiente. Pruebas: "registro deja la cuenta en pendiente", "registro con email duplicado da error". |
| RF-02 | Confirmación de cuenta por correo | Hecho | `registrar` crea un token de un solo uso y [correo.js](../servidor/correo.js) lo envía con Brevo; `GET /api/confirmar` activa la cuenta. Pruebas: "confirmar con token válido activa la cuenta", "el token es de un solo uso". Por verificar: el envío real en producción lo confirma el alumno (no deja rastro en el repo). Sin clave de Brevo, el enlace solo se deja en el log (desarrollo). |
| RF-03 | Inicio de sesión local | Hecho | `iniciarSesion` en `logica.js`; `POST /api/login`. Pruebas: "login con cuenta pendiente se rechaza", "login con password mal da error". |
| RF-04 | Inicio de sesión con OAuth | Hecho | GitHub y Google en `PROVEEDORES` ([api.js](../servidor/api.js)); `oauthLogin` en `logica.js`. Pruebas de la lógica y de los errores del flujo; el camino feliz con el proveedor real no está automatizado. |
| RF-05 | Cierre de sesión | Hecho | `POST /api/logout`. Prueba: "logout invalida la sesion". |
| RF-06 | Mantenimiento de la sesión entre recargas | Hecho | `express-session` con cookie; el cliente consulta `GET /api/yo` al cargar ([controlador.js](../cliente/controlador.js)). Limitación: la sesión vive en memoria del servidor y se pierde si este se reinicia. Sin prueba automatizada de la recarga. |
| RF-07 | Listar usuarios (administrador) | Hecho | `GET /api/usuarios` con `exigirAdmin`. Pruebas: "sin sesion, listar usuarios da 401", "usuario normal listando da 403", "admin listando ve email, rol y estado sin hashes". |
| RF-08 | Comprobar si un usuario está activo (administrador) | Hecho | `GET /api/usuarios/:email/activo`; `comprobarActivo`. Prueba: "comprobar activo: usuario 403, admin 200". |
| RF-09 | Eliminar usuario | Hecho | `DELETE /api/usuarios/:email` (borrado lógico). Pruebas: "usuario normal no puede eliminar a otro (403)", "admin puede eliminar a cualquiera", "usuario eliminado ya no entra". |
| RF-10 | Creación del primer administrador | Hecho | Variable `ADMIN_EMAIL`, aplicada en `registrar` y `oauthLogin`; justificación en el [README](../README.md#cómo-entrar-como-admin). Pruebas: "el email de ADMIN_EMAIL nace admin", "el resto de emails nacen usuario". |
| RNF-01 | Persistencia en una base de datos real | Hecho | MongoDB Atlas desde [datos.js](../servidor/datos.js) y [bd.js](../servidor/bd.js) ([PR #5](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/5), commit `e921385` "verificacion de persistencia"). Ver la observación sobre `logica.js` en [arquitectura](arquitectura.md#fronteras-entre-capas). |
| RNF-02 | Secretos fuera del código y .env.example | Parcial | [.env.example](../.env.example) solo tiene nombres y `.env` está en `.gitignore`. Falta: `api.js` usa un valor fijo por defecto para firmar la sesión si no existe `SESSION_SECRET`. |
| RNF-03 | Hash seguro de contraseñas | Hecho | `bcryptjs` en `logica.js` (`bcrypt.hash` asíncrono). |
| RNF-04 | Rutas protegidas por sesión y rol | Hecho | `exigirSesion` y `exigirAdmin` en `api.js`. Pruebas de 401 y 403 en `api.test.js`. |
| RNF-05 | Despliegue en cloud con URL pública | Hecho | URL en el [README](../README.md#despliegue-y-entrega-sprint-1); respondió 200 el 2026-10-30 (Render, capa gratuita). |
| RNF-06 | Pruebas unitarias de la lógica (5 o más) | Hecho | 26 pruebas en `logica.test.js`, con casos de error (email duplicado, cuenta pendiente, password mal). |
| RNF-07 | Manejo de errores con feedback al usuario | Hecho | `codigoError` en `api.js` traduce errores a códigos y mensajes; el cliente los muestra. |
| RNF-08 | Registro de actividad (log) | Hecho | [log.js](../servidor/log.js); eventos como `registro`, `login`, `eliminar`, `eliminar-denegado`, `oauth-login`. |
| PRO-01 | Flujo de trabajo GitHub Flow | Hecho | 11 pull requests, todos fusionados, y ningún commit directo a `main` (`gh pr list`, `git log --first-parent`). Ver [desviaciones](sprint-1.md#retrospectiva). Las pruebas en local previas al PR no se pueden comprobar en el repo. |
| PRO-02 | Integración continua | Hecho | [ci.yml](../.github/workflows/ci.yml); 18 ejecuciones, todas en verde (`gh run list`). Ver [procesos](procesos.md). |
| PRO-03 | Despliegue continuo | Hecho | Render conectado a `main`, descrito en el [README](../README.md#cicd); el alumno confirma que cada merge se despliega solo. No hay configuración de Render en el repo. |
