---
type: Decisiones
title: Decisiones de diseño
description: Decisiones técnicas de los Sprints 1 y 2 con su motivo y su estado.
timestamp: 2026-11-17
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
- **Qué se decidió:** los 13 grupos musculares y los 179 ejercicios base viven en `servidor/datos/catalogo-ejercicios.js`, que solo importa `datos.js`. Al arrancar, `datos.sembrarEjerciciosBase()` inserta los que falten con `dueno: null` (operación idempotente, por *upsert*). Cada variante es un ejercicio suelto con un campo `familia` que las agrupa (Sprint 2, T-30).
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
- **Qué se decidió:** el temporizador vive solo en la capa de presentación (`entreno.js`); no hay rutas ni datos nuevos en el servidor. Al marcar una serie como hecha se abre una ventana modal (`<dialog>`) con su `descansoSeg` (el de la rutina, o 90 s en un entreno libre), que se puede ajustar ±15 s; hasta pulsar "Empezar descanso" o "Saltar" (o Esc) no se puede tocar nada más. El descanso no arranca solo: lo pidió el alumno tras probarlo. Se guarda **la hora a la que termina** el descanso y lo que queda se calcula como fin − ahora (funciones puras en `cliente/presentacion/temporizador.js`). Esa hora se guarda en `localStorage` para que una recarga no lo pierda. Los botones −15/+15 y 60/90/120 cambian solo el descanso en marcha. Al terminar: tres pitidos con Web Audio, vibración y la barra en verde (Sprint 2, T-40 y T-41).
- **Por qué:** el plan del sprint ya decía que el temporizador es presentación. Con la pantalla bloqueada o la pestaña en segundo plano el navegador frena los `setInterval`; contando de uno en uno se quedaría atrasado, con la hora de fin siempre es exacto. Cambiar solo el descanso en curso es lo más simple y no obliga a tocar la lógica ni la API. Safari en iPhone solo deja sonar audio si se prepara durante un toque del usuario, por eso se prepara al pulsar "Empezar descanso".
- **Estado:** vigente. Limitaciones: Safari en iPhone no permite vibrar, y con la pantalla bloqueada el navegador puede no dejar sonar el aviso. Avisar con la app cerrada o bloqueada necesita notificaciones (*service worker*, push) y convertir la web en una app instalable; el alumno lo deja para más adelante, con la idea de usar Fitness Hub en su iPhone como una app.

## D-22 Carpetas por capa
- **Qué se decidió:** el código se ordena en carpetas con el nombre de su capa: `cliente/presentacion/` (un `.js` por página con el mismo nombre que su `.html`, más las ayudas puras `busqueda.js` y `temporizador.js`), `cliente/comunicacion/` (`rest.js`), `cliente/css/`, `servidor/datos/` (`datos.js`, `bd.js` y el catálogo) y `servidor/servicios/` (`correo.js` y `log.js`, que no son una capa). `api.js` y `logica.js` se quedan como un archivo por capa en `servidor/`. Las páginas `.html` siguen en la raíz de `cliente/`. `controlador.js` pasa a llamarse `acceso.js` (es el de `index.html`). No cambia ninguna capa, ninguna frontera ni ninguna URL (Sprint 2, entre el PBI-14 y el PBI-15).
- **Por qué:** lo pidió el alumno: `cliente/` tenía 15 archivos mezclados y para señalar la frontera presentación/comunicación había que saberse de memoria cuál era `rest.js`. Con carpetas por capa la arquitectura se ve en el árbol. Las páginas no se mueven para no cambiar las URLs (enlaces, redirecciones de OAuth y del correo de confirmación). `api.js` y `logica.js` no se trocean por temas: un archivo por capa es lo que pide la asignatura y lo que se señala en la evaluación; se puede plantear si siguen creciendo.
- **Estado:** vigente. Los documentos del Sprint 1 cuentan la historia con los nombres de entonces; los enlaces apuntan a las rutas nuevas.

