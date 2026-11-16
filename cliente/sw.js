// Service worker de Forja (T-54, D-28). Va en la raíz de cliente/ porque solo controla
// las páginas de su carpeta y las de debajo: así controla toda la app.
//
// Qué hace: guarda la "carcasa" de la app (páginas, CSS, JS e iconos) para que abra rápido y
// para que el navegador la considere instalable. Siempre pide primero a la red (así, tras un
// despliegue, se ve la versión nueva) y solo usa la copia guardada si no hay conexión.
// Qué NO hace: nunca guarda nada de /api/ (datos del usuario, sesión, OAuth): eso va siempre
// al servidor, que es quien decide.
// En el PBI-20 recibirá también las notificaciones push.

const VERSION = "forja-v2"; // cambiarla si cambia la lista de archivos de abajo
const CARCASA = [
  "/",
  "/inicio.html",
  "/rutinas.html",
  "/ejercicios.html",
  "/entreno.html",
  "/progreso.html",
  "/historial.html",
  "/ajustes.html",
  "/privacidad.html",
  "/css/styles.css",
  "/manifest.webmanifest",
  "/iconos/icono.svg",
  "/iconos/icono-192.png",
  "/iconos/apple-touch-icon.png",
];

// Al instalarse: se guarda la carcasa y se activa sin esperar a que se cierren las pestañas.
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CARCASA))
      .then(() => self.skipWaiting())
  );
});

// Al activarse: se borran las cachés de versiones anteriores.
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Red primero; si falla, la copia guardada. Solo GET del mismo origen y nunca /api/.
self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  const url = new URL(peticion.url);
  if (peticion.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  evento.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(peticion, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(peticion).then((guardada) => guardada ?? Response.error()))
  );
});
