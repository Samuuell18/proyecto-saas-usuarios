// Página de ejercicios (T-32). Capa de PRESENTACIÓN: pinta lo que devuelve la API y
// solo habla con el servidor a través de rest.js. Buscar y filtrar es solo visual:
// qué ejercicios puede ver cada usuario lo decide el servidor.

import { apiYo, apiEjercicios, apiGrupos, apiCrearEjercicio } from "../comunicacion/rest.js";
import { palabrasDe, coincide } from "./busqueda.js";

const $ = (id) => document.getElementById(id);
let ejercicios = [];
let grupos = [];

function mensaje(texto, esError = false) {
  $("mensaje").textContent = texto;
  $("mensaje").className = esError ? "error" : "ok";
}

function capitalizar(texto) {
  return texto.charAt(0).toLocaleUpperCase("es") + texto.slice(1);
}

function opcion(valor, texto) {
  const el = document.createElement("option");
  el.value = valor;
  el.textContent = texto;
  return el;
}

// Un ejercicio de la lista. textContent (no innerHTML): un nombre con HTML se ve como texto.
function itemEjercicio(ej, texto = ej.nombre) {
  const li = document.createElement("li");
  li.textContent = texto;
  if (!ej.base) {
    const etiqueta = document.createElement("span");
    etiqueta.className = "etiqueta";
    etiqueta.dataset.valor = "propio";
    etiqueta.textContent = "Tuyo";
    li.append(" ", etiqueta);
  }
  return li;
}

// Agrupa por familia manteniendo el orden en que llegan.
function porFamilia(lista) {
  const familias = new Map();
  for (const ej of lista) {
    if (!familias.has(ej.familia)) familias.set(ej.familia, []);
    familias.get(ej.familia).push(ej);
  }
  return familias;
}

function pintar() {
  const palabras = palabrasDe($("buscar").value);
  const grupo = $("filtro-grupo").value;
  const visibles = ejercicios.filter((ej) => (!grupo || ej.grupo === grupo) && coincide(ej, palabras));
  $("resumen").textContent =
    visibles.length === ejercicios.length
      ? `${ejercicios.length} ejercicios. Toca una familia para ver sus variantes.`
      : `${visibles.length} de ${ejercicios.length} ejercicios.`;

  const contenedor = $("lista-ejercicios");
  contenedor.replaceChildren();
  if (visibles.length === 0) {
    const vacio = document.createElement("p");
    vacio.className = "panel vacio";
    vacio.textContent = "No hay ejercicios con ese filtro.";
    contenedor.append(vacio);
    return;
  }

  // Un bloque por grupo muscular, en el orden de la API.
  for (const g of grupos) {
    const delGrupo = visibles.filter((ej) => ej.grupo === g);
    if (delGrupo.length === 0) continue;
    const seccion = document.createElement("section");
    seccion.className = "panel grupo-ejercicios";
    const titulo = document.createElement("h2");
    titulo.textContent = capitalizar(g);
    const cuenta = document.createElement("span");
    cuenta.className = "cuenta";
    cuenta.textContent = delGrupo.length;
    titulo.append(" ", cuenta);
    const lista = document.createElement("ul");
    lista.className = "familias";

    for (const [familia, variantes] of porFamilia(delGrupo)) {
      // Ejercicio sin variantes: una línea, sin desplegable.
      if (variantes.length === 1 && variantes[0].nombre === familia) {
        lista.append(itemEjercicio(variantes[0]));
        continue;
      }
      const li = document.createElement("li");
      const detalles = document.createElement("details");
      detalles.open = palabras.length > 0; // al buscar, se ven las variantes que coinciden
      const resumen = document.createElement("summary");
      resumen.textContent = `${familia} `;
      const n = document.createElement("span");
      n.className = "cuenta";
      n.textContent = variantes.length;
      resumen.append(n);
      const sub = document.createElement("ul");
      sub.className = "variantes";
      for (const ej of variantes) sub.append(itemEjercicio(ej));
      detalles.append(resumen, sub);
      li.append(detalles);
      lista.append(li);
    }
    seccion.append(titulo, lista);
    contenedor.append(seccion);
  }
}

async function cargarEjercicios() {
  const r = await apiEjercicios();
  if (!r.ok) {
    mensaje(r.error, true);
    return;
  }
  ejercicios = r.datos;
  // Sugerencias para "Variante de…": las familias que ya existen.
  const familias = [...new Set(ejercicios.map((ej) => ej.familia))];
  $("familias").replaceChildren(...familias.map((f) => opcion(f, f)));
  pintar();
}

const sesion = await apiYo();
if (!sesion.ok) {
  location.href = "/";
} else {
  const r = await apiGrupos();
  grupos = r.ok ? r.datos : [];
  for (const g of grupos) {
    $("filtro-grupo").append(opcion(g, capitalizar(g)));
    $("ej-grupo").append(opcion(g, capitalizar(g)));
  }
  await cargarEjercicios();
}

$("buscar").addEventListener("input", pintar);
$("filtro-grupo").addEventListener("change", pintar);

$("form-ejercicio").addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = await apiCrearEjercicio({
    nombre: $("ej-nombre").value,
    familia: $("ej-familia").value,
    grupo: $("ej-grupo").value,
  });
  if (!r.ok) {
    mensaje(r.error, true);
    return;
  }
  mensaje(`"${r.datos.nombre}" añadido a tus ejercicios.`);
  $("form-ejercicio").reset();
  $("form-ejercicio").closest("details").open = false; // plegar para ver el resultado
  // Se muestra el nuevo: se busca por su nombre.
  $("buscar").value = r.datos.nombre;
  $("filtro-grupo").value = "";
  await cargarEjercicios();
});
