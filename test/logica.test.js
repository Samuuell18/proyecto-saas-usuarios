import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import * as datos from "../servidor/datos/datos.js";
import * as logica from "../servidor/logica.js";
import { cerrar } from "../servidor/datos/bd.js";

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

test("eliminar es logico: la cuenta queda como eliminada y no activa", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  await logica.activar("ana@demo.com");
  assert.equal(await logica.eliminar("ana@demo.com"), true);
  const [ana] = await logica.listar();
  assert.equal(ana.estado, "eliminado");
  assert.equal(await logica.comprobarActivo("ana@demo.com"), false);
});

test("eliminar dos veces la misma cuenta devuelve false", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  await logica.eliminar("ana@demo.com");
  assert.equal(await logica.eliminar("ana@demo.com"), false);
});

test("tras eliminar no se puede registrar de nuevo ese email", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  await logica.eliminar("ana@demo.com");
  await assert.rejects(() => logica.registrar("ana@demo.com", "nueva123"), /EMAIL_YA_EXISTE/);
});

test("un enlace de confirmacion antiguo no reactiva una cuenta eliminada", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  const [token] = await datos.tokensDe("ana@demo.com");
  await logica.eliminar("ana@demo.com");
  await assert.rejects(() => logica.confirmar(token), /USUARIO_NO_EXISTE/);
  assert.equal(await logica.comprobarActivo("ana@demo.com"), false);
});

test("confirmar con token válido activa la cuenta", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  const tokens = await datos.tokensDe("ana@demo.com");
  assert.equal(tokens.length, 1);
  const cuenta = await logica.confirmar(tokens[0]);
  assert.equal(cuenta.estado, "activo");
  assert.equal(await logica.comprobarActivo("ana@demo.com"), true);
});

test("confirmar con token inexistente da error", async () => {
  await assert.rejects(() => logica.confirmar("token-que-no-existe"), /TOKEN_INVALIDO/);
});

test("el token es de un solo uso", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  const tokens = await datos.tokensDe("ana@demo.com");
  await logica.confirmar(tokens[0]);
  await assert.rejects(() => logica.confirmar(tokens[0]), /TOKEN_INVALIDO/);
});

// T-25: caducidad de los enlaces de confirmación (24 h).
const HORA = 60 * 60 * 1000;

test("tokenCaducado: dentro de las 24 h no caduca y pasadas sí", () => {
  const creado = new Date("2026-11-09T10:00:00Z");
  assert.equal(logica.tokenCaducado(creado, new Date(creado.getTime() + 23 * HORA)), false);
  assert.equal(logica.tokenCaducado(creado, new Date(creado.getTime() + 24 * HORA)), false);
  assert.equal(logica.tokenCaducado(creado, new Date(creado.getTime() + 25 * HORA)), true);
});

test("confirmar con token caducado da error y la cuenta sigue pendiente", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  const [token] = await datos.tokensDe("ana@demo.com");
  const dentroDe25h = new Date(Date.now() + 25 * HORA);
  await assert.rejects(() => logica.confirmar(token, dentroDe25h), /TOKEN_CADUCADO/);
  assert.equal(await logica.comprobarActivo("ana@demo.com"), false);
});

// T-26: reenviar el enlace.
test("reenviar a una cuenta pendiente cambia el token y el viejo deja de valer", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  const [viejo] = await datos.tokensDe("ana@demo.com");
  assert.equal(await logica.reenviarConfirmacion(" Ana@demo.com "), true);
  const tokens = await datos.tokensDe("ana@demo.com");
  assert.equal(tokens.length, 1);
  assert.notEqual(tokens[0], viejo);
  await assert.rejects(() => logica.confirmar(viejo), /TOKEN_INVALIDO/);
  const cuenta = await logica.confirmar(tokens[0]);
  assert.equal(cuenta.estado, "activo");
});

