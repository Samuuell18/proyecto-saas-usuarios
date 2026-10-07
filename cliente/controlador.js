// Capa de presentacion: maneja el DOM y llama a rest.js.
// No sabe nada de HTTP ni de la BBDD.

import { apiRegistro, apiLogin, apiLogout, apiYo } from "./rest.js";

const $ = (id) => document.getElementById(id);

function mensaje(texto, esError = false) {
  const el = $("mensaje");
  el.textContent = texto;
  el.style.color = esError ? "crimson" : "green";
}

async function refrescarSesion() {
  const sesion = await apiYo();
  $("estado").textContent = sesion.ok ? `Sesión: ${sesion.datos.email}` : "Sin sesión";
}

$("form-registro")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = await apiRegistro($("reg-email").value, $("reg-pass").value);
  mensaje(r.ok ? "Cuenta creada (pendiente de activar)." : r.error, !r.ok);
  await refrescarSesion();
});

$("form-login")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = await apiLogin($("log-email").value, $("log-pass").value);
  mensaje(r.ok ? `Bienvenido ${r.datos.email}.` : r.error, !r.ok);
  await refrescarSesion();
});

$("btn-logout")?.addEventListener("click", async () => {
  await apiLogout();
  mensaje("Sesión cerrada.");
  await refrescarSesion();
});

refrescarSesion();
