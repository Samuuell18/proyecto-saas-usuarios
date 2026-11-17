---
type: Sprint
title: Sprint 2
description: MVP de Fitness Hub, plan por hitos y avance de cada PBI.
timestamp: 2026-11-09
---

# Sprint 2

**Objetivo:** MVP de Fitness Hub usable en el móvil: registrarse, crear rutinas, entrenar en vivo (o libre), temporizador de descanso, kg/lb, historial y métricas, instalable como app y con notificaciones. No hay especificación del profesor para este sprint: el alcance lo define el alumno.

Plan: 5 hitos, 12 PBIs (PBI-09 a PBI-20) y 34 tareas (T-24 a T-57; T-57 descartada), 95 h estimadas. El Hito 5 se replanteó el 16-nov con el alumno: el PBI-18 pasa a ser "app móvil" (marca, navegación y PWA) y se añade el PBI-20 (notificaciones push). Una rama y un pull request por PBI, con código, pruebas y `docs/` juntos.

| Hito | PBIs | Estado |
|---|---|---|
| 1 Cimientos y seguridad | PBI-09 sesión segura y tokens con caducidad · PBI-10 modelo de datos fitness | PBI-09 y PBI-10 hechos |
| 2 Ejercicios y rutinas | PBI-11 catálogo de ejercicios · PBI-12 rutinas | PBI-11 y PBI-12 hechos |
| 3 Entrenar | PBI-13 entreno en vivo · PBI-14 temporizador · PBI-15 kg/lb | PBI-13, PBI-14 y PBI-15 hechos |
| 4 Progreso | PBI-16 historial · PBI-17 métricas | PBI-16 y PBI-17 hechos |
| 5 Móvil y cierre | PBI-18 app móvil · PBI-20 notificaciones push · PBI-19 cierre del sprint | PBI-18 y PBI-20 hechos |

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
- **T-35:** pantalla de rutinas: lista con editar y borrar, y editor con buscador de ejercicios (a petición del alumno), orden con ↑/↓ y repeticiones escritas como "10" o "8-12". La búsqueda se comparte con la página de ejercicios (`cliente/presentacion/busqueda.js`).
- **Pruebas:** de 79 a 92, todas en verde. Pantalla probada a mano en tamaño móvil contra una base de prueba; se corrigieron el botón partido en dos líneas y el aviso de error fuera de la vista.
- **Pendiente:** cambiar el descanso durante el entreno (PBI-14). El índice antiguo `{dueno}` de `rutinas` lo borra el alumno a mano en Atlas.
- Con el PBI-12 se cierra el Hito 2.

