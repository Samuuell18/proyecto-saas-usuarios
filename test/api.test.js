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
