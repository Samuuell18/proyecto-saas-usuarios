// Capa de logica de negocio: gestion de usuarios.
// No toca la BBDD directamente, solo usa `datos.js` (ahora async sobre Atlas).
// Estados: pendiente (recien registrado, no puede entrar) -> activo -> eliminado.
// Eliminar es un borrado LOGICO: la cuenta se queda con estado "eliminado",
// asi el email no se puede reutilizar ni volver a entrar (tampoco por OAuth).

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import * as datos from "./datos/datos.js";
import * as log from "./servicios/log.js";
import { enviarConfirmacion } from "./servicios/correo.js";
import * as push from "./servicios/push.js";

// Almacén de sesiones (T-27): lo crea la capa de datos; aquí solo se pasa a la API
// para respetar la cadena api → lógica → datos (la API nunca importa datos.js).
export { crearAlmacenSesiones } from "./datos/datos.js";

// T-60: el nombre con el que la app saluda. Función pura: quita espacios de sobra
// ("  Ana   María " -> "Ana María") y exige de 2 a 40 caracteres.
export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 40;
export function normalizarNombre(nombre) {
  const limpio = String(nombre ?? "").trim().replace(/\s+/g, " ");
  if (limpio.length < NOMBRE_MIN || limpio.length > NOMBRE_MAX) throw new Error("NOMBRE_USUARIO_INVALIDO");
  return limpio;
}

// Igual, pero para lo que manda un proveedor OAuth: si no vale, se deja sin nombre
// (null) y la app se lo pedirá al usuario. Se recorta a 40 por si es muy largo.
export function nombreDeProveedor(nombre) {
  try {
    return normalizarNombre(String(nombre ?? "").trim().slice(0, NOMBRE_MAX));
  } catch {
    return null;
  }
}

export const PASSWORD_MIN = 8;

