---
type: Sprint
title: Sprint 1
description: Qué se hizo en cada hito del Sprint 1, con sus PR, y retrospectiva.
timestamp: 2026-10-30
---

# Sprint 1

Objetivo y alcance: apartados 1 a 8 de la especificación (base SaaS en capas con gestión de usuarios). Las tareas del día a día están en el [tablero de Donetonic](https://app.donetonic.com/workspaces/1/projects/1/backlog) (requiere iniciar sesión); aquí no se copian.

Pull requests: [lista en GitHub](https://github.com/Samuuell18/proyecto-saas-usuarios/pulls?q=is%3Apr). No hay etiquetas `hito-*` en el repositorio (`git tag` vacío).

## Hito 1: esqueleto y backend

- **Objetivo (apartado 10):** repositorio y flujo con ramas y PR; CI y despliegue continuo desde el primer día; lógica de usuarios con datos en memoria y sus pruebas; API que la expone.
- **Qué se hizo:** repo, README y `.gitignore` ([PR #1](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/1), 30-sep); separación en capas cliente y servidor ([PR #2](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/2), 1-oct); base con datos en memoria, registro y login (`6c70252`, `2e36d6f`) y CI (`7324a84`, `T-07`) en el [PR #3](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/3) (7-oct).
- **PR y etiqueta:** #1, #2 y #3; sin etiqueta.
- **Desviaciones:** el CI llegó con el PR #3, no el primer día; los PR #1 y #2 se fusionaron sin ejecución de CI. Por verificar: la fecha del primer despliegue (panel de Render).

## Hito 2: frontend y sesión

- **Objetivo:** interfaz y cliente de comunicación separados; registro y login con hash; cierre y mantenimiento de la sesión; rutas protegidas.
- **Qué se hizo:** formularios de registro y login con `rest.js` y sesión (`8428fc2`, `T-05`) en el PR #3; estilo del acceso y pruebas extra (`4d2ca63`, `236e588`) en el [PR #4](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/4) (8-oct). Las restricciones de rol con 403 llegaron en `9edd3de` (`T-18`, PR #6).
- **PR y etiqueta:** #3 y #4; sin etiqueta.
- **Desviaciones:** el PR #3 mezcla trabajo de los Hitos 1 y 2 (backend, frontend y CI en un solo PR).

## Hito 3: persistencia y roles

- **Objetivo:** acceso a datos contra una base real sin cambiar la lógica; secretos en variables de entorno; roles con restricciones en el servidor; log.
- **Qué se hizo:** MongoDB Atlas (`584e105`, `e921385`) en el [PR #5](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/5) (8-oct); primer admin por `ADMIN_EMAIL` (`ae09907`), roles con 403 y pruebas HTTP (`9edd3de`) y log (`46327c2`) en el [PR #6](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/6) (9-oct).
- **PR y etiqueta:** #5 y #6; sin etiqueta.
- **Desviaciones:** la lógica sí cambió al introducir la base de datos (pasó a `async`, y `activar` pasó a persistir mediante `datos`). Es el punto que la especificación pide revisar; ver [arquitectura](arquitectura.md#fronteras-entre-capas).

## Hito 4: servicios externos y cierre

- **Objetivo:** OAuth con un proveedor externo; confirmación por correo; errores con feedback, README y revisión final.
- **Qué se hizo:** OAuth con GitHub (`273ad6c`) y confirmación por correo con Resend (`e3bfd13`) en el [PR #7](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/7) (10-oct); mini-panel de administración y README final (`fdd5b82`, `408cdc8`) en el [PR #8](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/8) (13-oct).
- **PR y etiqueta:** #7 y #8; sin etiqueta.
- **Desviaciones:** ninguna que se vea en el historial.

## Después del Hito 4

- [PR #9](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/9) (15-oct): prueba técnica, variante 6 (`calcularEstado`, endpoint y 6 pruebas).
- [PR #10](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/10) (29-oct), cierre del sprint: LF fijo en `.gitattributes`; borrado lógico, eliminar mi cuenta, corrección de XSS y bcrypt asíncrono; cambio de Resend a Brevo; rediseño de la interfaz; login con Google; mejora del log de Brevo.
- [PR #11](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/11) (29-oct): página de política de privacidad.

## Retrospectiva

### Hechos

- 11 pull requests fusionados, con 50 pruebas en verde y 18 ejecuciones del CI en verde (ver [requisitos](requisitos.md) y [procesos](procesos.md)).
- Todos los requisitos cumplidos salvo RNF-02, parcial (ver [sprint-2](sprint-2.md)).

Desviaciones del flujo, vistas con `gh` y `git`:

- Ninguna etiqueta `hito-*` ni `sprint-1`.
- Nombres de rama sin criterio común (`nueva-rama`, `new-branch`, `PBI-02`, `cierre-sprint1`...).
- PR #1 y #2 fusionados sin CI (el workflow no existía aún).
- PR #3 y #10 agrupan mucho trabajo distinto en un solo PR.
- El ruleset `proteger-main` consta como actualizado el 2026-10-19; Por verificar: desde cuándo existe (Settings → Rules en GitHub), porque los PR #1 a #9 son anteriores.

### Qué funcionó

TODO(alumno): ¿qué te salió bien en el proceso o en el código de este sprint?

### Qué cambiaría

TODO(alumno): ¿qué harías distinto en el Sprint 2 (PR más pequeños, etiquetas, pruebas de la lógica, etc.)?
