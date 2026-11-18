// "¿Olvidaste tu contraseña?" (T-90). Capa de PRESENTACIÓN: pide el enlace por correo o, si se llega
// desde el correo (con ?token=...), deja poner la contraseña nueva. Las reglas (caducidad de 1 hora,
// un solo uso, mínimo 8 caracteres) las aplica el servidor. Toda la red pasa por rest.js.

import { apiPedirRecuperacion, apiRestablecerPassword } from "../comunicacion/rest.js";

const $ = (id) => document.getElementById(id);

function mensaje(texto, esError = false) {
  $("mensaje").textContent = texto;
  $("mensaje").className = esError ? "error" : "ok";
}

const token = new URLSearchParams(location.search).get("token");
$("vista-pedir").hidden = Boolean(token);
$("vista-nueva").hidden = !token;
// El token no se queda en la barra de direcciones (ni en el historial) una vez leído.
if (token) history.replaceState(null, "", location.pathname);

$("form-pedir").addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = e.submitter;
  boton.disabled = true;
  const r = await apiPedirRecuperacion($("rec-email").value);
  boton.disabled = false;
  // El servidor responde lo mismo exista o no la cuenta: no se puede saber qué emails están dados de alta.
  mensaje(r.ok ? `${r.datos.mensaje} Mira también el spam.` : r.error, !r.ok);
});

$("form-nueva").addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = await apiRestablecerPassword(token, $("rec-nueva").value);
  if (r.ok) {
    location.href = "/?restablecida=1";
    return;
  }
  mensaje(r.error, true);
  // Enlace caducado o ya usado: se ofrece pedir otro desde la misma página.
  if (/caducado|no es válido/.test(r.error ?? "")) {
    $("vista-pedir").hidden = false;
    $("vista-nueva").hidden = true;
  }
});