// T-82 (A09-001): un email "de verdad": algo@algo.dominio, sin espacios ni saltos de línea y como
// mucho 254 caracteres. Antes bastaba con que tuviera una "@", y un email con saltos de línea podía
// falsificar líneas del log. Función pura.
export function emailValido(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function registrar(email, password, nombre) {
  const emailLimpio = String(email ?? "").trim().toLowerCase();
  if (!emailValido(emailLimpio)) {
    throw new Error("EMAIL_INVALIDO");
  }
  // T-77 (A07-002): mínimo 8 (antes 6). Las cuentas que ya existen siguen entrando con la suya.
  if (String(password ?? "").length < PASSWORD_MIN) {
    throw new Error("PASSWORD_CORTA");
  }
  const nombreLimpio = normalizarNombre(nombre);
  if (await datos.buscarPorEmail(emailLimpio)) {
    throw new Error("EMAIL_YA_EXISTE");
  }
  // Versión async: no bloquea el servidor mientras calcula el hash.
  const hash = await bcrypt.hash(String(password), 10);
  // Primer admin: no hay usuarios que lo nombren, así que lo decide el entorno.
  // Si el email coincide con ADMIN_EMAIL nace admin; el resto, usuario.
  const adminEmail = String(process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const rol = emailLimpio === adminEmail && adminEmail !== "" ? "admin" : "usuario";
  const usuario = { email: emailLimpio, nombre: nombreLimpio, hash, estado: "pendiente", rol, acceso: "email" };
  await datos.guardar(usuario);
  await crearYEnviarToken(emailLimpio);
  return { email: usuario.email, nombre: usuario.nombre, estado: usuario.estado, rol: usuario.rol };
}

// Genera un token nuevo, lo guarda y manda el correo.
// El registro (o el reenvío) NO falla si el correo falla: queda en el log.
async function crearYEnviarToken(email) {
  const token = crypto.randomBytes(32).toString("hex");
  await datos.guardarToken(email, token);
  try {
    await enviarConfirmacion(email, token);
  } catch (err) {
    log.error("email-fallido", err.message);
  }
}

// Reenviar el enlace de confirmación (T-26). Solo hace algo si la cuenta está pendiente:
// borra los enlaces anteriores (dejan de valer) y manda uno nuevo.
// Devuelve si se reenvió, pero la API no se lo dice al cliente, para no revelar
// qué emails tienen cuenta.
// T-77 (A06-001): entre dos correos al mismo email tiene que pasar al menos 1 minuto; si no,
// pulsando "Reenviar" sin parar se gastaba el cupo diario de Brevo y se llenaba el buzón de alguien.
export const ESPERA_REENVIO_MS = 60 * 1000;

// Función pura: ¿se puede mandar otro correo? `ultimo` = cuándo se creó el último enlace (o null).
export function puedeReenviar(ultimo, ahora = new Date()) {
  if (!ultimo) return true;
  return new Date(ahora).getTime() - new Date(ultimo).getTime() >= ESPERA_REENVIO_MS;
}

export async function reenviarConfirmacion(email, ahora = new Date()) {
  const limpio = String(email ?? "").trim().toLowerCase();
  const usuario = await datos.buscarPorEmail(limpio);
  if (usuario?.estado !== "pendiente") return false;
  if (!puedeReenviar(await datos.fechaUltimoToken(limpio), ahora)) return false;
  await datos.eliminarTokensDe(limpio);
  await crearYEnviarToken(limpio);
  return true;
}

export async function activar(email) {
  const limpio = String(email ?? "").trim().toLowerCase();
  const usuario = await datos.buscarPorEmail(limpio);
  // Una cuenta eliminada no se reactiva (ni con un enlace de confirmacion antiguo).
  if (!usuario || usuario.estado === "eliminado") throw new Error("USUARIO_NO_EXISTE");
  // En BBDD la mutacion directa se pierde: se persiste via datos.
  await datos.actualizarEstado(limpio, "activo");
  return { email: usuario.email, estado: "activo", rol: usuario.rol };
}

// El enlace de confirmación vale 24 horas desde que se crea.
export const CADUCIDAD_TOKEN_MS = 24 * 60 * 60 * 1000;

// Función pura: ¿ha pasado más tiempo del permitido desde `creado`?
export function tokenCaducado(creado, ahora = new Date()) {
  return ahora.getTime() - new Date(creado).getTime() > CADUCIDAD_TOKEN_MS;
}

// Confirmar cuenta con el token del email (un solo uso y con caducidad).
// `ahora` se puede pasar en los tests para simular que ha pasado el tiempo.
export async function confirmar(token, ahora = new Date()) {
  const registro = await datos.buscarPorToken(String(token ?? ""));
  if (!registro) throw new Error("TOKEN_INVALIDO");
  if (tokenCaducado(registro.creado, ahora)) throw new Error("TOKEN_CADUCADO");
  await datos.eliminarTokensDe(registro.email);
  return activar(registro.email);
}

export async function comprobarActivo(email) {
  const usuario = await datos.buscarPorEmail(String(email ?? "").trim().toLowerCase());
  return usuario?.estado === "activo";
}

// T-83 (A07-004): primero se comprueba la contraseña y DESPUÉS se dice si la cuenta está pendiente.
// Antes, "Cuenta pendiente" salía con cualquier contraseña, así que cualquiera podía saber qué emails
// se habían registrado. Si la cuenta no existe (o está eliminada) se calcula igualmente un bcrypt contra
// un hash de relleno: así la respuesta tarda lo mismo y el tiempo tampoco delata qué emails existen.
let hashDeRelleno = null;

export async function iniciarSesion(email, password) {
  const usuario = await datos.buscarPorEmail(String(email ?? "").trim().toLowerCase());
  const valida = usuario?.estado === "activo" || usuario?.estado === "pendiente";
  hashDeRelleno ??= await hashInutilizable();
  const correcta = await bcrypt.compare(String(password ?? ""), valida ? usuario.hash : hashDeRelleno);
  if (!valida || !correcta) throw new Error("CREDENCIALES_INVALIDAS");
  if (usuario.estado === "pendiente") throw new Error("CUENTA_PENDIENTE");
  return { email: usuario.email, estado: usuario.estado, rol: usuario.rol };
}

// Borrado logico. Devuelve false si la cuenta no existe o ya estaba eliminada.
export async function eliminar(email) {
  const limpio = String(email ?? "").trim().toLowerCase();
  const usuario = await datos.buscarPorEmail(limpio);
  if (!usuario || usuario.estado === "eliminado") return false;
  return datos.actualizarEstado(limpio, "eliminado");
}

// VARIANTE-6: estado de un usuario según la especificación.
// Función PURA: no accede a la base de datos, solo calcula.
// eliminado si ha sido eliminado, sea cual sea el resto;
// activo si es OAuth, o si es local y ha confirmado su correo;
// pendiente si es local y no lo ha confirmado. Solo el activo entra.
export function calcularEstado({ proveedor, confirmado, eliminado }) {
  if (proveedor !== "local" && proveedor !== "oauth") {
    throw new Error("PROVEEDOR_DESCONOCIDO");
  }
  if (typeof confirmado !== "boolean" || typeof eliminado !== "boolean") {
    throw new Error("CAMPOS_NO_BOOLEANOS");
  }
  let estado;
  if (eliminado) {
    estado = "eliminado";
  } else if (proveedor === "oauth" || confirmado) {
    estado = "activo";
  } else {
    estado = "pendiente";
  }
  return { estado, puedeIniciarSesion: estado === "activo" };
}

// Inicio con proveedor externo (OAuth): el usuario nace ACTIVO, sin confirmar.
// Si ya existe no se duplica: activa se devuelve tal cual, pendiente se activa
// (el proveedor ya verificó el email) y eliminada se rechaza.
// T-60: `nombre` es el que da el proveedor (puede faltar); solo se guarda si la cuenta no tenía.
export async function oauthLogin(email, nombre) {
  const emailLimpio = String(email ?? "").trim().toLowerCase();
  if (!emailValido(emailLimpio)) {
    throw new Error("EMAIL_INVALIDO");
  }
  const nombreLimpio = nombreDeProveedor(nombre);
  const existente = await datos.buscarPorEmail(emailLimpio);
  if (existente && existente.estado !== "eliminado" && !existente.nombre && nombreLimpio) {
    await datos.actualizarNombre(emailLimpio, nombreLimpio);
  }
  if (existente) {
    // El proveedor ya verificó el email: una pendiente se activa.
    // Una eliminada sigue sin entrar.
    if (existente.estado !== "activo") {
      if (existente.estado === "pendiente") {
        // T-76 (A07-001, pre-secuestro de cuenta): la contraseña y el nombre de una cuenta pendiente
        // los puso quien se registró, y nadie ha probado que fuera el dueño del email (podía ser otra
        // persona). El proveedor SÍ lo prueba, así que se descartan: contraseña inutilizable, nombre
        // del proveedor (o null: la app lo pedirá) y sin enlaces de confirmación pendientes.
        await datos.activarPorProveedor(emailLimpio, { hash: await hashInutilizable(), nombre: nombreLimpio });
        await datos.eliminarTokensDe(emailLimpio);
        return { email: existente.email, estado: "activo", rol: existente.rol };
      }
      throw new Error("CREDENCIALES_INVALIDAS");
    }
    return { email: existente.email, estado: existente.estado, rol: existente.rol };
  }
  const adminEmail = String(process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const rol = emailLimpio === adminEmail && adminEmail !== "" ? "admin" : "usuario";
  // Sin contraseña: hash aleatorio inutilizable para login local.
  await datos.guardar({ email: emailLimpio, nombre: nombreLimpio, hash: await hashInutilizable(), estado: "activo", rol, acceso: "google" });
  return { email: emailLimpio, estado: "activo", rol };
}

// Hash de una contraseña aleatoria que nadie conoce: con él no se puede entrar con email y contraseña.
function hashInutilizable() {
  return bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
}

export async function listar() {
  const todos = await datos.listar();
  return todos.map((u) => ({ email: u.email, nombre: u.nombre ?? null, estado: u.estado, rol: u.rol }));
}

// --- T-30. Catálogo de ejercicios. Los datos (base y grupos) viven en la capa de datos;
// aquí solo están las reglas. ---

// Al arrancar: deja en la BBDD los ejercicios base que falten.
export function prepararCatalogo() {
  return datos.sembrarEjerciciosBase();
}

export function gruposMusculares() {
  return datos.gruposMusculares();
}

// Lo que ve el usuario: `base` en vez del dueño (no hace falta enseñar emails).
function ejercicioPublico({ id, nombre, familia, grupo, dueno }) {
  return { id, nombre, familia, grupo, base: dueno === null };
}

// Base + propios del usuario (nunca los de otros).
export async function listarEjercicios(email) {
  return (await datos.listarEjercicios(email)).map(ejercicioPublico);
}

// Quita espacios sobrantes: "  press   raro " -> "press raro".
function limpiarTexto(texto) {
  return String(texto ?? "").trim().replace(/\s+/g, " ");
}

// Crear un ejercicio propio. `familia` es opcional: sirve para colgarlo como variante
// de una familia que ya existe (p. ej. "Press banca"); si no, es su propia familia.
export async function crearEjercicio(email, { nombre, familia, grupo } = {}) {
  const nombreLimpio = limpiarTexto(nombre);
  if (nombreLimpio.length < 2 || nombreLimpio.length > 60) throw new Error("NOMBRE_INVALIDO");
  const familiaLimpia = limpiarTexto(familia) || nombreLimpio;
  if (familiaLimpia.length > 60) throw new Error("NOMBRE_INVALIDO");
  if (!datos.gruposMusculares().includes(grupo)) throw new Error("GRUPO_INVALIDO");
  // Ni repetir uno propio ni copiar uno base (sin distinguir mayúsculas).
  if (await datos.buscarEjercicioPorNombre(email, nombreLimpio)) throw new Error("EJERCICIO_YA_EXISTE");
  const creado = await datos.guardarEjercicio({ nombre: nombreLimpio, familia: familiaLimpia, grupo, dueno: email });
  return ejercicioPublico(creado);
}

// --- T-29. Regla de propiedad: cada ejercicio, rutina o entreno es de su dueño. ---
// Función pura: recibe el recurso ya leído (o null) y el email de la sesión.
// - Propio: se devuelve.
// - Ajeno o inexistente: RECURSO_NO_EXISTE (404). Es el mismo error a propósito,
//   para no revelar que existe un recurso de otro usuario.
// - Ejercicio base (dueno null): todos lo ven, nadie lo modifica (RECURSO_SOLO_LECTURA, 403).
// El admin no tiene excepción: gestiona cuentas, no ve los entrenos de nadie.
export function comprobarAcceso(recurso, email, { modificar = false } = {}) {
  if (!recurso) throw new Error("RECURSO_NO_EXISTE");
  if (recurso.dueno === null) {
    if (modificar) throw new Error("RECURSO_SOLO_LECTURA");
    return recurso;
  }
  if (!email || recurso.dueno !== email) throw new Error("RECURSO_NO_EXISTE");
  return recurso;
}

// --- T-33. Rutinas: el plan (objetivo) de cada ejercicio. Lo que de verdad sale al entrenar
// (peso y repeticiones reales) se guarda en el entreno, no aquí. ---

export const DESCANSO_POR_DEFECTO = 90; // segundos; se podrá cambiar durante el entreno (PBI-14)

function enteroEntre(valor, min, max) {
  const n = Number(valor);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

// Función pura: valida y deja en un formato único una línea de la rutina.
// Repeticiones fijas (10) o rango ({ min: 8, max: 12 }); internamente siempre { min, max }.
export function normalizarLineaRutina(linea) {
  const series = enteroEntre(linea?.series, 1, 20);
  const reps = linea?.repeticiones;
  const min = enteroEntre(typeof reps === "object" && reps !== null ? reps.min : reps, 1, 100);
  const max = enteroEntre(typeof reps === "object" && reps !== null ? reps.max : reps, 1, 100);
  const descansoSeg =
    linea?.descansoSeg === undefined || linea?.descansoSeg === null || linea?.descansoSeg === ""
      ? DESCANSO_POR_DEFECTO
      : enteroEntre(linea.descansoSeg, 0, 600);
  const ejercicioId = String(linea?.ejercicioId ?? "");
  if (!ejercicioId || series === null || min === null || max === null || min > max || descansoSeg === null) {
    throw new Error("LINEA_RUTINA_INVALIDA");
  }
  return { ejercicioId, series, repeticiones: { min, max }, descansoSeg };
}

// Valida una rutina completa; los ejercicios tienen que existir y ser visibles para `email`.
async function validarRutina(email, { nombre, ejercicios } = {}) {
  const nombreLimpio = limpiarTexto(nombre);
  if (nombreLimpio.length < 2 || nombreLimpio.length > 60) throw new Error("NOMBRE_INVALIDO");
  if (!Array.isArray(ejercicios) || ejercicios.length < 1 || ejercicios.length > 30) {
    throw new Error("RUTINA_SIN_EJERCICIOS");
  }
  const lineas = ejercicios.map(normalizarLineaRutina);
  // Se puede repetir un ejercicio en la rutina: se comprueba cada id distinto una vez.
  const ids = [...new Set(lineas.map((l) => l.ejercicioId))];
  const visibles = await datos.buscarEjerciciosVisibles(email, ids);
  if (visibles.length !== ids.length) throw new Error("EJERCICIO_NO_VALIDO");
  return { nombre: nombreLimpio, ejercicios: lineas, visibles };
}

// Lo que ve el usuario: sin dueño, y cada línea con el nombre y el grupo del ejercicio.
function rutinaPublica(rutina, ejerciciosVisibles) {
  const porId = new Map(ejerciciosVisibles.map((e) => [e.id, e]));
  return {
    id: rutina.id,
    nombre: rutina.nombre,
    actualizada: rutina.actualizada,
    ejercicios: rutina.ejercicios.map((l) => ({
      ...l,
      nombre: porId.get(l.ejercicioId)?.nombre ?? null,
      grupo: porId.get(l.ejercicioId)?.grupo ?? null,
    })),
  };
}

export async function crearRutina(email, entrada) {
  const { nombre, ejercicios, visibles } = await validarRutina(email, entrada);
  if (await datos.buscarRutinaPorNombre(email, nombre)) throw new Error("RUTINA_YA_EXISTE");
  const creada = await datos.guardarRutina({ dueno: email, nombre, ejercicios });
  return rutinaPublica(creada, visibles);
}

// Resumen para la lista: no hace falta mandar todas las líneas.
export async function listarRutinas(email) {
  return (await datos.listarRutinas(email)).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    numEjercicios: r.ejercicios.length,
    actualizada: r.actualizada,
  }));
}

export async function obtenerRutina(email, id) {
  const rutina = comprobarAcceso(await datos.buscarRutina(id), email);
  const ids = [...new Set(rutina.ejercicios.map((l) => l.ejercicioId))];
  return rutinaPublica(rutina, await datos.buscarEjerciciosVisibles(email, ids));
}

export async function actualizarRutina(email, id, entrada) {
  comprobarAcceso(await datos.buscarRutina(id), email, { modificar: true });
  const { nombre, ejercicios, visibles } = await validarRutina(email, entrada);
  // Nombre único, pero puede conservar el suyo (o cambiarle solo las mayúsculas).
  const mismoNombre = await datos.buscarRutinaPorNombre(email, nombre);
  if (mismoNombre && mismoNombre.id !== id) throw new Error("RUTINA_YA_EXISTE");
  const actualizada = await datos.actualizarRutina(id, { nombre, ejercicios });
  return rutinaPublica(actualizada, visibles);
}

export async function eliminarRutina(email, id) {
  comprobarAcceso(await datos.buscarRutina(id), email, { modificar: true });
  await datos.eliminarRutina(id);
}

// --- T-36. Entreno en vivo. Solo hay UN entreno en curso por usuario, así que todas las
// operaciones van sobre "el entreno en curso de `email`": no hace falta comprobar el dueño
// de un id que llega de fuera. Cada cambio se guarda al momento (si se recarga, no se pierde). ---

const MAX_SERIES_ENTRENO = 200;

// Una serie todavía sin hacer. `objetivo` y `descansoSeg` son copias de la rutina (D-20):
// si luego se edita o se borra la rutina, el entreno no cambia.
function serieNueva({ ejercicioId, nombre, objetivo = null, descansoSeg = DESCANSO_POR_DEFECTO, pesoKg = null, repeticiones = null }) {
  return { id: crypto.randomUUID(), ejercicioId, nombre, pesoKg, repeticiones, hecha: false, objetivo, descansoSeg };
}

// Función pura: de las líneas de una rutina (con nombre) a la lista de series del entreno.
// 3 series de press banca -> 3 series sin hacer, cada una con su objetivo de repeticiones.
export function seriesDesdeRutina(lineas) {
  return lineas.flatMap((l) =>
    Array.from({ length: l.series }, () =>
      serieNueva({ ejercicioId: l.ejercicioId, nombre: l.nombre, objetivo: { ...l.repeticiones }, descansoSeg: l.descansoSeg })
    )
  );
}

// T-62: función pura. A cada serie le pone `anterior` = lo que se hizo en la MISMA posición la
// última vez que se entrenó esta rutina: la 1.ª serie de un ejercicio con la 1.ª hecha de ese
// ejercicio, la 2.ª con la 2.ª... Si aquel día se hicieron menos series (o es la primera vez),
// `anterior` es null. `previo` es el último entreno terminado (solo guarda series hechas) o null.
export function anadirAnteriores(series, previo) {
  const hechasPorEjercicio = new Map();
  for (const s of previo?.series ?? []) {
    if (!s.hecha) continue;
    if (!hechasPorEjercicio.has(s.ejercicioId)) hechasPorEjercicio.set(s.ejercicioId, []);
    hechasPorEjercicio.get(s.ejercicioId).push(s);
  }
  const vistas = new Map(); // cuántas series de cada ejercicio llevamos
  return series.map((serie) => {
    const n = vistas.get(serie.ejercicioId) ?? 0;
    vistas.set(serie.ejercicioId, n + 1);
    const igual = hechasPorEjercicio.get(serie.ejercicioId)?.[n];
    return { ...serie, anterior: igual ? { pesoKg: igual.pesoKg, repeticiones: igual.repeticiones } : null };
  });
}

// Función pura: valida lo que el usuario apunta en una serie y la deja lista para guardar.
// El peso llega en la unidad del usuario (T-43) y se guarda en kg: de 0 a 1000 kg (0 = peso
// corporal); repeticiones de 0 a 100. Vacío = null (todavía sin apuntar).
// Para marcarla hecha hacen falta peso y al menos 1 repetición.
export function normalizarSerie({ peso, repeticiones, hecha } = {}, unidad = "kg") {
  const vacio = (v) => v === undefined || v === null || v === "";
  const valor = vacio(peso) ? null : Number(peso);
  const reps = vacio(repeticiones) ? null : Number(repeticiones);
  if (valor !== null && !(Number.isFinite(valor) && valor >= 0)) throw new Error("SERIE_INVALIDA");
  const pesoKg = valor === null ? null : pesoAKg(valor, unidad);
  if (pesoKg !== null && pesoKg > 1000) throw new Error("SERIE_INVALIDA");
  if (reps !== null && !(Number.isInteger(reps) && reps >= 0 && reps <= 100)) throw new Error("SERIE_INVALIDA");
  const marcada = hecha === true;
  if (marcada && (pesoKg === null || reps === null || reps < 1)) throw new Error("SERIE_INVALIDA");
  return { pesoKg, repeticiones: reps, hecha: marcada };
}

// --- T-42. Unidades de peso. En la BBDD el peso va SIEMPRE en kg; la unidad del usuario
// ("kg" o "lb") solo cambia cómo se escribe y cómo se enseña. ---

export const UNIDADES_PESO = ["kg", "lb"];
const KG_POR_LB = 0.45359237; // definición exacta de la libra

function comprobarUnidad(unidad) {
  if (!UNIDADES_PESO.includes(unidad)) throw new Error("UNIDAD_NO_VALIDA");
}

// Función pura: lo que escribe el usuario (en su unidad) -> kg para guardar.
// Se guardan 3 decimales: con 2, 135 lb serían 61,23 kg y al volver saldrían 134,99 lb.
export function pesoAKg(peso, unidad) {
  comprobarUnidad(unidad);
  const kg = unidad === "lb" ? peso * KG_POR_LB : peso;
  return Math.round(kg * 1000) / 1000;
}

// Función pura: kg guardados -> lo que se enseña en la unidad del usuario, con 2 decimales como mucho.
export function pesoDesdeKg(kg, unidad) {
  comprobarUnidad(unidad);
  const peso = unidad === "lb" ? kg / KG_POR_LB : kg;
  return Math.round(peso * 100) / 100;
}

// Unidad elegida por el usuario; si nunca la ha cambiado (o no existe), kg.
export async function unidadPesoDe(email) {
  const usuario = await datos.buscarPorEmail(email);
  return usuario?.unidadPeso ?? "kg";
}

// T-60: lo que necesita /api/yo de una sola lectura. `nombre` null = cuenta antigua o de OAuth
// sin nombre: la app se lo pide.
export async function perfilDe(email) {
  const usuario = await datos.buscarPorEmail(email);
  return {
    nombre: usuario?.nombre ?? null,
    unidadPeso: usuario?.unidadPeso ?? "kg",
    objetivoSemanal: usuario?.objetivoSemanal ?? null,
  };
}

// T-89: cambiar la contraseña desde Perfil. Hay que saber la actual (si alguien encuentra tu móvil
// con la sesión abierta, no puede cambiártela) y la nueva cumple el mismo mínimo que al registrarse.
export async function cambiarPassword(email, actual, nueva) {
  const usuario = await datos.buscarPorEmail(email);
  if (!usuario || usuario.estado !== "activo") throw new Error("USUARIO_NO_EXISTE");
  if (!(await bcrypt.compare(String(actual ?? ""), usuario.hash))) throw new Error("PASSWORD_ACTUAL_INCORRECTA");
  if (String(nueva ?? "").length < PASSWORD_MIN) throw new Error("PASSWORD_CORTA");
  await datos.actualizarHash(email, await bcrypt.hash(String(nueva), 10));
}

// T-88: todo lo que enseña la página de Perfil, en una sola petición: los datos de la cuenta,
// desde cuándo existe, cómo entra ("email", "google" o null si es anterior a guardarlo) y sus cifras
// (entrenos terminados y ejercicios con récord).
export async function obtenerPerfil(email) {
  const [usuario, desde, entrenos] = await Promise.all([
    datos.buscarPorEmail(email),
    datos.fechaAltaDe(email),
    datos.listarEntrenosTerminados(email),
  ]);
  if (!usuario) throw new Error("USUARIO_NO_EXISTE");
  return {
    email: usuario.email,
    nombre: usuario.nombre ?? null,
    rol: usuario.rol,
    unidadPeso: usuario.unidadPeso ?? "kg",
    objetivoSemanal: usuario.objetivoSemanal ?? null,
    acceso: usuario.acceso ?? null,
    desde,
    entrenos: entrenos.length,
    records: recordsPorEjercicio(entrenos).length,
  };
}

// T-87: objetivo de entrenos por semana, de 1 a 7 (lo pide el onboarding y se cambia en Perfil).
export const OBJETIVO_MIN = 1;
export const OBJETIVO_MAX = 7;

// Función pura: un número entero entre 1 y 7 (vale "3" escrito como texto); si no, error.
export function normalizarObjetivo(valor) {
  const n = Number(valor);
  if (valor === null || valor === "" || !Number.isInteger(n) || n < OBJETIVO_MIN || n > OBJETIVO_MAX) {
    throw new Error("OBJETIVO_NO_VALIDO");
  }
  return n;
}

export async function cambiarObjetivoSemanal(email, valor) {
  const objetivo = normalizarObjetivo(valor);
  if (!(await datos.actualizarObjetivoSemanal(email, objetivo))) throw new Error("USUARIO_NO_EXISTE");
  return objetivo;
}

export async function cambiarNombre(email, nombre) {
  const limpio = normalizarNombre(nombre);
  if (!(await datos.actualizarNombre(email, limpio))) throw new Error("USUARIO_NO_EXISTE");
  return limpio;
}

export async function cambiarUnidadPeso(email, unidad) {
  comprobarUnidad(unidad);
  if (!(await datos.actualizarUnidadPeso(email, unidad))) throw new Error("USUARIO_NO_EXISTE");
  return unidad;
}

// Lo que ve el usuario: sin el dueño y con cada peso en SU unidad (T-43). El cliente recibe
// `peso` y `unidad`; `pesoKg` (lo guardado) no sale de aquí.
function entrenoPublico({ dueno, ...entreno }, unidad) {
  const series = entreno.series.map(({ pesoKg, anterior, ...serie }) => ({
    ...serie,
    peso: pesoKg === null ? null : pesoDesdeKg(pesoKg, unidad),
    // T-62: lo de la vez anterior, también en su unidad (solo mientras el entreno está en curso).
    ...(anterior !== undefined && {
      anterior: anterior && { peso: pesoDesdeKg(anterior.pesoKg, unidad), repeticiones: anterior.repeticiones },
    }),
  }));
  return { ...entreno, unidad, series };
}

async function entrenoEnCurso(email) {
  const entreno = await datos.buscarEntrenoEnCurso(email);
  if (!entreno) throw new Error("SIN_ENTRENO_EN_CURSO");
  return entreno;
}

// El entreno en curso, o null si no hay ninguno (T-39: al recargar se retoma).
export async function obtenerEntrenoEnCurso(email) {
  const entreno = await datos.buscarEntrenoEnCurso(email);
  return entreno ? entrenoPublico(entreno, await unidadPesoDe(email)) : null;
}

// Empezar un entreno: libre (sin rutina, vacío) o desde una rutina propia.
export async function iniciarEntreno(email, { rutinaId } = {}, ahora = new Date()) {
  if (await datos.buscarEntrenoEnCurso(email)) throw new Error("ENTRENO_EN_CURSO");
  let series = [];
  let rutinaNombre = null;
  if (rutinaId) {
    // obtenerRutina ya comprueba que sea suya (si no, RECURSO_NO_EXISTE) y trae los nombres.
    const rutina = await obtenerRutina(email, rutinaId);
    // T-62: con lo que se hizo la última vez con esta rutina, como referencia.
    const previo = await datos.buscarUltimoEntrenoDeRutina(email, rutinaId);
    series = anadirAnteriores(seriesDesdeRutina(rutina.ejercicios), previo);
    rutinaNombre = rutina.nombre;
  }
  // Si llegan dos peticiones a la vez, el índice parcial de bd.js para la segunda (ENTRENO_EN_CURSO).
  const creado = await datos.guardarEntreno({ dueno: email, rutinaId: rutinaId || null, rutinaNombre, inicio: ahora, series });
  return entrenoPublico(creado, await unidadPesoDe(email));
}

// Añadir una serie. Con `despuesDe` (id de una serie) se copia esa serie (ejercicio, objetivo,
// descanso, peso y repeticiones) justo detrás: es el botón "+ Serie". Sin él, se añade al final
// una serie vacía de `ejercicioId`, que tiene que ser visible para el usuario (base o suyo).
export async function anadirSerie(email, { ejercicioId, despuesDe } = {}) {
  const entreno = await entrenoEnCurso(email);
  if (entreno.series.length >= MAX_SERIES_ENTRENO) throw new Error("ENTRENO_DEMASIADAS_SERIES");
  const series = [...entreno.series];
  if (despuesDe) {
    const pos = series.findIndex((s) => s.id === despuesDe);
    if (pos === -1) throw new Error("SERIE_NO_EXISTE");
    const { ejercicioId, nombre, objetivo, descansoSeg, pesoKg, repeticiones } = series[pos];
    series.splice(pos + 1, 0, serieNueva({ ejercicioId, nombre, objetivo, descansoSeg, pesoKg, repeticiones }));
  } else {
    const [ejercicio] = await datos.buscarEjerciciosVisibles(email, [String(ejercicioId ?? "")]);
    if (!ejercicio) throw new Error("EJERCICIO_NO_VALIDO");
    series.push(serieNueva({ ejercicioId: ejercicio.id, nombre: ejercicio.nombre }));
  }
  await datos.actualizarSeriesEntreno(entreno.id, series);
  return entrenoPublico({ ...entreno, series }, await unidadPesoDe(email));
}

export async function actualizarSerie(email, serieId, cambios) {
  const entreno = await entrenoEnCurso(email);
  if (!entreno.series.some((s) => s.id === serieId)) throw new Error("SERIE_NO_EXISTE");
  const unidad = await unidadPesoDe(email);
  const valores = normalizarSerie(cambios, unidad);
  const series = entreno.series.map((s) => (s.id === serieId ? { ...s, ...valores } : s));
  await datos.actualizarSeriesEntreno(entreno.id, series);
  return entrenoPublico({ ...entreno, series }, unidad);
}

export async function eliminarSerie(email, serieId) {
  const entreno = await entrenoEnCurso(email);
  if (!entreno.series.some((s) => s.id === serieId)) throw new Error("SERIE_NO_EXISTE");
  const series = entreno.series.filter((s) => s.id !== serieId);
  await datos.actualizarSeriesEntreno(entreno.id, series);
  return entrenoPublico({ ...entreno, series }, await unidadPesoDe(email));
}

// Terminar: se guardan solo las series hechas (lo que de verdad se entrenó).
// Sin ninguna hecha no hay nada que guardar: se descarta en vez de terminar.
export async function terminarEntreno(email, ahora = new Date()) {
  const entreno = await entrenoEnCurso(email);
  // T-62: `anterior` solo sirve mientras se entrena: en el historial no se guarda.
  const series = entreno.series.filter((s) => s.hecha).map(({ anterior, ...serie }) => serie);
  if (series.length === 0) throw new Error("ENTRENO_VACIO");
  await datos.terminarEntreno(entreno.id, { fin: ahora, series });
  cancelarAvisoDescanso(email); // T-56: sin entreno no hay descanso que avisar
  return entrenoPublico({ ...entreno, fin: ahora, series }, await unidadPesoDe(email));
}

// Descartar: borra el entreno en curso (no queda en el historial).
export async function descartarEntreno(email) {
  const entreno = await entrenoEnCurso(email);
  await datos.eliminarEntreno(entreno.id);
  cancelarAvisoDescanso(email); // T-56
}

// --- T-44. Historial: los entrenos terminados. Solo se ven y se borran (no se editan).
// El entreno en curso no forma parte del historial: por id da RECURSO_NO_EXISTE (404). ---

// Función pura: lo que se enseña de cada entreno en la lista (sin las series).
export function resumenEntreno({ id, rutinaNombre, inicio, fin, series }) {
  return {
    id,
    nombre: rutinaNombre ?? "Entreno libre",
    inicio,
    fin,
    duracionMin: Math.round((new Date(fin) - new Date(inicio)) / 60000),
    numEjercicios: new Set(series.map((s) => s.ejercicioId)).size,
    numSeries: series.length,
  };
}

export async function listarHistorial(email) {
  return (await datos.listarEntrenosTerminados(email)).map(resumenEntreno);
}

// Terminado y propio; si no, RECURSO_NO_EXISTE (ajeno, inexistente o todavía en curso).
async function entrenoTerminado(email, id) {
  const entreno = comprobarAcceso(await datos.buscarEntreno(id), email);
  if (entreno.fin === null) throw new Error("RECURSO_NO_EXISTE");
  return entreno;
}

// Detalle con todas sus series y los pesos en la unidad del usuario (D-23).
export async function obtenerEntrenoTerminado(email, id) {
  const entreno = await entrenoTerminado(email, id);
  return entrenoPublico(entreno, await unidadPesoDe(email));
}

export async function eliminarEntrenoTerminado(email, id) {
  const entreno = await entrenoTerminado(email, id);
  await datos.eliminarEntreno(entreno.id);
}

// --- T-46. Métricas de progreso. Funciones PURAS: reciben los entrenos terminados (con el peso
// en kg, tal como se guardan) y no tocan la BBDD; la conversión a la unidad del usuario se hace
// al final, al preparar la respuesta. Solo cuentan las series hechas. ---

// Las semanas van de lunes a domingo en hora de España: el servidor (Render) funciona en UTC y,
// sin esto, un entreno del domingo a las 23:30 caería en la semana siguiente.
const FORMATO_DIA_ESPANA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}); // "en-CA" escribe las fechas como "2026-11-16"

