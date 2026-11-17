// Service worker de Forja (T-54, D-28). Va en la raíz de cliente/ porque solo controla
// las páginas de su carpeta y las de debajo: así controla toda la app.
//
// Qué hace: guarda la "carcasa" de la app (páginas, CSS, JS e iconos) para que sea instalable
// y abra al instante. Desde T-59 usa primero la COPIA GUARDADA (sin esperar a Render).
// ¿Y tras un despliegue? El servidor cambia VERSION por una huella del contenido de cliente/
// (ver api.js). Si cambia cualquier archivo, cambia este sw.js: el navegador instala el nuevo,
// que descarga la carcasa entera otra vez y borra la vieja. La versión nueva se ve en la
// siguiente apertura de la app.
// En local (localhost) sigue yendo primero a la red, para ver los cambios al momento mientras
// se programa.
// Qué NO hace: nunca guarda nada de /api/ (datos del usuario, sesión, OAuth): eso va siempre
// al servidor, que es quien decide.
// Desde el PBI-20 (T-55, D-29) también recibe las notificaciones push y las muestra.

const VERSION = "forja-__HUELLA__"; // el servidor pone aquí la huella al servir el archivo
const EN_LOCAL = self.location.hostname === "localhost";

// Todos los archivos de cliente/ que usa la app (test/pwa.test.js comprueba que no falta ninguno).
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
  "/iconos/icono-512.png",
  "/iconos/apple-touch-icon.png",
  "/comunicacion/rest.js",
  "/presentacion/acceso.js",
  "/presentacion/ajustes.js",
  "/presentacion/busqueda.js",
  "/presentacion/ejercicios.js",
  "/presentacion/entreno.js",
  "/presentacion/graficos.js",
  "/presentacion/historial.js",
  "/presentacion/inicio.js",
  "/presentacion/navegacion.js",
  "/presentacion/progreso.js",
  "/presentacion/pwa.js",
  "/presentacion/rutinas.js",
  "/presentacion/temporizador.js",
];

// Al instalarse: se guarda la carcasa y se activa sin esperar a que se cierren las pestañas.
// `cache: "reload"` = pedirla de verdad al servidor, no a la caché normal del navegador.
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CARCASA.map((ruta) => new Request(ruta, { cache: "reload" }))))
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

function deLaRed(peticion) {
  return fetch(peticion).then((respuesta) => {
    if (respuesta.ok) {
      const copia = respuesta.clone();
      caches.open(VERSION).then((cache) => cache.put(peticion, copia));
    }
    return respuesta;
  });
}

// Solo GET del mismo origen y nunca /api/. `ignoreSearch`: historial.html?abierto=… es la misma página.
self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  const url = new URL(peticion.url);
  if (peticion.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const guardada = () => caches.match(peticion, { ignoreSearch: true });
  evento.respondWith(
    EN_LOCAL
      ? deLaRed(peticion).catch(() => guardada().then((r) => r ?? Response.error()))
      : guardada().then((r) => r ?? deLaRed(peticion))
  );
});

// ---------- Notificaciones push (T-55) ----------

// Llega un aviso del servidor (aunque la app esté cerrada): se muestra. En iPhone es obligatorio
// enseñar SIEMPRE una notificación por cada aviso; si no, Safari retira el permiso.
self.addEventListener("push", (evento) => {
  let aviso = {};
  try {
    aviso = evento.data?.json() ?? {};
  } catch {
    aviso = { cuerpo: evento.data?.text() };
  }
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo ?? "Forja", {
      body: aviso.cuerpo ?? "",
      icon: "/iconos/icono-192.png",
      badge: "/iconos/icono-192.png",
      tag: aviso.etiqueta, // con la misma etiqueta, el aviso nuevo sustituye al anterior
      renotify: Boolean(aviso.etiqueta),
      data: { url: aviso.url ?? "/inicio.html" },
    })
  );
});

// Al tocar el aviso: si la app ya está abierta se trae al frente en esa página; si no, se abre.
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = new URL(evento.notification.data?.url ?? "/inicio.html", self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => v.url.startsWith(self.location.origin));
      if (abierta) return abierta.focus().then((v) => v.navigate(url));
      return self.clients.openWindow(url);
    })
  );
});
