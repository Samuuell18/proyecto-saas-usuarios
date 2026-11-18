// Onboarding (T-87). Capa de PRESENTACIÓN: tres pantallas que se ven una vez por dispositivo
// (decisión del alumno): la promesa de la app, el objetivo semanal y la unidad, y el primer paso.
// Que ya se vio se guarda en el navegador (localStorage, clave "forja-bienvenida"); el objetivo y la
// unidad sí van al servidor, porque son de la cuenta. Toda la red pasa por rest.js.

import { apiYo, apiCambiarObjetivo, apiCambiarUnidad, apiIniciarEntreno } from "../comunicacion/rest.js";

const $ = (id) => document.getElementById(id);
const CLAVE = "forja-bienvenida";
const TOTAL = 3;
let paso = 1;
let unidadInicial = "kg";

// Se marca como vista al terminar o al saltar: no vuelve a salir en este dispositivo.
function marcarVista() {
  try {
    localStorage.setItem(CLAVE, "vista");
  } catch {
    // Sin almacenamiento (modo privado): no pasa nada, inicio.js no insiste.
  }
}

function ir(destino) {
  marcarVista();
  location.href = destino;
}

function elegido(nombre) {
  return document.querySelector(`input[name=${nombre}]:checked`)?.value ?? null;
}

function pintar() {
  for (let n = 1; n <= TOTAL; n++) $(`paso-${n}`).hidden = n !== paso;
  document.body.classList.toggle("intro-oscura", paso === 1); // la portada va sobre carbón
  $("btn-atras").hidden = paso === 1;
  $("btn-seguir").hidden = paso === TOTAL; // en el último paso, cada opción ya es un botón
  $("btn-seguir").textContent = paso === 1 ? "Empezar" : "Seguir";
  document.querySelectorAll(".intro-indicador span").forEach((punto, i) => {
    punto.classList.toggle("activo", i === paso - 1);
  });
  $("mensaje").textContent = "";
  $(`titulo-${paso}`).focus?.();
  window.scrollTo(0, 0);
}

// Paso 2: se guarda lo elegido antes de seguir (el objetivo es opcional; la unidad, si cambió).
async function guardarPaso2() {
  const objetivo = elegido("objetivo");
  const unidad = elegido("unidad");
  const peticiones = [];
  if (objetivo) peticiones.push(apiCambiarObjetivo(Number(objetivo)));
  if (unidad && unidad !== unidadInicial) peticiones.push(apiCambiarUnidad(unidad));
  const respuestas = await Promise.all(peticiones);
  const fallo = respuestas.find((r) => !r.ok);
  if (fallo) {
    $("mensaje").textContent = fallo.error ?? "No se pudo guardar. Inténtalo de nuevo.";
    return false;
  }
  return true;
}

$("btn-seguir").addEventListener("click", async () => {
  if (paso === 2) {
    $("btn-seguir").disabled = true;
    const ok = await guardarPaso2();
    $("btn-seguir").disabled = false;
    if (!ok) return;
  }
  paso = Math.min(paso + 1, TOTAL);
  pintar();
});

$("btn-atras").addEventListener("click", () => {
  paso = Math.max(paso - 1, 1);
  pintar();
});

$("btn-saltar").addEventListener("click", () => ir("/inicio.html"));
$("op-rutina").addEventListener("click", () => ir("/rutinas.html?nueva=1"));
$("op-inicio").addEventListener("click", () => ir("/inicio.html"));
$("op-libre").addEventListener("click", async () => {
  $("op-libre").disabled = true;
  const r = await apiIniciarEntreno(null);
  // 409 = ya había un entreno en curso: entreno.html lo retoma.
  ir(r.ok || r.status === 409 ? "/entreno.html" : "/inicio.html");
});

// Sin sesión no hay nada que configurar: al acceso. Con sesión, se marca lo que ya tenía la cuenta.
const sesion = await apiYo();
if (!sesion.ok) {
  location.href = "/";
} else {
  unidadInicial = sesion.datos.unidadPeso ?? "kg";
  document.querySelector(`input[name=unidad][value=${unidadInicial}]`).checked = true;
  if (sesion.datos.objetivoSemanal) {
    document.querySelector(`input[name=objetivo][value="${sesion.datos.objetivoSemanal}"]`).checked = true;
  }
  pintar();
}
