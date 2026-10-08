// Capa de logica de negocio: gestion de usuarios.
// No toca la BBDD directamente, solo usa `datos.js` (ahora async sobre Atlas).
// Estados: pendiente (recien registrado, no puede entrar) -> activo -> eliminado.

import bcrypt from "bcryptjs";
import * as datos from "./datos.js";

export async function registrar(email, password) {
  const emailLimpio = String(email ?? "").trim().toLowerCase();
  if (!emailLimpio.includes("@")) {
    throw new Error("EMAIL_INVALIDO");
  }
  if (String(password ?? "").length < 6) {
    throw new Error("PASSWORD_CORTA");
  }
  if (await datos.buscarPorEmail(emailLimpio)) {
    throw new Error("EMAIL_YA_EXISTE");
  }
  const hash = bcrypt.hashSync(String(password), 10);
  const usuario = { email: emailLimpio, hash, estado: "pendiente", rol: "usuario" };
  await datos.guardar(usuario);
  return { email: usuario.email, estado: usuario.estado, rol: usuario.rol };
}

export async function activar(email) {
  const limpio = String(email ?? "").trim().toLowerCase();
  const usuario = await datos.buscarPorEmail(limpio);
  if (!usuario) throw new Error("USUARIO_NO_EXISTE");
  // En BBDD la mutacion directa se pierde: se persiste via datos.
  await datos.actualizarEstado(limpio, "activo");
  return { email: usuario.email, estado: "activo", rol: usuario.rol };
}

export async function comprobarActivo(email) {
  const usuario = await datos.buscarPorEmail(String(email ?? "").trim().toLowerCase());
  return usuario?.estado === "activo";
}

export async function iniciarSesion(email, password) {
  const usuario = await datos.buscarPorEmail(String(email ?? "").trim().toLowerCase());
  if (!usuario) throw new Error("CREDENCIALES_INVALIDAS");
  if (usuario.estado === "pendiente") throw new Error("CUENTA_PENDIENTE");
  if (usuario.estado !== "activo") throw new Error("CREDENCIALES_INVALIDAS");
  if (!bcrypt.compareSync(String(password ?? ""), usuario.hash)) {
    throw new Error("CREDENCIALES_INVALIDAS");
  }
  return { email: usuario.email, estado: usuario.estado, rol: usuario.rol };
}

export async function eliminar(email) {
  return datos.eliminarPorEmail(String(email ?? "").trim().toLowerCase());
}

export async function listar() {
  const todos = await datos.listar();
  return todos.map((u) => ({ email: u.email, estado: u.estado, rol: u.rol }));
}
