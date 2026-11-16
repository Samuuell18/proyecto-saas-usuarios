// Cuentas del temporizador de descanso (T-40). Capa de PRESENTACIÓN, pero sin DOM:
// solo funciones puras, para poder probarlas con node:test (test/temporizador.test.js).
//
// Idea clave: no se cuenta "un segundo menos cada segundo". Se guarda la HORA A LA QUE
// TERMINA el descanso (`fin`, en milisegundos) y lo que queda se calcula como fin - ahora.
// Con la pantalla bloqueada o la pestaña en segundo plano el navegador frena los
// setInterval; si contáramos de uno en uno se quedaría atrasado, así al volver es exacto.

export const DESCANSO_MAXIMO = 600; // 10 min, el mismo tope que el descanso de la rutina

function acotar(segundos) {
  return Math.min(Math.max(Math.round(segundos), 0), DESCANSO_MAXIMO);
}

// Un descanso nuevo de `segundos` que empieza `ahora` (milisegundos, como Date.now()).
export function crearDescanso(segundos, ahora) {
  return { fin: ahora + acotar(segundos) * 1000 };
}

// Segundos que quedan, redondeando hacia arriba: con 0,3 s se ve "0:01" y no "0:00".
export function segundosRestantes(descanso, ahora) {
  return Math.max(0, Math.ceil((descanso.fin - ahora) / 1000));
}

// +15 / -15: cambia lo que queda, sin bajar de 0 ni pasar del máximo.
export function sumarSegundos(descanso, segundos, ahora) {
  return crearDescanso(segundosRestantes(descanso, ahora) + segundos, ahora);
}

// 90 -> "1:30" · 5 -> "0:05"
export function formatearTiempo(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