## D-23 Peso siempre en kg; la unidad del usuario solo cambia cómo se ve
- **Qué se decidió:** la BBDD guarda el peso de cada serie **siempre en kg** (`pesoKg`, con 3 decimales). Cada usuario tiene una preferencia `unidadPeso` (`kg` o `lb`) en `usuarios`; si no la tiene, es kg. La conversión son dos funciones puras en `logica.js` (`pesoAKg` y `pesoDesdeKg`, con 1 lb = 0,45359237 kg). La API habla con el cliente en la unidad del usuario: el entreno sale con `unidad` y cada serie con `peso` (2 decimales como mucho), y al apuntar una serie el cliente manda `peso`; `pesoKg` no sale de la lógica. La preferencia se cambia en una página de **Ajustes** (`ajustes.html`, `PUT /api/yo/unidad`), que también enseña la sesión (Sprint 2, PBI-15, T-42 y T-43).
- **Por qué:** con una sola unidad guardada, el historial y las métricas (PBI-16 y PBI-17) pueden comparar y sumar pesos sin mirar en qué unidad se apuntó cada uno. Convertir en la lógica (y no en el cliente) era lo acordado en el plan: la regla se prueba con `node:test` y el cliente solo enseña lo que recibe. Se guardan 3 decimales porque con 2 la vuelta no es exacta (135 lb serían 61,23 kg y volverían como 134,99 lb). La preferencia va en el servidor para que valga en cualquier dispositivo. Ajustes es una página aparte porque el alumno quiere que la unidad valga para toda la app y no solo para el entreno.
- **Estado:** vigente. La página de Ajustes es provisional: el alumno quiere rehacerla (perfil, tema de color…) cuando la app se adapte al móvil como app instalable.

## D-24 Historial: solo entrenos terminados, que se ven y se borran
- **Qué se decidió:** el historial son los entrenos con `fin` (los terminados), del más reciente al más antiguo. La lista trae solo un resumen calculado por una función pura (`resumenEntreno`: nombre, fecha, duración, ejercicios distintos y series) y el detalle se pide al abrir cada uno (`GET /api/entrenos/:id`), con los pesos en la unidad del usuario (D-23). Un entreno terminado **no se edita**: solo se puede borrar, con confirmación. Por id, un entreno ajeno, inexistente o todavía en curso da 404 (`comprobarAcceso`, D-17). Las rutas con `:id` van después de las de `/api/entrenos/actual` para que "actual" no se tome por un id. Al terminar un entreno la app lleva al historial con ese entreno abierto (Sprint 2, PBI-16, T-44 y T-45).
- **Por qué:** el historial es lo que se entrenó de verdad y alimenta las métricas (PBI-17); dejar editarlo complica las reglas y no lo necesita el MVP. Cargar el detalle bajo demanda mantiene ligera la lista cuando haya muchos entrenos. El entreno en curso tiene su propia pantalla y sus rutas, así que en el historial no existe. Ir al historial al terminar le enseña al usuario lo que acaba de guardar.
- **Estado:** vigente. Sin paginación: se cargan todos los resúmenes (suficiente para el MVP; se paginaría en `datos.js` y la API si crece).

## D-25 Métricas calculadas en la lógica y gráficos SVG propios
- **Qué se decidió:** las métricas se calculan al pedirlas, a partir de los entrenos terminados del usuario, con funciones puras en `logica.js` que trabajan en kg (`lunesDe`, `volumenSerie`, `entrenosPorSemana`, `progresoEjercicio`, `recordsPorEjercicio`); al final se pasan a la unidad del usuario (D-23). No hay colecciones nuevas. Las semanas van de lunes a domingo **en hora de España** (`Intl` con `Europe/Madrid`). La mejor serie es la de más peso y, a igualdad, la de más repeticiones; el récord guarda la primera fecha en que se consiguió. Los gráficos (barras por semana y línea por ejercicio) se dibujan en SVG a mano en `cliente/presentacion/graficos.js`, sin librerías (Sprint 2, PBI-17, T-46 a T-48).
- **Por qué:** calcular al vuelo evita duplicar datos que se podrían desincronizar (por ejemplo, al borrar un entreno del historial) y es suficiente para el volumen de un usuario. Las funciones puras se prueban sin BBDD. El servidor de Render funciona en UTC: sin fijar la zona, un entreno del domingo por la noche contaría en la semana siguiente. Comparar por peso y luego por repeticiones da también el récord de los ejercicios de peso corporal (peso 0) sin un caso aparte. Los gráficos propios evitan meter una dependencia en un cliente sin compilación y sus escalas (`techoBonito`) se prueban con `node:test`; Chart.js se descartó por eso.
- **Estado:** vigente. Limitaciones: se leen todos los entrenos terminados en cada petición (se podría limitar por fecha en `datos.js` si crece); el eje vertical empieza siempre en 0, así que subidas pequeñas de peso se ven planas; sin 1RM estimado ni filtros por fecha o grupo muscular.

