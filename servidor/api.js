// Capa API: rutas HTTP. No tiene reglas de negocio, solo llama a `logica.js`.
// Sirve el frontend (mismo origen): el cliente nunca toca la BBDD.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import dotenv from "dotenv";
import * as logica from "./logica.js";
import * as log from "./servicios/log.js";

dotenv.config();

// Sin secreto propio, cualquiera podría falsificar la cookie de sesión: mejor no arrancar.
if (!process.env.SESSION_SECRET) {
  throw new Error("Falta la variable de entorno SESSION_SECRET (ver .env.example).");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();
const CLIENTE = path.join(__dirname, "..", "cliente");

// T-67: la app se mudó a otro servicio de Render (forja.onrender.com, en Frankfurt, junto a la base
// de datos). El servicio viejo sigue vivo solo para que su URL (la entregada en el Sprint 1) no deje de
// funcionar: con la variable REDIRIGIR_A, CUALQUIER petición salta a la misma ruta en la URL nueva.
// 308 = "se ha mudado para siempre" y el navegador repite la petición igual (también un POST).
// Se lee en cada petición para poder probarlo; en el servicio nuevo la variable no existe.
app.use((req, res, next) => {
  const destino = (process.env.REDIRIGIR_A ?? "").replace(/\/+$/, "");
  if (!destino) return next();
  res.redirect(308, destino + req.originalUrl);
});

// T-72: la sesión dura 30 días desde el último uso.
const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000;
// En Render la app va detrás de un proxy que habla https con el móvil y http con Node.
// "trust proxy" hace que Express crea a ese proxy; si no, nunca mandaría una cookie `secure`.
const EN_HTTPS = (process.env.APP_URL ?? "").startsWith("https://");
if (EN_HTTPS) app.set("trust proxy", 1);

// T-79 (A06-002): cabeceras de seguridad en TODAS las respuestas (páginas, archivos y API).
// Le dicen al navegador qué puede hacer con la app:
// - CSP: solo se cargan scripts, estilos, fuentes e imágenes de nuestro propio servidor (si alguien
//   consiguiera colar un <script> ajeno, no se ejecutaría) y nadie puede meter Forja en un marco
//   (frame-ancestors 'none'), que es lo que permitía el "clickjacking".
// - X-Frame-Options: lo mismo que frame-ancestors, para navegadores antiguos.
// - nosniff: un archivo se trata como lo que dice ser (un .txt nunca se ejecuta como script).
// - Referrer-Policy: al salir a otra web no se le dice desde qué página de Forja vienes.
// - Permissions-Policy: la app no usa cámara, micrófono ni ubicación: se apagan.
// - HSTS (solo en https): el navegador recuerda que Forja va siempre cifrada.
// Sin dependencias: son seis cabeceras (el paquete `helmet` hace lo mismo con más opciones).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
app.disable("x-powered-by"); // no anunciar que el servidor es Express
app.use((req, res, next) => {
  res.set({
    "Content-Security-Policy": CSP,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  if (EN_HTTPS) res.set("Strict-Transport-Security", "max-age=15552000"); // 180 días
  next();
});

// T-59: el service worker usa primero la copia guardada de la app. Para que tras un despliegue
// se descargue la nueva, se sirve con una "huella" del contenido de cliente/: si cambia cualquier
// archivo, cambia la huella, cambia sw.js y el navegador instala el nuevo.
function huellaDe(carpeta) {
  const hash = crypto.createHash("sha256");
  const archivos = fs.readdirSync(carpeta, { recursive: true }).map(String).sort();
  for (const nombre of archivos) {
    const ruta = path.join(carpeta, nombre);
    if (!fs.statSync(ruta).isFile()) continue;
    hash.update(nombre.replaceAll("\\", "/"));
    hash.update(fs.readFileSync(ruta));
  }
  return hash.digest("hex").slice(0, 12);
}
const SW = fs.readFileSync(path.join(CLIENTE, "sw.js"), "utf8").replace("__HUELLA__", huellaDe(CLIENTE));
app.get("/sw.js", (req, res) => {
  res.type("js").set("Cache-Control", "no-cache").send(SW);
});

// Frontend servido por el backend (mismo origen). Va ANTES de la sesión (T-59): los archivos de
// la app (HTML, CSS, JS, iconos) no necesitan sesión, y así no se consulta MongoDB por cada uno.
app.use(express.static(CLIENTE));
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    // Las sesiones se guardan en MongoDB, no en memoria: así sobreviven
    // cuando Render duerme o reinicia la app. El almacén lo crea la capa de datos.
    store: logica.crearAlmacenSesiones(),
    resave: false,
    saveUninitialized: false,
    // T-72: con cada respuesta se renueva la caducidad de la cookie: solo pide entrar de nuevo
    // tras 30 días SIN usar la app (connect-mongo borra la sesión en la misma fecha).
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // Sin maxAge la cookie era "de sesión" y el móvil la tiraba al cerrar la app.
      maxAge: DURACION_SESION_MS,
      // En producción (https) la cookie solo viaja cifrada.
      secure: EN_HTTPS,
    },
  })
);

