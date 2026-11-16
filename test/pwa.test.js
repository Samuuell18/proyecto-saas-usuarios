// T-54: cómo se ofrece instalar la app según el móvil. Función pura del cliente, sin DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { modoInstalacion } from "../cliente/presentacion/pwa.js";

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
