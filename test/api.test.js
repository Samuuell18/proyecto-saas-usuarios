// Tests de las restricciones de rol contra la API real (no solo la logica).
// Verifican que el SERVIDOR responde 401/403, no la GUI.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { app } from "../servidor/api.js";
import * as datos from "../servidor/datos.js";
import * as logica from "../servidor/logica.js";
import { cerrar } from "../servidor/bd.js";

process.env.MONGO_DB_NAME = "fitness_hub_test_api";
process.env.ADMIN_EMAIL = "jefa@demo.com";

let base;
let servidor;

function pedir(metodo, ruta, cookie, cuerpo) {
  return fetch(`${base}${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
}

async function login(email) {
  const res = await pedir("POST", "/api/login", null, { email, password: "secreta1" });
  assert.equal(res.status, 200);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

before(async () => {
  await datos.limpiar();
  await logica.registrar("jefa@demo.com", "secreta1");
  await logica.registrar("ana@demo.com", "secreta1");
  await logica.activar("jefa@demo.com");
  await logica.activar("ana@demo.com");
  await new Promise((ok) => {
    servidor = app.listen(0, ok);
  });
  base = `http://localhost:${servidor.address().port}`;
});

after(async () => {
  await datos.limpiar();
  delete process.env.ADMIN_EMAIL;
  await new Promise((ok) => servidor.close(ok));
  await cerrar();
});

test("sin sesion, listar usuarios da 401", async () => {
  const res = await pedir("GET", "/api/usuarios");
  assert.equal(res.status, 401);
});

test("usuario normal listando da 403", async () => {
  const cookie = await login("ana@demo.com");
  const res = await pedir("GET", "/api/usuarios", cookie);
  assert.equal(res.status, 403);
});

test("admin listando ve email, rol y estado sin hashes", async () => {
  const cookie = await login("jefa@demo.com");
  const res = await pedir("GET", "/api/usuarios", cookie);
  assert.equal(res.status, 200);
  const lista = await res.json();
  assert.equal(lista.length, 2);
  for (const u of lista) {
    assert.deepEqual(Object.keys(u).sort(), ["email", "estado", "rol"]);
  }
});

test("comprobar activo: usuario 403, admin 200", async () => {
  const cookieAna = await login("ana@demo.com");
  const r1 = await pedir("GET", "/api/usuarios/ana@demo.com/activo", cookieAna);
  assert.equal(r1.status, 403);
  const cookieJefa = await login("jefa@demo.com");
  const r2 = await pedir("GET", "/api/usuarios/ana@demo.com/activo", cookieJefa);
  assert.equal(r2.status, 200);
  assert.equal((await r2.json()).activo, true);
});

test("usuario normal no puede eliminar a otro (403)", async () => {
  const cookie = await login("ana@demo.com");
  const res = await pedir("DELETE", "/api/usuarios/jefa@demo.com", cookie);
  assert.equal(res.status, 403);
});

test("admin puede eliminar a cualquiera", async () => {
  const cookie = await login("jefa@demo.com");
  const res = await pedir("DELETE", "/api/usuarios/ana@demo.com", cookie);
  assert.equal(res.status, 200);
  assert.equal(await logica.comprobarActivo("ana@demo.com"), false);
});

test("usuario normal puede eliminar su propia cuenta y ya no entra", async () => {
  await logica.registrar("luis@demo.com", "secreta1");
  await logica.activar("luis@demo.com");
  const cookie = await login("luis@demo.com");
  const res = await pedir("DELETE", "/api/usuarios/luis@demo.com", cookie);
  assert.equal(res.status, 200);
  assert.equal((await pedir("GET", "/api/yo", cookie)).status, 401);
  const otraVez = await pedir("POST", "/api/login", null, { email: "luis@demo.com", password: "secreta1" });
  assert.equal(otraVez.status, 401);
});

test("si el admin elimina a alguien, su sesion abierta deja de valer", async () => {
  await logica.registrar("eva@demo.com", "secreta1");
  await logica.activar("eva@demo.com");
  const cookieEva = await login("eva@demo.com");
  assert.equal((await pedir("GET", "/api/yo", cookieEva)).status, 200);
  const cookieJefa = await login("jefa@demo.com");
  await pedir("DELETE", "/api/usuarios/eva@demo.com", cookieJefa);
  assert.equal((await pedir("GET", "/api/yo", cookieEva)).status, 401);
});

test("admin eliminando una cuenta que no existe da 404", async () => {
  const cookie = await login("jefa@demo.com");
  const res = await pedir("DELETE", "/api/usuarios/nadie@demo.com", cookie);
  assert.equal(res.status, 404);
});

test("sin sesion, eliminar da 401", async () => {
  const res = await pedir("DELETE", "/api/usuarios/ana@demo.com");
  assert.equal(res.status, 401);
});

test("logout invalida la sesion", async () => {
  const cookie = await login("jefa@demo.com");
  assert.equal((await pedir("GET", "/api/yo", cookie)).status, 200);
  await pedir("POST", "/api/logout", cookie);
  assert.equal((await pedir("GET", "/api/yo", cookie)).status, 401);
});

test("login con datos mal da 401 y registro duplicado da 409", async () => {
  const r1 = await pedir("POST", "/api/login", null, { email: "jefa@demo.com", password: "mal1234" });
  assert.equal(r1.status, 401);
  const r2 = await pedir("POST", "/api/registro", null, { email: "jefa@demo.com", password: "secreta1" });
  assert.equal(r2.status, 409);
});

test("oauth sin configurar devuelve 501", async () => {
  const guardadas = {
    id: process.env.GITHUB_CLIENT_ID,
    secret: process.env.GITHUB_CLIENT_SECRET,
    url: process.env.APP_URL,
  };
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_SECRET;
  delete process.env.APP_URL;
  const res = await pedir("GET", "/api/oauth/github");
  if (guardadas.id !== undefined) process.env.GITHUB_CLIENT_ID = guardadas.id;
  if (guardadas.secret !== undefined) process.env.GITHUB_CLIENT_SECRET = guardadas.secret;
  if (guardadas.url !== undefined) process.env.APP_URL = guardadas.url;
  assert.equal(res.status, 501);
});

test("oauth callback sin codigo da 400 (con config de mentira)", async () => {
  process.env.GITHUB_CLIENT_ID = "id-mentira";
  process.env.GITHUB_CLIENT_SECRET = "secreto-mentira";
  process.env.APP_URL = "http://localhost:3000";
  const res = await fetch(`${base}/api/oauth/github/callback`, { redirect: "manual" });
  assert.equal(res.status, 400);
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_SECRET;
  delete process.env.APP_URL;
});

test("oauth inicio redirige a GitHub y el callback con state mal da 403", async () => {
  process.env.GITHUB_CLIENT_ID = "id-mentira";
  process.env.GITHUB_CLIENT_SECRET = "secreto-mentira";
  process.env.APP_URL = "http://localhost:3000";
  const inicio = await fetch(`${base}/api/oauth/github`, { redirect: "manual" });
  assert.equal(inicio.status, 302);
  const cookie = inicio.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  assert.match(inicio.headers.get("location"), /github\.com\/login\/oauth\/authorize/);
  const cb = await fetch(`${base}/api/oauth/github/callback?code=x&state=mal`, {
    redirect: "manual",
    headers: { Cookie: cookie },
  });
  assert.equal(cb.status, 403);
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_SECRET;
  delete process.env.APP_URL;
});