function codigoError(err) {
  switch (err?.message) {
    case "EMAIL_YA_EXISTE":
      return { status: 409, mensaje: "Ese email ya tiene cuenta." };
    case "CUENTA_PENDIENTE":
      return { status: 403, mensaje: "Cuenta pendiente: confirma tu email antes de entrar." };
    case "CREDENCIALES_INVALIDAS":
      return { status: 401, mensaje: "Email o contraseña incorrectos." };
    case "EMAIL_INVALIDO":
      return { status: 400, mensaje: "Email no válido." };
    case "PASSWORD_CORTA":
      return { status: 400, mensaje: `La contraseña debe tener al menos ${logica.PASSWORD_MIN} caracteres.` };
    // T-60: nombre obligatorio.
    case "NOMBRE_USUARIO_INVALIDO":
      return { status: 400, mensaje: "Escribe tu nombre (de 2 a 40 caracteres)." };
    case "USUARIO_NO_EXISTE":
      return { status: 404, mensaje: "No existe esa cuenta." };
    case "TOKEN_INVALIDO":
      return { status: 404, mensaje: "Enlace no válido o ya usado." };
    // T-29: un recurso ajeno responde igual que uno que no existe.
    case "RECURSO_NO_EXISTE":
      return { status: 404, mensaje: "No existe." };
    case "RECURSO_SOLO_LECTURA":
      return { status: 403, mensaje: "Los ejercicios base no se pueden modificar." };
    // T-31: ejercicios.
    case "NOMBRE_INVALIDO":
      return { status: 400, mensaje: "El nombre debe tener entre 2 y 60 caracteres." };
    case "GRUPO_INVALIDO":
      return { status: 400, mensaje: "Elige un grupo muscular de la lista." };
    case "EJERCICIO_YA_EXISTE":
      return { status: 409, mensaje: "Ya tienes un ejercicio con ese nombre (o es uno de los de la app)." };
    // T-34: rutinas.
    case "RUTINA_SIN_EJERCICIOS":
      return { status: 400, mensaje: "La rutina debe tener entre 1 y 30 ejercicios." };
    case "LINEA_RUTINA_INVALIDA":
      return {
        status: 400,
        mensaje: "Revisa los ejercicios: series de 1 a 20, repeticiones de 1 a 100 (mínimo ≤ máximo) y descanso de 0 a 600 s.",
      };
    case "EJERCICIO_NO_VALIDO":
      return { status: 400, mensaje: "Algún ejercicio de la rutina no existe." };
    case "RUTINA_YA_EXISTE":
      return { status: 409, mensaje: "Ya tienes una rutina con ese nombre." };
    // T-37: entrenos.
    case "ENTRENO_EN_CURSO":
      return { status: 409, mensaje: "Ya tienes un entreno en curso: termínalo o descártalo antes de empezar otro." };
    case "SIN_ENTRENO_EN_CURSO":
      return { status: 404, mensaje: "No tienes ningún entreno en curso." };
    case "SERIE_NO_EXISTE":
      return { status: 404, mensaje: "Esa serie ya no existe." };
    case "SERIE_INVALIDA":
      return {
        status: 400,
        mensaje: "Revisa la serie: peso de 0 a 1000 kg (2204 lb) y repeticiones de 0 a 100. Para marcarla hecha, apunta el peso y al menos 1 repetición.",
      };
    // T-43: ajustes.
    case "UNIDAD_NO_VALIDA":
      return { status: 400, mensaje: "La unidad de peso debe ser kg o lb." };
    // T-55: notificaciones push.
    case "SUSCRIPCION_INVALIDA":
      return { status: 400, mensaje: "El navegador no ha dado una suscripción válida para los avisos." };
    case "SIN_AVISOS_ACTIVOS":
      return { status: 409, mensaje: "No tienes los avisos activados en ningún móvil." };
    case "DESCANSO_INVALIDO":
      return { status: 400, mensaje: "La hora de fin del descanso tiene que ser dentro de los próximos 15 minutos." };
    case "ENTRENO_VACIO":
      return { status: 400, mensaje: "No hay ninguna serie hecha: marca alguna o descarta el entreno." };
    case "ENTRENO_DEMASIADAS_SERIES":
      return { status: 400, mensaje: "Un entreno puede tener como mucho 200 series." };
    default:
      return { status: 400, mensaje: "Petición no válida." };
  }
}

