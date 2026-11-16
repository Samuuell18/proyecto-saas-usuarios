// Página de entreno en vivo (T-38). Capa de PRESENTACIÓN: enseña el entreno en curso y
// recoge lo que apunta el usuario. Cada cambio se manda al servidor al momento, que es quien
// valida y guarda (reglas en logica.js). Toda la red pasa por rest.js.

import {
  apiYo,
  apiEjercicios,
  apiGrupos,
  apiRutinas,
  apiEntrenoActual,
  apiIniciarEntreno,
  apiAnadirSerie,
  apiActualizarSerie,
  apiEliminarSerie,
  apiTerminarEntreno,
  apiDescartarEntreno,
} from "./rest.js";
import { palabrasDe, coincide } from "./busqueda.js";
import { crearDescanso, segundosRestantes, sumarSegundos, formatearTiempo } from "./temporizador.js";

const $ = (id) => document.getElementById(id);

let entreno = null; // el entreno en curso, tal como lo devuelve el servidor
let catalogo = [];
let grupos = [];

function mensaje(texto, esError = false) {
  $("mensaje").textContent = texto;
  $("mensaje").className = esError ? "error" : "ok";
  if (esError) window.scrollTo({ top: 0, behavior: "smooth" });
}

function capitalizar(texto) {
  return texto.charAt(0).toLocaleUpperCase("es") + texto.slice(1);
}

function boton(texto, clase, alPulsar, etiqueta = texto) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = texto;
  b.className = clase;
  b.setAttribute("aria-label", etiqueta);
  b.addEventListener("click", alPulsar);
  return b;
}

// Las peticiones van de una en una y en orden: si se pulsan dos cosas muy seguidas,
// la segunda espera a la primera (el servidor guarda la lista de series entera).
let cola = Promise.resolve();
function enCola(tarea) {
  cola = cola.then(tarea, tarea);
  return cola;
}

// Pide algo al servidor; si va bien, el entreno pasa a ser lo que devuelve.
// `repintar` = false cuando el usuario está escribiendo (para no quitarle el foco).
function cambiar(peticion, { repintar = true } = {}) {
  return enCola(async () => {
    const r = await peticion();
    if (!r.ok) {
      mensaje(r.error, true);
      repintar = true; // volver a enseñar lo que de verdad hay guardado
    } else {
      $("mensaje").textContent = "";
      entreno = r.datos;
    }
    if (repintar) pintarEntreno();
    return r;
  });
}

function mostrarVista(enCurso) {
  $("vista-empezar").hidden = enCurso;
  $("vista-entreno").hidden = !enCurso;
}

// ---------- Vista 1: empezar ----------

async function cargarRutinas() {
  const r = await apiRutinas();
  const lista = $("lista-rutinas");
  lista.replaceChildren();
  if (!r.ok) {
    mensaje(r.error, true);
    return;
  }
  $("resumen-rutinas").textContent =
    r.datos.length === 0
      ? "Todavía no tienes rutinas: empieza un entreno libre o crea una en Rutinas."
      : "Elige una rutina o entrena sin plan.";
  for (const rutina of r.datos) {
    const li = document.createElement("li");
    li.className = "panel tarjeta-rutina";
    const info = document.createElement("div");
    const nombre = document.createElement("h2");
    nombre.textContent = rutina.nombre;
    const detalle = document.createElement("p");
    detalle.textContent = `${rutina.numEjercicios} ${rutina.numEjercicios === 1 ? "ejercicio" : "ejercicios"}`;
    info.append(nombre, detalle);
    li.append(info, boton("Empezar", "", () => empezar(rutina.id)));
    lista.append(li);
  }
}

function abrirEntreno(datos) {
  entreno = datos;
  pintarEntreno();
  mostrarVista(true);
  window.scrollTo(0, 0);
}

async function empezar(rutinaId = null) {
  const r = await apiIniciarEntreno(rutinaId);
  if (r.ok) {
    $("mensaje").textContent = "";
    abrirEntreno(r.datos);
    return;
  }
  mensaje(r.error, true);
  // T-39: 409 = ya hay uno en curso (p. ej. empezado en otra pestaña): se abre ese.
  if (r.status === 409) await retomar();
}

// T-39: si hay un entreno a medias (se recargó la página, se cerró el navegador o se
// empezó en otro dispositivo), se sigue donde se dejó. Todo está guardado en el servidor.
async function retomar() {
  const r = await apiEntrenoActual();
  if (!r.ok) {
    mensaje(r.error, true);
    return false;
  }
  if (!r.datos) return false;
  abrirEntreno(r.datos);
  return true;
}

$("btn-libre").addEventListener("click", () => empezar());

// ---------- Vista 2: entreno en curso ----------

