// Capa API: rutas HTTP. No tiene reglas de negocio, solo llama a `logica.js`.
// Sirve el frontend (mismo origen): el cliente nunca toca la BBDD.

import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import * as logica from "./logica.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "dev-secret-cambiar",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  })
);
// Frontend servido por el backend (mismo origen).
app.use(express.static(path.join(__dirname, "..", "cliente")));

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
      return { status: 400, mensaje: "La contraseña debe tener al menos 6 caracteres." };
    case "USUARIO_NO_EXISTE":
      return { status: 404, mensaje: "No existe esa cuenta." };
    default:
      return { status: 400, mensaje: "Petición no válida." };
  }
}

app.post("/api/registro", async (req, res) => {
  try {
    const creado = await logica.registrar(req.body?.email, req.body?.password);
    res.status(201).json(creado);
  } catch (err) {
    const { status, mensaje } = codigoError(err);
    res.status(status).json({ error: mensaje });
  }
});
app.post("/api/login", async (req, res) => {
  try {
    const usuario = await logica.iniciarSesion(req.body?.email, req.body?.password);
    // La sesión guarda email Y rol: las restricciones se deciden aquí, en el servidor.
    req.session.usuario = { email: usuario.email, rol: usuario.rol };
    res.json(usuario);
  } catch (err) {
    const { status, mensaje } = codigoError(err);
    res.status(status).json({ error: mensaje });
  }
});

// PROVISIONAL hasta el PBI-07 (email real): activa sin enlace.
// Se eliminará cuando la confirmación llegue por correo.
app.post("/api/activar", async (req, res) => {
  try {
    res.json(await logica.activar(req.body?.email));
  } catch (err) {
    const { status, mensaje } = codigoError(err);
    res.status(status).json({ error: mensaje });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/yo", (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ error: "Sin sesión." });
  res.json({ email: req.session.usuario.email, rol: req.session.usuario.rol });
});

// Restricciones de rol: se aplican aquí, en el servidor, no en la GUI.
function exigirSesion(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ error: "Sin sesión." });
  next();
}

function exigirAdmin(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ error: "Sin sesión." });
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
    return res.status(403).json({ error: "Solo puedes eliminar tu propia cuenta." });
  }
  if (!(await logica.eliminar(objetivo))) {
    return res.status(404).json({ error: "No existe esa cuenta." });
  }
  if (objetivo === yo.email) {
    req.session.destroy(() => res.json({ ok: true }));
  } else {
    res.json({ ok: true });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.env.PORT ?? 3000);
  app.listen(puerto, () => console.log(`Servidor en http://localhost:${puerto}`));
}
