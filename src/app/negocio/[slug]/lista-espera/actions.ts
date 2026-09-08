"use server";

import { getCustomerSessionToken } from "@/lib/services/customerAuthSession";
import { joinWaitlistByAccount, getCustomerAccountProfile } from "@/lib/services/customerAccountService";
import { createClient } from "@/lib/supabase/server";
import { getPublicBusinessBySlug } from "@/lib/services/publicBusinessService";
import { sendWaitlistJoinConfirmationEmail } from "@/lib/email/emailService";

export interface JoinWaitlistByAccountActionInput {
  serviceId: string;
  preferredDate: string;
}

export interface JoinWaitlistByAccountActionResult {
  entryId?: string;
  error?: string;
}

/**
 * Reemplaza a la antigua `joinWaitlistPublicAction` (Fase 7.4): ya no hace
 * falta ni se puede mandar nombre/teléfono/email desde el formulario — se
 * apunta con la cuenta que tenga la sesión, igual que
 * `createAccountBookingAction` en `/reservar`.
 */
export async function joinWaitlistByAccountAction(
  slug: string,
  input: JoinWaitlistByAccountActionInput,
): Promise<JoinWaitlistByAccountActionResult> {
  const token = await getCustomerSessionToken();
  if (!token) return { error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };

  if (!input.serviceId || !input.preferredDate) {
    return { error: "Elige un servicio y un día." };
  }

  const result = await getPublicBusinessBySlug(slug);
  if (!result) return { error: "Negocio no encontrado." };

  try {
    const supabase = await createClient();

    const profile = await getCustomerAccountProfile(supabase, token);
    if (!profile) return { error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };

    const res = await joinWaitlistByAccount(supabase, token, {
      businessId: result.business.id,
      serviceId: input.serviceId,
      preferredDate: input.preferredDate,
    });

    if (res.error) return { error: res.error };

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
        toEmail: profile.email,
        customerName: profile.name,
        businessName: result.business.name,
        serviceName: service?.name ?? "",
        preferredDateLabel,
        accountLink,
      });
    } catch {
      // No-op: best-effort — el registro en la lista de espera ya se guardó bien.
    }

    return { entryId: res.entryId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo apuntar a la lista de espera. Inténtalo de nuevo." };
  }
}
