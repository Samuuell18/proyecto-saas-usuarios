// Capa de comunicacion: la UNICA que habla con el servidor (fetch a la API).
// El controlador nunca hace fetch directo.

async function postJson(url, cuerpo) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: datos.error ?? "Petición no válida." };
  return { ok: true, datos };
}

export function apiRegistro(email, password) {
  return postJson("/api/registro", { email, password });
}

export function apiLogin(email, password) {
  return postJson("/api/login", { email, password });
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

export async function apiEliminar(email) {
  const res = await fetch(`/api/usuarios/${encodeURIComponent(email)}`, { method: "DELETE" });
  if (!res.ok) return { ok: false, error: (await res.json().catch(() => ({}))).error };
  return { ok: true, datos: await res.json() };
}
