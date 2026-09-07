"use server";

import { createClient } from "@/lib/supabase/server";
import { getPublicBusinessBySlug } from "@/lib/services/publicBusinessService";
import { joinWaitlistPublic } from "@/lib/services/waitlistService";
import { sendWaitlistJoinConfirmationEmail } from "@/lib/email/emailService";
import { publicBookingContactSchema } from "@/lib/validations/publicBooking";

export interface JoinWaitlistPublicActionInput {
  serviceId: string;
  preferredDate: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

export interface JoinWaitlistPublicActionResult {
  entryId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Página pública "Apuntarme a la lista de espera" para quien no quiere (o
 * no tiene todavía) una cuenta en `/mis-citas` — usa `join_waitlist_public`,
 * que da de alta al cliente si hace falta (mismo patrón que
 * `create_public_booking`). Si más adelante se registra una cuenta con el
 * mismo email, esta entrada aparecerá igual en su panel: la agregación es
 * por email, no depende de cómo se creó.
 */
export async function joinWaitlistPublicAction(
  slug: string,
  input: JoinWaitlistPublicActionInput,
): Promise<JoinWaitlistPublicActionResult> {
  const parsed = publicBookingContactSchema.safeParse({
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    comment: "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Revisa los campos marcados.", fieldErrors };
  }

  if (!input.serviceId || !input.preferredDate) {
    return { error: "Elige un servicio y un día." };
  }

  const result = await getPublicBusinessBySlug(slug);
  if (!result) return { error: "Negocio no encontrado." };

  try {
    const supabase = await createClient();
    const res = await joinWaitlistPublic(supabase, {
      businessId: result.business.id,
      serviceId: input.serviceId,
      preferredDate: input.preferredDate,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      customerEmail: parsed.data.customerEmail,
    });

    if (res.error) return { error: res.error };

    if (res.customerEmail) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const accountLink = `${siteUrl}/mis-citas`;
      const service = result.services.find((s) => s.id === input.serviceId);
      const preferredDateLabel = new Date(`${input.preferredDate}T00:00:00Z`).toLocaleDateString("es-ES", {
        timeZone: "UTC",
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      try {
        await sendWaitlistJoinConfirmationEmail({
          toEmail: res.customerEmail,
          customerName: parsed.data.customerName,
          businessName: result.business.name,
          serviceName: service?.name ?? "",
          preferredDateLabel,
          accountLink,
        });
      } catch {
        // No-op: best-effort — el registro en la lista de espera ya se guardó bien.
      }
    }

    return { entryId: res.entryId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo apuntar a la lista de espera. Inténtalo de nuevo." };
  }
}