test("reenviar no hace nada si la cuenta no existe, ya está activa o eliminada", async () => {
  assert.equal(await logica.reenviarConfirmacion("nadie@demo.com"), false);
  await logica.registrar("ana@demo.com", "secreta1");
  await logica.activar("ana@demo.com");
  assert.equal(await logica.reenviarConfirmacion("ana@demo.com"), false);
  await logica.eliminar("ana@demo.com");
  assert.equal(await logica.reenviarConfirmacion("ana@demo.com"), false);
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

test("oauth crea la cuenta ya activa, sin pasar por activar", async () => {
  const creado = await logica.oauthLogin("git@demo.com");
  assert.equal(creado.estado, "activo");
  assert.equal(await logica.comprobarActivo("git@demo.com"), true);
});

test("oauth repetido no duplica la cuenta", async () => {
  await logica.oauthLogin("git@demo.com");
  await logica.oauthLogin("git@demo.com");
  assert.equal((await logica.listar()).length, 1);
});

test("oauth sobre pendiente la activa", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  const u = await logica.oauthLogin("ana@demo.com");
  assert.equal(u.estado, "activo");
});

test("oauth no deja volver a entrar a una cuenta eliminada", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  await logica.activar("ana@demo.com");
  await logica.eliminar("ana@demo.com");
  await assert.rejects(() => logica.oauthLogin("ana@demo.com"), /CREDENCIALES_INVALIDAS/);
  assert.equal(await logica.comprobarActivo("ana@demo.com"), false);
});

// T-30: catálogo de ejercicios.
test("listar ejercicios: un usuario nuevo ya tiene todos los base, marcados como base", async () => {
  await logica.prepararCatalogo();
  const lista = await logica.listarEjercicios("ana@demo.com");
  assert.ok(lista.length >= 150);
  assert.ok(lista.every((e) => e.base === true));
  assert.ok(lista.some((e) => e.nombre === "Press banca con mancuernas" && e.familia === "Press banca"));
  assert.ok(!("dueno" in lista[0]));
});

test("crear ejercicio propio: limpia el nombre, usa el nombre como familia y aparece en mi lista", async () => {
  const creado = await logica.crearEjercicio("ana@demo.com", { nombre: "  Press   raro ", grupo: "pecho" });
  assert.deepEqual(
    { nombre: creado.nombre, familia: creado.familia, grupo: creado.grupo, base: creado.base },
    { nombre: "Press raro", familia: "Press raro", grupo: "pecho", base: false }
  );
  const mios = await logica.listarEjercicios("ana@demo.com");
  assert.ok(mios.some((e) => e.id === creado.id));
  const deLuis = await logica.listarEjercicios("luis@demo.com");
  assert.ok(!deLuis.some((e) => e.id === creado.id));
});

test("crear ejercicio propio como variante de una familia base", async () => {
  const creado = await logica.crearEjercicio("ana@demo.com", {
    nombre: "Press banca con cadenas", familia: "Press banca", grupo: "pecho",
  });
  assert.equal(creado.familia, "Press banca");
});

test("crear ejercicio: nombre o grupo no válidos dan error", async () => {
  await assert.rejects(() => logica.crearEjercicio("ana@demo.com", { nombre: " a ", grupo: "pecho" }), /NOMBRE_INVALIDO/);
  await assert.rejects(() => logica.crearEjercicio("ana@demo.com", { nombre: "x".repeat(61), grupo: "pecho" }), /NOMBRE_INVALIDO/);
  await assert.rejects(() => logica.crearEjercicio("ana@demo.com", { nombre: "Algo", grupo: "piernas" }), /GRUPO_INVALIDO/);
  await assert.rejects(() => logica.crearEjercicio("ana@demo.com", { nombre: "Algo" }), /GRUPO_INVALIDO/);
});

test("crear ejercicio: no se puede repetir uno propio ni uno base (sin distinguir mayúsculas)", async () => {
  await logica.prepararCatalogo();
  await logica.crearEjercicio("ana@demo.com", { nombre: "Press raro", grupo: "pecho" });
  await assert.rejects(() => logica.crearEjercicio("ana@demo.com", { nombre: "PRESS RARO", grupo: "pecho" }), /EJERCICIO_YA_EXISTE/);
  await assert.rejects(() => logica.crearEjercicio("ana@demo.com", { nombre: "press banca con barra", grupo: "pecho" }), /EJERCICIO_YA_EXISTE/);
  // Otro usuario sí puede tener su propio "Press raro".
  const deLuis = await logica.crearEjercicio("luis@demo.com", { nombre: "Press raro", grupo: "pecho" });
  assert.equal(deLuis.base, false);
});

