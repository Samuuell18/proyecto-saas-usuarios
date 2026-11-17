---
type: Proceso
title: Procesos de trabajo
description: Flujo de trabajo, integración continua y despliegue continuo.
timestamp: 2026-11-17
---

# Procesos

## Flujo de trabajo (GitHub Flow)

1. Una rama por cambio, creada desde `main`.
2. Pruebas en local con `npm test` ([cómo ejecutarlas](../README.md#cómo-correr-los-tests)).
3. Pull request contra `main`, aunque lo revise y acepte la misma persona.
4. Merge normal (commit de merge), con el CI en verde.

Comprobado en el historial: 11 pull requests fusionados en el Sprint 1 y 26 al cierre del Sprint 2, y ningún commit directo a `main` (`gh pr list` y `git log --first-parent`). Desviaciones en la [retrospectiva](sprint-1.md#retrospectiva).

## Integración continua

Definida en [.github/workflows/ci.yml](../.github/workflows/ci.yml):

- **Cuándo:** en cada pull request y en cada push a `main`.
- **Qué hace:** instala dependencias con `npm ci` y ejecuta `npm test` con Node 22, en `ubuntu-latest`.
- **Secreto:** la cadena de conexión llega por el secreto del repositorio `MONGODB_URI`, porque las pruebas usan una base de datos real.
- **Resultado:** al cierre del Sprint 1, 18 ejecuciones, todas en verde (de la del PR #3 a la del push del PR #11). Al cierre del Sprint 2, 48 ejecuciones y 47 en verde: la del PR #18 falló porque coincidió con `npm test` en local sobre las mismas bases de prueba de Atlas, y se relanzó (`gh run rerun --failed`). Desde entonces no se lanzan pruebas en local con un CI en marcha.
- **Regla:** no se fusiona un pull request con el CI en rojo.

## Despliegue continuo

Descrito en el [README](../README.md#cicd): Web Service de Render conectado al repositorio con auto-deploy desde `main`. Cada merge se despliega solo, sin pasos manuales. Las variables de entorno se configuran en el panel de Render, no en el repo.

El despliegue funciona de forma independiente del CI (la especificación no exige que espere a las pruebas). El alumno confirma que funciona; en el repo no hay configuración de Render que lo pruebe, así que la evidencia es el panel de Render (Auto-Deploy).

## Protección de main

Hay un ruleset activo llamado `proteger-main` (visto con `gh api`, última actualización el 2026-10-19) con estas reglas: exigir pull request, exigir comprobaciones de estado, impedir borrar `main` e impedir force-push. No hay usuarios con permiso para saltárselo. Por verificar: desde cuándo existe (Settings → Rules en GitHub).
