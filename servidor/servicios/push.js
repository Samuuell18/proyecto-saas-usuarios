// Envío de notificaciones push (T-55, D-29). Apoyo externo, como correo.js: no es una capa.
//
// Cómo funciona: cada móvil que activa los avisos nos da una "suscripción" (una dirección en el
// servicio de avisos de su fabricante: Apple, Google, Mozilla...). Para avisarle, le mandamos el
// mensaje a esa dirección firmado con nuestras claves VAPID, y su servicio se lo entrega al móvil
// aunque la app esté cerrada. Lo muestra el service worker (cliente/sw.js).
//
// Claves: VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (se generan con `npx web-push generate-vapid-keys`)
// y VAPID_SUBJECT, un contacto "mailto:..." o "https://..." que piden Apple y Google.
// Sin claves (local o CI) no falla: deja el aviso en el log, igual que correo.js sin Brevo.

import { setVapidDetails, sendNotification } from "web-push";
import * as log from "./log.js";

let preparado = false;

function hayClaves() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function preparar() {
  if (!hayClaves()) return false;
  if (!preparado) {
    const contacto = process.env.VAPID_SUBJECT ?? process.env.APP_URL;
    setVapidDetails(contacto, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    preparado = true;
  }
  return true;
}

// La clave pública la necesita el navegador para suscribirse; null si no hay avisos configurados.
export function clavePublica() {
  return hayClaves() ? process.env.VAPID_PUBLIC_KEY : null;
}

// Envía un aviso a UNA suscripción ({ endpoint, keys: { p256dh, auth } }).
// `ttl`: cuántos segundos puede esperar el aviso si el móvil está apagado (luego se descarta).
// Devuelve "enviado", "caducada" (el móvil ya no existe o quitó el permiso: hay que borrarla),
// "fallo" u "omitido" (sin claves).
export async function enviarAviso(suscripcion, { titulo, cuerpo, url = "/inicio.html", etiqueta } = {}, { ttl = 300 } = {}) {
  if (!preparar()) {
    log.info("push-desarrollo", `${titulo}: ${cuerpo}`);
    return "omitido";
  }
  try {
    await sendNotification(suscripcion, JSON.stringify({ titulo, cuerpo, url, etiqueta }), { TTL: ttl, urgency: "high" });
    return "enviado";
  } catch (err) {
    // 404 / 410: esa suscripción ya no vale (app borrada, permiso quitado...).
    if (err.statusCode === 404 || err.statusCode === 410) return "caducada";
    log.error("push-fallido", `(${err.statusCode ?? "?"}) ${err.body ?? err.message}`);
    return "fallo";
  }
}
