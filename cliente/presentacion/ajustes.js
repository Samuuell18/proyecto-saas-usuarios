// Página de ajustes (T-43). Capa de PRESENTACIÓN: enseña la sesión y deja elegir la unidad
// de peso. La preferencia la guarda el servidor (vale en cualquier dispositivo) y es él quien
// convierte los pesos; aquí solo se elige. Toda la red pasa por rest.js.

import { apiYo, apiLogout, apiCambiarUnidad } from "../comunicacion/rest.js";

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
