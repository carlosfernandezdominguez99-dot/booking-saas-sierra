import "server-only";

/**
 * Capa de servicio para email transaccional (confirmaciones, cancelaciones,
 * ofertas de lista de espera).
 *
 * Mientras no haya cuenta de WhatsApp Business API conectada
 * (`whatsappService.ts`, que sigue mockeado), el email es el canal REAL de
 * aviso — por eso el email pasa a ser obligatorio al reservar desde la
 * página pública (ver `publicBookingContactSchema`).
 *
 * Usa la API HTTP de Resend directamente (sin SDK, igual que el resto del
 * proyecto evita dependencias nuevas cuando un `fetch` normal basta). Si
 * `RESEND_API_KEY` no está configurada, cada función deja un log (mock) y
 * devuelve `sent: false`, con el mismo patrón que `whatsappService.ts`, así
 * que nada del resto de la app tiene que distinguir "mock" de "real".
 *
 * Para activar el envío real hace falta:
 *  - Crear una cuenta en resend.com (tiene plan gratuito).
 *  - RESEND_API_KEY: la clave de API.
 *  - EMAIL_FROM (opcional): remitente con formato "Nombre <email@dominio>".
 *    Sin verificar un dominio propio en Resend, solo se puede usar
 *    `onboarding@resend.dev` como remitente (válido para probar, pero
 *    Resend lo marca como remitente de pruebas) — con un dominio propio
 *    verificado se puede usar cualquier dirección de ese dominio.
 */

export interface EmailResult {
  sent: boolean;
  mocked: boolean;
  error?: string;
}

export interface BookingConfirmationEmailPayload {
  toEmail: string;
  customerName: string;
  businessName: string;
  serviceName: string;
  startTimeIso: string;
  /** Zona horaria del negocio (p. ej. "Europe/Madrid") — la hora se muestra en esta zona, nunca en UTC. */
  timezone: string;
}

export interface CancellationEmailPayload {
  toEmail: string;
  customerName: string;
  businessName: string;
  serviceName: string;
  startTimeIso: string;
  timezone: string;
}

export interface WaitlistOfferEmailPayload {
  toEmail: string;
  customerName: string;
  businessName: string;
  serviceName: string;
  startTimeIso: string;
  timezone: string;
  /** Enlace público de un solo uso para aceptar/rechazar. */
  respondUrl: string;
}

export interface WaitlistJoinConfirmationEmailPayload {
  toEmail: string;
  customerName: string;
  businessName: string;
  serviceName: string;
  /** Fecha (YYYY-MM-DD) que pidió, ya formateada para mostrar. */
  preferredDateLabel: string;
  /** Enlace a "Mis citas" (cuenta de cliente) para poder consultar/darse de baja luego. */
  accountLink: string;
}

const isConfigured = () => Boolean(process.env.RESEND_API_KEY);
const FROM_ADDRESS = process.env.EMAIL_FROM || "ZoriaBooking <onboarding@resend.dev>";

async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  if (!isConfigured()) {
    console.log(
      `[emailService:mock] → ${to}\nAsunto: ${subject}\n${html.replace(/<[^>]+>/g, " ").trim()}\n` +
        "(RESEND_API_KEY no configurada; no se envía nada real)",
    );
    return { sent: false, mocked: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[emailService] Resend devolvió ${response.status} al enviar a ${to}: ${body}`);
      return { sent: false, mocked: false, error: `resend_${response.status}` };
    }

    return { sent: true, mocked: false };
  } catch (err) {
    console.error(`[emailService] Fallo de red enviando a ${to}:`, err);
    return { sent: false, mocked: false, error: "network_error" };
  }
}

/**
 * Formatea la fecha/hora en la zona horaria del NEGOCIO, no en UTC — un
 * fallo anterior mostraba siempre la hora en UTC (p. ej. una cita a las
 * 18:00 en Europe/Madrid salía como "17:00" o "16:00" en el email, según
 * el horario de verano), que es la hora equivocada para el cliente. Todas
 * las horas que se guardan en la base de datos son `timestamptz` (un
 * instante absoluto) — la única forma correcta de mostrárselas a alguien
 * es siempre convertidas a la zona horaria de ESE negocio.
 */
function formatDateForEmail(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function wrapEmail(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1e;">
      <h2 style="margin: 0 0 16px;">${title}</h2>
      ${bodyHtml}
    </div>
  `;
}

export async function sendBookingConfirmationEmail(
  payload: BookingConfirmationEmailPayload,
): Promise<EmailResult> {
  const html = wrapEmail(
    "¡Reserva confirmada!",
    `<p>Hola ${payload.customerName},</p>
     <p>Tu reserva en <strong>${payload.businessName}</strong> está confirmada:</p>
     <p><strong>${payload.serviceName}</strong><br/>${formatDateForEmail(payload.startTimeIso, payload.timezone)}</p>`,
  );
  return sendEmail(payload.toEmail, `Reserva confirmada en ${payload.businessName}`, html);
}

export async function sendCancellationEmail(payload: CancellationEmailPayload): Promise<EmailResult> {
  const html = wrapEmail(
    "Reserva cancelada",
    `<p>Hola ${payload.customerName},</p>
     <p>Tu reserva en <strong>${payload.businessName}</strong> ha sido cancelada:</p>
     <p><strong>${payload.serviceName}</strong><br/>${formatDateForEmail(payload.startTimeIso, payload.timezone)}</p>
     <p>Si quieres reservar otro momento, contacta con el negocio o vuelve a su página de reservas.</p>`,
  );
  return sendEmail(payload.toEmail, `Tu reserva en ${payload.businessName} ha sido cancelada`, html);
}

export async function sendWaitlistOfferEmail(payload: WaitlistOfferEmailPayload): Promise<EmailResult> {
  const html = wrapEmail(
    "¡Se ha liberado un hueco!",
    `<p>Hola ${payload.customerName},</p>
     <p>Se ha liberado un hueco en <strong>${payload.businessName}</strong> que encaja con lo que pediste:</p>
     <p><strong>${payload.serviceName}</strong><br/>${formatDateForEmail(payload.startTimeIso, payload.timezone)}</p>
     <p><a href="${payload.respondUrl}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none;">Responder ahora</a></p>
     <p style="font-size:12px;color:#888;">Este enlace es de un solo uso y puede caducar si tarda demasiado en responderse.</p>`,
  );
  return sendEmail(payload.toEmail, `Hay un hueco libre en ${payload.businessName}`, html);
}

export async function sendWaitlistJoinConfirmationEmail(
  payload: WaitlistJoinConfirmationEmailPayload,
): Promise<EmailResult> {
  const html = wrapEmail(
    "Apuntado a la lista de espera",
    `<p>Hola ${payload.customerName},</p>
     <p>Te hemos apuntado a la lista de espera de <strong>${payload.businessName}</strong>:</p>
     <p><strong>${payload.serviceName}</strong><br/>Para el ${payload.preferredDateLabel}</p>
     <p>Si se libera un hueco que encaje, te avisaremos por aquí con un enlace para confirmarlo.</p>
     <p><a href="${payload.accountLink}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none;">Ver mi lista de espera</a></p>
     <p style="font-size:12px;color:#888;">Crea una cuenta gratis con este mismo email en "Mis citas" para ver ahí todas tus reservas (también las de otros negocios) y poder darte de baja cuando quieras.</p>`,
  );
  return sendEmail(payload.toEmail, `Apuntado a la lista de espera de ${payload.businessName}`, html);
}
