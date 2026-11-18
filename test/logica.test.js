import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import * as datos from "../servidor/datos/datos.js";
import * as logica from "../servidor/logica.js";
import { cerrar } from "../servidor/datos/bd.js";
import * as log from "../servidor/servicios/log.js";

// Los tests usan la base fitness_hub_test del mismo cluster (nunca la de verdad).
process.env.MONGO_DB_NAME = "fitness_hub_test";
// Sin claves VAPID: los avisos se quedan en el log y nunca se envía uno de verdad, aunque el
// .env tenga claves (dotenv no pisa una variable que ya existe, aunque esté vacía).
process.env.VAPID_PUBLIC_KEY = "";
process.env.VAPID_PRIVATE_KEY = "";
// Sin Brevo: los correos de confirmación no se envían, se quedan en el log (correo.js).
process.env.BREVO_API_KEY = "";

// T-84: el token del enlace ya no está en la BBDD (solo su huella). Los tests lo recogen del mismo
// sitio que un desarrollador: la línea "email-desarrollo <email> -> <enlace>" que escribe correo.js.
const enlaces = [];
const consolaLog = console.log;
console.log = (...partes) => {
  const m = String(partes[0]).match(/email-desarrollo (\S+) -> \S*token=([0-9a-f]+)/);
  if (m) enlaces.push({ email: m[1], token: m[2] });
  else consolaLog(...partes);
};

// Los tokens de los enlaces que siguen pendientes para ese email (los ya usados o borrados, no).
async function tokensDe(email) {
  const huellas = new Set(await datos.huellasDe(email));
  return enlaces.filter((e) => e.email === email && huellas.has(datos.huellaToken(e.token))).map((e) => e.token);
}

beforeEach(() => datos.limpiar());
after(async () => {
  await datos.limpiar();
  await cerrar();
});

test("registro deja la cuenta en pendiente", async () => {
  const creado = await logica.registrar("ana@demo.com", "secreta1", "Ana");
  assert.equal(creado.estado, "pendiente");
  assert.equal(await logica.comprobarActivo("ana@demo.com"), false);
});

test("registro con email duplicado da error", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await assert.rejects(() => logica.registrar("ana@demo.com", "otra1234", "Ana"), /EMAIL_YA_EXISTE/);
});

test("login con cuenta pendiente se rechaza", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await assert.rejects(() => logica.iniciarSesion("ana@demo.com", "secreta1"), /CUENTA_PENDIENTE/);
});

// T-83 (A07-004): con una contraseña mala no se sabe si la cuenta existe ni si está pendiente.
test("login pendiente con contraseña mala dice lo mismo que una cuenta que no existe", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await assert.rejects(() => logica.iniciarSesion("ana@demo.com", "otra-mala"), /CREDENCIALES_INVALIDAS/);
  await assert.rejects(() => logica.iniciarSesion("nadie@demo.com", "otra-mala"), /CREDENCIALES_INVALIDAS/);
});

test("login ok tras activar", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await logica.activar("ana@demo.com");
  const sesion = await logica.iniciarSesion("ana@demo.com", "secreta1");
  assert.equal(sesion.email, "ana@demo.com");
});

test("login con password mal da error", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await logica.activar("ana@demo.com");
  await assert.rejects(() => logica.iniciarSesion("ana@demo.com", "mal1234"), /CREDENCIALES_INVALIDAS/);
});

test("login de usuario inexistente da error", async () => {
  await assert.rejects(() => logica.iniciarSesion("nadie@demo.com", "secreta1"), /CREDENCIALES_INVALIDAS/);
});

test("usuario eliminado ya no entra", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await logica.activar("ana@demo.com");
  await logica.eliminar("ana@demo.com");
  await assert.rejects(() => logica.iniciarSesion("ana@demo.com", "secreta1"), /CREDENCIALES_INVALIDAS/);
});

test("registro con email sin arroba da error", async () => {
  await assert.rejects(() => logica.registrar("no-es-email", "secreta1", "Ana"), /EMAIL_INVALIDO/);
});

test("registro con password corta da error", async () => {
  await assert.rejects(() => logica.registrar("ana@demo.com", "123", "Ana"), /PASSWORD_CORTA/);
});

test("email con mayusculas y espacios se normaliza", async () => {
  await logica.registrar("  Ana@Demo.com ", "secreta1", "Ana");
  await assert.rejects(() => logica.registrar("ana@demo.com", "otra1234", "Ana"), /EMAIL_YA_EXISTE/);
  await logica.activar("ANA@demo.com");
  const sesion = await logica.iniciarSesion(" ana@DEMO.com ", "secreta1");
  assert.equal(sesion.email, "ana@demo.com");
});

test("listar muestra nombre, email, estado y rol sin exponer el hash", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  const lista = await logica.listar();
  assert.equal(lista.length, 1);
  assert.deepEqual(Object.keys(lista[0]).sort(), ["email", "estado", "nombre", "rol"]);
});

test("activar un usuario inexistente da error", async () => {
  await assert.rejects(() => logica.activar("nadie@demo.com"), /USUARIO_NO_EXISTE/);
});

test("eliminar un usuario inexistente devuelve false", async () => {
  assert.equal(await logica.eliminar("nadie@demo.com"), false);
});