// T-33: rutinas.
async function idEjercicio(nombre) {
  const lista = await logica.listarEjercicios("ana@demo.com");
  return lista.find((e) => e.nombre === nombre).id;
}

test("línea de rutina: repeticiones fijas o rango y descanso por defecto", () => {
  assert.deepEqual(logica.normalizarLineaRutina({ ejercicioId: "x", series: "4", repeticiones: 10 }), {
    ejercicioId: "x", series: 4, repeticiones: { min: 10, max: 10 }, descansoSeg: logica.DESCANSO_POR_DEFECTO,
  });
  assert.deepEqual(
    logica.normalizarLineaRutina({ ejercicioId: "x", series: 3, repeticiones: { min: 8, max: 12 }, descansoSeg: 120 })
      .repeticiones,
    { min: 8, max: 12 }
  );
});

test("línea de rutina: valores fuera de rango dan LINEA_RUTINA_INVALIDA", () => {
  const malas = [
    { ejercicioId: "x", series: 0, repeticiones: 10 },
    { ejercicioId: "x", series: 21, repeticiones: 10 },
    { ejercicioId: "x", series: 3, repeticiones: 0 },
    { ejercicioId: "x", series: 3, repeticiones: { min: 12, max: 8 } },
    { ejercicioId: "x", series: 3, repeticiones: 2.5 },
    { ejercicioId: "x", series: 3, repeticiones: 10, descansoSeg: 601 },
    { series: 3, repeticiones: 10 },
  ];
  for (const linea of malas) {
    assert.throws(() => logica.normalizarLineaRutina(linea), /LINEA_RUTINA_INVALIDA/, JSON.stringify(linea));
  }
});

test("crear rutina: guarda el plan y devuelve cada ejercicio con su nombre", async () => {
  await logica.prepararCatalogo();
  const banca = await idEjercicio("Press banca con barra");
  const rutina = await logica.crearRutina("ana@demo.com", {
    nombre: "  Pecho   lunes ",
    ejercicios: [
      { ejercicioId: banca, series: 4, repeticiones: { min: 6, max: 8 }, descansoSeg: 150 },
      { ejercicioId: banca, series: 2, repeticiones: 12 }, // mismo ejercicio repetido: permitido
    ],
  });
  assert.equal(rutina.nombre, "Pecho lunes");
  assert.equal(rutina.ejercicios.length, 2);
  assert.equal(rutina.ejercicios[0].nombre, "Press banca con barra");
  assert.equal(rutina.ejercicios[1].descansoSeg, 90);
  assert.ok(!("dueno" in rutina));
  const lista = await logica.listarRutinas("ana@demo.com");
  assert.deepEqual(lista.map((r) => [r.nombre, r.numEjercicios]), [["Pecho lunes", 2]]);
  assert.deepEqual(await logica.listarRutinas("luis@demo.com"), []);
});

test("crear rutina: nombre, ejercicios y referencias no válidos dan error", async () => {
  await logica.prepararCatalogo();
  const banca = await idEjercicio("Press banca con barra");
  const linea = { ejercicioId: banca, series: 3, repeticiones: 10 };
  await assert.rejects(() => logica.crearRutina("ana@demo.com", { nombre: "x", ejercicios: [linea] }), /NOMBRE_INVALIDO/);
  await assert.rejects(() => logica.crearRutina("ana@demo.com", { nombre: "Vacía", ejercicios: [] }), /RUTINA_SIN_EJERCICIOS/);
  await assert.rejects(
    () => logica.crearRutina("ana@demo.com", { nombre: "Rara", ejercicios: [{ ...linea, ejercicioId: "no-existe" }] }),
    /EJERCICIO_NO_VALIDO/
  );
  // Un ejercicio propio de otro usuario tampoco vale.
  const deLuis = await logica.crearEjercicio("luis@demo.com", { nombre: "Secreto de Luis", grupo: "core" });
  await assert.rejects(
    () => logica.crearRutina("ana@demo.com", { nombre: "Ajena", ejercicios: [{ ...linea, ejercicioId: deLuis.id }] }),
    /EJERCICIO_NO_VALIDO/
  );
});

