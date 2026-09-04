"use server";

import { createClient } from "@/lib/supabase/server";
import {
  respondToWaitlistOffer,
  type RespondToWaitlistOfferResult,
} from "@/lib/services/waitlistService";
import { sendWaitlistOffer } from "@/lib/whatsapp/whatsappService";

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

  // Si al rechazar quedó otra persona en espera con el mismo hueco
  // ofrecido, se le "avisa" ahora (best-effort, igual que en
  // cancelBookingAction — la respuesta de esta persona ya se guardó bien
  // pase lo que pase con este envío).
  if (result.nextOffer) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      await sendWaitlistOffer({
        toPhone: result.nextOffer.customerPhone,
        customerName: result.nextOffer.customerName,
        businessName: result.businessName ?? "",
        serviceName: result.nextOffer.serviceName,
        startTimeIso: result.nextOffer.offeredStartTime,
        respondUrl: `${siteUrl}/lista-espera/${result.nextOffer.respondToken}`,
      });
    } catch {
      // No-op: best-effort.
    }
  }

  return result;
}