## D-26 Marca "Energía": naranja y carbón, estilo premium y limpio
- **Qué se decidió:** paleta elegida por el alumno entre tres propuestas: naranja `#C2410C` para botones y texto de acento, naranja vivo `#F97316` solo para gráficos, iconos y la pestaña activa, carbón `#1C1917` para el menú inferior y neutros cálidos (fondo `#F6F5F2`). El verde `#15803D` pasa a significar solo "hecho / ok" (series marcadas, avisos de éxito) y el rojo, error o borrado. Todos los colores son variables en `:root` de `styles.css`; no quedan colores sueltos salvo el tono del degradado de la portada. Icono de la app: la mancuerna del logo en naranja sobre carbón, en SVG y PNG (180, 192 y 512, válido como *maskable*), generado con un script fuera del repo (`graficos/iconos_app.py`). Estilo premium y limpio: sombras suaves en dos capas, cabecera translúcida y sin colores chillones (Sprint 2, PBI-18, T-49).
- **Por qué:** el naranja transmite energía y es habitual en apps de entreno; el carbón le da aspecto de app nativa. Los contrastes se midieron con la fórmula WCAG: blanco sobre `#C2410C` da 5,2 (pasa AA) y blanco sobre `#F97316` solo 2,8, por eso el naranja vivo nunca lleva texto encima. Separar marca (naranja) y éxito (verde) evita que todo signifique lo mismo. Tener todo en variables deja preparado un tema oscuro con solo otro juego de valores.
- **Estado:** vigente. El tema oscuro se hizo en el PBI-21 con otro juego de valores de las mismas variables (D-35).

## D-27 Navegación de app: menú inferior generado por un módulo
- **Qué se decidió:** menú inferior fijo de 5 pestañas (Inicio · Rutinas · Entrenar · Progreso · Perfil), con Entrenar en el centro destacada y un punto si hay un entreno en curso. Lo dibuja `cliente/presentacion/navegacion.js` (`pintarMenu`), que cada página con sesión llama; la pestaña activa la decide la función pura `pestanaDe` (Ejercicios cuelga de Rutinas, Historial de Progreso). La web sigue siendo multipágina: cada pestaña es un enlace. Progreso tiene dos subpestañas (Métricas e Historial); la página de Ajustes pasa a ser Perfil y recoge cerrar sesión y eliminar cuenta. Cabecera fija solo con el logo; la barra del descanso flota encima del menú; se respetan las zonas seguras del iPhone y de Android (`env(safe-area-inset-*)`) (Sprint 2, PBI-18, T-50).
- **Por qué:** la app se usa sobre todo en el móvil, donde el menú inferior es lo que se espera y queda a mano del pulgar. Generarlo desde un módulo evita copiar el mismo HTML en 7 páginas, y no hace falta pasar a una SPA ni a un framework.
- **Estado:** vigente. El inicio ya no repite el menú: es la pantalla "Hoy" (D-33).