test("rutinas: nombre único por usuario, sin distinguir mayúsculas", async () => {
  await logica.prepararCatalogo();
  const linea = { ejercicioId: await idEjercicio("Sentadilla trasera con barra"), series: 5, repeticiones: 5 };
  await logica.crearRutina("ana@demo.com", { nombre: "Pierna", ejercicios: [linea] });
  await assert.rejects(() => logica.crearRutina("ana@demo.com", { nombre: "PIERNA", ejercicios: [linea] }), /RUTINA_YA_EXISTE/);
  await logica.crearRutina("luis@demo.com", { nombre: "Pierna", ejercicios: [linea] });
});

test("rutinas: editar cambia el plan y no deja quitarle el nombre a otra rutina mía", async () => {
  await logica.prepararCatalogo();
  const linea = { ejercicioId: await idEjercicio("Dominadas"), series: 3, repeticiones: 8 };
  const a = await logica.crearRutina("ana@demo.com", { nombre: "Espalda A", ejercicios: [linea] });
  await logica.crearRutina("ana@demo.com", { nombre: "Espalda B", ejercicios: [linea] });
  const editada = await logica.actualizarRutina("ana@demo.com", a.id, {
    nombre: "ESPALDA A", // la misma, cambiando solo mayúsculas: permitido
    ejercicios: [{ ...linea, series: 5 }],
  });
  assert.equal(editada.nombre, "ESPALDA A");
  assert.equal(editada.ejercicios[0].series, 5);
  await assert.rejects(
    () => logica.actualizarRutina("ana@demo.com", a.id, { nombre: "espalda b", ejercicios: [linea] }),
    /RUTINA_YA_EXISTE/
  );
});

test("rutinas: la de otro usuario no se puede ver, editar ni borrar (como si no existiera)", async () => {
  await logica.prepararCatalogo();
  const linea = { ejercicioId: await idEjercicio("Dominadas"), series: 3, repeticiones: 8 };
  const deAna = await logica.crearRutina("ana@demo.com", { nombre: "Mía", ejercicios: [linea] });
  await assert.rejects(() => logica.obtenerRutina("luis@demo.com", deAna.id), /RECURSO_NO_EXISTE/);
  await assert.rejects(() => logica.actualizarRutina("luis@demo.com", deAna.id, { nombre: "Robada", ejercicios: [linea] }), /RECURSO_NO_EXISTE/);
  await assert.rejects(() => logica.eliminarRutina("luis@demo.com", deAna.id), /RECURSO_NO_EXISTE/);
  await assert.rejects(() => logica.obtenerRutina("ana@demo.com", "id-raro"), /RECURSO_NO_EXISTE/);
  // Sigue intacta para su dueña, y ella sí puede borrarla.
  assert.equal((await logica.obtenerRutina("ana@demo.com", deAna.id)).nombre, "Mía");
  await logica.eliminarRutina("ana@demo.com", deAna.id);
  assert.deepEqual(await logica.listarRutinas("ana@demo.com"), []);
});

// T-36: entreno en vivo.
test("seriesDesdeRutina: una serie sin hacer por cada serie del plan, con objetivo y descanso", () => {
  const series = logica.seriesDesdeRutina([
    { ejercicioId: "a", nombre: "Press", series: 2, repeticiones: { min: 8, max: 12 }, descansoSeg: 120 },
    { ejercicioId: "b", nombre: "Remo", series: 1, repeticiones: { min: 10, max: 10 }, descansoSeg: 90 },
  ]);
  assert.deepEqual(series.map((s) => [s.nombre, s.objetivo.min, s.objetivo.max, s.descansoSeg, s.hecha, s.pesoKg]), [
    ["Press", 8, 12, 120, false, null],
    ["Press", 8, 12, 120, false, null],
    ["Remo", 10, 10, 90, false, null],
  ]);
  assert.equal(new Set(series.map((s) => s.id)).size, 3); // cada serie con su id
});

