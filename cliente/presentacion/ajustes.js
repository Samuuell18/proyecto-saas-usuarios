// Página de perfil y ajustes (T-43; en el menú inferior se llama "Perfil" desde T-50). Capa de PRESENTACIÓN: enseña la sesión y deja elegir la unidad
// de peso. La preferencia la guarda el servidor (vale en cualquier dispositivo) y es él quien
// convierte los pesos; aquí solo se elige. Toda la red pasa por rest.js.

import { apiYo, apiLogout, apiCambiarUnidad, apiEliminar } from "../comunicacion/rest.js";
import { pintarMenu } from "./navegacion.js";
import { alCambiarInstalacion, modoActual, instalar } from "./pwa.js";

const $ = (id) => document.getElementById(id);

function mensaje(texto, esError = false) {
  $("mensaje").textContent = texto;
  $("mensaje").className = esError ? "error" : "ok";
}

function marcarUnidad(unidad) {
  for (const radio of document.querySelectorAll('input[name="unidad"]')) {
    radio.checked = radio.value === unidad;
  }
}

pintarMenu(); // T-50: menú inferior
const sesion = await apiYo();
if (!sesion.ok) {
  location.href = "/";
} else {
  const { email, rol, unidadPeso } = sesion.datos;
  $("sesion-email").textContent = email;
  $("sesion-rol").textContent = rol === "admin" ? "Administrador" : "Usuario";
  marcarUnidad(unidadPeso);
  $("unidad-peso").disabled = false;
}

let unidadActual = sesion.datos?.unidadPeso;

$("unidad-peso").addEventListener("change", async (e) => {
  const unidad = e.target.value;
  $("unidad-peso").disabled = true; // de una en una
  const r = await apiCambiarUnidad(unidad);
  $("unidad-peso").disabled = false;
  if (r.ok) {
    unidadActual = r.datos.unidadPeso;
    mensaje(`Guardado: los pesos se mostrarán en ${unidadActual}.`);
  } else {
    marcarUnidad(unidadActual); // si falla, vuelve a la que había
    mensaje(r.error, true);
  }
});

$("btn-logout").addEventListener("click", async () => {
  await apiLogout();
  location.href = "/";
});

// Cualquier usuario puede eliminar su propia cuenta (el servidor lo comprueba). Venía del inicio.
$("btn-eliminar-cuenta").addEventListener("click", async () => {
  if (!confirm("¿Seguro que quieres eliminar tu cuenta? No podrás volver a entrar.")) return;
  const r = await apiEliminar(sesion.datos.email);
  if (r.ok) location.href = "/?eliminada=1";
  else mensaje(r.error, true);
});

// T-54: instalar la app. Android: nuestro botón abre la ventana del navegador.
// iPhone: no hay botón posible, se explican los pasos. Ya instalada: se dice y nada más.
function pintarInstalacion() {
  const modo = modoActual();
  $("panel-instalar").hidden = modo === "nada";
  $("btn-instalar").hidden = modo !== "boton";
  $("pasos-ios").hidden = !modo.startsWith("ios");
  $("donde-compartir").textContent =
    modo === "ios-safari" ? "(el cuadrado con la flecha, abajo en Safari)" : "(arriba, junto a la barra de direcciones)";
  $("texto-instalar").textContent = {
    instalada: "Ya estás usando Fitness Hub como app.",
    boton: "Tenla en tu pantalla de inicio y ábrela a pantalla completa, como cualquier otra app.",
    "ios-safari": "En iPhone se instala desde el menú de compartir:",
    "ios-otro": "En iPhone se instala desde el menú de compartir del navegador:",
  }[modo] ?? "";
}

alCambiarInstalacion(pintarInstalacion);

$("btn-instalar").addEventListener("click", async () => {
  if (await instalar()) mensaje("Instalando Fitness Hub en tu pantalla de inicio.");
});