## D-28 PWA: la web instalable como app en Android e iPhone
- **Qué se decidió:** `cliente/manifest.webmanifest` (nombre, iconos, `display: standalone`, colores), etiquetas `apple-*` y `viewport-fit=cover` en las 9 páginas, y un *service worker* (`cliente/sw.js`, en la raíz para controlar toda la app) que guarda la carcasa (páginas, CSS, iconos) y responde **red primero, copia si no hay red**. Nunca guarda nada de `/api/`. `cliente/presentacion/pwa.js` registra el service worker y decide cómo ofrecer la instalación con la función pura `modoInstalacion`: en Android y Chromium, botón "Instalar" en Perfil con el evento `beforeinstallprompt`; en iPhone (Safari, y Chrome o Firefox desde iOS 16.4) no existe ese evento, así que se enseñan los pasos de "Añadir a pantalla de inicio"; si ya está instalada, se dice (Sprint 2, PBI-18, T-54).
- **Por qué:** es la forma de que la web aparezca como un icono más en el móvil y se abra a pantalla completa sin publicar en tiendas, y es requisito para las notificaciones push en iPhone (PBI-20). Red primero evita ver una versión vieja tras un despliegue; no guardar la API evita mostrar datos de otra sesión o desactualizados.
- **Estado:** vigente, salvo la estrategia de caché: desde el PBI-21 es **copia primero** con versión por huella (D-30). El service worker solo funciona con HTTPS (o `localhost`): en el móvil se prueba tras desplegar en Render. Sin modo sin conexión real (las páginas necesitan la API).

## D-29 Notificaciones push: aviso al terminar el descanso enviado por el servidor
- **Qué se decidió:** Web Push estándar con claves VAPID (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, generadas por el alumno con `npx web-push generate-vapid-keys` y puestas en `.env` y en Render; el repo solo tiene los nombres). Cada móvil que activa los avisos en Perfil se suscribe en el navegador (`pwa.js`, permiso pedido al pulsar un botón) y la suscripción se guarda en la colección `suscripciones` (una por móvil: `endpoint` único; si entra otro usuario en ese móvil, pasa a ser suya). El envío lo hace `servidor/servicios/push.js` con la librería `web-push` (4.0.0), igual que `correo.js` con Brevo: sin claves solo deja el aviso en el log. Las suscripciones que el servicio da por caducadas (404/410) se borran solas. El aviso de descanso: al empezar (o cambiar) un descanso, el cliente manda la hora de fin; la lógica la valida (futura y como mucho a 15 min, `retrasoAvisoDescanso`) y programa un temporizador en memoria, uno por usuario (reprogramar sustituye; saltar, terminar o descartar el entreno lo cancela). El service worker muestra el aviso y, al tocarlo, abre el entreno. Hay un "Enviar aviso de prueba" en Perfil. El recordatorio de días sin entrenar (T-57) se planteó y el alumno lo descartó (Sprint 2, PBI-20, T-55 y T-56).
- **Por qué:** con el móvil bloqueado el navegador congela la página y el temporizador del cliente no puede sonar; en la web no existe "programar un aviso local", así que el aviso tiene que venir de fuera, del servidor, a través del servicio de avisos de Apple o Google. Un mismo código sirve para iPhone y Android. Las claves VAPID firman los avisos para que el servicio sepa que vienen de nuestro servidor. Validar el fin evita programar avisos absurdos; un temporizador por usuario evita avisos duplicados. Las claves las genera el alumno para que la privada no pase por el chat ni por el repo.
- **Estado:** vigente. Limitaciones: los avisos programados están en la memoria del servidor (un reinicio de Render durante un descanso pierde ese aviso); en iPhone exige iOS 16.4+ y la app instalada; si se cambian las claves VAPID, todas las suscripciones dejan de valer. Con la app abierta suenan el pitido de la página y la notificación (iPhone exige mostrar cada aviso).

