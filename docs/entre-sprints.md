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

**Decisión del alumno (18-nov):** de momento no se compra dominio; la app sigue en el subdominio de Render. T-68, T-69 y T-70 quedan aplazadas (las dos últimas necesitan el dominio). T-67 no depende del dominio.
