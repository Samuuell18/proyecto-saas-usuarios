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

export async function eliminarPorEmail(email) {
  const r = await (await coleccion()).deleteOne({ email });
  return r.deletedCount > 0;
}

export async function actualizarEstado(email, estado) {
  const r = await (await coleccion()).updateOne({ email }, { $set: { estado } });
  return r.matchedCount > 0;
}

export async function limpiar() {
  await (await coleccion()).deleteMany({});
}
