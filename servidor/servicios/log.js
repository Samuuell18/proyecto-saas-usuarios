// Log de actividad relevante (apartado 6 de la especificacion).
// Simple a proposito: una linea con fecha por evento.
// En local se ve en la terminal; en Render, en los logs del servicio.

// T-82 (A09-001): una línea por evento SIEMPRE. Los saltos de línea del detalle (que puede venir del
// usuario) se cambian por un espacio: así nadie puede inventarse una línea falsa en el log.
export function unaLinea(detalle) {
  return String(detalle).replace(/[\r\n]+/g, " ");
}

export function info(evento, detalle = "") {
  console.log(`[${new Date().toISOString()}] INFO ${evento}${detalle ? " " + unaLinea(detalle) : ""}`);
}

export function error(evento, detalle = "") {
  console.error(`[${new Date().toISOString()}] ERROR ${evento}${detalle ? " " + unaLinea(detalle) : ""}`);
}
