"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/services/authContext";
import { cancelBooking, getBookingContactInfo } from "@/lib/services/bookingService";
import { offerNextWaitlistCandidate } from "@/lib/services/waitlistService";
import { sendWaitlistOffer } from "@/lib/whatsapp/whatsappService";
import { sendCancellationEmail, sendWaitlistOfferEmail } from "@/lib/email/emailService";

export type SimpleActionResult = { error?: string };

export async function cancelBookingAction(bookingId: string): Promise<SimpleActionResult> {
  const { supabase, business } = await requireBusinessContext();

  try {
    // Se captura antes de cancelar: hace falta para poder avisar al
    // cliente por email después (cancelar solo cambia el estado, no
    // devuelve quién era).
    const contactInfo = await getBookingContactInfo(supabase, bookingId).catch(() => null);

    await cancelBooking(supabase, bookingId);
    revalidatePath("/dashboard/reservas");
    revalidatePath("/dashboard/calendario");
    revalidatePath("/dashboard/inicio");

    // Aviso de cancelación por email — best-effort a propósito: la
    // cancelación ya se hizo, un fallo aquí no debe deshacerla ni
    // mostrarse como error al negocio.
    if (contactInfo?.customerEmail) {
      try {
        await sendCancellationEmail({
          toEmail: contactInfo.customerEmail,
          customerName: contactInfo.customerName,
          businessName: business.name,
          serviceName: contactInfo.serviceName,
          startTimeIso: contactInfo.startTime,
        });
      } catch {
        // No-op: best-effort.
      }
    }

    // Fase 7: el hueco que acaba de liberarse puede encajar con alguien en
    // la lista de espera de ese día — si es así, se le avisa (WhatsApp
    // sigue mockeado; el email si tiene uno es el aviso real) antes de
    // terminar. Es best-effort a propósito, mismo motivo que arriba.
    try {
      const offer = await offerNextWaitlistCandidate(supabase, bookingId);
      if (offer) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
        const respondUrl = `${siteUrl}/lista-espera/${offer.respondToken}`;
        await sendWaitlistOffer({
          toPhone: offer.customerPhone,
          customerName: offer.customerName,
          businessName: business.name,
          serviceName: offer.serviceName,
          startTimeIso: offer.offeredStartTime,
          respondUrl,
        });
        if (offer.customerEmail) {
          try {
            await sendWaitlistOfferEmail({
              toEmail: offer.customerEmail,
              customerName: offer.customerName,
              businessName: business.name,
              serviceName: offer.serviceName,
              startTimeIso: offer.offeredStartTime,
              respondUrl,
            });
          } catch {
            // No-op: best-effort.
          }
        }
        revalidatePath("/dashboard/lista-espera");
      }
    } catch {
      // No-op: best-effort, ver comentario de arriba.
    }

    return {};
  } catch {
    return { error: "No se pudo cancelar la reserva." };
  }
}
