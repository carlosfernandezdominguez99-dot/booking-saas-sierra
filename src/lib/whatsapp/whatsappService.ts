import "server-only";

/**
 * Capa de servicio para WhatsApp Business Platform.
 *
 * TODAVÍA NO hay credenciales/API configuradas (llega en la Fase 7). Esta
 * capa existe desde ya para que el resto del código (creación de reservas,
 * cancelaciones, recordatorios) dependa siempre de esta interfaz y nunca
 * de una integración concreta. Mientras tanto, cada función registra la
 * intención en consola (mock) y devuelve un resultado con `sent: false`
 * para que quien la llame pueda decidir qué hacer (reintentar, marcar la
 * notificación como pendiente, etc.) sin fingir un envío real.
 *
 * Cuando se configuren las credenciales:
 *  - WHATSAPP_API_TOKEN
 *  - WHATSAPP_PHONE_NUMBER_ID
 *  - WHATSAPP_BUSINESS_ACCOUNT_ID
 * se sustituye el cuerpo de `sendWhatsappMessage` por la llamada real a la
 * Graph API de Meta, sin tocar el resto de la aplicación.
 */

export interface WhatsappResult {
  sent: boolean;
  mocked: boolean;
  error?: string;
}

export interface BookingConfirmationPayload {
  toPhone: string;
  customerName: string;
  businessName: string;
  serviceName: string;
  startTimeIso: string;
}

export interface BookingReminderPayload extends BookingConfirmationPayload {
  hoursBefore: 24 | 2;
}

export interface CancellationPayload {
  toPhone: string;
  customerName: string;
  businessName: string;
  serviceName: string;
  startTimeIso: string;
  reason?: string;
}

const isConfigured = () =>
  Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

async function sendWhatsappMessage(toPhone: string, message: string): Promise<WhatsappResult> {
  if (!isConfigured()) {
    console.log(
      `[whatsappService:mock] → ${toPhone}\n${message}\n` +
        "(WHATSAPP_API_TOKEN/WHATSAPP_PHONE_NUMBER_ID no configurados; no se envía nada real)",
    );
    return { sent: false, mocked: true };
  }

  // Fase 7: aquí irá la llamada real a la Graph API de WhatsApp Business.
  // const response = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { ... });
  console.log(`[whatsappService] Integración real pendiente (Fase 7). Mensaje no enviado a ${toPhone}.`);
  return { sent: false, mocked: false, error: "not_implemented" };
}

export async function sendBookingConfirmation(
  payload: BookingConfirmationPayload,
): Promise<WhatsappResult> {
  const message =
    `Hola ${payload.customerName}, tu reserva en ${payload.businessName} está confirmada.\n` +
    `Servicio: ${payload.serviceName}\nFecha: ${payload.startTimeIso}`;
  return sendWhatsappMessage(payload.toPhone, message);
}

export async function sendBookingReminder(
  payload: BookingReminderPayload,
): Promise<WhatsappResult> {
  const message =
    `Recordatorio: tienes una cita en ${payload.businessName} dentro de ${payload.hoursBefore}h.\n` +
    `Servicio: ${payload.serviceName}\nFecha: ${payload.startTimeIso}`;
  return sendWhatsappMessage(payload.toPhone, message);
}

export async function sendCancellationMessage(
  payload: CancellationPayload,
): Promise<WhatsappResult> {
  const message =
    `Hola ${payload.customerName}, tu reserva en ${payload.businessName} (${payload.serviceName}, ` +
    `${payload.startTimeIso}) ha sido cancelada.` +
    (payload.reason ? ` Motivo: ${payload.reason}` : "");
  return sendWhatsappMessage(payload.toPhone, message);
}