// Función pura: el lunes de la semana de `fecha` (en España), como texto "AAAA-MM-DD".
export function lunesDe(fecha) {
  const [anio, mes, dia] = FORMATO_DIA_ESPANA.format(new Date(fecha)).split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia)); // solo el día, sin hora
  const diasDesdeLunes = (d.getUTCDay() + 6) % 7; // getUTCDay: 0 = domingo
  d.setUTCDate(d.getUTCDate() - diasDesdeLunes);
  return d.toISOString().slice(0, 10);
}

function seriesHechas(entreno) {
  return entreno.series.filter((s) => s.hecha);
}

// Función pura: volumen de una serie (kg levantados en total). Con peso corporal (0) es 0.
export function volumenSerie({ pesoKg, repeticiones }) {
  return pesoKg * repeticiones;
}

// Una serie es mejor que otra si tiene más peso; con el mismo peso, más repeticiones.
// Así, en ejercicios de peso corporal (peso 0) el récord es el de más repeticiones.
function esMejorSerie(a, b) {
  return !b || a.pesoKg > b.pesoKg || (a.pesoKg === b.pesoKg && a.repeticiones > b.repeticiones);
}

// Función pura: entrenos y volumen de cada una de las últimas `semanas` semanas (la de `ahora`
// incluida), de la más antigua a la más reciente. Las semanas sin entrenos salen con 0.
export function entrenosPorSemana(entrenos, ahora = new Date(), semanas = 8) {
  const lunesActual = new Date(`${lunesDe(ahora)}T00:00:00Z`);
  const lista = Array.from({ length: semanas }, (_, i) => {
    const lunes = new Date(lunesActual);
    lunes.setUTCDate(lunes.getUTCDate() - 7 * (semanas - 1 - i));
    return { semana: lunes.toISOString().slice(0, 10), entrenos: 0, volumenKg: 0 };
  });
  const porSemana = new Map(lista.map((s) => [s.semana, s]));
  for (const entreno of entrenos) {
    const semana = porSemana.get(lunesDe(entreno.inicio));
    if (!semana) continue; // fuera del periodo
    semana.entrenos += 1;
    semana.volumenKg += seriesHechas(entreno).reduce((total, s) => total + volumenSerie(s), 0);
  }
  return lista;
}

