// Capa de acceso a datos sobre MongoDB Atlas (mi_bbdd externa).
// Es el UNICO modulo que habla con la BBDD. Mantiene la misma interfaz
// que la version en memoria, mas actualizarEstado para persistir cambios.
// La logica nunca toca la coleccion directamente.

import { getDb } from "./bd.js";

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

export async function limpiar() {
  await (await coleccion()).deleteMany({});
  await (await coleccionTokens()).deleteMany({});
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
