// Página de inicio: solo se ve con sesión válida.
// Si no hay sesión, vuelve al acceso. El panel admin solo se muestra;
// quien decide es el servidor (403 si no eres admin).

import { apiYo, apiUsuarios, apiEliminar, apiEntrenoActual, apiCambiarNombre } from "../comunicacion/rest.js";
import { pintarMenu } from "./navegacion.js";

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
    for (const [i, valor] of [u.nombre ?? "—", u.email, u.rol, u.estado].entries()) {
      const td = document.createElement("td");
      if (i < 2) {
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

// T-60: saludo con el nombre (sin nombre todavía, solo "Hola").
function saludar(nombre) {
  document.getElementById("saludo").textContent = nombre ? `Hola, ${nombre}` : "Hola";
}

// T-60: una cuenta sin nombre tiene que escribirlo; la ventana no se puede cerrar sin guardarlo.
function pedirNombre() {
  const dialogo = document.getElementById("dialogo-nombre");
  dialogo.addEventListener("cancel", (e) => e.preventDefault()); // Esc no la cierra
  document.getElementById("form-pedir-nombre").addEventListener("submit", async (e) => {
    e.preventDefault();
    const r = await apiCambiarNombre(document.getElementById("pedir-nombre").value);
    if (!r.ok) {
      document.getElementById("error-nombre").textContent = r.error;
      return;
    }
    saludar(r.datos.nombre);
    dialogo.close();
  });
  dialogo.showModal();
}

// T-39: si hay un entreno a medias, la tarjeta "Entrenar" lo dice (al pulsarla se retoma).
async function avisarEntrenoEnCurso(peticion) {
  const r = await peticion;
  if (!r.ok || !r.datos) return;
  const etiqueta = document.getElementById("etiqueta-entrenar");
  etiqueta.textContent = "En curso";
  etiqueta.dataset.valor = "en-curso";
  document.getElementById("texto-entrenar").textContent =
    `Tienes a medias "${r.datos.rutinaNombre ?? "Entreno libre"}": sigue donde lo dejaste.`;
}

pintarMenu(); // T-50: menú inferior
// T-59: los datos se piden A LA VEZ que la sesión (no después): la página tarda un viaje menos.
// Si no hay sesión, se va al acceso sin enseñar nada.
const [sesion, entrenoActual] = await Promise.all([apiYo(), apiEntrenoActual()]);
if (!sesion.ok) {
  location.href = "/";
} else {
  saludar(sesion.datos.nombre);
  if (!sesion.datos.nombre) pedirNombre();
  await avisarEntrenoEnCurso(entrenoActual);
  if (sesion.datos.rol === "admin") await cargarAdmin();
}
