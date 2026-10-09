// Log de actividad relevante (apartado 6 de la especificacion).
// Simple a proposito: una linea con fecha por evento.
// En local se ve en la terminal; en Render, en los logs del servicio.

export function info(evento, detalle = "") {
  console.log(`[${new Date().toISOString()}] INFO ${evento}${detalle ? " " + detalle : ""}`);
}

export function error(evento, detalle = "") {
  console.error(`[${new Date().toISOString()}] ERROR ${evento}${detalle ? " " + detalle : ""}`);
}