test("normalizarSerie: valores válidos, vacíos y fuera de rango", () => {
  assert.deepEqual(logica.normalizarSerie({ pesoKg: "62.555", repeticiones: "8", hecha: true }), { pesoKg: 62.56, repeticiones: 8, hecha: true });
  assert.deepEqual(logica.normalizarSerie({ pesoKg: 0, repeticiones: 12, hecha: true }), { pesoKg: 0, repeticiones: 12, hecha: true });
  assert.deepEqual(logica.normalizarSerie({ pesoKg: "", repeticiones: null }), { pesoKg: null, repeticiones: null, hecha: false });
  const malas = [
    { pesoKg: -1 },
    { pesoKg: 1001 },
    { pesoKg: "mucho" },
    { repeticiones: 2.5 },
    { repeticiones: 101 },
    { pesoKg: 50, hecha: true }, // hecha sin repeticiones
    { pesoKg: 50, repeticiones: 0, hecha: true },
    { repeticiones: 8, hecha: true }, // hecha sin peso
  ];
  for (const serie of malas) {
    assert.throws(() => logica.normalizarSerie(serie), /SERIE_INVALIDA/, JSON.stringify(serie));
  }
});

// T-42: unidades de peso.
test("pesoAKg y pesoDesdeKg: kg sin cambios, lb convertidas y la vuelta no pierde precisión", () => {
  assert.equal(logica.pesoAKg(62.5, "kg"), 62.5);
  assert.equal(logica.pesoAKg(100, "lb"), 45.359);
  assert.equal(logica.pesoDesdeKg(100, "lb"), 220.46);
  assert.equal(logica.pesoDesdeKg(0, "lb"), 0);
  for (const lb of [135, 225, 2.5, 45, 315.5]) {
    assert.equal(logica.pesoDesdeKg(logica.pesoAKg(lb, "lb"), "lb"), lb, `${lb} lb`);
  }
  assert.throws(() => logica.pesoAKg(10, "stone"), /UNIDAD_NO_VALIDA/);
  assert.throws(() => logica.pesoDesdeKg(10, undefined), /UNIDAD_NO_VALIDA/);
});

test("unidad de peso: kg por defecto, se puede cambiar y una unidad rara da error", async () => {
  await logica.registrar("ana@demo.com", "secreta1");
  assert.equal(await logica.unidadPesoDe("ana@demo.com"), "kg");
  assert.equal(await logica.cambiarUnidadPeso("ana@demo.com", "lb"), "lb");
  assert.equal(await logica.unidadPesoDe("ana@demo.com"), "lb");
  await assert.rejects(() => logica.cambiarUnidadPeso("ana@demo.com", "LB"), /UNIDAD_NO_VALIDA/);
  assert.equal(await logica.unidadPesoDe("ana@demo.com"), "lb");
  await assert.rejects(() => logica.cambiarUnidadPeso("nadie@demo.com", "kg"), /USUARIO_NO_EXISTE/);
});

test("entreno libre: empezar, añadir ejercicio, copiar serie, apuntar, borrar y terminar", async () => {
  await logica.prepararCatalogo();
  assert.equal(await logica.obtenerEntrenoEnCurso("ana@demo.com"), null);
  const vacio = await logica.iniciarEntreno("ana@demo.com", {});
  assert.equal(vacio.rutinaId, null);
  assert.equal(vacio.fin, null);
  assert.deepEqual(vacio.series, []);
  assert.ok(!("dueno" in vacio));

  let entreno = await logica.anadirSerie("ana@demo.com", { ejercicioId: await idEjercicio("Dominadas") });
  const primera = entreno.series[0];
  assert.equal(primera.nombre, "Dominadas");
  assert.equal(primera.objetivo, null);
  entreno = await logica.actualizarSerie("ana@demo.com", primera.id, { pesoKg: 0, repeticiones: 10, hecha: true });
  // "+ Serie" copia peso y repeticiones de la anterior, pero sin marcar.
  entreno = await logica.anadirSerie("ana@demo.com", { despuesDe: primera.id });
  assert.deepEqual(entreno.series.map((s) => [s.repeticiones, s.hecha]), [[10, true], [10, false]]);
  entreno = await logica.anadirSerie("ana@demo.com", { despuesDe: primera.id });
  entreno = await logica.eliminarSerie("ana@demo.com", entreno.series[2].id);
  assert.equal(entreno.series.length, 2);

  // Lo guardado es lo mismo que lo devuelto (se guarda en cada cambio).
  assert.deepEqual((await logica.obtenerEntrenoEnCurso("ana@demo.com")).series, entreno.series);

  // Al terminar solo quedan las series hechas, y ya no hay entreno en curso.
  const fin = new Date("2026-11-16T19:00:00Z");
  const terminado = await logica.terminarEntreno("ana@demo.com", fin);
  assert.deepEqual(terminado.fin, fin);
  assert.equal(terminado.series.length, 1);
  assert.equal(await logica.obtenerEntrenoEnCurso("ana@demo.com"), null);
  await assert.rejects(() => logica.anadirSerie("ana@demo.com", { despuesDe: primera.id }), /SIN_ENTRENO_EN_CURSO/);
});