test("eliminar es logico: la cuenta queda como eliminada y no activa", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await logica.activar("ana@demo.com");
  assert.equal(await logica.eliminar("ana@demo.com"), true);
  const [ana] = await logica.listar();
  assert.equal(ana.estado, "eliminado");
  assert.equal(await logica.comprobarActivo("ana@demo.com"), false);
});

test("eliminar dos veces la misma cuenta devuelve false", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await logica.eliminar("ana@demo.com");
  assert.equal(await logica.eliminar("ana@demo.com"), false);
});

test("tras eliminar no se puede registrar de nuevo ese email", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await logica.eliminar("ana@demo.com");
  await assert.rejects(() => logica.registrar("ana@demo.com", "nueva123", "Ana"), /EMAIL_YA_EXISTE/);
});

test("un enlace de confirmacion antiguo no reactiva una cuenta eliminada", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  const [token] = await tokensDe("ana@demo.com");
  await logica.eliminar("ana@demo.com");
  await assert.rejects(() => logica.confirmar(token), /USUARIO_NO_EXISTE/);
  assert.equal(await logica.comprobarActivo("ana@demo.com"), false);
});

test("confirmar con token válido activa la cuenta", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  const tokens = await tokensDe("ana@demo.com");
  assert.equal(tokens.length, 1);
  const cuenta = await logica.confirmar(tokens[0]);
  assert.equal(cuenta.estado, "activo");
  assert.equal(await logica.comprobarActivo("ana@demo.com"), true);
});

// T-84 (A04-001): en la BBDD está la huella del token, nunca el token del enlace.
test("el token del enlace no se guarda en la base de datos, solo su huella", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  const [token] = await tokensDe("ana@demo.com");
  const [huella] = await datos.huellasDe("ana@demo.com");
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.notEqual(huella, token);
  assert.equal(huella, datos.huellaToken(token));
});

test("confirmar con token inexistente da error", async () => {
  await assert.rejects(() => logica.confirmar("token-que-no-existe"), /TOKEN_INVALIDO/);
});

test("el token es de un solo uso", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  const tokens = await tokensDe("ana@demo.com");
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
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  const [token] = await tokensDe("ana@demo.com");
  const dentroDe25h = new Date(Date.now() + 25 * HORA);
  await assert.rejects(() => logica.confirmar(token, dentroDe25h), /TOKEN_CADUCADO/);
  assert.equal(await logica.comprobarActivo("ana@demo.com"), false);
});

// T-26: reenviar el enlace.
test("reenviar a una cuenta pendiente cambia el token y el viejo deja de valer", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  const [viejo] = await tokensDe("ana@demo.com");
  // T-77: hace falta esperar 1 minuto entre correos; se simula que han pasado 2.
  const dentroDeDos = new Date(Date.now() + 2 * 60 * 1000);
  assert.equal(await logica.reenviarConfirmacion(" Ana@demo.com ", dentroDeDos), true);
  const tokens = await tokensDe("ana@demo.com");
  assert.equal(tokens.length, 1);
  assert.notEqual(tokens[0], viejo);
  await assert.rejects(() => logica.confirmar(viejo), /TOKEN_INVALIDO/);
  const cuenta = await logica.confirmar(tokens[0]);
  assert.equal(cuenta.estado, "activo");
});

// T-82 (A09-001): emails de verdad (sin espacios ni saltos de línea) y log en una sola línea.
test("emailValido: algo@algo.dominio, sin espacios ni saltos y como mucho 254 caracteres", () => {
  assert.equal(logica.emailValido("ana@demo.com"), true);
  for (const malo of ["no-es-email", "ana@demo", "ana demo@x.com", "x@x.com\n[2026] INFO login admin@x.com", "a@" + "b".repeat(250) + ".com"]) {
    assert.equal(logica.emailValido(malo), false, JSON.stringify(malo));
  }
});

test("registrar rechaza un email con saltos de línea", async () => {
  await assert.rejects(() => logica.registrar("x@x.com\nINFO login jefa@demo.com", "secreta1", "Ana"), /EMAIL_INVALIDO/);
});

test("unaLinea: el detalle del log nunca tiene saltos de línea", () => {
  assert.equal(log.unaLinea("x@x.com\r\n[2026] INFO falso"), "x@x.com [2026] INFO falso");
});

// T-77 (A06-001): como mucho un correo por minuto a cada email.
test("puedeReenviar: sin enlace previo sí; con uno de hace menos de 1 minuto no", () => {
  const ahora = new Date("2026-11-18T10:00:00Z");
  assert.equal(logica.puedeReenviar(null, ahora), true);
  assert.equal(logica.puedeReenviar(new Date("2026-11-18T09:59:30Z"), ahora), false);
  assert.equal(logica.puedeReenviar(new Date("2026-11-18T09:59:00Z"), ahora), true);
});

test("reenviar justo después de registrarse no manda otro correo", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  const [token] = await tokensDe("ana@demo.com");
  assert.equal(await logica.reenviarConfirmacion("ana@demo.com"), false);
  assert.deepEqual(await tokensDe("ana@demo.com"), [token]); // el enlace de antes sigue valiendo
});

test("registro exige una contraseña de al menos 8 caracteres", async () => {
  await assert.rejects(() => logica.registrar("ana@demo.com", "corta12", "Ana"), /PASSWORD_CORTA/);
  assert.equal((await logica.registrar("ana@demo.com", "larga123", "Ana")).estado, "pendiente");
});

