// Capa de acceso a datos sobre MongoDB Atlas (mi_bbdd externa).
// Es el UNICO modulo que habla con la BBDD. Mantiene la misma interfaz
// que la version en memoria, mas actualizarEstado para persistir cambios.
// La logica nunca toca la coleccion directamente.

import MongoStore from "connect-mongo";
import { ObjectId } from "mongodb";
import { getDb, getCliente } from "./bd.js";
import { GRUPOS_MUSCULARES, EJERCICIOS_BASE } from "./catalogo-ejercicios.js";

// Almacén de sesiones de express-session en la colección `sesiones` (T-27).
// Vive aquí para que la API no toque la BBDD: `api.js` solo lo pide.
// Las sesiones caducan solas a los 14 días (índice TTL de connect-mongo).
export function crearAlmacenSesiones() {
  return MongoStore.create({
    clientPromise: getCliente(),
    dbName: process.env.MONGO_DB_NAME || undefined,
    collectionName: "sesiones",
  });
}

async function coleccion() {
  const db = await getDb();
  return db.collection("usuarios");
}

export async function buscarPorEmail(email) {
  return (await coleccion()).findOne({ email });
}

export async function guardar(usuario) {
  const { email, hash, estado, rol } = usuario;
  await (await coleccion()).insertOne({ email, hash, estado, rol });
  return usuario;
}

export async function listar() {
  return (await coleccion()).find({}).toArray();
}

export async function actualizarEstado(email, estado) {
  const r = await (await coleccion()).updateOne({ email }, { $set: { estado } });
  return r.matchedCount > 0;
}

// T-42: preferencia de unidad de peso ("kg" o "lb"). Los usuarios antiguos no tienen el campo.
export async function actualizarUnidadPeso(email, unidadPeso) {
  const r = await (await coleccion()).updateOne({ email }, { $set: { unidadPeso } });
  return r.matchedCount > 0;
}

export async function limpiar() {
  await (await coleccion()).deleteMany({});
  await (await coleccionTokens()).deleteMany({});
  // Sesiones guardadas por connect-mongo (T-27): también se vacían en los tests.
  await (await getDb()).collection("sesiones").deleteMany({});
  for (const nombre of COLECCIONES_FITNESS) {
    await (await coleccionFitness(nombre)).deleteMany({});
  }
}

// --- Modelo de datos de Forja (T-28). Índices en bd.js. ---
// `dueno` es el email del usuario (igual que la sesión). El peso siempre en kg.
//
// ejercicios: { nombre, grupo, dueno: null (base, lo ven todos) | email, creado }
// rutinas:    { dueno, nombre (único por usuario), creada, actualizada,
//               ejercicios: [{ ejercicioId, series, repeticiones: { min, max }, descansoSeg }] }  (objetivo; T-33)
// entrenos:   { dueno, rutinaId: id | null (libre), rutinaNombre (copia) | null, inicio, fin: null (en curso) | fecha,
//               series: [{ id, ejercicioId, nombre, pesoKg, repeticiones, hecha,
//                          objetivo: { min, max } | null, descansoSeg }] }  (T-36, D-20)
//
// Las series van DENTRO del entreno (se leen siempre juntas). En cada serie se copia
// el nombre del ejercicio: si luego se renombra o borra, el historial no cambia.
const COLECCIONES_FITNESS = ["ejercicios", "rutinas", "entrenos", "suscripciones"];

async function coleccionFitness(nombre) {
  return (await getDb()).collection(nombre);
}

// --- Ejercicios (T-30). Catálogo base en catalogo-ejercicios.js. ---

// Comparar textos sin distinguir mayúsculas (la misma regla que el índice único de bd.js).
const SIN_MAYUSCULAS = { locale: "es", strength: 2 };

// Lo que sale de esta capa: id como texto, sin detalles de MongoDB (_id).
function aEjercicio(doc) {
  return { id: String(doc._id), nombre: doc.nombre, familia: doc.familia, grupo: doc.grupo, dueno: doc.dueno };
}

export function gruposMusculares() {
  return [...GRUPOS_MUSCULARES];
}

// Inserta los ejercicios base que falten y actualiza familia y grupo de los que ya están.
// Idempotente: ejecutarlo una o cien veces deja lo mismo. Devuelve cuántos ha insertado.
export async function sembrarEjerciciosBase() {
  const operaciones = EJERCICIOS_BASE.flatMap(({ familia, grupo, nombres }) =>
    nombres.map((nombre) => ({
      updateOne: {
        filter: { dueno: null, nombre },
        update: { $set: { familia, grupo }, $setOnInsert: { creado: new Date() } },
        upsert: true,
      },
    }))
  );
  const r = await (await coleccionFitness("ejercicios")).bulkWrite(operaciones, { ordered: false });
  return r.upsertedCount;
}

