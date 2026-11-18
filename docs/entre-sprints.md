---
type: Sprint
title: Entre sprints
description: Mejoras hechas después de cerrar el Sprint 2 y antes de saber cómo será el Sprint 3.
timestamp: 2026-11-18
---

# Entre sprints

El Sprint 2 se cerró el 2026-11-17 (etiqueta `sprint-2`) y no hay aún especificación del Sprint 3. El alumno sigue mejorando la app con el mismo proceso: PBIs y tareas en `seguimiento-sprints.xlsx` (sprint "Entre sprints"), una rama y un pull request por PBI, con código, pruebas y `docs/` juntos. La etiqueta `sprint-2` sigue marcando lo entregado. Si llega el Sprint 3, este trabajo se presenta como incremento previo.

## PBI-22 Pulido y alojamiento

Sale de lo que el alumno notó usando la app y de cómo alojarla mejor sin pagar.

| Tarea | Qué | Estado |
|---|---|---|
| T-65 | Tic visible: ✓ gris siempre y naranja cuando la serie está lista (D-36) | Hecho (falta probar en el iPhone) |
| T-66 | Mantener Render despierto con un ping externo cada 10 min (D-37) | Hecho (tarea en cron-job.org creada por el alumno) |
| T-67 | Servicio nuevo de Render "forja" en Frankfurt (misma región que Atlas): variables, callbacks OAuth y borrar el viejo | Pendiente |
| T-68 | Dominio propio: comprarlo y enlazarlo en Render con HTTPS; callbacks OAuth | Aplazada |
| T-69 | Correo de Brevo desde el dominio propio (SPF y DKIM) para no ir a spam | Aplazada |
| T-70 | Verificar la marca en Google Cloud con el dominio (quitar el aviso de app no verificada) | Aplazada |
| T-71 | Nombre Forja fuera de la app: apps OAuth, Brevo y memoria | Pendiente |
| T-72 | Recordar la sesión: cookie de 30 días renovada con el uso y segura en producción (el alumno notó que la app le pide entrar a menudo) (D-38) | Hecho |
| T-73 | Clave privada VAPID y correo con valores reales en `.env.example` (repo público, desde la T-55): vaciar el archivo y rotar las claves en `.env` y Render (hecho por el alumno el 18-nov; la clave vieja, que sigue en el historial, ya no sirve). Revisado el resto del repo y su historial (Mongo, Brevo, Google, GitHub): sin más secretos | Hecho |
| T-74 | Auditoría de seguridad (OWASP Top 10:2025): informe en [seguridad.md](seguridad.md); los arreglos van al PBI-23 | Hecho |
| T-75 | Rediseño más premium y moderno manteniendo la paleta Energía: estilo "marcador" en todas las pantallas (D-39) | Hecho |

**Decisión del alumno (18-nov):** de momento no se compra dominio; la app sigue en el subdominio de Render. T-68, T-69 y T-70 quedan aplazadas (las dos últimas necesitan el dominio). T-67 no depende del dominio.

## PBI-23 Seguridad

Sale de la auditoría de la T-74 ([seguridad.md](seguridad.md)). **Decisión del alumno (18-nov):** todos los hallazgos se arreglan, en un PBI propio (su rama y su PR), separado del PBI-22. Se hicieron todas el 18-nov, en orden y con un commit por tarea, cada una con su prueba (162 tests en verde). Decisión de diseño en D-40. **Falta en Render:** poner la variable `NODE_ENV=production` (T-80).

| Tarea | Hallazgo | Qué | Estado |
|---|---|---|---|
| T-76 | A07-001 (alta) | OAuth no hereda la contraseña de una cuenta pendiente (pre-secuestro): hash aleatorio y borrar sus tokens, con test | Hecho |
| T-77 | A07-002, A06-001 (media) | Límite de intentos en login, registro y reenviar (por IP y email) y contraseña mínima de 8 | Hecho |
| T-78 | A01-001 (baja) | Avisos push: solo direcciones de los servicios de Apple, Google, Mozilla y Microsoft; log de error recortado | Hecho |
| T-79 | A06-002 (baja) | Cabeceras de seguridad (CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`) y quitar `X-Powered-By` | Hecho |
| T-80 | A10-001 (baja) | Manejador de errores propio (500 sin traza) y `NODE_ENV=production` en Render | Hecho |
| T-81 | A07-003 (baja) | Regenerar la sesión al entrar (login y OAuth) | Hecho |
| T-82 | A09-001, A09-002 (baja) | Email validado sin espacios ni saltos, log sin saltos de línea y `login-fallido` con email e IP | Hecho |
| T-83 | A07-004 (informativo) | Login: comprobar la contraseña antes de decir que la cuenta está pendiente | Hecho |
| T-84 | A04-001 (informativo) | Guardar el SHA-256 de los tokens de confirmación en vez del token | Hecho |
| T-85 | A08-001 (informativo) | Fijar las acciones del CI por SHA | Hecho |
