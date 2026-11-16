// Página de progreso (T-48). Capa de PRESENTACIÓN: enseña las métricas que calcula el servidor
// (las cuentas están en logica.js, D-25) y las dibuja con graficos.js. Los pesos y volúmenes ya
// llegan en la unidad del usuario. Toda la red pasa por rest.js.

import { apiYo, apiMetricas, apiProgresoEjercicio } from "../comunicacion/rest.js";
import { barras, linea } from "./graficos.js";

const $ = (id) => document.getElementById(id);
const numero = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });

function mensaje(texto, esError = false) {
  $("mensaje").textContent = texto;
  $("mensaje").className = esError ? "error" : "ok";
}

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

// "2026-11-09" (lunes de la semana, sin hora) -> "9 nov".
function diaCorto(semana) {
  return new Date(`${semana}T00:00:00Z`).toLocaleDateString("es", { day: "numeric", month: "short", timeZone: "UTC" });
}

function fechaCorta(valor) {
  return new Date(valor).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

// "100 kg × 5"; con peso 0, peso corporal.
function textoSerie(peso, repeticiones, unidad) {
  return `${peso === 0 ? "Peso corporal" : `${numero.format(peso)} ${unidad}`} × ${repeticiones}`;
}

function pintarResumen(metricas) {
  const actual = metricas.semanas.at(-1);
  const total = metricas.semanas.reduce((suma, s) => suma + s.entrenos, 0);
  $("cifra-semana").textContent = actual.entrenos;
  $("cifra-total").textContent = total;
  $("cifra-volumen").textContent = numero.format(actual.volumen);
  $("texto-volumen").textContent = `${metricas.unidad} de volumen esta semana`;
  $("resumen").textContent =
    total === 0
      ? "Todavía no hay entrenos terminados en las últimas 8 semanas. Cuando termines uno, aquí verás cómo progresas."
      : "Tu actividad de las últimas semanas y la evolución de cada ejercicio.";

  $("grafico-semanas").replaceChildren(
    barras(
      metricas.semanas.map((s) => ({
        etiqueta: diaCorto(s.semana),
        valor: s.entrenos,
        titulo: `Semana del ${diaCorto(s.semana)}: ${plural(s.entrenos, "entreno", "entrenos")}, ${numero.format(s.volumen)} ${metricas.unidad} de volumen`,
      })),
      { descripcion: "Entrenos por semana en las últimas 8 semanas", formato: (v) => numero.format(v) }
    )
  );
}

function pintarRecords(metricas) {
  const lista = $("lista-records");
  lista.replaceChildren(
    ...metricas.records.map((r) => {
      const item = document.createElement("li");
      const nombre = document.createElement("strong");
      nombre.textContent = r.nombre; // textContent: sin riesgo de XSS
      const record = document.createElement("span");
      record.className = "record-serie";
      record.textContent = textoSerie(r.record.peso, r.record.repeticiones, metricas.unidad);
      const detalle = document.createElement("small");
      detalle.textContent = `${plural(r.sesiones, "entreno", "entrenos")} · récord el ${fechaCorta(r.record.fecha)}`;
      item.append(nombre, record, detalle);
      return item;
    })
  );
  $("panel-records").hidden = metricas.records.length === 0;
}

async function pintarEjercicio(ejercicioId) {
  const r = await apiProgresoEjercicio(ejercicioId);
  if (!r.ok) {
    mensaje(r.error, true);
    return;
  }
  const { puntos, unidad, nombre } = r.datos;
  // Si siempre fue a peso corporal, lo que progresa son las repeticiones.
  const conPeso = puntos.some((p) => p.pesoMax > 0);
  $("texto-ejercicio").textContent = conPeso
    ? `Peso máximo (${unidad}) en cada entreno de ${nombre}.`
    : `Peso corporal: repeticiones de la mejor serie en cada entreno de ${nombre}.`;
  $("grafico-ejercicio").replaceChildren(
    linea(
      puntos.map((p) => ({
        etiqueta: fechaCorta(p.fecha),
        valor: conPeso ? p.pesoMax : p.mejorSerie.repeticiones,
        titulo: `${fechaCorta(p.fecha)}: ${textoSerie(p.mejorSerie.peso, p.mejorSerie.repeticiones, unidad)}`,
      })),
      { descripcion: `Evolución de ${nombre}`, formato: (v) => numero.format(v) }
    )
  );
}

function prepararSelector(metricas) {
  const selector = $("ejercicio");
  selector.replaceChildren(
    ...metricas.records.map((r) => {
      const opcion = document.createElement("option");
      opcion.value = r.ejercicioId;
      opcion.textContent = `${r.nombre} (${plural(r.sesiones, "entreno", "entrenos")})`;
      return opcion;
    })
  );
  $("panel-ejercicio").hidden = metricas.records.length === 0;
  if (metricas.records.length > 0) pintarEjercicio(selector.value); // el más entrenado
}

$("ejercicio").addEventListener("change", (e) => pintarEjercicio(e.target.value));

const sesion = await apiYo();
if (!sesion.ok) {
  location.href = "/";
} else {
  const r = await apiMetricas();
  if (!r.ok) {
    mensaje(r.error, true);
  } else {
    pintarResumen(r.datos);
    prepararSelector(r.datos);
    pintarRecords(r.datos);
  }
}
