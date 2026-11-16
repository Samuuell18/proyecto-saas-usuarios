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

// Almacén de sesiones (T-27): lo crea la capa de datos; aquí solo se pasa a la API
// para respetar la cadena api → lógica → datos (la API nunca importa datos.js).
export { crearAlmacenSesiones } from "./datos/datos.js";

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
  // Versión async: no bloquea el servidor mientras calcula el hash.
  const hash = await bcrypt.hash(String(password), 10);
  // Primer admin: no hay usuarios que lo nombren, así que lo decide el entorno.
  // Si el email coincide con ADMIN_EMAIL nace admin; el resto, usuario.
  const adminEmail = String(process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const rol = emailLimpio === adminEmail && adminEmail !== "" ? "admin" : "usuario";
  const usuario = { email: emailLimpio, hash, estado: "pendiente", rol };
  await datos.guardar(usuario);
  await crearYEnviarToken(emailLimpio);
  return { email: usuario.email, estado: usuario.estado, rol: usuario.rol };
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
export async function reenviarConfirmacion(email) {
  const limpio = String(email ?? "").trim().toLowerCase();
  const usuario = await datos.buscarPorEmail(limpio);
  if (usuario?.estado !== "pendiente") return false;
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

export async function iniciarSesion(email, password) {
  const usuario = await datos.buscarPorEmail(String(email ?? "").trim().toLowerCase());
  if (!usuario) throw new Error("CREDENCIALES_INVALIDAS");
  if (usuario.estado === "pendiente") throw new Error("CUENTA_PENDIENTE");
  if (usuario.estado !== "activo") throw new Error("CREDENCIALES_INVALIDAS");
  if (!(await bcrypt.compare(String(password ?? ""), usuario.hash))) {
    throw new Error("CREDENCIALES_INVALIDAS");
  }
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
export async function oauthLogin(email) {
  const emailLimpio = String(email ?? "").trim().toLowerCase();
  if (!emailLimpio.includes("@")) {
    throw new Error("EMAIL_INVALIDO");
  }
  const existente = await datos.buscarPorEmail(emailLimpio);
  if (existente) {
    // El proveedor ya verificó el email: una pendiente se activa.
    // Una eliminada sigue sin entrar.
    if (existente.estado !== "activo") {
      if (existente.estado === "pendiente") {
        await datos.actualizarEstado(emailLimpio, "activo");
        return { email: existente.email, estado: "activo", rol: existente.rol };
      }
      throw new Error("CREDENCIALES_INVALIDAS");
    }
    return { email: existente.email, estado: existente.estado, rol: existente.rol };
  }
  const adminEmail = String(process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const rol = emailLimpio === adminEmail && adminEmail !== "" ? "admin" : "usuario";
  // Sin contraseña: hash aleatorio inutilizable para login local.
  const hash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  await datos.guardar({ email: emailLimpio, hash, estado: "activo", rol });
  return { email: emailLimpio, estado: "activo", rol };
}

export async function listar() {
  const todos = await datos.listar();
  return todos.map((u) => ({ email: u.email, estado: u.estado, rol: u.rol }));
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

export async function cambiarUnidadPeso(email, unidad) {
  comprobarUnidad(unidad);
  if (!(await datos.actualizarUnidadPeso(email, unidad))) throw new Error("USUARIO_NO_EXISTE");
  return unidad;
}

// Lo que ve el usuario: sin el dueño y con cada peso en SU unidad (T-43). El cliente recibe
// `peso` y `unidad`; `pesoKg` (lo guardado) no sale de aquí.
function entrenoPublico({ dueno, ...entreno }, unidad) {
  const series = entreno.series.map(({ pesoKg, ...serie }) => ({
    ...serie,
    peso: pesoKg === null ? null : pesoDesdeKg(pesoKg, unidad),
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
    series = seriesDesdeRutina(rutina.ejercicios);
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
  const series = entreno.series.filter((s) => s.hecha);
  if (series.length === 0) throw new Error("ENTRENO_VACIO");
  await datos.terminarEntreno(entreno.id, { fin: ahora, series });
  return entrenoPublico({ ...entreno, fin: ahora, series }, await unidadPesoDe(email));
}

// Descartar: borra el entreno en curso (no queda en el historial).
export async function descartarEntreno(email) {
  const entreno = await entrenoEnCurso(email);
  await datos.eliminarEntreno(entreno.id);
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
