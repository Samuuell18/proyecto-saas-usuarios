// Tests de las restricciones de rol contra la API real (no solo la logica).
// Verifican que el SERVIDOR responde 401/403, no la GUI.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as datos from "../servidor/datos/datos.js";
import * as logica from "../servidor/logica.js";
import { cerrar, getDb } from "../servidor/datos/bd.js";

process.env.MONGO_DB_NAME = "fitness_hub_test_api";
process.env.ADMIN_EMAIL = "jefa@demo.com";
// Sin claves VAPID: los avisos se quedan en el log y nunca se envía uno de verdad, aunque el
// .env tenga claves (dotenv no pisa una variable que ya existe, aunque esté vacía).
process.env.VAPID_PUBLIC_KEY = "";
process.env.VAPID_PRIVATE_KEY = "";
// Sin Brevo: los tests registran cuentas y nunca deben mandar correos de verdad.
process.env.BREVO_API_KEY = "";
// T-72: con una APP_URL https la cookie sería `secure` y no viajaría por el http de los tests.
process.env.APP_URL = "http://localhost:3000";
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
  await logica.registrar("jefa@demo.com", "secreta1", "Jefa");
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
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

test("la cookie de sesion dura 30 dias y se renueva con el uso (T-72)", async () => {
  const res = await pedir("POST", "/api/login", null, { email: "ana@demo.com", password: "secreta1" });
  await res.json();
  const [galleta] = res.headers.getSetCookie();
  // Sin fecha de caducidad sería una cookie "de sesión" y el móvil la borraría al cerrar la app.
  const diasHasta = (c) => (Date.parse(/Expires=([^;]+)/.exec(c ?? "")?.[1]) - Date.now()) / 86_400_000;
  assert.ok(Math.abs(diasHasta(galleta) - 30) < 0.1, galleta);
  assert.match(galleta, /HttpOnly/);
  const cookie = galleta.split(";")[0];
  // rolling: cualquier petición con sesión devuelve la cookie con la caducidad renovada.
  const yo = await pedir("GET", "/api/yo", cookie);
  assert.equal(yo.status, 200);
  assert.ok(Math.abs(diasHasta(yo.headers.getSetCookie()[0]) - 30) < 0.1);
  await pedir("POST", "/api/logout", cookie);
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

test("admin listando ve nombre, email, rol y estado sin hashes", async () => {
  const cookie = await login("jefa@demo.com");
  const res = await pedir("GET", "/api/usuarios", cookie);
  assert.equal(res.status, 200);
  const lista = await res.json();
  assert.equal(lista.length, 2);
  for (const u of lista) {
    assert.deepEqual(Object.keys(u).sort(), ["email", "estado", "nombre", "rol"]);
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
  await logica.registrar("luis@demo.com", "secreta1", "Ana");
  await logica.activar("luis@demo.com");
  const cookie = await login("luis@demo.com");
  const res = await pedir("DELETE", "/api/usuarios/luis@demo.com", cookie);
  assert.equal(res.status, 200);
  assert.equal((await pedir("GET", "/api/yo", cookie)).status, 401);
  const otraVez = await pedir("POST", "/api/login", null, { email: "luis@demo.com", password: "secreta1" });
  assert.equal(otraVez.status, 401);
});

test("si el admin elimina a alguien, su sesion abierta deja de valer", async () => {
  await logica.registrar("eva@demo.com", "secreta1", "Ana");
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
  const r2 = await pedir("POST", "/api/registro", null, { email: "jefa@demo.com", password: "secreta1", nombre: "Jefa" });
  assert.equal(r2.status, 409);
});

// T-60: nombre obligatorio al registrarse; /api/yo lo devuelve y se puede cambiar.
test("registro sin nombre da 400; /api/yo da el nombre y PUT /api/yo/nombre lo cambia", async () => {
  const sinNombre = await pedir("POST", "/api/registro", null, { email: "nuevo@demo.com", password: "secreta1" });
  assert.equal(sinNombre.status, 400);
  assert.match((await sinNombre.json()).error, /nombre/);

  await logica.registrar("nombre@demo.com", "secreta1", "Ana");
  await logica.activar("nombre@demo.com");
  const cookie = await login("nombre@demo.com");
  assert.equal((await (await pedir("GET", "/api/yo", cookie)).json()).nombre, "Ana");
  const mal = await pedir("PUT", "/api/yo/nombre", cookie, { nombre: "A" });
  assert.equal(mal.status, 400);
  const bien = await pedir("PUT", "/api/yo/nombre", cookie, { nombre: "  Ana   María " });
  assert.equal(bien.status, 200);
  assert.deepEqual(await bien.json(), { nombre: "Ana María" });
  assert.equal((await (await pedir("GET", "/api/yo", cookie)).json()).nombre, "Ana María");
  assert.equal((await pedir("PUT", "/api/yo/nombre", null, { nombre: "Otra" })).status, 401);
  // El nombre de una rutina tiene su propio error y su propio mensaje (no el del usuario).
  const rutinaMal = await pedir("POST", "/api/rutinas", cookie, { nombre: "x", ejercicios: [] });
  assert.equal(rutinaMal.status, 400);
  assert.match((await rutinaMal.json()).error, /entre 2 y 60/);
});

test("oauth callback sin codigo da 400 (con config de mentira)", async () => {
  process.env.GOOGLE_CLIENT_ID = "id-mentira";
  process.env.GOOGLE_CLIENT_SECRET = "secreto-mentira";
  process.env.APP_URL = "http://localhost:3000";
  const res = await fetch(`${base}/api/oauth/google/callback`, { redirect: "manual" });
  assert.equal(res.status, 400);
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
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

// T-86: GitHub se quitó; ahora es un proveedor desconocido más.
test("oauth con GitHub ya no existe: 404", async () => {
  assert.equal((await pedir("GET", "/api/oauth/github")).status, 404);
  assert.equal((await pedir("GET", "/api/oauth/github/callback?code=x&state=y")).status, 404);
});

// --- T-31: API de ejercicios. Usuarios propios para no depender de otros tests. ---
async function usuarioNuevo(email) {
  await logica.registrar(email, "secreta1", "Ana");
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

// --- T-37: entrenos ---

test("entrenos: sin sesión todas las rutas dan 401", async () => {
  assert.equal((await pedir("GET", "/api/entrenos/actual")).status, 401);
  assert.equal((await pedir("POST", "/api/entrenos", null, {})).status, 401);
  assert.equal((await pedir("POST", "/api/entrenos/actual/series", null, {})).status, 401);
  assert.equal((await pedir("PUT", "/api/entrenos/actual/series/x", null, {})).status, 401);
  assert.equal((await pedir("DELETE", "/api/entrenos/actual/series/x")).status, 401);
  assert.equal((await pedir("POST", "/api/entrenos/actual/terminar")).status, 401);
  assert.equal((await pedir("DELETE", "/api/entrenos/actual")).status, 401);
});

test("entrenos: desde rutina, apuntar series y terminar", async () => {
  const cookie = await usuarioNuevo("ent1@demo.com");
  assert.equal(await (await pedir("GET", "/api/entrenos/actual", cookie)).json(), null);
  const banca = await idEjercicioApi(cookie, "Press banca con barra");
  const rutina = await (
    await pedir("POST", "/api/rutinas", cookie, {
      nombre: "Pecho",
      ejercicios: [{ ejercicioId: banca, series: 2, repeticiones: { min: 8, max: 12 } }],
    })
  ).json();

  const inicio = await pedir("POST", "/api/entrenos", cookie, { rutinaId: rutina.id });
  assert.equal(inicio.status, 201);
  const entreno = await inicio.json();
  assert.equal(entreno.series.length, 2);
  assert.ok(!("dueno" in entreno));
  // Empezar otro con uno en curso: 409.
  assert.equal((await pedir("POST", "/api/entrenos", cookie, {})).status, 409);

  const [s1, s2] = entreno.series;
  const apuntada = await pedir("PUT", `/api/entrenos/actual/series/${s1.id}`, cookie, { peso: 60, repeticiones: 10, hecha: true });
  assert.equal(apuntada.status, 200);
  assert.equal((await apuntada.json()).series[0].hecha, true);
  const otra = await pedir("POST", "/api/entrenos/actual/series", cookie, { despuesDe: s1.id });
  assert.equal(otra.status, 201);
  assert.equal((await otra.json()).series.length, 3);
  assert.equal((await pedir("DELETE", `/api/entrenos/actual/series/${s2.id}`, cookie)).status, 200);

  // Al recargar se recupera tal cual (T-39).
  const actual = await (await pedir("GET", "/api/entrenos/actual", cookie)).json();
  assert.equal(actual.id, entreno.id);
  assert.equal(actual.series.length, 2);

  const terminado = await pedir("POST", "/api/entrenos/actual/terminar", cookie);
  assert.equal(terminado.status, 200);
  assert.equal((await terminado.json()).series.length, 1); // solo la hecha
  assert.equal(await (await pedir("GET", "/api/entrenos/actual", cookie)).json(), null);
});

test("entrenos: errores (400, 404) y descartar", async () => {
  const cookie = await usuarioNuevo("ent2@demo.com");
  const otro = await usuarioNuevo("ent3@demo.com");
  assert.equal((await pedir("POST", "/api/entrenos/actual/terminar", cookie)).status, 404);
  assert.equal((await pedir("DELETE", "/api/entrenos/actual", cookie)).status, 404);
  assert.equal((await pedir("POST", "/api/entrenos", cookie, { rutinaId: "id-raro" })).status, 404);

  // La rutina de otro usuario: 404, como si no existiera.
  const banca = await idEjercicioApi(otro, "Press banca con barra");
  const ajena = await (
    await pedir("POST", "/api/rutinas", otro, { nombre: "Ajena", ejercicios: [{ ejercicioId: banca, series: 1, repeticiones: 5 }] })
  ).json();
  assert.equal((await pedir("POST", "/api/entrenos", cookie, { rutinaId: ajena.id })).status, 404);

  assert.equal((await pedir("POST", "/api/entrenos", cookie)).status, 201); // libre
  assert.equal((await pedir("POST", "/api/entrenos/actual/series", cookie, { ejercicioId: "no-existe" })).status, 400);
  const conSerie = await (await pedir("POST", "/api/entrenos/actual/series", cookie, { ejercicioId: banca })).json();
  const serie = conSerie.series[0].id;
  const mala = await pedir("PUT", `/api/entrenos/actual/series/${serie}`, cookie, { peso: -5, repeticiones: 8 });
  assert.equal(mala.status, 400);
  assert.match((await mala.json()).error, /Revisa la serie/);
  assert.equal((await pedir("PUT", "/api/entrenos/actual/series/no-existe", cookie, {})).status, 404);
  // Sin series hechas no se puede terminar; descartar sí.
  assert.equal((await pedir("POST", "/api/entrenos/actual/terminar", cookie)).status, 400);
  assert.equal((await pedir("DELETE", "/api/entrenos/actual", cookie)).status, 200);
  assert.equal(await (await pedir("GET", "/api/entrenos/actual", cookie)).json(), null);
});

// T-43: ajustes. La unidad es del usuario de la sesión y cambia cómo se ven los pesos del entreno.
test("ajustes: unidad de peso en /api/yo, cambiarla (200, 400, 401) y entreno en lb", async () => {
  const cookie = await usuarioNuevo("kglb@demo.com");
  assert.equal((await (await pedir("GET", "/api/yo", cookie)).json()).unidadPeso, "kg");
  assert.equal((await pedir("PUT", "/api/yo/unidad", null, { unidad: "lb" })).status, 401);
  const mala = await pedir("PUT", "/api/yo/unidad", cookie, { unidad: "stone" });
  assert.equal(mala.status, 400);
  assert.match((await mala.json()).error, /kg o lb/);

  const cambio = await pedir("PUT", "/api/yo/unidad", cookie, { unidad: "lb" });
  assert.equal(cambio.status, 200);
  assert.deepEqual(await cambio.json(), { unidadPeso: "lb" });
  assert.equal((await (await pedir("GET", "/api/yo", cookie)).json()).unidadPeso, "lb");

  await pedir("POST", "/api/entrenos", cookie);
  const banca = await idEjercicioApi(cookie, "Press banca con barra");
  const conSerie = await (await pedir("POST", "/api/entrenos/actual/series", cookie, { ejercicioId: banca })).json();
  const apuntada = await pedir("PUT", `/api/entrenos/actual/series/${conSerie.series[0].id}`, cookie, { peso: 225, repeticiones: 5 });
  const entreno = await apuntada.json();
  assert.equal(entreno.unidad, "lb");
  assert.equal(entreno.series[0].peso, 225);
  assert.equal((await pedir("DELETE", "/api/entrenos/actual", cookie)).status, 200);
});

// T-44: historial. "actual" no se confunde con un id porque sus rutas van antes.
test("historial: listar, ver y borrar entrenos terminados (200, 401, 404)", async () => {
  const cookie = await usuarioNuevo("hist1@demo.com");
  const otro = await usuarioNuevo("hist2@demo.com");
  assert.equal((await pedir("GET", "/api/entrenos", null)).status, 401);
  assert.deepEqual(await (await pedir("GET", "/api/entrenos", cookie)).json(), []);

  await pedir("POST", "/api/entrenos", cookie);
  const banca = await idEjercicioApi(cookie, "Press banca con barra");
  const conSerie = await (await pedir("POST", "/api/entrenos/actual/series", cookie, { ejercicioId: banca })).json();
  await pedir("PUT", `/api/entrenos/actual/series/${conSerie.series[0].id}`, cookie, { peso: 80, repeticiones: 5, hecha: true });
  const terminado = await (await pedir("POST", "/api/entrenos/actual/terminar", cookie)).json();
  assert.equal(await (await pedir("GET", "/api/entrenos/actual", cookie)).json(), null);

  const lista = await (await pedir("GET", "/api/entrenos", cookie)).json();
  assert.deepEqual(lista.map((e) => [e.id, e.nombre, e.numSeries]), [[terminado.id, "Entreno libre", 1]]);
  const detalle = await pedir("GET", `/api/entrenos/${terminado.id}`, cookie);
  assert.equal(detalle.status, 200);
  assert.equal((await detalle.json()).series[0].peso, 80);

  // De otro usuario o inexistente: 404, también al borrar.
  assert.equal((await pedir("GET", `/api/entrenos/${terminado.id}`, otro)).status, 404);
  assert.equal((await pedir("DELETE", `/api/entrenos/${terminado.id}`, otro)).status, 404);
  assert.equal((await pedir("GET", "/api/entrenos/no-existe", cookie)).status, 404);

  assert.equal((await pedir("DELETE", `/api/entrenos/${terminado.id}`, cookie)).status, 200);
  assert.deepEqual(await (await pedir("GET", "/api/entrenos", cookie)).json(), []);
});

// T-47: métricas. Siempre del usuario de la sesión.
test("métricas: resumen y progreso de un ejercicio (200, 401, 404)", async () => {
  const cookie = await usuarioNuevo("metr1@demo.com");
  const otro = await usuarioNuevo("metr2@demo.com");
  assert.equal((await pedir("GET", "/api/metricas", null)).status, 401);
  assert.equal((await pedir("GET", "/api/metricas/ejercicios/x", null)).status, 401);

  const vacias = await (await pedir("GET", "/api/metricas", cookie)).json();
  assert.equal(vacias.semanas.length, 8);
  assert.ok(vacias.semanas.every((s) => s.entrenos === 0));
  assert.deepEqual(vacias.records, []);

  await pedir("POST", "/api/entrenos", cookie);
  const banca = await idEjercicioApi(cookie, "Press banca con barra");
  const conSerie = await (await pedir("POST", "/api/entrenos/actual/series", cookie, { ejercicioId: banca })).json();
  await pedir("PUT", `/api/entrenos/actual/series/${conSerie.series[0].id}`, cookie, { peso: 70, repeticiones: 6, hecha: true });
  await pedir("POST", "/api/entrenos/actual/terminar", cookie);

  const metricas = await (await pedir("GET", "/api/metricas", cookie)).json();
  assert.equal(metricas.semanas.at(-1).entrenos, 1);
  assert.equal(metricas.semanas.at(-1).volumen, 420);
  assert.deepEqual(metricas.records.map((r) => [r.nombre, r.record.peso]), [["Press banca con barra", 70]]);

  const progreso = await pedir("GET", `/api/metricas/ejercicios/${banca}`, cookie);
  assert.equal(progreso.status, 200);
  assert.equal((await progreso.json()).puntos.length, 1);
  // El otro usuario nunca lo ha hecho: para él no hay progreso (404).
  assert.equal((await pedir("GET", `/api/metricas/ejercicios/${banca}`, otro)).status, 404);
});

// T-61: pantalla "Hoy" del inicio. Siempre del usuario de la sesión.
test("hoy: sin nada, con una rutina, con un entreno en curso y tras terminarlo (200, 401)", async () => {
  const cookie = await usuarioNuevo("hoy1@demo.com");
  assert.equal((await pedir("GET", "/api/hoy", null)).status, 401);

  const vacio = await (await pedir("GET", "/api/hoy", cookie)).json();
  assert.deepEqual(vacio, {
    unidad: "kg",
    enCurso: null,
    sugerida: null,
    numRutinas: 0,
    estaSemana: 0,
    racha: 0,
    ultimoRecord: null,
  });

  const banca = await idEjercicioApi(cookie, "Press banca con barra");
  const rutina = await (
    await pedir("POST", "/api/rutinas", cookie, {
      nombre: "Pecho",
      ejercicios: [{ ejercicioId: banca, series: 2, repeticiones: "8" }],
    })
  ).json();
  const conRutina = await (await pedir("GET", "/api/hoy", cookie)).json();
  assert.deepEqual(conRutina.sugerida, { id: rutina.id, nombre: "Pecho", ultimaVez: null });

  const entreno = await (await pedir("POST", "/api/entrenos", cookie, { rutinaId: rutina.id })).json();
  await pedir("PUT", `/api/entrenos/actual/series/${entreno.series[0].id}`, cookie, { peso: 60, repeticiones: 8, hecha: true });
  const enCurso = await (await pedir("GET", "/api/hoy", cookie)).json();
  assert.deepEqual(enCurso.enCurso, { rutinaNombre: "Pecho", hechas: 1, total: 2 });

  await pedir("POST", "/api/entrenos/actual/terminar", cookie);
  const despues = await (await pedir("GET", "/api/hoy", cookie)).json();
  assert.equal(despues.enCurso, null);
  assert.equal(despues.estaSemana, 1);
  assert.equal(despues.racha, 1);
  assert.equal(despues.sugerida.id, rutina.id); // es la única
  assert.ok(despues.sugerida.ultimaVez);
  assert.deepEqual(
    [despues.ultimoRecord.nombre, despues.ultimoRecord.peso, despues.ultimoRecord.repeticiones],
    ["Press banca con barra", 60, 8]
  );
});

// T-55: notificaciones push. Siempre del usuario de la sesión.
const suscripcionDePrueba = (n = 1) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/prueba-${n}`,
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
});

test("avisos: clave, guardar, probar y quitar la suscripción (201, 200, 400, 401, 409)", async () => {
  const cookie = await usuarioNuevo("avisos1@demo.com");
  assert.equal((await pedir("GET", "/api/avisos/clave", null)).status, 401);
  assert.equal((await pedir("POST", "/api/avisos/suscripcion", null, { suscripcion: suscripcionDePrueba() })).status, 401);
  assert.deepEqual(await (await pedir("GET", "/api/avisos/clave", cookie)).json(), { clave: null });

  assert.equal((await pedir("POST", "/api/avisos/prueba", cookie)).status, 409); // aún sin móviles
  const mala = await pedir("POST", "/api/avisos/suscripcion", cookie, { suscripcion: { endpoint: "http://x" } });
  assert.equal(mala.status, 400);
  assert.equal((await pedir("POST", "/api/avisos/suscripcion", cookie, { suscripcion: suscripcionDePrueba() })).status, 201);
  assert.deepEqual(await (await pedir("POST", "/api/avisos/prueba", cookie)).json(), { enviados: 1 });

  assert.equal((await pedir("DELETE", "/api/avisos/suscripcion", cookie, { endpoint: suscripcionDePrueba().endpoint })).status, 200);
  assert.equal((await pedir("POST", "/api/avisos/prueba", cookie)).status, 409);
});

// T-56: programar y cancelar el aviso del descanso.
test("aviso de descanso: programar (200), fecha no válida (400), cancelar y sin sesión (401)", async () => {
  const cookie = await usuarioNuevo("descanso1@demo.com");
  const fin = new Date(Date.now() + 90_000).toISOString();
  assert.equal((await pedir("PUT", "/api/avisos/descanso", null, { fin })).status, 401);
  assert.equal((await pedir("DELETE", "/api/avisos/descanso", null)).status, 401);

  const programado = await pedir("PUT", "/api/avisos/descanso", cookie, { fin });
  assert.equal(programado.status, 200);
  assert.equal(new Date((await programado.json()).fin).toISOString(), fin);
  assert.equal(logica.hayAvisoDescanso("descanso1@demo.com"), true);

  const pasado = await pedir("PUT", "/api/avisos/descanso", cookie, { fin: new Date(Date.now() - 1000).toISOString() });
  assert.equal(pasado.status, 400);
  assert.equal((await pedir("PUT", "/api/avisos/descanso", cookie, {})).status, 400);

  assert.equal((await pedir("DELETE", "/api/avisos/descanso", cookie)).status, 200);
  assert.equal(logica.hayAvisoDescanso("descanso1@demo.com"), false);
});

// T-77 (A07-002): al décimo fallo seguido con el mismo email, el login responde 429 aunque la
// contraseña sea buena; otro email desde la misma IP sigue pudiendo entrar.
test("login: tras 10 fallos con un email da 429, sin bloquear a los demás", async () => {
  await logica.registrar("fuerza@demo.com", "secreta1", "Fuerza");
  await logica.activar("fuerza@demo.com");
  for (let i = 0; i < 10; i++) {
    const fallo = await pedir("POST", "/api/login", null, { email: "fuerza@demo.com", password: `mala${i}xx` });
    assert.equal(fallo.status, 401);
  }
  const bloqueado = await pedir("POST", "/api/login", null, { email: "fuerza@demo.com", password: "secreta1" });
  assert.equal(bloqueado.status, 429);
  assert.match((await bloqueado.json()).error, /Demasiados intentos/);
  assert.ok(bloqueado.headers.get("ratelimit"), "dice cuándo se puede volver a probar");
  await logica.registrar("vecina@demo.com", "secreta1", "Vecina");
  await logica.activar("vecina@demo.com");
  await login("vecina@demo.com"); // otra cuenta, misma IP: entra
});

// T-79 (A06-002): cabeceras de seguridad en páginas y API; Express no se anuncia.
test("cabeceras de seguridad: CSP sin marcos ajenos, nosniff y sin X-Powered-By", async () => {
  for (const ruta of ["/", "/inicio.html", "/api/yo"]) {
    const res = await pedir("GET", ruta);
    const csp = res.headers.get("content-security-policy") ?? "";
    assert.match(csp, /frame-ancestors 'none'/, ruta);
    assert.match(csp, /script-src 'self'/, ruta);
    assert.equal(res.headers.get("x-frame-options"), "DENY", ruta);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff", ruta);
    assert.equal(res.headers.get("x-powered-by"), null, ruta);
  }
});

// T-80 (A10-001): un error que ninguna ruta controla responde JSON corto, sin la traza del servidor.
test("errores inesperados: JSON mal escrito da 400 en JSON y sin traza", async () => {
  const res = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ esto no es json",
  });
  assert.equal(res.status, 400);
  assert.match(res.headers.get("content-type"), /application\/json/);
  const cuerpo = await res.text();
  assert.doesNotMatch(cuerpo, /at |node_modules|SyntaxError/);
  assert.equal(JSON.parse(cuerpo).error, "Petición no válida.");
});

// T-81 (A07-003): iniciar sesión da un identificador de sesión NUEVO; el que traía el navegador deja de valer.
test("login cambia el identificador de sesión y el anterior ya no sirve", async () => {
  await logica.registrar("fija@demo.com", "secreta1", "Fija");
  await logica.activar("fija@demo.com");
  const antes = await login("fija@demo.com");
  const res = await pedir("POST", "/api/login", antes, { email: "fija@demo.com", password: "secreta1" });
  assert.equal(res.status, 200);
  await res.json();
  const despues = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  assert.ok(despues, "manda una cookie nueva");
  assert.notEqual(despues, antes);
  assert.equal((await pedir("GET", "/api/yo", antes)).status, 401);
  assert.equal((await pedir("GET", "/api/yo", despues)).status, 200);
});

// T-67: con REDIRIGIR_A (solo en el servicio viejo de Render) todo salta a la misma ruta en la URL nueva.
test("REDIRIGIR_A: cualquier ruta salta a la URL nueva con 308", async () => {
  process.env.REDIRIGIR_A = "https://forja.onrender.com/";
  try {
    for (const ruta of ["/", "/inicio.html", "/api/confirmar?token=abc"]) {
      const res = await fetch(`${base}${ruta}`, { redirect: "manual" });
      assert.equal(res.status, 308, ruta);
      assert.equal(res.headers.get("location"), `https://forja.onrender.com${ruta}`, ruta);
    }
  } finally {
    delete process.env.REDIRIGIR_A;
  }
  assert.equal((await pedir("GET", "/")).status, 200); // sin la variable, normal
});

// T-87: PUT /api/yo/objetivo y GET /api/yo con el objetivo semanal.
test("objetivo semanal por la API: 401 sin sesión, 400 fuera de rango, se ve en /api/yo", async () => {
  assert.equal((await pedir("PUT", "/api/yo/objetivo", null, { objetivo: 3 })).status, 401);
  await logica.registrar("objetivo@demo.com", "secreta1", "Obje");
  await logica.activar("objetivo@demo.com");
  const cookie = await login("objetivo@demo.com");
  assert.equal((await (await pedir("GET", "/api/yo", cookie)).json()).objetivoSemanal, null);
  assert.equal((await pedir("PUT", "/api/yo/objetivo", cookie, { objetivo: 9 })).status, 400);
  const ok = await pedir("PUT", "/api/yo/objetivo", cookie, { objetivo: 3 });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).objetivoSemanal, 3);
  assert.equal((await (await pedir("GET", "/api/yo", cookie)).json()).objetivoSemanal, 3);
});