// Función pura: cómo ha ido un ejercicio, un punto por cada entreno en que se hizo (del más
// antiguo al más reciente): peso máximo, la mejor serie y el volumen de ese día.
export function progresoEjercicio(entrenos, ejercicioId) {
  const ordenados = [...entrenos].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  const puntos = [];
  for (const entreno of ordenados) {
    const series = seriesHechas(entreno).filter((s) => s.ejercicioId === ejercicioId);
    if (series.length === 0) continue;
    let mejor = null;
    for (const s of series) if (esMejorSerie(s, mejor)) mejor = s;
    puntos.push({
      fecha: entreno.inicio,
      pesoMaxKg: mejor.pesoKg,
      mejorSerie: { pesoKg: mejor.pesoKg, repeticiones: mejor.repeticiones },
      volumenKg: series.reduce((total, s) => total + volumenSerie(s), 0),
    });
  }
  return puntos;
}

// Función pura: el récord de cada ejercicio (su mejor serie y la PRIMERA fecha en que se hizo)
// y en cuántos entrenos aparece. Ordenado por los más entrenados.
export function recordsPorEjercicio(entrenos) {
  const ordenados = [...entrenos].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  const porEjercicio = new Map();
  for (const entreno of ordenados) {
    const vistosHoy = new Set();
    for (const s of seriesHechas(entreno)) {
      let fila = porEjercicio.get(s.ejercicioId);
      if (!fila) {
        fila = { ejercicioId: s.ejercicioId, nombre: s.nombre, sesiones: 0, record: null };
        porEjercicio.set(s.ejercicioId, fila);
      }
      fila.nombre = s.nombre; // el nombre más reciente
      if (!vistosHoy.has(s.ejercicioId)) {
        vistosHoy.add(s.ejercicioId);
        fila.sesiones += 1;
      }
      // Solo si es estrictamente mejor: así se queda la primera vez que se consiguió.
      if (esMejorSerie(s, fila.record)) {
        fila.record = { pesoKg: s.pesoKg, repeticiones: s.repeticiones, fecha: entreno.inicio };
      }
    }
  }
  return [...porEjercicio.values()].sort(
    (a, b) => b.sesiones - a.sesiones || a.nombre.localeCompare(b.nombre, "es")
  );
}

