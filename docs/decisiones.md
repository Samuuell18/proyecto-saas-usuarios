---
type: Decisiones
title: Decisiones de diseño
description: Decisiones técnicas del Sprint 1 con su motivo y su estado.
timestamp: 2026-10-30
---

# Decisiones

Los motivos citados salen del [README](../README.md#tecnologías-por-qué-cada-una) o de un commit. Donde no hay fuente, queda un `TODO(alumno)`.

## D-01 Node, Express 5 y frontend sin build
- **Qué se decidió:** backend en Node 22 (ESM) con Express 5; frontend con HTML y JavaScript sin framework ni compilación.
- **Por qué:** el README dice "mismo idioma en front y back, sin compilar", "API REST mínima y estándar para separar las capas" y "las 2 capas se señalan a mano". No hubo un motivo especial para descartar un framework de frontend: se consultó con una IA y se buscó un stack sencillo para entender bien la estructura.
- **Estado:** vigente.

## D-02 MongoDB Atlas como base de datos
- **Qué se decidió:** MongoDB Atlas con el driver oficial, accedido solo desde `datos.js` (commit `584e105`, [PR #5](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/5)).
- **Por qué:** el README dice "BBDD real gestionada con capa gratuita". Ganó Mongo porque la propuso el profesor; también se valoró Supabase.
- **Estado:** vigente.

## D-03 Primer administrador por variable de entorno
- **Qué se decidió:** el email de `ADMIN_EMAIL` nace con rol `admin`; el resto, `usuario`.
- **Por qué:** el README dice "al no existir usuarios no hay quién lo nombre; el entorno del despliegue sí puede".
- **Estado:** vigente.

## D-04 Borrado lógico
- **Qué se decidió:** eliminar un usuario cambia su estado a `eliminado`; no se borra el documento (commit `d7b8b8e`, [PR #10](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/10)).
- **Por qué:** el README dice que así la cuenta "no puede volver a entrar (ni por OAuth) ni reutilizar el email". 
- **Estado:** vigente.

## D-05 Resend para el correo de confirmación
- **Qué se decidió:** enviar la confirmación con Resend (commit `e3bfd13`, [PR #7](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/7)).
- **Por qué:** se creyó que tenía capa gratuita utilizable; en la práctica exigía un dominio propio (ver D-06).
- **Estado:** sustituida por D-06.

## D-06 Brevo para el correo de confirmación
- **Qué se decidió:** cambiar de Resend a Brevo, por API HTTP (commit `42680ec`, [PR #10](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/10)).
- **Por qué:** el README dice "capa gratuita, remitente verificado, sin dominio ni SMTP". El cambio se hizo porque Resend necesitaba un dominio propio y Brevo no.
- **Estado:** vigente.

## D-07 OAuth con GitHub y una app por entorno
- **Qué se decidió:** login con GitHub (commit `273ad6c`, [PR #7](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/7)); el usuario OAuth nace activo, sin confirmar el correo.
- **Por qué:** el README explica que GitHub admite una sola callback exacta por app, así que hay una app por entorno. Se eligió GitHub porque llamó la atención poder hacerlo con GitHub; sin otro motivo especial.
- **Estado:** vigente.

## D-08 Segundo proveedor (Google) con una tabla de proveedores
- **Qué se decidió:** añadir Google y generalizar el flujo en la tabla `PROVEEDORES` de `api.js` (commit `26a3d1f`, [PR #10](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/10)).
- **Por qué:** el commit habla de "generalizando el flujo de proveedores". La especificación pedía "al menos un" proveedor; se añadió Google para aprender a hacerlo también con él, por ser el más usado.
- **Estado:** vigente.

## D-09 bcryptjs para el hash de contraseñas
- **Qué se decidió:** `bcryptjs`, con la versión asíncrona desde el commit `d7b8b8e`.
- **Por qué:** el README dice "hash seguro de contraseñas sin compilados nativos". La versión asíncrona se justifica en el comentario de `logica.js`: no bloquea el servidor mientras calcula el hash.
- **Estado:** vigente.

## D-10 Sesiones con express-session en memoria
- **Qué se decidió:** sesión en el servidor con `express-session` y su almacén por defecto, en memoria.
- **Por qué:** el README dice "sesión en servidor que sobrevive a recargas". No se aceptó por un motivo concreto: simplemente no se implementó que la sesión sobreviva al reinicio del servidor (sin ese almacén, se pierde al reiniciarlo).
- **Estado:** sustituida por D-14 (Sprint 2).

## D-11 Pruebas con node:test contra una base de pruebas real
- **Qué se decidió:** `node:test` sin dependencias; las pruebas usan bases de pruebas en Atlas (`MONGO_DB_NAME`).
- **Por qué:** el README dice "tests sin configuración extra". No hay un motivo concreto escrito para no usar dobles de la base de datos. Las pruebas llaman a Atlas de verdad (bases `fitness_hub_test` y `fitness_hub_test_api`), por eso tardan unos segundos y necesitan la cadena de conexión.
- **Estado:** vigente.

## D-12 Despliegue en Render desde main
- **Qué se decidió:** Web Service de Render conectado al repositorio, con auto-deploy desde `main` ([README](../README.md#cicd)).
- **Por qué:** lo recomendó una IA; es gratis y de momento funciona bien.
- **Estado:** vigente.

## D-13 Endpoint público de la prueba técnica
- **Qué se decidió:** `POST /api/prueba/estado` expone `calcularEstado` sin sesión (commit `b791b1c`, [PR #9](https://github.com/Samuuell18/proyecto-saas-usuarios/pull/9)).
- **Por qué:** lo pedía la prueba técnica (variante 6). Se mantiene para que quede constancia, por si acaso, aunque la prueba ya terminó.
- **Estado:** vigente.

## D-14 Sesiones en MongoDB con connect-mongo
- **Qué se decidió:** guardar las sesiones de `express-session` en la colección `sesiones` de MongoDB con `connect-mongo` (Sprint 2, T-27), reutilizando la conexión de `bd.js`. El almacén lo crea `datos.js` y `logica.js` lo reexporta, para que `api.js` no importe la capa de datos.
- **Por qué:** con el almacén en memoria, cada vez que Render dormía o reiniciaba la app todos los usuarios perdían la sesión. Ya se usaba MongoDB, así que no hace falta otro servicio. Las sesiones caducan solas a los 14 días (índice TTL).
- **Estado:** vigente.

## D-15 Enlaces de confirmación con caducidad y reenvío
- **Qué se decidió:** el token de confirmación caduca a las 24 h (regla en `logica.js`, función pura `tokenCaducado`) y se puede pedir uno nuevo con `POST /api/reenviar`, que borra los anteriores (Sprint 2, T-25 y T-26).
- **Por qué:** un enlace que vale para siempre es un riesgo si el correo acaba en manos de otro. Sin reenvío, quien dejaba caducar el enlace se quedaba atascado (cuenta pendiente y email ya registrado). `POST /api/reenviar` responde siempre lo mismo para no revelar qué emails tienen cuenta.
- **Estado:** vigente. Pendiente: limitar cuántas veces se puede pedir un reenvío.

## D-16 Modelo de datos de Fitness Hub
- **Qué se decidió:** tres colecciones (`ejercicios`, `rutinas`, `entrenos`) con `dueno` = email del usuario; las líneas de una rutina y las series de un entreno van incrustadas en su documento; cada serie guarda una copia del nombre del ejercicio; peso siempre en kg (Sprint 2, T-28). Detalle en [arquitectura](arquitectura.md#modelo-de-datos).
- **Por qué:** el resto del proyecto ya identifica al usuario por email (la sesión guarda `{ email, rol }`) y no se puede cambiar el email. Se incrusta lo que siempre se lee junto y no crece sin límite; se referencia el ejercicio porque lo comparten muchas rutinas y entrenos. La copia del nombre mantiene el historial aunque el ejercicio se renombre o se borre. Los índices se crean una vez por base y no en cada consulta, como se hacía antes con el de `usuarios`.
- **Estado:** vigente.

## D-17 Recurso ajeno igual que inexistente (404)
- **Qué se decidió:** la regla `comprobarAcceso` de `logica.js` responde 404 tanto si el recurso no existe como si es de otro usuario; los ejercicios base se pueden ver pero no modificar (403). El administrador no tiene excepción (Sprint 2, T-29).
- **Por qué:** un 403 confirmaría que el recurso existe y permitiría ir probando identificadores. El ejercicio base es público, así que ahí el 403 no revela nada. El admin gestiona cuentas; los entrenos son datos personales.
- **Estado:** vigente.

## D-18 Catálogo de ejercicios en la capa de datos
- **Qué se decidió:** los 13 grupos musculares y los 179 ejercicios base viven en `servidor/catalogo-ejercicios.js`, que solo importa `datos.js`. Al arrancar, `datos.sembrarEjerciciosBase()` inserta los que falten con `dueno: null` (operación idempotente, por *upsert*). Cada variante es un ejercicio suelto con un campo `familia` que las agrupa (Sprint 2, T-30).
- **Por qué:** el alumno pidió que los datos vivan en la capa de datos y que la lógica solo contenga reglas y llame a datos. Guardar los base en MongoDB hace que todos los ejercicios tengan el mismo tipo de identificador para las rutinas. Las variantes sueltas permiten llevar el progreso de cada una por separado (no se levanta lo mismo con barra que con mancuernas). Se dejó fuera el cardio porque los entrenos guardan peso y repeticiones.
- **Estado:** vigente. Quitar un ejercicio del catálogo no lo borra de la base (puede estar en rutinas o entrenos).

## D-19 Rutinas: objetivo, repeticiones fijas o rango y nombre único
- **Qué se decidió:** la rutina guarda el plan de cada ejercicio: series, repeticiones como `{ min, max }` (un número fijo es `min = max`) y un descanso por defecto (90 s si no se indica). Las repeticiones y el peso reales se apuntan en el entreno. El nombre de la rutina es único por usuario sin distinguir mayúsculas (regla en `logica.js` y índice único `{dueno, nombre}`, que sustituye al `{dueno}` de D-16). Un ejercicio se puede repetir en la misma rutina (Sprint 2, T-33).
- **Por qué:** lo pidió el alumno. Las rutinas reales se escriben con rangos ("8-12") o números fijos; guardarlo siempre igual simplifica la lógica y la pantalla. El descanso por defecto permite que el temporizador arranque solo (PBI-14), aunque se podrá cambiar durante el entreno. El índice único evita duplicados aunque lleguen dos peticiones a la vez.
- **Estado:** vigente.

## D-20 Entreno en vivo: uno en curso, copia del plan y guardado al momento
- **Qué se decidió:** cada usuario tiene como mucho **un entreno en curso** (regla en `logica.js` e índice único parcial `{dueno}` solo para los que tienen `fin: null`). Al empezar desde una rutina se crean todas sus series sin hacer, y cada serie guarda una **copia** del objetivo (`objetivo: { min, max }`) y del descanso (`descansoSeg`); el entreno guarda también `rutinaNombre`. Cada serie tiene su propio `id`. Cada cambio (apuntar, marcar, añadir o quitar una serie) se guarda en el servidor al momento. Al **terminar** solo se conservan las series marcadas como hechas; sin ninguna hecha hay que descartar. Las rutas usan `/api/entrenos/actual` en vez de un id (Sprint 2, T-36). Amplía el modelo de D-16.
- **Por qué:** con un solo entreno en curso la pantalla sabe siempre cuál retomar al recargar o al cambiar de dispositivo (T-39), y como cada ruta trabaja sobre "el entreno en curso del usuario de la sesión" no se puede tocar el de otro. Se copia el plan, igual que el nombre del ejercicio, para que editar o borrar la rutina no cambie un entreno ya empezado ni el historial, y para que el temporizador (PBI-14) sepa cuánto descansar. Guardar al momento evita perder lo apuntado si se cierra el navegador en mitad del entreno. Las series no hechas al terminar no son datos reales y estropearían las métricas (PBI-17). El `id` por serie es más seguro que su posición si se borra una.
- **Estado:** vigente. Limitación conocida: la lógica lee el entreno, cambia la lista de series y la guarda entera; dos peticiones a la vez del mismo usuario podrían pisarse. El cliente las manda de una en una; si hiciera falta, se cambiaría a actualizaciones atómicas de MongoDB solo en `datos.js`.

## D-21 Temporizador de descanso solo en el cliente, con hora de fin
- **Qué se decidió:** el temporizador vive solo en la capa de presentación (`entreno.js`); no hay rutas ni datos nuevos en el servidor. Al marcar una serie como hecha se abre una ventana modal (`<dialog>`) con su `descansoSeg` (el de la rutina, o 90 s en un entreno libre), que se puede ajustar ±15 s; hasta pulsar "Empezar descanso" o "Saltar" (o Esc) no se puede tocar nada más. El descanso no arranca solo: lo pidió el alumno tras probarlo. Se guarda **la hora a la que termina** el descanso y lo que queda se calcula como fin − ahora (funciones puras en `cliente/temporizador.js`). Esa hora se guarda en `localStorage` para que una recarga no lo pierda. Los botones −15/+15 y 60/90/120 cambian solo el descanso en marcha. Al terminar: tres pitidos con Web Audio, vibración y la barra en verde (Sprint 2, T-40 y T-41).
- **Por qué:** el plan del sprint ya decía que el temporizador es presentación. Con la pantalla bloqueada o la pestaña en segundo plano el navegador frena los `setInterval`; contando de uno en uno se quedaría atrasado, con la hora de fin siempre es exacto. Cambiar solo el descanso en curso es lo más simple y no obliga a tocar la lógica ni la API. Safari en iPhone solo deja sonar audio si se prepara durante un toque del usuario, por eso se prepara al pulsar "Empezar descanso".
- **Estado:** vigente. Limitaciones: Safari en iPhone no permite vibrar, y con la pantalla bloqueada el navegador puede no dejar sonar el aviso. Avisar con la app cerrada o bloqueada necesita notificaciones (*service worker*, push) y convertir la web en una app instalable; el alumno lo deja para más adelante, con la idea de usar Fitness Hub en su iPhone como una app.
