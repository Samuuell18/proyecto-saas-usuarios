// Página de perfil y ajustes (T-43; en el menú inferior se llama "Perfil" desde T-50). Capa de PRESENTACIÓN: enseña la sesión y deja elegir la unidad
// de peso. La preferencia la guarda el servidor (vale en cualquier dispositivo) y es él quien
// convierte los pesos; aquí solo se elige. Toda la red pasa por rest.js.

import {
  apiPerfil,
  apiCambiarObjetivo,
  apiCambiarPassword,
  apiLogout,
  apiCambiarUnidad,
  apiCambiarNombre,
  apiEliminar,
  apiClaveAvisos,
  apiActivarAvisos,
  apiDesactivarAvisos,
  apiAvisoPrueba,
} from "../comunicacion/rest.js";
import { pintarMenu } from "./navegacion.js";
import { alCambiarInstalacion, modoActual, instalar, estadoAvisos, suscribirAvisos, quitarAvisos } from "./pwa.js";

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

// T-88: la cabecera (inicial, nombre, desde cuándo) y las cifras.
function pintarCabecera(nombre) {
  const limpio = (nombre ?? "").trim();
  $("perfil-titulo").textContent = limpio || "Tu perfil";
  $("perfil-inicial").textContent = limpio ? limpio[0].toLocaleUpperCase("es") : "·";
  $("perfil-nombre").value = limpio;
}

function pintarObjetivo(objetivo) {
  $("objetivo-semanal").value = objetivo ? String(objetivo) : "";
  $("perfil-objetivo").textContent = objetivo ? `${objetivo}/sem` : "–";
}

const TEXTO_ACCESO = { email: "Email y contraseña", google: "Google" };

pintarMenu(); // T-50: menú inferior
// T-88: una sola petición con todo lo del perfil (cuenta, cifras y cómo entras).
const sesion = await apiPerfil();
if (!sesion.ok) {
  location.href = "/";
} else {
  const { email, nombre, rol, unidadPeso, objetivoSemanal, acceso, desde, entrenos, records } = sesion.datos;
  pintarCabecera(nombre);
  const mes = new Date(desde).toLocaleDateString("es", { month: "long", year: "numeric" });
  $("perfil-desde").textContent = desde ? `En Forja desde ${mes}` : email;
  $("perfil-entrenos").textContent = entrenos;
  $("perfil-records").textContent = records;
  pintarObjetivo(objetivoSemanal);
  $("sesion-email").textContent = email;
  $("perfil-acceso").textContent = TEXTO_ACCESO[acceso] ?? "Email o Google";
  $("fila-rol").hidden = rol !== "admin"; // el rol solo se enseña si eres administrador
  $("fila-password").hidden = acceso === "google"; // T-89: con Google no hay contraseña que cambiar
  marcarUnidad(unidadPeso);
  $("unidad-peso").disabled = false;
}

let unidadActual = sesion.datos?.unidadPeso;

// T-88: el nombre se edita al pulsar "Editar" (no hay un campo siempre abierto).
$("btn-editar-nombre").addEventListener("click", () => {
  const abrir = $("form-nombre").hidden;
  $("form-nombre").hidden = !abrir;
  $("btn-editar-nombre").textContent = abrir ? "Cancelar" : "Editar";
  $("btn-editar-nombre").setAttribute("aria-expanded", String(abrir));
  if (abrir) $("perfil-nombre").focus();
});

// T-89: cambiar la contraseña. El formulario se abre al pulsar; las reglas las comprueba el servidor.
function cerrarPassword() {
  $("form-password").hidden = true;
  $("form-password").reset();
  $("btn-password").setAttribute("aria-expanded", "false");
}

$("btn-password").addEventListener("click", () => {
  if (!$("form-password").hidden) return cerrarPassword();
  $("form-password").hidden = false;
  $("btn-password").setAttribute("aria-expanded", "true");
  $("pass-actual").focus();
});

$("form-password").addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = await apiCambiarPassword($("pass-actual").value, $("pass-nueva").value);
  if (r.ok) cerrarPassword();
  mensaje(r.ok ? "Contraseña cambiada." : r.error, !r.ok);
  window.scrollTo({ top: 0, behavior: "smooth" }); // el aviso sale arriba
});

