// VARIANTE-6: pruebas de calcularEstado (lógica pura, sin BBDD).
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularEstado } from "../servidor/logica.js";

test("variante6: local sin confirmar queda pendiente y no entra", () => {
  assert.deepEqual(
    calcularEstado({ proveedor: "local", confirmado: false, eliminado: false }),
    { estado: "pendiente", puedeIniciarSesion: false }
  );
});

test("variante6: oauth nace activo y puede entrar", () => {
  assert.deepEqual(
    calcularEstado({ proveedor: "oauth", confirmado: false, eliminado: false }),
    { estado: "activo", puedeIniciarSesion: true }
  );
});

test("variante6: eliminado manda sobre todo lo demás", () => {
  assert.deepEqual(
    calcularEstado({ proveedor: "oauth", confirmado: true, eliminado: true }),
    { estado: "eliminado", puedeIniciarSesion: false }
  );
});

test("variante6: local confirmado queda activo", () => {
  assert.deepEqual(
    calcularEstado({ proveedor: "local", confirmado: true, eliminado: false }),
    { estado: "activo", puedeIniciarSesion: true }
  );
});

test("variante6: rechaza proveedor desconocido", () => {
  assert.throws(
    () => calcularEstado({ proveedor: "saml", confirmado: true, eliminado: false }),
    /PROVEEDOR_DESCONOCIDO/
  );
});

test("variante6: rechaza campos que no son booleanos", () => {
  assert.throws(
    () => calcularEstado({ proveedor: "local", confirmado: "si", eliminado: false }),
    /CAMPOS_NO_BOOLEANOS/
  );
});
