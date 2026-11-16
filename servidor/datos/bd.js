// Conexion con MongoDB Atlas (mi_bbdd externa).
// Es el UNICO sitio que conoce la URI y habla con el cluster.
// `datos.js` pide aqui la coleccion; `logica.js` nunca toca esto.

import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let cliente = null;

// Cliente conectado y compartido: lo usan `getDb()` y el almacén de sesiones (T-27).
export async function getCliente() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en el .env");
  }
  if (!cliente) {
    cliente = new MongoClient(process.env.MONGODB_URI);
    await cliente.connect();
  }
  return cliente;
}

// Bases a las que ya se les han creado los índices en este proceso.
const basesPreparadas = new Set();

export async function getDb() {
  const cliente = await getCliente();
  // MONGO_DB_NAME permite apuntar a otra base (los tests usan fitness_hub_test).
  const db = cliente.db(process.env.MONGO_DB_NAME || undefined);
  // Los índices se crean UNA vez por base, no en cada consulta (cada createIndex es una petición a Atlas).
  if (!basesPreparadas.has(db.databaseName)) {
    await crearIndices(db);
    basesPreparadas.add(db.databaseName);
  }
  return db;
}

// Todos los índices en un solo sitio. Si ya existen, MongoDB no hace nada.
async function crearIndices(db) {
  // El email identifica al usuario: la BBDD rechaza duplicados.
  await db.collection("usuarios").createIndex({ email: 1 }, { unique: true });
  // T-28. Un usuario no repite nombre de ejercicio (dueno null = ejercicios base).
  // La collation compara sin distinguir mayúsculas: "Press banca" = "press banca".
  await db
    .collection("ejercicios")
    .createIndex({ dueno: 1, nombre: 1 }, { unique: true, collation: { locale: "es", strength: 2 } });
  // T-33. Un usuario no repite nombre de rutina (sin distinguir mayúsculas).
  // Empieza por `dueno`, así que también sirve para listar las rutinas de un usuario.
  await db
    .collection("rutinas")
    .createIndex({ dueno: 1, nombre: 1 }, { unique: true, collation: { locale: "es", strength: 2 } });
  // Historial de un usuario, del entreno más reciente al más antiguo.
  await db.collection("entrenos").createIndex({ dueno: 1, inicio: -1 });
  // T-36. Un solo entreno EN CURSO por usuario: el índice único solo cuenta los que
  // tienen `fin` a null (índice parcial). Los terminados no chocan entre sí.
  await db
    .collection("entrenos")
    .createIndex({ dueno: 1 }, { unique: true, partialFilterExpression: { fin: { $type: "null" } } });
  // T-55. Una suscripción push por móvil (su endpoint es único) y búsqueda por usuario.
  await db.collection("suscripciones").createIndex({ endpoint: 1 }, { unique: true });
  await db.collection("suscripciones").createIndex({ dueno: 1 });
}

export async function cerrar() {
  if (cliente) {
    await cliente.close();
    cliente = null;
    basesPreparadas.clear();
  }
}