// --- T-77 (A07-002 y A06-001): límite de intentos. Sin él, un programa podía probar contraseñas sin
// parar o pedir cientos de correos (y gastar el cupo diario de Brevo). Se cuentan en la memoria del
// servidor (express-rate-limit): si Render reinicia, vuelven a cero, aceptable con un solo servidor.
// Al pasarse, 429 "Too Many Requests" con la cabecera RateLimit que dice cuándo se puede volver. ---
function limitador({ minutos, maximo, ...opciones }) {
  return rateLimit({
    windowMs: minutos * 60 * 1000,
    limit: maximo,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res, next, opts) => {
      log.error("demasiados-intentos", `${req.path} ${req.ip}`);
      res.status(opts.statusCode).json({ error: "Demasiados intentos. Espera unos minutos y vuelve a probar." });
    },
    ...opciones,
  });
}

// Login: 10 FALLOS cada 15 min por IP y email (los aciertos no cuentan). Ir por email evita que
// alguien que se equivoca con su cuenta bloquee a otros que entran desde la misma red.
const limiteLogin = limitador({
  minutos: 15,
  maximo: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email ?? "").trim().toLowerCase()}`,
});
// Registro: 5 cuentas por hora desde la misma IP. Reenviar: 3 cada 15 min (además de 1 min por email).
const limiteRegistro = limitador({ minutos: 60, maximo: 5 });
const limiteReenviar = limitador({ minutos: 15, maximo: 3 });

app.post("/api/registro", limiteRegistro, async (req, res) => {
  try {
    const creado = await logica.registrar(req.body?.email, req.body?.password, req.body?.nombre);
    log.info("registro", creado.email);
    res.status(201).json(creado);
  } catch (err) {
    log.error("registro-fallido", err.message);
    const { status, mensaje } = codigoError(err);
    res.status(status).json({ error: mensaje });
  }
});
// T-81 (A07-003): al entrar, sesión NUEVA. `regenerate` borra la sesión que tuviera el navegador y
// crea otra con otro identificador en la cookie. Así, si alguien hubiera conseguido que tu navegador
// usara un identificador que él conoce ("fijación de sesión"), al iniciar sesión deja de valer.
// La sesión guarda email Y rol: las restricciones se deciden aquí, en el servidor.
function entrarEnSesion(req, usuario) {
  return new Promise((ok, mal) => {
    req.session.regenerate((err) => {
      if (err) return mal(err);
      req.session.usuario = { email: usuario.email, rol: usuario.rol };
      ok();
    });
  });
}

app.post("/api/login", limiteLogin, async (req, res) => {
  try {
    const usuario = await logica.iniciarSesion(req.body?.email, req.body?.password);
    await entrarEnSesion(req, usuario);
    log.info("login", usuario.email);
    res.json(usuario);
  } catch (err) {
    // T-82 (A09-002): con el email y la IP se ve en el log si alguien está probando contraseñas.
    // (Nunca la contraseña.)
    const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 254);
    log.error("login-fallido", `${email} ${req.ip} ${err.message}`);
    const { status, mensaje } = codigoError(err);
    res.status(status).json({ error: mensaje });
  }
});

// Confirmación por email (T-21): el enlace del correo llega aquí,
// activa la cuenta y te deja en el acceso. Sustituye al activar provisional.
app.get("/api/confirmar", async (req, res) => {
  try {
    const cuenta = await logica.confirmar(req.query?.token);
    log.info("confirmar", cuenta.email);
    res.redirect("/?confirmado=1");
  } catch (err) {
    log.error("confirmar-fallido", err.message);
    // Caducado tiene su propio aviso: el usuario puede pedir un enlace nuevo.
    res.redirect(err.message === "TOKEN_CADUCADO" ? "/?error=caducado" : "/?error=token");
  }
});

// Reenviar el enlace de confirmación (T-26). Siempre responde lo mismo,
// exista o no la cuenta, para no revelar qué emails están registrados.
app.post("/api/reenviar", limiteReenviar, async (req, res) => {
  const reenviado = await logica.reenviarConfirmacion(req.body?.email);
  if (reenviado) log.info("reenviar-confirmacion", String(req.body.email).trim().toLowerCase());
  res.json({ mensaje: "Si la cuenta está pendiente, te hemos enviado un enlace nuevo." });
});

app.post("/api/logout", (req, res) => {
  log.info("logout", req.session.usuario?.email ?? "");
  req.session.destroy(() => res.json({ ok: true }));
});

// La sesión solo vale mientras la cuenta siga activa: si el admin la elimina,
// la sesión abierta de ese usuario se cierra en su siguiente petición.
async function sesionValida(req) {
  if (!req.session.usuario) return false;
  if (await logica.comprobarActivo(req.session.usuario.email)) return true;
  await new Promise((ok) => req.session.destroy(ok));
  return false;
}

app.get("/api/yo", async (req, res) => {
  if (!(await sesionValida(req))) return res.status(401).json({ error: "Sin sesión." });
  const { email, rol } = req.session.usuario;
  const { nombre, unidadPeso } = await logica.perfilDe(email);
  res.json({ email, nombre, rol, unidadPeso });
});

// T-60: el nombre del usuario de la sesión. { nombre }
app.put("/api/yo/nombre", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    const nombre = await logica.cambiarNombre(email, req.body?.nombre);
    log.info("nombre-cambiado", email);
    res.json({ nombre });
  } catch (err) {
    responderError(res, err, "nombre-fallido", email);
  }
});

// T-43: ajustes del usuario. { unidad: "kg" | "lb" }; solo cambia la del usuario de la sesión.
app.put("/api/yo/unidad", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    const unidadPeso = await logica.cambiarUnidadPeso(email, req.body?.unidad);
    log.info("unidad-cambiada", `${email} ${unidadPeso}`);
    res.json({ unidadPeso });
  } catch (err) {
    responderError(res, err, "unidad-fallida", email);
  }
});

// Restricciones de rol: se aplican aquí, en el servidor, no en la GUI.
async function exigirSesion(req, res, next) {
  if (!(await sesionValida(req))) return res.status(401).json({ error: "Sin sesión." });
  next();
}

async function exigirAdmin(req, res, next) {
  if (!(await sesionValida(req))) return res.status(401).json({ error: "Sin sesión." });
  if (req.session.usuario.rol !== "admin") {
    return res.status(403).json({ error: "Solo para administradores." });
  }
  next();
}

// Solo admin: lista email, rol y estado de cada usuario.
app.get("/api/usuarios", exigirAdmin, async (req, res) => {
  res.json(await logica.listar());
});

// Solo admin: comprobar si un usuario está activo (confirmado y no eliminado).
app.get("/api/usuarios/:email/activo", exigirAdmin, async (req, res) => {
  res.json({ email: req.params.email, activo: await logica.comprobarActivo(req.params.email) });
});

// Admin a cualquiera; usuario normal solo a sí mismo.
app.delete("/api/usuarios/:email", exigirSesion, async (req, res) => {
  const yo = req.session.usuario;
  const objetivo = String(req.params.email).trim().toLowerCase();
  if (yo.rol !== "admin" && objetivo !== yo.email) {
    log.error("eliminar-denegado", `${yo.email} -> ${objetivo}`);
    return res.status(403).json({ error: "Solo puedes eliminar tu propia cuenta." });
  }
  if (!(await logica.eliminar(objetivo))) {
    return res.status(404).json({ error: "No existe esa cuenta." });
  }
  log.info("eliminar", `${yo.email} elimino a ${objetivo}`);
  if (objetivo === yo.email) {
    req.session.destroy(() => res.json({ ok: true }));
  } else {
    res.json({ ok: true });
  }
});

// --- Ejercicios (T-31). El dueño SIEMPRE sale de la sesión, nunca del cuerpo de la petición. ---

// Base + propios del usuario de la sesión.
app.get("/api/ejercicios", exigirSesion, async (req, res) => {
  res.json(await logica.listarEjercicios(req.session.usuario.email));
});

// Grupos musculares válidos (para el formulario de crear).
app.get("/api/ejercicios/grupos", exigirSesion, (req, res) => {
  res.json(logica.gruposMusculares());
});

app.post("/api/ejercicios", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    const { nombre, familia, grupo } = req.body ?? {};
    const creado = await logica.crearEjercicio(email, { nombre, familia, grupo });
    log.info("ejercicio-creado", `${email} ${creado.nombre}`);
    res.status(201).json(creado);
  } catch (err) {
    log.error("ejercicio-fallido", `${email} ${err.message}`);
    const { status, mensaje } = codigoError(err);
    res.status(status).json({ error: mensaje });
  }
});

// --- Rutinas (T-34). El dueño sale de la sesión; si una rutina es de otro, la lógica
// lanza RECURSO_NO_EXISTE (404), igual que si no existiera. ---

// Mismo tratamiento de errores para todas las rutas de rutinas: log + código HTTP.
function responderError(res, err, evento, email) {
  log.error(evento, `${email} ${err.message}`);
  const { status, mensaje } = codigoError(err);
  res.status(status).json({ error: mensaje });
}

app.get("/api/rutinas", exigirSesion, async (req, res) => {
  res.json(await logica.listarRutinas(req.session.usuario.email));
});

app.post("/api/rutinas", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    const { nombre, ejercicios } = req.body ?? {};
    const creada = await logica.crearRutina(email, { nombre, ejercicios });
    log.info("rutina-creada", `${email} ${creada.nombre}`);
    res.status(201).json(creada);
  } catch (err) {
    responderError(res, err, "rutina-fallida", email);
  }
});

app.get("/api/rutinas/:id", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    res.json(await logica.obtenerRutina(email, req.params.id));
  } catch (err) {
    responderError(res, err, "rutina-fallida", email);
  }
});

app.put("/api/rutinas/:id", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    const { nombre, ejercicios } = req.body ?? {};
    const editada = await logica.actualizarRutina(email, req.params.id, { nombre, ejercicios });
    log.info("rutina-editada", `${email} ${editada.nombre}`);
    res.json(editada);
  } catch (err) {
    responderError(res, err, "rutina-fallida", email);
  }
});

app.delete("/api/rutinas/:id", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    await logica.eliminarRutina(email, req.params.id);
    log.info("rutina-eliminada", `${email} ${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    responderError(res, err, "rutina-fallida", email);
  }
});

