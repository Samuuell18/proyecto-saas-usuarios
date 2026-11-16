// Tests de las restricciones de rol contra la API real (no solo la logica).
// Verifican que el SERVIDOR responde 401/403, no la GUI.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as datos from "../servidor/datos.js";
import * as logica from "../servidor/logica.js";
import { cerrar, getDb } from "../servidor/bd.js";

process.env.MONGO_DB_NAME = "fitness_hub_test_api";
process.env.ADMIN_EMAIL = "jefa@demo.com";
// api.js se carga DESPUÉS de fijar la base de test: el almacén de sesiones lee
// MONGO_DB_NAME al cargarse, y un import normal se ejecutaría antes que estas líneas.
const { app } = await import("../servidor/api.js");

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
  // Leer el cuerpo como hace rest.js: express-session no termina la respuesta
  // hasta guardar la sesión en MongoDB, así que tras esto ya existe.
  await res.json();
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

before(async () => {
  await datos.limpiar();
  await logica.registrar("jefa@demo.com", "secreta1");
  await logica.registrar("ana@demo.com", "secreta1");
  await logica.activar("jefa@demo.com");
  await logica.activar("ana@demo.com");
  await logica.prepararCatalogo(); // como al arrancar el servidor (T-30)
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

test("reenviar responde igual exista o no la cuenta (200)", async () => {
  const conCuenta = await pedir("POST", "/api/reenviar", null, { email: "ana@demo.com" });
  const sinCuenta = await pedir("POST", "/api/reenviar", null, { email: "nadie@demo.com" });
  assert.equal(conCuenta.status, 200);
  assert.equal(sinCuenta.status, 200);
  assert.deepEqual(await conCuenta.json(), await sinCuenta.json());
});

test("la sesion se guarda en MongoDB y el logout la borra (T-27)", async () => {
  const sesiones = (await getDb()).collection("sesiones");
  const antes = await sesiones.countDocuments();
  const cookie = await login("ana@demo.com");
  assert.equal(await sesiones.countDocuments(), antes + 1);
  await pedir("POST", "/api/logout", cookie);
  assert.equal(await sesiones.countDocuments(), antes);
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

test("oauth con proveedor desconocido da 404", async () => {
  const res = await pedir("GET", "/api/oauth/facebook");
  assert.equal(res.status, 404);
});

test("oauth con Google sin configurar devuelve 501", async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  const res = await pedir("GET", "/api/oauth/google");
  assert.equal(res.status, 501);
});

test("oauth inicio redirige a Google y el callback con state mal da 403", async () => {
  process.env.GOOGLE_CLIENT_ID = "id-mentira";
  process.env.GOOGLE_CLIENT_SECRET = "secreto-mentira";
  process.env.APP_URL = "http://localhost:3000";
  const inicio = await fetch(`${base}/api/oauth/google`, { redirect: "manual" });
  assert.equal(inicio.status, 302);
  const cookie = inicio.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const destino = inicio.headers.get("location");
  assert.match(destino, /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  assert.match(destino, /redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Foauth%2Fgoogle%2Fcallback/);
  const cb = await fetch(`${base}/api/oauth/google/callback?code=x&state=mal`, {
    redirect: "manual",
    headers: { Cookie: cookie },
  });
  assert.equal(cb.status, 403);
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
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

// --- T-31: API de ejercicios. Usuarios propios para no depender de otros tests. ---
async function usuarioNuevo(email) {
  await logica.registrar(email, "secreta1");
  await logica.activar(email);
  return login(email);
}

test("ejercicios: sin sesión, listar y crear dan 401", async () => {
  assert.equal((await pedir("GET", "/api/ejercicios")).status, 401);
  assert.equal((await pedir("GET", "/api/ejercicios/grupos")).status, 401);
  assert.equal((await pedir("POST", "/api/ejercicios", null, { nombre: "X", grupo: "core" })).status, 401);
});

test("ejercicios: con sesión se listan los base y los grupos", async () => {
  const cookie = await usuarioNuevo("maria@demo.com");
  const res = await pedir("GET", "/api/ejercicios", cookie);
  assert.equal(res.status, 200);
  const lista = await res.json();
  assert.ok(lista.length >= 150);
  assert.ok(lista.every((e) => e.base));
  const grupos = await (await pedir("GET", "/api/ejercicios/grupos", cookie)).json();
  assert.ok(grupos.includes("pecho") && grupos.includes("core"));
});

test("ejercicios: crear uno propio da 201 y solo lo ve su dueño", async () => {
  const maria = await usuarioNuevo("maria2@demo.com");
  const pablo = await usuarioNuevo("pablo@demo.com");
  const res = await pedir("POST", "/api/ejercicios", maria, { nombre: "Press con cadenas", familia: "Press banca", grupo: "pecho" });
  assert.equal(res.status, 201);
  const creado = await res.json();
  assert.equal(creado.base, false);
  assert.equal(creado.familia, "Press banca");
  const deMaria = await (await pedir("GET", "/api/ejercicios", maria)).json();
  const dePablo = await (await pedir("GET", "/api/ejercicios", pablo)).json();
  assert.ok(deMaria.some((e) => e.id === creado.id));
  assert.ok(!dePablo.some((e) => e.id === creado.id));
});

test("ejercicios: el dueño sale de la sesión aunque el cliente mande otro", async () => {
  const maria = await usuarioNuevo("maria3@demo.com");
  const pablo = await usuarioNuevo("pablo2@demo.com");
  const res = await pedir("POST", "/api/ejercicios", maria, { nombre: "Truco", grupo: "core", dueno: "pablo2@demo.com" });
  assert.equal(res.status, 201);
  const dePablo = await (await pedir("GET", "/api/ejercicios", pablo)).json();
  assert.ok(!dePablo.some((e) => e.nombre === "Truco"));
});

test("ejercicios: datos no válidos dan 400 y repetidos 409", async () => {
  const maria = await usuarioNuevo("maria4@demo.com");
  assert.equal((await pedir("POST", "/api/ejercicios", maria, { nombre: "a", grupo: "core" })).status, 400);
  assert.equal((await pedir("POST", "/api/ejercicios", maria, { nombre: "Algo", grupo: "piernas" })).status, 400);
  const repetidoBase = await pedir("POST", "/api/ejercicios", maria, { nombre: "PRESS BANCA CON BARRA", grupo: "pecho" });
  assert.equal(repetidoBase.status, 409);
  assert.match((await repetidoBase.json()).error, /Ya tienes/);
});

// --- T-34: API de rutinas ---
async function idEjercicioApi(cookie, nombre) {
  const lista = await (await pedir("GET", "/api/ejercicios", cookie)).json();
  return lista.find((e) => e.nombre === nombre).id;
}

test("rutinas: sin sesión todas las rutas dan 401", async () => {
  assert.equal((await pedir("GET", "/api/rutinas")).status, 401);
  assert.equal((await pedir("POST", "/api/rutinas", null, { nombre: "X", ejercicios: [] })).status, 401);
  assert.equal((await pedir("GET", "/api/rutinas/aaaaaaaaaaaaaaaaaaaaaaaa")).status, 401);
  assert.equal((await pedir("PUT", "/api/rutinas/aaaaaaaaaaaaaaaaaaaaaaaa", null, {})).status, 401);
  assert.equal((await pedir("DELETE", "/api/rutinas/aaaaaaaaaaaaaaaaaaaaaaaa")).status, 401);
});

test("rutinas: crear (201), listar, ver, editar y borrar", async () => {
  const cookie = await usuarioNuevo("rut1@demo.com");
  const banca = await idEjercicioApi(cookie, "Press banca con barra");
  const creada = await pedir("POST", "/api/rutinas", cookie, {
    nombre: "Pecho lunes",
    ejercicios: [{ ejercicioId: banca, series: 4, repeticiones: { min: 8, max: 12 } }],
  });
  assert.equal(creada.status, 201);
  const rutina = await creada.json();
  assert.equal(rutina.ejercicios[0].nombre, "Press banca con barra");
  assert.equal(rutina.ejercicios[0].descansoSeg, 90);

  const lista = await (await pedir("GET", "/api/rutinas", cookie)).json();
  assert.deepEqual(lista.map((r) => r.nombre), ["Pecho lunes"]);

  const vista = await pedir("GET", `/api/rutinas/${rutina.id}`, cookie);
  assert.equal(vista.status, 200);

  const editada = await pedir("PUT", `/api/rutinas/${rutina.id}`, cookie, {
    nombre: "Pecho viernes",
    ejercicios: [{ ejercicioId: banca, series: 5, repeticiones: 5, descansoSeg: 180 }],
  });
  assert.equal(editada.status, 200);
  assert.equal((await editada.json()).ejercicios[0].repeticiones.min, 5);

  assert.equal((await pedir("DELETE", `/api/rutinas/${rutina.id}`, cookie)).status, 200);
  assert.equal((await pedir("GET", `/api/rutinas/${rutina.id}`, cookie)).status, 404);
});

test("rutinas: la de otro usuario da 404 al verla, editarla o borrarla", async () => {
  const duena = await usuarioNuevo("rut2@demo.com");
  const otro = await usuarioNuevo("rut3@demo.com");
  const banca = await idEjercicioApi(duena, "Press banca con barra");
  const linea = { ejercicioId: banca, series: 3, repeticiones: 10 };
  const rutina = await (await pedir("POST", "/api/rutinas", duena, { nombre: "Privada", ejercicios: [linea] })).json();
  assert.equal((await pedir("GET", `/api/rutinas/${rutina.id}`, otro)).status, 404);
  assert.equal((await pedir("PUT", `/api/rutinas/${rutina.id}`, otro, { nombre: "Mía", ejercicios: [linea] })).status, 404);
  assert.equal((await pedir("DELETE", `/api/rutinas/${rutina.id}`, otro)).status, 404);
  assert.equal((await pedir("GET", "/api/rutinas/id-raro", otro)).status, 404);
  // Sigue igual para su dueña.
  assert.equal((await (await pedir("GET", `/api/rutinas/${rutina.id}`, duena)).json()).nombre, "Privada");
});

test("rutinas: datos no válidos dan 400 y nombre repetido 409", async () => {
  const cookie = await usuarioNuevo("rut4@demo.com");
  const banca = await idEjercicioApi(cookie, "Press banca con barra");
  const linea = { ejercicioId: banca, series: 3, repeticiones: 10 };
  const crear = (cuerpo) => pedir("POST", "/api/rutinas", cookie, cuerpo);
  assert.equal((await crear({ nombre: "x", ejercicios: [linea] })).status, 400);
  assert.equal((await crear({ nombre: "Vacía", ejercicios: [] })).status, 400);
  assert.equal((await crear({ nombre: "Mala", ejercicios: [{ ...linea, repeticiones: { min: 12, max: 8 } }] })).status, 400);
  assert.equal((await crear({ nombre: "Rara", ejercicios: [{ ...linea, ejercicioId: "no-existe" }] })).status, 400);
  assert.equal((await crear({ nombre: "Pierna", ejercicios: [linea] })).status, 201);
  const repetida = await crear({ nombre: "PIERNA", ejercicios: [linea] });
  assert.equal(repetida.status, 409);
  assert.match((await repetida.json()).error, /Ya tienes una rutina/);
});
