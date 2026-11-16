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
| 1 Cimientos y seguridad | PBI-09 sesión segura y tokens con caducidad · PBI-10 modelo de datos fitness | PBI-09 y PBI-10 hechos |
| 2 Ejercicios y rutinas | PBI-11 catálogo de ejercicios · PBI-12 rutinas | PBI-11 y PBI-12 hechos |
| 3 Entrenar | PBI-13 entreno en vivo · PBI-14 temporizador · PBI-15 kg/lb | Pendiente |
| 4 Progreso | PBI-16 historial · PBI-17 métricas | Pendiente |
| 5 Móvil y cierre | PBI-18 responsive · PBI-19 cierre del sprint | Pendiente |

## Hito 1: cimientos y seguridad

### PBI-09 Sesión segura y tokens con caducidad

- **T-24:** `SESSION_SECRET` obligatorio; sin él el servidor no arranca. Cierra RNF-02, que venía parcial del Sprint 1. El CI usa un valor solo para las pruebas.
- **T-25:** el enlace de confirmación caduca a las 24 h (`tokenCaducado` en `logica.js`). Ver D-15 en [decisiones](decisiones.md#d-15-enlaces-de-confirmación-con-caducidad-y-reenvío).
- **T-26:** aviso de enlace caducado y botón "Reenviar enlace de confirmación" (`POST /api/reenviar`). El botón también aparece si se intenta entrar con la cuenta pendiente.
- **T-27:** sesiones en MongoDB con `connect-mongo`; sobreviven a un reinicio del servidor. Ver D-14 en [decisiones](decisiones.md#d-14-sesiones-en-mongodb-con-connect-mongo).
- **Pruebas:** de 50 a 56, todas en verde. Fusionado con el [PR #13](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/13) el 2026-11-09 (unas 2 h reales frente a 6 estimadas).
- **Aprendido:** con el almacén en MongoDB, `express-session` termina la respuesta solo cuando la sesión está guardada; las pruebas tienen que leer el cuerpo de la respuesta (como hace `rest.js`) antes de la siguiente petición.

### PBI-10 Modelo de datos fitness y aislamiento por usuario

- **T-28:** colecciones `ejercicios`, `rutinas` y `entrenos` con sus índices, creados una sola vez por base en `bd.js` (antes el de `usuarios` se pedía en cada consulta). Modelo y motivos en D-16 de [decisiones](decisiones.md#d-16-modelo-de-datos-de-fitness-hub).
- **T-29:** regla `comprobarAcceso` (función pura en `logica.js`): recurso ajeno o inexistente → 404, ejercicio base solo lectura → 403. Ver D-17.
- **Pruebas:** de 56 a 65, todas en verde. `datos.test.js` usa su propia base (`fitness_hub_test_datos`) porque los ficheros de prueba se ejecutan en paralelo; `propiedad.test.js` no necesita base de datos.
- **Pendiente para los PBIs siguientes:** las operaciones (crear, listar, borrar) y que cada ruta nueva pase por `comprobarAcceso`.

Fusionado con el [PR #14](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/14) el 2026-11-15 (cerca de 1 h real frente a 5 estimadas). Con el PBI-10 se cierra el Hito 1.

## Hito 2: ejercicios y rutinas

### PBI-11 Catálogo de ejercicios

- **T-30:** 179 ejercicios base en 69 familias y 13 grupos musculares. Cada variante (con barra, con mancuernas, en polea con cuerda…) es un ejercicio suelto con su propio historial; `familia` las agrupa. El catálogo vive en la capa de datos y se carga al arrancar sin duplicar. Reglas en `logica.js`: nombre de 2 a 60 caracteres, grupo de la lista y sin repetir uno propio ni uno base. Ver D-18 en [decisiones](decisiones.md#d-18-catálogo-de-ejercicios-en-la-capa-de-datos).
- **T-31:** `GET /api/ejercicios`, `GET /api/ejercicios/grupos` y `POST /api/ejercicios` (400 datos no válidos, 409 repetido). El dueño sale siempre de la sesión.
- **T-32:** pantalla de ejercicios con buscador (sin tildes y palabra por palabra), filtro por grupo, familias desplegables y formulario plegado para añadir uno propio. Tarjeta "Ejercicios" activa en el inicio.
- **Pruebas:** de 65 a 79, todas en verde. La pantalla se probó a mano a tamaño móvil contra una base de prueba; se corrigieron dos fallos de uso (búsqueda por texto exacto y formulario que tapaba el resultado).
- **Fuera del PBI:** editar y borrar ejercicios propios; ejercicios de cardio (necesitan tiempo y distancia, no peso y repeticiones).

Fusionado con el [PR #15](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/15) el 2026-11-16 (unos 45 min reales frente a 8 h estimadas).

### PBI-12 Rutinas

- **T-33:** reglas en `logica.js`. La rutina guarda el **objetivo**: series, repeticiones fijas o en rango (siempre `{ min, max }`) y descanso por defecto (90 s). Lo que sale de verdad se apuntará en el entreno. Nombre único por usuario (lógica e índice único), un ejercicio puede repetirse, y cada ejercicio tiene que ser visible para el usuario. Ver, editar y borrar pasan por `comprobarAcceso`. Ver D-19 en [decisiones](decisiones.md#d-19-rutinas-objetivo-repeticiones-fijas-o-rango-y-nombre-único).
- **T-34:** `GET`/`POST /api/rutinas` y `GET`/`PUT`/`DELETE /api/rutinas/:id` (400, 404 si es de otro, 409 si el nombre está repetido).
- **T-35:** pantalla de rutinas: lista con editar y borrar, y editor con buscador de ejercicios (a petición del alumno), orden con ↑/↓ y repeticiones escritas como "10" o "8-12". La búsqueda se comparte con la página de ejercicios (`cliente/busqueda.js`).
- **Pruebas:** de 79 a 92, todas en verde. Pantalla probada a mano en tamaño móvil contra una base de prueba; se corrigieron el botón partido en dos líneas y el aviso de error fuera de la vista.
- **Pendiente:** cambiar el descanso durante el entreno (PBI-14). El índice antiguo `{dueno}` de `rutinas` lo borra el alumno a mano en Atlas.
- Con el PBI-12 se cierra el Hito 2.

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
