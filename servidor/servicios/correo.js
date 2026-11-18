// Envío de email transaccional con Brevo (capa gratuita, API por fetch, sin SMTP).
// El remitente (EMAIL_FROM) debe estar verificado en Brevo; no hace falta dominio propio.
// Si no hay BREVO_API_KEY (local/CI sin servicio), no falla: deja el enlace
// en el log para poder confirmar a mano en desarrollo.

import * as log from "./log.js";

function base() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export function enlaceConfirmacion(email, token) {
  return `${base()}/api/confirmar?token=${token}`;
}

// T-90: el enlace para poner una contraseña nueva lleva a una página de la app.
export function enlaceRecuperacion(token) {
  return `${base()}/recuperar.html?token=${token}`;
}

// Envía un correo con Brevo. Sin clave, deja `eventoDesarrollo` y el enlace en el log.
async function enviar(email, { asunto, html, enlace, eventoDesarrollo }) {
  if (!process.env.BREVO_API_KEY) {
    log.info(eventoDesarrollo, `${email} -> ${enlace}`);
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Forja", email: process.env.EMAIL_FROM },
      to: [{ email }],
      subject: asunto,
      htmlContent: html,
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

export async function enviarConfirmacion(email, token) {
  const enlace = enlaceConfirmacion(email, token);
  await enviar(email, {
    asunto: "Confirma tu cuenta de Forja",
    html: `<p>Pulsa para activar tu cuenta: <a href="${enlace}">${enlace}</a></p><p>Si no te llega, mira el spam.</p>`,
    enlace,
    eventoDesarrollo: "email-desarrollo",
  });
}

// T-90: "¿Olvidaste tu contraseña?". El enlace vale 1 hora y un solo uso.
export async function enviarRecuperacion(email, token) {
  const enlace = enlaceRecuperacion(token);
  await enviar(email, {
    asunto: "Pon una contraseña nueva en Forja",
    html:
      `<p>Has pedido poner una contraseña nueva en Forja. Pulsa aquí (vale 1 hora): ` +
      `<a href="${enlace}">${enlace}</a></p><p>Si no lo has pedido tú, ignora este correo: tu contraseña no cambia.</p>`,
    enlace,
    eventoDesarrollo: "recuperar-desarrollo",
  });
}
