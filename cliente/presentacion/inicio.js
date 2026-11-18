// Página de inicio, pantalla "Hoy" (T-61): solo se ve con sesión válida.
// Si no hay sesión, vuelve al acceso. Qué rutina toca, la racha y el último récord los calcula
// el servidor (logica.js); aquí solo se enseñan. El panel admin solo se muestra;
// quien decide es el servidor (403 si no eres admin).

import { apiYo, apiHoy, apiUsuarios, apiEliminar, apiIniciarEntreno, apiCambiarNombre } from "../comunicacion/rest.js";
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

const $ = (id) => document.getElementById(id);

// "hoy", "ayer", "hace 5 días" (por días del calendario, no por horas).
function haceCuanto(fecha) {
  const dia = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((dia(new Date()) - dia(new Date(fecha))) / 86400000);
  return new Intl.RelativeTimeFormat("es", { numeric: "auto" }).format(-dias, "day");
}

function formatoPeso(peso, unidad) {
  return Number(peso).toLocaleString("es", { maximumFractionDigits: 2 }) + " " + unidad;
}

// La tarjeta principal: un solo botón grande con lo siguiente que hacer.
function pintarTarjeta(hoy) {
  const accion = $("hoy-accion");
  accion.hidden = false;
  $("hoy-libre").hidden = Boolean(hoy.enCurso);
  $("hoy-progreso").hidden = !hoy.enCurso;
  if (hoy.enCurso) {
    const { hechas, total } = hoy.enCurso;
    $("hoy-etiqueta").textContent = "Entreno en curso";
    $("hoy-titulo").textContent = hoy.enCurso.rutinaNombre ?? "Entreno libre";
    // T-75: el avance como marcador: "1 / 7 series" y una barra.
    $("hoy-hechas").textContent = hechas;
    $("hoy-total").textContent = `/ ${total} ${total === 1 ? "serie" : "series"}`;
    $("hoy-barra").style.width = total > 0 ? `${Math.round((hechas / total) * 100)}%` : "0";
    $("hoy-detalle").textContent = "Sigue donde lo dejaste.";
    accion.textContent = "Continuar entreno";
    accion.onclick = () => (location.href = "/entreno.html");
  } else if (hoy.sugerida) {
    $("hoy-etiqueta").textContent = "Te toca";
    $("hoy-titulo").textContent = hoy.sugerida.nombre;
    $("hoy-detalle").textContent = hoy.sugerida.ultimaVez
      ? `La hiciste por última vez ${haceCuanto(hoy.sugerida.ultimaVez)}.`
      : "Todavía no la has estrenado.";
    accion.textContent = "Empezar";
    accion.onclick = async () => {
      accion.disabled = true;
      const r = await apiIniciarEntreno(hoy.sugerida.id);
      // 409 = ya había uno en curso (por ejemplo, en otro móvil): entreno.html lo retoma.
      if (r.ok || r.status === 409) {
        location.href = "/entreno.html";
        return;
      }
      accion.disabled = false;
      mensaje(r.error, true);
    };
  } else {
    $("hoy-etiqueta").textContent = "Empieza aquí";
    $("hoy-titulo").textContent = "Crea tu primera rutina";
    $("hoy-detalle").textContent = "Elige tus ejercicios una vez y entrena con un toque.";
    accion.textContent = "Crear rutina";
    accion.onclick = () => (location.href = "/rutinas.html");
  }
}

function pintarCifras(hoy) {
  $("cifra-semana").textContent = hoy.estaSemana;
  $("cifra-racha").textContent = hoy.racha;
  $("texto-racha").innerHTML = hoy.racha === 1 ? "semana<br />seguida" : "semanas<br />seguidas";
  const record = hoy.ultimoRecord;
  if (record) {
    // Con peso 0 (peso corporal) el récord son las repeticiones.
    $("cifra-record").textContent =
      record.peso > 0 ? formatoPeso(record.peso, hoy.unidad) : `${record.repeticiones} reps`;
    $("texto-record").textContent = record.nombre;
    $("texto-record").title = `${record.nombre}: ${record.repeticiones} repeticiones, ${haceCuanto(record.fecha)}`;
  } else {
    $("texto-record").innerHTML = "sin récords<br />todavía";
  }
}

pintarMenu(); // T-50: menú inferior
$("fecha-hoy").textContent = capitalizar(
  new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })
);
// T-59: los datos se piden A LA VEZ que la sesión (no después): la página tarda un viaje menos.
// Si no hay sesión, se va al acceso sin enseñar nada.
const [sesion, hoy] = await Promise.all([apiYo(), apiHoy()]);
if (!sesion.ok) {
  location.href = "/";
} else {
  saludar(sesion.datos.nombre);
  if (!sesion.datos.nombre) pedirNombre();
  if (hoy.ok) {
    pintarTarjeta(hoy.datos);
    pintarCifras(hoy.datos);
  } else {
    $("hoy-etiqueta").textContent = "No se pudo cargar";
  }
  if (sesion.datos.rol === "admin") await cargarAdmin();
}

function capitalizar(texto) {
  return texto.charAt(0).toLocaleUpperCase("es") + texto.slice(1);
}
