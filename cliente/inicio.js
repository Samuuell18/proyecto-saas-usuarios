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
    // textContent (no innerHTML): un email con HTML se muestra como texto, sin XSS.
    for (const [i, valor] of [u.email, u.rol, u.estado].entries()) {
      const td = document.createElement("td");
      if (i === 0) {
        td.textContent = valor;
      } else {
        // Rol y estado se muestran como etiqueta; el color lo decide el CSS por data-valor.
        const etiqueta = document.createElement("span");
        etiqueta.className = "etiqueta";
        etiqueta.dataset.valor = valor;
        etiqueta.textContent = valor;
        td.append(etiqueta);
      }
      fila.append(td);
    }
    const celda = document.createElement("td");
    // Una cuenta ya eliminada se sigue listando, pero sin botón.
    if (u.estado !== "eliminado") {
      const boton = document.createElement("button");
      boton.textContent = "Eliminar";
      boton.addEventListener("click", async () => {
        if (!confirm(`¿Eliminar la cuenta ${u.email}?`)) return;
        const del = await apiEliminar(u.email);
        // Si el admin se elimina a sí mismo, su sesión ya no existe.
        if (del.ok && u.email === sesion.datos.email) {
          location.href = "/?eliminada=1";
          return;
        }
        mensaje(del.ok ? `${u.email} eliminado.` : del.error, !del.ok);
        if (del.ok) await cargarAdmin();
      });
      celda.append(boton);
    }
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

// Cualquier usuario puede eliminar su propia cuenta (el servidor lo comprueba).
document.getElementById("btn-eliminar-cuenta")?.addEventListener("click", async () => {
  if (!confirm("¿Seguro que quieres eliminar tu cuenta? No podrás volver a entrar.")) return;
  const del = await apiEliminar(sesion.datos.email);
  if (del.ok) {
    location.href = "/?eliminada=1";
  } else {
    mensaje(del.error, true);
  }
});