// T-88: GET /api/perfil.
test("perfil por la API: 401 sin sesión; con sesión, sus datos y cifras", async () => {
  assert.equal((await pedir("GET", "/api/perfil")).status, 401);
  await logica.registrar("perfil@demo.com", "secreta1", "Perfil");
  await logica.activar("perfil@demo.com");
  const cookie = await login("perfil@demo.com");
  const res = await pedir("GET", "/api/perfil", cookie);
  assert.equal(res.status, 200);
  const perfil = await res.json();
  assert.equal(perfil.email, "perfil@demo.com");
  assert.equal(perfil.acceso, "email");
  assert.equal(perfil.entrenos, 0);
  assert.equal(perfil.hash, undefined, "nunca sale el hash");
  assert.ok(perfil.desde);
});

// T-89: PUT /api/yo/password.
test("cambiar contraseña por la API: 401 sin sesión, 400 si la actual es mala, 200 y entra con la nueva", async () => {
  assert.equal((await pedir("PUT", "/api/yo/password", null, { actual: "x", nueva: "y" })).status, 401);
  await logica.registrar("clave@demo.com", "secreta1", "Clave");
  await logica.activar("clave@demo.com");
  const cookie = await login("clave@demo.com");
  const mala = await pedir("PUT", "/api/yo/password", cookie, { actual: "mala1234", nueva: "nueva1234" });
  assert.equal(mala.status, 400);
  assert.match((await mala.json()).error, /actual no es correcta/);
  assert.equal((await pedir("PUT", "/api/yo/password", cookie, { actual: "secreta1", nueva: "nueva1234" })).status, 200);
  const entra = await pedir("POST", "/api/login", null, { email: "clave@demo.com", password: "nueva1234" });
  assert.equal(entra.status, 200);
});

