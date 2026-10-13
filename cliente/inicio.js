// Página de inicio: solo se ve con sesión válida.
// Si no hay sesión, vuelve al acceso. El panel admin solo se muestra;
// quien decide es el servidor (403 si no eres admin).

import { apiYo, apiLogout, apiUsuarios, apiEliminar } from "./rest.js";

function mensaje(texto, esError = false) {
  const el = document.getElementById("mensaje");
  el.textContent = texto;
  el.className = esError ? "error" : "ok";
}

async function cargarAdmin() {
  const r = await apiUsuarios();
  if (!r.ok) return; // No eres admin: el panel sigue oculto.
  document.getElementById("panel-admin").hidden = false;
  const cuerpo = document.querySelector("#tabla-usuarios tbody");
  cuerpo.innerHTML = "";
  for (const u of r.datos) {
    const fila = document.createElement("tr");
    fila.innerHTML = `<td>${u.email}</td><td>${u.rol}</td><td>${u.estado}</td>`;
    const boton = document.createElement("button");
    boton.textContent = "Eliminar";
    boton.addEventListener("click", async () => {
      const del = await apiEliminar(u.email);
      mensaje(del.ok ? `${u.email} eliminado.` : del.error, !del.ok);
      if (del.ok) await cargarAdmin();
    });
    const celda = document.createElement("td");
    celda.append(boton);
    fila.append(celda);
    cuerpo.append(fila);
  }
}

const sesion = await apiYo();
if (!sesion.ok) {
  location.href = "/";
} else {
  document.getElementById("estado").textContent = `Sesión: ${sesion.datos.email}`;
  document.getElementById("saludo").textContent = `Hola, ${sesion.datos.email}`;
  if (sesion.datos.rol === "admin") await cargarAdmin();
}

document.getElementById("btn-logout")?.addEventListener("click", async () => {
  await apiLogout();
  location.href = "/";
});
