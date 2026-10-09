import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import * as datos from "../servidor/datos.js";
import * as logica from "../servidor/logica.js";
import { cerrar } from "../servidor/bd.js";

// Los tests usan la base fitness_hub_test del mismo cluster (nunca la de verdad).
process.env.MONGO_DB_NAME = "fitness_hub_test";

beforeEach(() => datos.limpiar());
after(async () => {
  await datos.limpiar();
  await cerrar();
});

test("registro deja la cuenta en pendiente", async () => {
  const creado = await logica.registrar("ana@demo.com", "secreta1");
  assert.equal(creado.estado, "pendiente");
  assert.equal(await logica.comprobarActivo("ana@demo.com"), false);
});

test("registro con email duplicado da error", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  await assert.rejects(() => logica.registrar("ana@demo.com", "otra123"), /EMAIL_YA_EXISTE/);
});

test("login con cuenta pendiente se rechaza", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  await assert.rejects(() => logica.iniciarSesion("ana@demo.com", "secreta1"), /CUENTA_PENDIENTE/);
});

test("login ok tras activar", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  await logica.activar("ana@demo.com");
  const sesion = await logica.iniciarSesion("ana@demo.com", "secreta1");
  assert.equal(sesion.email, "ana@demo.com");
});

test("login con password mal da error", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  await logica.activar("ana@demo.com");
  await assert.rejects(() => logica.iniciarSesion("ana@demo.com", "mal1234"), /CREDENCIALES_INVALIDAS/);
});

test("login de usuario inexistente da error", async () => {
  await assert.rejects(() => logica.iniciarSesion("nadie@demo.com", "secreta1"), /CREDENCIALES_INVALIDAS/);
});

test("usuario eliminado ya no entra", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  await logica.activar("ana@demo.com");
  await logica.eliminar("ana@demo.com");
  await assert.rejects(() => logica.iniciarSesion("ana@demo.com", "secreta1"), /CREDENCIALES_INVALIDAS/);
});

test("registro con email sin arroba da error", async () => {
  await assert.rejects(() => logica.registrar("no-es-email", "secreta1"), /EMAIL_INVALIDO/);
});

test("registro con password corta da error", async () => {
  await assert.rejects(() => logica.registrar("ana@demo.com", "123"), /PASSWORD_CORTA/);
});

test("email con mayusculas y espacios se normaliza", async () => {
  await logica.registrar("  Ana@Demo.com ", "secreta1");
  await assert.rejects(() => logica.registrar("ana@demo.com", "otra1234"), /EMAIL_YA_EXISTE/);
  await logica.activar("ANA@demo.com");
  const sesion = await logica.iniciarSesion(" ana@DEMO.com ", "secreta1");
  assert.equal(sesion.email, "ana@demo.com");
});

test("listar muestra email, estado y rol sin exponer el hash", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  const lista = await logica.listar();
  assert.equal(lista.length, 1);
  assert.deepEqual(Object.keys(lista[0]).sort(), ["email", "estado", "rol"]);
});

test("activar un usuario inexistente da error", async () => {
  await assert.rejects(() => logica.activar("nadie@demo.com"), /USUARIO_NO_EXISTE/);
});

test("eliminar un usuario inexistente devuelve false", async () => {
  assert.equal(await logica.eliminar("nadie@demo.com"), false);
});

test("tras eliminar se puede registrar de nuevo ese email", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  await logica.eliminar("ana@demo.com");
  const creado = await logica.registrar("ana@demo.com", "nueva123");
  assert.equal(creado.estado, "pendiente");
});

test("el email de ADMIN_EMAIL nace admin", async () => {
  process.env.ADMIN_EMAIL = "jefa@demo.com";
  const creado = await logica.registrar("jefa@demo.com", "secreta1");
  delete process.env.ADMIN_EMAIL;
  assert.equal(creado.rol, "admin");
});

test("el resto de emails nacen usuario", async () => {
  process.env.ADMIN_EMAIL = "jefa@demo.com";
  const creado = await logica.registrar("ana@demo.com", "secreta1");
  delete process.env.ADMIN_EMAIL;
  assert.equal(creado.rol, "usuario");
});