// T-90: las rutas de recuperar siempre responden igual al pedir y rechazan un enlace falso.
test("recuperar por la API: misma respuesta exista o no la cuenta; enlace falso da 404", async () => {
  const con = await pedir("POST", "/api/recuperar", null, { email: "jefa@demo.com" });
  const sin = await pedir("POST", "/api/recuperar", null, { email: "no-existe@demo.com" });
  assert.equal(con.status, 200);
  assert.equal(sin.status, 200);
  assert.deepEqual(await con.json(), await sin.json());
  const falso = await pedir("POST", "/api/recuperar/nueva", null, { token: "falso", nueva: "nueva1234" });
  assert.equal(falso.status, 404);
  assert.match((await falso.json()).error, /no es válido/);
});

// T-91: GET /api/yo/datos se descarga como archivo .json.
test("descargar mis datos: 401 sin sesión; con sesión, un archivo JSON con tu cuenta", async () => {
  assert.equal((await pedir("GET", "/api/yo/datos")).status, 401);
  await logica.registrar("datos@demo.com", "secreta1", "Datos");
  await logica.activar("datos@demo.com");
  const cookie = await login("datos@demo.com");
  const res = await pedir("GET", "/api/yo/datos", cookie);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-disposition"), /attachment; filename="forja-mis-datos-\d{4}-\d{2}-\d{2}\.json"/);
  const cuerpo = await res.json();
  assert.equal(cuerpo.cuenta.email, "datos@demo.com");
});