## D-30 Rapidez: estáticos sin sesión, peticiones a la vez y copia primero
- **Qué se decidió:** tres cambios tras probar la app entrenando (Sprint 2, PBI-21, T-59). 1) En `api.js`, `express.static` va **antes** del middleware de sesión: los archivos de la app no necesitan sesión y antes cada CSS, JS o icono buscaba la sesión en MongoDB (en local, de 36 a 6 ms por archivo). Además `touchAfter` de un día en `connect-mongo`, para no reescribir la sesión en cada petición. 2) Cada página lanza sus peticiones **a la vez** que `apiYo()` en lugar de esperarla (las funciones de carga reciben la petición ya lanzada). 3) El service worker responde **copia primero** (red primero solo en `localhost`, para programar). Para no quedarse con una versión vieja, `api.js` sirve `/sw.js` por una ruta propia sustituyendo `__HUELLA__` por una huella SHA-256 del contenido de `cliente/`: si cambia cualquier archivo, cambia `sw.js`, el navegador instala el nuevo, que descarga la carcasa entera y borra la vieja. La carcasa incluye ya todos los JS. Al cambiar de página hay un fundido (View Transitions de CSS, sin JavaScript).
- **Por qué:** en Render cada viaje al servidor o a Atlas cuesta mucho más que en local. Con copia primero la pantalla aparece al instante y solo los datos van a la red. La huella hace automático lo que antes era "acordarse de cambiar `VERSION`". El test de `pwa.test.js` comprueba que la carcasa incluye todos los archivos de `cliente/`.
- **Estado:** vigente. La versión nueva se ve en la **segunda** apertura tras un despliegue (lo normal en una PWA). No arregla que Render gratis se duerma (primera petición de 30 a 50 s) ni los ~3 viajes a Atlas de cada petición a la API (sesión, cuenta activa y datos); si Render y Atlas están en regiones distintas, cada viaje cuesta más.

## D-31 Marcar una serie: actualización optimista
- **Qué se decidió:** al pulsar el tic, la pantalla cambia al momento (la fila se pone verde con una pequeña animación, vibración corta en Android y se abre la ventana del descanso) y el guardado va por detrás; si el servidor lo rechaza, la fila vuelve a como estaba, se cierra la ventana y sale el error (`alFallar` en `cambiar()` de `entreno.js`). Solo se cambia esa fila, sin redibujar el entreno. Sin repeticiones se avisa sin esperar al servidor (que lo sigue comprobando). El sonido del aviso se prepara en el primer toque de la página (crearlo costaba ~70 ms la primera vez). Botones que se hunden al pulsarlos y sin animaciones si el móvil tiene "reducir movimiento" (Sprint 2, PBI-21, T-58).
- **Por qué:** antes el tic esperaba la respuesta del servidor y redibujaba todo: con Render, casi un segundo sin respuesta visible. Las reglas siguen en el servidor: la pantalla se adelanta, pero no decide.
- **Estado:** vigente. Medido en el navegador: unos 20 ms desde el toque hasta la ventana del descanso.

## D-32 Nombre de usuario obligatorio
- **Qué se decidió:** `registrar(email, password, nombre)` exige un nombre de 2 a 40 caracteres, guardado sin espacios de sobra (`normalizarNombre`, función pura; error propio `NOMBRE_USUARIO_INVALIDO`, distinto del de las rutinas). Con OAuth se usa el nombre que da GitHub (o su usuario) o Google (se pide el permiso `profile`); si no vale, se queda sin nombre (`nombreDeProveedor`) y solo se guarda si la cuenta no tenía. Las cuentas sin nombre (anteriores o de OAuth) lo escriben en una ventana del inicio que no se puede cerrar; se cambia en Perfil (`PUT /api/yo/nombre`). `GET /api/yo` lo devuelve (con una sola lectura del usuario, `perfilDe`) y el listado del administrador lo enseña (Sprint 2, PBI-21, T-60).
- **Por qué:** saludar con el correo queda mal; lo pidió el alumno. El inicio de sesión sigue siendo email y contraseña (especificación del Sprint 1).
- **Estado:** vigente.

## D-33 Inicio "Hoy"
- **Qué se decidió:** el inicio deja de repetir el menú y pasa a ser una pantalla "Hoy" (opción A, elegida por el alumno): saludo con el nombre y la fecha; una tarjeta principal con un único botón (seguir el entreno en curso, empezar la rutina que toca o crear la primera); y tres cifras (entrenos esta semana, racha de semanas seguidas y último récord). Lo calcula la lógica con funciones puras (`rutinaSugerida`: primero una sin estrenar, si no la que lleva más tiempo sin hacerse; `rachaSemanas`: la semana actual sin entrenos no rompe la racha; `ultimoRecord`) y lo da una sola ruta, `GET /api/hoy` (Sprint 2, PBI-21, T-61).
- **Por qué:** abrir la app y entrenar en un toque. Una sola petición en vez de varias. Las reglas (qué rutina toca, qué cuenta como racha) son de negocio: van en el servidor y se prueban.
- **Estado:** vigente.

