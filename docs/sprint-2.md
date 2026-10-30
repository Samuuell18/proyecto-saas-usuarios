---
type: Sprint
title: Sprint 2
description: Objetivo por definir y trabajo que pasa del Sprint 1.
timestamp: 2026-10-30
---

# Sprint 2

**Objetivo:** Por definir (falta la especificación del profesor).

## Requisitos que pasan del Sprint 1

| ID | Estado | Qué falta |
|---|---|---|
| RNF-02 | Parcial | Quitar el valor fijo por defecto de `SESSION_SECRET` en [api.js](../servidor/api.js) para que la sesión nunca se firme con un valor público. |

## Observaciones que conviene resolver

No incumplen la especificación del Sprint 1, pero afectan al trabajo siguiente:

- **Regla de eliminación en la API:** "un usuario normal solo elimina su propia cuenta" está en `api.js`; moverla a `logica.js` la haría comprobable con pruebas unitarias de la lógica. Ver [arquitectura](arquitectura.md#fronteras-entre-capas).
- **Servicios externos sin inyectar:** `logica.js` importa `correo.js`. Para probar la lógica con dobles hay que inyectarlo desde la composición.
- **Sesiones en memoria (RF-06):** se pierden al reiniciar el servidor.
- **Tokens de confirmación:** no caducan, y deberían. Se implementará en el Sprint 2.
- **Endpoint público `POST /api/prueba/estado`:** ver D-13 en [decisiones](decisiones.md#d-13-endpoint-público-de-la-prueba-técnica).
- **Etiquetas de hito:** no existen `hito-*` ni `sprint-1`.
- **Pruebas de OAuth:** el camino feliz con el proveedor real no está automatizado.
