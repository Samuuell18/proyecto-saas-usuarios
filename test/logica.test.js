import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as datos from "../servidor/datos.js";
import * as logica from "../servidor/logica.js";

beforeEach(() => datos.limpiar());

test("registro deja la cuenta en pendiente", () => {
  const creado = logica.registrar("ana@demo.com", "secreta1");
  assert.equal(creado.estado, "pendiente");
  assert.equal(logica.comprobarActivo("ana@demo.com"), false);
});

test("registro con email duplicado da error", () => {
  logica.registrar("ana@demo.com", "secreta1");
  assert.throws(() => logica.registrar("ana@demo.com", "otra123"), /EMAIL_YA_EXISTE/);
});

test("login con cuenta pendiente se rechaza", () => {
  logica.registrar("ana@demo.com", "secreta1");
  assert.throws(() => logica.iniciarSesion("ana@demo.com", "secreta1"), /CUENTA_PENDIENTE/);
});

test("login ok tras activar", () => {
  logica.registrar("ana@demo.com", "secreta1");
  logica.activar("ana@demo.com");
  const sesion = logica.iniciarSesion("ana@demo.com", "secreta1");
  assert.equal(sesion.email, "ana@demo.com");
});

test("login con password mal da error", () => {
  logica.registrar("ana@demo.com", "secreta1");
  logica.activar("ana@demo.com");
  assert.throws(() => logica.iniciarSesion("ana@demo.com", "mal1234"), /CREDENCIALES_INVALIDAS/);
});

test("login de usuario inexistente da error", () => {
  assert.throws(() => logica.iniciarSesion("nadie@demo.com", "secreta1"), /CREDENCIALES_INVALIDAS/);
});

test("usuario eliminado ya no entra", () => {
  logica.registrar("ana@demo.com", "secreta1");
  logica.activar("ana@demo.com");
  logica.eliminar("ana@demo.com");
  assert.throws(() => logica.iniciarSesion("ana@demo.com", "secreta1"), /CREDENCIALES_INVALIDAS/);
});