## D-34 La vez anterior como referencia
- **Qué se decidió:** al empezar un entreno desde una rutina, la lógica busca el último entreno terminado de esa rutina y copia en cada serie (`anterior: { pesoKg, repeticiones }`) lo que se hizo en la misma posición del mismo ejercicio (`anadirAnteriores`, función pura). Se muestra en gris dentro de los campos vacíos; al marcar con campos vacíos se usan esos valores. Al terminar el entreno `anterior` se quita. Las series añadidas después y los entrenos libres no lo tienen (Sprint 2, PBI-21, T-62).
- **Por qué:** lo pidió el alumno para tener una referencia al entrenar. Copiarlo al empezar (como el objetivo) evita una consulta más en cada petición. Por posición porque cada serie de un ejercicio suele tener su peso.
- **Estado:** vigente.

## D-35 Tema claro y oscuro en el dispositivo
- **Qué se decidió:** paleta oscura en `:root[data-tema="oscuro"]` de `styles.css` (carbón cálido, el naranja más claro cuando es texto, `color-scheme: dark`). La elige Perfil → Apariencia: Claro, Oscuro o Automático (por defecto; sigue el modo del móvil y cambia con él). La aplica `cliente/presentacion/tema.js`, un script normal en el `<head>` de las 9 páginas que actúa antes de pintar (sin destello blanco) y cambia también el `theme-color`. Se guarda en el navegador (`localStorage`, clave `forja-tema`), no en el servidor (Sprint 2, PBI-21, T-63).
- **Por qué:** decisión del alumno: es una preferencia del dispositivo. Como todos los colores eran variables (D-26), basta otro juego de valores.
- **Estado:** vigente. Falta comprobar en el iPhone cómo queda la barra de estado de la app instalada en modo oscuro.

## D-36 El tic se ve siempre
- **Qué se decidió:** el botón de marcar una serie enseña el ✓ también sin marcar, en gris y con borde marcado; se pone naranja ("lista") cuando la serie ya se puede marcar (hay repeticiones escritas o de la vez anterior) y verde al marcarla. Se repinta al escribir en la fila, sin esperar al servidor (`pintarMarca` en `entreno.js`, clase `.btn-hecha.lista` en `styles.css`) (entre sprints, PBI-22, T-65).
- **Por qué:** lo notó el alumno entrenando: la caja vacía no invitaba a pulsar y no se entendía que ahí estaba el tic. Es el patrón de las apps de gimnasio conocidas.
- **Estado:** vigente. Probado a mano en tamaño móvil, en claro y en oscuro; falta verlo en el iPhone.

## D-37 Render despierto con un ping externo
- **Qué se decidió:** un servicio gratuito externo ([cron-job.org](https://cron-job.org)) pide `https://proyecto-saas-usuarios.onrender.com/manifest.webmanifest` cada 10 minutos. Se pide un archivo estático porque se sirve antes de la sesión (D-30): no consulta Atlas ni crea sesiones. No hay código nuevo; la tarea se configura en la cuenta del alumno (entre sprints, PBI-22, T-66).
- **Por qué:** la capa gratuita de Render apaga el servicio tras 15 minutos sin peticiones y la siguiente tarda de 30 a 60 s en arrancar. Con una petición cada 10 minutos nunca llega a dormirse. Render gratis da 750 h al mes y un mes tiene como mucho 744 h, así que cabe un solo servicio encendido todo el mes. Además, los avisos de fin de descanso (D-29) viven en la memoria del servidor y se pierden menos.
- **Estado:** vigente. No arregla la lentitud de cada petición (Render en Ohio y Atlas en París: T-67). Si Render cambia las condiciones de su capa gratuita, revisar.