// --- T-47. Métricas para la API: se leen los entrenos terminados del usuario de la sesión,
// se calculan con las funciones puras de arriba (en kg) y al final se pasan a su unidad (D-23). ---

export async function obtenerMetricas(email, ahora = new Date()) {
  const unidad = await unidadPesoDe(email);
  const entrenos = await datos.listarEntrenosTerminados(email);
  return {
    unidad,
    semanas: entrenosPorSemana(entrenos, ahora).map(({ semana, entrenos: n, volumenKg }) => ({
      semana,
      entrenos: n,
      volumen: pesoDesdeKg(volumenKg, unidad),
    })),
    records: recordsPorEjercicio(entrenos).map(({ record, ...fila }) => ({
      ...fila,
      record: { peso: pesoDesdeKg(record.pesoKg, unidad), repeticiones: record.repeticiones, fecha: record.fecha },
    })),
  };
}

// --- T-61. Pantalla "Hoy" del inicio: qué rutina toca, la racha y el último récord. ---

// Función pura: la rutina que toca. Primero una que nunca se haya hecho (en el orden de la
// lista); si ya se han hecho todas, la que lleva más tiempo sin hacerse. Sin rutinas, null.
export function rutinaSugerida(rutinas, entrenos) {
  const ultimaVez = new Map(); // rutinaId -> fecha del último entreno terminado con ella
  for (const { rutinaId, inicio } of entrenos) {
    if (!rutinaId) continue; // entreno libre
    const fecha = new Date(inicio);
    if (!ultimaVez.has(rutinaId) || fecha > ultimaVez.get(rutinaId)) ultimaVez.set(rutinaId, fecha);
  }
  let elegida = null;
  for (const rutina of rutinas) {
    const fecha = ultimaVez.get(rutina.id) ?? null;
    if (fecha === null) return { id: rutina.id, nombre: rutina.nombre, ultimaVez: null };
    if (!elegida || fecha < elegida.fecha) elegida = { rutina, fecha };
  }
  return elegida && { id: elegida.rutina.id, nombre: elegida.rutina.nombre, ultimaVez: elegida.fecha.toISOString() };
}

