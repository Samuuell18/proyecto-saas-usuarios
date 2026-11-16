// Página de historial (T-45). Capa de PRESENTACIÓN: enseña los entrenos terminados, del más
// reciente al más antiguo. El detalle de cada uno se pide al abrirlo (la lista solo trae el
// resumen) y los pesos ya llegan en la unidad del usuario (D-23). Toda la red pasa por rest.js.

import { apiYo, apiHistorial, apiEntreno, apiBorrarEntreno } from "../comunicacion/rest.js";

const $ = (id) => document.getElementById(id);

function mensaje(texto, esError = false) {
  $("mensaje").textContent = texto;
  $("mensaje").className = esError ? "error" : "ok";
}

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto; // textContent: sin riesgo de XSS
  return el;
}

function fecha(valor) {
  const d = new Date(valor);
  const dia = d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hora = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return `${dia.charAt(0).toLocaleUpperCase("es")}${dia.slice(1)} · ${hora}`;
}

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

// "60 kg × 10"; con peso 0, peso corporal.
function textoSerie(serie, unidad) {
  const peso = serie.peso === 0 ? "Peso corporal" : `${String(serie.peso).replace(".", ",")} ${unidad}`;
  return `${peso} × ${serie.repeticiones}`;
}

// Series seguidas del mismo ejercicio = un bloque (igual que en la pantalla del entreno).
function agruparEnBloques(series) {
  const bloques = [];
  for (const s of series) {
    const ultimo = bloques.at(-1);
    if (ultimo && ultimo.ejercicioId === s.ejercicioId) ultimo.series.push(s);
    else bloques.push({ ejercicioId: s.ejercicioId, nombre: s.nombre, series: [s] });
  }
  return bloques;
}

function pintarDetalle(contenedor, entreno, resumen) {
  contenedor.replaceChildren();
  for (const bloque of agruparEnBloques(entreno.series)) {
    contenedor.append(crear("h3", "", bloque.nombre));
    const lista = crear("ol", "series-historial");
    for (const serie of bloque.series) lista.append(crear("li", "", textoSerie(serie, entreno.unidad)));
    contenedor.append(lista);
  }
  const borrar = crear("button", "btn-peligro", "Borrar entreno");
  borrar.type = "button";
  borrar.addEventListener("click", async () => {
    if (!confirm(`¿Borrar "${resumen.nombre}" del ${fecha(resumen.inicio)}? No se puede deshacer.`)) return;
    const r = await apiBorrarEntreno(resumen.id);
    if (!r.ok) return mensaje(r.error, true);
    mensaje("Entreno borrado.");
    await cargar();
  });
  contenedor.append(borrar);
}

function tarjeta(resumen) {
  const item = crear("li", "panel tarjeta-historial");
  const detalles = document.createElement("details");
  detalles.dataset.id = resumen.id;
  const cabecera = document.createElement("summary");
  cabecera.append(
    crear("h2", "", resumen.nombre),
    crear("p", "", fecha(resumen.inicio)),
    crear(
      "p",
      "",
      `${resumen.duracionMin < 1 ? "Menos de 1 minuto" : plural(resumen.duracionMin, "minuto", "minutos")} · ${plural(resumen.numEjercicios, "ejercicio", "ejercicios")} · ${plural(resumen.numSeries, "serie", "series")}`
    )
  );
  const cuerpo = crear("div", "detalle-historial", "Cargando…");
  // El detalle se pide la primera vez que se abre.
  let cargado = false;
  detalles.addEventListener("toggle", async () => {
    if (!detalles.open || cargado) return;
    const r = await apiEntreno(resumen.id);
    if (!r.ok) {
      cuerpo.textContent = r.error;
      return;
    }
    cargado = true;
    pintarDetalle(cuerpo, r.datos, resumen);
  });
  detalles.append(cabecera, cuerpo);
  item.append(detalles);
  return item;
}

async function cargar() {
  const r = await apiHistorial();
  if (!r.ok) {
    mensaje(r.error, true);
    return;
  }
  const lista = $("lista-historial");
  lista.replaceChildren(...r.datos.map(tarjeta));
  $("resumen").textContent =
    r.datos.length === 0
      ? "Todavía no has terminado ningún entreno. Cuando termines uno, aparecerá aquí."
      : `${plural(r.datos.length, "entreno", "entrenos")}. Toca uno para ver sus series.`;
}

const sesion = await apiYo();
if (!sesion.ok) {
  location.href = "/";
} else {
  await cargar();
  // Al terminar un entreno se llega con ?abierto=<id>: se abre ese y se enseña arriba.
  const abierto = new URLSearchParams(location.search).get("abierto");
  const detalles = abierto && document.querySelector(`details[data-id="${CSS.escape(abierto)}"]`);
  if (detalles) {
    detalles.open = true;
    mensaje("Entreno guardado. ¡Buen trabajo!");
  }
}
