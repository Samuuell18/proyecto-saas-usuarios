// Capa de comunicacion: la UNICA que habla con el servidor (fetch a la API).
// El controlador nunca hace fetch directo.

async function postJson(url, cuerpo) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: datos.error ?? "Petición no válida." };
  return { ok: true, datos };
}

export function apiRegistro(email, password) {
  return postJson("/api/registro", { email, password });
}

export function apiLogin(email, password) {
  return postJson("/api/login", { email, password });
}

export function apiReenviar(email) {
  return postJson("/api/reenviar", { email });
}

export function apiLogout() {
  return postJson("/api/logout", {});
}

export async function apiYo() {
  const res = await fetch("/api/yo");
  if (!res.ok) return { ok: false };
  return { ok: true, datos: await res.json() };
}

// Administración (el servidor devuelve 403 si no eres admin).
export async function apiUsuarios() {
  const res = await fetch("/api/usuarios");
  if (!res.ok) return { ok: false, error: (await res.json().catch(() => ({}))).error };
  return { ok: true, datos: await res.json() };
}

// Ejercicios (T-32). El servidor decide qué ve cada uno (base + propios).
async function getJson(url) {
  const res = await fetch(url);
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: datos.error ?? "Petición no válida." };
  return { ok: true, datos };
}

export function apiEjercicios() {
  return getJson("/api/ejercicios");
}

export function apiGrupos() {
  return getJson("/api/ejercicios/grupos");
}

export function apiCrearEjercicio({ nombre, familia, grupo }) {
  return postJson("/api/ejercicios", { nombre, familia, grupo });
}

// Rutinas (T-35). PUT y DELETE con el mismo formato de respuesta que el resto.
async function enviarJson(metodo, url, cuerpo) {
  const res = await fetch(url, {
    method: metodo,
    headers: cuerpo ? { "Content-Type": "application/json" } : {},
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: datos.error ?? "Petición no válida." };
  return { ok: true, datos };
}

export function apiRutinas() {
  return getJson("/api/rutinas");
}

export function apiRutina(id) {
  return getJson(`/api/rutinas/${encodeURIComponent(id)}`);
}

export function apiCrearRutina({ nombre, ejercicios }) {
  return postJson("/api/rutinas", { nombre, ejercicios });
}

export function apiActualizarRutina(id, { nombre, ejercicios }) {
  return enviarJson("PUT", `/api/rutinas/${encodeURIComponent(id)}`, { nombre, ejercicios });
}

export function apiEliminarRutina(id) {
  return enviarJson("DELETE", `/api/rutinas/${encodeURIComponent(id)}`);
}

export async function apiEliminar(email) {
  const res = await fetch(`/api/usuarios/${encodeURIComponent(email)}`, { method: "DELETE" });
  if (!res.ok) return { ok: false, error: (await res.json().catch(() => ({}))).error };
  return { ok: true, datos: await res.json() };
}