// Función pura: semanas seguidas entrenando (al menos un entreno), contando hacia atrás desde
// la actual. La semana actual sin entrenos todavía no rompe la racha: aún puede entrenar.
// `semanas` es la lista de entrenosPorSemana (de la más antigua a la actual).
export function rachaSemanas(semanas) {
  let i = semanas.length - 1;
  if (i >= 0 && semanas[i].entrenos === 0) i -= 1;
  let racha = 0;
  while (i >= 0 && semanas[i].entrenos > 0) {
    racha += 1;
    i -= 1;
  }
  return racha;
}

// Función pura: el récord conseguido más recientemente (de recordsPorEjercicio). Sin récords, null.
export function ultimoRecord(records) {
  let ultimo = null;
  for (const { nombre, record } of records) {
    if (!ultimo || new Date(record.fecha) > new Date(ultimo.fecha)) ultimo = { nombre, ...record };
  }
  return ultimo;
}

// Todo lo de la pantalla "Hoy" de una vez (una sola petición del cliente). Pesos en su unidad.
export async function obtenerHoy(email, ahora = new Date()) {
  const [usuario, rutinas, entrenos, enCurso] = await Promise.all([
    datos.buscarPorEmail(email),
    datos.listarRutinas(email),
    datos.listarEntrenosTerminados(email),
    datos.buscarEntrenoEnCurso(email),
  ]);
  const unidad = usuario?.unidadPeso ?? "kg";
  const semanas = entrenosPorSemana(entrenos, ahora, 52); // un año: de sobra para la racha
  const record = ultimoRecord(recordsPorEjercicio(entrenos));
  return {
    unidad,
    enCurso: enCurso && {
      rutinaNombre: enCurso.rutinaNombre ?? null,
      hechas: enCurso.series.filter((s) => s.hecha).length,
      total: enCurso.series.length,
    },
    sugerida: rutinaSugerida(rutinas, entrenos),
    numRutinas: rutinas.length,
    estaSemana: semanas.at(-1).entrenos,
    racha: rachaSemanas(semanas),
    ultimoRecord: record && {
      nombre: record.nombre,
      peso: pesoDesdeKg(record.pesoKg, unidad),
      repeticiones: record.repeticiones,
      fecha: record.fecha,
    },
  };
}

