// T-40: cuentas del temporizador de descanso. Funciones puras del cliente, sin DOM ni BBDD.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DESCANSO_MAXIMO,
  crearDescanso,
  segundosRestantes,
  sumarSegundos,
  formatearTiempo,
} from "../cliente/presentacion/temporizador.js";

const T0 = 1_000_000; // un "ahora" cualquiera, en milisegundos

test("temporizador: lo que queda se calcula con la hora de fin", () => {
  const d = crearDescanso(90, T0);
  assert.equal(segundosRestantes(d, T0), 90);
  assert.equal(segundosRestantes(d, T0 + 30_000), 60);
  // Aunque el navegador no haya repintado en un buen rato (pantalla bloqueada), sale exacto.
  assert.equal(segundosRestantes(d, T0 + 89_700), 1); // hacia arriba: 0,3 s se ve como 1
  assert.equal(segundosRestantes(d, T0 + 90_000), 0);
  assert.equal(segundosRestantes(d, T0 + 500_000), 0); // nunca negativo
});

test("temporizador: +15 y -15 sobre lo que queda, sin bajar de 0 ni pasar del máximo", () => {
  const d = crearDescanso(90, T0);
  assert.equal(segundosRestantes(sumarSegundos(d, 15, T0 + 10_000), T0 + 10_000), 95);
  assert.equal(segundosRestantes(sumarSegundos(d, -15, T0 + 80_000), T0 + 80_000), 0);
  assert.equal(segundosRestantes(sumarSegundos(crearDescanso(DESCANSO_MAXIMO, T0), 15, T0), T0), DESCANSO_MAXIMO);
  assert.equal(segundosRestantes(crearDescanso(-5, T0), T0), 0);
});

test("temporizador: formato m:ss", () => {
  assert.equal(formatearTiempo(90), "1:30");
  assert.equal(formatearTiempo(5), "0:05");
  assert.equal(formatearTiempo(600), "10:00");
  assert.equal(formatearTiempo(0), "0:00");
  assert.equal(formatearTiempo(-3), "0:00");
});