// --- Entrenos (T-37). Solo hay un entreno en curso por usuario, así que las rutas usan
// "actual" en vez de un id: siempre es el del usuario de la sesión, nunca el de otro. ---

// El entreno en curso, o null si no hay (200 en los dos casos: no tener uno es normal).
app.get("/api/entrenos/actual", exigirSesion, async (req, res) => {
  res.json(await logica.obtenerEntrenoEnCurso(req.session.usuario.email));
});

// Empezar: { rutinaId } desde una rutina propia, o sin cuerpo para un entreno libre.
app.post("/api/entrenos", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    const entreno = await logica.iniciarEntreno(email, { rutinaId: req.body?.rutinaId });
    log.info("entreno-iniciado", `${email} ${entreno.rutinaNombre ?? "libre"}`);
    res.status(201).json(entreno);
  } catch (err) {
    responderError(res, err, "entreno-fallido", email);
  }
});

// { ejercicioId } añade una serie vacía al final; { despuesDe } copia esa serie justo detrás.
app.post("/api/entrenos/actual/series", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    const { ejercicioId, despuesDe } = req.body ?? {};
    res.status(201).json(await logica.anadirSerie(email, { ejercicioId, despuesDe }));
  } catch (err) {
    responderError(res, err, "entreno-fallido", email);
  }
});