test("reenviar no hace nada si la cuenta no existe, ya está activa o eliminada", async () => {
  assert.equal(await logica.reenviarConfirmacion("nadie@demo.com"), false);
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await logica.activar("ana@demo.com");
  assert.equal(await logica.reenviarConfirmacion("ana@demo.com"), false);
  await logica.eliminar("ana@demo.com");
  assert.equal(await logica.reenviarConfirmacion("ana@demo.com"), false);
});

test("el email de ADMIN_EMAIL nace admin", async () => {
  process.env.ADMIN_EMAIL = "jefa@demo.com";
  const creado = await logica.registrar("jefa@demo.com", "secreta1", "Ana");
  delete process.env.ADMIN_EMAIL;
  assert.equal(creado.rol, "admin");
});

test("el resto de emails nacen usuario", async () => {
  process.env.ADMIN_EMAIL = "jefa@demo.com";
  const creado = await logica.registrar("ana@demo.com", "secreta1", "Ana");
  delete process.env.ADMIN_EMAIL;
  assert.equal(creado.rol, "usuario");
});

// T-60: nombre.
test("normalizarNombre quita espacios de sobra y exige de 2 a 40 caracteres", () => {
  assert.equal(logica.normalizarNombre("  Ana   María "), "Ana María");
  assert.equal(logica.normalizarNombre("Al"), "Al");
  assert.equal(logica.normalizarNombre("x".repeat(40)), "x".repeat(40));
  for (const malo of [undefined, null, "", "   ", "A", "x".repeat(41)]) {
    assert.throws(() => logica.normalizarNombre(malo), /NOMBRE_USUARIO_INVALIDO/);
  }
});

test("nombreDeProveedor: si el nombre de OAuth no vale, null; si es largo, se recorta", () => {
  assert.equal(logica.nombreDeProveedor(" Samuel  García "), "Samuel García");
  assert.equal(logica.nombreDeProveedor(undefined), null);
  assert.equal(logica.nombreDeProveedor("A"), null);
  assert.equal(logica.nombreDeProveedor("x".repeat(60)), "x".repeat(40));
});

test("registro sin nombre válido da NOMBRE_USUARIO_INVALIDO y no crea la cuenta", async () => {
  await assert.rejects(() => logica.registrar("ana@demo.com", "secreta1"), /NOMBRE_USUARIO_INVALIDO/);
  await assert.rejects(() => logica.registrar("ana@demo.com", "secreta1", " "), /NOMBRE_USUARIO_INVALIDO/);
  assert.equal((await logica.listar()).length, 0);
});

test("perfilDe y cambiarNombre: el nombre se guarda limpio", async () => {
  await logica.registrar("ana@demo.com", "secreta1", " Ana ");
  assert.deepEqual(await logica.perfilDe("ana@demo.com"), { nombre: "Ana", unidadPeso: "kg", objetivoSemanal: null });
  assert.equal(await logica.cambiarNombre("ana@demo.com", "Ana  Pérez"), "Ana Pérez");
  assert.equal((await logica.perfilDe("ana@demo.com")).nombre, "Ana Pérez");
  await assert.rejects(() => logica.cambiarNombre("ana@demo.com", "x"), /NOMBRE_USUARIO_INVALIDO/);
  await assert.rejects(() => logica.cambiarNombre("nadie@demo.com", "Nadie"), /USUARIO_NO_EXISTE/);
});

test("oauth guarda el nombre del proveedor solo si la cuenta no tenía", async () => {
  await logica.oauthLogin("git@demo.com"); // sin nombre (el proveedor no lo dio)
  assert.equal((await logica.perfilDe("git@demo.com")).nombre, null);
  await logica.oauthLogin("git@demo.com", "Gitana");
  assert.equal((await logica.perfilDe("git@demo.com")).nombre, "Gitana");
  await logica.oauthLogin("git@demo.com", "Otro Nombre"); // ya tenía: no se pisa
  assert.equal((await logica.perfilDe("git@demo.com")).nombre, "Gitana");
  await logica.oauthLogin("nuevo@demo.com", "Nuevo");
  assert.equal((await logica.perfilDe("nuevo@demo.com")).nombre, "Nuevo");
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
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  const u = await logica.oauthLogin("ana@demo.com");
  assert.equal(u.estado, "activo");
});

// T-76 (A07-001): alguien registra el email de Ana con SU contraseña; Ana entra después con Google.
test("oauth sobre pendiente descarta la contraseña y el nombre de quien se registró", async () => {
  await logica.registrar("ana@demo.com", "del-atacante", "Atacante");
  await logica.oauthLogin("ana@demo.com", "Ana García");
  await assert.rejects(() => logica.iniciarSesion("ana@demo.com", "del-atacante"), /CREDENCIALES_INVALIDAS/);
  assert.equal((await logica.perfilDe("ana@demo.com")).nombre, "Ana García");
  // Sin nombre del proveedor, se queda sin nombre (la app se lo pedirá), no con el del atacante.
  await logica.registrar("luis@demo.com", "del-atacante", "Atacante");
  await logica.oauthLogin("luis@demo.com");
  assert.equal((await logica.perfilDe("luis@demo.com")).nombre, null);
});