// Los base (dueno null) y los propios de `email`; nunca los de otros usuarios.
export async function listarEjercicios(email) {
  const docs = await (await coleccionFitness("ejercicios"))
    .find({ dueno: { $in: [null, email] } })
    .collation(SIN_MAYUSCULAS)
    .sort({ grupo: 1, familia: 1, nombre: 1 })
    .toArray();
  return docs.map(aEjercicio);
}

// Busca entre los base y los propios de `email`, sin distinguir mayúsculas.
export async function buscarEjercicioPorNombre(email, nombre) {
  const doc = await (await coleccionFitness("ejercicios")).findOne(
    { dueno: { $in: [null, email] }, nombre },
    { collation: SIN_MAYUSCULAS }
  );
  return doc ? aEjercicio(doc) : null;
}

export async function guardarEjercicio({ nombre, familia, grupo, dueno }) {
  const doc = { nombre, familia, grupo, dueno, creado: new Date() };
  try {
    const r = await (await coleccionFitness("ejercicios")).insertOne(doc);
    return aEjercicio({ ...doc, _id: r.insertedId });
  } catch (err) {
    // 11000 = clave duplicada (índice único). Se traduce aquí para que la lógica no sepa de MongoDB.
    if (err.code === 11000) throw new Error("EJERCICIO_YA_EXISTE");
    throw err;
  }
}

// Tokens de confirmación de email (un uso: se borran al confirmar).
async function coleccionTokens() {
  const db = await getDb();
  return db.collection("confirmaciones");
}

export async function guardarToken(email, token) {
  await (await coleccionTokens()).insertOne({ email, token, creado: new Date() });
}

export async function buscarPorToken(token) {
  return (await coleccionTokens()).findOne({ token });
}

export async function eliminarTokensDe(email) {
  await (await coleccionTokens()).deleteMany({ email });
}

// Solo para tests: leer los tokens pendientes de un email.
export async function tokensDe(email) {
  const docs = await (await coleccionTokens()).find({ email }).toArray();
  return docs.map((d) => d.token);
}

// --- Rutinas (T-33). Las reglas (validar, nombre único, dueño) están en logica.js. ---

// Un id que llega de fuera puede ser cualquier texto: si no es un ObjectId válido,
// no existe ningún documento con ese id (null), en vez de lanzar un error de MongoDB.
function aObjectId(id) {
  const texto = String(id ?? "");
  return /^[0-9a-f]{24}$/i.test(texto) ? new ObjectId(texto) : null;
}

// Ejercicios con esos ids que `email` puede ver (base o suyos). Los ids raros se ignoran.
export async function buscarEjerciciosVisibles(email, ids) {
  const objetos = ids.map(aObjectId).filter(Boolean);
  const docs = await (await coleccionFitness("ejercicios"))
    .find({ _id: { $in: objetos }, dueno: { $in: [null, email] } })
    .toArray();
  return docs.map(aEjercicio);
}

function aRutina(doc) {
  return {
    id: String(doc._id),
    dueno: doc.dueno,
    nombre: doc.nombre,
    ejercicios: doc.ejercicios.map((e) => ({ ...e, ejercicioId: String(e.ejercicioId) })),
    creada: doc.creada,
    actualizada: doc.actualizada,
  };
}

// En la BBDD el ejercicio se guarda como ObjectId (referencia real); fuera, como texto.
function lineasParaGuardar(ejercicios) {
  return ejercicios.map((e) => ({ ...e, ejercicioId: aObjectId(e.ejercicioId) }));
}

// 11000 = nombre de rutina repetido para ese usuario (índice único de bd.js).
function traducirDuplicadoRutina(err) {
  if (err.code === 11000) return new Error("RUTINA_YA_EXISTE");
  return err;
}

export async function guardarRutina({ dueno, nombre, ejercicios }) {
  const ahora = new Date();
  const doc = { dueno, nombre, ejercicios: lineasParaGuardar(ejercicios), creada: ahora, actualizada: ahora };
  try {
    const r = await (await coleccionFitness("rutinas")).insertOne(doc);
    return aRutina({ ...doc, _id: r.insertedId });
  } catch (err) {
    throw traducirDuplicadoRutina(err);
  }
}

export async function listarRutinas(email) {
  const docs = await (await coleccionFitness("rutinas"))
    .find({ dueno: email })
    .collation(SIN_MAYUSCULAS)
    .sort({ nombre: 1 })
    .toArray();
  return docs.map(aRutina);
}

// Por id, sea de quien sea: decidir si el usuario puede verla es cosa de la lógica.
export async function buscarRutina(id) {
  const _id = aObjectId(id);
  if (!_id) return null;
  const doc = await (await coleccionFitness("rutinas")).findOne({ _id });
  return doc ? aRutina(doc) : null;
}

export async function buscarRutinaPorNombre(email, nombre) {
  const doc = await (await coleccionFitness("rutinas")).findOne(
    { dueno: email, nombre },
    { collation: SIN_MAYUSCULAS }
  );
  return doc ? aRutina(doc) : null;
}

