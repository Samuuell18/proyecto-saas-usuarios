// Página de inicio: solo se ve con sesión válida.
// Si no hay sesión, vuelve al acceso. No decide permisos, solo redirige;
// las restricciones reales están en el servidor.

import { apiYo, apiLogout } from "./rest.js";

const sesion = await apiYo();
if (!sesion.ok) {
  location.href = "/";
} else {
  document.getElementById("estado").textContent = `Sesión: ${sesion.datos.email}`;
  document.getElementById("saludo").textContent = `Hola, ${sesion.datos.email}`;
}

document.getElementById("btn-logout")?.addEventListener("click", async () => {
  await apiLogout();
  location.href = "/";
});
