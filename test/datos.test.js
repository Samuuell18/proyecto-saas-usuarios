// Tests de la capa de datos: colecciones de Forja e índices (T-28).
// Base propia: cada fichero de test corre en paralelo y no deben pisarse.
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import * as datos from "../servidor/datos/datos.js";
import { getDb, cerrar } from "../servidor/datos/bd.js";
import { GRUPOS_MUSCULARES, EJERCICIOS_BASE } from "../servidor/datos/catalogo-ejercicios.js";

process.env.MONGO_DB_NAME = "fitness_hub_test_datos";

beforeEach(() => datos.limpiar());
after(async () => {
  await datos.limpiar();
  await cerrar();
});

// Devuelve las claves de los índices de una colección, p. ej. ["_id", "dueno,inicio"].
async function indices(nombre) {
  const lista = await (await getDb()).collection(nombre).indexes();
  return lista.map((i) => Object.keys(i.key).join(","));
}

test("existen los índices de ejercicios, rutinas y entrenos", async () => {
  assert.ok((await indices("ejercicios")).includes("dueno,nombre"));
  assert.ok((await indices("rutinas")).includes("dueno,nombre"));
  assert.ok((await indices("entrenos")).includes("dueno,inicio"));
});

test("un usuario no puede repetir nombre de ejercicio (sin distinguir mayúsculas)", async () => {
  const ejercicios = (await getDb()).collection("ejercicios");
  await ejercicios.insertOne({ nombre: "Press banca", grupo: "pecho", dueno: "ana@demo.com" });
  await assert.rejects(
    () => ejercicios.insertOne({ nombre: "press BANCA", grupo: "pecho", dueno: "ana@demo.com" }),
    (err) => err.code === 11000 // código de MongoDB para "clave duplicada"
  );
});

test("el mismo nombre sí vale para otro usuario y para los ejercicios base", async () => {
  const ejercicios = (await getDb()).collection("ejercicios");
  await ejercicios.insertOne({ nombre: "Press banca", grupo: "pecho", dueno: null });
  await ejercicios.insertOne({ nombre: "Press banca", grupo: "pecho", dueno: "ana@demo.com" });
  await ejercicios.insertOne({ nombre: "Press banca", grupo: "pecho", dueno: "luis@demo.com" });
  assert.equal(await ejercicios.countDocuments(), 3);
});

test("limpiar vacía también las colecciones de Forja", async () => {
  const db = await getDb();
  await db.collection("rutinas").insertOne({ dueno: "ana@demo.com", nombre: "Pierna A", ejercicios: [] });
  await db.collection("entrenos").insertOne({ dueno: "ana@demo.com", rutinaId: null, inicio: new Date(), fin: null, series: [] });
  await datos.limpiar();
  assert.equal(await db.collection("rutinas").countDocuments(), 0);
  assert.equal(await db.collection("entrenos").countDocuments(), 0);
});

// --- T-30: catálogo de ejercicios base ---

const NOMBRES_BASE = EJERCICIOS_BASE.flatMap((f) => f.nombres);

test("catálogo: sin nombres repetidos (sin distinguir mayúsculas) y con grupos válidos", () => {
  const claves = NOMBRES_BASE.map((n) => n.toLocaleLowerCase("es"));
  assert.equal(new Set(claves).size, claves.length);
  for (const f of EJERCICIOS_BASE) assert.ok(GRUPOS_MUSCULARES.includes(f.grupo), f.familia);
  assert.ok(NOMBRES_BASE.length >= 150);
});

test("sembrar ejercicios base es idempotente", async () => {
  assert.equal(await datos.sembrarEjerciciosBase(), NOMBRES_BASE.length);
  assert.equal(await datos.sembrarEjerciciosBase(), 0);
  const ejercicios = (await getDb()).collection("ejercicios");
  assert.equal(await ejercicios.countDocuments({ dueno: null }), NOMBRES_BASE.length);
});