export async function actualizarRutina(id, { nombre, ejercicios }) {
  try {
    await (await coleccionFitness("rutinas")).updateOne(
      { _id: aObjectId(id) },
      { $set: { nombre, ejercicios: lineasParaGuardar(ejercicios), actualizada: new Date() } }
    );
  } catch (err) {
    throw traducirDuplicadoRutina(err);
  }
  return buscarRutina(id);
}

export async function eliminarRutina(id) {
  const r = await (await coleccionFitness("rutinas")).deleteOne({ _id: aObjectId(id) });
  return r.deletedCount > 0;
}

// --- Entrenos (T-36). Las reglas (uno en curso, validar series, terminar) están en logica.js.
// Aquí solo se lee y se guarda el documento entero: las series van dentro. ---

function aEntreno(doc) {
  return {
    id: String(doc._id),
    dueno: doc.dueno,
    rutinaId: doc.rutinaId ? String(doc.rutinaId) : null,
    rutinaNombre: doc.rutinaNombre ?? null,
    inicio: doc.inicio,
    fin: doc.fin,
    series: doc.series.map((s) => ({ ...s, ejercicioId: String(s.ejercicioId) })),
  };
}

function seriesParaGuardar(series) {
  return series.map((s) => ({ ...s, ejercicioId: aObjectId(s.ejercicioId) }));
}

export async function guardarEntreno({ dueno, rutinaId, rutinaNombre, inicio, series }) {
  const doc = { dueno, rutinaId: rutinaId ? aObjectId(rutinaId) : null, rutinaNombre, inicio, fin: null, series: seriesParaGuardar(series) };
  try {
    const r = await (await coleccionFitness("entrenos")).insertOne(doc);
    return aEntreno({ ...doc, _id: r.insertedId });
  } catch (err) {
    // 11000 = ya hay un entreno en curso para ese usuario (índice parcial de bd.js).
    if (err.code === 11000) throw new Error("ENTRENO_EN_CURSO");
    throw err;
  }
}

export async function buscarEntrenoEnCurso(email) {
  const doc = await (await coleccionFitness("entrenos")).findOne({ dueno: email, fin: null });
  return doc ? aEntreno(doc) : null;
}

// Solo cambia si sigue en curso: un entreno terminado no se toca desde aquí.
export async function actualizarSeriesEntreno(id, series) {
  await (await coleccionFitness("entrenos")).updateOne(
    { _id: aObjectId(id), fin: null },
    { $set: { series: seriesParaGuardar(series) } }
  );
}

export async function terminarEntreno(id, { fin, series }) {
  await (await coleccionFitness("entrenos")).updateOne(
    { _id: aObjectId(id), fin: null },
    { $set: { fin, series: seriesParaGuardar(series) } }
  );
}

// --- T-44. Historial: los entrenos terminados (fin distinto de null), del más reciente al más
// antiguo. Usa el índice {dueno, inicio: -1} de bd.js. ---
export async function listarEntrenosTerminados(email) {
  const docs = await (await coleccionFitness("entrenos"))
    .find({ dueno: email, fin: { $ne: null } })
    .sort({ inicio: -1 })
    .toArray();
  return docs.map(aEntreno);
}

// Sin filtrar por dueño (como buscarRutina): la regla de propiedad está en logica.js.
// Un id que no es válido devuelve null, no un error.
export async function buscarEntreno(id) {
  const _id = aObjectId(id);
  if (!_id) return null;
  const doc = await (await coleccionFitness("entrenos")).findOne({ _id });
  return doc ? aEntreno(doc) : null;
}

export async function eliminarEntreno(id) {
  const r = await (await coleccionFitness("entrenos")).deleteOne({ _id: aObjectId(id) });
  return r.deletedCount > 0;
}

// --- Suscripciones a notificaciones push (T-55). Una por móvil (endpoint único): si en ese
// móvil entra otro usuario, la suscripción pasa a ser suya. ---
// suscripciones: { dueno, endpoint, claves: { p256dh, auth }, creada, actualizada }

export async function guardarSuscripcion({ dueno, endpoint, claves }, ahora = new Date()) {
  await (await coleccionFitness("suscripciones")).updateOne(
    { endpoint },
    { $set: { dueno, claves, actualizada: ahora }, $setOnInsert: { creada: ahora } },
    { upsert: true }
  );
}

// En el formato que pide web-push: { endpoint, keys: { p256dh, auth } }.
export async function listarSuscripciones(email) {
  const docs = await (await coleccionFitness("suscripciones")).find({ dueno: email }).toArray();
  return docs.map((d) => ({ endpoint: d.endpoint, keys: { ...d.claves } }));
}

// Con `dueno`, solo borra si es suya (lo que pide el usuario); sin él, la borra igual
// (lo hace la lógica cuando el servicio de avisos dice que ya no existe).
export async function eliminarSuscripcion(endpoint, dueno) {
  const filtro = dueno === undefined ? { endpoint } : { endpoint, dueno };
  const r = await (await coleccionFitness("suscripciones")).deleteOne(filtro);
  return r.deletedCount > 0;
}