// Las series seguidas del mismo ejercicio forman un bloque (así se ven en la pantalla).
function agruparEnBloques(series) {
  const bloques = [];
  for (const s of series) {
    const ultimo = bloques.at(-1);
    if (ultimo && ultimo.ejercicioId === s.ejercicioId) ultimo.series.push(s);
    else bloques.push({ ejercicioId: s.ejercicioId, nombre: s.nombre, series: [s] });
  }
  return bloques;
}

function textoObjetivo(objetivo) {
  if (!objetivo) return "—";
  return objetivo.min === objetivo.max ? String(objetivo.min) : `${objetivo.min}-${objetivo.max}`;
}

function campo(serie, clave, etiqueta, { decimal }) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = decimal ? "decimal" : "numeric";
  input.value = serie[clave] ?? "";
  input.setAttribute("aria-label", etiqueta);
  input.addEventListener("change", () => {
    // En el móvil se escribe "62,5": se acepta la coma decimal.
    serie[clave] = input.value.trim().replace(",", ".");
    const { pesoKg, repeticiones, hecha } = serie;
    cambiar(() => apiActualizarSerie(serie.id, { pesoKg, repeticiones, hecha }), { repintar: false });
  });
  return input;
}

function filaSerie(serie, numero) {
  const fila = document.createElement("li");
  fila.className = serie.hecha ? "fila-serie hecha" : "fila-serie";

  const num = document.createElement("span");
  num.className = "num-serie";
  num.textContent = numero;
  const objetivo = document.createElement("span");
  objetivo.className = "objetivo-serie";
  objetivo.textContent = textoObjetivo(serie.objetivo);

  const marcar = boton(serie.hecha ? "✓" : "", "btn-icono btn-hecha", async () => {
    // Sin peso apuntado se entiende peso corporal (0 kg). Las repeticiones sí hay que escribirlas.
    const pesoKg = serie.pesoKg === null || serie.pesoKg === "" ? 0 : serie.pesoKg;
    const marcando = !serie.hecha;
    const r = await cambiar(() => apiActualizarSerie(serie.id, { pesoKg, repeticiones: serie.repeticiones, hecha: marcando }));
    // Serie hecha (y guardada) = empieza el descanso. Al desmarcar no.
    if (r.ok && marcando) iniciarDescanso(DESCANSO_INICIAL);
  }, serie.hecha ? `Desmarcar serie ${numero}` : `Marcar serie ${numero} como hecha`);

  const quitar = boton("✕", "btn-icono btn-peligro", () => {
    cambiar(() => apiEliminarSerie(serie.id));
  }, `Quitar serie ${numero}`);

  fila.append(
    num,
    objetivo,
    campo(serie, "pesoKg", `Peso de la serie ${numero} en kg`, { decimal: true }),
    campo(serie, "repeticiones", `Repeticiones de la serie ${numero}`, { decimal: false }),
    marcar,
    quitar
  );
  return fila;
}

function pintarEntreno() {
  $("titulo-entreno").textContent = entreno.rutinaNombre ?? "Entreno libre";
  const hora = new Date(entreno.inicio).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const hechas = entreno.series.filter((s) => s.hecha).length;
  $("detalle-entreno").textContent = `Empezado a las ${hora} · ${hechas} de ${entreno.series.length} series hechas`;

  const contenedor = $("bloques");
  contenedor.replaceChildren();
  if (entreno.series.length === 0) {
    const vacio = document.createElement("p");
    vacio.className = "panel vacio";
    vacio.textContent = "Añade el primer ejercicio con el buscador de abajo.";
    contenedor.append(vacio);
    return;
  }

  for (const bloque of agruparEnBloques(entreno.series)) {
    const caja = document.createElement("section");
    caja.className = "panel bloque-entreno";
    const titulo = document.createElement("h2");
    titulo.textContent = bloque.nombre;

    const cabecera = document.createElement("div");
    cabecera.className = "fila-serie cabecera-series";
    cabecera.setAttribute("aria-hidden", "true");
    for (const t of ["#", "Obj.", "kg", "Reps", "", ""]) {
      const span = document.createElement("span");
      span.textContent = t;
      cabecera.append(span);
    }

    const lista = document.createElement("ol");
    lista.className = "series-entreno";
    bloque.series.forEach((s, i) => lista.append(filaSerie(s, i + 1)));

    const ultima = bloque.series.at(-1);
    const mas = boton("+ Serie", "btn-secundario btn-mas-serie", () => {
      cambiar(() => apiAnadirSerie({ despuesDe: ultima.id }));
    }, `Añadir serie de ${bloque.nombre}`);

    caja.append(titulo, cabecera, lista, mas);
    contenedor.append(caja);
  }
}

// ---------- Temporizador de descanso (T-40) ----------
// Solo en el cliente: no se guarda en el servidor. Las cuentas están en temporizador.js.

const DESCANSO_INICIAL = 90;
let descanso = null; // { fin } mientras hay un descanso en marcha
let reloj = null; // setInterval que repinta la cuenta atrás

