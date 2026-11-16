// La web como app instalable (T-54, D-27). Capa de PRESENTACIÓN: registra el service worker y
// decide cómo ofrecer la instalación según el móvil. Arriba, una función pura (probada con
// node:test); abajo, lo que usa el navegador.
//
// - Android (Chrome, Samsung Internet, Edge): el navegador avisa de que se puede instalar con el
//   evento `beforeinstallprompt`; lo guardamos y nuestro botón "Instalar" abre su ventana.
// - iPhone (Safari, y Chrome o Firefox desde iOS 16.4): no existe ese evento; se instala a mano con
//   Compartir -> "Añadir a pantalla de inicio", así que se enseñan instrucciones.

// Función pura: qué enseñar en Perfil.
// "instalada": ya se abre como app · "boton": se puede instalar con nuestro botón ·
// "ios-safari" / "ios-otro": instrucciones de iPhone (el botón de compartir cambia de sitio) ·
// "nada": navegador sin instalación (por ejemplo, Firefox de escritorio).
export function modoInstalacion({ userAgent = "", instalada = false, hayAviso = false } = {}) {
  if (instalada) return "instalada";
  if (hayAviso) return "boton";
  if (/iPhone|iPad|iPod/.test(userAgent)) return /CriOS|FxiOS|EdgiOS/.test(userAgent) ? "ios-otro" : "ios-safari";
  return "nada";
}

// ---------- Navegador ----------

let avisoInstalacion = null; // el evento beforeinstallprompt guardado (solo Android/escritorio Chromium)
const avisados = new Set(); // funciones a las que avisar cuando cambia lo que se puede hacer

function avisar() {
  for (const fn of avisados) fn();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault(); // que no salga el aviso del navegador: lo ofrece nuestro botón
    avisoInstalacion = evento;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    avisoInstalacion = null;
    avisar();
  });
}

export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Si falla (por ejemplo, sin HTTPS fuera de localhost), la web sigue funcionando sin él.
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

export function estaInstalada() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

export function modoActual() {
  return modoInstalacion({ userAgent: navigator.userAgent, instalada: estaInstalada(), hayAviso: avisoInstalacion !== null });
}

// Avisa (y llama ya una vez) cada vez que cambia lo que se puede hacer.
export function alCambiarInstalacion(fn) {
  avisados.add(fn);
  fn();
}

// Abre la ventana de instalación del navegador. Devuelve true si el usuario aceptó.
export async function instalar() {
  if (!avisoInstalacion) return false;
  const aviso = avisoInstalacion;
  avisoInstalacion = null; // el evento solo se puede usar una vez
  aviso.prompt();
  const { outcome } = await aviso.userChoice;
  avisar();
  return outcome === "accepted";
}
