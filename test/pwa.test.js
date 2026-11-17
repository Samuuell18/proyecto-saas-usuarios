// T-54: cómo se ofrece instalar la app según el móvil. Función pura del cliente, sin DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { modoInstalacion, modoAvisos, claveABytes } from "../cliente/presentacion/pwa.js";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";

test("modoInstalacion: instalada, botón (Android), instrucciones (iPhone) o nada", () => {
  // Ya instalada: no se ofrece nada, venga de donde venga.
  assert.equal(modoInstalacion({ userAgent: ANDROID_CHROME, instalada: true, hayAviso: true }), "instalada");
  // Android con el aviso del navegador: nuestro botón.
  assert.equal(modoInstalacion({ userAgent: ANDROID_CHROME, hayAviso: true }), "boton");
  // iPhone: instrucciones, distintas en Safari y en Chrome.
  assert.equal(modoInstalacion({ userAgent: IPHONE_SAFARI }), "ios-safari");
  assert.equal(modoInstalacion({ userAgent: IPHONE_CHROME }), "ios-otro");
  // Android sin aviso (por ejemplo, Firefox o ya rechazado): nada.
  assert.equal(modoInstalacion({ userAgent: ANDROID_CHROME }), "nada");
  assert.equal(modoInstalacion(), "nada");
});

// T-55: qué se enseña en "Notificaciones" de Perfil.
test("modoAvisos: no disponible, instalar primero (iPhone), bloqueados, activos o inactivos", () => {
  const listo = { hayClave: true, soportaPush: true, permiso: "default" };
  assert.equal(modoAvisos({ ...listo, hayClave: false }), "no-disponible"); // servidor sin claves
  assert.equal(modoAvisos({ ...listo, soportaPush: false }), "no-disponible"); // navegador sin push
  assert.equal(modoAvisos({ ...listo, esIos: true, instalada: false }), "instalar-primero");
  assert.equal(modoAvisos({ ...listo, esIos: true, instalada: true }), "inactivos");
  assert.equal(modoAvisos({ ...listo, permiso: "denied" }), "bloqueados");
  assert.equal(modoAvisos({ ...listo, permiso: "granted", suscrito: true }), "activos");
  // Suscrito pero con el permiso retirado después: hay que volver a activarlos.
  assert.equal(modoAvisos({ ...listo, permiso: "default", suscrito: true }), "inactivos");
  assert.equal(modoAvisos(), "no-disponible");
});

test("claveABytes: pasa la clave base64url a los bytes que pide el navegador", () => {
  assert.deepEqual([...claveABytes("AQID")], [1, 2, 3]);
  assert.deepEqual([...claveABytes("_-8")], [255, 239]); // "_" y "-" son "/" y "+" en base64 normal
  assert.equal(claveABytes("BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM").length, 65);
});

// T-59: el service worker usa primero su copia; si un archivo de la app no está en CARCASA,
// sin conexión esa página se rompería. Aquí se comprueba que no falta ninguno.
test("sw.js: la carcasa guarda todos los archivos de cliente/", async () => {
  const { readFile, readdir } = await import("node:fs/promises");
  const sw = await readFile(new URL("../cliente/sw.js", import.meta.url), "utf8");
  const lista = sw.match(/const CARCASA = \[([\s\S]*?)\];/)[1];
  const carcasa = new Set([...lista.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  const archivos = (await readdir(new URL("../cliente/", import.meta.url), { recursive: true }))
    .map((nombre) => "/" + String(nombre).replaceAll("\\", "/"))
    .filter((ruta) => /\.\w+$/.test(ruta) && ruta !== "/sw.js")
    .map((ruta) => (ruta === "/index.html" ? "/" : ruta));
  const faltan = archivos.filter((ruta) => !carcasa.has(ruta));
  assert.deepEqual(faltan, []);
});