function iniciarDescanso(segundos) {
  descanso = crearDescanso(segundos, Date.now());
  empezarReloj();
}

// Se repinta 4 veces por segundo: así el cambio de segundo se ve a tiempo.
function empezarReloj() {
  clearInterval(reloj);
  reloj = setInterval(pintarDescanso, 250);
  pintarDescanso();
}

function pararDescanso() {
  descanso = null;
  clearInterval(reloj);
  reloj = null;
  $("barra-descanso").hidden = true;
}

function pintarDescanso() {
  if (!descanso) return;
  const quedan = segundosRestantes(descanso, Date.now());
  const terminado = quedan === 0;
  $("barra-descanso").hidden = false;
  $("barra-descanso").classList.toggle("terminado", terminado);
  $("descanso-tiempo").textContent = formatearTiempo(quedan);
  $("descanso-etiqueta").textContent = terminado ? "¡A por la siguiente serie!" : "Descanso";
  $("btn-saltar").textContent = terminado ? "Cerrar" : "Saltar";
  if (terminado) {
    clearInterval(reloj);
    reloj = null;
  }
}

$("btn-saltar").addEventListener("click", pararDescanso);
for (const b of document.querySelectorAll("[data-sumar]")) {
  b.addEventListener("click", () => {
    descanso = sumarSegundos(descanso, Number(b.dataset.sumar), Date.now());
    empezarReloj();
  });
}
for (const b of document.querySelectorAll("[data-fijar]")) {
  b.addEventListener("click", () => iniciarDescanso(Number(b.dataset.fijar)));
}

// Buscador y desplegable para añadir un ejercicio (como en el editor de rutinas).
function pintarSelector() {
  const palabras = palabrasDe($("ej-buscar").value);
  const select = $("ej-select");
  const primera = document.createElement("option");
  primera.value = "";
  select.replaceChildren(primera);
  let encontrados = 0;
  for (const g of grupos) {
    const delGrupo = catalogo.filter((e) => e.grupo === g && coincide(e, palabras));
    if (delGrupo.length === 0) continue;
    const grupo = document.createElement("optgroup");
    grupo.label = capitalizar(g);
    for (const ej of delGrupo) {
      const opcion = document.createElement("option");
      opcion.value = ej.id;
      opcion.textContent = ej.nombre;
      grupo.append(opcion);
    }
    select.append(grupo);
    encontrados += delGrupo.length;
  }
  if (palabras.length === 0) {
    primera.textContent = "Elige un ejercicio";
  } else if (encontrados === 0) {
    primera.textContent = "Ningún ejercicio coincide";
  } else {
    primera.textContent = `${encontrados} ${encontrados === 1 ? "coincide" : "coinciden"}`;
    select.value = select.querySelector("optgroup option").value;
  }
}

$("ej-buscar").addEventListener("input", pintarSelector);
$("ej-buscar").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("btn-anadir").click();
  }
});

$("btn-anadir").addEventListener("click", async () => {
  const ejercicioId = $("ej-select").value;
  if (!ejercicioId) {
    mensaje("Elige un ejercicio de la lista.", true);
    return;
  }
  const r = await cambiar(() => apiAnadirSerie({ ejercicioId }));
  if (r.ok) {
    $("ej-buscar").value = "";
    pintarSelector();
  }
});

$("btn-terminar").addEventListener("click", async () => {
  if (!confirm("¿Terminar el entreno? Se guardarán solo las series marcadas como hechas.")) return;
  const r = await enCola(() => apiTerminarEntreno());
  if (!r.ok) {
    mensaje(r.error, true);
    return;
  }
  entreno = null;
  pararDescanso();
  const n = r.datos.series.length;
  mensaje(`Entreno guardado: ${n} ${n === 1 ? "serie" : "series"}. ¡Buen trabajo!`);
  mostrarVista(false);
  await cargarRutinas();
});

$("btn-descartar").addEventListener("click", async () => {
  if (!confirm("¿Descartar el entreno? Se perderá todo lo apuntado.")) return;
  const r = await enCola(() => apiDescartarEntreno());
  if (!r.ok) {
    mensaje(r.error, true);
    return;
  }
  entreno = null;
  pararDescanso();
  mensaje("Entreno descartado.");
  mostrarVista(false);
  await cargarRutinas();
});

// ---------- Arranque ----------

async function cargarCatalogo() {
  const [respEjercicios, respGrupos] = await Promise.all([apiEjercicios(), apiGrupos()]);
  if (!respEjercicios.ok || !respGrupos.ok) {
    mensaje("No se pudieron cargar los ejercicios.", true);
    return;
  }
  catalogo = respEjercicios.datos;
  grupos = respGrupos.datos;
  pintarSelector();
}

const sesion = await apiYo();
if (!sesion.ok) {
  location.href = "/";
} else {
  await Promise.all([cargarCatalogo(), cargarRutinas()]);
  if (!(await retomar())) mostrarVista(false);
}
