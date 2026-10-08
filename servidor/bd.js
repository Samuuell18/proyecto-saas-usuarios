// Conexion con MongoDB Atlas (mi_bbdd externa).
// Es el UNICO sitio que conoce la URI y habla con el cluster.
// `datos.js` pide aqui la coleccion; `logica.js` nunca toca esto.

import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let cliente = null;

export async function getDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en el .env");
  }
  if (!cliente) {
    cliente = new MongoClient(process.env.MONGODB_URI);
    await cliente.connect();
    // El email identifica al usuario: la BBDD rechaza duplicados.
    await cliente.db().collection("usuarios").createIndex({ email: 1 }, { unique: true });
  }
  return cliente.db();
}

export async function cerrar() {
  if (cliente) {
    await cliente.close();
    cliente = null;
  }
}
