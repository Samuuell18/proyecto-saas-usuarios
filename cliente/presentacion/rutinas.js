// Página de rutinas (T-35). Capa de PRESENTACIÓN: lista las rutinas del usuario y deja
// crearlas y editarlas. Las reglas (nombre único, rangos, dueño) las aplica el servidor;
// aquí solo se recogen los datos y se muestran sus mensajes. Toda la red pasa por rest.js.

import {
  apiYo,
  apiEjercicios,
  apiGrupos,
  apiRutinas,
  apiRutina,
  apiCrearRutina,
  apiActualizarRutina,
  apiEliminarRutina,
} from "../comunicacion/rest.js";
import { palabrasDe, coincide } from "./busqueda.js";
import { pintarMenu } from "./navegacion.js";

const $ = (id) => document.getElementById(id);

let catalogo = []; // ejercicios visibles para el usuario (base + propios), en orden
let grupos = [];
let ejerciciosPorId = new Map();
let lineas = []; // ejercicios de la rutina que se está editando
let editandoId = null; // null = rutina nueva

function mensaje(texto, esError = false) {
  $("mensaje").textContent = texto;
  $("mensaje").className = esError ? "error" : "ok";
}

function capitalizar(texto) {
  return texto.charAt(0).toLocaleUpperCase("es") + texto.slice(1);
}

// "10" -> 10 · "8-12" -> { min: 8, max: 12 } · otra cosa -> null (el servidor dará el error).
function leerRepeticiones(texto) {
  const t = String(texto).trim();
  const rango = t.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rango) return { min: Number(rango[1]), max: Number(rango[2]) };
  return /^\d+$/.test(t) ? Number(t) : null;
}

