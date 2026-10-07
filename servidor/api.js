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
    default:
      return { status: 400, mensaje: "Petición no válida." };
  }
}

app.post("/api/registro", (req, res) => {
  try {
    const creado = logica.registrar(req.body?.email, req.body?.password);
    res.status(201).json(creado);
  } catch (err) {
    const { status, mensaje } = codigoError(err);
    res.status(status).json({ error: mensaje });
  }
});

app.post("/api/login", (req, res) => {
  try {
    const usuario = logica.iniciarSesion(req.body?.email, req.body?.password);
    req.session.usuario = usuario.email;
    res.json(usuario);
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
  res.json({ email: req.session.usuario });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.env.PORT ?? 3000);
  app.listen(puerto, () => console.log(`Servidor en http://localhost:${puerto}`));
}