test("entreno desde rutina: copia el plan y el nombre de la rutina", async () => {
  await logica.prepararCatalogo();
  const banca = await idEjercicio("Press banca con barra");
  const rutina = await logica.crearRutina("ana@demo.com", {
    nombre: "Pecho lunes",
    ejercicios: [{ ejercicioId: banca, series: 3, repeticiones: { min: 6, max: 8 }, descansoSeg: 150 }],
  });
  const entreno = await logica.iniciarEntreno("ana@demo.com", { rutinaId: rutina.id });
  assert.equal(entreno.rutinaId, rutina.id);
  assert.equal(entreno.rutinaNombre, "Pecho lunes");
  assert.equal(entreno.series.length, 3);
  assert.deepEqual(entreno.series[0].objetivo, { min: 6, max: 8 });
  assert.equal(entreno.series[0].nombre, "Press banca con barra");
  // Editar la rutina después no cambia el entreno que ya está en marcha.
  await logica.actualizarRutina("ana@demo.com", rutina.id, {
    nombre: "Pecho lunes",
    ejercicios: [{ ejercicioId: banca, series: 1, repeticiones: 20 }],
  });
  assert.equal((await logica.obtenerEntrenoEnCurso("ana@demo.com")).series.length, 3);
});

test("entreno: solo uno en curso, rutina ajena no vale y descartar lo borra", async () => {
  await logica.prepararCatalogo();
  const linea = { ejercicioId: await idEjercicio("Dominadas"), series: 3, repeticiones: 8 };
  const deLuis = await logica.crearRutina("luis@demo.com", { nombre: "De Luis", ejercicios: [linea] });
  await assert.rejects(() => logica.iniciarEntreno("ana@demo.com", { rutinaId: deLuis.id }), /RECURSO_NO_EXISTE/);

  await logica.iniciarEntreno("ana@demo.com", {});
  await assert.rejects(() => logica.iniciarEntreno("ana@demo.com", {}), /ENTRENO_EN_CURSO/);
  // El de Ana no impide que Luis entrene.
  await logica.iniciarEntreno("luis@demo.com", { rutinaId: deLuis.id });

  // Terminar sin ninguna serie hecha no se puede: se descarta.
  await assert.rejects(() => logica.terminarEntreno("ana@demo.com"), /ENTRENO_VACIO/);
  await logica.descartarEntreno("ana@demo.com");
  assert.equal(await logica.obtenerEntrenoEnCurso("ana@demo.com"), null);
  await assert.rejects(() => logica.descartarEntreno("ana@demo.com"), /SIN_ENTRENO_EN_CURSO/);
  // Ya puede empezar otro.
  await logica.iniciarEntreno("ana@demo.com", {});
});

test("entreno: series y ejercicios que no existen dan error", async () => {
  await logica.prepararCatalogo();
  await assert.rejects(() => logica.anadirSerie("ana@demo.com", { ejercicioId: "x" }), /SIN_ENTRENO_EN_CURSO/);
  await logica.iniciarEntreno("ana@demo.com", {});
  await assert.rejects(() => logica.anadirSerie("ana@demo.com", { ejercicioId: "no-existe" }), /EJERCICIO_NO_VALIDO/);
  const deLuis = await logica.crearEjercicio("luis@demo.com", { nombre: "Secreto de Luis", grupo: "core" });
  await assert.rejects(() => logica.anadirSerie("ana@demo.com", { ejercicioId: deLuis.id }), /EJERCICIO_NO_VALIDO/);
  await assert.rejects(() => logica.anadirSerie("ana@demo.com", { despuesDe: "no-existe" }), /SERIE_NO_EXISTE/);
  await assert.rejects(() => logica.actualizarSerie("ana@demo.com", "no-existe", {}), /SERIE_NO_EXISTE/);
  await assert.rejects(() => logica.eliminarSerie("ana@demo.com", "no-existe"), /SERIE_NO_EXISTE/);
});
