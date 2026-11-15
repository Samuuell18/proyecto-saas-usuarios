// T-29: regla "cada recurso es de su dueño". Función pura, sin base de datos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { comprobarAcceso } from "../servidor/logica.js";

const rutinaDeAna = { nombre: "Pierna A", dueno: "ana@demo.com" };
const ejercicioBase = { nombre: "Press banca", dueno: null };

test("propiedad: el dueño puede ver y modificar su recurso", () => {
  assert.equal(comprobarAcceso(rutinaDeAna, "ana@demo.com"), rutinaDeAna);
  assert.equal(comprobarAcceso(rutinaDeAna, "ana@demo.com", { modificar: true }), rutinaDeAna);
});

test("propiedad: un recurso ajeno da el mismo error que uno que no existe", () => {
  assert.throws(() => comprobarAcceso(rutinaDeAna, "luis@demo.com"), /RECURSO_NO_EXISTE/);
  assert.throws(() => comprobarAcceso(rutinaDeAna, "luis@demo.com", { modificar: true }), /RECURSO_NO_EXISTE/);
  assert.throws(() => comprobarAcceso(null, "ana@demo.com"), /RECURSO_NO_EXISTE/);
});

test("propiedad: el admin no tiene excepción con los recursos de otros", () => {
  // La regla solo mira el email: el rol no entra en la decisión.
  assert.throws(() => comprobarAcceso(rutinaDeAna, "jefa@demo.com"), /RECURSO_NO_EXISTE/);
});

test("propiedad: sin email (sin sesión) no se accede a nada privado", () => {
  assert.throws(() => comprobarAcceso(rutinaDeAna, undefined), /RECURSO_NO_EXISTE/);
  assert.throws(() => comprobarAcceso({ nombre: "Raro" }, undefined), /RECURSO_NO_EXISTE/);
});

test("propiedad: un ejercicio base lo ve cualquiera pero nadie lo modifica", () => {
  assert.equal(comprobarAcceso(ejercicioBase, "ana@demo.com"), ejercicioBase);
  assert.throws(() => comprobarAcceso(ejercicioBase, "ana@demo.com", { modificar: true }), /RECURSO_SOLO_LECTURA/);
});