test("listar ejercicios devuelve los base y los propios, nunca los de otros", async () => {
  await datos.sembrarEjerciciosBase();
  await datos.guardarEjercicio({ nombre: "Mío", familia: "Mío", grupo: "core", dueno: "ana@demo.com" });
  await datos.guardarEjercicio({ nombre: "De Luis", familia: "De Luis", grupo: "core", dueno: "luis@demo.com" });
  const lista = await datos.listarEjercicios("ana@demo.com");
  assert.equal(lista.length, NOMBRES_BASE.length + 1);
  assert.ok(lista.some((e) => e.nombre === "Mío"));
  assert.ok(!lista.some((e) => e.nombre === "De Luis"));
  assert.equal(typeof lista[0].id, "string");
});

test("guardar un ejercicio repetido da EJERCICIO_YA_EXISTE (no el error de MongoDB)", async () => {
  await datos.guardarEjercicio({ nombre: "Mío", familia: "Mío", grupo: "core", dueno: "ana@demo.com" });
  await assert.rejects(
    () => datos.guardarEjercicio({ nombre: "MÍO", familia: "Mío", grupo: "core", dueno: "ana@demo.com" }),
    /EJERCICIO_YA_EXISTE/
  );
});

test("un usuario no puede repetir nombre de rutina (sin distinguir mayúsculas)", async () => {
  await datos.guardarRutina({ dueno: "ana@demo.com", nombre: "Pecho lunes", ejercicios: [] });
  await assert.rejects(
    () => datos.guardarRutina({ dueno: "ana@demo.com", nombre: "PECHO LUNES", ejercicios: [] }),
    /RUTINA_YA_EXISTE/
  );
  // Otro usuario sí puede.
  await datos.guardarRutina({ dueno: "luis@demo.com", nombre: "Pecho lunes", ejercicios: [] });
});

test("buscar una rutina con un id que no es válido devuelve null (no un error)", async () => {
  assert.equal(await datos.buscarRutina("no-es-un-id"), null);
  assert.equal(await datos.buscarRutina("aaaaaaaaaaaaaaaaaaaaaaaa"), null);
});

// --- T-36: entrenos ---

test("entrenos: solo uno en curso por usuario; los terminados no cuentan", async () => {
  const entrenos = (await getDb()).collection("entrenos");
  const nuevo = (dueno) => datos.guardarEntreno({ dueno, rutinaId: null, rutinaNombre: null, inicio: new Date(), series: [] });
  const primero = await nuevo("ana@demo.com");
  await assert.rejects(() => nuevo("ana@demo.com"), /ENTRENO_EN_CURSO/);
  await nuevo("luis@demo.com");
  await datos.terminarEntreno(primero.id, { fin: new Date(), series: [] });
  await nuevo("ana@demo.com");
  assert.equal(await entrenos.countDocuments({ dueno: "ana@demo.com" }), 2);
  assert.equal((await datos.buscarEntrenoEnCurso("ana@demo.com")).fin, null);
});

// --- T-44: historial ---

test("historial: solo los terminados del usuario, del más reciente al más antiguo", async () => {
  const nuevo = (dueno, inicio) => datos.guardarEntreno({ dueno, rutinaId: null, rutinaNombre: null, inicio, series: [] });
  const viejo = await nuevo("ana@demo.com", new Date("2026-11-01T10:00:00Z"));
  await datos.terminarEntreno(viejo.id, { fin: new Date("2026-11-01T11:00:00Z"), series: [] });
  const reciente = await nuevo("ana@demo.com", new Date("2026-11-10T10:00:00Z"));
  await datos.terminarEntreno(reciente.id, { fin: new Date("2026-11-10T11:00:00Z"), series: [] });
  await nuevo("ana@demo.com", new Date()); // en curso: no sale
  const ajeno = await nuevo("luis@demo.com", new Date("2026-11-05T10:00:00Z"));
  await datos.terminarEntreno(ajeno.id, { fin: new Date("2026-11-05T11:00:00Z"), series: [] });

  const lista = await datos.listarEntrenosTerminados("ana@demo.com");
  assert.deepEqual(lista.map((e) => e.id), [reciente.id, viejo.id]);
  assert.equal((await datos.buscarEntreno(ajeno.id)).dueno, "luis@demo.com"); // buscar no filtra: lo hace la lógica
  assert.equal(await datos.buscarEntreno("no-es-un-id"), null);
  assert.equal(await datos.buscarEntreno("aaaaaaaaaaaaaaaaaaaaaaaa"), null);
});
