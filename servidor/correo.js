// Envío de email transaccional con Brevo (capa gratuita, API por fetch, sin SMTP).
// El remitente (EMAIL_FROM) debe estar verificado en Brevo; no hace falta dominio propio.
// Si no hay BREVO_API_KEY (local/CI sin servicio), no falla: deja el enlace
// en el log para poder confirmar a mano en desarrollo.

import * as log from "./log.js";

export function enlaceConfirmacion(email, token) {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/api/confirmar?token=${token}`;
}

export async function enviarConfirmacion(email, token) {
  const enlace = enlaceConfirmacion(email, token);
  if (!process.env.BREVO_API_KEY) {
    log.info("email-desarrollo", `${email} -> ${enlace}`);
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Fitness Hub", email: process.env.EMAIL_FROM },
      to: [{ email }],
      subject: "Confirma tu cuenta de Fitness Hub",
      htmlContent: `<p>Pulsa para activar tu cuenta: <a href="${enlace}">${enlace}</a></p><p>Si no te llega, mira el spam.</p>`,
    }),
  });
  if (!res.ok) {
    // Brevo explica el motivo en el cuerpo (clave mala, remitente sin verificar, cuenta sin activar...).
    const motivo = await res.text().catch(() => "");
    log.error("email-fallido", `${email} (${res.status}) ${motivo}`);
    return;
  }
  // Brevo acepta el envío y devuelve un id; sirve para buscarlo en su panel.
  const { messageId } = await res.json().catch(() => ({}));
  log.info("email-enviado", `${email} desde ${process.env.EMAIL_FROM} ${messageId ?? ""}`);
}
