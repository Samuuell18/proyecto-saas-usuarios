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

// ---------- Notificaciones push (T-55, D-29) ----------

// Función pura: qué enseñar en "Notificaciones" de Perfil.
// "no-disponible": el servidor no tiene avisos o el navegador no los soporta ·
// "instalar-primero": iPhone sin la app instalada (Apple solo deja avisar a apps de la pantalla de inicio) ·
// "bloqueados": el usuario dijo que no (solo se puede cambiar en los ajustes del móvil) ·
// "activos" / "inactivos".
export function modoAvisos({ hayClave = false, soportaPush = false, esIos = false, instalada = false, permiso = "default", suscrito = false } = {}) {
  if (!hayClave) return "no-disponible";
  if (esIos && !instalada) return "instalar-primero";
  if (!soportaPush) return "no-disponible";
  if (permiso === "denied") return "bloqueados";
  return suscrito && permiso === "granted" ? "activos" : "inactivos";
}

// Función pura: la clave pública VAPID viene en base64url; el navegador la quiere en bytes.
export function claveABytes(base64url) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function soportaPush() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function suscripcionActual() {
  if (!soportaPush()) return null;
  const registro = await navigator.serviceWorker.ready;
  return registro.pushManager.getSubscription();
}

export async function estadoAvisos(clave) {
  return modoAvisos({
    hayClave: Boolean(clave),
    soportaPush: soportaPush(),
    esIos: /iPhone|iPad|iPod/.test(navigator.userAgent),
    instalada: estaInstalada(),
    permiso: "Notification" in window ? Notification.permission : "default",
    suscrito: Boolean(await suscripcionActual()),
  });
}

// Pide permiso (tiene que ser al pulsar un botón: Apple lo exige) y suscribe este móvil.
// Devuelve la suscripción para mandarla al servidor, o null si el usuario no da permiso.
export async function suscribirAvisos(clave) {
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return null;
  const registro = await navigator.serviceWorker.ready;
  const suscripcion =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(clave) }));
  return suscripcion.toJSON();
}

// Quita la suscripción de este móvil. Devuelve su endpoint (para borrarla en el servidor) o null.
export async function quitarAvisos() {
  const suscripcion = await suscripcionActual();
  if (!suscripcion) return null;
  const { endpoint } = suscripcion;
  await suscripcion.unsubscribe();
  return endpoint;
}
