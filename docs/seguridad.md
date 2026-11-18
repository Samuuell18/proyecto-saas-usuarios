---
type: Informe
title: Auditoría de seguridad (OWASP Top 10:2025)
description: Revisión estática del código de Forja contra el OWASP Top 10:2025, con hallazgos ordenados por gravedad y arreglos propuestos.
timestamp: 2026-11-18
---

# Auditoría de seguridad (T-74)

- **Fecha:** 2026-11-18. **Rama revisada:** `pbi-22-pulido-alojamiento` (commit `f6358b4`).
- **Alcance:** todo el repo: `servidor/` (API, lógica, datos, servicios), `cliente/` (páginas, JS, service worker), `.github/workflows/ci.yml`, `package.json` y `package-lock.json`, `.env.example`, `.gitignore`.
- **Referencia:** [OWASP Top 10:2025](https://owasp.org/Top10/2025/).
- **Método:** revisión **estática** (leer el código y seguir los datos desde la petición hasta la base de datos). No se ha ejecutado la app ni `npm audit`, ni se ha atacado la URL pública. Por tanto, esto es una primera revisión: indica riesgos razonados, no prueba que se puedan explotar en producción.
- **Contexto de ejecución:** `servidor/` corre en Node 22 en Render (detrás de un proxy https); `cliente/` corre en el navegador; `ci.yml` en GitHub Actions.

## Resumen

El proyecto parte de una base sana: contraseñas con bcrypt, sesión en cookie `httpOnly` + `SameSite=Lax` + `Secure` en producción, `state` anti-CSRF en OAuth, todos los recursos filtrados por el dueño de la sesión (404 para lo ajeno), ids convertidos con `aObjectId` y textos con `String()` (no hay inyección NoSQL visible), el cliente pinta con `textContent` (no hay XSS visible) y no quedan secretos en el repo tras la T-73.

El riesgo principal es **uno de diseño en el login con OAuth** (pre-secuestro de cuenta, gravedad alta). Después vienen la **falta de límites de intentos** (login, registro y reenvío de correos) y varios endurecimientos de gravedad baja.

| Gravedad | Nº | Hallazgos |
|---|---|---|
| Crítica | 0 | |
| Alta | 1 | A07-001 |
| Media | 2 | A07-002, A06-001 |
| Baja | 6 | A01-001, A07-003, A06-002, A10-001, A09-001, A09-002 |
| Informativa | 3 | A07-004, A04-001, A08-001 |

Confianza: alta en 9 hallazgos; media en A06-002 y A10-001 (dependen de la configuración real de Render); baja en ninguno.

## Hallazgos, de más a menos grave

### OWASP-A07-001 · Pre-secuestro de cuenta: OAuth activa una cuenta pendiente creada por otra persona

- **Categoría:** [A07:2025 Authentication Failures](https://owasp.org/Top10/2025/A07_2025-Authentication_Failures/) · [CWE-287 Improper Authentication](https://cwe.mitre.org/data/definitions/287.html).
- **Gravedad: Alta.** Permite entrar en la cuenta de otra persona con una contraseña que eligió el atacante. **Confianza: alta** (camino seguido en el código de principio a fin).
- **Dónde:** `servidor/logica.js:179-183` (`oauthLogin`), junto con `registrar` (`logica.js:38-60`).

```js
if (existente.estado === "pendiente") {
  await datos.actualizarEstado(emailLimpio, "activo");   // el hash del atacante se queda
  return { email: existente.email, estado: "activo", rol: existente.rol };
}
```

- **Explicado sencillo:** registrarse con email y contraseña no prueba que el email sea tuyo hasta que pulsas el enlace del correo. Pero si después **la dueña real** de ese email entra con Google o GitHub, la app activa esa cuenta pendiente **sin cambiar la contraseña que puso el desconocido**.
- **Cómo se explotaría:**
  1. El atacante hace `POST /api/registro` con `ana@gmail.com` (que aún no usa Forja) y su propia contraseña. La cuenta queda "pendiente".
  2. Días después, Ana descubre Forja y pulsa "Entrar con Google". `oauthLogin` ve la cuenta pendiente y la activa.
  3. El atacante hace `POST /api/login` con `ana@gmail.com` y su contraseña: entra y ve (y puede borrar) las rutinas, entrenos y récords de Ana.
  - Agravante: si el email es el de `ADMIN_EMAIL` y el admin todavía no tenía cuenta, el atacante acabaría con rol **admin**.
- **Por qué no lo para nada:** el proveedor sí verifica el email, pero eso solo demuestra que Ana es Ana, no que la contraseña guardada sea de Ana.
- **Arreglo propuesto (pequeño, en `logica.js`):** cuando OAuth activa una cuenta pendiente, sustituir el `hash` por uno aleatorio inutilizable (como ya se hace al crear una cuenta OAuth nueva, `logica.js:191`) y borrar sus tokens de confirmación (`datos.eliminarTokensDe`). Ana podría poner contraseña más adelante si se añade esa función. Test nuevo: registrar → OAuth con el mismo email → el login con la contraseña antigua da 401.
- Referencia: [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

### OWASP-A07-002 · El login no limita los intentos y la contraseña mínima es de 6 caracteres

- **Categoría:** A07 · [CWE-307 Improper Restriction of Excessive Authentication Attempts](https://cwe.mitre.org/data/definitions/307.html) (relacionado: [CWE-521 Weak Password Requirements](https://cwe.mitre.org/data/definitions/521.html)).
- **Gravedad: Media.** Con contraseñas cortas y sin freno se pueden probar miles de contraseñas de una cuenta conocida. **Confianza: alta** en el código; no se ha comprobado si Render pone algún freno delante (normalmente no en el plan gratis).
- **Dónde:** `servidor/api.js:164-176` (`POST /api/login`, sin límite) y `servidor/logica.js:43` (`length < 6`).
- **Explicado sencillo:** nada impide que un programa llame a `/api/login` sin parar con la lista de las contraseñas más comunes. Cada intento cuesta un bcrypt (~50-100 ms), que además gasta CPU del servidor.
- **Cómo se explotaría:** un script con `ana@gmail.com` y un diccionario de contraseñas de 6-8 caracteres, cientos de intentos por minuto.
- **Arreglo propuesto:** limitar intentos fallidos por email y por IP (por ejemplo, 5 fallos en 15 min → esperar). Opciones: el paquete `express-rate-limit` (una dependencia pequeña y muy usada) o un contador propio en MongoDB. Subir el mínimo a 8 caracteres (con el aviso en `index.html`). Con `trust proxy` ya puesto, `req.ip` es la IP real.
- Referencia: [OWASP Authentication Cheat Sheet — protección contra fuerza bruta](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#protect-against-automated-attacks).

### OWASP-A06-001 · Registro y "reenviar enlace" sin límite: se puede inundar de correos y agotar el cupo de Brevo

- **Categoría:** [A06:2025 Insecure Design](https://owasp.org/Top10/2025/A06_2025-Insecure_Design/) · [CWE-799 Improper Control of Interaction Frequency](https://cwe.mitre.org/data/definitions/799.html).
- **Gravedad: Media.** Cualquiera, sin cuenta, puede dejar a la app sin correos de confirmación durante el día y molestar a un tercero. **Confianza: alta.**
- **Dónde:** `servidor/api.js:153-163` (`POST /api/registro`) y `api.js:194-198` (`POST /api/reenviar`); el envío en `servidor/servicios/correo.js:13-40`.
- **Explicado sencillo:** cada llamada a `/api/reenviar` con un email pendiente manda un correo real por Brevo. El plan gratis de Brevo permite unos 300 correos al día: con un bucle se gastan en minutos, y entonces los usuarios nuevos de verdad no reciben su enlace (y no pueden entrar). Además, la víctima recibe cientos de correos.
- **Arreglo propuesto:** el mismo limitador de la A07-002 aplicado a `/api/registro` y `/api/reenviar` (por IP), y en `reenviarConfirmacion` no mandar otro correo si el último token de ese email tiene menos de 1-2 minutos (`confirmaciones.creado` ya existe).

### OWASP-A01-001 · Las suscripciones push aceptan cualquier dirección https (SSRF a ciegas)

- **Categoría:** [A01:2025 Broken Access Control](https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/) · [CWE-918 Server-Side Request Forgery](https://cwe.mitre.org/data/definitions/918.html).
- **Gravedad: Baja.** El servidor hace peticiones a donde diga un usuario, pero solo POST https, sin ver la respuesta. **Confianza: alta.**
- **Dónde:** `servidor/logica.js:832-846` (`normalizarSuscripcion` solo exige `^https://`), uso en `servidor/servicios/push.js:46` (`sendNotification`), disparado por `POST /api/avisos/prueba` (`api.js:526`) y `PUT /api/avisos/descanso` (`api.js:536`).
- **Explicado sencillo:** el "endpoint" de una suscripción debería ser siempre una dirección de Apple, Google, Mozilla o Microsoft. Como no se comprueba, un usuario puede guardar `https://cualquier-sitio/…` y luego pulsar "aviso de prueba": el servidor de Forja hará un POST allí. Se puede usar para que Forja "llame" a terceros en nombre del atacante o para tantear servicios internos. Además, el cuerpo de la respuesta de error se copia al log (`push.js:51`).
- **Arreglo propuesto:** lista blanca de servicios push en `normalizarSuscripcion` (función pura, fácil de probar): `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com` y `*.notify.windows.com`. Recortar `err.body` en el log (p. ej. 200 caracteres).
- Referencia: [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

### OWASP-A07-003 · La sesión no cambia de identificador al iniciar sesión

- **Categoría:** A07 · [CWE-384 Session Fixation](https://cwe.mitre.org/data/definitions/384.html).
- **Gravedad: Baja.** Haría falta poder plantar una cookie en el navegador de la víctima, algo difícil aquí (`onrender.com` está en la Public Suffix List, así que otras apps de Render no pueden poner cookies a Forja). **Confianza: alta** en el código.
- **Dónde:** `servidor/api.js:168` (login) y `api.js:681` (OAuth): `req.session.usuario = …` sin `req.session.regenerate()`.
- **Explicado sencillo:** el "número de sesión" de la cookie es el mismo antes y después de entrar. Si alguien consiguiera que tu navegador usara un número que él conoce, al iniciar tú sesión él quedaría dentro. La buena práctica es dar un número nuevo al entrar.
- **Arreglo propuesto:** envolver la asignación en `req.session.regenerate((err) => { … })` en los dos sitios (en OAuth, después de comprobar el `state`).
- Referencia: [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#renew-the-session-id-after-any-privilege-level-change).

### OWASP-A06-002 · Sin cabeceras de seguridad: la app se puede meter en un iframe (clickjacking)

- **Categoría:** A06 · [CWE-1021 Improper Restriction of Rendered UI Layers or Frames](https://cwe.mitre.org/data/definitions/1021.html).
- **Gravedad: Baja.** Las acciones peligrosas (eliminar cuenta, borrar entrenos) piden confirmación con `confirm()`, lo que lo dificulta. **Confianza: media** (no se han visto las cabeceras que añade Render).
- **Dónde:** `servidor/api.js:23-77`: no se pone `X-Frame-Options` / `Content-Security-Policy: frame-ancestors`, ni `X-Content-Type-Options: nosniff`, y Express anuncia `X-Powered-By: Express`.
- **Explicado sencillo:** otra web podría cargar Forja invisible dentro de la suya y engañarte para que hagas clic en un botón de Forja creyendo que pulsas otra cosa. Las cabeceras le dicen al navegador "no me metas en marcos ajenos".
- **Arreglo propuesto (sin dependencias):** un middleware de 6 líneas al principio de `api.js` con `app.disable("x-powered-by")` y las cabeceras `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` y una CSP sencilla (`default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`; hay que probar todas las páginas, porque bloquearía estilos o scripts en línea si los hay). Alternativa: el paquete `helmet`.
- **Comprobar a mano:** `curl -I https://forja-ykwq.onrender.com/` y ver qué cabeceras llegan.

### OWASP-A10-001 · Un error inesperado podría enseñar la traza del servidor

- **Categoría:** [A10:2025 Mishandling of Exceptional Conditions](https://owasp.org/Top10/2025/A10_2025-Mishandling_of_Exceptional_Conditions/) · [CWE-209 Generation of Error Message Containing Sensitive Information](https://cwe.mitre.org/data/definitions/209.html).
- **Gravedad: Baja.** Revelaría rutas y nombres internos, no datos de usuarios. **Confianza: media:** depende de si Render tiene `NODE_ENV=production` (no está en el repo).
- **Dónde:** rutas sin `try/catch`, por ejemplo `api.js:214-219` (`GET /api/yo`), `api.js:194` (`/api/reenviar`) o `api.js:448` (`GET /api/entrenos`). Si MongoDB falla, Express 5 usa su manejador por defecto, que **fuera de `production`** responde con la traza completa.
- **Arreglo propuesto:** un manejador de errores propio al final de `api.js` (`app.use((err, req, res, next) => { log.error(…); res.status(500).json({ error: "Error interno." }) })`) y poner `NODE_ENV=production` en Render.

### OWASP-A09-001 · Se pueden falsificar líneas del log con un email que lleve saltos de línea

- **Categoría:** [A09:2025 Security Logging and Alerting Failures](https://owasp.org/Top10/2025/A09_2025-Security_Logging_and_Alerting_Failures/) · [CWE-117 Improper Output Neutralization for Logs](https://cwe.mitre.org/data/definitions/117.html).
- **Gravedad: Baja.** Engaña a quien lee los logs; no da acceso. **Confianza: alta.**
- **Dónde:** el email solo se valida con `includes("@")` (`logica.js:40`) y `trim()` solo quita espacios de los extremos; se escribe tal cual en `log.js:6` (p. ej. `api.js:156` registro y `api.js:196` reenviar).
- **Explicado sencillo:** un "email" como `x@x\n[2026-…] INFO login admin@…` se guarda y al escribirlo en el log parece una línea más, de otro usuario.
- **Arreglo propuesto:** validar el email con una expresión sencilla sin espacios ni saltos (p. ej. `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, máx. 254) en `registrar` y `oauthLogin`, y en `log.js` sustituir `\r` y `\n` del detalle por un espacio.

### OWASP-A09-002 · Los fallos de login no dicen a qué cuenta ni desde dónde

- **Categoría:** A09 · [CWE-223 Omission of Security-relevant Information](https://cwe.mitre.org/data/definitions/223.html).
- **Gravedad: Baja.** **Confianza: alta.**
- **Dónde:** `api.js:172` escribe solo `login-fallido CREDENCIALES_INVALIDAS`.
- **Explicado sencillo:** si alguien intenta adivinar contraseñas (A07-002), en el log de Render se ve una lista de fallos, pero no se sabe contra qué cuenta ni desde qué IP, así que no se puede detectar ni bloquear.
- **Arreglo propuesto:** añadir el email normalizado y `req.ip` a `login-fallido` (nunca la contraseña).

### OWASP-A07-004 · Informativo: se puede saber si un email tiene cuenta

- El registro responde 409 "Ese email ya tiene cuenta" (`api.js:82`) y el login dice "Cuenta pendiente" **antes** de mirar la contraseña (`logica.js:123`). Es lo habitual en apps pequeñas y ayuda al usuario; el arreglo completo complica la experiencia. Recomendación: dejarlo y mover la comprobación de "pendiente" **después** de la de la contraseña (así solo lo sabe quien conoce la contraseña).

### OWASP-A04-001 · Informativo: los tokens de confirmación se guardan tal cual en la base de datos

- `datos.guardarToken` / `buscarPorToken` (`datos.js:161`). Si alguien leyera la colección `confirmaciones`, podría activar cuentas pendientes durante 24 h. Mejora opcional: guardar el SHA-256 del token y buscar por el hash.

### OWASP-A08-001 · Informativo: las acciones del CI se fijan por versión, no por huella

- `.github/workflows/ci.yml`: `actions/checkout@v4` y `actions/setup-node@v4` ([CWE-829](https://cwe.mitre.org/data/definitions/829.html)). La etiqueta `v4` la puede mover su autor; fijarlas por SHA es lo más estricto. El riesgo es bajo (acciones oficiales de GitHub y el secreto `MONGODB_URI` no se expone a PR de forks). Aceptable tal cual.

## Lo que está bien (comprobado)

- **Control de acceso:** `exigirSesion` / `exigirAdmin` en el servidor; cada rutina, entreno y ejercicio pasa por `comprobarAcceso` o se filtra por `dueno` de la sesión; el dueño nunca sale del cuerpo de la petición; borrar cuenta ajena exige admin (`api.js:273`).
- **CSRF:** cookie `SameSite=Lax` y API que solo acepta JSON; OAuth con `state` aleatorio comprobado (`api.js:669`).
- **Inyección:** emails y textos con `String()`, ids con `aObjectId` (regex de 24 hex), números con `Number()` y rangos; no se pasan objetos del cuerpo a filtros de MongoDB. Sin `eval`, sin comandos del sistema.
- **XSS:** el cliente pinta datos con `textContent`; los únicos `innerHTML` son textos fijos (`inicio.js:137,146`). El `url` de las notificaciones lo fija el servidor y el service worker lo resuelve en el propio origen.
- **Criptografía y secretos:** bcrypt coste 10, tokens con `crypto.randomBytes(32)`, `SESSION_SECRET` obligatorio, cookie `Secure` en https, `.env` en `.gitignore`, `.env.example` solo con nombres (T-73).
- **Errores que fallan cerrados:** si no se puede comprobar la cuenta, `sesionValida` lanza error y no deja pasar.

## Cobertura por categoría

| Categoría | Estado | Nota |
|---|---|---|
| A01 Broken Access Control | Revisada | Todas las rutas de `api.js`; SSRF en push (A01-001). |
| A02 Security Misconfiguration | Parcial | Código revisado; falta ver la configuración real de Render (variables, cabeceras). |
| A03 Software Supply Chain | Parcial | `package-lock.json` presente y CI con `npm ci`; versiones actuales (Express 5.2.1, body-parser 2.3.0, qs 6.16.0). **No se ha ejecutado `npm audit`** (consulta a internet; se pedirá permiso). |
| A04 Cryptographic Failures | Revisada | A04-001 (informativo). |
| A05 Injection | Revisada | Sin hallazgos. |
| A06 Insecure Design | Revisada | A06-001, A06-002. |
| A07 Authentication Failures | Revisada | A07-001 a A07-004. |
| A08 Software/Data Integrity | Revisada | A08-001 (informativo); sin deserialización insegura ni asignación masiva (los campos se eligen a mano en cada ruta). |
| A09 Logging and Alerting | Revisada | A09-001, A09-002; no hay alertas (normal en un proyecto de este tamaño). |
| A10 Exceptional Conditions | Revisada | A10-001. |

## Estado de los arreglos (18-nov)

Todos los hallazgos están arreglados en el PBI-23 (rama `pbi-23-seguridad`), cada uno con su prueba:

| Hallazgo | Tarea | Cómo se arregló |
|---|---|---|
| A07-001 (alta) | T-76 | `oauthLogin` cambia la contraseña por una inutilizable, pone el nombre del proveedor y borra los enlaces al activar una cuenta pendiente (`datos.activarPorProveedor`). |
| A07-002 (media) | T-77 | `express-rate-limit`: 10 fallos de login cada 15 min por IP y email (429); contraseña mínima de 8 en cuentas nuevas. |
| A06-001 (media) | T-77 | Registro 5 por hora y reenviar 3 cada 15 min por IP; además, 1 minuto entre correos al mismo email (`puedeReenviar`). |
| A01-001 (baja) | T-78 | `servicioPushPermitido`: solo `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com` y `*.notify.windows.com`; el error del servicio se recorta en el log. |
| A06-002 (baja) | T-79 | Cabeceras propias en `api.js`: CSP solo del propio servidor y sin marcos (`frame-ancestors 'none'`), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS en https; sin `X-Powered-By`. Probadas todas las páginas en el navegador. |
| A10-001 (baja) | T-80 | Manejador de errores al final de `api.js`: JSON corto sin traza y detalle en el log. **Falta `NODE_ENV=production` en Render.** |
| A07-003 (baja) | T-81 | `entrarEnSesion` usa `req.session.regenerate()` en login y OAuth. |
| A09-001 (baja) | T-82 | `emailValido` en `logica.js` y `log.js` escribe siempre una sola línea (`unaLinea`). |
| A09-002 (baja) | T-82 | `login-fallido` con email e IP. |
| A07-004 (info.) | T-83 | La contraseña se comprueba antes de decir "pendiente"; con cuenta inexistente se calcula un bcrypt de relleno (mismo tiempo de respuesta). |
| A04-001 (info.) | T-84 | En `confirmaciones` se guarda `tokenHuella` (SHA-256), no el token. Los enlaces enviados antes del cambio dejan de valer: se pide otro con "Reenviar". |
| A08-001 (info.) | T-85 | `ci.yml` fija `actions/checkout` y `actions/setup-node` por SHA (v4.4.0). |

De paso: los tests vaciaban las claves VAPID pero no `BREVO_API_KEY`, así que en local podían mandar correos de verdad a direcciones `@demo.com`; ahora la vacían. `npm audit` sigue pendiente (al instalar `express-rate-limit`, npm avisó de vulnerabilidades en dependencias ya existentes).

## Orden de arreglo propuesto

1. **A07-001** (alta, arreglo de pocas líneas en `logica.js` + test): primero.
2. **A07-002 + A06-001** juntos (mismo limitador para login, registro y reenvío).
3. **A01-001** (lista blanca de servicios push, función pura).
4. Endurecimiento barato en un solo cambio: **A06-002** (cabeceras), **A10-001** (manejador de errores), **A07-003** (regenerar sesión), **A09-001/002** (email y log).
5. Informativos: decidir si se hacen o se dejan anotados.

**Decisión del alumno (18-nov):** se arreglan todos, en el **PBI-23 Seguridad** (tareas T-76 a T-85, ver [entre-sprints.md](entre-sprints.md#pbi-23-seguridad)).

## Limitaciones

- Revisión estática: no se ha lanzado ningún ataque ni se ha probado contra producción.
- No se conocen las variables de Render (`NODE_ENV`), ni las cabeceras que añade su proxy, ni si hay algún límite de peticiones delante.
- No se han consultado bases de vulnerabilidades de las dependencias (`npm audit` pendiente).
- No se ha revisado la configuración de las cuentas externas (MongoDB Atlas: usuarios y lista de IPs; Brevo; apps OAuth de Google y GitHub).