function textoRepeticiones({ min, max }) {
  return min === max ? String(min) : `${min}-${max}`;
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

// ---------- Vista 1: lista ----------

async function cargarLista() {
  const r = await apiRutinas();
  if (!r.ok) {
    mensaje(r.error, true);
    return;
  }
  const lista = $("lista-rutinas");
  lista.replaceChildren();
  $("resumen").textContent =
    r.datos.length === 0
      ? "Todavía no tienes rutinas. Crea la primera."
      : `${r.datos.length} ${r.datos.length === 1 ? "rutina" : "rutinas"}.`;

  for (const rutina of r.datos) {
    const li = document.createElement("li");
    li.className = "panel tarjeta-rutina";
    const info = document.createElement("div");
    const nombre = document.createElement("h2");
    nombre.textContent = rutina.nombre;
    const detalle = document.createElement("p");
    detalle.textContent = `${rutina.numEjercicios} ${rutina.numEjercicios === 1 ? "ejercicio" : "ejercicios"}`;
    info.append(nombre, detalle);

    const acciones = document.createElement("div");
    acciones.className = "acciones-rutina";
    acciones.append(
      boton("Editar", "btn-secundario", () => abrirEditor(rutina.id)),
      boton("Borrar", "btn-peligro", async () => {
        if (!confirm(`¿Borrar la rutina "${rutina.nombre}"?`)) return;
        const del = await apiEliminarRutina(rutina.id);
        mensaje(del.ok ? `Rutina "${rutina.nombre}" borrada.` : del.error, !del.ok);
        if (del.ok) await cargarLista();
      })
    );
    li.append(info, acciones);
    lista.append(li);
  }
}

// ---------- Vista 2: editor ----------

function mostrarVista(editor) {
  $("vista-lista").hidden = editor;
  $("vista-editor").hidden = !editor;
  window.scrollTo(0, 0);
}

async function abrirEditor(id = null) {
  editandoId = id;
  $("form-rutina").reset();
  lineas = [];
  $("titulo-editor").textContent = id ? "Editar rutina" : "Nueva rutina";
  if (id) {
    const r = await apiRutina(id);
    if (!r.ok) {
      mensaje(r.error, true);
      return;
    }
    $("rut-nombre").value = r.datos.nombre;
    lineas = r.datos.ejercicios.map((l) => ({
      ejercicioId: l.ejercicioId,
      nombre: l.nombre,
      series: l.series,
      repeticiones: textoRepeticiones(l.repeticiones),
      descansoSeg: l.descansoSeg,
    }));
  }
  pintarLineas();
  mostrarVista(true);
}

function campoNumero(etiqueta, valor, alCambiar, { tipo = "number", ancho = "" } = {}) {
  const caja = document.createElement("label");
  caja.className = `campo-linea ${ancho}`;
  caja.textContent = etiqueta;
  const input = document.createElement("input");
  input.type = tipo;
  input.value = valor;
  if (tipo === "number") input.inputMode = "numeric";
  input.addEventListener("input", () => alCambiar(input.value));
  caja.append(input);
  return caja;
}

function pintarLineas() {
  const ol = $("lineas");
  ol.replaceChildren();
  if (lineas.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "Añade al menos un ejercicio.";
    ol.append(vacio);
    return;
  }
  lineas.forEach((linea, i) => {
    const li = document.createElement("li");
    li.className = "linea-rutina";

    const cabecera = document.createElement("div");
    cabecera.className = "cabecera-linea";
    const nombre = document.createElement("strong");
    nombre.textContent = `${i + 1}. ${linea.nombre ?? "Ejercicio"}`;
    const mover = document.createElement("div");
    mover.className = "mover-linea";
    mover.append(
      boton("↑", "btn-icono", () => moverLinea(i, -1), "Subir ejercicio"),
      boton("↓", "btn-icono", () => moverLinea(i, 1), "Bajar ejercicio"),
      boton("✕", "btn-icono btn-peligro", () => quitarLinea(i), "Quitar ejercicio")
    );
    cabecera.append(nombre, mover);

    const campos = document.createElement("div");
    campos.className = "campos-linea";
    campos.append(
      campoNumero("Series", linea.series, (v) => (linea.series = v)),
      campoNumero("Repeticiones", linea.repeticiones, (v) => (linea.repeticiones = v), { tipo: "text" }),
      campoNumero("Descanso (s)", linea.descansoSeg, (v) => (linea.descansoSeg = v))
    );
    li.append(cabecera, campos);
    ol.append(li);
  });
}

function moverLinea(i, paso) {
  const j = i + paso;
  if (j < 0 || j >= lineas.length) return;
  [lineas[i], lineas[j]] = [lineas[j], lineas[i]];
  pintarLineas();
}

function quitarLinea(i) {
  lineas.splice(i, 1);
  pintarLineas();
}

$("btn-anadir").addEventListener("click", () => {
  const id = $("ej-select").value;
  if (!id) {
    mensaje("Elige un ejercicio de la lista.", true);
    return;
  }
  const ej = ejerciciosPorId.get(id);
  // Valores de partida habituales; se cambian en la propia línea.
  lineas.push({ ejercicioId: id, nombre: ej.nombre, series: 3, repeticiones: "8-12", descansoSeg: 90 });
  $("ej-buscar").value = "";
  pintarSelector();
  pintarLineas();
});

// Desplegable de ejercicios agrupado por grupo muscular, filtrado por el buscador.
// Al buscar se deja elegido el primero que coincide: buscar y "Añadir" son dos toques.
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
// Enter en el buscador añade el ejercicio elegido (y no envía el formulario de la rutina).
$("ej-buscar").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("btn-anadir").click();
  }
});

$("btn-nueva").addEventListener("click", () => abrirEditor());
$("btn-cancelar").addEventListener("click", () => mostrarVista(false));

$("form-rutina").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = {
    nombre: $("rut-nombre").value,
    ejercicios: lineas.map((l) => ({
      ejercicioId: l.ejercicioId,
      series: Number(l.series),
      repeticiones: leerRepeticiones(l.repeticiones),
      descansoSeg: l.descansoSeg === "" ? undefined : Number(l.descansoSeg),
    })),
  };
  const r = editandoId ? await apiActualizarRutina(editandoId, datos) : await apiCrearRutina(datos);
  if (!r.ok) {
    mensaje(r.error, true);
    // En el móvil el botón Guardar queda abajo: subir para que se vea el aviso.
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  mensaje(`Rutina "${r.datos.nombre}" guardada.`);
  mostrarVista(false);
  await cargarLista();
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
  ejerciciosPorId = new Map(catalogo.map((e) => [e.id, e]));
  pintarSelector();
}

pintarMenu(); // T-50: menú inferior
const sesion = await apiYo();
if (!sesion.ok) {
  location.href = "/";
} else {
  await Promise.all([cargarCatalogo(), cargarLista()]);
}
