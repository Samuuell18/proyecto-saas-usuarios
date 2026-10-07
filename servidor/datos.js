// Capa de acceso a datos (en memoria por ahora).
// Solo este modulo toca el almacen. La logica nunca toca `usuarios` directamente.
// En el Hito 3 se cambiara por SQLite/Postgres manteniendo la misma interfaz.

export const usuarios = [];

export function buscarPorEmail(email) {
  return usuarios.find((u) => u.email === email) ?? null;
}

export function guardar(usuario) {
  usuarios.push(usuario);
  return usuario;
}

export function listar() {
  return [...usuarios];
}

export function eliminarPorEmail(email) {
  const i = usuarios.findIndex((u) => u.email === email);
  if (i === -1) return false;
  usuarios.splice(i, 1);
  return true;
}

export function limpiar() {
  usuarios.length = 0;
}