// T-87/T-88: objetivo semanal (1 a 7 días); lo comprueba el servidor.
$("objetivo-semanal").addEventListener("change", async (e) => {
  const r = await apiCambiarObjetivo(Number(e.target.value));
  if (r.ok) {
    pintarObjetivo(r.datos.objetivoSemanal);
    mensaje(`Objetivo guardado: ${r.datos.objetivoSemanal} ${r.datos.objetivoSemanal === 1 ? "día" : "días"} por semana.`);
  } else {
    pintarObjetivo(sesion.datos?.objetivoSemanal);
    mensaje(r.error, true);
  }
});

// T-63: tema claro u oscuro. No va al servidor: es de este dispositivo (lo guarda tema.js).
for (const radio of document.querySelectorAll('input[name="tema"]')) {
  radio.checked = radio.value === window.forjaTema.elegido();
}
$("tema").addEventListener("change", (e) => window.forjaTema.elegir(e.target.value));

// T-60: cambiar el nombre. Las reglas (2-40 caracteres) las comprueba el servidor.
$("form-nombre").addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = await apiCambiarNombre($("perfil-nombre").value);
  if (r.ok) {
    pintarCabecera(r.datos.nombre);
    $("form-nombre").hidden = true;
    $("btn-editar-nombre").textContent = "Editar";
    $("btn-editar-nombre").setAttribute("aria-expanded", "false");
  }
  mensaje(r.ok ? "Nombre guardado." : r.error, !r.ok);
});

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
    instalada: "Ya estás usando Forja como app.",
    boton: "Tenla en tu pantalla de inicio y ábrela a pantalla completa, como cualquier otra app.",
    "ios-safari": "En iPhone se instala desde el menú de compartir:",
    "ios-otro": "En iPhone se instala desde el menú de compartir del navegador:",
  }[modo] ?? "";
}

alCambiarInstalacion(pintarInstalacion);

$("btn-instalar").addEventListener("click", async () => {
  if (await instalar()) mensaje("Instalando Forja en tu pantalla de inicio.");
});

// T-55: notificaciones. Este móvil se suscribe en el navegador (pwa.js) y la suscripción se
// guarda en el servidor, que es quien envía los avisos.
const TEXTOS_AVISOS = {
  "no-disponible": "Este navegador no admite avisos (o todavía no están configurados en el servidor).",
  "instalar-primero": "En iPhone, los avisos solo funcionan con Forja instalada: instálala (más abajo) y ábrela desde su icono.",
  bloqueados: "Has bloqueado los avisos de Forja. Puedes permitirlos en los ajustes del móvil (Notificaciones).",
  inactivos: "Te avisamos al terminar cada descanso, aunque tengas el móvil bloqueado.",
  activos: "Avisos activados en este móvil.",
};
let claveAvisos = null;

async function pintarAvisos() {
  const modo = await estadoAvisos(claveAvisos);
  $("texto-avisos").textContent = TEXTOS_AVISOS[modo];
  $("btn-activar-avisos").hidden = modo !== "inactivos";
  $("btn-probar-avisos").hidden = modo !== "activos";
  $("btn-quitar-avisos").hidden = modo !== "activos";
}

$("btn-activar-avisos").addEventListener("click", async () => {
  $("btn-activar-avisos").disabled = true;
  try {
    const suscripcion = await suscribirAvisos(claveAvisos);
    if (!suscripcion) {
      mensaje("Sin permiso no podemos avisarte. Si cambias de idea, actívalo en los ajustes del móvil.", true);
    } else {
      const r = await apiActivarAvisos(suscripcion);
      mensaje(r.ok ? "Avisos activados. Prueba a enviarte uno." : r.error, !r.ok);
    }
  } catch {
    mensaje("No se han podido activar los avisos en este navegador.", true);
  }
  $("btn-activar-avisos").disabled = false;
  await pintarAvisos();
});

$("btn-probar-avisos").addEventListener("click", async () => {
  const r = await apiAvisoPrueba();
  mensaje(r.ok ? "Aviso enviado: te llegará en unos segundos." : r.error, !r.ok);
});

$("btn-quitar-avisos").addEventListener("click", async () => {
  const endpoint = await quitarAvisos();
  if (endpoint) await apiDesactivarAvisos(endpoint);
  mensaje("Avisos desactivados en este móvil.");
  await pintarAvisos();
});

if (sesion.ok) {
  const r = await apiClaveAvisos();
  claveAvisos = r.ok ? r.datos.clave : null;
  await pintarAvisos();
}
