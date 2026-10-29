// Capa de presentacion: maneja el DOM y llama a rest.js.
// No sabe nada de HTTP ni de la BBDD.

import { apiRegistro, apiLogin, apiLogout, apiYo } from "./rest.js";

const $ = (id) => document.getElementById(id);

function mensaje(texto, esError = false) {
  const el = $("mensaje");
  el.textContent = texto;
  el.className = esError ? "error" : "ok";
}

async function refrescarSesion() {
  const sesion = await apiYo();
  $("estado").textContent = sesion.ok ? `Sesión: ${sesion.datos.email}` : "Sin sesión";
}

function cambiarPestana(cual) {
  const esLogin = cual === "login";
  $("panel-login").hidden = !esLogin;
  $("panel-registro").hidden = esLogin;
  $("tab-login").classList.toggle("activa", esLogin);
  $("tab-registro").classList.toggle("activa", !esLogin);
}

$("tab-login")?.addEventListener("click", () => cambiarPestana("login"));
$("tab-registro")?.addEventListener("click", () => cambiarPestana("registro"));

$("form-registro")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = await apiRegistro($("reg-email").value, $("reg-pass").value);
  mensaje(r.ok ? "Cuenta creada. Revisa tu email (y el spam) para activarla." : r.error, !r.ok);
  await refrescarSesion();
});

$("form-login")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = await apiLogin($("log-email").value, $("log-pass").value);
  if (r.ok) {
    location.href = "/inicio.html";
    return;
  }
  mensaje(r.error, true);
  await refrescarSesion();
});

$("btn-logout")?.addEventListener("click", async () => {
  await apiLogout();
  mensaje("Sesión cerrada.");
  await refrescarSesion();
});

// Avisos que llegan en la URL tras una redirección del servidor
// (confirmar email, OAuth) o tras eliminar la propia cuenta.
const AVISOS = {
  confirmado: { texto: "Cuenta confirmada. Ya puedes iniciar sesión.", esError: false },
  eliminada: { texto: "Tu cuenta se ha eliminado.", esError: false },
  token: { texto: "El enlace de confirmación no es válido o ya se usó.", esError: true },
  oauth: { texto: "No se pudo entrar con GitHub. Inténtalo de nuevo.", esError: true },
};

function mostrarAvisoDeUrl() {
  const params = new URLSearchParams(location.search);
  const clave = params.get("error") ?? ["confirmado", "eliminada"].find((k) => params.has(k));
  const aviso = AVISOS[clave];
  if (!aviso) return;
  mensaje(aviso.texto, aviso.esError);
  // Limpia la URL para que el aviso no se repita al recargar.
  history.replaceState(null, "", location.pathname);
}

mostrarAvisoDeUrl();
refrescarSesion();
