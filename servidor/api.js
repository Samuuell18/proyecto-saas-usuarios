// Capa API: rutas HTTP. No tiene reglas de negocio, solo llama a `logica.js`.
// Sirve el frontend (mismo origen): el cliente nunca toca la BBDD.

import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import * as logica from "./logica.js";
import * as log from "./log.js";

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
    case "TOKEN_INVALIDO":
      return { status: 404, mensaje: "Enlace no válido o ya usado." };
    default:
      return { status: 400, mensaje: "Petición no válida." };
  }
}

app.post("/api/registro", async (req, res) => {
  try {
    const creado = await logica.registrar(req.body?.email, req.body?.password);
    log.info("registro", creado.email);
    res.status(201).json(creado);
  } catch (err) {
    log.error("registro-fallido", err.message);
    const { status, mensaje } = codigoError(err);
    res.status(status).json({ error: mensaje });
  }
});
app.post("/api/login", async (req, res) => {
  try {
    const usuario = await logica.iniciarSesion(req.body?.email, req.body?.password);
    // La sesión guarda email Y rol: las restricciones se deciden aquí, en el servidor.
    req.session.usuario = { email: usuario.email, rol: usuario.rol };
    log.info("login", usuario.email);
    res.json(usuario);
  } catch (err) {
    log.error("login-fallido", err.message);
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
    res.redirect("/?error=token");
  }
});

app.post("/api/logout", (req, res) => {
  log.info("logout", req.session.usuario?.email ?? "");
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

// --- OAuth con GitHub (T-20). El usuario nace activo, sin confirmar email. ---
// Hay UNA app OAuth registrada por entorno (localhost y URL pública), porque
// GitHub exige una callback exacta por app. Cada entorno usa su par de claves.

function oauthConfig() {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, APP_URL } = process.env;
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !APP_URL) return null;
  return { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, APP_URL };
}

// Paso 1: redirige a GitHub con un `state` guardado en sesión (anti-CSRF).
app.get("/api/oauth/github", (req, res) => {
  const cfg = oauthConfig();
  if (!cfg) return res.status(501).json({ error: "OAuth no configurado." });
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;
  const params = new URLSearchParams({
    client_id: cfg.GITHUB_CLIENT_ID,
    redirect_uri: `${cfg.APP_URL}/api/oauth/github/callback`,
    scope: "user:email",
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// Paso 2: GitHub devuelve aquí con ?code=&state=. Se canjea el code por token,
// se lee el email verificado y se crea la sesión. Sin code o state mal: error.
app.get("/api/oauth/github/callback", async (req, res) => {
  const cfg = oauthConfig();
  if (!cfg) return res.status(501).json({ error: "OAuth no configurado." });
  const { code, state } = req.query ?? {};
  if (!code) return res.status(400).json({ error: "Falta el código de GitHub." });
  if (!state || state !== req.session.oauthState) {
    return res.status(403).json({ error: "Estado OAuth inválido." });
  }
  delete req.session.oauthState;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: cfg.GITHUB_CLIENT_ID,
        client_secret: cfg.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${cfg.APP_URL}/api/oauth/github/callback`,
      }),
    });
    const { access_token } = await tokenRes.json();
    if (!access_token) throw new Error("OAUTH_SIN_TOKEN");
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${access_token}`, "User-Agent": "fitness-hub" },
    });
    const emails = await emailsRes.json();
    const principal = (Array.isArray(emails) ? emails : []).find((e) => e.primary && e.verified);
    if (!principal) throw new Error("OAUTH_SIN_EMAIL");
    const usuario = await logica.oauthLogin(principal.email);
    req.session.usuario = { email: usuario.email, rol: usuario.rol };
    log.info("oauth-login", usuario.email);
    res.redirect("/inicio.html");
  } catch (err) {
    log.error("oauth-fallido", err.message);
    res.redirect("/?error=oauth");
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.env.PORT ?? 3000);
  app.listen(puerto, () => console.log(`Servidor en http://localhost:${puerto}`));
}
