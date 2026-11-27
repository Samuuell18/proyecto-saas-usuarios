// Capa de comunicación del cliente (rest.js), sin servidor ni BBDD: se sustituye `fetch` por uno
// de mentira. Lo que se comprueba es el contrato que usan todas las páginas: las funciones api*
// NUNCA lanzan; devuelven { ok: true, datos } o { ok: false, status, error }, también sin red.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  ERROR_SIN_CONEXION,
  apiYo,
  apiHoy,
  apiPerfil,
  apiUsuarios,
  apiEliminar,
  apiLogin,
  apiActualizarSerie,
  apiAnadirSerie,
  apiEliminarSerie,
  apiTerminarEntreno,
  apiDescartarEntreno,
} from "../cliente/comunicacion/rest.js";

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

// Lo que hace el navegador sin cobertura: fetch LANZA (no devuelve un 4xx/5xx).
function sinRed() {
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
}

// Respuesta de mentira con el status y el cuerpo (texto) que se quiera.
function responder(status, cuerpo) {
  const llamadas = [];
  globalThis.fetch = async (url, opciones) => {
    llamadas.push({ url, opciones });
    return new Response(cuerpo, { status, headers: { "Content-Type": "application/json" } });
  };
  return llamadas;
}

const SIN_CONEXION = { ok: false, status: 0, error: ERROR_SIN_CONEXION };

test("rest: sin red, ninguna llamada lanza y todas dan ok false con status 0", async () => {
  sinRed();
  const llamadas = [
    apiYo(),
    apiHoy(),
    apiPerfil(),
    apiUsuarios(),
    apiEliminar("ana@demo.com"),
    apiLogin("ana@demo.com", "secreta1"),
    apiActualizarSerie("s1", { peso: 60, repeticiones: 10, hecha: true }),
    apiAnadirSerie({ despuesDe: "s1" }),
    apiEliminarSerie("s1"),
    apiTerminarEntreno(),
    apiDescartarEntreno(),
  ];
  for (const r of await Promise.all(llamadas)) assert.deepEqual(r, SIN_CONEXION);
});

test("rest: marcar una serie sin red da un error que la página puede enseñar (y deshacer el tic)", async () => {
  sinRed();
  const r = await apiActualizarSerie("s1", { peso: 60, repeticiones: 10, hecha: true });
  assert.equal(r.ok, false);
  assert.equal(typeof r.error, "string");
  assert.ok(r.error.length > 0);
});

test("rest: respuesta correcta, sin cambios: ok true con los datos", async () => {
  const llamadas = responder(200, JSON.stringify({ email: "ana@demo.com", nombre: "Ana" }));
  assert.deepEqual(await apiYo(), { ok: true, datos: { email: "ana@demo.com", nombre: "Ana" } });
  assert.equal(llamadas[0].url, "/api/yo");
});

test("rest: error del servidor con mensaje: se pasa tal cual con su status", async () => {
  responder(401, JSON.stringify({ error: "Sin sesión." }));
  assert.deepEqual(await apiYo(), { ok: false, status: 401, error: "Sin sesión." });
  responder(409, JSON.stringify({ error: "Ya tienes un entreno en curso." }));
  assert.deepEqual(await apiTerminarEntreno(), { ok: false, status: 409, error: "Ya tienes un entreno en curso." });
});

test("rest: error del servidor sin JSON (p. ej. un 502 del proxy): mensaje genérico", async () => {
  responder(502, "<html>Bad Gateway</html>");
  assert.deepEqual(await apiActualizarSerie("s1", { peso: 1, repeticiones: 1, hecha: false }), {
    ok: false,
    status: 502,
    error: "Petición no válida.",
  });
});

test("rest: un 200 con el cuerpo cortado no se da por bueno", async () => {
  responder(200, '{"id":"s1","ser');
  assert.deepEqual(await apiAnadirSerie({ despuesDe: "s1" }), SIN_CONEXION);
});

test("rest: los listados del admin y borrar cuenta mantienen su forma (status y error)", async () => {
  responder(403, JSON.stringify({ error: "Solo para administradores." }));
  assert.deepEqual(await apiUsuarios(), { ok: false, status: 403, error: "Solo para administradores." });
  const llamadas = responder(200, JSON.stringify({ ok: true }));
  assert.deepEqual(await apiEliminar("ana+1@demo.com"), { ok: true, datos: { ok: true } });
  assert.equal(llamadas[0].url, "/api/usuarios/ana%2B1%40demo.com");
  assert.equal(llamadas[0].opciones.method, "DELETE");
});
