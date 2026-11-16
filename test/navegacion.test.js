// T-50: qué pestaña del menú inferior se marca en cada página. Función pura del cliente, sin DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pestanaDe } from "../cliente/presentacion/navegacion.js";

test("pestanaDe: cada página marca su pestaña y las páginas hijas, la de su sección", () => {
  assert.equal(pestanaDe("/inicio.html"), "inicio");
  assert.equal(pestanaDe("/rutinas.html"), "rutinas");
  assert.equal(pestanaDe("/ejercicios.html"), "rutinas"); // el catálogo cuelga de Rutinas
  assert.equal(pestanaDe("/entreno.html"), "entrenar");
  assert.equal(pestanaDe("/progreso.html"), "progreso");
  assert.equal(pestanaDe("/historial.html"), "progreso"); // historial está dentro de Progreso
  assert.equal(pestanaDe("/ajustes.html"), "perfil");
  assert.equal(pestanaDe("/"), null); // el acceso no tiene menú
});