app.put("/api/entrenos/actual/series/:serieId", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    // El peso llega en la unidad del usuario; la lógica lo pasa a kg (T-43).
    const { peso, repeticiones, hecha } = req.body ?? {};
    res.json(await logica.actualizarSerie(email, req.params.serieId, { peso, repeticiones, hecha }));
  } catch (err) {
    responderError(res, err, "entreno-fallido", email);
  }
});

app.delete("/api/entrenos/actual/series/:serieId", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    res.json(await logica.eliminarSerie(email, req.params.serieId));
  } catch (err) {
    responderError(res, err, "entreno-fallido", email);
  }
});

app.post("/api/entrenos/actual/terminar", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    const entreno = await logica.terminarEntreno(email);
    log.info("entreno-terminado", `${email} ${entreno.series.length} series`);
    res.json(entreno);
  } catch (err) {
    responderError(res, err, "entreno-fallido", email);
  }
});

app.delete("/api/entrenos/actual", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    await logica.descartarEntreno(email);
    log.info("entreno-descartado", email);
    res.json({ ok: true });
  } catch (err) {
    responderError(res, err, "entreno-fallido", email);
  }
});

// --- Historial (T-44): entrenos terminados. Estas rutas van DESPUÉS de las de "actual":
// Express prueba las rutas en orden, así que /api/entrenos/actual nunca llega a /:id. ---