test("oauth no deja volver a entrar a una cuenta eliminada", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
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
  assert.deepEqual(logica.normalizarSerie({ peso: "62.5555", repeticiones: "8", hecha: true }), { pesoKg: 62.556, repeticiones: 8, hecha: true });
  assert.deepEqual(logica.normalizarSerie({ peso: 0, repeticiones: 12, hecha: true }), { pesoKg: 0, repeticiones: 12, hecha: true });
  assert.deepEqual(logica.normalizarSerie({ peso: "", repeticiones: null }), { pesoKg: null, repeticiones: null, hecha: false });
  // T-43: en lb se guarda en kg; el máximo (1000 kg) también vale en lb (unas 2204 lb).
  assert.deepEqual(logica.normalizarSerie({ peso: 135, repeticiones: 5, hecha: true }, "lb"), { pesoKg: 61.235, repeticiones: 5, hecha: true });
  assert.equal(logica.normalizarSerie({ peso: 2204 }, "lb").pesoKg, 999.718);
  assert.throws(() => logica.normalizarSerie({ peso: 2205 }, "lb"), /SERIE_INVALIDA/);
  const malas = [
    { peso: -1 },
    { peso: 1001 },
    { peso: "mucho" },
    { repeticiones: 2.5 },
    { repeticiones: 101 },
    { peso: 50, hecha: true }, // hecha sin repeticiones
    { peso: 50, repeticiones: 0, hecha: true },
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
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
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
  entreno = await logica.actualizarSerie("ana@demo.com", primera.id, { peso: 0, repeticiones: 10, hecha: true });
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

test("entreno en lb: se apunta y se ve en lb, se guarda en kg y al cambiar a kg se ve en kg", async () => {
  await logica.prepararCatalogo();
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await logica.cambiarUnidadPeso("ana@demo.com", "lb");
  await logica.iniciarEntreno("ana@demo.com", {});
  let entreno = await logica.anadirSerie("ana@demo.com", { ejercicioId: await idEjercicio("Dominadas") });
  assert.equal(entreno.unidad, "lb");
  entreno = await logica.actualizarSerie("ana@demo.com", entreno.series[0].id, { peso: "135", repeticiones: 5, hecha: true });
  assert.equal(entreno.series[0].peso, 135);
  assert.ok(!("pesoKg" in entreno.series[0])); // lo guardado no sale de la lógica
  assert.equal((await datos.buscarEntrenoEnCurso("ana@demo.com")).series[0].pesoKg, 61.235);

  await logica.cambiarUnidadPeso("ana@demo.com", "kg");
  const enKg = await logica.obtenerEntrenoEnCurso("ana@demo.com");
  assert.equal(enKg.unidad, "kg");
  assert.equal(enKg.series[0].peso, 61.24);
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

// T-44: historial.
test("resumenEntreno: nombre, duración en minutos, ejercicios distintos y series", () => {
  const resumen = logica.resumenEntreno({
    id: "e1",
    rutinaNombre: null,
    inicio: new Date("2026-11-16T10:00:00Z"),
    fin: new Date("2026-11-16T11:05:20Z"),
    series: [{ ejercicioId: "a" }, { ejercicioId: "a" }, { ejercicioId: "b" }],
  });
  assert.deepEqual(
    { nombre: resumen.nombre, duracionMin: resumen.duracionMin, numEjercicios: resumen.numEjercicios, numSeries: resumen.numSeries },
    { nombre: "Entreno libre", duracionMin: 65, numEjercicios: 2, numSeries: 3 }
  );
  assert.equal(logica.resumenEntreno({ rutinaNombre: "Pierna", inicio: 0, fin: 0, series: [] }).nombre, "Pierna");
});

// Un entreno libre terminado con una serie hecha de `kg` x 8 de Dominadas.
async function entrenoTerminado(email, kg, inicio) {
  await logica.iniciarEntreno(email, {}, inicio);
  const entreno = await logica.anadirSerie(email, { ejercicioId: await idEjercicio("Dominadas") });
  await logica.actualizarSerie(email, entreno.series[0].id, { peso: kg, repeticiones: 8, hecha: true });
  return logica.terminarEntreno(email, new Date(inicio.getTime() + 45 * 60000));
}

test("historial: lista, detalle en la unidad del usuario y borrar; ajenos y en curso no existen", async () => {
  await logica.prepararCatalogo();
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  const viejo = await entrenoTerminado("ana@demo.com", 60, new Date("2026-11-01T10:00:00Z"));
  const reciente = await entrenoTerminado("ana@demo.com", 100, new Date("2026-11-10T10:00:00Z"));
  const ajeno = await entrenoTerminado("luis@demo.com", 50, new Date("2026-11-05T10:00:00Z"));
  const enCurso = await logica.iniciarEntreno("ana@demo.com", {});

  const lista = await logica.listarHistorial("ana@demo.com");
  assert.deepEqual(lista.map((e) => [e.id, e.duracionMin, e.numSeries]), [[reciente.id, 45, 1], [viejo.id, 45, 1]]);

  let detalle = await logica.obtenerEntrenoTerminado("ana@demo.com", reciente.id);
  assert.equal(detalle.series[0].peso, 100);
  assert.ok(!("dueno" in detalle));
  await logica.cambiarUnidadPeso("ana@demo.com", "lb");
  detalle = await logica.obtenerEntrenoTerminado("ana@demo.com", reciente.id);
  assert.equal(detalle.unidad, "lb");
  assert.equal(detalle.series[0].peso, 220.46);

  for (const id of [ajeno.id, enCurso.id, "no-existe"]) {
    await assert.rejects(() => logica.obtenerEntrenoTerminado("ana@demo.com", id), /RECURSO_NO_EXISTE/, id);
    await assert.rejects(() => logica.eliminarEntrenoTerminado("ana@demo.com", id), /RECURSO_NO_EXISTE/, id);
  }
  await logica.eliminarEntrenoTerminado("ana@demo.com", viejo.id);
  assert.deepEqual((await logica.listarHistorial("ana@demo.com")).map((e) => e.id), [reciente.id]);
  assert.ok(await logica.obtenerEntrenoEnCurso("ana@demo.com")); // el de en curso sigue ahí
});

// T-46: métricas (funciones puras, sin BBDD).
function entrenoDe(inicio, series) {
  return {
    inicio: new Date(inicio),
    series: series.map(([ejercicioId, pesoKg, repeticiones, hecha = true]) => ({ ejercicioId, nombre: ejercicioId.toUpperCase(), pesoKg, repeticiones, hecha })),
  };
}

test("lunesDe: semanas de lunes a domingo en hora de España", () => {
  assert.equal(logica.lunesDe("2026-11-16T10:00:00Z"), "2026-11-16"); // lunes
  assert.equal(logica.lunesDe("2026-11-22T20:00:00Z"), "2026-11-16"); // domingo 21:00 en España
  // Domingo 23:30 en España = 22:30 UTC: sigue siendo la semana del 16.
  assert.equal(logica.lunesDe("2026-11-22T22:30:00Z"), "2026-11-16");
  // Lunes 00:30 en España = domingo 23:30 UTC: ya es la semana siguiente.
  assert.equal(logica.lunesDe("2026-11-22T23:30:00Z"), "2026-11-23");
  // Cambio de mes y de año.
  assert.equal(logica.lunesDe("2027-01-01T12:00:00Z"), "2026-12-28");
});

test("entrenosPorSemana: últimas semanas con huecos a 0, contando entrenos y volumen", () => {
  const entrenos = [
    entrenoDe("2026-11-17T10:00:00Z", [["a", 100, 5], ["a", 50, 10, false]]), // la no hecha no cuenta
    entrenoDe("2026-11-19T10:00:00Z", [["b", 0, 12]]), // peso corporal: volumen 0
    entrenoDe("2026-11-03T10:00:00Z", [["a", 60, 10]]),
    entrenoDe("2026-09-01T10:00:00Z", [["a", 60, 10]]), // fuera de las 4 semanas
  ];
  const semanas = logica.entrenosPorSemana(entrenos, new Date("2026-11-20T12:00:00Z"), 4);
  assert.deepEqual(semanas, [
    { semana: "2026-10-26", entrenos: 0, volumenKg: 0 },
    { semana: "2026-11-02", entrenos: 1, volumenKg: 600 },
    { semana: "2026-11-09", entrenos: 0, volumenKg: 0 },
    { semana: "2026-11-16", entrenos: 2, volumenKg: 500 },
  ]);
  assert.equal(logica.entrenosPorSemana([], new Date("2026-11-20T12:00:00Z")).length, 8); // 8 por defecto
});

test("progresoEjercicio: un punto por entreno, ordenado, con peso máximo, mejor serie y volumen", () => {
  const entrenos = [
    entrenoDe("2026-11-10T10:00:00Z", [["a", 100, 3], ["a", 100, 5], ["b", 20, 10]]),
    entrenoDe("2026-11-03T10:00:00Z", [["a", 90, 8], ["a", 95, 6]]),
    entrenoDe("2026-11-05T10:00:00Z", [["b", 20, 12]]),
  ];
  const puntos = logica.progresoEjercicio(entrenos, "a");
  assert.deepEqual(
    puntos.map((p) => [p.fecha.toISOString().slice(0, 10), p.pesoMaxKg, p.mejorSerie.repeticiones, p.volumenKg]),
    [
      ["2026-11-03", 95, 6, 1290],
      ["2026-11-10", 100, 5, 800],
    ]
  );
  assert.deepEqual(logica.progresoEjercicio(entrenos, "nunca"), []);
});

test("recordsPorEjercicio: mejor serie y primera vez, sesiones, y peso corporal por repeticiones", () => {
  const entrenos = [
    entrenoDe("2026-11-10T10:00:00Z", [["a", 100, 5], ["d", 0, 15]]), // iguala el récord de "a": no cambia la fecha
    entrenoDe("2026-11-03T10:00:00Z", [["a", 100, 5], ["a", 80, 10], ["d", 0, 12]]),
    entrenoDe("2026-11-12T10:00:00Z", [["a", 200, 1, false]]), // no hecha: no es récord
  ];
  const records = logica.recordsPorEjercicio(entrenos);
  assert.deepEqual(
    records.map((r) => [r.ejercicioId, r.nombre, r.sesiones, r.record.pesoKg, r.record.repeticiones, r.record.fecha.toISOString().slice(0, 10)]),
    [
      ["a", "A", 2, 100, 5, "2026-11-03"],
      ["d", "D", 2, 0, 15, "2026-11-10"],
    ]
  );
  assert.deepEqual(logica.recordsPorEjercicio([]), []);
});

// T-47: métricas con los entrenos de verdad, solo los del usuario y en su unidad.
test("métricas: semanas, récords y progreso de un ejercicio en la unidad del usuario", async () => {
  await logica.prepararCatalogo();
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await entrenoTerminado("ana@demo.com", 60, new Date("2026-11-01T10:00:00Z")); // domingo: semana del 26-oct
  await entrenoTerminado("ana@demo.com", 100, new Date("2026-11-10T10:00:00Z")); // semana del 9-nov
  await entrenoTerminado("luis@demo.com", 150, new Date("2026-11-10T12:00:00Z")); // de otro: no cuenta
  const ahora = new Date("2026-11-12T12:00:00Z");

  let metricas = await logica.obtenerMetricas("ana@demo.com", ahora);
  assert.equal(metricas.unidad, "kg");
  assert.equal(metricas.semanas.length, 8);
  assert.deepEqual(metricas.semanas.slice(-3), [
    { semana: "2026-10-26", entrenos: 1, volumen: 480 },
    { semana: "2026-11-02", entrenos: 0, volumen: 0 },
    { semana: "2026-11-09", entrenos: 1, volumen: 800 },
  ]);
  assert.equal(metricas.records.length, 1);
  const [record] = metricas.records;
  assert.equal(record.nombre, "Dominadas");
  assert.equal(record.sesiones, 2);
  assert.deepEqual([record.record.peso, record.record.repeticiones], [100, 8]);

  await logica.cambiarUnidadPeso("ana@demo.com", "lb");
  metricas = await logica.obtenerMetricas("ana@demo.com", ahora);
  assert.equal(metricas.records[0].record.peso, 220.46);
  assert.equal(metricas.semanas.at(-1).volumen, 1763.7);

  const progreso = await logica.obtenerProgresoEjercicio("ana@demo.com", record.ejercicioId);
  assert.equal(progreso.nombre, "Dominadas");
  assert.equal(progreso.unidad, "lb");
  assert.deepEqual(progreso.puntos.map((p) => p.pesoMax), [132.28, 220.46]);
  const banca = await idEjercicio("Press banca con barra"); // existe, pero ana nunca lo ha hecho
  await assert.rejects(() => logica.obtenerProgresoEjercicio("ana@demo.com", banca), /RECURSO_NO_EXISTE/);
  await assert.rejects(() => logica.obtenerProgresoEjercicio("ana@demo.com", "no-existe"), /RECURSO_NO_EXISTE/);
});

// T-55: notificaciones push.
const suscripcionDePrueba = (n = 1) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/prueba-${n}`,
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
});

test("normalizarSuscripcion: se queda con endpoint y claves; rechaza lo que no es una suscripción", () => {
  const { endpoint, claves } = logica.normalizarSuscripcion({ ...suscripcionDePrueba(), expirationTime: null, extra: "x" });
  assert.equal(endpoint, suscripcionDePrueba().endpoint);
  assert.deepEqual(Object.keys(claves), ["p256dh", "auth"]);
  const malas = [
    null,
    {},
    { ...suscripcionDePrueba(), endpoint: "http://sin-https.com/x" },
    { ...suscripcionDePrueba(), endpoint: "javascript:alert(1)" },
    { endpoint: suscripcionDePrueba().endpoint },
    { endpoint: suscripcionDePrueba().endpoint, keys: { p256dh: "no vale!", auth: "x" } },
    { endpoint: "https://x.com/" + "a".repeat(1000), keys: suscripcionDePrueba().keys },
  ];
  for (const mala of malas) {
    assert.throws(() => logica.normalizarSuscripcion(mala), /SUSCRIPCION_INVALIDA/, JSON.stringify(mala));
  }
});

// T-78 (A01-001): solo direcciones de los servicios de avisos de los navegadores.
test("servicioPushPermitido: Google, Mozilla, Apple y Microsoft sí; cualquier otra web no", () => {
  for (const buena of [
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/abc",
    "https://wns2-db5p.notify.windows.com/w/?token=abc",
  ]) {
    assert.equal(logica.servicioPushPermitido(buena), true, buena);
  }
  for (const mala of [
    "https://mi-web.com/recibir",
    "https://fcm.googleapis.com.trampa.com/x", // parece de Google pero no lo es
    "https://169.254.169.254/latest/meta-data", // dirección interna de un servidor en la nube
    "https://fcm.googleapis.com:8443/x", // puerto raro
    "https://usuario:clave@fcm.googleapis.com/x",
    "http://fcm.googleapis.com/x",
    "no es una url",
  ]) {
    assert.equal(logica.servicioPushPermitido(mala), false, mala);
  }
  assert.throws(
    () => logica.normalizarSuscripcion({ ...suscripcionDePrueba(), endpoint: "https://mi-web.com/recibir" }),
    /SUSCRIPCION_INVALIDA/
  );
});

test("avisos: activar, aviso de prueba (sin claves se cuenta como enviado), desactivar", async () => {
  await assert.rejects(() => logica.avisoDePrueba("ana@demo.com"), /SIN_AVISOS_ACTIVOS/);
  await logica.activarAvisos("ana@demo.com", suscripcionDePrueba(1));
  await logica.activarAvisos("ana@demo.com", suscripcionDePrueba(2)); // otro móvil
  await logica.activarAvisos("ana@demo.com", suscripcionDePrueba(1)); // el mismo otra vez: no duplica
  assert.equal(await logica.avisoDePrueba("ana@demo.com"), 2);
  assert.equal(logica.clavePublicaAvisos(), null); // sin claves no hay avisos configurados
  // Un usuario no puede quitar la suscripción de otro.
  assert.equal(await logica.desactivarAvisos("luis@demo.com", suscripcionDePrueba(1).endpoint), false);
  assert.equal(await logica.desactivarAvisos("ana@demo.com", suscripcionDePrueba(1).endpoint), true);
  assert.equal(await logica.avisoDePrueba("ana@demo.com"), 1);
  await assert.rejects(() => logica.desactivarAvisos("ana@demo.com", ""), /SUSCRIPCION_INVALIDA/);
});

// T-56: aviso al terminar el descanso.
test("retrasoAvisoDescanso: solo fechas futuras y dentro de 15 minutos", () => {
  const ahora = new Date("2026-11-17T18:00:00Z");
  assert.equal(logica.retrasoAvisoDescanso("2026-11-17T18:01:30Z", ahora), 90_000);
  assert.equal(logica.retrasoAvisoDescanso(new Date("2026-11-17T18:15:00Z"), ahora), 15 * 60_000); // justo el máximo
  for (const fin of [null, undefined, "", "mañana", "2026-11-17T17:59:59Z", "2026-11-17T18:00:00Z", "2026-11-17T18:15:01Z", "2027-01-01T00:00:00Z"]) {
    assert.throws(() => logica.retrasoAvisoDescanso(fin, ahora), /DESCANSO_INVALIDO/, String(fin));
  }
});

test("aviso de descanso: se programa, se reprograma, se cancela y se dispara a su hora", async () => {
  const fin = () => new Date(Date.now() + 60_000).toISOString();
  logica.programarAvisoDescanso("ana@demo.com", fin());
  logica.programarAvisoDescanso("ana@demo.com", fin()); // reprogramar (±15 s) no deja dos pendientes
  assert.equal(logica.hayAvisoDescanso("ana@demo.com"), true);
  assert.equal(logica.cancelarAvisoDescanso("ana@demo.com"), true);
  assert.equal(logica.hayAvisoDescanso("ana@demo.com"), false);
  assert.equal(logica.cancelarAvisoDescanso("ana@demo.com"), false); // cancelar dos veces no falla

  // A su hora se dispara (sin claves VAPID solo deja el aviso en el log) y deja de estar pendiente.
  logica.programarAvisoDescanso("ana@demo.com", new Date(Date.now() + 50).toISOString());
  await new Promise((listo) => setTimeout(listo, 120));
  assert.equal(logica.hayAvisoDescanso("ana@demo.com"), false);
});

test("aviso de descanso: terminar o descartar el entreno lo cancela", async () => {
  await logica.prepararCatalogo();
  await logica.iniciarEntreno("ana@demo.com", {});
  logica.programarAvisoDescanso("ana@demo.com", new Date(Date.now() + 60_000).toISOString());
  await logica.descartarEntreno("ana@demo.com");
  assert.equal(logica.hayAvisoDescanso("ana@demo.com"), false);
});

// T-61: pantalla "Hoy".
test("rutinaSugerida: primero una sin hacer; si no, la que lleva más tiempo sin hacerse", () => {
  const rutinas = [
    { id: "a", nombre: "Pecho" },
    { id: "b", nombre: "Pierna" },
    { id: "c", nombre: "Espalda" },
  ];
  const entreno = (rutinaId, inicio) => ({ rutinaId, inicio, series: [] });
  assert.equal(logica.rutinaSugerida([], []), null);
  assert.deepEqual(logica.rutinaSugerida(rutinas, []), { id: "a", nombre: "Pecho", ultimaVez: null });
  // a y c hechas: b nunca -> b
  const algunas = [entreno("a", "2026-11-10T10:00:00Z"), entreno("c", "2026-11-12T10:00:00Z"), entreno(null, "2026-11-13T10:00:00Z")];
  assert.equal(logica.rutinaSugerida(rutinas, algunas).id, "b");
  // todas hechas: la de último entreno más antiguo (a se hizo dos veces; cuenta la última)
  const todas = [
    entreno("a", "2026-11-01T10:00:00Z"),
    entreno("a", "2026-11-14T10:00:00Z"),
    entreno("b", "2026-11-11T10:00:00Z"),
    entreno("c", "2026-11-12T10:00:00Z"),
  ];
  assert.deepEqual(logica.rutinaSugerida(rutinas, todas), { id: "b", nombre: "Pierna", ultimaVez: "2026-11-11T10:00:00.000Z" });
});

test("rachaSemanas: semanas seguidas con entrenos; la actual vacía no la rompe", () => {
  const semanas = (...n) => n.map((entrenos) => ({ entrenos }));
  assert.equal(logica.rachaSemanas([]), 0);
  assert.equal(logica.rachaSemanas(semanas(0, 0, 0)), 0);
  assert.equal(logica.rachaSemanas(semanas(1, 0, 2, 3, 1)), 3);
  assert.equal(logica.rachaSemanas(semanas(1, 2, 1, 0)), 3); // esta semana aún no ha entrenado
  assert.equal(logica.rachaSemanas(semanas(1, 0, 0)), 0); // la semana pasada no entrenó: racha rota
});

test("ultimoRecord: el récord más reciente, o null", () => {
  assert.equal(logica.ultimoRecord([]), null);
  const records = [
    { nombre: "Press banca", record: { pesoKg: 80, repeticiones: 5, fecha: "2026-11-10T10:00:00Z" } },
    { nombre: "Sentadilla", record: { pesoKg: 100, repeticiones: 3, fecha: "2026-11-14T10:00:00Z" } },
  ];
  assert.deepEqual(logica.ultimoRecord(records), { nombre: "Sentadilla", pesoKg: 100, repeticiones: 3, fecha: "2026-11-14T10:00:00Z" });
});

// T-62: lo que se hizo la vez anterior con la misma rutina.
test("anadirAnteriores: misma posición del mismo ejercicio; si no hubo, null", () => {
  const serie = (ejercicioId, extra = {}) => ({ ejercicioId, ...extra });
  const nuevas = [serie("banca"), serie("banca"), serie("banca"), serie("remo")];
  assert.deepEqual(
    logica.anadirAnteriores(nuevas, null).map((s) => s.anterior),
    [null, null, null, null]
  );
  const previo = {
    series: [
      serie("banca", { pesoKg: 60, repeticiones: 10, hecha: true }),
      serie("remo", { pesoKg: 50, repeticiones: 12, hecha: true }),
      serie("banca", { pesoKg: 62.5, repeticiones: 8, hecha: true }),
    ],
  };
  assert.deepEqual(logica.anadirAnteriores(nuevas, previo).map((s) => s.anterior), [
    { pesoKg: 60, repeticiones: 10 },
    { pesoKg: 62.5, repeticiones: 8 },
    null, // aquel día solo hizo 2 de banca
    { pesoKg: 50, repeticiones: 12 },
  ]);
});

test("entreno desde rutina: trae lo de la vez anterior en su unidad, y no lo guarda al terminar", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await logica.prepararCatalogo();
  const banca = await idEjercicio("Press banca con barra");
  const rutina = await logica.crearRutina("ana@demo.com", {
    nombre: "Pecho",
    ejercicios: [{ ejercicioId: banca, series: 2, repeticiones: 8 }],
  });

  const primero = await logica.iniciarEntreno("ana@demo.com", { rutinaId: rutina.id });
  assert.deepEqual(primero.series.map((s) => s.anterior), [null, null]); // primera vez
  await logica.actualizarSerie("ana@demo.com", primero.series[0].id, { peso: 60, repeticiones: 8, hecha: true });
  const terminado = await logica.terminarEntreno("ana@demo.com");
  assert.ok(terminado.series.every((s) => !("anterior" in s)));

  await logica.cambiarUnidadPeso("ana@demo.com", "lb");
  const segundo = await logica.iniciarEntreno("ana@demo.com", { rutinaId: rutina.id });
  assert.deepEqual(segundo.series.map((s) => s.anterior), [{ peso: 132.28, repeticiones: 8 }, null]);
  await logica.descartarEntreno("ana@demo.com");

  // Un entreno libre no tiene "vez anterior".
  const libre = await logica.iniciarEntreno("ana@demo.com");
  await logica.anadirSerie("ana@demo.com", { ejercicioId: banca });
  assert.ok(!("anterior" in (await logica.obtenerEntrenoEnCurso("ana@demo.com")).series[0]));
  assert.equal(libre.rutinaId, null);
});

// T-87: objetivo semanal de entrenos (1 a 7).
test("normalizarObjetivo: de 1 a 7, entero; lo demás da OBJETIVO_NO_VALIDO", () => {
  assert.equal(logica.normalizarObjetivo(3), 3);
  assert.equal(logica.normalizarObjetivo("5"), 5);
  for (const malo of [0, 8, 2.5, "", null, undefined, "tres"]) {
    assert.throws(() => logica.normalizarObjetivo(malo), /OBJETIVO_NO_VALIDO/, String(malo));
  }
});

test("objetivo semanal: sin elegir es null; se guarda en la cuenta", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  assert.equal((await logica.perfilDe("ana@demo.com")).objetivoSemanal, null);
  assert.equal(await logica.cambiarObjetivoSemanal("ana@demo.com", 4), 4);
  assert.equal((await logica.perfilDe("ana@demo.com")).objetivoSemanal, 4);
  await assert.rejects(() => logica.cambiarObjetivoSemanal("nadie@demo.com", 3), /USUARIO_NO_EXISTE/);
});

// T-88: lo que enseña la página de Perfil.
test("obtenerPerfil: cuenta, desde cuándo, cómo entra y cifras", async () => {
  const antes = Date.now() - 2000;
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await logica.oauthLogin("google@demo.com", "Gugel");
  const ana = await logica.obtenerPerfil("ana@demo.com");
  assert.equal(ana.nombre, "Ana");
  assert.equal(ana.acceso, "email");
  assert.equal(ana.entrenos, 0);
  assert.equal(ana.records, 0);
  assert.equal(ana.objetivoSemanal, null);
  assert.ok(new Date(ana.desde).getTime() >= antes, "la fecha de alta sale del _id");
  assert.equal((await logica.obtenerPerfil("google@demo.com")).acceso, "google");
  await assert.rejects(() => logica.obtenerPerfil("nadie@demo.com"), /USUARIO_NO_EXISTE/);
});

test("oauth sobre una cuenta pendiente la deja como cuenta de Google", async () => {
  await logica.registrar("ana@demo.com", "secreta1", "Ana");
  await logica.oauthLogin("ana@demo.com", "Ana");
  assert.equal((await logica.obtenerPerfil("ana@demo.com")).acceso, "google");
});
