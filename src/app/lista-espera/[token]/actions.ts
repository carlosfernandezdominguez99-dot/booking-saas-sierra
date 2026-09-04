"use server";

import { createClient } from "@/lib/supabase/server";
import {
  respondToWaitlistOffer,
  type RespondToWaitlistOfferResult,
} from "@/lib/services/waitlistService";
import { sendWaitlistOffer } from "@/lib/whatsapp/whatsappService";
import { sendBookingConfirmationEmail, sendWaitlistOfferEmail } from "@/lib/email/emailService";

/**
 * Responde a una oferta de lista de espera desde el enlace público (sin
 * sesión) que llevaría el mensaje de WhatsApp — usa el cliente `anon`,
 * igual que el resto del flujo de reserva pública: la función de Postgres
 * que hay detrás (`respond_to_waitlist_offer`) revalida todo por su cuenta.
 */
export async function respondToWaitlistOfferAction(
  token: string,
  accept: boolean,
): Promise<RespondToWaitlistOfferResult> {
  const supabase = await createClient();
  const result = await respondToWaitlistOffer(supabase, token, accept);

  // Al aceptar, se confirma por email igual que una reserva normal — es el
  // aviso real mientras WhatsApp siga mockeado.
  if (result.result === "accepted" && result.booking && result.customerEmail) {
    try {
      await sendBookingConfirmationEmail({
        toEmail: result.customerEmail,
        customerName: result.customerName ?? "",
        businessName: result.businessName ?? "",
        serviceName: result.booking.serviceName,
        startTimeIso: result.booking.startTime,
      });
    } catch {
      // No-op: best-effort.
    }
  }

  // Si al rechazar quedó otra persona en espera con el mismo hueco
  // ofrecido, se le avisa ahora (best-effort, igual que en
  // cancelBookingAction — la respuesta de esta persona ya se guardó bien
  // pase lo que pase con este envío).
  if (result.nextOffer) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const respondUrl = `${siteUrl}/lista-espera/${result.nextOffer.respondToken}`;
    try {
      await sendWaitlistOffer({
        toPhone: result.nextOffer.customerPhone,
        customerName: result.nextOffer.customerName,
        businessName: result.businessName ?? "",
        serviceName: result.nextOffer.serviceName,
        startTimeIso: result.nextOffer.offeredStartTime,
        respondUrl,
      });
    } catch {
      // No-op: best-effort.
    }
    if (result.nextOffer.customerEmail) {
      try {
        await sendWaitlistOfferEmail({
          toEmail: result.nextOffer.customerEmail,
          customerName: result.nextOffer.customerName,
          businessName: result.businessName ?? "",
          serviceName: result.nextOffer.serviceName,
          startTimeIso: result.nextOffer.offeredStartTime,
          respondUrl,
        });
      } catch {
        // No-op: best-effort.
      }
    }
  }

  return result;
}
