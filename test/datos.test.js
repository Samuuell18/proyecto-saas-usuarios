// Tests de la capa de datos: colecciones de Fitness Hub e índices (T-28).
// Base propia: cada fichero de test corre en paralelo y no deben pisarse.
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import * as datos from "../servidor/datos.js";
import { getDb, cerrar } from "../servidor/bd.js";

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
  assert.ok((await indices("rutinas")).includes("dueno"));
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

test("limpiar vacía también las colecciones de Fitness Hub", async () => {
  const db = await getDb();
  await db.collection("rutinas").insertOne({ dueno: "ana@demo.com", nombre: "Pierna A", ejercicios: [] });
  await db.collection("entrenos").insertOne({ dueno: "ana@demo.com", rutinaId: null, inicio: new Date(), fin: null, series: [] });
  await datos.limpiar();
  assert.equal(await db.collection("rutinas").countDocuments(), 0);
  assert.equal(await db.collection("entrenos").countDocuments(), 0);
});
