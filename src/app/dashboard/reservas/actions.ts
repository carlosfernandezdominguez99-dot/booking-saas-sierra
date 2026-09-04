"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/services/authContext";
import { cancelBooking } from "@/lib/services/bookingService";
import { offerNextWaitlistCandidate } from "@/lib/services/waitlistService";
import { sendWaitlistOffer } from "@/lib/whatsapp/whatsappService";

export type SimpleActionResult = { error?: string };

export async function cancelBookingAction(bookingId: string): Promise<SimpleActionResult> {
  const { supabase, business } = await requireBusinessContext();

  try {
    await cancelBooking(supabase, bookingId);
    revalidatePath("/dashboard/reservas");
    revalidatePath("/dashboard/calendario");
    revalidatePath("/dashboard/inicio");

    // Fase 7: el hueco que acaba de liberarse puede encajar con alguien en
    // la lista de espera de ese día — si es así, se le "avisa" (mock de
    // WhatsApp con enlace de un solo uso) antes de terminar. Es
    // best-effort a propósito: la cancelación ya se hizo, un fallo aquí no
    // debe deshacerla ni mostrarse como error al negocio.
    try {
      const offer = await offerNextWaitlistCandidate(supabase, bookingId);
      if (offer) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
        await sendWaitlistOffer({
          toPhone: offer.customerPhone,
          customerName: offer.customerName,
          businessName: business.name,
          serviceName: offer.serviceName,
          startTimeIso: offer.offeredStartTime,
          respondUrl: `${siteUrl}/lista-espera/${offer.respondToken}`,
        });
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
