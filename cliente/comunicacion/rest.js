// Capa de comunicacion: la UNICA que habla con el servidor (fetch a la API).
// La capa de presentación (cliente/presentacion/) nunca hace fetch directo.
//
// Todas las funciones devuelven SIEMPRE { ok: true, datos } o { ok: false, status, error }: nunca
// lanzan. Sin cobertura (en el gimnasio pasa) `fetch` no devuelve un 4xx/5xx sino que LANZA un
// error; antes nadie lo recogía y la pantalla se quedaba como si se hubiera guardado (el tic de una
// serie, por ejemplo) sin ningún aviso. Ahora ese caso es un fallo más, con status 0.

export const ERROR_SIN_CONEXION = "Sin conexión con el servidor. Revisa tu red y vuelve a probar.";

function sinConexion() {
  return { ok: false, status: 0, error: ERROR_SIN_CONEXION };
}

// El único sitio que llama a fetch. Si la red falla (antes de responder o a mitad de la respuesta),
// sinConexion(). Si el servidor responde con error, su mensaje (o uno genérico).
async function pedir(url, opciones) {
  let res;
  try {
    res = await fetch(url, opciones);
  } catch {
    return sinConexion();
  }
  let datos;
  try {
    datos = await res.json();
  } catch {
    datos = undefined; // cuerpo vacío, que no es JSON o cortado a medias
  }
  if (!res.ok) return { ok: false, status: res.status, error: datos?.error ?? "Petición no válida." };
  // Un 200 sin cuerpo legible: la respuesta se cortó por el camino, no se sabe qué ha guardado.
  if (datos === undefined) return sinConexion();
  return { ok: true, datos };
}

function postJson(url, cuerpo) {
  return pedir(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

export function apiRegistro(email, password, nombre) {
  return postJson("/api/registro", { email, password, nombre });
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

export function apiYo() {
  return getJson("/api/yo");
}

// Ajustes (T-43): unidad de peso preferida, "kg" o "lb".
export function apiCambiarUnidad(unidad) {
  return enviarJson("PUT", "/api/yo/unidad", { unidad });
}

// T-61: todo lo de la pantalla "Hoy" del inicio en una sola petición.
export function apiHoy() {
  return getJson("/api/hoy");
}

// T-88: todo lo de la página de Perfil en una sola petición.
export function apiPerfil() {
  return getJson("/api/perfil");
}

// T-90: "¿Olvidaste tu contraseña?": pedir el enlace y, con él, poner la nueva.
export function apiPedirRecuperacion(email) {
  return enviarJson("POST", "/api/recuperar", { email });
}

export function apiRestablecerPassword(token, nueva) {
  return enviarJson("POST", "/api/recuperar/nueva", { token, nueva });
}

// T-89: cambiar la contraseña (hay que dar la actual).
export function apiCambiarPassword(actual, nueva) {
  return enviarJson("PUT", "/api/yo/password", { actual, nueva });
}

// T-87: cuántos días a la semana quiere entrenar (1 a 7).
export function apiCambiarObjetivo(objetivo) {
  return enviarJson("PUT", "/api/yo/objetivo", { objetivo });
}

// T-60: nombre del usuario.
export function apiCambiarNombre(nombre) {
  return enviarJson("PUT", "/api/yo/nombre", { nombre });
}

// Administración (el servidor devuelve 403 si no eres admin).
export function apiUsuarios() {
  return getJson("/api/usuarios");
}

// Ejercicios (T-32). El servidor decide qué ve cada uno (base + propios).
function getJson(url) {
  return pedir(url);
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
function enviarJson(metodo, url, cuerpo) {
  return pedir(url, {
    method: metodo,
    headers: cuerpo ? { "Content-Type": "application/json" } : {},
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
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

// Entreno en vivo (T-38). Solo hay uno en curso por usuario: las rutas usan "actual".
export function apiEntrenoActual() {
  return getJson("/api/entrenos/actual");
}

export function apiIniciarEntreno(rutinaId = null) {
  return postJson("/api/entrenos", rutinaId ? { rutinaId } : {});
}

export function apiAnadirSerie({ ejercicioId, despuesDe }) {
  return postJson("/api/entrenos/actual/series", { ejercicioId, despuesDe });
}

// El peso va en la unidad del usuario (kg o lb); el servidor lo pasa a kg (T-43).
export function apiActualizarSerie(serieId, { peso, repeticiones, hecha }) {
  return enviarJson("PUT", `/api/entrenos/actual/series/${encodeURIComponent(serieId)}`, { peso, repeticiones, hecha });
}

export function apiEliminarSerie(serieId) {
  return enviarJson("DELETE", `/api/entrenos/actual/series/${encodeURIComponent(serieId)}`);
}

export function apiTerminarEntreno() {
  return postJson("/api/entrenos/actual/terminar", {});
}

export function apiDescartarEntreno() {
  return enviarJson("DELETE", "/api/entrenos/actual");
}

// Historial (T-45): entrenos terminados. El servidor solo devuelve los del usuario de la sesión.
export function apiHistorial() {
  return getJson("/api/entrenos");
}

export function apiEntreno(id) {
  return getJson(`/api/entrenos/${encodeURIComponent(id)}`);
}

export function apiBorrarEntreno(id) {
  return enviarJson("DELETE", `/api/entrenos/${encodeURIComponent(id)}`);
}

// Métricas de progreso (T-48). Pesos y volúmenes ya en la unidad del usuario.
export function apiMetricas() {
  return getJson("/api/metricas");
}

export function apiProgresoEjercicio(ejercicioId) {
  return getJson(`/api/metricas/ejercicios/${encodeURIComponent(ejercicioId)}`);
}

// Notificaciones push (T-55). La suscripción la crea el navegador; aquí solo se manda al servidor.
export function apiClaveAvisos() {
  return getJson("/api/avisos/clave");
}

export function apiActivarAvisos(suscripcion) {
  return postJson("/api/avisos/suscripcion", { suscripcion });
}

export function apiDesactivarAvisos(endpoint) {
  return enviarJson("DELETE", "/api/avisos/suscripcion", { endpoint });
}

// T-56: el servidor avisa al terminar el descanso (aunque el móvil esté bloqueado).
export function apiProgramarAvisoDescanso(fin) {
  return enviarJson("PUT", "/api/avisos/descanso", { fin });
}

export function apiCancelarAvisoDescanso() {
  return enviarJson("DELETE", "/api/avisos/descanso");
}

export function apiAvisoPrueba() {
  return postJson("/api/avisos/prueba", {});
}

export function apiEliminar(email) {
  return enviarJson("DELETE", `/api/usuarios/${encodeURIComponent(email)}`);
}
