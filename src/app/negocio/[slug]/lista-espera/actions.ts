"use server";

import { createClient } from "@/lib/supabase/server";
import { getPublicBusinessBySlug } from "@/lib/services/publicBusinessService";
import { joinWaitlistPublic } from "@/lib/services/customerPortalService";
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
 * Página pública "Apuntarme a la lista de espera" para quien todavía no
 * tiene sesión de portal (primera vez, o no le ha llegado o no ha usado el
 * enlace de acceso) — usa `join_waitlist_public`, que además da de alta al
 * cliente si hace falta (mismo patrón que `create_public_booking`) y
 * genera ya un token de acceso para que el email de confirmación sirva
 * también como enlace de entrada al portal.
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

    if (res.customerEmail && res.accessToken) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const portalLink = `${siteUrl}/negocio/${slug}/mis-citas/verificar?token=${res.accessToken}`;
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
          portalLink,
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