// Evolución de un ejercicio. Solo mira los entrenos del usuario: si nunca lo ha hecho (o el id
// no existe, o es de otro), no hay nada que enseñar y es RECURSO_NO_EXISTE (404).
export async function obtenerProgresoEjercicio(email, ejercicioId) {
  const id = String(ejercicioId ?? "");
  const entrenos = await datos.listarEntrenosTerminados(email);
  const puntos = progresoEjercicio(entrenos, id);
  if (puntos.length === 0) throw new Error("RECURSO_NO_EXISTE");
  const unidad = await unidadPesoDe(email);
  const { nombre } = recordsPorEjercicio(entrenos).find((r) => r.ejercicioId === id);
  return {
    ejercicioId: id,
    nombre,
    unidad,
    puntos: puntos.map((p) => ({
      fecha: p.fecha,
      pesoMax: pesoDesdeKg(p.pesoMaxKg, unidad),
      mejorSerie: { peso: pesoDesdeKg(p.mejorSerie.pesoKg, unidad), repeticiones: p.mejorSerie.repeticiones },
      volumen: pesoDesdeKg(p.volumenKg, unidad),
    })),
  };
}

// --- T-55. Notificaciones push (D-29). Aquí solo las reglas: qué suscripción es válida y a
// quién se avisa. Enviar de verdad es cosa de servicios/push.js. ---

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

