// Envío de email transaccional con Resend (capa gratuita, API por fetch, sin SMTP).
// Si no hay RESEND_API_KEY (local/CI sin servicio), no falla: deja el enlace
// en el log para poder confirmar a mano en desarrollo.

import * as log from "./log.js";

export function enlaceConfirmacion(email, token) {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/api/confirmar?token=${token}`;
}

export async function enviarConfirmacion(email, token) {
  const enlace = enlaceConfirmacion(email, token);
  if (!process.env.RESEND_API_KEY) {
    log.info("email-desarrollo", `${email} -> ${enlace}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
      to: email,
      subject: "Confirma tu cuenta de Fitness Hub",
      html: `<p>Pulsa para activar tu cuenta: <a href="${enlace}">${enlace}</a></p><p>Si no te llega, mira el spam.</p>`,
    }),
  });
  if (!res.ok) {
    log.error("email-fallido", `${email} (${res.status})`);
  }
}