Fusionado con el [PR #16](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/16) el 2026-11-16 (cerca de 1 h real frente a 10 estimadas).

## Hito 3: entrenar

### PBI-13 Entreno en vivo

Diseño propuesto por el agente y aprobado por el alumno antes de escribir código. Ver D-20 en [decisiones](decisiones.md#d-20-entreno-en-vivo-uno-en-curso-copia-del-plan-y-guardado-al-momento).

- **T-36:** reglas en `logica.js`. Un solo entreno en curso por usuario (también con un índice único parcial en `bd.js`). Empezar libre (vacío) o desde una rutina propia: cada serie del plan pasa a ser una serie sin hacer con la copia de su objetivo y su descanso (`seriesDesdeRutina`, función pura). Añadir un ejercicio o copiar una serie ("+ Serie"), apuntar peso y repeticiones (`normalizarSerie`, función pura), marcar como hecha, quitar, terminar (solo quedan las hechas) y descartar.
- **T-37:** `POST /api/entrenos`, `GET`/`DELETE /api/entrenos/actual`, `POST /api/entrenos/actual/series`, `PUT`/`DELETE /api/entrenos/actual/series/:serieId` y `POST /api/entrenos/actual/terminar` (400, 404, 409 si ya hay uno en curso).
- **T-38:** pantalla de entreno pensada para el móvil: elegir rutina o entreno libre; cada ejercicio en un bloque con sus series en filas (objetivo, kg, repeticiones, ✓ y quitar); "+ Serie" y buscador para añadir ejercicios; terminar y descartar. Campos de 16 px con teclado numérico y coma decimal aceptada. Tarjeta "Entrenar" activa en el inicio.
- **T-39:** cada cambio se guarda al momento, así que al recargar (o desde otro dispositivo) la pantalla retoma el entreno en curso. La tarjeta del inicio avisa de que hay uno a medias.
- **Pruebas:** de 92 a 102, todas en verde. Pantalla probada a mano en tamaño móvil contra una base de prueba; se quitó un texto de ayuda en el campo de repeticiones que parecía un valor ya escrito.
- **Fuera del PBI:** temporizador de descanso (PBI-14), libras (PBI-15), ver los entrenos terminados (PBI-16), proponer el último peso usado y reordenar ejercicios durante el entreno.

Fusionado con el [PR #17](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/17) el 2026-11-16 (cerca de 1 h real frente a 14 estimadas).

### PBI-14 Temporizador de descanso

Diseño propuesto por el agente y aprobado por el alumno. Ver D-21 en [decisiones](decisiones.md#d-21-temporizador-de-descanso-solo-en-el-cliente-con-hora-de-fin).

- **T-40:** cuentas puras en `cliente/presentacion/temporizador.js` (sin DOM, probadas con `node:test`): se guarda la hora de fin y lo que queda es fin − ahora, así el tiempo es exacto aunque el navegador frene la página. Barra fija abajo de la pantalla del entreno con la cuenta atrás, −15/+15, 60/90/120 y "Saltar".
- **T-41:** al marcar una serie como hecha se abre una ventana con el `descansoSeg` de esa serie (copiado de la rutina; 90 s en un entreno libre), ajustable ±15 s, que bloquea la pantalla hasta pulsar "Empezar descanso" o "Saltar" (a petición del alumno tras probarlo: al principio arrancaba solo). Al llegar a 0: tres pitidos (Web Audio, preparado durante el toque para que Safari lo deje sonar), vibración donde se puede y la barra en verde con "¡A por la siguiente serie!". La hora de fin se guarda en `localStorage`: al recargar, el descanso sigue.
- **Pruebas:** de 102 a 105, todas en verde. Probado a mano en tamaño móvil; se corrigió que −15 con el tiempo ya a 0 repetía el aviso y que "Saltar" en la ventana no quitaba un descanso anterior. Fusionado con el [PR #18](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/18) el 2026-11-16 (cerca de 1 h real frente a 5 estimadas).
- **Fuera del PBI:** avisos con la app cerrada o la pantalla bloqueada (notificaciones y app instalable en el iPhone; el alumno lo deja para más adelante) y guardar un descanso cambiado para las siguientes series.

### PBI-15 Unidades kg / lb

Diseño propuesto por el agente y aprobado por el alumno, que pidió llevar el selector a una página de Ajustes para toda la app. Ver D-23 en [decisiones](decisiones.md#d-23-peso-siempre-en-kg-la-unidad-del-usuario-solo-cambia-cómo-se-ve).

- **T-42:** funciones puras `pesoAKg` y `pesoDesdeKg` en `logica.js` (3 decimales al guardar para que 135 lb vuelvan como 135) y preferencia `unidadPeso` en `usuarios` (`unidadPesoDe`, `cambiarUnidadPeso`; kg si no hay ninguna).
- **T-43:** el entreno sale de la lógica con `unidad` y cada serie con `peso` en esa unidad; al apuntar se manda `peso` y la lógica lo pasa a kg (el máximo sigue siendo 1000 kg, unas 2204 lb). `GET /api/yo` devuelve `unidadPeso` y `PUT /api/yo/unidad` la cambia (400 si no es kg ni lb). Página provisional [ajustes.html](../cliente/ajustes.html) con la sesión (email, rol, cerrar sesión) y el selector kg / lb, enlazada desde la barra del inicio. En la pantalla del entreno la columna y las etiquetas usan la unidad elegida.
- **Pruebas:** de 105 a 109, todas en verde. Probado a mano: cambiar a lb, apuntar 142,5 lb y verlo como 64,64 kg al volver a kg; Ajustes en tamaño móvil.
- **Fuera del PBI:** tema de color y una página de perfil completa (para la versión móvil), y elegir la unidad de cada ejercicio por separado.
- Fusionado con el [PR #20](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/20) el 2026-11-16 (45 min reales frente a 5 h estimadas).

## Hito 4: progreso

### PBI-16 Historial de entrenos

Diseño propuesto por el agente y aprobado por el alumno. Ver D-24 en [decisiones](decisiones.md#d-24-historial-solo-entrenos-terminados-que-se-ven-y-se-borran).

- **T-44:** `datos.js` lista los entrenos terminados del usuario (índice `{dueno, inicio: -1}`) y busca uno por id; `logica.js` añade `resumenEntreno` (pura), `listarHistorial`, `obtenerEntrenoTerminado` y `eliminarEntrenoTerminado` (ajeno, inexistente o en curso: 404). Rutas `GET /api/entrenos`, `GET /api/entrenos/:id` y `DELETE /api/entrenos/:id`, puestas después de las de `actual`.
- **T-45:** pantalla [historial.html](../cliente/historial.html): una tarjeta por entreno que se despliega para ver las series por ejercicio (el detalle se pide al abrirla) y "Borrar entreno" con confirmación. Tarjeta "Historial" en el inicio. Al terminar un entreno se va a `historial.html?abierto=<id>` con ese entreno abierto.
- **Pruebas:** de 109 a 113, todas en verde. Probado a mano: terminar un entreno y llegar a él en el historial, ver los pesos en lb, borrar, y tamaño móvil sin desbordes.
- **Fuera del PBI:** editar entrenos terminados, paginar la lista y las métricas (volumen, récords; PBI-17).
- Fusionado con el [PR #21](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/21) el 2026-11-16 (40 min reales frente a 6 h estimadas).

### PBI-17 Métricas de progreso

Diseño propuesto por el agente y aprobado por el alumno (gráficos SVG propios en vez de Chart.js). Ver D-25 en [decisiones](decisiones.md#d-25-métricas-calculadas-en-la-lógica-y-gráficos-svg-propios).

- **T-46:** funciones puras en `logica.js`: `lunesDe` (semana en hora de España), `volumenSerie`, `entrenosPorSemana` (últimas 8 semanas, las vacías a 0), `progresoEjercicio` (un punto por entreno) y `recordsPorEjercicio` (mejor serie, primera fecha y sesiones). Solo cuentan las series hechas.
- **T-47:** `obtenerMetricas` y `obtenerProgresoEjercicio` leen los entrenos terminados del usuario y pasan pesos y volúmenes a su unidad. Rutas `GET /api/metricas` y `GET /api/metricas/ejercicios/:id` (404 si nunca ha hecho ese ejercicio).
- **T-48:** pantalla [progreso.html](../cliente/progreso.html): tres cifras (entrenos de la semana, de 8 semanas y volumen de la semana), barras de entrenos por semana, línea del peso máximo del ejercicio elegido (repeticiones si es de peso corporal) y lista de récords. Gráficos en `cliente/presentacion/graficos.js` (escalas puras probadas en `graficos.test.js`). Tarjeta "Progreso" activa en el inicio.
- **Pruebas:** de 113 a 121, todas en verde. Probado a mano en escritorio y tamaño móvil.
- **Fuera del PBI:** 1RM estimado, filtros por fecha o grupo muscular y que el eje del peso no empiece en 0.
- Fusionado con el [PR #22](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/22) el 2026-11-16 (50 min reales frente a 11 h estimadas).

## Hito 5: móvil y cierre

### PBI-18 App móvil: marca, navegación y PWA

Replanteado con el alumno: la app se usará sobre todo en el móvil y debe tener aspecto de app, premium y limpio. Paleta "Energía" elegida por el alumno entre tres propuestas.

- **T-49:** paleta "Energía" con todos los colores en variables y el verde reservado para "hecho"; icono de la app (mancuerna naranja sobre carbón) en SVG y PNG. Ver D-26.
- **T-50:** menú inferior de 5 pestañas generado por `navegacion.js`; Perfil (antes Ajustes) con cerrar sesión y eliminar cuenta; Progreso con subpestañas Métricas e Historial; cabecera fija translúcida; barra de descanso flotando sobre el menú; eje de entrenos con números enteros (`techoEntero`). Ver D-27.
- **T-54:** PWA: manifest, service worker (red primero, sin guardar la API), etiquetas de iOS en las 9 páginas e "Instalar la app" en Perfil (botón en Android, pasos en iPhone). Ver D-28.
- **Pruebas:** de 121 a 124, todas en verde. Probado a mano en tamaño móvil y escritorio. Falta probar la instalación en un iPhone y en un Android reales tras desplegar (el service worker exige HTTPS).
- **Fuera del PBI:** tema oscuro, inicio como resumen y modo sin conexión.
- Fusionado con el [PR #23](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/23) el 2026-11-16 (1 h real frente a 10 h estimadas). Después, con el [PR #24](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/24), la app pasa a llamarse **Forja** (nombre elegido por el alumno).

### PBI-20 Notificaciones push

Nuevo en el replanteamiento del Hito 5: el temporizador no puede avisar con el móvil bloqueado. Diseño propuesto por el agente y aprobado por el alumno, que descartó el recordatorio de días sin entrenar (T-57). Ver D-29.

- **T-55:** suscripción por móvil (claves VAPID, colección `suscripciones`, `servicios/push.js` con `web-push`), rutas `/api/avisos/clave`, `/api/avisos/suscripcion` y `/api/avisos/prueba`, sección "Notificaciones" en Perfil (activar, aviso de prueba, desactivar; en iPhone pide instalar la app primero) y el service worker muestra los avisos y abre la app al tocarlos.
- **T-56:** al empezar o cambiar un descanso, el entreno manda la hora de fin (`PUT /api/avisos/descanso`) y el servidor programa el aviso "Descanso terminado"; saltar, terminar o descartar lo cancela.
- **T-57:** descartada por el alumno.
- **Pruebas:** de 124 a 134, todas en verde, sin enviar avisos reales (en los tests las claves VAPID están vacías). Probado en el navegador que el entreno programa y cancela el aviso. Falta probar el aviso real en el iPhone tras desplegar.
- **Fuera del PBI:** recordatorios, avisos que sobrevivan a un reinicio del servidor.

### PBI-21 Pulido tras la prueba real

Nuevo (17-nov): el alumno entrenó con la app de verdad y apuntó lo que fallaba o faltaba. Cada punto se convirtió en una tarea, acordadas con él antes de empezar; va antes del cierre (PBI-19). Nada cambia la especificación del Sprint 1 (el acceso sigue siendo email y contraseña).

- **T-58:** el tic responde al momento (actualización optimista), con animación y vibración, y la ventana del descanso sale sin esperar a la red. Ver D-31.
- **T-59:** rapidez: archivos sin consultar la sesión, peticiones de cada página a la vez y service worker con copia primero y versión por huella; fundido entre pantallas. Ver D-30.
- **T-60:** nombre obligatorio (registro, OAuth y cuentas que ya existían); se cambia en Perfil. Ver D-32.
- **T-61:** el inicio pasa a ser la pantalla "Hoy" (opción A del alumno). Ver D-33.
- **T-62:** al entrenar una rutina se ve en gris lo que se hizo la vez anterior. Ver D-34.
- **T-63:** tema claro y oscuro en Perfil, guardado en el dispositivo. Ver D-35.
- **T-64:** un nombre de ejercicio largo en el desplegable de Progreso ensanchaba toda la página en el móvil; los desplegables ya no pasan del ancho de su panel.
- **Pruebas:** de 134 a 147, todas en verde. Probado a mano en tamaño móvil, en claro y en oscuro. Falta probar en el iPhone tras desplegar (la copia primero solo se nota en Render).
- **Fuera del PBI:** dominio propio (aconsejado para el correo y Google, después del sprint), plan de pago de Render para que no se duerma y reducir los viajes a Atlas por petición.

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
