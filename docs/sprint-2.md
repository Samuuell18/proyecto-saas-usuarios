---
type: Sprint
title: Sprint 2
description: MVP de Fitness Hub, plan por hitos y avance de cada PBI.
timestamp: 2026-11-09
---

# Sprint 2

**Objetivo:** MVP de Fitness Hub usable en el móvil: registrarse, crear rutinas, entrenar en vivo (o libre), temporizador de descanso, kg/lb, historial y métricas. No hay especificación del profesor para este sprint: el alcance lo define el alumno.

Plan: 5 hitos, 11 PBIs (PBI-09 a PBI-19) y 30 tareas (T-24 a T-53). Una rama y un pull request por PBI, con código, pruebas y `docs/` juntos.

| Hito | PBIs | Estado |
|---|---|---|
| 1 Cimientos y seguridad | PBI-09 sesión segura y tokens con caducidad · PBI-10 modelo de datos fitness | PBI-09 hecho |
| 2 Ejercicios y rutinas | PBI-11 catálogo de ejercicios · PBI-12 rutinas | Pendiente |
| 3 Entrenar | PBI-13 entreno en vivo · PBI-14 temporizador · PBI-15 kg/lb | Pendiente |
| 4 Progreso | PBI-16 historial · PBI-17 métricas | Pendiente |
| 5 Móvil y cierre | PBI-18 responsive · PBI-19 cierre del sprint | Pendiente |

## Hito 1: cimientos y seguridad

### PBI-09 Sesión segura y tokens con caducidad

- **T-24:** `SESSION_SECRET` obligatorio; sin él el servidor no arranca. Cierra RNF-02, que venía parcial del Sprint 1. El CI usa un valor solo para las pruebas.
- **T-25:** el enlace de confirmación caduca a las 24 h (`tokenCaducado` en `logica.js`). Ver D-15 en [decisiones](decisiones.md#d-15-enlaces-de-confirmación-con-caducidad-y-reenvío).
- **T-26:** aviso de enlace caducado y botón "Reenviar enlace de confirmación" (`POST /api/reenviar`). El botón también aparece si se intenta entrar con la cuenta pendiente.
- **T-27:** sesiones en MongoDB con `connect-mongo`; sobreviven a un reinicio del servidor. Ver D-14 en [decisiones](decisiones.md#d-14-sesiones-en-mongodb-con-connect-mongo).
- **Pruebas:** de 50 a 56, todas en verde.
- **Aprendido:** con el almacén en MongoDB, `express-session` termina la respuesta solo cuando la sesión está guardada; las pruebas tienen que leer el cuerpo de la respuesta (como hace `rest.js`) antes de la siguiente petición.

## Observaciones que conviene resolver

Vienen del Sprint 1 y quedan fuera del plan salvo que se acuerde lo contrario:

- **Regla de eliminación en la API:** "un usuario normal solo elimina su propia cuenta" está en `api.js`; moverla a `logica.js` la haría comprobable con pruebas unitarias de la lógica. Ver [arquitectura](arquitectura.md#fronteras-entre-capas).
- **Servicios externos sin inyectar:** `logica.js` importa `correo.js`. Para probar la lógica con dobles hay que inyectarlo desde la composición.
- **Endpoint público `POST /api/prueba/estado`:** ver D-13 en [decisiones](decisiones.md#d-13-endpoint-público-de-la-prueba-técnica).
- **Etiquetas de hito:** no existen `hito-*` ni `sprint-1`.
- **Pruebas de OAuth:** el camino feliz con el proveedor real no está automatizado.
- **Reenvío sin límite:** `POST /api/reenviar` no limita cuántos correos se pueden pedir.
- **Dependencias:** `npm audit` avisa de `body-parser` y `qs` (ya estaban en el Sprint 1); se arreglan con `npm audit fix`.

Resueltas en el PBI-09: sesiones en memoria (RF-06) y tokens de confirmación sin caducidad.
