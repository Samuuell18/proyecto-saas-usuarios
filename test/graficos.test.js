// T-48: cuentas de las escalas de los gráficos. Funciones puras del cliente, sin DOM ni BBDD.
import { test } from "node:test";
import assert from "node:assert/strict";
import { techoBonito, marcasEje, coordenadaY } from "../cliente/presentacion/graficos.js";

test("techoBonito: el número redondo más pequeño que no se queda corto", () => {
  assert.equal(techoBonito(0), 1); // sin datos
  assert.equal(techoBonito(1), 1);
  assert.equal(techoBonito(3), 3);
  assert.equal(techoBonito(7), 8);
  assert.equal(techoBonito(11), 12);
  assert.equal(techoBonito(132.28), 150);
  assert.equal(techoBonito(800), 800);
  assert.equal(techoBonito(1234), 1500);
  assert.equal(techoBonito(0.4), 0.4);
});

test("marcasEje y coordenadaY: 0 abajo, el techo arriba y la mitad en medio", () => {
  assert.deepEqual(marcasEje(150), [0, 75, 150]);
  const abajo = coordenadaY(0, 150);
  const arriba = coordenadaY(150, 150);
  assert.ok(arriba < abajo); // en SVG la y crece hacia abajo
  assert.equal(coordenadaY(75, 150), (abajo + arriba) / 2);
});