// T-78 (A01-001, SSRF): el servidor hace un POST a la dirección de cada suscripción. Si valiera
// cualquier https, un usuario podría hacer que Forja "llamara" a la web que quisiera. Solo valen
// los servicios de avisos de los navegadores: Google (Chrome, Android), Mozilla (Firefox),
// Apple (Safari, iPhone) y Microsoft (Edge).
const SERVICIOS_PUSH = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
const SERVICIOS_PUSH_SUFIJO = ".notify.windows.com";

// Función pura: ¿la dirección es https, sin puerto raro, y de uno de esos servicios?
export function servicioPushPermitido(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  return SERVICIOS_PUSH.includes(url.hostname) || url.hostname.endsWith(SERVICIOS_PUSH_SUFIJO);
}

// Función pura: comprueba la suscripción que manda el navegador (PushSubscription.toJSON())
// y se queda solo con lo necesario. La dirección tiene que ser https (la del servicio de avisos).
export function normalizarSuscripcion(suscripcion) {
  const { endpoint, keys } = suscripcion ?? {};
  const valida =
    typeof endpoint === "string" &&
    endpoint.length <= 1000 &&
    /^https:\/\/[^\s]+$/.test(endpoint) &&
    servicioPushPermitido(endpoint) &&
    typeof keys?.p256dh === "string" &&
    typeof keys?.auth === "string" &&
    keys.p256dh.length <= 200 &&
    keys.auth.length <= 100 &&
    BASE64URL.test(keys.p256dh) &&
    BASE64URL.test(keys.auth);
  if (!valida) throw new Error("SUSCRIPCION_INVALIDA");
  return { endpoint, claves: { p256dh: keys.p256dh, auth: keys.auth } };
}

// La clave pública que necesita el navegador; null si el servidor no tiene avisos configurados.
export function clavePublicaAvisos() {
  return push.clavePublica();
}

export async function activarAvisos(email, suscripcion) {
  const { endpoint, claves } = normalizarSuscripcion(suscripcion);
  await datos.guardarSuscripcion({ dueno: email, endpoint, claves });
}

export async function desactivarAvisos(email, endpoint) {
  if (typeof endpoint !== "string" || endpoint === "") throw new Error("SUSCRIPCION_INVALIDA");
  return datos.eliminarSuscripcion(endpoint, email);
}

// Avisa a todos los móviles del usuario. Las suscripciones caducadas se borran solas.
// Devuelve a cuántos móviles se ha enviado.
export async function avisar(email, aviso, opciones) {
  let enviados = 0;
  for (const suscripcion of await datos.listarSuscripciones(email)) {
    const resultado = await push.enviarAviso(suscripcion, aviso, opciones);
    if (resultado === "caducada") await datos.eliminarSuscripcion(suscripcion.endpoint);
    if (resultado === "enviado" || resultado === "omitido") enviados += 1;
  }
  return enviados;
}

// Botón "Enviar aviso de prueba" de Perfil: para comprobar que llega al móvil.
export async function avisoDePrueba(email) {
  const enviados = await avisar(email, {
    titulo: "Forja",
    cuerpo: "¡Los avisos funcionan! Así te avisaremos al terminar cada descanso.",
    url: "/ajustes.html",
    etiqueta: "prueba",
  });
  if (enviados === 0) throw new Error("SIN_AVISOS_ACTIVOS");
  return enviados;
}

// --- T-56. Aviso al terminar el descanso (D-29). El móvil dice a qué hora termina y el servidor
// programa el aviso para esa hora: así llega aunque el móvil esté bloqueado y la app dormida.
// Los avisos programados viven en la memoria del servidor (un temporizador por usuario): si el
// servidor se reinicia justo durante un descanso, ese aviso se pierde (no hay datos en juego). ---

export const MAX_DESCANSO_AVISO_MS = 15 * 60 * 1000; // el temporizador llega a 10 min; margen de sobra

// Función pura: cuántos milisegundos faltan para avisar. El fin tiene que ser una fecha válida,
// futura y como mucho dentro de 15 min (así nadie programa avisos para dentro de un año).
export function retrasoAvisoDescanso(fin, ahora = new Date()) {
  const momento = new Date(fin).getTime();
  const retraso = momento - new Date(ahora).getTime();
  if (fin === null || fin === undefined || fin === "" || !Number.isFinite(momento)) throw new Error("DESCANSO_INVALIDO");
  if (retraso <= 0 || retraso > MAX_DESCANSO_AVISO_MS) throw new Error("DESCANSO_INVALIDO");
  return retraso;
}

const avisosDescanso = new Map(); // email -> temporizador (setTimeout) pendiente

// Programa (o reprograma, si ya había uno: ±15 s, 60/90/120) el aviso de este usuario.
export function programarAvisoDescanso(email, fin, ahora = new Date()) {
  const retraso = retrasoAvisoDescanso(fin, ahora);
  cancelarAvisoDescanso(email);
  const temporizador = setTimeout(() => {
    avisosDescanso.delete(email);
    avisar(
      email,
      { titulo: "Descanso terminado", cuerpo: "¡A por la siguiente serie! 💪", url: "/entreno.html", etiqueta: "descanso" },
      { ttl: 60 } // si en un minuto no ha llegado, ya no sirve
    ).catch((err) => log.error("aviso-descanso-fallido", `${email} ${err.message}`));
  }, retraso);
  temporizador.unref?.(); // que un aviso pendiente no impida apagar el servidor (ni acabar los tests)
  avisosDescanso.set(email, temporizador);
  return { fin: new Date(new Date(ahora).getTime() + retraso) };
}

// Saltar el descanso, terminar o descartar el entreno: el aviso ya no tiene sentido.
export function cancelarAvisoDescanso(email) {
  clearTimeout(avisosDescanso.get(email));
  return avisosDescanso.delete(email);
}

export function hayAvisoDescanso(email) {
  return avisosDescanso.has(email);
}