app.get("/api/entrenos", exigirSesion, async (req, res) => {
  res.json(await logica.listarHistorial(req.session.usuario.email));
});

app.get("/api/entrenos/:id", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    res.json(await logica.obtenerEntrenoTerminado(email, req.params.id));
  } catch (err) {
    responderError(res, err, "historial-fallido", email);
  }
});

app.delete("/api/entrenos/:id", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    await logica.eliminarEntrenoTerminado(email, req.params.id);
    log.info("entreno-borrado", `${email} ${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    responderError(res, err, "historial-fallido", email);
  }
});

// --- Métricas de progreso (T-47). Siempre del usuario de la sesión, con los pesos en su unidad. ---

// Entrenos y volumen de las últimas 8 semanas y el récord de cada ejercicio.
app.get("/api/metricas", exigirSesion, async (req, res) => {
  res.json(await logica.obtenerMetricas(req.session.usuario.email));
});

// T-61: la pantalla "Hoy" del inicio (rutina que toca, entreno en curso, racha, último récord).
app.get("/api/hoy", exigirSesion, async (req, res) => {
  res.json(await logica.obtenerHoy(req.session.usuario.email));
});

// Evolución de un ejercicio, un punto por entreno (404 si nunca lo ha hecho).
app.get("/api/metricas/ejercicios/:id", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    res.json(await logica.obtenerProgresoEjercicio(email, req.params.id));
  } catch (err) {
    responderError(res, err, "metricas-fallidas", email);
  }
});

// --- Notificaciones push (T-55, D-29). Siempre del usuario de la sesión. ---

// Clave pública VAPID para que el navegador se suscriba (null: el servidor no tiene avisos).
app.get("/api/avisos/clave", exigirSesion, (req, res) => {
  res.json({ clave: logica.clavePublicaAvisos() });
});

// Guarda la suscripción de este móvil: { suscripcion: PushSubscription.toJSON() }.
app.post("/api/avisos/suscripcion", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    await logica.activarAvisos(email, req.body?.suscripcion);
    log.info("avisos-activados", email);
    res.status(201).json({ ok: true });
  } catch (err) {
    responderError(res, err, "avisos-fallidos", email);
  }
});

// Quita la suscripción de este móvil: { endpoint }.
app.delete("/api/avisos/suscripcion", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    await logica.desactivarAvisos(email, req.body?.endpoint);
    log.info("avisos-desactivados", email);
    res.json({ ok: true });
  } catch (err) {
    responderError(res, err, "avisos-fallidos", email);
  }
});

// Manda un aviso de prueba a los móviles del usuario.
app.post("/api/avisos/prueba", exigirSesion, async (req, res) => {
  const email = req.session.usuario.email;
  try {
    res.json({ enviados: await logica.avisoDePrueba(email) });
  } catch (err) {
    responderError(res, err, "avisos-fallidos", email);
  }
});

// T-56: aviso al terminar el descanso. { fin: fecha ISO } lo programa (o lo reprograma).
app.put("/api/avisos/descanso", exigirSesion, (req, res) => {
  const email = req.session.usuario.email;
  try {
    res.json(logica.programarAvisoDescanso(email, req.body?.fin));
  } catch (err) {
    responderError(res, err, "avisos-fallidos", email);
  }
});

// Saltar el descanso: se cancela el aviso pendiente (si no había, no pasa nada).
app.delete("/api/avisos/descanso", exigirSesion, (req, res) => {
  logica.cancelarAvisoDescanso(req.session.usuario.email);
  res.json({ ok: true });
});

// --- OAuth con Google. El usuario nace activo, sin confirmar email. ---
// T-86: hasta el 18-nov también había GitHub (T-20); se quitó porque casi nadie lo usa para una app de
// gimnasio (la especificación pide "al menos un proveedor externo"). La tabla PROVEEDORES se mantiene:
// añadir otro proveedor sigue siendo declarar sus URLs aquí, sin tocar el flujo.
// Hay UNA app OAuth registrada por entorno (localhost y URL pública), porque
// el proveedor exige una callback exacta por app. Cada entorno usa su par de claves.
// Cada proveedor solo declara sus URLs y cómo leer el email verificado (y el nombre, T-60);
// el flujo (state anti-CSRF, canje del code, sesión) es el mismo para todos.

const PROVEEDORES = {
  google: {
    nombre: "Google",
    idVar: "GOOGLE_CLIENT_ID",
    secretoVar: "GOOGLE_CLIENT_SECRET",
    urlAutorizar: "https://accounts.google.com/o/oauth2/v2/auth",
    parametrosExtra: { scope: "openid email profile", response_type: "code" }, // profile: el nombre (T-60)
    async canjear(code, cfg) {
      // Google pide el cuerpo como formulario (no JSON) y el grant_type.
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: cfg.id,
          client_secret: cfg.secreto,
          code,
          redirect_uri: cfg.callback,
          grant_type: "authorization_code",
        }),
      });
      return (await r.json()).access_token;
    },
    async emailVerificado(token) {
      const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const info = await r.json();
      return info.email_verified ? info.email : undefined;
    },
    async nombre(token) {
      const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return (await r.json()).name;
    },
  },
};

// Devuelve el proveedor con sus claves, o null si falta alguna variable de entorno.
function oauthConfig(clave) {
  const proveedor = PROVEEDORES[clave];
  const { APP_URL } = process.env;
  const id = process.env[proveedor.idVar];
  const secreto = process.env[proveedor.secretoVar];
  if (!id || !secreto || !APP_URL) return null;
  return { proveedor, id, secreto, callback: `${APP_URL}/api/oauth/${clave}/callback` };
}

// Solo valen los proveedores declarados arriba; cualquier otro nombre es 404.
app.use("/api/oauth/:proveedor", (req, res, next) => {
  if (!Object.hasOwn(PROVEEDORES, req.params.proveedor)) {
    return res.status(404).json({ error: "Proveedor desconocido." });
  }
  next();
});

// Paso 1: redirige al proveedor con un `state` guardado en sesión (anti-CSRF).
app.get("/api/oauth/:proveedor", (req, res) => {
  const cfg = oauthConfig(req.params.proveedor);
  if (!cfg) return res.status(501).json({ error: "OAuth no configurado." });
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;
  const params = new URLSearchParams({
    client_id: cfg.id,
    redirect_uri: cfg.callback,
    ...cfg.proveedor.parametrosExtra,
    state,
  });
  res.redirect(`${cfg.proveedor.urlAutorizar}?${params}`);
});

// Paso 2: el proveedor devuelve aquí con ?code=&state=. Se canjea el code por token,
// se lee el email verificado y se crea la sesión. Sin code o state mal: error.
app.get("/api/oauth/:proveedor/callback", async (req, res) => {
  const cfg = oauthConfig(req.params.proveedor);
  if (!cfg) return res.status(501).json({ error: "OAuth no configurado." });
  const { code, state } = req.query ?? {};
  if (!code) return res.status(400).json({ error: `Falta el código de ${cfg.proveedor.nombre}.` });
  if (!state || state !== req.session.oauthState) {
    return res.status(403).json({ error: "Estado OAuth inválido." });
  }
  delete req.session.oauthState;
  try {
    const token = await cfg.proveedor.canjear(code, cfg);
    if (!token) throw new Error("OAUTH_SIN_TOKEN");
    const email = await cfg.proveedor.emailVerificado(token);
    if (!email) throw new Error("OAUTH_SIN_EMAIL");
    // El nombre es opcional: si el proveedor no lo da (o falla), la app lo pedirá después.
    const nombre = await cfg.proveedor.nombre(token).catch(() => null);
    const usuario = await logica.oauthLogin(email, nombre);
    await entrarEnSesion(req, usuario);
    log.info("oauth-login", `${req.params.proveedor} ${usuario.email}`);
    res.redirect("/inicio.html");
  } catch (err) {
    log.error("oauth-fallido", `${req.params.proveedor} ${err.message}`);
    res.redirect("/?error=oauth");
  }
});

// VARIANTE-6: endpoint PÚBLICO (sin sesión). Solo lee la petición,
// llama a la lógica y devuelve la respuesta con el contrato exacto.
app.post("/api/prueba/estado", (req, res) => {
  const { proveedor, confirmado, eliminado } = req.body ?? {};
  if (
    (proveedor !== "local" && proveedor !== "oauth") ||
    typeof confirmado !== "boolean" ||
    typeof eliminado !== "boolean"
  ) {
    return res.status(400).json({ error: "Petición no válida." });
  }
  res.json(logica.calcularEstado({ proveedor, confirmado, eliminado }));
});

// T-80 (A10-001): manejador de errores propio, el ÚLTIMO de la cadena. Recoge lo que ninguna ruta
// controla (MongoDB caído, un JSON mal escrito en la petición...). Sin él, Express respondía con su
// página de error, que fuera de producción enseña la traza (rutas y nombres internos del servidor).
// Ahora: el detalle va al log y al cliente solo un mensaje corto, siempre en JSON.
// (Express lo reconoce como manejador de errores porque tiene CUATRO parámetros.)
app.use((err, req, res, next) => {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  log.error("error-inesperado", `${req.method} ${req.path} (${status}) ${err.message}`);
  res.status(status).json({ error: status === 500 ? "Error interno. Inténtalo de nuevo." : "Petición no válida." });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.env.PORT ?? 3000);
  // T-30: antes de aceptar peticiones, el catálogo de ejercicios base tiene que estar en la BBDD.
  const nuevos = await logica.prepararCatalogo();
  log.info("catalogo-ejercicios", `${nuevos} ejercicios base añadidos`);
  app.listen(puerto, () => console.log(`Servidor en http://localhost:${puerto}`));
}
